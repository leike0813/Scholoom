# 实际交付与交接

## 当前状态与成果

### 第四轮 dev 接收

2026-10-23，用户要求处理三个工作树完成的新一轮任务。dev 在干净的 `e324367` 上保留原提交，依次以 `2ae82e8`、`356769b`、`c76df43` 合入 [#10](https://github.com/leike0813/Scholoom/pull/10)、[#11](https://github.com/leike0813/Scholoom/pull/11)、[#12](https://github.com/leike0813/Scholoom/pull/12)，无冲突。#11 的双实例隔离及独立夹具验证现已接入，#12 的 registered 完整指令上下文也已接入；本变更仍为 **16/19**，4.4–4.6 保持未勾选，没有归档或启动七域。

接收时在 Linux／Node 24.12.0／pnpm 11.10.0 复验：

| 实际入口 | 结果与范围 |
| --- | --- |
| 根 `typecheck`、`build`，均带 `--config.optimisticRepeatInstall=false`；架构、Biome、生成器 self-test 及格式化后生成映射比对 | 通过；13 模块、198 文件零架构问题，lint 无错误、74 warnings／35 infos，六份生成文件一致 |
| 内核 CLI，指定 registered-context、registered-graph、instruction-checkpoint、graph-registration、context-resources、context-instructions、context-query、harness-recovery、harness、resource-access、resource-creation、managed-commands | **101/101，10.4 分钟**；模型为 loopback 受控 HTTP，内部 broker／SQLite／worker／资源为真实提供者 |
| `SCHOOLOOM_UI_PORT=5351`，smoke development 单项 `--grep 'two renderer instances'` | **1/1，38.8 秒**；5351／5352 两配置真实实例，关闭 A 后 B 保持原身份且继续保存 |
| `SCHOOLOOM_UI_PORT=5353`，UI config 的 context-bridge、resource-opening、resource-lifecycle、writing-editor | Chromium／Electron **10/10，5.5 分钟**，覆盖显式发送及持久读回、迟到回执、共同资源与写作 |
| smoke entrypoints | **4/4，40.9 秒**，独立 Node、真实 Electron/preload、关窗重连及兼容宿主 |
| OpenSpec | 两个 active change strict 通过；正式规格普通校验 **17/17**。额外 strict 校验 **15/17**，agent-harness／ui-workbench-shell 的既有长 Requirement 警告升级为失败，未为消除警告改写无关契约 |

上述 101 项、双实例及双宿主结果属于三个 PR 合并后的源码；独立审查随后发现并修复的累计指令／IPC 容量边界、修复后受影响回归与审查结果统一见[工作台第四轮 dev 接收](../establish-workbench-context-bridge/delivery.md#第四轮-dev-接收)，不把修复前结果表述为修复后重跑。日志 `/tmp/scholoom-integrate-r4-{kernel,isolation,ui,entrypoints,typecheck,build,lint}.log`，工件为 `test-results/kernel` 及 `test-results/integrate-r4-{isolation,ui,entrypoints}`；本轮测试只收尾所属执行，5351–5353 最终无监听，未操作其他工作树或其 Agent。

4.4 的显式输入至实际成果查询、取消／关联部分失败／worker 失联组合仍需本线完成；4.5 安排执行协议、资源授权及命令收尾的独立模块审查。工作台线为下一轮当次最终整合负责人，承担其 4.5 的用户路径，双方互引证据及待接入修复，不重复实现公共 runtime／driver。完整内核／UI、真实模型科研充分性及三平台分发未验；#10 固定头的三平台 CI 仍失败，工具修复与剩余失败见[工作域记录](../archive/2026-10-23-establish-scoped-execution-foundation/delivery.md#第四轮-ci-修复接收)。

### 第四轮隔离夹具与双宿主验证

2026-10-23，开始前确认 HEAD 为 `e324367`、工作树干净；已读取 AGENTS、开发说明、scholoom-dev 阶段约定、最新 tasks／delivery 及 apply instructions（ready、13/19）。用户授权直接完成 4.1–4.3、提交推送并向 dev 发新 PR，不自行合入或操作其他工作树。本轮完成本树验收，进度 **16/19**；4.4–4.6 继续未完成。此前的 Graph 恢复与实例／资源授权修复保持原样，registered 完整指令上下文仍由工作台线交付。

4.1 的可配置 URL／fixture 已在前序 dev 增量接入，本轮沿 `renderer-url.ts` 和原 smoke 进程助手补实际双实例回归。两个真实 Vite／内核使用 5341／5342、独立 profile、文献库、项目与成果路径，以及不同内核身份和 WebSocket 地址。分别经 UI 创建项目与保存 `result.md`；库材料通过所属真实 API 准备，UI 只显示自己的材料，公共查询也读不到另一配置的项目／库记录。关闭 A 后核对其内核已停止，B 保持原实例身份，刷新后再次保存且 A 原成果不变。结束只收尾本轮进程；5341–5344 最终均无监听。该用例在同一源码树内模拟并行开发实例，不使用另一个工作树；双宿主另由既有 UI suite 验证。

4.2 复用现有 `graphs.mjs`／`worker*.mjs`／`command.mjs`，没有新增通用测试框架。固定 counter 的 custom 回报为内联测试提供者；resource／durable-resource 使用真实内部资源、项目文件及子进程，持久图使用真实 SQLite、interrupt 与消息恢复；模型变体检查实际额度租约，不伪装外部模型生成。命令机制的 workspace／authorize 可为明确替身，broker 组合核对真实活动会话及实例。独立只读调查核对七域入口后，开发说明补齐这些构造形状、运行命令与边界，并改正“项目创建提供者待接入”的过时描述。内存窄端口替身受类型检查，broker／IPC 保留同源运行校验。生产注册仍为空，不把固定图作为科研方法。

核对 [design 总览](design.md#变更总览)：本轮实际覆盖固定 worker／资源及共同命令路径、独立配置与宿主接入；没有据这些样例宣称显式上下文最终组合或科研质量通过。没有改 runtime、driver、beforeModel、工作台来源或 composer。

| 实际命令／组合 | 结果、失败及证据边界 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck`、同选项 `build` | 全仓构建及最终类型检查通过。首次 tools 检查发现新用例误用内部 `projects.list`，改用公共 `workbench.watch` 投影后重跑通过；日志 `/tmp/scholoom-r4-{typecheck,typecheck-final,build}.log` |
| 同选项 `generate:contracts`、`check:architecture`、`lint`；生成器 `--self-test` | 六份生成 patch 格式化后与源码一致；架构 13 模块／198 源文件零 findings／例外；lint 无错误，保留基线 74 warnings／35 infos。相关文件 Biome 与 `git diff --check` 通过 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts` 加下述 18 文件 | **120/120，8.1 分钟**。真实内部图／文件／SQLite／资源／程序，外部模型为 loopback 受控响应。日志 `/tmp/scholoom-r4-kernel.log` |
| `SCHOOLOOM_UI_PORT=5341`，同 CLI `tests/smoke/development.spec.ts --grep 'two renderer instances'` | 首次通过；独立审查后增加写入前实例身份断言，最终复验 **1/1，37.5 秒**。工件 `test-results/r4-isolation-final` 的 `isolated-instances` 附件记录非凭据身份与路径，日志 `/tmp/scholoom-r4-isolation-final.log` |
| `SCHOOLOOM_UI_PORT=5343`，UI config：resource-opening、resource-lifecycle、writing-editor | 首轮 **5 通过、1 失败，3.4 分钟**。三 renderer 并发期间浏览器首个 lifecycle 在 goto 的 15 秒页面加载期限超时，未进入业务断言；其余 Chromium／真实 Electron 的资源与写作场景均通过。原 trace 保留于 `test-results/ui-5343` |
| `SCHOOLOOM_UI_PORT=5344`，同 UI config 仅 browser resource-lifecycle | 未改测试断言，独立配置复验 **1/1，30.6 秒**；日志 `/tmp/scholoom-r4-ui-recheck.log`、工件 `test-results/ui-5344`。两轮合计 6 个不同双宿主场景均取得通过结果，不宣称首次 suite 全绿或冷启动性能已解决 |
| `tests/smoke/entrypoints.spec.ts --output test-results/r4-entrypoints` | **4/4，38.4 秒**；独立 Node、实际 Electron/preload、关窗重连及兼容宿主。日志 `/tmp/scholoom-r4-entrypoints.log` |

120 项内核文件为 resource-access、resource-creation、resource-identity、harness、harness-recovery、harness-module、context-instructions、context-resources、registered-graph、graph-registration、research-module、research-capabilities、project-backend、managed-commands、process-admission、platform-processes、editor、editor-runtime，均位于 `tests/kernel/`。包含 dev 的 101 条指令接续、收据缓存／重命名竞态、发布依据、等待分页、普通 Agent 切图、最终模型授权和启动后派发前撤权等保护，不另改实现。

独立审查发现隔离用例只看 HTTP 可达可能在端口占用时误用已有 renderer 的 P2，现复用原连接状态实例身份检查，在 UI 业务写入前匹配所属 profile 的真实 endpoint；新增检查后的实际回归通过，独立窄复核确认关闭 P2。真实内部提供者未用成功替身代替。全程使用已有依赖、Electron 44.5.1、Chromium、Quarto／LaTeX，Linux／Node 24.12.0／pnpm 11.10.0；没有安装升级依赖。webServer 与 smoke 启动命令显式关闭 pnpm optimistic repeat install，测试服务均按归属结束。

本轮未跑完整 UI／完整内核、Windows／macOS 分发或真实外部模型／科研质量。UI 首次冷加载期限失败如实保留；这批通过不替代 registered 完整指令上下文与三线最终组合。后续由工作台线先交付该上下文增量并经 dev 接收，再按 4.4–4.6 安排整合与独立验收。

### 第三轮 dev 接收

2026-10-23，用户要求接收三个工作树的新 PR。dev 保留原提交，依次以 `6db64cc`、`d5e0240`、`1dd5e00` 合入 #7、#8、#9；application／manual 的冲突同时保留 Graph 启动、命令工作空间和可信指令受理检查。已接入持久 Graph 等待／恢复、共同命令资格和生产工作台资源授权。本变更 **13/19**，工作台 **13/16**；最终整合、双实例和交付项继续未完成，未归档或启动七域。用户仍手动同步其他工作树，本轮未控制它们的 Agent。

接收时独立审查发现两项 P2，并用真实内部接线复现：资源强版本含 ctime，移动后旧待关联收据不能恢复；registered 图接受显式材料却只向工厂传递文字，可能消费未交付附件。前者在原关联收据中先保留强版本，核验当前 fileId／强版本后原子保存发布 basis，再按核验返回的身份和位置关联；实际资源读取继续用强版本，不放宽内容检查。旧证据无法核验时保留 unknown。后者在受理前拒绝非空 contextItems／旧材料附件，原文字等待和源码入口的 execution.materials 保持可用；完整 Graph 指令上下文仍需在最终组合前接线，不据这项保护宣称完成。

Graph／命令的后续独立审查另确认两项 P1、两项 P2：启动等待期间撤权仍派发命令；registered 模型额度交付前缺同步授权；普通 Agent 切图复用旧尝试；前 100 条未匹配消息挡住后续有效输入。唯一命令提供者现在在 worker 启动后、派发前同步复查授权和工作空间／程序绑定，拒绝后仍确认实际停止。Graph 和普通 Agent 的最终模型检查复用宿主资源检查，核对来源外发、库 read/send 与目标实例；库使用标记来自原会话记录，不由 worker 自报。图选择把普通 Agent 旧尝试视为不兼容，另建 run；等待输入按 seq 游标每页最多 100 条匹配，未匹配项不消费。原六项发现均经只读窄复核确认封堵，无新增必修项，真实运行由主线完成。

| 实际入口 | 本轮接收证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck`、同选项 `build` | 全仓通过；最后 runtime 修复另编译 harness 并检查 tools 类型。未安装升级本机依赖。 |
| Biome、check-architecture.ts、contract-types.mjs --self-test／--patch | lint 无错误，74 warnings、35 infos；13 模块／198 源文件零 findings／例外；生成器自检通过，六份 patch 格式化后与源码一致。 |
| OpenSpec 正式 specs、两个 active change strict validate | 17/17 正式规格及两个变更通过；工件有效不代表最终交付。 |
| 内核 context、registered-graph、harness／恢复、资源／创建、目标只读、命令／进程、editor 等 19 个文件 | 合并后首轮 **114/114**，8 分钟；实际 worker、IPC、SQLite、文件、准入及已有 Quarto／LaTeX 接线，模型为 loopback 受控响应。 |
| 新增资源移动／registered 附件保护边界及原资源／harness／创建回归 | 旧实现 **2 项均失败**，分别复现无法关联与错误受理。移动测试的历史查询改用实际路径后，四文件 **38/38**，3.3 分钟，包含 101 收据及原未知效果保护。 |
| 启动取消／撤权／重绑、普通 Agent 切图、模型最终撤权、100 条等待消息 | 旧实现取消用例通过，另五项失败；等待消息首轮误查有界 snapshot 中已翻页的旧消息，调整检查时机后独立复现实际无法恢复。修复后 **6/6**，34.9 秒；模型额度未交付、程序 marker 未创建、不同 runId 和后续输入完成均核对。 |
| 最终 runtime／宿主／命令修复后的 11 文件组合 | **89/89**，5.6 分钟：registered-graph、managed-commands、context-resources、context-instructions、harness-module、model-access、process-admission、platform-processes、editor、resource-access、harness。全仓 typecheck／build 再次通过；各组存在重复复验，不相加当作独立用例数。 |
| 双宿主 context-bridge、resource-opening、resource-lifecycle | **8/8**，3.8 分钟；浏览器和真实 Electron 的附加／发送／模型取材／刷新／迟到回执及资源生命周期。隔离端口 5299，沿既有 fixture 收尾。 |
| 同步授权最终修复后双宿主 context-bridge | **4/4**，2.1 分钟；使用新隔离端口 5300，重新验证实际附加、发送、取材、刷新与迟到回执，结束后 5299／5300 均无监听。 |
| `tests/smoke/entrypoints.spec.ts` | **4/4**，36.8 秒；独立 Node、真实 Electron/preload、重连及兼容宿主。 |

CI #7 的实跑日志另确认准备工具失败：Linux／Windows 在 Quarto action 的 TinyTeX 步骤后找不到 tlmgr，macOS 要求更新管理器。接收修复改用 [r-lib setup-tinytex](https://github.com/r-lib/actions/tree/v2/setup-tinytex) 添加实际工具目录，在安装 latexmk 前更新 tlmgr，Quarto 仍固定 1.9.37。YAML 用已有 parser 解析并核对矩阵、顺序及原测试步骤；没有在本机安装 TinyTeX。依据为 [#7 CI](https://github.com/leike0813/Scholoom/actions/runs/39922558883) 和上游 action README，尚不据静态核对宣称三平台 CI 全绿。

本机 Linux、Node 24.12.0、pnpm 11.10.0，使用现有 Electron 44.5.1 和工具链。命令日志在本机 `/tmp/scholoom-integrate-r3-*.log`，对应测试工件在 `test-results/integrate-r3-*` 和 `test-results/ui-5299`、`ui-5300`；格式化／生成比对 payload 留在系统临时目录，不进入产品或依赖。未跑完整内核／完整 UI、双实例、Windows／macOS 分发、真实外部模型、科研质量或最终三线组合。旧 library／attachments 用例涉及正式规格要求但当前 renderer 缺失的授权、摄取、编辑及库备份入口，未通过删除断言或改走内核调用伪装 UI 通过；后续须按产品／规格缺口处理。前序 CI 记录的 macOS 产物路径／file-watch 失败也未在本轮跨平台复验。

### 第三轮 Graph 增量（待 dev 接收）

2026-10-23，开始前确认当前工作树 HEAD 为 `9c8212f`、无未提交改动。用户授权本树实施、独立提交、推送并向 dev 发 PR；不自行合入、不操作其他工作树。2.3、2.4 先独立实现及实跑，以 `b279803`、`6def640`、`641ceb7` 推送并发出 [PR #8](https://github.com/leike0813/Scholoom/pull/8)，供 dev 独立审查；工作台等待状态映射另以 `40aa011` 补齐。随后完成 3.1、3.3，当前 tasks 为 **13/19**。PR 尚未合入，最终组合及双实例验收仍待后续，不宣称已接入 dev。

宿主通过内部 `harness.startGraph` broker 接纳源码登记图，公共 `session.send` 继续当前图的等待。原 runs 保存身份／版本／配置／材料依据／状态格式／checkpoint 绑定，查询返回 graphProgress 及 waitId；工厂只将明确匹配的新消息转为已声明 schema 的 resume，未匹配消息保留未消费。真实 InstructionSaver 在 checkpoint 保存后确认消费，保存输入后的确认失败可重启重试，不重复创建成果；待消费指令仍走原记录和回执。无新增数据库或交付事实源。

registered 路径复用 RemoteAgent、静态 driver、当前实例、ProcessAdmission、ModelAccess 和 broker 资源提供者；不改变默认 Agent 的 beforeModel／contextItems 来源。确定性图无凭据也可执行；需要模型的源码图共用现有额度。重启只读取等待；原版本不可用拒绝普通接续，显式新版本另建尝试且保留旧 checkpoint 与文件。resume 缺少原 checkpoint 时停止，禁止从头执行。图等待同时核对持久 graphWait 和实际 interrupt，不接受仅有投影的等待回报。

`tests/kernel/registered-graph.spec.ts` 的 10 项边界全部通过：normal、ack、upgrade、lost-wait、missing-checkpoint、materials、model、budget、cancel、revoke。固定 StateGraph 在实际子进程读取真实项目材料、从不存在路径创建成果、interrupt 等待并由新消息继续；实际文件／SQLite／资源仓储均沿内部提供者。测试宿主源码集合为夹具，生产默认集合仍为空；额度用例只调用真实 acquire/release，不向外部模型发请求。该组与 context-instructions、instruction-checkpoint、graph-registration 组合共 22/22 通过，包含 101 条原 Agent 指令及消费确认故障。

独立只读审查关闭了恢复时旧指令身份误拒、材料依据兼容遗漏、checkpoint 缺失重放、取消后回写等待及 SDK 单对象 interrupt 校验问题；最终窄复核无剩余明确阻塞。格式清理后 harness/kernel 编译通过，相关 75 个源码／测试文件 Biome 通过。命令接线与更广回归随后独立记录，Graph 增量先交付审查。

### 第三轮共同命令及最终本树验证

3.1 由 editor 实际消费 `platform.command`，tool 在原命令适配中映射为登记 executableId，原 editorCommand 保持薄适配。宿主沿 editor 私有工作空间及 Quarto／latexmk 程序登记，不开放通用 Shell。Agent principal 必须对应 session，工作域／项目／执行身份相符；宿主在准入前及排队后调用现有 harness.checkExecutionContext 和项目授权。人工 editor 组合不要求 harness。测试宿主仅覆盖私有工作空间描述以登记固定 Node；内部 broker、当前会话、授权、文件和进程均真实，受控模型只维持活动会话。

3.3 扩展既有 managed-commands 与 process-admission，复用 platform-processes 和 editor-runtime。排队撤权、取消、撤销后无 signal 的旧实例、真实全局会话、伪造模块／工作空间／程序及目标只读范围均被拒绝。输出溢出、进程树后代、宿主退出与控制器失联走真实进程；未确认停止继续占用名额。独立审查复现启动期间取消仍派发命令的 P1，已在唯一 runCommand 启动后、发送前再次检查 signal，异常仍等待 finally 的真实停止；红测确认旧实现写入 marker，绿色断言文件未创建且占用归零。最终窄复核关闭 P1，无新增阻塞。

本轮验证使用现有工具，无安装升级依赖；模型／临时进程按测试归属收尾。Linux、Node v24.12.0，真实 Quarto／LaTeX 沿本机既有安装。结果如下：

| 命令或组合 | 结果及证据 |
| --- | --- |
| Playwright kernel：registered-graph、context-instructions、instruction-checkpoint、graph-registration | 22/22；确定性图、持久等待、消费回执、101 条指令及原 worker 注册 |
| 同入口：harness、harness-recovery、capability-isolation、capability-stop-unknown、resource-identity、resource-creation、target-races | 39/39，3.9 分钟；原恢复／未知效果保护、101 份创建收据遗漏及重命名竞态继续通过。日志 `/tmp/scholoom-r3-graph-regression.log` |
| 同入口：managed-commands、process-admission、platform-processes、platform-command-contracts、editor-runtime | 最终 23/23，27.7 秒；日志 `/tmp/scholoom-r3-commands-green.log`。启动取消红测 `/tmp/scholoom-r3-start-cancel-red-final.log`；初次全局会话用例误等第二份模型额度，改为核对真实活动实例，未放宽授权断言 |
| 同入口：registered-graph、editor、resource-access | 25/25，2.4 分钟；最终 Graph 复验、人工真实转换／HTML／PDF／DOCX／多文件 LaTeX、资源撤权及仅补原身份关联。日志 `/tmp/scholoom-r3-live-final.log` |
| 依赖顺序直接执行 13 个 workspace 包原 build／typecheck scripts；tools tsc | 13 包构建通过。首次类型检查发现 waiting 缺少工作台状态映射，补原位置“等待输入”后 desktop／兼容宿主及 tools 复验通过；状态显示不改来源、contextItems 或 composer。日志 `/tmp/scholoom-r3-all-build.log`；最终宿主重建 `/tmp/scholoom-r3-build-tail.log` |
| contract-types.mjs --patch 格式化后比较、--self-test | 生成结果一致，自检通过；未改无关生成映射 |
| check-architecture.ts、相关文件 Biome、tools tsc、git diff --check | 13 模块、198 源文件、0 findings；格式及类型通过 |

工作树没有新增科研方法、计算域运行记录或通用命令入口。未运行双实例、双宿主 UI、真实外部模型／科研质量和三平台分发验收。最终公共基础组合、工作台线上下文授权接入及 dev 接收结果仍按 tasks 的 4.x 跟进，所有该组勾选保持未完成。

### 第二轮 dev 接收

2026-10-23，用户要求接收三工作树新一轮 PR。dev 保留原提交依次合并 #4、#5、#6，合并提交为 `b39292a`、`fa77d2e`、`a9d8afe`。工作域 change 已同步正式规格并归档；本变更的真实执行资源适配、保存／关联及首次创建已接入 dev，1.2 完成，tasks 为 **9/19**。工作台的指令来源、显式项持久化及多来源查询也已接入，但生产显式材料资源提供者仍待工作台线绑定。未同步其他工作树或控制其 Agent。

接收修复包括：合并后的模型外发同步检查同时保留目标实例核对和显式项授权；同一 run 已注入 100 条指令时把剩余指令留给下一 run，只确认实际注入项，原受理回执保持稳定；恢复项目仍独占预留目的目录，再复制缺失子项，避免新版 Node 对已存在根目录报 EEXIST；编辑器构建路径使用 `fileURLToPath`；库列表 option 语义同步六处 UI 定位，移除未与 tab 关联的 tabpanel 声明并更新 UI 设计文档。

| 实际验证入口 | 接收结果及边界 |
| --- | --- |
| 全仓 typecheck、build、Biome lint、架构守卫 | 通过；原 21 项库 UI lint 错误已由 #4 清除。架构为 13 模块、198 源文件、零问题和例外。未安装升级依赖。 |
| 契约生成 patch 与源码格式化比对、生成器 self-test；全部正式 specs 及两个 active change strict validate | 同源映射无漂移；正式规格 17/17，变更结构验证通过。 |
| 完整 `playwright.kernel.config.ts`，341 项 | 首轮 335 通过、2 跳过、4 失败；脱离其他验证负载单独复验仍失败，随后按下述证据修正测试。资源授权、首次创建、未知核查、保存／关联、备份恢复及 101 条指令回归均已通过。 |
| development、document-integration、literature-attachment-integration、research-capabilities 的上述 4 项定向诊断与最终复验 | 诊断 4/4；移除日志后的最终复验 4/4，56.1 秒。Vite 生命周期测试禁用与其目标无关的 renderer 依赖扫描后用时 12 秒；另三项观察到正常 worker 启动、全部预期工具请求及最终成果，原 5 秒等待不足。仅将这三处集成等待设为 20 秒，不改产品期限和原行为断言。 |
| 内核 context-instructions、graph-registration、harness-recovery、harness、resource-access、resource-creation | 46/46，4.4 分钟。包含收据缓存遗漏修复；其后重命名竞态的最终修复经 malformed-provider／101 收据用例复验 2/2，16.9 秒，再复验真实图取材／首次创建和关联后重启核查 3/3，23.4 秒。最后改动重新编译 harness 并通过 tools 类型检查。 |
| `tests/smoke/entrypoints.spec.ts` | 4/4，36.5 秒；真实 Node、Electron/preload 及兼容宿主入口。 |
| 双宿主 resource-opening、resource-lifecycle、reading-records、pdf-reading、document-reading | 首轮 10 通过、2 浏览器初始连接／导航超时；Electron 全通过。浏览器 document-reading 单独复验 2/2，54.8 秒，无需放宽 UI 超时。共 12 项各有通过证据，不宣称完整 UI 套件通过。 |

本机为 Linux、Node 24.12.0；外部模型使用 loopback 受控响应，资源／文件／仓储、worker 及 IPC 为真实内部接线。UI 使用隔离端口 5296、5297 与所属临时配置；结束后均无监听。日志位于 `/tmp/scholoom-r2-{kernel,kernel-recheck,kernel-probe,kernel-final,smoke,ui,ui-browser-recheck}.log` 和 `test-results/pr-round2-*`／`test-results/ui-5296`、`ui-5297`。完整内核首轮与各项复验分开记录，不把定向复验称为整套重跑。

独立审查发现并复核关闭 100 条后指令溢出造成接续循环的 P2，真实 worker 回归核对两个 run 的 checkpoint 分别保留 100／1 条，重试第 101 条仍返回原回执。资源审查另发现并关闭两项 P1：启动只缓存前 100 份待关联收据，未缓存时的旧路径分支可能把替换文件认领为旧成果；定位原路径后遇到并发重命名，又可能混用替换文件身份与原文件 basis。现保留启动缓存上限，核查时按需流式查找磁盘原收据，只缓存本次至多 100 个请求路径；缺失／损坏／缺 basis 均保持 unknown，仅可复用原有已关联记录。补关联直接使用按原 fileId／basis 核验后的路径与身份，删除多余路径读取。真实文件和 SQLite 故障用例扩展到 101 份收据，旧实现两次分别复现遗漏及重命名竞态，最终回归通过；原 malformed-provider 无原依据时也应保持 unknown，文件不删除、不重写。独立只读复核确认两项均封堵，无新增必修问题；实际运行由主线完成，审查本身不替代实跑。

收据诊断与复验日志另见本机 `/tmp/scholoom-r2-receipt-{red,green,final,race-red,race-green}.log`、`/tmp/scholoom-r2-resource-final.log`。第一次绿色尝试的 101 收据用例因读取有界 snapshot 而未看到已关联项，随后改为核对所属项目的持久关联，未放宽身份断言；最终 46 项及竞态复验通过。

未运行真实 Windows／macOS、Node 24.21 或三平台分发包；Windows 路径修复另用 Node 标准 URL 转换自检。已知 CI 还缺 Quarto／LaTeX 工具，旧 library／attachments UI 用例仍依赖已移除入口，未在本轮恢复产品功能或调整依赖。真实模型、科研充分性、双实例隔离、持久 Graph／共同命令完整接线和公共基础最终组合仍待验收；不据本轮局部接收勾选最终交付项或启动七域。

### 工作树提交时的交付依据

2026-10-23，续做基线 `ed35c59`：1.2 资源适配已作为独立提交 `a09c3a0` 推送并向 dev 发出 [PR #5](https://github.com/leike0813/Scholoom/pull/5)。实际合入前 1.2 保持未勾选；随后实施的 1.3、1.4 已在本树验证，tasks 为 8/19。本轮未合入 dev、未操作其他工作树。宿主 `executionResources(context)` 经 broker 复用 ResourceAccess、本项目条件保存和目标只读提供者，无资源视图前置。库材料仍为只读，必须同时具有 read/send；目标必须以已登记 fileId 读取，不能用路径登记或写入。交付前后检查来源／目标信任及当前执行实例，后续模型请求沿既有会话上下文重新授权。同一执行信号共享目标实例绑定，重开项目不能替换已读来源。

资源适配独立提交前的 15 项组合回归通过，含库 send 撤权和目标实例替换后阻止第二次模型请求。1.3 使保存返回发布时实际 fileId／basis，执行保存与关联分别返回；普通 Agent、能力子执行和资源端口共用原产物回执，关联失败不重写文件。1.4 在原 `file_operations` 的可选 JSON 收据中保存创建主体、输入、editId／fileId、候选物理身份及依据，目标路径和操作身份共同串行。候选同步后硬链原子发布，文件身份、历史及完成状态在同一事务登记；重启仅核查原发布，不按相同路径或内容认领替换文件。物理表结构未变，无新增数据库迁移。备份清单说明候选缺失，恢复副本保持未知且不重放。

固定 `fixed-resource` StateGraph 仅在测试宿主登记，真实子进程通过已绑定端口读实际材料，并从不存在的路径创建成果；重复推进不重复创建。测试宿主将 IPC 请求绑定到已活动的可信会话，实际文件、库、仓储和解析器均为真实提供者，外部模型为受控 HTTP 响应。该证据覆盖首次创建资源路径，不代表 2.3 的持久 Graph 等待、2.4 的生产 registered 尝试接线或真实科研验收。

本轮直接使用现有工具链，没有安装升级依赖。64 项组合内核回归通过，覆盖资源、首次创建、同操作并发、目标竞态、工作域、普通 Agent、能力隔离、项目保存／备份及历史契约。另对最终 worker 保存结果契约做定向复验；同源执行保存使用 `ResourceSaveResult`，人工保存保持 descriptor。构建、类型、架构与审查证据见下。

以下保留 dev 接收时的历史结果，资源部分的后续状态以上述续做记录为准。2026-10-23，用户要求当前 dev 收回三个工作树的 PR。PR #2 的四个提交（2f15047、2d6c721、c994fe7、f27a16a）以 0e5e167 合入；三个 PR 的组合源码基线为 efc9429。通用 driver 的真实接线和回归已接入 dev，2.2 完成，当时 tasks 为 6/19。持久等待和完整整合仍未完成，不能归档。

工作域真实授权也已随 PR #1 接入同一 dev，本变更 1.2、1.4、2.4、3.3 的工作域前置现已满足；统一执行资源适配和业务图接线仍需本线实现。工作台线已交付连接／草稿增量，但未接通显式项执行。依赖和共享文件归属继续沿[公共规划](../../../.scratch/domain-development/public-foundation-plan.md)。本轮未同步其他工作树或操作其 Agent，用户将手动同步。

以下保留 2026-10-22 在 fe2f0bc 上独立实现的证据及当时边界。原用户已授权本线实施、提交、推送和 PR；本轮授权接收、修复冲突、验证及更新 dev。

| 任务与入口 | 本次实际成果及边界 |
| --- | --- |
| 2.1，harness/graph-registry.ts、kernel/execution-graphs.ts | `ExecutionGraphs` 将源码定义、版本、配置 schema 与工厂放在同一登记中；宿主与 worker 引用同一集合。未知图、错误版本和非法配置在构造前失败，非法入口字段由同源 IPC schema 拒绝。生产集合为空，固定样例仅在测试宿主装配。 |
| 2.2，harness/execution-driver.ts、execution.ts、remote-agent.ts、runtime.ts、kernel/execution-worker.ts | 提取可静态装配工厂的 `startExecutionWorker`；旧入口保持薄调用，完整宿主为根和能力子执行注入受控 worker URL。默认模型、工具、checkpoint、健康、停止、准入与退出回执继续沿原机制。图结果校验同源结构及 attemptId，停止后拒绝继续推进。2026-10-23 已接入 dev，并通过合并后普通会话、子执行、恢复及 IPC 回归。 |
| 2.5 | 原普通会话、材料分析、工具效果、实例失效、容量不足、压缩和恢复通过实际 worker 回归。同步修正旧故障夹具对执行入口的匹配。 |
| 3.1／3.2／3.3，kernel/commands.ts、manual.ts | `ManagedCommands` 统一私有工作空间、程序登记、消费模块校验、排队重验、取消及进程释放；editorCommand 为薄适配，人工排版继续独立于 harness。范围检查拒绝全局／目标只读及不一致执行身份；前序真实工作域增量已进入 dev，本线仍须接入并验证命令的有效实例授权。3.2 完成，3.1／3.3 保留真实接线验收。 |
| 4.1，playwright.ui.config.ts、tests/ui/renderer-url.ts、fixture.ts 及 17 个 spec | `SCHOOLOOM_UI_PORT` 统一 renderer URL，缺省 5174；所有导航与权限 origin、baseURL、webServer、Electron 共用。端口占用失败，不复用其他实例；输出按端口隔离，profile 仍逐轮新建。2026-10-23 源码已接入 dev，仍未实跑双实例。 |
| 4.2，tests/fixtures/domain-execution-worker、docs/development.md | 固定两节点 StateGraph 验证真实 SDK／IPC、无模型完成和注册拒绝；固定 Node 程序验证实际输出和进程树收尾。新增七域独立接入说明，复用现有测试组合。材料读取、首次创建和等待夹具仍未完成。 |

`GraphDriver` 是源码装配 seam，SDK 对象留在 worker。当前固定计数图的宿主只接收节点回报，没有取用业务材料或保存科研成果；固定命令的工作空间和授权回调为明确测试提供者。harness 仍拒绝未接通的 registered 持久尝试、resume 和结构化上下文，不将其静默转成默认 Agent。

[design 总览图](design.md#变更总览)仍是完整目标：本轮接通 driver／工厂装配和共同命令机制，资源、首次创建及等待恢复边仍待实现。项目／库事实、创建收据、材料读取和科研交付没有新增第二份权威。

## 实际验证

本次 `ed35c59` 后增量的验证入口：

| 实际入口 | 结果与范围 |
| --- | --- |
| 按依赖顺序直接执行 13 个 workspace 包原 `build` scripts，再执行各包 `typecheck`；`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 通过，包含桌面及兼容宿主生产构建；全程不用 pnpm 安装入口。最终共享代码调整后复验通过，构建日志位于本机 `/tmp/scholoom-build-imvQHp/`。 |
| `node scripts/check-architecture.ts` | 13 模块、197 源文件、0 findings、0 exceptions。候选文件访问在 projects 受控适配中声明；harness 经同源只读字节端口核查回执。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts` 加 resource-access、resource-creation、resource-identity、graph-registration、project-files、project-backend、public-contract-baseline、harness-module、harness、capability-isolation、target-races、work-domains | 64/64，2.9 分钟。实际硬链／文件身份、SQLite trigger 登记失败、回执丢失后的重复提交、重启仅补关联、同路径同内容替换、恢复副本、取消和撤权均覆盖。 |
| 同入口定向 public-contract-baseline、execution-files、graph-registration | 8/8，20.3 秒；最终 worker 保存结果同源契约与实际 worker 回归。随后资源端口身份／排队取消和撤权的 2 项定向复验通过。 |
| `node packages/protocol/scripts/contract-types.mjs --patch`、`--self-test` | 已重新生成并按 Biome 格式核对，仅接入 project-harness 的只读字节端口映射；自检通过。 |
| 改动文件 Biome、`git diff --check`、`openspec validate establish-domain-execution-handoffs --strict` | 通过；全仓 UI lint 的既有问题不在此声称修复。apply instructions 确认 8/19、ready，1.2 仍等待实际 dev 接入。 |

本轮未启动 UI 服务，未运行双实例／双宿主 UI、真实模型、科研充分性或三平台分发验收。

环境为 Linux、Node v24.12.0、pnpm 11.10.0，模型响应为受控 HTTP 夹具，无真实模型调用。测试使用隔离配置、项目、库与输出，收尾仅处理本轮拥有的进程。未启动开发服务器。

环境操作有两项偏离授权边界：首次 `pnpm build:shared` 在执行脚本前自动安装了工作树缺失的锁定依赖；随后查询 Electron 路径时，入口模块自动下载了运行时。两项均未提前取得安装授权，已向用户说明。依赖声明和锁文件未变；后续构建、类型与测试直接调用现有工具，未运行 setup 安装脚本，也未擅自删除已安装内容。

| 实际入口 | 结果与范围 |
| --- | --- |
| `pnpm build:shared` | 共享构建通过；包含上述意外依赖安装。 |
| 按依赖顺序直接执行 13 个主 workspace 包原有 `build` scripts | 全部通过，包含桌面与兼容宿主生产构建；等价覆盖根构建的实际包脚本，未再次调用 pnpm 安装入口。保留既有兼容宿主缺少 preload 配置提示。 |
| 直接执行各包原有 `typecheck` scripts；`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 全部通过，含实际调用方和类型反例。 |
| `node scripts/check-architecture.ts` | 13 模块、191 源文件，0 findings、0 exceptions。原生适配声明随 async_hooks 移至 execution-driver.ts。 |
| `node packages/protocol/scripts/contract-types.mjs --patch` | 运行成功，仅输出已有格式差异；本轮未修改协议操作，未引入无关生成文件改动。 |
| `node packages/protocol/scripts/contract-types.mjs --self-test` | 通过。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts` 加下表文件 | 72 个不同用例最终通过；重复定向复验不计入该数。 |
| `node node_modules/@playwright/test/cli.js test tests/smoke/entrypoints.spec.ts` | 4/4，36.6 秒；独立 Node、真实 Electron/preload、窗口重连和兼容宿主。 |
| UI config `--list`；直接导入 renderer-url 的 assert 自检 | 默认及 5275 配置各加载 104 个测试，另检查默认、5175、65535 及空串、0、超界、非数字、小数端口。未启动服务或执行 UI。 |
| `node node_modules/@biomejs/biome/bin/biome check` 本轮 42 个源码／测试文件；`git diff --check`；OpenSpec strict | 通过。 |

内核定向用例均位于 `tests/kernel/`：

| 文件组 | 不重复用例数及证据 |
| --- | --- |
| managed-commands、editor-runtime、process-admission | 13；实际 Node、输出边界、排队撤权／重绑定、取消及后代停止、控制丢失保留占用，既有缓存和最后成功预览 |
| editor、platform-processes | 9；真实 Quarto/Pandoc HTML／PDF／DOCX、多文件 LaTeX、冲突保护、实际进程和宿主 SIGKILL |
| public-contract-baseline、resource-access | 8；历史 DTO、未接线保护、原资源身份／版本／条件保存及真实 PDF／EPUB／HTML 解析 |
| graph-registration、execution-isolation、harness-module、research-module | 11；宿主／实际 worker 的注册拒绝、两节点 StateGraph 无模型完成、工具效果未知及模块独立组合 |
| capability-isolation、capability-stop-unknown、harness-recovery、sessions | 24；能力崩溃、停止未知、checkpoint 保存／确认失败、真实压缩、重启、scratch 隔离与会话配置 |
| execution-capacity、cancel-admission | 7；父子容量、等待撤回、PDF 准入、控制失联和异步撤权 |

共同契约基线的既有证据继续保留：此前 `pnpm generate:contracts` 的输出按 Biome 格式化核对并用 apply_patch 接入，`pnpm check:architecture` 为 13 模块／186 源文件零问题，`pnpm typecheck`、`pnpm build`、33 项定向内核和 4 项入口冒烟通过。该轮只交付 0.1／1.1，同源声明包括 ResourceEvidence、创建／查询结果、Graph 绑定／resume 和内部命令；不会据此前契约通过宣称本轮缺失的真实提供者可用。

## 审查与问题处理

本次资源授权及创建／关联增量经独立 Agent 只读审查。发现并关闭两项 P1：资源读取与后续模型外发未共享目标实例绑定；普通 Agent／能力子执行丢失保存 basis。前者由同执行信号共享目标绑定及实例替换回归修复；后者贯穿 write/edit／根／能力保存回调，并扩展原 harness 失败关联用例，验证同内容替换被拒绝、恢复原文件后才补关联。旧 pending 缺 basis 时保持 unknown。审查复核已关闭问题，真实定向测试也通过；审查不覆盖后置的持久 Graph 等待／命令完整接线。

2026-10-23 dev 接收时，保留工作域真实端口并处理 Harness 构造参数冲突；合并后的构造参数、根／子执行及连接路径经独立源码复核，无新增阻塞发现。全仓类型、构建、架构、137 项组合内核和 4 项真实入口冒烟通过，具体命令及证据统一见[工作域交付记录的 dev 接收验证](../archive/2026-10-23-establish-scoped-execution-foundation/delivery.md#dev-接收验证)。UI 端口配置在默认及 5275 各加载 104 项，仍未实跑双实例；4.1 保持未勾选。21 项既有文献库 UI lint 错误仍在，不以本地定向通过宣称全仓 CI 通过。

独立 Agent 只读核对命令权限、等待重验、停止确认与 URL 隔离，未发现阻塞问题；随后审查 driver／registry 和默认入口，报告三处旧 worker 路径导致故障注入失效。主线已同步 capability-isolation、capability-stop-unknown 和 harness-recovery，24 项相关回归通过，独立复核关闭该 finding。本轮没有未关闭 finding；审查不覆盖尚未实施的资源授权和持久恢复。

主线将命令等待前的目录、项目及程序保存为原始值，避免持有可变工作空间对象而漏检重绑定，并补行为回归。图初始化在校验后、调用工厂前锁定，避免构造失败后重试导致重复效果；推进结果须属于原尝试。架构守卫发现的 async_hooks 位置变更已修正，无新增例外。

新增非法入口负例曾因测试直接调用 RpcPeer.request 缺少第三个等待参数而失败，修正测试调用后定向复验及 tools 类型检查通过；没有以该失败修改生产 RPC 语义。既有共同契约审查发现的模型可选字段、未知创建依据和 UTF-16／UTF-8 边界修正仍沿基线保留。

## 未完成事项与下一步

1. PR #8／#9 及后续恢复／授权修复已由 dev 接收，本树基线为 `e324367`。本轮 4.1–4.3 的回归及说明向 dev 送审，实际合入前不宣称该增量已接收；不自行合入或同步其他工作树。
2. 工作台线继续交付 registered 图的完整指令上下文、checkpoint 与授权复查。该增量经 dev 接收后，4.4 再核对显式输入、实际资源／成果及失败路径；本轮保持附件未接线保护，不改变源码默认注册。
3. 4.5／4.6 的最终组合审查与交付保持待验，按原公共基础规划明确当次整合负责人。本轮独立审查只覆盖新增隔离用例和接入说明，不能代替最终三线复核。
4. 仍未验真实外部模型／科研充分性、完整 UI／内核及三平台分发。UI 首次加载超时及独立复验记录见本轮证据；不据复验通过声称并发冷启动性能或全仓 CI 已达标。
5. 续做读取 tasks 与本记录，再取得 apply instructions。当前 16/19；最终 4.4–4.6 保持未勾选，不以本树通过替代 dev 接入和最终交付。
