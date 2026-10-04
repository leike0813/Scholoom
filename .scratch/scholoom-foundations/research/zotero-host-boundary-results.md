# Scholoom 第四轮：能力接口、单一文献权威与工作台侧消费

关联票：[16](../issues/16-zotero-host-prototype.md)。2026-10-04 实跑；依据[后续验证范围](zotero-host-goal-validation-plan.md)。入口：[README](../prototypes/zotero-host-prototype/README.md)，[原始证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/)。

**本轮跑通了 Scholoom 原型接口调用原插件、两端读写同一文献、以及第二个客户端消费真实产物的链路。** 能力侧改标题，BBT 原包重生成并保存引用键；工作台侧通过同一接口读到这些结果，再改标题，能力侧读回修改。稳定来源身份与附件关系在过程中保持不变。茉莉花真实生成的大纲、书签可以转换为工作台可消费的数据。

9 项主链路与 5 项第二客户端检查通过，宿主及两个客户端退出码均为 0，停机后的原生 SQLite 字段与完整性核对通过。另跑第二轮回归，9 项前置与 8 项客户端检查通过。前置样本检查用于准备已知可工作的原包环境，不增加宿主选择结论。

这给“兼容宿主维护文献库，Scholoom 经自己的接口使用”的候选补了实际证据。尚未选择正式架构；本轮也没有实现原生数据库兼容视图或 Electron 阅读器。

## 这轮围绕哪个产品情境

Agent 在人类工作台接入前整理一篇文献并导出引用；人随后接入同一科研系统，看到当前题录和阅读结果并修改题录；Agent 继续时读到人的修改。

实际调用链为：**能力调用脚本 → 文献接口与身份适配 → Gecko RPC → 原包 BBT／茉莉花状态及同一原生库 → 独立工作台侧客户端。**

能力调用方是确定性 Node 脚本，没有 LLM、LangGraph 或正式 harness。工作台侧是另一个 Node 进程及其生成的静态 HTML，验证数据消费和呈现；不记为 Electron renderer、交互式 PDF 阅读器或完整工作台接入成功。

本轮先让参考宿主按已通过的流程初始化内部窗口与 Reader，使用 Xvfb；之后能力侧和工作台侧经接口工作。没有新增无主窗口启动或卸载调查，也没有假定产品必须禁止兼容环境内部窗口。独立分发、用户可见启动流程和内部 UI 的产品代价仍需专门验证。

## 接口和事实归属

新增 [literature-interface.mjs](../prototypes/zotero-host-prototype/literature-interface.mjs)，两种调用方使用同一实现。它将不含宿主对象的请求映射为有限 RPC，再将原生结果转为小型 DTO。

| 操作 | 调用方所知的输入／输出 |
| --- | --- |
| read | sourceId；返回 id、libraryId、title、citationKey 和材料身份 |
| updateMetadata | sourceId 与 title 补丁；返回重新读取的题录，本原型仅支持标题修改 |
| regenerateCitationKey | sourceId；经原 BBT 的 KeyManager.fill replace 入口，返回当前题录 |
| exportCitation | sourceId 与 bibtex／biblatex；返回 sourceId、格式与原包实际导出文字 |
| readNavigation | materialId；返回 sourceId、文件信息、可用状态、托管模式及含页码／坐标的大纲和书签 |

Zotero libraryID／key、Item、SQL、窗口与侧车路径由适配和宿主实现处理。调用方的 sourceId、materialId、libraryId 使用独立 UUID，保存于 [identity-bindings.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/identity-bindings.json)。文件只含身份映射，没有标题或当前引用键；两种客户端从同一映射恢复身份，再通过 RPC 读当前事实。

实验只有一个可写题录来源：本次隔离 Zotero 库。客户端结果、导出及 HTML 是观察记录或产物，不会自动写回题录。正式身份注册、跨宿主重启、迁移和备份后的身份保持未验证；这个 UUID 映射也未决定数据库产品或正式 Schema。

本轮选用茉莉花元数据样本的真实父题录及其 PDF，让标题、引用键和阅读状态指向同一来源，避免用两篇互不关联的样本拼接“同一文献”成功。该题录仍来自明确标注的 CNKI HTTP／translator 返回离线回放，本轮没有线上识别证据。

## 实际观察

运行目录 `/tmp/scholoom-host-prototype-JH1nkj`；能力侧 PID `3610029`，工作台侧 PID `3612814`。原始请求见[能力侧记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/agent-client-results.json)、[工作台侧记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/workbench-client-results.json)和[宿主执行记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/ipc-host-events.json)。

| 步骤 | 观察到的行为 |
| --- | --- |
| 初始读取 | 中文题录标题完整，原引用键为 ZhangZhongWenWenXianYuanShuJuHuiFangTanZhen2026 |
| 能力侧改标题 | 同一来源更新为 Scholoom boundary literature workflow；普通修改保留原引用键 |
| 原包更新引用键 | BBT 生成 ZhangScholoomBoundaryLiterature2026，原生字段和 SQL 同时读到新值；sourceId 和 Zotero key 不变 |
| 能力侧导出 | 原包两种导出均包含新标题、新键及完整中文期刊字段 |
| 第二进程接入 | 从共同身份映射恢复同一 sourceId，经实际 RPC 读到新标题／新键，不读取能力侧结果文件来代替题录读取 |
| 阅读结果消费 | 同一 PDF 可用且属于该来源；读到 Introduction／Methods 两项大纲与一条原书签，保留页码和坐标 |
| 工作台侧改标题 | 经共同接口保存 Research workflow revised in workbench，来源、材料身份及新引用键保持不变 |
| 能力侧续读 | 再次 RPC 读取到工作台的标题修改；工作台两份导出也包含最终标题／键 |
| 停机核对 | 只读 SQLite 查询最终标题／键与客户端一致，integrity_check 为 ok |

主链路逐项结果在 [ipc-client-results.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/ipc-client-results.json)。能力侧接入前后同一文献的身份没有随标题或 citekey 改变，这正是此次映射实验所检验的语义。

BBT 写入来自 `KeyManager.fill([itemID], {replace: true})`，companion 没有直接设置 citationKey。精确 XPI 的[写入源码摘录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/bbt-writer-source-excerpts.txt)显示 update 调用 setField，fill 随后等待 saveTx；宿主记录保留调用前后 Item／SQL 值和单条操作范围。需要覆盖其他插件写入、冲突或批量行为时另行验证，不能由这一调用扩展。

大纲和书签来自本次原茉莉花的真实 PDF／Reader 操作及其保存的[大纲侧车](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/jasminum-outline.json)、[书签侧车](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/jasminum-bookmarks.json)。工作台侧只转换并读取结果，没有自行造节点或书签。本轮支持“这些数据能重新呈现”，没有验证从自己的 PDF 组件生成大纲、修改书签并写回原包，或点击导航后的实际页面定位。

第二客户端生成了[文献视图](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/workbench-view.html)。Playwright 在空白页面加载同一 HTML，观察到当前标题、引用键、中文文件名及大纲／书签页码，见[浏览器呈现记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/browser-render.json)。该检查覆盖静态 DOM 呈现，不扩大为交互功能验收。

## 接入中暴露并修正的问题

第一次完整链路使用中文来源时，旧 RPC 的 response.write 直接接收 Unicode 字符串，客户端标题乱码，含中文作者的导出无法解析为 JSON。宿主已经产生了正确原包导出，失败发生在实验传输层。见[修正前观察](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/pre-fix-unicode-observation.json)。

现在先以 TextEncoder 编码为 UTF-8 字节，再按 HttpServer 的 8 位字符串写出，成功和错误响应采用相同处理。最终运行核对中文初始标题、导出期刊字段，以及能力侧全部 7 次、工作台侧全部 5 次成功响应与宿主记录完全一致。实际传输问题影响我们的契约，因此本轮修正；它没有变成额外的原插件修复工程。

同时让不同消费者独立保存 RPC 记录，并将退出控制交给主编排脚本；第二客户端结束不关闭共享宿主。共享改动的[第二轮回归](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/ipc-regression/ipc-client-results.json)8 项客户端检查通过。

## 候选边界及代价

| 候选 | 当前证据 | 仍需承担的适配／未验证项 |
| --- | --- | --- |
| Gecko 兼容库经 Scholoom 接口使用 | 本轮稳定身份、双方写入、读回及产物消费实际通过 | 保留原生 Item／SQL／translator 服务、管理身份映射与宿主生命周期；Reader 能力生成依然使用原环境；正式工作台和独立分发未实现 |
| Scholoom 原生库提供兼容视图 | 本轮未实现；原包仍直接使用原生 Zotero 库 | 实际 KeyManager 写入及原包依赖的 SQL／对象关系需要映射到同一原生权威，不能由普通 RPC 封装成功推导 |
| Electron／Node 内运行原包 | 本轮没有新增兼容层证据，沿用首轮到达阶段 | 需要提供原包依赖的 Gecko 服务与对象语义；外部 Node 调用 Gecko 不等于原包已在 Node 内运行 |

已证明可以在调用方接口中隔离原宿主标识和对象；底层仍保留完整 Zotero 服务与原生 Schema。因此，这一实验降低了“调用方必须使用 Zotero 对象才能工作”的不确定性，没有降低所有底层宿主或存储适配成本。

两份实际加载 XPI 与发布包逐字节一致；app/omni.ja 与官方归档原件逐字节一致，未使用第三轮新增启动成员，见 [review-observations.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/review-observations.json)。仍有原插件窗口卸载和退出错误，见[日志摘录](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/boundary/gecko-log-excerpt.txt)；功能及 SQLite 核对通过不证明干净生命周期。

## 交付与验证范围

新增 literature-interface.mjs、boundary-client.mjs、workbench-client.mjs；run.mjs 增加 boundary 轮次和复用的停机核对，bootstrap.js 复用样本后开启 IPC；ipc.js 增加单条引用键重生成与指定附件状态读取，修正 UTF-8；rpc-client.mjs 支持独立记录和由编排方关闭宿主。没有新增通用 SQL、脚本执行或全库状态 API。

最终执行 boundary 入口、第二轮 IPC 回归、全部 JS／MJS 语法检查、证据 JSON／本地链接检查及静态浏览器呈现。未新增测试套件、安装依赖、启动开发服务器、改动日常文献库或提交代码。完整运行目录与日志保留；仓库保存有界证据，不含临时 IPC token。

下一项能影响选择的证据是：采用自己的工作台／阅读组件时，哪些插件功能可以通过这类契约呈现与操作，哪些必须保留原 Reader；并按用户选择继续比较兼容库与原生存储适配成本。正式架构仍由用户决定，#16 保持 claimed，未写 Answer。
