# ResearchSpec 论文起草—评阅—修订—核验—交付链路事实

## 事实基础与边界

调查对象 `/home/joshua/Workspace/Code/JavaScript/ResearchSpec`，HEAD `607c7a73d49cb20a188945b68229c5dd559c40eb`（2026-10-08 19:40:13 +0800，"chore: improve semantic search setup"），`git status --porcelain` 为空。`.codegraph/codegraph.db` 时间戳 19:40:33，与 HEAD 同刻，索引可用；定位以 `codegraph explore` 为主，缺口用 `rg` 与直接读源补齐。**全部为静态阅读：未装依赖、未构建、未跑测试或 CLI、未渲染工作台、未启动任何 Python 或 Quarto**。行号对应当前 HEAD。旧笔记 [existing-researchspec-source-reuse.md](existing-researchspec-source-reuse.md) 记于 `df5a1c88`，其中 `graph-run.ts` 行号已漂移（`evaluateGraphFrontier` 319→349、`recordGraphDecision` 584→627），本次已逐条复核其余条目仍成立。

读法上有两条轴不能混。**执行面**：宿主 Agent 读 `SKILL.md` 文字按模式产出，判定权在模型；显式程序是 `scripts/*.mjs` 与 Python 脚本，以及能力 manifest 里 `kind: script` 校验器声明的 `argv0`/`args_template`，判定权在确定性代码。**工作面**：standalone 只读写 `researchspec/` 之外的普通项目文件、不产生 run/Gate/Decision（`skills/arsu/academic-paper/SKILL.md:20-22`）；graph 模式才以 `researchspec status/instructions` 返回的选择器为唯一权威（`:24-40`）。同一 Skill 两面并存。

## 链路事实

| 环节 | 关键位置（绝对路径:行） | 已核事实 |
|---|---|---|
| 起草计划 | [稿件方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/arsu/academic-paper/SKILL.md:473) | 已有论证蓝图、写作 intake、章节计划与证据映射等方法，由宿主 Agent 按 Procedure 使用；本轮未执行 |
| 材料与引用 | [引用核验声明](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/check-citation-existence-verification/manifest.yaml:31)、[引用对齐方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/arsu/academic-pipeline/agents/claim_ref_alignment_audit_agent.md:120) | 有脚本引用核验与 Agent 正文—引用对齐方法；引用存在性和引文是否支持正文判断分别处理 |
| 评阅反馈 | [反馈副本生成](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/annotation-intake/review-copy.ts:16)、[差异回收](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/annotation-intake/review-delta.ts:6) | 评阅方法可生成评审文本；带槽位副本回收程序将变化派生为改块、缺块、增块或整篇失配，再结合位置和原始来源校验反馈 |
| 修订实施 | [修订方法路由](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/arsu/routing-catalog.json:803)、[补丁应用](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/arsu-converter/revision/apply.ts:30) | 已有 revision_patch、revised_draft、response_to_reviewers 等交付约定；补丁程序核对稿件及目标块、操作结构后生成修改结果，另有修订动作记录方法 |
| 核验与答复 | [回复轮次声明](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/capabilities/generation-review-response-round/manifest.yaml:17)、[修订工作区结果校验](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/review-workspace/revision-master.ts:248) | 答复信与 round_summary 是声明产物；专用工作区校验导出候选与保留快照是否一致。这种结构一致性校验不能单独证明科研修改和答复已经充分落实 |
| 渲染交付 | [Quarto 渲染脚本](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/skills/arsu/academic-paper/scripts/render-quarto.mjs:22)、[评阅源集保存](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/review-workspace/prepare.ts:23) | 有工程渲染与投稿包检查方法；评阅工作区另保存所用源集用于反馈核验，不能把专用工作区的源集冻结推广成所有日常写作与渲染的统一前置条件 |

## 对场景复盘的使用范围

这些已有方法与程序可以作为写作、反馈、修订和交付的融合依据。旧块标记、hash 校验、源集快照及正式 Gate 是旧实现或特定流程的约定，不自动成为 Scholoom 的要求；本项目继续沿已有领域、开放文件和低摩擦协同决定。用户的实际问题在交流确认前留空，具体界面和多 Agent 操作留到后续模块讨论。

## Spot-check

- `src/core/workspace/write-plan.ts:143/302`、`markdown-blocks.ts:11`、`annotation-target.ts:15`、`review-copy.ts:16`、`prepare.ts:23`、`handoff.ts:20`、`revision-master.ts:248`、`validators.ts:39`、`path-boundary.ts:4` — 旧笔记行号复核全部仍成立。
- `package.json:8-21` — 仍只有 `./annotation-intake` 与 `./review-workspace` 两个子路径导出，CLI 走 `bin` 单独暴露。
- `skills/capabilities/*/manifest.yaml` 统计 — 65 个能力：`llm` 35、`mixed` 23、`script` 7。
- `src/core/runtime/graph-run.ts` — 仅该文件行号漂移，符号集合未变。

## 未核验

测试仅查阅文件名与用例标题，未运行，工作区页面、pandoc/Quarto 转换质量、SQLite 并发表现均无运行证据。能力 manifest 声明的 `execution_type` 未与实际调度器对账，宿主 Agent 是否真的按 `SKILL.md` 文字执行无法从源码证明。评审校准按 Skill 自述仍为 `NOT_CALIBRATED`（`academic-paper-reviewer/SKILL.md:188`）。未触碰 issues 与 map。
