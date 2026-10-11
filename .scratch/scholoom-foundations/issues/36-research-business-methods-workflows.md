# 细化内置科研方法、能力与工作流的组成

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: Codex
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 31

## Question

为已确认科研场景，Scholoom 应吸纳哪些内置 Skill、科研能力和 workflow，它们怎样组合，哪些方法交给普通 Agent，哪些任务需要明确编排和独立审阅？

## 已有依据

[核心业务模型](31-core-research-business-model.md)、[能力模型](17-native-research-capability-model.md)、[内容与执行契约](18-native-capability-runtime-and-content.md)、[源码取舍](19-existing-source-and-rust-reuse.md)、四份场景票（26–29）。

方法组成、融合方向、预置工作流及线上检索工具与首批来源均已确认，正式决定记录在 Answer。恢复时先读地图，再读本票引用的相关决定；不需要前一会话上下文。

## 本票需要讨论

- 按已确认场景梳理已有 zotero-agents 与 ResearchSpec 方法，记录保留、融合或需改造的部分；不以重写全部方法作为目标。
- 区分 Skill 的科研方法、能力的输入／交付／检查约定、workflow 的组织，以及通用运行机制；沿既有核心模型避免重复定义。
- 覆盖文献分析与综合、研究问题与方法、结果与论证、写作、审阅、修订和交付；新增科研任务须先获场景确认。
- 承接[文献管理行为](32-literature-management-behavior.md)后置的线上检索来源与工具核对，按研究目的明确检索、筛选及收录的方法；生态捕获与入库适配继续由生态接入票细化。
- 明确各类产物的消费方式和最低交付要求，区分程序检查与科研充分性判断，不自动照搬旧 Gate、hash 或快照机制。
- 识别需要多模型分工或专门文风监督的业务角色与目的，把具体角色协作交给相应票，把运行接口交给现有 harness 协作票。

## 边界

方法组成与交付语义是本票范围；模型选型、SDK 接线、详细图结构与实现任务不在此处预定。

## 开始方式

先比较旧方法目录与已确认场景，给出有来源的候选组成，再与用户讨论实际需要，而非从空白新造流水线。

## 结束条件

用户确认按场景组织的方法／能力／workflow 清单和分工原则，来源可追溯，尚未选定的方法明确留待调查。

## Comments

- 2026-10-08：按用户要求提前建立后续讨论票；保持 open、未领取。本轮仅建票，不回答本票或进入实现。
- 2026-10-09：Codex 按用户“继续下一票”领取；对照已确认场景核对旧方法与交付目录，调查线上文献检索来源和工具，讨论原生组成与融合取舍，不进入实现。
- 2026-10-09：用户回复“同意”，采纳 Q1 六组科研工作的方法组成及 Q2 共同取材、证据比较与交付检查基础上的综合、写作融合方向。线上检索工具与具体工作流、交付要求继续讨论，本票保持 claimed。
- 2026-10-09：用户回复“同意”，采纳 Q3 预置稿件审阅与改进、外部评审修订与回复、稿件交付准备三类工作流及整体交付；步骤可独立调用，多模型角色及监督调度继续由协作票细化。本票保持 claimed，线上检索工具继续讨论。
- 2026-10-09：用户回复“同意”，采纳 Q4 线上检索工具与首批来源组成，首批不单独接入 Unpaywall。本票 Q1–Q4 已确认，设为 resolved；多模型协作及科研执行环境的前置依赖已满足，推荐下一项讨论多模型科研协作与专门审阅监督，未进入实现。

## 当前调查

2026-10-09，只读核对当前 ResearchSpec 与 zotero-agents 方法目录，主 Agent 抽查代表性 manifest 和检索方法入口。方法声明不是实际运行结果。

- 研究问题形成、方法设计、论证规划、稿件起草等既有核心方法可作为功能组织参考；代表性[问题形成声明](../../../../ResearchSpec/skills/capabilities/design-research-question-formulation/manifest.yaml:10)定义意图到问题 brief 的产物，标记来源为 ars-derived、许可为 CC BY-NC 4.0。沿既有源码决定，该类内容暂不作为默认内置依赖。
- [文风审阅声明](../../../../ResearchSpec/skills/capabilities/check-paper-humanization-review/manifest.yaml:11)接收稿件及可选约束，交付审阅报告与修订计划；[审稿回复轮次声明](../../../../ResearchSpec/skills/capabilities/generation-review-response-round/manifest.yaml:11)交付实际稿件、回复及轮次总结。两者标记 vendor-derived、MIT，是按新契约进一步核对的方法素材；vendor-derived 身份本身不构成排除理由。
- 当前目录中 Skill、能力与 profile 存在多种发现入口，代表性 academic-paper-reviewer 同时有方法、profile 及分工判断能力，不能据入口数量为 Scholoom 建立重复职责或产物权威。具体清单继续按已有能力模型融合；可选学科与工具扩展保持后置。

线上文献工作核到以下分工：

- literature-search-ingest 的[runner 声明](../../../../zotero-agents/skills_builtin/literature-search-ingest/assets/runner.json:14)提供 prompt 入口，本链路发现与筛选由执行 Agent 的网络能力及方法承担；[来源方法](../../../../zotero-agents/skills_builtin/literature-search-ingest/references/search-planning-and-discovery.md:164)提到 Crossref、OpenAlex、Semantic Scholar、Google Scholar、arXiv、PubMed／Europe PMC 及区域来源。这是方法建议，不能直接认定为本链路已实现的搜索 API。
- [全文探测方法](../../../../zotero-agents/skills_builtin/literature-search-ingest/references/pdf-probe.md:28)分 landing、开放获取与公开网页路径，列出 Unpaywall、PMC、arXiv、DOAJ 和机构仓储等候选；[入库步骤](../../../../zotero-agents/skills_builtin/literature-search-ingest/SKILL.md:450)通过 Host mutation 写入条目与附件。本项目沿任务授权设计检索、筛选与收录，不自动继承旧 Skill 的逐篇审批和网络工具限制。
- 旧分析／核验脚本内有 Crossref、Semantic Scholar 与 arXiv 的部分查询素材；未完整追踪实际 Agent 搜索工具的接线，不能由这些素材推定已具备通用线上检索适配。Scholoom 的来源选择、结构化搜索与通用网络工具分工见 Answer Q4，实际适配仍需实现。

官方接口核查见[线上文献检索／全文来源候选](../research/academic-search-source-candidates.md)。OpenAlex 提供题录及部分 OA PDF／XML，内容下载需 key；Unpaywall 当前与 OpenAlex 共用数据库／管线，独立接入主要有既有格式兼容价值。arXiv 允许个人或研究用途的全文获取与保存，对外分发另有条件。检索与题录接口的覆盖不能当作全文已经取得；本轮未实测接口与下载。

尚未运行方法、程序或模型；许可声明与实际可抽取范围随内容迁入核对。本票不决定专利等未确认科研场景，也不把目录中的可选学科方法默认纳入首批承诺。

## Answer

2026-10-09，用户确认 Q1–Q4，以下为正式决定。本轮以[文献场景底稿](../research/research-scenarios-existing-toolchain.md)、[研究结果底稿](../research/research-results-existing-toolchain.md)、[写作修订底稿](../research/manuscript-writing-review-existing-toolchain.md)及[线上来源官方接口核查](../research/academic-search-source-candidates.md)为依据；旧方法名称用于定位素材，不代表整体迁入旧目录或已经实现。

### Q1：按六组科研工作组织内置内容

| 方法组 | 方法与能力的业务组成 | 可供后续工作消费的成果 |
| --- | --- | --- |
| 文献发现与收录 | 检索策略、线上检索、筛选、题录与附件获取及收录；吸纳 literature-search-ingest 的方法素材。 | 候选与筛选依据、实际收录结果、材料可用情况及检索覆盖。 |
| 文献理解与综合 | 四类基础分析、面向问题的精读、主题形成、主题综合与维护；吸纳 literature-analysis、literature-deep-reading、topic-planner 和 topic-synthesis。 | 单篇产物、定向分析、主题综合及实际来源、覆盖和限制。 |
| 研究问题与方案 | 问题形成、方法设计、备选方案比较和论证规划；核对 ResearchSpec 的研究问题、方法设计及 argument-blueprint。 | 问题与研究条件、方法方案、比较理由和研究计划。 |
| 研究实施与结果解释 | 数据分析、计算、实验或推导的组织，结果检查、图表生成及证据论证；使用既有科研规程与受管工具。 | 实际代码、数据与结果，图表及其依据，解释、限制和未解决问题。 |
| 写作与审阅 | 文献定位、论证与章节组织、起草、引用核验、学术审阅及文风检查。 | 稿件源文件、依据关联和可定位的审阅意见。 |
| 修订与交付 | 反馈整理、修订计划、补充验证、正文修改、审稿回复与格式渲染、交付检查。 | 实际修订、验证结果、回复及稿件或投稿交付材料。 |

六组是方法目录的业务组织，不预设六个模块、六个 Agent 或固定六阶段流程；Skill、能力与工作流按已有核心模型组合。文献分析和持续综合按已确认 LangGraph 维护方向组织，分工审稿与文风监督交给多模型协作票细化。

### Q2：融合两项目重复的综合与写作方法

形成共同的来源读取、证据比较、来源定位和交付检查基础；主题知识整理与围绕具体研究问题的证据综合保留各自目的、方法和产物，按用途选择，避免维护两套各自取材、各自写回的流水线。

zotero-agents 的 manuscript-literature-framing 与 ResearchSpec 的论证、起草方法衔接为文献定位到写作的工作，取材直接关联库与工作区产物。研究包沿已有独立交付、迁移与归档用途，普通写作无需先导出包。方法适用条件和不同观点沿已有决定保留。

### Q3：预置的审阅、修订与交付工作流

文献基础分析与主题综合维护的 LangGraph 工作流沿已确认专票组织。另外预置三类工作流，复用上述六组中的方法和能力；各步骤仍可独立调用，具体角色配置与监督调度交给多模型协作票。

| 工作流 | 主要组织内容 | 整体交付 |
| --- | --- | --- |
| 稿件审阅与改进 | 学术审阅与意见汇总、写作过程中文风 advisor 对 Agent 生成文本的修改建议、获授权修改及修改后核对。 | 定位到稿件的意见、实际修改和复核结果，保留未处理事项；文风 advisor 的对象与协作方式见[多模型协作](37-multi-model-research-collaboration.md)。 |
| 外部评审修订与回复 | 整理评审意见，安排补充验证及正文修订，生成并核对回复。 | 意见与实际结果／修改的对应关系、修订稿、回复及尚未解决的问题。 |
| 稿件交付准备 | 按稿件原生格式与目标配置渲染，整理所需文件并检查交付。 | 实际渲染或交付材料、检查结果及剩余问题；构建／文件检查与科研充分性沿已有模型分别判断。 |

这些是可复用工作安排，调用时明确目标、输入与整体交付；研究讨论、方案比较和局部起草仍沿已确认普通方法与持续任务方式开展。步骤消费工作区中实际保存的产物与研究条件，科研记录随工作形成并持久化，材料缺项和未完成事项如实交付。

具体 LangGraph 图、角色交接和交付 Schema 留到相应协作讨论与实现规格。

### Q4：线上检索工具与首批来源

| 工具组成 | 首批来源与职责 |
| --- | --- |
| 结构化学术检索、标识符查询及引用关系扩展 | OpenAlex 用于广泛发现和来源关联；Crossref 用于 DOI 题录查询与核对；Semantic Scholar 用于检索及参考／被引文献扩展。共用工具契约，保留各来源可用字段与查询条件。 |
| 专门来源检索 | arXiv 用于预印本发现与版本查询；PubMed／Europe PMC 用于生命科学题录及相关 OA 内容。Agent 按研究问题选择来源，不要求每次全部查询。 |
| 通用网页搜索与页面读取 | 补充出版商、中文及区域来源、机构仓储等页面；与结构化检索配合，不预设这些站点均有可用 API。搜索供应商随实现选型。 |
| 全文定位与获取 | 使用实际 OA 地址、OpenAlex 可用内容、arXiv／PMC 或其他仓储获取材料；分别表达题录、全文位置和实际取得的内容。首批不另接独立 Unpaywall 适配，后续按独立需求补充。 |

结果保留来源、标识符、可定位地址、查询覆盖和部分失败，供筛选、收录与后续研究消费。沿已确认文献管理与任务授权契约执行；详细参数、凭据、配额及生态入库接线留实现规格和相应票核对。Unpaywall 当前与 OpenAlex 共用数据，首批独立适配的增益有限。

### 交付与检查的既有依据

沿[能力核心模型](17-native-research-capability-model.md)和[内容执行契约](18-native-capability-runtime-and-content.md)，方法及工作流交付实际产物、必要来源与条件、检查发现、限制与未完成事项；分析和推导等过程内容按[工作区承接契约](35-research-workspace-context.md)随工作保存。程序检查结构、材料可用性及实际执行结果，科研判断结合研究目的和证据核验。普通研究保持渐进交付，具体必要项按该能力用途确定，不整体照搬旧 Gate、hash 或快照规则。

### 仍待核查与后续讨论

- 线上检索的工具组成与首批来源已确认；接口响应质量、覆盖、配额与全文下载随实现实测，不能由官方文档推定实际可用效果。
- 精确原生能力身份、参数与交付 Schema 随实现规格落实；多模型角色的材料与业务交付由[多模型协作](37-multi-model-research-collaboration.md)细化，执行上下文与步骤接线由[harness 协作](25-harness-business-integration.md)承接。
- 沿[既有源码取舍](19-existing-source-and-rust-reuse.md)，ARS 派生且标记 CC BY-NC 的内容暂不作为默认内置依赖；相应功能由自有方法和独立实现支撑，可选学科与工具扩展沿已有后置范围。

本票已 resolved。本轮未运行检索、科研方法或工作流。
