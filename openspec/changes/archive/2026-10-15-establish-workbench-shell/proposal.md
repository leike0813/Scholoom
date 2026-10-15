# 变更提议

## Why

当前工作台仍是早期两栏验证布局（材料面板 + 交流面板），既没有三区骨架，也没有 Agent 会话的正式容器，无法承载后续的文献库、阅读器、编辑器、任务与多会话能力。用户已确认以 `references/Codex-UI-Reference-Atlas.pdf` 为视觉参考的工作台设计（`docs/ui-design/`，含可交互原型与逐状态验证截图），本次把该设计落地为正式 UI 框架：三区布局、可折叠左右区、tab 组、Agent dock/overlay 双形态与深浅双主题 token，作为后续所有业务模块的宿主。

## What Changes

- 重构 `apps/desktop/src/renderer/src/workbench/`：`Workbench.tsx` 改为三区骨架，新增 `shell/` 组件（ActivityPane、AuxiliaryPane、TabGroups、AgentDock、AgentOverlay）。
- 重写 `styles.css` 为语义 token 化样式（浅色/深色双主题，跟随系统）。
- 扩展 `workbench/session.ts` 的 `WorkbenchSession`：会话列表、文件树、任务列表为可选只读数据，默认空态；保留现有材料、adapter、connection 契约与可访问名。
- 适配 `scenarios/ui-foundation.tsx` 样例来源；扩展 `tests/ui/workbench.spec.ts` 布局行为用例（双宿主）。
- 同步 `docs/development.md` 工作台结构描述；`docs/ui-design/README.md` 标注已实现基线。

范围边界：tab 内容类型（文献库/阅读器/编辑器/预览）与真实会话、文件树、任务数据不在本期；不引入新依赖；不改内核与 `packages/protocol`；不做拖拽拆分与 dock 高度拖拽。

## 完成判据

- 浏览器与 Electron 默认入口呈现三区工作台：左右区可折叠/恢复，中间区含 tab 组与底部 Agent dock。
- dock 点击（composer 以外）展开 overlay，Esc 或收起按钮关闭，焦点正确往返，草稿在形态切换间保留。
- tab 组支持向右拆分按钮与合并；空态呈现。
- 浅色/深色主题经 token 切换，默认跟随系统。
- 既有 UI 测试（连接生命周期、草稿保护、样例行为）在新布局下全部通过；新增布局用例双宿主通过；`pnpm check` 全链路绿。

## Capabilities

### New Capabilities

- `ui-workbench-shell`：三区骨架与折叠、Agent 面板双形态、tab 组管理、主题 token 与防挤压约束。

### Modified Capabilities

- `ui-workbench-foundation`：共享工作台的呈现结构从两栏演进为三区骨架；连接状态与生命周期操作迁移至左区底部；材料选择迁入右区辅助面板。行为契约（未连接禁发、样例隔离、单一来源、草稿保护）不变。

## 决策与授权依据

- 视觉与布局设计：用户已批准的 `docs/ui-design/README.md` 及原型（Codex 参考图册方向、三区布置、Agent 双形态、Codex 中性色、按钮拆分均由用户逐项确认）。
- 实施范围与流程：用户批准的实现计划（OpenSpec `scholoom-dev` 流程、占位边界、不做事项）。
- 工程约定：AGENTS.md（UI 在 Workbench.tsx 单一路径演进、双宿主验证）、[#14](../../../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md)、[#20](../../../.scratch/scholoom-foundations/issues/20-ui-debugging-and-e2e-harness.md)。
