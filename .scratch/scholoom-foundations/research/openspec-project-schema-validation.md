# scholoom-dev schema 验证结果

日期：2026-10-04。OpenSpec CLI 1.14.0，Node 24.12.0，Linux。[使用约定](../../../openspec/schemas/scholoom-dev/README.md)、[schema](../../../openspec/schemas/scholoom-dev/schema.yaml)及六份模板已落地，[项目配置](../../../openspec/config.yaml)选择 scholoom-dev。[AGENTS.md](../../../AGENTS.md)提供上下文与 continue 的阶段判断入口。

## 实际检查

- `openspec schema validate scholoom-dev --json`：valid 为 true，issues 为空。
- `openspec schema which scholoom-dev --json`：解析到本项目 openspec/schemas/scholoom-dev，source 为 project。
- `openspec schemas --json`：六个工件均可发现。
- Node 临时样例实际调用 `new change`、`status`、六类 `instructions`、`instructions apply/archive`、`validate --strict`、`show --type change` 和 `archive --yes --json`，完成以下 12 项行为检查。

| 检查 | 结果 |
| --- | --- |
| 新变更采用项目默认 schema，初始依赖正确 | 通过 |
| 六类 instructions 能解析模板及输出路径 | 通过 |
| proposal 完成后先解锁 investigation | 通过 |
| 提前存在 tasks 不能绕过缺失的调查／规格／设计 | 通过 |
| investigation 完成后解锁 specs 与 design | 通过 |
| 规划齐备且 delivery 不存在时 apply ready，fast-forward 依赖集合不包含 delivery | 通过 |
| 行为 delta 的严格结构验证 | 通过 |
| 中途交接存在时保留 pending 任务，apply 读取 delivery | 通过 |
| all_done 时仍返回 apply／archive 指引 | 通过 |
| 无行为变化的工具变更通过 skip_specs 跳过规格且允许 apply | 通过 |
| 填写当前 proposal 模板后 show 能解析实际 delta | 通过 |
| 实际归档样例，同步为主规格并通过主规格严格验证 | 通过 |

临时样例及 JSON 结果保存在 `/tmp/scholoom-schema-validation-kRHxLG/`，不属于项目的活动变更；临时证据可能随系统清理而消失，本文件保存结论。项目 `openspec list --json` 仍返回空活动变更。未新增长期文本断言测试。

## 独立检查与处理

MiniMax-M3.1-Flash-Preview 子 Agent 只读核对现有 fast-forward、continue、apply 与 archive Skills。发现通用 continue 会在规划末尾选择 ready 的 delivery；项目 AGENTS 与 schema 使用约定已给出明确阶段优先级和首次规划、实际交付、中途续做三个分支，子 Agent 再次核对确认指引矛盾已消除。另保留官方 proposal 的 Why／What Changes 标题，实际 show 与归档已通过。

## 结论边界

这些结果证明 schema 结构、模板解析、CLI 状态及临时归档接线可用。没有真实编码 Agent 的长会话实验，也没有 Scholoom 业务实现、UI、模型调用或科研效果验收。

CLI 仍按文件存在／checkbox 计数；delivery 的生成时机及报告真实性靠 Agent 遵循项目指引和核对实际证据。中途交接可令 isPlanningComplete 为 true，即使任务仍未完成；该标志不能单独判断交付。此次未安装依赖、启动服务、提交代码或操作实际研究数据。
