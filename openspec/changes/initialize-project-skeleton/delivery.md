# 实际交付与交接

## 当前状态与成果

本变更完成开发骨架初始化。用户明确要求按既定决策初始化项目，并授权安装本轮 pnpm 依赖及完成验证；本轮没有启动开发服务器或提交代码。

- 五个 pnpm 包已建立：独立 Node CLI、Electron 工作台、独立 Electron 兼容宿主、共享协议与客户端包。源码和配置分别位于 `apps/`、`packages/`。
- TypeScript、Biome、electron-vite、electron-builder 与 Playwright 通过根脚本接线，依赖版本有共同锁文件。工作台 renderer 采用 React；main/preload 与浏览器资源分别构建。
- CLI 实际使用独立 Node；两个 Electron 应用有各自入口。工作台有 sandbox preload；宿主加载隐藏内部页面，尚未接入 Zotero 或插件。
- 三平台 CI、AGPL 许可、[README](../../../README.md)、[开发说明](../../../docs/development.md)和 AGENTS 工程入口已补齐。

proposal 的五包构建、独立 CLI、真实 Electron smoke 和打包入口判据均满足；实现范围按设计保持为开发基础。

## 实际验证

环境为本机 Linux x64，Node 24.12.0、pnpm 11.10.0；工具的确切版本以根清单和锁文件为准。

| 命令或操作 | 结果 | 证据与边界 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 通过 | 定向依赖修正后再次通过冻结安装，锁文件与 workspace 配置一致 |
| `pnpm setup:electron` | 通过 | 下载并准备 Electron 44.5.1；之后的检查复用匹配二进制 |
| `xvfb-run -a pnpm check` | 通过 | Biome 检查 29 文件；五包及工具类型检查、拓扑构建、3 个 smoke 全部通过 |
| `pnpm --filter @scholoom/desktop package:dir` | 通过 | 生成 `release/desktop/linux-unpacked`，含应用 asar 与 Electron 运行时 |
| `pnpm --filter @scholoom/zotero-host package:dir` | 通过 | 生成 `release/zotero-host/linux-unpacked`，含独立应用入口 |
| `xvfb-run -a node --input-type=module` 下的 Playwright 目录包检查 | 通过 | 分别启动上述目录中的 `@scholoomdesktop`、`@scholoomzotero-host`；工作台 heading 可见、preload 环境标识匹配，宿主内部 heading 加载且窗口隐藏，随后关闭两应用 |
| `openspec validate initialize-project-skeleton --strict` | 通过 | 中文规格保留解析所需标题与关键字 |
| Windows/macOS 与远端 CI | 未运行 | 已配置三平台矩阵，本机结果不代表其他平台通过 |
| 开发服务器、科研 Agent、真实插件验收、发布安装器 | 未运行 | 属于后续功能与发布实现范围 |

持久 smoke 位于 `tests/smoke/entrypoints.spec.ts`。成功结果记录于本机生成的 `test-results/.last-run.json`；失败时 Playwright 保留 trace，CI 上传 `test-results/`。生成的测试与目录包产物不进入源码版本库。

## 审查与问题处理

主 Agent 完成实际接线与执行核对；`minimax-cn/MiniMax-M3.1-Flash-Preview` 子 Agent 独立检查工作区工具解析、共享包类型、Electron 入口／输出布局、打包版本解析及 CI。宏观架构继续采用用户已确认的决定。

本轮已处理的问题：

- 干净工作区的 noEmit 检查不能解析尚未生成的共享包声明；根类型检查先构建共享包，并明确各包所需类型与 lib 范围。
- pnpm 11 要求使用 `allowBuilds` 声明依赖构建脚本策略；失败安装自动写入的占位项造成过重复 YAML 键，已清理并通过安装复验。
- Electron 44 无 postinstall 运行时下载；使用官方显式安装命令，并接入根 smoke 与 Electron 开发命令。
- electron-builder 26.15.3 调用缓存枚举，而原先安装的 `@electron/get` 3.0.0 缺失该 API。先尝试 packageExtensions，实际未覆盖已有依赖；最终使用定向 overrides 约束 `^3.1.0`，锁文件解析为 3.1.0，两个目录包与实际包启动均通过。依据见 [investigation](investigation.md)。
- 独立检查指出 list reporter 不生成 HTML 报告；CI 已调整为上传实际测试诊断目录。

宿主当前没有 preload，electron-vite 的缺少 preload 配置提示符合该入口范围。目录包中的作者／发布仓库元数据提示不影响本轮检查，发布配置由正式分发实现承接。

## 未完成事项与下一步

本变更没有剩余实施任务。共同 WebSocket 服务与运行时 schema 校验、单内核发现与认证、任务执行、存储、宿主监督及 Zotero 10 插件适配均尚未实现；后续按相应功能变更接入并验收。

目录包尚未包含独立 Node、Quarto/Pandoc、uv 等受管工具，也未生成签名安装器；三平台实际分发验收按 #15 落实。#21 科研效果评价仍按用户决定留到功能初步实现后讨论，#22 模型与数据运行政策保持待讨论状态。

新功能从 [开发说明](../../../docs/development.md)和对应已确认决策出发，沿 `scholoom-dev` schema 建立下一项变更。本次变更保留在活动目录，未自动归档或提交 Git。
