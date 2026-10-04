# Scholoom 开发 schema

本 schema 将调查依据和实际交付纳入 OpenSpec，服务编码 Agent 的实施与续做。工程原则见 [#14](../../../.scratch/scholoom-foundations/issues/14-agent-development-discipline.md)，验证范围见 [#15](../../../.scratch/scholoom-foundations/issues/15-validation-and-release-discipline.md)，实际 UI／Electron 接线见 [#20](../../../.scratch/scholoom-foundations/issues/20-ui-debugging-and-e2e-harness.md)。

## 阶段

```text
proposal --> investigation --> specs  --> tasks --> delivery
                          \-> design -/
```

| 工件 | 完成依据 |
| --- | --- |
| proposal | 目标、范围、可观察完成判据与真实授权依据明确 |
| investigation | 足以选择方案的事实已核对，影响方案的未知项已解决或明确阻塞 |
| specs | 适用的行为契约及场景明确；无行为变化可声明 skip_specs |
| design | 复用、模块／接口、文件变化及验证方式明确 |
| tasks | 可独立验收的任务、依赖及整合责任明确 |
| delivery | 实际成果、验证、审查与未完成事项有依据；可用于中途交接 |

规划在 `apply.requires` 及其依赖齐备时结束。fast-forward 仅生成该依赖集合；即使 `delivery` 显示 ready，规划时也保持未创建。调查工件可用一段事实结论结束，实验只针对会影响方案的未知项；简单设计保持简短。

使用 continue 时，先核对 apply 所需集合及其依赖，再选择下一工件。规划工件已齐备而 delivery 尚未创建时，先读取 delivery 指引：若没有本变更的实际执行结果，本次规划结束，报告可进入 apply；仅在用户已授权实施时进入执行。已有实际执行结果时，可以按该指引记录交付或交接。已有交接文件且任务未完成时，继续 apply，而不是重复创建工件。这一阶段判断优先于通用 continue Skill 的首个 ready 工件分支；不为使 `isPlanningComplete` 变真而提前创建 delivery。

执行或续做使用 apply，读取当前任务和已有交付记录。实际执行后，在交接或收尾时获取 `openspec instructions delivery --change <name> --json`，填写或更新同一份 `delivery.md`。任务进度以 `tasks.md` 为准；交付记录提供成果和续做背景。最终交付时再完成交付记录任务。

归档依据实际交付状态、必要验证及任务完成情况判断。中途交接文件存在也不意味着可以归档；后续实现变化需要核对受影响证据。真实科研效果评价按 [#21](../../../.scratch/scholoom-foundations/issues/21-agent-dogfooding-and-evaluation.md)的讨论时机落实。

## OpenSpec 边界

本机验证基线为 OpenSpec 1.14.0。CLI 依据文件存在判断 artifact 状态，依据 checkbox 判断任务进度；`isPlanningComplete` 会包含 delivery，名称不代表本 schema 的实现准备度或验收结果。使用 apply instructions 判断实现前依赖，用实际结果判断交付。

schema、context 和 operation guidance 提供 Agent 指引，不能强制检查执行时机、授权或证据真实性。CLI 的 nextSteps 可能在规划后提示写 delivery，须按上面的 continue 阶段判断处理。CLI 返回 `all_done` 后仍需核对交付记录；apply／archive 指引提供该提示。

`openspec schema validate scholoom-dev` 检查 schema 与模板；`openspec validate` 检查规格／变更结构。实际行为按变更影响运行相关检查。官方 Skill 与 CLI 无需修改，新增 schema 也不会自动更新上游默认模板。

## 常用入口

```sh
openspec new change <name>
openspec status --change <name> --json
openspec instructions <artifact> --change <name> --json
openspec instructions apply --change <name> --json
openspec instructions delivery --change <name> --json
openspec schema validate scholoom-dev
```
