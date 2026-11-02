# 已安装通用报告的产品验收

在固定Node/data校准及独立通用报告包安装通过后，从仓库根运行：

```sh
node tests/fixtures/report-product/run.mjs /opt/scholoom-report-<installation>/installed.json
node tests/fixtures/report-product/run.mjs /opt/scholoom-report-<installation>/installed.json selection
node tests/fixtures/report-product/run.mjs /opt/scholoom-report-<installation>/installed.json lifecycle
```

入口使用生产`loadReportInstallation`核对root保护、正式程序登记和K账户绑定；native／fixed-node-t1校准登记会在启动UI之前拒绝。沿现有构建、Playwright Chromium、真实Electron及DISPLAY，不安装依赖。端口6341占用即失败，不复用旧服务。每轮配置、项目、库、Electron profile及证据位于`~/.cache/scholoom-report-product/run-*`，TMPDIR也在该目录；所有结果保留，不自动重试。

`server.mjs`只呈现既有桌面产品静态构建，共用原bootstrap中间件，不启动开发服务器或注入另一个工作台。内核沿正常host-settings选择真实安装，C/M/P及冻结资源不使用替身。测试经现有`startModelKernel`仅替换模型HTTP边界，模型凭据是合成值；不调用真实API。两个宿主串行复用安装，避免并发接管同一控制仓储。

`sample.ts`提供两个固定文献对象的通用HTML／classic JS及CSS。它在独立P执行，包含筛选、排序、展开、附加、页面批注及状态恢复；报告清单中的资源／来源身份与basis均由真实项目和库返回，不由样本猜测。测试通过正式ReportView及共同输入框发送选择，实际harness读取报告并保存R2；分别核持久指令上下文、磁盘、成果关联与执行修改记录，再检查R1草稿保护、显式查看R2、准确R1关闭重开，以及新会话从原版和实际来源继续。

类型检查及`--list`只证明用例可编译／发现，不算产品验收。完整通过需该runner的两个宿主实际通过及所属内核正常关闭；静态宿主预检、普通程序factory或DOM模块检查均不能替代。系统故障矩阵、读屏／系统IME、分发及科研质量沿change的其余验收范围处理。

同一用例还在没有页面或共同输入草稿的新报告上核对R1→R2自动更新；随后撤销真实库来源的read／send，检查活动文档移除、报告读取被拒、共同输入正文和已明确附加项保留，且不产生新的模型请求。该段同样须由实际运行结果验收。

三组分别运行，均双宿主串行、原420秒整轮预算。`selection`在实际P声明并加载对象后，经真实选择和共同输入检查器核R1摘录在R2保留；20项、合并后超过16项及未知对象由本次桥回执确认整批拒绝，原正文与显式项保持，持久快照没有run或用户消息。

`lifecycle`使用注册的无模型机械图与可信发布屏障：工作受理、发布前关闭真实窗口，再释放屏障核普通内核保存报告并持久等待；重开实际报告ready保持原run／wait，只有共同composer发送确认才接续并保存continuation。Browser的共用bootstrap中间件显式选普通模式，Electron使用main的本地文件入口；默认开发托管及普通内核拒绝attach的契约保持。该组不调用模型，回环模型trap须零请求；图的首次受理经真实公共research.requestGraph，继续则经用户发送入口。它证明生命周期机械接线，不评价科研内容。
