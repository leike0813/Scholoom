# 可信报告生命周期模块汇合夹具（3.2c）

只回答两个已有模块组合问题：有真实共同正文、显式项和页面草稿时，新候选能否保留旧页且明确切版不重写草稿；关闭重开时，可信版本状态能否给候选，并在装入新视图完整restore封套后拒绝64KiB超限。不是正式报告运行器或新产品工作台。

复用真实Workbench和共同tab、useBusinessSession、Workbench内原ContextContributionProvider、InstructionContextItems的检查/批注/移除、原草稿适配，以及createReportUpdates/createReportDrafts/createReportContext。固定内容与来源结构只读复用report-context/sample，合成项目命名空间为application；完整load、client和当次授权事实明确为替身，无领域仓储或真实授权结论。client仅提供watch、核snapshot形状的context.publish及唯一固定入口的files.resolve，不发送模型请求或读真实文件。不导入report-context入口，不复制其草稿逻辑；不依赖后续report-client。构建仅为空替换未挂载的默认ResourceView/project-ui（两者引入未用的PDF/写作视图和Vite虚拟资产）；实际资源tab由本夹具renderResource注入，其余被测模块不替换，不是文档/PDF/写作或项目导航验收。

## 重建与双宿主运行

本树必须已有主线验证过的desktop/kernel/shared产物、Chromium/Electron和可用显示。下面只编译新夹具；静态承载使用保全生成器及static-ui.mjs，没有Vite开发服务器。直接Node运行，不安装或调用根test:ui的setup。传入新的cache结果目录，保留失败目录，不覆盖上一轮日志：

```bash
export TMPDIR=/home/joshua/.cache/scholoom-round20-acceptance-INWZnx/next/literature-workbench/tmp
export DISPLAY=:99
export SCHOOLOOM_UI_PORT=6211
node tests/fixtures/report-lifecycle/run.mjs /home/joshua/.cache/scholoom-round20-acceptance-INWZnx/next/literature-workbench/first
```

run在每次运行先预检显示，再构建fixture.js/CSS、检查夹具及tools类型、从本cwd生成静态配置，最后冻结产物运行新spec两场景×Browser/Electron。它另建短`~/.cache/lc20-*`供系统socket/TMPDIR，路径写入temporary.json；profile、产物、JSON、trace、命令均在给定结果目录。6211须空闲，可显式另选端口；不复用他人服务，不停止共享DISPLAY。Electron沿共享uiPage的每用例user-data-dir及实际profile路径附件，不另造launch或改sandbox。

## 可操作路径与观察

测试先进入已构建产品确认连接，再route本固定bundle到同origin。夹具侧栏说明替身性质：

1. 点击“接收会话”“打开报告夹具”。真实共同输入框填写正文；报告草稿通过原createReportDrafts保存。附加林对象，使用原检查器检查、编辑批注及移除一项来源，保留原显式对象/原basis。
2. 保留旧动作；加载第二版，原updates依据实际原适配的page dirty/explicit/body事实保留current与pending。明确查看新版后旧consumer dispose，旧动作只到其原receive，不转发。关闭真实tab时dispose、退订；重开核同版状态，缺版copyOnly不投页面，撤权不读/恢复受保护缓存。
3. 第二场景保存独立按UTF8 JSON精确构造的65536字节state（原viewId=v、generation=0）。关闭重开生成较长viewId及新generation，用原isReportBridgeMessage再核完整restore。候选仍restorable但完整封套超限，拒绝调用可信样本页的恢复回调；原适配内容与共同草稿保持，不截断。

页面的applied是可信固定React页的显示值；持久/保护/诊断的业务事实始终从原适配读取，不另建业务草稿。可观察`window.reportLifecycleFixture.read()`仅只读当前准确绑定的存储、共同正文/显式项、updates metadata、最新一次完整封套、至多32条事件及调用名。撤权时不返回报告存储或旧封套；没有localStorage枚举、跨DOM推断或全库投影。旧动作仅保留一条，原页关闭/替换后不可复活。

没有报告HTML脚本、frame、OS范围或正式bridge ready；样本恢复回调只证明汇合算法，不证明活动报告/真实授权/跨平台/系统IME/读屏或科研质量。完整3.2/I5保持开放，所属工件由主线接收。
