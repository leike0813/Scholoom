# 实际交付与交接

## 第23轮恢复库存修复验收（2026-10-30）

项目树原始冻结提交与主线均为`5e6220026352df6130f021912b32e285a3fd8ad4`，相对6e88817仅三个文件。原records.load在验证config/index后、读取任何恢复receipt前，对pinned根有界流式枚举并核固定元数据与index目录；未知、缺失、错误类型或枚举失败拒绝，原数据与身份保留。create、writer锁、receipt／scope校验、停止与唯一准入未变。原host-loss测试的两份调查JSON移到本例privateRoot之外，不扩大根白名单或改生命周期断言。

主线证据根`/home/joshua/.cache/scholoom-round23-acceptance-gvcJBu`。实际先运行`node node_modules/typescript/bin/tsc -p packages/platform/tsconfig.json`及原native fixture构建，再在固定产物运行records七例和`real host SIGKILL restores holds before reconciliation and never replays`一个真实scope代表，**8/8，4.9s，无跳过**。故障包括未索引receipt、残留临时文件、错误目录类型及不可枚举根；原配置／index／receipt字节与根成员保全，正常恢复／原预算边界保持。host-loss仍核完整后代退出、停止保存故障unknown、恢复落盘后结清及原锁拒绝第二provider。命令及退出码见project-checks.json，原输出inventory-and-host-loss.log及results/。tools类型、三文件Biome及架构14模块／271文件／0 findings均通过。

独立default／gpt-6.1-sol／high静态审查无确证P1/P2，已关闭，准确源码依据在inventory-review.md；审查未另跑测试，不合并为额外通过数。作者原失败、格式修正及其8/8在第22轮根next/project-execution/RESULT.md保留。主线已取得本change delivery instructions，按实际证据关闭4.1，当前10/10。

这只补本提供者初始化的完整性，不宣称宿主其他模块存在全局恢复屏障，也不证明C-writer跨UID、system service、浏览器／活动报告、T1/T2、其他平台或分发。原Linux native限定策略及后续报告change的未完范围保持，未新增安装／模型／CI授权。

## 2026-10-29 主线接收补充

独立 native provider 增量已进入主线共同源码，并由主线在本机 Linux x86_64 显式准备 native fixtures 后完成真实 OS 联合验证。本次已重新取得本 change 的 delivery instructions，只补充已有主线结果；下文 1.2 校准与独立实施的原失败、修正及证据边界保留，最终验收与提交由父 Agent 负责。

证据根为 `/home/joshua/.cache/scholoom-finish-active/`：

| 主线实际验证 | 结果与证据 |
| --- | --- |
| platform 原生与 TypeScript 构建 | 主线已完成构建，日志为 `main-platform-native-build.log`、`main-platform-ts-build.log`；两份日志为空，不将空日志本身当作独立退出码证明 |
| 固定 native 样本重建 | `main-native-fixture-build.log` 指向本轮 `main-native-fixtures/isolated-report-native/probe`，真实 OS 组使用显式 `SCHOOLOOM_ISOLATION_TEST_CACHE` 输入 |
| `playwright.kernel.config.ts` 联合组 | `main-final-kernel.json`／`.log`：118/118，0 skipped／unexpected／flaky、retries=0。其中 provider 真实 OS 组 17/17，另有未登记程序拒绝用例、两项真实记录回归、三项隔离契约及九项 ProcessAdmission 回归；118 为跨域联合总数，不全归 provider |
| 共同构建与静态检查 | `main-all-desktop-build.log` 记录 desktop 构建完成；`main-final-lint.log` 无 error，保留既有 114 warnings／39 infos；`main-final-architecture.log` 为 14 模块、263 文件、0 findings、0 granted exceptions |

`main-joint-stats.json` 与原始结果一致。`main-final-ui.json`／`.log` 另记真实 Browser／Electron 联合 10/10、无 skipped／unexpected／flaky；该组覆盖材料、文献组织与任务来源，不是报告 provider 的浏览器或 UI 验收。

当前 `tests/kernel/isolated-report-provider.spec.ts` 的真实 OS 组仅在 Linux x86_64 且显式设置 `SCHOOLOOM_ISOLATION_TEST_CACHE` 时运行。普通 CI 未准备该输入时跳过此组，不能据 CI 通过宣称 OS 保证通过；本轮主线显式 cache 下 17 项实际通过，与缺输入跳过分别记录。记录存储及契约检查也不冒充真实 scope 执行。

独立审查 `provider-independent-review.md` 尾部“冻结修正窄复核”确认原 P1（缺 config 覆盖原 index）与 P2（合法长 ID 写出后超读取预算）的致因已修，限定复核范围无新增 P0–P3。两项对应真实记录回归在本次联合组通过；迟到 running 的保护仍按该报告的源码结论表述，不冒充人工竞态实跑。原 34 通过／1 失败及后续 17/17 的历史不改写，窄复核也不扩为对当前全部源码、原生链或全部故障时序的重新审查。

主线接收仅覆盖平台内部 `platform.reportIsolation.check/stage/put/start/get/stop` 六操作及已列的独立 native 保证。真实 broker、唯一准入、私有文件、controller、scope、namespace、seccomp 和信号链使用固定合成批准字节／可信登记程序／可控授权闭包；生产宿主注册与恢复屏障装配、ReportResources 冻结字节 Adapter、报告浏览器完整进程图、报告 UI／文本／可访问性和分发仍未接入或未验。原报告 2.1b／I5 与活动页 unavailable 保持，Windows／macOS、机器重启及科研质量不由本次接收关闭。本次整理未运行测试、构建或服务，任务进度仍以 [tasks](tasks.md) 为准。

## 本次独立 provider 实施（cb5f7ed3）

2026-10-29，从共同`cb5f7ed30f69b45301c83f296268578051b84e0b`、起始clean直接实施已授权2.1–3.3；当前仍在同一HEAD，无提交／同步／推送。使用本地OpenSpec apply与codebase-design，实际执行后重新取得delivery instructions。独立提供者、同源隔离叶、原生controller／gate、构建、共享恢复结清及对应真实测试已形成；宿主产品注册、ReportResources冻结字节消费者、报告UI和浏览器均未接线。

实际写集与入口：

- `protocol/platform-isolation.ts`及`@scholoom/protocol/isolation`：六操作、严格清单／路径、数量／字节／frame和canonical base64；类型均从schema派生，没有全局operations增量。
- `platform/isolated-reports.ts`：唯一reservation覆盖排队／准备／执行，按已持久offset与物理见证写入／封存，领域授权在排队后及G前复查；同ID只核原意图，不重放。
- `isolated-report-records.ts`：目录FD固定私有写入，配置绑定原根身份，真实flock单writer，文件／目录同步，索引最多4096条且统一1MiB读写预算；缺配置而已有记录时拒绝恢复，保留证据。
- `isolated-report-controller.ts`与两份C：真实用户scope及CPU／memory／swap／pids读回，sealed memfd复制到只读私有视图，非白名单FD关闭及默认拒绝seccomp。可信controller在G前跟踪唯一gate；内核TRACEEXEC事件才确认实际exec，继续跟踪且不detach，EXITKILL不足即拒绝放行。目标仍禁止ptrace。gate pidfd观察根退出，完整子孙与原scope确认分开。
- `ProcessAdmission.settleRecovered`：仅原recovered世代可结清，拒绝／迟到／live确认不释放；live未知承诺保持pending。停止记录持久化后才暴露stopConfirmed并释放或结清，记录失败仍请求真实范围停止。恢复控制使用固定原cgroup目录FD，避免按同名unit或旧PID发信号。

design总览图中的provider、记录、原生门、scope与恢复链由真实独立模块实现；ReportResources→批准字节Adapter仍是虚线。版本与文件冻结见`/home/joshua/.cache/scholoom-finish-active/research-interaction/frozen-source.json`；原生scope blob为`f95e82b0f6b002a70e843a484111acbf33ece978`，与独立审查读取版本相同。只支持登记的Linux x86_64静态native策略，预算全部由可信登记提供，样本预算不成为产品默认。

### 实际命令及结果

所有临时输入、配置、记录、样本、结果与补丁位于`/home/joshua/.cache/scholoom-finish-active/research-interaction/`，命令显式设置该根为TMPDIR／SCHOOLOOM_ISOLATION_TEST_CACHE。没有当前`/tmp`旧内容前置；正式测试样本、host夹具和重建入口在Git写集中。

```sh
export TMPDIR=/home/joshua/.cache/scholoom-finish-active/research-interaction
export SCHOOLOOM_ISOLATION_TEST_CACHE="$TMPDIR"
node tests/fixtures/isolated-report-native/rebuild.mjs
node node_modules/typescript/bin/tsc -p packages/protocol/tsconfig.json
node packages/platform/build-process-scope.mjs
node node_modules/typescript/bin/tsc -p packages/platform/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/kernel/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
node scripts/check-architecture.ts
node packages/protocol/scripts/contract-types.mjs --self-test
```

以上构建／类型通过，architecture为14模块、261文件、0 findings；完整日志为`final-build-*`、`final-type-*`、`final-architecture.log`。最终phase投影一行保护后只重建受影响platform TS，再固定产物跑provider全组，见`phase-projection-final-build.log`。未重建无源码变化的desktop／宿主，也没有UI、全仓CI或跨平台运行。生成器原始`--patch`给出既有格式差异；经现有Biome格式化后七份生成映射完全一致，见`final-contract-normalized-check.json`，未应用该补丁或改其他域映射。

| 执行 | 实际结果与证据 |
| --- | --- |
| 首次编译 | 原生-Werror因缩进失败，`native-first/build.log`；TS首次缺O_CLOEXEC声明／exactOptionalPropertyTypes，`platform-ts-first.log`；均在运行相关样本前修正 |
| 原生门诊断 | `native-first/probe-first.log`及`probe-bindfd.log`保留ro-bind-data执行ENOENT／deleted memfd解析失败；改私有复制再整体只读重挂。原生执行、mount与exec相关trace仍在同目录；没有把门到达当样本科研成功 |
| 首批20项 | `test-suite1.log`：18通过、2失败，分别为停止可见性早于持久回执、as-pid-1控制器丢失后范围仍活。`loss-observation.log`与对应根的`controller-loss-first.json`记录到四个真实存活program，随后按原范围收尾；未延时期限定通过 |
| reaper／根退出修正 | `reaper-directed.log`：2通过、detached-exit仍失败。保留可信reaper并在门前固定gate pidfd后收尾；`provider-suite3.log`八项通过，但其CLOEXEC推断仍不足，未作为最终执行保证 |
| exec事件真实校准 | 主线明确采纳TRACEEXEC／EXITKILL；`provider-trace-first.log`16通过，`exec-cancel-and-native-settle.log`2通过，含实际门前取消无exec事实、原cgroup句柄完整停止。未放宽目标syscall策略 |
| 首个35项组合 | `final-kernel.log`：34通过、1失败；provider私有根初始化前被夹具stderr写入，新空根保护正确拒绝，详见失败根及`${config}.stderr`修正边界。原测试原期限定向复验`host-boundary-recheck.log`1通过；没有写成35项首轮全绿 |
| 最终provider | `provider-final.log`：17/17通过，含只读固定样本实际syscall拒绝、特殊文件／替换／原inode内容变化、排队撤权、detached后代、快速exit与非零退出、controller／host SIGKILL、门前取消、复制配置、恢复持久化失败／原占用、原cgroup正向停止与失配不杀 |
| 其余最终组合项 | 上述35项中的真实记录2项、schema3项、ProcessAdmission9项及原ManagedCommands／HostConnection4项均通过。没有为最终一行phase投影重复无关组；其余模块复用对应同源已验产物 |

组合实际命令为`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts`，文件包括`isolated-report-provider.spec.ts`、`isolated-report-records.spec.ts`、`isolation-contracts.spec.ts`、`process-admission.spec.ts`、`managed-commands.spec.ts`、`host-connection.spec.ts`，并用grep限制为本模块全组与既有控制器丢失／恢复满额／同内核不重复／停止落盘失败代表例。完整argv保存在同根复建／核查入口；结果目录为`final-kernel-results/`及`provider-final/`。未加retry、统一sleep或延长生产／测试时限。

### 独立审查与边界

主线安排Hume独立只读审查，报告`/home/joshua/.cache/scholoom-finish-active/provider-independent-review.md`。确认的P1（config丢失覆盖原index）与P2（合法长ID索引写出后不可恢复）均按根因修正，`isolated-report-records.spec.ts`用真实文件／native flock回归：保留非空原index并拒绝重绑定，以及合法多字节ID在写前达到统一预算仍可完整重读。长索引采用明确的磁盘格式夹具，只验存储恢复／追加，未冒充真实scope或停止授权。原生scope与gate冻结blob同审查版本；最终记录修正及其他冻结文件供主线最终验收。

broker、admission、私有记录、controller、bwrap、namespace、seccomp、真实配额、文件、scope及信号均真实。替身仅有固定合成批准字节、可信登记测试程序、可控领域授权闭包；没有生产ReportResources/ref／basis/read/send消费者、真实用户库、模型或工作台。目标无可授权的SCM接收通道，真实recvmsg等调用EACCES；误暴露通道的危险正控制由已接收1.2提供，不把本轮无通道／未执行动作说成G后实际收包校准。

`audit-owned.mjs`只读核本cache登记的59个自有unit及原cgroup，`owned-scopes-final.json`为0个意外活动范围；失败根原记录保持原状，不用修改旧unknown来制造完成。临时调查代码仅作cache证据；生产实现为本树深模块，未复制三轮实验作为第二提供者。没有安装／提权／改系统委托、用户数据、Git提交／推送／PR／archive或其他树操作。

本片完成独立native provider的本地实现与验证，主线最终接收仍由主线执行；后续只能消费此冻结增量。生产宿主注册／启动恢复屏障装配、ReportResources冻结字节Adapter、浏览器策略及完整进程图、报告UI／文本／可访问性／分发、Windows／macOS、机器重启及真实科研质量均未验。原报告2.1b／I5及活动页面继续unavailable，不因此归档或开始下一模块。

## 既有1.2校准与主线接收记录

## 第十六轮主线接收

主线接收1.2的本机固定native校准及三阶段完整证据，独立Spec审查未发现超出本轮授权的交付声明。默认拒绝策略、原生三代／setsid归属、controller／宿主失联两种收尾可作为下一片实现依据；两个原失败保留，gateReleased只代表意图，scope样本预算不成为产品默认预算。

2/9保持；生产准入、ReportResources、恢复结清及浏览器承载均未实施，活动报告仍unavailable，不归档。本轮不复制实验源码到production，不安排下一开发任务。后续应先完成2.x生产提供者和实际恢复保证，再谈报告启用；原始源码及校准入口位于下文cache，后续不需要旧`/tmp`。

## 当前状态与成果

2026-10-28，HEAD=`7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`且起始clean；读取AGENTS、原tasks／design／调查、主线第十五轮安排及当前apply后，仅执行已授权1.2固定native真实校准。实际执行后取得本change delivery instructions并创建本记录。1.1已由主线审定，1.2现仅以本机固定x86_64／合成输入校准完成；2.x／3.x没有实施，完整提供者change未完成，不因新增delivery归档或开放报告。

本轮成果是可审查的默认拒绝seccomp策略、固定静态程序、可信原生监督／持久身份候选和实际失败／成功证据，均在cache。原生源码没有复制到production；没有改protocol、platform、admission、Adapter、UI或浏览器，未构建／测试产品路径。原报告仍6/13、活动页unavailable，2.1b／I5及科研质量保持开放。实际机制与限定由[investigation首节](investigation.md)维护，design新增范围说明；原架构图中的生产模块仍是拟实现。

独立证据根：`/home/joshua/.cache/scholoom-linux-isolation-calibration-r16-RqczuM/`。根目录保存首轮完整输入／结果，`after-wait4/`保存唯一必要策略修正及后续观察失败，`loss-only/`只续跑未执行的两种失联。固定`payload.c`无libc、ELF无动态解释器／运行库；每个scope实际20%CPU／64MiB／swap0／16tasks先读回，可信程序和只读输入均为本轮自有，没有真实凭据／用户库或profile。

## 实际验证

全部命令显式export TMPDIR到独立根／对应子根；既有cc、bwrap0.11.1、systemd259.5、Linux x86_64为真实提供者，没有安装、提权或手改cgroup委托。编译与样本动作先后顺序由各`first-result.json.compiles`及完整argv保存；所有实际实验阶段先编译三份C，均-Werror通过、stderr为空，再运行样本。没有重建同树共享产品产物或测试期间重建。

```sh
R16_ROOT=/home/joshua/.cache/scholoom-linux-isolation-calibration-r16-RqczuM
export TMPDIR="$R16_ROOT"
node "$R16_ROOT/calibrate.mjs" "$R16_ROOT"
export TMPDIR="$R16_ROOT/after-wait4"
node "$TMPDIR/calibrate.mjs" "$TMPDIR"
export TMPDIR="$R16_ROOT/loss-only"
node "$TMPDIR/calibrate.mjs" "$TMPDIR"
export TMPDIR="$R16_ROOT"
node "$R16_ROOT/check-evidence.mjs" "$R16_ROOT"
bash -n "$R16_ROOT/rebuild.sh"
```

以上是实际命令记录，不能在原根重跑覆盖证据。需独立重建时以`bash "$R16_ROOT/rebuild.sh"`复制已保留源码到新的cache根；本轮仅核该重建脚本语法，没有执行整轮回放。

| 实际结果 | 证据及判定 |
| --- | --- |
| 首轮exit1 | 根`first.log`／`first-result.json`。无filter控制真实送达自有TCP4／TCP6／Unix各1、UDP1，SCM读得合成诱饵；过滤组在init wait阶段失败，没有payload ready／动作，不能算策略拒绝通过 |
| wait4窄修后仍exit1 | `after-wait4/final.log`／`first-result.json`。仅增加可信bwrap reaper必要wait4，默认deny仍为EACCES，危险控制不重跑。filter-exposed／safe已进入、危险直接调用均-13、批准内容正确、无端点送达、各exit0；之后失联场景在SIGKILL前因exe路径字符串观察失败，三代已出现但不算失联验证 |
| 仅失联场景exit0 | `loss-only/final.log`／`first-result.json`。观察改用二进制dev／ino，仅跑未执行的controller／独立宿主SIGKILL。各目标六成员含三代／setsid，完整登记范围收尾；宿主场景还记录到独立controller parent-lost。三unit在兜底cleanup前已inactive，无补stop制造通过 |
| 一致性／追加只读核查通过 | `check-evidence.mjs`、`evidence-check-{first,final}.log`／`conditions-matrix.json`。核固定独立marker、真实syscall结果、未执行分支、两个失败、两种loss及活动／失配身份；13个登记PID旧出生身份均消失／不再匹配，八unit inactive、八条已知cgroup不存在。不是新的native实验 |
| 工件检查 | 本change strict、scholoom-dev schema、diff及独立补丁反向检查，日志同根；没有生产类型／生成映射变化，不重复类型／架构／kernel／UI／CI。主线内核15/15及UI5/6只作为交接基线，未当报告隔离或整合全绿 |

第一份单独supervisor编译有两条缩进warning，保存`supervisor-build-first.log`和`supervisor.build-first.c`，执行前补正；无本轮EDQUOT。三个实验输入及原始结果均保留，未用retry、sleep或延长期限改通过。scope的15秒仅是本次样本保护，不改任何生产期限、unknown或容量。

## 审查与问题处理

原生辅助请求配置gpt-6.1-sol／high、无历史fork，仅写固定payload及只读核bwrap等待路径；另一独立只读审查核三阶段源码／原始结果，认可本机固定native的1.2窄结论。其三项限制已进入investigation／design：FD数字过滤不是资源授权；SCM在ready后／动作G前入队，临时gateReleased记录意图；范围终态与只读reader不能被描述成生产停止授权／容量结清。独立记录在cache `independent-review.md`，辅助均结束关闭，没有常驻任务。

首失败由本机bwrap导入wait／waitpid及libc反汇编的wait4关系支持，45条最终BPF只比43条首策略多必要wait4，不改默认拒绝。第二失败是视图内/probe与宿主路径不一致，父改观察为已持有二进制物理身份；没有改样本或放宽断言、重跑已绿组。核查脚本也用物理身份计三代，不用完整路径文案。

临时armed／gate记录由原生端file fsync＋rename＋目录fsync落盘，活动期独立进程核boot、InvocationID、cgroup dev／ino、私有根和controller出生身份。loss中的读取发生在三代ready之后、SIGKILL之前；读失败／失配／事后返回unknown且无停止／容量动作。`gateReleased:true`先于动作G，不能证明已放行；2.4必须处理其崩溃窗口，不照搬该字段。观察器只记空或目录消失的组合结论，不保有原始empty事件文本，未作超过数据的声明。

## 未完成事项与下一步

本机固定原生链、OS及文件／句柄／scope／SIGKILL真实，输入和程序为固定合成样本；没有生产ReportResources批准字节、真实领域授权、worker／broker提供者、ProcessAdmission或恢复仓储装配。未实测动作G后才送达SCM、真实外部DNS协议、浏览器完整进程图、所有崩溃时间点／记录损坏、系统重启、Windows／Mac或其他Linux部署。不能由本校准宣称通用沙箱或生产策略可用。

收尾已核三阶段共八个自有unit／cgroup、13个登记成员出生身份、自有TCP／UDP／Unix服务及控制端原scope；只收尾本轮对象，未操作共享显示或他人执行。没有dev server、依赖安装／下载、用户库访问、Git提交／推送／PR／archive或其他树操作。全部必须输入、源码、编译及原始结果在Git／本cache，无现有/tmp前置。

按用户边界到1.2证据交回停止，2.x由主线验收后另行安排，不自动接schema、admission或生产Adapter。后续必须保留本次默认拒绝／wait4／FD与失联反例、区分实际资源权威和回执意图／确认，并在真实提供者中验证unknown及容量闭环。报告呈现、文本／可访问性、运行时分发和跨平台决策仍不由本片扩大。
