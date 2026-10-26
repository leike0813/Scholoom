# 调查依据

## 当前事实与复用选择

基线为`e3d58fc807827a78493dcd16e38de28c8d02766e`加本线已实施任务增量。2026-10-25只读消费用户明确提供的`/tmp/scholoom-phase2-handoff-VZS5mS/`快照；`manifest.json`记录七线均同一基线，未包含的基础源码以本树为准，没有读取其他真实工作树。以下是静态证据，未执行M2新逻辑。

| 事实 | 精确源码及影响 |
| --- | --- |
| 可信调用没有精确指令／工具字段 | 本树`packages/protocol/src/core.ts:11`的CallContext包含principal、projectId、sessionId、runId、instanceId及workDomain，没有instructionId／toolCallId。不能把请求参数扩展为可信身份 |
| 一个run可消费多条指令 | 本树`packages/harness/src/runtime.ts:1810–1875`维护最多100条有效InstructionContext；`instruction-context.ts:53–62`在多来源时返回ambiguous。该选择能力不证明某次文件保存由某条指令导致 |
| 宿主知道已接收的工具调用，但没有把作用域传到文件域 | `runtime.ts:1886–1961`用namespace及request.toolCall.id形成持久工具收据；AsyncLocalStorage目前仅保存error。`execution-driver.ts:221–248`经双向IPC调用worker token，返回文件操作是新的RPC处理，不可假定同进程AsyncLocalStorage自动跨进程传播 |
| 文件正文与历史由projects掌握 | `packages/projects/src/store.ts:342–488`在ProjectFiles.coordinate临界区核对整份内容、文件身份和resourceBasis，发布后在历史事务中登记FileEdit。`project-file-contracts.ts:4–18`没有来源和撤销关联 |
| 历史登记可失败 | `store.ts:463–482`明确存在文件已落盘而历史登记outcomeUnknown。来源只能与实际edit同次提交；不能在工具完成回调后另补“成功归因”，也不能根据新文字认领未确认edit |
| 已有创建回执可复用 | `packages/projects/src/creations.ts:15–22、40–80`保留可信owner、operationId及原edit，重试读取原记录，不应改写为查询者的新来源 |
| 撤销是整次编辑 | `store.ts:523–565`核对完整after，非创建撤销复用save，创建撤销移走实际文件；没有hunk参数或revertsEditId。原操作保护后续编辑，不足以证明差异块撤销 |
| 对外保存丢弃了部分edit关联 | `apps/kernel/src/manual.ts:320–328`的project.saveFile接收可信context但调用store.save未传来源。`resource-contracts.ts:46–49`的ResourceSaveResult只有resource／association；`association`属于session/run成果登记，不是FileEdit或任务links |

```mermaid
flowchart LR
  U[已受理的一组指令] --> H[harness工具收据]
  H --> IPC[execution.wrapTool及worker token]
  IPC --> C[新的文件RPC处理]
  C --> CT[宿主CallContext 仅已知执行事实]
  CT --> S[projects文件锁及条件保存]
  S --> D[实际磁盘内容]
  S --> E[现有FileEdit历史事务]
  H -. 目前无可信工具作用域映射 .-> E
  E --> R[阅读差异与整次undo]
```

### 正式交接输入

- Agent：`/tmp/scholoom-phase2-handoff-VZS5mS/agent-delegation/openspec/changes/add-bounded-agent-delegation/design.md:62–74`；实际`packages/harness/src/delegations.ts:114–123、335–343`及`runtime.ts:2162–2188`。子实例使用父session／run，另有childInstanceId和delegation记录；不能把共用runId解释成父亲实际写入。宿主的父子登记才可证明委派链；角色名称和模型说明不构成作者身份。
- 阅读材料：`/tmp/scholoom-phase2-handoff-VZS5mS/research-interaction/openspec/changes/add-material-annotation-interactions/design.md:45–48、79–81、119`。候选为editId＋资源依据＋可信指令／执行／工具关联；M2未到位时仅显示历史，不能声称修改意见已消费。
- 阅读报告：同快照`research-interaction/openspec/changes/add-interactive-research-reports/design.md:29–58`。报告入口和来源各有独立ref／basis，页面动作只形成共同草稿；不提供可信文件修改者，不把报告objectId当editId。
- 通用执行历史：同快照`research-graph-runtime/openspec/changes/add-harness-execution-history/design.md`。可按原指令查询执行历史；它证明执行与指令消费，不证明某个FileEdit或具体修改原因。

已复用FileEdit、ProjectFiles.coordinate、原创建回执、ToolRecord、所属授权及原undo，不引入审查数据库、修改正文副本、自动Agent消息或通用事务框架。按已确认#13，普通改稿不新增持久多阶段状态机；元数据无法核查时如实未知。

## 影响方案的未知项与实验

无需实验才能确认“当前没有可信指令／工具来源”和“undo不支持hunk”：声明与调用链足以回答。没有调用真实用户库或伪造新来源字段进行“通过”实验。

尚需主线核对：D1工具作用域要先支持宿主令牌还是先交付粗粒度执行来源；D2“局部”是否采用既有单次FileEdit；D3是否采纳新增有界查询及保存结果的可选editId。选项与后果见design。本轮不实现这些未确认字段。

## 结论与承接

来源分层及未知语义可明确；读取工具收据不等于能跨IPC绑定文件保存。推荐先保存可证明的人工／执行事实，缺精确工具和指令作用域时明确未知；若要求精确工具归因，须先验证宿主令牌的逐调用传递，不能用当前run变量或任选指令补齐。D1–D3未确认的实施分支保持阻塞，规划与delta仅供审查。后续独立测试及故障验证由tasks承接，不创建delivery。
