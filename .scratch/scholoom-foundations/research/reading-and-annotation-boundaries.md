# 阅读与批注边界：Zotero reader / note-editor 源码核验

> 为 Scholoom 的阅读、批注和写作议题提供可核实的现状事实；不选择主格式，也不把组件现状等同于完整稿件工作流。仅静态阅读源码和包元数据，未构建或测试。

## 核验基准

- Zotero 主仓 HEAD：[`2cdc2cc3b7dbc39d2ba152f03b680ca84a23bae9`](https://github.com/zotero/zotero/tree/2cdc2cc3b7dbc39d2ba152f03b680ca84a23bae9)。主仓 gitlink 与子模块实际 HEAD 一致：reader [`692c28989629acf920fadb683747e18e5506b214`](https://github.com/zotero/reader/tree/692c28989629acf920fadb683747e18e5506b214)；note-editor [`7c92b77b22bda9f4a86b458e9921679b6e8b8e1`](https://github.com/zotero/note-editor/tree/7c92b77b22bda9f4a86b458e9921679b6e8b8e1)。
- 入口资料为 [12-阅读器.md](../../../references/Zotero/12-阅读器.md) 与 [13-笔记编辑器.md](../../../references/Zotero/13-笔记编辑器.md)。源码核对修正了阅读器资料中“批注不存坐标”的概括。

## Reader：组件复用与宿主边界

- [`reader/src/index.web.js`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/index.web.js) 暴露 `window.createReader(options)`，设置 `platform: 'web'` 并创建 Reader；包装 `onOpenContextMenu` 调用 reader 自己的菜单，其余 options 传入核心。Web 入口不实现 annotation 数据库、文件访问或应用级持久化。
- 按启用功能，Electron host 需承接初始 `data`/`annotations`/阅读状态，`onSaveAnnotations`、`onDeleteAnnotations`、`onChangeViewState`、`onOpenContextMenu`、`onOpenLink`、`onOpenTagsPopup`；PDF 图片注释还需 `onRenderAnnotationImage` 或由组件生成并随保存传递；启用结构阅读需 `getSDTPack`，密码 PDF 需 `onRequestPassword`。部分回调可省略，但对应宿主行为也会缺失。契约入口：[`reader.js`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/reader.js)、[`view.js`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/view.js)。
- Zotero host 的跨 iframe 适配包含保存完成 callback、数据库事务/通知、图片缓存和删除；SDT pack 也由 host 取得后传给 Reader。这些是 Zotero 应用能力，不是 reader 通用存储接口。见主仓 [`xpcom/reader.js`](https://github.com/zotero/zotero/blob/2cdc2cc3b7dbc39d2ba152f03b680ca84a23bae9/chrome/content/zotero/xpcom/reader.js) 与 [`xpcom/sdt.js`](https://github.com/zotero/zotero/blob/2cdc2cc3b7dbc39d2ba152f03b680ca84a23bae9/chrome/content/zotero/xpcom/sdt.js)。
- 可复用部分是 PDF/EPUB/快照呈现与交互、注释 UI、位置映射和 React 界面；Electron 可评估 web 构建并提供自己的回调桥。存储、事务、权限、菜单和系统集成由 host 适配。Webpack 有 web/dev/Zotero 等入口；Zotero 入口带平台条件，不是 Electron 即插即用包。见 reader [`webpack.config.js`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/webpack.config.js) 与 [`package.json`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/package.json)。

## PDF 坐标与 SDT 映射

- PDF annotation 的位置确实保存 `pageIndex`、`rects`，可选 `paths`、`nextPageRects`。`pageIndex` 是零起始页索引；矩形属于 PDF 页面坐标系，跨相邻页选择将第二页矩形放入 `nextPageRects`。见 reader [`types.ts`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/types.ts) 和 [`page.js`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/pdf/page.js) 的坐标映射。
- SDT 另外提供结构化文本位置：内容树起止路径加文本偏移。`PDFPositionMapper` 可在 SDT 文本范围与 PDF 页面矩形间双向换算；只接受一页或两页相邻页的范围以避免截断，并可按注释类型变换位置（如 PDF note 固定尺寸矩形）。见 [`position-mapper.ts`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/sdt/position-mapper.ts) 与 [`pdf-position-mapper.ts`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/sdt/pdf-position-mapper.ts)。
- 版本需区分 pack 和 annotation：Zotero host 的 pack 缓存按源文件 hash、pack/schema 与处理器版本校验；reader session 检查 pack/schema 兼容性。见主仓 [`xpcom/sdt.js`](https://github.com/zotero/zotero/blob/2cdc2cc3b7dbc39d2ba152f03b680ca84a23bae9/chrome/content/zotero/xpcom/sdt.js) 和 reader [`document-session.mjs`](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/sdt/document-session.mjs)。annotation 持久化的 PDF 位置字段自身没有 source hash/version，因此 pack 校验不等于批注自动绑定文件版本或跨版本重定位；PDF 改版后几何位置仍可能失配，版本提示或重锚定属于应用策略。

## Note-editor：HTML 权威与 Markdown 能力

- `note-editor` 是 React + ProseMirror 富文本编辑器。`getData()` 返回 ProseMirror JSON state 与 HTML；初始化优先读取 JSON，失败再由 HTML 解析。schema/HTML 保存 citation 结构化属性和 schema metadata，因而当前完整持久化路径是 schema/state 与 HTML，不是 Markdown。见 note-editor [`editor-core.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/core/editor-core.js)、[`schema/nodes.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/core/schema/nodes.js) 和 [`schema/utils.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/core/schema/utils.js)。
- Markdown parser 用于编辑器中的识别/粘贴：只处理 clipboard 类型恰为 `text/plain` 且启发式判断为 Markdown 的内容。映射覆盖常用块、链接、表格、图片和数学，但源码没有提供完整稿件打开/保存 API。见 [`markdown-parser.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/core/plugins/markdown-parser.js)。
- Markdown serializer 是剪贴板文本输出：citation 输出格式化引文文本；内置图片 serializer 为空操作，underline/颜色等标记不输出对应 Markdown 语法。Zotero host 可加 translator 做 HTML→Markdown 转换，但不构成完整往返契约。现状不足以证明 Markdown/Quarto 可无损保存整篇稿件，尤其结构化引用 key/locator、metadata 和图片附件。见 [`markdown-serializer.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/core/plugins/markdown-serializer.js)。
- note-editor web 入口以 `postMessage` 向 host 交接更新、图片导入、引文列表和引用弹窗；复用 ProseMirror/UI 仍需适配 Scholoom 的稿件存储、citation provider、附件与生命周期。见 [`index.web.js`](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/src/index.web.js)。

## 许可证

- reader 与 note-editor 的 `package.json` 都声明 `AGPL-3.0`，各自 `COPYING` 也写明 GNU Affero General Public License v3，并保留 Zotero 商标与第三方版权声明。见 [reader package.json](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/package.json)、[reader COPYING](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/COPYING)、[note-editor package.json](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/package.json)、[note-editor COPYING](https://github.com/zotero/note-editor/blob/7c92b77b22bda9f4a86b458e9921679b6e8b8e1/COPYING)。这里只记录仓库声明，不推断 Scholoom 分发形态的法律结论。
