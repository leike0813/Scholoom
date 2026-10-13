# Scholoom 后续讨论续接入口

这是后续会话的入口，具体决定仍以各票 Answer 为准。先读[地图](map.md)，再按依赖领取一张讨论票；无需恢复本次聊天上下文。

## 下一次从哪里开始

**开发纪律本轮收束（2026-10-13）。** [#14](issues/14-agent-development-discipline.md)已补充架构优先复用、测试 oracle／TDD、deep module、模块独立交付和共同 UI harness 夹具；模块验收与业务路径整合分别负责。早期反馈、模块诊断、按成果委派并控制并行、独立验证、规则精简，以及无进展时复查假设、临时方案收尾和实际交接检查均获用户认可。后续依据真实开发反馈调整；以下产品决定继续沿用，不自动启动实施。

**最新需求（2026-10-13）：** [#45 原生交互式科研界面](issues/45-interactive-research-reports.md)已确认作为一等原生接口，Agent、科研能力与工作流共用，以顺畅接入 zotero-agents 与 ResearchSpec 迁入工作流为目标。用户强调其对体验的重要性；后续细化界面呈现、更新、用户交互回传、资源访问与运行边界，不自动进入实施。

**最新范围约束（2026-10-13）：** [#44](issues/44-defer-continuous-precise-source-location.md)排除一切依赖持续精确原文定位的功能。继续对象交互讨论时，以当次选区、独立报告、普通来源访问及重新核查为基础，不恢复逐句关联、随编辑跟踪或自动重定位要求。

**最新讨论点（2026-10-13）：工作台交互与科研业务行为。** [统一 Agent 会话、研究任务对象与追加指令](issues/43-free-agent-conversation-and-research-tasks.md)已确认：会话不分类型或显式绑定研究任务，Agent 通过工具操作任务对象；任务由用户明确要求或确认建议后建立，执行中追加消息默认调整后续工作。下一轮可细化对象交互、执行上下文与调用契约；业务实施尚未启动。

共享工作台与 Windows UI 路径已落地，当前工程入口以[开发说明](../../docs/development.md)为准；历史实验与未验证通道见 [UI 协作记录](research/ui-centered-development-continuation.md)。以下保留前序业务设计状态。

[细化 Zotero 生态接入、插件行为与文献迁入](issues/41-zotero-ecosystem-integration.md)已 resolved：用户于 2026-10-10 确认 Q7 阅读器适配与 Q8 迁入检查、恢复，Q1–Q8 正式决定集中在 Answer，前序兼容政策已同步。扩展共存、引用键与题录更正、缺失附件与重复迁入、阅读写回与迁入撤回等情境仅做语义核对，实际接入、迁入和恢复仍由实现验收承接。

[用完整科研情境核对模块共同契约与剩余决策](issues/42-cross-module-research-walkthrough.md)于 2026-10-10 获用户确认并 resolved，正式结论见 Answer。用户确认整体走查结果及后置边界，[实时预览票](issues/39-writing-live-preview.md)不再阻塞本次走查收束，该票自身继续 open，布局与未定体验仍后置；真实科研 Agent 验收也保持后置。实现规划仍待用户明确启动，不自动恢复后置讨论或进入业务实施。

[细化科研程序执行、环境供给与隔离边界](issues/40-research-execution-environment.md)已 resolved：用户确认三轮 Q1–Q6，正式决定集中在 Answer，四类情境语义核对完成。环境供给、产物保护、时间限制、取消与恢复尚待实现及跨平台验收；本轮未安装依赖或运行科研代码。

[细化 QMD 与 LaTeX 编辑、实时预览和渲染体验](issues/39-writing-live-preview.md)按用户“先这样，继续下一议题”结束本轮实验，释放领取、恢复 open。已完成[本机真实实验](research/live-preview-experiment.md)，布局、性能门槛与未定产品体验后续再议；不能把阶段结束或实测结果当作全部方案已采纳。[场景覆盖确认](issues/30-research-scenario-coverage.md)的具体范围与日后补充方式以对应票为准。

[科研工件工作台交互](issues/38-workbench-artifact-interaction.md)已 resolved：用户确认两轮文字交互建议，正式决定集中在 Answer；[参考调查](research/workbench-artifact-interaction-reference.md)与[合成原型走查说明](prototypes/artifact-interaction-prototype-guide.md)保留依据。原型示例检查通过，用户尚未人工操作，真实图形体验与运行效果仍待验证。

[harness 协作票](issues/25-harness-business-integration.md)已 resolved：用户认可方法加载、能力入口自动记录及工作流步骤记录的简化接线，结合既有执行、交付与科研持久化契约完成情境核对。具体 SDK 接线与实际运行验证留到实现规格。

学术分工审稿和文风 advisor 已确认，后者面向 Agent 生成文本、显式开关、共享当前写作上下文并注入建议，过程中后台运行、结束本轮有限等待。共同执行与持久化职责见 harness 协作票，角色意见与修改查看沿科研工件交互决定；advisor 开关与状态在草图中仅作示例，真实运行按多模型协作契约落实。[omp 官方机制调查](research/omp-advisor-writing-reference.md)可作参考，具体业务决定仍以多模型协作票 Answer 为准。

新会话可以直接说：

> 请读 .scratch/scholoom-foundations/map.md、continuation.md 和 issues/43-free-agent-conversation-and-research-tasks.md，继续细化统一 Agent 会话与研究任务对象的工作台交互；已确认决定沿用，暂不进入业务实施。

## 已完成的场景复盘

- [选题、检索与文献综合](issues/26-research-scenarios-and-existing-toolchain.md)：分散工具链、研究包交接和 Zotero 运行时是实际问题。明确三层知识访问、自动分析与综合维护；Digest 是分析产物。具体多 Agent 交接后置到业务与架构阶段。
- [研究结果与论证](issues/27-research-results-and-argumentation.md)：ResearchSpec 功能面充分，主要改善围绕科研产物的图形交互。用户指定的 Codex 对象交互、Nimbalyst 工件设计已完成本轮参考调查，具体依据见科研工件交互票。
- [论文撰写、审阅与修订](issues/28-manuscript-writing-review-and-revision.md)：改善多模型分工审稿、QMD／LaTeX 实时预览、专门模型文风监督；持续审阅与阶段性集中审阅都需要。
- [已有研究的续做与复用](issues/29-research-continuation-and-reuse.md)：版本不更新时基本顺畅，材料补充问题归首个场景；吸纳 ResearchSpec 工作区设计，让不同 session／Agent 可取回完整科研上下文、几乎无损承接。

以上为定位摘要，具体范围、用户确认及未验证部分以对应票为准。

## 后续讨论顺序与依赖

以下为剩余讨论及已完成的前置，恢复时核对各票状态。核心业务模型、文献管理、分层知识访问、自动分析维护、工作区承接、科研方法组成、多模型协作、harness 协作、科研工件工作台交互、科研程序执行／环境边界、Zotero 生态接入及跨模块走查已确认。预览未定体验继续后置，用户确认其不阻塞本次走查收束；表中的依赖是阻塞关系，不要求所有模块严格串行。

| 讨论票 | 必须先解决 |
| --- | --- |
| [细化 QMD 与 LaTeX 编辑、实时预览和渲染体验](issues/39-writing-live-preview.md) | 本轮实验结束；未定体验按用户要求留待后续，open、未领取 |
| [细化科研程序执行、环境供给与隔离边界](issues/40-research-execution-environment.md) | 已 resolved，正式契约及验收责任见 Answer |
| [细化 Zotero 生态接入、插件行为与文献迁入](issues/41-zotero-ecosystem-integration.md) | 已 resolved，Q1–Q8 正式决定与实际验收责任见 Answer |
| [用完整科研情境核对模块共同契约与剩余决策](issues/42-cross-module-research-walkthrough.md) | 已 resolved，用户确认整体走查与后置边界；预览票不再阻塞本次走查收束 |

已确认的[Agent harness 与科研业务层协作契约](issues/25-harness-business-integration.md)供后续模块与跨模块走查使用。表内编号仅用于底层依赖识别，恢复时以各文件的 Status、Assignee 与 Blocked by 为准。

## 每张票怎么开始和结束

票中已写明已有依据、待讨论问题、边界、开始方式与结束条件。领取前核对全部阻塞票已 resolved。事实调查可委派，宏观产品／领域／架构由主 Agent 与用户讨论；沿用用户指定的子 Agent 模型 `minimax-cn/MiniMax-M3.1-Flash-Preview`，委派前说明任务与模型。

先核对旧工具链、当前源码及已记录体验，再讨论真正未决处。静态源码未知不是用户痛点；分工与界面需求不能被误写成已有研究方法缺失。关键决定写入对应票 Answer，地图只保留索引；词义获得确认后才更新 CONTEXT.md。

票解决后复核依赖，补建新显露的明确问题；不能把票中列出的待讨论选项当成用户已采纳设计。

## 继续保留的讨论时机

[真实科研 Agent 验收](issues/21-agent-dogfooding-and-evaluation.md)仍按用户要求留到功能有初步实现、可通过产品入口运行后，当前不自动领取，也不阻塞初步实现规划。最终走查票用于检查是否还有缺口；即使讨论票清空，进入实现规划、创建 OpenSpec 和业务实施仍由用户明确决定时机。

## 当前工件与验证边界

开发骨架已经实施归档，业务尚待设计与实施。当前讨论记录均保存在工作区文件；场景覆盖、核心业务模型、文献管理、分层知识访问、自动分析维护、工作区承接、科研方法组成、多模型协作、harness 协作及科研工件交互确认后已更新对应决策票、后续讨论责任和地图索引。2026-10-11 另新增了开发态 React 最小原型及入口，完成部分 Orca 操作、HMR 和已有 Electron smoke 验证，详见 [实验记录](research/orca-ui-path-prototype.md)；没有接入真实科研业务，也未安装新依赖、提交代码或操作分支。场景底稿大多是静态调查，工件交互检查使用合成材料，不能代替检索与解析、自动维护、预览性能、模型审阅质量、工作区承接或图形体验的实际验收。
