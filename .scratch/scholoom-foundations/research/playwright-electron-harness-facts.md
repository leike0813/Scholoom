# Playwright 与浏览器／Electron 调试事实

核对日期：2026-10-04。关联 [#20 UI 调试与 e2e](../issues/20-ui-debugging-and-e2e-harness.md)。本轮只读官方文档及本项目已有决定，未安装依赖、启动服务、运行 Electron 或验证实际版本组合。

## 可复用的自动化能力

- Playwright 官方 Electron API 标为 experimental，提供启动开发入口／指定 executablePath、获取窗口、主进程求值和关闭应用。Electron 官方自动化指南列举 Playwright 与 WebdriverIO；这不等于任意新 Electron 版本或打包产物均已验收。[Electron API](https://playwright.dev/docs/api/class-electron)、[Electron 测试指南](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- ElectronApplication 提供 BrowserContext、BrowserWindow 对象获取、窗口事件与进程句柄；页面自动化沿 Playwright Page。可以在同一测试工具中分别建立浏览器和真实 Electron 的场景，独立 Node 内核的启动、发现、数据目录及关闭仍需应用测试 fixture 管理。[ElectronApplication](https://playwright.dev/docs/api/class-electronapplication)、[Fixtures](https://playwright.dev/docs/test-fixtures)
- 官方提示 Electron 启动超时应检查 `nodeCliInspect` fuse；测试启动与最终分发设置需要分别核对，不能为了某一种自动化方式任意修改正式分发配置。[启动条件](https://playwright.dev/docs/api/class-electron#electron-launch)
- 原生 Electron dialog 不被 Playwright 直接拦截。官方建议通过主进程求值替换 dialog 方法返回确定结果，这能检验选择文件后实际业务接线，但不证明 OS 对话框本身可用。原生交互另行人工／桌面工具验收。[dialog 边界](https://playwright.dev/docs/api/class-electron)
- locator 可按 role、label、test id 等定位，断言可等待可观察状态达到预期；适合减少固定等待和内部 CSS 耦合。内容编辑器、Canvas／WebGL 及材料选区的具体操作仍须分别验收。[Locators](https://playwright.dev/docs/locators)、[Assertions](https://playwright.dev/docs/test-assertions)
- Trace Viewer 提供步骤、DOM snapshot、截图、console 和 network 等诊断资料。浏览器 trace 不能自动覆盖所有 Node 内核、main、兼容宿主和受管子进程活动，跨进程日志应按实际调用关联保存。[Trace Viewer](https://playwright.dev/docs/trace-viewer)

## Scholoom 的接入前提

[#09 架构](../issues/09-electron-architecture.md)已选独立 Node 内核及本地 WebSocket／JSON-RPC，GUI／CLI／浏览器共用客户端。浏览器开发入口使用同一 React 工作台和领域服务；Electron 原生接口位于窄宿主适配，不将一套演示数据实现扩成第二套业务逻辑。具体能力差异按真实接入处理。

[#14 工程纪律](../issues/14-agent-development-discipline.md)已选 Orca 用于日常 UI 调试、框架用于重复 e2e，并允许确定性测试在外部模型边界使用受控响应。领域执行、文件和数据库接线实际运行；真实模型效果由 #21 验收。

已有 [Orca 探针](orca-ui-and-researchspec-dogfooding.md)只证明当时简单页面的 snapshot、点击和 console，截图空白仍未解决。本轮没有重新运行工具，不把旧探针或文档能力升级为真实应用接线证据。

## 待验证项

固定 Playwright／Electron 组合的启动；同页浏览器与 Electron 接入；异步状态和断线重连观察；实际 preload／原生调用；窗口关闭后的内核继续工作；日志和失败诊断；独立数据／端口／进程清理；最终分发构建的启动与 OS 交互。工具最小探针只验证这些工具和宿主接入条件，业务 e2e 随实际领域链路形成后建立。
