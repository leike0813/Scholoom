# Synthesis TypeScript 计算路径：线程与 checkpoint 事实核对

## 范围与方法

只读核对 `/home/joshua/Workspace/Code/JavaScript/zotero-agents` 的 dev `8394fee1a8708a0c2a04e786f6fd8c47f1f28f33` 中 Synthesis engine TypeScript 实现，回答其执行与 checkpoint 形态。代码定位通过已有 CodeGraph 索引，未重建索引、安装、构建、运行测试或基准。main 和历史中的原实现另见[main 计算调查](synthesis-typescript-main-compute.md)；本节缺少布局的结论仅针对该 dev engine 包。Node/Electron 官方机制在主会话补充节中说明。

## 事实一：所有计算入口是同步函数，async 只是表层包装

`computeSynthesisReferenceBinding`（[referenceMatcher.ts:3809](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:3809)）、`computeSynthesisReferenceDedupe`（同文件 3869）、`computeSynthesisCitationGraphBuild`（[citationGraphBuild.ts:911](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/citationGraphBuild.ts:911)）、`computeSynthesisCitationGraphMetrics`（[index.ts:1091](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:1091)）以及 topic/concept/tag 三个索引的 `computeIndex`（[topicGraphIndex.ts:342](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/topicGraphIndex.ts:342)、[conceptKbIndex.ts:535](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/conceptKbIndex.ts:535)、[tagVocabulary.ts:647](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/tagVocabulary.ts:647)）都不含 `await`。Promise 形状来自工厂函数，如 `createInProcessSynthesisReferenceMatcherEngine`（[referenceMatcher.ts:4245](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:4245)）把同步的 compute 包进 `async matchBindings(request) { return computeSynthesisReferenceBinding(request, …) }`，函数体在返回前已把整个同步循环跑完。`createInProcessSynthesisCitationGraphBuildEngine`（[citationGraphBuild.ts:1457](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/citationGraphBuild.ts:1457)）和 `createInProcessSynthesisCitationGraphMetricsEngine`（[index.ts:1272](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:1272)）结构相同。因此在这层代码里，调用方的 `await` 不构成执行期间的让出点。

## 事实二：checkpoint 是纯回调调用，不是让出或取消接线

binding 的 checkpoint 出现在 [referenceMatcher.ts:3825-3860](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:3825)：在 `request.references.map`（3841）内部按 `indexValue % interval === 0` 触发，函数返回 `void`，没有 Promise、没有调度。dedupe 的 checkpoint 同理，分布在 records 归一化（1848）、block 构建（1893）和 pair 循环（1985）。metrics 的 checkpoint 只有 `phase` 与 `iteration`，PageRank 每次迭代触发一次（[index.ts:964](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:964)），类型签名 `=> void`（[index.ts:500](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:500)）。已查阅的取消测试采用回调抛异常：测试 [186-synthesis-citation-graph-build-engine.test.ts:281](/home/joshua/Workspace/Code/JavaScript/zotero-agents/tests/synthesis/186-synthesis-citation-graph-build-engine.test.ts:281) 与 [187-synthesis-reference-matcher-engine.test.ts:483](/home/joshua/Workspace/Code/JavaScript/zotero-agents/tests/synthesis/187-synthesis-reference-matcher-engine.test.ts:483) 都是 `checkpoint(){ throw new Error("cancelled") }`。据此可以确定的只有“回调被调用时能同步抛出中断当前循环”；不能据此断定存在跨线程取消 flag 接线。若把单个计算整体放进一个 Worker，长同步循环期间不会去处理外部的普通 cancel 消息——这一点在本文档里是提醒，不是已验证结论。

## 事实三：候选剪枝与上限确实存在，但大 JSON 步骤仍在调用线程

dedupe 走 blocking 而非全 pairs：`dedupeCanonicalReferencesClustered` 先按 identifier、year+normalized/compact/strong title、content token 首尾等键建 block（[referenceMatcher.ts:1887-1932](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:1887)），再在 block 内做 i<j 的 pair 循环（1970），三重护栏是 `SYNTHESIS_REFERENCE_MATCHER_CLUSTER_BLOCK_MAX = 30` 与 `SYNTHESIS_REFERENCE_MATCHER_CANDIDATE_PAIR_MAX = 3000`（3097-3098），超限时 `blockSkippedCount` 累加并写 diagnostics，pair 预算耗尽时 break。输入规模同样有界：`matcherBounds`（3312）默认 `libraryPaperMax` 25 000、`bindingInputMax`/`dedupeInputMax` 各 750 000、`titleCandidateMax` 16、`suggestedCandidateMax` 3（3088-3094）；citation graph 侧 `sourceMax` 25 000、`referenceMax` 1 250 000（[citationGraphBuild.ts:5](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/citationGraphBuild.ts:5)），metrics 侧节点上限 10 000、边 20 000（[index.ts:11](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:11)）。

在同一线程里执行的还有几处成本可见的步骤：binding 对每条 match 做一次 `matcherJsonClone`，即 `JSON.parse(canonicalizeSynthesisEngineJson(value))`（[referenceMatcher.ts:3851](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:3851) 与 3694）；dedupe 对整个结果做一次同样的 clone（3881）；citation graph 结果校验 `rebuildSynthesisCitationGraphBuildResult` 会重算 aggregate 并对整表做 `JSON.stringify` 相等比较（[citationGraphBuild.ts:1345-1404](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/citationGraphBuild.ts:1345)）；metrics 结尾把 `computed` 交给结果校验器，重新校验输入和结果结构（[index.ts:1269](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:1269)）；不能据此宣称重复计算完整 PageRank；topic index 的结果校验直接 `JSON.stringify(rebuilt) !== JSON.stringify(computeIndex(request, {}))`（[topicGraphIndex.ts:397](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/topicGraphIndex.ts:397)）。另外两处结构值得记录：`addToMap` 每次插入都重建数组并排序（[referenceMatcher.ts:2514](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:2514)），而 `resolveReferenceWithPolicy` 为确认 auto 候选唯一会对 `index.papers` 做线性 `find`（[referenceMatcher.ts:2912](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/referenceMatcher.ts:2912)），guarded fuzzy 分支则按 author token 倒排取候选（2775）。metrics 的连通分量用 `queue.shift()` 做 BFS（[index.ts:1029](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-engine/src/index.ts:1029)）。

## 事实四：该 dev engine 包没有 TS graph layout 实现

该 dev 的 `packages/synthesis-engine/src/index.ts` 只定义 layout 的请求/结果契约与校验，测试禁止 TS 进程内布局和 d3-force（[现有测试](/home/joshua/Workspace/Code/JavaScript/zotero-agents/tests/synthesis/183-synthesis-citation-graph-layout-engine.test.ts:220)）。此约束属于 dev 迁移后的实现；已另行核对 main 的 `src/modules/synthesis/citationGraph.ts` 有 TS 布局，不能将当前工作树检索推广为所有分支和历史均缺少算法。

## 可作为隔离边界的形状（仅基于源码输入输出）

上述计算函数都遵循 `(requestInput, options?) → result`：入参是纯 JSON 值，出参是纯 JSON 值，模块内部不读环境、不做 I/O、不持有可变模块状态（索引 Map 都是函数内局部量）。`options` 只携带 `bounds`、`checkpoint`、`checkpointInterval` 这类纯数据或回调。也就是说，从源码形状看，这几个函数是自洽的计算单元，其输入输出契约不依赖宿主线程语义。

## 未验证与不主张的内容

本文没有测量任何耗时，也没有据此比较 TS 与 Rust 的快慢，不代表现有 TS 实现已能满足与 Rust 侧相同的输入规模或产出相同结果——两侧的等价性是另一件事，需要实测。也没有提出迁移路线、进程/线程模型、存储归属或任何具体方案。

## Node 与 Electron 的执行机制（主会话补充）

官方机制核对日期：2026-10-03。本节核对通用执行机制，不选择 Node/Electron 版本、线程池库或进程部署，也不把官方示例当作本项目性能实测。

[Node Worker threads](https://nodejs.org/api/worker_threads.html) 可以并行执行 JavaScript，适用于 CPU 密集计算。官方建议对反复执行的此类工作复用 Worker，避免每次创建的开销。因此 TypeScript 编译后的计算可以迁入独立 Worker，避免在调用方的事件循环内执行上述长循环；单独使用 async/Promise 不改变循环所在的线程。

[Electron 性能说明](https://www.electronjs.org/docs/latest/tutorial/performance)要求 main 与 renderer 避免长时间阻塞，分别给出 Worker 等卸载计算方式。[utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process)提供带 Node 和消息端口的子进程，是可选执行宿主；其启动依赖 Electron App ready，不能直接成为整个无工作台科研内核唯一的启动契约。具体使用 Worker、Node 子进程或 Electron utility process 留给架构票。

按这些机制推论：将 Synthesis 长计算与工作台、桌面 main 和 Agent 调度的事件循环分离，可以针对性解决用户报告的主线程阻塞原因。这不证明任务耗时、峰值内存、输出等价或交互延迟已达标，也不保证资源争用和结果渲染不会引起卡顿。分线程与更换计算语言带来的收益必须分别评价。

数据准备、序列化和结果处理仍需要有界。[Node 的事件循环说明](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop)明确指出大 JSON 解析/序列化、跨执行单元通信和过量计算并发的成本。Worker 消息使用结构化克隆，部分 ArrayBuffer 可以转移、SharedArrayBuffer 可以共享，但普通对象不自动成为零拷贝；也不能将 checkpoint 函数或整个领域服务对象直接作为 workerData 传递。可考虑在计算侧处理批量数据，以材料版本和紧凑输入/结果通信；具体存储权限与数据通道另定。

取消需要实际执行配合：同步循环中的普通消息回调要等事件循环获得执行机会。现有 checkpoint 可以用于进度和检查取消条件，但必须接入可在循环中读取的信号，或者分块真实让出。Node 也提供 Worker termination；若使用停止执行作为手段，纯计算候选与正式应用必须继续遵守已经确定的职责分工，停止 Worker 不等于撤销已完成效果。这里没有选定具体取消方案。

语言路线的评估应同时看总耗时、CPU 与峰值内存、工作台响应、Agent 调度与取消响应、输入/结果传递及一致性。已有正常/目标/压力数据可复用为样本；选定 TS 实现需要在实际 Node 执行环境中验证，若比较 Rust 则使用明确计算入口而非旧完整链路报告。布局已有 main TS 实现可供抽取，具体选择和效果仍需核验。
