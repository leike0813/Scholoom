# 开发说明

## 模块与入口

| 包 | 当前职责 | 后续实现边界 |
| --- | --- | --- |
| `apps/kernel` | 独立内核、项目与安全文件、持久单 Agent、科研方法、共同题录与附件库、MiniMax 模型与凭据、CLI | 阅读分析、受管计算和宿主监督 |
| `apps/desktop` | Electron main、sandbox preload、React renderer | 人类工作台，经共同客户端调用内核 |
| `apps/zotero-host` | 独立 Electron main 与隐藏 Chromium 页面 | 固定 Zotero 10 基线的通用兼容层与选定插件适配 |
| `packages/protocol` | JSON Schema 与推导的 DTO、协议版本 | 客户端和内核共同使用的调用及事件契约 |
| `packages/client` | 共同 WebSocket、认证、类型化业务调用、范围订阅及重连 | 后续领域能力 |

共享包与内核构建为 ESM；Electron main/preload 构建为 CJS。根 `pnpm build` 按工作区依赖顺序构建。`pnpm typecheck` 先生成共享包声明，确保刚安装的工作区也能解析共享接口。

Electron 工作台和 CLI 共用独立 Node 内核，浏览器开发入口经同一客户端连接。关闭或退出工作台只关闭界面；兼容宿主尚未接入内核监督，也未加载插件。

协议 schema 是 DTO 的事实源，类型从 schema 推导；客户端和内核使用 Ajv 校验消息、认证、状态及引导结果。连接状态不代表研究指令已经可执行。

执行沿 [#07](../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer) 的 Deep Agents／LangChain／LangGraph 路线。当前支持单 Agent 材料任务与内置材料分析方法／能力；插件 MCP、受管 shell 和多 Agent 尚未接入。

## 本地工作

依赖和工具版本以 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 为准。pnpm 的依赖安装脚本授权集中在 `pnpm-workspace.yaml`。Electron 42 起取消依赖的自动运行时下载，项目使用官方 `install-electron` 命令显式准备二进制，见 [上游安装说明](https://github.com/electron/electron/blob/main/docs/tutorial/installation.md)。

`pnpm dev:desktop` 使用 electron-vite；`pnpm dev:browser` 使用同一 React renderer。浏览器入口没有 Electron bridge，界面业务功能经共同客户端实现。

## 内核配置与生命周期

CLI 和普通产品实例默认使用仓库根 `.scholoom-dev/`；`pnpm dev:browser` 与 `pnpm dev:desktop` 默认使用 `.scholoom-dev/debug/`。`--data-dir` 优先于 `SCHOOLOOM_DATA_DIR`，未指定时使用对应默认目录；开发入口同样可用该环境变量覆盖调试配置。数据配置限定本机文件系统，不将运行目录放在 NFS 等网络文件系统。

```sh
pnpm kernel start --data-dir /path/to/isolated-profile
pnpm kernel status --data-dir /path/to/isolated-profile
pnpm kernel stop --data-dir /path/to/isolated-profile
```

命令输出结构化状态，公开运行信息不包含凭据；`--help`、`--info` 仍可单独使用。查询和停止不会初始化缺失配置。`start` 在并发请求下连接同一实例；内核仍占用配置但不可达时报告失败，保留原实例。

运行区的 `lifecycle.sqlite` 只承载系统排他锁，内核持锁至退出；`endpoint.json` 原子保存本次实例和连接资料，`kernel.log` 记录不含凭据的初始化诊断。锁文件持续保留，不能通过删除它来重启仍占用配置的进程。Node 24.12.0 会输出 `node:sqlite` 实验性告警。

Electron 通过窄 preload 桥请求内核引导：开发态主进程把请求转发给 electron-vite renderer 的 Vite 引导端点，生产态仍调用独立 Node CLI。内核使用 PATH 中的 `node`，也可由 `SCHOOLOOM_NODE_EXECUTABLE` 明确指定 Node 24；缺失或错误运行时显示启动失败，不使用 Electron 充当内核。当前产品目录包尚未提供独立 Node，成品分发由后续变更落实。

Vite 启动时发现或启动受管调试内核；浏览器页面初次只查询，用户重试才允许重新启动。引导只接受本机同源请求，运行资料不写入 URL 或构建产物；静态文件与模块入口拒绝读取运行凭据。意外断线会有界重连并重新查询状态，认证或协议错误直接停止尝试。

开发调试内核由实际 Vite／electron-vite 宿主进程持有经认证的所有权，同一配置的多个调试宿主共享实例；页面刷新或 renderer 重载不回收内核，普通页面与业务连接也不延长其寿命。最后一个调试宿主退出或异常失联后，内核沿正常停机路径中止在途调用、保存并回收，调试配置、文献库和项目数据保留；启动后未完成所有权登记的实例在有界时间内自行退出。下一轮调试启动当前构建的新实例，内核代码不做热替换，需全部调试宿主结束后重新打开。独立 CLI 与普通产品实例继续默认驻留并在关窗后续跑；调试配置已被独立内核占用时，调试入口报告归属冲突并保留该实例，改用其他配置或先显式停止独立内核。

工作台菜单“停止内核”会说明所有客户端受影响并要求确认。受理或连接关闭不代表退出，界面和 CLI 核对实际状态后才显示停止；不能确认时显示结果未知并提供查询。收到明确停机后客户端不会自动重启，用户可重试连接。真实来源的指令、材料选择与未保存文件草稿按配置／项目／会话或文件保存在本地，可跨停机、断线及刷新恢复；本地存储不可用时退回内存。

`pnpm dev:host` 启动隐藏宿主页面，供后续内部调试。宿主内部 DOM 用于兼容适配，不作为产品工作台。当前没有加载 Zotero 应用或插件。

格式和静态检查使用 Biome；`pnpm format` 会写回格式，`pnpm lint` 检查格式、lint 和 import 组织。生成目录及临时研究材料不纳入源码检查。

## 共享工作台与日常交互

日常反馈和最终产品都在 `apps/desktop/src/renderer/src/workbench/Workbench.tsx` 上演进，共用 `styles.css`（语义 token + 浅色/深色双主题，默认跟随系统，左区底部可手动切换）。工作台为三区骨架：左区（操作菜单、会话列表、内核状态）、中间区（tab 组 + Agent 面板）、右区（文件树、材料、任务）；左右区可折叠为图标轨（`Ctrl/Cmd+B`、`Ctrl/Cmd+Alt+B`）。Agent 面板固定在中间区：折叠态 dock 在底部（tool 消息固定顶部、最新 agent 消息截头留尾、精简 composer），点击展开为占满中间区的 overlay（完整消息流与 composer，Esc 收起）。tab 组支持激活、关闭与"向右拆分"按钮，文件、设置和题录库 tab 已接入真实内容，PDF 阅读器及共享阅读记录也已接入。外壳组件在 `workbench/shell/`，布局与视觉契约见 `docs/ui-design/`。`main.tsx` 只选择 session 来源。`workbench/session.ts` 定义界面输入：连接状态、材料及选择、可选的会话/文件树/任务数据、回调和 assistant-ui ExternalStoreAdapter；消息由来源提供，草稿由 assistant-ui Composer 管理，发送、消息呈现和重置都经过工作台的同一路径。真实来源经 `packages/client` 获取业务事实；领域 DTO 仍以 `packages/protocol` 的 schema 为准。

真实首页默认空 tab；连接不等于模型及授权就绪。设置 tab 集中模型、授权与备份，左区项目控件支持新建、打开、切换、显示名修改与移出最近列表（不删目录、不停止执行）；会话、文件编辑、发送、取消和继续复用共同客户端。开发态显式打开 `?scenario=ui-foundation` 才加载隔离样例；它仍只保留最新一轮，使用固定材料和回复，不读文件、不调模型、不持久化；生产构建忽略样例参数。

## 本地文献库

工作台的“文献库”打开共同 library tab，题录库保存在配置的 `library/library.sqlite`，独立于研究项目。读取默认开启，写入与将库题录发送到模型分别授权；Agent 库工具还受当前会话外发授权约束，不提供修改授权、恢复或任意本机文件路径工具。库内写入采用 Drizzle 管理的独立表与迁移。

首个摄取格式为 CSL JSON（可粘贴或选择本机 JSON 文件），一次不超过256KiB/1000条，单条题录不超过16KiB且有非空 title，其余扩展字段保留。手动建项也走同一摄取入口。批次受理返回稳定身份，逐项保存创建、复用、冲突或失败；合法项可先查用。相同 batchId 不同输入拒绝，内核中断保留记录，显式继续只处理未执行项，不重放成功项；中断原因可查询。

规范化 DOI 与明确版本标签同时相同才自动复用条目，`unspecified` 和无 DOI 条目不自动合并。填补空字段时保留已有冲突及候选，预印本与正式版分别保存并可显式关联。题录更正核对修订号；集合支持父级与多重归属，标签和版本关系均沿同一接口保存。库查找、集合、历史及批次分页默认25、最多100条，题录列表还受512KiB响应预算约束；库变化只使相关投影重读。

本地材料通过文献库 tab 输入本机绝对路径批量摄取，每次最多100份，单文件最多128MiB。默认复制到库私有材料目录，也可显式只登记外链；原文件保留。可以添加到既有题录并标明用途，未选题录时按文件名建立待核对候选，不猜测 DOI 或发表版本。附件登记与实际可读分开：详情按页核对文件状态，原字节按引用分段读取，每段最多256KiB。

附件身份、材料版本与路径分开。同来源、用途和托管方式下相同内容可复用；外链移动后可以人工重新指定到同内容文件，内容不同则拒绝覆盖旧版本。材料读取核对记录内容，缓存仅用于同一文件身份、大小和时间戳均未变化的后续分段。外部编辑器不受应用锁约束，读取前后核对不能承诺阻止所有外部竞态。Agent 文件摄取只使用当前已授权项目内路径，批次保存项目归属，准备及提交前重新检查项目读取和库写入权限。

库提供手动和默认五分钟的可关闭自动备份，保留最近十份。新备份包含数据库快照引用的托管材料，清单列出未复制的外链依赖和缺失材料；旧备份仍标明仅题录数据库。恢复要求新的独立配置目录，可在副本核查来源、历史及原字节；副本使用新库身份、关闭写入/外发且不自动接续批次，当前库和备份后的成果保留。恢复配置可通过已有 `--data-dir` 入口独立检查。v1 题录库升级到 v2 前保存数据库副本，并撤销旧写入和外发授权；用户需重新确认扩大后的文件管理及材料外发能力。

附件详情的“阅读记录”只展开所选材料，用户可保存整份材料的文献笔记、更正说明、查看旧修订或移除记录；摘录与说明分别显示。列表和历史每页25条，草稿按配置、材料版本与记录保存；冲突保留说明，明确重读后核对再保存。创建回执未知时保留原身份及原提交输入，提供核查与按原输入重试，不因输入变化重复建项。材料失效时旧摘录仍可查，说明可更正，新建笔记需材料可读。笔记与历史保存在库 v3 数据库中，随现有备份恢复；v2升级前保存 `before-migration-v2.sqlite`，保留原库身份与授权。

共同客户端入口为 `library.status/grant/list/get/ingest/batch/batches/resume/update/collections/saveCollection/history/backup/backups/restore`、`library.importFiles/importProjectFiles/attachments/readAttachment/relocateAttachment`、`library.pdfInfo/readPdfPage` 及 `library.readingRecords/readingRecord/readingHistory/saveReadingRecord/removeReadingRecord`。Agent 使用同一入口对应的工具，创建者取实际会话身份；文件摄取只接受当前授权项目路径，不开放任意本机路径或重定位工具。

附件“打开 PDF”进入共享 reader tab，可翻页、缩放、搜索和选择文字；选区按页进入记录草稿，明确保存后才显示持久高亮，书签和独立笔记沿同一面板。内核无需窗口即可取文：每次一页，默认16Ki字符、最多32Ki，可按 nextOffset 续取。解析串行 Worker、最多8项等待、自受理起30秒；超时及停机终止执行。PDF 调用及带位置的保存等待35秒，普通笔记沿原请求时限。无文字层不做OCR，加密材料不提供密码流程，原文件不写回。SDK、字体与许可见[第三方资源说明](third-party/pdf-reading.md)。EPUB／网页和科研分析分别沿 P4b 后续及 P4c。

## 基本单 Agent harness

内核代码不会热替换。独立驻留实例在实现更新后需重启；调试内核需结束全部调试宿主，下一轮调试才加载新构建。工作台重连接回原实例。

在“模型设置”填写 MiniMax M Plan 中国区订阅 Key 即可；连接固定使用 `https://api.minimax.cn/anthropic` 和 `MiniMax-M3.1-Flash-Preview`，不回退到按量模型。也可在启动独立内核前注入 `MINIMAX_CN_API_KEY`；保存的凭据优先。环境变化需要重启内核才会继承，当前请求保留原凭据。不要将 Key 写入项目或命令参数。

本机 `credentials/` 保存 AES-256-GCM 密文与独立主密钥，POSIX 目录／文件权限为 0700／0600，Windows 使用当前用户 ACL。系统不回读 Key，不通过静态服务、项目工具或普通诊断暴露它。主密钥同机自动解锁，不能抵御同权限进程；损坏时保留现场，不自动覆盖。

普通会话可直接聊天。打开研究项目后，分别授权读取、普通写入和发送到 MiniMax；范围内不重复确认。新建会话，附加文件引用后发送，Agent 实际使用材料与成果来自工具记录。流式输出、追加指令的受理／消费、取消与继续均使用内核持久状态。关窗不取消工作；重启将未完成工作标为中断，用户明确继续后才核查 checkpoint 和当前文件。checkpoint 不可用时保留原记录，以新尝试接续；旧指令可由分页工具发现。

新会话以首条受理指令生成短标题，可在左区会话行的管理菜单重命名。列表支持当前项目内的标题查找、活动／归档切换与每页 50 条分页；筛选不切换接收者，当前会话独立读取。排队、运行或取消中的会话需等停止后归档；归档保留历史、成果、指令与草稿，禁止发送和继续，恢复不自动执行。会话变化跨客户端更新列表，连续正文输出只刷新当前消息。

展开会话可阅读 Markdown、代码、表格和公式，复制原始正文或代码；状态和材料引用单独呈现。材料按已记录的稳定文件身份打开，历史无身份记录标明按历史路径打开；相对链接以项目根为基准，复用文件 tab 并保留草稿。消息图片不自动加载，外链只在明确点击后打开，HTML 不执行。消息及文件预览共用有界 Worker 调度，消息只解析可见正文。

输入器显示当前项目、模型与已保存的读取／写入／外发授权。dock 显示最新工具真实状态；展开会话后，可展开每条工具记录查看输入、结果和截断提示，预览各最多 16,384 个 UTF-16 单元。工具失败与图是否结束分别显示；取消或重启遗留调用标为结果未知，不表示已有效果撤销。成果行的“打开成果”复用文件 tab，收起会话浮层并保留指令草稿；登记待核查的成果仍可核查补齐。旧工具记录保留历史说明，不补造输入和结果。

项目的 `.scholoom/` 保存稳定身份、SQLite 事实、执行 checkpoint、有限文件历史及备份；正文以实际文件为准，目录移动后仍可打开。文件和目录的创建、重命名、回收与恢复经同一接口，稳定 fileId 跟随结构变化，历史路径保留；回收载荷保存在项目私有目录，恢复默认原路径，也允许另选路径，不覆盖已有内容；普通写授权涵盖这些结构操作，既有项目升到 v2 时先备份，仅清除 write 并要求重新确认，其余授权保留。文件接口支持 UTF-8 文本，整份编辑上限 256 KiB；按文件串行核对整份读取依据，变化后重读，不自动合并。新建不覆盖已有文件，撤销保护后续内容。内部目录、凭据文件、越界路径和外部符号链接不在普通文件授权内。

文件 tab 使用 CodeMirror 6，提供保存、差异、重新读取及历史撤销；Markdown 的源码、预览与并排视图共享同一草稿，预览由 Worker 按 unified + GFM + KaTeX 渲染，不执行原始 HTML。项目内 PNG／JPEG／GIF／WebP 图片在 1 MiB 上限内按需读取，远程图片不自动请求；相对链接走文件入口，http(s)／mailto 链接仅在用户点击后打开（Electron 经窄宿主桥）。会话草稿、材料选择和文件草稿按数据配置与对象保存在本地浏览器存储；浏览器存储不可用时仅保留本次页面的内存草稿。重新读取保留未保存内容，用户核对差异后再保存。恢复副本中的内容可打开、复制，并通过普通编辑和保存取回到当前项目。

备份默认五分钟检查内部与外部文件变化，保留最近十份，可关闭或手动触发。备份包含数据库副本、不超过 256 KiB 的文本、不超过 1 MiB 的光栅图片，以及项目私有回收目录中的载荷；不包含外部链接、其他二进制、超限文件或 checkpoint，缺项记录在私有清单中。回收载荷不完整时，恢复该回收项被拒绝并指向缺项清单，不报告完整恢复。文件与数据库不承诺全局瞬时一致。恢复目标必须是新的独立目录，保留当前项目；副本使用独立身份并重新授权。

CLI 使用同一接口，例如：

```sh
pnpm kernel project-open --path /path/to/project
pnpm kernel project-grant --project PROJECT_ID --read --write --send
pnpm kernel session-create --project PROJECT_ID
pnpm kernel send --project PROJECT_ID --session SESSION_ID --text '读取材料并保存分析'
pnpm kernel session --project PROJECT_ID --session SESSION_ID
pnpm kernel cancel --project PROJECT_ID --session SESSION_ID
pnpm kernel continue --project PROJECT_ID --session SESSION_ID
```

请求受理立即返回指令／执行引用；回执丢失时保留原 `--instruction-id` 查询或补交。工作台刷新后会核对持久的待确认输入，未能确认时提供“按原身份补交”，保留当前草稿。缺失用量为未知；请求默认 180 秒、模型并发 1，安全临时失败最多额外两次重试，不重放已输出的流或未知副作用。取消只确认本地调度与工具停止，不代表远端已停止计费。当前执行默认最多 32 次模型请求，触限保留成果并等待继续。

内置科研方法通过 `discover_research_methods` 发现摘要、`load_research_method` 按身份与版本读取正文。普通方法可直接使用；明确能力工具 `invoke_research_capability` 自动核对输入和 read/write/send 授权，复用同一模型额度与安全文件工具。首项 `scholoom.material-analysis`（`1.0.0`）接受 `materialPaths`（1–10 个项目文本）、`outputPath` 和 `goal`，例如要求“按材料分析方法读取 input.md，分析结果依据与限制并保存 analysis.md”。无需先创建研究任务。

工具详情返回稳定 `invocationId`、独立尝试、实际读取及保存文件、交付状态和缺项；`usable` 只表示本次报告实际保存、可读且输入已读取，科研充分性为 `notAssessed`。缺产物、失败或取消保留部分成果。明确重试前用 `read_research_attempts` 核查原记录，提供同一 `invocationId` 及原目标/输入；已有文件仍需读取后修改，不盲目重复未知效果。重启只将运行中尝试标为中断，不自动重跑。共同客户端的 `research.methods`、`research.method`、`research.attempts` 提供同一只读事实；尝试默认每页25、上限100条。

方法内容与来源位于 `apps/kernel/src/research/builtin/`，随内核构建复制。首次仅加载内置的 JSON 形式 YAML 声明；用户/项目方法发现、派生和启用管理随 P5a，完整文献 Digest 随 P4c 接入共同能力入口。当前能力记录在项目数据库中，沿既有备份与独立副本恢复保存。

`pnpm test:kernel` 使用外部 HTTP 模型夹具，内部图、工具、文件和数据库均为真实实现。真实模型验收需显式运行 `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:kernel tests/kernel/minimax-live.spec.ts`，只使用隔离合成样本；默认测试不会使用真实 Key。该验证检查接线及可判定结果，不代表完整科研质量验收。

本机日常启动：

```sh
pnpm dev:browser --port 5173 --strictPort
```

在本项目 Orca 本地浏览器打开 `http://127.0.0.1:5173/`，交互演示打开 `http://127.0.0.1:5173/?scenario=ui-foundation`。用户直接操作页面，选中元素提交 Design Feedback；Agent 读取随消息附带的组件、selector、页面上下文和意见，修改共同源码，再在同一页面检查 HMR 和行为。操作细节或布局意见可以继续通过对话补充。Orca 是外部开发工具，产品内的科研 Agent 使用内置 harness。

Agent 使用 Orca browser skill，先列出当前项目的标签，核对 URL 与 `browserPageId`；后续命令显式指定 `--worktree path:<本项目绝对路径>` 和 `--page <browserPageId>`。采用 snapshot → interact → snapshot 循环，导航或状态变化后重新读取；PowerShell 中引用元素写成 `'@e7'`。截图必须实际查看，语义快照不能替代视觉验收；检查 console 和 network 的错误。HMR 检查记录刷新前后的草稿、选择、消息和页面加载时间，组件结构变化可能重置状态。

如果 CLI 无法新建本地标签，用户可手动打开上述链接，再列出标签并继续；桌面不在线或页面不可读时记录实际错误。已发送的结构化反馈可读取，独立轮询未发送注释尚未验证。Windows 路径实测见[验证记录](../.scratch/scholoom-foundations/research/orca-ui-windows-validation.md)。服务已有时先确认项目、端口和可达性，避免重复启动；仅停止本轮自行拥有的进程。

新增 UI 行为直接扩展 Workbench，样例只注入状态与回调，验收扩展 `tests/ui/workbench.spec.ts`。材料、消息和事件处理各保留一个来源；跨宿主差异留在薄入口或适配层。题录库沿共同模块继续接入附件，任务等其他 tab 内容按后续需求逐项接入。

模块独立开发时，可在既有 UI harness 中增加专用可视化夹具，接入真实被测模块和交互组件，并明确输入及依赖替身；夹具与整合验收的边界见 [deep module 与独立交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#deep-module-与独立交付)。

跨主机访问可用 `--host 0.0.0.0` 打开界面或隔离样例；真实内核引导与连接仍限本机，不提供远程内核能力，也不向局域网页面交付凭据。默认只监听 `127.0.0.1`。

## 验证与目录包

首次准备 UI 测试运行时执行 `pnpm setup:ui`，安装锁定 Playwright 版本的 Chromium headless shell；Linux 可用 `pnpm setup:ui --with-deps` 安装系统依赖。

`pnpm check` 串联 lint、类型检查、构建、内核、smoke 和 UI 交互测试。单独运行测试前先执行 `pnpm build`。`pnpm test:kernel` 验证真实进程、并发启动/重启、配置隔离与别名、认证和协议、传输重连、调试所有权共享与回收、独立驻留及停机结果未知；受控代理只在传输边界丢失或延迟消息，业务请求仍到达真实服务。

`pnpm test:smoke` 启动构建后的应用，核对独立 Node CLI、真实工作台连接、生产样例隔离、sandbox preload、关窗续留和重开，以及宿主隐藏窗口；开发 smoke 运行实际 `dev:browser`／`dev:desktop` 命令，核对共享实例、退出顺序与最后退出后的回收。真实模型 UI 验收显式设置 `SCHOOLOOM_LIVE_MODEL_TEST=1`，只使用合成样本与环境中的模型凭据；默认回归不使用真实模型凭据，只在外部模型边界注入受控响应。Electron fixture 经原生窗口关闭与应用退出核对所拥有进程的退出，再明确停止测试内核。

`pnpm test:ui` 使用 `playwright.ui.config.ts`，同一场景分别驱动 Chromium 和真实 Electron。它覆盖真实连接、内核连接重连、草稿保护、停机与重试、崩溃后用户重试及既有样例行为；浏览器引导和静态凭据访问检查执行一次。测试独占 `127.0.0.1:5174`，使用 `test-results` 下的独立配置；各套件的 trace 分目录保存。结束时关闭本轮应用与服务并确认内核退出，无法确认退出时保留配置供诊断。

真实开发命令及模型 UI 验收位于 `tests/smoke/development.spec.ts`：普通场景使用浏览器5315／Electron CDP 9315，live 场景使用5316／9316，Electron renderer 使用本轮服务的实际 URL。显式运行 `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:smoke tests/smoke/development.spec.ts --grep 'live MiniMax' --output test-results/development-live`；Key 仅经环境注入，不录 trace，保存合成成果作为验收附件。Linux 命令自动化使用 electron-vite 的 `NO_SANDBOX=1` 环境选项，与既有 Playwright Electron 启动设置一致；产品默认 sandbox 设置不变，本机通过不代表目标平台 OS sandbox 或分发包已验收。

无图形会话的 Linux 需要 Xvfb 和 Electron 所需动态库，使用 `xvfb-run -a pnpm check`。Smoke 检验工程入口，UI 测试检验共同界面行为；业务契约、科研效果、原生能力和插件支持仍须相应真实场景验收。

`pnpm package:dir` 构建并分别生成两个 Electron 目录包，输出到 `release/desktop` 和 `release/zotero-host`。当前不生成签名安装器、不打包独立内核运行时和科研执行工具。发布前再落实已确认的工具分发、签名和安装后验收。

GitHub Actions 使用 Linux、Windows、macOS 矩阵运行同一检查与目录打包；远端结果以实际 workflow 运行为准。本机 Linux 通过不表示三平台已验收。

## 实施约定

新功能依项目默认 `scholoom-dev` schema 留下调查、契约、设计、任务和实际交付记录。结构调整以代码和真实运行结果为准，规格与决策解释保持一致。

拆分任务、安排整合和判断完成时，遵循[按实际使用路径开发与交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#按实际使用路径开发与交付)；原型、基础设施和可用功能按各自目标记录实际验证结果。

模块交付的诊断入口与早期交互反馈沿[开发操作与 UI 调试](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#开发操作与-ui-调试)及[人机分工](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#人机分工与协作)；测试预期沿[独立验证依据](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#e2e-与必要检查)。

设计模块、复用旧实现或重构前，按[架构优先的复用与必要重构](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#架构优先的复用与必要重构)评估，并读取相邻的测试 oracle／TDD 与 deep module 约定。

assistant-ui 已用于工作台的消息和 Composer；数据库、LangGraph harness、代码编辑与 Markdown 预览已随项目文件工作台接入。内置材料分析沿共同能力模块执行；受管执行和插件在对应功能接入时安装并验证。范围明确后建立模块，避免提前加入空目录和假实现。
