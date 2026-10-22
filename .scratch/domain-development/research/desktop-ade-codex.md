# Codex 桌面交互界面：官方资料核对

调查日期：2026-10-21。服务于[阅读写作与成果交互职责讨论](../issues/07-research-interaction-scope.md)。本报告记录参考产品事实，不确认 Scholoom 的新设计。

## 证据与产品入口

本轮实际获取 OpenAI 官方文档、Markdown 正文及官方页面中的示例说明，未登录、安装或运行产品。在线文档未逐页标注应用版本。当前官方资料将桌面宿主称为 ChatGPT desktop app，内部区分 Codex 与 ChatGPT Work；下文只把明确写到 Codex 的行为归给 Codex。

官方开源清单列出 Codex CLI、SDK 与 app-server；本轮未找到完整桌面 UI 的公开实现。能读 app-server 源码不表示能从中还原浏览器批注、文件预览或桌面交互组件。[开源清单](https://learn.chatgpt.com/docs/open-source)、[官方平台说明，2026-08-19](https://developers.openai.com/blog/codex-as-a-platform)。

## 可确认的用户交互

### 共享浏览器与视觉反馈

用户在内置浏览器打开本地应用、文件页面或网站，在页面上选择元素／区域并保存评论，再回到聊天发送要求。Agent 按反馈修改并重新检查页面，用户同时查看实际页面和代码变化。页面评论提供上下文，不等于程序已经修改；工具栏也允许调整样式并先预览。[Browser](https://learn.chatgpt.com/docs/browser)。

具体流程：打开结果图页面 → Annotate 选中柱形图／提示框 → 写明要改的地方 → 在聊天发送 → Codex 改文件并检查页面 → 用户在页面和 diff 中复核。官方页面有对应示意画面与操作说明，但本轮没有实际操作该流程。[官方示例与画面](https://learn.chatgpt.com/docs/browser#preview-a-page)。

### 页面可主动提供选择语义

Browser Annotation API 允许页面把一组元素定义成可选对象，给选择附加名称与少量上下文，也能通过自己的按钮打开标注编辑器。Canvas 对象可由页面自己的命中检测返回身份；这依赖页面提供结构，不能解释为宿主自动理解任意图像。关键区别是：打开标注仍由用户编辑、保存和发送，页面按钮不会自行提交一条聊天消息。预览控件的临时值也不等于持久保存。[Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility)。

### Agent 可以操作页面提供的工具

Site tools／WebMCP 是另一个方向：页面注册能力，Codex 在内置浏览器中发现和调用，例如查询当前文档、设置图表范围。用户可查看可用工具与调用记录；关闭或离开页面后能力可能不可用。该机制说明 Agent 如何操作共享页面，不证明用户的任意按钮能够直接恢复某个后台 Graph。当前支持有模型、工作区及顶层页面等限制。[Site tools](https://learn.chatgpt.com/docs/webmcp)。

## 不宜混为一谈的相邻能力

| 能力 | 官方资料能证明什么 | 本轮没有证明什么 |
| --- | --- | --- |
| 文件预览 | 桌面宿主可预览文件；HTML 预览可用时可交互，支持标注与定向修订 | 任意 HTML 自带调用内核、自动提交指令或持久等待的权力 |
| Visualizations | ChatGPT 的交互图表、模拟和解释，桌面按账号逐步开放 | 所有 Codex 入口都支持相同渲染，或每个控件动作都会回到 Agent |
| MCP Apps 插件 UI | 工具返回界面；在 ChatGPT 中可经桥调用工具、提供上下文或发送后续消息 | 仅凭“Codex 支持插件”便断定 Codex 桌面具有同等 widget 行为 |

依据：[Work with files](https://learn.chatgpt.com/docs/artifacts-viewer)、[Visualizations](https://learn.chatgpt.com/docs/visualizations)、[MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)、[Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)。后两者明确把可选界面渲染描述为 ChatGPT 能力，工具可被两者使用与界面支持范围分别表达。

## 保存、关闭与证据缺口

浏览器有历史与重新打开入口，生成文件有保存位置；这些不等于所有动态筛选状态或未发送批注都承诺跨重启保存。Visualizations 的后续修改也可能生成替代版本，官方建议长期托管、持久数据用途使用 Site。未找到由上述机制统一保证的“关闭页面后后台等待不丢失、原会话结束后任意输入精确接回”的产品契约。[Browser](https://learn.chatgpt.com/docs/browser)、[Visualizations](https://learn.chatgpt.com/docs/visualizations)。

本轮未取得桌面 UI 源码证据，也未验证账号可用性、平台差异、权限弹窗、页面重开及断线恢复。网页截图和官方演示只能作为公开行为依据，不能算本轮运行验收。
