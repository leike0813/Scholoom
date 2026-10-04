# Scholoom

面向科研 Agent 与研究者的本地工作台，覆盖文献管理、阅读、研究执行和论文写作。

当前仓库已初始化开发骨架：独立 Node CLI、Electron 工作台、独立 Electron 兼容宿主，以及共享协议和客户端包。科研功能、内核服务和 Zotero 插件适配仍需逐项实现。

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

验证工程入口：

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:smoke
pnpm package:dir
```

无图形会话的 Linux 环境用 `xvfb-run -a pnpm check`；有图形会话时直接运行 `pnpm check`。目录包用于检查两个 Electron 应用的构建布局，尚未包含正式产品所需的独立 Node、Quarto 等受管工具。

开发边界、调试和后续接线见 [开发说明](docs/development.md)。已确认决策见 [决策地图](.scratch/scholoom-foundations/map.md)，领域术语见 [CONTEXT.md](CONTEXT.md)，本轮实施记录见 [OpenSpec 变更](openspec/changes/initialize-project-skeleton/proposal.md)。

## 许可

[GNU AGPL-3.0-only](LICENSE)。
