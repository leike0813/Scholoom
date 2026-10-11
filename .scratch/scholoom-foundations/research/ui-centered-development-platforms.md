# UI 为中心开发：外部平台能力核查

核查日期：2026-10-11。只收集官方一手事实，不做架构或产品判断。Orca 相关限制本轮不在范围内。

## 判读维度

读每一条事实时区分三件事，否则容易把不同能力混为一谈：

- **设计稿 vs 运行中的应用**：Figma/Penpot 的设计原型不执行 Scholoom 的领域实现；Storybook 可展示实际前端组件，页面标注工具面对运行中的网页。由代码捕获到设计画布的图层也不等于保留了原应用的执行逻辑。
- **能读设计 / 能读评论 / 能写设计**：三者常被同一句“支持 MCP”掩盖，实际工具清单差异很大。
- **平台原生 vs 插件或第三方**：Marker.io、Usersnap 的截图能力是官方产品；Figma 捕获运行中 UI 依赖客户端注入脚本。

## Figma

1. **MCP 读工具覆盖设计结构、变量、截图，官方索引未列出独立的评论读取工具。** 读工具组含 `get_design_context`、`get_metadata`、`get_variable_defs`、`get_screenshot`、`get_code_connect_map`、`download_assets`、`whoami`。不能仅凭设计 MCP 已连接就承诺 Agent 可以读到评论；官方 REST API 提供带权限 scope 的评论读取、写入和删除接口，具体客户端适配仍需验证。[Tools and prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)、[Comments endpoints](https://developers.figma.com/docs/rest-api/comments-endpoints/)
2. **写入画布是原生能力，但按席位分级。** `use_figma` 通过在 Figma 文件上下文中执行 Plugin API 写入真实的 frame、组件、变量与自动布局。写已有文件需要 Full seat 加该文件的编辑权限，Dev seat 只能只读拉取上下文。速率限制只作用于读工具，写入类工具豁免；[View, Collab 席位每月仅 20 次调用](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)。[Write to canvas](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/)
3. **Code to canvas 让运行中的界面变成可编辑图层。** `generate_figma_design` 由客户端启动本地服务、注入脚本、打开浏览器窗口，在窗口内选捕获整屏或元素，产出标准 Figma 图层而非截图。任意席位可写入自己的 drafts。官方把这条路径定位为 code → canvas → code 的往返回环。[Code to canvas](https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/)

原型与评论本身是 Figma 原生能力：交互以 hotspot 与 connection 定义，可直接在原型上留评论。[Guide to prototyping in Figma](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma)

## Jira 与 Atlassian Remote MCP

1. **官方远程 MCP 存在且工具按意图分组。** 端点 `https://mcp.atlassian.com/v2/mcp`，OAuth 2.1 或 API token 认证。Jira 侧工具组为 `read_jira`、`write_jira`、`search_jira`；`delete_jira` 与 `manage_jira` 默认关闭，需管理员显式开启。每个工具继承所属权限组的访问范围，即用户原有权限。[atlassian-mcp-server](https://atlassian.github.io/atlassian-mcp-server/)
2. **覆盖面横跨多个 Atlassian 产品。** 官方说明覆盖 Jira、Jira Service Management、Confluence、Bitbucket、Compass、Loom 及平台层的 Projects、Goals、Teams，数据底层是 Teamwork Graph。[官方说明](https://atlassian.github.io/atlassian-mcp-server/)
3. **存在计费边界。** Atlassian 支持文档说明，经 Atlassian MCP 的统一搜索与上下文工具调用会消耗 Rovo credits。[Understand Atlassian MCP server](https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-mcp-server/)

## GitHub Issues 与 Projects

1. **官方远程 MCP 托管在 GitHub。** 端点 `https://api.githubcopilot.com/mcp`，仓库为 `github/github-mcp-server`，Issues、PR、Actions 与 Projects 均为独立 toolset；Projects 组含 `list_projects`、`list_project_items`、`add_project_item`、`update_project_item` 等读写工具。[Remote Server 文档](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md)
2. **暴露面可控。** 支持 `--toolsets` 白名单与 `--tools` 细粒度选择，官方提供只读模式示例，便于先只开读。[README](https://github.com/github/github-mcp-server)

## Penpot

1. **官方 MCP server 同时提供远程与本地两种模式。** 架构为 MCP server + 运行在 Penpot 内的 MCP 插件 + 客户端；插件把当前聚焦页面接入，MCP 始终作用于焦点所在页面，且同一时间只能在单个浏览器标签页激活。[Penpot MCP server](https://help.penpot.app/mcp/)
2. **读写设计文件是官方声明的能力。** 文档明确 Agent 可读写文件结构——组件、样式、token、页面、图层。远程模式用个人 MCP key 认证，每用户同一时间只能存在一个 key。
3. **原型评论是原生能力。** 评论气泡直接落在设计与原型上，编辑时保持可见并可管理；View mode 可开启“允许团队外用户评论”。[Comments](https://help.penpot.app/user-guide/account-teams/comments/)、[Testing: View mode](https://help.penpot.app/user-guide/prototyping-testing/testing-view-mode/)

## Storybook

1. **官方 MCP server 面向运行中的真实组件。** 通过 `@storybook/addon-mcp` 在 Storybook dev server 上暴露 `http://localhost:6006/mcp`，工具含 `docs-list`、`docs-show`、story 生成与对运行中 Storybook 执行测试。文档标注该 AI 能力处于 preview 状态。[MCP server](https://storybook.js.org/docs/ai/mcp/overview)
2. **组件文档能力依赖显式开启。** docs toolset 读取 components manifest，该特性默认关闭，需在 `.storybook/main.ts` 打开 `features.componentsManifest`；`@nuxtjs/storybook` 等 Vue 组合与 Webpack 版 Angular 不产出 manifest，此时 docs toolset 不可用。
3. **边界要说清：它只覆盖被写成 story 的组件，不是整应用。** 服务随本地 dev server 存在，未写成 story 的页面与路由不在其中。

## Chromatic

1. **UI Review 把评审放在 PR 里。** 可在 PR 中指定设计师、产品经理等利益相关者评审 UI 变更，讨论以线程形式挂在具体 UI 改动上，评审者可要求实现修改，并可设为必须通过的 PR 检查。[Review](https://www.chromatic.com/docs/review/)、[In pull request workflow](https://www.chromatic.com/docs/in-pull-request/)
2. **UI Review 的差异讨论绑定具体视觉快照。** 同一产品也可发布可交互的 Storybook，不能把快照评审理解为全部功能都只能看静态图片。Storybook 的组件运行与 Electron 整应用的领域接线、原生交互和生命周期仍须分别验证。[Review](https://www.chromatic.com/docs/review/)、[Guide for designers](https://www.chromatic.com/docs/guide-for-designers/)

## Marker.io

1. **官方 MCP 服务器地址为 `https://connect.marker.io/mcp`，共 33 个工具。** Agent 可读 projects、issues、screenshots、attachments、console logs 与 network requests，可更新状态、优先级、类型、负责人，并发评论、@提及成员。[MCP Integration](https://help.marker.io/en/articles/14034657-mcp-integration-model-context-protocol)
2. **截图与浏览器上下文来自原生 widget 与扩展。** 报告包含标注截图、浏览器数据、console 日志与 session replay；项目级原生集成 Jira、GitHub、Trello、Asana。[整合指引](https://help.marker.io/en/articles/5546520-how-to-integrate-marker-io-into-your-web-app)
3. **没有长期免费方案。** 官方定价页只列 15 天免费试用（无需信用卡）与付费订阅；免费角色是 unlimited 的 Reporter，但没有 dashboard 与项目管理权限。定价页未列出永久免费档。[Pricing](https://marker.io/pricing)

## Usersnap

1. **官方 widget 在真实产品页面内截图并标注。** 支持 Highlight、Comment、Pen、Arrow、Hide 五种标注工具，可配置为必选、可选或标注优先。[Feedback with a screenshot](https://help.usersnap.com/docs/feedback-with-a-screenshot)
2. **关联 issue 走官方集成。** 支持 Jira Cloud、Service Desk 与 Jira Server；Jira Cloud 集成基于 Forge，支持状态双向同步与自定义字段，创建 issue 需要集成用户在 Jira 中具备建单权限。[Jira Software](https://help.usersnap.com/docs/jira-software)

## 本地与内网的可达性约束

本地或内网应用的捕获方必须实际能够访问页面及其资源，SaaS 服务端不能凭内网 IP 自动取得访问能力。当前 Windows 浏览器可以访问开发机地址时，可考虑直接在该浏览器捕获；Marker.io 官方提供 Native Screenshot API，避免依赖服务端重建，但每次需用户选择要捕获的屏幕或标签页。Code to canvas 同样需要实际能打开页面的浏览器和客户端捕获脚本。[Native browser screenshot rendering](https://help.marker.io/en/articles/9615303-native-browser-screenshot-rendering)、[Using a Localhost Environment](https://help.marker.io/en/articles/9615242-using-a-localhost-environment)

由此还有一条边界：截图、标注、console 与网络记录属于**事后证据**，不等于对运行页面的实时控制。Agent 读取这些反馈只需拉取目标 issue 及其附件，不需要页面处于打开状态。

## 本轮未做的事

- 未注册或访问任何用户账号，未登录 Figma、Atlassian、GitHub、Penpot、Storybook、Chromatic、Marker.io、Usersnap 的实际环境，因此所有能力与限制均来自官方文档，未经实机验证。
- 未安装任何插件、扩展或 SDK，未创建 issue、未发送评论、未发起任何外部写操作。
- 未实测各平台的速率限制实际触发情况，未核实 Atlassian Rovo credits 的具体消耗口径，未核实 Atlassian `write_jira` 组是否覆盖 issue 评论写入这一细项。
- 未评估价格与个人项目规模的匹配度，未比较各方案的迁移成本。
