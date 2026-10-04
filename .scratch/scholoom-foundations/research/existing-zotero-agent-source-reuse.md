# zotero-agents 非 Synthesis 源码复用事实（决策票 19 用）

## 事实基础与可信度边界

调查对象为 `/home/joshua/Workspace/Code/JavaScript/zotero-agents`，分支 `dev`，HEAD `8394fee1a8708a0c2a04e786f6fd8c47f1f28f33`（2026-10-02 19:08 +0800），`git status --porcelain` 为空。**工作区干净，结论对应当前 HEAD 的实际源码，不受未提交改动影响**；HEAD 之后若有推进需重新核对行号。

定位以仓库内 `.codegraph/` 索引的 `codegraph explore` 为主，索引缺失处用 `rg` 兜底。**全部结论为静态阅读所得：未运行任何测试、未启动插件、未执行 Rust 二进制、未做跨平台或兼容性实验**。表中「现有测试」一列只登记仓库内可观察到的测试文件，不代表其当前通过。下文所称 AGENTS.md 与 README 中的模块描述属**文档快照**，仅在与源码一致处引用；本笔记不据文档快照推断可移植性。

范围严格排除 Synthesis 的 Rust 算法与图谱/引用匹配实现（父票负责）。不调查 zotero-agents 旧版 Skill-Runner 的包格式、API、CLI 与运行方式兼容性。

## 候选实现清单

| # | 位置（绝对路径:行） | 函数/符号 | 功能 | 实际外部与宿主依赖 | 复用判断 | 现有测试（只查不跑） |
|---|---|---|---|---|---|---|
| 1 | `rust/acp-ws-bridge/src/main.rs:402`、`:584` | WebSocket 握手、`Command::new` + piped stdio | 裸 TCP 手写 WebSocket 握手，把 WS 帧与子进程 stdin/stdout 双向转发；日志走 stdout JSON 行 | 仅 `serde_json` 与标准库 socket/process，无 Zotero 依赖 | **借鉴行为、重新选择传输实现**：Node 可直接管理子进程与标准输入输出；是否仍需 WebSocket 桥取决于新进程边界，不承诺无需验证的等价实现 | `tests/acp/166-acp-websocket-bridge-packaging.test.ts` |
| 2 | `src/modules/acpProtocol.ts:3`、`:5` | `ACP_PROTOCOL_VERSION`、`ACP_AGENT_METHODS`、`ACP_CLIENT_METHODS` | ACP 方法名常量与 JSON-RPC 2.0 请求/通知/响应类型 | 仅 1 处 type-only import（`acpPermissionOptions`） | **直接复用**：纯声明，无运行时与宿主耦合 | `tests/acp/100-acp-client-connection.test.ts` |
| 3 | `src/modules/acp/transport/acpConnectionAdapter.ts:229`、`:248`；`src/modules/acp/chat/acpSessionManager.ts:3094` | `AcpConnectionAdapter`（含 `cancel`）、`cancelAcpConversationPrompt` | 会话建立/附加/恢复、取消、权限与诊断事件订阅的适配器边界 | 依赖 `platform/subprocess.ts`、`platform/env.ts`、`platform/processControl.ts`、`runtimePersistence`；进程启动路径整体带 Zotero runtime 探测 | **抽取语义边界**：接口形状可直接作为 Scholoom ACP client 的 port 契约；`acpTransport.ts`（2620 行）含大量 Zotero runtime 特性探测，**重写** | `tests/acp/96-acp-session-manager-lifecycle.test.ts`、`tests/acp/197-acp-synthetic-connection-adapter.test.ts` |
| 4 | `src/modules/acp/skillRun/acpSkillOutputValidator.ts:55`、`:156` | `validateAcpSkillFinalPayload`、`buildAcpSkillOutputRepairPrompt` | 用 Ajv 校验 Agent 产出的结构化结果工件，并生成修复提示 | `readRuntimeTextFile`（宿主 FS）、`workflowExecution/artifactManifest` | **抽取**：schema 校验与修复提示逻辑可移植；工件读取需换 Scholoom 侧文件接口 | `tests/acp/130-acp-skill-run-request-adapter.test.ts` 等 |
| 5 | `src/modules/runtimePersistence.ts:490`、`:686`、`:800` | platform 探测、`tryNodeFs`、`ensureRuntimeDirectory` 内部 | 跨运行时文件系统适配的唯一事实源：先试 Node `fs/promises`，回退 `IOUtils` → `OS.File` → `Zotero.File`/`Components` | 强依赖 Zotero 全局对象（`runtime.IOUtils`/`OS.File`/`Zotero.File`/`Components`） | **仅借鉴语义**：分层回退顺序与「单点选择适配器」的约束值得沿用；代码本身宿主绑定，Scholoom 为 Node 环境，**重写为 Node 单实现** | `tests/108-runtime-persistence-governance.test.ts`、`tests/164-runtime-platform-services.test.ts` |
| 6 | `src/workflows/packageHookBundler.ts:372`、`:25`；`src/workflows/types.ts:1932` | `bundlePackageHookScript`、`WorkflowHooksSpec` | 将工作流包的 `buildRequest`/`applyResult` ESM hook 打成单段可执行脚本文本并按指纹缓存 | 依赖 `readRuntimeTextFileStrict` 与 `utils/path`，为插件环境设计 | **按原生执行契约重做装载**：请求构造和结果处理可以参考；不继承旧 hook 生命周期。Node ESM 是装载候选，但内容实际修订、执行权限与隔离仍由架构决定，不能以 import 自动满足这些要求 | `tests/workflows/*`（未逐一枚举） |
| 7 | `src/jobQueue/workflowSubmissionQueue.ts:951`、`:326`；`src/jobQueue/workflowSubmissionQueueContracts.ts:8` | `workflowSubmissionQueue`、`listQueued`、`WorkflowQueueEntryId` | 提交队列：槽位协调、暂停/恢复原因、快照投影、变更事件 | 依赖 `runtimeLogManager` 及 Dashboard/Assistant/HostBridge 多个投影面 | **仅语义**：队列身份与槽位语义可参考；与旧 Dashboard/Host Bridge 投影耦合，Scholoom 统一 Invocation/Change 体系下**重写** | `tests/workflows/164-workflow-host-queue-management.test.ts` |
| 8 | `src/modules/zoteroHostCapabilityBroker.ts:529`；`src/modules/hostBridge/server/hostBridgeServer.ts:438` | `ZoteroHostCapabilityBroker`、`createServerSocket`（`nsIServerSocket`） | 宿主能力入口，及其 HTTP/MCP 投射 | Broker 面向 raw `Zotero.Item`/`Collection`；Host Bridge 用 Mozilla `nsIServerSocket` 起服务 | **不能直接作为 Node 原生领域实现**：若选 Gecko 辅助宿主，其中的读取、附件或写回逻辑仍可能作为兼容适配器被复用；宿主原型明确后判断。不能据宿主耦合宣布没有抽取价值 | `tests/zotero-host/*`、`tests/host-bridge/106-host-bridge-server.test.ts` |
| 9 | `workflows_builtin/literature-workbench-package/lib/referenceQualityGate.mjs:169`、`:227`；`tagCompliance.mjs:13`；`canonicalLiteratureValidators.mjs`；`scripts/content-package/build-canonical-literature-validators.ts:4` | `classifyReferenceExtractionQuality`、`filterReferencesForDigestApply`、`evaluateTagCompliance`、生成的 Ajv 校验器 | 文献结构化结果分类/过滤、标签合规判定、JSON Schema 校验 | 构建脚本使用 Ajv standalone 并打包依赖；产物中的 `.code` 字符串不是运行时依赖证明。`digestPayload.mjs:1` 依赖 `requireHostApi` | **抽取判据、按新 schema 生成校验器**：质量和标签函数是源码复用候选；生成产物不作为手工维护的规则事实源。digest 落库接入 Scholoom 的产物与变更接口 | `tests/workflow-literature-workbench-package/46-reference-workbench-import-validation.test.ts`、`tests/workflow-tag-regulator/64b-*.test.ts` |
| 10 | `skills_src/literature-deep-reading/renderer/render_literature_deep_reading_skill.ts:1`、`:45`；`skills_src/topic-synthesis/contracts/paths.yaml`、`stage-guidance.yaml`、`stdout-envelope.schema.json` | `validateSchemaAssetBeforeRender` 及渲染入口；YAML/JSON 原生契约 | 以 Node 脚本从契约生成 Skill 包；契约用独立 YAML 与 JSON Schema 表达阶段、路径与 stdout envelope | 渲染器用 `fs/promises`、`child_process`，并复用 `acpSkillSchemaAssets` 的 `compileSkillJsonSchema` | **抽取格式、重写实现**：Scholoom 已定「Skill 标准 + 独立 YAML 原生契约」，此处是**可参照的现成先例**；生成器脚本本身耦合本仓路径，重写 | `tests/acp/110-acp-shared-skill-catalog-thin-proxy.test.ts`、`tests/workflow-literature-deep-reading/158-*.test.ts` |

表中路径均相对 `/home/joshua/Workspace/Code/JavaScript/zotero-agents/`。

## 读出的判断依据

第一，非 Synthesis 部分的宿主耦合是分层的。纯声明、纯函数与进程桥可脱离 Zotero 讨论复用；持久化、传输与 broker 的宿主耦合需要逐项处理。源码显示原生宿主类型和平台依赖会穿越接口，但尚无工时测量证明抽取一定比重写昂贵；兼容宿主内的复用价值也不能据此排除。

第二，zotero-agents 自身已给出「同一逻辑跨运行时适配」的形态：宿主无关的实现与宿主专属实现被显式分层（`src/platform/*` 加 `runtimePersistence`），Skill 与工作流包则刻意保持在无 Node 依赖的 ESM 层面。Scholoom 已确定 Node 为 Agent 执行基础，因此**无需移植这套为 Zotero 运行时做适配的成本**，但可以沿用其分层约束。

第三，两个 Rust bridge 的角色不同：`acp-ws-bridge` 是进程/网络桥，Node 环境可重新选择是否需要此桥；`zotero-bridge`（`client.rs:19` 的 `call`、`transport.rs` 基于 `TcpStream` 加 sha2 签名）是 Host Bridge CLI 客户端，其价值取决于兼容宿主及通信方式。宿主未定时，不提前承诺携带或删除它。

第四，文献与标签工作流的**判据层**（质量门禁、合规判定、schema 校验）与**宿主落库层**分离得很干净：前者是可移植的纯函数，后者经 `requireHostApi`。Scholoom 统一 research task/Invocation/Change 体系下，可只取前者。

## 未证实事项

- 未运行任何测试，候选的「现有测试」仅表示仓库中可观察到的相关测试文件，其通过状态与对 Scholoom 的适配性均未验证。
- 未验证 `acp-ws-bridge` 在 Gecko 宿主下的实际行为，也未评估 Node 侧重写后的握手、心跳与超时等价性；此处只给出「无宿主依赖」这一静态事实。
- 未评估各候选的真实性能特征（吞吐、内存），因此「重写更快」或「复用更省」均无数据支撑。
- 未验证 Gecko 兼容宿主是否会复用 host-bridge 协议；该判断依赖后续宿主选型票。
- 未读取 zotero-agents 的 `references/` 子模块、`.env` 等可能含私人数据的文件，也未记录其存在以外的信息。
- 本笔记不含 Synthesis Rust/算法的任何结论，按票 19 边界交由父调查负责。
