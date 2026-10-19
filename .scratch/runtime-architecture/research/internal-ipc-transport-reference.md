# 内部通道一手参考：Node IPC、stdio 与 Electron 接入

核对日期：2026-10-18。范围限 Node.js 与 Electron 官方资料，未运行 demo、安装依赖或完成目标平台实测。应用选型保存于[接口与 IPC 票](../issues/06-internal-interfaces-and-ipc.md)，本文区分官方事实与尚未确认的兼容性。

## Node 自有子进程 IPC

Node 的 `child_process.fork()` 创建带内置双向消息通道的 Node 子进程；指定其 stdio 数组时要求恰有一个 ipc 项。spawn 也可配置 ipc 通道，且与 stdout／stderr 分开。IPC 消息默认按 JSON 序列化，也支持 advanced 模式；JSON-RPC 载荷无需依赖高级对象传输。[Node 24.12.0 fork 与通道说明](https://github.com/nodejs/node/blob/v24.12.0/doc/api/child_process.md#child_processforkmodulepath-args-options)、[stdio 选项](https://github.com/nodejs/node/blob/v24.12.0/doc/api/child_process.md#optionsstdio)。

`subprocess.send()` 在通道关闭或待发送积压超过阈值时返回 false；callback 可用于流控，但不证明接收方业务处理、持久化或副作用完成。断开通道后无法继续收发；进程退出与 stdio 关闭又是不同事件。[send](https://nodejs.org/docs/v24.12.0/api/child_process.html#subprocesssendmessage-sendhandle-options-callback)、[disconnect](https://nodejs.org/docs/v24.12.0/api/child_process.html#event-disconnect)、[exit](https://nodejs.org/docs/v24.12.0/api/child_process.html#event-exit)。

Node 对顶层 `cmd` 属性以 NODE_ 开头的消息有保留处理。这不限制 JSON-RPC 的 method 命名，两者不能混淆；普通 JSON-RPC 信封没有必要另添这样的 cmd 属性。[固定文档位置](https://github.com/nodejs/node/blob/v24.12.0/doc/api/child_process.md#subprocesssendmessage-sendhandle-options-callback)。

仓库[内核生命周期](../../../apps/kernel/src/lifecycle.ts)已有 spawn 加独立 ipc 的启动握手，stdout／stderr 写日志，确认后 disconnect。它是可参考的现有接法，尚非执行期双向 RPC。

## 独立 Electron 主进程与内部页面分别处理

Node 官方说明不支持把其 IPC 通道当作任意非 Node 子进程的通道；本次 Electron 官方资料未确认“独立 Node 启动完整 Electron 应用后，Electron 主进程能直接复用该通道”的受支持契约。因此不能凭 Electron 嵌入 Node 就宣称同样可用，也不能把缺少文档当作已证明不可用。[Node stdio 说明](https://nodejs.org/docs/v24.12.0/api/child_process.html#optionsstdio)、[Electron process](https://www.electronjs.org/docs/latest/api/process)。

Electron 的 `utilityProcess` 属 Electron main 入口，须在 app ready 后调用；其 stdin 仅允许 ignore 的限制只针对 utilityProcess，不能外推到 Node spawn 启动完整 Electron 应用。[utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process)。

Electron main 与 renderer 有明确的 ipcMain／ipcRenderer 接口，可经 preload／contextBridge 提供窄能力；webContents.postMessage 可转交 MessagePortMain。这些是 Electron 应用内部桥，不是独立 Node 父宿主的入口。[IPC 教程](https://www.electronjs.org/docs/latest/tutorial/ipc)、[webContents.postMessage](https://www.electronjs.org/docs/latest/api/web-contents#contentspostmessagechannel-message-transfer)。

## stdio 的适用范围与成本

Node 提供 stdin／stdout／stderr 管道，容量有限；流的 write 返回值和 drain 可用于背压。若选其承载 JSON-RPC，还需确定分帧、截断与粘包处理、最大消息大小及日志隔离；stdout 作为协议流时不能同时写普通日志，stderr 则可单独使用。[child_process](https://nodejs.org/docs/v24.12.0/api/child_process.html#child_process)、[Writable.write](https://nodejs.org/docs/v24.12.0/api/stream.html#writablewritechunk-encoding-callback)。

本次没有确认完整 Electron 应用在各平台分发包下使用 stdio 协议的实际行为，包括 Windows GUI 应用的管道情况。stdio 是可选承载手段，其存在不等于需要为本项目启用；若采用应在对应宿主验收，不借 utilityProcess 的限制推断完整 Electron 行为。

## 验证范围

仅核对资料及已有启动握手，没有验证 Node／Electron 的执行期 RPC、背压、断线、打包与三平台行为。操作效果是否已发生仍需所属模块状态与实际结果核查；发送完成、消息被读取或进程退出均不提供业务事务完成保证。未调研现成 RPC 库及各平台替代通道。
