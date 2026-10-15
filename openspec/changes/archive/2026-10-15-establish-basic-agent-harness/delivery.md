# 实际交付与交接

## 当前状态与成果

约定范围实施与必要验证已完成，任务状态见 [tasks.md](tasks.md)。用户已授权实施、必需依赖与隔离合成样本的真实模型调用；没有执行 Git 提交、归档或发布。原有 AGENTS.md 改动和参考 PDF 保留。

已核对 [design.md](design.md) 的模块图与执行时序：Workbench 和 CLI 经共同客户端进入认证 RPC，内置 Deep Agents／LangGraph 使用共同项目文件模块，MiniMax 请求经共同 fetch 调度，领域数据与官方 checkpoint 分库。

| 完成判据 | 实际成果与入口 |
| --- | --- |
| 配置与项目授权 | 工作台“模型设置”“打开项目”“项目权限与备份”；MiniMax M Plan 中国区固定端点与模型，保存凭据优先于环境注入 |
| 安全读取与修改 | 真实 CodeMirror 文件页、整份内容依据、冲突保留草稿、新建防覆盖、差异、有限历史与安全撤销；GUI 与 Agent 共用 ProjectStore |
| 持久单 Agent | 会话、指令身份、执行、流式消息、实际材料与成果；执行中追加先落盘，CLI 查询同一状态 |
| 中止与恢复 | 取消后保留成果与未完成指令，关窗／刷新不取消；重启不自动恢复，显式继续核对 checkpoint，损坏时保留旧记录并开启新尝试 |
| 部分登记与备份 | 文件保存后的待登记收据可跨重启核查补齐；五分钟变化检查、十份备份、独立身份的恢复副本 |
| 草稿保护 | 按配置及对象隔离草稿；旧回执不覆盖后续编辑，旧会话失败不污染新会话，存储写入失败优先使用本页最新值；未确认指令保留原身份并提供显式补交 |

源码入口为 [KernelApplication](../../../apps/kernel/src/application.ts)、[Harness](../../../apps/kernel/src/harness/runtime.ts)、[ProjectStore](../../../apps/kernel/src/projects/store.ts)、[业务协议](../../../packages/protocol/src/business.ts)、[business-session](../../../apps/desktop/src/renderer/src/workbench/business-session.tsx) 与 [project-ui](../../../apps/desktop/src/renderer/src/workbench/project-ui.tsx)。运行和使用方式集中在 [开发说明](../../../docs/development.md)，路线图和初设索引已引用本变更。

## 实际验证

环境：Linux、Node 24.12.0、pnpm 11.10.0。内部图、工具、共同客户端、WebSocket、数据库及文件均使用真实接线。自动测试的模型替身位于 loopback Anthropic HTTP 边界；UI 的延迟回执夹具仅控制传输，不另写领域实现。

| 命令／检查 | 结果与覆盖边界 |
| --- | --- |
| `pnpm lint` | 通过，81 个文件；格式修改通过 stdin 生成补丁并使用 apply_patch 应用 |
| `pnpm typecheck` | 通过，包含共享包、内核、双宿主 renderer 与 tests/tools |
| `pnpm build` | 通过；内核产物包含 SQLite migrations，可脱离 src 加载 |
| `pnpm peers check` | 通过；CodeMirror state 统一版本，避免重复实例导致扩展加载失败 |
| `pnpm test:kernel` | 35 通过、1 默认跳过；涵盖原有生命周期／客户端、文件／凭据、真实图工具循环、签名保留、取消／接续、模型重试与成果登记故障 |
| 文件模块修改后的定向复验 | 4 通过；另覆盖读取大 UTF-8 文件时不切坏多字节字符，截断内容不能取得整份保存依据 |
| `pnpm test:smoke` | 4 通过；独立 Node、真实 Electron preload、关窗后内核继续及兼容宿主入口 |
| `pnpm test:ui` | 全量 35 通过、1 跳过；共享静态安全检查只在浏览器执行一次。覆盖真实文件／模型工具路径、保存中的后续编辑、延迟发送失败、会话与草稿隔离、配额回退、运行中刷新、取消与接续、未确认指令补交，以及既有生命周期和样例回归 |
| `pnpm exec playwright test --config playwright.ui.config.ts tests/ui/harness.spec.ts` | 末次 pending 发送保护改动后 6 通过；浏览器和 Electron 均核对原身份补交、新草稿保留及前述核心路径，随后未再修改源码 |
| `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:kernel tests/kernel/minimax-live.spec.ts` | 已单独通过一次，约 5.8 秒；经公开客户端让真实 MiniMax 读取隔离的 2／4／6 合成输入，保存 result.md，核对合计 12、均值 4 与成果登记。没有输出密钥，也没有为最终回归重复付费调用 |
| 长历史与持续流式检查 | 2 通过；2,400 条持久消息中完整分页读取目标会话的 1,200 条，实跑约 187 ms；持续输出期间可以查询、创建会话并取消，已收到前缀保留。仅为本机诊断样本，无跨平台性能承诺 |

UI 截图位于 `test-results/ui/harness-user-configures-ed-40e23-real-persisted-Agent-result-{ui-browser,ui-electron}/harness-result.png`，已查看浏览器截图。测试结果和 trace 由各 Playwright suite 写入隔离结果目录；成功结果可能在下一次运行时替换。真实模型样本仅验证接线和可判定计算，不构成科研效果验收。

## 审查与问题处理

两次只读独立审查直接核对规格与代码，辅助实现者仅补充限定范围测试，最终接线与验收由主 Agent 负责。

- 修复 checkpoint fallback 只取最近历史而丢失未完成要求的问题：交付游标区分已完成推进，恢复时重新列入未完成指令；40 条追加指令回归通过。
- 备份清单移入私有目录，保护用户 manifest.json；外部内容变化纳入自动备份检查；恢复副本不覆盖原项目且重新授权。
- 成果登记失败保存待核查收据，重启后仍可发现；SQLite trigger 故障注入验证文件保留、显式补齐与去重。图推进完成和成果登记状态分别呈现，不把 unknown 关联显示为已登记。
- 修复执行中发送被组件默认规则禁用、旧查询失败覆盖新选择、保存回执覆盖后续编辑、旧发送失败恢复到错误会话、历史分页串会话和本地存储回退读到旧值。
- 修复发送等待期间刷新后的恢复入口：持久 pending 保存原身份，核对已有消息或显式补交；当前会话尚未核清 pending 时保留可编辑草稿，等待核清后再发送新指令，避免覆盖原记录。新增测试核对未确认输入不丢失，补交不自行生成不同指令身份，也不清除随后编写的新草稿。末次只读复核确认上述触发链已封堵。
- CodeMirror 重复 state 实例、assistant-ui 消息角色字段不兼容和旧的“默认始终禁止发送”断言在实际双宿主运行中暴露，已修复；曾失败的用例保留于测试源码并复跑。新增文件草稿测试明确从文件树重新打开文件，不把 tab 持久化作为契约。

## 未完成事项与下一步

本变更没有剩余实施任务；末次只读复核与相关运行检查已完成。后续可沿路线图讨论 P3d 或文献能力，不将其纳入当前交付。现有驻留内核需重启才能加载更新，本轮没有停止用户原有开发实例。

本轮不包含 P3d 方法／能力调用、shell、插件 MCP、多 Agent、三平台分发或完整科研质量验收。当前普通文本整份编辑上限 256 KiB，行差异超过 400 行显示整段对照；新建文件需要父目录已存在。备份只包含声明范围内的普通材料，不承诺数据库和外部文件间的全局瞬时一致。主密钥同机自动解锁不抵御同权限进程；取消确认本地停止，不保证远端停止计费。
