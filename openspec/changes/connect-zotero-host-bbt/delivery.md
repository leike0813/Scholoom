# 实际交付与交接

## 当前交付：E4断联写入夹具送达边界（R9）

基线及当前HEAD为`0b788151b5e17665a26d9286dfd1d12f6e2e0c30`，开始时clean。本轮按“第八轮验收后的收敛安排”只处理Windows host-connection:159的取证与夹具因果；原R8已接收，GUI由文献消费。R9三项完成后累计24/33，其余原任务及跨平台／生产／整体I6保持开放。本节替代旧轮的当前状态，不应用历史累计patch或修改已接收原值API。

### 原始失败与校准结论

已只读核对本仓Checks `40447074031`／b2f3b50，Windows job `122000779926`，artifact `12710309824`。证据在`/tmp/scholoom-zotero-r9-ci-jLNM0gAs/`；目标trace为`baseline/kernel/host-connection-transport--4a66c-ion-or-replay-it-on-restart/trace.zip`，提取事件、原job日志及evidence-manifest.json同目录。trace只记录unresolved轮询通过及写请求拒绝码unavailable，缺host.invoke派发／宿主接收、落盘及原错误消息事件，不能把它写成Windows已派发写入被错误分类的证明。

源码核对`HostConnection.call`与`RpcPeer.request/close`：未决身份先同步入内存，写请求等待save后才request；drop为读，不等待该保存。RpcPeer已关闭时拒绝新请求为unavailable；待决写请求的lossCode才是outcomeUnknown。因此原测试的内存轮询不证明写请求已发出。保守未决身份仍须保留，不能因错误码unavailable就自动重放或清除监督记录。

Linux既有真实固定host校准保存在`/tmp/scholoom-zotero-r9-calibration/before-dispatch.mjs`及`.log`：仅对该实例save增加一次诊断调度gate，在实际保存／request前停住；旧轮询条件已满足，此时先drop，放行save后得到`unavailable / RPC连接已关闭`。随后实际scopeStopped=true、pluginClosed=false、unknown及原稳定关联保留。内部WS、ManagedCommands、原生归属、RPC和磁盘写入真实；该gate不是Windows时序测量或正式回归，也没有新增生产钩子。它证明原断言允许一个未派发顺序；原Windows trace缺失的顺序仍不能反推。临时脚本生成器首次因未导入join失败，未启动宿主；改由内置工具落稿后实验一次通过，未删除临时目录。

### 实际修正与范围

- `tests/fixtures/zotero-host/fixed-host.mjs`：既有wait在进入invoke后先await已有sample.read回调，再保持不完成；不增加公共方法、假结果或睡眠。
- `tests/kernel/host-connection.spec.ts`原失联用例：先断言未ready调用为unavailable且unresolved为空，再用相同稳定身份开始真实写请求；等待实际回调携带原caller到达，读取已持久的监督关联后才drop。原outcomeUnknown、unknown／完整原生停止及重启不重放断言保留；新mutation-loss.json保留实际caller、持久意图及关闭事实。
- 仅更新本change的design/tasks/delivery。`HostConnection`、broker、schema、kernel生命周期、期限／容量／回调收尾、原值API、harness及UI均未改。既有“独立认证及操作范围的公共监督”规格已要求未知保留与不重放，本轮无新行为或规格增量。

### 实际验证与首次结果

Node24.12.0，Linux本机；先用已有tsc构建kernel，再测试，测试期间未重建。构建按原脚本复制migration和architecture到ignored产物，没有依赖安装或开发服务器。

| 检查／命令 | 实际结果及证据 |
| --- | --- |
| baseline构建后原用例单跑 | 1/1通过，1.8秒；`/tmp/scholoom-zotero-r9-baseline-{build,tests}.log`。Linux原例偶然通过不否定CI失败或其因果缺口 |
| 新报到断言先跑旧fixture | 预期1失败，6.1秒，caller为undefined；`/tmp/scholoom-zotero-r9-receipt-red.log`及`-receipt-red-results/`保留。证明原fixture无实际送达报到，不是生产错误分类修复的红例 |
| 最终kernel build及tools类型 | `node_modules/.bin/tsc -p apps/kernel/tsconfig.json`与`tsc --noEmit -p tsconfig.tools.json`均0退出；final-build.log／tools-types.log |
| 定向监督 | `node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/host-connection.spec.ts --workers=1 --output=/tmp/scholoom-zotero-r9-final-results`：24/24通过，31.5秒；final-tests.log。覆盖修正用例、同身份重复写、正常关闭、回调超时仍跟踪／占容量、恢复与私有启动撤权等已有代表边界 |
| 格式／语法／架构／OpenSpec／diff | Biome两文件0警告，fixed-host的node --check通过；架构14模块253文件0发现，strict及git diff --check通过。无schema变化，不重生映射；未重跑BBT或TeX |

上述日志统一前缀`/tmp/scholoom-zotero-r9-`。最终结果目录保留实际`mutation-loss.json`；受测内部固定host、认证回环WS、ManagedCommands、OS原生归属及监督文件均真实，固定host的wait不完成／drop断联是明确故障夹具，没有文献库或模型替身。唯一诊断调度gate仅存在临时校准脚本，正式回归不靠它。测试与实验均收尾自己创建的执行，隔离目录保留。

### CI截点、审查及交回

只读辅助Agent（gpt-6.1-sol/high，fork_context:false）只做本仓CI／artifact取证，主Agent抽查trace的poll／拒绝事件及manifest；代码和验证由主Agent完成。自查确认wait只用于当前失联和同身份重复写场景，callback沿原handle、scope及可信context核对；没有放宽未知／停止／容量保证。本轮不需要新的产品或架构选择。

CI查询截点为2026-10-27 05:35:33 UTC：Checks `40454653610`／0b78815仍in_progress，Windows job `122025046610`仍test:kernel；Windows diagnosis `40454653566`已成功，但实际命令未运行host-connection.spec.ts，artifact `12711359112`也无此例trace。均不计修正后Windows通过。已完成基线仍按用户给出的b2f3b50记录：Linux734通过1失败23跳过，Windows715通过4失败39跳过，macOS人工UI13通过1失败；本轮未触发CI或等待其他线。

本地增量及日志清单在`/tmp/scholoom-zotero-r9-handoff-Zgn8sR/`，`fixture.patch`依赖当前0b78815及其真实公共监督，不是旧累计patch；包含两份测试工件和本change三份文档，反向git apply --check只读核对。Windows需主线将此增量接入后按同一有界场景真实复验；当前只能交回可核查的夹具修正，不能关闭该目标平台失败或整体E4／I6。没有真实用户库、BBT／TeX、文献UI、安装／下载依赖、提交／push／PR／归档或跨树操作。

## 已接收：明确原值选择与独立题名更正（R8）

2026-10-27，基线及当前HEAD为`8a2f0ce522dfbab4110e63e84e542f6660e6115e`，本轮开始时clean。已按用户D1–D3直接实施隔离内核／Agent片；不再等待同步或产品选择，不应用旧累计patch。当前R8.1–R8.4完成，累计21/30；原change其余任务、完整I6、E5/E6、真实用户库和跨平台均未关闭。下文规划／等待是各轮历史，不能覆盖本节及design顶部当前DTO。

### 实际行为与所有权

- `protocol/zotero.ts`增加inspect／replaceTitle，export增加selectionRequired/exported分支与逐条expression；复用共同CSL／OriginalRecord／receipt，business映射仅增加四行。未修改library权威、原包、原值投影或存储台账。
- `ZoteroOperations.read/inspect`实际经broker读取同revision的get／record及唯一schema44期刊identity；题名准确比较，其他字段始终notComparable，结果最多100条／256KiB。缺题名、多原值或不支持形态unavailable，修订竞争contentChanged，不反猜、扫描或循环重读。
- `ZoteroOperations.run`在缺expression时返回核对结果，不创建profile／启动原包或给新文本。明确选择实际identity及revision后才沿既有HostConnection／受管Electron导出；关闭后复核共同依据和read/send，返回实际expression／revision／正式键。host的managed出口仅补结果tag和expression，无原包流程修改。
- `replaceTitle`独立提交准确原title，完整保留其他原值、CSL、来源及正式键／pinned；复用一次共同commitRecords、CAS、稳定requestId及结果查询。已有回执返回queried，未知不重放。生产时限、容量、unknown及关闭保证未放宽。
- manual／CLI与architecture仅添加两个生态操作，kernel消费增加library.get；harness增加`inspect_zotero_originals`、`replace_zotero_original_title`，保留原工具及所有成功结果的rememberLibrary→rememberCatalog登记。表达是可信调用边界内的操作选择；工具要求按用户明示选择、不确定询问，不把模型填boolean当人类授权证据。runtime／application及FileEdit／报告／TaskPort／programs未改。

design变更总览已核对为当前真实隔离分层，先前候选／人工确认provider等待仅属历史。GUI交接契约：以实际sourceId/revision调用inspect，展示CSL与原值、identity、题名比较及其余不可比较；按明确选择提交expression。独立题名动作提交准确title及原identity/revision，成功后消费receipt.results中的新revision并刷新；CAS失败重新核对且保留草稿，未知用原requestId查询。复用文献单一草稿／详情，尚未实现GUI，不改CatalogItemForm或新建来源／同步表。

### 首次失败、真实结果及命令

Node24.12.0／TypeScript7.0.2／Electron44.5.1，Linux本机。沿固定资源清单使用已有BBT9.0.68原XPI `/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`，夹具从原包隔离解包；未安装、下载或修改原包。日志统一前缀`/tmp/scholoom-zotero-r8-`，manifest和可审查增量在`/tmp/scholoom-zotero-r8-handoff-hggAcT/`。

| 检查 | 实际结果／证据 |
| --- | --- |
| 先红：构建旧kernel／host后只跑explicit original selection | 预期1失败：未选expression仍返回BBT文本。red.log、red-results/及red-kernel-build.log／red-host-build.log保留 |
| 首次实现构建／类型 | kernel-first.log保留TS2589/2590；将共同commit DTO先显式定型后kernel-second.log通过。tools-first.log保留TS18048；对真实核对结果增加缺失检查后tools-second.log通过 |
| 初绿真实原包整合 | first-tests.log：10/10，包含新3项、既有100条／冲突／未知／撤权／实际worker工具／only-export重启 |
| 最终构建 | 已安装tsc顺序构建protocol、harness、kernel，按原脚本复制migration和architecture；host目录用electron-vite build。final-{protocol,harness,kernel,host}-build.log均0退出 |
| 受影响类型／格式／架构 | `tsc --noEmit -p tsconfig.tools.json`及host tsconfig通过，protocol／harness／kernel由构建检查；final-tools-types.log、final-host-types.log。Biome改动9文件0警告；architecture为14模块253文件0发现，分别final-biome.log／final-architecture.log |
| 最终定向内核组合 | final-tests.log：48/48，2.4分钟。architecture5、broker4、HostConnection24、library-records2、实际Electron scope1、原包监督2、共同库／BBT10 |
| 生成映射／规格／diff | final-generated.log中全部8份映射对最终schema及Biome格式逐字相同。strict首次仅因新增Requirement超过500字符返回1，openspec-first.log保留；去重并拆清核对契约及场景后final-openspec.log通过。probe的node --check及git diff --check通过 |

最终组合命令（构建完成后执行，期间未重建产物）：

```sh
SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/zotero-host.spec.ts tests/kernel/zotero-host-supervision.spec.ts tests/kernel/zotero-host-scope.spec.ts tests/kernel/host-connection.spec.ts tests/kernel/library-records.spec.ts tests/kernel/broker.spec.ts tests/kernel/architecture.spec.ts --workers=1 --output=/tmp/scholoom-zotero-r8-final-results
```

新回归实际核对：CSL题名及日期范围／机构作者更正后完整原值和固定键保留；未选表达无文本，boolean额外字段invalidRequest；明确原值两格式保留原题名；独立更正后仅原title改变且两格式采用新值；稳定重复请求只查询、不执行不同新题名；实际CSL竞争拒绝旧CAS；缺题名／多来源／错identity拒绝。未知样本在真实共同提交后由订阅观察故意抛错，返回outcomeUnknown，原requestId查到committed且revision只增加一次。Agent用真实worker工具读取实际核对／回执后更正与导出，only-export持续外发P1在下一轮和重启均阻止新的模型请求。结果目录包含original-title.json、fill.json、两格式100条文本和harness.json。

内部kernel／broker／library SQLite、WS、受管进程及原生归属、Electron、原BBT Worker均真实；题录／来源实例为合成输入。替身只有Agent外部模型HTTP的确定工具响应，以及未知回执用例的提交后观察故障注入；不替换共同存储／SQL／事务或用合成身份绕过生产授权。隔离配置、库、profile、项目和结果目录保留，测试关闭自己创建的执行；收尾未见本树managed host或kernel CLI残留。调查probe只做必要新契约调用迁移与语法检查，未重跑已接收四阶段研究。

### 审查、增量依赖及停点

只读独立审查（gpt-6.1-sol/high）核对同revision读取、无选择不启动、题名只改原字段、未知查询、薄注册及P1，未发现可确证缺陷；审查未执行构建／测试，实跑结论以上述日志为准。后续GUI独立消费时仍须验其真实交互和草稿保护；未把审查视为全平台或真实模型科研质量证明。

本地`slice.patch`完整依赖当前8a2f0ce共同基线，另拆`contracts.patch`→`integration.patch`→`docs.patch`供符号审查：先同源schema／生成映射，再kernel／host／harness／注册／必要测试，再事实源文档。未要求独立拣取其中不完整子集，主线应按最终schema重核映射；不含历史累计patch或其他树私有实现。manifest列文件及日志，反向git apply --check只读验证补丁覆盖当前增量。

最新外部CI仍为39be889／40432749785：Linux709通过9失败23跳过；Windows641通过54失败39跳过7未运行；macOS不可用校准2通过、人工入口3通过1失败。本轮不主动触发全仓、不修无关平台，不以Linux定向结果计Windows通过，也未重复整套H1 smoke、UI或真实模型科研验收。

在本片后端／Agent和GUI消费者契约交回处停止。其他字段／多来源、自动双写或CSL导出、GUI接入、原值恢复／删除E6、生产装配及完整I6均未实施或关闭；没有真实库操作、依赖变更、开发服务器、提交／push／PR／归档或跨树操作。

## 第七轮主线接收及产品选择

CSL／原值四阶段调查及原包证据已接收，主线在隔离库独立重跑evidence/csl-original-probe.mjs退出0；更正CSL后原值及导出保持，显式更正original题名才改变原包导出。用户已确认D1–D3：差异或无法比较时先明确选择采用原值，Agent可依用户明示指令选择、不确定询问；独立更正所选原值；首片仅唯一期刊原值题名。决策事实源为领域票08，design／delta spec及R6.4已更新，未将新政策记为已实现。

主线真实zotero-host七项带固定XPI复验7/7通过，保留only-export持续外发授权及重启保护。原始证据为`/tmp/scholoom-round7-acceptance-SdxHy8/zotero-ecosystem/probe.log`、`main-zotero.log`；初次主线组合缺显式XPI环境的7个skip不计通过，随后独立带环境实跑。

下一片先闭合具体DTO／任务，再实现隔离内核及Agent的显式原值选择和独立题名更正。GUI需求交文献后续消费，不复制草稿或抢改表单；自动同步、其他表达／字段、多来源、真实用户库及完整I6仍开放。

## 当前状态：CSL／原值差异规划

2026-10-27，本树HEAD已核对为`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`，起始clean，实际同步／构建／本树持续外发P1复验由用户交接的`/tmp/scholoom-round6-acceptance-dXuzCA/`四份验收／同步JSON及本树日志提供。普通期刊真实切片和P1已接收，本轮没有返工或回退；没有应用旧patch、等待同步或操作其他树。

本轮**只调查和规划**，没有新生产实现。修改限本change的investigation/design/specs/tasks、已有delivery及隔离证据。已形成可审查推荐A＋B1与D1–D3决定项，见[design本轮节](design.md#csl更正与原值导出差异的待决方案4b13183)；产品默认导出／用户确认身份、独立原值更正或一次明确双表达更正、下一片字段／来源范围仍待用户选择。没有把推荐写成已批准自动双写，也没有新增库权威或修改元数据表单。R6实际状态以tasks为准，原3.x／E5／E6／整体I6不因此完成。

### 实际调查与证据

完整结果与源码定位见[investigation当前节](investigation.md#当前调查csl更正与原值导出的差异4b13183)、[隔离证据README](evidence/csl-original-4b13183/README.md)和[observations.json](evidence/csl-original-4b13183/observations.json)。复用已接收普通期刊样本配方，新建`/tmp/scholoom-csl-original-AUctoW`，没有打开用户库或更改旧样本库。两个正式键固定，原值含日期、跨角色完整creator顺序和Extra未知行。

| 本轮操作／检查 | 实际结果及边界 |
| --- | --- |
| `node_modules/.bin/tsc -p apps/kernel/tsconfig.json` | 0退出；仅重建既有ignored产物，日志`/tmp/scholoom-zotero-r6-kernel-build.log` |
| host目录`../../node_modules/.bin/electron-vite build` | 0退出；日志`/tmp/scholoom-zotero-r6-host-build.log`。沿已有Node24／Electron44.5.1／BBT9.0.68，未安装或下载依赖 |
| `node openspec/changes/connect-zotero-host-bbt/evidence/csl-original-probe.mjs` | 首次0退出，8次两格式实际导出完成，日志`/tmp/scholoom-zotero-r6-probe-first.log`。构建完成后才运行，运行期间不重建 |
| CSL题名更正 | A revision 2→3，CSL新值可读；原值／键／pinned和原值历史不变，两格式仍与baseline相同 |
| CSL日期／作者歧义更正 | B revision 2→3，2025–2026日期范围／circa、机构名／粒子／suffix及译者分组可读；原date及creator全序保持，两格式仍为原值 |
| 显式original题名对照 | A revision 3→4，只有所选原值题名更正，原值历史多一条，原Extra及固定键不变；两格式出现新题名；共同commitResult与实际receipt相同 |
| 归属及数据保护 | 最终scopeStopped=true、pluginClosed=true、unresolved=[]；app已close，隔离库、profile和输出保留，没有登记额外研究项目。原XPI仅核对manifest并解包，未改成员 |

内部KernelApplication、library／broker／SQLite、认证WS、ManagedCommands、OS归属、Electron和BBT Worker均真实；样本内容／来源实例为合成输入，没有内部provider／SQL替身，没有外部模型调用。原包的title case和Extra的pubstate输出是观察值，不能拿文本字面不等作为陈旧门禁。本轮只证明当前双表达行为及一个显式原值对照，不是CSL逆映射／生产同步或真实科研质量验收。

没有新的首次运行失败；CSL更正后导出未跟随是**预期调查反例**，并非被修复的生产缺陷，不能写成“自动同步修复通过”。此前主线已验P1不在本轮重跑。收尾`node --check`、四阶段读回／8份文本及共同依据一致性断言、38个本地Markdown文件链接检查、OpenSpec strict及`git diff --check`通过；新增图人工核对图文，未做渲染器验收。Biome按项目配置排除了OpenSpec工件，首次命令返回no files processed，未将它计作lint通过；语法和实际运行由前述检查证明。当前16/26仅增加三项调查规划成果。

### 契约核对与仍缺的提供者

只读辅助Agent（gpt-6.1-sol/high）梳理表单／共同provider，主Agent抽查关键事实：`library.update`只改CSL等共同题录，`commitRecords`可分别显式提交metadata/original/key且共同CAS、历史和稳定回执已有。分离要求的准确来源是已接收`define-library-zotero-record-authority`的delta，而非假称它已归档进`openspec/specs`。原值upsert是完整对象替换，日期／姓名／跨角色顺序没有唯一逆映射；历史查询不等于已提供历史回退、原值删除或操作者审计。

推荐A首片的已有原值提交不缺新存储provider，当前等待的是D1–D3产品选择、明确人工意图及单一草稿入口归属。D1若强制人工确认，可信确认provider目前不存在；B2的CSL导出映射、C2的来源版本／合并、完整单对象恢复也未交付，不能拿读过设计当已接入。具体schema／事务／冲突／通知／恢复及文件符号依赖已列design，生态不替文献创建映射权威或改生产表。

### CI基线与停点

已读取最新`6b22d60 / Checks40315429083`原始日志和平台清单：Linux内核689/9/16、Windows628/49/30分别为通过／失败／跳过，macOS入口3通过／1失败。Windows失联回归期望outcomeUnknown而实际unavailable需按受理阶段诊断；本轮不把它归因于超时、不更改生命周期或计关闭。其他context-session／文献／生命周期失败及其分工见investigation和主线计划，本轮没有重跑全仓或目标平台。

到本次可决策规划交回处停止：先请主线／用户确认D1–D3，再拆获准实现子范围。现有持续外发授权、正式键、来源副本新实例规则和真实用户库禁用保持。没有新生产代码、UI、依赖安装／下载、开发服务器、提交／push／PR／归档或跨树操作。

本轮规划增量为`/tmp/scholoom-zotero-r6-handoff-tR2Jiq/planning.patch`，基线4b13183；同目录manifest列出16份仅本change的工件、构建／调查／校验日志及仍缺选择。完整反向`git apply --check`通过，不自动应用到其他树。复现脚本和必要读回／导出证据已留在本change，不依赖临时包作为唯一事实源。

## 前轮状态（已接收）：共同库期刊切片

2026-10-27，基线 `1026796d854b8f568c3e819f13268a9638980bc1`，起始工作区干净。用户直接授权本轮最多100条普通期刊隔离接线；未同步／等待文献实际提供者条件已失效。下文第三／四轮及更早待办为历史证据，不是当前阻塞。当前任务13/22，仅R5.1–R5.4本片完成；整个change、3.x完整条件、I6、生产启用和跨平台未关闭。

### 主线验收：持续外发授权P1

独立Standards审查发现生态工具直接返回库结果，没有像共同题录工具一样保存会话已使用的库身份，下一轮模型可能再次发送旧导出而不复查库授权。主线在真实Kernel／broker／受管原包／worker、仅外部模型受控的only-export回归中确认：撤回send后旧实现仍completed，应拒绝模型请求；首次1失败保留在 `/tmp/scholoom-round6-acceptance-dXuzCA/zotero-send-red.log`。

主线只修改harness的生态工具结果回调及唯一装配点，在成功返回前复查执行资格并复用 `rememberCatalog` 保存库身份，不增表或伪造资源。既有异步授权、最终同步准入和重启检查继续负责read/send。重编译harness后，原回归1/1通过，覆盖当前内核下一轮及重启，撤权后模型请求数均未增加；证据为同目录 `zotero-send-build.log`、`zotero-send-green.log`，根tools类型及改动Biome通过。原审查者追加只读复核确认P1闭合；没有把其静态结论写成实跑，也不由此关闭完整I6。全体组合验证和同步派发由公共接入delivery引用本轮证据。

### 实际接线与同源结果

- `packages/protocol/src/zotero.ts` 复用真实library record／receipt／key schema，提供fillKeys/export/result及私有有界读回；`operations.ts`和生成business映射注册，未复制文献字段／正式键权威。schema44期刊字段／作者声明来自已归档固定schema调查，只接受明确原值，不逆猜CSL。
- `apps/kernel/src/zotero.ts` 经真实broker消费read/write/send、record、commitRecords、commitResult；配置只在可信构造时明确绑定隔离libraryId、受管启动和固定原包目录。人工CLI与harness三个薄工具共用该handler和可信上下文。`manual.ts`只增workspace／handler／close，`application.ts`只增配置及构造器末尾生态端口，保留全部根工具和其他领域构造参数；architecture声明同步。
- `apps/zotero-host/src/main/journal-catalog.ts` 实际执行SQLite SQL，Item/saveTx只在外层补键事务暂存候选，原包KeyManager.fill完成后一次共同commitRecords。已有正式键／pinned只读自library；同库全范围大小写冲突由library一次拒绝，不改名。SQL／Item／通知／BBT缓存可丢弃，未增加持久库权威。
- `managed.ts` 使用真实认证WS／HostConnection／ManagedCommands／OS原生归属／Electron／Chromium Worker和未修改9.0.68原包。确认共同回执后通过单个私有读回，由kernel按原选择读取最多100条、累计512KiB；不放宽公共64次回调、停止保证或时限。BBT超过10条必经的ProgressWindow由headless进度记录承接，记录实际headline／百分比并在dispose收尾，不伪装可见Zotero窗口。
- 提交成功而回读／通知失败返回committed回执和独立有界诊断；未知保留原operationId及监督事实，查询共同结果，不重放。已存在回执的fillKeys返回`queried`，不声称新选择已执行，也不伪造历史通知状态。导出在完整关闭后重新核对read/send及原revision/key/pinned，由kernel返回所用共同依据。

对应原design依赖图：T21/T22的普通期刊实际提供者已接入，T31/T32/T41仅完成本片；更广映射、偏好事件、材料和生产保护维持开放。

### 最终实际验证

证据目录：`/tmp/scholoom-zotero-r5-evidence-mwaFJn/`，包含首次100条失败工件、最终kernel/smoke产物、日志、补丁及manifest。固定资产为用户提供的`/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`，manifest实际核对version=9.0.68及id，官方来源沿`resources/versions.json`，每个夹具从原XPI独立解包；未下载或修改原包。仅Linux本机，隔离profile／库／项目／端口，项目与结果目录保留，测试自行关闭所属执行。

最终构建先于测试，测试期间未重建共享产物：protocol／kernel使用已有`node_modules/.bin/tsc -p <tsconfig>`，host使用已有`electron-vite build`。此前共享依赖构建完成，最终14个包及tools全部`tsc --noEmit`通过。没有启动开发服务器。

| 验证 | 实际结果 |
| --- | --- |
| kernel定向：zotero-host、host-connection、zotero-host-supervision、library-records、broker、architecture | **43/43**，1.8m，日志`final-kernel-tests.log` |
| 本片6条真实整合（包含于43） | 100条中99条一次补缺键及一条固定键；两格式文本；共同original标题更正后保持键并刷新；真实CLI停止重启读回；未选中大小写键冲突全部拒绝；旧revision／缺原值／越库拒绝；快照受理后撤write及send；共同提交后观察故障保留unknown／查真实回执／不重放；真实harness工具 |
| 原包smoke | **10/10**，44.8s，`xvfb-run -a env SCHOOLOOM_BBT_XPI=... node_modules/.bin/playwright test --config playwright.config.ts tests/smoke/zotero-host.spec.ts` |
| 类型／生成／架构／OpenSpec | 14包＋tools通过；8份生成映射从最终schema独立重算一致；architecture零findings；OpenSpec strict通过。Biome零错误，6条警告均为未改动的harness非空断言 |

新增整合内部kernel、library、broker、WS、受管命令、SQLite、文件和原包均真实；仅harness外部模型使用合成Anthropic响应。期刊内容及来源是合成输入，不是真实科研质量。未知样本在真实共同提交后让实际workbench事件订阅者抛错，持久回执仍committed；没有替换SQL/provider或制造假回执。既有H1/supervision的显式样本Adapter仍属替身，其通过不冒充本轮真实提供者结果。

### 首次失败、诊断与审查

1. 初次构建遇TS泛型展开／无效错误码，收窄实际消费端口及上下文类型后修复，未缩减共同事务。初次宿主启动未ready并保留unknown；定位CJS产物外置了仅import导出的workspace入口，改为构建时内联既有workspace依赖。未修改原包或用普通spawn回退。
2. 首次实际事务和文本成功后，测试因列表顺序假设及BBT title case转换失败；改为按固定标题选择合成对象、按语义核对文本，保留固定H1引用键oracle。
3. 首次100条返回committed＋刷新失败，回执／99条键已持久化。先尝试顺序回调仍失败，继续定位到每操作累计64回调上限；改为一个私有读回回调，kernel内部有界读取真实provider。首次失败产物见`first-100-results`；最终100条回归保护此边界，未扩大容量或超时。
4. 曾在一次TS检查失败后误跑4条诊断用例；这次4/4不计最终验收。最终类型修复后重新构建，再完成上述43/43及10/10。首次／中间日志均保留，不把它们覆盖为成功。
5. 首次带`--config.optimisticRepeatInstall=false`的pnpm构建仍触发自身锁文件核对及本地workspace链接整理，日志下载0、added0、版本未升级。后续改用已有直接工具入口，未再触发；本轮没有主动执行install命令。新增依赖声明仅指向已有client/protocol workspace包，锁文件没有新增外部版本。
6. 原生只读scout（gpt-6.1-sol/high）核对接口／原子提交／权限／未知边界，主Agent复核并采纳queried区分、共同committed读回闸门和kernel导出依据。其“receipt必须有error/results”判断与当前schema的外层required不符，且稳定回执已严格等值实跑，不改共同契约；其快照来源疑问由交付前相等复核和kernel权威回填处理。scout未跑测试，最终验收由本会话执行；已关闭该只读子Agent，无写入子任务。

### 可审查增量与停止边界

补丁位于本证据目录：`01-contracts.patch` → `02-host.patch` → `03-integration.patch` → `04-docs.patch`，另有完整`round5.patch`。共同依赖是已同步的1026796；不应用历史累计补丁、不复制其他树私有实现。01提供protocol/schema/export及生成映射；02为生态私有宿主／workspace资源声明；03为kernel/harness/architecture和必要回归；04为本change及开发入口文档。完整反向`git apply --check`及diff检查用于核对补丁覆盖当前增量；无提交／push／PR／archive。

剩余：CSL单独编辑到Zotero原值的同步映射、复杂类型／关系、多原值选择、resetKeyOnChange事件、显式来源重绑定UI、E5材料写回、E6删除恢复、新建／删除／附件／组织事务、自动／外部导出及迁入不在本片。缓存更正本轮验证的是共同original字段修订，不能据此宣称全部共同题录映射完成。未知监督仍保护目录，稳定committed结果查询不会自动清除监督未决状态；恢复／清理策略须后续明确范围。

尚需主线决定下一片的字段同步及完整I6验收范围；Windows/macOS、全仓CI、真实科研质量与真实用户库启用无新增通过结论。本轮在补丁及本记录交回处停止，不自动展开下一阶段。

## 第四轮验收E1修复

2026-10-26，主线`/tmp/scholoom-round4-acceptance-JCUBNw/acceptance.md`及`host-callback-repro.mts/.log`确认P2：外层300ms超时后丢失仍活跃callback，2000ms关闭可误报完整closed。本节E1是验收问题编号，不关闭文献E1–E3／E6。当前HEAD仍为`eaf38be1ac2d350120805859175fc82cf9c36927`，0519904已在树内；只针对前轮已有工作区做增量，没有同步、回滚或覆盖既有成果。

### 根因与本轮改动

已搜索全部HostConnection／connectHost装配、callback／inflight／call／stop／close路径：公共main客户端在外层超时／失联后不替内核取消已受理provider；旧call finally直接删entry，而stop只等entry.work，因此RPC结束后丢失完成跟踪及操作名额。

`apps/kernel/src/host-connection.ts`复用原entry.work：给调用者的work仍按原预算返回或拒绝；entry.work改为原请求结束后继续等待已受理callback的drained，finally只关接受闸门，真正drain后才删entry。status增加pendingCallbacks，完整closed另要求inflight为空。请求错误仍向调用方报告，写入unresolved不由drain清除；scopeStopped只确认OS归属，不代替callback完成。

关闭仍按原有界预算核对drained；未结束则unknown、保留内部操作名额／必要未决事实和profile保护。回调之后完成会释放内部操作容量，但不会抹去关闭超时或写效果unknown；依赖均完成且正常shutdown有依据时可正常closed。不新增生命周期Module，不修改platform command／admission、原包、时限、文献provider或生产装配。

测试仅扩展`host-connection.spec.ts`三例和固定host的一个只读fire-and-forget夹具入口：读／写超时仍保留活跃回调；64条只读回调持续占用容量，完成后可继续操作并正常关闭。现有关闭竞态、取消、失联及写回调早返回用例继续运行；超时和失联均走同一finally／drain路径，不扩展重复矩阵。

### 红绿证据与实际验证

证据根目录`/tmp/scholoom-ecosystem-round4-8fMisa/`。Linux，既有Node24.12.0／Electron44.5.1、未修改BBT9.0.68，隔离profile和合成catalog。真实固定host、ManagedCommands、原生归属、认证WS；仅callback provider用gate替身，不证明真实文献事务或用户库行为。

- `red.log`／`test-results/host-callback-round4-red`：旧实现**1失败／2通过**，只读外层超时后callbackFinished=false仍closed，精确复现主线根因。
- 首次容量夹具`capacity-red.log`只受理45/64：peer控制响应优先导致部分callback未先受理。固定夹具让已发送callback先交付后返回外层结果，未延长时限；`capacity-red-confirmed.log`随后确认旧实现会接收第65条无callback操作，违反容量约束。两份失败日志分别保留。
- 修复后kernel定向 **26/26，38.2秒**（host-connection＋zotero-host-supervision）；补充断言写入未知关联仍保留后，三项回归再次 **3/3，13.2秒**。日志`kernel-green.log`、`final-regressions.log`，trace分别在`test-results/host-callback-round4-green`与`host-callback-round4-final-regressions`。
- 原包smoke **10/10，43.3秒**，`smoke.log`／`test-results/host-callback-round4-smoke`。正常／错误shutdown、late-save、flush、Worker原回归保留。

本轮命令先完成`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel --filter @scholoom/zotero-host build`再测试，测试期间未重建产物。包typecheck同样带该pnpm配置；tools tsc、定向Biome、architecture **13模块／205文件／0 findings／0 exceptions**、生成器self-test通过。raw生成的6处原有换行差异经格式化与当前映射一致（`mapping-check.json`），未改生成文件。没有改platform command，因此未重复其专用矩阵。

只读辅助审查因所选gpt-6.1-sol模型容量不足未运行，记录真实错误`Selected model is at capacity`；没有声称取得新独立审查结论。主方逐项核对调用点、首失败及实跑结果；保持指定主配置，不操作其他树，特别未访问或打断research-task-workspace。

### 可审查增量与停止边界

`/tmp/scholoom-ecosystem-round4-8fMisa/callback-drain-fix.patch`只含本轮六个文件：监督实现、测试、固定夹具、design／tasks／本delivery。它以该目录`before/`保存的本轮起点为前态，依赖现有第三轮公共监督及OpenSpec工件；不是全部eaf38be到当前的总差异，不能直接用于缺少前轮源码的裸0519904。`patch-manifest.json`记录依赖与验证，不替换第三轮补丁或历史证据。

本轮R4.1完成，当前9/18；只交回验收E1修复及最小复验，待主线复核，不宣布完整关闭保证无条件接收、I6或整个change完成。E1–E3／E6、真实provider／HostCatalog、生产装配、Windows／macOS与全仓CI继续开放。未安装依赖、启动开发服务器、写真实库、改原BBT或其他树；未提交／推送／PR／归档／reset。

## 第三轮独立监督与原包修复

2026-10-26，用户在同步修复后明确恢复。本树恢复HEAD为`eaf38be1ac2d350120805859175fc82cf9c36927`，只读验证`0519904`／`b838402`均为祖先，恢复时clean。同步证据消费 `/tmp/scholoom-sync-recovery-wyn13R/{recovery.md,synchronized.json}`；主线本树13项内核／9项原包结果只作为同步及既有切片验证，本轮不冒领为新监督结果。直接使用本树正式公共源码，没有再复制临时基线、同步其他树或重做研究。

本轮R3.1–R3.4完成，当前**8/17，整change及I6未完成**。公共监督不依赖programs、BBT或文献；原包接线通过明确样本Adapter独立校准。没有安装依赖、写真实用户库、启动常驻开发服务、提交／推送／PR／归档或改Git历史。保留共享历史／来源、统一v5→v6、资源叶schema、projectId／多窗口及既有图片相关工件，未整文件覆盖公共装配。

### 实际文件与符号

| 切片 | 本轮变化与完成依据 |
| --- | --- |
| 公共私有启动供应 | `apps/kernel/src/commands.ts`的CommandWorkspace／prepare／start增加launchInput；`platform/command.ts`在有界stdin发送前重新授权，不改变普通execute。commandInstanceId贯通准入与启动，凭据不进argv/env或监督文件 |
| 公共生命周期／客户端 | 新`protocol/src/host.ts`与`client/src/host.ts`及子路径导出集中声明／校验私有host消息，复用RpcPeer；不登记为产品业务或引入第二套RPC。新`kernel/src/host-connection.ts`提供独立认证listener、scope ready、操作／回调资格、正常关闭及未知恢复。`architecture.json`仅增加该受控文件的fs/promises权限 |
| 公共恢复占用 | `platform/admission.ts`的retainUnknown按原command身份幂等计入；reserve可绑定owner。即使现容量满，未知scope仍保留，且同内核已有原reservation不重复计数。原生停止／归属后端未改；scope确已停而插件未知时仅保护profile |
| 原包修复 | `environment.ts`明确Gecko profiler inactive，profiling操作不支持；固定9.0.68日志信封中的phase/task结构化进入`host.status().pluginErrors`，shutdown任务错误使unknown且重试不能抹掉。原包及执行成员未修改 |
| 调用方与必要回归 | `host-connection.spec.ts`＋`fixed-host.mjs`验证纯公共Module；`zotero-host-supervision.spec.ts`＋`managed-bbt.cjs`组合真实受管Electron／原包／Worker／双向调用与正常／错误关闭。原smoke补关闭诊断，开发说明更新真实入口和限制 |

公共操作只在独立peer内部注册；产品businessSchemas／harness工具和CLI没有新增成功替身，生成映射不拼接。原调用principal／作用域由内核绑定，回调authorize必须核对本次操作及对象；读操作不可升级写回调。写关联同步保留，原结果到达就关闭handle受理闸门，已经受理的回调继续参与结果／关闭等待。未知效果只保存关联，不成为文献提交权威。

### 本轮实际验证与首失败

Linux，运行器Node24.12.0，Electron44.5.1，既有锁定依赖和原9.0.68资产。全部先构建再测试；测试期间未重建所消费产物。

| 命令／操作 | 结果／证据 |
| --- | --- |
| `pnpm --filter @scholoom/protocol --filter @scholoom/platform --filter @scholoom/client --filter @scholoom/kernel build`；审查修复后再构建platform／kernel | 通过；原生process-scope构建及kernel迁移／architecture资源复制沿原脚本 |
| host build／host typecheck；`tsc --noEmit -p tsconfig.tools.json` | 通过。host验证由辅助实现者独立运行，主方对新增监督及所有tools再次核对 |
| `SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{host-connection,zotero-host-supervision,zotero-host-scope,managed-commands,command-observation,platform-command-contracts,process-admission,rpc}.spec.ts --output test-results/host-round3-reviewed` | **56/56，1.1分钟**；实际使用shell展开前等价的8个明确文件参数。日志`/tmp/scholoom-ecosystem-round3-Ky7fg8/kernel-reviewed.log`；正常及故障的`supervision.json`在输出目录 |
| 原包smoke（原9项＋关闭吞错） | **10/10，43.2秒**。`/tmp/scholoom-profiler-shutdown-LlzaJ2/{first-failure.log,final-smoke.log,green-results/}`保留红绿证据：修复前注入原包释放失败仍closed，修复后unknown且有结构化关闭错误；正常关闭无shutdown任务错误 |
| 类型／Biome／架构／生成器 | 定向源码与测试Biome无诊断；13模块／205文件，0 findings／0 exceptions；generator self-test通过。raw生成有6处既有换行差异，Biome格式化后与当前映射逐字节一致，未顺带改映射，依据`generated-format-diff.patch` |

首次启动供应回归实际失败：子进程stdin为空；trace在`test-results/host-connection-red`。公共固定host首次10/10，审查扩展后56项最终通过。原包监督首次组合为16通过／2失败（`test-results/host-supervision-round3`）；原因是Electron夹具用固定argv下标误取带运行参数的位置，profile尚未创建。改为从尾部读取可信固定参数后2/2、5.9秒（`bbt-supervision-second`）；最终使用显式XPI并每轮解包到隔离目录，完整56项再次通过。没有放宽生产／测试时限。

正常受管原包结果为`closed, pluginClosed=true, scopeStopped=true`；注入Notifier释放错误后为`unknown, pluginClosed=false, scopeStopped=true`，原生占用已释放而profile仍保护。固定样本通过真实补键和两格式导出，生产仍false。Xvfb／`--no-sandbox`仅在固定测试命令使用，非产品分发／sandbox保证。DBus环境诊断保留，不把非插件shutdown的系统stderr一概当业务失败。

模拟边界：固定host的业务callback及身份是显式测试输入；原包的catalog为H1合成SQLite／有限SQL视图，数字ID／关系不作生产承诺。WS、stdin、受管命令、Electron／Chromium、原包及两个translator、SQLite／文件均真实；没有调用真实library提交、harness、模型、用户库、外部导出或Reader。

独立只读审查发现并处理9项局部风险：重复操作ID的异步登记、读取handle升级写回调、已受理／迟到回调未纳入等待、abort清理泄漏、启动关闭竞态、坏恢复证据被清理覆盖、满容量恢复漏计及同内核重复计数。必要回归验证调用方可见行为；专项复核未发现剩余具体问题。审查者未执行测试，最终实跑由主方完成，整change最终审查仍未关闭。

### 补丁、依赖与剩余前置

本轮交回 `/tmp/scholoom-ecosystem-round3-Ky7fg8/` 下三份补丁和`patch-manifest.json`：`public-supervision.patch`为公共源码／调用方／测试；`bbt-lifecycle.patch`为本线原包修复及实际组合；`planning-docs.patch`为同change与开发说明。没有本地提交。公共切片不依赖programs或本线BBT私有文件；私有增量依赖当前树已有H1成果及公共切片，不是完整H1迁入包。

三份补丁对当前工作区的reverse／check通过，未实际应用或回滚；公共补丁另在以`0519904`生成的临时索引上`git apply --cached --check`通过（`public-base-check.json`），没有复制公共源码、改实际index或工作树。收尾OpenSpec strict／schema、本地链接、tracked及新增文件空白检查通过，apply确认8完成／9未完成。原包五个实际执行成员与固定XPI逐字节一致。

接入顺序为已同步`0519904`公共基础 → 本轮公共监督切片并构建／定向验证 → 既有H1＋本轮原包增量 → 文献E1–E3实际provider后另做共同装配／I6。补丁检查不代表已经合入dev或同步其他消费者。

来源恢复／复制默认新实例、显式确认才重绑；正式键同库大小写不敏感冲突、不改名／覆盖固定键；**有界多对象原子提交及稳定查询已定，不再待选逐条方案**。等待的是文献正式schema／provider、E6删除恢复及生产授权；材料sidecar／新PDF字节仍由对应提供者承接。Windows／macOS、分发、真实用户库、外部接口、迁入、自动导出及完整CI没有新增通过结论。到本轮独立切片交回停止，不自动展开下一阶段。

## 前两轮状态与成果（历史记录）

2026-10-25，按用户“实现该change”及随后允许锁文件安装／Electron准备的授权，完成独立H1阶段；**整个change尚未完成，I6真实共同库接线仍受阻**。任务进度以[tasks](tasks.md)为准；没有提交、推送、PR、归档或同步正式规格。

- `apps/zotero-host/src/main/host.ts` 提供私有ZoteroHost及status/start/fillKeys/export/close。固定BBT原bootstrap、主包、Worker与两种translator实际执行，模块只消费注入Adapter，不创建产品文献权威。
- `environment.ts` 承接固定原包所需对象环境和私有文件范围；`workers.ts`、sandbox preload及隐藏renderer提供真实Chromium Worker／IndexedDB，资源来自受限本地scheme，网络及新窗口拒绝。
- 合成SQLite和有限SQL视图只在 `tests/fixtures/zotero-host/catalog.cjs`；它们不是正式类型目录、引用键／修订／身份提供者。默认产品入口仍为外壳，没有启用共同库、人工CLI／Agent生态操作或真实用户库写入。
- 局部关闭、未知保存与OS完整归属分别表达。已受理写入保留等待；迟到操作结束可重试close；shutdown／flush未知不能被再次空清理抹成closed。Worker失联后的只读导出等待可结束，窗口销毁不依赖renderer响应。
- 固定资源清单及来源／许可在 `apps/zotero-host/resources/`，随现有host目录包规则包含；原XPI未内置。构建增加host模块、preload和Worker页面，`architecture.json`只补受控vm／preload访问。开发说明已更新独立入口和限制。

[design](design.md)的总览和时序图仍表达完整目标；当前只有私有Module／原包／显式Adapter段真实，broker／共同文献／长驻监督连线未实现。H1状态不能替代图中的生产角色与领域提交确认。

### 第二阶段交接结果

按用户最新指令，本轮在同一树／change继续，消费主线正式快照 `/tmp/scholoom-phase2-handoff-VZS5mS`，完成消费者核对、公共需求与监督候选及两项隔离失败校准，然后停止。**本轮未修改业务源码、未接入他域私有实现，任务仍4/13**；没有因文档交接完成勾选共同提供者或整合任务。使用原生只读辅助Agent，保持`gpt-6.1-sol/high`，没有新Agent终端或常驻协调者。

- 主线`acceptance.md`已独立接收H1，复验原包9项与Electron归属1项通过。其结论没有扩大到I6、生产、完整正常shutdown或多平台。
- 已读文献B批design、tasks／delivery及`library.ts`／`catalog.ts`实际快照。开放metadata、单条CAS、内部事务和持久摄取批次存在；来源实例／原值保留、正式键固定状态／冲突、多Item提交／稳定结果查询均未交付。精确路径、符号、消费者需求及反例只维护于[investigation第二阶段交接](investigation.md#第二阶段正式交接与消费者核对)，本记录引用，不另建进度账本。
- 阅读材料及报告两个design和实际位置schema已分别消费。**E5“未收到设计”已解除**；sidecar转换／新PDF字节提交仍无真实提供者。报告独立，不作为BBT或基础综合前置；没有复制或合并对方change。
- 计算`ManagedCommands`／`program`观察快照已消费。`started`不证明Electron或BBTready，`cancel`回执不证明停止；现可复用原生准入、固定程序、日志背压及stopped。计算快照C3需其提供者修复，不在生态改超时或复制programs记录。
- [E4公共候选](design.md#第二阶段e4长驻监督公共候选)已细化到宿主实例／操作身份、一次性stdin供应、独立回环listener、双向RPC、ready、正常shutdown、失联、重启unknown及文件／符号写集。推荐独立host listener，保留共享product listener选项。**未生成公共源码补丁**：跨模块启动供应与监督记录语义待确认；不能把公共候选当已授权实现。

公共依赖顺序：P0由计算拆command观察增量、修C3，经dev验证后用户同步；P1确认宿主私有启动供应／listener／恢复记录并独立校准；P2接真实原包与固定样本、补当前shutdown差距；最后在文献E1–E3实际交付后做P3共同接线／I6。P0/P1明确不依赖programs私有包、项目数据库迁移或本树BBT私有实现；对应文件与验收以design的P0–P3表为准。

## 实际验证

### H1已有实现记录

本机Linux、Node24.12.0、Electron44.5.1，使用现有锁文件。`pnpm install --frozen-lockfile`及`pnpm setup:electron`成功；package.json／pnpm-lock.yaml没有版本变更。安装初次提示内核bin尚未构建，随后 `pnpm build:shared` 成功生成共享包及内核，不以缺bin警告掩盖构建结果。

| 命令／操作 | 结果与实际范围 |
| --- | --- |
| `pnpm --filter @scholoom/zotero-host build` | 成功生成index.cjs、host.cjs、sandbox preload及Worker资源；没有启动开发服务器 |
| `pnpm build:shared` | 所选16个workspace的共享包／内核构建成功；没有重做公共业务实现 |
| host tsconfig与根 `tsconfig.tools.json` 的 `tsc --noEmit` | 通过；核对真实源码与测试类型 |
| `node scripts/check-architecture.ts` | 13模块、199源码文件、0 findings、0 granted exceptions |
| `SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/zotero-host.spec.ts --output test-results/zotero-host` | **9/9，41.2秒**：空库、显式补键／已有键、两种原包导出、正常通知／无通知反例、实际进程重启读回、版本失败、启动取消、迟到保存、卡住renderer、悬空链接、在途导出失联及未知flush。若干风险边界属于同一端到端场景，非9种完整产品能力 |
| `xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/entrypoints.spec.ts --grep 'compatibility host'` | **1/1，3.9秒**：既有默认隐藏外壳入口回归通过 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/zotero-host-scope.spec.ts` | **1/1，3.6秒**：实际Electron Browser／Tab及忙Worker在现runCommand原生归属下启动，取消返回前退出。未改平台契约；仅Linux，未接真实host角色或共同库 |
| `node tests/fixtures/zotero-host/catalog.cjs` | fixture读取、同对象、SQL、回滚、提交后通知及通知失败、skipNotifier和重开自检通过；仅检查替身自身一致性，不是生产事务验收 |
| 固定资源／原包核对 | 日期资源解析内容与既有10.0.5静态来源一致；9.0.68整份XPI及bootstrap、主包、Worker、BibTeX／BibLaTeX成员未改。没有运行外部Zotero或使用其用户profile |
| `pnpm lint`及定向Biome | 全仓通过，保留71条warning和35条info；本轮源码、配置及测试的定向检查通过，无诊断。未顺带修改全仓既有提示 |
| `openspec validate connect-zotero-host-bbt --strict`、本地链接及diff检查 | 规格结构通过；规划工件本地链接0处失效；已跟踪差异和23个新增文件空白检查通过，新增JSON可解析 |

BBT原资产来自versions清单的精确官方发布地址，保存于 `/tmp/scholoom-zotero-bbt-assets/`。每轮样本位于新的 `/tmp/scholoom-bbt-*`，scope夹具位于 `/tmp/scholoom-owned-electron-*`。最终H1结果在 `test-results/zotero-host`，其中主样本保留 `bibtex.bib`、`biblatex.bib`、`updated.bib`及`restarted.bib`；其他结果／失败trace沿 `test-results/smoke` 与 `test-results/kernel`。这些临时工件保留为调查与复验依据；没有批量删除或接管其他进程。XPI不是项目依赖，也没有被安装到真实Zotero。

scope测试通过Xvfb并仅对固定夹具使用 `--no-sandbox`，不能作为产品Chromium sandbox或真实分发证明。H1测试中的内部Adapter是明确替身，Electron／原包／Worker／SQLite／文件和重启真实；没有模型请求。Windows／macOS、自动导出、外部JSON-RPC／pull export、生产大库及签名分发未验收。

### 第二阶段实际校准与检查

本轮没有业务实现变化，故未重跑整套H1／全仓CI。先执行 `pnpm --filter @scholoom/zotero-host build`，成功后才运行样本；测试期间未重建共享产物，没有新安装依赖。

`xvfb-run -a node /tmp/scholoom-eco-phase2-nHIkpI/bbt-multi-item.cjs` 首次运行退出0，两项独立断言通过，首次日志及JSON结果保留同目录，不以重跑替代首轮证据。真实Electron44.5.1（内嵌Node24.21.0／Chromium152.0.7977.130）、运行器Node24.12.0；两份全新profile和合成SQLite，不操作真实库。原包执行成员来自既有固定9.0.68发布资产，实验只在Adapter的第二次Item.save注入异常，不修改原包。

| 校准／已注入失败 | 预期与实际结果 | 不能据此推出 |
| --- | --- | --- |
| 原`fill`选择两条缺键，第二条拒绝 | 第一条提交、第二条无持久键；一条modify，host降为degraded；原包map仍有第二条候选，断言通过 | 不能把所有条目报未保存，也不能用候选继续导出；不是共同库正式键／稳定提交查询测试 |
| 原`fillMissing`开启条件后调用，第二条拒绝 | 外层事务回滚两条、零modify；map仍有两个候选，断言通过 | 内部方法由实验直接调用，未经过host业务封装；不证明产品回滚后的ready或缓存已修复 |
| 两项原包关闭日志 | 均出现`shutdown done failed`／缺失`Services.profiler.IsActive`，而局部close为`localResourcesClosed` | 退出0只表示预定反例断言成立，**不是正常插件shutdown验收通过**。新差距已进入2.3／P2，未在本轮文档范围内修改业务代码 |

原`Orchestrator.run`会吞shutdown任务异常，故此失败没有抛回H1的原shutdown Promise；新spec场景明确监督层不能把局部closed升级为完整正常停止。P2需修实际兼容缺口并保护同类失败边界，不能删错误日志或返回占位成功。本轮没有声称已修复任何业务缺陷。

本轮新增交接文字经独立只读辅助复核，未发现具体事实错误或矛盾；确认P1不依赖programs私有实现、P0–P3没有提前解除E1–E4、E5只解除设计等待，profiler差距仍待修。审查者未运行工具链，结论只针对文档与已读源码事实，不是跨域接线／生命周期验收。

本轮收尾检查：`openspec validate connect-zotero-host-bbt --strict`、`openspec schema validate scholoom-dev`通过；本change的32个本地文件链接均存在；`git diff --check`及23个新增文件的空白检查通过。原XPI中的bootstrap、主包、Worker及两种translator与实验后执行成员逐字节相同。当前apply仍为4完成／9未完成，CLI的ready只表示规划工件可读。

与主线接收的`H/zotero-ecosystem`逐文件比较，23个文件相同，仅本change的investigation、design、tasks、delivery和spec delta这5份工件变化，清单保留在 `/tmp/scholoom-eco-phase2-nHIkpI/changed-from-accepted-snapshot.json`。临时审查增量为 `/tmp/scholoom-eco-phase2-nHIkpI/phase2-planning.patch`，以主线已接收的本线快照为前态；它只含上述5份规划／交接工件，**不是公共源码补丁，也不能用于宣称dev已接入**。

原包反例细节与精确执行成员行号在investigation，不把临时脚本作为生产依赖。临时样本、首次日志和JSON保留为本阶段可复验依据，未批量清理。未重跑typecheck、架构、全部H1和完整CI：本轮源码／配置／依赖与接收快照相同，只增加校准证据及工件；先前结果与主线独立复验分别保留。

## 审查与问题处理

独立只读审查依据实际Module、契约和测试，发现并用可复现反例修复了：悬空symlink写越界、迟到操作后关闭不可重试、renderer卡住使收尾无上限、就绪后Worker故障仍ready、在途只读导出阻止局部销毁、shutdown失败在空重试时误报closed。主方另修复启动被取消后重新变ready的竞态；原失败与最终通过分别保留，不将静态意见当作实际测试结果。

最后两项修复经同一审查者静态复核，未发现剩余具体P1/P2；其未运行测试，运行结果由主方提供。收尾类型检查发现新增失联测试缺少窗口空值守卫，补齐后根工具类型检查与最终9项实际回归通过。

初次原包装载因blob Worker URL／资源CSP适配停在startup，改为本地受限scheme的固定Worker桥并开放明确包资源来源；未改原成员或延长生产等待时限。测试一度在29MB Buffer的通用deep-equal中耗费约40秒，trace证实业务已完成；改用Buffer字节比较后同一路径数秒完成。测试总预算包含既有30秒操作上限及收尾，不修改生产时限。

显式补键回归发现BBT偏好迁移会重新启用自动补键。沿原包配置为全新自有profile标记autoPinMigrated，并保留fillKeyAfter=0；测试确认启动缺键为空、显式调用才写入。没有裁剪原包启动图，也不把此行为当作迁入已有用户设置的规则。

## 未完成事项与下一步

1. E1–E3政策已定，所需真实来源／原字段／正式键／有界多对象原子提交及稳定查询提供者仍缺，不再等待相反A/B编号的范围选择；不以H1 SQLite或公共开放CSL代替。
2. E4独立认证监督及原包shutdown修复已在本树Linux校准，公共／私有补丁交回；共同产品装配、其他平台与实际dev接入仍开放。完整停止继续分别核对插件与原生scope，不以局部closed代替。
3. E5两份设计交接已闭合，材料新字节／sidecar共同记录转换未闭合；BBT样本不等报告，不实施Reader或茉莉花。E6题录／附件删除恢复仍缺，status明确生产不可用；不执行迁入／自动导出／外部接口／真实用户库路径。
4. 完整I6、整体审查及最终delivery任务保持未完成，不归档或声称整个change已交付。本轮未重跑全仓CI，主线已关闭问题及同步定向结果与本轮结果分别记录，不把未诊断失败归因于超时或称全仓绿色。

继续沿当前 `tasks.md`／`delivery.md`，不需要用户重述已给出的实施及锁文件安装授权；需要的是实际跨线接口结果和必要架构输入，不是再次批准同样动作。
