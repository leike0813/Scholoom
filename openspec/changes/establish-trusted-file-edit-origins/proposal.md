# 变更提议

## Why

当前文件历史保存实际 before／after，但 FileEdit 没有可信修改者、执行或撤销关联。CallContext 能证明当前项目、会话、run 与实例，却不能证明某个 instructionId 或 toolCallId。阅读交互因此只能展示差异，负责 Agent 也不能可靠查询人工修改和撤销。把最近消息、模型说明或同内容文件当作来源会误归因。本变更提出范围有限的宿主来源快照、所属保存记录与有界查询，复用现有保存和整次编辑撤销；旧历史、外部修改及元数据失败明确保留未知。

## What Changes

- 提出 FileEdit 可选来源、实际版本依据及 `revertsEditId`，来源仅由可信宿主提供；公开保存参数不接受自报执行者。
- 将来源与实际 FileEdit 在同一所属文件保存临界区及历史事务中记录；复用原创建收据，不建立普通改稿的通用持久事务状态机。
- 提出稳定 fileId 下的有界修改摘要／单条详情查询，明确历史裁剪、无法核查的锚点与未登记磁盘变化；执行成果登记与修改记录、任务 links 分别表达。
- 局部撤销首选现有单次 FileEdit 的整体撤销，保护后续编辑；不顺带实现差异块选择性回退、自动唤醒 Agent 或科研意见状态机。

2026-10-26主线明确授权实施：采用可证明principal／session／run／instance与经核实委派链，指令／工具缺证据时unknown或真实集合；沿整次FileEdit撤销，采用有界changes／edit及明确editId。精确工具作用域token另列后续。恢复指令确认本树77cd078已包含0519904／b838402，不再等待手动同步；实际实施和验证记同一tasks／delivery。

## 完成判据

1. 人工、根执行、子委派、系统及未知来源各自只表达可证明的事实，多指令不任选单个 ID。
2. 直接文件保存、任务保存、资源创建／更新及撤销共用一次来源记录规则；冲突没有成功修改记录，已落盘而历史失败仍返回原效果未知。
3. 新会话／负责 Agent 可按当前授权查询指定文件的有界修改及撤销，明确未知和历史范围，不依赖旧聊天、checkpoint 或正文推断。
4. 回退一次编辑保护后续内容并记录新的实际来源和被撤销 editId；不将可查询说成已消费，也不因撤销启动执行。
5. D1–D3已确认，公共基线已同步；真实委派来源经阅读MaterialChangeView消费，并验证整次undo及负责会话后续工具读回。I5的只读库、选择及阅读器组合仍在材料change逐项验收，不由来源记录局部测试替代。

## Capabilities

### Modified Capabilities

- `project-files`：新增可信来源、修改查询及整次编辑撤销关联的要求，沿原文件保护、身份和有界历史。
- `workbench-resources`：为已确认的项目资源保存提出可核查的 FileEdit 关联，保留文件保存与执行成果登记各自的结果。

## 决策与授权依据

- 用户本轮“主线验收及下一阶段协调”第4项明确要求本线牵头M2，先形成OpenSpec规划／精确delta，禁止未经审核字段上线。
- 既有规则：[存储与变化模型](../../../.scratch/scholoom-foundations/issues/13-storage-and-change-model.md#answer)、[项目文件规格](../../specs/project-files/spec.md)、[资源规格](../../specs/workbench-resources/spec.md)。普通改稿不建立跨文件／数据库通用事务，撤销保护后续成果。
- 正式输入：`/tmp/scholoom-phase2-handoff-VZS5mS/coordination-plan.md`的M2分工，以及快照中Agent委派design、材料交互design；精确路径和源码证据见investigation。
- 沿用Codex／gpt-6.1-sol／high。只读快照和本树规划获授权；不操作其他真实工作树，不提交／推送／归档、不安装新依赖、不操作真实用户数据。
