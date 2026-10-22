# 约束、质量与后置事项

本文记录宏观设计已经选定的架构、技术路线与工程政策，作为产品约束。精确版本、接口字段、数据库表、部署接线和实现任务由具体规格确定。产品范围见 [PRD 首页](README.md)。

## 已定架构约束

原生领域模块、Agent 调度与任务管理集中在独立 Node 内核，一个内核管理全局文献库及多个项目。Electron main 负责窗口和系统集成，工作台负责呈现与编辑。内核、工作台和兼容宿主保有不同生命周期。

Electron 工作台、CLI 和浏览器开发入口采用共同客户端，经本机 WebSocket 上的双向 JSON-RPC 连接内核。监听限于本机，验证客户端身份，协议 Schema 集中维护，客户端类型从中生成。请求、状态与增量通知、人类介入共用协议。

任务及会话身份独立于连接和请求编号。重连读取当前状态和待处理事项，恢复有界订阅，覆盖读取到接入之间的变化；不预设全量事件回放。多客户端介入答复由内核校验并只应用一次；stdio 按具体需求扩展。

执行统一使用内置 LangGraph／LangChain／Deep Agents，不支持 ACP 外部 Agent 或第三方 harness 接入。harness 消费的 MCP 能力由插件声明、宿主管理配置、生命周期及授权，不提供任意 MCP 服务的独立配置入口；插件可沿原生领域、图和 UI 接口扩展，不强制使用 MCP。插件内部执行的取消、恢复和副作用按其实际契约处理。Scholoom 自身对外提供 MCP 服务已采纳：首批开放获授权的查询，以及提交工作请求、为自发起请求补充信息与请求撤回；支持 stdio 与 Streamable HTTP（含 Tasks 扩展，保留普通工具路径），默认关闭、按外部调用方逐方授权，远程接入须明确配置 HTTPS，复用共同领域权威与内置执行。A2A 本阶段不提供，待出现明确实际对接需求后再增加适配；目标尚未实施，接线与正式契约由后续 OpenSpec 承接。依据 [#07](../../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer)、[对外接口决议](../../.scratch/runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)。

| 执行对象 | 已选分工 |
| --- | --- |
| 原生领域模块、Agent 调度与轻量能力 | Node 内核 |
| 重计算 | Worker，脱离 UI 与调度关键事件循环 |
| 用户 JS／TS 程序及自定义图 | 受管执行进程 |
| Python、命令行工具及需本机启动的插件服务 | 各自受管进程 |
| Zotero 兼容环境 | 独立 Electron 宿主，提供 Node＋Chromium 内部页面和 Workers，由内核监督 |

同一应用数据配置先共用一个兼容宿主，后台插件功能无需打开人类工作台。插件对象和专属缓存留在宿主，文献读写映射到共同文献权威。进程分离用于执行、取消和故障处理，首阶段仍按可信代码运行。

兼容层依据固定 Zotero 10.0.5 源码与接口行为建设共享契约，优先吸纳通用模块，在宿主依赖处适配。对象身份、同步属性、异步行为、数据与 SQL、保存通知、DOM／Worker／IndexedDB、网络及翻译资源等按实际插件需求承接。不能把插件需要的对象全部替换成普通消息投影，就认定原包兼容。

主要依据：[架构](../../.scratch/scholoom-foundations/issues/09-electron-architecture.md#answer)、[宿主路线](../../.scratch/scholoom-foundations/issues/16-zotero-host-prototype.md#answer)。宿主依赖与采集职责调查：[插件宿主能力](../../.scratch/scholoom-foundations/issues/03-zotero-plugin-host-research.md)、[翻译与采集边界](../../.scratch/scholoom-foundations/issues/04-zotero-ingest-research.md)。

## 已定技术路线

| 领域 | 已确认选择 | 保留的约束 |
| --- | --- | --- |
| 自有代码与前端 | TypeScript、React DOM；Agent 通用 UI 使用 assistant-ui，参考 Paseo 组织 | 研究关系、客户端与消息投影由 Scholoom 定义 |
| 科研运行基础 | LangGraph、LangChain、Deep Agents | 分别复用编排恢复、模型工具循环与 harness 基础，原生科研定义共用运行时 |
| 构建与分发 | pnpm workspace、electron-vite、electron-builder | 单仓库、少量内部包，内核和两类 Electron 入口分别构建 |
| 结构化数据 | SQLite、better-sqlite3、Drizzle | 领域 Schema 与 LangGraph SQLite checkpoint 各有职责，迁移审阅后分发 |
| PDF 阅读 | EmbedPDF React 查看器及插件 SDK，v2 稳定路线；PDF.js 备选 | 来源、批注和证据由内核管理，原包 Reader 插件接口独立验收 |
| 源码编辑 | CodeMirror 6，Markdown 模块及 LaTeX stex | 着色不自动提供完整 LaTeX 工程诊断，成熟语言服务按需要接入 |
| QMD／MD 可视编辑 | Quarto 的 ProseMirror／Pandoc 学术编辑模块及适用 UI | 接受固定内部源码模块维护成本，保护未知内容和源文件权威 |
| EPUB／网页快照 | 成组吸纳 Zotero reader DOM 阅读模块和配对 epub.js fork | 固定基线适配位置、批注及资源；独立 epub.js／foliate-js 为替代候选 |
| 图谱 | Graphology、d3-force、Sigma.js v3 稳定路线 | 内核管理事实，库对象用于计算及有界投影，规模和响应需测量 |
| 内核运行环境 | 携带受支持 LTS 的独立 Node 和内核产物 | 用户无需预装 Node，原生模块分别匹配 Node／Electron 及目标平台 |
| 渲染环境 | 携带固定 Quarto、配套 Pandoc 与资源；已有 TeX 或引导 TinyTeX | 支持原工程，准备后离线能力单独验收 |
| Python 环境 | 提供 uv，按工具或项目准备解释器与依赖，支持已有环境 | Conda 等通过指定解释器使用，用户工程不强制改为 uv 项目 |
| e2e | Playwright Test，包含浏览器与真实 Electron | 接受 Electron API 实验性维护风险，WebdriverIO 按接入障碍考虑 |

源码入口为 `apps/kernel`、`apps/desktop`、`apps/zotero-host`，共享协议和客户端在 `packages/protocol` 与 `packages/client`。具体领域包按真实复用需要形成，不预先按全部概念拆包。

科研业务流程由 LangGraph Graph／子图承载，步骤、依赖、分支、必要检查与人工等待进入图。节点复用 Agent、领域工具、程序及必要指导资源；旧 Skill／capability 包按这些职责拆解迁入。能力声明继续表达身份、版本、用途、输入、Graph 引用、资源及交付检查，参数和结构化交付采用 JSON Schema，复杂检查可引用程序检查器；声明不另建流程定义或授予权限。具体依据见[Graph 承载科研业务流程](../../.scratch/domain-development/issues/04-research-methods-scope.md#graph-承载科研业务流程)，不以通用 Agent 图加载完整 Skill 视为业务流程已经接通。

Synthesis 初期采用 TypeScript，吸纳 zotero-agents main 或历史成熟实现，重计算独立执行。旧 Rust 布局与 TS 算法不能据此认定结果坐标相同；当前不整套迁入旧 Rust 应用或维护双语言生产实现。值得保留的 Python 科研工具沿共同受管执行接入。

技术选择确认不代表组件已经完成集成、性能或三平台验收。

Paseo 的 daemon、连接及交互机制以借鉴为主，不整体 fork 或迁入其 provider 体系；Scholoom 保持自有工作台与内核，复用按实际模块边界判断。

依据：[技术栈](../../.scratch/scholoom-foundations/issues/12-technology-stack.md#answer)、[运行基础](../../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md)、[原生内容](../../.scratch/scholoom-foundations/issues/18-native-capability-runtime-and-content.md)、[源码取舍](../../.scratch/scholoom-foundations/issues/19-existing-source-and-rust-reuse.md)、[e2e 方向](../../.scratch/scholoom-foundations/issues/20-ui-debugging-and-e2e-harness.md#answer)。

## 项目关系、许可与维护

Scholoom 是独立长期项目，与 zotero-agents、ResearchSpec 平行。初期吸纳成熟方法与源码，之后独立演进；其他项目可以反向借鉴，投入与同步由用户掌握。产品不承担预建共同内核、共享发布或持续跨仓库同步的责任。

Scholoom 按 AGPL-3.0 开源，实际仓库许可见 [LICENSE](../../LICENSE)。第三方内容保留各自声明，按实际组合和分发核对对应源码、资源及构建要求。带 CC BY-NC 等限制的 ARS-derived 内容不作为默认内置依赖，可选学科和工具扩展尚未确定启用或分发方案。

每次发布锁定实际使用的 Electron、Node、Zotero 10 宿主、插件、translators、Connector 和复用组件基线，记录版本组合与已验收功能。宿主适配和原包不修改政策由 Scholoom 维护；安全升级与生态兼容基线分别推进，验证受影响场景后扩大支持记录。

依据：[项目演进](../../.scratch/scholoom-foundations/issues/08-existing-project-integration.md#answer)、[许可与组件](../../.scratch/scholoom-foundations/issues/12-technology-stack.md#answer)、[源码及内容限制](../../.scratch/scholoom-foundations/issues/19-existing-source-and-rust-reuse.md)、[发布维护](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer)。

## 质量与验收目标

产品通过公开入口完成真实科研任务。以用户原创论文覆盖文献、研究方法与结果、图表、整篇稿件、投稿及修订回复，同时检查无工作台执行、后续接入、补充材料与跨 Agent 承接。外部 Agent 可驱动或评价，不能绕过产品生成预期成果后视为通过。

| 评价方面 | 关注结果 |
| --- | --- |
| 完成效果 | 首次完成、重试与恢复后的完成、实际交付 |
| 科研质量 | 引用与依据正确，分析、论证及产物可用，限制如实表达 |
| 用户摩擦 | 人工纠正、无效确认和需要接管的情况 |
| 持续工作 | 取消、恢复、材料变化和更换 Agent 后能否继续 |
| 执行代价 | 总耗时、可取得用量、内存及必要费用信息 |

客观行为、独立模型评分和人工判断分别展示，首次结果与重试分开，基础设施与产品失败分开，未知不算通过，关键失败不由平均分掩盖。具体样本、指标定义、评分尺度、阈值及重复次数留到真实科研评价票讨论。

确定性 e2e 使用真实内核、文件、数据库及必要兼容宿主，只在外部模型或远程依赖边界提供受控响应；每轮使用独立配置、库、项目和输出，关联场景、运行和各进程诊断。浏览器开发入口复用实际工作台及客户端，preload、原生功能和生命周期在真实 Electron 验证。

性能门槛仅用于确定性动作，例如给定规模下的检索、读取、保存和快照同步，明确硬件、版本、输入与缓存条件。初次测量是基线而非合格证明，结合使用要求确定目标，开发中检查回归、交付前复验。Agent 运行期间输入、浏览和取消受理等确定性响应仍须验收；取消受理与外部工具实际停止分别衡量。

Agent 科研任务的总耗时、用量、调用次数和失败原因用于诊断，不以固定篇数／分钟设置端到端性能基线；成果按科研要求另行验收。数据库访问线程安排与 UI 组件负载能力均为待验证假设，开发中使用真实规模与并行场景测量，交付前复验，必要时调整实现。

恢复验证先在关键提交边界做可重复故障注入，检查实际文件、关系、正式决定和副作用；共同机制集中验证，高影响业务另测恢复。基础路径稳定后按风险补随机故障；杀进程不能等同断电持久性验证。具体场景沿 [#15](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer)。

依据：[全流程验收](../../.scratch/scholoom-foundations/issues/01-first-product-loop.md#answer)、[工程与科研评价原则](../../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md)、[验证发布](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer)、[真实接线](../../.scratch/scholoom-foundations/issues/20-ui-debugging-and-e2e-harness.md#answer)。

## 工程与文档纪律

用户负责产品目标、体验、领域语义和核心架构选择，Agent 在明确授权内完成调查、实现和验证。事实与方法复用沿当前证据核对，核心方向改变回到讨论。

目录和命名表达领域职责，共享概念有单一来源。模块保持清楚边界，复用标准库和成熟方案，减少重复、隐藏耦合和特殊分支，不规定一实体一目录或机械文件行数上限。

PRD 维护宏观产品设计；地图与票保留选择、理由和证据；CONTEXT.md 定义术语；AGENTS.md 记录执行约定；OpenSpec 承接具体功能行为与变更；开发说明反映真实工具链和入口，代码与测试反映实际实现。已有决策理由充分时引用原票，ADR 只记录值得独立说明的少量取舍。

验证按影响范围开展：局部修改使用受影响检查，跨模块或进程增加真实接线，协议、存储和核心运行时扩大数据保护与生命周期检查。测试覆盖稳定行为和实际风险，不为覆盖率、文案或形式机械增加测试。未验证、失败或草图成功的情况准确说明。

依据：[工程纪律](../../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md)、[验证范围](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer)。

## 发布与更新要求

开发构建用于迭代，预览版明确验收过的功能、平台和限制，使用隔离样本验证。稳定版需要完整科研流程及真实科研效果通过；首个稳定版完成 Windows、macOS、Linux 三平台实际分发包验收，Linux 作为主要开发和日用验证平台。

每个声称支持的系统检查实际安装后启动、独立 Node 和原生模块、兼容宿主、路径、阅读渲染工具及关键生命周期。构建成功不代替分发包验收；具体系统版本、CPU 架构、签名、公证和安装格式按实际发布条件落实，凭据及费用另行授权。

[SSH 远程部署](../../.scratch/runtime-architecture/issues/05-local-and-remote-deployment.md#answer)以 Windows／macOS／Linux 为目标，优先验证 Linux。远端核心支持无桌面服务器，插件的依赖与显示条件分别验收，局部不可用不阻止其他工作。发布验证包含真实远端用户目录安装、目标运行包、下载失败后的本机传包、受限网络、断线草稿及未知请求核查、共享内核的择时升级；本机通过不代表远端已通过，运行组件可取得也不代表所有科研依赖可离线使用。

Schema 升级、迁入和批量高影响变更先在副本或样本核对结果及恢复，保护源材料和必要备份，检查用户编辑及关联。备份实际恢复后核验，应用回退与数据恢复分别处理，保护升级后的新成果。

优先通过 GitHub Releases 提供版本、包、支持范围和限制。早期预览版手动下载安装更新，保留研究数据；自动更新以后按需要使用现成 electron-updater 链路，保留手动入口。更新在用户选择时机保存编辑、等待或暂停受影响任务，协调内核和宿主停止再升级；不能仅凭窗口关闭认定后台已经停止。

依据：[发布政策](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer)。

## 后置与待验证事项

当前设计排除一切依赖持续精确原文定位的功能，具体范围见 [#44](../../.scratch/scholoom-foundations/issues/44-defer-continuous-precise-source-location.md)。这不是待实现验收的承诺；以下阅读、审阅和预览验证不包含跨内容变化的自动重定位或持续位置跟踪。

| 事项 | 当前范围与责任 |
| --- | --- |
| 原生交互式科研界面 | [#45](../../.scratch/scholoom-foundations/issues/45-interactive-research-reports.md)已确认一等原生接口与迁入工作流共同接入方向；动作回传、运行隔离、资源访问及更新方式待细化，双宿主及迁入工作流的真实体验待验证 |
| QMD／LaTeX 实时预览体验 | 布局、刷新体验和性能门槛继续由[预览票](../../.scratch/scholoom-foundations/issues/39-writing-live-preview.md)后置讨论；票保持 open |
| 真实科研评价细则 | 功能初步实现后在[科研 Agent 验收票](../../.scratch/scholoom-foundations/issues/21-agent-dogfooding-and-evaluation.md)确定样本和指标；草案未采纳，不阻塞当前宏观设计 |
| 新科研场景 | 依[场景覆盖决定](../../.scratch/scholoom-foundations/issues/30-research-scenario-coverage.md#answer)，实际遇到时补充；不预先承诺所有未来功能 |
| 检索、解析和自动维护 | 内容可读性、召回质量、增量正确性、恢复、质量和性能尚需实际验收，依据[知识票](../../.scratch/scholoom-foundations/issues/33-layered-literature-knowledge.md#answer)与[维护票](../../.scratch/scholoom-foundations/issues/34-analysis-synthesis-maintenance.md#answer) |
| 工作台与多模型体验 | 真正 Agent 定位、科研修改、审阅独立性、advisor 时机与停止、撤销通知、语义保持及人工体验待验证，依据[工件票](../../.scratch/scholoom-foundations/issues/38-workbench-artifact-interaction.md#answer)与[协作票](../../.scratch/scholoom-foundations/issues/37-multi-model-research-collaboration.md#answer) |
| 兼容和迁入 | Connector 独立构建、共存、BBT 对外功能、茉莉花真实在线和阅读写回、真实迁入及恢复尚待验收，依据[生态接入票](../../.scratch/scholoom-foundations/issues/41-zotero-ecosystem-integration.md#answer) |
| 运行与分发 | 后台内核、环境供给、原生模块、三平台取消恢复、工具离线及更新仍需真实接线和分发验收，依据[架构](../../.scratch/scholoom-foundations/issues/09-electron-architecture.md#answer)、[执行](../../.scratch/scholoom-foundations/issues/40-research-execution-environment.md#answer)与[发布](../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#answer) |
| 更强安全隔离、可选扩展与长期平台 | 若实际需要再讨论范围；当前没有新增强隔离、任意插件或云同步等承诺 |

预览已有本机 Quarto／latexmk 编译、刷新与定位实验，发现单文档 `.bib` 变化未刷新、编译失败可能删除输出，以及 `--no-execute` 仍运行 pre-render hook 等边界。它们支持设计核对，不能当作产品延迟承诺或全部行为已经定案。

宿主原型运行过部分 BBT 和茉莉花链路，合成元数据和完整 Zotero 参考宿主的成功仅按各自范围保留。独立产品宿主的全部重点功能、原包特定失败分支和真实在线路径仍需验收。生产兼容宿主当前只是工程骨架。

完整科研情境的宏观语义走查已经确认，详见[跨模块走查](../../.scratch/scholoom-foundations/issues/42-cross-module-research-walkthrough.md#answer)。这些决定为后续工作提供依据，具体实现路线和功能规格不在本 PRD 中展开。
