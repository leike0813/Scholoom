# Zotero 原包宿主原型

这是 [#16 宿主决策票](../../issues/16-zotero-host-prototype.md)的一次性运行探针，回答指定原包在两类宿主中能实际到达什么阶段。结果供选择路线，不是应用实现或完整兼容认证。

基线：Linux x86_64、Zotero 10.0.5、Better BibTeX 9.0.68、茉莉花 1.1.39。原包保持不变，独立 companion 插件调用真实功能并记录结果。

2026-10-04 已实跑：[结果报告](../../research/zotero-host-prototype-results.md)与[精简原始证据](evidence/2026-10-04/)。10 项窄检查通过；茉莉花卸载和宿主退出日志仍有错误，`plugin-disable-lifecycle` 只检查全局对象移除，不保证无错误卸载。Node 输出是缺失服务诊断，不是功能兼容成功。

第二轮验证独立 Node IPC、关窗后修改／导出和 Reader 重接，见[第二轮报告](../../research/zotero-host-ipc-results.md)。第三轮验证无主窗口冷启动，见[冷启动报告](../../research/zotero-host-cold-start-results.md)：已初始化库的 BBT 读写／已有键／导出通过，新库初始化和茉莉花 Reader 路径未通过。三轮固定同一宿主和原插件版本，分别保存证据。

第四轮回到 Scholoom 的接口与数据目标，见[能力接口实验](../../research/zotero-host-boundary-results.md)：同一原型接口供能力脚本与独立工作台侧客户端使用，双方读写同一文献，消费原包引用导出和阅读状态。没有实现正式 Electron 工作台或更换文献权威。

第五轮验证自己的 PDF 阅读视图与书签写回，见[阅读交互实验](../../research/zotero-host-reader-results.md)：真实 PDF 页面导航、界面改名、能力侧读回及原 Reader 重开通过。原茉莉花的保存仍依赖原 Reader DOM；该依赖列入路线比较。

第六轮验证真实 Electron 接入和正常重启续用，见[重启闭环实验](../../research/zotero-host-restart-results.md)：工作台接入前／关闭后可调用，重新启动同一库后读回原身份和保存状态，并继续修改书签。内部原 Reader 依赖保留，独立打包仍未完成。

## 运行

从 Scholoom 根目录执行：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs
```

默认下载三份官方工件。已有工件时可复用下载：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

资产目录应含 `Zotero-10.0.5_linux-x86_64.tar.xz`、`zotero-better-bibtex-9.0.68.xpi` 和 `jasminum_1.1.39.xpi`。该临时目录只在本机本次运行期间有效；可换成自己的保存位置。

运行需要已有 Node 24、curl、tar、unzip、zip、Xvfb／xvfb-run，以及 `$HOME/.ar` 的锁定 uv 共享环境和其中的 pypdf。没有项目依赖安装、虚拟环境或开发服务器。

### 第二轮：独立客户端与窗口重接

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=ipc
```

也可加 `--asset-root=<资产目录>` 复用下载。入口先建立与第一轮相同的临时题录／Reader 样本，然后启动 companion 的 loopback HTTP JSON 服务和独立 `ipc-client.mjs` 进程。默认 Connector 服务仍关闭；实验服务使用临时端口和仅保存于该临时目录的随机 token。

客户端依次读题录、修改标题、核对 Item／SQL、实际关闭主窗口、关窗后再修改并导出两种格式，随后重开窗口和 Reader，检查原茉莉花书签。关闭窗口前使用 `Services.startup.enterLastWindowClosingSurvivalArea()` 保活，这不是原包默认关窗行为，也不证明无显示环境运行。客户端结束时发出 shutdown，保留全部证据。

客户端可针对仍运行的实验宿主单独执行：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/ipc-client.mjs --output-dir=<本次临时运行目录>
```

它只操作本次两个 fixture 的 `libraryID + key`，不是通用文献 API；每次执行末尾会请求关闭宿主。标题导出检查允许 BBT 的大小写和花括号处理，不断言完整 BibTeX 文案。宿主退出后，入口用 Node 24 内置 SQLite 的只读连接核对实际保存的标题／引用键和完整性，不建立第二份可写题录库。

第二轮额外输出 `ipc-client-results.json`（8 项客户端检查和每次响应）、`ipc-host-events.json`（宿主执行记录）、`ipc-BetterBibTeX.bib`／`ipc-BetterBibLaTeX.bib`、`ipc-persisted-state.json`、`ipc-client-process.json`。`ipc-ready.json` 只供临时发现服务，含短期 token，不纳入仓库证据。第二轮以应用退出结束，没有执行第一轮的插件禁用检查。

每次运行创建新的 `/tmp/scholoom-host-prototype-*` 目录。宿主安装树、profile、库和附件均在其中，固定关闭自动更新和同步，不使用日常 Zotero profile，也不启用默认 Connector HTTP 端口。Xvfb 提供虚拟屏幕，仍运行完整 GUI 宿主。总运行时限四分钟；结束后目录保留供检查，不自动删除。

### 第三轮：无主窗口冷启动

新库对照默认不用显示服务器：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=cold --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

已初始化库对照使用前轮正常停止、带 fixture 身份记录的临时运行目录：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=cold --seed-from=/tmp/scholoom-host-prototype-xr2bOn --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

入口复制停机 data 到新的隔离目录，不在源库上启动。临时源目录不存在时先跑第二轮，用其输出目录替换 seed-from；不使用日常库作 seed。加 `--display=xvfb` 可做有显示服务器的无主窗口启动对照。

headless 模式移除 DISPLAY／WAYLAND_DISPLAY，使用完整 Gecko 的 `-headless`。临时宿主 app/omni.ja 仅增加 cold-launch.xhtml／js 两个启动成员，已有源码成员与原发布 XPI 保持不变；通过 chrome 页面加载原生内核和 companion，观察期间不打开主窗口、不完成 uiReadyPromise。保留 chrome helper 的 DOM 不等于纯 CLI 内核或裁剪宿主。

BBT ready 最多观察 60 秒，再额外观察茉莉花对象最多 5 秒。独立 cold-client.mjs 使用与 ipc-client.mjs 共用的 rpc-client.mjs，先观察原生读写及就绪的 BBT 导出，再开真实主窗口，必要时经原 AddonManager 再启用茉莉花，检查实际 Reader 控件。全局对象出现只是一项窄检查；原包钩子未替换。新库不会手工预装 translators，自动在线更新关闭不绕过 bundled 安装。

本轮实跑的新库和已初始化库均保留功能失败，整体入口退出 1，宿主正常退出后仍执行只读落盘核对。增加 launch.json、seed-items.json（仅 seeded 组）、cold-BetterBibTeX.bib／cold-BetterBibLaTeX.bib（仅实际导出成功时）及冷观察字段。精简证据见 [2026-10-04-cold](evidence/2026-10-04-cold/)，其中 Xvfb 组是早期未增加再启用对照的版本，不能作为最终代码的严格单变量比较。

### 第四轮：文献接口与工作台侧消费

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=boundary --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

复用正常参考宿主及真实样本，不执行第三轮冷启动，也不重复 Node 兼容层探针。此轮将茉莉花样本父题录与其 PDF 作为同一来源，经 literature-interface.mjs 映射独立 sourceId／materialId。identity-bindings.json 只保存标识映射，当前题录只在临时原生库中保存。

boundary-client.mjs 更改标题、调用原 BBT 重生成键并导出，然后启动独立 workbench-client.mjs。后者通过共同接口重新读取题录、大纲和书签，再修改标题并导出；能力侧续读，核对同一来源，停止宿主后核对 SQLite。9 项主链路和 5 项工作台侧检查通过；另跑第二轮回归检查共享 RPC。

新增 agent-client-results.json、workbench-client-results.json、workbench-state.json、workbench-process.json、两端实际 .bib 及 workbench-view.html。HTML 是第二消费者生成的静态呈现，可直接打开；不包含实时接口或 PDF 阅读器。两端原始请求中保留宿主诊断，文献 DTO 不含 Item／SQL／原始宿主标识。RPC 使用明确的 UTF-8 字节写出，中文字段与宿主记录核对。

本轮原 app/omni.ja 和两份 XPI 均不修改。仍使用完整参考宿主与 Xvfb；其内部窗口及插件初始化不是独立分发验收。实跑证据见 [2026-10-04-boundary](evidence/2026-10-04-boundary/)。

### 第五轮：独立 PDF 视图与书签写回

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --round=reader --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr --browser-executable=/home/joshua/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
```

此命令复用本机已有浏览器工具与缓存。请将 browser-executable 换成自己的已有 Chromium 路径；默认从当前 Node 安装旁的 `@playwright/mcp/node_modules/playwright/index.mjs` 导入已安装库，也可用 `--playwright-module=<已有 index.mjs 的绝对路径>` 指定。省略 browser-executable 时使用该库默认浏览器缓存；缓存不匹配会失败，入口不会安装库或浏览器。

入口从已有宿主归档提取原 PDF.js 两个模块到本次临时目录，reader-client.mjs 启动已有 headless Chromium，由 reader-browser.mjs 在本地路由提供 reader-view.html／mjs、PDF.js 及共同文献接口。虚拟页面地址是 `http://scholoom-reader.invalid`，没有开发服务器；直接双击 HTML 无法运行这个实时实验。

浏览器打开同一真实附件，点击大纲和书签导航，保存名称，再刷新页面；能力侧续读，companion 关闭并重开原 Reader 核对。`renameBookmark` 只对该样本已有书签触发原编辑事件并等待原 sidecar 保存，不直接写 JSON。真实数据、页码和坐标返回后由自己的视图渲染，原 Reader 仍用于兼容侧写入。

5 项浏览器检查与 3 项主链路检查通过。新增 browser-baseline.json、reader-browser-results.json、reader-browser-rpc-results.json、reader-agent-results.json、reader-initial-navigation.json、reader-methods-page.png 和 reader-view.png；继续输出共享 IPC、进程及停机核对工件。精简证据及第四轮回归见 [2026-10-04-reader](evidence/2026-10-04-reader/)。这不是正式阅读组件选择或 Electron／跨平台分发验收。

### 第六轮：真实 Electron 与同一库重启

```sh
xvfb-run -a node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/restart-run.mjs --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr --electron-archive=/home/joshua/.cache/electron/c603513df72c219a7faac87aed80f486458f47ea4382e6b89a975417f71ff9c0/electron-v40.9.3-linux-x64.zip
```

electron-archive 指向已有 Electron Linux x64 归档，请换成自己的保存路径。本轮复用固定 40.9.3；入口只解压到新临时目录，不安装依赖。外层 Xvfb 供 Electron 使用，内部兼容宿主仍由已有入口单独提供 Xvfb。Playwright 库路径沿第五轮选项 `--playwright-module` 指定。

restart-run.mjs 依次启动 `run.mjs --round=restart` 及 `--resume-from=<首次目录>`。第二次复用同一安装树、profile、data，新的目录只保存本次证据／渲染资源；持久 UUID 映射恢复，原始首次报告保留，不复制库或重建样本。每个宿主运行仍有四分钟上限，阶段失败则控制入口退出非零并保留证据。

restart-client.mjs 在打开 Electron 前读取／修改／导出，随后通过真实 BrowserWindow 和主进程 IPC 接入阅读视图，改书签并刷新。关闭工作台后再由能力侧读回／导出；正常停止宿主后再以新进程重开，先核对上一轮保存状态，再继续操作。题录仍由唯一临时原生库管理，书签由原插件保存。

每阶段输出 4 项主链路和 6 项窗口检查，以及 electron-main-rpc-results.json、electron-renderer-observation.json、browser-baseline.json、restart-expected.json。controller 另保存 restart-results.json／before-restart.json，独立核对停机条目、附件关系、存储目录及恢复对象。精简证据见 [2026-10-04-restart](evidence/2026-10-04-restart/)。

没有 electron-archive 时也可加第五轮的 browser-executable 运行普通 Chromium 对照；该路径不记为 Electron 验收。直接单次运行 round=restart 只执行一个生命周期；完整跨重启实验使用 restart-run.mjs。

## 看什么

终端打印检查摘要和证据目录。运行失败会返回非零退出码，保留失败结果：

| 工件 | 内容 |
| --- | --- |
| `baseline.json` | 官方来源、插件 manifest、实际宿主 BuildID 与 Gecko 版本 |
| `gecko-results.json` | 原包激活、BBT、茉莉花、附件与退出生命周期的逐项结果 |
| `node-results.json` | 真实 bootstrap 执行阶段、有限 shim、首个缺失服务与失败日志 |
| `BetterBibTeX.bib`／`BetterBibLaTeX.bib` | 原包实际导出的文字 |
| `bbt-items.json` | BBT 处理后的临时题录 |
| `data/storage/*/jasminum-*.json` | 原插件写入的大纲／书签 sidecar |
| `process-result.json`／`gecko.log` | 子进程退出与完整宿主日志 |

Node 探针也可单独执行：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/node-probe.mjs --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

该路径执行解包后未修改的 `bootstrap.js`，只提供有限宿主服务，`functionalityVerified: false`。它不代表完整 Node 兼容层已实现，也不构成 Electron 实机测试。

## 验证范围

BBT 调用原包 `ready`、`KeyManager.fill` 和 `Translators.exportItems`；比较生成与已有 citationKey，检查 SQL 的实际可见值，保存两种导出。附件边界使用原生 Zotero API，分别记录托管复制、外部链接及未注册入库的项目引用样本，不能代替茉莉花本地匹配或 Scholoom 数据映射验收。

茉莉花元数据探针经原包 taskRunner 执行。固定 CNKI 搜索／页面响应与 translator 返回仅服务离线回放；报告明确区分这些替代输入与原包搜索解析、结果选择和父子条目处理。真实服务登录、验证码、中文 translator 本身及线上识别质量仍需另测。Reader 探针使用真实的合成 PDF，观察原插件大纲与书签界面事件、sidecar 保存和重开读取。

报告中的成功只覆盖该项实际调用。完整 Zotero 中的成功不证明 Scholoom 已完成 Gecko 裁剪、独立分发、工作台重呈现或原生领域桥接。最终比较见 [运行结果报告](../../research/zotero-host-prototype-results.md)。
