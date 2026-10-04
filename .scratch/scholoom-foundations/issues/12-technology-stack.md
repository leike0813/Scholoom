# 选择技术栈、仓库结构与最小工具链

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话 Codex；与用户讨论技术栈、组件及工具链（2026-10-04）
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 09, 11, 13

## Question

在 Electron、领域和进程边界、存储职责及编辑路线已经明确后，采用什么语言、前端框架、构建与包管理、数据库接入和编辑组件，仓库如何组织才能方便单人维护与 Agent 协作？

[既有源码与 Rust 的复用取舍](19-existing-source-and-rust-reuse.md)已确认 Synthesis 先采用 TypeScript，重计算独立执行，main 与历史实现可作来源；不整体迁入 Rust 子系统。Python 按工具价值接入，环境分发沿本票 Q12，Rust 可按具体算法收益后续评估。本票选择相应工具链、图库、执行环境与分发，核对旧依赖在新宿主中的实际适用性。

比较真实需要的成熟方案，明确共享契约和测试入口，核查原生依赖与目标平台打包约束。模块职责不自动等于独立发布包；优先少量清楚的模块与工具。选型需注明依据和可替换成本，不能把 references 中使用的技术直接视为本项目选择。本票不安装依赖或初始化应用。

遵循[工程纪律](14-agent-development-discipline.md)中用户对代码组织的要求：目录、文件和符号具有自明性，使用已确认领域语言；索引与查询沿用 CodeGraph、OpenViking 和 ripgrep，不另建索引工具链。本票根据已选进程与框架落实具体目录和接口位置，并为后续 Orca UI 调试与 e2e 保留实际可验证的入口。

核查拟复用组件的许可证并确定 Scholoom 自身许可与分发边界。[阅读与批注调查](../research/reading-and-annotation-boundaries.md)已核实 Zotero reader 与 note-editor 声明 AGPL-3.0；[既有源码取舍](19-existing-source-and-rust-reuse.md)也记录了受限第三方内容边界。组件具备技术接入条件，不自动等于已经明确分发方式。

阅读组件独立选型，不预设复用 Zotero reader。[现代阅读组件调查](../research/modern-reader-components.md)提供 PDF.js、EmbedPDF、React-PDF、EPUB 组件及商业 SDK 的资料入口；用 Scholoom 的真实阅读、批注、证据定位、Agent 操作和原包插件需求比较候选，并验证 Electron 离线打包与代表性论文表现。组件自带插件机制与 Zotero 原包插件兼容分别验收。

## Answer

2026-10-04 用户分轮确认 Q1–Q14，本票已解决。以下汇总正式选择及后续承接；Comments 保留各轮讨论时的建议和状态。调查支持选型方向，组件集成、性能和跨平台分发仍需实现验收。

### 项目许可（Q1）

Scholoom 采用 AGPL-3.0 开源。第三方代码与资源保留各自声明，拟复用内容及实际组合分发方式逐项核对。

### 自有语言、工作台前端与 Agent 面板（Q2）

自有应用代码采用 TypeScript，工作台使用 React DOM；Agent 通用交互采用 assistant-ui 的 ExternalStoreRuntime 和现成消息、输入、附件、工具及审批组件，通过适配层接入 #09 的共同内核客户端。

工作台参考 Paseo 的面板组织与体验，服从 #10 已确认的布局。应用源码按具体模块吸纳；实际复用模块、接入边界和调查依据见 [Agent 面板复用调查](../research/agent-ui-reuse-evaluation.md)。文献、证据、研究任务／Agent／会话关系及内核消息投影由 Scholoom 定义；审批恢复与有界历史读取继续按既有契约实现和验收。

本次选择确定接入方向，未完成组件移植、运行或性能验证。构建与打包沿下方 Q4。

### 主要开发与日用验证平台（Q3）

以 Linux 为主要开发与日用验证平台；从开发开始维护 Windows、macOS、Linux 构建，首个稳定版本完成三平台验收。

### 构建、包管理与打包（Q4）

采用 pnpm 管理依赖与工作区；Electron main／preload／React 界面使用 electron-vite，独立 Node 内核保留自己的构建与运行入口。采用 electron-builder 制作桌面分发包，工作台与兼容宿主分别配置入口与产物。

独立 Node 的携带方式沿 Q10；具体版本、原生依赖和多进程产物接线仍需核对。工具选型不代表三平台打包已经验证。

### 仓库组织（Q5）

单仓库、pnpm workspace、少量内部包：

- `apps/kernel`：独立内核。
- `apps/desktop`：Electron 工作台。
- `apps/zotero-host`：兼容宿主。
- `packages/protocol`：共享 Schema／DTO 的唯一事实源。
- `packages/client`：共同内核客户端。

领域功能在各应用内部按自明名称组织；根据实际跨应用复用或独立依赖需要再提取包。复用源码保留来源基线与声明。首阶段构建由包管理脚本承接；具体运行入口与共享契约位置按上述目录落实。当前未初始化这些包或目录。

### 数据库与接入库（Q6）

全局文献库与项目本地结构化事实使用 SQLite，独立 Node 内核通过 better-sqlite3＋Drizzle 接入。TypeScript Schema 定义本项目当前表结构，生成并审阅 SQL 迁移后随应用分发；领域事实按 #13 的权威归属保存。

LangGraph 执行恢复优先复用官方 SQLite saver，其 checkpoint 表及序列化规则与本项目领域 Schema 各有职责。具体数据库文件布局、连接、运行时版本与迁移接线随实现规格核对。三平台原生模块加载、备份、恢复和调度响应仍需验收。依据见 [Node SQLite 接入调查](../research/sqlite-node-integration-selection.md)。

### PDF 阅读组件（Q7）

以 EmbedPDF React 查看器及插件 SDK 为首选集成方向，使用官方推荐的 v2 稳定路线，复用显示、搜索、选区、高亮、批注和导出能力，按工作台需要调整界面。PDF.js 保留为备选。

材料身份、批注、证据关系由科研内核管理，Agent 无窗口读取通过材料服务实现；SDK 的 headless 名称不替代这一要求。多栏和扫描论文、跨页选区、批注往返及完全离线资源仍需实现验收；具体稳定版本届时核对。Zotero 原 Reader 插件所需接口独立验收。依据见 [现代阅读组件调查](../research/modern-reader-components.md)。

### 源码编辑器（Q8）

QMD／MD／LaTeX 统一采用 CodeMirror 6，复用 Markdown 语言模块及 LaTeX 的 stex stream mode。React 宿主负责编辑器生命周期和文稿接线；QMD 扩展语法与科研补全按实际需要接入。

stex 提供语法着色，LaTeX 工程诊断、引用补全与导航后续优先接入成熟语言服务。此选择依据模块组合与 Quarto 既有接入，没有性能或体积实测。事实依据见 [源码编辑器核对](../research/source-editor-integration-facts.md)。

### 可视编辑器（Q9）

QMD／MD 吸纳 Quarto 的 ProseMirror／Pandoc 学术编辑模块和适用 UI，复用公式、引文、交叉引用、表格、图像与转换实现。宿主接口接入本项目内核的文稿、资源、文献及受管 Pandoc 服务；源文件保持正文权威，LaTeX 沿源码＋编译 PDF。

接受固定上游内部源码模块的抽取和升级维护成本，保留来源与声明。写回允许格式规范化，无法表示的内容必须保留并提供源码入口；切换和保存不能丢失未识别内容。依据见 [Quarto 宿主与复用边界](../research/quarto-visual-editor-host-boundaries.md)。独立构建、内容往返、外部编辑保护、长文性能与离线分发尚未运行验收。

### 内核运行时分发（Q10）

随应用携带固定、受支持 LTS 的独立 Node 二进制和内核产物，GUI／CLI 共用该入口，用户无需预装 Node。内核原生模块按此 Node 与目标平台准备，Electron 宿主所需原生产物单独处理。

接受额外包体与平台维护成本，版本、启动路径和升级接线随实现规格落实。生命周期继续按 #09；此选择尚未完成三平台打包验收。依据见 [Node／Quarto 分发事实](../research/node-quarto-runtime-distribution-facts.md)。

### 渲染工具分发（Q11）

随应用携带固定稳定版 Quarto CLI 及其配套 Pandoc 和资源，QMD 渲染、引用及导出复用现成链路；编辑器转换与 Pandoc／Lua 资源配对验收。

LaTeX 使用已有 TeX 环境或应用引导准备的 TinyTeX，保留用户多文件工程和编译配置。首次准备与缺失宏包处理可需联网，完整准备后的断网行为单独验收。科研代码和工程脚本的执行沿既有授权与共同内核记录。依据见 [Node／Quarto 分发事实](../research/node-quarto-runtime-distribution-facts.md)，目前没有渲染或离线实测。

### Python 接入（Q12）

随应用提供 uv 作为环境准备工具，Python 解释器与依赖按具体工具／项目需要准备；支持用户指定已有 Python／环境，也可由 uv 准备隔离环境。应用自带工具保留受支持版本和依赖锁定，用户工程沿自身环境声明；已有 Conda 等环境通过显式解释器接入。

Python 沿共同受管执行契约调用。锁文件不覆盖系统库，首次获取依赖与完整准备后的离线执行分别处理和验收。依据见 [Python／uv 事实](../research/python-uv-runtime-distribution-facts.md)，目前未安装或运行验证。

### 图谱计算与显示（Q13）

采用 Graphology 的图结构和按需算法模块，布局先复用既有 TS force／radial／components 实现，force 使用 d3-force；计算按 #09 进入 Worker。引用／概念网络显示采用 Sigma.js v3 稳定路线。

科研图谱 DTO 与事实由内核定义，库对象用于计算内部表示和有界界面投影。筛选、中文标签、复杂边、计算取消及交互响应按真实样本验收；与旧 Rust ForceAtlas2 的坐标不承诺相同。依据见 [图谱组件事实](../research/graph-compute-and-rendering-facts.md)，目前没有新执行环境的性能实测。

### EPUB 与网页快照阅读（Q14）

成组吸纳 Zotero reader 的 DOM 阅读、EPUB／snapshot 视图、搜索、位置映射和适用批注 UI；EPUB 使用配对的 epub.js fork，沿固定 reader 源码基线核对依赖。web 入口作为接入参考，界面运行于 Scholoom 工作台，资源、批注、阅读状态和证据关系经宿主适配接入共同内核。

接受内部模块抽取、SDT／样式／构建资源适配和维护成本。Agent 独立读取沿内核材料服务，CFI／selector 与实际材料版本绑定。epub.js 和 foliate-js 独立库保留为替代候选。依据见 [EPUB／网页源码事实](../research/epub-web-reader-reuse-facts.md)及 [reader 宿主回调](../research/reading-and-annotation-boundaries.md)，目前尚无可移植构建或阅读往返实测。PDF 沿 Q7 的 EmbedPDF 路线。

### 实现规格与验证承接

共享 Schema／DTO 的唯一事实源位于 `packages/protocol`，参数和结构化交付沿 #18 的 JSON Schema 要求。具体方言、生成与校验工具、UI 状态／样式／表格辅助库、精确版本和脚本配置在实现规格按实际接入选择，并记录来源与替换成本。

开发入口采用 electron-vite 的客户端工作台和共同内核客户端，Node 内核可独立运行；类型检查、构建、稳定行为测试与诊断提供可单独运行的包脚本。仓库目录、脚本和测试入口目前尚未初始化。

- [#20 UI 调试与 Electron e2e](20-ui-debugging-and-e2e-harness.md)：落实实际浏览器开发入口、Electron 原生行为验证和 e2e 框架。
- [#21 真实科研 Agent 验收](21-agent-dogfooding-and-evaluation.md)：落实真实研究任务和量化评价。
- [#15 验证与跨平台发布纪律](15-validation-and-release-discipline.md)：组合必要检查，落实组件、原生依赖、迁移恢复、插件兼容和三平台发布验收。

本票完成基础选型；完整科研链路继续按已确认产品范围实现，组件支持与分发承诺以实际验收为准。实现规划仍由用户决定启动时机。

## Comments

2026-10-04 用户要求继续下一票，本票已领取；#09、#11、#13 均已 resolved。沿用独立 Node 内核、Electron 工作台及兼容宿主、双向 JSON-RPC＋本地 WebSocket、TypeScript 科研 harness、开放文件与文献／项目数据库，以及 QMD／MD／LaTeX 原生稿件路线。仅讨论选型，不安装依赖、初始化应用或启动实现规划。

第一轮建议（待确认）：

- Q1 项目许可：建议 Scholoom 采用 AGPL-3.0 开源，适配已经计划的 Zotero 源码复用方向；第三方代码和资源仍保留各自声明，逐项核对拟纳入内容及实际组合分发方式。若用户希望项目采用 MIT／Apache 等宽松许可，先重新评估相关源码与组件的纳入方式，不将换语言或分进程视为自动解决许可条件。
- Q2 前端与语言：建议自有应用代码统一 TypeScript，工作台使用 React，由 Vite 构建客户端界面；Electron 与浏览器开发入口复用同一工作台代码和共同内核客户端。Electron main／preload、独立 Node 内核及兼容宿主使用各自运行入口；构建和打包的具体工具后续选择。界面状态和数据访问使用成熟方案，具体库随后续选型，不另建应用级前端框架。
- Q3 日用验证平台：三平台从开发开始维护构建、首个稳定版本完成验收的要求沿 #01 保留。当前工作区在 Linux，建议先将 Linux 作为主要开发平台；用户日常科研使用的平台需要确认，主日用验证平台以其答复为准。

本轮官方依据：[Zotero 10.0.5 COPYING](https://raw.githubusercontent.com/zotero/zotero/10.0.5/COPYING) 声明源码采用 AGPLv3；[React 客户端构建说明](https://react.dev/learn/build-a-react-app-from-scratch) 给出 Vite＋React TypeScript 入口，同时指出路由、数据访问等应用功能需成熟方案承接；[Vite 文档](https://vite.dev/guide/) 提供 React／TypeScript 模板与客户端构建能力。本轮只核对声明与工具职责，没有认定整个应用分发的许可条件已处理完毕，也未选择依赖版本或验证组件集成。

2026-10-04 用户确认 Q1／Q3，并要求 Q2 先调查开源模块复用：尽可能采用已有实现，Agent 交互面板为重点候选，明确提出 [Paseo](https://github.com/getpaseo/paseo) 的 UI 值得参考。原 TypeScript＋React＋Vite 建议尚未采纳；先核对候选真实技术栈、模块接口、后端耦合、许可和接入共同内核的改造范围，再讨论前端选型。源码事实调查可委派，宏观判断由主 Agent 与用户讨论。

2026-10-04 完成 [Agent 面板开源模块复用调查](../research/agent-ui-reuse-evaluation.md)，固定源码比较 Paseo、assistant-ui、Nimbalyst、AionUi 和 OpenCode。Q2 修订建议（待确认）：自有代码采用 TypeScript，工作台采用 React DOM，以 assistant-ui 的 ExternalStoreRuntime 和现成消息／输入／附件／工具／审批组件为通用交互底座，按 Paseo 面板组织调整体验；应用源码按具体模块吸纳。Scholoom 的共同客户端、消息投影、科研关系、审批恢复和有界历史读取仍由本项目负责。备选为接受 RN Web 技术链并成组迁入 Paseo 面板；不要求内核模拟其整个 daemon。Vite 仍为构建候选，其他工具链与组件未定。仅做静态源码与官方资料核对，未完成移植、运行或性能验收；本票保持 claimed。

2026-10-04 用户回复“同意”，采纳 Q2 修订方向：TypeScript＋React DOM，以 assistant-ui 为通用交互底座，参考 Paseo 的工作台组织，按具体模块吸纳其他应用源码。正式范围见上方已确认选择；其他工具链和组件继续讨论，本票保持 claimed。

下一轮建议（Q4／Q5 待确认）：

- Q4 构建、包管理与打包：采用 pnpm；Electron 的 main／preload／React 界面使用 electron-vite（包含 Vite 客户端构建），独立 Node 内核保留自己的构建和运行入口；electron-builder 负责桌面分发，工作台与兼容宿主分别配置入口与产物。具体版本和 Node 运行时携带方式后续核对，不以选择打包工具认定多进程分发、原生模块或三平台构建已验证。
- Q5 仓库组织：单仓库、pnpm workspace、少量内部包。候选目录 `apps/kernel`、`apps/desktop`、`apps/zotero-host` 承载三个运行入口；`packages/protocol` 集中共享 schema／DTO，`packages/client` 提供共同客户端。领域功能分别在内核及工作台内部按自明名称组织，新增内部包以实际跨入口复用或独立依赖需要为依据。应用源码复用保留来源基线与声明；包管理脚本承接首阶段构建，不预设额外仓库编排系统。目录和依赖划分尚未初始化。

官方依据：[pnpm workspace](https://pnpm.io/workspaces)提供单仓库多包与共同锁文件；[electron-vite](https://electron-vite.org/guide/)统一 Electron main／preload／renderer 的构建配置；其[生产构建说明](https://electron-vite.org/guide/build)区分编译输出与安装包制作；[electron-builder](https://www.electron.build/)提供三平台桌面分发工具。以上只核对工具职责，尚未安装、构建或打包。阅读／编辑、数据库访问与科研工具分发仍需候选事实核对后选择；测试及发布纪律由 #15 进一步落实。

2026-10-04 用户回复“采纳”，确认 Q4 构建／包管理／打包工具和 Q5 单仓库组织。正式选择见上方；数据库、阅读／编辑组件及运行时分发继续讨论，本票保持 claimed。

下一轮建议（Q6／Q7 待确认）：

- Q6 数据库及接入：全局文献库与项目本地结构化事实采用 SQLite，内核使用 better-sqlite3＋Drizzle；当前表结构以 TypeScript Schema 定义，生成并审阅 SQL 迁移随应用分发。LangGraph 执行恢复优先采用官方 SQLite saver，按各自职责管理表结构，领域事实保持本项目权威。具体连接／文件布局和运行时版本后续核对。见 [Node SQLite 接入依据](../research/sqlite-node-integration-selection.md)。原生模块加载、备份、恢复和调度响应尚未实测。
- Q7 PDF 阅读组件：以 EmbedPDF 的 React 查看器／插件 SDK 为首选集成候选，复用现成显示、搜索、选区、高亮批注和导出，按工作台需要调整 UI；内核保持材料、批注和证据权威，Agent 无窗口读取沿材料服务实现。PDF.js 保留为备选底层；不预设从 PDF.js 自建整套 UI，也不因阅读选型自动获得 Zotero Reader 插件兼容。固定版本需核对稳定发布，并在实现中验收多栏／扫描论文、跨页选区、批注往返和离线资源。已有 [现代阅读组件调查](../research/modern-reader-components.md)给出依据；本轮再次核对官方 React selection／annotation／export 文档与根许可，仍无运行证据。

编辑组件已有 [初步复用事实](../research/source-and-visual-editor-reuse-facts.md)：找到 Quarto 内部 editor／editor-codemirror 模块及 Pandoc AST 转换源码；公开宿主接口、许可适用范围和源码／可视共稿边界仍待核对，本轮不据此选择编辑组件。科研工具及 Node／Python／渲染环境分发、其他必要库和验证工具仍需讨论。上述选型建议不启动实现规划。

2026-10-04 用户回复“采纳”，确认 Q6 SQLite＋better-sqlite3＋Drizzle 及官方 SQLite saver 方向、Q7 EmbedPDF v2 稳定路线。正式范围见上方；源码／可视编辑器及剩余选型继续讨论，本票保持 claimed。

下一轮建议（Q8／Q9 待确认）：

- Q8 源码编辑器：QMD／MD／LaTeX 统一采用 CodeMirror 6。复用 Markdown 语言模块及 LaTeX 的 stex stream mode，React 宿主负责实例生命周期和文稿接线；QMD 的扩展语法与科研补全按实际需要接入。stex 提供着色，不代表已有 LaTeX 工程诊断、引文语义或导航；这些能力后续优先复用语言服务。选择依据是可组合的语言模块和 Quarto 已有 CodeMirror 接入，未测性能，不以未经测量的体积或速度比较排除 Monaco。见 [源码编辑器事实核对](../research/source-editor-integration-facts.md)。
- Q9 可视编辑器：QMD／MD 优先吸纳 Quarto 的 ProseMirror／Pandoc 学术编辑模块和适用 UI，复用已有公式、引文、交叉引用、表格、图像和转换实现。通过宿主接口接入本项目内核的文稿、资源、文献与受管 Pandoc 服务；保留源文件权威，LaTeX 沿源码＋编译 PDF。接受固定私有源码模块的抽取和升级维护成本。上游写回可能规范化格式；不支持内容必须保留并提供源码入口，禁止未识别内容在切换或保存时丢失。见 [Quarto 宿主与复用边界](../research/quarto-visual-editor-host-boundaries.md)。

两项均为源码和资料支持的接入方向，尚未构建或运行验证。独立集成、内容往返、外部编辑保护、长文性能和离线分发由后续实现规格验收；本轮不启动原型或实现。剩余必要组件、执行工具和运行时分发继续收敛。

2026-10-04 用户回复“采纳”，确认 Q8 CodeMirror 6 源码编辑及 Q9 Quarto 学术可视编辑模块复用。正式范围见上方；剩余组件与运行时分发继续讨论，本票保持 claimed。

下一轮建议（Q10／Q11／Q12 待确认）：

- Q10 内核运行时分发：随应用携带固定、受支持 LTS 的独立 Node 二进制与内核产物，GUI／CLI 共用该入口。用户无需预装 Node；内核原生模块按该 Node 和目标平台准备，Electron 宿主所需原生产物单独处理。选择接受额外包体与平台维护成本。具体版本、启动路径与升级接线留给实现规格，不改动 #09 的生命周期契约。
- Q11 渲染工具分发：随应用携带固定稳定版 Quarto CLI 及其配套 Pandoc 和资源，QMD 渲染、引用及导出优先复用现成链路；编辑器转换与 Pandoc／Lua 资源配对验收。LaTeX 默认通过已有 TeX 环境或应用引导准备的 TinyTeX 提供编译，首次准备与缺失宏包处理可需联网，完整准备后的断网行为单独验收。支持用户已有多文件工程和编译配置，不把按需环境准备等同于延后 LaTeX 能力。科研代码与工程脚本的执行沿既有授权与共同内核记录。
- Q12 Python 接入：随应用提供 uv 作为环境准备工具，Python 解释器和依赖按具体工具／项目需要准备，不默认将所有科研库装进桌面包；支持用户指定已有 Python／环境，也可由 uv 准备隔离环境。应用自带工具保留受支持版本与依赖锁定，用户工程沿自身环境声明，不强制迁成 uv 项目。已有 Conda 或其他环境通过显式解释器接入，不由 uv 接管。外部 Python 仍通过共同受管执行契约调用；锁文件不覆盖系统库。首次获取依赖和离线执行明确区分。

依据：[Node／Quarto 分发事实](../research/node-quarto-runtime-distribution-facts.md)、[Python／uv 事实](../research/python-uv-runtime-distribution-facts.md)。本轮只核对官方能力和分发边界，未安装、打包或运行。上述建议尚未确认为正式选择；剩余必要组件与验证工具继续在本票收敛。

2026-10-04 用户回复“采纳”，确认 Q10 携带独立 Node、Q11 内置 Quarto 与按需 TeX、Q12 uv 和按工具／项目准备 Python 环境。正式范围见上方；图谱与 EPUB／网页阅读组件继续收敛，测试框架及验收纪律由 #20／#15 承接，本票保持 claimed。

最后一轮组件建议（Q13／Q14 待确认）：

- Q13 图谱：采用 Graphology 的图结构及按需算法模块；布局先复用既有 TS force／radial／components，实现中的 force 使用 d3-force，计算沿 #09 进入 Worker；引用／概念网络显示采用 Sigma.js v3 稳定路线。科研图谱 DTO 与事实仍由内核定义，库对象只作计算内部表示和有界界面投影。筛选、中文标签、复杂边与响应性能按真实样本验收；不承诺与旧 Rust ForceAtlas2 相同坐标，不以 WebGL 名称承诺规模。见 [图谱组件事实](../research/graph-compute-and-rendering-facts.md)。
- Q14 EPUB／网页快照：优先成组吸纳 Zotero reader 的 DOM 阅读、EPUB／snapshot 视图、搜索、位置映射与适用批注 UI；EPUB 使用其配对的 epub.js fork，沿固定 reader 源码基线一起核对依赖。web 入口作为接入参考，资源、批注、阅读状态和证据关系经宿主适配接到 Scholoom 共同内核，界面直接运行于本项目工作台。接受内部模块抽取、SDT／样式／构建资源适配和维护成本。Agent 独立读取沿内核材料服务，CFI／selector 与实际材料版本绑定。epub.js 和 foliate-js 独立库保留为替代候选；当前只做静态调查，尚无可移植构建和阅读往返实测。见 [EPUB／网页源码事实](../research/epub-web-reader-reuse-facts.md)及 [reader 宿主回调](../research/reading-and-annotation-boundaries.md)。

本票建议以此结束基础组件选型。共享 Schema／DTO 的唯一事实源和 JSON Schema 参数／交付要求沿 #09／#18／Q5；具体方言、生成与校验工具、UI 状态／样式／表格辅助库、精确版本及脚本配置在实现规格按实际接入选择，并记录来源与替换成本。开发入口沿 electron-vite 客户端工作台＋共同内核客户端，Node 内核可独立运行；类型、构建、稳定行为测试与诊断提供可单独运行的包脚本，具体检查组合由 #15 落实，UI／Electron e2e 框架由 #20 选择，真实科研 Agent 验收由 #21 承接。尚未建目录、脚本或测试入口。本段明确后续职责，不缩减已确认的科研全流程或把未验收能力视为可用；确认后汇总本票 Answer，当前保持 claimed。

2026-10-04 用户回复“采纳”，确认 Q13 Graphology／d3-force／Sigma.js 图谱方案与 Q14 Zotero reader EPUB／网页模块复用。本票已汇总 Q1–Q14 和后续承接，设置 resolved；本次仅更新决策文档，未安装依赖、初始化应用或执行打包。后续可讨论 #20，#21 亦已具备前置条件；#15 等待二者解决。
