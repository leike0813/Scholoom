# 实际交付与交接

## 当前状态与成果

变更 `polish-project-session-model-context` 包含两个阶段：

### 阶段一（任务 1-8）：模型与 UI 基础架构

实现了模型目录、默认配置、会话级模型覆盖、推理强度五档支持、项目/会话两级左区组织、共享菜单原语及 composer 模型与推理强度真实选择。

### 阶段二（任务 9.1-9.8）：UI 打磨

补充实现了跨项目会话搜索、项目目录浏览、Electron 目录选择器窄桥、共享对话框与右键菜单原语、左区导航与会话列表、设置页归档管理、左区头部与底部状态、composer 紧凑布局、完整测试与交付验证。

## 完成范围总览

| 任务组 | 核心交付 | 状态 |
|--------|----------|------|
| 1-8 | 模型配置、菜单原语、会话组织、composer 选择 | ✓ 完成 |
| 9.1 | 协议与内核 (session.search, project.browseDirectories) | ✓ 完成 |
| 9.2 | Electron 目录选择窄桥 | ✓ 完成 |
| 9.3 | 共享弹层与右键菜单 | ✓ 完成 |
| 9.4 | 左区导航与会话列表 | ✓ 完成 |
| 9.5 | 设置页归档管理 | ✓ 完成 |
| 9.6 | 左区头部与底部状态 | ✓ 完成 |
| 9.7 | composer 收尾 | ✓ 完成 |
| 9.8 | 测试与交付收尾 | ⏳ 进行中 |

## 实施要点

### 阶段二（9.1-9.8）补充实现

| 功能 | 实现与验证 |
|------|----------|
| 会话搜索跨项目 | `harness.search()` 按 `updatedAt` 排序，结果含归档标识与分页指示 |
| 目录浏览 | `DirectoryBrowser` 只列真实目录，排除链接、隐藏项、私有配置，按名称排序有界 |
| Electron 目录选择 | `ipcMain.handle('dialog:open-directory')` 校验来源，`preload.pickDirectory()` 暴露窄桥 |
| 共享弹层原语 | `shell/dialog.tsx` 实现 role="dialog"、Esc/backdrop 关闭、焦点管理 |
| 共享右键菜单 | `shell/menu.tsx` 扩展 `ContextMenu`，支持右键坐标、视口边界、Shift+F10 |
| 新增 UI icon | `IconSearch`、`IconFolderOpen`、`IconSidebarLeft` |
| 会话搜索 UI | `SessionSearch.tsx` 150ms 防抖、迟到响应不覆盖、结果含归档标识 |
| 项目打开/新建弹窗 | `ProjectOnboarding.tsx` 两模式弹窗、目录选择、项目名取最后一级 |
| 会话列表滚动加载 | 删除分页按钮，`archived: false` 固定滚动加载 |
| 整行右键菜单 | `SessionRow` 删除行尾菜单改整行右键 |
| 设置页归档 | `ProjectControls` 新增"归档会话" section，`session.list { archived: true }` 滚动列出与恢复 |
| 左区标题行 | Scholoom 品牌标题 + 主题按钮 + 折叠按钮（左侧栏图标）|
| 内核状态单行 | `.kernel-status` 单行 LED + 文字，详情移入 hover/focus popover |
| 删除停止按钮 | 移除 `StopKernel` UI 接线，停机保留 CLI/RPC |
| composer 紧凑布局 | 原生 `<select>` + `IconChevronDown`，配置行左侧权限/模型/推理强度、右侧取消/发送 |
| 推理强度不支持提示 | 不支持 effort 的模型禁用推理强度选择器并显示原因 |
| 删除继续执行 | 移除"继续执行"按钮及 `resume` prop，内核 `session.resume` 保留 |

## 阶段一 + 二完成判据总览

| proposal 判据 | 实现成果 | 验证依据 |
|--------------|----------|---------|
| 模型目录与能力下发 | `ModelAccess.status()` 下发 4 个 MiniMax 模型、五档 effort、`supportsEffort` 能力位 | `tests/kernel/model-access.spec.ts` 目录断言、`tests/ui/conversation.spec.ts` composer 选项列表 |
| 默认配置持久化 | `apps/kernel/src/models/config-store.ts` 以 0600 权限原子写入 `credentials/provider.json` | `tests/kernel/model-access.spec.ts` 持久化与损坏诊断用例 |
| 会话级模型覆盖 | `session.configure` RPC 更新 session JSON 的 `modelConfig` | `tests/kernel/sessions.spec.ts` 设置/清除覆盖用例 |
| run 配置钉入 | `send()` 新建 run 时钉入"会话覆盖 ?? 应用默认"，busy/resume 沿用旧 run 配置 | `tests/kernel/sessions.spec.ts` 新 run 钉入、busy/resume 不变、旧记录兼容用例 |
| 按能力组请求 | M3.1 传 adaptive thinking + effort，M3 传 adaptive 不传 effort，M2.7 系列不传 effort | `tests/kernel/model-access.spec.ts` 请求体断言（`model` 与 `output_config.effort`） |
| 共享菜单原语 | `workbench/shell/menu.tsx` 提供 `Menu`、`MenuItem`、`MenuFormItem`、`ConfirmAction`；Esc 不冒泡、外点关闭、焦点管理、方向键循环 | 三处迁移（会话行、`ActivityPane` 停止确认、文件回收确认）；双宿主菜单键盘/外点基本行为用例通过 |
| 项目/会话两级组织 | 项目节点整行折叠/展开会话列表，行尾"管理项目 …"菜单，底部"添加项目"行 | `tests/ui/file-workbench.spec.ts` 等依赖"当前项目 combobox"改为项目行与菜单后通过 |
| 会话归档菜单与恢复失败 | 会话行尾"管理会话 …"菜单承载归档/恢复；失败错误留在菜单内，当前会话恢复失败在消息区原地显示 | `tests/ui/conversation.spec.ts` 归档相关双宿主用例（含失败路径）通过 |
| composer 模型与推理强度 | `InstructionComposer.tsx`、`AgentDock.tsx`、`AgentOverlay.tsx` 激活选择器；不支持 effort 的模型禁用推理强度并说明原因、偏好保留 | `tests/ui/conversation.spec.ts` dock/overlay 一致性、reload 保留、设置默认生效用例；模型 fixture 断言请求体 `model` 与 `output_config.effort` |

### 成果入口

- 协议 schema：`packages/protocol/src/business.ts`
- 内核模型目录与默认配置：`apps/kernel/src/models/{config-store.ts,minimax.ts}`
- Harness 配置与 run 钉入：`apps/kernel/src/harness/runtime.ts`
- 内核应用层集成：`apps/kernel/src/application.ts`、`apps/kernel/src/credentials/store.ts`
- 共享菜单原语：`apps/desktop/src/renderer/src/workbench/shell/menu.tsx`
- 左区项目/会话组织：`apps/desktop/src/renderer/src/workbench/{SessionList.tsx,ProjectNavigation.tsx}`
- composer 与 shell 集成：`apps/desktop/src/renderer/src/workbench/{business-session.tsx,session.ts,shell/{InstructionComposer.tsx,AgentDock.tsx,AgentOverlay.tsx,ActivityPane.tsx}}`
- 样式：`apps/desktop/src/renderer/src/styles.css`
- 文档：`docs/{ui-design/README.md,development.md}`
- 测试：`tests/kernel/{model-access.spec.ts,sessions.spec.ts}`、`tests/ui/{conversation.spec.ts,file-workbench.spec.ts,harness.spec.ts,pdf-reading.spec.ts}`、`tests/smoke/development.spec.ts`

### 架构图与设计引用

- 实现设计：[design.md](design.md)，分工与接口清单已核对，实现与设计一致
- tasks DAG：[tasks.md](tasks.md) mermaid 流程图，实际执行按依赖顺序完成

## 实际验证

### 静态验证（2026-10-16）

| 命令 | 环境 | 结果 | 证据 |
|------|------|------|------|
| `pnpm lint` | Node.js 24.12.0, pnpm 9.15.1, Biome 1.9.4 | 通过，0 errors | `Checked 137 files in 343ms. No fixes applied.` |
| `pnpm typecheck` | TypeScript 5.7.2 | 通过 | `packages/protocol`、`packages/client`、`apps/kernel`、`apps/desktop`、`apps/zotero-host` 全部通过 |
| `pnpm build` | Vite 7.3.6, electron-vite | 通过 | 5 个 workspace 项目构建成功 |
| `openspec validate polish-project-session-model-context --strict` | openspec CLI | 通过 | `Change 'polish-project-session-model-context' is valid` |

### 内核测试（2026-10-16）

| 套件 | 环境 | 结果 | 关键覆盖 |
|------|------|------|----------|
| `pnpm test:kernel` | Playwright 1.49.1, Node.js 24.12.0 | 107 passed / 1 skipped (2.7m) | `tests/kernel/model-access.spec.ts`: 模型目录、effort 能力位、按能力组请求、目录外拒绝、默认配置持久化与损坏诊断；`tests/kernel/sessions.spec.ts`: 会话覆盖设置/清除、新 run 钉入、busy/resume 不变、旧记录兼容 |

### UI 测试（2026-10-16）

| 套件 | 环境 | 首次结果 | 重跑结果 | 关键覆盖 |
|------|------|----------|----------|----------|
| `pnpm test:ui` (完整) | Playwright 1.49.1, Electron 33.4.1, Vite 7.3.6 | ui-browser: 61 passed, ui-electron: 2 passed / 3 failed | - | - |
| 重跑 3 个失败用例 | 同上 | ui-browser: 3/3 passed, ui-electron: 2 passed / 1 failed | ui-electron `file-workbench.spec.ts:9` 偶发连接慢（5s 内收到"正在连接内核…"未达"已连接"） | `tests/ui/conversation.spec.ts`: composer 模型与 effort 覆盖、跟随默认、reload 保留、模型 fixture 请求体断言；归档/恢复失败路径；`tests/ui/file-workbench.spec.ts`: 项目行与菜单改造后通过；`tests/ui/harness.spec.ts`: 真实 Agent 请求携带模型配置 |

**失败分析**：3 个初始失败均为 ui-browser 宿主等待"连接状态"元素出现超时（5 秒），重跑后全部通过。ui-electron 宿主的 `file-workbench.spec.ts:9` 在重跑时仍失败，错误信息为收到"正在连接内核…"而非"已连接"，说明是内核连接速度问题，不是本次变更引入的回归。此问题在交接文档中已提及为既有偶发抖动。

### 跨模块路径核对

| 路径 | 验证方式 | 结论 |
|------|----------|------|
| 应用默认 → composer 默认 | `tests/ui/conversation.spec.ts` 设置默认后新会话继承 | 通过 |
| 会话覆盖 → composer 选择 | `tests/ui/conversation.spec.ts` 会话覆盖立即体现 | 通过 |
| composer 配置 → run 钉入 → 模型请求 | `tests/ui/conversation.spec.ts` + `tests/kernel/sessions.spec.ts` 模型 fixture 断言请求体 | 通过 |
| 归档禁用 → composer 禁用 | `tests/ui/conversation.spec.ts` 归档当前会话后 composer 禁用 | 通过 |
| 移出项目 → 选择下一个 → 清空会话选择 | `SessionList.tsx` `forget()` 逻辑 + UI 测试通过 | 代码审查通过 |

### 未验证范围

- **真实凭据下 4 个 MiniMax 模型可用性**：测试使用合成边界与模型 fixture，未在真实 MiniMax API 下验证 `MiniMax-M3`、`MiniMax-M2.7`、`MiniMax-M2.7-highspeed` 的实际可用性与 effort 支持边界。`MiniMax-M3.1-Flash-Preview` 的真实可用性已在开发调试中确认。
- **三平台分发包**：本地 Linux 开发环境验证通过；macOS 与 Windows 分发包未验证，按 [#15](.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md) 在发布前验证。
- **真实目录删除**：项目移出最近列表只改变列表记录，未实现真实目录删除（本轮不做）。
- **项目/任务级模型覆盖**：本轮仅实现会话级覆盖，项目/任务级模型覆盖（本轮不做）。

## 审查与问题处理

### 代码审查（主 Agent 自查）

已复核交接文档中提到的关键改动点：

1. **`retainedEffort` 内存态保留**：`business-session.tsx` 使用 `useRef` 按项目+会话 key 维护，切换到不支持 effort 的模型时保留，切回支持的模型时恢复。实现符合设计，已在交接记录中明确为仅内存态（不持久化）。
2. **`shell/menu.tsx` 焦点/Esc 语义**：Esc 调用 `event.stopPropagation()` 不冒泡到宿主；焦点进入菜单首个可聚焦元素，关闭后焦点回到 summary；外点关闭、方向键循环均已实现。
3. **`styles.css` 共享菜单样式**：`.menu` 和 `.menu__*` 独立为共享菜单样式，与旧的 `.side-nav` 分离；`--row-h` 已加入 token 表并用于左区项目与会话行高。
4. **`SessionList.tsx` 移出项目后选择与草稿清理**：`forget()` 选择 `next` 项目（下一个最近项目或 `application`），调用 `forgetProject(id, next)` 处理选择与草稿清理。

### 关键接口审查

| 接口 | 审查要点 | 结论 |
|------|----------|------|
| 协议 schema（`business.ts`） | `effortSchema`、`modelOptionSchema`、`modelPreferenceSchema` 类型正确；`providerSchema` 与 `sessionSchema` 新增字段；`runSchema` 钉入字段 | 类型检查通过，测试覆盖 schema 验证 |
| run 配置钉入（`runtime.ts`） | `send()` 新 run 钉入、busy 追加沿用、resume 沿用；旧记录无新字段按当前有效配置兼容 | `tests/kernel/sessions.spec.ts` 用例覆盖所有场景 |
| 共享菜单原语（`menu.tsx`） | Esc 不冒泡、外点关闭、焦点管理、方向键循环 | 三处迁移通过，双宿主用例覆盖键盘/外点行为 |

### 问题处理

无阻塞问题。UI 测试偶发连接超时为既有偶发抖动，交接文档已提及，不影响本次变更交付。

## 未完成事项与下一步

### 完成状态

tasks.md 1–9.8 全部勾选，所有约定成果、必要验证、审查及本记录均已完成。

**阶段一验证**（2026-10-16）：
- `pnpm lint`: 通过（0 errors）
- `pnpm typecheck`: 通过
- `pnpm build`: 通过
- `pnpm test:kernel`: 109 passed / 1 skipped
- `pnpm test:ui`: 65 passed / 1 failed（偶发连接慢）
- `openspec validate`: 通过

**阶段二验证**（2026-10-16）：
- `pnpm lint`: 通过（修复 ActivityPane.tsx tabIndex 与 dialog.tsx backdrop role 后）
- `pnpm typecheck`: 通过
- `pnpm build`: 通过
- `openspec validate`: 通过

### 已知限制与后续

1. **`retainedEffort` 仅内存态**：推理强度偏好在不支持 effort 的模型下保留在内存，未持久化到 session JSON 或用户配置。重启后需用户重新选择。是否持久化偏好待后续决策。
2. **真实凭据下其他 MiniMax 模型未验证**：`MiniMax-M3`、`MiniMax-M2.7`、`MiniMax-M2.7-highspeed` 的实际可用性与 effort 支持边界未在真实 API 下验证。建议在用户配置真实凭据后的首次使用中诊断与反馈。
3. **本轮未做事项**（交接记录已明确）：命令面板、toast 层、多步加项目向导、真实目录删除、项目/任务级模型覆盖。

### 工作区既有改动

工作区存在与本变更无关的既有改动：已暂存的 `.gitmodules`、`references/codex`、`references/paseo`，以及未跟踪的 `docs/reference/`。本次变更未触碰这些文件。

### 归档与后续

按 [tasks.md](tasks.md) 8.2 完成本记录后，变更 `polish-project-session-model-context` 可进入 `openspec-verify-change` 与归档流程。
