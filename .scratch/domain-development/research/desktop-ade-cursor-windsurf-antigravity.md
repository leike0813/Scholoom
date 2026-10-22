# 桌面 ADE 交互式界面基线：Cursor、Windsurf、Google Antigravity

用途：为 Scholoom 交互式科研界面的设计讨论提供外部对照，只记录三家官方资料明示的界面行为，不据此推导 Scholoom 的模块划分。

方法：全部结论来自官方文档、官方发布说明与官方博客页面正文，未安装、未运行、未调用付费能力，故无任何实测断言。核对日期 2026-10-21。文末来源列表给出每条事实的出处 URL。

## 结论摘要

三家在「网页开发预览」上的做法高度一致：内置浏览器面板打开本地开发服务器，用户在页面上指认元素，元素连同截图作为上下文送进 Agent 对话。差别在回传的粒度与承载形式：Cursor 把选择送进聊天输入框，Devin Desktop（旧 Windsurf）把它作为 `@ mention` 插入当前 prompt；Antigravity 的官方文档只记录了「Agent 拍截图、用户在截图 artifact 上写评论」这一反向链路，用户主动把元素推给 Agent 的机制本轮未找到明确文档。

在「Agent 生成交互成果」这一层，三家分化明显。Cursor 的 Canvas 与 Antigravity 的 artifact（Generative UI、HTML artifact、可导出的独立可视化）都是 Agent 主动生成的、脱离对话流也能独立打开的产物；Devin Desktop 官方文档中本轮未找到同类形态，其可回访载体记录为 diff、命名 checkpoint 和 Space 上下文。「是否另有承载研究过程的交互工作界面」本轮未在三家官方资料中找到明确表述，不做否定判断。

一个必须记录的事实：Windsurf 已于 2026-06-02 更名为 Devin Desktop，`windsurf.com` 与 `docs.windsurf.com` 均 301/308 跳转至 Cognition 域名。下文「Windsurf」条目实际记录的是 Devin Desktop（即原 Windsurf IDE）的当前官方行为。

## 一、必须先分清的两类界面

- **网页开发预览**：Agent 驱动或用户打开一个浏览器面板，指向本地开发服务器，目的是验证 UI、复现报错、抓取控制台与网络信息。用户在这一侧的动作目的是「让 Agent 看到某个具体元素」。
- **Agent 生成的交互成果**：Agent 主动生成一块内容（报告、仪表盘、图表、实现计划、录屏），渲染在聊天旁或面板中，用户阅读、评论、导出。它不是浏览器预览，渲染的是 Agent 产出的 HTML，不是用户的开发服务器。

把这两类混为一谈会误判三家产品的能力边界。Cursor 的 Browser / Design Mode 属于前者，Canvas 属于后者；Antigravity 的 IDE Browser 与 `/browser` 属于前者，artifact、Generative UI 与插件 UI Extension 属于后者；Devin Desktop 本轮找到的官方记录集中在前者，后者在官方文档中未找到对应描述。

## 二、Cursor

**浏览器与预览（官方文档）。** Browser 工具以 Cursor 内的面板形式打开，Agent 具备 navigate / click / type / scroll / screenshot / console / network 七类动作。文档明确：浏览器以面板形式在 Cursor 内打开，由 MCP server 驱动；截图与文件读取工具打通，Agent 直接以图像形式看到页面状态；浏览器日志写入文件供 Agent grep 读取以节省 token。浏览器状态按 workspace 隔离，cookie、localStorage、IndexedDB 跨会话保留。[Browser](https://cursor.com/docs/agent/tools/browser.md)

**元素与区域选择（官方文档）。** Design Mode 位于 Agents Window 的浏览器内，`Cmd+Shift+D` 开关。可点击选中单个元素、多选元素、Shift+drag 圈选区域、在页面冻结帧上画圈标注、用语音口述。文档写明 Agent 实际得到两份互补信号：元素身份（xpath、组件、attributes、computed styles、fiber tree 中的 props）与一张截图（版面、周边元素、当时的页面状态）。`Cmd+L` 把元素加入聊天，`Option+click` 加入输入框。[Design Mode](https://cursor.com/docs/agent/design-mode.md)｜官方演示：[blog/design-mode](https://cursor.com/blog/design-mode)

**交互回传。** 选择结果进对话输入框（聊天或输入区），属「用户手动操作把上下文推给 Agent」。发布说明另有一条安全加固：元素选择与区域截图只响应用户自己的真实点击，网页不能伪造选择注入聊天上下文。[Release notes](https://cursor.com/docs/release-notes.md)

**成果保留与关闭重开（官方发布说明）。** 用户自己打开的浏览器标签随 workspace 持久化并跨 Agent 切换可见；Agent 自己开的浏览器绑定该 Agent。Canvas 由 Agent 决定是否创建，构建后在聊天末尾出现卡片，可切到源码微调、可让 Agent 重跑；canvas 保存在 workspace 的 canvas 列表中，可随时打开重开并用新数据重跑；`Publish` 生成团队只读链接。共享 canvas 仅付费档可用，免费账号不能创建分享。[Canvas](https://cursor.com/docs/agent/tools/canvas.md)

**桌面与 web。** Agents Window（`Cmd+Shift+P` → Open Agents Window）是 Agent 优先的独立界面，Cursor 3 于 2026-04-02 正式发布；文档称云端 Agent 可从手机、web、Slack、GitHub、Linear 侧操作。[Agents Window](https://cursor.com/docs/agent/agents-window.md)

**源码。** Cursor IDE 未公开源码；官方文档、发布说明与博客是可得的一手来源。

## 三、Windsurf → Devin Desktop

**更名事实（官方 FAQ）。** 「On June 2, 2026, Windsurf is becoming Devin Desktop」，同一 IDE、同一编辑器、同一功能集，仅换品牌；文档迁至 `docs.devin.ai`。原 Windsurf JetBrains 插件进入维护模式，其中 Cascade 被弃用，官方建议改用 Devin over ACP。[Devin Desktop FAQ](https://docs.devin.ai/desktop/devin-desktop-faq.md)

**预览与元素回传（官方文档）。** Previews 可在 IDE 内或浏览器中打开本地部署的应用。文档写明：点右下角「Send element」按钮后选择元素，被选元素以 `@ mention` 形式插入当前 Agent prompt，可一次加多个；控制台错误同样可捕获。Previews 通过 tool call 打开——直接让 Agent「preview your site」即可。文档进一步说明：Devin Local、远端 Agent 与 ACP Agent 共用同一流程，Agent 代理本地开发服务器，用户捕获的元素与控制台错误作为 pending context 落在该 Agent 的消息框内；桌面端预览开在 Agent 旁侧的内置浏览器面板。也可作为编辑器新标签页打开；因为托管在本地，能在系统浏览器中打开并保留全部监听与选择能力，但仅对 Chrome、Arc 及 Chromium 系浏览器优化。[Devin Desktop Previews](https://docs.devin.ai/desktop/previews.md)｜官方演示视频：[browser-preview-demo.mp4](https://mintcdn.com/cognitionai/ZXlEj7-YuSvmCewv/desktop/assets/windsurf/previews/browser-preview-demo.mp4)

**成果保留与关闭重开（官方文档）。** Spaces 把会话、PR、文件与上下文聚成一组，新会话继承 Space 上下文；切走再回来时视图原样恢复。Cascade 会话运行期间锁定、只读灰显，运行结束才可交互；可在对话内创建命名 checkpoint 并随时回滚；Devin Local 的计划写入 `~/.devin/plans/plan-<session>.md`，可编辑、可回访、可交给新会话。Devin Local 明确「不在会话间持久化 memories」。[Spaces](https://docs.devin.ai/desktop/spaces.md)｜[Cascade](https://docs.devin.ai/desktop/cascade/cascade.md)｜[Devin Local](https://docs.devin.ai/desktop/devin-local.md)

**桌面与 web。** 官方发布说明记录远端 Agent 会话也能在 Devin Desktop 内打开浏览器预览，元素与控制台输出作为 pending context 进入 Agent composer。桌面为主形态，web 侧主要是云端会话与远程 Agent。[Changelog](https://docs.devin.ai/desktop/changelog.md)

**源码。** 原 Windsurf/Cascade 为闭源，官方未提供对应源码仓库。

## 四、Google Antigravity

**多形态并存（官方文档）。** Antigravity 有四个形态：App（桌面指挥中心）、CLI、IDE 扩展（VS Code / Visual Studio / JetBrains / Zed / Xcode）、Python SDK。官方能力对照表明确「Sandboxed Chromium browser automation」只勾选 App 一列，「Interactive visual artifacts & diffs」勾选 App、CLI 与 IDE 扩展。浏览器能力分两套：IDE 的浏览器与 App/CLI 的 `/browser` 命令不是同一入口——`/browser` 文档明写该子 Agent 在 Antigravity IDE 中不可用。[Overview](https://antigravity.google/docs/overview.md)｜[/browser](https://antigravity.google/docs/commands/browser.md)

**浏览器与录屏（官方文档）。** IDE 侧：可打开、读取、驱动本地 Chrome，Agent 按需在标签页上操作，截屏并把动作视频保存为交互式 artifact；用户可在设置里关闭浏览器工具。App/CLI 侧：`/browser` 通过 `invoke_subagent` 委派给专用 browser 子 Agent，用 Chrome DevTools MCP 驱动真实 Chrome，运行在独立会话上下文，每次会话录成 WebM 存入该会话的 artifacts。浏览器在独立 Chrome profile 中运行，与用户日常浏览的 cookie、登录信息隔离，但登录态本身会持续保留。[IDE Browser](https://antigravity.google/docs/ide/browser.md)｜[Browser recordings](https://antigravity.google/docs/ide/browser-recordings.md)｜[Separate Chrome profile](https://antigravity.google/docs/ide/separate-chrome-profile.md)

**访问控制（官方文档）。** 两层：服务端 denylist 与本地 allowlist 文本文件（初始仅含 localhost，访问未列入 URL 时弹出「Always allow」）。[Allowlist and denylist](https://antigravity.google/docs/ide/allowlist-denylist.md)

**交互回传：只有反向链路有官方证据（官方文档）。** 截图文档写明：browser 子 Agent 可对页面或页面元素截图，截图全部存为 image artifact，「you can comment on them to give feedback to the agent」。artifact 文档补充：可在 artifact 上留行内文本反馈以引导 Agent，在修改任何本地文件之前生效。官方文档与更新日志中未检索到「用户手动点选页面元素直接发给 Agent」的描述——该能力标为**未知**，不做推断。[Screenshots](https://antigravity.google/docs/screenshots.md)｜[Artifacts](https://antigravity.google/docs/artifacts.md)

**Agent 生成的交互成果（官方文档与更新日志）。** artifact 定义为 Agent 创建的结构化交付物，含富 Markdown 计划、代码 diff、架构图、图片、浏览器录屏；App 有专门的侧栏与审阅面板。v2.11.0（2026-08-26）引入 Generative UI，HTML artifact 直接内联渲染在聊天中，支持 KaTeX、Chart.js、Plotly；交互 widget 与 HTML artifact 上的 prompt 动作改为填入并聚焦输入框而非自动发送。同版本另有「在文件查看器中对任意图片拖选区域并留评论」。官方博客进一步说明生成式可视化产出零依赖 HTML，在本机渲染，可导出为独立 HTML 文件。[Changelog](https://antigravity.google/docs/changelog.md)｜[Visualizing with the help of Antigravity](https://antigravity.google/blog/visualizing-with-the-help-of-antigravity/)

**插件自定义界面（官方更新日志）。** v2.22.0（2026-10-08）新增 UI Extensions，允许已安装插件在会话旁的侧栏内构造并显示自定义界面，应作为一种界面类型单独列出。该条只说明了界面归属与位置；其与 Agent 的回传协议、以及跨会话/关闭重开后的持久化语义，本轮未找到官方说明，标为未知。[Changelog](https://antigravity.google/docs/changelog.md)

**桌面与 web。** Remote Control 让用户从任意浏览器连到本机桌面会话，可查看会话、启动任务、审阅计划与 artifact，移动端可装 PWA 收推送。[Remote Control](https://antigravity.google/docs/remote-control.md)

**源码（官方仓库）。** GitHub 组织 `Google-Antigravity` 下有 `antigravity-cli` 与 `antigravity-sdk-python`（PyPI 包 `google-antigravity`，核对时 0.1.22）。两者是 CLI 与 SDK，未包含 IDE 浏览器或 artifact 渲染实现，因此不能作为其界面实现的参考源码。

## 五、一条具体流程（Cursor Design Mode）

**用户看到什么**：Agents Window 里的浏览器标签，正显示本地开发服务器页面，右下角有 Design Mode 开关，输入区上方有 Design mode 提示框。

**怎么操作**：按 `Cmd+Shift+D` 进入 Design Mode → 鼠标点住页面上的一个组件（或 Shift+drag 圈一片区域）→ 选中态高亮后按 `Cmd+L` 或 Option+click，把该元素推入聊天区/输入框 → 用一句话说明要改什么 → 发送。

**Agent 实际得到什么**：该元素的 xpath、对应组件、attributes、computed styles、fiber tree 里的 props，加上一张包含周边布局与当时页面状态的截图；Draw 标注则叠加在视口的冻结帧上。

**结果在哪里**：Agent 在后台改代码，运行中的应用热更新，改动以 diff 形式呈现；同时发出的一条编辑可以在前一条未完成时继续排队发出，多个子 Agent 可并行处理。

来源：[Design Mode](https://cursor.com/docs/agent/design-mode.md)。

## 六、横向对照

| 维度 | Cursor | Devin Desktop（原 Windsurf） | Antigravity |
|---|---|---|---|
| 浏览器承载 | Cursor 内面板 / Agents Window 浏览器 | IDE 内浏览器面板、系统浏览器 | IDE 浏览器；App/CLI 用 `/browser` 走真实 Chrome + DevTools MCP |
| 元素送 Agent | 选元素→加入聊天/输入框，附 xpath、样式、props、截图 | 「Send element」→作为 `@ mention` 插入当前 prompt | 官方仅记录 Agent 截图→用户评论；用户选元素回传未知 |
| Agent 交互成果 | Canvas（可重开重跑、可发布只读链接） | 本轮未找到同类形态的官方描述；可回访载体记录为 diff、命名 checkpoint、Space 上下文 | artifact / Generative UI / 插件 UI Extension（侧栏自定义界面）/ 可导出独立 HTML 可视化 |
| 浏览器会话持久 | 按 workspace 隔离 cookie、存储、登录态 | 未见公开的等价说明 | 独立 Chrome profile，登录态持续保留 |
| 关闭重开语义 | 自开标签随 workspace 持久，Agent 开的绑 Agent | Space 视图原样恢复；会话运行时只读 | 项目支持 worktree 隔离；artifact 存于会话 |
| 云端/远端 | 云 Agent 可从 web、手机、Slack 等操作 | 远端 Agent 会话可在桌面端开浏览器预览 | Remote Control 从任意浏览器驱动本机会话 |
| 公开源码 | 无 | 无 | CLI 与 SDK 两个仓库，界面实现不在其中 |

## 七、冲突与未知

- **Antigravity 用户侧元素选择回传**：官方文档只覆盖 Agent→用户的截图评论方向，用户手动选元素发给 Agent 的机制在文档与更新日志中均未检索到，标为未知。
- **Antigravity 插件 UI Extension**：v2.22.0 更新日志给出了界面归属与位置（插件内构造，显示在会话旁侧栏），但其与 Agent 的回传协议、以及跨会话或关闭重开后的持久化语义本轮未找到官方说明，标为未知。
- **Devin Desktop 浏览器会话的 cookie/存储持久语义**：Previews 文档只描述监听与选择能力，未说明会话持久化范围，与 Cursor、Antigravity 的显式表述无法对齐。
- **Antigravity 的「browser 子 Agent 不可用于 IDE」**：`/browser` 文档如此声明，而 IDE 又有独立浏览器文档；两者的能力差异官方未给出一张对照表。
- **关闭重开语义**：三家对「成果是否在会话结束后仍可访问」的表述粒度不同（workspace 列表 / Space 上下文 / 会话 artifacts），只能并列记录，不做等价断言。
- **版本口径**：Cursor 文档页未标版本号，以 3.24 与 3.21 发布说明为时间锚点；Devin Desktop 以 2026-06-02 更名为锚点；Antigravity 以 v2.11.0（2026-08-26，Generative UI）与 v2.22.0（2026-10-08，UI Extensions）为锚点。逐项功能适用版本未全部核实。

## 来源

- Cursor 官方文档：[Browser](https://cursor.com/docs/agent/tools/browser.md)、[Design Mode](https://cursor.com/docs/agent/design-mode.md)、[Canvas](https://cursor.com/docs/agent/tools/canvas.md)、[Agents Window](https://cursor.com/docs/agent/agents-window.md)、[Release notes](https://cursor.com/docs/release-notes.md)、[官方博客 Design Mode](https://cursor.com/blog/design-mode)
- Devin Desktop 官方文档（承接原 Windsurf）：[FAQ：Windsurf 更名](https://docs.devin.ai/desktop/devin-desktop-faq.md)、[Previews](https://docs.devin.ai/desktop/previews.md)、[Cascade](https://docs.devin.ai/desktop/cascade/cascade.md)、[Spaces](https://docs.devin.ai/desktop/spaces.md)、[Devin Local](https://docs.devin.ai/desktop/devin-local.md)、[Changelog](https://docs.devin.ai/desktop/changelog.md)、[官方演示视频](https://mintcdn.com/cognitionai/ZXlEj7-YuSvmCewv/desktop/assets/windsurf/previews/browser-preview-demo.mp4)
- Google Antigravity 官方文档：[Overview](https://antigravity.google/docs/overview.md)、[IDE Browser](https://antigravity.google/docs/ide/browser.md)、[/browser 命令](https://antigravity.google/docs/commands/browser.md)、[Screenshots](https://antigravity.google/docs/screenshots.md)、[Artifacts](https://antigravity.google/docs/artifacts.md)、[Browser recordings](https://antigravity.google/docs/ide/browser-recordings.md)、[Allowlist and denylist](https://antigravity.google/docs/ide/allowlist-denylist.md)、[Separate Chrome profile](https://antigravity.google/docs/ide/separate-chrome-profile.md)、[Artifact review](https://antigravity.google/docs/artifact-review.md)、[Remote Control](https://antigravity.google/docs/remote-control.md)、[Changelog](https://antigravity.google/docs/changelog.md)、[官方博客：Visualizing](https://antigravity.google/blog/visualizing-with-the-help-of-antigravity/)
- 官方源码仓库：[Google-Antigravity/antigravity-cli](https://github.com/Google-Antigravity/antigravity-cli)、[Google-Antigravity/antigravity-sdk-python](https://github.com/Google-Antigravity/antigravity-sdk-python)（PyPI `google-antigravity` 0.1.22）

## 对 Scholoom 讨论的提示

三家共同呈现的是「浏览 + 注释」范式：Agent 能看页面，人能把某个具体对象指给 Agent；跨进程的持久等待与回传协议本轮未在公开资料中核实。可迁移的差异在产物层——Cursor Canvas 与 Antigravity artifact 把「Agent 生成的交互内容」从聊天流里拿出来，成为可重开、可导出、可评论的独立对象；Antigravity v2.22.0 的插件 UI Extension 更进一步，让插件自带界面常驻会话旁的侧栏。Devin Desktop 本轮未找到同类形态，其可回访载体记录为 diff 与上下文。这些是外部证据，不构成对 Scholoom 界面形态的建议。
