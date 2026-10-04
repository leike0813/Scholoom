# Zotero 辅助宿主第三轮：无主窗口冷启动

关联票：[16](../issues/16-zotero-host-prototype.md)。运行日期：2026-10-04。前轮：[独立 IPC 与窗口重接](zotero-host-ipc-results.md)。复跑入口：[README](../prototypes/zotero-host-prototype/README.md)。本轮[原始证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/)包含失败记录。

**已初始化的临时库可以在无显示服务器、从未打开主窗口的本次进程中，完成原生题录读写、已有引用键保留和 BBT 两种导出。新库的 BBT 冷启动未通过；茉莉花也未实现无主窗口初始化，打开窗口后的 Reader 恢复仍失败。** 第二轮流程的回归检查全部通过。不能把本轮记为完整冷启动兼容。

基线保持 Linux x86_64、Zotero 10.0.5（BuildID `20260930214910`）、Gecko 140.15.0、BBT 9.0.68、茉莉花 1.1.39。版本与来源见各组 baseline.json；本轮没有重新选择或升级版本。

## 启动与样本边界

新入口使用 `-headless -chrome chrome://zotero/content/scholoom-cold-launch.xhtml`，启动前移除 DISPLAY、WAYLAND_DISPLAY，并设置 MOZ_HEADLESS。没有启动 Xvfb。原生 Zotero 内核初始化后，由独立 companion 提供 loopback RPC，另一个 Node 进程发起请求。观察阶段只有 `scholoom:prototype-helper` chrome 窗口，主窗口数为 0，真实 `uiReadyPromise` 未完成。

这仍是完整 Zotero／Gecko 及其 DOM、数据库、插件加载器和 worker，不是纯命令行内核或已裁剪的分发物。Gecko 的 headless 模式允许 chrome 文档存在；后续对照还会实际创建原主窗口和 Reader，虽然没有物理屏幕显示。

为了先于原插件启动等待提供实验入口，临时安装树的 app/omni.ja 增加两个成员：启动 XHTML 与外部 JS。启动页载入原生 zotero.mjs，再调用 companion；没有伪造 uiReady、设置 Zotero.test 或替换插件钩子。启动入口核对使用[精确版本的官方命令行处理源码](https://raw.githubusercontent.com/zotero/zotero/10.0.5/app/assets/commandLineHandler.js)。

原下载宿主归档与两份发布 XPI 保持不变。对每组运行，已逐字节比较实际加载 XPI；并核对 omni.ja 的全部 **7492 个原成员**，没有删除或改写，冷启动组只增加上述两项。详见 [review-observations.json](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/review-observations.json)。因此应描述为“扩展了临时宿主入口、原插件不变”，不能声称冷启动使用完全未扩展的宿主安装树。

两类库分别验证：

- **新库**：新 profile、新 data，由原生 API 创建一个题录和托管 PDF，执行真实的首次 Schema 初始化。
- **已初始化库**：复制第二轮已正常停止的实验 data，保留前轮 translator、题录、插件状态和附件；使用新 profile、新进程和新的隔离安装树，不复制内存状态。已有题录通过原生 libraryID + key 定位。

每个运行目录中的原生 Zotero 库是该实验唯一可写题录权威。停机副本只是对照样本，不决定 Scholoom 的正式存储方案。副本内原外部链接仍指向前轮临时路径；本轮不验证文件迁移或独立打包。

关闭应用、插件、translator 自动更新和同步；原生 bundled translator 安装路径仍执行，没有手工预装来绕过新库初始化。BBT ready 最多观察 60 秒，之后额外观察茉莉花对象最多 5 秒。两者全局对象和 AddonManager active 状态都单独记录，不当作完整功能就绪。

## 实跑结果

| 组别与临时目录尾缀 | 独立客户端通过／失败 | 实际边界 |
| --- | --- | --- |
| 新库 headless：b8L6ca | 4／1 | 无主窗原生读写通过；BBT ready 60 秒内未完成，KeyManager 未启动；打开真实主窗后再等 20 秒仍超时，后续导出／Reader 未执行 |
| 已初始化库 headless：KgwDOw | 10／1 | 无主窗原生读写、已有引用键和两种导出通过；开窗后再启用茉莉花，全局对象恢复，Reader 控件仍失败 |
| 已初始化库 Xvfb 对照：o7zMwv | 9／1 | 无主窗 BBT 仍通过；茉莉花启动和 Reader 失败也出现在有显示服务器的环境 |
| 第二轮 IPC 回归：HL6I1b | 8／0 | 9 项前置检查、8 项客户端检查及停机核对均通过，含真实关窗和 Reader 重接 |

前三组各有 2 项宿主窄检查通过：发布包 active／路径记录与无主窗原生库观察。冷启动组宿主退出码均为 0，客户端因功能检查失败退出 1，整体入口正确返回失败。退出码 0 不代表插件无错误。

Xvfb 组是较早的控制实验，未执行后来增加的茉莉花原生 disable／enable 对照，也未使用最终的全部等待逻辑和 translator 更新设置；它只支持“无主窗启动错误也能出现在 Xvfb”这一观察，不是最终实现的严格单变量 Reader 比较。两组最终 headless 和 IPC 回归均运行最终探针代码。

### 已初始化库在首次开窗之前

[客户端请求与检查](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/ipc-client-results.json)记录了 5 项通过：无主窗口读取、标题写入、调用原包 KeyManager.fill 后核对已有引用键、BetterBibTeX 和 BetterBibLaTeX 导出。每次导出响应中的主窗口数均为 0。

题录标题更新为 `Literature updated after cold start`，原生 Item 与 SQL 一致，已有键 `chenResearchAgentsReproducible2026` 保留，两份实际输出包含当前标题和该键：[BibTeX](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/cold-BetterBibTeX.bib)、[BibLaTeX](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/cold-BetterBibLaTeX.bib)。本轮没有清除已有键或创建新的无键题录来验证冷启动后的首次生成；首轮的生成证据不能扩展成这项结论。

冷观察总计 6.942 秒，包含额外最多 5 秒的茉莉花观察，不能把它直接当作 BBT 初始化耗时。观察结束时 BBT ready 已完成、KeyManager 已启动，uiReady 仍未完成。BBT 的 ready 在 startup done 阶段较早完成，后续日志还出现 hiddenDOMWindow 错误；两次实际导出才是所验证核心功能的证据。

### 新库为何不能照搬这一结论

[新库记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/fresh-headless/gecko-results.json)的总观察为 65.016 秒：BBT ready 未完成、KeyManager 未启动，两个插件对象的状态也未达到功能就绪。客户端仍能独立修改原生题录，说明原生库读写与插件可用是不同的条件。

精确发布包的[启动源码摘录](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/startup-source-excerpts.txt)说明了无主窗口时的等待链：BBT foundation 在 translators 需要安装时调用 Zotero.Translators.init；后者等待 Schema.schemaUpdatePromise；新库 Schema 的 bundled 文件安装排在真实 uiReadyPromise 之后。BBT 直接等待 uiReady 的代码虽被注释掉，首次 translator 安装仍有间接依赖。已初始化样本含上一轮安装的 BBT translators，不能代表首次运行条件。

这是运行观察与源码结合后的原因判断，没有手工完成 Promise 或跳过 Schema 来制造成功。打开真实主窗口、等待 item tree 后，客户端额外等待 BBT ready 20 秒仍失败；尚未单独隔离这个开窗后阶段的剩余等待。有限超时不证明所有首次启动方案不可行，也不能只靠增加超时时间宣布支持。

## 茉莉花与 Reader 的失败

在已初始化库中，原生插件加载器确实调用茉莉花 startup，但日志显示 toolkit 构造时读取不存在的主窗口 document，随后访问 undefined 的 querySelector，bootstrap 失败。错误发生在无主窗口条件下构造全局对象的阶段，比 onStartup 中等待 uiReady 更早。新库中 BBT 启动尚未完成，不能仅凭茉莉花对象缺失认定同样的构造失败已发生。

首次开真实主窗口后，探针通过原 AddonManager disable／enable 重新启用原包，恢复了 Zotero.Jasminum。`jasminum-after-real-main-window` 检查只证明全局对象出现，snapshot 中沿用的 jasminumReady 字段也仅指对象存在，**均不保证 hook 或 Reader 集成完成**。

随后实际打开 Reader，等待原初始化、点击侧栏，并关闭／重开一次作有界对照；原书签按钮仍不存在，因此 [reader-after-first-window 检查失败](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/ipc-host-events.json)。记录显示 Reader initialized、sidebarToggle 存在、Jasminum 对象存在，但 sidebarContainer、outline 控件不存在。它没有达到与第二轮相同的侧栏 DOM 状态；尚不能把失败全部归因于茉莉花注入代码，也没有证明 Electron 阅读器接入。

原生重新启用过程中仍出现 Cu.unload 错误，关窗仍出现缺失 onMainWindowUnload hook，退出还有 dead object 等错误。Xvfb 控制组也观察到无主窗构造失败和 Reader 控件缺失，因此不能把整条失败路径只归因于没有 DISPLAY。相关原行号与上下文见[已初始化库日志](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/gecko-log-excerpt.txt)和 [Xvfb 日志](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-xvfb-control/gecko-log-excerpt.txt)。

## 落盘、回归与复跑

宿主停止后，用 Node 24 内置 SQLite 的只读连接核对实际标题和引用键，所有组的 integrity_check 均为 ok。新库只保存标题，citationKey 尚不存在；探针对缺失字段按空值核对，未把缺失键记成生成成功。已初始化库的[落盘记录](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/initialized-headless/ipc-persisted-state.json)同时保存了更新标题与原引用键。完整性和字段一致性仍不保证干净退出或所有插件状态保存完整。

增加 cold-launch.xhtml／js、cold.js 和 cold-client.mjs；run.mjs 增加独立入口、headless／Xvfb 选择与停机库副本；bootstrap.js 区分无 UI 的入口；ipc.js 增加原生开窗、再启用和 Reader 对照，以及限定条目的数据加载。两种 Node 客户端共用 rpc-client.mjs，避免协议、超时和结果记录重复。

最终代码重新运行第二轮流程：[回归结果](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/ipc-regression/ipc-client-results.json)全部通过，Reader 仍能在原先经过正常 UI 初始化的流程中重接。这排除了共享 RPC 改动普遍破坏已有 Reader 验证的解释，没有排除冷启动独有的初始化／DOM 问题。

所有探针 JS／MJS 做语法检查，证据 JSON 和本地文档链接核对；没有新增形式测试、安装依赖或创建虚拟环境。临时库、完整安装树和完整日志留在各自 /tmp 目录；仓库只保存有界证据，不含临时 IPC token。

## 对宿主选择的影响

Gecko 辅助宿主继续是有实证支持的候选：已初始化库的 BBT 核心可以在本次进程从未打开主窗口的情况下被外部 Node 调用。证据也明确限制了这一结论：首次初始化、插件 UI 依赖和 Reader 生命周期需要评估宿主适配。本轮没有验证通过内部窗口提供 UI 依赖的方案，不能据此认定这种方案无效。

用户要求后续实验回到 Scholoom 目标。下一轮按[目标验证方案](zotero-host-goal-validation-plan.md)，优先验证能力接口、同一文献权威与工作台侧消费，比较候选宿主边界。首次初始化和 Reader 错误保留为已知依赖与成本，只在阻断该链路或影响路线选择时继续调查。

正式文献权威及 Scholoom 身份／Schema 映射仍待用户决定；本轮不落实其中任一方案。独立分发与裁剪、跨平台、Electron 工作台／阅读器接入、真实中文识别和干净退出仍未验证。#16 保持 claimed，未写正式 Answer。
