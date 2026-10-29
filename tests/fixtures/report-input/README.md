# R2c固定可信输入事务原型

本原型回答R2b的特定问题：已有真实源回包到达时，能否保住正在组合或尚未确认的文字，再把提交／取消后的实际值交独立源页确认？不是正式报告承载、通用DOM镜像、资源授权或OS隔离。

`controller.ts`只读复用原report-structure控制器；两个固定合成view各有自己的真实源页及代次，未创建第二份文献状态。源页沿原report-surface源码处理筛选／排序／展开。`transaction.ts`每view只有一次在途请求、一个最新输入意图和一个最新回包候选，输入最长128 UTF-16单元，最多128个意图；诊断最多40条并记录丢弃数。请求代次独立于当前显示代次，关闭／换版本后不采用迟到结果，也不发送原缓冲意图。

首次用实际源文档建立禁脚本frame，后续只在源确认且值相容时原生importNode替换本固定模板的table／count。输入节点和活动文档始终不换，不给筛选框赋值、不禁用输入，不用计时等待或自动重试。原文MathML结构继续保留；其他文档结构、自主脚本更新、任意HTML／CSS／canvas并不受支持。order／toggle只在没有输入事务时受理，冲突恢复已确认排序并显示反馈，不覆盖未确认文字。

## 重建与自动校准

从本树cwd运行，要求已有产品产物、Chromium／Electron、可用DISPLAY及空闲端口；不安装依赖、不启动开发服务器。

```bash
RESULT_ROOT="$(mktemp -d "$HOME/.cache/scholoom-r2c-result-XXXXXX")"
export DISPLAY=:99
export SCHOOLOOM_UI_PORT=6203
node tests/fixtures/report-input/run.mjs "$RESULT_ROOT"
```

入口先xdpyinfo，再构建夹具／检查类型，最后冻结产物跑两条场景的双宿主组合。静态承载复用`/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs`及同根`preserved-tmp/static-ui.mjs`，产品main／preload／kernel复用已验产物，Workbench从当前源码bundle。配置／结果／字节产物在RESULT_ROOT；为Unix socket创建的短`~/.cache/r2c-*`由short-tmpdir.txt记录，无/tmp前置。

两条测试分别覆盖：真实旧回包期间的最新普通输入、组合、提交及清除组合后的源确认；版本／接收者替换和关闭时的迟到结果及缓冲输入丢弃。只延迟真实回包，不替换源请求、状态或正文。数学／文字／复制／可见查找／AX只留一个代表，未重跑旧R2／R2b矩阵。共享UI fixture按每用例输出目录隔离并核对Electron真实profile，不增加默认profile或sandbox参数。

## 手动入口

复用本次构建，任选宿主；直接运行固定夹具，不启动内核或模型。Electron沿同一`--user-data-dir`方式隔离，并记录实际userData／sessionData／storagePath。

```bash
export TMPDIR="$(cat "$RESULT_ROOT/short-tmpdir.txt")"
export ELECTRON_OVERRIDE_DIST_PATH="$PWD/node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
node tests/fixtures/report-input/open.mjs "$RESULT_ROOT/built" "$RESULT_ROOT/manual-browser" browser
node tests/fixtures/report-input/open.mjs "$RESULT_ROOT/built" "$RESULT_ROOT/manual-electron" electron
```

源页表单可筛选／排序／展开；可原生选择并复制正文，通过父工具栏查找可见文字。控制按钮分别替换固定版本／合成接收者、关闭输入视图；没有回到旧实例的动作。窗口关闭、SIGINT／SIGTERM或180秒手动调查期限后收尾自有浏览器／服务。自动场景的透明回包门控用于稳定复现竞争；手动入口没有sleep或人工模拟状态。

`window.reportInput.read()`只观察两个固定事务及有界诊断，不提供操作／发送工具。源、UI、回包与生命周期证据在input-evidence.json，截图在同次结果目录；closed.json逐个记录源控制器及新服务关闭读回。

## 结论边界

本轮所测固定页面的普通输入／CDP组合提交和清除在真实源确认后正确采用，未提交期间文档、输入节点、值和焦点保持，所测光标位置不变；旧生命周期结果不复活。CDP清除组合的实际DOM值为空，测试明确把该实际值送源确认，未将其猜成系统IME的Escape／候选取消行为。

真实部分是源Chromium、原页执行／DOM、Workbench共同tab、原生表单／MathML、文字选择／clipboard、浏览器composition事件及AX。合成view／basis／接收者、HTTP控制器及资源入口是替身，不接ReportResources、真实composer发送、provider、身份服务或生产准入／停止权威。系统IME候选窗、真实读屏、完整文字范围／跨控件并发、reload／跨tab恢复、页面自主变化及Windows／macOS／科研质量未验。传输失败保留活动输入并停止推进，不自动重发；失败恢复UX不在本片。旧R2和R2b反例保持，不据本片关闭正式R2／2.1b／T1／T2／I5。

本轮完整命令、首次格式问题、独审修正和各版本验证范围见`/home/joshua/.cache/scholoom-round20-acceptance-INWZnx/next/research-interaction/RESULT.md`。这些代码保留为可信调查夹具，不进入生产依赖。
