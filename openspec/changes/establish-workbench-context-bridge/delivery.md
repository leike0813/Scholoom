# 实际交付与交接

## 当前状态与成果

2026-10-23 第二轮 dev 接收：本线 PR #6 以 `a9d8afe` 合入，来源／checkpoint、多来源查询及幂等持久化进入 dev。工作域已归档，领域交接 1.2、1.3、1.4 也已接入；下一步可绑定真实 `contextResources` 并完成 2.2、3.2，当前生产保护仍保留。接收时另修复单次推进 100 条后新增指令导致重复失败的问题，独立复核和真实 100／1 条 checkpoint 回归通过。进度仍为 **10/16**；组合验证、首轮失败与复验及平台边界统一见[领域交接第二轮 dev 接收](../establish-domain-execution-handoffs/delivery.md#第二轮-dev-接收)。以下为工作树提交时的交付依据。

2026-10-23，沿用户确认的 dev `ed35c59` 续做，当前 **10/16**：本轮完成 2.1、2.3、3.1、3.3，保留既有 1.1–1.3、4.1–4.3。本 change 尚不能归档或启动七域。用户已授权提交、推送及向 dev 发 PR，未授权合入 dev；本轮没有控制其他工作树。

依赖按实际增量核对：工作域授权及目标只读已接入，见[工作域交付](../archive/2026-10-23-establish-scoped-execution-foundation/delivery.md)；领域交接 2.2 driver 提取、共同 UI URL 源码已接入，工作树提交时统一执行资源适配 1.2 尚待接收，当前状态见[领域交接交付](../establish-domain-execution-handoffs/delivery.md)。本轮使用现有 driver、端口与 fixture，没有另建资源提供者、创建收据、图持久等待或共同命令。

- 可信指令来源随消息保存，经 `execution.beforeModel.instructions` 进入实际 worker 的结构化状态与 checkpoint。宿主只允许本推进已注入的指令选择来源；来源从持久消息取得，不信任工具自报连接。指令最初受理 run 与实际消费 run 可以不同，checkpoint 的 `instructionRunId` 标记实际注入范围；前序导入不恢复旧来源，中断恢复保留本推进来源，原回执不变。
- `read_workbench_context` 在工具调用时查关联连接当前快照。同源指令共用当前快照，不同窗口或窗口与 CLI 混合则返回 `ambiguous` 及当前指令引用。显式 ID 必须属于本推进；无来源、断线、无快照和接收会话不匹配分别诊断，不选择最近窗口，不重绑已失效连接。
- 服务端完整保存四种 `contextItems`，聚合校验沿协议入口；受理前复制载荷，避免在途草稿修改改变受理内容。重试比较全部载荷，字段顺序无关；改摘录、批注、basis、ref、region 或对象语义均拒绝。重复指令保留原回执及来源；提交后通知失败仍为 `outcomeUnknown`。
- 显式项经模型前置 IPC、SDK 内容适配和 checkpoint 保留，模型可区分已保存摘录、用户草稿、批注与整份材料引用，不声称已读原文。实际注入与工具查询使用过的资源证据随会话保存；恢复、历史指令读取、模型排队前后及最后同步准入均重新检查读取／外发授权。受理事务也同步复查，避免凭据或配置等待期间撤权后新受理。
- 历史摘录保留原内容与 basis。权限检查不强迫历史 basis 等于资源最新版本，实际重新读取时再核对版本，避免材料升级后会话永久失败。
- 生产没有绑定 `contextResources`：非空显式项在受理前仍报 `unavailable`；资源选择查询也拒绝，裸 `selectedItems` 因缺少可核对的资源证据继续不可用。测试沿 `ExecutionResourcePort.describe` 注入明确替身及所有者同步授权检查，只验证本线编排，不代表真实取材／外发授权已交付。注册图及 Agent 直接初始化的非空 `instructions` 均保持保护；实际 Agent 指令只沿模型前置端口注入。

既有连接与 UI 成果保持：认证连接拥有有界单调快照，关闭只释放快照、不取消已受理领域操作；窗口草稿按稳定实例、配置、项目及会话隔离。选择贡献、真实源码选区、共同附加项检查与批注沿原组件；刷新保留 pending，迟到回执不清除后续新增或已修改的条目。接入方式与当前限制见[开发说明](../../../docs/development.md#工作台上下文接入)，总体与时序图仍见[设计](design.md)。

## 实际验证

Linux、Node v24.12.0、pnpm 11.10.0；真实内核、WebSocket、IPC、worker、SQLite checkpoint，外部模型边界为 loopback 受控响应，不使用真实模型凭据或真实科研材料。资源替身只描述身份及授权，不读取资源正文。

| 命令或入口 | 实际结果与边界 |
| --- | --- |
| `pnpm generate:contracts`、生成器 `--self-test` | 通过。调用映射仍从 schema 推导；输出 patch 仅含既有格式差异，没有扩散改生成文件 |
| `pnpm check:architecture` | 13 模块、196 源文件，零问题、零例外；仅给 harness 增加 protocol/resources 的契约依赖 |
| `pnpm typecheck`、`pnpm build` | 通过；本轮命令均带 `--config.optimisticRepeatInstall=false` |
| `tests/kernel/context-instructions.spec.ts context-query.spec.ts graph-registration.spec.ts public-contract-baseline.spec.ts` | 最终一轮 **22/22**。四类显式项持久化、完整幂等、重启、真实 worker／checkpoint、版本升级、准入排队撤权、多来源／CLI 歧义、调用时更新、非法指令引用、自动下一 run 消费后重启恢复、初始化不得丢弃 |
| `tests/kernel/context-drafts.spec.ts context-session.spec.ts harness-recovery.spec.ts harness.spec.ts instruction-checkpoint.spec.ts work-domains.spec.ts`，连同初版 context-query | **33/33**。原多窗口／pending／迟到回执、真实保存／确认／回执故障恢复、scratch、压缩、工具及工作域路径保持通过 |
| `tests/kernel/workbench-context.spec.ts sessions.spec.ts` | **10/10** 通过；同一批初版查询测试有一项错误地读取不存在的 tool.error 字段，已改核对工具状态及结构化输出，并由专项最终通过 |
| 双宿主 `tests/ui/conversation.spec.ts resource-lifecycle.spec.ts --grep 'closing a resource\|conversation titles'` | **4/4**，浏览器与真实 Electron 各两项，覆盖原材料附加、发送、持久会话、刷新和阅读器请求生命周期；不作为新显式材料真实资源验收 |
| 修改源码／测试的 `biome check`、`git diff --check`、OpenSpec strict validate | 通过。全仓 lint 仍为未修改 `workbench/library/` 的 **21 项既有错误**，未扩范围修复 |

双宿主沿共同 URL 源码使用隔离端口 **5197** 与独立配置，Playwright fixture 和 teardown 负责所属内核、宿主与临时服务退出；结束后 5197 无监听。本树未安装 Electron 运行时，测试复用本机缓存的锁定 **44.5.1** 包，在 `/tmp/scholoom-context-electron-EDFYkK` 临时展开，经 `ELECTRON_OVERRIDE_DIST_PATH` 使用，结束后已移除本轮展开目录，没有执行依赖安装、升级或下载。平台及真实模型范围未扩大。

本轮日志位于 `test-results/kernel/`、`test-results/ui-5197/`，命令日志位于 `/tmp/scholoom-context-{typecheck,build,lint}.log`。格式化／生成 payload 是系统临时工件，不进入产品或生产依赖。早期公共契约用例使用不存在的会话测试显式项保护，按真实准入顺序改为已建会话并核对没有消息或运行受理，最终通过。

## 审查与问题处理

2026-10-23 合并后的来源保存、连接生命周期、窗口草稿和 RPC 回执经独立源码复核，无新增阻塞发现；全仓类型、构建、架构、137 项组合内核及 4 项真实入口冒烟通过。完整命令、模拟边界及 21 项既有 lint 错误见[工作域交付记录的 dev 接收验证](../archive/2026-10-23-establish-scoped-execution-foundation/delivery.md#dev-接收验证)。这些检查不包括本线尚未接通的模型前显式材料授权，也不构成 4.4／4.5 完成依据。

独立默认继承模型只读审查可信来源、模型外发、幂等与恢复，发现并修复三项：

1. 注册图分支可能接受后忽略初始化 instructions：将保护恢复到分支前，实际 worker 回归确认没有图效果。
2. 历史 basis 与当前版本强比较导致会话永久阻塞：只复查当前身份／权限，旧 basis 留给实际重新取材核对；v1→v2 后续执行及历史保留回归通过。
3. 自动续做在不同 run 实际消费追加指令时，按最初受理 run 恢复来源会漏候选：以 checkpoint 的实际注入 run 标记恢复。真实 worker 先完成 A、由 B 消费迟到指令，中断重启 B 后仍返回旧／新来源歧义，并把旧连接诊断为 disconnected，未把前序 A 指令当候选。

三项定点复核无新增阻塞发现；独立审查只读代码／内存验证，真实 IPC、重启及双宿主测试由主线程执行。既有多窗口草稿未改变，原真实 hook／草稿回归已运行。资源所有者的真实授权与最终组合尚未验收，4.6 不据此次局部审查提前勾选。

## 未完成事项与下一步

剩余 **6 项**见 [tasks.md](tasks.md)：2.2、3.2、4.4–4.7。

1. 同步已接入 dev 的领域交接 1.2 统一执行资源适配，核对实际提供者的读取／外发及同步最终检查，再绑定本线注入缝。不得拿人工资源端口替代；裸 selectedItems 的资源身份／权限没有对应依据前继续明确不可用。
2. 同步后验收实际项目／库取材、排队期间撤销库外发与目标信任、恢复后重新授权及真实资源重新读取。仅完整链路成立才开放对应生产路径并勾选 2.2／3.2；当前替身结果不能代替这些证据。
3. 完成必要本线双宿主新显式项验收后，三线实际能力与图／成果路径就绪时再由 4.5 指定当次整合负责人及隔离配置，开展真实公共基础组合，随后完成 4.6／4.7。不要启动七域或提前归档。
4. PR #6 已由 dev 接收；用户手动同步后继续，不控制其他工作树。续做先读本记录及依赖 delivery，再取 `openspec instructions apply --change establish-workbench-context-bridge --json`。
