# 执行任务

## 1. 共享工作台

- [x] 1.1 接入固定 assistant-ui、共享工作台及未连接 session，显式开发样例复用 UI；删除原型分叉，类型和构建通过。
- [x] 1.2 建立 LF 约定并保留既有内容；仓库 lint 通过。

## 2. 开发与验证机制

- [x] 2.1 建立同一份双宿主交互场景、扩展生产 smoke、接入根脚本和 CI；本机 UI 与 smoke 通过。可委派 tests/ui、Playwright 配置、smoke、CI 的辅助实现，主 Agent 整合。
- [x] 2.2 更新 AGENTS.md、开发说明、README 与续接入口，集中描述共享状态、样例与 Orca 路径；核对命令和源码。

## 3. 整合与交付

- [x] 3.1 本机 Orca 操作、截图、HMR 及标注修改路径验收，完成必要代码审查并解决问题。
- [x] 3.2 运行必要整合检查与 OpenSpec validate，按实际结果填写 delivery.md，核对完成判据和未验证边界。

## 续做入口

从 `openspec instructions apply --change establish-shared-workbench-and-ui-harness --json` 获取实施指引。按任务实现；实际验证与交接背景集中在执行后生成的 delivery.md。
