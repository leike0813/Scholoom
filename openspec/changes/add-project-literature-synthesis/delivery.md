# 实际交付与交接

## 有界验收：报告已存，单请求上限停止（2026-10-31）

用户“批准验收”明确授权`synthesis-structured-resume-20261031-6a21fb7b-29x16384-900s-v1`，授权记录在`E/synthesis-structured-resume-prepared/authorization.json`。本轮沿原task／session／run／checkpoint发送一次普通接续，实际证据为同目录`run-PJb56j/`。3次真实HTTP全部200完整，实际请求正文分别194,416／234,905／237,094字节，共666,415字节，回包model均标记MiniMax-M2.7；这不证明供应商后端版本。第4次因正文超过单次262,144字节被本地网关拒绝，未外发；`gateway-audit.json`明确stopped=request-too-large、rejected=1，不是新的JSON解析等待。runner的通用“Incomplete/waiting”断言和停止前state=running不能当作最终状态。

已存真实report.md（4,923 UTF-16／8,031字节，fileId=`93b555e4-2e59-4886-9b19-294430abda6d`）及process.md（47,929 UTF-16／65,270字节，原fileId保持，8个历史版本）；父线从原读回和FileEdit分别核版本及所属project／session／run，收据为`partial-file-verification.json`。尚未完成首Graph最终检查或任务成果导航，没有添加Wilson2017或启动第二Graph。自有kernel exit0、profile stopped、cleanupErrors／evidenceErrors均空；只读原SQLite核run=interrupted、三个原实例均exited，记录`post-shutdown-run.json`。不将停止前残留的旧graph.wait／GraphProgress当成新完成或新问题，不重建任务、重放写入或手改报告。

本轮暴露SDK结果回显的上下文成本：一次结构化结果在实际调用参数、完整ToolMessage及SDK自动终结AI正文中保存三份；第2、3个真实请求各含12,904字节自动终结回显。父线使用已装toolStrategy的toolMessageContent选项将**后续新结果**的终结AI改为简短确认；实际调用、完整回执和旧checkpoint保持，未增加手工压缩、历史重写或第二套结果读取。恢复仍按原精确末三消息读取。本修复降低后续增长，不保证旧上下文已低于本次256KiB上限，也没有在本次已停止授权下追加真实请求。

在原生产综合测试增加一项合成标记的实际请求重复数核查，旧dist真实1/1失败（期望2份、实际3份），修正后定向5/5、1.1分钟通过，覆盖正常具名提交、纠正前新指令确认、完整参数截断拒绝及cached exact／unknown两类root保存切断。最初锚定grep未匹配而No tests found，另存为选例错误，不算业务红例。harness／kernel构建、tools noEmit、两文件Biome、architecture（14模块／281文件／0问题）及diff通过；一次Biome仅换行修正。命令和实际退出回执在`E/synthesis-result-echo-checks.json`，红／绿原输出目录为`synthesis-result-echo-red-selected/`与`synthesis-result-echo-green/`。此次只针对一项SDK配置变化复验，没有把此前28/28称为本次重新实跑。

独立gpt-6.1-sol／high内容核对见`E/synthesis-structured-resume-prepared/CONTENT-REVIEW-PJb56j.md`：从真实HTTP工具返回逐段核两篇原文同basis、全文无缺口且字节对应，主要引述、部分比较及材料／证据局限成立；草稿仍有高风险推断越界，把开发实践“不保证高效无错”扩成“两文否认复现保证可达成”，并将有条件的同行复现可能性写成从“不可能”到“可行”的全称结论。另有两来源却题为三来源、跨栏接句和中间产物保存／版本控制范围混淆。父线抽查W原文29–33／327–331及S原文145–158确认核心区别。草稿尚未经图内review，本核对不代替该职责、不倒填系统内独立委派，也未改写任何科研产物。

6.3／6.4仍未完成，本轮真实验收**未通过**。累计14次／1,873,534字节，原40次／4MiB总量余26次／2,320,770字节，只是历史预算核算，不是下一次授权。任何后续须针对当前interrupted状态重新准备并核对原checkpoint接续，不能重用假定waiting的旧runner或旧授权；单请求容量应依据实际上下文调整，同时保持明确总量、停止及归属限制。下一轮仍需完成图内依据自查和首Graph交付，再做第三来源的新会话实际影响，内容问题未改正前不能归档。交互报告的MathML／内存及生产隔离缺口保持其独立change，不由本次报告文件保存代替。

## 原执行接续、结构化提交与指令竞态修复（2026-10-31）

用户“授权；接受。请继续进行收尾”授权原待审接续计划。首次启动`E/synthesis-resume-prepared/run-Lr5I26`在发送前因短调用指针与完整历史调用的比较错误停止，0 HTTP／0新指令；修正为原完整历史调用后，保留原消费声明及零效果证据，继续尚未提交的同一次动作。实际接续`run-SxbNJc`仍是原task／session／run／checkpoint：4次真实HTTP、请求正文717,475字节，均200完整；取得并保存了合法取材结果，综合职责返回普通说明后进入delivery-wait。按约停止，没有回答等待、加入第三来源或第二Graph；自有内核exit0、profile stopped、cleanupErrors为空。原7次加本次4次合计11次／1,207,119字节，报告尚不存在，6.3仍未通过。

本轮用已安装SDK的toolStrategy和同源nodeOutput schema提供结果工具，显式auto，严格校验和原JSON checkpoint读取保持。结果工具不注册领域操作，完整参数但max_tokens仍modelFailed、不保存候选。SDK包装的本地OperationError仅经确切MiddlewareError链解包。一次格式纠正最初使用afterModel快捷跳转，独立审查确证P2：绕过beforeModel，遗漏首响应期间受理的新用户指令。已删除该中间件；改由原业务图持久保存完整通道及outputCorrection后，路由同职责的新consumer，经正常指令确认／授权／共享预算执行一次纠正；再次无效进入原等待。具体行为和恢复边界见design，不重放已保存职责或未知文件操作。

最终`tests/kernel/project-literature-synthesis.spec.ts`一次**28/28通过，5.0分钟**。真实kernel／worker／broker／SQLite／文件，只有模型HTTP是合成边界；新增代表在错误响应期间经session.send受理新指令，实际纠正HTTP前核child消费确认已提交且请求含新约束，未存无效正文。另核截断提交、共享32次预算、原来源／Task CAS／消费丢回执及两类保存切断。原含快捷中间件的全套27/28首败保留于`synthesis-structured-full-regression/`，不能计作最终通过；修正后命令及最后实际工具回执为`E/synthesis-graph-correction-result.json`，测试输出为`synthesis-graph-correction-regression/`。harness／kernel构建、tools noEmit、受影响七文件Biome、architecture（14模块／281文件／0问题）及diff通过。独立gpt-6.1-sol／high窄审及修复后复核完成，原P2关闭，无未解决的高确信P1/P2，记录在`E/synthesis-structured-independent-review.md`；复核核当前源码和最终完成收据，没有重复实跑或外推科研质量。

原实际接续已按约停止，不能自动再调用模型。下一次原run普通消息接续和完成后新增Wilson2017／新会话第二Graph的离线入口为`E/synthesis-structured-resume-prepared/runner.mjs`，默认NEW-AUTHORIZATION-REQUIRED；具体计划在同目录plan.json。保留原总量下的剩余29次／2,987,185字节、每次256KiB／16384输出tokens和新900秒窗口，等待／错误／超限即停、不整项重试；只有新明确授权后才执行。请求模型名仍MiniMax-M2.7，供应商可能路由别名，实际回包另存；不保证后端版本。独立内容标准及三篇原输入不变，不把结构化机械测试当科研质量。6.3／6.4保持未完成，未归档。

## 真实综合首次等待及输出边界修复（2026-10-31）

用户“授权你继续收尾”覆盖此前明确披露的`synthesis-live-20261030-d0f2265-dirty-40x16384-900s-v1`：两个Graph统一MiniMax-M2.7，共40次HTTP、累计4MiB、单次256KiB／输出16384tokens、首请求900秒，等待或失败即停，不自动回答或重试整项。证据根仍为`E=/home/joshua/.cache/scholoom-closeout-execution-20261030`。首次`run-GpyRS5`仅准备失败：resources.create所需sources父目录不存在，模型请求／run／instruction均0。cache runner改为先经正式files.mkdir创建目录，schema及离线guard自检通过后继续原有界验收；未重放已受理工作，原失败证据保留。

实际首次Graph在`E/synthesis-live-prepared/run-CRo9Yw`：project=`af8a4856-3ec7-4bc1-9307-63dc28ac7b8a`，session=`add458f8-7186-442a-a594-d26493b9345b`，原run=`6a21fb7b-ae5d-4f2e-9eff-1c42912cce04`。7次真实HTTP、请求正文489,644字节后delivery-wait，runner按约停止；没有回答等待、添加第三来源、启动第二Graph或自动重跑。报告尚不存在，过程、任务、原输入快照、完整transport及原checkpoint保留；内核已正常停止，不能据模型正文有研究判断宣布6.3通过。

第7份响应`transport/07-response.bin`包含解释前缀、唯一完整JSON围栏及`report:null`。原解析只剥首尾围栏，先遇前缀而抛SyntaxError，被折叠为unavailable；即使移除前缀，原schema也拒绝null。现接受整体原始JSON或唯一完整反引号JSON围栏，仍以strict schema核process／next／其余字段；null仅代表本阶段无报告，空字符串、残缺或多候选仍拒绝，并以invalidRequest进入原等待，保存队列前不猜测修复。节点指导明确只返回JSON、无报告可省略或null。

另核实ref字段顺序导致`JSON.stringify`身份比较失败，将本图过程文件误纳入sources。现用标准深比较排除相同输出ref的所有版本，不放宽真正来源的basis校验；prepare与业务节点两处清理持久旧sources，prepare在原依据核查前完成并写回。只修原图状态，不换原任务／root或指令身份、不自动排除真正来源、不重放未知保存。具体节点约束见design的输出校验节。

首组回归成功路径1/1；两个拒绝用例先因fixture缺必需来源在Graph受理前失败，补实际合成来源后2/2通过。独立gpt-6.1-sol／high窄审又发现缩进／波浪线围栏漏计、prepare早于业务过滤的两项P2，修复后新歧义两例及真实checkpoint旧sources→重启→普通继续同run完成三例3/3通过。原审查与复核见`E/synthesis-output-independent-review.md`，首败及最新独立输出目录保留。最终整份`tests/kernel/project-literature-synthesis.spec.ts`一次**26/26通过，4.8分钟**；命令`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/project-literature-synthesis.spec.ts --output=E/synthesis-output-full-regression`（E替换为绝对路径）。包含旧真实长文／PDF／章节、来源等待、补充材料、预算、Task CAS、消费回执丢失、保存屏障和未知效果保护，不靠改期限或跳过原场景。kernel构建、tools noEmit、三文件Biome、architecture（14模块／280文件，0问题）及diff检查通过；首次测试metadata未收窄导致的tools类型错误与后续纯格式错误均已修正，未修改契约。内部kernel／broker／worker／SQLite／文件真实，模型HTTP合成，不是新科研验收。

6.3及6.4仍未完成。本次40请求／900秒授权的实际窗口已经结束，后续应按另行明确批准的接续计划使用原profile／task／run／checkpoint；不重提第一次tasks.runGraph、不覆盖原材料或手填报告。离线待授权入口为`E/synthesis-resume-prepared/runner.mjs`，其README披露剩余33次HTTP、累计3,704,660字节、单次256KiB／输出16384tokens、首新请求900秒，两阶段共用；新时间窗口须获同意后才执行。最终科研还须独立核新增Wilson2017是否真正改变或有据保留原判断，单凭完成终态不验收。

## 生产综合图与恢复接收（2026-10-30）

当前10/12，完成3.2、5.1、6.1及6.2；6.3真实科研及6.4最终交付仍开放。生产图6f821b9接为a67ccc2，任务导航f86b152接为a16d0e3；任务UI验收51b1a1f通过正常合并d0f2265保全来源。宿主／默认worker实际共用`scholoom.project-literature-synthesis@1`源码，复用共用consumer、真实有界工具、原保存／FileEdit与Task CAS；配置及实际独立保存节点见design，开发说明已删除生产目录为空的漂移。

独立来源审查发现准备阶段变基误入交付等待，主线按原Evidence保留具体错误，先读取并保留旧过程，再进入来源等待；明确排除后回prepare完成目标／快照／prior检查。SourceFailure的toolCallId只在真实工具错误时提供，不给准备检查伪造工具身份。其真实红例、修后保留旧过程与同run接续，以及原审查员1/1复跑见`sourcegraph-preflight-red.log`、`sourcegraph-first-repairs-green.log`和`sourcegraph-authorization-rereview.md`。

独立恢复审查先确证两项P2：consumer确认成功回执丢失被错误推进缺channels新根；实际保存成功而外层未落盘丢最新回执。前者未成功返回时保留原task／config；只有实际来源错误且原child完整channels可严格补确认后，才合回全部消息和指令进入来源等待。后者先持久角色候选、原before／创建operation和原回执，再跨sync屏障进独立save节点的effect task；回执已持久精确恢复，失落且原依据变化则unknown，不重写。原回执保留为历史，待保存角色不把旧receipt当当前成果。

SDK辅助SQLite探针确认`await task()`不能证明putWrites已落盘，故没有采用同节点intent task后直接写文件的方案；原探针在`/home/joshua/.cache/scholoom-langgraph-task-5AWIKY/`。独审随后发现明确拒绝后的普通续接会把原pending update换成create并丢候选，主线新增已知无效果错误的原意图续存分支；普通消息明确继续后仍核原before，期间人工变基则unknown。原创建部分回执也随失败保留，unknown创建只查询原operation；不再重新解析研究输出或重跑科研。累计三项恢复／保存P2和原来源P2均由原审查员关闭，报告`sourcegraph-recovery-rereview.md`与来源复核报告；限定范围无新增确证P1/P2，不泛化断电及完整队列故障矩阵。

所有下列新证据位于`/home/joshua/.cache/scholoom-closeout-execution-20261030/`，内部均真实KernelApplication／默认worker／broker／SQLite／文件，只有模型HTTP受控。20个不同内核代表的最近结果分次通过，不是一次20/20：原13项回归首轮12通过／1失败保留`sourcegraph-regression-final.log`；其来源错误／lost-ACK／排除接续最终3/3在`sourcegraph-source-context-final.log`。准备来源与原消费恢复等定向5/5在`sourcegraph-repairs-final.log`；最后未知创建、明确拒绝原候选重试／人工改动保护、cached exact／unknown回执共5/5在`sourcegraph-save-final.log`。新保存拒绝有效红2/2在`sourcegraph-save-rejection-red.log`。独立消费、两种保存窗口及拒绝续存探针另有真实原结果，最终拒绝两例独立复跑2/2；没有改写旧红例。

Browser＋真实Electron最终组合6/6（5.7分钟，`final-ui.log`／`final-ui/`）含两宿主综合各一例：真实任务入口选择图／来源，普通composer答同run真实问题、草稿保留、真实报告／过程打开，再同任务新会话补材料、实际工具读取新旧来源和旧成果、按原fileId更新及保留新旧快照／FileEdit／任务关系。另四例为普通委派打开／局部取消回归。作者此前两宿主正常综合2/2及SQLite／20个自有PID退出材料在`workers/research-task-workspace/ui-integration/RESULT.md`；首次无效夹具／断言失败及委派Browser五秒首败均保留。主线静态服务5727结束无监听，DISPLAY :99复用未停止。

主线kernel与desktop构建、tools noEmit、Biome及架构通过（280 files／0 findings），strict和diff通过；实际退出收据`closeout-final-exit-receipts.json`对应原命令。最后creation回执／拒绝分支经`sourcegraph-rejection-build.log`构建及保存五例复验；只影响失败窗口，不重复正常UI六例。原nonnull warning保留。首次测试把Descriptor与Evidence全等比较、准备输入误带Descriptor额外字段及临时union类型／格式错误均保留，修正后检查通过，不当产品红绿。

6.1产品尾项补验于`closure-ui2.log`／`closure-ui2/`，Browser＋真实Electron2/2（2.9分钟）exit0。测试夹具唯一新增开关taskSaveConflictOnce，在原项目port.save之前作一次真实人工tasks.save，再交原提供者自然CAS拒绝，不造错误结果／权限／文件。页面真实显示交付等待，已存报告可打开、草稿保持；普通composer明确补链后原run完成、模型次数不增、报告字节不变、过程保留原内容并记录决定、任务人工注记保留。后续原两轮综合及新旧快照核查完成，再在真实编辑器人工保存报告，核human FileEdit的原beforeEvidence和草稿／reload。第一轮两宿主因测试误在打开成果已自动收起overlay后再点“收起会话”耗尽原120秒，原trace保留`closure-ui/`；改为断言dock可见，未加timeout或改产品。原无开关model-kernel诊断1/1（37.1秒）及tools／Biome通过，真实owned close沿原机制保留。独立gpt-6.1-sol／high复核真实竞态、默认夹具路径及UI断言，限定无未解决P1/P2，报告`synthesis-product-tail-review.md`；退出收据`closeout-tail-exit-receipts.json`，没有重复运行或扩大UI矩阵。

6.3三篇不同DOI样本及执行前独立标准已备，真实首轮与补材料后第二轮尚未调用。离线入口`synthesis-live-prepared/runner.mjs`默认plan，经真实公共协议及纯预算自检，三份输入逐字节保持196399字节，guard核0网络／0启动／0凭据读取；没有做产品执行。拟两次Graph统一MiniMax-M2.7、合计40次HTTP／每次256KiB／累计4MiB、每次16384输出tokens、首请求900秒，无整项自动重试；仍需新的明确授权及执行前源码／构建核定。独立评价文件不进入模型项目，runner不写科学报告，离线准备不算科研通过，旧真实模型授权不复用。

通用HTML／JS报告仍由独立活动change承担，WorkerDOM输入反例待明确支持边界，不能把本图Markdown报告当通用交互报告交付。当前不归档；下文计数与“尚无生产图”等均为历史接收截点。

## 有效材料准入及任务导航接收（2026-10-30）

任务线f86b152接为a16d0e3：实际报告／过程导航沿原TaskRef、工作项和CAS合并，只按role／workItem／fileId匹配并更新basis，保原graph-call、其他链接、开放正文与任务状态。CAS／unknown当次保持失败或未知；明确再调用只读取并补关系，不重生成或重保存研究文件。作者真实worker五项5/5及窄边界1/1分次通过；主线核源码／原日志后实跑首次链接、同file更新及旧调用代表1/1（29.4秒）通过。初次主线grep未匹配而No tests found已保留，不计产品失败或通过。准确helper已用apply_patch送图线，cmp相同，没有覆盖其既有写集。

图线发现当前模型仍强制重核全部初始材料，导致明确排除未读失效来源也不能继续。主线增加源码节点materials可选范围，经原model.acquire、registered-only acquireModel和每次申请的AsyncLocalStorage贯穿原ModelAccess；未传仍查原材料，普通Agent不开放该范围。实际转交在prepared的类型及RemoteAgent装配均保留，排队前后及同步确认都核本次原范围；已读会话instructionEvidence、库read/send、目标项目和实例资格始终保留，不因缩范围清除旧正文授权。

新真实代表3/3（33.1秒）核原模式拒绝已删除输入、空scope排除未读来源、空scope不能外发已读后删除的正文；原工具小／大返回及root-ack恢复3/3（43.4秒）。最初trash漏operationId的调用错误、之后有效旧实现红例、第一轮漏转交acquireModel及类型Pick的失败均保留，不把准备错误当回归依据。最终相关shared／harness／kernel构建exit0；普通tools与WorkerDOM独立项目类型、Biome（原runtime六项warning未清理）和架构均exit0，最终整合日志为model-scope-tools-integrated.log、worker-dom-types-integrated.log及model-scope-architecture-final.log。旧types-final中的实验vendor／导航声明错误由后续独立项目配置和实际kernel构建解决，不改写旧日志。

独立gpt-6.1-sol／high对scope／真实ModelAccess队列绑定及导航复核，无确证P1/P2；独立9/9及真实ModelAccess空／非空并发排队、撤权、取消和名额回收断言通过。报告model-scope-navigation-review.md。此前prepareToolResult／content-ranges接缝独审14/14及普通Agent原读取已另通过。均只有受控外部HTTP，不是真实科研模型；题录和已读库撤权的全部组合、整worker取消及完整业务Graph用户选择不由这些局部验收覆盖。3.2与5.1需真实业务消费者后再判完成，当前仍6/12。

## 业务图接缝与第二波接口（2026-10-30）

主线在原2.1基础上增加源码本地prepareToolResult接点：原execution.custom已返回的字符串在进入SDK前交可信factory处理；普通Agent未配置该接点时保持原返回。新实际受控HTTP代表2/2核小结果原正文／basis不变，以及98KiB响应在SDK80,000字符转存前变成明确tooLarge，模型没有取得正文或临时路径。连同原pending-writes恢复代表最终3/3（38.9秒）；最初harness构建有unknown参数类型错误，使用已校验call中的args修正，最终构建exit0。早先2/2使用TypeScript错误时已发出的产物，不当完整构建证据；最终日志为tool-result-final-tests.log及source-graph-export-build.log。

科研描述新增可选delivery.inputReadMode:'content-ranges'，只供明确声明的新源码图。其实际非空正文范围与当前原basis可读性分开核，新增实际采用的来源也核原ref／basis；原图仍要求完整UTF8，报告／过程仍完整非空读回。有效范围由可信源码Graph维护，原始输入清单保存在原调用；正常题录条件、明确排除及其依据由真实过程承接，异常未获明确选择不能暗中排除。此时尚无生产图使用该模式，不以接缝存在勾5.1。

既有delivery单测扩展核片段、无正文／错版本、搜索不算正文及新增来源未核不可用，1/1通过；原真实角色保存2项和原项目／库读取、等待、普通消息、交付代表1项合计3/3（58.8秒）。共享构建、tools类型、Biome、架构exit0；原首败和最终日志在本轮cache的tool-result-*／content-range-*，均无真实科研模型调用。精确配置、任务导航函数与共享所有权已冻结在design新增实施接口节，独立审查和后续实际图验收另行接收，当前仍6/12。

## 共用Agent及精确恢复最终接收（2026-10-30）

主线接收813d87f为ce6bdda并完成2.1，当前6/12。ordinary与registered共用原宿主／worker DeepAgent、ModelAccess／预算、middleware、工具receipt与资源端口；可信source factory可选择原工具子集及节点指导，单活consumer沿原SDK task config恢复。新增namespace与累计cover仍是原consumption事务，旧根子集ACK不降级；未确认adopted先补严格ACK，成功pending-writes由SDK保留原task而不重跑保存。实际接口与作者各轮51个不同代表的最近结果、首败及exit130中止均见`workers/agent-delegation/RESULT.md`，不写成一次51项全绿。

两名gpt-6.1-sol/high分别独审持久消费和共用装配，发现两个P2，主线均先实跑红例再修复：新根已保存而ACK事务失败，旧child cover父根落后导致宿主永久拒绝恢复；测试factory初始化messages为空，首条已标consumed却未进入实际模型HTTP。前者仅允许核准完整当前根覆盖后恢复上下文，再由worker根confirmLatest补ACK，所有child当前父根检查保持；后者仅修实际factory seed原id/text的HumanMessage，原材料／context扩展沿既有middleware，没有更改普通Agent消费时机。

原首消息红例的HTTP messages确为空；新root-ack红例在重启后得到failed而非可补ACK的interrupted，原日志／trace保留。修复后四个真实窗口ack／pending-writes／lost-receipt／root-ack为4/4（1.3分钟），每份首HTTP核实际原要求，最终model2／宿主save1；另普通新尝试接续、实际框架压缩、累计超过100项及terminal无剩余节点确认4/4（1.2分钟）。主线受影响harness／kernel构建、tools类型、Biome及架构exit0；两名原审查员分别复核修复，无新增确证P1/P2。核查是内部真实KernelApplication／worker／SQLite，外部仅受控HTTP，未调用真实模型。

证据根为`/home/joshua/.cache/scholoom-closeout-execution-20261030/`：`agent-initial-red.log`、`agent-root-ack-red.log`、`agent-fixes-{build,green,regression,tools-types,biome,architecture}.log`及各自结果。先前主线原三个窗口3/3只是修复前接收输入，不覆盖新root-ack或初始正文。多consumer并行、嵌套压缩／offload恢复及断电未由本项声明支持；旧方法／普通Agent、3.2／5.1和真实多来源科研仍按后续任务推进。

真实科研样本已按design准备三篇不同DOI的PLOS正式作品：Sandve2013与Wilson2014用于首次，Wilson2017用于新会话补充；各有PDF／HTML、原文／许可及八项独立内容依据，见`research-inputs/SOURCE-MANIFEST.json`与RESULT。本次6次HTTP取得2,754,185字节，无重试；缺XML及旧Sandve HTML下载元数据明确保留，不把副本算新来源。未运行任何科研模型或评价系统报告，6.3保持开放。

## 会话等待／成果与首批整合（2026-10-30）

主线接收4b7f4db为8e8c323，完成4.2，当前5/12；2.1仍在原Agent树实施，3.2／5.1及最终科研路径未开始交付。当前run的实际Graph问题与角色成果沿原Dock／Overlay呈现，原composer及session.send回答同run；展示项不成为领域Message、Artifact或普通模型轮次。成果按原回执分别表达保存／关联未知，可打开当前资源，并明确未核与保存时basis一致，不补旧尝试历史。

作者投影3/3、Browser＋真实Electron最终2/2及类型／格式／构建／架构通过，首四轮UI失败是测试控件／虚拟DOM／重载tab／完成时机假设，未放宽生产等待，原trace保留于`workers/research-interaction/session-view-PbN2Hn/RESULT.md`及其证据目录。主线审阅实际投影、迟到快照保护及双形态接线后，重新构建共享／desktop，tools及desktop类型、架构exit0；主线投影3/3通过，未用叶组件替身当产品路径。

主线统一构建上运行真实Task题录选择与Graph session-view两条路径，两宿主4/4、2.0分钟通过，日志`integrated-ui.log`／`integrated-ui-results/`。内部实际库、broker、worker、SQLite、文件、普通composer及共同资源打开；仅外部模型边界配置受控HTTP，本校准图模型请求数0，不能算科研质量。Electron44.5.1的userData／sessionData／storagePath均在该例独立profile，主线查看实际Dock与深色Overlay截图；测试端口5727结束后无监听，复用既有DISPLAY :99未停止共享显示服务。

这不是最终6.1：所用仍是已有机械校准图，生产综合图、多来源取材／过程和新会话补材料待实现。Task作者报告的部分既有深色公共按钮对比度观察保留；本次没有做整台视觉可访问性审计。系统IME／读屏、通用HTML／JS执行及报告服务不随会话投影通过。后续计数为各接收截点，当前以本节及tasks为准。

## 题录任务来源与受理窗口修复（2026-10-30）

主线接收c1fb988为c7d97a8并完成3.1，当前4/12。TaskLink增加只带libraryId/sourceId的library-source，含题录的原输入快照使用v2并准确保存version/revision；纯材料仍v1。题录元数据不冒充正文或附件Evidence，真实后补附件仍归原source。宿主经原broker status/get读取，Task UI分页选择及详情有界，版本变化需重新明确选择；源码／作者首败／实际5项题录及4项双宿主结果在`workers/research-task-workspace/RESULT.md`。

独立审查发现P1：快照后的题录复核与真实科研最终受理间仍有异步窗口。主线新增真实KernelApplication／broker／TaskGraphs／research／harness回归，在原executions查询回执处仅控制时机：撤read和send时旧实现均实际受理；revision首轮误用测试字段expectedRevision而invalidRequest，修为原revision后亦实际受理，原首败分别保留`task-admission-red.log`与`task-admission-red-revision.log`。没有把测试调用错误计为业务红例。

修复沿design的私有题录指针与原graphAdmissions组合guard，在harness.send指令事务前同步重验原库身份、read/send及准确source版本／修订；不改公共wire，不伪造Evidence或提升身份。主线重建protocol／projects／kernel后，三类竞态及原Task准入保护4/4通过（24.6秒）；测试gate改用项目现有ES目标支持的Promise构造后，最终三类竞态3/3通过（16.6秒）。初次tools类型不支持Promise.withResolvers的失败保留，最终工具类型、Biome及架构均exit0。另在修复前主线原题录5/5通过，不能将它当P1已覆盖。

gpt-6.1-sol/high独立复核新四文件及最终事务调用链，无确证P1/P2，实际重验由主线执行；该复核没有重跑测试，历史幂等仅返回原受理结果，不新增请求。新输入和TMPDIR在`/home/joshua/.cache/scholoom-closeout-execution-20261030/`，无/tmp接续依赖；相关构建和测试日志均以task-admission命名。正式综合图、过程导航及科研内容验收保持未完成，不把v2数据结构存在当业务图已消费。

## 精确角色保存接收（2026-10-30）

主线接收4da53e为cfb37a7，完成4.1，当前3/12。原project.artifacts增加可选精确item选择器，直接查原run/file主键并核session，仍返回0/1个原Artifact；无选择器的原列表及其100项上限保持。真实科研查询保原身份，人工走research，execution复用现有harness语义适配；原活动实例、read/send、targetRead和报告历史联合来源授权不变。

roleResults交付分别核FileEdit的准确after Evidence及可信execution来源、原run/file持久关联、原basis完整非空读回；缺edit、wrong run、人工来源、旧before或关联未确认均不补绿，人工后改不抹掉已核历史保存，也不改读新版本。原creation路径保持。gpt-6.1-sol/high独立审查九文件及直接提供者无确证P1/P2，历史裁剪等部分组合仅静态核查的限度保留于作者RESULT末节。

作者真实新代表2项分次通过，旧creation／ordinary报告回归3/3、契约2/2，受影响构建／类型／格式／架构通过；主线共享整合构建exit0并实跑两项角色保存2/2（40.0秒）。主线日志为本轮根`merge-shared-build.log`及`role-save-main-tests.log`，作者原首败／命令／内部真实及替身边界在`workers/project-execution/RESULT.md`及其`task4.1-20261030/`。没有新科研模型请求，程序Linux签收已归其独立归档change，不混作综合图完成。下方计数及“只有共同字段”是此前接收截点，当前以本节及后续记录为准。

## 长UTF8范围交付（2026-10-30）

主线接收858c529为16857db，完成任务1.2；共同字段1.1与本项合计2/12，其他实施仍进行中。`ResourceAccess.read`沿原base64领域端口取得最多8MiB原始字节的同依据快照，严格UTF8解码后按原UTF16位置切片，返回真实size与nextOffset；不再把256KiB前缀当全文。非法／未闭合编码、NUL和超限明确拒绝，base64原字节语义保持，分片前后和返回前复核取消、身份、basis及read/send。

原10项基线通过；旧实现真实长尾2项失败，修复后原resource-access文件15/15通过；受影响editor构建／类型、tools类型、格式及架构exit0。gpt-6.1-sol/high独立只读审查精确提交及直接调用，核原红／绿日志，无确证P1/P2；主线整合editor构建exit0，原长尾定向2/2通过（19.2秒），日志为本轮根`editor-main-build.log`及`resource-main-tests.log`。证据为`/home/joshua/.cache/scholoom-closeout-execution-20261030/workers/literature-workbench/RESULT.md`及同目录原命令回执，未调用真实模型。

8MiB是源快照容量，不是总RSS或物理IO上限；分片、concat及解码字符串会同时占内存，每次范围请求重新核完整快照，没有正文缓存。原completeTextRead仍须没有nextOffset，不以本项宣称Graph已读完整长文。下面“只有共同字段”的描述保留此前截点，当前实际实施以本节及后续接收记录为准。

## 当前状态与成果

本change处于实施中。proposal／investigation／三份delta／design／tasks已齐备，`openspec instructions apply`为ready；不是业务或科研验收完成。实施按[设计图](design.md#变更总览)及[任务依赖](tasks.md)推进。

主线已落实最小共享线协议：原GraphProgress可携带有界contentReads及roleResults，保留旧字段／记录；消费确认增加可选checkpointNamespace（未提供为根）；registered初始化复用原Agent工具／middleware元数据schema。原执行行为和旧完整文本检查未改。字段能表达真实返回／保存依据，不证明实际消费、保存归属或生产恢复已核实；这些由后续真实消费者交付。

对应proposal判据1–5目前只有必要共同字段，尚无生产综合图、真实取材collector、任务题录快照或会话新投影；判据6的真实科研质量保持未验。原材料分析没有迁入或修改。1.1已以`a460832`提交并准确同步七树；七树独立protocol构建均已收取真实exit0，后续源码／产物一致性核对见本轮收口cache。只关闭该共同契约任务，其余任务未据此勾选。

## 实际验证

基线`f4c525a`，本机Linux／Node24.12.0，使用既有依赖。证据根`/home/joshua/.cache/scholoom-round27-acceptance-O1IWSr/next/synthesis-contract-acceptance`；新输入、TMPDIR与测试输出均在持久cache，不依赖/tmp。

| 操作 | 结果及边界 |
| --- | --- |
| `pnpm --filter @scholoom/protocol build`；`pnpm build:shared` | exit0；源代码与依赖消费者编译通过，不是全部产品验收 |
| `TMPDIR=<上述证据根> pnpm test:kernel tests/kernel/public-contract-baseline.spec.ts tests/kernel/graph-registration.spec.ts --output <证据根>/test-results` | exit0，8/8；原真实StateGraph／worker资源及创建代表、旧记录／契约边界和新增内容形式／角色保存／namespace结构通过。日志`tests.log`。没有实际新生产consumer或真实科研模型 |
| `pnpm exec tsc --noEmit -p tsconfig.tools.json` | exit0，日志`tools-typecheck.log` |
| 对三份协议源码及原契约测试运行`pnpm exec biome check` | 最初仅两文件格式不符，apply_patch修正后exit0；没有放宽规则 |
| `pnpm check:architecture`；`git diff --check` | exit0；14 modules／273 files／0 findings／0 exceptions |
| `openspec validate add-project-literature-synthesis --strict` | exit0，10项要求有效，不当实现证据 |

两个框架恢复探针的首败／真实SQLite／原task及零网络边界见[investigation](investigation.md#决定性接缝与当前选择)，不重复记为生产测试。主线另核有效A／B原result.json：model2／tool1、adoptB1，consumer进入分别3／1，networkAttempts均0；确认失败阶段及成功task skip保留各自原身份。

## 审查与问题处理

独立Codex／gpt-6.1-sol／high审查了设计／写集、三份delta、当前共同契约及必要旧消费者，确证P1／P2均无，未发现阻止1.1或五线派发的问题。报告`/home/joshua/.cache/scholoom-round27-acceptance-O1IWSr/next/synthesis-common-review/RESULT.md`。它另运行protocol noEmit及diff检查exit0；没有做整个change／生产安全实现审查。

审查核清TaskGraphs实际装配在manual.ts、科研启动适配在application.ts，已修正design文件归属。章节返回的length是章节总长，contentReads.length是实际返回字符数，映射应为length=text.length、size=原length；后续consumer不能直接抄字段名。当前namespace只是可选线协议，InstructionSaver及宿主仍需2.1实现；不据结构验证宣称子确认安全。

## 未完成事项与下一步

用户于2026-10-30授权执行Linux阶段最小收口计划，平台边界见proposal。共同契约的七树同步／构建已完成；收口工件提交后再次保全同步七树，再派1.2／2.1／3.1／4.1／4.2，实际Prompt和启动证据保存`/home/joshua/.cache/scholoom-closeout-execution-20261030`。五线分别独占长文本、Agent装配／恢复、题录快照、精确成果核查、当前会话投影；主线接收共享consumer及窄port后才派5.1。tasks是进度事实源，局部Agent不并写本交付记录或tasks，结果先回主线汇合。

真实Host权限／消费事务、取消unknown与Graph等待接续、长文尾段、角色保存、题录候选、业务图、新会话续做及双宿主整合尚未按本change验收；保留任务未完成。实际科研样本／内容评价须实现可操作后完成，新的付费模型授权尚未取得，旧runner及已消耗授权不复用。

已有HTML活动报告、WorkerDOM源码引入待许可、C／M服务／目标环境、Windows／macOS证据及CI保持原状态。没有安装、系统策略／服务、push或真实模型操作，也没有把本次共享字段改动宣称为这些工作的完成。
