# WorkerDOM／Remote DOM 报告承载可行性

2026-10-30，只读静态研究。开始时主线 HEAD 为 `cc6939d49a9e23918d7b3617a97be06b097fd04d`；主线仍在并行验收，本文不证明其后续状态。已读报告 change 的 spec、design 第21轮及交回的 R2d `RESULT.md`／`source-facts.md`。R2d 的 Electron／rrweb 结论沿原材料，本轮未下载或运行 rrweb，更没有新运行反例。

**两者都不能作为现成的通用报告提供者接入。** WorkerDOM 已有可复用的 DOM mutation／事件基础，距离假说较近，但 Node 实时入口、MathML HTML 解析和输入事务均有实质缺口；Remote DOM 的现行协议及直接 DOM receiver 本身就丢 namespace，交互主要依靠显式定义的远端组件。不得据此缩小为固定科研页面，或批准生产架构。

## 固定来源与研究边界

| 候选 | 官方归属、固定 revision／源码版本 | 维护判断 |
| --- | --- | --- |
| WorkerDOM | `ampproject/worker-dom`，AMP HTML Authors；[`52b619eb46416c4325306de851e5a9df99697fcb`](https://github.com/ampproject/worker-dom/commit/52b619eb46416c4325306de851e5a9df99697fcb)，package `0.36.0`，Apache-2.0。[W0] | 官方 README 自称 in-progress、面向 Web Worker；该 main commit 日期为 2025-06-30。仓库未归档不等于 API 完整或近期功能维护。[W0][Wdoc] |
| Remote DOM | 确为 **Shopify/remote-dom**，非另找的同名个人库；[`064847cd32e4f1ff712661e4acd2cbb92904c2b5`](https://github.com/Shopify/remote-dom/commit/064847cd32e4f1ff712661e4acd2cbb92904c2b5)，core `1.12.0`、polyfill `1.6.0`，MIT。[R0][R00] | main commit 日期为 2026-10-20，仓库未归档；但直接 HTML 对应的 `DOMRemoteReceiver` 已被官方标记不推荐新代码使用。[Rdoc] |

revision 由 GitHub 官方 repo 元数据的默认分支解析后固定；版本为该 commit 的 package.json，**未声称已审发行包与此源码完全相同**。owner、archived、commit 日期的原始 API 回执保存在下述缓存的 `*-repo.json`／`*-commit.json`，没有据作者名字推断个人维护承诺。

本机仅查根 `node_modules` 的候选 package.json 和 `.pnpm` 目录项，均无命中，记录见 `installed-metadata-check.json`；未加载或执行候选、未临时安装。联网只取两个官方仓库元数据、路径树以及影响判断的 README／API／源码，下载内容仅作为文本读取。缓存根：`/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/worker-dom-research/`；`sources/` 保留固定 SHA 原文，`receipts-*.json` 保留 URL／HTTP 状态／字节数。以下 `[W…]`／`[R…]` 均解析到固定 commit 的具体文件行。

## 逐项 API 卡口

| 要求 | WorkerDOM：实际 API 与判断 | Remote DOM：实际 API 与判断 |
| --- | --- | --- |
| 元素、文本、属性、namespace 创建／变更 | `Document.createElementNS()` 保留 URI；Element creation tuple 传 namespace，宿主 `NodeContext.createNodes()` 调 `document.createElementNS()`。因此 **显式创建的 MathML／SVG 元素有端到端机制**，不同于 rrweb。[W1][W2] 但属性 mutation 虽传 namespace，宿主 AttributeProcessor 仍用普通 `setAttribute/removeAttribute`，命名空间属性不完整。[W3][W3h] | 源 polyfill 有 `createElementNS()`，但 `RemoteElementSerialization` 和 `serializeRemoteNode()` 只传 localName，没有 namespace；`DOMRemoteReceiver.attach()` 无条件 `document.createElement(node.element)`，属性也仅普通 set/removeAttribute。**SVG 与 MathML 均不能由此协议保持正确 namespace**；只看源端 createElementNS 会得出错误结论。[R1][R2][R2h][R5] |
| 初始 HTML、一般报告脚本载入 | `upgradeElement` 路线从已有 baseElement 序列化 hydrate；初始 skeleton 带 namespace，可保留已正确解析的 MathML。[W4][W1] `fetchAndInstall()` 分别取 runtime 和一个 authorScript，WorkerContext 拼装后只在 Worker 执行 authorScript；不是完整 HTML script/module 装载器。[W5][W6] **动态 `innerHTML` 用内置 parser，只识别 HTML／SVG namespace，MathML 上下文直接拒绝，HTML 中 `<math>` 不切换 namespace**。[W7] | `RemoteMutationObserver.observe()` 可发送初始子树；polyfill `innerHTML → parseHtml` 仅处理 HTML／SVG，MathML 同样缺失。[R3][R4] 没有从完整报告 HTML 自动按浏览器语义执行 scripts 的入口；它要求应用在 remote 环境自行运行代码、连接 root。polyfill 的 Document 创建普通标签时没有原生 HTMLInputElement／HTMLScriptElement 子类；HTML 解析不能等同浏览器文档加载。[R6][R6h] |
| form value／selection／focus | `HTMLInputElement.value/checked` 可向宿主写属性；宿主 input 默认监听和每次事件前发 `SYNC {index,value}`，源端更新值时禁回传。[W8][W8s][W9] 官方矩阵明确 `selectionStart/End/Direction`、`setSelectionRange`、`focus/blur` 不支持，源码 HTMLElement 没有这些方法。**现成值同步不覆盖选区／焦点契约**。[W10][W10h] | 普通 native 元素有属性／attribute 呈现能力，**并非所有标签都必须 custom element**。但源 polyfill 的 `input.value = …` 不能据此获得原生 form property 的完整拦截／同步；普通 addEventListener 也没有自动注册成 remoteEventListeners 的通路。官方交互路径是 `RemoteElement.remoteProperties/remoteEvents/remoteMethods`，例如显式声明 focus；不能把它称作一般 HTML 输入桥。[R6][R6h][R8][R9][R9m] |
| composition／beforeinput、源确认 | 任意订阅的事件名可以转发，不能说 composition 事件完全发不出去；但事件固定字段没有 `data/inputType/isComposing` 或 selection，SYNC 只有 value。源事件 dispatch 后没有输入 revision 对应的确认；宿主 PropertyProcessor 可直接写回 value，ChildListProcessor 可直接删活动输入节点。**没有保护未提交输入、延迟旧 mutation 并等待源确认的事务**。[W9][W11][W12] | 宿主默认事件 handler 仅把 `event.detail` 交远端，普通 InputEvent 的 value、selection、组合状态不会因此自动传递。官方例子要求自定义 change payload，并在源 dispatch 前手动更新 value；`RemoteEvent.response`／`respondWith` 只是可用回调返回值，不是通用输入确认和冲突处理。[R5][R9][R10] 需要手写原生控件适配或业务组件；后者违背本问题的一般 HTML 目标。 |
| 节点替换、旧回调／关闭 | child mutation 按 ID remove/insert；监听器有注册／移除，`ExportedWorker.terminate()` 只终止 Worker。两端 node map 持有节点，不能把 DOM remove 当整份会话失效／回调回收。无 viewId／generation／basis 判定，composition 时删节点也无保护。[W2][W12][W13][W13h] | 可按 ID 删除／重挂，默认 detach 后重建；`cache.maxAge` 可短期复用，**缓存不是选区／IME 事务**。更新 listener 会移除旧 listener，但移除子树的 detach 主要删 attached map、release properties；不能由此推导所有 event callback／已在途 RPC 均撤销。需要连接生命周期和迟到调用约束。[R7][R7d][R5] |
| 宿主原生文本、选择复制、AX | 宿主创建真实 Text／Element；普通文本与正确 namespace／ARIA 属性进入真实 DOM，具备交给浏览器原生选择、复制、AX 的基础，不需位图。[W2][W3h] **两宿主的实际复制、系统 IME、MathML 读屏效果未证**，尤其重建节点会影响选区／焦点。 | DOM receiver 确实创建 Text／HTML Element，普通文本有原生基础；MathML namespace 已丢，不能声称数学语义或 AX 保留。[R2h] React／Preact receiver 的组件映射不能自动弥补 namespace 与一般 HTML 事件协议。[R1][Rdoc] |
| canvas／layout 与脚本兼容边界 | Canvas 有 2d shim，不是完整 canvas；真实 OffscreenCanvas／ImageBitmap 通过浏览器 transferable 取回，不能沿 Node／JSON 私有管道直接转交。另有命令代理 fallback，也不能据此承诺完整绘图 API。同步布局 API 缺失，只有非标准 `getBoundingClientRectAsync()`，含 500ms 默认值路径；依赖同步测量的图表库不能默认运行。[W14][W15][W16] | polyfill 是最小 DOM，Document 未专门构造 canvas，Element／Window 没有布局引擎或 canvas context。框架可利用这些 DOM API 生成树，不等于可运行依赖 layout／canvas 的一般网页库。[R6][R6h][R11] 首批可明确报这类能力不支持，但不能用它回避 MathML／基本输入缺口。 |

上表的缺口是固定版本的静态反例／接口缺失，**没有执行候选、浏览器测试或新行为探针**。WorkerDOM 的 innerHTML setter 确实存在，卡口是它调用的 parser，不应误判成完全没有此 API。[W7][W7s]

## Node 与私有通道：需要新增什么

**WorkerDOM 不是“完全没有 Node 代码”；本轮未找到官方可直接取用的 Node 实时适配器。** 官方 `server-lib.createDocument()` 存在，构建明确 `server:true`；节点登记和 MutationTransfer 在 SERVER 模式提前返回。它能构造源 DOM，不能用来证明实时宿主同步。[W17][W17s][W13h][W20] 另一套 worker bundle 初始化直接引用 `self`、`postMessage.bind(self)`、全局 add/removeEventListener；宿主 WorkerContext 硬编码 `new Worker(Blob URL)`，配置 hooks 是观察／调度／过滤入口，没有 workerFactory／外部进程句柄注入。[W6][W18][W19]

若沿用它，无法避免以下新增工作；这里列成本，不定义 wire：

- **源进程装配**：在原 provider/T1 约束下登记 Node 程序及必要运行库；选择非 SERVER 的传输实现，适配 self、消息监听及 postMessage，保留 hydrate／事件顺序；不得用 server-lib 静默无传输的结果冒充成功。源脚本的载入、依赖顺序和动态 script/module 行为须明确，不能把报告 JS 送宿主执行。[W5][W6][W17][W18]
- **宿主接收装配**：拆开当前 WorkerContext 的启动和可信 mutation 应用，接外部进程字节通道；禁传真实 localStorage/sessionStorage。现有构造器会读取宿主 storage，baseElement 的根事件订阅还会注册到宿主全局事件目标，不能原样接到整个 Workbench window。[W6][W9] 这属于需要维护的适配／fork，非已发现的上游产品。
- **兼容修正**：MathML HTML 解析、属性 namespace、基本 form selection/focus 及组合事务／源确认。可以复用其已有树操作，仍需修改输入及生命周期协议；不应称作“仅几行 Node shim”。[W3][W7][W9][W10][W11]

**Remote DOM 的非 Worker 适配面较干净，但不足以改变结论。** `Window.setGlobal(new Window())`／`@remote-dom/core/polyfill` 是实际 API，直接使用 globalThis，不要求 browser Worker 构造器；core 暴露 `RemoteConnection.mutate(records)`／`call(id,method,…args)`。[R11][R12] 因此在 Node 安装其 DOM 环境有源码依据，**没有本轮 Node 实跑依据**。仍需自行载入报告、连接 root，以及跨进程函数回调的编码／撤销：serialization 含 functions，不能直接 JSON.stringify 后送现有私有端口。[R1][R8] 文档示例的 `@quilted/threads` 是另一项可选 RPC 依赖，不是 core 自动提供的 Node OS 进程适配；本轮没有为它另开候选调查。[Rdoc2]

Remote DOM 不要求为每个 div/span 手写映射；但若走它提供的完整交互路径，必须显式定义 remote 属性／事件／方法和宿主实现。要让普通 input、MathML、一般脚本工作，需补通用原生控件／namespace 支持，或维护组件映射。前者已经超出现成协议，后者不能满足本题，且直接 DOM receiver 已弃用。[R8][R9][Rdoc]

### 有界与反压不能由 batching 代替

WorkerDOM 用微任务拼 pendingMutations，宿主队列继续 concat，node/string 表累积；没有配额或“宿主已消费”信用机制。[W20][W21][W22][W13h] Remote DOM 的 mutate 返回 void，`BatchingRemoteConnection` 只把 records 累积后 flush，不提供大小／数量上限或消费确认。[R1][R13] **两者都不能原样满足有界跨进程传输**；GUI 还须限制单次应用量，不能只靠受限源进程的 CPU／内存限额。

树 mutation 是有序增量，不能像 R2c 的固定结果那样任意丢弃中间包只留最新；需要有界分帧、按序消费、过量明确失败，以及独立的输入确认／关闭代次管理。WorkerDOM 的 ArrayBuffer／字符串表须编码，Remote DOM 的 callback 必须有 RPC 生命周期；这些是适配成本，本文不发明完整 wire。[W20][R1][R8][R13]

本机当前 `platform.reportIsolation` 只有 check/stage/put/start/get/stop，返回状态／分片进度；**没有 DOM mutation 或用户输入操作**。controller 的 stdin 是 P/G/S 控制，stdout 解析生命周期事件，不是供候选任意复用的数据 socket。可以复用唯一准入、freeze、归属／停止权威，不能宣称已有 DOM 私有端口能直接接上。[P1][P2] 当前策略登记固定静态 ELF，Node 与其运行库、所需 syscall／FD、跨身份数据通道仍须原 provider/T1 的明确实施和验证，不能以 package 的 Node engines 字段替代。[P3]

## 权限、依赖与推荐

可信 DOM 呈现仍须拒绝源脚本变成宿主 script／事件属性，拒绝 URL、CSS、表单或导航产生未批准请求。WorkerDOM 默认直接创建元素和写属性，sanitizer 只是可选接缝；Remote DOM 的防护也仍允许普通 URL scheme，且默认不限制元素名。**OS 端禁止网络不约束可信宿主因渲染产生的网络访问**，不能原样照搬示例，不能让宿主执行报告 JS。[W2][W3h][W11][W19][R5][Rdoc3]

| 项目 | 不可避免的新增项／决定 |
| --- | --- |
| 新依赖 | WorkerDOM：引入固定版 `@ampproject/worker-dom` 或维护 fork／构建产物，Apache-2.0 许可处理。Remote DOM：core＋polyfill，core 还声明 htm；RPC 示例另用 threads，非必须照选。版本／依赖只核官方清单，未安装、未审最终发行包。[W0][R0][R00][Rdoc2] |
| 新代码 | 两者均需可信 HTML/script 载入分工、批准资源绑定、宿主安全呈现、有界跨进程桥、撤权／关闭、输入确认。WorkerDOM 可复用较多底层树协议；Remote DOM 还需 namespace 协议扩展和一般原生控件适配，不能用业务 custom element 冒充通用 HTML。依据见上表与 Node 分析。 |
| 权限 | 研究本身不需新增账户／服务／策略。本方案若实施，仍需原独立身份／OS 进程隔离及 T1；Node 运行时／运行库与受控通道的可用性尚未获证，不提出扩网络／文件权限的替代方案。[P1][P2][P3] |

**推荐交回：不直接采用任一候选，不为未改上游做“能否满足全部要求”的运行探针。** 静态卡口已足够否定直接接入，继续运行普通文本绿例不会改变判断。Remote DOM 不建议进入本需求探针；它适合受控组件体系，当前 namespace／输入协议和 receiver 维护方向与本题不合。[R1][R5][Rdoc]

WorkerDOM 仅保留为**接受维护 fork 后的有条件研发候选**，不是待确认即能用的成熟适配。若主线明确接受上述成本，最先值得做的决定性探针是：一个受限 Node 源实例，经可信 DOM 端呈现，源普通报告脚本动态替换包含 MathML 和文本输入的不同结构；组合输入与旧 mutation 竞争时，源确认和最终控件值／选区／焦点对应，关闭后旧回调失效。应直接覆盖这条边界，不再测固定 table，也不重跑已由源码确认失败的原版 innerHTML。两宿主正式 tab、原生复制、AX、真实系统 IME 及 OS 身份／网络／文件约束随后仍须各自真实验收；本轮没有运行或批准该探针。

未证：候选在本项目 Node／Browser／Electron 的任何运行结果、发行包差异、全部报告依赖兼容性、真实输入法与读屏、跨平台／分发／预算／T1。没有改 spec/design、生产源码、账户或策略，没有构建、测试、启动浏览器／服务／模型，未扩大到第三候选。到此停止。

## 一手来源索引

每个链接均含完整 commit 和源码行；文档示例只证明上游描述，不作实跑证据。

[W0]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/package.json#L1-L22
[Wdoc]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/README.md#L1-L11
[W1]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/Document.ts#L93-L125
[W2]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/nodes.ts#L45-L81
[W3]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/Element.ts#L347-L379
[W3h]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/commands/attribute.ts#L18-L46
[W4]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/serialize.ts#L21-L44
[W5]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/install.ts#L21-L77
[W6]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/worker.ts#L25-L106
[W7]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/third_party/html-parser/html-parser.ts#L108-L179
[W8]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/SyncValuePropagation.ts#L12-L29
[W9]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/commands/event-subscription.ts#L28-L192
[W10]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/web_compat_table.md#L394-L562
[W10h]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/HTMLElement.ts#L34-L108
[W11]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/commands/property.ts#L19-L43
[W12]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/commands/child-list.ts#L10-L51
[W13]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/exported-worker.ts#L23-L50
[W13h]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/nodes.ts#L6-L70
[W14]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/HTMLCanvasElement.ts#L6-L35
[W15]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/commands/offscreen-canvas.ts#L10-L23
[W16]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/Element.ts#L514-L565
[W17]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/config/rollup.worker-thread.mjs#L16-L48
[W18]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/index.ts#L91-L118
[W19]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/configuration.ts#L17-L43
[W20]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/MutationTransfer.ts#L11-L47
[R0]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/package.json#L1-L123
[R00]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/polyfill/package.json#L1-L36
[Rdoc]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/README.md#L648-L652
[Rdoc2]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/README.md#L508-L531
[Rdoc3]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/README.md#L654-L726
[R1]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/types.ts#L121-L179
[R2]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/elements/internals.ts#L245-L274
[R2h]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/receivers/DOMRemoteReceiver.ts#L332-L414
[R3]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/elements/RemoteMutationObserver.ts#L113-L181
[R4]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/polyfill/source/serialization.ts#L107-L151
[R5]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/receivers/DOMRemoteReceiver.ts#L651-L705
[R6]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/polyfill/source/Document.ts#L187-L228
[R6h]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/polyfill/hooks.ts#L21-L76
[R7]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/receivers/DOMRemoteReceiver.ts#L205-L255
[R8]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/elements/RemoteElement.ts#L702-L765
[R9]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/README.md#L78-L137
[R10]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/elements/RemoteElement.ts#L874-L897
[R11]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/polyfill/source/Window.ts#L131-L164
[R12]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/polyfill/source/Window.ts#L238-L278
[R13]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/elements/connection.ts#L1-L67
[P1]: ../../../packages/protocol/src/platform-isolation.ts
[P2]: ../../../packages/platform/src/isolated-report-controller.ts
[P3]: ../../../openspec/changes/add-linux-isolated-report-provider/design.md
[W7s]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/Element.ts#L225-L259
[W8s]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/dom/HTMLInputElement.ts#L28-L92
[W17s]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/server-lib.ts#L1-L7
[W21]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/main-thread/mutator.ts#L87-L136
[W22]: https://github.com/ampproject/worker-dom/blob/52b619eb46416c4325306de851e5a9df99697fcb/src/worker-thread/strings.ts#L1-L23
[R7d]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/source/receivers/DOMRemoteReceiver.ts#L417-L433
[R9m]: https://github.com/Shopify/remote-dom/blob/064847cd32e4f1ff712661e4acd2cbb92904c2b5/packages/core/README.md#L345-L379
