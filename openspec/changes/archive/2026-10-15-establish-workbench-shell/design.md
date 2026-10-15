# 实现设计

## 变更总览

```mermaid
flowchart LR
    subgraph sources[来源层]
        KS[kernel-session<br/>真实内核生命周期]
        SC[scenarios/ui-foundation<br/>显式样例]
    end
    subgraph contract[接口层]
        SS[session.ts<br/>WorkbenchSession 契约]
    end
    subgraph shell[工作台外壳 workbench/shell]
        AP[ActivityPane<br/>菜单/会话列表/内核状态]
        TG[TabGroups<br/>tab 组与拆分]
        AD[AgentDock<br/>折叠态]
        AO[AgentOverlay<br/>展开态]
        AX[AuxiliaryPane<br/>文件树/任务/材料]
    end
    WB[Workbench.tsx<br/>三区骨架与折叠状态]
    AUI[@assistant-ui/react<br/>ExternalStoreRuntime]
    CSS[styles.css<br/>语义 token 双主题]

    KS --> SS
    SC --> SS
    SS --> WB
    WB --> AP & TG & AX & AD & AO
    AD & AO --> AUI
    CSS -.token.-> WB
```

数据权威不变：`WorkbenchSession` 是工作台唯一输入契约，消息只读投影来自 assistant-ui adapter，草稿由 assistant-ui Composer 管理；外壳组件均为受控呈现，不另建状态权威。

## 方案与接口

**复用与删除**：复用 `kernel-session.tsx`（不改）与 assistant-ui runtime；删除 `Workbench.tsx` 中旧两栏布局与材料面板，其职责分别由 ActivityPane（连接状态迁入左区底部）与 AuxiliaryPane（材料复选迁入右区）承接。dock 与 overlay 共用同一 `AssistantRuntimeProvider`，形态切换只改变呈现，不重建 runtime，草稿天然保留。

**session.ts 扩展**（向后兼容的可选字段，来源缺省时为空态）：

```ts
interface SessionSummary { id: string; title: string; status: 'running'|'awaiting'|'failed'|'idle'; unread?: boolean; updatedAt: string }
interface FileNode { name: string; kind: 'dir'|'file'; children?: FileNode[]; open?: boolean }
interface TaskSummary { id: string; title: string; status: 'running'|'awaiting'|'done'|'idle'; updatedAt: string }

interface WorkbenchSession {
  // ……现有字段不变……
  sessions?: readonly SessionSummary[];
  activeSessionId?: string;
  selectSession?: (id: string) => void;
  fileTree?: readonly FileNode[];
  tasks?: readonly TaskSummary[];
}
```

**Workbench.tsx**：管理 `leftCollapsed`/`rightCollapsed`/`agentExpanded` 布局状态与 `Ctrl/Cmd+B`、`Ctrl/Cmd+Alt+B`、Esc 快捷键；折叠状态为界面状态，不入 session 契约。

**AgentDock**：折叠态左侧 transcript 为可点按钮（`aria-label="展开 Agent 会话"`）——tool 行固定顶部（`flex:none`），agent 消息区 `flex:1` + `justify-content:flex-end` 截头留尾（原型已实测方案）；右侧精简 composer 复用 `ComposerPrimitive`，保留 `研究指令`/`发送指令` 可访问名。dock 只读投影最新 tool 消息与最新 agent 消息：从 adapter 消息流取尾部，tool 消息缺失时隐藏该行。

**AgentOverlay**：`role="dialog"`，绝对定位于中间区内（不遮挡左右区）；完整 `ThreadPrimitive` 消息流（user 气泡 / agent 正文 / 既有 UserMessage、AssistantMessage 组件演进样式）；三层 composer；Esc 收起。焦点：打开时进 composer，关闭时回 dock transcript 按钮。

**TabGroups**：外壳期 tab 数据为界面状态（占位页：文献库/阅读器/编辑器/交互预览各一静态占位），提供激活、关闭、向右拆分、合并；真实内容类型由后续模块按 tab 容器接口接入。

**styles.css**：迁移原型 token（色值为 Codex 截图像素取样，见 `docs/ui-design/README.md`）；`data-theme="dark"` 映射深色，默认跟随 `prefers-color-scheme`；防挤压最小尺寸与原型一致（窗口 960px、左 220、右 260、中间 480、tab 组 320、dock composer 300）。

**取舍**：不引入组件库（现有手写 + assistant-ui 已覆盖，风格定制度高）；不做拖拽拆分与 dock 高度拖拽（按钮与固定高度已满足当前需求，后续按反馈扩展）。

## 文件变化

| 文件 | 变化 |
| --- | --- |
| `apps/desktop/src/renderer/src/styles.css` | 重写为 token 化样式（双主题、防挤压） |
| `workbench/session.ts` | 扩展可选会话/文件树/任务字段 |
| `workbench/Workbench.tsx` | 重组为三区骨架与布局状态管理 |
| `workbench/shell/ActivityPane.tsx` | 新增：菜单、会话列表、内核状态（迁入连接 UI） |
| `workbench/shell/AuxiliaryPane.tsx` | 新增：文件树、任务列表、材料复选（迁入） |
| `workbench/shell/TabGroups.tsx` | 新增：tab 组、拆分/合并、空态 |
| `workbench/shell/AgentDock.tsx` | 新增：折叠态 dock |
| `workbench/shell/AgentOverlay.tsx` | 新增：展开态 overlay |
| `scenarios/ui-foundation.tsx` | 适配扩展后的接口 |
| `tests/ui/workbench.spec.ts` | 新增布局行为用例；既有断言保留 |
| `docs/development.md` | 更新工作台结构描述（文档漂移修复） |
| `docs/ui-design/README.md` | 标注已实现基线 |

## 验证与风险

- 既有 UI 测试（连接生命周期、草稿保护、样例行为）作为回归 oracle，双宿主运行；角色名保留是兼容关键，任何必须修改的断言逐条记录于 delivery。
- 新增用例：左右区折叠/恢复；dock 点击展开 overlay、Esc 收起、焦点往返、草稿保留；tab 拆分/合并；样例场景 dock 显示最新一轮。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test:ui`、`pnpm check` 全链路。
- 风险：assistant-ui Thread 组件在 dock/overlay 两处同时挂载的渲染开销——dock 只读尾部消息而非挂载第二个 Thread，规避；overlay 打开时 dock 的 composer 与 overlay composer 同 runtime 两实例，草稿同步由 assistant-ui 保证，以草稿保留用例实测。

## 待办边界

- tab 内容类型真实实现、真实会话/文件树/任务数据：后续业务模块变更承接。
- dock 高度拖拽、tab 拖拽拆分、空态入口的实际目标：按使用反馈在后续变更评估。
