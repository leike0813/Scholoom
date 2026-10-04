# Synthesis 源码与 Rust 复用事实

调查日期：2026-10-03。服务于[既有源码、Synthesis 与 Rust 的复用取舍](../issues/19-existing-source-and-rust-reuse.md)。用户已确认 Synthesis 先采用 TypeScript；本笔记记录 dev 中的实现事实，具体决定以该票为准。

## 调查范围

实际源码为 `/home/joshua/Workspace/Code/JavaScript/zotero-agents`，HEAD `8394fee1a8708a0c2a04e786f6fd8c47f1f28f33`，读取时工作区干净。先使用该仓库已有 CodeGraph 定位，再核对未显示的源码、依赖声明和测试；没有创建索引、安装依赖、编译 Rust、启动宿主或运行测试。

ResearchSpec 已推进到 `df5a1c88c8403b7075c5c19249a82b43695cf60f`，不同于 references 的旧快照。相关源码调查见[ResearchSpec 复用事实](existing-researchspec-source-reuse.md)；工作流、ACP 和宿主部分见[zotero-agents 非 Synthesis 复用事实](existing-zotero-agent-source-reuse.md)。子调查中的原子性、生成校验器、兼容适配价值和许可解读已经主会话核对并收窄。

## dev 源码证明的实现边界

| 候选 | 当前实现与依赖 | 对 Scholoom 的意义 |
| --- | --- | --- |
| 引用匹配、规范引用去重 | TypeScript `referenceMatcher.ts` 有 `buildReferenceMatcherIndex` 与 `createInProcessSynthesisReferenceMatcherEngine`；Rust 独立 `synthesis-reference-matcher` crate，依赖协议、Unicode 处理与哈希，没有依赖 repository/application | 两种已有算法实现可供选择；不是必须从零写 TS，也不能据函数存在宣布完整生产性能相同。旧 `paperRef`、item key 与字段别名需接入新身份与输入契约 |
| 概念、标签与主题索引 | TS engine 包保留 concept、tag、topic 索引构建/查询；对应 Rust crates 可独立于数据库和完整 sidecar 编排讨论 | 可复用算法与行为用例。概念别名、关系与已确认决定的语义仍需遵循领域模型，不能全部当作可丢弃索引 |
| 引用图构建和指标 | TS 中存在图构建和指标计算实现；Rust 有 `synthesis-citation-graph-build`、`synthesis-metrics`。现有 worker transfer 对照脚本直接调用 TS 图构建并比较 Rust 输出 | 有明确的对照样本入口，可为抽取后的行为验证提供材料；不证明所有输入与所有算法等价 |
| 图布局 | dev Rust `synthesis-citation-layout` 使用 ForceAtlas2，含 force、radial、components；dev TS engine 只保留布局契约与结果重建 | 此处是 dev 的事实。后续已核对 main 有完整 TS 布局，使用 d3-force；可以抽取该实现，但与 ForceAtlas2 不保证坐标和行为等价，仍需验证 |
| TypeScript workspace 包 | 私有包导出 `src/index.ts`，包间使用跨目录相对导入。engine 有纯算法，但还带旧 DTO、校验、canonical JSON 规则；repository 有注入式同步 `SqlAdapter`；application 依赖三层旧契约及存储形态 | 有源码级抽取价值；不是已经发布且可直接依赖的通用 Scholoom SDK。不能将整个包目录复制作为无需适配的证据 |
| Rust 持久化与应用 | `synthesis-application` 依赖 repository/canonical-store，统一 sidecar 依赖所有计算、数据库、应用 crates。生产 TS 默认客户端创建 native composition，并以 profile、reverse Host、旧工件来源和命名 surface 接入 | 完整 sidecar 是旧产品的领域子系统。复用整套与只抽取计算是两种不同成本选择；实现可以属于同一新内核，但不能自动继承旧的数据权威、UI 状态和授权策略 |

主要源码依据：

- [TS 引用匹配与进程内入口](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:2549)、[独立 Rust matcher 依赖](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/crates/synthesis-reference-matcher/Cargo.toml:7)。
- [TS 概念索引](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/conceptKbIndex.ts:1)、[TS 图构建](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/citationGraphBuild.ts:135)。
- [Rust 布局](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/crates/synthesis-citation-layout/src/lib.rs:329)、[布局依赖](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/crates/synthesis-citation-layout/Cargo.toml:7)、[TS 布局生产约束测试](/home/joshua/Workspace/Code/JavaScript/zotero-agents/tests/synthesis/183-synthesis-citation-graph-layout-engine.test.ts:221)。旧项目的禁止 TS 规则不自动成为 Scholoom 的约束。
- [私有 engine 包](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/package.json:1)、[repository SQL 接口](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-repository/src/index.ts:127)、[application 实际导入](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-application/src/topicApplication.ts:1)。
- [Rust application 依赖](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/crates/synthesis-application/Cargo.toml:18)、[完整 sidecar 依赖](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/crates/synthesis-sidecar/Cargo.toml:10)、[TS 默认生产客户端](/home/joshua/Workspace/Code/JavaScript/zotero-agents/src/modules/synthesisClient/defaultClient.ts:1)、[Zotero/profile/reverse Host 装配](/home/joshua/Workspace/Code/JavaScript/zotero-agents/src/modules/synthesis/production/synthesisProductionOwner.ts:349)。

## 性能与跨平台证据的限度

现有[图构建对照脚本](/home/joshua/Workspace/Code/JavaScript/zotero-agents/scripts/synthesis/check-synthesis-native-worker-transfer-parity.ts:157)比较 TS 与 Rust 的样本输出；算法测试包括 reference matcher、concept KB、tag vocabulary、graph metrics/build。这里仅查阅，没有运行或宣布通过。

已有[性能脚本](/home/joshua/Workspace/Code/JavaScript/zotero-agents/scripts/synthesis/check-synthesis-production-route-performance.ts:650)覆盖 2k/10k/25k 文献的现有原生生产路径；[性能文档](/home/joshua/Workspace/Code/JavaScript/zotero-agents/docs/synthesis-layer/performance-and-scale.md:1)同时包含目标预算和旧实测说明。该路径含 TS composition、通信、Rust dispatch、SQLite 与 reverse Host，其结果不能作为“Rust 算法比 Node 算法快多少”的对照，也不能证明抽取后的 Scholoom 路径已满足同样预算。本轮没有读取到足以完成新旧路线比较的运行报告，不推断性能倍率。

现有[Cargo workspace](/home/joshua/Workspace/Code/JavaScript/zotero-agents/rust/synthesis-sidecar/Cargo.toml:1)及上述对照脚本显示多 crate、锁定依赖与指定 nightly 的构建路径。保留 Rust 会增加本项目原生构建、分平台二进制、协议与生命周期的工作；完全去掉 Rust 则要承担布局替代和算法行为验证。旧项目已有打包流程可作材料，不证明适用于 Electron 的打包、签名和支持矩阵。

用户选择先采用 TypeScript，并以 main 和历史实现补足来源。参见[main 应用实现调查](synthesis-typescript-main-application.md)与[main 计算调查](synthesis-typescript-main-compute.md)。远端 main 已通过只读 ls-remote 核对为 `2b2b540f54fbb5495e17b275530454ca6d808d5a`，包含 TS 布局；不能仅从 dev 中的 Rust 迁移形态判断 TS 来源不存在。语言选择仍需要抽取旧宿主耦合和实际验证。

## ResearchSpec 复用时需要保留的限制

[write-plan](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/core/workspace/write-plan.ts:143)提供写前检查、临时文件、备份及捕获异常后的补偿回滚；它不是已经证明的多文件崩溃安全事务，也没有提供 Scholoom 应用结果查询与文件/数据库共同恢复的完整实现。稿件锚点与保护区的复用还依赖后续主编辑格式选择。

[citations.py](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/check-citation-existence-verification/validators/citations.py:1)说明判据来自 ARS，[manifest](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/check-citation-existence-verification/manifest.yaml:42)明确标记 CC BY-NC 4.0 和 ars-derived，[仓库许可](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/LICENSE:1)为混合许可。这是具体来源事实，不代表本轮决定了 Scholoom 的许可或商业模式。CC BY-NC 的授权对复制和改编均带非商业用途条件；更换编程语言不能被当作自动消除许可条件的办法。[CC 官方条文](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)。是否内置这些素材需要明确选择，不能把它们当作用户可自行改许可的全部自有代码。

## 尚未验证

本笔记没有证明抽取后接口、独立构建、取消、恢复、性能、三平台交付或科学输出质量。后续应以选定路线所需的行为用例验证，复用已有场景与必要对照，避免复制旧 UI、固定计数、源码字符串及旧退役约束作为 Scholoom 门禁。复用方向与初期语言选择见[源码复用票的正式回答](../issues/19-existing-source-and-rust-reuse.md#answer)，物理进程、持久化及库版本由对应后续决策决定。
