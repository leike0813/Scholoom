# 实际交付与交接

## 当前状态与成果

本 change 的实现、独立审查、最终串行 `pnpm check` 及截图核对已完成，任务状态以 [tasks.md](tasks.md) 为准。深色控件样式补齐后，桌面重建、smoke 和浏览器对话路径复验均通过。本轮未安装依赖、提交、归档或操作用户日常内核。

已核对 [design.md](design.md) 的模块图和归档时序：GUI 与公开客户端共用协议及 Harness；会话事实仍在项目数据库，归档只改变可执行性，材料和正文以实际文件为准。

| proposal 完成判据 | 实现及验证入口 |
| --- | --- |
| 可辨认、可查找的会话 | 首条受理指令标题、手动标题保护、项目内字面查找、活动／归档分页；超过 100 条列表与独立当前会话经真实客户端验证 |
| 归档不丢工作且不自动继续 | 停止后归档、归档期间拒绝新执行、原回执可查询、恢复只解除归档；重启及独立备份恢复保留状态和内容 |
| 可阅读、复制和打开材料 | 共享 Markdown Worker、GFM／KaTeX、原文及代码复制、稳定 fileId 定位、URI 路径与安全外链；工作台复用既有文件 tab 与草稿 |
| 异步与跨端一致 | 接收者不依赖列表，旧查询按范围隔离；会话元数据通知合并，同项目切换保留列表变更，跨项目清理旧通知 |

主要变化在 protocol/business.ts、client/index.ts、kernel 的 application／server／harness，以及 Workbench、business-session、SessionList、MessageContent、MarkdownText、markdown-queue 和已有 MarkdownPreview；具体职责与文件清单见 design。开发说明、路线图、架构及 UI 设计已同步，失效归档链接已修复。

## 实际验证

环境：Linux、Node 24.12.0、pnpm 11.10.0，既有 Chromium 与真实 Electron。模型替身仅在 loopback Anthropic HTTP 边界，内部图、工具、WebSocket、数据库、文件、UI 及剪贴板均为真实实现。测试使用隔离配置、项目和受管 fixture 进程。

| 命令／检查 | 结果与证据范围 |
| --- | --- |
| `openspec validate complete-agent-conversation-workbench --strict` | 已通过；内嵌 Mermaid 另经人工核对，未运行独立图渲染器 |
| 定向内核会话及客户端检查 | 最后订阅修正后 11 通过；并发回执、凭据等待期间归档／改名、材料路径复用、跨项目及同项目订阅、备份恢复 |
| Markdown 路径及 Worker 接口测试 | 已通过；URI 解码前后边界、片段、中文和空格、单在途、旧请求替代、释放及旧实例事件隔离 |
| `pnpm test:ui tests/ui/file-workbench.spec.ts tests/ui/conversation.spec.ts tests/ui/harness.spec.ts` | 12 通过；双宿主覆盖消息、真实 Clipboard、文件身份与草稿、长待核查指令、保存中编辑与并排预览、流式输入取消 |
| 最终串行 `pnpm check` | exit 0；静态、类型与构建通过，内核 54 通过／1 默认跳过，smoke 4 通过，双宿主 UI 41 通过／1 跳过。完整日志 `/tmp/scholoom-conversation-verified-check.log` |
| 深色控件样式收尾 | `pnpm lint` 通过，99 个文件；`pnpm --filter @scholoom/desktop build` 通过，随后 `pnpm test:smoke` 4 通过及浏览器对话用例 1 通过。日志 `/tmp/scholoom-conversation-theme-check.log` |

截图在 `test-results/ui/conversation-conversation--58ce8-ng-preserve-the-active-work-ui-{browser,electron}/conversation-{markdown,markdown-dark,restored}.png`，选定截图另存 `test-results/conversation-evidence/ui-{browser,electron}/`，避免后续 suite 清理。已实际查看最终浏览器深色消息、Electron 深色消息与浅色恢复图，以及前轮浏览器浅色图；搜索框、活动／归档状态、正文、表格、公式、复制和材料入口可读，草稿保留。

## 审查与问题处理

- 独立内核审查发现并修复：按路径收集材料覆盖原身份，改为 fileId；并发补交在凭据等待后撞唯一键，改为受理事务内核对并跳过调度，预检失败也优先返回已受理回执；切换项目清理合并中的旧通知。同项目切换保留适用的列表事件由独立红绿测试补齐。窄复核通过。
- 独立 UI 审查发现并修复：共享 URI 路径没有解码／分离片段；长待核查正文在滚动区外挤出输入器。新增实际中文文件链接、编码安全样本和 80 行待核查指令的双宿主检查，窄复核通过。
- 模块及整合检查修复了 Worker 旧实例迟到事件、错配响应和零高度首次消息占位；原始正文在解析失败时保持可读。归档／执行通知放入当前可见形态，避免 overlay 遮挡恢复入口。
- 深色截图暴露搜索框仍使用原生白底，已补齐既有语义 token 的背景、文字、边框与禁用状态，重新构建并核对最终截图。
- 初轮全量检查曾在 Electron 文件预览中缺少最后一段草稿；单独三次复跑通过。已有测试补入外部传输层的 `files.read` 延迟门，明确验证保存尚未完成时继续编辑和切换并排预览，并同时核对编辑器及预览；受影响双宿主检查已通过，未删减原断言。
- 一轮并行内核诊断曾共用 test-results 导致 trace 互相覆盖；最终验收改为串行。临时格式补丁、队列自检及调查日志保留在 `/tmp` 供本轮核查；长期回归已进入 tests，不作为产品依赖。

## 未完成事项与下一步

本 change 无剩余实施或验收事项，保留为已完成、未归档变更。整个基础 harness 阶段仍按路线图及实际使用反馈判断，不以本次交付替代科研能力和分发验收。

未运行真实付费模型、Windows／macOS、实际分发包或完整科研质量验收。消息图片、全文检索、更多模型、shell、MCP、多 Agent 和 P3d 沿已确认范围后置。日常驻留内核需用户选择时机重启才能加载更新，本轮未操作它。
