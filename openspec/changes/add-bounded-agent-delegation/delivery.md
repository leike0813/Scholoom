# 实际交付与交接

## Linux阶段范围修订（2026-10-30）

用户已明确采用Linux Browser＋真实Electron阶段收口，并授权按此计划修订工件。原53/58中4.2 Windows调查及17.2／18.2旧CI唯一因果移入同一[tasks后续责任](tasks.md#后续责任不计本阶段复选框)，现53/55；4.3保Linux最终核对与macOS既定人工／受管不可用，Windows目标未交付。旧17.2最后152ms缺watch／DOM时点，18.2缺原断言时模型／工具／watch送达，新正例不回填旧事实，未声称已修。已有普通委派验收为终态设置后原5秒UI刷新，不能改称端到端5秒。

**6.2真实科研继续未完成。** run-HvCHy0的review.md仅5705字节，A2中断、A3／A4缺失，创建已保存但委派cancelled／unknown、父failed／unknown，没有最终report_delegation／任务result关联。6.2a离线准备及受控TaskPort机械1/1不等于科研通过。下一次沿已准备短报告入口，保留实际抽取、问题、原HTML及执行前独立标准，另获次数／预算／数据外发的新真实模型授权后，核真实保存→父按ref/basis读回→按最新任务依据关联，并作独立质量评价。本轮无新模型授权或调用，只修订文字及做OpenSpec strict／diff核查；本change严格校验、限定diff及任务／历史保留／归档链接核查通过，执行报告为`/home/joshua/.cache/scholoom-closeout-execution-20261030/linux-scope-edits.md`。下文历史失败、计数和当时未完任务原样保留。

## 四项主张真实验收的离线准备（8d8f339，2026-10-29）

起始HEAD=`8d8f339c3e561154b05d4db39b4264c6db2c42e6`（产品源码7a746c0）、工作区clean。先读当前AGENTS/开发说明、阶段约定、apply/contextFiles及本记录“再次授权的真实报告缺项与截断保护”。旧WIP和60614af父/子截断保护均已整合，未重放旧实现。本轮仅完成6.2a离线准备，53/58；**没有新的真实模型调用授权，真实MiniMax请求0，6.2及4.2/4.3/17.2/18.2均保持开放，未操作CI**。

### 新入口、输入身份及完成判据

本轮独立根`A=/home/joshua/.cache/scholoom-parallel-resume-20261029-A5WuXN/agent-delegation/work/`。可发现入口`A/README.md`，新修订`runner.mjs`/`brief.mjs`/`prepare-source.mjs`与逐字复用的`gateway.mjs`均在A，不覆盖旧research-live失败样本。runner仍沿原serveKernel/KernelClient/session.send、实际instance/PID采证和所属收尾；只缩短任务/指令、固定本树/新cache、在真实材料回执生成后校验完整委派对象。默认plan，execute仍须下一次明确授权及原approved/key双门。本轮未执行execute、未检查/输出真实凭据。

| 本轮输入 | 字节及身份 | 使用边界 |
| --- | --- | --- |
| inputs/source.md | 24306；与run-HvCHy0的prepared-kdFCuv/source.md逐字相同，SHA256 `c132485e7a1f7b8bf9c6f09d57b5559c462795c0a3c9c489e6d6e5b85cb7cccb` | 下次实际模型原文输入，正文抽取/空白归一，不冒称原HTML全文 |
| inputs/sample-material.md | 1898；四项合成问题及限定原字节保留 | 下次模型另一份明确材料，不预设断言为事实 |
| inputs/plos-1003285.html | 135232；原PLOS响应，DOI10.1371/journal.pcbi.1003285 | 独立评价原始来源，不另抓材料、不交模型 |
| evaluation/expected-facts.md | 9695；执行前独立标准原字节保留 | 仅评价者，答案不进入项目/父子输入 |

`A/input-manifest.json`记录所有SHA256/字节、精确旧路径、历史实际输入ref/basis及不复用声明。下一次新项目/file/basis由真实resources.create回执分配，离线没有伪造“已接入”的新身份，也不沿旧pending创建重放。新独立评价说明明确同时交付实际抽取、原HTML、问题、原标准及未来真实产物，不再让评价者只依据原HTML误判实际source.md身份；A1–A4的来源/判定/限定标准没有改写，旧审阅结论不作新评价输入。

简短报告契约见[design](design.md#真实科研四项核查的离线准备8d8f339)：A1–A4四段，每段≤180 Unicode字符，包含判定/可核定位/≤20英文词短引文/必要限定；出处末行≤200字符，总目标≤1000字符。完整题录/署名/许可仍保留在材料，报告正确短引用、不猜许可版本，不重复全元数据或删后两项换长度。字符目标不保证2048token内生成或科学质量，不是生产角色/Graph/schema的新规则。原最大2048输出token、16次、每次128KiB、累计1MiB、首请求180秒及截断拒绝不变。

父取得经实际delegationRequestSchema校验的唯一完整参数：materials为两份实际ResourceEvidence数组，outputs只在workPackage内。已静态核对实际角色、子create/report、record.artifacts[].resource读回及TaskPort的task/basis/content与result/workItemId字段；不让模型从错误字段层级试探。子正常保存并提交实际artifact，父只在completed/available且读回四项可交付后，重读原任务、按最新entry.basis保存完整候选关联，保留原头/正文/来源及任务状态。拒绝、缺项、contentChanged、pending/unknown、关联冲突或限额到期均保留原回执/真实成果并停止，不换ID重建、手填review.md或task result。下一次真实执行及独立质量验收仍由主线另行确认授权；入口退出0或机械结果不能关闭6.2。

### 实际离线检查与一次机械接线

每条命令先export TMPDIR=A，bash执行。本树生产源码未改，复用主线已验构建，未重建、安装或启动开发服务器。gpt-6.1-sol/high无历史fork辅助仅静态核当前工具字段/角色及调用链，未读凭据、判断四项结论、编辑或运行测试，已关闭。源代码没有新增公共接口，主线仅需审查本轮cache修订和验收范围，不需接入新生产符号。

| 命令/证据 | 结果与边界 |
| --- | --- |
| `node A/runner.mjs --plan`、`--prepare` | plan不启内核/gateway/读凭据；prepare仅将原24306字节抽取复制到新的prepared-iGtwKK/source.md，inputUnchanged=true。plan-final2.json/prepared.json保留结果 |
| `node A/runner.mjs --self-check` | 最终self-check-final3.log两条passed：原模式/执行门、固定模型配置、真实委派/读/创建/报告/TaskPort参数校验，错误outputs层级/workPackage.basis及顶层metadata拒绝；gateway内存边界核16次/1MiB/2048token/180秒，零网络/内核/gateway/真实凭据读取。schema-only合成身份从未向业务端派发，不抵充权限/所有权验证 |
| 长度/原字节审计 | `node A/audit-inputs.mjs`：所有输入及旧gateway逐字相同；同历史身份仅作未派发的长度比较，父2910→2430字节，子要求1305→725字节；合成schema样例父2198字节。首次比较父为2934字节尚未变短，原input-audit.log保留；压缩到当前值后未改预算/角色/材料 |
| 一次既有机械例 | `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/delegation-task-port.spec.ts --grep 'separate: complete$' --workers=1 --reporter=list,json --output A/mechanical-results > A/mechanical.log 2>&1`：**1/1**，case10.6秒、CLI总24.6秒，零跳过/重试/flaky。mechanical.json及mechanical-audit.json核completed/available、真实父子实例/PID不同、实际报告、父ref/basis读回及结果关联basis/fileId一致，任务仍active |
| 边界/首次问题 | 机械例仅通用worker/合成观察值/localhost受控HTTP；内部broker/仓储/worker/文件/保存/关联真实，没有手填review.md或task result，也未证明evidence-reviewer科研判断或新指令被真实模型遵循。一次临时stdin审计因相对import从repo cwd解析而ERR_MODULE_NOT_FOUND，first-audit-error-excerpt.log保留，改为cache-local audit-inputs.mjs后通过；不是产品失败/真实重跑 |

五份cache模块`node --check`通过；变更strict、scholoom-dev schema及diff检查见A/checks.json。没有TypeScript/生产/schema变化，不重跑无关类型/全仓/UI/截断绿色组，不把本机编译/机械通过记作产品整合、科研质量或目标平台通过。机械例finally的app/model.close已完成，原登记项目/profile保留在mechanical-results直到配置退役；本轮没有仍拥有的服务/执行或后台轮询。

已在实际执行后取当前delivery instructions更新本记录。按本轮HEAD导出独立`A/offline-preparation-8d8f339.patch`（仅本change三份工件）；cache新修订/原输入/评价说明另打包`A/offline-preparation-fixture.tar.gz`并列`A/cache-bundle-files.json`，不stage工作区改动。补丁前向/反向及真实index不变检查完成后交回；未提交/同步/push/归档。所有必需输入在Git/cache，无现有/tmp前置。准备完成即停止，下一次真实模型请求须主线再确认授权。

## 再次授权的真实报告缺项与截断保护（2026-10-29）

用户回答“授权再运行一次”后，主线仅执行一轮`research-live/runner.mjs --execute --approved-minimax`，新根`/home/joshua/.cache/scholoom-finish-active/research-live/run-HvCHy0/`。预算仍16次／1MiB累计正文／2048输出tokens／首请求180秒，未重试整项。14次真实转发、976959字节，全部HTTP200／完整返回；gateway另拒绝2次未转发请求，原子额度未放宽。父只创建一个正式evidence-reviewer委派，父子均钉入MiniMax-M2.7，子实际读取原文和问题；原材料及原任务保持不变。父子实例均exited，同一kernel退出0且stopped，采证／收尾错误为空，独立`parent-audit.json`保存核对。

子实际创建5705字节review.md，原领域保存及文件关联confirmed，父通过真实ref/basis读回。文件在A2判定说明中途结束，A3／A4完全缺失；保存字节与首次create_delegation_resource输入逐字相同，因此不是写入过程把完整报告截短。子另换operationId试图再次新建同路径，领域明确contentChanged拒绝，没有覆盖原报告；该创建意图仍pending，委派最终cancelled／resultState=unknown，父failed／remoteOutcome=unknown，没有report_delegation或任务result关联。保留原文件、未决意图及失败，不重建或手工补齐产品成果。

独立样本评估`independent-quality-review.md`核原文及执行前标准，确认A1核心判断／A2可见引文有依据、许可版本未猜测，A2残缺和A3／A4缺失构成失败。其另将source.md抽取身份列为失实，主线不采纳这一部分：实际产品输入就是`prepared-*/source.md`的正文抽取，原文／字节身份与工具读回均可核；评估者最初仅获原HTML参照，缺少这份实际抽取输入。报告把抽取文本称“原始响应全文”的表述仍不准确，“导言”定位亦需更正。上述分歧和输入限制保留，不能把样本失败写成6.2通过。

本轮受控反例进一步确认SDK会将max_tokens截断的部分工具JSON补成可解析参数，旧worker随后完成；`truncated-tool-red.log`保留原失败（收到completed）。真实回执没有保存供应商原始stop_reason，不能仅凭2048上限断言该次真实截断的唯一原因。主线针对已复现机制，在默认worker统一拒绝供应商max_tokens／规范化length的模型响应，早于工具派发且不自动重试。独审发现首版只覆盖有model wrapper的父，已移到全部普通父／子默认安装的唯一中间件；最终父／子反例和合法路径的结果见后续验证记录。该修复不检查报告文字是否完整，也不代替质量验收；此次真实授权已消费，不继续追加请求。

最终`truncated-tool-final.log`为**7/7，51.5秒**：三类非法参数的可见拒绝、合法科研父子保存及读回、父／子输出截断零工具派发、原普通图读写均通过。子反例实际先读原材料，再在create前失败／modelFailed，creations及artifacts为空、原材料保持、无报告文件；父仍能核真实失败并正常收尾。外部HTTP模型受控，内部进程／IPC／领域保存真实。harness最终构建、tools类型、Biome（既有8个warning）、架构14模块264文件0 findings及三个相关change strict／diff通过。首版仅父保护时6/6不覆盖子，现已由新第7例补齐；独审`truncated-tool-independent-review.md`保留首轮P2及最终整改复核，当前无待修生产P1/P2。

完成的是错误反馈和确定的截断保护，6.2仍未完成。下次科研验收需先把四项证据／短引文／必要限定压到明确的简短报告预算内，避免无关元数据长篇抄录；任何新真实运行须另获授权，不能直接重放本次pending创建或手工补写报告来通过。

## 已授权补跑及有界工具诊断（2026-10-29）

用户再次明确“授权，继续工作”后，主线仅补跑一次既定`research-live/runner.mjs --execute --approved-minimax`，没有扩大预算或自动重试整项。新目录`/home/joshua/.cache/scholoom-finish-active/research-live/run-aYtwL8/`保留全部原始回执及独立`parent-audit.json`。真实普通内核／TaskPort／session.send到达MiniMax-M2.7；共转发11次请求、正文941740字节，全部HTTP200且完整返回，随后gateway拒绝1次未转发请求。审计保留请求、单次／累计字节及时间等预算规则，但未记录本次拒绝的具体子条件，不能声称必然是某一个额度耗尽。

前两次delegate_agent输入分别在workPackage额外加入basis及role，被严格schema拒绝且未创建对应委派；材料对象自身的role合法。父随后创建缺少问题材料的probe-shape-01、主动取消，再创建正式check-claims-a1-a4-review-02，违反本次“一次委派”的工作要求。探测子实际读到原文，正式子未读材料；两者均无保存报告。父最终failed／remoteOutcome=unknown，原任务正文／metadata／basis与运行前完全相同，无result关联。没有产物可供A1–A4质量核查，6.2保持未完成，不以请求200或进程执行代替科研通过。

独立离线检查逐一核了父子模型钉入、三条run_instances均exited、原文及问题原字节保持、同一kernel退出0／shutdown-after=stopped，采证和收尾错误均为空。此授权已使用完；后续真实模型请求须另获明确范围，受控回放不消费该授权。

主线据上述失败仅改善既有拒绝回执：复用RemoteAgent已注册校验器，提供有界字段路径／规则／字段名，零业务派发，不回显参数值，原已派发后的unknown转换不变。现有非法输入测试改为缺outputs、workPackage额外basis、数字roleVersion三个代表，并核下一模型请求实际收到诊断及委派列表为空；合法evidence-reviewer父子保存／父读回一并回归。首次测试2通过／1失败，是测试误将材料role当非法，原日志`tool-input-feedback-tests.log`保留；按真实契约改成workPackage.basis后，最终`tool-input-feedback-final-tests.log`为**4/4，34.3秒**。内部worker／broker／仓储真实，仅外部HTTP模型受控。harness构建、tools类型及Biome通过，既有非空断言warnings保留。

独立窄审查`tool-input-feedback-independent-review.md`未见生产P1/P2；最初提出增加workPackage.role重复样例，主线依代表性测试规则未采纳：它与basis属于同一additionalProperties分支，没有独立行为风险。原意见与主线裁决保留，未以增加同类测试凑覆盖。

55ad46a／Windows专项40792137138的execution job123179671913现已success：逐组10、16、25、6、4、4、3、2、3，共**73通过／3个既有平台不适用跳过**，原取消／摘录／附件三例均通过，原期限和断言不变。日志`windows-55ad46a-execution.log`保全。同run的zotero-original仍失败，完整Checks40792137169尚未结算；不据专项关闭4.2／4.3，旧17.2／18.2缺证及6.2仍开放。

## c29a93a失败后同次观察（2026-10-29）

专项40789279376的execution job123170165986为1失败／2通过的Agent代表组：context本轮通过，附件阅读阶段仍在5秒断言报running。原artifact12861651172已一次下载为`windows-c29a93a-execution.zip`；附件trace的两个execution-stages分别属于导入和阅读，不能合并时钟或模型累计数。

阅读run bf550412-6822-45c5-9558-c5d9de85fc7c的同次记录：initialize发送1634ms、响应4059ms、两次模型请求均已完成，失败记于4798ms，controller退出4856ms，首次采到completed为4904ms；原5秒窗口尾部确有未采到的完成转换。导入run独立完成于4490ms。本次保留原失败且没有重放，证明新的失败后观察覆盖了这个窗口；不从本轮尾部现象回填0ed2c97原queued的缺证，亦不据此关闭17.2旧watch／DOM事实。两个安全JSON为`windows-c29a93a-attachment-stage{1,2}.json`。原预算及断言未改，后续须基于具体路径修夹具或明确现有契约的验收方式，不能把继续观察当通过。

## Windows同次初始化缺证的继续观察（2026-10-29）

0ed2c97／专项40784928035的execution job失败：前置10、ownership16／3不适用、HostConnection25、availability6、isolated4、ACL4、取消子Agent1、owner2及Electron重复3项通过；context与附件Agent两例在原5秒断言时queued。`windows-fd0-execution.log`及一次下载的artifact12859168740保全。context同一run记录为受理12ms、执行准备至2282ms、worker报到2864ms、initialize发送2868ms，失败4829ms、模型请求0、无初始化返回或worker stage。它缩小了阶段，不能据此在冷加载、IPC未达、初始化回调等待三者中断言唯一根因。

复用原失败后15秒观察逻辑为`observeExecutionFailure`，接这两例catch，在测试原失败已确定后继续采样同一执行，随后仍抛原错误；5秒断言、用例总预算、生产期限及重试均不变。Linux两原例`windows-observation-local.log`为2/2、34.8秒，仅证明既有成功路径未受影响，Windows新失败后阶段待目标回执，不关闭4.2／4.3／17.2／18.2。真实MiniMax补跑仍待单独答复，未追加模型请求。最新Mac实际回执引用[公共平台记录](../archive/2026-10-30-add-project-program-runs/delivery.md#0ed2c97目标平台回执2026-10-29)。

## 一次真实科研验收失败与工具参数拒绝修复（2026-10-29）

用户明确授权一次有界MiniMax验收后，主线运行`node /home/joshua/.cache/scholoom-finish-active/research-live/runner.mjs --execute --approved-minimax`。本次目录为`research-live/run-hYJu8F`：真实普通serveKernel／项目／TaskPort／会话指令已到达，MiniMax-M2.7共3次请求、实际累计正文227892字节，三次均HTTP200且完整返回；无gateway拒绝、采证错误或收尾错误。父读取真实任务及角色后发起delegate_agent，将outputs放在顶层而非workPackage内，随后执行failed／remoteOutcome=unknown，delegation列表为空、无子报告及成果关联。内核按原instanceId关闭，child退出0，shutdown-after为stopped。原材料、全部回执和失败snapshot原样保留，未自动重试整项或据此勾6.2。

用同样错误层级的受控外部模型回放已复现父执行failed。实际因果是SDK在调用工具之前的参数解析抛普通异常，内部RPC将其归为unavailable，RemoteAgent再将其误判为已受理工具失联。最小修复在既有工具收据中间件的执行回调内复用已注册toolValidators；不合schema时返回status=error、invalidRequest的ToolMessage，不派发执行回调。校验不修改输入、不猜输出路径，不改变已派发后的unknown分类。工具描述及后续验收指令同时明确workPackage.outputs，未放宽schema或重放旧委派。

原红例在`malformed-delegation-red.log`；修复后的malformed／worker／evidence-reviewer真实父子组合**3/3，34.2秒**，路径`malformed-delegation-green`。其中外部模型为受控HTTP，内核／进程／保存／读取真实，不能当科研质量通过。`tool-validation-independent-review.md`窄独审无P1/P2；独立内存核查非法输入零派发、合法输入正常派发及原失联四类错误仍为outcomeUnknown。harness构建、tools类型及相关Biome通过（既有非空断言warnings保留）。后加的明确错误码断言由`malformed-delegation-final`单例复验**1/1，18.5秒**。

6.2仍未通过；本次授权只涵盖上述一次实跑，已另行请求是否补跑，不把沉默当许可。现有evidence-reviewer角色及执行前原文独立标准继续有效，不扩大为未定义的其他科研角色或完整质量体系。

## Linux UI夹具生命周期修正与最小复验（2026-10-29）

完整Checks中的部分会话失败已在原title→stream顺序复现：前例删除仍登记的项目目录，ManualApplication.initialize按既定保护无法核查该项目已受理执行，保留全部容量；随后请求停在schedule.admission.request而未启动worker。生产保护不变。八份UI夹具将登记项目留在各例outputPath，直到所属配置退役；importSource、取消登记及故障注入的清理不变。开发说明已有该生命周期规则，未重复追加规则。双宿主全局列表的同名项目改用原project.id定位；conversation的会话搜索名称按宿主区分。

原失败和中途不同故障均保存在本轮cache的ci-ui-repro。最终sequence-accepted无临时观察器，title→stream双宿主4/4；file-explorer全组10通过／2失败，两例为rename后readFile在poll内立即抛ENOENT，最终文件已正确存在。仅将该ENOENT表示为尚未就绪供原poll重试，其他异常仍抛，期限及正文断言不变。随后targeted-final双宿主6/6、2.7分钟，覆盖该rename、pending项目及PDF跨项目保留行为；零跳过／重试／flaky，静态已构建harness、内部内核／存储真实，外部模型沿原受控HTTP。源码和构建在运行期间冻结，结束后原teardown完成。

独审ui-fixture-lifetime-independent-review.md的两处P2定位已按项目身份修正并窄复核闭合；system helper审查独立记录，不混作UI审查。Biome及tools类型通过。上述证据不等于全部25个旧UI失败均解决，也不补造17.2旧152ms的watch／DOM事实或18.2原工具阶段；这些任务仍按原判据保留。

## 真实科研验收入口已准备，等待调用授权（2026-10-29）

`/home/joshua/.cache/scholoom-finish-active/research-live/runner.mjs`默认只显示plan，prepare离线提取PLOS正文，self-check核执行门及同源模型配置schema。真实execute须同时有显式approved参数及环境凭据；当前只核到环境凭据存在，未输出值、未执行产品模型。入口沿实际serveKernel、KernelClient和session.send，由产品父子Agent创建报告并关联真实TaskPort；runner不代写科研结论，独立答案文件不进入项目或模型输入。源码角色已接收，质量任务6.2尚未关闭。

外部边界的`gateway.mjs`仅转发固定中国区MiniMax-M2.7，16次真实请求、每次128KiB／累计1MiB实际序列化请求、每次输出最多2048 tokens、首准入后180秒，重试也计入，入口自身不重试整项任务。响应至多1MiB并完整缓冲校验后交付，改变实时stream时序，不用这次验收评价流式延迟。真实key仅由proxy持有，kernel子环境使用精确合成key；上游非2xx使用固定错误，成功body也在下发前核凭据反射。停止先封外发，再有界采证和按原instance/PID停机；unknown保留，不强杀替代者或重放未知效果。

`gateway-independent-review.md`保留首次并发／截止／错误／字节计量与收尾发现及全部整改复核；最终无待修项。原反例只使用内存fetch和本轮localhost，40路并发为16接受／24拒绝，实际请求字节合计上限核到1048576；后续close竞态无新增fetch、过期不启动步骤、错误不泄露合成key。runner最终self-check及语法通过，`runner-self-check-final3.json`等保留原结果；超时不能保证取消已在途的底层磁盘IO或供应商计算，不将有界等待表述为远端已停止。

按#21的实际模型／预算授权边界，主线已另发一次具体有界产品模型请求，尚待用户答复。授权开发Codex模型不代替此项。获准后仅执行一次，按真实输入读取、保存／读回、任务关联、A1–A4来源及引用限定独立评估，失败及预算耗尽单独保留，不由runner退出0或受控模型4/4声明科研质量通过。

## 完整Checks结算仍失败（2026-10-29）

run40745284164已结算：Mac success，Windows内核789通过／5失败／85跳过，Linux内核835通过／44跳过且UI137通过／25失败／6跳过，详见[共同平台回执](../archive/2026-10-30-add-project-program-runs/delivery.md#0b5c5e3完整checks回执及下一次窄取证2026-10-29)。本change代表在专项的正例不扩大为完整平台；4.2／4.3、17.2／18.2及科研质量仍按实际任务保持开放。

## 0b5c5e3 Windows专项完整通过（2026-10-29）

主线接收run40745283855／job123017308323，head`0b5c5e37a7d7caca22ed11a16f2e4d32896ab8b4`，结论success。逐组日志合计74通过／3个既有平台不适用跳过／0失败：前置重复10、ownership16、HostConnection25、availability6、isolated4、ACL5、Agent代表3、owner2及Electron重复3。早期及最终上传均成功，最终artifact12841689572已一次下载解包至本轮cache的`startup-evidence-artifact/`；原始状态／日志及独立事实提取`windows-startup-success-review.md`可核对，不把HTML首组10项当全部累计报告。

两份释放锁后入口记录均为三路running且同一赢家实例；四份ACL探针正常退出，八次setter约200–215ms，读回权限断言不变。前置15份阶段附件均有实际worker PID及controller退出0，其中3份最终snapshotTimeout，12份保留completed／exited最终采样；保留丢弃计数，不补造超时后的状态。Agent取消／重启、摘录及附件三例有逐项成功日志，但没有本组三例的完整独立PID附件，不能挪用前置组。

本次新正例不确定旧4eb7fb6两失败或606ae82两失败的唯一原因，也不能回填17.2／18.2旧watch及UI阶段。完整Checks40745284164一次新查询仍in_progress：macOS job已success，Windows／Linux未结算；不以本专项代替完整平台验收，4.2／4.3保持开放。测试及生产期限、权限、停止／容量均未放宽。

## 首个科研角色接收（2026-10-29）

主线接受research所属`evidence-reviewer@1`，设计及文件边界见[design首节](design.md#首个科研角色与验收材料2026-10-29)。宿主未配置时采用同一预设，显式空列表／自定义替换语义及worker保留；角色只核查明确材料并创建独立报告，无原材料save权限。开发说明已同步。6.1完成，6.2真实科研质量仍未运行。

证据根`/home/joshua/.cache/scholoom-finish-active/research-role/`：research／kernel构建、类型、tools及Biome通过；原真实父子测试参数化为worker和科研角色，另核显式配置及父授save仍不能改原稿，`tests.log/json`为4/4，39.8秒，无跳过、重试或flaky。实际父子身份／PID不同，报告保存及父读回真实，所用外部HTTP模型响应受控；预设“Observed 42”不证明科研判断质量。独立审查`research-role-independent-review.md`核对角色、装配、工具交集、四例原结果及来源边界，P0–P3无发现。

`research-acceptance-sample/`保存PLOS原始HTML（DOI10.1371/journal.pcbi.1003285）、四条合成待核查断言和执行前从原文提取的独立标准，原材料与答案分离。尚未调用真实产品模型，开发Agent模型选择不替代付费产品模型授权。6.2需从真实产品入口执行、保留实际读取／成果及独立质量核查；不把本片4/4或科研角色存在当作质量通过。

## 4eb7fb6真实Windows接收：代表已绿，专项未通过（2026-10-29）

已消费run40739213209／job122995911799，head`4eb7fb66e3ade436250763826fd31b16e1d80310`。原cancel、excerpt及附件代表3/3（54秒），原5秒断言及60秒用例上限未变；同次前置重复10项、ownership16通过／3跳过、HostConnection25项、isolated首次启动／重启4项、owner2项通过。不能将源码和环境不同的606ae82两红改写成新代码必然或永远稳定，也不据此声称旧152ms缺证已补齐。

专项结论为cancelled，不是success。两个明确失败仍保留：lifecycle“undiscovered ownership”在释放锁后的三入口结果并非全running（spec:246）；首个minimal ACL探针在原期限返回probeDeadline（spec:118），其余三ACL对照及setter干扰通过。前者不能凭末断言判断启动、连接还是投影，后者不证明DACL不正确或setter慢。Electron重复仅1通过／1中断／1未跑，末在创建约15分钟时收到取消；没有目标完整trace可用，artifact列表为0，不能补造缺失附件或从总时长推唯一故障机制。

原job日志、run metadata／最终steps及空artifact清单只下载一次，位于`/home/joshua/.cache/scholoom-finish-active/worker-entry-windows-*`。为下一次保全这些失败，workflow仅在ACL组之后、剩余Agent／desktop检查之前增加独立`windows-startup-diagnostics`上传点；保留原最终上传及15分钟job预算、全部测试断言与生产期限。该上传改动尚无目标回执，不算补回本次trace。4.2／4.3及相关平台整项保持开放，科研及历史缺证亦不随3/3关闭。

## 主线窄worker入口候选及本机复验（2026-10-29）

主线沿上述Windows精确阶段继续核实际依赖，确认默认内核worker及图注册器导入宿主聚合`@scholoom/harness/node`。只读新进程对照保存在`/home/joshua/.cache/scholoom-finish-active/worker-entry-profile/`：修改前冻结dist三次交错裸导入中位数为node2929ms、driver＋registry2177ms，文件数1440／1298；有hook的加载集合与无hook耗时分别保存，不从hook时长推产品性能。聚合多出的宿主runtime／records／RemoteAgent及模块登记不属执行worker职责。

候选仅新增`@scholoom/harness/worker`包出口直接指向既有execution-driver，由同一文件公开原ExecutionGraphs；默认内核worker与注册模块改导入该出口，architecture允许准确路径。无新wrapper或独立注册权威，原控制、checkpoint、工具、权限、进程及所有期限保持；宿主继续用node出口。Windows专项触发补真实四输入，不改原5秒断言／60秒用例预算。

先构建harness、kernel，再冻结产物运行原cancel／excerpt／附件三个代表，`worker-entry-real.{log,json}`为Linux3/3、44.8秒，0跳过／失败／flaky、retries=0；内部真实worker、取消／停止／重启、持久资源及RPC不替换，模型仅外部HTTP受控。grep未匹配research-graphs用例，未计作图组通过。`worker-entry-architecture.log`／`worker-entry-biome.log`通过；`worker-context-tools.log`通过。独立只读候选接口／副作用审查见该profile根report，无发现。

本片修的是确证多余依赖，不宣称它是Windows原失败唯一根因；目标新回执尚待取得。前节606ae82及旧失败保持，4.2／4.3、17.2／18.2与科研范围未由本机3/3关闭。所有新输入／证据在Git及cache，不依赖当前/tmp。

## 主线606ae82 Windows阶段复核（2026-10-29）

专项run40729861762／job122962932735、head`606ae829720e5c0709198a6e36839929ae4fda5b`及artifact12835411610已按原日志核对。Agent代表1/3：excerpt通过，cancel和首附件失败；真实isolated4/4及ACL5/5不替代这两项。同次完整Checks40729861720仍运行，不能用旧专项3/3或跨次计数判断稳定性。

只读取证为`/home/joshua/.cache/scholoom-finish-active/agent-delegation/windows-606ae82/report.md`、`facts.json`及原trace解码入口。cancel原窗口4796ms、首附件4993ms，二者准入均已返回，实际worker分别PID1868／8556且实例已登记。execution.prepare分别3103／3269ms，initialize在observer起点3585／3732ms发送；至首次失败4844／5007ms，响应、consumed及模型准入均未观测，HTTP0。全部采样丢弃／未核身份／超时为0；最后采样只在失败后4／2ms，不能证明之后永远未完成，也不能将queued解读为未启动worker。取消尚未派发委派，附件尚未导入／保存，不能归为后段业务缺陷。

现有公开send回执、snapshot.run.id及精确instructionId的consumed状态可用于区分设置阶段，且消费来自持久checkpoint后确认；它不证明HTTP、业务完成或完整停止。本包没有观测到消费，尚不能选准备预算或宣称该候选修复有效。原内核用例总上限60秒及模型／业务5秒断言保持，未加等待、重发或改生产期限。若推进，先在同一有界run校准消费／模型／完成／停止时点，再确定设置边界；4.2／4.3、17.2／18.2及科研角色／质量继续开放。

## cb5f7ed普通委派分阶段验收

本轮Dispatch task_9084391183cc/ctx_4e69a24bea78沿原change实施，起始HEAD=`cb5f7ed30f69b45301c83f296268578051b84e0b`且clean。已读当前apply/contextFiles及原delivery，采用openspec-apply-change/codebase-design；主线ask明确批准真实子执行终态与原5秒UI刷新分阶段。本片完成第20组，51/57；**旧17.2最后152ms、18.2缺工具行、4.2/4.3平台、6.1/6.2科研角色及质量均未关闭**。未重放旧补丁、同步或改其他线文件。

### 原失败、决定及实际修正

正式输入为`/home/joshua/.cache/scholoom-round16-integration/ui-results/agent-delegation-user-obse-362c0-ains-the-conversation-draft-ui-electron/`同次trace/model-kernel/ui-window-rpc；冻结测试文本与当前修改前相同。原156行DOM断言绝对窗口1793195072083–1793195077098；该session observer起点1793195067954，子onStart4304、initialize响应7229、保存确认7973、report工具完成8194、controller退出9014、委派completed/available观测9020ms，距原失败124ms。末watch响应只有指令/run摘要，不能证明委派详情终态的送达/DOM时点；原12条sample/8条control裁剪不隐瞒，不将缺事件当未发生。不把旧失败与本机新成功run拼接，具体本片设计及既有因果图见[design](design.md#普通委派终态与ui刷新验收cb5f7ed)。

主线明确批准：多进程冷启动、多模型/工具和完整停止没有全链5秒SLA。`tests/ui/agent-delegation.spec.ts`普通成功分支仅增加同一project/session/delegationId的真实`delegation.get`终态设置等待，20秒有界预算沿现有执行完成夹具，intervals=[100,250]，计入原120秒总上限；再执行原5秒DOM完成断言及文件字节、打开成果、输入/reload草稿断言。取消分支不变，不主动刷新UI、不重发、不从文件或模型口述猜终态。不宣称accepted→完成的原5秒起点不变，不修改生产/全局期限。真实执行未完成仍失败；UI不刷新、成果缺失、草稿丢失仍由原对应断言发现。

同场景沿原附件入口增加`delegation-completion-boundary`，保存设置/终态/UI原断言时刻、同源run/父子instance和HTTP累计数；有界标量，无正文、凭据、全库、第二观察器或新RPC。finally保存边界且不吞原断言。无生产/schema/生成类型变化；不改file-workbench/窗口fixture/rpc-gate/isolated-kernel/CI。主线负责最终独立整合审查，本片不以修正设置契约冒称已证原renderer故障。

### 实跑、首次失败与真实边界

独立根`A=/home/joshua/.cache/scholoom-finish-active/agent-delegation`；所有命令export TMPDIR=A、bash执行。Linux/Node24.12.0，内部broker/仓储、权限、文件、真实受管父子/完整停止、Browser及Electron/preload均真实；仅delegationModel的外部HTTP响应受控，无付费产品模型或内部权威mock。gpt-6.1-sol/high、无历史fork辅助只读核投影调用链后已关闭，未编辑/运行测试。

| 操作 | 首次结果与最终结果 |
| --- | --- |
| 原样Electron | cache配置首轮缺type=module，加载时SyntaxError、未进入产品动作（original-ui.log）。仅为独立cache补package.json后原测试1/1通过，37.1秒，original-ui-module.log/original-ui.json；不是重跑业务红例刷绿，未重现旧失败 |
| 修改后代表回归 | staged-ui.log/staged-ui.json：Browser32.7秒、Electron44.7秒，2/2通过，总1.7分钟，retries=0。未重跑不变的取消分支或其他旧绿组 |
| 边界/成果/退出审计 | Browser真实终态设置4739ms，原UI断言46ms；Electron5060/96ms，累计模型均8（发送起点0）。同scope/delegation父子实例/PID不同，controller均已退出，completed/available、实际report字节核对通过；kernel childClosed=true，端口6017关闭。离线审计首轮误将attachments当结果根导致ENOENT，result-audit-first.log保留；仅修脚本路径后result-audit.log通过，无产品重跑 |
| 静态/规格 | 直接已安装tools tsc通过；单文件Biome退出0、保留原SCHOOLOOM_UI_DATA_DIR非空断言warning；change strict、scholoom-dev schema及git diff通过。只改测试/工件，复用已验同源产物，未构建，不把复用记为重建 |

测试命令：`export TMPDIR=A; DISPLAY=:99 SCHOOLOOM_UI_PORT=6017 SCHOOLOOM_UI_DATA_DIR=A/staged-profile PLAYWRIGHT_JSON_OUTPUT_NAME=A/staged-ui.json node node_modules/@playwright/test/cli.js test --config A/playwright.ui.config.ts tests/ui/agent-delegation.spec.ts --grep 'opens its saved report' --workers=1 --reporter=list,json --output A/staged-results`；原样使用original-profile/original-results并加`--project ui-electron`。配置在本树cwd用`node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs A/playwright.ui.config.ts`生成，A/package.json声明type=module；只用静态已构建产品，无开发服务器。每次图形前xdpyinfo :99通过（display-preflight-*.log），未启停共享显示；测试期间不重建。类型入口`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`，Biome直接用已安装node_modules/@biomejs/biome/bin/biome。

离线入口：`node A/analyze-original.mjs`从原cache生成original-failure-summary.json；`node A/audit-results.mjs`核新两宿主边界、同源真实父子/保存报告/退出和6017关闭，生成result-audit.json。profile、登记项目/报告及结果均保留，没有删除项目目录或当前/tmp接续前置。

### 新Windows正式交接与未完成项

计算线统一获取、主线明确转交`/home/joshua/.cache/scholoom-finish-active/project-execution/`的agent-three-failures.log、windows-job-122861144463.log、windows-artifact-12827896108.zip、checks-40701191661.json。核head=`1c84937346effef407ed01378f35873338790294`、run40701191661/job122861144463；完整kernel700通过/63失败/44跳过，smoke/UI skipped。只消费三个本线目标，不自行查询/下载/轮询，不按计数推共同根因或移用旧专项绿例。

| 目标 | 同次阶段（各自observer相对ms） | 边界 |
| --- | --- | --- |
| cancel:258 | admission6→6、prepare6→stream1777、worker.start1911→2295/onStart2296；initialize2300→4895，consume4950→4952；failure4997、末样本4999 running/consumed/HTTP0 | 未到委派/child/cancel；已初始化但未记录模型准入请求，不称子取消故障 |
| excerpt:603 | admission11→11、prepare13→1828、worker.start1984→2319/onStart2321；initialize.sent2346，failure4848、末样本4850 queued/accepted/HTTP0，无response | 已有真实实例；仍缺模块载入/帧放行/handler区间，不猜worker未创建或初始化未发送 |
| 附件首导入:68 | admission61→61、prepare64→1857、worker.start1977→2355/onStart2356；initialize.sent2391，failure4864、末样本4867 queued/accepted/HTTP0，无response | 未到工具、reader或撤权，不归附件读写故障，与Linux终态/UI设置是不同层 |

三例原名义5秒predicate的实际窗口4989/4834/4798ms；没有同次完成证据，不仅据窗口不足猜修轮询。samples/controls/startup/未核身份计数均0、snapshotTimedOut=false。`A/windows-three-facts.json`保存完整project/session/instruction/run/instance、绝对断言窗口及原附件路径，三份trace/stage只展开在A/windows，未复制他树私有源码。尚无确证本域生产根因，不加观测/期限或改harness/driver/原生机制；初始化载入/handler跨模块缺证交主线，计算线环境校准另由其负责。4.2/4.3仍未完成；科研角色及真实质量由主线定案，通用worker不抵6.1/6.2。

已在实际执行后取当前delivery instructions；独立补丁`A/delegation-ui-phases-cb5f7ed.patch`、检查摘要`A/checks.json`及耐久报告`A/report.md`。临时index前向/当前树反向补丁检查及真实index不变核对；最终只改本测试/design/tasks/delivery四文件。自有执行/静态承载/worker已结束，6017关闭，辅助已关闭，无后台轮询。未提交/同步/push/PR/archive，停止交主线最终验收。

## 第十六轮主线接收与阶段停止

本树两份Windows取证工件已保全提交并合入，独立Standards／Spec各0确证发现。7aff2c7专项40643346320的cancel通过、excerpt及附件失败均沿原同次事实；完整组和专项不混算。ready不等于模块loaded，已有下一窄观察建议尚未实施。本change维持49/55，不归档。

新共同产物静态双宿主整合UI为7通过／1失败。普通委派打开Browser通过，Electron在`agent-delegation.spec.ts:156`五秒完成断言失败，状态从已受理推进到“运行中 · 部分成果”，原图未到打开成果／刷新草稿断言；不是缺delegate_agent工具行的旧失败。原error-context、trace、同次窗口RPC及model-kernel观察保全在`/home/joshua/.cache/scholoom-round16-integration/ui-results/agent-delegation-user-obse-362c0-ains-the-conversation-draft-ui-electron/`，汇总`main-ui.json`。

失败时的DOM和后续清理采样分开，不把最终停止或迟到成果回填为断言已通过。主线没有延长等待、重试刷绿或扩大诊断框架；17.2／18.2保持开放。下一阶段应先沿该run核实际子执行完成、成果核查和UI刷新时点，再决定最小修正；本轮不再向Agent派发任务。必需接续输入已在Git／cache，不依赖旧`/tmp`。

## 7aff2c7后的Windows逐例取证

按第十五轮安排及429中断后的明确续接执行；起始/结束基线均为`7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`，起始clean。本片只更新原tasks/delivery：没有确证可修的本域缺陷，未改执行机制、诊断、测试或期限，未重跑已绿UI/kernel组。4.2/4.3、17.2/18.2及科研质量继续开放，49/55不变。已读取当前apply及实际取证后的delivery instructions；本片是调查交接，不把CLI状态或新增事实当完整交付。

### 官方输入、身份与原失败

本轮根`A=/home/joshua/.cache/scholoom-agent-round16-giLY3h`。旧日志消费`/home/joshua/.cache/scholoom-round15-acceptance/windows-diagnosis-ci.log`，官方artifact 12791757137下载为`A/windows-40630840362.zip`（496041字节）；只展开其windows-agent三例trace/error-context，execution-stages从trace的附件file条目解码。新官方artifact 12796333710为`A/windows-40643346320.zip`（901412字节），只展开两个失败trace；新原日志`A/logs-40643346320.zip`（42028字节）独立确认取消通过，未凭缺trace判绿。各下载均一次成功，本次续接没有429、重试或换模型。

一次状态查询`A/new-ci-once.json`截点为2026-10-28 06:54:36.962 UTC：同head的Windows专项40643346320已completed/failure，Checks40643346195仍in_progress。未再查询或等待后者。新专项checkout日志核完整head；旧/新三份测试blob逐一相同，见`A/input-source-versions.json`。取消仍用同一工作包/childHold及真实父子进程、停止/重启断言；excerpt仍传四种显式摘录/批注并核checkpoint；附件仍走真实RPC/库及原字节/权限断言。旧失败没有执行到这些后段，不能将定义中的断言写成通过。

全部时间以下均为**各自observer起点后的毫秒**，不同起点不拼接。`A/trace-facts.json`保存五份现场的完整project/session/instruction/run/instance、绝对断言窗口、原附件路径与控制事件。failure.sample是失败标记引用的最近样本，并非失败时同步重读；下表同时注明样本时刻，不能把旧样本时间写成失败时刻。清理前最终sample分别在5061/4853/4979/5023/4862ms，未提供自然完成后的观察。

| run/head及场景 | 原断言与首次失败 | 同次实际阶段及结论边界 |
| --- | --- | --- |
| 40630840362/58eda140 cancel | 首模型数≥1，5000ms窗口；failure 5059，最近样本5039为running/consumed、HTTP0 | onStart 2331，initialize.sent 2364→response 4950，consume 5011→5016；记录内无model.acquire、委派或cancel。不能称子取消失败；剩余窗口不足以证明模型准入故障 |
| 同批excerpt | completed，名义5000ms、trace外层窗口4785ms；failure 4850，最近样本2422为queued/accepted、HTTP0 | onStart 2386、initialize.sent 2419，窗口内无response/consume；清理前4853ms样本仍queued/HTTP0。已有真实worker，不能称未创建 |
| 同批附件首导入 | completed，名义5000ms、外层4907ms；failure 4974，最近样本2352为queued/accepted、HTTP0 | onStart 2321、initialize.sent 2349→response 4971，仅比失败早3ms；窗口内无consume/模型记录，尚未reader、字节或撤权断言 |
| 40643346320/7aff2c7 excerpt | completed，外层5009ms；failure 5021，最近样本4875为running/consumed、HTTP1 | admission 11→11，execute准备11→stream 1727；worker.start 1858→2197，onStart 2198；initialize 2201→4712，consume 4774→4776，model.acquire 4819→4822、model.output 4850。原poll错误的Received queued是其末次predicate值，不能盖过后续running/HTTP1；无completed，不能证明仅轮询漏采 |
| 同批附件首导入 | completed，名义5000ms、外层4795ms；failure 4859，最近样本2351为queued/accepted、HTTP0 | admission 57→58，execute准备60→stream 1859；worker.start 1986→2315，onStart 2316；initialize.sent 2348，至最后4862ms样本无response/consume/model。未到附件工具、保存或reader，不能归附件读写坏 |

原日志逐项结果：旧专项三个Agent例失败；新专项取消18.0秒通过、excerpt7.6秒及附件9.1秒失败，合计1通过/2失败。新取消的通过覆盖该例实际父子取消/持久化/重启断言，未单独取得成功例trace，不报告其内部阶段耗时或平台稳定性已关闭。它与e3c815b/40613967285的旧三绿是不同回执，也不能替代完整Windows组。

五份stage为2654–10686字节，modelRequests起点均0，samples/controls/children/stages丢弃0且snapshotTimedOut=false；新两份startup丢弃/未核身份均0，旧三份没有startup字段，不回填。所有controls均匹配同run及已登记实例，新startup的requestedInstanceId亦匹配实际实例。HTTP数来自本用例受控模型服务器，不来自其他run。仓储、broker、原生worker/IPC内部机制真实；本机仅解码官方实跑资料，没有本机Windows执行或替身验证。

### 最窄缺口与交回方案

同次证据已排除新两例卡在容量准入或onStart前：准入响应约0–1ms，execute准备约1716/1799ms，原生start约339/329ms。后两个区间是测量值，不是独立SLA，也不能推断新excerpt与新附件具有相同根因。新excerpt已模型输出但到清理前仍running，另缺自然完成、controller退出及checkpoint完成的同次记录；本片没有证据支持改其poll或扩阶段预算。

附件最窄未解释区间是initialize.sent之后到响应之前。复核`remote-agent.ts`发送Promise、`process-controller.ts`的ready/loaded分支、`process-bootstrap.ts`的import以及`execution-driver.ts`初始化handler：onStart/ManagedNode.start返回不表示入口模块已loaded；controller在原生R后发送load成功即回ready，随后模块导入/driver注册完成才放行初始化帧。现有sent→response因此仍包含模块载入、放行及初始化处理，既不能证明帧已到handler，也不能选定CPU、IPC、驱动或存储根因。沿既有design的共同启动因果图解释，未改变合同。

交主线的推荐为：若继续该跨模块片，先授权在既有可信诊断通道安全转发controller已经核验的module loaded事实，并核是否还需初始化handler进入点；沿当前同run/实例身份、白名单/容量/清理前落盘，不新造RPC或改ready含义。只需选择一个附件首导入目标，保留原断言/期限，取得loaded与handler进入的相对位置，就能区分载入前等待、帧放行/送达和handler处理。该方案涉及platform接点，**本线没有实施**；没有这些同次事实时不通过加sleep/重试/统一timeout猜修，也不因新excerpt已模型输出反推附件的原因。未给缺Windows结果或未设计科研角色补通过结论。

### 可重建入口、检查与收尾

离线重建命令：`export TMPDIR=/home/joshua/.cache/scholoom-agent-round16-giLY3h; node "$TMPDIR/analyze-traces.mjs" > "$TMPDIR/trace-analysis.log"`，从已保存ZIP解码并生成`trace-facts.json`；`node "$TMPDIR/check-evidence.mjs"`核五份身份、容量/丢弃、原窗口及新原日志逐项结果。官方下载脚本为`A/fetch-evidence.mjs`，已完成的状态/下载不可重复调用；状态与失败记录在A，令牌只在请求进程内，未保存凭据或签名URL。新日志摘录`A/new-agent-step.log`及`A/new-checkout.log`，原下载ZIP均保留，无当前/tmp接续前置。

本轮只改文档，不构建或测试，不把主线已验产物描述成重建；实际检查为OpenSpec change strict、scholoom-dev schema及git diff。记录`A/checks.log`，独立补丁`A/windows-evidence-7aff2c7.patch`含本tasks/delivery两文件；临时index前向cached与当前树反向检查，真实index保持不变。仅作原始来源/身份/时钟及diff自查，无新增高风险实现需要独立代码审查。所有取证进程已结束，未启模型/内核/UI服务、图形窗口或辅助Agent，无本轮登记项目需退役；未提交/同步/push/PR/archive。达到精确缺证交接边界后停止等主线验收。

## 第十五轮主线验收

统一启动诊断九文件已保全合入；冻结Standards／Spec均0确证问题。主线完整构建／类型通过，真实容量占满／释放两例、初始化发送拒绝开／关诊断两例及可信model-kernel一例，共5项通过；普通委派打开报告双宿主2/2通过。没有将startup请求身份提升为已运行事实，也未用新事件回填旧CI。主线补充规划授权文段的一项P2已修并独立复核关闭，与生产诊断无关。

主线额外首文件Browser通过，Electron已完成实际模型请求和取消，失败在恢复文件后的最终保存；交项目R16.1，不再归本线启动盲区。整合UI为5/6，真实接线、受控HTTP模型及新失败现场在`/home/joshua/.cache/scholoom-round15-acceptance/`。下一片消费58eda14／Windows专项40630840362三个Agent原失败的同次执行事实；如本轮新目标回执已完成可一次查询按需取证，不循环等CI、无新证据不再叠诊断。17.2／18.2、目标平台及科研质量仍开放。

## 58eda140后的统一启动前诊断

起始HEAD=`58eda1404fcc60036ce0e0f3ce30d5453ce1ee30`、clean。按第十四轮安排集中承接两份首文件和一份委派现场，没有重复各自绿色UI或恢复窗口工具投影声明。第19组交付共同诊断及校准后为49/55；**原三份CI实际阻塞点仍未知，17.2/18.2及平台/科研整项未关闭**。设计与最小因果图见[共同启动阶段](design.md#受理至onstart的共同启动阶段58eda140)。

### 三份输入与已闭合的观察缺口

消费项目原delivery“新Linux完整CI首文件场景的两份原现场”、`/home/joshua/.cache/scholoom-file-r14/{analyze-ci.mjs,inputs/}`、本线第18组及`/home/joshua/.cache/scholoom-agent-round14-8MivYs/`，原CI为e3c815b/40613967267，附件在`/home/joshua/.cache/scholoom-round13-acceptance/linux-ci-artifact/`。本轮`three-scenes.json`逐份保留project/session/instruction/run/kernel身份、原断言窗口、真实HTTP计数来源与各项缺证，不串run。两份首文件的外部HTTP计数为0；委派HTTP数未观测。三份各只有初始queued/accepted样本，随后unavailable都在原断言失败后，空controls不能证明worker未创建。

源码确认两层盲区：RemoteAgent原最早事件在onStart回调返回后；collector原要求在run_instances查到归属，而该行恰在onStart中登记。scheduler容量等待、execute准备模型/checkpoint/工具、Remote工具schema准备、ManagedNode.start原生启动等待和onStart自身都没有可绑定阶段。此外采样按应用变更/控制事件触发，没有周期heartbeat，初始样本与清理错误不能解释中间整段。这里闭合的是观察缺口，未给旧CI选根因。

原生边界另已核清：process-controller收到原生R并成功发送load即回ready；process-bootstrap随后import入口、startExecutionWorker注册处理器并回loaded，controller才放行startupFrames。因此ManagedNode.start返回/onStart不表示模块已载入，initialize.sent仅为原发送Promise成功。发送到响应之间仍包含模块导入/驱动注册/初始化的可能性；没有新增loaded/ready合同或猜定实际停点。uiRpc仍只有用户指令/run摘要，服务端工具快照不证明renderer工具收到。

### 实际接点、归属与有界性

- `packages/harness/src/remote-agent.ts`：沿原scholoom.harness.execution提供内部publishExecutionStage和可选diagnosticScope，记录Remote准备、ManagedNode.start请求/返回/拒绝、onStart请求/拒绝。现有onStart.response/initialize/consume/model及controller控制事件继续保留。没有新生产RPC、worker消息或公开DTO。
- `packages/harness/src/runtime.ts`：真实reservation.ready请求/结果、普通execute准备与进入stream、准备失败；root/子执行沿原instanceLifecycle提供实际project/session/run，注册图只传同源scope。admission.rejected仅包ready本身拒绝，不能把ready成功后的取消记成准入拒绝。原调度、await、状态、权限、checkpoint与释放责任不变。
- `tests/execution-observer.ts`：同一collector增加最多32条startup，先匹配所属scope，再查询持久runs/instructions核真实run/指令。登记前只存requestedInstanceId，不存PID或推定running；原controls/children继续按实例表核验。查询/归属失败计unverifiedStartup，数量或字节裁剪计droppedStartup，不把丢失事件当未发生。
- 指令身份完整保存；省略整条身份时记omittedInstructionIds/instructionsTruncated，避免合法长ID裁成相同前缀。body默认256KiB，同时裁样本和startup；`tests/fixtures/model-kernel-process.mjs`共用同一body的224KiB预算，为原240KiB子文件封装留空间，原256KiB父附件不变。没有正文、密钥、材料或错误原文。
- `execution-isolation.spec.ts`增加真实容量预留校准两组输入；`model-kernel.spec.ts`首两会话从实际send触发collector，覆盖首个scheduler阶段，而非先rename预创建观察器。其余六个空会话继续以真实rename验8scope上限；没有修改UI文件、窗口fixture、isolated-kernel、display/CI或其他领域符号。

### 实跑、首轮问题与独立复核

本轮独立根`/home/joshua/.cache/scholoom-agent-round15-PF9C9q/`（A），所有payload/命令先export TMPDIR=A并用bash；资料、输入、报告与调查脚本均在Git/cache。Linux/Node24.12.0，只有外部模型HTTP受控，broker/仓储/授权/真实ProcessAdmission与worker/原生完整归属均真实。容量门是测试调用原reserve取得实际槽，不伪造实例、worker或模型输出；释放后按原机制运行。测试环境读取既有processes引用，不添加生产测试注入入口。

| 实际记录 | 结果及边界 |
| --- | --- |
| `build-first` | 生产窄诊断修改后先`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`通过；这是本轮实际构建，不把此前主线复用描述成重建 |
| `build-semantic` | ready拒绝标记自查修正后，只重建harness及kernel，均通过；之后冻结产物。后续身份/字节修正仅在测试collector/入口，无生产再改 |
| `first` | 初组4/4，48.6秒：容量预留→释放校准6.5秒、原初始化发送拒绝无/有观察器2.1/2.1秒、可信model-kernel25.5秒。未声称重现旧CI失败 |
| 审查/首个检查问题 | gpt-6.1-sol/high、无历史fork辅助只读发现两项P2：指令身份前缀碰撞、startup未参加字节裁剪；均已修复静态复核。初次Biome的两个新增forEach返回风格错误也已修，原日志保留；无生产语义放宽。辅助未构建/测试/查CI，现已关闭 |
| `reviewed` | 最后针对性3/3，49.6秒：正常两指令校准6.5秒、16条长Unicode真实指令校准5.4秒、model-kernel26.0秒。没有重跑不变的发送拒绝两例或UI全绿组 |

校准先占满真实容量，再受理指令；实际queued、0 HTTP、startup只有准入request而无response/worker的断言通过。释放本测试槽后，真实worker完成并取得有效initialize响应，requested instance与实例表中的实际PID对应。短输入的两条合法ID共享128字符前缀，startup保留完整差异；长输入为16条1000 Unicode字符前缀的真实ID，附件204653字节，startup保留4条/显式丢弃4条，不再断言被裁窗口完整。未核身份计数均0，体积同时满足256/224KiB分配；测试语义是校准诊断，不是5秒全链SLA或科研产物验收。

model-kernel实际保存8scope，两个执行各有8条startup/无未核归属；原控制事件和实例/PID仍可核对，最终父附件30159字节、childClosed=true/phase=stopped。metadata审计检查字节、白名单/合成敏感字串排除、requested/实际实例关联及自有worker PID均已退出，不凭根exit推断完整停止。原归属机制和run completed/exited断言仍是事实依据。

最后命令：`export TMPDIR=A; PLAYWRIGHT_JSON_OUTPUT_NAME=A/reviewed.json node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/execution-isolation.spec.ts tests/kernel/model-kernel.spec.ts --grep 'accepted execution distinguishes|legacy model kernel' --workers=1 --reporter=list,json --output=A/reviewed-results`。首组同入口增加grep `initialization send rejection reaches`，结果各自保留。可重建审计入口`node A/summarize.mjs A/reviewed.json`输出`reviewed-audit.json`；三现场来源表为`three-scenes.json`，原构建、首组与审查前后log/JSON均保留。

tools类型、architecture（14模块/0 findings/0 granted exceptions）、OpenSpec strict/schema与diff通过；六文件Biome退出0，保留runtime既有6条warning。无协议/生成类型变化，不重复生成映射或未改宿主构建。独立补丁`A/startup-stages-58eda140.patch`含实际发布调用方、collector/可信入口、必要测试及原工件，临时index前向cached/当前树反向检查通过，真实index未改。未提交/推送或同步其他树。

### 有限判定条件与停止

原三份旧附件缺startup，不能回填或推定共同生产原因。下一次同目标取同project/session/run及startup完整身份：只有admission.request时核实际容量等待；有response而未到stream时核execute准备；到remote.prepare而未worker.start时核schema/Remote准备；有worker.start.request无返回时交原生启动区间；有start返回但onStart未完成时核宿主登记/回调；已有initialize.sent无response时仍不能拆模块载入与驱动/初始化。只在阶段确实缩到后一跨模块区间时，向主线推荐对既有loaded事实作最窄安全转发，不提前新造IPC或第二框架。unverified/丢弃/超时非0时先按有限采样解释，不把缺事件当停点；所有情况保持原期限/unknown/容量与完整停止。

本轮未调整任何原UI等待；17.2旧152ms和18.2旧工具行失败仍开放。最新f4ab1e5/40622631905 Windows688通过/53失败/44跳过只按`/home/joshua/.cache/scholoom-round14-acceptance/windows-ci.log:3631,3685,3686`回执接收，不按计数归同因，未查询/重跑CI或宣称本增量跨平台通过。

选取可信kernel fixture而非重复UI，因此6003未启服务，无图形动作/显示前置/开发服务器。本轮自有worker PID退出、模型服务器关闭、app.close及模型内核profile stopped均已核；配置/项目/结果保留。精确收尾与输入入口见`cleanup-check.json`，无现有/tmp必要内容；Windows/macOS、完整UI/分发/科研质量未验。完成本片后停止交父验收，不扩Graph/科研角色/平台合同或实施下一阶段。

## 第十四轮主线验收

三文件已保全合入。Standards无确证问题，Spec一项P2是本记录扩大窗口工具消息观察能力；主线收窄为实际可证的HTTP计数、服务端工具快照和窗口用户指令／run摘要，明确renderer工具送达仍缺证，18.2不关闭。没有为修文案再扩公共观察器。复用同源构建后，主线委派打开／取消场景双宿主4/4，tools／架构／单文件Biome通过（原有1条warning）；正常结果与取消清理均通过，不代表旧CI根因已解。

项目线已交两份首文件现场，实际受理后缺onStart前阶段，下一片统一由本线核执行推进与取证盲区，项目停止重复分析。只修确证因果，不把queued或空controls当作worker未启动，不为每个绿色场景加新诊断。原始审查／复验及范围见`/home/joshua/.cache/scholoom-round14-acceptance/`和[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)。完整平台、旧17.2／18.2及科研角色质量仍开放。

## f4ab1e5f后的Linux Electron委派入口取证

起始HEAD=`f4ab1e5f1ed17ae9af656c1f9945005a2786d911`、clean，主线已同步构建/tools与定向复验。本轮只交付普通委派工具行的诊断增量；**原Linux CI根因未闭合，18.2保持开放**。18.1/18.3完成后为46/52，原4.2/4.3、6.1/6.2及17.2仍开放。不重放旧patch、不修已绿harness后续会话或旧152ms等待，不改其他线文件。

### Windows回执与Linux原失败

正式输入根为`/home/joshua/.cache/scholoom-round13-acceptance/`（R）。Windows专项40613967285检出head为e3c815b3af6bd4b9718820f641b10bab57a69b24，`windows-diagnostic-ci.log:99`核head，356–372行核实际命令及三例3/3（52.7秒）：取消16.4秒、excerpt6.5秒、附件22.3秒。只读`git show`同head的三份kernel测试核输入与无所选skip分支：真实受限worker/childHold、材料42/允许report输出与父子实例、所属取消及重启不重放；显式摘录/草稿/checkpoint；真实RPC附件字节、reader/PDF记录、撤send无新增模型及撤read拒绝。只在HTTP模型边界受控，不当科研质量或任意科研角色验收。

安全细节在本轮`windows-receipt.json`，区分“同head源码断言+实际pass”与逐步骤trace：原artifact没有windows-agent专属trace，execution-report属于另一2×5组，不能用它伪造三例完整时间线；现有日志与Git源码已足够接收专项3/3，未重跑或新增下载。完整Checks同head的Windows692通过/46失败/42跳过仍是另一组，专项不关闭4.2/4.3。

Linux Checks40613967267同head，目标为`user observes actual delegation, opens its saved report and retains the conversation draft`，原60行toHaveCount期待1实际0、5000ms。消费R的`linux-ci.log`及artifact12786678615的同次Electron `ui-5174/agent-delegation-user-obse-362c0-ains-the-conversation-draft-ui-electron/`中的trace.zip、error-context.md和model附件`model-kernel-execution-36ad0372d4b0ef6c69cf692aef2269da871ed13e.json`。下载状态另见artifact-trace-download-status.json；条目均已存在cache，不凭另一Browser/取消例或selected entries的complete标记补证。当前目标测试、model-kernel/observer/remote-agent相对该head无源码差异（本轮增量之前），没有归因于后续未知改动。

原project=`7a1aa308-7e35-4ac7-955f-5ba54fa375b1`、session=`7447261a-beab-4dbf-b918-bb038c31fa5c`、run=`a142fb84-c7a5-471e-abe1-b3819449a79e`；capture startedAt=1793153124885，首3ms样本queued/instruction accepted，无工具或实例。原断言1793153125039–1793153130041，14次计数仍0。后两个5175ms样本是清理期间samplingError=unavailable，并非连续5秒状态记录；controls/children为空且无丢弃。HTTP计数null表示未观测，不能记0。trace没有目标工具的Electron浏览器轮询帧或同次watch附件，原用例未消费uiRpc。只能确认该次工具行未出现，不能证明worker未启动、模型没请求或已派发未显示。精确来源/窗口与缺证在`linux-original-timeline.json`；未下载失败，无远端HTTP错误可报告。

### 实际增量及边界

仅改`tests/ui/agent-delegation.spec.ts`和本change原tasks/delivery。用例接入已合入的uiRpc，清理前落盘；选中session身份取实际导航行，模型计数来自自有HTTP服务器。原工具行断言前后固定startedAt/endedAt/outcome及计数，finally最多等待500ms的一次既有workbench.snapshot，投影只保存同project/session/run、最近16条指令/工具的身份/状态/工具名，无正文、材料、token或错误文案。原错误继续传播；该读不刷新UI，不把清理时或稍后的状态冒充原断言时状态。

snapshotStatus区分missingSession/observed/rejected/timedOut，拒绝只记复用observationErrorCode的白名单码，首次结果固定、晚到RPC不覆盖超时。500ms只界定采集等待；底层最多一条原RPC受既有期限/dispose约束，未声称500ms取消。附件写入失败只加固定注释；硬总超时附件仍可能不完整。不新增RPC/schema或生产接点，不改默认5秒工具行等待、120秒用例预算、权限/容量/停止/unknown，不并改窗口fixture或计算launcher。取消分支只共享新增诊断，本轮没有宣称该UI分支新增通过。

### 原失败、实际验证与审查

新根`/home/joshua/.cache/scholoom-agent-round14-8MivYs/`（A）在首次运行前建立；所有命令先export TMPDIR=A，payload用bash，配置/项目/profile/结果/补丁均在cache。`node R/create-ui-config.mjs A/ui.config.mts`在本树cwd生成配置，静态入口为`R/preserved-tmp/static-ui.mjs`；端口始终5993，每组独立profile，逐次DISPLAY=:99的xdpyinfo预检均通过。没有读取旧/tmp入口或BBT原包，本任务不需BBT；没有新Xvfb，不停止共享显示。只改测试，复用主线已验产物，测试期间未构建。

| 验证组 | 实际结果与限度 |
| --- | --- |
| `baseline` | 原样Electron1/1，35.1秒；没有复现原CI工具行失败，不能写为已修 |
| `observed` | 新观察双宿主2/2，Browser31.3秒/Electron42.7秒，总94.86秒；工具行各4356/4342ms通过，实际模型累计0→2、同run快照delegate_agent complete/wait_delegation streaming。报告真实保存/读回/打开及原草稿/刷新断言均执行 |
| 审查修正 | 原生gpt-6.1-sol/high、fork_context:false辅助只读发现候选snapshotUnavailable合并三种失败导致缺证；补固定状态及白名单错误码。静态复核首次状态/晚到保护/原错误传播无问题，未运行测试/构建/CI，现已关闭 |
| `final` | 状态细分后仅补Electron代表1/1，36.4秒，总54.96秒；工具行4339ms通过、HTTP0→2、snapshotStatus=observed，同project/session/run与实际受理指令相符。Browser的2/2证据属于上一组，不称最终重复2/2 |

最后命令：`export TMPDIR=A; DISPLAY=:99 xdpyinfo > A/final-electron-display.log 2>&1`预检成功后，`SCHOOLOOM_UI_PORT=5993 SCHOOLOOM_UI_DATA_DIR=A/final-profile DISPLAY=:99 PLAYWRIGHT_JSON_OUTPUT_NAME=A/final.json node node_modules/@playwright/test/cli.js test --config A/ui.config.mts tests/ui/agent-delegation.spec.ts --grep 'opens its saved report' --project ui-electron --workers=1 --reporter=list,json --output=A/final-results`（A/R按上文绝对根展开）。baseline/observed命令、JSON与原log均保留；代表例没有重试、统一sleep或加时。新结果的三端身份、16项/16KiB容量与合成敏感字串排除自检通过（`summarize.mjs`、`observed-summary.json`、`final-summary.json`）；原model附件仍是父子进程与委派仓储事实源，不把工具行当child running。

tools类型、architecture（14模块/0 findings/0 granted exceptions）、OpenSpec strict/schema及diff通过；Biome最终退出0，保留原有SCHOOLOOM_UI_DATA_DIR非空断言的一条warning，首次格式错误及修正日志保留。新正例控制窗口有截断，summary保留丢弃计数，不把未保留阶段当作未发生或把窗口当完整时间线。没有schema/生成文件/生产变动，不重复生成或全仓构建。独立补丁`A/delegation-ui-evidence-f4ab1e5f.patch`临时index导出、前向cached/当前树反向检查通过，真实index不变。原样及后两组profile只读核均stopped、model附件childClosed/phase=stopped；项目和结果保留，原配置退役后不删除登记项目目录。

### 具体缺证与停止

18.2尚缺原失败1793153125039–1793153130041内：实际模型HTTP请求数、真实父instance/onStart/initialize/consume/工具开始，以及同run watch工具消息送达；旧包只有受理后3ms样本，清理报错不能补足。新观察可核原断言边界的HTTP计数及其后独立读取的服务端工具状态；窗口附件仍只记录用户指令／run摘要，不含工具消息。服务端有工具不能证明renderer已收到，现有附件无法区分工具消息未送达与已送达未应用；该项仍缺证，不据此归因。HTTP0且服务端无工具时可继续核受理至worker/model边界，但不能从空controls推断生产根因。下一片集中核执行推进的具体缺口，不重跑绿色组；只有确需区分窗口工具送达时才另行明确最小观察范围。

内部UI/RPC/broker、父子worker、仓储、材料/报告文件及授权真实；外部模型仅由delegationModel的HTTP夹具控制，Electron目录选择沿既有宿主替身。不是科研角色或质量验收。Windows专项3/3已接收但完整46失败、4.2/4.3、真实I3/I5/I6保持开放，17.2旧152ms不修。本轮必要输入与调查代码都在Git或上述cache，精确入口见cleanup-check.json，无现有/tmp内容作为接续前置；历史旧路径仅作旧证据。无依赖安装/升级/下载、开发服务、真实库、其他树操作、提交/同步/推送/PR/归档，交接后停止。

## 第十三轮主线验收

本场景被动观察与三份工件已保全合入。独立两轴审查对本线无确证缺陷；完整构建／类型／架构通过，主线后续会话普通场景双宿主均通过，原5秒期限保持。主线13项内核组合含四个model-kernel归属／失败／IPC回归全部通过。新正例不补旧152ms缺证，17.2继续开放。

e3c815b的Windows专项40613967285已成功，取消／真实excerpt／附件三个原失败用例3/3，原始日志及artifact已保全于`/home/joshua/.cache/scholoom-round13-acceptance/`。完整Checks同源码Windows内核692通过／46失败／42跳过，不能由专项绿色关闭4.2／4.3；本线下一片按[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)消费新Linux普通委派UI失败，不再修自然通过的旧后续run。所有新增工件及启动入口使用cache，不读现有/tmp内容；角色／科研质量与整项仍开放。

## ba29ee61后的后续会话完成取证

本轮起始HEAD=`ba29ee61ac6f8700cfe6a9fbaa529a8a7a75aad1`、clean，较已验e3c815b仅两份Markdown；旧增量已在共同源码，没有重放patch或自行同步。实际成果是本场景的有界被动UI观察，**旧Browser失败的根因未关闭**。17.1/17.3完成，17.2保留精确缺证；累计44/49，原4.2/4.3、6.1/6.2继续开放。设计见[后续会话UI完成等待](design.md#后续会话的ui完成等待ba29ee61)。没有业务、期限或轮询修复结论。

### 旧失败已核事实与缺口

消费`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`的main-ui-result、browser-session-execution-summary、原trace/model附件、electron-recheck及gate-recheck，不读取其他树在研成果。原Browser后续run为`e1500862-ba94-4fff-81be-26c821a25889`，session为`7b7f0733-8ea8-4b93-8b51-0069c02494a8`，capture startedAt=1793148994298。相对该capture，初始化响应3828ms、消费确认3924ms、首次准入4003ms、模型输出4041ms、controller code0退出4857ms、4875ms首次采到同run completed/实例exited。它不是首模型0或子取消失败。

原测试层断言窗口为1793148994304–1793148999325，原预算5000ms；原浏览器最后一次UI采样1793148999173仍running，与仓储completed样本处于同一显示毫秒，距断言失败约152ms，不能给两者强排先后。原包没有该次ui-window-rpc或watch completed送达/DOM应用记录；最终仓储completed不能证明原deadline内UI已完成。安全来源、trace锚点、JSON定位及独立身份表保留在本轮`main-original-timeline.json`，没有以其他运行补旧时间线。

Electron显示服务失败、provided-display的No held RPC及gate-recheck通过分开核实：最新gate场景通过且有两个实际session的watch completed，不能解释原Browser。共同RPC闸门修正已保留，本轮没有重做或修改它。

### 实际增量与验证

唯一测试源码增量为`tests/ui/harness.spec.ts`：在第二会话发送前，对实际选中project/session及“执行状态”单节点安装MutationObserver，最多32条白名单状态变化，显式丢弃计数/节点连接状态；只存身份、墙钟时点和状态，不存标题、指令、正文、材料或凭据。另存原断言起止/outcome与该测试HTTP模型累计计数。诊断读取/附件写入失败不会替换原断言错误；硬总超时下附件可能不完整，不承诺该情况已取证。监听不刷新UI、不发业务RPC，结束即解除，不做全DOM监听。原完成断言、5秒预算、60秒总预算及所有后续持久化/权限/草稿断言保留。

复用已合入的uiRpc/model-kernel附件，通过实际session.send受理、同scope唯一run及原仓储instruction/instance核对，不新增RPC/schema或生产诊断接点。DOM附件自身不声称知道run；同次三端关联由隔离结果自检完成。没有改窗口fixture、file-workbench、isolated-kernel、kernel-fixture或其他领域符号。

本轮根`/home/joshua/.cache/scholoom-agent-round13-EtWYyz/`（R）保存所有新工件与TMPDIR。Linux/Node24.12.0/已有依赖，复用主线已验共享/内核及同源桌面产物；只改测试，未重复构建。静态产品承载为用户指定`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，不是DEV样例。DISPLAY=:99的xdpyinfo预检通过，无新Xvfb或共享显示服务操作；各组独立profile/项目/5973–5975端口，项目与工件保留，生命周期清理仅针对自有内核/窗口/静态承载。

| 组 | 实际结果及边界 |
| --- | --- |
| `baseline` | 本树原样Browser **1/1通过，45.9秒**；未改原断言，不将自然通过写成旧失败已修 |
| `observed` | 候选双宿主 **2/2通过，46.6/57.4秒**，同次三端关联及脱敏/上限自检通过。显式调查候选分支没有触发；该组绿色不能验证其余量计算 |
| 审查修正 | 原生gpt-6.1-sol/high、fork_context:false辅助发现P2：测试函数起点遗漏fixture耗时，候选失败后1500ms等待可能让总超时盖过原错误。核已装TestInfo公开类型无startTime且duration结束前为0，直接删除追加等待，不依赖私有时钟或新fixture |
| `final` | 删除候选等待后的普通模式双宿主 **2/2通过，47.4/57.1秒，总126.95秒**；原完整场景断言执行，未加sleep/重试/timeout。最终只读复核无确证阻断，辅助未实跑测试/构建或查询CI，现已关闭 |

最终同次时间线相对各自原断言开始：Browser仓储completed首次样本4640ms、watch completed送达4690ms、DOM completed观察4693ms、原断言4897ms通过；Electron分别4491/4539/4545/4867ms。新正例watch到DOM为3/6ms，不能拿它补旧失败最后152ms。两端各一个真实后续run，模型累计3→6；UI/控制/样本/window丢弃计数均0，两个内核最终childClosed且phase=stopped。结果与安全字段自检在`final-timeline.json`、`final-timeline-check.log`，候选组另存，不合并运行。

最终实际命令：`TMPDIR=R SCHOOLOOM_UI_DATA_DIR=R/final-profile SCHOOLOOM_UI_PORT=5975 DISPLAY=:99 PLAYWRIGHT_JSON_OUTPUT_NAME=R/final.json node node_modules/@playwright/test/cli.js test --config R/ui.config.mts tests/ui/harness.spec.ts --grep 'user configures, edits safely' --project ui-browser --project ui-electron --workers=1 --reporter=list,json --output=R/final-results`（R按上文展开）。配置仅把原UI webServer替换为已构建静态承载，不替换业务。精确命令/原结果、profile核查与补丁检查在同根。

tools类型、单文件Biome、architecture（14模块/0 findings/0 granted exceptions）、OpenSpec strict/schema及diff检查通过；没有schema/生成类型改动，不重复运行生成或全仓检查。独立增量`R/harness-completion-observation-ba29ee61.patch`含本测试与原design/tasks/delivery；临时index前向cached及当前树反向检查通过，真实index未改，没有提交。

### 停止点与后续判据

本轮不调整等待：缺的是原失败同run在1793148999173–1793148999325间的watch completed送达与DOM completed时点。新观察已能在相同场景取得这些点；需以后真实失败同次附件才能区分：DOM在原deadline内已完成且最后轮询遗漏，才有依据修唯一局部采样；若watch/DOM在deadline后完成，则不能在本轮5秒约束下猜补；若watch已送达而DOM持续不应用，再交对应投影证据。旧附件不能重建这些事实，本轮无需泛泛等待其他线或重复跑绿色场景，17.2保持开放交回。

内部UI/RPC/broker、仓储、受管进程、文件和权限真实；仅外部模型HTTP受控。沿原测试的RPC闸门、SQLite登记失败trigger及Electron目录选择替身均为明确故障/宿主输入夹具，未伪造执行身份或科研成果质量。主线已完成29cd728/Checks40591705520的Linux750/26、UI126/32/6与Windows723/11/42及macOS分项，仅按其正式回执引用；Windows diagnosis40591705558的availability6/6/安全JSON与Agent三例失败分开。e3c815b新run40613967285/40613967267在派发记录仅in_progress，本轮未查询，不推断当前完成状态或通过；不把Windowsinitialize/consume前边界与本片合因。

未跑全仓、新Windows/macOS目标、分发包或科研质量；完整change/I3/I5/I6未关闭。原TaskPort/FileEdit、库权威、CSL草稿、旧摘录/save/undo及来源授权保持。无依赖安装、开发服务、真实库、其他树操作、Git同步/提交/推送/PR/归档。完成本窄诊断与具体缺证交接后停止。

## 第十二轮主线验收

可信model-kernel／无Playwright核心已保全合入，Standards／Spec独立审查无确证缺陷。完整构建后主线组合9/9通过，包含四个新helper回归、取消／excerpt／发送拒绝及完整附件路径。原异步stop、实例接替保护、真实close、IPC失联后的已受理执行及脱敏／有界语义保持；不是Windows或科研质量验收。

主线与窗口侧共同核对文件／科研首例的Browser、Electron四份同次project／session／instruction／run，全部匹配。科研控制事件各显式丢弃六条，不能按未保留项作未发生证明。文献／文件／科研关键路径双宿主均有通过依据；额外普通会话Browser在后续执行等待仍失败，其同run已记录消费／准入及最终completed，原失败时刻与UI投影因果尚未闭合。Electron另遇No held RPC，主线在唯一共享releaseRpcGate等真实held后再释放，定向文件／会话两项通过；没有放宽业务断言或期限。

证据`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`的main-kernel、main-ui、electron-recheck、gate-recheck、cross-observer-results及browser-session-execution-summary。首次显示服务／闸门／执行失败分别保留，不称一次全绿。下一片沿共同计划收敛该Browser后续会话；Windows初始化前的另一边界不混因，42/46及平台／质量整项保持原不足。

## 29cd728后的可信自有model-kernel诊断

起始HEAD=`29cd7283388dfd752911eacb9c3bf8416031db15`、clean；消费主线`/tmp/scholoom-round11-acceptance-Jx5Oez/`的正式验收与共同计划，没有重放旧增量或自行同步。本片第16组完成，累计42/46；4.2/4.3平台与6.1/6.2科研整项仍开放。实际设计见[可信自有观察](design.md#可信自有model-kernel观察29cd728)，不改变原变更总览中的业务/权限/停止契约。

### 实际提供者与消费边界

- `tests/model-kernel.ts`仍提供`startModelKernel(directory, endpoint): Promise<() => Promise<void>>`，原调用方无需变化。自有child执行原serveKernel；真实endpoint的PID、配置及instance经inspect/RPC/attachDevelopment核对。替换旧隔离UI夹具内核时只向已固定endpoint发一次shutdown，再有界只读核查；返回stop绑定本次实例、等待本次child close/code0及配置stopped，接替者保护不走重新发现的CLI stop。失败/stop自动保存`model-kernel-execution`附件，无Playwright上下文时保存到自有配置目录。
- `tests/fixtures/model-kernel-process.mjs`是单一可信测试入口，私有IPC只接自有父启动参数。原KernelApplication.initialize透传成功后安装真实订阅，不替换broker/仓储/worker或业务。最多8个真实project/session观察器，采集到清理或当前测试预算（最多120秒）；子文件240KiB、总附件256KiB、生命周期16条、合并写盘最多一个在途，丢弃/失败/超时计数明确。IPC失联只停观察、保留已受理执行，不发信号/强退；原serveKernel安全返回后才记录收尾。
- `tests/execution-observer.ts`从既有采集中提取无Playwright的核心；`tests/execution-diagnostics.ts`只保留原hook/flush/等待适配。32样本/32进程/32控制阶段/16标记、500ms读取预算及白名单继续适用。project/session/run/instance/父链/worker PID来自所属仓储，内核PID/instance单列；controller退出不等于完整停止。没有外部HTTP计数时明确null；`model.acquire.response`表示准入，不能当HTTP请求数。
- `packages/harness/src/remote-agent.ts`只新增首次真实SDK stream/end的`model.output`无正文标记，沿原诊断通道与受校验实例；原发送Promise、错误、权限、租约与收尾不变。无新RPC/schema/权限或server，未改lifecycle/bootstrap、isolated-kernel或项目线UI fixture。原所有调用方、根工具、恢复及标签保留。

字段仅含身份、固定安全阶段、状态/计数和白名单错误码；不写文字、材料、URL、token、密钥或通用原始帧。实际双run附件核初始化发送/响应、消费确认、模型准入、首输出、controller退出与仓储实例/PID相符；真实session.rename触发8scope上限，额外会话没有发送模型指令。原UI式配置替换由真实development bootstrap重现，不把它写成双宿主UI验收。

### 首次失败、审查与最终验证

全部本轮新工件在`/home/joshua/.cache/scholoom-agent-round12-rUeKES/`（下称R），TMPDIR同根，未向有配额问题的/tmp放大运行。Node v24.12.0、Linux、已有依赖；先`TMPDIR=R pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`通过（`build.log`），生产标记构建后不再改动，测试期间产物冻结。

| 实跑 | 结果与具体修正 |
| --- | --- |
| `model-first` | 1通过/2失败；初始化失败清理通过，两个正常启动例把已受理shutdown后的短暂unknown立即判失败。改为原生命周期预算内只读核查，绝不重发shutdown或停止接替者 |
| `model-second` | 2通过/2失败；接替者/初始化失败通过。正向双run与stop已成功，测试只create额外session未触发session级通知，错误期待drop>0；改为真实rename。IPC负例停机等待close失败 |
| `model-third` / `ipc-probe` | 分别3通过/1失败、0通过/1失败；真实serveKernel/观察清理均返回，parent已收到exit code0/signalnull但无close。候选显式exit0未改变结果，已移除，没有把强退保留为方案 |
| `ipc-confirmed` | 1/1；Node24独立小探针有/无message listener均复现主动disconnect后仅disconnect/exit，无close，否定“忽略ready”推测。仅主动断IPC负例联合核正常exit、真实serveKernel收尾与配置stopped；正常helper仍要求child close，原期限不变 |
| `final-combined` | **8/8，1.6分钟**：取消12.6秒、excerpt4.7秒、发送拒绝无/有观察器2.1/2.0秒，旧调用/关联/脱敏/上限26.8秒、接替者13.4秒、初始化失败7.1秒、IPC失联13.9秒。前面失败均保留，没有Playwright重试或统一加时 |

最后组合实际命令（R展开为上述绝对路径）：`TMPDIR=R SCHOOLOOM_EXECUTION_DIAGNOSTICS=1 PLAYWRIGHT_JSON_OUTPUT_NAME=R/final-combined.json node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/model-kernel.spec.ts tests/kernel/agent-delegation.spec.ts tests/kernel/context-instructions.spec.ts tests/kernel/execution-isolation.spec.ts --grep 'legacy model kernel|old model kernel stop|model kernel initialization failure|private diagnostic IPC|cancelling a child stops|real worker sends explicit excerpts|initialization send rejection reaches' --workers=1 --reporter=list,json --output=R/results-final-combined`。原始log/JSON、首轮结果和安全阶段摘要`final-stage-summary.json`均留在R；本轮profile仅只读核查且保留，`self-owned-profiles.json`与`final-owned-profiles.json`记录stopped。没有删除登记项目或清理旧轮目录。

独立原生辅助Agent使用gpt-6.1-sol/high、fork_context:false，只读审查与单次CI核对；发现候选IPC失联主动SIGTERM/exit会破坏unknown保护，已移除，真实hold模型执行断IPC后仍可RPC核同一实例并完成。辅助从本机Node内置源码核对主动_disconnect缺IPC关闭计数的边界，复核最终源码无确证阻断后已关闭；它未写树、构建、运行测试或读取项目线UI fixture。独立探针及内置源码摘录仅为R内调查工件，不成为生产launcher或稳定行为契约。

最终tools类型、Biome六文件、mjs语法、architecture（14模块/0 findings/0 granted exceptions）、OpenSpec strict/schema、diff均通过；生成器原始输出与仓库格式不同，按既有Biome格式化后7份映射逐字一致（`contracts-normalized.log`），未修改生成文件或schema。首次Biome格式/导入问题保留日志并修正。独立增量`R/agent-owned-model-kernel-29cd728.patch`包含三个新文件及全部调用/诊断增量和原工件；临时index导出、前向cached与当前树反向检查通过，真实index未改，无提交。

### 同源码Windows输入与未完项

仅查询一次当下目标，2026-10-27 22:16:18 UTC：40591705558/head29cd728为completed/failure，Checks40591705520同head仍in_progress；未后台等待或再次轮询。安全事实在`/home/joshua/.cache/scholoom-round11-ci-once-c8sqpQ/windows-three-cases.json`：cancel首次5061ms失败，2691ms onStart、2723ms initialize.sent，无response；excerpt4906ms失败，3775ms onStart、3815ms sent，无response；attachment4902ms失败，2340ms onStart、2371ms sent、4886ms response，无consume。三例均queued/accepted、模型0、无工具/子委派，尚未执行取消或Linux后续reader路径。onStart登记running不表示worker ready，附件初始化响应也不证明消费或模型准入；不据这些阶段修改取消/附件/恢复机制。

上述目标未包含本轮model-kernel提供者，没有本增量Windows通过结论；不同于旧938c33f完整基线，不能按55项推同因。下一步由主线接入本公共执行片及项目线窗口片，关联同一次真实UI指令；本线不私自消费在研窗口实现。若仍停在sent→response，须目标worker侧证据才能越过该区间定因；若response后无consume，继续核beforeModel/consume/准入，不猜共同IPC合同或改kernel/bootstrap。

内部Kernel/RPC/broker、仓储、受管父子进程和权限真实，仅外部模型HTTP受控；excerpt沿既有材料describe/check夹具，发送拒绝两例只替换initialize传输失败边界，初始化失败例只在自有profile制造目录障碍。没有合成身份绕授权、生产Graph/科研角色或真实科研质量验收。未跑全仓/双宿主UI/分发包，Windows本增量和macOS受管执行均未验；4.2/4.3、6.1/6.2保持开放。原TaskPort/FileEdit、库权威、报告来源授权及旧摘录/save/undo保持。没有依赖安装、开发服务器、其他树操作、真实库写入、提交/推送/PR/归档；本片交回后停止。

## 第十一轮主线验收

冻结增量经两路gpt-6.1-sol／high独立只读审查，无确证规范／规格缺陷。主线完整构建后，在生命周期／来源／Agent组合11/11中复验取消、excerpt、完整附件路径及有／无诊断的初始化发送拒绝五项，全部通过；真实内部接线、受控外部模型，原期限及授权／停止保护不变。命令、JSON及诊断在`/tmp/scholoom-round11-acceptance-Jx5Oez/main-kernel*`，完整38/42及平台／科研整项继续开放。

下一片按[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)承担自有model-kernel的有界执行取证，窗口侧由项目线独立提供；不要求科研线重复读同一旧trace。938c33f完整CI已结束且未全绿，不能作为本增量目标通过证据。

## 938c33f后的完整附件路径及初始化窄观察

起始clean，HEAD=`938c33f2c9fcafb2cce11b0c165b2fb1e9a818c3`；消费`/tmp/scholoom-round10-acceptance-j1MosP/`的验收、原冻结输入、main诊断和CI日志，没有重放旧patch或同步其他树。本轮第15组完成，change为38/42；4.2/4.3平台与6.1/6.2科研整项继续开放。**审查修正后的组合5/5通过**：原取消/excerpt/完整附件三例，加有/无观察器的初始化发送拒绝两例；此后只增强两例的故障命中断言并定向2/2通过。没有本增量Windows通过或真实科研质量结论。

### 实际增量与职责

- `literature-attachment-integration.spec.ts`：导入、reader、记录三个实际session各一个observer，全部保留到测试finally、内核清理前才stop。reader沿同session覆盖读取run与撤权新run；当前操作的observer保存首次错误，完整字节、PDF记录、撤权无新模型请求、路径及读取拒绝断言保留。`expectRunState`是本测试唯一的执行状态采样点，四段仍为原5/5/20/5秒，仅共用[100,250]间隔；批次等待未改，不再逐个断言补等待。
- `tests/execution-diagnostics.ts`：明确`modelRequestsAtStart`，仍为每observer最多32样本/32进程/16标记/256KiB及500ms诊断读取预算；另有最多32条控制阶段，截断计数可见。新控制阶段与进程记录先用所属项目只读仓储核对instance/session/run，丢弃其他会话事件。移除全局child_process订阅；children现在记录实际worker PID、onStart时点与单列的controller退出码/信号，不含未归属的其他session进程。controller退出本身不替代完整停止证明，最终实例exited仍来自原生命周期。
- `packages/harness/src/remote-agent.ts`：沿既有受校验IPC发布`scholoom.harness.execution`内部元数据，含onStart、initialize发送成功/响应/拒绝、beforeModel/consume/model.acquire请求与结果、controller退出。仅绑定instance、固定阶段及必要错误码/退出码；没有正文、载荷、令牌或密钥。sent在原发送Promise成功后才发，response是原有效初始化响应；不伪造独立worker监听就绪事件。原校验/授权/租约/异常/停止路径不变，无额外IPC调用、方法或DTO。
- `architecture.json`仅登记harness原remote-agent适配文件的`diagnostics_channel` API，没有扩大其他文件/系统API或改守卫；最终内核manifest与本源文件一致。`execution-isolation.spec.ts`扩展两个发送拒绝回归，详见下文。其余修改仅为本change原design/tasks/delivery，无协议/生成映射、库/项目/报告业务或UI变化。

设计依据与实际路径见[本片设计](design.md#附件完整路径与初始化观察938c33f)及原变更总览。模型计数为每个测试内HTTP夹具的累计数：完整路径observer起点0/2/4，撤权前后均9，不能把其他session增加的请求算入某一run。阶段mark是测试观察时点，控制事件由绑定实例的原调用链产生，均不用于猜测instruction/tool作者或赋予新权限。

### 首次失败、审查与最终验证

原始文件为`/tmp/scholoom-agent-round11-<名称>.{log,json}`；交接包`/tmp/scholoom-agent-round11-handoff-vi68Ey/`含精确命令、独立补丁、原始结果及有界附件。用户已提供同步构建，初次只改测试故复用该产物；修改生产窄观察后先构建，任何测试运行期间均未重建。

| 名称 | 实际结果及证据边界 |
| --- | --- |
| `path-red` | 首个完整观察1失败，65行首导入completed等待；4872ms失败，工具complete/累计模型2，4876ms实例stopping，尚未到reader或撤权。与主线190行撤权失败分别保留，不拼接 |
| `build` / `manifest-build` | 先`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`；架构声明补齐后再单独构建kernel复制manifest，均通过，之后才测试 |
| `combined` | 候选稿2通过/1失败，195行撤权新run等待failed。受理后3757ms初始化响应、3827ms消费确认、3901ms模型准入permissionDenied、4025ms原等待失败/4029ms实例stopping，HTTP仍9。属于审查前候选，不能作为最终发送异常语义或进程归属验收 |
| `revoke-observed` | 独立/tmp观察运行1通过，原默认轮询自然通过，没有触发捕错后的继续观察：4375ms采样到同run failed/实例exited、4996ms原断言通过；请求不增、路径批次、两个读取拒绝全部执行。临时源码未进入正式补丁，不写成故意失败红测 |
| `final` / `verified` | 统一采样后的两次候选组合各3/3；后一次是架构manifest更新后的复验。它们先于下面审查修正，不以绿色覆盖审查发现的发送/归属缺陷 |
| `reviewed-build` / `reviewed` | 审查修正后重新构建依赖链，再运行最后组合，**5/5通过，52.2秒**。取消12.1秒、excerpt4.5秒、发送拒绝无/有观察器2.0/2.1秒、完整附件19.9秒；所有原字节、PDF记录、撤权无新请求与后续拒绝均执行 |
| `send-confirmed` | 两个发送拒绝回归增加“恰好命中一次initialize拒绝”断言后定向**2/2通过**；未再重跑未变化的业务三例，不把此项加算成七个独立场景 |
| `metadata-before-review` / `metadata-final` | 同一独立元数据自检对真实候选附件因未绑定进程记录而预期exit1；修正后的**7份附件**容量、字段和session/run/worker PID对应检查通过。这是附件自检数量，非额外科研/平台用例 |

最终完整路径的reader观察覆盖两个不同run：撤权受理后529ms发送完成、3286ms初始化响应、3357ms消费确认、3422ms准入明确permissionDenied、4006ms controller退出，4044ms测试观察到failed，HTTP仍9；末样本两个实例均exited。导入/reader/记录的控制阶段18/28/30条、没有控制或进程条目丢弃；reader/记录样本分别丢弃7/8条旧样本，保留初始与最近窗口，截断明确可见。没有将未保留的样本当作完整原始时间线。

最后组合命令：`SCHOOLOOM_EXECUTION_DIAGNOSTICS=1 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/scholoom-agent-round11-reviewed.json node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/agent-delegation.spec.ts tests/kernel/context-instructions.spec.ts tests/kernel/literature-attachment-integration.spec.ts tests/kernel/execution-isolation.spec.ts --grep 'cancelling a child stops|real worker sends explicit excerpts|real RPC and Agent share material bytes|initialization send rejection reaches' --workers=1 --reporter=list,json --output=test-results/agent-round11-reviewed`。增强故障命中断言后同入口只选execution-isolation的两例，结果为send-confirmed。临时观察源码位于`/tmp/scholoom-agent-round11-revoke-probe-ZPGV6u/`，仅链接已有node_modules，没有安装/下载依赖；结果目录及隔离配置按原测试清理责任处理，不删除尚登记于活动配置的项目。

独立原生辅助Agent按gpt-6.1-sol/high、fork_context:false只读核CI并审查改动，发现候选稿两个阻断：包装漏返`ManagedNode.send` Promise，以及重叠observer收集未归属进程。两者均为本轮候选问题，已修复并静态复核关闭，辅助Agent未写树/构建/测试，现已关闭。无订阅者直接返回原Promise，有订阅者也传播拒绝；发送拒绝两例使用真实kernel/受管进程/仓储，仅在明确的initialize传输边界注入resourceLimit拒绝，验证run失败、HTTP零请求、故障只命中一次，开启观察时没有假sent且保留原拒绝码。这两个负例的传输故障替身不算实际Windows根因或正向业务验收。

静态检查：tools类型、Biome、architecture、OpenSpec strict/schema、diff通过；architecture最终14模块/0 findings/0 granted exceptions。首次architecture因缺该文件的新增Node API声明失败、两处Biome格式失败均保留日志，后续窄声明与格式已修正，没有削弱规则。补丁相对938c33f，临时index前向与当前树反向检查通过，真实index未改；生成类型沿未变schema，无整文件覆盖。

### 同源码Windows事实与仍缺输入

Windows diagnosis40540362546/job122316784767已于2026-10-27 16:35:26 UTC完成failure，head938c33f，availability步骤success、agent步骤failure。主线`windows-diagnosis.log`/`windows-diagnosis-failures.log`及安全artifact12751410950逐例一致；不能再称目标没跑，也不能认为这批旧附件已经有本轮新增控制事件：

| 用例 | 实际首次失败与最后阶段 |
| --- | --- |
| cancel | 原258行首次父模型请求≥1仍0，5014ms失败；4951ms已观察指令consumed、4966ms run running，5017ms末样本模型0，无子委派，未执行取消验证 |
| excerpt | 原603行completed等待，4857ms失败；4860ms仍queued/accepted，模型0 |
| attachment | 原64行首导入completed等待，4954ms失败；4956ms仍queued/accepted，模型0，未到reader/记录/撤权 |

三例均缺直接initialize发送/响应、worker监听就绪及model.acquire请求/准入结果；指令consumed只报告观察到的事实，不代替初始化响应证据。安全原附件与事实表在`/tmp/scholoom-windows-40540362546-txensd64/safe/`；本轮新增观察尚未在目标环境运行。下一次目标结果需按实际instance核：sent缺失先看onStart/准备阶段；sent存在而response缺失才定位到初始化等待区间；response/consume已有但模型0时再区分beforeModel或model.acquire请求/拒绝/等待。独立worker监听就绪时点若仍必需，交主线选择窄接点，不新增IPC语义或猜补kernel/bootstrap。这里只交证据和下一次定向判据，不用统一加时或修改取消逻辑。

本轮给定完整基线为8c2fd24/Checks40479176954：Linux内核746通过26跳过、UI126通过32失败4跳过；Windows688通过42失败42跳过；macOS job成功。仅回执文档差异的4312262/40476577071中Windows727通过3失败42跳过，不将不同运行计数当新源码缺陷或据一次通过关闭稳定性。938c33f的Checks40540362614仅查询一次，2026-10-27 16:39:23 UTC仍in_progress/conclusion=null；没有主动触发重跑、推送或轮询其最终状态。

### 停止与真实边界

本片已达完整路径最小修正和必要检查停止点。正向三例内部kernel/RPC/broker、仓储、父子进程、文件/库及权限真实，只有外部模型HTTP受控；PDF是既有合成有效样本，excerpt沿原describe/check夹具，不是科研角色或质量评价。发送负例替身仅用于保护传输拒绝传播；不伪造执行身份、ToolRef或资源权威。TaskPort/FileEdit、旧摘录/save/undo及生态持续外发授权均保留。

待输入仍为本增量Windows定向结果及平台整项、科研角色/guidance与真实I3质量，详见4.2/4.3、6.1/6.2。未跑全仓、UI/开发承载、分发包或macOS受管执行；不声明Windows修复。没有业务流程/期限/容量/unknown/锁归属放宽、其他树操作、真实库写入、新依赖或开发服务器；没有提交/推送/PR/归档或后台轮询。

## 4312262后的附件reader独立观察与局部修正

本轮起始clean，HEAD=`4312262c1a1f432ccd706dd1eb6ff6468765fd4e`，直接使用已同步源码；消费`/tmp/scholoom-round9-acceptance-IER31D/`的验收、计划、原诊断组合、`diagnostic-stage-summary.json`、`attachment-import-observer.json`及更新后的Windows事实。第13组已接收，取消/excerpt不再沿更早的“尚未调用cancel”设置失败描述。第14组有界工作已完成，change为34/38，平台4.2/4.3与科研6.1/6.2仍开放。**最后正式组合仍为2通过/1失败**；闭合的是原第二个reader观察与轮询问题，未宣称整条附件路径通过。

### 文件、符号与实际路径

只改`tests/kernel/literature-attachment-integration.spec.ts`及本change原design/tasks/delivery。原`observeExecution`与显式hook足以复用，`tests/execution-diagnostics.ts`无需新增机制。readScope在send/首断言之前装配自己的observer，标记readerPrepared/readInstructionAccepted，原断言失败时固定failure、finally在app清理前stop，成功标记readExecutionCompleted。导入observer仍在导入完成后停止，不能用其样本替代reader。每个scope沿原32样本/32子进程/16阶段/256KiB及500ms诊断读取上界，只保留身份、状态、工具名、计数与进程元数据；不记录正文/凭据/全库。模型计数是同一夹具的累计值，reader基准为2，不把导入请求当reader请求。

先在原轮询红测和临时观察证明时序，再按[本片设计](design.md#第二个附件reader的独立取证4312262)仅给reader完成轮询设`intervals:[100,250]`。原5秒期限、60秒用例上界不改，没有新增阶段预算、sleep或重发操作。保留真实RPC、库/worker、工具回执、原字节、PDF记录、外发撤权与路径权限断言；生产授权、unknown、停止/容量、报告Evidence/checkReadable、生命周期及协议/生成类型均未改。原变更总览中共同broker/文件及所属执行路径不变，没有新的产品状态或规格。

### Linux独立时序与验证

原始日志/JSON为`/tmp/scholoom-agent-round10-<名称>.{log,json}`，交接目录`/tmp/scholoom-agent-round10-handoff-LSLHy6/`保留独立补丁、命令、汇总和有界附件。

| 名称 | 实际结果与边界 |
| --- | --- |
| `build` | `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`通过，完成后测试，测试期间不重建同树产物 |
| `reader-red` | 1失败，红测105行reader原completed等待；4027ms首次失败、最近3751ms模型累计4/工具complete，末样本4030ms实例stopping。独立reader起点为2；3638ms工具streaming、3662mscomplete、3741ms后续模型请求已到达。导入scope另有完成附件，不混用 |
| `reader-probe` | 临时目录首次装载失败：找不到`@playwright/test`，无测试执行。仅在该/tmp目录链接本树已安装node_modules后续跑，未安装/下载依赖；原装载失败日志保留 |
| `reader-observed` | 临时观察1失败，最终重抛原错误。另一独立运行4022ms原等待失败，4239ms控制进程code0退出，4390ms观测同run completed、末样本4405ms实例exited。只读公开snapshot证明工具complete，受控模型实际收到的合成字节匹配，累计请求仍4；未重发/重放/代写成果。表明默认轮询遗漏原5秒末段，不是附件读取失败 |
| `combined` | 正式最小组合2通过/1失败（49.4秒）：取消12.5秒、excerpt4.5秒通过；附件reader4910ms观察completed，末样本4917ms实例exited/工具complete，原工具/模型字节断言及后续PDF记录断言均已执行通过。附件例20.7秒后失败于**当前190行撤权后新指令等待failed，实际running**；不是原105行reader，也不是Windows64行首导入 |

正式命令：`SCHOOLOOM_EXECUTION_DIAGNOSTICS=1 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/scholoom-agent-round10-combined.json node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/agent-delegation.spec.ts tests/kernel/context-instructions.spec.ts tests/kernel/literature-attachment-integration.spec.ts --grep 'cancelling a child stops|real worker sends explicit excerpts|real RPC and Agent share material bytes' --workers=1 --reporter=list,json --output=test-results/agent-round10-combined`。红测用同入口只选附件例，独立输出reader-red；临时观察用`/tmp/scholoom-agent-round10-reader-probe-eWKaEv/probe.config.mts`，源码/配置保留为证据，未进入正式补丁、未留下故意失败的正式用例。临时实验的有界失败后观察不改变原判定，也没有作为绿色回归。

静态检查：`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`、`node_modules/.bin/biome check --diagnostic-level=error tests/kernel/literature-attachment-integration.spec.ts`、OpenSpec strict/schema及`git diff --check`通过。补丁相对4312262，临时index前向与当前树反向检查通过，真实index未改。未改schema/生成映射、生产模块或UI，无需重建/重写它们来验证这段测试夹具。

### Windows同源码目标事实（与Linux reader分开）

Windows diagnosis40476577132/job122096177677已于2026-10-27 09:04:52 UTC完成failure，源码同为4312262。主线更新`windows-diagnosis.log`及`windows-diagnosis-failures.log`与辅助只读核对一致；不是仍无Windows证据。agent步骤实际Running 3 tests/3 failed，各例均有15个有界样本、模型计数始终0、非空run状态仅queued、指令accepted、无工具/委派、无采样丢弃或snapshot超时：

| 用例 | 原目标断言及首次失败 | 末样本与未执行范围 |
| --- | --- | --- |
| cancel | 原258行首次模型请求≥1，实际0；failure4890ms | 4895ms仍queued、只有sendAccepted；instance running不代表模型已启动，未到delegate/子取消/重启 |
| excerpt | 原603行completed，实际queued；failure4955ms | 4959ms仍queued；未到摘录/批注外发与checkpoint断言 |
| attachment | 原64行首导入completed，实际queued；failure4866ms | 4870ms仍queued、只有importInstructionAccepted；reader尚未创建，不能称目标reader失败 |

这些运行的Node控制进程在约2.1–2.2秒启动，末样本虽有running的run_instances，但run仍queued/指令accepted，不能把它等同模型或工具已派发。源码`Harness.instanceLifecycle.onStart`先登记实例running，`RemoteAgent`在该回调后才发送`execution.initialize`；当前工件缺initialize发送/响应、worker就绪/消费指令与首次模型准入之间的时点，无法区分初始化延迟、IPC等待或其他启动原因。**交主线/计算牵头的最小下一步**是针对这些精确run/instance补现有初始化/指令消费/首次模型准入的有界阶段证据，再决定是否有本域缺陷；本树不猜补跨域机制、不在未派发时调整取消逻辑或扩大超时。此Windows输入与Linux工具已complete、实例stopping的reader不同因果层。

安全工件artifact12721785916（2026-10-27 09:04:47 UTC）在`/tmp/scholoom-win40476577132-review-U82FsU/`，含原ZIP、`agent-step-log-filtered.txt`及`windows-agent/<各用例>/execution-stages.json`；交接包仅复制必要阶段和过滤日志，不复制凭据、库或模型正文。最新已完成完整基线仍按本轮提供的caf9025/40455958976：Linux743通过/1失败/26跳过，Windows687通过/41失败/42跳过；Windows原生16通过3跳过与Linux原生19通过分别表达，不沿用旧4失败或推定41项同因。4312262的Checks40476577071在辅助本次查询2026-10-27 09:06:51 UTC仍in_progress，未轮询或据启动推通过。

### 真实边界、审查与停止点

内部kernel、RPC/broker、项目/库/委派仓储、文件/字节、受管worker及取消重启真实；只在外部模型HTTP使用既有受控合成响应。PDF为既有syntheticPdf合成样本，excerpt沿原describe/check模块夹具，不冒充科研角色或质量。辅助Agent使用gpt-6.1-sol/high、fork_context:false，只读核对指定CI与安全artifact，父Agent抽查原阶段；未改树/构建/测试，已关闭。父Agent自查本地diff、原断言保留和observer成功/失败清理；本片无生产接口/数据迁移变化。

已达到原reader最小修正与相关验证停止点。新暴露的撤权新指令（同session的另一run）未安装本轮observer，完成后的reader附件不能解释它；该处失败后“不增加模型请求”、路径/后续拒绝断言尚未执行，不称外发撤权已回归通过，也不猜授权已失效。下一步应先取该新run首断言前证据，不能继续借用reader完成样本。Windows启动前缺证交主线，完整4.2/4.3及6.1/6.2不关闭；无本增量目标Windows实跑、全仓重跑、双宿主或真实科研验收。未提交/推送/PR/归档、未同步其他树、无开发服务器/新依赖/真实用户库操作；无后台轮询或下一阶段实施。

## 0b78815后的父子启动与取消观察修正

本轮在共同源码`0b788151b5e17665a26d9286dfd1d12f6e2e0c30`、起始clean的本树执行；未重放旧补丁、切分支或同步别树。消费`/tmp/scholoom-round8-acceptance-UrXA7y/`的验收、原始CI、`main-diagnostics-result.json`和`cancel-failure-stages.json`。本节为当前交付，第13组已完成；change为31/35，4.2/4.3及6.1/6.2继续开放。本轮没有生产代码、schema、生成映射、期限、容量或停止语义变化。设计依据见[取消代表例的设置与观察边界](design.md#取消代表例的设置与观察边界0b78815)，原变更总览中的真实父子与所属取消路径不变。

### 实际改动与阶段结论

- `tests/execution-diagnostics.ts`：原observer增加最多16条阶段标记，只记录阶段名、时间和受控模型请求数；沿原32条采样/32子进程/256KiB及500ms诊断读取上界。显式`installExecutionDiagnostics()`供三个observer调用文件各自安装afterEach，避免模块缓存把hook留在首个文件。保留首import原hook；completion helper自身失败立即flush，成功且未开启诊断时保留缓存供后续断言失败取证。flush幂等，重复hook不会重复附件；业务错误仍原样抛出。
- `tests/kernel/agent-delegation.spec.ts`取消代表例：依次观察父首次模型、`delegate_agent`可见、相同ID委派已受理、子running。每阶段原5秒、intervals `[100,250]`，累计名义启动预算可达20秒，受原60秒用例总上界约束；原取消确认5秒及父完成20秒不变。这是特定多进程冷启动夹具的阶段预算调整，未声称整个设置仍限5秒。新增不同父子instance/PID及正PID断言；保留同工作包、childHold、有限等待timedOut、实际取消、父完成、重启记录相等和模型请求不增加。
- `tests/kernel/context-instructions.spec.ts`：只显式安装同一诊断hook，原excerpt内容/checkpoint行为与本轮已接收采样间隔不变。
- `tests/kernel/literature-attachment-integration.spec.ts`：仅首条导入指令前装配同一observer，首run完成即停采。独立证据证明首轮同样存在轮询末段盲区后，仅此轮询设`[100,250]`，原5秒期限不变；首轮已完成时，后续reader失败不写成首轮failure。RPC、库、字节与授权断言保留；后续reader等待未改。

主线与作者时间线分别保留：主线首次4099ms失败，最近3939ms父worker running/指令consumed/modelRequests=0/无委派，4114ms才首次模型请求，尚未调用cancel。本树原样红测约4146ms已accepted但子尚未running，是另一运行。临时startup-probe在4096ms保留原失败后观察：4097ms父模型、4099ms受理、4457ms子running、9193ms请求取消、10054ms确认cancelled、10945ms父completed、10977ms重启核查。实验执行原后续断言后重抛原错误，仍计失败；不拼接不同运行时点，不把设置失败称子取消失败。阶段mark表示测试观察到条件的时点，真实onStart/实例状态由原run_instances采样核对。

### 构建、首次失败与最终结果

以下原始日志/JSON均在`/tmp/scholoom-agent-round9-<名称>.{log,json}`，完整交接增量及汇总在`/tmp/scholoom-agent-round9-handoff-U1zbxK/`。临时实验源码留在独立`/tmp/scholoom-agent-round9-{startup-probe-Ta6qqm,attachment-probe-uf3DKr,hook-probe-bCzadL}/`，未进入正式补丁；隔离登记项目保留在对应test-results，不删除登记后的目录。

| 名称 | 实际结果与证据边界 |
| --- | --- |
| `build` | `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel... build`通过，先构建后测试，测试期间无重建 |
| `cancel-red` | 原合并5秒观察1失败，保留首个execution-stages及原错误 |
| `startup-probe` | 1失败，原错误保留；同一执行后续取消/重启断言完成，提供上述独立时间线 |
| `cancel-green` | 正式取消代表例1/1通过，场景12.5秒，命令24.2秒 |
| `final` | 首个相邻组合3通过/1失败：真实报告保存与父读回、取消、父完成收尾通过；附件首轮仍running，且当时跨文件hook缓存导致缺附件，保留该失败 |
| `handoff` | 修正显式hook后2通过/1失败：取消、excerpt通过；附件首轮失败已带阶段附件，4098ms失败、模型1请求、import工具complete/worker running，不能据此猜附件写入失败 |
| `attachment-probe` / `attachment-observed` | 两个临时实验各1失败，保留原判定；后者原边界4242ms，4256ms经公开batch/readAttachment核对completed、processed1/failed0及字节匹配，4894ms原run完成，实例exited。只输出身份/状态/字节匹配布尔值，不输出正文 |
| `hook-probe` | 关闭诊断开关：故意在真实执行完成后抛`CONTROLLED_LATE_ASSERTION`，1个预期控制失败且附件保留；重复flush只有1附件的自检1通过。正式用例无故意失败 |
| `verified` | 附件首轮采样修正后最后组合2通过/1失败，取消与excerpt通过；附件首轮完成并读回实际字节，失败移到第二个reader会话，不能报整组通过 |
| `attachment-final` | 区分首轮/reader错误归属后单项仍1失败，`literature-attachment-integration.spec.ts:101`的readScope等待仍running；首轮4938ms采样已completed/实例exited，5051ms测试观察完成，无首轮failure标记。停止于该具体后续缺口，不继续扩修 |

正式测试入口为`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts --workers=1`，本轮定向使用`agent-delegation.spec.ts`的取消/报告/父收尾、`context-instructions.spec.ts`的real worker excerpt和`literature-attachment-integration.spec.ts`；诊断采集使用`SCHOOLOOM_EXECUTION_DIAGNOSTICS=1`，结果独立输出到`test-results/agent-round9-<名称>`，JSON reporter与日志如上。临时实验用各目录`probe.config.mts`，不改正式测试预期。`verified`组合并非全绿，最终单项失败也没有被较早绿色覆盖。

静态验证：`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`、已有Biome对四个改动测试文件的error级检查、`openspec validate add-bounded-agent-delegation --strict`、`openspec schema validate scholoom-dev`、`git diff --check`均通过；实际命令与退出码附交接目录。无同源schema变化，不重写生成类型。补丁相对0b78815导出，临时index前向检查与当前树反向检查通过，不变更真实index。

### CI、审查与真实边界

最新已完成完整基线为b2f3b50/Checks40447074031：Linux734通过/1失败/23跳过，Windows715通过/4失败/39跳过，macOS人工UI13通过/1失败。Windows四项分别为host-connection:169、lifecycle:137、附件首次等待:55及platform-availability:147；取消代表例在该基线Linux/Windows原始日志已有通过，不等于本轮修改在Windows通过。原始基线由主线目录保留，不沿用54项清单。

对本仓库一次只读查询截点为2026-10-27 05:34:45 UTC：0b78815的Checks40454653610仍in_progress；Windows diagnosis40454653566已success，实际仅覆盖basis-upgrade/结构工具重复10通过、ownership16通过3跳过、dev owner2通过、Electron首次装载3通过，不含完整取消或附件集成例。安全artifact与原job日志在`/tmp/scholoom-ci-evidence-WBZX2W/`（artifact12711359112）；未触发重跑、推送或等待其他线。没有本轮Windows通过结论。

只读原生辅助Agent按gpt-6.1-sol/high、fork_context:false核对CI范围及静态边界，未写树/构建/测试；父Agent抽查并处理累计20秒说明、跨文件hook与晚断言缓存问题。控制实验验证了附件保存和幂等，但辅助静态审阅不冒充目标平台独立实跑。交接收尾关闭原辅助ID时接口返回not found，当前无可继续使用的辅助执行。

内部kernel/broker、委派仓储、真实父子受管worker/文件、库/RPC及取消重启均真实；仅外部模型HTTP沿既有受控夹具，childHold为模型边界阻塞。excerpt沿原describe/check材料夹具，非实际科研角色；临时hook实验只验诊断生命周期。未绕过授权或注入合成执行身份，未访问真实用户库。

本片已达停止点。下一步是对本增量作目标Windows复验，并为附件第二reader阶段另行取得首断言前证据；本轮首轮observer不能证明该reader的模型/工具/停止阶段。4.2/4.3平台整项、6.1/6.2科研角色/guidance与真实I3质量仍开放，其他context三项本轮未重跑，不据CI源码通过代报本地验证。无提交/推送/PR/归档/依赖安装/开发服务器或后台轮询。

## 第八轮主线诊断复验

主线接入后使用诊断开关重跑excerpt、basis-upgrade及真实子取消三个代表例，仍为2通过／1失败；没有覆盖作者最后失败或称取消场景已闭合。取消例首次失败约4099ms，最近3939ms样本是父worker running、指令consumed、modelRequests=0、无delegation；4114ms最后样本才modelRequests=1，仍无子记录，尚未调用cancel。与作者某次accepted边界分别保存，不能拼接成同一时间线。early execution-stages附件确实在失败／清理后保留，数据有限且不含payload。

命令及原始证据为`/tmp/scholoom-round8-acceptance-UrXA7y/main-diagnostics-result.json`、`main-diagnostics-results/`、解出的`cancel-failure-stages.json`；其他核心领域组合86项与本组不同，不能合计为全绿。下一片沿实际受测阶段核对父模型、工具受理、子进程及onStart，先决定有依据的夹具观察边界；生产时限和停止语义不变，4.2／4.3及整项继续开放。

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
