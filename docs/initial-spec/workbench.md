# 工作台与稿件 Specification

初设参考；适用方式见 [总入口](README.md)。

## Purpose

定义人通过共享工作台参与科研、选择材料、发送指令、查看和修改成果的行为，保证浏览上下文、会话接收者与实际执行范围清楚，并使开放稿件、交互报告及审阅结果沿共同数据和授权规则使用。

依据：[工作台 PRD](../prd/workbench.md)、[交互 #10](../../.scratch/scholoom-foundations/issues/10-workbench-interaction.md#answer)、[格式 #11](../../.scratch/scholoom-foundations/issues/11-reading-writing-format.md#answer)、[产物交互 #38](../../.scratch/scholoom-foundations/issues/38-workbench-artifact-interaction.md#answer)、[自由会话 #43](../../.scratch/scholoom-foundations/issues/43-free-agent-conversation-and-research-tasks.md#answer)、[交互报告 #45](../../.scratch/scholoom-foundations/issues/45-interactive-research-reports.md#answer)。

## Requirements

### Requirement: W-01 布局与独立工作上下文

工作台 SHALL 提供 Agent、文献、写作、审查四种布局，初始进入 Agent 布局，允许调整、保存及恢复。会话与当前阅读对象独立，切换布局或会话 SHALL 保留各自草稿、附加材料及未发送指令；无项目时仍可管理文献。

#### Scenario: 写指令期间切换阅读对象
- **WHEN** 用户编辑未发送指令后打开另一篇文献或切换布局
- **THEN** 草稿和已附材料保留，浏览变化不自行替换指令接收者或附加材料

### Requirement: W-02 明确接收者与统一指令

界面 SHALL 展示当前指令接收者，区分正在浏览、主动附加及执行中实际使用的材料。选区旁输入与会话面板 SHALL 编辑同一条待发送指令；执行中追加消息在下一可处理边界消费，已受理和已处理分别呈现，不因浏览切换增加执行授权。

#### Scenario: Agent 忙碌时追加要求
- **WHEN** 用户向正在执行的会话发送补充要求
- **THEN** 界面可确认受理并保留该指令，处理前不声称已影响当前工具调用；恢复消费规则沿[会话规格](research.md)

### Requirement: W-03 共同状态与局部审查

工作台 SHALL 从真实内核状态呈现进度、结果、失败和待决定；局部修改展示内容差异、理由、执行者及实际应用情况，应用修改与完成任务分别表达。“需要你处理” SHALL 聚合确需人介入的事项，订阅恢复沿[内核规格](kernel.md)保留本地输入与可用画面。

#### Scenario: 修改候选尚未应用
- **WHEN** Agent 提交稿件修改建议供审查
- **THEN** 用户可辨认候选差异及理由，不因建议已生成就显示文件已保存或任务已完成

### Requirement: W-04 开放稿件与共同编辑

W-04 已纳入当前[科研写作编辑器 change](../../openspec/changes/add-research-writing-editor/specs/workspace-editor/spec.md)的 workspace-editor 契约；具体行为以该 active spec 为准，本初设不重复维护第二份契约。该 change 尚未归档并同步到 main specs。

### Requirement: W-05 预览与工程执行边界

W-05 已纳入当前[科研写作编辑器 change](../../openspec/changes/add-research-writing-editor/specs/manuscript-rendering/spec.md)的 manuscript-rendering 契约；具体行为以该 active spec 为准，本初设不重复维护第二份契约。该 change 尚未归档并同步到 main specs；预览与渲染体验的历史调查及未验收边界继续见 [#39](../../.scratch/scholoom-foundations/issues/39-writing-live-preview.md)。

### Requirement: W-06 交互式科研界面与持久报告

系统 SHALL 提供共同原生接口，供 Agent、能力及迁入工作流呈现、更新科研界面，接收选择和输入并继续执行。Markdown／QMD 文字报告和 HTML 交互报告 SHALL 保存到工作区，可重新打开及修改，不要求绑定会话或任务。界面支持共同打开、查看、附为材料和提问；交互脚本不因报告可打开就获得任意文件、网络或内核权限。

#### Scenario: 重新打开交互报告
- **WHEN** 原会话已结束而用户打开工作区中的报告
- **THEN** 可查看保存内容并进行报告支持的筛选、排序或缩放；需要新计算的动作经共同受管执行和有效授权处理

#### Scenario: 用户选择驱动后续研究
- **WHEN** 用户在等待选择的科研界面中提交输入
- **THEN** 输入沿共同执行接口返回相应工作，实际后续结果保存并可查询，不只在页面内模拟完成

### Requirement: W-07 图件选区与生成来源

有结构的图件 SHALL 支持按对象选择；位图区域仅表达几何范围，不声称已识别曲线等科研语义。修改图件 SHALL 尽可能沿可找到的代码、数据或绘图来源重新生成，明确缺少来源时的能力限制。

#### Scenario: 在位图框选一条曲线附近
- **WHEN** 用户附加框选区域并要求修改
- **THEN** 保存区域和指令供解释，核对生成来源，不把框选本身当作已确定的曲线对象

### Requirement: W-08 审稿修订与实际交付

系统 SHALL 支持写作、审稿与修订回复工作流，保留原意见及处理依据，以实际版本、成果和交付检查判断完成。输出支持 DOCX、PDF 与 LaTeX 源交付；外部改稿保留原文件，转换限制明确说明，不承诺无损双向转换。

#### Scenario: 回复称已修改而文件未更新
- **WHEN** 修订回复中声称已完成某项修改
- **THEN** 完成检查核对对应实际稿件与版本，缺少实际改动时保留未完成或待核查状态

#### Scenario: 导入外部修改稿
- **WHEN** 用户接收外部编辑的文档并转换继续写作
- **THEN** 保留原文件，说明不能完整转换的内容，避免把转换结果报告为无损同步
