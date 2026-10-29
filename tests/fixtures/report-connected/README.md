# 真实客户端与工作台报告汇合夹具

只检验原报告 3.2 的两类接缝：真实保存通知形成候选时保护共同草稿，以及真实库来源撤读时封住页面。沿原 Workbench、共同 tab、useBusinessSession、ContextContributionProvider 和原上下文检查器；不启用报告 HTML 脚本。

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
