# R2可信呈现／输入调查夹具

这是一次可丢弃的呈现接缝调查，不是生产报告页。固定可信文献页在独立Chromium进程执行，控制器通过真实页面控件完成筛选／排序／展开，再读取当前DOM。工作台只显示3行以内的固定字段，未加载该页脚本、HTML或样式。没有通用DOM镜像、公共DSL或画面流。

`entry.tsx`复用真实Workbench、TabGroups和`session.renderResource`。合成session／ResourceTarget、HTTP控制器和数据是夹具替身；没有KernelClient、ReportResources授权或报告provider接线。源页复用已接收report-context固定样本的前三行，但不调用其选择／草稿消费者，不重复2.2c。控制器只在测试进程持有Playwright页面；该接口不是安全服务，不能交给不可信脚本。此实验没有独立身份、OS隔离或生产容量／停止保证。

## 一条命令复现双宿主调查

从本树根运行，目录须为本次新建cache，6183端口空闲；已有产品构建、Chromium和Electron需可用。入口先检查显示，再构建夹具、检查其类型、运行双宿主。不会启动开发服务器或安装依赖。

```bash
export TMPDIR="$(mktemp -d "$HOME/.cache/scholoom-r2-XXXXXX")"
export DISPLAY=:99
export SCHOOLOOM_UI_PORT=6183
node tests/fixtures/report-surface/run.mjs "$TMPDIR/run"
```

静态产品承载复用`/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs`及同根`preserved-tmp/static-ui.mjs`。配置／内核／profile及结果都在本次cache；不依赖当前/tmp。每次运行使用新目录，先build后test且测试期间不重建。同源Workbench在夹具构建中重新bundle；产品main/preload与内核复用共同HEAD的既有产物，不声称重建。

## 手动操作同一最小原型

复用刚生成的`run/built`，先设置已安装Electron路径，然后任选宿主；此入口直接承载固定夹具，不运行产品内核。窗口关闭、SIGINT／SIGTERM或180秒调查期限会收尾所拥有的浏览器和HTTP端点。

```bash
export ELECTRON_OVERRIDE_DIST_PATH="$PWD/node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
node tests/fixtures/report-surface/open.mjs "$TMPDIR/run/built" "$TMPDIR/manual-browser" browser
node tests/fixtures/report-surface/open.mjs "$TMPDIR/run/built" "$TMPDIR/manual-electron" electron
```

本轮在指定的较长cache根运行手动Browser入口，Chromium实际因`SingletonSocket`路径超过Unix socket长度而退出，原stderr保留；没有为此改sandbox标志或借用/tmp。自动Browser的既有headless承载不受此失败影响。Electron手动入口已实际打开并经SIGTERM收尾；信号会使Playwright关闭源页，末次读取不可得时明确记录`unavailableAfterClose`，不编造最终正文。迁移到另一个经授权的短cache根后才能复验有窗口Browser，不将当前失败写成已支持。

筛选“随机”，按年份降序，键盘展开“赵2023”的详情；可拖选／双击正文后复制，在“查找可见正文”输入一个词并回车，也可用Tab／Shift+Tab切换表单。只有这些控件通过测试控制器驱动源页。终端打印的是固定源码入口URL；另开该URL会创建新的页面实例，不能当控制器实际实例或同步证据。`window.reportSurface.read()`只观察最后实际收到的快照。独立页自主计时更新、跨tab恢复、连续高频输入及取消组合输入不在此片验证范围。

## 如何读结果

`results/*/r2-evidence.json`保留执行页与投影页的实际文本、状态、辅助树、复制和组合输入观察；`source.png`／`projection.png`对应同次真实页面。最多40条动作记录、每树200个非ignored辅助节点，不持续累积日志。`owned-controller-closed.json`读回浏览器连接及服务监听均为false；原宿主和自有内核另沿现成UI fixture／teardown收尾。

调查用例通过只表示观测可重复。固定反例为源页原生MathML分数`1/2`，本候选读取textContent后实际显示`12`，`MathMLFraction`辅助结构丢失。因此本投影没有满足完整报告呈现要求。测试观察到普通正文可见选区及真实Control+C／剪贴板、夹具可见正文查找、键盘／焦点和CDP组合输入；CDP不是系统IME，辅助树不是读屏器。查找只限当前投影正文，不支持宿主Ctrl+F或全文搜索。不得以2/2观测用例关闭R2完整体验、T1／T2／2.1b／I5或跨平台支持。

本轮证据入口：`/home/joshua/.cache/scholoom-round18-acceptance-tkEm2H/next/research-interaction/RESULT.md`。方案与具体缺口交主线决定；此夹具保留为调查依据，不进入生产依赖。
