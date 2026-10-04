# 05 CLI 控制面

## 一个 JSON 信封走天下

**所有** CLI 命令都返回同一个信封（`docs/developer/cli-interface.md:33-42`）：

```json
{
  "schema_version": 1,
  "command": "status",
  "ok": true,
  "data": { "...": "命令负载" },
  "diagnostics": [],
  "error": null
}
```

失败时：

```json
{
  "ok": false,
  "data": null,
  "diagnostics": [ { "code": "…", "path": "…", "message": "…" } ],
  "error": {
    "code": "INVALID_SELECTION",
    "message": "…",
    "hint": "下一步怎么做",
    "validation": []
  }
}
```

**这是给 Agent 消费设计的**，不是给人看的表格。`error.hint` 专门用来告诉 Agent 下一步动作。`diagnostics` 用于把文件级问题一次性回传，避免 Agent 反复试错。

`list` / `show` 是**唯一**返回原始载荷而不套信封的命令（`cli-interface.md:46`）。

## 十六个顶层命令

权威来源是 `CLI_TOP_LEVEL_COMMANDS`，恰好 16 个且**不含 `submit`**（`scripts/generate-docs.mjs:23-25` 会硬校验这条）。

| # | 命令 | 参数骨架 | 写 `researchspec/` | 需要工具 |
| --- | --- | --- | --- | --- |
| 1 | `init` | `<path> [--tools a,b] [--delivery skills\|commands\|both] [--literature-adapters zotero-library] [--non-interactive] [--yes] [--force] [--profile id] [--package-root path]` | ✅ | 否 |
| 2 | `list` | `procedures\|runs\|sources\|claims` `[--profile id] [--query s] [--limit n] [--cursor c] [--json] [--show-payload] [--match-mode...]` | ❌ | 否 |
| 3 | `show` | `procedure\|source\|claim\|tool` `<id>` `[--json] [--show-payload] [--match-mode...]` | ❌ | 否 |
| 4 | `status` | `[run-selector] [--task-id] [--json] [--show-payload] [--match-mode...]` | ❌ | 否 |
| 5 | `instructions` | `<selector> [--profile id] [--json] [--show-payload] [--match-mode...]` | ❌ | 否 |
| 6 | `start` | `<profile-selector> [--json] [--show-payload] [--match-mode...]` | ✅ | 否 |
| 7 | `advance` | `<node-selector> [--json] [--show-payload] [--match-mode...]` | ✅ | 否 |
| 8 | `decide` | `<gate\|decision\|change-selector>` `[--verdict ...] [--choice ...] [--override ...] [--reason ...] [--with-decision ...] [--json] [--show-payload]` | ✅ | 否 |
| 9 | `propose` | `profile\|view\|process\|feasibility` `<slug>` `[--json] ...` | ✅ | 否 |
| 10 | `archive` | `change-selector` `[--json] ...` | ✅ | 否 |
| 11 | `check` | `all\|specs\|runs\|manuscript\|scaffold` `[--run-selector] [--strict] [--json] [--show-payload]` | ❌ | 否 |
| 12 | `pack` | `run-selector\|--task-id` `--format md\|json` `--out <path>` `[--max-chars n] [--json] ...` | ❌ | 否 |
| 13 | `handoff` | `add\|list\|update` `[--task-id] [--role] [--type] [--path] [--purpose] [--consumer] [--format] [--json]` | 仅 tasks 外的边界 handoff | 否 |
| 14 | `update` | `[--delivery ...] [--literature-adapters ...] [--non-interactive] [--yes] [--json] ...` | ✅ | 否 |
| 15 | `plugin` | `list\|show\|install\|update\|uninstall` `[--domain ...] [--json] ...` | ✅ | 否 |
| 16 | `doctor` | `[--json] [--show-payload] [--match-mode...]` | ❌ | 否 |

**三个只读诊断命令**：`status` / `check` / `doctor` 遵循同一纪律（`usage-model.md:284-291`）——不启动外部工具、不修复语义、不修改文件。

> 若只读命令需要执行外部工具、需要修复语义或需要写文件，这个设计就错了。

## 工作区要求（每条命令声明它需要什么）

`docs/developer/cli-interface.md:11-30` 给出依赖闭包：

| 命令 | 前置条件 |
| --- | --- |
| `init` | 无 |
| `list` / `show` | 无 |
| `status` | `run status` 或 `--task-id` |
| `instructions` | `run` / `node` / `procedure` |
| `start` | `graph runtime` + `graph profiles` + `workspace 布局` + `能力目录` + 宿主工具目标 |
| `advance` | `graph runtime` + `workspace 布局` + `run 状态` + `node instance` + 能力目录 |
| `decide` | `graph runtime` + `workspace 布局` + 目标 record |
| `propose` | `run` 或 `project change` + `graph profiles` + `stable specs` |
| `archive` | `project change` |
| `check` | `project` 或 `run` + `stable specs` |
| `pack` | `run` 或 `--task-id` |
| `handoff` | `run` |
| `update` | `workspace 布局` + 宿主工具目标 |
| `plugin` | `workspace 布局` + 插件注册表 |
| `doctor` | 无 |

**关键点：即使 `doctor` 也是零依赖**。它诊断的就是「工作区能不能用」。

## 选择器协议

五种选择器（`src/core/contracts/control-selector.ts`）：

| 形式 | 指向 | 约束 |
| --- | --- | --- |
| `run:<id>` | 一个 run | 找不到 → 报错 |
| `node:<run>/<node>` | node instance | 必须跑赢 discovery、不得含路径分隔符 |
| `gate:<run>/<node>/<gate-id>` | Gate instance | gate id 小写 kebab |
| `decision:<run>/<node>/<decision-id>` | Decision instance | 同上 |
| `change:<change-id>` | project change | 与 run selector **显式不重叠** |

**Round 后缀**：`@[1-9][0-9]*`（只允许正整数，不允许 `@0` 或前导零）。用于 revision 轮次定位。

`cli-interface.md:60-69` 明确选择器规则是**窄合取**：

> 同一位置的合法字符集不同。selector **既不是文件路径，也不是通配符或正则**；任何多余路径段、不可信字符或不明确的匹配都应拒绝，而不是尝试补全。

**这是「fail closed」的具体体现**——拒绝歧义，不猜测。

## 四种匹配模式

`--match-mode` 三个取值（`list` / `show` / `instructions` 接受）：

| 模式 | 行为 |
| --- | --- |
| `exact`（默认） | 唯一匹配，否则报错 |
| `any` | 多个匹配中任选其一，**必须显式指定** |
| `list` | 返回全部匹配，不选中 |

目的是让「我以为会唯一匹配」这种误解在早期暴露。

## 读写影响分档

`docs/developer/cli-interface.md:5-9` 定义每条命令的影响面，并在 handbook 中标注：

| 档 | 含义 | 命令 |
| --- | --- | --- |
| **read** | 只读。不变文件、不变状态、不调用外部工具 | `list` `show` `status` `instructions` `check` `pack` `doctor` |
| **write** | 改 `researchspec/` 或受管文件 | `init` `update` `start` `advance` `decide` `propose` `archive` `plugin` `handoff`（仅在 task 外记录边界时） |

`--show-payload` 补充**命令负载**的具体输入输出 schema（Zod 派生）。

**这套标注是给 Agent 决策用的**：Agent 读手册就知道哪些命令有副作用，可以在不读源码的情况下规划调用序列。

## Catalog 驱动一切

`src/cli/command-catalog.ts` 是 CLI 的 typed SSOT。同一份声明同时驱动：

1. Commander 命令注册（`main.ts` 遍历目录）
2. `--help` 文本
3. 读/写影响标注
4. 工作区要求
5. `docs/user/cli-handbook.md` 生成
6. `website/docs/cli/**` 生成（21 个命令页 + index）
7. `website/sidebars.cli.ts` 生成
8. `docs/user/agent-entry-matrix.md` 生成
9. `pack` 生成的 Navigate `references/cli-handbook.md`

另有一条约束：`src/adapters/command-renderer.ts:18` 的 `COMMAND_WRAPPER_CONTENTS` 只含 1 个 `navigate` wrapper，16 个顶层命令通过 `LEGACY_COMMAND_IDS` 记录在文档中但不各自生成命令面。

`src/cli/presenter.ts` 的读写影响常量（`:15-22`）：

```ts
const READ_COMMANDS = new Set(["list","show","status","instructions","check","pack","doctor","plugin","handoff"]);
const WRITE_COMMANDS = new Set(["init","update","start","advance","decide","propose","archive"]);
```

**注意 `plugin` 和 `handoff` 在 `presenter.ts` 的 `READ_COMMANDS` 里，但 `cli-interface.md` 与 handbook 表里标为 write**——这是两份清单并存的实际体现，见 [14 篇](14-开发约定与已知坑.md)。

## Agent 入口矩阵：36 个宿主

`docs/user/agent-entry-matrix.md`（生成文档）为全部 36 个 `TOOL_IDS` 各列一行项目入口机制。分类：

| 机制 | 适用宿主 | 特点 |
| --- | --- | --- |
| **专用入口文件**（`AGENTS.md` / `CLAUDE.md` / `GEMINI.md`） | 多数 | 整文件托管，独占该文件 |
| **共享标记区域**（`AGENTS.md` 的 `<!-- researchspec:begin -->` 块） | 支持多工具共存的项目 | 只托管标记内区域，保留用户其他内容 |
| **显式发现回退** | 不读项目文件的宿主 | 用户必须手动触发 |

**为什么区分专用文件 vs 共享区域**——这是本项目最实用的工程决策之一（详见 [09 篇](09-宿主适配与投递.md)）：托管一个用户的 `AGENTS.md` 意味着你不能在里面写别的内容；托管一个标记区域则可以。

## 常用调用序列

```bash
# 初始化（一步完成工作区 + 工具投影 + preset profiles）
researchspec init . --tools codex
researchspec check all --strict

# 日常：找能力 → 看说明 → 拿执行包
researchspec list procedures --query "系统综述" --json
researchspec show procedure:arsu:deep-research --json
researchspec instructions procedure:arsu:deep-research --json

# 正式流程：确认图 → 启动 → 看 frontier → 执行
researchspec status
researchspec instructions run:<run-id> --json
researchspec start profile:arsu:deep-research
researchspec instructions node:<run-id>/<node-id> --json
researchspec advance node:<run-id>/<node-id>

# 决策
researchspec decide gate:<run-id>/<node-id>/<gate-id> --verdict pass
researchspec decide decision:<run-id>/<node-id>/<decision-id> --choice <option>
researchspec decide change:<change-id> --verdict accepted

# 只读诊断
researchspec check all --strict
researchspec doctor
researchspec pack run:<run-id> --format md --out context.md
```

## 给 Scholoom 的启示

1. **统一 JSON 信封 + `error.hint`**。`hint` 字段是给 Agent 的一等公民：失败时直接告诉它下一步该做什么。这比让 Agent 从错误文案里推理要可靠得多。
2. **命令目录当数据结构**。一份 typed 声明驱动 9 个下游产物，文档漂移在结构上就不可能发生。
3. **显式标注读写影响**。Agent 需要在规划调用序列时知道副作用边界，这应该是一等元数据而不是从函数名猜。
4. **选择器窄合取 + fail closed**。「拒绝歧义而不是猜测」是处理 Agent 输入的通用原则——Agent 会犯错，工具要替它挡住。
5. **零依赖的 `doctor`**。诊断工具本身不能有前置条件，否则在工作区损坏时反而用不了。
