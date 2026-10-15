# 实际交付与交接

## 当前状态与成果

题录闭环已完成交付，任务全部完成，见 [tasks](tasks.md)。本变更只交付路线图 P4a 的题录部分，附件由接续 P4a 变更承担。

- `LiteratureCatalog` 在独立 `library/library.sqlite` 保存库身份、题录、集合标签、版本关系、历史及批次。共同 RPC、Agent 工具和真实文献库 tab 使用同一权威，未把全局题录放入项目数据库。
- 手动建项、选择文件或粘贴 CSL JSON 共用逐项摄取。明确同 DOI/版本复用身份并填空，冲突和原输入可查；未知版本不自动合并。部分失败、中断与显式接续保留已确认结果。
- 更正检查原修订号，集合整理不复制条目。库变化只刷新当前有界查询。指令草稿、题录草稿及其原修订号跨条目切换和刷新保留；保存回执保护后续编辑并结算离屏草稿。
- 读取、写入和外发分别授权。会话使用库上下文后，每次模型请求及重试都检查有效库授权，重启后的旧 checkpoint 也不能绕过撤权。Agent 不获得库授权或任意本机文件路径入口。
- 手动与自动备份使用数据库备份接口，重启保留待备份状态；独立恢复不覆盖当前库，新库身份、关闭写入/外发，批次不自启。备份范围明确为题录数据库，不含附件。

[design](design.md) 的模块图和摄取时序图与实际接线一致；草稿时序、会话库上下文标记及备份修订号已补入设计。UI 交互沿 `docs/ui-design/README.md` 的本地题录库约定。

## 实际验证

本机 Linux、Node 24.12.0、pnpm 11.10.0，沿锁定依赖，无安装或升级。全部数据为隔离配置和合成题录，未操作真实用户库。

| 命令或操作 | 实际结果与边界 |
| --- | --- |
| `pnpm test:kernel` | 72 通过、1 跳过；真实 MiniMax 验证按开关跳过。 |
| 其中 `literature-catalog.spec.ts`、`literature-integration.spec.ts` | 7 项通过：同版本/冲突、权限中断与重启、集合/修订、独立恢复、重启自动备份、真实双 WebSocket 客户端和受控模型外发、SIGKILL 后 1000 项批次只接续 pending。 |
| `pnpm lint`、`pnpm typecheck` | 全仓通过。最后仅 UI 按钮状态补丁后补跑桌面 typecheck 与 `tsc --noEmit -p tsconfig.tools.json`，均通过。 |
| `pnpm build` | 全仓通过；最后 UI 补丁后桌面构建通过。日志 `/tmp/scholoom-catalog-build.log`、`/tmp/scholoom-catalog-desktop-build.log`，类型检查日志 `/tmp/scholoom-catalog-typecheck.log`。 |
| `xvfb-run -a pnpm exec playwright test --config playwright.config.ts` | 4 项 smoke 通过，含真实 Electron preload、关窗保留内核及重开连接。 |
| `xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/library.spec.ts` | 浏览器与 Electron 均通过；最后增加保存期间禁用重读断言后，纳入下述最终回归。 |
| `xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/library.spec.ts tests/ui/workbench.spec.ts tests/ui/conversation.spec.ts tests/ui/harness.spec.ts` | 49 通过、1 跳过，5.5 分钟；浏览器专用引导/静态凭据检查在 Electron 跳过，在浏览器通过。 |
| `openspec validate --specs` | 9 项正式规格通过；两份 delta 已逐一比对同步内容。 |

双宿主题录路径从真实菜单建项和导入，检查批次部分失败、实际持久题录、集合标签、独立恢复、连续保存、延迟回执期间编辑/切换及刷新旧草稿冲突。截图在 `test-results/ui/` 对应 `library-*` 用例目录的 `library-catalog.png`；浏览器浅色截图已实际查看。后端整合只替换外部模型响应，内核、工具、SQLite、文件、WebSocket 和进程终止均为真实接线。

## 审查与问题处理

独立审查 Agent `01a1407b-45b8-7090-aa3c-0883f41c8f8b` 核对身份、授权、恢复及 UI 草稿时序，所发现问题均修复并复核。重点修复库上下文撤权后的再次外发、恢复目录别名与备份重启状态，以及保存期间后续编辑、离屏草稿修订结算和显式重读。

UI 实跑还捕获了相同修订的详情重读覆盖新输入：已收紧为仅更新修订且无草稿时替换。同一保存等待期间禁用重复保存和显式重读，仍允许输入及切换条目。首轮相关 UI 测试曾失败；已修复根因，并将 textarea 断言改为实际 value，普通连续动作等待保存回执，延迟回执反例继续保留。独立复核无剩余 P1/P2。调试日志已移除。

扩大回归时，既有样例测试仍直接查找未打开的材料复选框而超时；按当前工作台交互补上点击“材料”tab（刷新后同样重新打开），不改产品逻辑。中断已知失败的整组运行后重跑同一选择范围，结果以上表最后记录为准。

## 未完成事项与下一步

本变更无附件、PDF/EPUB/网页解析、阅读批注、Digest、检索、合并或回收站实现；这些分别沿 P4a 接续、P4b/P4c/P4d 及后续路线。题录状态如实显示附件未取得、分析未生成。当前搜索为有界题名/DOI、集合和标签查询，不是全文或混合检索。

未运行真实供应商及科研质量验收、三平台分发包或长期大库负载；本机双宿主接线通过不能替代这些验收。备份只含题录数据库，恢复副本不自动继续批次；附件接入时须扩展备份范围及缺项说明。

持续授权来自用户“沿路线图逐步创建 change、实施、归档并提交”的目标。本次完成判据均已通过；归档提交后继续 P4a 本地材料与托管/外链附件变更，不需要用户重述范围。
