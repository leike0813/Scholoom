# Scholoom：模块依赖、运行时进程与接口架构决策地图

Labels: wayfinder:map

## Destination

形成可指导后续重构的架构决策，明确模块依赖与数据权威、统一平台访问、Agent 执行的进程分工与恢复，以及本机、远程和对外接口的组织。完成标志是相关取舍经用户确认，能据此起草实施规格；本轮不实施重构。

## Notes

### 已确认的讨论前提

2026-10-17，用户确认：

- 文献库、Agent harness、工作台必须解耦，模块可以独立测试。
- 单次 Agent 执行卡死或崩溃不能拖垮应用宿主、文献库或其他会话；宿主崩溃或重启允许执行中断，再依持久记录显式接续。不据此承诺共享资源耗尽时仍完全可用，具体故障与资源边界由进程票确定。
- 自有代码的 OS／文件系统访问统一经过平台模块。第三方库由平台模块或受控适配器创建和管理，明确其直接访问范围；不要求拦截第三方库的每次系统调用。
- 讨论同时覆盖现有工作台、CLI、兼容宿主及插件、本机模块调用与进程通信、SSH 远程工作区，以及对外 MCP／A2A 的开放范围与契约。纳入讨论不表示已承诺提供或实施相关能力。
- 本轮产出决策，不修改业务实现、安装依赖、启动服务或执行迁移。

### 讨论方法与事实来源

- 每次先读本地图，按本地 tracker 查询未解决、未阻塞、未领取的子票，领取后再深入；每会话最多解决一张非 research 票。约定见[本地 Markdown tracker](../../.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md)。
- 使用 [grilling](../../.agents/skills/grilling/SKILL.md)、[domain-modeling](../../.agents/skills/domain-modeling/SKILL.md) 和 [codebase-design](../../.agents/skills/codebase-design/SKILL.md)。事实由调查取得，取舍通过与用户讨论确认；明确的外部知识缺口再创建 research 票。
- [原基础地图](../scholoom-foundations/map.md)及原决议提供已有业务约束。[开发说明](../../docs/development.md)、[当前规格](../../openspec/specs/)和代码用于核对现状；[架构草稿](../../docs/architecture.md)、[技术草稿](../../docs/technical-design.md)、[接口草稿](../../docs/module-interfaces.md)中的候选设计不作为定案。
- 原[领域模块与 Electron 架构](../scholoom-foundations/issues/09-electron-architecture.md)的执行故障范围在本轮重新评估。本轮已确认的执行故障隔离要求优先于此前允许 harness 与领域模块共享进程故障范围的选择；单实例、共同数据权威、工作台独立生命周期等其他选择作为评审基线，发生实质变化时记录理由。
- 区分模块依赖、进程故障范围和操作授权；拆进程不自动提供强安全隔离。区分会话、执行尝试与执行进程，不能先假设 session 与 PID 一一对应。
- 用户通过发送消息推进 Agent session；“显式接续”也沿这一入口，恢复是内部机制。会话可用完即弃，工作推进依赖持久材料、领域状态与实际成果，完整边界见[持久化与恢复决议](issues/04-execution-persistence-and-recovery.md#会话交互边界)。
- “科研 Agent 内核”的现有产品定义见 [CONTEXT.md](../../CONTEXT.md)；讨论中的应用宿主、harness、监督职责先明确含义，再决定是否补充术语，不能用同一“内核”名称替代职责分析。
- 新决定保存在对应票的 Answer；地图仅添加摘要和链接。决定改变既有设计时，在该票收尾中列出并同步对应决议及设计事实源；正式规格与代码由后续 OpenSpec 变更承接，不在本地图复制实施任务账本。

## Decisions so far

- [明确模块依赖方向、装配职责与数据权威](issues/01-module-dependencies-and-authority.md)：确认人／Agent 共用基础能力、统一 broker、宿主与领域职责、可提取私有包；补齐依赖守卫、契约 SSOT、符合性检查、分批迁入与局部违约处置。
- [确定统一平台模块的能力、调用边界与第三方适配](issues/02-platform-access.md)：按资源范围提供平台机制与有界条件保存，受控适配第三方及不同宿主；明确资源生命周期、共同保证与错误、系统访问守卫及真实平台验证边界。
- [确定会话执行的进程粒度、监督与故障隔离](issues/03-session-execution-processes.md)：活动执行及独立子 Agent、advisor 执行独占进程，宿主统一准入与监督；明确安全回收、归属收尾、迟到操作及共享故障和资源耗尽的保护范围。
- [确定进程分离后的状态写入、checkpoint 与中断恢复](issues/04-execution-persistence-and-recovery.md)：按模块保存权威事实，每尝试独占私有 checkpoint；发送消息统一推进会话，工作独立于会话，恢复复用已有状态和实际成果，不另建工具调用台账。
- [确定本机与 SSH 远程工作区的数据、执行和凭据部署](issues/05-local-and-remote-deployment.md)：支持本机或远端完整环境；工作台负责 SSH 引导，组件下载可回退本机传包，明确凭据驻留、材料传输、无桌面条件及断线和择时升级。
- [确定进程内接口、内部 IPC 与客户端协议的组织](issues/06-internal-interfaces-and-ipc.md)：进程内 broker 直调，跨进程共享双向 JSON-RPC；按角色接入 Node IPC、回环 WebSocket 与 Electron 窄桥，契约统一等待及副作用规则，明确有界调度与版本发现。
- [确定插件、MCP 与 A2A 的开放范围和公共契约](issues/07-external-interfaces-and-extensions.md)：采纳默认关闭的对外 MCP，首批查询与有限工作请求，支持 stdio、Streamable HTTP 和 Tasks；明确调用方授权、协作请求及会话承接、插件发布与稳定契约，A2A 后置到明确实际对接需求。
- [核对 MCP 对外工具、资源与长操作的协议契约](issues/08-mcp-external-contract-research.md)：核对 2026-07-28 核心与 Tasks 扩展；普通工具也可承载受管科研委托，SDK 与客户端互操作尚待验证。
- [核对 A2A 的 Agent 服务、任务与交互契约](issues/09-a2a-external-contract-research.md)：以 v1.0.1 核对发现、消息、Task 与产物，区分领域工作及内部会话，明确可选能力与送达、取消的保证边界。

## Not yet specified

- 具体 SDK、原生依赖、三平台或远程运行条件的核对，可能显露尚未识别的隔离限制与生命周期要求；能精确提出问题后再建调查或原型票。
- 代表性并发科研路径与实际数据规模，可能暴露当前无法界定的吞吐、资源竞争和恢复问题；不预先猜测性能阈值或进程池参数。

## Out of scope

- 本轮执行架构重构、数据迁移、安装或分发；讨论完成后另以 OpenSpec 规划。
- 自动扩大既有可信代码执行范围为任意恶意代码强沙箱。若发现必须满足新的安全威胁模型，先另行明确范围。
- 保证应用宿主崩溃或重启时 Agent 不间断运行；用户已允许中断后显式接续。
- 借接口设计重定义科研业务、复制文献或项目权威，或重新引入已排除的第三方 harness／ACP 执行路线。
