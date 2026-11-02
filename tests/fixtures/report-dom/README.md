# 生产 ReportDOM 双宿主行为夹具

在仓库根目录运行：

```sh
node tests/fixtures/report-dom/run.mjs
```

Runner 预检 `DISPLAY=:99` 与空闲端口 `6313`，独立 build、类型检查，再并行运行两类行为，分别驱动 Chromium 与真实 Electron。可附加 Playwright 参数，例如 `--project=ui-browser` 或 `--grep hostile`。不安装依赖；需要当前已安装 Electron 和已有静态工作台构建。静态服务复用 `/home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/static-ui.mjs`，不启动开发服务器，不重建共享生产产物、完整 vendor，也不执行网络 provenance。

单独验证容量代表：`SCHOOLOOM_REPORT_DOM_ATTACK=utf8-frame-budget node tests/fixtures/report-dom/run.mjs --grep hostile`。该静态帧的单字符串与累计 UTF-16 单元均低于 64KiB，但真实 JSON UTF-8 字节超过 64KiB；仍须整帧拒绝且保持原 DOM/sequence。

参数可用逗号连接，例如 `SCHOOLOOM_REPORT_DOM_ATTACK=fragment-url,work-units`。`fragment-url` 拒绝可能继承宿主 base 的片段链接；`work-units` 先合法装入 1000 个平级节点，再提交 1024 次同节点移动（实际帧字节低于 64KiB），要求以 `resourceLimit` 在 DOM 写入前拒绝。该有界代表不替代独审的 16k 节点性能复现。

仅新增本目录文件。输出、TMPDIR、内核配置、浏览器/Electron profile、源文件取证副本、构建 metafile、命令日志及 Playwright 结果均进入 `~/.cache/scholoom-report-dom/run-*`。保留 `first-failure.json`、`evidence.json`、失败 trace 和截图，不自动重试；生产 TS 并发更新时，每轮独立 bundle，以该轮构建副本为复现依据。

`entry.tsx` 使用真实 Workbench 外壳及当前 `packages/editor/src/report-dom.ts`，append 后 await ready，经 `tests/ui/fixture.ts` 运行双宿主。测试程序直接提交静态 WorkerDOM wire 帧：节点五元组、累积字符串索引、child-list/attribute/character-data/property/event-subscription mutations；不运行报告脚本，不依赖上游节点分配器或 512 节点限制。

- 正向：文本更新、原生表格及 HTML input、可信 native input 事件和选择区、MathML mfrac 排版及 `MathMLFraction` AX role、静态 SVG；100 对象、1000 个 wire 节点分十帧追加，再批量移位 20 个既有节点，核对顺序与既有 DOM 对象、焦点及输入选区保持。
- 拒绝：参数表位于 `frames.ts::attacks`，每例重置接收器，先排入合法文本变更再附加非法后半。检查结构化错误码、零 DOM mutation、原节点与原生输入保持，随后同 sequence 合法帧证明序号及字符串容量未推进。记录首个失败的完整 candidate；监听子 frame 与外网请求，外网路由另行阻断并保留尝试证据。

预期来自当前有限安全契约：body 内有限 HTML/MathML/静态 SVG，整帧预检后才修改，脚本/外部请求为零，CSS 和资源 URL 拒绝。错误检查不绑定完整文案或 HTML snapshot。生产缺陷交回主线修复，不改生产、不放宽断言。

上述基础结构组不验收 OS 隔离、真实报告 JS、系统 IME/屏幕阅读器、CSS/资源接线或完整 HTML，也不代表完整 I5。正式产品接线、跨平台分发、21/27 不在范围内。

`node tests/fixtures/report-dom/run.mjs --grep 'styles use|styles reject'` 单独核样式与资源Module：首帧有限html/head身份、惰性源style/link、冻结CSS导入基址、私有样式缓存更新／重排／删除、真实PNG解码及img呈现。非法URL、转义资源函数、image-set env替换、refresh、核心根变更和重复roots在整帧写入前拒绝，合法前半不泄漏且同sequence后续可用。材料字节与权限仍是固定替身，不运行源报告JS；不把本组通过作为OS／产品ReportView或I5通过。图像与字体尺寸／体积及Blob生命周期另见`tests/kernel/report-style-assets.spec.ts`。

`node tests/fixtures/report-dom/run.mjs --grep 'frozen JPEG and KaTeX font'`补真实JPEG／字体解码代表：独立编码的1×1 JPEG和已安装KaTeX许可内的WOFF2经生产`createReportStyleAssets`／`createReportPresentation`进入双宿主，核原冻结Blob字节、`image.decode()`及`FontFace.loaded`成功。批准后源buffer置零仍不改变冻结副本；本地Blob读取单列，网络请求保持零。资源／权限及程序输出是固定替身，不运行报告JS或系统服务，不代替通用P或完整I5。

`node tests/fixtures/report-dom/run.mjs --grep 'presentation|owned DOM'` 另核生产`createReportPresentation`：发送成功与实际源确认分开，旧revision及错代不释放新输入，组合结束后才消费等待帧，超四帧／源错误明确失败且保留原生文字；重复祖先订阅只转发真实target一次，退订与关闭后迟到动作失效。源端send／receipt、权限及文件仍是替身，输入和click经原生控件；composition使用合成事件，多选由Playwright设置真实选择并发合成input/change，不算系统IME或真实source dispatch。当前selection-set契约不完整，多选输入显式unavailable并保留完整原选择。另有form命名属性遮蔽DOM方法的代表，检查可信原型调用仍可修改、订阅及收尾。
