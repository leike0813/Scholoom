# 确定既有源码、Synthesis 与 Rust 实现的复用取舍

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: Codex
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 08

## Question

在 Scholoom 原生科研内核的方向下，哪些 zotero-agents 与 ResearchSpec 的实现值得直接复用或抽取，哪些应重新实现？Synthesis 初期的实现语言与既有 Rust 实现如何取舍？

[项目复用和演进边界](08-existing-project-integration.md)已经明确三个项目保持平行，初期跟踪并吸纳能力，逐步独立演进；跨项目同步由用户掌握。本票从 Scholoom 的需要判断复用，不要求先建立三个项目共同维护的包或同步机制。

调查领域算法、结构化契约、Synthesis 引用匹配与概念和图谱处理、现有仓储和应用服务、正式研究控制逻辑及宿主适配的实际代码边界。以对应源码和公开接口为依据，区分已可调用的实现、需要抽取的内部模块、仅可借鉴的语义与紧耦合的宿主代码；参考快照中的模块名称和统计不证明可移植性。

比较保留 Rust、只复用其中必要模块及以 TypeScript 重新实现等路线的实际收益、维护负担、性能依据、跨平台构建发布和依赖成本。Node 作为 Agent 执行基础已经确定，不等于其他语言的实现已经获准或被排除。

复用既有代码时，明确该实现的输入输出和职责，使其接入 Scholoom 的共同任务、资源、授权与交付体系。复用旧仓储不能自动沿用旧数据权威；沿用算法也不能把缓存与用户已确认决定混为一类。

[原生内容与执行契约](18-native-capability-runtime-and-content.md)已明确不承诺兼容旧项目。本票以实现价值判断源码复用或重写，不把旧包格式、API、CLI 或运行方式设为兼容约束。

本票应给出有依据的复用清单、抽取或重写方向及语言取舍。领域语义、能力模型和内容迁入分别由对应票决定；物理进程、IPC、存储机制和具体工具链由后续架构、存储和技术栈票决定。调查若暴露需要实验才能回答的问题，再建立明确的调查或原型票；本票不实施抽取、重构或跨仓库修改。

## Answer

用户确认源码吸纳方式、Python 与第三方内容取舍，并在深入讨论线程阻塞后确认 Synthesis 先采用 TypeScript。以下决定按 Scholoom 原生内核组织实现；具体函数、库版本、物理存储和部署在后续规格与对应决策中落实。

### 源码按模块吸纳，由 Scholoom 自己维护

既有实现按新契约抽取到 Scholoom 的模块、方法资源和校验器中，保留来源提交与必要许可。两个旧应用不作为整体运行依赖；跨项目共享包、同步与共同发布不构成前置要求。

可直接沿用符合新输入输出语义的纯函数。宿主读取、持久化、能力目录、任务调度、变更应用和正式决定由原生内核统一组织；旧应用中已经划清的模块可以提供实现素材，不自动成为新权威或第二套控制器。源代码颗粒度按实际依赖选择，复用科研方法不要求沿用旧 manifest、API、CLI 或运行格式。

### Synthesis 先采用 TypeScript，重计算独立执行

用户说明：原 Synthesis 使用 TypeScript，迁入 Rust 的主要原因是 Zotero 中重计算严重阻塞主线程。Scholoom 先使用 TypeScript，以 zotero-agents 的 main 和历史中的 TS 实现为来源，结合当前 dev 中可复用的算法、结构化接口与必要修复。

本次只读核对远端 main 为 `2b2b540f54fbb5495e17b275530454ca6d808d5a`，有 TS 引用匹配、图构建、指标及 force/radial/components 布局。main 的 force 使用 d3-force；当前 dev Rust 布局使用 ForceAtlas2。这是两个实现基线，不能把 dev engine 包只保留布局契约的事实推广为 main 或历史没有 TS 布局，也不承诺两种算法产生相同坐标。

历史提交 `57c298619fae801a58e909de3b663c6a41dd37c5` 还保留已抽出的独立 TS 布局 engine、请求/结果校验及计算行为用例，比整块移植 main 服务更适合进一步抽取。该提交同样采用 d3-force，不能直接沿用当前 dev 的 Rust 布局身份校验；抽取时按 Scholoom 新契约组织。

重计算与人类工作台、Electron main 和 Agent 调度的事件循环分离。Node Worker 或独立计算进程承载计算，具体部署和 IPC 由[架构票](09-electron-architecture.md)决定；该计算执行仍受同一 harness 的任务、授权、取消、交付和监督机制管理，支持无工作台执行。

仅增加 async/Promise 或 checkpoint 回调不会自动将同步循环移出调用线程。数据准备、序列化、校验、进度、取消与结果展示也需有界；停止计算与撤销已应用效果仍按原生契约分别处理。

当前不整套迁入 Rust Synthesis 应用、仓储与界面投影。Rust 不作为解决主线程阻塞的必需条件；个别算法后续可按现成实现价值、总耗时、内存和维护成本评估采用。本决定没有要求同时维护 TS/Rust 双生产实现，也没有预先建设通用多后端计算框架。

### 已有实现的复用方向

复用按用户于 2026-10-04 确认的[低摩擦协同方案](13-storage-and-change-model.md)对齐保障范围，普通文件修改和调用不整体迁入旧版本冻结或审计门禁。

| 实现资产 | 采用方向 | 需要对齐的职责 |
| --- | --- | --- |
| zotero-agents 文献精读、综合、标签方法及结构化结果判据 | 吸纳方法、模板、纯规则与校验素材，按原生 Skill/能力约定组织 | 必要方法与材料信息、直接交付与按需审查；生成校验器随新 schema 生成，不成为第二份手工规则 |
| Synthesis 引用匹配、规范引用去重、引用图构建与指标 | 优先抽取 TS 计算；main、历史和 dev 作为不同来源比较，保留必要修复与行为样本 | 新 Source/材料版本与身份映射、批量数据、独立计算、进度和取消；旧 Zotero item key 不作为稳定学术身份 |
| Synthesis TS 图布局 | main 的 TS force/radial/components 是直接可研究的源码候选，无需据 dev 缺失状态从零重建 | 计算脱离关键事件循环，效果和规模验证；具体图库与版本由技术栈选择 |
| 概念、标签和主题知识 | 抽取科研规则、查询与索引算法；应用代码按原生状态和交付重组 | 别名与关系、来源条件、可重建索引及已确认绑定/合并/决定分别承载，重建不能覆盖正式事实 |
| 旧 Synthesis repository/application/service | 参考查询、事务片段、冲突处理与行为用例，逐项吸纳适用实现 | main 服务的 Zotero/note/插件任务/UI 耦合及 dev 的旧 protocol/存储形态不整体搬入；物理模式和写入权威由存储票决定 |
| ResearchSpec 批注摄取、定位、稿件修订与保护区 | 抽取反馈来源验证、定位、候选解释、修订检查及适合的实现 | 主编辑格式、关键来源与按需重定位、局部覆盖保护及按需审查；按已选编辑路线组织 |
| ResearchSpec 检索与校验 | 吸纳词汇资产、检索算法、可执行校验的有效实现 | 接入共同方法/能力目录，按新输入与交付约定检验；不自动迁入旧 semantic 环境或目录权重 |
| ResearchSpec graph-run、CLI 控制与写计划 | 研究控制语义和有效实现片段作为素材，按原生 LangGraph/harness 实现 | 旧 run 文件树、目录控制与 CLI 不作为第二权威；预检、备份和进程内回滚不是已完成的崩溃安全事务 |
| ACP 协议、会话与进程管理 | 借鉴协议行为和生命周期实现，适配 Node 与共同任务/会话契约 | 旧 Gecko transport、runtimePersistence 与 WebSocket 桥按实际部署替换；不为旧运行方式携带全部适配层 |
| Zotero broker、Host Bridge 与 Rust bridge | 为已选兼容宿主评估适用的读写和通信实现 | 价值依赖[原包兼容宿主原型](16-zotero-host-prototype.md)；不能直接作为原生 Node 领域实现，也不因宿主耦合排除其兼容适配价值 |

复用清单确定方向与候选颗粒度，实际实现按目标行为、依赖与授权检查后采用；不以旧文件数量、名字、版本或导出声明认定已经可移植。

### Python 与第三方内容

普通内核和常用文本处理优先 Node。值得保留的 Python 科研工具通过共同执行契约接入，明确环境要求；选择 Node 不要求全部程序重写。应用是否携带 Python 以及具体工具链由后续票确定，包内复制的独立 SQLite/Jinja 工作台不整套迁入。

ARS-derived 内容中标记 CC BY-NC 的部分不作为默认内置依赖，先以自有方法和独立实现支撑对应功能。有明确分发安排或另行授权后再评估迁入；更换编程语言不自动消除来源许可。本决定保持全流程范围，Scholoom 的许可证与商业模式另行讨论。

### 验证与后续责任

源码吸纳需要验证调用方可观察的输入、输出、限制和失败行为。优先利用已有行为用例、数据和必要对照；旧目录布局、固定计数、源码字符串、UI 文案以及旧项目的退役约束不自动成为 Scholoom 门禁。

性能须分别评价总耗时、峰值内存、工作台响应、Agent 调度和取消响应、输入/结果传递及输出效果。迁出主线程针对已知阻塞原因，不能替代新执行环境中的测量；旧 Rust 完整生产链路结果也不能直接作为纯算法语言对照。

- [领域模块与执行架构](09-electron-architecture.md)：落实计算卸载、代码装载、IPC、取消、监督和授权。
- [存储与变更模型](13-storage-and-change-model.md)：落实正式事实、索引、版本、并发应用与恢复。
- [阅读写作格式](11-reading-writing-format.md)：决定格式相关修订、保护区和批注实现的适配。
- [技术栈](12-technology-stack.md)：选择 TS 工具链、图库、数据库接入、可选外部环境与分发。
- [开发纪律](14-agent-development-discipline.md)与[验证发布纪律](15-validation-and-release-discipline.md)：落实来源维护、行为验证、性能和平台验收。

本票的复用与初期语言选择已得到回答，未发现必须另设原型才能作出该方向决定的问题。实际抽取、算法改造、独立构建、基准、测试及三平台运行仍未执行；本次只读调查和规划文档不作为应用实现完成的证明。

### 依据

- [main TS 应用与宿主依赖](../research/synthesis-typescript-main-application.md)、[main 与历史 TS 计算](../research/synthesis-typescript-main-compute.md)。
- [dev Synthesis/Rust 实现](../research/synthesis-source-and-rust-reuse.md)、[dev TS 计算路径与 Node/Electron 官方机制](../research/synthesis-typescript-compute-paths.md)。
- [zotero-agents 工作流、ACP 和宿主候选](../research/existing-zotero-agent-source-reuse.md)、[ResearchSpec 写作、审稿与控制候选](../research/existing-researchspec-source-reuse.md)。
