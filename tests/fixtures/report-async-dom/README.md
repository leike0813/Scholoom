# 异步原生输入适配验证

本夹具验证已接受的行为边界：报告脚本可接收原生输入并异步更新页面；对原生可取消事件调用 `preventDefault()` 时，报告显式失败，即使脚本捕获异常也不能继续提交呈现或桥动作。浏览器已经执行的默认动作不伪装成被取消。旧 `report-worker-dom` 的同步取消反例及失败断言保留。

源进程复用 `report-worker-dom/vendor` 固定 WorkerDOM 源码和原许可，不复制上游。宿主包不导入报告样本；真实 mutation、事件及确认经原私有 IPC 和回环测试通道往返，在真实 Workbench 资源 tab 的无脚本 frame 呈现。领域授权和资源身份是合成替身，这里没有生产报告服务或恶意代码隔离。

已有共享包、desktop 产物、Electron、静态 UI harness 和 DISPLAY :99 就绪且端口 6309 空闲后，使用现有工具运行：

```sh
node tests/fixtures/report-async-dom/run.mjs 'baseline|unsupported'
node tests/fixtures/report-async-dom/run.mjs 'race'
node tests/fixtures/report-async-dom/run.mjs 'native click cancellation'
node tests/fixtures/report-async-dom/run-html-ingestion.mjs
```

每次在 `/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom/run-*/` 新建独立结果，保存命令、私有构建、类型、信用耗尽检查及双宿主运行证据，不安装依赖或启动开发服务器。根 typecheck 单独检查本夹具的 TypeScript 项目，沿用固定上游的编译选项。测试复用 DISPLAY，不关闭用户显示服务。

原生输入、焦点／选区保持、两种布局、显式 namespace MathML、筛选／排序／展开、CDP composition 及迟到确认／替换／关闭有各自有界代表；CDP composition 不等同于系统 IME，文本／控件可查询不等同于读屏验收。信用耗尽只证明发送后的窗口有界，尚未证明上游字符串／节点／mutation 聚合在分配前纳入共同内存预算。

HTML 字符串自检目前明确失败：固定 parser 只切换 SVG namespace，普通 MathML 的 math／mfrac／mi／mn 均错误成为 XHTML 节点。`run-html-ingestion.mjs` 保留 exit1 和原 source 证据，不启动 UI；input 的源端解析正确尚不代表宿主原生编辑通过。该反例不改为预期成功，也不由 programmatic DOM 成功推导字符串支持。逐次证据见 `followup-html-ingestion.json`。

真实生产隔离、C/M 服务、系统 IME／读屏、完整报告更新恢复及 I5 未通过，本目录的成功不关闭这些任务。当前验证摘要、首败和逐次收尾见同一 cache 的 `validation-summary.json` 及 `followup-native-cancel.json`，不相加为一次全套通过。
