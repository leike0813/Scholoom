# Synthesis main 与历史中的 TypeScript 应用实现

调查日期：2026-10-03。服务于[既有源码、Synthesis 与 Rust 的复用取舍](../issues/19-existing-source-and-rust-reuse.md)。只读使用 Git 对象，没有切换分支、fetch、创建 worktree、修改旧源码、安装依赖或运行测试。

## 已核对的基线

- zotero-agents 工作树：dev `8394fee1a8708a0c2a04e786f6fd8c47f1f28f33`。
- 本地 main：`fe273f37f2093c4a34be15f93e7d46a3b3484791`，提交描述为 v0.8.4 发布。
- 本地 origin/main：`2b2b540f54fbb5495e17b275530454ca6d808d5a`。本次 `git ls-remote https://github.com/leike0813/zotero-agents.git refs/heads/main` 返回相同 SHA，确认这是本次调查时远端 main 的头部，而非仅依据可能陈旧的 tracking ref。

以下 main 源码通过 `git show 2b2b540f:<path>` 读取，链接固定到完整提交。现有 CodeGraph 索引对应 dev 工作树，不能用它代表 main 的文件或调用路径；这里不创建历史索引，也不将主分支文件的本地工作树路径误作可点击证据。

## main 的实现及抽取判断

| 实现 | 源码事实 | 复用时的处理 |
| --- | --- | --- |
| `citationGraph.ts` | TS 提供统一引用图、聚合边、PageRank/连通分量与 force/radial/components 布局；引入 graphology、d3-force 和 foundation 中的哈希方法。force 布局停止模拟定时器后同步循环 tick | 计算代码是可抽取候选；去掉与整个 foundation 的耦合，接入原生材料身份、结果约定和独立计算执行。旧 D3 布局与 dev ForceAtlas2 不同，不承诺输出坐标一致 |
| `referenceMatcher.ts`、质量判据 | main 保留匹配、规范引用去重及质量判据，service 直接调用；dev 和历史中另有已分离的 TS engine | 对照两条线的行为素材，选择适合新输入契约的实现并吸纳必要修复；不强求整套代码来自同一个旧目录 |
| `conceptKb.ts`、`topicGraph.ts`、`tagVocabulary.ts` | main 包含知识服务，依赖 foundation 的 canonical 事务、投影重建与 repository；并非全部是纯索引函数 | 抽取科研规则、查询和计算；将写入、正式决定、投影及恢复接入原生内核。可借鉴 dev 中已经分离的算法接口，不整体恢复旧服务状态机 |
| `repository.ts` | TS 仓储包含注入式同步 SqlAdapter；默认构造路径依赖 runtimePersistence 与 guardedSqlite。保存操作、缓存、工件、规范引用、绑定、审查等事实 | SQL 查询与行为样本可供借鉴；物理模式、存储权威和默认连接按 Scholoom 存储决策重组。旧操作记录不自动成为研究任务或 Invocation |
| `libraryAdapter.ts` | 直接读 Zotero item、托管 note payload，输入身份为 library/item key，提供全量与部分分页/目标读取形态 | 保留所需查询语义，读取经过 Scholoom 原生文献库与材料版本接口；兼容宿主适配另定。不能将旧身份当作持久学术 Source ID |
| `service.ts`、`workflow.ts` | service 同时依赖 handlers、插件任务行、宿主导出文件、同步偏好、库读写、UI snapshot、计算和仓储；workflow 包含候选结果验证与应用前置判断 | 方法、候选校验、冲突和结果判断是吸纳材料；整体 service 不是新内核可直接导入的模块。写入、任务编排、授权与 GUI 投影依照原生契约组织 |

主要源码：

- [main 引用图与 TS 布局入口](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/citationGraph.ts#L1043)、[同步 D3 tick 循环](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/citationGraph.ts#L1163)。
- [main 应用实际依赖](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/service.ts#L1)、[候选结果约定](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/workflow.ts#L1)。
- [main 仓储与 SQL 接口](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/repository.ts#L1)、[main 库适配](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/libraryAdapter.ts#L1)。
- [main 概念服务依赖](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/conceptKb.ts#L1)、[main 主题图服务依赖](https://github.com/leike0813/zotero-agents/blob/2b2b540f54fbb5495e17b275530454ca6d808d5a/src/modules/synthesis/topicGraph.ts#L1)。

历史调查还找到 dev 中 TS application 包的相关提交，以及旧 service 的移除提交 `57dc41f8`。它们是获取抽取前后实现和修复的线索；本轮未完整审阅这些提交，不把提交名称视为成熟度或行为证明。

main 的计算细节与历史线索另见[TS main 计算调查](synthesis-typescript-main-compute.md)。这份笔记与[dev 计算路径调查](synthesis-typescript-compute-paths.md)分别记录不同提交，不能混用布局算法、目录与性能结论。

## 决策与验证范围

用户已经确认 Synthesis 先用 TypeScript，实际 main 与历史实现为复用来源。新内核仍按模块吸纳；既有参考快照或 dev 文件被移除，不意味着必须用 Rust 重写所有能力。

这里未选择 graphology/d3-force 的具体版本或把原布局库定为永久依赖，也没有运行 main、旧测试、计算基准或三平台验证。采用旧算法后仍需核验材料身份、结果行为、计算耗时、峰值内存、调度响应、取消和数据传递；旧 Zotero 主线程中的失败不直接代表 Node 隔离执行后的结果。

