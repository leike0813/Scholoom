# 学术阅读与写作组件复用调查

调查日期：2026-10-11。本文是官方文档、公开源码、LICENSE 与发布/维护记录的静态调查，不是运行测试；没有在 Scholoom 中安装、构建或实跑候选。在线示例和官方能力说明不等于本产品契约已验收。

## 范围与需求映射

依据 [工作台 PRD](../../../docs/prd/workbench.md)、[文献 PRD](../../../docs/prd/literature.md) 与 [技术约束](../../../docs/prd/constraints-and-validation.md)：

| 需求 | 可借力的上游 | Scholoom 仍须负责 |
| --- | --- | --- |
| PDF 阅读、搜索、选择、批注；位置跟随材料版本；完全离线 | EmbedPDF v2；PDF.js 为备选 | 统一位置契约、版本与来源、证据关联、重定位置信度、离线资源包、Agent 无 UI 读取 |
| EPUB/网页阅读和批注 | Zotero reader DOM 层；epub.js / foliate-js | Web Annotation/CFI/selector 统一、版本变更后的锚定与核验、宿主隔离及保存 |
| QMD/MD 源码与可视编辑同稿，未知语法不丢失 | Quarto visual editor 源码模块；CodeMirror 6 | 宿主适配、保护不能表示的内容、源码权威、并发/草稿/撤销与保存 |
| LaTeX 工程源码、诊断、预览和正反向定位 | CodeMirror stex 着色；texlab LSP；latexmk + SyncTeX | TeX 环境与工具链、工程配置、构建授权、故障状态、最后成功产物保护 |
| 学术引文语法、渲染和题录导入/导出 | Quarto/Pandoc/citeproc/CSL；Citation.js 辅助转换 | 稳定条目身份/键、来源核实、字段冲突、转换损失报告、格式语义与科研证据分离 |
| 外部审稿 DOCX/PDF 评论和修订读取 | OOXML 解析链路；PDF.js 注释读取 | 保留原件、评论与目标文本关联、修订语义/作者/顺序、差异和人工确认；没有已核实的通用无损 React 导入器 |

已有选型仍有效：PDF 主线 EmbedPDF v2，PDF.js 备选；EPUB/快照沿 Zotero reader 成组复用并配对 EPUB fork；编辑器优先 Quarto 学术编辑模块及 CodeMirror 6。若要调整技术路线，须回到项目决策票讨论，本调查不变更已确认决定。

## 候选评估（16 项）

### PDF 与阅读器

1. **EmbedPDF v2 — 推荐，按 v2 固定基线集成。** React 集成既有 viewer，也提供 headless hooks/插件；注释、文本选择、搜索和导出/写回 API 可复用，底层是 EmbedPDF Runtime 的 PDFium fork。接入 `@embedpdf/*` 及 React viewer/headless 包，重点读 `packages/` 中 engine、plugins、react bindings。官方 v2.15.1 有版本发布；仓库明确 v3 仍是开发线。v2.15.1 根 LICENSE 实为 Apache-2.0（较旧报告称 Apache 一致），`LICENSING.md` 将 SDK 标为 Apache-2.0，CloudPDF server 单独为 FCL-1.0-ALv2；CloudPDF 托管服务/服务器不能当作免费 SDK 功能。Web/WASM+worker 路线适合 Electron Chromium，Node 内核不可由 React viewer/headless 名称推定为无 DOM。全离线须随包包含 WASM、worker、字体资源并验证路径/CSP。多格式锚点、PDF 原生批注互操作和 reader 插件特有 API仍需原型验收。[官方文档](https://www.embedpdf.com/docs)、[固定 v2.15.1 README](https://github.com/embedpdf/embed-pdf-viewer/blob/v2.15.1/README.md)、[该 tag LICENSE](https://github.com/embedpdf/embed-pdf-viewer/blob/v2.15.1/LICENSE)、[许可映射](https://github.com/embedpdf/embed-pdf-viewer/blob/v2.15.1/LICENSING.md)、[发布记录](https://github.com/embedpdf/embed-pdf-viewer/releases)。

2. **Mozilla PDF.js — 推荐备选/底层引擎。** `pdfjs-dist` 给 JS/TS 展示层、文本层、视口变换、已有 PDF annotations 的 `getAnnotations()`、文本内容和 worker；内建 viewer 可供模式参考。annotationStorage 不是完整可持久化的通用评论数据库，也不自动完成科研高亮往返。许可已直接核对根 LICENSE：Apache-2.0；官方持续发布。浏览器/Electron 适配成熟，Node 能力与 DOM viewer 不同；worker、WASM、CMap、标准字体资源要离线本地化。若直接用，需要自建 reader UI、选区管理、可写批注与导出适配；官方 API 示例未实跑。[API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)、[API 源码文档](https://mozilla.github.io/pdf.js/api/draft/api.js.html)、[LICENSE](https://github.com/mozilla/pdf.js/blob/master/LICENSE)、[发布页](https://github.com/mozilla/pdf.js/releases)。

3. **PDFium — 仅借鉴/底层备用，不直接做 UI 方案。** C API 的 annotation/page/object API 可读写 PDF 原生注释，但须自行建 UI、文本/页面坐标映射、WASM/本机绑定和保存事务；部分接口标 experimental。上游 Chromium 项目仍维护，PDFium 根 LICENSE 为 BSD-3-Clause（含第三方组件各自许可），不是“纯 PDFium 一份许可”。跨平台可通过不同构建分发，Node/Electron 原生绑定与 ABI/签名负担显著。EmbedPDF 已包装 PDFium，绕过 viewer 直接维护会重复承担复杂度。[官方仓库](https://github.com/chromium/pdfium)、[annotation C API](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/public/fpdf_annot.h)、[LICENSE](https://github.com/chromium/pdfium/blob/main/LICENSE)。

4. **Zotero reader PDF 部分 — 推荐复用交互/学习边界，避免整套当 npm 组件。** reader 将 PDF.js 与 Zotero 保存、批注及宿主整合；公开仓库是完整应用源码，不是稳定的独立 React reader 包。源码许可 AGPL-3.0，与项目许可方向一致，但须跟踪子模块 PDF.js 等第三方许可和固定基线。维护活跃、近期有提交；运行依赖其宿主契约和配套模块，抽出时要处理宿主对象、保存通知和依赖。相较 EmbedPDF，复用价值更偏批注行为和阅读流程。[源码](https://github.com/zotero/reader/tree/692c28989629acf920fadb683747e18e5506b214)、[LICENSE/包声明](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/package.json)、[维护记录](https://github.com/zotero/reader/commits/master)。

### EPUB 与网页快照

5. **Zotero reader DOM 阅读层 — 推荐成组吸纳。** `DOMView`、selector↔Range、共享查找 worker 被 EPUB 与 snapshot 共同复用；网页快照 selector 有 CssSelector 与 TextPositionSelector 回退，EPUB 用 CFI。接入范围为 `src/dom/common/**`、对应 snapshot/EPUB view 与 `structured-document-text`/position-mapper 等子模块，而非单个 npm 包。仓库 AGPL-3.0；上游 reader 持续维护，但内部模块维护量远高于普通 npm dependency，得随固定源码点做升级和冲突解决。依赖 DOM、Worker、浏览器资源，不是 Node reader。selector 版本漂移和 Scholoom 统一位置 schema 仍须适配。[固定源码 DOMView](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/dom/common/dom-view.tsx)、[selector](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/dom/common/lib/selector.ts)、[LICENSE](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/package.json)。

6. **epub.js — 备选引擎。** EPUB spine/rendering、CFI、Locations、section 搜索、注释 mark 和事件可直接复用，包 `epubjs`；无完整 reader UI。固定调查点 v0.3.93，BSD-2-Clause。维护有版本/提交活动，但仍需核对 fork/upstream 差异。Chromium DOM 环境；Node 不是完整呈现环境；Electron 可离线，但字体解混淆/zip 资源和 CSP 应实测。章节级搜索需逐 spine 聚合；其 CFI 和自有节点注入后的跨版本往返未实跑。[固定 API](https://github.com/futurepress/epub.js/tree/eee359d0790002115a1156a9833c54f4bcd44c1d)、[license](https://github.com/futurepress/epub.js/blob/eee359d0790002115a1156a9833c54f4bcd44c1d/license)、[发布](https://github.com/futurepress/epub.js/releases)。

7. **foliate-js — 备选/仅借鉴搜索、CFI 模块。** 原生 ESM，`search.js`、`text-walker.js`、`epubcfi.js`、`overlayer.js` 可按模块复用；README 明确 `reader.html` 与 UI 不属于库，API 不稳定，搜索实现自述较慢。固定点 MIT；npm 版本为 0.0.0，适合锁 commit/submodule，非稳定包升级路径。浏览器/Electron DOM 模块，离线需处理 ZIP loader、字体和资源路径。页内 Range overlay 与 Scholoom 批注事实存储需自行连接。[固定 README](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/README.md)、[LICENSE](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/LICENSE)、[源码目录](https://github.com/johnfactotum/foliate-js/tree/78914aef4466eb960965702401634c2cb348e9b1)。

### 源码、可视编辑和 LaTeX

8. **Quarto visual editor 模块 — 推荐，作为固定源码模块集成。** ProseMirror/Pandoc AST 转换和 cite/xref/math/table/figure/footnote/raw/shortcode 等学术语法已存在。固定源码 `quarto-dev/quarto@a83c5cc...` 的 `packages/editor` 提供 create/getMarkdown/setMarkdown/event/commands；`editor-server` 有 Node Pandoc 执行适配；`editor-ui` 是 React 包装。接入需 `EditorServer`、`EditorUI`、Pandoc 版本/扩展及文稿保存等宿主契约。

许可依据现已闭合：官方 [PR #1032](https://github.com/quarto-dev/quarto/pull/1032) 于 2026-09-01 合并，将 VS Code extension、LSP、Visual Editor、Panmirror 及共享依赖在内的 19 个 packages/apps 从 AGPL-3.0 重新许可为 MIT；明确排除的 `apps/writer`、`apps/writer-server` 仍为 AGPL-3.0。固定提交 [README 许可表](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/README.md) 与 [`packages/editor/package.json`](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/package.json) 均列 MIT。官网 [license 页面](https://quarto.org/license.html) 将 Visual Editor 标作 LGPL-3.0，与合并后的 PR 及固定 README 不符，应视为文档漂移；这不改变 PR 对代码范围的许可决定。

MIT 只覆盖 PR 列明的 Quarto 自有模块，不代表整个仓库及其打包依赖都是 MIT。固定提交的 [`apps/vscode/ThirdPartyNotices.txt`](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/apps/vscode/ThirdPartyNotices.txt) 明列 `bibliojson`（原 `biblatex-csl-converter`）为 LGPL-3.0，附 LGPL/GPL 文本、源码地址和可修改后重建发行物的说明；PR 还记录 Apache-2.0/BSD-3-Clause 依赖所需许可文本及 attribution/legal comments。实际采用时须随对应构建保留适用的 LICENSE、ThirdPartyNotices 和源码重建路径；Panmirror 独立发行也需携带各自 notices。上游近期持续发布。浏览器/React DOM；宿主核心并非 VS Code runtime 强绑定，但源码模块化发布不是独立 npm API，需维护上游内部模块、构建和依赖，远高于普通依赖。`unrecognized`/未知元数据与 Markdown 写回规范化要求保护原文；不能安全表示处提供源码入口，不能整稿覆盖。[固定 editor API](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/editor/editor.ts)、[宿主类型](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-types/src/server.ts)、[PR 合并记录](https://github.com/quarto-dev/quarto/pull/1032)、[固定 README](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/README.md)、[固定 ThirdPartyNotices](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/apps/vscode/ThirdPartyNotices.txt)、[写回格式契约](https://quarto.org/docs/visual-editor/markdown)。

9. **CodeMirror 6 Markdown — 推荐，与上项互补。** `@codemirror/state/view/language` + `@codemirror/lang-markdown` 提供源码编辑、Markdown Lezer 语法树与扩展点；React 通过 create/destroy 生命周期包装，不是 React 控件。MIT，包和源码持续发布。Chromium 浏览器/Electron，纯编辑状态不依赖 Node；离线静态资源易打包。QMD 学术语法支持不能只靠 generic Markdown parser；应复用 Quarto parser/visual editor。查看 [语言包 README](https://github.com/codemirror/lang-markdown/tree/6.5.2)、[LICENSE](https://github.com/codemirror/lang-markdown/blob/6.5.2/LICENSE)、[npm 发布](https://www.npmjs.com/package/@codemirror/lang-markdown)。

10. **CodeMirror stex — 仅借鉴/着色补充。** `@codemirror/legacy-modes` 的 `mode/stex` 是 StreamLanguage token 高亮；MIT，固定调查点 6.5.4。不是 LaTeX AST、诊断、跨文件导航或补全；与 CodeMirror 6 可装配。浏览器/Electron，无 Node 依赖。简单且低维护，但功能边界不能宣传为完整 LaTeX 编辑器。[源码](https://unpkg.com/@codemirror/legacy-modes@6.5.4/mode/stex.js)、[声明](https://unpkg.com/@codemirror/legacy-modes@6.5.4/mode/stex.d.ts)、[LICENSE](https://unpkg.com/@codemirror/legacy-modes@6.5.4/LICENSE)。

11. **texlab — 推荐接入诊断/工程服务。** 独立 LSP server 提供 LaTeX 语言服务、build、forward search 与 inverse-search；CodeMirror 通过 LSP client 接入，编译器仍由工程配置/受管执行调用。GPL-3.0（仓库 COPYING/CTAN）；免费开源、无服务订阅，但二进制分发须纳入 GPL 义务审查。跨平台 release/构建目标包含三大桌面平台；Node/Electron 以子进程方式运行，不是浏览器库。维护活跃，有 releases/近期提交。与 latexmk watch 混用时官方指出 texlab 不会收到 latexmk 构建通知；选择 onSave/受管构建协作。[README](https://github.com/latex-lsp/texlab)、[配置/SyncTeX](https://github.com/latex-lsp/texlab/wiki/Previewing)、[CTAN 许可/平台资料](https://ctan.org/pkg/texlab)、[LICENSE](https://github.com/latex-lsp/texlab/blob/master/COPYING)。

12. **latexmk + SyncTeX — 推荐编译链路，不是编辑器组件。** latexmk 监视依赖文件、重复调用 TeX/BibTeX 等直到收敛，提供连续预览模式；`-synctex=1` 产出定位数据。latexmk 是 Perl CLI，GPL-2.0，随 TeX Live/CTAN 发布，跨平台依赖 Perl、TeX 发行版及 viewer；Electron 可由受管 Node child process 启动。预览器自动重载、文件锁、失败时 PDF 是否被部分覆盖均取决于 viewer/输出流程。PRD 的“最后成功产物保护”必须由 Scholoom 把本次编译输出到暂存位置，仅成功后原子发布；本轮未验证 latexmk 本身提供成功产物事务保护。[CTAN 文档/维护](https://ctan.org/pkg/latexmk/?lang=en)、[2026 手册索引](https://tug.ctan.org/support/latexmk/)、[SyncTeX 项目说明](https://www.tug.org/texworks/SyncTeX.html)。

### 学术格式、题录和交付

13. **Pandoc + Quarto + citeproc — 推荐 QMD 渲染/格式事实源。** Pandoc 支持 BibTeX/BibLaTeX/CSL JSON/YAML/RIS 等输入，转换到 CSL 数据，并通过 citeproc+CSL 输出引文/参考文献；Quarto 在其上增加 QMD、交叉引用、图表与项目配置。主程序是 CLI（非 npm 浏览器编辑器），随固定版本运行在 Electron 管理的外部进程；离线需打包 Pandoc/Quarto、filters、CSL 样式和所需模板。免费开源；Quarto 多模块许可不同，Pandoc GPL-2.0-or-later（请以精确发布物 LICENSE/NOTICE 审查），CSL 样式各自 CC BY-SA 3.0 及署名要求。上游发布活跃。它处理格式转换和样式，不替 Scholoom 管理 citation key、来源核实或论证证据。[Pandoc 手册](https://pandoc.org/MANUAL.html)、[发布记录](https://pandoc.org/releases.html)、[Quarto 格式文档](https://quarto.org/docs/authoring/markdown-basics.html)、[CSL styles 授权](https://github.com/citation-style-language/styles#licensing)、[Quarto 许可说明](https://quarto.org/license.html)。

14. **Citation.js — 辅助格式转换，非主 citeproc。** npm 包组支持 DOI/CSL JSON/BibTeX/RIS/Wikidata 等输入输出，可作为导入转换器；MIT，官方仓库有近期 changelog 和发布。Node 可用，浏览器支持取决于输入插件/网络 fetch；离线 DOI/Wikidata 查询不可用，但本地格式转换可用。上游明确 BibTeX parser 测得较多、字段映射仍存在未覆盖/风险；不可拿作身份或原始字段权威。主渲染已由 Pandoc/citeproc 承担，避免重复格式服务。[文档](https://citation.js.org/)、[源码/包](https://github.com/citation-js/citation-js)、[变更记录](https://github.com/citation-js/citation-js/blob/main/CHANGELOG.md)、[固定包 license metadata](https://unpkg.com/@citation-js/plugin-csl@0.7.22/package.json)。

15. **Tiptap/ProseMirror — 备选通用编辑器框架，当前不推荐替换 Quarto 模块。** MIT 开源核心，Tiptap 商业 Pro 扩展/托管服务另收费；React `@tiptap/react` 绑定成熟。ProseMirror schema、transaction、node/mark view 可实现自定义学术语法，但要自建 Pandoc/QMD 双向转换、未知语法保护、引用/xref/shortcode/crossref 与 Quarto 格式规范化，成本远高于复用现有领域编辑器。浏览器/Electron DOM；offline 可部署。Tiptap 持续发布，框架自身成熟不等于 QMD 契约开箱即有。[React 接入](https://tiptap.dev/docs/editor/getting-started/install/react)、[开源/付费边界](https://tiptap.dev/open-source-to-platform)、[ProseMirror](https://prosemirror.net/)、[许可](https://github.com/ueberdosis/tiptap/blob/main/LICENSE)。

16. **Lexical — 不推荐作为本项目学术稿件主编辑器。** React 优先、MIT、维护活跃、可扩展，但仍需自己实现 ProseMirror/Pandoc bridge 级别的 QMD/LaTeX 领域 schema 和无损往返；它的 JSON editor state 不等同于 Markdown/QMD 文件契约。浏览器/Electron DOM；headless API 也不自动具备格式语义。与既定 Quarto 路线重复投资。[官方介绍](https://lexical.dev/docs/intro)、[与 ProseMirror 比较](https://lexical.dev/docs/concepts/compared-with-prosemirror)、[LICENSE](https://github.com/facebook/lexical/blob/main/LICENSE)。

### 外部审稿文件（缺口，不新增产品承诺）

DOCX 是 ZIP/OOXML 包。Mammoth 的目标是 DOCX→HTML 的语义转换，README 明确复杂文档转换可能不完美；它可用 `comment-reference` style map 显示部分 comments，但并未给出保留全部 comment anchor、reply、人物、批注范围和 track changes 的契约。不能据此将它当作审稿修订导入器。`docx` npm（dolanmiu）README/quickstart 的职责为 TypeScript/JavaScript DOCX 生成，不能反向读档。Office Open XML SDK 的官方资料确实展示 comment part 读取和 revision 接受/遍历，为 OOXML 结构解析提供可参考契约；但这是 .NET SDK，不是项目当前 JS/TS runtime 的直接依赖方案，且未调查其许可、完整修订覆盖率和三平台分发，本轮不推荐直接采用。可先将 docx 当 ZIP，解析 `word/document.xml`、`word/comments.xml`、relationships 与 `w:ins`/`w:del` 等节点，保存原件并显式报告不支持内容；需要成品路线另开调查。

PDF.js `PDFPageProxy.getAnnotations()` 暴露 PDF 原生 annotations，可读文字/位置/author 等 PDF 字段，适用于批注层提取；对扫描件/画线等内容语义、第三方扩展和非标准 PDF 的恢复能力必须按样本验证。PDF 注释与 Word track changes 是不同格式问题，不存在一个 reader 自动覆盖两者。[Mammoth README](https://github.com/mwilliamson/mammoth.js/blob/master/README.md)、[docx 生成库](https://github.com/dolanmiu/docx)、[OOXML 读取 comments](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-retrieve-comments-from-a-word-processing-document)、[OOXML 修订操作](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-accept-all-revisions-in-a-word-processing-document)、[PDF.js `getAnnotations`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)。

**主 Agent 补查：应先比较成品审阅组件，再考虑自行解析 OOXML。** 两个更贴近评论/修订的候选如下，均未安装或运行：

| 候选 | 能省去的实现 | 实际边界与建议 |
| --- | --- | --- |
| `docx-preview` / docxjs | 浏览器 DOCX 阅读；可开启评论和插入/删除的呈现 | [README](https://github.com/VolodymyrBaydalka/docxjs/blob/master/README.md) 把 `renderChanges`、`renderComments` 标为实验功能；仅 `renderAsync` 被明确承诺稳定，`parseAsync` 和内部对象可变化。[LICENSE](https://github.com/VolodymyrBaydalka/docxjs/blob/master/LICENSE) 为 Apache-2.0。适合只读审稿预览原型；HTML 分页限制、评论关系和完整修订类型需样本验收，不能将其内部对象当稳定导入协议。 |
| SuperDoc | DOCX 查看、评论、修订接受/拒绝及导出；官方还提供 Node SDK/Document API | 当前官方仓库是 [superdoc/docx-editor](https://github.com/superdoc/docx-editor)；旧地址可跳转。已实读 [README](https://raw.githubusercontent.com/superdoc-dev/superdoc/main/README.md) 与 [AGPLv3 LICENSE](https://raw.githubusercontent.com/superdoc-dev/superdoc/main/LICENSE)，另有商业授权。v2 采用 OOXML 文档模型，浏览器编辑不要求独立服务器；[修订流程](https://docs.superdoc.dev/editor/track-changes/)和[导出说明](https://docs.superdoc.dev/editor/export-options/)覆盖待决定修订，但有运行时功能差异。推荐作为外部审稿的成品组件对照，不替代 QMD/Quarto 主编辑器，也不为此增加多人协作。 |

SuperDoc 的 [Document API](https://docs.superdoc.dev/document-api/reference/) 有评论、修订与导出接口，值得核实 GUI 和内核能否共用读取结果；不能由功能列表推断任意 Word 文档都无损，或自动将评论范围映射到另一个版本的 QMD。其浏览器[遥测默认开启](https://docs.superdoc.dev/editor/telemetry/)，若采用需显式关闭以符合既有默认本地诊断方向，并在实际离线包核对字体、worker、资源及网络请求。官网与 main 是移动来源，本轮未固定组件版本或建立完整依赖/SDK兼容矩阵。

因此，这项的准确结论是“已找到审阅组件候选，尚未证明 Scholoom 的反馈迁入与跨格式定位契约”，不应直接进入手写完整 DOCX parser，也不应承诺通用无损导入。

## 组合边界与接入形态

组件之间应按职责衔接，不能把多个 viewer/编辑器各自的内部对象暴露成产品数据契约。

| 层 | 运行位置 | 依赖交付方式 | 可复用内容 | 产品必须拥有的状态 |
| --- | --- | --- | --- | --- |
| PDF viewer | Electron renderer / Chromium | npm 包 + 本地 worker/WASM/字体 | 分页、文本层、选区、渲染、PDF 注释 UI | 来源与材料版本、批注实体、证据关系、保存事务 |
| EPUB / snapshot | Electron renderer / Chromium | 固定源码组或 npm 引擎 | 文档呈现、DOM 范围、CFI/selector、查找 | 统一位置、网页快照修订识别、重锚、批注权威 |
| QMD 可视模式 | React renderer | Quarto monorepo 内部包源码 | Pandoc AST、学术节点、编辑 commands | 当前源文件、不可表示内容、草稿、并发与撤销 |
| QMD/LaTeX 源模式 | React renderer | CodeMirror npm 包 | 文本编辑、语法、扩展接口 | 文件权威、语言服务调用、受管保存 |
| LaTeX build/LSP | Node child process | 随应用分发的独立工具 | 诊断、构建、SyncTeX 线索 | 授权、状态、日志、取消、成果版本 |
| 引用处理 | 受管 CLI + 文献服务 | Quarto/Pandoc/CSL 资源；可选 Citation.js | 标准语法解析、转换、排版 | 稳定题录 ID/key、来源、字段候选、证据语义 |

**阅读接线顺序。** 由内核材料服务向工作台提供只读来源/版本和受控批注操作；renderer 选择 PDF、EPUB 或快照组件呈现。
选择事件应返回组件坐标与文本上下文，由适配层转换为 Scholoom 位置 DTO，再进入共同批注/证据存储。
Agent 使用同一材料服务读取原文和位置，不依赖启动 renderer，也不把 viewer 的临时选区对象当作持久引用。
批注撤回/重做、替换附件和材料版本迁移由领域服务判定；组件重新加载只读取投影后的状态。
PDF 导出属于原件衍生物，输出文件和 source artifact 分开；失败不会覆盖原始附件。
EPUB CFI 与 DOM selector 需要保存引擎及算法版本，升级锚点算法时可重新计算而不改写原始批注文本。

**QMD 接线顺序。** Quarto editor 的 `EditorServer` 适配到内核 Pandoc、bibliography、xref 与资源服务；`EditorUI` 只接桌面交互。
Quarto React wrapper 可以提供可用控件，但它依赖 editor-ui 的 Redux、Fluent UI、翻译、theme/widgets，接入成本高于底层 `Editor`。
可视模式载入 `setMarkdown` 返回的未识别项必须进入显式源码保留/可定位路径；不可因为 UI 可打开就认定整篇可无损编辑。
源/可视切换共享同一文档版本。外部改动到达时应基于共同保存事实处理，不让两个 editor 各自形成长期权威。
Quarto writer 可以重排空白和标记写法；验收按结构语义、引用目标与未知块保存判断，不要求字节相同。
编辑器 UI/模块不应暗中触发 Quarto render 或执行 code cells；预览/工程执行由单独受管任务与用户授权驱动。

**LaTeX 接线顺序。** CodeMirror 负责文本交互，stex 给轻量着色，texlab 提供 LSP 诊断/导航，latexmk 按真实工程配置编译。
texlab 和 latexmk 同时开启 watch 会让 build 通知脱节；按官方说明，实时同步采用 texlab 的 on-save build 或由 Scholoom 调度一次构建，不重复开两个 watcher。
SyncTeX 只提供源行与 PDF 位置关联，实际跳转仍需要 viewer API/命令、路径映射和活动 PDF 版本一致。
官方例子依赖 SumatraPDF、Skim、Evince、Okular 等外部 viewer；Scholoom Electron viewer 的正反向跳转并未由这些例子证明。
故障时编译文件不能直接写入正在展示的成功产物。stage→验证退出码/目标 PDF→原子发布是内核交付边界，不属于 latexmk 已证能力。

**引文接线顺序。** QMD 中 `@key`, locator、组合引用和 bibliography 字段保持 Pandoc/Quarto 语法；LaTeX 工程沿既有 BibTeX/BibLaTeX 与模板。
文献服务提供稳定引用键与题录源数据；Pandoc/citeproc 根据 CSL style 做渲染，输出展示形式。
Citation.js 可在导入/导出边缘转换 DOI、BibTeX、RIS 和 CSL-JSON；转换结果应作为候选并报告缺失/合并字段。
CSL style 与 locale 文件自身有内容授权和贡献者元信息；打包可用的离线样式需保存版本、来源、归属和本地修改。
引用呈现正确只说明格式处理结果；正文主张是否被来源支持，仍需证据服务和研究任务判断。

## 平台、维护和许可核对摘要

- TypeScript/React/Electron 是可行的 renderer 路线：CM6、Quarto editor UI、Tiptap、Lexical、EmbedPDF React 均可在 Chromium DOM 使用。
- Electron 三平台共用 renderer 代码，不代表本地工具共用产物：PDF worker/WASM、Node native module（若引入）、texlab 与 TeX 工具链需要目标平台资产。
- Quarto、Pandoc、latexmk、texlab 都更适合作为随应用管理的 CLI 子进程；web 示例不能证明 Electron 自定义协议、沙箱、worker URL、路径授权已正确。
- PDF.js 和 EmbedPDF worker 需要打包并验证离线；EPUB 解压/字体和 snapshot iframe CSP 也属于实际资源边界。
- 单纯 npm 依赖的升级通常可以围绕公开 API 与 semver 锁定；Quarto 内部 editor 的源码吸纳需要维护定点、补丁、构建图、传递依赖与上游变更合并。
- Zotero reader DOM/EPUB 模块也不是 npm dependency；复用整组源码会继承源码升级、AGPL 及第三方模块审查，团队维护投入比普通包更高。
- 上游 release/commit 活跃只证明有人发布或维护，不证明 Scholoom 的具体组合、稳定性、互操作、长期安全修复或中文体验。
- MIT/Apache 依赖通常没有付费门槛；EmbedPDF 的 CloudPDF server FCL 授权与 viewer SDK 分开。Tiptap Pro 扩展属商业扩展；开源 core 本身免费。
- Quarto 自有模块按 PR #1032 范围为 MIT；`bibliojson` 等随包依赖按各自许可和 ThirdPartyNotices 处理，官网 LGPL 标记属于文档漂移。
- PDFium、PDF.js、reader 及格式资源可能各自携带第三方代码/数据；本报告核实上游主 LICENSE，不替代最终 SBOM 与发行包的逐资源归属清单。
- texlab/latexmk GPL 组件的随包分发需确认源代码对应提供方式；用子进程不等于豁免分发义务。
- 免费开源组件没有供应商 SLA；遇到关键缺陷时 Scholoom 可能需要固定源码修复、回馈上游或临时维护 fork。

维护成本大致分三档：稳定公开 npm API 的依赖随锁文件更新；独立 CLI 需做版本、平台和许可证分发管理；Quarto/Zotero 内部模块源码吸纳还需长期同步上游内部改动。
优先让 npm 依赖留在 renderer，让 CLI 生命周期和产物保护留在内核；这样 UI 崩溃不会成为构建状态或最近成功产物的唯一保管处。
若固定 fork，提交中记录上游 commit、必要 cherry-pick 和本地适配点；不能只记依赖的语义版本而丢失源码来源。
产品文档与版本界面要显示实际组件基线，用户材料中的 CFI/selector 或构建产物可能依赖它们。
所有版本建议仍以实施时再调查为准；本报告发布日期不能替代 dependency lock 或供应链审查。

## 外部审稿导入的最小边界

- DOCX 中评论正文通常位于 comments part，正文锚点由 comment range/reference 标记；修订则分散在 document/run/property 节点的插入、删除及格式变更标记。
- 导入结果至少要保留 comment id、author/date、正文、目标文本/范围、修订类型、前后内容和原文件定位；部分 Word 新版评论可能还有额外 parts/关系。
- Mammoth 的 comment-reference 映射只是转换呈现能力；它的目标输出是语义 HTML，不能推断保留 comment 元数据全量、回复线程、修订接受状态和版式分页锚点。
- `docx`（dolanmiu）按官方 README 是生成器，即便支持生成评论/修订，也不能推断具备任意 DOCX 完整解析能力。
- Microsoft Open XML SDK 文档可用于核对 WordprocessingML comments/revisions 契约，但 SDK 属 .NET，不符合当前直接依赖语言路线；可参考格式规范，不据此引入新运行时。
- PDF `getAnnotations()` 可以取到原生批注对象；高亮、文本注释、弹出评论、自由文本与页面区域需要按 PDF 类型逐项适配，扫描图上的手写圈画不一定有 annotation 对象。
- PDF 线性化文本、字形和页面几何常不足以恢复“批注针对哪句话”；应存原生坐标、引用文本和版本，并提供人工核验。

本轮没有验证任何 DOCX/PDF 审稿样本，未最终选定导入库；可先比较 docx-preview 的只读预览与 SuperDoc 的成品审阅/Document API。接收阶段仍保留原件，标出确实抽出的评论/修订和无法解析项。

## 最需原型验证的 4 项

1. **PDF 批注位置与往返：** 选取扫描/双栏/跨页、旋转页面样本；EmbedPDF 添加高亮和 note、导出，再由 PDF.js 与至少一个桌面 viewer 重开。验收：页号、矩形/QuadPoints、文字内容、作者/时间可读；原 PDF bytes 保持，失败不覆盖；材料换版后定位标为需核验而不是默认为正确。
2. **离线 PDF 与三平台包：** 断网运行 Linux/Windows/macOS 构建；验收：无 CDN 请求，worker/WASM/CMap/字体在本地可解析，选择/搜索/注释/导出完整工作，冷启动无资源 404。当前仅文档/源码依据，没有实跑。
3. **Quarto 可视编辑保存：** 准备复杂 QMD，含 YAML、citations、组合引文/locator、交叉引用、raw TeX/HTML、未知 shortcode 与大表；源码→visual→保存→源码往返。验收：已支持节点语义与引用目标不变，未知节点保留原文且可回源码，外部并发修改不静默覆盖；接受合理格式规范化，检查 diff 而非只看渲染。
4. **LaTeX 预览与失败保护：** 多文件工程+BibLaTeX+图片，启用 texlab diagnostics、latexmk、SyncTeX；引入可控编译错误并快速连续保存。验收：诊断文件/行可导航；正反向定位到源码行；失败时上次成功 PDF 仍可打开且明确标旧版本；连续 build 不读到半写 PDF，恢复成功才替换。再测三平台工具与 viewer 差异。

## 上游之上仍需维护的领域责任

- 一个来源/材料版本绑定的跨格式位置与证据契约：PDF page+geometry/text quote，EPUB CFI，网页 selector；迁版的重锚和置信度。
- GUI 与 Agent 共用的批注、书签、文本读取和保存服务；原文来源、作者角色、文献与项目事实不能留在 reader 私有状态。
- QMD/Pandoc/LaTeX 的权威文件组、语法识别能力、未知内容保护、源文件/草稿/并发修改和保存事务。
- 题录稳定 ID/citation key 与来源记录；格式转换只能产生候选，不应覆盖用户字段或当作事实核验。
- 受管渲染、授权、日志、取消、失败报告、最后成功产物发布与来源配置记录。
- DOCX/PDF 外部反馈按原件保存、可读评论/修订与正文位置关联、无法识别时保留材料并报告；本次不选择实现库，也不承诺无损转换。

## 调查边界与待核实项

- 共 16 个编号候选/生态项：EmbedPDF、PDF.js、PDFium、Zotero reader PDF、Zotero DOM 阅读层、epub.js、foliate-js、Quarto editor、CodeMirror Markdown、stex、texlab、latexmk/SyncTeX、Pandoc/Quarto/citeproc/CSL、Citation.js、Tiptap/ProseMirror、Lexical；另补 docx-preview、SuperDoc，以及 Mammoth/docx/OOXML 与 PDF annotations 的缺口盘点。
- 没有对任一候选执行构建、平台包或往返读写；离线、CSP/worker、三平台资源路径、性能、真实注释互操作都需上述原型验证。
- Quarto 自有 Visual Editor 模块 MIT 许可及 19 个 packages/apps 的范围已由合并 PR、固定 README/package.json 核实；`apps/writer` 和 `apps/writer-server` 仍为 AGPL-3.0。官网 LGPL 标记为文档漂移。集成分发仍需按构建产物附带 ThirdPartyNotices、Apache/BSD notices 与可重建的 `bibliojson` LGPL-3.0 源码；不要把整个依赖树写成 MIT。
- texlab 当前 GPL 许可文件路径由 CTAN/仓库元数据确认，仓库 COPYING 路径在工具请求中返回 404；正式分发前应检查实际 release tarball 的 license 文件。
- latexmk 的许可和连续模式已核查；其最近稳定版本号、具体 Windows/macOS/Linus 安装与 viewer 自动重载组合未在本次确认。
- DOCX 读取替代项只核对官方 OOXML SDK 文档与功能边界，未比较 JS ZIP/XML parser、SDK 许可、修订类型覆盖、注释回复和真实审稿样本。
- PDF.js API 文档为 draft 页面；应以选择的固定 release API 和样本验证，不能把 draft API 直接视作稳定契约。
