# Scholoom：产品与工程基础决策地图

Labels: wayfinder:map

## Destination

明确 Scholoom 的产品形态、领域与运行时架构、技术栈和开发工程纪律，使后续会话能够据此制定实现计划。完成标志是当前阶段的决策票得到回答，相关调查已有依据，且没有阻塞首阶段实现规划的未决问题；用户明确后置的议题保留讨论时机与责任。

## Notes

### 用户已经明确的前提

- Scholoom 是独立项目，也是用户准备长期维护的主要个人项目。
- 目标是跨平台 Electron 桌面应用；以 Linux 为主要开发与日用验证平台，从开发开始维护三平台构建，首个稳定版完成三平台验收，详见 [#12](issues/12-technology-stack.md)与 [#15](issues/15-validation-and-release-discipline.md)。
- 理念是 “All by agents, all for agents”。AI Agents 是一等公民，人类交互也需要认真设计。其可验收含义由后续决策明确。
- 用户明确产品内核为 Agent 运行时及其外围配套 harness；Agent 工作台是人类界面。词义见 CONTEXT.md，产品讨论记录保存在对应票中。
- 必须借助 Zotero 生态起步，尽可能复用或兼容文献管理能力、元数据 translators、browser connector 和插件体系。
- Zotero 插件兼容宿主已确认采用 Node＋Chromium，从固定 Zotero 10 基线建设通用兼容层；开发时选定重要插件先做宿主适配，支持承诺按实际验收记录。原包兼容与维护策略见决策索引。
- 首批插件为 Better BibTeX 和茉莉花；重点功能已确定，具体支持版本与运行行为需要验证。
- 采用 Electron 的直接动机包括获得方便使用现代 Node Agent 工具的运行环境，并摆脱 zotero-agents 在 Gecko 宿主中的限制。
- zotero-agents 与 ResearchSpec 都是用户维护的项目。前者是本项目的重要起点；后者的 agentic writing 理念需要合适的运行时外壳。
- 用户明确 Scholoom 以替代旧项目能力为目标，不承诺兼容 zotero-agents 或 ResearchSpec；其[原生内容与执行契约](issues/18-native-capability-runtime-and-content.md)按本项目需要设计。
- Nimbalyst 主要提供工作台组织与产物协作方面的参考。
- 首条用户消息中的产品构思是参考材料，其中的四工作区、对象模型和 MVP 路线尚未全部确认。
- 用户进一步明确：从文献管理到论文写作的全流程都是必须实现的，缺一不可。可以讨论开发先后与每步实现深度，但不能通过仅保留某一环节来缩减首阶段产品范围。
- 用户于 2026-10-04 明确实现路线暂时搁置：当前地图仍有待讨论议题，由用户判断时机成熟后再规划。现有决策票完成不自动触发实现规划。

### 使用方式与事实来源

- 用户已批准制作项目 OpenSpec schema：[scholoom-dev](../../openspec/schemas/scholoom-dev/README.md)将调查依据与实际交付纳入流程，配置设为项目默认；规划结束后再执行并填写 delivery。结构、模板解析及 12 项临时 CLI 行为检查通过，独立检查所发现的 continue 衔接问题已处理，详见[验证结果](research/openspec-project-schema-validation.md)。具体机制集中在 schema 与模板，工程原则继续以 #14／#15／#20 为依据。此次只落实开发流程，业务实现路线仍由用户决定。

- [#22 模型接入、数据使用与执行资源配置](issues/22-model-data-and-execution-policy.md)按用户要求新建，保持 open；讨论产品的模型选择、外部数据发送、凭据与诊断、超时／限流／并发／费用以及模型切换。与 #21 的科研效果评价分工，可在功能实现前讨论，具体政策尚未确认。

- [#15 验证与发布纪律](issues/15-validation-and-release-discipline.md)已 resolved；用户采纳 Q1–Q7，正式政策集中在 Answer。实际运行、性能门槛及分发条件随实现落实；#21 保留为稳定版科研效果验收前置事项，不阻塞本票工程政策定案。实现规划仍由用户决定启动时机。

- [#21 真实科研 Agent 验收](issues/21-agent-dogfooding-and-evaluation.md)按用户要求暂缓，恢复 open、释放领取；留到功能有初步实现后结合实际调用与产物再讨论，当前不自动领取，也不阻塞初步功能的实现规划。Q1–Q3 保留为未确认草案，本轮未启动 Agent 或调用模型。

- [#20 UI 调试与 Electron e2e](issues/20-ui-debugging-and-e2e-harness.md)已 resolved；用户采纳 Q1–Q6，正式调试／验收方案见本票 Answer。实际接入验证随业务实现开展，尚未运行；本票转为决策讨论票，不另建演示原型。[#21 真实科研 Agent 验收](issues/21-agent-dogfooding-and-evaluation.md)暂缓至功能初步实现后，独立工程验证与发布政策已由 [#15](issues/15-validation-and-release-discipline.md)确认。

- [#12 技术栈、仓库结构与最小工具链](issues/12-technology-stack.md)已 resolved，Q1–Q14 和调查依据集中在本票 Answer；组件集成与分发尚待实现验收。UI 调试方案已由 [#20](issues/20-ui-debugging-and-e2e-harness.md)确认，真实科研 Agent 验收与发布纪律继续沿专票讨论；实现规划仍由用户决定启动时机。

- [#09 领域模块与 Electron 架构](issues/09-electron-architecture.md)已 resolved：用户确认独立 Node 内核、可信代码执行、共同客户端协议、单实例与执行分工，并批准独立 Electron 兼容宿主及取消／故障恢复策略。正式架构与图见本票 Answer；下一项可讨论 [#12 技术栈与最小工具链](issues/12-technology-stack.md)，完成决策不自动启动实现规划。

- 用户于 2026-10-04 结束 #16 原型并确认 [Node＋Chromium 通用兼容层](issues/16-zotero-host-prototype.md)，票已 resolved：从固定 Zotero 10 基线建设共享宿主契约，以重要插件推动开发适配，首批保留 BBT／茉莉花，不承诺全部插件无缝运行。剩余功能进入实现验收；完成选型不自动继续实验或启动实现规划。以下逐轮进展保留当时的验证范围与阶段状态。

- [#16 宿主原型](issues/16-zotero-host-prototype.md)已领取并完成首轮实跑：[运行结果与路线比较](research/zotero-host-prototype-results.md)。完整 Zotero 10.0.5 上选定 BBT／Reader 路径通过，中文元数据仅离线回放，Node 业务路径未验证；卸载仍有错误。宿主路线与文献权威边界尚待用户决定，票保持 claimed。
- [#16 第二轮 IPC 验证](research/zotero-host-ipc-results.md)已完成：独立 Node 客户端修改／读回／导出同一临时文献权威，真实关窗后运行与 Reader 重接通过，停机落盘核对通过。toolkit 显式保活，窗口卸载仍有原包错误；正式文献权威与独立宿主接入尚未决定，票仍 claimed。
- [#16 第三轮冷启动验证](research/zotero-host-cold-start-results.md)已完成：已初始化库无需显示服务器或首次打开主窗口，即可原生读写、保留已有引用键并用 BBT 导出；新库 BBT 初始化和冷启动后的茉莉花 Reader 未通过。临时宿主增加两个启动成员，原成员及 XPI 不变；第二轮回归通过。首次初始化、Reader 生命周期和正式权威边界仍未解决，票仍 claimed。
- 用户要求 #16 后续验证专注 Scholoom 目标，见[后续验证范围](research/zotero-host-goal-validation-plan.md)：聚焦能力接口、同一文献权威与工作台结果消费，以实际适配代价比较候选宿主；未打开工作台不自动要求兼容环境内部无窗口或 DOM，Zotero 启动问题只在影响产品链路或路线选择时继续调查。
- [#16 第四轮目标链路实验](research/zotero-host-boundary-results.md)已完成：能力侧与独立工作台侧客户端共用原型文献接口，读写同一来源；BBT 原包重生成键，两端导出与茉莉花阅读状态消费通过。稳定身份与题录单一来源保持，静态视图可呈现结果。9＋5 项检查和停机核对通过；正式 Electron 阅读器、存储候选取舍与分发仍未实现或决定，票保持 claimed。
- [#16 第五轮阅读交互实验](research/zotero-host-reader-results.md)已完成：自己的 PDF 视图实际渲染和导航同一附件，书签改名后界面刷新、能力侧续读及原 Reader 重开一致，PDF 字节与书签位置保持。5＋3 项检查、停机核对和第四轮回归通过；原插件保存仍依赖内部 Reader DOM，正式路线与组件未选择，票保持 claimed。
- [#16 第六轮 Electron／重启实验](research/zotero-host-restart-results.md)已完成：真实 Electron 页面经共同接口修改书签，工作台接入前／关闭后能力续用；正常退出再启动同一库，原身份、题录、引用键和阅读状态保持，并可继续修改。两阶段 4＋6 项及停机核对通过；内部兼容库／Reader 维护、独立分发和正式权威边界待选择，票保持 claimed。
- 用户指出 #16 的完整 Zotero 套壳偏离目标；前六轮仅保留为参考宿主证据，不足以选择独立路线。[独立最小宿主实验](research/zotero-host-minimal-results.md)已让未修改的 BBT 在 Node 主宿主＋Chromium 原 Worker 上启动，向自己的 SQLite 权威保存引用键并实际导出 BibTeX；兼容 SQL 为只读视图，无 Zotero 应用进程。纯 Node 在 IndexedDB 初始化失败。事件／缓存变更、茉莉花、Electron 嵌入与裁剪 Gecko 仍待验证，#16 保持 claimed。
- [#16 独立宿主变更实验](research/zotero-host-mutation-results.md)已验证真实保存通知驱动原 BBT 更新缓存并导出新标题／DOI／作者，无通知对照确实出现旧数据。茉莉花原主包在工具包构造的 Prompt DOM 初始化失败，未进入元数据业务；下一项聚焦自己的 DOM 环境与第二个插件业务。全程未运行完整 Zotero，整体宿主仍未选定，票保持 claimed。
- [#16 原生 DOM 实验](research/zotero-host-native-dom-results.md)已让原茉莉花在 Chromium 页面完成 Prompt 初始化／onStartup，经新增通知实际拆分中文作者、保存自己的 SQLite，并由原 BBT 导出同一事实。关闭偏好的对照和持久读回通过，BBT 缓存变更回归通过；未运行完整 Zotero。现有成功仅覆盖作者处理，元数据识别／附件／Reader、Gecko 服务及整体选型仍待验证，票保持 claimed。
- [#16 元数据任务实验](research/zotero-host-metadata-results.md)已在合成 HTTP 输入下运行原搜索／筛选、原插件回退建项及 PDF 关联，BBT 实际导出同一题录和附件路径；无结果对照、独立官方 RIS 导入、既有行为回归及落盘核对通过。原任务 RIS 请求 ID 与本机注册 ID 不同，原分支失败如实记录。未运行完整 Zotero；真实在线识别、下载、独立 Reader 和产品分发仍待验证，票保持 claimed。

- 本地图采用本地 Markdown tracker，遵循 [本地 tracker 的 Wayfinding operations](../../.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md)。地图是索引；每项新决策的详细回答只保存在对应决策票中。
- 后续会话先读取地图，再按编号查询开放、未领取且阻塞项均已解决的子票。不要把所有子票全文作为默认上下文。
- 子票的 `Status: open` 表示开放且未领取；开始处理前设置 `Status: claimed`，记录领取者；解决时追加 `## Answer`、设置 `Status: resolved`，再给地图追加摘要链接。
- 标签用 `Labels:` 保存，类型用 `Type:` 保存；阻塞关系用 `Blocked by:` 保存。只有真正阻止问题作答的前置决策才建立阻塞关系。
- 默认每次会话只解决一项人工参与的决策；调查票可以并行。制图会话只建立问题与依赖，不代替用户回答决策票。
- 决策讨论使用 [grilling](../../.agents/skills/grilling/SKILL.md) 与 [domain-modeling](../../.agents/skills/domain-modeling/SKILL.md)；调查使用 [research](../../.agents/skills/research/SKILL.md)；具体交互探索使用 [prototype](../../.agents/skills/prototype/SKILL.md)。架构讨论可按需使用 [codebase-design](../../.agents/skills/codebase-design/SKILL.md)。
- 用户最新指定后续子 Agent 委派使用 `minimax-cn/MiniMax-M3.1-Flash-Preview`；委派前仍说明任务与模型，后续如有新指定则以用户指示为准。
- 用户明确宏观产品、领域模型和架构问题由主 Agent 与用户直接讨论，不委派子 Agent 分析或判断。子 Agent 仅承担范围明确的事实调查或执行任务，结果由主 Agent 核对。
- 用户于 2026-10-04 确认[低摩擦协同方案](issues/13-storage-and-change-model.md)：开放文件直接工作，Agent 适应变化，内核提供必要保护，重要研究成果按需留存。前序版本、历史、调用与恢复约定已同步；完整复现及更强恢复按明确需要采用。
- 已有调查入口是 [references](../../references/)。其中的说明是参考快照；涉及实际兼容能力时，以对应上游源码、官方文档和明确版本为依据，并区分静态判断与运行验证。
- 已确认的领域术语见 [CONTEXT.md](../../CONTEXT.md)；具体产品选择保存在对应决策票中。
- 调查工件保存到本地图的 `research/` 中，由子票链接。遵守用户的 Git 操作边界，本次不创建或切换研究分支、不提交代码。
- 领域词汇只在定义获得确认后写入 `CONTEXT.md`；架构选项在作出真实取舍后再考虑 ADR。OpenSpec 与地图的职责及交接由专门决策票明确。
- 当前没有业务代码，已有用于讨论的临时工作台草图。科研 Agent harness 的套件与原生融合方向由[内核决策票](issues/07-agent-runtime-boundaries.md)确定。[核心模型](issues/17-native-research-capability-model.md)、[原生内容与执行契约](issues/18-native-capability-runtime-and-content.md)、[源码复用取舍](issues/19-existing-source-and-rust-reuse.md)、[工作台组织](issues/10-workbench-interaction.md)、[阅读与写作路线](issues/11-reading-writing-format.md)、[存储与变更模型](issues/13-storage-and-change-model.md)、[工程纪律](issues/14-agent-development-discipline.md)、[原插件兼容宿主](issues/16-zotero-host-prototype.md)、[领域模块与 Electron 架构](issues/09-electron-architecture.md)及[技术栈与最小工具链](issues/12-technology-stack.md)已经确认；具体版本、辅助库和部署接线由实现规格核对，UI 调试、真实 Agent 验收及发布纪律继续沿专票讨论。
- 工程讨论沿用用户的全局规则：优先清晰模块与单一事实源，避免重复、脆弱门禁和低价值测试；不把选型讨论视为安装依赖或启动开发服务器的授权。
- 后续工程工作沿用[已确认的工程纪律](issues/14-agent-development-discipline.md)；UI 调试与 e2e、真实 Agent dogfooding 的具体接线和验收在专票中落实，实现路线继续由用户判断时机后讨论。

### 工程实施

- 用户已授权按既定决策初始化开发骨架，并明确允许安装本轮依赖及完成验证。实施采用 [initialize-project-skeleton](../../openspec/changes/initialize-project-skeleton/proposal.md)，当前代码入口见 [开发说明](../../docs/development.md)。这次授权覆盖工程骨架，后续功能仍按各自变更实现；上面的讨论阶段记录保留当时范围，当前工程状态以代码与该变更的实际交付记录为准。

## Decisions so far

- [查明 Zotero 原插件在 Electron 中运行所需的宿主能力](issues/03-zotero-plugin-host-research.md)：已识别 Better BibTeX、茉莉花及插件加载的宿主依赖，兼容实现仍待选择和运行验证。
- [查明 translators 与 browser connector 的独立复用边界](issues/04-zotero-ingest-research.md)：已厘清翻译执行、持久化、附件与 Connector 会话职责，目标配置和共存仍需验证。
- [全流程产品形态与真实使用验收](issues/01-first-product-loop.md)：确定科研 Agent 内核与人类工作台的产品关系、全流程范围、项目工作空间及无工作台执行后接入的验收要求。
- [将 All by agents, all for agents 变成可验收的产品约束](issues/02-agent-first-contract.md)：确定可调用科研能力、内外 Agent 契约、主动上下文获取、任务级授权、持续任务及人的介入要求。
- [选择 Zotero 生态兼容路线与首批兼容承诺](issues/05-zotero-compatibility-policy.md)：确定指定版本原包兼容、首批功能、界面适配与维护策略；宿主按 #16 选择 Node＋Chromium 通用层，支持范围随实际验收扩大。
- [通过原型选择 Zotero 原插件的兼容宿主](issues/16-zotero-host-prototype.md)：采用 Node＋Chromium，固定 Zotero 10 基线建设通用层，以重要插件推动开发适配与验收；不承诺全部插件无缝运行，原型阶段结束。
- [确定研究对象、长期文献库与项目的领域边界](issues/06-research-domain-boundaries.md)：确定来源与材料版本、证据和主张、稿件及修订对象的语义，明确跨项目复用与领域权威边界。
- [确定科研 Agent harness 的职责与执行引擎路线](issues/07-agent-runtime-boundaries.md)：确定 LangGraph、LangChain 与 Deep Agents 基础，workflow 和 capability 原生融入统一运行时，明确任务生命周期及外部 Agent 接入。
- [确定 zotero-agents 与 ResearchSpec 的复用和演进边界](issues/08-existing-project-integration.md)：三个项目保持平行，Scholoom 初期吸纳能力、后期独立演进；同步由用户掌握，核心模型、内容迁入和源码取舍独立成票。
- [确定领域模块、Electron 进程与扩展宿主的架构](issues/09-electron-architecture.md)：独立 Node 内核集中部署原生模块，同一数据配置共用单实例；客户端采用双向 JSON-RPC＋本地 WebSocket。重计算和用户程序分开执行，兼容环境采用受内核监督的独立 Electron 宿主，取消与恢复按受影响调用和实际结果处理。
- [确定原生科研能力、Skill、工作流与科研 Agent 的核心模型](issues/17-native-research-capability-model.md)：明确方法、能力与工作流的关系，以及持续任务、调用、计划、交付和科研判断的边界；四类科研情境的语义核对通过。
- [确定科研能力的运行时契约、内容编写与旧内容迁入](issues/18-native-capability-runtime-and-content.md)：确定标准 Skill、YAML 声明、原生执行与交付接口及工作包，方法留存与恢复按任务需要处理，不承诺兼容旧项目。
- [确定既有源码、Synthesis 与 Rust 实现的复用取舍](issues/19-existing-source-and-rust-reuse.md)：按原生契约吸纳源码，Synthesis 先用 TypeScript 并独立执行重计算，main 和历史有完整实现候选；Python 按价值接入，受限第三方内容不默认内置。
- [用粗原型确定对象、Agent 任务与变更审查的工作台组织](issues/10-workbench-interaction.md)：默认 Agent 工作优先，提供四种布局、持续工作导航和按研究目的组织的审查；两轮人工选择及示例交互检查已完成。
- [选择阅读与写作的主格式、引用和编辑能力](issues/11-reading-writing-format.md)：确定 QMD 默认、MD／LaTeX 原生、源码与可视共稿及标准学术语法；阅读组件独立选型，预览、科研执行与外部改稿沿共同内核追溯。
- [选择技术栈、仓库结构与最小工具链](issues/12-technology-stack.md)：确定 AGPL、TypeScript／React 与 assistant-ui、pnpm 单仓库及 Electron 工具链、SQLite 接入、阅读与编辑组件、Graphology／d3-force／Sigma.js 图谱、独立 Node 和 Quarto 分发及按需 TeX／Python 环境；具体集成和三平台验收继续承接。
- [确定数据权威、开放文件与并发变更的存储模型](issues/13-storage-and-change-model.md)：采用全局文献库数据库、项目本地数据库与开放文件，Agent 适应变化，按价值留存，支持自动备份与独立打包。

- [明确 Agent 开发协作、决策文档与规范的工程纪律](issues/14-agent-development-discipline.md)：确定人机分工、领域自明代码与现成检索、可操作开发环境、Orca UI／e2e 分工及真实 Agent 量化验收；实现路线继续搁置。
- [确定 Orca UI 调试与 Electron e2e 验收](issues/20-ui-debugging-and-e2e-harness.md)：确定共同工作台浏览器入口、Playwright Test、真实内部接线与隔离诊断、首轮生命周期验收及本地／Linux CI 安排；实际运行验证随业务实现开展，尚未运行。
- [确定验证、兼容维护与跨平台发布纪律](issues/15-validation-and-release-discipline.md)：确定按影响范围验证、发布阶段与三平台分发包验收、固定基线升级维护、迁移及恢复、性能测量和 GitHub Releases／分阶段更新安排；#21 在初步实现后补齐科研评价，政策完成不表示实际验收或发布完成。

## Not yet specified

- Better BibTeX、茉莉花及日常研究任务的具体依赖明确后，可能显露目前无法命名的宿主差异或领域特例；届时判断是否需要新的兼容或领域决策。
- 工作台原型可能暴露阅读、证据审查、Agent 任务和稿件编辑之间的交互冲突；先观察具体情境，再把问题细化成票。
- 技术栈与支持平台明确后，原生依赖和上游组件可能带来新的维护约束；目前无法预判哪些约束需要单独决策。

## Out of scope

- 实现应用、安装依赖、初始化业务代码、迁移实际文献资产，以及执行打包发布。当前地图用于明确上述工作的决策依据。
- 为其他个人项目执行重构或发布。可以在本地图中决定它们与 Scholoom 的复用边界。
- ResearchSpec 的可选学科和工具扩展留待日后讨论；当前地图不决定其默认启用或分发方式。
- 决定产品所有未来功能。云同步、多人协作、移动端等长期能力仅在影响首阶段基础选择时讨论。
