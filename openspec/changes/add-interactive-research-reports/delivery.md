# 实际交付与交接

## 收尾核验与待选输入边界（2026-10-31）

本change保持21/27，六项完整运行／呈现／整合／最终交付任务仍未完成。只读辅助核查形成`/home/joshua/.cache/scholoom-closeout-execution-20261030/report-closeout-map.md`：现有ReportResources、冻结字节、原native provider、准确历史授权、draft／update／client及可信夹具均有实现，正式产品路径仍进入安全阅读，尚无跨身份通用活动ReportView。C单写入服务、M固定OS门、完整脚本运行策略、恢复ACK与T1/T2尚未贯通；模块通过不等于活动报告可用，亦非仅浏览器端缺口。

固定WorkerDOM的同步beforeinput取消反例继续保持Browser／真实Electron **0/2**，不重测同一反例或改成预期失败。依原授权探针plan第117–121行，决定性反例后停止该候选。源与宿主异步通信使源preventDefault晚于宿主默认动作；安装系统服务本身不解决这条输入语义，不能因此先做系统安装。原样本和普通UID子进程也未证明恶意代码OS隔离、系统IME或真实读屏。

可审阅的两种产品范围选择记录在`/home/joshua/.cache/scholoom-closeout-execution-20261030/report-input-scope-decision.md`：明确不支持跨进程同步取消默认输入、依赖者显式失败后，另定通用HTML／JS适配契约；或维持完整同步输入继续寻找成熟承载。前者缩减行为、后者没有已通过候选，均不能把当前任务直接勾完。已询问用户，未将“继续收尾”解释为选择前者；正式规格、输入／辅助要求和系统安装授权保持原边界。没有用固定React页面、图片、外部窗口或仅不可用说明代替目标后归档。

## WorkerDOM双宿主决定性反例接收（2026-10-30）

主线接收147ef729为04c2a22，只保留在tests/fixtures/report-worker-dom的实验，不接生产。固定52b619eb源码闭包113文件、Apache-2.0及parser MIT、十文件fork／可逆patch、两包metafile和原始source／host／oracle证据可核；没有npm安装、系统账户或服务。实际固定样本的Node非SERVER HYDRATE、共同Workbench tab普通输入及显式namespace MathML有往返证据，但这不是完整报告可用性。

原两宿主同一原生按键反例为0 passed／2 failed，无skip、flaky或重试：源beforeinput确已对x调用preventDefault并保持A，真实source ACK被暂扣时宿主已产生input成为Ax，独立同源码native oracle仍为A；释放后源及宿主成为AX。两宿主pageerror为空，不能将其当测试基础设施故障或改成预期失败。主线读回原JSON并由独立gpt-6.1-sol／high核源码、真实IPC、native事件与原始证据，反例成立且无使结论无效的P1/P2。

独审另发现Apache §4(b)的P2：八个修改文件没有文件内醒目修改声明。主线对十个修改文件统一补修改方／日期／声明，从已保全固定原字节离线重生成local.patch，反向检查exit0；只改许可声明，不重跑相同反例。根工具类型检查不能把旧上游混入项目新严格选项，现将该fixture作为独立TypeScript项目，由根typecheck同时运行普通tools与该项目，没有放宽产品源码选项。

原child close／exit0及自有loopback停止有收据；最后一份消费信用未归还、诊断对象到teardown才回收，Electron和内核无独立raw退出回执的粒度限制保留。第二布局、MathML innerHTML、focus／selection请求、composition竞争、旧节点／关闭竞争、信用耗尽、clipboard／find／AX、系统IME／读屏、T1/T2和生产隔离均未验。原patch独立落盘晚于首跑的顺序偏差也保留，不以事后文件倒填首跑条件。

原有界计划要求首个决定性反例后停止，主线已停止该轮并释放其worker。现已请用户选择是否明确不支持源脚本同步取消原生输入、触发时停止报告并保草稿后继续其余验证；尚未收到选择，不按默认选项推进。任务仍21/27，生产活动报告仍unavailable；科研综合独立继续。原结果及独审在本轮cache的workers/research-interaction/worker-dom/RESULT.md及worker-dom-independent-review.md。

## 固定WorkerDOM探针授权与开工（2026-10-30）

用户已明确授权引入ampproject/worker-dom@52b619eb46416c4325306de851e5a9df99697fcb固定源码闭包并按既备plan做有界适配及双宿主验证，保留Apache-2.0与parser MIT许可；仅用已有工具，不安装npm依赖，不创建系统账户或部署服务。原计划位于`/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/next/research-interaction/plan.md`，其中“待授权”已由本次回答解决，其余边界保持。

主线保全接受提交原历史且核合并文件树不变，research-interaction已快进到3511e26并完成本树build:shared（exit0），随后派发唯一探针ctx_1de861c7f56e，模型Codex／gpt-6.1-sol／high。首次启动回执turn_start_unobserved，后续实际terminal read已见其按计划工作、worker-show fleet为live；未重复派发。新证据在`/home/joshua/.cache/scholoom-closeout-execution-20261030/workers/research-interaction/worker-dom/`。本节仅记录许可与开工，结果待接收，六项完整任务仍未通过，不计生产隔离、输入等价、T1/T2或通用报告可用。

## 第27轮：部分封存P2修复接收

项目原`cbc38a4324eaeb2015618005eafdca17c02d6f2d`以`376a28a`合入，祖先桥`737cca5`保留来源。原sealed逐项保存已取得的program／gate指纹，未知字段为空字符串；未新增字段／账本或放宽v1验证，完整seal和目录sync仍先于controller构造。作者旧dist真实gate既存红例1失败后才改源码及构建，修复后必要组合6/6、真实Linux默认冻结到完整停止另1/1；原失败、两次运行和收尾分开保留在本轮根`next/project-execution/RESULT.md`。

主线先build platform再固定产物复验同一必要组合，**6/6、3.9秒**，包括原provider持久部分指纹、未知gate及零controller／scope启动；原scope-free停止确认后才释放容量。证据为本轮根`assets-fixed-build.log`、`assets-fixed-main.log`及`assets-fixed-main-results/`。独立`assets-p2-review.md`核冻结两文件与原调用，确认原P2已关闭、无新增确证P1/P2；该审查未运行测试，已结束关闭。目录sync／close等额外故障分支未因此宣称实跑。资产片现按其限定范围接收，C/M跨身份、T1/T2、活动报告承载和完整3.2／I5继续未交付，报告仍21/27。

## 第27轮：资产IO整合、审查缺口与并行接续

项目线原提交`06fafce724d3a6cb3cdb0dd7bcdc6f20f8ffde72`以`59d61f2`合入dev，`aad0127`保留原祖先。`IsolationAssets`集中原固定资产的prepare／put／seal；provider保留授权、唯一准入、串行、原记录提交及停止责任。共享preparation夹具只将布尔锁接点改为原真实isolationLock，其controller／support／领域仍为已声明替身。主线platform构建后运行整个`isolated-report-assets.spec.ts`及`isolated-report-preparation.spec.ts`，**28/28、6.4秒**；构建与测试均exit0，证据在`/home/joshua/.cache/scholoom-round27-acceptance-O1IWSr/{platform-build,assets-and-preparation}.log`。作者真实Linux默认准备到完整停止1/1为上一轮独立结果，不能算本轮重跑。

独立只读审查在第26轮根`assets-orca-review/RESULT.md`确认P2：program已写入、sync并取得指纹后，gate创建失败会令原receipt缺失该已知事实；现有部分封存用例未覆盖此阶段。审查Task已结清、retain且Delivery已处理。本轮尚未关闭此P2，design明确原sealed逐项保留真实指纹、未知字段为空字符串，整个seal成功前不能启动；项目线获派最小真实红绿及原provider持久失败核查。未因28项通过而宣称资产片最终验收通过。

七树均先clean快进`bb8b236e0fd37e59cffd30607372e444be633324`，各自platform构建exit0，四个相关JS与主线逐字节一致后才派下一轮。七条新Dispatch均已观察到live／working，模型Codex／gpt-6.1-sol／high；任务、写集及启动回执见同根`wave27-dispatches.json`。阅读线修复PDF→HTML在完整候选前卸载旧预览及绕过草稿保护；生态／文献／任务线补原批准场景的精确代表；图线核历史证据并纠正文档，委派线只读核Linux提供者规格。写集互斥，活动树保持该开工基线，最终接收归主线。报告仍21/27；WorkerDOM许可待答复，系统C/M、T1/T2、完整承载／3.2／I5、真实科研质量及目标平台不据此关闭，CI未运行。

## 第26轮：原版恢复真实双宿主接收

文献Task task_59bc81ddeee3／Dispatch ctx_1d91359a0dbc成功交回，已retain原终端及处理Delivery；原765e872→主线86d9375，六文件逐字一致后祖先桥afbb753保留原提交。主线先构建原connected夹具、核fixture/tools类型，再固定在最新真实后端产物运行新两类×Browser／真实Electron，**4/4、96.032秒**，0失败／跳过／flaky，runner六步骤均exit0；本机DISPLAY=:99、独占端口6241、全新配置/profile与输出。证据根`/home/joshua/.cache/scholoom-round26-acceptance-8hG3DX`，入口connected-main.log及connected-main/{commands,results}.json。

真实核localStorage同次写入、整份文档reload清除module memory后按原window/config/ref/basis恢复R1完整snapshot／browse／draft；R2去A不替R1授权，真实撤读后R2仍可读而R1拒绝且无页面／副本文本。原依赖实际前进仅成功unavailable可给copyOnly draft/dirty，无browse/snapshot/consumer；原已有缓存遇未知basis／真实client断开不批副本，暂扣已完成实际RPC的原回包后关闭视图，必须在release后才计结清且旧页不复活。共同正文／显式项／原basis保持，完整restore封套沿原validator，观察只读准确key。

独立connected-version-review.md核当前六文件diff、原Module及实际回执门，无确证P1/P2；首尾diff未变，审查未实跑，已关闭。作者首轮新4＋受影响旧撤权2为6/6、补强后新4/4分轮保留在第25轮根next/literature-version/RESULT.md；两项证据漏洞补强及import格式首败均保留，不将6＋4当一次全绿。主线八文件Biome、架构14模块272文件0 findings、strict及diff通过。实际CLI核自有kernel-profile state=stopped、端口6241 ECONNREFUSED，cleanup.json保留；未接管DISPLAY或用户默认profile。

页面仍为可信固定React，主线未运行报告HTML脚本、正式ReportView／桥ready、OS服务或真实模型；这不是完整3.2／I5验收，报告保持21/27。全部实际派发现已结清retained，下一片按design第26轮集中原资产IO；七个全勾选change仅整理交付依据／规格重叠，未由任务计数推断全部可归档，亦未执行归档。
## 第25轮：控制记录初始化与执行范围验收

生态原8f4808c→主线5cfa5db及祖先桥e83ab42保留两文件；新initializeExisting/loadExisting/provisionEmpty复用原根／配置／有界库存及v1验证，不新增服务／wire或记录权威。主线platform构建后固定产物运行新12＋旧2，**14/14、3.2秒**。独立bootstrap-review.md用同对象、同真实flock探针确证P2：两个并发provision均成功并生成两次配置身份；实际锁不能替代对象内串行。主线新增真实回归先跑旧dist，**1项失败，实际两个fulfilled**；结束后才修改及重建。load/loadExisting/provisionEmpty整个操作共用原serialize和create/save同一队列，含最终库存核对／返回，无新锁或队列。

修复后固定platform运行新13＋旧2，**15/15、3.1秒**；真实磁盘身份与唯一成功回执一致，另一次拒绝后仍可准确open。最终tools类型、三文件Biome、strict及diff通过；bootstrap-review-followup.md只读复核关闭P2，无新的确证P1/P2并已关闭。证据根仍`/home/joshua/.cache/scholoom-round25-acceptance-PHGzsJ`：bootstrap-main-tests.log、bootstrap-red.log、bootstrap-fixed.log、两次构建及bootstrap-fixed-{types,biome,spec}.log，均自有cache／普通UID／真实原native flock，所有锁与FD已关闭。原作者首败只有格式，14/14与本轮红／绿分开记录；Module仍未装配真实C、跨UID、K采用库存或持久许可／停止ACK，不据此关闭2.1b／T1/T2。

项目原ff2b7b4→主线2faf8c6及祖先桥31357f1保留单个新report-version-access测试，主线两类**2/2、24.3秒**：真实session.send、普通worker活动实例和受控HTTP请求产生原CallContext，再经原单方法broker调用；read/send分别实际拒绝，R2去A不替R1授权，未知原basis和错误instance拒绝。单目标上下文来自原production target路径，同目标已登记报告允许、库／第三项目来源及改目标拒绝，实际file_references不变，target撤信后拒绝。只观察super，不覆盖授权；该测试调用是宿主RPC，worker未新增工具，模型未消费该snapshot，不冒称再次模型外发或科研质量。

项目原两类＋旧目标代表3/3及加强read隔离后受影响1/1分轮保留在第24轮根next/project-execution-access/RESULT.md；主线结果在version-access-tests.log／version-access-results。新测试仅改测试文件，types／格式和架构检查通过。两条Dispatch均succeeded且retained、Delivery已处理，主线最终接收；文献原版恢复Dispatch仍在85ef694原活动基线实施，不随本轮整合换基线。

## 第25轮：原版草稿客户端接收（2026-10-30）

计算树第24轮Task task_a60718d485d4／Dispatch ctx_e53e801c8454成功交回，已retain原终端并处理Delivery。原82361ae在dev以b571323接收，两文件内容核对一致后用2e5a9d6保留原祖先，无内容差异。新增restoreReportDraft单次准确版本RPC→原草稿恢复，不写入／订阅或缓存第二正文；捕获完整identity，RPC前后核连接／配置／signal，成功snapshot还核ref/basis。RPC错误直接失败，只有成功available／unavailable才能给对应原store资格，已发调用不假取消。

主线在未变且已构建的真实后端产物运行新测试**4/4、12.7秒**，真实Manual／认证server／KernelClient／项目库／FileEdit接通：R1独有来源撤权、可读依赖前进的copyOnly、调用者改identity及abort后仍待真实回执、RPC异常与误路由真实R2成功结果拒绝。仅在真实call完成后的server回包接缝做有界延迟／失败或将请求显式误路由到另一真实已核版本，不造成功ACL／snapshot。Node无window，草稿使用原drafts内存降级，未证明浏览器落盘、真实配置切换／窗口generation或双宿主页面恢复。

证据根`/home/joshua/.cache/scholoom-round25-acceptance-PHGzsJ`：draft-client-tests.log／draft-client-results、draft-tools.log、draft-desktop.log及draft-scoped.log；tools／desktop类型、两文件Biome与架构14模块272文件0 findings均exit0，后台测试及检查进程已结清。作者模块浏览器bundle构建、4/4、首次import顺序失败与修正等原证据保留在第24轮根next/research-graph-runtime/RESULT.md。独立draft-client-review.md只读核源码／测试和调用，无确证P1/P2，已关闭；未冒称重复运行。所有新增输入／TMPDIR在持久cache。

文献树下一片按design第25轮消费该适配接真实localStorage／双宿主，先同步验证后派发。项目Agent／目标授权验收仍保持f0467a8原活动基线；只允许取得实际活动CallContext后绑定单方法原broker测试入口，不扩大context或称worker已具备该工具。生态C记录初始化Module在仅规划增量ae7c5bf开工，原records及完整库存是唯一权威，无C服务／跨UID／系统部署结果；它仍在实施，未接收。报告保持21/27，完整承载、3.2／I5和系统T1/T2不关闭。

## 第24轮：准确版本真实内核接线（2026-10-30）

证据根`/home/joshua/.cache/scholoom-round24-acceptance-88OiZP`。项目线精确版本投影已停止、冻结为ce383ac并在dev接收，保留原提交祖先；主线projects构建后运行新project-file-versions六项及原报告undo一项，**7/7**。覆盖after优先、仅before、原路径、错身份／basis、受限Agent及损坏原记录拒绝；独立只读version-review.md无确证P1/P2并已关闭。原Dispatch task_3fde7a0b6782／ctx_4a6d9d1c192a succeeded、retained，Delivery已处理；此后全部原派发均结清，没有活动树被更换基线。

主线注册只读`resources.reportVersion({ref,basis})`，接实际资源端口及`ProjectStore.versionForEvidence`，原正文／path／Evidence交`reviewHistorical`并最终同步复核完整原来源。只有完整成功返回snapshot；身份及当前资格获肯定而原字节不可得时只返回unavailable状态，不含内部Evidence／正文。未知原版、坏声明、撤权及无关错误仍失败；通用ExecutionResourcePort未扩大。库读取能力含物理可读性，可信身份端口改用实际登记／材料版本和ACL核资格，不伪造read=true。未改数据库schema、历史语义或另存版本。

原生辅助Agent仅修改ReportResources与原测试，editor构建及模块**39/39**、定向类型／格式通过，身份提供者为明确内存替身，记录在identity-port/RESULT.md。主线另在固定真实kernel产物运行新接口四项与原Manual／历史四项，首轮**7/8**：失败源于新测试更新已有文件时误用无basis的files.save，真实防覆盖正确拒绝。改用resources.save传准确依据，并扩展仅before及读途中真实撤权；只重跑受影响及新增三项，**3/3**。两轮共覆盖五个新接口用例和四个旧保护代表，不相加宣称一次完整矩阵。实际library字节缺失通过隔离夹具内重命名自有paper.md制造，登记与materialVersionId保留；拒读用真实library.grant，不注入授权成功。读途中撤权仅包装真实read完成后调用真实grant，不替换读回字节。

protocol／kernel实际构建、tools类型、受影响代码Biome、架构14模块271文件0 findings、contract generator自检、business映射与实际schema逐字符忽略空白一致及OpenSpec strict通过。第一次格式检查仅格式／import顺序失败，已用临时格式工件生成patch并经apply_patch修正；临时工件最初因cache路径被Biome忽略，改stdin处理，没有脚本改写既有源文件。原始日志分别为version-tests.log、backend-tests.log、backend-fixed-tests.log、tools-types.log及identity-port；所有主动临时输入／输出均在持久cache，不依赖/tmp。

独立backend-review.md实跑内存探针发现一项P2：通用describe把tooLarge／invalidRequest／普通异常折为read=false，新增报告端口继而误批为unavailable。主线新增真实Manual单项先红：确实成功返回unavailable；随后只给ResourceAccess.describe增加内部requireReadable选项，报告端口要求保留原探测异常，普通资源展示语义保持。editor／kernel重建后模块39＋新接口6＋旧保护4首轮**48/49**，唯一失败为新断言仍期待此前被折叠的unavailable，但真实缺文件原码是notFound；此即修复要保留的类别，改断言，不改实现。tooLarge／invalidRequest／普通异常已实际逐项拒绝，未授副本；后续只复验受影响缺字节及普通资源代表，结果见final-target.log。红例启动后源码补丁及重建与其进程有短暂交叠，测试已加载旧模块并实际复现错误，不将整段称作固定产物运行；修复后的49项在重建结束后启动。

上述受影响两项最终**2/2**；最终tools类型、Biome、架构、strict及diff通过。backend-review-followup.md独立复核关闭P2，无新的确证P1/P2，审查未冒称重跑主线测试。当前覆盖结果由原失败及定向复验共同成立，不将其改写为一次49项全绿。

客户端／草稿适配和真实Agent／目标项目授权代表为下一批，见design第24轮；工作台旧版重开等适配稳定后接入。报告仍21/27，正式承载、完整3.2／I5、系统T1/T2、目标平台及科研质量未通过。WorkerDOM源码许可仍待原答复，没有引入依赖、系统部署、CI或真实模型调用。

## 第23轮接续验收与原版恢复下一片（2026-10-30）

原版资格Module原提交6c64d9a→主线42460c2已接收，祖先关系随后以零内容差异merge保全。主线先构建editor，在固定产物运行原模块36例及真实Manual报告操作／两类FileEdit历史3例，**39/39，17.8s**，无跳过；准确日志历史中36条为report-resources、3条为report-production，未运行其余模型／目标／委派矩阵。tools类型、两文件Biome及架构通过，定向独审无确证P1/P2并已关闭。证据在第23轮根historical-checks.json、historical-module-and-production.log、historical-review.md及historical-results/。当前3.2d完成、21/27；6c64d9a源码本身不含公共RPC、FileEdit定位或UI恢复。

当前五条原派发均已结清、保留原终端并处理回执。生态离线校准包原提交2969f56→主线b77fad8，五个fixture文件已接收，零内容差异祖先桥2deff09保全；主线普通UID构建、自检**3/3**、两份unit纯离线verify、MJS格式和静态ELF检查通过，三个自有child均close。证据在第23轮根calibration-checks.json、calibration-selftest.log及system-calibration/offline-results.json。命名OpenFile的真实PID1分配、DynamicUser、实际C/M/LSM/原records/唯一准入尚未接线；当前普通数字FD和不存在scope的ENOENT对照不能代替T1。ADMIN-PLAN明确真实C身份与持久ACK等前置未齐，不能直接申请完整系统执行。

第22轮派发的计算旧版授权核查、阅读WorkerDOM探针计划、文献C-writer IO设计均已只读交回并保留原终端；没有工作区源码增量。事实和局限分别见第22轮证据根next/<tree>/RESULT.md：真实旧版fresh approval缺口、非SERVER源码／输入取消的适配成本、C唯一writer与持久ACK先于许可／释放。主线未取得依赖引入许可，WorkerDOM仍未下载／安装／执行；计划不是候选运行结果。

项目库存修复已冻结合入5e62200，主线实际8/8及独审接收，原提供者4.1完成、10/10；细节由其delivery首节维护。生态离线系统校准包此时仍在原Dispatch执行，未换其基线或接收未结清产物。

主线独立调查补得systemd v259.5按InvocationID对象路径停止的正式机制，并用普通UID实际只读XML introspection确认本机公布GetUnitByInvocationID；未调用生命周期方法，不以此证明目标授权／完整停止。定版源码、竞态与权限差分见[停止依据](../../../.scratch/scholoom-foundations/research/report-invocation-stop.md)，原始证据在第22轮根stop-identity-research。已告知生态线作为待校准候选，保留M只读cgroup视图。

下一片3.2d的行为／写集已在design第23轮和新增spec场景确定，只实现ReportResources原版资格Module，主线另接真实文件版本定位及kernel／client；报告当前20/27，完整3.2／I5和正式活动报告仍未交付。新Module由计算线在先同步核验后接新Dispatch，其他活动树不换基线。

计算树已先clean快进f4076d7，重建实际变化platform并核tools类型后，派Task task_29a18ed5274f／Dispatch ctx_1ec5c2354d54，已观察live／working。Prompt及同步／启动证据在第23轮根dispatch。该活动树保持f4076d7，其后主线只接收无关离线fixture／记录，不再同步它；其他终端等待真实前置，新源码引入授权仍待用户，未据时间默认批准。

该计算Dispatch现已succeeded并retained，回执已处理；原五条及本后续片均结清。下一片是design第23轮的ProjectStore精确版本投影，先同步再交项目树，主线继续统筹真实内核操作；不将原39例称为真实旧版草稿重开已通过。

## 第22轮主线验收（2026-10-30）

接收上一轮四条实际派发：项目IO研究仅cache，无源码增量；生态`d2c4c88`→主线`cc6939d`为固定FIFO gate；阅读`f2fdf4a`→`b408f01`为R2d静态路线比较；文献`e62bb8c`→`79db846`为真实客户端工作台组合。其余三树上一轮是已确认的等待状态，不存在应收而漏收的源提交。全部七树本轮同步前均clean。报告仍20/26，不以夹具新增代码或重复子范围增加完成数。

证据根`/home/joshua/.cache/scholoom-round22-acceptance-noQKV1`；原交回在第21轮根的`next/<tree>/RESULT.md`。主线实际验证：

- `TMPDIR=<本轮cache>/tmp node tests/fixtures/report-system-gate/rebuild.mjs <本轮cache>/gate`与`node --test tests/fixtures/report-system-gate/selftest.mjs`通过5/5，含G＋EOF唯一许可、EOF／非法／重复许可不执行、FD42正控制和放行前实际关闭。编译复用原静态probe及原policy；仅普通当前UID，无PID1、跨UID、文件视图或完整停止证明，FD3观察只用于夹具，不能当安装gate。
- `DISPLAY=:99 SCHOOLOOM_UI_PORT=6207 TMPDIR=<本轮cache>/tmp node tests/fixtures/report-connected/run.mjs <本轮cache>/connected-ui`完成build／fixture types／tools types／static-config及真实Browser／Electron **4/4**，90.757s，零跳过／重试／flaky。真实认证loopback broker、project／library／report、KernelClient、report-client、updates／drafts／context、useBusinessSession及Workbench共同composer／inspector均接通。页面仍是可信固定React，未执行实际报告HTML或scripts，没有OS runtime或bridge-ready。输出`connected-ui/results.json`，入口结果`connected-check.json`及`connected-ui.log`；专属kernel／profile／server由runner收尾。
- gate局部Biome及diff通过；组合runner已做tools及静态配置检查。本轮新增主体是fixture／tests／文档，无生产运行代码改动，不重建全部packages或重复主线已绿矩阵。其余最终格式／规格／同步结果留在本轮cache。

原文献自审首败是route.fulfill文档触发Browser LNA websocket拒绝，改为真实私有loopback HTTP；项目粗通知不承诺准确path，修正过严断言。原独审发现同basis重新采用销毁consumer后未重新挂载，经页面实例key修复并核实际附加成功。主线保留这些首败，不改浏览器权限／超时刷绿。阅读R2d和新增WorkerDOM／Remote DOM研究为固定来源静态核查，无新候选运行结果。辅助metadata区分源码SHA与npm gitHead，取得路径和依赖事实在`worker-dom-research/installation-inputs.md`；未下载／执行完整候选或安装依赖。

独立default／gpt-6.1-sol／high辅助按真实fixture链和库存规格／写集定向审查，无确证P1/P2，已关闭；准确源码依据见本轮`review.md`。未重跑已通过矩阵，不将静态审查当新增运行结果。

下一片以design第22轮为准。主线选择非root C唯一管理原records／字节，M为窄OS门；原M-writer模板降为历史候选。IO研究确认缺根库存对照，原提供者新增4.1，9/10待验，不删孤儿或漏库存后准入。其他线分别准备离线系统校准包、C-writer私有提交设计、旧版本草稿来源核查；呈现探针的固定源码引入单独请求授权，授权前不实施。系统账户／安装／策略／T1／T2、真实模型、CI、系统IME／读屏、Windows／macOS和完整2.x／3.x／I5仍未验，不归档。

## R2c固定可信输入事务交回（第20轮续做，825f3fac）

本片从`825f3fac57664a8d07f70e1145a3baee1434273c`及clean续做；用户中断前没有本片工具执行／新进程。读取当前apply及原交付，实际执行后取得delivery instructions。写集仅新`tests/fixtures/report-input/`与本change的R2c段落，原R2／R2b反例和其他四片源码／事实未改，未同步或重放WIP。当前仍16/26，完整活动报告／正式R2／2.1b／T1／T2／I5未关闭。

`createInputTransaction`把一次在途、最新输入意图、待采用回包及原view／文档token／请求代次封在私有夹具模块；首次加载后保留原文档及输入节点，只在真实源确认最新输入后更新固定表格／count。`InputView`复用实际Workbench共同tab、禁脚本frame和原生表单／DOM／MathML；`createInputController`只按两个固定owner分配原真实结构控制器，未复制筛选／排序状态。合成ResourceTarget／basis／接收者及HTTP控制器是显式替身，无ReportResources授权、composer发送、内核／provider／OS服务或生产容量权威。具体观察与未验由[investigation的R2c节](investigation.md#r2c固定可信输入事务校准第20轮续做825f3fac)维护。

证据根`/home/joshua/.cache/scholoom-round20-acceptance-INWZnx/next/research-interaction/`；短TMPDIR由attempt-1/short-tmpdir.txt记录为`/home/joshua/.cache/r2c-ycpMSD`。必要源码在Git夹具，输入／profile／配置／结果在cache，无现有/tmp前置。Workbench／源页在夹具build重新bundle，产品main／preload／kernel复用主线已验产物，不冒称重建产品。复建与手动入口见[README](../../../tests/fixtures/report-input/README.md)，静态harness沿round13保全入口。

实际验证与首次问题：

- `node tests/fixtures/report-input/run.mjs <cache>/attempt-1`：先xdpyinfo、夹具build／类型，再固定产物跑双宿主两场景；4/4，78.7秒，0失败／skip／flaky／retry。真实回包门控保持原请求／源执行／HTML，不伪造状态；覆盖普通意图合并、composition期间保护、提交及CDP清除后的真实源确认、版本替换和关闭迟到不复活，以及数学／选区复制／可见查找／AX最小代表。首轮无测试红例。
- 同模型high、无历史fork辅助只读发现排序拒绝未反馈的P2，未运行测试；父补恢复已确认order及controlConflict反馈，不改事务模块或pending文字。补充同次held回包断言；最终`node node_modules/@playwright/test/cli.js test --config <cache>/final/input.config.mts --grep 'fixed input transactions'`在新端口6204／配置、先build／夹具类型并冻结产物后，受影响双宿主2/2，51.1秒、0失败／skip／flaky／retry。静态窄复核确认P2闭合，报告在review.md；未宣称再次独审OS或正式报告。生命周期组未在最终bundle重复运行，原事务模块未变，不把4+2相加为一次全绿。
- `node <cache>/check-manual.mjs`实际打开Browser和Electron，各ready=true、exit0，使用首轮bundle；只验证入口与收尾，不冒称手动跑完全部竞争。最终反馈修正由上述新bundle定向组验证。manual-electron/electron-profile.json核userData／sessionData／storagePath同在自有profile；自动组沿主线新shared fixture每用例隔离，不新增default profile或unsafe参数。
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`首查和修正后均退出0（tools-first／tools-final.log）；夹具类型日志在attempt-1／final内，均通过。首轮后格式检查见3 errors，首次完整stdout未重定向且工具输出截断，cache的first-format-observation.md仅保存真实命令／所见诊断节录；随后通过stdin formatter及apply_patch整理，最终完整Biome日志见RESULT。没有伪造原完整日志或业务红例。
- 架构直接`node scripts/check-architecture.ts`，14模块270文件0 findings；没有新增架构登记或生产schema，不重复全量packages／kernel构建、生成映射、无关旧UI矩阵或CI。最终strict／schema／diff／补丁反向检查、文件清单与全部实际命令结果见cache RESULT及final-checks.json。

各input-evidence.json保存同次源／候选／已显示代次、文档／输入identity、真实值、光标及请求观察；MathML／文字／AX截图与复制值同目录。CDP清除组合实际产生空值、光标0，本片把这个实际值送源确认，不将其推断为真实系统IME取消。诊断固定40条并显式记录丢弃数，输入／代次上限代码有界，未刷满128代或洪泛验证。传输失败保留输入并停止推进、不自动重发；其恢复UX未验。

各closed.json逐个实际读回源浏览器连接、原源／呈现服务及新入口服务关闭；真实Electron沿原closeDesktop等其进程退出，自有测试内核按既有teardown确认stopped后退役配置。没有项目登记或OS scope，不以这些测试API提升为生产完整停止／容量证明；只读辅助已关闭。没有依赖安装／CI／真实模型／用户库／系统策略操作、提交推送或其他工作树写入。

本片止于固定可信候选交回。它没有解决任意HTML／CSS／canvas、自主页面变化、完整文字范围／跨控件并发、reload／跨tab恢复、真实资源／接收者授权、系统IME候选窗／读屏、OS身份服务、Windows／macOS或科研质量。主线后续需决定正式架构及与来源／动作／生命周期module的接缝，本片不创建公共协议或自行接下一片。独立patch及新文件清单随RESULT交回后停止。

## 第20轮主线验收（2026-10-29）

五树25文件逐树冻结并合入dev，起点0d27cff；原提交、清单及作者终端回执见 `/home/joshua/.cache/scholoom-round20-acceptance-INWZnx/` 的frozen.json、inventory.json及*-terminal.json。主线接收3.1a正常发布／发布前条件冲突、3.1b独立metadata更新、3.2a版本状态保管、3.2b真实registered报告等待接续，当前16/26。3.1a按第19轮已允许的失败代表接收，普通worker保存关联unknown尚未实跑，新增3.1c明确保留；不缩减完整3.1契约。

主线先重建实际变化的desktop，复用未变packages／kernel，固定产物后运行组合：updates7、report-drafts5、普通发布2、等待接续2、原草稿1、共同贡献4，共21/21、1.9分钟。tools／desktop类型与架构14模块270文件0 findings通过。原R2b结构夹具真实Browser／Electron各1，共2/2；数学结构／AX保留，但暂缓真实回包后整体srcdoc替换清空未提交组合输入，两宿主均复现，绿色表示调查可重复，不能采纳为完整呈现。实际命令／日志见main-checks.json、kernel.log、structure-ui/；inputs／TMPDIR均在持久cache，无当前/tmp前置。

三份独立gpt-6.1-sol/high无历史fork审查无确证P1/P2：updates-review.md另7项原例及4个独立竞争探针通过；drafts-review.md实跑7项及突变／零越权读取探针；execution-review.md独立两条业务组合4/4，核保存／关联／执行及实际普通内核／客户端／worker收尾。前两片load及授权批准仍是明确替身，后两片内部真实、模型仅受控HTTP或无模型测试Graph；未把它们相加为主线一次运行或完整报告／科研质量通过。真实页面ready仍未接，不以不send冒充其负例。

R2b交回还指出共享Electron UI夹具仅指定内核目录，浏览器profile未显式隔离。主线用已有44.5.1探针确认--user-data-dir同时控制userData／sessionData／默认storagePath；tests/ui/fixture.ts现按每用例输出目录传入该参数，真实核对三路径并保存electron-profile.json／附件。保持原窗口／自有调试内核收尾，新开同应用窗口仍同profile。主线已有Electron场景首次窄复验1/1，落盘版最终1/1、37.6秒；可读路径记录在profile-ui-final/results/。没有查看或清理默认用户profile，没有推定以前测试profile已隔离。新guard的storagePath可null声明导致首次tools类型失败，已加明确拒绝；附件格式首查失败只修格式，保留原日志，最终类型／格式另验。docs/development.md同步实际入口；此修复不改变产品renderer／内核。

下一轮沿design第20轮五线：unknown实际核查、真实client适配、可信module汇合、输入事务保护，以及T1安装前可审查方案。固定候选仍不含任意报告安全保证，系统IME／读屏、服务安装、完整浏览器、目标平台及I5未完成。T1只研究具体安装文件／权限／接缝与真实判据，不执行系统安装或发起T2；最终授权由主线在具体方案审查后确定。CI后置、不push、不新增模型调用，所有新任务必须先同步验证再发送。

最终profile-review.md独立窄审无确证P1/P2，仅只读源码／实际路径与退出证据，不把跨窗口静态核对或Windows／macOS算实跑。最终tools类型、fixture格式、change strict、scholoom-dev及diff通过，原nullable声明／附件格式失败日志保留；最终UI后只改附件格式，不重复业务测试。架构命令的pnpm入口曾触发环境默认依赖解析，日志明确0下载／0新增、Already up to date，锁文件无改动；后续同步直接用node scripts/check-architecture.ts，避免这次额外解析与网络等待，不增加依赖或安装步骤。

## R2b原结构可信对照交回（第19轮本片，0d27cff）

先核共同HEAD=`0d27cff726fe50a2545da7f9479694eb7bb3525f`及clean，读取当前上下文／apply；实际执行后取得delivery instructions。只新增`tests/fixtures/report-structure/`并更新本change的R2b段落；原report-surface反例、3.x事实和其他共享源码保持。任务仍12/22，2.1b／T1／T2／I5及正式R2架构未完成，活动报告仍unavailable。

已交可重建自动／手动入口，见[原型README](../../../tests/fixtures/report-structure/README.md)。原型复用真实独立源页／控制器、Workbench共同资源tab和原生文档克隆／frame；实际状态、表单属性、HTML／MathML结构来自源DOM，源脚本不进入父页或frame。固定合成资源／session及可信HTTP控制器是替身，无ReportResources、provider、服务／隔离、生产容量或完整停止接线。实际结果及架构差分由[investigation的R2b节](investigation.md#r2b保留原结构的可信对照第19轮本片0d27cff)维护：数学结构／普通文本及顺序输入可保留，但在途旧回包替换整份srcdoc会丢失未提交组合“队列”，候选仍不能作为完整报告呈现。

全部证据在`/home/joshua/.cache/scholoom-round19-acceptance-XBzzNC/next/research-interaction/`，短TMPDIR另明确为`/home/joshua/.cache/r2b-5coaTM`（本片final／手动／后续测试），首轮短目录见attempt-1/short-tmpdir.txt。输入来自Git固定源页和现成依赖，所有新数据／配置／profile／产物均在cache，无当前/tmp前置。产品main／preload／kernel复用主线已验产物，Workbench及源页只在夹具构建重新bundle，不声称产品重建。

实际命令和原结果：

- `node tests/fixtures/report-structure/run.mjs <cache>/attempt-1`：首次显示预检、夹具构建／类型通过，双宿主2/2、52.1秒；只覆盖顺序动作，尚无在途竞争证据，不将其当完整输入通过。tools-first.log亦通过。只读同模型／high辅助发现回包可打断组合和抢父焦点；原审查与父处理保存在review.md，辅助未运行测试。
- 父仅修焦点恢复条件，新增两次透明真实回包门控观察。`...run.mjs <cache>/final`先构建后固定产物，双宿主2/2、51.9秒；普通状态／文本／数学AX保持，父焦点不被抢回，同时两端实际重现组合“队列”→空串。门控只延迟真实传输，不替换源状态或正文；绿色是观测可重复，失败的输入保证仍开放，没有禁输入／加timeout／sleep／重试制造通过。
- `node <cache>/check-manual.mjs`首次手动Browser／Electron均在加载夹具模块前失败：原生Node无法解析源控制器的`.js`路径，原stderr保存在manual-first-results.json。只在新控制器用实际`.ts` URL加载和原NodeNext类型引用修正；手动两宿主随后ready=true、exit0，旧长socket反例仍保留而本片短路径可运行。runtime-ui.log在复用同一final/built、未重建产物条件下回归2/2、53.2秒，0失败／skip／flaky。
- 收尾发现原共享Electron fixture未显式设Chromium userData，早期结果不计profile隔离。本夹具run／open改用独立XDG_CONFIG_HOME；manual-profile-results.json实际两宿主ready=true、exit0，manual-profile-electron/host-profile.json读回userData及storagePath均位于本次cache。最终profile-final-ui.log复用同一构建、全新配置／profile及端口6195，真实双宿主2/2、51.4秒，0失败／skip／flaky／retry；相同组合丢失反例保留。没有手工读取或清理默认profile内容，内核目录从始至终独立，没有真实用户库操作。
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`在tools-last.log通过；夹具类型在final/types.log通过。Biome首次在原生TS加载的格式处报1error，原日志保留；最终格式／架构／strict／schema／diff及补丁检查见RESULT与相应日志。未改生产schema，不重复生成映射／全量产品构建／无关内核或旧反例测试。

真实layout／namespace／文本及辅助树对照、指针选区与实际Control+C剪贴板、有界可见正文查找、键盘焦点、顺序CDP组合与在途组合反例均在同次r2b-evidence.json；结构／源截图在同次目录。原source.read里effect仍是textContent=12的旧诊断字段，本片不使用它呈现分数，而使用真实mfrac文档；没有改旧读法掩盖反例。有限上限代码、旧代和第二在途拒绝分开表达，不宣称全量128代／洪泛实跑。

本片源浏览器、源HTTP和呈现HTTP在各closed.json实际读回均false；真实Electron按原closeDesktop等待子进程退出，自有测试内核由原teardown确认stopped后退役配置。无新项目登记或OS scope；没有将这些夹具收尾提升为provider完整停止证明。只读辅助已关闭。系统IME候选窗／取消、真实读屏、数学复制语义、任意HTML／CSS／canvas、页面自主变化、高频输入、跨tab恢复、领域授权、OS服务／跨平台和科研质量均未验。主线需选择能保持活动文档、组合事务、选区与辅助结构的正式接缝，本片不自行扩成镜像／新协议或放宽保护；独立patch／新文件清单交回后停止。

## 第19轮主线验收（2026-10-29）

三树25文件已冻结保全并收回dev，原提交及清单见 `/home/joshua/.cache/scholoom-round19-acceptance-XBzzNC/frozen.json`，起点e4c4e42。2.1d按有限Linux静态native接线关闭；R2接收可重建调查及数学语义反例，纯文本投影不采纳为正式呈现。当前12/22，新增四个3.x子片是既定发布／接续范围的独立拆分，非新增业务。Windows整改归生态change，仍无目标通过。

主线实际build:shared、重建本轮probe、tools／desktop／fixture类型及架构通过；定向内核组合8通过／3个Windows跳过，含真实freeze三例、原native／大字节代表、关闭顺序回归及私有API非目标／非法输入。R2可信对照真实Browser／Electron各1，共2/2、50.2秒；通过表示普通状态／输入可对应及MathML丢失可复现，不是完整呈现通过。命令及日志见main-checks.json、kernel.log、surface-ui/，测试期间产物固定，不从旧/tmp取输入。受影响14文件Biome退出0、22个固定DOM非空断言等warning保留，未为warning重构调查夹具。

独立gpt-6.1-sol/high无历史fork审查linux-review.md无确证P1/P2，并独立重建probe、3例真实OS及2例代表共5/5，三个实际scope均已收尾；可接收2.1d，不证明浏览器／服务。主线直接核R2当前源码、真实状态、文本／AX证据及新双宿主结果：源页mfrac与MathMLFraction存在，投影只有12。原手动Browser因长Unix socket路径失败及系统IME／读屏未验继续保留。新试验不回填原失败或扩授权。

主线选择design第19轮的五条并行片：普通harness多文件发布、完整候选更新、原drafts上的有界版本状态、registered图报告等待接续、R2b保留原结构对照。前三个与图机械组合不依赖尚未选定的完整浏览器；独立调用与UI最终装配分开验收。原drafts返回void，准确降级提示如确需只能扩同一写入返回事实，不能另造存储。真实页面ready负例须等正式装配，不以无send冒充已验证。接口／写集和停止边界均进入原design／tasks，所有新输入及接续工件继续保存本轮cache。

## R2可信呈现／输入校准交回（第18轮，e4c4e422）

从指定共同HEAD及clean开始，仅修改本change的R2四工件与`tests/fixtures/report-surface/`；未重放WIP、改生产renderer／protocol／kernel／provider、共享fixture登记或2.1d／2.2c事实。按apply执行后取得当前delivery instructions。当前仍11/18，2.1b／T1／T2／I5及活动报告unavailable保持；本片交回的是可重复观测及候选缺口，不是完整报告呈现通过。

夹具使用实际Workbench／TabGroups／renderResource及原生React文本／表单。独立Chromium里的固定可信页实际处理筛选、排序和展开，控制器从当前DOM取3行以内快照，父页没有源页HTML／脚本或第二份排序／过滤逻辑。实际双宿主测试结果与MathML反例由[investigation首节](investigation.md#r2有限可信语义投影的双宿主校准第18轮e4c4e422)维护；原型代码与自动／手动入口见[README](../../../tests/fixtures/report-surface/README.md)。HTTP控制器、session及ResourceTarget均为合成替身，不提供ReportResources授权、独立身份服务或隔离／完整停止／容量保证。未重新实施报告选择模块，未接模型或真实库。

证据根`/home/joshua/.cache/scholoom-round18-acceptance-tkEm2H/next/research-interaction/`，所有源码输入在Git工作区，配置／编译产物／profile／结果在该cache；无当前/tmp前置。真实产品main／preload和内核复用共同基线已验产物，Workbench源码由夹具构建重新bundle；未冒称重建产品。原静态测试服务及配置生成器使用round13已保全cache入口。

实际命令与首次失败：

- `node tests/fixtures/report-surface/run.mjs <cache>/attempt-1`：显示预检通过，首构建因KaTeX字体loader缺失失败，未进入测试。原build.log保留；后续只在夹具esbuild使用现成dataurl loader，未新增依赖。ESM输出同时消除未挂载Markdown worker的import.meta格式警告。
- `...run.mjs <cache>/attempt-2`：构建／夹具类型通过，两宿主均因合成session未声明与ResourceTarget匹配的projectId而没有开tab。trace／错误上下文保留；仅补夹具projectId，未绕过共同资源入口核查。
- `...run.mjs <cache>/attempt-3`：修正后两宿主2/2，0失败／跳过／重试。随后仅整理格式、NodeNext导入、控制器手动静态入口与关闭读回，未改生产。tools类型首查发现扩展名及exactOptionalPropertyTypes问题，原`tools-types-first.log／tools-types-final.log`保留，已修正。
- `...run.mjs <cache>/final`：先构建、夹具类型检查，再冻结产物运行同组Browser／Electron2/2，48.3秒，0失败／跳过／重试。两端均测真实源页／投影状态一致、指针选字及Control+C实际剪贴板、可见正文查找、键盘／焦点和CDP组合输入；同时均观测到分数1/2→12及数学辅助结构丢失。用例绿色表示反例可重复，不能记为候选语义通过。
- `node <cache>/check-manual-entry.mjs`：Browser有窗口入口真实失败于长cache路径的SingletonSocket，未到页面；Electron实际打开，但SIGTERM使Playwright源页关闭后的末次读取报错，原JSON保留。入口现在明确保存`unavailableAfterClose`，不把缺失末次正文当成功读取；只针对Electron复核`check-manual-electron-final.mjs`，ready=true、exit0，实际关闭读回为browserConnected=false、serverListening=false。未重复已知失败Browser或改变sandbox／系统配置。自动Browser是headless承载，不能代替手动有窗口条件。
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`最终通过（`tools-final.log`）；夹具类型在final/types.log通过。指定目录Biome最终0error／22warning，固定DOM非空断言等warning原样记录；architecture最终14模块268文件0findings。OpenSpec strict和diff收尾结果见cache RESULT；无生产协议变化，未重复生成类型或全量构建／内核回归。

两次最终UI的自有源浏览器／HTTP均通过实际连接和监听读回关闭；Electron沿原closeDesktop等原进程退出，测试内核由原teardown在确认stopped后退役自有配置。本片未登记项目或启动Agent／scope，不以这些夹具退出证明生产停止保证。辅助gpt-6.1-sol／high仅只读核对宿主接缝，已关闭；没有独立安全验收，本片自查与主线后续审查分别记录。

正式方案差分：当前仅把已提交表单值／展开动作送源页，不保持任意报告的原始键盘、组合／焦点事件序列；纯文本字段还丢失数学结构。系统IME／候选窗及取消、真实读屏、源页自主变化、高频／迟到输入、跨tab恢复、全文搜索及正式版本／资源授权均未验。主线需决定保留结构语义、文本范围／输入与辅助树的可信接缝，随后安排相应目标验证；不扩大字段表或自行采纳画面流。没有Windows／macOS／科研质量结论，不安装／改权限、查询CI、提交／推送／归档或操作其他树。交回独立patch及新文件清单后停止。

## 第18轮主线验收（2026-10-29）

已冻结并合入准备接缝、可信选择夹具及Windows只读Module三份实现；本change只关闭2.1c和2.2c。当前11/18，新增2.1d是既有2.1b中默认真实Linux准备接线的独立验收片，不扩服务／浏览器范围。R2呈现线实际在读AGENTS后因429中断，未改文件、无交付，重新派发，不能把“Agent结束”算完成。

证据根 `/home/joshua/.cache/scholoom-round18-acceptance-tkEm2H/`。原冻结提交、作者终端和检查入口分别为frozen.json、*-terminal.json、main-checks.json；旧交付输入保留在round17同级cache的next目录。输入、输出及TMPDIR均在持久cache，不依赖/tmp。主线已补private-resource-tree的node导出和受控系统访问登记；Windows待目标验证，不启用。

2.1c复用原provider／records／ProcessAdmission，ready后才freeze，实际文件清单形成后才建原intent，旧六操作不变。准备fixture文件、ReportResources.freeze、admission和records真实，领域授权／版本端口与OS控制器为明确替身，不证明真实scope或服务。独审preparation-review.md确证P2：close先等所有freeze导致已有运行实例延迟停止。主线改为先派发已有实例stop，与准备结清并行，随后再扫实例收尾；新混合实例回归通过，保留在途freeze占用。kernel-fixed.log最终32/32（准备18、records2、admission9、契约3），不能与之前组合的32通过／23个Windows跳过相加。

2.2c由固定17条合成样本提供筛选／排序／展开、选择／批注和显式附加，实际createReportContext、ContextContributionProvider、useBusinessSession、drafts及原检查／编辑／移除组件真实；KernelClient、来源快照及页面控制器替身明确。主线ui-acceptance.log真实Browser／Electron各两项，共4/4；核原正文／原摘录保持、对象及来源版本、批注编辑／移除、单批过量整批拒绝和旧消费者dispose后拒绝。不是合并后全部容量分支或未dispose消息错配的双宿主覆盖，不证明真实资源授权、完整composer发送、隔离或I5。独审fixture-review.md无确证P1/P2；README已补持久静态配置生成器／服务器位置和完整前置命令，仍依赖该保留cache入口。

主线共享构建、tools／desktop／fixture类型及架构通过。冻结源码双宿主通过后仅修provider关闭、回归及README，未改UI代码，不重复UI。最终受影响15文件Biome、两change strict、scholoom-dev schema、diff和修正观测竞态后的关闭单项通过，见final-checks.json；tools最终复验亦通过。Windows native未编译／执行，生态独审发现单独记录在所属change，不能以Linux结果或skip替代。后续先同步并验证七树，再派发2.1d与R2，完整2.1b／2.2／3.x／I5保持开放；不查询CI、不新增付费模型请求、不安装系统服务。

## 第17轮主线验收（2026-10-29）

五树增量已冻结、保全并合入dev；本change接收独立身份服务候选及可信选择消费者。消费者模块位于`apps/desktop/src/renderer/src/workbench/report-context.ts`，保持已核快照、原视图／版本和原接收者，完整对象／来源／comment经一次appendContextItems接共同草稿；不是活动报告运行入口。2.2b关闭，完整2.2／2.1b／3.x／I5继续开放；新增下一片2.1c和2.2c，当前9/17。

证据根`/home/joshua/.cache/scholoom-round17-acceptance-fZn1SQ/`：主线`main-context-tests.log`为消费者5项与原共同贡献4项联合9/9，24秒；desktop／tools类型、架构14模块267文件0 findings、两文件Biome、四个受影响change strict及diff检查通过。主线没有为未接入产品的独立模块重跑完整UI或重建所有静态产物。独立`report-context-review.md`另实跑原模块5/5及六组有界探针，未见确证P1/P2；实际原共同草稿接线，client／来源快照为明确替身，不代表真实资源授权或产品浏览器。服务／Windows规划审查`planning-review.md`无实质阻断；其非阻断微软链接错误已在所属调查修正。

主线已直接核原报告spec及平台决议，并选择design“第17轮主线接收与下一片”的账户信任、单租约准备接缝和可信呈现校准边界。候选研究较强的同UID伪程序防御未成为产品契约；受限报告到可信账户能力的隔离要求不降低。没有安装、策略加载、服务／浏览器T1/T2或新增真实模型请求；普通静态HTML仍禁脚本。下一轮分发必须在共同基线同步及必要定向验证之后，不整体重放旧WIP。

## 独立身份服务候选规划（2026-10-29，8d8f339）

本轮先核HEAD=`8d8f339c3e561154b05d4db39b4264c6db2c42e6`且git status为空，消费当前已整合源码，不重放旧WIP或自行同步。按用户明确范围仅完成2.1b下一片的调查及可审查规划；**仍为8/14，2.1b／完整I5未完成，活动报告unavailable**。原静态批注／native provider不重做，2.2可信选择模块由research-graph-runtime独立维护，本轮未写其文件。

实际成果为[独立身份服务研究](../../../.scratch/scholoom-foundations/research/report-independent-identity-service.md)，原investigation／design／tasks仅链接相应事实、候选与下一步。研究给出独立控制身份、受控固定启动门、每实例运行身份及其认证／只读字节／FD／完整浏览器图／配额／unknown恢复／停止／运行时字体／安装升级卸载范围；已核事实、假设与最小T1/T2分开。R1受保护的请求者／唯一准入证明、R2双宿主文本与可访问性surface、R3跨身份启动／部署权威须主线选择，未用名字／配置补齐未知。保留原页面隔离及桥规格，不以未批准候选新增生产SHALL或公共DTO。

同UID固定launcher仍按既有两份精确研究否决，没有重试0755／dumpable／sysctl或向用户申请安装。独立UID可以改变进程创建关系，但SO_PEERCRED仅证明连接时OS身份；用户可读token、exe路径或客户端自报lease不证明可信程序／真实reserve。方案因此不凭这些条件开放启动，也不在服务复制容量或领域权限。现有freeze与六操作可复用，鉴权封套及原范围inventory的服务Adapter是待主线审的窄接缝；浏览器策略、共同呈现与安装没有接线。

### 实际核查及证据

证据根`/home/joshua/.cache/scholoom-parallel-resume-20261029-A5WuXN/research-interaction/work/`；每条执行命令先设置TMPDIR到该根，无当前/tmp输入前置。

- 读取当前AGENTS、开发入口、scholoom-dev、原change上下文和两份AppArmor／bwrap研究；使用项目可用技能的主树只读副本和当前apply、investigation／design instructions。`apply-instructions.json`核14项中8项完成、6项未完成；没有把旧会话未同步条件继续当阻断。
- 同配置gpt-6.1-sol／high、无历史fork辅助仅做一手资料核查，已停止关闭。`official-service-research/official-service-facts.md`及`sources/`保存systemd259.5／man-pages6.17条目、本机版本和固定Ubuntu两份源码。原始命令、首次PATH中的systemd未找到、改用绝对路径及下载收据均保留；两份源码首次下载成功。没有安装或操作任何服务／策略。
- `node "$TMPDIR/fetch-presentation-docs.mjs"`只读取得Electron官方WebContentsView／offscreen／accessibility三页，均HTTP200。`official-presentation/fetch-results.json`记录时间／地址／状态，原HTML与检索文本保留；latest文档只证明API说明，未冒充本机44.5.1、跨身份或两宿主实跑。
- `service-request-sample.json`是cache内不可执行的审查样本，程序／策略显式未登记，R1–R3未闭合。用当前已构建protocol的`validateIsolationStage`只验证其中原stage载荷形状，`sample-shape-result.json`为shapeValid、sent=false、serviceStarted=false、approvedEnvelope=false；没有提交请求，不代表新服务协议已批准。
- 本change `openspec validate add-interactive-research-reports --strict`、`openspec schema validate scholoom-dev`及diff检查通过，日志同根。仅文档变化，复用主线已验产物；未重建、重跑内核／UI／浏览器夹具、查询或触发CI。T1/T2全部未运行，没有新的平台或科研质量通过结论。
- 独立只读规划复核及准备顺序追加复核均未发现确证问题，报告为同根`review.md`；范围是研究／design／investigation／tasks，当前delivery由主Agent自查，未冒称也经过独审。复核确认现有stage自行reserve而freeze才返完整集，私有受信准备回调仍待主线批准，不能把本轮文档当现有生产接线。

本片可交回的是主线决定所需方案及反例，不是已选系统架构或实施就绪承诺。后续先决定R1–R3并单独取得实际安装／部署／T1许可；不足就保留unavailable，不能回退被否定入口、采纳画面流、放宽CSP／sandbox／期限／容量，或把公开文本／IME／无障碍后置为优化。没有创建系统账户、加载策略、运行特权服务／namespace／恶意浏览器、改生产platform／kernel／renderer／schema、提交／推送／归档或操作其他工作树；自有辅助已结束，未启动需清理的服务／scope。

交回入口为同一cache根的`research-interaction-planning.patch`（含新增研究全文）、`untracked-files.txt`及`handoff-manifest.json`；生成／校验入口`finalize-planning-evidence.mjs`保留实际argv至`commands-final.json`，按指定HEAD和五文件写集核对后才导出，不stage。补丁反向检查与新增本地链接检查通过，check仅验证路径存在及规划结构，不把它们当服务安全／T1/T2通过。

## 安装前候选整改与入口否决（2026-10-29）

已准备具体launcher／preflight／候选profile／安装脚本／控制器及可信静态app，并完成静态修正与独审，随后以本机对应Ubuntu版本源码排除了原同UID自动附着入口。事实源为[investigation](investigation.md#固定入口的部署候选被排除2026-10-29)，两份研究已进入Git；具体cache工件及独审`report-browser-deployment-independent-review.md`保留供接续。编译、策略仅编译和self-check不算T1/T2实跑。没有安装／加载策略／启动namespace或浏览器，没有请求用户批准这个已知不满足入口保证的候选；当前无系统安装许可。后续先规划独立执行身份及受控服务，不直接把临时控制器作为产品提供者，仍为8/14。

## 完整浏览器校准尚未通过（2026-10-29）

实际两轮完整浏览器前置见[investigation](investigation.md#完整浏览器前置校准2026-10-29)，证据保存在独立cache而非现有/tmp。限额实际读回、两条sandbox初始化错误和收尾分别记录；两轮均未到main／renderer／截图，不将Chromium错误中的可能原因当唯一诊断，不因没有运行恶意页声称隔离已通过。当前环境的普通userns限制另已实测。2.1b／2.2／3.x／I5均未因此关闭，生产活动报告继续unavailable。

## 2.2a追加通知结果修正（2026-10-29）

父最终核对新增boolean接收结果时发现原drafts.writeDraft在提交后执行订阅回调，异常会沿updateContext误报false。`context-subscriber-red.{log,json}`真实复现result=false但stored=1，后续通知和浏览器错误诊断均未发生。现仅在共同writeDraft的通知循环分别捕获，沿标准reportError报告并继续其他订阅；不回滚已提交内容，不扩大原内存fallback的持久性承诺。原2.2a为修正与复验暂时重开，最终关闭依据本节后续结果，不改写下节首轮记录。

当前同一真实hook文件四项全部通过（`context-subscriber-green.{log,json}`，12.2秒，0跳过／失败／flaky），新增例核提交成功、错误事件可观察及其余订阅继续；原原子容量／三类往返和单项仍通过。`context-drafts.spec.ts`原恢复／窗口隔离／迟到回执保护另1/1（`draft-recovery-final.{log,json}`），未新建镜像草稿实现。desktop重新构建1m31s、desktop及tools类型、两文件Biome通过，见`draft-notification-{build,types,tools,biome}.log`。独立复核在原context审查报告追加确认无新P级别问题；最终冻结产物的迟到回执双宿主2/2、1.5分钟（`draft-notification-ui.{log,json}`）通过，0跳过／失败／flaky，原材料、comment、持久消息及reload草稿断言保留。父接受后重新关闭2.2a，8/14；这些结果不称报告I5。端口6037及自有配置由teardown收尾，保留登记项目和cache证据。

## 共同composer原子批量附加（2026-10-29）

完成2.2a公共子范围，当前8/14，完整2.2及报告I5仍开放。实际写集为renderer的context-contributions／session／business-session／Workbench及原context-contributions、image-selection夹具：provider改为唯一批量callback，提供同步boolean接收结果；单项void调用委托同一实现。真实useBusinessSession只读取一次当前草稿、完整合并交原writeContextDraft验证后写入一次，非法项、16项／64KiB超限不写半组，不另建composer或传输。旧回调在会话／项目／配置键变化后失效，错误和草稿均不串入新接收者。成功只表示原草稿适配接收，不把原内存fallback写成磁盘持久成功。

本片独立审查发现P2：仅比较键会在A→B→A时重新接收旧动作。扩现有真实hook夹具后，`context-append-aba-red.{log,json}`在首个会话往返确实返回true并改变原草稿；未说该红例已执行后两类。修正按键变化更换接收者对象、callback核该次identity，删除重复重算键分支；三类往返都走同一规则。`context-append-independent-review.md`追加静态窄复核确认闭合、无新增发现，父核对并接收。

证据根`/home/joshua/.cache/scholoom-finish-active/`：

- 修正前`context-append-joint.{log,json}`为context＋image22/22，保留图片消费者及原贡献路径证据，不算作P2修正后实跑。修正后`context-append-final3.{log,json}`为3/3、10.1秒，真实hook／贡献／草稿覆盖成功原子提交、非法／数量／字节整批拒绝及三类往返；仅客户端／不相关导航组件为明确替身，不算完整报告产品链。
- 重新desktop构建`context-append-desktop-build-final.log`通过（1m34s）后冻结产物，`context-final-ui.{log,json}`为原显式文本附加／模型工具读回及迟到send回执保护两场景双宿主4/4、2.7分钟，0跳过／失败／flaky、retries=0。正文、原comment、后补项、真实持久消息与reload草稿均沿产品入口验证；内部工作台／broker／worker／文件真实，仅模型HTTP受控。该组不是活动报告呈现／页面桥I5。
- desktop／tools类型、指定六文件Biome通过，见`context-append-final-{types,tools,biome}.log`。首次类型命令误指不存在的tsconfig.web.json，仅命令入口失败，已按package.json改用tsconfig.json，不计产品红例。最终根lint587文件无error、既有114warnings／39infos，架构14模块263文件0 findings（`main-last-{lint,architecture}.log`）；diff检查通过。

静态harness使用独立cache配置与端口6035，图形前置先xdpyinfo，结束teardown仅收尾本轮配置。没有安装／开发服务器／真实用户库／付费模型，必需输入不在当前/tmp。普通HTML、材料单项与原发送可靠性保持；完整浏览器策略、呈现／可访问性、版本发布更新及报告草稿仍须原2.1b／2.2／3.x实做，不能由本公共子项关闭。

## 主线提供者前置接收（2026-10-29）

`add-linux-isolated-report-provider`的9/9任务已接入主线并通过独立审查整改与真实OS验证，详见其[交付记录](../archive/2026-10-30-add-linux-isolated-report-provider/delivery.md)。主线`main-final-kernel.{log,json}`联合118/118中，固定静态native提供者17项实际执行、无跳过；完整归属／停止、恢复／唯一准入及预执行限制仅对登记的Linux x86_64静态策略成立。提供者仍是内部六操作，不接生产宿主、报告浏览器、呈现或工作台，不能由此关闭本change的2.1b／I5。

本change已提交的冻结字节、历史授权及严格单目标修正也在上述联合组回归通过；资源安全两项祖先追加修正另有21/21窄验证，不混算118的产物版本。完整浏览器策略、私有呈现／输入通道、可访问性及运行时分发尚未确定并实现，报告2.2／3.x／4.x保持原任务。接收该前置时为7/13，后续批量公共子项见上节；不将静态样本或普通HTML阅读视为活动报告可用。

## 主线实施：冻结字节、历史与严格单目标读取

2026-10-29主线完成1.2b.2b，当前**7/13**。`ReportResources.freeze`与snapshot共用一次完整load，保留该次实际读到的入口／显式依赖Buffer，不重读同路径新版，不复制来源正文或新增存储。historical Adapter只替换可信文件权威提供的原入口正文／Evidence／path，来源与依赖继续核原版本及read/send；缺原依据拒绝。

Manual将历史各段的展开Evidence汇集后，在返回整组正文前同步复查，成功后才登记使用；旧摘录展开来源还进入instructionResources本地末次检查和原持久模型准入记录。当前坏清单不参与合法旧摘录核查。目标报告复用ProjectTargetReader及同一targetRead范围：入口／依赖／来源必须都在原目标；路径仅有界查既有登记，不创建身份，拒绝库／第三项目来源。原始目标端口的每次描述／读取受原作用域守卫，目标owner退出该只读作用域后再登记源会话使用，保留源项目send检查、取消及实例核查。

### 真实验证与独立整改

证据根`/home/joshua/.cache/scholoom-finish-active/`。先构建editor／projects／kernel，再冻结产物运行测试，模型仅外部HTTP受控；真实Manual／Kernel／broker／仓储／文件、受管父子、授权及恢复均由现有内部实现提供。没有UI或隔离浏览器接入，没有付费模型或真实用户数据。

- freeze新增代表回归初始因缺方法而失败，完成后模块29/29通过。冻结字节包含入口与依赖，来源仅核查，BOM和缓冲复制的独立探针另有证据。
- 初次真实报告／目标组合46/46通过，随后独审仍找到原回归未覆盖的目标host受理及跨项目旧清单缺陷。新增真实current／historical目标摘录经`session.send`正例，连同两种整组历史撤权、旧摘录最终受理及目标范围代表**6/6、44.7秒**，`report-target-fix-first.{log,json}`。
- 最终联合命令：`TMPDIR=/home/joshua/.cache/scholoom-finish-active/tmp PLAYWRIGHT_JSON_OUTPUT_FILE=/home/joshua/.cache/scholoom-finish-active/report-joint-final.json node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-production.spec.ts tests/kernel/report-resources.spec.ts tests/kernel/target-reader.spec.ts tests/kernel/target-races.spec.ts tests/kernel/delegated-reports.spec.ts --workers=1 --reporter=line,json --output /home/joshua/.cache/scholoom-finish-active/report-joint-final`，**59/59、3.4分钟、无重试**，日志为同根`report-joint-final.log`。涵盖真实子执行、缺项／旧basis／取消、模型queue／final／restart、目标身份和在途撤权，不将sources声明核查称为全文阅读。
- editor／projects／kernel构建、tools类型、相关Biome、架构及协议生成映射核对通过。历史Adapter首次直接传完整descriptor违反Evidence额外字段约束，已改传ref／basis；目标适配抽取后TS字面量推断和新增测试消息字段错误均在构建／类型检查中修正，不放宽schema。原日志与最终`report-target-fix-build2.log`、`report-target-fix-tools2.log`保留。
- 两轮独立只读审查分别为`report-history-independent-review.md`、`report-independent-rereview.md`：初审1P1／3P2，复审又见2P2，均已修复；最终追加复核确认整组撤权、本地受理集合、合法旧版本、目标host受理及不扩大范围。内存探针与父真实59项分开，审查不冒充实跑。

### 仍未完成

2.1b的完整隔离浏览器、呈现／输入／文本与可访问性、共同composer动作、完整更新／草稿／接续及I5仍未交付；独立native提供者正在所属change实施，不能以该模块或冻结字节通过关闭报告UI。旧报告的同步保存／undo回执仍保守拒绝，不能将历史只读放行当作撤销契约变化。Windows／macOS报告呈现、分发与真实科研质量未验。本轮未修改生产CSP或开放活动报告；下文6/13和Adapter不可用仅指历史交接时状态。

## 第十五轮主线接收独立提供者规划

`add-linux-isolated-report-provider`规划已保全合入，冻结两轴无确证问题；主线接收六个宿主窄操作、分片封存和唯一准入恢复方向，并在该change design记录归属。下一片只推进1.2固定native／已核架构／默认拒绝syscall策略与控制器失联真实校准，2.x待证明后实施；本轮没有生产platform或浏览器接线，新change仅完成接口审查1.1，不提前创建实现delivery。

调查指出的ProgramRuns旧恢复计数回调由计算线独立任务R16.1处理，报告线不并改manual／admission。两份规划的接续授权文段曾有一项P2，主线统一后独立复核已关闭；证据在`/home/joshua/.cache/scholoom-round15-acceptance/`。原报告6/13、2.1b／I5、活动页unavailable及浏览器／跨平台／分发／文本与可访问性边界保持开放，没有把规划或CLI ready提升为保证通过。

## 第十四轮验收后的独立提供者规划交接（58eda140）

本轮先确认HEAD=`58eda1404fcc60036ce0e0f3ce30d5453ce1ee30`且clean，读取AGENTS、原tasks／delivery、共同计划第十四轮及scholoom-dev／当前instructions。主线已选Linux普通权限独立提供者先行；没有同名／等价活动change，已新建[add-linux-isolated-report-provider](../archive/2026-10-30-add-linux-isolated-report-provider/proposal.md)，完成proposal／investigation／specs／design／tasks规划。新change没有生产实现、没有delivery，公共签名仍按其1.1交主线审，不自动apply。

原报告只更新design／tasks的正式提供者前置链接和本交接记录。报告仍6/13、活动页unavailable，2.1b／I5、目标／旧版本Adapter未关闭。ReportResources继续管原ref／basis／read/send；新provider计划只收批准的有界字节，不把临时C程序、dev／ino或原生实验当领域版本或生产授权。公共分片封存操作、唯一ProcessAdmission恢复结清及先于准入的恢复屏障建议见[新design](../archive/2026-10-30-add-linux-isolated-report-provider/design.md)，真正OS前置／syscall／控制器丢失缺证及下一最小校准见其investigation／tasks。

本轮仅静态复核现有调用点和已接收三cache源码／原始结果，未重跑CPU／OOM／FD或其他原生样本、浏览器、UI、模型／真实用户库。现有生产源码与已验f4ab1e5相同的主线构建回执予以复用，没有声称本轮重建。调查辅助为gpt-6.1-sol／high、无历史fork，只读本树；主会话核对正确platform/native路径、范围／准入事实并保留设计判断。

命令及规划检查结果保留在`/home/joshua/.cache/scholoom-linux-provider-plan-round15-7V4Vot/`：`openspec list --json`／`list --specs --json`、`new change add-linux-isolated-report-provider --schema scholoom-dev`、各工件instructions、status／apply、两change strict、schema及diff／补丁核查。新change strict首次通过；探索时猜测不存在的规格／策略文件已改用实际路径，原命令未运行生产或实验。当前工作仅规划，类型／生成／架构执行检查及OS实跑不适用，不将原CI／主线UI结果当隔离通过。

必需接续输入是新change的Git工件，以及`/home/joshua/.cache/scholoom-report-platform-round12-fNGQLv/`、`/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT/`、`/home/joshua/.cache/scholoom-report-gate-round14-DocB5o/`的既有固定源码／证据；精确文件索引由新investigation维护。新payload／检查／补丁根及TMPDIR为本轮cache，无现有/tmp内容前置。没有启动服务／native进程／开发服务器，辅助结束关闭；无安装下载、提交推送／PR／archive、同步／其他树或真实库操作。

停止于规划交回：主线审公共签名与首个native策略／失联停止校准，再给明确实施切片。Linux提供者未交付前不启用报告；完整browser进程图、文本／可访问性、呈现、分发维护与预算及Windows／Mac仍待相应真实方案／目标证据，本轮不代替主线决定或降低保证。

## 第十四轮主线验收

本轮四工件及高FD／SCM_RIGHTS／stdio／普通文件门的有限对照已保全合入，独立两轴审查无确证问题；被拒启动与实际OS拒绝、危险迁移与全部scope收尾分别表达。主线未重复原生实验或将固定样本当生产能力，活动报告unavailable、2.1b／I5继续开放。

用户授权主线选择后，下一片先规划独立Linux platform隔离提供者，复用当前准入和归属，明确实际配额、受控字节交付、预执行门、控制器丢失／unknown恢复及独立验收。只形成apply所需工件，不把临时launcher复制进生产或预设共同画面流；现有用户权限不能兑现保证则不可用。方向见design“下一片”，调度见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)。原生源码／结果在原cache，后续无现有/tmp前置。

## 第十三轮验收后的高FD／接收通道调查（f4ab1e5）

2026-10-28先核HEAD=`f4ab1e5f1ed17ae9af656c1f9945005a2786d911`且clean，读取原AGENTS、共同计划第十三轮安排、本change原工件、scholoom-dev及apply；执行后取得当前delivery instructions。只续做已授权有限Linux调查，仓库写集为原investigation／design／tasks／delivery；未改生产、协议、UI或测试源码，未同步／重放旧patch／提交。任务仍6/13、活动报告unavailable，2.1b／I5及目标／旧版本Adapter保持开放。

**已交回：** 预执行高FD关闭门、可信stdio及普通文件映射门的有限正反样本。高256／1024文件、目录／迁移及259 SCM通道危险对照真实生效；关闭后同类动作真实EBADF，0–2实际ENOTSOCK。误将接收socket放到2仍能传入文件／迁移句柄，stdio门另在进入前退出77拒绝配置；拒绝场景未进入payload，不算逐动作OS拒绝。真实类型／身份检查拒绝socket／目录／FIFO／symlink及不符普通文件，批准FD经ro-bind-data得到固定只读字节。数值／PID／限额和完整条件矩阵只由investigation首节维护；design保留架构目标图及本片策略输入，不表示正式ReportView／桥或生产Adapter已接入。

全部必要接续文件在`/home/joshua/.cache/scholoom-report-gate-round14-DocB5o/`：`gate-launcher.c`、`gate-payload.c`、`gate-calibration.mjs`、二进制、合成数据、原stdout／stderr与`gate-first-result.json`。前片cache原生源码仅只读参考，本轮不依赖旧二进制或现有/tmp内容；bwrap内部/tmp是本轮私有tmpfs。没有UI前置或对旧static-ui入口的依赖，也未读BBT原包。临时样本明确保留为调查工件，不进入生产或形成第二套业务实现。

实际命令使用以下独立根；复跑须新建根并保全原输入，不在本根覆盖首轮结果：

```sh
GATE_CALIBRATION_ROOT=/home/joshua/.cache/scholoom-report-gate-round14-DocB5o
export TMPDIR="$GATE_CALIBRATION_ROOT"
node --check "$GATE_CALIBRATION_ROOT/gate-calibration.mjs"
node "$GATE_CALIBRATION_ROOT/gate-calibration.mjs" "$GATE_CALIBRATION_ROOT"
node "$GATE_CALIBRATION_ROOT/check-gate-evidence.mjs" "$GATE_CALIBRATION_ROOT"
```

`prerequisites.json`核普通权限和现成工具；每个launcher在scope内先实读20%CPU／64MiB／swap0／16tasks，控制端另读被测源／目标限额。唯一原生轮先以已有`cc -O2 -Wall -Wextra -std=c11`编译两份C，均退出0、stderr为空，再运行有限对照，控制器退出0。无第二轮native、CPU／OOM压力或外网扩大。`check-gate-evidence.mjs`只读取既有结果，以固定合成marker、真实errno、SCM回执及源／目标成员核对，并只读核全部六unit／已知cgroup路径，`evidence-check-first.log`通过；不是另一轮平台实跑。

**首次失败与审查处理：** 辅助首编译遗漏TMPDIR、编译器写/tmp遭EDQUOT，保留`gate-payload.build.log`；改为cache后成功，失败时未启动样本。launcher首编译两处缩进warning和当时源码另存；执行前补括号／分行消除，未删首次日志。原生轮没有失败／重试。辅助自查及另一原生独立只读审查均未再运行样本；后者指出unsafe先经258迁移，故只有独立stdio-leak作为SCM跨组迁移证明。又指出首轮对已卸载五unit的`cgroupExists:false`是空ControlGroup默认值；原字段及输入保持不改，一致性复核另用六条原preflight路径实查，实际收据在`gate-conditions-matrix.json.cleanup`。没有为修观察而改变停止或容量保证。

**归属／清理：** mapping自然退出0，三payload经固定Q自然退出0，拒绝启动为77；最后目标仅余可信guardian，明确stop该本轮unit退出0，systemd-run以SIGTERM结束。全部六unit inactive／not-found，六条实际旧cgroup路径已查不存在，控制端原cgroup未变，自有Unix socket服务已关闭。只收尾本次唯一unit／服务，未停共享显示／他人scope。未凭源scope空或根PID消失认定完整停止，也未接生产统一容量。

OS／systemd／bwrap／FD传递／迁移真实；固定C程序、合成诱饵、FIFO及自有socket是调查输入，不能当生产仓储／worker／ResourceRef授权接线。未读真实凭据／库或profile，未安装／下载／提权／改系统或委托／启动开发服务器，没有浏览器、UI、外部DNS或Windows／Mac实跑。只改文档复用主线已验产物，未重复产品构建、tools／类型、生成映射、kernel或双宿主；适用收尾为本change strict、scholoom-dev schema、diff和独立补丁reverse-check，同根保留实际日志。未查询／触发／后台等待CI；最新主线回执范围沿investigation。

**停止与未决：** 本轮只收敛遗留高FD／接收通道及特殊文件映射的有限反例，可信launcher尚非生产提供者。迟到能力／syscall策略、恶意诊断篡改／并发内容版本、控制器丢失恢复／unknown与容量组合、全网络和浏览器完整进程图仍缺证。请主线审独立platform Adapter的最小职责与下一窄校准，OS部署／呈现／分发维护及预算继续由用户／主线决定，不采用画面流。本change 2.1b／2.2／3.x、完整I5及科研质量不关闭；无push／PR／archive、其他工作树操作或真实库访问。

## 第十三轮主线验收

本轮四份调查工件已冻结保全合入，独立两轴审查未发现本线确证问题。继承FD、宿主Unix／TCP代理、只读socket与cgroup迁移反例接收；没有接生产Adapter、浏览器或公共协议，活动报告继续unavailable，2.1b／I5仍开放。主线未重复有限原生实验或把其他绿色UI作为报告承载验收。

当前实验源码、反例矩阵和前片scope样本在各自cache，接续无须旧/tmp。下一片只在同样有限保护下调查高FD／SCM_RIGHTS入口、普通文件类型核对和迁移句柄阻断；精确范围见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)。权限／部署／呈现和完整平台保证继续待定，不据新窄样本采纳画面流或替代原停止／容量证明。
## 第十二轮验收后的文件／句柄原生校准（ba29ee6）

2026-10-28先确认HEAD=`ba29ee61ac6f8700cfe6a9fbaa529a8a7a75aad1`且clean，读取AGENTS、共同计划第十二轮安排、原工件和scholoom-dev／apply；实际执行后取得当前delivery instructions，更新同一记录。消费`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`正式交接及本树源码，未重放旧patch、同步或取他树在研内容。仓库写集严格为本change的investigation／design／tasks／delivery，未改生产、协议或测试源码。当前任务仍6/13，2.1b及活动报告unavailable保持。

**实际成果：** 候选A的最小文件视图有有限正例，但继承权威反例明确成立：文件／目录FD绕过隐藏路径、已连接Unix／TCP保留宿主代理，只读映射pathname socket仍可收发；继承cgroup.procs写句柄使样本实际迁入本轮另一同限额scope。批准文件只读、关闭多余FD后的被测路径／句柄拒绝，不足以证明所有代理／迁移已拒绝。完整数值、真实PID与计数由investigation首节维护；design增加独立platform Adapter职责输入，没有新增接口或生产实现。既有目标架构图不代表隔离承载已经接线。

证据根为`/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT/`，源码／原始结果明确保留为调查，不成为第二份报告业务实现。只用已有cc、systemd用户manager及bwrap，无安装／下载、sudo、系统配置／用户权限修改或新特权服务；不运行浏览器／VM／容器服务或真实profile。前片CPU／OOM／pids／多代停止负载不重跑。

| 文件／入口 | 实际验证与边界 |
| --- | --- |
| `prerequisites.json`、`bwrap-help.txt` | 只读核已有systemd259.5／bwrap0.11.1／cc15.2.0及用户manager。没有以W_OK代替机制执行，没有假定本版存在preserve-fds参数 |
| `file-probe.c`、`file-launcher.c` | 固定native有限动作及可信预执行策略。两个C均以`cc -O2 -Wall -Wextra -std=c11`编译退出0、无warning；关闭FD与故意保留FD分开，首次fstat先于文件打开并按身份核对，避免FD复用假阳性 |
| `file-calibration.mjs`、`file-first.log`／`file-first-result.json` | 唯一有限实跑退出0，无重试。宿主合成控制、独立目标scope、closed／inherit／socket三case顺序执行；动作前读回源及目标实际20%CPU／64MiB／swap0／16tasks上限。继承FD7迁移由源／目标cgroup成员和宿主PID实际cgroup交叉佐证，仅指向本轮目标，没有迁入Orca或无约束范围 |
| `check-file-evidence.mjs`、`evidence-check.log`／`file-conditions-matrix.json` | 读取既有原始结果做独立预期一致性核对：合成固定marker、errno、迁移成员、计数及五个自有unit收尾均通过；另只读查询这五unit仍inactive。不是新一轮OS／平台测试 |

实际执行入口如下；重跑须另建自有根，不能覆盖这里的首轮证据：

```sh
FILE_CALIBRATION_ROOT=/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT
TMPDIR="$FILE_CALIBRATION_ROOT" node "$FILE_CALIBRATION_ROOT/file-calibration.mjs" "$FILE_CALIBRATION_ROOT"
TMPDIR="$FILE_CALIBRATION_ROOT" node "$FILE_CALIBRATION_ROOT/check-file-evidence.mjs" "$FILE_CALIBRATION_ROOT"
```

**首次失败与收尾：** 大payload的bash here-doc因/tmp配额EDQUOT失败，`payload-first-failure.log`保留；当时未启动样本／服务。改用内置apply_patch写临时控制器，node语法检查通过后才编译运行。五个唯一scope自然退出0，均inactive／not-found且源／目标cgroup消失，控制器原cgroup未变；自有Unix／TCP服务等待关闭。Node stdio控制FD实际为socketpair，不当作已验证无权的FIFO。可信launcher预先连接服务，closed虽无payload请求仍各有1次accept；不谎称启动链零连接。原始源码和结果未作事后改写。

固定C样本、合成文件和loopback服务是调查输入；内部OS／scope／namespace／FD／socket及迁移真实，没有用模块替身充当生产ResourceRef／ReportResources授权或harness。FD清单只观测0–15，0–2控制通道、高FD／SCM_RIGHTS／迟到获取仍缺证；控制器输出超额分支不是对恶意输出的硬内存限制，不移入生产。nested unshare实际EPERM，后续动作未执行，原因未确证；不通过隐藏附加策略或未执行项制造通过。独立只读复核（gpt-6.1-sol／high，无fork历史）核源代码与原始结果，未发现确证的假阳性、越权目标或收尾遗漏；辅助已结束关闭，没有另起会话、跨树消息或常驻任务。

适用收尾为OpenSpec strict、scholoom-dev schema、diff检查及本地补丁reverse-check，实际命令／结果保留在同根。只改Markdown，无生产类型／生成映射变化，未重复共同基线已验构建、kernel或双宿主UI，未启动开发服务器或触发全仓CI。当前CI及新job交接截点见investigation首节；本片未查询／后台等待或新增Windows／Mac通过结论。

**交回与停止：** 主线需审platform预执行FD／控制通道、普通文件映射、迁移防护与完整停止／unknown组合职责，然后决定是否授权独立Adapter；不能将临时systemd脚本视为生产提供者。浏览器运行时维护／分发、OS部署权限、呈现及文本／无障碍和预算继续待用户／主线决定。本片不采纳画面流、不扩权限或新协议；外部DNS、Windows／Mac、控制器丢失／恢复、真实报告／双宿主、2.1b／2.2／3.x、目标及旧版本Adapter、完整I5与科研质量继续开放。未提交／push／PR／archive，无真实库访问或其他树操作。

## 第十二轮主线接收原生校准

本轮四份原生校准工件已保全合入，两轴独立审查无确证夸大。主线核实际conditions-matrix及原始数据索引：普通用户独立scope的CPU节流、64MiB内存／16进程、有限多代整组停止与本机loopback正反样本成立；首轮TCP计数缺口和网络窄补验分开保留。没有在主线重跑OS实验或将脚本自检当新平台实跑，原四scope已收尾证据保持。

这解除的是本机前置机制的部分不确定性，尚未证明最小文件视图、继承FD／Unix socket代理、浏览器、外部DNS、崩溃恢复或双宿主呈现。下一片只校准上述文件／句柄边界，仓库仍仅更新原工件，不接生产Adapter／协议／UI，不决定画面流或部署权限。2.1b／完整I5及活动页unavailable保持；具体临时证据和许可边界沿本change原调查及共同计划第十二轮。

## 第十一轮验收后的本机原生校准（29cd728）

2026-10-28先核HEAD=`29cd7283388dfd752911eacb9c3bf8416031db15`及clean，读AGENTS／共同计划第十一轮安排／原design/tasks/delivery及当前apply instructions；实际执行后取得delivery instructions。仅执行用户明确授权的候选A普通权限前置，仓库仍只改原investigation／design／tasks／delivery。任务保持6/13、正式2.1b及活动报告继续unavailable；没有采用画面流或新的产品架构。

正式交接输入为`/tmp/scholoom-round11-acceptance-Jx5Oez/`的本线冻结和主线接收记录、post-integration-ci及本树正式源码，不重放source.patch。原iframe的STUN／CPU反例和完整首次失败记录继续保留，不重复报告浏览或借主线CLI状态关闭整项。新CI只保留交接截点“已启动”，未查询或后台等待，不添加Windows／macOS通过结论。

**实际结论：** 普通用户在本机可另建有CPU控制的transient user scope，不能将Orca自身无cpu.max扩大为不可用。实际scope上限20% CPU／64MiB memory／swap0／16 tasks，与显式bwrap的七类namespace、NoNewPrivs=1／CapEff=0共同作用于固定原生样本；CPU节流、pids拒绝、内核OOM及含setsid孙进程的整组停止均取得代表性证据。自有IPv4／IPv6 loopback目标未收到隔离样本的TCP／UDP，UDP sendto仍可在新namespace内返回成功，不能据此宣布禁止socket、外部DNS或全网络零外发。完整条件矩阵只由investigation“本机前置机制实跑”维护。

证据根为`/home/joshua/.cache/scholoom-report-platform-round12-fNGQLv/`，所有命令继承TMPDIR到该根，避开本机/tmp EDQUOT。三个实验入口及结果分别是：

| 执行与原始结果 | 实际范围 |
| --- | --- |
| `scope-calibration.mjs`／`scope-result.json`、`namespace-calibration.mjs`／`namespace-result.json` | 已有cc先编译有限C读回样本；新scope运行时样本与外部控制端分别读内核文件；显式bwrap固定true退出0。不是属性受理或W_OK检查代替限制 |
| `native-calibration-first.mjs`／`native-first.log`／`native-result.json` | 唯一完整负载轮，原执行文件名为native-calibration.mjs，当时代码另存first快照；CPU／P／M／T实际完成。T先经pipe确认孙setsid再读scope五个实际成员，stop唯一unit后整个cgroup移除；systemd-run以SIGTERM close是明确实验停止，不改生产unknown语义 |
| `native-network-final.mjs`／`network-final.log`／`network-final-result.json` | TCP观测修正后仅补验网络、namespace及现有限额，退出0；TCP按accept计数且native结果明确失败，四项最终计数均只含正向控制1。未重跑已绿资源／树负载 |
| `check-evidence.mjs`／`evidence-check.log`／`conditions-matrix.json` | 对上述独立原始内核计数／scope／消息做一致性复核通过，不运行新实验；完整样本源码、编译器输出、命令参数和清理记录都保留 |

实际执行命令使用独立cache根（下列为命令记录，复跑须复制到新的自有根，不能在原根覆盖证据）：

```sh
CALIBRATION_ROOT=/home/joshua/.cache/scholoom-report-platform-round12-fNGQLv
TMPDIR="$CALIBRATION_ROOT" node "$CALIBRATION_ROOT/scope-calibration.mjs" "$CALIBRATION_ROOT"
TMPDIR="$CALIBRATION_ROOT" node "$CALIBRATION_ROOT/namespace-calibration.mjs" "$CALIBRATION_ROOT"
TMPDIR="$CALIBRATION_ROOT" node "$CALIBRATION_ROOT/native-calibration.mjs" "$CALIBRATION_ROOT"
TMPDIR="$CALIBRATION_ROOT" node "$CALIBRATION_ROOT/native-network-final.mjs" "$CALIBRATION_ROOT"
node "$CALIBRATION_ROOT/check-evidence.mjs" "$CALIBRATION_ROOT"
```

原生入口均先执行已有`cc -O2 -Wall -Wextra -std=c11`再运行样本，不重建共享产品产物。CPU测试2.065秒内用0.404秒CPU、nr_throttled增加21；pids反例对应内核max事件，memory反例对应oom_kill增加且forcedKill=false。本次OOMPolicy=continue只给实验scope保留观察父进程；RuntimeMaxSec=15s仅是开始终止的保护门，不是全部清理的产品期限。controller在scope外，最终四个唯一unit全部inactive／not-found，原cgroup已回收、控制端scope未变，自有TCP／UDP全部关闭；systemd可能自动启用祖先controller，本片没有手改／回滚父层配置或声称启用状态完全复原。

**首次失败／审查修正：** 启动负载前临时控制器syntax检查首次失败，缺失一个闭括号；保留controller-syntax-first.log，修正后通过，首次没有启动样本／监听器。完整负载脚本退出0后，独立审查发现P2：TCP仅connect而旧观察器按data计数，不能用其计数证明无连接。保留首轮输入／结果及代码，改为accept计数、相同行为正向控制和connect失败断言，再仅补验网络。只读复核确认该缺口闭合。C编译均退出0，原日志保留scope-probe的1条read及native样本的2条write返回值warning，不写成零warning或抹去记录。

实际OS／systemd／cgroup／bwrap及C进程真实；固定合成负载和自有loopback是调查样本，没有模块替身充当生产授权／worker。本片没有接入ManagedCommands／ManagedNode、ReportResources、harness、真实项目／库或双宿主，没有新的程序运行／UI注册。自定义完整syscall／继承句柄策略、外部DNS／LAN／浏览器网络、控制器丢失／迁移逃逸／重启unknown和容量接线均未验，不能由本次cgroup回收推定这些保证。可信bwrap包装器仍在宿主net namespace，不能让它执行报告或做代理。

适用收尾检查为`openspec validate add-interactive-research-reports --strict`、`openspec schema validate scholoom-dev`、`git diff --check`及文档补丁reverse-check；日志保留在同根。只改四份Markdown，没有生产类型／生成映射变化，不重复主线已验构建、kernel／UI或全仓CI。源码HEAD不变，无提交、push／PR／archive、安装／下载、sudo／新特权服务、全局配置／权限修改、其他树操作或真实用户库访问；原生样本和二进制明确保留为本片调查依据，不进入生产或成为第二份报告实现。

**停止与最小下一步：** 交主线审独立platform Adapter的预执行、句柄／syscall策略、控制器丢失和持久unknown／容量组合，不能直接拿临时systemd脚本当提供者。Mac受管执行仍不可用，Windows及非本机Linux条件缺证。浏览器运行时／分发、正式呈现及文本／无障碍、部署权限和产品预算仍待用户／主线决定；不自动启动浏览器、VM／容器服务或接图像流。2.1b、2.2／3.x、目标／旧版本Adapter、完整I5及科研质量保持开放。

## 第十一轮主线接收与校准范围

四份候选调查工件已冻结合入，两轴独立审查未发现确证夸大；未运行新的隔离／双宿主实验，2.1b仍未实施。下一片只准许本机已有工具、普通权限下的有限原生机制校准，先查必要namespace／配额／归属条件，缺失即明确交回；不采纳画面流或新的UI／产品架构，不安装／提权／改变系统配置或运行无约束浏览器。正式呈现体验、部署权限、运行时分发和资源预算继续待定，活动页不可用及完整I5开放保持。具体边界沿[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)。

## 第十轮验收后的承载调查（938c33f，未实施2.1b）

2026-10-28只读确认HEAD为`938c33f2c9fcafb2cce11b0c165b2fb1e9a818c3`且起始干净。依本轮直接授权完成下一承载的资料／源码调查与候选设计；取得当前apply及delivery instructions后更新原记录。写集只有本change的investigation、design、tasks、delivery，没有业务／夹具／协议源码变更；任务仍6/13，2.1b尚未实施，活动页继续unavailable。

精确消费`/tmp/scholoom-round10-acceptance-j1MosP/{acceptance.md,synchronized.json,main-ui-final-result.json,report-probe-ui-browser.json,report-probe-ui-electron.json,ci-same-source-failures.log,ci-failure-matrix.json}`及本树正式源码；没有应用source.patch。主线2/2调查、两宿主STUN各1包20字节及Browser父心跳258ms已核原JSON，不重跑失败候选，不把通过／默认skip记成隔离。保留trap初始化try／finally保护和显式调查环境开关，也保留原首次失败及后续轮次。

| 原工件 | 本片实际交付 |
| --- | --- |
| investigation“当前承载调查” | 已有CommandWorkspace／ManagedCommands、ManagedNode／controller／原生scope、ProcessAdmission、资源和Evidence的复用及缺口；官方L／W／C来源、当前Linux被动条件及最新CI证据边界。清理首次规划中已被否定的iframe选择／旧374项基线作为当前结论的表述 |
| design“下一承载候选与待决范围” | A独立完整浏览器OS隔离与B容器／VM两候选；明确Browser共同React呈现、控制器／私有pipe／版本桥和实际文件所有权。列安装权限、分发维护、资源与呈现取舍、关键反例和六步最小校准；新图以虚线标拟接口，既有总览不再预设跨进程MessagePort |
| tasks | 基线／范围改为938c33f的调查片；2.1b不勾选，首批未来任务按“平台机制→原生校准→实际报告→审接口后UI”推进。没有以候选文档完成关闭实施任务 |

本轮可复用的是授权／归属／停止机制，**不是**网络或CPU沙箱。本机bwrap 0.11.1无setuid；namespace未试建；当前Orca cgroup只暴露memory／pids，没有cpu.max。该scope的W_OK不能代表已取得完整委托，也不是所有Linux部署或未来独立内核scope的结论。Windows只核官方AppContainer／Job／WFP／Sandbox文档及本树helper，未实跑Windows；Mac原受管执行仍不可用。

只读资料核对通过官方web入口与官方DevTools JSON；后者记录在`/tmp/scholoom-report-carrier-round11/cdp-source-extract.json`，`source-fetch.log`列出截图／输入和experimental字段。上游master不是已安装runtime承诺。DevTools网页没有返回所需正文，临时JSON提取脚本首次有括号语法错误、未执行；改正后读取成功，没有因此运行任何浏览器或修改产品。两位原辅助均为gpt-6.1-sol／high：本机／源码事实和Microsoft资料各自只读，最终判断仍由本线负责；没有跨树／会话调查。

适用检查为`openspec validate add-interactive-research-reports --strict`、`openspec schema validate scholoom-dev`及`git diff --check`，结果与diff在`/tmp/scholoom-report-carrier-round11/`收尾工件。只改四份Markdown，未重建已验证的相同产物，未运行kernel／UI／OS／网络／CPU测试；没有新增“通过新承载”结论，也没有替身测试。最新CI范围沿investigation记录，不触发或等待新全仓CI、不推定运行中job成功。

**交主线决定后停止：** 建议先审A的条件校准，不代表已采纳。待选项是共同画面／输入与语义／可访问性体验、Linux委托和Windows安装权限、浏览器分发及安全维护、交互与资源预算。现有双宿主只读HTML继续可用，但不作为降低活动报告产品范围的替代验收。无决定或必要提供者时不创建协议／OS实现，不自动回退容器、特权服务或受信程序执行；2.1b／2.2／3.x、目标与旧版本Adapter及完整I5保持开放。

本片没有安装／下载依赖、启动新服务、改变OS权限、操作真实用户库、提交／推送／PR／归档、合并／重置／同步或操作其他树。未新增常驻任务或Agent；辅助结束后关闭，仅交本地可审查文档增量。

## 第十轮主线验收

共同构建结束后，主线在Browser／Electron复验本调查2/2通过，再将入口明确限定为`SCHOOLOOM_REPORT_ISOLATION_PROBE=1`显式调查，普通产品UI回归不默认执行已否定候选。通过仅表示可重复取得HTTP正例、STUN外发／宿主访问及桥／CPU样本，不证明活动报告已隔离；2.1b和生产不可用保持，下一片只调查可靠独立承载及双宿主呈现方案。

Standards轴发现P2：trap取得后目录断言、runningKernel、client.connect和页面初始化位于try之外，失败可能遗留资源。主线从trap取得后立即建立try保护，并在finally释放已创建连接及trap；只读复核确认原失败窗口已覆盖，Spec轴无其他确证新增问题。未放宽CSP、启用生产页或改资源权威，原始快照与修复证据在`/tmp/scholoom-round10-acceptance-j1MosP/`。显式调查最终结果另沿main-ui-final日志／JSON，原作者失败轮次保留。

## 第九轮中断后的续做：2.1a机制调查交付，生产仍不可用

2026-10-27从共同源码`4312262c1a1f432ccd706dd1eb6ff6468765fd4e`、起始干净工作区续做。读取主线`/tmp/scholoom-round9-acceptance-IER31D/`、原工件及当前apply指引；实际执行后取得delivery指引。只关闭2.1a的调查任务，当前6/13；2.1b及完整报告change／I5未完成。原设计总览仍是目标链路，本片验证的是“ReportResources快照／实际字节→专用隔离候选→桥观测”，没有ReportView／composer／生产tab。

| 文件／符号 | 本片实际范围 |
| --- | --- |
| `tests/fixtures/report-frame.ts::reportFrameProbe/bootstrap` | 复用主线保全候选及同源Bridge validator；仅新增夹具sourceURL及真实port转移观察入口，不导出生产能力。按viewId／generation／basis验证，单选择在途、限额及关闭仍归该候选 |
| `report-isolation-entry.ts` | 独立静态父页入口，挂载／替换候选、限量CSP／回执观察、受控选择Promise；不接共同输入框或内核写动作。保留实际旧port验证，同代queued是独立正向控制 |
| `report-probes.ts` | 保存到真实项目HTML中的固定恶意脚本样本；16类资源／动作通道、五类导航、被盗nonce、STUN、宿主访问及有界250ms忙循环。Blob／data新页含无需脚本的图片／样式探针及真实nonce，不把脚本没运行误算网络隔离 |
| `report-network-trap.ts::reportNetworkTrap` | 自有回环HTTP／UDP计数，样本各最多32条、URL最多2048字符、自有连接最多16个；整轮单调计数不reset，阶段路径独立，关闭后再核全部请求。只回复合规STUN绑定请求，不留数据正文 |
| `tests/ui/report-isolation.spec.ts` | 真实kernel创建隔离项目、实际files／resources.report／resources.read及条件保存R2；固定清单和PNG／字体样本不来自本候选输出。真实Browser及Electron主窗口先加载构建产品，再路由到专用父页／打包模块；所有攻击目标走实际自有HTTP／UDP，不拦截或abort攻击流量 |

### 实际结果与首次失败

证据根`/tmp/scholoom-report-isolation-round10/`。共享、桌面构建先于UI；测试期间没有重建同树产物。独立端口5861–5864、各轮独立profile／项目，所有结果目录及登记项目保留。没有安装、下载、启动开发服务、触发CI、提交／推送／PR／归档、同步或操作其他树／用户真实库。

- `ui-first.log`为首次真实结果，0/2：Browser的nonce远程脚本被浏览器Local Network Access拒绝，原预期错误地要求两宿主都执行；Electron已跑到关闭阶段，失败为读取Playwright frame清单早于实际detach。保存原trace、输入和`first-*-diagnostic.json`，没有把它们改记成功。
- 独立只读审查发现导航脚本缺nonce与无脚本通道、阶段reset会丢迟到请求、旧port断言缺真实回执。分别补固定样本、全轮累计／阶段路径／CSP终止观察、真实端点转移与queued正例。不是重试或延长期限。
- `ui-second.log`为1/2：Electron通过；Browser不支持MessagePort的`onclose`事件，不能等待原生通知判定应用层失效。保留原失败，后续按实际支持性记录；Browser仍发送真实旧port消息并核对选择不增加、旧待完成回执不交付、新实例有界消息循环继续工作，不声称已观察其原生close事件。
- `ui-third.log`为2/2（51.5s）。随后补实际bootstrap只读GET的CSP拒绝及关闭陷阱后最终计数，格式／导入整理经stdin与apply_patch完成；最终`ui-final.log`为2/2（50.8s，Browser13.5s／Electron14.5s）。原30s用例、5s观察、零重试保持，未增加sleep或放松产品期限。

最终每宿主的完整事实位于`results-final/report-isolation-*/isolation-diagnostic.json`，包含原basis、CSP事件、端口状态、包计数和有界心跳，原ref见同目录项目的`report.html`固定输入；所有轮次输入及失败trace分目录保留：

| 保证／样本 | Browser HeadlessChrome153.0.8010.12 | Electron44.5.1／Chrome152.0.7977.130（Linux） |
| --- | --- | --- |
| 实际页面／资源正例 | 脚本ready、PNG宽1、字体实际loaded | 同左 |
| opaque／宿主访问 | origin为null、父DOM拒绝、preload／process／require不存在；真实bootstrap GET被connect-src拒绝，无响应交付 | 同左 |
| 仅nonce策略 | HTTP仅control；远程脚本被LNA挡下，不能归功于CSP | 实际GET `/nonce/script`并执行，策略失败 |
| 交集CSP的16类通道及五类导航 | 被测strict／navigation路径0HTTP，CSP／frame生命周期事件有据 | 同左；全轮HTTP仅control和nonce反例各1次 |
| 全网络保证 | **失败**：实际STUN 1包、20字节 | **失败**：实际STUN 1包、20字节 |
| 桥／释放 | 六类错误绑定／对象／超量消息拒绝，window伪消息不执行；旧端点不再触发选择；过量移除iframe；根Blob关闭前可fetch、关闭后失败。原生close事件不支持 | 同左，另实际收到旧port的close事件 |
| CPU样本 | 250ms忙循环，最终父页心跳最大间隔258ms（第三轮251ms） | 最终17ms（第三轮18ms）；这不是强CPU隔离证明 |

HTTP正例control证明计数器工作；nonce反例在Electron证明脚本通道可实际送达，Browser本地地址限制不作为普遍互联网阻断保证。STUN仅为自有回环合成数据；它直接否定“脚本无网络”，不外推互联网可达范围。CSP和sandbox的属性本身没有被用作通过依据。

### 验证、审查和停止点

主要命令（日志同根）：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build
SCHOOLOOM_UI_PORT=5864 SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-report-isolation-round10/profile-final node node_modules/@playwright/test/cli.js test --config /tmp/scholoom-report-isolation-round10/ui.config.ts report-isolation.spec.ts --workers=1 --output=/tmp/scholoom-report-isolation-round10/results-final
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/protocol --filter @scholoom/editor typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
node scripts/check-architecture.ts
```

`build-shared.log`、`build-desktop.log`、`types-modules.log`及`types-final.log`通过；architecture为14模块／254文件零发现。`generator-check.log`核对最终schema生成映射，7份仅格式差异、无源码写入；`biome-final.log`通过，保留候选原可选链及样本脚本拼接／void类型的3条warning，不自动应用unsafe修复。OpenSpec strict及diff检查见同目录收尾日志。复用原辅助gpt-6.1-sol／high：一位只改网络观测有界计数，一位只读安全／证据审查；重要三项缺口已处理，后者未将静态审查算实跑。

真实边界为kernel／broker／ReportResources／项目文件与版本／Browser及Electron；合成输入为固定报告、资源和攻击脚本，选择回调为本片Promise替身，无模型、真实共同composer、报告生产页或完整harness业务验收。只观察到父DOM／API缺失和bootstrap样本被CSP拒绝，未穷举宿主漏洞或包发行环境；不据Linux本机两宿主关闭Windows／macOS、CI或科研质量。

**停止并交主线决策：** 保留活动报告unavailable；选项及依据已回写design“第九轮隔离机制原型”。继续现有静态HTML阅读不需扩大权限；若推进活动页，需另审覆盖UDP／DNS／HTTP和CPU／完整停止的真实承载，普通Browser iframe与Electron HTTP拦截均不能据本片保证兑现。生产父CSP、普通HTML／PDF影响尚未接入验证；2.1b／2.2／3.x、目标报告／旧版本Adapter、完整I5保持开放，材料M1仍无库正文提交provider。本片未重做已绿选区或旧报告授权保护。

## 第九轮：隔离夹具中断交接

本轮从共同源码0b78815继续，阅读Agent因上游provider 502中断，未形成完整交付。主线将`tests/fixtures/report-frame.ts`与`report-network-trap.ts`连同原design/tasks检查点保全后接入；只整理前者格式，没有补生产接线或隔离实现。两个文件仍是调查夹具，没有可运行测试入口，也没有Browser／Electron隔离证据；2.1a／2.1b保持未完成，生产报告页、目标报告及旧版本Adapter仍不可用。

主线共同构建、包类型与tools通过；Standards／Spec两位gpt-6.1-sol／high只读审查均未发现确证新增问题，静态检查不证明隔离。原始冻结tree、源码补丁、两轴结论及主线日志在`/tmp/scholoom-round9-acceptance-IER31D/`。下一片恢复原会话，补有界实际入口、自有网络观测与双宿主反例；任一保证不能兑现则保留不可用并交回决策，不放宽生产CSP或启用页面。

## 第八轮：真实委派报告展开来源

共同起点已只读核对为`8a2f0ce522dfbab4110e63e84e542f6660e6115e`，起始干净；消费`/tmp/scholoom-round7-acceptance-SdxHy8/`的验收／同步结果和当前正式源码，保留主线旧摘录／公开save／undo授权修复。未应用旧patch、同步分支、提交、推送、PR、归档、安装或操作真实用户库。仅完成1.2b.2a，当前5/12；1.2b.2b及2.x／3.x／完整I5开放。

| 文件／符号 | 实际行为及边界 |
| --- | --- |
| `harness/delegations.ts::checkReadable/resources` | 提取原materials、实际artifacts、outputs.save的唯一ref／basis核对；原describe/read/document和报告共用。取消信号、active及accepted/running核对保留失活拒绝，不复制白名单，不因父有权或清单声明增加子权限 |
| `manual.ts::checkReportContext/reportResources/reportSnapshot`、`application.ts`报告hook | 有界入口及清单按实际executionFacts确定子；入口先核，完整Evidence整批核对先于依赖／来源正文读取，返回前再核。跨项目报告及旧历史版本仍拒绝；未改主线旧摘录／save／undo保护 |
| `runtime.ts::checkReportContext/recordReportUse/instructionEvidence` | 完整成功snapshot才记真实核准Evidence。复用原meta仓储／序列化，session原键保护父／重启，`instruction-report-context:<sessionId>:<childInstanceId>`只记录本子使用事实，不成为权限源、不新建材料表。原delegation.reads仍只来自实际资源read／document |
| 子模型`reports/evidence/authorize/confirm` | 读取本实例持久Evidence，合并工作包及实际reads；异步授权和最终同步确认重新核活动身份、唯一范围及领域read/send。最终确认读取新集合，不捕获旧清单，不消费父的全部Evidence扩大范围 |
| `tests/fixtures/report.ts`、`report-production.spec.ts`、新增`delegated-reports.spec.ts` | 原真实报告fixture原样抽取复用；新样本为真实父子进程、库导入、项目JSON／HTML及broker，ref／basis来自实际回执。核全量成功、缺库／依赖、真实D1→D2旧basis、queue／final／restart和取消；拒绝时展开正文read为0，成功时reads只记实际入口 |

证据目录`/tmp/scholoom-delegated-reports-round8/`保留原始输入、每轮结果、trace与附件；不覆盖首次失败：

- `build-first.log`先shared构建通过；格式收尾后`build-final.log`重建harness／kernel再测试，期间未并发重建同树产物。
- `baseline-first.log`普通委派及根报告21/21通过，包含父隐私隔离、真实保存、取消／重启、容量及unknown、旧摘录、公开save／undo与改名、目标报告及不全委派拒绝。未重跑无关CI或nativeTeX。
- 新增首轮`delegated-first.log`4通过／3失败：前三种范围拒绝及全量成功通过；队列预期漏掉父撤权收尾的取消竞态，final查询早于受理登记，缓存资源端口取消沿原signal.reason而非统一instanceMismatch。修正测试oracle和时机后`delegated-second.log`3/3通过，未改生产停止／授权或时限。
- `delegated-final.log`7/7通过，但追加独立窄审指出queue证明仍可被“父先失败取消子”满足，不能据这次绿关闭该边界。最终只在外部模型准入边界暂缓父第二次请求（不占slot），真实子全量授权并在真实lease后排队；释放后必须观察子原authorize／confirm的permissionDenied及子failed，再恢复父核查父也失败。`admission-proof.log`queue／final最终2/2通过（18.5秒／17.2秒），均无第二个子模型请求。finally释放gate，不改变业务worker／broker／仓储或模型预算，不加重试或时限。
- final实际调用原confirm，每次重置Evidence观察标记，按独立manifest集合核对权限接口收到完整来源，避免只凭首次准入标记或不完整范围假绿。重启原profile查询原delegation不新增模型请求，显式新session.send仍拒绝；旧子context不因持久记录恢复权限。
- harness／kernel类型及tools检查通过，architecture 14模块／253文件零发现，同源派生映射核对通过（生成器7份格式差异输出按空白归一，无protocol源码变更）。Biome退出0，18条原有非空断言提示保留。OpenSpec strict及diff收尾结果沿同目录日志。

主要命令：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/harness --filter @scholoom/kernel build
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/harness --filter @scholoom/kernel typecheck
node_modules/.bin/tsc --noEmit -p tsconfig.tools.json
node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/report-production.spec.ts tests/kernel/agent-delegation.spec.ts --output=/tmp/scholoom-delegated-reports-round8/baseline-first-results
node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/delegated-reports.spec.ts --output=/tmp/scholoom-delegated-reports-round8/delegated-final-results
node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/delegated-reports.spec.ts --grep admission --output=/tmp/scholoom-delegated-reports-round8/admission-proof-results
```

Linux使用现有依赖；模型HTTP为隔离loopback受控响应，准入观察及父gate仅在模型边界并调用原五参数、共享budget和confirm。权限hook／资源read观察也调用原实现，不合成可信身份、回执或数据；内部worker、文件、库、broker和SQLite真实。配置／项目／端口逐测试隔离，注册项目保留于结果目录，关闭本轮app和模型server。无产品UI变化，不重复双宿主，不启动开发服务器。

独立只读审查未发现生产diff确证P1/P2；追加测试审查发现并在修正后确认queue P2证明缺口关闭，审查未代替实跑。最新已知CI仍为39be889／40432749785：Linux709通过／9失败／23跳过，Windows641通过／54失败／39跳过／7未运行，macOS不可用校准2通过、人工入口3通过／1失败；本机定向通过不关闭目标平台或全仓CI。

OpenSpec strict及git diff --check均通过，apply回执为5/12且ready。可审查本地增量为`/tmp/scholoom-delegated-reports-round8/delegated-report-sources.patch`，同目录manifest.json列11个准确文件、共同起点及必须一起接入的四个源码文件；已只读逆向核对当前目标状态，不实际应用或提交。所有测试／构建任务及本轮辅助Agent均结束，结果目录保留。

停止点：本轮委派展开子片已验收，未关闭完整1.2b.2或proposal完整交互判据。目标报告授权组合、旧报告正文版本Adapter仍不可用；页面／iframe／MessagePort／自动发布及2.x／3.x后置，M1库正文仍缺provider。科研质量、Windows／macOS及发布未验；本轮没有新产品选择需要推定定案。

## 第七轮主线安全验收

独立Spec审查确认P1：发送前报告已被普通HTML覆盖时，仅按当前正文描述会漏掉旧摘录的库来源。Standards审查确认P2：公开undo及同类files.save回执可携带未授权旧报告正文。主线新增真实Kernel／Manual回归，稳定旧产物下3项均失败后修复；取原Evidence的窄授权端口复用项目有界历史，精确匹配fileId及before／after basis。旧报告或无法核查的版本明确unavailable，普通材料保留原摘录及basis，不校验quote子串或替换摘录。

公开files.save在串行保存核对实际before后、首次文件副作用前检查将交付的旧正文；undo同时检查历史及当前路径，非创建分支透传串行回执检查，创建撤销在rename前检查。拒绝时未保存／撤销，成功仍返回真实FileEdit；resources.save继续只返回Descriptor。追加审查发现的目标只读scope与改名undo边界已分别修正：历史核查沿withTargetRead复查原主体／目标信任和实例，撤销按实际路径检查，未扩大子权限。

重编译后report-production、context-resources及material-history组合20/20通过，包含4个新增代表例、普通跨项目旧摘录、队列／最终模型准入／重启、历史与整次撤销。两位审查者追加只读复核均未发现剩余确证问题。命令、首次失败、最终日志和产物位于`/tmp/scholoom-round7-acceptance-SdxHy8/report-red-stable.log`、`main-security-final.log`及各results目录；前者3项红例，后者20项组合，不记为首次全绿。

本次没有历史报告版本授权Adapter、委派展开或目标报告提供者；这些路径继续明确不可用，1.2b.2及完整I5不关闭。下一片只提取Delegations唯一readable权威并接逐项报告展开／子模型准入，页面、iframe与自动发布仍后置。

## 第六轮资源接入（历史）

2026-10-27，第六轮从已同步共同源码`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`实施授权的1.1b／1.2b可证明部分。消费依据为`/tmp/scholoom-round6-acceptance-dXuzCA/{acceptance.md,synchronized.json,sync-build-results.json,sync-kernel-results.json}`和本树正式源码。没有应用旧patch、同步分支、新提交、安装、推送、PR、归档或真实用户库操作。当前**4/11**，1.2b拆为已验收普通根执行及待安全接口审查两项；完整报告change和I5未完成。

| 本轮文件／符号 | 实际接线及边界 |
| --- | --- |
| `protocol/resources.ts::resources.report`、`index.ts`、`business-types.ts`、`architecture.json::editor.provides` | 公开原ref／basis→ReportSnapshot同源操作，根导出原报告契约，最终生成映射核对一致；不增加ResourceRef类别、reportId、存储或第二套DTO |
| `editor/node.ts`、`ResourceAccess.describe/save`及kernel的`resourceCreation` | 公开原codec／ReportResources；项目HTML在256KiB内可有条件保存，沿原strong basis／expectedFileId，UTF8新正文超限拒绝；大HTML、库、跨项目仍只读 |
| `ReportResources.isReport`、`manual.ts::reportResources/reportSnapshot/describeResource/withReport` | 真实项目／库Adapter，头部短片累计及BOM一致；识别前后仍核授权。共同describe／read／document／report及原files.read/readBytes交付内容前核查完整声明集合，内部可信editor端口避免递归；普通HTML继续不执行脚本 |
| `application.ts::reportUsed`、`Harness.recordReportUse` | 普通根执行及可信host指令受理将真实入口／依赖／来源Evidence写入原instruction-resource-context；沿原库／target使用跟踪和准入检查，不新建来源表。queue／final／restart重新核权限；受理后清单被移除也保留旧摘录来源 |
| `KernelApplication.checkReportContext`、`project.readTarget`报告分支 | 真实executionFacts不能证明普通根执行时在展开前unavailable；目标读取在原provider内检测报告并unavailable，普通目标HTML仍只读。未移除targetRead，也未替代委派白名单 |
| `manual.ts::checkReportHistory`及原files.edit／history消费者 | 报告HTML的旧FileEdit全文无法以当前basis验证，返回前明确unavailable，防read_file_edit直接外发旧正文；changes摘要、普通材料及Markdown中的头部示例保留，不改存储或undo提供者 |
| `report-production.spec.ts`、`report-resources.spec.ts`、`resource-identity.spec.ts`、`ui/report-resources.spec.ts` | 独立手写wire样本；真实Manual保存／替换／撤权，真实Kernel普通工具及模型准入、重启、受理后清单变化，真实子worker与目标读取的不可用边界。两宿主仅验证已保存报告经共同HTML入口安全打开；不启用iframe或页面桥 |

完整证据在`/tmp/scholoom-research-round6/`，保留每次首次输入、结果和trace，没有用最终通过覆盖失败：

- `build-shared.log`、`build-shared-final.log`、`build-desktop.log`通过；后续host来源保存改动先由`build-admission-final.log`重建harness／kernel，再测试。最终探测授权补充由`build-editor-prefix-final.log`编译editor后再测试，测试期间无重建。
- 首轮`kernel-first.log`为44通过／6失败：5项新夹具未建assets目录，另1项旧用例仍将所有HTML视为只读。第二轮10项为5通过／5失败，独立wire样本的UUID未按既定注释格式转义。第三轮5项为3通过／2失败：模型夹具用了不存在的工具名；子运行错误已沿模型边界归一化，测试错期待原领域码。修正夹具后`kernel-fourth.log`2通过。
- `kernel-final.log`15/15通过：真实来源／FileEdit、生态持续read/send、报告生产6项及身份保存／替换保护。最后探测read授权补充后，`kernel-prefix-final.log`为ReportResources26项＋生产6项，32/32通过；`codec-final.log`45/45通过，保留共享JSON预算和BOM递归修复。分轮结果不相加称一次全绿。
- 共同read／document装配增加了报告前后检查，追加原`resource-access.spec.ts`核对取消、所有权、撤权、关联及真实PDF／EPUB／HTML解析，`resource-access-final.log`10/10通过。最终历史正文保护先经`build-history-final.log`及`build-history-consumer.log`编译，再由`history-consumer-final.log`2/2验证真实报告历史拒绝和普通父子FileEdit回归，未重复已绿UI。
- UI首次配置尚未进入测试即因/tmp缺ESM声明失败，`ui-first.log`保留。随后夹具修复包含：project.create不能预建目标目录；按projectId建会话；父执行先走真实read_file再edit_file；正文只断言语义，真实文件另核字节。中间运行均有各自ui-second／third／fourth日志及trace。
- `ui-final.log`为3通过／1失败：材料父子历史双宿主通过，Electron报告在第二次整页重载触及默认30秒。资源阶段烟测改为一次“保存后从产品入口打开”，不承担3.x页面更新／重载状态；不加时限。`ui-report-final.log`报告双宿主2/2通过（Browser12.6秒、Electron17.8秒）。不能合并称一次4/4，也未验收交互页。
- protocol／editor／kernel类型检查、最终tools类型、architecture零发现、7份派生映射（仅忽略格式空白）核对通过。一次tools检查早于新editor产物完成，报告旧dist无isReport，日志保留，构建后复验通过。Biome最终退出0，保留8 warning及1 info；strict与diff结果见本轮收尾检查。

收尾两change的OpenSpec strict及git diff --check通过，日志为openspec-material-final／openspec-reports-final／diff-check。历史正文保护追加独立只读窄审未发现经root read_file_edit的确定绕过，未找到模型undo入口；未将审查视为实跑。本地可审查增量为`/tmp/scholoom-research-round6/report-resources.patch`（20文件），精确写集和共同baseline在同目录manifest.json；与材料6文件测试／文档补丁独立，均经git apply --reverse --check只读核对当前目标状态，未实际应用或提交。主线组合其他增量后仍须以最终schema核对生成映射。

最小命令入口：`pnpm --config.optimisticRepeatInstall=false build:shared`、相同参数的desktop build／筛选类型检查；直接已有Playwright运行上述指定kernel specs及两份UI specs。UI用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`及本轮临时ESM配置，端口5846，profile／项目／库／输出独立。仅外部模型loopback响应、准入撤权时机及模块窄端口可控；broker、SQLite仓储、文件、子worker、目标provider和双宿主均真实。注册项目留在各结果目录，所属临时配置由原夹具停机退役；无常驻开发服务。

独立只读窄审确认target读取绕过、委派展开越白名单和子confirm遗漏展开来源，以及一次前缀探测的短片假设；对应收口／回归后追加审查未再确认这些已报绕过。审查未代替实跑。还核对了host受理来源的身份及无递归接线，真实queue-excerpt回归通过。未修改TaskResearchPort、FileEdit权威、delegations实现或生态成功工具的rememberCatalog。

**交回的具体缺口：** 1.2b.2须由主线审查提取并复用原DelegationManager唯一readable检查，报告展开前逐项核对白名单，再将该实例的已授权展开Evidence交现有子模型最终check；本树未复制该私有规则。跨项目报告有两项选择：继续保持当前unavailable；或明确允许沿来源领域分别授权声明材料，并设计与单目标targetRead的组合，不能简单移除targetRead。旧报告历史正文须以原beforeEvidence／afterEvidence及已保留正文设计版本读取Adapter，目前不能以当前文件ref／basis代替。本轮停在上述可证明部分，2.x／3.x、HTML自动发布、iframe／MessagePort、原子附加及完整I5保持开放。M1库正文仍无提交provider。

最新已知CI仍为6b22d60／40315429083：Linux689通过／9失败／16跳过，Windows628通过／49失败／30跳过，macOS入口3通过／1失败；本机增量不关闭平台失败、全仓CI或真实科研质量。

## 第四轮历史成果

2026-10-26，用户第四轮直接授权1.1中的manifest／snapshot／桥schema、有界头部codec和1.2注入端口ReportResources。固定比较点为`e71663b02a3444af0bda2091218dd09ebc0df638`到工作区（含untracked），0519904已在本树；没有新公共源码同步、Git历史操作或新提交。原材料M3／图片、共享来源／历史、v5→v6迁移和双窗口夹具均保留。材料诊断另记同change的tasks／delivery，没有合并两change。

第四轮将原1.1／1.2拆为可独立验收的a模块与b生产部分，当时只完成1.1a／1.2a，进度为**2/10**；尚未接生产操作、保存及来源准入。第六轮实际范围见上文，proposal的四条完整判据仍未整体达到，不声称完整I5通过。

| 文件／符号 | 实际成果与边界 |
| --- | --- |
| `protocol/report-contracts.ts` | 复用ResourceRef／Evidence／Descriptor；manifest、snapshot及version/viewId/generation/basis桥消息schema，FromSchema类型、UTF-16／JSON字节及对象／来源索引校验。不新增reportId或资源kind，不注册操作 |
| `protocol/package.json::exports[./reports]`、`architecture.json`的editor allows | 仅导出契约叶模块并允许准确依赖。没有protocol根聚合、editor/node报告导出或业务映射／注册变化；不扩大系统适配和领域操作权限 |
| `editor/report-codec.ts` | 按约定起始注释及独立结束行提取最多128KiB JSON，编码转义`< > -`且核对转义后字节；不解析HTML正文、不开页面或网络 |
| `editor/report-resources.ts::ReportResources.snapshot` | 注入原describe/read和宿主绑定authorize(evidence, read/send)，以入口ref/basis读取并核查完整清单。路径用relativeFile及所属describe核对同一对象，前后核查版本、入口位置、来源权限和混合版本；只返回原resource/manifest，不创建存储／持久缓存 |
| `tests/kernel/report-codec.spec.ts`、`report-resources.spec.ts` | 独立手写头部和固定描述／字节adapter，验证结构、容量、拒绝和撤权。部分边界构造合成大字节，未证明真实磁盘／库压力或生产授权 |

路径／私有目录及真实链接范围仍由describe所属领域保证，模块只消费有身份的描述，不借nativePath读取、不复制项目私有实现。人工read和Agent send均交宿主绑定端口核查；端口可替换不表示真实provider已装配。来源HTML只累计识别固定报告前缀所需字节，不读取整本或递归引用图。最后整体授权在全部异步入口／路径检查之后执行，失败不发布部分快照；已开始的有界读取收尾后才拒绝候选。

设计总览仍表示最终链路；本轮只验证“报告文件／显式清单→ReportResources”模块路径，ReportView、iframe、MessagePort、共同composer、实际保存／刷新等其余边尚未接线。schema中的桥形状不执行动作、限速、原子附加或页面隔离。初始规划的旧等待说明已标历史并替换为当前子范围。

## 实际验证

Linux，Node24.12.0／pnpm11.10.0，沿已有锁定依赖；本轮未安装、升级或改锁文件。所有测试为模块合成样本，不启动UI或开发服务器、不接真实用户库。本change未调用外部模型；材料任务A的真实nativeTeX观察单独记录，不能当报告验收。

| 检查 | 首次／最终结果与证据 |
| --- | --- |
| shared构建 | 首次及每次相关源码修正后通过；最终`/tmp/scholoom-round4-reports-build-accepted.log`。构建完成后才测试，运行期间不重建共享产物 |
| protocol／editor／tools类型 | 通过，`/tmp/scholoom-round4-reports-types-accepted.log`。包内tsc及tsconfig.tools均覆盖本轮模块和测试 |
| schema／codec | 最终44/44，`/tmp/scholoom-round4-reports-module-complete.log`、`test-results/reports-module-complete`中的report-codec场景；含结束行独占、手写头部、Unicode转义、数量／128KiB、UTF-16、snapshot、非JSON桥值及64KiB |
| ReportResources | 最终24/24，`/tmp/scholoom-round4-reports-resources-accepted.log`、`test-results/reports-resources-accepted`。身份／path-ref、basis／移动、read-send、撤权、短分片递归来源、8MiB／32MiB／256KiB、最大4并发及失败收尾 |
| 首轮模块 | 17通过1失败：`/tmp/scholoom-round4-reports-module-first.log`。夹具复用capabilities对象，来源read=false误改入口；隔离对象后继续，不放宽生产拒绝 |
| 第二轮组合 | 63通过3失败：`/tmp/scholoom-round4-reports-module-final.log`。raw JSON超限被归为invalidRequest，修正编码入口先返回tooLarge；两UNC样本未JSON转义，修正输入使其实际到达路径拒绝。随后66/66通过，`/tmp/scholoom-round4-reports-module-verified.log`；新增结束行后67/67通过，上述complete日志 |
| 最终授权红回归 | 新增来源在各入口异步核验点撤权，原实现1失败（返回了snapshot），`/tmp/scholoom-round4-reports-final-auth-red.log`及`test-results/reports-final-auth-red`。移最终authorize至路径核验之后，24项模块复验通过；不是把首次结果写成一次全绿 |
| 架构／生成 | 13模块、204文件、0 findings／exceptions：`/tmp/scholoom-round4-reports-architecture-accepted.log`。生成器自检通过，8份声明映射中6份格式化差异核对一致、另2份无需变化；`/tmp/scholoom-round4-generator.patch`只作比较，未应用，无生成源码改动 |
| 静态收尾 | 7个业务／测试／元数据文件Biome通过（少量useTemplate提示不影响退出码0），`/tmp/scholoom-round4-reports-biome-accepted.log`；两个change strict、git diff及新增文件空白检查通过。报告叶导出可编译不等于生产操作已注册 |

主要实际命令（各轮日志／结果目录如上）：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --filter @scholoom/protocol typecheck
pnpm --filter @scholoom/editor typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-codec.spec.ts tests/kernel/report-resources.spec.ts --workers=1 --output test-results/reports-module-complete
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-resources.spec.ts --grep 'source revocation during every' --workers=1 --output test-results/reports-final-auth-red
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-resources.spec.ts --workers=1 --output test-results/reports-resources-accepted
pnpm check:architecture
node packages/protocol/scripts/contract-types.mjs --self-test
node packages/protocol/scripts/contract-types.mjs --patch
openspec validate add-interactive-research-reports --strict
openspec validate add-material-annotation-interactions --strict
git diff --check
```

这不是一次合并68项全绿：44项codec与修正后的24项资源模块分轮通过，保留中间失败和红回归。没有产品UI改动，按用户指令未重复原已绿双宿主；不宣称材料首次控制进程unknown根因已修复。

## 审查与问题处理

使用原生gpt-6.1-sol/high辅助固定codec样本和独立只读审查，父Agent掌握模块实现、跨模块决策及最终验收。独立窄审确认三项P2：短分片漏识别递归报告、入口同basis移动后沿旧目录解析、Map／ArrayBuffer等非JSON桥值绕过JSON字节计量；分别修复并加代表性回归。后续窄审发现入口最终异步检查之后缺少整体来源授权，以红回归确认，再修复／复验。最终只读复核确认以上残余关闭；审查本身未运行测试。另自查修复UNC样本、证据payload不夹带path/mediaType、坏UTF8及伪报SVG依赖；未扩生产权限。strict初检因新增Requirement过长告警，拆成头部、完整快照和桥JSON三个行为后通过，没有放宽规格。

## 未完成事项与下一步

交接目录`/tmp/scholoom-round4-research-8uzKwk/`提供固定e71663b到当前含untracked的累计补丁、独立报告模块补丁和相对主线验收快照的材料诊断文档增量，manifest列来源、文件及依赖。累计补丁含已接收M3成果，不能重复应用到本阅读树；独立报告补丁消费当前同源资源声明，公共接入仍由主线按符号核对、构建／测试后再调度消费者，不操作其他真实树。

第四轮时未接的生产部分已按上文第六轮记录推进；当前准确缺口为1.2b.2及报告2.1 iframe／CSP／导航、2.2原子附加、3.x发布更新／草稿／等待、4.x完整I5，不以材料PDF或报告浏览代替。

材料M1仍缺正文提交／新版本与unknown结果provider；M2实际来源及整次撤销provider现已在共同基线，真实消费者见材料change。未读取／打断活动research-task-workspace；真实报告科研质量、全仓CI及Windows／macOS分发未验。

## 主线验收：报告边界修复

主线独立规格审查确认两项模块P2，尚未启用生产桥：共享子树可在容量检查前指数展开；UTF-8 BOM被入口TextDecoder移除，却令来源原始前缀漏认递归报告。主线小探针实际接受了BOM递归来源，19个不同节点被序列化为1835108字节；证据在`/tmp/scholoom-round5-acceptance-WBreMJ/report-boundary-repro.mjs`。

保留原非JSON拒绝，序列化每个展开出现都扣除JSON字节数的保守下界预算，超限中止，再核对最终UTF-8实际字节；容量内共享引用及原64KiB边界保持。来源探测多读3字节，沿入口同一TextDecoder BOM语义判断前缀，原短分片核对保留。两项回归先针对旧dist运行，2失败：64MiB隔离子进程不能完成36层共享数据展开，BOM候选错误成功。修复后重建，schema／codec与资源模块组合70/70通过（3.9秒），日志`research-interaction/boundary-red.log`、`boundary-build.log`、`boundary-green.log`。四文件Biome与tools类型通过；只读追加审查未发现误拒合法容量或短分片问题，没有新增依赖、生产API、UI或权限。1.1a／1.2a的模块子范围保持，生产及整体任务继续开放。

## 第21轮主线验收（2026-10-30）

五树27文件逐树停止、冻结并cherry-pick合入dev，原提交及清单见`/home/joshua/.cache/scholoom-round21-acceptance-pCcY4R/frozen.json`。接收3.1c、3.1d、3.2c及2.1e规划，当前20/26；R2c按固定可信输入试验接收，不关闭正式呈现或完整3.x／I5。

项目线停止后冻结f7f3698，单文件tests/kernel/report-publication.spec.ts经cherry-pick f1cc0b3合入dev。真实普通worker保存新依赖后，测试在实际SQLite关联INSERT处仅失败一次；磁盘、FileEdit、原instruction/run/instance与pending回执分别核实。沿已有artifacts.reconcile补原关联，不重写文件；其协议effect=write，不将补关联称为纯只读。旧完整报告保持，核原实例exited并await应用及受控模型服务关闭。

主线固定未变packages/kernel/desktop产物，运行`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-publication.spec.ts --workers=1 --output /home/joshua/.cache/scholoom-round21-acceptance-pCcY4R/publication-results --reporter line`，3/3通过，42.6秒。证据为同cache的publication.log、publication-check.json与frozen-project-execution.json；TMPDIR也在该cache。作者单项1/1、tools/格式/strict及独立只读复核见上一轮cache的next/project-execution/RESULT.md和review.md；两次测试路径／状态预期首败保持，没有生产修复或真实模型调用。

3.1d原提交f462a03／主线27bebb9，新增真实client Adapter及领域测试。主线运行report-client与report-updates组合11/11、20.5秒；真实入口版本、dirty/pending、旧页独有来源撤权、空闲重连及可读依赖basis前进均有代表。主线监督发现旧basis判定会阻止合法新版，作者在首次测试前修正并补代表，不倒填旧实现红例。独立client-review实跑探针另复现订阅异常会阻断共享重连的P2，主线683010d仅在Adapter逐监听器隔离异常并为派生Promise收尾，新增真实断连回归；修正后原四项加新例5/5、20.1秒，client-review-followup静态复核关闭P2。诊断日志保留预期注入异常，不属于unhandled错误。首次新增测试格式检查失败1处，仅换行修正后格式通过，业务测试后无语义变化。原始命令在client-check.json／client-fixed-check.json，首次探针与新修复数据分别保留。

R2c原提交a645e10／主线0df1461，实际有限算法与原反例范围见本记录R2c节。主线`node tests/fixtures/report-input/run.mjs <本轮cache>/input-ui`先构建再固定，真实Browser／Electron完整4/4、77.3秒，无失败／跳过／flaky；作者两版产物与首败仍按原记录区分。真实文档、输入节点及源确认保持，不据固定table更新宣称任意HTML／系统IME／读屏或安全隔离已实现。

3.2c原提交43beb78／主线64a4cf6，主线`node tests/fixtures/report-lifecycle/run.mjs <本轮cache>/lifecycle-ui`完整双宿主4/4、72.5秒。复用真实Workbench／共同草稿／检查器及三个module，核dirty/pending、原显式项basis、关闭旧consumer、同版恢复、copyOnly/denied及65536→65562字节完整恢复封套拒绝；client/load/授权为明确替身。构建只替换未挂载ResourceView/project-ui，真实被测组合未替换。作者前六轮构建／类型／受控端口不足的失败与超时均保留，没有加用例预算；主线首次即通过。两组UI的实际Electron profile均随共享fixture隔离，结束沿原自有内核／窗口收尾。页面ready及reload不是本片通过项。

2.1e原提交725d6e1／主线122ed02，安装前候选不含实际系统部署。独立t1-review确认M的strict cgroup视图及草案storageId重定义各一项矛盾；主线2657ec9保留原records UUID、仅M改宿主cgroup只读视图，当前草案复制到本轮t1-drafts/，旧稿不改。t1-review-followup关闭两项规划阻断，其余跨UID采证、FIFO、完整库存／停止、安装与T1/T2仍未证。主线选择该方向继续离线验证，不授系统权限。

主线direct electron-vite重建desktop成功，约93秒；tools／desktop类型、直接node架构14模块271文件0 findings、受影响代码Biome、report strict／scholoom-dev／diff通过，命令与日志在desktop-build-check.json、final-checks.json及对应日志；更新后不重复未变packages/kernel或已绿业务矩阵。UI、内核及修复分别是不同运行，不相加为一次整组。主线另在39cf7cb校正文档：实际prepare/freeze限定Linux接线已通过；草稿仅存browse/draft/dirty及64KiB，不缓存旧入口或清单。接线只读调查与父核对在integration-seams.md。

下一批四任务及三等待见design第21轮。全树先同步再发任务，当前/tmp不作输入；不push、不查跑CI、不发真实模型请求、不安装或加载系统策略。跨失联连接远端handler结清无公共确认，Adapter只证明活连接串行，不能据本地Promise结束宣称远端已停。正式浏览器、来源永久失效后同绑定切新候选、真实页面装配、目标平台与完整I5继续开放。
