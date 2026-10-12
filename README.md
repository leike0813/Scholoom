# Scholoom

面向科研 Agent 与研究者的本地工作台，覆盖文献管理、阅读、研究执行和论文写作。

当前仓库包含独立 Node CLI、浏览器与 Electron 共用的 React／assistant-ui 工作台、独立 Electron 兼容宿主，以及共享协议和客户端包。科研功能、内核服务和 Zotero 插件适配仍需逐项实现。

## 开始开发

使用 Node.js 24 和根 `package.json` 指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm kernel --info
```

按需启动工作台或同一 renderer 的浏览器入口：

```sh
pnpm dev:desktop
pnpm dev:browser
```

Electron 运行时由 `pnpm setup:electron` 显式下载；工作台、宿主开发命令和 smoke 会先运行该步骤，已有匹配版本时直接复用。

浏览器默认显示未连接工作台；日常 Orca 交互使用开发态 `http://127.0.0.1:5173/?scenario=ui-foundation`，在同一工作台注入样例数据。新功能继续扩展这套 UI，入口与操作机制见[共享工作台与日常交互](docs/development.md#共享工作台与日常交互)。

验证工程入口：

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:smoke
pnpm setup:ui
pnpm test:ui
pnpm package:dir
```

准备 UI 浏览器后，无图形会话的 Linux 环境用 `xvfb-run -a pnpm check`；有图形会话时直接运行 `pnpm check`。UI 测试在 Chromium 和真实 Electron 上执行同一组行为用例。目录包用于检查两个 Electron 应用的构建布局，尚未包含正式产品所需的独立 Node、Quarto 等受管工具。

产品定位、场景、模块行为与设计约束见 [产品需求文档](docs/prd/README.md)。开发边界、调试和后续接线见 [开发说明](docs/development.md)。已确认决策见 [决策地图](.scratch/scholoom-foundations/map.md)，领域术语见 [CONTEXT.md](CONTEXT.md)，开发骨架实施记录见 [OpenSpec 变更](openspec/changes/archive/2026-10-08-initialize-project-skeleton/proposal.md)。

系统职责与数据权威见 [架构设计草稿](docs/architecture.md)，持久化、运行恢复和验证方案见 [技术设计草稿](docs/technical-design.md)，模块间操作与输入输出见 [模块接口草稿](docs/module-interfaces.md)。文档区分已确认决定、当前实现及待评审建议，并提供 PlantUML 图源和 SVG 配图。

## 许可

[GNU AGPL-3.0-only](LICENSE)。
