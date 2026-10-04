# ResearchSpec 项目参考文档

面向 Scholoom 开发调研的 ResearchSpec 参考资料。**这些文档描述的是调研时点的 ResearchSpec 现状，不是它的官方文档。** 事实以 ResearchSpec 的代码和 typed contracts 为准（见 [14 篇的裁决顺序](14-开发约定与已知坑.md#冲突裁决顺序)）。

## 调研快照

| 项 | 值 |
| --- | --- |
| 调研日期 | 2026-10-02 |
| ResearchSpec 路径 | `~/Workspace/Code/JavaScript/ResearchSpec` |
| 分支 / HEAD | `dev-refactor` / `43f52e34` |
| 版本 | `0.1.0`（MVP release candidate，未授权发布） |
| 主来源 | `docs/`（user 7 / developer 13 / maintainer 12，共 33 篇）、`AGENTS.md`（918 行）、`.ua/wiki/`（659 页知识图谱）、源码 |
| 一手核对 | 210 个 TS 文件、9 条数据类断言用脚本实测 |

> ⚠️ **本组文档已确认 10 处文档漂移和 1 处代码缺陷**，集中在 [14 篇](14-开发约定与已知坑.md#文档漂移清单)。引用任何数字前先读那一份。

## 文档索引

### 入门（先读这三篇）

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [01-项目概览](01-项目概览.md) | 定位、动机、设计立场、规模快照、许可模型、仓库布局、发布状态 | 11 KB |
| [03-功能地图](03-功能地图.md) | 三个角色、两种工作模式、11 步工作流、9 个功能域、确认边界总表 | 14 KB |
| [04-架构分层](04-架构分层.md) | 10 个分层、依赖主干、双向依赖、核心层 7 个文件、14 步阅读路径 | 10 KB |

### 按层深入

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [05-CLI控制面](05-CLI控制面.md) | 16 个命令、统一信封、选择器协议、读写分档、catalog 驱动 | 10 KB |
| [06-工作区与文件合约](06-工作区与文件合约.md) | owner 表、目录布局、三条硬边界、路径安全 24 条、写入计划与区域管理 | 11 KB |
| [07-图谱运行时](07-图谱运行时.md) | frontier 15 步、输入绑定、revision 轮次、Gate/Decision、四份 spec 状态、运行时协议集 | 11 KB |
| [08-能力包与Procedure](08-能力包与Procedure.md) | 47 core + 339 plugin、manifest 契约、五类来源合并、渐进披露三段式、能力作者规则 | 11 KB |
| [09-宿主适配与投递](09-宿主适配与投递.md) | 36 个目标、3 种投递模式、3 种入口机制、MCP 配置、Zotero adapter、交付时序 | 11 KB |
| [10-领域插件与适配器](10-领域插件与适配器.md) | vendor/domain 两层、ANZSRC 213+5、七项准入清单、非原生标准、plugin CLI | 11 KB |
| [11-转换器与审计](11-转换器与审计.md) | ARSU 七阶段管线、58 个 contract anchors、6 个 vendor、暂存区、evidence map | 11 KB |
| [12-评审批注工作台](12-评审批注工作台.md) | revision-master vs 交互工作台、准备/渲染分离、三种导出模式、批注契约 | 8 KB |

### 工程与约定

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [02-技术平台](02-技术平台.md) | Node 22/24 + pnpm、9 个运行时依赖、四份 tsconfig、npm 包边界、94 条 script、CI 矩阵 | 10 KB |
| [13-构建测试与工程化](13-构建测试与工程化.md) | 96 个测试、`.test-dist`、strictTypeChecked、CI 6 组合、dogfood 沙箱、文档三分类 | 12 KB |
| [14-开发约定与已知坑](14-开发约定与已知坑.md) | 六条合约原则、九条工程规则、十一条文件规则、DoD、**10 处漂移 + 1 处缺陷** | 12 KB |

### 落地建议

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [15-对Scholoom的启示](15-对Scholoom的启示.md) | 8 节可迁移模式 + 值得警惕的地方 + 按优先级的行动清单 | 15 KB |

## 最值得先知道的十件事

如果只读十句话：

1. **ResearchSpec 是 agent-neutral 的 spec-driven 研究工作流框架层**，不是 LLM 集成层、不是 Web 应用、不是文献管理器。
2. **CLI 是工作流状态的唯一写入入口。** Agent 永远不直接改状态文件，只能请求 CLI 变更。
3. **大多数工作不需要 graph。** standalone 模式 + 任务笔记是默认路径，状态机只给需要审计的工作用。
4. **一个概念一个 owner 文件，其余全是扫描推导。** 没有全局索引，没有隐藏事务日志。
5. **宿主只常驻一个 Navigate 能力**，另外 393 个按需发现（渐进披露三段式）。
6. **区域管理让工具与用户共存**：项目入口文件可整文件托管（独占）或只管标记区域（共存），二选一且强制配对。
7. **drift 永不覆盖**：内容与预期不符时保留原文件并报告。
8. **Admission 决策是签入仓库的数据**，带 reason code + 复核结论 + 证据路径，运行时只做比对。
9. **README 有 4 处数字漂移**（Companion 数、Scientific 版本、Education 快照、非空 domain 数），以代码为准。
10. **ARSU 是非商业许可（CC BY-NC 4.0）**，Zotero 适配器是 AGPL-3.0。商用前必须独立许可审查。

## 关键数字速查

| 类别 | 数字 | 核实来源 |
| --- | --- | --- |
| 源码 | 210 个 TS / 32,688 行 | `find src -name '*.ts'` |
| 运行时依赖 | 9 个（无 LLM SDK / DB / HTTP / Agent 框架） | `package.json` |
| 顶层命令 | 16（不含 `submit`） | `CLI_TOP_LEVEL_COMMANDS` |
| 核心能力 | 47 | `skills/capabilities/` |
| 插件扩展 | 339 | `skills/plugins/extensions/skills/` |
| Vendor | 6 | `PRODUCTION_VENDOR_IDS` |
| Domain | 218（213 学科 + 5 工具），59 个非空 | `domain-catalog.json` + 实测 |
| 已审 Skill | 338 | 各 vendor 决策文件 |
| Agent 宿主 | 36（24 个 class-A） | `src/adapters/tools.ts` |
| Contract anchors | 58（37 required / 19 recommended / 2 diagnostic） | `contract-anchors.json` |
| Graph profile | 7 个 authored（TypeScript 源）+ 339 个 plugin | `src/arsu-converter/workflow/graph-profiles/` |
| 测试 | 96 文件（79 个 `*.test.ts`） | `tests/` |
| CI 矩阵 | 3 OS × 2 Node = 6 组合（1 个 job） | `ci.yml` |
| OpenSpec spec | 59 | `openspec/specs/` |
| 知识图谱 | 659 文件 / 1917 节点 / 3863 边 | `.ua/wiki/` |

## 调研方法与可信度

**一手核对**（脚本实测，非文档引用）：

- 47 个核心能力包、218 个 domain、59 个非空 domain、338 个 vendor skill
- 6 个 vendor 的准入/排除数、release/revision、决策枚举分布
- Scientific Agent Skills v2.70.0 / 56 admitted / 111 excluded
- Education snapshot-6bbbce4
- 94 条 package.json script、8 个 submodule
- 96 个测试文件（79 个 `*.test.ts`）、约 15,500 行

**未核实**（文档中已标注）：

- HistAgent 的排除数（无独立数据源，转换报告只给「3 generated / 21 capability decisions」）
- `.ua/wiki` 分析 commit `2d22c0da` 早于调研 HEAD `43f52e34`，wiki 反映稍早状态

**未深入**（按需求控制深度）：

- `src/arsu-converter/` 178 个文件中的 quarto/revision/runtime-policy 子目录细节
- `authoring/` 提取管线的 m1–m5 具体内容
- `src/core-skills/` 的 2 个包（paper-humanizer、revision-master）
- vendor 上游仓库本身（8 个 submodule 只看结构与 manifest）

## 相关参考

同目录下还有：

- `../Zotero/` — Zotero 桌面应用（12 篇）
- `../zotero-agents/` — Zotero-Agents 插件（12 篇）
