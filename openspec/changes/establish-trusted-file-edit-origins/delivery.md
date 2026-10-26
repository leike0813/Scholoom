# 实际交付与交接

## 当前状态与成果

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

按[tasks](tasks.md)保留3.3：Agent所属真实逐推进指令／委派事实提供者尚未接入，阅读MaterialChangeView／I5尚无本轮真实消费证据。原快照资料已收到，信息阻塞解除不等于提供者装配。精确工具token、差异块撤销、永久审计与科研意见状态机不在本轮。当前粗粒度可证明来源不能称精确因果。

本轮M2补丁还需主线审查、dev接入与消费者同步；不在本树自行同步他树。Windows／macOS、完整CI、真实科研质量和跨域I5没有新增通过结论。任务侧I1交付另在原任务change记录，不以其注入科研端口替代真实科研worker。

## 收尾核对

实际资源保存／创建的editId及执行来源在原association失败的三种样本中核对，`/tmp/scholoom-round3-resource.log`为10/10。全部8份生成映射和格式化schema生成输出一致，`/tmp/scholoom-round3-contract-consistency.log`；最终tools／projects noEmit与增量Biome通过。M2与原任务change strict、scholoom-dev schema及diff空白检查均通过，不同步正式规格。

交接目录`/tmp/scholoom-research-task-round3/`的001为公共提供者，002为任务消费侧；任务专属来源转发随002保留，001新增核心不依赖私有任务实现。补丁文本基线为本树77cd078，裸dev接入仍由主线按符号组合及独立验证，不以本树通过代称dev通过。临时index／object存储按序应用核对可精确重建所有当前改动，实际索引及HEAD保持原状。完整依赖和公共符号见该目录README／manifest，本轮到此交回，不展开3.3。
