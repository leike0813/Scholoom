# Ubuntu 7.0.0-38.38：自动附着前已存在的 unconfined tracer

研究日期：2026-10-29。范围仅为本机对应 Ubuntu 已应用补丁源码中的 AppArmor 自动附着、已有 ptrace 关系和 exec-stop 顺序。没有安装、策略加载、namespace/browser/ptrace 校准；没有修改生产、候选或原审查报告。

**结论：对应本机包版本的 Ubuntu 源码不会因为候选 `deny ptrace (tracedby) peer=unconfined`，在 exec-stop 前拒绝题设中的已跟踪进入。** 原先“是否存在 unconfined 特殊放行”的源码未知已有精确版本答案：存在，且该分支不评估目标域的 tracedby deny。两项题设 sysctl 不改变这条检查路径。这是对应版本源码结论，不是本机漏洞实跑或二进制重现构建证明。

## 版本与固定来源

本机只读结果：

| 依据 | 实际值 |
| --- | --- |
| `uname -r` | `7.0.0-38-generic` |
| `/proc/version_signature` | `Ubuntu 7.0.0-38.38-generic 7.0.14` |
| 已安装 `linux-image-7.0.0-38-generic` | 版本 `7.0.0-38.38`；源包 `linux-signed 7.0.0-38.38` |
| 已安装 `linux-modules-7.0.0-38-generic` | 版本 `7.0.0-38.38`；内核主体源包 `linux 7.0.0-38.38` |
| 本机内核包 changelog 首行 | `linux (7.0.0-38.38) resolute; urgency=medium` |
| 两项 `/proc/sys/kernel/apparmor_restrict_unprivileged_*` | `unconfined=1`、`userns=1` |

Ubuntu 官方 [发布记录 18818983](https://api.launchpad.net/1.0/ubuntu/+archive/primary/+sourcepub/18818983) 确认 `linux 7.0.0-38.38`、resolute、Security pocket。其 [sourceFileUrls](https://api.launchpad.net/1.0/ubuntu/+archive/primary/+sourcepub/18818983?ws.op=sourceFileUrls) 提供该版本 `.dsc`、`.diff.gz` 和 orig tarball 的官方链接。

已读取的 [linux_7.0.0-38.38.dsc](https://launchpad.net/ubuntu/+archive/primary/+sourcefiles/linux/7.0.0-38.38/linux_7.0.0-38.38.dsc) 声明 `Source: linux`、`Version: 7.0.0-38.38`，`Vcs-Git` 指向 Ubuntu Kernel Team 的 `linux/+git/resolute` 仓库；没有下载/解包大型 orig tarball，也没有安装源包或修改 apt sources。

对该官方仓库执行只读 `git ls-remote` 得到：

```text
a6992b931e773a6c6261abe4c1c417ffeac8bd4d refs/tags/Ubuntu-7.0.0-38.38
740b32353f43e9b00d0350d6fa7b29a6667deabd refs/tags/Ubuntu-7.0.0-38.38^{}
```

以下均固定到 **Ubuntu commit `740b32353f43e9b00d0350d6fa7b29a6667deabd`**，不是上游 v6.17 或移动分支。该 commit 的 [debian.master/changelog](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/debian.master/changelog?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1) 同样以 `linux (7.0.0-38.38)` 开头。实际读取使用各链接对应的 cgit `/plain/` 接口。

## 精确调用路径

1. **自动附着选取候选域。** [domain.c:692–716](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n692) 的 `profile_transition()` 对原 unconfined profile 调用 `find_attach()`；匹配到目标后直接返回新 label。普通路径没有先调用 `aa_change_profile()`。

2. **exec 凭据阶段检查已有 tracer，但对 unconfined 提前成功。** [domain.c:972–1037](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n972) 的 `apparmor_bprm_creds_for_exec()` 构造新 label；发现 `LSM_UNSAFE_PTRACE` 时，在第 1008–1012 行调用 `may_change_ptraced_domain()`。该函数 [domain.c:49–80](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n49) 初始化 `error=0`，读取 tracer label 后执行：

   ```c
   if (!tracer || unconfined(tracerl))
       goto out;
   ```

   因此题设 tracer 为 unconfined 时，不会到第 70 行 `aa_may_ptrace()`；目标域 tracedby deny 不参与这次转换判断。若 tracer 不是 unconfined，则可能进入权限核对，本结论不将两种情况混同。

3. **普通 ptrace 权限函数也有同类特殊处理。** [task.c:243–301](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/task.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n243) 中，`profile_tracee_perm()` 在 `unconfined(tracer)` 时直接返回 0；`profile_tracer_perm()` 对 unconfined tracer profile 也直接返回 0。因此不能假设另一个 AppArmor ptrace 权限入口必然替第 2 步评估这条 deny。DAC、Yama 或其他 LSM 的独立约束仍是另一层，本研究不把 AppArmor 放行等同于所有系统检查放行。

4. **该检查确实早于 exec-stop，但它选择了放行。** [fs/exec.c:1737–1748](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/exec.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1737) 先执行 `security_bprm_creds_for_exec()`，成功后进入 `exec_binprm()`。新凭据在 [fs/exec.c:1253–1271](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/exec.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1253) 提交；随后 [fs/exec.c:1717–1721](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/fs/exec.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1717) 调用 `ptrace_event(PTRACE_EVENT_EXEC, old_vpid)`。已开启该 event 时，[include/linux/ptrace.h:148–155](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/include/linux/ptrace.h?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n148) 调用 `ptrace_notify()` 停给父 tracer；未启用 event 的传统跟踪路径另有 SIGTRAP。此时尚未运行 launcher 的用户态入口，更早于 main 内的禁 dump 或 TracerPid 检查。

5. **AppArmor 的凭据提交回调没有补做这项拒绝或解除关系。** [lsm.c:1151–1178](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/lsm.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1151) 的两个回调处理继承 FD、pdeath_signal、rlimits 和临时上下文，没有在此添加对 unconfined tracer 的 tracedby 核查或 ptrace detach。

## 两项 sysctl 为何不补上这条检查

- `apparmor_restrict_unprivileged_unconfined` 在 [lsm.c:2887–2891](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/lsm.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n2887) 绑定到 `aa_unprivileged_unconfined_restricted`。对应 [domain.c:1475–1492](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1475) 的限制位于显式 `aa_change_profile()`，将符合条件的转换改为 stacking；不是第 1 步普通 exec 自动附着路径，也没有改写第 2 步的提前返回条件。
- `apparmor_restrict_unprivileged_userns` 在 [lsm.c:2865–2869](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/lsm.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n2865) 绑定到 `aa_unprivileged_userns_restricted`，在 [lsm.c:1245–1270](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/lsm.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1245) 的 `apparmor_userns_create()` 使用，具体规则沿 [task.c:427–511](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/task.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n427)。它控制后续 user namespace 创建，不是在 launcher exec-stop 前进行 tracer 冲突拒绝的检查。

## 对候选入口能作出的限定判断

在“原 tracee 从 unconfined 正常 exec 自动附着、已有 tracer 的完整 label 为 unconfined、其他独立检查没有先拒绝 exec”的题设下，**不能依赖候选 deny tracedby 在用户态执行前拒绝这次进入**。对应版本源码已证明该 AppArmor 检查路径放行；不再只是用上游版本推测本机是否有同类分支。

main 中读取 TracerPid 并拒绝非零/不可读可增加明确的失败检查，但不能作为 exec-stop 前的入口保证：父 tracer 可早于该检查取得控制。静态链接和 main 开头禁 dump 也不改变上述内核调用顺序。这只回答入口机制，不选择新的策略、权限或架构方案。

仍未证明：实际已加载 profile/stack、任一真实 tracer 的 label、本机运行二进制与官方源码的逐字/可复现构建一致性，以及具体利用能否通过其他 LSM、DAC 和运行条件。没有执行 ptrace、安装或浏览器测试，不声称“本机利用已成功”。

本轮只新增此报告。官方固定版本源码足以回答所问分支，因此停止研究；没有继续泛搜或修改原候选。

## 追加：强制 stacking、userns/capability 与 0750 入口（2026-10-29）

本次仅追查同一 Ubuntu commit `740b32353f43e9b00d0350d6fa7b29a6667deabd` 的现有调用路径，并只读本机 `/etc/apparmor.d/unprivileged_userns`；没有运行 aa-exec、namespace、策略或其他系统校准，没有选择服务架构。

**准确结论：强制 stack 保留原 unconfined 成员，userns 创建仍逐成员处理其默认限制；但 capability 检查本身跳过 unconfined，不能把二者笼统称为“原 unconfined 对所有能力继续默认拒绝”。0750 和独立服务 UID 不会阻止按名称请求把目标 profile 加入 stack；这类 stack 转换也不等于获得纯目标域、服务 UID 或绕过文件 DAC。**

1. **按名称转换与执行入口文件分开。** [domain.c:289–301](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n289) 的 `change_profile_perms()` 直接允许 unconfined 的 change-profile/onexec 请求；[domain.c:1475–1492](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1475) 在题设 sysctl=1、默认 unconfined 且缺宿主 CAP_MAC_OVERRIDE 的条件下强制 `stack=true`。该路径不打开或执行目标 attachment 文件，不检查该文件是否为 0750。故 0750 本身不能成为“原用户不能按 profile 名称进入含该 profile 的 label”的证明。

2. **原 unconfined 不会在合并时被当作多余权限删除。** 立即转换沿 [domain.c:1583–1589](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1583) 的 `aa_label_merge(label,target)`；onexec 保存 stack 标志后沿 [domain.c:876–906](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/domain.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n876) 合并原成员和目标。合并实现 [label.c:1063–1096](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/label.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1063) 保留不同 profile，原 unconfined 因而仍是一个独立成员；不能把结果当作只有目标 profile 的自动附着 label。

3. **userns 的默认限制会被处理，而非被目标 allow 覆盖。** [lsm.c:1245–1270](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/lsm.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n1245) 调用 `fn_label_build()`；[include/lib.h:305–347](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/include/lib.h?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n305) 对所有成员调用回调、遇错误失败，并合并各成员产生的 label，**不跳过 unconfined**。默认 unconfined 在题设 userns sysctl=1、调用者没有当前 user namespace 的 CAP_SYS_ADMIN、默认规则未显式介入时，按 [task.c:444–473](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/task.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n444) 转入名为 `unprivileged_userns` 的 profile；找不到该 profile 则进入拒绝处理。目标 profile 的 userns allow 不会让这个成员的回调被省略。**这不表示 userns 创建本身必定失败**：该默认机制可以允许创建，同时给新凭据加入受限 profile。

4. **capability 的持续限制来自受限成员。** [capability.c:179–191](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/capability.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n179) 使用 `fn_for_each_confined()`；[include/label.h:180–184,221–232](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/include/label.h?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n180) 与 [label.c:487–497](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/label.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n487) 表明它跳过 unconfined profile，逐受限成员汇集错误。创建前不能假称原 unconfined 自带 deny-all capability；创建后如果带上 enforce 的 `unprivileged_userns`，其 capability deny 则不能被另一成员的 allow 抵消。本机磁盘文件的 `profile unprivileged_userns` 确有 `audit deny capability,`、`audit deny change_profile,`、`allow userns,` 和子执行 stacking 规则。**本次未读回内核加载策略，不能把磁盘正文冒充已加载事实**；相同 enforce 策略加载时，才可落实这条具体 deny 结论。若已加载 profile 不同，其实际能力规则仍未知。

5. **0750/独立 UID 能证明的边界有限。** [task.c:47–89](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/resolute/tree/security/apparmor/task.c?id=740b32353f43e9b00d0350d6fa7b29a6667deabd#n47) 的 `aa_replace_current_label()` 复制当前凭据并替换 AppArmor label，不切换 UID/GID。因此普通原用户通过该转换不会变成服务用户；也不会因 profile 的 capability allow 获得宿主 capability。假定原用户不在执行组、没有 ACL 或其他授权，0750 仍限制其执行真实受控入口，但不能阻止第 1 步的按名称 stacking。后续任意程序能否 exec，还要同时满足该程序的 DAC 和各 profile 的 exec 规则，不能推导为“aa-exec 可任意执行所有程序”。

对所问绕过方式的最终限定：**不能用“root 控制 0750、不同 UID”证明原用户绝无目标 profile stack 成员资格；可以由上述源码证明，题设下按名称转换不会自动清除原 unconfined 的 userns 处理，也不会取得服务 UID。** 若实际默认 `unprivileged_userns` 为上述 enforce 规则，后续 namespace 内 capability 仍受其 deny，不能只借目标 profile 的 allow 得到与专用服务自动附着相同的能力集合。更广的安全保证取决于完整有效策略和入口权限，本节不作架构或验收判断。

本次仅追加本节。得到上述源码结论后停止，没有运行 aa-exec 或系统实验。
