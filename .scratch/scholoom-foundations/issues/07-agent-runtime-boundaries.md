# 确定科研 Agent harness 的职责与执行引擎路线

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话协调者；与用户共同讨论
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 01, 02

## Question

Scholoom 的内核已确定为 Agent 运行时及外围配套 harness。这套科研 harness 应承担哪些职责，采用什么执行引擎，哪些组件自行实现，哪些复用现有 SDK、harness 或其他运行时？怎样分别支持模型替换和执行引擎替换？

实现路线须落实[Agent 一等公民约束](02-agent-first-contract.md)确定的能力、上下文、授权、任务延续和人类介入要求。本票选择具体职责与执行方式。

[研究对象与领域边界](06-research-domain-boundaries.md)已确定来源、证据、主张、稿件及修订对象的语义，以及研究事实、执行状态和派生视图的区分。本票据此讨论 harness 如何操作并延续这些对象。

结合完整科研链路，明确 Agent 执行循环、上下文组织、工具调用、权限、会话与任务生命周期、取消恢复、并发及产物提交的职责，包括无工作台执行与工作台随后接入的生命周期。研究能力和持续研究状态如何进入 harness，需要结合领域票和 ResearchSpec 复用票讨论。

比较自研执行循环、复用 SDK 与集成现有 harness 等路线，明确应用内核和 CLI、API、MCP 等入口的关系，选择执行基础及复用方式。用户对内核的定位不自动等于所有组件必须从零实现。避免某个执行引擎的会话格式成为研究资产唯一存储。

## Investigation

首轮依据见[科研 harness 与 Agent 执行路线资料核对](../research/agent-execution-routes.md)。该调查区分进程内嵌 SDK、服务端 SDK 和 ACP 接入，不代表已经选定引擎或完成运行验证。

用户选择 LangGraph 系列后的核对见[LangGraph 系列与现有科研契约的职责核对](../research/langgraph-harness.md)，包含官方套件分工、checkpoint 与 interrupt 语义，以及现有工作流和 worker 契约。

## Comments

### 第一轮：用户选择 LangGraph 系列并指定现有设计依据

用户于 2026-10-03 明确选择：

- 主执行基础采用 LangGraph 系列套件，理由是能够满足项目的灵活需求且已有成熟基础。
- 自主规划与显式研究流程参考 zotero-agents 和 ResearchSpec 的现有设计。
- 多 Agent 协作同样参考前述两个项目的现有设计。

此选择替代此前关于 Pi 作为重点候选的建议。

### 第二轮：套件、生命周期与深度融合

用户采纳 JavaScript/TypeScript 的 LangGraph、LangChain 和 Deep Agents 套件组合，本地运行及关窗、暂停、取消、恢复语义，以及 ACP 外部 Agent 接入和共同内核入口。

对正式科研控制与执行状态的关系，用户进一步明确：“无论是zotero-agents里面的workflow，还是ResearchSpec里面的capability，都应该和本项目的agent runtime深度融合”，现有项目的组织形态源于其框架约束。以下正式结论按这一要求组织。

## Answer

经用户选择、采纳并明确融合方向，本票于 2026-10-03 解决。

2026-10-04 按用户确认的[低摩擦协同方案](13-storage-and-change-model.md)同步普通任务的检查、文件操作与恢复范围，执行套件及原生融合路线保留。

### 内置执行基础

- 采用 Node 环境中的 JavaScript/TypeScript LangGraph、LangChain 和 Deep Agents 系列套件。
- LangGraph 提供执行编排、checkpoint、恢复及人类介入机制；LangChain 提供模型、工具与 Agent 循环；Deep Agents 提供可定制的通用 harness 基线。
- Scholoom 在这些基础能力上实现原生科研 harness，落实研究对象、任务授权、能力组织、产物交付与审查契约。规划和 Skills 按任务需要启用。
- 具体依赖版本和实际适配接口由技术栈与架构票细化。

### workflow 与 capability 原生融入运行时

- zotero-agents 的 workflow 与 ResearchSpec 的 capability 是 Scholoom 原生科研能力与工作流的设计和复用来源。
- 能力发现、输入准备、资源供给、授权、调度、Agent 与脚本执行、产物校验、变更应用、正式决定、取消和恢复，进入同一科研运行时。
- 吸纳已有输入输出、可插拔内容、按需发现及显式研究决定，按 Scholoom 的需要组织记录与检查；重要决定留存理由，普通任务保持轻量。
- 科研能力接入项目与文献库领域服务，普通文件、临时产物和计算使用获授权文件或执行通道，待审变更按需采用。
- 内核中的模块按职责划分，共享统一的任务身份、授权、状态转换、审查与恢复契约。对既有 CLI、工作流引擎和宿主适配的具体抽取或替换，交给复用票决定。

### 任务模式与状态治理

- 参考 ResearchSpec 的普通任务与正式受控研究流程两种工作模式。普通持续任务可以按需发现能力并交付产物；需要正式 Gate、Decision、依赖、并行汇合或修订轮次时，使用显式控制。
- 两种模式都由 Scholoom 运行时执行与延续。普通任务使用 LangGraph 执行图，不等于启动正式科研流程。
- 研究承诺、正式流程进展和执行 checkpoint 保留各自语义，由统一科研运行时协调；每个事实具有明确权威，遵守已确认的领域边界。
- Agent 在授权内直接工作、判断科研内容并处理常见变化；程序维护必要结构、状态和授权，正式决定沿既有规则确认。
- 普通进展由 Agent 结合当前产物与必要检查维护，任务摘要和会话提供上下文；正式交付满足明确要求。检查及局部缺项不普遍阻塞整个任务。

### 主 Agent 与限定 worker

- 参考 Navigate 的职责，由主 Agent 理解目标、按需加载能力、组织工作、校验交付并推进任务。
- 参考 executor 与 reviewer 的分工，按需要委派生产或独立检查任务。worker 围绕明确工作包执行，在规定输入、输出、资源和授权范围内交付产物、检查结果与 blocker。
- 主 Agent 校验结果，运行时按正式节点和授权规则推进状态。协作与产物提交由原生运行时组织。
- 具体角色配置、工作包契约和能力扩展方式由[科研能力的运行时契约](18-native-capability-runtime-and-content.md)细化。

### 本地运行、暂停与恢复

- 内核默认在本地运行，可脱离工作台执行任务；工作台随后接入、查看和介入已有工作。
- 关窗断开人类工作台，运行中的任务可以继续；暂停停止推进，在可恢复边界保存进展。
- 取消停止后续调度，处理中断中的受管工具，保留已经完成的产物与操作记录。
- 恢复从任务摘要、当前材料及可用会话／checkpoint 继续，按下一步需要核查结果。不可轻易重复的操作保留必要结果线索，未知情况局部处理；普通任务无需精确重放全部调用。
- 文件工具、计算与外部 Agent 落实同一任务授权；普通获授权修改直接应用，提供差异与撤销并保护后续编辑。用户要求先审或授权需要时保留候选。

### 外部 Agent、模型与访问入口

- 内置执行以 LangGraph 系列为主，外部 Agent 首先沿用 zotero-agents 的 ACP 接入方向。
- GUI、CLI 与 Agent 接口调用共同内核能力；MCP 暴露科研工具，ACP 驱动外部 Agent。协议适配转换调用和事件，领域规则由内核维护。
- 模型配置与执行后端配置分别管理。更换模型沿用相应引擎；更换执行引擎从持续研究状态和产物续做，各后端的恢复、取消与工具能力按支持范围验证。

### 后续细化

- [现有项目复用与演进](08-existing-project-integration.md)：确定三个项目的长期关系与吸纳能力的方向。
- [原生科研能力核心模型](17-native-research-capability-model.md)：确定能力、Skill、工具、工作流与任务的关系和组合方式。
- [科研能力的运行时契约与内容迁入](18-native-capability-runtime-and-content.md)：确定原生执行、内容组织、角色和工作包契约及旧内容迁入承诺。
- [既有源码与 Rust 的复用取舍](19-existing-source-and-rust-reuse.md)：确定具体实现的复用、抽取、重写及语言选择。
- [运行时与 Electron 架构](09-electron-architecture.md)：确定深层模块接口、进程划分、运行监督和工作台接入机制。
- [存储与变更模型](13-storage-and-change-model.md)：确定领域事实与 checkpoint 的承载、版本、重试协调、冲突和恢复机制。
- [技术栈与工具链](12-technology-stack.md)：确定具体依赖及版本。当前没有执行原型、安装或业务代码实现。
