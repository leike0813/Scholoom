# 变更提议

## Why

项目已有共同受管命令、完整进程归属和人工排版能力，但命令结束时返回退出码与输出，尚不能让人和 Agent 按持久身份查询一次普通程序运行。科研计算还缺少明确的环境选择与准备授权、运行中有界日志、实际输出核查和重启后的诊断。本变更沿计算职责决定补齐这一有界闭环，复用公共基础，避免把 harness 执行记录或 editor 编译记录变成通用运行权威。

## What Changes

- 新增项目程序运行领域：环境选择／准备、幂等受理、后台执行、记录查询、有界日志、取消与重启核查；人和 Agent 复用同源操作。
- 首批支持宿主登记的 Node、用户显式登记的已有 Python／Conda 解释器，以及用已有 uv、已有 Python 和项目锁定声明准备的受管 Python 环境。工具缺失明确不可用；不自动下载解释器、不修改用户已有环境。
- 复用 `ManagedCommands`、`ManagedNode`、`ProcessAdmission`；只补运行中观察、长运行时限和持久归属所需机制，保留原 editor 命令结果及输出限制。
- 项目运行 tab 提供配置、状态、日志和实际输出打开；人工路径不加载 harness、会话或模型，Agent 工具使用相同运行事实。
- 首次增量以固定 Node 程序读取合成输入、生成真实 CSV 结果表校准 I4；Python 环境准备另有隔离验收。
- 不建设终端／Notebook、远端执行、任意程序依赖推断、强沙箱或科研质量判断；不迁移 editor 的排版快照、缓存或最后成功预览。

## 完成判据

2026-10-30用户确认采用Linux阶段收口并授权按计划修订工件：以下判据按Linux Browser＋真实Electron最终核对；Windows程序业务／平台整组及实际分发未交付，TeX／分发和旧CI唯一因果责任沿本change的[tasks后续责任](tasks.md#后续责任不计本阶段复选框)保留。macOS沿既定人工能力／受管执行不可用，公网registry下载仍未实跑。5.2／6.2保持未完成；环境授权与保护、身份、产物、取消／恢复、完整停止及unknown容量保证不变，不以Linux新正例补造旧失败因果。

1. 人工入口无会话／模型即可运行固定程序；Agent 能查询相同 programRunId、实际命令依据、日志和项目文件。
2. 已有环境复用、授权内准备、授权不足、工具／依赖不可用分别可诊断；准备不修改项目锁文件和用户现有环境。
3. 请求等待结束不终止受管计算；无日志不判断卡死；输出过量有界且明确截断。
4. 失败、取消或重启保留实际输出；只有完整归属收尾确认后才报告停止，不能凭根 PID 消失释放容量。重启不自动重跑，不声称支持任意程序重接或断点续算。
5. 输出按实际文件身份及依据经共同资源入口打开；部分结果、文件保存／登记及关联不完整均如实表达，不把退出成功等同于科研成果合格。
6. 本线独立内核验收和 I4 双宿主接线分别记录；既有相关 CI 失败有诊断证据，不通过放宽生产时限掩盖。

## Capabilities

### New Capabilities

- `project-program-runs`：项目程序环境与授权、共同运行事实、日志与等待、停止核查和实际输出。

本次不修改现有 capability：平台／工作域／共同资源的既有保证继续消费，新增运行行为由本 capability 持有。

## 决策与授权依据

- [计算职责 #06](../../../.scratch/domain-development/issues/06-managed-computation-scope.md#answer)、[环境与执行 #40](../../../.scratch/scholoom-foundations/issues/40-research-execution-environment.md#answer)、[进程 #03](../../../.scratch/runtime-architecture/issues/03-session-execution-processes.md#answer)。
- [七线计划](../../../.scratch/domain-development/parallel-development-plan.md)：本线负责运行环境、记录和 I4；项目提供文件权威，阅读交互提供共同视图，editor 保持专用状态。
- 2026-10-25 本轮用户授权：从 `e3d58fc807827a78493dcd16e38de28c8d02766e` 只读调查并完成 `scholoom-dev` 实施前工件，无需主 Agent 再次确认规划；仅可修改本线规划及必要调查依据。配置为 Codex／gpt-6.1-sol／high。
- 用户随后明确要求“实现该change”，并批准按锁定版本安装／链接依赖、隔离 uv 环境准备与双宿主测试所需临时 Vite／内核；人工逐次“移交后台”作为 Agent 程序的后台授权入口。实现和验证沿此授权，继续保持 Codex／gpt-6.1-sol／high。
- 未获真实用户库、其他工作树操作、提交推送、归档或 PR 授权。
- 阅读交互两个 design 在当前树尚不存在；其输入状态与接入限制见 investigation。它们不阻塞本线运行核心规划，不得据此宣称跨线设计已核对。
