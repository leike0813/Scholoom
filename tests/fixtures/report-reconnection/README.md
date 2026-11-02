# 有效报告的持久等待接续夹具

供 `tests/kernel/report-reconnection.spec.ts` 与 `tests/fixtures/report-product/lifecycle.spec.ts` 注册，不进入生产图目录。

- `graphs.mjs`：无模型固定图，经实际资源端口读取项目 JSON／库来源，首次创建带真实 manifest 的 HTML 报告，在真实 LangGraph interrupt 等待。合法新消息接续后重新核读报告和来源，另存 continuation；独立新会话的 `read-saved` 模式只从显式报告／来源 Evidence 读取并保存接续依据。
- `worker.mjs`：直接使用生产 `startExecutionWorker`，无工具／资源／checkpoint 替身。可信启动 URL 可启用发布前调度屏障：真实读取完成后写 `entered.json`，记录 attemptId／originInstructionId／worker PID，等待父侧 `release`；公共 Graph 配置不能提供路径。异步等待响应取消，60 秒未释放明确失败，不修改业务效果或授权。
- `kernel.mjs`：独立子进程调用真实 `serveKernel(..., { development: false })`，注入同源测试注册表及 worker，沿真实配置加载报告安装、发布 endpoint 并持有运行锁。普通模式拒绝 development owner；工作台关闭不关闭内核。
- `connection.ts`：私有 IPC 只交 `ready`，随后通过真实 `inspectKernel` 发现 endpoint 并核对自有子进程 PID，业务均经真正 KernelClient／loopback JSON-RPC。停止使用绑定原 instanceId 的 shutdown，等待自有子进程 close 后经 `waitForKernelStop` 核查锁与原实例退出；日志和交接只保留身份／端口，不落 token 或完整连接 URL。原两参数调用不启用屏障；可选 `publicationBarrier` 和回环 `modelEndpoint` 仅来自可信测试父侧。

期望依据是报告 wire 契约和固定合成样本 `[10,20]`／来源原文，测试独立核 manifest、实际文件、保存与 association、wait／invocation、报告 ref／basis，未把生产 encoder 的输出作为唯一 oracle。初始报告由真实 worker 保存；不是先写 Markdown 再改后缀。

控制指令 consumed 表示已持久交给图，不代表来源读取或后续成果成功。撤销来源权限后，合法控制消息仍可被 checkpoint 消费；实际报告读取拒绝，尝试失败，已有报告和原 wait／invocation 证据保留，不生成 continuation。不自动恢复授权或重放调用。

运行前复用已验证的共同生产构建；新 `.mjs` 用 `node --check` 检查，TS 由既有 tools 类型检查及 Playwright 处理。所有数据和结果指定到自有 cache，禁止使用真实库或付费模型：

```sh
export TMPDIR=<独立cache根>/tmp
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/report-reconnection.spec.ts --output <独立cache根>/results
```

产品生命周期用例由 `report-product` 的两个宿主配置串行运行。测试只消费 `tests/ui/fixture` 的 `page`／`uiHost`，先显式停止静态宿主的旧调试内核并确认退出，再独占相同隔离配置启动上述普通内核。Browser 关闭实际 page，Electron 沿生产主进程关闭原生窗口并核对应用进程退出；发布屏障证明原调用已进入真实 worker 且报告尚未保存。关窗后才放行真实领域保存，核对磁盘 HTML、执行来源、已确认关联、checkpoint 与原持久 wait。重开真实工作台和已安装 P 的报告页达到 ready 后，原 run／wait／messages／invocation 均须保持，continuation 仍不存在；只有原共同 composer 发送 `{"confirm":true}` 才接续，磁盘 continuation 须带原 waitId、实际新指令及原报告／来源读取依据。

该用例通过正常产品 bootstrap 发现普通内核，不替换连接端口或工作台。静态宿主 bootstrap 若仍强制取得 development owner，会被普通内核拒绝，必须由主线处理生产连接边界后再实跑。主线负责将 `lifecycle.spec.ts` 加入 product config／runner，并串行调度同一安装；准备与 `--list` 均不代表实际通过。

共同 composer 当前要求配置凭据，故产品用例注入合成凭据及已有回环模型服务器作为陷阱，断言请求数为零；固定 Graph 本身不调用模型。原重启及撤权 kernel 用例保持既有行为。所有配置、日志、屏障、项目和失败证据保留在本轮 cache，测试收尾关闭自身窗口及原内核，不删除目录。

本片只验证机械接续，不要求生产科研 Graph、真实模型或科研质量；系统 IME／读屏和其他平台分发仍由对应验收负责。双宿主实际通过与其余报告要求均由主线汇总后决定完整 3.2／I5，不能仅据定义或单内核例关闭。
