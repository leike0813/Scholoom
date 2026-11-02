# 实际交付与交接

## Linux阶段交付（2026-11-02）

27/27任务已完成，按用户确认的Linux Browser／真实Electron、通用HTML／JS范围接收。报告可以保存、打开、筛选／排序／展开、将所选对象附到共同输入框后发送；真实worker更新文件后，视图保护草稿、提示或自动采用完整新版，准确原版可关闭重开，新会话能核材料后继续。普通内核关窗后继续已受理工作；页面ready不消费科研等待，用户明确发送才沿原身份接续。新正式规格及共同HTML保存规格已同步，初设改为正式引用；本节为最终结论，后文保留过程中的失败、修复和当时边界。

实际执行链沿design的“产品内核与报告视图汇合”图：共同ResourceView／ReportView→原更新／草稿／composer→可信runtime／presentation→公共视图操作→K领域授权和冻结→C／M→独立P。不是在浏览器或Electron renderer直接执行报告JS；能力不具备或来源撤权时明确拒绝，无隔离失败不回退执行。未配置受保护报告安装仍为unavailable，保留源码与草稿。

### 最终实际验证

| 验证入口与证据 | 实际结果 |
| --- | --- |
| 用户手动续执行固定包`network-adapters-resume-TO1XMX` | 原installation与configId保持；受保护`network-adapters-passed.json`为accepted。已安装P与目录包P摘要同为`09e676339298fd1ceb41d7e792b7eee50765a9a894d0984f5ac01735d3fd1dd3`，service保持`de7b0edacc531ef11f6dfe44acfe301a6b6846d5c2802581827ee923208fc761`；原程序inode保留为备份，原失败日志不改写 |
| `~/.cache/scholoom-report-system-service/acceptance-RW8YwH`、`acceptance-8RFqb0` | 普通bootstrap及初始化恢复accepted；原实例`39c97e6a-7c79-4c74-bf91-88ecec1e6dca`、`0fe35800-45b8-4c41-b643-bae092291b25`均持久stopped／stopConfirmed／gateReleased，active／waiting归零；实际初始恢复与消费先于ready |
| 同目录`generic-recovery-vPv2Bu` | 网络拒绝与忙循环停止两例accepted，closeFailures为空，原实例`1a30e2d3-7db5-45a2-ac2d-51558f4daad5`、`607016b1-0f83-4049-979e-e37ec1992c79`均持久停止且容量归零。真实P捕获fetch／XHR／WebSocket拒绝，自有trap零连接；忙循环原scope／InvocationID／cgroup／主进程出生身份保持，三次CPU采样增长后显式停止，未把无ready或超时当停止 |
| `node tests/fixtures/report-product/run.mjs <installed.json>`，`~/.cache/scholoom-report-product/run-MTNh1D` | 新P主产品链Browser／Electron2/2，5.0分钟；真实来源／共同输入／harness worker／保存／更新／R1保护／R2采用／原版恢复／新会话取材与撤权；仅外部模型HTTP受控 |
| 同一runner的`selection`，`run-pxLUPO` | 新P双宿主2/2，1.5分钟；实际报告选择、R1摘录与版本保留，20项／合并超过16项／未知对象整批拒绝，草稿保持且无执行 |
| 同一runner的`lifecycle`，`run-Bsf5K1` | 新P双宿主2/2，3.6分钟；实际关窗后发布、原持久等待、报告ready不消费、共同composer确认后原身份接续。注册图与材料为固定机械样本，不调用模型 |
| 三个产品目录的`kernel-stop.json`及lifecycle.json | 三轮均实际stopped；自有普通内核正常退出，原run／wait／instruction与磁盘成果核对。六条产品用例无失败、跳过或flaky，两个宿主串行共享安装 |
| `~/.cache/scholoom-report-post-install/accepted-kernel.log` | runtime、view、真实K/C控制视图、Manual来源／历史／保存、程序契约及公共基线共52/52，2.0分钟。OS替身与真实仓储边界以各用例为准，不替代上述系统和产品结果 |
| 同目录`tools-accepted.log`、`architecture-accepted.log`及协议生成器self-test | tools类型、同源协议生成自检通过；架构14模块304文件0 findings。kernel／desktop末次类型及必要正式构建沿本记录前次结果，之后未修改相应实现 |
| `package-accepted-current.log`、`package-smoke-accepted.log` | 当前Linux目录包构建退出0；实际包sandbox preload／React smoke1/1、14.0秒。包中kernel CLI、report-channel及与安装相同的P均存在。首次打包配置路径及smoke可执行文件名填写错误分别保留于`package-accepted.log`／`package-smoke.log`，均发生在实际构建或应用启动前，修正调用后通过 |

普通HTML／PDF双宿主4/4回归沿`~/.cache/scholoom-report-product/preview-hv2Xsy`；本轮未改其CSP和普通预览实现。运行后四个恢复场景沿`generic-recovery-rQ3wj6`原身份和限定策略证据；通用Node闭包与syscall／网络／迟到能力及完整归属，另结合已接收的独立提供者证据，未将这些层次合写为一次全绿矩阵。根入口只调用已有构建工具和Playwright，不安装依赖、不启动日常开发服务器；所有配置与输出隔离在持久cache，不依赖当前/tmp。

### 审查、文档与边界

gpt-6.1-sol/high独立核查最终契约与证据覆盖，确认新P系统／UI结果足以关闭2.1b与4.1，未发现新的确证实现缺口；其指出的过时不可用表述、任务进度和初设重复契约已修正。此前来源历史、发布后撤权、准确恢复／近上限队列、选择与关窗、root更新与专用续执行的独审问题均按原回归修复并复核。最终两份正式规格与变更strict验证通过，既有Purpose／无关要求保持，归档前逐块核对delta一致。

开发入口与安装要求见docs/development及各fixture README，工作台交互沿docs/ui-design。人工操作、Agent工具、公共资源及模型外发继续共用原领域授权。Windows实际分发验证后置，macOS受管执行保持明确不可用；本轮不承诺跨平台、完整Web平台或通用同步取消原生默认输入。IME及Orca／AT-SPI对照是原生呈现Module的真实系统验证，ACK／来源有其限定替身，null音频未评价可听体验，详见后文分次证据。生产科研Graph与真实科研质量后续单独定义，不把受控模型和固定图通过外推为科研效果。

已停止历史的OS后清理仍逐项核查，关闭耗时随历史量增加；本轮按原75秒生产契约取得实际ACK，没有放宽停止／容量判据。历史量导致该契约不足时，需另行优化并验证已清净路径；不能跳过原身份复核或以旧回执／进程消失放行。既有CI与全仓发布矩阵沿用户确定的后续范围处理，本次未运行全仓CI。源码未提交、推送；实验／安装和失败证据保留为调查依据，无生产代码依赖cache中的测试脚本。

## 安装与接续过程记录（2026-11-02）

当前为24/27，2.2／3.1／3.2已按下列真实产品结果关闭；剩余2.1b／4.1／4.2等待新程序部署后的系统隔离补验及最终接收。未提交、推送或归档；不配置免密sudo，不调用真实模型。以下所有工件保存在持久cache，接续不依赖当前/tmp。

### 程序更新前的外层期限修复与续执行

用户执行`network-adapters-final-06GWXZ`后，原root日志`network-adapters-commands.jsonl`及受保护verifier已创建，第一次库存核查的runuser在45秒ETIMEDOUT；失败位置在停socket、写候选和更换P之前。普通权限核原P摘要仍为`1589129705ad27d293085d7a11ab17b764258021075f7492ef2d485aeccc221a`、inode125044032，无本轮backup／staged／通过标记。没有重跑旧包或删除原日志。

`~/.cache/scholoom-report-system-service/inventory-timeout-brhufi/phases.jsonl`的只读真实K诊断：库存943ms完成，active／waiting为0；原控制关闭ACK在48447ms才返回，进程正常退出。源代码核实C会串行核历史stopped对象的OS后清理，close等待原队列及记录锁释放；不能以库存零占用跳过。旧root外层45秒与实际open／close各75秒契约冲突。`inventory-green-FB2Ls2/result.json`随后用相同已安装verifier和同源外层170秒预算，实际49083ms退出0，完整库存及关闭均通过。这是已安装K/C/M的只读核查，不是新P部署或隔离验收。

`repair.mjs`现从同源协议导出库存170秒、bootstrap320秒、两例隔离640秒的外层总预算，覆盖相应阶段与进程开销；普通系统小命令仍45秒。`generic-recovery.mjs`的inventory／close等待也按各自75秒契约核，不改变原30秒页面观察、停止回执、容量或生产期限。新的`--resume-before-replace`只允许network-adapters：原程序／service／配置及凭据仍须匹配，backup／staged／更新计划／通过标记均须缺失；root再核原日志仅含成功getent、成功启动固定socket和首个固定verifier ETIMEDOUT，且已安装verifier字节匹配。保留原日志，独占新增resume日志，不重复写verifier；只能从新的只读库存／关闭确认继续，不重放旧报告执行。

最终续执行包`~/.cache/scholoom-report-system-service/network-adapters-resume-TO1XMX`保留源码和esbuild元数据，root入口内联实际协议及resume检查。P、原库存verifier、初始恢复verifier与原包一致；隔离verifier仅同步关闭期限。七项离线检查中普通计划通过，普通UID apply／resume与错误purpose／配置／旧程序／凭据均拒绝；`check-repair-resume.mjs`核合法前置和六种危险或不符历史拒绝。四份相关夹具Biome、语法和diff检查通过。原root日志为600，父未读取其正文；续执行时由root现场严格核查，不以用户错误堆栈代替该核查。

gpt-6.1-sol/high独立复核期限、前置状态、原日志允许序列、resume保留证据、未知效果拒绝及冻结包／源码／元数据，重算四份payload摘要匹配，无确证P1/P2；该审查同样未读取原root日志或运行管理员续执行。strict规格检查通过，进度仍24/27。

按用户选择的手动sudo流程，当前唯一待执行入口是：

```sh
report_update=/home/joshua/.cache/scholoom-report-system-service/network-adapters-resume-TO1XMX
sudo /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/node "$report_update/repair.mjs" "$report_update/repair.json" --resume-before-replace
```

命令会在重新取得完整库存及close ACK后继续原更换P和四项系统验收，原日志和失败包保持；耗时可达数分钟。任一身份、历史、效果或停止未知仍拒绝并留现场；新程序未部署前保持24/27。历史清理重复成本已定位，每次连接仍会复查已停止历史；本轮仅修验收期限冲突，未新增清理完成事实或放宽原范围核查。若历史量使生产75秒也不足，须另行优化真实已清净路径并验证，不能继续抬高生产期限。

| 本轮实际验证 | 结果与边界 |
| --- | --- |
| 真实产品主路径 | `~/.cache/scholoom-report-product/run-x3sZ9v`：Browser／Electron各1条，共2/2，4.4分钟，无跳过／flaky；真实安装P、来源、共同composer、worker保存、自动更新、R1保护、显式R2、准确R1重开、新会话取材及来源撤权。只替模型HTTP边界；该轮在最后回执撤权修复前运行 |
| 选择／容量 | `run-kaBe65`：双宿主2/2、1.4分钟；同一objectId换R2后原R1摘录／basis保持，实际声明且加载20对象，20项、合并超过16项及未知对象由本次桥回执确认整批拒绝，原草稿不变且无执行 |
| 普通关窗／接续 | `run-484AJo`：双宿主2/2、2.8分钟；真实普通内核的已受理无模型注册图在关窗后发布并落checkpoint等待，重开实际P ready不消费等待，用户共同composer确认后同一run／wait／instruction接续并保存continuation。首启经research.requestGraph RPC，确认经UI；不外推科研质量 |
| 所属执行收尾 | 上述三轮`kernel-stop.json`均实际stopped，非停止请求或超时推断；lifecycle自有普通内核退出0，原身份与保存／等待事实可从各自lifecycle.json核对 |
| 公共保存与历史 | `~/.cache/scholoom-report-post-install/auth-final.log`30/30、1.5分钟；真实Manual／worker及文件仓储，覆盖条件保存／undo、撤权、改名HTML、发布后撤权不交正文且结果outcomeUnknown、实际文件和历史保持已完成效果。此前25/28的两项旧unavailable预期已改为实际permissionDenied，另一个改名保护退化已修并复验，不改判原失败 |
| 普通内核机械恢复 | 同目录`reconnection-final.log`2/2、52.9秒；实际serveKernel发现／锁、registered等待、断连重连重启和撤权，无产品UI；与上面的真实关窗用例互补 |
| Browser宿主生命周期 | `bootstrap-final.log`2/2、20.7秒；隔离HTTP入口及真实普通内核，显式普通模式不托管，默认开发模式继续拒绝普通实例，两者关宿主后原PID／instanceId仍保持。共用回环鉴权和私有目录保护不变 |
| 程序能力回归 | `network-contract.log`4/4，独立子进程复现并修复Node EventTarget与WorkerDOM Event冲突；未支持的WebSocket／EventSource／BroadcastChannel构造可捕获unavailable，批准文件fetch、本地事件、MessageChannel和AbortController仍可用。此结果不是新P的OS安装验证 |
| 类型与结构 | 本轮kernel、desktop、tools类型通过；相关18文件Biome无错误；架构14模块304文件0 findings、契约生成器self-test、strict规格及diff检查通过。日志沿post-install cache；未加无关全仓测试 |

gpt-6.1-sol/high独立审查确证发布前授权无法保护发布后异步窗口的回执；现公开save／undo在写入完成后、结果交付前同步复核，撤权时不返回历史正文，明确保留已写效果和核查提示。参数化两例及原改名／撤权回归通过，独立复核无确证P1/P2。对selection／lifecycle源码及三轮通过证据的独审无阻碍关闭三个整合行为的实质缺口；对新固定root更新包的独审无确证阻塞，未代替实际部署验证。

### 原网络通道适配包（已在替换前失败，保留依据）

当前安装仍为初始恢复版P。最终程序包在`~/.cache/scholoom-report-system-service/network-adapters-final-06GWXZ`冻结，旧摘要`1589129705ad27d293085d7a11ab17b764258021075f7492ef2d485aeccc221a`，新摘要`09e676339298fd1ceb41d7e792b7eee50765a9a894d0984f5ac01735d3fd1dd3`。`review.json`／`repair.json`绑定原安装、configId、service、Node、原验收、bootstrap／cleanup／initial-restore凭据及四份payload；父与独审核对冻结源码和摘要一致。`network-adapters-ezZHcf`保留为准备依据，不用于部署；最终包额外在初始化验收close之后、隔离组开始前，复用既有10秒只读观察核原C/M实际退出，避免ACK与系统角色退出间竞争。原安装、配置、service和P均未在本轮被替换。

六项离线检查`offline-check.json`：正常计划退出0；普通UID apply、错误purpose／configId／原程序摘要／initial-restore凭据五项均拒绝，旧P字节保持。新目的仍为固定封闭枚举，root文件名及合法UUID派生范围固定。部署先核原完整库存零占用，再停原socket并等C/M退出；仅换P、原inode另存，保留原系统身份、service、配置及历史。之后依次bootstrap、initial restore及network-rejection／busy-stop四个有界正常／隔离场景，均核实际停止与容量归零，全部成功才写network-adapters-passed。首败保留证据，不自动回滚或重试。

```sh
report_update=/home/joshua/.cache/scholoom-report-system-service/network-adapters-final-06GWXZ
sudo /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/node "$report_update/repair.mjs" "$report_update/repair.json" --apply
```

上面的原`--apply`已执行且失败，不再使用；续执行沿本节前面的专用入口。接回结果先核原身份、四个场景的持久停止／容量与新标记，再用新P运行受影响产品路径和最终接收，随后判断剩余三项及归档；当前不宣称完整change已完成。

用户已手动完成`initial-restore-DFX8Hc`，原安装与configId保持。受保护的`initial-restore-passed.json`为accepted；已安装program摘要为`1589129705ad27d293085d7a11ab17b764258021075f7492ef2d485aeccc221a`，service仍为`de7b0edacc531ef11f6dfe44acfe301a6b6846d5c2802581827ee923208fc761`。普通bootstrap的`acceptance-gv4B9Z`与初始化恢复的`acceptance-JhUNUi`均通过，原实例分别为`0cb9416f-a3fb-45fd-bb72-68d6fdb80bd7`、`68fdadac-9ad6-421a-ace9-5acccc0bd69f`，均持久stopped／stopConfirmed且容量归零；后一轮恢复输出消费先于ready。证据均在`~/.cache/scholoom-report-system-service/`。本轮不重复执行原更新包，其独占标记和原inode备份已存在。此结果是系统初始化链，不能代替完整产品I5。

产品后续`run-RA5uo2`复现旧实例约12秒才停止，确认10秒夹具不足以覆盖同源reportControl.close的75秒等待。`tests/kernel-fixture.ts`现仅在实际配置报告安装时使用该75秒加原生命周期10秒，普通配置仍10秒；必须观察原实例实际stopped，继任实例与超时仍拒绝，不杀进程。model-kernel与product teardown复用该等待并保留原身份和原始停止回执。`~/.cache/scholoom-report-post-install/model-shutdown.log`4/4通过。未增加生产期限。

`run-xWazL7`已走过真实worker保存R2、原版恢复、新会话接续，随后clean-report更新因缺读租约被拒；`run-nxUcTh`错误使用describe的资源版本，同样被正确拒绝。`run-MIV78c`改为真实files.read租约后，暴露公共files.save的旧报告历史guard仍永久unavailable。当前修复复用reportHistoryAuthorization核旧来源，保存临界区核原正文及Evidence，并在发布前同步复核；undo核原历史及当前路径。原公开保存与撤销保护测试继续覆盖，完整回归和独审结果待下文更新。不将这些失败或中途已完成行为记录为整轮通过。

通用P新增网络拒绝／忙循环停止补验入口`generic-recovery.mjs <installed.json> --isolation`。首次`generic-recovery-8rqOim`在网络用例失败：Node WebSocket的ErrorEvent与WorkerDOM全局Event不兼容；自有网络trap为0连接，但P输出error，不能判通过。失败最终K本地active=1，原channel关闭后未继续重放；实际scope已不活动，须通过原持久库存核查后再验，不能仅据scope退出释放容量。程序适配修复及新系统部署仍待完成。

## 初始化恢复修复（2026-11-02，前次交接依据）

用户明确选择不配置免密sudo，由本人手动执行必要的管理员操作；本轮未修改sudoers。仍为21/27，2.1b／2.2／3.1／3.2／4.1／4.2保持开放，以下源码、模块和离线通过不代替已安装产品的完整结果。

初始化恢复现沿design首节：start只标记`restorePending:true`，实际状态仍走独立原restore封套；源先排空初始输出，再调用恢复监听并排空恢复输出，最后ready。runtime在OS open前核状态并串行排入两个命令，ReportView不在ready后追发初始恢复。presentation继续在ready前隐藏原生正文／控件；有初始状态时，ReportView在ready前不将页面初始化state写回存储。无草稿换版的browse、原准确版本、旧动作和草稿保护仍沿原module。runtime队列为一个完整初始化消息与presentation原发送窗口分别留出字节预算，单消息与presentation窗口上限保持原值。

原默认初始化state确能清除恢复保护并误自动切到R2：`~/.cache/scholoom-report-initialization/default-state-red`实际1/1失败，补guard后相关回归通过。协议新增字段的`contracts-red`实际1/3失败，`contracts-green`3/3通过。独立gpt-6.1-sol/high窄审发现合法近上限restore与start共用64KiB队列导致resourceLimit；扩展原用例在`queue-red`实际1/1失败，按独立消息窗口修复后受影响组合`queue-green.log`15/15、19.1秒，无失败／跳过，独立复核关闭该P2、未发现确证新P1/P2。root替换／验收路径静态窄审未发现其他确证P1/P2；审查没有部署或连接系统。

| 实际检查 | 结果与边界 |
| --- | --- |
| runtime／view／program契约及model-kernel夹具 | `~/.cache/scholoom-report-initialization/final-kernel.log`21/21、1.1分钟；其后容量修复的受影响组合另15/15，不累加。真实浏览器／模块，KernelClient、来源与程序输出仍为替身；model-kernel用真实子进程及回环模型，不是安装报告I5 |
| 真实源程序至双宿主DOM | `~/.cache/scholoom-report-dom/program-oCFLsj`2/2，沿真实普通Node program factory、独立restore、帧消费及ready核原textarea状态，再测原生输入／textarea／JS／MathML；自己的子进程正常退出。此前`program-vDxSNA`为初修2/2，后加初始输出先排空后使用末次结果。无OS隔离、真实来源授权或完整产品 |
| 类型、格式、构建 | tools与desktop类型检查通过；相关源码及夹具Biome通过。`desktop-queue-build.log`末次正式desktop构建退出0，renderer90秒；前一`desktop-build.log`在容量修复前，不当作末次代码证据。文件均在上述initialization cache |
| 结构与规格 | 架构14模块304文件0 findings，契约生成器self-test、OpenSpec strict及diff检查通过；未以无关全仓测试或增加产品期限替代验收 |

停机调查确认旧previous-stop-check只等10秒，而报告控制关闭有其独立较长契约；旧现场两宿主在测试失败约1.7秒后记录锁释放，但缺少具体关闭等待点，不能据此直接归因于历史清理。`tests/model-kernel.ts`现保存原实例／PID、请求及受理时间、deadline与末次安全inspect摘要，不记录token、URL或正文，未改变等待期限。普通用户诊断保留在`~/.cache/scholoom-report-initialization/shutdown-SVuMx5`：首次Node原生导入未解析测试的.js→.ts路径，尚未启动服务；限定测试目录的临时解析hook后，原安装两个socket已inactive且/run端点不存在，boot在recovering-report-executions失败，最终stopped。该失败不是原停机竞争复现，亦不运行完整产品重试；这些cache文件只留调查依据。

### 已执行的固定程序更新

最终包为`~/.cache/scholoom-report-system-service/initial-restore-DFX8Hc`，使用repo的repair/layout、编译的原库存verifier、新初始化恢复verifier及当前program；三项payload摘要和源副本已经父与独审核对。`initial-restore-udGUym`只是准备中间快照，不用于后续运行；最终包不依赖它。目标仍为原installation `ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf`／configId `57483aa5-e58b-4515-88f7-0176eea39fe6`。旧program摘要`37168e29225c5da7c06491a09723ca4b1d157f73a54f093ca744f7de487e15e8`，新`1589129705ad27d293085d7a11ab17b764258021075f7492ef2d485aeccc221a`。

离线`offline-check.json`中正常计划退出0；普通UID apply、错误配置、原程序摘要、cleanup凭据摘要及purpose五项均拒绝。原program未变化、未生成新root标记或启动socket。root apply会启动原两个固定端点，由K核完整库存0占用后关闭socket并等待原C/M退出，只替换受保护的program.bin并保留原inode；service、Node、配置、账户、记录、单元及既有凭据不变，不enable。先运行原通用bootstrap，再跑新受保护入口的`--initial-restore`，核恢复state、实际恢复帧及consume先于ready、选择发生在ready之后，最终确认停止和零容量。全部成功才写initial-restore-passed；失败保留现场，不重试或自动回滚。

```sh
report_update=/home/joshua/.cache/scholoom-report-system-service/initial-restore-DFX8Hc
sudo /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/node "$report_update/repair.mjs" "$report_update/repair.json" --apply
```

本机sudo认证由用户完成，必要部署授权沿此前确认，不重复询问业务许可。接回实际结果后先核原身份、初始恢复凭证、持久停止／零容量及角色退出，再运行原`report-product/run.mjs <原installed.json>`；用新增previousStop诊断核内核替换，继续完整I5、关窗／等待及剩余系统与产品范围。尚未部署本包、运行新代码的完整产品、提交、推送或归档。

## 原通用安装修复已验收（2026-11-02，最新接续）

用户已完成原`cleanup-repair-A1M8Z9`，本机认证前置解除。父核原安装`ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf`及configId `57483aa5-e58b-4515-88f7-0176eea39fe6`未换，`cleanup-repair-passed.json`为accepted，原`service.mjs`摘要已为`de7b0edacc531ef11f6dfe44acfe301a6b6846d5c2802581827ee923208fc761`。`~/.cache/scholoom-report-system-service/acceptance-NNzNsI/result.json`记实际通用P运行后，原实例`b8a86bcf-10e6-47a1-8d6b-f56fac859e11`最终stopped／stopConfirmed=true／gateReleased=true、无failure，admission active=0／waiting=0。该结果仅接收修复后真实K/C/M通用bootstrap，不含UI或完整I5；仍为21/27，六个完整任务保持开放。

正式双宿主产品runner已用普通K账户连接同一安装，`~/.cache/scholoom-report-product/run-BU9O8l`两宿主均完成筛选／排序／展开、共同composer发送、真实worker编辑保存R2、成果及修改记录、草稿保护及准确R1恢复；Browser还完成新会话的原对象／来源接续。整轮仍失败：Browser在新clean-report的筛选断言失败，Electron在新会话附加对象等待失败，不按局部通过关闭任务。所属内核最终stopped，原C/M无活动角色，证据保留。

随后串行运行`generic-recovery.mjs`，`~/.cache/scholoom-report-system-service/generic-recovery-rQ3wj6`四例均accepted：显式停止、K撤权本地拒绝后显式停止、断连完整库存恢复、stop结果及release通知同时丢失后恢复。四个原实例均最终stopped／stopConfirmed=true／gateReleased=true、active=0／waiting=0、closeFailures为空；两恢复例保留原实例身份，未重放prepare／start／stop。该链使用真实安装K/C/M/P，但HTML无来源、K授权为替身，无UI，不代替完整I5。

原Browser trace确认新文档已显示而源尚未ready，输入使presentation以unavailable暂停。生产presentation现等匹配的源ready后才显示正文和控件；在此之前仍消费初始帧，不阻塞源启动。新增双宿主可见性回归在`~/.cache/scholoom-report-dom/run-Nqb25a`实际失败2/2；修复后`run-kvK1i9`连原presentation／owned DOM／JPEG字体共16/16、64.4秒，无失败／跳过／flaky。原send／receipt和授权仍为替身，不能据此把Electron恢复失败判为同根因。editor类型及相关Biome检查通过（原non-null lint warning保留）。

`~/.cache/scholoom-report-distribution/desktop-source-ready-build.log`正式desktop构建退出0，renderer构建95秒。随后`~/.cache/scholoom-report-product/run-GcAuPZ`双宿主均在`startModelKernel`的previous-stop-check失败，尚未运行报告，原teardown保存unreachable／锁仍持有／原进程活跃，不能改判产品通过。后续普通CLI只读status及stop均返回stopped，原PID 497803已不存在；未杀进程、删除配置或覆写失败凭据。后续需先核测试内核替换的原身份及停机时序，再沿原用例验证本片修复。

gpt-6.1-sol/high独立窄审未发现此次隐藏会阻塞初始consume，错代和关闭后的消息仍被过滤；另确证尚未修复的恢复期竞争：source ready立即显示正文，而ReportView仅将restore排入队列；用户在恢复帧落地前聚焦空控件，后来的原非空草稿写入会触发report-dom的聚焦值保护并失败。最小复现应在presentation夹具依次注入initial／ready、聚焦input、注入不同value的恢复帧；此项是代码核查，尚未动态复现，不据此判定原Electron故障根因或放宽焦点／输入保护。下一步先明确源恢复完成与呈现开放之间的同步依据，保留通用HTML／JS及原草稿契约。没有修改sudoers或安装免密入口，工作区未提交或归档。

## 真实读屏模块对照（2026-11-02）

本节读屏验证时仍为21/27，六项完整任务保持开放。当时尚未部署cleanup修复，没有更换原安装、运行旧C的完整产品用例或将模块通过计作I5；最新系统修复结果见上节。

真实读屏无需等待系统安装：在已有必要依赖授权内，将21个官方Ubuntu包、16.058MiB解到`~/.cache/scholoom-report-reader-2mmb3YLB`，未执行安装脚本或改系统。Orca50.3、Dispatcher0.12.1、eSpeak NG1.52.0的版本／帮助、实际模块和语音枚举及null合成通过；入口、来源和环境沿其launch.json／README。初次预检错误及私有HOME环境保留，后续保留原HOME，以XDG及memory GSettings隔离。未写自有Python辅助或改上游代码。

父通过私有Xvfb／session及AT-SPI bus，在真实Orca中比较独立原生HTML与生产Workbench／presentation。Browser的`sr-ZiAmZz`中两个Browser部分通过，原整轮在后续Electron的夹具加载播报等待失败，仍exit1；修正该非契约等待后，`sr-59ivbK`中Electron两部分均通过、exit0。两宿主都核真实输入名／值、正文、表格、图像标签及math／math-fraction角色，交给真实eSpeak模块的文本和speaking／begin响应可查。原生和呈现均保留相同namespace／mfrac／x／2；公式连续语音同为`italic x`、`2`，不额外承诺读屏器会说出分数线。父核两轮生产源副本与当前代码相同并目视检查截图；准确接收、原轮失败及边界见`~/.cache/scholoom-report-dom/sr-59ivbK/REPORT.md`和accepted-comparison.json，不把两轮合写成一次全绿。

上述原生对照显式开启renderer accessibility；去掉该开关的`sr-cVW1Si`中，两宿主仍取得真实字段、正文／表格和数学角色，证明本次环境的自动激活成立。其后置精确语音序列比较受Browser延迟加载重复播报干扰，原整轮exit1保持，不记为语音顺序／稳定性通过。本次据真实原生对照核辅助语义，不把某种朗读顺序或普通日志文案新增成产品契约。

所有读屏结果仅覆盖Linux X11／C.UTF-8及固定代表。ALSA null丢弃音频，没有可听体验评价；StartOfFile／SayAll使用Orca官方控制接口，未注入应读文本。源ready／帧、来源／身份／session仍为替身，无P/K/C/M或真实报告权限，完整产品接线及I5继续开放。每个接收的reader均正常exit0；54／33个自有进程全部absent。八轮保留的夹具失败及全进程starttime复核见同目录all-experiments-process-audit.json，均无原自有活进程；不将首轮203秒watchdog收尾当作产品停止凭据。所有临时工件保留为验证依据，无生产依赖。

本节仅补限定验收和交付事实，未改产品源码、安装系统依赖、调用模型、启动开发服务器、提交、推送或归档。修复已由用户完成，正式report-product与generic-recovery四例接续见上节；随后在真实产品路径继续默认辅助体验、等待／关窗及剩余故障范围。先前apt安装命令已不是读屏模块验证的前置。

## 连续换版修复、系统IME与分发补验（2026-11-01，最新接续）

仍为21/27，六个完整任务不勾选。原`cleanup-repair-A1M8Z9`仍等待本机sudo认证；本轮只读核对未发现原安装的cleanup-repair-passed凭证，没有更换安装、改写冻结包或重复依赖旧C的完整I5。

补验发现ReportView自动换版未传递browse。首个固定回归在`~/.cache/scholoom-report-distribution/browse-red`实际失败；初修19/19后，独立gpt-6.1-sol/high窄审发现连续v1→v2→v3、源不回发state时第二次丢失browse，以及中间版未ready时再次更新的竞争。扩展同一回归在`browse-repeat-red`和`browse-unready-red`分别实际失败。现仅在有效视图保留有界browse候选，选定新绑定恢复候选时即保留，不等待ready；源state可更新。无页面草稿换版才交新绑定，准确新版自身存储优先，stopPage清空。旧draft不传递、原版和新版存储不改写。最终`browse-handoff-final`的view／updates／drafts共20/20、15.7秒；三个红回归及中间结果保持。独立复核关闭两项P2，无新增确证P1/P2，内存probe边界明确。完整restore封套继续核原容量，未增加新持久权威或改同步取消例外。

正式`report-product`同一用例补无草稿的筛选／排序／展开状态自动换版，以及真实库read／send撤权后移除文档、拒绝报告读取、保留共同正文与显式项且不增加模型请求。tools类型和两宿主发现通过，新增产品段尚未实际运行，待原系统修复部署后沿同一runner验收，不把模块结果当产品通过。

| 验证 | 实际结果及边界 |
| --- | --- |
| Linux系统IME | `~/.cache/scholoom-report-dom/ime-1538/REPORT.md`及summary：Browser／Electron各一次，真实fcitx5拼音候选、XTEST输入、space提交／Escape取消，均保持原节点、焦点及[7,7]选区。生产presentation的sequence2／3在组合中及仅收到早期ACK时不消费，实际结束及后续ACK后才应用。父目视核对候选和结束截图；两宿主实际compositionend.isTrusted=false照原值处理。ready、wire帧及40条inputConfirmed／宿主为替身，不是实际P或完整I5。38个自有进程最终均absent，fcitx退出0；不触共享:99。前轮普通控件校准及窗口／观察器首败留在ime-1531和更早目录，不改判 |
| 普通预览回归 | `~/.cache/scholoom-report-product/preview-hv2Xsy/preview.log`：HTML／PDF各双宿主共4/4、1.8分钟。实际普通内核及静态产品、无C配置，外网拒绝；这是本次browse修复前的预览回归，修复只触ReportView |
| 构建及目录包 | `~/.cache/scholoom-report-distribution/build-current.log`全构建退出0；`package-current.log`的desktop-current目录包退出0。包内真实kernel CLI在kernel-cli.log为1/1、33.6秒，只替换外部模型；desktop-smoke.log为实际包sandbox preload／React1/1、15.3秒。后续只改renderer的browse逻辑，末次源码构建desktop-handoff-build.log退出0、92秒；package-handoff.log的desktop-handoff目录包退出0，包内kernel CLI／report-channel／report-program均存在。末次实际包smoke在desktop-handoff-smoke.log为1/1、15.5秒。中间包及结果保留，不当作末次源码证据 |
| 类型、格式及结构 | browse-handoff-tools-types.log、browse-handoff-desktop-types.log退出0；browse-handoff-style.log四份相关源码0 errors。架构14模块304文件0 findings、strict规格及diff检查通过；未增加无关整仓测试 |
| 通用运行后恢复入口 | 新`report-system-service/generic-recovery.mjs`复用真实K和唯一admission，准备显式停止、撤权拒绝后停止、断连完整库存恢复、stop结果与release通知同时丢失后的恢复。每例先actual running／gateReleased／ready，首败即停，不重放原动作。node语法及Biome通过；cache的generic-recovery-offline-uYjAbL保存15项离线入口拒绝检查，其中凭证／身份替身明确，不算系统四例。原C修复前未连接运行 |

Linux读屏器`/usr/bin/orca`、speech-dispatcher及espeak-ng仍缺；apt只读预演需新增20包、不升级或删除，未安装。用户对必要部署与依赖的既有授权有效，但本机交互认证不能由工具代替。已提供原安装修复及读屏器安装的具体sudo命令。下一步核修复凭证、原身份及停止／零容量，再跑完整双宿主产品入口和通用恢复四例，继续实际读屏、等待／关窗及其他未完范围。未调用真实模型、启动开发服务器、提交、推送或归档，所有工件在持久cache，不依赖当前/tmp。

本机认证后执行的原工件入口如下，不重新准备或更换安装身份：

```sh
sudo /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/node /home/joshua/.cache/scholoom-report-system-service/cleanup-repair-A1M8Z9/repair.mjs /home/joshua/.cache/scholoom-report-system-service/cleanup-repair-A1M8Z9/repair.json --apply
sudo apt-get install --no-install-recommends orca speech-dispatcher espeak-ng
```

## 通用系统启动通过与产品验收修复（2026-11-01，最新接续）

当前仍为21/27，六个完整任务保持开放。用户安装的通用包`bundle-xHhY8a`已取得`bootstrap-passed.json`：原installation `ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf`，configId `57483aa5-e58b-4515-88f7-0176eea39fe6`，实例`fab835d8-12c1-464f-8b96-205a13ae4673`。父核对24项root保护的固定文件与原清单一致，实际classic／外部module／inline module、restore后的state及select均正确，最终stopped／stopConfirmed=true、无failure，活动和排队均为0。证据`~/.cache/scholoom-report-system-service/acceptance-fxTJu1/result.json`。这证明真实通用P的系统正常路径，不代替UI／I5。

正式`report-product`已实际运行，但尚未完整通过。`run-pRe1v1`发现Open返回starting后立即交换数据被拒；report-runtime现沿同一绑定等待实际running／gateReleased，失联、失败、关闭及未知结果仍停止原实例且不重放。`runtime-starting`六项回归通过，独立gpt-6.1-sol/high窄审无确证P1/P2。后续`run-48nYxa`仍在内核冷启动失败；`run-Fbq5cg`已越过启动，报告在默认5秒断言结束时仍打开中，夹具改为沿原Open契约等待实际就绪，未改产品期限。

`run-jW0VUq`浏览器已显示报告并完成筛选、排序；展开触发样本每次render移动所有行的问题。样本现仅在实际顺序变化时insertBefore，保持可信呈现的焦点保护；不据此宣称任意聚焦子树移动均支持。`run-dkbgtK`两宿主均走到共同composer发送，真实工具记录确证受控模型用write_file新建已有报告被正确拒绝；夹具改为先read_file再edit_file，另核实际工具state与成果。`run-6NdMcg`再次在冷启动超时，失败均保留。

`run-Y2SbSZ`浏览器实际完成编辑保存R2、成果及修改记录、原R1与composer草稿保护、显式查看R2、准确R1关闭重开和页面状态恢复；最后新会话发送的持久指令缺显式项，用例此前未等待跨进程选择真正进入composer。现补实际“2个附加项”可见后的发送条件，尚未重跑该最终修正。该轮Electron仍在ready-timeout失败；全局收尾曾返回unknown，之后只读复核原配置已stopped，不能改写该轮原失败。新产品teardown保留隔离内核目录、脱敏生命周期和停止结果；共享UI夹具也保存bootstrap诊断，避免只剩泛化错误或删除排查依据。

### 启动开销与确认停止后的清理

测量业务协议导入约2808ms，改为复用Ajv原schema身份缓存按需编译后约512ms；执行协议约1161ms降至455ms。broker预编译全部契约使KernelApplication构造约1497ms，也改为按实际调用编译。参数／结果校验、同源定义、权限、可信context及写入unknown均保留；`lazy-final-contracts`中broker、execution-files及public-contract-baseline共12/12，早先公共／工作域组合10/10分别记录，不混加。三个窄审均无确证P1/P2。普通单次`cold-broker-lfALym`曾running并最终stopped，但后续完整用例仍间歇超时，不能宣称冷启动问题已解决。初次去除broker非空断言引出TS undefined错误，补显式契约缺失拒绝后构建通过；工具类型通过。

曾准备`service-refresh-DIOXfp`候选以核对C/M是否落后，实际新旧service摘要完全相同，故停止该无效路径、没有部署。随后源码确认provider启动仍等待所有已持久停止对象的OS后清理。新增`confirmed-stop housekeeping`回归在旧实现`housekeeping-red`确证ready被清理阻塞；现先恢复全部占用并沿原reconcile处理未确认对象，再将原已确认停止项放入既有per-id队列并全局串行后清理。关闭仍排在清理后、持有原写锁；没有新增记录字段、迁移、容量权威或宽限期限。`housekeeping-green`中原system records／controller及新回归46/46、6.3秒，真实文件／原生flock，OS控制与延迟清理是明确替身。独立gpt-6.1-sol/high审查该队列、停止依据及配套原安装修复无确证P1/P2。

实际待部署的是`~/.cache/scholoom-report-system-service/cleanup-repair-A1M8Z9/repair.json`，purpose=`deferred-cleanup`。原service摘要`314612bede998185c6c44bb725aaad6bf41dab2551352b4636665a5ecb6d9965`，新service摘要`de7b0edacc531ef11f6dfe44acfe301a6b6846d5c2802581827ee923208fc761`；与原安装相比仅含本次initialize修复。复用`repair.mjs`，绑定原安装／配置／bootstrap及文件摘要，验证完整库存无占用后停止原socket并核无活动C/M；只替换服务，保留原inode副本、全部记录／程序／账户／单元，运行一次原通用bootstrap验收，另写cleanup-repair-passed，不改原bootstrap凭证，不自动重跑。默认列计划退出0、普通UID apply在1000!=0拒绝，系统未修改。直接在cache运行打包verifier因尚无同目录原生helper而authenticationFailed，失败保留；使用verify-source沿仓库真实适配器核完整原库存及active=0／waiting=0成功。root入口将verifier部署到原/opt目录再运行，与原capture修复相同。

已向用户提供该原安装修复的具体sudo命令；既有部署授权有效，工具终端的sudo仍要求本机交互认证。接实际结果后先核原停止／容量及修复凭证，再运行同一正式双宿主runner，继续剩余系统故障、撤权、等待／关窗及体验／分发范围。架构14模块304文件0 findings，相关类型、格式、diff通过；本片未运行真实模型、开发服务器、CI、提交、推送或归档，工件不依赖/tmp。该包尚未实际部署，完整I5仍未通过。

## 原Node/data系统校准通过（2026-11-01，最新状态）

用户完成原冻结包`bundle-k82Fl7`的系统安装并提供成功输出。父Agent核对原installation `e4f49466-74b4-4014-a937-de4fde007b07`下16项固定文件：字节摘要与原清单一致，均为root拥有的普通文件且不可由组或其他用户写入。`installation-receipt.json`、`t1-passed.json`及`~/.cache/scholoom-report-system-service/acceptance-lzqvlW/result.json`的configId均为`2443d388-f18c-446c-a5ce-19232c3216fa`；实例`454a0254-cf8d-40f9-b3aa-5effb299ed45`实际到达running／gateReleased，最后为stopped／stopConfirmed=true且无failure，admission active=0、waiting=0。实际响应保留批准字节及`{action:"probe"}`，两个固定系统socket当前均为active/listening。该结果证明固定Node/data的真实K/C/M正常路径，不代表通用HTML／JS或完整I5通过。

当前待安装包仍为已冻结的`bundle-xHhY8a`，目标`/opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf`本轮核对尚不存在；没有改包、改身份或重装原对象。`sudo -n -v`仍返回interactive authentication is required，已向用户给出该包的具体安装命令；这是本机认证等待，用户对必要部署的既有授权继续有效。下列较早章节中的“原Node未安装”只描述各自当时状态。

接通用包的`bootstrap-passed.json`及实际停止／容量证据后，运行`node tests/fixtures/report-product/run.mjs /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/installed.json`。仍为21/27，六项完整任务保持开放；完整Linux双宿主产品路径和系统故障矩阵未运行，不能据本次校准归档。此次仅更新交付事实，未改实现、提交或推送；原安装及失败证据保留。

## 产品I5入口与textarea修复（2026-11-01，当前续做）

仍为21/27，六项完整任务未关闭。新增`tests/fixtures/report-product/`正式产品用例及静态宿主：正常host-settings选择真实安装，未改产品工作台、内核／C/M/P或领域权威；两个宿主串行，外部模型仅用既有回环HTTP受控响应。用例串联真实库来源／项目HTML和依赖、筛选排序展开、原子对象／来源／comment进入共同composer、普通worker保存R2及成果／修改记录、原页与草稿保护、显式更新、准确R1关闭重开、新会话读取原来源接续。只做编译／发现和独立静态宿主预检，因原Node校准尚未安装，完整用例未运行，不以入口准备代替2.2／3.x／I5。

样本程序预检实证source没有textarea类，初始note.value为undefined，桥state的draft.note因非JSON值而被拒，并非容量实际达到上限。新增`editor/report/textarea.mjs`，在原P登记及全局构造器中接入；defaultValue沿子文本，独立dirty value及CR／CRLF→LF、textLength／type保留原生行为。写入沿原property transfer／allowTransfer，不放宽可信呈现白名单或聚焦编辑保护；桥原错误文案明确包含无效消息。固定fork未改，没有新增外部依赖。

此前未安装候选`bundle-zi2kDO`没有textarea修复，保留作当时证据，不再是下一次部署的当前程序包。新冻结包`~/.cache/scholoom-report-system-service/bundle-xHhY8a`，installation `ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf`，含修复后的实际bootstrap；24项文件、默认计划退出0、普通UID安装拒绝退出1，记录同包`offline-report.json`，目标不存在。这是安装前源码更新，不是替换失败的已部署对象。原Node/data包`bundle-k82Fl7`及原installation `e4f49466-74b4-4014-a937-de4fde007b07`保持原样等待本机sudo交互认证，其目标本轮末次仍不存在。

### 实际验证及失败记录

| 检查 | 实际结果与边界 |
| --- | --- |
| textarea独立原生对照 | 新`tests/kernel/report-textarea.spec.ts`，source默认／dirty／换行／空值／null／undefined／textLength与独立Chromium相同；最终连原program契约在`~/.cache/scholoom-report-product/textarea-contract-final`4/4、2.0秒。首次对照误将document作为未传入的evaluate参数，失败保留`textarea-native`，修为在原生页面明确传document后`textarea-native-fixed`1/1；没有放宽预期 |
| 实际source与双宿主DOM | 扩展原`report-program`夹具中的textarea初始文本、真实多行输入、源确认、移焦后恢复CRLF及同一控件身份。`program-2S7XAo`首次2/2失败，恢复时控件仍聚焦，实际帧被已有保护拒绝；保持保护，测试先真实Tab移焦。`~/.cache/scholoom-report-dom/program-jiESqp`最终2/2、57.9秒，无失败／跳过，build／types及所属内核停止通过；普通Node源与实际DOM，非系统隔离或I5 |
| 文献对比样本 | `sample-fixed-HQWSyn`真实program factory通过筛选、排序、展开、note／select及restore，无restore→state循环；文件端口和source事件为替身。原`sample-check-pWFNqI`未打包源码导致模块缺失，随后一次错误CJS构建仍未执行到样本；`sample-bundled-h0gpCK`实际复现textarea undefined，`sample-diagnostic-ZnL6rq`保留原桥值诊断，之后修复通过；未将这些失败抹去 |
| 静态产品宿主 | `server-check-SWXxyy`预检POST漏原bootstrap头且字段错误，被正确拒绝，原服务正常关闭，之后核原内核确已stopped；修正测试请求后`server-fixed-rbWKXn`实际静态页面、同源bootstrap running及缺失文件404通过，服务exit0，等待原内核实际stopped。无报告安装、无UI／模型调用 |
| 正式用例准备及拒绝 | `discovery-x16Sy6`实际发现Browser及Electron两例，未执行；tools／专用program类型及10份相关文件Biome通过。`run-i2zI1P`尝试使用真实原native登记，在生产安装选择处按预期unavailable退出、尚未启动UI，没有退回裸跑。架构14模块304文件0 findings，diff及strict通过 |

原生gpt-6.1-sol/high辅助静态样本及独立textarea窄审；独审实跑1项原生对照，并以小probe核原生同步无回传、恢复有一次规范化value mutation及defaultValue保留，未发现确证P1/P2。源和呈现完整WebAPI、系统IME／读屏及完整P→产品系统链不在这次窄审范围。

工作区未提交、推送、归档或安装依赖，不运行开发服务器／真实模型，不依赖/tmp。原系统对象及所有失败工件保持；cache辅助脚本保留调查证据，无生产依赖。下一步接原Node/data安装结果，核原receipt／实际停止及容量，再安装当前通用包并执行`node tests/fixtures/report-product/run.mjs /opt/scholoom-report-ad38d42c-1e99-44ea-b1d3-2b41e8f4cfcf/installed.json`，其后按原六项完整范围继续系统故障／正常boot与完整I5，不收窄或提前归档。

## 通用P安装包与末次静态核对（2026-11-01，当前续做）

仍为21/27，六项完整任务保持开放。原native成功回执已核对，原Node/data冻结包`bundle-k82Fl7`的目标仍不存在；本机sudo要求交互认证。用户已授权必要部署，不需要新增业务批准，但不能绕过本机认证。此前给出的该原包安装命令保持，旧包／原失败／unknown及已安装native对象均未更改。

扩展原`report-system-service`准备／安装／验收入口：`--report`打包正式editor bootstrap，相同八目标Node运行时闭包，以及8份许可／来源工件。`layout.mjs::reportRegistration`成为离线review和实际安装登记的同一事实源，固定为`scholoom-interactive-report@1`、`linux-x64-node-v1`；不让工作台选择程序或系统路径。通用P沿原配额并采用8小时PID1最长运行时间，校准仍20秒。安装后的K使用合成HTML／显式依赖，经真实原C/M做start、逐帧consume、ready、restore及实际state/select，再显式停止；原持久停止和容量归零后才写`bootstrap-passed.json`。它不含实际UI、来源领域授权或完整I5。

当前正式包为`~/.cache/scholoom-report-system-service/bundle-zi2kDO`，installation `d141c0e8-bece-4474-8e91-3c1f234fcdcc`。24项文件冻结，`offline-report.json`记录默认列计划退出0、普通UID安装拒绝退出1，实际review／安装登记一致，目标尚不存在。该包未安装；先核对原Node/data校准实际结果，再部署此包并沿正常boot接正式ReportView，不能跳过系统策略合并验收。未修改已冻结包或为了通过换身份重试。

### 实际检查与审查

| 检查 | 实际结果与范围 |
| --- | --- |
| 最终产品包 | `desktop-budget-final-build.log`确认electron-vite成功，renderer阶段95秒，含末次DOM展开预算和原生input反射防护；未为后续安装夹具改动重复构建产品 |
| 类型／格式 | `final-tools-confirmed.log`及`final-desktop-confirmed.log`对应tools与实际`apps/desktop/tsconfig.json`均退出0。最初误用不存在的tsconfig.web.json已保留失败输出说明，随后改正确入口；受影响生产文件Biome为0 errors、有既有非空断言warnings，5份安装夹具Biome为0 errors |
| 离线安装及unit语法 | `node --test tests/fixtures/report-system-service/check.mjs tests/fixtures/report-system-service/unit-check.mjs`在`generic-offline-final.log`9/9，13.6秒；native／node／report文件闭包、普通UID拒绝和真实systemd解析（启动命令为明确替身）通过。登记抽取后相关`check.mjs`在`generic-registration-check.log`4/4、12.7秒；不相加当一次13项或系统实跑 |
| 原采证回归 | `node --experimental-test-module-mocks --test tests/fixtures/report-system-service/os-check.mjs`在`generic-os-regression.log`1/1、0.4秒；UID／文件／命令边界是替身，不属于真实采证 |
| 架构／规格／diff | 架构仍14模块304文件0 findings；末次strict因原Requirement新增内容合并后过长先告警，现按资源、产品视图生命周期及呈现计量拆分，不改变行为，strict通过。diff及安装脚本语法通过 |

原生gpt-6.1-sol/high只读核对安装改动、同源登记、真实bootstrap字节／闭包、普通UID拒绝及consume／ready顺序，未发现确证P1/P2；核对的较早离线包为`bundle-CJ2nT1`，后续正式包独立冻结，不能把静态审查写成系统安装通过。另一普通UID bwrap bootstrap检查已经实际取得三类JS结果及state/select，但首轮附加“环境必须空”断言误拒bwrap保留的PWD，失败在`~/.cache/scholoom-report-bootstrap-check/run-AaS9OsP1`，按失败路径SIGKILL自身子进程；不算整次通过，后续仅修测试期望为允许PWD再复核。

修正辅助期望后的单次复核在`~/.cache/scholoom-report-bootstrap-check/run-woTFnZuk`通过，599ms；普通UID/EUID1000、精确八目标只读运行时、环境仅PWD=/resources，正式bootstrap完成start→consume×4→ready→restore→state/select，classic／外部相对ESM／inline module均核实际DOM结果。stdin.end后bwrap／报告及runner退出0、signal=null，未kill。父核对该实际测试程序摘要与正式冻结包program.bin一致；首败保留。本片未施加系统seccomp或跨账户PID1控制，不能外推真实系统策略通过。

JPEG／字体代表由辅助Agent仅修改`report-dom/probe.spec.ts`及`frames.ts`，沿生产assets／presentation加载独立ImageMagick编码的160B、1×1 JPEG及已有KaTeX Main WOFF2。批准后原buffer置零，原Blob字节仍完整；实际`image.decode()`尺寸1×1，字体经CSS的`FontFace.loaded`及document.fonts核可用，两宿主网络请求零。本地Blob请求独立观察，不视为网络。`node tests/fixtures/report-dom/run.mjs --grep 'frozen JPEG and KaTeX font'`在`~/.cache/scholoom-report-dom/run-MSErfr`双宿主2/2、42.0秒，build／types／behaviors均退出0，无失败／跳过／重试；首次Biome两处长行格式已用patch修正。父复核源码、结果和专用类型，均通过；资源／权限和程序帧为固定替身，不是实际P或I5。README同步真实解码范围；普通bwrap辅助脚本保留在cache作调查证据，无生产依赖。

JPEG夹具将本地Blob与网络请求分开记录，父据此复验受影响的拒绝路径：`SCHOOLOOM_REPORT_DOM_ATTACK=resource-url,navigation-url,script-element node tests/fixtures/report-dom/run.mjs --grep 'parameterized hostile frames'`在`~/.cache/scholoom-report-dom/run-rocTLk`双宿主2/2、39.8秒，无失败／跳过，原文档及sequence保持、没有外发或脚本执行；build／types均退出0。末次tools类型、局部Biome、diff及OpenSpec strict通过；未重复未变整矩阵。

未提交、推送、归档、安装依赖或调用外部模型，不依赖/tmp。当前唯一安装前外部等待为原Node包的sudo交互认证；真实bootstrap及JPEG／字体代表均已补完，但不能替代通用P的跨账户、正常boot、完整文献对比／共同composer／保存更新／原版重开及故障矩阵。接原Node安装结果后继续同一正式包部署及完整Linux双宿主验收。

## 产品K、正式报告视图与草稿组合（2026-11-01，当前续做）

仍为21/27，2.1b、2.2、3.1、3.2、4.1、4.2保持开放。新增公共视图操作及正常boot的受保护安装选择，ReportViews复用唯一ProcessAdmission／原ReportControlClient，经实际工作台连接管理同次freeze、分片、交换和停止。重复open不重启且每次重核授权，返回克隆后的原快照；跨连接或不含工作台身份的调用拒绝。Read不改读当前路径，历史freeze复用原FileEdit位置／字节和完整来源核查。C失败不释放未知容量，关闭失败路径等待实际已受理读取，继续清理其他模块并汇总错误。

ResourceDescriptor的可选`report:true`只表示内容完整核查，不承诺执行可用。ResourceView现接正式ReportView、共同源码编辑器、composer、原report-client／updates／context及准确版本drafts；report-runtime通过公共端口接实际presentation／CSS资源Module，同一连接串行exchange，不在renderer运行报告代码。原草稿按本窗口／配置／入口的32项有界准确版本索引找回，不扫描项目或全库、不自动驱逐。新版本失败时仅在原版本重新完整获准后保留原页；copyOnly草稿独立按原身份复核，通知／失联先隐藏，旧批准不能恢复展示。普通草稿更新保持接收者回调身份，换接收者仍令旧回调失效。

正常boot沿原host-settings接受`reports.installationFile`，K与C/M入口共用严格root保护的文件读取；只采纳本账户的`scholoom-interactive-report@1`、Node profile和派生固定控制端点。该正式登记尚未部署。现有native安装与用户提供的成功回执吻合：configId为`dda5d6ea-ec63-4f09-87e4-30437d6f8ccd`，成功实例`43e355ae-6298-4b91-b7f6-d0427fea18bf`；原失败和unknown现场保持。新Node校准包`bundle-k82Fl7`的installation `e4f49466-74b4-4014-a937-de4fde007b07`仍未安装，`sudo -n -v`返回需要交互认证。它是固定Node/data oracle，也不能代替正式通用P。

### 实际验证及边界

| 检查 | 实际结果与证据 |
| --- | --- |
| K／控制／呈现组合 | `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-views.spec.ts tests/kernel/report-control.spec.ts tests/kernel/report-control-binding.spec.ts tests/kernel/report-runtime.spec.ts --workers=1 --output ~/.cache/scholoom-report-views/control-final --reporter line`：27/27、39.5秒。真实Manual、项目／库／历史、K/C RPC、记录／锁与准备收尾；OS controller为替身。runtime的实际Browser DOM／输入／CSS使用明确公共client和固定帧替身，不是实际P或完整I5 |
| 草稿／更新／安装读取 | 同一CLI沿`report-runtime.spec.ts report-updates.spec.ts report-drafts.spec.ts report-installation.spec.ts`：21/21、8.6秒，输出`rendering-final`。核有界版本索引、原批准快照、完整封套、内存降级、固定CSS分片、unknown不重放和root文件拒绝。root读取正样本为`realpath('/etc/os-release')`，不证明实际通用安装config或其端点可用 |
| 历史／资源 | `report-resources.spec.ts`在`resources-fixed`：39/39、3.6秒。另`report-production.spec.ts --grep 'Manual report'`在`production-final`：1/1、15.4秒，核实际保存、来源权限和替换拒绝。早先`integrated`的24/24、1.7分钟包含既有受控模型边界，只作当时源码范围，不与后续组合相加 |
| 真实client与共同贡献 | `report-client.spec.ts context-contributions.spec.ts`在`ui-review-fixed`：11/11、39.1秒。真实库／项目／WebSocket／订阅与实际business hook，核当前变普通HTML仍可保留获准原版、原来源撤权后隐藏、同接收者回调稳定及往返旧回调拒绝。日志中的synthetic observer failure是既有预期注入 |
| 正式ReportView的Browser组合 | 作者`~/.cache/scholoom-report-view/author`2/2，追加copy隐私后`copy-privacy`3/3；实际组件／更新／草稿／presentation／对象消费者，client、来源资格和程序输出为替身，共同附加端记录实际原子批次。核dirty原版、新版、原对象／来源／评论、关闭原绑定、新绑定ready后准确restore、撤权／断连隐藏copy且存储不改。父后续汇合复跑见下文；不替代真实composer→harness→P的完整I5 |
| 产品双宿主无安装入口 | `~/.cache/scholoom-report-view-ui/run-2eJkic`：2/2、59.1秒，无失败／跳过，真实Browser及Electron使用静态产品产物、真实内核和文件。核报告明确unavailable、不创建活动文档、源码可看、工作台没有执行源脚本。其后有UI审查修复及冻结路径监听完善，最终重建和新隔离目录复验另记，不覆盖原证据 |
| 构建／静态 | protocol、editor、kernel构建及desktop／tools类型通过；真实electron-vite第一次90秒，审查修复后的最终重建92秒，日志`~/.cache/scholoom-report-views/desktop-final-build.log`。架构14模块304文件0 findings，生成器自检、diff及OpenSpec strict通过；最终格式检查和汇合类型结果继续核对。原共享矩阵没有因无关文档重跑 |

首次6项K视图测试5通过1失败，双重停止来自本片和原signal监听分别发stop，现由视图独占发送责任。随后扩展54组合47通过7失败，均由历史重构把完整descriptor传给Evidence授权端口引起；恢复最小`{ref,basis}`后39项资源测试通过，没有放宽测试预期。28组合27通过1失败为旧测试锁定一次localStorage尝试，而版本索引需要第二次；改为核实际尝试、通知和原状态保留，后续21组合全通过。安装读取首轮误将本机多硬链接的`/usr/bin/env`视为合格正样本，原严格拒绝正确；换成真正root保护、单链接的系统文件后2/2。上述失败目录均保留。

### 独立审查与未完成事项

末次产品重建后，`~/.cache/scholoom-report-view-ui/run-ymEeKj`真实Browser／Electron再验2/2、59.6秒，无失败／跳过；父将正式ReportView和runtime汇合复跑为`view-final`7/7、14秒，包含copyOnly撤权／断连隐藏。此前两宿主及作者结果没有覆盖这之后新增的展开载荷防护，相关独立复验如下。

源载荷独审确认字符串表去重会漏记重复落位，含input.value。新增`reportRenderLimits.contentUnits`及源文本／属性／控件值／编译CSS的展开总量，所有字符串写入逐次扣workUnits。旧dist的小样本红回归在`dom-budget-red`4/4失败：32×10000字符的text／attribute／property单帧均误接受；隐藏文档跨帧的约2Mi控件值也漏计，没有运行915Mi压力探针。修复后`dom-budget-green`连runtime／ReportView 11/11、17.9秒；相应原生输入／结构／CSS双宿主`~/.cache/scholoom-report-dom/run-UtNa3C`14/14、120.1秒，无失败／跳过／flaky。

静态追加复核又确认input类型切换会把当前值复制到value内容属性，清空.value后仍残留，第一版计数会遗漏该槽位。`dom-reflection-red`1/1实际失败，257左右控件、每项8192单元的隐藏样本通过旧防护；现以收费的私有浅克隆沿原生语义顺序预演，再回填实际value／内容属性及属性数量。拒绝不修改原DOM或提交next，克隆及读回也扣帧成本。`dom-reflection-green`5个预算代表连原runtime4项、ReportView3项共12/12、19.4秒通过；`~/.cache/scholoom-report-dom/run-v4tKvv`相同受影响双宿主14/14、121.5秒，无失败／跳过／flaky。独立静态复核关闭反射P1，未发现这处修复新的确证P1/P2；不是完整Web平台或所有故障矩阵保证。

最终控件错误只表示“交互已暂停”，不把请求停止说成已取得OS停止回执。后续只有格式、Map赋值拆行及该提示澄清，原生停止／容量及业务语义不变；最终产品包再重建，相关日志`desktop-budget-final-build.log`。工作区仍未提交；节点校准包仍原样等待sudo交互认证，不能用本片Browser或native成功冒充通用P跨账户验收。

原生gpt-6.1-sol/high的独立只读审查先确认重复open撤权绕过、C失联跳过其他模块清理；修复后复核又找到RPC已失败而freeze实际仍在途的关闭竞争。现全部修复并由真实控制链回归通过，未知容量继续保留。UI独审确认copyOnly未随撤权隐藏、回调重建使报告被重开、新普通HTML封锁合法原版三项；对应原身份复核、稳定回调和准确原版本核准已修，并获静态复核关闭，真实11项与Browser组合覆盖代表触发。审查未实际运行UI或系统，不能冒充动态证据。

本片没有提交、推送、归档、安装新依赖或修改已冻结系统包；测试只启动自有内核／静态harness／受控服务，不运行开发服务器或外部模型，不依赖当前/tmp。所有开放任务仍以完整行为验收，不能用上述分组通过关闭2.1b或I5。下一步先接原Node/data冻结包的实际结果，再准备正式通用P登记与系统部署，沿正式ReportView验完整Linux Browser／Electron文献对比、共同composer、保存更新和原版恢复；分发、原生IME／读屏、JPEG／字体真实解码及完整故障组合仍须按原范围核查。

## CSS、冻结呈现资源与源根映射（2026-11-01，当前续做）

仍为21/27，六项完整成果未勾。本片新增`report-styles.ts`及`createReportStyleAssets`，接入`report-dom`／`report-presentation`；固定css-tree 3.2.1及类型3.2.0由正常依赖和锁文件管理，授权内安装仅新增三个纯JS／类型包，使用ignore-scripts。CSS先按字节／token／深度预检，再完整核AST、解码名字及资源上下文；Raw或不支持语法失败，不退回正则替换。当前支持普通颜色变量／布局及有限条件规则、纯地址导入和批准URL，image-set的var/env资源替换、local字体、动画、has及带qualifier的导入明确不可用。预算只属于呈现，不限制模型请求或上下文。

资源Module只保留传入的同次冻结副本，不读当前路径或网络，CSS导入使用各自实际基址，呈现资源生成本视图拥有并在关闭时释放的Blob地址。静态PNG与常见JPEG核尺寸，字体核类型／解码体积及累计预算；未支持的动画／栅格格式拒绝。当前真实解码证据仅PNG；JPEG／字体未作实际解码验收。原材料和授权权威没有转入此Module，正式K／C／M及公共调用仍待接线。

首帧roots仅登记本视图html/head，不能重绑或修改核心子结构；私有CSP不在源对象表。源style以text/plain、link以惰性rel且不写href呈现，经过整帧预检的CSS才进入宿主私有style节点。更新、源顺序变化和删除同步真实层叠，输入身份及焦点不因样式替换。正文img沿同一批准资源接口呈现，srcset等未支持入口仍拒绝。规格和设计已同步将有限源元数据与不可操作的私有策略节点分开，未授予源任意head或DOM访问。

源CSS声明复用同一成熟解析器，修复冒号／分号拆分、custom property大小写及priority；Element属性和原CSS声明对象互通，删除style清空原对象而不增加一次伪mutation。dashed／camel转换只在声明模块注册，属性transfer使用实际namespace字符串索引。源文档统一显式／省略html的head/body，初始属性先行、子树按叶到根连接。九个source builder共用`report/build-options.mjs`的官方自包含ESM，避免P运行时读取相对包数据；production保留WorkerDOM／parser以及css-tree MIT、mdn-data CC0、source-map-js BSD许可，实际复制与原件字节一致。

### 实际验证与审查

- CSS／资产／原program契约组合15/15，实际命令`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-styles.spec.ts tests/kernel/report-style-assets.spec.ts tests/kernel/report-program-contracts.spec.ts --output ~/.cache/scholoom-report-styles/final-kernel --reporter line`。批准资源与权限为替身，只核compile／自有Blob／头部与容量，不运行报告或OS。作者CSS首轮8/9因将parser产生Raw的转义media误列为成功而失败，保留于`~/.cache/scholoom-report-styles-regression/first-run.log`；修正与调查一致的预期后9/9，主线组合另15/15，不混算。
- `node tests/fixtures/report-dom/run.mjs --grep 'styles use|styles reject'`：`~/.cache/scholoom-report-dom/run-K28rRW`双宿主4/4、53秒，无失败／跳过／flaky；冻结CSS导入、惰性源style/link、缓存更新／重排／删除、根身份、真实PNG解码及img、焦点和旧输入保持。六个非法候选各核零DOM mutation、原正文和CSP保持、同sequence后续合法帧可用，无外发。首轮run-0waR0Q因grep未匹配未执行测试；中间run-hp4Kjp双宿主4/4、51秒未含后加img代表，各自证据保留。
- `node tests/fixtures/report-program/run.mjs`：最终`~/.cache/scholoom-report-dom/program-bZbOps`双宿主2/2、51秒，真实普通Node源含head CSS及classic的style.backgroundColor，实际原生计算样式、原100对象／MathML／input与桥检查通过。先前program-DzzSkP两宿主新背景断言失败，原包确认camel注册遗漏且没有style mutation；恢复唯一注册转换、补实际namespace后通过。该链仍使用低层DOM，不冒充新的presentation／C/M已合并。
- `node tests/fixtures/report-program/style-source-check.mjs`：run-POJlsC七组Chromium原生对照及四项容量／单次mutation通过，涵盖Element属性互通及移除后原对象清空。原六组run-XEfGeO保留；为让别名回归真正使用生产dashed-only输入，driver后续已收紧注册入口，最终复跑见本节后续结果。
- 独立gpt-6.1-sol/high审查确证两P2：1200个meta使link属性与挂载分帧而误拒；省略html导致嵌套head/body。原反例在`~/.cache/scholoom-css-readonly-review/probe-wcnfVX`，主线修初始化顺序、保持未齐link惰性及统一根规范化后，独立重bundle的`recheck-d1ipsw/summary.json`三例全部ready、退出0、stderr空。动态link晚补属性仅静态复核；未发现确证P1，不扩大为完整安全／I5验收。
- 九份builder语法、自包含source构建及native-events七例通过，证据`~/.cache/scholoom-report-build-options/run-m3BA2Z`和`~/.cache/scholoom-report-native-events/run-z2v22V`；它们只核打包／良性事件，不是系统隔离。fork来源113项、18处patch及逆向检查通过，`~/.cache/scholoom-report-styles/provenance-20261101`；许可及MODIFICATIONS已同步。

最终dashed-only源oracle入口重新bundle，`~/.cache/scholoom-style-source/run-bEKKM7`七组原生对照及四项容量／单次mutation全部通过。受影响原结构／输入／恶意帧由`node tests/fixtures/report-dom/run.mjs --grep 'presentation|native semantics|hostile|owned DOM'`另轮完整复核，`~/.cache/scholoom-report-dom/run-ZZYLOD`双宿主16/16，无失败／跳过／flaky，不与前两轮CSS或source加总冒充一次I5。

editor／protocol构建、tools和相关fixture类型、受影响Biome、架构14模块299文件0 findings及diff通过。此后只有格式、文档和源oracle入口收紧；未跑模型、CI、开发服务器，不提交／推送／归档。新Node冻结包仍等待本机sudo认证，不修改该原包或用native成功替代新Node证据。

### 下一步

沿原2.1b／2.2／3.x汇合真实内核报告生命周期、同次冻结资源的公共接线与ReportView，再验共同composer、更新／准确原版重开和完整Linux双宿主I5；本轮模块接缝不替代该成果。系统侧继续同一bundle-k82Fl7的原installation与receipt，安装前不声称跨账户Node通过；系统IME／读屏、完整表单／CSSOM、JPEG／字体实际解码及分发范围仍未由本片证明。

## 源事件与可信输入事务（2026-11-01，当前续做）

本片仍为21/27，六个完整任务保持开放。共享fork修复每节点跨事件类型的稳定U16订阅身份、按capture／target／bubble及注册顺序分派、重复注册、once、分派中增删、独立于cancelable的传播控制、passive及on属性的false取消。源收到的原生信任标记只消费一次，重新分派属于合成事件；program的真正原生取消仍沿已确认unavailable边界锁定失败，不将passive或不可取消调用误判。fork来源仍113项，现16处patch，离线来源检查与逆向patch核对通过，许可及MODIFICATIONS同步保留。

新增`editor/src/report-presentation.ts`，通过原program packet／command直接组合可信DOM，不拥有材料、授权或容量。输入未取得实际确认、或composition未结束时暂存最多四帧；send完成不释放输入，也不提前回consume。源checkpoint内的过时property仅由可信host协调器在原节点与实际确认值一致时抑制，输入节点、焦点及选区不替换。相同native事件只按实际target转发一次；原生输入即使未注册页面listener仍同步。native层不自动once退订，由源实际调用后的原remove决定。关闭后旧回执不放行，源错误及过载失败保留当前原生文档，供所属视图处理草稿。

独立审查复现P2：multiple选择A+B经value／selectedIndex可被压成A而成功确认，原探针保留于`~/.cache/scholoom-readonly-review/multiselect-Gr5Wkn/evidence.json`。当前host捕获与source赋值前均明确unavailable并保留完整选择，尚未引入完整selection-set契约；静态复核关闭此P2，不能据此宣称全部表单语义已实现。主线另核source error不能仅转message后继续，以及form命名字段可能遮蔽DOM方法；现分别锁定presentation失败及使用可信宿主原型调用，均有真实双宿主代表。

| 实际验证 | 结果与证据 |
| --- | --- |
| `node tests/fixtures/report-program/events-check.mjs` | 首轮run-7uq9hZ七组及transport均红；首修run-LBvhKR剩target capture stop阶段差异，修正后run-GOGXh0全通过；最终当前源码run-VMfPV9七组及transport全通过。均在`~/.cache/scholoom-report-events/`，同一固定合成场景与独立Chromium oracle，不用实现输出定义预期 |
| `node tests/fixtures/report-program/native-events-check.mjs` | 7/7，`~/.cache/scholoom-report-native-events/run-rY5hD1`。每例独立普通Node与实际program，核passive、不可取消、捕获异常仍失败、on属性取消、synthetic redispatch、同Event重入及multiple拒绝后源A+B保持；输入和批准文件是明确替身，不算真实浏览器默认动作或OS隔离 |
| `node tests/fixtures/report-dom/run.mjs --grep 'presentation\|owned DOM'` | 当前源码双宿主12/12，100秒，无失败／跳过／flaky，`~/.cache/scholoom-report-dom/run-SJrlmG`。真实input／click、确认延迟、旧revision／错代、四帧／第五帧拒绝、退订、关闭迟到、source错误及DOM命名遮蔽；composition为合成事件，多选使用Playwright设置实际选择并发合成事件，源确认／文件／权限为替身。辅助初轮6/6的run-8IuZTI及加强退订2/2的run-JUSEjK保持各自源码边界，不混算成整组 |
| `node tests/fixtures/report-dom/run.mjs --grep 'native semantics\|hostile'` | 受影响原结构／恶意帧回归双宿主4/4，71秒，`~/.cache/scholoom-report-dom/run-4XtABU`。保留原文本／MathML／SVG／节点身份与整帧拒绝矩阵；不执行报告脚本 |
| `node tests/fixtures/report-program/run.mjs` | 真实源程序到低层DOM的原机械链双宿主2/2，50秒，`~/.cache/scholoom-report-dom/program-fKUPyY`；该次不是新presentation串联，不扩大为完整输入／OS验证 |
| 原report-program-contracts定向测试 | 3/3，命令沿前节，输出`~/.cache/scholoom-report-events/contracts`；shared envelope、实际UTF-8与无多余字段契约保持 |

editor声明／JS构建、固定program构建、tools及三个相关fixture类型、受影响Biome、架构14模块297文件0 findings、OpenSpec strict与diff检查通过；后续仅文档变化不重复业务矩阵。未新增依赖、运行模型、提交／推送、启动开发服务器或归档，工件均在cache／工作区而非/tmp。

原native安装正常路径沿下节保留。新冻结Node包`bundle-k82Fl7`仍未安装；本片末次`sudo -n -v`明确返回interactive authentication is required，未执行安装、创建新账户或改原冻结包。继续沿同一installation `e4f49466-74b4-4014-a937-de4fde007b07`，不能用旧native成功代替新跨账户Node结果。接续仍须CSS／批准资源、HTML根／head、正式K/C/M与ReportView装配、更新／准确原版重开及Linux完整I5；完整系统IME和读屏未验。CSS固定版本的新增源码核查由investigation维护，本片不抢先采用未核实的解析方案。

并行完成css-tree 3.2.1固定源码核查：16份官方关键文件逐字核对，28个纯解析样本及九项上下文矩阵，parser／walker无需外部包、generator复用已装source-map-js。转义Function、资源String、var／custom property及Raw的具体边界已归入investigation CSS节；证据`~/.cache/scholoom-css-tree-3.2.1-rCsbZr`。尚未引入依赖、产品构建或验证清理器。下一片须基于这些事实实现成熟AST工具加上下文规则，并从同一冻结字节视图提供资源，不能退回正则URL替换、从当前路径重读旧版依赖或只让P自行清理CSS。

## 通用源程序、消费窗口与实际JS呈现（2026-11-01，当前续做）

本轮仍为21/27，六项保持开放。新增`packages/editor/report/{files,program,bootstrap}.mjs`和`build-reports.mjs`，正式editor build生成固定`dist/report-program.cjs`及同版WorkerDOM／parser许可、来源manifest与patch。源码入口只接P内冻结`/resources`入口，`ReportProgramFiles`复用原header codec，按实际文件尺寸先核入口／单依赖／总集，NOFOLLOW持FD读取；依赖的实际路径和模块URL分别规范，字面percent不能被解码为另一文件路径。只从明确批准集合提供本地fetch和JS加载，不新增材料或授权权威。Node主上下文、JS对象及module hooks均不作为隔离边界，正式启用仍要求原OS profile实际成立。

`program.mjs`从完整源HTML建立自身DOM并收集脚本，保持classic全局与window/globalThis身份，复用Node24原生module hooks加载外部／内联ESM及相对依赖。classic使用带实际报告URL的main-context Script，使动态import具有正确基准；不添加VM超时来冒充OS隔离。默认module沿延迟阶段运行，bridge通过原schema只提出state／select，不能从页面参数选择view／generation／basis或接收会话；restore／queued／error沿同一绑定回传。当前不能将该适配称为完整Web平台兼容，具体CSS、输入事务及正式宿主接线继续见下方未完成项。

### 分帧、信用与输入确认

`editor/src/report-output.ts`集中源端输出：先规划本批完整有限帧并取得checkpoint，再按字符串、节点和完整操作元组发送；保留原索引及操作顺序，大child-list可先移除再按同一锚点分段插入。单帧64KiB、累计对象／字符串沿同源reportRenderLimits；最多四份未消费帧，stream写完不恢复信用。consume整组先核当前发送顺序再一次释放，invalid／duplicate／未发送序号不能消费合法前缀；关闭及发送失败拒绝drained，不发迟到新帧。`protocol/reports`新增私有program command／packet和native input／inputConfirmed同源schema，保持原桥契约；程序只向当前仍在源DOM中的节点分派输入，回执带实际源值、revision及输出checkpoint，不等同宿主已完成输入事务。

源WorkerDOM累计节点／字符串已改消费同一呈现预算，保留原无编码分配UTF-8扫描、去重及跨consume累计。原调查夹具的512节点／较小wire限制仍只属于其合成场景，不作为正式运行端预算。八个字符串子进程与16,384节点边界实跑通过；类型、build、离线113项来源及patch反向检查通过，证据`~/.cache/scholoom-closeout-execution-20261030/report-async-dom/shared-registry-budget-20261101-1793503383430`。

### 本轮实际验证及独立审查

- `tests/fixtures/report-program/output-check.mts`以独立接收oracle核9,003新增节点、58字符串及两次大child-list重排，共11帧、最大65,338字节；检查四帧窗口、实际消费、最终drain、累计上限、close与发送失败。首次发现混合ACK组先删合法前缀的P2，主线修复后同测试28/28，最终绿证据`~/.cache/scholoom-report-output-check/run-0kTWK6`；旧红例及其源码快照保留，不因目录时间较晚而改判原源码。
- `node tests/fixtures/report-program/files-check.mjs`在普通UID的最小只读bwrap视图，仅挂固定Node、解释器／六库、自有资源和可信自检程序，九组真实IO代表通过，`~/.cache/scholoom-report-program-files/run-24bst2/result.json`。核原字节／媒体型、percent与编码slash、越界／未批准URL、NOFOLLOW、稀疏超限和坏UTF-8；未运行报告JS、系统服务、跨账户或PID1，不证明恶意隔离，总集边界未单独实测。
- `node tests/fixtures/report-program/run.mjs`复用原report-dom Workbench及生产DOM receiver，不复制业务页；普通Node子进程真实执行100对象HTML的classic、外部ESM／相对导入与inline module。双宿主最终`program-syZ9Ku`2/2：每宿主5帧及5次实际apply后consume、最大未消费3，真实native input回到源后取得inputConfirmed并更新实际结果，输入节点／焦点／选区保持，真实click形成原select桥而不启动Agent。证据`~/.cache/scholoom-report-dom/program-syZ9Ku/verification.json`；源端文件／身份／权限是明确替身，无OS隔离或生产C/M。旧失败和各自源码原包保留；后续新增postMessage保留字段拒绝未单独再跑此UI，不外推为完整I5。
- 独立Codex gpt-6.1-sol/high核本轮新链，发现桥过载拒绝前加计数导致后续名额泄漏，以及默认module过早执行而读不到后续classic声明，两项P2已修。原良性反例、浏览器oracle保留于`~/.cache/scholoom-report-program-review/benign-A0XE7B`；同反例重bundle的`recheck-mMok55/result.json`退出0、stderr空，首轮5条受理4／拒绝1、排空后再4条全部受理，module结果CLASSIC与浏览器一致。该复核不覆盖后续parser／defer／async新增改动，不当作全链安全证明。
- `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-program-contracts.spec.ts --output ~/.cache/scholoom-report-program/contracts --reporter line`3/3；核原绑定／消费形状、无额外接收者／命令字段、真实UTF-8整体边界，以及循环／指数展开state安全拒绝。

本轮另修fixed parser的布尔／空属性、属性实体、SCRIPT／STYLE raw text、TEXTAREA／TITLE及PRE结构和大小写closing；并修checked／selected默认属性与脏值分离、空option value、单选placeholder及source类型／disabled差异。`node tests/fixtures/report-async-dom/run-html-ingestion.mjs`最终十组原生对照通过，`~/.cache/scholoom-closeout-execution-20261030/report-async-dom/html-ingestion-1793507158943`保留类型、实际source／Chromium及退出结果；上一轮`html-ingestion-1793506882002`的Option多余type及Select缺disabled首败保留。离线113项来源／14处patch、cmp及反向检查通过。仅该矩阵，不扩为radio分组、reset、optgroup或完整Web平台验收。

页面postMessage保留字段拒绝在同一source-driver的classic脚本内增加固定自检；最终普通源运行`~/.cache/scholoom-report-program/source-final-T69kj5/result.json`退出0、stderr空、4帧消费后ready。它验证实际SDK拒绝页面选择另一basis，不代替UI／OS验证。root typecheck已接独立report-program Bundler配置并包含output-check，NodeNext工具项目按原模式排除该目录；没有放宽生产类型规则。

本轮一次pnpm build因manifest脚本变化触发自动repeat install核查，结果Already up to date，依赖版本及锁文件无变化；后续构建／类型／测试直接调用既有Node工具，未新增依赖。全部长期工件及测试配置在cache／工作区，不依赖/tmp；未调用模型、提交／推送或归档。

### 仍须推进

新Node冻结包`bundle-k82Fl7`的`/opt/scholoom-report-e4f49466-74b4-4014-a937-de4fde007b07`仍不存在，等待既已请求的本机sudo认证及实际安装结果，不修改原冻结包或改用native通过标记。当前真实P源码／可信DOM机械链已比前片前进，但CSS与批准资源映射、原生输入在途／IME完整确认、HTML根／head的受控呈现、正式ReportView及K/C/M装配、更新／准确原版重开及完整Linux双宿主I5仍需汇合。原Node.addEventListener以push返回值作后续注册ID、remove用splice后索引及dispatch逆序遍历，不满足稳定订阅身份与多监听器的普通顺序；下一片源事件适配须先用原生oracle核这些事实，并处理宿主冒泡转发的重复及完整输入确认，不把本轮单监听器路径扩大为已通过。source原生全浏览器兼容与OS安装／故障矩阵不可由本轮局部绿色替代。

## 可信DOM结构接收与双宿主核验（2026-11-01，当前续做）

当前仍为21/27，六项开放。原native正常路径及后述Node源码／冻结包状态保持；本片新增实际editor呈现Module，不将原可信WorkerDOM mutator直接暴露给恶意P。`protocol/report-rendering.ts`维护私有帧schema和呈现容量，经原reports叶导出；`editor/report-dom.ts`的`createReportDOM`建立本视图独占、仅allow-same-origin而无allow-scripts的iframe，文档最早CSP拒绝脚本、网络、对象、子frame和表单外发。报告字节不交DOMParser／innerHTML或任意property调用；只通过自身对象表修改受控body，保留HTML／MathML／静态SVG的原生结构。

完整帧先核实际JSON UTF-8字节、顺序、累计字符串、唯一节点及namespace，随后在有限模型核属性／property／事件与最终树，再执行DOM更新。未知身份、截断、重复、循环或非法后半帧不写DOM、不提交字符串／序列；DocumentFragment自插入及被移除的插入锚点同样在预检拒绝。批量移动按父列表集中detach，整帧另累计模型复制、列表扫描／移位、祖先遍历及最终DFS工作量；超过同源workUnits预算先拒绝，不让小字节帧将无界结构工作转移到可信宿主。这些预算仅属于呈现帧与本视图对象，不限制LLM请求正文或模型上下文。

### 独立审查发现与修复

独立Codex gpt-6.1-sol/high审查并实跑两份反例：允许`href="#escape"`时srcdoc按宿主页base解析，点击会发起宿主页请求并离开about:srcdoc；16,000个平级节点后，一份28,735字节帧反复移动同一节点2,048次，旧逐mutation父列表过滤同步耗时约1,112ms。前者现对所有非null href（包括空值、片段及SVG／MathML href）明确拒绝，内部定位留给后续可信动作；后者现按整帧结构工作预算拒绝。原反例复核分别返回unavailable及resourceLimit，DOM mutation均为0；性能例约11.5ms拒绝，原顺序保持且同sequence后续合法帧成功。耗时仅记录本机诊断，不作为完整性能验收。复核同时核导航相关属性拒绝、cite被动及表单不发请求；原首败与完整复核在`~/.cache/scholoom-report-dom-review/recheck-duTNvL/{original-observations,recheck-results}.json`，未改判旧结果。

### 实际验证及边界

新增`tests/fixtures/report-dom/`直接bundle生产接收Module，并经真实Workbench外壳与既有静态UI harness运行；报告帧、材料身份及领域权限是静态合成输入，没有运行报告脚本或OS执行链。正向核原生选择／输入、焦点与选区、表格、MathML分数布局及MathMLFraction AX、静态SVG，以及100对象／1,000节点分十帧追加和20个既有对象批量移位；逐对象身份及原输入保持。25个恶意参数分次覆盖完整帧拒绝，含未知／重复身份、结构循环、危险namespace／属性／property、截断、焦点输入覆盖、实际UTF-8超限、fragment链接和结构工作超限。报告脚本标记、报告资源及外网请求均未出现；普通宿主引导请求不计作报告外发。

| 实际命令／范围 | 结果与证据 |
| --- | --- |
| `node tests/fixtures/report-dom/run.mjs` | 初轮夹具类型解析失败保留于run-mWRp8D，修正本目录类型映射后run-u7zHrb双宿主4/4；增强移动身份断言后run-Sgrj1I双宿主4/4。均为对应源码快照，不冒充后续修改后的全部重跑 |
| `SCHOOLOOM_REPORT_DOM_ATTACK=utf8-frame-budget node tests/fixtures/report-dom/run.mjs --grep hostile` | run-VOBnoU双宿主2/2，UTF-16未超限而实际UTF-8超限的整帧拒绝 |
| `SCHOOLOOM_REPORT_DOM_ATTACK=fragment-url,work-units node tests/fixtures/report-dom/run.mjs --grep hostile` | 修复后重新bundle的run-M4IT7V双宿主2/2，分别核片段链接与1,000平级节点／1,024次移动代表；独审原16k例另如上，不相互替代 |
| `node tests/fixtures/report-dom/run.mjs --grep 'native semantics'` | 主线以最终安全修复重新bundle，run-zBh8Ox双宿主2/2，确认工作预算仍接受实际100对象／分帧及移位正例 |
| `pnpm exec playwright test --config playwright.kernel.config.ts tests/kernel/report-codec.spec.ts --output ~/.cache/scholoom-report-dom/kernel-codec --reporter line` | 45/45，原清单／快照／桥契约回归通过 |

上述UI各轮均在`~/.cache/scholoom-report-dom/`保存独立build、源码快照、命令、行为结果、截图及必要失败依据，不依赖/tmp。protocol构建、editor类型、根tools类型及独立report-dom类型检查通过；新夹具沿现有Bundler类型项目加入根typecheck，普通NodeNext工具项目排除同目录后由其专用配置覆盖，不放宽生产规则。相关Biome检查通过，架构为14模块／295文件／0 findings。未运行全仓check或模型API，未安装依赖、提交／推送或归档。

CSS、批准资源URL及完整原生输入确认仍未接；通用bootstrap源码的后续进展见本记录首节。本Module对尚未支持的动作明确失败，并未启用产品ReportView或缩窄最终范围。新Node包`bundle-k82Fl7`仍等待本机sudo认证及实际跨账户安装，不能用本片DOM绿色代替其通过。续做沿已批准design汇合这些能力、实际K/C/M执行、共同composer／更新／准确原版重开及完整双宿主I5，六项任务在完整成果与验收前保持未勾。

## 原安装正常路径接收、真实恢复与正式Node链待安装（2026-11-01，当前）

用户执行原地修复包后，主线读取原`/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f/t1-passed.json`及`acceptance-KH9tGQ/result.json`核实accepted=true。原config不变，新固定实例`43e355ae-6298-4b91-b7f6-d0427fea18bf`最终stopped、gateReleased=true、stopConfirmed=true、无failure，K容量active=0／waiting=0；查询采样没有捕获短暂running阶段，不据此伪造running投影。正常终态依赖原native真实exec事件、独立字节与拒绝oracle及C/M停止链。安装通过标记、修复plan、配置、用户结果及journal已保全至`~/.cache/scholoom-report-system-service/passed-installed-eHmERN`；原首次失败及旧服务副本继续保留，不改判旧失败。

### 四个真实跨账户恢复场景

新增`tests/fixtures/report-system-service/recovery.mjs`沿同一原安装、原固定normal程序及各自唯一新实例执行，不创建账户、不更改程序或静态配置。实际命令为`node tests/fixtures/report-system-service/recovery.mjs /opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f/installed.json`，四例均通过，证据`~/.cache/scholoom-report-system-service/recovery-09rblx/{cancel,revoke,disconnect,lost-start-ack}.json`：

- 原系统scope已创建、ready后的首次K授权复查挂起时，分别显式取消与撤权，最终原停止持久、未G、容量归零；撤权保留permissionDenied。
- K断线时原容量仍为1；等原C/M退出后重连，经完整库存核原停止才归零，原实例身份不变。
- K/C的start成功响应已形成后截留该回执，再断线；原请求得到outcomeUnknown，容量仍保留，重连核同一原实例的持久停止后释放。没有重新prepare或创建替代实例。

独立Codex gpt-6.1-sol/high只读审查脚本、原代码和四份实际证据，无确证P1/P2。边界明确：仅首次ready授权窗口，不包括第二次授权窗口、G之后取消、C/M进程崩溃、M.start/G回执丢失、停止落盘失败或机器重启。startRequests计数只观察初始连接，不能单凭该计数证明重连没有重放；相应实现另已核对。未据四例关闭完整T1或2.1b。

### 固定Node／WorkerDOM的真实运行校准

只读核查确认Node24.12.0为121,140,224字节的动态ELF，原静态程序8MiB／无PT_INTERP约束、原只含program/gate/resources的文件视图及原syscall策略均不能承载它；不通过放宽原staticImage或改名profile解决。主线负责原生候选策略、精确视图及真实校准，辅助Codex同型号负责固定bootstrap／打包；复用已锁WorkerDOM与现有copyFrame，不安装依赖或把原可信sample变成生产报告。

入口`node tests/fixtures/report-node-runtime/check.mjs`，最终无tracer运行`~/.cache/scholoom-report-node-runtime/run-bMjLHA`通过。可信shim在P进入前从实际所属cgroup核CPU=`20000 100000`、memory=`536870912`、swap=`0`、pids=`32`，原值及路径分别在live-limits.txt／live-cgroup.txt；退出后的unit可能已回收并显示默认无限值，unit-after.json不作额度证明。P只映射原root-owned Node、解释器、六库、固定bootstrap和批准材料，整体只读，不挂proc/sys或宿主目录。FD0/1/2独立fstat均为FIFO，环境变量名仅PWD。样本读取原固定批准字节，处理一条合成请求，构造HTML和MathML mfrac及两子项，产生一帧真实mutation；TCP、UDP、写入和spawn均EACCES，读取/etc/passwd为ENOENT。编译、build、帧预算及自检均真实运行，没有模型、浏览器或原C/M参与。

失败演进保留：run-Q3XWvi缺wait4导致bwrap init wait拒绝；补只读等待后的run-xZkjDO启动退出，trace-LJd5Kv仅诊断发现systemd-run stdio为AF_UNIX socket。Node stdio:'pipe'的relay对照run-OZiB30仍失败，临时relay未成为依赖，已用内置编辑工具移除。本机真实管道对照run-i48zUQ已返回accepted但Abseil退出调度查询报错污染JSON；补两项只读sched查询后run-YPEd3A通过；run-TURrVS增加实际FIFO／环境及live限额证据后通过。最终bMjLHA将shim的cgroup读取改成严格统一层级核对，所有断言通过。跟踪运行不计隔离通过，也未为通过放开socket、recvmsg、namespace、ptrace或进程fork。

独立审查核BPF跳转和clone／openat边界，无确证逻辑P1/P2；发现校准启动链继承LD注入环境的P2，已改工具调用显式环境白名单并在transient unit移除LD／shell／Node注入变量，独立复核关闭。clone3固定ENOSYS使libc回到精确pthread clone flags；文件只读同时由openat flags和mount视图限制。该次通过来自校准夹具，不作为下述正式profile的跨账户执行证据；syscall观察不是完整安全证明，实际配额读回不是压力执行测试。

上述校准阶段相关Biome、cc的Wall/Wextra/Werror编译、架构14模块291文件0 findings、OpenSpec strict及diff检查通过。原控制器／管理器24例在上一修复后已通过，该次校准没有改其生产实现，未无变化重跑。运行脚本、README、design、tasks续做入口及开发说明已对齐该次真实结果；不新加小任务改变计数。

### 正式Node链实现、模块验证与新冻结包

现有system route新增`linux-x64-node-v1`，沿原K唯一准入、C记录／授权与M系统生命周期接线。`isolated-report-runtime.ts`消费同源八个固定目标：Node、ELF解释器及六份动态库；安装提供闭包目录，逐级核root-owned、无symlink及不可group／other写，固定文件以只读／NOFOLLOW／NONBLOCK持FD核regular、单链接、大小与五段物理stamp，单文件最多256MiB、合计512MiB，不读完整Node或另加hash。C在原systemInputs封存两条自身所有、0600、单链接的`data-in`／`data-out` FIFO及其dev／ino；在M.start前由`IsolatedReportData.open()`仅核对象并以RDWR／NONBLOCK持有，避免PID1开管道阻塞，running授权留给exchange。

K/C新增私有`reportControl.exchange`，复用原实例及授权，不开公共报告入口。数据通道只传单行JSON对象／数组，严格UTF-8、每帧64KiB、固定65537字节缓存、每次最多4帧，保留半帧而不积累无界队列；并发拒绝，非阻塞写总期限沿`limits.requestMs`。输入超限与并发拒绝保留`resourceLimit`；P输出超限或坏帧为`protocolIncompatible`并关闭通道，部分发送后失败为`outcomeUnknown`，不自动重发。exchange及在途操作复核FIFO身份／权限和当前授权，close封住迟到动作；OS停止与容量仍由原provider负责。

M动态单元通过PID1具名FD传递两FIFO及`runtime0`至`runtime7`，launcher核原manifest、物理对象和固定目标，再交原P／G链。可信封存阶段的`LimitFSIZE`／`RLIMIT_FSIZE`为`max(256MiB, outputBytes)`以容纳121,140,224字节Node；可信gate收到G后、exec前将软硬限制降回原`outputBytes`，不把封存额度带给P。源码入口为`system-report-unit.ts`、`isolated-report-system.c`、`isolated-report-scope.c`及`isolated-report-gate.c`；仍按真实exec事件进入running，原停止持久后才释放K容量。

| 本轮既有验证 | 实际结果及证据边界 |
| --- | --- |
| `node --test tests/fixtures/report-system-native/node-launch-check.mjs` | 3/3；`~/.cache/scholoom-report-system-native/node-launch-87nqKJ/result.json`保存正常Node／数据往返、runtime stamp变化及输入非FIFO拒绝。普通UID模拟具名FD，使用实际root-owned运行文件；不证明PID1、跨账户、配额或完整停止凭据 |
| `pnpm test:kernel tests/kernel/isolated-report-data.spec.ts` | 最终17/17；真实本机FIFO、双向JSON、UTF-8半帧、4帧／字节边界、替换／撤权、并发、期限和关闭。输出错误码调整后一次运行曾16/17，因交换可能先于测试撤权完成；改为授权回调观察到实际写入后撤权，再核发送后outcomeUnknown，未改关闭行为。主线接收结果在`~/.cache/scholoom-report-node-integration/data-final/.last-run.json` |
| `node --test tests/fixtures/report-system-native/node-gate-check.mjs` | 18/18；证据`~/.cache/scholoom-report-system-native/node-gate-tZmnPr`，数量及入口同时记录在上述node-launch的result.json。真实匿名管道／可信gate／共享策略检查，不当作系统安装验收 |
| 主线原有控制／记录／管理链回归组合 | 84/84；本轮主线既有实跑记录，`~/.cache/scholoom-report-node-integration/kernel/.last-run.json`保留passed／无失败状态，该状态文件本身不含数量。不与前述分组相加为一次完整验收 |
| `pnpm check:architecture` | 本轮主线既有结果为14模块、293文件、0 findings；区别于上方校准阶段的291文件，不据文档补记重新执行旧探针 |

WorkerDOM共享源码已迁入`packages/editor/vendor/worker-dom`，原vendor不再保留源码副本；连同manifest／patch迁移的116个文件中115个逐字节一致，只有`MODIFICATIONS.md`调整路径与共享受控adapter用途说明，Apache／MIT原许可及固定SHA保持。三个原fixture引用同一新根，两个原tsconfig及三个build通过；迁前校验清单在`~/.cache/scholoom-worker-dom-move/before-1793501102013.json`。该迁移不证明原始fork可直接安全接任意DOM，也不包含通用bootstrap或安全DOM接收实现。

新Node冻结包为`~/.cache/scholoom-report-system-service/bundle-k82Fl7`，installation为`e4f49466-74b4-4014-a937-de4fde007b07`。`bundle.json`固定runtime=node及八目标的实际文件，`offline-node.json`记录默认离线核查退出0、普通UID的`--apply`拒绝退出1；主线此前同包`sudo -n`被本机交互认证挡在安装执行前。当前`/opt/scholoom-report-e4f49466-74b4-4014-a937-de4fde007b07`仍不存在，等待用户执行同包安装；没有installed／t1-passed或新跨账户Node通过证据，不重用原native通过标记。具体安装入口见`tests/fixtures/report-system-service/README.md`。

当前仍21/27，原六项开放。旧native安装的认证阻塞已解决，新Node包仍待本机认证及安装；下一步读取同包原installation的实际安装／验收结果，随后继续通用HTML／JS bootstrap、安全DOM接收、共同ReportView／输入／更新／原版重开、剩余T1故障与Linux双宿主I5。没有启用活动报告、缩减范围、提交或归档；正式Node源码与模块绿色不代表新跨账户Node、完整T1、通用HTML或I5通过，旧失败与旧校准证据不改判或重新自证。

## 原安装首次T1失败与原地修复（2026-11-01，当前）

用户实际执行LeoniU原包后，installation `29a5b38a-e034-433f-989c-bf7b19a4140f`的账户、四个静态端点及程序已安装；原configId为`dda5d6ea-ec63-4f09-87e4-30437d6f8ccd`，C UID/GID为994/981。本节取代下节的“尚未安装”状态。首次验收失败，未写t1-passed；不是用户缺包或认证失败。

两个根因均已复现：OS adapter的start／verify把完整ReportManagerStart传给仅接受configId／storageId的capture，additionalProperties校验因此返回invalidRequest；PID1 journal同时记录五个OpenFile解析失败，原生launcher缺命名FD而exit120。实际`systemd-analyze verify`即使忽略坏OpenFile也退出0，原离线检查仅验四个静态端点且只核退出码，未覆盖动态执行单元。

已将start／verify改为显式投影两个身份字段，保持capture严格校验；动态slice／service文本归现有`system-report-unit.ts`的同一生成器，OS创建、恢复核查及清理共用。OpenFile路径按systemd的C转义规则处理，不用JSON引号，保留百分号及分隔符保护。新`os-check.mjs`经真实OS verify及capture校验，只有文件、命令和UID观察是替身：修复前同一invalidRequest红例，修复后通过。新`unit-check.mjs`消费生产生成器，真实解析普通／特殊路径，并核对应单元的OpenFile诊断而非只核verify退出码。

原失败instance `4ebec5cb-51c1-4d58-9cfd-208663465b8c`／storage `37a86417-3b93-41e6-8751-d69d4ac6db7b`通过原安装C的完整库存恢复核查：stopped、stopConfirmed=true、gateReleased=false、原failure仍invalidRequest；K容量active=0、waiting=0，close ACK后仍为0。PID1原单元not-found，原retired凭据保留。证据在`~/.cache/scholoom-report-system-service/original-failure-vRoD4g`，含原用户结果、journal、安装配置及真实恢复回执；不把新成功或PID消失作为原停止证明。

实际验证：platform及kernel tsc、五个相关JS/TS文件Biome、architecture 14模块291文件0 findings；controller＋manager 24/24（`capture-fix-regression`）。`node --experimental-test-module-mocks --test tests/fixtures/report-system-service/check.mjs tests/fixtures/report-system-service/unit-check.mjs tests/fixtures/report-system-service/os-check.mjs`为6/6；离线包证据`offline-NxGCHU`、解析证据`unit-check-Bo7tdp`。这些不是root实跑或完整T1证据。独立Codex gpt-6.1-sol/high核对覆盖缺口、辅助实现单元生成／解析例，并独立只读审查主线的repair脚本及固定plan，无确证P1/P2。

已准备原地修复入口`tests/fixtures/report-system-service/repair.mjs`，冻结包为`~/.cache/scholoom-report-system-service/capture-repair-ll1Ulw`。它先以原K核原失败及完整库存容量，再停本安装两个socket并核没有活动C/M；仅以root-owned新inode替换service，原副本rename保留，原账户、config、records、静态单元、Node及acceptance不变。之后启动原socket，经原acceptance运行一次新固定native尝试；失败原地保留，不自动重试、不重新安装。plan绑定旧／新服务、配置、原Node／acceptance摘要及原失败instance。离线计划、普通UID的apply拒绝已实跑；verifier最初缺本地report-channel而认证失败，补齐包内普通验证helper后，真实原库存验证通过；安装后verifier与原受保护helper同目录。未因本地打包错误重跑任何探针。

主线已尝试同包sudo -n，仍返回interactive authentication is required，修复尚未部署。用户在本机执行如下命令后收取同一原安装的capture-repair-commands.jsonl、原C回执及t1-passed；不再次申请部署许可：

```sh
report_repair=/home/joshua/.cache/scholoom-report-system-service/capture-repair-ll1Ulw
sudo /home/joshua/.nvm/versions/node/v24.12.0/bin/node "$report_repair/repair.mjs" "$report_repair/repair.json" --apply
```

本轮未提交、未调用模型或启动开发服务器。原六个完整任务仍开放，21/27；即使修复后固定native正常路径通过，仍须完整T1故障恢复、通用JS策略／呈现、ReportView接线及Linux双宿主I5。

## 等待本机认证期间的呈现核查（2026-11-01）

持续收尾再次只读核对：LeoniU的精确`/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f`安装目录及t1-passed均未出现；`sudo -n -l`仍返回交互认证要求。没有确认存活的安装任务／进程句柄，本片不是运行中任务的verified wait；未重启或重跑已启动的校准，没有新增系统对象。已有部署授权保持，仍待用户执行下节同一命令并提供实际结果。

本次接续复核结果相同：精确`/opt`、`/var/lib`目录及control.socket配置均不存在，专用账户查询退出2，原LeoniU安装进程查询退出1；原install.mjs、bundle.json及Node24.12.0绝对路径仍存在。实际阻塞为本机sudo交互认证；停止自动续跑，待用户执行原冻结包后读取同一安装的receipt及验收结果，不换包、不自动重试、不清理原失败现场。任务仍为21/27，未新增实现或真实系统通过证据。

主线与独立Codex gpt-6.1-sol/high并行只读核对现有呈现设施和官方DOMPurify资料，依据已写入investigation当前首节。确认两个WorkerDOM夹具只有有限黑名单，async receiver存在直接setAttribute／property及未核完整namespace，不能承载任意P帧；普通静态HTML／Markdown清理也不能补这个接缝。主线独立读取npm latest，实际为DOMPurify3.4.17、MPL-2.0 OR Apache-2.0及ESM入口；上游源码／威胁模型表明isValidAttribute不验证namespace整树、IN_PLACE可破坏原活动树、CSS及解析前零HTTP请求不在其保证内。因此没有仅加一个库就宣称生产安全，也没有更改原型断言、安装依赖或启用页面。后续须与原资源映射、完整帧、namespace、原输入确认及真正独立执行端一起完成，不新增业务模板替代通用HTML／JS。

本片仅更新调查和proposal中的最新授权依据。OpenSpec strict及git diff检查通过，无实现变动，不重复已通过的模块、UI或模型测试；六项任务保持开放，当前21/27。原系统安装快照和所有失败／通过证据仍沿下节，不改包或重新申请许可。

## C／M正式接线与安装快照（2026-11-01，当前）

用户明确目标为继续至change完成，并批准必要授权；本轮沿原2.1b继续，没有收窄Linux浏览器／真实Electron的通用HTML／JS范围，仍为21/27。已实现C-owned系统输入、M固定OS host、C系统controller、原RpcPeer连接及独立角色入口；实际运行仍待下面同包的本机sudo认证，未将模块绿色当成完整T1／T2或产品报告完成。

实际链路及图见design当前首节。C在原record／资产目录封存program/gate/材料，唯一创建FIFO、events/stdout/stderr与只读manifest，sync后保存原systemInputs，再提交scopeIntent。M创建保留父slice并持久其原身份后才启动服务，PID1传原具名FD；C保存真实scope之后才P，ready后授权→launchIntent提交→末次授权→一次G。只有真实native exec事件才running。停止按原父身份核fresh populated0，C原stopped持久之后K才释放；M随后原子保存retired再精确清理，不读取C records或另计容量。

恢复携带已有scope；无scope时仅在root首次保存的原父身份上等待排空，不补当前同名invocation。M关闭许可、等待原在途start结清后才恢复，恢复与清理互斥；同boot缺失原证明继续unknown。完整retired在父范围移除前提交且保留到重启，支持部分清理后续做。C／M writer自己持有共享open-file description上的flock，辅助程序短命退出不释放锁；root动态unit及元数据完整暂存／sync后经RENAME_NOREPLACE和目录sync发布，半份正文和残留tmp不能成为凭据。

| 本轮必要验证 | 实际结果及范围 |
| --- | --- |
| protocol/platform/kernel build、tools类型、相关Biome、architecture | 通过；架构0 findings。SDK两个native入口严格编译通过，没有安装npm依赖 |
| C输入、controller、M状态及原K/C接线组合 | 初次49/49；修复新增恢复／清理竞争后controller+M24/24，`~/.cache/scholoom-report-system-inputs/final-controller-manager`。真实C文件／原锁／Unix账户检查，M OS为明确替身 |
| writer锁改为实际进程持FD之后的记录／资产／系统记录／M组合 | 62/62，`~/.cache/scholoom-report-system-inputs/owned-lock-regression`；含持久提交失败、真实锁关闭后的拒绝及原库存保护 |
| 持FD之后的K/C IPC、真实系统输入及controller组合 | 41/41，`~/.cache/scholoom-report-system-inputs/final-connected-owned-lock`；不把同UID IPC／OS替身当跨账户系统运行 |
| 原v1真实native代表 | 最终4/4，`~/.cache/scholoom-report-v1-regression/owned-lock-results`；真实user systemd／bwrap、双文件freeze、syscall／FD拒绝、detached停止和门前取消。原worker首轮4/4记录另在同根verification.md，不合并为同次运行 |
| 新原生共享FD锁及原子发布 | 2/2，`~/.cache/scholoom-report-system-inputs/private-files-pozk8U`；普通真实UID验证辅助退出后锁仍排他、关闭writer FD后可再取得、完整发布、既有最终文件／symlink／越界叶名拒绝。不模拟root权限 |
| 系统launcher具名FD模拟 | 4/4，`~/.cache/scholoom-report-system-inputs/system-launch-qKasS1`；P/ready/G+EOF及实际ptrace exec、原inode／描述／重复名拒绝。普通UID，非PID1／跨UID／配额证据 |
| SDK只读／权限／参数检查 | 32/32，`~/.cache/scholoom-report-system-native/run-uJ1f5T`；含原parent身份必需及普通UID拒绝，不运行root作用 |
| 最终安装快照离线检查 | 2/2，`~/.cache/scholoom-report-system-service/offline-ucYY2V`；独立C/M和K bundle实际加载、非root安装拒绝、账户／名称边界及替代可执行路径后的unit语法。不证明实际安装成功 |

独立Codex gpt-6.1-sol/high初审发现：恢复丢原scope、M strict cgroup namespace遮蔽宿主范围、slice删除后清理无法接续。均按当前design修复；复审又发现retired半写入及锁子进程独自退出导致失锁，改原子发布与实际writer持FD后限定静态复核关闭，无新的确证P1/P2。主线补在途start/recover竞争和各自真实FD／原provider回归。审查没有调用root，不代替真实OS故障验收。原失败075b…现场和成功fixed-native停止校准证据均保持。

最终冻结包：`/home/joshua/.cache/scholoom-report-system-service/bundle-LeoniU/bundle.json`，installation ID `29a5b38a-e034-433f-989c-bf7b19a4140f`，K UID/GID 1000/1000。默认入口已在离线检查中核全部批准字节并列计划；准备创建的专用账户为`srpt29a5b38ae034433f989cbf7b`，程序及C记录父目录分别为`/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f`、`/var/lib/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f`，四个确切socket/template名与Root副本见同包review.json／bundle.json。C UID/GID及真实configId由安装时的新账户和C provision产生，不由root伪造。四份静态配置写/etc，不enable；每报告动态范围及原OS凭据在/run，重启不依赖现有/tmp。

安装入口包含一次降权至原K的固定native正常路径：同一真实admission，合成`approved report bytes`，PID1 runtime20秒、K观察30秒，不运行HTML／JS／浏览器／模型，不自动重试，失败保留全部现场，成功才新增t1-passed.json。它只验正向K/C/M链路，完整恢复故障及Node/WorkerDOM仍须继续。

主线实际尝试同包`sudo -n /home/joshua/.nvm/versions/node/v24.12.0/bin/node /home/joshua/.cache/scholoom-report-system-service/bundle-LeoniU/install.mjs /home/joshua/.cache/scholoom-report-system-service/bundle-LeoniU/bundle.json --apply`，sudo在进入安装器前返回`interactive authentication is required`，未创建账户／服务。已通过异步问题向用户给出同包不带-n的完整命令，等待本机认证及实际结果；这是操作系统认证前置，沿用已有部署授权，不重复请求权限、不索取密码或绕过认证。具体说明见`tests/fixtures/report-system-service/README.md`。未提交／推送，未启动产品开发服务或重跑真实模型。

接续先读取该精确包的用户输出、原安装receipt／K cache证据及真实PID1观察，失败按原身份诊断，不重跑已启动包或清理unknown。通过这一正向路径后仍须完整T1故障／停止持久化验收，再实现专用Node策略和独立呈现通道、正式ReportView及双宿主I5；静态probe不能运行通用报告。原六项任务保持未勾，不归档。

## 固定系统范围的真实通过（2026-10-31，当前）

用户在本机再次执行同一已授权`bundle-Qjufg2 --apply`，返回`Passed fixed native scope capture/stop`。主线实际读取RESULT、capture／stop／命令日志，并只读核PID1 journal、四个单元及文件清理：原boot为`dedc9181-f1b5-4834-83ac-19d089298475`，payload InvocationID为`30e23a23a6d449a0b23007e979ffc4e5`，原保留父范围dev33／ino2285891；主PID2127480／birth150931305、已完成setsid的子PID2127522；DynamicUser UID/GID61569，实读20%CPU（20000/100000）、67108864内存、swap0、16tasks。SIGKILL后helper返回`stopped`，父范围空先于slice删除，两原PID已消失，四份本轮unit及两个程序和空程序目录已移除。

原始运行目录`/run/scholoom-report-check-3d2d7855-a1e4-4f20-aa00-9a98c3eae2ce`保留；全部可读文件及元数据、清理核查、独立show／journal原始结果已保存至`/home/joshua/.cache/scholoom-report-system-stop/passed-80cc7k`，后续不依赖/run或/tmp。清理后父slice的只读查询再次合成loaded/inactive/dead对象，无FragmentPath／cgroup／InvocationID，是已确认的systemd行为，不是残留运行。旧`075b…`失败现场及其unknown结论保持，没有因新实例成功而改判旧实例。

本次关闭的是固定可信native的真实PID1／跨UID／实际配额／原调用Kill与父范围排空校准。没有运行报告HTML／JS、浏览器、模型或完整C/M服务，也没有验证C-owned输入／FIFO／日志连续性、M.start／permit和C持久停止至K释放的整条链。当前依然21/27，原六项不勾；下一片沿design接这些缺口，成功校准不扩大账户／LSM／长期服务部署授权。未提交／推送。

## 系统停止失败与保留父范围修复（2026-10-31，当前）

用户执行已授权原包`bundle-9RQQpI --resume-staging`，首次复制属性问题已越过，固定native父子、跨UID采证及实际CPU／memory／swap／pids限额成功。原boot为`dedc9181-f1b5-4834-83ac-19d089298475`，payload InvocationID为`b472293f09854ad880d39c357abb968f`；主PID1775273／birth150561510及完成setsid的子PID1775305实际在原范围。root停止helper退出120／`stop-unconfirmed:2`：journal证实SIGKILL已发往原invocation及cgroup，但约10ms后原events已因PID1提前回收而ENOENT。PID消失仅为诊断，没有改判成功。

原系统现场`/run/scholoom-report-check-075b23b0-201c-434d-9e6d-0879d5cf41da`、三个原unit、程序及failed-staging继续保留，没有清理或root重跑。可读日志／实际unit／journal／show／observations已普通只读保全至`/home/joshua/.cache/scholoom-report-system-stop/original-gcqmkJ`；root0400失败副本无法再读的EACCES单列记录，其较早字节另已在`failed-root-Eegv8D`保全。原回执仍停止未确认。

精确Ubuntu内核7.0.0-38.38及systemd259.5-0ubuntu3.4官方源码／补丁核查见[唯一调查](../../../../.scratch/scholoom-foundations/research/report-cgroup-retirement.md)，源码已保存到`/home/joshua/.cache/scholoom-cgroup-retirement-source-D8IjKj`，不依赖/tmp。关键发现是本机允许移除cgroup时仍有退出清理线程，故不接受ENODEV或目录失活捷径；RemainAfterExit也会prune。改为每实例持续active的独立父slice，dying子范围仍向父贡献populated，保留原父inode至新鲜读到0。模板必须没有停止后收尾命令和未来注入，父范围丢失仍unknown；完整方案及文件影响见design首节。

原生helper采证现绑定父inode和实际父限额，独立核payload调用／Slice／membership及账户；停止只在需要Kill时寻址原payload调用，观察始终在pin住的父范围，返回前复核active、不自动停止及同一实际父对象。系统v2记录拒绝原service级路径及他实例父范围，旧v1路线不变；不迁移旧记录或把旧包的service inode解释成父范围。校准包新增第四份unit（保留slice），以独立主线stat／events核采证与停止结果，确认后才精确停止空slice及清理；未知保留。M仍不写records／释放K容量，未部署完整C/M或开启产品报告。

| 本轮实际验证 | 结果与证据 |
| --- | --- |
| 普通UID最小父范围probe | 通过，`/home/joshua/.cache/scholoom-report-system-stop/parent-probe/run-S8PNfM`；子service目录消失后父原dev33／ino2285135仍active、fresh populated0。正常有限sleep，不宣称命中dying清理窗口 |
| `node --test tests/fixtures/report-system-native/check.mjs tests/fixtures/report-system-manager/check.mjs tests/fixtures/report-system-manager/retained-slice-check.mjs` | 主线39/39、1.3秒，含SDK28项、离线包10项及普通UID保留范围1项；分别保存于`run-C2AmV5`、`bundle-Qjufg2`及`retained-slice-c40r35`所在持久cache。原父FD与fresh读0、原子events ENODEV／ENOENT仅诊断、本轮unit准确收尾。作者的早一次普通UID1/1在`retained-slice-rdzCgG`，不合算成同次运行 |
| `isolated-report-system-records.spec.ts --workers=1 --retries=0` | 主线32/32、2.7秒，`/home/joshua/.cache/scholoom-report-system-stop/records-retained`；真实文件／锁，OS身份为独立合成值，拒绝service级旧语义、他实例父范围和原其他不合法字段且保留磁盘字节 |
| platform build、tools类型、相关Biome、OpenSpec strict及diff | 通过；不重跑无变化的UI／模型／CI。root修复后capture／stop尚未运行，普通UID不得替代 |

独立Codex gpt-6.1-sol/high已完成限定只读审查，无确证P1/P2；另跑离线10/10、记录32/32、C严格语法编译及platform类型通过，未启动单元或触碰原现场。主线接收这份静态／离线审查，未将其当root系统链通过。原生源码调查、辅助普通UID校准和最终审查分别委派，最终接口、实现及接收由主线负责。

待核准的具体包为`/home/joshua/.cache/scholoom-report-system-manager/bundle-Qjufg2/bundle.json`：configId为`3d2d7855-a1e4-4f20-aa00-9a98c3eae2ce`、storageId为`9e159cfa-0818-4149-a7b0-198b0ada8445`，三服务及独立slice准确名字见同包。主线已用默认只读入口核准内容／列计划；20%CPU／64MiB／swap0／16tasks／20秒probe，两个root观察helper空capability及只读cgroup视图，所有程序首次核准Buffer，只有确认后限定清理。原包不动，不加载账户／LSM／长期服务或运行报告／模型。

用户已按给出的命令执行新包`Qjufg2 --apply`，在目录／文件创建之前遇到第二个准备检查错误：slice的LoadState为loaded而非not-found。本轮只读现场`/home/joshua/.cache/scholoom-report-system-stop/preflight-qrLwvv`确认四unit文件及runtime/programs均不存在，三个service均not-found；slice无来源／drop-in、inactive/dead、无InvocationID／ControlGroup／Job、非transient，是PID1合成的空对象，尚无探针执行。精确systemd源码`slice_load → unit_load_fragment_and_dropin(..., false)`在没有fragment时也会设置loaded，故原断言错误，不是用户环境冲突。

新增实际被run消费的`unit-preflight.mjs`，复用properties解析，按上述全部字段仅接受无配置／未执行的合成slice，仍拒绝loaded服务及任何配置、运行、原执行或不完整观察。增加普通UID只读`--preflight`入口，和root apply共用相同检查，在创建目录之前退出。主线同一Qjufg2实跑修改前复现loaded断言失败、修改后ready；最终命令与stdout在`/home/joshua/.cache/scholoom-report-system-stop/preflight-accepted-7QxvW7/command.json`，runtime/programs仍不存在。离线12/12、`bundle-yLMhX7`，涵盖原安装保护及新增合成对象／拒绝边界。该自检生成的包只为测试，不更换实际核准身份。相关3文件Biome、OpenSpec strict及diff通过；Codex gpt-6.1-sol/high源码核查及限定只读复核无确证缺陷，preflight仍是状态快照，实际安装后有效配置核对保留。

当前仍21/27，原六项完整任务不勾。Qjufg2本次许可沿用户实际执行保留，不重复请求；修复仅影响未通过的前置检查，可按同一`--apply`命令继续，不用resume-staging，不动原已启动失败包。主线修复后尝试一次同包`sudo -n ... --apply`，仍被本机要求交互认证而未进入校准程序；新包真实root采证／停止未发生，需用户在本机终端执行原完整命令。随后继续系统gate／C-owned对象连续性／M.start与permit、正式通用报告呈现及I5。没有已启动校准的自动重试、新身份校准或完整C/M部署；未提交／推送。

## 首次系统准备失败修复与同包恢复（2026-10-31）

用户在本机执行已授权`bundle-9RQQpI --apply`，实际在程序复制后的run.mjs属性检查失败。主线只读核两副本为uid/gid1000、0775，而父目录及plan.json属root；runtime仅plan.json，三个精确unit均not-found／inactive／无FragmentPath，尚未安装单元、启动native或进入scope停止。本次为脚本错误，不是用户环境缺包；复制API错误地保留了源属主及写权限。实际副本字节／元数据及计划已只读保全至`/home/joshua/.cache/scholoom-report-system-copy/failed-root-Eegv8D`，现场未修改。

同一实际复制模式在普通UID红例`red-O2BGKT`复现；再提取真实调用的installProgram并先跑回归，`bundle-VyllY7`明确0775不等于0555（509≠365）。修复为消费首次核验的Buffer、O_EXCL／O_NOFOLLOW独占新建、显式fchown当前安装身份及fchmod0555／sync，不把旧可写inode改属主后继续执行。新`--resume-staging`只在同包、受保护目录、相同plan及两原批准副本且无unit／drop-in／执行记录时继续准备；其他状态拒绝，不重放工作。

独立Codex gpt-6.1-sol/high审查确认两项P1/P2：unit校验后重读可变路径，及删除旧副本可能丢失旧writer FD的迟到写入。主线已将两个程序、两份unit及stop模板统一消费首次批准的Buffer；失败副本在同一文件系统的root私有failed-staging下以排他硬链接保留原inode，再移除活动名字并创建新inode。成功时仅清理新程序与三unit，失败归档及programs父目录保留，RESULT给出归档位置；原inode的迟到写入不丢失，也不能改新程序。两项已独立复核关闭，无新增阻塞项，README同步。

`node --test tests/fixtures/report-system-manager/check.mjs`最终10/10、1.04秒，原始工件`bundle-NKf8tj`；覆盖原权限回归、已有文件／链接及坏摘要拒绝、准备恢复、旧writer后续写入保留且新程序不变、执行记录／改程序／异计划拒绝，以及原离线与权限边界。主线另跑独立`review-red-green.mjs`两项2/2、0.12秒，证据`/home/joshua/.cache/scholoom-review-repro-mUZ9l9/attempt-HO6Xgt`；其中unit冻结检查仅执行实际源码片段，不是root或完整安装。未重复无变化的生产kernel／UI套件，不据这些检查宣称系统通过。

已授权的实际包仍为`/home/joshua/.cache/scholoom-report-system-manager/bundle-9RQQpI/bundle.json`，不切换到自检生成的新身份。主线尝试同包`sudo -n ... --resume-staging`仍报需交互认证，未改变原系统现场；需用户在本机运行同一完整命令、仅将最后参数改为`--resume-staging`，无需重新授权。当前依然21/27，实际PID1采证／停止及完整报告尚待后续验证。

## SDK编译、固定范围采证与已授权系统校准（2026-10-31）

用户自行安装`libsystemd-dev`后明确要求继续；实际核SDK与运行库均为`259.5-0ubuntu3.4`。原缺头文件阻塞已解决，未由Agent下载／安装其他依赖。主线先成功编译SDK helper，普通UID实际`--check`返回available、完整`--kill`在manager-identity阶段拒绝，精确命令与输出在`/home/joshua/.cache/scholoom-report-system-sdk-check-20261031/{0,1}.json`；原缺SDK失败证据仍保留。

继续实现私有`reportManager.capture`，沿原protocol／认证M服务调用同一原生helper；只有固定config/storage，无任意路径／unit／属性。采证以真实非零InvocationID核原Service、cgroup2只读视图、MainPID／birth／UID/GID／membership及实际CPU／memory／swap／pids，返回前复核原对象。M不据观察结果许可或写C记录，C仍须核自己的对象连续性和登记策略；没有实现start／permit或启用生产system route。stop也补核实际cgroup2文件系统类型。

| 实际验证 | 结果与边界 |
| --- | --- |
| `node --test tests/fixtures/report-system-native/check.mjs` | 28/28，普通UID真实SDK编译、system bus只读API及capture／kill角色拒绝；真实proc对照和边界调用直接包含原C的read_at／birth／account／limit，不复制解析实现。证据`/home/joshua/.cache/scholoom-report-system-native/run-cQUCFx`含原始命令／输出及独立proc oracle；没有成功root capture或停止 |
| `report-control.spec.ts --grep 'authenticated stdio M' --workers=1 --retries=0` | 1/1、2.8秒；新capture与原ping／stop复用真实socket认证，普通UID拒绝，错配置／额外path和其他角色请求拒绝，C根字节保持。输出`/home/joshua/.cache/scholoom-report-system-capture-20261031/m-service-results`；非root不执行SDK helper |
| `node --test tests/fixtures/report-system-manager/check.mjs` | 最终5/5（四子例＋父组），0.93秒。普通准备、只列计划、非root apply拒绝、改变包拒绝和替代根三unit解析；无system manager调用／写入。最终待审包`/home/joshua/.cache/scholoom-report-system-manager/bundle-9RQQpI/bundle.json`及offline-checks.jsonl，两个更早普通UID5/5包独立保留，不作为真实系统实跑 |

主线继续准备了可审阅的**固定可信native OS校准**，入口`tests/fixtures/report-system-manager/`。只涉及一个有setsid握手的父子范围及两个短命root采证／停止单元；随机精确名字由上述最终bundle确定。程序放唯一`/var/lib/scholoom-report-check-<configId>`，日志在唯一`/run/scholoom-report-check-<configId>`；每次reload核实际FragmentPath、空DropInPaths和loaded，再启动。只在原范围确空及父子停止后核原对象清理3份unit／2个程序和空程序目录；unknown保留现场，不按名停止或重试。20秒PID1期限是保护，不是停止回执。它不包含C-owned字节、K准入、完整C/M、LSM、浏览器或通用报告，成功亦不等于完整T1/T2。

原生Codex gpt-6.1-sol/high分别承担自检与独立只读审查，主线负责接口、原生采证及包实现和最终接收。采证源码无确证P1/P2；包审发现两项P2——/run noexec、有效unit继承配置未核——已修复并独立复核关闭，之后重新离线构建／5/5。setsid早报竞争以实际pipe握手修正；scope空前绝不以僵尸或PID消失代替完整停止。独审未运行root或重跑主线测试。

protocol／platform／kernel构建、tools类型通过；最终10个相关JS／TS文件Biome通过，架构14模块285文件0 findings／exceptions，本change strict及diff通过。没有新依赖、账户、系统部署、模型请求或CI执行。用户随后明确回复“确认授权”，已批准上述精确包的临时系统校准与成功后限定清理，不需再次请求这项许可。实际`sudo -n -l`及对完整已授权`--apply`命令的非交互sudo调用均退出1，报告`interactive authentication is required`；校准程序未启动，未创建本次系统对象。已给用户完整绝对路径命令，由其在本机终端完成交互认证；这里只等待执行结果，不索取密码或改用其他提权方式。授权后的文档更新经本change strict及diff检查通过。

当前仍21/27，原六个完整任务保持开放。SDK和本次系统校准授权均不再阻塞；下一步等待本机交互认证后的真实执行结果，沿原`runtime`与bundle收取证据，保持未知和原现场，再闭合系统gate／C-owned对象、M.start／permit及C控制器；通用JS策略、正式ReportView、共同输入、更新／草稿及双宿主I5继续实施。全部可接续输入在持久cache或仓库，未提交／推送。

## 认证服务、系统记录与停止门续做（2026-10-31）

用户指出主线不应在上一片测试完成后停止。上一片没有新的权限或技术阻塞，本轮继续实际实现，原未提交成果保留，未归档、未改变21/27计数。以下均是已有原change内续做，不另建进度账本或关闭完整2.1b。

已增加原生`report-channel.c`及platform适配、实际C服务入口和Client.connectService。原生端核AF_UNIX／SO_PEERCRED、受保护父链／socket owner与连接前后对象身份；stdio中的C先核明确callerUid再接原host，K先核实际listenerUID，socket activation预期PID1。原生relay双向各64KiB，TS用固定共同frameBytes缓冲拒绝坏UTF-8／半帧／超限，不先拼接完整未知正文。真实Socket可通过公开spawn stdio传入，不使用私有_handle。异步建连有尝试代次：晚到认证既不能覆盖新连接，也不能在显式断开后复活。

原records新增显式`linux-system-service-v1`／version2，和原v1用户scope共用IO、完整库存及writer锁，但分别核根及receipt格式、准确unit／cgroup、运行账户和permit对象。系统范围不隐式新建或迁移旧根；默认user OS对system route的check和initialize均拒绝，且不创建目录。旧controller／scope inspector也直接拒收v2。读写共用matchesRoute，save先核version／route、原config及index中的storage／instance，跨路线覆盖前失败并保留原字节。

固定M停止片已写入`report-system.c`、独立build脚本、platform stop适配和`serveReportManager`，同源私有ping／stop仅接受固定callerUid／configId，非root不可用。SDK helper按原InvocationID的opaque路径执行立即Kill，核原boot／unit／cgroup dev/ino及只读视图，从原FD见populated0后才报告范围空；M的scopeEmpty不替代C持久stopped。当前只有源码和非root拒绝路径，**SDK原生编译、真实root停止、M启动／scope采证／permit、安装及完整无迁移保证均未验**，没有启用system route或产品页面。

### 实际验证与独立审查

Linux x64／Node24.12.0，未安装依赖、账户、策略或服务，未发模型请求。

| 验证 | 实际结果与证据 |
| --- | --- |
| `report-channel.spec.ts`首跑 | 19/19、10.1秒；真实Unix socket／350KB多字节分段／2MiB边界、错误账户和路径保护、坏流／send拒绝、真实stdin peer认证及自有进程退出。完整命令和原始log在`/home/joshua/.cache/report-channel-checks-lQj2zh/RESULT.md`；不证明真实跨UID／PID1 |
| C认证服务首跑 | `report-control.spec.ts --grep 'authenticated stdio C'`，2/2；合法账户接原provider、真实多字节资产／start/stop和close退出；错caller在打开记录前失败。`/home/joshua/.cache/scholoom-report-control-20261031/socket-c-first` |
| 主线认证／C与连接边界组合 | `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-control-binding.spec.ts tests/kernel/report-control.spec.ts tests/kernel/report-channel.spec.ts --workers=1 --output /home/joshua/.cache/scholoom-closeout-execution-20261030/report-channel-integrated --reporter=line`，32/32、26.7秒。含新异步尝试代次和上一片真实IPC／库存行为。和作者首跑分开，不相加为一次套件 |
| v2记录及写端保护 | 最新`isolated-report-system-records.spec.ts` 30/30、2.6秒，局部strict类型／Biome通过。双向跨route save拒绝、全盘字节不变及重开恢复，旧controller拒新记录，M缺失不建根。`/home/joshua/.cache/system-records-write-guard-3vzRCO/RESULT.md`保存命令／日志；真实文件与flock，scope／账户是合成值 |
| 原资产／bootstrap／prepare回归 | `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/isolated-report-assets.spec.ts tests/kernel/isolated-report-bootstrap.spec.ts tests/kernel/isolated-report-preparation.spec.ts --workers=1 --retries=0 --output /home/joshua/.cache/scholoom-closeout-execution-20261030/report-records-v2-regression --reporter=line`，43/43、6.7秒。save改动后复验，未改变旧v1格式 |
| M角色普通账户拒绝 | `report-control.spec.ts --grep 'authenticated stdio M'`首跑1/1；真实socket认证后合法ping/stop因非root不可用，错配置／额外path／C六操作被拒，原privateRoot与字节不变、C计数0，M子进程正常退出。`/home/joshua/.cache/scholoom-report-control-20261031/socket-m-first`。没有执行SDK helper或任何系统动作 |
| SDK helper编译前置 | 独立build脚本实际exit1：`/usr/include/systemd/sd-bus.h`缺失。精确命令和原始build.log在`/home/joshua/.cache/scholoom-report-manager-pre-sdk-1793445763330`，不计为C源码已编译。已有运行库libsystemd0=259.5-0ubuntu3.4；已请求同版libsystemd-dev仅下载／解包到持久cache供编译，授权待答复，尚未下载 |

本轮按模块分配原生Codex gpt-6.1-sol/high辅助测试与独立只读审查，父线负责认证／协议／v2数据格式／M适配及最终接受。独审确认两项P2：异步旧建连覆盖新连接、save允许跨route覆盖。均修复并独立复核关闭，前者以隔离进程仅替换platform开通端口、执行真实Client／RpcPeer的回归核实；后者真实flock双向复现后增加写前拒绝与字节保护。未修改旧失败记录或将坏磁盘注入当合法保存。

SDK停止端仅静态审查，未发现新增确证P1/P2：固定259.5源码支持invocation路径失效后不回退名称，Unit.Kill处理unit_kill后才回复。必要前置仍包括固定模板无迁移／非预期重启、正确M身份与只读cgroup2视图；该调用不具有外部dev/ino原子CAS。35秒外层／45秒RPC与Kill后10秒settle及真实停止仍需编译和系统验证，不能据静态审查放行P或结清C记录。

本轮protocol／platform／kernel构建、tools类型、相关Biome及架构已通过，架构14模块285文件0 findings／exceptions；原生SDK部分除外。最终收尾检查与少量已构建M／C复验在下一段补记，不据普通UID替身关闭完整I5。

最终固定新protocol／platform／kernel产物后，再运行`report-control.spec.ts --grep 'authenticated stdio'`，3/3、4.2秒，结果在`/home/joshua/.cache/scholoom-closeout-execution-20261030/report-service-final`；同次tools类型通过。18个受影响生产及测试文件Biome退出0（仅2条useTemplate info）、architecture及本change strict／diff通过。Root helper仍只有缺SDK的真实编译前置失败，不在上述构建或3个普通UID服务例中。最后仅补原生源码的无迁移／无重启前提注释，没有改变行为或倒填编译成功。

### 当前待续

SDK缺失及本次精确系统校准包的授权已在上方续做中解决，普通UID验证也已完成；本机sudo交互认证待用户执行，实际系统校准尚未启动。随后补系统gate／C-owned对象、M启动／完整scope采证／permit、固定注册与实际跨账户T1；本次临时校准不授权完整C/M部署，通用JS运行策略／正式ReportView／共同输入、更新恢复和Linux双宿主I5继续沿原六项。未提交／推送，所有可接续输入在持久cache。

## K/C控制接线与帧预检（2026-10-31）

用户继续指定本change，基线`503cda9`，本轮保留21/27，原六项未完成判据不变。`apps/kernel/src/report-control.ts`新增实际双向RPC装配：C消费完整原provider，独占receipt／assets的物理写入和生命周期；K保留领域授权、冻结字节与唯一ProcessAdmission。未把可原地修改的receipt拆成远程records/assets，未新增第二调度／权限／存储。私有契约在同一`protocol/isolation`，原六操作直接复用，不注册公共broker、不新增platform对broker依赖。

C按准确configId打开既有原配置、加载完整库存，等待K恢复全部未确认占用后才停止核对，以每页64项及完整总数返回。K在完整屏障前不开放新操作，正常断线或C被SIGKILL均保留原占用，重连不重放。reserve与ready分开，满额不冻结；原多字节文件经256KiB分片交付，由C在真实文件FD提交和原记录上保存。C冻结RPC超时而K读取仍在途时继续保留K槽位；本地读取结清前close也不完成。只有持久停止／准确停止投影／完整库存或关闭屏障才能结清，旧通道不能向新peer注入重复请求号的响应或断开新连接。

`tests/fixtures/report-async-dom/frame-budget.mts`集中原64KiB帧／4信用／1024字符串／512节点预算。source在Array.from及排包前扫描真实UTF-8／JSON转义字节；receiver整帧检查累计预算、节点重复及已有操作判据后才提交计数。去掉暂存字符串flatMap副本。新增自检在现有build/run执行，双宿主重复节点反例核预算／DOM不部分前进、不消费失败帧ACK。HTTP完整state／receipt信封、总堆及OS保证未在本片关闭，没有添加模型payload字节限制。

### 实际验证

Linux x64、Node24.12.0及既有Electron44.5.1；依赖未变，没有安装或加载系统账户／策略／服务，工件不依赖/tmp。

| 验证 | 真实结果与范围 |
| --- | --- |
| `pnpm --filter @scholoom/protocol build`、`pnpm --filter @scholoom/kernel build` | 通过；首次kernel编译暴露generic索引递归展开和exactOptionalPropertyTypes，已改为先解析各具体schema类型及准确undefined声明，没有手写DTO字段或放宽编译规则 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/report-control.spec.ts tests/kernel/report-control-binding.spec.ts --workers=1 --retries=0 --output E/final-results --reporter=line` | 最终10/10、18.1秒；`E=/home/joshua/.cache/scholoom-closeout-execution-20261030/report-control-rpc`，精确命令／退出码在final-command.json，原始输出final-tests.log。此前第一组8/8另在first-*保留，不混算。实际C独立PID、原文件／flock、>256KiB多字节资产、同一准备Promise／单租约、queued stop、在途stop／5秒freeze超时、错配置磁盘不变、正常断线与SIGKILL后的64+1分页恢复、零重放、旧连接响应与断开失效、不完整库存保留占用、close等待本地loader |
| 原provider/bootstrap最小回归 | 同一kernel命令对`isolated-report-preparation.spec.ts`和`isolated-report-bootstrap.spec.ts`，grep为`full admission\|persist\|uncertain\|wrong\|async`，4/4、3.0秒，输出在E/platform-results。核真实文件准备、停止持久失败保持unknown、原uncertain恢复和错误config，不重跑完整native策略矩阵 |
| 帧预检自检与双宿主拒绝 | 作者私有构建、独立types／Biome、帧／字符串／信用自检通过；旧503cda9双宿主红例2失败，修正后同例2/2、49.3秒。完整命令、独立原生JSON/Buffer oracle、65536边界、Unicode／孤代理及拒绝前无bulk copy证据在`/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom/frame-preflight-nnTTZ2/RESULT.md`与其checks／red／green |
| 主线普通输入回归 | `node tests/fixtures/report-async-dom/run.mjs 'baseline native input layout forward'`，Browser与真实Electron2/2、54.3秒，证据`report-async-dom/run-1793438715014`。本次私有构建、provenance、types、字符串／帧／信用自检均exit0。和上述拒绝例是两次不同运行，不称完整UI矩阵 |
| 静态检查 | kernel／platform构建、platform类型、tools类型通过；架构14模块282文件0 findings／exceptions，OpenSpec strict与相关Biome／diff通过。最终静态收尾命令和结果沿下方补记，不把夹具成功写成完整隔离 |

### 审查、替身和接续

父Agent负责跨模块设计／主线实现和接收，原生Codex `gpt-6.1-sol/high`分别实施协议／平台与IPC夹具、帧预检并独立窄审。审查确认旧无代次receive存在P1；已将connect改为返回绑定原peer的receive／disconnect闭包，消费方同步更新，同id／合法结果的旧帧与旧disconnect均被代表测试拦截。独立复核关闭该P1，本控制RPC范围没有剩余确证P1/P2；不扩大为原生隔离或完整报告审查。主线另补close等待K loader及对应行为测试。

IPC夹具的records／assets／native flock和进程确实运行；领域描述／授权、支持探针、OS controller／stopRecovered及传输身份是明确替身。SIGKILL恢复证明原记录与K租约的机械链路，不证明真实系统范围已经停止。作者最初夹具类型受ES2023限制、错误配置收尾重复抛原错误的失败保留在`/home/joshua/.cache/scholoom-report-control-20261031/`，不能当产品行为红例。原平台native六操作仍只支持固定静态策略，不伪装为Node／浏览器策略。

最终收尾再次运行tools类型、15个受影响源码／夹具的Biome、`node scripts/check-architecture.ts`、本change strict、`git diff --check`和contract-types自检，全部退出0；Biome保留旧DOM夹具的42条warning及1条info，未修改规则。独审另核最后close等待loader改动，无新增容量／代次回归。CLI刷新仍为ready、21/27；未因新增子范围改动完成计数。

具体下一步为C/M系统身份认证／固定OS管理门与通用JS运行策略，接通受限source和正式ReportView，再汇合现有共同输入、更新、草稿及完整Linux双宿主I5。当前C RPC仅由真实独立测试进程消费，尚无可安装完整C/M包；不申请空白系统部署授权，也不据测试启用生产报告。2.1b、2.2、3.1、3.2、4.1、4.2保持未完成。未发真实模型请求，未跑全仓CI或系统IME／读屏器、Windows／macOS分发验收。

## HTML摄取与字符串预检接续（2026-10-31）

用户要求“推送，然后继续实现活动change”及“提交并推送”。已将文献综合修复、验收、规格同步及归档提交为`3f7a3ec`并正常推送`origin/dev`，随后继续本change。当前仍21/27：本片修复实际HTML／MathML摄取和一项源端扩容前检查，不以夹具通过关闭2.1b／2.2／3.1／3.2／I5。没有安装依赖、账户、策略或服务，生产仍沿原不可用状态。

固定fork的parser改为由实际父节点及HTML／SVG／MathML整合点选择新节点namespace；片段上下文透过原合成q包装保持，兄弟节点不沿用上一个外来内容的namespace。MathML文本整合点保留mglyph／malignmark例外，annotation-xml按encoding选择HTML或SVG内容。独立审查发现大写ENCODING／VALUE仍失败的P2，主线真实红跑后在属性写入处规范HTML／MathML属性名及definitionURL，不加getAttribute fallback；原审查员复核关闭。未修改原同步取消反例、许可或固定上游版本；源码113项可核、11份local diff反向检查通过，MIT parser保留原许可证及本次修改声明。

证据根`E=/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom`，Linux／Node24.12.0／既有Chromium及Electron44.5.1，实际命令与各次原始结果如下：

| 验证 | 实际结果及边界 |
| --- | --- |
| `node tests/fixtures/report-async-dom/run-html-ingestion.mjs` | 原实现`html-ingestion-1793429545610`exit1、普通MathML节点为XHTML；首修`1793429654152`原样本exit0。独审P2红`1793430259852`与最终绿`1793430333561`保留，后者七组源子树与独立原生Chromium的namespace／text／input值完全一致，source退出0、oracle已关闭；没有工作台或kernel |
| `node tests/fixtures/report-async-dom/run.mjs 'baseline'` | `run-1793429870048`双宿主6/6，1.8分钟：原两种布局及新增HTML字符串路径，真实mutation／原生输入／滤选展开与同源码原生oracle一致 |
| `node tests/fixtures/report-async-dom/run.mjs 'unsupported\|native click cancellation\|race'` | `run-1793430023520`双宿主12/12，2.8分钟：真实原生取消闩锁、普通输入ACK／CDP组合事务及版本／关闭迟到保护；不是系统IME或读屏验收 |
| `node tests/fixtures/report-async-dom/run.mjs 'HTML ingestion'` | 最终`run-1793430372722`双宿主2/2，54.7秒：同时核真实分数上下布局、非零字形宽度和MathMLFraction辅助角色。该私有source bundle已含最新字符串扫描修复；原6例及后续12例分次保留，不相加为一次完整队列 |
| `node tests/fixtures/report-async-dom/build.mjs E/final-20261031/built`，再`node E/final-20261031/built/string-budget.mjs` | 实际store八组通过，E须替换为绝对路径。UTF-8计量不编码完整副本，覆盖ASCII／多字节／代理对／孤代理、拒绝后原表／额度保持、1024项及65536字节边界、跨consume累计及去重。辅助旧实现红、局部绿及命令见`string-budget-TKkjo4`，主线在正式可复建入口复验8/8；独立审查无确证P1/P2 |

原生对照首次扩展有一项TS可空检查失败，另一次detached节点的上游querySelectorAll返回空而非子树；改用实际childNodes遍历采证，未改原生期望或掩盖差异。这两次失败不算namespace产品红例。最终fixture独立类型、相关Biome、architecture（14模块／281文件／0问题）、OpenSpec strict及diff通过；Biome保留原有any／非空断言警告，没有放宽规则。第一轮UI格式首败修正后通过。未修改产品组件或共享dist，不跑无变化整仓检查。

本次字符串修复只替换入表前的TextEncoder整份编码为无分配UTF-16扫描，原1024项／64KiB与consume／去重契约保持；该容量属于页面字符串表，不是模型出站payload上限。它不证明总堆内存或共同扩容预算：动态innerHTML、部分DOM属性／样式、初始化节点、mutation临时数组及传输副本仍须在实际增长点核验，OS资源约束也不可由普通Node进程代替。最终端口6309已无监听；各UI原source／关闭证据沿测试输出保留，不扩大为系统T1／T2或完整进程停止证明。

下一步仍沿原六项：先闭合源／宿主共同扩容预算及通用脚本承载，再接K/C/M实际身份、持久回执、原库存与唯一准入，完成正式ReportView、更新恢复和双宿主I5。只读核查确认provider仍直接拥有records/assets，现有controller还是user-scope，没有可直接安装的真实C/M服务或生产消费者；不以再提取一层启动状态模块冒充跨身份装配，也不申请尚无可审阅实现的空白系统权限。所有新输入／证据在持久cache，不依赖/tmp。

## 已接受异步边界与新适配验证（2026-10-31）

用户“授权；接受。请继续进行收尾”明确选择保留通用HTML／JS、共同tab和原生控件，并接受不支持跨进程同步取消原生默认动作：触发即明确失败，保护已确认成果／草稿，不伪造取消。proposal／delta／design／tasks已据此更新；只调整这一项语义，其余隔离、输入／辅助、更新恢复及I5保持。旧WorkerDOM同步取消的0/2反例和停止点保留。系统账户／策略／服务安装仍未授权；本change仍21/27，不能归档。

新的`tests/fixtures/report-async-dom/`只读复用固定WorkerDOM113文件和许可，运行真实源进程／mutation／原生事件／确认、共同Workbench tab及Browser／真实Electron，不接生产。首组14/14通过；随后对修正后的竞争代表8/8、嵌套同类合成事件6/6分别复验，原生click取消补验2/2通过，均为独立运行，不相加为一次全套。守卫识别源实际原生事件对象，覆盖可取消事件；报告catch后仍闩锁失败，不发成功ACK、呈现mutation或桥动作。源内部合成事件沿自身语义，不能按事件名一概拒绝。布局／显式namespace MathML、普通输入、原生焦点／选区保持、筛选／排序／展开、CDP组合事务、迟到输入／替换／关闭及发送信用耗尽有各自代表；CDP组合不是系统IME，普通DOM／控件可查询不是读屏验收。

证据根`E=/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom`，原摘要`validation-summary.json`、原生click追加回执`followup-native-cancel.json`及各次原命令／首败／source退出回执保留。两组布局及竞争不重复旧同步取消反例。父线补README和根typecheck独立入口；私有构建、类型、格式和信用耗尽检查已有exit0。该片没有报告正式资源／授权、C/M或OS隔离；未据成功扩大能力。HTML字符串摄取另在有界验证中，上游strings／nodes／mutation及适配器复制在分配前的共同预算仍未证，不能把发送信用当总内存保证。

真实HTML摄取已出现新的决定性源端失败：本地`html-ingestion.html`通过原body.innerHTML→Element.innerHTML→固定html-parser.parse后，math／mfrac／mi／mn全部为XHTML namespace，即使声明MathML xmlns也不改变；同片input则确为原HTMLInputElement且初值正确。原解析器只有SVG切换分支，普通xmlns属性在节点创建后设置，不能补正身份。`run-html-ingestion.mjs`实际exit1、自有source closed；证据`E/followup-html-ingestion.json`及`html-ingestion-1793381132378/`。私有构建／类型／provenance／Biome通过，未启动UI／kernel，不把显式createElementNS的既有成功算成HTML字符串支持，未删数学或改旧断言补绿。

按有界计划在新语义反例处停止本适配片，保留可复现失败。下一步须解决真实HTML的namespace语义和扩容前预算，之后再按design沿K唯一provider／admission、C唯一records／资产writer、M固定OS动作接实际服务及正式呈现。当前T1校准包仍缺真实C绑定、C/M ACK和许可生产者，ADMIN-PLAN明确不是可执行安装包，不申请空白系统权限。完整T1／T2、生产ReportView、更新恢复和I5未完成；本轮没有安装依赖、修改系统或宣称两个宿主已可使用活动报告。下文“待选”是此前历史截点，以本节及当前规格为准。

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

主线独立调查补得systemd v259.5按InvocationID对象路径停止的正式机制，并用普通UID实际只读XML introspection确认本机公布GetUnitByInvocationID；未调用生命周期方法，不以此证明目标授权／完整停止。定版源码、竞态与权限差分见[停止依据](../../../../.scratch/scholoom-foundations/research/report-invocation-stop.md)，原始证据在第22轮根stop-identity-research。已告知生态线作为待校准候选，保留M只读cgroup视图。

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

证据根`/home/joshua/.cache/scholoom-round20-acceptance-INWZnx/next/research-interaction/`；短TMPDIR由attempt-1/short-tmpdir.txt记录为`/home/joshua/.cache/r2c-ycpMSD`。必要源码在Git夹具，输入／profile／配置／结果在cache，无现有/tmp前置。Workbench／源页在夹具build重新bundle，产品main／preload／kernel复用主线已验产物，不冒称重建产品。复建与手动入口见[README](../../../../tests/fixtures/report-input/README.md)，静态harness沿round13保全入口。

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

已交可重建自动／手动入口，见[原型README](../../../../tests/fixtures/report-structure/README.md)。原型复用真实独立源页／控制器、Workbench共同资源tab和原生文档克隆／frame；实际状态、表单属性、HTML／MathML结构来自源DOM，源脚本不进入父页或frame。固定合成资源／session及可信HTTP控制器是替身，无ReportResources、provider、服务／隔离、生产容量或完整停止接线。实际结果及架构差分由[investigation的R2b节](investigation.md#r2b保留原结构的可信对照第19轮本片0d27cff)维护：数学结构／普通文本及顺序输入可保留，但在途旧回包替换整份srcdoc会丢失未提交组合“队列”，候选仍不能作为完整报告呈现。

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

夹具使用实际Workbench／TabGroups／renderResource及原生React文本／表单。独立Chromium里的固定可信页实际处理筛选、排序和展开，控制器从当前DOM取3行以内快照，父页没有源页HTML／脚本或第二份排序／过滤逻辑。实际双宿主测试结果与MathML反例由[investigation首节](investigation.md#r2有限可信语义投影的双宿主校准第18轮e4c4e422)维护；原型代码与自动／手动入口见[README](../../../../tests/fixtures/report-surface/README.md)。HTTP控制器、session及ResourceTarget均为合成替身，不提供ReportResources授权、独立身份服务或隔离／完整停止／容量保证。未重新实施报告选择模块，未接模型或真实库。

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

实际成果为[独立身份服务研究](../../../../.scratch/scholoom-foundations/research/report-independent-identity-service.md)，原investigation／design／tasks仅链接相应事实、候选与下一步。研究给出独立控制身份、受控固定启动门、每实例运行身份及其认证／只读字节／FD／完整浏览器图／配额／unknown恢复／停止／运行时字体／安装升级卸载范围；已核事实、假设与最小T1/T2分开。R1受保护的请求者／唯一准入证明、R2双宿主文本与可访问性surface、R3跨身份启动／部署权威须主线选择，未用名字／配置补齐未知。保留原页面隔离及桥规格，不以未批准候选新增生产SHALL或公共DTO。

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

`add-linux-isolated-report-provider`的9/9任务已接入主线并通过独立审查整改与真实OS验证，详见其[交付记录](../2026-10-30-add-linux-isolated-report-provider/delivery.md)。主线`main-final-kernel.{log,json}`联合118/118中，固定静态native提供者17项实际执行、无跳过；完整归属／停止、恢复／唯一准入及预执行限制仅对登记的Linux x86_64静态策略成立。提供者仍是内部六操作，不接生产宿主、报告浏览器、呈现或工作台，不能由此关闭本change的2.1b／I5。

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

本轮先确认HEAD=`58eda1404fcc60036ce0e0f3ce30d5453ce1ee30`且clean，读取AGENTS、原tasks／delivery、共同计划第十四轮及scholoom-dev／当前instructions。主线已选Linux普通权限独立提供者先行；没有同名／等价活动change，已新建[add-linux-isolated-report-provider](../2026-10-30-add-linux-isolated-report-provider/proposal.md)，完成proposal／investigation／specs／design／tasks规划。新change没有生产实现、没有delivery，公共签名仍按其1.1交主线审，不自动apply。

原报告只更新design／tasks的正式提供者前置链接和本交接记录。报告仍6/13、活动页unavailable，2.1b／I5、目标／旧版本Adapter未关闭。ReportResources继续管原ref／basis／read/send；新provider计划只收批准的有界字节，不把临时C程序、dev／ino或原生实验当领域版本或生产授权。公共分片封存操作、唯一ProcessAdmission恢复结清及先于准入的恢复屏障建议见[新design](../2026-10-30-add-linux-isolated-report-provider/design.md)，真正OS前置／syscall／控制器丢失缺证及下一最小校准见其investigation／tasks。

本轮仅静态复核现有调用点和已接收三cache源码／原始结果，未重跑CPU／OOM／FD或其他原生样本、浏览器、UI、模型／真实用户库。现有生产源码与已验f4ab1e5相同的主线构建回执予以复用，没有声称本轮重建。调查辅助为gpt-6.1-sol／high、无历史fork，只读本树；主会话核对正确platform/native路径、范围／准入事实并保留设计判断。

命令及规划检查结果保留在`/home/joshua/.cache/scholoom-linux-provider-plan-round15-7V4Vot/`：`openspec list --json`／`list --specs --json`、`new change add-linux-isolated-report-provider --schema scholoom-dev`、各工件instructions、status／apply、两change strict、schema及diff／补丁核查。新change strict首次通过；探索时猜测不存在的规格／策略文件已改用实际路径，原命令未运行生产或实验。当前工作仅规划，类型／生成／架构执行检查及OS实跑不适用，不将原CI／主线UI结果当隔离通过。

必需接续输入是新change的Git工件，以及`/home/joshua/.cache/scholoom-report-platform-round12-fNGQLv/`、`/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT/`、`/home/joshua/.cache/scholoom-report-gate-round14-DocB5o/`的既有固定源码／证据；精确文件索引由新investigation维护。新payload／检查／补丁根及TMPDIR为本轮cache，无现有/tmp内容前置。没有启动服务／native进程／开发服务器，辅助结束关闭；无安装下载、提交推送／PR／archive、同步／其他树或真实库操作。

停止于规划交回：主线审公共签名与首个native策略／失联停止校准，再给明确实施切片。Linux提供者未交付前不启用报告；完整browser进程图、文本／可访问性、呈现、分发维护与预算及Windows／Mac仍待相应真实方案／目标证据，本轮不代替主线决定或降低保证。

## 第十四轮主线验收

本轮四工件及高FD／SCM_RIGHTS／stdio／普通文件门的有限对照已保全合入，独立两轴审查无确证问题；被拒启动与实际OS拒绝、危险迁移与全部scope收尾分别表达。主线未重复原生实验或将固定样本当生产能力，活动报告unavailable、2.1b／I5继续开放。

用户授权主线选择后，下一片先规划独立Linux platform隔离提供者，复用当前准入和归属，明确实际配额、受控字节交付、预执行门、控制器丢失／unknown恢复及独立验收。只形成apply所需工件，不把临时launcher复制进生产或预设共同画面流；现有用户权限不能兑现保证则不可用。方向见design“下一片”，调度见[共同计划](../../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)。原生源码／结果在原cache，后续无现有/tmp前置。

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

当前实验源码、反例矩阵和前片scope样本在各自cache，接续无须旧/tmp。下一片只在同样有限保护下调查高FD／SCM_RIGHTS入口、普通文件类型核对和迁移句柄阻断；精确范围见[共同计划](../../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)。权限／部署／呈现和完整平台保证继续待定，不据新窄样本采纳画面流或替代原停止／容量证明。
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

四份候选调查工件已冻结合入，两轴独立审查未发现确证夸大；未运行新的隔离／双宿主实验，2.1b仍未实施。下一片只准许本机已有工具、普通权限下的有限原生机制校准，先查必要namespace／配额／归属条件，缺失即明确交回；不采纳画面流或新的UI／产品架构，不安装／提权／改变系统配置或运行无约束浏览器。正式呈现体验、部署权限、运行时分发和资源预算继续待定，活动页不可用及完整I5开放保持。具体边界沿[共同计划](../../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)。

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
