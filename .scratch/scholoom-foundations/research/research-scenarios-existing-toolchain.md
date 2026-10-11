# 选题、检索到文献综合：旧工具链事实起点

核对日期：2026-10-08。用户选择从“选题、检索到文献综合”开始复盘。本文是场景讨论的事实底稿，不是用户实际操作记录或 Scholoom 设计结论。

## 证据范围

- Zotero：本地仓库 main，HEAD `2cdc2cc3b`。
- zotero-agents：本地仓库 dev，HEAD `e48b2124`；通过 CodeGraph 与必要源码静态核对。
- ResearchSpec：本地仓库 dev-refactor，HEAD `607c7a73`；核对能力目录、研究流程定义及当前用户说明。
- `references/` 是早期快照；关键能力以本轮读取的源码为依据。未启动旧工具、运行任务或调用模型；用户已反馈总体使用问题与日常交接路径，见[场景讨论票](../issues/26-research-scenarios-and-existing-toolchain.md)。实际端到端运行与版本兼容尚未验证。

## 场景路径中的已有机制

| 环节 | 已查到的机制 | 尚未确认 |
| --- | --- | --- |
| 表达方向与研究问题 | ResearchSpec 的 Navigate 按意图发现科研方法；普通持续工作可使用任务笔记与项目文件，正式流程另由 graph 管理。research-main 定义研究问题、方法、文献、综合和报告等步骤 | 用户通常从宽泛方向还是明确问题开始，如何往返调整问题与检索 |
| 检索与入库 | zotero-agents 有 literature-search-ingest，参数包括查询、搜索模式、广度、语言提示和目标集合；apply 钩子依据已返回的入库结果更新待处理标签 | Agent 侧具体搜索、筛选和建项过程，本轮未完整追踪；不能用 apply 钩子推断全部入库实现 |
| 单篇与批量分析 | literature-analysis 按选中附件逐项处理，声明 digest、references、citation_analysis 和 literature_score 产物及可选标签处理；分析结果与 Zotero 受管笔记关联 | 用户怎样选择材料、检查结果、处理缺全文或分析不充分 |
| 深度阅读 | literature-deep-reading 的 apply 钩子把结果 HTML 写入文件，并建立或更新 Zotero HTML 子附件 | 用户是否使用这一路径，以及该产物如何进入实际综合 |
| 主题规划与综合 | synthesis-layer 包含 topic-planner、create-topic-synthesis、update-topic-synthesis 和 manuscript-literature-framing；综合应用进入 Synthesis 服务 | 主题与研究问题的实际关联、纳入来源的取舍、冲突证据与增量更新行为 |
| 继续科研工作 | researchBundleService 可读取 paper artifacts 与 topics 并形成导出包；ResearchSpec 当前文献适配目录包含查询、获取、分析、综合与管理 Skill。普通 Procedure 支持按材料角色与路径传递文件 | bridge 实际路由、版本兼容、导出结果被下一项任务实际消费的行为，以及用户是否需要手工交接 |

这些机制表明旧工具链已有分析与综合产物的汇合及文献适配入口。多种保存位置或多个工具不能直接证明“结果互不相通”“没有自动交接”或“用户只能手工复制”。

## 可确认的边界与待讨论问题

ResearchSpec 将模型与 Agent 执行交给宿主，普通任务通过项目文件继续工作；其 `status/check` 对 Zotero 适配执行静态配置与投影检查，不直接证明 live 连接可用。zotero-agents 的文献工作依赖 Zotero 宿主、选定执行后端和相应服务。由此可确认执行与材料分布在不同环境。用户已确认工具配合存在手动操作、Zotero 对 Agent 不友好，以及运行时限制综合算法和排障；具体配置负担、上下文遗漏或成果复用问题仍需进一步确认，不能自动归入已证实痛点。

首个场景需要一起核对：起始研究意图、已有材料、检索与筛选决定、阅读判断、综合交付，以及发现新材料后如何修改前面的判断。先明确做得好的地方与具体障碍，再决定 Scholoom 中哪些业务关系需要长期保存、哪些工作应由 Agent 自主处理、哪些判断需要人参与。

## 参考文档漂移

- zotero-agents 参考文档将检索入库、深度阅读的结果概括为笔记；当前检索入库 apply 钩子更新状态标签，深度阅读 apply 钩子生成 HTML 附件。不能把早期描述当作当前产物契约。
- ResearchSpec 参考文档中的 Zotero Skill 名单与当前 `src/literature-adapters/catalog.ts` 不同。本轮以目录中的查询、获取、分析、综合、管理及桥接职责为准，不据旧名称推断能力缺失。

## Digest 的术语核对

用户明确第二层的 Digest 指 zotero-agents 的文献分析产物，与第一层可能包含的论文摘要（abstract）区分。当前 literature-analysis 声明 `artifacts/digest.md`，结果应用程序按 `digest_path` 或该回退路径读取其内容；它与 references、citation_analysis、literature_score 是不同的交付产物。当前分析方法说明要求围绕请求目的组织分析，并区分来源表述、分析者解释及不确定性；其中 focused digest 给出问题、答案、支撑段落和局限的模式，该模式不能直接推定为所有 Digest 的固定结构。以上为静态核查，未验证实际生成质量，也未确认 Scholoom 的 Digest 内容格式。

- [分析方法与交付模式](/home/joshua/Workspace/Code/JavaScript/zotero-agents/skills_src/zotero-library-agent/skills/zotero-literature-analysis/references/playbook.md:19)。
- [Digest 结果读取](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/literature-analysis/hooks/applyResult.mjs:455)。

## 主题综合已有设计的融合依据

用户指出主题综合已经体现“综合发现反馈选题”的思想。本轮针对当前契约与方法核对，可保留的基础包括：

- core synthesis 组织路线分类、研究主张、争议、改进维度和未来方向；相关对象关联 `source_paper_refs`。未来方向记录具体局限、方向、理由及来源，覆盖方法、评价、数据／基准、理论等类型。[核心综合契约](/home/joshua/Workspace/Code/JavaScript/zotero-agents/skills_src/topic-synthesis/contracts/payload-schemas/stage-40-core-synthesis.schema.json:241)。
- 方法明确区分领域研究局限、库内覆盖不足与产物证据不足；coverage 与补充收集建议解释库内证据覆盖，基于来源的研究局限和未来方向由 core synthesis 承担。[阶段方法](/home/joshua/Workspace/Code/JavaScript/zotero-agents/skills_src/topic-synthesis/contracts/stage-guidance.yaml:478)。
- 主题有创建与更新工作流，契约表达 freshness、陈旧原因、缺失章节等维护信息。当前这些机制属于旧流水线和服务，不能从它们的存在推定 Scholoom 所需的自动触发已实现。[主题状态契约](/home/joshua/Workspace/Code/JavaScript/zotero-agents/packages/synthesis-contracts/src/topicDomain.ts:200)。
- manuscript-literature-framing 方法通过 `get-review-input` 读取主题写作上下文，也提供进一步查询文献、图谱和材料的路径。其写作规则区分领域文献证据与用户确认的研究问题、方法及贡献，主题综合供文献定位和论证背景使用。[写作输入方法](/home/joshua/Workspace/Code/JavaScript/zotero-agents/skills_builtin/manuscript-literature-framing/SKILL.md:106)、[写作规则](/home/joshua/Workspace/Code/JavaScript/zotero-agents/skills_builtin/manuscript-literature-framing/SKILL.md:226)。

上述事实支持以已有科研设计为融合起点，再按 Scholoom 的原生对象、渐进取材、依赖关系及 LangGraph 自动维护要求重构。字段和方法说明不能替代真实科研效果验证；本轮未执行 Skill、gate 或主题更新。未发现某个同名字段也不能据此判断相关科研思想不存在。

## 来源

- [ResearchSpec 当前使用模型](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/docs/user/usage-model.md:92)：Navigate、普通持续工作、材料交接与 Zotero 静态检查。
- [ResearchSpec 文献适配目录](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/literature-adapters/catalog.ts:15)：当前 Skill、职责及包版本引用。
- [ResearchSpec 研究流程定义](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/arsu-converter/workflow/graph-profiles/research-main.ts:13)：研究问题到综合与报告的流程定义，存在不等于已实跑。
- [检索入库工作流](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/literature-search-ingest/workflow.json)与[结果应用](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/literature-search-ingest/hooks/applyResult.mjs:41)。
- [文献分析工作流](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/literature-analysis/workflow.json:162)：声明的分析产物。
- [深度阅读结果应用](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/literature-deep-reading/hooks/applyResult.mjs:139)：HTML 结果读取、文件写入及附件关联。
- [主题综合工作流](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/synthesis-layer/create-topic-synthesis/workflow.json)与[综合结果应用](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/synthesis-layer/hooks/applyTopicSynthesisResult.mjs)。
- [研究材料包服务](/home/joshua/Workspace/Code/JavaScript/zotero-agents/src/modules/hostBridge/workflow/researchBundleService.ts:1158)：paper artifact 与 topic 导出，以及[单篇分析导出](/home/joshua/Workspace/Code/JavaScript/zotero-agents/src/modules/hostBridge/workflow/researchBundleService.ts:402)。
