# 实际交付与交接

## 当前状态与成果

本变更已完成，共享工作台、样例来源、双宿主交互验证和 Agent 上手文档均已落实，proposal 完成判据及 tasks 全部完成。用户已要求“Implement the plan”，本轮安装、启动及验证沿该方案授权；随后用户明确批准按现有 Biome 规范执行 `pnpm format`。源码和配置已规范为 LF，最终根检查命令 `pnpm check` 全部通过。

浏览器和 Electron 都由 `main.tsx` 加载 `workbench/Workbench.tsx`，共用 assistant-ui ExternalStoreRuntime、Thread／Message／Composer 与 `styles.css`。默认未连接、材料和消息为空、草稿可编辑且发送禁用。开发态 `?scenario=ui-foundation` 动态加载样例 session，复用相同发送和呈现路径；生产参数不会启用样例。原 OrcaUiPrototype 组件和专用样式已删除，用户反馈所需的六行输入高度迁入共享 Composer。

根脚本、`playwright.ui.config.ts`、`tests/ui/fixture.ts` 和 `workbench.spec.ts` 构成共用行为 harness；原 smoke 保持独立检查构建产物。AGENTS.md 指向 [开发说明](../../../docs/development.md#共享工作台与日常交互)，实际命令集中在根 package.json。README 和续接记录已同步。

## 实际验证

环境：Windows 本机，Node 24.11.0、pnpm 11.10.0、Electron 44.5.1、Playwright 1.63.0、Orca 1.4.219；assistant-ui/react 固定为 0.15.27。

| 操作 | 实际结果 |
| --- | --- |
| `pnpm install --registry=https://registry.npmjs.org` | 通过；原镜像未提供选定版本，改用 npm 官方 registry |
| `pnpm install --frozen-lockfile --registry=https://registry.npmjs.org` | 通过，锁文件可复用，无直接依赖升级 |
| `pnpm setup:ui` | 通过，匹配 Chromium headless shell 已准备 |
| `pnpm typecheck` | 通过，包含工作区与工具／测试类型检查 |
| `pnpm build` | 通过，三个应用及共享包构建完成 |
| `pnpm test:smoke` | 3／3 通过：独立 Node、生产工作台／preload、隐藏宿主；生产样例参数仍未连接 |
| `pnpm test:ui` | 14／14 通过：同一 7 个场景分别运行 Chromium 和真实 Electron |
| `pnpm exec biome check . --formatter-enabled=false` | 通过，35 个文件；仅用于区分语义检查和换行格式，不能代替完整 lint |
| `pnpm format` | 通过，27 个文件按现有规范格式化；忽略行尾差异后，既有无关源码和配置无内容变化 |
| `pnpm lint` | 通过，35 个文件；初次因 CRLF 失败，获用户批准格式化后解决 |
| `pnpm check` | 最终整合通过：lint、类型、构建、3 项 smoke、14 项双宿主交互；UI 用例 28.4 秒，退出码 0 |
| `openspec validate establish-shared-workbench-and-ui-harness --strict` | 通过 |
| `git diff --check` | 通过 |

UI 用例覆盖未连接时输入仍不可发送、纯空白、单份／两份／无材料、发送后的材料快照、最新一轮、Ctrl+Enter、未发送草稿重置及刷新清空消息／草稿。测试只保留一个场景文件，按语义定位；5174 测试服务结束后无监听，日常 5173 继续由原本机服务运行。

本机 Orca 标签 `64d72bb8-a23f-479a-9c2f-4f944b5d9a89` 已导航至新样例入口。实际验证 snapshot、填写、发送、勾选、重置、刷新、默认未连接页，并取得和查看截图。六行空输入框实际高度为 182px；截图临时文件为 `%TEMP%/scholoom-workbench-orca.png`，未纳入源码。

HMR 在共享 Workbench 临时修改副标题再恢复：两次更新前后 `performance.timeOrigin` 均为 `1791693798193.8`，草稿“热更新应保留此草稿”、两份材料选择及两条消息保留；console 显示工作台 hot updated，相关请求为 HTTP 200。本轮最初 snapshot／eval 两次报告 `runtime_unavailable`，Orca 状态仍 ready，后续重试恢复并完成验证，没有重启或操控其他项目。

用户已发送的结构化 Design Feedback 读取及修改闭环沿 [Windows 验证记录](../../../.scratch/scholoom-foundations/research/orca-ui-windows-validation.md) 的本会话实测；此次把同一反馈要求迁入共享 Composer。没有把“独立读取未发送注释”或用户对新布局的最终确认计为通过。

## 审查与问题处理

主 Agent 核对组件、session、样例、所有入口和测试／CI 接线，保持领域协议与界面 session 分工；本轮无真实业务数据、并发内核或迁移。辅助 Agent 只实现测试与 CI，主 Agent 运行并验收。

已修正初始材料数组推断过窄的类型错误、双材料用例没有主动勾选第二份材料的问题及 import 排序。扩展既有重置／刷新用例，使其实际检查未发送草稿和已生成消息的清空；没有新增文案或样式 snapshot。

依赖变更仅增加固定 assistant-ui 直接依赖；pnpm 同时去重部分既有传递依赖，并为四个精确新版本记录发布年龄例外。工作区既有续接记录与 Windows 实测记录保留，原型修改通过共享输入高度承接。renderer 构建 JS 约 1.36 MB（未压缩），本轮未做包体优化；样例消息限于最新两条，无流式高频 DOM 更新。

## 未完成事项与下一步

tasks 无剩余事项。代码与工件保留在当前工作区，未提交或归档；后续 UI 开发沿 AGENTS.md → 开发说明 → 根脚本入口，在共享工作台上演进。

远端三平台 CI 尚未运行，目录包本轮未重新验收。真实内核／模型、持久化、Figma、最终风格和布局均按原方案留待后续功能；Orca 独立轮询未发送标注未验证。
