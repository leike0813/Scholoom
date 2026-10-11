# 研究问题到研究结果与论证：旧工具链事实起点

来源仓库 `/home/joshua/Workspace/Code/JavaScript/ResearchSpec`，HEAD `607c7a73d49cb20a188945b68229c5dd559c40eb`（`chore: improve semantic search setup`）。本次只读静态调查，未安装、未构建、未运行任何 CLI、能力、模型或服务。下文严格区分**声明**（SKILL.md/manifest 文字）、**源机制**（能被源码读到并复核的约束）与**未实跑**（本次未执行验证）。

## 环节事实表

| 环节 | 既有约定与机制 | 判定 |
|---|---|---|
| 1 研究问题 | `design-research-question-formulation` 产出 `rq_brief`。FINER 五维评分，均值须 ≥3.0、单维不低于 2；显式规定「问题驱动方法，不得为迁就偏好方法而选问题」，并要求记录落选候选。`/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/design-research-question-formulation/SKILL.md:54`、`:81` | 声明，边界清晰 |
| 2 方法选择 | `design-methodology-design` 从 `rq_brief` 产出 `methodology_blueprint`：范式→方法族→数据策略（primary/secondary）→分析框架→效度标准→报告规范→预注册交接。`.../design-methodology-design/SKILL.md:52`、`:214` | 声明 |
| 3 输入数据与材料 | 普通任务使用项目文件，输入按材料角色提供文件路径或内联值，输出按角色提供路径；正式 graph 另有 stable_spec、handoff、node_output 等输入来源。[当前使用模型](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/docs/user/usage-model.md:113) | 文件交接与角色检查约定，不代表任意宿主程序已受到系统级隔离 |
| 4 执行分析/计算 | 分析方法交给宿主 Agent 执行。`analysis-meta-analysis` 提供效应量、异质性与敏感性分析规程；ARSU 稿件方法明确指示宿主调用渲染脚本，并区分默认渲染和获授权的代码执行。[分析规程](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/analysis-meta-analysis/SKILL.md:129)、[宿主执行约定](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/arsu/academic-paper/SKILL.md:51) | 方法与执行约定，未实跑分析或验证宿主环境 |
| 5 结果与图表留存 | `figure_code` 输出附 `figure_table_trace`，记录数据、转换、图注主张、所支持稿件主张及限制。图表生成节点输出代码与溯源元数据，另有格式渲染方法承接输出。[图表方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/generation-figure-generation/SKILL.md:199)、[格式渲染方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/generation-format-rendering/SKILL.md:106) | 声明与方法分工，记录存在不代表实际结果已核验 |
| 6 结果检查与解释 | `check-reference-integrity-verification` 的 C3 校验 trace 完整性与图注-数据一致性，C4 校验实验出处与主张对齐，要求 planned-but-`executed:false` 的条目必须带 `skip_reason`。`.../check-reference-integrity-verification/SKILL.md:158`、`:162` | 声明（LLM 判读，非确定性重算） |
| 7 形成论证 | `design-argument-blueprint` 构造「中心论点→子论点→CER 链→反驳」，要求每个主张有证据。工作区 `claims.yaml` 提供 `strength: tentative/supported/strong`、`supporting_source_ids`、`limits` 字段。`.../design-argument-blueprint/SKILL.md:51`、`/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/core/contracts/stable-specs.ts:53` | 源机制（claims 结构可校验） |

## 失败与否定结果

文献证据综合方法允许保留未解决的矛盾与空语料，元分析方法也要求保留无显著发现。用户自己的实验、计算或推导中失败与否定结果的完整继续路径，本轮尚未追踪，不能据此断言不存在。[证据综合方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/analysis-evidence-synthesis/SKILL.md:143)、[元分析方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/analysis-meta-analysis/SKILL.md:129)。

## 普通任务 / Procedure 与正式 graph 的区分

不能把正式 graph 当作全部工作的前提。全部能力 Procedure 的 `modes` 均为 `["standalone","graph"]`，ARSU skill 为 `["standalone"]`，意味着上述能力都可脱离 graph 单独激活。`/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/procedures/catalog.ts:68`、`:103`。反之，`research-main` 这条正式 graph 只有 6 个节点且全为文献导向：rq → methodology → literature → grading → synthesis → report；`generation-figure-generation`、`analysis-meta-analysis`、`design-argument-blueprint` **均不在其中**。`.../skills/arsu/profiles/research-main.yaml:13`–`:106`。

## 已确认优势

问题—方法因果方向被双向声明约束；主张有 `strength` 与 `limits` 的结构化落点；图表—数据—主张的溯源链在生成端和校验端成对出现；否定结果与空语料有明确的诚实性禁令。

## 静态可确认边界

`execution_type` 在 Procedure packet 中影响委派建议，不能单独证明方法是否执行计算。[委派建议实现](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/procedures/packet.ts:73)。普通任务的材料检查只报告角色与文件事实，不判断学术充分性、不运行包内脚本，也不是执行前的强制门禁；实际分析与科研判断仍由宿主 Agent 按方法及授权开展。[使用模型](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/docs/user/usage-model.md:113)。

图表生成节点的“不验证渲染”是该节点的职责边界，已有后续渲染方法；不能将它与仓内统计脚本数量、某类 schema 名称未被检索到等现象合并成“中间断开”或“不能执行科研工作”的结论。本轮未实跑，不能据方法存在证明端到端自动执行效果，也不能据未完整追踪证明路径不存在。

## 待用户确认

用户已确认 ResearchSpec 本场景功能面很好，主要缺少适配的图形交互界面，并指定 Codex 对象直接交互和 Nimbalyst 工件设计作为参考；体验与方向集中记录在[场景讨论票](../issues/27-research-results-and-argumentation.md)。单项任务的运行材料与效果尚未核验，参考产品的最新交互也未在本轮调查。本轮不将静态核查的不完整部分写成其他用户痛点；具体界面和 Agent 交接在后续模块设计展开。
