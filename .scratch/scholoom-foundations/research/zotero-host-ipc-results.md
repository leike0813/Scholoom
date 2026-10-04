# Zotero 辅助宿主第二轮：独立 IPC、关窗运行与 Reader 重接

关联票：[16](../issues/16-zotero-host-prototype.md)。运行日期：2026-10-04。前轮：[原包宿主结果](zotero-host-prototype-results.md)。本轮代码及复跑方式：[README](../prototypes/zotero-host-prototype/README.md)，原始证据：[2026-10-04-ipc](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/)。

后续已完成[第三轮无主窗口冷启动](zotero-host-cold-start-results.md)：已初始化库的无显示服务器 BBT 导出通过，新库初始化和 Reader 路径未通过；正式文献权威仍未选择。

**独立 Node 客户端已通过真实 IPC 修改、读回并导出临时库中的同一文献。最后一个主窗口实际关闭后，这些能力仍工作；重新打开主窗口和 Reader 后，原茉莉花书签恢复。** 8 项客户端检查和 9 项前置样本检查通过，客户端与宿主均退出码 0。停机后只读 SQLite 核对也通过。窗口卸载与应用退出仍有错误，因此没有验证干净生命周期。

本轮沿用 Zotero 10.0.5／Gecko 140.15.0、BBT 9.0.68、茉莉花 1.1.39，Linux x86_64 + Xvfb。没有升级依赖或改变原 XPI。临时库仍是实验中的唯一题录权威，**不是对 Scholoom 正式存储方案的决定**。

## 实验如何调用

运行目录为 `/tmp/scholoom-host-prototype-xr2bOn`。入口建立新 profile、库和样本，由独立 companion 装载 [ipc.js](../prototypes/zotero-host-prototype/gecko-probe/ipc.js)，使用 Gecko 自带 HttpServer 在 `127.0.0.1` 的临时端口提供 JSON 请求服务。默认 Connector 服务保持关闭。

入口另起 [ipc-client.mjs](../prototypes/zotero-host-prototype/ipc-client.mjs) 进程，本轮客户端 PID 为 `2545776`。它只从 `ipc-ready.json` 发现地址、临时 token 和 fixture 身份，之后真正通过 HTTP 请求宿主；没有靠请求文件轮询执行操作。宿主记录执行结果，客户端独立核对响应。临时 token 不放入仓库证据。

| 方法 | 输入／实际宿主行为 |
| --- | --- |
| `snapshot` | `ref: {libraryID, key}`；解析原生 Item，重新读取字段，并查询同一条目的原生 SQL |
| `updateTitle` | ref 与标题；原生 `setField`、`saveTx` 和 BBT `KeyManager.fill` 后读回 |
| `export` | ref 与 BetterBibTeX／BetterBibLaTeX；调用原包 `Translators.exportItems`，响应包含实际导出文字 |
| `closeWindows` | flush Reader 状态，进入 toolkit survival area，调用真实 `window.close()` |
| `openWindow` | 调用 `Zotero.openMainWindow()`，等待新窗口、itemsView／collectionsView 与 document 就绪 |
| `openReader` | 附件 ref；调用真实 Reader，打开原侧栏，观察原书签 UI 与 sidecar |
| `shutdown` | flush Reader 状态，保存结果，释放保活并请求应用退出；IPC 服务由退出监听关闭 |

服务只接受两个临时 fixture 的身份和这些固定方法，一次执行一个请求。没有提供通用任意 SQL、脚本执行或正式 Agent capability API，也未验证并发、取消、权限模型或跨版本协议。身份使用 Zotero 的 `libraryID + key`，没有冒充 Scholoom 的内部身份映射。

## 8 项客户端检查的实证

| 检查 | 观察到的结果 |
| --- | --- |
| 独立客户端读取 | 主窗口数 1；同一 ref 的 Item 标题／citationKey 与 SQL 相同 |
| 修改与读回 | 标题更新为 `IPC updated literature title`；随后独立 snapshot 读到新值，引用键不变 |
| 真实关闭主窗 | 实际关闭 1 个主窗口，原窗口 `closed=true`，主窗口数降为 0；500ms 后另一请求仍成功，两个插件对象可用 |
| 无主窗读写 | 标题再次改为 `IPC updated while main window closed`；Item／SQL 均读回，citationKey 仍为 `chenResearchAgentsReproducible2026` |
| 无主窗 BibTeX | 原包返回当前标题和同一 citationKey，返回时主窗口数 0 |
| 无主窗 BibLaTeX | 原包返回当前标题和同一 citationKey，返回时主窗口数 0 |
| 主窗口重接 | 主窗口数恢复为 1；同一 ref 仍读到更新后的 Item／SQL 字段。未对具体 GUI 单元格文本做验收 |
| 原 Reader 书签重接 | 同一附件打开真实 Reader，原新增书签按钮存在，UI 与 sidecar 都有 1 条书签 |

详细记录见 [ipc-client-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/ipc-client-results.json) 与 [ipc-host-events.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/ipc-host-events.json)。实际输出：[BibTeX](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/ipc-BetterBibTeX.bib)、[BibLaTeX](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/ipc-BetterBibLaTeX.bib)。BBT 会处理标题大小写和花括号，客户端核对标题语义，不把格式变化当作导出失败。

宿主停止后，入口使用 Node 24 内置 SQLite 创建**只读**连接，按同一 libraryID／key 查询落盘标题和 citationKey，与客户端最后读回的值比较，`PRAGMA integrity_check` 为 `ok`。结果保存在 [ipc-persisted-state.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/ipc-persisted-state.json)。这额外排除了“只改了内存对象”的解释，没有建立第二份可写文献权威；完整性结果也不证明所有插件状态或待处理事务均已正确保存。

## 关窗与无 GUI 的区别

保活是 companion 显式调用 `Services.startup.enterLastWindowClosingSurvivalArea()` 的结果，退出时调用对应 exit。主窗口实际关闭，并触发原插件 `onMainWindowUnload`；没有把关闭按钮改成隐藏窗口，也没有改原插件的窗口钩子。

这证明在该 Gecko toolkit 保活条件下，已经初始化的 BBT 引用键与导出不要求主窗口继续存在。它不证明 Zotero 原包默认关窗行为相同，也不证明无显示环境启动、无需先初始化 GUI、无主窗执行中文抓取或裁剪 Reader 后仍可运行。整个进程仍依赖完整 GUI 宿主和 Xvfb。

源码核对使用本次官方归档的 `app/omni.ja`：`chrome/content/zotero/xpcom/zotero.js:1122` 的 openMainWindow 使用 window watcher，没有窗口就绪 Promise；`chrome/content/zotero/xpcom/plugins.js:111` 处理真实窗口关闭并调用插件卸载钩子；`chrome/content/zotero/standalone/standalone.js:908` 与 `zoteroPane.js:771` 清理 pane／tabs。`reader.js:1087` 的 `_flushState` 等待保存；Reader close 本身同步返回，所以本轮明确使用 `flushAllReaderStates()`，不把 close 当作保存完成屏障。行号是归档中成员源码行号，不是 omni.ja 文件行号。

## 原包与生命周期限制

下载资产和实际加载的两个 XPI 逐字节相同，见 [review-observations.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/review-observations.json)。前置样本继续使用第一轮的固定 CNKI HTTP／translator 返回回放；本轮没有新增线上中文识别成功的证据。

完整日志保留在临时运行目录，仓库保存[相关日志与原行号](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/gecko-log-excerpt.txt)：

- 茉莉花主窗口关闭时抛出 `Zotero.Jasminum.hooks.onMainWindowUnload is not a function`，关闭后重开的功能仍通过，但窗口资源清理不能据此认定完整。
- 静态根因与日志一致：原 `jasminum_1.1.39.xpi` 的 `bootstrap.js:52–53` 调用该方法，`chrome/content/scripts/jasminum.js:9187–9192` 的 hooks 导出只有 onStartup、onShutdown、onMainWindowLoad、onPrefsWindowLoad。内部窗口 listener 框架存在，不等于 bootstrap 所调用的 hook 已导出。
- 应用退出仍出现 `can't access dead object`、AsyncShutdown 的 `Wait is complete, cannot add further promises`，以及数据库关闭／提交时序错误。本轮没有隔离或修复这些原因；退出码 0 和数据库完整性 ok 不代表退出无错误。
- 本轮以 APP_SHUTDOWN 结束，没有执行 ADDON_DISABLE。茉莉花原 bootstrap 在 APP_SHUTDOWN 分支直接返回，因此本轮没有出现 `Cu.unload` 不能证明第一轮禁用错误已解决。

companion 自身的重复关闭服务已修正，最终实跑没有对应的 `NS_ERROR_UNEXPECTED`。原插件包未改写或补 hook。

## 这轮缩小了哪些不确定性

原插件可以由外部 Node 进程通过明确、有限的接口调用；临时题录修改、原生 SQL、BBT 输出及停机落盘相互一致。主窗口生命周期也能与这些已验证能力的运行分开，Reader 可在重开窗口后恢复原插件书签。这比第一轮固定 companion 脚本自动执行多了一条真实调用链。

Gecko 辅助宿主仍应作为优先候选，但生产接入还有明确缺口：文献权威的正式归属与 Scholoom 身份映射、进程启动时不依赖原工作台、Reader 与 Electron 工作台接入、可独立分发的裁剪、支持平台、真实中文 translators，以及原插件生命周期错误。当前只验证“辅助宿主原生库作为实验权威”的路线，没有实现“Scholoom 原生权威提供 Zotero SQL／对象兼容视图”。

下一项应先由用户选择正式文献权威边界，再据此验证独立宿主启动与存储接入。若采用辅助宿主维护兼容库，Scholoom 需通过统一领域服务读写并建立身份映射；若采用原生库加兼容视图，需另做真正的 Schema／写入映射实验。不能用这轮原生 Zotero 成功替代后一种证据。#16 保持 claimed，尚未写正式 Answer。

## 复跑与改动

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=ipc --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

省略 asset-root 会下载固定工件。新增 ipc.js 与 ipc-client.mjs；run.mjs 增加第二轮编排和退出后只读核对；bootstrap.js 按轮次启动 IPC，服务期间保持插件存活。第一轮的 Node 有限兼容层诊断没有功能进展，不把本轮 Node 客户端与其混淆。README、两轮报告、票和地图同步记录。

验证完成：8 项独立客户端检查、9 项前置真实样本检查、落盘标题／引用键及 SQLite 完整性；JS 语法检查及本地工件链接检查。未新增测试套件、安装依赖、创建虚拟环境、启动开发服务器、提交代码或切换分支。
