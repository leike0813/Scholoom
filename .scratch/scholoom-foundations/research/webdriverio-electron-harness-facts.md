# WebdriverIO Electron 测试支撑：事实核对

核对日期：2026-10-04。关联 [#20](../issues/20-ui-debugging-and-e2e-harness.md)。子代理先收集官方检索入口，主 Agent 随后打开正文核对；以下以正文为准。未安装、启动服务或运行测试，具体版本组合尚未验证。

## 当前接口与维护入口

- 当前包名为 `@wdio/electron-service`，源码与文档位于 `webdriverio/desktop-mobile`。WebdriverIO service 页仍称它为 third-party package；仓库归属与文档标签分别记录，不由包名前缀推断官方支持保证。[service 文档](https://webdriver.io/docs/wdio-electron-service/)、[源码入口](https://github.com/webdriverio/desktop-mobile/tree/main/packages/electron-service)
- 同时支持打包 binary 和未打包开发入口：`appBinaryPath` 指定程序，`appEntryPoint` 指定 main.js，可传 `appArgs`。文档还提供 renderer browser mode。未打包开发入口并非工具能力缺口。[配置正文](https://webdriver.io/docs/desktop-testing/electron/configuration/)、[browser mode 入口](https://webdriver.io/docs/wdio-electron-service/)
- 文档列自动配置 Electron 26 及以上所需 ChromeDriver，较早版本手动配置；实际下载、离线资源和当前 Electron 版本匹配未测。[ChromeDriver 配置](https://webdriver.io/docs/wdio-electron-service/#chromedriver-configuration)
- 主进程执行与 Electron API mock 有现成接口；dialog mock 替换 JavaScript 方法返回值，不验证真实 OS 对话框操作。未 mock 的 OS 交互需要另行验收。[Electron API](https://webdriver.io/docs/desktop-testing/electron/api/)、[mocking](https://webdriver.io/docs/desktop-testing/electron/mocking/)
- 配置正文提供 main／renderer 日志采集。main 采集依赖 CDP 和 `EnableNodeCliInspectArguments` fuse；renderer 采集不依赖该 main bridge。Node 内核与兼容宿主日志仍需应用测试 fixture 接线。[日志配置](https://webdriver.io/docs/desktop-testing/electron/configuration/)
- 文档提供三平台 binary 路径和窗口管理入口；这些是接口支持信息，不证明 Scholoom 的窗口、进程与产物已经跑通。[路径配置](https://webdriver.io/docs/desktop-testing/electron/configuration/)、[窗口管理](https://webdriver.io/docs/desktop-testing/electron/window-management/)
- 独立 entrypoint 在 Windows／Linux 的 OS 协议处理测试有边界，相关 deeplink 验证需要注册过的 binary。这不影响普通未打包界面测试。[配置说明](https://webdriver.io/docs/desktop-testing/electron/configuration/#appentrypoint)
- desktop-mobile 根 LICENSE 为 MIT；实际选定 package、插件和版本另保留其声明。[LICENSE 正文](https://raw.githubusercontent.com/webdriverio/desktop-mobile/main/LICENSE)

## 方案比较的边界

WebdriverIO 是可用候选，具备开发／打包入口、Electron API 和日志能力；不能依据检索摘要漏掉 `appEntryPoint` 而排除它。Playwright 提供浏览器／Electron 的页面 API 和 trace，但 Electron 支持标为 experimental，详见 [Playwright 事实](playwright-electron-harness-facts.md)。

选哪一套作为主要维护框架由本票讨论决定。任何选择都需用固定版本与本项目启动方式做最小探针，随后用真实领域接线维护 e2e。Node 独立内核生命周期、数据隔离、OS 交互和最终分发配置不能由 framework 能力单独证明。
