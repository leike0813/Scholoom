# 实际交付与交接

## 第27轮：现态纠偏与正式规格同步

主线已接收图线`c41eff2`的现态文字修正（主线`fe7bb72`及祖先桥`3246653`）：默认broker→harness.executionFacts及实际父子来源已接通，精确逐工具因果／理由仍未知；没有重写历史结果或新增生产功能。原逐项证据及关联失败三分支、旧协议结果的补核见本轮根`next/research-graph-runtime/RESULT.md`，保留其版本与真实／替身范围，不将旧CI总体failure改为通过。

本change的project-files四条及workbench-resources一条要求已逐字同步正式规格，既有正文及Purpose保持；当前样式没有将editId、文件basis、创建回执或association合并。`core-spec-sync-check.json`核本次三change共21条完整、唯一，四份目标规格分别strict通过，原输出为`core-formal-<capability>.log`。未取得直接结果的不同查询者等组合继续由原独审／补核记录限定，不以规格同步补造实跑、精确工具事实或三平台结论；未归档。

## 2026-10-29 主线接收补充

可信来源提供者及本批 3.3 真实消费者已进入主线共同源码。本次重新取得本 change 的 delivery instructions，核对主线已有证据后补充接收记录；原提供者与消费者交付历史保持原样，最终验收与提交由父 Agent 负责。

证据根为 `/home/joshua/.cache/scholoom-finish-active/`。`main-final-kernel.json`／`.log` 的跨域联合组为 118/118，其中 `file-edit-origins.spec.ts` 10 项全部通过，覆盖可信来源核查、取消／撤权、历史窗口、重命名与身份保护、登记失败及真实 worker 后续查询。`main-final-ui.json`／`.log` 为 Browser、Electron 各 5 项、合计 10/10；两宿主的 `material-delegation-history` 均通过真实子创建→父读改→人工重叠拒绝旧撤销→撤销人工整次修改→原会话新 run 工具读回。两组均 0 skipped／unexpected／flaky、retries=0，统计与 `main-joint-stats.json` 一致；118／10 是联合总数，不全归本 change。

`material-independent-review.md` 对本批材料／来源增量无 P0–P3 确证发现，并核对既有双宿主持久结果及后续真实工具回执。共同 desktop 构建、lint 与架构证据统一见[材料 change 主线接收补充](../add-material-annotation-interactions/delivery.md#2026-10-29-主线接收补充)：lint 无 error、既有 114 warnings／39 infos；架构 14 模块、263 文件、0 findings。审查本身只读，本次整理未重跑测试或构建。

接收范围仍为可信粗粒度来源、有界查询、整次 FileEdit 撤销及真实消费者；内部 broker／worker／仓储真实，外部模型响应受控。精确指令／工具因果、科研理由、差异块撤销、科研质量及三平台验收没有扩大。历史首 run 准入失败与 TeX unknown 保留原责任和证据，后续通过不解释其根因；任务勾选仍以 [tasks](tasks.md) 为准。

## 当前状态与成果

本次从共同cb5f7ed继续，3.3真实提供者／消费者已具备并通过本树实际组合：真实子worker→文件→父实际读改→MaterialChangeView→人工重叠拒绝→整次undo→原会话新run经get_file_changes/read_file_edit/read_file核查当前正文及真实撤销。只有外部HTTP模型受控，不注入假委派来源，不扩精确指令／工具token。当前实证、失败与可重建入口见末节；以下2026-10-26记录为原提供者交付历史。

2026-10-26本轮交付M2提供者局部闭环，保持活动，不归档。用户已确认D1粗粒度可信来源、D2整次FileEdit撤销、D3有界changes／edit与明确editId；精确工具token后续。恢复HEAD为`77cd078a12d7d10e5007ccc32ffc89110d954f39`，git确认`0519904`及`b838402`为祖先；公共恢复验收见`/tmp/scholoom-sync-recovery-wyn13R/recovery.md`。本轮没有同步、reset／rebase／切分支、安装或真实库写入。

沿[design](design.md)变更图，`project-file-contracts.ts`为唯一schema；FileEdit记录可信origin、实际before／after Evidence及revertsEditId。宿主绑定真实principal与活动执行project/session/run/instance，普通保存参数拒绝自报。可选可信`fileExecutionFacts`必须匹配四元组，保留真实集合／经核实委派事实；本树没有Agent私有实际提供者，默认指令及工具unknown，不补造委派。

来源在原保存受理时固定，和所属正文历史同事务。创建prepare／inspect保留原edit及原来源，查收据不重新署名。创建撤销将新历史和缺失身份同事务；文件已发布或移至原撤销保留区后登记失败仍outcomeUnknown。原创建／保存／成果association和任务links各自核查，不引入审计正文表或普通保存状态机。

`files.changes`按稳定fileId返回有界摘要；cursor绑定项目／文件、原锚点及其状态、首屏最低／最高记录和续页位置，不能另传顶层锚点。开窗已missing可读取固定范围；原锚点或窗口最低行后续裁剪则失效。coverage分别说明锚点、裁剪和当前未登记变化；`files.edit`读取明确一条。执行资源保存及完整创建在实际可核查时提供可选editId，descriptor不变。根Agent新增只读工具`get_file_changes/read_file_edit`；子实例入口保守拒绝任意历史，不自动唤醒会话。

整次undo核对稳定身份、完整after及原byteBasis，再取得当前强依据保护发布，正常单文件内部重命名不会因ctime变化误拒绝。新undo有自己的origin和revertsEditId，原编辑不改写。恢复副本的历史Evidence及origin保留源项目ID，只是源项目历史依据，不是副本当前能力或执行资格。

公共到达点：protocol的project-file-contracts／projects／project-contracts／resource-contracts和生成映射；projects的store／creations／tasks／node；kernel的manual／application；harness的runtime／file-change-tools；architecture明确provides／consumes及相关测试夹具。资源错误schema抽为`error-contracts.ts`并由core原入口重导出；资源叶及Graph声明沿同一叶依赖，消除新增循环，不复制ResourceRef或错误schema。共享执行历史、Graph来源、v6迁移、双窗口fixture和图片枚举均保留。

## 实际验证

Linux，Node24.12.0，pnpm11.10.0；使用已有依赖、隔离项目／库／profile和受控HTTP模型。先构建再测，测试期间不重建共享产物。

| 命令／范围 | 实际结果与边界 |
| --- | --- |
| `pnpm build:shared`及`pnpm build` | 最终通过，`/tmp/scholoom-round3-build3.log`、`/tmp/scholoom-round3-build-final.log`；包含共享、kernel、desktop及宿主产物 |
| `pnpm -r typecheck`及`pnpm exec tsc --noEmit -p tsconfig.tools.json` | 通过，`/tmp/scholoom-round3-packages-type.log`、`/tmp/scholoom-round3-tools5.log`；后续新测试的最终检查随收尾证据更新 |
| Playwright kernel：file-change-contracts、file-edit-origins | 首次旧产物明确缺editId的red见`/tmp/scholoom-m2-first-red.log`；首轮新行为9/9见`/tmp/scholoom-m2-green-attempt1.log` |
| Playwright kernel：上述两组＋task-graph-orchestration、resource-creation、resource-identity、project-files、execution-history、harness-module | 最终53/53，38.6秒，`/tmp/scholoom-round3-kernel2.log`及同名结果目录。真实worker写入来源、下一条指令查人工更改；绑定seam的多指令／委派是明确夹具，不当真实Agent委派整合 |
| `node scripts/check-architecture.ts` | 13模块、209文件、0 findings，`/tmp/scholoom-round3-architecture-final.log` |
| Biome changed TS／JSON | 当前33份通过；最终新增测试的收尾检查另记。协议生成器self-test通过；最终格式化映射一致性、OpenSpec strict与diff见本轮收尾记录 |

原扩大回归为46通过／2失败，保留`/tmp/scholoom-round3-kernel1.log`。隔离复现证明旧迁移夹具只把v6库版本降成v1／v3却留下新版delegations／program_runs表，实际错误为`table delegations already exists`。只修正夹具旧版形状，未更改v5→v6迁移或延长时限；最终53/53包含原失败两例。

首次构建失败完整保留`/tmp/scholoom-m2-build-first.log`至后续同前缀日志：新增窄端口的旧fixture未实现、普通类型问题及schema交叉类型导致broker拒绝。最终按最终schema键消除重复交叉，保留双向broker守卫，没有cast绕过。架构首次两条循环见`/tmp/scholoom-round3-architecture1.log`，改为真实叶依赖后0 findings。

## 审查与问题处理

独立只读审查直接核对delta、实际源码、调用链和首次9/9证据，找出三个P2边界：重命名后ctime误阻undo；无锚窗口尾部裁剪静默漏页；已missing锚点产生不可用续页。分别按上述byteBasis／当前强条件和完整窗口／锚点状态修正；对应稳定行为回归均包含在最终53例。复核确认三项闭合，无新增确证缺陷；独立审查本身未运行测试，实跑由主Agent核对。测试不精确断言大段文案或内部调用顺序。

## 未完成事项与下一步

3.3的实际提供者及MaterialChangeView消费现已接入并验证，任务依据见末节。精确工具token、差异块撤销、永久审计与科研意见状态机仍在本批范围外；当前粗粒度来源不能称精确因果。

原M2提供者已进入共同源码；本次真实消费者测试及工件增量交主线最终审查和整合，不在本树自行同步他树。本次材料I5的双宿主机械验证见材料change交付，不代表Windows／macOS、完整CI或真实科研质量通过。任务侧I1交付另在原任务change记录，不以其注入科研端口替代真实科研worker。

## 收尾核对

实际资源保存／创建的editId及执行来源在原association失败的三种样本中核对，`/tmp/scholoom-round3-resource.log`为10/10。全部8份生成映射和格式化schema生成输出一致，`/tmp/scholoom-round3-contract-consistency.log`；最终tools／projects noEmit与增量Biome通过。M2与原任务change strict、scholoom-dev schema及diff空白检查均通过，不同步正式规格。

交接目录`/tmp/scholoom-research-task-round3/`的001为公共提供者，002为任务消费侧；任务专属来源转发随002保留，001新增核心不依赖私有任务实现。补丁文本基线为本树77cd078，裸dev接入仍由主线按符号组合及独立验证，不以本树通过代称dev通过。临时index／object存储按序应用核对可精确重建所有当前改动，实际索引及HEAD保持原状。完整依赖和公共符号见该目录README／manifest，本轮到此交回，不展开3.3。

## 本次3.3真实消费交付

已读取当前apply及实际执行后的delivery instructions，当前HEAD为cb5f7ed，原提供者没有重做。消费者使用正式executionFacts／FileEdit、真实broker／受管worker／项目仓储；材料history组件只作补充接口验证，不冒充真实执行。实际父子实例、委派链、同fileId的父beforeEvidence=子afterEvidence、真实human origin及revertsEditId均有结构断言；原会话新指令的工具输出及磁盘字节核对证明实际消费，不从通知或模型说明推断。

证据根为 `/home/joshua/.cache/scholoom-finish-active/research-graph-runtime/`。execution-facts＋material-history为7/7，其中6项是组件端口测试；原双宿主基线4/4。新增组合首次11通过／5失败，另一轮11通过／1失败分别记录，不能合并为一次全绿；修正组合的material-delegation-history两宿主均通过新链，输出保存scope、delegation、FileEdit/Evidence、human／undo及followUp真实工具消息。readonly-kernel3/3、identity-partial-kernel9/9补充所属身份、权限与部分保存。精确命令与其他材料I5结果统一引用[材料change本次delivery](../add-material-annotation-interactions/delivery.md#本次实际结果修正与交接)，避免另存重复账本。

独立只读审查已核真实来源／undo与工具回读，未发现伪造委派或旧工具历史蒙混通过；发现的M1夹具P2已按真实权限修正。相关desktop／tools类型、架构、schema生成器self-test与Biome通过；来源schema、提供者、FileEdit／保存／undo权威未改。UIReader的唯一生产局部及其构建另归材料change，不把它当来源提供者改动。

一次Electron首run queued在schedule.admission等待，未进入本域消费；project/session/run、原始附件及modelRequests=null的缺证边界已交主线，后续通过不关闭该公共失败。首次Electron包入口隐式调用install.js及后续显式绑定现存binary的情况也如实记材料delivery，不称本轮从未进入安装。所有当前输入／结果／补丁在Git或本轮cache，无当前/tmp前置；未提交、推送、同步他树或归档，完整平台与科研质量仍未验收。
