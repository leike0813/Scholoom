# Agent 交互面板与前端模块复用调查

调查日期：2026-10-04。关联 [#12 技术栈](../issues/12-technology-stack.md)。用户要求 Q2 从开源模块复用出发调研，并指出 Paseo 的 UI 值得参考。用户已采纳本调查建议的 TypeScript＋React DOM、assistant-ui 通用交互底座与 Paseo 面板体验参考方向；正式选择见 #12，Vite 和其他工具链继续讨论。

## 评价对象

本调查比较 Paseo、assistant-ui、AionUi、OpenCode 和 Nimbalyst 的现成模块，区分三种交付形态：可消费组件包、需抽取的应用源码、交互和视觉参考。界面完成度与接入成本分别判断；技术栈选择依据能复用的真实模块。

选定范围是 Agent 面板及其与工作台的衔接，不把候选产品的后端、数据库或任务模型默认为 Scholoom 的依赖。已确认的 Node 内核、双向 JSON-RPC＋本地 WebSocket 和科研模型是接入前提。

## Scholoom 对接要求

依据 [#10 工作台组织](../issues/10-workbench-interaction.md)、[#17 核心模型](../issues/17-native-research-capability-model.md)、[#18 执行契约](../issues/18-native-capability-runtime-and-content.md)和 [#09 架构](../issues/09-electron-architecture.md)。

| 需要复用的交互 | 必须保持的本项目语义 |
| --- | --- |
| 交流输入、附件、材料标签、流式消息 | 发送目标任务、接收 Agent 和附加材料明确；切换布局保留草稿 |
| 工具调用、执行详情、结构化结果 | 工具输出可查看和打开，实际产物与完成状态由内核提供 |
| 提问、审批、取消与重连 | 待处理请求可跨客户端找回；答复由内核应用一次，断线不取消任务 |
| 多会话和 worker 展示 | 任务、Agent、会话分别可访问，不用一个聊天线程替代全部领域身份 |
| 文件／来源链接与嵌入产物 | 支持稿件、文献与证据定位，适配宿主打开对象的接口 |
| 长会话与高频流式更新 | 按会话／窗口读取与更新，有界投影、懒加载或虚拟化；源码措施不等于实测达标 |
| 组件主题和布局 | 支持 Agent／文献／写作／审查布局；无需照搬编码产品的 Git／worktree 导航 |

## 判断“方便复用”的依据

1. 找到实际模块入口、公开参数和可替换宿主接口。
2. 追踪模块对状态管理、会话类型、传输、全局 bridge、主题和平台 API 的依赖。
3. 列清直接采用的包或源码、必须修改的调用与需新增的 Scholoom 适配。
4. 检查许可声明、来源固定点和升级维护方式。
5. 不以都是 Electron、React 或支持 LangGraph 推断可直接接入；不以 stars、截图或厂商速度描述判断可复用性和性能。

## 证据与结论状态

源码事实调查已完成，本文件汇总接入边界和选型依据；用户采纳的 Q2 方向集中记录在 #12。仅进行官方资料和静态源码调查，未安装候选依赖、启动应用、完成集成或性能实测。

## 主 Agent 已核对的接入前提

- Paseo 当前固定点为 `5285b7e502714f2d08a220c328aedca3b9637b94`。[desktop package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/desktop/package.json) 明确桌面壳采用 Electron；[app package](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/packages/app/package.json) 的客户端是 Expo／React Native／React Native Web，并依赖本项目 client／protocol。不能由 Electron 壳推断内部面板是可直接导入的普通 React DOM 组件。
- 主 Agent 查看了 [Paseo README](https://github.com/getpaseo/paseo/blob/5285b7e502714f2d08a220c328aedca3b9637b94/README.md) 所链的官方 `hero-mockup.png`。图中会话导航、中央交流及输入、右侧文件／变更检查可以作为视觉参考；图为官方展示材料，没有在本机运行 Paseo，也未据截图推断完整行为或组件边界。
- assistant-ui 的 [ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store) 明确由宿主提供消息、状态和回调，保留宿主自己的格式和状态管理；发送、取消、工具结果和多线程等操作按具体 adapter 接入。因此它提供了可对接自有内核的公开界面接缝，但消息映射、请求恢复和后台状态仍需本项目实现。
- assistant-ui 的 [LangGraph runtime](https://www.assistant-ui.com/docs/runtimes/langgraph/overview) 则直接使用 LangGraph SDK 与 API server。Scholoom 已选择 LangGraph 执行基础，但对外是本项目 JSON-RPC 协议，不能据此直接采用这个 runtime 并声称完成接入。
- Nimbalyst 已有本地快照 `9f13b2794d6d37ab005af6302cfe2a8540cfcdb6`：[runtime package](https://github.com/nimbalyst/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/runtime/package.json) 将 AgentTranscript 单独导出，包为 private。消息面板以 props 输入会话，但内部仍引用自有会话／工具类型和交互 host atoms；当前上游版本差异由独立源码事实报告核对。导出路径不自动构成可独立安装的轻量组件包。

## 五个候选的比较

以下“成本”是根据源码依赖和公开接口的判断，没有用实际移植工时衡量。候选固定点、路径和详细证据见 [Paseo 报告](paseo-agent-ui-source-facts.md)、[三个替代候选报告](agent-ui-alternative-source-facts.md)和 [Nimbalyst 报告](nimbalyst-agent-ui-source-facts.md)。

| 候选 | 前端与交付形态 | 实际可复用的内容 | Scholoom 接入工作 | 本轮判断 |
| --- | --- | --- | --- | --- |
| assistant-ui，MIT | React DOM；公开 runtime／组件包，加可复制到本项目的 registry 组件源码 | Thread、Composer、消息 parts、Markdown、附件、工具折叠组、标准审批及自定义 renderer 接口 | 新增外部 store adapter；映射消息、发送、取消、审批、材料；长会话另做有界读取与显示 | 通用交互底座首选，外部内核接口最明确 |
| Paseo，Apache-2.0 | Electron 壳＋Expo／React Native Web 客户端；Agent UI 在 private app 内 | 成组提取消息／工具行、Web 虚拟滚动与历史锚点逻辑；完整输入区、工作台组织也有源码 | 保留 RN Web 技术链或移植到 DOM；替换 session store／daemon 协议、权限、附件与工作区操作 | 工作台体验参考优先；整块面板移植成本较高，需用户选择是否承担 |
| Nimbalyst，MIT | React DOM；private runtime 导出 AgentTranscript，完整桌面输入区在 Electron 包 | props 驱动的 transcript、virtua 列表、工具注册表、交互 host；JSON／diff／交互卡壳等叶组件 | 消息投影、host 注册、Jotai 会话状态、主题；完整 composer 另行抽取；科研材料身份需扩展 | 若希望整块源码迁入，比 Paseo 更接近 React DOM；不宜整体带入 runtime |
| AionUi，Apache-2.0 | Electron／React；完整应用源码 | 消息 renderer、权限卡、历史分页／锚点、增量合并逻辑 | 替换应用消息类型、IPC、conversation 身份、context 与 Arco 主题 | 可按具体模块复用，本轮未发现优于外部 store adapter 的接入边界 |
| OpenCode，MIT | 当前固定点桌面为 Electron，前端 Solid；通用 UI 包可发布，session-ui 为 private | 工具／消息展示、permission dock、虚拟 timeline、高频事件合并 | 接受或移植 Solid；替换 OpenCode SDK、事件及消息 schema、store 和审批模型 | 可研究具体模块；作为当前整体底座会增加框架及协议迁移范围 |

许可证栏仅记录根声明，不能代替纳入代码、字体、图标和其他资源时的逐项核对。AionUi 只核对了指定 commit 的官方 tree 和相关 raw 源码，未完成全仓归档扫描。

## 建议的 Q2：React DOM＋assistant-ui，按模块吸纳应用源码

建议自有应用代码采用 TypeScript，工作台选择 React DOM，Agent 通用交互采用 assistant-ui 的公开外部 store 接口。判断依据是可保留的组件及其边界，而不是预先选好 React 后再找佐证。Vite 仍是客户端构建候选；Agent 面板调查不决定 Electron 打包、包管理器和整个仓库工具链。

复用可以分为三块：

1. **直接采用通用交互模块。** 用 `@assistant-ui/react` 的 runtime／primitives，采用官方 registry 的 Thread、Composer、Markdown、Attachment、ToolFallback、ToolGroup 等组件源码并调整布局与主题。依赖包保留库升级入口；复制到本项目的组件由本项目维护。无需另写流式消息、输入操作、附件区和工具折叠框架。
2. **保留用户喜欢的 Paseo 面板组织。** 按会话导航、交流／执行过程和右侧材料／产物检查来组织 Agent 工作区，服从 #10 已确认的四种布局。对 Paseo Web 历史窗口、阅读锚点和虚拟滚动源码继续按模块评估，只有需要且能隔离边界的部分才抽取。通用底座选 assistant-ui 不意味着采用它默认的整页视觉。
3. **科研和产物组件按具体缺口补充。** 文献、证据定位、稿件和任务／Agent／会话关系由 Scholoom 定义。Nimbalyst 的交互卡壳、JSON／diff 视图等作为可抽取候选；先查看底座和本项目已用组件是否满足，避免为单个展示组件引入其完整状态体系。

这是实际复用方案：消息、输入、附件和工具 UI 使用现成实现，专有领域与共同内核接入由本项目承担。并不承诺五个仓库各取一块，也没有把所有候选都列为依赖。

### 接入边界

```text
Scholoom Node 内核（持久任务、会话、审批、执行与产物权威）
  ⇄ 已确认的共同客户端：双向 JSON-RPC＋本地 WebSocket
  ⇄ 工作台按会话读取的状态与消息投影
  ⇄ assistant-ui ExternalStoreAdapter
  ⇄ 现成 Thread／Composer／Tool UI＋科研 renderer
```

适配器只解释界面操作和投影，不成为第二套 Agent 执行引擎。具体对接点依据固定版本的 [ExternalStoreAdapter](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/core/src/runtimes/external-store/external-store-adapter.ts)：

| Scholoom 操作或状态 | 现成入口 | 本项目需要负责的语义 |
| --- | --- | --- |
| 消息及执行状态 | `messages`、`convertMessage`、`isRunning`、`isLoading` | 保留稳定身份，增量投影当前会话；非文本执行活动也反映在状态中 |
| 发消息、停止 | `onNew`、`onCancel` | 明确任务、接收 Agent、会话与材料；内核接受／拒绝与取消结果驱动 UI |
| 工具和审批 | tool renderer、`onRespondToToolApproval` | 使用内核请求 ID，待处理／已答复状态以回执更新；普通 tool result 不替代审批 |
| 附件及科研材料 | attachment adapter、自定义 data／tool renderer | 文件和文献／证据引用分别映射，保留材料身份与宿主打开操作 |
| 会话切换和导航 | 外部 thread list 或本项目导航 | thread 对应会话；任务与 Agent 单独建模，草稿和当前会话状态隔离 |
| 恢复与历史 | 本项目客户端、状态层、列表组件 | 恢复 pending requests、补取历史、处理断线和事件顺序，保持有界读取和 DOM |

库的 [Thread 源码](https://github.com/assistant-ui/assistant-ui/blob/1f77d04435f71476172a6d1ffca871da1a0c933a/packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx)允许替换消息、工具组和嵌套对话展示。`TaskGroup` 是该库的工具嵌套对话展示槽，不等于 Scholoom 的长期研究任务。默认 ExternalStoreRuntime 的客户端工具执行开关为关闭，适合内核负责实际执行的边界。

标准 ToolFallback 有审批选项接口，但复杂的科研授权／表单仍需自定义卡片。现有 thread list／repository 等部分接口标为 unstable；使用时需固定发布版本并把相关依赖收在适配模块中。不能把支持 LangGraph 的专用 adapter 当作本项目协议适配器。

### 备选：整块迁入 Paseo 面板

如果用户更重视保留 Paseo 已有完整交互，另一条可行方向是固定其源码基线，成组迁入 AgentPanel、transcript 和 composer，并接受 Expo／RN Web 相关技术链。随后将 daemon client、会话状态、材料和审批替换为 Scholoom 适配接口；也可移植为 DOM，但移植范围更大。

这条路线在源码层面可讨论，未证明工程成本无法承受。它与上面的建议取舍不同：保留完整产品交互更多，承担的应用依赖与升级维护也更多。无需为了兼容现成 UI 而让内核模拟整个 Paseo daemon。

## 结论能够支持到哪一步

本轮足以形成 Q2 的选型建议，并指出真实复用模块和接入缝；不足以声称面板已经独立可运行、审批恢复已经正确或性能已经达标。没有做原型，也没有更改应用代码、依赖或构建配置。

如果之后进入已批准的实现或限定原型，验证只需围绕接入边界：一个真实会话完成发送／流式工具／审批／取消；换会话保留草稿；断线后找回 pending request 且内核只接受一次；大量历史与高频更新下读取和 DOM 有界；材料及产物能打开到本项目对象。通过这些行为即可决定是否采用，不扩展到重新验证候选整套 Agent 后端。

Q1 项目许可、Q2 本轮建议方向和 Q3 开发平台已确认；阅读／写作组件、数据库访问、包管理／打包和目录结构继续在 #12 后续问题中选择。
