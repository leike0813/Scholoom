# Electron 中可选的现代阅读器组件

调查日期：2026-10-03。范围：公开官方文档、仓库与发布记录的事实核查；本次未安装、运行或基准测试。以下“支持”均指官方资料列出的 API/能力，不代表本项目已集成或验证。

| 候选 | 引擎与能力 | UI、文件和保存 | 许可与维护线索 |
|---|---|---|---|
| **EmbedPDF** | 官方仓库称 PDFium fork（EmbedPDF Runtime）；公开 viewer SDK 为 Apache-2.0。v2 仓库列出搜索、文本选择、高亮与其他注释；headless React 文档明确有文本选区/矩形/事件、高亮/下划线/批注及 `onAnnotationEvent`。注释采用结构化 JS 对象，支持 `saveAsCopy()` 输出含修改的 PDF `ArrayBuffer`，也有独立注释导入/导出接口。PDF outline/目录 API 未在本次查到的 v2 viewer 文档中核实，须列为验证项。[^embed-readme][^embed-headless][^embed-select][^embed-annot][^embed-model][^embed-save] | 提供自带 UI 的 React viewer，也可用 headless 层自建 React UI。文档管理器支持 URL、`ArrayBuffer` 和系统文件选择器传入。v2 使用 PDFium WASM；Electron 可将 wasm/worker 作为本地打包资源，但路径、worker CSP 和打包器适配需在目标配置验证。[^embed-docmgr][^embed-engine] | 仓库提示 v3 尚在开发、生产建议用 v2；截至调查日 release 页面同时显示 v2.15.1 与 v3 prerelease，近期有持续版本记录。stars 不代表性能。仓库 SDK 许可为 Apache-2.0；CloudPDF server 是单独 Fair Source 模块，使用 PDF viewer 本身不等于使用该 server。公开 SDK 的产品能力未见需购买的功能门槛；CloudPDF server 有单独授权条件。[^embed-readme][^embed-license][^embed-releases] |
| **React-PDF（wojtekmaj）** | 这是 Mozilla PDF.js 的 React 显示组件，不是 `@react-pdf/renderer` 一类 PDF 生成器。提供 `Document`、`Page`、缩略图、目录、文本层和 PDF 原生 annotation layer（链接/表单层）；没有完整阅读器工具栏，也没有自身的高亮批注编辑/持久化 reader API。[^reactpdf-readme][^reactpdf-impl] | PDF.js worker 需由应用配置并随构建提供；可通过 `file` 等 PDF.js 输入加载。UI、搜索体验、批注数据管理和保存流程由应用组装。MIT。官方 releases 与近期 v11 文档显示持续发布/更新。[^reactpdf-readme][^reactpdf-license][^reactpdf-releases] | 活跃维护信号来自近期发布、依赖升级与维护文档，不代表质量或性能保证。[^reactpdf-releases] |
| **react-pdf-viewer** | 基于 PDF.js 的完整 React reader：官方列出搜索、目录、文本选择、缩放、缩略图、表单、打印等；有 Highlight 插件与选区数据/坐标 API，可在应用中管理高亮，但需区分 viewer annotation 插件与将编辑结果写回 PDF 的能力。[^rpv-readme][^rpv-highlight] | 带默认布局/插件系统，可从 URL 或本地文件打开；完整 PDF 批注写回/roundtrip 并非公开基础能力表所证明。[^rpv-readme] | 官方仓库要求购买商业许可；本次源码样本固定为 v3.10.0，并未据此确定最新发布版本。仓库已于 **2026-03-25** 归档只读，不能按仍维护的组件评估。[^rpv-license][^rpv-release] |
| **EPUB / 网页阅读** | Electron 可按格式分别组合：epub.js 是浏览器 EPUB rendition 库，提供 EPUB CFI 定位、章节/进度位置、搜索与 highlight/underline/mark 注释接口；foliate-js 是模块化书籍 renderer，README 列 EPUB 等格式、搜索与注释辅助模块，但自述 API 不稳定，且其 PDF adapter 明确是实验性质并依赖 PDF.js。网页阅读器可直接基于 DOM `Selection`/`Range` 获取选区，再存储 selector/文本锚点；这是平台能力，仍需自行处理 DOM 变化与跨文档持久定位。[^epub-api][^epub-license][^foliate-readme][^foliate-license][^dom-selection] | 这些组件可用于 Electron 中各自格式的内容视图；它们并不构成统一覆盖 PDF、EPUB、网页的 reader。应用需定义格式路由与共同的书签/选区/批注数据契约。 | epub.js 仓库许可为 BSD-2-Clause；foliate-js 为 MIT。各自功能与维护状态应按目标版本再核对。[^epub-license][^foliate-license] |
| **Apryse WebViewer（商业代表）** | 官方支持 Electron 集成；完整 PDF SDK 提供注释 API、XFDF 导入导出、事件和 PDF 保存，可将 XFDF 合并回 PDF 数据。[^apryse-electron][^apryse-annot][^apryse-save] | 官方文档覆盖本地资源离线加载及本地文档 buffer/blob；可将 worker、wasm 与 viewer 资源纳入应用包。这里“支持离线”是官方集成说明，不是本次离线实测。[^apryse-electron][^apryse-offline] | 商业 SDK：正式使用需按供应商条件取得有效 license key；本调查不比较价格，也不判断许可法律后果。[^apryse-license] |

## 对当前问题的事实结论

“Electron 下应有成熟组件”有可行候选：EmbedPDF 是 PDFium WASM 路线的开放完整 viewer，Apryse 是支持 Electron 的商业完整 SDK，不必把 Zotero reader 作为唯一渲染/阅读 UI 选项。React-PDF 更适合把 PDF.js 当渲染底层，应用自己建 reader。EmbedPDF 值得进行本地样本验证，但官方当前仍建议生产使用 v2，且本调查没有验证阅读质量、性能或批注互操作。不同格式可分别选 renderer，再由 Scholoom 自己维护一致的数据契约。

## 渲染底座与科研内核边界

- Zotero reader 本身组合了 PDF.js、epub.js 及结构化文本模块的 Zotero 分支，不能把整个组件的技术约束等同于 Gecko 宿主。见 [reader 子模块声明](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/.gitmodules)。
- Mozilla PDF.js 是基于 Web 标准的解析与渲染平台，Apache-2.0；除通用 viewer 外，公开 API 包含按页文本提取、批注读取、视口变换及文档保存，加载参数支持二进制数据和 worker。它提供可直接组合的底座，但这些 API 不自动形成文献库、研究证据或论文阅读顺序。见 [PDF.js 首页](https://mozilla.github.io/pdf.js/)、[页面 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)、[文档 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html)、[加载参数](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)。
- Electron 确有 Chromium 内置 PDF viewer；官方发布记录包含其保存对话框修复。它可作为基本显示候选。本次没有查到可供应用依赖的完整科研批注、选区和证据操作契约，不能仅凭能够打开 PDF 就认定满足 Scholoom。见 [Electron 官方修复记录](https://releases.electronjs.org/pr/51042)、[公开 WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)。这是本次核查范围内的判断，不是对所有内部接口的否定。
- 对 Scholoom 的设计建议：采用组件处理显示、选区、搜索和批注交互；科研内核维护来源、材料版本、批注与证据关系，并提供不依赖打开阅读窗口的 Agent 操作。来自读取组件和独立文本／OCR／结构提取流程的位置，均需关联到实际材料版本并能返回原文。渲染性能、文本抽取质量、Agent 研究能力分别验收。
- EmbedPDF 的 React headless 文档描述由应用自建 UI，其“headless”名称本身不足以证明科研内核可以脱离 React、DOM 或阅读窗口执行所有操作。Scholoom 的脱离 GUI 读取要求需对实际采用的引擎或独立材料服务验证，不能由 SDK 名称推断。见 [React headless quickstart](https://www.embedpdf.com/docs/react/headless/getting-started)。

## 尚需验证的样本

- 扫描版 OCR PDF：文本层缺失/错序、搜索和选区行为。
- 双栏及多栏论文：阅读顺序、选区几何和高亮落点。
- 数学公式、矢量图表、复杂字体与混合页面方向。
- 大文件与超长文档：启动、滚动内存、搜索和导出；不能用 stars 或厂商“fast”表述替代测量。
- 跨页文本选择：是否形成稳定的多页选区，并能生成项目所需的锚点。
- Annotation roundtrip：导入/编辑/保存/重开，并由另一独立 PDF reader 检查高亮、批注文字、作者、坐标与元数据是否保留。
- Electron 打包后的完全离线运行：PDF、worker、WASM、CSP、文件路径权限及不同操作系统包。

[^embed-readme]: EmbedPDF 官方固定版本 v2.15.1 README（SDK features 与 PDFium Runtime）：<https://github.com/embedpdf/embed-pdf-viewer/blob/v2.15.1/README.md>；仓库当前说明（v3 状态）：<https://github.com/embedpdf/embed-pdf-viewer>。
[^embed-headless]: EmbedPDF React headless quickstart：<https://www.embedpdf.com/docs/react/headless/getting-started>。
[^embed-select]: EmbedPDF React selection plugin API：<https://www.embedpdf.com/docs/react/headless/plugins/plugin-selection>。
[^embed-annot]: EmbedPDF React annotation plugin API/events：<https://www.embedpdf.com/docs/react/headless/plugins/plugin-annotation>；annotation import/export：<https://www.embedpdf.com/docs/snippet/plugins/plugin-annotation>。
[^embed-model]: EmbedPDF annotation models：<https://www.embedpdf.com/docs/engines/annotations/annotation-models>。
[^embed-save]: EmbedPDF export/save API：<https://www.embedpdf.com/docs/react/headless/plugins/plugin-export>。
[^embed-docmgr]: EmbedPDF document manager URL/buffer/file APIs：<https://www.embedpdf.com/docs/react/headless/plugins/plugin-document-manager>。
[^embed-engine]: EmbedPDF engine guide：<https://www.embedpdf.com/docs/react/headless/engine>；fixed release-tagged engine packages: <https://github.com/embedpdf/embed-pdf-viewer/tree/v2.15.1/packages/engines>。
[^embed-license]: EmbedPDF licensing map: <https://github.com/embedpdf/embed-pdf-viewer/blob/v2.15.1/LICENSING.md>。
[^embed-releases]: EmbedPDF releases: <https://github.com/embedpdf/embed-pdf-viewer/releases>。
[^reactpdf-readme]: React-PDF official README/API: <https://github.com/wojtekmaj/react-pdf/tree/main>。
[^reactpdf-impl]: React-PDF v11 `Document`/`Page` components and PDF.js dependency: <https://github.com/wojtekmaj/react-pdf/tree/v11.0.0/packages/react-pdf/src>。
[^reactpdf-license]: React-PDF MIT license: <https://github.com/wojtekmaj/react-pdf/blob/main/LICENSE>。
[^reactpdf-releases]: React-PDF official releases: <https://github.com/wojtekmaj/react-pdf/releases>。
[^rpv-readme]: react-pdf-viewer official feature list: <https://github.com/react-pdf-viewer/react-pdf-viewer/tree/v3.10.0>。
[^rpv-highlight]: react-pdf-viewer highlight plugin, selection data and APIs: <https://github.com/react-pdf-viewer/react-pdf-viewer/tree/v3.10.0/packages/highlight>。
[^rpv-license]: react-pdf-viewer license page: <https://react-pdf-viewer.dev/license>。
[^rpv-release]: v3.10.0 release/tag: <https://github.com/react-pdf-viewer/react-pdf-viewer/releases/tag/v3.10.0>；repository archive notice is on the official repository page.
[^epub-api]: epub.js API documentation (Locations, CFI, annotations): <https://github.com/futurepress/epub.js/blob/master/documentation/md/API.md>。
[^epub-license]: epub.js license file: <https://github.com/futurepress/epub.js/blob/master/license>。
[^foliate-readme]: foliate-js official README/API/status: <https://github.com/johnfactotum/foliate-js/blob/main/README.md>。
[^foliate-license]: foliate-js MIT license: <https://github.com/johnfactotum/foliate-js/blob/main/LICENSE>。
[^dom-selection]: W3C Selection API specification: <https://www.w3.org/TR/selection-api/>。
[^apryse-electron]: Apryse Electron integration: <https://docs.apryse.com/web/get-started/libraries-and-frameworks/electron>。
[^apryse-annot]: Apryse AnnotationManager API (including XFDF export and events): <https://sdk.apryse.com/api/web/Core.AnnotationManager.html>。
[^apryse-save]: Apryse save document guide: <https://docs.apryse.com/web/guides/basics/save>。
[^apryse-offline]: Apryse offline viewer guide: <https://docs.apryse.com/web/guides/offline-loading>。
[^apryse-license]: Apryse license initialization documentation: <https://docs.apryse.com/support/faq/initialize/key-init>。
