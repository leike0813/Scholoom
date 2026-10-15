# 工作台静态检查基线

发现于 `establish-research-capability-runtime` 整合验证。`pnpm lint` 失败（11 errors、1 info），涉及此次未修改的 `ProjectNavigation.tsx`、`SessionList.tsx`、`shell/ActivityPane.tsx`、`shell/AuxiliaryPane.tsx`：格式、import 顺序、非交互元素使用交互 role，以及按钮缺少 type。四份文件与本轮起点 `3b81a2e` 一致，已用 `git diff --exit-code -- <四份文件>` 核对。当前开发检查日志为 `/tmp/scholoom-research-lint.log`（本机临时证据）。

P3d 改动范围的 Biome 检查通过，相关类型、构建、内核及双宿主科研路径通过；这些结果不能解释为全仓 lint 通过。本问题不阻塞科研能力模块验收，沿后续小清理消除，不修改或忽略 lint 规则。

`restore-workbench-checks` 的代表性双宿主 UI 检查另发现折叠测试仍查找旧右区可访问名“文件与任务”，真实快照与组件均为“辅助面板”。两宿主同一断言失败，其余6项通过；同步既有断言后重新验证，不调整产品名称或跳过用例。

已解决：全仓 lint（105文件）、类型检查和构建通过，同一组双宿主 UI 回归8项通过。交付依据见 [restore-workbench-checks](../openspec/changes/archive/2026-10-16-restore-workbench-checks/delivery.md)。
