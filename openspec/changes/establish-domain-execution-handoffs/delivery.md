# 实际交付与交接

## 当前状态与成果

2026-10-22，用户以“实现 openspec/changes/establish-domain-execution-handoffs”授权本工作树实施。当前是中途交付，tasks 为 5/19：基线 0.1、1.1，以及本次完成的 2.1、2.5、3.2。主体资源、持久等待和完整整合仍未完成，不能归档。

本工作树与本轮核对时的 dev 均基于 `fe2f0bc`。工作域变更只有 1.1 的共同声明完成；1.2、1.3、2.1、2.2 未交付，当前不存在真实 `project.readTarget` 提供者，也没有可信工作域与目标只读的实际传递。依赖及共享文件归属继续沿[公共规划](../../../.scratch/domain-development/public-foundation-plan.md)。用户随后要求“向 dev 分支发 PR”，授权本分支提交、推送及发布 PR；尚未合入 dev，未修改其他工作树或切换分支。

| 任务与入口 | 本次实际成果及边界 |
| --- | --- |
| 2.1，harness/graph-registry.ts、kernel/execution-graphs.ts | `ExecutionGraphs` 将源码定义、版本、配置 schema 与工厂放在同一登记中；宿主与 worker 引用同一集合。未知图、错误版本和非法配置在构造前失败，非法入口字段由同源 IPC schema 拒绝。生产集合为空，固定样例仅在测试宿主装配。 |
| 2.2，harness/execution-driver.ts、execution.ts、remote-agent.ts、runtime.ts、kernel/execution-worker.ts | 提取可静态装配工厂的 `startExecutionWorker`；旧入口保持薄调用，完整宿主为根和能力子执行注入受控 worker URL。默认模型、工具、checkpoint、健康、停止、准入与退出回执继续沿原机制。图结果校验同源结构及 attemptId，停止后拒绝继续推进。本项源码和回归已准备，尚未独立接入 dev，任务保留未勾选。 |
| 2.5 | 原普通会话、材料分析、工具效果、实例失效、容量不足、压缩和恢复通过实际 worker 回归。同步修正旧故障夹具对执行入口的匹配。 |
| 3.1／3.2／3.3，kernel/commands.ts、manual.ts | `ManagedCommands` 统一私有工作空间、程序登记、消费模块校验、排队重验、取消及进程释放；editorCommand 为薄适配，人工排版继续独立于 harness。范围检查拒绝全局／目标只读及不一致执行身份；真实工作域和实例授权路径仍依赖前序增量。3.2 完成，3.1／3.3 保留真实接线验收。 |
| 4.1，playwright.ui.config.ts、tests/ui/renderer-url.ts、fixture.ts 及 17 个 spec | `SCHOOLOOM_UI_PORT` 统一 renderer URL，缺省 5174；所有导航与权限 origin、baseURL、webServer、Electron 共用。端口占用失败，不复用其他实例；输出按端口隔离，profile 仍逐轮新建。尚未实跑双实例及接入 dev。 |
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

独立 Agent 只读核对命令权限、等待重验、停止确认与 URL 隔离，未发现阻塞问题；随后审查 driver／registry 和默认入口，报告三处旧 worker 路径导致故障注入失效。主线已同步 capability-isolation、capability-stop-unknown 和 harness-recovery，24 项相关回归通过，独立复核关闭该 finding。本轮没有未关闭 finding；审查不覆盖尚未实施的资源授权和持久恢复。

主线将命令等待前的目录、项目及程序保存为原始值，避免持有可变工作空间对象而漏检重绑定，并补行为回归。图初始化在校验后、调用工厂前锁定，避免构造失败后重试导致重复效果；推进结果须属于原尝试。架构守卫发现的 async_hooks 位置变更已修正，无新增例外。

新增非法入口负例曾因测试直接调用 RpcPeer.request 缺少第三个等待参数而失败，修正测试调用后定向复验及 tools 类型检查通过；没有以该失败修改生产 RPC 语义。既有共同契约审查发现的模型可选字段、未知创建依据和 UTF-16／UTF-8 边界修正仍沿基线保留。

## 未完成事项与下一步

1. 先取得工作域 1.2／1.3／2.1／2.2 对应已验证增量。任务 1.2、2.4、3.3 的真实授权路径待其接入；1.4 的 store/files 改动在同步工作域 1.2 后实施，保护既有保存临界区。
2. 沿 GraphDriver seam 实施 2.3 的持久图绑定、真实 interrupt／waitId、输入 schema 与新指令消费、版本不兼容及 checkpoint 后确认。随后将当前注册检查与受控工厂接入真实尝试，保留资源证据和已保存文件。
3. 完成资源保存／关联分别结果、首次创建 operationId 及候选／发布核查；用固定图从不存在的路径读写真实材料，覆盖取消、关联失败和失联。计数图不是这一完成判据的替代。
4. 2.2 与 4.1 的源码增量及回归按用户要求随 PR 送审，worker、共同命令和 UI 隔离分别提交，便于独立同步；实际 dev 接入及消费者复验仍待合并后完成，相关任务保持未勾选。
5. 双宿主共同资源／写作 UI 和双实例并发尚未运行。现有 UI webServer 执行 dev:browser，受当前 AGENTS 的“禁止启动开发服务器”限制；实际运行前须取得该项授权。真实模型、科研充分性、目标只读零写入和三平台分发未验；Mermaid 未渲染。
6. 续做读取本记录和 tasks，再运行 `openspec instructions apply --change establish-domain-execution-handoffs --json`。CLI ready 仍只是依赖工件就绪；4.3／4.4／4.5／4.6 等整体验收和最终交付项保持未完成，按实际结果继续更新同一记录。
