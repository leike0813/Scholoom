# 实际交付与交接

## 当前状态与成果

2026-10-22，公共契约基线交接，实施范围为 tasks 的 1.1 与 0.1。用户确认按资源声明、执行及工作台声明、dev 基线的顺序推进至三个 change 可以并行。主体功能仍未交付，不能归档。

共同基线包含工作域 1.1、资源 1.1／执行 0.1、工作台 1.1，产品协议版本为 4。当前只有主工作树 dev；没有需要同步的既有开发工作树，后续开发线从包含本记录的共同基线提交创建。具体启动与局部等待条件见[公共规划](../../../.scratch/domain-development/public-foundation-plan.md)，本轮没有启动三个主体实现或七域开发。

- [resources.ts](../../../packages/protocol/src/resources.ts) 定义 ResourceEvidence、ExecutionResourcePort、创建／查询及保存／关联分别结果。complete 创建结果要求真实项目资源，unknown／prepared 保留 operationId；原附件权限和 ResourcePort 保存形状不变。
- [graph-contracts.ts](../../../packages/protocol/src/graph-contracts.ts) 定义图注册元信息、选择、持久版本／状态格式／checkpoint 绑定、等待、resume 与图推进结果。输入、实际读取、实际保存和创建回执分别表达，未取得资源身份的未知创建仍能带原操作依据。
- [execution-graph.ts](../../../packages/protocol/src/execution-graph.ts) 保留默认 Agent 初始化，增加无模型或带模型的 registered 初始化及结构化指令；[execution-contracts.ts](../../../packages/protocol/src/execution-contracts.ts) 同源引用资源操作供未来 worker 接线，派生映射均由原生成入口维护。
- [platform.ts](../../../packages/protocol/src/platform.ts) 声明宿主内部命令窄端口，复用 editor 的参数、输出及等待限制，不接受原生路径或自报主体。
- 未接线能力明确失败：成果创建／查询、registered 图、resume 和新上下文不静默降为旧执行。现有普通会话、实际 IPC、资源及人工组合继续通过回归。

design 总览图仍表达目标模块接线，当前交付的是共同声明和未接线保护。实际创建收据持久化、图运行／恢复及命令提供者均在原后续任务中完成。

## 实际验证

环境：Linux，Node v24.12.0、pnpm 11.10.0，使用已有依赖。没有安装依赖、启动开发服务器或使用真实模型凭据。测试使用原隔离配置和受控模型。

| 验证入口 | 结果与范围 |
| --- | --- |
| `pnpm generate:contracts` | 产生 patch，经 apply_patch 接入；对输出按既有 Biome 格式化后核对，派生映射与声明一致 |
| `pnpm check:architecture` | 13 模块、186 源文件，0 findings、0 exceptions |
| `pnpm typecheck` | 全仓通过，包括共享构建、各包及 tools／类型反例 |
| `pnpm build` | 完整构建通过，含桌面与兼容宿主；日志保留既有兼容宿主缺少 preload 配置提示 |
| `pnpm test:kernel tests/kernel/public-contract-baseline.spec.ts tests/kernel/platform-command-contracts.spec.ts tests/kernel/work-domain-contracts.spec.ts tests/kernel/broker.spec.ts tests/kernel/sessions.spec.ts tests/kernel/harness-module.spec.ts tests/kernel/research-module.spec.ts tests/kernel/resource-access.spec.ts tests/kernel/execution-isolation.spec.ts` | 33/33 通过，约 1.3 分钟；真实内部模块／IPC，外部模型为受控响应 |
| `pnpm exec playwright test tests/smoke/entrypoints.spec.ts` | 4/4 通过，33.3 秒；独立 Node、真实 Electron／preload、窗口重连和兼容宿主 |
| 模型字段修正后的定向内核复验 | 契约、历史消息、未接线能力及真实 worker IPC 均通过；有模型的 registered 请求也不会进入默认 Agent |
| `pnpm exec biome check` 本轮源码／测试、`git diff --check`、OpenSpec strict | 通过 |

入口冒烟直接运行既有 Playwright，未调用会安装 Electron 的 setup 脚本。未运行全部 UI 用例、真实科研 Graph／模型验收、目标只读权限实测或三平台包验收；Mermaid 未渲染。

## 审查与问题处理

独立 Agent 发现 registered 初始化缺少可选模型，已添加同源 ModelDescriptor、受控 checkpointPath 并保留无模型分支；worker 拒绝逻辑按 graph 判别，新增两类输入及真实 IPC 用例，复核关闭原问题。声明拆分修正了架构守卫发现的循环引用，没有增加例外；类型测试中的字面量推断问题也已修复。

主线核对未知创建回执保留及 UTF-16／UTF-8 容量差异，补齐声明和回归用例。运行时仍须校验注册配置、图版本／状态格式、权限、waitId／指令归属、checkpoint 消费及已受理操作效果，当前类型不代表这些保护已接线。

## 未完成事项与下一步

本 change 可按公共规划独立推进图 driver、注册适配、命令机制和隔离夹具。资源实际接线 1.2、完整图 2.4 与命令授权验收 3.3 等待工作域相应能力；修改项目新建分支 1.4 前同步工作域 1.2 的 store/files 增量。2.2 与 4.1 分别独立交接给工作台线，避免重复修改公共块。

每项真正接线后再移除对应 unavailable 保护并验证；不得先删除保护，让新输入在旧路径中被忽略。任务进度仅在 tasks.md，最终交付记录任务仍待整个 change 的实际完成判据及验收。
