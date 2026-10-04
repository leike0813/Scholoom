# Nimbalyst 项目参考文档

面向 Scholoom 开发调研的 Nimbalyst 参考资料。**这些文档描述的是调研时点的 Nimbalyst 现状，不是它的官方文档。** 事实以 Nimbalyst 的代码为准；发现文档互相矛盾时，见 [09 篇的漂移清单](09-开发约定与已知坑.md#文档漂移清单7-处重要)。

## 调研快照

| 项 | 值 |
| --- | --- |
| 调研日期 | 2026-10-03 |
| Nimbalyst 路径 | `~/Workspace/Code/JavaScript/nimbalyst` |
| monorepo 版本 | `0.33.1`（private） |
| 桌面应用版本 | `@nimbalyst/electron@0.79.1` |
| 扩展 SDK 版本 | `@nimbalyst/extension-sdk@0.6.0` |
| 分析 commit | `9f13b2794d6d37ab005af6302cfe2a8540cfcdb6`（wiki） |
| 主来源 | `README.md`、`CLAUDE.md`（31KB）、`AGENTS.md`、`.claude/rules/`（17 篇）、`docs/`（79 篇）、`.ua/wiki/`（4374 页知识图谱）、`packages/*/package.json` |
| 一手核对 | 19 个包的 package.json、构建与门禁配置、`.ua/wiki` 全部 10 个分层页与 323 个目录页 |

> ⚠️ **`.ua/wiki` 只覆盖 `packages/electron` 与 `packages/runtime` 两个包**（wiki README 明示），其余 17 个包不在图谱内。涉及 CLI、移动端、marketplace 的内容来自 `docs/` 与 `package.json`。

## 文档索引

### 入门（先读这三篇）

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [01-项目概览](01-项目概览.md) | 定位、要解决的问题、技术底座、规模快照、10 层视图、14 步阅读路径 | 9 KB |
| [03-功能地图](03-功能地图.md) | 五个用户模式、12 个功能域、六种角色、关键交互原则、移动端取舍 | 10 KB |
| [04-架构分层](04-架构分层.md) | 10 个分层、15 组双向依赖、两个包的完整目录地图、被引用最多的符号 | 32 KB |

### 按子系统深入

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [05-编辑器与AI与扩展](05-编辑器与AI与扩展.md) | 无头/有头二分、DiffPlugin、canonical 事件三段式、12 个 provider、EditorHost 契约、权限三层模型 | 21 KB |
| [07-数据持久化与协作](07-数据持久化与协作.md) | PGLite↔SQLite 切换三件套、双后端适配层、恢复子系统、outbox 模式、8 种房间 | 12 KB |
| [08-进程模型与IPC](08-进程模型与IPC.md) | bootstrap、preload、83 个 Handler、窗口/托盘、文件监听、五个内置 MCP 服务 | 16 KB |

### 工程与约定

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [02-技术平台](02-技术平台.md) | Node 24/npm 11、Jotai+zustand、22 份 tsconfig、Vite 裁剪、主题体系、19 条环境坑 | 13 KB |
| [06-工程体系与包结构](06-工程体系与包结构.md) | 19 个包、9 条内部依赖边、测试体系、**17 个门禁脚本及其对应事故**、发布流程 | 25 KB |
| [09-开发约定与已知坑](09-开发约定与已知坑.md) | 破坏性路径五条三禁、JWT 隔离、会话层级不变式、命名约定、**7 处文档漂移** | 22 KB |

### 落地建议

| 文档 | 内容 | 篇幅 |
| --- | --- | --- |
| [10-对Scholoom的启示](10-对Scholoom的启示.md) | 9 个可迁移模式、10 条可抄约定、5 件必须警惕的事、按优先级的行动清单 | 13 KB |

## 最值得先知道的十件事

如果只读十句话：

1. **Nimbalyst 是「人和 agent 在同一张桌子上改同一批磁盘文件」的工作台**，不是 IDE、不是聊天壳、不是笔记应用。
2. **所有编辑器（含内置的 17 类）走同一个 `EditorHost` 契约**，自建编辑器是一等公民。
3. **17 个 `check-*.mjs` 门禁脚本，每个头部都写清了它防的是哪次真实事故**——这是全仓最值得借鉴的工程设施。
4. **不可逆迁移用「日志 + 状态机 + 对账」三件套**，恢复系统把规划与执行分离。
5. **破坏性操作：先重试、验证损害、事件前置、留可恢复产物**；并发时**直接拒绝而非排队**。
6. **transcript 走 canonical 事件 + 投影**，存储与 provider 无关，canonical 仅在内存——新增 provider 不动渲染层。
7. **穷尽表代替条件分支**（`agentCapabilities.ts` 用无可选成员的穷尽 Record），让漏声明在编译期暴露。
8. **最重的双向依赖 `ai-services ↔ main-process`（234/158）源于「按进程而非按领域分层」**——这是可以提前避开的架构债。
9. **7 处文档漂移全部是「改了代码没改文档」**；`.ua/wiki` 的对策是「正文不复制规格，只链接过去」。
10. **对外 SDK 已与 runtime 契约漂移**（`EditorHost` 缺 3 个方法、三个示例工程全部构建失败）——共享类型定义 + 发布门禁跑示例是防线。

## 关键数字速查

| 类别 | 数字 | 核实来源 |
| --- | --- | --- |
| monorepo / electron / SDK 版本 | 0.33.1 / 0.79.1 / 0.6.0 | 各 `package.json` |
| npm 包 | 19 个 workspace + 3 个独立单元 | 根 `workspaces` |
| 内部依赖边 | **9 条**（runtime 是唯一枢纽） | 扫描 `dependencies`+`peerDependencies` |
| 内置扩展 | 28 个（其中 5 个无 `main`） | `packages/extensions/*` |
| 官方市场扩展 | 26 个 | `main/data/extensionRegistry.json` |
| 内置编辑器类型 | 17 类 | `docs/FEATURE_INVENTORY.md` |
| AI provider lane | 12 条（chat 3 + agent 9） | `docs/FEATURE_INVENTORY.md` |
| 内置 MCP 服务 | 5 个 | `main/mcp/` |
| 协作房间类型 | 8 种 | `docs/IDENTITY_AUTH_AND_ROOMS.md` |
| 知识图谱 | 3135 文件 / 10813 节点 / 24771 边 / 10 层 / 15 组双向依赖 | `.ua/wiki/` |
| 门禁脚本 | 17 个 `check-*` + 25 个脚本测试 | `scripts/` |
| 测试文件 | 约 1070 | `vitest.config.ts` 注释 |
| 设计文档 | 79 篇 + `.claude/rules/` 17 篇 | `docs/`、`.claude/rules/` |
| 初始 schema | 19 表 / 71 索引 / 569 行；后续迁移到 0023 | `0001_initial.sql` |
| 记录在案的表 | 107 | `.ua/wiki/catalog.md` |

## 门禁脚本速查（每条对应一次真实事故）

| 脚本 | 防的事故 |
| --- | --- |
| `check-runtime-host-boundary` | `ClaudeCodeProvider` 拉进约 51 个桌面端文件 |
| `check-main-bundle-graph` | 改 UI 会重建 main 并重启整个应用 |
| `main-bundle-require-policy` | 懒 chunk 二次求值 main，重复注册 electron-log |
| `check-renderer-sync-sockets` | `TeamSyncProvider` 漏传，Shared Docs 全线静默失效 |
| `check-shared-document-nodes` | collab-bundle 漏注册，桌面文档在 Web 端打不开 |
| `check-json-accessor-indexes` | 索引声明与谓词不匹配，热查询吃 31% worker 时间 |
| `check-team-lane-crypto-names` | 旧命名误导 agent，否掉正确的冲突合并设计 |
| `check-push-authors` | 10 个测试夹具 commit 被推到公开 main |
| `check-toolchain` | node 版本不符被误报成 lockfile 漂移 |
| `check-override-sync` | override 停在旧版，依赖升级被无提示抵消 |
| `check-collab-client-boundaries` | headless 入口被 UI 侵入 |
| `check-analytics-allowlist` | 不在名单上的事件被服务端静默吞掉 |
| `check-identity-scopes` | 个人/团队 JWT 作用域逃逸 |
| `check-ui-invariants` | `var(--nim-*)` 引用了未定义 token |
| `check-sync-floating-promises` | 移动端同步 API 被静默改成同步函数 |
| `check-override-sync` / `check-text-file-nuls` / `check-collab-bundle` | 一致性与体积基线 |

## 调研方法与可信度

**一手核对**（读文件与脚本提取，非文档转述）：

- 19 个包的 `package.json` 批量提取，计算内部依赖拓扑（9 条边）
- `.ua/wiki` 全部 10 个分层页 + `architecture.md` + `catalog.md` + 323 个目录页中的核心部分
- 全部 `check-*.mjs` 的头部契约注释
- 根 `package.json` 的 scripts 分类、`.githooks/pre-push` 分阶段
- `docs/` 的关键设计文档与 `CLAUDE.md` 全文

**未核实**（已在文中标注）：

- `docs/AGENT_PERMISSIONS.md`（553 行）、`INTERNAL_MCP_SERVERS.md`（921 行）、`VOICE_MODE.md`（494 行）、`JOTAI.md`（692 行）、`EXTENSION_ARCHITECTURE.md`（963 行）、`COLLABORATION_GUIDE.md`（358 行）只读了部分章节
- 浏览器扩展与 Node 嵌入的定位只来自 `package.json` description 与 README 片段
- 文档中引用的**行号与文件路径未逐一对照源码确认**
- `main-process ↔ shared-foundation` 那唯一 1 条反向边的具体来源未定位
- `renderer-state ↔ renderer-ui` 反向 55 条是否都是分层记账假象，未逐条核实

**未深入**（按需求控制深度）：

- iOS（Swift）与 Android（Kotlin）源码——只看了构建脚本与 `FEATURE_INVENTORY` 描述
- 28 个内置扩展的各自实现——只看了 SDK 契约与市场注册表
- Cloudflare sync server——独立项目，不在本仓库
- `CHANGELOG.md`（446KB）、`IOS_CHANGELOG.md` 的历史条目

## 相关参考

同目录下还有：

- `../ResearchSpec/` — ResearchSpec 研究工作流框架（16 篇）
- `../Zotero/` — Zotero 桌面应用（11 篇）
- `../zotero-agents/` — Zotero-Agents 插件（12 篇）

**横向可比的一组**：ResearchSpec 是「CLI 独占状态写入、文件即接口」的 CLI 框架，Nimbalyst 是「多进程 + 大量门禁脚本」的桌面应用。两者在「不可逆操作如何设防」这个问题上给出了互补的答案——ResearchSpec 靠路径边界与写入计划，Nimbalyst 靠操作锁、持久化日志与 17 个扫描脚本。
