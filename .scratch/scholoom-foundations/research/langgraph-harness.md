# LangGraph 系列与现有科研契约的职责核对

调查日期：2026-10-03。用户已选择 LangGraph 系列作为执行基础，任务组织与多 Agent 协作参考 zotero-agents、ResearchSpec。本笔记核对职责和后续决策依据；没有安装依赖、运行原型或选择具体版本。

## 官方资料

- LangGraph 是底层 Agent 编排运行时，可混合确定性步骤与模型驱动步骤，提供持久执行、流式事件和人类介入能力；LangChain 提供模型、工具和 Agent 循环抽象；Deep Agents 在其上提供通用 harness 能力。LangGraph 可独立使用。依据：[JavaScript LangGraph 概览](https://docs.langchain.com/oss/javascript/langgraph/overview)。
- LangChain 的 `createAgent` 可配置模型、工具、提示与 middleware；Deep Agents 是在这些能力之上组合的 harness。依据：[JavaScript LangChain Agents](https://docs.langchain.com/oss/javascript/langchain/agents)。
- Deep Agents 有 JavaScript 入口，提供文件上下文管理和隔离子 Agent 等能力；当前文档将结构化待办规划与 Skills 列为按需启用能力。默认通用子 Agent 的行为需要结合 ResearchSpec 的 worker 契约配置，不能仅以框架默认配置推断符合科研授权规则。依据：[JavaScript Deep Agents 概览](https://docs.langchain.com/oss/javascript/deepagents/overview)。
- Deep Agents 的文件工具通过可替换 backend 操作，支持自定义 backend 和权限策略。默认 StateBackend 是 thread 范围的文件状态；应按 Scholoom 的资源所有权契约选择实际承载。依据：[Deep Agents Backends](https://docs.langchain.com/oss/javascript/deepagents/backends)。
- LangGraph checkpointer 保存 thread 的图状态；store 可保存跨 thread 的应用数据。内存 checkpointer 不能跨进程重启保留状态；具体持久化实现与版本仍待存储和技术栈决策。依据：[LangGraph Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)。
- `interrupt` 通过保存状态等待外部输入，恢复时会重新执行所在节点；中断前的副作用可能重复。文档建议使用可重复执行的操作或将副作用分离。将副作用放在中断之后，并不提供跨进程故障与外部资源的一般事务保证。依据：[LangGraph Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)。最后一句是对其机制适用范围的判断。

## 本地参考中的现有职责

以下内容来自参考快照，本次未重新审计两个个人项目的最新源码。

### zotero-agents

- 工作流内容包声明输入、参数、资源要求、后端与产物；通用执行外壳负责输入准备、资源供给、后端执行、取消、结果应用与终态解析。
- 工作流宿主能力通过明确投影提供；交互与非交互形态保持同一契约，对实际需要交互的调用返回结构化结果。
- 后端协议、运行身份、取消、恢复事实和可观测性分别表达，预设配置不保证能力对等。

依据：[工作流引擎与执行](../../../references/zotero-agents/06-工作流引擎与执行.md)、[Agent 后端与运行时](../../../references/zotero-agents/07-Agent后端与运行时.md)。

### ResearchSpec

- Navigate 按需发现和加载 Procedure；普通持续任务可以直接交付项目文件，仅在需要正式控制时建立受控研究流程图。
- worker 分 executor 与 reviewer，执行限定 packet，写声明的普通输出，返回产物、检查结果和 blocker。worker 不直接调用正式状态 mutation、询问用户、选择模型或继续委派。
- 主 Agent 校验 worker 结果后请求程序推进。CLI 控制模块维护 run、node、Gate、Decision 及图转换；Agent 准备学术内容与 findings，正式 verdict 由人确认。
- 稳定研究 specs 保存已确认研究承诺；普通笔记与完成通知不能代替正式流程状态。图输入通过角色关系绑定，实际路径由 handoff 表达。

依据：[功能地图与用户模型](../../../references/ResearchSpec/03-功能地图.md)、[图谱运行时](../../../references/ResearchSpec/07-图谱运行时.md)、[能力包与 Procedure](../../../references/ResearchSpec/08-能力包与Procedure.md)。

## 设计映射的依据

用户已明确 workflow 与 capability 深度融入 Scholoom 的 Agent runtime。正式决定见[科研 Agent harness 与执行路线](../issues/07-agent-runtime-boundaries.md)，项目关系见[现有项目复用票](../issues/08-existing-project-integration.md)。[核心模型](../issues/17-native-research-capability-model.md)、[原生内容及执行契约](../issues/18-native-capability-runtime-and-content.md)与[源码复用取舍](../issues/19-existing-source-and-rust-reuse.md)已经确认；最新源码调查由源码复用票链接，本文的旧项目概述仍以参考快照为依据。

上述旧项目事实用于识别科研语义与契约。设计映射围绕统一运行时中的能力发现、调度、状态转换、交付和恢复展开；文件、数据库与 checkpoint 的实际承载交由存储票决定。
