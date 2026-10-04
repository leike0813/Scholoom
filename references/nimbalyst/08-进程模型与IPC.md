# 08 进程模型、IPC 与主进程运行时

> 事实来源：`.ua/wiki/layers/main-process.md`、`tour.md` 第 2–5 步、`.ua/wiki/modules/packages/electron/src/preload.md`，以及 `main/ipc/**`、`main/window/**` 的模块页摘要。

## 进程模型总览

```
bootstrap.ts                    ← 必须在任何 electron-store 之前设置 userData 与 V8 上限
      ↓ 唯一允许动态 import index.ts 的地方
main/index.ts                   ← 静态 import 一次性注册全部 IPC handler、服务与协议
      ├── logger.ts              主进程日志中枢，所有组件从它取带级别的 logger
      ├── 83 个 ipc/*Handlers.ts  一个领域一个 Handler
      ├── 205 个 services/**     领域服务
      ├── database/**            双后端 + 破坏性操作锁
      ├── mcp/**                 五个本机 MCP HTTP 服务
      ├── extensions/**          特权扩展宿主
      ├── window/ tray/ menu/    窗口、托盘、菜单
      └── workers/               gifEncodeWorker、historyDiffWorker、projectManifestWorker
      ↑ contextBridge（唯一通道）
preload/index.ts                ← window.electronAPI，数百个方法
      ↓
renderer/index.tsx              ← 性能监控 → Monaco → Jotai/PostHog → App
      ├── 主窗口（index.html）
      ├── 菜单栏岛（island.html，独立 Jotai store）
      ├── 文件历史（history.html）
      ├── session-manager / workspace-manager（纯 HTML+JS，不走 React）
      └── 离屏截图渲染器（capture 模式）
```

## bootstrap：唯一允许动态 import 的地方

`main/bootstrap.ts` 是最外层的引导，**必须抢在 electron-store 初始化之前**做两件事：

1. 设置自定义 `userData` 目录——否则数据库路径会算错；
2. 设置 V8 内存上限。

之后才把控制权交给 `main/index.ts`。

### 为什么主进程坚持静态 import

`main/index.ts` 用**静态 import 一次性注册**全部 IPC handler、服务与自定义协议，处理单例锁、窗口恢复、deep link 与日志轮转。

> **理由**：静态 import 让模块求值顺序确定。**动态 import 会造成日志 IPC 的重复注册**。

`bootstrap.ts` 是唯一允许动态引入 `index.ts` 的例外——正因为它必须先完成路径与内存的准备工作。

这条约束被 `main-bundle-require-policy.mjs` 强制：main bundle 内的懒 chunk 若 `require("../index.js")` 二次求值整个 main，会重复注册 electron-log 并抛 "Attempted to register a second handler"。

## Preload：主/渲染的唯一通道

`preload/index.ts` 通过 contextBridge 把能力收敛成 **`window.electronAPI`**，暴露数百个方法：

- IPC 调用
- 事件订阅
- 认证 JWT
- 会话与本地副本同步
- CLI 与 Git 探测

**渲染进程没有 Node 能力**，一切跨进程动作都从这里中转。因此新增功能时「在 preload 加一个方法」是绕不开的一步。

`preload/ipcSubscriptions.ts` 的设计值得记：**只返回取消订阅闭包，不提供 `off(channel, callback)`**。这避免了调用方持有的 callback 引用与 channel 字符串不匹配导致订阅泄漏。

`renderer/electron.d.ts` 声明该 API 的全部 IPC 接口。

## 渲染进程挂载顺序

`renderer/index.tsx` 的初始化顺序**被刻意固定**：

1. 性能与卡顿监控 —— **必须早于 `react-dom` 安装**；
2. Monaco 和本地资源 URL 转换器就绪；
3. 用 Jotai 与 PostHog Provider 挂载 App。

`capture` 模式会**跳过全部重初始化**，只准备离屏截图渲染器。

`App.tsx` 是根组件：**在这里一次性注册编辑器插件与内置自定义编辑器**，并串联工作区管理、编辑器/协作/Agent/Tracker/设置各模式视图、对话框、快捷键与主题。

`index.html` 也在任何 CSS 与 React 之前同步执行三件事（避免首屏闪烁）。

## IPC 处理器组织：一个领域一个 Handler

`main/ipc/`（**83 个文件**）是本仓库最鲜明的结构特征。命名与职责高度一致：

- `*Handlers.ts` 是处理器；
- `*Service*.ts` 与其他文件是纯函数或辅助（如 `fileSaveErrors.ts`、`githubIpcErrors.ts`、`extensionFindFilesPlan.ts`、`sessionListProjection.ts`、`legacyPendingUpdateDrain.ts`）。

读懂三个文件就掌握了分工约定：

| Handler | 职责 |
| --- | --- |
| `WorkspaceHandlers.ts` | **最大的一组**：文件树、增删改重命名、Quick Open 搜索、工作区设置、打开外部程序 |
| `SessionHandlers.ts` | AI 会话入口：创建/查询/重命名/归档、切换 provider 与模型 |
| `SettingsHandlers.ts` | 主题、密钥、登录、自动更新等应用级设置 |

其余重要 handler 详见 [04 架构分层](04-架构分层.md#ipc83-文件本仓库最鲜明的结构特征)。

### safeHandle：全图入边最高的符号

`main/utils/ipcRegistry.ts`（出边 11）的 `safeHandle`（入边 **21**，全图第一）做两件事：

1. **重复注册时复用已有 handler 而不抛错**；
2. 记录调用耗时。

它存在的原因直接对应「重复注册 handler 导致崩溃」的历史问题。在一个用静态 import 注册上百个 handler 的进程里，重复注册是必然风险而非意外。

## 窗口与多窗口模型

`main/window/`（**28 文件**）：

| 文件 | 职责 |
| --- | --- |
| `WindowManager.ts` | **项目窗口生命周期中枢**：创建工作区/文档窗口、挂载文件与 git 监听 |
| `windowState.ts`（出边 9） | 跨模块窗口表与工作区归属解析 |
| `windowChrome.ts`（8） | 标题栏高度常量等窗口框架契约 |
| `StartupActivation.ts`（9） | **启动队列中的窗口一律 `showInactive`**——启动期不抢焦点 |
| `SplashScreen.ts`（7） | 启动画面 |
| `windowOpenGuard.ts` | 全局拦截 `window.open` |
| `workspaceWindowMatch.ts` | 决定「打开某项目」应复用哪个窗口 |
| `islandGeometry.ts` | **刻意与 Electron 窗口代码分离的纯几何逻辑** |
| `serviceRegistry.ts` | 服务注册表 |

`islandGeometry.ts` 是一个值得学的拆分：几何计算是纯函数，可以独立测试与复用，因此不该埋在 Electron 窗口代码里。

`main/session/`（4 文件）负责 `SessionState.ts`（窗口列表保存恢复）与 `startupSafeMode.ts`（识别 `--safe-mode` / `--no-restore`）。

## 托盘与菜单栏

`main/tray/`（11 文件）：

| 文件 | 职责 |
| --- | --- |
| `TrayManager.ts` | 托盘生命周期 |
| `fleetSnapshot.ts` | `deriveFleetSnapshot`——**菜单栏、托盘面板与锁屏共用的唯一事实源** |
| `stripStateMachine.ts` | 状态条状态机 |
| `stripMarkup.ts` | **纯字符串拼接内联 HTML** |
| `sessionSnippets.ts` | 为每个会话生成一行「它在说什么」，直接读 `ai_agent_messages.searchable…` |

`main/menu/`（7 文件）：`ApplicationMenu.ts` 是构建与刷新中枢；`menuBarSerialization.ts` **把活的 Electron Menu 递归序列化为渲染进程模型**。

`main/window/MenuBarIslandWindow.ts` 是菜单栏岛窗口，渲染侧用 `islandEntry.tsx` + **独立 Jotai store** 承载。

`stripMarkup.ts` 用纯字符串拼内联 HTML——在这个场景下（极小的固定结构、每帧更新）比引入渲染层更划算，但**调色板必须收敂到 `shared/fleetStripColors.ts`**，否则会散落成硬编码色值。

## 工具与系统集成

### Git

`main/ipc/GitHandlers.ts`（出边 12）提供跨仓库的完整 Git 操作：status/log/branch/push/pull/rebase/checkout/cherry-pick。跨仓库提交由 `GitCommitService` 分组执行。

`main/file/GitCatFileBatch.ts` 是一个具体的性能优化：**以 `git cat-file --batch` 长驻进程批量读取 blob 内容，取代逐文件 spawn git**，用于 diff 视图中批量取文件原文。

`main/file/GitRefWatcher.ts` 监视 `.git` 引用（HEAD、分支指针、packed-refs）变化，在 checkout/pull/rebase 后清空 Git 状态缓存并广播刷新。

`main/file/GitWatcherLifecycle.ts` 管理占用生命周期：**判断某仓库是否仍被窗口、工作区或运行中的 agent 回合使用，未被使用时延迟释放共享服务**。

### Worktree

`main/services/GitWorktreeService.ts`（147–2645，**2499 行**）是 worktree 主类，编排创建、列举、状态查询、分支清理与会话销毁。`WorktreeHandlers.ts` 负责 IPC 入口，**删除路径带并发限制与操作锁**。

这是「并行 agent 会话」招牌能力的落地方式：每个会话开一个独立工作树，互不干扰。

### 文件监听

`main/file/`（25 文件）的监听体系分三层：

```
WorkspaceEventBus.ts        gitignore 过滤 + 原生事件去抖合并 + 订阅分发（出边 17）
      ↑
WorkspaceWatcher.ts         编排层（出边 9）
      ↑
OptimizedWorkspaceWatcher.ts  聚合 chokidar 与原生 fs.watch，维护 Quick Open 名称缓存
```

配套的健壮性设计：

| 文件 | 要点 |
| --- | --- |
| `RecoveringFileWatcher.ts` | **自愈包装器**：用 generation 计数隔离陈旧的原生句柄回调，句柄失效时按退避策略自动重建并发布 `FileWatchHealth` 状态 |
| `NativeFileEventQueue.ts` | 对原生事件做**有界合并与批量投递**：单条低频通知保持同步，突发写入按 `(类型, 路径)` 去重后在一个任务内批量下发 |
| `pathExistsAfterRename.ts` | rename 事件后**带重试地**确认目标路径存在，避免把原子替换的瞬时 I/O 错误误判为文件被删除 |
| `knownFileWrites.ts` | **带过期时间的写入指纹表**：编辑器写文件前登记内容指纹，监听器据此把自家写入从 agent 触发的变更证据中排除 |
| `FileSnapshotCache.ts` | AI 编辑前保存基线内容，优先用 `GitCatFileBatch` 批量读取，其余回退全量扫描 |
| `QuickOpenFileScanner.ts` | 优先用 ripgrep 枚举文件，退化到受过滤规则约束的目录遍历 |
| `FileOpener.ts` | **文件打开的唯一入口**：选窗口、路由到新窗口或标签页、维护窗口状态与文件监听、上报分析事件 |
| `FileWatcher.ts` | **已空实现**——改由 WorkspaceEventBus 统一广播，函数保留以免改动调用点 |

`pathExistsAfterRename` 与 `knownFileWrites` 两条特别值得记：它们分别解决了「原子替换的瞬时状态」与「自家写入的自我干扰」两个**看起来不可能发生但实际高频**的问题。

## 性能与健壮性工具

| 文件 | 职责 |
| --- | --- |
| `utils/performanceMonitor.ts` | **250ms 节拍检测事件循环卡顿** |
| `utils/consoleStallGuard.ts` | **主进程输出到 TTY 是同步写，终端停止读取会冻结整个主进程**，故加写保护 |
| `utils/startupTiming.ts` | 启动计时 |
| `uncaughtException.ts` | **限流重复错误与弹窗频率** |
| `workers/gifEncodeWorker.ts`、`historyDiffWorker.ts`、`projectManifestWorker.ts` | 重活挪出主线程 |

`consoleStallGuard.ts` 记录的是一个容易被忽略但会致命的环境假设：**标准输出不一定是异步的**。CI、IDE 内置终端、被重定向到管道的场景都可能让同步写阻塞。

## 内置 MCP 服务：五个本机 HTTP 服务

Nimbalyst 除了作为 **MCP 客户端**连接外部服务，还在本机**自建五个 MCP HTTP 服务**供外部 CLI 使用：

| 文件 | 服务 |
| --- | --- |
| `mcp/metaAgentServer.ts` | 元 agent 编排（`dispatchMetaAgentTool` 按工具名分发） |
| `mcp/sessionContextServer.ts` | 会话上下文 |
| `mcp/sessionNamingServer.ts` | 会话元信息（标题更新、标签读写、阶段查询） |
| `mcp/superLoopProgressServer.ts` | 进度流（**SSE + stdio 双传输**） |
| `mcp/settingsServer.ts` | 设置 |

`mcp/httpServer.ts` 实现 Streamable HTTP 端点，负责鉴权、header 规范化、工具分发表与服务器实例生命周期。

### 为什么需要令牌层

`mcp/mcpAuth.ts` 的文件摘要解释了原因：

> 这些端口只监听 127.0.0.1 且无传输层鉴权，**本机上任何浏览器页面都能发起 fetch 触发工具副作用**。

> **要点**：仅绑定 127.0.0.1 不等于安全——浏览器可以对本机端口发跨域请求。因此这类服务要在应用层加**每次启动随机生成的令牌**，并强制走 `Authorization` 头或 token 查询参数。

`requireMcpAuth` 的实现是**失败关闭**：服务尚未生成令牌时按失败处理。

`mcp/mcpEndpointDescriptor.ts` 以 **0600 权限**把 pid、端口与令牌写入发现文件，**读取方需先校验 pid 存活**。

`mcp/mcpWorkspaceResolver.ts`（出边 17）的 `findWindowIdForWorkspacePath` 在已注册窗口中查找匹配指定工作区路径的窗口 ID——**把「MCP 工具的调用者是谁」映射回「哪个窗口发起」**。

`mcp/rendererRequest.ts` 的 `requestFromRenderer`（入边 5）反向：向指定窗口的渲染进程发请求并解析响应。**主进程与渲染进程之间存在双向请求通道**，不只是单向下行。

`mcp/tools/`（29 文件）是 agent 工具面暴露给外部 MCP 客户端的出口：`backendToolHandler.ts` 与 `extensionToolHandler.ts`（各入边 3，被主进程与 AI 层同时引用）、`trackerToolHandlers.ts`（`handleTrackerCreate` 校验必填字段、分配本地 key、写库并按需触发发布与通知）、`toolBudgetService.ts`、`devAgentTools.ts`。

## 环境与路径

| 文件 | 职责 |
| --- | --- |
| `main/hostEnvironment.ts` | 向 runtime 注入 `app.isPackaged` / `app.getAppPath` 的**惰性读取** |
| `utils/appPaths.ts` | `getPackageRoot`——定位含 `package.json` 的包根，在使用 out2 等自定义输出目录的开发实例中**从 app 路径向上回溯** |
| `services/shellEnvironment.ts` | `getEnhancedPath` 合成 spawn 用的 PATH：vendored ripgrep、homebrew、nvm、npm/yarn 全局 bin、系统 PATH，Windows 上经路径解析器归一化；`detectPaths` 异步探测并缓存 |
| `codexAppServerBinary.ts` | `resolveCodexBinaryPath`——打包态优先用已安装路径，否则回退模块解析 |
| `security/SafePathValidator.ts` | 路径校验 |

`getEnhancedPath` 反映了一个现实：**Electron 应用继承的 PATH 通常不包含用户装的工具链**，直接 spawn `git` 或 `rg` 会失败，必须自己拼。

## 主进程服务的其余部分

| 目录 | 文件数 | 要点 |
| --- | --- | --- |
| `services/analytics/` | 9 | `AnalyticsService`（入边 4）统一事件发送：设置存储、PostHog 客户端生命周期、会话序号、日活心跳、发布渠道归因 |
| `services/auth/` | 5 | `StytchAuthService` 的 `isAuthenticated` 判断是否至少一个账号登录 |
| `services/TeamService.ts` | — | `findTeamForWorkspace` **按工作区的 git remote 身份查找对应团队**、`listConversations` |
| `services/externalSessions/` | 9 | 外部会话 |
| `services/credentials/` | 4 | 凭据 |
| `services/attachments/` | 3 | 附件 |
| `services/tutorial/` | 6 | `getTutorialTemplateDirectory` **延迟到调用时解析**而不放在模块加载期 |
| `services/feedback/` | 2 | 反馈上报 |
| `services/cloudflareSandbox/` | 17 | 私有 sandbox 管理 |
| `services/extensionSessions/` | 2 | 扩展会话 |

`findTeamForWorkspace` 用 **git remote 身份**而非本地配置确定团队归属——这样同一仓库在任何机器上解析出的团队都一样。

## 渲染进程的高频更新防护

`renderer/store/transcriptStreamAccumulator.ts` 把主进程高频 `transcript:event` 推送**合并为每帧每会话一次更新**。

这是 UI/UX 规则里「高频更新的 DOM 必须专门检查性能问题」的一个具体解法：不是节流事件源本身（那会丢状态），而是在 store 层做帧级合并，**保证每帧最多一次 React 更新**。

## 小结：主进程的五条约定

1. **静态 import 注册**——`bootstrap.ts` 是唯一例外，因为它必须先做路径与内存准备。
2. **一个领域一个 Handler**——83 个文件，命名即职责。
3. **`safeHandle` 包装**——静态注册上百个 handler，重复注册是必然风险。
4. **破坏性操作上锁并拒绝并发**——数据库、worktree 删除都遵循。
5. **只暴露 `window.electronAPI`**——渲染进程无 Node 能力，preload 是唯一通道。
