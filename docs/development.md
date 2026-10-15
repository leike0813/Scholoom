# 开发说明

## 模块与入口

| 包 | 当前职责 | 后续实现边界 |
| --- | --- | --- |
| `apps/kernel` | 独立 Node 内核、CLI、发现与单实例协调、本机认证服务 | 数据权威、任务运行和宿主监督 |
| `apps/desktop` | Electron main、sandbox preload、React renderer | 人类工作台，经共同客户端调用内核 |
| `apps/zotero-host` | 独立 Electron main 与隐藏 Chromium 页面 | 固定 Zotero 10 基线的通用兼容层与选定插件适配 |
| `packages/protocol` | JSON Schema 与推导的 DTO、协议版本 | 客户端和内核共同使用的调用及事件契约 |
| `packages/client` | 共同 WebSocket、认证、请求关联、状态及有界重连 | 业务调用、订阅与范围重同步 |

共享包与内核构建为 ESM；Electron main/preload 构建为 CJS。根 `pnpm build` 按工作区依赖顺序构建。`pnpm typecheck` 先生成共享包声明，确保刚安装的工作区也能解析共享接口。

Electron 工作台和 CLI 共用独立 Node 内核，浏览器开发入口经同一客户端连接。关闭或退出工作台只关闭界面；兼容宿主尚未接入内核监督，也未加载插件。

协议 schema 是 DTO 的事实源，类型从 schema 推导；客户端和内核使用 Ajv 校验消息、认证、状态及引导结果。连接状态不代表研究指令已经可执行。

后续执行与扩展接线沿 [#07](../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer)：内置 LangGraph harness、插件受管 MCP，以及另行定范围的候选对外 MCP 服务。当前骨架尚未实现这些能力；Paseo 仅作为设计与具体实现的参考，不引入其 daemon／provider 体系。

## 本地工作

依赖和工具版本以 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 为准。pnpm 的依赖安装脚本授权集中在 `pnpm-workspace.yaml`。Electron 42 起取消依赖的自动运行时下载，项目使用官方 `install-electron` 命令显式准备二进制，见 [上游安装说明](https://github.com/electron/electron/blob/main/docs/tutorial/installation.md)。

`pnpm dev:desktop` 使用 electron-vite；`pnpm dev:browser` 使用同一 React renderer。浏览器入口没有 Electron bridge，界面业务功能经共同客户端实现。

## 内核配置与生命周期

开发入口和 CLI 默认共用仓库根 `.scholoom-dev/`。CLI 的 `--data-dir` 优先于 `SCHOOLOOM_DATA_DIR`，未指定时使用上述默认目录；Electron/Vite 使用同一环境变量。数据配置限定本机文件系统，不将运行目录放在 NFS 等网络文件系统。

```sh
pnpm kernel start --data-dir /path/to/isolated-profile
pnpm kernel status --data-dir /path/to/isolated-profile
pnpm kernel stop --data-dir /path/to/isolated-profile
```

命令输出结构化状态，公开运行信息不包含凭据；`--help`、`--info` 仍可单独使用。查询和停止不会初始化缺失配置。`start` 在并发请求下连接同一实例；内核仍占用配置但不可达时报告失败，保留原实例。

运行区的 `lifecycle.sqlite` 只承载系统排他锁，内核持锁至退出；`endpoint.json` 原子保存本次实例和连接资料，`kernel.log` 记录不含凭据的初始化诊断。锁文件持续保留，不能通过删除它来重启仍占用配置的进程。Node 24.12.0 会输出 `node:sqlite` 实验性告警，领域数据库仍沿后续存储变更接入。

Electron 通过窄 preload 桥调用独立 Node CLI。开发环境使用 PATH 中的 `node`，也可由 `SCHOOLOOM_NODE_EXECUTABLE` 明确指定 Node 24；缺失或错误运行时显示启动失败，不使用 Electron 充当内核。当前产品目录包尚未提供独立 Node，成品分发由后续变更落实。

Vite 启动时发现或启动内核；浏览器页面初次只查询，用户重试才允许重新启动。引导只接受本机同源请求，运行资料不写入 URL 或构建产物；静态文件与模块入口拒绝读取运行凭据。意外断线会有界重连并重新查询状态，认证或协议错误直接停止尝试。

工作台菜单“停止内核”会说明所有客户端受影响并要求确认。受理或连接关闭不代表退出，界面和 CLI 核对实际状态后才显示停止；不能确认时显示结果未知并提供查询。收到明确停机后客户端不会自动重启，用户可重试连接。停机、断线和重试保留当前页面中的指令草稿；整页刷新不提供草稿持久化。

`pnpm dev:host` 启动隐藏宿主页面，供后续内部调试。宿主内部 DOM 用于兼容适配，不作为产品工作台。当前没有加载 Zotero 应用或插件。

格式和静态检查使用 Biome；`pnpm format` 会写回格式，`pnpm lint` 检查格式、lint 和 import 组织。生成目录及临时研究材料不纳入源码检查。

## 共享工作台与日常交互

日常反馈和最终产品都在 `apps/desktop/src/renderer/src/workbench/Workbench.tsx` 上演进，共用 `styles.css`（语义 token + 浅色/深色双主题，默认跟随系统，左区底部可手动切换）。工作台为三区骨架：左区（操作菜单、会话列表、内核状态）、中间区（tab 组 + Agent 面板）、右区（文件树、材料、任务）；左右区可折叠为图标轨（`Ctrl/Cmd+B`、`Ctrl/Cmd+Alt+B`）。Agent 面板固定在中间区：折叠态 dock 在底部（tool 消息固定顶部、最新 agent 消息截头留尾、精简 composer），点击展开为占满中间区的 overlay（完整消息流与 composer，Esc 收起）。tab 组支持激活、关闭与"向右拆分"按钮，内容类型（文献库/阅读器/编辑器/交互预览）暂为占位。外壳组件在 `workbench/shell/`，布局与视觉契约见 `docs/ui-design/`。`main.tsx` 只选择 session 来源。`workbench/session.ts` 定义界面输入：连接状态、材料及选择、可选的会话/文件树/任务数据、回调和 assistant-ui ExternalStoreAdapter；消息由来源提供，草稿由 assistant-ui Composer 管理，发送、消息呈现和重置都经过工作台的同一路径。接入真实内核时，来源经 `packages/client` 获取业务事实；领域 DTO 仍以 `packages/protocol` 的 schema 为准。

默认浏览器与 Electron 首页显示真实内核来源的工作台；材料和消息为空，可以编辑草稿，发送禁用。连接状态、实例身份、重试及停机来自共同客户端与宿主查询。开发态显式打开 `?scenario=ui-foundation` 才加载 `scenarios/ui-foundation.tsx` 的样例来源。它提供两份虚拟材料和固定回复，仅保留最新一轮；回复记录发送时的材料选择，重置或刷新恢复初始状态。样例不读取文件、不调用模型、不连接内核、不持久化；生产构建忽略该参数并使用真实来源。

本机日常启动：

```sh
pnpm dev:browser --port 5173 --strictPort
```

在本项目 Orca 本地浏览器打开 `http://127.0.0.1:5173/`，交互演示打开 `http://127.0.0.1:5173/?scenario=ui-foundation`。用户直接操作页面，选中元素提交 Design Feedback；Agent 读取随消息附带的组件、selector、页面上下文和意见，修改共同源码，再在同一页面检查 HMR 和行为。操作细节或布局意见可以继续通过对话补充。Orca 是外部开发工具，科研 Agent 执行链由后续内核功能实现。

Agent 使用 Orca browser skill，先列出当前项目的标签，核对 URL 与 `browserPageId`；后续命令显式指定 `--worktree path:<本项目绝对路径>` 和 `--page <browserPageId>`。采用 snapshot → interact → snapshot 循环，导航或状态变化后重新读取；PowerShell 中引用元素写成 `'@e7'`。截图必须实际查看，语义快照不能替代视觉验收；检查 console 和 network 的错误。HMR 检查记录刷新前后的草稿、选择、消息和页面加载时间，组件结构变化可能重置状态。

如果 CLI 无法新建本地标签，用户可手动打开上述链接，再列出标签并继续；桌面不在线或页面不可读时记录实际错误。已发送的结构化反馈可读取，独立轮询未发送注释尚未验证。Windows 路径实测见[验证记录](../.scratch/scholoom-foundations/research/orca-ui-windows-validation.md)。服务已有时先确认项目、端口和可达性，避免重复启动；仅停止本轮自行拥有的进程。

新增 UI 行为直接扩展 Workbench，样例只注入状态与回调，验收扩展 `tests/ui/workbench.spec.ts`。材料、消息和事件处理各保留一个来源；跨宿主差异留在薄入口或适配层。tab 内容类型与真实会话、文件、任务数据按后续需求逐项接入。

模块独立开发时，可在既有 UI harness 中增加专用可视化夹具，接入真实被测模块和交互组件，并明确输入及依赖替身；夹具与整合验收的边界见 [deep module 与独立交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#deep-module-与独立交付)。

跨主机访问可用 `--host 0.0.0.0` 打开界面或隔离样例；真实内核引导与连接仍限本机，不提供远程内核能力，也不向局域网页面交付凭据。默认只监听 `127.0.0.1`。

## 验证与目录包

首次准备 UI 测试运行时执行 `pnpm setup:ui`，安装锁定 Playwright 版本的 Chromium headless shell；Linux 可用 `pnpm setup:ui --with-deps` 安装系统依赖。

`pnpm check` 串联 lint、类型检查、构建、内核、smoke 和 UI 交互测试。单独运行测试前先执行 `pnpm build`。`pnpm test:kernel` 验证真实进程、并发启动/重启、配置隔离与别名、认证和协议、传输重连及停机结果未知；受控代理只在传输边界丢失或延迟消息，业务请求仍到达真实服务。

`pnpm test:smoke` 启动构建后的应用，核对独立 Node CLI、真实工作台连接、生产样例隔离、sandbox preload、关窗续留和重开，以及宿主隐藏窗口。Electron fixture 经原生窗口关闭与应用退出核对所拥有进程的退出，再明确停止测试内核。

`pnpm test:ui` 使用 `playwright.ui.config.ts`，同一场景分别驱动 Chromium 和真实 Electron。它覆盖真实连接、内核连接重连、草稿保护、停机与重试、崩溃后用户重试及既有样例行为；浏览器引导和静态凭据访问检查执行一次。测试独占 `127.0.0.1:5174`，使用 `test-results` 下的独立配置；各套件的 trace 分目录保存。结束时关闭本轮应用与服务并确认内核退出，无法确认退出时保留配置供诊断。

无图形会话的 Linux 需要 Xvfb 和 Electron 所需动态库，使用 `xvfb-run -a pnpm check`。Smoke 检验工程入口，UI 测试检验共同界面行为；业务契约、科研效果、原生能力和插件支持仍须相应真实场景验收。

`pnpm package:dir` 构建并分别生成两个 Electron 目录包，输出到 `release/desktop` 和 `release/zotero-host`。当前不生成签名安装器、不打包独立内核运行时和科研执行工具。发布前再落实已确认的工具分发、签名和安装后验收。

GitHub Actions 使用 Linux、Windows、macOS 矩阵运行同一检查与目录打包；远端结果以实际 workflow 运行为准。本机 Linux 通过不表示三平台已验收。

## 实施约定

新功能依项目默认 `scholoom-dev` schema 留下调查、契约、设计、任务和实际交付记录。结构调整以代码和真实运行结果为准，规格与决策解释保持一致。

拆分任务、安排整合和判断完成时，遵循[按实际使用路径开发与交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#按实际使用路径开发与交付)；原型、基础设施和可用功能按各自目标记录实际验证结果。

模块交付的诊断入口与早期交互反馈沿[开发操作与 UI 调试](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#开发操作与-ui-调试)及[人机分工](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#人机分工与协作)；测试预期沿[独立验证依据](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#e2e-与必要检查)。

设计模块、复用旧实现或重构前，按[架构优先的复用与必要重构](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#架构优先的复用与必要重构)评估，并读取相邻的测试 oracle／TDD 与 deep module 约定。

assistant-ui 已用于工作台的消息和 Composer。数据库、LangGraph、阅读编辑组件和受管工具在对应功能接入时安装并验证。范围明确后建立模块，避免提前加入空目录和假实现。
