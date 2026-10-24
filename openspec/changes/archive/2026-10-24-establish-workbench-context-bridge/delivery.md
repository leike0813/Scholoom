# 实际交付与交接

## 当前状态与成果

### 主分支最终接收

2026-10-24，用户要求在 dev 接收三个工作树成果并完成收尾，不再分派。主线从干净的 `23e68c8` 保留原提交合入 #13、#14、#15；本项 PR #15 固定头 `65927fae78fc543752fbef34164d596fae37c217`，合并提交 `d66a308`，GitHub 已确认为 MERGED。原 4.5／4.6 的组合及独立审查成果已在 dev 接收，本项 4.7 的交付记录现完成，**17/17**。

主线核对本项完成判据：认证连接所属快照、调用时查询与多来源歧义、显式项完整幂等、模型前授权及多窗口草稿均沿原设计交付。普通 Agent 大更新、registered 完整指令及 checkpoint 容量修复保持；没有增加第二份资源权威或生产科研 Graph。新增正式规格 `openspec/specs/workbench-agent-context/spec.md` 与本项 delta 同步，保留原 Purpose 和全部场景，通过 strict 校验。

接收在 Linux／Node 24.12.0／pnpm 11.10.0，复用既有依赖。三项合并后根 typecheck／build、架构及契约生成核对通过，lint 零错误（74 warnings、35 infos）。双宿主 context-bridge／resource-opening／resource-lifecycle／writing-editor **12/12，6.2 分钟**，隔离端口 5371；真实双实例 **1/1，37.3 秒**，5373／5374；入口 smoke 初次在完整构建期间 Electron 两项关闭会话，构建结束后未改代码复验 **4/4，46 秒**，不把首次失败隐去或认定其原因。日志 `/tmp/scholoom-r5-{ui,isolation,entrypoints,entrypoints-final}.log`。

随后主线修复领域独立审查的 detached 进程 P1，原生归属接入后，包含 workbench-integration／registered-context／harness-recovery／harness／editor／editor-runtime／resource-identity 的真实内核组合 **61/61，7.7 分钟**，日志 `/tmp/scholoom-r5-native-integration.log`；Linux 目录包实际入口 **4/4，38.6 秒**。本项原独立审查及窄复核见下节，本轮按用户要求没有再委派审查或其他任务。

内部 broker、SQLite、资源与 worker 均真实，模型边界仍为本机受控 HTTP，材料为合成样本。本项完成只表明工作台上下文能力及约定组合已交付；领域 4.5／4.6、macOS 原生归属范围及跨平台完整 CI 仍见各自 delivery。**全部公共基础尚未验收，不启动七域。** 未验证真实外部模型科研充分性、完整 UI 及三平台分发安装恢复。

### 第五轮最终组合与独立审查

2026-10-23 至 24，用户指定本线为当次最终整合负责人，授权同步最新 dev，声明隔离配置后推进 4.5／4.6，更新原记录、提交推送并向 dev 发 PR；不合入、不归档或启动七域。开始工作树干净，fetch 与 fast-forward 核对最新 dev **23e68c8**，包含 #11 隔离夹具、#12 完整 Graph 上下文和接收容量修复。读两 active change 最新 tasks／delivery、阶段约定及 apply instructions：工作台 14/17、领域 16/19，均 ready。领域 4.4 整组尚未交付，本轮不代勾。

本轮 **4.5／4.6 已完成本树验收，当前 16/17**；4.7 保持未完成。修复及组合以两个独立提交向 dev 发同一 PR，停止于可审查结果；不将本树验收表述为 dev 接收或公共基础全部完成。

新增 `tests/kernel/workbench-integration.spec.ts` 正常／关联失败两个分支，复用原 broker、资源所有者、worker、SQLite checkpoint 和源码 durable-resource 图：

1. 真实认证 WebSocket 向 application 全局会话发送完整项目／库显式摘录；发送后同连接更新选择，实际 Agent 工具查询新快照并读取可信项目／库正文。历史摘录、basis 及可信 source 保持。
2. 全局普通工作区写入被拒绝，项目／应用均无目标文件；原 socket 断开后实际工具返回 disconnected，不借另一个在线连接。原身份补交回执不变，改变载荷拒绝。
3. 固定 Graph 经源码内部入口启动，保存第一份成果后 interrupt；原 session.send 显式项经恢复映射、worker、模型和完整 checkpoint 后确认消费。公共 resources.creation/read 取得最终资源身份、正文和关联，重试不重放成果。
4. 沿领域既有 artifacts SQLite 触发器注入关联失败：创建／磁盘保存 complete，association unknown，graphProgress 保留部分结果；解除故障后只由原 creation 补关联，inode 和历史不变。

双宿主新增场景在现有 `tests/ui/context-bridge.spec.ts`：全局会话用户经真实库视图附加资源、共同 composer 发送，随后打开另一库材料，工具读取新选择及可信项目／库；刷新后的原显式项／来源和原身份补交保持。材料准备走真实 API，附加、选择、发送及查看回复经 UI；Graph 启动仍为源码内部入口，没有新增产品图选择按钮。没有重建资源提供者、创建收据、Graph 等待或共同命令。

#### 隔离与验证边界

主线程承担最终验收。内核每例新建 `/tmp/scholoom-final-context-*`，含独立 profile、项目、库和成果；容量回归为 `/tmp/scholoom-context-large-*` 的独立 profile／target。WebSocket／模型监听随机回环端口。UI 声明端口 **5363**，每轮新配置；首轮沿原 config 生成，完整回归明确 `/tmp/scholoom-r5-ui-8d3mtJ`，各例项目和输入另建 `/tmp/scholoom-final-context-ui-*`。输出 `test-results/r5-combination-kernel*`、`r5-ui*`、`r5-kernel-verified`，容量探针附 instruction-ipc，组合附 combination-evidence，UI 附 global-ui-evidence，不含 token／凭据。原 fixture 仅关闭本轮所属 app、worker、模型、Vite 和 Electron，保留诊断工件。

Linux／Node 24.12.0／pnpm 11.10.0，Chromium 与真实 Electron/preload；内部文件、broker、SQLite、资源及 IPC 为真实实现。模型为 loopback 受控 HTTP 和合成样本，没有真实外部凭据；固定图只在测试注册，生产集合仍为空。没有安装升级依赖、操作其他工作树或合入 dev。

#### 运行记录及失败处理

首轮新组合 **1/1**、新增全局双宿主 **2/2**，随后完整 context-bridge／resource-lifecycle 双宿主 **8/8，4.0 分钟**。首次 50 项内核取得 **48 通过、2 失败**：主线程同步源码后漏了先重建，dist 仍为旧 Saver／传输实现，101 条累计与大输入执行旧代码。确认后重建全部 shared，再做最终回归；首次结果保留 `/tmp/scholoom-r5-kernel-final.log`，不称最新源码通过。

最终修复、完整重建后结果如下；早期探测与复验重叠，不相加为不同用例：

| 实际命令／范围 | 结果及证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck`、同选项 `build` | 全仓通过，日志 `/tmp/scholoom-r5-{typecheck,build}.log` |
| 同选项 `lint`、`node scripts/check-architecture.ts` | 通过；74 warnings／35 infos，13 模块、198 文件、零问题／例外，日志 `/tmp/scholoom-r5-lint-verified.log`、`/tmp/scholoom-r5-architecture-final.log` |
| `node packages/protocol/scripts/contract-types.mjs --patch`、`--self-test`，生成 patch 经 Biome 后与源码核对 | 六份映射一致，生成检查通过；仅执行控制映射因新增同源 op 改变 |
| 现有 kernel CLI，指定 workbench-integration、registered-context、context-resources、resource-access、context-query、context-instructions、context-drafts、context-session、workbench-context、harness-recovery | **65/65，8.8 分钟**；正常／部分关联组合、可信连接及歧义、普通／Graph 容量、传递中断、保存／确认／回执／来源故障、恢复撤权、资源版本及多窗口草稿。日志 `/tmp/scholoom-r5-kernel-verified.log`，工件 `test-results/r5-kernel-verified` |
| `SCHOOLOOM_UI_PORT=5363 SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-r5-ui-verified-Znon1k xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/context-bridge.spec.ts tests/ui/resource-lifecycle.spec.ts --workers=1 --output=test-results/r5-ui-verified` | Chromium／真实 Electron **8/8，3.9 分钟**；全局库附加及变化选择、项目选区、模型重读取材、刷新与迟到回执、所属读取取消。日志 `/tmp/scholoom-r5-ui-verified.log`；原 fixture 已结束，5363 无监听 |
| 两 active change `openspec validate <name> --strict`、`git diff --check` | 通过；本线 apply 以 tasks 为准为 16/17、ready，仍未最终交付 |

内核和 UI 直接调用已安装的 Playwright CLI；未执行 setup 安装脚本。新增容量单项的传递边界附件和组合／UI 结果附件用于复验诊断；本机日志不是跨机持久证据，源码用例保留正式入口。未重跑完整内核／完整 UI、双实例 smoke、真实外部模型科研及 Windows／macOS 分发包；双实例依赖复用领域 #11 已接收证据。

#### 独立审查与容量修复

两名默认继承模型独立只读审查。一组核对可信来源、调用时查询、版本及 Graph／普通 Agent 模型准入，另一组核对完整幂等、重启回执、累计指令、checkpoint 消费、多窗口草稿及组合断言。后者无 P1/P2；前者发现普通 Agent 的 beforeModel 仍将整批合法指令装进单帧，70×32768 字符即超过 2 MiB，已受理后无法推进。

现沿原 RemoteAgent／worker 增加同源 execution.modelUpdate，按编码字节选择原响应或逐项传递 framework message／InstructionContext。本次 beforeModel 独立 token 绑定暂存，完整原响应成功后才交 SDK，finally 释放。帧上限仍为 2 MiB，单 run 最多 100 条、原回执、授权及保存后消费机制不变。beforeModel 有界等待由 5 秒改为 **30 秒**，覆盖批次真实资源授权和分帧；探针确认摘录批次超时发生于授权阶段，未开始传递，不以跳过授权或放宽帧上限解决。

复用 context-instructions 增加长正文、大批真实资源显式摘录及第二帧 send 失败三项；模型夹具仅为大输入可配置 HTTP body 上限。重建 dev 基线后两项容量红测均中断；首次新测试将 target 放进 profile 遭合法拒绝，已修正隔离布局再复现。实现时漏派发新 op 已修正；框架压缩使最后请求不含全部历史，断言核对实际请求曾收到完整正文及完整 checkpoint，不锁定压缩结果。大更新最终 **2/2**；分帧中断 **1/1**，无 HTTP、全部原指令 accepted，重启后完整输入和原回执恢复。新增测试空 pattern 及格式 lint 错误已修复，未放宽规则。以上三项再次包含于最终 65/65；独立窄复核关闭原容量 P2 和派发遗漏，核对 token 隔离、迟到帧拒绝、finally 清理及失败不提交半更新，无新增 P1/P2。审查员没有写文件或运行测试，真实结果由主线程执行。

#### 领域证据复用与剩余范围

领域实跑范围引用[第四轮 dev 接收](../../establish-domain-execution-handoffs/delivery.md#第四轮-dev-接收)及[隔离夹具双宿主记录](../../establish-domain-execution-handoffs/delivery.md#第四轮隔离夹具与双宿主验证)。既有 resource-access 覆盖目标拒写、排队撤权及关联 unknown／重启补关联；registered-context 覆盖项目／库排队和最终同步准入撤权、恢复后授权与重读取材；registered-graph 覆盖取消和持久等待。机制复用，不重复实现。领域 4.4 的取消／关联失败／worker 失联整组及其模块独立审查仍由原 change 交付，不把普通 Agent worker 失联证据称为 registered 图组合通过。

开发说明补七域选择／视图／工具接入表、明确 instructionId 查询形状和真实边界；design 总览及流程保持，新分帧机制同步 design／delta spec。接入口说明不代表七域业务交付。4.7 暂保留待领域最终整合证据，当前不宣称全部公共基础完成。

### 第四轮 dev 接收

2026-10-23，用户要求处理三个工作树的新一轮任务。dev 从干净的 `e324367` 保留原提交，依次以 `2ae82e8`、`356769b`、`c76df43` 无冲突合入 PR #10、#11、[#12](https://github.com/leike0813/Scholoom/pull/12)。本变更 3.4 的 registered 完整指令上下文现已接入，领域线的实际双实例隔离及双宿主验证前置也已接入。当前仍为 **14/17**；4.5–4.7 未完成，没有归档或启动七域。用户手动同步其他工作树，本轮未控制其 Agent。

独立审查固定头 `25d693d` 确认两项 P2，主线在接收中修复：

1. 图累计保留第 101 条指令时，旧 Saver 先保存再因确认上限失败；新增 checkpointInstructions 的单次初始化上限又阻断重启。Saver 现保存前核对身份结构，写盘后每批最多确认 100 条；原所属记录在同一尝试内累计确认身份，使中途确认失败后原 checkpoint 仍可核查。累计历史不再通过一个受限初始化数组传输。
2. 70 条各 32768 个 ASCII 字符的合法指令，共同装入初始化后超过 2 MiB IPC 帧，重试仍失败。现复用同源执行控制增加 `execution.instructions`，经所属连接逐条传递当前／历史完整上下文；全部到达后才初始化工厂，worker 按原身份重建输入和 Saver 上下文。保留帧上限、指令内容、原身份及顺序，不为降低载荷丢弃材料或提前消费。

生产修改集中于 protocol 执行声明及其生成映射、原 RemoteAgent／worker driver、InstructionSaver 和 HarnessRecords；开发说明、原 design／delta spec 同步。没有新建记录权威、进程体系、依赖或生产 Graph。独立审查对完整来源、附件、waitId、保存后消费及模型最终授权未确认新增绕过，上轮六项修复未见回退。

Linux／Node 24.12.0／pnpm 11.10.0 的接收证据：

| 实际命令／组合 | 结果与范围 |
| --- | --- |
| 修复前合并后的 12 文件内核组合；实际双实例；Chromium／Electron 定向 UI；入口 smoke | 分别 **101/101、1/1、10/10、4/4**，入口及环境见[领域接收记录](../../establish-domain-execution-handoffs/delivery.md#第四轮-dev-接收)。不将这些结果称为容量修复后的重跑 |
| 修复后根 `typecheck`、`build`，均带 `--config.optimisticRepeatInstall=false` | 全仓通过；首次共享构建的可变 union 参数回调窄化错误已修复，再重建及完整检查通过。日志 `/tmp/scholoom-integrate-r4-final-{typecheck,build}.log` |
| 修复后原 registered-context、registered-graph、graph-registration、instruction-checkpoint、harness-recovery、context-instructions | **49/49，6.6 分钟**。真实内部 worker／资源／SQLite，模型边界为 loopback 受控 HTTP；覆盖普通 Agent、完整附件、旧上下文缺失／空数组、终态补确认、保存／确认／回执故障、来源冲突、等待分页、撤权及取消。日志 `/tmp/scholoom-integrate-r4-fix-regression.log` |
| 新增容量专项 `registered-context.spec.ts --grep 'registered cumulative context\|registered large instruction batches'`，独立 output `test-results/integrate-r4-volume` | **2/2，35.7 秒**。复用原固定图，先受理 100 条并保存，再追加第 101 条、注入最后一批消费确认失败；重启后完整载荷及 101 条消费状态保持、成果仅一份。另实测 70 条各 32768 个字符的完整文本进入 worker／checkpoint，重启后仍能取回旧上下文并完成。日志 `/tmp/scholoom-integrate-r4-volume.log` |
| 新用例及共用夹具定稿后完整重跑 registered-context，独立 output `test-results/integrate-r4-context-final`；tools tsc／最终 Biome | **13/13，2.8 分钟**，覆盖两个新边界及原完整上下文／故障／授权用例；tools 类型与全仓 lint 通过。日志 `/tmp/scholoom-integrate-r4-context-final.log`、`/tmp/scholoom-integrate-r4-volume-types.log`、`/tmp/scholoom-integrate-r4-final-lint.log`。13 项与上表重叠，不累加为不同用例 |
| 修复后架构、Biome、生成器 self-test、生成 patch 格式化比对及 `git diff --check` | 通过；13 模块／198 文件零架构问题；lint 零错误、74 warnings／35 infos；六份生成映射与 schema 一致 |
| OpenSpec | 两 active change strict 通过；正式规格普通校验 17/17，额外 strict 15/17，失败仅为 agent-harness／ui-workbench-shell 的既有长 Requirement 警告 |

本轮没有将固定样例的合成材料视为科研充分性，也未据局部回归完成最终三线组合。#10 固定头三平台 CI 仍失败，详见[工作域接收记录](../2026-10-23-establish-scoped-execution-foundation/delivery.md#第四轮-ci-修复接收)。旧库 UI 入口补齐仅有调查方案，未确认实施。

修复后的独立窄复核关闭两项 P2，无新增阻塞：只读核对当前／历史上下文重建、等待身份及授权，另用内存探针验证 201 条分批确认在第二批失败后保留已确认凭证并补齐；201 条历史加 1 条当前指令的传输探针最大帧 32921 字节。探针不替代主线真实 worker 回归。辅助测试委派未返回可用成果，主线停止该任务后复用原夹具实现两项回归，没有引入新 Graph 或测试框架。首次测试夹具误向 startGraph 传 materials 导致参数校验拒绝，已按正式入口移除；匿名测试子类返回类型过窄及一处可选链 lint 也已修正，未放宽生产校验或断言。

下一轮由本线担任当次最终整合负责人，先声明隔离配置并取得 apply instructions，推进 4.5 的全局会话读可信项目／库、工具查询变化后的工作台选择、可靠显式发送及固定图保存成果。领域线承担 4.4 的执行与失败组合，双方互引证据；本线再做 4.6 独立审查，按实际结果更新同一 delivery。4.7、归档和七域启动仍等待必要验收，不把 CLI ready 或本次 PR 接收当作完成。

### 第四轮 registered Graph 指令上下文

2026-10-23，开始前确认本树 HEAD 为 dev `e324367`、工作区干净，已包含用户指定基线。先读 AGENTS、scholoom-dev 阶段约定、公共基础实施规划、两条 active change 的最新 tasks／delivery，再取得 apply instructions。用户要求本轮独立接通 registered Graph 的完整指令上下文，提交、推送并向 dev 发 PR，最终组合留待领域夹具及隔离验证就绪；本轮未操作其他工作树或合入 dev，没有安装、升级或下载依赖。

新增原任务 **3.4** 记录这个独立前置增量，已完成，当前 **14/17**。原 4.5、4.6、4.7 仍未勾选；没有归档或启动七域。领域交接的 4.x 夹具／隔离／最终交付不由此增量代替，其 dev 接收事实见[领域交接第三轮记录](../../establish-domain-execution-handoffs/delivery.md#第三轮-dev-接收)。

- 复用共同 `InstructionContext`，补可选 text、materials、materialFileIds；source、contextItems 继续引用原同源声明。GraphFactory.resume 保留 id/text 形状并取得完整上下文。宿主只从所属会话的持久消息重建可信来源，不采信工厂或 worker 自报窗口。
- 已匹配指令经原 `execution.initialize` IPC 交给实际 worker。当前 instructions 与已核对的 checkpointInstructions 分开传递，后者只为旧 checkpoint／累计身份补齐上下文，不替换本轮匹配输入。旧 checkpoint 只有身份时从同会话持久消息补齐；已保存完整载荷与持久消息冲突则停止。
- worker 的原 InstructionSaver 按 checkpoint 中的 instructionIds 保存完整上下文及 instructionRunId，写盘成功后才调用原消费 IPC。宿主核对实际 checkpoint、完整载荷、等待 graphResume、指令归属及授权后才确认。保存失败不消费，确认失败或回执丢失沿原身份和 checkpoint 核查，不重放领域成果。
- registered worker 在创建工厂前核查最新 checkpoint、先持久补齐完整上下文再补交消费确认；终态已保存且无剩余节点时也可恢复，不依赖节点再次 put。普通 Agent 的原保存／确认路径保持。
- 受理、等待映射、恢复、worker 初始化及消费确认继续复查资源许可。Graph 与普通 Agent 复用原会话材料授权记录，模型排队前后和最后同步准入均复查，不能以切换执行路径、换批或纯文本续做绕过旧摘录的撤权。历史摘录保留原 basis，实际读取核对版本。
- 完整路径通过后移除 registered 消息附件的 unavailable 保护：显式项目／库材料、原项目路径／身份附件均实际进入映射、worker、checkpoint 和取材路径。文字输入及源码 `execution.materials` 保持独立。没有持久 checkpoint 的图仍拒绝非空初始化指令，普通 Agent 的直接初始化保护保留。

设计总览／数据流已同步[design.md](design.md)，完整行为补入原 delta spec；开发入口及界限见[开发说明](../../../../docs/development.md)。本轮不重建资源提供者、创建收据、Graph 等待机制或共同命令。生产源码 Graph 注册集合仍为空，测试宿主与 worker 的固定图是明确的源码注册夹具，不是已发布的科研方法。

## 实际验证

本节保留第四轮独立 Graph 增量的验证；第五轮组合与容量修复结果见上方第五轮记录。

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

本项约定任务 **17/17**，真实接收与验证见上方“主分支最终接收”，正式规格已同步，2026-10-24 已归档。本项不再分派工作树任务。公共基础剩余条件由领域及跨平台修复变更继续记录，不能以本项归档宣称全部公共基础完成或启动七域。固定图合成样本不证明科研充分性，真实外部模型、完整 UI、三平台分发安装与恢复仍未验收。
