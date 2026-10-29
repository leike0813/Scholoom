# R2b固定可信原结构对照

调查问题：保留独立执行页的真实HTML／MathML结构，能否补回上一候选丢失的分数布局、辅助语义，同时保留文本和输入？这是可丢弃的调查夹具，不是生产报告、sanitizer、通用DOM镜像或隔离服务。

`build.ts`只读编译原`report-surface/source.ts`并复制原source.html。`controller.ts`复用其实际独立Chromium控制器，操作真实表单／details，再同步取得当前状态及DOM克隆；补齐HTML序列化不会保存的input.value／option.selected，保留MathML命名空间，去掉固定源码唯一脚本。文档最多256元素／64KiB，动作最多128代、一次在途、无动作等待队列，观察最多40条。该逻辑只接受本固定可信源码，不得接任意报告。

`entry.tsx`在真实Workbench的`renderResource`共同tab中，用无allow-scripts的独立frame展示srcdoc。frame的CSP禁脚本及资源加载；allow-same-origin仅供可信父夹具转发固定控件事件和恢复焦点，不证明恶意报告安全。源脚本与样式不进入父文档，frame中也没有源运行时。没有生产CSP／HtmlRenderView／sandbox策略修改或共享fixture登记。合成session／ResourceTarget与HTTP测试控制器是明确替身，没有ReportResources授权、provider、模型或生产容量权威。

## 可重建入口

从本树cwd执行，要求本树已有产品产物、现成Chromium／Electron、可用DISPLAY和空闲端口。入口先预检显示，再构建夹具、检查类型、冻结产物并跑双宿主。不会安装依赖或启动开发服务器。

```bash
RESULT_ROOT="$(mktemp -d "$HOME/.cache/scholoom-r2b-result-XXXXXX")"
export SCHOOLOOM_UI_PORT=6193
export DISPLAY=:99
node tests/fixtures/report-structure/run.mjs "$RESULT_ROOT"
```

运行器创建并记录短`~/.cache/r2b-*`作为TMPDIR，避免有窗口Chromium的Unix socket路径过长；结果／profile／构建仍归RESULT_ROOT。不依赖/tmp。静态产品承载沿`/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs`及同根`preserved-tmp/static-ui.mjs`。产品main／preload／kernel复用已验产物，Workbench随夹具从当前源码bundle；不能把此构建说成产品重建。

手动打开同一原型（不启动内核），窗口关闭、SIGINT／SIGTERM或180秒调查期限后收尾自有进程／服务：

```bash
export TMPDIR="$(cat "$RESULT_ROOT/short-tmpdir.txt")"
export ELECTRON_OVERRIDE_DIST_PATH="$PWD/node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
node tests/fixtures/report-structure/open.mjs "$RESULT_ROOT/built" "$RESULT_ROOT/manual-browser" browser
node tests/fixtures/report-structure/open.mjs "$RESULT_ROOT/built" "$RESULT_ROOT/manual-electron" electron
```

筛选“随机”、按年份降序并用键盘展开赵2023；检查分数上下布局、原生表格和详情语义，可双击正文后Control+C。父工具栏“查找可见正文”只查当前真实可见文本；隐藏详情不命中。Tab／Shift+Tab操作frame表单；无在途回包时组合输入提交后再交源页。`window.reportStructure.read()`只观察最后收到的真实快照及错误，不修改状态。

## 本轮观察与未满足项

本轮Browser／真实Electron均保留HTML／MathML namespace与mfrac；分子在分母上方，原文表格innerText与源页相同，源／frame辅助树均有MathMLFraction。普通筛选／排序／展开、文字选择／真实剪贴板、可见正文查找、顺序键盘／焦点及CDP组合提交可对应。晚回包不能抢走用户已移到父查找框的焦点。

**候选仍失败于在途组合：** 先发一个真实筛选请求，测试仅暂缓其真实回包；在旧frame组合“队列”，放行回包后整份srcdoc替换，未提交文字实际变成空串。两宿主均重现。测试绿色包含对这一失败的观察，不表示候选输入保持通过。没有扩大为增量DOM镜像、冻结输入或重试来掩盖它；正式接缝仍需主线解决活动文档／组合事务／选区稳定性。

`structure.spec.ts`记录实际源／frame状态、文本、namespace、布局坐标、辅助树、截图、复制及输入结果。门控只延迟真实响应，不替换源执行／正文；旧代／并发动作另实际拒绝。系统IME候选窗／取消和真实读屏未验，CDP／AX不能替代；数学复制语义、源页自主更新、高频输入、canvas／任意HTML、跨tab恢复、资源授权、OS强隔离及Windows／macOS均未验。原report-surface数学语义失败夹具与断言保持不变，不能据本片关闭R2正式架构／2.1b／T1／T2／I5。

本轮证据与首次失败：`/home/joshua/.cache/scholoom-round19-acceptance-XBzzNC/next/research-interaction/RESULT.md`。`closed.json`实际读回源浏览器连接、源服务和呈现服务监听均false；产品测试宿主／内核另沿原fixture收尾，这些不是生产完整停止或容量证明。
