# 真实报告源到双宿主 DOM 的机械验证

在仓库根目录运行：

```sh
node tests/fixtures/report-program/run.mjs
```

要求已有 Node 24、项目依赖与桌面构建产物、Playwright Chromium、Electron，以及可用的 DISPLAY `:99`。端口固定为 `6317`，占用即失败，不复用其他运行。运行器直接调用 Node、esbuild 与 tsc，不安装依赖。

复用 `report-dom/build.mjs` 和 `entry.tsx`，加载真实 Workbench 与生产 DOM receiver；没有复制入口或业务页。静态服务使用已有 `~/.cache/scholoom-round13-acceptance/preserved-tmp/static-ui.mjs`。每轮配置、Electron profile、构建原包和证据保存在 `~/.cache/scholoom-report-dom/program-*`，失败不覆盖前轮。

每个宿主启动自己的普通 Node 子进程，运行 `source-driver.mjs` 的真实 program factory。合成入口含 100 个对象、MathML、原生 input/button、classic、外部原生 ESM 及其相对依赖、inline module。输出按行进入有界串行队列；仅在 `reportDOMProbe.apply()` 成功后发送对应 consume。记录实际帧、消费回执、命令、native 事件、inputConfirmed、桥消息、stderr 和首败。

每个宿主以`restorePending:true`启动，在初始帧之后发送原restore，检查ready时textarea已取得指定原草稿；再检查三处 JS 结果、100 个 article 和 MathML 结构，进行一次真实原生输入并回传 input 命令，核对确认 checkpoint、实际结果和输入节点身份／选区／焦点，再从真实点击回传 select 桥消息。桥只由测试观察，不调用 Agent。

当前源样本还包含真实head样式和classic中的`style.backgroundColor`赋值，检查两者在原生DOM中实际生效。`style-source-check.mjs`独立比较CSS声明的quoted分隔、重要性、custom property大小写、Element属性互通及容量；不执行报告脚本或OS服务，不代表完整CSSOM。源builder共用editor的`report/build-options.mjs`，固定css-tree官方自包含ESM及必要许可，运行时不从P视图读取包元数据。

样本另含有初始文本的textarea；双宿主核真实多行输入、原source确认及结果，再移出编辑焦点后恢复CRLF草稿，核实际值统一为LF且控件身份不变。恢复不覆盖正在聚焦编辑的值。source adapter的defaultValue／dirty值／换行及textLength另由`tests/kernel/report-textarea.spec.ts`对照独立Chromium；不据此承诺完整表单API。

材料文件及身份／权限端口是明确替身，source 是普通子进程；本夹具不验证 OS 隔离、恶意脚本、模型、生产控制服务或完整 I5。独立 `output-check.mts` 的六组输出验证保持原有预期。

`node tests/fixtures/report-program/events-check.mjs` 将同一组固定合成事件分别交共享WorkerDOM和独立Chromium，比较阶段／顺序、重复注册、once、分派中增删、propagation、passive与on属性，并从公开订阅tuple核原add/remove身份。证据位于`~/.cache/scholoom-report-events/run-*`，不运行报告脚本或OS服务。原生输入适配的独立良性脚本代表由`native-events-check.mjs`运行，每例新鲜普通Node进程，沿公开start／consume／input及确认契约核取消边界；它不是实际浏览器默认动作或隔离证明。
