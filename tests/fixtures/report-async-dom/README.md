# 异步原生输入适配验证

本夹具验证已接受的行为边界：报告脚本可接收原生输入并异步更新页面；对原生可取消事件调用 `preventDefault()` 时，报告显式失败，即使脚本捕获异常也不能继续提交呈现或桥动作。浏览器已经执行的默认动作不伪装成被取消。旧 `report-worker-dom` 的同步取消反例及失败断言保留。

源进程经受控适配复用 `packages/editor/vendor/worker-dom` 固定 WorkerDOM 共享源码和原许可；同根的 `upstream-manifest.json`、`local.patch` 与 `MODIFICATIONS.md` 保存来源及本地改动，不复制上游。宿主包不导入报告样本；真实 mutation、事件及确认经原私有 IPC 和回环测试通道往返，在真实 Workbench 资源 tab 的无脚本 frame 呈现。领域授权和资源身份是合成替身，这里没有生产报告服务或恶意代码隔离。

已有共享包、desktop 产物、Electron、静态 UI harness 和 DISPLAY :99 就绪且端口 6309 空闲后，使用现有工具运行：

```sh
node tests/fixtures/report-async-dom/run.mjs 'baseline|unsupported'
node tests/fixtures/report-async-dom/run.mjs 'HTML ingestion'
node tests/fixtures/report-async-dom/run.mjs 'race'
node tests/fixtures/report-async-dom/run.mjs 'native click cancellation'
node tests/fixtures/report-async-dom/run.mjs 'frame preflight rejects'
node tests/fixtures/report-async-dom/run-html-ingestion.mjs
```

每次在 `/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom/run-*/` 新建独立结果，保存命令、私有构建、类型、信用耗尽检查及双宿主运行证据，不安装依赖或启动开发服务器。根 typecheck 单独检查本夹具的 TypeScript 项目，沿用固定上游的编译选项。测试复用 DISPLAY，不关闭用户显示服务。

原生输入、焦点／选区保持、两种布局、HTML 字符串与显式 namespace MathML、筛选／排序／展开、CDP composition 及迟到确认／替换／关闭有各自有界代表。HTML 摄取路径同时核对分数上下布局及 MathMLFraction 辅助语义；CDP composition 不等同于系统 IME，文本／控件可查询不等同于读屏验收。信用耗尽只证明发送后的窗口有界，尚未证明上游字符串／节点／mutation 聚合在分配前纳入共同内存预算。

固定 fork 的 parser 依据实际父节点及整合点选择 HTML／SVG／MathML namespace，支持数学片段与嵌套内容，解析时规范 HTML／MathML 属性名。`run-html-ingestion.mjs` 核原 HTML 数学／输入样本，并将十组实际源端子树与独立 Chromium 原生解析对照：原七组 namespace 代表加上布尔／空值／实体属性、SCRIPT／STYLE／NOSCRIPT raw text、TEXTAREA／TITLE RCDATA 与 PRE／CODE 结构。属性只读取 fixture 的 `attributeNames` 指定名称；属性组另以固定 `propertyNames` 比较 checked／defaultChecked／disabled／selected／defaultSelected／value／selectedIndex／type，元素没有该 property 时记录 null，含空值 placeholder 的单选 select。checkbox 与独立 option 另比同值赋值后移除默认属性、显式置 false 后移除／恢复默认属性的实际状态，不扩 radio 分组、reset 或 optgroup。raw text／RCDATA 核真实文本与节点结构，包含大小写混合及尾空白结束标签；不使用完整 HTML snapshot。runner 从本地原始缓存离线核 provenance，缓存缺项时读取旧 vendor 的本地 Git 原件，统一由固定 manifest 哈希核验；Chromium context 禁止联网，不启动工作台、UI 服务或内核，原失败证据保留，新增首败保存于该次 cache 的 `first-failure.json`。这些代表不表示完整 HTML／表单兼容；真实宿主输入由上面的 `HTML ingestion` 双宿主场景另验，不由源端通过推导。

`build.mjs <cache中的built目录>` 也生成 `string-budget.mjs`，可直接用 Node 执行；`run.mjs` 在启动 UI 前自动运行它。worker-thread 的节点／字符串表以 `@scholoom/protocol/reports` 的 `reportRenderLimits` 为唯一限值来源：16384 个节点（含 Document/body 实际身份）、16384 项字符串、2MiB 累计 UTF-8 字节，索引保持在 U16 范围内。八组独立子进程检查按共同限值构造输入，覆盖无 TextEncoder 编码、UTF-8 多字节／代理对／孤代理、字节及条目边界、跨 consume 保留容量及去重；同一自检还创建真实 Document/body 和节点，核对节点上限、跨 consume 累计及超限拒绝不登记。字符串准入使用无编码副本分配的扫描，模型请求仍使用其既有 token 预算。这项检查不能替代完整源端／宿主预算、总堆内存、其他 DOM 扩容路径或 OS 隔离保证。

同一构建另生成`frame-budget-check.mjs`，runner在UI前核帧字节／累计预算。source在复制数组和排包前预检，receiver在提交计数或修改DOM前核完整帧、累计字符串及节点身份；重复ID拒绝不消费ACK。`frame-budget.mts` 保留较小的 synthetic probe wire 预检额度，独立于上述共同 registry 限值；UTF-8／JSON转义计量不先创建完整编码副本。该检查只覆盖mutation帧，HTTP整个state／receipt回复仍待共同信封契约及有界读取接入，不把四帧信用当作完整回复或总堆上限。

真实生产隔离、C/M 服务、系统 IME／读屏、完整报告更新恢复及 I5 未通过，本目录的成功不关闭这些任务。当前验证摘要、首败和逐次收尾见同一 cache 的 `validation-summary.json` 及 `followup-native-cancel.json`，不相加为一次全套通过。
