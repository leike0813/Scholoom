# 源码编辑器集成事实核对：CodeMirror 6 与 Monaco（固定版本）

核对日期 2026-10-04。方法：只读 npm registry 元数据 + 固定版本 tarball 在临时目录解包读文件。
**未安装依赖、未运行脚本、未构建、未启动应用。** 许可判断逐包核对包内 `LICENSE` 正文，不用仓库级 SPDX 代替。

## 版本与许可（tarball 内 LICENSE 正文）

| 包 | 版本 | gitHead | 包内 LICENSE 首行 |
| --- | --- | --- | --- |
| `@codemirror/lang-markdown` | 6.5.2 | `f90daf6e56a72f1cf8bbe10b07867f535d0ad2e4` | MIT, Copyright (C) 2018-2021 by Marijn Haverbeke |
| `@codemirror/legacy-modes` | 6.5.4 | `1f2107b74b03223c97fa6812dd4fbf70b3d046df` | 同上（同一发布者/同一许可文本） |
| `@codemirror/view` | 6.43.13 | `59d70a1edbb9641161e34333f132cfd4be2e6596` | 同上 |
| `@codemirror/language` | 6.12.4 | `89974ce5d39539ce6c5cfea5278443fa9381cbf2` | 同上 |
| `codemirror`（basic-setup） | 6.0.2 | `76462c05acb10fe77e0f04edd7fcddfeb9987abd` | 同上 |
| `monaco-editor` | 0.57.0 | npm 元数据无 `gitHead` 字段 | MIT, Copyright (c) 2016 - present Microsoft Corporation |

`monaco-editor@0.57.0` 另随包发布 `ThirdPartyNotices.txt`，运行时依赖只有 `marked@14.0.0` 与 `dompurify@3.4.15`。

## 1. CodeMirror 6 的 Markdown（`@codemirror/lang-markdown@6.5.2`）

- 导出面：`markdown(config)`、`commonmarkLanguage`、`markdownLanguage`、`markdownKeymap`、`insertNewlineContinueMarkup`、`deleteMarkupBackward`、`pasteURLAsLink`。见 `dist/index.d.ts` 末行导出清单。
- `markdown()` 默认 `base` 是 `commonmarkLanguage`（严格 CommonMark）；只有显式传 `base` 才换解析器，并要求其是 `MarkdownParser` 实例。`markdownLanguage` 是 `commonmark` 叠加 `GFM, Subscript, Superscript, Emoji`（另加表格折叠 props）。
- 语法树来自 `@lezer/markdown` 的 `MarkdownParser`；包内做的是折叠、缩进、注释标记、HTML 标签语言嵌套、围栏代码块 `parseCode`、Enter/Backspace 命令、HTML 标签补全。
- **层级**：这是「解析 + token 高亮 + 编辑行为」。包内源码检索不到 `math` / `cite` / `ef` 等字样，即 `$…$`、引文与交叉引用不是该包的构造概念；也没有 hover、诊断、语义标记。
- 官方 README 用法为 `new EditorView({parent: document.body, doc, extensions: [basicSetup, markdown()]})`。

## 2. LaTeX：`@codemirror/legacy-modes/mode/stex` 的实际导出

- `mode/stex.d.ts`：`export declare const stex: StreamParser<unknown>`、`export declare const stexMath: StreamParser<unknown>`；需再经 `StreamLanguage.define` 得到 `Language`。包 `exports` 映射为 `./mode/*` → `./mode/*.js`。
- `mode/stex.js` 245 行，`mkStex(mathMode)` 内部只有 `startState/copyState/token/blankLine` 与 `languageData: {commentTokens: {line: "%"}}`。
- 产出形态：全文 23 处 `return "…"`，取值如 `bracket / tag / keyword / comment / atom / number / variableName.special / error`。文件内不引用 `syntaxTree`、节点类型或任何结构产物。
- **层级**：提供 token 级着色，没有 LaTeX 命令、环境、引文和引用的语义结构。`StreamLanguage` 可将 token 组织成供高亮使用的树，不能据此认定具备 LaTeX 语义解析、工程导航或诊断。完整工程能力需另接语言服务。

## 3. `EditorView` 的 DOM 生命周期（`@codemirror/view@6.43.13`，`dist/index.d.ts`）

- `EditorViewConfig.parent` 注释：给出即在创建时把编辑器挂到该元素；不给则需自行把 `dom` 放入文档。`dom` 为外层元素，`contentDOM` 为可编辑内容元素。
- `destroy()` 注释：「移除其元素、注销事件处理器、通知插件；调用后该实例不可再使用」。`setRoot(root)` 注释限定为「把已有 DOM 移到新的 window 或 shadow root」。
- `static findFromDOM(dom)`：由既有 DOM 反查 view 实例（可作为「DOM 已被外部接管」的探测点）。
- 官方 examples 目录索引（`https://codemirror.net/examples/`）共 27 项，其中无 React 集成示例；`https://codemirror.net/docs/` 首页无 `react` 字样。本轮核对的 CM 包内也无 React 相关导出或依赖。
- **未验证**：各 examples 的具体源码、官方文档分页面（per-package ref 页）是否另有 React 说明、以及任何第三方 React 封装。

## 4. `monaco-editor@0.57.0` 语言注册的实际包内路径

- **上一轮 404 的原因已定位为路径变更**：`esm/vs/basic-languages/` 在 0.57.0 tarball 里只剩 `monaco.contribution.js`，其内容是一串 `import '../languages/definitions/<lang>/register.js'`。语言定义已迁到 `esm/vs/languages/definitions/`。
- Markdown 实际文件：`esm/vs/languages/definitions/markdown/register.js` 声明 `id: "markdown"`、extensions `[.md,.markdown,.mdown,.mkdn,.mkd,.mdwn,.mdtxt,.mdtext]`、aliases、`loader: () => import('./markdown.js')`；同目录 `markdown.js` 为 Monarch 定义（`defaultToken` / `tokenPostfix` / `tokenizer` 对象，228 行）。
- `register.js` 走 `languages.register(def)` + `registerTokensProviderFactory(id, {create: async () => (await lazyLoad()).language})`，即**懒加载**的 token provider。`markdown.js` 是 token 着色，不产出结构化语法树。
- **LaTeX**：`esm/vs/languages/definitions/` 完整清单为 83 个语言目录（另有 `_.contribution.js` 与两份 `register.all.*`），其中含 `markdown`、`mdx`，**不含 `latex` 或 `tex`**。这是逐项比对完整目录清单，不是由 404 推断。
- **worker 型语言能力走另一条路径**：`esm/vs/languages/features/{css,html,json,typescript}/register.js`，各自 `workerManager.js` 以 `new Worker(new URL('ts.worker.js', import.meta.url), {type: 'module'})` 启动，并使用随包发布的 `esm/external/vscode-*-languageservice`。这些能力按 label（typescript/javascript/css/html/json）绑定，**不覆盖 markdown**。
- 0.57.0 还随包发布 `esm/external/monaco-lsp-client/out/index.js`，并在 `esm/vs/index.js`、`esm/vs/editor/editor.main.js` 顶部 `export { index as lsp }`。本轮未核对该客户端的协议范围与可用 provider。

## 5. worker 资产加载与离线打包边界（源码可读的硬约束）

- `esm/vs/editor/standalone/browser/services/standaloneWebWorkerService.js`：先尝试 `monacoEnvironment.getWorker('workerMain.js', descriptor.label)`；其次 `getWorkerUrl(...)` 并用 `new URL(url, document.baseURI)` 解析；两者都没有且 descriptor 无 `esmModuleLocationBundler` 时直接抛错。
- `esm/vs/internal/common/workers.js`：无 `createWorker` 时同样抛错，文案为 `You must define a function MonacoEnvironment.getWorkerUrl or MonacoEnvironment.getWorker`。
- `esm/vs/platform/webWorker/browser/webWorkerServiceImpl.js` 用 `createBlobWorker(url, {name, type: 'module'})` 创建，即 worker 以 **ESM + blob URL 引导**运行；失败提示要求打包器正确处理 `new URL('…?esm', import.meta.url)`。
- 由此可读出的边界：worker 脚本必须作为独立构建资产产出，运行时不能依赖外部 URL/CDN。**未验证**：在 Electron `file://` 或自定义协议下的实际解析行为（未运行）；也不能据此断言 monaco 一定发起或一定不发起网络请求。

## 6. 能力分层对照（本轮证据范围内）

| 层级 | CodeMirror 6 路径 | Monaco 0.57.0 路径 |
| --- | --- | --- |
| token 着色 | `@codemirror/lang-markdown`；`legacy-modes/mode/stex` | `languages/definitions/markdown/markdown.js`（Monarch） |
| 文稿语法结构 | Markdown 有 `@lezer/markdown` 结构；stex 仅 token 级能力 | 内置 Markdown 为 Monarch tokenizer；未随包提供 LaTeX 定义 |
| 文稿 LSP / 诊断 / 语义 | 本轮核对的 Markdown 与 stex 模块不提供 | 内置 Markdown 注册未提供；LSP 客户端和社区扩展未验证 |
| 完整工程能力（工程导航、格式化服务、协作、宿主集成） | 未核对 | 未核对 |

体积不作比较：`monaco-editor` tarball 是含全部语言、worker、`esm/`+`min/` 双份产物的完整发布包（1918 个文件），与 CM 单个语言子包不是同类对象，本报告不做跨包体积对比。

## 7. 未验证与不作断言的部分

1. 未安装、未运行、未构建任何依赖；全部断言来自 registry 元数据与 tarball 内文件。
2. `monaco-editor` 的 `dev/`、`min/` 与 `esm/` 一致性、`monaco.d.ts` 与内部实现同步情况未核对。
3. Electron 下的 worker/CSP/`file://` 实际行为未验证。
4. 第三方 React 封装（社区包）与社区 LaTeX 扩展未在本轮范围内，也不构成任何结论。
5. `stex` 对具体命令（如 `\cite`、`\ref`、`equation`）的着色覆盖细节未逐条核对，只核对了产出形态。
6. CodeMirror 的增量解析调度与大型文档性能、monaco 的运行内存均未验证。
7. 与 Quarto/pandoc 等既有项目资产的关系不在本轮范围。

## 固定版本源码链接

- CM Markdown：<https://unpkg.com/@codemirror/lang-markdown@6.5.2/dist/index.js>、<https://unpkg.com/@codemirror/lang-markdown@6.5.2/dist/index.d.ts>。表内 gitHead 来自 registry；不将其他提交链接当作同一发布源码。
- CM LaTeX stream mode：<https://unpkg.com/@codemirror/legacy-modes@6.5.4/mode/stex.js>、<https://unpkg.com/@codemirror/legacy-modes@6.5.4/mode/stex.d.ts>、<https://unpkg.com/@codemirror/legacy-modes@6.5.4/LICENSE>
- CM view 生命周期：<https://unpkg.com/@codemirror/view@6.43.13/dist/index.d.ts>、<https://github.com/codemirror/view/blob/59d70a1edbb9641161e34333f132cfd4be2e6596/src/editorview.ts>
- CM language（StreamLanguage 定义）：<https://unpkg.com/@codemirror/language@6.12.4/dist/index.d.ts>
- Monaco 语言注册：<https://unpkg.com/monaco-editor@0.57.0/esm/vs/languages/definitions/markdown/register.js>、<https://unpkg.com/monaco-editor@0.57.0/esm/vs/languages/definitions/markdown/markdown.js>、<https://unpkg.com/monaco-editor@0.57.0/esm/vs/languages/definitions/_.contribution.js>、<https://github.com/microsoft/monaco-editor/blob/v0.57.0/src/languages/definitions/markdown/register.ts>
- Monaco worker：<https://unpkg.com/monaco-editor@0.57.0/esm/vs/languages/features/typescript/workerManager.js>、<https://github.com/microsoft/monaco-editor/blob/v0.57.0/src/languages/features/typescript/workerManager.ts>、<https://unpkg.com/monaco-editor@0.57.0/esm/vs/editor/standalone/browser/services/standaloneWebWorkerService.js>、<https://unpkg.com/monaco-editor@0.57.0/esm/vs/internal/common/workers.js>、<https://unpkg.com/monaco-editor@0.57.0/esm/vs/platform/webWorker/browser/webWorkerServiceImpl.js>
- Monaco 许可：<https://unpkg.com/monaco-editor@0.57.0/LICENSE>、<https://unpkg.com/monaco-editor@0.57.0/ThirdPartyNotices.txt>
