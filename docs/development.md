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

## 本地工作

依赖和工具版本以 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 为准。pnpm 的依赖安装脚本授权集中在 `pnpm-workspace.yaml`。Electron 42 起取消依赖的自动运行时下载，项目使用官方 `install-electron` 命令显式准备二进制，见 [上游安装说明](https://github.com/electron/electron/blob/main/docs/tutorial/installation.md)。

`pnpm dev:desktop` 使用 electron-vite；`pnpm dev:browser` 使用同一 React renderer，供浏览器检查界面。浏览器入口的 Electron bridge 不存在，界面功能应在共同客户端上实现。当前只有应用标题页。

`pnpm dev:host` 启动隐藏宿主页面，供后续内部调试。宿主内部 DOM 用于兼容适配，不作为产品工作台。当前没有加载 Zotero 应用或插件。

格式和静态检查使用 Biome；`pnpm format` 会写回格式，`pnpm lint` 检查格式、lint 和 import 组织。生成目录及临时研究材料不纳入源码检查。

## 验证与目录包

`pnpm check` 串联 lint、类型检查、构建和 smoke。Playwright smoke 直接启动构建后的应用，核对独立 Node CLI、真实 React 页面、sandbox preload 暴露的环境标识及宿主隐藏窗口，并在结束时关闭应用。它检验工程入口；业务契约、科研效果和插件支持需用相应真实场景验收。

无图形会话的 Linux 需要系统提供 Xvfb 和 Electron 所需动态库，使用 `xvfb-run -a pnpm check`。测试不启动开发服务器，也不要求额外下载 Playwright 浏览器。

`pnpm package:dir` 构建并分别生成两个 Electron 目录包，输出到 `release/desktop` 和 `release/zotero-host`。当前不生成签名安装器、不打包独立内核运行时和科研执行工具。发布前再落实已确认的工具分发、签名和安装后验收。

GitHub Actions 使用 Linux、Windows、macOS 矩阵运行同一检查与目录打包；远端结果以实际 workflow 运行为准。本机 Linux 通过不表示三平台已验收。

## 实施约定

新功能依项目默认 `scholoom-dev` schema 留下调查、契约、设计、任务和实际交付记录。结构调整以代码和真实运行结果为准，规格与决策解释保持一致。

数据库、LangGraph、assistant-ui、阅读编辑组件和受管工具在对应功能接入时安装并验证。范围明确后建立模块，避免提前加入空目录和假实现。
