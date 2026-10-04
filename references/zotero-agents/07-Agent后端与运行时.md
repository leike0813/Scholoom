# 07 Agent后端与运行时

这一篇讲插件怎么把外部 AI Agent 接进来。核心是四类后端 Provider，以及 ACP（Agent Client Protocol）这条主路径。

## 后端抽象

### 注册机制

```
src/backends/
  types.ts      BackendType 枚举 + Provider 接口契约 + 能力矩阵类型
  registry.ts   注册表
src/providers/
  types.ts      Provider 公共类型（ProviderRequest / ProviderResult / 流式事件）
  acp/          ACP Provider
  skillrunner/  Skill-Runner Provider
  generic-http/ Generic HTTP Provider
  pass-through/ Pass-Through Provider
```

Provider 接口契约要求实现的能力：**发消息、执行 skill、流式事件推送、取消、诊断**。取消与诊断被单列出来，是因为它们不属于主流程，却是这类系统最难补的两块。

### 四类后端对照

| 后端 | 协议 | 运行位置 | 适合 |
| --- | --- | --- | --- |
| **ACP** | Agent Client Protocol（JSON-RPC） | 外部 agent CLI 子进程 | 真正的 agent 循环、多步工具调用 |
| **Skill-Runner** | 本地 skill 协议（`skillrunner.sequence.v1`） | 插件监督的本地运行时 | 确定性流水线、工作区复用 |
| **Generic HTTP** | 普通 HTTP + JSON | 插件进程内发起 | 单次文本生成，不需要 agent 循环 |
| **Pass-Through** | 无 | 不经过插件 | 手工测试、复用外部产物 |

⚠ **一个容易误解的点**：ACP 后端不是云端 API。它通过 stdio 启动 `codex mcp`、`opencode`、`claude` 等**本地 CLI 进程**，用 ACP 与之通信。所以"ACP = 用你已有的 Claude Code / Codex 订阅"是准确的——CLI 进程用的是你自己的登录态。

## ACP 协议层

### `src/modules/acp/` 的文件分组

| 组 | 职责 |
| --- | --- |
| **协议核心** | `acpProtocol.ts`（JSON-RPC 编解码）、`acpTypes.ts`（消息类型） |
| **会话** | `acpSessionManager.ts`（会话生命周期）、`acpSkillsCatalog.ts`、`acpSkillsManager.ts` |
| **运行** | `acpRunStore.ts` / `acpSkillRunStore.ts`（运行记录）、`acpSkillRunnerOrchestrator.ts`（skill 编排） |
| **transcript** | transcript 选择与 hydration（见下） |
| **诊断** | `acpChatDiagnostics.ts`、`acpRunDiagnostics.ts`、Trace & Replay |
| **runtime prompts** | `acpRuntimePromptTemplates.ts` |
| **skill patches** | `acpThinProxySkillMaterializer.ts` + 10 个 patch 模块 |
| **宿主** | `acpChatController.ts`、`acpHost.ts`、`acpBackgroundBridge.ts` |

### 传输：为什么要 `acp-ws-bridge`

ACP 的语义是"启动一个 agent CLI 子进程，和它说 JSON-RPC"。但 Zotero 沙箱里启动子进程、拿到 stdio 很麻烦，尤其在 Windows 上。

解法是一个 11 KB 的 Rust 中继进程，**把本地 WebSocket 转成子进程 stdio**：

```
Zotero 插件 ──WebSocket(127.0.0.1)──► acp-ws-bridge ──stdin/stdout──► codex / claude / opencode
```

`rust/acp-ws-bridge/`（crate 名 `zotero-acp-bridge`）**只依赖 4 个包**：`base64`、`serde`、`serde_json`、`sha1`。**没有 tokio、没有 hyper、没有 tungstenite**——RFC6455 WebSocket 手写：

```rust
const WS_GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";  // RFC6455 magic
const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_FRAME_BYTES: u64 = 16 * 1024 * 1024;
```

这解释了架构导览里「这属于平台适配层，而非业务逻辑」的判断——**它解决的纯粹是 Zotero 沙箱与子进程之间的管道问题**。

极简依赖是刻意的：每次 ACP 会话都要拉起这个进程，依赖越少冷启动越快、崩溃面越小。

### bridge 的 JSON 帧协议

不是 ACP 本身，是 bridge 与插件之间的一套简单协议：

- 插件 → bridge 的**首帧必须是 spawn request**，否则 `send_error("first websocket frame must be a spawn request")`
- spawn request：`{type, id, command, args?, cwd, env?, auditFile?}`
- bridge → 插件：`{"type":"spawned", id, pid}` / `{"type":"exit", id, code, signal}` / `{"type":"error", id, message}`
- **子进程 stdout/stderr 走 WebSocket 二进制帧**（每 8 KiB 一次读），**子进程 stdin 走客户端二进制帧**

即 agent CLI 以为自己在跟管道说话，实际是帧化后跨 WebSocket 传输。

启动参数：`--serve`（必填）、`--host`（默认 `127.0.0.1`）、`--port`（默认 0 = 随机）、`--token`（**必填**）、`--ready-file`（**必填**）、`--log-file`。

### 审计与脱敏

`append_audit_event()` 写 JSONL 审计日志，含 `spawnId` 序号，带 `is_sensitive_key()` / `sanitize_json()` 脱敏。审计 schema：`zotero-skills.acp.bridge-audit.v1`，预览上限 512 字符。

## 会话与 transcript 投影

`docs/acp-skills-transcript-selection-hydration-sequence.md` 描述的流程，是「怎么把一个流式协议变成 UI 可用数据」的完整答案。

ACP 通过 `session/update` 事件流式推送内容。插件需要：

1. 收集并缓冲这些事件
2. 按 turn / request 分组
3. 投影成 transcript 记录（用户消息、助手消息、工具调用、工具输出、诊断）
4. 支持「选择某段重放」

`acp-skills-state-machine-ssot.md` 定义了 skill 选择 → 确认 → 执行 → 回收的状态机。

**这是整个项目里最容易出 bug 的部分**，理由：ACP 的事件是增量推送、乱序可能、跨多个 transport（Chat / Skill Run / Workflow），而 UI 需要稳定的分组视图。导读把它排在第 4 步（紧接后端抽象之后）不是偶然。

## ACP 预设

`docs/components/acp-backend-presets.md` 定义可配置的 Agent CLI 预设。Backend Manager 里选预设 → 填 command / args / env / model。

`docs/components/acp-skillrunner-parity.md` 说明 ACP 与 SkillRunner 的**能力对齐关系**——两条路径要跑同一批 skill，行为差异必须在文档里列清。

### preset（来自 `agent_acp_providers.json`）

| 预设 | CLI | 状态 |
| --- | --- | --- |
| Gemini CLI | `gemini --experimental-acp` | Verified |
| Claude Code（anthropic） | `claude-code-acp` | Verified |
| OpenCode | `opencode acp` | Verified |
| Codex（OpenAI） | `npx -y @zed-industries/codex-acp` | Verified |
| Qwen Code | `qwen --experimental-acp` | Verified |
| Factory Droid | `droid` | Experimental |

每个预设声明 command、args、env（含需要的 API key）、model、capabilities、以及 runnable 能力探测。**官方明确说明"presets are configuration, not a guarantee of feature parity"** —— 预设只是配置，不代表功能对等。

## ACP Skill 补丁：一份 skill 跑两条路径

原始 skill 是给 SkillRunner 运行时写的，ACP 后端是**通用 agent CLI**——它既不知道 Zotero 的 host 能力、结果文件约定、输出 JSON 信封格式，也不知道当前是 auto 还是 interactive 模式。

补丁层（`acp-skill-patches`）解决这个 gap，10 个模块对应 `addon/content/acp-skill-patches/templates/` 下的模板文件：

```ts
export type AcpSkillPatchModule =
  | "runtime_enforcement"          // 优先级最高的硬约束块
  | "resource_mapping"             // 资源映射
  | "output_format_contract"       // 输出信封格式
  | "output_contract_details"
  | "output_contract_interactive_pending"
  | "skill_run_feedback"           // jinja 模板
  | "mode_auto" | "mode_interactive"
  | "run_execution_instructions"   // jinja 模板
  | "prompt_body_common";
```

两个 jinja 模板：`patch_skill_run_feedback.md.j2`、`run_execution_instructions.md.j2`。`acpThinProxySkillMaterializer.ts:218` 加载 `runtime_enforcement`，配合 `insertAcpSkillProxyPatchBlock` + `rewriteAcpSkillReferences` 做路径重写与 patch block 注入。

**核心手法：用优先级声明抢占 agent 的指令优先级。** `patch_runtime_enforcement.md` 的开头：

> `# ⚠ Runtime Enforcement (Injected by ACP Host -- HIGHEST PRIORITY)` … They OVERRIDE any conflicting instructions that appear earlier in this document. … You **MUST** treat every directive in this section as a hard, non-negotiable constraint.

这防的是 skill 原始指令把 agent 引向插件不预期的行为或路径。**补丁在物化期（改写 SKILL.md）与 prompt 组装期（拼 prompt body）两个时机注入**。

另有独立的 runtime prompts（非 patch），`AcpRuntimePromptTemplateId`：`acp_chat_startup_preamble`、`acp_chat_workspace_agents`、`acp_skills_startup_preamble`、`mcp_required_guard`、`recovered_continuation_guard`、`interaction_file_reply`。

## Host Bridge 能力注入

`docs/components/host-bridge-prompt-injection.md` 讲的不是"防 prompt injection 攻击"，而是 **Host Bridge CLI 的能力注入与权限门控**。三条设计原则：

1. **`zotero-bridge-cli` wrapper skill 是 Host Bridge 命令指引的唯一来源**；引擎指令文件（CLAUDE.md、AGENTS.md 等）**不得**包含 Host Bridge 命令片段——防止指引在多处以不一致形式漂移
2. 注入范围由 workflow manifest 的 `zoteroHostAccess` 声明控制
3. **写操作自动批准是双门控**：manifest 须声明 `allowWriteApprovalBypass: true` **且**用户在设置中显式开启

声明（`src/workflows/types.ts`）：

```ts
zoteroHostAccess?: { required?: boolean;               // default true
                     allowWriteApprovalBypass?: boolean; // default false };
```

注入物化产物：

```
<workspaceDir>/.zotero-bridge/
├── profile.json     # schema: zotero-bridge.profile.v1, protocol: host-bridge.v2
├── README.md
└── bin/{zotero-bridge, zotero-bridge.cmd}
```

profile 关键字段：`auth:{type:"bearer", tokenEnv:"ZOTERO_BRIDGE_TOKEN"}`、`scope:{kind:"acp-chat"|"acp-skill-run", requestId, runId, autoApproveWrites?}`（`autoApproveWrites` 仅在启用时出现）。

环境变量注入 `ZOTERO_BRIDGE_PROFILE` / `ZOTERO_BRIDGE_TOKEN` / `ZOTERO_BRIDGE_SCOPE` / `PATH`。

**SkillRunner 路径不同**：`SKILLRUNNER_SUPPORTS_ZOTERO_HOST_ACCESS_RUNTIME_OPTIONS = false`。SkillRunner job 改用通用 `runtime_options.env`，后端**不需要**理解 Zotero 专有 runtime option。

## SkillRunner 状态机

### 本地运行时状态（6 态）

`RuntimeState` 定义在 `skillRunnerLocalRuntimeManager.ts:59`：

```
unknown | starting | running | stopped | degraded | reconciling_after_heartbeat_fail
```

`unknown` 与 `degraded` 的区别是要点：**`degraded` = info 存在但通信不通**。

| 状态 | 语义 |
| --- | --- |
| `unknown` | 初始/回退；无 runtime info 或卸载后 |
| `starting` | 启动中（preflight → up → status poll） |
| `running` | 已启动且持有租约 |
| `stopped` | 已停止 |
| `degraded` | 不可达或非预期状态，installDir 等 info 仍在 |
| `reconciling_after_heartbeat_fail` | 心跳失败后的诊断/恢复轮询 |

⚠ **这个项目没有独立的 Docker 运行模式。** 文档里的"常驻"指的是插件托管的本地常驻运行时（安装目录 + 租约 + 心跳），不是容器。**无形式化事件系统**，转换由命令式控制流中的 `applyRuntimeStatePatch()` 触发。

并发控制：`withRuntimeActionMutex` + `withRuntimeControlLock`（promise 链串行化）；后台 `ensure` 动作**不受用户动作互斥锁限制**。

### 不变量文件

`skillrunner-run-lifecycle-ssot.invariants.yaml` 的示例：

- `INV-SR-RUNKEY-LOCAL-SSOT`（identity）：`{localIdentity: runKey, backendCorrelation: requestId}`；runKey MUST 在后端请求创建前分配并全程稳定
- `INV-SR-REQUESTID-ATTACH-NO-REKEY`（identity）：requestId MUST 挂到既有 runKey，**MUST NOT** 创建替代 task row
- `INV-SR-RUN-PERSISTED-MINIMAL`（data-model）：`persistedModel: lifecycle_recovery_execution_facts_only`，并显式列出 `derivedFields`（`backendBaseUrl`、`backendType`、`providerId`、`workflowLabel`、`skillName`、`sequenceStepIndex`、`sequenceFinalStepId`）——**这些是派生字段，禁止持久化**

最后一条很有价值：**明确区分"必须持久化的恢复事实"与"可以随时重算的派生字段"**，避免状态膨胀。

### 日志分层

`skillrunner-local-runtime-debug-mode-log-split.md` 的 4 条不变量：

- debug off 必须隐藏 debug-only 用户面
- debug off 不得采集 local deploy debug 条目
- 持久日志**永不**接收周期性监控/轮询噪声
- 持久日志在 debug off 时**仍须**捕获 deploy/uninstall 生命周期关键里程碑

具体切法：持久日志只允许 `deploy-*`、`oneclick-preflight`、`lease-acquire`、`uninstall-*`；**排除** `lease-heartbeat`、`heartbeat-fail-reconcile`、`auto-ensure-*`、`ensure-*`。

## 可观测性

### 结构化运行时日志

`src/modules/runtimeLogManager.ts`：

```ts
export type RuntimeLogLevel = "debug" | "info" | "warn" | "error";
export type RuntimeLogErrorCategory = "network"|"timeout"|"auth"|"validation"|"provider"|"hook"|"unknown";
export type RuntimeLogRetentionMode = "normal" | "diagnostic";
export type RuntimeLogScope = "workflow-trigger"|"job"|"state-machine"|"provider"|"hook"|"system";
```

`RuntimeLogEntry` 字段非常完整，便于事后检索：
`id, ts, level, scope, schemaVersion, diagnosticMode, workflowId, packageId, backendId, backendType, providerId, runId, requestId, jobId, interactionId, component, operation, attempt, phase, transport, stage, message, details?, error?{name,message,stack?,category?,cause?}`

容量控制：

```ts
NORMAL_MAX_ENTRIES = 2000;   NORMAL_MAX_IMPORTANT_ENTRIES = 500;
DIAGNOSTIC_MAX_ENTRIES = 3000; DIAGNOSTIC_MAX_BYTES = 20 * 1024 * 1024;
RETENTION_DAYS = 30;  MAX_STRING_LENGTH = 4000;
PERSIST_IDLE_DEBOUNCE_MS = 250;  PERSIST_MAX_DELAY_MS = 2000;
```

**双数组**（`infoEntries` / `importantEntries`）：重要事件单独保留，容量满了也不会被噪声挤掉。

脱敏：`SENSITIVE_KEY` 白名单 + `PRIVATE_LOCATION_KEY = /(path|stack|cause|url|uri|location)/i` 正则，命中即替换为 `<redacted>`。深度按 `MAX_DEPTH=6` / `MAX_ARRAY_ITEMS=100` / `MAX_OBJECT_KEYS=200` 截断。

默认允许级别 info/warn/error，**debug 默认关**。

### Trace & Replay（仅 debug 构建）

文件叫 `acp-runtime-performance-profiler.md`，实际标题是 **"ACP Trace & Replay"**。两步工作流：

**Trace Recorder** — 录制一次真实 ACP 会话或完整工作流执行，输出**未聚合的语义事件流**。

绑定规则很严格：Chat 只在**下一次用户主动 Connect/Reconnect 成功**创建/恢复/加载远端 session 后才绑定——已 live 的 session、隐式 prompt 连接、后台恢复、连接期事件都**不能 claim**。Workflow 仅在**新的顶层执行至少有 1 个可执行 ACP 请求**时绑定。recovery 与零请求执行不能 claim。

状态序列：`idle → armed → recording → stopping → frozen → saved`

完整性保证：完整 trace 恰一个 `root-start`、恰一个 `root-end`、至少一对 turn/request。NDJSON 先写 `.partial`，Finish 时校验事件数 / 字节数 / SHA-256 / footer 后**原子改名**。Cancel 写 `user-canceled` 不完整 footer 并**保留 `.partial`**。`New Recording` **从不删**先前 partial/saved。

配额：256 MiB / 250,000 事件 / 单事件 16 MiB；Dashboard 覆盖只能**调低**。配额耗尽立即 freeze，**绝不静默丢事件**。

安全边界（文档明确写出）：trace 保留完整 prompt、assistant 文本、tool 参数/输出、权限结果，**不做脱敏或截断**；记录的是语义事件而非 JSON-RPC wire frame，因此**传输授权与 token 被排除**；Dashboard 只有 Save / Open Folder，**无剪贴板、无上传、无提交**。

**Replay Profiler** — 加载完整本地 trace，**不接触任何后端**，跨 3 种 surface 跑 9 次合成 replay。三种 cadence：

| cadence | 行为 |
| --- | --- |
| `recorded` | 每个原始单调间隔在上一事件消费完成后等待，不追赶突发 |
| `logical` | 跳过 idle gap，用逻辑时间执行 replay 自有定时器（16ms workspace publication / 160ms live publication / 2000ms persistence） |
| `burst` | 前一消费者完成即立刻投递下一事件 |

`logical` **不复现**墙钟时间、吞吐、调度延迟、event-loop 漂移；报告把这些值标记为"与非 recorded 计时可比"。**它只接管显式作用域内的合成定时器，从不 patch 全局 timer**；非 debug 构建会移除 logical scheduler 与 timer control 函数体。

Chat trace 与 Workflow trace 是**不同 baseline family，不可互相比较**。

### 调试开关

`src/modules/debugMode.ts`：

```ts
export const ACP_RUNTIME_PERFORMANCE_PROFILER_ENABLED = true;
export const ACP_RUNTIME_SEMANTIC_TRACE_RECORDER_ENABLED = true;
export const ACP_RUNTIME_REPLAY_PROFILER_ENABLED = true;
export const SKILLRUNNER_CONNECTION_AUDIT_ENABLED = false;
export const SYNTHESIS_SIDECAR_DIAGNOSTICS_ENABLED = true;
export const WORKSPACE_PUBLICATION_WIRE_ASSERT_ENABLED = true;
```

**这些是源码字面量 + esbuild define，不是 preference，运行时不可切换。** `__debug_mode__` 由 `zotero-plugin.config.ts` 注入，仅 dev 分支为 true。debug 构建下暴露单一 Trace & Replay Dashboard tab。

Wire assert 默认开启、release 时被 esbuild define 折叠——**边界契约在开发期强校验、生产期零成本**。

## 对 Scholoom 的启示

1. **subprocess ↔ 平台边界的最小中继**。沙箱里调外部进程必然需要一个管道中继，把它做成极小、零重依赖的独立二进制，而不是在主进程里堆适配代码。
2. **一份 skill 跑多条后端路径，用补丁层对齐**。不要为每条路径各写一份 skill 资产。
3. **用优先级声明抢占 agent 指令优先级**。给注入块标 "HIGHEST PRIORITY / OVERRIDE / non-negotiable"，比在别处写约束有效得多。
4. **日志双数组 + 分层保留**。重要事件与噪声分开存，容量上限各自独立。
5. **明确列出「禁止持久化的派生字段」**。这比"该存什么"更容易执行，也更难写错。
6. **wire assert 用编译期开关而非运行时开关**。开发期强校验、生产期被 tree-shake 掉。
7. **能力注入的指引要有唯一来源**。wrapper skill 是唯一出处，引擎指令文件不得复制命令片段。

## 来源

- `src/modules/acp/`（文件清点）、`src/acpProtocol.ts`、`src/acpTypes.ts`
- `src/providers/{acp,skillrunner,generic-http,pass-through}/`
- `src/backends/{types,registry}.ts`
- `src/config/agent_acp_providers.json`（6 个预设，逐项读取）
- `docs/acp-skills-transcript-selection-hydration-sequence.md`、`acp-skills-state-machine-ssot.md`
- `docs/components/acp-backend-presets.md`、`acp-skillrunner-parity.md`、`acp-runtime-performance-profiler.md`
- `docs/components/skillrunner-*-ssot{,.md,.invariants.yaml}`（3 个 invariants 文件）
- `docs/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md`、`skillrunner-local-runtime-debug-mode-log-split.md`
- `docs/components/host-bridge-prompt-injection.md`
- `src/modules/runtimeLogManager.ts`、`src/modules/debugMode.ts`
- `src/modules/acp/acpThinProxySkillMaterializer.ts`、`acpSkillRunPromptBuilder.ts`、`acpRuntimePromptTemplates.ts`
- `src/workflows/types.ts`、`src/workflows/zoteroHostAccessOptions.ts`
- `src/modules/hostBridge/cli/hostBridgeCliInjection.ts`
- `rust/acp-ws-bridge/src/main.rs`、`Cargo.toml`
- `scripts/zotero-native-crash-capture.ts`（仅确认存在）
