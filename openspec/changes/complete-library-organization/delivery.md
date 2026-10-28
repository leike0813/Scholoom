# 实际交付与交接

## Windows备份副本新失败（2026-10-29）

完整Checks40745284164／head0b5c5e3的Windows job123017309438在`library-organization-rpc.spec.ts:355`发现恢复副本的附件状态由available变为changed／contentChanged。题录及阅读记录已读回，后续正文读取断言未执行。独立局部核查确认原库、备份及副本材料字节相同，恢复记录已重绑新文件指纹；尚无失败时实际stat，不能猜为复制后仍用旧inode或直接忽略状态差异。原材料及用户数据未改动。

证据、待证假设和原有privateDirectory窄取证见[公共平台回执](../add-project-program-runs/delivery.md#0b5c5e3完整checks回执及下一次窄取证2026-10-29)及cache的`windows-organization-restore-diagnosis.md`。3.2重开直到实际恢复状态与版本保护核清；原Linux通过及独审保留其范围，不因已有9/9记录宣称目标已完整通过，不归档本change。

## 主线接收与联合验证

2026-10-29主线接收十文件增量，四公共handler与主线报告授权改动按符号合并，未覆盖生态装配。独立审查核对真实CLI、领域事务、未知回执、备份恢复及双宿主草稿保护，未发现核心接线缺陷；报告为`/home/joshua/.cache/scholoom-finish-active/organization-independent-review.md`。工作线RPC1/1、领域19/19与双宿主2/2证据保留。主线先构建protocol／client／kernel，随后真实组织RPC、三项迁移及三项原值联合**7/7、47.1秒**，包括本轮新增加的恢复保护；命令／JSON／日志见同根`library-main-joint.{log,json}`及authority交付当前节。tools类型、architecture和生成声明比对通过，C1按其有界判据9/9完成，不将B平台或C2–I计作已交付。

## cb5f7ed：C1公共接线、真实恢复与工作台兼容性收尾

用户“完成现有change任务”的新授权取代此前只阶段收尾／不再派发的边界。本树开工HEAD为`cb5f7ed30f69b45301c83f296268578051b84e0b`且clean，没有应用旧累计patch；本轮补齐3.1／3.2／3.3及4.1／4.2的执行和必要验收，**C1有界任务9/9完成**，待主线统一整合验收。当前状态以tasks及本节为准，下方第十六轮和此前记录保留为历史证据，不再作为当前等待条件。

### 实际成果与完成判据

- `protocol/library.ts::librarySchemas`组合已有四叶声明，唯一生成器更新`business-types.ts`输入／输出映射；client与模块继续引用原schema，不维护第二套DTO。四方法同时接入`ManualApplication.foundationHandlers`，保留所有原handler／构造参数／恢复与根工具。Agent调用以可信principal核执行context，取消在进入领域前检查，领域持续核read／write及当前库身份；没有新增root工具或扩展send授权。
- 新`tests/kernel/library-organization-rpc.spec.ts`通过真实普通CLI运行锁、KernelClient、WS/RPC、broker及library：准备两个题录／集合、开放未知CSL、独立原值／固定键、实际托管附件及阅读记录，原子组织、差异分页、undo／redo均经公共端口。对应proposal判据1–3，实际diff四个成员由独立输入明确核对。
- 传输代理仅丢送达／回执。已提交丢回执返回outcomeUnknown后，用原请求ID在真实stop/start后的新进程查得committed，原条目修订未重复增加；未送达请求持续notFound且没有重放。已核终态后另明确测试同ID重复提交只返原结果、不使undo变成redo；不把这个已知终态验证称为unknown自动重试。
- 真正调用`library.backup/restore`后从独立恢复配置启动第三个CLI进程：new libraryId、read=true／write=false／send=false，原组织记录可审计；重授write后仍拒绝旧origin撤销。旧材料／版本／阅读记录／原值／固定键／authority回执保持，恢复附件实际字节可读。副本明确新请求独立成功，原库后续更正保持。对应proposal判据4，不使用修改meta身份的夹具代替恢复。
- 原`library.spec.ts`单一场景扩展真实`library.organize`，双宿主核选择／主选／完整dirty CSL、跨窗口刷新、旧revision保存冲突、迟到失败归原对象及显式保留／丢弃重读。没有新GUI结构、第二草稿、保存台账、跨DOM读取或批量界面；UI设计和语义token无变化。对应3.3兼容性，不冒充C2组织GUI。

独立只读审查核对了契约、四handler、生成映射、恢复来源、unknown及实际测试结果，无确证实施缺陷；建议补核差异页实际内容已落实。真实公共提供者及必要本机证据满足本change的有界完成判据5。完整C后续附件／关系、B的平台／独审余项、生态原包持久配置及科研质量仍不在本轮关闭范围。

### 命令、首次失败及最终结果

本节`R=/home/joshua/.cache/scholoom-finish-active/literature-workbench`；所有操作先`export TMPDIR="$R/tmp"`，Node24及已有依赖。生产修改后先最小构建protocol／client／kernel／desktop，再冻结同树产物运行测试，未边测边构建，没有运行pnpm、安装依赖或开发服务器。

| 实际入口 | 结果与证据 |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p packages/protocol/tsconfig.json`；同入口`-p packages/client/tsconfig.json`／`-p apps/kernel/tsconfig.json`；desktop目录`node ../../node_modules/electron-vite/bin/electron-vite.js build` | 均通过，`build-{protocol,client,kernel,desktop}.log`。仅更新受影响编译产物；复用共同已验library及其余共享包，没有冒称全量重建。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/library-organization-rpc.spec.ts --output "$R/rpc-red" --reporter=list` | 初始RED：共同已验旧产物尚未注册四个capability，原assert失败，11.7秒；`rpc-red.log`及trace。自有CLI正常停止，不把它当既有提供者回归。 |
| 同RPC命令，`--output "$R/rpc-green"` | 首次接线实跑35.8秒后在末尾历史整对象断言失败。`get`含当前attachmentState投影，history保留历史题录值，不能拿当前附件投影作历史oracle；保留版本／完整metadata／组织字段断言和附件身份／实际字节检查，未改生产代码。`rpc-green.log`及trace保留。 |
| 同RPC命令，`--output "$R/rpc-final"` | **1/1，41.6秒**，实际场景36.2秒；`rpc-final.log`。真实CLI三次启动及停止、丢回执／未送达、差异、undo／redo、备份恢复、副本授权／origin、原库后续成果及原authority均核对。无sleep、重试或放宽原60秒预算。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{library-organization,library-organization-contract,library-record-migration,library-records}.spec.ts --output "$R/kernel-regression" --reporter=list` | **19/19，14.6秒**，`kernel-regression.log`。公共聚合后的原子失败、长旧值预算、namespace、迁移、并发代次、修订上限及旧authority回归；没有写主线拥有的authority测试文件。 |
| `node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs "$R/ui-base.config.mts"`；`xdpyinfo -display :99`；`DISPLAY=:99 SCHOOLOOM_UI_PORT=6011 SCHOOLOOM_UI_DATA_DIR="$R/ui-profile" node node_modules/@playwright/test/cli.js test --config "$R/ui.config.mts" tests/ui/library.spec.ts --grep 'library object drafts and selection survive organization'` | 显示预检通过；静态已构建产品双宿主**首次2/2，1.1分钟**，Browser19.6秒、Electron25.3秒；`display-ui.log`、`ui-first.log`、`ui.json`、`ui-results/`。wrapper仅迁结果到cache，没有替换内部权威。原90秒场景预算及冲突／草稿保护保持。 |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`；Biome check受影响5个TS文件；`node scripts/check-architecture.ts` | 均通过，`tools-types-final.log`、`biome-final.log`、`architecture.log`，14模块／257文件、0 findings／exceptions。初次lint仅发现新测试空解构及排版，按既有工具修正，原`biome.log`保留；内置apply_patch应用所有既有文件修改。 |
| 同源生成器`--self-test`／`--patch`只写cache，`node "$R/check-contracts.mjs"` | 八份生成声明核对通过；四公共方法存在，root工具名单未增加。`contracts-check.log`，既有纯格式提案未应用；business增量由最终schema生成，未整文件覆盖公共映射。 |
| 当前delivery/apply instructions、OpenSpec strict／scholoom-dev schema、diff及独立增量核查 | 结果保存在同根`delivery-instructions-final.json`、`apply-final.json`、`openspec-strict.log`、`openspec-schema.log`、`diff-check.log`及`patch-check.json`；任务完成仍以实际结果而非CLI状态为准。 |

### 真实／替身边界与交回

内部CLI生命周期／运行锁、客户端、RPC、broker、领域、SQLite和材料文件全部真实；没有模型参与、付费模型调用、库／工具结果／UI状态替身。外部受控部分仅为新测试局部WS代理的送达／回执丢失及原UI传输门的受理时序，失败仍来自真实领域CAS；没有新launcher或另一server/provider。辅助保持原生gpt-6.1-sol/high、fork_context:false，只写指定UI场景后只读核代码／结果，父负责实际运行和最终判断。

可重建入口为`bash "$R/reproduce.sh"`，报告及独立补丁为`$R/report.md`／`$R/library-organization-complete.patch`；依赖共同cb5f7ed，与先前累计patch无关。公共聚合／business映射及manual四handler应一起接入；文献所有权仅这些符号，未碰主线报告历史及生态构造／initialize／zoteroRuntime。新schema、库provider及v5迁移来自共同基线，不重复搬迁。

`owned-status.json`确认本轮RED／首绿／最终RPC的原库／副本及UI配置全部stopped，6011无监听；登记项目、配置、profile及结果留在cache，不删除目录留下登记，不停止共享:99。必需脚本、独立输入和结果在Git／cache，无现有/tmp内容前置。辅助和本轮自有执行已结束；不提交／同步／推送／PR／归档，到C1边界停止等待主线整合验收。未新增Windows／macOS、完整分发、C2–I或科研质量结论。

## 第十六轮主线接收

六树增量已冻结保全、检查点提交并合入dev；Standards／Spec两轴独立审查均0确证发现。共同产物完成完整构建、全包／tools类型、架构14模块／257文件0 findings／exceptions、八份生成映射及14个受影响文件Biome。组织／契约／迁移／原authority19/19、旧集合及早期库迁移3/3在主线再次通过，分别纳入44/44与18/18两个组合。原命令、冻结对象及结果在`/home/joshua/.cache/scholoom-round16-integration/`，接续无需现有`/tmp`。

接收范围保持1.1／1.2／2.1／2.2，4/9；没有公共handler／client、真实进程恢复或组织UI，不归档本change。下次先完成3.1公共同源接线，再验证3.2真实恢复及3.3已有工作台接入；本轮只记录顺序，不派发新任务。不得重复应用本树累计patch或以本次其他UI通过填补组织UI缺证。

## 当前状态与成果

基于共同HEAD `7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c` 开工，工作区clean；429后的续接核查未发现此前遗留实施改动，没有重放旧补丁。本轮按第十五轮授权完成1.1／1.2／2.1／2.2，**4/9**。这是可直接独立测试的真实library组织提供者；[design总览](design.md#变更总览)中的公共客户端／宿主节点及UI尚未接入，不以叶schema或CLI ready宣称C1全路径／完整C完成。

| 完成项／文件与符号 | 实际结果及proposal对应边界 |
| --- | --- |
| `protocol/library-organization.ts`、`library.ts`具名导出 | 四叶DTO、派生类型和同源验证器，字段省略／清空、唯一source、safe-integer、100项、精确字符串、逐项结果联合及代次分页。没有加入公共libraryOperations／businessSchemas、handler或root工具；生成映射无语义变化。 |
| `library/record-receipts.ts`、`schema.ts::recordOperations/organizationEdits`、`migrations/0004_organization.sql`及journal | 唯一record_operations追加kind，旧行默认authority且旧JSON不重写；旧commitRecords／commitResult复用同一回执模块，跨kind请求拒绝。library版本4→5，迁移前保留before-migration-v4.sqlite；不从旧history猜造组织记录。组织表只存依据／代次，未另存操作结果。 |
| `library/organization.ts::OrganizationEditor`、`catalog.ts`四个窄方法及源校验／历史接线 | 真实SQLite事务内预检全组并提交集合／标签、完整历史、唯一回执和组织依据。末项过期整组rejected，已确认的预检拒绝只提交诊断记录；写入异常整体回滚并抛错，不伪造最终结果。无变化／纯重排保留条目及其修订，未知CSL、原值、来源、固定键、附件、阅读记录保持。 |
| `result/edit/revert`、独立领域测试 | 查询持续核read及当前库，写入／重放持续核read＋write；未知notFound不重放。差异页有界且绑定代次；undo／redo检查整条source修订、当前head及方向，只反向恢复组织字段。后续更正即使改回原值仍阻止撤销；重复原提交不变成redo。safe-integer下一值超限拒绝，后续成果和head保持。 |

实际提供者可经`LiteratureCatalog.organize/organizationResult/organizationEdit/revertOrganization`调用，类型及输入输出来自protocol叶声明。与proposal判据1–3对应的领域行为已实跑；判据4的v4升级与副本origin拒绝仅在领域及数据库夹具层证明。真实公共客户端、丢回执跨进程、生产restore全路径及双宿主仍属3.1–3.3，不把合成副本身份夹具称为完整恢复验收。

## 实际验证

证据根 `R=/home/joshua/.cache/scholoom-literature-r15-YBpl8rn9`，所有命令先`export TMPDIR="$R/tmp"`并在本树cwd运行。Node24及已有依赖，未安装／下载。测试样本、SQL故障和配置均隔离，结果在cache；没有GUI、显示服务或开发服务器。修改生产后先构建protocol／library，再冻结产物运行测试；未重建无关desktop／host或重跑B／BBT整组。

| 命令／操作 | 首次及最终结果／证据 |
| --- | --- |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/library-organization.spec.ts --output "$R/red-atomic" --reporter=list` | 初始代表RED：`catalog.organize is not a function`，`red-atomic.log`及trace。没有把尚无提供者的失败写成已有产品回归。 |
| `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/protocol build`；同命令`--filter @scholoom/library build` | protocol通过。library首次暴露泛型schema派生过深及rejected结果数组联合类型错误；用实际所需的窄输入类型和按state提取的结果类型修正，第三次构建通过。原始`build-library-first.log`／`second.log`及`third.log`保留；后续修复后的构建在`build-library-verified.log`通过。 |
| 组织／契约／迁移三文件，随后加旧`library-records.spec.ts` | 中途14/14、扩展18/18，`green-first.log`／`green-expanded.log`。这些不是最终新增通过数量，当前结论以下一行最终组为准。 |
| 同playwright命令，文件为`tests/kernel/{library-organization,library-organization-contract,library-record-migration,library-records}.spec.ts`，`--output "$R/kernel-final" --reporter=list` | **19/19，12.4秒**，`kernel-final.log`。覆盖原子拒绝／真实SQL写故障回滚、100项、旧值预算超限、no-op、undo／redo及同代次竞争、后续整条修订保护、撤权／错库、未知查询、namespace、v3／v4及未来版本、真实附件／阅读／原值／键保持和原authority注册路径回归。 |
| 同playwright命令，`tests/kernel/{literature-catalog,literature-reading,literature-attachments}.spec.ts --grep 'collections, tags and optimistic\|v1 migration\|v2 migration' --output "$R/legacy-final" --reporter=list` | **3/3，6.8秒**，`legacy-final.log`；只核受源校验提取／版本5影响的旧集合与早期迁移，不重跑完整B。 |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 首次新增迁移测试的可变catalog被闭包捕获，三处可能undefined；用已建立的稳定实例别名修正后通过，`tools-types-first.log`／`second.log`／`final.log`保留。构建同时完成protocol／library类型检查。 |
| `node scripts/check-architecture.ts` | 初次发现schema对organization的类型反向导入形成环；持久类型归schema后**14模块／257文件、0 findings／0 exceptions**，`architecture.log`／`architecture-final.log`。未放宽守卫或新增例外。 |
| `node packages/protocol/scripts/contract-types.mjs --self-test`；`--patch`只输出cache；`node "$R/verify-generated.mjs"` | 通过。脚本将生成值格式化后与当前映射核对，生成器八份声明无语义变化；7份既有纯格式提案未应用。四新叶明确不在公共library／business注册，`contracts-*`及`generated-check.log`；脚本是只读核查，不生成第二套契约。 |
| Biome检查受影响9个TS文件；OpenSpec strict／schema及diff检查 | Biome先发现格式／非空断言，已用内置apply_patch应用格式化输出及消除无必要索引断言；后续类型导入排序按检查调整。最终日志见同根`biome-closeout.log`、`openspec-strict.log`、`openspec-schema.log`、`diff-check.log`，不将格式失败当产品失败。 |

## 审查与问题处理

原生辅助保持`gpt-6.1-sol/high`、fork_context:false，只拥有协议叶及其契约测试的辅助写集，父负责迁移／原子行为与最终判断。辅助完成后切换为只读审查：原子提交／namespace旧DTO／权限／unknown／副本来源／字节预算未发现其他确证问题，发现undo直接加一可越过安全整数上限的P2。

父新增独立有效持久输入：source.revision为MAX_SAFE_INTEGER−1，组织提交到上限后undo应拒绝。原实现实际committed，**RED1失败**见`red-overflow.log`；不是由新递增函数生成预期。现预检及实际写入都检查source与editRevision下一值，拒绝不改变源、历史或head；最终19项含该GREEN，辅助窄复核确认P2闭合。没有改生产期限、容量或加sleep／重试。

真实接线为protocol验证→LiteratureCatalog→OrganizationEditor／共同RecordReceipts→真实Drizzle／SQLite／文件。旧authority额外回归仍走原ManualApplication注册；新组织没有handler。模型未参与，无工具结果／UI状态或仓储替身。SQL trigger仅注入真实事务写入故障；v4夹具使用独立旧四份迁移和固定旧source／原值／键／回执，确认备份及旧JSON逐字节保持。副本测试是SQLite backup后可信夹具显式赋新identity，证明origin不重绑定；没有冒充生产restore或真实进程重启。两个同代次调用是同一真实领域提供者的竞争请求，非跨进程压力测试。

## 未完成事项与下一步

进度沿[tasks](tasks.md)，3.1／3.2／3.3及4.1／4.2保持未完成；当前仅中途delivery，不关闭整体交付记录任务。下一片需主线授权后注册四handler及公共同源映射，随后真实客户端、进程未知核查／恢复、现有UI草稿兼容性验收。后续附件／阅读／用途／名称／ResourceRef方向只作规格前置，不在本轮夹带模型／迁移；B平台、完整C、跨平台分发及科研质量仍开放，没有新CI或Mac／Windows通过结论。

交回`$R/library-organization-provider.patch`，依赖共同7aff2c7，单一有界增量；叶契约→共同ledger／迁移→领域提供者应一起审查，不套旧累计patch。可重建入口为`bash "$R/reproduce.sh"`，补丁及写集核查入口为`node "$R/create-provider-patch.mjs"`；`verification-summary.json`列15文件、进度和实际结果。必要核查脚本、原RED／build失败／修正及最终结果均在Git或此cache根，不依赖当前/tmp。没有新增宿主／server／UI进程；测试自己的catalog／worker均按既有夹具关闭，不清理他人目录或共享显示。未提交／同步／推送／PR／归档；到本片边界停止。
