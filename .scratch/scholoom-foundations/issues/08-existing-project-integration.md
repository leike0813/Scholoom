# 确定 zotero-agents 与 ResearchSpec 的复用和演进边界

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话协调者；与用户共同讨论
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 06, 07

## Question

Scholoom、zotero-agents 与 ResearchSpec 如何保持清晰的长期演进关系？Scholoom 初期如何吸纳已有能力，哪些复用问题需要作为独立核心决策继续讨论？

[研究对象与领域边界](06-research-domain-boundaries.md)已确定对象语义、分析归属及单一权威要求；具体写入与执行契约在原生能力运行时和存储票中细化。

[科研 Agent harness 与执行路线](07-agent-runtime-boundaries.md)已确定 JavaScript/TypeScript 的 LangGraph、LangChain 和 Deep Agents 基础，以及原生融合方向。本票确定项目关系；原生能力模型、运行时与内容迁入、具体源码和 Rust 取舍分别独立讨论。

原票曾同时容纳能力模型、内容包迁入和具体实现复用。用户要求拆开深入讨论，本票据此收束范围；尚未决定的技术问题由后续票承接。不在本票重构其他仓库。

## Discussion

首次讨论依据 references 快照梳理复用候选，尚未验证上游源码能否直接作为 Scholoom 的依赖包使用。以下是讨论依据；确认结果和问题拆分见 Answer。

- [zotero-agents 工作流说明](../../../references/zotero-agents/06-工作流引擎与执行.md)包含输入、参数、资源和产物声明，以及检查、请求构造和结果应用的分工。分析方法与这些科研约定是复用候选；旧 provider 路由、Gecko hook 装载和 Zotero 写回需要按原生内核职责重新组织。
- [ResearchSpec 能力与 Procedure 说明](../../../references/ResearchSpec/08-能力包与Procedure.md)包含能力正文、按需发现、输入输出角色与正式流程语义。[发布接口说明](../../../references/ResearchSpec/02-技术平台.md)列出的公开入口主要是批注摄取与审阅工作台；不能据此假设已有完整可导入的科研内核包。
- [Synthesis 说明](../../../references/zotero-agents/08-Synthesis领域与侧车.md)提供引用匹配、概念与主题关系等算法，以及 TypeScript 契约和 Rust 实现的候选资产。现有 workspace 包为私有源码包，跨包相对导入等边界需要实际检查。复用算法与选择实现语言不等于沿用原有持久化权威划分；缓存和已确认决定仍需遵循 Scholoom 领域边界。
- ResearchSpec 快照中关于维护期 validator 的说明不能直接替代 Scholoom 的运行期产物校验。能力包质量检查、任务交付校验与正式科研判断应按内核决策中的责任区分；也不默认迁入全部哈希门禁、固定计数或宿主限制。

首次讨论提出的问题：

1. 三个项目的长期定位与共享资产所有者：以 Scholoom 需求驱动内核演进，如何保留其他项目的独立用途，何时抽取真正共同使用的模块或内容。
2. 原生能力与工作流的组织：统一能力发现和调用契约，科研方法说明、可执行实现及组合工作流如何协作，是否允许普通 Skill 轻量接入。
3. 旧内容包的迁移承诺：原文与科研约定的复用程度、旧 manifest 的导入方式，以及是否要求旧 hook 和 CLI 指令无需修改。
4. 既有算法与 Rust 实现的复用取舍：在统一任务与资源契约下保留成熟实现，还是优先以 TypeScript 重写；具体候选仍需源码和行为检查。
5. 随产品提供的能力内容范围：全流程常用能力与可选学科扩展如何组织，以及缺乏可运行实现的内容如何标注。

## Answer

### 三个项目保持平行演进

三个项目的长期关系是平行的，后期开发重心转移到 Scholoom。Scholoom 开发初期跟踪并吸纳 zotero-agents 与 ResearchSpec 的能力，发展到一定程度后各自独立演进；具体转折不在本地图设定固定时间或里程碑。

后期其他项目也可以反向借鉴 Scholoom 的特性。跨项目同步和投入安排由用户掌握，本项目的设计无需承担几个项目持续同步的责任，也不要求预先建立共同内核、共享发布或同步机制。

原生融合方向沿用已确认的内核决策。已有项目提供可借鉴和吸纳的能力，具体迁入与实现方式以 Scholoom 自身需求为依据。

### 核心问题独立成票

用户将能力与工作流模型视为“核心中的核心”，要求独立深入讨论。此前关于工作流作为复合能力、普通 Skill 接入及统一内容格式的建议未形成决定。

- [原生科研能力、Skill、工具与工作流的核心模型](17-native-research-capability-model.md)：确定概念、关系与组合方式。
- [科研能力的运行时契约、内容编写与旧内容迁入](18-native-capability-runtime-and-content.md)：核心模型明确后，决定原生执行与内容契约，承接旧包兼容与迁入问题。
- [既有源码、Synthesis 与 Rust 实现的复用取舍](19-existing-source-and-rust-reuse.md)：已完成源码、抽取边界与初期语言选择，具体决定见该票。

本票只解决项目关系、复用方向与讨论边界。模型、内容及源码取舍由上述票记录，物理架构和技术栈由对应后续票落实。

### ResearchSpec 扩展留待后续

ResearchSpec 的可选学科和工具扩展留待日后讨论，不属于当前核心问题。本决定不改变已确认的文献管理到论文写作与修订的全流程产品范围，也未决定这些扩展未来如何分发或启用。
