# 开发说明

## 模块与入口

| 包 | 当前职责 | 后续实现边界 |
| --- | --- | --- |
| `apps/kernel` | 独立 Node CLI，输出帮助与运行时信息 | 内核服务、数据权威、任务运行和宿主监督 |
| `apps/desktop` | Electron main、sandbox preload、React renderer | 人类工作台，经共同客户端调用内核 |
| `apps/zotero-host` | 独立 Electron main 与隐藏 Chromium 页面 | 固定 Zotero 10 基线的通用兼容层与选定插件适配 |
| `packages/protocol` | JSON Schema 与推导的 DTO、协议版本 | 客户端和内核共同使用的调用及事件契约 |
| `packages/client` | 连接配置接口与协议类型出口 | 共同 WebSocket 传输、连接与调用处理 |

共享包与内核构建为 ESM；Electron main/preload 构建为 CJS。根 `pnpm build` 按工作区依赖顺序构建。`pnpm typecheck` 先生成共享包声明，确保刚安装的工作区也能解析共享接口。

内核当前只有 CLI，还没有驻留服务。工作台与兼容宿主各自拥有应用入口；当前工作台不启动内核或宿主。单内核发现、本地认证、双向 JSON-RPC 与宿主监督应在对应功能变更中一起接线和验证。

协议 schema 是 DTO 的事实源，类型从 schema 推导。当前仅建立契约位置；接入传输时增加运行时校验，避免再次手写另一套接口。

后续执行与扩展接线沿 [#07](../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer)：内置 LangGraph harness、插件受管 MCP，以及另行定范围的候选对外 MCP 服务。当前骨架尚未实现这些能力；Paseo 仅作为设计与具体实现的参考，不引入其 daemon／provider 体系。

## 本地工作

依赖和工具版本以 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 为准。pnpm 的依赖安装脚本授权集中在 `pnpm-workspace.yaml`。Electron 42 起取消依赖的自动运行时下载，项目使用官方 `install-electron` 命令显式准备二进制，见 [上游安装说明](https://github.com/electron/electron/blob/main/docs/tutorial/installation.md)。

`pnpm dev:desktop` 使用 electron-vite；`pnpm dev:browser` 使用同一 React renderer。浏览器入口没有 Electron bridge，界面业务功能经共同客户端实现。

`pnpm dev:host` 启动隐藏宿主页面，供后续内部调试。宿主内部 DOM 用于兼容适配，不作为产品工作台。当前没有加载 Zotero 应用或插件。

格式和静态检查使用 Biome；`pnpm format` 会写回格式，`pnpm lint` 检查格式、lint 和 import 组织。生成目录及临时研究材料不纳入源码检查。

## 共享工作台与日常交互

日常反馈和最终产品都在 `apps/desktop/src/renderer/src/workbench/Workbench.tsx` 上演进，共用 `styles.css`。`main.tsx` 只选择 session 来源。`workbench/session.ts` 定义界面输入：连接状态、材料及选择、回调和 assistant-ui ExternalStoreAdapter；消息由来源提供，草稿由 assistant-ui Composer 管理，发送、消息呈现和重置都经过工作台的同一路径。接入真实内核时，来源经 `packages/client` 获取业务事实；领域 DTO 仍以 `packages/protocol` 的 schema 为准。

默认浏览器与 Electron 首页显示未连接工作台：材料和消息为空，可以编辑草稿，发送禁用。开发态显式打开 `?scenario=ui-foundation` 才加载 `scenarios/ui-foundation.tsx` 的样例来源。它提供两份虚拟材料和固定回复，仅保留最新一轮；回复记录发送时的材料选择，重置或刷新恢复初始状态。样例不读取文件、不调用模型、不连接内核、不持久化；生产构建忽略该参数。

本机日常启动：

```sh
pnpm dev:browser --port 5173 --strictPort
```

在本项目 Orca 本地浏览器打开 `http://127.0.0.1:5173/`，交互演示打开 `http://127.0.0.1:5173/?scenario=ui-foundation`。用户直接操作页面，选中元素提交 Design Feedback；Agent 读取随消息附带的组件、selector、页面上下文和意见，修改共同源码，再在同一页面检查 HMR 和行为。操作细节或布局意见可以继续通过对话补充。Orca 是外部开发工具，科研 Agent 执行链由后续内核功能实现。

Agent 使用 Orca browser skill，先列出当前项目的标签，核对 URL 与 `browserPageId`；后续命令显式指定 `--worktree path:<本项目绝对路径>` 和 `--page <browserPageId>`。采用 snapshot → interact → snapshot 循环，导航或状态变化后重新读取；PowerShell 中引用元素写成 `'@e7'`。截图必须实际查看，语义快照不能替代视觉验收；检查 console 和 network 的错误。HMR 检查记录刷新前后的草稿、选择、消息和页面加载时间，组件结构变化可能重置状态。

如果 CLI 无法新建本地标签，用户可手动打开上述链接，再列出标签并继续；桌面不在线或页面不可读时记录实际错误。已发送的结构化反馈可读取，独立轮询未发送注释尚未验证。Windows 路径实测见[验证记录](../.scratch/scholoom-foundations/research/orca-ui-windows-validation.md)。服务已有时先确认项目、端口和可达性，避免重复启动；仅停止本轮自行拥有的进程。

新增 UI 行为直接扩展 Workbench，样例只注入状态与回调，验收扩展 `tests/ui/workbench.spec.ts`。材料、消息和事件处理各保留一个来源；跨宿主差异留在薄入口或适配层。具体视觉风格、四区布局和阅读编辑组件按后续需求逐项接入。

模块独立开发时，可在既有 UI harness 中增加专用可视化夹具，接入真实被测模块和交互组件，并明确输入及依赖替身；夹具与整合验收的边界见 [deep module 与独立交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#deep-module-与独立交付)。

跨主机访问可在启动命令增加 `--host 0.0.0.0`，客户端打开开发主机的局域网 IP。浏览器注释使用客户端 Orca 本地标签；页面 URL 不决定浏览器的执行位置，默认仍只监听 `127.0.0.1`。

## 验证与目录包

首次准备 UI 测试运行时执行 `pnpm setup:ui`，安装锁定 Playwright 版本的 Chromium headless shell；Linux 可用 `pnpm setup:ui --with-deps` 安装系统依赖。

`pnpm check` 串联 lint、类型检查、构建、smoke 和 UI 交互测试。单独运行测试前先执行 `pnpm build`。`pnpm test:smoke` 使用原 Playwright 配置，直接启动构建后的应用，核对独立 Node CLI、React 工作台、生产不启用样例、sandbox preload 和宿主隐藏窗口，结束时关闭应用。

`pnpm test:ui` 使用 `playwright.ui.config.ts`，复用公共测试配置；同一 `tests/ui/workbench.spec.ts` 通过 `fixture.ts` 分别取得 Chromium 或真实 Electron 的 Page。它覆盖未连接、空白指令、材料快照、最新一轮、重置和刷新。测试独占启动 `127.0.0.1:5174` 的 Vite，Electron 加载该 renderer；测试结束关闭自行启动的应用与服务，日常 5173 页面可继续使用。

无图形会话的 Linux 需要 Xvfb 和 Electron 所需动态库，使用 `xvfb-run -a pnpm check`。Smoke 检验工程入口，UI 测试检验共同界面行为；业务契约、科研效果、原生能力和插件支持仍须相应真实场景验收。

`pnpm package:dir` 构建并分别生成两个 Electron 目录包，输出到 `release/desktop` 和 `release/zotero-host`。当前不生成签名安装器、不打包独立内核运行时和科研执行工具。发布前再落实已确认的工具分发、签名和安装后验收。

GitHub Actions 使用 Linux、Windows、macOS 矩阵运行同一检查与目录打包；远端结果以实际 workflow 运行为准。本机 Linux 通过不表示三平台已验收。

## 实施约定

新功能依项目默认 `scholoom-dev` schema 留下调查、契约、设计、任务和实际交付记录。结构调整以代码和真实运行结果为准，规格与决策解释保持一致。

拆分任务、安排整合和判断完成时，遵循[按实际使用路径开发与交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#按实际使用路径开发与交付)；原型、基础设施和可用功能按各自目标记录实际验证结果。

模块交付的诊断入口与早期交互反馈沿[开发操作与 UI 调试](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#开发操作与-ui-调试)及[人机分工](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#人机分工与协作)；测试预期沿[独立验证依据](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#e2e-与必要检查)。

设计模块、复用旧实现或重构前，按[架构优先的复用与必要重构](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#架构优先的复用与必要重构)评估，并读取相邻的测试 oracle／TDD 与 deep module 约定。

assistant-ui 已用于工作台的消息和 Composer。数据库、LangGraph、阅读编辑组件和受管工具在对应功能接入时安装并验证。范围明确后建立模块，避免提前加入空目录和假实现。
