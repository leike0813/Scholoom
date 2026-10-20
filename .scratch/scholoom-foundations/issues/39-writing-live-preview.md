# 细化 QMD 与 LaTeX 编辑、实时预览和渲染体验

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: open
Assignee:
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 35

## Question

QMD／LaTeX 写作中，人或 Agent 修改稿件后怎样及时看到正文、公式、引文、图表与排版结果，兼顾响应速度、结果正确性和科研执行边界？

## 已有依据

[写作路线](11-reading-writing-format.md)、[技术栈](12-technology-stack.md)、[写作场景](28-manuscript-writing-review-and-revision.md)、[工作区承接](35-research-workspace-context.md)。

用户已授权领取并讨论本票，下面各项仍是待讨论问题，具体答案尚未采纳。恢复时先读地图，再读本票引用的相关决定；不需要前一会话上下文。

## 本票需要讨论

- 保留 QMD 默认、MD／LaTeX 原生、源码与可视模式共稿及源文件权威；LaTeX 保留原工程和编译 PDF 预览。
- 明确编辑过程的预览与按模板工程渲染各自展示什么、何时更新，以及用户如何知道结果对应哪次正文与已有计算结果。
- 调查 QMD 与多文件 LaTeX 的真实预览／编译机制，讨论引用、公式、图表、交叉引用与局部错误的用户体验。
- 沿已有预览与科研执行约定：日常预览读取正文与已有结果，科研代码按授权明确执行；失败时不能把旧结果显示成新结果。
- 用代表性文稿检查响应、定位、内容保留、编辑与 Agent 修改后的刷新；具体目标由用户结合体验确认，不能仅凭库名宣称实时能力。

## 边界

本票讨论产品行为并收集足够技术依据；不默认每次按键重编译全工程或重跑科研代码，不在建票阶段选定技术解法。

## 开始方式

先核对现有路线与用户期望的“实时”含义，再调查、原型验证 QMD 和 LaTeX 两条路径。

## 结束条件

用户确认预览与渲染的体验要求、执行边界和代表性验证文稿；未经实测的性能明确记录为待验证。

## Comments

- 2026-10-08：按用户要求提前建立后续讨论票；保持 open、未领取。本轮仅建票，不回答本票或进入实现。
- 2026-10-09：用户要求继续下一票；Codex 领取。前置工作区承接已 resolved，沿已确认格式、组件及工件交互方向讨论预览与渲染体验。
- 2026-10-09：用户提出布局与性能的核心顾虑：实时编译预览是期望方向，但要考虑性能；常驻 Agent 面板挤占正文与预览，频繁关面板或调整布局影响交互。要求主 Agent 一起推敲，本轮转向写作空间分配与 Agent 可达性的比较；此前 Q1、Q2 尚未采纳。
- 2026-10-09：用户明确 UI 布局后期再设计，当前先验证实时预览能做到什么地步。已使用已有 Quarto／MiKTeX 进行真实编译、常驻监测和浏览器自动刷新实验，见[实测报告](../research/live-preview-experiment.md)；性能门槛与产品行为仍待讨论，票保持 claimed。
- 2026-10-09：用户表示本轮先到这里，继续下一议题。实时预览实验收束，释放领取、恢复 open；UI 布局、性能门槛与未定产品行为留待后续，不把本次实测或阶段结束记作全部方案已采纳。当前讨论转到科研程序执行、环境供给与隔离边界。
- 2026-10-20：用户确认并批准科研写作编辑器方案，行为和实施状态由[active change](../../../openspec/changes/add-research-writing-editor/proposal.md)、其中的 workspace-editor／manuscript-rendering specs 及[工作台设计](../../../docs/ui-design/README.md#科研写作编辑器)维护。源码与可视模式共用草稿；MD／QMD 轻预览读取草稿，完整预览基于已保存输入并在打开或保存后更新所选格式；HTML／PDF／DOCX 可显式导出；LaTeX 保留原生工程并编译 PDF。人工路径使用独立 `ManualApplication`，不要求 harness、会话或模型。此确认不表示本票整体 resolved，也不表示 active change 已归档。

## 历史讨论与调查（截至 2026-10-09）

沿已有格式与技术栈决定，不重选编辑器：QMD／MD 使用 CodeMirror 6 源码编辑和 Quarto 学术可视编辑模块；LaTeX 保留原工程，使用源码与编译 PDF。日常预览与科研执行的已有边界继续有效。

首轮讨论分别明确 QMD 的编辑显示与模板输出，以及 LaTeX 编译 PDF 的自动更新体验；实际刷新时机、未保存内容、错误与旧结果、双向定位及代表性文稿在后续轮次细化。尚未据此承诺延迟或选定新的接线方案。

用户指定模型的官方机制调查已完成；主 Agent 随后核对本机 Quarto 1.9.37，并实际运行两种规模的 QMD 与多文件 LaTeX 实验。业务代码、依赖与布局均未修改。

### 历史实测依据

[实测报告与复现入口](../research/live-preview-experiment.md)、[原始结果](../research/live-preview-experiment-results.json)及[真实浏览器截图](../prototypes/live-preview-actual.png)为当前预览能力依据。小稿件约 1,657 词，常驻 Quarto 保存后约 1.27 秒完成浏览器正文与公式更新；约 31,639 词的长稿件约 5.31 秒。原生 latexmk 短轮询下小稿件新 PDF 约 1.1–1.2 秒可读取，尚未测量产品 PDF 查看器的显示延迟。

已检查连续保存、书目与图件依赖、失败恢复及一处多文件 SyncTeX 双向行定位。Quarto 单文档 preview 的 `.bib` 单独变化未刷新书目；本机 LaTeX 编译错误会移除 PDF。`--no-execute` 保留了已有 notebook 输出且不执行代码单元，但仍执行项目 pre-render hook。实际工程接线需要处理这些边界，未据此采纳正式方案或关闭本票。

布局讨论按用户要求后置。已有草图片段只保留为未采纳材料，不能作为编译性能证据。

### 历史布局探索

[写作空间布局比较](../prototypes/writing-agent-layouts.html)是用于会话内比较的 HTML 片段，包含就地指令与浮层、底部工作面板、常驻侧栏三种候选。体现同一稿件的源码与渲染视图、常备的任务指令入口、按需展开的 Agent 交流；用户选择尚未确认。片段依赖会话宿主提供切换导航，本轮未创建生产 UI 或替换已确认的四种布局。

主 Agent 倾向写作布局优先保证正文与预览可读，将指令入口、任务进展与完整对话分别安排；Agent 布局仍适合长对话和工作组织。浮层的代价是遮挡内容，底部面板减少文稿高度，侧栏需要较大横向空间，不能仅凭草图宣布某一种普遍最好。

实时更新暂按两层讨论：编辑显示及时响应，工程渲染合并连续变化、保持已成功结果并准确表达更新状态；LaTeX 最终排版仍来自真实编译，普通预览沿已有科研执行边界。具体编译调度与延迟需要官方机制核对及实际样本验证，以上尚未采纳。

本轮对草图执行了内联脚本语法与浏览器交互检查，核对选目标进入指令、对话展开／收起、浮层不改变正文宽度、1024／736／320px 下三种布局无横向溢出。草图内容与发送均为示例，预览没有实际编译，源码编辑不自动同步示例排版；真实性能与人工体验尚未验证。

### 当前方案的接续与验收边界

已批准方案的行为以 [active change specs](../../../openspec/changes/add-research-writing-editor/specs/) 为准，工作台布局与视觉以[设计文档](../../../docs/ui-design/README.md#科研写作编辑器)为准。change 仍在实施中，未归档，main specs 尚未同步；本票保持 open，不因方案确认而整体 resolved。

当前开发机核对到 Quarto 1.9.37、配套 Pandoc 3.8.3、latexmk 4.87 和 MiKTeX。旧实验中的耗时仍是历史环境测量，不构成当前产品延迟承诺或新实现的性能验收。active change 已记录实际内核转换、排版与导出验证；Chromium／Electron 双宿主 UI 尚未验收，不能据内核结果、静态检查或旧原型声称 UI 通过。下一步命令和缺项见 [change delivery](../../../openspec/changes/add-research-writing-editor/delivery.md) 与 [tasks](../../../openspec/changes/add-research-writing-editor/tasks.md)。
