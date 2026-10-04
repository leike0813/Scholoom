# Zotero 原插件宿主原型：运行结果与选择依据

票：[16](../issues/16-zotero-host-prototype.md)。日期：2026-10-04。入口：[运行说明](../prototypes/zotero-host-prototype/README.md)，实测证据：[2026-10-04](../prototypes/zotero-host-prototype/evidence/2026-10-04/)。这是一次性兼容实验，不是产品实现或正式宿主决定。

后续：[第二轮 IPC 结果](zotero-host-ipc-results.md)已验证独立 Node 客户端、真实关窗后的题录修改与 BBT 导出、窗口／Reader 重接及停机落盘。本报告以下内容是第一轮证据范围；第二轮仍未解决正式文献权威、裁剪分发或干净生命周期。

**完整 Zotero 10.0.5 能运行两份原插件，并完成选定的 BBT 和 Reader 路径。有限 Node 适配尚未进入可验收的业务功能。** 当前证据支持优先继续验证 Gecko 辅助宿主；它没有回答如何裁剪、独立分发及接入 Scholoom 的文献权威。用户尚未选择路线，票保持 claimed。

## 固定基线与隔离

| 工件 | 实际版本与来源 |
| --- | --- |
| 宿主 | Linux x86_64，Zotero 10.0.5；应用 BuildID `20260930214910`；[官方精确版本归档](https://download.zotero.org/client/release/10.0.5/Zotero-10.0.5_linux-x86_64.tar.xz) |
| Gecko | `140.15.0`，平台 BuildID `20260826142222`，mozilla-esr140；来自实际 `platform.ini` |
| Better BibTeX | [v9.0.68](https://github.com/retorquere/zotero-better-bibtex/releases/tag/v9.0.68)，manifest 支持 `8.0.1` 至 `10.*` |
| 茉莉花 | [v1.1.39](https://github.com/l0o0/jasminum/releases/tag/v1.1.39)，manifest 支持 `9.0.3` 至 `10.*.*` |

采用本次核对的最新稳定 Zotero，随后固定版本，避免运行时自动漂移。[官方版本历史](https://www.zotero.org/support/changelog)是版本核对入口；实际归档信息和两个插件 manifest 保存在 [baseline.json](../prototypes/zotero-host-prototype/evidence/2026-10-04/baseline.json)。

三份官方工件下载或复制到临时目录；宿主完整解包。新的 profile、数据库、合成题录、PDF 和 companion 插件均位于 `/tmp/scholoom-host-prototype-kFmGXl`。使用 `-no-remote` 和 Xvfb，关闭自动更新、同步和默认 Connector HTTP 服务，没有使用日常文献库。Xvfb 提供虚拟屏幕，实际运行的是 GUI Zotero，不能据此称为无 GUI 宿主。

两份原 XPI 未改写、未重打包。实跑后逐字节比较下载资产与 profile 中原包，均相同；见 [review-observations.json](../prototypes/zotero-host-prototype/evidence/2026-10-04/review-observations.json)。独立 companion 调用其功能。元数据回放仅临时替换三个输入边界，结束后恢复，范围如下表。

## 实际达到的行为

| 路径 | 实跑结果 | 验证边界 |
| --- | --- | --- |
| 原 XPI 装载 | 两插件 active，版本正确，资源来自各自原 XPI 的 `jar:file:` URI | Zotero 原生加载器；未实现独立加载器 |
| BBT ready | `ready` 完成，KeyManager started | 原包真实初始化 |
| 引用键 | 生成 `chenResearchAgentsReproducible2026`；保留 `ScholoomPreserved2026`；再次 fill 后不变 | 原包 `KeyManager.fill`，两条合成题录；未测冲突、所有偏好和大库 |
| SQL 可见性 | 两个 citationKey 均可经原生 fields/itemData/itemDataValues 查询 | 实际 Zotero SQL 与 Item 一致；未测 Scholoom Schema 映射 |
| BibTeX／BibLaTeX | 导出 408／422 字节，包含两个实际 key | 原包 `Translators.exportItems`；worker 日志也出现两次实际导出。未测自动导出、复杂字段、所有格式 |
| 中文元数据 | 原 taskRunner 搜索、筛选、处理译入条目并建立 PDF 的父题录，状态 success | **离线回放**：替换 CNKI cookie 获取、两次 HTTP 响应、`Zotero.Translate.Web.translate` 返回。译入题录由 fixture 创建；不证明真实 CNKI、登录／验证码、translator 抓取或识别质量 |
| PDF 大纲 | 真实 Reader 提取 `Introduction`、`Methods`，原插件写入 outline sidecar | 两页 PDF 已带嵌入大纲；未测无大纲 PDF 的标题推断、中文 OCR 或大纲编辑 |
| Reader 书签 | 打开原侧栏，点击茉莉花原按钮，新书签写入 sidecar；关闭并重开 Reader 后显示 1 条 | 原界面事件和真实 Reader；未测删除／排序／跨窗及工作台重呈现 |
| PDF 字节 | 添加上述书签前后字节相同 | 本路径写 `jasminum-bookmarks.json`；不泛化到其他可能写 PDF 的功能 |
| 托管／链接附件 | 原生 import 复制入 storage，link 保留外部路径，父条目正确 | linkMode 分别为 0／2；未测茉莉花本地匹配、缺失重定位或真实库迁移 |
| 项目文件 | 独立 PDF 样本未注册为题录或附件 | 展示文件与库记录的区别；未实现 Scholoom 项目模型 |
| 禁用与退出 | 两插件全局对象移除；宿主退出码 0，无超时／信号中断 | **卸载有错误**，不能视作干净生命周期，详见下一节 |

原始结构化记录见 [gecko-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04/gecko-results.json)，两种实际导出见 [BetterBibTeX.bib](../prototypes/zotero-host-prototype/evidence/2026-10-04/BetterBibTeX.bib) 与 [BetterBibLaTeX.bib](../prototypes/zotero-host-prototype/evidence/2026-10-04/BetterBibLaTeX.bib)。原插件写入的 [outline](../prototypes/zotero-host-prototype/evidence/2026-10-04/jasminum-outline.json) 和 [bookmarks](../prototypes/zotero-host-prototype/evidence/2026-10-04/jasminum-bookmarks.json) 文件也已留存。

### 生命周期的实际限制

`plugin-disable-lifecycle` 的 passed 只断言两个全局对象消失。完整日志显示：

- 茉莉花原 `bootstrap.js:72` 在 ADDON_DISABLE 时抛出 `TypeError: Cu.unload is not a function`；全局移除不代表完整资源清理完成。
- BBT shutdown orchestrator 记录完成，但 Reader teardown 出现 `can't access dead object`。
- 应用退出阶段出现数据库连接已关闭／事务提交前关闭错误；原因尚未隔离，不能据此断言数据损坏，也不能标记退出无错误。

关键原始日志（含原行号）见 [gecko-log-excerpt.txt](../prototypes/zotero-host-prototype/evidence/2026-10-04/gecko-log-excerpt.txt)，退出记录见 [process-result.json](../prototypes/zotero-host-prototype/evidence/2026-10-04/process-result.json)。完整日志、库及安装树保留在上述临时运行目录，未放入仓库；临时目录可被系统清理，仓库中的精简证据仍可阅读。

## Node 兼容层实际结果

[node-probe.mjs](../prototypes/zotero-host-prototype/node-probe.mjs) 将原 XPI 解包，实际执行未修改的 bootstrap 和可到达的 bundle。适配只覆盖明确的初始化 Promise、日志、chrome 注册、脚本加载、部分全局及有限模块。遇到未知服务直接记录失败；没有用万能空对象绕过业务逻辑。

| 原包 | 到达阶段 | 首个缺失服务 |
| --- | --- | --- |
| BBT | bootstrap 求值、startup 调用、chrome 注册；原 bootstrap 捕获失败并报告，startup Promise 返回 | `ChromeUtils.importESModule(resource://gre/modules/FileUtils.sys.mjs)` |
| 茉莉花 | bootstrap 求值、startup 调用、chrome 注册、实际主 bundle 开始加载 | `ChromeUtils.importESModule(chrome://zotero/content/HiddenBrowser.mjs)` |

完整服务列表、阶段与错误栈见 [node-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04/node-results.json)。BBT 的 `startup-settled` 表示调用已返回，不是启动成功。两包均为 `functionalityVerified: false`；这证明当前有限适配不足，不能证明完整 Node 兼容层不可行。本轮没有 Electron 应用，没有测 Electron 扩展机制、Chromium 隐藏浏览器或 Electron GUI。

## 两条路线还要承担什么

以下成本为基于实跑与[既有源码调查](zotero-plugin-host.md)的工程判断，没有工时、内存或跨平台性能实测。

| 维度 | Electron／Node 兼容层 | Gecko 辅助宿主 |
| --- | --- | --- |
| 加载／生命周期 | 要承接原 bootstrap、资源注册、模块／sandbox、窗口钩子；当前仅到首个缺失服务 | 完整 Zotero 已装载原包；裁剪后的 loader、禁用／重启及错误清理仍要验证 |
| 数据与文件 | Item、SQL、Prefs、Notifier、文件 API 须共同遵守一个文献权威；后续成本未实测 | 原生 SQL、Item、附件路径已工作；尚未确定它与 Scholoom 原生领域的权威和写入协议 |
| GUI | 茉莉花依赖真实 Reader、侧栏事件和 HiddenBrowser；替代这些接口仍是大块工作 | 原 Reader 已工作；将视图交给 Electron 工作台、关窗后的调用及进程隔离未验证 |
| Agent 调用 | 只有诊断 CLI，业务能力没有跑通 | Node 命令驱动 companion 完成固定实验，证明自动调用可达；没有通用 IPC／MCP、取消、并发或长期任务接线 |
| 分发维护 | 避免打包另一完整 GUI 宿主，但要维护未测的 Gecko／Zotero 私有语义兼容面 | 当前带完整 Zotero 安装树；独立分发、更新、裁剪、branding／许可责任及安全维护未落实 |
| 跨平台 | 未实跑 Windows／macOS，也未实跑 Electron | 仅 Linux x86_64 + Xvfb；不代表 Windows／macOS、其他显示环境和 Reader 行为相同 |

### 能力接口与数据权威

从本次实际调用看，后续辅助宿主接口至少需要：按稳定身份解析文献、生成／读取 citationKey、对显式选定条目导出、启动元数据任务并读取结果、区分托管与外部附件，以及读取／写入原插件拥有的大纲和书签状态。Reader 展示与程序调用须分别给出真实入口。

这是一份接口需求清单，不是已实现的 API。companion 目前只执行固定 fixtures 后退出；未提供供任意 Agent 请求的文献身份映射、领域服务或常驻能力端点。直接暴露任意 SQL 不能替代 Scholoom 的文献服务契约。

临时库在本轮是唯一题录权威。插件 settings／缓存、Reader sidecar、托管 PDF、linked PDF 和项目文件按各自职责保存。没有两份可自由修改的当前题录，也没有实现 Scholoom 文献权威与 Zotero 兼容视图之间的映射。当前原生 SQL 成功不能补齐这一缺口。

## 路线建议与下一项证据

我建议先把 Gecko 辅助宿主作为下一轮验证候选：本轮已经得到真实引用键、导出及 Reader 路径，继续做 Node 服务模拟尚未带来业务成功。这是投入次序建议，不是替用户确定产品架构。

下一项最有价值的验证是：由独立 Node 客户端，通过明确 IPC 向辅助宿主发起一次真实文献修改与导出，确认读回同一文献权威；同时验证关闭宿主工作台后调用及重新接入 Reader。须先由用户决定文献权威采用哪种边界：由辅助宿主管理兼容库并向 Scholoom 提供领域服务，或由 Scholoom 原生权威提供 Zotero 对象／SQL 兼容视图。后一种不能借用本轮原生库成功记成已实现。

若选择继续该路线，再单独验证可独立分发的宿主裁剪及支持平台，并处理卸载错误。真实 CNKI／中文 translators、本地匹配、样式安装、citationKey 冲突与自动导出仍需对应验收；不将这些空白记为本轮成功。

## 复跑与验证

在项目根目录：

```sh
node .scratch/scholoom-foundations/prototypes/zotero-host-prototype/run.mjs --asset-root=/tmp/scholoom-host-prototype-assets-1bmhDr
```

该 asset-root 是本机临时资产位置；省略参数会从固定官方 URL 下载三份工件。环境要求见 README。成功运行的 10 项窄检查全部 passed，入口退出码 0；Node 首个缺失服务是预期诊断结果，不能据入口退出码推导 Node 功能兼容。JS 入口与 companion 已做 `node --check`；PDF fixture 经共享锁定环境生成并由实际 Reader 读取。未新增测试套件、安装项目依赖、启动开发服务器、提交代码或切换分支。
