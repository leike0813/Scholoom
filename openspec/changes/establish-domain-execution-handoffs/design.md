# 实现设计

## 变更总览

```mermaid
flowchart LR
  D[科研或计算领域窄端口] --> B[broker 与前序工作域保护]
  B --> R[ResourceAccess 所属读取保存]
  B --> H[harness 图执行驱动]
  H --> W[宿主静态装配的执行 worker]
  W --> G[默认 Agent 或已登记图工厂]
  E[EditorRuntime 原流程] --> C[共同受管命令提供者]
  D --> C
  C --> P[ProcessAdmission 与 runCommand]
  R --> F[项目或库权威及实际结果]
```

依赖[工作域变更](../establish-scoped-execution-foundation/design.md)的同源契约及真实授权增量，分别作为独立实现与真实接线的前置；不要求它整项交付才开始。本变更提供共同端口和实际夹具，不替代七域业务实现。

## 并行边界

共同契约由 0.1、1.1 承接，先将资源证据及端口落入 dev，再接入消费它们的图执行、等待恢复及命令声明。与工作台线交叉的执行输入和持久记录 DTO 在此阶段合并；产品版本升至 4 统一由工作台 1.1 承接。生成映射、架构／类型检查及原会话回归通过，三线同步同一基线后并行实施，具体归属见[公共基础实施规划](../../../.scratch/domain-development/public-foundation-plan.md)。

本线掌握资源创建、图 driver、受管命令及独立夹具；工作域线掌握只读授权，工作台线掌握窗口来源、显式项和草稿。1.4 修改项目保存前同步工作域 1.2 的 store/files 增量；1.2、2.4、3.3 的真实授权接线等待工作域 1.2、1.3、2.1、2.2 对应能力在 dev 验证。其他图驱动、命令提取和 URL 任务可独立推进并标明替身。

2.2 的 driver 提取与 4.1 的 URL／共用 UI fixture 改造分别独立接入 dev，供工作台线修改相同代码块前同步。资源适配 1.2 接入后，工作台即可验证真实取材与撤权，无需等待整个 Graph 或命令实现完成。每次交接记录增量、验证和未完成范围；共享宿主装配按独立增量依次接入。

## 方案与接口

### 共同契约落点

资源证据、创建／核查、保存与关联分别声明于 `protocol/resources.ts`；原未使用的阅读摘录别名不再占用 ResourceEvidence。创建成功分支必须给出项目资源描述，prepared／unknown 不强迫伪造资源身份，关联回执单列原 operationId 与 confirmed／pending／unknown。ExecutionResourcePort 复用原读取及文档端口，保留既有 ResourcePort 的保存返回形状。

图公共 DTO 集中于 `graph-contracts.ts`：注册定义、agent／registered 选择、等待、resume、持久绑定及输入／读取／保存证据。`execution.initialize` 保留原 Agent 分支，registered 分支接收 attemptId、图描述、可选模型及宿主私有 checkpointPath／checkpointRef，允许确定性图不提供模型。`execution.next` 以 done 加 graph 表达等待／完成／失败；等待结束的是当前推进，不表示科研完成。原 Agent 驱动对这些新结果明确报告不可用。

`executionControlOperations` 同源引用资源读写与创建／查询声明，使 worker 无需另造资源消息；真实提供者留在 1.2／2.4 接入。内部 platform.command 单独导出，复用 editor 的参数、输出及等待边界，本轮不注册命令提供者。未接线的产品创建入口、registered 图和恢复输入均明确失败，不以默认 Agent 或成功空结果代替。

### 同源材料与结果

在 protocol/resources 增加 `ResourceEvidence = {ref: ResourceRef, basis, role?}`，复用原 ResourceRef，不新定义材料身份。新增窄 `ExecutionResourcePort`：describe、read、document、create、creation、save；create 接收本项目目标路径、内容及 operationId，creation 按该操作身份核查。已有文件的 save 必须带原 ref/basis。保存结果包含实际资源引用和 basis，关联另返回 confirmed/pending/unknown 及原操作引用。库写入必须调用所属已提供的能力，没有提供者即 unavailable，不能将普通附件只读接口改成写入入口。

新增 `resources.create`／`resources.creation`，仅接入所属项目的新建能力。复用 ProjectStore.save 的目标必须不存在、路径串行保护、候选文件和原子发布，项目内部沿既有操作记录扩展 create 类型；不新增公共业务台账。创建前持久保存 operationId、可信归属、目标、候选及可核查发布身份，执行中使用稳定 editId，成功后返回 fileId/basis。相同身份不同输入拒绝，相同输入重复提交先查原结果。发布后回执或登记未知时保留候选与收据，按原创建身份及实际发布依据核对；不能只凭同路径同内容认定是本次创建，不能自动覆盖、删除或重写。无法确认则保持 unknown。关联失败仅补关联，固定图必须从不存在的输出路径开始验收。

创建落在原 `file_operations.details.creation` 可选 JSON 字段，保留主体、首次 session／run、输入及 edit／候选依据；物理表结构不变。候选经同步后以硬链接原子发布，文件身份、编辑历史与操作完成在同一项目事务确认。原路径与 operationId 共同串行，重启核查只比较原发布物理身份和 basis，不重放。保存回执的可选 basis 来自发布前句柄，并在登记前复查；执行保存的 association 和首次创建查询复用 harness 原 `pending-artifacts`／artifacts，不另建关联账本。worker 保存返回同源 `ResourceSaveResult`，人工 `resources.save` 保留 descriptor。

图输入材料、实际读取材料和结果各有独立字段。材料不存在、删除、版本变化或外链不可用时原样传递所属领域失败，由负责 Agent 按引用行为矩阵处理，不隐式复制、不猜测替代对象。不要把 ResourceEvidence 引用集合变成全局存储或项目反向索引。

### 可装配图驱动

在 protocol/execution 声明判别式执行描述：默认 `agent` 路径保留现有输入；`registered` 路径含 graphId、version、已校验 config、材料引用、工作域和尝试引用。业务方法到图的映射属于科研域，公共基础不修改旧材料分析方法含义，也不把当前 Skill 执行改名为新图。

提取 `packages/harness/src/execution.ts` 的通用进程入口为可注入图工厂的 driver；新增宿主 worker 入口静态组合默认 Agent 与科研图工厂。harness 不依赖 research 实现，宿主可知两者。图身份、版本与配置 schema 的声明及实现注册来自同一源码定义，宿主发现与 worker 校验引用同一导出，不维护两个手写注册表。

worker 不接收用户模块路径或代码。RemoteAgent 由宿主注入固定 worker 入口 URL，并继续使用原 RPC、独占进程、模型预算、checkpoint、工具记录和实例资格。SDK 对象只在 worker 内存在；跨边界为可校验 JSON。采用现有 LangGraph，若需要直接依赖声明则复用锁定版本，在授权实施时处理 manifest 与锁文件。

固定测试图由源码提供两个确定节点，读取真实材料并写入结果；另一个场景通过 LangGraph interrupt 保存等待状态。它作为测试宿主的装配输入，生产默认注册不含样例。等待记录及后续输入属于当前尝试，用户发送消息后通过现有执行推进选择恢复；公共接口不暴露另一个“继续”按钮。取消、未知效果和部分保存沿既有执行／工具规则。

图驱动扩展 execution.next 的判别结果，保留已有模型事件，新增 `graph.waiting`、`graph.completed`、`graph.failed`；确定性图可以完全没有模型事件。waiting 包含 attemptId、waitId、nodeKey、输入 schema 引用、有界提示及 checkpointRef；completed 含实际资源结果与未完成关联，failed 含结构化原因。waitId 由一次真实 interrupt 产生，在同步 checkpoint 成功且宿主保存等待绑定后才对调用方确认。查询在 harness 的当前尝试投影显示该等待及图描述，不另立科研完成状态。

宿主在尝试记录中持久保存 graphId、整体 version、实际 config、stateFormatVersion、checkpoint 位置及当前 waitId。注册元信息与 worker 来自同一源码定义，恢复须匹配图身份、版本、配置及状态格式；不兼容时保留旧尝试／checkpoint／成果，新消息核查后建立新尝试，不把新图或默认 Agent 套在旧 checkpoint 上。

新消息仍先按用户当前意图处理。图节点的输入适配把明确指向当前等待的指令转换为 `GraphResumeInput {attemptId, waitId, instructionIds, value}`，value 按该等待 schema 校验；输入有歧义则询问，取消或改变目标不无条件 resume。resume 通过原受管初始化／接续通道形成 LangGraph Command，不执行跨进程任意代码。宿主检查新指令归属及 waitId，仅在带 resume 值的 checkpoint 保存后确认消费；回执丢失按 instructionIds/waitId 查询，不重复注入。

### 共同受管命令

新增 protocol/platform 内部 `platform.command`，请求为宿主认可的 workspaceId、已登记 executableId、参数、超时及可选输入，结果复用当前有界退出与输出类型。宿主私有工作空间描述提供 ownerModuleId、真实 cwd、所属工作域和可执行项；不将任意 executable 路径直接接受为模型输入。

工作空间归属还须符合前序工作域限制：全局执行不能通过该端口请求通用 Shell／解释器或在只读目标内运行会写缓存的程序，即使程序已登记也不能扩大能力。人工 editor 编译继续沿原人工入口规则，Agent 及未来计算域操作则核对自身执行范围和目标授权；两者共用机制但不混淆主体。

从 manual.ts 提取唯一命令提供者，集中执行准入、等待后重新授权、signal 传递、实际停止确认和释放。editorCommand 保留 Quarto／latexmk 的领域形状，作为薄适配调用同一提供者；EditorRuntime 继续管理输入快照、编译业务状态、缓存和最后成功预览。计算域随后提供其环境和工作空间描述、运行记录及 UI，不在本变更新造一套运行生命周期。

```mermaid
sequenceDiagram
  participant Caller as 已授权领域
  participant Host as 宿主及 broker
  participant Worker as 受管执行进程
  participant Owner as 资源所属领域
  Caller->>Host: 图身份版本、配置和材料引用
  Host->>Host: 校验注册、工作域和容量
  Host->>Worker: 初始化源码装配图
  Worker->>Host: 有界资源读取或保存
  Host->>Owner: 可信范围与原资源依据
  Owner-->>Worker: 实际结果或失败
  Worker-->>Host: 等待、完成或部分失败
  Host-->>Caller: 执行事实、实际成果和未完成项
```

### 独立开发接入

复用现有 tests/kernel 的真实模块组合及 tests/ui 双宿主入口。为 renderer URL/端口建立一个测试配置来源，例如 `SCHOOLOOM_UI_PORT`（缺省仍为 5174），UI fixture、Playwright webServer 及 baseURL 读取同一值。现有 resource-opening/lifecycle、writing-editor、file-workbench/explorer、workbench、harness、library、attachments、reading、conversation、statusbar 等用例中的固定 5174 导航一并改用该入口，不能只改 webServer。每个测试实例仍使用唯一 profile、库、项目及输出目录；不自动探测并复用其他工作树服务器。

提供小型共享测试辅助来创建所属模块与契约替身，不新增通用插件测试框架。注册时使用真实同源 schema 验证替身，真实组合再替换它；固定图与 Node 程序必须跑过实际 worker 和进程控制路径。工作树启动材料记录允许的替身及必须真实验证的领域边界。

## 文件变化

| 文件或范围 | 目的 |
| --- | --- |
| protocol/resources、项目创建内部契约、harness-module-contracts、harness-record-contracts、execution-graph、platform 及生成映射 | 证据、新建／查询、图描述及等待／终态结果、内部命令的同源契约 |
| projects/store.ts、files.ts 及现有操作记录 | 在原安全新建分支上补稳定创建身份及未知核查，保留条件保存临界区 |
| harness/execution.ts、remote-agent.ts、runtime.ts；新增通用 execution driver 导出 | 将默认 Agent 装配从固定 child 主体中提取，复用所有执行保护 |
| apps/kernel/src 新增受控 worker 与 command 提供者，修改 manual.ts/application.ts、构建及 architecture.json | 静态装配图工厂、模块受限命令、ResourceAccess 执行适配及依赖声明 |
| research 的执行端公共导出及宿主注入端口 | 为科研线提供源码图装配 seam，不实施具体业务图或库分析存储 |
| editor/runtime.ts 的命令接入适配 | 删除重复进程管理，保留排版领域行为 |
| playwright.ui.config.ts、tests/ui/fixture.ts 及现有固定测试 URL 的用例；新增有界 tests/fixtures/domain-execution-worker 及必要测试辅助 | 单源测试 URL、真实固定图及独立组合样例，生产不启用夹具 |
| tests/types/contracts.ts 与既有资源、科研、执行、editor 测试；docs/development.md | 调用符合性、实际文件和进程证据、独立接入说明 |

## 验证与风险

类型及架构检查后，扩展 resource-access、research-module、harness-module、capability-isolation、process-admission、platform-processes、editor-runtime 的相关用例。只新增现有用例无法表达的图装配与共同命令集成测试。输入采用独立固定文本及 PDF／HTML 小样本，预期来自明确定义的固定图而非实现自行生成。

检查非法图、版本不符、非法配置、材料撤权、取消中已保存文件、关联部分失败、worker 失联及命令后代收尾。运行 `pnpm build`、`pnpm check:architecture`、`pnpm typecheck` 和相关内核／双宿主测试；两个实例使用不同端口与数据空间验证相互不干扰。固定样例证明基础接线，科研质量、真实生态和三平台分发另行验收。

不新建运行数据库；图等待信息进入现有尝试记录，创建收据进入项目自己的操作记录。需要扩展存储格式时复用所属迁移／备份入口，旧记录按无图字段或原操作类型读取。扩展内部初始化契约时两端同步更新；旧普通 Agent 和材料分析路径回归通过。关键接口、取消和并发接线安排独立审查。
