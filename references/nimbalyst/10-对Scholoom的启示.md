# 10 对 Scholoom 的启示

调研完 Nimbalyst 之后，最值得看的不是「它有多少功能」，而是**它在哪些地方做了取舍，以及那些取舍为什么值得抄**。同时也必须看清它的代价——它是一个 0.79 版本的桌面应用，有 7 处文档漂移、一套正在进行的破坏性数据库迁移、和一个已经漂移的对外 SDK。

## 一、值得直接抄的九个模式

### 1. 每条架构约束配一个可执行门禁脚本，且脚本头部写清对应事故

`scripts/` 下 17 个 `check-*.mjs`，全部在 `scripts/__tests__/` 有回归测试。每个脚本头部注释记录了它防的是哪次真实事故：

```js
// main-process ↔ collab-sync: 2026-08-03 TeamSyncProvider 漏传
// createProxiedWebSocket，Origin 被服务端拒绝，浏览器只报 1006，
// Shared Docs 全线静默失效
```

这比抽象规范有效得多。**Scholoom 若有任何模块边界约定，都应该配一个 20 行的扫描脚本。**

更进一步：Nimbalyst 把边界检查**直接 import 进 vite 配置**（`electron.vite.config.ts` import `main-bundle-graph-policy.mjs`），让违规在构建时就失败，而不是等 pre-push。

### 2. 不可逆迁移的「日志 + 状态机 + 对账」三件套

数据库从 PGLite 切到 SQLite 的工程值得完整看：

| 组件 | 职责 |
| --- | --- |
| `cutoverJournal.ts` | 原子写入记录每个阶段，**落盘后才进下一步，拒绝阶段倒退** |
| `cutoverMachine.ts` | 唯一切换状态机 |
| `cutoverReconciler.ts` | 未完成切换的启动期对账 |

恢复子系统同构：`recoveryJournal.ts` **在动任何文件之前先写下打算做什么**；`recoveryReconciler.ts` **拆成纯规划器与薄执行层**。

> **通用规则**：日志负责「走到哪了」，状态机负责「能往哪走」，对账负责「崩了怎么续」。规划与执行分离让规划可测、执行不需要测。

Scholoom 若有任何跨版本的数据/状态迁移，这三件套可以直接照搬。

### 3. 破坏性操作：先重试、验证损害、事件前置、留可恢复产物

`.claude/rules/destructive-data-paths.md` 五条要求里，第 5 条的案例最值得记：

> 心跳给了「成功」产物，没给「丢失」产物，**一行代码本可以把 bug 定位到十一月**。

配套三禁令里最深刻的是：**「只在无法复现的环境里才能触发的破坏性决策，位置就是错的」**——应该抽成纯函数。

还有一条设计取向：**`databaseOperationLock` 对并发破坏性操作直接拒绝，而不是排队等待**。

### 4. 穷尽表代替条件分支

在 provider 数量、插件数量、数据库后端数量都很多时，散落的 `if (provider === 'x')` 必然爆炸。Nimbalyst 的做法是收敂成表：

| 表 | 收敂了什么 |
| --- | --- |
| `agentCapabilities.ts` | agent 能力声明，**无可选成员的穷尽 Record** |
| `PERMISSION_CATALOG` | 权限 id 唯一事实源，**扩展只能引用不能注册** |
| `providerPayloadSlots.ts` | 各 provider chunk 中重负载放哪里 |
| `nonRenderingFrames.ts` | 哪些帧不产生 transcript 事件 |
| `dbBoolean.ts` / `jsonKeyExpr()` | 双后端差异 |

**穷尽类型的价值在于编译期**：新增 provider 漏声明能力会直接类型报错，而不是运行时才发现。

### 5. canonical 事件 + 投影

transcript 管线是三层解耦：

```
provider 原始输出 → IRawMessageParser → canonical 事件 → 存储 → TranscriptProjector → 渲染消息
```

**存储的是与 provider 无关的 canonical 事件，渲染的是投影而非原始流。** 因此新增 provider 完全不需要改渲染层。

而且 canonical events **仅存在内存**（`InMemoryTranscriptEventStore`，每会话一份，MRU 淘汰默认上限 16），持久化只存 provider 原生 raw——**为将来换投影方式保留了完全的自由**。

### 6. core 与宿主 UI 分离

`TrackerReferenceNodeCore.ts` 是 **React-free** 的，只存引用 key 与 view，标题/状态在渲染时由宿主实时解析；`TrackerReferenceNode.tsx` 只做 React 装饰器绑定，且**未注册渲染器时降级为纯 key 文本**。

配套的只读变体 `TrackerReferenceReadOnlyChip.tsx` 给无 tracker store 的宿主（Web 控制台）用，**形状一致但无弹层、无导航、点击无副作用**。

**三条通用原则**：core 不含框架依赖；宿主绑定层负责降级；只读变体与完整变体共享形状。

### 7. 无头 / 有头二分

`editor/extensions/builtin/` 的 21 个无头扩展只注册 Lexical 命令与节点，`editor/plugins/` 的 36 个带 UI 插件承载渲染。`EditorNodes.ts`（渲染进程）与 `headlessBodyNodes.ts`（主进程从 markdown 重建）也刻意分开。

> **这让同一个编辑器内核能被主进程无头、渲染进程有头、离屏窗口复用而不重复实现。**

Scholoom 若要做 headless 渲染、导出、CI 校验，这个二分是前提。

### 8. 注入式间接层破循环

项目里有三处显式为破环而存在的文件，文件摘要直接写明意图：

- `mcpConfigServiceRef.ts`——「通过注入式 getter 打破主进程模块间的循环依赖」
- `extensionBackendRpc.ts`——「只定义消息形状，不含传输实现」
- `runtime/src/host/hostEnvironment.ts`——把 runtime 直接问 Electron `app` 的问题收口成宿主能力契约

**主进程模块图大到需要专门的破环手段，说明这类间接层应当一开始预留，而不是事后打补丁。**

### 9. 高频更新在 store 层做帧级合并

`transcriptStreamAccumulator.ts` 把主进程高频 `transcript:event` 推送**合并为每帧每会话一次更新**。

不是节流事件源（那会丢状态），而是在 store 层合并，**保证每帧最多一次 React 更新**。这正是「高频更新的 DOM 必须专门检查性能问题」的一个具体解法。

## 二、值得抄的约定

| 约定 | Nimbalyst 的写法 |
| --- | --- |
| **组件绝不直接订阅 IPC** | 中心 listener 启动时订阅一次 → 更新 Jotai atom → 组件 `useAtomValue()`。理由列了四条：竞态、陈旧闭包、`MaxListenersExceededWarning`、内存泄漏 |
| **不确定作用域时按更严的一侧** | 「workspace 作用域的 handler 必须带 `workspacePath`。**判断不了是否 workspace 作用域时，它就是。**」 |
| **每份状态只有一个权威源** | 「如果你在写代码『同步』两个 atom，你大概有架构问题」 |
| **文件内容必须无损往返** | CommonMark 兼容、禁 HTML passthrough、禁不可序列化的布局与 widget。**每个特性必须能「编辑 → markdown → 编辑」无损往返** |
| **barrel 永不进入模块图** | 源码与测试都走深路径导入；绝不 mock runtime barrel（每文件多 2.6 秒） |
| **门禁脚本自身有测试** | 25 个文件覆盖所有 scanner/policy 脚本，包括它们对当前仓库的自检 |
| **测试替身桩写清 why** | `electronLogStub.ts` 解释「Proxy 的 `then` 导致 import 永久 hang，`testTimeout` 够不着」——比「stub 了什么」有用得多 |
| **失败产物也要有心跳** | 见上文模式 3 |
| **错误文案与 commit 引用用 GitHub issue 号** | `NIM-###` 是 tracker-room 作用域，公开仓库里写它**比不写更糟** |
| **架构图默认不画** | 只有当改动重排三个以上组件的关系且拓扑从文字看不出来才画 |

## 三、必须警惕的五件事

### 1. 领域横跨两个包时，进程归属与领域归属必然冲突

Nimbalyst 最重的双向依赖是 `ai-services ↔ main-process`（234 / 158）。根因是 **`main/services/ai/` 的 112 个文件既是 AI 代码又必须留在主进程**（PTY、进程观测、权限 hook）。

> **Scholoom 若一开始就按领域切包（而不是按进程切包），这类冲突不会存在。** 这是一处可以提前避开的架构债。

### 2. 7 处文档漂移全部源于「架构演进后没回头改旧文档」

数据库引擎、transcript 架构、`messages` 列、时间戳类型、harness 层数、架构图规则、JWT 模型——**7 处漂移的技术判断方（A）全部滞后于架构现状（B）**。

其中 `DATABASE_SCHEMA.md` 更是**同一文档内自相矛盾**：ER 图列了 `messages` JSONB，第 120 行注明「消息历史现存储在 `ai_agent_messages`」。

> **对策**：建立单一事实源 + 引用而非复制的文档策略。Nimbalyst 自己的 `.ua/wiki/README.md:10` 就是这么做的——「图谱是唯一事实源：正文不复制既有设计文档与规格，只链接过去，避免出现第二事实源」。**Scholoom 应把这句当作默认策略。**

### 3. 对外 SDK 会漂移，除非有机制拦住

`EXTENSION_SDK_RELEASE_REVIEW.md` 的 6 项发现里最刺眼的是：**SDK 已发布类型与 runtime 契约漂移**——`EditorHost` 缺 3 个方法、`fileIcons` SDK 说数组 runtime 说 record、SDK 叫 `lexicalNodes` runtime 叫 `nodes`、`scope` 枚举值不同。加上三个示例工程**全部无参数构建失败**。

> **对策**：SDK 与 runtime 共享**同一份类型定义**（Nimbalyst 在 runtime 内部做对了——`editorHost.ts` 从 extension-sdk 再导出），并让发布门禁真的跑示例工程（`extension-sdk-public-checks.sh` 做了，但示例本身坏了）。

### 4. 数据污染的代价是真实的

NIM-2232：已验证的 Stytch token ≠ personal-scoped token。生产调查中 **69 个 personal-org id 有 4 个解析到真实 TeamRoom，208 个 member 行有 84 个为 null**，相关 commit 被判定**不可按原样部署**。

> **对策**：作用域隔离必须靠**类型系统 + 运行时双重强制**。Nimbalyst 的 branded type 只在个人侧做了，团队侧留了洗白路径——**半套隔离等于没有隔离**。

### 5. harness 的自省机制是唯一能持续降低事故率的手段

`THE_HARNESS.md` 有一条机制特别值得抄：

> `.claude/rules/` 中**同一条规则在 agent-mistakes 日志里重复出现就「毕业」为永久规则文件**。`/analyze-sessions` 交叉比对会话、mistakes 日志、rules 与 MEMORY.md，产出针对性修改建议。

但它自己也承认缺口：端到端验证仍是规则而非门禁、**无写入循环检测**（曾出现 87 秒 108 次写入未被发现）、无视觉回归、无 agent 行为遥测。

> **Scholoom 应优先补「写入循环检测」和「端到端验证门禁化」这两项**——它们防的是最难在 review 中发现的一类问题。

## 四、按优先级的行动清单

### 立刻可做（成本低、收益高）

1. **建立单一事实源 + 引用式文档**——正文不复制规格，只链接。把 Nimbalyst 7 处漂移当成自己的警戒线。
2. **给每条模块边界约定配一个 20 行的 `check-*.mjs`**，头部写清它防什么事故，并让它在 pre-push 或构建中运行。
3. **组件禁止直接订阅 IPC**——统一走「中心 listener → atom → `useAtomValue()`」。这一条同时解决竞态、陈旧闭包、监听器泄漏三个问题。
4. **不确定作用域时按更严的一侧处理**——写进规则文档。

### 架构定型时做（影响长期结构）

5. **按领域切包，不按进程切包**——避免 Nimbalyst 那 234 条 AI↔主进程的跨层依赖。
6. **core 与宿主 UI 分离**，并为每个 core 提供「未注册时降级」与「只读变体」。
7. **无头 / 有头二分**——只要有 headless 需求（导出、CI 校验、服务端渲染）就提前分。
8. **穷尽表代替条件分支**，并用穷尽类型让漏声明在编译期暴露。
9. **预留注入式间接层**——破环手段应当一开始就有位置，而不是事后加 `Ref.ts`。

### 有不可逆操作时做

10. **日志 + 状态机 + 对账**三件套；规划与执行分离。
11. **破坏性路径五条要求 + 三禁令**，尤其「事件前置」与「失败产物也要有心跳」。
12. **并发破坏性操作直接拒绝**，不排队。

### 持续做

13. **穷尽表与 barrel 纪律**：唯一事实源、barrel 不进模块图。
14. **高频更新在 store 层帧级合并**，不节流事件源。
15. **建立 mistakes → 规则的毕业机制**，并优先补写入循环检测与端到端验证门禁。

## 五、一句话总结

> Nimbalyst 最值得学的不是它的功能，而是它对**不可逆操作**和**跨进程边界**的处理方式：日志先于动作、拒绝优于排队、规划与执行分离、每条边界一个门禁脚本。
>
> 它最该被警惕的是**文档演进跟不上架构演进**——7 处漂移全部是「改了代码没改文档」，加上一个已与 runtime 脱节的对外 SDK。**这提醒我们：文档的 SSOT 必须是代码，而不是另一份文档。**
