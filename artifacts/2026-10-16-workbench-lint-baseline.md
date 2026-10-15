# 工作台静态检查基线

发现于 `establish-research-capability-runtime` 整合验证。`pnpm lint` 失败（11 errors、1 info），涉及此次未修改的 `ProjectNavigation.tsx`、`SessionList.tsx`、`shell/ActivityPane.tsx`、`shell/AuxiliaryPane.tsx`：格式、import 顺序、非交互元素使用交互 role，以及按钮缺少 type。四份文件与本轮起点 `3b81a2e` 一致，已用 `git diff --exit-code -- <四份文件>` 核对。当前开发检查日志为 `/tmp/scholoom-research-lint.log`（本机临时证据）。

P3d 改动范围的 Biome 检查通过，相关类型、构建、内核及双宿主科研路径通过；这些结果不能解释为全仓 lint 通过。本问题不阻塞科研能力模块验收，沿后续小清理消除，不修改或忽略 lint 规则。
