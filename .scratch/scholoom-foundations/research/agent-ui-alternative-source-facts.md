# Agent UI 候选源码事实：模块边界与外部内核接入

调查日期：2026-10-04。范围限于仓库源码、仓库元数据和可发布包配置。三个候选分别固定到下列完整 commit；链接均指向永久 commit。未安装依赖、构建、运行候选或上游脚本。本文记录模块和证据，不作产品路线判断。

## 固定点与许可

| 候选 | commit / LICENSE | 仓库形态 |
|---|---|---|
| assistant-ui | [`1f77d04435f71476172a6d1ffca871da1a0c933a`](https://github.com/assistant-ui/assistant-ui/tree/1f77d04435f71476172a6d1ffca871da1a0c933a) / 根目录 MIT | TypeScript monorepo；React 主包 `@assistant-ui/react` 0.15.24，core 0.3.23，store 0.3.17，均 MIT；另有 React Native、Vue、Svelte 等包。 |
| AionUi（iOfficeAI/AionUi） | [`6744099b279b991c17e31c243f0920477bd31cb6`](https://github.com/iOfficeAI/AionUi/tree/6744099b279b991c17e31c243f0920477bd31cb6) / 根目录 Apache-2.0 | 根 package 2.2.2；GitHub 上给定仓库地址可读，`git ls-remote` 固定 HEAD。完整 codeload 归档下载未在时限内完成；按 commit 的 raw 文件与 GitHub API tree 核对，未凭目录列表推断遗漏实现。 |
| OpenCode | [`907b3bc518fa48e90e8ec24dd327d13eee71c36c`](https://github.com/anomalyco/opencode/tree/907b3bc518fa48e90e8ec24dd327d13eee71c36c) / 根目录 MIT | monorepo 包版本 1.18.34；Web app 与共享 UI 为 SolidJS，桌面包为 Electron。 |

永久源码链接模板：`https://github.com/{owner}/{repo}/blob/{commit}/{path}`。下文以具体路径链接到同一 commit。

## assistant-ui：外部 store 与可保留 UI

### Store 注册接口

- [`ExternalStoreAdapter`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/runtimes/external-store/external-store-adapter.ts) 是外部事实接入点：可给 `messages` 或 `messageRepository`，注册 `onNew`、`onCancel`、`onEdit`、`onDelete`、`onReload`、`onAddToolResult`、`onResumeToolCall`、`onRespondToToolApproval` 和 `convertMessage`。同时可传 `isRunning`、`isLoading`、`extras`、线程列表 adapter。
- [`useExternalStoreRuntime`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/react/runtimes/useExternalStoreRuntime.ts) 将 adapter 挂到 assistant runtime，并接通共享 model-context、feedback、history adapter。这里不要求采用其 `useLocalRuntime` 或某个模型 SDK。
- 独立 Node 内核的双向 JSON-RPC/WebSocket 可以由 Scholoom 自己写一个外部 store adapter：接收内核事件，更新外部消息仓储/状态；把发送、取消、审批和工具交互回传 RPC。UI 库不会自动实现该协议、事件重放、断线重连或端到端一致性。
- 这不是“任意后端无缝接入”：宿主必须把自有 session/message/part/status 映射为 assistant-ui 的 `ThreadMessageLike`、`ExternalStoreAdapter` 回调和工具审批形状，并处理生命周期、错误、历史分页及 ID 对应。

### 审批、消息与输入组件

- [`ToolCallMessagePart` 与审批数据类型](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/types/message.ts) 支持 host-owned approval id、decision/select/text 展示、选项和授权规则。它表达 UI 与回调契约，不替内核决定授权策略。
- [`respondToToolApproval`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/runtime/interfaces/thread-runtime-core.ts) 是 runtime 命令；外部 adapter 对应 `onRespondToToolApproval`。[`MessageParts`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/react/primitives/message/MessageParts.tsx) 把 `respondToApproval` 方法暴露给工具 part renderer。
- 可保留的原生通用 UI 原语包括 `ThreadPrimitive`、`MessagePrimitive`、`MessagePrimitive.Parts/GroupedParts`、`ComposerPrimitive`，以及基于 text、tool-call、data parts 的渲染。入口分别由 [`core React exports`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/react/index.ts) 与 [`React primitives`](https://github.com/assistant-ui/assistant-ui/tree/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/react/src/primitives) 导出。
- 需提供映射或自定义 renderer 的部分：领域事件卡、工具参数/结果视图、科研审批策略、研究任务导航、产物和研究资源。OpenCode 特有状态不会因为使用 assistant-ui 自动被识别。
- [`ThreadPrimitiveMessages`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/react/primitives/thread/ThreadMessages.tsx) 做 memo 与消息按需子树访问，但源码未见该消息列表默认采用 windowing/虚拟滚动。其 performance contracts 含长线程长度、组件提交、retention 和流式 Markdown 项；不能据此宣称 DOM 行已虚拟化。

### 注册组件与现成 adapter 的界限

- [`MessageParts`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/react/primitives/message/MessageParts.tsx) 允许遍历每个 part，并通过注册表渲染 tool/data UI。通用消息布局、输入和工具交互框架可继续用；专有消息格式必须投影到标准 part 或自行绘制。
- [`@assistant-ui/react-opencode`](https://github.com/assistant-ui/assistant-ui/tree/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/react-opencode) 是可发布 MIT 包，依赖 `@opencode-ai/sdk`；[`useOpenCodeRuntime`](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/react-opencode/src/useOpenCodeRuntime.ts) 建立 OpenCode controller/event source/message projection，并转换 permission 与 question。它是 OpenCode 专用 adapter，不能作为 Scholoom JSON-RPC adapter 直接套用。
- assistant-ui 确实发布 npm 组件/runtime 包：根 monorepo 配置有 changesets publish，React 与 core 各有 package metadata/export。发布组件包和从仓库复制自有 JSX 是两种不同方式；前者保留库版本/API 依赖，后者意味着 Scholoom 承担抽取代码和许可义务，且不是“安装其发布组件”。

## AionUi：完整应用内的模块边界

- 根 [`package.json`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/package.json) 显示 React 19、Electron 37、Vite 6、Arco Design、`react-virtuoso`、ACP SDK 等依赖；包含 Electron 应用和 Web UI 入口。它是完整应用仓库，不是独立聊天组件库。
- [`ChatProvider`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/mobile/src/context/ChatContext.tsx) 展示移动端的本地会话状态模式：保存 messages/streaming/conversationId/confirmations，通过 bridge 读取历史并订阅 `chat.response.stream`，处理 start/finish/thought/content。它的 message shape、event name 与 bridge 属 AionUi 自身约定。
- 桌面 [`MessageList`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx) 使用 AionUi `TMessage`，按类型组合 text、thinking、工具、ACP 工具、权限、问题、artifact、diff summary 等 renderer；调用 pagination hooks、自动滚动和消息锚点窗口。
- [`Message Hooks`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Messages/hooks.ts) 维护消息索引并合并文本/ACP tool stream。独立 [`messagePagination`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/utils/chat/messagePagination.ts) 通过 IPC 做 cursor 分页、anchor window、compact/full payload。
- package 声明 `react-virtuoso` 依赖，但本次检查的 `MessageList.tsx` 没有引用 Virtuoso；因此该列表的证据是分页、增量加载、行 memo、索引缓存和滚动锚点，不能据依赖清单断言消息行使用虚拟化。其他页面是否使用 Virtuoso不在已核对范围。
- [`MessagePermission`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Messages/components/MessagePermission/index.tsx) 将权限选项映射到 PermissionRequestPanel，确认时通过 `ipcBridge.conversation.confirmation.confirm` 回到自有 conversation/call/message ID。[`ApprovalStore`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/common/chat/approval/ApprovalStore.ts) 是 session 级 always-allow 缓存接口；这不是通用 RPC 审批适配器。
- 可借鉴/抽取的候选模块是 MessageList 子 renderer、tool normalization、权限 panel、pagination 算法和 stream merge；逐模块剥离时仍需替换 AionUi `TMessage`、IPC、conversation 身份、Arco/主题与业务回调。包中未找到这些 UI 作为独立发布组件包的证据；根包提供完整 Electron/Web UI 构建脚本。源码抽取和安装包使用仍是两种事实。
- 抽取不应把“支持 Gemini/Claude/Codex/ACP”等同于 Scholoom 内核可插拔。模型/CLI/ACP 后端适配声明描述它支持哪些 Agent 接入；不是对任意 Scholoom 双向 JSON-RPC/WebSocket 会话、消息和审批协议的兼容承诺。本轮未找到 AionUi 面向该自有协议的现成 adapter。

## OpenCode：UI 可读，现成包以 OpenCode 契约为边界

- [`packages/app/package.json`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/package.json) 为 Solid app，依赖 `@opencode-ai/sdk`、`@opencode-ai/session-ui`、`@opencode-ai/ui`、`@tanstack/solid-virtual`；桌面包 [`packages/desktop/package.json`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/desktop/package.json) 基于 Electron。根 LICENSE 为 MIT。
- [`server-sdk.tsx`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/src/context/server-sdk.tsx) 持续消费 SDK event stream，转换事件、缓冲并合并高频 delta 后批量投递；[`server-session.ts`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/src/context/server-session.ts) 投影 message/part/session/permission 事件，并以 cursor/limit 加载和补取历史。
- [`message-timeline.tsx`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/src/pages/session/timeline/message-timeline.tsx) 用 TanStack Solid Virtual 虚拟化 timeline row；有动态测量、overscan、active row 保留、滚动到底、尺寸变化校正与 timeline measurement cache。初始消息页大小在 [`server-session.ts`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/src/context/server-session.ts) 为 20，和 DOM 虚拟化是两层机制。
- [`session-ui/message-part.tsx`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/session-ui/src/components/message-part.tsx) 与 [`session-turn.tsx`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/session-ui/src/components/session-turn.tsx) 承载消息 parts、工具展示和 turn；[`SessionPermissionDock`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/app/src/pages/session/composer/session-permission-dock.tsx) 展示 permission request 与 once/always/reject 操作。
- [`@opencode-ai/ui`](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/ui/package.json) 有 MIT、`files`、exports 与 public publishConfig，属于可发布包；但其源码是 Solid 组件、主题及 OpenCode UI 约定。`@opencode-ai/session-ui` 的 package 标为 `private: true`；`@opencode-ai/app` 同为仓库 app 导出，不是通用可装的 session UI 包。复制它们的源码不等于使用已发布包。
- 源码中存在远端 OpenCode server 连接与 SDK client，但本次没有发现将其换成任意领域内核、保留官方 app UI 的通用 adapter seam。`session-ui` 可以作为模块级源码参考；抽取会连带 Solid、OpenCode schema、event reducer、SDK/UI 包和业务假设。其客户端订阅的是 OpenCode API 事件流，不是任意 JSON-RPC/WebSocket。
- OpenCode 支持多个模型/provider 仍只说明其自有 runtime 能调用多个模型。它不证明 Scholoom 的科研 Agent 内核能被 OpenCode app 或 SDK 无缝代替/接入。

## 对独立 Node 内核 JSON-RPC/WebSocket 的源码结论

- assistant-ui 有与外部状态对接的通用 adapter 接口，适配工作可限制在 Scholoom bridge/store 与消息投影层；可沿用其 thread/message/composer/tool renderer primitives 和标准审批交互 UI。它没有现成的 Scholoom 协议 runtime adapter。
- assistant-ui 的 LangGraph、OpenCode 等 adapter 各自面向特定 SDK/runtime；适配到 JSON-RPC/WebSocket 要新增 Scholoom adapter，不能因某 runtime 支持模型、LangGraph API 或 OpenCode client 就推导出能直连独立 Node 内核。
- AionUi 与 OpenCode 已核对的实现都把消息类型、会话身份、流事件和审批操作接到自家 store/bridge/API。当前证据只支持从源码抽取/参考具体 UI 模块并重写边界；没有发现可直接复用为 Scholoom 双向协议的 runtime adapter。
- 本调查不覆盖依赖安装后的组件渲染验证、单独包可移植性构建、许可证逐文件审查、AionUi 全仓 archive 完整扫描或三候选运行性能基准；这些事实不从源码路径外推。

## 接口颗粒度补充：注册、审批与保留 UI

### assistant-ui 外部 store 接入清单

- UI 消费侧的 store 更新由 adapter 提供：可传递不可变 `messages` 快照，或导出 `messageRepository`；外部状态更新后需让 runtime 收到新 adapter/state。
- 消息输入由 `onNew(AppendMessage)` 返回 Promise；这是“用户提交”接口，内核启动、排队、拒绝或持久化语义由 bridge 决定。
- 停止当前运行由 `onCancel()` 提供。`isRunning` 是 UI 状态输入，适配器要让它和内核真实活动状态保持一致，不能单靠最后一条 assistant message 推断非文本活动。
- 工具继续分三种入口：`onAddToolResult` 写工具结果，`onResumeToolCall` 恢复等待任意 payload 的工具，`onRespondToToolApproval` 回答标准 approval gate。
- permission request 若带有自由文本、多阶段表单或 Scholoom 专属授权对象，需先确定是否能无损表示为 approval options；表示不了时走自定义 data/tool UI 或独立 interaction seam。
- 外部 thread list 是独立 adapter；若 Scholoom 会话列表按研究任务聚合，不能直接把 task ID 与 runtime thread ID 混为同一个身份。
- `extras` 可携带 runtime 之外的领域动作给自定义 UI，但 schema 和调用权限由宿主定义；它不等于内核协议自动发现能力。

### 通用 UI 可留用的具体范围

- 对话结构：Thread 根节点、消息序列、用户/assistant/system message、分支选择、滚动到底和自动滚动 hook。
- 消息内容：parts 遍历、文本、附件、工具调用、工具结果和 data part 的占位及注册渲染点。
- 输入区：Composer input、send/cancel、附件 adapter、引用和可选的输入队列；功能启用情况依 adapter 是否实现相应能力。
- 审批呈现：标准一次性决策、选项选择和文本回答组件及待处理/已决状态；permission 的含义、授权范围和审计记录由 Scholoom 自己映射与保存。
- 性能：细粒度 store scope、按 message/part 取值、memo 子树、流式文本的更新路径和 auto-scroll。这里没有证据表明 `ThreadPrimitive.Messages` 本身会裁剪离屏 DOM。
- 不随 UI 包自动保留的内容：持久化、会话目录/任务关系、内核恢复、事件排序、重复事件去重、断线重连、JSON-RPC correlation ID、WebSocket 生命周期和科研工件投影。

### 另外两个候选的可抽取边界

- AionUi 的 [`MessageToolCall`](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolCall.tsx) 与 summary renderer 可参考工具状态标签、参数和 diff 展示；它们依赖 `IMessageToolCall`、AionUi 文件预览 handler 和 Arco UI。
- AionUi 的 `MessagePermission` 本身从 `ipcBridge` 捕获 `conversation_id`、`call_id`、`msg_id`，因而搬走 JSX 仍要将确认函数改成外部注入；ApprovalStore 的“always allow”又是执行/授权状态，不应与卡片组件一起当成纯展示逻辑。
- AionUi `MessageList` 有历史页加载、目标消息 anchor window 和滚动高度补偿；它减少一次载入量，但所核对源码不显示 DOM windowing。事件流缓冲、字段归并与 UI 列表更新边界应分别审视。
- OpenCode `session-ui` 的 `Message`、`AssistantParts`、`SessionTurn` 依赖 `@opencode-ai/sdk/v2/client` 的 `Message`、`Part`、`SessionStatus` 类型；它不是 schema 无关的展示包。
- OpenCode permission dock 接收其 `PermissionRequest`，按钮直接回答 once/always/reject。审批 UI 外形可参考，调用方式和 allow-always 保存范围属于 OpenCode permission 模型。
- OpenCode `message-timeline` 的虚拟 row 输入是由 OpenCode messages、parts、diff/comment/retry 分支投影出的 TimelineRow；若保留虚拟化思路，Scholoom 行模型仍须自行提供稳定 key、测量更新和活动行保留规则。
- OpenCode 高频 SSE delta 在 `server-sdk.tsx` 缓冲/coalesce，`server-session.ts` 将标准化事件归并进全局 Solid store；这些都是其 SDK 事件类型和 Solid store 体系中的实现，不是独立的通用 websocket stream package。

### UI 复用与源码抽取的许可/交付事实

- assistant-ui 的 `@assistant-ui/react`、`@assistant-ui/core`、`@assistant-ui/store` 都在 monorepo workspace 并各有 npm package 配置；使用包意味着跟随发布版本及其 peer dependencies。
- assistant-ui 的 registry 示例/组件文件由仓库 tooling 生成或复制到使用方项目，和从 `packages/core/src` 私下拷贝实现是不同交付方式；二者都受 MIT 约束，拷贝后需自行承接维护。
- AionUi 的根目录是应用工程，消息组件没有独立的 package export/publish metadata 证据；抽取时需同时移除 `@/renderer` alias、bridge、应用 context 和 CSS/theme 依赖。
- OpenCode `@opencode-ai/ui` 虽有公开 package 配置，其 Solid 类型与 `packages/app`/`packages/session-ui` 的内部依赖仍需核对使用边界；可发布不代表该包内的会话 Agent UI 已经是通用组件。
- 本次只核对仓库根许可、相关 workspace package 的声明和源码路径，没有为每个图标、字体、示例或第三方子目录做逐文件 license audit。
