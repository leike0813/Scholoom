# 多 Agent 交互系统初设：subagent、跨会话协作与 A2A

Labels: wayfinder:decision
Status: resolved
Assignee: Codex；主 Agent 与用户讨论（2026-10-14）
Parent: [产品与工程基础决策地图](../map.md)

## Question

在统一内置 harness 和统一会话模型下，如何组织 subagent 委派、已有会话之间的主动协作与 advisor？A2A 是否适合作为内部机制或外部互操作协议？

## Answer

2026-10-14，用户选择“Agent 按工作需要定向联系其他会话，收件后有界唤醒处理”，随后确认：“可以，先按你的建议作为初设方案，具体的问题等到实现中再探索打磨吧。”本票保存采纳的初设，具体字段、SDK 接线与参数在实现中验证和打磨；resolved 表示本轮方向讨论收束，不表示接口或实现已完成。

### 统一执行基础与三种协作关系

内部协作沿 [#07](07-agent-runtime-boundaries.md)共用 LangGraph／LangChain／Deep Agents 运行基础，支持不同角色和模型。内部 subagent 与同一内核内的跨会话通信使用原生机制；对外采纳 MCP、A2A 后置，沿[对外接口决议](../../runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)。

| 关系 | 用途 | 管理与上下文 |
| --- | --- | --- |
| subagent 委派 | 分头阅读、计算、生产与独立审查 | 委派方管理该次子执行，按工作包提供上下文并校验交付 |
| 已有会话间协作 | 定向提问、请求处理、转交工作和通知成果 | 双方保有各自会话，通信本身不授予接管、取消或改写对方上下文的权力 |
| advisor 持续参与 | 文风监督等已确认用途 | 接收指定范围的上下文增量，沿 [#37](37-multi-model-research-collaboration.md)的触发、有限等待与停止规则运行 |

三种关系共用身份、授权、消息、执行和产物设施，差异集中在管理责任、上下文供给与触发方式。角色是可复用配置，模型是执行选择，会话承载交互上下文，执行记录实际工作。父子关系挂在委派及其执行上，不把所有会话组织为永久树形层级。

沿 [#43](43-free-agent-conversation-and-research-tasks.md)，会话不分类型、不绑定研究任务；发送消息、委派和唤醒不强制创建研究任务。工作包按实际业务关系附带任务或能力调用引用，不能用自动建任务填补通用运行接口。

### subagent 工作包与交付

复用 [#18](18-native-capability-runtime-and-content.md)的工作包，提供目标、初始材料、可用方法与工具、有效授权、交付要求及检查标准。委派不能扩大调用方已有授权；任务相关工作继续受任务授权约束。

短时 subagent 可使用独立子图执行上下文，需要持续追问或后台收件时使用可持续的会话上下文，两者共用运行基础；独立子 Agent 与 advisor 执行的 OS 进程隔离沿[进程决议](../../runtime-architecture/issues/03-session-execution-processes.md#answer)，不能仅用同进程子图替代。具体持久化方式和工作台组织在实现中核对，不要求每次短时委派创建独立的用户会话。

上下文按职责供给：普通执行者取得工作说明、必要材料和约束，并可继续获授权检索；独立初审读取原始材料与标准，不预先注入其他审阅者结论；advisor 取得当前有效写作上下文及后续增量，沿 #37 处理。

结果返回实际产物引用、发现、未完成项与障碍。子执行结束、产物可用、整体研究任务完成分别判断；主 Agent 对交付进行检查。工作台可将子执行折叠呈现在委派方下，具体交互随实现验证。

### 跨会话通信与消息消费

采用持久收件箱、执行边界消费与有界唤醒的初设。Agent 可发现获授权的协作对象、发送请求或通知、回复并查询处理情况；生命周期控制复用 harness。具体操作名、字段及存储 Schema 留到实现规格。

消息保留发送方身份、目标、请求／回复关联、正文与材料引用。另一 Agent 的来信必须能辨认来源，不作为用户指令提升权限；接收方不能以自身较高权限绕过请求原有授权。材料读取与外发继续沿共同授权规则。

| 状态面 | 含义 |
| --- | --- |
| 已受理 | 消息已经可靠保存 |
| 已消费 | 接收方执行已经纳入该消息 |
| 请求结果 | 完成、拒绝、待补充或仍在处理等实际结果 |

消息已消费不代表请求已完成，通知也不代表 Agent 已消费。恢复允许重新投递，消费记录与必要的操作去重配合；消息或 checkpoint 不承诺外部副作用恰好执行一次。高代价或难以重复的操作沿既有恢复规则先核查实际效果。

通知通常无需回复；请求应有明确答复、拒绝或待补充状态。回复与状态更新不自动触发新的往返请求，避免持续互相唤醒。

### 有界唤醒与用户控制

| 接收方状态 | 初设行为 |
| --- | --- |
| 正在执行 | 来信排队，在下一可处理边界消费，不并发改写同一会话状态 |
| 空闲且允许自动协作 | 合并待处理消息，启动一次受应用级并发、时长与调用上限约束的执行 |
| 等待协作答复 | 对应回复可恢复后续工作，其他消息仍按执行边界处理 |
| 用户明确暂停或停止 | 保留消息并显示待处理，不因来信自动恢复 |
| 已关闭或归档 | 返回可诊断结果，不静默创建替代会话 |

唤醒使用接收方已配置的模型与有效授权，沿 [#22](22-model-data-and-execution-policy.md)统一资源上限和显式模型切换政策。取消自己委派的执行与取消其他会话是不同权限。委派方负责子执行收尾，后台继续需显式移交宿主管理；停止默认覆盖委派链，advisor 沿已有有限等待规则。生命周期及应用准入沿[进程决议](../../runtime-architecture/issues/03-session-execution-processes.md#answer)，等待、回收与停止的具体接线在实现中验证。

### 工作区承接与并发修改

消息用于协商和传递引用；分析依据、决定、成果与必要处理理由沿 [#35](35-research-workspace-context.md)保存到工作区。当次协作可以共享获授权上下文，长期科研承接不依赖旧 transcript；两者职责不同。

例如写作会话请求分析会话核查统计结果：接收方读取当前数据、保存核查依据并回复引用，写作方消费答复后核对当前稿件并修改。两个会话结束后，核查材料仍可供后续工作读取。

通信不替代 [#13](13-storage-and-change-model.md)的局部覆盖保护。多个会话可以操作同一对象，应用前读取当前内容并调整相关修改；会话间协作不引入对象独占或所有普通修改的全局事务机制。

### A2A 的位置与取舍（后置参考）

A2A 适合独立 Agent 系统间的能力发现、消息、长任务状态、补充输入与产物交换。内部已有共同执行基础，直接使用原生机制更便于保持执行控制；采用 A2A 仍需实现本项目的授权、收件消费、调度、恢复和科研交付检查。

优先考虑的外部用途是让外部系统调用 Scholoom：提交受授权科研请求、取得稳定操作引用、查询进展、补充输入并获取产物。对外采纳 MCP；A2A 本阶段不提供，待出现明确使用其标准 Agent 发现或任务交互的实际对接对象时再增加适配，决定见[对外接口决议](../../runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)。本节 A2A 内容仅作后置参考，不代表已采纳服务或首批建设范围。

Scholoom 调用外部 Agent 的范围须另定。受限的远端能力调用与第三方 harness 接管原生流程分别评估；本票不改变 #07 的统一内置执行边界。

| A2A 概念 | 建议映射 |
| --- | --- |
| Task | 一次对外操作，可包含多次内部执行尝试，不直接等同于持续研究任务 |
| contextId | 外部交互的关联上下文，不天然等于项目或内部会话 |
| AgentSkill | 对外能力描述，不等于本地 SKILL.md 方法包 |

按本轮核对的 v1.0.1 规范，发送消息幂等性是可选能力，关键消息不能依赖流式通知可靠送达，取消未必成功，终态 Task 不能继续收件。对外入口应明确实际保证，不从协议名推导共享 checkpoint、远端恢复或成果验收。

## 实现中探索与验证

后续实施沿 OpenSpec 将对应范围的初设细化为契约，优先复用 Deep Agents／LangGraph 的现成能力。进程与子执行寿命以[进程决议](../../runtime-architecture/issues/03-session-execution-processes.md#answer)为准；具体操作名、Schema、存储和 checkpoint 的配合、消息消费及副作用恢复、唤醒合并与限额、advisor 接线和工作台状态随实现打磨。局部选择无需重开已采纳方向，实质改变方向时回到讨论。

用并行阅读、跨会话核查、advisor 三类场景验证；同时覆盖停止后收件、运行中来信、重启后恢复和当前材料变化，核对授权、实际保存、消息消费及交付状态。A2A 待明确实际对接需求后验证互操作。

本轮仅完成仓库决议与文档阅读、上游源码及官方规范静态核对；未运行协作原型、科研模型或 A2A 互操作，也未启动业务实施。

## 调查依据

- 项目依据：[#07](07-agent-runtime-boundaries.md)、[#13](13-storage-and-change-model.md)、[#18](18-native-capability-runtime-and-content.md)、[#22](22-model-data-and-execution-policy.md)、[#25](25-harness-business-integration.md)、[#35](35-research-workspace-context.md)、[#37](37-multi-model-research-collaboration.md)、[#43](43-free-agent-conversation-and-research-tasks.md)及 [接口草案](../../../docs/module-interfaces.md)。
- [A2A v1.0.1 发布](https://github.com/a2aproject/A2A/releases/tag/v1.0.1)与[规范正文](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)：本轮 2026-10-14 查询官方最新发布并核对 §3.1、§3.3、§3.7 等操作及可靠性约定。
- Deep Agents JS 固定源码 `9f3bfd5529ef9df65158c609f6590f1127b56416`：[普通 subagent](https://github.com/langchain-ai/deepagentsjs/blob/9f3bfd5529ef9df65158c609f6590f1127b56416/libs/deepagents/src/middleware/subagents.ts)、[异步 subagent](https://github.com/langchain-ai/deepagentsjs/blob/9f3bfd5529ef9df65158c609f6590f1127b56416/libs/deepagents/src/middleware/async_subagents.ts)。异步实现使用 LangChain Agent Protocol 的远端 thread/run，并非 A2A；仅作为复用候选，不把它视为本地 daemon 的完整方案。
