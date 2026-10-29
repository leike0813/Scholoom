# 固定 native gate 的普通 UID 离线夹具

本片只校准真实 FIFO 许可、固定 exec、stdio 与目标前 FD 清理，不是可部署的系统 gate。它不启动 systemd、账户、AppArmor、namespace、浏览器或模型，不证明独立身份、完整后代停止、唯一准入、真实 T1/T2 或报告隔离。原安装方案与系统模板由主线维护，本目录不注册公共操作或改变生产平台。

## 重建与运行

在仓库根使用已经安装的 Linux x86_64 C 编译器、Node 和 mkfifo；不安装依赖。每轮使用新的自有 cache 目录，输入和结果不依赖当前 `/tmp`：

```sh
gate_cache=/home/joshua/.cache/scholoom-round21-acceptance-pCcY4R/next/zotero-ecosystem
mkdir -p "$gate_cache/tmp"
TMPDIR="$gate_cache/tmp" node tests/fixtures/report-system-gate/rebuild.mjs "$gate_cache/final"
TMPDIR="$gate_cache/tmp" SCHOOLOOM_SYSTEM_GATE_CACHE="$gate_cache/final" node --test tests/fixtures/report-system-gate/selftest.mjs
```

先构建，再固定源码及产物测试。`selftest`不构建；输入用`wx`创建，不能在相同目录重跑冒充新轮。gate／probe／生成头文件／原策略和oracle源码摘要在`build.json`，自测前后核对，测试期间不改产物。结果为`results.json`及Node测试输出；它们是夹具证据，不是平台ready／停止回执。

## 实际复用与固定 Interface

- 原`packages/platform/native/isolated-report-gate.c`使用FD100报告R/E、stdin读取G，再按argv执行。它不直接创建OS范围，但依赖原controller已经准备的策略、FD100和目标参数；不能原样作为本系统模板的固定路径gate。
- `rebuild.mjs`从原`isolated-report-scope.c`按现有`DENY`宏到`children`函数之间的代码，逐字提取`policy()`及宏到cache头文件；不复制controller、scope管理或重新维护一份BPF。原文件没有独立policy导出，提取seam改变时构建必须停止并审查；这是构建期依赖，不是生产策略发布接口。
- 新`gate.c`只接受无参数启动。程序、输入、FIFO及普通日志路径在可信构建时生成到头文件，argv固定为该probe、该输入和`normal`，exec环境为空；没有从运行请求接收exec／argv／env。
- 先按原`isolated-report-native/rebuild.mjs`重建未修改的上游probe，作为构建来源对照。新`probe.c`包含其原源码、重命名C入口，复用原`approved_bytes`字节oracle与raw syscall；原汇编入口指向新包装，不重跑上游整套能力／后代矩阵。包装仅校验FD42已关闭、原固定字节和一行固定输出。

许可格式是**一个G随后写端关闭（EOF结束封包）**。空EOF拒绝，非法字节或多于一个字节拒绝；单有G但写端未结束不会exec。gate核FD0是构建指定FIFO的只读端、FD1/2是同一指定普通日志的只写端，并设置64KiB RLIMIT_FSIZE。关闭FD0和FD≥3后，从原policy装入当前子进程的no-new-privileges/seccomp，再执行固定probe；不加载系统策略。

FD3是可信自测用的观察socketpair，gate只写一个R后立即关闭。R表示“stdio已校验、尚未读取许可”，用于无sleep的采证屏障，不能视为OS ready；probe不继承它。FD42特意传入一个真实普通文件，目标使用原策略明确允许的`close`检验，不能以seccomp拒绝冒充关闭。

## 五个代表结果

1. 直接运行同一包装且带真实FD42：`close(42)`成功，包装退出90，证明危险正控制实际到达；不执行能力攻击代码。
2. gate报告可信观察点后，外部只读`/proc/PID/exe`仍为gate、日志为空、实际文件大小限额为65536/65536；发送G并结束FIFO写端后，目标退出0，输出精确的`fixed probe consumed approved report bytes\n`。成功同时经过原字节oracle及FD42的EBADF核查。
3. 空FIFO EOF：退出65，目标日志为空。
4. 非法X：退出66，目标日志为空。
5. GG：退出66，目标日志为空。

测试显式要求实际与有效UID均非0；没有业务数据、内部权限成功替身或OS范围。FIFO、字节、普通日志、真实FD与进程均属于本轮。每个子进程有固定5秒失败清理预算，正常收尾等待其close；异常仅kill本轮自有child并等待close，不碰共享DISPLAY或其他进程。测试不fork后代，不能从这些close记录推完整OS范围停止。

## 下一次真实 T1 必须补的差异

- 本gate的stdio身份绑定是登录UID及cache对象；真实模板的FIFO／日志由root M/PID1创建、P可能是DynamicUser，不能直接沿用`st_uid==getuid()`，须按主线批准的受保护对象绑定处理。
- cache编译路径、fixture FD3观察及G+EOF封包是本片明确约定；系统模板没有这个观察FD。M的实际观察、许可写端关闭、跨UID及RootDirectory前后打开顺序要单独接线，不能把本片R当系统证明。
- 没有挂载最小文件视图或AppArmor；原policy允许若干只读openat，本普通UID仍能访问宿主读权限范围。当前子进程seccomp与FD42结果不证明文件／网络／代理完整隔离，也不证明首条用户态指令前的身份／LSM附着。
- PID1实例／InvocationID／cgroup物理身份、真实资源范围、每实例身份、后代／unknown／停止落盘及K唯一ProcessAdmission均未接入。原records UUID、M宿主cgroup只读视图及私有IO Seam继续由主线设计，不在本夹具造manager、第二台账或安装器。

原始首次失败、最终命令／源码产物对应和交回patch由本轮cache `RESULT.md`维护；主线接收本离线片后才决定后续T1实施授权。
