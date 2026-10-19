# 核对 MCP 对外工具、资源与长操作的协议契约

Labels: wayfinder:research
Type: research
Mode: AFK
Status: resolved
Assignee: Codex researcher（本会话，2026-10-18）
Parent: [模块依赖、运行时进程与接口架构决策地图](../map.md)

## Question

核对当前 MCP 官方规范及 SDK 中工具、资源、提示、传输与身份授权的职责，明确长操作、任务状态、输入补充、断线、取消及重试的实际保证，区分核心能力、扩展、实验性能力和实现可选项。

调查服务于[外部接口决策](07-external-interfaces-and-extensions.md)，不推定 Scholoom 采用全部协议能力。用官方来源记录版本与核对日期，不将工具注解等提示当作领域授权或副作用保证；不运行或安装 SDK。

## Comments

- 2026-10-18：主票需要事实依据，创建并领取本调查；资料保存在对应 research 文件，取舍留在主票讨论。
- 完成官方规范调查并由主 Agent 抽查版本、Resources 交互定位、Tasks 扩展及 SDK 声明；纠正“长工作只能走扩展”和“委托必须映射内部会话”的过度推论。SDK 完整支持及真实互操作仍未核实，不据此承诺已经可用。

## Answer

调查依据保存在 [MCP 一手参考：工具、资源与长操作](../research/mcp-external-contracts.md)。当前正式版为 2026-07-28；Tasks 已成为官方扩展，其稳定 schema 不等于所有 SDK 与客户端已经支持。

MCP 可承载领域能力调用，也可用普通工具提交科研委托、返回业务受理引用，再查询状态、补充输入和取得成果；双方支持 Tasks 时可映射标准异步生命周期。长工作不必然要求 A2A，委托也不必开放内部会话。协议、注解和请求编号都不能替代领域授权、业务去重或实际效果核查。

本调查解决入口比较所需的协议事实，未完成 SDK 选型或互操作验证。官方 ext-tasks README 目前列出跨代 requester API 及旧版 receiver 支持，不能从新 schema 的 Stable 标签推导新协议完整可用；实施前须按所选 SDK 和对接客户端验证。产品采纳留在外部接口主票。
