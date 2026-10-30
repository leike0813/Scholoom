# 实际交付与交接

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
