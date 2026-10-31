# 异步原生输入适配验证

本夹具验证已接受的行为边界：报告脚本可接收原生输入并异步更新页面；对原生可取消事件调用 `preventDefault()` 时，报告显式失败，即使脚本捕获异常也不能继续提交呈现或桥动作。浏览器已经执行的默认动作不伪装成被取消。旧 `report-worker-dom` 的同步取消反例及失败断言保留。

源进程复用 `report-worker-dom/vendor` 固定 WorkerDOM 源码和原许可，不复制上游。宿主包不导入报告样本；真实 mutation、事件及确认经原私有 IPC 和回环测试通道往返，在真实 Workbench 资源 tab 的无脚本 frame 呈现。领域授权和资源身份是合成替身，这里没有生产报告服务或恶意代码隔离。

已有共享包、desktop 产物、Electron、静态 UI harness 和 DISPLAY :99 就绪且端口 6309 空闲后，使用现有工具运行：

```sh
node tests/fixtures/report-async-dom/run.mjs 'baseline|unsupported'
node tests/fixtures/report-async-dom/run.mjs 'HTML ingestion'
node tests/fixtures/report-async-dom/run.mjs 'race'
node tests/fixtures/report-async-dom/run.mjs 'native click cancellation'
node tests/fixtures/report-async-dom/run-html-ingestion.mjs
```

每次在 `/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom/run-*/` 新建独立结果，保存命令、私有构建、类型、信用耗尽检查及双宿主运行证据，不安装依赖或启动开发服务器。根 typecheck 单独检查本夹具的 TypeScript 项目，沿用固定上游的编译选项。测试复用 DISPLAY，不关闭用户显示服务。

原生输入、焦点／选区保持、两种布局、HTML 字符串与显式 namespace MathML、筛选／排序／展开、CDP composition 及迟到确认／替换／关闭有各自有界代表。HTML 摄取路径同时核对分数上下布局及 MathMLFraction 辅助语义；CDP composition 不等同于系统 IME，文本／控件可查询不等同于读屏验收。信用耗尽只证明发送后的窗口有界，尚未证明上游字符串／节点／mutation 聚合在分配前纳入共同内存预算。

固定 fork 的 parser 依据实际父节点及整合点选择 HTML／SVG／MathML namespace，支持数学片段与嵌套内容，解析时规范 HTML／MathML 属性名。`run-html-ingestion.mjs` 核原 HTML 数学／输入样本，并将七组实际源端子树与独立 Chromium 原生解析对照；它不启动工作台或内核，原失败证据保留。真实宿主输入由上面的 `HTML ingestion` 双宿主场景另验，不由源端通过推导。

`build.mjs <cache中的built目录>` 也生成 `string-budget.mjs`，可直接用 Node 执行；`run.mjs` 在启动 UI 前自动运行它。八组实际字符串表检查覆盖 UTF-8 多字节／代理对／孤代理、1024项与64KiB累计边界、跨 consume 保留容量及去重。原 store 在检查前分配完整编码副本的问题已改为无分配扫描；这里的64KiB约束属于页面字符串表，模型请求使用其既有 token 预算。这项检查不能替代总堆内存、其他 DOM 扩容路径或 OS 隔离保证。

真实生产隔离、C/M 服务、系统 IME／读屏、完整报告更新恢复及 I5 未通过，本目录的成功不关闭这些任务。当前验证摘要、首败和逐次收尾见同一 cache 的 `validation-summary.json` 及 `followup-native-cancel.json`，不相加为一次全套通过。
