# VS Code 与 Zed：SSH 远端组件引导调查

核对日期：2026-10-18。范围限远端 server 的复用、下载、上传与安装前提；只读官方文档与源码，未执行安装或故障实验。本文是调查依据，Scholoom 的选择保存于[部署决策票](../issues/05-local-and-remote-deployment.md)，不以参考项目行为自动替代用户选择。

## 比较结论

| 行为 | VS Code Remote SSH | Zed |
| --- | --- | --- |
| 默认下载端 | 远端 | 远端 |
| 远端下载失败 | 本机下载后传到远端 | 本机下载后传到远端；源码明确有此回退 |
| 强制本机下载上传 | `remote.SSH.localServerDownload` 可选始终本机，也可禁止本机下载 | `upload_binary_over_ssh: true` 跳过远端下载 |
| 远端已有组件 | Server 由客户端管理，安装和更新跟随连接 | 按客户端版本与通道定位已有文件，执行其 version 命令成功则复用 |
| 网络受限的含义 | Server 下载与扩展及其二次依赖的联网要求分开 | Server 可经 SSH 上传；语言服务器、插件等依赖仍需另行准备 |

来源：VS Code [SSH 文档](https://code.visualstudio.com/docs/remote/ssh#what-are-the-connectivity-requirements-for-the-vs-code-server-when-it-is-running-on-a-remote-machine--vm)、[FAQ](https://code.visualstudio.com/docs/remote/faq)；Zed [远程开发文档](https://zed.dev/docs/remote-development#initializing-the-remote-server)及下列固定源码。

## VS Code：官方文档依据

文档源码基线：`microsoft/vscode-docs@ef0ca127806a0e7eb9cd9e39e1d71c05e0a5769b`（2026-10-16）。

- 官方说明默认先在远端下载，失败后本机下载再传输；设置可强制本机下载或禁止本机下载。[ssh.md:325–339](https://github.com/microsoft/vscode-docs/blob/ef0ca127806a0e7eb9cd9e39e1d71c05e0a5769b/docs/remote/ssh.md#L325-L339)、[faq.md:54–70](https://github.com/microsoft/vscode-docs/blob/ef0ca127806a0e7eb9cd9e39e1d71c05e0a5769b/docs/remote/faq.md#L54-L70)。
- Server 由 VS Code 客户端管理，连接时自动安装与更新；不能把这种更新行为直接用于 Scholoom 的共享内核，后者已有用户选择升级时机的约束。[faq.md:52](https://github.com/microsoft/vscode-docs/blob/ef0ca127806a0e7eb9cd9e39e1d71c05e0a5769b/docs/remote/faq.md#L52)。
- 扩展可通过 VSIX 手工安装；扩展市场和二次依赖另有网络需求。Server 下载可回退，不等于运行环境和所有功能完全离线。[ssh.md:334–339](https://github.com/microsoft/vscode-docs/blob/ef0ca127806a0e7eb9cd9e39e1d71c05e0a5769b/docs/remote/ssh.md#L334-L339)。

这里依据官方产品文档，不把公开 Code OSS 核心仓库当作 Remote SSH 扩展安装器的完整源码证据。官网故障页存在要求远端联网的概括表述；具体下载策略以 SSH 专页与 FAQ 的明确说明为依据。

## Zed：文档与实现交叉核对

源码基线：`zed-industries/zed@56934ec0560bce8929025497411de7f5322fb6ca`（2026-10-17）。

- 官网说明默认远端下载，`upload_binary_over_ssh: true` 改为本机下载上传。远端目录为 `~/.zed_server`，手动预置的 server 必须匹配本机 Zed 版本。[官方文档](https://zed.dev/docs/remote-development#initializing-the-remote-server)。
- 引导先按通道、版本及平台构造目标文件名，再执行该文件的 version 命令；成功时复用已有文件。此处不比较命令输出中的版本字符串。[ssh.rs:1022–1047](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/remote/src/transport/ssh.rs#L1022-L1047)、[1073–1075](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/remote/src/transport/ssh.rs#L1073-L1075)。
- 自动回退有直接实现依据：未强制本机上传时尝试远端下载，下载返回错误后进入本机下载、上传与解压路径。该回退不能扩大为任意安装错误都自动换路径：下载地址查询直接报错，或远端下载成功但解压失败，均会从对应错误处退出。[ssh.rs:1101–1144](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/remote/src/transport/ssh.rs#L1101-L1144)。
- 远端下载使用 curl 或 wget；本机上传分支按远端平台请求对应产物。目标文件由远端实际平台、通道与版本确定，不能把客户机可执行文件直接当作远端产物。[ssh.rs:1088–1144](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/remote/src/transport/ssh.rs#L1088-L1144)、[1147–1239](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/remote/src/transport/ssh.rs#L1147-L1239)。

## 无公网与未核实范围

远端不能访问下载站、客户机可以访问时，两者均有本机传包路径。双方都不能取得组件时，自动网络下载不能解决缺包；Zed 官方提供按精确版本手工预置 server 的方法。本次没有全面核对各项目的缓存、镜像与离线工具，不据此断言它们完全没有其他准备途径。

未追完 Zed 本机下载 delegate 的代理、缓存及下载地址实现；未核对 VS Code Remote SSH 各发布版本的安装器源码。没有运行下载、上传、断网、解压或多客户端升级测试。Scholoom 已确认的组件引导选择与升级边界见[部署票 Q9](../issues/05-local-and-remote-deployment.md#q9复用兼容组件远端下载失败后本机传包)及 Q7；本调查保留参考项目的事实与验证范围。
