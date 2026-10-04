# 08 Synthesis领域与侧车

Synthesis 是这个项目最重的一块（357 个文件，占全仓一半以上体量）。它的核心命题：**派生知识层整体交给一个 Rust 进程，TypeScript 侧只剩客户端。**

## 领域定位：三层事实源

`docs/synthesis-layer/README.md:111-125` 给出核心架构句：

> Zotero Library 是库事实 SSOT，artifact note 是文献工作流 SSOT，Synthesis 持久化是「可容忍陈旧的 sidecar cache + 用户批准的派生决策」。

展开成优先级链：

```
Zotero Library（库事实）
      ↓
artifact note（文献工作流产物）
      ↓
sidecar 持久化（可弃缓存 + 用户批准的派生决策）
```

关键的权限规则（`domain-model.md:47-48`）：

> A cache rebuild may preserve or flag them as `needs_attention`; **it must not silently overwrite them.**

即**用户批准的派生决策不可被自动重建覆盖**。这条把「缓存」与「决策」的边界划清了。

README 的正面表述：

> Index/cache state may be stale, missing, or partially refreshed **without blocking** literature digest or topic synthesis.

**允许陈旧，但不许丢用户决策** —— 这个组合是整个域的设计基调。

## 核心实体

术语 SSOT 是 `docs/synthesis-layer/glossary.md`（68 行，Identity / Domain / Freshness / Runtime 四组表）。

### 身份与引用链

| 实体 | 定义要点 | 表 |
| --- | --- | --- |
| `libraryId:itemKey` | Zotero item 绑定。**删除/重导入后不稳定，不得当持久学术 ID** | — |
| `source_ref` | 格式 `<libraryId>:<itemKey>` | `synt_reference_source` |
| Artifact sidecar row | 只记 digest / references / citation-analysis 三类 artifact 的**存在性 + hash + locator**；**禁止复制 Zotero 元数据** | `synt_reference_artifact` |
| Raw reference | 从 `source_ref` + `references_artifact_hash` 抽出的单条引用；hash 替换后转 `stale` | `synt_reference_raw` |
| Canonical reference | Synthesis 自有的去重代表；存归一化身份证据与重定向，**不是 Zotero item 副本** | `synt_reference_canonical` |
| Canonical reference redirect | 去重/合并后的持久事实；**读必须穿透 redirect** 解析 effective canonical | `synt_reference_redirect` |
| Reference binding | canonical reference → 当前 `libraryId:itemKey` 的已接受事实 | `synt_reference_binding` |
| Reference match proposal | 高级匹配器的可审候选，状态 `open`/`accepted`/`rejected`/`superseded` | `synt_reference_match_proposal` |
| External work node | 有效 canonical reference 但**当前未绑定** Zotero item | `synt_citation_node` |

**「自动 vs 人工」只是 provenance，不是状态** —— 这条区分很关键，避免了用状态字段表达来源的常见错误。

### 已废弃的术语

glossary 明确标为 removed：`literature_item_id`、Registry binding、`registry_epoch`、`graph_basis_registry_epoch`、dirty event。README 追加废弃：WorkItems、WorkRuns、startup reconcile、queue drain、Registry rebuild。

⚠ 这里有个陷阱：`invariants.yaml` 的 `inv.sidecar.old_sync_removed`（severity **fatal**）明确禁止把这些概念**以任何形式（含兼容层）复活**。读旧文档时看到这些词，多半是历史遗留。

### 图与主题域

| 域 | 表 |
| --- | --- |
| Citation Graph | `synt_citation_node` / `_edge` / `_metrics_light` / `_metrics_complex` / `_layout_state` / `_incoming_group` / `_source_ownership` |
| Topic Graph | `synt_topic_graph_node` / `_edge` / `_review_item` |
| Topics | `synt_topic_discovery_hint`、`synt_topic_application_state` |
| Concept KB | `synt_concept`、`synt_concept_sense`、`synt_concept_alias`、`synt_concept_relation`、`synt_concept_review_item`、`synt_topic_concept_link` |
| Tag Vocabulary | `synt_tag_vocabulary_entry`、`synt_tag_staged_suggestion`、`synt_tag_audit*`（5 个）、`synt_tag_effect` |
| 运行时 | `synt_cache_basis`、`synt_operation`、`synt_review_item` |

### Concept KB 的语义规则

`concepts.md` 对 alias 的定义非常严格：

> alias = 同一 concept 同一 sense 的可互换名（缩写/全称、拼写变体、可靠翻译）。**相关概念、上位/下位、成分、任务、方法、数据集、基准、应用都必须建独立 concept 或 relation，不能塞进 alias。** canonical label 不得重复进自己的 alias 列表。

自动合并的**唯一**条件：proposal label **精确匹配**一个 canonical concept label。

有向 relation：`broader_than` 是唯一标记为 `DIRECTIONAL` 的关系。

### Topics ↔ Concepts 反腐化契约

`domain-model.md:60-92` 定义显式双向 DTO：

| 方向 | DTO |
| --- | --- |
| Topics → Concepts | `concept_card_proposal` / `topic_concept_link_proposal` |
| Concepts → Topics | `concept_overlay_context` |

硬约束：overlay 失败**不得**阻断 Topic 列表/详情/创建/更新；overlay 输出**不得**写入 topic source manifest 或 source-check baseline；Concept 摄入失败**默认不回滚**已成功 apply 的 topic artifact。

## 8 个 Workbench Surface

surface 名 SSOT 在 `packages/synthesis-contracts/src/workbench.ts:27-40`：

| Surface | 投影类型 | 操作实体 |
| --- | --- | --- |
| `home` | `…HomeSurfaceProjection` | Topic artifact 行、已删除 artifact、topic 分页 |
| `topics` | `…TopicsSurfaceProjection` = Home **+** `topicGraph` | Topic + Topic Graph node/edge/review/inspector |
| `index` | `…IndexSurfaceProjection` | registry：参考计数、canonical 行、match proposal、cache status |
| `review` | `…ReviewSurfaceProjection`（三分支联合） | 按 `state.reviews.activeTab` 动态解析 |
| `graph` | `…GraphSurfaceProjection` | Citation Graph nodes/edges/window/layout/算法 |
| `tags` | `…TagsSurfaceProjection` | Tag rows、staged rows、facets、validation warnings、import preview |
| `concepts` | `…ConceptsSurfaceProjection` | Concept rows/senses/aliases/relations/review/overlay |
| `reader` | `…ReaderSurfaceProjection` | 单 topic 详情 + source papers + discovery |

`review` 的三分支（`workbench.ts:759-780`）：

```
activeTab === "concepts"    → ConceptReviewSurfaceProjection
activeTab === "topic_graph" → TopicGraphReviewSurfaceProjection
否则                        → ReferenceReviewSurfaceProjection
```

⚠ **tab 与 surface 是两套不对齐的词表**：
- `SynthesisWorkbenchTab`（wire 层，8 个）= `overview|artifacts|registry|reviews|tags|concepts|graph|reader`，其中 `reader` 是隐藏 tab（`NavTab = Exclude<Tab,"reader">`）
- Rust 侧 surface = `home|topics|index|review|graph|tags|concepts|reader`

判断"某个界面叫什么"时必须先确认在哪一层。

## npm workspaces 四层

### 关键事实：无构建产物

四个包 `version` 全部 `0.1.0`、`private: true`、`type: module`，`exports` 与 `types` **直接指向 `./src/index.ts`**。**没有 dist、没有编译步骤**，靠 `tsc --noEmit` 做边界检查。

这就是"源码即接口"的纯类型包——好处是改类型立即生效、无构建产物漂移；代价是每个消费方都要能编译 TS 源。

### 依赖方向

⚠ **一个常见误解**：四个包的 `package.json` 之间**没有任何 `dependencies` 字段**，也没有任何 `@zotero-agents/synthesis-*` 形式的 import。真实依赖走**相对路径** `../../synthesis-contracts/src/x.js`。

```
synthesis-contracts  (叶子，0 依赖，53 文件)
   ▲        ▲
   │        └── synthesis-repository   (→ contracts 4 处，10 文件)
   │
   ├── synthesis-engine               (→ contracts 8 处，9 文件)
   │
   └── synthesis-application          (→ contracts 23 / engine 20 / repository 10，17 文件)
```

分层严格、无环。`synthesis-engine` 只碰 contracts 的 4 个 core 文件（`canonicalJson`、`conceptKbCore`、`tagVocabularyCore`、`topicGraphCore`）；repository 只碰 4 个。

`synthesis-contracts/src/index.ts` 有 **51 条 `export * from`**。

| 包 | 职责 |
| --- | --- |
| `synthesis-contracts` | wire 契约、DTO、JSON Schema 绑定、canonicalJson、sidecar 系统/传输/打包、能力矩阵 |
| `synthesis-engine` | 环境无关算法：referenceMatcher、conceptKbIndex、topicGraphIndex、tagVocabulary、citationGraphBuild(+Transfer)、topicStructuredArtifact |
| `synthesis-repository` | SQLite 仓储：durableBundle、knowledgeCheckpoint、tagVocabulary、topicGraph、conceptKb、citationGraph、referenceRefresh、referenceMatchingReview |
| `synthesis-application` | 应用服务编排：`topicApplication`、`referenceProjection`、`citationGraphApplication`、`webDavSyncApplication`、`durableBundleApplication`、`debugMaintenanceApplication` 等 |

## canonical JSON：寻址的基础

`packages/synthesis-contracts/src/canonicalJson.ts`（302 行）。**SHA-256 是手写纯 TS 实现**（64 个 K 常量、FIPS 180-4 压缩、big-endian DataView、小写 hex）——不依赖 WebCrypto，因为 sidecar 侧是 Rust，需要完全一致的确定性。

### 实际规则（与常见 JCS 不同）

| 项 | 实际规则 |
| --- | --- |
| 对象键排序 | **UTF-16 码元序**（`left < right ? -1 : 1`），**不是 `localeCompare`** |
| `undefined` | 对象中**跳过该键**；数组中/顶层 → `null` |
| 非有限数 | `!Number.isFinite` → `null` |
| `-0` | → `0` |
| 数组 | **保序，不排序** |
| 循环引用 | 抛 `canonical_cycle`，**路径级**检测（允许重复引用） |
| 未配对代理项 | 抛 `canonical_unpaired_surrogate` |
| 错误定位 | JSON Pointer 形式 `$[0].key` |

**用自带的码元比较器而不是 `localeCompare`**，因为后者随 locale 变化，会破坏跨语言确定性。这是跨语言哈希一致性最容易踩的坑。

哈希输出带前缀：`sha256:<hex>`。

## sidecar 契约

### 调用 envelope

```ts
{ protocol, requestId, profileId, capability, payload, trace? }   // 5 必填 + 1 可选
```

协议常量：`synthesis-sidecar.v1`；健康检查 `/synthesis/v1/health`；调用 `/synthesis/v1/call`。

响应二分：
- `SynthesisSidecarSuccess` = `{ok:true, requestId, serviceInstanceId, data, diagnostics[]}`
- `SynthesisSidecarFailure` = `{ok:false, requestId, serviceInstanceId, error}`

### 能力矩阵：130 个

| 组 | 数量 |
| --- | --- |
| `SYNTHESIS_SIDECAR_PRODUCTION_CLIENT_CAPABILITIES` | **104** |
| `SYNTHESIS_SIDECAR_CAPABILITIES`（含 compute/transfer/worker + 前两组） | 9 |
| `SYNTHESIS_REVERSE_HOST_CAPABILITIES` | 17 |
| `SYNTHESIS_SIDECAR_SYSTEM_CAPABILITIES` / `GENERAL_CAPABILITIES` | 各 2 |
| **合计** | **130** |

有固化指纹：`SYNTHESIS_SIDECAR_PRODUCTION_CLIENT_CAPABILITY_FINGERPRINT = "d2f8d0e6…5aa0f1"`。

### 限额

```ts
requestBodyBytes        1 MiB      jsonDepth         32
compute 请求/响应       8 MiB      jsonNodes         50k（compute 请求 1M、响应 200k）
stringLength            64 KiB     requestId/ProfileId 512
```

**按能力分层的预算**是这里的关键设计：普通请求严格 1 MiB/50k nodes，大工作走 compute 能力（8 MiB/1M nodes），而不是把通用请求放宽。

### 错误码只有 4 个

`transfer_incomplete`、`transfer_output_not_ready`、`transfer_stopping`、`internal_error`。

**故意极少**。TS 客户端层另有 `SynthesisClientError("invalid_request"|"internal"|"unavailable"|…)`，且 **invalid_request 在 result 方向被映射成 `internal`** —— 防止对端通过错误码探测契约内部。

### 七平台 bundle 布局

| target | Rust triple |
| --- | --- |
| `win32-x64` | `x86_64-pc-windows-msvc` |
| `darwin-x64` | `x86_64-apple-darwin` |
| `darwin-arm64` | `aarch64-apple-darwin` |
| `linux-x86` | `i686-unknown-linux-gnu` |
| `linux-x64` | `x86_64-unknown-linux-gnu` |
| `linux-arm` | `armv7-unknown-linux-gnueabihf` |
| `linux-arm64` | `aarch64-unknown-linux-gnu` |

两个 schema：`synthesis-sidecar-runtime-bundle.v3` / `...-pointer.v2`。manifest 含 `buildFingerprint`、provenance（`sourceFingerprint`/`toolchain`/`cargoLockSha256`/`licenseInventory`）、files[]（`path`/`bytes`/`sha256`/`executable`）。

校验极严：拒绝未知字段与缺字段、RFC3339 UTC 正则、相对路径拒绝 `\`/前导 `/`/尾随 `/`/`.`/`..`、SHA-256 `^[a-f0-9]{64}$`。

**签名状态诚实建模**：注释明写「it is **not** a v3 bundle admission proof」；Linux → `{scheme:"not-applicable"}`；win32 → `authenticode`；darwin → `apple-code-signing`；当前状态都是 `"unsigned-candidate"`, `signer: null`。

**不假装已签名**，这比伪造一个签名状态强。

## Rust sidecar

### 14 个 crate

| 层 | crate | 职责 |
| --- | --- | --- |
| **协议内核** | `synthesis-protocol` | **零依赖**。15 个 `*_OPERATION` 常量、`WORKER_PROTOCOL="synthesis-rust-worker.v1"`、`compare_utf16` |
| | `synthesis-test-support` | **零依赖**。`TestRoot` 隔离测试目录 |
| **算法**（只依赖 protocol） | `synthesis-metrics` | 图指标。DAMPING=0.85、ITERATIONS=50；foundation `0.50*in_degree+0.35*pagerank+0.15*age` |
| | `synthesis-citation-layout` | 布局算法。`LAYOUT_VERSION=2`、`NODE_MAX=20_000`、`EDGE_MAX=80_000`，用 `forceatlas2` |
| | `synthesis-citation-graph-build` | 图构建 + 分页传输。`CONTRACT_VERSION="synthesis-citation-graph-build.v1"` |
| | `synthesis-reference-matcher` | 引用匹配/绑定/去重。`BINDING_ALGORITHM_VERSION`、`DEDUPE_ALGORITHM_VERSION` |
| | `synthesis-concept-kb` | Concept KB 索引/查询。`SCHEMA_VERSION="1.0.0"` |
| | `synthesis-topic-graph` | Topic Graph 索引；**每 256 项**检查一次取消 |
| | `synthesis-tag-vocabulary` | Tag 词表。用 `regress::Regex`（`utf16` feature 以对齐 TS 正则语义） |
| | `synthesis-topic-structured-artifact` | topic manifest 校验/artifact 组装/section patch |
| **存储** | `synthesis-canonical-store` | Topic canonical **文件**存储。`sha2::Sha256` + `BTreeMap` + 原子写 |
| | `synthesis-repository` | SQLite 仓储 + schema 迁移。`SCHEMA_VERSION = "synthesis-repository-foundation.v6"` |
| **应用** | `synthesis-application` | 应用服务编排（17 module） |
| **运行时** | `synthesis-sidecar` | **唯一二进制**。29 module |

`synthesis-sidecar` 依赖全部 12 个其他 crate；其余任一 crate 都不反向依赖它。分层干净。

release profile：`codegen-units=1, lto=true, opt-level="z", strip=true`。

⚠ `panic="abort"` 与「handler_panicked 统计」表面矛盾——需要实际跑才能确认这些路径是否只在 test profile 生效。

### 启动：16 步带回滚

`serve()` 极简（`RunningRuntime::start(config)?.run()`）。真正的编排在 `start()`，用 `startup_step(name, || ...)` 逐步记录，**每一步失败都触发 `startup.rollback()`**。

关键步骤顺序：

1. `read_native_launch_config` → `configure_debug_events` → `install_observation_context`
2. `config-validate`
3. `ProductionClientCatalog::from_embedded()` ← **能力目录编译进二进制**
4. `reverse-host-probe`
5. `owner-acquire` → 拿 `service_instance_id`
6. `source-validate`
7. `source-classify` — 若有 legacy：`CanonicalStore::preflight_legacy_production` + `project_legacy_canonical_topic`；**canonical_topic_ids 必须与投影集合完全相等**
8. `repository-migrate`（备份到 `<db_dir>/synthesis-migration-backups`）
9. `repository-open` → 10. `canonical-open` → 11. `application-compose`
12. `reconcile_restart`
13. `transfer` → 14. `listener-bind` → 15. `discovery-publish`
16. `println!({"type":"listening", port, buildFingerprint})` → `startup.commit()`

### discovery 的原子发布

schema `synthesis-sidecar-discovery.v5`，路径 `<profile_runtime_root>/discovery.json`。

`atomic_write_json` 的五步（`runtime_lifecycle.rs:196-235`）：

1. `create_dir_all(parent)`
2. 临时名 `.discovery.tmp-{pid}-{ms}`，**`create_new(true)` 独占创建**
3. 写 bytes
4. **`file.sync_all()`（fsync）**
5. drop → rename

**Windows 单独分支**：先 `rename(path, .discovery.previous-{pid}-{ms})` 再改名临时文件——因为 Windows 的 rename 不能覆盖既有文件。

清理对称：`impl Drop for RuntimeOwnership { fs::remove_file(&self.discovery_path) }`。

**stale discovery 主动清理**：先取 `synthesis.lock` 的 `try_lock()`（`WouldBlock` → `production_lock_conflict`）→ 删除旧 discovery → 严格校验路径形状后遍历 `sessions/`，删除除自己以外的所有 session 目录。

### 500 ms 有界清理

`const SHUTDOWN_TIMEOUT: Duration = Duration::from_millis(500);`

`shutdown()` 用一个**全局共享预算**（不是每步各 500 ms）：

1. `transport.begin_shutdown()`
2. `background_tasks.stop_admission()`
3. `canonical_autosync.shutdown()`
4. `references.quiesce(剩余预算)`
5. `compute_pool.stop()`
6. `transfer.request_stop()`
7. `background_tasks.stop_and_drain_until(deadline)`；`panicked>0` 记 issue；`remaining>0` 记 `background_task_drain_timeout:{n}`；**`remaining==0` 才 `transfer.finalize_stop()`**
8. `transport.drain(deadline)`；handler_panicked / pending_handlers 分别记 issue
9. `webdav.shutdown(剩余预算)`
10. `can_close_storage = remaining==0 && pending_handlers==0`；**只有 true 才 `Arc::try_unwrap` 真正关闭**（否则只 drop，泄漏也只记 issue）
11. `ownership.take()` → 触发 discovery 删除
12. `stop_signal.finish()`

**设计意图：清理永不阻塞超预算，宁可记录泄漏也不挂死。** 失败不 panic，走 `record_cleanup_issue` 累积成 `ServeFailure`。

## 进程与通信

**发现**：Rust 写 discovery.json；TS supervisor 轮询直到超时，并做**三重身份校验**：

```ts
discovery.profileId === profileId
  && discovery.supervisorInstanceId === supervisorInstanceId
  && discovery.bundleId === install.bundleId
```

不匹配 → `sidecar_discovery_identity_mismatch`；超时 → `sidecar_discovery_timeout`；进程先退出 → `sidecar_process_exited_before_discovery`。

**连接**：`http://127.0.0.1:${port}`，POST `/synthesis/v1/call`，头 `authorization: Bearer ${clientToken}`。token 通过 session 取得（`tokenLocator: "supervisor-session"`），**不走 discovery 文件**。

**TS 调用链**：

```
defaultClient.ts          代际生命周期管理（generation 计数 + cleanupTasks）
  → nativeComposition.ts   组装 baseUrl + 分组 client
    → synthesisSidecarRpcClient.ts        传输层
      → {Compute,Transfer,Workbench,Control}Client    按能力族分组
    → synthesisSidecarRuntimeSupervisor.ts 进程生命周期
  → src/modules/synthesis/reverseHost/     反向 Host（Rust 回调 Zotero）
```

**反向 Host 端口**（`inv.runtime.single_production_owner`）：Rust 不直接碰 Zotero，通过显式 reverse-host 端口回调。**凭据、URL 构造、HTTP、abort 权威全在 TS 插件侧**，Rust 只见无密钥的 `SynthesisHostWebDavSyncPort`。

## 存储：两个 schema，别搞混

| schema | 位置 | 表数 |
| --- | --- | --- |
| `synthesis-repository-foundation.v6` | Rust `synt_*` 表 | **62 表 / 51 索引** |
| `skills_src/topic-synthesis/contracts/db-schema.sql` | **TS/Skill 侧，与 sidecar 无关** | 表名无 `synt_` 前缀 |

⚠ **`db-schema.sql` 与 `contracts/` 不是"schema 拆分关系"，而是两个不同子系统的两套 schema。** `db-schema.sql` 的头部注释写明它是 "SQLite state machine for the generated topic synthesis **split-skill runtime**"。

真正的跨语言 SSOT 是 `packages/synthesis-contracts/contract-set/`（20 个 contract-set 目录，`synthesis-sidecar-protocol-v1` 单独 676K）。

SQLite pragma：`journalMode=wal`、`synchronous=1`(NORMAL)、`foreignKeys=1`、`busyTimeout=250`。

**并发策略：单 writer 串行化 + 最多 4 个只读连接**。图的结构、复杂指标、布局计算**全部在 writer 事务之外**；promotion 只把 writer 段限制在"图替换 + ready-cache 提交"。

## 性能预算

四个 scale tier：

| tier | 绑定文献 | reference 实例 | 外部文献 | topics |
| --- | ---: | ---: | ---: | ---: |
| normal | ≤ 2,000 | ≤ 100,000 | ≤ 60,000 | ≤ 40 |
| target | ≤ 10,000 | ≤ 500,000 | ≤ 300,000 | ≤ 100 |
| stress | ≤ 25,000 | ≤ 1,250,000 | ≤ 750,000 | ≤ 250 |

UI p95 预算：chrome input 150 ms；active surface 500 ms；表格页 250 ms；cleanup/review 250 ms；topic list 250 ms；graph 分级（normal ≤1000 / target ≤2500）；operation popover 150 ms。

文档自陈（`performance-and-scale.md:3`）：

> Budgets are engineering guardrails, **not a promise that every current implementation already meets them**.

增量手段：graph cache 按 source_ref 增量重建（1500 ms/slice）；`commitCitationGraphPromotion({expectedGraphHash, ...})` 用 **CAS** 防中间态污染 last-good。

## 大图传输

单一能力 `compute.citation_graph_build_transfer`，8 个严格 action：`begin` / `put_input_page` / `seal_input` / `execute` / `status` / `get_output_manifest` / `get_output_page` / `cancel`。

固定边界：canonical page 4 MiB；page nodes 100,000；pages/direction 256；bytes/direction 1 GiB；active sessions 2；staged bytes 2 GiB；idle 5 min；absolute 30 min；unacknowledged pages 1。

### 哈希语义

**page SHA-256 覆盖「严格重建后的 canonical JSON 行」；root SHA-256 覆盖 canonical header + 有序 descriptors。**

因此：**上传顺序无关**（乱序上传结果一致），但**内容漂移必冲突**。未满足"全部 descriptor + 有序 root 匹配"不得 seal。

### 权限边界（防伪造的关键）

- 输出"remains service-internal and is produced **only** by the Rust worker attempt associated with an authenticated `execute`"
- worker "has **no** staging path, repository, canonical-file, Host, or Zotero authority"
- 输出页写进 attempt 目录，**只有服务重建最终 manifest 并原子提交后才可寻址**
- **basis 重捕获与 repository promotion 只在完整提交的 attempt 之后发生** → 部分/取消的传输**无法替换 last-good 图**

文件系统安全：`0700` 目录、`0600` 文件、原子页替换。取消/过期/关闭**先撤销可寻址性并把目录改名为 tombstone**，删除 best-effort 且启动时重试。**服务重启后 session 永不恢复。**

## WebDAV 持久同步

**同步什么**：确定性的 durable bundle，**永不复制活动 SQLite**。

- 远端 = 不可变快照 + 一个可变 `HEAD.json` 指针
- 本地 staging 在 `runtime/synthesis/webdav-sync/**`（可弃）
- 本地状态原子存 `state/native-webdav-state.json`（**永不入 bundle**）

**bundle 排除**：`synthesis.db`+WAL+SHM、operation 与 cache-basis 行、citation/topic graph 投影与 metrics 与 layout、日志/锁/凭据/临时工作区。

**冲突处理**：import 永远 preview-first。干净 preview 才写入。冲突产生**持久冲突报告并阻断 apply** —— "the runtime **never** chooses last-writer-wins silently"。运行期间远端指针变化 → run 以 retryable 失败，**而不是覆盖更新的指针**。

### 崩溃安全：durable import receipt 作为提交证人

receipt 提交后，live apply 与下一次生产 acquisition 走**同一完成路径**提升匹配的 canonical batch、校验每个 target、清 receipt。**没有 receipt 的 staged batch 是提交前证据，会被丢弃。** receipt/batch/target 任一不匹配 → 在 listener bind 和 ready discovery **之前**让生产 acquisition 失败。

### Autosync 触发集是固定枚举

Topic apply/delete、Tag 词表 6 类、Concept display/review/delete、Topic Graph accept/reject/review、3 个 reference refresh——由**中心化 post-commit 分类器**维护，而不是分散在各 application handler。

判定脏需**同时**满足「成功的 mutation DTO」+「非零 repository SQL 写计数」。**WebDAV 失败因此永远是提交后的，不会回滚本地变更。**

debounce 5 秒尾沿；重试退避 `60s / 5m / 15m / 30m`（默认关闭），用**可中断的 generation condition**；**启动不恢复隐藏重试定时器**。

## TypeScript 侧投影

| 目录 | 职责 |
| --- | --- |
| `src/synthesis/`（53 文件） | Preact 页面区域 + 视图投影。按 surface 切 Region + `synthesisSurfaceProjection.ts` |
| `src/modules/synthesis/`（43 文件） | Host 侧集成层：sidecar 监督/RPC/传输（`sidecar/` 10 个）、reverse host（3 个）、生产所有者（2 个）、Zotero 适配器、WebDAV 适配器 |
| `src/modules/synthesisClient/`（5 文件） | 组合根：`nativeComposition.ts`、`defaultClient.ts`、`clientPortAdapter.ts` |

**UI 层是纯投影**：`workbench-ui.md` 与 README 都声明 "read-only paths do not mutate readiness or operation state"。

### wire contract 的两个设计

`src/shared/synthesisWorkbenchWireContract.ts`（1328 行）：

1. **页面 bundle 只从 `src/shared` 取类型，不引 `packages`** —— 打包体积隔离
2. **抗竞态**：`SurfaceRequestMeta.requestId: number` + `selectedTabAtRequest` + `libraryReadModelRevision` + `startedAt`；graph 另有 `generation` 必须与 staged window 匹配。**页面据此丢弃过期响应。**

`SynthesisWorkbenchSnapshot` 是**单一巨型 DTO**，按 15 个域分节（maintenance/storage/preferences/sync/conflicts/artifacts/registry/reviews/tags/topicGraph/concepts/graph/reader/hostCommands）。

⚠ 一处**已知无机器强制**的手工同步点（文件内注释自陈）：`SynthesisWorkbenchHostCommandName` 必须与 `src/modules/synthesis/uiModel.ts` 的 `SynthesisUiHostCommandName` 保持同步。

## 跨语言契约：四道闸门

这是本项目最值得学的工程手法。

**闸门 1：JSON Schema 单一事实源**。`contract-set/synthesis-sidecar-protocol-v1/`（676K）含 `registry.json` + `schemas/*.schema.json` + `corpus/`。TS 侧用 **Ajv 2020** 运行时双向校验（`strict: true, allErrors: true`），validator 按 location 缓存。校验失败只回传**最多 16 条** `{keyword, instancePath}`，不泄漏内部结构。

**闸门 2：registry 必须与两侧源码精确相等**。`check-synthesis-cross-language-contracts.ts:355-410`：

```ts
const expectedCapabilities = [
  ...SYNTHESIS_SIDECAR_PRODUCTION_CLIENT_CAPABILITIES,  // 104
  ...SYNTHESIS_SIDECAR_CAPABILITIES,                    //   9
  ...SYNTHESIS_REVERSE_HOST_CAPABILITIES,               //  17
].sort();
// 与 registry.capabilities 做双向 set difference
```

worker 侧更硬——**直接正则解析 Rust 源码**：

```ts
[...source.matchAll(/^pub const [A-Z0-9_]+_OPERATION: &str = "([^"]+)";/gm)]
  .map(m => m[1]).sort();
```

实测 15 个 operation，与 `registry.workers` 一致。

**闸门 3：opaque leaf 白名单**。遍历所有 capability/worker 的 schemaRef，统计未授权的泛型逃逸；只有 `registry.opaqueLeaves` 显式登记的（带 `owner`/`schemaId`/`codec`/`maxBytes`/`maxDepth`/`maxNodes` 元数据）才允许不透明。最后产出 canonical-JSON `fingerprint`。

**闸门 4：16 个 parity/check 脚本**，每个 contract-set 一个。

## 状态机：机器可读 + 测试指针

`contracts/states-and-events.yaml`（346 行）：**11 个 `sm.*` 状态机 + 13 个 `seq.*` 序列**。

`contracts/invariants.yaml`（195 行）用 `severity: fatal|high` + `evidence` + **`test_refs`（精确到测试文件与 marker 字符串）** 把不变量绑到测试。

**这是本项目最值得直接抄的一点：不变量不是散文，而是带机器可执行指针的清单。**

`state-machines.md` 另有「State Combination Governance」一节——**约束状态机之间的合法组合**，而不只是单个机器内部。

## 迁移状态：README 落后于 dev 文档

⚠ **README 与 `docs/synthesis-layer/README.md` 说 "R9 / Stage 1 acceptance 未完成"，这是过期的。**

`docs/dev/synthesis-r9-stage1-acceptance.md:139` 明确：

> **R9 and Stage 1 acceptance are complete.** The XPI remains unpublished; release tags/assets, feeds, production pointers, and Gitee synchronization remain outside this change.

已通过：6 个阻塞兼容 cell（Windows 7.0.32/9.0.6/10.0.1 + Linux 7/9/10）、离线安装、升级 smoke（0.6.2 → 0.9.0）、installer 演练、real-process 演练、supervisor 演练（3 次 pre-ready 崩溃用完 2 次重试预算后熔断为 `sidecar_crash_loop_fused`；graceful-stop 缺失时 **507 ms 后强杀**）、v5→v6 迁移演练、operator runbook 演练。

**仍未做**：XPI 发布、release tag/asset、feeds、production pointers、Gitee 同步。macOS Zotero 10 XPI smoke 无 receipt，标为 nonblocking。

### 残留物已清零

`contracts/service-api-migration.yaml` 的 5 个 `absent_source_owners` 逐一验证**全部不存在**。`check-synthesis-service-boundary.ts` 把这 5 条硬编码并用正则扫描全树禁止 import。

退役基线被冻结为**可验证的观测常量**而非可执行代码（`public_method_count: 131` + `fingerprint_sha256`）。

## 文档漂移清单

调研中发现 7 处，值得记录，因为**这个项目自己就在犯**：

| ID | 漂移 | 说明 |
| --- | --- | --- |
| D-1 | `knowledge-graph.md`（374 行）是**废弃文档**且无人引用 | 仍写 "Sync: **Git** export/import"（WebDAV 已是唯一传输）、"Background **rebuild jobs**"（job/queue 已移除） |
| D-2 | R9/Stage 1 完成度 | `docs/synthesis-layer/README.md` 落后于 dev 文档 |
| D-3 | schema 版本 | README 写 "foundation **v5**"，代码是 **v6** |
| D-4 | `registry.json` 的 `expected.crossProcessCapabilities = 120` | 实际 130；检查脚本把 120 硬断言，**冻结在过期值**。另有指向不存在目录的 `sources` 死元数据 |
| D-5 | wire 层双词表手工同步 | 见上文 |
| D-6 | `workbench-tab-host.md`（409 行）是**有效文档**但未被 Reading Order 收录 | 内容与代码一致，只是入口缺失 |
| D-7 | 62 表断言 vs 源码 grep 得 64 | 非漂移；以 62 为准（源码中另 2 个属 legacy 迁移路径） |

**这七处里，D-4 最值得警惕**：一个"检查脚本"本身硬编码了过期的期望值，于是检查永远通过、漂移永远发现不了。**机器校验的期望值也需要被 review。**

## 对 Scholoom 的启示

1. **能力目录编译进二进制 + registry 与源码双向比对**。"声明的接口"与"实现的接口"必须机器比对，且比对要覆盖两个方向。
2. **canonical JSON 用自带的码元比较器**。一旦哈希要跨语言一致，就不能用任何依赖 locale 或运行时环境的排序。
3. **跨语言契约用一个 JSON Schema 目录做 SSOT，两侧都从它生成/校验**。这一条把"TS 和 Rust 类型漂移"从人工同步问题变成 CI 问题。
4. **有界清理 + 宁可记泄漏也不挂死**。500 ms 全局预算、失败记 issue 而非 panic。
5. **发布顺序决定崩溃安全**。"promotion 只在完整提交后发生" 这一条让部分/取消的操作无法污染 last-good 状态。
6. **缓存可陈旧，但用户决策不可被重建覆盖**。这条把"重新计算"和"重新决定"分开了。
7. **不变量带测试指针**。`test_refs` 精确到 marker 字符串，让不变量与测试互为支撑。

## 来源

- `docs/synthesis-layer/README.md`、20 篇子文档、`contracts/`（3 个 yaml）
- `docs/dev/synthesis-r9-stage1-acceptance.md`
- `packages/synthesis-contracts/src/{index,canonicalJson,sidecarSystem,sidecarRuntimeBundle,workbench,schemaVersion}.ts`
- `packages/synthesis-contracts/contract-set/`（20 个 contract-set 目录清点）
- `packages/synthesis-{engine,repository,application}/`（目录与 import 清点，跨包 import 实测为相对路径）
- `rust/synthesis-sidecar/Cargo.toml`（14 crate）、`src/runtime_service.rs`、`src/runtime_lifecycle.rs`、各算法 crate 常量
- `src/modules/synthesisClient/{defaultClient,nativeComposition}.ts`、`src/modules/synthesis/sidecar/*`
- `src/shared/synthesisWorkbenchWireContract.ts`
- `workflows_builtin/synthesis-layer/`（4 个工作流 + 3 个 hook）
- `scripts/synthesis/`（16 个 check 脚本）
- `contracts/service-api-migration.yaml`
- 调研子代理逐文件读取 + 正则实测（Rust operation 常量数、capability 数、schema 表数）
