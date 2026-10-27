# 实际交付与交接

## 8a2f0ce后的早期诊断与本机excerpt反例

这是当前有界交付，取代下文历史阶段的“下一步补首次诊断”说明。只读确认起始clean、HEAD及祖先为`8a2f0ce522dfbab4110e63e84e542f6660e6115e`，消费`/tmp/scholoom-round7-acceptance-SdxHy8/`的验收、计划、main-kernel.log、context-control.log及CI基线。未应用旧patch、同步别树或修改生产代码。context-session已接收不重做；报告旧Evidence历史授权、生态only-export、FileEdit来源、全部根工具/恢复/标签保持原样。第12组完成，但**最后正式组合为2通过/1失败**，取消等待尚未闭合，不以较早绿色覆盖。

### 实际诊断增量

`tests/execution-diagnostics.ts`增加`observeExecution(app,scope,model)`，在两个代表调用点（excerpt、委派取消）send及首次轮询之前安装。复用app变化与child_process事件和原execution-stages附件，不加采样sleep；同一观察器最多一个在途采样。SQLite只读、session限定，最多读100实例/17委派，保存32实例/16委派；指令和工具各最多16项，32样本/32子进程，初始样本及最近样本保留，超限计数，附件最多256KiB。只记录project/session/run/host/instance/委派身份、状态、模型请求**计数**、工具名、PID及spawn/exit code/signal；children可能是控制进程，实际worker PID以run_instances为准。无模型正文、工具输入输出、环境、原始argv或全库。

`failure`固定首次失败时间及当时最近已完成样本的独立引用，不能当成失败瞬间的同步快照；后续样本/字节裁剪不丢该边界。finally停采并关闭只读DB，afterEach在失败或诊断开关启用时从缓存附加，即使所属应用/目录已清理也可保存。原`expectExecutionCompleted`复用采集器，业务断言仍直接读原app.snapshot，诊断SQL/解析失败不会成为新的通过条件；其原20秒完成等待及既有最多15秒诊断观察未加长。

诊断snapshot单次预算500ms；首次超时后不再启动新读取，最多保留一条无法取消的原读取，不累积队列，也不等其完成阻断清理。DB启动/读取/关闭错误只记有界诊断码。Node的child_process发布时spawnfile可能尚为null，先记录创建、spawn后补PID/可执行名，防止诊断回调改变原执行。

### 首次失败、受控实验与excerpt最小修正

1. 先`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`，日志`/tmp/scholoom-agent-round8-build.log`，完成后才测试；本轮未重建测试中的产物。第一版早期订阅在`agent-round8-excerpt-first`暴露诊断自身对尚未设置spawnfile的错误访问，1失败（非产品反例）；修正后首次真实5秒复现保留在`test-results/agent-round8-excerpt-diagnostic`及对应log。
2. 实际附件显示：约3.565秒真实worker已运行且指令consumed，3.760秒模型请求为1、无工具调用，随后进入stopping；旧默认完成轮询仍失败。临时实验`/tmp/scholoom-agent-round8-probe-b9s16O/`保留原失败判定，仅在失败后有限观察：原轮询约4.03秒已返回失败，同一执行约4.458秒completed、实例exited、控制进程code0，仍只有1次模型请求，未重放。该实验结果仍**失败**，没有用继续观察覆盖原结论。临时配置初次缺type:module导致未装载的失败亦保留，非产品故障。
3. 已安装Playwright1.63.0的`playwright-core/lib/coreBundle.js:4615`证实：下一轮询间隔会跨deadline时直接结束；默认末段1000ms间隔可使名义5秒窗口少采最后近1秒。故仅excerpt改为`intervals:[100,250]`，**仍是原5秒deadline**，保留四个摘录/批注内容及checkpoint结构化指令断言；没有加sleep、扩大统一时限或改变worker停止条件。`agent-round8-excerpt-poll`单项1/1通过。
4. 独立只读审查指出诊断错误参与断言、无界snapshot等待、初始化清理与失败样本裁剪风险；均已修正。后续复核又指出race超时无法取消原读取，以及失败后观察可能等待无界业务snapshot；现首次超时停采、失败后只用有界诊断sample并重抛原错误，复核未发现该两项遗漏。审查者未代跑测试或改源码，现已关闭。
5. `/tmp/scholoom-agent-round8-control-DnEtH1/`是明确临时诊断夹具，不进入正式测试或补丁。它在真实send之后、首次状态断言前主动抛错，**预期1失败**，afterEach仍保留1094字节execution-stages、首次failure边界和accepted/queued样本，应用清理成功。另一个诊断专用host snapshot永不返回的替身实验（不是业务执行替身）**1/1通过**：500ms预算后连续100次sample只产生1次底层读取，stop小于3秒上界；日志`agent-round8-control-bounded`。正式用例没有故意失败或新生产替身。

### 正式验证及未闭合的具体阶段

命令统一为现有Node Playwright入口，无安装/下载依赖、开发服务器或真实用户库。内部Kernel/broker/仓储/worker真实；excerpt的contextResources describe/check沿原测试模块替身，材料字节不读取，模型仅外部HTTP受控，不能把该测试当真实材料科研验收。

最终命令：`PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/scholoom-agent-round8-final-results.json SCHOOLOOM_EXECUTION_DIAGNOSTICS=1 node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/agent-delegation.spec.ts tests/kernel/context-instructions.spec.ts --grep 'cancelling a child stops|real worker sends explicit excerpts|a later basis upgrade' --reporter=list,json --output=test-results/agent-round8-handoff`，**2通过/1失败（40.9秒）**，日志`/tmp/scholoom-agent-round8-handoff.log`。JSON保留成功及失败的4份execution-stages，均4–12KiB；不能从默认list成功时未落附件误认没有采集。

- excerpt通过：最终completed、实例exited、模型请求1，原摘录/批注及checkpoint断言全部执行。basis-upgrade通过：原两轮上下文及历史保护、两次helper的stop/缓存均兼容。
- 取消用例失败于首次running轮询，尚未调用cancel。最终失败边界约4.129秒，父worker running、指令consumed、模型请求1、delegate_agent streaming；停采前4.158秒已有委派accepted/结果missing，子instanceId已分配但尚无子run_instances登记，仅观测父控制进程。**不能称子worker已启动或取消失败**。此前另一次组合记录2次模型请求及第二控制进程spawn，时点不同，不能混成最终状态。
- 分开保留早期取消单项1/1、`agent-round8-reviewed`组合3/3（38.8秒），以及其前后两次2通过/1失败；表现依赖启动进展，未据局部绿灯关闭平台项。没有改该取消测试的原断言/5秒期限。

下一最小判别输入已具体化：同一真实工作包、childHold、首次running断言，在失败后保留边界，有限观察“accepted→子控制进程spawn→child onStart/run_instances→running”各点。比较名义5秒断言的末段盲区及真实父/子冷启动阶段，才能选择夹具分阶段条件或提交生产准入疑点。当前不修改admission、delegations白名单、报告来源、runtime追踪或bootstrap，不把未知阶段改成成功。主线另外三项large context/transfer及all kinds本轮未复验，仍开放，不据excerpt修正宣布四项全绿。

### 新旧Windows与macOS证据

旧完整基线仍是`39be88978d442757e278be326633049d0e2a82a2`/Checks40432749785：Linux709通过/9失败/23跳过，Windows641通过/54失败/39跳过/7未运行，macOS校准2通过、人工入口3通过/1失败。一次只读查询新自动CI（无触发/轮询）：8a2f0ce的Windows diagnosis40445841861已success，Checks40445842005当时macOS失败、Linux/Windows仍in_progress，后者不推定当前终态。

实际Windows2025定向run命令：原`a later basis upgrade|Agent structure tools`各重复5次，共10通过（retry=0）；ownership16通过/3跳过；development owner2通过；desktop初装3通过。artifact12708068789/windows-execution-diagnostics内15份execution-stages为win32、最终completed、实例exited。**不包含本片取消或real worker excerpt两例**，不能借其成功关闭4.2/4.3或把8a代码当作已含本轮未提交诊断。新Checks当次尚无Windows artifact。新macOS同名关闭重连用例报`app.process().exitCode`读取undefined `_object`，行216；输入/日志交主线计算牵头，未并改。源证据在`/tmp/scholoom-ci-evidence-GL4yNV/{targeted-artifact-summary.json,diagnosis-execution.log,checks-macos.log,windows-execution-diagnostics.zip}`。

tools类型、修改测试Biome error级、OpenSpec strict/schema、diff检查通过；产品schema/生成映射及业务文件均无变化，不重写映射或重跑无关全仓。无新增双宿主产品UI、目标Windows取消/恢复、发布或真实科研质量结论。临时项目只在其专属配置关闭后清理，控制探针及原trace/日志保留；所有执行/模型服务已收尾。

交接包`/tmp/scholoom-agent-round8-handoff-sC9oqb/`为相对8a2f0ce的独立测试诊断/夹具与原tasks/design/delivery增量，含首败/受控/正式日志、JSON阶段摘要和补丁检查；不含临时故意失败用例。任务**28/32**，第12组按“可用诊断+具体分阶段发现”完成，4.2/4.3及6.1/6.2继续开放；取消首次等待和其他三项context明确未闭合。无提交/推送/PR/归档、别树操作或下一阶段展开。

## 4b13183后的最新CI诊断与首个共同根因修复

这是当前续做状态。HEAD=`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`，祖先核对成功、起始clean；主线`/tmp/scholoom-round6-acceptance-dXuzCA/{acceptance.md,synchronized.json,sync-build-results.json,sync-kernel-results.json}`已证明本树同步、构建及execution-facts复验成功。M2/TaskPort和生态工具rememberCatalog持续授权修复已在共同基线，未重复接入或回退。下文A/B和旧CI分类是历史证据，最新基线由本节取代。当前只交第11组的诊断和已有契约内会话夹具修正，不以完整change未完否定该有界结果。

### 本轮唯一源码修复与首次失败

`tests/kernel/context-session.spec.ts`的客户端替身没有`subscribe`，其getSnapshot也未声明当前连接phase。共同源码的`useBusinessSession → useTasks → useFileWatch`在挂载effect中需要该订阅接口。两个CI平台均在第一次选择按钮（旧行81）等待60秒，未到发送、草稿、延迟或unknown回执场景；具体日志为`ci-baseline-failures.log:3285`（Windows）和`:9399`（Linux）。

先构建共享/内核，再运行未修改原测试：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/context-session.spec.ts --output=test-results/agent-round7-context-red`，**1失败**，原60秒超时位置相同。`trace.zip/1-trace.trace`的pageError明确为`TypeError: client2.subscribe is not a function`，栈落在文件监听effect；挂载树被移除，不能归为点击遮挡、会话慢或草稿失效。原log与trace保留，未force click或延长时限。

最小修复只补替身`subscribe:()=>()=>{}`及getSnapshot的`phase:'connected'`；没有生产订阅、来源、恢复、取消或资格检查改动。另在此既有组件夹具afterEach使用Playwright的pageErrors提供有界页面错误附件，后续失败可直接看到挂载原因，不必从大bundle猜错误。原完整场景断言和文案均保留：旧草稿恢复、拒绝后pending清理、迟到回执期间切换会话、后续附加项保留及unknown回执刷新保护。

### Windows已取得的实际阶段证据

最新目标证据为本仓`6b22d602046baa7c1349bf66059c61d79c07ae40` / Checks **40315429083**，不是旧374项基线。本轮只读下载该run的`diagnostics-windows-latest.zip`（985155字节），在`/tmp/scholoom-win40315429083-scout-wUkFaT/`定向提取所需失败trace；CI准确输入用本仓`git show 6b22d60:<path>`核对，无切分支或其他真实工作树读取。外层157条目，选取的16个失败trace只有error-context，无execution-stages或kernel.log，stdout/stderr事件为0。timeline为该目录`trace-poll-timeline.tsv`，证据包亦保留原zip及timeline。

| CI输入/用例 | 已证明停点（日志行均相对主线ci-baseline-failures.log） | 不得推断/尚缺证据 |
| --- | --- | --- |
| `agent-delegation:244`，childHold父委派 | L3043；旧行250等running，trace从undefined到accepted | 未到delegation.cancel、父完成或重启。缺实际实例/PID/模型计数，不能称取消/重启机制坏 |
| `harness-recovery:23`，gate后分别注入checkpoint INSERT、consumed UPDATE、confirm回执失败 | L3429/3458/3487；旧行69等failed，实际queued | 下一条model.requests=0断言未执行；不能把其当实际采样，也未进入重启恢复验收 |
| `context-instructions:183`，占四名额、发100条同run指令、释放名额 | L3169；100条受理及runId检查通过，旧行216等首次模型请求，实际0 | overflow第101条尚未发，缺释放后worker/模型准入阶段。0请求只在本组有直接观测 |
| context-instructions全context kinds及显式摘录/批注 | L3198/3227；旧行435/590，queued→running但五秒未完成 | 尚未验证持久来源重启/模型摘录/checkpoint内容，不把running等同HTTP请求到达 |
| recovery普通跨轮、scratch/legacy/offload/empty、prior-scope live/exited共7例 | L3516起，首轮旧行134/193/274/341/382/531×2，queued→running后完成等待失败 | prior-scope尚未注入未知归属，其余未到对应接续步骤；不能按测试标题认定恢复损坏 |
| recovery checkpoint序列化损坏/中断诊断失败共2例 | L3719/3748；trace确认首模型请求及cancelled，故障注入后旧行605/672的后续轮仍running | 取消已确认；缺后续最终进展与保留源核对，不归为取消未确认 |

queued不足以证明worker未启动；running只是可观察状态，不证明模型HTTP或成果已保存。Windows同组的真实委派报告保存/父读回与保存后关联失败用例分别通过（L2324/L2333），不能转嫁为取消失败用例的成果证据。stop-unknown的POSIX controller故障注入在Windows跳过（managed-commands旧行375、agent-delegation旧行389），不计Windows验证成功。

ownership定向只运行platform-processes与managed-commands、单worker，16通过/1跳过（L1917、50.2秒）；之后安装写作工具链才跑完整kernel714项、仍单worker：**628通过/49失败/30跳过/7未运行**（L2313/L4526）。主线summary省略7未运行，原始日志可核查；本线不修改该只读summary。两组条件和能力范围不同，不能以原生定向通过消除执行恢复失败。

### 交回的精确输入与下一证据

宿主发现/重启由计算线牵头，本线未改lifecycle/bootstrap。交回两项实际输入：同一隔离目录并发4次`node apps/kernel/dist/cli.js start --data-dir <dir> --connection-info`至少一次unknown（L3837）；持有`runtime/lifecycle.sqlite`的BEGIN EXCLUSIVE时并发3次start，500ms后释放，未全部running。准确源码为上述隔离证据目录`ci-source/tests/kernel/lifecycle.spec.ts:20/78`。缺每份完整BootstrapResult、endpoint/锁阶段及kernel.log；不能据状态同名把引导unknown当执行停止unknown，也无证据证明其导致harness等待。

Windows恢复组的下一窄诊断应放在**首次失败断言**处：复用`tests/execution-diagnostics.ts`采集同一project/session/run的modelRequests实际计数、工具状态、最多100条run_instances及完整停止事实；当前delegation helper在失败的running断言之后，未执行。save/ack/receipt、容量释放和checkpoint后续轮也需在原失败时点各取一次，不能只读清理后的状态或统一加超时。必要Linux因果回放可延迟真实worker启动、观察四名额释放后的首模型请求，或重放“首次模型→cancelled→损坏注入→后续轮”；这些只是下一步判别输入，现无Windows机制根因证据，不在本轮继续改生产逻辑或新增整套试验。

### 实际验证、替身与交接

- 构建：`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`通过，日志`/tmp/scholoom-agent-round7-build.log`；完成后才测试，测试期间未重建本树产物。既有组件测试的esbuild只在内存bundle（write:false），无产品开发服务器。
- 红测如上；修复后同一context-session原场景、`--output=test-results/agent-round7-context-subscribe` **1/1通过（7.1秒）**，日志`/tmp/scholoom-agent-round7-context-subscribe.log`。原`context-drafts.spec.ts`以`--output=test-results/agent-round7-draft-regression` **1/1通过（6.0秒）**，日志`/tmp/scholoom-agent-round7-draft-regression.log`。未修改产品/测试时限，未强制点击。
- tools类型检查、该文件Biome error级检查、OpenSpec strict/schema及diff检查通过。无schema/生成类型或生产代码变化，生成映射沿共同基线不重写；本轮未重跑全仓CI、真实worker整合或双宿主产品UI。
- 替身：这两项是既有组件/草稿接口测试，真实React/useBusinessSession/草稿模块和浏览器存储，client及未挂载导航为明确替身，session.send的拒绝/迟到/unknown为受控回执。**不是实际broker/仓储/worker/FileEdit验收**，不合成身份调用生产保存，不把夹具通过重算为M2/I3通过；这些实际链路保持主线已接收状态。
- 只读辅助Agent继承gpt-6.1-sol/high，完成Windows输入/trace归组；主Agent抽查accepted、queued和7未运行原始日志及timeline，核验本地红/绿。辅助Agent现已关闭，未写源码/构建/运行测试/跨树发送消息。

独立增量与证据包：`/tmp/scholoom-agent-round7-handoff-QrPkEX/`，相对4b13183仅本测试及所属tasks/delivery，包含原始红/绿日志、页面错误摘录、原Windows zip/timeline和补丁检查manifest；不应用旧累计补丁，不提交/推送/PR/归档。任务**25/29**，第11组完成，4.2/4.3及6.1/6.2继续开放。达到首个可证明共同夹具根因的有界修复及精确Windows缺证边界后停止；没有新Windows/macOS目标通过结论，没有扩展科研角色/Graph、advisor、递归或持久通信。

## 1026796共同领域基线后的A/B交付

本节为当前续做入口，后文历史阶段的等待描述不再构成前置。只读确认HEAD=`1026796d854b8f568c3e819f13268a9638980bc1`、祖先核对成功、起始git status为空。消费主线正式`/tmp/scholoom-round5-acceptance-WBreMJ/acceptance.md`与`synchronized.json`，未读取其他真实树、复制私有实现或应用旧累计patch。源码唯一工作点为当前树；末尾仍保留原历史失败与范围。

### 实际实现与模块权威

- A：`KernelApplication.executionFileFacts`默认await原`executionFacts(context)`，经既有kernel消费声明/broker调用完整harness事实提供者；显式`originFacts/fileExecutionFacts`仍可返回同步值或Promise。仅映射verified的四元组和verified委派链至原FileExecutionFacts，instructionContext/tool不推断。没有空provider、公开新工具、来源副本或新DTO/schema。
- `ManualApplication.fileOrigin`等待后再次`checkExecutionContext`并核对事实四元组，再由project.saveFile、files.save/undo、resources.create、tasks.create/save的必要await传入原projects保存。原withAccess授权、文件锁、领域CAS和历史事务不变，不在SQLite事务或文件锁中等broker。项目线的TaskResearchPort装配、构造器末尾executionResources/taskPort/delegationOptions/programs、所有根工具、统一v6/restore、资源叶和任务/程序tab均无改动。
- 实际来源回归中，父worker保存parent.md，子worker创建report.md；FileEdit读回分别核对父/子instance、principal/session/run及子持久委派关系，子创建返回的真实editId与历史一致。原退出/重启、伪造身份和unknown事实回归保留；另在真实broker事实已返回后以观察包装延迟来源返回，取消或同步撤权，验证无blocked.md和无新增edit。包装只延迟，不伪造事实/保存；同步Binder夹具仍单独标记为接口测试。
- B：`delegation-task-port.spec.ts`使用当前真实TaskPort。父工具read取得TaskRef/入口basis，原ResourceEvidence交`worker@1`；子只读入口、沿受限create保存报告并report，父沿实际ref/basis读回、重读入口，再tasks.save关联result/workItemId。任务仍active且只有一个，不自动创建任务或把执行完成当科研完成。没有新增生产TaskRef字段、科研角色、子任务/程序/任意历史权限。
- 四个机械场景：正常关联；子读取前入口发生真实人工条件保存，旧basis拒绝且report保留blocker/unfinished、无成果；成果保存后父关联遇到实际人工更新，CAS拒绝且保留报告与未完成说明；父已读成果及入口、尚未关联时取消，原成果/委派结果保留、任务无result链接且根run cancelled。最后一项不声称子已取消，也不把文件association误当任务links。

### 本轮验证、首次失败与诊断

环境Linux、Node24.12.0、OpenSpec1.15.0，已有依赖，真实内部broker/领域仓储/受管worker/文件，模型仅在loopback HTTP边界受控。所有样本合成，新增登记项目保留在test-results对应结果目录；不删除已登记目录。没有安装/下载、真实用户库写入或开发服务器。

1. 先`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`，再`--filter @scholoom/desktop build`；格式化后最终kernel build完成才启动内核测试。共享及desktop构建日志为`/tmp/scholoom-agent-round6-{build,desktop-build,kernel-final-build}.log`。测试期间没有重建产物。
2. 新测试初次tools类型检查发现message.content误用、exactOptionalPropertyTypes下显式undefined及当前lib不支持Promise.withResolvers；分别使用message.text、明确联合值和原Promise构造器解决，未变更tsconfig/lib。后续tools/kernel类型检查通过。
3. 首次内核`test-results/agent-round6-first`为12通过/3失败，日志`/tmp/scholoom-agent-round6-first.log`。实际故障是新模型夹具在respond内设置hold，而既有server的gate在respond前执行，目标工具已越过预期暂停点；不能据此认定材料/CAS/取消失效。现仅让原外部HTTP模型respond可返回Promise并await，task夹具在实际材料读取/关联响应前等待，内部保存实现未替换。修正后三个故障场景`agent-round6-task-gates` 3/3通过，首次trace/项目保留。
4. 最终组合命令：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/execution-facts.spec.ts tests/kernel/file-edit-origins.spec.ts tests/kernel/agent-delegation.spec.ts tests/kernel/delegation-races.spec.ts tests/kernel/task-tools.spec.ts tests/kernel/research-task-agent.spec.ts tests/kernel/delegation-task-port.spec.ts tests/kernel/execution-history.spec.ts --output=test-results/agent-round6-integration`，**45/45通过（4.5分钟）**。日志`/tmp/scholoom-agent-round6-integration.log`。覆盖A1、合法连续保存/旧basis/未知意图、容量、父收尾/取消/重启、实际来源/撤权、任务工具/接续与公共history。随后纠正新测试的程序工具名断言为实际`start_project_program`，只补验机械正例，`agent-round6-task-tool-scope` **1/1通过**。
5. 双宿主复用原`tests/ui/agent-delegation.spec.ts --grep 'opens its saved report'`，已构建静态承载`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，临时配置`/tmp/scholoom-agent-round6-ui.config.mts`，独立端口5638、独立生成profile及`test-results/agent-round6-ui`。**Browser/Electron 2/2通过（1.8分钟）**，日志`/tmp/scholoom-agent-round6-ui.log`；仅正例，不称本轮重跑全部UI或I3产品科研路径。静态服务与内核均由原夹具收尾，无常驻开发服务。为保留登记目录，来源测试根移到`test.info().outputPath('execution-facts')`，该单项`agent-round6-facts-retained`另**1/1通过**，不再删除测试项目。
6. kernel/tools类型检查、修改文件Biome error级检查、architecture（14模块/247文件、0 findings/0 exceptions）、生成器self-test及harness最终schema格式化映射逐字比对通过；同源schema/生成文件无差异。本change strict、scholoom-dev schema及git diff空白检查通过。

只读原生辅助Agent继承gpt-6.1-sol/high，先核对TaskPort事实，再独立审查两份kernel来源改动，未发现确切授权/异步临界区问题；未写文件或运行构建/测试，现已关闭。主Agent核验运行证据并修复夹具；无未关闭写入者。

### 独立增量与剩余范围

本轮只交相对共同1026796的增量，不重发旧累计源码。补丁及manifest/日志包为`/tmp/scholoom-agent-round6-handoff-LP1kQp/`，包含真实默认注册消费链所需的kernel符号、必要测试/模型夹具与本change/开发文档；已有完整harness仓储/handler/schema均由1026796提供，不能把补丁解释为独立空事实provider。接入者按符号合并共享application/manual，保留项目线TaskResearchPort装配，其余域无需先复制私有代码。补丁正向临时索引与当前树反向check、最终任务数及diff核对见包内manifest/checks。

任务第10组完成，整体**22/26**；4.2/4.3目标平台和6.1/6.2真实科研角色/guidance/质量仍开放。真实TaskPort与共同源码已到位，不再以缺其同步阻塞。未新增Windows/macOS、全仓CI、远端或分发包结论，不修改生产停止、容量、期限；不自动扩大科研Graph、advisor、递归或持久通信。达到本轮A/B边界停止，未提交/推送/PR/归档，也未操作其他树。

## 当前状态与成果

当前为1026796共同领域基线后的A/B有界整合切片：真实executionFacts已接FileEdit来源，通用worker沿真实TaskPort完成机械I3。A1保持已复验关闭，七域源码已在本树，旧“公共源码未入dev／等待同步／TaskPort缺失”条件失效；不再应用历史累计patch。下文各历史阶段保留首次失败与原始验证，当前证据见文末。用户允许可审查本地提交或补丁，本轮选择补丁；仍不安装依赖、启动开发服务器、操作真实库、推送／PR或归档。开发Agent保持Codex／gpt-6.1-sol／high，未新开Agent终端，产品命名模型仍使用既有MiniMax目录。

| proposal判据 | 实际成果与接受边界 |
| --- | --- |
| 真实父子保存及回读 | `Delegations`沿RemoteAgent和原静态worker运行；定向样本核对不同受管PID／实例、子实际读取42并保存report.md、父沿实际ref/basis读回。harness只接受领域回执，不把scratch或口述当成果 |
| 上下文／权限／模型 | 子无父私有标记及父checkpoint，scratch按委派分隔；宿主落实父、角色、请求交集及领域授权；命名配置钉入版本，不同descriptor共享32次预算及全局并发1。任务关联现沿真实TaskPort；科研角色指导及质量仍待提供者 |
| 等待、取消和恢复 | 有限等待到期子仍running；局部取消父继续，父正常退出收尾未完成子；重启查询不发模型请求。真实控制器SIGKILL保interrupted/unknown并拒绝不安全项目释放 |
| 双宿主会话 | 现有composer启动真实父子；工具记录按结构化delegationId展开、看实际模型／障碍／成果、开报告或取消；浏览器及真实Electron通过。组件夹具另核对切会话／重连迟到读取、草稿和配置冲突 |
| I3 | 无任务资源交接及真实TaskPort的通用worker机械子范围通过，父用原ResourceEvidence交入口、重读后关联result/workItemId。科研角色／guidance与真实质量仍开放，不关闭完整6.1/6.2 |

已核对[design变更总览及受理顺序](design.md)：进程、资源提供者、持久化及UI路径与实施一致。实际新增创建身份映射、修改意图与同ref在途拒绝、延迟子资源绑定、结构化工具引用和诊断PID已同步到design。正式规格未同步，旧科研能力／Graph保持原语义。

主要入口：`packages/harness/src/delegations.ts`及runtime接线；`protocol/src/delegation-contracts.ts`和模型schema为事实源；`models/src/config-store.ts`保存命名配置；内核使用共同v4→v5→v6迁移，本轮不改迁移链；`DelegationCall.tsx`沿既有ToolCall呈现。操作及诊断见[开发说明](../../../docs/development.md#有界-agent-委派)。

## 实际验证

环境为Linux、Node24.12.0、OpenSpec1.15.0，真实本地受管执行、SQLite、broker、资源保存与恢复；模型仅替换外部loopback HTTP边界，使用合成key。已安装依赖来自原主仓库的只读本地链接，锁文件一致；`@scholoom/*`链接到当前树的构建，未消费其他树业务实现、安装或下载依赖。

### 构建与静态检查

- 直接执行已有TypeScript入口构建protocol、platform、broker、client、projects、library、models、research、editor、harness、kernel，平台scope及editor visual按已有构建脚本生成；kernel／library迁移及research builtin复制到本树dist。后续变更定向重建受影响包。
- `node node_modules/typescript/bin/tsc -p packages/protocol/tsconfig.json`、`-p packages/harness/tsconfig.json`、`-p apps/kernel/tsconfig.json`通过；`--noEmit -p apps/desktop/tsconfig.json`和`--noEmit -p tsconfig.tools.json`覆盖UI、夹具和测试。
- `node packages/protocol/scripts/contract-types.mjs --self-test`通过。`--patch`生成映射后经内置apply_patch接入；重新生成并经Biome格式化逐字比对本次两个类型映射，均一致，未引入其他映射的格式差异。
- `node scripts/check-architecture.ts`：13模块、197文件、0问题／0豁免。修改的38个TS／TSX／JSON文件经Biome检查，无error；保留非空断言与测试动态JSON的warning，不宣称零warning。
- 收尾执行OpenSpec strict／schema检查及git diff检查，具体状态以本文件末尾复核为准。

### 内核与组件

命令均用已有 `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts <files> --output=<directory>`，未通过包管理器安装或调用setup。

| 用例范围／输出 | 实际结果 |
| --- | --- |
| `agent-delegation`、`delegation-races`、`delegation-contracts`、`model-profiles`、`model-access`、`model-admission-integration`、`project-container`、`project-recovery`、`harness-module`、`execution-isolation`、`execution-capacity`、`capability-stop-unknown`、`harness-recovery`；`test-results/delegation-final` | 首轮83项，79通过／4失败；失败保留，原因及后续修复见下节。预算、排队撤权、原能力子、真实IPC、故障停止保护等未失败分支通过 |
| `agent-delegation`、`delegation-races`、`project-container`、`project-recovery`、`delegation-components`；`test-results/delegation-final-repair` | 27/27通过，包括首轮4项失败、同ref并发意图、v5失败重试、恢复引用和3项组件测试 |
| 同ref／权限交集用例；`test-results/delegation-permissions-final` | 单独定向通过；真实SQLite／准入，save端口为明确gate替身，核对三方交集、实际拒绝及只受理一次写入。实际文件发布由其他真实资源用例覆盖 |

上述定义去重共88项（14文件，CLI `--list`核对），均取得通过结果；包含修复后定向复验，不表示单次88项全绿或全仓CI通过。核心真实报告样本另保存`delegation-result`附件；故障诊断复用`execution-stages`。未运行真实供应商模型或科研质量评价。

### UI与生产构建

生产桌面构建通过。由于本地依赖链接位于树外，默认Vite构建触发文件allowlist拒绝；临时 `/tmp/scholoom-delegation-electron.config.mjs`仅为构建增加当前树与已存在`.pnpm`目录，未改产品配置／安全边界。命令从apps/desktop执行：`node ../../node_modules/electron-vite/bin/electron-vite.js build --config /tmp/scholoom-delegation-electron.config.mjs`。

用户禁止开发服务器，故UI验收使用已构建renderer的静态HTTP测试夹具，接既有kernelBootstrap中间件；没有运行Vite dev。临时入口为`/tmp/scholoom-delegation-static-server.mjs`及`/tmp/scholoom-delegation-ui.config.mts`，保持现有浏览器／Electron fixture、preload及真实内核。它们是本轮测试适配，不是产品服务器或新业务实现。

执行入口：`SCHOOLOOM_UI_PORT=5631 xvfb-run -a node node_modules/@playwright/test/cli.js test --config /tmp/scholoom-delegation-ui.config.mts <file> --output=<directory>`，旧场景另以`--grep`选择。

| 真实双宿主场景 | 结果／证据 |
| --- | --- |
| `tests/ui/agent-delegation.spec.ts`，保存／打开与局部取消 | 初次4/4通过，`test-results/delegation-ui`；最终夹具修正后再次4/4通过，`test-results/delegation-ui-final` |
| `harness.spec.ts`的`user configures, edits safely…` | gate路径及自锁修复后2/2通过，`test-results/delegation-harness-ui-repair` |
| `harness.spec.ts`的`user invokes a declared research capability…` | 阶段诊断后2/2通过，`test-results/delegation-research-ui-repair`；原失败及诊断保留在`delegation-research-ui`／`delegation-research-diagnostics` |

默认测试原有失败见调查中的CI输入，本次不宣称Linux全组、Windows全组或分发包通过。组件测试替代端口状态以覆盖迟到读／配置冲突，不替代真实双宿主执行；科研关联故障测试注入原linkArtifact失败，验证文件保留与reconcile不重写，不等同项目任务关联提供者。

## 审查与问题处理

原生独立审查使用继承模型／high，取得原契约、源码、样本及验收标准，未预注其他审阅结论。其独立发现的创建收据越权、旧回执掩盖未知保存及异会话在途合并已修复；后续旧basis误报未知和并发变体也已关闭。最终源码／回归定义复核未发现新增P1/P2，审查者未代跑测试或代替主Agent最终验收。

1. 创建前持久保存客户端→宿主领域操作身份映射，并核对实际项目／路径，兄弟同客户端ID不共享收据。
2. save前记录pending，确认回执后才complete；真正发布后抛错仍unknown。最近成功basis及同ref在途检查在新意图与领域调用前同步执行。回归分别核对真实V2发布后未知、旧V0拒绝后正常V2，以及并发只调用一次领域。
3. 异步受理同时核对可信session／parent instance；解析后再次授权。子资源端口在实例注册后绑定。SDK拒绝按Backend错误协议返回，允许子继续合法工作。
4. 首轮新增取消用例失败来自模型夹具在release后再次hold；已改只设置一次。控制器故障用例先按执行启动阶段观察，未改生产超时。旧v2恢复样本遗漏删除新增表已修正；真实v5迁移冲突另核对原版本／数据与副本保留。
5. 旧UI先等待被自身gate扣住的session.create helper形成自锁；已改发起→检查禁用→释放→等待。科研报告失败的阶段证据及处理详见[investigation实施补充](investigation.md#实施补充依据)：deadline时ENOENT／父子running，继续观察后实际文件及退出均确认；现先等用户可见执行完成再直接读文件，保留原失败记录，未以空串隐藏读错，也未修改产品期限。

依赖链接、临时构建／静态测试适配保留于本树忽略目录及/tmp供复核；测试成果／trace保留在test-results。测试关闭自己的内核、HTTP模型、Electron和受管执行，故障注入仅作用于本轮取得的owned handle。无真实用户数据或常驻开发服务。

## 未完成事项与下一步

任务以[tasks](tasks.md)为准，本轮新增第9组。公共同步／history消费门已有实际证据，不再等待同一公共方案。仍开放4.2 Windows原失败阶段、4.3目标平台、6.1真实科研角色／任务提供者及6.2业务I3；当前本树没有真实TaskPort／科研角色，不能把通用worker或已读快照当业务接通。

已核对快照路径及公共符号见design末节；下一步先由主线选择构造器组合／任务关联范围，计算提交统一迁移方案并经dev验证、用户同步消费者，再沿实际角色提供者执行I3。Windows保留原全组条件，按worker／ACL辅助进程分类取阶段证据；macOS仍声明受管不可用，人工／分发路径待目标实测。跨会话通信、advisor、递归、后台移交及子checkpoint自动恢复均未实现。

续做先读取本文件、未勾选任务和当前源码，再取apply指引。无新增安装、真实模型、提交／推送／PR或归档授权；不自动进入这些操作。

第一阶段收尾复核：当时OpenSpec strict与scholoom-dev schema均通过；apply指引13/18。内核／工作台／测试工具类型检查、架构检查、生成映射比对、修改文件Biome error级检查及git diff --check通过。端口5631已无监听。未进行正式规格同步或归档。

## 主线第二阶段：A1修复与公共准备

输入根S为用户正式交付的`/tmp/scholoom-phase2-handoff-VZS5mS/`，消费其中`acceptance.md`、`coordination-plan.md`、`manifest.json`及各线增量快照。精确消费文件与字段逐项列于[design公共对接](design.md#主线第二阶段公共对接)，不读取manifest.source指向的其他实际树，不将快照当完整共同基线。阅读两份设计核对完成；任务四操作／TaskRef及公共history已收到源码，但未复制私有实现或接到本树。科研Graph的delivery.roles是成果角色，不是实际DelegationRole；真实科研委派角色仍缺，I3不关闭。

### A1复现、最小修复与验证

本轮业务修复仅`packages/harness/src/delegations.ts`的save授权，回归扩展同一`tests/kernel/delegation-races.spec.ts`。新样本先真实保存V1，再经原资源CAS更新为V2，工作包save输出仍只授予V1、materials允许读V2；通过session.send→父delegate_agent→两个真实受管实例读取V2并请求保存V2。未手填委派记录、替换worker或模拟领域保存成功。

- **红测**：先构建未修复harness及kernel，运行`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/delegation-races.spec.ts --grep 'readable material cannot widen' --output=test-results/delegation-a1-red`，1失败；实际进入领域写入1次，期望0。trace内`write-version-authorization`附件保留原版本、当前版本、实际写入次数及委派记录；不覆盖首次失败。
- **修复**：首次save精确匹配允许输出ref+basis；后续只使用本委派最近确认成果basis。删除对save的混合readable核验，保留当前项目／输出ref检查、pending／unknown、同ref并发意图和64次上限。检查与意图落盘之间仍无await；未改editor或projects CAS。
- **绿测**：构建修复后harness，再运行`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/delegation-races.spec.ts tests/kernel/delegation-contracts.spec.ts --output=test-results/delegation-phase2-a1`，**7/7通过**。新样本确认V2确实被读、领域写入0次、writes／artifacts为空且permissionDenied，文件保持V2；另用原资源接口核对旧V1 CAS仍contentChanged。原用例覆盖合法连续保存、旧basis拒绝、真实二次发布后未知、兄弟创建身份、跨会话受理及同ref在途（最后一项save端口为明确gate替身）。
- 当前源码格式化后再次构建harness并定向复验A1，结果见补丁包`a1-final.log`；构建和测试不并行重建共享产物。`tsc --noEmit -p tsconfig.tools.json`通过；最小Biome error检查通过。没有为本轮授权修复重跑UI或全仓CI，也未改任何生产期限。

原生辅助Agent沿用gpt-6.1-sol／high完成只读源输入核对及A1独立审查，未发现该修复仍有确证的授权扩大／错误收尾。它未运行构建／测试，运行结果由本线核验；此前主线拒收不能因本线自审改写为主线已接收。

### 公共补丁及依赖

临时包为`/tmp/scholoom-agent-phase2-kJF8nC/`，含README／manifest，未写入只读主线交接包。具体文件：

| 文件 | 基准及用途 |
| --- | --- |
| `01-a1-fix.patch` | 相对主线正式Agent快照，只含A1与真实受理回归；已有第一阶段Agent源码时使用 |
| `02-delegation-public-base.patch` | 相对e3d58fc的本线protocol／models／harness源增量，已含A1、delegations schema及restore，不含容器迁移。与01是替代接入方式，不能重复应用 |
| `03-delegation-host-registration.patch` | 相对e3d58fc的application／architecture本线符号；按design与科研、任务、程序装配合并，不整文件覆盖 |
| `04-delegation-checks.patch` | 本线委派／模型／harness及必要模型夹具验证，不含公共迁移测试 |
| `delegations.sql` | 从现有迁移抽出的表／索引声明，无PRAGMA版本推进，未作为迁移执行，仅供计算组合消费 |
| `windows-failure-classification.json` | 原CI日志15项失败的精确位置／Expected／Received／期限提取，非目标平台新实跑 |

四份patch均以`git apply --check --reverse`在本线核对一致性，不代表dev forward apply／组合通过。源码迁移入口与主线Agent快照`cmp --silent`相同，本轮没有改`project-container.ts`或版本、没有另造迁移链；公共patch也排除迁移入口／对应公共测试和旧生成映射。UI仍由正式快照按符号消费，不重发整文件。

依赖顺序：主线确认Harness第16尾参冲突解决方案；项目资源叶schema保留原重导出、科研history按独立增量消费；再合本线公共符号。计算统一迁移要在宿主初始化前完成，覆盖原v4、新库、两种局部v5、两域表／索引、数据／信任、保护副本／失败重试和恢复。然后组合宿主注册／restore、保留全部根工具与本线受限子规则，从最终schema重生映射，先构建再跑相应原定向集。dev接入及用户同步未发生，未启动真实I3。

### Windows与主线UI证据边界

已有日志`/tmp/scholoom-next-parallel-baseline-failures.log`，Checks40100596838、55d020c：Windows374通过／15失败／12跳过。本轮只分类既有证据：13项在5000ms完成等待失败（2 queued／11 running），另有lifecycle并发重启返回不全为running、platform-availability计数期望0实际9。六项Agent重点失败在原日志6705／6734／6763／6792／6821／6850，均仍running，多项未进入恢复／故障步骤，缺模型、工具、实例及完整停止阶段。

lifecycle原日志6879对应stop后四路start，不是子数量断言；缺四份BootstrapResult、endpoint、锁和kernel.log。platform原日志6994的订阅含initialize及人工操作，Windows私有目录确会用powershell ACL辅助进程；没有用途／阶段／PID证据证明9个全是ACL或执行worker，不删除无未受管执行保证。现有execution-diagnostics可采样，windows-execution workflow的grep未覆盖这六项；无新Windows机器／artifact，4.2／4.3继续开放，不据Linux通过或本次分类改生产时限。

主线首次Agent UI日志为S/evidence/ui-agent-delegation.log的207／236／258附近：Playwright装载时报“did not expect test() to be called here”，2失败／2未运行，未进入场景。S/evidence/ui-agent-delegation-recheck.log记载5825独立端口、新profile下4/4；acceptance确认未改代码。后者只证明隔离复跑通过，未确定／修复首次装载根因，不将日志列举的常见原因当诊断结论。本轮没有重新安装Playwright／Electron或运行新UI场景。

最终复核：格式化后当前harness构建及A1定向**1/1通过**（10秒场景，命令总18.2秒），日志见补丁包a1-final.log；测试工具类型检查、最小Biome error、OpenSpec strict／schema、architecture（13模块／197文件、0问题／0豁免）、git diff及本轮改动／未跟踪工件空白检查通过。apply确认16/20、剩余4.2／4.3／6.1／6.2。与正式Agent快照比较，本轮只改两个业务／回归源文件及本change四份工件、开发说明，共7文件；其余原有未提交成果保留。

本阶段到此停止。主线需决定构造器尾参方案与任务关联消费范围，并接收计算统一迁移方案；科研需提供实际角色及原材料／标准。未做跨会话通信、advisor、递归、Git提交／推送／PR或归档。

## 同步恢复后的实际领域切片

2026-10-26恢复指令已取代旧的“等待用户手动同步”条件。实际HEAD=`2cb6aed4d0f3034ca2d1426858a64a0039e51ede`，只读`git merge-base --is-ancestor 0519904 HEAD`成功，开始时git status为空；0519904包含b838402。源码只使用本树正式状态，未创建／复用/tmp业务组合、未自行同步其他树。原WIP检查点和主线恢复备份均保留。

同步证据为`/tmp/scholoom-sync-recovery-wyn13R/recovery.md`、`synchronized.json`和本树子目录的`build-check.log`、`tools-typecheck.log`、`kernel-check.log`。主线先构建及类型／架构／生成映射检查后，本树内核34/34通过；其中原history、统一v6迁移与恢复已验证。全七树203/203、UI16/16、BBT9/9是该恢复记录的外部证据，本轮不把它们重复计算为新的本线科研成果。当前history与委派同时存在，资源叶、Graph来源、双窗口基础未回退；`project-container.ts`及迁移版本本轮没有修改。

### 新增公共执行事实端口

`harness-module-contracts.ts`增加内部`harness.executionFacts({})`及关闭额外字段的结果schema；从最终schema生成`harness-module-types.ts`，原harness.executions及来源字段保留。`Harness.executionFacts(context)`只核对宿主实际CallContext、当前run／host及完整运行实例链，principal必须为agent且匹配session；按child_instance_id精确读取并核对JSON的child、project、session、parentRun和parentInstance。根实例返回无父委派，不能核实的子关系为unknown。返回固定有界身份信息，不读完整消息／模型历史／成果，不推断instructionContext／tool，二者明确unknown。

KernelApplication注册同源内部handler，并以`executionFacts(context)`经kernel消费声明／broker调用；实际资源提供者可在操作受理时取快照。已取消的context在broker分发前就返回无身份unknown，避免查询变成一次被取消的操作；退出、旧实例或重启同样不重新认证。非执行主体／不匹配principal拒绝，参数不能携带替代instance。没有公开业务操作或模型工具，没有新增principal副本、FileEdit表／迁移，也没有接管项目M2的保存权威。

新测试`tests/kernel/execution-facts.spec.ts`通过真实父子worker的资源read／create获取原CallContext，kernel／broker／harness／SQLite均为正式实现，仅外部模型用既有合成HTTP夹具。验证父与子不同实例、实际持久委派映射、无公开入口、错误实例／缺身份／错误run／已取消为unknown、非执行主体及伪造参数拒绝。测试在退出后去掉旧context的signal，再验证旧身份和重启查询为unknown，避免只因AbortSignal已取消而误认为已验证重启保护；原成果保留且查询无新模型请求。测试保存端口仅作观察包装，真实文件保存未替换。

独立原生辅助Agent继承gpt-6.1-sol／high，只读核对实际范围和新查询，最新复核未发现阻断性的授权扩大或来源不实。它未改源码、构建或代跑测试；本线核验实际运行结果。精确工具／指令作用域仍属后续阶段。

### 构建、首次失败与最终结果

保持先构建后测试、运行期间不重建共享产物。使用既有依赖的直接Node入口，无安装、下载、真实用户库或开发服务器。

- 首次`test-results/execution-facts-red`失败：新宿主查询尚不存在，观察端口失败导致报告缺失；保留原trace。首次harness构建另发现principal展开未收窄为agent的TypeScript错误，改为输出已校验的agent身份字段后通过。
- `test-results/execution-facts-green`暴露构建资产不完整：单独tsc不复制architecture.json，dist仍无新消费声明。按现有kernel官方build步骤复制迁移资产／architecture后，`execution-facts-policy-build`进一步定位到broker对已取消signal的分发前拒绝。现适配器对已取消只返回unknown，未改变broker取消保护，未放宽时限。以上失败工件均保留。
- protocol、harness、kernel顺序构建通过；kernel复制原storage/migrations及architecture.json。新查询单项在`test-results/execution-facts-cancel-check` **1/1通过**。
- 最终组合命令：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/execution-facts.spec.ts tests/kernel/agent-delegation.spec.ts tests/kernel/delegation-races.spec.ts tests/kernel/execution-history.spec.ts tests/kernel/project-recovery.spec.ts tests/kernel/resource-creation.spec.ts --output=test-results/agent-resumed-integration`，**31/31通过（3.0分钟）**。覆盖真实父子读回、A1、兄弟首次创建、权限交集、父完成／局部取消／停止未知、保存与关联未知、重启／恢复及公共history选择／来源／并发重放。
- `tsc --noEmit -p tsconfig.tools.json`、生成器self-test及harness最终schema／格式化映射逐字比对通过；architecture为13模块／200文件、0问题／0豁免。修改源码Biome error级检查通过。最终OpenSpec及diff状态见收尾复核。

本轮不改会话布局、ToolCall或任务／程序tab，不新增UI项；原双宿主证据沿此前交付及主线恢复，不声称本轮重跑。Windows原失败仍缺目标环境和阶段证据，不调生产期限；macOS受管不可用、真实模型／科研质量、分发包及全仓CI没有新增结论。

### 可独立接入的补丁与剩余前置

本轮选择补丁交接，不创建本地提交。补丁包为`/tmp/scholoom-agent-integrated-nxognP/`，仅源码差异与审查／校验工件，没有新的源码组合或运行依赖：

| 文件 | 基线／完整性 |
| --- | --- |
| `01-agent-domain.patch` | 0519904→同步HEAD 2cb6aed，包含此前已验收的完整委派／命名模型／ToolCall领域切片及原必要测试；不包含新的事实端口 |
| `02-execution-facts-public.patch` | 2cb6aed→本轮公共增量，含内部schema／生成映射、runtime、kernel注册／调用适配、architecture消费和新实际调用测试；依赖01提供的委派仓储，不假装空公共基线已拥有完整委派提供者 |
| `03-delivery-docs.patch` | 本轮所属规格、设计、任务／交付和运行文档；history消费同步门按实际证据关闭 |
| `agent-complete-from-0519904.patch` | 上述最终合成差异，供当前dev未接委派业务时使用；与前三份是替代接入方式，不能叠加重复应用 |

所有补丁以共同基线精确生成，保留实际注册、调用方、同源派生类型及测试。不包含新的物理迁移、programs／任务私有实现、包安装或真实数据。接入顺序为0519904→01→02→03，或直接完整补丁；dev有后续共享符号修改时逐符号核对，不能整文件覆盖。具体校验记录及文件清单在包内README／manifest。

历史change本树4.2消费同步门已依据主线恢复清单及本轮实际history组合关闭，不重新起草同一公共方案。任务引用仍可选，真实TaskPort和科研委派角色未进入本树；父可沿原ResourceEvidence交接材料，不引入强制TaskRef、伪造角色或凭通用worker宣布I3。项目M2未来可消费实际context和上述快照；其FileEdit来源持久化／精确作用域不在本线实施。

达到本轮有界任务后停止，保留未完成的Windows／目标平台、实际角色／任务关联及业务I3；不自动同步、推送、PR或归档。

收尾复核：本change 19/23，剩余4.2／4.3／6.1／6.2；history本树消费门已关闭。两个change定向strict、scholoom-dev schema、kernel及tools无输出类型检查、生成器／映射、architecture、Biome error与13份本轮文件的空白／冲突标记检查均通过。完整补丁在0519904的独立临时索引正向check通过，增量及完整补丁当前树反向check通过；未修改真实索引／HEAD、未实际应用或建立源码组合。迁移、资源叶、Graph来源与双窗口fixture相对0519904无差异；当前HEAD仍为2cb6aed，没有本轮新提交。
