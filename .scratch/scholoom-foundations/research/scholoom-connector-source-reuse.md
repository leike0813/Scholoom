# zotero-connectors 源码可复用性事实核查

核查日期：2026-10-09。关联[Zotero 生态接入、插件行为与文献迁入](../issues/41-zotero-ecosystem-integration.md)。本报告只记录固定源码中的模块与依赖；正式决定以关联票 Answer 为准，源码定位不代表扩展运行通过。

固定点：`zotero/zotero-connectors` commit [`876e41a`](https://github.com/zotero/zotero-connectors/commit/876e41ad15139077f2e07b2f71a0fa94742e0b4a)（GitHub API 返回 200，有效；仓库该 commit 共 175 个 blob，未截断）。全部链接均为该 commit 的 blob 永久链接，未使用 main。

本轮只做只读源码核查：未 clone、未安装依赖、未构建、未运行浏览器、未访问任何文献库或 Zotero 账户。

## 事实 1：源码 license 原文名称

- [`COPYING`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/COPYING) 正文：`GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007`；声明段写 `The Center for History and New Media distributes the Zotero source code under the GNU Affero General Public License, version 3 (AGPLv3)`，版权方为 Corporation for Digital Scholarship（2018）与 CHNM / George Mason University（2011-2017）。
- 同一文件另有独立声明：`The Zotero name is a registered trademark of the Corporation for Digital Scholarship. See https://www.zotero.org/trademark`。
- 源码文件头部重复同一许可，例如 [`src/common/translators.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/translators.js#L1-L23) 与 [`src/common/singlefile.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/singlefile.js#L1-L24)。仓库根无 `LICENSE`/`LICENSE.md`（均 404）。
- 检查范围：仅 `COPYING` 与若干源文件头部。`lib/SingleFile` 内第三方组件的许可文本本轮未核证。
- 边界：以上记录仓库自述的许可与商标声明；实际复用须履行适用许可，具体衍生组合及分发义务根据纳入源码和第三方资源核对。本轮没有作出整个 Scholoom 产品的许可判断。

## 事实 2：文档声明的浏览器支持

- [`README.md`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/README.md) 的 “Developing / Technologies” 段声明三类：Chrome/Firefox 的 WebExtension API、Safari Extension Framework（指向独立仓库 [`zotero/safari-app-extension`](https://github.com/zotero/safari-app-extension)）、Zotero Translator Framework（指向 `zotero/translate`）。
- README 构建说明分别给出 Chrome（`chrome://extensions/` → Load unpacked → `build/browserExt`）与 Firefox（`about:debugging` → Load Temporary Add-on → `build/browserExt/manifest.json`）的加载路径；Safari 一节仅外链上述仓库。
- 清单侧：[`src/browserExt/manifest.json`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/browserExt/manifest.json) 为 `manifest_version: 2`、`minimum_chrome_version: 55`、`applications.gecko.id: zotero@chnm.gmu.edu`、`strict_min_version: 58.0`；[`src/browserExt/manifest-v3.json`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/browserExt/manifest-v3.json) 为 `manifest_version: 3`、`minimum_chrome_version: 88`、后台改为 `service_worker: background-worker.js`、新增 `sandbox.pages: [offscreen/offscreenSandbox.html]` 与 `declarative_net_request`。
- Safari 另有 `src/safari/` 源码目录（含 `global.html`、`messaging_inject.js`、`reinjectGuard.js`），本轮未逐个读取。
- 检查范围：README 与两份 manifest。Edge 等其他浏览器的官方支持矩阵未在该 README 中出现，本轮未核证。

## 事实 3：页面识别与 translator 执行的具体模块

- [`src/common/translators.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/translators.js#L402-L461)：`Zotero.Translators.getWebTranslatorsForLocation(URI, rootURI, callback)` 是 URL 级识别入口——遍历 `_cache["web"]`，按 `translator.webRegexp.root` / `.all` 匹配并生成代理候选，返回 `[potentialTranslators, proxies]`，再用 `Zotero.Translators.CodeGetter` 拉取代码。同文件 `updateFromRemote` / `_doUpdateFromRemote`（[#L167-L261](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/translators.js#L167-L261)）负责 translator 元数据的远端更新。`_fullFrameDetectionWhitelist = ['resolver.ebscohost.com']` 是硬编码的整帧检测例外。
- [`src/common/translateWeb.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/translateWeb.js#L50-L118)：注入侧的 `Zotero.TranslateWeb`，`detect()` 调 `translate.getTranslators(true, ...)`，`translate()` 执行 translator 并在失败时沿候选链 fallback。文件末尾把 `Zotero.Translate.ItemSaver.prototype.saveItems` 替换为仅累积 items 的 mock。
- [`src/common/inject/inject.jsx`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/inject/inject.jsx#L57-L135)：注入入口 `Zotero.Inject.init()`，`shouldInject` 限定 http/https 且为顶层窗口或允许的 iframe；注册 `translate` / `saveAsWebpage` / `updateSession` / `pageModified` / `historyChanged` 消息监听并转交 `Zotero.PageSaving`。
- [`src/common/inject/pageSaving.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/inject/pageSaving.js#L95) 的 `onPageLoad(force)` / [#L526](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/inject/pageSaving.js#L526) 的 `onTranslate(translatorID, options)` 是识别后的会话与条目选择层；[#L283-L285](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/inject/pageSaving.js#L283-L285) 显示 translator 全部失败时回退 `saveAsWebpage({snapshot: true})`。
- `zotero/translate` 提供 translator 执行框架；具体站点 translator 的元数据与代码取得路径见事实 5 的 `repo.js`，二者职责分别表达。

## 事实 4：附件与快照的具体模块

- [`src/common/itemSaver.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L93)：`saveItems(items, attachmentCallback, itemsDoneCallback)` 是条目与附件落地总入口。本机路径走 `Zotero.Connector.callMethod("saveItems")`（[#L182](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L182)），附件下载走 `saveAttachmentsToZotero` / `_saveAttachmentsToZotero`（[#L197-L274](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L197-L274)），resolver 附件走 `saveAttachmentFromResolver`（`hasAttachmentResolvers` / `saveAttachmentFromResolver` 两个 callMethod）。附件是否下载由 `automaticSnapshots` 与 `downloadAssociatedFiles` 两个 pref 决定。
- 云端路径：同一文件 [#L400](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L400) 先 `Zotero.API.createItem(newItems)`，再 [#L451](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/itemSaver.js#L451) 的 `_saveAttachmentsToServer(itemKey, baseName, attachments, prefs, ...)` 按 `text/html`、`application/xhtml+xml` 判定快照型附件。
- 快照生成：[`pageSaving.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/inject/pageSaving.js#L321-L425) 的 `_saveAsWebpage` → `Zotero.Connector.callMethod("saveSnapshot", data)`；`_saveSingleFile` → `Zotero.SingleFile.retrievePageData()` → `Zotero.Connector.saveSingleFile({ method: "saveSingleFile" })`。
- [`src/common/singlefile.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/singlefile.js#L29-L140)：`Zotero.SingleFile` 负责注入 SingleFile 核心脚本 `lib/SingleFile/single-file-hooks-frames.js`（两份 manifest 都把它列入 `web_accessible_resources`）、取 `singleFileConfig` pref、暴露 `singleFileFetch`。同文件 [#L125](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/singlefile.js#L125) 注明 `Zotero.SingleFile.CONFIG` 在构建期从 `zotero-client` 仓库的 prefs 生成。
- [`src/browserExt/browserAttachmentMonitor/`](https://github.com/zotero/zotero-connectors/tree/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/browserExt/browserAttachmentMonitor) 是浏览器扩展侧的附件下载监视 UI（含 `.html`、后台与注入脚本）。

## 事实 5：本机协议与官方云端 fallback 的耦合位置

- 本机基址是一个 pref：[`src/common/zotero.js#L347`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/zotero.js#L347) `"connector.url": 'http://127.0.0.1:23119/'`。
- 协议编排在 [`src/common/connector.js#L160`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/connector.js#L160) `Zotero.Connector.callMethod`：`uri = Zotero.Prefs.get('connector.url') + "connector/" + method + queryString`；固定请求头 `X-Zotero-Version` 与 `X-Zotero-Connector-API-Version`（[`#L191-L195`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/connector.js#L191-L195)）；`status === 0` 或 `>= 400` 且缺少 `X-Zotero-Version` 响应头时按连接失败处理并翻转 `Zotero.Connector.isOnline`（[`#L236-L265`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/connector.js#L236-L265)）；多处对 `http://127.0.0.1/*` 做 host permission 检查。
- 云端入口分两处：translator 元数据与代码来自 [`src/common/repo.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/repo.js#L41-L121)（`${ZOTERO_CONFIG.REPOSITORY_URL}metadata?...`、`code/${translatorID}?version=`，并检查 `https://repo.zotero.org/*` 权限）；条目与附件写入来自 [`src/common/api.js`](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/src/common/api.js#L139-L167)（`config.API_URL` + `Zotero-API-Key` 头、`users/{id}/keys/current` 校验、`auth-token` / `auth-token_secret` pref）。
- 硬编码的官方域名同时出现在两份 manifest 的权限声明：MV2 的 `permissions` 与 MV3 的 `host_permissions` 都含 `http://127.0.0.1/*`、`https://repo.zotero.org/*`、`https://api.zotero.org/*`。
- fallback 的实际判定分支在 `itemSaver.js` 中同时存在本地 `callMethod` 与 `Zotero.API.createItem` 两条路径，README 也说明本机不可用时回落到 zotero.org API；**本轮未读取决定走哪条分支的条件代码**，故具体切换条件未核证。

## 事实 6：改品牌／连接目标／产物保存时的代码可定位依赖（静态判断，未验证）

可由 grep 定位的耦合点：

- 品牌与商店元数据：两份 manifest 的 `name: "Zotero Connector"`、`homepage_url: https://www.zotero.org/`、`Icon-*.png`、`applications.gecko.id: zotero@chnm.gmu.edu`、`__MSG_extension_*` 本地化键、`options_ui.page: preferences/preferences.html`、快捷键 `Ctrl+Shift+S`。
- 连接目标：`zotero.js` 的 `connector.url` 默认值；`connector.js` 的 `connector/` 路径前缀、`X-Zotero-*` 头与 `CONNECTOR_API_VERSION` 常量；`repo.js` / `api.js` 的 `ZOTERO_CONFIG.REPOSITORY_URL`、`config.API_URL`；manifest 中三条硬编码 host permission；`api.js` 的 `auth-token` / `auth-token_secret`。
- 产物保存落点：`itemSaver.js` 的本机与云端双分支、`_saveAttachmentsToServer` 的文件基名与快照 mimeType 判定。
- 文案：`Zotero.getString(...)` 与 `_locales` 消息目录；`inject.jsx` 首次运行文案中的 `clientName` 与 zotero.org 支持页链接。
- 未核证：`ZOTERO_CONFIG` 的生成位置（构建期产物，本轮在该 commit 树内未定位到其内容）；`lib/SingleFile` 第三方组件的许可与体积；Safari 侧 `src/safari/*` 与构建脚本如何改写上述默认值。
- 明确限制：本轮没有构建、没有运行任何浏览器、没有执行测试，因此**不能声称“独立复用已验证”**。以上仅为静态可定位依赖清单。

## 本轮未运行项

- 未 clone 仓库、未 `npm install`、未跑 `build.sh` / `gulp`，未核对 `ZOTERO_CONFIG` 生成逻辑与 `gulpfile.js` 注入脚本清单。
- 未运行浏览器扩展，未加载任何页面，因而 translator 的实际识别与抓取结果、单文件快照生成、附件下载均未做行为验证。
- 未连接本机 23119 端口，未验证 connector HTTP 协议与桌面端的实际交互。
- 未访问 zotero.org、repo.zotero.org、api.zotero.org，未验证云端 API 路径、OAuth 流程与 translator 拉取。
- 未读取 `itemSaver.js` 中本地／云端分支的判定条件，未读取 `lib/SingleFile` 许可文本。
- 未核证官方对 Edge 等非 Chrome/Firefox/Safari 浏览器的支持矩阵；README 中无该表述。
