# zotero-agents 参考文档

本目录是对 [`~/Workspace/Code/JavaScript/zotero-agents`](https://github.com/leike0813/zotero-agents) 项目的调研笔记，服务于 Scholoom 的开发参考。

**Zotero Agents 是什么**：一个 Zotero 桌面端插件（AGPL-3.0-or-later，v0.9.0），把外部 AI Agent（Codex、Claude Code、Gemini CLI 等本地 CLI）接到用户的 Zotero 文献库上，做文献分析、检索入库、标签治理、深度精读、主题综述。

它的自我定位是「all-in-one agentic workbench」，与常见 Zotero AI 插件的区别是：**不是聊天框，而是可插拔工作流 + 可审计产物**。

---

## 为什么值得参考

| 维度 | 值得借鉴的原因 |
| --- | --- |
| 成熟度 | 2026-01 起，1042 次提交、1248 个文件、330 个测试；不足一年做到这个规模 |
| 同类性 | 与 Scholoom 目标高度重合：文献库 + AI Agent + 知识综合 |
| 完整度 | 从执行外壳、协议层、跨语言契约到发布治理，**生产级全链路** |
| 可读性 | 术语表（CONTEXT.md 19 条）、SSOT 治理文档（docs/components 52 篇）、知识图谱（`.ua/wiki` 9 层） |

---

## 阅读顺序

**想快速了解**（约 30 分钟）：

```
01-项目概览  →  03-功能地图  →  04-架构分层
```

**要做技术设计**：

```
02-技术平台  →  04-架构分层  →  06-工作流引擎与执行  →  10-宿主能力与Bridge
```

**要动手加东西**：

```
06-工作流引擎与执行  →  12-扩展指南与已知坑  →  11-开发约定与上手
```

**对 Synthesis 域感兴趣**（本项目最重的一块）：

```
08-Synthesis领域与侧车
```

---

## 文档清单

| # | 文档 | 内容 |
| --- | --- | --- |
| **01** | [项目概览](01-项目概览.md) | 定位、设计立场、命名历史、版本许可、规模数据、仓库布局、子模块、交付形态、与 Scholoom 的关系 |
| **02** | [技术平台](02-技术平台.md) | Zotero Gecko 沙箱约束、`src/platform/` 适配层、zotero-plugin 构建、依赖选型、四份 tsconfig、npm workspaces、Rust 侧车、Node 生态边界管理、本地化与主题 |
| **03** | [功能地图](03-功能地图.md) | 官方定位与差异化、四子系统、5 个文献子工作流、AI 引擎与计费、四类后端、产物如何落回 Zotero、Dashboard 承载的功能、对 Scholoom 的启示 |
| **04** | [架构分层](04-架构分层.md) | 9 层清单与文件数、四条依赖主干、双向依赖表、关系类型口径、14 步阅读路径、三个必须理解的架构决定 |
| **05** | [构建与工程化](05-构建与工程化.md) | 单一构建入口、141 条 script 分类、三层测试体系、clippy 门禁、内容包体系、帮助文档生成、发布治理、`.invariants.yaml` 机制 |
| **06** | [工作流引擎与执行](06-工作流引擎与执行.md) | **核心篇**。设计出发点、代码结构、两层 manifest、包发现与 semver 兼容、Host API v12、hook 加载与执行、执行主链路、任务队列、SSOT 三形态 |
| **07** | [Agent后端与运行时](07-Agent后端与运行时.md) | 四类后端对照、ACP 协议层、`acp-ws-bridge`、会话与 transcript 投影、6 个 ACP 预设、Skill 补丁、Host Bridge 能力注入、SkillRunner 状态机、可观测性 |
| **08** | [Synthesis领域与侧车](08-Synthesis领域与侧车.md) | 三层事实源、核心实体与表、8 个 Workbench Surface、npm workspaces 四层、canonical JSON、130 个 capability、14 个 Rust crate、原子发布、500ms 有界清理、WebDAV 同步、跨语言契约四道闸门 |
| **09** | [界面与持久化](09-界面与持久化.md) | 插件外壳与 23 步启动、`runtimeBridge`、`runtimePersistence` 唯一事实源、三块 Preact 区域、渲染稳定性契约、宿主 UI 构件、首选项、持久化治理、SQLite 门面、prefs 分工、主题与本地化 |
| **10** | [宿主能力与Bridge](10-宿主能力与Bridge.md) | Capability Broker 与写权限四步、选区上下文、Host Bridge Server、MCP Server、Host Bridge CLI、跨语言契约治理、安全模型 |
| **11** | [开发约定与上手](11-开发约定与上手.md) | AGENTS.md 组织方式与五条最该记住的硬约束、CONTEXT.md 术语表、上手路径、常用命令、OpenSpec、Hermes Profile、代码风格、提交与分支策略 |
| **12** | [扩展指南与已知坑](12-扩展指南与已知坑.md) | 新增工作流包 / 后端类型 / Skill / locale 的操作手册、**12 个已知坑**、文档漂移清单 |

---

## 核心结论速览

### 一句话架构

> **插件是执行外壳**：声明「做什么」，插件负责「怎么执行」；产物渲染自后端数据，而不是写进用户原始记录。

### 五个可复用的设计模式

1. **执行外壳与业务资产分离** — manifest 声明 + hook 契约，插件零业务逻辑
2. **Agent 写入必须经审批** — 写前无副作用预检 → 等待审批 → 重新准备 → 摘要变化需重新审批
3. **产物是投影不是正文** — 结构化数据存后端，HTML 只是渲染；用户能编辑、能检索、能增量更新
4. **推理过程与最终结果分离** — 托管笔记承载 reasoning，可编辑笔记只放结果与回链
5. **同步结构化知识不碰附件** — WebDAV 快、不冲突、不撞配额

### 三个最值得抄的工程机制

| 机制 | 出处 | 一句话 |
| --- | --- | --- |
| **跨语言契约四道闸门** | 08 篇 | JSON Schema 单一事实源 + registry 与两侧源码双向比对 + opaque leaf 白名单 + 16 个 parity 脚本 |
| **能力面显式 Pick 投影** | 06 篇 | member-level `Pick` + 对象字面量，禁 spread/proxy；"新增 broker 成员不隐式暴露" |
| **不变量带测试指针** | 08 篇 | `invariants.yaml` 的 `test_refs` 精确到测试文件与 marker 字符串 |

---

## 调研中发现的文档漂移

**这个项目自己在文档上并不完美**，参考时须注意。本目录各篇已逐项标注，主要几处：

| 漂移 | 影响 | 详见 |
| --- | --- | --- |
| `runtime-persistence-governance-ssot.md` 声明的平台根路径在代码里不存在 | **高**（路径声明错误） | 09 篇 |
| `registry.json` 的 `expected.crossProcessCapabilities = 120` 实际是 130，检查脚本硬断言 120 | **高**（漂移永不可见） | 08 篇 D-4 |
| Synthesis README 说 R9/Stage 1 未完成，dev 文档说已完成 | 中 | 08 篇 D-2 |
| Synthesis schema 版本 README 写 v5，代码是 v6 | 中 | 08 篇 D-3 |
| `local-cache.md` 说缓存"暂不实现"，实际已实现 | 中 | 09 篇 |
| README badge v0.5.0 / TS 4.0+，实际 0.9.0 / 5.9.3 | 低 | 12 篇 |
| `WorkflowHostApi` 能力数：两个文档分别写 92 和 96 | 低 | 06 篇 |

> **一条元教训**：`check:synthesis-cross-language-contracts` 把过期的期望值 120 硬断言，于是检查永远通过、漂移永远发现不了。**机器校验的期望值本身也需要被 review。**

---

## 调研方法与口径

| 项 | 说明 |
| --- | --- |
| 主要来源 | `README.md` / `AGENTS.md` / `CONTEXT.md` / `docs/`（52 篇 components）/ `site/`（56 页）/ 源码 / `.ua/wiki`（知识图谱，commit `9218f308`） |
| 规模数据 | 人工清点（`find` / `ls` / `grep`），非引用文档声明 |
| 数字冲突时 | **以代码为准**，并在对应篇目标注"文档漂移" |
| 调研时间 | 2026-10-02，仓库状态：分支 `dev`，HEAD `8394fee1`，`package.json` version `0.9.0` |
| 未覆盖 | `references/Zotero-7\|9\|10` 三个 Zotero 源码 submodule；`rust/` 全部实现细节；`profiles/hermes/zotero-librarian` 的具体内容 |

**项目内知识图谱**（`.ua/wiki/`，由 understand-anything 生成）可直接查阅：

- `README.md` — 图谱元数据
- `tour.md` — **14 步代码阅读路径**（依赖顺序排列）
- `architecture.md` — 9 层分层与依赖关系
- `layers/` — 各层文件清单
- `symbols/` — 符号级索引

---

## 提醒

zotero-agents 处于**活跃开发**中（`dev` 领先 `main` 532 个提交）。本目录记录的是 **2026-10-02 快照**，具体数字、文件行数、能力清单都可能已变化。**结构性结论比具体数字更耐久。**
