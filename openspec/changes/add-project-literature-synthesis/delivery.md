# 实际交付与交接

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
