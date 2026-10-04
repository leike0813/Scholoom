# Quarto 可视编辑模块的宿主与复用边界

调查日期：2026-10-04。关联 [#12 技术栈](../issues/12-technology-stack.md)。固定源码 `quarto-dev/quarto@a83c5cc597e61a28700ceacda86c15b9ef565e82`，下载到 `/tmp/scholoom-quarto-editor-a83c5cc/` 静态查读；没有安装、构建、运行或修改上游。本文补充并收敛 [初步调查](source-and-visual-editor-reuse-facts.md)中的未决事实。

## 已有实现，而非从底层框架重建

`packages/editor` 的 `Editor` 导出 `create(parent: HTMLElement, context: EditorContext, format, options, theme)`，以及 `setMarkdown`、`getMarkdown`、事件、位置、命令和 `destroy` 等入口。`EditorContext` 的核心是注入 `EditorServer` 与 `EditorUI`，可追加扩展和代码编辑扩展。它不是一件必须先启动 VS Code 才能构造的界面对象。[Editor](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/editor/editor.ts)

内部已经由 extension manager 建立 ProseMirror Schema，并注册 math、cite、xref、表格、图像／figure、脚注、YAML、raw block／inline、shortcode、代码块等扩展。Pandoc AST 与 ProseMirror 的双向转换也已存在。复用此模块可以保留这些实现；此前“须由本项目从头实现学术 schema 和转换”的推断不成立。[扩展注册](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/editor/editor-extensions.ts)、[Schema](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/editor/editor-schema.ts)、[转换器](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/pandoc/pandoc_converter.ts)

本轮在 editor、editor-ui、editor-core、editor-types、editor-server 内没有找到直接 import `vscode` 模块的调用；存在 `vscode-languageserver-types` 等共享类型依赖，不等于 VS Code 应用运行时依赖。这是静态搜索边界，未完整构建验证全部传递依赖。

## 宿主需要提供什么

| 接口 | 已有契约 | Scholoom 的适配职责 |
| --- | --- | --- |
| `EditorServer.pandoc` | capabilities、Markdown→AST、AST→Markdown、extension 列表、bibliography 查询／添加、citation HTML | 接入内核的受管转换和引用资源服务，匹配 Pandoc 版本、writer 参数及 Lua 资源 |
| `EditorServer` 其他服务 | doi、crossref、datacite、pubmed、xref；zotero／environment 可选 | 按实际功能连接服务和文献权威；远程查询的来源与调用范围由本项目管理 |
| `EditorUI` | dialogs、display、context、prefs、images 必需；math、spelling、codeview、chunks 可选 | 复用适用 UI，再接上工作台资源、偏好和数学显示；代码执行回调走既有内核 |
| `EditorUIContext` | 文稿路径、保存服务端副本、资源目录、路径映射、资源监听、活动标签、剪贴板、翻译 | 映射到开放文稿与草稿、工作台和系统集成；不能另建当前正文权威 |
| 文稿更新 | `setMarkdown`／`getMarkdown`／UpdateEvent 等 | 管理模式切换、保存、外部编辑保护和草稿恢复 |

接口依据：[EditorServer](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-types/src/server.ts)、[PandocServer](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-types/src/pandoc.ts)、[EditorUI](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/api/ui-types.ts)。

`packages/editor-server` 已有 Node Pandoc 执行适配，使用 `child_process.execFile`，服务端包含 `heading-ids.lua`、`md-writer.lua` 等资源。可吸纳转换、bibliography 和 xref 相关实现；其默认 Zotero 本地／Web 查询和独立 SQLite WASM 存储不是 Scholoom 文献权威，应按本项目服务替换。JSON-RPC 方法可以通过内核适配暴露，不需要另立一个权威服务。[Pandoc 服务](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-server/src/server/pandoc.ts)、[执行适配](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-server/src/core/pandoc.ts)

`packages/editor-ui` 已有 React 组件 `Editor`，其 props 包含 `uiContext`、`request: JsonRpcRequestTransport`、display、options 和初始化回调。它封装底层编辑器和多个对话框，内部依赖 Redux／RTK、Fluent UI、主题、翻译和 editor-codemirror，不能按普通无依赖叶组件理解。可复用底层 editor 并抽取所需 UI，或成组吸纳这个 UI 模块；本轮建议保留学术实现和有价值的交互模块，适配 Scholoom 宿主，具体切包随实际接入确定。[React 组件](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-ui/src/editor/Editor.tsx)、[UI package](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-ui/package.json)、[context 装配](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-ui/src/context/context.ts)

## 保存与内容保留是接入验收条件

上游用 Pandoc 写回 Markdown，存在行折行、列表、脚注等规范化行为；这影响源文件 diff，不等于内容损失。本项目采用 #11 的内容保留要求，不能因字节不同就判失败，也不能把规范化当作丢弃内容的理由。[官方 Markdown 写回说明](https://quarto.org/docs/visual-editor/markdown.html)

`setMarkdown` 返回 `canonical`、`unrecognized`、`example_lists`、`unparsed_meta`。底层 Pandoc reader 未找到 token handler 时记录未识别 token；不能假定这些内容已经无损保留。React 包装当前会检查未解析 metadata、残留 source capsule 和 example lists，但未见该载入路径检查 `unrecognized`。这些事实要求 Scholoom 在确有不支持内容时保留原文与源码入口，按实际支持的区域编辑；不能直接把返回的 canonical 文本覆盖原稿。[载入与返回值](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/editor/editor.ts)、[token 处理](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/src/pandoc/pandoc_to_prosemirror.ts)、[UI 载入检查](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-ui/src/editor/Editor.tsx)

这不是另立对所有日常编辑的字符串门禁；具体格式不能安全表示时保护相应文稿或内容，普通格式差异按 writer 配置处理。LaTeX 工程继续源码＋编译 PDF，不导入这套可视 AST 作默认编辑权威。

## 许可与交付形态

固定点的 editor、editor-types、editor-core、editor-ui、editor-codemirror、editor-server 及 core 等 package.json 声明 MIT；`apps/vscode/LICENSE` 是 Posit 的 MIT 文本。根目录没有统一 LICENSE 文件，因此该文件所在路径及其适用范围仍需与实际纳入的模块、第三方资源一起记录。GitHub 仓库识别为 AGPL 的元数据不证明这些包具有冲突许可。此处只记录来源声明，不代替逐项分发核对。[editor package](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor/package.json)、[MIT 文本](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/apps/vscode/LICENSE)

这些是 private 内部源码包，入口指向 `src/index.ts`，本轮没有独立发布组件包的证据。路线是固定源码、保留来源与声明、按模块吸纳并承担升级维护，不是假定 `npm install` 获得通用成品。源码能力与 host seam 已核实；独立构建、主题接入、组件依赖兼容、长文编辑性能、内容往返和三平台离线分发尚未验证。

## Q9 建议范围，待确认

QMD／MD 可视编辑优先吸纳 Quarto 的 ProseMirror／Pandoc 学术模块与适用 UI，适配本项目内核和工作台；源码编辑候选单独选择。不新增一套从零设计的学术 schema，不整体迁入 VS Code 应用。选择此方向意味着接受私有源码模块的抽取和维护成本，实际依赖版本与抽取范围在实现规格核对。

后续只围绕真实稿件验收：公式／引文／图表／交叉引用／YAML／代码单元的语义保留、切换与保存、非支持内容保留、外部改稿保护、文献查询与文件资源定位。当前讨论不启动原型或实现规划。
