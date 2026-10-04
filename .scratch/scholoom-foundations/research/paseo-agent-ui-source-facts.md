# Paseo Agent 交互 UI 源码事实

## 调查边界

- 仓库：[`getpaseo/paseo`](https://github.com/getpaseo/paseo)。本报告固定到 [`5285b7e502714f2d08a220c328aedca3b9637b94`](https://github.com/getpaseo/paseo/commit/5285b7e502714f2d08a220c328aedca3b9637b94)，commit 时间为 2026-10-04，标题为 server directory search 修复。
- 源码通过 GitHub API 的该 SHA tarball 只读获取至 `/tmp/paseo-source-facts`；检查 package、UI、client、protocol、server 文件，没有安装依赖、执行上游脚本、启动服务或运行验证。
- 事实仅代表该 commit 快照。以下源码链接均固定到同一 SHA；行号用于定位，若 GitHub UI 不支持行号仍可打开文件。
- 当前 Scholoom 工作区仅新增本报告；原有未跟踪文件未作改动。

## 结论性事实

- Paseo 的桌面宿主确为 Electron：`packages/desktop` 的 package 描述为 Electron wrapper，依赖 Electron；其 `src/main.ts` 导入 Electron 主进程 API。[desktop package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/desktop/package.json#L1-L18) · [main process](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/desktop/src/main.ts#L13-L31)
- Agent 交互 UI 不在 Electron main 包中，而在共享的 `packages/app` Expo 应用里。根 package 明确列出 app 与 desktop 两个 workspace；app 有 Expo Router、React Native、React Native Web，desktop 是包装/宿主集成。[root workspaces](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/package.json#L15-L28) · [app dependencies](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/package.json#L30-L98)
- 因此用户关于“桌面端为 Electron”的猜测核实成立；但把 UI 当作 Electron 专属 React DOM 面板并不准确。UI 使用 React Native 组件，并同时实现 Web、原生平台渲染分支。
- 根 LICENSE 声明除第三方组件外项目为 Apache License 2.0，版权人为 Mohamed Boudra；复用需保留许可及版权声明，并逐项核对第三方组件各自许可证。[LICENSE](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/LICENSE#L1-L14)
- `@getpaseo/client` 和 `@getpaseo/protocol` 是可发布 workspace package；Agent 面板 UI 所在 `@getpaseo/app` 标为 `private: true`，没有公开导出入口。因此没有找到可单独安装消费的官方 Agent 面板组件包。[app package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/package.json#L1-L12) · [client package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/client/package.json#L1-L25)

## 技术栈与宿主耦合

| 层 | 源码事实 | 依据 |
|---|---|---|
| UI 语言/框架 | TypeScript、React、React Native、React Native Web；路由为 Expo Router | [app package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/package.json#L70-L98) · [root app](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/root-app.tsx#L1-L15) |
| 状态/数据 | Zustand session store；TanStack Query mutation；客户端 SDK 持有 WebSocket 协议 | [session store](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/stores/session-store.ts#L715-L735) · [stream view](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L24-L29) |
| 样式/动画/图标 | `react-native-unistyles`、Reanimated、`lucide-react-native` | [stream view imports](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L15-L29) |
| 虚拟列表 | Web 用 `@tanstack/react-virtual`；Native 用 React Native `FlatList` | [web strategy](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/strategy-web.tsx#L10-L28) · [native strategy](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/strategy-native.tsx#L10-L30) |
| Electron 接缝 | app 通过 preload/host bridge 调用桌面能力；宿主另含 IPC、窗口、daemon lifecycle 等 | [desktop preload](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/desktop/src/preload.ts#L1-L20) · [app desktop host](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/desktop/host.ts#L1-L80) |

Paseo 有 Expo 原生依赖：例如 Expo clipboard、file system、audio、router、SQLite，以及 React Native gesture、keyboard controller、Skia、Reanimated 等。核心 `AgentStreamView` 直接导入 `react-native` 的 `View/Text/Pressable/Platform`，不是脱离 RN 可直接渲染的 React DOM 组件。[app package dependencies](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/package.json#L30-L125) · [view imports](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L15-L29)

`strategy-resolver.ts` 在 `Platform.OS === "web"` 时选择 Web 实现，其他平台选 Native。Electron renderer 使用 Web 构建路径；构建脚本把 Expo web export 与 `PASEO_WEB_PLATFORM=electron` 配合。故桌面 renderer 的 UI 属于 Web 分支，Electron 能力通过专用 bridge 接入。[strategy resolver](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/strategy-resolver.ts#L1-L14) · [root desktop scripts](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/package.json#L85-L110)

## UI 源码入口与依赖链

### 具体模块调用链（逐跳源码）

下面区分“源码中可见的调用/数据依赖”和“便于概括的层次描述”。箭头表示实际调用、订阅或 props/state 数据流，不表示独立进程边界。

#### 面板装配到 stream viewport

1. [`panels/agent-panel.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/panels/agent-panel.tsx#L1380-L1463) 从 workspace/session 选择 agent stream items、权限列表、turn presentation 等，再把这些作为 props 传给 `AgentStreamView`。
2. [`agent-stream/view.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L272-L296) 的 props 已展示这个组件的领域边界：agent/server/context、stream items、pending permissions、pending submissions、turn presentation、文件打开 callback、历史分页 callback。它不是只接收 `messages[]` 的无状态通用视图。
3. `AgentStreamView` 另从 `useSessionStore` 取 client、实时 head、timeline epoch 和 detached 状态，并通过 `useFileExplorerActions`、`useForkAgent`、`useChatOutline`、`useStreamHistoryWindow` 连接工作区与历史行为。[store/context reads](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L375-L405) · [history window](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L550-L570)
4. `buildAgentStreamRenderModel` 对 tail/head 排序、切分为 history 与 live head、推导 turn timing/boundary；`layoutStream` 再给每行计算 turn/footer/boundary 的布局信息。[model projection](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/model.ts#L158-L212) · [layout projection](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/layout.ts#L344-L389)
5. view 把 segments、renderer 集合、分页与滚动 callbacks 交给 resolved strategy；Web strategy 用 TanStack Virtual 管历史 viewport，Native strategy 用 RN FlatList。[strategy handoff](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L1109-L1135) · [resolver](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/strategy-resolver.ts#L5-L14)

#### 实时流事件到 UI 状态

```text
DaemonClient.observeTimeline(agentIds)
  → SessionProviderInternal 的 observation.subscribe(update)
  → onStream(agent_stream): { agentId, event, timestamp, seq, epoch }
  → ViewedTimelineOwner.enqueueStreamEvent(agentId, event)
  → createAgentStreamReducerQueue：读当前 tail/head/cursor，批量归并事件
  → commit: useSessionStore.setAgentStreamState(tail/head/acks)
  → AgentPanel selectors 把该 agent 的 items 传入 AgentStreamView
  → buildAgentStreamRenderModel → layoutStream → strategy renderer
```

对应源码：订阅与事件入口在 [`contexts/session-context.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/contexts/session-context.tsx#L375-L429)；队列 snapshot/commit 直接读取 Zustand，并提交 tail/head 与 cursor 在 [`timeline/session-stream-reducers.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/timeline/session-stream-reducers.ts#L1878-L1935)；AgentPanel props 转交见 [panel render](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/panels/agent-panel.tsx#L1445-L1463)。reducer queue 有 requestAnimationFrame 与约 48ms timer flush 策略，说明接收事件并非每个 token 都直接同步触发一次完整 UI render。[flush scheduler](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/timeline/session-stream-reducers.ts#L1840-L1866)

#### 输入、消息提交到 daemon

```text
AgentPanel / Composer host props
  → Composer renders StableMessageInput(onSubmit=handleSubmit)
  → submitMessage: optional caller override, otherwise sendAgentMessageRef
  → dispatchComposerAgentMessage(client, agent, attachments, optimistic writer)
  → submission.begin(local stream); client.sendAgentMessage(...)
  → DaemonClient creates requestId + send_agent_message_request
  → WebSocket server unwraps session envelope and calls Session.handleMessage
  → Session dispatches handleSendAgentMessageRequest
  → AgentManager/provider runs prompt; response acknowledges acceptance
  → resulting agent_stream events return through observation chain above
```

`Composer` 把 `handleSubmit` 传给 `StableMessageInput` 的 `onSubmit`。[composer input assembly](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/index.tsx#L2438-L2455) submit callback 会按外层 override 或 client route 分支。[submit branch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/index.tsx#L1536-L1553) 默认 agent route 把依赖交给 `dispatchComposerAgentMessage`。[client dispatch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/index.tsx#L1560-L1589) dispatch 先生成临时用户行、调用 writer.begin，随后 await client send，成功 accept、异常 reject。[optimistic + send](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/actions.ts#L207-L231)

`DaemonClient.sendAgentMessage` 使用请求/响应关联 ID，schema 类型是 `send_agent_message_request`；它等待 `send_agent_message_response` 并检查 accepted。[client RPC](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/client/src/daemon-client.ts#L3445-L3478) server WebSocket 层将 session envelope 交给 `Session.handleMessage`。[websocket dispatch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/websocket-server.ts#L2371-L2408) Session switch 分派到 `handleSendAgentMessageRequest`；该 handler 解析 agent、构造 prompt 并进一步进入后续 agent runtime。[session switch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/session.ts#L2733-L2755) · [handler start](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/session.ts#L8052-L8080)

#### 审批状态与响应

```text
SessionProvider observeEvents(agent_permission_request / resolved)
  → pendingPermissions Map in session-store
  → AgentPanel filters entries for current agent
  → AgentStreamView renders PermissionRequestCard
  → action creates AgentPermissionResponse
  → DaemonClient.respondToPermissionAndWait(agentId, requestId, response)
  → agent_permission_response over session WS
  → Session.handleMessage → handleAgentPermissionResponse
  → resolved event removes matching pending permission
```

request/resolved event 分别增删 store 中的权限条目。[permission store updates](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/contexts/session-context.tsx#L559-L585) AgentPanel 只把当前 agent 对应权限交给 view。[permission projection](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/panels/agent-panel.tsx#L1420-L1461) Permission card 调 client。[UI mutation](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L1471-L1515) client 发送 `agent_permission_response` 并等匹配 request/agent 的 resolved event。[client response](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/client/src/daemon-client.ts#L5644-L5674) Session 侧 switch 分发到 `handleAgentPermissionResponse`。[session dispatch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/session.ts#L2739-L2755)

以上说明审批不是 transcript 中 tool-call row 的局部展开状态：它有独立的 event → store → panel props → mutation → server command 往返。提取时应保留目标系统的权限 DTO、待处理生命周期和响应关联。

### 消息、工具事件、审批和流式更新

1. [`packages/app/src/panels/agent-panel.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/panels/agent-panel.tsx#L1430-L1475) 组合 `AgentStreamView` 与 agent/workspace 上下文，是完整 agent panel 的入口之一。
2. [`packages/app/src/agent-stream/view.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L267-L330) 定义 `AgentStreamView` props/主组件；同文件构造消息、assistant 文本、tool call、todo、通知、permission 卡片，见 [render dispatch](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L730-L910)。
3. 流事件订阅由 [`contexts/session-context.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/contexts/session-context.tsx#L350-L430) 使用 client timeline observation 接入；`agent_stream` 进入 viewed timeline sync 的 enqueue 队列，权限请求进入 `pendingPermissions`。[permission handler](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/contexts/session-context.tsx#L525-L590)
4. [`timeline/session-stream-reducers.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/timeline/session-stream-reducers.ts#L1-L45) 与 [`types/stream.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/types/stream.ts#L1-L30) 把协议事件归并为面板消费的 stream item；store 中分别保存历史 tail 与实时 head。[session store stream state](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/stores/session-store.ts#L1040-L1175)
5. `view.tsx` 通过 `buildAgentStreamRenderModel` 和 `layoutStream` 投影列表；Web/Native strategy 负责 viewport、滚动锚点、加载旧历史和虚拟化。[render model](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/model.ts#L1-L55) · [layout](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/layout.ts#L1-L45)
6. Web 的虚拟化源码在 [`strategy-web.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/strategy-web.tsx#L10-L28)，高度估算/已挂载尾窗策略在 [`web-virtualization.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/web-virtualization.ts#L1-L80)。Native 则用 `FlatList` 和 RN 可见内容位置维护。
7. 权限卡片 `PermissionRequestCard` 通过 TanStack mutation 调用 `client.respondToPermissionAndWait(agentId, requestId, response, 15000)`；按钮动作由 protocol permission action 描述。[permission card](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/agent-stream/view.tsx#L1400-L1515) · [wire schema](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/protocol/src/messages.ts#L2142-L2147)

### 输入与发送

- [`packages/app/src/composer/index.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/index.tsx#L1-L80) 是高层 composer，管理 agent 状态、附件、草稿、队列和提交。`MessageInput` 与具体 RN 文本输入在 [`composer/input/input.tsx`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/input/input.tsx#L1-L150)。
- 键盘/按钮输入经 `onSubmit` 进入 composer，再由 `dispatchComposerAgentMessage` 先写本地 optimistic submission，转换附件和图片，调用 client；实现位于 [`composer/actions.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/actions.ts#L210-L280)，submission writer 位于 [`composer/submission/writer.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/src/composer/submission/writer.ts#L1-L62)。
- SDK `DaemonClient.sendAgentMessage` 构造 `send_agent_message_request` 并等待对应 response；具体发送包装见 [`daemon-client.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/client/src/daemon-client.ts#L3435-L3478)。protocol payload 包含 `agentId/text/messageId/activeTurnBehavior/images/attachments`。[schema](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/protocol/src/messages.ts#L1197-L1208)
- 返回的 stream event 带 `agentId/event/timestamp`，timeline 项可能附 `seq/epoch`；协议还定义 timeline replacement 通知用于刷新规范历史。[agent stream schema](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/protocol/src/messages.ts#L4081-L4092) · [replacement schema](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/protocol/src/messages.ts#L4618-L4625)

### 组件包情况

- `@getpaseo/client` 是公开发布的 SDK，导出客户端，不含 UI；`@getpaseo/protocol` 是公开发布的 Zod schema/wire types 包。[client](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/client/package.json#L1-L25) · [protocol](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/protocol/package.json#L1-L26)
- `@getpaseo/highlight` 与 `@getpaseo/plugin` 是其他可发布包；它们不是 Agent transcript/composer UI。[highlight package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/highlight/package.json#L1-L20) · [plugin package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/plugin/package.json#L1-L24)
- 因此“可单独消费的 UI 组件包”在该 commit 中不存在；复用方式只能是复制/移植源码或 fork 整个 app workspace，再自行切包。后一句为根据 package metadata 的推断。

## 最适合提取的源码组

以下是依照实际边界给出的提取候选，不代表已经验证可编译、运行。

| 用途 | 源码候选 | 必须保留/替换 |
|---|---|---|
| 仅 transcript 布局与虚拟滚动 | `agent-stream/strategy-web.tsx`、`strategy.ts`、`web-virtualization.ts`、`history-window.ts`、`reading-anchor.ts`、`history-start-pagination.ts`、`history-start-settle-scheduler.ts`、`history-row-revision.ts` | 保留 TanStack Virtual 与 React DOM viewport 代码；替换 Paseo `StreamItem`、renderer props、Theme、LoadingSpinner、retained-panel hook、stable-event hook。用目标应用自己的 row renderer 和 timeline paging callback 注入。`strategy.ts` 的契约仍包含 Paseo stream/layout 类型，因此不能认为列出这些文件就已构成零改动独立包。 |
| 转录展示/消息行 | `agent-stream/view.tsx`、`model.ts`、`presentation.ts`、`layout.ts`、`types/stream.ts` 的必要子集、`components/message/*`、`components/tool-call-details/*` | 需要成组提取，因 view 直接依赖 agent message domain、React Native、样式、i18n、工作区文件链接、图像获取、fork、搜索/outline、权限 store 等。删减/替换非目标功能后才可形成独立 UI。 |
| 输入编辑器 | `composer/input/input.tsx` 与 `composer/input/state.ts` | 可作为交互设计参考；若直接复用，需保留 React Native text input 适配、Reanimated/Unistyles、i18n、shortcut、IME/keyboard、dictation/voice hooks。最小 Web 移植更适合重写 input shell，保留纯状态/提交意图逻辑。 |
| 完整 composer | `composer/index.tsx`、`composer/actions.ts`、`composer/submission/writer.ts`、`composer/types.ts`、附件组件/hooks | 依赖广，含上传 API、图像持久化、工作区文件 picker/drop、Forge/GitHub 附件、agent controls、队列、设置、voice。必须把这些领域能力替换成目标应用接口；只要普通文本输入时不应整组搬运。 |
| client/protocol | `@getpaseo/client`、`@getpaseo/protocol` | 只有目标后端实现兼容 Paseo daemon WS schema 才能保留。否则将 `DaemonClient` 替换为 Scholoom client adapter，并把 `StreamItem`/权限 DTO 映射为目标领域模型。 |

## 组件 → 状态 → client → daemon 协议依赖图

```text
AgentPanel / Composer
  ├─ AgentStreamView(props: agent/context + stream items)
  │    ├─ render model/layout → web virtualizer → Message/ToolCall/Permission rows
  │    ├─ useSessionStore: tail/head、pending permissions、client、timeline cursor
  │    └─ approval action → DaemonClient.respondToPermissionAndWait
  └─ MessageInput → Composer.submitMessage
       → dispatchComposerAgentMessage
       → optimistic MessageSubmissionWriter → DaemonClient.sendAgentMessage

DaemonClient (packages/client)
  ⇄ WebSocket JSON envelope + requestId-correlated RPC
  ⇄ send_agent_message_request / agent_permission_response
  ⇢ agent_stream (agentId/event/timestamp/seq/epoch)
  ⇢ agent_permission_request / resolved
  ⇢ agent.timeline.replacement + fetch timeline pages
Daemon websocket-server / AgentManager (packages/server)
```

此图的连接关系由 `AgentPanel`、`Composer`、`SessionProvider`、client 方法和 protocol schema 的源码共同支持；daemon 端 WebSocket 在 [`server/websocket-server.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/websocket-server.ts)，AgentManager 发出 stream event 的入口见 [`agent-manager.ts`](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/server/src/server/agent/agent-manager.ts#L4990-L5035)。

## 提取依赖与技术风险（推断）

若提取 Web transcript viewport，相关源码不只 `strategy-web.tsx`，还包括 `strategy.ts`、`web-virtualization.ts`、`history-window.ts`、`reading-anchor.ts`、分页/settle scheduler 与 `history-row-revision.ts`。这些模块仍依赖 Paseo `StreamItem`、布局/renderer 契约、Theme、LoadingSpinner、retained-panel 与 stable-event hook；本报告不据此判断哪种替换方案最合适。

若提取完整 transcript 交互，`view.tsx` 还串接 tool/message renderer、权限卡、聊天搜索/outline、历史同步、工作区文件/图片、fork、turn footer 和 session store。输入若一并提取，`composer/index.tsx` 依赖附件、工作区文件、slash command、队列、agent controls、设置和 voice。源码层面需逐项保留或适配这些模块边界；能否原样复用取决于 Scholoom 的运行时和领域模型。

主要技术风险：

- `AgentStreamView` 不只是 UI：文件有大量本地模块依赖，且 hooks 直接读取 Paseo session store、host runtime、workspace context。单文件复制会缺模块、缺上下文或产生深层耦合。
- 样式与组件基于 React Native / Unistyles；纯 React DOM 工程不能直接照搬全部组件。Web strategy 内也混用 RN view 包装和 DOM/CSS/`flushSync`。
- Paseo timeline 具备 epoch、sequence cursor、head/tail、分页、替换通知、optimistic submission 等一致性语义。若后端协议不同，直接接入渲染层会丢排序、重连补齐或用户消息确认行为。
- permission card 的 action shape 不是通用 allow/deny 布尔值，还可能有多 action、plan、question 等语义；必须适配目标 agent 的审批模型。
- Markdown、tool call 详情、图片、附件、文件链接、任务卡和代码高亮有各自组件和样式依赖；选取不同 renderer 会带来不同迁移成本。
- Expo/Electron host bridge 不是 transcript 核心依赖，但完整 app 页面、快捷键、文件选择、窗口行为、声音和附件链会触及平台 API。移植时需要从 UI 核心剥离宿主能力。
- Apache-2.0 允许复用但要求遵守许可条款；需保留 LICENSE/NOTICE（如有），并审查随提取组件一起复制的第三方源码/资源许可。此处不构成法律意见。

## 给主 Agent 的结构化观察结果

```yaml
repo: getpaseo/paseo
commit: 5285b7e502714f2d08a220c328aedca3b9637b94
commit_url: https://github.com/getpaseo/paseo/commit/5285b7e502714f2d08a220c328aedca3b9637b94
license: Apache-2.0 (third-party components retain their own licenses)
desktop_host: Electron (packages/desktop); Agent UI is Expo/React Native app workspace
renderer: Expo web export / React Native Web; shared RN UI with web/native strategies
standalone_agent_ui_package: false
published_related_packages: ["@getpaseo/client", "@getpaseo/protocol"]
state: Zustand session store; stream tail/head plus pending permissions
stream_path: WebSocket -> DaemonClient observation -> SessionProvider/timeline sync -> reducers/store -> AgentStreamView -> render model/layout -> strategy
send_path: MessageInput -> Composer -> dispatchComposerAgentMessage -> optimistic submission writer -> DaemonClient.sendAgentMessage -> send_agent_message_request
approval_path: PermissionRequestCard -> DaemonClient.respondToPermissionAndWait -> agent_permission_response
protocol_events: [agent_stream, agent_permission_request, agent_permission_resolved, agent.timeline.replacement]
web_virtualization: "@tanstack/react-virtual"
native_virtualization: "React Native FlatList"
candidate_extraction_dependencies: "web viewport strategy + strategy contract + virtualization/history window/anchor/pagination helpers + Paseo StreamItem/render contracts and supporting UI hooks"
not_verified: "no dependencies installed; no build, runtime, or extraction compatibility claim"
```
