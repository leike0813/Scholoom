# report-system 原生 SDK 与只读自检

在仓库根用普通实际／有效 UID 运行，要求 Linux x86_64、Node 24、已有 C 编译器、`/usr/include/systemd/sd-bus.h` 和 libsystemd 运行库：

```sh
node --test tests/fixtures/report-system-native/check.mjs
```

脚本调用既有 `node packages/platform/build-report-system.mjs /usr <本轮cache>/report-system`，不改 helper。每轮在 `~/.cache/scholoom-report-system-native/run-*` 独立编译，编译临时目录也在本轮 cache；不依赖 `/tmp` 或前轮二进制。保留二进制、`context.json` 及 `commands.jsonl`，测试输出会给出精确目录。后者逐条保存命令和参数数组、工作目录、退出码、signal、完整 stdout／stderr 及启动错误，断言失败前也先落证据。`context.json` 保存时间、真实／有效 UID、Node、SDK、编译器和 TMPDIR；`dpkg-query` 记录实际 SDK／运行库版本，不把版本号锁为永久测试条件。本片实施时二者均为 `259.5-0ubuntu3.4`。

验证真实普通 UID 的只读 `--check` 退出 0 且返回 `available`；无参数、未知命令、缺参及多参拒绝，参数完整的 `--kill` 和 `--capture configUUID storageUUID` 均在 `manager-identity` 阶段拒绝。所有拒绝必须非零退出且 stdout 为空，仅核错误阶段，不锁完整错误文本或 errno。完整参数使用固定合成身份；普通 UID 在目标解析和 system bus 操作前被拒绝。只读检查使用本机真实 system bus，不用成功替身；若本机条件不足则测试失败，不当作跳过或通过。

`capture-readers.c` 通过编译参数 `HEADER_SOURCE` 包含主线 `report-system.c`，只重命名其 main，直接调用静态 `read_at`、`birth`、`account`、`limit`，不复制解析实现。驱动使用已有编译器和 `-Wl,-l:libsystemd.so.0` 编译到本轮 cache；精确编译命令同样进入 `commands.jsonl`。

Node 独立读取自己的 `/proc/self/stat` 字段 22 与 `/proc/self/status` 四组 UID/GID，C 子进程经 `/proc/<Node PID>` 读取同一真实进程对象并比较；原始文本及预期保留在 `proc-oracle.json`。另用自有文件检查字段 21／22／23 取值不同、进程名包含右括号及换行的 stat，防止 birth 字段偏移或行处理回归。代表拒绝包括 stat 缺字段、账户不一致／缺换行、limit 空／超长／溢出／`max`／缺换行，以及 read_at 的符号链接与缓冲区上界；正例覆盖数字、零、uint64 上界和恰好容纳的读取。每次调用都在独立有时限子进程内执行，拒绝无 stdout，失败不影响后续用例。

本片只证明 SDK 可编译及上述读取／拒绝机制。脚本拒绝 root，不提权、不启动 unit、不联网、不安装依赖，也不操作真实报告目标或模拟成功 capture；没有验证 root capture／stop、跨账户权限、完整后代停止、系统部署或 T1，不能据此宣布报告隔离可用。
