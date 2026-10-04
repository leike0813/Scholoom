# 15 对 Scholoom 的启示

调研完 ResearchSpec 之后，最有价值的不是「它有多少功能」，而是**它在哪些地方做了取舍，以及那些取舍为什么值得抄**。

下面按「可迁移程度」排序。前三节建议直接照搬思路；后面几节需要按 Scholoom 的实际形态调整。

---

## 一、状态治理：最值得整体借鉴的部分

### 1.1 CLI 作为唯一写入入口

```
Agent（任何模型、任何平台）
    ↓ 只能通过 CLI 请求变更
ResearchSpec CLI（确定性代码，完整可测）
    ↓ 写入
owner 文件（Markdown / YAML / JSON）
    ↓ 扫描推导
派生视图（status / list / show / frontier）
```

**为什么这条最重要**：一旦 Agent 能直接改状态文件，整个系统就变成「一个会写文件的 LLM」，所有可测试性、可审计性、崩溃恢复都无从谈起。把写入收敛到一个确定性进程后：

- 状态机可以用普通单元测试覆盖
- 每次变更都产生一条可审计的记录
- 崩溃后状态是可恢复的（因为格式是约束过的）

Scholoom 如果要做任何有状态的工作流，这是**第一个要做的决定**，不是最后一个。

### 1.2 一个概念一个 owner，其余全是派生

ResearchSpec 的 owner 表：

| 概念 | Owner |
| --- | --- |
| 研究承诺 | 四份 stable specs |
| 执行图 | graph profile |
| 运行状态 | `run.yaml` |
| 节点状态 | `nodes/<node>.yaml` |
| 边界交换 | `handoff.md` |
| 未应用提案 | `changes/<change>/` |

**没有全局索引，没有隐藏事务日志，没有反规范化表。** 所有汇总都是读时扫描 + 内存索引。

这消除了整个「索引与文件不一致」的 bug 类别。对多 Agent 并发写文件的场景，这个选择的价值会更大——没有共享索引，就没有共享索引的锁和竞态。

### 1.3 拒绝为不需要的工作建状态机

这是**产品级**的判断，比任何技术选择都重要：

> 不需要正式流程控制的普通任务使用 standalone 模式，持续工作也可留在此模式。恢复普通工作不需要 graph。

大多数工作流框架的默认假设是「所有工作都进状态机」。ResearchSpec 明确拒绝，并让「普通任务笔记」成为一个正式的一等概念（虽然它**不是** runtime owner）。

**判断依据**：如果一件事不需要审计、不需要 Gate、不需要并行协调，就不该为它付状态机的代价。

### 1.4 失败分类：瞬时 / 终局 / 阻塞

```text
Transient  补环境后重试同一节点
Terminal   工作流逻辑不再可行
Blocked    等待用户决定，blockers 数组显式列出
```

**崩溃恢复的关键**。把所有失败归为一个 `failed` 状态，就无法区分「再试一次」和「这条路走不通」和「等用户点头」。多 Agent 场景下这三者每天都会遇到。

---

## 二、上下文工程

### 2.1 一个导航 + 按需发现

```text
宿主常驻：1 个 researchspec-navigate
按需发现：4 ARSU + 3 非 Navigate Companion + 47 core + 339 plugin = 393 个
```

**渐进披露三档**：

| 档 | 内容 | 体积 |
| --- | --- | --- |
| `list procedures --query` | 紧凑卡片（描述截 240 字符） | 小 |
| `show procedure:<id>` | 同一张卡片（pretty JSON） | 小 |
| `instructions procedure:<id>` | 完整正文全文 | 大 |

**分类轴选对了。** capability 的 `class` 七个取值是 `discovery / design / analysis / generation / verification / judgment / transformation`——**按「能力在研究流程中的职能」分类，而不是按「工具还是工作流」这种技术形态分类**。后者会把形态和用途混在一处，越加越乱。

另有 `node_kind`（`producer` / `checker` / `observer`）和 `execution_type`（`llm` / `script` / `mixed`）两个正交维度，一份 manifest 就能同时回答「它是干什么的」「它在图里是什么角色」「它怎么跑」。

Scholoom 如果要提供多种能力，这是最直接可抄的结构。

### 2.2 游标绑定内容指纹

```ts
cursor = base64url({ offset, lastId, digest, listKey })
digest = sha256(JSON.stringify(items))
```

workspace 变了 → digest 变 → 返回 `cursor_stale`，**拒绝静默跳项**。

对比一下「只带 offset」的实现：内容变化后 Agent 会以为自己读完了，其实漏了一页。**指纹绑定是防跳项的正确做法**，任何分页 API 都值得这么做。

### 2.3 委派必须封死写权限

worker 的四条硬约束：

1. 不能调用 mutation command
2. 不能询问用户
3. 不能选择模型
4. 不能继续委派

worker 只返回：Procedure hash、输出路径、检查结果、blocker。**由主 Agent 校验后才串行执行状态变更。**

**「worker 回报本身不改变任何状态」**——这条让并行委派变得可审计。Scholoom 做多 Agent 协作时，这条比任何 prompt 约束都可靠，因为它可以在代码层强制。

---

## 三、文件与路径安全

### 3.1 区域管理：工具与用户共存的答案

这是本项目最实用、迁移成本最低的一条。`src/adapters/installations.ts:27-30` 的 `project-entry` 记录只有两种模式：

| mode | 管理范围 | 适用 | 代价 |
| --- | --- | --- | --- |
| `file` | **整文件** | 宿主专用入口文件 | ResearchSpec 独占，用户不能在里面写别的 |
| `region` | 只管 `researchspec-entry` **标记区域** | 宿主共享入口文件 | 标记外内容完全保留，用户可自由写 |

`superRefine` 强制 `mode === "region"` ⟺ `region_id === "researchspec-entry"`，不存在「region 模式但没有 region ID」这种半吊子状态。

**托管标记区域 = 共存；托管专用文件 = 独占。** Scholoom 往用户项目里写任何东西之前，都应该先决定自己属于哪一类。

> 边界要说清楚：**这套 region 机制只用于项目入口文件**（`AGENTS.md`、`CLAUDE.md` 等）。`codex.toml` / `mcp.json` 这类 ResearchSpec 独占的配置文件是**整文件写入、不合并、不打标记**的。不要把它当成通用的「区域编辑」能力。

### 3.2 drift 不覆盖

> 观测到的内容与 precondition 不一致时保留原内容并报告 drift。

工具发现文件被改过时**保留并报告，绝不静默覆写**。卸载时同理：hash 未变才删，drift 保留。

**覆盖用户内容是这个领域最常见也最不可原谅的错误。** 这条应该写进任何 Agent 工具的安全基线。

### 3.3 路径 kind 与前缀强制一致

```ts
if (entry.kind === "source" && !target.startsWith(".codex/")) reject
if (entry.kind === "handoff" && isManagedResearchspecPath(target)) reject
```

声明的语义类型必须和实际路径形态吻合，不吻合就 fail closed——**而不是相信声明**。

同理，「运行时规则不能靠文件名」（`AGENTS.md:861`）是所有这些 schema 化的根本理由。

### 3.4 跨平台路径规则前置

12 条拒绝原因里有 Windows 保留名（`CON` `PRN` `AUX` `NUL` `COM1-9` `LPT1-9`）和尾随点/空格。这些在 Linux 上开发时完全不会暴露，但写到 Windows 上会炸。

**在词法层挡，不要等在目标文件系统上炸。**

### 3.5 承认事务的边界

`write-plan.ts:95-104` 的注释直说：

> best-effort restoration, not a transactional filesystem. 提交后进程被杀，备份不会被恢复。

**提交前崩溃安全，提交后崩溃不安全。** 把非保证写清楚比假装原子性更有用——使用者会据此做判断。

---

## 四、文档与契约

### 4.1 Zod schema 一份定义两用

```ts
export const GraphWorkspaceSchema = z.object({ ... });
export type GraphWorkspace = z.infer<typeof GraphWorkspaceSchema>;
```

同一份定义既是**运行时校验器**又是**类型来源**。不存在「类型定义」和「运行时校验」两份代码必然不同步的问题。

进一步：YAML/JSON 解析错误也被转成带行列号的诊断对象而非抛异常（`validation/parse.ts`），因为 CLI 输出机器可读诊断时裸的 `ZodError` 栈没有位置信息。

### 4.2 命令目录当数据结构

```ts
CLI_TOP_LEVEL_COMMANDS  // typed SSOT
  ├→ Commander 注册
  ├→ --help 文本
  ├→ 读写影响标注
  ├→ 工作区要求
  ├→ docs/user/cli-handbook.md
  ├→ website/docs/cli/**  (21 页)
  ├─→ website/sidebars.cli.ts
  └→ pack 生成的 references/cli-handbook.md
```

**9 个下游产物，一份声明。** 文档漂移在结构上不可能发生。

配合硬门禁：

```ts
if (CLI_TOP_LEVEL_COMMANDS.length !== 16 || includes("submit")) throw
```

**把不变式写死在生成器里**，改命令数量会立刻让 CI 失败。

### 4.3 「不要靠反思更新文档」

`AGENTS.md:859`：

> CLI adapters, the code, and the documents are the sources of truth — **don't document by reflection**.

即：不要「看代码然后写文档」，那还是在制造第二事实源。要么改 typed catalog 让文档生成，要么改 contract schema。

**这条应该成为 Scholoom 的文档纪律。**

### 4.4 三层冲突裁决顺序

1. 用户使用模型 → 产品行为
2. OpenSpec main specs → 可验收要求
3. 代码与 typed contracts → 当前实现事实

**先定顺序再写文档。** 争议时按序判，不靠讨论。

---

## 五、审计与生成

### 5.1 决策是数据不是判断

这是本项目**最值得抄的工程实践**。以 Materials vendor 排除一个 Skill 为例：

```json
{
  "upstream_skill_id": "ase",
  "disposition": "excluded",
  "reason_codes": ["development-maintenance-scope"],
  "content_review": {
    "outcome": "failed",
    "evidence": ["ase/SKILL.md", "ase/references/testing.md"],
    "note": "The Skill owns upstream development, testing, changelog, documentation, and Git maintenance."
  }
}
```

**每条排除都带 reason code + 复核结论 + 证据路径。** 运行时只做比对，无从「重新判断」。

| 若决策在运行时 | 若决策签入数据 |
| --- | --- |
| 每次重新读源文件重新判断 | 转换器只比对 |
| 同一上游不同时间可能结论不同 | 结论永久固定 |
| 无法复核「为什么排除它」 | 每条可追溯 |
| 上游升级影响面无法预估 | 差集一眼可见 |

如果 Scholoom 也会接入外部能力/数据/模型，这个模式直接适用。

### 5.2 convert / check / idempotence 三连

| 命令 | 作用 |
| --- | --- |
| `convert` | 生成产物 |
| `check` | 校验产物 + 完整性 |
| `idempotence` | **同样输入重跑，字节不变** |

**幂等性进 CI。** 这是「生成器」和「脚本」的根本区别。

### 5.3 暂存区避免半成品

```text
prepareVendorStage  →  converter 在 stage 里写  →  commitVendorStage
```

转换器中途失败，真实输出要么是上一个成功版本，要么是新的完整版本。**不会半新半旧。**

### 5.4 `PYTHONDONTWRITEBYTECODE=1`

测试跑 vendor 的 Python 脚本时会写 `__pycache__` 污染工作树，于是在 `run-tests.mjs` 里设了这个环境变量。

**每个这类环境变量都是踩坑记录。** Scholoom 的测试脚本里应该也会遇到同类的坑。

### 5.5 沙箱 dogfood 作为人工发布 Gate

bubblewrap 里跑 36 个目标 × 3 种投递模式 = 108 种组合的**真实**安装验证。

**不进 CI**（需要 bubblewrap + 真实宿主环境），但进 release checklist。

单元测试能验证「文件写对了」，验证不了「宿主读到了」。**后者只能真跑。**

---

## 六、CLI 面向 Agent 的设计

### 6.1 统一信封 + `error.hint`

```json
{
  "schema_version": 1, "command": "status", "ok": false,
  "data": null,
  "diagnostics": [{ "severity": "error", "code": "...", "path": "...", "message": "..." }],
  "error": { "code": "INVALID_SELECTION", "message": "...", "hint": "下一步怎么做", "validation": [] }
}
```

**`hint` 是给 Agent 的一等公民**。失败时直接告诉它下一步动作，比让它从错误文案里推理可靠得多。

`diagnostics` 一次性回传所有文件级问题，避免 Agent 反复试错。

### 6.2 显式标注读写影响

每条命令标注 read / write。**Agent 规划调用序列时需要知道副作用边界**，这应该是一等元数据，而不是从函数名猜。

### 6.3 零依赖的 doctor

诊断工具本身**零前置条件**。否则工作区损坏时反而用不了。

### 6.4 选择器窄合取 + fail closed

选择器**既不是路径，也不是通配符或正则**。多余路径段、不可信字符、不明确匹配一律拒绝，**不尝试补全**。

四种匹配模式（`exact` / `any` / `list`）让「我以为会唯一匹配」这种误解在早期暴露。

**Agent 会犯错，工具要替它挡住。**

---

## 七、值得警惕的地方

ResearchSpec 也有做得不好的地方，抄的时候别一起抄。

### 7.1 不要抄的东西

| 东西 | 为什么别抄 |
| --- | --- |
| **巨大的 vendor 转换层** | 340 + 178 = 518 文件占全仓 79%。这是「有很多上游要吸收」的历史包袱，不是架构优势。Scholoom 没有这个包袱就不该背。 |
| **6 个 vendor 各自定义审计格式** | 至少 10 种字段名和 10 组枚举值，汇总时无法机读。**反面教材**：多来源集成必须一开始就定统一 schema。 |
| **重复的 discovery 实现** | `discover.ts` 和 `graph-discover.ts` 逐行相同。自动分层过程留下的痕迹。 |
| **CHANGELOG 里的数字** | 是历史快照（15 命令 / 31 工具），当前是 16 / 36。**发布记录不是现状文档。** |
| **`converter.ts:118` 恒假表达式** | 一个 CI 每次都跑、但永远为 false 的死代码检查。 |

### 7.2 一个真实的过度设计信号

4 ARSU + 3 Companion + 47 核心能力 + 339 插件扩展 = 393 个隐藏能力，靠一个 Navigate 入口发现。

**渐进披露解决了 token 成本，但没解决「选择质量」**——Agent 在 393 个能力里选对的难度仍然存在，只是被推迟到了 `list procedures --query` 那一刻。`usage-model.md:246` 自己也承认：

> 能力太多时可能选错。**问题通常出在触发语义不清，而不是缺少能力。**

**这句话比它的解决方案更有价值。** Scholoom 设计能力体系时，应该先保证触发语义清晰，而不是先堆数量。

### 7.3 领域分类的维护成本

218 个 domain（213 学科 + 5 工具）、59 个非空、338 个 Skill，每个都有审计决策和 evidence map。

**这套体系的维护成本极高**——6 个 vendor 的 policy 文件、上游快照升级、`domains.expected_admitted_counts` 同步。而 ResearchSpec 自己就有 4 处数字漂移。

**如果 Scholoom 不需要覆盖这么广的领域，不要建这个体系。** 从 3-5 个真实场景开始，让领域从实际需求长出来（ResearchSpec 自己也是 8 → 16 → 44 → 47 渐进扩展的）。

---

## 八、给 Scholoom 的行动清单

按建议采纳顺序：

| 优先级 | 事项 | 依据 |
| --- | --- | --- |
| **P0** | 状态写入收敛到单一 CLI 入口 | 1.1 |
| **P0** | 一个概念一个 owner，其余派生 | 1.2 |
| **P0** | 失败分瞬时/终局/阻塞三类 | 1.4 |
| **P1** | 区域管理 + drift 不覆盖 | 3.1 / 3.2 |
| **P1** | Zod 一份 schema 两用 | 4.1 |
| **P1** | 能力元数据当数据结构驱动文档 | 4.2 |
| **P1** | 统一信封 + `error.hint` | 6.1 |
| **P2** | 默认路径能绕开状态机 | 1.3 |
| **P2** | 委派封死写权限 | 2.3 |
| **P2** | 游标绑定内容指纹 | 2.2 |
| **P2** | convert/check/idempotence 三连 | 5.2 |
| **P2** | 路径 kind 前缀一致性 + fail closed | 3.3 |
| **P3** | 决策数据化（含 reason code 与证据路径） | 5.1 |
| **P3** | 暂存区提交 | 5.3 |
| **P3** | 沙箱 dogfood 作为发布 Gate | 5.5 |

**不要做的**：建 218 个领域的分类体系；为 6 个上游各写一套审计格式；在还没想清楚触发语义之前先堆能力。
