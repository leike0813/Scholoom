# 变更提议

## Why

工作台左区的“项目一级、会话二级”目前是假层级：会话列表按单项目查询后再按 projectId 分组，组头显示裸 ID，项目操作却堆在 `ProjectControls` 的折叠表单里，“移出最近列表”没有确认且移出当前项目后硬跳 `application`。会话归档能力内核已具备，但入口分散、恢复失败没有原地错误。composer 的模型与推理强度是休眠 UI：`ExecutionContext` 支持选项但没有调用方传入，推理强度硬编码 `medium`，协议把模型钉成常量，`session.send` 不接受执行配置，内核也硬编码模型与 effort。同时菜单与确认逻辑已在会话菜单、内核菜单、文件回收确认三处手写重复。本次变更按已批准方案打磨项目/会话组织、归档交互，并把模型选择与推理强度落实为协议、内核、UI 全链路（应用默认 + 会话覆盖 + run 实际配置记录），同时沉淀共享菜单/确认原语。

## What Changes

- 左区改为真两级结构：项目行显示显示名、整行折叠展开会话列表，行尾“管理项目 …”菜单承载切换最近项目、重命名、移出最近列表（带确认，说明不删除目录、不停止执行）；会话操作承载重命名、归档/恢复，归档/恢复失败原地报错。
- 本轮 UI 打磨（同一变更内继续）：左区顶部动作改为新建会话／查找会话／添加项目／文献库／设置；查找会话打开跨最近项目的居中搜索弹窗（`session.search`，结果含归档标识），添加项目打开居中弹窗（“打开／新建”两种模式，Electron 用系统目录选择器，浏览器经内核 `project.browseDirectories` 目录浏览，项目名取目录最后一级）。
- 会话列表改为滚动加载，移除内联搜索、活动／归档切换与翻页；归档会话集中到设置页管理与恢复；会话操作移入整行右键菜单（含 Shift+F10／ContextMenu 键盘入口），移除行尾“管理会话 ⋯”。
- 内核状态固定为左区底部单行 LED + 状态文字，实例、错误、重试与查询移入 hover/focus 详情层；移除工作台“停止内核”入口，停机保留 CLI／RPC 能力；主题切换移到标题行折叠按钮左侧，折叠按钮使用左侧栏图标。
- composer 配置行左侧为权限与 Codex 式模型／推理强度聚合入口（overlay 显示当前值，dock 只留图标，点击后在弹层内同时设置两项），右侧固定取消／发送；移除工作台“继续执行”入口，内核 `session.resume` 与 CLI `continue` 能力保留。
- 新增共享 `Menu`/`MenuItem`/`MenuFormItem`/`ConfirmAction` 原语（`workbench/shell/menu.tsx`），迁移会话菜单、内核停止确认、文件回收确认。
- 协议新增 `effortSchema`、`modelOptionSchema`、`modelPreferenceSchema`，`providerSchema` 携带模型目录与默认配置，`sessionSchema` 增加 `modelConfig`，`runSchema` 记录实际执行配置；新增 `provider.setDefaults` 与 `session.configure` RPC；`session.send` 保持不变。
- 内核新增模型配置模块：模型目录（4 个当前模型及 `supportsEffort` 能力位）、默认配置私有原子持久化（出厂默认 `MiniMax-M3.1-Flash-Preview + medium`）、按能力位组请求；Harness 在新建 run 时钉入“会话覆盖 ?? 应用默认”，busy 追加与 resume 沿用原 run 配置。
- Workbench composer 激活模型/推理强度选择（dock 与 overlay 共用），提供“跟随默认”会话覆盖，设置页提供应用默认模型与默认推理强度；归档、未连接、无会话时禁用；切换失败保留当前值并原地报错。
- 同步 `docs/ui-design/README.md` 与 `docs/development.md` 中的相关事实源。
- 明确不做：命令面板、toast 层、真实项目目录删除或项目归档、项目/任务级模型覆盖。

## 完成判据

- 左区呈现当前项目显示名与其下会话列表，项目菜单操作可用且“移出最近列表”有确认；移出当前项目后选择下一个最近项目或回退 `application`。
- composer 中可选择内核目录内模型与受支持的推理强度，“跟随默认”清除会话覆盖；设置页保存应用默认经 `provider.setDefaults` 生效。
- 新建 run 的请求体包含所选 model 与（受支持时）effort，run 记录持久保存实际配置；busy 追加、resume、已排队 run 不改变原配置；目录外模型被拒绝且不发出 HTTP 请求。
- 归档/恢复失败在菜单与消息区原地显示错误；归档会话的 composer 禁用；恢复不自动发送。
- 查找会话弹窗跨最近项目返回含归档标识的结果，选择后切换到对应项目／会话，迟到响应不覆盖新查询；活动会话列表滚动加载，无活动／归档切换与翻页控件；会话操作经整行右键菜单（含键盘 ContextMenu 入口）完成。
- 添加项目弹窗在 Electron 使用系统目录选择器、在浏览器使用内核目录浏览 RPC；新建项目只输入文件夹名，项目显示名取目录最后一级。
- 设置页可按项目（含 `application` 范围）列出并恢复归档会话；左区底部内核状态为单行 LED + 状态文字且无停止按钮，详情经 hover/focus 弹出；主题按钮位于标题行折叠按钮左侧。
- composer 配置行左侧为权限／模型／推理强度，右侧固定取消／发送，不再有“继续执行”按钮。
- 共享菜单原语被三处既有用法复用；双宿主 UI 测试与内核测试更新并通过；`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test:kernel`、`pnpm test:ui` 通过。

## Capabilities

### Modified Capabilities

- `model-access`：新增模型目录、应用默认与会话覆盖、推理强度档位、run 实际配置记录的契约；凭据保护要求不变。
- `agent-harness`：补充 run 创建时钉入并保存实际模型配置，busy 追加与 resume/排队不改变原 run 配置，旧记录兼容。
- `ui-workbench-shell`：修订项目操作入口、会话归档入口与失败呈现、菜单确认组织、composer 执行上下文与模型/推理强度选择契约；本轮进一步修订查找会话弹窗、添加项目弹窗、会话滚动加载与右键菜单、设置页归档管理、内核状态单行呈现及 composer 紧凑布局。
- `project-files`：新增项目目录浏览 RPC 的契约（只列目录、有界、真实路径、排除链接与私有配置）。
- `kernel-lifecycle`：修订停机入口分工——工作台不再提供停止按钮，停机保留在 CLI／RPC，工作台仍如实呈现停机通知、结果未知、查询与重试。

### New Capabilities

无新增 capability；本次变化全部落在上述五个既有 capability 内。

## 决策与授权依据

- 用户已批准的实施方案：`america-chavez-sentry-psylocke.md`（范围、交互目标、契约设计与测试边界以该计划为准），本变更不再重新讨论已确认范围；本轮 UI 打磨方案：`crystal-simon-baz-nova.md`（搜索弹窗、添加项目弹窗、滚动加载、右键菜单、设置页归档、内核状态单行与 composer 布局以该计划为准）。
- 已确认决策：项目“删除”落实为移出最近列表（`docs/ui-design/README.md`）；归档运行/排队/取消中会话被拒绝且归档可逆（`openspec/specs/agent-harness/spec.md`）；菜单不要继续各组件手写 dropdown（`docs/reference/paseo-ux-patterns.md`）。
- 供应商事实已核对：MiniMax Anthropic 兼容接口当前 4 个模型及 `MiniMax-M3.1-Flash-Preview` 五档 effort（计划文件附官方文档出处）。
- 操作授权：仅创建与编辑本变更的 OpenSpec 工件及后续实施授权范围内的文件；不提交 Git，不启动开发服务器，不消耗真实 API Key（测试使用合成 loopback）。
