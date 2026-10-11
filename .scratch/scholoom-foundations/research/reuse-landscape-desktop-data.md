# 桌面、数据、文件与执行环境复用调查

调查日期：2026-10-11。依据官方文档、上游源码/README、LICENSE 与发布记录静态调查；没有安装、运行、原型验证或分发包测试。网页示例不代表 Scholoom 的产品契约已实跑。

## PRD 映射与判断边界

| 已确认需求 | 可复用部分 | 产品必须负责 |
| --- | --- | --- |
| Node 内核独立运行；GUI/CLI 接回同一实例 | WebSocket、JSON-RPC、Node socket/HTTP 原语 | 单实例协调、发现、身份认证、协议兼容、断线接续及“不可连接时不另起实例” |
| 文献库/项目结构化事实使用 SQLite；稿件以文件为权威 | better-sqlite3、Drizzle、SQLite backup；Node fs | 领域 schema、迁移、事务、身份与版本语义、DB/文件边界的恢复 |
| 人、Agent、外部编辑器可直接改普通文件 | watcher、文件枚举、diff、原子单文件写 | 重新扫描、目标版本核对、局部冲突处置、撤销历史；watch 不是日志或锁 |
| 明确取消时停止后续调度及受管子进程；未知效果不盲目重放 | spawn/Execa、跨平台子进程信号 | 子树纳管、优雅终止到强杀、退出确认、重启后核对产物与效果 |
| 自动备份、选择材料打包、恢复后核对 | SQLite backup、ZIP writer/reader | 文件范围清单、排除项、路径/链接安全、版本一致性、恢复验收 |
| 凭据优先系统凭据库；Linux 不可用时提示用户选择 | Electron safeStorage（仅 GUI 主进程）或 Node keyring binding | 可用性探测、未保护数据拒绝/提示，以及独立 Node 无 GUI 取凭据的产品契约 |
| 三平台目录包、独立 Node 与科研工具分发 | electron-builder/updater、Node、uv、Quarto/TinyTeX | 运行时/工具来源与许可清单、架构兼容、离线包、签名、安装后验收 |
| 可诊断、默认不自动上传详细诊断 | Pino；可选 Sentry/OTel | 日志脱敏、用户同意、数据驻留/保留配置、上传开关及诊断导出 |

项目基线为 Node `>=24 <25`、Electron 44.5.1，当前仓库已有 electron-builder 26.15.3、Playwright 1.63.0；协议包以 JSON Schema 推导 DTO。当前功能仍是工程骨架，下面的候选均未视为已接入。依据：[开发说明](../../../docs/development.md)、[package.json](../../../package.json)、[数据与运行 PRD](../../../docs/prd/data-and-operation.md)、[约束与验证 PRD](../../../docs/prd/constraints-and-validation.md)。

## 候选比较（22 项）

### 数据库、RPC 与实例协调

1. **better-sqlite3 — 推荐，遵循既定选择。** 独立 Node 内核通过 API 访问库；源码/API 覆盖同步语句、同步事务、在线 `.backup()`、扩展加载；事务回调必须同步。扩展须与捆绑 SQLite 版本兼容。MIT，免费；release 列表可见 v13.0.3；v13.0.0 于 2026-07-21 首次采用 N-API，v12.12.0 于 2026-07-15 发布。旧版预构建按运行时 ABI 提供；v13 改用 Node-API 降低运行时 ABI 耦合，但仍有平台/架构专用原生资产。Node 原生模块，不供浏览器；Node 24 与 Electron 44 是否能加载同一资产仍须核实。**风险**：同步查询会阻塞调用线程；备份不形成 DB+稿件共同事务。[API 固定 v12.2.0](https://github.com/WiseLibs/better-sqlite3/blob/v12.2.0/docs/api.md)、[LICENSE](https://github.com/WiseLibs/better-sqlite3/blob/v12.2.0/LICENSE)、[releases/日期](https://github.com/WiseLibs/better-sqlite3/releases)。

2. **Drizzle ORM — 推荐，范围限定。** npm `drizzle-orm` / `drizzle-kit` 提供 TypeScript DB schema、类型查询与 migration 生成；**只让它成为数据库 schema 的事实源**。RPC DTO 继续以 `packages/protocol` 的 JSON Schema 为事实源并从该 schema 推导类型，两个 schema 各自负责自己的边界，不合并成一套 SSOT。Apache-2.0、免费；release 可见 drizzle-orm 0.45.4 于 2026-10-08 发布，drizzle-kit 0.31.11；Node adapter，不供浏览器。官方文档示例含 `@rc`，所用稳定版的 driver export 仍应按 lockfile 核对。**缺口**：不替代领域约束、SQL migration 审阅/恢复策略或 LangGraph saver 的独立表契约。[SQLite 驱动](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)、[迁移](https://orm.drizzle.team/docs/sqlite/migrations)、[LICENSE](https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE)、[版本/日期](https://github.com/drizzle-team/drizzle-orm/releases)。

3. **Node `node:sqlite` — 必要替代，不建议当前替换已选 binding。** Node 24.21.0 文档标记 Stability 1.2 / Release candidate；`DatabaseSync` 所有 API 同步，包含 `loadExtension`（须创建时允许）和 `sqlite.backup()`。Node 22.13/23.5 起扩展 API 可用，24.15 起 RC。运行时免独立 addon；但仍受 Node/Electron 自带 Node 版本与 API 状态约束。官方文档未按传统 npm 包提供独立 MIT LICENSE；Node.js 本体为 MIT 系许可，若随包分发按 Node 源码许可核验。**缺口**：Drizzle 稳定版 adapter 需实核，LangGraph SQLite saver 当前走 better-sqlite3；切换会留下适配维护而未必减少整体依赖。[Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[Node 24 releases](https://nodejs.org/en/blog/release)。

4. **WebSocket：`ws` — 推荐作为内核 transport。** Node 服务端 `ws`，renderer 使用浏览器内置 WebSocket；不把 `ws` 放 renderer。MIT、免费；release 列表可见 8.22.0 于 2026-09-26 发布。Node 服务端、浏览器原生端、三桌面平台经 Node/Electron 可用。它只传 frame，不给 JSON-RPC、认证、断线续传或领域背压策略；本机小消息无需默认启用压缩。[README](https://github.com/websockets/ws/tree/8.18.3)、[MIT LICENSE](https://github.com/websockets/ws/blob/8.18.3/LICENSE)、[版本/日期](https://github.com/websockets/ws/releases)。

5. **双向 RPC：优先评估 `vscode-jsonrpc`，`json-rpc-2.0` 为轻量备选。** 前者 Node/browser 入口提供 request/response/notification 与取消令牌；MIT。release 可见 `vscode-jsonrpc` 9.0.2 于 2026-08-28 发布。后者提供双端类型化 JSON-RPC 2.0 核心，MIT；固定 v1.7.1 LICENSE 已核对。二者可接 `ws`，但 framing/message parse 责任要明确。大规模兼容与双向并发需原型。两者都不校验项目 JSON Schema：DTO SSOT 仍是 `packages/protocol`，边界校验也从该 JSON Schema 生成；不得另外手写平行接口类型。[vscode-jsonrpc README](https://github.com/microsoft/vscode-languageserver-node/tree/main/jsonrpc)、[release 9.0.2](https://github.com/microsoft/vscode-languageserver-node/releases)、[json-rpc-2.0 README](https://github.com/shogowada/json-rpc-2.0/tree/v1.7.1)、[固定 LICENSE](https://github.com/shogowada/json-rpc-2.0/blob/v1.7.1/LICENSE)。

6. **JSON Schema 校验（AJV）— 只作为现有协议契约的 validator。** protocol JSON Schema 仍是 DTO 唯一事实源；AJV 只编译该 schema 校验 RPC params/results，不另造 DTO 或 DB schema。MIT、Node/browser 可用。**缺口**：结构校验不等于授权、路径权限、状态机或业务不变量校验；AJV 当前是否已在 lockfile 中需进一步核实。[AJV 文档](https://ajv.js.org/)、[源码/LICENSE](https://github.com/ajv-validator/ajv/blob/master/LICENSE)、[releases](https://github.com/ajv-validator/ajv/releases)。

7. **`proper-lockfile` 与实例发现 — 仅借鉴机制，不作为并发/恢复方案。** npm 包按目标目录创建 `.lock` 目录并更新 mtime；MIT、上游仍可见维护但 release cadence 低于活跃候选。Node 三平台；不用于浏览器。可保护“合作进程持有某项排他工作”的约定，不提供内核身份、连接发现、SQLite 写入语义或锁丢失后的研究冲突处理。stale 阈值过短、暂停进程/时间精度、网络盘及强杀可造成误判；发现 compromised 必须停止相关写入并诊断。应用仍需 socket/端口登记、进程存活核验与认证。**不推荐**把 stale lock 当单实例真相或恢复日志。[README/limitations](https://github.com/moxystudio/node-proper-lockfile/tree/v4.1.2)、[LICENSE](https://github.com/moxystudio/node-proper-lockfile/blob/v4.1.2/LICENSE)、[releases](https://github.com/moxystudio/node-proper-lockfile/releases)。

### 文件监听、搜索、差异与归档

8. **Node `fs.watch` — 基线能力，必须搭配重扫。** Node 官方内置、无额外许可/费用；Linux/macOS/Windows 事件语义不同，网络文件系统及虚拟化共享目录可能不可靠，文件名也可能缺失。启动、重连、事件丢失或 watcher 错误时重新扫描磁盘；watcher 只发变化线索，不能作为数据库式变更日志、锁或保存成功证明。[Node 24 fs.watch caveats](https://nodejs.org/download/release/latest-v24.x/docs/api/fs.html#fswatchfilename-options-listener)。

9. **Chokidar — 推荐当跨平台 watcher 适配器。** npm `chokidar` 统一 `fs.watch` 事件，必要时 stat/目录核验；支持 polling 与 `awaitWriteFinish`。MIT，release 可见 4.0.3，另有 v5.0.0 tag（检索页未显示日期）；v5 改 ESM-only、最低 Node 20.19。Node 三平台，不用于浏览器。目录范围应窄，过滤缓存并考虑 Linux inotify 限额。**缺口**：不保证不漏事件、互斥或冲突语义；重扫由 Scholoom 负责。[README](https://github.com/paulmillr/chokidar/tree/4.0.3)、[LICENSE](https://github.com/paulmillr/chokidar/blob/4.0.3/LICENSE)、[版本/维护记录](https://github.com/paulmillr/chokidar/releases)。

10. **文件搜索：系统携带 ripgrep — 推荐作为受管 CLI 工具；纯 JS `fdir` 为轻量备选。** ripgrep 快速递归文本搜索、默认遵循 ignore，官方发布 Windows/macOS/Linux 二进制；MIT 或 Unlicense，免费，上游近期持续发布。它是 Rust 编译好的工具，不要求 Scholoom 转 Rust；只作为随包子进程使用。npm `@vscode/ripgrep` 可借鉴打包/平台选包，但其许可要连同 vendor 目录核对。`fdir` 是 TS/JS 目录枚举库，MIT，跨 Node 平台，速度不是产品保证。**选择**：内容检索用 ripgrep，单纯文件清单优先 Node fs；无需同时引入 fdir。必须限制 root、glob、隐藏文件与符号链接策略，过滤规则须与索引/导入产品规则 SSOT 一致。[ripgrep README](https://github.com/BurntSushi/ripgrep/tree/15.2.0)、[releases](https://github.com/BurntSushi/ripgrep/releases)、[fdir README/LICENSE](https://github.com/thecodrr/fdir)。

11. **文本 diff：`diff`（jsdiff）— 推荐复用为 diff 算法。** npm `diff` 输出行/词/字符 patch，可生成可读 review；BSD-3-Clause，免费，持续维护；Node/browser 均可用，无平台限制。它只比较文本，不做文件锁、语义冲突解决、base version 追踪或安全应用；二进制、大文件和换行规范需分流。撤销记录、限定变更位置、外部修改后的重新定位仍是领域层职责。[README](https://github.com/kpdecker/jsdiff)、[LICENSE](https://github.com/kpdecker/jsdiff/blob/master/LICENSE)、[releases](https://github.com/kpdecker/jsdiff/releases)。

12. **单文件写入：Node 原语优先；`write-file-atomic` 备选。** npm 包提供临时同目录写入后 rename、同路径排队与可选 fsync；MIT、npm 官方维护，Node only、三桌面平台可用。适合小型状态文件/manifest，不适合把普通稿件默认为全文件覆写协议。文件名冲突锁只对同进程内写入队列有效，不替代跨进程协同。即便 rename 成功也不代表目录项掉电持久、多个路径一起提交或数据库一起提交；既有存储调查已指出这些限制。**推荐**先以 Node 原语满足普通编辑器既有保存模型，确有原子替换需求再用包。[README](https://github.com/npm/write-file-atomic/tree/v6.0.0)、[LICENSE](https://github.com/npm/write-file-atomic/blob/v6.0.0/LICENSE)、[releases](https://github.com/npm/write-file-atomic/releases)、[恢复边界调查](local-storage-and-crash-recovery.md)。

13. **ZIP 打包：`archiver` + `yauzl`/`yauzl-promise` — 只在实现归档时推荐。** Archiver 是 Node 流式 ZIP/TAR writer，MIT；yauzl 是 ZIP reader，MIT，流式逐 entry 读取；这两者不强绑且可分别选。均支持 Node 三桌面平台，不运行于 browser。writer 生成压缩包，reader 便于验证 entry 与读取归档；免费。官方源码近期仍有提交/发布，但 yauzl 维护节奏较慢，应固定版本并审计安全更新。导入时不得直接把 entry 名拼入目标目录：拒绝绝对路径、`..`、驱动器前缀、NUL、逃逸符号链接；限制压缩比、展开大小、entry 数和路径长度，写入前 realpath 校验目标边界。应用还需定义选入/排除范围、manifest、校验和、版本及部分恢复策略。[archiver README/LICENSE](https://github.com/archiverjs/node-archiver)、[yauzl 固定源码](https://github.com/thejoshwolfe/yauzl/blob/c4695215b05c6adffda613b9051a2a85429b33fe/README.md)、[yauzl LICENSE](https://github.com/thejoshwolfe/yauzl/blob/master/LICENSE)、[releases](https://github.com/thejoshwolfe/yauzl/releases)。

### 进程、密钥、发布与工具运行时

14. **子进程：Node `spawn` — 推荐作为最低层。** 内置、无依赖/许可费用，支持 Node 三平台。使用 `spawn(file,args,{shell:false})`、受控 cwd/env、独立 stdout/stderr；比 shell 拼接更适合带空格路径和用户材料。POSIX 信号对进程组有用，Windows 子进程终止语义不同；裸 `child.kill()` 不保证杀掉后代，也不保证工具确认中止。产品需跟踪 pid/启动身份、退出码、超时、输出上限、取消阶段与未知效果。不要直接执行外部文本命令。[Node 24 child_process](https://nodejs.org/download/release/latest-v24.x/docs/api/child_process.html)。

15. **Execa / tree-kill — Execa 可原型评估，tree-kill 不作三平台强取消保证。** Execa v10.1.0 于 2026-10-06 发布，MIT，提供 AbortSignal、timeout、清理与 descendant kill；Node 内核三平台。Windows 行为依赖 `taskkill`/console 条件；不代表能杀到脱离进程树的后台进程。`tree-kill` 上游最新可见 changelog 为 1.2.2（2019-12-11）：Linux 递归调用 `ps`、macOS 用 `pgrep`、Windows 调 `taskkill /T /F`，方法不同且通过枚举子进程存在竞态，不能声称一致强取消。**优先原生 spawn 建受管边界，Execa 作可选封装；不依赖 tree-kill 承诺取消完成。** 取消后等退出并核对产物，requested/stopped/unknown 分态。[Execa 终止机制](https://github.com/sindresorhus/execa/blob/main/docs/termination.md)、[Windows 边界](https://github.com/sindresorhus/execa/blob/main/docs/windows.md)、[LICENSE](https://github.com/sindresorhus/execa/blob/main/license)、[v10.1.0 日期](https://github.com/sindresorhus/execa/releases)、[tree-kill 源码记录](https://github.com/pkrumins/node-tree-kill)。

16. **Electron `safeStorage` / keytar — GUI 凭据加密推荐 safeStorage；不推荐归档 keytar。** safeStorage 内置 Electron，不加 npm/native addon，免费；Windows DPAPI、macOS Keychain、Linux Secret Service/KWallet。Linux 无 secret store 时可能选择 `basic_text` 硬编码密码后端；显式检查后再存。API 属于 Electron main process。keytar 同样包装系统凭据库，MIT，但上游仓库于 2022-12-15 archive/read-only；Linux 要求 libsecret，且需维护原生构建与 ABI。较小的 GUI 方案是 safeStorage 加 main-process facade；但工作台未打开时，safeStorage 不可供独立 Node 内核调用，故**不能判定其已满足完整凭据契约**。[keytar archive](https://github.com/atom/node-keytar)、[README](https://github.com/atom/node-keytar/blob/master/README.md)、[LICENSE](https://github.com/atom/node-keytar/blob/master/LICENSE.md)、[Electron 44 safeStorage](https://github.com/electron/electron/blob/v44.5.1/docs/api/safe-storage.md)、[safeStorage main-process API](https://www.electronjs.org/docs/latest/api/safe-storage)。

   **独立 Node keyring 补充候选：`@napi-rs/keyring` — 有条件评估，不等于已推荐接入。** v2.1.1（2026-10-10）README 提供 `Entry`/`AsyncEntry` 读写删系统凭据 API；上游 `Cargo.toml` 分别接 Windows native keyring、macOS Keychain、Linux Secret Service 与 keyutils，npm `package.json` 和仓库 LICENSE 均为 MIT、免费，release 有三平台预编译 `.node` 资产。维护信号可见该版本近期发布、签名 tag 与 CI 矩阵；属 N-API Rust 原生 addon，非 Scholoom 自己转写 Rust，但增加平台二进制/供应链管理。Linux 默认 Secret Service 不可用会回退到仅内存 keyutils；它不保证凭据跨**系统重启**持久，不能据此推断进程重启即丢，也不能把持久性与安全强度混为一谈。建议优先显式固定 `secret-service`；不可用时按 PRD 提示用户选择保存方式，不静默回退。N-API 对 Node 版本的 ABI 稳定性不承诺 Electron；Electron 44、Node 24、目标 OS/架构与打包加载均须实测。此 binding 可让内核进程直接访问系统 keyring，不要求 GUI 常驻，但桌面 D-Bus/keychain 是否已解锁与无 GUI 会话仍需验证。[v2.1.1 README](https://github.com/Brooooooklyn/keyring-node/blob/v2.1.1/README.md)、[v2.1.1 LICENSE](https://github.com/Brooooooklyn/keyring-node/blob/v2.1.1/LICENSE)、[package.json/平台依赖](https://github.com/Brooooooklyn/keyring-node/blob/v2.1.1/package.json)、[平台 Cargo 源码](https://github.com/Brooooooklyn/keyring-node/blob/v2.1.1/Cargo.toml)、[v2.1.1 发布记录与日期](https://github.com/Brooooooklyn/keyring-node/releases/tag/v2.1.1)、[N-API ABI 边界](https://napi.rs/docs/more/support-compatibility)。

   **未决产品契约：**模型调用要求 GUI 从未打开时内核也能取凭据。需决定是否每次启动隐藏的 Electron 兼容宿主、由其 main-process `safeStorage` 提供凭据，或由独立 Node 内核直连 OS keyring（并定义 Linux 无 Secret Service/无桌面会话的行为）。不把依赖工作台常驻的凭据代理作为满足方案；在决定并验证前，凭据系统方案保持未闭合。

17. **electron-builder 及 electron-updater — builder 推荐沿用；updater 按产品阶段接入。** 仓库已有 builder 26.15.3。上游 release 列表可见 electron-builder 26.17.0 于 2026-09-26 发布；updater 6.8.10 也在可见版本列表。MIT，免费开源；签名/公证、GitHub 发布与对象存储可能有服务/账户成本。

Electron addon 通常需匹配 Electron ABI；Node-API addon 可能跨 Node/Electron ABI 使用，但取决于 addon 用到的 API 与具体预编译资产，不能只凭 Node-API 标签假定。本项目 better-sqlite3 v13.0.0 首次切换 Node-API，上游称预编译文件理论上可跨 Node/Electron；Node 24、Electron 44、OS/架构仍需实测。更新器不负责任务暂停、DB migration、内核/宿主关闭和恢复。[v26 auto update](https://www.electron.build/v26/docs/features/auto-update/)、[Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)、[Node-API](https://nodejs.org/download/release/v24.21.0/docs/api/n-api.html)、[better-sqlite3 release](https://github.com/WiseLibs/better-sqlite3/releases)、[LICENSE](https://github.com/electron-userland/electron-builder/blob/master/LICENSE)、[版本/日期](https://github.com/electron-userland/electron-builder/releases)。

18. **独立 Node — 推荐作为正式内核运行时。** 携带 Node 官方发行物，与 Electron 二进制分开启动；免费，Node MIT 系许可。锁定受支持的 24.x patch 与 CPU 架构，验收独立运行时和 addon；Electron `ELECTRON_RUN_AS_NODE` fuse 受配置影响，不作为默认运行方案。增加体积、签名/供应链和升级责任。[下载与生命周期](https://nodejs.org/en/download)、[发布周期](https://nodejs.org/en/about/previous-releases)、[Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)、[既有运行时事实](node-quarto-runtime-distribution-facts.md)。

19. **uv + Quarto + TinyTeX — 已有方向继续，不扩大承诺。** uv 项目 pyproject 声明许可证表达式 **MIT OR Apache-2.0**，免费；managed Python 来自 Astral `python-build-standalone`。Quarto CLI 为 MIT，携带配套 Pandoc、Deno、Typst、Mermaid、esbuild、Dart Sass 等依赖；TinyTeX 与实际 TeX 包需逐项核随包许可。

沿用 uv/Quarto，不重写工具链；三平台构建不表示全部 wheel、字体和模板齐备。离线、原生 wheel、PDF 字体及已有项目须实测。[uv license expression](https://github.com/astral-sh/uv/blob/main/pyproject.toml)、[LICENSE-MIT](https://github.com/astral-sh/uv/blob/main/LICENSE-MIT)、[LICENSE-APACHE](https://github.com/astral-sh/uv/blob/main/LICENSE-APACHE)、[managed Python](https://docs.astral.sh/uv/concepts/python-versions/)、[uv releases](https://github.com/astral-sh/uv/releases)、[Quarto FAQ](https://quarto.org/docs/faq/)、[Quarto releases](https://github.com/quarto-dev/quarto-cli/releases)、[TinyTeX](https://yihui.org/tinytex/)、[已有 uv 调查](python-uv-runtime-distribution-facts.md)、[Quarto 调查](node-quarto-runtime-distribution-facts.md)。

20. **Playwright — 推荐用于工程 smoke / UI 验收，不默认随产品分发。** 当前仓库已有 1.63.0。Electron automation 官方标为 experimental，原生 Electron dialog 不受 page automation 接管；测试浏览器需另行安装，Apache-2.0；CI Linux 仍需系统库/Xvfb。若产品动态网页功能需要 Playwright runtime，应另评浏览器分发、资源体积与维护边界；测试用途浏览器需另装本身不足以推出整个产品不能携带它。[Electron automation](https://playwright.dev/docs/api/class-electron)、[浏览器安装](https://playwright.dev/docs/browsers)、[LICENSE](https://github.com/microsoft/playwright/blob/main/LICENSE)、[releases](https://github.com/microsoft/playwright/releases)。

21. **可观测性：Pino 本地日志推荐；Sentry/OTel 按需而非默认。** Pino 为 MIT/免费；日志需限量和脱敏。Sentry Electron SDK 开源；托管按服务方案/事件用量计费，可能上传诊断。OTel JS 为 Apache-2.0，后端成本依部署。先用本地日志与用户主动导出；远程上报须 opt-in。[Pino](https://github.com/pinojs/pino)、[Sentry Electron](https://github.com/getsentry/sentry-electron)、[Sentry pricing](https://sentry.io/pricing/)、[OTel JS](https://opentelemetry.io/docs/languages/js/)。

22. **许可证/SBOM：OSV-Scanner 做轻量 CI 检查；ORT 用于成熟政策流程；Syft 用于制品扫描。** OSV-Scanner 可读 lockfile 查漏洞并按 SPDX allowlist 查 license；Apache-2.0 免费，license 数据服务有联网边界。ORT 可输出 SPDX/CycloneDX 与 attribution；Apache-2.0 免费，但政策维护成本高。Syft 可扫目录/制品生成 SBOM，Apache-2.0；metadata 识别仍需人工复核。都不是产品 runtime，也不代替合规判断。[OSV license scan/LICENSE](https://github.com/google/osv-scanner/blob/main/docs/license-scanning.md)、[ORT/LICENSE](https://github.com/oss-review-toolkit/ort)、[Syft/LICENSE](https://github.com/anchore/syft)。

### 建议汇总

| 判断 | 候选 |
| --- | --- |
| 推荐优先复用 | better-sqlite3 + Drizzle；`ws` + `vscode-jsonrpc`（schema 由 protocol 唯一生成并校验）；Chokidar（变化后重扫）；ripgrep（搜索子进程）；jsdiff；Node `spawn` 或 Execa 小原型；Electron safeStorage（仅 GUI 凭据，探测 Linux）；独立 Node；现有 electron-builder/Playwright；Pino |
| 有明确备选 | node:sqlite（需绕开 RC/生态缺口）；json-rpc-2.0（较轻）；原生 `fs.watch`（若能接受各平台差异）；fdir（纯文件枚举）；裸 Node spawn（少依赖） |
| 仅借鉴/按需 | proper-lockfile（合作排他锁）；write-file-atomic（局部文件发布）；Archiver/yauzl（启用备份/导入时）；Sentry/OTel（用户开启诊断后）；ORT/Syft（发布合规/制品 SBOM） |
| 当前不推荐 | 把 watcher 当变更日志；用文件锁/atomic rename 代替领域并发或崩溃恢复；以 Electron ABI native addon 替代独立 Node addon；打包时无条件启用 SQLite extension loading；默认远程遥测；把工程测试用 Playwright 浏览器自动下载给用户 |

## 两个 Electron app 的运行时与发布成本

仓库把桌面工作台和 Zotero host 作为两个 Electron app 分别打包：各自有 `electron-builder.yml`，输出目录为 `release/desktop` 与 `release/zotero-host`，根 `package:dir` 分别调用两个 package script。它们还配置了不同的 `appId` 和产品名。[desktop config](../../../apps/desktop/electron-builder.yml)、[host config](../../../apps/zotero-host/electron-builder.yml)、[package scripts](../../../package.json)

Electron 官方分发说明是把应用代码放入 Electron 预构建二进制的 `resources/app` 或 `app.asar`；electron-builder v26 的 monorepo/two-package 说明讨论 package.json 组织、生产依赖与构建，不表示两个 app 可以共同依赖一个已安装 Electron runtime。[Electron packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution)、[electron-builder v26 two-package structure](https://www.electron.build/v26/docs/tutorials/two-package-structure/)、[application contents](https://www.electron.build/v26/docs/contents/)

因此，按当前两个独立 Electron 输出发布/安装，Chromium/Electron runtime 会分别出现在两份 app 产物中，用户同时安装两者会承担重复下载/占盘成本。精确重复字节数须由目标平台 `package:dir` 产物测量，本调查没有构建或测量。

上游提供 `electronDist` 作为某次打包所用 Electron binary distribution 的自定义来源；已查资料没有说明它能把一个运行中的或已安装的 Electron runtime 作为多个独立 app 的共享依赖，也没有官方的 shared-runtime 安装契约。因此不把共享一套 Electron/Chromium 写成受支持的节省方案；是否能通过自定义安装器、符号链接或共用目录做到，本文不推断、不推荐。若要减少重复，应另做产品/发布架构调查并查官方支持边界。[electronDist configuration](https://www.electron.build/v26/docs/configuration/)、[Electron packaging model](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

此外，两个 app 的 Electron runtime 与 kernel 的独立 Node 是三类分发内容：每个 Electron app 有 Chromium/Electron；kernel 另带 Node。Node ABI 与 Electron ABI 通常不同，但 Node-API addon 可能跨 runtime 复用；better-sqlite3 v13.0.0 首次采用 Node-API，官方称预编译文件理论上可跨 Node/Electron。具体能否共用取决于 API 版本、平台和发布资产，必须实测，不能按传统 ABI 差异断言不能共用。压缩或下载缓存会影响传输量，不等于安装占用只留一份 runtime。

成本判断拆开看：

- **下载/发布体积**：独立 desktop 与 host 包各包含自己的 Electron runtime；同时发布时重复传输该部分。实际大小依 OS、架构、压缩格式和 installer 而变，未实测。
- **磁盘占用**：分别安装时每个 app bundle 有自己的 runtime。系统级缓存、硬链接或文件去重不是当前产品可依赖的契约。
- **增量更新**：两 app 有独立 appId、更新元数据和输出目录；目前没有证据证明一个 updater 可安全更新共享 Electron runtime 并协调两个 app 的生命周期。
- **版本维护**：分离打包允许 host 与 desktop 分别升级，但每个产物均须覆盖目标 Electron/Chromium 修复；共享 runtime 可能减少文件副本，却形成共同升级/回滚边界，官方支持未核实。
- **原生依赖**：Node 与 Electron 常用 ABI 可能不同；Node-API addon 有跨版本/运行时兼容可能。需核对 addon 是否实际使用 Node-API、API 版本和平台预编译资产，再分别加载验收。不要假定一定重复，也不要只凭 N-API 标签假定可以共用。
- **safeStorage 取舍**：相对 keytar，safeStorage 省去一个 native npm dependency、ABI rebuild 与 Linux libsecret 构建链，且与应用 Electron runtime 同版本；它不减少 Chromium 本体体积，也不直接服务独立 Node。
- **当前建议**：按现有双 app 分发接受重复 runtime，先测各平台实际压缩前后大小；若成本不可接受，再单独比较合并入口、host 启动器或其他受支持发布形态，不以未证实的共享安装目录作为实施前提。

上游能确认 Electron app 需随 Electron binary 分发；本次未找到官方文档对“两个彼此独立的 Electron 应用共用一个已安装 runtime”给出支持保证。这里的“不建议依赖”是证据缺口下的发布建议，不是断言手工拼装技术上绝无可能。

## 可见维护与版本快照

以下是调查时上游页面能直接看到的发布记录，不将“有 releases 页面”本身称为活跃维护。版本仅作为维护证据，不是推荐锁定版本。

| 候选 | 页面可见版本/日期 | 对维护判断的限制 |
| --- | --- | --- |
| better-sqlite3 | v13.0.3 在 release 列表；v13.0.0 于 2026-07-21、v12.12.0 于 2026-07-15 | 有近期连续发布；v13 是 N-API 首版，需单独验目标运行时 |
| Drizzle ORM | 0.45.4 于 2026-10-08；drizzle-kit 0.31.11 | 查询/迁移到当前日期仍有发布；不能据此消除 adapter 版本核对 |
| ws | 8.22.0 于 2026-09-26 | 近期维护可见；仍需跟踪安全公告 |
| vscode-jsonrpc | 9.0.2 于 2026-08-28 | 有近期版本；Node 24 ESM 导入问题需固定版本实核 |
| chokidar | v5.0.0 tag；4.0.3 release 可见但检索页面未显示年份 | 版本有变化，报告不补猜发布日期 |
| Execa | 10.1.0 于 2026-10-06 | 近期更新；新版本行为需沿 Node 24/Windows 取消原型确认 |
| electron-builder / updater | builder 26.17.0 于 2026-09-26；updater 6.8.10 可见 | 仓库仍维护，项目当前 pin 26.15.3 不等于最新 |
| keytar | 仓库于 2022-12-15 archive | 只读，停止维护；不适合新凭据集成 |
| tree-kill | changelog 最新 1.2.2，2019-12-11 | 维护陈旧，且实现依赖平台命令枚举子进程 |
| Node / Electron | 仓库 pin Node 范围 24.x、Electron 44.5.1；官方 Node 文档页面标 v24.21.0 | 这是本项目基线及调查可见文档版本，不代表已打包验证 |
| uv / Quarto | uv release 页列出 0.13.0 安装入口；Quarto release 页列出 1.11.5 | 页面有近期版本，但仍要锁定对应平台分发物与组件清单 |
| Playwright | 项目 pin `@playwright/test` 1.63.0 | 当前仓库有固定版本；没有在本报告声称其为最新 |

其余候选没有在快照表逐一填版本/发布日期，原因是本轮没有对每个 package registry 与 tag 做可复核的发布日期交叉核对；报告正文保留了实际打开的 README、固定版本 LICENSE 和上游 release 链接。实施定版时应按 lockfile 选具体版本并复核 Node `engines`、ESM/CJS 入口、依赖 license 与三平台资产，避免把本调查日之后的版本回填成调查时事实。

维护状态只用于估算依赖风险，不是质量排名。Chokidar、Execa、Drizzle 等 release 较近，但仍须检查 breaking change；proper-lockfile/tree-kill 等发布较疏的包应缩小其职责并评估是否可用 Node 原语替代。keytar 已明确归档，应视为停止上游维护。

Electron 与 Node 的运行时分发要和原生模块分开核账。Electron 官方指出普通 native addon 常需按 Electron ABI 重建；Node-API 可缓解 ABI 耦合，但需实际 addon 实现、Node-API 版本和平台资产共同满足。better-sqlite3 上游 v13 首次使用 N-API 并不自动证明它在本项目目标 Electron 44 + Node 24 的两处都能免重建运行。[Electron 原生模块](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)、[Node-API](https://nodejs.org/download/release/v24.21.0/docs/api/n-api.html)、[better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases)。

快照来源：[better-sqlite3](https://github.com/WiseLibs/better-sqlite3/releases)、[Drizzle](https://github.com/drizzle-team/drizzle-orm/releases)、[ws](https://github.com/websockets/ws/releases)、[vscode-jsonrpc](https://github.com/microsoft/vscode-languageserver-node/releases)、[Chokidar](https://github.com/paulmillr/chokidar/releases)、[Execa](https://github.com/sindresorhus/execa/releases)、[electron-builder](https://github.com/electron-userland/electron-builder/releases)、[keytar archive](https://github.com/atom/node-keytar)、[tree-kill changelog](https://github.com/pkrumins/node-tree-kill)、[Node 24 docs](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[uv releases](https://github.com/astral-sh/uv/releases)、[Quarto releases](https://github.com/quarto-dev/quarto-cli/releases)。

## 最需原型验证的 4 项

1. **RPC + 本地实例发现/重连。** Linux、Windows、macOS 分别启动两客户端争抢同一配置；可观察验收：任何时刻只出现一个 kernel；健康实例不可连接时不启动第二个；GUI 断开不取消任务；重连能读到活动任务/待处理决定；错误认证/不兼容协议明确失败。另测 socket/端口占用、残留登记和权限边界。
2. **三平台原生模块、凭据与目录包。** 打包后的 Electron 与独立 Node 分别加载各自依赖；可观察验收：三平台目标架构上均打印运行时版本、打开 SQLite、提交/重读数据、执行在线备份并读回；GUI 从未启动时内核仍能按最终选定契约取系统凭据，Linux 无 Secret Service 时提示用户选择，且不静默回退 keyutils；不依赖开发机 Node、全局 Quarto/uv 或临时编译工具。
3. **watcher + 编辑冲突/恢复。** 让 GUI、Agent、外部编辑器先后写同一文件，加入 rename/save burst、删除后重建、断开 watcher 与进程中断；可观察验收：重连扫描可发现最终磁盘状态；保存前比对的版本不一致时保留双方内容并提示/局部暂停；不会因漏事件静默覆盖。监听事件次数不作为断言。
4. **取消与 ZIP 往返安全。** 真实代表性 Python/Quarto/LaTeX 子进程派生子进程后取消；同时做备份创建、恢复、恶意 ZIP 路径样本；可观察验收：停止请求与退出确认分态，后代无存活（目标受管范围），未确认时状态 unknown；产物可恢复核验；`../`、绝对路径、链接越界、超大展开被拒且未写出目标范围。

## 库不能替代的 Scholoom 领域工作

- 为 DB 与文件各自定义权威、版本标识、迁移和恢复；不承诺跨 SQLite 与可直接编辑文件的共同事务。
- 把文件 watcher 作为 hint，重新扫描并比较磁盘；按实际修改位置保护编辑、保留未保存草稿、处理冲突/撤销且不覆盖后续修改。
- 实例查找、认证、单内核生命周期、连接断开后的订阅恢复、协议版本协商和防止重复启动。
- 任务级授权、执行上限、cancel requested/stopped/unknown 状态、进程子树范围、退出确认、重启效果核查与安全重试判断。
- 备份范围、缓存/临时文件排除、材料选择、路径标准化/越界防护、恢复演练和来源引用核验。
- Linux 凭据后端不可用时不把可逆/弱保护冒充安全保存；密钥不进项目文件和日志，内核凭据请求走明确 IPC。
- Node/Electron 两套 ABI、独立 Python/Quarto/TinyTeX 资源、签名与发布许可清单，不能由“builder 打包成功”推断安装后可用。
- 对外遥测的知情选择、内容脱敏、数据保留和导出检查；库或服务商默认值不是产品授权。

## 来源与未核实项

- 已读 PRD 首页、约束与验证、数据与运行、开发说明、根 `package.json`，以及 SQLite 选型、本地存储恢复、Node/Quarto、uv、桌面更新五份既有调查；沿用既定 SQLite/运行时/发布方向，无建议偏离已确认决策。
- 关键网页均实际打开官方文档或上游仓库文件；许可证链接优先固定 tag/commit。少数 GitHub 固定 LICENSE 页面无法由浏览工具稳定打开时，根据 GitHub repository license metadata/README 标注，已在候选中注明未核实；引用链接仍指向上游文件。
- 未逐项核验所有传递依赖许可证、逐平台二进制组件 notice、TinyTeX/TeX 包清单、商业遥测实际账单、最低 OS/CPU 支持矩阵、所有 candidate 的当前 npm 最新版本。未运行测试、安装、构建、下载浏览器或做安全审计；因此维护判断是对上游文档/近期 release 的观察，不是 Scholoom 兼容承诺。
- 来源事实需在具体实现定版时再次按锁定版本复核。已有背景详见 [SQLite 选择](sqlite-node-integration-selection.md)、[文件与崩溃恢复](local-storage-and-crash-recovery.md)、[Node/Quarto 分发](node-quarto-runtime-distribution-facts.md)、[uv 分发](python-uv-runtime-distribution-facts.md)、[桌面更新](desktop-release-and-update-facts.md)。
