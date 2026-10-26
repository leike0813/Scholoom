# 实际交付与交接

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
