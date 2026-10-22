# VS Code／GitHub Copilot 的交互界面

调查日期：2026-10-21。官方文档、发布说明及两张官方截图已读取；未运行 VS Code 或 Copilot。本文服务于[阅读写作与成果交互讨论](../issues/07-research-interaction-scope.md)，不决定 Scholoom 采用这些机制。

## 页面反馈

集成浏览器提供元素、评论、截图和日志附加入口。具体流程：打开网页 → 选择 Comment on Elements → 为一个或多个元素写意见 → 在聊天补充要求并发送 → Agent 修改文件并用浏览器检查。主动分享浏览器页给 Agent 与仅附加一次上下文是不同操作。[集成浏览器](https://code.visualstudio.com/docs/debugtest/integrated-browser)、[浏览器工具](https://code.visualstudio.com/docs/agents/run/browser-tools)。

## 聊天内的小应用：MCP Apps

工具返回可交互界面，官方演示包含拖拽排序、性能火焰图和功能开关选择。具体流程：请求整理清单 → 聊天出现可拖动列表 → 用户调整顺序或选择 Ask AI to Sort → 界面经宿主接口调用服务／提供后续上下文。这里的界面来自 MCP 服务，不是随便打开的 HTML。[官方演示与截图，2026-01-26](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support)。

当前开发文档把发消息、更新上下文与调用工具分开：VS Code 的 `sendMessage` 填入聊天输入框而不自动发送；`callServerTool` 调用原服务的工具；上下文更新显示为附件。文档列出的显示方式为 inline，并有 iframe 与 CSP 限制，不能从协议通用能力推导所有宿主行为一致。[MCP developer guide](https://code.visualstudio.com/api/extension-guides/ai/mcp#mcp-apps)。

## 聊天旁的共享工作界面：Canvases

VS Code 1.142（2026-10-14）新增 Canvases Preview。用户与 Agent 可以操作同一看板或其他工作对象；创建入口为 `/create-canvas`，也可装载已有扩展。它是聊天旁的工作界面，与聊天内 MCP Apps 分别介绍。[1.142 发布说明及看板截图](https://code.visualstudio.com/updates/v1_142#_canvases-preview)。

具体流程：描述需要的看板 → Agent 生成并打开 canvas → 人通过按钮／拖动调整卡片 → Agent 通过 canvas 暴露的能力查询或修改同一状态 → 结果显示在同一看板。GitHub 文档同时给出文档、表格与计划等用途。扩展文件可放在项目或用户目录，持久状态由具体扩展实现。[GitHub Copilot app 的 canvas 文档](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions)。

当前 VS Code 支持范围是桌面、本机、受支持的 Copilot Agent Host 会话，要求启用对应设置；不包含 Codex／Claude harness、远程及浏览器客户端。Canvas 与所属聊天关联，能否关闭后恢复取决于扩展，不能推导通用跨会话持久等待保证。[当前适用范围](https://code.visualstudio.com/docs/agents/run/agent-harnesses#_use-canvases-with-the-copilot-harness)。

## 证据边界

已实际查看官方看板与列表排序截图；其中的文件、共享状态及验证文字是官方示例画面，不是本轮运行结果。本轮没有安装扩展、核对其内部源码或执行消息／恢复测试。Canvases、MCP Apps 与集成浏览器是三种产品能力；支持其中一种不自动证明另两种可用。
