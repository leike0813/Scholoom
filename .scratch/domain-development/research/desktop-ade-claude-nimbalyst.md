# 桌面 ADE 交互参考：Claude 系列与 Nimbalyst

调查日期：2026-10-21。本文只记录外部产品的可观察交互事实，供工作台工件交互讨论取用；不含 Scholoom 的方案选择。

## 证据分级与范围

- **文档**：Anthropic 帮助中心、Claude Code 官方文档、MCP 官方博客与 SEP、Nimbalyst 官方文档，逐页打开正文阅读（非搜索摘要）。
- **源码**：Nimbalyst 上游仓库只读检视，基线固定在 [`9f13b279`](https://github.com/leike0813/nimbalyst/tree/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6)（HEAD 2026-09-30，v0.79.1）。官网无版本标签，描述与该 commit 不保证逐字对应。
- **实测**：无。未安装、未登录、未运行产品，未调用付费能力。

先分清三个宿主：普通 **Claude（网页／桌面）**、**Claude Code 桌面 Code 标签**、**Claude Code CLI**。官方文档多处并列提及，实际能力面并不重叠。

## 一、普通 Claude（网页／桌面）：Artifacts 与交互式连接器

### 1.1 Artifacts 面板：选区回传是显式动作

Artifacts 在会话旁独立窗口打开，产物统一存入侧栏 Artifacts 标签（[帮助中心](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)）。2026-09-16 之前生成的为「遗留 artifact」，仍可分享但不能再新建。

具体流程：**看到什么**——会话右侧 artifact 面板，含代码／文档／React 组件实时预览；**怎么点**——在 doc 或 Markdown 文档里高亮目标文字，工具栏点「Edit with Claude」；**输入怎样回 Agent**——在弹出输入框写要求，高亮片段随请求一起提交，Claude 就地改写被标记段落，不必在指令里复述位置；**结果在哪里**——同一面板内更新；跨多个 Markdown 文件可各留一条编辑请求，一次发送后批量应用。

持久化与边界：Docs 可导出 Word／PDF／Markdown／Google Docs，Slides 导出 PowerPoint／PDF，Design 导出 zip／PDF／独立 HTML，动画导出 MP4。artifact 需在 Settings > Capabilities 开启 Cloud code execution and file creation，否则面板不出现。Pro 及以上可让 artifact 读写已连接连接器（Asana、Google Calendar、Slack 等，首次需批准，可按工具关闭），也可存数据（个人或共享，20 MB 上限，仅文本）。「Artifacts that use Claude」一类运行在 Anthropic 基础设施上，使用者各自登录交互。

### 1.2 Custom visuals：点一下就发追问，但默认不留存

Claude 可在会话内直接生成 HTML 自制图表／流程图（[Custom visuals](https://support.claude.com/en/articles/13979539-custom-visuals-in-chat-and-cowork)）。**看到什么**——回复内联渲染的可交互可视化；**怎么点**——点按钮、拖滑块、展开全屏；**输入怎样回 Agent**——在 chat 中点可视化内部会直接向 Claude 发一条追问（如「drill into Q3」），Cowork 尚无此捷径，只能打字追问；**结果在哪里**——仍在这条回复里。

边界很关键：custom visuals 默认 ephemeral，随对话推进不单独保存，只能 Copy as image、Download 为 svg/html，或 Save as artifact。仅 web 与桌面提供，移动端不渲染；分享会话时接收方需登录。

### 1.3 交互式连接器（MCP Apps）：协议级双向通道

Claude 把支持 MCP Apps 的连接器渲染为内联卡片或全屏视图，全屏时对话输入框仍可用（[交互式连接器](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)）。**看到什么**——会话内的实时界面（分析看板、任务板、设计工具）；**怎么点**——过滤、排序、下钻，勾选，展开折叠，确认执行动作；**输入怎样回 Agent**——想改内容就在同一输入框打字，Claude 理解后更新该界面。当前带「Interactive」标记的有 Amplitude、Asana、Box、Canva、Clay、Figma、Hex、Slack。

安全模型：交互式连接器跑在带严格 CSP 的沙箱 iframe 内，界面与 Claude 之间走可审计的 JSON-RPC，服务器须预先声明外部域，宿主可在渲染前审查 HTML；不申请超出连接器本身的权限；不支持第三方连接器完成购买或金融交易。

### 1.4 MCP Apps 规范与官方演示

SEP-1865 状态为 Final，创建于 2025-11-21（[规范原文](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp.md)）。要点：UI 以 `ui://` 资源预先声明，工具通过元数据引用；首版只支持 HTML（`text/html;profile=mcp-app`）；UI 在沙箱 iframe 内通过 MCP JSON-RPC 与宿主双向通信；可选扩展，须经能力协商显式启用；外部 URL 形态被推迟。

MCP 官方博客 2026-01-26 宣布 MCP Apps 成为首个官方扩展，明确「Claude — available today both on web and desktop experiences」（[博客](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)），并给出 App API：UI 可 `callServerTool` 调服务器工具、`updateModelContext` 静默更新模型上下文、发后续消息推进对话，全部走标准 postMessage。官方 SDK 站点首页示例图为「Excalidraw built with MCP Apps, running in Claude」（[ext-apps 文档](https://apps.extensions.modelcontextprotocol.io/api/)）。

**边界结论**：MCP Apps 的双向通道是协议级的（postMessage／JSON-RPC），可审计、可协商。普通 Claude artifact 页面是否具有相同桥接契约，本轮未核实；Claude Code artifact 文档另列了导出复制、connector 调用与评论线程等交互路径，不能混作普通 Claude 面板的保证。

## 二、Claude Code 桌面应用（Code 标签）与 Claude Code CLI

### 2.1 桌面 Code 标签：Browser 面板与 Agent 的验证回路

桌面应用有三个标签：Chat、Cowork、Code（[桌面文档](https://code.claude.com/docs/en/desktop)）。Code 标签能力集中在 diff 复查、Browser 面板预览、终端与文件编辑器、并行会话。

具体流程：**看到什么**——Browser 面板里 Claude 启动的 dev server 页面；**怎么点**——用户可在面板里直接操作页面；**输入怎样回 Agent**——官方文档描述的是 Agent 侧的验证回路：Claude 自动截图、检查 DOM、点击元素、填表并自行修复；用户在面板内的点击是否被结构化回传给 Agent，本轮文档未见明确说明。**结果在哪里**——修复体现在工作区文件，随后以 diff 供人逐行评论，评论再被 Claude 读取并产生新 diff。外部站点需首次授权卡并受安全分类器与域名 allowlist 约束；本地开发服务器免授权。SSH 会话中 Browser 面板无法打开应用，需自行转发端口。

桌面文档全文未出现「MCP Apps」字样。据此只能断言：官方桌面文档没有记载 Code 标签渲染 MCP Apps 界面；不能据此断定它一定不支持，也不能据普通 Claude 桌面的连接器能力推定 Code 标签等价。

### 2.2 Claude Code 的 artifact：发布成 claude.ai 上的独立页面

Claude Code 的 artifact 与普通 Claude 的 artifact 面板不是一回事（[Claude Code artifacts 文档](https://code.claude.com/docs/en/artifacts)）。它是从会话发布到 claude.ai 私有 URL 的活页面，随会话继续原地更新，可分享。

具体流程：**看到什么**——浏览器打开的 claude.ai/code/artifact 页面，页头有标题、Share 按钮与版本选择器；**怎么点**——页面内控件（滑块、开关、输入框）随发布声明的能力而异，文档示例是动画缓动曲线滑块、多方案对比网格、可拖拽分诊看板；**输入怎样回 Agent**——文档未描述页面动作自动回传给 Agent，给出的回传路径有三条：① 页面加导出控件产出文本，用户复制粘贴回终端（文档称「Bring the result back to your session」，示例是 Copy as prompt 按钮）；② 页面声明 connector 调用能力，加载时由 claude.ai 代为调用，动作与副作用走点击者本人账号；③ 页面评论线程用「Send to Claude」或 `@claude` 激活，Claude Code v2.1.221+ 能读评论，v2.1.228+ 可自动回复（受权限模式与每小时 60 条上限约束）。**结果在哪里**——新版本发布到同一 URL，页头可选给观看者看哪个版本；跨会话更新必须给 Claude 该 URL 或用 `/artifacts` 附加，否则新建另一个 artifact。

页面约束：单页、无后端、不能服务多路由、不能自行发起下载（须声明 downloads 能力）、相对链接不解析、外部请求只允许 Google Fonts 与 cdnjs／unpkg／Tailwind／jQuery CDN／jsDelivr 部分路径，fetch、XHR、WebSocket 仅限自身 origin 与 Google Fonts；发布文件限 .html/.htm/.md 且 UTF-8，渲染后 ≤16 MiB。可用条件：Pro／Max／Team／Enterprise，CLI 需 `/login` 登录 claude.ai，只支持 Anthropic API，需 Claude Code v2.1.281+ 与桌面应用 1.13576.0+；Agent SDK、GitHub Action、MCP-server 上下文、`-p` 脚本运行默认关闭。

## 三、Nimbalyst：工件参考，非主流 ADE

Nimbalyst 是开源的 Claude Code／Codex 可视化工作区（[官网](https://nimbalyst.com/docs/)、[GitHub](https://github.com/leike0813/nimbalyst)）。在本项目中只作工件交互参考，不宜称为市场主流桌面 ADE。

### 3.1 选区→Agent：能传的是「对象描述」，不是页面动作

具体流程：**看到什么**——Markdown、Excalidraw、CSV、Calc Sheet、动画、数据模型等编辑器里选中的对象，以可移除 chip 出现在 Agent 输入框上方；**怎么点**——chip 上的 × 移除条目，或整组折叠／恢复；**输入怎样回 Agent**——未移除条目的 description 拼进 prompt，结构化 data 默认不发送，扩展置 `includeData` 才内联 JSON 附带；**结果在哪里**——Agent 会话与工作区文件，Agent 改动以红绿 diff 显示在编辑器里。

源码依据（均固定在 `9f13b279`）：`EditorContextItem` 定义于 [`packages/extension-sdk/src/types/editor.ts:358`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/extension-sdk/src/types/editor.ts#L358)；宿主接收在 [`editorContextStore.ts:62`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/stores/editorContextStore.ts#L62)；chip 渲染在 [`SelectionChips.tsx:65`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/components/UnifiedAI/SelectionChips.tsx#L65)；拼进 prompt 在 [`DocumentContextService.ts:531`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/runtime/src/ai/services/DocumentContextService.ts#L531)，mockup 选中元素走 `<SELECTED_MOCKUP_ELEMENT>`，只含 tagName、selector、outerHTML（`:513`）。

**明确结论**：本轮核到的 mockup 预览路径不执行脚本，不能视为任意 HTML 桥。Canvas 上的 mockup 预览由 [`canvasMockupPreview.ts`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/components/EmbedFrame/canvasMockupPreview.ts) 生成，剥掉 script／iframe／object／embed／base／meta／link 与所有 on* 属性后栅格化。内置 Browser 扩展的文档方向相反：是 Agent 用工具导航、点击、输入、截图、跑 JS 检查页面（[Browser 文档](https://nimbalyst.com/docs/visual-editors-powered-by-ai/browser/)）。源码全仓检索 `mcp-app` 与 `ui://` 无命中，未见 MCP Apps 渲染实现；除 mockup 预览与 Browser 外的其他 HTML 承载路径本轮未逐条核对，不作全称否定。

### 3.2 与「工作流暂停／继续」相关的机制是结构化提问组件

Nimbalyst 内置 `PromptForUserInput` 工具，Agent 在转录区渲染结构化 widget，一次收集多个答案，支持 multiSelect、singleSelect、reorder、editText、confirm 五种字段（[官方文档](https://nimbalyst.com/docs/session-management/interactive-prompts/)）。答案以 JSON payload 结算并解除阻塞（[`interactivePromptTools.ts`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/runtime/src/ai/server/interactivePromptTools.ts)）。这是 Agent 主动向人提问的路径，与「页面内自有 JS 改变自身状态」有本质区别：前者是会话协议上的等待点，后者只是页面内交互。

另一条类似路径是 Canvas 评论线程里的 `@agent`：点击后创建新会话但不抢走当前视图，回复由会话写回该线程（[`canvasAgentDispatch.ts:40`](https://github.com/leike0813/nimbalyst/blob/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6/packages/electron/src/renderer/components/EmbedFrame/canvasAgentDispatch.ts#L40)）。

### 3.3 撤销与持久化边界

官方文档明确：红绿 diff 是「已应用改动的复查面」，不是前置审批队列；改动先落盘，Keep 只标记已查看，Revert 从文件历史恢复旧内容（[AI Editing 文档](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/ai-editing-red-green-diff-approval/)）。更关键：**编辑器里的撤销不会回报给 Agent 会话**，工具调用在写入时就已返回成功，Agent 仍以为自己的编辑在文件里；官方要求用户在聊天里说明「我撤销了你上次的编辑」，Agent 才会重读文件。

持久化方面：Markdown 仍是磁盘上的普通 .md；文件历史自动快照存于本地库 `document_history` 表，Cmd+Y 打开历史面板，恢复本身也产生新快照（[文件历史文档](https://nimbalyst.com/docs/file-management/file-history-and-restore/)）。

## 结论对照（仅事实，不含方案）

| 维度 | 普通 Claude 桌面／网页 | Claude Code 桌面 Code 标签 | Claude Code artifact | MCP Apps | Nimbalyst |
|---|---|---|---|---|---|
| 界面内可交互 | 是 | Browser 面板内是 | 是 | 是 | 是 |
| 界面动作结构化回到 Agent | custom visual 的点击追问；连接器界面与聊天配合 | 未记载 | 导出复制、connector 调用、评论线程 | 协议级 postMessage 双向 | 选区对象描述、Agent 发起的提问组件、Canvas 评论 `@agent` |
| 结果持久位置 | Artifacts 标签／面板 | 工作区文件 + diff | claude.ai 私有 URL，按版本 | 由宿主与服务实现决定，本轮未逐项核实 | 磁盘文件 + 本地快照 |
| Agent 主动等用户 | 交互式连接器／评论 | diff 权限卡 | 评论线程 | 宿主可要求批准 | PromptForUserInput、权限模式 |

## 未核实与冲突

- 未实测任何产品；全部为文档与源码推断，交互延迟、渲染差异未知。
- Claude Code 桌面 Code 标签是否支持 MCP Apps 渲染：官方桌面文档未提及，社区报告说法不一，判定未知。
- 普通 Claude 桌面与 Code 标签共用同一 MCP 服务器配置（`claude_desktop_config.json`），不等于两端 UI 能力一致。
- Claude Code artifact 的控件若由页面自有 JS 实现，其状态与 Agent 无结构化关联；「Bring the result back to your session」依赖复制粘贴，属人工回路。
- Nimbalyst 官网描述与 `9f13b279` commit 可能漂移，未逐页对齐版本。
- 移动端、Cowork、Remote Control 下的行为未逐项核实。

## 主要来源

- Anthropic 帮助中心：[What are artifacts and how do I use them?](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)、[Custom visuals in chat and Cowork](https://support.claude.com/en/articles/13979539-custom-visuals-in-chat-and-cowork)、[Use interactive connectors in Claude](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)
- Claude Code 官方文档：[Desktop application](https://code.claude.com/docs/en/desktop)、[Share session output as artifacts](https://code.claude.com/docs/en/artifacts)、[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- MCP 官方：[SEP-1865](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp.md)、[MCP Apps 公告](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)、[ext-apps SDK 文档](https://apps.extensions.modelcontextprotocol.io/api/)
- Nimbalyst 官方文档：[Start Here](https://nimbalyst.com/docs/)、[AI Editing](https://nimbalyst.com/docs/visual-editors-powered-by-ai/markdown-wysiwyg/ai-editing-red-green-diff-approval/)、[Mockups](https://nimbalyst.com/docs/visual-editors-powered-by-ai/mockups/)、[Browser](https://nimbalyst.com/docs/visual-editors-powered-by-ai/browser/)、[Interactive Prompts](https://nimbalyst.com/docs/session-management/interactive-prompts/)、[File History](https://nimbalyst.com/docs/file-management/file-history-and-restore/)
- Nimbalyst 源码基线 [`9f13b279`](https://github.com/leike0813/nimbalyst/tree/9f13b2794d6d37ab005af6302cfe2a8540cfcdb6)
