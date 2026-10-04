# 03 调查：Zotero 原插件在 Electron 宿主的加载能力与依赖边界

- 票：[03-zotero-plugin-host-research.md](../issues/03-zotero-plugin-host-research.md)
- 结论接收方：决策票 05（[05-zotero-compatibility-policy.md](../issues/05-zotero-compatibility-policy.md)）
- 调查日期：2026-10-03
- 方法：**静态源码分析 + 官方文档核对；未在任何宿主中运行插件，未做运行验证**。所有“需要/可以”均为源码推断，标注为静态判断。
- 后续运行证据：[2026-10-04 原包宿主原型](zotero-host-prototype-results.md)在 Zotero 10.0.5 实测 BBT 与茉莉花 1.1.39。该版本 Reader 书签按钮保存到 sidecar，实测 PDF 字节未变；下面静态能力分析不构成所有功能的运行验收。
- 快照版本：Better BibTeX `retorquere/zotero-better-bibtex` 分支 `master`，`package.json` version `9.0.68`（源码包时间戳 2026-10-01）；茉莉花 `l0o0/jasminum` 分支 `main`，`package.json` version `1.1.39`（源码包时间戳 2026-09-02）。
- 说明：本仓库 `references/Zotero` 与 `references/zotero-agents` 是二手快照，**不作为上游事实来源**；本文结论以官方文档与上游仓库原始文件为准，快照仅用于交叉印证。文中路径为上游仓库内相对路径。

## 一页结论（供决策票 05）

两个插件都是“Gecko 特权插件”，不是 WebExtension。它们**无法通过 Electron 的扩展机制加载**：Electron 只支持解包（unpacked）的 Chrome MV2/MV3 扩展，明确把“完整兼容 Chrome 扩展实现”列为 non-goal，且没有任何 XPI / Mozilla AddonManager / `bootstrap.js` / XPCOM 支持（Electron 官方文档 Chrome Extension Support）。Zotero 官方文档也确认，Zotero 7 起插件在 `bootstrap.js` 生命周期中运行，且“继续提供对平台内部（XPCOM、文件访问等）的完整访问”（Zotero 7 for Developers）。

因此，**不提供宿主适配时，原包不能直接通过 Electron 自带机制运行**。要保留原插件包，需要评估兼容/模拟层、Gecko 辅助运行时或应用侧适配；插件移植则涉及修改插件，与用户希望原包不改的目标存在取舍。源码依赖清单不能单独证明这些候选方案的可行性或不可行性。本票**不选择路线**，只给出依赖事实与承接边界。

按可迁移性，依赖分三档：

1. **纯逻辑，可由 Node / 领域 API 承接**：citekey 生成与去重算法、BibTeX/BibLaTeX/CSL-JSON/CSL-YAML/Hayagriva/BBT-JSON 导出、HTML↔LaTeX 转换、期刊缩写、CSL/citeproc 渲染、条目序列化、PDF 大纲读写（pdf-lib）、元数据抓取解析、文件名相似度匹配。
2. **需要宿主提供等价领域服务**：`Zotero.Items`/`Collections`/`Libraries` 对象模型、`Zotero.Notifier` 观察者、`Zotero.Prefs`、`Zotero.File`/`Zotero.DataDirectory`、`Zotero.Styles`、`Zotero.Translate` 翻译框架、`Zotero.Server.Endpoints` 本地 HTTP、`Zotero.HTTP`（含 cookie 容器）。这些是“公开或有文档”的 Zotero API，但要精确复刻语义成本高。
3. **Gecko/私有实现，Electron 不原生提供，兼容成本与语义需验证**：`Components`/`Cc`/`Ci`/`Cu`、`Services.*`、`ChromeUtils.importESModule("chrome://…")`、XPCOM `nsI*`、`Components.utils.Sandbox`、`ChromeWorker`、XUL（`createXULElement`/`MozXULElement`）、`JSWindowActor`/`BrowsingContext`/`E10SUtils`、Gecko AddonManager 与 `amIAddonManagerStartup.registerChrome`、`loadSubScript`、BBT 对 Zotero 数据库表结构的 SQL 查询，以及 `Zotero.Reader`/`Zotero.PDFWorker`/`HiddenBrowser` 内部对象。这里既有平台能力，也有应用私有接口；不能仅凭存在这些调用断言无法模拟。

对票 05 的直接含义：**“可安装”与“主要功能可用”必须分开验收**；BBT 的可用性重心在 citekey + 导出 + 本地导出服务，茉莉花的重心在中文元数据抓取 + 中文 translator/CSL 安装 + PDF 阅读器大纲，后者对 Gecko 阅读器与无头浏览器 actor 的依赖最深。

## 二、官方宿主与加载模型（事实来源：Zotero 官方文档 + 上游源码）

### 2.1 包格式与安装

- 插件清单是 **WebExtension 风格的 `manifest.json`**（替换旧 `install.rdf`），必须含 `applications.zotero`（`id`、`update_url`、`strict_min_version`、`strict_max_version`）。来源：Zotero 7 for Developers（install.rdf → manifest.json）。
- 分发格式仍是 **XPI**（本质是 zip/jar）；更新走 Mozilla 风格的 `updates.json`，而非 `update.rdf`。同上文档。
- 插件由 **Gecko AddonManager** 装载。上游 `chrome/content/zotero/xpcom/plugins.js` 顶部即 `ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs")` 与 `XPIDatabase.sys.mjs`，并经 `amIAddonManagerStartup` 服务注册 chrome。来源：`zotero/zotero` 的 `xpcom/plugins.js`（main 分支）。
- 两个插件的清单实证：BBT 的 `xpi` 块在 `package.json`（`id: better-bibtex@iris-advies.com`，`minVersion: 8.0.1`，`maxVersion: 10.*`）；茉莉花的 `addon/manifest.json`（`id: jasminum@linxzh.com`，`strict_min_version: 9.0.3`，`strict_max_version: 10.*.*`）。

### 2.2 bootstrap 生命周期与窗口钩子

- 生命周期钩子：`install` / `startup` / `shutdown` / `uninstall`；窗口钩子：`onMainWindowLoad` / `onMainWindowUnload`。reason 常量 `APP_STARTUP…ADDON_DOWNGRADE`。来源：Zotero 7 for Developers。
- **Zotero 7 起，`startup()` 运行在 Gecko 特权作用域**：`install()`/`startup()` 自动注入 `Zotero`、`Services`、`Cc`、`Ci` 等 Mozilla 对象；`rootURI` 为字符串（XPI 内是 `jar:file:///…`）。同上文档。
- 上游 `plugins.js` 还定义了 `MAIN_WINDOW_LOAD/UNLOAD` 的 reason 值，并把插件作用域 `scopes` 注入 Zotero 命名空间，使插件能像内部代码一样调用 `Zotero.*`。

### 2.3 依赖 Gecko 的注册与资源机制

- `chrome.manifest` 被移除，改为运行时注册：`Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(Ci.amIAddonManagerStartup).registerChrome(manifestURI, [[…]])` + `chromeHandle.destruct()`。来源：Zotero 7 for Developers（chrome.manifest → runtime chrome registration）；两个插件均照此实现（BBT `content/bootstrap.ts`、茉莉花 `addon/bootstrap.js`）。
- 本地化改为 **Fluent（`.ftl`）**，`.dtd` 已移除；`MozXULElement.insertFTLIfNeeded` 与 `document.l10n`。来源同上。BBT 有 `locale/`，茉莉花有 `addon/locale/{en-US,zh-CN,zh-TW}`。
- 默认首选项放插件根的 `prefs.js`（`pref(key, value)`）。来源同上。
- 首选项面板走 `Zotero.PreferencePanes.register({ pluginID, src, scripts, stylesheets })`，pane 是 **XUL/XHTML 片段**。来源：Zotero 7 for Developers 与上游 `xpcom/preferencePanes.js`（`register` 校验 `pluginID`/`src`）。

### 2.4 官方插件 API（可在应用侧重实现，不含 Gecko 私有性）

上游 `xpcom/pluginAPI/` 现有 `pluginAPIBase.mjs`、`itemTreeManager.js`、`itemPaneManager.js`、`menuManager.js`；文档公开了自定义条目树列（`ItemTreeManager.registerColumn`）、条目面板 section/信息行（`ItemPaneManager.registerSection/registerInfoRow`）、菜单项（`MenuManager.registerMenu`，Zotero 8 文档）。两个插件的实际使用见第四、五节。

## 三、Electron 扩展宿主边界（事实来源：Electron 官方文档）

- Electron 只支持 **加载解包扩展**（`.crx` 不支持），且 `ses.extensions.loadExtension(path)` **按 session** 生效、不跨启动记忆，只支持持久化 session。来源：Electron Chrome Extension Support 与 session API。
- 只支持 Chrome Extensions API 的一个子集（devtools、`chrome.runtime`、`chrome.storage.local`、`chrome.tabs` 部分、`chrome.webRequest` 等）；支持的 manifest key 只有 `name/version/author/permissions/content_scripts/default_locale/devtools_page/short_name/host_permissions/manifest_version/background/minimum_chrome_version`，**没有 `applications.zotero`、没有 bootstrap、没有 XPCOM**。Electron 明确声明“不支持来自商店的任意 Chrome 扩展，且完全兼容 Chrome 扩展实现是 non-goal”。来源同上。
- 结论：Electron 的扩展宿主与 Mozilla/Zotero 插件宿主是**两套互不兼容的机制**。Electron 内可复用的对应能力在 Node 侧：`worker_threads` / `utilityProcess`（替代 `ChromeWorker`/Web Worker 的并行计算）、`session.cookies` 与 `partition`（替代 cookie 容器/`CookieSandbox`）、`net`/`fetch`/`http`（替代 `Zotero.HTTP`/`Zotero.Server`）、`fs`/`fs.promises`（替代 `PathUtils`/`IOUtils`）、`BrowserWindow`/`webContents` 或 `webview`（替代隐藏浏览器）。这些是**能力对应**，不是 API 兼容；对插件的 `Zotero.*`/XPCOM 调用仍需兼容层重写。

## 四、Better BibTeX（retorquere/zotero-better-bibtex）

### 4.1 身份与目标版本

- 维护者 Emiliano Heyns；许可证 ISC；插件 ID `better-bibtex@iris-advies.com`。来源：上游 `package.json`。
- `minVersion: 8.0.1`，`maxVersion: 10.*`；README 明确“**Zotero 7 不再支持**，BBT 8.0.25 是最后一个可用于 7.0.32 的版本”。来源：`package.json`、`README.md`（Notice）。
- 关键架构变化：Zotero 8 起有**原生 citationKey 字段**，BBT 已不再自建字段，“直接读 BBT 数据库的集成必须改读 Zotero 数据库”。来源：`README.md`。

### 4.2 功能与主路径

- **citekey 生成/去重**：自动生成不冲突的 citekey，支持公式化生成与固定 key。主路径：订阅条目变更 → 落库/读取原生 `citationKey` 字段 → 冲突时重算。
- **导出**：高度可定制的 BibTeX/BibLaTeX/CSL 等导出、日期修正、期刊缩写；**auto-export**（集合/库变更时自动导出到文件）；**pull-export**（通过内嵌 Web 服务按 URL 拉取导出）；**JSON-RPC**（供 CITE-AS-YOU-WRITE / TeXstudio 等外部工具调用）。
- **格式转换**：HTML↔LaTeX（`<i>/<b>/<sup>` 等 ↔ `\emph`/`\textbf`/…）、LaTeX 转义与 Unicode 互转、BibLaTeX 自定义字段。

### 4.3 代表性模块与依赖分类（静态）

| 模块（路径） | 作用 | 关键依赖 | 分类 |
| --- | --- | --- | --- |
| `content/bootstrap.ts` | 插件入口；`install/startup/shutdown`、`onMainWindowLoad/Unload` | `Components.utils.Sandbox`、`Components.utils.getObjectPrincipal`、`ChromeUtils`、`Zotero` | Gecko 私有 |
| `content/key-manager.ts`（+ `key-manager/migrate.ts`） | citekey 生成/存储/迁移、去重 | **直接 SQL**（`Zotero.DB.queryAsync`，查 `fields`/`itemData`/`itemDataValues`）、`item.getField/setField('citationKey')` | 私有数据层 + Zotero 领域 |
| `content/item-export-format.ts` | 条目→`Serialized.Item`（含附件本地路径、`Zotero.URI.getItemURI`） | `Zotero.Items`、`Zotero.Attachments`、`Zotero.URI` | Zotero 领域 |
| `content/translators.ts` | 驱动 Zotero 翻译框架导出/导入；安装/重载 translator | `Zotero.Translate.Export/Import`、`Zotero.Translators.save/reinit/init`、`Zotero.getTranslatorsDirectory()` | Zotero 框架（私有语义） |
| `content/worker/zotero.ts` + `content/translators/worker.ts` | 在 **Worker** 中执行导出（BibTeX/BibLaTeX/CSL/BBT-JSON/Hayagriva） | `self`（`DedicatedWorkerGlobalScope`）、`@xmldom/xmldom` 的 `DOMParser`、`IOUtils` | Worker（部分可迁 Node） |
| `content/auto-export.ts` / `pull-export.ts` | 自动导出作业存储与调度；pull URL 生成 | **`Services.prefs`**（`getBranch().getChildList()` 枚举作业）、`Zotero.Prefs`、`Zotero.Prefs.get('httpServer.port')`、`Zotero.Collections/Libraries` | Gecko prefs + Zotero 领域 |
| `content/server.ts` / `json-rpc.ts` | 把 handler 注册进 **`Zotero.Server.Endpoints`**，暴露本地 HTTP JSON-RPC | `Zotero.Server.Endpoints`、`Zotero.Styles.get` | Zotero 本地服务（私有） |
| `content/better-bibtex.ts` | 编排启动；monkey-patch `Zotero.Translate.Export.prototype.translate`、向 translator Sandbox 注入 `BetterBibTeX`；注册 UI | `Zotero.Translate.*.prototype.Sandbox`、`Zotero.PreferencePanes.register`、`Zotero.MenuManager.registerMenu`、`Zotero.ItemPaneManager.registerInfoRow`、`Zotero.getMainWindows()` | 混合（公开 API + 私有 monkey-patch） |
| `content/create-element.ts` | 用 `document.createXULElement` 造 UI（XUL 命名空间） | XUL DOM | Gecko 私有 |
| `content/path-search.ts` / `file.ts` | 查找外部二进制（biber/pandoc 等）、文件操作 | `Services.prefs`、`Components.classes['@mozilla.org/process/environment;1']`（`nsIEnvironment`）、`PathUtils`、`IOUtils` | Gecko 平台 |
| `content/client.ts` | 以 `location.search` / `Zotero.clientName` 区分前台 translator 与 worker | `location`、`Zotero.clientName/version/isWin/isMac/isLinux` | 混合 |

统计（`content`+`util` 内正则计数，仅代表分布）：`PathUtils` 40、`Services.` 29、`IOUtils` 28、`Components.` 25、`Zotero.DB` 20、`ZoteroPane` 20、`ChromeWorker` 4、`Zotero.Translate` 5、`Zotero.MenuManager` 5。

### 4.4 原包运行所需能力（静态推断）

- Gecko AddonManager 装载 + `bootstrap.js` 生命周期 + 特权全局（`Zotero`、`Services/Cc/Ci`）+ `registerChrome`/`loadSubScript`；`Components.utils.Sandbox` 与 `getObjectPrincipal`。
- **Zotero.DB 的 SQL 查询语义**（SQLite：`fields/itemData/itemDataValues/items` 等表）与原生 `citationKey` 字段；条目写回。代表性 key-manager 路径直接查询表结构，通过条目 API 更新字段；不能把这等同于插件自行打开数据库文件或所有写入都采用原始 SQL。
- `Zotero.Translate` 全链路（translator 沙箱 + 已安装 translator 集）与 `Zotero.Translators` 管理；`Zotero.Styles`/citeproc 渲染。
- Zotero 本地 HTTP 服务（`Zotero.Server.Endpoints` + `httpServer.port`）承载 JSON-RPC 与 pull-export。
- Worker（`ChromeWorker`/`DedicatedWorkerGlobalScope`）、XUL UI（首选项 pane、菜单、条目面板行）、Fluent 本地化、`Zotero.Prefs` 分支枚举、外部进程/环境变量查找。

### 4.5 可由 Node / 领域 API 承接的部分（静态）

- **导出内核**：`translators/bibtex/*`、`translators/csl/*`、`lib/hayagriva|bbtjson|collect`、`yaml.ts`、`text.ts`、`journal-abbrev.ts`、`item-schema.ts`、`dateparser.ts` 已按“输入 `Serialized.Item` → 输出文本”组织，且导出 worker 已在独立 Worker 中运行、DOM 解析已用 `@xmldom/xmldom`。这是可复用的候选边界；迁到 Node 时仍须提供条目序列化、偏好、文件与 worker 全局等宿主依赖，并验证实际输出，不能视为已证实只需替换输入。
- **citekey 算法**：生成/去重/冲突解决逻辑本身是纯 TS；只有“读写 `citationKey`”和枚举条目依赖 Zotero DB，可由 Scholoom 领域 API 承接（或改读 Zotero SQLite 只读 + 自建存储）。
- **HTML↔LaTeX、期刊缩写、Unicode/转义、公式求值（`node-eta`）**：纯逻辑。
- **本地导出服务**：JSON-RPC/pull-export 的协议层可迁移到 Node `http` 服务；依赖的 `Zotero.Server.Endpoints` 与端口由 Scholoom 自建。
- **缓存/作业存储**：`auto-export` 目前存 `Zotero.Prefs` 分支，可换成文件/DB 存储；逻辑（调度、增量）可复用。

## 五、茉莉花（l0o0/jasminum）

### 5.1 身份核验与目标版本

- **身份核验：`l0o0/jasminum`（GitHub repo id 272731386，author `l0o0`）是维护者主仓**，默认分支 `main`，许可证 AGPL-3.0-or-later，README 标注 “Using Zotero Plugin Template”。检索另见 `MuiseDestiny/jasminum`、`Cczy1997/jasminum` 等 fork/迁移仓，非本调查对象；用户所述“茉莉花”对应 `l0o0/jasminum`。
- 目标版本：`addon/manifest.json` 声明 `strict_min_version: 9.0.3`、`strict_max_version: 10.*.*`；README 徽章 “Zotero 8/9”。基于 `zotero-plugin-scaffold` 与 `zotero-plugin-toolkit`（TypeScript）。
- 清单里 `applications.zotero` 用占位符（`__addonID__` 等），由构建期替换。

### 5.2 功能与主路径

- **中文 PDF 元数据抓取**：对中文附件/快照，从 CNKI 等来源检索并回填元数据；多结果时人工选择确认。
- **中文 translator / CSL 引用格式安装**：从 Zotero 中文社区 `translators_CN`、`styles` 源同步。
- **本地附件匹配**：在下载目录按标题-文件名相似度匹配并回填附件（PDF/CAJ）。
- **PDF 阅读器大纲/书签**：在 Zotero PDF 阅读窗口侧栏注入“茉莉花大纲/书签”。1.1.39 的实测大纲／新增书签保存到 `jasminum-outline.json`／`jasminum-bookmarks.json`；新增书签前后 PDF 字节未变。其他 PDF 写入路径未实测，见[原型结果](zotero-host-prototype-results.md)。
- 小工具：语言设置、中文姓名拆分/合并；另有 WPS 集成下载。

### 5.3 代表性模块与依赖分类（静态）

| 模块（路径） | 作用 | 关键依赖 | 分类 |
| --- | --- | --- | --- |
| `addon/bootstrap.js` | 入口：`registerChrome` + `Services.scriptloader.loadSubScript` 加载 UI 脚本，暴露 `Zotero.Jasminum` | `Components.classes/…amIAddonManagerStartup`、`Services.io.newURI`、`Ci/Cc/Cu` | Gecko 私有 |
| `src/hooks.ts` `onStartup` | 等 `Zotero.initializationPromise/unlockPromise/uiReadyPromise`；注册 headless actor、prefs pane、notifier、menu、列、样式 | `Zotero.*`、`ztoolkit` | Zotero 领域 |
| `src/utils/headlessBrowser.ts` | 自建无头浏览器服务，用于抓取/交互（CNKI 等） | `ChromeUtils.importESModule("chrome://zotero/content/actors/ActorManager.mjs"/BlockingObserver.mjs/resource://gre/…E10SUtils.sys.mjs)`、`XULBrowserElement`、`BrowsingContext.changeRemoteness/construct`、`nsIWebProgressListener`、`ChromeUtils.generateQI`、`JSWindowActor` `sendQuery('loadURI'/'waitForDocument')` | **Gecko 私有（最深）** |
| `addon/chrome/content/actors/JasminumHeadlessChild.mjs` | 内容进程 actor：`JSWindowActorChild`，操作 `contentWindow` DOM、`PageData`/`DocumentIsReady` | `JSWindowActorChild`、`contentWindow`、`sendQuery` | Gecko 私有 |
| `src/modules/services/*`（`cnki/pubscholar/ncpssd/yiigle/wanfangdata/chinadoi/searchChain`） | 多源中文元数据检索，命中后走 `Zotero.Translate.Web/Import` 生成条目 | `Zotero.HTTP`（`responseType:"document"`）、`Zotero.HTTP.wrapDocument/newCookieContext`、`DOMParser`、`Zotero.Translate.Web/Import` | Zotero HTTP + 翻译框架 |
| `src/utils/cookiebox.ts` | CNKI cookie/验证码上下文；容器 `userContextId` | `Services.cookies.getCookiesFromHost`、`Zotero.HTTP.newCookieContext`、`Zotero.openInViewer(url,{userContextId})` | Gecko cookie/容器 |
| `src/modules/translators.ts` | 从 `translators_CN` 增量同步 translator，写入数据目录并重载 | `PathUtils`/`IOUtils`、`Zotero.DataDirectory.dir`、`Zotero.File.getContentsFromURLAsync/putContentsAsync`、`Zotero.Translators`、`Zotero.Schema.resetTranslators` | Zotero 领域 |
| `src/modules/outline/{index,events,outline,bookmark}.ts` | 阅读器侧栏大纲/书签 UI 与持久化 | `Zotero.Reader.getByTabID`、`reader._internalReader._primaryView._iframeWindow.PDFViewerApplication`（**pdf.js 私有路径**）、`reader.setSidebarView`、`Zotero.DataDirectory`、`Zotero.File` | 私有阅读器 + Zotero 领域 |
| `src/utils/pdfParser.ts` | 从 PDF 结构推断标题 | `Zotero.PDFWorker.getRecognizerData(itemID, true)` | Zotero document worker（私有） |
| `src/modules/attachments/localMatch.ts` | 下载目录附件相似度匹配 | `IOUtils.getChildren`、`PathUtils.filename`、`string-similarity` | 文件系统（可迁 Node） |
| `src/modules/notifier.ts` | 监听 item 变更触发自动补元数据；注册自定义列 | `Zotero.Notifier.registerObserver`、`Zotero.Plugins.addObserver`、`Zotero.ItemTreeManager.registerColumn` | Zotero 领域（公开 API） |
| `src/modules/menu.ts` | 右键/工具菜单项 | `zotero-plugin-toolkit` MenuManager 封装、`Zotero.getActiveZoteroPane()` | Zotero 领域 |
| `src/modules/styles.ts` | 在首选项“引用”面板注入“获取中文样式”链接 | `Zotero.launchURL`、DOM 注入到 `#styleManager-buttons` | 混合（DOM + Zotero） |
| `src/modules/wps.ts` | 下载并解压 WPS 插件包 | `Components.classes['@mozilla.org/libjar/zip-reader;1']`（`nsIZipReader`）、`Zotero.File.pathToFile`、`PathUtils`/`IOUtils` | Gecko XPCOM |

统计（`src`+`addon` 内正则计数）：`ZoteroPane` 17、`Services.` 16、`Zotero.Reader` 15、`IOUtils` 14、`Zotero.HTTP` 13、`ChromeUtils` 11、`Components.` 8、`Zotero.Translate` 6、`loadSubScript` 6。

### 5.4 原包运行所需能力（静态推断）

- Gecko AddonManager + bootstrap + 特权作用域 + `registerChrome`/`loadSubScript`。
- **Gecko 多进程/actor 能力**：`JSWindowActorChild`、`windowGlobal.getActor(...)`、`BrowsingContext`、`E10SUtils`、远程类型切换与 `construct()`、`nsIWebProgressListener`、`ChromeUtils.generateQI`。这是 Electron 完全不具备的层。
- Zotero 内部模块（`chrome://zotero/content/HiddenBrowser.mjs`、`BlockingObserver.mjs`、`ActorManager.mjs`）与 `Zotero.HTTP` cookie 容器、`Zotero.openInViewer`。
- **Zotero PDF 阅读器内部**（`_internalReader._primaryView._iframeWindow.PDFViewerApplication`）与 `Zotero.PDFWorker.getRecognizerData`。
- Zotero 领域层（Items/Notifier/Prefs/File/DataDirectory/Translators/Schema）与公开 UI API（ItemTreeManager/PreferencePanes/菜单）。

### 5.5 可由 Node / 领域 API 承接的部分（静态）

- **元数据抓取的网络与解析部分**：CNKI/万方/维普等检索请求构造、HTML 解析、结果评分与匹配，可在 Node 侧用 `fetch`/DOM 解析实现；但**反爬/验证码/登录态**所依赖的 Gecko cookie 容器与真实浏览器环境需另配（Electron `BrowserWindow` + `session.cookies`/分区，或 Playwright）。
- **translator/CSL 同步**：下载与增量比较逻辑可迁 Node；写入目标改为 Scholoom 的 translator/style 目录与注册表。
- **本地附件匹配**：纯文件系统 + 字符串相似度，可直接迁 Node。
- **PDF 大纲读写**：核心用 `pdf-lib`，可在 Node 运行；阅读器内的交互 UI 需在 Scholoom 自己的阅读器中重做。
- **PDF 标题识别**：算法（按字号/版式启发式）可复用，但输入来自 `Zotero.PDFWorker` 的结构化结果——需 Scholoom 自建等价的 PDF 文档 worker（如 pdf.js + 版面抽取）。

## 六、宿主依赖分类总表

| 类别 | 具体对象 | 可否在 Electron/Node 承接 | 归属 |
| --- | --- | --- | --- |
| 扩展装载 | XPI、`applications.zotero`、Gecko AddonManager、`bootstrap.js` 生命周期、`amIAddonManagerStartup.registerChrome`、`loadSubScript` | 不原生支持；需另建加载与兼容宿主或保留 Gecko | Gecko |
| 平台特权 | `Components/Cc/Ci/Cu`、`Services.*`、`ChromeUtils.importESModule`、XPCOM `nsI*`、`Sandbox`、`ChromeWorker`、XUL | 不原生支持；模拟或替代服务的范围需逐项验证 | Gecko |
| 多进程/浏览器 | `JSWindowActor`、`BrowsingContext`、`E10SUtils`、`nsIWebProgressListener`、`XULBrowserElement` | 需另建相应能力；webContents 等不自动提供原 API 语义 | Gecko |
| Zotero 私有数据 | `Zotero.DB` 直接 SQL、`Zotero.Reader` 内部、`Zotero.PDFWorker`、`HiddenBrowser`、`Schema.resetTranslators`、`Zotero.Server.Endpoints` | 需宿主实现/兼容层，语义无保证 | Zotero 私有 |
| Zotero 公开/文档化 | `Items/Collections/Libraries`、`Notifier`、`Prefs`、`File`、`DataDirectory`、`Styles`、`Translate`(框架)、`ItemTreeManager/ItemPaneManager/MenuManager/PreferencePanes` | 需宿主提供等价领域 API | Zotero 公开 |
| 标准能力 | DOM/DOMParser、fetch/HTTP、Worker、XMLSerializer、pdf-lib、citeproc、文件系统 | 可由 Node/Electron 或适配库提供；仍需核验全局与模块依赖 | 标准 Web/Node |

## 七、未能静态保证的部分

- **未运行验证**：本文未在 Zotero/Gecko 或 Electron 中运行任一插件，也未证明兼容层可行；“可承接”均为静态判断，存在运行时语义落差。
- **动态调用不可穷尽**：`eval`、沙箱、`monkey.patch`（BBT 明确 monkey-patch `Zotero.Translate.Export.prototype.translate`）、translator 沙箱注入、动态属性访问（如 `Zotero.getActiveZoteroPane()?.…`）可能在运行期触达静态检索未覆盖的 API。
- **私有 API 漂移**：`Zotero.Reader` 的 `_internalReader._primaryView`、`PDFWorker.getRecognizerData`、`HiddenBrowser`/`CookieSandbox`、`Zotero.Server.Endpoints` 等未在官方插件文档承诺，跨版本可能变更；静态分析无法保证行为等价。
- **数据层语义**：BBT 依赖 Zotero SQLite 的库/集合/搜索语义与原生 `citationKey` 字段；茉莉花依赖 Zotero `Schema.resetTranslators` 与 translator 安装目录约定。兼容层需逐项对齐，本票无法验证。
- **外部依赖与反爬**：CNKI 等站点的检索/验证码/登录态、查询构造（`User-Agent`、`QueryJson`）属易变外部行为，静态无法保证长期可用。
- **版本声明与实测**：清单中的 `strict_min/max_version` 是插件声明，不等于实测通过；Zotero 8/9 平台变化（ESM、Bluebird 移除、strict mode，见 Zotero 8 for Developers）对插件的实际影响需运行确认。
- **Electron 侧结论仅限官方机制**：本文只核对了 Electron 官方扩展文档；未评估任何第三方“在 Electron 内模拟 Firefox 扩展”的非官方方案（如有，需单独一手核验）。

## 八、后续可检验问题

1. 在真实 Zotero（声明目标版本）中跑 BBT 与茉莉花，记录各自实际触达的 `Zotero.*`/XPCOM API 集合与调用序（可与本文静态清单比对补漏）。
2. BBT 导出内核能否在 Node 中、以 Scholoom 条目模型为输入，产出与 Zotero 内一致的 BibTeX/BibLaTeX/CSL-JSON 输出？边界在 `Serialized.Item` 字段覆盖度。
3. 茉莉花 CNKI 抓取去掉 Gecko 后，在 Electron `BrowserWindow`/`session` 或 Playwright 下能否通过验证码与登录态？成功率与稳定性如何。
4. Zotero 原生 `citationKey` 字段与 Scholoom 自有存储如何对齐（只读复用 Zotero SQLite 还是自建库）？
5. `Zotero.Translate` 与 `Zotero.Styles/citeproc` 是否可用 `zotero/translators` + `citeproc-js` 在 Node 侧重建（与票 04 的翻译框架调查交叉）。
6. Gecko 辅助运行时的形态（内嵌 Gecko、外部 Zotero 进程，还是仅用于插件的受限宿主）在宿主边界与维护成本上如何取舍（属票 05 决策范围）。

## 来源清单

官方文档：

- Zotero 7 for Developers：https://www.zotero.org/support/dev/zotero_7_for_developers （manifest.json / bootstrap / chrome 注册 / Fluent / prefs / PreferencePanes / ItemTreeManager / ItemPaneManager）
- Zotero 8 for Developers：https://www.zotero.org/support/dev/zotero_8_for_developers （Firefox 140、ESM、Bluebird 移除、MenuManager、平台迁移脚本）
- Zotero Plugin Development：https://www.zotero.org/support/dev/client_coding/plugin_development （插件运行于桌面宿主，接触内部 JS 与 Firefox API）
- Electron Chrome Extension Support：https://www.electronjs.org/docs/latest/api/extensions （仅解包扩展、API 子集、non-goal）
- Electron session（`loadExtension`）：https://www.electronjs.org/docs/latest/api/session#sessloadextensionpath-options

Zotero 上游源码（`zotero/zotero`，main 分支）：

- `chrome/content/zotero/xpcom/plugins.js`（AddonManager / XPIDatabase 依赖、插件作用域、MAIN_WINDOW reason）
- `chrome/content/zotero/xpcom/preferencePanes.js`（`register({pluginID, src, scripts, stylesheets})`）
- `chrome/content/zotero/xpcom/pluginAPI/`（`pluginAPIBase.mjs`、`itemTreeManager.js`、`itemPaneManager.js`、`menuManager.js`）

插件一手源码：

- Better BibTeX：https://github.com/retorquere/zotero-better-bibtex （分支 `master`；`package.json`、`README.md`、`content/`、`translators/`、`fields.sql`、`schema/zotero.json`、`esbuild.js`、`zotero-plugin.ini`）
- 茉莉花：https://github.com/l0o0/jasminum （分支 `main`；`package.json`、`README.md`、`addon/manifest.json`、`addon/bootstrap.js`、`addon/chrome/content/actors/JasminumHeadlessChild.mjs`、`src/`）

说明：以上源码通过 `codeload.github.com` 的对应分支 tar.gz 快照（2026-10-01 / 2026-09-02 时间戳）与 `raw.githubusercontent.com` 获取，属静态阅读，未构建、未安装、未运行。
