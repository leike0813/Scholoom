# Scholoom 宿主原型第五轮：自己的 PDF 阅读视图与书签写回

关联 [#16](../issues/16-zotero-host-prototype.md)，执行日期 2026-10-04。用户要求“继续下一轮实验”；本轮沿用[目标验证范围](zotero-host-goal-validation-plan.md)，回答：**自己的阅读界面能否消费原插件的大纲／书签，操作后让能力侧和原插件读到同一结果？**

结果：独立浏览器视图实际渲染同一附件，点击大纲切到第二页，点击书签回到第一页；界面将书签改名后，整页刷新、能力侧重读及原 Reader 重开均读到新名称。书签身份和位置不变，PDF 字节不变。5 项浏览器交互及 3 项主链路检查通过。

这支持“Scholoom 自己呈现阅读界面、通过共同接口操作插件状态”的候选。但本次书签保存仍要打开内部原 Reader 并触发其编辑事件。**呈现可以分开，原插件的这条写入路径仍依赖原 Reader DOM。** 该依赖是本轮发现的维护成本，不能据此认定已有独立书签能力 API。

## 用户可见的交互

| 操作 | 实际观察 | 证据 |
| --- | --- | --- |
| 打开材料 | 通过共同文献接口取得已注册附件的真实 PDF 字节；PDF.js 解析为两页，canvas 渲染第一页 Introduction | [浏览器结果](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/reader-browser-results.json) |
| 点击 Methods 大纲 | 渲染真实第二页，PDF 文本内容随页面变为 Methods；检查 PDF 坐标与视口坐标转换 | [第二页截图](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/reader-methods-page.png) |
| 点击已有书签 | 返回真实第一页，使用原书签的页码及位置 | 同上浏览器结果 |
| 输入并保存“方法核对书签” | 领域接口转交 companion；原茉莉花编辑事件实际保存 sidecar，随后从文件重新读取 DTO | [实际 RPC](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/reader-browser-rpc-results.json) |
| 刷新整个阅读页面 | 重新取得 PDF 和导航状态，显示新书签名称 | [保存后刷新截图](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/reader-view.png) |
| 能力侧重读，原 Reader 关闭再打开 | 两端均读到新名称，sourceId／materialId、书签 id 和位置保持一致 | [主链路结果](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/ipc-client-results.json) |

实际材料是前轮相同生成方式的 [1429 字节合成 PDF](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/material.pdf)，两页分别为 Introduction 和 Methods。原插件在真实 Reader 中生成大纲及初始书签；初始名称 `P_1_1`，改名后为 `方法核对书签`。本轮只改名称，书签仍在第一页 `(x=0, y=792)`。坐标检查只覆盖这份未旋转样本的页首，不代表任意 PDF 的旋转、裁切或复杂定位均已验证。

## 接口与状态如何流动

复用第四轮 literature-interface.mjs，增加两个有界操作：`readMaterial(materialId)` 返回材料字节，`renameBookmark(materialId, bookmarkId, title)` 写入后返回重新读取的导航 DTO。视图只持有 sourceId／materialId、书签 id、页码和 PDF 坐标；Zotero Item、窗口、原生 SQL 与 sidecar 路径保留在适配侧。

浏览器通过实验驱动中的四个明确操作接入共同接口，和能力侧使用同一身份映射。映射文件只保存内部 UUID 到兼容标识的关系，不保存题录副本。题录权威仍为唯一临时原生库；书签状态由原茉莉花写入该附件的专属 sidecar，视图没有另建可写书签库。

本轮没有在 companion 中直接修改 JSON 冒充插件处理。实际写入顺序是：打开指定附件的原 Reader → 找到指定书签 → 触发原标题双击事件 → 填入原输入框并触发 Enter → 有界等待 sidecar 中出现新名称 → 重新读取。写入前后逐字节比较 PDF，结果相同；同时核对书签 id、位置、颜色等字段保存前后一致。

原 XPI 的 `chrome/content/scripts/jasminum.js` 第 8025 行起是私有编辑函数；第 7107 行起的私有保存函数在未传参数时从当前 Reader DOM 收集书签，从活动 tab 取得附件，调用 `Zotero.File.putContentsAsync` 保存。本次没有找到公开导出的书签改名入口，使用的是原 UI 事件路径，见[源码位置记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/jasminum-source-observations.json)。

因此，适配必须维护原 DOM 选择器、活动 tab 和编辑事件语义；即使人类使用自己的阅读界面，兼容环境内部仍需要初始化原 Reader。这是指定版本原包的实际接入条件。能否接受该成本，或让 Scholoom 自己承担书签状态并明确互操作职责，需要在路线选择时讨论。

## 渲染器与浏览器环境

独立页面只加载 PDF.js 的 `pdf.mjs` 和 `pdf.worker.mjs`，没有嵌入 Zotero Reader 页面。两份模块从已下载的 Zotero 10.0.5 官方归档中提取，运行时报告 PDF.js `5.7.0`；模块字节与归档成员相同。本轮复用该版本来观察接口，未选择正式阅读组件，也未调查它是否为上游最新版。实际使用 `getDocument`、`getPage`、`getViewport`、`render` 及坐标转换，API 语义见 [PDF.js 文档](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)及 [PDFPageProxy 文档](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)。

使用已安装的 Playwright `1.64.0-alpha-1790635538000` 与本机缓存的 Chromium `153.0.8010.12`（目录 chromium-1243），见[浏览器基线](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/browser-baseline.json)。Playwright route 在本地满足虚拟地址 `http://scholoom-reader.invalid` 的页面、模块与 API 请求；没有启动开发服务器或安装依赖。API 请求经 Node 共同接口到实际 loopback RPC，不模拟插件写入结果。能力侧是确定性实验调用脚本，没有接入正式 Agent harness。

首次试跑因工具默认期待不存在的 chromium_headless_shell-1247 而失败；指定已有缓存后通过。保留[失败记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/browser-launch-failure.json)，不将环境失败算成插件功能失败。随后最终入口在 `/tmp/scholoom-host-prototype-ASCiyY` 完成；早期通过运行 `/tmp/scholoom-host-prototype-vUv4xA` 保留，仓库证据以最终运行为准。

参考宿主仍为完整 Zotero 10.0.5、Gecko 140.15.0、BBT 9.0.68、茉莉花 1.1.39，使用隔离 profile、临时库和 Xvfb。两份原 XPI 与安装副本逐字节相同，app/omni.ja 与原归档成员相同；阅读视图实际收到的字节与库附件和生成 PDF 相同，见[工件核对](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/artifact-observations.json)。PDF.js 仅提取到临时运行目录，仓库未加入该第三方构建产物。

## 验证结果和交付

| 验证 | 结果 |
| --- | --- |
| 独立浏览器：真实 PDF、两次导航、改名、刷新 | 5／5 通过 |
| 主链路：浏览器结果、能力侧重读、原 Reader 重开 | 3／3 通过；第一项汇总上述 5 项，不作为另一组独立功能计数 |
| 原宿主样本准备 | 9／9 通过；中文元数据仍是固定 CNKI／translator 返回回放 |
| 最终宿主与客户端退出 | 均为 0，未中断 |
| 停机只读 SQLite 核对 | 题录标题／引用键与读回一致，integrity_check 为 ok；书签另外核对原 sidecar |
| 第四轮共享接口回归 | 9 项主链路＋5 项第二客户端通过，停机字段与完整性核对通过 |

回归运行目录 `/tmp/scholoom-host-prototype-1md8NZ`，证据在 [boundary-regression](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/boundary-regression/)。它验证了共享 IPC 和接口扩展后，原 BBT 引用键生成、两端题录修改和导出仍能运行；未重跑第三轮冷启动排障。

新增 reader-view.html／mjs、reader-browser.mjs、reader-client.mjs；扩展 run.mjs 的 reader 入口与已有工具路径选项、literature-interface.mjs 的材料与书签操作，以及 companion 的单附件读取／改名／重开核对。完整 JS／MJS 做语法检查，精简证据做 JSON 解析和本地链接检查；没有新增测试套件、安装依赖、改动日常库或提交代码。运行方法见 [README](../prototypes/zotero-host-prototype/README.md)。

退出日志仍记录原茉莉花缺失 onMainWindowUnload、Reader dead object、数据库关闭阶段错误，见[日志节选](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/reader/gecko-log-excerpt.txt)。本轮交互、保存及停机核对通过，不代表干净生命周期；未为此扩展修复范围。

## 本轮能支持什么选择

已有证据支持将材料字节和导航状态作为 Scholoom 自己界面的输入；书签改名也能通过明确适配回到原包的真实存储。与此同时，原插件书签写入是 UI 绑定能力，不能按 BBT 的可调用入口成本估算。自己的界面并未消除内部原 Reader 依赖。

本轮没有验证正式 Electron 工作台、独立分发、跨平台、任意 PDF 的字体及定位、阅读性能、批注、书签新增／删除／排序，或无主窗口书签写入；也没有实现 Scholoom 原生存储兼容视图。正式路线与文献权威仍未选择，#16 保持 claimed，未写 Answer。后续应围绕这项已知 UI 写入依赖是否可接受，以及其他候选边界的适配成本补证据。
