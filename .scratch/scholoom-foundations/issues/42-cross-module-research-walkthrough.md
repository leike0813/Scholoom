# 用完整科研情境核对模块共同契约与剩余决策

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: Codex
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 25, 34, 35, 37, 38, 40, 41

## Question

各模块讨论后，从研究意图、材料获取与补充到分析、结果、写作、审阅和续做，是否已形成连贯业务？还存在哪些会影响实现的共同契约或产品决策？

## 已有依据

[核心业务模型](31-core-research-business-model.md)、[harness 与业务协作](25-harness-business-integration.md)，以及文献管理、知识访问、综合维护、工作区、科研方法、模型协作、工作台、预览、执行环境与生态适配各票（32–41）。

用户已确认跨模块走查结果，本票 resolved，正式结论见 Answer。预览未定体验继续由原票后置承接；实现规划仍待用户明确启动。恢复时先读地图，再按需读取本票引用的相关决定；不需要前一会话上下文。

## 本票需要讨论

- 按已确认场景走查模块间材料、任务、产物、判断与变更的流转，允许科研工作往返与不同入口。
- 核对共同权威、范围、状态、通知和错误归属，避免文件／数据库、harness／业务或 GUI／内核各自保存重复事实。
- 检查补充材料后的成果维护、不同 Agent／session 接续、分工审稿与文风监督，以及 QMD／LaTeX 预览能否贯通。
- 对具体缺口补建明确决策票；尚无法精确说明的事项留在地图雾区，不以一张汇总票代替所有未知。
- 向用户说明已有决定、未决项和实测不足，再由用户判断讨论是否足以进入实现规划；票清空不自动创建 OpenSpec。

## 边界

本票核对共同契约，不重新预选所有物理接口，也不启动实现。真实科研效果评价继续按已有票后置到初步功能可运行后。

## 开始方式

从用户实际旧工具链操作出发，用同一项目贯穿各模块；先核对已确认契约，再讨论出现的具体缺口。

## 结束条件

用户确认跨模块业务走查结果；未决项已建票或明确后置，是否进入实现规划由用户明确决定。

## Comments

- 2026-10-08：按用户要求提前建立后续讨论票；保持 open、未领取。本轮仅建票，不回答本票或进入实现。
- 2026-10-10：用户明确要求领取并处理本票，Codex 领取。其余前置票均已 resolved；实时预览票仍按用户此前决定暂缓，保留依赖。本轮先核对已确认的跨模块契约，将预览未决体验明确保留，不自动恢复该票、关闭本票或进入实现规划。
- 2026-10-10：用户回复“不要自动维护了吧，待A恢复研究时提示一下，由用户手动启动复核即可”，确认闲置项目受到库更新影响时的处理方式。该项决定见下方；本票整体走查结果仍待用户确认。
- 2026-10-10：用户回复“可以”，确认按整体走查结果收束，并将预览体验与性能继续留在原票后置。本票设为 resolved，解除预览票对本次走查收束的阻塞，预览票自身保持 open。未启动实现规划、创建 OpenSpec 或开展业务实施。

## Answer

2026-10-10，用户确认整体走查结果与后置边界，本票 resolved。沿[用户实际旧工具链路径](26-research-scenarios-and-existing-toolchain.md#用户描述的实际路径)，同一研究项目可以贯穿讨论、建库、取材、计算论证、写作审阅和续做，允许从不同入口开始及往返。除下方 Q1 的项目复核启动决定外，其余情境沿已确认的共同契约处理，没有发现需要另建决策票的明确缺口；本票不新增领域对象或预选物理接口。

| 情境 | 跨模块核对及决定来源 |
| --- | --- |
| 与 Agent 讨论问题、比较研究路线 | 任务及研究过程持续保存，后续步骤读取实际工件；使用[工作区承接](35-research-workspace-context.md#answer)与[harness 协作](25-harness-business-integration.md#answer)。 |
| 检索或 Connector 收录，部分文献缺全文 | 文献服务保存实际题录与附件结果，分析按材料就绪程度开展；工作台与 Agent 读取共同结果。依据[文献管理](32-literature-management-behavior.md#answer)、[科研方法](36-research-business-methods-workflows.md#answer)与[生态接入](41-zotero-ecosystem-integration.md#answer)。 |
| 从百篇文献中渐进取材，随后补齐全文或加入反例 | 统一检索沿来源展开 Digest、综合与原文；维护沿依赖和发现范围核对影响，保留旧成果及其问题。项目采用结果依授权复核。依据[分层知识](33-layered-literature-knowledge.md#answer)与[分析综合维护](34-analysis-synthesis-maintenance.md#answer)。 |
| 执行分析、生成图件并写入稿件 | 代码、数据和结果使用共同工作区，执行情况与科研交付分别核对；图件修改沿已知生成来源进行。依据[科研执行](40-research-execution-environment.md#answer)、[工件交互](38-workbench-artifact-interaction.md#answer)及[核心业务模型](31-core-research-business-model.md#answer)。 |
| 分工审稿、advisor 建议与用户同时修改 | 保留独立原意见、实际处理与修改关联；负责 Agent 应用前读取当前目标，局部撤销回到原任务。依据[多模型协作](37-multi-model-research-collaboration.md#answer)、[存储变更](13-storage-and-change-model.md#answer)及[工件交互](38-workbench-artifact-interaction.md#answer)。 |
| 编译失败、关窗、取消或换 Agent 继续 | 普通预览与工程执行沿既定授权边界，保留最后成功预览并表达当前失败；续做读取持久材料与实际执行结果，显式取消不自动重启。依据[科研执行](40-research-execution-environment.md#answer)、[工作区承接](35-research-workspace-context.md#answer)及[harness 协作](25-harness-business-integration.md#answer)。预览布局、刷新体验和性能门槛仍由[实时预览票](39-writing-live-preview.md)承接。 |

### Q1 已确认：无人工作的项目受到库更新影响

具体情境：项目 A 已停止本轮工作；项目 B 获取的新材料或来源更正触发共享文献分析／主题维护，并可能影响 A 已采用的论证。

2026-10-10，用户确认：保存影响线索，待 A 恢复研究时提示，由用户手动启动复核。库更新不自动启动 A 的项目复核或维护，恢复研究本身也不自动开始复核。提示说明相关来源变化、受影响成果及尚未复核的情况，不能把未经科研核对的候选影响宣称为原结论已失效。

本项决定针对当前没有 Agent 在工作的项目，文献库分析与主题维护继续沿[已有维护决定](34-analysis-synthesis-maintenance.md#answer)办理。用户启动复核后，沿已有任务授权、当前材料读取、成果保存及正式判断契约执行。

### 第二轮：其余代表性情境核对

在 Q1 定案后继续核对以下边界，用户确认可按已有决定处理。下表为语义走查结果，未发现需要另立接口或产品机制的缺口。

| 情境 | 沿既有决定的结果行为 | 依据 |
| --- | --- | --- |
| 写作时发现研究包未选入的文献，或关键全文下载失败 | 直接发现并读取库中获授权材料；缺全文保留真实缺项及可用分析，任务依据本次交付要求判断是否受阻，其他独立工作继续。 | [分层知识](33-layered-literature-knowledge.md#answer)、[文献管理](32-literature-management-behavior.md#answer)、[harness 协作](25-harness-business-integration.md#answer) |
| 审阅者或 advisor 返回意见时，用户已修改同一段正文 | 保存原意见与所用材料；负责 Agent 应用前读取当前目标，调整受影响修改。有实质歧义时仅暂停相关部分；用户自行修改不因保存而触发文风处理，撤销不自动重启任务。 | [多模型协作](37-multi-model-research-collaboration.md#answer)、[存储变更](13-storage-and-change-model.md#answer)、[工件交互](38-workbench-artifact-interaction.md#answer) |
| 程序结束、答复写成，但必要成果尚未保存或修改未落实 | 执行记录提供实际运行结果，业务交付核对产物及研究要求；意见处理、修改应用与整体交付分别表达，GUI 展示共同事实。不能凭退出码或 Agent 自述宣告科研工作完成。 | [核心业务模型](31-core-research-business-model.md#answer)、[harness 协作](25-harness-business-integration.md#answer)、[科研执行](40-research-execution-environment.md#answer) |
| 编译失败、取消或内核中断后更换 Agent 继续 | 普通预览保持最后成功产物并说明当前失败；取消收尾与已保存成果按实际结果记录。续做从工作区材料核对当前情况，效果未知的高代价操作先核查，显式取消不自动重启。 | [科研执行](40-research-execution-environment.md#answer)、[工作区承接](35-research-workspace-context.md#answer)、[harness 协作](25-harness-business-integration.md#answer) |

### 后置事项与实现规划边界

用户确认剩余预览布局、刷新体验与性能门槛继续在[实时预览票](39-writing-live-preview.md)中后置，解除其对本次走查收束的阻塞；该票仍 open，既有实测不表示体验全部定案。真实科研效果评价继续由[真实科研 Agent 验收](21-agent-dogfooding-and-evaluation.md)在功能初步实现后讨论。

本票完成当前跨模块业务契约的讨论，后置问题仍有明确责任票，新的场景或实现调查显露的未知继续按地图雾区处理。实现规划的启动时机仍由用户决定；本次没有创建 OpenSpec 或启动业务实施。

### 当前证据边界

本轮只读核对前序决定与旧工具链调查材料；六份模块票的确认事实由指定模型子 Agent 提取，主 Agent 核对影响判断的关键原文。此前预览实测及交互草图只在各自已记录范围内作为依据。本轮未运行科研 Agent、应用、迁入、计算或预览；契约连贯性及用户确认不代表真实全流程验收通过。
