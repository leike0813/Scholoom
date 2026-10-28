# Electron 44.5.1 Windows：受管 GUI 宿主的一次性私有启动输入

调查日期：2026-10-29。范围：官方固定版本源码、官方仓库 issue、Microsoft 文档及已下载日志的只读核对。本文记录事实与候选理由，不作架构决议，不包含生产改动或 Windows 实跑结果。

## 结论与证据强度

**已确认一个足以解释现有读取路径失败的直接机制：Electron 44.5.1 在 Windows GUI main 的初始化中，无条件将 `process.stdin` 替换成立即 EOF 的模拟流。** 这与继承的 CRT fd 0 是否仍可读是两件事。设置 `ELECTRON_NO_ATTACH_CONSOLE=1` 或增加 `--enable-logging` 都不会取消这项替换。

**优先候选是保留当前受管启动、Windows Job 和 `child.stdin.end(message.input)`，Electron 端改用公开 `fs` API 对 fd 0 作有界读取。** 这是源码支持的候选，尚不是 Windows 验证通过的修复。若 fd 0 已失效或被初始化为 `nul`，绕过 `process.stdin` 仍不能取得输入，必须由合成字节计数对照区分。

## 固定版本与本地观察

- Electron 官方 `v44.5.1` annotated tag 对象为 `b4404a4d56d047147aa3474af1817ab902062aba`，指向提交 **`19c601167d4ae75989938416c18ed81eb21c6020`**；下文 Electron 源码均固定到该提交。[tag API](https://api.github.com/repos/electron/electron/git/tags/b4404a4d56d047147aa3474af1817ab902062aba)
- 该提交的 `DEPS` 指定 **Chromium `152.0.7977.130`、Node `v24.21.0`**。Node、Chromium 引用按这两个官方版本固定；Electron 自带补丁另行核对，不能把纯 upstream 等同于实际二进制。[DEPS:3–7](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/DEPS#L3-L7)
- 本地日志 `/home/joshua/.cache/scholoom-finish-active/windows-zotero-first-job.log:185` 记录安装 `electron 44.5.1`。用户将该日志关联到 [run 40782057133 / job 123145932489](https://github.com/leike0813/Scholoom/actions/runs/40782057133/job/123145932489)。本轮未重新下载 artifact。
- 日志第 290、292 行的两次失败均为 `JSON.parse(input)` 的 `Unexpected end of JSON input`；第 305–311、340–346 行定位到构建后 `managed.cjs:7856`。此段测试第 366–369 行为 **2 failed、8 passed**；后续另一段 smoke 第 400 行为 **8 passed**。日志没有输入字节数，单凭异常不能区分空串与不完整 JSON。
- 用户提供的“同平台 Node fixed-host 先前 25/25 通过”作为对照背景保留；本轮所读日志未提供这份先前记录，未独立核验其版本和启动条件。不能将它当作 Electron fd 0 已成功读取的证据。

当前工作区源码与日志相符的路径：

- [`apps/zotero-host/src/main/managed.ts:20–24`](../../../apps/zotero-host/src/main/managed.ts#L20-L24) 从 `process.stdin` 累积输入，上限 8192 字节；第 36 行解析后交给 `connectHost`。
- [`packages/platform/src/command-worker.ts:31–37`](../../../packages/platform/src/command-worker.ts#L31-L37) 使用 `windowsHide: true`、`shell: false`、三个 `pipe` 启动目标；第 103–104、129–130 行忽略 stdin 写错误并 `end(message.input ?? '')`。所以“调用了 end”本身不构成 Electron 已收取输入的回执，也不能从现有记录排除写错误。

上述本地源码按调查时工作区读取；未声称其完整内容就是失败 job 的提交快照。

## 已确认的官方处理链

### 1. Electron 的 JS 属性替换直接决定 `process.stdin` 的行为

Windows GUI main 的 [`lib/browser/init.ts:12–13`](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/lib/browser/init.ts#L12-L13) 先加载 common init，再加载应用入口。该版本 [`lib/common/init.ts:63–75`](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/lib/common/init.ts#L63-L75) 在 `process.platform === 'win32'` 时：

1. 新建 `Readable`，立即 `push(null)`；
2. 给 `process.stdin` 定义返回该流的 getter；
3. 将该属性设为 `configurable: false`。

这段代码没有检查控制台变量、日志开关、输入句柄类型或 fd 0。应用对这个流作异步迭代会直接结束，当前初值 `input = ''` 因而保持空串。不能靠 `resume()`、等待 `app.whenReady()`、修改父侧 flush 时机或重新定义 `process.stdin` 修复这条路径；固定版本源码已给出比“GUI 程序一般不能 pipe”更具体的解释。

### 2. `ELECTRON_NO_ATTACH_CONSOLE` 只控制一处原生控制台路由

该版本 Windows 原生入口是 **`shell/app/electron_main_win.cc`**。[`157–167` 行](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/shell/app/electron_main_win.cc#L157-L167) 的条件为 `run_as_node || !IsEnvSet("ELECTRON_NO_ATTACH_CONSOLE")`，满足时调用 `base::RouteStdioToConsole(false)`。

- GUI 模式下，变量被设置会跳过此调用；判断函数使用 `getenv_s` 检查存在性，没有解析字符串 `1` 为布尔值。[IsEnvSet:52–56](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/shell/app/electron_main_win.cc#L52-L56)
- run-as-Node 分支仍调用它，随后走 `NodeMain`；不能把这一分支的结果等同于加载 GUI main 的结果。
- 固定版本的官方文档将变量定义为不附着当前 console session，没有承诺恢复 stdin。[环境变量文档:109–111](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/docs/api/environment-variables.md#L109-L111)

### 3. Chromium 的 `RouteStdioToConsole` 有保护条件，不能见到 AttachConsole 就认定管道被覆盖

Chromium `152.0.7977.130` 的 [`base/process/launch_win.cc:188–258`](https://github.com/chromium/chromium/blob/152.0.7977.130/base/process/launch_win.cc#L188-L258) 显示：

- stdout 或 stderr 的 CRT fd 与底层句柄已有效时，函数提前返回；源码明确提到保留 Buildbot/Cygwin 的 pipe 输出。
- 否则尝试 `AttachConsole(ATTACH_PARENT_PROCESS)`；是否另建 console 受参数控制。
- 后续显式 `freopen("CONOUT$", ...)` 和 `_dup2` 针对 stdout/fd 1、stderr/fd 2，没有显式重开 stdin/fd 0。

Microsoft 另说明 GUI 子进程可以继承标准句柄；附着 console 时的标准句柄替换受 `STARTF_USESTDHANDLES` 影响。因此“Windows GUI executable 必然拿不到父进程管道”不是成立的通用结论。这里必须分别检查 Win32 标准句柄、CRT fd、Electron JS 属性。[AttachConsole](https://learn.microsoft.com/en-us/windows/console/attachconsole)、[GetStdHandle / Attachment behavior](https://learn.microsoft.com/en-us/windows/console/getstdhandle)

### 4. `--enable-logging` 另有控制台副作用，但不是 stdin 开关

固定版本 [`shell/common/logging.cc:82–137`](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/shell/common/logging.cc#L82-L137) 决定 Chromium 日志目的地；官方文档也将该开关定义为 stderr／文件日志。[开关文档:69–85](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/docs/api/command-line-switches.md#L69-L85)

还需计算 Electron 对 Chromium 的实际补丁：[`logging_win32_only_create_a_console_if_logging_to_stderr.patch:15–38`](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/patches/chromium/logging_win32_only_create_a_console_if_logging_to_stderr.patch#L15-L38) 在 Windows content 启动路径中，针对启用 stderr 日志的参数调用 `RouteStdioToConsole(true)`；`file`、`handle` 或显式 `log-file` 被排除。**此处没有检查 `ELECTRON_NO_ATTACH_CONSOLE`。** 因而该变量不等于禁止启动链上所有 console 路由。

这只能证明日志参数可能影响原生 console 行为，不能证明它能使 `process.stdin` 读到输入；第 1 节的无条件 EOF 替换仍然存在。默认／固定变量对照若同时改变日志参数，也不能单独归因给变量。

### 5. 原生 fd 0 仍有成立的传输依据，也有明确的失效边界

Node `v24.21.0` 中：

- Windows libuv 将 stdio 的 pipe 句柄填入 CRT 继承表；`CreateProcessW` 使用 `STARTF_USESTDHANDLES`、`lpReserved2/cbReserved2`，并设置 `hStdInput` 等标准句柄。[process-stdio.c:169–253](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/process-stdio.c#L169-L253)、[process.c:1020–1030](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/process.c#L1020-L1030)
- 普通 `pipe` 与 `overlapped` 在 Node 入口采用不同标志；普通 pipe 的子端不是因父侧异步 IO 就自动变为 overlapped。libuv 先建立并连接两端，再将 client handle 交给子进程。[process_wrap.cc:158–170](https://github.com/nodejs/node/blob/v24.21.0/src/process_wrap.cc#L158-L170)、[pipe.c:294–335](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/pipe.c#L294-L335)、[pipe.c:394–450](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/pipe.c#L394-L450)
- `PlatformInit` 检查 CRT fd 0–2；无效或 `FILE_TYPE_UNKNOWN` 的 fd 会被关闭并以 `nul` 重开，有效 fd 不走该替换。[node.cc:645–658](https://github.com/nodejs/node/blob/v24.21.0/src/node.cc#L645-L658)
- Electron 确实调用 `InitializeOncePerProcess`，并仅在 `--no-stdio-init` 下设置相应跳过标志。[node_bindings.cc:704–720](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/shell/common/node_bindings.cc#L704-L720) 官方将该开关用于 Windows `nul` 设备禁用导致的初始化崩溃，不是恢复 JS stdin 的开关。[文档:200–203](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/docs/api/command-line-switches.md#L200-L203)

普通 Node 自己的 `getStdin()` 会按 fd 0 类型创建 TTY、文件流或 pipe socket，未知类型才返回空流；Electron GUI 的 common init 提前将这一属性替换掉了。[Node getStdin:194–246](https://github.com/nodejs/node/blob/v24.21.0/lib/internal/bootstrap/switches/is_main_thread.js#L194-L246) 这解释了为什么 Node 对照通过不能保证 Electron 的同名 JS 属性可用。

## 官方 issue 的适用范围

| 官方记录 | 实际支持的事实 | 不能据此推出 |
| --- | --- | --- |
| [Electron #21705](https://github.com/electron/electron/issues/21705)，Electron 7.1.8 / Windows 10 | 报告明确指出 common init 提供只发送 EOF 的模拟 stdin；与本轮固定源码吻合 | 不能把 closed 当作已修复；[关闭说明](https://github.com/electron/electron/issues/21705#issuecomment-794700071)是旧版本停止支持后的清理 |
| [Electron PR #5776](https://github.com/electron/electron/pull/5776)，2016 | 引入 `RouteStdioToConsole` 的历史说明涉及 VS 2015 与 stdin 限制 | 历史描述不能替代 44.5.1 的句柄继承、Node 初始化和 JS 替换逐层核对 |
| [Electron #5713](https://github.com/electron/electron/issues/5713)，1.1.3；[变量有效的评论](https://github.com/electron/electron/issues/5713#issuecomment-222604583) | 问题和验证重点是子进程 stdout/stderr 跑到主 console；有人报告变量改善输出捕获 | 不能作为当前版本 stdin 或 token 启动输入成功的证据 |
| [Electron #4552](https://github.com/electron/electron/issues/4552)，0.36.7；[维护者解释](https://github.com/electron/electron/issues/4552#issuecomment-187565660) | 变量可禁用控制台附着，命名管道可用于显式通信 | 没有证明设置变量就恢复当前 `process.stdin` |

## 一次性私有输入候选及成立条件

以下仅比较理由与未证实点，不指定生产接口，不引入自动 fallback。候选都要求 token 只进入传输载荷，不进入 argv、env、日志或裸临时文件；诊断只记录合成载荷字节数和结构化状态。

### A. 沿用继承的 stdin 管道，公开 `fs` API 直接读取 fd 0：优先核验

**理由：** 保留现有 `command-worker` 写入和受管进程树，仅绕过 Electron 的模拟属性。Node 公开支持 `fs.read(fd, ..., position: null, callback)`，也支持给 `fs.createReadStream` 指定已有 fd，此时忽略 path。后者要求 fd 为 blocking，与现有普通 `pipe` 的子端设计吻合。[fs.read](https://github.com/nodejs/node/blob/v24.21.0/doc/api/fs.md#L4143-L4179)、[createReadStream 的 fd 条件](https://github.com/nodejs/node/blob/v24.21.0/doc/api/fs.md#L3010-L3018)

这不依赖重新定义 `process.stdin`、内部 Node binding、`/dev/stdin` 或切换 run-as-Node。读取应保持单次消费、8192 字节上限、有限等待、完整收取后解析及错误不回显载荷；父侧 EOF 仍由现有 `end` 提供。采用异步有界读取，不能以无界整文件读取或阻塞 main 线程替代这些要求。

**未证实：** 失败 job 中 Electron 的 CRT fd 0 是否仍是预期管道，实际收取字节数、EOF、初始化时序及异常收尾是否正确。普通 `fs` 读取属于公开能力，但 Electron 没有为本项目这条启动链提供成功保证。`ELECTRON_NO_ATTACH_CONSOLE=1` 可作为独立对照因子，当前证据不支持把它列为 A 的必需条件。

### B. 额外继承一条普通 pipe，例如 fd 3：次选

**理由：** Node 的 stdio 数组明确支持额外 fd；Windows libuv 的 CRT 继承表也支持这些位置。它避开 stdin 属性和 fd 0–2 的 `nul` 初始化路径，秘密仍只经已连接的继承通道传递。[stdio 文档:1015–1018](https://github.com/nodejs/node/blob/v24.21.0/doc/api/child_process.md#L1015-L1018)、[Windows CRT 表构建](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/process-stdio.c#L169-L253)

**代价及未证实：** 需要生产启动方增加 stdio 位置、写入和关闭责任；Electron/CRT 对额外 fd 的实际保留及后代继承仍需验证。这是比 A 更大的改动，当前没有证据表明必须引入。不能将 Node 文档中的“Windows 不支持传递 socket”误读成“不支持所有额外 pipe”，也不能把额外 raw pipe 自动当作 Node `ipc` 通道；后者有独立协议和 Node 子进程限制。[stdio 类型与限制](https://github.com/nodejs/node/blob/v24.21.0/doc/api/child_process.md#L1034-L1074)

### C. 显式受保护的 Windows named pipe：有条件保留

**理由：** `node:net` 官方支持 Windows named pipe，可绕过所有标准流属性；受管 Electron 自身连接通道，不需要另起脱离 Job 的 GUI launcher。[Node IPC 支持](https://github.com/nodejs/node/blob/v24.21.0/doc/api/net.md#L25-L40)

**私有性条件：** 随机名字和只接受第一次连接都不足以证明私有。Microsoft 明确指出默认安全描述符可能给 Everyone／anonymous 读权限；必须核对实际 DACL、会话范围与双方身份，再允许发送秘密。原生 API 提供对端 PID 查询，可作为身份核对依据，但 PID 本身不替代权限控制。[named pipe 安全](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights)、[客户端 PID](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeclientprocessid)、[服务端 PID](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeserverprocessid)

**代价及未证实：** 需要访问控制、连接前身份核查、单次发送／关闭、超时及失败回收的完整实现；未核验现有纯 Node 接口能否满足所需 DACL 与身份查询。现阶段只能列为需额外原生能力核实的候选，不能把普通 `net.createServer` 配随机路径直接认作安全替代品。

## 同一 Windows Job 的事实边界

项目 [`packages/platform/native/process-scope.c:18–49`](../../../packages/platform/native/process-scope.c#L18-L49) 创建 Job，仅设置 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`，将根进程加入 Job；[开发说明](../../../docs/development.md#科研写作与排版)说明 worker 在归属确认后才加载业务模块。这里没有为候选另建执行路径。

Microsoft 规定已入 Job 的进程通过 `CreateProcess` 创建的子进程默认归入该 Job，breakaway 需相应 Job 配置；Node/libuv 的 detached 分支源码也明确不设置 `CREATE_BREAKAWAY_FROM_JOB`。[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)、[libuv process.c:1052–1064](https://github.com/nodejs/node/blob/v24.21.0/deps/uv/src/win/process.c#L1052-L1064)

据此，**A 改变输入读取方式，不改变进程归属机制**；B、C 若仍由现有受管 worker 启动同一个 Electron，也没有理由因传输方式本身脱离 Job。但这不是本轮实际枚举进程、取消后代及确认 Job 为空的结果。Job 用于生命周期归属，也不能代替通道的访问控制。

## 尚待验证的判别点

父侧已表示将增加同一受管 Job、仅合成字节计数的默认／`ELECTRON_NO_ATTACH_CONSOLE=1` 对照；本文不记录尚未发生的运行结果。

| 合成观察 | 能得到的结论 |
| --- | --- |
| 两组 `process.stdin` 都为 0 字节 | 符合固定版本的模拟 EOF；不能判定 CRT fd 0 的成败 |
| 同一启动条件下，独立 fd 0 读取取得预期字节并结束 | 支持 A 可用；仍需检查有界输入、错误及 Job 收尾 |
| fd 0 仅在固定变量组成功 | 提示存在原生路由差异；还需核对实际 stdout/stderr、日志参数和句柄状态，不能把 JS 模拟流与原生差异合并解释 |
| fd 0 两组均空或报错 | A 尚未成立；需区分无效 fd、`nul`、父侧写错／关闭等，不能用 JSON 异常替代传输诊断 |

本轮未运行任何 Windows 工具、平台测试或模型／子 Agent；未修改架构、源码、依赖、配置或系统设置。仅新增本文件。未建议关闭 sandbox、绕开受管启动或将 token 写入临时裸文件。调查在此停止。
