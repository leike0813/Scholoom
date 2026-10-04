# Zotero 摄取管线一手源码调查：translate / translation-server / connectors / 桌面 connector server

- 调查票：`.scratch/scholoom-foundations/issues/04-zotero-ingest-research.md`（wayfinder:research）
- 日期：2026-10-03
- 方法：静态阅读官方仓库源码与官方文档页面；**未安装依赖、未运行 translation-server、未启动 Zotero/浏览器扩展做端到端验证**。
- 证据标注：本文所有结论都来自对下列一手仓库源码/文档的直接阅读，除非显式标为「未验证/待验证」。

## 0. 结论速览

1. `zotero/translate` 是一套**契约层框架**：它定义 translator 的执行模型，但把 `Zotero.Translators`、`Zotero.HTTP`、`Zotero.Translate.ItemSaver` 留给宿主实现（README 明确列出）。
2. `zotero/translation-server` 是**不持久保存文献库的 translator 执行服务**：它把译好的条目以 Zotero API JSON 返回，**ItemSaver 是空实现，不做持久化、不下载/保存附件**。它保留部分临时选择会话，但不是文献库，也不是完整 Zotero 底座。
3. 真正负责「落库 + 附件下载」的是 **Zotero 桌面应用内的 ItemSaver**（`chrome/content/zotero/xpcom/translation/translate_item.js`），由桌面 connector HTTP server 的 save 会话调用。
4. `zotero/zotero-connectors` 是**浏览器 WebExtension 扩展**（另有 Safari 专用壳），它通过本机 HTTP 把抓取结果 POST 给桌面应用；`connector.url` 的默认值是 `http://127.0.0.1:23119/`，偏好读取允许已保存值覆盖默认值，协议是 **Connector 单向发起**（桌面不能主动找扩展）。
5. 默认配置存在端口共存约束：桌面 connector server 默认监听 **127.0.0.1:23119**（pref `extensions.zotero.httpServer.port`），Connector 使用一个配置目标；两个应用同时绑定同一地址端口会冲突。所查调用路径未见标准多客户端协商/回退协议，目标配置的用户入口和具体共存方案仍需调查与验证。
6. 保存身份是**会话级**的：connector 为每条条目生成随机会话键（`randomString(8)`），桌面 `UpdateSession/SessionManager` 用它把后续附件请求关联到已存条目；这不是持久化库 key。

## 1. 调查范围与来源版本（静态阅读快照）

以下为写作时的仓库 HEAD（2026-10-03 读取），用于定位行号与防止上游漂移：

| 仓库 | 默认分支 | 读取到的 HEAD |
| --- | --- | --- |
| `zotero/translate` | master | `dd524aea9a556cd23eb9dc8cc617219a98d0fb47` |
| `zotero/utilities` | master | `4051881d59c6c12d34417d4c226f37218051be90` |
| `zotero/translation-server` | master | `3a9d17614896fc1fea73d7b880ea79273b605275` |
| `zotero/zotero-connectors` | main | `876e41ad15139077f2e07b2f71a0fa94742e0b4a` |
| `zotero/zotero`（桌面） | main | `15f6a81181dd696349447cb542cec56ff1d621f4` |

`zotero/zotero` 的 `.gitmodules` 把 `chrome/content/zotero/xpcom/translate` 与 `.../utilities` 作为子模块引入；即桌面应用与下面 3.1/3.2 复用同一份框架源码。

## 2. 组件职责映射表

| 组件 | 形态 | 负责 | 明确不负责（据源码/文档） |
| --- | --- | --- | --- |
| `zotero/translate` | 源码框架（git 子模块；**无 package.json**） | translator 解析与执行、RDF 栈、ItemSaver/ItemGetter **契约** | 无网络栈、无 translator 源、无落库；`ItemSaver.saveItems` 直接抛「not implemented」 |
| `zotero/utilities` | 源码库，`package.json` 名为 `@zotero/utilities` | schema/类型缓存、日期解析、条目格式转换、OpenURL、字符串工具 | 不做翻译与落库；需宿主先 `Schema.init`/`Date.init`/`setTypeSchema` |
| `zotero/translation-server` | Node 服务（Koa） | 加载本地 translators，执行 web/search/export/import 翻译，返回 Zotero API JSON | 无数据库、无附件下载/保存、无更新机制（除容器启动时 git pull 外）、无 UI |
| `zotero/zotero` 桌面 connector server | 桌面应用内 HTTP server | `/connector/*` 端点；真实**落库**、附件下载、快照、会话管理、translator 元数据/code 供给 | 不主动访问扩展；仅响应本机请求 |
| `zotero/zotero-connectors` | 浏览器 WebExtension + Safari 壳 | 页面注入翻译、采集条目，经本机 HTTP POST 给桌面 | 不自带文献库；Zotero 不可用时回退到 zotero.org API |

## 3. 逐组件事实

### 3.1 `zotero/translate`：框架不自带能力

README 直接列出消费者必须实现的接口，并给出必需初始化调用：

- `Zotero.Translators`（`translators.js`）
- `Zotero.HTTP`（`http.js`）
- `Zotero.Translate.ItemSaver`（`translation/translate_item.js`）
- 必须调用 `Zotero.Schema.init(schema.json)`、`Zotero.Date.init(utilities/resource/dateFormats.json)`；Node 下还需 `require('../utilities/cachedTypes').setTypeSchema(zoteroTypeSchemaData)`。
- README 原文要求：**把 translators 与 schema 随包打包，不要从远程服务器加载**。

契约层的空实现证据（`src/translation/translate_item.js`）：

```js
Zotero.Translate.ItemSaver.prototype.saveItems = async function (jsonItems, attachmentCallback, itemsDoneCallback) {
    throw new Error(`Zotero.Translate.ItemSaver.prototype.saveItems: not implemented`);
};
```

	exttt{example/translate_item.js} 的示范实现同样只是把条目塞进内存并返回，不落库（与题述「翻译器核心的 ItemSaver 仅返回 metadata」一致）。

translator 源获取在框架里有默认远程实现：`src/repo.js` 组装 `${ZOTERO_CONFIG.REPOSITORY_URL}code/<id>`、`metadata?...` 走 `repo.zotero.org`。也就是说 **远程加载是框架默认，但被宿主覆盖**（translation-server 覆盖为读磁盘，见 3.3）。

一个与本地快照不一致的事实：`zotero/translate` 仓库根目录**没有 `package.json`**（仓库根仅 `.gitmodules/COPYING/README.md/example/modules/src/testTranslators`），npm registry 上 `@zotero/translate` 返回 404。它是作为源码树/子模块被消费的，不是可直接 install 的 npm 包。`zotero/utilities` 才有 `package.json`（`@zotero/utilities`）。

### 3.2 `zotero/utilities`

- `package.json`：`name: "@zotero/utilities"`, `main: utilities.js`，无运行时依赖（devDeps 为 chai/jsdom/mocha）。
- 静态数据随包：`resource/zoteroTypeSchemaData`、`resource/dateFormats.json`；`cachedTypes.js` 挂 `Zotero.ItemTypes/CreatorTypes/ItemFields`；`schema.js` 提供 CSL 类型/字段映射。
- 使用前提是严格初始化顺序（`Schema.init`、`Date.init`、`setTypeSchema`），否则条目转换会缺数据。

### 3.3 `zotero/translation-server`：不持久保存文献库的 translator 执行服务

**定位（README 原文）**：让你「without the Zotero client」使用 Zotero translators。**这不是文献库**：仓库无数据库、无 library 概念。

**HTTP 端点（`src/server.js`，Koa）**：

- `POST /web`：传入 URL（`text/plain`）→ 返回 Zotero API JSON 条目数组；多结果时返回 `300` + `{ url, session, items }`，客户端删掉不要的项后把 JSON POST 回同一端点完成选择。
- `POST /search`：按 DOI/ISBN/PMID/arXiv 检索。
- `POST /export?format=bibtex`：Zotero API JSON → 导出格式。
- `POST /import`：任意导入格式 → Zotero API JSON。
- 监听地址来自 `config/default.json5`：`port: 1969`, `host: "0.0.0.0"`, `translatorsDirectory: "./modules/translators"`。

**Node 宿主依赖（`package.json` 静态列出）**：`koa`, `koa-bodyparser`, `koa-route`, `jsdom`, `wicked-good-xpath`（Zotero fork，git 依赖）, `iconv-lite`, `w3c-xmlserializer`, `whatwg-encoding`, `xregexp`, `request`, `request-promise-native`, `md5`, `yargs`, `config`；Lambda 场景额外 `serverless-http`, `aws-sdk`。运行入口 `node src/server.js`，容器基于 `node:lts`。

**必需的 4 个子模块**（`.gitmodules`）：`modules/translators`、`modules/utilities`、`modules/translate`、`modules/zotero-schema`。`Dockerfile` 会在构建时 `git clone --depth=1 .../translators.git` 到 `/app/modules/translators/`；`docker-entrypoint.sh` 在启动前 `git pull --ff-only` 更新 translators。

**装配（`src/zotero.js` + `src/utilities.js`）**：`Date.init(dateFormats.json)`、`cachedTypes` + `setTypeSchema(zoteroTypeSchemaData)`、`Zotero.Schema.init(require('../modules/zotero-schema/schema.json'))`、`Zotero.Translate = require('./translation/translate')`，并挂 `SandboxManager` 与 `ItemSaver/ItemGetter`；用 JSDOM + wgxpath 打 `innerText`/`DOMParser`/`XMLSerializer` shim。

**ItemSaver 是空实现（关键）**：`src/translation/translate_item.js` 注释写明——

```text
Zotero.Translate will always be run in object-only mode
```

同一注释还说明没有实际 ItemSaver，只提供不执行保存工作的 `saveCollection`。

`src/translation/translate.js` 里 `saveItems` 仅 `this.items = (this.items || []).concat(jsonItems)` 后返回；`webSession.js`/`searchEndpoint.js` 直接从翻译结果读 `items` 序列化返回。`translate_item.js` 声明了 `ATTACHMENT_MODE_IGNORE/DOWNLOAD/FILE` 常量，但**没有实现对应的附件持久化职责**；常量存在不等于服务会下载或保存附件。

**翻译器加载边界（`src/translators.js`）**：`init()` 时 `load()` 扫描 `translatorsDirectory` 下 `.js`，逐文件正则解析头部元数据 JSON、`info.code = data`、`cacheCode = true`、全量入内存并按 `priority` 分 `import/export/web/search` 缓存；`getCodeForTranslator` 直接返回内存 `translator.code`，代码缺失才报错。**没有运行期远程更新**（更新只发生在容器启动脚本里）。

### 3.4 `zotero/zotero` 桌面 connector HTTP server：真正的落库与附件

**默认开关与端口**（`defaults/preferences/zotero.js`）：

```
pref("extensions.zotero.httpServer.enabled", true);
pref("extensions.zotero.httpServer.port", 23119);   // ascii "ZO"
pref("extensions.zotero.httpServer.localAPI.enabled", false);
```

**Server（`chrome/content/zotero/xpcom/server/server.js`）**：以 `HttpServer` 注册 `'/' ` 前缀处理；`port = port || Prefs.get('httpServer.port')`，`serv.start(port)` 后日志 `HTTP server listening on 127.0.0.1:<primaryPort>`。绑定失败时 `catch` 只记日志并「Not initializing HTTP server」，**源码中未见自动换端口的重试逻辑**。Host 头校验只接受 `127.0.0.1 / [::1] / localhost`（防 DNS rebinding）。同文件 `Zotero.Server.LocalAPI` 走同一本地端口下的 `/api/`，受 `httpServer.localAPI.enabled`（默认关）与 `localAPIKeys.json` 控制。

**Connector 端点全集（`server/server_connector.js` 注册）**：

`/connector/getTranslators`、`/connector/detect`、`/connector/saveItems`、`/connector/getRecognizedItem`、`/connector/saveStandaloneAttachment`、`/connector/saveAttachment`、`/connector/saveSingleFile`、`/connector/saveSnapshot`、`/connector/hasAttachmentResolvers`、`/connector/saveAttachmentFromResolver`、`/connector/updateSession`、`/connector/delaySync`、`/connector/import`、`/connector/installStyle`、`/connector/getTranslatorCode`、`/connector/getSelectedCollection`、`/connector/getClientHostnames`、`/connector/proxies`、`/connector/ping`。

- `saveItems`：`getSaveTarget()` 解析当前选中库/集合 → `SessionManager.create(data.sessionID, 'saveItems', req)` → `session.update(targetID)` → `session.saveItems(targetID)` → `201`；只读库返回 `500 {libraryEditable:false}`；会话重复 `409 SESSION_EXISTS`。
- `saveAttachment` / `saveStandaloneAttachment` / `saveSnapshot` / `saveSingleFile`：按 `sessionID`（或 `X-Metadata.sessionID`）找到会话后把二进制流导入附件；`saveStandaloneAttachment` 用 `Zotero.Attachments.importFromNetworkStream`，并可触发 PDF/EPUB 自动识别。
- `ping`：GET 返回 HTML「Zotero is running」；POST 返回 `prefs`（`automaticSnapshots`、`downloadAssociatedFiles`、`translatorsHash` 等），用于连接状态与 translator 哈希比对。
- `getTranslators` / `getTranslatorCode`：桌面向扩展供给 translator 元数据与代码。
- `getClientHostnames`：返回 `Zotero.Proxies.DNS.getHostnames()`（代理相关主机名）。

**保存会话与身份（`server/saveSession.js`）**：`SessionManager.create/get/remove` 管理内存会话；`SaveSession.saveItems(target)` 内实例化真实 `new Zotero.Translate.ItemSaver({...})`，`await itemSaver.saveItems(data.items, ...)`，随后 `attachmentMode = ATTACHMENT_MODE_DOWNLOAD`，并用 `addItem(data.items[index].id, item)` 建立「**connector 会话键 → 桌面条目**」映射；`update(targetID)` 支持改目标库/集合并同步已存条目；会话有创建时间与清理阈值。

**桌面真实 ItemSaver（`xpcom/translation/translate_item.js`）**：`saveItems` 在 `Zotero.DB.executeTransaction` 内真正建条目（`_saveItem`/`_saveNote`），处理子附件（`_processChildAttachments`），并下载/链接/存快照附件（`_saveAttachmentDownload / _saveAttachmentLink / _saveAttachmentFile`、OA PDF 解析器、`importSnapshotContent` 等）。`ATTACHMENT_MODE_IGNORE/DOWNLOAD/FILE` 三态定义在此。**这才是「落库 + 附件」职责所在**，translation-server 完全没有这一层。

### 3.5 `zotero/zotero-connectors`：外部浏览器扩展，经本机 HTTP 保存到桌面

**形态**：WebExtension。`src/browserExt/manifest.json`（MV2）与 `manifest-v3.json`（MV3）并存，权限含 `http://127.0.0.1/*`、`https://repo.zotero.org/*`、`https://api.zotero.org/*`、`tabs/cookies/scripting/webRequest` 等；Safari 另有 `src/safari` 与独立壳仓库。**它是浏览器进程里的扩展，不是 Electron 内嵌的 Chrome 扩展，也不能直接读本地库。**

**连接目标由偏好读取**：`src/common/zotero.js` 的默认值是 `"connector.url": 'http://127.0.0.1:23119/'`；`Zotero.Prefs.get` 优先读取 `syncStorage`，缺失时才回退到默认值。`src/common/connector.js` 的 `callMethod` 拼 `<connector.url>connector/<method>`，带 `X-Zotero-Version` 与 `X-Zotero-Connector-API-Version: 3` 头。所查调用路径未见多目标发现或候选端口协商。响应缺 `X-Zotero-Version` 头时被当作「Zotero offline」处理，避免误连其它 localhost 服务。目标偏好如何在各浏览器中设置、修改后的实际行为尚未验证。

**保存流程（`src/common/itemSaver.js` + `itemSaver_background.js`）**：

- `saveItems` 先 `_saveToZotero`；若抛 `status == 0`（连不上桌面）则 `_saveToServer` 回退到 zotero.org API。
- 桌面路径：给每条 item/attachment 生成 `id = randomString(8)`，组装 `payload = { sessionID, uri, proxy, items }`，`callMethod("saveItems", payload)`；随后查 `getSelectedCollection` 的 `filesEditable`，再经 `saveAttachment`（`X-Metadata` 头 + 二进制 body + `sessionID` query）或 `saveSingleFile` 上传附件。
- 抓取二进制由后台页完成（`_fetchAttachment`，带 cookies/referrer，含 bot 绕过逻辑），MV3 下分块传输 `snapshotContent`。

**通信方向**：README 原文——「Zotero cannot interact with the connectors on its own accord. All communication is Connector initiated.」即桌面无法主动通知扩展，扩展靠 `ping` 轮询/状态检查。

**translator 来源**：扩展后台维护自己的 translator 缓存；`src/common/repo.js` 的 `getTranslatorMetadataFromZotero` 走 `callMethod("getTranslators")`（桌面），`getTranslatorMetadataFromServer`/`getTranslatorCode` 回退到 `repo.zotero.org`；`ping` 响应带 `translatorsHash/sortedTranslatorHash`，不一致时 `updateFromRemote()`。

## 4. 关键边界（回答票面问题）

### 4.1 Node 宿主必需服务

按现有 translation-server 装配在 Node 中复用时，涉及以下运行依赖与服务。这不是任意 Node 宿主的通用最小依赖清单；例如 HTTP 服务和 DOM 实现可由宿主按框架契约另行提供：

1. Node 运行时（上游容器用 `node:lts`；`package.json` 未声明 `engines`——**具体最低版本未验证**）。
2. 上述 Koa/HTTP 依赖 + JSDOM 及 DOM shim（`wicked-good-xpath`、`w3c-xmlserializer`、`whatwg-encoding`、`iconv-lite`）。
3. 随包固定的 4 份数据/代码：translators、utilities、translate、zotero-schema。
4. 初始化顺序：`Date.init` → `cachedTypes.setTypeSchema` → `Schema.init(schema.json)` → 注入 `Zotero.HTTP`/`Zotero.Translators`（translation-server 用本地磁盘实现）。
5. 一个提供 `Zotero.Prefs`、`Zotero.Debug`、`Zotero.Promise` 的最小全局环境（translation-server 内建）。

**缺失即不可用**：没有宿主提供的落库/附件层时，翻译结果只存在于响应 JSON 里。

### 4.2 翻译器缓存/加载边界

- translation-server：启动时**全量读磁盘入内存**，代码永久缓存（`cacheCode=true`），无运行期远程刷新；更新依赖重建/重启时的 `git pull`。
- translate 框架默认：从 `repo.zotero.org` 远程取 code/metadata（被 translation-server 覆盖）。
- 桌面/扩展：translator 由桌面应用持有，扩展通过 `getTranslators`/`getTranslatorCode` 获取并按 hash 更新；扩展也可回退 zotero.org。
- README 硬约束：translators 与 schema **随包分发，勿远程加载**（离线与可靠性的前提）。

### 4.3 ItemSaver 边界

| 场景 | ItemSaver 行为 | 持久化 | 附件 |
| --- | --- | --- | --- |
| translate 框架契约 | 抛 `not implemented` | 无 | 无 |
| translate `example/` | 内存累加并返回 JSON | 无 | 无 |
| translation-server | 空实现 `this.items.concat` | **无** | **无**（无 ATTACHMENT_MODE） |
| Zotero 桌面 | 事务内建条目/笔记 | **有**（SQLite 库） | **有**（下载/链接/快照，OA PDF，importFromNetworkStream） |

**结论**：题述「ItemSaver 只是返回 metadata、缺持久化/附件职责」对 translation-server 成立；对桌面应用不成立。任何独立应用若复用翻译能力，**持久化与附件必须自建**。

### 4.4 外部浏览器 Connector 如何保存到独立桌面应用

默认链路：扩展后台（WebExtension）→ `POST http://127.0.0.1:23119/connector/*` → 桌面 `server_connector.js` 端点 → 桌面真实 ItemSaver 落库 → 附件再由 `saveAttachment/saveSingleFile/saveSnapshot` 按 `sessionID` 补传。方向单向（Connector 发起）。所查源码包含本机请求、Host 校验与版本头握手；这些不等于应用级身份认证，各端点的完整请求准入条件仍需在具体兼容实现时核验。

因此：**一个独立 Electron 应用若想承接现有浏览器 Connector，需要实现目标保存流程所调用的 `/connector/*` 端点与会话语义**；具体支持范围需按实际流程核验。若另建抓取客户端，需要另行承担页面注入、条目采集和与桌面交换结果的职责。

### 4.5 端口/连接目标与 Zotero 共存约束

- 桌面默认 `127.0.0.1:23119`，可由 `extensions.zotero.httpServer.port` 改；localAPI 复用同一端口。
- Connector 的 `connector.url` 默认值是 `http://127.0.0.1:23119/`，偏好可覆盖默认值；所查路径未见多目标协商或候选端口探测。
- 两应用同时监听 23119 会互相占端口；桌面绑定失败时源码只放弃启动 server，未见自动改用其它端口的逻辑。
- 若让现有 Connector 指向 Scholoom，通常意味着 Scholoom **占用 23119**，此时 Zotero 的 connector server 就无法启动——「与 Zotero 同时运行并都接受 Connector」在默认配置下不成立。是否可通过改 pref 让二者分端口、以及 Connector 是否能被指到别的端口，均**未验证**（见 §6）。

### 4.6 稳定身份与保存会话边界

- 会话键来自扩展侧生成的随机字符串（`randomString(8)`），仅在同一 `sessionID` 会话内把附件关联到条目；**不是稳定的库内 key**。
- 桌面侧 `SessionManager` 仅内存保存会话（含创建时间与清理），真正的稳定身份是落库后 Zotero 条目的 id/key。
- `updateSession` 允许改目标集合并同步已存条目；`getRecognizedItem` 通过 `sessionID` 查会话。
- 含义：跨「抓取客户端 ↔ 库」边界的身份是**会话级、短生命周期**的；独立应用要实现自己的身份/去重/更新语义，不能把 `sessionID` 或 translator 的 `itemID` 当持久标识。

## 5. 与本地 references 快照的出入

本地快照 `references/Zotero/15-翻译框架与共享工具库.md` 称 translate 与 utilities 都是「独立分发的 npm 包」。源码核验：`zotero/utilities` 有 `package.json`（`@zotero/utilities`）但 npm registry 查询返回 404；`zotero/translate` **根本没有 `package.json`**。二者实际以 git 子模块/源码树形式消费。快照其余关于「契约层 vs 实现层」「装配顺序即文档」「静态数据随包」的判断与源码一致。

（`@zotero/utilities` 的 registry 404 是本轮网络查询结果；快照所称「npm 包」可能指历史上的分发方式，**未进一步考据**。）

## 6. 验证缺口（静态分析未覆盖，需运行验证）

1. **端口冲突的实际行为**：桌面 `server.js` 绑定失败只 catch 记日志；未验证 Firefox `HttpServer.start(port)` 在端口占用时是否内部回退，也未验证 Connector 是否在别处（构建产物/偏好）有备用端口。
2. **如何配置 Connector 目标与实现共存**：`connector.url` 是可被保存偏好覆盖的默认值；各浏览器提供什么设置入口、修改后是否完整生效，以及两个应用分端口或使用路由服务的实际行为未验证。
3. **translation-server 端到端**：未安装依赖、未启动，未验证 `/web`/`/import`/`/export` 的真实响应、翻译器加载量与多结果会话行为。
4. **Node 最低版本**：`engines` 未声明，仅知容器用 `node:lts`；未验证在具体 Electron 内置 Node 版本上的兼容性。
5. **附件/快照的无头可行性**：桌面附件链路依赖 Gecko 专有 API（`Zotero.Attachments.*`、nsIURI 等），未在 Node/Electron 侧验证可否等价实现。
6. **扩展与「非 Zotero」宿主的握手细节**：`ping` 的 `prefs` 字段、版本头、`X-Zotero-Version` 校验是否构成硬门槛，未做抓包验证。
7. **Safari/移动端差异**：仅静态看到 Safari 分支与权限处理，未验证。

## 7. 事实小结（仅陈述，不构成兼容路线/架构决策）

- 可复用的是一套**契约明确的 translator 执行框架**与一个**不持久保存文献库的执行服务**；它们提供条目 JSON 和格式转换等结果，宿主仍需承担持久化与附件职责。
- 「文献管理底座」的落库、附件、快照、库/集合语义、身份与同步，全部在 Zotero 桌面应用内部，**不在** translation-server。
- 现有浏览器 Connector 按 `connector.url` 调用 `/connector/*`，默认目标为 `127.0.0.1:23119`；承接它需要实现所使用的端点与会话协议，并明确目标配置和默认端口共存的处理方式。

## 8. 来源链接

上游仓库（阅读时刻 HEAD 见 §1）：

- translate README：https://github.com/zotero/translate/blob/master/README.md
- translate 契约：https://github.com/zotero/translate/blob/master/src/translation/translate_item.js
- translate translators/repo：https://github.com/zotero/translate/blob/master/src/translators.js 、https://github.com/zotero/translate/blob/master/src/repo.js
- translate 示例装配：https://github.com/zotero/translate/blob/master/example/index.html 、https://github.com/zotero/translate/blob/master/example/translate_item.js
- utilities：https://github.com/zotero/utilities/blob/master/package.json
- translation-server README：https://github.com/zotero/translation-server/blob/master/README.md
- translation-server 入口/端点：https://github.com/zotero/translation-server/blob/master/src/server.js
- translation-server 装配：https://github.com/zotero/translation-server/blob/master/src/zotero.js 、https://github.com/zotero/translation-server/blob/master/src/utilities.js
- translation-server ItemSaver：https://github.com/zotero/translation-server/blob/master/src/translation/translate_item.js 、https://github.com/zotero/translation-server/blob/master/src/translation/translate.js
- translation-server translator 加载：https://github.com/zotero/translation-server/blob/master/src/translators.js
- translation-server 配置：https://github.com/zotero/translation-server/blob/master/config/default.json5
- translation-server 容器/子模块：https://github.com/zotero/translation-server/blob/master/Dockerfile 、https://github.com/zotero/translation-server/blob/master/.gitmodules 、https://github.com/zotero/translation-server/blob/master/docker-entrypoint.sh
- 桌面端口/开关：https://github.com/zotero/zotero/blob/main/defaults/preferences/zotero.js
- 桌面 server：https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/server/server.js
- 桌面 connector 端点：https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/server/server_connector.js
- 桌面保存会话：https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/server/saveSession.js
- 桌面真实 ItemSaver：https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/translation/translate_item.js
- 桌面 Local API：https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/server/server_localAPI.js
- connectors README：https://github.com/zotero/zotero-connectors/blob/main/README.md
- connectors 本机调用：https://github.com/zotero/zotero-connectors/blob/main/src/common/connector.js
- connectors 目标 pref：https://github.com/zotero/zotero-connectors/blob/main/src/common/zotero.js
- connectors 保存逻辑：https://github.com/zotero/zotero-connectors/blob/main/src/common/itemSaver.js 、https://github.com/zotero/zotero-connectors/blob/main/src/common/itemSaver_background.js
- connectors translator 仓储：https://github.com/zotero/zotero-connectors/blob/main/src/common/repo.js
- connectors 清单：https://github.com/zotero/zotero-connectors/blob/main/src/browserExt/manifest.json 、https://github.com/zotero/zotero-connectors/blob/main/src/browserExt/manifest-v3.json

官方文档：

- Zotero Connector HTTP Server：https://www.zotero.org/support/dev/client_coding/connector_http_server
- Zotero Web API v3（connector 回退目标）：https://www.zotero.org/support/dev/web_api/v3/start

本地参考快照：

- `references/Zotero/15-翻译框架与共享工具库.md`（参考，非上游事实）
