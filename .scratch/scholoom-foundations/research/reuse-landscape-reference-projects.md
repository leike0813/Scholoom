# 可借鉴项目与源码复用范围

调查日期：2026-10-11。服务于业务开发前的复用调查；语言方向维持 TypeScript、React、Electron。本文核对官方仓库、源码、许可及项目文档，不代表运行、性能或移植验收。推荐是本轮工程判断，尚未替代已确认选型。

## 如何阅读

一个完整产品可以提供三种不同收益：直接消费其公开模块；抽取带依赖的源码；借鉴已处理过的交互和失败情境。不能把“开源且功能类似”视为安装后即可接入。

本文的维护成本是基于可见依赖和接口的定性判断，没有测量实际移植工时。根 LICENSE 不覆盖所有第三方模块、字体、模板或服务条款；实际纳入时仍按代码路径核对。

| 项目 | 最值得借鉴的部分 | 复用形态 | 本轮判断 |
| --- | --- | --- | --- |
| Zotero、Reader、Connector、translators | 文献采集、阅读位置、插件对象语义、题录与附件处理 | 固定基线源码和资源；兼容宿主适配 | 核心生态来源，继续既定方向 |
| zotero-agents、ResearchSpec | 科研方法、分析与综合、审阅和研究承接 | 已有源码及内容按新契约吸纳 | 领域复用优先级高于再造一套方法 |
| Nimbalyst | 对象选区上下文、工件编辑、修改查看、多 Agent 工作导航 | 小模块源码与交互参考 | 最贴近科研工件工作台，避免整迁 runtime |
| Paseo | 后台 Agent 与客户端分离、消息历史、会话和产物导航 | 交互参考，个别模块源码 | 保留体验参考；React Native Web 不直接等于 React DOM |
| Zettlr | CodeMirror 学术引用补全、文献库刷新、Pandoc 导出 | CodeMirror 扩展和纯逻辑候选 | 新增重点源码候选，优先于手写学术编辑细节 |
| JupyterLab | 文档模型与视图分离、工件 MIME renderer、运行状态与输出 | 架构参考；公开包按需接入 | 科研执行展示有价值，不默认携带整个 Jupyter 服务 |
| Joplin | 本地 SQLite、文件附件、历史、导入和可信内容呈现 | 失败情境与实现参考 | 数据保护参考优先；不照搬其正文权威和同步系统 |
| Paperlib | 无 DOI 会议论文元数据、多来源补全、文献整理和引用操作 | 模块源码与交互参考 | 针对文献获取缺口调查，不作为整个应用底座 |
| Cherry Studio | 桌面多模型配置、材料摄取、原生依赖打包 | 配置/集成参考和窄模块源码 | 适合检查踩坑，通用聊天知识库不能代替科研系统 |
| Eclipse Theia | 工作台、文件树、命令、快捷键、面板、语言服务 | 可组成自有产品的公开平台模块 | 值得独立比较的平台候选；采用意味着重开工作台底座选择 |
| Code OSS / VS Code | 工作副本、编辑器生命周期、变更审查、扩展宿主 | 设计和窄模块参考 | 不建议直接维护整仓 fork；Monaco 不是完整工作台 |
| PaperQA2 | 证据检索、引用支撑回答、元数据核对、评价方法 | 方法参考；可选受管 Python 能力 | 不作为另一套检索与科研权威 |
| STORM / Co-STORM | 多视角提问、检索驱动提纲、协作知识整理 | 方法和实验对照参考 | 报告生成可借鉴；不等于完整科研或持续任务系统 |
| Open Notebook | 来源、笔记、分析与带引用问答的组织 | 产品交互和方法参考 | 不引入 Python/SurrealDB 整套后台作为默认底座 |
| AnythingLLM | 材料摄取进展、provider 设置、来源引用与工作区 | 交互和集成参考 | 桌面使用体验值得看，不迁入其完整 RAG 后台 |
| Dify | 工作流运行诊断、模型配置与知识库管理 | 设计参考；SDK 另核许可 | 不采用其完整平台，不将根许可写成纯 Apache-2.0 |

## 1. Zotero 与已有科研项目：优先取已有领域经验

Zotero 的价值不只在 UI，而在 translators、Connector、文献对象及阅读位置行为。Scholoom 已经选择固定 Zotero 10.0.5 基线的兼容层；本轮看到的上游 main 更新不能自动升级这条基线。首批 BBT、茉莉花原包已验证的范围与生产缺口继续以[宿主票](../issues/16-zotero-host-prototype.md)和[生态票](../issues/41-zotero-ecosystem-integration.md)为准。

上游资料：[Zotero 10.0.5 COPYING](https://github.com/zotero/zotero/blob/10.0.5/COPYING)、[Reader](https://github.com/zotero/reader)、[Connector](https://github.com/zotero/zotero-connectors)、[translators](https://github.com/zotero/translators)。不同仓库、脚本、资源各有许可，不能由 Zotero 应用的 AGPL 声明推断全部内容相同。

已有本地调查明确了可复用内容：

- zotero-agents 的 Digest、参考文献分析、主题综合、引用匹配和图构建，是实际科研方法与实现来源。Node 原生环境使许多 Gecko 探测和持久化回退无需迁入。
- ResearchSpec 的审阅、反馈定位、工作区承接和交付检查有价值；旧文件布局、图运行时、冻结机制和内容格式不自动成为 Scholoom 契约。
- 纯函数、算法与方法内容可按职责吸纳；生成的校验器从新 Schema 重新生成。不能为了复用旧 UI 或包格式复制整个运行时。

依据：[ResearchSpec 源码调查](existing-researchspec-source-reuse.md)、[zotero-agents 源码调查](existing-zotero-agent-source-reuse.md)、[TS 综合实现调查](synthesis-typescript-compute-paths.md)。这些笔记针对其记录的固定本地提交；本轮没有重新运行旧项目，具体吸纳前核对当前来源及许可。受非商用限制的派生内容不纳入默认分发。

## 2. Nimbalyst 与 Paseo：借鉴完整交互，窄范围取源码

### Nimbalyst

本轮固定点为 [`b51f96d`](https://github.com/nimbalyst/nimbalyst/tree/b51f96dd918862d43d3bdda044dce46d9d7f0595)，GitHub API 返回提交时间 2026-10-10。根 [LICENSE](https://github.com/nimbalyst/nimbalyst/blob/b51f96dd918862d43d3bdda044dce46d9d7f0595/LICENSE) 为 MIT，源码可在保留声明条件下复用；不据此推断第三方资源和服务全部同许可。

已核到两处接缝：

- [`EditorContextItem` / `EditorHost`](https://github.com/nimbalyst/nimbalyst/blob/b51f96dd918862d43d3bdda044dce46d9d7f0595/packages/extension-sdk/src/types/editor.ts) 把编辑器选区、标签和附加数据交给宿主，是“选科研对象后发指令”的接口参考。新源码含协作文档类型；Scholoom 不需要为此提前引入多人协作。
- [`packages/runtime/package.json`](https://github.com/nimbalyst/nimbalyst/blob/b51f96dd918862d43d3bdda044dce46d9d7f0595/packages/runtime/package.json) 有多项模块导出，但包仍为 private。可导出不等于公开、稳定、独立安装的组件库。

优先调查叶组件、工件 renderer、选区上下文和修改查看。消息与输入沿 assistant-ui 已有方向；不同时带入 Nimbalyst 的会话状态、Agent 引擎和 tracker 权威。已核过的“修改先写盘，Keep 表示已看，Revert 是恢复”交互以及撤销反馈缺口，见[既有工件调查](workbench-artifact-interaction-reference.md)。产品上的局部撤销保护不能由整文件恢复替代。

### Paseo

本轮固定点为 [`e61009d`](https://github.com/getpaseo/paseo/tree/e61009d5fbe0ed7e9841d43b32a3eae5983d7a28)，API 返回提交时间 2026-10-11。根 [LICENSE](https://github.com/getpaseo/paseo/blob/e61009d5fbe0ed7e9841d43b32a3eae5983d7a28/LICENSE) 明确自有部分采用 Apache-2.0，第三方内容保留原许可；GitHub SPDX 自动识别返回 NOASSERTION，不能因此写成许可未知或无许可。

[`packages/app/package.json`](https://github.com/getpaseo/paseo/blob/e61009d5fbe0ed7e9841d43b32a3eae5983d7a28/packages/app/package.json) 仍体现 Expo/React Native Web 技术链与自有 client/protocol。优先借鉴后台工作与多客户端分离、历史锚点、会话导航、输入材料与产物检查。整块迁入会带来 RN Web、daemon 协议和 store 替换；不能仅因为桌面壳是 Electron 就按 React DOM 小组件估算成本。

详细接入比较见[既有 Agent UI 调查](agent-ui-reuse-evaluation.md)。本轮没有运行这两个产品或测量长会话性能。

## 3. Zettlr：本轮新增的高价值学术编辑参考

固定点 [`e6c7fd8`](https://github.com/Zettlr/Zettlr/tree/e6c7fd8ffebfddb6fa091521b5a9dea673719887)，API 返回默认分支提交时间 2026-09-28，仓库最后 push 为 2026-10-06，未归档。[LICENSE](https://github.com/Zettlr/Zettlr/blob/e6c7fd8ffebfddb6fa091521b5a9dea673719887/LICENSE) 为 GPLv3；实际抽取和组合仍核文件声明及分发条件。

官方 README 明确 Electron、Vue、CodeMirror 6 与 Pandoc 路线。和 Scholoom 的前端框架不同，但编辑器扩展比整页 Vue UI 更值得抽取：

| 已核源码 | 可以省掉什么 | 不能直接照搬什么 |
| --- | --- | --- |
| [引用补全](https://github.com/Zettlr/Zettlr/blob/e6c7fd8ffebfddb6fa091521b5a9dea673719887/source/common/modules/markdown-editor/autocomplete/citations.ts) | CodeMirror 补全、当前稿件引用统计和排序的实现经验 | 自有 configField、parser 与文献身份；引用来源改接共同文献权威 |
| [citation parser 目录](https://github.com/Zettlr/Zettlr/tree/e6c7fd8ffebfddb6fa091521b5a9dea673719887/source/common/modules/markdown-editor/parser) | 学术引用语法识别和编辑交互参考 | 不能默认覆盖全部 QMD 扩展、未知语法或复杂工程 |
| [citeproc provider](https://github.com/Zettlr/Zettlr/blob/e6c7fd8ffebfddb6fa091521b5a9dea673719887/source/app/service-providers/citeproc/index.ts) | 引用渲染、文献文件变化后的刷新策略 | 依赖 Electron ipcMain、配置、window/log provider；应替换宿主接线，避免 renderer 维护第二份文献权威 |

建议在引用补全规格开始时优先核这些源码，而非从零编写。界面渲染引用与最终 Pandoc citeproc 输出仍需对照；中文作者、locator、前缀/后缀、组合引用、bib 更新及重复 key 是有价值的验收样本。

## 4. JupyterLab 与 Joplin：借鉴数据与视图关系、失败情境

### JupyterLab

固定点 [`3a51d6d`](https://github.com/jupyterlab/jupyterlab/tree/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8)，API 返回提交时间 2026-10-09，未归档，根 [BSD-3-Clause LICENSE](https://github.com/jupyterlab/jupyterlab/blob/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8/LICENSE) 已核。

公开包的职责很有参考价值：[docregistry](https://github.com/jupyterlab/jupyterlab/blob/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8/packages/docregistry/README.md) 登记文档类型，[docmanager](https://github.com/jupyterlab/jupyterlab/blob/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8/packages/docmanager/README.md) 管理打开关闭和同一文件的多个视图，[rendermime](https://github.com/jupyterlab/jupyterlab/blob/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8/packages/rendermime/src/registry.ts) 处理安全与不安全 renderer。

对 Scholoom 的启发是同一稿件/产物身份承接多个视图，以及科研输出按 MIME/文件类型展示，不用每个执行工具另造界面。

不过，[services README](https://github.com/jupyterlab/jupyterlab/blob/3a51d6d20e1cbfad03587a70385bc95e15cc5ae8/packages/services/README.md) 明确需要运行 Jupyter Server；Jupyter kernel 也不是 Scholoom 任务内核。整套迁入将增加 Python 服务、协议和 Lumino widget 生命周期。若之后真需要 Notebook 原生交互，可以把 Jupyter 当受管执行环境；首阶段文件和脚本执行不为此增加常驻服务。

### Joplin

固定点 [`7da9753`](https://github.com/laurent22/joplin/tree/7da9753f71ca88064b67a77552c9264ad36f5281)，API 返回提交时间 2026-10-10，未归档。根 [LICENSE](https://github.com/laurent22/joplin/blob/7da9753f71ca88064b67a77552c9264ad36f5281/LICENSE) 默认 AGPL-3.0-or-later，明确子目录 LICENSE 覆盖根声明；server 等路径不能按整个仓库同许可处理。

已读[架构](https://github.com/laurent22/joplin/blob/7da9753f71ca88064b67a77552c9264ad36f5281/readme/dev/spec/architecture.md)与[历史机制](https://github.com/laurent22/joplin/blob/7da9753f71ca88064b67a77552c9264ad36f5281/readme/dev/spec/history.md)。适合借鉴离线资料、附件、SQLite、历史保留与导入故障；其修订系统也体现了差异历史需要重建与清理的成本。

Scholoom 稿件以开放文件为权威，不照搬 Joplin 的 note 数据模型、同步及正文存储。历史恢复可参考，局部撤销仍需保护后续编辑。新 AI primitives 与 embedding 文档可作后续对照，不由已有产品功能反推 Scholoom 应增加同样功能。

## 5. Paperlib 与 Cherry Studio：只针对缺口取用

**Paperlib**：[官方 README](https://github.com/Future-Scholars/paperlib/blob/main/README.md) 从缺 DOI 的会议论文题录问题出发，提供多 scraper、扩展和引用工作流。[package.json](https://github.com/Future-Scholars/paperlib/blob/main/package.json) 为 Vue/Electron，根 [LICENSE](https://github.com/Future-Scholars/paperlib/blob/main/LICENSE) 为 GPLv3。值得检查其 DBLP/会议来源补全、失败保留和手动更正；不需要把 Vue、存储或扩展运行时带入现有架构。此处引用 main 是移动来源，本轮没有稳定提交和完整模块调用调查；不能把其 scraper 列为已决定依赖。

**Cherry Studio**：[官方 README](https://github.com/CherryHQ/cherry-studio) 与 [LICENSE](https://github.com/CherryHQ/cherry-studio/blob/main/LICENSE) 声明社区版 AGPLv3。[package.json](https://github.com/CherryHQ/cherry-studio/blob/main/package.json) 可见 Electron/React、better-sqlite3、Drizzle、sqlite-vec 及 Node/Electron 原生模块分别重建的脚本。适合检查 provider 配置、材料摄取、SQLite 扩展和分发的真实接线。其 SQLite 扩展使用 fork/alpha 包，不能因成熟产品已经用了就直接复制版本组合。通用聊天、知识库与 agent 功能不提供 Scholoom 的来源版本、科研判断和持续交付语义。

两个项目均保留官方 releases 作为维护核对入口：[Paperlib releases](https://github.com/Future-Scholars/paperlib/releases)、[Cherry Studio releases](https://github.com/CherryHQ/cherry-studio/releases)。本轮未验证安装和版本组合，也未把近期维护程度量化。

## 6. 是否可以复用整个工作台平台

### Eclipse Theia：值得比较，但不能无成本塞进当前工作台

Theia 官方[组装应用说明](https://theia-ide.org/docs/composing_applications/)明确可通过 npm 模块组成自有 browser/Electron 产品，复用编辑器、文件树、终端、workspace、命令、菜单与快捷键。[扩展机制](https://theia-ide.org/docs/extensions/)区分构建期 Theia extensions 与插件。它是可定制平台，不是 VS Code fork。

固定点 [`2904550`](https://github.com/eclipse-theia/theia/tree/29045502ffe2bd1ecd5c655b40f37f0d0bc0c4ad)，API 返回提交时间 2026-10-09。[LICENSE-EPL](https://github.com/eclipse-theia/theia/blob/29045502ffe2bd1ecd5c655b40f37f0d0bc0c4ad/LICENSE-EPL)、[LICENSE-GPL-2.0-ONLY-CLASSPATH-EXCEPTION](https://github.com/eclipse-theia/theia/blob/29045502ffe2bd1ecd5c655b40f37f0d0bc0c4ad/LICENSE-GPL-2.0-ONLY-CLASSPATH-EXCEPTION)和 package 声明需共同核对；不能写成 MIT。

收益：如果最终要大量 IDE 通用能力，平台能减少命令系统、布局、文档打开和语言服务的自研。代价：引入平台自己的前后端模块、依赖注入、widget 生命周期、构建及版本协调；Monaco、Theia backend 与既有 CodeMirror/共同 Node 内核的关系需要重新设计。官方组装页面还提醒示例版本可能过时，应按固定版本核对。

本轮建议是保留为一次有界对比实验的候选，不立即改底座。对比同一条链路：接现有 JSON-RPC 内核；嵌入 Agent 面板、PDF 和稿件视图；切换四种预设；外部编辑后刷新；保存布局；关窗后任务继续。比较总接线量、需要覆盖的内部接口和资源成本，不只比较“文件树很快就出来”。

### Code OSS：借鉴工作副本和生命周期，不建议默认整仓 fork

固定点 [`cc3fec8`](https://github.com/microsoft/vscode/tree/cc3fec8846d0e678357e476fa611774da26d7e24)，API 返回提交时间 2026-10-10，根 [LICENSE.txt](https://github.com/microsoft/vscode/blob/cc3fec8846d0e678357e476fa611774da26d7e24/LICENSE.txt) 为 MIT。官方[源码组织](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)把 base、platform、editor、workbench、应用入口分开；[Working Copies](https://github.com/microsoft/vscode/wiki/Working-Copies)值得用于稿件未保存状态与自定义编辑器设计核对。

Monaco 是公开编辑器包，完整 workbench 是另一层。维护 fork 将包含不需要的开发工具功能与大范围升级；当前 CodeMirror、React 与科研编辑路线更适合窄组件组合。另需区分 MIT 的 Code OSS 与微软发布产品、品牌、Marketplace 和部分扩展的条款，见[官方产品差异说明](https://github.com/microsoft/vscode-wiki/blob/main/Differences-between-the-repository-and-Visual-Studio-Code.md)。

## 7. 科研与 RAG 项目：取方法，不引入第二个权威内核

| 项目及许可证据 | 已核可借鉴内容 | 接入判断与边界 |
| --- | --- | --- |
| [PaperQA2 README](https://github.com/Future-House/paper-qa/blob/57e89f7223b0960d5ee5ea048c69e3c47e088572/README.md)、[Apache-2.0 LICENSE](https://github.com/Future-House/paper-qa/blob/57e89f7223b0960d5ee5ea048c69e3c47e088572/LICENSE) | 科研文档 RAG、元数据辅助、证据收集与带引用回答、检索和回答分阶段 | Python 包；可用于方法和质量对照，若作为受管能力则接入 Scholoom 材料和交付。不同时维护其独立文献/向量权威。论文指标不证明本项目数据上同样效果 |
| [STORM README](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/README.md)、[MIT LICENSE](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/LICENSE) | 多视角检索提问、写作前提纲、Co-STORM 人机知识整理、用户材料检索器 | Python/DSPy 方法实现；借鉴研究方法及对照样本。API 返回该固定点最后提交为 2025-09-30，未归档不等于积极维护，不将其当最新活跃基础框架 |
| [Open Notebook README](https://github.com/lfnovo/open-notebook/blob/main/README.md)、[MIT LICENSE](https://github.com/lfnovo/open-notebook/blob/main/LICENSE) | 来源、笔记与分析的组织，引用指向实际材料，摄取和后台处理体验 | 官方部署含 Python、Next.js、SurrealDB 和 worker；作为产品交互参考，整迁与既有 Node/SQLite 路线冲突。源码免费不等于模型/embedding 和部署免费 |
| [AnythingLLM README](https://github.com/Mintplex-Labs/anything-llm/blob/master/README.md)、[MIT LICENSE](https://github.com/Mintplex-Labs/anything-llm/blob/master/LICENSE) | 本地/远程 provider、材料上传、来源引用、桌面配置、执行进展 | 有桌面与 Docker 版本，功能范围不同；借鉴用户流程与窄集成。不能从 Docker 多用户功能推断桌面同样支持，也不整体迁入聊天/RAG后台 |
| [Dify README](https://github.com/langgenius/dify/blob/main/README.md)、[根 LICENSE](https://github.com/langgenius/dify/blob/main/LICENSE) | workflow 运行诊断、模型配置、知识库管理 | 根许可基于 Apache-2.0 加多租户与前端标识等条件；不作为可自由改名抽取的普通组件库。Node SDK 的独立 MIT 许可不覆盖整个平台源码。设计参考即可 |

PaperQA2 固定点 API 返回提交时间 2026-08-12、最后 push 2026-09-25；STORM 维护时间如上。后三项移动分支未固定提交，未完整审查所有模块和依赖，不据此下性能或安全结论。

## 建议的源码使用方式

先用公开库满足通用职责；只有功能缺口明确时才抽取应用源码。每次抽取记录上游仓库、固定 tag/commit、来源文件、LICENSE/NOTICE、修改范围和可观察验收行为，把宿主依赖收在对应模块中。

优先源码候选是 Zettlr 的学术编辑扩展、Nimbalyst 的对象上下文/叶 renderer、Zotero 配对阅读模块，以及已有两个科研项目的纯算法与方法内容。Paseo 的完整 RN Web UI、Code OSS 整仓、JupyterLab 全服务、Dify/Open Notebook 全后台不作为默认迁入对象。

如果现成库已经给出需要的功能，就不同时保存一份上游内部实现；例如已有 CodeMirror merge 能满足差异查看时，不再搬入完整编辑器 diff 系统。研究方法项目提供候选方法和评价对照，具体研究判断、证据与任务契约仍由 Scholoom 管理。

## 尚未核实

没有运行上述产品、构建或抽取组件，没有对比资源成本，没有证明某项目会节省多少工时。未审核全部传递依赖、商标/资源许可、付费服务条款和研究效果。动态网页与移动 main 只能用于发现候选，实际吸纳前固定来源再次核对。

本报告对应的总览与决策候选见 [复用调查总览](reuse-landscape.md)；各类库的实际接口和限制见该总览链接的领域报告。
