# 实际交付与交接

## 当前状态与成果

本线独立实施后，主线第二阶段审查发现A1，原通过结果不足以接受该授权阶段。本轮已沿真实受理链复现并修复，完成最小复验和公共对接准备，待主线接收修复；跨线／目标平台仍未完成，不可归档。下列第一阶段实跑保留原时间／范围，第二阶段追加结果见文末。用户授权仍不包括安装依赖、开发服务器、真实库、提交、推送或PR。开发Agent保持Codex／gpt-6.1-sol／high，未新开Agent终端，产品命名模型仍使用既有MiniMax目录。

| proposal判据 | 实际成果与接受边界 |
| --- | --- |
| 真实父子保存及回读 | `Delegations`沿RemoteAgent和原静态worker运行；定向样本核对不同受管PID／实例、子实际读取42并保存report.md、父沿实际ref/basis读回。harness只接受领域回执，不把scratch或口述当成果 |
| 上下文／权限／模型 | 子无父私有标记及父checkpoint，scratch按委派分隔；宿主落实父、角色、请求交集及领域授权；命名配置钉入版本，不同descriptor共享32次预算及全局并发1。角色指导注入、任务关联语义仍需真实提供者 |
| 等待、取消和恢复 | 有限等待到期子仍running；局部取消父继续，父正常退出收尾未完成子；重启查询不发模型请求。真实控制器SIGKILL保interrupted/unknown并拒绝不安全项目释放 |
| 双宿主会话 | 现有composer启动真实父子；工具记录按结构化delegationId展开、看实际模型／障碍／成果、开报告或取消；浏览器及真实Electron通过。组件夹具另核对切会话／重连迟到读取、草稿和配置冲突 |
| I3 | 无任务依赖的真实资源交接已通过。科研实际角色、项目任务／工作项稳定引用及关联、阅读线两个design尚无输入，未做真实I3验收 |

已核对[design变更总览及受理顺序](design.md)：进程、资源提供者、持久化及UI路径与实施一致。实际新增创建身份映射、修改意图与同ref在途拒绝、延迟子资源绑定、结构化工具引用和诊断PID已同步到design。正式规格未同步，旧科研能力／Graph保持原语义。

主要入口：`packages/harness/src/delegations.ts`及runtime接线；`protocol/src/delegation-contracts.ts`和模型schema为事实源；`models/src/config-store.ts`保存命名配置；内核容器v4→v5增量迁移；`DelegationCall.tsx`沿既有ToolCall呈现。操作及诊断见[开发说明](../../../docs/development.md#有界-agent-委派)。

## 实际验证

环境为Linux、Node24.12.0、OpenSpec1.15.0，真实本地受管执行、SQLite、broker、资源保存与恢复；模型仅替换外部loopback HTTP边界，使用合成key。已安装依赖来自原主仓库的只读本地链接，锁文件一致；`@scholoom/*`链接到当前树的构建，未消费其他树业务实现、安装或下载依赖。

### 构建与静态检查

- 直接执行已有TypeScript入口构建protocol、platform、broker、client、projects、library、models、research、editor、harness、kernel，平台scope及editor visual按已有构建脚本生成；kernel／library迁移及research builtin复制到本树dist。后续变更定向重建受影响包。
- `node node_modules/typescript/bin/tsc -p packages/protocol/tsconfig.json`、`-p packages/harness/tsconfig.json`、`-p apps/kernel/tsconfig.json`通过；`--noEmit -p apps/desktop/tsconfig.json`和`--noEmit -p tsconfig.tools.json`覆盖UI、夹具和测试。
- `node packages/protocol/scripts/contract-types.mjs --self-test`通过。`--patch`生成映射后经内置apply_patch接入；重新生成并经Biome格式化逐字比对本次两个类型映射，均一致，未引入其他映射的格式差异。
- `node scripts/check-architecture.ts`：13模块、197文件、0问题／0豁免。修改的38个TS／TSX／JSON文件经Biome检查，无error；保留非空断言与测试动态JSON的warning，不宣称零warning。
- 收尾执行OpenSpec strict／schema检查及git diff检查，具体状态以本文件末尾复核为准。

### 内核与组件

命令均用已有 `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts <files> --output=<directory>`，未通过包管理器安装或调用setup。

| 用例范围／输出 | 实际结果 |
| --- | --- |
| `agent-delegation`、`delegation-races`、`delegation-contracts`、`model-profiles`、`model-access`、`model-admission-integration`、`project-container`、`project-recovery`、`harness-module`、`execution-isolation`、`execution-capacity`、`capability-stop-unknown`、`harness-recovery`；`test-results/delegation-final` | 首轮83项，79通过／4失败；失败保留，原因及后续修复见下节。预算、排队撤权、原能力子、真实IPC、故障停止保护等未失败分支通过 |
| `agent-delegation`、`delegation-races`、`project-container`、`project-recovery`、`delegation-components`；`test-results/delegation-final-repair` | 27/27通过，包括首轮4项失败、同ref并发意图、v5失败重试、恢复引用和3项组件测试 |
| 同ref／权限交集用例；`test-results/delegation-permissions-final` | 单独定向通过；真实SQLite／准入，save端口为明确gate替身，核对三方交集、实际拒绝及只受理一次写入。实际文件发布由其他真实资源用例覆盖 |

上述定义去重共88项（14文件，CLI `--list`核对），均取得通过结果；包含修复后定向复验，不表示单次88项全绿或全仓CI通过。核心真实报告样本另保存`delegation-result`附件；故障诊断复用`execution-stages`。未运行真实供应商模型或科研质量评价。

### UI与生产构建

生产桌面构建通过。由于本地依赖链接位于树外，默认Vite构建触发文件allowlist拒绝；临时 `/tmp/scholoom-delegation-electron.config.mjs`仅为构建增加当前树与已存在`.pnpm`目录，未改产品配置／安全边界。命令从apps/desktop执行：`node ../../node_modules/electron-vite/bin/electron-vite.js build --config /tmp/scholoom-delegation-electron.config.mjs`。

用户禁止开发服务器，故UI验收使用已构建renderer的静态HTTP测试夹具，接既有kernelBootstrap中间件；没有运行Vite dev。临时入口为`/tmp/scholoom-delegation-static-server.mjs`及`/tmp/scholoom-delegation-ui.config.mts`，保持现有浏览器／Electron fixture、preload及真实内核。它们是本轮测试适配，不是产品服务器或新业务实现。

执行入口：`SCHOOLOOM_UI_PORT=5631 xvfb-run -a node node_modules/@playwright/test/cli.js test --config /tmp/scholoom-delegation-ui.config.mts <file> --output=<directory>`，旧场景另以`--grep`选择。

| 真实双宿主场景 | 结果／证据 |
| --- | --- |
| `tests/ui/agent-delegation.spec.ts`，保存／打开与局部取消 | 初次4/4通过，`test-results/delegation-ui`；最终夹具修正后再次4/4通过，`test-results/delegation-ui-final` |
| `harness.spec.ts`的`user configures, edits safely…` | gate路径及自锁修复后2/2通过，`test-results/delegation-harness-ui-repair` |
| `harness.spec.ts`的`user invokes a declared research capability…` | 阶段诊断后2/2通过，`test-results/delegation-research-ui-repair`；原失败及诊断保留在`delegation-research-ui`／`delegation-research-diagnostics` |

默认测试原有失败见调查中的CI输入，本次不宣称Linux全组、Windows全组或分发包通过。组件测试替代端口状态以覆盖迟到读／配置冲突，不替代真实双宿主执行；科研关联故障测试注入原linkArtifact失败，验证文件保留与reconcile不重写，不等同项目任务关联提供者。

## 审查与问题处理

原生独立审查使用继承模型／high，取得原契约、源码、样本及验收标准，未预注其他审阅结论。其独立发现的创建收据越权、旧回执掩盖未知保存及异会话在途合并已修复；后续旧basis误报未知和并发变体也已关闭。最终源码／回归定义复核未发现新增P1/P2，审查者未代跑测试或代替主Agent最终验收。

1. 创建前持久保存客户端→宿主领域操作身份映射，并核对实际项目／路径，兄弟同客户端ID不共享收据。
2. save前记录pending，确认回执后才complete；真正发布后抛错仍unknown。最近成功basis及同ref在途检查在新意图与领域调用前同步执行。回归分别核对真实V2发布后未知、旧V0拒绝后正常V2，以及并发只调用一次领域。
3. 异步受理同时核对可信session／parent instance；解析后再次授权。子资源端口在实例注册后绑定。SDK拒绝按Backend错误协议返回，允许子继续合法工作。
4. 首轮新增取消用例失败来自模型夹具在release后再次hold；已改只设置一次。控制器故障用例先按执行启动阶段观察，未改生产超时。旧v2恢复样本遗漏删除新增表已修正；真实v5迁移冲突另核对原版本／数据与副本保留。
5. 旧UI先等待被自身gate扣住的session.create helper形成自锁；已改发起→检查禁用→释放→等待。科研报告失败的阶段证据及处理详见[investigation实施补充](investigation.md#实施补充依据)：deadline时ENOENT／父子running，继续观察后实际文件及退出均确认；现先等用户可见执行完成再直接读文件，保留原失败记录，未以空串隐藏读错，也未修改产品期限。

依赖链接、临时构建／静态测试适配保留于本树忽略目录及/tmp供复核；测试成果／trace保留在test-results。测试关闭自己的内核、HTTP模型、Electron和受管执行，故障注入仅作用于本轮取得的owned handle。无真实用户数据或常驻开发服务。

## 未完成事项与下一步

任务以[tasks](tasks.md)为准，当前16/20（原13/18，第二阶段关闭5.1并完成8.1／8.2）。未完成：4.2 Windows原失败阶段诊断、4.3目标平台验证、6.1真实角色与公共提供者接入、6.2 I3真实整合。任务接口及阅读设计已正式转交，不能继续要求用户重复提供；尚缺实际科研角色及dev组合后的提供者，不代其他线定案。

已核对快照路径及公共符号见design末节；下一步先由主线选择构造器组合／任务关联范围，计算提交统一迁移方案并经dev验证、用户同步消费者，再沿实际角色提供者执行I3。Windows保留原全组条件，按worker／ACL辅助进程分类取阶段证据；macOS仍声明受管不可用，人工／分发路径待目标实测。跨会话通信、advisor、递归、后台移交及子checkpoint自动恢复均未实现。

续做先读取本文件、未勾选任务和当前源码，再取apply指引。无新增安装、真实模型、提交／推送／PR或归档授权；不自动进入这些操作。

第一阶段收尾复核：当时OpenSpec strict与scholoom-dev schema均通过；apply指引13/18。内核／工作台／测试工具类型检查、架构检查、生成映射比对、修改文件Biome error级检查及git diff --check通过。端口5631已无监听。未进行正式规格同步或归档。

## 主线第二阶段：A1修复与公共准备

输入根S为用户正式交付的`/tmp/scholoom-phase2-handoff-VZS5mS/`，消费其中`acceptance.md`、`coordination-plan.md`、`manifest.json`及各线增量快照。精确消费文件与字段逐项列于[design公共对接](design.md#主线第二阶段公共对接)，不读取manifest.source指向的其他实际树，不将快照当完整共同基线。阅读两份设计核对完成；任务四操作／TaskRef及公共history已收到源码，但未复制私有实现或接到本树。科研Graph的delivery.roles是成果角色，不是实际DelegationRole；真实科研委派角色仍缺，I3不关闭。

### A1复现、最小修复与验证

本轮业务修复仅`packages/harness/src/delegations.ts`的save授权，回归扩展同一`tests/kernel/delegation-races.spec.ts`。新样本先真实保存V1，再经原资源CAS更新为V2，工作包save输出仍只授予V1、materials允许读V2；通过session.send→父delegate_agent→两个真实受管实例读取V2并请求保存V2。未手填委派记录、替换worker或模拟领域保存成功。

- **红测**：先构建未修复harness及kernel，运行`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/delegation-races.spec.ts --grep 'readable material cannot widen' --output=test-results/delegation-a1-red`，1失败；实际进入领域写入1次，期望0。trace内`write-version-authorization`附件保留原版本、当前版本、实际写入次数及委派记录；不覆盖首次失败。
- **修复**：首次save精确匹配允许输出ref+basis；后续只使用本委派最近确认成果basis。删除对save的混合readable核验，保留当前项目／输出ref检查、pending／unknown、同ref并发意图和64次上限。检查与意图落盘之间仍无await；未改editor或projects CAS。
- **绿测**：构建修复后harness，再运行`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/delegation-races.spec.ts tests/kernel/delegation-contracts.spec.ts --output=test-results/delegation-phase2-a1`，**7/7通过**。新样本确认V2确实被读、领域写入0次、writes／artifacts为空且permissionDenied，文件保持V2；另用原资源接口核对旧V1 CAS仍contentChanged。原用例覆盖合法连续保存、旧basis拒绝、真实二次发布后未知、兄弟创建身份、跨会话受理及同ref在途（最后一项save端口为明确gate替身）。
- 当前源码格式化后再次构建harness并定向复验A1，结果见补丁包`a1-final.log`；构建和测试不并行重建共享产物。`tsc --noEmit -p tsconfig.tools.json`通过；最小Biome error检查通过。没有为本轮授权修复重跑UI或全仓CI，也未改任何生产期限。

原生辅助Agent沿用gpt-6.1-sol／high完成只读源输入核对及A1独立审查，未发现该修复仍有确证的授权扩大／错误收尾。它未运行构建／测试，运行结果由本线核验；此前主线拒收不能因本线自审改写为主线已接收。

### 公共补丁及依赖

临时包为`/tmp/scholoom-agent-phase2-kJF8nC/`，含README／manifest，未写入只读主线交接包。具体文件：

| 文件 | 基准及用途 |
| --- | --- |
| `01-a1-fix.patch` | 相对主线正式Agent快照，只含A1与真实受理回归；已有第一阶段Agent源码时使用 |
| `02-delegation-public-base.patch` | 相对e3d58fc的本线protocol／models／harness源增量，已含A1、delegations schema及restore，不含容器迁移。与01是替代接入方式，不能重复应用 |
| `03-delegation-host-registration.patch` | 相对e3d58fc的application／architecture本线符号；按design与科研、任务、程序装配合并，不整文件覆盖 |
| `04-delegation-checks.patch` | 本线委派／模型／harness及必要模型夹具验证，不含公共迁移测试 |
| `delegations.sql` | 从现有迁移抽出的表／索引声明，无PRAGMA版本推进，未作为迁移执行，仅供计算组合消费 |
| `windows-failure-classification.json` | 原CI日志15项失败的精确位置／Expected／Received／期限提取，非目标平台新实跑 |

四份patch均以`git apply --check --reverse`在本线核对一致性，不代表dev forward apply／组合通过。源码迁移入口与主线Agent快照`cmp --silent`相同，本轮没有改`project-container.ts`或版本、没有另造迁移链；公共patch也排除迁移入口／对应公共测试和旧生成映射。UI仍由正式快照按符号消费，不重发整文件。

依赖顺序：主线确认Harness第16尾参冲突解决方案；项目资源叶schema保留原重导出、科研history按独立增量消费；再合本线公共符号。计算统一迁移要在宿主初始化前完成，覆盖原v4、新库、两种局部v5、两域表／索引、数据／信任、保护副本／失败重试和恢复。然后组合宿主注册／restore、保留全部根工具与本线受限子规则，从最终schema重生映射，先构建再跑相应原定向集。dev接入及用户同步未发生，未启动真实I3。

### Windows与主线UI证据边界

已有日志`/tmp/scholoom-next-parallel-baseline-failures.log`，Checks40100596838、55d020c：Windows374通过／15失败／12跳过。本轮只分类既有证据：13项在5000ms完成等待失败（2 queued／11 running），另有lifecycle并发重启返回不全为running、platform-availability计数期望0实际9。六项Agent重点失败在原日志6705／6734／6763／6792／6821／6850，均仍running，多项未进入恢复／故障步骤，缺模型、工具、实例及完整停止阶段。

lifecycle原日志6879对应stop后四路start，不是子数量断言；缺四份BootstrapResult、endpoint、锁和kernel.log。platform原日志6994的订阅含initialize及人工操作，Windows私有目录确会用powershell ACL辅助进程；没有用途／阶段／PID证据证明9个全是ACL或执行worker，不删除无未受管执行保证。现有execution-diagnostics可采样，windows-execution workflow的grep未覆盖这六项；无新Windows机器／artifact，4.2／4.3继续开放，不据Linux通过或本次分类改生产时限。

主线首次Agent UI日志为S/evidence/ui-agent-delegation.log的207／236／258附近：Playwright装载时报“did not expect test() to be called here”，2失败／2未运行，未进入场景。S/evidence/ui-agent-delegation-recheck.log记载5825独立端口、新profile下4/4；acceptance确认未改代码。后者只证明隔离复跑通过，未确定／修复首次装载根因，不将日志列举的常见原因当诊断结论。本轮没有重新安装Playwright／Electron或运行新UI场景。

最终复核：格式化后当前harness构建及A1定向**1/1通过**（10秒场景，命令总18.2秒），日志见补丁包a1-final.log；测试工具类型检查、最小Biome error、OpenSpec strict／schema、architecture（13模块／197文件、0问题／0豁免）、git diff及本轮改动／未跟踪工件空白检查通过。apply确认16/20、剩余4.2／4.3／6.1／6.2。与正式Agent快照比较，本轮只改两个业务／回归源文件及本change四份工件、开发说明，共7文件；其余原有未提交成果保留。

本阶段到此停止。主线需决定构造器尾参方案与任务关联消费范围，并接收计算统一迁移方案；科研需提供实际角色及原材料／标准。未做跨会话通信、advisor、递归、Git提交／推送／PR或归档。
