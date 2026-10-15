# 调查依据

## 当前事实与复用选择

本次变更的全部输入均已核实，无影响方案的未知项：

- **设计依据（已确认契约）**：`docs/ui-design/README.md` 与 `docs/ui-design/prototype/`（用户批准的布局、token、交互规则），原型各状态已经 Playwright 实际渲染验证（`docs/ui-design/screenshots/v2-*.png`）。dock 截头留尾、折叠轨、overlay、防挤压行为均在真实浏览器实测。
- **现有工作台实现（静态阅读 + 既有测试实跑）**：`apps/desktop/src/renderer/src/workbench/Workbench.tsx`（assistant-ui `ThreadPrimitive`/`ComposerPrimitive` + `useExternalStoreRuntime`）、`session.ts`（`WorkbenchSession`/`WorkbenchConnection`）、`kernel-session.tsx`（内核生命周期，成熟不改）。assistant-ui 版本见 `apps/desktop/package.json`，其 ExternalStoreAdapter 已支撑现有消息投影，dock/overlay 可共用同一 runtime 实例，无需新增依赖。
- **既有行为契约（已实跑的测试锁定）**：`openspec/specs/ui-workbench-foundation/spec.md` 与 `tests/ui/workbench.spec.ts` 锁定可访问名（`连接状态`、`研究指令`、`发送指令`、材料 checkbox、`用户消息`/`Agent 回复` article、`停止内核` 等）。新布局保留这些名称，仅迁移位置；既有测试构成回归 oracle。
- **双宿主验证设施（已实跑）**：`playwright.ui.config.ts` + `tests/ui/fixture.ts` 同场景驱动 Chromium 与真实 Electron，`pnpm check` 串联全链路。
- **复用选择**：组件样式直接迁移原型 `styles.css` 的 token 与规则（本项目自有产物，无许可问题）；不引入组件库，与项目"UI 单一路径、薄适配层"约定一致。

## 结论与承接

无阻塞项，方案可直接进入 specs 与 design。剩余验证（新布局在双宿主的实际行为、主题切换、焦点往返）由 tasks 中的测试任务与 `pnpm check` 承接。
