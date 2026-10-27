# 实际交付与交接

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
