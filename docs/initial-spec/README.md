# Scholoom 初设规格书

状态：初稿，供正式实施参考。整理日期：2026-10-14。

建议实施顺序、阶段依赖及 Figma 并行安排见[实施路线图](../implementation-roadmap.md)。

项目文件、文献题录及附件阅读、MiniMax 模型接入、会话与内置材料分析能力见[当前正式规格](../../openspec/specs)。模块组合、broker、执行隔离及 checkpoint 接续由 [migrate-runtime-architecture](../../openspec/changes/migrate-runtime-architecture/delivery.md) 记录实际迁入和验收范围；后续科研业务、环境准备、插件及协作要求仍沿本初设逐项实施。

本规格书将已确认的产品与设计决定整理为可观察要求和代表性场景，覆盖首阶段完整科研路径。它是一份按能力分章的初设，不表示功能已经实现，也不替代当前 OpenSpec 规格、实施调查或交付证据。

## Purpose

为 Scholoom 后续采用 OpenSpec 开发和维护提供可裁剪、可追溯的行为起点，使每个实施变更可以从明确的用户或调用方结果出发，核对已有契约、解决局部未知项并选择必要验证，而无需从分散讨论中重新推导产品行为。

## 阅读与使用

先按下表选择涉及的能力，再读章节的 Requirements 和来源。各章采用 OpenSpec 的 `## Purpose`、`## Requirements`、`### Requirement:`、`#### Scenario:` 与 `WHEN / THEN` 格式。正文的 SHALL 表达目标行为；本目录整体仍是初设参考，不因使用规范关键字而自动成为当前能力声明。

章节按行为职责划分，不对应独立进程、包或发布单元。前缀编号用于本初设内定位和讨论，不要求进入产品 DTO、数据库或正式 requirement 名称。场景体现稳定结果和风险边界，不要求每个场景机械对应一个新测试；实施时核对已有测试并按实际风险选择。

| 章节 | 参考能力名 | 行为范围 | 主要来源 |
| --- | --- | --- | --- |
| [内核与状态观察](kernel.md) | `kernel-lifecycle-and-observation` | 独立运行、连接、停机、有界订阅与共同入口 | 决议 #09、#23 |
| [数据与文件保护](data.md) | `research-data-and-file-safety` | 权威、身份、文件并发、产物关联、备份恢复 | #06、#13、#25 |
| [会话与科研协作](research.md) | `research-execution-and-collaboration` | 任务、方法、交付、决定、接续、委派与 advisor | #17、#18、#25、#35、#36、#37、#43、#46 |
| [文献与知识维护](literature.md) | `literature-and-knowledge` | 摄取、管理、分层检索、分析综合和材料阅读 | #32、#33、#34、#42、#44 |
| [工作台与稿件](workbench.md) | `research-workbench` | 会话操作、材料选择、交互报告、编辑预览、审阅交付 | #10、#11、#38、#40、#43、#45 |
| [授权、模型与受管执行](execution.md) | `authorized-managed-execution` | 发送授权、模型配置、限制重试、环境与取消 | #07、#22、#40 |
| [Zotero 生态与迁入](ecosystem.md) | `zotero-ecosystem` | 原包兼容、Connector、引用键、资源更新、迁入 | #05、#16、#19、#41 |
| [验证与分发](validation.md) | `delivery-and-validation` | 真实接线、故障恢复、性能、科研评价、平台发布 | #14、#15、#20、#21 |

以上能力名只是便于转入变更的候选。正式实施时按当前 capability 划分合并或拆分，不一次性创建八个大变更。

术语以 [CONTEXT.md](../../CONTEXT.md) 为准；产品总览见 [PRD](../prd/README.md)，架构及方案见 [架构设计](../architecture.md)、[技术设计](../technical-design.md)、[接口草稿](../module-interfaces.md)。选择和理由的来源是[决策地图与决议票](../../.scratch/scholoom-foundations/map.md)，本规格书不另作决策来源。章节内引用直接指向相关来源，设计候选与事实冲突时先核对最新用户决定。

## 与 OpenSpec 的衔接

项目使用 [scholoom-dev](../../openspec/schemas/scholoom-dev/README.md)：`proposal → investigation → specs / design → tasks → delivery`。本目录不放在 `openspec/specs` 或 `openspec/changes`，不伪装成已归档能力或已授权实施的全项目变更。

正式契约见[当前规格目录](../../openspec/specs)，活动变更以 `openspec list` 为准。已交付的内核、harness 与工作台基础不代表本初设其余业务已实现。

正式实施按以下方式使用本初设：

1. 选取一个可交付能力或真实业务路径，读取当前正式规格及相关决议。proposal 引用本初设章节／编号，明确本次范围和未纳入部分，不把整章自动变成任务清单。
2. investigation 核对代码、依赖版本、可复用实现与尚未验证的假设。会改变行为的未知项在依赖它的规格确定前解决；实质改变已确认方向时回到用户讨论。
3. specs 按真实差异使用 `ADDED / MODIFIED / REMOVED / RENAMED Requirements`。现有能力必须读取完整 requirement 及场景再修改；新能力说明 Purpose。将本初设的代表性场景细化到本次边界，接口字段与状态只在实际需要时定案。
4. design 说明模块、复用、DTO／Schema、文件变化、失败与验证接线；跨端 Schema 以 `packages/protocol` 为源。tasks 写实际实现和检查，规划止于 apply 所需依赖齐备，实际执行后才填写 delivery。
5. 经验证、同步和归档后，对应行为以正式 `openspec/specs/<capability>/spec.md` 维护；本初设相应条目改为正式规格引用，移除重复规范正文。尚未转入的条目仍仅是规划输入，不维护第二份实现进度账本。

例如“文件内容变化即重读”可引用 D-02 进入一次文件接口变更；本次应同时落实对应失败结果与必要并发检查，不顺带实现完整备份系统。工作台正式接入时优先扩展已有 `ui-workbench-foundation`，保留隔离样例的适用范围，不把样例“只显示最新一轮”作为产品会话限制。

本初设使用完整规格形状 `## Requirements`，并非某个正式变更的 delta。格式校验只能检查文档结构，不能证明需求已实现或本初设已被逐条验收。

## 已确认的设计约束

以下约束用于实施设计选择，具体行为见各章；不将组件名和内部接线混入每个业务 requirement。

| 方面 | 当前约束及依据 |
| --- | --- |
| 部署 | 同一数据配置一个应用宿主及共同领域权威；活动 Agent 执行、独立子 Agent 及 advisor 执行独占进程，风险计算、程序和兼容宿主分别受管。生命周期及故障范围沿[进程决议](../../.scratch/runtime-architecture/issues/03-session-execution-processes.md#answer)，不承诺模块独立升级或宿主故障时持续运行 |
| 执行 | 统一内置 LangGraph／LangChain／Deep Agents；多供应商共用同一执行机制，不支持 ACP 外部 Agent 或第三方 harness，见 #07 |
| 扩展 | MCP 能力由插件声明、宿主管理；不提供独立的任意 MCP 配置入口。原生图、领域及 UI 扩展使用相应接口，见 #07 |
| 数据 | 全局文献库与项目本地数据库各管权威，源文件承载正文和科研材料；SQLite／better-sqlite3／Drizzle 为当前路线，访问方式随负载验证调整，见 #12、#13 |
| 工作台 | React DOM 共享浏览器／Electron 工作台，assistant-ui 为当前接入路线；负载适用性须验证，见 #12、#20 |
| 复用 | 按 Scholoom 契约抽取 Zotero 生态、zotero-agents、ResearchSpec 方法与实现，保留来源许可；不整体依赖旧应用或维护另一套执行权威，见 #19 |
| 安全范围 | 首阶段按可信代码执行启用的程序／插件，受管进程不等于强安全沙箱，见 #09、#40 |

## 待定事项与验证假设

本表不包含 SHALL 要求，也不预填阈值、字段或产品选择。既有待决事实集中见[技术设计 §13](../technical-design.md#13-待决事项与实施调查)，这里说明它们对初设的适用限制。

| 事项 | 已有边界 | 闭合时机与来源 |
| --- | --- | --- |
| 数据库访问安排 | 同步访问可作为初步假设；主线程位置不是固定原则 | 开发中真实规模并发测量，交付前目标环境复验；按证据调整查询、线程或访问方式，#12、#15 |
| UI 实际负载 | 有界读取、分页／虚拟化及更新合并方向已定，具体接线待验 | 分别测试大量材料、长会话、持续输出；接入时与交付前复验，#12 |
| 文件保存与恢复 | 内容变化即重读、副本恢复及选择性取回已定 | 文件依据表示、大小限额、各平台保存竞态、恢复界面与保留策略在对应变更确定，#13 |
| 会话恢复与协作 | 安全续做、持久收件、有界唤醒已定 | 通用入口、saver 版本兼容、消费记录、子执行寿命、唤醒参数实施调查，#25、#43、#46 |
| 内部接口与通信 | [承载、调度与契约语义](../../.scratch/runtime-architecture/issues/06-internal-interfaces-and-ipc.md#answer)已定 | 本机 broker、共享双向 RPC、角色注册与接口发现的正式契约见 [module-runtime](../../openspec/specs/module-runtime/spec.md) 与 [kernel-lifecycle](../../openspec/specs/kernel-lifecycle/spec.md)；远端及插件接线另行实施 |
| 原生交互式科研界面 | 共同原生接口、工作区持久报告及交互回传方向已定 | 动作 Schema、等待恢复、资源访问与运行隔离在接入前细化，#45 |
| 检索与维护 | 混合检索、覆盖说明、实际依赖和旧成果保护已定 | 索引产品、切分、嵌入、融合及维护调度参数按材料与效果调查，#33、#34 |
| 预览体验 | 普通预览／工程执行、最后成功产物保护已定 | 布局、刷新策略、延迟目标按真实稿件讨论，#39 仍后置 |
| 科研评价 | 产品入口真实科研与独立质量检查方向已定 | 功能初步可用后确定样本与评价细则，#21 仍后置；无 Agent 固定端到端性能基线 |
| 生态与分发 | 原包兼容、单向迁入、三平台验收方向已定 | 支持矩阵、配对、原生模块 ABI、目标系统／架构、签名与离线准备随实际交付闭合，#15、#41 |
| 远程与对外协议 | [SSH 部署目标](../../.scratch/runtime-architecture/issues/05-local-and-remote-deployment.md#answer)与[对外接口决议](../../.scratch/runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)已确认，当前实现仍为本机基线 | 远端接线与对外 MCP 均尚未实施，另以 OpenSpec 实施验收；对外 MCP 首批为查询与工作请求提交／补充／撤回，stdio 与 Streamable HTTP 含 Tasks，默认关闭、逐调用方授权、远程 HTTPS；A2A 待明确实际对接需求后增加 |

## 当前范围之外

当前不承诺云同步、多人实时协作、移动端、任意 Zotero 插件兼容、强安全隔离、跨版本原文自动重定位或位置重绑、任意两库自动合并、全文件与数据库通用事务、全量通知回放、金额预算／估价／金额封顶。完整精确复现仅用于明确要求它的研究工作，不作为所有操作的默认成本。

## 跨章节验收路径

这些路径是整合核对样例，不指定开发顺序或一次性交付范围。独立模块仍可按自身契约验收；主 Agent 对实际跨模块接线负责。

| 路径 | 应检查的结果 | 章节 |
| --- | --- | --- |
| 摄取—分析—阅读—补充全文 | 部分入库可用、缺项真实、补齐后维护、原文与产物可查询 | literature、data、research |
| 无工作台执行—随后接入—正式决定 | 同一工作继续、待决定可查、答复只应用一次、断线不取消 | kernel、research、execution |
| 多会话改稿—外部保存—撤销 | 旧修改依据失效、重读重新提案、后续内容得到保护 | data、workbench、research |
| 交互报告—用户选择—继续研究 | 报告持久可打开、选择回到执行、后续成果真实保存 | workbench、research、execution |
| checkpoint 不可用—接续 | 旧成果和决定可取回、未知副作用先核查、不创建虚假任务 | research、data、execution |
| 迁入—中断—续做—恢复副本 | 源库不变、已完成不重复、后续编辑保留、恢复范围明确 | ecosystem、data、validation |
| 后台繁忙—界面输入—取消 | 确定性响应可测、受理与实际停止可辨、已有成果保留 | kernel、execution、validation |
