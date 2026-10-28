# bwrap 0.11.1 固定校准命令：挂载路径与权限收敛顺序

核对日期：2026-10-29。范围：为父编写静态 profile 提供源码事实，不制定 AppArmor 安全策略，不改变既有部署研究结论。本文没有运行 bwrap、浏览器、namespace 探测或策略编译／加载，也没有安装或修改系统。

**源码结论：staging root 固定为 `/tmp`，没有随机目录或环境变量选择器；两次 pivot 分别是 `pivot_root("/tmp", "oldroot")` 和在 `/newroot` 内执行的 `pivot_root(".", ".")`。固定 argv 仍不能确定所有 bind remount flags、递归子挂载、proc 覆盖分支及 AppArmor 实际呈现的路径。**普通非 root 用户配合 `--dev` 时，bwrap 自身还会在挂载完成后、应用 exec 前再创建一层 user namespace。[U-root][U-finish][U-userns]

## 版本、输入与证据强度

- 本机只读查询：`dpkg-query` 返回 `bubblewrap 0.11.1-1ubuntu0.3`；`stat /usr/bin/bwrap` 返回 `-rwxr-xr-x root:root`。本文沿用已有研究给出的 Ubuntu 26.04、AppArmor 5.0.2 和 stock 子域限制，不重新调查它们。
- 上游正式 tag `v0.11.1` 的 annotated tag 对象为 `1e75470e57fb9d2e9028c1451d6bc856e0ac03ca`，指向 commit **`124c4cdf4321f63ef17a1cb0ce8f9dd45bd7adbe`**。[G-tag]
- Ubuntu 官方 `applied/0.11.1-1ubuntu0.3` tag 指向已应用补丁的 commit **`4442b57f802c6a6199b1c3224295e44c6bb8afa5`**。下文 **U 链接与行号均基于这个 commit**，不是 master，也不是未打补丁的上游行号。[U-commit]
- 读取官方 Ubuntu `.dsc`、orig tarball 和该版本的 Debian tarball；orig 中的 `bubblewrap.c`、`bind-mount.c`、`utils.c` 与上述上游 commit 逐字一致。按 `debian/patches/series` 在内存中应用两项补丁，所得 `bubblewrap.c` 与 Ubuntu applied commit 逐字一致；后两文件在 applied commit 中也保持一致。这验证了本文所追踪文件的来源关系，不是本机二进制的重现构建证明。[U-dsc][U-orig][U-debian]
- 固定命令依据是本地既有 [`run.mjs`](/home/joshua/.cache/scholoom-finish-active/report-browser-calibration/run.mjs:111) 的第 111–122 行；只读取文本，没有执行。既有[部署研究](/home/joshua/.cache/scholoom-finish-active/report-browser-deployment-research.md)继续负责方案背景。

旧命令的 namespace／权限部分为：

```text
--unshare-all --unshare-user --unshare-pid --unshare-net --unshare-cgroup
--die-with-parent --new-session --cap-drop ALL
```

挂载操作按 argv 顺序为 `/usr` 只读 bind，三个 `/lib`、`/lib64`、`/bin` symlink，创建 `/etc`，只读 bind `/etc/fonts`、`/etc/ld.so.cache`、runtime 至 `/electron`、app 至 `/app`，scratch 可写 bind 至 `/scratch`，然后 `--proc /proc --dev /dev --tmpfs /tmp --tmpfs /run`。最后 `--clearenv`、白名单 `--setenv`、`--chdir /app`，应用入口为 `/electron/electron`。`--disable-setuid-sandbox` 位于 `--` 后，是应用参数，不改变本文的 bwrap 分支。

下文 `R` 表示旧脚本的 `realpathSync(node_modules/electron/dist)`；`J` 表示其 `mkdtempSync(.../run-)` 生成的运行目录；`S` 表示 `J/scratch-<index>`。父拟议的新固定安装路径尚未给定，本文不替它命名。

## staging root 与路径变化

`main()` 第 3050–3062 行说明只需一个保证存在的挂载点，并直接赋值 `base_path = "/tmp"`。它不调用 `mkdtemp`，也不读取 `TMPDIR`、`XDG_RUNTIME_DIR` 或 `HOME` 来选择 staging root；这个版本没有设置 `base_path` 的 CLI 选项。[U-base]

| 阶段 | syscall 使用的路径／含义 | 精确源码位置 |
| --- | --- | --- |
| 初始新 mount namespace | 在原视图的 `/tmp` 上挂一个 tmpfs；`chdir("/tmp")` | `main()` 3317–3326，[U-root] |
| 首次 pivot 前 | 创建 `/tmp/newroot`、将其递归 bind 到自身，创建 `/tmp/oldroot` | `main()` 3328–3341，[U-root] |
| 首次 pivot | `pivot_root(base_path, "oldroot")`；此时 cwd 是 `/tmp`，`put_old` 解析为 `/tmp/oldroot`。随后 `chdir("/")`，staging tmpfs 成为当前 `/` | `main()` 3356–3360，[U-root] |
| 构建应用 root | 原宿主对象通过 `/oldroot/<路径>` 访问；目标通过 `/newroot/<路径>` 访问 | `setup_newroot()` 1206–1238；`get_oldroot_path()` 865–870、`get_newroot_path()` 873–878，[U-ops][U-path] |
| 收尾与第二次 pivot | 先隔离、detach `/oldroot`；打开 staging `/` 的 fd；`chdir("/newroot")` 后 `pivot_root(".", ".")`，用旧 fd 返回 staging root 并 detach 它 | `main()` 3417–3452，[U-finish] |
| 应用 root | 原 `/newroot` 成为 `/`，所以 `/newroot/app` 最终是应用看到的 `/app` | 同上 |

`pivot_root()` 是 `syscall(__NR_pivot_root, new_root, put_old)` 的薄封装，没有 fstype 或 flags 参数；它不是 `chroot` 回退。[U-pivot]

bind 的宿主源先由 `resolve_symlinks_in_ops()` 调用 `realpath()`，发生在初次 pivot 之前；因此实际传给挂载的源是 `/oldroot/` 加**规范化后的宿主绝对路径**。仅固定一个包含 symlink 的 argv 文本，不能固定它最终指向的源。`get_newroot_path()` 只去掉前导 `/` 再添加 `/newroot/`，不生成随机名。[U-resolve][U-path]

本地旧脚本的随机性来自 `J`，进而影响 app、scratch 源路径，不来自 bwrap staging。其外层环境 `TMPDIR=J/tmp`、guest 环境 `TMPDIR=/scratch/tmp` 均不会把 staging `/tmp` 移到这些目录。`--clearenv`／`--setenv` 在解析参数时立即作用于环境；固定 `--chdir /app` 也避免了最终 cwd 选择落入旧 cwd／`HOME` 分支。[U-env][U-cwd]

这里列出的是进程的路径参数及解析阶段，**不是 AppArmor audit 路径实测**。不能由此断言 LSM 一定显示 `/tmp/newroot/...`、`/newroot/...` 或最后的 guest 名称；跨 pivot、mount namespace 和断连挂载后的具体呈现仍由父验证。

## 全局 mount、pivot 与卸载序列

以下严格保留源码传入的 `source`、`fstype`、`flags`、`data`；`NULL` 不等同于字符串 `"none"`。序号只描述 bwrap 源码顺序，不是策略规则顺序。

| 顺序 | 操作与 source → target | fstype | flags／data | 源码 |
| --- | --- | --- | --- | --- |
| 1 | `mount(NULL, "/", ...)`，改变传播属性 | `NULL` | `MS_SILENT | MS_SLAVE | MS_REC`；data=`NULL` | `main()` 3314，[U-root] |
| 2 | `mount("tmpfs", "/tmp", ...)`，staging 文件系统 | `"tmpfs"` | `MS_NODEV | MS_NOSUID`；data=`NULL` | `main()` 3318，[U-root] |
| 3 | `mount("newroot", "newroot", ...)`，cwd=`/tmp` | `NULL` | `MS_SILENT | MS_MGC_VAL | MS_BIND | MS_REC`；data=`NULL` | `main()` 3337，[U-root] |
| 4 | `pivot_root("/tmp", "oldroot")`，cwd=`/tmp` | 不适用 | 无 flags 参数 | `main()` 3356，[U-root] |
| 5 | `setup_newroot(...)`：按下一节构建 `/newroot` | 见下表 | 见下表 | `main()` 3412、`setup_newroot()` 1193 起，[U-setup-call][U-ops] |
| 6 | `mount("oldroot", "oldroot", ...)`，cwd=`/` | `NULL` | `MS_SILENT | MS_REC | MS_PRIVATE`；data=`NULL` | `main()` 3418，[U-finish] |
| 7 | `umount2("oldroot", MNT_DETACH)` | 不适用 | `MNT_DETACH` | `main()` 3421，[U-finish] |
| 8 | `pivot_root(".", ".")`，cwd=`/newroot` | 不适用 | 无 flags 参数 | `main()` 3445，[U-finish] |
| 9 | `fchdir(oldrootfd)` 后 `umount2(".", MNT_DETACH)`，再 `chdir("/")` | 不适用 | `MNT_DETACH` | `main()` 3447–3452，[U-finish] |

`MS_SILENT`、`MS_MGC_VAL` 是源码传值，本报告不把它们转换成 AppArmor `options=` 语法。传播操作也不能与普通 bind 或 bind-remount 混为一类。挂载均发生在 clone 创建的新 mount namespace 内；`clone_flags` 无条件含 `CLONE_NEWNS`，本命令另含 user、pid、net、ipc、uts、cgroup namespace 标志。[U-clone]

## `setup_newroot()` 的固定项目与条件项目

`SetupOp` 加入链表后按顺序遍历。普通非 setuid 路线直接调用 `setup_newroot(opt_unshare_pid, -1)`，再由 `privileged_op()` 执行 mount；这里的函数名不表示启动了额外的 root 服务。[U-op-list][U-ops][U-setup-call]

| argv／隐含操作 | setup 时的 source → target | mount 类型、flags 与 data | 条件／不确定项 |
| --- | --- | --- | --- |
| `--ro-bind /usr /usr` | `/oldroot` + `realpath("/usr")` → `/newroot/usr` | 递归 bind，再按下节设置只读 flags；fstype=`NULL`、data=`NULL` | 宿主子挂载与原 flags |
| `--ro-bind /etc/fonts /etc/fonts` | `/oldroot` + `realpath("/etc/fonts")` → `/newroot/etc/fonts` | 同上 | 同上 |
| `--ro-bind /etc/ld.so.cache /etc/ld.so.cache` | `/oldroot` + `realpath("/etc/ld.so.cache")` → `/newroot/etc/ld.so.cache` | 同上；这是文件 bind，也经同一递归标志调用 | 规范化源、原 flags |
| `--ro-bind R /electron` | `/oldroot` + `realpath(R)` → `/newroot/electron` | 同上 | 旧脚本的 R 由 node_modules 的真实位置决定 |
| `--ro-bind J/app /app` | `/oldroot` + `realpath(J/app)` → `/newroot/app` | 同上 | J 来自旧 controller 的随机目录 |
| `--bind S /scratch` | `/oldroot` + `realpath(S)` → `/newroot/scratch` | 同一递归 bind；不添加 `MS_RDONLY`，但也不清除源已有的只读标志 | S 的路径、子挂载和原 flags |
| `--proc /proc` | `"proc"` → `/newroot/proc` | fstype=`"proc"`；`MS_NOSUID | MS_NOEXEC | MS_NODEV`；data=`NULL` | 本命令有新 PID namespace，走新 procfs 分支 |
| proc 额外覆盖 | `/newroot/proc/<p>` → 自身；p 为 `sys`、`sysrq-trigger`、`irq`、`bus` | 递归 bind + 只读处理 | 每项仅在 `access(path, W_OK)` 成功时执行；`EACCES`／`ENOENT`／`EROFS` 跳过，其他错误终止 |
| `--dev /dev` 的基础挂载 | `"tmpfs"` → `/newroot/dev` | fstype=`"tmpfs"`；`MS_NOSUID | MS_NODEV`；data=`"mode=0755"` | 不是 bind 宿主整个 `/dev` |
| `--dev` 的六个设备文件 | `/oldroot/dev/<n>` → `/newroot/dev/<n>`；n 为 `null`、`zero`、`full`、`random`、`urandom`、`tty` | 递归 bind，带内部 `BIND_DEVICES`；flags 处理见下节 | 保留设备源已有 flags；不是 `mknod` |
| `--dev` 的 devpts | `"devpts"` → `/newroot/dev/pts` | fstype=`"devpts"`；`MS_NOSUID | MS_NOEXEC`；data=`"newinstance,ptmxmode=0666,mode=620"` | `--dev` 会设置 `opt_needs_devpts=true` |
| `--dev` 的 console | `/oldroot` + `ttyname(1)` → `/newroot/dev/console` | 与六个设备相同的 bind 路线 | 仅 stdout 是 tty 且取得非空 ttyname 时执行；旧脚本 stdout 是普通日志文件，因此按其接线不触发 |
| `--tmpfs /tmp` | `"tmpfs"` → `/newroot/tmp` | fstype=`"tmpfs"`；`MS_NOSUID | MS_NODEV`；data=`"mode=0755"` | 与 staging `/tmp` 是两次不同挂载 |
| `--tmpfs /run` | `"tmpfs"` → `/newroot/run` | 同上 | 无 `--size`，不传 size 参数 |

表中 bind 项的入口为 `setup_newroot()` 1243–1258 → `privileged_op()` 1112–1115；proc 为 1331–1372 → 1124–1126；dev 为 1374–1448 → 1129–1152；tmpfs 为 1450–1461 → 1129–1145。[U-ops][U-priv-mount][U-proc-dev]

`--dev` 还创建 `/dev/shm` 普通目录（0755），**没有再给 `/dev/shm` 单独挂 tmpfs**；它位于 `/dev` 的 tmpfs 内。stdin/stdout/stderr、fd、core 和 ptmx 是 symlink，分别指向 proc fd／kcore／`pts/ptmx`，这些不是新增 mount。argv 中三个 symlink 和 `--dir /etc` 也只是文件树操作。[U-proc-dev]

旧 argv 没有 `--perms`、`--size` 或 `--file-label`：`--tmpfs` 默认 perms=0755、size=0；`privileged_op()` 因而仅传 `mode=0755`，不会传 `size=`。`label_mount()` 在无 label 时原样返回该字符串，不追加 SELinux context。staging tmpfs 的 data 则始终是 `NULL`，不经过这一 mode 生成器。[U-tmpfs-parse][U-priv-mount][U-label][U-root]

### bind 与 remount 的精确算法

`privileged_op()` 强制传入 `BIND_RECURSIVE | flags`，所以本命令的普通 bind、只读 bind、设备文件 bind、proc 自覆盖均进入以下算法。[U-priv-mount]

```text
1. mount(src, dest, NULL, MS_SILENT | MS_BIND | MS_REC, NULL)
2. resolved_dest = realpath(dest)
3. 打开 resolved_dest 的 O_PATH fd；读取 /oldroot/proc/self/fd/<fd> 链接
4. 从保留的宿主 proc fd 读取 self/mountinfo，找到目标与可见子挂载
5. 对目标和递归子挂载分别计算：
   new_flags = current_flags
             | (BIND_DEVICES ? 0 : MS_NODEV)
             | MS_NOSUID
             | (BIND_READONLY ? MS_RDONLY : 0)
6. 仅 new_flags != current_flags 时：
   mount("none", target, NULL,
         MS_SILENT | MS_BIND | MS_REMOUNT | new_flags, NULL)
```

精确位置：`bind_mount()` 377–486；步骤 1 为 396–400，路径／fd 与 mountinfo 为 402–445，目标 remount 为 448–459，子挂载为 465–485。`parse_mountinfo()` 在 245 行读取 `self/mountinfo`；`decode_mountoptions()` 82–125 仅解出 `ro`、`nosuid`、`nodev`、`noexec`、`noatime`、`nodiratime`、`relatime` 这些位，`rw` 映射为 0。[U-bind][U-bind-remount][U-mountinfo][U-decode]

因此：

- 只读 bind 的**第一次 mount 没有 `MS_RDONLY`**，只读由后续条件 remount 落实；不能把两者写成一个源码 mount 调用。
- 普通 bind 不保证源最终可写或可执行，它保留解码出的 `MS_RDONLY`／`MS_NOEXEC` 等原标志。`BIND_DEVICES` 只是不额外添加 `MS_NODEV`，不清除已有的 `MS_NODEV`。
- remount 次数取决于现有标志及可见子挂载。递归子挂载 remount 的 `EACCES` 被忽略；其他错误会返回失败，目标自身 remount 失败也不被此分支忽略。
- fd 编号由运行时 fd 分配决定，`/oldroot/proc/self/fd/<fd>` 是 readlink 辅助路径，**不是这个版本给 mount 传入的 source 或 target**。不能由它推导必须允许从 proc fd 任意挂载。

以上都来自固定版本算法；没有用本机某次 mountinfo 样本替代将来实际挂载树。

## 应用前的 NNP、映射与 capability 清理顺序

本节限定父拟议的“root 管理工件、普通非 root 用户运行”路线，即 `real_uid != 0`、非 setuid bwrap、无自定义 `--uid`／`--gid`／`--userns`／`--userns2`／`--userns-block-fd`。root 管理文件不等于以 root 身份运行程序。

1. `main()` 先取得真实 UID/GID，调用 `acquire_privs()`，然后 **2919 行设置 `PR_SET_NO_NEW_PRIVS=1`**，之后才解析 argv（2938）和 clone（3134）。非 setuid、非 root 且已有 permitted capabilities 会在 `acquire_privs()` 报错；正常非特权路线依靠新 user namespace。NNP 并非在应用 exec 前一刻才设置。[U-nnp][U-acquire][U-clone]
2. `--cap-drop ALL` 在解析时只把 `requested_caps[0..1]` 设为 0，并记录显式 cap 选项，**不是当场 `capset(0)`**。clone 创建 namespace 后，外部 monitor 调用 `drop_privs(false, false, true)`（3189），再放行内部子进程；不要把这个父分支的 drop 当成挂载子进程已经 drop。[U-cap-parse][U-monitor]
3. 子进程调用 `switch_to_user_with_privs()`（3279）：因为有新 user namespace，先 `drop_cap_bounding_set(false)`，目标是零 requested caps；非 setuid 随即返回，不在这里清空 effective/permitted。setup 所需 namespace 内能力仍用于之后的操作。[U-switch][U-before-mount]
4. `--dev` 在解析时设置 `opt_needs_devpts=true`（2147）。普通非 root 路线为挂 devpts，先把初层 namespace 的 UID/GID 0 映射到真实宿主 UID/GID：`ns_uid=ns_gid=0`，调用 `write_uid_gid_map(..., -1, true, false)`（3301）。该函数通过保留的 `/proc` fd 打开 `self`，依次写 `uid_map`、`setgroups="deny\n"`、`gid_map`。若宿主身份为 U/G，首层内容分别为 `0 U 1`、`0 G 1`。[U-dev-parse][U-before-mount][U-map]
5. 规范化源路径，完成上述 mount、两个 pivot 和 detach。**这些发生在应用分支最终 `drop_all_caps` 之前。**
6. 因初层映射为 0、目标 UID 仍为非零真实 UID，`main()` 3458–3495 的条件成立：再次 `unshare(CLONE_NEWUSER)`（3487），再次清 bounding set（3491），再映射目标 U/G 到上一层的 0：`U 0 1`、`G 0 1`。这次 `write_uid_gid_map(..., -1, false, false)` 不写 `setgroups`。这层由 bwrap 创建，早于 Electron；其目的来自 devpts 映射，不代表命令启用了 `--disable-userns`。[U-userns][U-map]
7. **3508 行 `drop_privs(!is_privileged, true, true)`** 在本路线等于 `drop_privs(true, true, true)`，经 `drop_all_caps(true)` 把 effective、permitted、inheritable 都设为零 requested set；然后设置 dumpable。`--cap-drop ALL` 已显式使用，因此不会走“root 且未指定 cap 选项时跳过 capset”的分支。[U-final-drop][U-drop][U-drop-all]
8. 设置最终 cwd `/app`，调用 `setsid()`；新 PID namespace 的 init 分支 fork 后还会 `drop_all_caps(false)`。应用分支调用 `set_ambient_capabilities()`，但零 requested set 不会发出 ambient raise；之后应用 seccomp 程序、`execvp("/electron/electron", argv)`（3632）。旧 argv 未提供 bwrap seccomp 程序。[U-cwd][U-init][U-exec][U-bounding]

源码的 `prctl_caps()` 对 `PR_CAPBSET_DROP` 的 `EINVAL`、`EPERM` **有意忽略**，循环上限是编译期 `CAP_LAST_CAP`。所以“调用了 bounding-set 清理”不等于已经实测 `CapBnd=0`；源码也明确依靠 NNP 限制 exec 增权。最终实际 `CapBnd/CapEff/CapPrm/CapInh/CapAmb` 仍需父读取核实。普通非 root 路线的最终 capset 失败会终止；仅凭 `--cap-drop ALL` 字样不能把所有失败归类为已成功清理。[U-bounding][U-drop-all]

### Ubuntu `.3` 的必要差异

`debian/patches/series` 只列两项：[U-debian]

| 补丁 | 精确影响 | 对本文结论的影响 |
| --- | --- | --- |
| `debian/Change-EPERM-error-message-to-show-Debian-specific-inform.patch` | 补丁第 14–22 行的 hunk，只替换 clone 失败的错误文本 | 不改变路径、mount、pivot 或 cap 顺序 |
| `CVE-2026-41163.patch` | 补丁第 28–50 行给 `drop_privs` 增加 `set_dumpable`；54–81 行调整三个调用点 | monitor 与最终应用路径仍设 dumpable；仅 setuid privsep 的未特权 setup helper 不设。没有移动 NNP／mount／pivot／capset 的阶段 |

Ubuntu changelog 第 1–28 行表明 `.3` 撤回 `.2` 的 link-resolution 补丁，保留 `.1` 的 ptrace 修复；与 `.3` 的实际 series 和 applied 源码一致。本文没有把已撤回的 `safe_openat`／destination fd 行为算进已装版。[U-changelog][U-debian]

## 哪些不确定性可由固定参数消除

| 对象 | 固定参数能确定的部分 | 仍依赖其他事实的部分 |
| --- | --- | --- |
| staging root | 已经固定为 `/tmp`；env 与 `--tmpfs /tmp` 不改变它 | AppArmor 路径解析与实际 mediation |
| app／runtime／scratch 源 | 可给定绝对 source 文本；父新 launcher 的路径确定后可代入本表 | `realpath` 指向、源对象和父目录稳定性；旧 J 本来就是随机的 |
| tmpfs data | 既有命令确定为 `mode=0755`；`--perms`／`--size` 能改变对应 `--tmpfs` 的 mode／size 字符串 | staging tmpfs 不受这些逐操作参数影响；未指定的大小等由内核默认处理 |
| bind／ro-bind | 目标路径、递归 bind、是否添加 readonly／nodev 已确定 | 固定 argv 没有覆盖 current flags 的选项；源挂载 flags、子挂载及后续传播仍依宿主 mount tree |
| proc 覆盖 | 候选仅上述四项 | `access(W_OK)` 结果及 LSM；没有固定 argv 参数直接选择这四项分支 |
| console | 既有 controller 的 stdout 普通文件使 tty 分支不触发 | 单凭 `--new-session` 不排除该分支：isatty 在解析参数前检查，setsid 在 setup 后执行；新 launcher 的 fd 接线尚未知 |
| 新 user namespace | 固定普通用户＋`--dev` 会触发上述第二层映射 | syscall 是否获准、映射是否成功及最终 namespace 身份 |

表格只说明参数的表达能力，不建议删除 proc／dev／namespace 或放宽策略来减少分支。挂载 flags 的数据源见 `[U-decode]`、`[U-bind-remount]`；tmpfs 参数见 `[U-tmpfs-parse]`；tty 检查见 `[U-tty]`、`[U-proc-dev]`。

## 仍未知与交回父的边界

- 新 launcher 的最终安装路径、source 真实路径、stdout／继承 fd 尚未提供；不能据旧 J 写出新工件的精确路径表。
- 未运行 syscall trace 或 audit；所有 syscall 表都是固定源码成功路径及条件分支的推导，不是本机 syscall 观测记录。实际失败点、AppArmor 接收的 path／flags 表达及最小 capability 集均未确定。
- 未证明专用 profile 的 `ix` 执行链、NNP 与已有 label stack 在本机的最终效果，也未验证 Chromium 后续自己的 namespace／mount 行为。本文停在 bwrap 的应用 exec 边界。
- 没有验证本机二进制与发布源码的构建对应、签名或可重现性；版本与 mode 只来自包查询及 stat。也未把 syscall flags 自动翻译成可加载的 AppArmor 规则。
- 研究仅用官方定版源码和 Ubuntu 发布源；下载内容通过 stdout／内存读取，未落其他源码副本。唯一工作区写入是本文，使用 `apply_patch`；未调用其他模型或 thread 接口。架构、安全策略、实际授权及最终验证由父持有。

## 永久来源索引

以下链接固定 commit 或源码包版本；函数、范围和分支见正文。没有使用 master 作为已装版证据。

[G-tag]: https://api.github.com/repos/containers/bubblewrap/git/tags/1e75470e57fb9d2e9028c1451d6bc856e0ac03ca
[G-bwrap]: https://github.com/containers/bubblewrap/blob/124c4cdf4321f63ef17a1cb0ce8f9dd45bd7adbe/bubblewrap.c
[G-bind]: https://github.com/containers/bubblewrap/blob/124c4cdf4321f63ef17a1cb0ce8f9dd45bd7adbe/bind-mount.c
[G-utils]: https://github.com/containers/bubblewrap/blob/124c4cdf4321f63ef17a1cb0ce8f9dd45bd7adbe/utils.c
[U-commit]: https://git.launchpad.net/ubuntu/+source/bubblewrap/commit/?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5
[U-dsc]: https://archive.ubuntu.com/ubuntu/pool/main/b/bubblewrap/bubblewrap_0.11.1-1ubuntu0.3.dsc
[U-orig]: https://archive.ubuntu.com/ubuntu/pool/main/b/bubblewrap/bubblewrap_0.11.1.orig.tar.xz
[U-debian]: https://archive.ubuntu.com/ubuntu/pool/main/b/bubblewrap/bubblewrap_0.11.1-1ubuntu0.3.debian.tar.xz
[U-changelog]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/debian/changelog?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n1
[U-base]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3050
[U-root]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3311
[U-finish]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3417
[U-path]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/utils.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n864
[U-pivot]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/utils.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n893
[U-resolve]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n1614
[U-env]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2514
[U-cwd]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3526
[U-clone]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3076
[U-op-list]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n210
[U-setup-call]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3410
[U-ops]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n1193
[U-priv-mount]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n1112
[U-proc-dev]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n1331
[U-tmpfs-parse]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2152
[U-label]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/utils.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n904
[U-bind]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bind-mount.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n377
[U-bind-remount]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bind-mount.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n448
[U-mountinfo]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bind-mount.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n229
[U-decode]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bind-mount.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n82
[U-nnp]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2908
[U-acquire]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n840
[U-cap-parse]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2633
[U-monitor]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3154
[U-switch]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n905
[U-before-mount]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3271
[U-dev-parse]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2140
[U-map]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n960
[U-userns]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3458
[U-final-drop]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3507
[U-drop]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n937
[U-drop-all]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n702
[U-init]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3558
[U-exec]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n3613
[U-bounding]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n758
[U-tty]: https://git.launchpad.net/ubuntu/+source/bubblewrap/tree/bubblewrap.c?id=4442b57f802c6a6199b1c3224295e44c6bb8afa5#n2929

上游对应文件：[bubblewrap.c][G-bwrap]、[bind-mount.c][G-bind]、[utils.c][G-utils]。Ubuntu 源码包入口：[版本发布记录](https://api.launchpad.net/1.0/ubuntu/+archive/primary/+sourcepub/18741056)、[该记录的 sourceFileUrls](https://api.launchpad.net/1.0/ubuntu/+archive/primary/+sourcepub/18741056?ws.op=sourceFileUrls)。
