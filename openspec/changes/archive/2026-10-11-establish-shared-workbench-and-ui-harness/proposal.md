# 共享工作台与 UI 开发 harness

## Why

当前浏览器日常协作依赖开发态专用原型，正式 Electron 默认入口仍是标题页。继续沿两条实现演进会重复 UI、状态和操作逻辑，后续 Agent 也容易另建调试页面。用户要求建立可长期演进的正式工作台，让日常标注、开发验证和最终产品共享实现，并把上手路径固化在仓库中。

## What Changes

- 默认 renderer 改为同一正式工作台；删除 Orca 专用原型组件及样式。
- 接入固定版 assistant-ui ExternalStoreRuntime 和消息／Composer primitives；默认未连接，显式开发场景注入隔离样例数据。
- 同一 Playwright 交互场景在 Chromium 和真实 Electron 中运行；扩展现有构建产物 smoke。
- 固化仓库开发命令、Orca 操作边界、Agent 上手入口和跨平台 LF 约定。
- 不接入真实内核、模型、持久化、四布局或最终设计系统。

## 完成判据

浏览器与 Electron 默认工作台及未连接行为一致；开发样例沿相同 UI 与事件接线完成材料选择、提交快照与重置，生产入口不启用样例。类型、格式、构建、共享交互与现有 smoke 通过；本机 Orca 可读取、操作、截图并验证 HMR。新 Agent 能从 AGENTS.md 找到唯一开发说明和实际脚本。

## Capabilities

### New Capabilities

- `ui-workbench-foundation`：共享工作台、未连接交互和显式隔离样例。

### Modified Capabilities

- `development-foundation`：共享 UI 验证、Agent 上手及日常开发机制。

## 决策与授权依据

沿 #10 工作台组织、#12 React DOM／assistant-ui、#14 工程纪律、#20 UI／Electron 验证及本会话 Windows 路径验证。用户确认本轮只建立共享产品 UI 与开发机制、采用正式交互组件、默认空态并显式选择样例，随后要求“Implement the plan”。授权包含计划内依赖、服务、验证及文档实施；不包含 Git 提交、分支切换、真实模型调用或用户研究数据操作。
