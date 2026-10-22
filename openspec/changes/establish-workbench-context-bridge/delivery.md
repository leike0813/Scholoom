# 实际交付与交接

## 当前状态与成果

2026-10-22，共同契约 1.1 交接。用户授权推进至三个公共 change 可以并行；本轮形成协议版本 4 的共同基线，没有实现连接上下文、可靠附加项发送或 UI。当前仅有主工作树 dev，后续工作树从包含本记录的同一基线提交创建。

- [workbench-context-contracts.ts](../../../packages/protocol/src/workbench-context-contracts.ts) 为快照、显式项、指令上下文、publish／内部 read 提供唯一 schema；[workbench-context-types.ts](../../../packages/protocol/src/workbench-context-types.ts) 经现有生成器派生调用映射。
- [workbench-source.ts](../../../packages/protocol/src/workbench-source.ts) 提供宿主侧连接来源；CallContext、消息记录和执行初始化共享此声明。session.send 不接受自报来源，原消息和 materials／materialFileIds 可读。
- [workbench-context.ts](../../../packages/protocol/src/workbench-context.ts) 提供 schema 加聚合校验：单项摘录／批注的 UTF-16 上限、64 KiB UTF-8 正文、重复项与归一化矩形。真实提供者接入时使用这些入口，不能只验证单项 schema。
- 产品、客户端和 worker 共用 protocolVersion=4，历史消息／执行记录新增字段可选。实际旧路径收到非空 contextItems 或 worker 结构化指令会明确失败，避免数据被受理后丢弃；publish 尚不可用。

design 中的连接与模型流程图仍为目标，运行时完整来源、权限与草稿链路由后续任务实现。

## 实际验证

共同基线的环境、命令及实际结果见[领域交接验证记录](../establish-domain-execution-handoffs/delivery.md#实际验证)。本变更覆盖大小与字节／UTF-16 边界、选区／草稿标识、来源字段拒绝、不同查询状态、历史消息读取和未接线入口。33 项内核回归及 4 项真实入口冒烟通过，协议升级经实际 Electron 连接与重连验证。

没有验收实时选择、附加项可靠受理、模型前重新授权或多窗口草稿；没有运行真实模型、全套 UI 和三平台分发。固定契约样本只证明载荷与保护边界。

## 审查与问题处理

独立共同契约审查未发现本变更阻塞，跨变更模型初始化缺口已修正并复核，见前述领域交接记录。架构循环通过分开纯声明、派生类型及校验入口消除，未添加架构例外。

宿主仍须建立并快照可信来源、按实际指令查当前窗口，核对接收会话和每次资源／模型外发权限；CallContext 可选字段不是授权凭证。isContextItems／isWorkbenchContextSnapshot 的整体校验不能由 JSON Schema maxLength 代替。

## 未完成事项与下一步

可独立推进 1.2／1.3 的连接与快照、2.1 来源事实、3.1 显式项可靠受理及 4.1–4.3 的设计／UI／草稿。使用约定替身验证自身模块；2.2／3.2 的真实资源与权限验证等待工作域及领域交接资源适配。

修改通用 driver 同一块前同步领域交接 2.2，修改共用 UI fixture／URL 前同步其 4.1。只有真实接线和保存／外发检查完成后，才移除当前非空 contextItems 的 unavailable 保护。最终三线真实组合验收仍由 4.5 承接，开展前指定当次负责人；三个 change 均不满足归档条件。
