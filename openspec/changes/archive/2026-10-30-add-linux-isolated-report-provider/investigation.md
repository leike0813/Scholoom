# 调查依据

## 1.2固定native真实校准（7aff2c76，2026-10-28）

起点HEAD=`7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`且clean，已读AGENTS、原工件、主线第十五轮安排及当前apply。1.1已获主线审定，本轮只执行1.2；仓库没有production protocol／platform／admission／UI／浏览器改动。独立证据根为`/home/joshua/.cache/scholoom-linux-isolation-calibration-r16-RqczuM/`，所有编译命令TMPDIR同根或对应子根，不依赖现有/tmp内容。

### 机制、固定输入与观察

真实工具为x86_64／uid1000、systemd259.5用户manager、bwrap0.11.1、cc15.2.0。`prerequisites.json`及各原生preflight核当前工具／权限；每个自有scope先实读cpu.max=`20000 100000`、memory.max=`67108864`、memory.swap.max=`0`、pids.max=`16`，外部控制端另读。没有手改系统委托、提权安装或重跑CPU／OOM负载。

`payload.c`是固定、无libc的x86_64静态程序，构建检查ELF machine62、无PT_INTERP／PT_DYNAMIC，只有本轮`/probe`、只读批准字节与必要私有位置映射；不绑定/usr、HOME、profile、库或内核连接。`filter.c`以原生classic BPF编译，检查AUDIT_ARCH_X86_64，默认EACCES(13)；x32编号亦不命中白名单。只允许固定样本及可信bwrap reaper必要调用：read仅0／3，write仅1／2，openat仅AT_FDCWD及只读flags，另有getpid、close、fork、setsid、pause、退出／信号返回／execve及最终补入的wait4。无filter对照只触及自有127.0.0.1／::1／pathname socket，不外联。

FD槽位过滤不识别资源对象；批准字节和能力范围依赖固定只读视图、初始close_range及可信stdio。safe进入时外部实际清点仅0／1／2；故意保留259的filter-exposed只检验过滤层，不冒充正确FD门。所有原生程序／数据／controller是调查样本，不能用它们替代生产领域授权、通用策略或浏览器。

| 独立输入／结果位置 | 实际结果和支持范围 |
| --- | --- |
| 根目录`{filter.c,payload.c,supervisor.c,calibrate.mjs,first.log,first-result.json}` | 无filter危险控制完成，批准内容可读、SCM实际收到1个FD并读得`late-owned-decoy-r16`；自有TCP4／TCP6／Unix各accept1、UDP收到1。首过滤组未出现payload ready，bwrap报init wait() Permission denied；不是样本动作拒绝 |
| `after-wait4/{filter.c,calibrate.mjs,final.log,first-result.json}` | 唯一策略增量允许wait4（43→45条BPF）；本机bwrap导入wait／waitpid，libc反汇编指向wait4，原材料保留。未重复危险控制。filter-exposed与safe真实进入，Seccomp=2／filters=1／NNP=1，读得`approved-r16-v1`，所有下列危险调用实际返回-13，两者正常退出0，四项端点计数均0 |
| 同一after-wait4的controller-loss | 三代ready后观察器把/proc/PID/exe的视图内`/probe`与宿主路径比较，0!=3；尚未发送预定SIGKILL。该轮仅是观察失败后明确stop清理，不算controller失联通过 |
| `loss-only/{calibrate.mjs,final.log,first-result.json}` | 仅用实际二进制dev／ino修正观察，策略／原生样本未改；不重跑已绿syscall组。分别SIGKILL自有controller3152991、独立宿主3153084。各目标scope在动作前实有六成员，含三代payload和setsid；宿主场景独立controller记录parent-lost并收尾。三unit在兜底cleanup前已inactive／not-found，没有额外stop |
| `identity-reader.mjs`及loss-only gate／host-intent记录 | 原生端在建payload前写armed记录、file fsync／rename／directory fsync；含bootId、unit InvocationID、cgroup dev／ino、私有根身份及controller PID／birth。新Node进程在活动期能matched-live；篡改InvocationID返回unknown且无停止。失联后也返回unknown，不将范围消失当成停止授权／容量回收 |
| `check-evidence.mjs`、`evidence-check-final.log`、`conditions-matrix.json` | 对三个原始结果固定预期作一致性核对；另外只读查13个动作前已登记成员的出生身份均已消失／不再匹配、八个unit均inactive且八条已知cgroup路径不存在。没有重跑native，不凭根PID一项结清 |

实际被过滤的请求是：AF_INET stream／dgram、AF_INET6 stream、AF_UNIX stream、recvmsg(259)、read(259)、unshare、setns、mount、ptrace、pidfd_getfd、io_uring_setup、open_by_handle_at、bpf、getppid和getpriority。部分控制本就失败（例如unshare／mount为EPERM）；不能说它们先前有权成功。修正策略后这些请求一律实际EACCES，且已安装过滤器的实际状态及BPF默认分支相符。socket失败后的connect／sendto与没有收到FD后的读取均标attempted=false；不是对这些后续动作的独立拒绝证据。

### 因果、回执与停止证据的限制

- SCM在payload已经exec并发出ready之后才入队，证明过滤对进入后的新到FD消息有效；实际顺序是持久写`gateReleased:true`→入队SCM→发送动作G，**没有实测G后才到达的消息**。G只是固定样本的动作控制，不是生产启动协议。临时回执中的gateReleased实际记录放行意图，不能当已发送或已执行确认；写后崩溃窗口仍需unknown，未来2.4必须区分请求／确认，不能照搬临时字段。
- probe的armed身份核查发生在G前；loss-only身份读取发生在三代ready后、SIGKILL前，不能统称所有读取都在gate前。身份读取器只做核对，没有生产停止／接管授权或admission连接。
- `emptyObserved:true`观察器接受populated0或目录ENOENT，没有保存两者各自的原始事件文本；不能声称单独留存了empty事件。支持本次收尾的组合是动作前完整成员及出生身份、已观察空／消失、cleanup前unit终态、已知目录消失和额外只读PID核查。它只覆盖本固定程序及登记范围，不证明任意浏览器组外服务。
- parent失联候选为原生PDEATHSIG＋独立controller及bwrap PID namespace收尾；等待用屏蔽信号后的ppoll消除waitpid与poll间失联通知竞态。没有把bwrap参数本身当保证，实际两种SIGKILL场景成立。未测任意时点崩溃／记录损坏／系统重启／其他Linux部署条件，不实现生产unknown恢复或容量释放。

首次真实失败与观察失败均原位保全；首个单独supervisor编译有两处缩进warning，执行前分行补正，实际三阶段编译均-Werror通过、stderr为空。本轮无EDQUOT或依赖安装。重复构建只针对独立cache样本，不改／重建同树产品产物。`rebuild.sh`可复制三阶段原始源码到新的cache根重建，明确保留两次失败；仅bash -n验过，未执行整轮回放。

独立只读审查认可上述本机固定native窄结论，并要求分列FD槽位／资源权威、SCM与回执真实时序、范围观察／只读reader权限；本节已采纳。源代码／原始结果不作事后重写，细节在cache的independent-review.md。本轮支持1.2的固定native校准，不声明生产策略可用、2.x交付、活动报告／完整网络应用或科研质量通过；没有浏览器、外部DNS协议、Windows／Mac或真实领域授权实跑。

## 规划轮事实与复用选择（58eda140）

2026-10-28起点`58eda1404fcc60036ce0e0f3ce30d5453ce1ee30`、工作区clean、无`.codegraph/`。`openspec list --json`核repo-local根，13个已有change没有同名／等价独立提供者；已读正式platform-access、module-runtime、kernel-lifecycle及原报告delta，创建本change使用scholoom-dev。新工件／校验根为`/home/joshua/.cache/scholoom-linux-provider-plan-round15-7V4Vot/`，命令显式TMPDIR同根。当前仅静态复核及规划，没有运行新native或生产路径。

### 本树代码事实

| 事实源 | 当前行为及可复用职责 | 本change需要补足 |
| --- | --- | --- |
| `packages/editor/src/report-resources.ts::ReportResources.snapshot`及`apps/kernel/src/manual.ts::reportResources/reportSnapshot` | 已沿真实describe／read／authorize核入口、依赖、来源、ref／basis、path-ref及前后授权；返回`{resource,manifest}`，内部读取的依赖字节被丢弃 | 不存在可交付platform的冻结字节包；必须在所属端口按原basis重新取字节并前后核对。平台不从ref／路径自行读库或复制权限 |
| `packages/protocol/src/report-contracts.ts::reportLimits`、`core.ts::limits` | 报告入口256KiB、依赖8MiB、加载集32MiB、依赖32项；公共frameBytes为2MiB | 32MiB整包不能塞进单帧。design建议按原instanceId分阶段、有界分片准备并封存，不能新增reportId或扩大frame限额 |
| `packages/platform/src/admission.ts::ProcessAdmission` | 同一宿主实例共享的reserve／ready／retainUntil／release；拒绝停止确认保留容量，retainUnknown按instanceId去重且可在满额恢复占用 | 无解除recovered集合的接口；新提供者恢复确认不能另维护一份容量表。最小公共签名在design提交主线 |
| `apps/kernel/src/manual.ts:221,271,293`、`application.ts` | 一个应用实例的this.processes注入ManagedCommands、harness及原生消费者；broker绑定可信上下文与平台命令 | 新提供者复用同一实例，在宿主初始化准入前核查自身遗留；不是每个报告／模块new ProcessAdmission |
| `packages/platform/src/processes.ts::ManagedNode`及`process-controller.ts` | 活动child handle＋instanceId核身份；controller独立响应停止；未收stopped即outcomeUnknown，reservation.retainUntil(stopped) | Node bootstrap及原生后代监督不是任意浏览器的网络／文件／配额隔离门。不能把fork已发生解释为目标受限代码已可执行 |
| `packages/platform/native/process-scope.c` | 正确路径是platform/native，Linux subreaper收养并清理后代，Windows Job仅KILL_ON_JOB_CLOSE；已有原生控制通道与退出确认 | 不提供网络namespace、CPU/memory/pids实际配额、系统调用策略或systemd重启范围凭据。现有worker内部FD不能直接暴露给不可信样本 |
| `packages/platform/src/command.ts::runCommand` | 原reservation贯穿controller，排队后授权，started／exited／stopped分开；finally完整stop，原环境会保留HOME等 | 复用监督契约及诊断，不调用它来继承环境运行不可信报告；不增加普通commands的全局隔离开关 |
| `apps/kernel/src/host-connection.ts::initialize/retainUnknownScope/save` | 启动前读私有监督记录，停止回执保存成功后才resolve；旧PID或连接断开不授予接管权 | 复用记录次序／恢复原则，不复用插件DTO或复制插件权威。当前没有通用隔离范围恢复服务 |
| `packages/platform/src/private-files.ts`、`build-process-scope.mjs`、`architecture.json` | 私有目录／原子临时文件、已有C构建和平台系统访问守卫可复用；atomicPrivateFile对文件sync后rename | 不能据此假定目录项已抗崩溃持久化；新范围intent需同目录身份核对及目录同步的可验证保证，失败不spawn |

只读辅助核对调用链及既有测试；主会话补读正确native路径。两次探索中猜测的execution-processes／execution-persistence规格和docs/architecture-policy.json不存在，已改用实际platform-access／kernel-lifecycle和根architecture.json；不存在路径没有成为依赖或“已读”证据。

```mermaid
flowchart LR
  M[ManualApplication 共享ProcessAdmission] --> C[ManagedCommands]
  C --> R[runCommand 授权与观察]
  R --> N[ManagedNode]
  N --> P[process-controller]
  P --> S[原process-scope 后代归属]
  A[资源权威及来源授权] --> RR[ReportResources.snapshot]
  RR --> SNAP[返回描述与清单 不保留字节]
  RR -. 尚无冻结字节交付 .-> GAP[隔离提供者缺口]
```

图中实线为现有调用，虚线为缺失路径；普通命令与ReportResources目前没有隔离承载连接。

### 复用的原生证据与时效

以下是已被主线接收的真实本机有限样本，本轮仅读取JSON／源码，没有重跑：

| 精确cache入口 | 已证事实及保留反例 |
| --- | --- |
| `/home/joshua/.cache/scholoom-report-platform-round12-fNGQLv/{scope-probe.c,native-mechanisms.c,scope-result.json,namespace-result.json,native-result.json,network-final-result.json}` | systemd259.5／bwrap0.11.1、uid1000；独立普通user scope读回20%CPU／64MiB／swap0／16tasks；显式namespace及实际CPU节流、OOM／pids拒绝、多代停止。首轮TCP只计data缺口保留，后仅补accept／失败结果核查；只证自有loopback目标，没有外部DNS／浏览器结论 |
| `/home/joshua/.cache/scholoom-report-files-round13-Wfc0WT/{file-probe.c,file-launcher.c,file-calibration.mjs,file-first-result.json,file-conditions-matrix.json}` | 隐藏路径仍可经继承文件／目录FD读取；已连接Unix／TCP与只读pathname socket保留宿主代理；cgroup写FD可迁入另一自有限额scope。netns／ro／NNP不撤销已持权威 |
| `/home/joshua/.cache/scholoom-report-gate-round14-DocB5o/{gate-launcher.c,gate-payload.c,gate-calibration.mjs,gate-first-result.json,gate-conditions-matrix.json,independent-review.md}` | 高256／1024及SCM危险控制成立；关闭后实际EBADF，可信stdio实际ENOTSOCK；误暴露2能传入迁移FD，另以启动exit77拒绝配置。类型／身份门拒绝特殊文件及替代inode。unsafe直接先迁移，SCM跨组依据用独立stdio-leak。原cgroupExists默认值缺口以六条原preflight路径只读补核，不篡改首轮结果 |

原EDQUOT、编译warning和观察缺口均由原报告[investigation](../../add-interactive-research-reports/investigation.md)／[delivery](../../add-interactive-research-reports/delivery.md)维护，不重建另一份原生账本。本轮不把历史“原生轮退出0”提升为生产安全、重启或完整浏览器通过。cache是接续输入；现有/tmp内容不在必要输入集合。

## 规划轮未证保证与承接（本轮进展见首节）

规划轮没有新增实验。以下记录当时阻断相应保证／分支的未知项，1.2的实际窄校准见首节，其余不能由规划文件或模块替身闭合：

| 阻断 | 已有反例／缺证 | 最小下一校准与停止条件 |
| --- | --- | --- |
| 完整网络／迟到能力／syscall策略 | 没有全面deny策略；nested unshare的EPERM未确定提供者，继承和pathname代理反例已证 | 主线审首个原生程序策略后，以真实seccomp／namespace和自有端点核socket、SCM、namespace／mount／进程与句柄旁路；策略或架构不受支持立即unavailable。不泛化到浏览器 |
| 完整范围身份与控制器失联 | 临时systemd样本没有持久intent／unit InvocationID／boot及遗留核查闭环 | 故障注入精确卡在intent、scope建立、gate及stopped落盘，真实kill自有controller，重启只核原范围；不匹配／缺证保持unknown，不杀复用PID／unit，不释放容量 |
| 统一恢复占用结清 | retainUnknown没有结清方法，且旧live停止promise可能已拒绝 | 先审design最小settleRecovered签名；新提供者unknown用仍待确认的内部stopped promise保留live租约，恢复后只由确认回执结清。分别验证满额、重复和持久化失败 |
| 冻结字节及内容版本 | snapshot不交字节；dev／ino仅文件身份 | ReportResources所属端口按原basis取完整分片、前后核权；封存后交只读字节。替换同inode内容、撤权及中途变更必须拒绝。该领域消费者另片接入，本模块可替换批准字节提供者 |
| 浏览器完整进程图／运行时 | 没有批准的分发程序／策略、子进程清单或呈现方案 | 浏览器、network／GPU／utility／crash等全部受同范围、配额／网络和停止后才能注册其策略为available；本change原生验收不满足此条件，保持报告unavailable |

另外静态发现`manual.ts::ProgramRuns.retainUnknown`目前用独立Set及有空位时匿名永久reservation，不同于HostConnection的retainUnknown；该旧消费者不在本change修复写集。提交主线核对，提供者不能借用该回调作为恢复权威，也不覆盖programs／v6／TaskPort的现有装配。

主线已接收独立platform深模块、六操作及共享准入恢复的接口方向，决定见design第1节；普通ManagedCommands权限保持原契约。下一片先校准native策略／失联恢复，领域冻结字节和浏览器注册分别依赖其真正提供者。未知不阻止写出规划，但阻止相应任务进入生产可用。

## 规划轮结论与承接

采用已定Linux普通权限方向；规划轮只形成实施所需工件，没有新生产接线、模型、库、UI／浏览器或OS实跑。目标Windows／Mac及浏览器分发／呈现决策保持开放，原报告6/13、2.1b／I5不变。规划轮CI只消费共同计划第十四轮已有回执：f4ab1e5／40622631905的Linux758通过1失败26跳过（显示预检127，业务未进入）、Windows688通过53失败44跳过，Mac人工入口／UI等job成功；这些不证明隔离提供者。规划轮未查询／等待／触发CI或重建已验产物；本轮真实native结果按首节，不覆盖旧回执。

design列明确签名、所有权及独立验收；接口审查已完成，tasks下一片只推进1.2真正OS前置校准，后实施机制／恢复。验收不能用未执行项或模拟OS关闭保证；规划轮没有创建delivery，后续按实际执行记录。
