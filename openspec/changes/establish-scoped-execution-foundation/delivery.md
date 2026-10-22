# 实际交付与交接

## 当前状态与成果

2026-10-22，共同契约基线交接。用户先要求只实施本变更 1.1，随后确认继续补齐另外两线共同契约并接入 dev，推进至三个 change 可以并行。1.1 的声明、生成、兼容检查及共同基线现已齐备；真实只读能力尚未接线，本 change 不能归档。当前只有主工作树，后续开发树从包含本记录的共同基线提交创建，不需要对不存在的开发树执行同步。

- [work-domains.ts](../../../packages/protocol/src/work-domains.ts) 声明固定 application／project 工作域、只读目标范围和 `project.readTarget` 四类请求／结果；复用现有文件身份、内容依据、分页和二进制读取上限。
- [core.ts](../../../packages/protocol/src/core.ts) 为宿主上下文增加可选 workDomain／targetRead；[projects.ts](../../../packages/protocol/src/projects.ts) 导出 schema、派生输入输出和独立窄端口。[生成脚本](../../../packages/protocol/scripts/contract-types.mjs) 接入 [project-target-read-types.ts](../../../packages/protocol/src/project-target-read-types.ts)，不增加另一份手写载荷类型。
- [类型反例](../../../tests/types/contracts.ts) 检查判别载荷、提供者结果、禁止写权限及产品／原文件端口之外的调用；[契约测试](../../../tests/kernel/work-domain-contracts.spec.ts) 实跑 schema 和真实 broker，覆盖固定身份、边界容量、缺少 basis、任意路径／伪造来源载荷及未注册提供者不可用。

设计中的模块总览图仍为目标接线图；当前只有契约和测试完成，宿主、项目只读实现及 harness 工具均沿原代码。project.readTarget 未加入产品 businessSchemas，也未修改 architecture 的 provides／consumes 或数据库。产品协议已由工作台共同契约统一升至 4，后续基线验证见[领域交接记录](../establish-domain-execution-handoffs/delivery.md#实际验证)。

## 实际验证

环境为 Linux，Node v24.12.0、pnpm 11.10.0；使用已有依赖，未安装或升级。结果来自本轮命令输出，Playwright 使用既有内核配置和隔离夹具。

| 命令或核对 | 结果与证据边界 |
| --- | --- |
| `pnpm generate:contracts` | 成功产生 patch；通过 apply_patch 只接入本次目标读取类型映射。原有生成文件的格式差异未扩散修改 |
| 生成结果格式化后与新映射逐字比较；`node packages/protocol/scripts/contract-types.mjs --self-test` | 通过，核对生成入口与目标文件一致；未增加新的生成算法 |
| `pnpm --filter @scholoom/protocol build` | 通过 |
| `pnpm check:architecture` | 13 模块、181 源文件，0 findings、0 exceptions |
| `pnpm typecheck` | 最终全仓通过；命令包含共享包构建、各包类型检查和 tools／测试类型检查 |
| `pnpm test:kernel tests/kernel/work-domain-contracts.spec.ts tests/kernel/broker.spec.ts tests/kernel/sessions.spec.ts` | 15/15 通过，25.0 秒；使用真实 schema／broker，既有会话测试沿受控模型和隔离数据路径，不是跨项目只读实际交付验收 |
| `pnpm exec biome check`，范围为本轮 7 个源码／测试文件 | 通过，无自动写入 |
| `git diff --check` | 通过 |

首次类型检查发现新增反例的 `@ts-expect-error` 行号与实际字段诊断不对应，且泛型调用不保证拒绝所有额外字段；已将字段反例放在明确 DTO 赋值中、调整注释位置，并保留运行时 schema 对额外字段的拒绝测试。修正后 tools 类型检查及整条 `pnpm typecheck` 均通过。

首轮声明验证未运行 UI；后续共同基线补跑完整构建与 4 项真实入口冒烟，包含 Electron，见领域交接记录。真实模型、目标项目零修改验收、撤权竞态和三平台验证仍未运行。Mermaid 图未渲染。

## 审查与问题处理

scout 只读核对声明、生成入口、现有测试及宿主装配，未发现遗漏的声明侧映射。真实 `applicationSchemas` 汇总、提供者及消费范围注册属于 1.3，当前不接入。首轮独立审查核对 7 个源码／测试文件及 specs／design，未发现阻塞问题。其后共同基线核对与跨变更审查见领域交接记录；声明不构成运行时授权保证。

类型中的普通 projectId 仍是 string；排除固定 application 身份由同源 JSON Schema 的 `not` 检查和运行时测试保证。后续宿主必须实际执行 schema 校验、核对可信身份，不得将 TypeScript 形状或 optional 上下文字段当作授权证明。

## 未完成事项与下一步

1. 共同契约入口齐备，后续从共同基线 dev 创建工作树，按[公共基础实施规划](../../../.scratch/domain-development/public-foundation-plan.md)开始独立实现；已有开发树才需同步。
2. 本变更下一步为 1.2 的只读范围和已登记身份读取，随后 1.3 宿主接线。向领域交接线提供 store/files 增量前运行对应权限与目标零修改测试。
3. 真实接线时沿现有 `RuntimeIdentity` 验证有效实例；为 workDomain／targetRead 绑定和快照可信字段、检查与原 projectId／sessionId 一致，保持异步父范围只能收紧。只读实现不得复用会产生身份登记、缓存或内存保存依据的原读取路径。
4. 续做先读本记录和当前 tasks，再取 `openspec instructions apply --change establish-scoped-execution-foundation --json`。最终交付记录任务 3.5 仍待完整 change 验收。
