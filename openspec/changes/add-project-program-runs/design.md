# 实现设计

## 变更总览

依据[调查](investigation.md)和[运行契约](specs/project-program-runs/spec.md)。以下是拟实施方案，不是当前实现。首个change完整交付项目内固定程序闭环与受管Python环境准备，仍以已有共同资源打开实际输出。

```mermaid
flowchart TB
  Human[人工项目运行tab] --> Client[共同client与broker]
  Agent[项目Agent工具] --> Client
  Client --> Programs[ProgramRuns与ProgramEnvironments]
  Programs --> Records[自有program_runs与环境记录]
  Programs -->|声明材料和实际输出| Project[项目文件与ResourceRef权威]
  Programs -->|宿主绑定的程序及工作空间ID| Commands[ManagedCommands共同执行]
  Commands --> Admission[同一个ProcessAdmission]
  Commands --> Managed[ManagedNode与原生归属]
  Managed --> Process[真实Node或Python或uv程序]
  Commands -->|经broker回传有界观察| Programs
  Process -->|直接保存实际输出| Project
  Human -->|按实际fileId打开| Resource[共同ResourceView]
  Resource --> Project
  Editor[EditorRuntime专用排版状态] -->|原platform.command保持| Commands
```

兼容宿主不参与本次执行。科研Graph选择方法和解释结果，harness只把受限工具接入本模块；它们均不保存第二份程序运行状态。

## 方案与接口

### 1. 深模块与唯一事实源

新增私有workspace包 `packages/programs`：`ProgramRuns` 处理受理、程序归属、状态、日志、产物核查和接续诊断；`ProgramEnvironments` 处理已有环境与受管准备。两者共用运行执行／记录机制，环境准备是 `kind: environmentPreparation` 的运行，不另造一套job状态、日志或取消器。环境ready状态来自对应准备结果和当前依据。

选择新增模块而非并入editor或harness：删除本模块会使授权准备、幂等受理、日志、停止和核查逻辑散回两个调用方；保留它能让人工与Agent跨同一interface完成整条路径。公共interface只提供环境、运行、日志与取消，不暴露平台句柄或数据库。内部seam分别为真实／受控命令端口和真实／内存记录adapter，供独立测试替换。生产跨模块均经broker，普通静态计算不需要broker。

同源DTO放 `packages/protocol/src/programs.ts`，字段界限、错误、操作副作用和等待语义一起声明；公共映射引用原schema。`packages/programs`只读写自身表与私有环境配置，复用protocol／platform及已有better-sqlite3，未引入新第三方版本。项目文件、身份、授权和成果关联继续归projects。

### 2. 公共操作与字段含义

名称在本change内统一为 `programs.*`。通过现有 `KernelClient.call` 和broker接入，不增加逐操作客户端包装方法。

| 操作 | 输入与输出 | 语义 |
| --- | --- | --- |
| `programs.environments` | projectId、分页；返回environmentId、kind、availability、已知version、diagnostic | read/result，5s；默认25、最大100；只读不自动探测／准备 |
| `programs.registerEnvironment` | projectId、operationId、kind及可信人类登记的解释器／uv位置；返回environmentId | write/reference，5s；只允许人类产品入口，保存配置后以受管探测run核查；Agent不可调用 |
| `programs.environmentPlan` | projectId、operationId、environmentId及项目声明的ResourceEvidence；返回planId及检查run引用 | write/reference，5s；幂等受理有界检查，不安装 |
| `programs.environmentPlanStatus` | projectId、planId；返回检查状态、确切依据／动作／授权需求 | read/result，5s；检查未结束时返回pending及检查run引用，不伪造已解析计划 |
| `programs.authorizeEnvironment` | projectId、planId；返回已绑定原计划的授权引用 | write/result，5s；仅可信人类明确同意该计划，不接受Agent自报批准字段；相同依据复用 |
| `programs.environmentPrepare` | projectId、planId、operationId；返回准备run引用 | write/reference，5s；只消费宿主已有授权；缺授权返回permissionDenied与planId |
| `programs.start` | projectId、operationId、environmentId、cwd、entry、args、inputs、outputs、timeoutMs、lifetime | write/reference，5s；返回持久programRunId和当前state，后台推进 |
| `programs.run` | projectId，以及programRunId或本主体的operationId二选一 | read/result，5s；返回持久事实，不隐式重试程序／安装 |
| `programs.runs` | projectId、before、limit | read/result，5s；默认25、最大100，稳定分页，不返回正文日志 |
| `programs.logs` | projectId、programRunId、after、limitBytes | read/result，5s；最大64KiB，返回stream／seq／text、next、truncatedBefore、lastLogAt |
| `programs.cancel` | projectId、programRunId | write/reference，5s；幂等返回cancelling或真实终态，完整停止异步查询 |
| `programs.handoff` | projectId、programRunId | write/reference，5s；仅可信人类对正在运行的Agent程序逐次移交，保存backgroundOwner |
| `programs.reconcile` | projectId、programRunId | write/reference，5s；仅核查停止证据和明确outputs，补登记／关联，不重跑或重写字节 |

运行字段：

- `programRunId` 是本域身份；`operationId`按项目＋可信主体去重，比较规范化输入本身而非增加hash门禁。同身份不同请求拒绝。`origin`可选保存sessionId／harnessRunId／instanceId，仅溯源，不把它叫programRunId。
- `cwd`为项目相对目录，默认`.`；`entry`是本项目代码的ResourceEvidence；`inputs`最多100项同项目ResourceEvidence。`args`使用独立字符串数组，最多128项、每项最多4KiB、整体最多64KiB，不拼shell字符串。`entry`放在解释器参数的固定位置，禁止用entry字段注入解释器选项；首批不提供任意`-c`／`--eval`／加载器选项入口。
- `outputs`最多100个显式项目相对路径；默认 `runs/<programRunId>/` 下新目录，由项目已有mkdir／路径检查建立。调用方指定已有输出时须有显式覆盖范围，保存启动前依据；不默认复制项目或旧成果。
- `timeoutMs: number | null`是程序期限，null为明确长任务无总期限；不是RPC等待。Node／Python实际计算默认null；版本探测10s，uv准备默认10分钟并允许明确配置调整，不因无日志提前终止。这些初值在实现验收校准，不用CI失败直接修改。
- `lifetime: execution | background`：人工默认background；Agent默认execution且不能自行选择background。可信人类逐次handoff，先由prepareHandoff取得无副作用资格票据，再持久backgroundOwner（human/id/at/state=authorized），同步commit重新检查控制及父取消，最后保存active。父取消先发生或票据失效则failed且仍保留原取消责任。接管已完成但完成收据失败保留已持久授权，以active＋outcomeUnknown报告本宿主事实；后续成功观察可补收据，重启保守核查。
- `state`沿规格；另有`phase: accepted | environment | admission | starting | executing | stopping | inspecting`及结构化`error`，用于定位失败阶段。`exit`保存实际code／signal／reason，可独立于`stop: pending | confirmed | unknown`和`outputAssessment: unassessed | partial | observed`。状态不从日志文案推断。
- `command`保存实际executableId、args、项目相对cwd、解释器版本；原生可执行路径仅在可信本机环境设置／私有诊断可见。密钥或索引令牌不得进参数和普通日志；显式程序stdout仍可能包含用户材料，按项目权限读取，不宣称能可靠脱敏任意程序输出。
- `code`／`inputs`记录实际启动前依据；`dependencyCoverage: declaredOnly`，无法确认的环境版本用缺失字段及原因表达。不能从参数推断“实际已读取”。直接程序执行不具备所有文件读取追踪能力。
- 输出项保存`declaredPath`、实际`ResourceEvidence?`、`observedAt`、`presence`、`completeness: unassessed | incomplete`、`attribution: observed`和可选关联状态。默认无通用科学完整性checker，不把文件存在标成verified；固定程序的CSV内容由独立样本断言验收。

消费的项目窄端口复用 `project.check`、`project.path`、`project.material`、`files.resolve`、`files.mkdir`、`resources.describe` 和适用的 `project.linkArtifact`。项目relative path／nativePath只能在受控宿主adapter内转换，ResourceEvidence必须由resources.describe取得其strong basis；不能把project.material的文件指纹当成共同资源basis。启动前同时核对声明资源basis及宿主执行所定位的实际文件；输出先由项目登记再取共同descriptor，不向UI／模型返回nativePath。既有ProjectTargetReadPort不作为执行输入或写入授权替身。

### 3. 平台增量：共同机制，保留editor语义

原 `platform.command`／`platform.editorCommand` 和 `ManagedCommands.execute` 的返回、stdout1MiB失败／stderr64KiB及有限期限保持。新增内部 `platform.programStart`、`platform.programCancel`，只对宿主装配的programs消费模块开放，客户端／worker不能直接调用。两种模式复用同一个启动、授权、准入和完整停止实现，不维护两个命令执行器。

`platform.programStart` 输入为workspaceId、executableId、args、nullable timeoutMs；workspaceId在宿主私有表中绑定programRunId、ownerModuleId、projectId、受控cwd和允许环境，不能来自客户端任意nativePath。返回commandInstanceId后异步准入；它只有瞬时控制句柄，不提供另一份持久run/status/log仓储。`platform.programCancel`按workspaceId＋commandInstanceId核对真实所有者。

运行观察统一由宿主adapter经broker调用内部 `programs.commandEvent`。输入包含programRunId、hostInstanceId、commandInstanceId、递增seq和事件联合：`intent`、`started`、`output`、`exited`、`stopped`、`unknown`。只允许装配的宿主system调用，载荷不能自授身份。programs持久提交后返回ack；platform库只接受通用observer，不导入programs，不形成包依赖环。事件声明归各自产生的共同执行／运行同源契约，宿主负责映射，不在IPC写第二份载荷。

启动顺序：运行受理落盘 → `intent`落盘并ack → 取得统一准入 → 授权／依据重验 → 创建ManagedNode并持久started → 发送实际命令。原生归属建立前不加载用户代码；intent已保存但started丢失一律保守核查，不推断尚未执行。`stopped`事件只来自原 `ManagedNode.stopped`，先持久停止收据再确认运行终态；收据持久失败保留unknown。

program模式通过 `command-worker` 分片输出，使用UTF-8安全解码，每片最多16KiB，最多4片未确认；IPC确认前暂停继续读取，跨host的背压不可积累无限Promise。到保留容量后继续排空并仅计数／保存尾部，不能无限缓存。每运行 stdout／stderr合计保留1MiB和流顺序，持久记录滚动替换已淘汰片段；读取游标使用seq并报告缺段，不以字节切断Unicode。磁盘写失败停止相关工作并保留日志不完整诊断，不能报告完整日志成功。运行中刷新合并，每250ms至多发布一次运行变化，最终状态立即发布；不把每片正文加入workbench snapshot。

```mermaid
sequenceDiagram
  participant U as 人工或Agent
  participant R as ProgramRuns
  participant B as broker与宿主adapter
  participant C as ManagedCommands
  participant P as ManagedNode及程序
  U->>R: programs.start含operationId
  R->>R: 校验并持久queued
  R-->>U: programRunId
  R->>B: platform.programStart
  B->>C: 登记的工作空间与原主体
  C->>B: intent观察
  B->>R: programs.commandEvent
  R-->>C: 持久ack经宿主返回
  C->>C: 统一准入及再次授权
  C->>P: 归属建立后启动实际程序
  P-->>R: 有界日志经宿主和broker提交
  alt 用户取消或程序期限到达
    U->>R: programs.cancel
    R->>B: platform.programCancel
    B->>C: 停止原commandInstanceId
    C->>P: 协作退出及必要终止后代
  end
  alt 完整停止已确认
    P-->>C: stopped
    C->>R: 经broker保存停止收据
    R->>R: 核查声明输出并保存真实终态
  else 控制或确认丢失
    C->>R: 经broker记录unknown
    R-->>U: 未知及仍占用的原因
  end
```

### 4. 环境计划和授权

环境配置由ProgramEnvironments持有。Node使用宿主实际可执行文件；已有Python／Conda使用人类在可信本机启动配置登记的路径，启动时做受管版本探测，某些Conda包需要额外系统变量时明确报不支持／缺项，不复制整个登录shell环境。

新增应用私有 `programs/environments.json` 保存environmentId、类型、登记解释器和项目绑定；已有环境不由prepare修改。运行tab内可信人类环境设置通过registerEnvironment接受本机路径，Agent只能选已登记environmentId。准备授权记录包含planId、projectId、解释器身份、声明资源依据、受管目标、网络范围和允许的安装／构建动作。人类经authorizeEnvironment明确同意，Agent只能消费；本树没有通用任务安装授权提供者，首批不假定已存在，未来若有该adapter再按正式契约消费。配置中的缺失工具不自动安装。

uv首批要求项目根pyproject.toml和uv.lock、已有uv及Python 3.11+，执行 `uv sync --locked --no-dev --no-install-project --no-install-workspace --no-python-downloads --no-build --no-editable --no-config --project <受控项目根> --python <已登记解释器>`；无网络来源时额外offline。宿主显式注入私有UV_PROJECT_ENVIRONMENT／UV_CACHE_DIR，禁自动下载解释器，不继承不受控的UV／PIP配置。仅支持能核对来源和SHA-256的registry wheel及项目内wheel，拒绝源码构建、git、editable／目录依赖；无法解释则拒绝，不放宽到未锁安装。

本树没有现成TOML解析依赖；实测uv 0.9.17的CycloneDX输出不含授权所需完整来源／hash，不能作为计划依据。选择应用固定 `inspect-lock.py`，经已登记Python的标准库tomllib解析有界原声明，核对锁定来源、项目内路径和本地wheel实际hash；同样经ProgramRuns受管执行。计划、同步、验证都携带原ResourceEvidence，在准入等待后及实际启动前重验。Python低于3.11仍可作为直接运行环境，但不能用于uv准备。

声明必须直接位于项目根。uv 0.9.17 即使使用no-config／显式project仍会发现父workspace，已由隔离dry-run确认；计划检查及实际sync前均经固定脚本拒绝父workspace，不能转用其lock。实际准备命令由已登记Python执行 `inspect-lock.py --sync <uv> <项目根> <sync参数>`，检查后execv已有uv，完整进程归属保持。计划中的uv动作与运行中的固定检查包装分别保留，未复制或修改用户声明。

先形成计划再授权再执行，计划变化要求新依据。相同范围授权可复用；只读查询不触发网络。登记探测后保存解释器stat收据，已有环境及ready受管环境在resolve／validate／重启时重验；替换后清除旧版本并标unavailable。准备失败保留目录和诊断，不将部分目录标ready。用户已批准本轮隔离安装与测试，公网registry下载未实跑。

配置UTF-8候选及读取共用4MiB限额，替换前核对；容量拒绝原位恢复对象，保留在途probe持有的引用，不永久污染模块。每个活动登记／计划为有界回执和恢复诊断预留16KiB元数据envelope，已写元数据消耗该预留；不会在每次补引用时重复追加固定16KiB。准备先保存input／principal意图与working，再派发；reference收到后在预留空间内保存。回执未知的意图阻止同一环境的新准备，重启不重放。旧未预留的近上限配置如容不下恢复诊断，保留原文件及全部历史、在内存提供规范化unknown状态；初始化在恢复后完成，新写仍明确tooLarge。

### 5. 归属、持久化和恢复

`program_runs` 是programs独占表，保存请求、依据、生命周期、有界日志及归属收据。公共容器统一为v4→v5 delegations（Agent快照的原表及两个索引）→v6 program_runs；每步事务建表和推进版本，分别保存before-migration-v5.sqlite（v4）／before-migration-v6.sqlite（v5）。v5只指delegations前缀，旧program-only v5隔离样本明确拒绝而不猜历史／覆盖数据。环境与授权在应用私有配置，不随项目备份复制机器路径和凭据。

默认execution程序随父信号停止，父退出等本域收尾；已接管运行从本次父收尾集合排除，不能因集合取得早于移交而等待后台程序结束。backgroundOwner.state区分authorized／active／failed，只有active代表实际接管；先验证、持久授权、同步接管、完成收据的失败窗口均有回归。运行保留origin，后续读取按新主体授权；关闭客户端只解绑订阅。

重启在开放新执行入口前由宿主读取各已登记项目的未确认程序归属：有可信完整stopped收据才标interrupted；明确queued且无启动intent可标interrupted；其余为unknown。未知实例保留与正常执行同一ProcessAdmission中的名额：通过现有reserve＋永不确认的retainUntil重建占用，恢复未知数超过当前上限时饱和占满并保留真实未知数诊断，不排进有期限普通等待队列。按commandInstanceId幂等恢复，不能项目重开就重复计数；在途／未知项目禁止从宿主登记移除。登记项目数据库无法核查时，保守阻止新执行准入并报告具体项目，人工操作仍可用，不能把不可读当作没有在途运行。该步骤必须先于harness／editor新准入，在内核启动ready路径落实；不能只在运行tab打开时做。未知占用不按PID缺失释放，跨重启仍保护可能冲突的项目运行与仓储释放。

没有原生重新接管机制时，不提供自动清除unknown按钮；`reconcile`只能依据已持久可信收据补齐观察。需要恢复执行容量时必须由后续有证据的归属处理解决，不让用户简单“忽略”绕过安全保证。其他人工读写仍可用，剩余容量服务无关执行。正常关闭宿主先停止所有本轮持有程序和准备，再关闭仓储；未知时不得提前释放项目替换／恢复使用中的仓储。

项目原备份包含数据库新表，日志随有限记录保存，实际结果仍沿现有备份清单的文本／图片／大小规则，不能声称任意大结果已备份。独立副本由本域restore重绑定projectId、保留origin历史并清除活动资格；它不控制原归属、不重建原容量、不能复用机器环境路径。缺失环境或产物按实际情况说明。原项目的unknown归属不因副本恢复而解除。

### 6. 输出与UI

只核查声明路径。先经项目path范围检查／material取得实际fileId／basis；运行中观察仅标未完成，停止确认后复查同一文件，不通过重新保存内容登记输出。对外路径只是提示；记录 `attribution: observed`，没有受控发布证据时不声称是本次生成。项目成果关联沿已有能力；人工无需伪造sessionId来写harness artifact。关联接口需要会话而当前没有时，只提供运行输出引用，不建立假关联。`reconcile`只补登记／合法关联，不重跑程序。

新增 `workbench/programs/ProgramRunsTab.tsx` 和controller；中间区项目tab含运行列表、配置、环境、所选运行详情、日志和结果打开。沿当前TabGroups挂载项目级 `programs` kind，项目切换使用现有projectGroups；右侧文件／材料／任务骨架不增加第四区或第四页签。运行配置用当前项目及稳定运行身份隔离草稿，UI展示状态、缺项与操作，内部机制不进入用户流程说明。

启动先选项目代码和环境、核对args／cwd／输出／期限；缺授权时显示当前准备计划及明确同意动作，成功后复用授权。保存代码不等于同意运行代码。列表每页25，详情只读当前run及最多64KiB日志；运行tab关闭取消自己的查询和订阅，不取消background。状态栏可用 `StatusBarContext` 贡献当前项目运行摘要，不能重用Agent执行状态覆盖它。

共享 `changeSchema` 只增加有界 `programRunIds`／`programsChanged`范围线索，不把所有run或日志放入snapshot。事件合并后只刷新当前项目当前页；迟到结果核对projectId、programRunId及请求代际，不能覆盖新配置草稿。日志用纯文本节点和现有等宽token，限高滚动，不做每片Markdown解析或跨DOM查找。结果通过原 `resource-controller`／ResourceView打开CSV文本等实际文件，不新建报告执行器。样式仅引用现有浅深主题token；如确需新语义，实施时先补UI设计再同时补两套token。

## 文件变化

以下是本次实现拥有的文件／符号；无计划删除业务文件。业务实施及必要隔离测试沿用户后续明确授权，提交／推送仍未授权。

| 范围 | 文件／符号所有权和变更 |
| --- | --- |
| 计算域独占 | 新建 `packages/programs/package.json`、`tsconfig.json`、`src/{index,node,runs,environments,records,schema}.ts`；ProgramRuns、ProgramEnvironments、ProgramRecords及自有表。原生SQLite／配置文件适配登记在本包node入口，不导出DB连接 |
| 计算同源契约 | 新建 `packages/protocol/src/programs.ts`；修改package导出、`src/operations.ts`的program操作展开／changeSchema。业务／内部映射沿现有生成脚本产生，不手写平行类型 |
| 平台公共增量 | `packages/platform/src/command.ts`、`command-worker.ts`：共同执行核心、program日志模式；`apps/kernel/src/commands.ts`：ManagedCommands新增start／cancel和宿主观察adapter。`packages/protocol/src/platform.ts`增加内部program操作，保留原command声明。必要导出限platform/node |
| 内核装配 | `apps/kernel/src/manual.ts`：ProgramRuns、程序workspace登记、公共handler、关闭与projectReplacing钩子；`application.ts`：execution归属工具端口和父执行收尾；不修改图driver／委派业务。`project-container.ts`：v5 delegations／v6 program_runs物理升级；内核bootstrap/lifecycle的ready阶段等待归属恢复；内部application schema／映射／package声明随实际生成入口更新 |
| Agent薄适配 | `packages/harness/src/program-tools.ts`新增同源工具adapter；`runtime.ts`仅注入ProgramToolsPort及加入工具，保留信号、来源和显式后台移交。该文件与Agent线共享，实施前交换constructor参数／tool集合具体符号，不能改其委派记录／模型／driver |
| 项目窄接入 | 优先复用 `manual.ts` 的projectOpened／projectReplacing及 `application.ts` 现有project.restore组合位置加入本域restore；不让projects直接import programs或访问program_runs，不预定修改store.ts。只有现有钩子不足才提具体公共增量给项目线，项目方拥有文件身份规则 |
| UI独占 | 新建 `apps/desktop/src/renderer/src/workbench/programs/{ProgramRunsTab,program-controller}.tsx`，实际扩展名按现有controller约定；本域组件只消费公共DTO |
| UI共享精确位置 | `tab-state.ts` TabKind／项目tab恢复、`shell/TabGroups.tsx` renderPrograms插槽、Workbench.tsx挂载、`business-session.tsx` program端口／资源打开、session类型；`styles.css`本域规则、UI设计新增“项目程序运行”分节；不改阅读器内部、报告结构、composer或任务详情 |
| 检查／交付 | `architecture.json`新增programs依赖和精确系统适配，kernel／harness消费声明；协议生成器入口若使用显式声明列表则增加programs。受影响workspace/package清单按最小现有版本接入；需要lock变化时仅在后续获授权执行 |
| 验证与说明 | 新增 `tests/kernel/{program-runs,program-environments}.spec.ts`、`tests/ui/program-runs.spec.ts`及固定CSV程序夹具；扩展现有命令／容量／恢复／人工组合测试。`docs/development.md`增加环境、命令、诊断及范围；初设execution E-05/E-06转为正式规格链接，其他文档只引用，不复制新契约 |

command观察增量已拆为独立patch，含同源platformProgramOperations、ManagedCommands、platform command／deadline、有界sink测试和共享测试夹具；在原基线临时副本独立构建与7项测试，不导入programs。生态只能据此消费进程归属／输出观察证据；started不是Electron ready，管道日志不是双向RPC，正常命令结束会收尾整个范围。长驻宿主身份／ready／消息及生命周期必须另定契约，不能沿此增量自动启用生产。

## 验证与风险

### 最小验收矩阵

| 路径 | 实际接线、替身和判据 |
| --- | --- |
| 共同机制增量 | 扩展managed-commands、platform-command-contracts、process-admission；真实Node及detached后代、原生stopped、受控observer落盘失败，旧editor限额与结果不变 |
| 本域独立 | ProgramRuns通过同一interface对真实命令／真实临时项目／真实仓储跑固定CSV；替身仅用于确定性控制排队／持久失败时序，不以替身成功替代实际文件／broker |
| 固定结果 | 输入值2、4、6，固定程序计算count=3、sum=12、mean=4并写CSV；预期来自独立算术样本。变体覆盖非零退出后半份输出、missing输出、持续超量stdout／stderr、无日志等待、取消detached后代；状态、实际字节及heartbeat一起核对 |
| 环境 | 已有解释器只读探测；受管uv在隔离目录用小型锁定项目和本地包／已有离线cache验实际准备、import及复用；原解释器目录、项目lock和项目.venv前后不变。联网准备另获授权后验证，未运行就保持未完成。缺工具／缺依赖／计划变化／取消准备可诊断 |
| 重启和数据 | 真实宿主正常退出及SIGKILL；持久intent／stopped故障注入、根已退出仍unknown、PID复用不发信号、先恢复占用后接新执行、v4升级副本、备份恢复新项目不控原进程；旧文件／会话事实保持 |
| 人工与Agent I4 | ManualApplication无harness的真实操作＋KernelApplication项目工具查询相同run；外部模型用既有HTTP受控工具计划，内部broker、程序、文件、仓储真实。初始固定CSV路径不等任务／报告实现 |
| 双宿主 | Chromium与真实Electron从运行tab启动、读日志／取消／打开实际CSV、切项目及重开不丢草稿；可视夹具接真实本域组件，仅替未完成依赖。端口计划5361、CDP9361，运行前核占用，仅收尾本轮进程 |
| 回归和基线 | editor.spec／editor-runtime、resource-opening、平台不可用分支；PDF双宿主基线按编译／产物／刷新诊断，Windows计数和执行阶段等待提供者输入。不是先加超时或把失败删掉 |

验证使用根声明入口的实际等价命令：生成映射检查、architecture、受影响包typecheck／build及定向内核／双宿主。依赖按锁定已有版本链接，未新增第三方版本；先构建再测试，不在正在测试时覆盖dist。只扩展由新变化、失败或未决风险必要的回归，不追加全仓测试。

日志/事件、授权、跨进程停止、迁移及复杂整合需要独立只读审查；本线主Agent最终验收。Linux本机成功、Windows真实结果、macOS明确不可用及目标分发包验证分别记录，不以本机Node／uv版本代替目标环境。只检查确定性操作反馈；无日志长计算不设“应在几秒内完成”的科学性能保证。

有限期限通过command-deadline以performance.now单调累计，每次timer至多2147483647ms，分段重核剩余；null不设期限。可控时钟覆盖边界前／边界／30天，真实程序覆盖取消及stopped，不改变原输入合法范围或editor短命令上限。

## 主线快照消费与接入边界（2026-10-26）

主线正式交接根 `/tmp/scholoom-phase2-handoff-VZS5mS`，根manifest.json确认七树共同基线e3d58fc；没有逐树manifest文件。仅消费该包，不检查其他工作树／会话。以下是已取得的实际输入，合入和实跑边界分别记录。

| 精确快照路径（相对交接根） | 核对结果与下一步 |
| --- | --- |
| `research-task-workspace/packages/protocol/src/task-contracts.ts` | TaskRef={projectId,taskId,fileId}；workItemId属于任务元数据链接，任务文件仍由projects负责，四操作为list/read/create/save。程序首批不加taskId，不将programRunId／harness run代作任务身份；未来关联须消费真实TaskPort／条件保存，不在本次补接口 |
| `research-interaction/openspec/changes/add-material-annotation-interactions/design.md`及`delivery.md` | ContextItem文字位置／region目标／draft状态归阅读线；其ResourceView／图片分派与本域现有ResourceRef打开兼容。计算生成的图件可作为实际文件打开，不以源码basis附产物位置；M2／M3没有新提供者，不顺带加修改归因 |
| `research-interaction/openspec/changes/add-interactive-research-reports/design.md` | 报告为项目HTML入口＋清单／basis、显式报告打开及沙箱，仍仅规划。其未来tab-state/resource-controller分派和批量ContextContribution不属于programs tab；本次不执行程序输出HTML脚本，也不声明ReportResources已接入 |
| `research-task-workspace/apps/desktop/src/renderer/src/workbench/{Workbench.tsx,business-session.tsx,session.ts,shell/TabGroups.tsx,tab-state.ts}` | task TabKind、tab.task及renderTask(TaskRef,viewId)必须与programs TabKind／renderPrograms并存。保留任务导航代际、项目身份、同名项目定位和多窗口夹具；共享接入按符号合并，不能覆盖整文件。阅读快照未包含这几个共享文件，其设计中尚未实施的分派不冒充源码 |
| `agent-delegation/packages/harness/src/runtime.ts`、`apps/kernel/src/application.ts` | 两树都在executionResources后新增最后一个构造参数：Agent的delegationOptions与本线programs对象不兼容。最小选项A为接入时保留delegationOptions位置、programs追加其后并更新全部调用者；选项B为共同options对象，能减后续位置冲突但扩大接口变更。推荐A供主线确认，本树不自行重写他域契约。工具集合逐项保留；Agent子执行只获既定资源／scratch工具，不能因为拼接root programTools扩权 |
| `agent-delegation/apps/kernel/src/storage/project-container.ts`、`packages/harness/src/{records.ts,schema.ts}` | 原v5委派表、两个索引、restore重绑及running→interrupted/unknown已消费。迁移在本树组合至v6。仅将records/schema去类型生成临时验证适配，和本树ProgramRecords共同恢复真实SQLite副本；没有把整个委派私有实现导入生产。Kernel project.restore现有HarnessRecords.restore→ResearchRecords.restore→ProgramRecords.restore顺序需在dev保留；04补丁仅供两域合入后的符号组合 |
| `acceptance.md`、`coordination-plan.md`、`agent-delegation/.../delivery.md`、材料delivery | C1—C3与迁移碰撞为本次整改输入。PDF提供者已有当前Linux阶段诊断及回归，原CI根因仍未闭合；Windows进程身份／queued阶段仍明确未交付。不能因看过交付文字或本机成功勾闭原CI项 |

长驻承载的候选：A沿ManagedNode单独定义宿主ready／身份／双向IPC与停机确认；B给command增加通用应用控制协议。推荐A，避免改变command结束即收尾的稳定语义；这只是供生态／主线复核的选择，不是已批准的新生产接口。本轮只交C1—C3修复、迁移组合及公共patch，在该边界停止。

runtime合并还须保留Agent的instanceLifecycle.onStopping中childrenController.abort，以及本线onStop在update('exited')前await programs.settle；Agent的finally settleTools与childrenUnsettled核查也不能被覆盖。两域停止责任尚未在共同宿主组合实跑，不以各自局部停止成功替代。

## 待办边界

### 公共同步后本轮消费（2026-10-26）

主线同步提交91615d5已包含0519904及b838402，恢复时本树干净。当前源码实际消费公共ManagedCommands.start及长时限、Graph来源／执行历史、统一v6迁移；不再重发迁移或搭建/tmp源码组合。ManualApplication继续独占程序登记、workspace、观察落盘和归属恢复，KernelApplication组合ProgramRecords.restore，Harness经工具所需的最窄Programs工具端口调用，人工登记／批准／移交仍留产品入口。started只表示进程已启动，exit记录退出，stopped确认完整归属收尾；环境ready须通过环境模块检查，不将任一命令started当应用ready，生态E4另行负责。

本轮以真实内核测试补强人工／Agent同一运行、日志和输出，失效／只读／全局拒绝，以及宿主丢失后原unknown统一占用和恢复副本无控制资格。UI沿已有组件和token，不新增布局。正式任务快照来自 `/tmp/scholoom-round3-handoff-qefwKi/research-task-workspace/`，只准备programs共享符号兼容补丁；本树尚无TaskRef／任务组件实际提供者，真实联合tab验收保持开放，不复制任务私有实现。本轮本地验证仅当前树，补丁上下文核对不算跨域运行结果。

`ProgramToolsPort`由ProgramsPort排除registerEnvironment／authorizeEnvironment／handoff三个人工操作，harness构造器、工具adapter及KernelApplication装配共用此投影；broker消费清单和领域身份检查仍各自执行。人类产品端口不变。真实Agent回归核对最后一次read_program_run／read_program_logs的HTTP工具结果与人工查询一致，不以“模型调用过工具名”代替结果验证。真实宿主恢复用例核对统一名额保持1，副本historical及控制身份清除、源记录不变；UI第二窗口核对同一运行身份并取消，原窗口实际刷新取消事实。

交回目录 `/tmp/scholoom-project-execution-round3-NCqJgg/` 的06补丁只给任务正式快照的五个共享文件叠加programs；保留task TabKind／tab.task／renderTask(TaskRef,group.id)，沿任务已有openTab使打开程序也撤销迟到任务导航。normalizeLegacyTab白名单同时保留task／programs。05补丁只给Agent正式快照的runtime／application叠加programs：保留delegationOptions原位置，programs追加其后，保留根／子工具分离、childrenController.abort、settleTools和childrenUnsettled，业务restore仍顺序组合。两份均仅上下文检查，未在本树启用他域业务或作生产联合验收；公共Graph来源／历史、统一v6均沿现有基线保留。

- 主线已正式提供两份阅读design、TaskRef和Agent源码快照；消费精确路径及共享符号核对见下节。它们没有进入本树真实提供者，报告／批注／任务关联保持范围外；共享宿主、工具、tab与恢复最终合并仍待dev接入，不能以阅读设计冒充实际整合。
- 项目任务引用、科研Graph、任意依赖发现、自动安装工具本体、Conda完整发现／激活、editor迁移、终端／Notebook、SSH与完整macOS后端均不在首批。新增需求回到各自有界change，不把未接入代码放进本轮必需路径。
- 首批保守unknown可能长期占用容量，这是停止保证的真实限制；不得以计划闭合为由伪造可重新取得原生归属。需要更强自动恢复时另审原生证明机制。
