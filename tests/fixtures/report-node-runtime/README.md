# 固定 Node／WorkerDOM 运行校准

```sh
node tests/fixtures/report-node-runtime/check.mjs
```

bootstrap 经受控适配复用 `packages/editor/vendor/worker-dom` 固定共享源码；同根保留 `upstream-manifest.json`、`local.patch`、`MODIFICATIONS.md` 及 Apache／MIT 原许可，构建从此根复制许可说明。

仅适用于本机Linux x86_64；使用原固定native安装中的root-owned Node24.12.0及本机六份动态库。运行前应先完成`report-system-service`原安装的固定正常路径验收。本入口只用合成材料，不运行用户报告、浏览器或模型，不修改原安装、账户或系统单元。

每次在`~/.cache/scholoom-report-node-runtime/run-*`构建策略及固定bootstrap，保留源码依赖图和许可；创建一个自有user transient service，CPU20%、内存512MiB、swap0、32tasks、运行上限10秒。可信启动shim先从自身cgroup读取实际四项限额，保存到本次cache；P没有proc／sys挂载。退出后unit可能已回收并显示默认值，因此`unit-after.json`不能替代`live-limits.txt`。

bwrap只开放精确Node、解释器、六份库、可信bootstrap和一份批准材料，根目录只读，capability清空、独立namespace、环境仅允许PWD。新seccomp候选默认拒绝，clone3返回ENOSYS，clone只接受固定pthread flags；socket／socketpair／recvmsg、fork、ptrace和namespace扩张未开放。它是校准候选，不是已登记的生产profile。

systemd-run的`--pipe`及Node spawn的`stdio: 'pipe'`可能使用Unix socket，不能直接作为P的数据管道。可信shim以标准管道连接输入／输出，两条日志流在本夹具内合并，`pipefail`保留执行失败。bootstrap独立断言FD0/1/2均为FIFO；单条输入最多1KiB，响应最多64KiB。

样本核实际WorkerDOM的HTML／MathML mfrac、一次真实mutation frame、固定请求响应及批准字节；TCP／UDP必须EACCES或EPERM，宿主文件读取、批准材料写入和子进程创建必须失败。所有网络目标均为回环地址，不访问外部服务。失败保留原工件；没有自动重试、改宽策略或降低断言的路径。

当前保留为可重建校准夹具。它证明固定闭包可在该受限视图中运行，不证明任意HTML／JS、安全接收DOM帧、跨账户Node运行、完整停止凭据／容量、正式ReportView或双宿主I5。生产接入须将验证后的策略合入受控原生适配，绑定受保护运行时闭包及独立数据通道，继续复用原K/C/M权威。
