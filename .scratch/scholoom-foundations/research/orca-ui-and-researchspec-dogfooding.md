# Orca UI 调试与 ResearchSpec dogfooding 事实核查

核查时间：2026-10-04。本文为工程决策提供事实，具体方案保存在[工程纪律票](../issues/14-agent-development-discipline.md)及其后续票中。未启动 Scholoom 应用、开发服务器、真实科研 Agent 或付费模型，未安装依赖、创建工作树或修改来源仓库。

## Orca 当前能力与最小探针

会话中的 `ORCA_WORKTREE_ID` 指向 Scholoom 当前项目；使用 `/home/joshua/.local/bin/orca` 读取 `skills get orca-cli` 与 `--reference references/browser.md`。`status --json` 返回 appVersion `1.4.218`、runtime `ready`；`worktree current --json` 确认当前项目路径。没有查询其他项目的 terminal 或会话。

当前版本指南及相应命令 help 提供以下入口：

- worktree 范围内的浏览器 tab、稳定 `browserPageId` 与 `--page` 定位；页面 snapshot、元素 refs、点击、输入和截图。
- `capture start/stop`、console、network；异步页面操作可按文本、selector 等等待。
- worktree 与 terminal 的创建、查询、输入、状态等待和输出读取。`terminal send` 的输入接受与真正开始执行是不同结果。

在 Scholoom worktree 中新建一次性 `data:` 页面，页面只有一个按钮和状态文字。实测结果：

1. 创建 tab、开始 capture、取得 snapshot 与按钮 ref 成功。
2. 点击按钮后，再取 snapshot 看到了变化后的状态；console 读到了该点击产生的日志。
3. capture stop 成功，HAR 的 requestCount 为 0；页面没有网络请求，**未验证真实应用的网络采集**。
4. 首次截图为 1×1。切换到该 tab 后截图为 1280×770，但视觉检查仍是空白；同时 DOM 查询报告 visible、正确的文字与按钮坐标。**截图操作返回成功不等于视觉捕获已经可用**；此次探针未查明空白原因，后续需要在实际页面原型中验证显示条件与页面承载方式。
5. 指南列出的 `exec --command help` 实际返回 `browser_error: Unknown command: help`，不可据此假定任意 agent-browser 子命令均可用。

探针结束后停止 capture，并按 page ID 确认索引后关闭仅本轮新建的 tab。此次验证证明简单页面的语义快照、交互和 console 操作路径可运行，未证明 Electron 接线、复杂编辑器或视觉调试的完整效果。

## 浏览器页面与真实 Electron 的边界

Orca 的内置浏览器是工作树中的页面承载面；本次命令指南未提供将其当作任意 Electron BrowserWindow 的控制入口。将未来 Scholoom UI 放入浏览器，需要明确同一份前端怎样获取实际领域服务，或哪些场景只使用演示数据。浏览器页面的结果不能直接证明 preload、IPC、原生对话框和桌面生命周期已验证。

[Playwright Electron API](https://playwright.dev/docs/api/class-electron)提供启动 Electron、取得真实窗口、主进程求值与页面自动化；官方仍将 Electron 支持标为 experimental，且原生对话框需要另行处理。[Electron 自动化测试指南](https://www.electronjs.org/docs/latest/tutorial/automated-testing)列出 Playwright 和 WebdriverIO 等路径。工具选择和实际版本匹配尚未完成，本轮没有安装或运行这些框架。

## ResearchSpec 当前 dogfooding 实现

来源仓库：`/home/joshua/Workspace/Code/JavaScript/ResearchSpec`，子 Agent 记录 HEAD `f47902cee0bf7bd14a3b9869068c84431caf1395`。由 `gpt-6-luna` 作只读事实调查，主 Agent 通过 CodeGraph 与当前源码、playbook 核对关键结论。没有运行来源项目测试或 dogfood，也没有读取历史 campaign 原始日志来判定成功。

- [dogfood 入口](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood.mjs:44)检查 Linux、Bubblewrap 与所选宿主；[当前工作树检查](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood.mjs:60)要求在 Orca 注册的 ResearchSpec checkout 中执行。协调器在该工作树中创建 terminal 运行 worker，未为每个场景自动创建新工作树。
- [宿主与隔离实现](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood/hosts.mjs:74)通过 Bubblewrap 提供一次性 home、临时目录与可写场景空间，并只读暴露必要的构建产物及宿主配置。**worktree 本身没有替代运行时与数据隔离**；该 sandbox 的参数也不能被解释为网络隔离。
- [真实 Agent worker](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood/worker.mjs:132)启动配置的外部宿主 CLI，采集事件、trace、状态与产物，并有超时处理。另有静态 matrix worker，检查初始化和投影；静态路径不调用真实模型。
- [独立 assessor](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood/assessment-worker.mjs:33)检查执行记录与交付物，对路由、用户控制、证据纪律、交付物可用性给出 0–3 分及断言判断；[assessment 校验](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/scripts/dogfood/assessment.mjs:62)约束引用与建议结论。评分含模型判断，不能称为纯客观评分。
- [playbook](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/playbooks/dogfooding/README.md:53)明确基准材料是合成、离线资料。[评分与结论](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/playbooks/dogfooding/README.md:151)规定自身的签收条件，并区分人工轮与低干预自然语言轮。程序化场景、独立评价和人工审阅均已有方法与实现，但未据此确认当前 HEAD 已实际跑通。
- [场景目录](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/playbooks/dogfooding/scenarios.yaml:7)包含 `natural-18` 等 suite，覆盖文献、写作、证据、审稿与恢复情境。宿主、repeat、并发和超时可配置；是否及怎样在 Scholoom 中使用需另作选择。

## 对后续决策的事实影响

可参考 ResearchSpec 的场景、一次性项目、真实执行、产物检查和评价分工。Scholoom 要测的是自己的原生科研 Agent 及接线；直接运行一个外部编码 Agent 生成文件，不足以验证其产品运行时。

Scholoom 的数据权威、开放文件和低摩擦协同已有独立决定。ResearchSpec 的 hash 封存、逐项正式签收、固定 9/12 门槛及历史矩阵是其自身约定；本调查没有将它们确认为 Scholoom 的要求。未来应分别验证软件链路的稳定行为，以及真实模型参与后的任务效果与成本。
