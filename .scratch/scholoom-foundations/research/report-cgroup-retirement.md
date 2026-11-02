# 原 cgroup 退休与完全停止：本机内核核查

调查日期：2026-10-31。范围为 Linux cgroup2／kernfs、systemd 259.5 的相关回收路径及主线提供的普通 UID 观测；没有操作原 `075b…` 系统现场。

## 明确结论

**不能把预先打开的原 `cgroup.events` FD 返回 `ENODEV` 加为“完全停止”的成功分支。本机内核允许先移除原 events 和目录，再等待退出中线程真正排空。** 固定 no-migration 不能消除这个窗口，因为反例完全不需要迁移。

`fstat(original_dirfd).st_nlink == 0` 同样不可用：本机 kernfs 的 getattr 每次把目录链接数刷新为 `kn->dir.subdirs + 2`；已删除、无子目录的原目录仍可返回 2。它不是检测退休的可用信号。[U1][U2]

需要区分三个事实：

| 事实 | 本机源码保证 |
| --- | --- |
| 原 cgroup 不再接纳迁移或创建子 cgroup | destroy 清除原对象的 `CSS_ONLINE`，并标记其 csets dead |
| 原对象的用户可见文件已永久移除 | kernfs removal 标记 `KERNFS_REMOVING`、deactivate、解除链接；原 FD 不会变为同名新对象 |
| 原子树所有任务已经完成最后的内核执行 | **前两项不保证**；destroy 特意将这一条件留给后续 populated 排空及延迟收尾 |

上述区别直接见本机 `cgroup_destroy_locked()` 的说明和实现。[U3][U4] “self 已不 online”也不能冒充所有 subsystem 的 `->css_offline()` 已完成。

## 本机版本与源码对应

本轮实际读回：

| 项目 | 结果 |
| --- | --- |
| 系统 | Ubuntu 26.04.1 LTS，resolute |
| `uname -r` | `7.0.0-38-generic` |
| `/proc/version_signature` | `Ubuntu 7.0.0-38.38-generic 7.0.14` |
| `linux-image-7.0.0-38-generic` | 包版本 `7.0.0-38.38`，源包 `linux-signed` 同版本 |
| `linux-modules-7.0.0-38-generic` | 包版本 `7.0.0-38.38`，内核主体源包 `linux` 同版本 |
| `/boot/config-7.0.0-38-generic` | `CONFIG_CGROUPS=y`；`CONFIG_PREEMPT_RT` 未设置 |

本轮重新执行官方仓库 `git ls-remote`，结果为：

```text
a6992b931e773a6c6261abe4c1c417ffeac8bd4d refs/tags/Ubuntu-7.0.0-38.38
740b32353f43e9b00d0350d6fa7b29a6667deabd refs/tags/Ubuntu-7.0.0-38.38^{}
```

以下所有 U 系列源码链接固定到该 peeled commit；重新读取的 `debian.master/changelog` 首行为 `linux (7.0.0-38.38) resolute; urgency=medium`。[U0] 包版本、运行版本和官方 tag 相符；没有对运行中机器码逐字节验证，也未审计 livepatch 状态，不能把源码推导写成对原现场的实测证明。

先复用了 `/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/stop-identity-research/` 下的四份指定资料。其 `requests-corrected.json` 表明 cgroup／kernfs C 文件固定在 **v6.12**，不能代表本机。旧版 `cgroup_destroy_locked()` 在 5979 行确有删除前 `cgroup_is_populated()` 拒绝；本机版本已经换成不同条件。**这正是本次不能沿用旧结论的关键。** [L1][U3]

之前的版本对应及 Ubuntu 文档缓存位于 `/home/joshua/.cache/scholoom-parallel-resume-20261029-A5WuXN/research-interaction/work/official-service-research/`。原 `/tmp/scholoom-cgroup-retirement-source-z92ewd/` 的全部 13 份源码已逐字节核对并复制到持久目录 `/home/joshua/.cache/scholoom-cgroup-retirement-source-D8IjKj/ubuntu-linux/`，未删除原临时目录。下文 systemd 源包、发行版补丁、上游源码和版本资料也集中保存在同一持久缓存根目录。

## 删除链：不再要求 populated 为零

`kernfs_iop_rmdir()` 取得原节点 active ref 后调用 cgroup 的 rmdir；`cgroup_rmdir()` 经 `cgroup_kn_lock_live()` 锁住原 live 对象，再进入 destroy。[U5][U6][U30]

本机 `kernel/cgroup/cgroup.c:6210–6283` 的实际顺序为：[U3]

1. `css_task_iter_start(&cgrp->self, 0, &it)`；若 iterator 找到 task，则 `-EBUSY`。
2. `css_has_online_children(&cgrp->self)` 为真则 `-EBUSY`。dying 子范围可以仍留在链表中。
3. 清除 `CSS_ONLINE`，把关联 csets 标为 dead，阻止后续迁移和子范围创建。
4. 对各 subsystem 执行 `kill_css_sync()`。
5. `css_clear_dir(&cgrp->self)` 移除基类文件，包括 events；随后 `kernfs_remove(cgrp->kn)` 移除目录。
6. 最后才执行 `if (!cgroup_is_populated(cgrp)) cgroup_finish_destroy(cgrp)`。

第 6 步**不是删除前置条件**。若还 populated，用户可见删除照常完成；后来子树排空时，`cgroup_update_populated()` 为已 offlined 的 cgroup 排入 `finish_destroy_work`，再完成 subsystem percpu-ref kill／offline 链。[U3][U4][U7]

iterator 为什么不能代替 populated：`css_task_iter_advance():5143–5149` 明确跳过 `PF_EXITING && signal->live == 0` 的 task。[U8] destroy 的说明在 6186–6191 行直接指出，这类已从 `cgroup.procs` 隐藏的 task **仍能调度、分配并消耗资源，直到最后一次 context switch**，dying 后代也可能承载这样的 task。[U4]

这不只是一段说明：`do_exit()` 在 924 行设置 `PF_EXITING`、929 行减少 `signal->live`，后面才执行 `exit_mm()`、`exit_files()`、`exit_fs()` 等清理。[U9] `finish_task_switch()` 在 `TASK_DEAD` 分支才调用 `cgroup_task_dead()`；该函数再将 task 从 cset 移除并更新 populated，向祖先传播排空状态。[U10][U11][U7]

因此：删除拒绝**可见的** task 和 online 子 cgroup，但不拒绝所有仍 populated 的情况；不能声称删除时没有尚在执行清理的线程或 dying 子范围。

## events 的 ENODEV 精确能说明什么

`cgroup.events` 是 `cgroup_base_files[]` 的固定项，只有 `CFTYPE_NOT_ON_ROOT` 标志，绑定 `events_file`，通过 `cgroup_events_show()` 输出 populated／frozen。[U12][U13]

普通 controller 移除不会顺便移除 base events：`css_clear_dir()` 对 self css 才处理 `cgroup_base_files`，对 subsystem css 只遍历该 subsystem 的 cftypes；`cgroup_apply_control_disable()` 遍历的是各 `ss` 对应的 css。[U14][U15] 当前文件内 `events_file` 的使用只有注册和通知；没有为 base events 调用可恢复的隐藏逻辑。对**已成功建立并预先核实的非根 cgroup2 原 base events FD**，普通 controller enable／disable 不能作为这个 FD 失效的解释。

永久 removal 的 kernfs 路径会先给节点设置 `KERNFS_REMOVING` 并 deactivate，再 drain／解除链接；`kernfs_activate_one()` 遇到 `KERNFS_REMOVING` 不会重新 activate。[U16][U17] 但是原 events 文件可以在整个目录移除之前就由 `css_clear_dir(self)` 失活，而这个位置仍早于任务排空条件。

读路径为 `seq_read_iter → kernfs_seq_start → kernfs_get_active_of`。无法取得原文件 active ref（或该 open file 已 released）时返回 `-ENODEV`；**没有附带 task 排空或 subsystem offline 检查**。[U18] 在上述预验证条件和正常删除路径下，它支持“原 base events 已因 teardown 失活”的解释，不能推出“原 cgroup 所有 task 已完成执行”。即使额外证明这是永久失活，缺失的排空证据仍然缺失。

其他候选也不补足这个缺口：`ENOENT`、EOF／空读、poll 的错误／变化通知，都不是 `populated 0`；poll 的 `EPOLLERR|EPOLLPRI` 本来就可表示状态变化或失活。[U19] 必须区分实际新读出的值、seq_file 缓存残余和读取失败；续读可能先复制已有缓存，再调用新的 show。[U20]

## fstat 刷新与路径复用

`vfs_fstat()` 从 FD 的 `f_path` 调 `vfs_getattr()`；通过 LSM 检查后，VFS 调用 inode 的 `getattr`。[U2][U29] kernfs 目录的 `.getattr` 确实注册为 `kernfs_iop_getattr`；后者在 iattr 读锁内执行 `kernfs_refresh_inode()` 再填 stat，而 refresh 对目录无条件 `set_nlink(inode, kn->dir.subdirs + 2)`。[U1][U21] **会刷新，但刷新的不是“已 unlink 为零”语义。** VFS rmdir 设置 `S_DEAD`，该 kernfs refresh 没有依此改写链接数。[U22]

`kernfs_unlink_sibling()` 减少的是父节点的 subdirs，不会把原节点的 subdirs 改成表示删除的值。[U23] 普通文件的 refresh 不更新 nlink，因此 events FD 的 nlink 保持 1 也不证明文件仍 active。

同名路径复用不会污染持续持有的原 FD：相对 `openat` 从原 FD 的 `f_path` 开始，kernfs lookup 从原 inode 的 `i_private` parent 查子项；inode 初始化时 `kernfs_get(kn)` 固定该节点，直到 inode eviction 才 put，ino 的分配记录到最终 kn 引用释放才删除。[U24][U25][U26][U28] 同名新 cgroup 是另一个对象。重新按完整路径打开却会取得新对象，所以也不能用新路径的 `populated 0` 代替原范围证据。

## 不需要迁移的反例

以下是源码允许的并发时序，**不是本轮复现回执**：

1. 原 cgroup 中最后一个线程收到 SIGKILL，进入 `do_exit()`；已置 `PF_EXITING`、`signal->live` 已为零，但尚未完成 `exit_mm()`／`exit_files()` 等清理，此时被抢占。
2. 管理器 rmdir。iterator 隐藏该线程；没有 online 子 cgroup，因此 destroy 通过。此时 cgroup 仍可 populated。
3. destroy 清除 self online，移除 base events 和目录。观察者对已 pin 的原 events FD 新读得到 `ENODEV`，对原 dirfd 的 `openat(events)` 得到 `ENOENT`；原目录 `fstat` 仍可返回 nlink 2。
4. 原线程随后继续内核清理，直到最后 context switch 才更新 task／populated，并触发延迟 destroy。

第 3 步若按 `ENODEV => stopConfirmed`，便会在第 4 步结束前报告已完全停止。每一步都不需要迁出、迁入或新建接替范围。[U3][U8][U9][U10][U11]

带子范围的版本同理：先移除仍承载退出清理 task 的 child，使它成为 dying；随后 parent 没有 online children，也没有自己的可见 task，便可删除。parent 的 populated 可以仍由该 dying child 贡献。无 online children 不等于已无仍消耗资源的后代。

## 主线实测与最小可信判据

已只读核对主线提供的 `/home/joshua/.cache/scholoom-report-system-stop/pinned-fd-aM6P8v/result.json`：live 原 dir 为 dev 33／ino 2284910／nlink 2，events 为 dev 33／ino 2284916／nlink 1，读值 `populated 1`；自动回收后两 FD 的 dev／ino／nlink 不变，原 events 读为 `ENODEV`，原 dirfd reopen 为 `ENOENT`。这与源码一致，否定 nlink0 方案；该样本没有观测到失活瞬间 task 排空与否，**不能证明 ENODEV 足够**。

在既定 no-migration、完整原范围归属和停止期间不重新启动／注入新工作的条件下，最小可接受的正证据仍为：**从已验证的原范围取得新鲜、完整、成功的 `cgroup.events` 读值 `populated 0`**。本机 populated 传播追踪到 task 最后 context switch，且包含后代；这不是要求所有 zombie、内核引用或资源记账对象已释放。[U7][U10][U11][U13] `cgroup_is_populated()` 本身注明无同步、只作 hint，因此不要把内部变量读取包装成额外的原子屏障保证；这里沿用公开 events 语义和既定封闭停止阶段。[U27]

若还要求“永久退休”，需在已有排空证明之外核实原对象已永久失活；不能用失活信号反推从未读到的排空。**对于只有先前 `populated 1`、随后 `ENODEV`／`ENOENT` 的本次链条，当前证据只能继续 stop-unconfirmed；pin events 可固定身份，却不能解决删除早于排空的语义缺口。** 停止回执的持久化及准入释放仍沿主线契约，不能由本报告替代。

## 两种保留观察点方案的有界核查

| 方案 | 源码结论 | 能否支持主线的停止证明 |
| --- | --- | --- |
| A：payload `RemainAfterExit=yes`／`ExitType=cgroup` | **不能保证原 cgroup 保留到显式 Stop**；active-exited 仍 prune | 不适合作为保留原观察文件的保证 |
| B：每 report 独立、持续 active 的父 slice | 正常 empty／GC 路径不自动删除 active slice；父 populated 包含 dying 子范围 | 在物理身份、完整归属及无后续注入均成立时，可用父原 events 的 fresh `populated 0` 证明该范围任务排空 |

这是源码条件判断，不替主线批准接口或部署，也不把用户态 probe 通过写成系统身份组合已交付。

### systemd 精确版本及发行版差异

实际执行 `/usr/lib/systemd/systemd --version` 得到 `systemd 259 (259.5-0ubuntu3.4)`；`dpkg-query` 的包／源包均为 `systemd 259.5-0ubuntu3.4`。Launchpad 官方源包发布记录为 resolute-security 的 `18666178`。[S0] 本轮从其 `sourceFileUrls` 获取对应 `.dsc`、267032 字节的 `.debian.tar.xz` 和 17336729 字节的 `.orig.tar.gz`，只解压源码，没有安装或构建依赖。

上游 `v259.5` 的 tag object `4f8299955d8edfa6dab6879cbd7f199274b121fc` 指向 commit **`b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a`**。已将官方 Ubuntu orig 源包中的 `unit.c`、`cgroup.c`、`service.c`、`slice.c`、`scope.c`、`basic/cgroup-util.c` 与该上游版本缓存逐字节比较，六份均一致。下列 S 系列行链接固定到该 commit。

已读取此精确 Ubuntu 版本的 `debian/patches/series` 并检索补丁涉及的路径：对 `core/unit.c`／`core/cgroup.c` 的唯一相关补丁是 `lp2150773-core-Open-netfilter-socket-only-when-needed.patch`，修改 NFT socket 打开位置，不改本报告涉及的 prune、状态机、GC、slice 归属函数；其余适用补丁未修改 `service.c`、`slice.c`、`basic/cgroup-util.c` 或 `shared/cgroup-setup.c`。因此这些函数的结论覆盖发行版补丁差异；没有声称完成全部 systemd 审计或运行中二进制反汇编核对。

持久缓存根目录为 `/home/joshua/.cache/scholoom-cgroup-retirement-source-D8IjKj/`：`orig/` 是官方 orig 源包，`packaging/` 是该版本 Debian／Ubuntu 包装及补丁，`systemd-upstream/` 是复用／补读的定版文件，`source-publications.json`、`source-file-urls.json`、`tag.json`、`tag-object.json` 保留版本来源。

### A：RemainAfterExit 和 ExitType 不能固定原目录

决定性调用为 `service_set_state():1341–1344`：进入 `SERVICE_EXITED` 且非 reload 时，**直接 `unit_prune_cgroup(u)`**；注释明确解释 inactive 状态由 `unit_notify()` trim，而 exited 需要自己 trim。[S1] `service_enter_running():2396–2419` 对失败结果先走停止流程，只有成功且 service 已不 good 时，remain_after_exit 才进入 EXITED；不能假设 SIGKILL 被当成功退出。[S2]

`ExitType=cgroup` 的作用较窄：`service_good()` 在 main PID 消失时允许继续检查整个 cgroup，SIGCHLD 分支也在 cgroup 尚不 empty 时推迟正常退出转换。[S3] 但它不阻止随后进入 EXITED／inactive，不承诺保留 empty cgroup，也不禁用超时、失败或显式停止路径。两项组合仍不提供“直到显式 Stop 才删除”的契约。即使某条正常路径先观察到 empty，外部观察者仍可能错过值而只读到 ENODEV。

`unit_prune_cgroup()` 不是先可靠等待 populated 为零再删除：它先调用 `cg_trim()`，之后才 `unit_maybe_release_cgroup()`。[S4] `cg_trim()` 递归尝试 rmdir 子目录，再尝试 rmdir 根，没有以 populated 文件作为 rmdir 前置条件。[S5] `cg_is_empty()` 更把路径 ENOENT 直接视为空。[S6] 因而不能拿 systemd 的 prune／release 成功，反推此前 Linux 退出清理窗口不存在。

### B：active slice 的回收条件及 dying 子范围传播

已搜索 `src/core` 内全部 `unit_prune_cgroup()` 调用：只有 service 的 EXITED／auto-restart 清理、`unit_notify()` 的 inactive／failed 清理，以及 cgroup-empty 分发中的 inactive／failed 清理。`on_cgroup_empty_event():2919–2922` 对 active unit 只调用其 vtable 的 `notify_cgroup_empty`；slice vtable 没有这个回调。[S7][S8] `unit_may_gc():450–471` 的两种 CollectMode 都要求 inactive 或 inactive/failed，active slice 不满足。[S9] 因此不能把“slice 空了”解释为它会自行 prune 或 GC。

`slice_start()` 分配自己的 invocation ID、尝试 realize cgroup 后设 ACTIVE；没有以 empty 为条件转 DEAD 的逻辑。`slice_stop()` 才设 DEAD，随后由 `unit_notify()` prune。[S10][S11] 注意 realize 返回值在这里被忽略，**active 不是 cgroup 实际存在的证明**，主线核真实 inode／events 的步骤必不可少。

保留不是绝对保证：`StopWhenUnneeded=yes` 会使无依赖的 active unit 满足自动停止判断；须核有效配置，不能只看没有显式 Stop 调用。[S12] slice／祖先停止、获授权的祖先子树 trim、manager shutdown 都可能递归删除观察点；`cg_trim()` 不认识其他 unit 的 active 状态，manager shutdown 明确递归 trim 根的子树。[S5][S13] 这些情况不构成接受 ENODEV 的理由：父观察点失效时仍须保留 unknown。正常服务 leaf 自己的 trim 只作用于自己的路径，不向上删除父 slice。

Linux 侧的决定性证据是：destroy 修改 `nr_descendants`／`nr_dying_descendants`，**没有减少 `nr_populated_*`**；退出 task 仍留在 cset 时仍贡献 populated。[U3] `cgroup_update_populated():841–881` 不按 CSS_ONLINE 过滤祖先；计数沿 `cgroup_parent()` 传播，遇到已 offline 的 child 会安排 deferred destroy，但仍继续向父传播。[U7] `do_cgroup_task_dead()` 才移除 task，`css_set_move_task()` 更新 cset／祖先 populated。[U11][U31] 所以子 service 即使已 rmdir，保留下来的父 slice 仍会覆盖其中 dying 线程；它最后排空时，父原 events 才可观测到对应的 1→0。

已只读核对主线 `/home/joshua/.cache/scholoom-report-system-stop/parent-probe/run-S8PNfM/result.json`：父 dev 33／ino 2285135，live 为 `populated 1`，childGone 为 true，父 active，随后 fresh 值为 `populated 0`。这是普通 UID 正常路径实证，与源码一致；没有证明具体 dying 清理窗口已被 probe 命中。

### 对主线父 slice 接口草案的限制与反例

在用户已明确的完整归属、no-migration、原 boot／父 dev-ino 身份及无未来注入条件**均落实**时，没有发现“child 先 rmdir 导致父提前失去其 populated 贡献”的反例。原父 fresh `populated 0` 可独立于已消失的 service 证明当前范围排空，不需要为了确认而对同名新 invocation 发 Kill。

但下列边界不能只靠 `Restart=no`、父 active 或 `Slice=` 字符串成立：

- **同 service 的晚到收尾命令。** 主 task 排空后父可短暂为 0，PID1 随后才处理退出并运行 `ExecStop=`／`ExecStopPost=`；`service_enter_stop()` 和 `service_enter_stop_post()` 明确调用 `service_spawn()`。[S14][S15] 新 task 仍属同 service 子树（可能是 `.control`），不需要 Restart、迁移或额外 service，足以在确认后把父变回 1。固定模板及有效 drop-in 必须排除该路径，以及未完成的启动阶段／激活任务；不能只检查 main PID 或 pending Restart。
- **active slice 不提供排他准入。** `Slice=` 负责选择层级，`unit_set_slice()` 只约束单位类型、inactive 状态及已有 cgroup 绑定；它没有“该 slice 专属一个 report”的授权检查。[S16] 其他获授权调用者仍可能创建同父服务；no-extra-services 和阻断已排队／将来的新工作，必须来自受信启动权威与授权，不能由父 inode、active 或一个 `populated 0` 读值推出。
- **归属必须核物理路径及实际成员。** `unit_default_cgroup_path()` 使用 manager root、slice 层级和 escaped unit ID 组成路径；slice 的父层级由名称推导并校验，不接受任意改父。[S17][S18] 服务归属已有 cgroup 后不允许随意换 Slice，但这不验证 payload 实际 PID，也不替代祖先／子范围物理身份。payload invocation 与 slice invocation 是不同对象；当前方案只在需 Kill 时使用原 payload invocation，不应把它误当父 slice 身份。
- **父 1、原 service 已回收仍是合法状态。** 正是 dying task 窗口允许出现这种组合。此时按原 invocation 查找／Kill 可以失败，仍可对父原 FD 做有界只读等待；不因 service 查不到直接成功，也不换新 invocation 补杀。超时仍 unconfirmed，不能用等待时长代替排空证据。

旧 service 范围 receipt 必须按其契约语义拒绝，不能把相同字段名静默解释成父范围；dev／ino 数值本身不携带 service／slice 类型。主线拟定的显式旧语义拒绝及固定父路径核验覆盖这一边界，本调查不另定 schema。

若每 report 父 slice 永久不 Stop，空 unit／cgroup 会随 report 数积累；本轮未测其负载成本。观察点至少需保留到排空证据与停止回执持久化，后续回收责任由主线明确，不能提前删除来解决积累。

本调查只修改本报告及获准的源码缓存；未改生产、测试、其他交付工件或原系统现场，未使用 root／sudo、启动 unit、安装依赖或放宽 no-migration。未把源码反例伪称实跑；两个普通 UID 观测均由主线提供。尚未验证系统身份组合、异常停止／manager shutdown 及真实 dying 窗口。到此停止有界调查。

## 固定源码链接

[U0]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/debian.master/changelog?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1
[U1]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/inode.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n168
[U2]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/stat.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n181
[U3]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n6210
[U4]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n6180
[U5]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1302
[U6]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n6303
[U7]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n825
[U8]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n5143
[U9]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/exit.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n924
[U10]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/sched/core.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n5191
[U11]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n7071
[U12]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n5496
[U13]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n3840
[U14]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1777
[U15]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n3441
[U16]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1497
[U17]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1420
[U18]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/file.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n160
[U19]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/file.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n846
[U20]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/seq_file.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n195
[U21]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1351
[U22]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/namei.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n5331
[U23]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n433
[U24]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/namei.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n2749
[U25]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1239
[U26]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/inode.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n201
[U27]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/include/linux/cgroup.h?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n581
[U28]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/kernfs/dir.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n582
[U29]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/stat.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n254
[U30]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1722
[U31]: https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/kernel/cgroup/cgroup.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n918
[L1]: https://github.com/torvalds/linux/blob/v6.12/kernel/cgroup/cgroup.c#L5965-L6009
[S0]: https://api.launchpad.net/1.0/ubuntu/+archive/primary/+sourcepub/18666178
[S1]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/service.c#L1341-L1344
[S2]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/service.c#L2386-L2419
[S3]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/service.c#L4191-L4193
[S4]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/cgroup.c#L2781-L2840
[S5]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/shared/cgroup-setup.c#L57-L109
[S6]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/basic/cgroup-util.c#L610-L631
[S7]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/cgroup.c#L2888-L2924
[S8]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/slice.c#L441-L489
[S9]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/unit.c#L450-L471
[S10]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/slice.c#L227-L258
[S11]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/unit.c#L2757-L2765
[S12]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/unit.c#L2168-L2193
[S13]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/cgroup.c#L3346-L3353
[S14]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/service.c#L2224-L2251
[S15]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/service.c#L2335-L2364
[S16]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/unit.c#L3413-L3457
[S17]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/cgroup.c#L1889-L1920
[S18]: https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/slice.c#L86-L109
