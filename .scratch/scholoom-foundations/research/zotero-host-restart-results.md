# Scholoom 宿主原型第六轮：Electron 接入与正常重启恢复

关联 [#16](../issues/16-zotero-host-prototype.md)。2026-10-04 用户要求“继续下一轮实验”。本轮回答：**能力侧先工作，自己的工作台随后接入并修改；关闭工作台、退出兼容宿主后，重启能否继续使用同一文献及书签？**

这条闭环通过。本轮使用真实 Electron 40.9.3 承载第五轮阅读视图，页面经 preload／主进程 IPC 调用共同文献接口，再到原插件。正常退出后复用同一安装树、profile 和库，原文献与材料身份、修改过的题录、引用键、书签位置及 PDF 字节保持一致，重启后可再修改和导出。

后台始终是完整 Zotero，文献权威也由其原生库维护。这只提供外部调用与界面接入的参考事实，没有证明 Scholoom 独立兼容内核成立。独立运行原包与原生文献适配的后续证据见[最小宿主实验](zotero-host-minimal-results.md)。

原包与参考宿主沿用 Zotero 10.0.5、BBT 9.0.68、茉莉花 1.1.39。初始中文元数据样本仍来自固定 CNKI／translator 返回回放，不代表线上识别；恢复阶段不重跑该回放。

## 验证了怎样的使用过程

| 时点 | 实际行为与结果 |
| --- | --- |
| 初次启动，Electron 尚未运行 | 单命令控制入口建立隔离库和原插件样本。能力侧读题录、导航及 PDF，改标题为 `Research source saved before restart`，原引用键保持，BBT 两种实际导出通过 |
| Electron 工作台接入 | 页面读取上述同一文献及导航，真实渲染两页 PDF；大纲／书签导航通过，名称经原茉莉花改为 `重启前保存的书签`，整页刷新仍显示保存值 |
| 关闭 Electron 窗口与进程 | 能力侧继续读取保存结果、核对 PDF 不变、调用 BBT 导出；原 Reader 重开读到相同名称 |
| 兼容宿主正常退出 | 控制入口等待进程退出，再以只读 SQLite 核对题录标题、引用键、条目及附件父子关系；记录首次退出后的预期状态 |
| 新进程重启，工作台仍未接入 | 按持久身份映射解析原条目，跳过题录、附件、大纲和书签样本重建；能力侧在修改之前读到完整的首次保存状态 |
| 恢复后的继续工作 | 能力侧改标题为 `Research source updated after restart` 并导出；新的 Electron 工作台接入，读取原书签并再次改名为 `重启后保存的书签`；关闭后能力侧及原 Reader 仍能读回 |

前后为同一内部 libraryId／sourceId／materialId、兼容 key 和书签 id。controller 另外独立核对两次停机 SQLite 的真实 itemID、附件 parentItemID、条目总数及存储目录集合，并与恢复后的原生对象 id 对照；不会只比较被复制的身份映射文件。两次 IPC 是不同 session，使用新端口／token；短期 token 不保存到仓库。

最终证据在 [final](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/)，控制结果见 [restart-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/restart-results.json)，恢复后界面见[截图](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/resumed/reader-view.png)。预期状态文件只供核对；实际恢复读取经 RPC 到同一原生库与原插件 sidecar，不用预期文件充当查询结果。

## Electron 与共同接口的边界

新增 restart-electron.cjs／restart-preload.cjs。真实 BrowserWindow 的 renderer 使用 `contextIsolation: true`、`nodeIntegration: false`，preload 仅暴露四个有界操作：读取题录、材料、导航，以及改名指定书签。主进程导入同一个 literature-interface.mjs，负责兼容标识与 RPC；renderer 不持有数据库、宿主窗口或 IPC token。

实验实际记录主进程版本、PID，以及 renderer 中 bridge 存在、`window.require` 不可用，见[基线](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/resumed/browser-baseline.json)与[renderer 观察](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/resumed/electron-renderer-observation.json)。主进程实际请求及原插件写回在 [electron-main-rpc-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/resumed/electron-main-rpc-results.json)。

Playwright 的本地路由提供 HTML、阅读脚本和 PDF.js 模块，Electron 原生 IPC 提供数据操作；页面资源加载仍由实验工具代管，不是正式应用协议实现。没有开发服务器。能力侧仍是确定性实验脚本，没有接入正式 Agent harness。

复用本机缓存 electron-v40.9.3-linux-x64.zip，只解压到控制运行的临时目录；没有 npm 安装。实测内置 Chromium 为 144.0.7559.236、Node 为 24.14.1。使用已有 Playwright 及其 loader 连接实际 Electron，主／renderer 隔离语义依据 [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)，自动化入口依据 [Playwright Electron 文档](https://playwright.dev/docs/api/class-electron)。这些是本次固定版本，不是上游最新版判断或正式组件选型。

“工作台未打开”在本轮有明确范围：Electron 尚未启动或已经退出，能力侧仍工作。内部完整 Zotero 已通过 Xvfb 初始化主窗口，原 Reader 仍用于插件写入。未验证无内部窗口或无显示服务器运行；这与第三轮的纯 headless 对照不同。

## 恢复时发现的适配成本

最早的 Chromium 恢复对照已读回保存的题录和书签，BBT 导出及自己的 PDF 导航也通过，但再次改书签失败。真实 Electron 对照重现了同一失败，保留在 [before-sidebar-fix](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/before-sidebar-fix/)。

适配代码原先将“没有书签节点”作为点击侧栏开关的条件；原侧栏已展开而插件控件未注入时，会把侧栏关闭。现改为只在 `sidebarContainer` 不存在时打开。已恢复 tab 仍可能早于插件的 toolbar 监听注册，因此适配保留一次正常的原 Reader 关闭／重开；最终恢复改名确实使用了这次重开，再经原标题编辑事件保存成功。

这些观察说明，保存侧仍需处理原 Reader 的侧栏状态与恢复 tab。原 XPI 没有改写，没有替换插件钩子或直接写 sidecar。一次重开之外没有扩展为完整启动／生命周期修复。此成本延续第五轮结论：自己的阅读界面可以独立呈现，原插件写入依赖仍在。

Electron 试跑还出现过工具 loader 未接入，以及未导航的空窗口没有成为可观察页面的失败。修正实验接线后通过；[失败索引](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/earlier-failed-trials.json)保留目录和非零退出结果。原始目录未删除。最终运行是 `/tmp/scholoom-restart-experiment-UEt9E4`；较早通过的 `/tmp/scholoom-restart-experiment-oAEX7n` 也保留，但最终结果增加了独立停机对象／存储核对。

## 运行结果与交付

| 检查 | 结果 |
| --- | --- |
| 首次生命周期 | 4 项主链路、6 项 Electron 界面检查通过 |
| 恢复生命周期 | 4 项主链路、6 项 Electron 界面检查通过；界面检查被主链路汇总，不重复计算功能覆盖 |
| 同一库、条目及存储核对 | controller 检查通过，身份与父子关系保持，未重建样本 |
| 初始准备／恢复解析 | 初始 9 项准备检查通过；恢复 2 项检查通过，包括原包加载和原对象恢复 |
| 停机落盘 | 两次标题／引用键与最后读回一致，SQLite integrity_check 均为 ok |
| 第五轮普通浏览器路径回归 | 5 项浏览器、3 项主链路通过；宿主准备和停机核对通过 |

回归证据见 [reader-regression](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/reader-regression/)。验证还包括 JS／MJS／CJS 语法、精简证据 JSON 和本地文档链接核对。未新增测试套件、安装依赖、启动开发服务器、修改日常文献库或提交代码。

新增 restart-run.mjs、restart-client.mjs 和 Electron 主进程／preload；run.mjs 增加正常恢复入口，重用原安装树／profile／data，仅新建证据目录。bootstrap.js 按身份映射直接解析原条目；ipc.js 修正侧栏打开判据并增加一次有界 Reader 重开。reader-view.mjs 支持 preload 提供的操作，reader-browser.mjs 接入时检查真实导航状态，普通浏览器路线继续可用。运行命令见 [README](../prototypes/zotero-host-prototype/README.md)。

两份原 XPI 及参考宿主 app/omni.ja 保持原字节，见[最终工件核对](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/artifact-observations.json)。原插件卸载、Reader dead object 和数据库退出阶段日志仍有错误；正常退出码、已保存字段与完整性通过，不代表干净生命周期。

## 对路线选择的意义

完整 Zotero 参考宿主已取得原包代表性业务、外部接口、Electron 呈现和正常重启续用的实证。它暴露了内部 Reader、原生库和生命周期依赖；这些事实不足以比较独立兼容层与裁剪 Gecko 宿主，也不足以支持正式宿主选择。

尚未覆盖独立安装包及离线资源协议、跨平台、异常终止／断电恢复、并发与多文献、复杂 PDF 和性能、正式 Agent harness、其他首批兼容功能。Electron／Node 内直接运行原包及 Scholoom 原生存储兼容视图，也不能由本轮成功推导。#16 保持 claimed，正式 Answer 待路线选择；后续首先验证独立宿主与文献适配，不沿本轮继续追加套壳功能。
