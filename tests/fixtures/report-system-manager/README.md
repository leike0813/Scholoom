# 固定系统范围的采证／停止校准

本夹具只验证真实 PID1、DynamicUser、只读 cgroup 观察以及 SDK helper 的原 InvocationID 停止。使用固定可信 native 父进程及一个 `setsid()` 子进程；不运行报告脚本、浏览器或模型。它不替代 C-owned 冻结字节、持久回执、K 唯一准入或完整 T1/T2。

普通账户准备并检查：

```sh
node --test tests/fixtures/report-system-manager/check.mjs
```

每次在 `~/.cache/scholoom-report-system-manager/bundle-*` 编译当前 helper 和静态探针，产生随机 config/storage 身份、四份 unit 文本及 `bundle.json`。普通账户检查文件安装／准备恢复、默认仅列计划、无特权拒绝、工件变化拒绝，以及替代根下 unit 解析；不连接 system manager，不在 `/run` 写入文件，不依赖 `/tmp`。输出给出本轮精确目录。离线绿色不代表系统运行通过。

对已选精确包，可先以普通账户运行`node tests/fixtures/report-system-manager/run.mjs <bundle.json> --preflight`：复用实际安装前的系统管理器及磁盘检查，只读、不创建目录／文件或启动单元。PID1会将没有配置的合法slice名称合成为loaded，不能仅凭LoadState拒绝。只有准确Id、inactive/dead、无来源／drop-in／运行调用／cgroup／执行job、非transient且无需reload的空slice可接受；service仍须not-found。四个精确unit文件／drop-in及本轮目录不存在检查保留，实际安装后仍核有效来源与空drop-in。缺字段或读取失败不会被解释为空。

普通UID真实保留范围校准入口为`node --test tests/fixtures/report-system-manager/retained-slice-check.mjs`：只启动本轮随机用户slice和有限sleep服务，核父范围原inode及新鲜populated0，记录子范围提前回收的ENODEV／ENOENT；最后停止本轮两个单元，证据在持久cache。它不运行root helper或报告，不把读取错误当停止凭证。

## 管理员操作边界

`run.mjs <精确bundle.json>` 默认只核包并列出操作。只有另获授权后，才能以管理员运行相同命令并加 `--apply`。安装 SDK 的许可不包括本步骤。

程序以独占FD新建，写入已核批准摘要的字节，明确设置安装进程的属主／组、`0555`及sync；不沿复制API继承用户属主、写权限或其他元数据。管理员运行时安装进程为root，普通自检使用同一函数检查当前安装者归属、权限及现有文件／symlink拒绝。

若失败发生在首次程序准备、尚无单元或执行记录，主线核对现场后可用同一包的`--resume-staging`继续。它仍须管理员身份，先核四个精确单元和drop-in不存在、LoadState为not-found，再核root保护的两目录、runtime仅含相同plan.json、programs仅含两份单链接且摘要相符的原副本。记录原字节快照及属主／权限／dev/ino，并在同一programs文件系统的root私有`failed-staging/`内以排他硬链接保留原inode，再移除活动名称，以新FD重新创建。旧writer FD后续写入仍保留在归档inode，不作用于新程序；不对用户可写的旧inode原地chown／chmod。有执行记录、核查时已修改的程序、其他计划或额外对象则拒绝并保留。这个入口不能恢复已启动的校准、unknown或自动重跑任务。

所有程序及unit文本在首次摘要核对时保留实际Buffer，后续安装和停止模板替换只消费该份批准字节；不从可变源路径再次读取指令。

该步骤创建唯一 `/run/scholoom-report-check-<configId>/` 保存日志，将两个经核对的程序放入唯一 `/var/lib/scholoom-report-check-<configId>/`，并在 `/run/systemd/system/` 写四份精确unit：保留父slice、payload服务、采证服务及停止服务。本机 `/run` 为 noexec，程序不从该挂载执行。不覆盖已有路径、drop-in 或已加载同名对象；每次 reload 后核实际 FragmentPath、空 DropInPaths 和 loaded 状态，再启动，发现模板／前缀／全局 drop-in 即停止。PID1 临时分配一个 DynamicUser，不创建长期账户，不安装依赖、LSM、polkit 或长期服务，不 enable 单元。父slice兑现20% CPU、64MiB内存、零swap、16tasks；payload具有20秒期限及整组停止。M观察／停止在父slice之外的root、空capability、cgroup只读视图短命单元中运行。

执行一次固定探针，采得原boot、payload InvocationID、保留父范围dev/ino、PID birth、运行账户及父范围实际限额，独立核主进程与已完成setsid握手的子进程位于固定service子范围。随后按原身份调用helper的Kill；父slice保持active且不自动停止，子service被回收后仍能从原父范围读populated0。只有helper确认原父范围空、两项原进程均不再执行（允许已退出的Z/X），才核原对象、停止该精确空slice并移除本轮四份unit文本、两个新程序及空程序目录，最后reload。恢复准备时保留`failed-staging/`及其父目录，位置写入RESULT；运行日志保留。没有按名停止payload或自动重试；20秒期限、PID／目录消失及原FD的ENODEV均不代替停止回执。

已启动的旧`bundle-9RQQpI`停止失败现场继续保留。它没有保留父slice，不能用新版runner恢复或将其service inode交给新版helper解释；新包需要按具体范围核准另一次验证，不能更换身份自动重跑。

失败或 unknown 会保留安装对象、原 scope 及日志，停止后续验收，不自动清理或换身份再跑；固定探针仍受 PID1 的 20 秒期限约束。后续处理需核原身份，不能通配删除或停止其他 Scholoom 单元。本轮数据全是合成数据，无用户材料或凭据。

源码入口为 `prepare.mjs`、`run.mjs`、`probe.c`。实际执行前需审查这三者及生产 `packages/platform/native/report-system.c`，以当次 `bundle.json` 列出的名字为准。完整 C/M 服务与受限 JS 尚未部署，校准成功也不开放生产报告。
