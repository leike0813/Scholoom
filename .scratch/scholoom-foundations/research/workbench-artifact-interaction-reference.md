# 工作台工件交互：参考核对

调查日期：2026-10-09。对应决策：[细化围绕科研工件的工作台交互](../issues/38-workbench-artifact-interaction.md)。本文记录参考产品事实；Scholoom 的选择保存在决策票。

## 来源与验证范围

OpenAI 部分由主 Agent 获取官方文档。Nimbalyst 部分由 `minimax-cn/MiniMax-M3.1-Flash-Preview` 子 Agent 查官方文档及本地上游源码，主 Agent 抽查选区标签、直接写入与撤销反馈的官方页面。全部为文档／静态源码调查，未实际操作两款产品。

Nimbalyst 源码基线：[`9f13b2794d6d37ab005af6302cfe2a8540cfcdb6`](https://github.com/leike0813/nimbalyst/tree/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6)，子 Agent 报告本地 HEAD 日期 2026-09-30，对应 Electron 0.79.1、extension-sdk 0.6.0。官方文档没有版本标签，不能宣称所有网页内容都与该 commit 完全对应。

## OpenAI 的对象指令

- [Work with files](https://learn.chatgpt.com/docs/artifacts-viewer)：桌面应用在交流旁预览生成文件，支持通过 annotation 指定局部并请求定向修订。文档将 CLI 与 IDE 的文件操作入口分别说明，视觉预览与标注能力不能推定为所有入口共有。
- [Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility)：网页可定义对象选择、文本选区、对象名称、附加上下文以及画布中的选择目标；打开标注编辑器后，仍由用户提交指令。Browser Annotation API 适用 DevDay 2026 及之后的桌面内置浏览器。

可借鉴的是选定对象与指令、上下文一起提交的交互。上述文档不证明任意科研图件都具有可编辑元素，也不证明截图坐标能自动回到科研数据或生成代码。

## Nimbalyst 的工件交互

| 核实内容 | 官方／源码依据 | 限制与可参考点 |
| --- | --- | --- |
| Markdown 可视编辑仍写回普通 `.md`，文件树与标签页是打开入口。 | [Markdown 编辑器](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/)、[文件编辑入口](https://nimbalyst.com/docs/file-management/editor/)、[文件类型处理源码说明](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/docs/FILE_TYPE_HANDLING.md)。 | 不另立可视文档权威。官网与仓库的编辑器数量口径不同，本票不依据数量承诺格式支持。 |
| 选区在输入区显示为可移除标签，可表示文本、单元格、mockup screen、Excalidraw 图形等。 | [Agent Window：Review the Context Sent with a Prompt](https://nimbalyst.com/docs/session-management/agent-window-and-session-management/#review-the-context-sent-with-a-prompt)、[EditorContextItem 与宿主接口](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/extension-sdk/src/types/editor.ts)。 | 移除标签只改变待发指令的上下文，不取消编辑器选区。结构化数据是否实际发送由接口选项控制；子 Agent 没有核实所有 provider 的最终 prompt 拼装。 |
| 临时选区的采集与活动文件相关，会话文档上下文单独维护。 | [useDocumentContext](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/hooks/useDocumentContext.ts)、[文档上下文服务说明](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/docs/DOCUMENT_CONTEXT_SERVICE.md)。 | 子 Agent 核到活动文件判断、选区去抖和失活清理；临时浏览选区与已明确附加的指令材料应区分。Scholoom 已确认的材料保持规则以其自身决策为准。 |
| Agent 修改直接写盘，diff 用于查看已应用修改；Keep 标为已查看，Revert 恢复文件历史。 | [AI Editing：What Keep and Revert do](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/ai-editing-red-green-diff-approval/#what-keep-and-revert-do)、[文件历史](https://nimbalyst.com/docs/file-management/file-history-and-restore/)。 | 不能把红绿差异理解为尚未写入的审批队列。Scholoom 的撤销须沿既有保护后续编辑的约定，不能直接采用整文件恢复作为所有局部撤销的实现。 |
| 编辑器撤销不会回传 Agent，会话可能仍以为原修改存在。 | [AI Editing：Tell the agent when you revert](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/ai-editing-red-green-diff-approval/#tell-the-agent-when-you-revert)。 | 官方要求用户在交流中告知撤销。本项目需要讨论如何让负责 Agent 获知变化线索，并在后续工作中核对当前内容。 |
| 并行会话可通过标签页、分组、文件改动面板与 attention list 查看。 | [Agent Window](https://nimbalyst.com/docs/session-management/agent-window-and-session-management/)、[WorkstreamSessionTabs](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/components/AgentMode/WorkstreamSessionTabs.tsx)、[会话层级说明](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/docs/SESSION_HIERARCHY.md)。 | 分组本身不隔离文件改动，已读也不等于批准。Scholoom 持续任务与执行者已有独立语义，不照搬会话作为科研工作的唯一组织单位。 |

## 尚未核实

未检查真实 UI、移动端、性能、跨平台、所有 provider 的上下文传输，以及真实撤销后的继续效果。源码说明与无版本网页的差异需在实际实现借鉴时核对。

Scholoom 的讨论原型使用合成材料和预置结果，不接入上述产品 API，不证明 Agent 能自动完成定位、科研修改或生成来源追溯。
