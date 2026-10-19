# 核对 A2A 的 Agent 服务、任务与交互契约

Labels: wayfinder:research
Type: research
Mode: AFK
Status: resolved
Assignee: Codex researcher（本会话，2026-10-18）
Parent: [模块依赖、运行时进程与接口架构决策地图](../map.md)

## Question

核对当前 A2A 官方规范及 SDK 的 Agent 发现、消息、任务、产物、输入补充、状态、流式响应、身份授权及取消／断线保证。明确协议任务与 Scholoom 持续研究任务、会话和执行尝试不能直接等同的原因，以及与直接调用 MCP 工具的主要适用差别。

调查服务于[外部接口决策](07-external-interfaces-and-extensions.md)，区分规范要求与可选能力，不假定必须采用 A2A 或以它替代内部 harness。记录官方来源、版本和核对日期，不安装或运行 SDK。

## Comments

- 2026-10-18：主票需要事实依据，创建并领取本调查；资料保存在对应 research 文件，取舍留在主票讨论。
- 完成官方规范调查并由主 Agent 抽查 v1.0.1 发布记录、终态约束、补充输入及推送保证；规范来源固定到发布标签。推送只保证至少尝试一次，不承诺成功必达；不从规范登记模板推断 IANA 实际登记状态。

## Answer

调查依据保存在 [A2A 一手参考：Agent 发现、任务与外部委托](../research/a2a-external-contracts.md)。当前发布基线为 v1.0.1，开发文档不能直接视为该发布版契约。

A2A 原生描述 AgentCard、消息、Task、补充输入及 Artifact，适合外部 Agent 委托 Scholoom 内置 Agent。Task 可长期运行，但终态不再接受消息；它及 contextId 均不能直接等同持续研究任务、内部会话或执行尝试。需要映射生命周期，无须改变内部 harness。

流式与推送为可选能力；推送可能重复或未成功送达，取消尽力而为，消息幂等不是强制保证。实际领域授权、成果保存、版本关联及授权撤销效果由 Scholoom 明确。本调查未核实 SDK 版本支持或运行互操作，相关选型须实施前验证；产品采纳留在外部接口主票。
