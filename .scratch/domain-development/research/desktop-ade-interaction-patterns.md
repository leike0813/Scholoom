# 桌面 Agent 环境的交互式界面调研

调查日期：2026-10-21。对应[阅读写作与成果交互职责票](../issues/07-research-interaction-scope.md)。用户要求先看主流产品怎样工作，再恢复设计讨论；本报告是参考依据，不采纳新的 Scholoom 方案。

## 调查范围与证据

优先 Codex 桌面体验，覆盖 VS Code／GitHub Copilot、Cursor、Windsurf、Google Antigravity，并以 Claude 的交互产物和本项目曾参考的 Nimbalyst 作对照。“主流”在这里表示选取代表产品，不作市场份额排名；Claude Artifacts 与 Nimbalyst 的产品定位也不直接等于桌面 ADE。

本轮读取官方产品文档、发布说明、演示说明，并查看官方图像；没有安装或登录这些产品，没有运行真实产品任务。开放源码只在明确核对到的范围内作为实现证据。产品功能随版本、账号与宿主变化；没有找到文档保证的行为列为未知。

## 从用户实际操作看，有几种不同体验

| 用户实际在做什么 | 例子 | 是否需要 Agent 再执行 |
| --- | --- | --- |
| 探索已经生成的内容 | 调图表滑块、筛选表格、展开一条结果 | 页面自己的逻辑即可；不能据此断言每次操作都通知 Agent |
| 指着成果提出修改 | 选中图例、标注一段话、附加当前卡片并提问 | 通常进入聊天草稿或反馈，再由 Agent 处理 |
| 在共同工作界面直接推进 | 移动看板卡片、填写工具表单、让 Agent 查询同一状态 | 取决于宿主提供的动作、工具及状态机制 |

这是对观察到的交互作说明，三者可以并存。把它们都叫“HTML 交互报告”会掩盖用户操作后的不同结果。

## Codex 优先核对

### 最容易对照的流程：看页面，指着它说要改哪里

官方当前把桌面宿主称为 ChatGPT desktop app，并明确 Codex 可以使用其内置浏览器。典型体验是：打开本地页面 → 点 Annotate → 选元素或框区域 → 写并保存评论 → 在聊天发送 → Agent 修改后检查页面。它把结果和对话放在一起，而不是要求用户重新描述整个页面。[官方 Browser 操作说明与示意画面](https://learn.chatgpt.com/docs/browser)。

对科研场景的直观类比是：看结果图，选中图例，告诉 Agent“这里的标签不清楚”。这是说明产品体验的类比，尚未决定 Scholoom 的实现。

页面可通过 Annotation API 给卡片、文字或画布对象提供名称及上下文，也可从自己的按钮打开反馈编辑器；用户仍需发送，打开编辑器不会自行发消息。这是普通元素批注与带业务语义选择之间的区别。[官方 Annotation API 与可操作示例](https://learn.chatgpt.com/docs/annotations-extensibility)。

Codex 也可发现页面暴露的 Site tools／WebMCP，直接读取或修改页面所代表的状态。这是 Agent 调用页面能力的入口，不能反过来推断所有页面按钮都能自动启动 Agent。[Site tools](https://learn.chatgpt.com/docs/webmcp)。

### 生成的可交互内容与桌面源码

桌面文件预览在可用时支持 HTML 的交互预览；ChatGPT 的 Visualizations 则提供模拟、图表等交互解释，桌面仍有开放范围限制。MCP 插件界面还有工具调用与消息桥，但当前文档把 UI 渲染描述为 ChatGPT 能力。这些入口与 Codex 的浏览器反馈分别记录，不能仅凭共享插件目录推断行为相同。[文件预览](https://learn.chatgpt.com/docs/artifacts-viewer)、[Visualizations](https://learn.chatgpt.com/docs/visualizations)、[插件 UI](https://developers.openai.com/plugins/build/chatgpt-ui)。

关于“桌面端似乎没有开源”：本轮没有找到完整桌面 UI 的公开实现；官方明确列出的开放部分包括 CLI、SDK 与 app-server。它们可提供运行时或集成参考，不能当作已经拿到了桌面预览和批注 UI 的源码。[官方开源清单](https://learn.chatgpt.com/docs/open-source)。

更细的证据、适用范围与缺口见 [Codex 专项记录](desktop-ade-codex.md)。

## VS Code／GitHub Copilot：两种更直接的界面参考

### 聊天里出现一个可操作的工具界面

MCP Apps 的官方示例直接在聊天里给出拖拽排序列表、火焰图或选项面板。用户对着结构化结果操作，组件可调用服务工具、提供上下文或请求后续消息。VS Code 当前的发消息方法只是填入输入框，不自动发送；因此“点了界面”和“Agent 收到新要求”仍须分别核对。[官方演示](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support)、[宿主行为](https://code.visualstudio.com/api/extension-guides/ai/mcp#mcp-apps)。

可直接看[官方拖拽列表截图](https://code.visualstudio.com/assets/blogs/2026/01/26/mcp-apps-list-sort.webp)。本轮查看过该图，图像是产品演示证据，不是本轮运行记录。

### 聊天旁有一个人和 Agent 共用的工作界面

Canvases Preview 让用户与 Agent 操作同一看板或文档状态。官方流程是请求创建 canvas → 打开聊天旁的界面 → 人用控件修改 → Agent 经暴露能力读写同一状态。GitHub 文档还列出计划、表格、文档等例子。[GitHub Copilot app 的操作说明](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions)。

可直接看[官方看板截图](https://code.visualstudio.com/assets/updates/1_142/kanban-canvas.webp)：左边是可操作看板，右边是对话和生成文件。这比抽象讨论“动作回传”更容易理解：人和 Agent 都能对同一个看板工作。

这项能力在 VS Code 1.142 的 2026-10-14 发布说明中仍标 Preview；当前限定桌面、本机和受支持的 Copilot Agent Host 会话，不覆盖 Codex／Claude harness、远程或网页客户端。关闭重开也取决于具体扩展，不能照搬为产品通用保证。[版本依据](https://code.visualstudio.com/updates/v1_142#_canvases-preview)、[当前适用范围](https://code.visualstudio.com/docs/agents/run/agent-harnesses#_use-canvases-with-the-copilot-harness)。

更细的证据见 [VS Code／Copilot 专项记录](desktop-ade-copilot.md)。

## Cursor、Windsurf／Devin Desktop 与 Antigravity

| 产品 | 用户看到和操作的界面 | 能确认的反馈路径 |
| --- | --- | --- |
| Cursor | Design Mode 在网页上选元素；Canvas 在聊天旁呈现报告、分析或仪表盘 | 元素进入聊天上下文；Canvas 可看源码、要求修改、保存后重开及用新数据重跑 |
| Windsurf／Devin Desktop | 浏览器预览中选择元素或控制台错误 | 所选内容进入对应 Agent 的输入框，补充要求后发送 |
| Antigravity | Markdown／截图 artifact 审阅、HTML Generative UI，另有插件侧栏 UI Extensions | 可给 artifact 留反馈；部分 prompt 动作填入输入框，具体 UI Extensions 的桥与恢复保证本轮未核实 |

依据：[Cursor Design Mode 官方演示](https://cursor.com/blog/design-mode)、[Cursor Canvases](https://cursor.com/docs/agent/tools/canvas)、[Devin Desktop Previews](https://docs.devin.ai/desktop/previews)、[Antigravity 更新记录](https://antigravity.google/docs/changelog)。Windsurf 在 2026-06-02 更名为 Devin Desktop，当前文档须按新名称核对，[官方 FAQ](https://docs.devin.ai/desktop/devin-desktop-faq)。

Cursor 的 Canvas 特别值得作为“Agent 交付的分析界面”参考：用户要求一份分析 → 回答末尾出现卡片 → 点击在聊天旁打开交互结果 → 检查、改源码或继续要求 Agent 修改 → 以后从工作区 Canvas 列表重开。官方没有在该页给出任意按钮自动恢复工作流的通用协议，不据此推断。[具体流程](https://cursor.com/docs/agent/tools/canvas)。

Antigravity 的 v2.11.0（2026-08-26）明确加入聊天内 HTML artifact、数学公式和图表支持；v2.22.0（2026-10-08）又加入插件在会话旁显示自定义界面。普通交互产物与安装插件提供的界面是不同形态，不能把旧 artifact 文档当作其全部能力。[版本依据](https://antigravity.google/docs/changelog)。

细节、官方演示入口及未确认项见 [三款产品专项记录](desktop-ade-cursor-windsurf-antigravity.md)。

## Claude：区分即时可视化、长期产物与连接器界面

普通 Claude 的 Custom visuals 是聊天中的交互解释：上传 CSV、请求图表 → 回复内出现图表 → 调整控件、下钻或继续追问。官方明确 Chat 中存在点击发起后续问题的机制，Cowork 暂没有同样捷径；这不能推广为两端所有点击都会发送。它默认不单独保存，可下载或转为 artifact。[官方说明与示例](https://support.claude.com/en/articles/13979539-custom-visuals-in-chat-and-cowork)。

Interactive connectors 则把 Asana 看板、数据分析等服务界面放进对话；用户可以改状态或筛选，继续在输入框要求 Claude 调整。其资源与动作属于已连接服务，不能当作 Agent 随手生成的任意 HTML。[官方交互说明](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)。

Claude Code 另有发布到 claude.ai 的版本化 artifact：Agent 输出页面 → 用户打开 URL 操作／审阅 → 可复制整理好的结果回会话，也有按版本与权限支持的评论发送给 Claude、连接器调用等路径。新会话更新已有 artifact 需要明确引用或附加它。它不是本地桌面预览的同义词。[Claude Code artifact 说明](https://code.claude.com/docs/en/artifacts)。

Nimbalyst 在本项目作为开放源码的工件交互对照：选区以可移除 chip 进入待发上下文，修改可在编辑器中复查；另有结构化用户提问和 Canvas 评论 `@agent` 的实现路径。不能因选区桥存在便推定任意 HTML 已能直接启动工作。官方还提示编辑器撤销不自动告诉 Agent，需要另外处理当前内容核对。[选区说明](https://nimbalyst.com/docs/session-management/agent-window-and-session-management/)、[交互提问](https://nimbalyst.com/docs/session-management/interactive-prompts/)、[修改与撤销](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/ai-editing-red-green-diff-approval/)。源码范围与固定版本见 [Claude／Nimbalyst 专项记录](desktop-ade-claude-nimbalyst.md)。

## 下一轮讨论可以先看哪些具体例子

本轮不要求采纳前一轮 Q3／Q4。优先用以下三个现成体验讨论用户需要什么，再讨论接口：

1. **Codex 的页面批注**：指着一段文字或图件，附上问题，Agent 继续处理。适合说明“我想针对这个对象交流”。
2. **Cursor Canvas／Claude 交互可视化**：Agent 交付可探索的分析内容，用户先自己筛选或比较，再提出后续要求。适合说明“我想先看懂结果”。
3. **Copilot Canvas／MCP Apps**：人和 Agent 操作同一个工作对象，例如材料清单、方案比较或处理看板。适合说明“我想在界面里推进工作”。

这是恢复讨论的参考顺序，不是产品分层或实施顺序。三种体验可以同时有；先明确最有用的一项，再用 Scholoom 的真实材料场景说明从点击到结果的全程。

当前证据不足以统一承诺：所有界面自动外发材料、所有按钮都会调用 Agent、关闭页面不影响所有页面能力、所有临时状态都跨重启保留，或原会话结束后无条件接回旧工作。产品各自文档的局部保证不宜拼成一套不存在的共同保证。

## 本轮产物与边界

总报告及四份专项记录保存于本目录，决策票链接本报告继续讨论；Q1／Q2 保留已确认状态，Q3／Q4 未确认，决策票不关闭。本轮未修改业务代码、安装依赖、调用真实科研模型或启动开发服务器。

官方文档与图像是当前可取得的行为依据；未进行账号内实测、性能与跨平台验证。抓取的 OpenAI Markdown 和两张 Microsoft 官方截图位于 `/tmp/scholoom-ade-research-X51HWK/`，仅供本轮核对，可由系统清理，报告不依赖该目录运行。
