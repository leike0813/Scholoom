# 实际交付与交接

## 当前状态与成果

2026-10-23，用户要求当前 dev 收回三个工作树的 PR。PR #2 的四个提交（2f15047、2d6c721、c994fe7、f27a16a）以 0e5e167 合入；三个 PR 的组合源码基线为 efc9429。通用 driver 的真实接线和回归已接入 dev，2.2 完成，tasks 为 6/19。资源、持久等待和完整整合仍未完成，不能归档。

工作域真实授权也已随 PR #1 接入同一 dev，本变更 1.2、1.4、2.4、3.3 的工作域前置现已满足；统一执行资源适配和业务图接线仍需本线实现。工作台线已交付连接／草稿增量，但未接通显式项执行。依赖和共享文件归属继续沿[公共规划](../../../.scratch/domain-development/public-foundation-plan.md)。本轮未同步其他工作树或操作其 Agent，用户将手动同步。

以下保留 2026-10-22 在 fe2f0bc 上独立实现的证据及当时边界。原用户已授权本线实施、提交、推送和 PR；本轮授权接收、修复冲突、验证及更新 dev。

| 任务与入口 | 本次实际成果及边界 |
| --- | --- |
| 2.1，harness/graph-registry.ts、kernel/execution-graphs.ts | `ExecutionGraphs` 将源码定义、版本、配置 schema 与工厂放在同一登记中；宿主与 worker 引用同一集合。未知图、错误版本和非法配置在构造前失败，非法入口字段由同源 IPC schema 拒绝。生产集合为空，固定样例仅在测试宿主装配。 |
| 2.2，harness/execution-driver.ts、execution.ts、remote-agent.ts、runtime.ts、kernel/execution-worker.ts | 提取可静态装配工厂的 `startExecutionWorker`；旧入口保持薄调用，完整宿主为根和能力子执行注入受控 worker URL。默认模型、工具、checkpoint、健康、停止、准入与退出回执继续沿原机制。图结果校验同源结构及 attemptId，停止后拒绝继续推进。2026-10-23 已接入 dev，并通过合并后普通会话、子执行、恢复及 IPC 回归。 |
| 2.5 | 原普通会话、材料分析、工具效果、实例失效、容量不足、压缩和恢复通过实际 worker 回归。同步修正旧故障夹具对执行入口的匹配。 |
| 3.1／3.2／3.3，kernel/commands.ts、manual.ts | `ManagedCommands` 统一私有工作空间、程序登记、消费模块校验、排队重验、取消及进程释放；editorCommand 为薄适配，人工排版继续独立于 harness。范围检查拒绝全局／目标只读及不一致执行身份；前序真实工作域增量已进入 dev，本线仍须接入并验证命令的有效实例授权。3.2 完成，3.1／3.3 保留真实接线验收。 |
| 4.1，playwright.ui.config.ts、tests/ui/renderer-url.ts、fixture.ts 及 17 个 spec | `SCHOOLOOM_UI_PORT` 统一 renderer URL，缺省 5174；所有导航与权限 origin、baseURL、webServer、Electron 共用。端口占用失败，不复用其他实例；输出按端口隔离，profile 仍逐轮新建。2026-10-23 源码已接入 dev，仍未实跑双实例。 |
| 4.2，tests/fixtures/domain-execution-worker、docs/development.md | 固定两节点 StateGraph 验证真实 SDK／IPC、无模型完成和注册拒绝；固定 Node 程序验证实际输出和进程树收尾。新增七域独立接入说明，复用现有测试组合。材料读取、首次创建和等待夹具仍未完成。 |

`GraphDriver` 是源码装配 seam，SDK 对象留在 worker。当前固定计数图的宿主只接收节点回报，没有取用业务材料或保存科研成果；固定命令的工作空间和授权回调为明确测试提供者。harness 仍拒绝未接通的 registered 持久尝试、resume 和结构化上下文，不将其静默转成默认 Agent。

[design 总览图](design.md#变更总览)仍是完整目标：本轮接通 driver／工厂装配和共同命令机制，资源、首次创建及等待恢复边仍待实现。项目／库事实、创建收据、材料读取和科研交付没有新增第二份权威。

## 实际验证

环境为 Linux、Node v24.12.0、pnpm 11.10.0，模型响应为受控 HTTP 夹具，无真实模型调用。测试使用隔离配置、项目、库与输出，收尾仅处理本轮拥有的进程。未启动开发服务器。

环境操作有两项偏离授权边界：首次 `pnpm build:shared` 在执行脚本前自动安装了工作树缺失的锁定依赖；随后查询 Electron 路径时，入口模块自动下载了运行时。两项均未提前取得安装授权，已向用户说明。依赖声明和锁文件未变；后续构建、类型与测试直接调用现有工具，未运行 setup 安装脚本，也未擅自删除已安装内容。

| 实际入口 | 结果与范围 |
| --- | --- |
| `pnpm build:shared` | 共享构建通过；包含上述意外依赖安装。 |
| 按依赖顺序直接执行 13 个主 workspace 包原有 `build` scripts | 全部通过，包含桌面与兼容宿主生产构建；等价覆盖根构建的实际包脚本，未再次调用 pnpm 安装入口。保留既有兼容宿主缺少 preload 配置提示。 |
| 直接执行各包原有 `typecheck` scripts；`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 全部通过，含实际调用方和类型反例。 |
| `node scripts/check-architecture.ts` | 13 模块、191 源文件，0 findings、0 exceptions。原生适配声明随 async_hooks 移至 execution-driver.ts。 |
| `node packages/protocol/scripts/contract-types.mjs --patch` | 运行成功，仅输出已有格式差异；本轮未修改协议操作，未引入无关生成文件改动。 |
| `node packages/protocol/scripts/contract-types.mjs --self-test` | 通过。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts` 加下表文件 | 72 个不同用例最终通过；重复定向复验不计入该数。 |
| `node node_modules/@playwright/test/cli.js test tests/smoke/entrypoints.spec.ts` | 4/4，36.6 秒；独立 Node、真实 Electron/preload、窗口重连和兼容宿主。 |
| UI config `--list`；直接导入 renderer-url 的 assert 自检 | 默认及 5275 配置各加载 104 个测试，另检查默认、5175、65535 及空串、0、超界、非数字、小数端口。未启动服务或执行 UI。 |
| `node node_modules/@biomejs/biome/bin/biome check` 本轮 42 个源码／测试文件；`git diff --check`；OpenSpec strict | 通过。 |

内核定向用例均位于 `tests/kernel/`：

| 文件组 | 不重复用例数及证据 |
| --- | --- |
| managed-commands、editor-runtime、process-admission | 13；实际 Node、输出边界、排队撤权／重绑定、取消及后代停止、控制丢失保留占用，既有缓存和最后成功预览 |
| editor、platform-processes | 9；真实 Quarto/Pandoc HTML／PDF／DOCX、多文件 LaTeX、冲突保护、实际进程和宿主 SIGKILL |
| public-contract-baseline、resource-access | 8；历史 DTO、未接线保护、原资源身份／版本／条件保存及真实 PDF／EPUB／HTML 解析 |
| graph-registration、execution-isolation、harness-module、research-module | 11；宿主／实际 worker 的注册拒绝、两节点 StateGraph 无模型完成、工具效果未知及模块独立组合 |
| capability-isolation、capability-stop-unknown、harness-recovery、sessions | 24；能力崩溃、停止未知、checkpoint 保存／确认失败、真实压缩、重启、scratch 隔离与会话配置 |
| execution-capacity、cancel-admission | 7；父子容量、等待撤回、PDF 准入、控制失联和异步撤权 |

共同契约基线的既有证据继续保留：此前 `pnpm generate:contracts` 的输出按 Biome 格式化核对并用 apply_patch 接入，`pnpm check:architecture` 为 13 模块／186 源文件零问题，`pnpm typecheck`、`pnpm build`、33 项定向内核和 4 项入口冒烟通过。该轮只交付 0.1／1.1，同源声明包括 ResourceEvidence、创建／查询结果、Graph 绑定／resume 和内部命令；不会据此前契约通过宣称本轮缺失的真实提供者可用。

## 审查与问题处理

2026-10-23 dev 接收时，保留工作域真实端口并处理 Harness 构造参数冲突；合并后的构造参数、根／子执行及连接路径经独立源码复核，无新增阻塞发现。全仓类型、构建、架构、137 项组合内核和 4 项真实入口冒烟通过，具体命令及证据统一见[工作域交付记录的 dev 接收验证](../archive/2026-10-23-establish-scoped-execution-foundation/delivery.md#dev-接收验证)。UI 端口配置在默认及 5275 各加载 104 项，仍未实跑双实例；4.1 保持未勾选。21 项既有文献库 UI lint 错误仍在，不以本地定向通过宣称全仓 CI 通过。

独立 Agent 只读核对命令权限、等待重验、停止确认与 URL 隔离，未发现阻塞问题；随后审查 driver／registry 和默认入口，报告三处旧 worker 路径导致故障注入失效。主线已同步 capability-isolation、capability-stop-unknown 和 harness-recovery，24 项相关回归通过，独立复核关闭该 finding。本轮没有未关闭 finding；审查不覆盖尚未实施的资源授权和持久恢复。

主线将命令等待前的目录、项目及程序保存为原始值，避免持有可变工作空间对象而漏检重绑定，并补行为回归。图初始化在校验后、调用工厂前锁定，避免构造失败后重试导致重复效果；推进结果须属于原尝试。架构守卫发现的 async_hooks 位置变更已修正，无新增例外。

新增非法入口负例曾因测试直接调用 RpcPeer.request 缺少第三个等待参数而失败，修正测试调用后定向复验及 tools 类型检查通过；没有以该失败修改生产 RPC 语义。既有共同契约审查发现的模型可选字段、未知创建依据和 UTF-16／UTF-8 边界修正仍沿基线保留。

## 未完成事项与下一步

1. 同步本轮 dev 后优先完成 1.2 的真实 ExecutionResourcePort：复用目标只读及领域授权，不依赖资源视图。将该资源增量独立提交并向 dev 发 PR，供工作台 2.2、3.2 的真实路径验证；无需等待全部图／命令完成。
2. 本轮随后推进 1.3、1.4 的保存与关联分别结果、首次创建 operationId 及候选／发布核查；保护已接入的 store/files 只读及条件保存临界区。覆盖已保存但关联失败、同路径替换、回执丢失和重启后仅补关联，不能预建输出避开新建路径。
3. 后续沿 GraphDriver seam 实施 2.3 的持久图绑定、真实 interrupt／waitId、输入 schema 与新指令消费、版本不兼容及 checkpoint 后确认，再接通 2.4、3.1／3.3 的真实资源和执行资格。当前计数图仍不替代真实材料及成果交付。
4. 2.2 已完成 dev 接入；4.1 的 URL／fixture 源码也已接入，消费者可同步后使用，实际双实例隔离验收仍未完成。下一批优先资源提供者，不与工作台线重复修改来源、显式项和共同 composer。
5. 双宿主共同资源／写作 UI 和双实例并发尚未运行。现有 UI webServer 执行 dev:browser，受当前 AGENTS 的“禁止启动开发服务器”限制；实际运行前须取得该项授权。目标只读零写入已在本轮 dev 组合回归核对；本线资源适配、真实模型、科研充分性和三平台分发仍未验，Mermaid 未渲染。
6. 续做读取本记录和 tasks，再运行 `openspec instructions apply --change establish-domain-execution-handoffs --json`。CLI ready 仍只是依赖工件就绪；4.3／4.4／4.5／4.6 等整体验收和最终交付项保持未完成，按实际结果继续更新同一记录。
