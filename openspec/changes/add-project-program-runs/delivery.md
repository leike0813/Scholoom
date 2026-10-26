# 实际交付与交接

## 当前状态与成果

2026-10-26，继续原树与同一change。主线已复验关闭C1—C3，将公共切片接入dev，并完成本树安全同步；本轮已明确恢复。当前HEAD为91615d58719f792dba8f9c311e9f13350de1c42f，0519904（含b838402）为祖先，恢复只读核对工作区干净。原成果保留于本地WIP检查点及 `/tmp/scholoom-sync-recovery-wyn13R/project-execution/files/`，本轮唯一源码工作点为当前树，不再制作临时源码组合。第8组记录同步后的实际消费；任务／委派私有提供者合入、历史CI／Windows和整个change最终交付仍按实际条件开放。

同步证据：`/tmp/scholoom-sync-recovery-wyn13R/recovery.md`、`synchronized.json`及本线构建／测试日志。主线在本树先构建后验收内核65项及双宿主2项通过；这是同步与已有切片证据，不替代本轮新变化验收。公共命令观察／长时限、Graph来源／执行历史及v5 delegations→v6 program_runs已真实同步，旧公共patch仅为历史工件，不再次交付为新增量。用户允许本地补丁／提交；继续禁止推送、PR、归档、新依赖、真实库和常驻开发服务器。

### 首轮实施记录（保留历史证据）

2026-10-25基于dev `e3d58fc807827a78493dcd16e38de28c8d02766e`完成首轮本线独立实现与Linux验收，原进度13/17。下文v5、未收到设计及首轮审查结论是当时快照；它们未覆盖主线发现的C1—C3与迁移碰撞，当前设计输入／v6链及验收边界已在第二阶段修正。

用户已明确要求实现change，并批准必要依赖链接、隔离uv准备及临时Vite／内核测试；另选择逐次人工“移交后台”。主代理及原生辅助实现／审查保持gpt-6.1-sol／high。没有操作其他工作树、真实用户库、提交、推送、PR或归档。

| proposal判据 | 实际成果与结论边界 |
| --- | --- |
| 1 人与Agent共同运行 | `packages/programs`持有运行及环境权威；ManualApplication不加载模型／harness即可运行，Agent工具通过同源broker调用。固定2/4/6产生真实CSV count3/sum12/mean4；受控HTTP模型调用实际工具、人工查询同一programRunId |
| 2 环境及授权 | 内核Node；人工登记已有Python／Conda并探测；已有uv＋Python3.11+＋项目根锁定声明准备私有环境。计划检查不安装，人工批准后才能准备。真实本地wheel安装、导入42、复用及原环境保护已验证；registry来源／网络计划有契约测试，未实跑公网下载 |
| 3 等待与日志 | program start短等待与程序deadline分离，长期程序可无总期限。stdout／stderr按UTF-8分片、4片背压，持久保留1MiB、单次默认64KiB；2.7MB Unicode输出截断但退出成功，短进度在程序结束前可见，无日志仍可查可停 |
| 4 完整停止及重启 | 共享ManagedCommands／ManagedNode／ProcessAdmission；intent与stopped收据，观察失败保留原lease，取消与父停止覆盖后代。真实SIGKILL后保守unknown及占用，不按PID消失清除、不重跑。登记项目不可核查时保守禁新执行。没有重接任意程序或自动消除unknown能力 |
| 5 实际输出 | 显式输出经项目文件身份及共同ResourceEvidence观察／打开；非零退出后的部分CSV、缺失、变化与退出分开。重复核查不覆盖原basis。v5保护升级，独立恢复副本只保留历史，不控制原进程；小CSV恢复、300KB结果按既有备份上限遗漏并列清单，原文件不变 |
| 6 独立验收及I4 | Linux内核及Chromium／真实Electron路径通过；共享资源打开及真实Quarto／TeX PDF双宿主回归通过。本机回归不能代替原CI阶段诊断、Windows验证或阅读交互设计确认 |

已核对design的模块图、启动时序及状态图。实施调整已同步design／specs：人工 `programs.handoff`；tomllib替代缺字段的CycloneDX；实际sync前固定脚本检查父workspace。没有另造任务、报告、批注或editor状态权威。

主要代码入口：

- `packages/protocol/src/programs.ts`：公共操作、内部观察及派生DTO；公共业务映射经原生成器核对，未复制ResourceEvidence。
- `packages/programs/src/{runs,records,environments}.ts`、`inspect-lock.py`：幂等受理、自有SQLite表、有限日志、停止／输出事实、环境授权及准备。记录和执行端口可替换；真实SQLite及内存adapter均参与验证。
- `apps/kernel/src/{manual,application,commands}.ts`：宿主登记、工作域／实际实例校验、信号与人工移交、环境／资源启动前复核、恢复组合；`storage/project-container.ts`负责v5物理升级及保护副本。
- `packages/platform/src/command*.ts`：程序观察及背压，仍共用原生归属。原editor短命令的stdout超限失败、stderr界限及有限期限保持。
- `packages/harness/src/program-tools.ts`及runtime／remote-agent：同源薄工具、父执行收尾，不改科研Graph或委派角色。
- `workbench/programs/`及既有tab／session挂载：项目草稿、分页、迟到保护、运行／环境面板、取消、移交与共同输出打开。UI设计及开发说明已更新，样式只用语义token。

## 实际验证

本机Linux，Node24.12.0、uv0.9.17、已有Python3.14.4；样本、库、配置、项目及输出全部隔离。外部模型只用loopback受控HTTP和合成凭据，未使用真实模型服务或真实用户材料。环境模块少量执行／记录替身用于确定性失败时序；非空wheel另用真实工具，完整ManualApplication也实际安装并运行Python。

| 命令／操作 | 结果与证据 |
| --- | --- |
| `pnpm install --offline --ignore-scripts --no-frozen-lockfile --config.optimisticRepeatInstall=false` | 下载0，仅已有锁定版本及新增programs workspace importer；未加新第三方版本。`/tmp/project-execution-install.log`。授权前辅助代理曾误触pnpm缓存依赖准备（下载0、缓存770包），当时已向用户说明；用户随后明确批准必要安装，本轮未为掩盖记录而清缓存 |
| `pnpm build` | 全工作区通过；包含programs固定脚本asset、platform原生监督程序、kernel、两宿主及renderer。`/tmp/project-execution-final-build.log` |
| `pnpm -r typecheck`、`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 通过；`/tmp/project-execution-final-typecheck.log`、`/tmp/project-execution-final-tools.log`。初次工具检查发现新测试类型不符，已修正并重验 |
| 同源生成一致性、`node scripts/check-architecture.ts` | business-types以原生成器及Biome规范化结果核对；architecture为14模块／203文件、0 findings、0 granted exceptions。首次生成检查发现手加映射顺序漂移，已用生成结果修正，未改生成器 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{program-runs,program-runtime,program-environments,managed-commands,process-admission,platform-command-contracts,project-container,project-recovery,editor,editor-runtime}.spec.ts --output test-results/project-program-delivery` | 初次85项中83通过、2个合成v2恢复夹具失败；保留原结果 `/tmp/project-execution-final-kernel.log`。新v5表残留在伪造v2夹具，修正夹具drop表后定向复验，未放宽生产迁移保护 |
| 容器／恢复两个spec定向复验 | 6/6通过，含升级前可读v4副本及原消息保留、进程中断事务重试、独立恢复和模块失败。`/tmp/project-execution-recovery.log`，`test-results/program-container-recovery/` |
| observer原lease持久失败／取消定向 | 2/2通过，分别cancelled=false／true；后续命令仍排队，原名额未释放。`/tmp/project-execution-observer-lease.log` |
| intent持久拒绝、缺环境、结果备份定向 | intent拒绝不执行代码；缺环境按稳定operationId仍可查failed，未建命令；小结果恢复及超限结果清单通过。日志 `/tmp/project-execution-early-rejection.log`、`/tmp/project-execution-missing-environment.log`、`/tmp/project-execution-output-backup.log`。早期缺环境测试错把同步拒绝当引用回执，已按公共错误与稳定身份查询行为修正 |
| 程序停止握手及Agent归属定向 | overflow、Unicode延迟持久化、持久unknown、观察失败4/4；真实Agent父取消／人工移交2/2；完整人工宿主非空wheel准备及Python运行1/1。分别见 `/tmp/project-execution-stop-handshake.log`、`/tmp/project-execution-handoff2.log`、`/tmp/project-execution-environment-host.log`；后续85项组也覆盖这些主路径 |
| `SCHOOLOOM_UI_PORT=5361 SCHOOLOOM_CDP_PORT=9361 node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/program-runs.spec.ts` | 最终2/2通过，14.4s／17.2s；实际CSV、日志、取消、切项目、tab关闭重开不取消后台、reload保留草稿。`/tmp/project-execution-program-ui-artifacts.log`；截图见下文 |
| 同配置运行 `resource-opening.spec.ts`／`writing-editor-pdf.spec.ts` | Chromium／真实Electron共4/4通过，实际共同资源及Quarto／多文件TeX PDF。`/tmp/project-execution-final-ui.log`保留该组程序测试夹具两次错误及四项回归成功，程序夹具已单独修复通过，不将混合组写成6/6 |
| Biome、OpenSpec、diff | `pnpm lint`退出0（436文件，71 warnings／35 infos，无error）；新增及受影响源码单独Biome检查无诊断。`openspec validate add-project-program-runs --strict`、`openspec schema validate scholoom-dev`、`git diff --check`通过；新增文件逐一no-index检查、工件本地链接／围栏检查通过，正式规格未修改。已有源码通过stdin生成格式补丁并用apply_patch落地。未清理根lint的无关warnings／infos；Mermaid仅人工核对，未渲染 |

UI测试首次冷导航和Electron二进制准备占用默认30s，改为此多阶段场景90s总预算及等待DOM就绪；未改生产时限。后续等待实际由测试定位器错误造成：隐式label包含select选项／textarea内容、菜单实际为button、共享配置下项目重名。依据trace／可访问树改为真实role、独立项目名；增加等待不能解决这些问题。最终程序双宿主约48s整组完成。

截图已由主代理实际查看：`test-results/ui-5361/program-runs-manual-progra-bdaff-s-its-actual-project-output-ui-{browser,electron}/program-runs.png`。显示实际取消、已确认停止、有界日志及操作入口；不是模拟产品截图。截图、trace及临时样本是合成验收工件，保留在隔离test-results／tmp供接续诊断，不进入生产数据。最终5361／9361无监听，测试夹具拥有的Vite／内核／Electron已收尾。

## 审查与问题处理

独立原生代理Jason只读审查日志、授权、跨进程停止、迁移／恢复和复杂接线；最终复核接受下述修复，未报告剩余确证问题。审查者没有构建或执行本轮测试，实跑证据由主代理提供并最终接受。

1. preflight取消后继续派发、父执行漏看持久unknown：提前track、异步返回后重读状态、收尾同时扫持久origin；对应模块替身及真实父取消回归。
2. 排队入口重定位后执行原路径replacement：启动前核对目录身份、原ResourceEvidence和实际入口参数路径；真实rename回归拒绝replacement。
3. 输出反复核查覆盖原basis、小日志直到退出才出现：保留首次依据并按当前可读字节分片；真实二次核查及结束前进度回归。
4. 大量日志结果自动disconnect导致缺停止收据：程序模式等宿主显式停止；2.7MB／Unicode回归。
5. 观察写入失败后先释放再补占、取消提前release导致补占窗口：失败保留原lease，attempted后仅finally结算；取消／未取消两条真实准入回归。
6. uv父workspace转用另一lock：隔离dry-run证实后强制项目根，计划及实际sync前检查；父workspace在计划前／授权后出现的真实回归均拒绝且不写上层lock或项目.venv。

## 未完成事项与下一步

- tasks5.1已在第二阶段消费主线正式快照并核对，详见design“主线快照消费与接入边界”；不再重复等待设计输入。tasks4.2仍待真实共享接入：runtime构造参数、委派工具权限、任务／程序tab及恢复提供者必须按符号组合，不能以看过设计声称实际提供者已进入本树。
- tasks5.2：原CI40100596838的PDF阶段诊断及Windows子进程身份／queued状态证据仍待提供者输入。本机PDF回归只证明当前Linux路径，不表明历史失败已诊断或Windows已恢复。
- tasks6.2：待上述必要接入核对完成后更新同一delivery和最终任务，不自动同步正式规格／归档／提交。
- 未运行Windows、macOS真实宿主、三平台分发包、公网registry下载或真实科研模型／质量验收。当前macOS继续按既有平台声明不可用；本机成功不能推广为这些范围通过。
- unknown无自动清除或原生重接，可能继续占容量和阻止相关仓储释放；须取得可信归属证据后另行处理。通用远程、终端／Notebook、任意依赖发现、强沙箱及新报告／批注仍在本change之外。

## 第二阶段整改与公共交回（2026-10-26）

### 消费输入及授权

先读取本树AGENTS、原tasks／delivery及当次apply／delivery instructions，再消费用户正式提供的 `/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`、`coordination-plan.md` 和根 `manifest.json`。七份来源共同基线仍为e3d58fc；各子目录没有自己的manifest，使用根清单识别来源，没有检查其实际工作树或会话。

精确消费文件和符号结论已进入design“主线快照消费与接入边界”：项目 `task-contracts.ts`／TaskRef及任务tab；两份阅读design和材料delivery；Agent `runtime.ts`、`application.ts`、`project-container.ts`、`records.ts`／`schema.ts`及delivery；科研快照runtime的executionResources尾部也核对未新增同位参数。只消费交接材料，没有复制全部他域私有实现。主线验收日志的计算65/65、双宿主2/2与C1—C3独立反例分别保留，不能从原测试通过否认新反例。

沿既有安装／隔离uv／临时UI测试的具体授权，本轮没有安装、升级依赖或使用真实用户库。复用上轮原生只读代理Jason（gpt-6.1-sol/high）检查修复，未开新Agent终端／协调DAG；其不修改、不构建、不测试、不访问其他树。主代理负责全部实际验收。

### C1—C3复现与修复

首次反例通过既有依赖构建后运行，三项均红，保留 `/tmp/project-execution-phase2-red.log` 与 `test-results/program-phase2-red/`：

| 缺陷 | 首次复现 | 最终处理与实际边界 |
| --- | --- | --- |
| C1 移交持久化 | 内存记录端口在授权put处拒绝，旧实现detached=true但无持久backgroundOwner | prepareHandoff先做无副作用资格核查；授权authorized先持久，再同步commit重验父取消／控制身份，最后active收据。失败保持原责任，完成收据失败单列outcomeUnknown及本宿主已接管事实；父收尾集合重新排除实际移交项。8项定向通过，含真实Kernel／Agent／SQLite保存端口故障及取消竞态；没有伪称实测物理磁盘故障 |
| C2 总配置容量 | 六份合法合成计划写出6,188,466字节，超过读取4,194,304字节界限 | 替换前检查完整候选和恢复预留，容量拒绝原位回滚保留对象引用及历史；tooLarge不污染整个模块。后续审查又发现prepare先派发、回滚丢意图及近上限恢复失败，已一并修复：先持久意图、回执未知不重复、16KiB元数据envelope按已占空间扣减、旧近上限配置可保留原文件并恢复查询。31项环境测试通过，含上述新边界和非空wheel |
| C3 长timer溢出 | 2592000000ms产生TimeoutOverflowWarning并被Node压为1ms | command-deadline用单调累计时间分段，单次不超过2147483647ms，保持原有限整数／null契约。可控时钟覆盖边界前／边界／超边界／30天及取消，真实长期限程序验证停止收据；未等待30天，也未悄悄收窄输入 |

C1首次修复组7通过／1失败来自竞态测试误把session.cancel的受理回执当作停止完成；依据既有异步契约改为核对最终cancelled或有持久授权的active后台，未加时限。最终8/8，原失败保留于 `/tmp/project-execution-phase2-fixes.log`，最终 `/tmp/project-execution-phase2-handoff.log`。C2后两项问题由独立复核提出，整改后再次只读复核接受；其未代跑测试。C1／C3复核同样接受，最终由主代理核对实际结果。

### 公共迁移及恢复组合

唯一链为v4→v5 delegations→v6 program_runs：v5表／两个索引沿Agent交接源码，v6只新增本域表。每步先保护原库，再事务内建表和推进user_version；失败回滚后从同一保护副本重试，原授权及两域数据不变。新建空库走同一链。v5前缀检查预期委派schema，v6检查两表，不通过猜表来选择历史，也没有CREATE IF NOT EXISTS。

旧未发布program-only v5隔离样本明确拒绝且保留表／数据／user_version；没有自动转换或删数据入口。本轮所有新验收使用新的隔离profile，旧样本保留。若后续需保留其业务结果，应先核对显式转换方案，不能把测试profile处理冒充已支持的数据迁移。旧超4MiB配置也未被自动裁剪；本修复防止再生成不可读配置，合法近上限旧配置则有不改原文件的恢复回归。

组合恢复只取正式快照 `agent-delegation/packages/harness/src/{records.ts,schema.ts}`，以Node stripTypeScriptTypes去类型生成 `/tmp/scholoom-agent-restore-snapshot-PfdaXd/` 的临时适配，链接本树既有依赖。该实际Agent仓储与本域ProgramRecords在真实SQLite副本分别restore：原记录及授权不变，副本项目引用重绑、跨项目只读引用不乱改、活动历史转interrupted/unknown，本域清除原进程控制资格；4/4通过。它验证离线仓储组合，未加载委派runtime、未声称生产联合宿主或I3接通。

### 公共补丁与依赖顺序

交回目录：`/tmp/scholoom-project-execution-phase2-qO5WU9/`，含README与manifest。

| 文件 | 依赖与核对 |
| --- | --- |
| `01-command-observation.patch` | 独立于programs；同源platformProgramOperations、ManagedCommands、command-worker／deadline、Node导出及独立观察测试／共用夹具。共同基线临时副本构建、7/7通过 |
| `02-delegations-v5.patch` | 基于e3d58fc，沿正式Agent快照的v5迁移；与03按序接入 |
| `03-program-runs-v6.patch` | 依赖02，提供统一v6入口及不依赖领域私有包的容器／迁移测试；共同基线临时副本6/6通过 |
| `04-restore-hooks-after-domains.patch` | 依赖03及Agent仓储、programs领域和kernel工作区依赖已实际合入。针对交接Agent application的最小ProgramRecords组合钩子，仅git apply --check；当前本树已有同一钩子，不重复应用。生产联合宿主验收待dev |

临时 `command-baseline/` 从git archive e3d58fc展开，链接已有依赖，packages/programs不存在；未带入其他私有业务来伪装公共基线。01先独立构建／测试，再按02→03核对、应用及测试。04只在 `restore-hook-reference/` 检查快照上下文。没有创建Git工作树、分支、提交或把补丁接入dev。

command观察只能证明有界输出、归属、取消和完整收尾。started早于宿主程序ready，不含Electron身份／应用握手；日志管道没有双向RPC，命令退出会收尾整个范围。长驻候选A为沿ManagedNode定义独立宿主协议，B为扩command应用控制协议；推荐A供主线／生态复核，本轮没有实施或启用。

### 最终验证与收尾

| 命令／工件 | 结果 |
| --- | --- |
| `pnpm --filter @scholoom/kernel... build`、`pnpm --filter @scholoom/desktop build` | 通过；`/tmp/project-execution-phase2-final-kernel-build.log`、`phase2-desktop-build.log`（后者完整路径同/tmp/project-execution-前缀） |
| `pnpm -r typecheck`、工具tsc | 通过；`/tmp/project-execution-phase2-typecheck.log`、`/tmp/project-execution-phase2-final-tools.log`。中间准备reference改为可选时有一次闭包类型错误，已修复并保留首次构建日志，不以失败产物测试 |
| 定向内核11份spec | **97/97通过**，`/tmp/project-execution-phase2-final-kernel.log`；覆盖command-observation、managed-commands、程序／环境／持久化、迁移链／组合／恢复、editor及editor-runtime。使用明确SCHOOLOOM_AGENT_RECORDS_MODULE指向上述临时适配，组合恢复未跳过 |
| 独立公共command／迁移 | **7/7、6/6通过**，`/tmp/project-execution-phase2-public-command.log`、`/tmp/project-execution-phase2-public-migration.log`；后续仅规范化迁移测试导入，最终patch重新核对可应用 |
| 程序及PDF双宿主 | **4/4通过**，UI5361／CDP9361，`/tmp/project-execution-phase2-ui.log`、`test-results/program-phase2-ui/`；真实浏览器／Electron、真实Node／Quarto／TeX与实际文件，无真实模型服务 |
| 架构／生成／lint／OpenSpec／diff | 架构14模块／204文件，0 findings／0豁免；原生成器self-test通过。根lint首次因拆测试后的导入／格式2错误失败，已用stdin补丁修正，保留首次日志；最终结果见本段收尾补记。OpenSpec／diff按最终工件复核 |

复现与验证样本、日志、patch及基线副本均作为隔离调查／交回工件保留，不成为生产依赖。结束只收尾本轮拥有的Vite／内核／Electron；端口核对见最终收尾补记。

### 仍需主线决策／真实提供者

- Harness构造器在executionResources之后，Agent的delegationOptions与本域programs占同一参数位置；推荐在公共接入时保留前者并把programs追加其后，同时更新所有调用方。共同options对象为另一选项，本树没有未经确认实施该接口改造。根工具、委派子工具权限、任务／程序tab和恢复钩子必须实际合并并验收。
- 两份阅读design及TaskRef已正式消费，缺输入阅读项5.1闭合；报告仍仅规划，任务／报告提供者未在本树合入，程序首批不强制关联任务，不重做报告／批注／环境类型。
- Windows进程身份／queued阶段与原CI PDF根因仍开放；当前提供者Linux阶段诊断及本机PDF回归不是历史根因修复。真实目标平台／分发、公网registry、真实科研质量未验收，macOS仍不可用。

达到用户本次C1—C3和迁移准备交回边界后停止。后续dev接入和新契约分支由主线复核／确认后开展，不自动展开下一阶段。

最终收尾补记：apply核对20/23。根lint退出0（442文件、75 warnings／35 infos、无error），工具tsc退出0；新增及受影响检查保留根既有诊断，没有为本轮清理无关测试。strict首次因两个Requirement正文过长告警失败，已按行为拆开，`/tmp/project-execution-phase2-openspec-before-final.log`保留原结果；最终OpenSpec strict／scholoom-dev schema及git diff检查通过，新增文件逐一检查空白、工件本地链接／围栏通过，Mermaid仅人工核对未渲染。schema派生业务映射一致，正式openspec/specs未修改。5361／9361均无监听，本轮UI夹具及原生审查代理已收尾；补丁、隔离profile与验证副本按上述用途保留。

## 第三轮：同步公共基线后的实际消费（2026-10-26）

### 实际范围和同步事实

用户明确恢复原有界任务，取代旧的等待手动同步条件。只读确认HEAD为91615d58719f792dba8f9c311e9f13350de1c42f、0519904为祖先，恢复时git status干净；本轮没有自行merge／rebase／reset／切分支。同步证据见开头及 /tmp/scholoom-sync-recovery-wyn13R/{recovery.md,synchronized.json}。C1—C3由主线复验关闭，统一v6、原v2恢复夹具及公共Graph来源／历史均保留。没有为已同步公共基线制作/tmp源码组合或再次交付旧公共补丁。

本轮新增变化为：同源ProgramToolsPort从ProgramsPort排除三个人工操作，harness工具adapter／构造器及KernelApplication装配只持有该端口；原有人工产品端口、broker清单和领域检查保留。ManualApplication的程序／环境登记、workspace、command观察持久确认和启动前重验已实际消费公共实现；KernelApplication在父实例exited前等待本域settle，并在project.restore组合本域钩子。没有第二套运行、授权或容量权威。

完成判据1／3／4／5／6本轮新增证据分别是：Agent HTTP工具结果与人工programRunId／详情／日志／输出相同；失效实例、目标只读、全局范围及Agent自行移交被拒绝；原unknown保持一个统一名额，副本historical且不持有command／host控制身份，取消副本和重开源项目不改原记录；实际CSV可由工作台打开，两个窗口读取同一运行并从第二窗口取消，第一窗口刷新已取消事实。判据2沿既有环境能力回归，离线本地wheel／tomllib实际工具检查通过；没有公网准备结论。design图和状态含义核对一致：started只表示进程启动，exit不是完整stopped，环境ready须环境检查，生态E4应用监督不由runCommand代替。

### 实际输入与仍缺提供者

本轮正式输入为 /tmp/scholoom-round3-handoff-qefwKi/{acceptance.md,manifest.json,prompts/project-execution.md}，旧的未同步描述已由恢复指令覆盖。此前两份阅读design、TaskRef及Agent快照消费结论继续保留，未把设计当实际提供者。新增精确核对如下：

| 路径（相对上述交接根） | 消费结果及证据边界 |
| --- | --- |
| research-task-workspace/packages/protocol/src/task-contracts.ts | TaskRef仍为projectId／taskId／fileId；workItemId不是programRunId。首批程序不强制关联任务 |
| research-task-workspace/apps/desktop/src/renderer/src/workbench/{tab-state.ts,session.ts,Workbench.tsx,business-session.tsx,shell/TabGroups.tsx} | 06补丁保留任务类型、TaskPanel／TaskList、renderTask(TaskRef,group.id)、已有导航代际，同时叠加programs插槽。打开程序沿原openTab撤销迟到任务导航；归一化白名单同时保留task／programs。只做上下文检查 |
| agent-delegation/packages/harness/src/runtime.ts及apps/kernel/src/application.ts | 05补丁保留delegationOptions原位置，programs追加其后；只给根工具添加programs，保留子工具限制、childrenController.abort、settleTools／childrenUnsettled，顺序组合ProgramRecords.restore。只做上下文检查 |

当前树没有TaskRef／TaskPort／tasks.*和真实TaskPanel／TaskList／任务宿主，也没有Agent私有delegationOptions／delegations仓储业务钩子。右栏简化tasks列表不算任务提供者；公共delegations表不算委派业务恢复。8.4真实任务tab联合消费保持开放，05／06不能替代其实际构建与联合验收。原阅读报告、批注、Notebook／远程／全局shell和环境类型均未扩大。

### 实际验证和首次失败

Linux／Node24.12.0，全部合成项目、隔离profile和输出；真实broker／SQLite／命令进程／原生归属／资源打开／浏览器及Electron。外部模型为loopback受控HTTP，故障时序沿既有有界端口注入，不代表真实模型科研质量或物理磁盘故障。先完成构建再测试；全部测试结束前未重建共享产物。

| 命令／操作 | 结果与证据 |
| --- | --- |
| pnpm --filter @scholoom/kernel... build；pnpm --filter @scholoom/desktop build | 通过。/tmp/project-execution-round3-build.log、/tmp/project-execution-round3-desktop-build.log；未安装新依赖 |
| pnpm -r typecheck；node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json | 通过。/tmp/project-execution-round3-typecheck.log、/tmp/project-execution-round3-tools.log；首次工具检查同样通过 |
| program-runs中Agent同一事实／host-loss两项定向 | 2/2通过，/tmp/project-execution-round3-focused-first.log；之后因新增Agent自行移交拒绝断言，随下述完整受影响集合再验 |
| node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{program-runs,program-runtime,program-environments,command-observation,project-migration-chain,project-recovery,execution-history}.spec.ts --output test-results/program-round3-kernel | **73/73通过**，1.5m。/tmp/project-execution-round3-kernel-first.log；保留C1后台授权／取消竞态、C2容量与恢复、C3长时限和观察确认、输出／取消后代、v4→v5→v6保护／重试、恢复副本及公共历史。旧可选外部Agent仓储适配用例未在本轮运行，不冒充业务组合通过 |
| 程序双宿主静态夹具 | **2/2通过**，52.7s，每项含两个真实窗口。命令以xvfb-run -a、SCHOOLOOM_TEST_ROOT=本树、SCHOOLOOM_UI_PORT=5361、SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-project-execution-round3-NCqJgg/ui-final-profile运行Playwright，--config /tmp/scholoom-project-execution-round3-NCqJgg/ui.config.mts tests/ui/program-runs.spec.ts --output /tmp/scholoom-project-execution-round3-NCqJgg/ui-final-results。/tmp/project-execution-round3-ui-final.log |
| 首次双宿主失败 | 新断言getByRole(heading)同时匹配运行／输出／日志三个标题，均已进入第二窗口。限定运行标题level:3后原时限复验，不改生产逻辑或时限。首次日志 /tmp/project-execution-round3-ui-first.log，原trace在/tmp/scholoom-project-execution-round3-NCqJgg/ui-results/，最终结果单独保存 |
| 架构／生成／格式 | architecture为14模块／206文件、0 findings／0豁免；/tmp/project-execution-round3-architecture.log。原生成器self-test及business-types／harness-module-types规范化生成一致性通过，/tmp/project-execution-round3-generation.log。受影响6份源码Biome通过；首次格式／隐式any提示已修正，保留/tmp/project-execution-round3-biome-first.log |
| OpenSpec／diff | add-project-program-runs --strict及scholoom-dev schema通过；git diff --check通过。正式规格未同步、未归档；Mermaid人工核对，未重新渲染 |

静态HTTP承载复用主线 /tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs 和原kernelBootstrap中间件，只服务本树已构建renderer；没有启动Vite dev或常驻开发服务。测试夹具关闭所属内核／窗口，结束5361无监听。临时profile、首次失败trace、结果和补丁作为交接证据保留，不删除、不作生产依赖。

### 审查、补丁和续做

原生辅助Curie只读核对任务五个共享符号；Wegener（gpt-6.1-sol/high）独立只读审查本轮diff及周边授权／恢复／UI实现，未发现确证缺陷。两者未写入、构建或代跑验收；主代理核对实际结果后接受本轮已完成局部成果。没有新Agent终端、常驻协调Agent或DAG。

交回 /tmp/scholoom-project-execution-round3-NCqJgg/README.md、manifest.json及01—08补丁。01领域实现／同源契约／登记／生成映射及测试，02自有UI，03内核／harness共享符号，04工作台共享符号，07本change和开发说明，均为公共0519904后的累计业务差异；在当前树仅反向git apply --check，未应用或回滚。05是Agent正式快照下03的替代上下文，06是任务正式快照下04的替代上下文，均git apply --check通过；patch-contexts只存7个共享文件前后文本，没有完整临时源码组合或运行。08只用于从同步HEAD查看本轮增量，不与累计补丁重复应用。精确依赖与文件清单见README／manifest，未重发公共command／deadline／迁移代码。

本轮tasks为25/28：4.2程序实际tab、8.1／8.2／8.3／8.5完成；8.4等待真实任务提供者，5.2历史CI／Windows诊断及6.2整个change最终交付继续开放。主线后续须在正式接入任务／委派业务时按符号组合并验联合路径，不把05／06上下文检查认作完成I1—I6或整个change。原始CI根因、Windows／macOS分发、全仓CI、真实科研质量、公网registry均无本轮新增通过结论。

达到本轮有界交回后停止；本轮未提交、推送、PR、归档、安装新依赖或操作真实用户库／其他真实树。现有原成果及文献4份工件保持保留，不自动展开下一阶段。
