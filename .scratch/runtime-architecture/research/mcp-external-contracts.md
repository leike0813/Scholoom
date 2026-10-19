# MCP 一手参考：工具、资源与长操作

核对日期：2026-10-18。当前正式协议版本为 **2026-07-28**，前一版为 2025-11-25；不能用旧版实验性 Tasks 的状态描述当前协议。[版本说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning)、[变更说明](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

本调查服务于[外部接口决策](../issues/07-external-interfaces-and-extensions.md)，不作产品采纳决定。未安装依赖、运行 SDK 或做互操作实测。

## 版本、传输与状态

2026-07-28 删除 initialize 握手与 Streamable HTTP 的 Mcp-Session-Id，每个请求在 _meta 中声明版本与客户端能力，服务端通过 server/discover 报告能力。跨调用状态须由业务句柄等机制表达，不能依赖传输会话；这里的传输会话也不等于 Scholoom Agent session。[版本说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning)、[Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

stdio 要求标准输出只含协议消息。HTTP 传输要求校验 Origin，本地部署建议只绑定回环地址并实施认证。HTTP 授权规范采用 OAuth 等标准机制，具体数据和操作的领域授权仍由 Scholoom 判定。[传输](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)、[授权](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

## tools、resources、prompts

tools 提供可调用能力；resources 提供 URI 定位的上下文，由宿主应用决定如何纳入，可由用户选择或自动选取；prompts 提供用户可选的交互模板。这些交互定位不强制具体 UI，也不授予权限。文献、项目或委托如何映射仍由 Scholoom 的接口契约定义。[tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)、[resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)、[prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)

ToolAnnotations 是提示，不保证忠实描述工具行为。readOnlyHint、destructiveHint 或 idempotentHint 都不能代替授权、幂等实现或恰好一次保证。[schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.json)、[tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

## 长操作与 Tasks 扩展

Tasks 在当前版本已移出核心，成为官方扩展 io.modelcontextprotocol/tasks，其 2026-07-28 schema 标为 Stable。客户端与服务端必须声明支持；服务端可对长请求返回 resultType 为 task 的持久句柄，在响应前持久创建任务，客户端用 tasks/get 查询状态与最终结果，需要输入时用 tasks/update 补充，tasks/cancel 为协作式取消。completed、failed、cancelled 是终态，之后不再变化。[扩展规范及 schema 状态](https://github.com/modelcontextprotocol/ext-tasks)、[扩展总览](https://modelcontextprotocol.io/extensions/tasks/overview)

上述标准任务响应需要双方支持扩展。另一个可行设计是普通工具返回 Scholoom 业务受理引用，再以查询、补充输入等业务工具操作；这种设计无需假装对端支持 Tasks，但相关生命周期由 Scholoom 自己定义。不能由“长任务”推导出必须用 A2A 或必须用 Tasks 扩展。

## 断线、补充输入与重试

当前 HTTP 传输取消基于 Last-Event-ID 的响应流续传；重发使用新请求 ID，不意味着业务幂等。Tasks 要求持久句柄，但正确保存、期限、重启后查询和实际效果核对仍需服务端实现；流断线也不证明业务操作未发生。[传输](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)、[Tasks](https://modelcontextprotocol.io/extensions/tasks/overview)

核心 MRTR 模式可请求补充输入后重新提交请求；requestState 需完整性保护并按主体、期限等约束验证，它不构成单次消费保证，不能充当业务去重或授权凭证。[MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)

## 对 Scholoom 的含义

两类已确认用途都可经 MCP 提供：领域工具直接调用；科研委托由工具提交，并通过受理引用查询、补充输入与取回成果。后者需要 Scholoom 明确公共业务契约，支持 Tasks 的双方还可映射标准任务生命周期。MCP 本身不定义 Scholoom 的会话、持续研究任务或内部执行尝试；无需为委托强制开放内部会话或依赖 transcript。

因此 MCP 与 A2A 的差别不能简化成工具与长任务之分；应比较对端互操作、发现和交互语义，以及维护额外适配的成本。

## 未核实范围

未系统核实官方 TS SDK 与真实客户端对当前协议、Tasks、MRTR 的支持程度。ext-tasks 仓库 README 当前明确列出跨代 requester API 及 2025-11-25 receiver 支持，不能仅凭新 schema 为 Stable 就声称 SDK 完整实现了新版本。[包说明](https://github.com/modelcontextprotocol/ext-tasks#use-it-from-typescript)

SDK 选型、锁定版本和真实互操作仍需实施前验证；协议决定不等于已具备生产接线。
