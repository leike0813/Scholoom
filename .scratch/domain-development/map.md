# Scholoom：功能域细化与并行开发决策地图

Labels: wayfinder:map

## Destination

明确骨架建立后的全局功能域、责任边界、共同契约与依赖，选出首批并行细化的领域，并说明各域进入详细设计及并行实施所需的条件。完成标志是分工和整合责任经用户确认，各域能据此开展后续设计；本地图不展开各域的完整实施规格或执行开发。

## Notes

### 已确认的讨论前提

2026-10-20，用户选择“确定全局分域，并选首批并行细化领域”，随后回复“采纳你的建议”，确认以下建图前提：

- 以文献与知识管理、研究项目与研究资产、Agent 运行与协作、科研方法与工作流、科研计算与执行环境、阅读写作与成果交互、Zotero 生态接入七个功能域组织后续设计。
- 协议、平台、broker、宿主装配、工作台骨架与分发由共同工程主线统筹。各域承担自己需要的功能界面，接入同一工作台。
- 首批以“文献到研究综合”校准设计，并行深入文献知识、研究项目资产、科研方法三个域。路径、交付与接续约定见[首条文献综合路径决定](issues/01-literature-synthesis-path.md#answer)，具体领域设计与实际验证继续由后续工作承接。
- Agent 协作、科研计算和生态接入保留明确依赖；可能影响文献身份或数据权威的兼容风险提前调查。

文献域的首步细化已由用户明确为“复刻 Zotero 的功能和界面”，先形成完整的类 Zotero 文献管理工具，再衔接知识分析与研究综合。[文献与知识管理职责票](issues/02-literature-knowledge-scope.md)已确认范围、共同接口与实施安排；首条综合路径仍是后续跨域整合目标。

已确认的文献安排见[文献基础工具实施计划](library-foundation-plan.md)，共同资源 A 批已交付；后续按本轮公共基础前置衔接文献 B 批。该计划组织交付顺序与设计入口，任务进度和运行结果仍由各变更的 tasks／delivery 维护。

研究主题与研究任务的归属、文件承载及引用策略，以[研究项目与研究资产决定](issues/03-project-research-assets-scope.md#answer)为后续分域讨论输入。

用户已明确[科研业务流程由 Graph 承载](issues/04-research-methods-scope.md#graph-承载科研业务流程)，旧 Skill／capability 包按流程、节点指导与资源拆解迁入；相关旧决议的流程承载约定采用该决定，原方法包管理问题已撤下。

独立于用户研究项目的全局会话工作域及其临时区、库内持久化和跨项目只读边界，已在[科研业务 Graph 与工作流职责票](issues/04-research-methods-scope.md#全局会话与工作域)中确认；[能力调用关联与设计深度](issues/04-research-methods-scope.md#能力调用与方法域设计范围)、[综合内容与按需独立复核](issues/04-research-methods-scope.md#综合内容与复核要求)也已确认。[科研业务目录](issues/04-research-methods-scope.md#六组科研业务职责目录)及[校准与交接要求](issues/04-research-methods-scope.md#首条文献综合校准与交接要求)作为共同接口的设计输入，执行支撑与 Agent 协作域共同核对。

用户已将具体业务 Graph 的节点、顺序及回路后置；首批 Graph 由 Scholoom 源码定义并注册，用户／项目只使用已开放配置，暂不提供自定义 Graph。Graph 与节点资源作为整体实现追溯版本。该票已收束，先形成共同科研 Graph 运行基础设计包，以接入真实模块的固定夹具 Graph 独立验证注册配置、授权与生命周期、材料成果交接和记录诊断；具体边界见[科研业务 Graph 与工作流决定](issues/04-research-methods-scope.md#answer)，不据夹具宣称科研质量通过。

这些前提确定讨论方向。各域具体职责、首批深度与实施启动条件由后续票确认。功能域用于组织设计与交付，不自动对应新包、进程或发布单元；与原[七个逻辑模块](../scholoom-foundations/issues/24-logical-modules-and-responsibilities.md)及[模块依赖决议](../runtime-architecture/issues/01-module-dependencies-and-authority.md)共同核对。

2026-10-22，[七域并行设计及交付安排](issues/10-parallel-design-and-delivery.md#answer)已确认：统一规划七域近期工作，先交付四组公共基础，再由七条开发线按依赖推进首个独立结果。具体公共基础缺口、域内设计、文件边界及实施任务转后续 OpenSpec 规划。

本轮公共基础的实际实施入口与依赖见[公共基础实施规划](public-foundation-plan.md)：共同契约先落入 dev，三个工作树并行实现，真实整合按依赖验收；七域仍等待全部公共基础验收。决定见[并行安排票](issues/10-parallel-design-and-delivery.md#后续规划入口与交付责任)，各变更任务及实际结果以所属 OpenSpec 为准。

### 讨论方式与事实来源

- 本阶段开发模式以[共同工程职责决定](issues/09-shared-engineering-responsibility.md#answer)及[并行设计与交付安排](issues/10-parallel-design-and-delivery.md#answer)为准：公共基础先行，随后多工作树并行；公共补充经 dev 接入再同步，验证按工作树、dev 接入与具体整合任务负责，并行阶段没有统一协调 Agent。
- 使用 [wayfinder](../../.agents/skills/wayfinder/SKILL.md)、[grilling](../../.agents/skills/grilling/SKILL.md)、[domain-modeling](../../.agents/skills/domain-modeling/SKILL.md) 和 [codebase-design](../../.agents/skills/codebase-design/SKILL.md)。依[本地 Markdown tracker](../../.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md)查询 frontier，先领取再深入；每会话最多解决一张非 research 票。
- 地图只作索引，具体决定保存于所属票的 Answer。已确认的宏观产品行为沿[原基础地图](../scholoom-foundations/map.md)、[PRD](../../docs/prd/README.md)和[架构决策地图](../runtime-architecture/map.md)，不重新制造一套产品模型。
- 术语见 [CONTEXT.md](../../CONTEXT.md)；未实施要求参考[初设规格书](../../docs/initial-spec/README.md)。代码和[当前正式规格](../../openspec/specs)用于判断现状，草稿中的候选设计不作为实现事实。
- 现有分阶段路线见[实施路线图](../../docs/implementation-roadmap.md)。本地图确定后续分域与并行安排，具体任务与实际交付继续由 OpenSpec 的 tasks／delivery 管理。
- 跨域调用、权威、授权及依赖方向遵循已有架构决议。领域详细设计只细化已需要的接口；共享 schema、宿主装配、工作台骨架的修改及真实跨模块验收，在本阶段多工作树模式下明确承接责任，具体约定见共同工程职责票及并行安排票。
- 各域应能独立测试、诊断和交付。首批以共同路径确定最小协作约定，再并行细化；不要求等待完整科研流程，也不以各域独立通过代替真实接线。

### 现状依据

建图前已只读核对实际包、正式规格与归档交付记录，未运行本轮测试或科研 Agent。后续票按需读取所属证据，不从文档旧链接推导变更仍在进行：

| 现有基础 | 实际交付入口 |
| --- | --- |
| 模块提取、broker、独占执行及接续 | [运行架构迁移交付](../../openspec/changes/archive/2026-10-19-migrate-runtime-architecture/delivery.md) |
| 本地题录、附件与共同阅读 | [题录交付](../../openspec/changes/archive/2026-10-16-establish-local-literature-catalog/delivery.md)、[附件交付](../../openspec/changes/archive/2026-10-16-ingest-local-literature-attachments/delivery.md)、[PDF 阅读交付](../../openspec/changes/archive/2026-10-16-establish-shared-pdf-reading/delivery.md)、[EPUB／HTML 阅读交付](../../openspec/changes/archive/2026-10-19-extend-shared-epub-html-reading/delivery.md) |
| 方法发现、材料分析调用与交付检查 | [科研能力运行时交付](../../openspec/changes/archive/2026-10-16-establish-research-capability-runtime/delivery.md) |
| 稿件源码／可视编辑、排版与导出 | [科研写作编辑器交付](../../openspec/changes/archive/2026-10-20-add-research-writing-editor/delivery.md) |

已有证据各有运行与平台边界；它们不证明完整科研质量、通用多 Agent、生态接入或远程部署已经可用。开发说明中部分活动变更链接尚未随归档更新，续做时核对归档路径；本地图不展开无关文档清理。

## Decisions so far

- [确定首条文献综合路径与最小跨域契约](issues/01-literature-synthesis-path.md#answer)：从已有库材料开展项目定向综合，保存报告、实际来源与持续研究记录，纳入补充材料后的新会话续做，明确三域最小交接。
- [明确文献与知识管理的职责及首批设计范围](issues/02-literature-knowledge-scope.md#answer)：先建设完整个人桌面文献工具，采用 A—I 批实施计划；项目与库共用编辑阅读接口，库导航保留 harness 项目工作域。
- [明确研究项目与研究资产的职责及首批设计范围](issues/03-project-research-assets-scope.md#answer)：研究主题归库，动态研究任务归项目并以文件承载；库知识仅存指针，按已确认矩阵读取、暂停询问或核查，明确身份、恢复及跨任务引用边界。
- [明确科研业务 Graph 与工作流的职责及首批设计范围](issues/04-research-methods-scope.md#answer)：业务流程由 Graph 承载，确定全局会话、按需业务关联、内建配置与整体版本追溯；先设计共同运行基础及固定夹具独立验证，具体业务流程和用户／项目自定义 Graph 后置。
- [明确 Agent 运行协作的支撑范围与启动条件](issues/05-agent-collaboration-scope.md#answer)：明确通用执行与科研业务分工，先设计共同执行支撑和子 Agent 委派；界面上下文由工具取得、歧义询问用户，确定协作责任与独立验收边界。
- [明确科研计算与执行环境的职责及启动条件](issues/06-managed-computation-scope.md#answer)：人和 Agent 共用程序运行能力，先设计项目内程序执行与环境供给，明确运行依据、基本操作及独立验收，与排版业务和科研判断分工。
- [明确阅读写作与成果交互的职责及接入条件](issues/07-research-interaction-scope.md#answer)：以 Codex 式预览、选择批注及共同指令为目标，确定刷新与草稿保护；分别设计材料批注修改和交互报告，以真实接线独立验收。
- [明确 Zotero 生态职责与需要提前调查的兼容风险](issues/08-zotero-ecosystem-constraints.md#answer)：确定正式引用键权威、插件与资源维护分工及四个设计入口；提前核对身份和插件写入，阅读写回在对应契约定案前调查，迁入撤回无法证明安全时保留对象。
- [明确共同工程主线与跨域契约的维护责任](issues/09-shared-engineering-responsibility.md#answer)：先完成公共基础再多工作树并行；公共补充在自身工作树实现，经 dev 接入验证后同步，明确独立提交及工作树、接入与整合的验收责任，无统一协调 Agent。
- [确认七域依赖与首批并行设计及交付安排](issues/10-parallel-design-and-delivery.md#answer)：规划七域近期工作，四组公共基础先交付，随后七域各一条开发线；确定首个独立结果、真实接入前置及后续 OpenSpec 入口。

## Not yet specified

- 本轮没有尚需澄清的全局职责与并行启动问题。公共基础缺口调查、生态契约前置调查及各域详细设计已有明确后续入口，见并行安排票；若后续证据改变已确认分工，再带回对应决定讨论。

## Out of scope

- 在本地图中完成七域的全部 DTO、数据库结构、SDK 接线、科研方法内容与实施任务，或启动业务开发、模型调用及真实数据迁入。
- 本轮设计具体业务 Graph 的节点、顺序与回路，或用户／项目自定义 Graph 功能；用户已在[科研业务 Graph 与工作流决定](issues/04-research-methods-scope.md#answer)中明确后置。
- 缩减从文献管理到稿件修订交付的完整产品范围。首批选择表示推进顺序，不删除其余已确认目标。
- 重开已定的统一 harness、领域权威、模块调用与故障隔离方向；如调查发现实质冲突，先指出证据并另行讨论。
- 具体工期、固定并发 Agent 数、人员排班及公开发布。远程、对外 MCP 和三平台要求在依赖关系中保留，具体接线与验收另由 OpenSpec 承接。
