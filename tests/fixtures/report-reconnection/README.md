# 有效报告的持久等待接续夹具

仅供 `tests/kernel/report-reconnection.spec.ts` 注册，不进入生产图目录。

- `graphs.mjs`：无模型固定图，经实际资源端口读取项目 JSON／库来源，首次创建带真实 manifest 的 HTML 报告，在真实 LangGraph interrupt 等待。合法新消息接续后重新核读报告和来源，另存 continuation；独立新会话的 `read-saved` 模式只从显式报告／来源 Evidence 读取并保存接续依据。
- `worker.mjs`：直接使用生产 `startExecutionWorker`，无工具／资源／checkpoint 替身。
- `kernel.mjs`：独立子进程组合真实 KernelApplication、测试注册表和 `startKernelServer(..., false)`。普通模式没有 development owner；客户端关闭不会关闭内核。测试注册表使它有别于 stock CLI 的空生产目录，本片不重验 CLI 配置发现／全局生命周期锁。
- `connection.ts`：私有 IPC 只交启动 endpoint，业务均经真正 KernelClient／loopback JSON-RPC。停止使用绑定原 instanceId 的 shutdown，再等待自有子进程 close；日志和交接只保留身份／端口，不落 token 或完整连接 URL。

期望依据是报告 wire 契约和固定合成样本 `[10,20]`／来源原文，测试独立核 manifest、实际文件、保存与 association、wait／invocation、报告 ref／basis，未把生产 encoder 的输出作为唯一 oracle。初始报告由真实 worker 保存；不是先写 Markdown 再改后缀。

控制指令 consumed 表示已持久交给图，不代表来源读取或后续成果成功。撤销来源权限后，合法控制消息仍可被 checkpoint 消费；实际报告读取拒绝，尝试失败，已有报告和原 wait／invocation 证据保留，不生成 continuation。不自动恢复授权或重放调用。

运行前复用已验证的共同生产构建；新 `.mjs` 用 `node --check` 检查，TS 由既有 tools 类型检查及 Playwright 处理。所有数据和结果指定到自有 cache，禁止使用真实库或付费模型：

```sh
export TMPDIR=<独立cache根>/tmp
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/report-reconnection.spec.ts --output <独立cache根>/results
```

本片没有页面、桥 ready、页面销毁、Browser／Electron、系统 IME／读屏或目标平台整合；只证明实际查询／连接不消费等待。不能用无 send 代替页面 ready 负例，不能据本夹具关闭完整3.2／I5或科研质量。
