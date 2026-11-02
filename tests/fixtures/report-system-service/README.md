# K／C／M 安装与运行验收

本入口运行原 `ReportControlClient`、唯一 `ProcessAdmission`、独立非 root C 的原 provider／records／冻结对象，以及 root M 的固定系统启动、P／G、原范围停止和清理。材料是固定合成字节；默认程序为原 `isolated-report-native` 的 `normal` probe，`prepare.mjs --node`则冻结固定Node／JSON数据oracle。两者均不运行报告HTML、任意报告JS、浏览器或模型。各自成功只证明相应固定正常路径，不代替恢复故障矩阵、通用HTML／JS、正式ReportView或完整I5；旧native通过不能批准新Node包。

`prepare.mjs --report`另行准备正式`scholoom-interactive-report@1`：复用editor的`build-reports.mjs`，冻结真实bootstrap、相同八文件Node闭包以及WorkerDOM／parser／CSS依赖的许可、来源manifest和patch。程序和策略登记由`layout.mjs`同一函数生成，离线review及实际安装使用同一值；产品不会采纳native或fixed-node-t1登记。

通用P沿现有CPU20%、512MiB、32tasks与64KiB日志策略，PID1最长运行8小时；底层Node仍使用64MiB old-space。校准程序仍是20秒。安装后的有界验收只运行合成HTML，核classic、外部ESM相对导入、inline module及restore→state/select，在30秒观察期限内主动停止；每帧实际收到后发送consume，不先等待ready。只有持久停止确认及容量归零才写`bootstrap-passed.json`，不以长运行时限代替停止回执。该程序启动验收不含UI、真实来源授权、恶意脚本或完整I5。

普通账户先运行：

```sh
node --test tests/fixtures/report-system-service/check.mjs
node --test tests/fixtures/report-system-service/unit-check.mjs
node --experimental-test-module-mocks --test tests/fixtures/report-system-service/os-check.mjs
```

它在 `~/.cache/scholoom-report-system-service/` 构建独立包，包括当前 Node、原生程序、独立 C／M 入口、独立 K 验收入口和安装脚本；核固定账户／名称边界、普通 UID 的安装拒绝以及替代可执行路径后的 systemd unit 语法。所有准备及证据使用持久 cache，不依赖 `/tmp`。离线通过不代表 root 部署成功。

`check.mjs`分别准备native、固定Node和通用report三包，核对实际bootstrap／许可字节及固定登记。离线包不自动部署；通用包须在固定Node/data校准结果核对后独立安装，后续将原受保护`installed.json`写入隔离配置的`reports.installationFile`，才由正常boot接入产品。

`unit-check`直接消费生产动态单元生成器，经真实systemd解析普通路径及含空格、冒号、百分号、引号和反斜线的路径。OpenFile解析失败会被忽略且verify仍返回0，因此同时检查对应单元的解析诊断。`os-check`替换UID观察、文件和命令边界，保留真实OS适配器、采证请求及同源校验，覆盖完整start描述不能直接传给capture的回归；它不授予root权限，也不构成真实系统采证证据。

`prepare.mjs` 也可单独运行，最后一行是具体 `bundle.json`。同包 `review.json` 列固定安装路径和四份模板示意；实际 C UID／GID 由独立新账户分配。`node <包>/install.mjs <包>/bundle.json` 默认仅核批准文件并列计划。

## 固定Node包

`node tests/fixtures/report-system-service/prepare.mjs --node`生成独立Node冻结包，固定八目标为Node、解释器及六份动态库，安装复制到同一root-owned闭包目录；`bundle.json`保留固定字节摘要及runtime=node。C在原systemInputs封存并持有自身所有的两条FIFO，M经PID1具名FD交给原launcher；K/C的私有exchange传单行JSON，每帧64KiB、最多4帧，实际交换才核running及当前授权。可信封存阶段FSIZE为`max(256MiB, outputBytes)`，G后由可信gate降回原outputBytes再exec。

Node验收入口在实际running后，经原K/C发送一次`{"action":"probe"}`，核批准字节和JSON往返，再显式stop并等待原持久停止及容量归零。实际安装、原失败与限定通过结果见[交付记录](../../../openspec/changes/add-interactive-research-reports/delivery.md)，不将gate、普通UID launcher或FIFO模块证据当作跨账户验收。

## 安装与一次验收

只有带 `--apply` 的管理员调用会产生系统效果。用户已授权为当前 change 完成需要的账户、依赖及系统部署；执行仍需本机 sudo 认证。使用本机实际 Node 绝对路径，不假定 `/usr/bin/node` 存在：

```sh
sudo <当前 node 的绝对路径> <包>/install.mjs <包>/bundle.json --apply
```

安装为本包的随机 installation ID 创建一个新系统账户／私有组，无 home、无交互 shell；在唯一 `/opt/scholoom-report-<ID>/` 保存 root-owned 的新程序副本及固定配置，在 `/var/lib/scholoom-report-<ID>/records` 创建 C-owned 私有目录。C 用原 writer lock 和 `provisionEmpty` 生成真实 configId／空库存，root 安装者只接收这个身份，不创建或重写 C 的记录。

四份固定 socket／service template 安装到 `/etc/systemd/system/`；两个 socket 接受连接，服务由 PID1 按需启动，不 enable。PID1 负责在重启后再次显式启动 socket 时重建受保护的 `/run` socket 父目录。K／C 双方均核 socket 实际 owner、连接前后 inode 及内核 peer UID；C／M 角色分别核 caller UID。K、C 的 UID／GID 来自安装配置，P 每次独立 DynamicUser，实际账户及父范围配额必须采证。

M 使用宿主 cgroup 层级的只读视图 `ProtectControlGroups=yes`，按配置持有原生排他 writer lock 到断连及在途 OS 动作全部结束，不能由新连接并行接管。固定路径开放 C FIFO 和 root 管理元数据所需写入，M 不读写 C records 或计算名额。每报告的 service／独占保留父 slice、启动 marker、原父身份及排空后清理凭据都在 `/run/systemd/system`；清理凭据在同一 boot 保留，供重连核原对象，重启后以原 boot 变化另行核查。

安装完成后，脚本通过 `runuser` 降到原 K 账户，用已安装的受保护 Node 和 K 验收入口运行一次。真实材料准备发生在同一 K 名额取得后；C 持久化原输入及意图，M 原父对象先保存后才启动服务，原 scope 保存后才发 P，末次授权及 launchIntent 后才发 G。G ACK 不等于 exec，实际 native running 事件才进入运行状态。只有 M 确认原父范围空、C stopped 已持久保存后，K 才释放容量。

native／Node校准 P 的 PID1 runtime 上限 20 秒，K 观察期限 30 秒；执行一次，不自动重试。成功写独立 `t1-passed.json`并记录实际profile／边界，按包类型输出`Passed installed K/C/M fixed native positive path`或`Passed installed K/C/M fixed Node/data positive path`。通用包的运行上限及bootstrap回执见前文。K 的状态／授权／容量证据在用户 cache，安装命令／实际身份在 root 安装目录。失败保留账户、安装对象、原记录和日志，不自动删除或换身份再跑。runtime 到期、进程退出、cgroup 消失、请求超时都不单独算停止凭据。

原native正常路径通过后，`node tests/fixtures/report-system-service/recovery.mjs <原installed.json>`沿原真实账户和端点执行四个独立合成实例：首次ready授权复查处取消／撤权、K断线、K/C启动成功回执丢失后断线。真实scope已创建时挂起K授权，核未放行、原停止持久回执及容量；断线立即保留占用，待原C/M退出及完整库存恢复后才结清。不重新安装或改程序参数，不注入M/G回执丢失、执行后崩溃或落盘失败，不能替代完整T1。四例的已有通过属于原native安装，不作为新Node恢复证据。start请求计数仅覆盖初始连接；重连不重放另需核对应实现和系统证据。

通用包另用`node tests/fixtures/report-system-service/generic-recovery.mjs <原installed.json>`，先核受保护的正式登记、安装身份和bootstrap凭证。四例都在原程序实际running／gateReleased且页面ready后触发：显式停止、K撤权拒绝交换后显式停止、K断连重接、stop结果与release通知同时丢失后重接。最后一例不将已送达的release视为无效；只在所有停止确认均未送达时要求K保留占用。重接核完整库存中的原实例及持久停止，不重放prepare／start／stop。仅有合成无来源HTML和K授权替身，无UI或模型；原系统修复部署前只做离线入口检查，真实四例结果须另行记录。任何一例失败即停止并保留原范围及记录，不重试、换身份或重装。

## 原通用安装的安全验收入口

`node tests/fixtures/report-system-service/generic-recovery.mjs <原installed.json> --isolation`仅运行`network-rejection`与`busy-stop`；不带开关仍运行原四个恢复模式。入口复用受保护安装资格、原K/C/M、完整库存、唯一admission及prepare／start／exchange／stop，不新增系统账户或安装服务，不修改安装策略；实际P继续受原20% CPU、512MiB和8小时上限约束。须由父审查后与正式产品验收串行排队运行，当前只完成离线检查，尚无这两例的真实通过结果。

`network-rejection`使用无来源合成HTML，在真实登记P内分别尝试fetch、XHR、WebSocket，逐项捕获拒绝，经真实state核对三项结果并等待真实ready。目标仅为父测试自有`127.0.0.1`随机端口HTTP陷阱；每个API仅尝试一次，陷阱在TCP连接时只计数并立即断开，不读取请求或秘密。停止及关闭后仍须计数为0。这只证明实际登记P的页面能力拒绝，不代表原生seccomp完整矩阵。

`busy-stop`让合成classic脚本先请求发送entered state，再进入`while(true)`。桥写出经微任务排队，死循环可能阻止flush；入口记录entered是否实际收到，同时固定原scope的MainPID、InvocationID、ControlGroup、cgroup设备／inode和MainPID出生时间，保留三次`cpu.stat`，相邻样本各增长至少100ms CPU，且没有ready，以此证明原范围实际忙执行。40ms轮询只用于有界观察，不作为执行或停止凭证；无法读取原范围或身份改变立即失败。忙时仍经K/C/M取原实例running／gateReleased／未停止status，再显式停止原实例。

两例各用一个新instance，必须取得原持久`stopped／stopConfirmed=true／gateReleased=true`、active／waiting归零及原C/M退出才可通过。finally结清自有channel与networkserver，保留最终真实admission及停止状态；首失败保留原范围、记录和cache证据，不自动重试或删除，不以超时、根进程或cgroup消失冒充停止。不运行模型或UI，不向报告源注入K能力。证据仍在`~/.cache/scholoom-report-system-service/generic-recovery-*/<模式>.json`，不另写安装通过凭证。

## 生命周期与移除

`repair.mjs`的固定`purpose: "network-adapters"`用于已通过initial-restore的同一通用安装，只更换program.bin，保留原inode、配置、service、账户、单元及所有旧凭据。计划额外绑定initial-restore通过凭据，使用独立network-adapters备份、日志与通过标记，不重入原程序更新。管理员替换前仍由K核原完整库存零占用；替换后依次运行原bootstrap、初始恢复、冻结的`verify-isolation.mjs --isolation`，全部停止确认及容量归零后才写新标记。失败保留原现场，不自动回滚或重试。具体冻结包、摘要与手动sudo入口沿change的delivery，包准备和离线核对不算系统运行通过。

外层verifier预算从同源协议的open／prepare／start／stop／close及本夹具30秒观察阶段累加，库存170秒、bootstrap320秒、两例隔离640秒；普通系统小命令仍45秒。完整库存可以先于历史后清理完成，必须继续等待原close ACK；`generic-recovery.mjs`的库存与关闭也使用原75秒契约。

`--resume-before-replace`仅处理原network-adapters的首次库存verifier ETIMEDOUT。它核原程序、service、配置及凭据未变，backup／staged／更新计划／成功标记均缺，原root日志只有固定成功前置及该次超时，原verifier摘要匹配；保留旧日志并独占新增resume日志。随后重新核只读库存及关闭再继续原更新。其它错误、已进入更换阶段或曾续执行过均不能使用此入口；不自动重试。检查器`node tests/fixtures/report-system-service/check-repair-resume.mjs`覆盖合法前置和六种拒绝场景。

普通客户端断开不代表停止确认。C 仍按原记录停止并落盘，M 封住许可并排空在途调用；unknown 保留原容量及可诊断对象。已完成范围只按原 inode／实际文本清理自己的动态单元，先保存原父范围排空凭据，再停止空 slice。部分清理中断可按原凭据继续，不能用接替父范围确认旧执行。

本夹具不自动卸载服务、账户或原记录。移除时须先通过原 C 完整库存及关闭 ACK 确认没有 unknown／活动执行，再核 installation receipt 中的四个精确静态单元、socket、程序目录和账户。原记录及验收证据须保全后才另行移除；不使用通配停止、递归删除或以 unit 名称猜测旧范围。安装中断也保留现场，不能直接重跑 `--apply` 覆盖已有对象。

## 原安装的采证修复

`repair.mjs <冻结repair.json>`默认只核字节和列计划；管理员显式追加`--apply`才修改原安装。它使用原installation／config／账户，先由K验证原失败实例已持久停止、未放行且完整库存没有容量占用，再关闭本安装的两个socket并确认没有活动C／M。只替换服务入口：旧root-owned副本以原inode保留，新字节以独占新文件写入、sync并切换，原配置、程序、记录、静态单元和验收入口不变。随后启动原socket，运行一次原固定验收；失败保留日志和现场，不重跑。

冻结包须包含编译的service.mjs、verify-original.mjs及各自摘要；repair.json同时绑定原配置、旧服务、原Node／acceptance摘要与原失败instanceId。原修复标记、备份或命令日志已存在时拒绝重入；中断时需先按原日志诊断，不重新运行安装命令。默认修复只面向原固定native验收，不代表通用JS或报告UI完成。

`purpose: "deferred-cleanup"`用于已通过bootstrap的原通用安装，另核原bootstrap摘要及configId。其verifier核对完整库存且active／waiting均为0，不要求原native失败实例；使用cleanup-repair前缀保留旧service、计划与命令证据，验收另写cleanup-repair-passed.json。原bootstrap凭证、账户、配置、程序、记录和静态单元保持。打包verifier先部署到原/opt程序目录再运行，以定位同目录已保护的report-channel；直接在cache运行不能证明该安装角色可用。

## 原通用安装的报告程序更新

`purpose: "initial-restore"`复用`repair.mjs`，只替换原`program.bin`。冻结计划绑定原配置、service、program、Node／acceptance及bootstrap／cleanup通过凭证；普通用户默认仅核字节并列计划，`--apply`在任何系统写入前要求root。

管理员入口先启动原安装的两个固定socket，由K核完整库存及零占用，再关闭socket并等待原C/M退出。旧program以原inode保存为`program.before-initial-restore.bin`，新文件独占写入并sync后切换；不修改service、账户、配置、记录、静态单元或已有验收凭证。失败保留现场，不自动回滚、重装或重试。

更新后依次运行原通用验收及受保护的`initial-restore-acceptance.mjs <installed.json> --initial-restore`。后一入口发送start标记和独立恢复消息，核初始恢复state、实际恢复帧及其消费先于ready，ready之后才能选择对象；最终仍须取得原实例持久停止及零容量。全部成功才新增`initial-restore-passed.json`，该结果不包含产品UI或完整I5。具体冻结包及手工sudo命令沿同一交付记录，不另装免密规则。
