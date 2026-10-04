# Nimbalyst Agent 面板源码事实（固定 commit ee725240）

调查日期：2026-10-04。只做静态源码核对：未安装依赖、未构建、未运行上游脚本或应用，未涉及编辑器部分。本文只给边界事实，不做 Scholoom 选型；上游支持 Codex／LangGraph 不构成接入 Scholoom 无需适配的证据。

## 固定点核对

- 目标 commit 存在于上游 `nimbalyst/nimbalyst`：`refs/heads/main` = `ee725240ecbd1bc400337eaa69d94efd5367e763`（`git ls-remote` 核对），源码取到 `/tmp/nimbalyst-src/up` 并 detached 在该 commit。
- 本地快照 `/home/joshua/Workspace/Code/JavaScript/nimbalyst` 的 `origin` 是 `leike0813/nimbalyst`，`main` 停在 `9f13b2794`；该 commit 同时存在于 `nimbalyst/nimbalyst` 历史，是本固定点祖先，相距 29 个提交。快照工作区在 `packages/runtime/src/ui` 下无未提交改动，文件对比可信。
- 链接基准：`https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/`。

## 一、面板入口仍以 props 输入会话

- [`AgentTranscriptPanelProps`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/AgentTranscriptPanel.tsx#L39) 约 40 个 prop：`sessionId`、`sessionData: SessionData`、`todos`、`fileEdits`、`pendingReviewFiles`、`renderHeaderActions`、`renderEmbeddedFile`、`loadToolCallDiffs`、`currentTeammates`、`backgroundTasks` 等；文件编辑与待审集合由宿主传入，面板不自行拉取。
- 该文件 import 段（第 1–12 行）没有 `window.electron*`、没有 jotai、没有 `@nimbalyst/electron`。第 131 行注释明确：交互组件的 host 来自 `interactiveWidgetHostAtom(sessionId)`，不经 props 下传。
- 会话／工具类型来自 runtime 内部：[`types/index.ts`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/types/index.ts#L7) 直接 re-export `ai/server/types` 的 `SessionData` 与 `TranscriptViewMessage`，后者定义在 [`TranscriptProjector.ts#L58`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ai/server/transcript/TranscriptProjector.ts#L58)。复用面板必须一并接受这套投影类型。

## 二、RichTranscriptView 的耦合集中在四处

1. [`RichTranscriptView.tsx`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/RichTranscriptView.tsx) 2622 行；虚拟化用 `virtua` 的 `VList`（第 3、2488 行，`itemSize={90}` 第 2493 行）。
2. 滚动位置走 [`store/atoms/transcriptScroll`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/RichTranscriptView.tsx#L20) 的 jotai `store.get/set`。这是模块级状态，但读写入口只有 `setSessionIsAtBottom`／`getSessionIsAtBottom`／`cleanupSessionScrollState`，属可保留并由宿主写入的注册缝，不要求重写滚动逻辑。
3. 工具组件查表走 [`getCustomToolWidget#L275`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/index.ts#L275)，注册表版本由 `useTranscriptToolWidgetRegistryVersion`（`useSyncExternalStore`）订阅；注册表是模块级单例（[`BUILT_IN_TOOL_WIDGETS#L151`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/index.ts#L151)，加载时写入第 247 行），宿主可用 `setTranscriptToolWidgets` 注册或替换条目。
4. 只用 DOM 级 `window`：`getSelection`、`dispatchEvent('transcript:find…')`（第 607、1554–1572 行），不触碰 `window.electron`。逐条消息渲染委托 [`MessageSegment#L41`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/MessageSegment.tsx#L41)，该文件无 atom、无 host、无 `window.electron`。

## 三、交互 host 是 Jotai 原子注册，不是 prop 注入

- [`InteractiveWidgetHost#L137`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/InteractiveWidgetHost.ts#L137) 是纯接口：字段 `sessionId`、`workspacePath`、`worktreeId`、`autoCommitEnabled`；方法 16 个必选——`askUserQuestionSubmit/Cancel`、`requestUserInputSubmit/Cancel`、`exitPlanModeApprove/StartNewSession/Deny/Cancel`、`toolPermissionSubmit/Cancel`、`gitCommit`、`gitCommitCancel`、`setAutoCommitEnabled`、`superLoopBlockedFeedback`、`openFile`、`trackEvent`；12 个可选——`openPage?`、`feedbackRequestSend?`、`feedbackRequestCancel?`、`pickFeedbackDestination?`、`renderFeedbackArtifactPreview?`、`renderFeedbackArtifactPopover?`、`gitFileDiff?`、`sessionFileDiff?`、`setDiffPeekSize?`、`getAttachmentStagingGitignoreStatus?`、`retryAttachmentStaging?`、`openAttachmentSettings?`。
- 必选不等于都要实现：[`noopInteractiveWidgetHost#L405`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/CustomToolWidgets/InteractiveWidgetHost.ts#L405) 全部返回空操作并告警，是既有退化路径。git 相关（`gitCommit`／`gitCommitCancel`／`setAutoCommitEnabled`／`gitFileDiff?`／`sessionFileDiff?`）只有在注册 `GitCommitConfirmationWidget` 时才有实际调用；不暴露该工具时给空实现即可，不需要 Scholoom 实现提交与 diff。
- 注册面是 [`interactiveWidgetHostAtom#L31`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/store/atoms/interactiveWidgetHost.ts#L31)（`atomFamily`）＋ [`register#L51`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/store/atoms/interactiveWidgetHost.ts#L51)／[`unregister#L69`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/store/atoms/interactiveWidgetHost.ts#L69)；模块内 `Map<sessionId, Set<Host>>` 支持同一 session 多所有者。宿主只需遵守注册／反注册协议，不必实现面板内部逻辑。
- 消费者是各工具组件的 `useAtomValue(interactiveWidgetHostAtom(sessionId))`：`AskUserQuestionWidget`、`RequestUserInputWidget`、`ToolPermissionWidget`、`ExitPlanModeWidget`、`GitCommitConfirmationWidget`、`MemoryToolWidget`、`FileChangeWidget`、`VisualDisplayWidget`、`SuperLoopProgressWidget`、`PageUpdateWidget`、`FeedbackRequestComposeWidget`、`AttachmentStagingDeniedCard`。要提供的是这些方法背后自有内核的等价操作，且只需覆盖实际注册的工具。

## 四、输入 composer 完全在 Electron 侧

- [`SessionTranscript.tsx`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/electron/src/renderer/components/UnifiedAI/SessionTranscript.tsx) 2799 行，含输入框、队列、模式切换与 host 实现，`window.electronAPI` 出现 44 行（`ai:sendMessage`、`ai:cancelRequest`、`sessions:update-metadata`、`claude-code:answer-question`、`claude-code:answer-tool-permission`、`messages:respond-to-prompt`、`workspace:open-file` 等）。
- 第 20 行从 `@nimbalyst/runtime/store` 导入 `registerInteractiveWidgetHost`／`unregisterInteractiveWidgetHost`；第 1779 行起用 `liveHostRef` + 稳定 proxy 暴露 host（第 2183 行起），方法体逐个转到 Electron 实现（第 1796–2172 行）。交互能力的落点全部是 Electron IPC。
- runtime 内唯一输入组件是 [`ui/AIInput/AIInput.tsx`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AIInput/AIInput.tsx)（移动端简化版，props 驱动）。可复用的输入只有 props 级简化件，没有能直接接内核的完整实现。

## 五、流式累积器位置与语义未变

- [`TranscriptStreamAccumulator#L78`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/electron/src/renderer/store/transcriptStreamAccumulator.ts#L78) 位于 **Electron renderer store**，不在 runtime；无 React、无 jotai，靠 `emit`／`readDbMessages`／`schedule` 三个注入点工作；可评估抽取到工作台消息投影模块，但仍依赖 Nimbalyst 的事件与 TranscriptProjector 类型，不能由注入点直接推断整体迁移已可行。
- 语义与快照一致：纯文本 chunk 走 [`canPatchInPlace#L228`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/electron/src/renderer/store/transcriptStreamAccumulator.ts#L228) + [`applyTextPatch#L253`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/electron/src/renderer/store/transcriptStreamAccumulator.ts#L253) 的局部 O(1) 打补丁；结构性变化标记整轮重投影；[`sessionStateListeners.ts#L73`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/electron/src/renderer/store/sessionStateListeners.ts#L73) 第 89–92 行用 `requestAnimationFrame` 调度，即每帧最多一次 atom 写入。这是源码结构事实，不等于实测性能。

## 六、SessionData 换自有后端的必要适配

以 [`SessionData#L421`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ai/server/types.ts#L421) 与 [`TranscriptViewMessage#L58`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ai/server/transcript/TranscriptProjector.ts#L58) 为准：

1. **必填字段**：`id`、`provider`、`createdAt`、`updatedAt`、`messages`。每条 message 需要数值 `id`、`sequence`、`createdAt: Date`、`type ∈ {user_message, assistant_message, system_message, tool_call, tool_progress, interactive_prompt, subagent, turn_ended}`（[`types.ts#L13`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ai/server/transcript/types.ts#L13)）。Scholoom 的 JSON-RPC 消息必须自建投影层，这是接入无法回避的一步。
2. **工具消息形状**：`toolCall` 子对象要求 `toolName`、`toolDisplayName`、`status: running|completed|error`、`description`、`arguments: Record<string, unknown>`、`targetFilePath`、`mcpServer`、`mcpTool`、`progress[]`、`providerToolCallId`。自有结构化产物要用 `arguments`／`result` 表达，或注册新 widget 消费自有形状。
3. **编码产品遗留字段**：`worktreeId/worktreePath/worktreeProjectPath`、`branchedFromSessionId/branchPointMessageId`、`providerSessionId`、`lastDocumentState` 假设 git worktree 与分叉会话模型。Scholoom 的任务／Agent／会话关系无法直接落位，可留空；留空后文件跳转与工作树相关 UI 会失效，需确认这些 UI 是否仍注册。
4. **无类型断言的耦合**：`sessionData.metadata?.sessionStatus` 与 `metadata?.currentTeammates` 在面板内被 `as string` 直接断言后使用，键名变化不会报错、只会渲染空白；改造 metadata 时需同步核对面板与 `RichTranscriptView` 两处。
5. **流式复用前提**：累积器用 `transcriptGeneration` 做世代隔离；若要沿用每帧合批，适配层需保持其世代隔离语义；世代可由客户端投影层维护，不要求内核协议直接采用该字段，具体映射仍待核对。
6. **附件／材料模型**：[`ChatAttachment#L114`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ai/server/types.ts#L114) 强制 `filepath`、`mimeType`、`size`、`type: 'image' | 'pdf' | 'document'`，渲染只做缩略图与点击放大（[`MessageSegment#L420`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/MessageSegment.tsx#L420)）。Scholoom 的文献条目多为 id／远程 URI，需要额外引用层，不能塞进 `filepath`。

## 七、论文／材料／任务关系的现状与缺口

| 关系 | 上游现状与依据 | 接入 Scholoom 的缺口 |
| --- | --- | --- |
| 任务 | tracker issue 模型：`TrackerToolWidget` 依赖 `@nimbalyst/tracker-schema` 的 `DEFAULT_TRACKER_TYPE_COLORS`；`MarkdownRenderer` 用 `trackerIssueKeyPrefixesKeyAtom` + [`TrackerReferenceChip#L635`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/components/MarkdownRenderer.tsx#L635) 把 `KEY-123` 形式的字符串渲染成 chip | 任务是“issue key 字符串 + 前缀配置 + 插件 atom”。Scholoom 的任务、Agent、会话是三类身份，需要自己的 chip 组件与 atom 填充，不能沿用 issue key 表达 |
| 会话／多 Agent | [`sessionRefMapAtom#L42`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/session/sessionRefAtoms.ts#L42) + `SessionReferenceChip` + `CrossSessionToolWidget`（`spawn_session`、`send_prompt`、`get_session_result` 等） | 语义最接近 Scholoom 的多会话／多 Agent，可作形状参考；跳转靠 [`openSessionReference#L66`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/session/sessionRefAtoms.ts#L66) 派发 `open-ai-session` 窗口事件，须由宿主接管 |
| 材料／文献 | 无文献实体组件；只有附件缩略图、`readFile` 打开本地文件、`MemoryToolWidget` 把知识库命中渲染成标题＋摘要 | 上游没有“文献—论点—证据”关系组件，材料关系按 Scholoom 已确认模型投影，组件可沿用展示壳和注册接口，但不能直接沿用附件路径表达文献身份 |
| 论文产出 | `PageUpdateWidget`（`applyCollabDocEdit`）、`EditorScreenshotWidget`、`ZoomableImageSurface`、`FileEditsSidebar`／`ToolCallChanges` 面向页面快照与文件 diff | 面向代码 diff 与文档快照；稿件产出的呈现需另定，且这些组件多经 `host.openFile`／`openPage` 落到宿主 |
| Markdown 扩展点 | [`TranscriptMarkdownContribution#L45`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/src/ui/AgentTranscript/contributions/TranscriptMarkdownContributions.ts#L45) 提供 `remarkPlugins`／`rehypePlugins`／`components`／`styles`，`MarkdownRenderer` 第 620 行合并；内建只识别文件路径、tracker 引用、会话引用三类 autolink | 文献引用 autolink 是新增能力，走 contributions 注册即可，不必改组件本体 |

## 八、可提取层次与全局依赖

| 层次 | 组件 | 依赖性质 |
| --- | --- | --- |
| 纯展示叶组件 | `InteractiveWidgetChrome`、`ReorderList`、`DiffViewer`、`JSONViewer`、`TranscriptSearchBar` | 只依赖 react 与 `@dnd-kit`／react-syntax-highlighter 等库。`collab-client` 已跨包复用前两者（[`FeedbackRequestRespond#L40`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/collab-client/src/feedback-ui/FeedbackRequestRespond.tsx#L40)），是既有先例 |
| 有全局依赖的叶组件 | `MarkdownRenderer`（读 `sessionRefIdsKeyAtom` 与 tracker 前缀 atom）、`SessionReferenceChip`（读 `sessionRefMapAtom`、派发 `open-ai-session`） | 宿主填充 atom 并监听事件即可，属注册缝 |
| 中枢组件 | `AgentTranscriptPanel`（props 面干净）、`RichTranscriptView`（滚动 atom、模块注册表、`virtua`） | 需提供滚动状态写入与工具注册表条目；虚拟化参数可沿用 |
| 交互能力 | `InteractiveWidgetHost` 必选 16 项 | 只为实际注册的工具提供真实实现，其余走 noop |
| 样式 | 组件使用 `bg-nim-*`／`text-nim-*` 等 Tailwind 类与 `--nim-*` CSS 变量 | 变量与构建配置定义在 runtime 主题样式与仓库根 [`tailwind.config.ts`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/tailwind.config.ts)，外部消费需自备等价主题变量与扫描范围 |

## 九、许可与“可独立安装”证据

- 仓库 [LICENSE#L1](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/LICENSE#L1) 为 MIT（Nimbalyst Inc., 2024-2026）；[LICENSING.md#L3](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/LICENSING.md#L3) 声明本仓库 MIT，仅协作同步服务为独立项目。MIT 允许复制与修改，附保留版权与许可声明的义务。
- 但 [`packages/runtime/package.json#L4`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/runtime/package.json#L4) 为 `"private": true`，`files` 仅 `dist`／`dist-node`，第 89 行的 `./ui/AgentTranscript` 导出指向 `./dist/...`；registry 探测 `https://registry.npmjs.org/@nimbalyst/runtime` 返回 404，未发布，无法 `npm install` 得到。
- 本轮核对到已发布的 [`@nimbalyst/extension-sdk`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/extension-sdk/package.json)（registry 200，latest 0.6.0，MIT，`publishConfig.access: public`），其 `dependencies` 为空且 [`externalsPlugin.ts#L73`](https://github.com/nimbalyst/nimbalyst/blob/ee725240ecbd1bc400337eaa69d94efd5367e763/packages/extension-sdk/src/externalsPlugin.ts#L73) 把 `@nimbalyst/runtime/*` 标为外部依赖，由宿主应用提供。`@nimbalyst/cli`、`@nimbalyst/electron` registry 均为 404；发布工作流只有 `publish-cli.yml`、`publish-extension-sdk.yml`，均手动触发。
- 结论性事实：面板代码在 MIT 下可复制，但不存在独立安装的官方 npm 组件包，可用路径只有 vendored 源码或从宿主构建 `dist`。

## 十、与已有参考快照（9f13b2794）的差异

`git diff --stat 9f13b2794..ee725240` 在 AgentTranscript／store／累积器／runtime package.json 范围内只触及 10 个文件（+456/−46，来自 `567df78ac`、`8e174c9b1`）：新增 `PageUpdateWidget`（132 行）与测试并注册 `applyCollabDocEdit`，`InteractiveWidgetHost` 增加**可选** `openPage?(uri)`；`ZoomableImageSurface`（+153）改为整窗放大，`EditorScreenshotWidget`、`TrackerToolWidget`、`VisualDisplayWidget` 随之微调。与本报告结论相关的文件**逐字节相同**：`AgentTranscriptPanel.tsx`、`RichTranscriptView.tsx`、`MessageSegment.tsx`、`MarkdownRenderer.tsx`、`shared/InteractiveWidgetChrome.tsx`、`shared/ReorderList.tsx`、`session/sessionRefAtoms.ts`、`store/atoms/interactiveWidgetHost.ts`、`transcriptStreamAccumulator.ts`、runtime `package.json`。主 Agent 从快照得到的边界描述在当前固定点依然成立。

## 十一、未核对内容

- 未执行 `npm ci`／`npm run build`，未验证 runtime 的 `dist` 产物能否在干净项目里通过 `./ui/AgentTranscript` 子路径被解析。
- 未核对 Electron preload 暴露面与 channel 名单，未核对 `RemoteSessionTranscript.tsx`（337 行）、`SessionTranscriptPeek.tsx` 的 host 差异。
- 未核对 `collab-bundle/types/internal/runtime/src/ui/AgentTranscript` 类型镜像是否与源码同步；未核对 iOS／Android 宿主的主题与打包方式（仅确认它们 import 面板并传 noop host）。
- 未核对 `TranscriptProjector` 投影规则细节、`virtua` 在长会话下的实际表现，也未核对商业授权或商标条款。

以上只说明当前固定点的边界。把面板或工具组件用于 Scholoom 时，仍需自建消息投影层、按实际注册的工具提供 host 实现、填充会话与 tracker 类 atom、注册文献引用扩展点，并处理 worktree、附件路径等编码产品遗留字段。
