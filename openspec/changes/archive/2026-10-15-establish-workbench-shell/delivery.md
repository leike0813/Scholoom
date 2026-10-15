# 实际交付与交接

## 当前状态与成果

变更已完成交付。`apps/desktop` 工作台从早期两栏验证布局重构为 `docs/ui-design/` 设计的三区骨架，浏览器与 Electron 双宿主共用同一实现。

与 proposal 完成判据逐项对应：

- **三区骨架与折叠**：左区（操作菜单、会话列表、内核状态）/ 中间区（tab 组 + Agent 面板）/ 右区（文件、材料、任务）；左右区可折叠为 48px 图标轨并恢复，按钮与 `Ctrl/Cmd+B`、`Ctrl/Cmd+Alt+B` 快捷键均可用。✅
- **Agent 面板双形态**：折叠态 dock 固定中间区底部，tool 消息固定顶部（单行截断 + 状态灯），agent 消息截头留尾，右侧精简 composer；点击 composer 以外区域展开 overlay（占满中间区、不遮挡左右区），Esc/收起按钮关闭，焦点进入 composer / 返回 dock transcript。✅
- **tab 组**：激活、关闭、"向右拆分"按钮、空组合并、空态。✅
- **主题**：语义 token + 浅色/深色映射，默认跟随 `prefers-color-scheme`，左区底部主题按钮循环（跟随系统/浅色/深色）。✅
- **既有契约保持**：连接生命周期、草稿保护、发送禁用、样例行为全部保持；既有 UI 测试仅两处适配（样例回复断言前先展开 overlay——完整消息流移至展开态；断言语义不变）。✅

实现与 `design.md` 变更总览一致：来源层（kernel-session / 样例）→ `session.ts` 契约 → `Workbench.tsx` 骨架 → `shell/` 五个受控组件；dock 与 overlay 共用单一 `AssistantRuntimeProvider`，草稿保留由 composer runtime 状态保证并经实测（`agent panel expands to overlay and keeps draft and focus`）。

与 design 的一处偏差：overlay composer 未渲染设计稿中的配置行占位 chip（权限/模型）与环境行——这些控件当前没有真实数据来源，按"用户可见区域只呈现与交互有关的内容"原则留空，待内核提供模型/权限契约后接入。

## 实际验证

- `pnpm check` 全链路（biome lint、tsc typecheck、electron-vite build、`test:kernel`、`test:smoke`、`test:ui`）：通过，exit 0（2026-10-15，Node 24，Linux）。
- `test:ui` 双宿主（Chromium + 真实 Electron）：29 passed / 1 skipped（凭据保护用例按设计仅在 browser 宿主执行）。新增 4 个布局用例：左右区折叠恢复、dock/overlay 形态切换（草稿与焦点）、tab 拆分合并、dock 最新一轮投影。
- `test:smoke`：4 passed。过程中发现两处 smoke 兼容问题并已修复：工作台缺 `h1`（brand 恢复为 h1）、实例标识文本被并入 status 段落（拆为独立元素，保持 `实例 {id}` 精确匹配）。
- 视觉核对：Electron 宿主实际渲染截图 `test-results/ui/workbench-default-workbenc-*/connected-workbench.png`，三区骨架、占位 tab、dock 空态、右区空态呈现正确。
- 未运行项：三平台分发包验证（属发布前验证范围，见 #15）；dock 高度拖拽、tab 拖拽拆分（明确不做，见 design 待办边界）。

## 审查与问题处理

自查覆盖：角色名兼容（`连接状态`/`研究指令`/`发送指令`/材料 checkbox/`停止内核` 等全部保留，既有测试即回归 oracle）；assistant-ui 双 composer 挂载风险以条件挂载规避（overlay 打开时 dock 卸载，composer 状态在 runtime 中共享）；`[hidden]` 与 flex 显示的冲突按 specificity 显式规则处理。无跨模块/跨进程接口变化，无需独立审查；关键交互（焦点往返、草稿保留）均有双宿主实测。

## 未完成事项与下一步

tasks 7.1/7.2 随本记录完成。已知限制（后续变更承接，见 design.md 待办边界）：tab 内容类型真实实现、真实会话/文件树/任务数据接入、composer 配置行与环境行（待内核契约）、dock 高度拖拽。
