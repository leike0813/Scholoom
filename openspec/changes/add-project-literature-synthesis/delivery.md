# 实际交付与交接

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
