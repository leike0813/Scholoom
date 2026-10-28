# 实际交付与交接

## 第十二轮公共提供者到位与机械路径验收

本线本轮按约无增量。主线已合入窗口／自有执行两端观察，并在原harness首例增加uiRpc清理前保存；同文件两个登记项目不再在共享配置退役前删除。此小改动经原两轴审查追加核对，无确证问题，停止／模型关闭及业务断言／期限保持。

首声明科研调用Browser通过；Electron首次未进入业务即显示服务失败，复用当前预检通过的DISPLAY补验后通过。实际内部调用、文件42、usable／notAssessed及报告打开均沿原断言，外部模型仍受控。两宿主窗口原指令／run与执行仓储、控制事件匹配，各六条旧控制事件的丢弃明确记录；不将有限观察当完整历史。证据`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`的main-ui、electron-recheck及cross-observer-results。

两个公共提供者与首机械路径均已具备，不再等待同一输入或重复旧trace。下一片等待明确科研业务流程／领域输入；这不是新生产Graph、真实科研质量或跨平台分发通过，原change未完项继续按实际保留。

## 第十一轮主线接收与等待

两份调查工件已保全合入，独立两轴审查无确证夸大；受理投影及报告读取前的缺证结论保持，不据旧CI或主线其他窄项宣称科研通过。项目／Agent下一片分别补真实窗口身份及自有model-kernel阶段，见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)。本线等待两片进入共同源码，不重复同一trace调查或消费他树私有在研成果，不新增生产Graph／角色。

## 当前状态与成果

2026-10-28续做状态：本树HEAD为938c33f2c9fcafb2cce11b0c165b2fb1e9a818c3，已消费共同基线。此次只读调查Linux双宿主声明科研首例，未改业务、夹具、规格、design或tasks；结论及同run证据见investigation末节和本记录末节。以下各日期的实施与测试结果保留为历史证据。

2026-10-27，本树HEAD已核对为共同源码4b13183f7489d3cae12fd0a7d1a9e83fb33d7384，开始本轮时clean。科研可信人工请求、公共历史、M2可信执行来源与各域实现均已接入；主线已接收真实I1机械切片，证据见 `/tmp/scholoom-round6-acceptance-dXuzCA/acceptance.md`、synchronized.json及两份sync结果。此前2812777及更早基线、安装授权和验证日志保留为历史证据，不再作为等待同步或复制累计补丁的条件。本轮仅修正第8组独立模块测试夹具，结果见末节；未安装依赖、操作其他树或新增提交、推送、PR、正式规格同步及归档。

已核对 [design](design.md) 的模块图和时序图；实际路径是科研入口 → broker → harness → 受管worker → 项目／库资源，执行权威继续归harness。对应proposal完成判据：

1. `ResearchGraphs` 及同源 `research.graphs/graph` 提供有界发现、精确版本、开放配置和节点资源来源。目录由源码装配，默认产品集合为空；未知版本和非法配置明确拒绝。
2. `ResearchRuntime.graphCalls` 组合科研调用记录、内部 `research.startGraph`、真实启动回执及历史查询。复用原 `research_attempts`，新旧类型明确区分；不存进程、等待或checkpoint状态副本，不新增Method实体。
3. 固定校准图实际读取项目文本及托管库文本，首次创建报告、保存真实interrupt，经现有产品连接的普通 `session.send` 确认后完成。复用原driver、InstructionSaver和资源保护，无外部模型、无任务端口替身。
4. `research.graphCalls` 关联真实来源下的尝试，按当前调用者权限读回必要材料／成果，分开返回Run、交付缺项及 `researchAssessment: notAssessed`。查询不执行、不补关联、不写回run引用；未知回执先核对原Message和图绑定。取消后的新尝试沿原来源，显式新调用另起来源，查询旧调用不取最新run替代。
5. 覆盖等待、撤权、关联失败、创建结果未知、保存受理期间取消、回执丢失、重启、并发补交和独立副本恢复。副本保留原材料／成果依据，仅校正本域归属并标注来源，禁止直接重启旧调用或自动访问原资源。旧材料分析保留原接口及行为。

主要文件：`packages/research/src/{graphs,graph-runtime,graph-delivery,runtime,records,schema}.ts`、科研protocol契约及派生映射、`apps/kernel/src/application.ts`、`architecture.json`、科研测试与固定worker夹具。开发说明更新实际入口及旧builtin路径，AGENTS补充调用来源与恢复约束。G1公共修改另归 [add-harness-execution-history](../add-harness-execution-history/delivery.md)，共享文件的符号归属见两份design。

## 实际验证

环境：Linux，Node `v24.12.0`，pnpm `11.10.0`，已有Playwright `1.63.0`。每个组合使用独立临时profile、项目、文献库及输出；真实broker、SQLite、项目／库模块、LangGraph和受管worker。旧模型相关测试只使用既有受控本地HTTP响应，未使用真实Key或用户库。fixture关闭其持有的app／worker；未启动开发服务器。

| 检查／命令 | 实际结果与证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck` | 通过，包含共享构建、各包及tools类型检查；`/tmp/scholoom-research-typecheck-final.log` |
| `pnpm --config.optimisticRepeatInstall=false build` | 通过，包含内核与桌面production构建；`/tmp/scholoom-research-build-final.log`。构建不等于产品运行验收 |
| `node scripts/check-architecture.ts` | 13模块、197文件、0 findings／exceptions |
| `node packages/protocol/scripts/contract-types.mjs --self-test`；生成patch与当前映射忽略格式空白比较 | 通过，无映射漂移；`/tmp/scholoom-research-static-final.log` |
| 对git列出的25个改动TS／JSON／MJS执行Biome check | 通过；同上。格式调整通过stdin生成patch，使用apply_patch写回 |
| 下列7文件定向kernel组合 | **62/62通过，6.6分钟**；`/tmp/scholoom-research-regression.log`，产物 `test-results/research-graph-regression/` |
| 最后补充的授权、同输入并发／分页／较新独立调用、混合仓储断言 | **3/3通过**；`/tmp/scholoom-research-final.log`，产物 `test-results/research-graph-final/` |
| 两个change的 `openspec validate <name> --strict`；`openspec schema validate scholoom-dev`；diff空白检查 | 通过；不代表科研质量、跨线整合或三平台交付 |

定向组合命令：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/research-graphs.spec.ts tests/kernel/execution-history.spec.ts \
  tests/kernel/research-module.spec.ts tests/kernel/research-capabilities.spec.ts \
  tests/kernel/registered-graph.spec.ts tests/kernel/registered-context.spec.ts \
  tests/kernel/resource-creation.spec.ts --output test-results/research-graph-regression
```

最终补验使用前三个文件，增加 `--grep 'reads project|direct entry|persists attempts'` 及独立output。62项包括6项公共历史查询、8项科研图、3项科研模块、11项旧材料分析、14项注册图、16项注册上下文和4项首次创建。公共恢复测试实际覆盖版本／checkpoint不兼容，本线未复制driver测试矩阵。

故障注入仅在测试边界：真实SQLite触发器拒绝关联／创建登记／科研回执保存；真实创建完成后暂缓返回以触发取消。文件、身份、收据与归属仍来自真实模块，没有成功业务替身。独立模块测试以可替换端口运行，不将它计为进程接线证据。

## 审查与问题处理

原生独立审查Agent（gpt-6.1-sol／high）发现并复核关闭四项：严格资源read参数投影、执行身份经原executionResources适配、并发重放统一核对图绑定、未知科研回执先核对原Message文本及图输入。实际回归覆盖这些边界，包括活动worker身份的科研查询与原文本A／B冲突。

初次整合6项失败由成果操作ID包含冒号引起；材料已经真实读出，项目创建的文件名规则拒绝了操作身份。改为 `graph_` 加来源／角色摘要，在1024字符原指令下仍可首次创建。后续正常路径的来源断言失败来自测试未使用工作台连接，改为现有connectProduct发送并核对完整持久上下文。保留初次日志 `/tmp/scholoom-research-integration.log`、`/tmp/scholoom-research-diagnosis.log`、`/tmp/scholoom-research-recheck.log`；最终结果以上表为准，未增加时限。

既有CI输入另见 [investigation](investigation.md)：No held RPC定位到files.save／resources.save gate错配；browser材料分析空串及Windows末态超时缺少阶段／trace证据，不能认定加超时即可修复。未改本线外UI测试或宣称既有CI已全绿。

## 未完成事项与下一步

本线图接入及可信人工请求已进入共同源码；项目任务与阅读等提供者也已进入本树。主线已接收I1机械切片，本轮不重复项目入口、任务／过程材料组合，也不据此推定完整I3／I5或科研质量验收。下节快照路径及此前未合入结论保留为当时的交接记录，当前同步状态以上节及第8组结果为准。

生产真实综合图的节点、顺序、回路、模型角色和质量要求仍待用户恢复讨论，用户自定义Graph继续后置；生产图目录仍空，固定图只证明机制，科研充分性始终notAssessed。本轮未运行UI／Electron、真实模型、Windows／macOS或分发包验收；当前macOS受管执行不可用的既有边界保持。后续规格同步／归档仍须依据实际完成范围及用户安排，不能由旧tasks全勾选推定。

## 本轮主线转交与消费结果

主线输入是 `/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`、coordination-plan.md及manifest.json；后者逐树注明共同基线e3d58fc。主线独立只读审查未发现本线确证缺陷，科研定向复验17/17通过。本轮没有新增业务缺陷可复现修复，也没有修改业务源码／生产图目录；完成了公共切片准备和实际交接输入消费。精确路径与字段映射集中维护在 [design的正式快照消费与I1装配](design.md#正式快照消费与i1装配)，不再要求用户转述已收到的接口。

| 正式消费输入 | 已闭合的核对 | 当前尚缺提供者／验收 |
| --- | --- | --- |
| research-task-workspace/packages/protocol/src/task-contracts.ts、projects/src/tasks.ts、kernel/manual.ts、harness/task-tools.ts及所属design/tasks/delivery | TaskRef三身份、workItem导航、四个tasks操作、入口entry.basis、source／process／result链接和保存部分失败语义明确 | 资源schema叶模块、TaskRef和真实tasks提供者尚未合入本树；I1真实产品启动与调用关联未实施 |
| research-interaction的两份design及workbench-context-contracts.ts／workbench-context.ts | 新位置／坐标字段只沿原InstructionContext、来源版本与普通消息接续；报告ready不恢复图 | ContextItem位置与image增量未合入；resources.report／批量append／HTML桥仅规划；M1／M2／M3和完整I5保持开放，U1修复结果未收到 |
| agent-delegation/delegation-contracts.ts、delegations.ts、application.ts及所属design | DelegationRole静态注入seam与版本、模型解析和工具收紧对齐；report是成果角色，旧Skill与无模型校准图都不是科研Agent角色 | 本树无委派提供者；A1修复、Agent组合及I3未验，真实综合／审阅指导仍待用户恢复业务设计 |

以上相对路径均以 `/tmp/scholoom-phase2-handoff-VZS5mS/` 为根；它们是正式交接证据，不是当前树已安装能力。原investigation记录的是首轮输入状态，本节和design更新其“尚未收到”待办：现在已收到接口与设计，尚缺合入后的实际提供者、产品请求契约及真实整合。

公共准备结果见 [公共delivery](../add-harness-execution-history/delivery.md#本轮公共补丁交接)：独立公共副本构建、31/31回归、0架构问题、正反补丁检查通过；两份补丁及Agent符号组合清单位于 `/tmp/scholoom-research-phase2-mtJQci/`。只读三方文本试合并没有把未合入Agent私有实现当共同基线。

### 可转交的真实材料与结果

本树先运行 `pnpm --config.optimisticRepeatInstall=false build:shared`，结果通过，日志为 `/tmp/scholoom-research-phase2-mtJQci/consumer-build.log`；随后执行同目录research-evidence.mjs，结果通过，日志为research-evidence.log。脚本仅调用既有KernelApplication、源码校准图、真实broker／worker／SQLite／资源端口，没有另写业务流程实现或任务替身。所有profile／项目／库／输出都在该目录research-evidence/，执行后已关闭本轮app和产品连接，未使用真实Key、用户库或开发服务器。

- `/tmp/scholoom-research-phase2-mtJQci/material-result-evidence.json`：保存两类材料实际ResourceDescriptor、原ref/basis、调用输入、启动回执、waiting／completed查询、可信来源的consumed确认消息及报告字节。
- `/tmp/scholoom-research-phase2-mtJQci/research-evidence/project/report.md`：真实首次成果，含项目样本result 42和库样本comparison 17；不是空占位文件。actual runId为 `c4f3fb08-ab9c-4fdc-a57a-259eb169b235`，产物fileId为 `dbd4c1dd-6277-487a-b9ce-852ed34cc1ae`，创建及association均confirmed／complete，最终check为usable／notAssessed。
- 该证据显式声明：图初次启动来自可信宿主fixture；确认与结果查询来自connectProduct；**tasksProvider未装配、I1未接受**。不能把这份材料／结果证据代替项目线从真实用户入口启动及任务链接保存的验收。

### 主线下一步决策与停止点

主线可按design中的7步装配清单推进I1，但须先确认有限产品请求及调用关联落点：优先评审方案A（项目侧组合，TaskRef／workItemId及调用引用留在任务／过程材料，科研schema不增加字段），方案B为科研记录增加可选同源TaskRef／workItemId并另立有界规格。两案均不能把host-only research.startGraph直接开放给客户端；操作归属、所选sourceLinkIds与入口basis核对须明确后再实施。该分支本轮仅设计，未自行选定新跨模块契约。

真实科研角色及综合流程仍待用户恢复设计；可继续通用worker的机械I3验收，不能从校准图推导科研角色已具备。公共dev接入和Agent组合门由公共change的tasks 4.1保持开放。本轮止于补丁、消费核对和上述真实资源证据，不同步规格、不归档或进入科研质量验收。

## 2026-10-26 同步恢复后的人工请求实施

本轮已按明确恢复指令从本树正式源码继续，未再复制临时组合。恢复起点HEAD为281277777f88aa068c948512f084f0d05150776e，0519904（含b838402）为祖先；恢复前clean。同步与原17项切片通过证据为 /tmp/scholoom-sync-recovery-wyn13R/recovery.md、synchronized.json及本树日志。本轮没有覆盖既有WIP、文献工件、公共来源／历史、统一迁移或ContextItem叶schema；没有新提交或同步其他树。

### 已实现入口与精确消费契约

唯一人工操作为 research.requestGraph，params与ResearchGraphStart同源：

- 必填projectId、sessionId、invocationId、instructionId、graphId、version、config、materials、text；materials为1–10份ResourceEvidence，text为1–32768字符，config必须通过所选源码图schema。
- 返回真实 {invocationId,instructionId,runId}。原身份／原输入的并发补交复用受理及持久回执，异参拒绝。已恢复副本在资源预检前明确unavailable。
- 只接受broker绑定的product/human及其已绑定范围；角色、workDomain、worker入口、TaskRef或任意额外载荷字段均不能提权。research.startGraph仍为host/system内部操作，ResearchToolsPort明确不包含人工请求，不向执行Agent新增该工具。
- 使用真实session、图目录及instructionResources核对origin信任、目标读取、库read/send、实际ref/basis和read能力；实际worker继续核查版本／资格。新请求不得抢占queued/running/cancelling/waiting，不取消旧推进、不自动新建会话。
- 经过内部research.startGraph → harness.startGraph → 原受管worker；原workbenchSource从宿主上下文保留至初始指令。图描述／executionGraphs／worker仍同源测试注入，生产集合为空。

项目侧已定方案A，不再等待同一产品方向重复定案。本线提供上述唯一调用；项目线拥有服务端TaskRef/workItemId、任务entry basis与sourceLinkIds核对，薄挂载任务详情动作，并将回执及必要依据写入任务process材料、以任务新basis条件保存结果链接。科研schema／记录不加任务字段，不另开第二个启动入口。完整字段及双方文件符号归属见design的“恢复后的实施决定”。

### 最终受理与独立公共补充

独立复核发现预检后的await窗口仍可能撤权或被普通消息形成的waiting抢占；本轮创建独立 guard-harness-admission 公共增量。Harness.send只增加可选同步admit参数及原事务内一次调用；科研私有WeakMap以宿主新建signal绑定权限／当前会话检查，内部broker保持signal身份，finally释放标记。旧host、历史查询、来源及checkpoint权威不改。

公共与私有补丁分开，公共提供者不依赖科研业务字段；公共独立测试只使用已存在的domain-execution-worker和原资源端口。其实际验证与复审见 ../guard-harness-admission/delivery.md。本线恢复副本问题另在request授权前检查本域restored标记，避免先访问旧材料引用。

### 实际验证和保留的首次失败

本次只使用本树已有依赖，Linux／Node24／pnpm11.10.0。先完成共享构建，再运行固定产物；包和tools类型检查为无emit，测试运行中没有重建共享产物。

| 操作 | 结果与原始证据 |
| --- | --- |
| pnpm --config.optimisticRepeatInstall=false build:shared | 通过；/tmp/scholoom-research-request-build-final.log |
| pnpm --config.optimisticRepeatInstall=false -r typecheck；node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json | 全包与tools通过；/tmp/scholoom-research-request-types-final.log |
| 6文件kernel组合，见下方命令 | 47/47通过，4.1分钟；/tmp/scholoom-research-request-final.log |
| architecture、生成器self-test及格式归一化映射核对 | 13模块／200文件，0 findings／exceptions；派生映射一致 |
| 改动源码Biome、3个本线change的OpenSpec strict、diff空白检查 | 通过；只验证本次范围，不声称全仓CI |

固定组合命令：

    node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
      tests/kernel/harness-admission.spec.ts tests/kernel/research-graphs.spec.ts \
      tests/kernel/research-module.spec.ts tests/kernel/execution-history.spec.ts \
      tests/kernel/research-capabilities.spec.ts tests/kernel/registered-graph.spec.ts \
      --output test-results/research-request-final

47项包括公共admission1、历史6、原注册图14、旧材料分析11、科研图12、科研模块3。科研测试已改从真实connectProduct请求，覆盖项目／库取材、首次成果、等待普通确认、取消、重启、丢回执与部分保存；同输入并发、伪造上下文／额外参数、精确版本／配置、材料basis、撤权、归档和两项最终受理竞态均有实际结果。恢复副本还核对请求不描述旧资源。未安装任务提供者或用成功替身冒充任务I1。

最初未重建产物时，新产品操作未注册而返回permissionDenied，保留 /tmp/scholoom-research-request-red.log；首次已构建组合29通过／1失败，恢复副本错误返回permissionDenied，保留 /tmp/scholoom-research-request-tests.log。修复前两项最终受理探针都错误返回成功run，保留 /tmp/scholoom-research-admission-red.log；只延迟真实project.check返回，未改业务权限或伪造成功结果。修复后上述47项通过，没有增加生产或测试时限。

独立只读审查Agent（gpt-6.1-sol／high）发现并复核关闭两项P2：最终同步admit在重放之后且新写入之前，无await窗口；私有signal不能由公共schema伪造；恢复标记与source传播正确。复审没有运行构建／测试，最终实跑由父Agent核对。所有合成profile、项目、库、输出各用唯一临时目录，fixture关闭其app／worker；无真实Key／用户库或常驻开发服务器。

### 可审查补丁与停止边界

交接目录为 /tmp/scholoom-research-request-handoff-DNDj0C/，包含：

1. 0001-guard-harness-admission.patch：两行通用harness变化、公共独立测试及该change的7个工件。
2. 0002-connect-research-request.patch：本轮科研协议、派生映射、窄适配、kernel注册／source传递、实际消费测试、开发约定和原tasks／delivery更新；不含公共runtime或新公共测试的重复补丁。
3. manifest.json及build.log、types.log、kernel.log、red-api.log、first-integration.log、red-final-admission.log：相对2812777的完整文件归属及首次／最终结果。

只生成补丁和只读git apply --check／reverse --check核对，没有新建工作树、复制其他线私有实现或应用到dev。顺序为公共补充→科研私有补丁→项目线消费同一research.requestGraph并组合任务详情／process材料。共享符号只改Harness.send的可选受理检查、application科研graph ports／内部handler、researchOperations／派生business映射；没有修改公共历史、迁移、TaskRef schema、Workbench/tab或阅读图片消费者。

本轮已定有界适配完成。仍需项目真实提供者、任务服务端选项核对、详情动作和过程／结果链接保存的实际组合，才可验收完整I1。真实综合Graph、科研模型角色、I2、自定义Graph继续后置；没有编造synthesizer／reviewer或新增Method。没有新增UI／双宿主、Windows／macOS、分发包、全仓CI或真实科研质量通过结论，不自动开展下一阶段、归档、推送或PR。

## 2026-10-27：M2接入后的旧能力模块夹具修正（第8组）

这是用户本轮明确授权的轻量测试修正，沿既有材料分析契约维护，不新增规格行为。当前基线为4b13183，包含主线已接收的I1机械切片、M2可信执行来源／通用worker TaskPort和生态工具持续外发授权修复；本轮不改这些实现。原模块图、时序图及生产目录为空的边界保持，未重新实施任务入口或增加科研角色。

### 首次失败与根因

最新CI输入为6b22d602046baa7c1349bf66059c61d79c07ae40／40315429083，来自 `/tmp/scholoom-round6-acceptance-dXuzCA/ci-baseline-failures.log` 和ci-baseline-summary.json：Linux内核689通过／9失败／16跳过，Windows628通过／49失败／30跳过，macOS入口3通过／1失败。以下仅承接其中research-capabilities六项Linux／Windows共有失败，不将其他失败或平台状态计为关闭。

先完成共享／内核构建，再运行未修改的research-capabilities整组：**6失败、5通过，1.3分钟，退出码1**，保存 `/tmp/scholoom-research-capabilities-round6/red.log` 及red-results/，与CI六项一致。发现／交付、重试和报告移动返回incomplete；并发路径替换因首份报告未保存而出现ENOENT；身份复核没有得到预期contentChanged；取消／重启没有部分产物。

共同根因在该文件setup：独立ResearchRuntime使用合成runId／instanceId，而ProjectBackend却调用 `app.projectFiles` 的生产执行端口，传入上下文甚至没有runId／instanceId。当前保存经 `ManualApplication.fileOrigin → KernelApplication.checkExecutionContext → Harness.checkExecutionContext` 验证真实活动尝试；无资格上下文应被拒绝。ProjectBackend将保存错误转换为结果并登记failed进展，后续交付检查因无真实成果而失败。这不是生产权限过严，也没有证据支持增加超时。

### 文件、符号及替身边界

仅修改 `tests/kernel/research-capabilities.spec.ts` 的setup.files和独立ResearchRuntime的files注入：显式提供 `ProjectFilePort & ResearchProjectPort`，供同一夹具的ResearchRuntime与真实ProjectBackend使用。七个窄方法分别委托真实ProjectStore的check、path、material、read、list、files.resolve和save；保存完整转交basis、expectedFileId与resourceBasis。保持原读取／保存／failed进展回调和全部原有断言，包括报告移动后的稳定身份、条件修订、并发同路径替换、交付／重试重新核对身份、部分成果、取消与重启查询，以及备份恢复。

替换的是独立模块测试的执行调度与文件调用身份适配，不是假文件实现或生产执行资格。合成run／instance仅用于科研记录关联及progress核对，不再送入生产写入端口。实际文件字节、fileId、读取basis、目录／版本、信任检查、SQLite记录和恢复仍来自真实模块。夹具直接save使用ProjectStore默认unknown／unattributed来源，不伪造human／host／system或Agent执行事实；此模块结果不作为M2来源整合证据。

同组真实harness保存期间取消及真实模型Graph用例保持生产入口和原断言；受控本地HTTP模型只是外部边界替身，内部broker、harness、仓储、worker与文件真实。原进程中断用例保持其只读researchFiles及实际仓储写入边界，不将其合成执行身份写成真实worker资格。没有修改production checkExecutionContext、FileEdit来源、kernel生命周期、委派或项目任务入口。

### 实际验证与交付

环境：Linux、Node v24.12.0、pnpm 11.10.0。下列命令均在本树运行，测试期间未重建产物；仅使用已有依赖，无开发服务器、真实模型凭据或用户库。各例沿原夹具生成独立profile／项目／库及端口，关闭所属app／worker后退役整个所属临时根目录，不留下仍登记却被删除的项目。红／绿日志和trace保留在下列证据目录。

| 命令／检查 | 结果及证据（均位于 `/tmp/scholoom-research-capabilities-round6/`） |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared` | 通过，退出码0；build-initial.log，包含共享包及kernel。随后仅改测试与文档，无需再次生成业务产物 |
| 原整组：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/research-capabilities.spec.ts --output /tmp/scholoom-research-capabilities-round6/red-results` | 修正前6失败／5通过；red.log及red-results/ |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/research-capabilities.spec.ts tests/kernel/research-module.spec.ts tests/kernel/research-graphs.spec.ts --output /tmp/scholoom-research-capabilities-round6/final-results` | **26/26通过，2.0分钟，退出码0**：旧能力11、独立模块3、科研Graph12；final.log及final-results/ |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 通过；types.log |
| `node scripts/check-architecture.ts` | 14模块／253文件，0 findings／exceptions；architecture.log |
| `node node_modules/@biomejs/biome/bin/biome check tests/kernel/research-capabilities.spec.ts` | 通过；biome.log。首次格式检查仅指出参数解构需换行，使用apply_patch修正后通过 |
| `openspec validate connect-research-graph-runtime --strict`；`git diff --check` | 通过；openspec.log及diff-check.log。schema／生成映射未变，无需重生成 |

自查核对了窄端口的调用方和参数转交、真实仓储身份竞争及受控外部模型边界；没有降低原有效断言、错误期望、时限或停止保护。新增代码仅为已有端口的直接委托，未增加新测试框架或生产修复。可审查增量为同目录 `research-capabilities-fixture.patch`，基于4b13183，包含本测试及原tasks／delivery共三个文件；仅导出并做reverse --check，未应用到其他树。

本轮六项在Linux已由红转绿；Windows共有根因已修正，但没有Windows目标实跑，平台关闭仍待主线验证。其他全仓CI失败、macOS、UI／双宿主及真实科研质量均无本轮新增通过结论。真实综合Graph、节点／模型角色、I2及用户自定义Graph继续后置；不归档、不推送／PR，不自动展开下一阶段。

## 2026-10-28：双宿主声明科研首例的只读交接

按本轮授权，只维护investigation及本delivery。已读取AGENTS、七线计划第十轮安排、科研职责票、原design／tasks／delivery、scholoom-dev阶段约定，并取得当前apply及实际调查后的delivery instructions。CLI原任务25/25全勾选不代表归档；本轮不新增任务或业务契约。原design的新旧入口共存图及生产图空目录保持。

调查结果见 [investigation的本轮结论](investigation.md#2026-10-28声明科研调用-ui-首例的双宿主只读调查)：Checks40479176954／8c2fd24的Browser与Electron均在第39行等待执行完成失败，未到第42行报告读取。GUI走普通session.send；受控模型应随后触发旧scholoom.material-analysis／1.0.0，没有GUI方法选择、research.requestGraph或生产业务Graph。可确认UI看到queued／accepted投影，缺同次执行及消费事实；目前不能确诊科研模块错误或分析质量失败，也不能断言首模型／research.invoke为零。将harness消费／首次模型推进及UI刷新缺口交Agent／公共提供者，经主线统筹；未跨树发消息或修改公共初始化。

| 实际只读操作／检查 | 结果及边界 |
| --- | --- |
| `git status --short`、`git rev-parse HEAD` | 开始时clean，HEAD938c33f；结束仅两个授权文档变动 |
| `openspec list --json`、`openspec status --change connect-research-graph-runtime --json`、`openspec instructions apply --change connect-research-graph-runtime --json` 及同change的 `instructions delivery --json` | 最近本树root已确认，scholoom-dev，原任务25/25；输出保留 `/tmp/scholoom-research-ui-round10/` |
| `gh api repos/leike0813/Scholoom/actions/runs/40479176954/artifacts` | 确认Linux artifact12728680109与run／完整head一致；未查询外项目或触发CI |
| 同artifact只读取四个目标ZIP项并解包trace | Browser／Electron的error-context.md与trace.zip均经ZIP CRC核对，路径、大小、CRC、身份与动作时间见同目录artifact-entries.json、first-case-evidence.json及selected/。首次完整下载和普通Range未完成／未生效，均未当成功证据；改用x-ms-range取指定区段，完整性只覆盖选定四项 |
| `git diff 8c2fd24 HEAD`，限定UI首例／fixture／model-server、harness、research、kernel科研装配和相关UI／CI配置 | 无路径变更；另核lifecycle的启动观察差异。原失败属于旧run，不计为当前HEAD新实跑 |
| trace的JSON事件与network目录核对、根因自查 | Browser可恢复实际项目／会话和20秒窗口；Electron仅动作／时间。两者均无instruction/run/instance、消费／首次模型／科研受理附件；artifact无UI配置DB或内核日志。后端卡在哪个阶段与UI刷新异常仍不可区分 |

只读辅助Agent使用gpt-6.1-sol／high、fork_context:false，核对了GUI、模型替身、开发承载及调用边界；父Agent核对同run artifact、关键源码及最终分类，辅助Agent已关闭。未启动开发服务器、构建、UI／内核测试或安装依赖；只改文档，沿主线已构建产物，不重复已有绿测，也不把开发夹具放在普通静态产品中冒充复验。

临时下载、索引及选定trace保留在 `/tmp/scholoom-research-ui-round10/` 作为调查依据；未完成前缀和稀疏索引不能当完整artifact。临时读取使用已有gh、Node、uv共享环境Python标准库及unzip，未安装新工具。本轮拥有的下载进程已结束，无自有内核／worker／开发服务在运行。收尾执行 `openspec validate connect-research-graph-runtime --strict` 及 `git diff --check` 均通过，结果分别保留于本轮validation.log、diff-check.log。

本片完成的是首例双宿主的因果分类／明确缺口，UI失败仍未关闭。未改生产授权、期限、停止保护、容量、库权威或旧能力／图边界；未扩其他harness.spec场景、生产Graph／科研角色、真实模型、Windows／macOS／分发包或真实科研质量验收。等待主线按精确缺口安排提供者接线，不自行进入实施、提交、推送、PR或归档。
