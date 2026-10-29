# 实现设计

## 变更总览

用户已采纳 [investigation](investigation.md#已获得本轮产品选择) 的项目内有界产品范围；资源及来源授权、冻结字节、历史与严格单目标读取现已接入，实际结果见delivery当前节。活动承载仍待完整隔离浏览器及呈现方案，不以原生样本或读取能力代替2.1b。下方候选A的高FD／SCM_RIGHTS／stdio及普通文件门为已执行调查，结果由investigation维护；既有资源限额保持，实验保护值不是产品执行／呈现预算。

```mermaid
flowchart LR
  subgraph RI[阅读交互所有权]
    F[报告文件与显式清单] --> R[editor ReportResources]
    R --> V[共同资源tab中的ReportView]
    V --> I[待验证的隔离承载]
    I --> B[版本绑定的有界桥 传输待定]
    B --> C[既有ContextContribution]
    V --> U[更新保护和窗口草稿]
  end
  R --> P[projects 身份及条件保存]
  R --> L[library 来源只读授权]
  C --> CO[共同composer]
  CO --> H[harness session.send]
  H --> P
  P --> R
```

ReportResources 是 `packages/editor` 内的 module，不新建包／数据库或进程。它通过小接口集中资源清单、版本核对和有界交付；真实 projects／library adapter 与隔离测试 adapter 构成实际 seam。ReportView 只消费已核对的快照，页面只见允许的本地字节和对象，不见 KernelClient。

## 方案与接口

### 第25轮：原版草稿工作台接线

客户端原提交82361ae→主线b571323及零内容差异祖先桥2e5a9d6已接收；主线实际4/4、types／格式／架构通过，独审无确证P1/P2，具体真实／替身及未验见delivery第25轮。`restoreReportDraft({client,identity,signal?})`返回`{version,restored}`；Node测试用原内存草稿降级，下一片验证实际Browser／Electron及localStorage。

文献树独占原`tests/fixtures/report-connected/`与`tests/ui/report-connected.spec.ts`，消费现有适配，不改生产module、共同fixture或其他UI测试。最多两类代表、两宿主：关闭R1后真实保存不含A的R2，再按原精确identity经适配重开R1，原snapshot／browse／draft只随完整available恢复；撤回A后R2仍可读但R1不能恢复或复制。另一类使原依赖保持身份且内容前进，准确原版的成功unavailable只能给原draft/dirty作copyOnly，不恢复browse、假页面／snapshot或创建共同附加consumer；未知原版／失败不得copyOnly。两类可在各自流程中覆盖迟到回包：关闭／配置或view失效时中止本地候选采用，仍等实际RPC结清，旧页不得复活。

真实KernelClient／认证server／项目库／FileEdit、原report-drafts/localStorage、Workbench/common composer／inspector继续接通，Node控制只做实际save／grant或有界暂扣已完成的真实reportVersion回执；不注入成功权限／snapshot。原正文及显式项保持原key/basis，恢复完整封套仍经原isReportBridgeMessage。不得预先把available写给store或catch失败猜unavailable。旧版选择由可信测试宿主保存的准确ref/basis触发，不枚举存储或按新清单／时间猜版本。局部React视图／generation及取消由该可信夹具落实；普通report-client仍管最新候选，不能让它把原版恢复改成最新basis。

先同步并构建有变化的夹具，固定后跑该两类双宿主及其必要类型／格式；原当前版已绿矩阵按修改影响选择最小代表，不机械再全跑。仅固定可信React页面，不执行报告HTML脚本、不新增renderer布局或公共DTO；实际跨宿主页面ready、OS承载及完整3.2／I5仍开放。

### 第25轮：C记录初始化Module

第22轮C-writer设计中，现有`IsolationRecords.load()`会在空根自动生成configId；该行为服务原本地提供者，不能直接作为系统C的“打开已知配置”。本片仅关闭这一个初始化接缝，不扩为C服务或通用远程IO。由生态树独占原`packages/platform/src/isolated-report-records.ts`与新`tests/kernel/isolated-report-bootstrap.spec.ts`，其他两条活动树仍保持第24轮基线和所有权。

在同一原records事实源增加内部Interface：`initializeExisting()`只打开并pin已有根，不创建根或父目录；`loadExisting(expectedConfigId)`只读取准确原configId且核原dev/ino、owner、完整有界index／库存，返回`{configId,receipts}`；`provisionEmpty()`仅在原根除实际writer.lock外完全为空时生成原UUID/config/index，返回相同形状。两种load仍要求原native writer锁已取得，锁生命期和close沿原机制；不能用自报locked布尔量代替实际锁。缺配置、错误expected、非空或复制根均不得自动新建／覆盖／恢复。provision不能把已有有效配置当作新建成功，原create/save及全部v1验证器共用不分叉，原initialize()/load()及旧提供者调用保持原语义。

同一对象内的bootstrap读取／创建也共用原serialize队列，与create/save顺序一致；native flock只排斥其他持锁者，不能代替同对象异步调用串行。并发provision只能有一次成功，其余看到已建立配置后拒绝；返回的配置身份须与实际磁盘一致，不另加锁或队列。

返回配置身份来自原config.json，库存与现有load同一权威；不暴露根FD、增加公共RPC／schema／v2 system receipt、第二records/index或准入。精确expected引用与安装slot未来由可信宿主绑定；本Module没有运行C，也不能证明跨UID、认证、库存已由K采用或许可／停止持久ACK已接通。缺真实消费者的部分明确保持未装配，不另建示例常驻服务。

先构建platform再固定测试：真实文件／原native flock验证新空根显式provision、已有根准确open、错误expected和provision已有根不改变原文件、已有根初始化缺失不创建、复制根及库存异常拒绝；复用已验原records代表，不复制完整native矩阵。权限／锁／根身份均用真实对象，期望按原磁盘样本独立核对；tools类型、格式、架构及独立审查后由主线接收。全部自有持久cache、当前普通UID，不安装或调用系统服务／策略；完整2.1b／T1/T2保持开放。

### 第24轮：准确版本的真实内核读取

在原3.2中新增只读`resources.reportVersion({ref,basis})`，与resources.report同一35秒有界读语义，首批入口仍为项目HTML。返回`{state:'available',snapshot}`或`{state:'unavailable',reason}`，reason仅contentChanged／notFound／unavailable；后者不含快照、正文或内部Evidence。其他权限、身份／原版未知、坏清单及无关错误仍走原失败，不由读取错误直接批准草稿。现有resources.report／files.edit／files.history保持其严格及整条历史联合授权语义。

请求basis就是当前完整入口时，经原资源端口取不超过entryBytes的精确UTF-8正文并复核入口身份／basis／path；否则只经`ProjectStore.versionForEvidence`读取准确所选原侧，不按新版、路径、时间或草稿内容猜原版。原path／正文／Evidence交reviewHistorical，最后按它返回的完整原Evidence执行宿主同步授权核查；Agent交回实际snapshot才沿原reportUsed记录使用，单纯不可用状态不伪称全文读取。所有入口保持resourceOperation、checkReportContext、项目read/send及原targetRead范围；目标端口仍只核同一目标项目，不增加库／第三项目权限。

真实库的ResourceDescriptor.capabilities.read包含物理字节可读性，故不能用它独立判断ACL。ReportResourcePorts新增可选可信`checkReadIdentity(evidence)`：仅由宿主绑定，肯定该准确稳定ref与当前读取资格而不要求原字节存在；review的完整authorize仍在其前后核相应read/send，最多4项并行。未提供此能力的现有端口沿原严格descriptor核查，提供者失败时不改走其他依据。常规内核提供者对库复用实际attachment登记的版本身份与library.read，项目／render沿原资源身份核查；不制造read=true的描述或权限缓存。报告端口调用ResourceAccess.describe的内部requireReadable模式，保留附件探测的原结构化错误；普通资源描述继续可提供不可读原因。不得由read=false或unavailableReason字符串猜测错误类别，容量／请求及普通异常不批准副本资格。

主线拥有protocol的report-contracts/resources及生成business-types、architecture.json、kernel/manual.ts、ReportResources的这一可选端口与相邻测试、新tests/kernel/report-version.spec.ts；不并写项目线的store.ts。验证用真实Manual／文件／库／FileEdit，覆盖R2移除A后R1仍需A、after及仅before版本、依赖前进、库登记及ACL有效但字节缺失、查询期间撤权与元数据不明不误批准；现有严格报告读取和历史最少代表回归。客户端／草稿适配在此真实后端稳定后再派，正式HTML运行及完整3.2／I5保持开放。

本轮接线也将`resources.reportVersion`排除于通用ExecutionResourceInputs；该执行端口只提供原describe/read/document/save/create/creation，不因新增报告RPC扩大接口。

下一批在主线验收后、各目标树同步并构建验证后开工：

| 树 | 独占写集及结果 | 边界 |
| --- | --- | --- |
| research-graph-runtime | 新`reports/report-draft-client.ts`及新`tests/kernel/report-draft-client.spec.ts`，通过实际KernelClient核准确版本后复用原createReportDrafts恢复 | 单次有界读取，不订阅、不另存正文／manifest／权限。绑定并复制完整ReportDraftIdentity，实际RPC前后核同client／dataDirectory及取消；仅成功的available／unavailable转对应restore资格，错误传播，拒绝不暴露草稿。调用发出后await实际结清，不假取消。真实client/server及领域代表，UI由下一片消费 |
| project-execution | 新`tests/kernel/report-version-access.spec.ts`，新RPC的实际Agent执行及单目标范围验收，复用既有真实worker／目标／报告fixture | 至多两类代表；核真实允许与read/send拒绝、目标不得扩大为library／第三项目及伪造Agent拒绝，原basis不能由新版替代。优先仅测试，不并写kernel／protocol／项目模块；确证根因交主线，不造内部成功身份，不发真实模型 |
| literature-workbench | 上述客户端交付后，原report-connected夹具消费该适配，补关闭后R1准确恢复／不可得copyOnly及撤权封住的双宿主代表 | 待Adapter验收再实施，不预写第二套资格映射；原module及shared fixture只读，不运行活动HTML。正式页面ready仍待承载 |

生态系统校准包、阅读WorkerDOM探针计划以及科研／Agent原任务保持已接收；没有新前置时不重跑原绿色矩阵。WorkerDOM源码引入仍待原授权答复，系统部署／策略／账户、真实模型及CI无新增授权。

### 第23轮：原版本恢复资格Module

计算线只读核查确认：活动旧current仍持原清单时，client已复核旧独有来源；关闭后current销毁，旧草稿只有精确basis下的browse／draft／dirty，不再有原来源清单。真实connected只覆盖当前同basis恢复，不能据新版成功或原版读取错误批准旧草稿copyOnly。原FileEdit历史是版本权威，`ReportResources.historical`已有完整旧版核查，尚缺“全部原来源当前可读，但旧字节不可得”的独立结果。

下一片3.2d只在原`packages/editor/src/report-resources.ts`增加`reviewHistorical(resource, content, access)`，参数须由可信文件权威提供原描述／正文／Evidence，与现有historical同一信任前提；不接页面自报清单。沿原codec和同一原版本Evidence规则取入口／依赖／来源，先按稳定ref逐项describe及read能力、所属authorize核完整原集合，不能用新版清单或把项目basis前进当撤权。读取并发沿原上限4，不扫历史／全库，不持久保存清单或权限。

返回私有判别结果：`{state:'available',snapshot,evidence}`仅在现有严格historical完整成功；或`{state:'unavailable',reason,evidence}`，reason仅原OperationError的contentChanged／notFound／unavailable代码。后者必须在读取尝试前及失败后都独立完成全部原ref身份／read与相应access授权复核，最后再核authorize；任一权限拒绝、身份无法证明、元数据缺失、坏清单／矛盾依据或其他错误均传播，不形成草稿资格。返回的evidence来自该原版本且仅用于宿主末次复核，不是新的授权凭据；unavailable不返回假ReportSnapshot。原资源读取错误不能单独变成copyOnly。

原snapshot／freeze／historical语义保持；提取现有重复规则复用，不维护另一套清单／授权算法。计算树只拥有该文件及原`tests/kernel/report-resources.spec.ts`：完整原版成功、同ref内容前进而旧依赖不可得、R2删除A但R1仍需A、尝试期间撤权、来源身份／元数据不明及无关错误不误批准，复用原端口与手写独立清单。先构建editor再跑受影响模块和必要类型／架构／格式；不新增RPC、FileEdit查询、renderer接线或UI测试，不关闭完整3.2／I5。

后续主线再统一真实文件版本定位及kernel／client接线：必须从原文件权威按准确身份／basis／FileEdit所选侧取得内容；当前普通`resources.report`不自动找历史，现有editForEvidence仅after一侧。不得从localStorage枚举猜版本或把原HTTP错误当权限结论。该后续接口尚未发布；本Module交付不表示真实旧版恢复或正式页面可用。

服务停止路线新增[InvocationID寻址依据](../../../.scratch/scholoom-foundations/research/report-invocation-stop.md)：保留M只读cgroup视图，优先校准返回的invocation对象路径；普通按名StopUnit不具同等保护。当前仅官方源码核对及本机XML接口公布证明，异步job到完整停止、原cgroup对象／权限／故障收尾仍待真实T1，不改变安装授权。

下一辅助片仅补项目文件权威的准确版本读取，仍归原3.2：`ProjectStore.versionForEvidence(fileId,basis)`返回原FileEdit的私有投影`{editId,side,path,content,evidence}`或undefined。只按同一fileId和精确原basis取已保留版本；优先复用既有after定位，未保留after记录时可取具有同一准确原依据的before侧，不改变`editForEvidence`原有after语义。返回前核project/fileId/basis与所选Evidence一致；记录损坏或内容／依据无法证明时不给版本，不按最新path／正文／邻近时间猜测。保留原项目read检查，SQL结果有界，不改schema、文件或历史，不存第二份版本索引。

项目树独占`packages/projects/src/store.ts`及新`tests/kernel/project-file-versions.spec.ts`：实际文件／仓储验证after、仅before保留、重命名后原path和错fileId/basis不串版，必要权限／坏依据代表；不造报告特例／新RPC／UI。旧方法调用及既有历史行为保持。主线随后决定kernel的有界读取操作及真实接线，此片不把项目私有DB暴露给editor或renderer，也不放宽files.edit整条两侧报告的联合授权。

### 第22轮接收与下一片

主线接收固定gate离线5/5、真实KernelClient／领域／Workbench汇合双宿主4/4，以及R2d和私有IO静态调查。没有生产承载变化，任务仍20/26；汇合页为可信固定React组件，不执行报告HTML／脚本，不关闭完整3.1／3.2／I5。

**服务路线选择C作为唯一原records、冻结字节及日志的创建／管理者，M只负责固定系统模板、OS采证和许可。** C为受保护非root控制账户，复用现有IsolationRecords；K保留领域授权、freeze及唯一ProcessAdmission。P仅写既定日志FD。M不承载Node records、不维护第二份记录或容量；C的`/proc/self/fd/N`不能跨进程传递。原安装研究的M-writer布局及cache模板是历史候选，不是此路线的当前安装说明。系统安装与T1仍未授权、未验。

后续私有接缝须明确：C拥有原私有根并生成／读取原configId，K经受信binding固定它；configId不等于K profile ID。C持原writer锁并一次核完整库存，K恢复全部原unknown后才能开放该binding；无可核查身份时阻断初始化，不伪造匿名槽。scopeIntent提交ACK先于M启动；M采得原范围后由C落盘ACK，再允许后续门；K末次授权及launchIntent持久确认先于许可。M停止必须核预期的原boot／InvocationID／cgroup对象，C确认stopped落盘后K才释放。丢ACK只查原实例，不自动重放put／start／许可。新system service须显式新route／格式，不放宽或重解释旧version1 user-scope记录。PID1实际打开对象与C封存对象的连续性、M停止时接替者竞争仍须验证，尚未发布生产Interface。

下一批所有权：

| 线 | 有界任务／写集 | 完成判据与停止点 |
| --- | --- | --- |
| project-execution | 原`isolated-report-records.ts`及相邻records测试，补有界根目录库存与index交叉核查 | 识别未索引目录／未知对象／残留临时文件即失败且保留现场，正常恢复仍通过；不删、认领、重建index或发新身份，不扩为系统服务／全宿主启动屏障 |
| zotero-ecosystem | 新`tests/fixtures/report-system-calibration/`离线构建／配置包 | 准备固定合成输入、gate／probe、临时system unit及精确权限／观察／收尾计划；普通UID构建与可运行的离线自检。不得安装、执行root／PID1／账户／策略命令，不把旧gate的当前UID／FD3观察机制直接当部署实现；缺前置据实交回 |
| literature-workbench | 仅cache：C-writer私有操作及持久ACK设计 | 基于现有调用表给config bootstrap、字节封存、scope／launch／stopped顺序、丢ACK查询及新route的最小接口／字段所有权和代表验证；PID1路径及停止竞争不能凭假设填上。主线先审再派生产重构 |
| research-graph-runtime | 仅cache：旧版本／旧独有来源授权接缝核查 | 追当前client／updates／drafts和真实领域，明确当前报告已移除来源时如何核原草稿；不按新版权限推原版可读、不改生产、不重复绿色矩阵。若有确证缺口交精确复现和最小写集 |

库存修复由[提供者恢复规格](../add-linux-isolated-report-provider/specs/linux-isolated-report-provider/spec.md#scenario-私有根存在未索引或未知对象)及其tasks 4.1跟踪，当前9/10。在持锁、已验证index后，对pin住的根有界枚举，只容许config.json、index.json、writer.lock及本index的storageId目录；超限、未知、缺失或错误对象拒绝且不修改已有材料。create的已知预算失败仍在物理写入前拒绝；真实崩溃遗留不得静默丢弃。实例目录的资源与封存沿原验证，不扩成任意全树扫描。这只是原records的完整性修复，不宣称单一provider失败已阻断宿主所有其他准入。

呈现方向保留共同tab、原生文本／MathML、输入及辅助语义。R2d否定WebContentsView外部UID导入和直接rrweb，新增[WorkerDOM／Remote DOM静态核查](../../../.scratch/scholoom-foundations/research/report-worker-dom-feasibility.md)也否定直接接入；WorkerDOM仅保留为需要维护适配的有界研发候选。允许先审查一个与业务布局无关的决定性探针计划，不要求现成组件已满足全部产品契约；但不因探针而批准通用镜像生产实现。引入候选前须依用户AGENTS另获依赖安装授权，未获授权时只做现有源码和接口设计。Remote DOM不进入探针，T1/T2、系统IME／读屏与完整I5均保持开放。

### R2d正式呈现路线比较（第21轮本片，待主线选择）

本片不新增实现，只比较两条能脱离固定科研页面组织的路线；一手事实与精确版本见investigation的R2d节。**建议停止把固定模板补丁泛化为生产呈现，优先保留A的“一个原生活文档拥有执行及输入”方向；当前A也没有满足Browser共同tab与跨身份嵌入的提供者，不能因此批准A接线。** B的现有成熟组件仍是记录／回放器，不建议以“引入rrweb”代替新的通用交互系统。原产品范围不变时，两条均保持unavailable。

| 职责／接口 | A：同一原生活文档直接呈现 | B：rrweb记录／禁脚本DOM回放 |
| --- | --- | --- |
| 执行DOM／脚本权威 | 独立受限执行身份中的浏览器独占DOM、脚本及事件时序；必须真正呈现这个文档。宿主重载同一HTML会创建另一个DOM，不能当作跨身份挂载 | 同一隔离浏览器仍是源权威，工作台只有有界无脚本回放；节点映射不建立领域事实。脚本不得迁到父线程，也不能让回放端独立计算业务结果 |
| 批准字节／权限 | 可信内核沿ReportResources.freeze＋原prepare交有界字节；执行宿主的私有session资源handler只读这批字节。不是任意文件路径、远程依赖或工作台凭据代理 | freeze／read/send不变；源DOM及资源引用的序列化、重写／预算必须由实际可信提供者约束，不能因为来自record就信任CSS URL／节点属性或绕过清单。当前没有该生产提供者 |
| 控件输入／组合事务 | 用户输入直接交实际浏览器，避免源／回放两份DOM的确认竞争。copy／findInPage等有成熟API，但跨身份显示、系统IME与焦点由谁拥有仍须证明；sendInputEvent／insertText不是完整IME桥 | enableInteract仅开放本地回放交互，不向源提交。仍缺通用节点生命周期、焦点／selection／composition提交取消、源实际确认及旧代拒绝；源删旧节点后不得按相同id字符串重绑新节点。R2c固定table特例不能补齐这些能力 |
| 文本／MathML／选择查找／AX | 由实际浏览器维护，任意业务排布不需标签／业务模板映射；当前只有既存固定可信样本证据，任意CSS／canvas、实际读屏与IME不能填已支持 | 双宿主可拥有实际回放DOM，静态阅读模块可研究复用；但本次锁定重建分支不保持MathML namespace，且没有输入确认，尚不足以保留基本体验。不能以图片、手写文本／AX预期或开启unsafe canvas弥补 |
| Electron／Browser宿主 | WebContentsView只能把本Main的WebContents放到本原生窗口；当前没有独立UID／外部进程导入API，普通Browser更无此View。外部原生窗口是呈现位置变更，不等同共同资源tab | 两宿主禁脚本frame形态已有可信试验证据，但一般回放的资源／渲染预算和输入语义未证。不能把Electron HTTP拦截或DOM API覆盖当跨宿主隔离 |
| 预算／停止／成本 | 完整浏览器、运行库／字体、私有profile、显示／输入／辅助技术的受控通道、OS图及丢失恢复均是实质部署成本；唯一ProcessAdmission／原records继续为权威。不能给报告直接共享可信DISPLAY／DBus／剪贴板代理来填空 | 新依赖与持续安全维护、序列化／mutation流／重建／输入协议及双DOM同步成本不可消除；source浏览器已隔离不代表trusted回放布局CPU／内存也受同一预算。不能另造容量或恢复台账，也不在本片设计整套协议 |

**第21轮交回的待决项：** 当前两条查到的API都不具备“独立受限身份执行＋Browser／Electron共同资源tab＋原生文本／输入／辅助语义”的完整能力。主线第22轮保留原产品范围，允许先审有界的维护适配探针；尚无通过的提供者。若改为独立原生窗口或调整宿主产品范围，须另作明确产品决定，不能由worker把窗口当tab、把Browser降为位图或取消输入／辅助要求。活动报告仍不可用。

最小下一验证按前置分开，不在本片执行：

| 门 | 无需系统许可的决定性核查 | 必须T1通过且另获许可后 |
| --- | --- | --- |
| A的宿主接缝 | 先提交普通Browser及Electron分别呈现**本视图绑定的独立执行实例活文档**的实际成熟API／实现，明确文本、焦点、IME、选择与AX属于谁；缺接口即可停止，不再跑一个本账户View示例来证明跨UID。仅可信同账户原生引擎的特性试验不抵此门 | 真实独立身份完整浏览器，经原freeze／admission／records和受控显示／输入／辅助通道，在两宿主按最终产品位置验证；任一可信能力被报告取得即失败。核完整进程图、无网络、预算、撤权、控制器丢失／重启unknown及持久停止，不以视图销毁释放容量 |
| B的通用输入与结构 | 先由成熟候选给出namespace及双向事务接口；当前rrweb静态缺口已足以拒绝直接采用，不需安装试出同一个失败。若以后有已审版本提供接口，另授权一个与业务无关的HTML／MathML／editable微样本，变换DOM布局；用源真实composition／focus事件和节点被替换的竞争核确认，不能硬编码table／count或只改回放值 | 即使语义样本通过，仍须在已通过T1的实际源浏览器验证批准资源、mutation／渲染／队列预算、旧节点／版本／接收者与停止权限；真实系统IME候选窗／读屏及目标平台须各自实跑。未支持能力可明确失败，但不得静默退化 |

既有可复用seam是`ReportResources.freeze`、`IsolatedReportProvider.prepare`、Workbench的`renderResource`及原report-context共同动作；它们分别掌握来源／字节、准入／归属、React挂载和显式选择，均不掌握尚不存在的跨身份surface。正式公共接口不在本片发布，现有Bridge不扩成DOM DSL；具体API归属及不可交叉的能力仅记cache的api-seams.md。tasks／delivery及其他片不由本线修改，正式R2／2.1b／T1／T2／I5和目标平台未完成。

### 第21轮接收与下一片

3.1c／3.1d／3.2c及2.1e规划已按delivery接收，当前20/26；R2c仅关闭固定可信输入事务调查。3.1d旧页独有来源继续经领域describe核读权与稳定ref，内容basis前进不等于撤权；旧页仍保留原Evidence，新完整报告可pending。永久拒绝的旧来源会阻止该绑定load，转向合法新版需关闭旧绑定重新打开，不能以缓存继续展示。订阅者异常在Adapter内隔离并诊断，不得穿入共享client的重连循环。每个current／pending清单仍分别最多32依赖、100来源，核两者的有界并集，不扫全库。

主线保留非root C＋固定模板root M作为**离线验证路线**，M使用宿主cgroup树只读视图、原records UUID；K仍持唯一admission、领域授权与freeze。当前接受的是规划和后续固定gate离线实现，不授予系统安装、策略加载、账户、服务启动或真实T1/T2许可。M物理IO与原records的具体私有接口先核现有调用点，由主线定案后才改生产，不把“换OS Adapter”当已经解耦。

| 工作树／片 | 独占写集与可观察结果 | 停止边界 |
| --- | --- | --- |
| literature-workbench／3.2真实客户端汇合 | 新tests/fixtures/report-connected/及tests/ui/report-connected.spec.ts，复用已交付原module／共同session／草稿／Workbench和真实KernelClient及领域；正常报告更新形成pending、显式切换保留共同草稿，关闭旧consumer；真实来源撤权封展示。原合成生命周期夹具只读保留，不复制其64KiB矩阵 | 最多两类代表／双宿主；只在外部模型边界用受控HTTP，优先无模型。Node端可复用report-client/domain，renderer实际使用createReportClient；不再手写资源／权限成功结果，不启脚本或改生产/shared fixture |
| zotero-ecosystem／T1固定gate离线片 | 新tests/fixtures/report-system-gate/，复用现有静态native probe／编译工具和原gate相关实现；固定输入FIFO许可→唯一固定probe，EOF／非法许可不执行，放行前关闭无关FD，至少一个真实正负例，输入／日志路径及程序在构建时固定 | 全部自有cache、当前普通UID；无PID1、跨UID、policy或OS停止证明。不得新增生产服务、公共wire／随请求任意exec、安装、SUID、filecap、策略或账户；若原gate强依赖OS范围，带事实交回不复制整个controller |
| project-execution／T1私有IO接缝核对 | 只读当前provider／records／controller／native调用，cache给精确调用表、最小接口草案、单writer／原configId与完整inventory／停止落盘顺序及有限迁移差异；覆盖records之外直接fs／程序／gate／锁访问 | 不改工作区或发明第二台账／准入，不实现或发布接口；主线审后统一契约再派生产实现。不为清理重写现有user-scope路径或原恢复格式 |
| research-interaction／R2正式呈现收敛 | 仅原报告investigation／design的R2d段及cache一手依据；基于R2／R2b／R2c，比较最多两条能适配任意业务组织、双宿主原生文本／输入／辅助语义的具体路线，列清执行、资源字节和呈现权威、真实限制及最小决定性验证 | 不把固定table补丁当通用方案、不预设固定科研业务页、不降低已有输入／无障碍或OS隔离要求；不再扩固定模板功能、造通用DOM镜像／DSL或改生产。共享架构最终由主线选择 |

research-graph-runtime等待上述汇合中的真实提供者缺口，已交付Adapter不重复扩矩阵；research-task-workspace等待正式页面ready，agent-delegation等待目标环境／新模型授权。四任务三等待先全树同步验证再发送，未完树不换基线。接收时分别说明真实模块、合成边界和未证，不从离线gate／资料核对推T1或完整报告通过。

### 第20轮接收及下一片

四个独立子片按各自契约接收，实际范围见delivery。3.1a采用第19轮已允许的发布前冲突分支；普通worker关联unknown未实跑，单列3.1c保留。R2b保住MathML结构，但整份srcdoc替换丢失在途组合输入，仍不采纳为正式方案。下一轮五线如下，主线单点更新3.x工件，原module及正式协议不由多个树同时改。

| 子片／工作树 | 目标与独占写集 | 停止边界 |
| --- | --- | --- |
| 3.1c／project-execution | 扩原report-publication.spec.ts，在真实worker保存后的原saved／关联seam注入一次失败，分别核文件、edit／Evidence、artifact和原指令／实例，沿原身份查询、不重复写入 | 优先只测试，内部仓储／broker／worker真实，外部HTTP受控；原查询不足就交缺口，不造结果／公共查询或修改生产harness／kernel |
| 3.1d／research-graph-runtime | 新reports/report-client.ts及tests/kernel/report-client.spec.ts，确需小fixture独立目录；真实KernelClient的describe／resources.report／subscribeChanges驱动原createReportUpdates，实际server／领域文件／库 | 不改原updates、公共client／protocol、ResourceView／HtmlRenderView。最少正常更新及撤权／重连代表，不持有OS范围；已发RPC实际settle前不假取消 |
| 3.2c／literature-workbench | 新tests/fixtures/report-lifecycle/及tests/ui/report-lifecycle.spec.ts，原updates／report-drafts／report-context、business-session／共同草稿及检查器在同一可信样本汇合 | client／load／授权事实明确为替身，不依赖尚未交付report-client；不另造状态或草稿权威，不改生产module／共享UI fixture，不执行任意报告脚本 |
| R2c／research-interaction | 新tests/fixtures/report-input/，只读复用固定源页及结构控制器，保留R2／R2b反例；保护未提交输入事务，至多一个最新回包及一个最新有界输入意图 | 禁脚本frame和固定可信控件，非通用DOM镜像；不以禁输入、延时或覆盖未提交值换刷新，实际源页须收到提交并与最终状态对应；正式架构／系统IME／读屏仍待验 |
| 2.1e／zotero-ecosystem | 新.scratch/scholoom-foundations/research/report-t1-installation.md；将固定native T1候选收敛为具体安装文件／路径、身份权限、认证／字节交付、启动停止、unknown恢复、验证及移除方案，配置草案及一手资料保存在cache | 只形成可审查候选，不最终批准共享接口，不写生产服务／wire，不安装或修改/etc／usr／run、账户／策略，不启动服务／浏览器。主线审后才确定部署授权，方案不算T1通过 |

真实client适配只读当前入口及清单最多32依赖／100来源。changeSchema只有projectId／filePaths／libraryChanged等粗事实：明确不相关项目／会话忽略，当前项目粗通知、含库来源时libraryChanged或resync合并为一次当前报告核查，不假造逐材料通知或扫描全库。同basis仍复查权限，已知撤权／身份失效立即封展示资格，失败沿updates显式重查；断连／换配置／dispose隔离旧结果。一项实际在途核查及一个最新待查，不以本地AbortSignal冒充已取消RPC。

汇合夹具只补新module之间的组合：dirty期间新版保护、显式切换保留原共同项basis、关闭重开状态候选、旧consumer失效，以及状态装入当前viewId／generation后完整restore消息超过64KiB时拒绝并保留草稿。不能仅验证最小持久封套就发送新封套，copyOnly不当页面restore或绕撤权。限两类代表／双宿主，不复制旧module全矩阵，不声称真实授权／产品3.2／I5。

R2c选择固定可信输入事务保护：回包不能在composition或未确认输入期间销毁活动文档，须有界合并，源页实际确认最新输入后才采用相容结果；控件、回包、view生命周期分别绑定，关闭／换版本／旧代不得复活。算法由本线局部选择，但不能将旧动作重绑到另一个报告／接收者。保留数学／文本／焦点，不用位图替代，不宣称任意HTML或OS隔离已支持。

T1方案继续沿可信登录账户／正常内核、独立非root控制身份及每实例受限身份候选；peer凭据只证明账户，不新增对恶意同UID程序的代码认证承诺。领域授权及唯一ProcessAdmission归原权威，服务不另建容量／权限表，不接页面自报ready／任意路径／凭据。本次将安装代价和T1判据做到可审查，不将跨UID／PID1／policy／FD未知写成已成立，不重试旧同UID入口或启动T2。

research-task-workspace已完成持久等待组合，agent-delegation待真实目标／模型授权，两树本轮等待，不重跑旧正例。共享UI profile由主线单独修复：Electron启动前指定每用例独立user-data-dir，核实际userData／sessionData／storagePath并落盘；本机通过不代表Windows／macOS。完整3.x／2.1b／I5继续开放。

### R2c固定可信输入事务（第20轮本片）

写集仅新`tests/fixtures/report-input/`及本change的R2c段落。只读复用原固定源页、report-structure真实控制器和共同Workbench／UI harness，旧R2／R2b反例不改。首次加载原禁脚本文档；后续只在独立源页实际确认最新输入后，用浏览器DOMParser／importNode替换固定模板的table及count，不替换活动文档／输入节点。不是任意HTML的增量DOM镜像或新DSL，其他结构变化不在此候选范围。

私有事务分别持有固定view／basis／合成接收者身份、当前文档token、源请求代次；最多一次在途请求、一个最新有界输入意图、一个最新有界回包。composition或输入未确认时保持原DOM和值／选区／焦点；组成期间仅合并本地意图，提交或取消后取原生控件实际值送源页，取得真实确认且与当前值相容才采用表格结果。旧回包可推进原源请求代次，不能冒充最新输入确认；无禁输入、时间延迟或自动重试。版本替换／关闭销毁原事务，迟到回包只结清原请求，不重绑另一报告或接收者。

固定模板只校准filter输入事务；order／toggle仅在无输入事务时按实际控件转发，冲突明确拒绝，不偷偷覆盖未确认文字。双宿主复用真实回包门控，覆盖待回包期间的普通新输入／composition、提交及取消与源确认、一次版本替换／关闭迟到；数学／文本／复制／可见查找／AX只保留最小代表。系统IME／读屏、任意HTML／canvas、OS隔离及正式R2／2.1b／T1／T2／I5仍未通过。所有数据／服务／身份仍是可信专用夹具，未接生产资源／权限或容量。

实际有限校准已交：在途回包与composition竞争时原文档／输入节点保持，提交／CDP清除后的实际值须再经真实源确认才采用；关闭及版本替换不转发旧意图。排序冲突的桥接已补恢复已确认order及可见反馈，原输入不变。结果不选定通用呈现架构；固定模板的table／count整块替换不扩成任意结构映射，正式资源／动作／隔离接线仍交主线，证据见R2c调查与delivery。

### 第19轮验收与五线独立实施

2.1d真实Linux接线已接收，R2纯文本投影只接收调查依据；分数及辅助结构丢失不满足呈现契约。现有清单、来源授权、资源保存、共同草稿及registered图机制足以先行实施下列片，不把完整任务图的最终整合顺序误作所有子项必须串行。以下五片本轮直接实施，关键共享选择由主线负责。

| 子片／工作树 | 输入输出与职责 | 独占写集 |
| --- | --- | --- |
| 3.1a／project-execution | 普通session.send→真实harness worker工具先创建新依赖、再按原basis条件保存入口；核实际字节、成果关联、发布前失败及unknown沿原身份查询而不重放。外部模型用既有受控HTTP，人工预置旧报告不算Agent发布 | 新tests/kernel/report-publication.spec.ts，必要新tests/fixtures/report-publication/；复用report.js／model-server，不改共享fixture或生产harness／kernel。生产缺口交主线 |
| 3.1b／research-graph-runtime | 完整候选更新module：可信入口ResourceEvidence、完整load端口及dirty／相关共同显式项事实→当前／待看ReportSnapshot与失败及替换资格。一项在途load及一个最新候选合并通知；仅metadata，不掌握OS范围或第二份字节缓存 | 新workbench/reports/report-updates.ts及tests/kernel/report-updates.spec.ts；不改ResourceView／HtmlRenderView／business-session／protocol／drafts |
| 3.2a／literature-workbench | 可信配置／窗口／项目入口ref／basis绑定原browse／draft／dirty，精确key读写原drafts；可恢复状态或缺失／损坏／超限原因。原版本不可得保留可复制草稿，不重绑新版；内存降级不冒称可靠磁盘保存 | 新workbench/reports/report-drafts.ts及tests/kernel/report-drafts.spec.ts；确需准确降级提示时仅本线可最小扩原drafts.ts的同次写入返回事实，忽略返回值调用保持原行为；不改共同正文权威 |
| 3.2b／research-task-workspace | 仅测试注册的有效报告Graph→真实保存／等待→实际客户端断开重连／内核重启→查询仍waiting→合法新session.send接续；新会话从报告及来源读取。核真实broker／存储／checkpoint／worker／普通内核归属 | 新tests/kernel/report-reconnection.spec.ts及tests/fixtures/report-reconnection/；不改旧domain-execution-worker／生产Graph／protocol／全局lifecycle／fixture |
| R2b／research-interaction | 固定可信页保留原文档／MathML结构的对照，核独立执行页当前状态、真实选区／复制、键盘／焦点／组合及AX结构；保留原纯文本候选反例 | 新tests/fixtures/report-structure/，只读复用report-surface源页／控制器；R2工件仅本线可写，其余片记录交cache由主线合入 |

更新module的load由可信端口复用resources.report完整核查，不另做清单／领域授权。关闭、较新offer使旧完成失效；无保护才可自动采用，有页面或composer保护保留current和pending；显式查看新版只切metadata、不改原显式项。撤权／身份失效封住受保护展示资格并报失败，不以保留旧页绕权限。模块不直接挂全局订阅：宿主只对入口、最多32依赖／100来源的有界通知调用offer，resync至多触发一次合并核查，不扫全库。私有方法命名由实现者决定，真实页面替换与consumer.dispose留主线正式装配。

状态module只使用ReportBridgeMessage中state／restore既有browse／draft／dirty及64KiB JSON限制，持久内容不含易失viewId／generation或可信权限。恢复前由可信调用方核身份、原basis、可得性和授权；未经核准不交呈现侧，原版本不可得的草稿单独作为可复制内容保留。只存有界状态、不保存依赖字节或建立旧报告历史库，不自行引入全局淘汰政策。原writeDraft如需扩返回值，只返回该次实际localStorage写入是否成功；不额外探测写入、另写localStorage或新增存储，保留原内存降级及订阅异常语义。

3.1a与3.2b分别覆盖普通模型harness发布及registered图持久等待，是不同真实入口，各用独立目录／端口且不并写生产模块。只补多文件完整报告／发布失败或unknown、报告等待接续这些旧组尚无的组合，不复制完整故障矩阵或新增发布wire，不让普通save禁止保存未完稿HTML。3.2b尚无正式页面ready接线，只能证明真实查询／重连不消费等待，不能以手工不send冒充真实ready负例通过。

R2b仅为下一可信调查候选，尚未选择正式架构。实际独立固定页的文档结构保留namespace及数学结构，在禁脚本独立frame中对照；源页脚本／样式不进入工作台父线程。不实现通用不可信DOM镜像／新公共DSL，不用手写预期状态或小标签表假装任意HTML。动作／回传及代次有界；系统IME候选窗、读屏器、canvas、任意页面和正式隔离逐项未验。可在~/.cache下创建较短专用目录复验手动Browser，不改sandbox或借/tmp。

以上片可独立交付，完整3.1／3.2／2.1b／I5仍等主线装配。生态及Agent线等真实Windows／下一次模型授权，不为多开线重复静态证明或旧诊断。没有新增公共协议、系统安装／服务或生产报告启用授权。

### R2b固定原结构对照（第19轮本片）

仅新增`tests/fixtures/report-structure/`并只读复用原report-surface源页／控制器；原纯文本反例不改。可信控制器在源页的一次同步读取中克隆当前文档、保留HTML／MathML命名空间、详情和当前表单属性；最多256元素／64KiB。移除固定源码唯一脚本，frame文档加禁脚本CSP，以`srcdoc`放入禁脚本独立frame。父工作台只执行可信夹具的固定控件转发／焦点恢复，不执行源脚本或插入源样式。克隆不是不可信HTML清洗器或通用DOM镜像，不能接任意输入。

动作限定filter／order／toggle，最多128代、一次在途且无等待队列，超量／旧代显式拒绝；未确认结果不覆盖新呈现，关闭封住后续回传。原生iframe控件的已提交值及展开动作交真实源页，无在途回包时组合期间不发更新，返回后仅在父焦点仍属于该frame时恢复本片实际控件焦点／文字光标。原结构整份替换可能打断与旧回包重叠的组合，需实际留作反例，不扩成通用增量DOM镜像。验证实际源DOM／MathML布局与frame文本／AX，双宿主的选择、复制、可见正文查找、键盘／焦点和CDP组合输入；系统IME／读屏及任意页面事件流保持未验。该新候选只回答原分数语义缺口，不关闭正式架构／2.1b／T1／T2／I5。

实际结果：分数及MathMLFraction在双宿主均保留；但晚回包与组合重叠的反例已实际确认，不能采纳“原结构＋整份srcdoc替换”作为完整呈现。晚回包抢父焦点已以父文档活动frame核对局部修正，不为组合失败扩机制。本片止于可重复对照及缺口，正式接缝仍交主线选择，调查事实及未验项见R2b investigation。

### R2本轮可信呈现试验（第18轮）

写集仅`tests/fixtures/report-surface/`及本change的R2四工件。复用真实Workbench的`session.renderResource`和共同TabGroups，不新增产品路由或修改生产renderer。固定合成文献页在测试所拥有的独立Chromium进程执行；可信测试控制器操作该页的真实表单，再从其当前DOM读取最多3行及当前筛选／排序／展开状态。呈现侧只渲染固定字段的React文本和原生表单，不加载执行侧HTML／CSS／脚本，不维护第二份筛选／排序结果。该有限字段结构仅为本次夹具，不是公共协议、通用DOM镜像或产品DSL。

以同一实际页面的动作前后状态、真实DOM文本与辅助树比较投影；在Browser和Electron资源tab验证文字选择／复制、可见正文查找、键盘／焦点及组合输入。CDP组合输入与角色树检查分别只证明浏览器输入事件和辅助语义，不能替代系统IME候选窗或真实读屏验收。独立页包含固定MathML分数，专门观察纯文本投影是否丢失结构；不能将丢失的语义列为通过或自行新增通用编码方案。

夹具控制器／HTTP通道、资源身份及会话均为显式替身，无ReportResources授权、独立身份服务、OS强隔离或可靠停止／容量结论；测试关闭所拥有的浏览器及服务。复用既有静态产品承载和已安装浏览器，不改变sandbox/CSP。按prototype技能保留可重建调查夹具，用户限制下不提交临时分支、不提升生产实现。结果仅回答固定可信页的R2接缝，2.1b／T1／T2／I5保持开放。

实际校准结果见investigation首节：两宿主的普通文本／状态／所测输入可对应，但MathML分数投影成12，辅助结构丢失；不采纳本候选作为完整报告呈现。正式方案必须解决执行侧语义、文本范围、焦点／组合输入和辅助树的可核查映射，保留原体验要求；由主线决定呈现方式，不在本片扩展语义表或改公共协议。手动有窗口Browser在本轮长cache路径遇SingletonSocket前置失败，自动Browser及真实Electron观测分别记录，不混为同一运行条件。

### 第18轮接收与下一片

准备接缝及可信选择夹具按模块接收，实际范围见delivery；不替代正式浏览器。close先封住新效果、立即向当前已有实例派发原stopItem，与在途freeze结清并行；随后再收尾期间形成的实例并核持久停止，records／锁最后关闭。慢freeze只保留自身准备容量，不能延迟其他运行实例停止。

下一片2.1d由计算树验证默认真实OS adapter、ReportResources.freeze和prepare的有限Linux接线。复用原固定native探针、policy和自有测试根，最多新增正常完整字节／停止、满槽延迟读取、在途取消三类代表。领域描述／授权端口可以是固定合成对象，文件、冻结、provider、admission、OS scope、收尾须真实。仅在有明确行为缺口时改provider；不动native政策、wire、系统服务或renderer。写集为原provider窄测试／准备fixture及必要私有provider修复，不写报告工件，交主线接收。

R2上轮启动后429中断，无实现／实跑，继续原固定可信双宿主呈现校准范围。阅读交互树独占report-surface试验及本change R2工件；选择夹具所属科研树暂停，不另造浏览状态权威或提前写3.x。R2无法保留真实文本／输入／可访问语义时交回反例，由主线决定呈现架构。系统安装、T1／T2和正式报告启用仍未授权或通过。

### 第17轮主线接收与下一片

主线接收独立身份服务候选及`createReportContext`消费者；实际验收见delivery。本轮选定以下边界，替代候选研究中尚待主线决定的对应条目：

- **账户信任**：原登录用户及正常内核属于可信工作机；不可信报告及其后代处于独立受限身份。原spec限制的主体是报告脚本，不新增抵御已控制可信账户的任意同UID程序的承诺。peer UID只证明账户，不证明程序代码；正常接线仍从原真实reservation和实例建立授权，不能让页面自报ready、身份或容量。报告取得可信连接／FD／代理就是隔离失败，不能排除为宿主失陷。无需为这个候选迁移整个内核或复制准入权威。
- **执行方向**：继续独立非root控制身份、每实例受限身份及系统管理器固定启动门的候选；部署、账户、策略和管理权限只形成具体安装方案，本轮没有安装／加载许可。原同UID固定入口反例保留，不将账户信任当作该入口已安全的证明。
- **准备接缝**：批准provider内的可信准备方法；输入固定instance／program／policy及私有回调，回调在同一reservation.ready后产生入口路径与有界实际文件字节。排队仅保留最小内存意图，同实例复用同一准备Promise；尚未创建OS范围的准备不伪造完整stage记录或长度。实际清单形成后建立原持久intent、复用原文件／put逻辑并保持唯一租约，不能再调会reserve的公开stage。取消先封住后续效果，在途回调结清前不释放其准备容量；创建范围前没有持久intent不得start。创建可能已发生或停止回执未持久化时继续原unknown。旧六操作及恢复语义保持，不序列化回调、不新增wire操作或领域加载副本。方法命名、私有类型及局部重构由实现者按此契约决定。
- **共同动作**：已接收的`createReportContext`只消费已核查且实际加载的snapshot；调用方捕获原appendContextItems，在关闭、替换、撤权及接收者变更时dispose。queued仅表示共同草稿接收，不能表示发送或可靠磁盘落盘。
- **呈现校准**：先用固定可信文献对比页验证独立执行侧到双宿主共同tab的语义／输入接缝，保留文字选择、复制、查找、键盘／IME、焦点和辅助语义；不采纳位图作为完整呈现。试验不运行恶意或任意报告脚本、不改生产CSP／静态HtmlRenderView；仅证明所测模块接缝，不能声称OS隔离、T1/T2或通用HTML已可用。无法保持语义时交回具体反例，由主线选正式呈现方案。

并行所有权：计算树负责provider准备逻辑及窄测试，不写报告工件、renderer、native构建；科研树负责可信对比夹具及消费者测试，不改共享草稿权威；阅读交互树负责呈现试验和报告工件，不并写两者源码。Windows原生资源树由生态树负责，与准备接缝无依赖。新共享导出及架构登记由主线整合。

### 报告身份、封装与保存

项目 HTML 为入口，起始HTML注释承载一个不可执行的JSON清单（schema version 1）；普通 HTML 仍按 DocumentReader 打开，明确“打开交互报告”才运行本入口。清单采用已登记 ResourceRef 和 basis；入口 fileId 是报告身份，不另发 reportId，入口实际 basis 是该报告版本。

这是报告封装的明确格式：起始分隔为`<!--scholoom-report-v1`后接换行，清单以独立一行`-->`结束；序列化清单时将字符串中的`<`、`>`和`-`转为JSON Unicode转义，保证注释不被数据提前终止。内核只对有界头部做分隔提取、JSON.parse和同源schema校验，不解析其后HTML。渲染端使用浏览器DOMParser重新构造页面。当前editor未声明HTML parser；library的parse5不能跨私有包借用，此格式无需新增parser依赖。

| 拟新增同源字段 | 含义／约束 |
| --- | --- |
| `manifest.version` | 首批固定1；不支持版本明确失败 |
| `manifest.resources[]` | 最多32项 `{path,ref,basis,mediaType}`，本项目内普通文件，路径相对入口，不允许绝对路径、URL、私有目录或链接越界；path和ref必须指同一对象 |
| `manifest.sources[]` | 最多100个 `{ref,basis}`，声明实际研究来源；资源依赖与研究来源分开。库来源保留材料版本；不复制为库权威副本 |
| `manifest.objects[]` | 最多100项 `{objectId,name,semantics,sourceIndexes?}`，objectId在本版本唯一；只能引用本清单来源；semantics按既有8192 UTF-16容量 |
| `ReportSnapshot` | `{resource,manifest}`，resource为真实ResourceDescriptor；读取内容和依赖仍用现有分片，不在单帧塞整个报告 |
| `resources.report` 拟新增操作 | `{ref,basis}`→`ReportSnapshot`，只支持项目HTML；复用ResourceAccess所属授权及路径／身份核对，错误用原ErrorInfo，不另建错误框架 |

入口不超过现有256KiB文本保存范围，清单JSON总量最多128KiB；单个依赖最多8MiB、整个加载集最多32MiB、同时读取最多4项。字体／图片／CSS／JS／JSON只从清单交付；首批不执行远程module、worker、WASM、iframe或插件。图片使用栅格格式，不能用资源清单加载任意HTML/SVG文档绕过页面政策。资源读取前后核对ref/basis和权限；依赖发生变化则候选失败，不展示混合版本。

项目HTML正文 write 从现有 text 范围扩展到 html，仍核对大小、强resourceBasis、expectedFileId与有效执行；库和跨项目目标仍只读。首次保存用resources.create及原operationId核查；更新用resources.save。普通HTML阅读继续不运行脚本。

多文件更新先创建新依赖，再以一次入口条件保存发布完整清单；引用的版本文件不就地改写，旧页面可保留其已验证快照。入口发布前复查全部依赖。失败保留旧入口和实际创建文件，不做目录回滚／清理；入口已保存而关联unknown只核查原保存／补关联。外部程序直接改文件仍可能打断一致性，读取时明确失败，不声称跨文件事务。

首次创建入口和JS／CSS／JSON使用既有UTF-8创建能力；图像／字体使用已经存在的真实项目资源，本change不新增二进制写入或图件生成工具。需要新计算生成素材时消费所属计算能力，不能以文本create伪造二进制成果。

### 核准字节交付

`ReportResources.freeze(entry, access)`复用snapshot的同一次完整核查并保留该次实际读到的入口及依赖字节，返回`{snapshot, files: [{path, bytes}]}`；路径为已核对的项目内相对位置，显式来源只参与授权和版本核对，不隐式复制其正文。入口、依赖、路径绑定和read／send前后复查全部通过后才返回，失败不发布部分加载集。普通snapshot继续只返回原DTO，不持久缓存字节或建立第二材料权威。

该接口仅供可信宿主在隔离提供者取得准备资格后使用；自身不取得进程租约、不启动程序或授予报告权限。消费者按已登记原instanceId分片交付并封存，不能为重试改读同路径新版。现已实现并通过模块测试；实际platform消费、生产启动恢复和浏览器仍需各自整合验收。

### 历史与单目标报告的受控读取

历史读取沿文件权威已有FileEdit的before／after正文、对应Evidence和原path核查，缺原Evidence保持unavailable。ReportResources的历史Adapter只替换该入口的读取与描述，依赖、来源及read／send仍复用现有完整核查；不以当前入口basis或新清单补旧记录。files.edit／files.history及指令原版本核对在返回正文前完成授权，原同步保存／撤销回执保护不因此取消。

目标报告采用现有targetRead单目标限制：只有入口、依赖和声明来源全部属于原目标项目、且每项原身份／basis和路径对应可验证时才允许读取。库及其他项目来源继续在展开前unavailable，不借原会话权限解除targetRead。ProjectTargetReader增加有界的既有路径身份查询，不创建登记、不扫描目标树；宿主在原project.readTarget owner内用原始reader装配ReportResources，避免资源业务入口递归。读取前后复查报告及原执行授权，并将真实Evidence进入现有报告使用／模型准入链，不新增公共target DTO或写权限。

### 来源授权与共同动作

清单中的来源不授予权限。人工查看前沿所属读取授权，实际动作及Agent外发再检查来源read/send；sources只允许非报告资源，不递归遍历任意引用图。`ReportResources` 生产通过ResourceAccess的窄领域端口，不能从renderer传可信身份。报告引用的声明来源由资源层统一核查，实际执行的describe/read和模型前复查也必须使用同一检查，避免新会话读取报告绕过已声明库来源撤权。不能证明未声明、手工粘贴内容的完整来源归属；这与普通开放文件一样需要科研核查，不声称自动溯源。

页面动作只带本版本objectIds和request（<=4096 UTF-16），宿主按manifest取对象说明，不信页面提供新的ref/basis。转为既有 `ContextItem.object`（providerId固定为本报告提供者，objectId来自清单，ref/basis取报告入口）；对象的明确来源还作为原资源项加入同一批草稿。超过16项／64KiB时整批拒绝，不能只附半组对象与来源。复用贡献端口新增 `appendContextItems(items)` 的原子批量形状，由原会话一次合并／校验；单项append转用同一实现，不增加第二份草稿。

共同批量入口现沿ContextContribution／WorkbenchSession实现同步boolean结果：原useBusinessSession读取当前草稿一次、完整合并校验后单次写入，拒绝返回false并保留草稿；原单项仍返回void并委托批量路径。provider只有批量追加callback，不并存两套追加权威。接收会话／项目／配置键变化即更换该次接收者实例，旧callback即使切回同名键也拒绝，且不修改新错误状态。成功表示原草稿适配已接收，不扩大原writeDraft的磁盘持久性保证；桥不得把false当queued，报告版本／对象／receiver的最终检查仍归未来报告消费者。

共同草稿提交与订阅通知分别表达：writeDraft完成内存及原持久适配后，逐个通知订阅者；单个订阅异常经浏览器标准reportError报告并继续其余通知，不逆转提交或向调用者伪报拒绝。这是同一草稿适配的职责，不由每个追加调用方捕获异常后猜测是否保存。

页面要求写入选中对象的comment，原有composer展示并允许修改；用户经共同入口发送，遵循现有正文或非空批注的发送契约。页面消息本身不触发session.send。对象多选只贡献当前已加载清单，不读取文献表格DOM或全库投影。

### 隔离与页面桥

#### 独立执行身份与受控服务候选（8d8f339，待主线决定）

本片完整候选由[独立身份服务研究](../../../.scratch/scholoom-foundations/research/report-independent-identity-service.md)维护：系统管理器创建独立于原用户／浏览器的固定代码控制服务，受控启动门只允许登记的每实例浏览器及策略；认证、启动、只读字节、FD、全部进程范围、资源、unknown／恢复、分发和安装面均逐项列明。它替换的是被否定的同UID固定入口候选，不代表已经采用系统服务或获得安装许可。

复用原`freeze`与`stage/put/start/get/stop/check`，只在原reservation.ready后加载同一批准字节，来源和领域权限不移入服务。恢复仍由同一ProcessAdmission保留未知及持久停止后结清。现有静态native的ELF／user-manager／默认syscall假设不能直接当作浏览器或系统服务Adapter，具体新增公共接缝先由主线审；本轮不修改schema、platform、kernel、renderer或生产CSP。

主线决定点仅为R1受保护的请求者／准入证明、R2共同呈现surface及R3跨身份启动／部署权威。同UID客户端、可转交FD／token及profile名称stack反例必须先于T2；没有闭合R1，不接受“客户端说已reserve”。不采用画面流，也不把文本选择／复制／查找／IME／焦点和可访问性树移出首批保证。共同tab、语义token、草稿和composer沿现有UI设计，2.2可信选择模块由research-graph-runtime独立维护，本片只交版本绑定及原子附加的消费需求。

现有代码还有准备顺序缺口：stage自己reserve且要求精确清单，freeze才取得实际字节。推荐审原provider内部的受信准备回调，沿同一reservation.ready后freeze并建立stage／put数据；不能宿主先reserve再调用原stage造成第二预留，也不能排队前读取完整集。候选服务不再另建一个ProcessAdmission。以下仅为待审时序，认证及该私有回调未实现：

```mermaid
sequenceDiagram
  participant H as 可信宿主与领域授权
  participant P as 原provider及唯一准入
  participant R as ReportResources.freeze
  participant C as 候选独立身份控制服务
  participant M as 候选受控启动门与PID1
  H->>P: 请求准备原instanceId 接缝待审
  P->>P: 原reservation.ready 仅一次
  P->>R: 受信回调取得批准冻结集
  R-->>P: 同一snapshot与实际bytes 或拒绝
  P->>C: 原stage和put 认证封套待审
  alt 认证或登记策略不足
    C-->>P: 拒绝 不创建执行范围
  else 前置可核查
    C->>C: 持久范围intent
    C->>M: 固定程序和策略建立原范围
    M-->>C: 实际身份 限制与范围证据
    C->>H: 末次授权与原准入证明
    alt 撤权或取消
      C->>M: 停止全部原范围
      C-->>P: 持久完整停止回执后结清
    else 仍获准
      C->>M: 放行本次固定策略
      C-->>P: 实际执行或unknown 不重放
    end
  end
```

下一步是主线选择及另行授权的T1固定native／服务入口校准；通过后才做T2固定文献对比报告的完整浏览器／两宿主校准。条件不足保持unavailable，不创建新容量／材料权威、不回退旧launcher或降低OS／停止／体验保证。本文档规划已可审查，但上述决定未作出前不声称浏览器实施前置已闭合。

#### 下一片：独立Linux提供者的实施规格

用户委托主线选择方案后，主线采用候选A的Linux普通权限前置，先形成独立platform提供者的OpenSpec实施规格。它负责批准字节的有界只读交付、启动前FD／stdio策略、namespace及实际资源限额、完整归属／停止和重启unknown核查；ReportResources继续掌握ref／basis与read/send。已有普通权限不能履行保证时保持unavailable，不安装特权服务或静默降级。

独立[add-linux-isolated-report-provider](../add-linux-isolated-report-provider/delivery.md)已完成9/9并获主线接收，限定Linux x86_64静态native策略，真实预执行、scope停止、恢复及唯一准入已验。它尚未接入产品宿主或浏览器，不能据此启用活动报告。这里消费原六操作，不复制另一套准入／控制器；ReportResources.freeze已实现，按原ref／basis及来源授权消费冻结字节的生产Adapter仍需接入。

下一片止于apply所需规划工件齐备，不把临时C launcher复制成生产提供者。设计必须复用现有准入／归属与监督，明确控制器丢失、迟到能力和恶意样本下可独立验收的保证；不能另建容量计数或以根PID消失释放。Linux机制先独立交付，Windows另需目标校准，macOS继续不可用。完整浏览器、共同呈现／输入、分发及多视图预算尚未纳入本片，不以原生样本替代报告UI验收，2.1b／I5保持开放。

#### 高FD、接收通道及普通文件门（f4ab1e5，已执行的调查片）

本片只在`/home/joshua/.cache/scholoom-report-gate-round14-DocB5o/`创建有限native样本、可信launcher候选、控制器及结果，TMPDIR同根；不读现有/tmp，不接生产Adapter、浏览器或新协议。复用已有systemd用户scope／bwrap，启动前核工具、普通权限和实际20%CPU／64MiB／swap0／16tasks保护；前置不满足即停止，不修改委托或安装／提权。不重跑CPU／OOM负载。

固定对照分为：故意保留256／1024等高FD上的合成文件、目录、cgroup迁移句柄及带SCM_RIGHTS队列的自有socketpair；关闭非白名单FD后的相同动作；把接收通道误放到2的危险对照及stdio类型门明确拒绝启动。0只承载G／Q固定控制字节的单向FIFO，1／2为本轮指定的只写诊断文件，核fstat身份和访问方式，不将descriptor编号本身当信任。无通道时实际recvmsg的ENOTSOCK／EBADF与误暴露通道实际收到句柄分开记录；启动拒绝后的动作未执行，不能记成逐动作阻断。

普通文件门以O_PATH／NOFOLLOW取得真实对象、核类型和预期dev／ino，仅普通文件再打开其同一FD指向的只读对象；目录、socket、FIFO、symlink及身份不符单独拒绝。批准字节经bwrap已有ro-bind-data从核对后的FD交付，进入样本再核实际内容、只读性和内部FD是否已消耗；不是原ResourceRef／basis的生产Adapter或并发更新保证。只读socket映射不再作为候选的合法资源输入。

每个源scope及独立同限额目标scope唯一命名并登记；危险正例只迁入本轮目标。控制器分别核实际宿主PID的cgroup及源／目标成员，结束核本轮全部unit和cgroup，不能从源空／根PID消失推完整停止或释放生产容量。固定样本／合成文件是调查输入；FD传递、权限及归属使用真实OS。完整网络、syscall／控制器丢失恢复／双宿主／分发／OS与呈现决策仍缺证，活动报告unavailable和2.1b／I5开放保持。

本片唯一有限轮已完成：关闭门对被测高FD实际动作返回EBADF，可信0–2无SCM接收socket；误暴露2的危险对照却通过SCM传入句柄并实际迁移，stdio门另在进入前拒绝该配置。类型门拒绝socket／目录／FIFO／symlink，身份不符普通文件也拒绝；批准FD交付固定只读字节。具体原始数据、首次编译环境失败及收尾见investigation首节，不在本设计重复数值矩阵。

这给前片Adapter职责提供了有限策略依据：FD白名单包含类型／身份／方向及对端用途，不能只保留0–2；特殊文件必须在映射前拒绝，核对后从持有FD交付，不重开原路径；迁移能力不得通过遗留或SCM通道进入。下一步仍需主线决定是否在platform独立提供者中审查和校准剩余syscall、迟到能力及控制器丢失／unknown／容量组合。临时launcher／FIFO／诊断文件不是新的生产控制协议，普通文件dev／ino也不取代ReportResources的ref／basis及read/send权威。

#### 最小文件视图及继承句柄校准（ba29ee6，已执行的调查片）

本片仅调查：复用上一轮systemd用户scope＋显式bwrap及20%／64MiB／swap0／16tasks保护，先核工具、当前权限与实际限额；不重跑CPU／OOM／pids负载，不运行浏览器或产品UI。临时C样本／可信launcher／控制器及原始结果保留在自有`/home/joshua/.cache/scholoom-report-files-round13-*`，TMPDIR使用同根；仓库只改原四份工件。

批准文件只读映射到固定位置，未映射文件及凭据诱饵全部来自本轮合成目录；禁止读真实凭据或用户profile。正向控制先证明这些自有文件／socket在宿主可用，再分开运行：无多余继承FD的最小视图；显式保留文件／目录／已连接Unix及TCP socket的危险正例；将自有pathname Unix socket只读映射进视图的危险正例。不能以netns或只读mount属性自动宣称代理拒绝。

样本进入时核namespace、NoNewPrivs／capability和实际FD集合，策略必须先于测试动作。实际尝试原映射写打开、隐藏路径／proc路径、pathname及abstract Unix socket、继承FD／openat、直接及嵌套namespace挂载扩张。scope迁移只尝试本轮另一同样有限的自有目标scope及其cgroup.procs，不能迁入Orca／其他已有scope；若写句柄根本无法注入，应标缺证而非伪造拒绝。所有正负例如实记录，包括能扩展私人挂载但不能取得宿主数据的情况；不为通过另加隐藏的权限限制或新seccomp策略。

每个scope及服务唯一命名、有限运行，finally仅停止本轮所有源／目标unit并核整组回收。结果只作为独立platform Adapter的最小职责输入；组外／继承代理没有证明拒绝则保持unavailable。外部DNS、Windows／macOS、控制器丢失／恢复、呈现／部署／运行时分发及正式2.1b仍不在本片。

本片实际完成一次有限实验，精确根为`/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT/`；完整矩阵、首次环境失败及边界只由investigation维护。关闭多余FD后，批准普通文件可读不可写、隐藏路径拒绝；故意保留FD时却可读取隐藏文件、调用宿主Unix／TCP代理并迁移到本轮同限额目标scope。只读映射的pathname socket也可调用宿主服务。活动报告继续unavailable，不能以netns、ro或源scope回收代替安全保证。原样本明确是调查工件，不接产品运行时。

独立platform Adapter的最小职责输入如下，尚不是新增公共接口或实施授权：

| 责任归属／现有入口 | 必须闭合的职责及下一窄校准 |
| --- | --- |
| platform预执行／原生启动门，复用ManagedNode监督语义 | 在不可信程序进入前核资源范围和FD白名单，关闭未授权FD；包含0–2控制I/O，不能把socketpair默认视为无权通道。核高FD、SCM_RIGHTS及迟到获取；本次0–15观察不足。明确可信launcher自身的宿主连接权限，无通用代理或可转移文件／cgroup控制句柄 |
| editor ReportResources／ResourceAccess继续掌握字节及read/send，platform负责受控映射 | 对实际批准ref/basis取到的字节作有界只读暂存及前后核对，映射普通文件并核真实类型／身份；拒绝目录、socket及其他特殊文件，不能只检查ro。沿原身份／basis，不新建ResourceRef、存储或来源表。字节暂存与发布接口须主线审查，本片未实现 |
| platform归属／controller，复用现有unknown及容量机制 | 不向样本暴露cgroup路径／迁移句柄或其他可扩大归属权威；完整停止核整个实际范围及泄漏／迁移可能，不以原scope空或根PID消失释放容量。先以本次继承FD迁移为反例，再校准控制器丢失、恢复／unknown及多代停止组合，不回退现有保证 |
| platform OS策略／部署条件，主线决定 | 解释当前nested EPERM的实际提供者，并核需要的syscall／nested namespace策略；本次后续动作未执行，不证明独立拒绝。Windows和Mac无新增证据，缺必要提供者保持unavailable；不借安装、提权或新服务补齐 |

下一片若获授权，先在平台所属边界审句柄／文件映射和归属机制，再独立校准，不能直接将此处临时控制器移入生产。生产接口、运行时分发／维护、OS权限、呈现与文本／无障碍体验及预算仍交用户／主线决定，不预设截图替代。当前总览图仍是目标，不表示ReportView或隔离桥已接入。

#### 本机普通权限前置校准（29cd728，前一调查片）

用户只授权候选A的平台前置，不采纳下方画面／输入承载。仓库写集仍为本change四份工件；临时原生样本、命令和原始结果保留在本次独立`/home/joshua/.cache/scholoom-report-platform-round12-*`，TMPDIR指向该根，避开本机/tmp的EDQUOT，不清理旧目录。

先核版本、用户manager、实际cgroup及namespace权限。独立transient user scope先启动可信的有限原生等待／读回样本，实验上限CPUQuota=20%、MemoryMax=64MiB、MemorySwapMax=0、TasksMax=16、RuntimeMaxSec=15秒；这些是夹具保护，不是产品预算，15秒只界定开始终止，不保证全部收尾恰在15秒内完成。原生样本读自身cgroup，控制端独立读scope属性及实际cpu／memory／pids文件，不能只检查属性请求、W_OK或当前Orca scope。

再以本机已有bwrap／unshare执行固定true核预执行namespace门，记录实际退出码、错误、是否进入样本。必要namespace／配额／归属条件不满足即停止，不运行busy／内存／fork／网络负载、浏览器、VM／容器服务。仅全部前置成立时才继续有限原生反例；网络目标仅为自有loopback，不能据此关闭外部DNS或全网络保证。scope使用唯一随机unit，finally仅停止该unit并查询状态／归属；没有完整后代样本时不将短进程退出记为完整停止证明。禁止sudo、改系统配置／权限、安装或启动新特权服务；Mac、Windows与浏览器／双宿主均未因此验收。

本轮已按该门槛执行，独立scope与显式bwrap门通过后，唯一完整负载轮取得CPU节流、pids拒绝、内存OOM和多代整组回收；实际数值及限制见investigation“本机前置机制实跑”。内存样本仅本次scope设OOMPolicy=continue以观察独立子OOM，不写生产政策。宿主loopback目标无送达不等于禁socket或外部DNS已隔离。可信bwrap启动包装器仍在宿主net namespace，不得执行报告或作网络broker。该结果仅供后续独立platform Adapter审查，不能替代句柄／syscall策略、持久unknown／容量、浏览器及双宿主验证。

#### 下一承载候选与待决范围（938c33f，仅调查设计）

机制事实、官方来源L／W／C索引及本机条件由investigation的实跑与前一轮承载调查维护。本片不修改正式规格／同源schema；既有“页面隔离与有界动作桥”的保证不变。新的物理承载未定，不将像素投影、OS新权限或新传输当已批准产品能力。

排除近路：只增加renderer／BrowserWindow／WebContentsView不能覆盖组外browser／network／GPU服务，也不自动限制CPU。WebContentsView仅属Electron main，普通Browser不能嵌入该原生视图。新窗口或开放CDP端口不保持共同UI，也可能泄露控制能力；DOM API覆盖、Electron HTTP过滤、禁摄像头不替代OS网络拒绝。

只保留两个承载候选；A完成的仅是本机原生前置，都还没有正式报告提供者：

| 候选 | 必需组合 | 权限、安装及不足 |
| --- | --- | --- |
| A：OS隔离的独立完整浏览器进程图＋可信呈现控制器 | Linux独立namespace／最小文件视图／受控FD与syscall策略，加实际委托的cpu／memory／pids cgroup；Windows无网络AppContainer／LPAC、ACL及受限句柄，加Job配额／归属。主browser、renderer、network、utility和崩溃进程都入范围；控制器通过私有pipe管理 | 复用现有监督语义，新增OS策略归platform／主线。29cd728本轮已证本机独立用户scope和namespace的有限原生组合，尚无生产Adapter或浏览器通过。Windows浏览器兼容性、DNS代理和句柄覆盖未验。需WFP／特权服务则另审，不自动安装。还需可维护的浏览器运行时／字体分发与许可，不能借用户profile或开发Playwright缓存冒充产品依赖 |
| B：无网络的容器／VM浏览器＋同一可信呈现控制器 | 容器仍需namespace／配额；VM另需guest镜像、hypervisor及guest／host资源与退出证明。Windows Sandbox／Hyper-V仅是机制候选，不是现成provider | 安装、磁盘、虚拟化、可能重启及镜像更新成本更大；Windows版本／Home边界、默认联网、共享目录／剪贴板必须收口。VM主进程退出不证明全部归属停止；本机未核KVM／Hyper-V可用，不承诺Mac。此候选也没有消除双宿主呈现问题 |

用户本轮已单独授权A的本机原生前置并取得有限结果；这不采纳完整浏览器／呈现架构。正式Adapter及浏览器下一片仍由主线按剩余保证决定；权限或平台不能兑现时继续unavailable，不自动回退B、无配额或受信项目执行。B只在明确接受更大安装／维护范围后推进。

**普通Browser的具体呈现候选：** 报告脚本在执行端独立浏览器运行；Browser／Electron共同React tab仅显示可信控制器输出的有界画面及宿主控件，转发当前视图的指针／键盘／滚动，不执行回传HTML／CSS／JS。Browser父工作台仍持既有认证连接，**报告进程**不持KernelClient、token、preload或通用broker方法。Electron走同一路径，不另做原生业务页。本片没有实现画面／输入流或新协议。

```mermaid
flowchart LR
  R[ReportResources 实际快照与领域授权] --> C[拟可信呈现控制器]
  C -. 核准版本字节和私有pipe .-> S[拟OS隔离的完整浏览器进程图]
  S -. 不可信画面及有界页面JSON .-> C
  C -. 主线待审同源呈现契约 .-> V[拟共同React视图 Browser与Electron]
  V -. 当前视图有界输入 .-> C
  C -. 原Bridge schema核对 .-> D[既有共同composer 待2.2]
```

CDP截图／输入或独立Electron offscreen仅是控制器内部Adapter候选；不把CDP、任意evaluate或调试端口交给页面／工作台。私有pipe不继承宿主socket、terminal、D-Bus／X11／Wayland、凭据或共享profile；必要公开字体／运行时只读映射，scratch独立。画面不是M3 render ResourceRef或项目成果，临时视图句柄不是reportId／新来源表。MessagePort可留在报告浏览器内部，但对象不能直接跨OS进程／Browser网络传递；跨越处仍须重新核schema、方向、大小、viewId／generation／basis和当前对象集合。

图像投影缺少工作台原生DOM文本选择、查找和可访问性树，中文IME、复制、焦点、缩放及高DPI都须证明；CDP的screencast／IME相关项在本次上游源码标experimental。若需可信语义／可访问性投影，其输入必须来自同一核准报告，不将任意DOM注入父页。这些是产品和接口待决项，不能写作“后续优化”来降低首批体验；未采纳前不实现图像流、报告DSL或新schema。

控制器也不信任浏览器输出：画面尺寸／字节／帧率先核再解码，只保留最新候选帧，输入队列有界并明确拒绝；编码／解码不能把不受限工作转移到kernel主线程。具体预算及传输背压须校准后定，不把现有Bridge的64KiB限额挪作图像协议。

**深模块及未来写集。** 单一报告运行module集中“核快照→受管启动→有界呈现／JSON→失效／停止”；OS Adapter和浏览器控制Adapter是内部seam，不让双宿主调用方各自处理规则。外部Interface只需保证／可用性检查、打开已授权视图及关闭／取消，状态／失败沿原ErrorInfo及实际实例；帧／输入schema在选型后由主线确定。替换Adapter的测试只证明模块状态／授权逻辑，不证明OS安全。

| 文件／符号（拟新增均未创建） | 所有权及消费契约 |
| --- | --- |
| `packages/editor/src/report-resources.ts`、拟`report-execution.ts` | 阅读线掌握报告版本、对象／加载集及展示生命周期；消费scope Adapter，不直接调用原生OS、不另存正文或领域授权 |
| `packages/platform/src/processes.ts`／`process-controller.ts`、`native/process-scope.c`及拟隔离Adapter | platform／计算线与主线提供网络、文件、配额、预执行gate及完整stop；共享符号按独立公共增量审查，不修改programs权限或扩读managedExecution为新保证 |
| `apps/kernel/src/manual.ts::reportResources/reportSnapshot`、拟报告装配及`commands.ts::CommandWorkspace` | 主线统筹真实read／send、受管准入与私有资源绑定；Manual不要求harness。普通programStart的受信执行权限不能绕过报告隔离，页面不提供可信context |
| `packages/protocol/src/report-contracts.ts`及相关operations／派生映射 | 主线统一审查呈现／输入／保证发现的增量，复用Bridge JSON和既有ResourceRef／basis。画面不是64KiB桥JSON，需要独立有界分帧／背压设计；禁止两端私造DTO或无限通知 |
| 拟renderer `workbench/reports/ReportView.tsx`、现有资源tab窄接入 | 阅读线提供双宿主同一React消费及草稿／失败呈现；本片不创建该文件，不改Workbench／CSP／导航／composer或正式UI布局 |
| `packages/harness/src/runtime.ts`现有报告Evidence链 | 本轮不写；queue／final／restart及委派checkReadable继续保护实际来源。页面ready和画面不授予模型外发，不自选接收者；2.2才接明确附加 |

授权在打开／排队前、取版本字节及交付前再次核全部ref／basis和实际read范围；来源撤权／版本不符停止交付新字节／画面并使视图失效。用户发送仍经既有harness核read／send及子范围。OS范围只得到允许的资源字节，不见项目／library根或数据库；scratch／profile也不能访问本机代理。撤权后清除受保护展示／缓存，但不声称能回收用户已经看到的信息。

**最小校准设计（仅计划，选型后另授权实施）：**

1. 先由独立platform提供者以固定原生子程序校准网络／配额／完整stop，再接浏览器。查真实OS／版本／程序身份和预执行gate，必要策略先于不可信代码；现有Node bootstrap不能直接当浏览器gate，Windows不能先spawn再补token／Job／网络策略。权限缺失即unavailable，不自动提权／安装。
2. 自有正向控制与观察器覆盖IPv4／IPv6、loopback／LAN、TCP／UDP、STUN及独立无缓存域名的DNS；核系统DNS／代理broker、继承socket、UNIX socket或命名管道。HTTP计数或fetch失败不能代替DNS／UDP证据。缺自有DNS／目标平台条件就明确缺证，不改系统全局DNS或真实库。
3. 用真实ReportResources／项目／库装固定HTML与依赖，前后核basis；不齐、旧basis、path-ref变化、撤权、委派缺项及旧版本Adapter继续拒绝。复用`tests/fixtures/report.ts`与原生产／委派授权回归；窄端口替身不算生产授权。
4. 单独scope内有限忙循环、多worker、内存及后代样本，读实际CPU／memory／pids计数和宿主心跳，核子不能改配额或经GPU／组外服务绕过。预算／响应和画面吞吐需预先沿验证纪律定下，CPU配额不等于绝对实时保证，失败不加统一timeout。
5. 正常关闭、取消、根退出、控制器／浏览器崩溃、fork竞态及管道丢失分别核完整归属；ProcessAdmission继续保留unknown及占用，不能按根PID消失释放。关报告运行不取消已受理Agent，重开不自动重放动作。Mac继续无可用受管提供者，不借候选VM宣称恢复。
6. 机制通过后才用静态构建产品做真实Browser／Electron呈现校准：版本绑定、旧消息／帧、超量及背压、中文IME／焦点／选择／可访问性和撤权释放。内部broker／文件／worker／隔离提供者真实，模型仅外部可控。接口有增量先审schema及生成映射，不以普通HTML／PDF回归代替。

**须交用户／主线决定：**

- A的本机有限原生校准已获单独授权并完成；下一步是否形成独立platform Adapter及浏览器校准仍由主线决定。“共同UI可信画面＋输入／语义桥”未获采纳；若要求完整原生DOM体验，需可兑现的隔离方案，不能恢复已否定iframe。
- Linux委托scope／namespace如何提供；Windows先校准无网络AppContainer＋Job，还是承担WFP服务／VM的安装维护。权限不足不可用，不先承诺免安装或三平台覆盖。
- 浏览器随产品分发还是人工登记已安装版本；Node内核不依赖开发缓存，运行时更新、签名／许可及目标安全版本维护归谁。
- 中文IME、可访问性、查找／复制、WebGL的验收范围与单视图预算／多视图容量；不能靠禁用功能或只保留截图降低报告保证。

上述决定未到，不固化新协议或开始OS实现；2.1b保持未实施，2.2／3.x、目标报告／旧版本Adapter及完整I5继续开放。

#### 第九轮隔离机制原型（当前共同基线4312262）

写集仅`tests/fixtures/report-frame.ts`候选隔离模块、`tests/ui/report-isolation.spec.ts`、必要测试输入／构建夹具与本change工件／UI设计分节。模块归类为调查夹具，不是第二份生产业务实现；不接ReportView／Workbench／composer、不注册tab或页面，不改harness白名单及生产CSP。后续若采纳必须将经验证模块迁入唯一生产实现并移除夹具定义，不能两处维护。

续做的必要入口为`report-isolation-entry.ts`，恶意页面样本为`report-probes.ts`，网络观测复用`report-network-trap.ts`；只保留前32条HTTP／UDP样本及总数、最多16个自有连接。导航等待实际CSP事件或frame生命周期，不能以初始Blob地址已存在判断尝试结束。测试正向资源读取、nonce泄露反例及交集策略分别记录，HTTP与UDP结论分开。选择回调仅为可受控的待完成Promise，不连接composer或内核写动作。

真实kernel的ReportResources返回snapshot，测试按其ref／basis取得实际字节再复查snapshot；候选模块只接收这份已授权的窄字节集合。HTML用惰性template解析并重建受控头部，显式清单资源转本轮Blob；不在父DOM挂原HTML。首次nonce策略作校准，另测nonce与仅Blob脚本策略的交集，防页面读取nonce后加载任意远程script；不把单个nonce或frame-src blob解释成精确资源白名单。父策略仅施于专用夹具页，生产策略变更须主线另评估HTML/PDF。

两宿主沿既有真实Browser／Electron主窗口及静态已构建承载，测试路由提供已打包的专用父页模块，不用DEV示例入口。自有HTTP服务在解析前开始计数，正向请求证明计数有效，所有攻击目标是本轮端口；必要UDP/STUN探针补充HTTP计数看不到的WebRTC路径。先证明合法脚本／图片／字体确实运行，再核多通道零外部请求、opaque DOM／preload／Node／内核访问隔离、导航／blob继承、桥版本／generation／basis、旧port、过量和关闭释放。忙循环只用有界样本诊断父响应，不以等待或重试隐藏失败。

输出是逐宿主、逐保证的实际结论。只要确认的保证失败，生产仍unavailable，保留反例及最小可审查替代方案，不把设置sandbox属性或请求被测试拦截算作安全，不把HTTP零计数扩大为所有网络保证。

续做实跑已确认两宿主的交集CSP仍允许WebRTC数据通道向本轮STUN端口发UDP；`camera/microphone 'none'`不阻止该通道。Electron中仅nonce策略还实际加载远程脚本，Browser相同校准被Local Network Access拦下，不能归功于CSP。当前结论是生产保持unavailable，HTTP样本零请求仅是被测通道结果。250ms忙循环期间Browser父页心跳出现251–258ms间隔；Electron样本17–18ms也不构成强CPU隔离保证。精确版本、原始包计数与各轮失败见同一delivery。

主线接收调查，维持已有不执行脚本的HTML阅读器，活动报告继续不可用。下一片仅调查能提供UDP／DNS／HTTP拒绝、CPU及完整停止权威的独立执行承载与双宿主呈现接法，列明现有资源／桥的复用、跨平台可用条件、最小反例及待选架构；候选齐备后再定2.1b实施，不在本轮选择新产品承载或改生产CSP。Browser普通iframe和Electron仅HTTP拦截均不能凭本片兑现这些保证，覆盖页面API也不构成可靠隔离。

以下是2.1a已实跑的iframe候选，不作为正式ReportView承载：opaque-origin sandbox只allow-scripts，无allow-same-origin、popups、forms、downloads、top-navigation或宿主preload。加载器重建头部和资源引用，移除base、外部URL、嵌入文档、原meta及主动导航；CSP限制nonce／Blob资源、connect／worker／frame／object／form／base，父frame-src约束Blob目标。它仍有上述STUN及CPU反例；正式承载和普通HTML／PDF影响由2.1b另行验证。

首次握手仅向当前iframe.contentWindow传一次MessagePort，不把origin:'null'作为身份。每次加载持有新的viewId、generation、basis，关闭／更新立即关闭旧port和Blob URL。后续消息仅在该port接收，不能监听任意window消息执行动作。

| 桥接消息候选 | 作用与响应 |
| --- | --- |
| `ready` | 确认当前页面可呈现，不发送指令或恢复Graph |
| `state` | `{browse,draft,dirty}`；JSON最多64KiB，由宿主保存窗口草稿，不能借此读取其他视图 |
| `select` | `{objectIds,request}`；宿主核对当前清单与接收者，原子加入共同草稿，返回queued或原结构化错误 |
| `restore`（宿主→页） | 恢复同版本草稿或新版仍支持的浏览状态；不承诺跨版本对象位置重绑 |

消息使用protocol同源schema，拒绝额外字段、未知版本、超大字符串及不在清单的对象。每视图仅一项附加请求在处理，state仅保留最新一份，动作速率首批每秒最多10项；过量明确拒绝，没有无界队列。页面加载、端口失效和拒绝有本地诊断。标准iframe的sandbox不提供任意恶意CPU强隔离，忙循环样本先核对浏览器／Electron实际影响；若目标保证不能满足，停止报告启用并返回调查，不削弱“无网络／无内核访问”约束。

### 更新、草稿和关闭后接续

资源变更订阅只覆盖报告入口与清单资源／声明来源，不扫描项目或全库。只允许一份载入中候选，连续变更合并到最新；入口和依赖全部核对完成才可切换。旧请求通过generation拒绝，不覆盖新版。

页面dirty、未完成批注及相关共同草稿任一存在则保护旧页；用户明确“查看新版”后，原版本草稿保留，显式ContextItem保留原basis。浏览状态是可丢弃的展示状态；新版支持时按对象身份恢复，否则显示新状态并保留原摘录。窗口草稿按配置、工作台实例、报告ref、basis隔离，复用现有storage adapter，仅保存既有桥契约中的有界browse／draft／dirty，不保存入口、清单或依赖字节，也不构建永久历史库。持久状态及装入新viewId／generation后的完整restore封套均核对64KiB JSON上限。关闭时同步保存最新state，不依赖卸载后的异步回调。

重开优先核对权限，原版本仍可核查则恢复旧页草稿并提示新版；原版本不可得只展示已保存草稿／摘录及不可用原因，不能把旧basis内容伪装成当前材料。存储不可用时明确不能持久恢复页面草稿，保留内存中的内容供复制，不悄悄丢弃。撤权时隐藏受保护的旧页面／缓存，不能以草稿保护绕过。

```mermaid
sequenceDiagram
  participant U as 用户
  participant R as ReportView
  participant C as 共同composer
  participant H as harness
  participant P as 项目资源权威
  U->>R: 筛选并要求分析所选对象
  R->>C: 原报告basis及清单对象和来源
  U->>C: 检查并发送
  C->>H: 可靠session.send
  H->>P: 新依赖先创建再条件保存入口
  P-->>R: 有界范围变化
  R->>P: 读取并验证完整候选
  alt 当前有草稿
    R-->>U: 保留旧页并提示新版
    U->>R: 明确查看新版
  else 当前无草稿
    R-->>U: 自动更新并恢复有效浏览状态
  end
  U->>R: 关闭视图
  Note over R,H: 释放页面和读取，不取消已受理执行或消费等待
  U->>R: 从项目重新打开
  R->>P: 重新核对身份与权限
```

工作台关闭后，普通已受理执行继续沿产品内核生命周期，调试入口仍遵循最后调试宿主退出时的受管停机规则；不承诺跨宿主退出持续运行。图等待用既有GraphWait／checkpoint，用户新session.send经原resume映射接续；不用report.ready唤醒，不新增会话类型。首批生产科研图无需存在，等待机制验收复用固定registered图，仅替换外部模型。

### UI与文件／符号所有权

沿UI设计的中间tab、当前选择与显式附加、状态栏贡献，先更新设计分节再实施。报告工具栏提供当前版本、筛选／排序／展开和“加入当前指令”；待更新提示贴近报告，有草稿时保留页面。来源打开走共同资源入口，错误可区分载入／动作／发送／执行／保存／刷新。只使用语义token，新增token同时映射浅深主题，不改变三区或dock/overlay。

| 未来文件变化 | 本change拥有的符号／职责 |
| --- | --- |
| 新protocol/report-contracts.ts及导出、派生业务映射 | 清单、快照、resources.report与桥消息schema；由本线维护，类型／校验同源 |
| protocol/resources.ts、editor/resource-access.ts | HTML条件保存、报告清单及声明来源的实际授权复查；图片格式由材料change拥有，不复制 |
| 新editor/report-resources.ts | 依赖路径／身份核对、有界完整快照，消费原项目／库端口；不是新存储权威 |
| kernel/manual.ts及architecture.json | 注册resources.report和必要消费范围，保持ManualApplication无需harness；生成映射从schema生成 |
| 新workbench/reports/ReportView.tsx、report-frame.ts、report-drafts.ts | 隔离加载、受限桥、版本更新与窗口草稿，集中为一个module内部实现 |
| workbench/ResourceView.tsx、resource-controller.ts、tab-state.ts | 明确报告视图分派与目标模式；不替换普通HTML阅读；不依赖材料change |
| workbench/context-contributions.tsx、business-session.tsx、session.ts、Workbench.tsx | 仅原子批量附加符号、WorkbenchSession类型及provider接线；复用原草稿、pending、回执及session.send，禁止私有report发送 |
| kernel/application.ts的executionResources／contextResources、harness/instruction-context.ts | 仅实际报告来源授权的接线与模型前复查，必要补充沿公共增量独立验收；不改Graph、委派或执行生命周期 |
| renderer/index.html及必要宿主安全入口 | 父frame-src与报告navigation限制，保留其他真实视图安全；Electron main仅在实测需要时补窄导航拒绝，不能靠Electron单独保证浏览器 |
| tests/kernel/resource-access.spec.ts、resource-identity.spec.ts、context-contributions.spec.ts | HTML保存与强依据、清单／来源授权、原子附加边界；新report模块测试仅覆盖现有测试不具备的有价值行为 |
| 新tests/ui/interactive-reports.spec.ts及固定合成报告夹具 | 双宿主真实页面、composer、harness、保存刷新与攻击样本；不新增产品业务图 |
| docs/ui-design/README.md、docs/development.md、docs/initial-spec/workbench.md | 报告内部视图、诊断入口及初设转正式契约链接；本轮不修改这些文件 |

根路径同项目既有目录。正式实施时公共HTML保存与批量附加增量先独立验证，不能依赖本树私有报告代码才能使用；共享Workbench只通过既有tab分派和少量符号接入，不重写骨架。两个change的资源文件分区写入，按实际接入顺序整合，不互相设强制依赖。

## 验证与风险

1. 独立module：清单资源的稳定身份／版本、缺失／越界、并发变化／撤权、来源read/send、过量消息和旧port。依赖adapter可替换，只证明本模块，不替代项目保存。
2. 内核沿真实ManualApplication／ResourceAccess／projects/library验证HTML条件保存和读取授权；扩展resource-access、resource-identity，不重建创建回执测试矩阵。新报告清单／快照分片覆盖的是稳定接口，不锁定内部调用顺序。
3. I5由本线主Agent负责，真实报告→共同composer→真实harness worker→真实文件保存→有界刷新→关闭重开；模型用现有受控HTTP。固定文献对比样本直接核对人工定义的筛选／排序对象集合和保存后正文，不以实现输出作唯一oracle。
4. 双宿主均核对有草稿/无草稿、来源撤权、迟到候选、失效对象、关闭重开、发送未知及保存关联unknown。安全样本包含fetch/XHR/WebSocket、外部图片／CSS／字体、form、location导航、popup、frame、worker、原型污染载荷和跨代消息；使用受控网络陷阱证明无请求而非只查DOM属性。
5. 固定图只验无工作台等待和session.send接续；沿既有registered-context，不要求科研线开放真实综合图。关窗与调试内核退出分别验证，不宣称完整科研质量。
6. 未来运行入口为已安装Playwright CLI的kernel相关文件及`playwright.ui.config.ts tests/ui/interactive-reports.spec.ts tests/ui/context-bridge.spec.ts tests/ui/resource-opening.spec.ts`；UI预留端口5643、`/tmp/scholoom-reports-*`配置／库／项目／输出，启动前核对占用，只收尾本轮进程。避免根test:ui触发安装。
7. 协议生成自检、受影响类型、架构与宿主构建；共享HTML加载／父CSP变化另回归现有writing-editor与PDF读取，诊断既有PDF失败不放宽超时。初始规划只做OpenSpec／diff验证；第四轮独立模块的实际检查见本change delivery，不能算生产报告链路通过。

无需新依赖或数据库迁移。多文件候选、浏览状态兼容及iframe网络／CPU边界是实际验收重点；未通过则保留受阻能力，不能把页面可显示等同隔离或科研质量通过。

## 待办边界

联网报告、库／全局报告的新建保存权威、任意一步执行按钮、程序计算、用户自定义Graph、自动研究质量判断、跨版本精确定位均不属于本change。生态／材料写回结果不是本首批报告前置，后续动作若依赖它们需另核对正式契约。真实Windows／macOS及三平台分发结果单独记录，macOS当前受管执行不可用契约保持。

## 第二阶段接口交接与下一批范围

### 第八轮：委派报告来源（8a2f0ce）

主线已合入并验收普通根报告、真实M2及旧摘录／save／undo授权保护。本轮仅1.2b.2a：写集为`harness/delegations.ts::checkReadable/resources`、`runtime.ts::checkReportContext/recordReportUse/instructionEvidence`及子模型evidence／confirm、`kernel/application.ts`及`manual.ts`报告hook，和所属测试。无协议DTO或存储表变更，无UI／iframe／页面运行；不改父子调度、工具白名单、FileEdit、TaskPort或其他根工具。

调用链为共同报告describe／read → ReportResources有界入口及清单 → 宿主报告hook → Harness核对实际executionFacts → Delegations.checkReadable逐一核入口／依赖／声明来源ref及basis。checkReadable只使用原workPackage.materials、实际artifacts和outputs.save的同一个可读集合，原resources.describe/read/document改调该方法；取消、失活子身份仍拒绝。报告清单不扩大该集合，父有权不等于子有权。整批核对先于来源／依赖正文读取，最后授权核对也复用此方法。

成功完整snapshot才经原recordReportUse保存实际核准的ResourceEvidence。原session instruction-resource-context继续用于父和重启复查；同一仓储／序列化方法增加按session＋childInstance的使用记录键，子模型只合并本实例的报告使用事实，不消费父的全部Evidence。该记录不是可读集合，也不复制委派材料表；每次使用及准入仍向Delegations唯一规则核查。原delegation.reads只记录原资源工具实际read／document结果，不把来源describe或声明当作子阅读全文。

子模型异步授权读取本工作包、实际reads及本实例报告Evidence，复查真实库read/send、项目授权及原basis语义；排队后的最终同步confirm读取最新同一记录，先检查活动子／唯一可读范围，再经原resources.check复核全部来源。父仍沿原session记录独立准入。重启不重放子工作包、不复活旧context；持久session来源仍阻止撤权后的新模型请求，实例使用事实留作原记录核查。目标报告和旧报告版本仍不可用，不用当前普通HTML替换旧版本来源。

最小验收复用独立手写报告与外部模型loopback夹具：真实父子worker／库／broker／文件，全部Evidence获准才取用，漏来源／旧basis在展开前拒绝；撤权分别放在后续模型队列与最终同步边界，重启仍拒绝并保持实际read记录。普通委派、根报告、旧历史／目标拒绝回归；先构建再测试，不重复无改动UI，不给unknown／停止／容量或平台时限加例外。跨域语义不明时保留受阻分支并交回，不据CLI完成关闭整change。

### 第六轮接入：1.1b／1.2b写集和验收

共同源码为4b13183，已包含manifest／codec／ReportResources及两项边界修复；不再等待公共同步。本轮公开`resources.report`，身份仍为`{ref,basis}`，返回原ReportSnapshot，不增加ResourceRef类别。写集为protocol的resources／index及生成映射、editor的node导出和ResourceAccess项目HTML条件保存、architecture中报告操作、kernel的manual／application报告装配，以及harness/runtime中仅报告来源记录符号。保留既有构造参数、工具、来源记录与所有领域恢复。

ReportResources的生产Adapter复用原ResourceAccess的有界describe／read；这些内部读取经可信editor领域端口，外部入口统一检查报告，避免递归装配。实际`resources.describe/read/document/report`及Agent原`files.read/readBytes`在交付内容前核对入口和声明来源；普通HTML仍只读快照，不执行页面。人工仅要求所属read，执行仍沿原项目及库read/send；跨项目声明来源按原targetRead范围，不扩大写权。项目HTML沿原256KiB、strong basis及expectedFileId条件保存，库及target不增加write。

报告读取成功后，将入口、依赖及声明来源的真实ResourceEvidence记入原instruction-resource-context，并复用现有库／跨项目使用记录。模型异步准入会重新describe报告，最后同步check检查刚核对的全部来源；指令受理阶段的报告来源也进入该次端口的同步复查。旧会话、排队及重启继续从原持久记录核对read/send，不增第二份来源表。声明来源不等于未声明粘贴内容的完整溯源，跨文件变化仍明确拒绝而非承诺事务。

验收分别记录独立codec／module、真实Manual保存及权限、真实Kernel来源撤权与重启／最后准入、双宿主最小回归。外部模型可受控，内部broker／仓储／文件及worker真实；模块替身不计生产验收。1.1b／1.2b只勾实际完成子项；本轮不启用iframe／MessagePort、ReportView、发布或2.x／3.x，不将机械资源通过写成I5。

独立审查发现尚缺委派展开授权seam：`DelegationManager.resources`只核对外层材料，内部readable规则未公开；子模型confirm仅消费工作包和reads，并不消费session的instructionEvidence。不能复制该私有白名单或把父会话已读视作子授权。本轮以真实executionFacts核对普通根执行；委派及不能证明根身份的报告读取返回unavailable，发生在展开来源之前。需要主线审查的最小增量是将原readable提取为同一个可调用检查，报告Adapter逐项核对实际展开集合，并把该实例的展开依据交现有子模型最终check；不改变工具白名单或新增科研角色。

`project.readTarget`自行读文件，不能靠files.read守卫覆盖。它现已在原授权范围内有界核查HTML头部，识别报告则unavailable；普通跨项目HTML仍可只读。目标报告是否允许沿原会话分别取得声明库／其他项目来源权限尚无定案：保持当前targetRead单目标限制，或明确增加报告声明来源的独立授权组合。此选择不能由本线移除targetRead或扩大权限代替。本轮不交付目标报告／委派报告可读，1.2b的相应子项保持开放。

旧报告也可能从原read_file_edit／files.history取得整段HTML，而当前basis不能证明旧清单。kernel的历史消费者识别HTML记录任一正文的约定头部（含BOM）后返回unavailable；files.changes摘要及普通材料历史保持原路径，不改FileEdit存储。历史版本来源读取须另审查使用原beforeEvidence／afterEvidence与实际保留正文的Adapter；不以当前源码ref解释旧报告，也不新建历史身份或存储。此入口只读保护纳入本轮写集，旧报告历史正文可读仍列1.2b.2。

主线本轮正式交接`/tmp/scholoom-phase2-handoff-VZS5mS/manifest.json`所列快照，材料／报告两份design已作为六线可读输入，接口不再因“未收到设计”整体等待。材料同源位置／region／对象草稿字段和资源叶抽取的具体文件及补丁顺序见`../add-material-annotation-interactions/design.md`“主线第二阶段交接与公共增量”；这里继续拥有报告清单、隔离及更新，不与材料change合并。生态`zotero-ecosystem/openspec/changes/connect-zotero-host-bbt/investigation.md:69–74`也明确报告运行不依赖Reader写回；本次接收该调查不能宣称ReportResources已实现。

| 下一批可独立准备／实施任务 | 是否等待新增公共基线及验收限制 |
| --- | --- |
| 1.1的清单／snapshot／桥schema及有界头部codec | 不依赖材料位置字段、库修订或任务业务；以原ResourceRef/Evidence为唯一身份源。可独立建立report-contracts及解析回归，不注册resources.report、不扩展全局ResourceRef。公开操作及导出接点先接受主线审查 |
| 1.2的ReportResources深模块 | 仅注入当前资源describe/read及路径解析窄端口；完整清单、path与ref对应、basis一致、来源read/send及容量／撤权由模块测试。无需先接Workbench/harness；替身不证明生产取材和模型准入已接通。生产组合依赖1.1及经审查的资源／授权公共增量 |
| 2.1的report-frame隔离模块 | 可用独立合成HTML、DOMParser及MessagePort验证清单资源重写、旧generation／过量消息、关闭释放；不等待材料change。安全测试使用受控网络陷阱；父frame-src与Electron导航的实际宿主保证必须另对接，模块夹具通过不能代表产品无网络 |
| HTML条件保存公共增量 | 沿原ResourceAccess只给项目HTML增加write，仍限制256KiB、expectedFileId和strong basis，库及跨项目目标只读。需要先审查资源叶模块上的准确符号及真实资源保存回归；不能为ReportResources夹带复制projects私有源码 |
| 原子appendContextItems公共增量 | 沿现有会话一次校验与合并，保留16项／64KiB、pending及迟到回执保护；既有单项附加委托同一实现。列context-contributions、session、business-session及Workbench provider精确符号，审查后再接报告2.2，不增加私有发送通道 |
| 声明来源的执行／模型前复查、父CSP及实际tab入口 | 需要公共审查和最终schema接入，分别核对kernel装配、harness/instruction-context、renderer父策略、ResourceView／tab联合。与其他线按符号合并，不能在U1修复同时大改这些位置 |

第二阶段建议先准备前3项；第四轮只实施前2项模块，不展开2.1隔离夹具。后续按公共增量接入顺序完成生产组合和原任务2.2–4.2。图等待仍沿已有registered-context，无需新的科研Graph或第八条editor线；资源读取与模型外发复查不能由页面清单授权替代。

第二阶段仅复核设计及公共触点；第四轮用户已直接授权以下两个模块子范围，不再等待材料位置字段、额外公共同步或重复实施授权。

### 第四轮有界实施文件与停止点

1. `packages/protocol/src/report-contracts.ts`集中manifest、snapshot及带version/viewId/generation/basis的桥消息schema、FromSchema类型、容量与跨字段校验。`packages/editor/src/report-codec.ts`实现约定起始注释的有界解码及Unicode转义编码，不解析HTML正文。新增protocol的`./reports`叶导出只供模块消费，并在architecture的editor允许依赖中列该准确路径；不加入根聚合或操作映射，不注册resources.report。
2. `packages/editor/src/report-resources.ts::ReportResources.snapshot`仅注入既有ResourcePort的describe/read及`authorize(evidence, 'read'|'send')`窄端口。入口／依赖沿共同base64分片，重用relativeFile做项目内相对解析；path解析、私有目录及真实链接范围最终仍由describe所属领域保证，模块不读取nativePath、不复制项目私有策略。完整快照发布前后核对入口、每项依赖／来源ref/basis、path→ref同一对象与read/send，拒绝混合版本和报告来源递归。返回原`{resource,manifest}`，不新建DTO或缓存权威。
3. `tests/kernel/report-resources.spec.ts`以独立手写头部和固定描述／字节adapter验证codec、来源read/send、路径／身份、前后依据、容量和撤权，注入端口并发不超过4；单个依赖8MiB、入口256KiB、入口及依赖总32MiB。来源只读取识别是否另一个报告所需的HTML前缀，不读取整本来源。资源mediaType仅沿已采纳字体／栅格／CSS／JS／JSON类别，HTML／SVG依赖拒绝；不承诺字节内容或脚本安全已验收。

桥state/restore的browse、draft保留JSON展示数据，其业务内部形状由报告页面掌握，整个消息64KiB；select只允许清单objectIds与4096 UTF-16 request。schema本身不启用消息端口、限速、原子附加或页面执行。来源非报告检查只识别已约定起始头部，不遍历引用图。

本轮不导出editor/node生产入口、不注册resources.report、不改ResourceAccess的HTML写权限／来源准入、不接Workbench／composer／iframe／CSP／导航。相应公开根导出、真实授权Adapter、实际保存及模型前复查仍需主线审核接入，模块替身不证明这些条件。最小验证为先shared构建，再protocol/editor/tools类型、架构、生成器一致性及上述模块回归；不改UI不重复双宿主。本change真实执行后才创建delivery。
