# 实际交付与交接

## 当前状态与成果

2026-10-23，用户要求在当前 dev 收回三个工作树的 PR 并准备下一阶段交接。PR #1（b210eec）已以 a2cd773 接入 dev；随后接入 PR #2、#3，组合源码基线为 efc9429。本变更实际授权、独立审查、接入回归及交付记录完成，tasks 为 11/11，尚未同步正式规格或归档。其他两项公共基础变更仍在实施，不能据此启动七域或宣称公共基础整体验收完成。

以下保留 2026-10-22 工作树内的实现与验证证据；本轮 dev 接收证据及边界见下文。原用户已授权实施本变更并向 dev 提交 PR，本轮授权覆盖接收、冲突修复、验证及更新 dev；另外三个工作树由用户手动同步，未操作其 Agent。

原 1.1 共同契约保持不变，本轮没有新增数据库迁移、产品协议或依赖声明。设计中的 broker → 目标只读提供者 → 文件链路现已真实接通，未替换内部项目、broker、仓储或受管执行。实际改动如下：

| 位置 | 成果 |
| --- | --- |
| packages/projects/src/readonly-access.ts、store.ts、files.ts、node.ts | 独立目标读取、只读异步范围、原来源保留和嵌套收紧。只使用既有登记身份，列表分页、描述、文本及字节分片均核对路径、内容依据、信任与交付资格；不登记身份、不写目标缓存或保存依据。身份登记写入增加领域写权限核对。 |
| apps/kernel/src/manual.ts、application.ts、architecture.json | 经同源内部契约注册真实提供者及 harness 消费范围。宿主绑定工作域、目标范围与当前执行，提供同步最终授权检查；人工组合不加载 harness，实例能力缺失明确不可用。 |
| packages/harness/src/runtime.ts、packages/broker/src/index.ts | 暴露 read_work_domain／read_target_project，冻结可信字段，复用既有 scratch。统一核验当前尝试、宿主及父子实例，取消和旧实例不能交付。会话已用目标身份保存在来源 harness 中，接续时再次授权。 |
| packages/models/src/model-access.ts | 异步授权及模型排队结束后，同步复核来源与全部目标，再发放租约；拒绝释放名额。可选最终确认函数不要求原调用方修改。 |
| tests/kernel/target-reader.spec.ts、target-races.spec.ts、work-domains.spec.ts；既有 broker／项目后端／模型测试；tests/model-server.ts | 新测试使用真实文件、仓储、broker 和运行会话，仅在外部模型 HTTP 边界注入受控工具计划。复用现有模型夹具，默认计划保持原行为。 |
| docs/development.md、design.md、proposal.md | 更新实际工作域、独立端口、错误诊断及模型准入竞态修复；记录当前授权。初设 execution／research 已核对，尚未交付的领域流程与成果保存不在此变更中宣称完成。 |

完成判据在本工作树均有运行证据：全局会话读取可信目标而不迁移归属；受限目标、未知身份和普通文件写入被拒绝；目标文件及领域记录读取前后保持一致；双会话同名 scratch 各自保留自己的字节；取消、撤权、内容变化及旧实例迟到均拒绝交付；原项目条件保存、人工组合、application 创建与 scratch 缺失接续通过。

## 实际验证

环境：Linux、Node v24.12.0、pnpm 11.10.0。隔离配置、库、目标项目及会话位于本轮临时目录；模型仅使用回环 HTTP 受控响应与合成凭据，无真实模型、真实密钥或用户材料。测试退出关闭本轮 app、模型夹具及所属执行，清理自己的临时数据。

| 命令／核对 | 实际结果 |
| --- | --- |
| pnpm generate:contracts；生成器 --self-test；目标映射经 Biome 格式化后与 schema 生成结果比较 | 通过。命令输出只有既有生成文件的格式差异，没有协议声明变化，未扩散修改。 |
| pnpm check:architecture | 13 模块、187 源文件，0 findings、0 exceptions。 |
| pnpm typecheck | 全仓通过，包含共享包构建、各包及工具／测试类型检查；最终新增测试另经 tsc --noEmit -p tsconfig.tools.json 通过。 |
| pnpm build | 全仓通过，包含 kernel、harness、共享包及 Electron 双宿主构建；后续受影响共享包重新构建通过。构建不表示运行双宿主 UI。 |
| 下列相关内核测试命令 | 57/57 通过，约 1.2 分钟。 |
| pnpm test:kernel tests/kernel/harness-recovery.spec.ts --grep 'scratch content remains usable across attempts and restart' --output test-results/scoped-recovery | 1/1 通过，24.4 秒，覆盖 scratch 跨尝试、重启、隔离及缺失接续。 |
| pnpm test:kernel tests/kernel/target-reader.spec.ts tests/kernel/target-races.spec.ts --output test-results/scoped-final | 最后补齐文件句柄关闭后的领域授权检查后，受影响 7/7 再次通过，21.9 秒。 |
| 本轮修改的 TypeScript／JSON 文件 Biome 检查；git diff --check；openspec validate establish-scoped-execution-foundation --strict | 通过。 |
| pnpm lint | 未通过：21 个既有前端错误，集中在 library 组件的可访问性及格式等；本轮未修改这些文件，已抽查 HEAD 原文件确认问题已存在。本轮文件检查通过。 |

相关内核测试命令：

```sh
pnpm test:kernel tests/kernel/work-domains.spec.ts tests/kernel/target-races.spec.ts tests/kernel/target-reader.spec.ts tests/kernel/work-domain-contracts.spec.ts tests/kernel/project-backend.spec.ts tests/kernel/checkpoint-files.spec.ts tests/kernel/harness-module.spec.ts tests/kernel/sessions.spec.ts tests/kernel/model-access.spec.ts tests/kernel/broker.spec.ts tests/kernel/manual-application.spec.ts
```

目标只读独立测试比较目标目录条目、普通文件字节及 SQLite 序列化记录；实际 Agent 会话测试比较可信／受限两个目标的文件和全部逻辑表，证明没有此次读取造成的登记或持久修改。四项竞态用真实运行中的 application 会话，在文件协调等待／路径读取处设置确定性闸门，分别撤权、变更内容或取消；不是替换授权提供者。模型排队测试验证最终授权拒绝后名额可继续使用。成功读取后的新消息在目标撤权时没有新增模型 HTTP 请求。

首次 pnpm exec 在缺少 node_modules 的新工作树中自动准备了锁定依赖，未事先取得安装授权；发现后已说明，未再安装或升级。package.json、pnpm-lock.yaml 和工作区依赖配置均未改变。其余操作沿已有依赖执行。没有启动开发服务器。

## 审查与问题处理

2026-10-23 接收时，两个原生独立审查分别核对目标只读授权，以及 driver／命令／连接与草稿。两者均复核合并后的 efc9429，未发现阻塞问题；审查为源码及既有测试定义复核，运行结果由本轮主 Agent 验收。PR #2 在 Harness 构造器及宿主装配处与本变更冲突，合并后末尾参数统一为 processes、workerEntry、graphs、targetFiles，保留真实目标读取及静态 worker 接线；全部构造调用、类型检查和实际 worker 回归通过。

独立审查发现并修复三项实际问题：

1. 多个目标逐个异步检查时，较早核对的目标可能在后续等待中撤权。模型租约发放前增加同步最终确认，失败释放名额。
2. 空目标集合不能跳过来源最终确认；现在同样检查来源信任、对象及有效执行实例。
3. 首次定位已缺失的文件返回 notFound；首次 stat 后或读完复查期间消失返回 contentChanged。

审查者源码复核确认上述修复，在限定权限／异步范围内未发现新的问题；最终接受由本轮主 Agent 根据代码和实跑测试核对。文件初稿的编译、分页默认值、额外字节结果字段和按路径替换身份问题也已在集成前修正，始终使用原 fileId／basis。

首轮 48 项相关测试通过后补充四项竞态及真实工具会话。补测发现测试曾把普通文本读取的保存 basis 当作材料 fingerprint；改为在夹具准备阶段取所属领域 material 的依据。SDK 普通文件工具返回文本而非自定义 JSON，相关断言改为状态及语义片段。最终 57 项和额外接续用例均通过。

## dev 接收验证

2026-10-23，在主工作树 dev 将三个 PR 整合后运行；环境仍为 Linux、Node v24.12.0、pnpm 11.10.0。使用已有依赖，没有安装、升级或启动开发服务器。真实内部 broker、仓储、文件、worker 和进程控制，外部模型使用受控 HTTP，组件用例的显式替身沿原记录。以下是本批 PR 的接收回归，不是工作台 4.5 的最终公共基础组合验收。

| 命令／入口 | 结果 |
| --- | --- |
| pnpm typecheck；pnpm build | 全仓通过，包含三个 PR 的实际装配及双宿主构建。 |
| pnpm check:architecture | 13 模块、195 源文件，0 findings、0 exceptions。 |
| pnpm --config.optimisticRepeatInstall=false generate:contracts；生成器 --self-test | 通过；生成 patch 涉及的五份映射按 Biome 格式化后与现有文件逐字一致，未改声明或派生文件。 |
| node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts 加下列 32 个文件，--output test-results/pr-integration-kernel | 137/137 通过，6.2 分钟；同时覆盖本变更授权、其他两线 worker／命令／连接和既有会话恢复。 |
| node node_modules/@playwright/test/cli.js test tests/smoke/entrypoints.spec.ts --output test-results/pr-integration-smoke | 4/4 通过，35.3 秒；独立 Node、真实 Electron/preload、关窗重连及兼容宿主。 |
| UI 配置 --list，默认端口及 SCHOOLOOM_UI_PORT=5275 | 各加载 104 项；仅验证配置，未运行服务器、双实例或 UI 交互。 |
| 76 个改动源码／配置／测试文件 Biome 检查；git diff --check；三个 OpenSpec strict | 通过；定向 Biome 有 11 项 warning、3 项 info，无 error。 |
| pnpm lint --diagnostic-level=error | 仍失败于 21 项既有文献库 UI 错误；该目录与 fe2f0bc 一致，不是本批 PR 引入。GitHub CI 失败也停在同一 lint 阶段，不能据此推断远端构建或测试已跑过。 |

32 个内核文件均在 tests/kernel/，后缀为 .spec.ts：broker、cancel-admission、capability-isolation、capability-stop-unknown、checkpoint-files、client、context-contributions、context-drafts、context-session、editor-runtime、editor、execution-capacity、execution-isolation、graph-registration、harness-module、harness-recovery、managed-commands、manual-application、model-access、platform-processes、process-admission、project-backend、public-contract-baseline、research-module、resource-access、rpc、sessions、target-races、target-reader、work-domain-contracts、work-domains、workbench-context。测试产物位于上表 output 目录；相关用例清理自己持有的应用、执行及临时数据。

## 归档前核对（2026-10-23）

使用项目 openspec-verify-change 流程，在同步 dev ed35c59 的本工作树核对当前实现、规划及接收记录。完整性：11/11 任务、4/4 要求；正确性：8 个场景均有实现及对应测试依据；一致性：独立只读端口、broker 装配、异步范围、原身份／basis、scratch 和模型前授权均沿已确认设计。无 CRITICAL、实现／规格偏离或需要阻塞归档的问题。

| 要求／场景 | 当前实现及验证依据 |
| --- | --- |
| 固定工作域：全局会话取材，伪造／旧实例拒绝 | runtime.ts 的 fileContext／checkExecutionContext，manual.ts 的可信字段核对；work-domains、work-domain-contracts、broker、target-races 测试覆盖归属、伪造载荷、快照及取消迟到。 |
| 跨项目只读：撤权／变化、拒写、未登记／私有路径 | ProjectTargetReader、Projects.withTargetRead 与宿主最终授权；target-reader、target-races、project-backend 覆盖四类读取、目标零修改、嵌套拒写、路径和内容依据；model-access 及 work-domains 覆盖排队授权及接续外发。 |
| 临时区：两会话同名文件、缺失后接续 | sessionScratch 和原有受限 backend；work-domains、checkpoint-files、harness-recovery 覆盖同名隔离、链接逃逸、跨尝试／重启及 context_incomplete。 |
| 本项目／人工组合与跨域失败隔离 | 独立端口不放宽 ProjectBackend；project-backend、manual-application、harness-module、sessions 分别核对条件保存、异步来源及无 harness 组合。并行失败与正常保存的证据由这些隔离／保存用例组合核对，不宣称新增了同时编排两者的端到端用例。 |

本轮是源码、测试定义及已记录接收结果的核对，没有重跑或冒充接收阶段的 137 项内核和 4 项 smoke 结果。它们的命令、基线、替身与结果见上节；UI、真实模型、三平台和七域业务仍在所述证据范围之外。既有 21 项 UI lint 问题作为独立清理提交处理，不改变本 change 的实施完成结论。

正式规格同步仅将 execution-work-domains 的 4 条 ADDED 要求纳入主规格，保持原 Purpose、要求和场景正文；归档保留全部工件及 .openspec.yaml。其他两个活动 change 仅修正指向本记录的路径，不改变其任务、规格或验收状态。

## 未完成事项与下一步

- 本变更没有剩余实施任务；已核对正式验收并按 OpenSpec 流程同步规格／归档，另外两项变更保持活动状态。
- 另外两线现可消费真实 project.readTarget、工作域／模型前授权检查及 store/files 保护；统一 ExecutionResourcePort 适配、图持久恢复和显式项执行仍由各自任务交付。
- 全仓 lint 的既有前端问题尚未处理；未运行全仓测试、完整双宿主 UI／双实例、真实模型、分发包或跨平台验收。现有 UI harness 会启动开发服务器，受当前操作规则限制本轮未运行；Mermaid 未渲染。
