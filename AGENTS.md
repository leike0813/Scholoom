# Scholoom

## 上下文入口

- 产品、领域与架构讨论：先读[决策地图](.scratch/scholoom-foundations/map.md)，再读相关票；具体决定以票为准，术语见 [CONTEXT.md](CONTEXT.md)，产品要求见 [PRD](docs/prd/README.md)。
- 开发、调试与验证：先读[开发说明](docs/development.md)，命令以根 `package.json` 为准；模块与接口设计核对[架构文档](docs/architecture.md)、相关决议及[当前规格](openspec/specs)。技术与接口草稿中的候选方案不视为定案。
- 修改工作区文件树、文件传输或范围监听时，先读[开发说明中的文件树与传输约定](docs/development.md#工作区文件树与传输)。
- 规划、协作与交付：遵循[开发纪律 #14](.scratch/scholoom-foundations/issues/14-agent-development-discipline.md)；确定验收范围或准备发布时读[验证纪律 #15](.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md)。
- 决策票保存选择与理由，OpenSpec 保存行为契约及实施变更，开发说明保存运行入口；更新对应事实源，其余引用，不另建重复 ADR 或进度账本。
- 起草实施规格时参考[初设规格书](docs/initial-spec/README.md)，核对当前正式规格及原决议；初设不表示已实现，转入正式规格后以链接替换对应初设正文，避免维护两份契约。

## 产品与架构约束

- 科研内核可脱离工作台执行；GUI 与 Agent 共用领域能力和数据权威。跨端契约以 `packages/protocol` 的 schema 为源，工作台经 `packages/client` 接入。
- 模块设计、依赖调整与重构先核对[模块依赖决议](.scratch/runtime-architecture/issues/01-module-dependencies-and-authority.md#answer)：跨模块动作经统一 broker，宿主管装配与生命周期；模块掌握自身记录和授权，私有包支持提取。人工基础操作独立于 harness，科研运行时依托 harness；依赖方向与同源契约须有可执行守卫。
- 调用、传输及调度沿[内部接口决议](.scratch/runtime-architecture/issues/06-internal-interfaces-and-ipc.md#answer)：进程内 broker 直调，跨进程共用 JSON-RPC 机制并按角色注册；Node 子进程用 IPC，Zotero 插件兼容宿主用回环 WebSocket。操作语义沿同源契约，双向等待及积压有界，具体字段与参数经实施验证。
- 系统访问及原生适配沿[平台决议](.scratch/runtime-architecture/issues/02-platform-access.md#answer)：普通模块使用有资源范围的平台能力，原生访问限定到受控适配；保证、释放责任和不可用状态进入共同契约，跨平台承诺以真实目标环境验证为准。
- 共同文献题录与附件由独立 library 管理，项目保留引用；库写入与材料外发分别授权。摄取、修订及接续沿[题录库规格](openspec/specs/literature-catalog/spec.md)，文件归属、版本核对和重定位沿[附件规格](openspec/specs/literature-attachments/spec.md)；题录、附件登记、实际可读与分析状态分别表达。
- 内核启动、停机或运行目录操作先核对[生命周期说明](docs/development.md#内核配置与生命周期)：调试入口共用 `.scholoom-dev/debug/` 受管内核并随最后一个调试宿主退出回收；独立 CLI 与普通产品实例继续驻留，调试入口不接管其占用的配置。配置使用本机文件系统，持锁期间保护同一运行锁文件。
- 本机与 SSH 远程部署沿[部署决议](.scratch/runtime-architecture/issues/05-local-and-remote-deployment.md#answer)：支持本机或远端完整环境，远端数据及模型凭据随工作机；工作台负责 SSH 引导，材料明确传输，断线与升级保护已受理工作和草稿。当前仅本机接线，远端目标须经 OpenSpec 实施与真实验收。
- 执行与扩展遵循 [#07](.scratch/scholoom-foundations/issues/07-agent-runtime-boundaries.md#answer)：统一内置 LangGraph harness，不支持 ACP 外部 Agent；多模型共用同一执行机制，harness 消费的 MCP 能力经插件系统管理。
- 对外 MCP 及插件公共发布先核对[外部接口决议](.scratch/runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)：首批查询与有限工作请求，stdio／Streamable HTTP 及 Tasks 共用领域权威与调用方授权，服务默认关闭；A2A 后置。具体接线经 OpenSpec 实施验证。
- 执行进程、调度及取消恢复先核对[进程决议](.scratch/runtime-architecture/issues/03-session-execution-processes.md#answer)：活动执行与独立子 Agent、advisor 执行独占进程，宿主统一准入，按执行归属收尾并核对已受理操作。Worker 不替代所需进程隔离；人工执行基础独立于 harness，具体计算部署、资源及共享故障范围沿该决议。Synthesis 的 TypeScript 与复用取舍沿[#19](.scratch/scholoom-foundations/issues/19-existing-source-and-rust-reuse.md)。
- [Agent 会话](.scratch/scholoom-foundations/issues/43-free-agent-conversation-and-research-tasks.md)沿通用 harness，不分类型、不绑定研究任务；任务通过工具操作，多会话可处理同一对象。用户通过发送消息推进会话，执行恢复由内部处理，交互与接续沿[会话边界](.scratch/runtime-architecture/issues/04-execution-persistence-and-recovery.md#会话交互边界)。
- 工作推进及接续所需分析、依据、决定、进展和下一步在形成时保存为工作区材料与所属记录，沿[工作区承接](.scratch/scholoom-foundations/issues/35-research-workspace-context.md)。会话可用完即弃，同一会话的连贯体验不替代这些事实源；任何工作推进均不以会话记录或上下文为必要依赖。
- 文件并发、误操作与备份恢复按 [#13](.scratch/scholoom-foundations/issues/13-storage-and-change-model.md#answer)：内部按文件串行保存，内容变化即重读；恢复到独立副本并保护后续成果。checkpoint 失效后的新执行接续及产物关联部分成功沿 [#25](.scratch/scholoom-foundations/issues/25-harness-business-integration.md#持续保存分批交付与恢复)。
- [交互式科研界面](.scratch/scholoom-foundations/issues/45-interactive-research-reports.md)是一等原生接口，供 Agent、能力和迁入工作流共同使用。
- 现阶段排除依赖[持续精确原文定位](.scratch/scholoom-foundations/issues/44-defer-continuous-precise-source-location.md)的功能；保留当次选区、来源摘录和重新核查。

## 实施与模块交付

- 新功能、接口／状态变化、数据迁移及核心跨模块约定使用 OpenSpec `scholoom-dev`；已有契约内的小清理与简单修复走轻量路径。
- 创建、实施或续做变更时，先读[阶段约定](openspec/schemas/scholoom-dev/README.md)，再取当前 instructions。规划止于 `apply.requires` 及其依赖齐备，优先于通用 `continue` 的首个 ready 工件规则；实际执行后才写 `delivery.md`，续做先读已有交付记录。CLI 的 ready／all_done 不代表实际交付完成。
- 默认沿实际业务路径推进。模块按自身契约独立测试与交付，无需等待完整路径；基础设施交付说明服务的路径，跨模块路径由主 Agent 负责整合验收。
- 设计模块时使用 [codebase-design](.agents/skills/codebase-design/SKILL.md)，把独立测试、诊断与交付作为 deep module 的设计检查，并在实现前识别已明确的复用职责。模块依赖可在测试中替换，独立交付不要求拆成独立进程或包。
- 模块交付包含可诊断入口：复用接口、日志或测试，能读取当前状态、相关失败原因和排查线索。交互失败应能区分发送、受理、执行与结果刷新环节。
- 共享接口由主 Agent 统筹；接口频繁变化时先澄清契约，再并行依赖实现。并行收益计入沟通、审查和返工成本。

## 旧项目复用与验证依据

- 迁入 zotero-agents／ResearchSpec 的实现按 Scholoom 契约抽取或重组，由本项目维护，保留来源与必要许可；不把旧应用整体作为运行依赖。比较适配、状态转换、构建和维护的总成本，按[#19](.scratch/scholoom-foundations/issues/19-existing-source-and-rust-reuse.md)决定复用或重写。Zotero 插件兼容遵循[#05](.scratch/scholoom-foundations/issues/05-zotero-compatibility-policy.md)，两类兼容要求分开处理。
- 可用原项目集成测试、e2e 和已验证结果作为 oracle；核对来源版本、输入、预期和运行条件，区分实跑证据与仅阅读的测试定义。
- 将需要保留且符合本项目契约的行为转为对应测试，再按 [TDD](.agents/skills/tdd/SKILL.md)逐步实现。旧宿主耦合和已知缺陷不成为验收目标，预期差异须解释。
- 验证预期来自已确认契约或独立核对的样本，不以新实现自身输出作为唯一依据。关键接口、数据保护、并发与复杂整合安排独立审查，直接核对契约、改动和运行结果。

## UI 与真实验证

- UI 在 [Workbench.tsx](apps/desktop/src/renderer/src/workbench/Workbench.tsx) 上演进；浏览器与 Electron 共用组件、session 和事件路径，宿主差异留在薄适配层。调试与验收按[#20](.scratch/scholoom-foundations/issues/20-ui-debugging-and-e2e-harness.md)及开发说明处理。
- 使用既有 UI harness 尽早提供可操作反馈；模块专用可视化夹具接入真实模块和组件，明确依赖替身，不另建业务实现或产品工作台。
- 首条真实业务路径贯通后建立对应 e2e，关键动作经用户入口并核对持久化或产物。整合 e2e 运行真实内部接线，可在外部模型／远程依赖边界使用受控响应。
- 维护双宿主 UI 测试；preload、IPC、原生能力与生命周期在真实 Electron 验证。真实科研 Agent 验收经产品入口运行，外部 Agent 代写产物不算通过。
- 集成测试与科研验收使用隔离的配置、文献库、项目和输出目录，明确端口及进程归属；结束时仅停止本轮拥有的执行单元。
- 数据库访问方式与 UI 负载能力按 [#12](.scratch/scholoom-foundations/issues/12-technology-stack.md#answer)在开发中和交付前复验，按证据调整。性能门槛沿 [#15](.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md#性能验收q5)仅用于确定性动作；Agent 整体任务耗时用于诊断，科研成果另行验收。
- 原型、模块与整合交付分别记录真实接线、模拟边界及验证范围。本地通过不代表三平台验收；发布前按[#15](.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md)验证目标平台实际分发包及必要迁移、恢复路径。

## UI 设计约束

- 工作台视觉与布局的唯一事实源是[设计文档](docs/ui-design/README.md)；改动界面结构、间距、颜色、字体或状态呈现前先读取并对齐，调整设计本身时先更新该文档再改代码。
- 样式只引用 `apps/desktop/src/renderer/src/styles.css` 顶部定义的语义 token；引入新语义时先加 token 并在浅色、深色两套映射中同时赋值，组件样式不写具体色值、字号或圆角。
- 三区骨架与 Agent 面板双形态是稳定结构；新功能以 tab、面板、消息流组件或列表行接入，不另起布局，不绕过 dock/overlay 形态契约。
- 可访问名（连接状态、研究指令、发送指令等）是双宿主测试的回归锚点，重命名或移动控件时同步核对 `tests/ui/`。

## 诊断、收尾与交接

- 连续修复无效或特殊分支增加时，复查契约、模块职责和测试预期；以是否获得新证据、缩小问题范围判断进展，不设置固定失败次数门槛。
- 实验结束时明确临时工件进入正式实现、保留为夹具／调查依据，或在授权范围内清理。暂留妥协写明具体限制与重新处理条件，避免无说明地成为生产依赖。
- 交接记录须让接续 Agent 能从当前规格、代码、实际结果和下一步继续工作；OpenSpec 变更沿同一 `tasks.md`／`delivery.md` 更新，不依赖用户重述已确认决定。
- 反复出现的协作困难优先通过结构、工具反馈、测试或夹具解决；补充规则前检查必要性，并清理重复、失效要求。详见[#14 持续改进](.scratch/scholoom-foundations/issues/14-agent-development-discipline.md#持续改进与后续边界)。
