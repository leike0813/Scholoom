# Scholoom 开发前复用调查

调查日期：2026-10-11。用户已明确暂不考虑 Rust 应用路线，并要求在业务开发前调查成熟库、组件和可借鉴项目，以减少个人实现与维护负担。

当前路线更新（2026-10-14）：执行统一使用内置 LangGraph harness，插件 MCP 与候选对外 MCP 分开设计，不支持 ACP 外部 Agent；Paseo 以设计借鉴为主。依据 [#07](../issues/07-agent-runtime-boundaries.md#answer)与 [#12](../issues/12-technology-stack.md)。各专题中原有 ACP／第三方执行器调查保留为历史候选证据，不作为当前实施建议。

本次完成的是针对当前 PRD 的文档与源码调查。已有选型、已安装依赖、实际产品集成分别记录；本报告提出的组合和验证顺序尚未成为新的产品决定。未安装依赖、运行候选应用、调用模型或学术服务、启动开发服务器、改变现有实现和提交代码。

## 我的判断

Scholoom 的通用基础能力可以大量复用。没有找到一套已经覆盖完整 PRD、又能低成本接入现有共同内核和文献权威的成品底座；这只是本轮候选调查的结果，不是对所有项目的存在性判断。

最适合个人维护的路线是公开组件承担通用能力、成熟工具承担科研格式与执行、少量固定源码承担公开库缺少的学术行为。自己的代码集中在科研对象、来源与版本、任务授权、交付与恢复，以及这些模块之间的接线。

“少手写”不等于“装最多库”。一个内部模块抽取可能比使用成熟公开库维护更重；一个完整 RAG 平台也可能带来第二套文献、会话、权限与任务权威。候选必须按能省去的工作和引入的长期责任一起比较。

## 报告导航

| 报告 | 调查范围 |
| --- | --- |
| [工作台与工件组件](reuse-landscape-workbench.md) | Agent UI、基础控件、布局、表格与列表、状态、Markdown/数学、差异、科学图表、图谱 |
| [学术阅读与写作](reuse-landscape-reading-writing.md) | PDF/EPUB/快照、源码/可视编辑、LaTeX 语言服务、引用与格式转换、外部审稿文件 |
| [文献获取、解析与检索](reuse-landscape-literature-knowledge.md) | Zotero 采集与扩展、六类学术来源、解析/OCR、本地全文与向量索引、中英检索 |
| [Agent 运行时与协议](reuse-landscape-agent-runtime.md) | LangGraph/LangChain/Deep Agents、外部引擎、MCP/ACP、Schema、观测/评价、后台调度 |
| [桌面与数据基础设施](reuse-landscape-desktop-data.md) | SQLite、RPC/实例、文件与备份、子进程、凭据、运行时与发布、诊断和依赖检查 |
| [材料读取与科研工具](reuse-landscape-material-tools.md) | 网页读取/搜索、本地嵌入与重排执行、模型权重、科学数据文件读取 |
| [可借鉴项目与源码](reuse-landscape-reference-projects.md) | 16 项项目/项目组的可取模块、接口耦合、源码许可、平台替代与研究方法参考 |

领域报告是证据和候选清单，本总览负责去重、组合判断和后续问题。相同包在两个领域出现表示共同使用，不表示应部署两套实现。

用户提出 Codex harness 后，另补 [Codex Agent core 复用调查](codex-harness-core-reuse.md)，比较 app-server 接入、Rust 源码 fork 与改写 TypeScript。用户于 2026-10-11 在讨论图控制能力后确认维持 LangGraph/LangChain/Deep Agents 原方案；Codex 调查保留为参考，本轮不推进主干替换、双层组合或对比原型。

## 调查方法与证据强度

以 PRD、当前开发说明和既有决定为范围；复用已有调查，补齐新增需求和未选的组件。外部事实优先实际打开官方文档、README、LICENSE、源码及发布记录，不以星数、截图或性能宣传作结论。

五项领域调查和一项补充调查使用独立 `gpt-6-luna` 背景研究员；主 Agent 核对参考项目、组合边界及会改变推荐的事实，抽查 Quarto 许可、Pi、Dockview、shadcn、Node-API、双 Electron 产物与凭据生命周期。各人只新建所属报告，没有并行修改产品代码。

| 证据 | 能支持什么 | 不能支持什么 |
| --- | --- | --- |
| 官方能力说明和公开接口 | 候选实际职责、接入形态、文档中的运行前提 | 在本应用中已可运行或性能达标 |
| 源码、package 与许可证 | 依赖耦合、实际导出、对应来源的许可 | 自动覆盖所有资产、权重和服务条款 |
| 提交/发布/归档记录 | 维护活动、版本变化、明显维护停止 | 活跃就无 bug，久未发布就不可用 |
| 既有本机宿主/预览实验 | 其记录的固定样本和目标链路 | 全功能兼容、完整产品和三平台发布质量 |

移动分支、无版本网页、报价和配额按其当前范围引用，实施时固定实际版本；不把检索时的最新版本直接改入项目 lockfile。

## PRD 覆盖与复用责任

| 逻辑模块 | 可借力的成熟实现 | 必须保留的 Scholoom 职责 | 证据入口 |
| --- | --- | --- | --- |
| 文献管理 | translators/Connector、学术 REST API、题录转换、阅读器、SQLite | 稳定身份、跨源字段、版本与去重、附件和渐进结果、共享批注及迁入恢复 | 文献报告、阅读写作报告 |
| Agent harness | LangGraph、LangChain、Deep Agents、协议 SDK、Schema 校验 | 持续任务与会话关系、工作包、授权、正式决定、统一模型限制和效果核查 | 运行时报告 |
| 工作台 | assistant-ui、React 原语、分栏、表格/虚拟列表、CodeMirror、图表/图谱 | 领域投影、对象指令、草稿、修改审查与撤销、连接恢复、性能与无障碍 | 工作台报告 |
| 科研业务与内容 | zotero-agents/ResearchSpec 方法及算法、Quarto/Pandoc、PaperQA/STORM 方法参考 | 证据与主张、依赖、分析更新、研究意义判断、多模型独立审阅、交付检查 | 参考项目报告、运行时报告 |
| 执行环境与沙箱 | Node 进程/Worker、uv、Quarto/TinyTeX、现成 Python 工具 | 范围授权、环境准备、取消与子树监督、产物保护、断网和失败状态；可信执行不等于强隔离 | 桌面数据报告、材料工具报告 |
| 插件兼容 | 固定 Zotero 源码、DOM/Worker/IndexedDB、BBT/茉莉花原包 | 共享兼容契约、对象和保存通知、共同文献权威、Reader 和对外功能验收 | 已有宿主/生态票、文献报告 |
| 研究项目与资产 | SQLite、文件系统、watcher、归档、内容读取与索引 | 文件与数据库权威、材料与任务关系、开放编辑保护、接续上下文、备份恢复 | 桌面数据报告、材料工具报告 |

这张表覆盖完整科研流程；“建议先验证”表示实施顺序，不表示删去 PRD 的任何业务环节。

## 建议组合：既有方向与新增候选分开

| 能力 | 当前已确认方向 | 本轮新增建议 | 为什么适合个人项目 |
| --- | --- | --- | --- |
| Agent 运行 | LangGraph + LangChain + Deep Agents | 先接其需要的模块，不增加平行 Agent 主干 | 复用恢复/模型循环/harness，同时保留科研语义 |
| Agent 面板 | React DOM + assistant-ui 外部 store | 公开组件负责通用消息/输入/工具 UI | 避免移植完整产品的会话与后端 |
| 基础 UI | 精确库未定 | Radix 或 Base UI 二选一；可用 shadcn 的 MIT 组件源码 | 省键盘、焦点、菜单等通用实现；避免多个设计系统 |
| 四种布局 | 调整、折叠、分栏、保存预设 | 先比 react-resizable-panels；真需要任意停靠再比 Dockview/FlexLayout | 不提前承担完整 IDE 布局框架 |
| 文献表格/长列表 | 有界读取与刷新 | TanStack Table；规模需要时用 Virtual | 表格模型和 DOM 窗口现成，查询范围由内核控制 |
| UI 状态 | 尚未选独立 store | React 局部状态先行；跨面板状态需要时加 Zustand | 不让实时通知产生第二套远端权威 |
| Markdown/公式展示 | 复用通用组件 | 先检查 assistant-ui 自带 renderer；不足时 react-markdown/remark/KaTeX | 避免同时维护两套消息 Markdown pipeline |
| 科学图表 | 结构图件和图片区域指令均在范围 | Vega-Lite/ECharts 窄原型；特殊图种再看 Plotly | 保留字段/记录到对象定位，不把图片伪装成图表数据 |
| 图谱 | Graphology + d3-force + Sigma | 沿既定方案；Cytoscape 为特定缺口备选 | 不新增第二种图数据权威 |
| PDF | EmbedPDF；PDF.js 备选 | 先复用 EmbedPDF/PDFium 已有文本和批注接口；独立读取缺口再评 PDF.js | 不默认同时安装和维护两个 PDF 引擎 |
| EPUB/网页快照 | Zotero Reader 成组源码与配对 epub.js | 保留 foliate-js/上游 epub.js 为替代候选 | 原生位置和批注经验有价值，但必须验证抽取成本 |
| 源码编辑 | CodeMirror 6、stex | CodeMirror merge；Zettlr 引用补全源码；texlab 补 LaTeX 工程服务 | 现成编辑能力加学术扩展，避免从零写语言服务 |
| QMD 可视编辑 | Quarto ProseMirror/Pandoc 模块 | 优先验证独立构建、宿主接线与未知语法往返 | 最匹配学术语法，维护代价也最需提前测量 |
| 渲染与交付 | Quarto/Pandoc、TeX/latexmk | 复用配对工具；保留最后成功预览输出 | 不另造学术格式转换与编译器 |
| 外部审稿文件 | 保留原件与反馈来源；跨格式定位仍待实现 | docx-preview 试只读预览，SuperDoc 比较评论/修订/Document API | 先验证成品审阅组件，避免从零写完整 DOCX parser；仍需核实际类型覆盖 |
| 文献采集 | Zotero 生态、自有 Connector | 原构建链 vs WXT 新入口有界比较 | 不因 Vite 同栈就默认移植整个扩展 |
| 学术检索 | 六类来源已确认 | 内核 fetch 接公开接口，SDK 有收益再选 | 多数无需专用 client 包，减少升级耦合 |
| 网页材料读取 | 原始材料与派生读取分开 | Mozilla Readability + DOM；按需 Turndown，动态页再评隔离浏览器 | 复用正文提取，避免从零写跨站解析器；普通网页搜索服务仍需质量对照 |
| 解析与 OCR | 精确解析产品未定 | 现有 PDF 文字层为基线，Docling 做复杂材料对照；GROBID/MinerU 按需 | 按材料复杂度选择，不给每台机器预置重型模型服务 |
| 混合检索 | 词法 + 语义、同文献归组；具体引擎未定 | SQLite FTS5 + sqlite-vec 优先试验；Orama/LanceDB 对照 | 本地默认少服务；仍需中英检索和真实规模实验 |
| 嵌入与科研数据读取 | 受管 Worker/Python 已在路线内 | 比较小型本地多语模型与托管 embedding；CSV/Excel 评 PapaParse/SheetJS，分析复用 pandas/PyArrow | 把模型资源和数据外发纳入选择；不在 Node 再复制完整分析环境 |
| 结构化存储 | better-sqlite3 + Drizzle | 维持；新 Node-API 版本另核目标平台，不自动升级 | 用已有事务、迁移、备份，领域与执行 checkpoint 分工 |
| 双向内核协议 | JSON-RPC/本地 WebSocket/Schema SSOT | ws + vscode-jsonrpc 或 json-rpc-2.0；Ajv | 复用成熟协议实现，认证/单实例/恢复由共同客户端承接 |
| MCP 扩展 | 插件受管接入；Scholoom 对外服务另属候选 | 按插件或对外入口的具体契约评估 SDK | 不接入 ACP 外部 Agent；插件调用不自动具备图级取消与恢复能力 |
| 执行与限流 | Worker/受管子进程、统一上限 | spawn 基线，Execa 对照；p-queue 只在真实共用并发缺口采用 | 避免 Redis/Temporal 成为桌面安装前提 |
| 文件、备份、诊断 | 开放文件、有界历史、自动备份、默认本地诊断 | Chokidar、diff、按需 ZIP 库、Pino | 复用基础算法，不误把 watcher/rename 当事务或恢复 |
| 运行时与发布 | 独立 Node、electron-builder、uv、Quarto、Playwright | 先验实际安装包，再按阶段加 updater/可选诊断服务 | 核对本机开发之外的依赖、资源及生命周期成本 |

上表是候选组合，不是待安装清单。通用库满足功能时不再抽取相同上游内部代码；领域需求改变时才增加确有价值的依赖。

## 最值得新增借鉴的项目

### Zettlr：学术编辑细节

已有 CodeMirror 6 引用补全、citation parser、提示及 citeproc/文献文件刷新。比从通用富文本框架自行补学术语法更接近需求。引用 provider 含 Electron IPC 与自有配置，不能整块当中立服务；优先取编辑器扩展和可隔离逻辑。根 GPLv3，路径与固定来源见[项目报告](reuse-landscape-reference-projects.md#3-zettlr本轮新增的高价值学术编辑参考)。

### JupyterLab 与 Joplin：科研输出和数据保护

JupyterLab 的文档模型/多视图和 MIME renderer 值得借鉴，Joplin 的离线资料、附件、历史与导入故障值得核对。二者不作为默认完整底座：Jupyter 服务协议/后台和 Joplin 正文权威均有额外适配成本。Notebook 或同步不因参考它们自动加入产品范围。

### Theia：需要认真比较的“整个工作台复用”候选

Theia 是可组成自有 Electron/browser 产品的公开平台，能省文件树、命令、快捷键、面板、语言服务接线。它同时引入 widget、依赖注入、前后端模块和构建约定；采用它意味着重新核对当前工作台底座，而非安装一个布局控件。

本轮保留为有界对比候选。如果完整 IDE 通用能力最终占主要投入，它可能比零散组件更省维护；若主要是科研阅读、编辑和 Agent 工件，则公开 React 组件组合更贴近现有选择。需用同一代表链路比较，尚不能仅凭架构文档定胜负。

### PaperQA2、STORM、Open Notebook、AnythingLLM

优先借鉴证据检索、引用支撑回答、多视角提问、来源/分析组织和材料摄取 UX，必要时作为受管能力或研究质量对照。完整 RAG 后台会带来另一套数据、检索、任务和配置体系，不能默认替换既定 Node/SQLite 与科研模型。STORM 的可见最后提交较早；论文效果和产品宣传不证明在本项目材料上同样有效。

Nimbalyst、Paseo、Zotero 与已有科研项目继续是主要来源。16 项项目/项目组的源码、许可和耦合详见[参考项目报告](reuse-landscape-reference-projects.md)。

## 会改变实施方式的发现

### Quarto 许可：官网存在漂移，不能停在“冲突未知”

官网仍把可视编辑器写为 LGPLv3；但[上游 PR #1032](https://github.com/quarto-dev/quarto/pull/1032)已于 2026-09-01 合并相应模块改为 MIT，固定源码的 [README](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/README.md) 和 editor package 一致。应按实际模块和固定源码许可处理，不能由旧网页覆盖新源码事实。

这也不等于整个仓库和发行物只有 MIT。实验 writer 模块不在重授权范围，实际依赖及 [ThirdPartyNotices](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/apps/vscode/ThirdPartyNotices.txt) 单独承接 LGPL/Apache/BSD 等义务。具体集成仍核第三方资源和可重建源码条件。

### 独立内核凭据：safeStorage 本身不足

Electron safeStorage 可减少 keytar 这类归档原生依赖，但 API 只在 Electron main。Scholoom 要求未打开工作台也能执行模型任务；不能让凭据读取暗中要求 GUI 常驻。独立内核可比较 `@napi-rs/keyring` 等系统凭据接入、受管凭据服务或环境变量方案；Linux 安全后端不可用时沿既定用户选择政策处理，不把 `basic_text` 当系统保护。keyring 候选的 Linux 默认回退到仅内存的 keyutils，系统重启后不保留，采用时需明确后端与持久性。

### 两个 Electron 产物与原生模块版本

当前两个独立 app 目录产物分别带 Electron/Chromium，重复包体需实际核账。没有查到官方保证多个独立 app 共用一个已安装 Electron runtime；不能把自定义目录复用当已验证节省方案，也不能反推两个逻辑入口必须永远是两个安装器。

better-sqlite3 v13 已切到 Node-API，可缓解一些 Node/Electron ABI 耦合；实际 Node-API 版本、平台资产和 SQLite 扩展仍需匹配。既有“两个运行时的产物分别处理”继续是验收责任，不能固化为无论版本都一定复制两份 addon。

### DOCX/PDF 审稿读取仍是实质缺口

已补查 docx-preview 的评论/插入删除呈现，以及 SuperDoc 的 DOCX 评论、修订和 Document API。前者相关功能仍为实验，后者有 AGPLv3/商业许可及需关闭的默认遥测；它们值得先做成品组件对照，避免直接手写 OOXML。Mammoth 的 DOCX→HTML、docx 的生成和 PDF 原生批注读取只解决局部问题。上述候选尚未证明任意审稿文件的类型覆盖，也未解决评论范围到另一版本 QMD 的定位；保留原件并报告支持范围，不能以普通格式转换成功宣称审稿已无损迁入。证据见[阅读写作报告](reuse-landscape-reading-writing.md)。

### 检索与解析的成本不同

SQLite FTS5/向量扩展可以减少独立服务，但没有自动解决中文分词、语义模型、排名、同文献归组和来源定位。Docling/MinerU 的代码许可也不自动覆盖权重、字体、硬件后端和全文权利。需要实际多语言材料对照；不要仅凭“支持中文/公式”就固定完整流水线。

## 开发前最值得验证的接缝

文档调查现在已经足以形成候选；继续泛搜的收益在下降。下列是按风险组织的有界验证，不在本次调查中直接执行，也不是所有业务实现必须先过的硬门禁。

| 优先级 | 验证 | 回答的问题 | 可观察结果 |
| --- | --- | --- | --- |
| 1 | Quarto 可视模块 + CodeMirror + 真稿件 | 固定模块能否独立接入，是否值得维护 | 引用/公式/表格/xref/未知内容的源码↔可视↔保存往返；外部改稿不丢草稿；列出必须覆盖的内部接口 |
| 1 | 阅读器 + 共同材料/批注接口 | viewer 是否可服务人和 Agent 同一来源 | 离线渲染，中英/扫描/双栏定位，GUI 保存后内核读回，重开原件批注往返；缺口是否真需第二个引擎 |
| 1 | LangGraph/Deep Agents + SQLite + 正式决定 | 框架能否服从领域任务与恢复契约 | 重启后待决定事项可查询；重复答复只应用一次；取消与效果未知分别记录；不重放已完成写入 |
| 1 | 独立内核凭据 + Node/Electron 实包 | 开发机之外能否无 GUI 工作 | 各目标平台无预装 Node 也能启动；安全凭据可读取或明确不可用；读取不依赖工作台；包体/空闲资源可测 |
| 2 | FTS5/sqlite-vec 与必要对照 | 中英混合检索是否够用 | 固定相关性样本集，标识符/短词/语义查询分开测；同篇归组、页位置、增量更新、重启持久性与规模成本 |
| 2 | 现有文字层 + Docling 等按需解析 | 哪些材料真的需要重型解析 | 同一材料的文本/表格/公式准确性、页区域来源、冷启动/内存/离线资源；无需解析的原文仍可直接读取 |
| 2 | Zotero 采集/Connector 自有保存接线 | 原构建 vs 新扩展框架哪条维护更小 | 代表站点识别、多结果选择、附件部分失败、快照和官方扩展共存；可定位源码与上游更新面 |
| 2 | 工作台组件组合 vs 必要 Theia 对照 | 成熟平台是否比窄组件更省维护 | 同一内核接线，Agent/PDF/稿件视图，四预设、草稿与布局恢复；比较接线和升级面以及资源占用 |
| 按功能开始时 | 外部审稿导入、图件对象定位、撤销及编译输出保护 | 特定库是否真覆盖产品可观察行为 | 真实样本中的作者/范围/修订、稳定数据键和材料版本、后续编辑保护、失败仍能看最后成功产物 |

验证报告记录通过、失败与未知。没有证据的能力不计入节省；原型失败时首先缩小抽取范围或比较成熟替代，而非为维持最初候选不断增加兼容补丁。

## 哪些仍需自己设计

科研来源与版本、证据和主张、持续任务与交付、正式判断、授权、上下文承接、局部撤销和失败恢复，是 Scholoom 的核心模型。库能提供算法或机制，不能替代这些事实的统一语义。

个人项目应尽量让这些职责的实现也复用已有模式：领域服务校验与保存；统一任务运行时；共同客户端；开放稿件文件；派生索引可重建。避免为每个 UI 组件和外部工具增加一份独立权威或特殊协议。

“复用多少”不按引用的库数或搬入的代码行数评价，而看是否减少手写通用机制、修改点集中、失败可定位、升级可控制，以及用户能否完成真实科研工作。

## 本轮产物与剩余边界

仅新增本总览和七份专题报告，保留已有 PRD、决策票、源码、依赖与未提交改动。现有技术路线没有因本报告自动变更。

报告之间的本地文件链接已检查，候选分组计数与关键来源已抽查；没有运行产品测试，因为本轮没有改变产品实现。网页价格、API 配额、移动分支和依赖版本会变，实际采用前按精确包/发布物复核。

本轮没有证明真实整合工时、科研效果、性能、无障碍或三平台分发可用，也没有完成逐个传递依赖、资源与模型权重的许可清点。这些缺口已绑定到候选与具体接缝，不能由“调研完毕”替代验收。
