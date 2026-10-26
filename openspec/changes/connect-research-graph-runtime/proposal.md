# 变更提议

## Why

公共基础已经提供源码图注册、受管 worker、资源交接、等待与 checkpoint，但生产图集合仍为空。变更前，科研域只有将整份材料分析 Skill 交给通用 Agent 的路径，尝试记录不能承接图的整体版本、库材料依据和持久等待。本变更新增科研图接入，以固定图验证材料、成果及执行记录之间的交接，保留已交付材料分析，不提前决定用户后置的真实综合流程。本线独立验收结果见 [delivery](delivery.md)。

## What Changes

- 恢复后的本轮新增唯一人工产品操作research.requestGraph，复用原启动参数／回执及host-only内部入口；项目侧组合任务，科研记录不增加任务字段。最终受理条件通过独立guard-harness-admission公共增量复核，不重做历史查询。

- 在现有科研域增加内建图的有界发现、精确解析、开放配置与整体版本描述；节点素材随图版本维护，不建立 Method 实体或独立提示词版本系统。
- 从科研模块经现有内部 `harness.startGraph` 接入固定图，宿主与 worker 使用同一静态注册；固定图只用于机制校准，不默认成为真实科研能力。
- 科研业务记录关联真实 harness 尝试，保留调用身份、配置、实际材料与成果、交付缺项；运行状态、实例、等待及 checkpoint 仍归 harness。历史查询消费独立公共变更 `add-harness-execution-history` 已实现的 `harness.executions` 与宿主来源 `originInstructionId`。
- 通过已有 ResourceEvidence、ExecutionResourcePort、首次创建收据及条件保存交接项目／库材料和项目成果。任务接口未就绪时明确替换，不新增任务字段权威。
- 旧 `research.methods/method/invoke/attempts` 和 `scholoom.material-analysis` 1.0.0 保持原行为；新图使用独立契约，不声称旧 Skill 已迁为业务 Graph。
- 本 change 已获实施授权；G1 公共增量单独维护。本线不新增 UI、不操作其他工作树，不扩展尚未收到的任务／阅读设计。

## 完成判据

下列为本 change 的验收范围，实际结果与证据边界见 [delivery](delivery.md)：

1. 调用方可发现内建图、精确读取版本及已开放配置；非法配置、缺失版本及任意代码入口在业务效果前被拒绝。
2. 固定图经真实 ResearchRuntime、broker 和受管 worker 读取真实项目文本与隔离库材料，从不存在路径首次保存成果，再等待新输入；通过普通 `session.send` 接续。
3. 分别查询执行事实、实际保存／关联结果及 `researchAssessment: notAssessed`；等待、取消、撤权、保存或关联部分失败、重启查询不丢成果、不自动开工、不盲目重放。
4. 记录关联真实 run，包含原始版本与配置；较新执行开始后仍能查询旧调用。启动回执丢失时只读核对原 Message 与图绑定，再按宿主来源查询实际尝试，不能用最新 run、同配置推断或科研状态副本冒充。
5. 沿现有科研、Graph、资源与旧材料分析测试进行最小验证，明确任务替身、外部模型、平台和科研质量边界。I1 归项目线，I2 待用户恢复业务图讨论后另行实施。

## Capabilities

### Modified Capabilities

- `research-capabilities`：追加内建 Graph 发现与配置、科研调用与真实执行关联、材料成果交接及有界诊断；保留原四条材料分析要求。

公共 `execution-work-domains`、`module-runtime` 及已有资源交接契约直接消费。G1 已选择方案 A，`domain-execution-handoffs` 的查询与来源增量由独立变更 [add-harness-execution-history](../add-harness-execution-history/design.md) 维护，本 change 消费其同源契约。

## 决策与授权依据

- 用户最初授权本线从 `e3d58fc807827a78493dcd16e38de28c8d02766e` 调查并完成 OpenSpec 规划，随后明确授权实施、选择 G1 方案 A，并授权本树按锁文件安装既有依赖；`pnpm install --frozen-lockfile` 已完成，锁文件未改。保持 Codex / gpt-6.1-sol / high；没有 Git 提交／推送或 PR 授权。
- [科研域 Q8–Q10 与 Answer](../../../.scratch/domain-development/issues/04-research-methods-scope.md#answer)：源码图、整体版本、固定夹具、可选任务关联，具体业务图后置。
- [七线计划](../../../.scratch/domain-development/parallel-development-plan.md)：本线职责、公共文件归属、独立验收、CI 基线及 I1／I2 分工。
- [项目阶段约定](../../schemas/scholoom-dev/README.md)：规划止于 apply.requires 及其依赖齐备，交付记录依据实际执行结果填写；CLI ready 不代表验收完成。
- G1与科研独立验收均已完成，结果分别见两份delivery；G3任务／阅读设计尚未进入本树，I1／I5未验收。
