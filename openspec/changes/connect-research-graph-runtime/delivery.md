# 实际交付与交接

## 当前状态与成果

2026-10-25，本 change 首轮实施与本线独立验收的14项任务已完成，本轮追加4项消费核对已完成，实际结果见末节。共同源码基线仍为 `e3d58fc807827a78493dcd16e38de28c8d02766e`，未提交、推送、建立PR、同步正式规格或归档。用户在初始规划后明确要求实施，选择G1方案A，并授权 `pnpm install --frozen-lockfile`；仅安装锁定的既有依赖，锁文件和依赖声明未改。

已核对 [design](design.md) 的模块图和时序图；实际路径是科研入口 → broker → harness → 受管worker → 项目／库资源，执行权威继续归harness。对应proposal完成判据：

1. `ResearchGraphs` 及同源 `research.graphs/graph` 提供有界发现、精确版本、开放配置和节点资源来源。目录由源码装配，默认产品集合为空；未知版本和非法配置明确拒绝。
2. `ResearchRuntime.graphCalls` 组合科研调用记录、内部 `research.startGraph`、真实启动回执及历史查询。复用原 `research_attempts`，新旧类型明确区分；不存进程、等待或checkpoint状态副本，不新增Method实体。
3. 固定校准图实际读取项目文本及托管库文本，首次创建报告、保存真实interrupt，经现有产品连接的普通 `session.send` 确认后完成。复用原driver、InstructionSaver和资源保护，无外部模型、无任务端口替身。
4. `research.graphCalls` 关联真实来源下的尝试，按当前调用者权限读回必要材料／成果，分开返回Run、交付缺项及 `researchAssessment: notAssessed`。查询不执行、不补关联、不写回run引用；未知回执先核对原Message和图绑定。取消后的新尝试沿原来源，显式新调用另起来源，查询旧调用不取最新run替代。
5. 覆盖等待、撤权、关联失败、创建结果未知、保存受理期间取消、回执丢失、重启、并发补交和独立副本恢复。副本保留原材料／成果依据，仅校正本域归属并标注来源，禁止直接重启旧调用或自动访问原资源。旧材料分析保留原接口及行为。

主要文件：`packages/research/src/{graphs,graph-runtime,graph-delivery,runtime,records,schema}.ts`、科研protocol契约及派生映射、`apps/kernel/src/application.ts`、`architecture.json`、科研测试与固定worker夹具。开发说明更新实际入口及旧builtin路径，AGENTS补充调用来源与恢复约束。G1公共修改另归 [add-harness-execution-history](../add-harness-execution-history/delivery.md)，共享文件的符号归属见两份design。

## 实际验证

环境：Linux，Node `v24.12.0`，pnpm `11.10.0`，已有Playwright `1.63.0`。每个组合使用独立临时profile、项目、文献库及输出；真实broker、SQLite、项目／库模块、LangGraph和受管worker。旧模型相关测试只使用既有受控本地HTTP响应，未使用真实Key或用户库。fixture关闭其持有的app／worker；未启动开发服务器。

| 检查／命令 | 实际结果与证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false typecheck` | 通过，包含共享构建、各包及tools类型检查；`/tmp/scholoom-research-typecheck-final.log` |
| `pnpm --config.optimisticRepeatInstall=false build` | 通过，包含内核与桌面production构建；`/tmp/scholoom-research-build-final.log`。构建不等于产品运行验收 |
| `node scripts/check-architecture.ts` | 13模块、197文件、0 findings／exceptions |
| `node packages/protocol/scripts/contract-types.mjs --self-test`；生成patch与当前映射忽略格式空白比较 | 通过，无映射漂移；`/tmp/scholoom-research-static-final.log` |
| 对git列出的25个改动TS／JSON／MJS执行Biome check | 通过；同上。格式调整通过stdin生成patch，使用apply_patch写回 |
| 下列7文件定向kernel组合 | **62/62通过，6.6分钟**；`/tmp/scholoom-research-regression.log`，产物 `test-results/research-graph-regression/` |
| 最后补充的授权、同输入并发／分页／较新独立调用、混合仓储断言 | **3/3通过**；`/tmp/scholoom-research-final.log`，产物 `test-results/research-graph-final/` |
| 两个change的 `openspec validate <name> --strict`；`openspec schema validate scholoom-dev`；diff空白检查 | 通过；不代表科研质量、跨线整合或三平台交付 |

定向组合命令：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/research-graphs.spec.ts tests/kernel/execution-history.spec.ts \
  tests/kernel/research-module.spec.ts tests/kernel/research-capabilities.spec.ts \
  tests/kernel/registered-graph.spec.ts tests/kernel/registered-context.spec.ts \
  tests/kernel/resource-creation.spec.ts --output test-results/research-graph-regression
```

最终补验使用前三个文件，增加 `--grep 'reads project|direct entry|persists attempts'` 及独立output。62项包括6项公共历史查询、8项科研图、3项科研模块、11项旧材料分析、14项注册图、16项注册上下文和4项首次创建。公共恢复测试实际覆盖版本／checkpoint不兼容，本线未复制driver测试矩阵。

故障注入仅在测试边界：真实SQLite触发器拒绝关联／创建登记／科研回执保存；真实创建完成后暂缓返回以触发取消。文件、身份、收据与归属仍来自真实模块，没有成功业务替身。独立模块测试以可替换端口运行，不将它计为进程接线证据。

## 审查与问题处理

原生独立审查Agent（gpt-6.1-sol／high）发现并复核关闭四项：严格资源read参数投影、执行身份经原executionResources适配、并发重放统一核对图绑定、未知科研回执先核对原Message文本及图输入。实际回归覆盖这些边界，包括活动worker身份的科研查询与原文本A／B冲突。

初次整合6项失败由成果操作ID包含冒号引起；材料已经真实读出，项目创建的文件名规则拒绝了操作身份。改为 `graph_` 加来源／角色摘要，在1024字符原指令下仍可首次创建。后续正常路径的来源断言失败来自测试未使用工作台连接，改为现有connectProduct发送并核对完整持久上下文。保留初次日志 `/tmp/scholoom-research-integration.log`、`/tmp/scholoom-research-diagnosis.log`、`/tmp/scholoom-research-recheck.log`；最终结果以上表为准，未增加时限。

既有CI输入另见 [investigation](investigation.md)：No held RPC定位到files.save／resources.save gate错配；browser材料分析空串及Windows末态超时缺少阶段／trace证据，不能认定加超时即可修复。未改本线外UI测试或宣称既有CI已全绿。

## 未完成事项与下一步

本change首轮独立范围已完成。本轮主线已通过正式源码快照转交项目任务接口及阅读线 `add-material-annotation-interactions`、`add-interactive-research-reports` 的design，消费设计见下节；提供者没有合入当前源码，**I1／I3／I5未验收**。没有访问实际其他树或跨树发消息。下游可消费本线稳定入口、ResourceEvidence及真实run查询，任务权威由项目线提供。

生产真实综合图的节点、顺序、回路和质量要求仍待用户恢复讨论；用户自定义Graph、库级成果写入、通用委派均后置。固定图只证明机制，科研充分性始终notAssessed。未运行UI／Electron交互、真实模型、Windows／macOS或分发包验收，Mermaid未另行渲染；当前macOS受管执行不可用的既有边界保持。公共增量接入dev、规格同步／归档和Git交付均留待用户安排。

## 本轮主线转交与消费结果

主线输入是 `/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`、coordination-plan.md及manifest.json；后者逐树注明共同基线e3d58fc。主线独立只读审查未发现本线确证缺陷，科研定向复验17/17通过。本轮没有新增业务缺陷可复现修复，也没有修改业务源码／生产图目录；完成了公共切片准备和实际交接输入消费。精确路径与字段映射集中维护在 [design的正式快照消费与I1装配](design.md#正式快照消费与i1装配)，不再要求用户转述已收到的接口。

| 正式消费输入 | 已闭合的核对 | 当前尚缺提供者／验收 |
| --- | --- | --- |
| research-task-workspace/packages/protocol/src/task-contracts.ts、projects/src/tasks.ts、kernel/manual.ts、harness/task-tools.ts及所属design/tasks/delivery | TaskRef三身份、workItem导航、四个tasks操作、入口entry.basis、source／process／result链接和保存部分失败语义明确 | 资源schema叶模块、TaskRef和真实tasks提供者尚未合入本树；I1真实产品启动与调用关联未实施 |
| research-interaction的两份design及workbench-context-contracts.ts／workbench-context.ts | 新位置／坐标字段只沿原InstructionContext、来源版本与普通消息接续；报告ready不恢复图 | ContextItem位置与image增量未合入；resources.report／批量append／HTML桥仅规划；M1／M2／M3和完整I5保持开放，U1修复结果未收到 |
| agent-delegation/delegation-contracts.ts、delegations.ts、application.ts及所属design | DelegationRole静态注入seam与版本、模型解析和工具收紧对齐；report是成果角色，旧Skill与无模型校准图都不是科研Agent角色 | 本树无委派提供者；A1修复、Agent组合及I3未验，真实综合／审阅指导仍待用户恢复业务设计 |

以上相对路径均以 `/tmp/scholoom-phase2-handoff-VZS5mS/` 为根；它们是正式交接证据，不是当前树已安装能力。原investigation记录的是首轮输入状态，本节和design更新其“尚未收到”待办：现在已收到接口与设计，尚缺合入后的实际提供者、产品请求契约及真实整合。

公共准备结果见 [公共delivery](../add-harness-execution-history/delivery.md#本轮公共补丁交接)：独立公共副本构建、31/31回归、0架构问题、正反补丁检查通过；两份补丁及Agent符号组合清单位于 `/tmp/scholoom-research-phase2-mtJQci/`。只读三方文本试合并没有把未合入Agent私有实现当共同基线。

### 可转交的真实材料与结果

本树先运行 `pnpm --config.optimisticRepeatInstall=false build:shared`，结果通过，日志为 `/tmp/scholoom-research-phase2-mtJQci/consumer-build.log`；随后执行同目录research-evidence.mjs，结果通过，日志为research-evidence.log。脚本仅调用既有KernelApplication、源码校准图、真实broker／worker／SQLite／资源端口，没有另写业务流程实现或任务替身。所有profile／项目／库／输出都在该目录research-evidence/，执行后已关闭本轮app和产品连接，未使用真实Key、用户库或开发服务器。

- `/tmp/scholoom-research-phase2-mtJQci/material-result-evidence.json`：保存两类材料实际ResourceDescriptor、原ref/basis、调用输入、启动回执、waiting／completed查询、可信来源的consumed确认消息及报告字节。
- `/tmp/scholoom-research-phase2-mtJQci/research-evidence/project/report.md`：真实首次成果，含项目样本result 42和库样本comparison 17；不是空占位文件。actual runId为 `c4f3fb08-ab9c-4fdc-a57a-259eb169b235`，产物fileId为 `dbd4c1dd-6277-487a-b9ce-852ed34cc1ae`，创建及association均confirmed／complete，最终check为usable／notAssessed。
- 该证据显式声明：图初次启动来自可信宿主fixture；确认与结果查询来自connectProduct；**tasksProvider未装配、I1未接受**。不能把这份材料／结果证据代替项目线从真实用户入口启动及任务链接保存的验收。

### 主线下一步决策与停止点

主线可按design中的7步装配清单推进I1，但须先确认有限产品请求及调用关联落点：优先评审方案A（项目侧组合，TaskRef／workItemId及调用引用留在任务／过程材料，科研schema不增加字段），方案B为科研记录增加可选同源TaskRef／workItemId并另立有界规格。两案均不能把host-only research.startGraph直接开放给客户端；操作归属、所选sourceLinkIds与入口basis核对须明确后再实施。该分支本轮仅设计，未自行选定新跨模块契约。

真实科研角色及综合流程仍待用户恢复设计；可继续通用worker的机械I3验收，不能从校准图推导科研角色已具备。公共dev接入和Agent组合门由公共change的tasks 4.1保持开放。本轮止于补丁、消费核对和上述真实资源证据，不同步规格、不归档或进入科研质量验收。
