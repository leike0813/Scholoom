# 执行任务

## 1. 样式基线

- [x] 1.1 重写 `apps/desktop/src/renderer/src/styles.css` 为语义 token 化样式（迁移 `docs/ui-design/prototype/styles.css`，含浅色/深色映射、`prefers-color-scheme` 默认值、防挤压最小尺寸）。完成依据：`docs/ui-design/README.md` token 表逐项可对应。

## 2. 会话契约扩展

- [x] 2.1 扩展 `workbench/session.ts`：`SessionSummary`/`FileNode`/`TaskSummary` 类型与 `WorkbenchSession` 可选字段（design.md 方案与接口节）。完成依据：`pnpm typecheck` 通过，现有来源不破坏。

## 3. 外壳组件

- [x] 3.1 新增 `workbench/shell/ActivityPane.tsx`（操作菜单、会话列表、内核状态条，保留 `连接状态`/`停止内核`/`确认停止`/`重试连接` 可访问名）。
- [x] 3.2 新增 `workbench/shell/AuxiliaryPane.tsx`（文件树、任务列表、材料复选迁入，保留材料 checkbox 可访问名）。
- [x] 3.3 新增 `workbench/shell/TabGroups.tsx`（tab 激活/关闭/向右拆分/合并/空态）。
- [x] 3.4 新增 `workbench/shell/AgentDock.tsx`（tool 行固定顶部、agent 消息截头留尾、精简 composer，保留 `研究指令`/`发送指令` 可访问名）。
- [x] 3.5 新增 `workbench/shell/AgentOverlay.tsx`（`role="dialog"`、完整 Thread 消息流、三层 composer、Esc 收起、焦点往返）。

## 4. 骨架整合

- [x] 4.1 重组 `workbench/Workbench.tsx` 为三区骨架（左右折叠状态与快捷键、dock/overlay 形态切换、单一 AssistantRuntimeProvider）。
- [x] 4.2 适配 `scenarios/ui-foundation.tsx`（提供空会话/文件/任务数据，材料行为不变）。
- [x] 4.3 `pnpm lint && pnpm typecheck && pnpm build` 通过；`pnpm test:ui` 既有用例全绿（角色名兼容）。

## 5. 布局行为测试

- [x] 5.1 `tests/ui/workbench.spec.ts` 新增双宿主用例：左右区折叠/恢复；dock 点击展开 overlay、Esc 收起、焦点往返、草稿保留；tab 拆分/合并；样例场景 dock 显示最新一轮。完成依据：`pnpm test:ui` 全部通过。

## 6. 文档同步

- [x] 6.1 更新 `docs/development.md` 工作台结构描述；`docs/ui-design/README.md` 标注已实现基线。

## 7. 整合与交付

- [x] 7.1 `pnpm check` 全链路运行并核对本次完成判据（proposal.md）；主 Agent 核对双宿主实际行为与规格场景一致。
- [x] 7.2 根据实际执行结果完成 delivery.md，核对本次完成判据及必要验证，再更新本项状态。

## 续做入口

按 1→7 顺序执行；实现细节见同目录 `design.md`，行为契约见 `specs/`。执行后的结果与交接背景记录于 `delivery.md`。
