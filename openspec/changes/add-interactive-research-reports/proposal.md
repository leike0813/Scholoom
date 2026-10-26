# 变更提议

## Why

产品已确认 HTML 交互科研报告是一等原生入口，文献对比的筛选、排序、展开应在页面内完成，需要 Agent 的动作则进入共同输入框。现有 HTML 快照阅读会移除脚本，排版预览也不能证明报告动作、版本更新和关闭重开已接通。本变更建立有界报告承载及共同交互链路，明确持久资源、隔离与接续；不等待或替代基础文献综合。

## What Changes

- 为文献对比报告定义浏览、显式对象附加、版本更新、草稿保护与关闭重开的行为契约。
- 复用 ResourceRef、共同资源访问、ContextItem、共同 composer 和 session.send，不另建页面执行授权或私有 Agent 通道。
- 首批采用项目内 HTML 入口与显式本地资源清单；脚本仅操作当前页面，无网络、文件系统或内核直连。关闭工作台后成果继续保存，交互等待沿 session.send 接续。
- 独立于 `add-material-annotation-interactions`；仅共享已交付公共契约，新增公共增量单独列所有权。

## 完成判据

1. 双宿主打开真实保存的文献对比报告，筛选、排序、展开不启动 Agent，所选对象及要求可检查后经共同输入发送。
2. 无未完成草稿时显示新结果并保留仍有效浏览状态；有编辑／批注时保留旧页及草稿，由用户选择查看新版，已附加摘录保持原版本。
3. 关闭与重开沿持久资源恢复；页面销毁不取消已受理执行，不自动完成交互等待，不赋予页面任意文件、网络、内核权限。
4. 真实 harness、保存与刷新链路可诊断；受控模型只证明机械链路，不证明科研分析质量。

## Capabilities

### New Capabilities

- `interactive-research-reports`：报告浏览、共同动作入口、更新保护、隔离、持久化及接续。

### Modified Capabilities

- `workbench-resources`：项目 HTML 正文沿原条件保存；报告入口及显式依赖保持共同资源身份、依据与权限。

## 决策与授权依据

- [交互报告决定](../../../.scratch/scholoom-foundations/issues/45-interactive-research-reports.md)、[阅读交互 Q4–Q6](../../../.scratch/domain-development/issues/07-research-interaction-scope.md#answer)、[七线安排](../../../.scratch/domain-development/parallel-development-plan.md)。
- 2026-10-25 用户仅授权本轮调查与两个独立 OpenSpec 的实施前规划，保持指定 Codex／gpt-6.1-sol／high 配置。
- 同日用户通过规划问题明确回复“采纳该有界方案”，确认上述项目报告、资源清单、页面隔离与关闭后接续；联网报告及库／全局报告的新建权威不在首批。
- 初始规划没有业务实施、依赖安装、服务启动、真实用户数据或Git写入授权；后续具体授权沿下列记录，不将设计确认本身当作实施授权。
- 后续材料change已获得锁定依赖／隔离测试授权；本次主线进一步授权只读消费交接包、复核报告独立模块任务和公共补丁方案。报告业务实现仍未展开，原规划时期的限制不否定这些后续具体授权。
- 第四轮用户直接授权manifest／snapshot／桥schema、有界头部codec及注入窄端口ReportResources和模块测试。止于可独立审查模块，不注册resources.report、不开放HTML写、不接UI／iframe或模型准入。无新公共源码同步；已有0519904可直接复用，业务完整接线仍开放。
