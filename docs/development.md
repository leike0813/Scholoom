# 开发说明

## 模块与入口

| 包 | 当前职责 | 后续实现边界 |
| --- | --- | --- |
| `apps/kernel` | 内核宿主装配、CLI、物理容器升级和投影 | 绑定所属仓储与窄端口，不保留领域副本 |
| `packages/projects` | 项目、文件身份、条件保存、回收及成果关联 | 受控原生入口 `/node`，宿主注入容器初始化 |
| `packages/library` | 题录、附件、阅读记录、批次及材料解析适配 | 受控原生入口 `/node`，项目材料经窄端口取得 |
| `packages/harness` | 会话仓储、执行监督、工具收据、checkpoint 和受管执行桥 | `/execution` 运行实际图及 SDK；项目、文献、科研端口可独立替换 |
| `packages/research` | 方法内容、尝试、实际读取与交付检查 | 仅访问自身表，生产经 broker 使用领域与 harness 契约 |
| `packages/editor` | 人工科研写作的开放格式转换、受管排版与产物 | `ManualApplication` 独立装配，不加载 harness、会话或模型；行为以当前 editor OpenSpec 为准 |
| `packages/models`、`packages/platform`、`packages/broker` | 模型及凭据、资源与进程机制、能力路由及共同 RPC | 具体迁入及验收范围见当前 change |
| `apps/desktop` | Electron main、sandbox preload、React renderer | 人类工作台，经共同客户端调用内核 |
| `apps/zotero-host` | 独立 Electron main 与隐藏 Chromium 页面 | 固定 Zotero 10 基线的通用兼容层与选定插件适配 |
| `packages/protocol` | JSON Schema 与推导的 DTO、协议版本 | 客户端和内核共同使用的调用及事件契约 |
| `packages/client` | 共同 WebSocket、认证、类型化业务调用、范围订阅及重连 | 后续领域能力 |

共享包与内核构建为 ESM；Electron main/preload 构建为 CJS。根 `pnpm build` 按工作区依赖顺序构建。`pnpm typecheck` 先生成共享包声明，确保刚安装的工作区也能解析共享接口。

Electron 工作台和 CLI 共用独立 Node 内核，浏览器开发入口经同一客户端连接。关闭或退出工作台只关闭界面；兼容宿主尚未接入内核监督，也未加载插件。

协议 schema 是 DTO 的事实源，类型从 schema 推导；客户端和内核使用 Ajv 校验消息、认证、状态及引导结果。连接状态不代表研究指令已经可执行。

客户端与内核 WebSocket 入口共用双向 RPC peer，业务请求经 KernelApplication 的类型化提供者映射与 broker。协议版本为 4；操作载荷、等待策略及副作用由分域 schema 提供。Agent 和 PDF 已接受管 Node 子进程及 IPC，兼容宿主仍为骨架。按角色发现、普通模块迁包和完整实例资格的实际覆盖见[运行架构迁移交付](../openspec/changes/archive/2026-10-19-migrate-runtime-architecture/delivery.md)。

`pnpm check:architecture` 使用唯一 `architecture.json` 检查包依赖、循环、私有路径及普通模块系统访问，并在 CI 运行。精确迁移例外注明退出任务；当前检查通过不代表这些旧调用已迁完。`pnpm generate:contracts` 用 Node 24 装载 protocol 声明源，输出业务、执行及项目内部操作的类型映射更新 patch，映射继续引用原 schema；映射过期导致完整编译失败时仍可生成。`pnpm typecheck` 检查实际装配和编译期反例。

执行控制映射也由 `generate:contracts` 产生 schema 引用。名额申请／释放、健康、停止、checkpoint 消费确认、图初始化、模型事件及工具接续共用声明派生的参数、提供者签名、结果和等待语义，并在 IPC 两侧校验。动态工具的输入仍从原注册 schema 解析，Zod 默认值在宿主执行前应用；模型描述复用 models schema。SDK 消息与 Command 的原生类型适配留在 harness 内。

`startExecutionWorker` 将共同 IPC、健康和停止机制留在 harness；`KernelApplication` 为根执行及能力子执行注入静态 `apps/kernel/src/execution-worker.ts` 入口，客户端载荷不能指定入口。宿主与 worker 共用 `execution-graphs.ts` 的源码注册集合，`ExecutionGraphs` 在构造图前核对身份、版本和配置 schema。生产集合当前为空；固定 StateGraph 仅在 `tests/fixtures/domain-execution-worker` 的宿主与 worker 同源装配，定向测试为 `graph-registration.spec.ts`、`registered-graph.spec.ts`。

宿主经内部 broker `harness.startGraph` 选择 registered 图，后续沿普通 `session.send` 发送新指令。尝试保存图身份、版本、配置、材料依据、状态格式及 checkpoint 绑定；`session.get` 返回 `graphProgress` 和 waiting／waitId。工厂的 `resume` 将新消息映射为已声明等待 schema 的输入与指令身份；不匹配时保留等待和未消费消息，不转为默认 Agent。图使用宿主提供的 `InstructionSaver`，先保存 `instructionIds`／`graphResume` 再确认消费；等待须对应实际 checkpoint 的 interrupt。重启只读取记录，不自动推进；旧版本不可用或 checkpoint 缺失时保留原尝试与成果，显式新版本另建尝试。registered 执行共用当前实例授权、进程准入、模型额度、取消和真实资源端口，无模型图不要求模型凭据。

registered 图的消息接续复用 `InstructionContext`，保留文字、原项目材料路径／身份、显式项和服务端持久来源。工厂 `resume` 收到完整上下文及原 `id/text`，已匹配指令经原 IPC 交给 worker 的 `create(input, context)`；源码启动材料继续使用独立的 `execution.materials`。worker 的 `InstructionSaver` 将完整上下文及 run 归属写入 checkpoint，宿主按服务端原消息核对后才确认消费；只保存身份不能确认。实际取材仍使用共同资源端口，受理、恢复、消费确认及模型排队前后／最终同步准入均复查授权。

等待映射按游标每批最多 100 条核对，未匹配项保留，后续有效输入仍可进入匹配。registered 指令在初始化前经所属 IPC 逐条传递，当前指令与 checkpoint 历史分开重建，避免将整个批次挤入单帧；传输未完成不会构造图或确认消费。checkpoint 可保留跨等待累计的完整上下文，消费确认每批最多 100 条，同一尝试的确认凭证累计保存，部分确认后重启仍可核查；历史材料授权依据沿原会话记录保留。普通 Agent 显式切图另建尝试并保留旧 checkpoint。缺少持久 checkpoint 的图仍拒绝非空初始化指令，普通 Agent 直接初始化的保护也保留；三线最终组合另沿工作台 change 的 4.5 验收。定向入口为 `tests/kernel/registered-context.spec.ts`，真实内部 worker／资源／SQLite，模型边界为受控 HTTP。

框架文件上传／下载已加入同一内部契约映射，以 base64 传输 SDK 字节并保留帧上限；连续压缩的历史追加经过实际 IPC 验证。会话临时资源位于 `.scholoom/harness/sessions/<sessionId>/scratch`；旧共享资源复制后保留原件，清单无法核对时持续提示 `context_incomplete`，新会话失败重试不继承旧共享目录。恢复核查最多 1000 个已保存引用，超限明确未完整核查，临时资源缺失不抹去摘要和领域成果。

框架文件桥其余操作也逐项使用同源声明；SDK 适配同时接受 `BackendProtocolV2` 类型检查。`ProjectBackend` 已迁入 harness，只消费项目契约派生的六个方法，生产端口由宿主经 broker 绑定项目范围；独立测试可替换端口。预期文件身份传到 projects 的原有保存临界区，领域权限不转移到 broker。harness 宿主 facade 中其余领域引用仍沿 4.2 迁入。

模型并发与 32 次根预算由宿主持有，父子进程、框架压缩和每次安全重试共用计数；子执行结束不返还已用预算。受控 HTTP／IPC 测试覆盖两会话串行、流结束释放、排队期间撤权及实例失效。凭据只交对应执行的内部模型适配，受管进程使用环境白名单；合成秘密测试核对 argv、环境、公开状态、运行记录、checkpoint 和项目备份，真实凭据与跨平台分发仍需各自验收。

共同 peer 默认普通在途、入站及发送等待各 64，控制保留 8，单帧仍为 2 MiB。Linux Node 24 的受控 1 KiB 载荷样本中，64 个普通等待加 8 个控制等待共发送 72 帧、70,079 字节，约 3 ms 内明确拒绝第 65 个普通等待；该测量用于本地容量依据，不是网络性能或三平台承诺。小容量慢发送测试核对普通积压受限、控制优先及过载关闭不产生未处理拒绝。

会话统一通过 `send` 推进。中断后的兼容接续沿原尝试及模型配置；正常新轮取得当前配置，从上一尝试的私有图状态导入上下文。checkpoint 位于项目 `.scholoom/harness/checkpoints/<runId>.sqlite`，独立 SQLite claim 锁与持久运行实例共同限制写者；不能排除旧进程时拒绝相关接续，不按旧 PID 终止其他进程。旧共享及独立 checkpoint 按线程惰性导入 namespace、pending writes，源数据保留；损坏则保留原件和诊断，使用新尝试核查持久指令及成果。临时恢复资料仍不计入成果备份。

项目和文件原生适配位于私有 `@scholoom/projects/node`，只依赖项目契约及所需平台能力；物理 SQLite 容器初始化由内核宿主注入，项目包不反向导入内核、harness 或科研仓储。文件路径、身份、条件保存、串行协调、回收、备份与成果关联仍由同一项目实现负责。独立测试直接组合该包与初始化适配，无需启动 Agent 或模型。

`ManualApplication` 是不装配模型、harness 或科研运行时的宿主组合，提供项目、文件、题录、附件和阅读记录操作；`KernelApplication` 在其上注册执行能力。认证状态中的 `capabilities` 来自实际注册的公共操作，内部控制不进入该集合；缺少可选提供者时仅对应调用返回 `unavailable`。人工组合不注册需要各模块共同恢复的 `project.restore`，该操作由完整宿主协调。library 通过同一 broker 的 `project.checkRead`／`project.material` 取得材料，消费范围来自 `architecture.json`；模块独立测试可替换这些契约派生端口。

Agent、能力子执行与 PDF 共用宿主持有的进程容量，默认活动 4、等待 8、等待期限 30 秒，参数集中在 protocol 的 `limits`。父进程等待子执行时继续计占用；子执行不足即时拒绝，根执行可有限排队，取消排队不创建进程。容量在材料加载前取得，实际执行进程停止后释放；每个执行另有一个控制辅助进程，辅助开销不算作执行名额。Linux Node 24 的受控样本实际启动 4 对控制／执行进程，另排队 8 项，启动约 222 ms、收尾约 34 ms（测试升级期限 20 ms）；该样本只支持默认容量选择，不代表框架内存预算或跨平台性能。

宿主按 5 秒间隔检查执行事件循环，单次健康请求最多等待 5 秒；模型等待期间仍应能回应。健康失败按归属停止，已受理工具失联保留效果未知；controller 退出不能代替实际停止确认。迟到事件及状态先核对尝试，旧尝试只补自己的历史。真实故障样本覆盖忙循环、模型等待、写入后暂停进程、实例撤权和另一会话／文献查询继续可用。

执行沿 [#07](../.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer) 的 Deep Agents／LangChain／LangGraph 路线。当前支持单 Agent 材料任务与内置材料分析方法／能力；插件 MCP、受管 shell 和多 Agent 尚未接入。

## 工作区文件树与传输

文件树由 `apps/desktop/src/renderer/src/workbench/file-explorer/Explorer.tsx` 提供，浏览器与 Electron 共用；业务操作经共同 protocol/client，`files.transfer`、`files.transferStatus`、`files.transferDecide`、`files.transferCancel` 及 `files.importBegin`／`files.importChunk`／`files.importFinish` 是同一契约。导入按 256 KiB 分块，单任务最多 10000 项。目录列表按版本分页，每页最多 100 项，可用 anchor 定位；`ProjectFileWatches` 只监听显式项目路径范围，并在连接释放时清除订阅。

传输日志写入现有 projects meta 记录，不涉及物理 schema 迁移；暂存文件位于项目 `.scholoom/transfers`。备份恢复到独立副本，不承接原传输日志。中断后的 status 仅核查原操作及实际位置：能排除回收受理且目标已完成时收束为 `partial`，结果仍无法确认时保留 `unknown`；查询不重放写入。

定向诊断运行 `pnpm test:kernel tests/kernel/file-transfers.spec.ts tests/kernel/file-watch.spec.ts` 和 `pnpm test:ui tests/ui/file-explorer.spec.ts`；UI 准备及宿主范围见下文验证说明。

## 本地工作

### 领域独立接入

公共基础及七域的启动条件、共享文件归属和 dev 接入责任以[公共实施规划](../.scratch/domain-development/public-foundation-plan.md)为准。模块测试沿现有窄端口替换未完成依赖，替身须符合所属同源 schema；实际 broker、进程、文件和仓储接线分别核对。各域可从以下已有入口构造自己的小样例：

| 开发线 | 接入口及独立检查 |
| --- | --- |
| 文献 | 沿共同 `ResourceRef`／材料版本提供所属读取；参考 `resource-access.spec.ts` 的真实项目、库及解析组合，以及 `literature-integration.spec.ts` 的摄取路径，仅替换外部摄取来源 |
| 项目 | 沿 `HarnessProjectPort`／`ProjectFilePort` 取用项目能力；`project-backend.spec.ts` 提供窄端口替身，`resource-creation.spec.ts` 验证真实 `resources.create/creation` 的首次创建与原操作核查 |
| 科研方法 | 宿主与 worker 共用 `ExecutionGraphs` 的定义及工厂；照 `registered-graph.spec.ts` 向测试 `KernelApplication` 注入 `executionGraphs/workerEntry`，引用同一 `graphs.mjs`，等待输入按声明 schema 适配；`research-module.spec.ts` 独立检查方法仓储 |
| Agent | 沿 `HarnessStorage`、领域端口及私有 worker 入口组合；参考 `harness-module.spec.ts`、`execution-isolation.spec.ts`，外部模型复用 `tests/model-server.ts` 的 loopback 受控响应 |
| 科研计算 | 参考 `managed-commands.spec.ts` 的 `ManagedCommands(processes, resolveWorkspace, authorize)`；私有工作空间声明 ownerModuleId、directory、projectId、executables，真实宿主用例覆写 `commandWorkspace` 登记固定 Node。环境选择和业务运行记录由计算域实现 |
| 阅读交互 | 沿共同资源和 editor 端口接入，参考 `resource-access.spec.ts`、`editor-runtime.spec.ts` 及 `tests/ui/resource-opening.spec.ts`；UI 使用共同 renderer URL 配置 |
| Zotero 生态 | 沿兼容宿主入口及共同 broker 接入；`tests/smoke/entrypoints.spec.ts` 验证真实宿主外壳，插件身份、SQL 和 BBT 生产接线另按所属契约验收 |

表中内核用例位于 `tests/kernel/`，UI 与宿主外壳用例分别在 `tests/ui/`、`tests/smoke/`。窄端口内存替身受 TypeScript 检查，跨 broker／IPC 的输入输出继续经过原同源 schema；资源、文件及仓储的真实组合使用所属提供者，不用成功替身代替。

固定样例位于 `tests/fixtures/domain-execution-worker/`：`fixed-counter` 只检查实际两节点图及 IPC，其 `execution.custom` 回报由内联测试提供者接收；`fixed-resource` 检查真实材料与首次创建；`durable-resource` 沿完整 KernelApplication 跑真实 SQLite checkpoint、interrupt 和新消息恢复。`worker-v2.mjs`／`worker-model.mjs` 分别提供升级及模型额度边界，额度用例只调用真实 acquire/release，不据此宣称模型生成通过。生产 `apps/kernel/src/execution-graphs.ts` 当前为空，固定图不注册为科研方法。

同目录 `command.mjs` 的 echo／overflow／tree 模式实际运行 Node、输出边界和后代进程。机制用例的工作空间和授权回调是明确替身，broker 用例使用活动会话和真实实例授权。各组合的实跑范围见[领域交接交付](../openspec/changes/establish-domain-execution-handoffs/delivery.md)。定位失败时，先区分协议拒绝、注册校验、准入等待、实际执行及结果交付，再沿对应测试和所属记录核查。

先按根命令完成构建，再选择表中相应 spec；已有运行时无需重新执行安装脚本。例如：

```bash
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/graph-registration.spec.ts tests/kernel/registered-graph.spec.ts tests/kernel/managed-commands.spec.ts
SCHOOLOOM_UI_PORT=5341 node node_modules/@playwright/test/cli.js test tests/smoke/development.spec.ts --grep 'two renderer instances'
SCHOOLOOM_UI_PORT=5343 node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/resource-opening.spec.ts tests/ui/resource-lifecycle.spec.ts tests/ui/writing-editor.spec.ts
```

依赖和工具版本以 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 为准。pnpm 的依赖安装脚本授权集中在 `pnpm-workspace.yaml`。Electron 42 起取消依赖的自动运行时下载，项目使用官方 `install-electron` 命令显式准备二进制，见 [上游安装说明](https://github.com/electron/electron/blob/main/docs/tutorial/installation.md)。

`pnpm dev:desktop` 使用 electron-vite；`pnpm dev:browser` 使用同一 React renderer。浏览器入口没有 Electron bridge，界面业务功能经共同客户端实现。

## 共同资源打开

文件树、消息文件链接和文献附件均进入 `resource-controller.ts` 的资源引用及工作台 `renderResource`，由 `ResourceView` 选择同一文本、PDF 或 EPUB／HTML 组件。库 tab 和库附件跨项目保留，项目切换恢复各自文件组及草稿；资源导航不切换 Agent 会话或项目信任。

公共 `resources.describe/read/document/save` 由 editor 的 `ResourceAccess` 经窄端口组合项目与库权威，`ManualApplication` 可在无模型、无 harness 时使用。项目引用使用稳定 fileId，库引用包含附件和材料版本；响应不含 nativePath。UTF-8 文字读取位置以 UTF-16 为单位，base64 以字节为单位，单片最多 256 KiB。项目字节读取绑定内容依据并在读取前后复查；正文保存复用原项目条件保存和文件身份保护。库正文只读，阅读记录仍保存到原库。

宿主通过 `executionResources(context)` 为活动执行装配同源 `ExecutionResourcePort`，无需打开资源视图。本项目沿原条件保存，其他项目只经 `project.readTarget` 读取已登记 fileId，按路径描述不能登记目标身份。资源交付前后复核工作域、实例与外发授权；读过的库和目标沿会话已有上下文记录，在后续模型请求前再次核查。相同执行信号共享目标实例绑定，项目重开不能悄悄替换原来源；嵌套项目操作和排队后的保存也保留当前执行检查。

`resources.create` 使用稳定 operationId，在项目原有 `file_operations` 中保存创建主体、输入、editId／fileId、候选及发布身份，原子发布到不存在的路径。`resources.creation` 核对原收据，不重新写文件；同身份不同输入拒绝。发布后登记失败保留候选，只有目标物理身份和内容依据均符合原候选时才能确认，同路径同内容的替换文件保持 unknown。JSON 收据字段为可选扩展，沿原项目数据库和备份；恢复副本不重放未确认创建，缺失候选在备份清单中说明。

执行保存及 worker 的 `resources.save` 返回实际 resource 与独立 association；人工资源保存继续返回原 descriptor。文件保存回执包含实际 basis，普通 Agent 和能力子执行一并传给原 `pending-artifacts` 回执。关联失败保留文件和回执，`artifacts.reconcile` 只补关联，必须核对原 fileId／basis；旧回执缺少依据时保持 unknown。创建核查也可补原执行的关联，不能用当前路径替代原成果。

解析复用宿主注入的 `MaterialReading`，项目与库采用同一受管进程机制。每个视图给文档请求生成独立 requestId，关闭时以 `resources.cancel` 中止自己未完成的请求；权限或材料变化在交付前再次核对。材料不可用时描述保留实际能力及 `unavailableReason`，库记录仍可独立核查。

定向诊断入口为 `tests/kernel/resource-access.spec.ts`、`resource-identity.spec.ts` 和 `tab-state.spec.ts`，产品接线为双宿主 `tests/ui/resource-opening.spec.ts`、`resource-lifecycle.spec.ts` 及原 PDF、文档、文件工作台和写作编辑用例。各项实际执行结果见[本变更交付](../openspec/changes/archive/2026-10-20-unify-workbench-resource-opening/delivery.md)，不能以接口存在替代运行验证。

## 科研写作与排版

写作能力由 `packages/editor` 提供，人工工作台经 `ManualApplication` 和共同 broker 调用；该组合不装配 harness、会话或模型。当前机器核对到 Quarto 1.9.37、配套 Pandoc 3.8.3、latexmk 4.87 和 MiKTeX；这些版本不代表其他机器或分发包已具备相同工具，产品可用性通过 `editor.tools` 查询。

`apps/kernel/src/commands.ts` 的 `ManagedCommands` 统一解析宿主私有工作空间和程序登记，管理进程准入、排队后再次授权及实际停止。editor 实际消费内部 `platform.command`，`platform.editorCommand` 保留为同一实现的薄适配。生产工作空间仅由 editor 提供，限 Quarto／latexmk，不开放客户端指定本机目录或程序。全局工作域及目标只读范围不获命令权限；Agent 必须具有相符 principal／session／项目工作域，宿主在排队前后核对 harness 当前运行实例和项目授权。人工排版可独立于 harness。命令失败和停止未知继续由 editor 保留原工作空间、诊断及最后成功预览。

`tests/kernel/managed-commands.spec.ts` 的机制用例使用固定工作空间及授权替身；broker 用例在隔离真实 KernelApplication／活动执行中使用宿主源码登记的固定 Node 程序，核对排队撤权、取消、失效实例及全局范围拒绝。进程树、输出边界和控制丢失沿原真实进程用例，`process-admission.spec.ts` 另核对未确认停止保留占用。实际结果见[领域交接交付](../openspec/changes/establish-domain-execution-handoffs/delivery.md)。

源码与 QMD／Markdown 可视编辑共用同一草稿。Markdown／QMD 轻量预览读取未保存草稿；完整排版读取已保存稿件，打开预览或保存时更新当前选择格式。QMD 默认 HTML，切换 PDF 后更新 PDF；LaTeX 保留原生多文件工程并编译 PDF。HTML、PDF、DOCX 均可通过显式导出生成到工作区，沿用既有文件冲突与传输保护。

可视编辑尚未转换成源码时，刷新或卸载先记录当前编辑状态；重开经同一转换服务恢复到草稿，不隐式保存到磁盘。载入与恢复期间正文只读，转换失败仍保留恢复记录；多个视图共享恢复发布和转换占用。

`editor.job` 返回排版状态、diagnostics、有限 `log` 及 `lastSuccess`。排版失败或取消时核对最后成功产物及其输入版本，不把旧产物说成当前稿件的结果。实施及实际验证范围见[科研写作编辑器交付](../openspec/changes/archive/2026-10-20-add-research-writing-editor/delivery.md)和同目录的 `tasks.md`。

产物缓存按项目限制为 256 MiB／64 份；单个产物最多 128 MiB、单文件最多 64 MiB、资源最多 1000 个。已有稿件按替换后的净占用准入，提交余量最多 128 MiB／1 份，切换成功后回收可淘汰旧版。缓存保护最后成功产物、最近 5 分钟读取的产物及导出；受保护的暂留产物仍计入后续准入，历史收据保留，过期产物查询返回 `notFound`。

相关验证入口为 `pnpm build`、`pnpm test:kernel tests/kernel/editor.spec.ts tests/kernel/editor-runtime.spec.ts tests/kernel/editor-source.spec.ts` 和 `pnpm test:ui tests/ui/writing-editor.spec.ts tests/ui/writing-editor-recovery.spec.ts tests/ui/writing-editor-pdf.spec.ts tests/ui/file-workbench.spec.ts`。`test:ui` 使用项目既有 Chromium 与真实 Electron 双宿主场景，覆盖学术内容往返、待转换草稿恢复、QMD／多文件 TeX PDF 预览及导出；文件工作台场景核对共享草稿、冲突、结构变化、主题与长稿输入性能。独立组件与实际内核产物验证另有对应测试；各层实际结果及平台边界见交付记录。

## 内核配置与生命周期

CLI 和普通产品实例默认使用仓库根 `.scholoom-dev/`；`pnpm dev:browser` 与 `pnpm dev:desktop` 默认使用 `.scholoom-dev/debug/`。`--data-dir` 优先于 `SCHOOLOOM_DATA_DIR`，未指定时使用对应默认目录；开发入口同样可用该环境变量覆盖调试配置。数据配置限定本机文件系统，不将运行目录放在 NFS 等网络文件系统。

当前发现、认证引导与目录选择仍是本机接线，尚无产品化 SSH 准备、隧道、传包与远端升级路径。[远程部署决议](../.scratch/runtime-architecture/issues/05-local-and-remote-deployment.md#answer)已确认本机或远端完整环境及目标行为；它不改变本节现有命令的含义，具体能力由后续 OpenSpec 实施并在真实远端验证，不能通过开放开发服务器监听地址代替。

```sh
pnpm kernel start --data-dir /path/to/isolated-profile
pnpm kernel status --data-dir /path/to/isolated-profile
pnpm kernel stop --data-dir /path/to/isolated-profile
```

命令输出结构化状态，公开运行信息不包含凭据；`--help`、`--info` 仍可单独使用。查询和停止不会初始化缺失配置。`start` 在并发请求下连接同一实例；内核仍占用配置但不可达时报告失败，保留原实例。

运行区的 `lifecycle.sqlite` 只承载系统排他锁，内核持锁至退出；`endpoint.json` 原子保存本次实例和连接资料，`kernel.log` 记录不含凭据的初始化诊断。锁文件持续保留，不能通过删除它来重启仍占用配置的进程。Node 24.12.0 会输出 `node:sqlite` 实验性告警。

Electron 通过窄 preload 桥请求内核引导：开发态主进程把请求转发给 electron-vite renderer 的 Vite 引导端点，生产态调用独立 Node CLI。内核使用 PATH 中的 `node`，也可由 `SCHOOLOOM_NODE_EXECUTABLE` 明确指定 Node 24；缺失或错误运行时显示启动失败，不使用 Electron 充当内核。目录包将 Node 入口和运行依赖保留在 `app.asar.unpacked/node_modules`，引导适配转换到真实路径；LangGraph SDK 内自带的打包代码由 afterPack 保留。目录包不附带 Node 可执行程序。已打包桌面默认使用 Electron `userData` 配置目录，显式 `SCHOOLOOM_DATA_DIR` 仍优先。

Vite 启动时发现或启动受管调试内核；浏览器页面初次只查询，用户重试才允许重新启动。引导只接受本机同源请求，运行资料不写入 URL 或构建产物；静态文件与模块入口拒绝读取运行凭据。意外断线会有界重连并重新查询状态，认证或协议错误直接停止尝试。

开发调试内核由实际 Vite／electron-vite 宿主进程持有经认证的所有权，同一配置的多个调试宿主共享实例；页面刷新或 renderer 重载不回收内核，普通页面与业务连接也不延长其寿命。最后一个调试宿主退出或异常失联后，内核沿正常停机路径中止在途调用、保存并回收，调试配置、文献库和项目数据保留；启动后未完成所有权登记的实例在有界时间内自行退出。下一轮调试启动当前构建的新实例，内核代码不做热替换，需全部调试宿主结束后重新打开。独立 CLI 与普通产品实例继续默认驻留并在关窗后续跑；调试配置已被独立内核占用时，调试入口报告归属冲突并保留该实例，改用其他配置或先显式停止独立内核。

工作台不再提供“停止内核”入口；停机经 CLI（`pnpm kernel stop`）或内核 RPC 完成，调试内核仍随最后一个调试宿主退出回收。受理或连接关闭不代表退出，界面和 CLI 核对实际状态后才显示停止；不能确认时显示结果未知并提供查询。收到明确停机后客户端不会自动重启，用户可重试连接。真实来源的指令、材料选择与未保存文件草稿按配置／项目／会话或文件保存在本地，可跨停机、断线及刷新恢复；本地存储不可用时退回内存。

`pnpm dev:host` 启动隐藏宿主页面，供后续内部调试。宿主内部 DOM 用于兼容适配，不作为产品工作台。当前没有加载 Zotero 应用或插件。

格式和静态检查使用 Biome；`pnpm format` 会写回格式，`pnpm lint` 检查格式、lint 和 import 组织。生成目录及临时研究材料不纳入源码检查。

## 共享工作台与日常交互

中间区至右区底部共用状态栏，与左下内核状态区同高。执行状态常驻，归档恢复、待核查指令和全局错误从“工作台通知”打开详情；项目信任由独立状态入口打开居中确认弹窗。局部编辑、阅读和表单反馈保留原位。布局及交互以 [UI 设计](ui-design/README.md#全局状态栏) 为准。

组件通过 `workbench/StatusBarContext.tsx` 的 `useStatusBarItem(owner, item, activate?)` 贡献条目，hook 自动更新并在卸载时释放；`useStatusBar()` 提供实例服务。纯数据类型及 `createStatusBarService` 在 `workbench/statusbar.ts`，可供未来插件桥适配。每个 owner 内 id 唯一；同侧 priority 较大的项靠外排列，同优先级按 owner/id 排序。条目只声明文字、受控图标、提示、位置和语义，主题与布局由工作台统一处理。

```tsx
useStatusBarItem('reading', {
  id: 'progress',
  text: '第 3 / 20 页',
  alignment: 'right',
  priority: 10,
  ariaLabel: '阅读进度',
}, openReadingProgress);
```

非 React 接入使用 `registerItem(owner, item, activate?)` 返回的句柄更新、显隐及释放；`update` 第二参数为 `null` 时清除动作，省略则保留。停用整个贡献者时调用 `disposeOwner`；工作台实例销毁时服务终结。订阅快照只包含当前可见条目，禁止把研究事实存入注册表。

日常反馈和最终产品都在 `apps/desktop/src/renderer/src/workbench/Workbench.tsx` 上演进，共用 `styles.css`（语义 token + 浅色/深色双主题，默认跟随系统，左区标题行可手动切换）。工作台为三区骨架：左区（操作菜单、项目一级与会话二级导航树、内核状态）、中间区（tab 组 + Agent 面板）、右区（文件树、材料、任务）；左右区可折叠为图标轨（`Ctrl/Cmd+B`、`Ctrl/Cmd+Alt+B`）。Agent 面板固定在中间区：折叠态 dock 在底部（tool 消息固定顶部、最新 agent 消息截头留尾、精简 composer），点击展开为占满中间区的 overlay（完整消息流与 composer，Esc 收起）。tab 组支持激活、关闭与"向右拆分"按钮，文件、设置和题录库 tab 已接入真实内容，PDF 阅读器及共享阅读记录也已接入。外壳组件在 `workbench/shell/`，布局与视觉契约见 `docs/ui-design/`。`main.tsx` 只选择 session 来源。`workbench/session.ts` 定义界面输入：连接状态、材料及选择、可选的会话/文件树/任务数据、回调和 assistant-ui ExternalStoreAdapter；消息由来源提供，草稿由 assistant-ui Composer 管理，发送、消息呈现和重置都经过工作台的同一路径。真实来源经 `packages/client` 获取业务事实；领域 DTO 仍以 `packages/protocol` 的 schema 为准。

真实首页默认空 tab；连接不等于模型及授权就绪。设置 tab 集中模型、授权、备份与归档会话管理。左区顶部动作提供查找会话、添加项目、文献库与设置；查找会话打开跨最近项目的弹窗搜索，添加项目打开弹窗并以“打开／新建”两种模式完成，每个项目行在扩展菜单右侧提供新建所属会话按钮；菜单支持打开项目与从侧栏移除（经确认，不删目录、不停止执行）；会话、文件编辑、发送和取消复用共同客户端。开发态显式打开 `?scenario=ui-foundation` 才加载隔离样例；它仍只保留最新一轮，使用固定材料和回复，不读文件、不调模型、不持久化；生产构建忽略样例参数。

添加项目弹窗的目录选择按宿主分路：Electron 经窄 preload 桥 `pickDirectory` 调用主进程系统目录选择器（只启用打开／新建目录，取消返回 `null`）；浏览器宿主没有系统路径选择能力，使用内核 `project.browseDirectories` RPC 在弹窗内浏览目录——只列目录不列文件，realpath 后要求普通目录，排除符号链接、隐藏项与应用私有配置目录，按名称排序并受单页上限约束，返回真实路径。跨最近项目的会话查找走 `session.search`，由内核一次有界合并返回，UI 不做逐项目查询。

项目目录移动后经“打开项目”重新定位，宿主先协调原项目执行收尾，再关闭并重建 harness／research 仓储及私有目录绑定；会话、工具记录和成果身份随项目保留。无法排除旧执行写者时拒绝替换仓储，保留停止未知诊断。Windows 对打开中的 SQLite 文件有系统移动限制，移动前应关闭使用该项目的内核；Linux 的实跑不代表其他平台已验收。

## 本地文献库

工作台的“文献库”打开共同 library tab，题录库保存在配置的 `library/library.sqlite`，独立于研究项目。读取默认开启，写入与将库题录发送到模型分别授权；Agent 库工具还受当前会话外发授权约束，不提供修改授权、恢复或任意本机文件路径工具。库内写入采用 Drizzle 管理的独立表与迁移。

首个摄取格式为 CSL JSON（可粘贴或选择本机 JSON 文件），一次不超过256KiB/1000条，单条题录不超过16KiB且有非空 title，其余扩展字段保留。手动建项也走同一摄取入口。批次受理返回稳定身份，逐项保存创建、复用、冲突或失败；合法项可先查用。相同 batchId 不同输入拒绝，内核中断保留记录，显式继续只处理未执行项，不重放成功项；中断原因可查询。

规范化 DOI 与明确版本标签同时相同才自动复用条目，`unspecified` 和无 DOI 条目不自动合并。填补空字段时保留已有冲突及候选，预印本与正式版分别保存并可显式关联。题录更正核对修订号；集合支持父级与多重归属，标签和版本关系均沿同一接口保存。库查找、集合、历史及批次分页默认25、最多100条，题录列表还受512KiB响应预算约束；库变化只使相关投影重读。

本地材料通过文献库 tab 输入本机绝对路径批量摄取，每次最多100份，单文件最多128MiB。默认复制到库私有材料目录，也可显式只登记外链；原文件保留。可以添加到既有题录并标明用途，未选题录时按文件名建立待核对候选，不猜测 DOI 或发表版本。附件登记与实际可读分开：详情按页核对文件状态，原字节按引用分段读取，每段最多256KiB。

附件身份、材料版本与路径分开。同来源、用途和托管方式下相同内容可复用；外链移动后可以人工重新指定到同内容文件，内容不同则拒绝覆盖旧版本。材料读取核对记录内容，缓存仅用于同一文件身份、大小和时间戳均未变化的后续分段。外部编辑器不受应用锁约束，读取前后核对不能承诺阻止所有外部竞态。Agent 文件摄取只使用当前已授权项目内路径，批次保存项目归属，准备及提交前重新检查项目读取和库写入权限。

库提供手动和默认五分钟的可关闭自动备份，保留最近十份。新备份包含数据库快照引用的托管材料，清单列出未复制的外链依赖和缺失材料；旧备份仍标明仅题录数据库。恢复要求新的独立配置目录，可在副本核查来源、历史及原字节；副本使用新库身份、关闭写入/外发且不自动接续批次，当前库和备份后的成果保留。恢复配置可通过已有 `--data-dir` 入口独立检查。v1 题录库升级到 v2 前保存数据库副本，并撤销旧写入和外发授权；用户需重新确认扩大后的文件管理及材料外发能力。

附件详情的“阅读记录”只展开所选材料，用户可保存整份材料的文献笔记、更正说明、查看旧修订或移除记录；摘录与说明分别显示。列表和历史每页25条，草稿按配置、材料版本与记录保存；冲突保留说明，明确重读后核对再保存。创建回执未知时保留原身份及原提交输入，提供核查与按原输入重试，不因输入变化重复建项。材料失效时旧摘录仍可查，说明可更正，新建笔记需材料可读。笔记与历史保存在库 v3 数据库中，随现有备份恢复；v2升级前保存 `before-migration-v2.sqlite`，保留原库身份与授权。

共同客户端入口为 `library.status/grant/list/get/ingest/batch/batches/resume/update/collections/saveCollection/history/backup/backups/restore`、`library.importFiles/importProjectFiles/attachments/readAttachment/relocateAttachment`、`library.pdfInfo/readPdfPage` 及 `library.readingRecords/readingRecord/readingHistory/saveReadingRecord/removeReadingRecord`。Agent 使用同一入口对应的工具，创建者取实际会话身份；文件摄取只接受当前授权项目路径，不开放任意本机路径或重定位工具。

附件“打开 PDF”进入共享 reader tab，可翻页、缩放、搜索和选择文字；选区按页进入记录草稿，明确保存后才显示持久高亮，书签和独立笔记沿同一面板。内核无需窗口即可取文：每次一页，默认16Ki字符、最多32Ki，可按 nextOffset 续取。材料解析在受管操作系统进程执行，串行、最多8项等待、自受理起30秒；超时及停机确认退出后释放容量。解析调用及带位置保存等待35秒，普通笔记沿原请求时限。无文字层不做OCR，加密材料不提供密码流程，原文件不写回。SDK、字体与许可见[第三方资源说明](third-party/pdf-reading.md)。

EPUB 2／3 重排版与单文件 HTML 快照复用 reader tab 和共同记录。`library.documentInfo` 分页读取章节，`library.readDocumentSection` 返回规范化正文及安全节点（默认16Ki／最多32Ki UTF-16单元，`textOnly` 可只取正文），`library.searchDocument` 每次至多扫描16章节并返回覆盖及继续位置，`library.readDocumentResource` 只读取本版本章节引用的栅格图片。位置使用 normalizationVersion=1、sectionId、start/end，不跨版本自动定位。HTML 只使用内嵌图片，EPUB 只使用容器内图片；不执行原始 HTML、脚本、外部实体或原书样式，不读取网页配套目录。固定版式、DRM 和在线获取未接入。依赖及许可见[文档解析说明](third-party/document-reading.md)；科研分析沿 P4c。

## 基本单 Agent harness

### 工作台上下文接入

认证 WebSocket 连接各自拥有当前快照，`workbench.context.publish` 只更新本连接；旧 revision 忽略，清空和断线释放快照。普通 `application.call` 和 CLI 不带窗口来源，不能通过业务参数指定来源连接。`session.send` 已将可信来源保存为消息的可选 `source`；重试保留原来源，重启后的旧关联不可重新激活。

资源视图通过 `workbench/context-contributions.tsx` 的 `useContextContribution()` 贡献纯数据，生命周期沿视图释放。例如已有合法资源 `ref/basis` 的领域组件可调用 `contributeSelection(viewId, { selections: [item] })`，卸载时调用 `contributeSelection(viewId)`；`item` 使用 protocol 的 `ContextItem`，资源、文字、归一化区域和有结构对象共用 `isContextItems`／`isWorkbenchContextSnapshot` 容量校验。只贡献自己已加载的对象，不扫描其他视图或全库。普通选择只发布实时线索，明确按钮才调用 `appendContextItem(item)` 加入共同草稿，不自行发送指令。文本源码视图已接入，固定区域／对象提供者由组件测试验证；PDF／EPUB 精细选择仍沿后续阅读交互工作接入。

`WorkbenchSession` 的 `contextItems`、`appendContextItem`、`removeContextItem`、`updateContextComment` 供会话来源接入；dock／overlay 共用同一检查和批注入口。输入、材料、显式项和 pending 按工作台实例、配置、项目、会话保存；刷新沿窗口身份恢复，新窗口独立。旧草稿可明确复制到空目标，原值保留；迟到回执只移除原指令中未被继续修改的项。

Agent 的 `read_workbench_context` 工具按本次推进已注入的指令查询连接当前快照。两个窗口或窗口与 CLI 的指令同时参与时，返回 `ambiguous` 和当前 `instructionIds`，只接受明确指定且属于本推进的 ID；新推进不能引用旧推进的 ID。相同连接的多条指令共用当前快照，不自动选择最近窗口；无来源、断线、无快照及接收会话不匹配分别返回不可用原因。来源与显式项经模型前置 IPC 进入实际 worker 的结构化状态／checkpoint，持久来源不重建连接。

七域视图均复用这一贡献入口，以下是接入形状，不表示相应业务已经实现：

| 领域 | 选择／视图贡献 | Agent 取用与授权 |
| --- | --- | --- |
| 文献 | 当前已加载题录／附件对象，附可核对的资源证据；库列表 ID 本身不够 | 查询当前选择，再经所属库工具或 `read_context_resource` 读取，核对库 read/send |
| 项目 | 已登记文件及过程材料的 `ref/basis`，沿共同文件／资源 tab 打开 | 全局会话只读可信目标，保存成果使用所属项目执行 |
| 科研方法 | 节点材料及结果资源，Graph 等待仍由源码工厂声明 | `resume` 接收完整 InstructionContext；取材、创建及结果核查复用共同资源端口 |
| Agent | 委派输入只携带明确资源及原来源事实，不自报窗口身份 | 子执行沿所属身份和领域端口，当前快照不提供额外授权 |
| 科研计算 | 已生成日志／成果作为资源项；环境选择由所属模块提供 | 资源读取与受管程序准入各自核查，不从选区推导可执行程序 |
| 阅读交互 | 文字摘录保留 saved/draft 及原 basis；区域／对象使用规范化位置或明确 provider 语义 | 保存阅读记录走原领域，重新读取核对版本；精细命中和报告脚本另行接入 |
| Zotero 生态 | 只贡献已确认身份的题录、附件或导出结果，不猜 SQL／旧宿主对象映射 | 沿共同 broker 和所属授权；原包生产接线与生态身份映射另验 |

例如模型取得 `ambiguous` 后可查询 `read_workbench_context({ instructionId })`，其中身份必须来自本推进返回的引用；取得合法 `ref/basis` 后才调用 `read_context_resource({ ref, basis, encoding: 'utf8' })`。显式项保留用户原载荷，实际读取记录与它分开。完整组合入口为 `tests/kernel/workbench-integration.spec.ts` 和双宿主 `tests/ui/context-bridge.spec.ts`：前者使用真实认证连接、全局取材和固定图创建／结果查询，后者经现有 composer 附加库资源、发送后更换选择并刷新核对持久消息。生产 Graph 注册集合仍为空，样例及受控 HTTP 不代表科研业务已交付。

普通 Agent 的大型 beforeModel 更新按实际编码字节分帧，消息及结构化上下文逐项进入当前 worker，完整响应成功后才交给 SDK 保存及消费。分帧用当次 token 绑定，失败后释放临时输入；单 run 的 100 条上限、未消费项原回执和 2 MiB 帧上限保持。beforeModel 的 30 秒期限覆盖真实资源授权及完整传递，超时仍保留待核查输入，不提交半份更新。容量与传递中断回归见 `context-instructions.spec.ts`，正常保存／确认故障仍沿 `harness-recovery.spec.ts`。

服务端保存完整 `contextItems`，原身份重试比较全部载荷，字段顺序不影响相等性；同身份修改摘录、批注、引用或选择内容会被拒绝，重试不替换原来源。SDK 内容适配集中在 harness，明确区分用户草稿摘录、所附摘录与整份材料引用，不把附加当作已实际读取。已使用的资源引用随会话保存，在恢复、模型排队前后及最终准入时复查当前读取／外发权限。历史摘录保留原 basis，版本核对发生在实际重新读取时，不因资源更新而抹去历史或永久阻塞会话。

`KernelApplication.contextResources` 默认绑定已有 `executionResources(context)` 与资源所有者授权。受理前沿私有宿主标记核对接收会话、资源身份及读取／外发权限，只提供描述检查；活动执行才取得真实执行端口，不建立虚构 run，也不沿人工权限取材。`read_context_resource` 以明确的 `ref/basis` 复用共同资源读取，读取前后复查执行资格，取得的引用进入后续模型请求的授权检查。项目和库材料均已贯通；历史摘录与来源快照始终不构成授权凭证。

`selectedItems` 中的每个 ID 必须对应同一快照 `selections` 的 `itemId`，并逐项通过资源所有者检查。缺少可核对证据的裸 ID 仍报 `unavailable`，不猜对象或退回最近窗口。拒绝发送保留可编辑草稿，结果未知保留原 pending 身份。普通 Agent 的直接初始化仍拒绝非空 `instructions`，实际 Agent 指令沿模型前置端口注入；registered 图沿上文持久指令通道接入，三线最终组合验收继续沿本 change 的 4.5 推进。

项目资源的 `basis` 与目标只读使用同一包含 ctime 的读取版本，等长改写并恢复 mtime 仍使旧版本失效。底层 `files.readBytes` 保留原 `basis` 发布证据及跨移动读取契约，另以显式 `resourceBasis` 返回／核对强读取版本；资源适配器只用强版本，原产物回执保留证据种类。创建的首次读取版本保存在既有操作记录内，之后修改或删除材料不改变原创建回执，重新读取仍须核对版本及身份。

内核代码不会热替换。独立驻留实例在实现更新后需重启；调试内核需结束全部调试宿主，下一轮调试才加载新构建。工作台重连接回原实例。

在“模型设置”填写 MiniMax M Plan 中国区订阅 Key 即可；连接固定使用 `https://api.minimax.cn/anthropic`，不回退到其他接收方。当前模型目录由内核下发：`MiniMax-M3.1-Flash-Preview`、`MiniMax-M3`、`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`；出厂默认仍为 `MiniMax-M3.1-Flash-Preview` 与 `medium` 推理强度。设置页保存应用默认，composer 保存会话覆盖或“跟随默认”；只有 `MiniMax-M3.1-Flash-Preview` 发送 `output_config.effort`，可选 `low/medium/high/xhigh/max`。目录外选择直接拒绝，不静默回退；每次新执行钉入并记录实际模型配置。也可在启动独立内核前注入 `MINIMAX_CN_API_KEY`；保存的凭据优先。环境变化需要重启内核才会继承，当前请求保留原凭据。不要将 Key 写入项目或命令参数。

本机 `credentials/` 保存 AES-256-GCM 密文、独立主密钥与模型默认配置，POSIX 目录／文件权限为 0700／0600，Windows 使用当前用户 ACL。系统不回读 Key，不通过静态服务、项目工具或普通诊断暴露它。主密钥同机自动解锁，不能抵御同权限进程；凭据或默认配置损坏时保留现场，不自动覆盖。

普通会话可直接聊天。项目以 `Project.trust` 的 `pending | trusted | restricted` 状态统一控制 Agent 对项目材料的读取、写入和模型外发；只有 `trusted` 项目允许这些操作。受限项目仍允许人工浏览和编辑。新建或显式添加时先询问信任、受限添加或取消；旧项目首次进入提示一次，之后受限项目普通重开不重复询问。设置中可授信或撤销信任；撤销阻止后续 Agent 操作，不取消在途调用、不回滚已保存内容，也不自动重启。新建会话、附加文件引用后发送，Agent 实际使用材料与成果来自工具记录。流式输出、追加指令的受理／消费、取消与继续均使用内核持久状态。关窗不取消工作；重启将未完成工作标为中断，用户明确继续后才核查 checkpoint 和当前文件。checkpoint 不可用时保留原记录，以新尝试接续；旧指令可由分页工具发现。

普通会话归固定 `application` 工作域，`read_work_domain` 返回宿主确认的项目／会话身份。全局会话的普通项目文件接口仍拒绝读取和写入；临时资料使用本会话的 `/large_tool_results/`，实际目录由 `sessionScratch()` 隔离，不能访问其他会话或应用配置。临时资料缺失按 `context_incomplete` 诊断接续，不代表领域成果丢失，也不能用临时文件证明成果已交付。全局会话没有通用 Shell 或任意代码入口。

内部 `ProjectTargetReadPort` 的 `project.readTarget` 独立于可写文件端口和产品协议，经真实 broker 注册供 harness 消费。Agent 的 `read_target_project` 先用 `list` 分页发现已登记文件，再按 `fileId` 和 `basis` 调用 `describe`、`readText` 或 `readBytes`；列表每页最多100条，正文／字节每片最多256KiB，文件最多128MiB。该入口只读已登记且可信的目标，不登记身份、不写缓存、不关联成果，不返回本机路径。尚未登记身份返回 `unavailable`，文件缺失返回 `notFound`，依据变化返回 `contentChanged`，权限失败返回 `permissionDenied`，旧执行实例返回 `instanceMismatch`。工具消息保留这些结构化错误，原成果不回滚。

来源工作域与目标只读范围分别绑定；异步嵌套只能收紧，目标读权限不能用于保存、回收、传输或程序执行。每次实际取用和交付重新核验项目信任、身份、路径及当前运行实例；模型准入在排队前后重新核验会话已使用目标的授权，接续继续执行这些检查。无 harness 的人工组合仍沿原文件接口；缺少实例提供者时目标执行端口明确不可用。独立验证入口为 `tests/kernel/target-reader.spec.ts`、`work-domains.spec.ts`，原项目保存、scratch 和会话回归沿既有内核测试。

工作台与 CLI 通过 `session.send` 推进，没有独立“继续”入口；旧公开恢复操作已删除。内部兼容接续及新一轮上下文导入使用上文私有 checkpoint 路径。运行记录由 harness 仓储维护；同步保存后经 IPC 幂等确认消费，保存失败、确认提交失败及确认回执丢失已有真实磁盘／子进程验证。完整领域迁包、执行桥协议收口和整合恢复范围以当前 change 的 tasks／delivery 为准。

新会话以首条受理指令生成短标题，可在会话行右键菜单重命名。左侧同时驻留最近项目与 application 会话，项目为一级、会话为二级；项目行只展开或折叠，会话列表按项目分别滚动加载。项目行的加号创建所属会话，菜单仅提供打开项目和确认从侧栏移除；顶部、折叠轨与空态不提供全局新建。名称始终取目录末级名，文件系统改名后重新添加仍保留项目身份及记录。选择会话同时切换所属项目。查找会话经顶部弹窗跨最近项目搜索，归档会话在设置页集中查看与恢复；筛选不切换接收者，当前会话独立读取。排队、运行或取消中的会话需等停止后归档；归档保留历史、成果、指令与草稿，禁止发送、继续及修改模型覆盖，恢复不自动执行。会话变化跨客户端更新列表，连续正文输出只刷新当前消息。文件 tab 按项目切换并恢复各自状态；共同文献库、设置与材料阅读器跨项目保留。

展开会话可阅读 Markdown、代码、表格和公式，复制原始正文或代码；状态和材料引用单独呈现。材料按已记录的稳定文件身份打开，历史无身份记录标明按历史路径打开；相对链接以项目根为基准，复用文件 tab 并保留草稿。消息图片不自动加载，外链只在明确点击后打开，HTML 不执行。消息及文件预览共用有界 Worker 调度，消息只解析可见正文。

输入器显示当前项目、模型、推理强度与项目信任状态。dock 显示最新工具真实状态；展开会话后，可展开每条工具记录查看输入、结果和截断提示，预览各最多 16,384 个 UTF-16 单元。工具失败与图是否结束分别显示；取消或重启遗留调用标为结果未知，不表示已有效果撤销。成果打开入口按执行标识归入结果消息，复用文件 tab，收起会话浮层并保留指令草稿；保存／登记通知及核查补齐动作位于状态栏详情。正文消息记录可选 runId，历史工具沿 tool.runId 关联；只投影已加载消息，缺少明确关联时不挂到其他回复。旧工具记录保留历史说明，不补造输入和结果。

项目的 `.scholoom/` 保存稳定身份、SQLite 事实、执行 checkpoint、有限文件历史及备份；正文以实际文件为准，目录移动后仍可打开。文件和目录的创建、重命名、回收与恢复经同一接口，稳定 fileId 跟随结构变化，历史路径保留；回收载荷保存在项目私有目录，恢复默认原路径，也允许另选路径，不覆盖已有内容；人工操作不依赖项目信任，Agent 结构操作要求 `trusted`。项目容器升到 v4 前保存 `before-migration-v4.sqlite`，旧项目转为 `pending` 并保留 `autoBackup`；恢复副本也为 `pending`。文件接口支持 UTF-8 文本，整份编辑上限 256 KiB；按文件串行核对整份读取依据，变化后重读，不自动合并。新建不覆盖已有文件，撤销保护后续内容。内部目录、凭据文件、越界路径和外部符号链接不在普通文件操作范围内。

文件 tab 使用 CodeMirror 6，提供保存、差异、重新读取及历史撤销；Markdown 的源码、预览与并排视图共享同一草稿，预览由 Worker 按 unified + GFM + KaTeX 渲染，不执行原始 HTML。项目内 PNG／JPEG／GIF／WebP 图片在 1 MiB 上限内按需读取，远程图片不自动请求；相对链接走文件入口，http(s)／mailto 链接仅在用户点击后打开（Electron 经窄宿主桥）。会话草稿、材料选择和文件草稿按数据配置与对象保存在本地浏览器存储；浏览器存储不可用时仅保留本次页面的内存草稿。重新读取保留未保存内容，用户核对差异后再保存。恢复副本中的内容可打开、复制，并通过普通编辑和保存取回到当前项目。

备份默认五分钟检查内部与外部文件变化，保留最近十份，可关闭或手动触发；`autoBackup` 独立于项目信任并在容器迁移时保留。备份包含数据库副本、不超过 256 KiB 的文本、不超过 1 MiB 的光栅图片，以及项目私有回收目录中的载荷；不包含外部链接、其他二进制、超限文件或 checkpoint，缺项记录在私有清单中。回收载荷不完整时，恢复该回收项被拒绝并指向缺项清单，不报告完整恢复。文件与数据库不承诺全局瞬时一致。恢复目标必须是新的独立目录，保留当前项目；副本使用独立身份并处于 `pending`，需重新决定信任。

CLI 使用同一接口，例如：

```sh
pnpm kernel project-open --path /path/to/project
pnpm kernel project-grant --project PROJECT_ID --trust
pnpm kernel session-create --project PROJECT_ID
pnpm kernel send --project PROJECT_ID --session SESSION_ID --text '读取材料并保存分析'
pnpm kernel session --project PROJECT_ID --session SESSION_ID
pnpm kernel cancel --project PROJECT_ID --session SESSION_ID
```

请求受理立即返回指令／执行引用；回执丢失时保留原 `--instruction-id` 查询或补交。工作台刷新后会核对持久的待确认输入，未能确认时提供“按原身份补交”，保留当前草稿。缺失用量为未知；请求默认 180 秒、模型并发 1，安全临时失败最多额外两次重试，不重放已输出的流或未知副作用。取消只确认本地调度与工具停止，不代表远端已停止计费。当前执行默认最多 32 次模型请求，触限保留成果并等待继续。

内置科研方法通过 `discover_research_methods` 发现摘要、`load_research_method` 按身份与版本读取正文。普通方法可直接使用；明确能力工具 `invoke_research_capability` 自动核对输入和项目 `trusted` 状态，复用同一模型额度与安全文件工具。首项 `scholoom.material-analysis`（`1.0.0`）接受 `materialPaths`（1–10 个项目文本）、`outputPath` 和 `goal`，例如要求“按材料分析方法读取 input.md，分析结果依据与限制并保存 analysis.md”。无需先创建研究任务。

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

`pnpm test:ui` 使用 `playwright.ui.config.ts`，同一场景分别驱动 Chromium 和真实 Electron。它覆盖真实连接、内核连接重连、草稿保护、停机与重试、崩溃后用户重试及既有样例行为；浏览器引导和静态凭据访问检查执行一次。`tests/ui/renderer-url.ts` 统一读取 `SCHOOLOOM_UI_PORT`（缺省 5174），供 webServer、baseURL、Electron renderer 和所有导航使用；端口占用即失败，不复用其他实例。并行运行分别指定不同端口，例如 5174 与 5175；输出位于各自的 `test-results/ui-<port>`，配置默认逐轮新建于 `test-results/ui-profile-*`。显式指定 `SCHOOLOOM_UI_DATA_DIR` 时，每轮须使用不同目录；项目、文献库和输出夹具也须按测试实例隔离。结束时关闭本轮应用与服务并确认内核退出，无法确认退出时保留配置供诊断。

`tests/smoke/development.spec.ts` 的 `two renderer instances` 场景复用上述端口来源，从指定端口及下一端口启动两个真实 Vite／内核实例；分别经 UI 创建项目和保存成果，以真实库 API 准备独立材料。它核对不同内核身份和地址、项目及库内容不串用，关闭一个实例后另一个仍可刷新并再次保存。该场景用两个独立浏览器上下文模拟并行开发实例；Electron／preload 的验证仍沿 UI 双宿主及入口 smoke，不操作另一个工作树。

UI 测试期间保持源码和共享包构建产物稳定；改动或重新构建会触发 Vite 热刷新，重置正在验收的组件状态。完成构建后再运行交互测试。

真实开发命令及模型 UI 验收位于 `tests/smoke/development.spec.ts`：普通场景使用浏览器5315／Electron CDP 9315，live 场景使用5316／9316，Electron renderer 使用本轮服务的实际 URL。显式运行 `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:smoke tests/smoke/development.spec.ts --grep 'live MiniMax' --output test-results/development-live`；Key 仅经环境注入，不录 trace，保存合成成果作为验收附件。Linux 命令自动化使用 electron-vite 的 `NO_SANDBOX=1` 环境选项，与既有 Playwright Electron 启动设置一致；产品默认 sandbox 设置不变，本机通过不代表目标平台 OS sandbox 或分发包已验收。

无图形会话的 Linux 需要 Xvfb 和 Electron 所需动态库，使用 `xvfb-run -a pnpm check`。Smoke 检验工程入口，UI 测试检验共同界面行为；业务契约、科研效果、原生能力和插件支持仍须相应真实场景验收。

`pnpm package:dir` 构建并分别生成两个 Electron 目录包，输出到 `release/desktop` 和 `release/zotero-host`。桌面包包含内核、执行桥、原生依赖与 PDF WASM，仍要求本机 Node 24；不生成签名安装器或尚未实现的科研执行工具。`SCHOOLOOM_PACKAGED_DESKTOP=<实际桌面可执行文件>` 可让既有入口 smoke 启动该分发包；`SCHOOLOOM_PACKAGED_KERNEL=<解包的 @scholoom/kernel 目录> pnpm test:kernel tests/kernel/cli-runtime.spec.ts` 验证包内实际图、工具、持久化及 PDF 解析。本机目录包通过不替代目标平台签名、安装后及恢复验收。

GitHub Actions 使用 Linux、Windows、macOS 矩阵运行同一检查与目录打包；远端结果以实际 workflow 运行为准。本机 Linux 通过不表示三平台已验收。

## 实施约定

新功能依项目默认 `scholoom-dev` schema 留下调查、契约、设计、任务和实际交付记录。结构调整以代码和真实运行结果为准，规格与决策解释保持一致。

拆分任务、安排整合和判断完成时，遵循[按实际使用路径开发与交付](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#按实际使用路径开发与交付)；原型、基础设施和可用功能按各自目标记录实际验证结果。

模块交付的诊断入口与早期交互反馈沿[开发操作与 UI 调试](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#开发操作与-ui-调试)及[人机分工](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#人机分工与协作)；测试预期沿[独立验证依据](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#e2e-与必要检查)。

设计模块、复用旧实现或重构前，按[架构优先的复用与必要重构](../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#架构优先的复用与必要重构)评估，并读取相邻的测试 oracle／TDD 与 deep module 约定。

assistant-ui 已用于工作台的消息和 Composer；数据库、LangGraph harness、代码编辑与 Markdown 预览已随项目文件工作台接入。内置材料分析沿共同能力模块执行；受管执行和插件在对应功能接入时安装并验证。范围明确后建立模块，避免提前加入空目录和假实现。
