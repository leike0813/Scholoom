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

2026-10-03 用户采纳 JavaScript/TypeScript 的 LangGraph、LangChain 和 Deep Agents 套件组合，本地运行及关窗、暂停、取消、恢复语义，以及当时的 ACP 外部 Agent 接入和共同内核入口建议。外部执行接入由下述 2026-10-14 决定修订。

对正式科研控制与执行状态的关系，用户进一步明确：“无论是zotero-agents里面的workflow，还是ResearchSpec里面的capability，都应该和本项目的agent runtime深度融合”，现有项目的组织形态源于其框架约束。以下正式结论按这一要求组织。

### 第三轮：统一执行基础与 MCP 扩展边界

2026-10-14 用户在比较整体 fork Paseo、吸纳其 daemon／provider 和仅借鉴之后，选择以借鉴为主。用户明确不支持 ACP 接入外部 Agent：协议接入不能保证第三方 harness 具有与内置 LangGraph 同级别的图状态、interrupt、checkpoint 和恢复控制；兼容多套执行语义会使同一业务流程需要维护不同实现。

用户同时确认 MCP 的两个方向：harness 消费的 MCP 能力纳入插件系统管理，不提供任意 MCP 服务的独立配置入口；Scholoom 自身作为 MCP 服务向外部提供接口，是另一个层面的候选能力，具体范围继续讨论。用户授权同步本票及相关文档，不启动业务实施。

## Answer

经用户选择、采纳并明确融合方向，本票于 2026-10-03 解决。

2026-10-04 按用户确认的[低摩擦协同方案](13-storage-and-change-model.md)同步普通任务的检查、文件操作与恢复范围，执行套件及原生融合路线保留。

2026-10-14 按用户确认更新统一执行基础、插件 MCP 与对外 MCP 边界；以下为当前决定。

### 内置执行基础

- 统一采用 Node 环境中的 JavaScript/TypeScript LangGraph、LangChain 和 Deep Agents 系列套件，不支持 ACP 外部 Agent 或第三方 harness 执行接入。
- LangGraph 提供执行编排、checkpoint、恢复及人类介入机制；LangChain 提供模型、工具与 Agent 循环；Deep Agents 提供可定制的通用 harness 基线。
- Scholoom 在这些基础能力上实现原生科研 harness，落实研究对象、任务授权、能力组织、产物交付与审查契约。规划和 Skills 按任务需要启用。
- 具体依赖版本和实际适配接口由技术栈与架构票细化。

通用 harness 承担会话、上下文、工具执行、子 Agent、持久化与恢复，科研模块提供领域工具、方法、原生图、正式决定及交付检查。通用性体现为不同科研任务复用同一执行基础；模块独立验收通过明确接口和可替换依赖实现，不以替换整个 harness 为前提。统一会话不绑定研究任务，沿 [#43](43-free-agent-conversation-and-research-tasks.md)。

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
- 文件工具、计算与插件能力落实有效授权；普通获授权修改直接应用，提供差异与撤销并保护后续编辑。用户要求先审或授权需要时保留候选。

### 模型与共同访问入口

- 支持配置多个模型供应商及按角色选择模型，均使用同一内置执行机制；模型选择不引入另一套 harness 或业务流程实现。
- GUI、CLI 与内置 Agent 调用共同内核能力，领域规则与研究事实由所属模块维护。研究任务和产物独立于会话与 checkpoint，不依赖完整执行历史才能续做。
- Scholoom 自行维护服务于该运行时的 daemon 与共同客户端。Paseo 的连接、SSH、生命周期、订阅、诊断与交互设计作为参考，可按具体边界吸纳实现；不整体 fork 或迁入其 daemon／provider 体系。前端沿 [#12](12-technology-stack.md) 的 React DOM＋assistant-ui 路线。

### 插件提供的 MCP 能力

- harness 通过插件系统取得 MCP 工具、资源等能力。插件声明能力、所需配置及连接或启动方式；宿主管理启用、配置、凭据、连接与进程生命周期，统一处理授权和诊断。用户配置插件所需参数，不提供脱离插件管理、任意添加 MCP 服务的通用入口。
- MCP 是插件接入能力的一种方式；进程内领域能力、原生 LangGraph 图和工作台界面扩展沿各自接口。完整科研流程通过原生能力／工作流扩展点进入同一运行时。
- MCP 调用遵守有效授权和输入输出契约。插件须说明实际支持的状态查询、取消、恢复及副作用语义；harness 的 checkpoint 不代表插件内部执行可恢复，调用超时不代表操作停止，效果未知的写入先核查再决定是否重试。

### Scholoom 对外 MCP 服务

2026-10-18 用户确认对外接口：MCP 已采纳，首批开放获授权的查询，以及提交工作请求、为自发起请求补充信息与请求撤回；同时支持 stdio 与 Streamable HTTP（含 Tasks 扩展，保留普通工具路径），默认关闭、按外部调用方逐方授权，远程接入须明确配置 HTTPS。A2A 本阶段不提供，待出现明确使用 A2A 的实际对接需求后再增加适配。

该入口复用 GUI／CLI 的领域操作、数据权威与授权，内部执行仍由 LangGraph 控制，外部调用方不取得内置流程的执行权威；决定及理由见[对外接口决议](../../runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)，正式契约由后续 OpenSpec 承接，尚未实施。

### 后续细化

- [现有项目复用与演进](08-existing-project-integration.md)：确定三个项目的长期关系与吸纳能力的方向。
- [原生科研能力核心模型](17-native-research-capability-model.md)：确定能力、Skill、工具、工作流与任务的关系和组合方式。
- [科研能力的运行时契约与内容迁入](18-native-capability-runtime-and-content.md)：确定原生执行、内容组织、角色和工作包契约及旧内容迁入承诺。
- [既有源码与 Rust 的复用取舍](19-existing-source-and-rust-reuse.md)：确定具体实现的复用、抽取、重写及语言选择。
- [运行时与 Electron 架构](09-electron-architecture.md)：确定深层模块接口、进程划分、运行监督和工作台接入机制。
- [存储与变更模型](13-storage-and-change-model.md)：确定领域事实与 checkpoint 的承载、版本、重试协调、冲突和恢复机制。
- [技术栈与工具链](12-technology-stack.md)：确定具体依赖及版本。当前没有执行原型、安装或业务代码实现。
