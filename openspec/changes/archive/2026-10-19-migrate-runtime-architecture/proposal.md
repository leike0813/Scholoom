# 将现有实现迁入模块化运行架构

## Why

当前独立内核将项目、文献库、科研能力和 Agent 执行装配在同一进程中，harness 直接取得领域实现及项目数据库，PDF 解析使用线程 Worker。现有 JSON-RPC 已提供工作台与 CLI 接入，但内部调用、授权上下文、模型额度和资源生命周期尚未形成共同机制。单次执行阻塞或崩溃仍可能影响宿主；共享 checkpoint 和提前标记指令消费也不满足分进程恢复要求。架构决策已确认模块权威、broker、平台访问、执行隔离和恢复边界，本变更将这些决定落实到已实现的业务路径，保留现有数据与文件保护，同时统一发送消息和接续的后端语义。

## What Changes

- 抽取 broker、platform、projects、library、harness、research、models 私有 workspace 包；内核保留装配及生命周期，跨模块调用经 broker，模块只掌握自己的记录和授权。
- 按领域整理同源契约，统一注册、校验、副作用及等待语义；进程内直调，跨进程复用双向 JSON-RPC，Node 子进程使用 IPC，工作台和 CLI 保留 WebSocket。当前协议升级为版本 2。
- 收口既有文件、受保护保存、进程、网络、环境、凭据及宿主系统访问；以共同架构策略约束依赖、能力消费和受控原生适配。
- 将活动 Agent 执行、已有科研能力的嵌套 Agent 图和 PDF 解析迁入受管进程，宿主统一准入与监督，按实际归属收尾并撤销旧实例权限。
- 保持项目库和文献库物理布局，迁移混用的运行及科研记录到所属表；每尝试独占 checkpoint，恢复复用所属事实及实际成果。
- 统一通过发送消息驱动正常跨轮和异常后接续，删除公开 RPC `session.resume` 及 CLI `continue`，保留内部恢复机制；维护原有双宿主工作台、CLI、备份恢复和诊断路径。

本次只迁移现有功能。SSH 远程部署、对外 MCP、插件扩展、Zotero 插件实际接线、通用子 Agent／advisor 产品功能和尚未实现的编译或 shell 工具由后续变更承接；A2A 沿原决策后置。已有科研能力的子图隔离属于本次迁移，不据此增加通用委派入口。

## 完成判据

1. 文献和项目模块在不加载 harness 时可独立使用；无工作台的 Agent 经同一授权、领域操作和成果入口完成已有路径。
2. 跨模块交互遵守可执行的依赖与能力策略；契约同时约束提供者、调用方及传输，违约局部拒绝并有诊断。
3. Agent 及 PDF 进程故障不会拖垮宿主或无关会话；取消、宿主失联、旧实例撤权及已受理操作按真实结果收尾。
4. 新消息能在同一会话保留有效跨轮上下文，异常后核查已有成果再接续；可靠受理、checkpoint 后消费确认及工具收据顺序有故障验证。
5. 旧数据迁移及独立副本恢复保留身份、授权、历史和成果，当前数据与后续编辑受到保护；未知副作用不被自动重放。
6. 相关模块、真实内部接线、CLI 与双宿主测试通过；三平台检查保留，未运行或未通过的平台能力明确记录。仅创建本变更工件不代表以上实现判据已满足。

## Capabilities

### New Capabilities

- `module-runtime`：模块组合、broker 路由、可信上下文、同源契约、依赖守卫及唯一记录权威。
- `platform-access`：有范围的系统能力、资源端条件保存、原生适配、资源归属和实际保证。

### Modified Capabilities

- `development-foundation`：私有模块及独立组合、架构检查和按依赖图构建的开发入口。
- `kernel-lifecycle`：按角色接入与接口发现、共同双向 RPC 的有界调度及执行收尾。
- `agent-harness`：统一消息入口、独占执行进程、运行实例、私有 checkpoint、可靠消费与跨轮上下文。
- `model-access`：分进程后的应用统一准入、父子共享预算和受限执行侧模型接入。
- `research-capabilities`：现有能力子图的独立执行、共享额度、取消及所属记录。
- `literature-reading`：PDF 计算进程的故障隔离和实际停止确认。

## 决策与授权依据

- 架构事实源：[决策地图](../../../.scratch/runtime-architecture/map.md)，以及 [#01 模块与权威](../../../.scratch/runtime-architecture/issues/01-module-dependencies-and-authority.md#answer)、[#02 平台](../../../.scratch/runtime-architecture/issues/02-platform-access.md#answer)、[#03 进程](../../../.scratch/runtime-architecture/issues/03-session-execution-processes.md#answer)、[#04 持久化与恢复](../../../.scratch/runtime-architecture/issues/04-execution-persistence-and-recovery.md#answer)、[#06 内部接口](../../../.scratch/runtime-architecture/issues/06-internal-interfaces-and-ipc.md#answer)。#05、#07 的新增部署及外部能力不在本次交付范围。
- 2026-10-19，用户要求根据上述决策新开一个 change；随后确认“迁移现有功能”和“删除旧公开入口”，并以“Implement the plan.”授权执行已提出的建档方案。本轮完成 apply 所需规划工件，业务代码迁移沿后续 apply 执行。
- 保留工作区已有改动，复用当前锁定依赖；规划不操作实际用户数据。实施时的数据保护、依赖和运行环境操作仍遵循项目约定，不能从工件存在或任务勾选推导额外授权。
