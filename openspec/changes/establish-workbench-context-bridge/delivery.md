# 实际交付与交接

## 当前状态与成果

### 第四轮 registered Graph 指令上下文

2026-10-23，开始前确认本树 HEAD 为 dev `e324367`、工作区干净，已包含用户指定基线。先读 AGENTS、scholoom-dev 阶段约定、公共基础实施规划、两条 active change 的最新 tasks／delivery，再取得 apply instructions。用户要求本轮独立接通 registered Graph 的完整指令上下文，提交、推送并向 dev 发 PR，最终组合留待领域夹具及隔离验证就绪；本轮未操作其他工作树或合入 dev，没有安装、升级或下载依赖。

新增原任务 **3.4** 记录这个独立前置增量，已完成，当前 **14/17**。原 4.5、4.6、4.7 仍未勾选；没有归档或启动七域。领域交接的 4.x 夹具／隔离／最终交付不由此增量代替，其 dev 接收事实见[领域交接第三轮记录](../establish-domain-execution-handoffs/delivery.md#第三轮-dev-接收)。

- 复用共同 `InstructionContext`，补可选 text、materials、materialFileIds；source、contextItems 继续引用原同源声明。GraphFactory.resume 保留 id/text 形状并取得完整上下文。宿主只从所属会话的持久消息重建可信来源，不采信工厂或 worker 自报窗口。
- 已匹配指令经原 `execution.initialize` IPC 交给实际 worker。当前 instructions 与已核对的 checkpointInstructions 分开传递，后者只为旧 checkpoint／累计身份补齐上下文，不替换本轮匹配输入。旧 checkpoint 只有身份时从同会话持久消息补齐；已保存完整载荷与持久消息冲突则停止。
- worker 的原 InstructionSaver 按 checkpoint 中的 instructionIds 保存完整上下文及 instructionRunId，写盘成功后才调用原消费 IPC。宿主核对实际 checkpoint、完整载荷、等待 graphResume、指令归属及授权后才确认。保存失败不消费，确认失败或回执丢失沿原身份和 checkpoint 核查，不重放领域成果。
- registered worker 在创建工厂前核查最新 checkpoint、先持久补齐完整上下文再补交消费确认；终态已保存且无剩余节点时也可恢复，不依赖节点再次 put。普通 Agent 的原保存／确认路径保持。
- 受理、等待映射、恢复、worker 初始化及消费确认继续复查资源许可。Graph 与普通 Agent 复用原会话材料授权记录，模型排队前后和最后同步准入均复查，不能以切换执行路径、换批或纯文本续做绕过旧摘录的撤权。历史摘录保留原 basis，实际读取核对版本。
- 完整路径通过后移除 registered 消息附件的 unavailable 保护：显式项目／库材料、原项目路径／身份附件均实际进入映射、worker、checkpoint 和取材路径。文字输入及源码 `execution.materials` 保持独立。没有持久 checkpoint 的图仍拒绝非空初始化指令，普通 Agent 的直接初始化保护保留。

设计总览／数据流已同步[design.md](design.md)，完整行为补入原 delta spec；开发入口及界限见[开发说明](../../../docs/development.md)。本轮不重建资源提供者、创建收据、Graph 等待机制或共同命令。生产源码 Graph 注册集合仍为空，测试宿主与 worker 的固定图是明确的源码注册夹具，不是已发布的科研方法。

## 实际验证

Linux、Node v24.12.0、pnpm 11.10.0。使用真实内部项目／库附件、broker、worker 子进程、IPC、SQLite checkpoint、资源创建及所属记录；样本为合成材料。模型边界为 loopback 受控 HTTP，worker 实际调用同一模型适配和额度，不使用真实外部凭据。未注入人工资源端口或成功授权替身。

| 命令／入口 | 结果与范围 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck` | 最终全仓通过，包含 shared build、各包类型和 tools；新增来源冲突用例后再单独运行 tools tsc，通过 |
| 同选项 `pnpm build` | 最终全仓通过，日志 `/tmp/scholoom-r4-build-final.log` |
| 同选项 `pnpm lint` | 最终通过，74 warnings、35 infos。首次增加旧 checkpoint 用例有两处不安全可选链，已改为先断言持久结果存在，未放宽行为断言 |
| `pnpm check:architecture` | 13 模块、198 源文件，零问题、零例外 |
| `pnpm generate:contracts`、生成器 `--self-test`、生成 patch 格式化比对 | 通过；六份 patch 格式化后与源码一致，映射仍从 schema 派生，无生成文件漂移 |
| `registered-context.spec.ts registered-graph.spec.ts graph-registration.spec.ts instruction-checkpoint.spec.ts` | **29/29**，约 4.1 分钟。10 项完整上下文专项、14 项原图边界、2 项真实 worker 注册与资源、3 项 checkpoint 边界 |
| 收尾定向 `registered-context.spec.ts --grep 'legacy checkpoint\|terminal checkpoint'` | **3/3**；旧上下文字段缺失／空数组及终态确认故障。恢复时从已核对的完整身份集合构造当前指令；修改后重建 harness／kernel、tools tsc、改动文件 Biome 均通过，未重复整组 29 项 |
| `context-instructions.spec.ts context-resources.spec.ts context-query.spec.ts harness-recovery.spec.ts harness.spec.ts public-contract-baseline.spec.ts context-drafts.spec.ts context-session.spec.ts` | **53/53**，约 5.2 分钟。普通 Agent、可信来源／歧义、完整幂等、模型前撤权、100/1 条分 run、101 份待关联收据、恢复及多窗口草稿保护 |
| 本 change strict validate、`git diff --check`、apply instructions | 通过；apply 返回 ready，**14/17**，不是最终交付完成 |

直接执行现有 `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts`，分别指定上表文件及独立 output。工件在 `test-results/r4-graph-final`、`test-results/r4-regression`、`test-results/r4-recovery-final`；命令日志在 `/tmp/scholoom-r4-{graph-final,regression,typecheck-final,tools-final,build-final,lint-verified,architecture-final,contracts-final,recovery-final,recovery-build,recovery-types}.log`。测试按自身 fixture 关闭所属 app、模型及 worker；本轮没有启动浏览器／Electron UI 服务。本机临时日志不是跨机器持久证据，测试源码保留复验入口。

专项独立核对：

1. 从真实源码注册图保存成果并进入 interrupt；用户经原 product 连接发送项目／库显式摘录与原项目路径附件，恢复映射和 worker 收到同一完整载荷。实际正文、原摘录与可信来源进入受控模型请求；结果文件和 checkpoint 与服务端消息逐项相等，重启补交仍为原受理回执，旧来源 disconnected。
2. SQLite checkpoint INSERT 失败、消费 UPDATE 失败、确认提交后回执丢失三种故障均通过。未保存不消费，已保存完整上下文可重启恢复，原成果和上下文结果各仅一份历史。
3. checkpoint 的来源被改为伪造窗口时，即使身份相同也拒绝恢复，消息仍 accepted、没有附加材料结果。
4. 旧 checkpoint 的完整上下文字段缺失或为空数组时，累计身份 A/B 的图从持久消息补齐并成功保存；终态保存后确认失败的图在重启时补交确认，无剩余节点也可完成，原文件 inode 与历史次数不变。
5. 模型排队期间撤销目标信任或库 send，以及异步授权后／最终同步准入前撤销库 send，均无 HTTP 请求。重启纯文本续做仍拒绝，重新授权后沿原指令恢复并真实重读／外发，回执不变。

## 审查与问题处理

独立默认继承模型只读审查指令归属、完整载荷、可信来源、checkpoint 及撤权路径，发现两项 P2：

- 新 resume 只传新指令时，旧 checkpoint 的累计 ID 可能缺完整上下文。现从持久消息补齐已核对归属的旧 ID，经同源 checkpointInstructions 交给 Saver，保留当前 instructions 的范围；真实旧 checkpoint 回归通过。
- 终态已保存但确认失败时，恢复无节点可执行，不会再次 put。现注册图在 factory.create 前先完成原 checkpoint 的核查／补交；真实终态确认故障回归通过。

两项窄复核确认关闭，无新增 P1/P2。独立审查不写文件、不运行测试或服务，主线程负责上述真实结果。初版 tools 类型检查发现 GraphExecution 从错误的聚合入口导入，已改用执行契约出口。首次 4 项旧图探测与 7 项初版专项通过；上述最终 29/29、53/53 在两项审查修复后重新运行，不把重复复验相加为独立用例。

## 前序交付与保留契约

dev `e324367` 已包含 PR #9 的生产工作台资源授权以及 PR #8 的持久 Graph／共同命令。前序来源连接、当前快照、显式项可靠受理、历史 basis、多来源歧义、composer 和多窗口草稿成果保持，第三轮的完整记录可在[本次基线 delivery](https://github.com/leike0813/Scholoom/blob/e324367/openspec/changes/establish-workbench-context-bridge/delivery.md)核对；本轮结果取代其中“registered 附件尚未接线”的工作树状态，不改写 dev 接收历史。

## 未完成事项与下一步

仅剩原 **4.5、4.6、4.7**。本轮以一个独立提交和向 dev 的 PR 交付 registered 指令上下文增量，停止于可审查 PR，不自行合入。

4.5 须等待领域交接的实际夹具、双实例隔离及必要验证就绪，dev 接收本增量后，指定当次整合负责人和隔离配置再开展最终组合；本轮不据固定图局部回归提前勾选。其后完成最终审查和交付记录任务，才判断归档与七域启动。用户同步后仍先读原 tasks／delivery 和依赖记录，再取得 apply instructions。

未运行完整内核／完整 UI、真实 Windows／macOS 分发包或真实模型科研验收；本轮没有重跑双宿主 UI，也未开展领域双实例及 4.5 三线最终组合。固定图的合成样本不证明科研充分性，前序双宿主证据也不替代待开展的组合验收。
