# 08 能力包与 Procedure 发现

## 核心能力 vs 插件扩展

| | Core capability | Plugin extension |
| --- | --- | --- |
| 数量 | **47** | **339** |
| 来源 | `skills/capabilities/*`（ARSU 转换 + 内部编写） | 6 个 vendor 的 338 个已审 Skill + ARSU 路由 |
| 覆盖 | 学术写作全流程 | 学科与工具领域 |
| 选择 | 默认可见 | 按 domain 显式安装 |
| Procedure ID | 能力包 slug | `plugin-<vendor>-<skill-slug>` |

历史数字对照：早期只有 8 个核心能力，扩展到 16，再 44，最终 47（`AGENTS.md:101-104`）——**扩展是渐进的，每一步都由实际需求驱动**。

## 能力包结构与 manifest

```text
skills/capabilities/<slug>/
├── manifest.yaml        # 契约（schema 1），SSOT
├── SKILL.md             # Agent 可读说明
└── references/          # 渐进披露的参考资源
```

`src/core/contracts/capability-manifest.ts:137-172` 的 `CapabilityManifestSchema` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schema_version` | `"1"` | 字面量 |
| `capability_id` | 小写 kebab-case | **Open Agent Skills 命名**，正则 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，≤128 字符（`:63-66`） |
| `title` / `description` | 非空串 | |
| `class` | 枚举（见下） | 能力类别 |
| `node_kind` | `producer` \| `checker` \| `observer` | 在图中的角色（`:17-21`） |
| `execution_type` | `llm` \| `script` \| `mixed` | 执行方式（`:23-27`） |
| `maturity?` | `skeleton` \| `operational` \| `deprecated` | |
| `params?` / `presets?` | record / 数组 | 参数与预设 |
| `inputs[]` | `{ role, schema_ref, required?, source_policy }` | `source_policy` ∈ `stable_spec` \| `handoff` \| `node_output` \| `parameter`，**默认 `handoff`**（`:78`） |
| `outputs[]` | `{ role, schema_ref, required? }` | |
| `validators[]` | 见下 | |
| `knowledge_refs[]` | `{ knowledge_id, path, content_hash, license }` | **每条都带 SHA-256 与 license** |
| `gate_policy` | `none` \| `advisory` \| `required` | |
| `provenance` | `{ origin, extraction_artifact_ids?, upstream_sources?, notes? }` | `upstream_sources[]` 带 `path` / `lines` / `sha256` |
| `license` | 非空串 | **必填** |

### `class` 的七个取值

`capability-manifest.ts:7-15`：

```text
discovery | design | analysis | generation | verification | judgment | transformation
```

**注意这不是「工具 / 工作流」那套分类。** 分类轴是**能力在研究流程中的职能**（发现 → 设计 → 分析 → 生成 → 验证 → 判断 → 改造），而不是技术形态。

配套的两个正交维度：

| 维度 | 取值 | 作用 |
| --- | --- | --- |
| `node_kind` | `producer` / `checker` / `observer` | 图中角色 |
| `execution_type` | `llm` / `script` / `mixed` | 执行方式 |

### 五条 superRefine 硬约束

`capability-manifest.ts:155-172`：

1. `inputs` / `outputs` / `validators` / `knowledge_refs` / `presets` 各自的 ID **不得重复**
2. `node_kind === "producer"` 必须有 **≥1 个 output role**
3. 每个 validator 的 `inputs` 必须是已声明的 input role，或字面量 `"*"`
4. `kind === "script"` 的 validator **必须**声明 `runner`（`:100-102`）
5. `network === true` 的 validator **必须**声明 `degraded_verdict`（`:103-105`）

第 4、5 条是本项目的一贯风格：**声明了网络访问就必须说明降级行为**（`degraded_verdict` 的注释直接举例 `unresolvable`）。

### Validator 契约

`capability-manifest.ts:87-106`：

```ts
{ validator_id, kind: "schema" | "script" | "policy",
  inputs: string[], outputs: string[],
  error_codes: string[],       // 正则：小写稳定标识符
  network?: boolean, degraded_verdict?: string,
  runner?: { argv0, args_template } }
```

`error_codes` 的正则 `/^[a-z][a-z0-9_-]*$/` 强制稳定错误码——**这是为了让测试断言结构化 code 而非文案**（见 [13 篇](13-构建测试与工程化.md)）。

## 能力注册表：运行前五项核对

`src/capabilities/registry.ts:127-170`，加载每个能力包时逐项核对（行号经核实）：

1. `:127-129` 重算 manifest 的 **SHA-256**，与注册表里的 `manifest_sha256`（schema 字段定义在 `:31`）比对，不符即 `capability_manifest_hash_mismatch`（fatal）
2. `:149-154` `SKILL.md` 缺失 → `capability_skill_missing`
3. `:157` `SKILL.md` 为空 → `capability_skill_empty`
4. `:169` 逐个校验知识资源的哈希

**注意：这是「重算哈希并比对」而不是「相信清单」。** 清单说哈希是什么，代码重算一次，对不上就 fatal。

任一不满足 → 该能力包**不加载**，registry 记录诊断并继续（不整体失败）。

`loadCapabilityRegistry(root)` 是全仓第二热的符号（fan-in 28，28 个直接消费者）。

## 两类 validator

| 类型 | 声明 | 何时执行 |
| --- | --- | --- |
| **Policy validator** | 表达式：必须含 bundle 证据路径、必须含检索/工具路由、必须声明 Stop 条件、必须用 `category: process` | **维护期 CI** |
| **Script validator** | 命令（`command: string`） | **仅维护期 CI** |

`capability-manifest.ts:66-74` 的注释是重点：

> Both check artifact shape and evidence, not runtime behavior.

**用户运行能力时，CLI 不执行任何 validator。** 这是本项目最重要的一条边界：

> `docs/maintainer/README.md:10-11` —— 验证器用于**维护**。它们在转换/检查命令和 CI 中运行，不是用户 runtime guard。

理由：如果每次执行能力都要跑 validator，那 validator 就成了运行时的同步阻塞点，而且用户机器上未必有依赖。

`validateManifestGraph`（`registry.ts:346-408`）做结构检查：leaf/root 判定、`required_capabilities` 存在性、**依赖环检测**（`validateNoDependencyCycles`，`registry.ts:412-434`）。检测顺序是「先深度优先访问」而非「先颜色标记」——**这是 `dependencyDepth` 唯一能正确检测环的地方**，注释专门警告不要改。

## Procedure 目录：五类来源合并

`src/procedures/catalog.ts:32-60` 的 `loadProcedureCatalog`：

```text
核心能力（skills/capabilities/*/manifest.yaml）
graph profile（derived-profiles 中有 cap- 的）
插件扩展（skill bundles）
ARSU 路由（routing-catalog.yaml）
Companion 工作流
  ↓
去重 → 确定性排序 → ProcedureCatalog（schema 1）
```

| 文件 | 职责 |
| --- | --- |
| `src/procedures/catalog.ts` | 五类来源合并、查询打分、四种 kind |
| `src/procedures/packet.ts` | 激活包（activation packet）schema 1 生成 |
| `src/procedures/catalog.ts` | `Procedure` / `ProcedureCatalog` 类型 |

### Procedure ID 命名

`procedure-types.ts:9-18`：

```ts
type ProcedureId = `${string}:${string}`;
//   `${capabilitySlug}:${instanceVariant}`
// 例：arsu:deep-research、paper-humanizer:general
```

- **核心/ARSU 能力**：`arsu:deep-research`、`paper-humanizer:general`
- **插件扩展**：`plugin-tooluniverse-<slug>`、`plugin-financial-<slug>`、…

### 激活包字段（schema 1）

`packet.ts:4-40`：

```ts
{
  schema_version: 1,
  procedure_id, title, kind, source_ref,
  description, execution, output_contract,
  inputs[], instructions_ref, resources[],
  writing_mode, delivery, external_tools,
  validators, maturity
}
```

- `inputs[]` / `output_contract` / `delivery` / `validators` **复用 manifest 原数组**，不重新排序去重
- `instructions_ref`：`instructions procedure:<id>` selector
- `resources`：非 `SKILL.md` 的文件按 POSIX 序排列
- `writing_mode`：`project | scratch | analyze-only | both`

## 渐进披露三段式

这是 ResearchSpec 最重要的上下文工程设计（`docs/user/usage-model.md`）：

| 阶段 | 返回 | 体积 |
| --- | --- | --- |
| `list procedures --query` | 紧凑卡片（描述截断 240 字符） | 小 |
| `show procedure:<id>` | 同一张卡片的 pretty JSON | 小 |
| `instructions procedure:<id>` | **完整 procedure 正文全文** | 大 |

「只有宿主支持时才投影部分」——按需加载。

**每个 workspace 实际只常驻一个能力**：`researchspec-navigate`。其他 393 个（4 ARSU + 3 非 Navigate Companion + 47 core + 339 plugin）**从 registry 即时派生，不投影进宿主 Skill catalog**。

这解决了一个具体问题：如果 393 个能力全部常驻，Agent 每次会话都要在 393 个描述里做选择，token 成本和选择质量都不可接受。改为「一个导航 + 按需发现」。

### 搜索打分

`catalog.ts:163-172`：

| 条件 | 分数 |
| --- | --- |
| 完全相等（normalized） | 4 |
| 所有词命中 | 3 |
| 部分命中 | 2 |

同分按 id 字典序。默认 limit 10，范围 1–50。

### 游标

游标编解码在 **`src/cli/handlers/graph-context.ts:238-247`**，不在 catalog 里：

```text
decodeListCursor(cursor, type, fingerprint) → offset
```

四种明确的错误码（每个都是 `CliError`，exit code 2）：

| 错误码 | 触发条件 | 行号 |
| --- | --- | --- |
| `list_cursor_invalid` | base64url 解不出 / 不是对象 / 数组 / `offset` 非非负整数 | `:241,242,246` |
| `list_cursor_collection_mismatch` | `payload.type` 与当前集合类型不符 | `:244` |
| `list_cursor_stale` | `payload.fingerprint` 与当前内容指纹不符 | `:245` |
| `list_cursor_stale` | 游标 offset 超出当前结果集长度 | `:57` |

**「类型不符」和「内容变了」是两个不同的错误码** —— 前者说明 Agent 拿错了集合的游标，后者说明 workspace 变了。这个区分对 Agent 恢复决策很有用。

**这是「防跳项」的正确做法**：游标绑定内容指纹，任何内容变化都让旧游标失效并明确报错，绝不静默跳项。

## 四种 Procedure kind

`src/procedures/catalog.ts:12` 只有**四个** kind：

```ts
export type ProcedureKind = "arsu" | "companion" | "capability" | "plugin";
```

五类来源各自映射到其中一个（`catalog.ts:58,76,93,119`）：

| 来源 | kind | 数量 |
| --- | --- | --- |
| ARSU 路由 | `arsu` | 4 |
| Companion workflow | `companion` | 3（propose / decide / verify） |
| 核心能力包 | `capability` | 47 |
| 插件扩展 | `plugin` | 339 |

**这是 catalog 的四路分支，不是流程可组合性的限制。** `docs/developer/architecture.md:48-49` 明确：

> Profile 定义 entry、route binding、节点、依赖、parallel/join、Gates、Decisions、动态轮次和 subgraph bindings。**Core 只提供图语义，不内置 deep-research 或 academic-pipeline 的固定阶段。**

图节点类型另有 5 种（`src/core/contracts/capability-graph.ts:11`）：

```ts
GraphNodeKind = "capability" | "subgraph" | "gate" | "decision" | "observer"
```

配套枚举：

| 枚举 | 取值 | 行号 |
| --- | --- | --- |
| `GraphEntryKind` | `end-to-end` \| `mid-entry` | `:10` |
| `GraphMultiplicity` | `one` \| `optional` \| `repeatable` | `:12` |
| `GraphJoinPolicy` | `all` \| `any` | `:13` |
| `GraphGatePolicy` | `required` \| `conditional` | `:14` |
| `GraphVerdict` | `pass` \| `pass_with_conditions` \| `fail` | `:15` |

## Companion Skills

Adapter 层生成**四个** Companion workflow wrapper（`src/adapters/companion/workflows/` + `manifest.ts`）：

| workflow | skillId | 角色 |
| --- | --- | --- |
| `navigate` | `researchspec-navigate` | **唯一常驻入口** |
| `propose` | `researchspec-propose` | 提案 |
| `decide` | `researchspec-decide` | 决策 |
| `verify` | `researchspec-verify` | 校验 |

`src/adapters/companion/manifest.ts:8-14` 构造 `COMPANION_INTENTS`，并断言「每个 workflow ID 恰好出现一次」，否则 throw。

`src/adapters/delivery.ts:41-42` 对 navigate 有硬保护：

```ts
const navigate = COMPANION_INTENTS.find((intent) => intent.id === "navigate");
if (!navigate) throw new Error("Navigate Companion is unavailable.");
```

**「3 个非 Navigate Companion」** 指 propose / decide / verify —— `docs/user/usage-model.md` 的表述正确。

`README.md:19-20` 的「four ARSU and four Companion Skills」**也是正确的**：4 个 ARSU workflow（deep-research / academic-paper / academic-paper-reviewer / academic-pipeline）+ 4 个 Companion。

> 调研中曾出现「6 个 ARSU wrapper + 7 个 Companion」的说法，**该说法无代码依据**。`src/capabilities/registry.ts` 中并不存在 `arsu:* → researchspec-*` 的映射表。以 `companion/workflows/` 目录为准。

### Companion ≠ skill wrapper

`docs/developer/architecture.md:92-99`「Agent 与扩展边界」（核心区分）：

> 宿主只常驻 Navigate。Navigate 先读取紧凑卡片，选定后才加载完整 Procedure；**Propose、Verify、Decide 与 ARSU/core/plugin 程序都走同一按需入口**。

> 已核实原生规则的宿主可接收项目级研究入口约定：**专用文件由安装 manifest 整文件管理，共享文件只由固定标记区域与该区域的哈希管理**。约定是 Navigate 的非入口上下文，**不新增 Skill、Command、Procedure 或 worker**；静态安装状态不等于真实宿主会主动调用。

最后一句是本模块最诚实的设计声明：**装上去了不等于宿主会主动调用。** 工具不对宿主的实际行为做乐观假设。

- **Capability Skill** 可以调用 `decide` / `start` / `advance`（其 `agent_decisions: true` 授权声明）
- **Companion wrapper** 本身不声明 `agent_decisions`，只编排

## 能力作者编写流程

`AGENTS.md` + `AGENTS.md:802-815` 的硬规则：

### 硬规则（`AGENTS.md:804-806`）

1. **只有 metadata 保持声明式**
2. **`SKILL.md` 是面向 Agent 的说明，不是 API 文档或架构说明**
3. **语义说明使用 `references/` 资源，Procedure 只按需投影**

违反的后果是具体的（`AGENTS.md:808-811`）：

> 这三项规则对**可读性、可测试性和适配器稳定性**都是必需的。否则程序化校验会漂移，Agent 会被要求从说明文本中推理实现细节，且每个宿主适配器都会被迫做额外工作。

### 提取流水线（`docs/maintainer/authoring/`）

`authoring/<name>/` → extract → curate → author

- `capsule-docs/`：Agent 不可读的目标材料 → Agent 可读源码注释
- `capsule-conversations/`：脱敏对话 → 结构化 trace
- `capsule-narrative/`：叙述性指令 → 程序化工作流
- `validation-criteria/`：可执行断言

`extraction-index.json` 是入口。`convert` 只做确定性搬运，**不新增、不润色、不重排**。作者只做两件事：

1. 补充编排层缺失的程序逻辑
2. 删减目标材料里对程序化执行无用的内容

### 语言选择

`AGENTS.md` 规定：**不强制所有能力用同一语言**。选择取决于上游材料语言和作者判断。Python / TypeScript / shell 都可，宿主负责探测对应 runtime。**只有当来源不明确时才用英文兜底。**

## 能力质量审计

`pnpm capability:parity` + `capability:assessment-html` 产生的三份产物（`AGENTS.md:26-27`）：

1. **覆盖度**：哪些 ARSU 材料还没转成能力
2. **重叠度**：能力之间有多少实质重叠
3. **质量**：已转化能力是否满足质量标准

`AGENTS.md:51` 把这三个问题直接写成了「不应该成为手工维护的生成产物副本」的动机——质量是靠持续审计维持的，不是靠一次转换。

## 给 Scholoom 的启示

1. **一个导航 + 按需发现**，而不是几百个常驻能力。这是 Agent 能力分发的标准解法。
2. **游标绑定内容指纹**。分页时任何内容变化都让旧游标失效，避免静默跳项。
3. **Validator 只在维护期跑**。运行期执行 validator 是把维护成本转嫁给用户。
4. **依赖环检测的位置很关键**。它必须跑在深度优先访问的地方，换个遍历方式环就检不出来。
5. **能力包只有一份 metadata**。manifest 派生 SKILL.md frontmatter，不允许双份手写。
6. **渐进披露分三档**。列表/详情/全文，每档裁剪粒度不同。240 字符的描述截断就是让第一档足够小。
