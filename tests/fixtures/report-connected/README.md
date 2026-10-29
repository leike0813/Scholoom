# 真实客户端与工作台报告汇合夹具

检验原报告 3.2 的当前版更新/撤权接缝，以及精确原版草稿关闭重开。沿原 Workbench、共同 tab、useBusinessSession、ContextContributionProvider 和原上下文检查器；不启用报告 HTML 脚本。

## 接线与输入

`domain.ts` 只读复用 `report-client/domain.ts` 的真实 KernelApplication、认证 loopback server、broker、项目和独立 library。独立固定清单及文献字节来自 `tests/fixtures/report.ts`，不以生产编码器生成预期。创建普通会话但不发送指令，无模型参与。

renderer 创建实际 KernelClient，用户通过原项目/会话导航选择真实会话；原 useBusinessSession 在同一连接注册 workbench.watch。createReportClient 消费该连接的实际报告读取与通知，不替其他消费者改 watch 范围。固定控制按钮只调用 Node writer 的真实 resources.save/library.grant；不注入读取、权限或提交成功结果。

页面只使用实际 snapshot 中的对象语义和原 createReportContext。页面草稿由原 createReportDrafts 保存；正文、显式项及批注由共同 adapter/检查器写入并按准确 key 读回。React 的 applied 仅是可信页面显示值。每次明确接受候选重建页面 consumer，持久草稿身份仍按 basis；关闭真实 tab 时 dispose context 和 report client 并退订。

`site.ts` 只向自有 loopback HTTP 提供固定 bundle、CSS 和私有测试配置，避免拦截文档造成浏览器 Local Network Access 前置失败；没有关闭浏览器网络保护或修改系统权限。构建只为空替换未挂载的 ResourceView/project-ui，沿已接收旧夹具边界；被测 Workbench、hook、贡献、检查器和报告模块不替换。

## 重建和运行

前置：本树已有主线验证的 shared/kernel/desktop 产物及本机 Chromium/Electron、可用 DISPLAY。从本树 cwd 传新的绝对 cache 目录：

```bash
export TMPDIR=/home/joshua/.cache/scholoom-round21-acceptance-pCcY4R/next/literature-workbench/tmp
export DISPLAY=:99
export SCHOOLOOM_UI_PORT=6221
node tests/fixtures/report-connected/run.mjs /home/joshua/.cache/scholoom-round21-acceptance-pCcY4R/next/literature-workbench/new-run
```

先创建上述 TMPDIR。run 每次先 xdpyinfo 预检，再构建本夹具、检查其类型及 tools 类型，调用保全静态配置生成器，最后固定产物运行本 spec 的两类 × Browser/真实 Electron。没有开发服务器、依赖下载或产品重建。另建短 `~/.cache/rc21-*` 供系统 socket/TMPDIR，准确路径写 temporary.json；命令/cwd/退出码、profile、结果、图片、trace 都留在结果目录。6221 必须空闲；不接管其他服务或 DISPLAY。Electron 沿共享 uiPage 的独立 user-data-dir，并保留真实路径附件。

## 两类代表与证据

1. 原共同输入框输入正文，页面保存 dirty 状态，附加实际对象/来源并在原检查器编辑批注。真实 resources.save 修改独立清单中的比较语义，收到项目级通知后形成 pending；旧 current、正文、显式项/basis、页面状态保持。明确查看新版使旧动作失效。同版本再次核查/接受后仍能附加，原项保持。原 rpc-gate 仅延迟已完成真实 resources.report 的原始成功回执；真实关闭 tab 后释放，实际 Promise 结清且不再读报告、不复活旧页。
2. 真实 library.grant 撤 read 后，领域 resources.report 拒绝，canDisplay=false，页面卸载、页面状态不对外返回，共同草稿保持。恢复授权通知本身不恢复展示；显式 recheck 后仍需明确查看候选，原版本页面草稿才可恢复。

观察只读且有界：准确 key 的原正文/上下文/页面状态、当前 adapter metadata、最多 24 条通知和事件；domain 复用至多 300 条调用名/basis 记录，另外核真实磁盘报告字节与独立预期。不枚举 localStorage、不跨 DOM 推断状态、不投影全库。每例 finally 释放 renderer、domain client/server 和自有静态 site；共享 harness 关闭自有窗口并确认预检内核停止后退役其配置，报告 domain 的隔离输入保留。

这里没有正式报告桥 ready、活动 HTML/frame/OS 承载、进程重启、真实模型或科研质量结论。仅证明本机 Linux 两宿主模块/真实领域汇合；完整 3.2/I5、其他平台、系统 IME/读屏仍由后续验收负责。

## 精确原版关闭重开（第25轮）

新两类用例直接消费实际 `restoreReportDraft({client,identity,signal})`，由其把真实 `resources.reportVersion` 结果交原 store 判资格。可信宿主持初次报告的准确配置/窗口/ref/basis；当前版按钮只选实际当前客户端已返回的 descriptor，未知 basis 是固定负例。不枚举存储、不从当前清单或时间猜旧版，也不把失败转换成成功 unavailable。当前版继续由原 createReportClient 管候选。

1. 在原输入框/检查器保留共同正文、显式项和批注，页面用原 createReportDrafts 保存 browse/draft/dirty，并核同次 localStorageWritten 与准确 key 的实际 localStorage 值。关闭真实 tab，真实 save 发布不含来源A的R2；重载整个真实文档清除模块内存，重选原会话后精确重开R1。只有完整原 snapshot 才挂载固定可信页，完整新view restore消息仍经原 isReportBridgeMessage；原 browse/draft、ref/basis、共同项不跟R2改写。R2原store为missing；撤回A后R2仍可读，R1恢复RPC失败不展示/复制缓存，原存储保持。
2. 原依赖ref不变、内容真实前进后，成功 unavailable 仅呈现适配实际返回的 draft/dirty copyOnly，不恢复 browse、造snapshot或创建共同consumer。原未知basis错误与已有R1缓存上的真实client.dispose/RPC失败都不产生copyOnly。真实reportVersion回包暂扣时关闭tab，abort只阻止本地采用；release前确认尚未结清，release后实际Promise结清仍不复活。客户端断开场景也释放原始回包，不合成成功或错误。

每个精确视图捕获本次identity/client，关闭、依赖/库通知失效或断连时abort并退订；完整RPC仍由原客户端结清。新视图有独立viewId/generation，普通页面组件复用，不复制业务状态。恢复资格与完整快照只在当前通过核查的视图供观察；失败后result为null，测试仅以准确key的相等布尔值核原存储保留。页面applied仍只作固定React显示值。

只运行新两类×双宿主：

```bash
export TMPDIR=/home/joshua/.cache/scholoom-round25-acceptance-PHGzsJ/next/literature-version/tmp
export DISPLAY=:99
export SCHOOLOOM_UI_PORT=6237
node tests/fixtures/report-connected/run.mjs /home/joshua/.cache/scholoom-round25-acceptance-PHGzsJ/next/literature-version/new-run --grep 'exact version'
```

先创建TMPDIR并确认端口空闲；runner透传第3个参数后的Playwright筛选选项，仍先显示预检/build/types再固定测试。当前版原组不默认作为新版本成果重跑；受改动影响时单独选最小旧代表。未验OS窗口/跨配置客户端替换的完整竞争、目标平台、生产ReportView或正式承载；真实页面重载只证明本fixture的window标识复用、新client连接和localStorage恢复。
