# 实际交付与交接

## 当前状态与成果

实现与验收已完成，任务状态见 tasks.md。两个 dev 命令通过共同 Vite 引导接入真实内核，默认使用 `.scholoom-dev/debug/`；最后一个调试宿主退出后回收内核，配置、库和项目数据保留。Electron 开发桥向其 renderer 服务转发引导，普通产品路径继续独立 CLI。真实接线与 design 图一致；全部现有业务回归、实际开发命令和真实 MiniMax UI 验收通过。

## 实际验证

环境：本机 Linux，Node 24.12.0，pnpm 11.10.0，已安装 Electron/Chromium 和图形服务。

最终固定源码 `pnpm check` 退出码0：lint、typecheck、build全部通过；内核100项通过/1项显式live跳过，smoke5项通过/1项显式live跳过，双宿主UI60项通过/2项仅浏览器运行的检查在Electron跳过。完整日志：`/tmp/scholoom-development-check-complete.log`。额外显式live UI场景通过，见下方命令和合成成果。

- 变更前隔离内核探针：断开模拟调试宿主后仍为 running，断言预期 stopped 失败；经本轮客户端明确停机清理，原有默认驻留实例未操作。
- `pnpm build:shared && pnpm test:kernel tests/kernel/development.spec.ts`：首轮4项通过，共享所有权、独立内核保护、启动无人认领超时、杀死宿主后的回收。
- 扩展所有者重连测试后，组合11项中10项通过，重连项因过早读取旧 connected 状态失败；等待真实 reconnecting 事件后，`pnpm test:kernel tests/kernel/development.spec.ts --grep reconnecting` 通过。客户端同时重新登记恢复连接的所有权。
- `pnpm typecheck`、`pnpm lint` 通过。首轮 UI 为42过/19失败/1跳过：未重建的 Electron main 在受管实例退出后补起独立实例，导致后续夹具拒绝接管。重建后 Electron PDF/阅读记录相邻场景2项通过；中间一轮 UI 因实现文件更新触发页面重载，由主 Agent 中止，最终检查使用固定源码重跑。
- 第一轮 `pnpm check` 内核98过/1跳过，smoke 因新增文件的 describe 内 trace 设置被 Playwright 拒绝；已将 trace 设置移至文件顶层。中间整轮为内核99过/1跳过、smoke5过/1跳过、UI58过/2失败/2跳过：模型夹具替换与首次Electron引导竞争，以及形态测试在会话身份恢复前输入。夹具现等真实连接及业务就绪；形态测试等同一公开就绪信号。失败两项单独复验通过（30.2秒），随后完整 pnpm check 全部通过。
- 收尾通过公开引导接口复现并修复并发 inspect/ensure 被合并为两次stopped的问题，确保ensure不会被只读发现吞掉；`pnpm typecheck && pnpm test:kernel tests/kernel/development.spec.ts` 的8项回归全部通过（58.2秒）。独立审查复核新增合并与关闭分支，未发现新问题。
- `pnpm test:smoke tests/smoke/development.spec.ts`：真实命令场景1过/显式live1跳过，核对跨宿主题录、刷新、退出顺序、实际PID回收、重启新实例和数据保留。首次实际命令运行被本机 SUID sandbox helper 配置中止；Linux 命令测试按既有 Playwright Electron 方式显式设 NO_SANDBOX=1，产品默认设置不变。
- `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:smoke tests/smoke/development.spec.ts --grep 'live MiniMax' --output test-results/development-live`：1项通过，真实 MiniMax 从工作台接收指令，显示 read_file/write_file，保存result.md，另一真实 Electron 开发窗口打开核对。合成输入2/4/6，独立预期数量3、合计12、均值4；结果位于 `test-results/development-live/development-live-developme-9476b-and-the-other-host-opens-it/synthetic-result.md`。测试不录trace，凭据只经环境传给内核。
- `openspec validate complete-real-kernel-development-harness --strict` 通过。首次 delta 验证因场景改名导致解析器认为遗漏旧场景失败，已保留原标题并在场景正文区分普通产品。

## 审查与问题处理

已自查同配置并发、所有权连接与普通客户端分离、独立实例拒绝接管、共享 Vite 端点的凭据拒绝规则及关闭期间引导。独立只读审查发现 Vite 内部重启复用 manager 导致新服务失效，以及失败交接可能丢失旧所有者；均已修复。真实 server.restart 测试核对成功交接保持同实例、认证失败的交接保留旧服务及最终关闭回收；审查者复核两处P2已解决，未发现新的可证实问题。必要运行结果由主 Agent 核对。

## 未完成事项与下一步

本变更无剩余实施任务，未提交或归档。结束时核对5174、5315、5316、9315、9316端口均无监听，本轮开发与测试内核进程全部退出；仅原有 `.scholoom-dev/` 驻留实例保留，PID3353785、instanceId b23e0006-d793-4915-aff2-8bde1f34e627 与变更前相同。

真实模型只使用已授权的环境凭据与隔离合成材料。Linux命令自动化显式使用NO_SANDBOX=1，产品默认sandbox设置保持；本机直接启动Electron仍需满足系统sandbox运行条件。Windows/macOS、目标分发包与OS sandbox未在本轮实跑。独立驻留路径由专门生命周期和产品smoke维护，完整科研质量不由合成样本验收证明。
