# T1.0 固定 native 系统校准包：只离线准备

本目录只生成审查材料，并运行普通UID自检。不提供C/M实现、安装器、manager权限或公共操作，不执行系统单位，也不替代已接收的`report-system-gate`许可5/5；旧夹具保持只读。

当前路线沿报告design第22轮：C唯一管理原records／冻结字节／日志，K掌握领域授权、freeze及唯一ProcessAdmission，M只做固定OS动作／采证／许可。本包的`expected.bin`是**一次合成校准的对象预核表**，不是records、configId、原intent、持久ACK或第二台账；随机calibrationId也不冒充原records UUID。

## 普通UID重建与自检

在仓库根使用已装Node、Linux x86_64 C编译器、mkfifo；不安装依赖。输出必须是新的自有cache目录：

```sh
t10_cache=/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/next/zotero-ecosystem
mkdir -p "$t10_cache/tmp"
TMPDIR="$t10_cache/tmp" node tests/fixtures/report-system-calibration/prepare.mjs "$t10_cache/final"
TMPDIR="$t10_cache/tmp" SCHOOLOOM_T10_BUNDLE="$t10_cache/final" node --test tests/fixtures/report-system-calibration/selftest.mjs
```

`prepare`拒绝实际／有效UID0，只写给定cache，先静态编译，再创建合成输入、FIFO、空普通日志和预核表；输出`bundle.json`列精确路径、创建者模拟UID、命令、源码／二进制／单位文本摘要及未来对象权限。自测不构建，前后核固定产物不变。C编译方式复用既有静态原生夹具标志，不复制或执行旧controller、manager或旧安全矩阵。

`offline-root/run/<calibration-name>/`是**本cache内的替代文件树**，不会写真实`/run`。`bin/probe`为唯一静态程序，`c-owned/`是本登录UID扮演创建方的合成材料；实际／有效UID相同不是跨UID成功。真正的C保护身份尚未提供。

## Probe与对象契约

静态probe没有exec、DBus、mount、namespace或策略修改逻辑，仅接受三种固定调用：

- 无参数：候选systemd OpenFile接线；要求LISTEN_PID与自身PID相同、两份命名FD恰为approved/expected。候选按LISTEN_FDNAMES识别两种次序，不把声明顺序当保证。FD从3起与LISTEN_*的实际实现必须在获批T1.0校准，当前未由PID1运行，失败就拒绝，不能改用数字模式冒充通过。
- `--offline`：仅自测用的数字FD布局，FD0=真实只读FIFO，FD1/2=同一普通只写日志，FD3=只读固定输入，FD4=只读预核表；FD3不是旧gate的观察socket。
- `--observe`：仅观察构建固定的probe单位对应`/sys/fs/cgroup/system.slice/...`，读取目录dev/ino、cgroup.events及挂载只读标志；不存在／无权均返回实际errno与非零结果。无任意路径或通用exec参数。

observer分别按固定pathname执行stat/read，只采当前事实，不pin原cgroup对象，也不提供停止CAS。主线补充的InvocationID对象路径停止候选及其未证边界见管理员计划，不在probe内实现管理调用。

预核表为Linux x86_64限定的104字节：8字节`T10OBJ1\0`及FIFO／日志／输入的三组uint64 little-endian dev、ino、uid、文件类型。probe要求表为单链接只读普通文件，三对象owner与表owner一致；**从未要求P owner等于C**。stdout/stderr不匹配原日志时直接拒绝，不向错误sink写诊断；输入替换可写入已核日志说明失败。该表自身的可信来源和C-root bootstrap仍需真实C/M绑定，不能只凭表内UID认证C。

对象一致后才读固定G+EOF、核来自原probe oracle的`approved report bytes\n`。这是让数据／FIFO接点可测，不再复制旧许可正负矩阵。程序同时报告实际PID／UID／有效UID／组、capability集合、NoNewPrivs／Seccomp／TracerPid、LSM与自身cgroup；所有读失败显式保留errno。日志只是受保护固定代码的观测输出，不能充当OS ready、完整停止或领域授权回执。

## 本片三项真实离线行为

1. 普通UID实际传入预核FIFO／日志／输入／表并读固定字节，外部核dev/ino/owner及实际身份。
2. 预核后将输入路径换成同内容的新对象，再传入真实FD，probe拒绝对象连续性；恢复仅本测试保存的cache对象。
3. 普通UID运行固定observer，实际读不到尚未启动的唯一系统scope，记录ENOENT；这是缺证被准确表达，不能当root空capability观察成功。

每个自有child采用固定5秒失败清理预算，正常等待close；异常只kill本轮child并等待close。测试不创建后代或服务，不接管DISPLAY；全部合成输入及结果保留在本cache。

## 两份临时单位与纯离线verify

`offline-root/etc/systemd/system/`包含唯一随机校准名字的两份文本：probe单位使用DynamicUser、两项read-only OpenFile、FIFO stdin、普通日志stdout/stderr；observer单位仅以root＋空CapabilityBoundingSet候选观察固定兄弟scope，ProtectControlGroups=true保留宿主只读视图，P用strict。二者无Install段、Restart=no、限5秒运行和64KiB单日志；DefaultDependencies=no只用于已启动系统上的临时观测，不是生产生命周期配置，不提供断连／unknown收尾保证。

只有核当前工具help和man后才可在本cache调用：

```sh
systemd-analyze verify --root="<bundle>/offline-root" --generators=no --man=no --recursive-errors=yes "<精确probe单位名>" "<精确observer单位名>"
```

实际参数从本次`bundle.json`读取，不能把示意占位符原样执行。verify只加载本地文本、依赖与可执行路径，不启动单位；使用替代根、不启generators、不检查man，且将DBUS_SYSTEM_BUS_ADDRESS指向本cache不存在的socket，避免任何误连。`--offline=`仅适用于security，不能冒用它证明verify隔离。解析成功不证明打开顺序、身份切换、policy、挂载或真实管理权限；原生OpenFile机制文档也没有承诺stdio降权前后的完整顺序。

真实权限申请、影响对象、失败停止和unknown保全见[ADMIN-PLAN.md](ADMIN-PLAN.md)。所有系统操作均需主线先审完整包及缺前置后**另行授权**；当前没有部署许可。
