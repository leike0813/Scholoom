# 实际交付与交接

## 当前状态与成果

2026-10-22，工作台线独立实现交接。用户明确要求实现本变更，并确认当前仓库就是最新状态；另外两线的资源／授权及 Graph driver 增量尚未交付。本轮完成 1.2、1.3、4.1、4.2、4.3，连同既有 1.1 为 **6/16**。尚未完成整个变更，不满足归档或七域启动条件。用户随后要求向 dev 发起 PR，本次提交本线独立增量，保留上述未完成状态。

- `apps/kernel/src/workbench-context.ts`、`manual.ts`、`server.ts` 实现认证后绑定的连接端口、单连接快照、整体容量校验、单调修订和断线释放。普通 `application.call` 发布被拒绝；产品参数不能声明来源。Store 的读取是宿主内部能力，尚未向 Agent 注册查询工具。
- `application.ts` 与 `packages/harness/src/runtime.ts` 保存消息的可信 `source`；跨窗口重试保留原来源，重启保留诊断关联但不重建旧快照。2.1 的实际执行输入仍等待 driver 增量，未据部分保存勾选任务。
- `context-contributions.tsx` 与 `WorkbenchSession` 提供视图纯数据贡献、释放及显式附加接口；`Workbench.tsx` 绑定活动视图与接收会话。真实 `FileEditor`／CodeMirror 源码选区进入实时快照，只有点击附加才进入草稿；未保存内容标为 draft。固定 region／object 提供者通过真实组件验证，不声称已经取得图像像素或实现图表命中。
- `context-drafts.ts`、`business-session.tsx` 复用原 pending 和 composer 草稿。命名空间加入稳定工作台实例；刷新恢复，新窗口及复制窗口名的独立导航保持隔离。旧稿仅明确复制到语义为空的目标，原值保留；回执只移除原项，新增项和发送后修改的批注保留。pending 包含完整显式项，恢复时重新校验；消息呈现区分明确附加与实际读取。
- dock／overlay 共用附加项检查、批注与移除入口；上弹列表限高滚动，沿既有菜单和语义 token，不挤占输入与发送区域。`docs/ui-design/README.md` 已先更新，开发入口与实际限制见 `docs/development.md` 的“工作台上下文接入”。
- 明确拒绝允许保留草稿后修改重发；结果未知保留原 pending。可靠受理提交后的异常统一为 outcomeUnknown；RPC 成功回执发送失败关闭连接，不回包为业务拒绝。真实故障注入确认不会将已保存指令误判为未受理。
- 连接关闭只释放快照、阻止该端口的新调用，不传播取消信号到已受理的领域操作；真实资源读取在关闭后继续完成。

共同契约 1.1 的既有成果继续保留：

- [workbench-context-contracts.ts](../../../packages/protocol/src/workbench-context-contracts.ts) 为快照、显式项、指令上下文、publish／内部 read 提供唯一 schema；[workbench-context-types.ts](../../../packages/protocol/src/workbench-context-types.ts) 经现有生成器派生调用映射。
- [workbench-source.ts](../../../packages/protocol/src/workbench-source.ts) 提供宿主侧连接来源；CallContext、消息记录和执行初始化共享此声明。session.send 不接受自报来源，原消息和 materials／materialFileIds 可读。
- [workbench-context.ts](../../../packages/protocol/src/workbench-context.ts) 提供 schema 加聚合校验：单项摘录／批注的 UTF-16 上限、64 KiB UTF-8 正文、重复项与归一化矩形。真实提供者接入时使用这些入口，不能只验证单项 schema。
- 产品、客户端和 worker 共用 protocolVersion=4，历史消息／执行记录新增字段可选。非空 contextItems 或 worker 结构化指令仍明确失败，避免数据被受理后丢弃；publish 已接通认证连接。

design 的连接发布、草稿与 UI 部分已实现；Agent 查询、显式项执行及资源重新授权部分仍为目标，不能据该图推断整条路径已经可用。

## 实际验证

环境为 Linux、Node v24.12.0、pnpm 11.10.0。测试使用隔离临时配置、真实内核／WebSocket／IPC 和本地受控模型响应，没有外发真实材料或使用真实模型凭据。共同基线原验证仍见[领域交接记录](../establish-domain-execution-handoffs/delivery.md#实际验证)，不把其 Electron 冒烟作为本轮 UI 验收。

| 本轮命令或入口 | 实际结果及范围 |
| --- | --- |
| `pnpm generate:contracts` | 成功生成 patch；本轮无 schema 变化，输出仅含既有格式差异。对生成结果按 Biome 格式化后与现有派生文件比较一致，未扩散修改生成文件 |
| `pnpm check:architecture` | 13 模块、189 源文件，0 findings、0 exceptions |
| `pnpm typecheck` | 全仓通过；包含共享构建、各包及 tools／测试类型检查 |
| `pnpm build` | 全仓构建通过，包括桌面 main、preload、renderer；保留既有兼容宿主缺少 preload 配置提示。可靠回执修正后另行重建 broker、harness 与 kernel |
| `pnpm test:kernel tests/kernel/workbench-context.spec.ts tests/kernel/context-session.spec.ts tests/kernel/context-contributions.spec.ts tests/kernel/context-drafts.spec.ts tests/kernel/public-contract-baseline.spec.ts tests/kernel/sessions.spec.ts tests/kernel/resource-access.spec.ts` | 20/20，通过，50.9 秒；涵盖真实双连接、伪造来源、超量／旧修订、断线、可靠来源与重启、通知失败、原会话及真实资源读取。组件测试运行 Chromium；资源端口和固定区域／对象为显式替身，未挂载的导航／其他格式视图为空替身 |
| `pnpm test:kernel tests/kernel/rpc.spec.ts tests/kernel/client.spec.ts tests/kernel/broker.spec.ts tests/kernel/harness-module.spec.ts tests/kernel/execution-isolation.spec.ts tests/kernel/workbench-context.spec.ts` | 25/25，通过，1.4 分钟；回执发送失败不冒充拒绝，真实连接重连／停机及 worker IPC、取消、超时与未知结果回归通过 |
| `pnpm test:kernel tests/kernel/workbench-context.spec.ts tests/kernel/client.spec.ts` | 生命周期修正后 8/8，通过，39.4 秒；真实 ManualApplication 证明关闭端口不取消已受理资源读取，关闭后的新调用拒绝；来源、重启与客户端连接行为再验通过 |
| `pnpm test:kernel tests/kernel/context-session.spec.ts` | 补充真实 hook 的旧稿恢复场景后再次通过；验证目标 `[]`／`{}` 不阻塞恢复、原旧稿保留、明确拒绝后可改发、迟到回执不动另一会话、未知回执刷新后保留原身份 |
| 修改的 25 个源码／测试文件 `biome check` | 通过。全仓检查仍有 21 项错误，均在未修改的 `workbench/library/` 文件中，包括按钮类型、交互角色、label 和格式问题；没有扩大本轮范围修复 |
| `git diff --check`、`openspec validate establish-workbench-context-bridge --strict` | 通过 |

早期组件测试因未配置的可视化／PDF 资源构建边界失败，已将未挂载视图声明为空替身；菜单关闭后的移除操作超时，已在测试中重新打开同一菜单。草稿测试曾使用非安全 HTTP 域名导致 UUID API 不存在，改为 HTTPS 拦截页面后通过；生产路径保持安全上下文。未运行开发服务器。

首次类型检查触发本机 pnpm 在新工作树自动恢复锁定依赖，未事先取得安装授权，已在对话说明；依赖声明及锁文件均未改变。后续命令使用 `--config.optimisticRepeatInstall=false`，没有继续安装或升级。测试证据在 `test-results/kernel/`，格式化临时 payload 留在系统临时目录，不成为生产依赖。

没有运行本轮真实浏览器／Electron 产品组合、模型前撤权、真实模型或三平台分发验收。当前不接受非空显式项进入实际执行，因此组件和 pending 通过不能替代 3.2／3.3／4.4／4.5 的完成依据。

## 审查与问题处理

独立默认模型审查发现并关闭：明确拒绝仍锁 pending、语义为空的材料记录阻止旧稿恢复、已保存后的通知异常误报拒绝，以及 RPC 成功回执发送失败被当作业务拒绝。最后一项修正经独立复核，确认业务异常与回执发送异常分开，失败释放计数并关闭真实 WebSocket；25 项连接／IPC 回归由主线程实际执行。同期检查 Provider 回调稳定性、发布去重、重连再发布和容量，组件测试确认无关渲染不会重复发布。

收尾自查移除了连接关闭对在途领域操作的取消传播；独立复核确认端口准入检查到进入 provider 无异步让出，关闭动作同步释放快照且幂等。新增真实读取与客户端回归 8 项由主线程执行通过。

共同契约原审查仍见前述领域交接记录。架构没有增加例外。尚未完成模型外发／真实授权整条链路，4.6 保持未勾选。

宿主仍须建立并快照可信来源、按实际指令查当前窗口，核对接收会话和每次资源／模型外发权限；CallContext 可选字段不是授权凭证。isContextItems／isWorkbenchContextSnapshot 的整体校验不能由 JSON Schema maxLength 代替。

## 未完成事项与下一步

剩余 10 项以 tasks.md 为准：2.1 已保存来源但尚未送入有效执行；3.1 已完成客户端 pending，但服务端显式项持久化／重试比对尚未接通，二者均不按部分成果勾选。2.2、2.3、3.2、3.3、4.4–4.7 保持续做。

下一步先同步工作域授权和领域交接 1.2 的真实资源适配，再核对其 delivery；修改通用 driver 同一块前同步领域交接 2.2，修改共用 UI fixture／URL 前同步其 4.1。本轮没有修改这些共享块或把另外两线的任务吸入本工作树。只有来源传入有效执行、显式项可靠保存、模型前重新授权与实际 worker 输入验证完成后，才移除非空 contextItems 的 unavailable 保护。

最终三线真实组合验收由 4.5 承接，前置实际就绪后指定当次负责人和隔离配置。当前不创建常驻协调 Agent，不启动七域，不归档。续做运行 `openspec instructions apply --change establish-workbench-context-bridge --json`，读取本记录与前置增量后继续。
