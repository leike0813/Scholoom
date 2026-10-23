# 实际交付与交接

## 当前状态与成果

2026-10-23 第三轮，当前 **13/16**：完成 2.2、3.2、4.4，保留前两轮已完成的十项；4.5–4.7 仍未完成。本树开始时干净，HEAD 为 `9c8212f37225683e5abc6326b2098c9b0d2835f7`，已包含用户指定的 dev 基线。实施前读取阶段约定、公共基础实施规划、本 change 和领域交接的“第二轮 dev 接收”，再取得 apply instructions。依赖的工作域授权、领域交接 1.2 统一资源适配、2.2 driver 与共同 UI URL 已接入，见[领域交接 delivery](../establish-domain-execution-handoffs/delivery.md#第二轮-dev-接收)。

用户授权实施、隔离双宿主服务、按归属收尾、提交推送和向 dev 发 PR；未合入 dev、未控制其他工作树，未变更依赖声明或锁文件，未升级或下载依赖。仍不启动七域或归档。

- `KernelApplication.contextResources` 默认绑定原 `executionResources` 和资源所有者授权。受理时没有活动 run，以宿主私有 signal 标记核对接收会话，只提供 describe 检查；不伪造执行、不经人工资源权限放行。标记可随内部 broker 传播，产品参数不能建立；来源项目和目标实例被固定，检查保留取消信号。
- 活动执行经原资源端口取材。`read_context_resource` 复用同源 `resources.read` 参数与实际资源适配，按明确 ref/basis 有界读取，前后核对有效执行及权限，使用记录进入后续模型外发授权。真实目标项目与库附件均已贯通，库须有 read/send，目标须可信且有已登记身份。
- `read_workbench_context` 仍在调用时查当前快照。selectedItems 只接受同一 selections 内有可核对资源证据的 itemId，所有 selections 逐项授权；裸 ID 明确 unavailable，不猜对象或静默 fallback。可信来源来自持久消息，多来源返回 ambiguous 及本推进 instructionIds，不选最近窗口。
- 完整 contextItems 保存在原消息、pending、worker、IPC 与 checkpoint 中。真实模型排队期间撤销目标信任或库 send 后均无 HTTP 外发；重启后仅发送纯文本不能绕过 checkpoint 中旧摘录的授权。重新授权后可继续，并由真实 worker 重新读取原项目／库材料，正文进入受控模型请求。
- 历史摘录保留原 basis。实际资源变化后旧 basis 重读返回 contentChanged，历史记录不被重写，新正文不被静默外发。异步授权后及最终同步准入均复查；快照和持久摘录不构成授权凭证。
- 浏览器与真实 Electron 均通过现有源码视图选择、附加选区、共同 composer 批注和发送，再查看工具及 Agent 结果。刷新后 UI 和持久消息完整读回。延迟 session.send 回执期间修改批注、新增条目，释放回执后保留后续草稿，刷新仍保留。原多窗口草稿、pending 与迟到回执回归继续通过。

既有来源／幂等／100 条单次 run 契约保持：来源随模型前置指令进入实际 worker 状态；原身份重试比较完整载荷并保留回执；超过 100 条的指令交下一 run。注册图及 Agent 直接初始化非空 instructions 的保护仍保留。本轮未修改 registered Graph 等待恢复或共同命令。接入示例及能力边界已更新到[开发说明](../../../docs/development.md#工作台上下文接入)，设计总览和时序图见[design.md](design.md)，实际接线已同步其正文。

### 必要的共享资源增量

人工资源视图和目标只读原先使用不同 basis，跨项目重读会把未变化的材料报为 contentChanged。现由共同 fileFingerprint 生成含 ctime 的强资源版本；等长改写并恢复 mtime 仍拒绝旧版本。底层 files.readBytes 保留原 basis 发布证据及跨移动续读契约，显式增加 resourceBasis 参数／结果，资源适配器只消费强版本，不猜字符串格式、不降级。

保存返回强资源版本；产物待关联回执分别持久保存发布依据或资源版本，重启沿原证据核查，不认领替换文件。首次创建继续复用原 file_operations 记录：候选清理后的 resourceBasis 与 complete 在原事务中提交，完成后再编辑或删除文件不改变原操作回执。旧完成记录缺该可选字段时，只有原发布身份／依据仍匹配才补齐，不按当前材料猜测。无物理表迁移，也未另建创建收据。同步文件操作限定在既有 creations 原生适配器，architecture.json 已登记相应 fs 访问。

共享修正独立提交为 `84ae633`，上下文接线随后独立提交；整项等待 dev 审查接收。

## 实际验证

Linux、Node v24.12.0、pnpm 11.10.0；使用真实内部项目／库资源、SQLite、worker、IPC 和 checkpoint。样本均为合成材料，外部模型边界为 loopback 受控 HTTP，没有真实模型凭据或科研质量验收。前两轮的授权替身测试仍保留，但本轮生产路径与新资源测试不注入 contextResources 替身。

| 命令／入口 | 实际结果与范围 |
| --- | --- |
| `pnpm generate:contracts`、生成器 `--self-test` | 通过；生成 patch 仅既有格式差异，调用映射继续由 schema 派生 |
| `pnpm check:architecture` | 最终 13 模块、198 源文件，零问题、零例外 |
| `pnpm typecheck`、`pnpm build` | 通过。最后收据／取消修正后再构建 projects、kernel，并通过 tools 的 tsc；命令均带 `--config.optimisticRepeatInstall=false` |
| `pnpm lint`、最后修改文件的 Biome check | 通过；全仓 74 warnings、35 infos。dev 已清除前两轮记录中的 21 项库 UI 错误，本轮没有沿用该旧失败结论 |
| context-resources、harness、resource-access、resource-creation、target-reader | **33/33**，约 2.7 分钟：真实上下文、取材及模型外发、排队撤权、重启重新授权／重读、版本拒绝、保存／关联、创建与 101 份待关联收据 |
| context-instructions、context-query、context-drafts、context-session、harness-recovery、instruction-checkpoint、workbench-context、work-domains、sessions、graph-registration、public-contract-baseline、project-files、resource-identity | **69/69**，约 4.3 分钟：来源／歧义、完整幂等、草稿、消费确认故障恢复、100/1 分 run、字节跨移动及原图入口 |
| 最后原子收据修正的 context-resources、graph-registration、harness 的 101 收据、resource-access、resource-creation | 20 项首轮 **19 通过、1 取消错误码失败**；修正后复验 context-resources 及取消／撤权创建 **6/6**，约 1 分钟。其余 19 项已有通过证据，包括新加的完成事务写入失败／重启恢复、后续编辑及删除仍重放完成回执 |
| 双宿主 `tests/ui/context-bridge.spec.ts` | 最终 **4/4**，约 2 分钟；浏览器与真实 Electron 各两项，实际附加／发送／工具重读／结果查看／刷新与迟到回执 |
| `git diff --check`、本 change strict validate | 通过；apply instructions 确认 **13/16** |

双宿主使用隔离端口 **5198**、独立 UI 配置及原 fixture／teardown，结束后无监听。本树复用本机已有锁定 Electron **44.5.1** 包，在 `/tmp/scholoom-r3-electron-YgqaeI` 临时展开，经 ELECTRON_OVERRIDE_DIST_PATH 使用；结束只收尾本轮所属进程与展开目录，没有执行安装、升级或下载。测试工件在 `test-results/r3-resources-final`、`r3-regression-final`、`r3-receipt-verified`、`r3-admission-verified` 及 `ui-5198`。命令日志为 `/tmp/scholoom-r3-{typecheck-final,build-final,lint-verified,architecture-verified,resources-final,regression-final,receipt-verified,admission-verified,ui-verified}.log`；测试定义和本记录保留可复验入口，本机日志不是跨机器持久工件。

## 审查与问题处理

独立默认继承模型只读复核生产受理标记、所有者授权、强版本及收据恢复；发现的问题均已修正并定点复核关闭。审查本身不替代主线程的真实测试。

1. 初次统一 basis 会丢失 ctime 检查；采用显式 resourceBasis 保留强版本，同时恢复底层跨移动契约，真实等长改写／恢复 mtime 与字节跨移动测试通过。
2. 保存／创建发布证据与资源版本混用，导致刚返回的资源不能重读；分别保存证据，并验证保存后立即读取、创建完成后编辑／删除仍查询原回执。
3. complete 与资源版本分开持久化存在崩溃窗口；改为同一原事务提交。真实 SQLite 完成 UPDATE 失败时保留未知结果，重启核对原物理身份后恢复；不能把相同路径的替换文件认领为原创建。
4. 受理取消需在最后同步检查复查；仅该路径补检查，活动执行保留既有 instanceMismatch 优先级。首次补检查使取消测试返回普通取消错误，修正后 6/6 通过，未放宽断言。

实施中全局替换 byteBasis 曾使保存报告 outcomeUnknown，已撤回；最终明确区分原发布证据与强资源版本，无旧格式 fallback。初版测试中的三个 unavailable 预期已沿真实提供者改核对权限／身份失败，裸 selectedItems 的保护保留。Electron 首轮展开工具结果后最终回复在可见区外，按需渲染卸载正文；测试先滚动到最终回复再核对，随后双宿主两轮均 4/4 通过。架构检查首次指出 creations 新同步 fs 访问未登记，已在原适配器声明中补齐，最终零例外通过。

辅助只读调查曾越界运行测试并触发已有 Electron 缓存自动展开，已停止该委派并告知用户；没有改依赖版本或锁文件，也未把其测试结果作为主线程验收。主线程的双宿主验证使用上述单独临时展开目录并自行收尾。

## 未完成事项与下一步

剩余 **3 项**见 [tasks.md](tasks.md)：4.5、4.6、4.7。本轮局部验收与独立审查不提前完成最终交付。

1. 4.5 等三线实际 Graph／共同命令／成果路径及必要 dev 增量就绪，指定当次整合负责人和隔离配置，再开展公共基础最终组合；本轮不承接其他线的图等待或共同命令实施。
2. 完成组合后沿 4.6 复核可信连接、模型外发、幂等、多窗口与接入边界，随后更新本记录并完成 4.7，才判断归档和七域启动。
3. 本轮提交、推送当前分支并向 dev 发 PR，停止于可审查 PR，不自行合入。dev 接收共享修正与上下文接线后，用户同步再续做；仍先读本记录和依赖 delivery，再取 apply instructions。

未运行真实 Windows／macOS、三平台分发包或完整 UI 套件；未调用真实模型、未做科研充分性或三线最终组合验收。PDF／EPUB 精细选择和七域业务接入仍归后续领域工作，不能据本轮真实文本路径宣称完成。
