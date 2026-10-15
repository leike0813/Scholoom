# 实际交付与交接

## 当前状态与成果

内核、协议和工作台附件路径已完成交付，[tasks](tasks.md) 全部完成。本轮接续题录库，覆盖 P4a 本地材料摄取、托管/外链及人工重定位，格式解析与阅读沿 P4b。

- 共同库按持久批次摄取本机文件，可添加到既有题录或生成明确待核对的文件名候选。附件、材料版本、来源身份与路径分开，多附件标明用途；同来源/用途/方式的相同内容可复用。题录和文件共用批次协调、授权、逐项事务及通知。
- 默认托管原字节并保留输入；外链不复制原文件。状态只检查当前页，实际读取核对材料版本并分段返回；人工重定位仅接受同内容，其他材料不受单项失效影响。完整暂存有持久完成依据，中断后不以变化后的原输入替换预留版本。
- 共同 RPC 和 Agent 调同一 Catalog。Agent 文件路径由当前项目根与读取授权解析，批次保存项目归属，异步准备/发布及重启接续仍检查；引用读取与模型请求重新核对读取/外发权限，不开放任意路径工具。
- 新备份包括数据库快照引用的托管材料，外链和缺失有清单。恢复副本独立身份、写入/外发关闭，托管位置由副本目录计算，中途失败也不回读原库。v1 迁移事务清除旧 write/send，保留迁移前副本；旧题录备份可独立恢复。
- 真实文献库 tab 增加本机路径表单、用途和方式、附件分页、下载及人工重定位，保留题录和指令草稿。授权文案扩大为“发送文献材料到模型”；附件登记、实际状态及分析未生成分别呈现。

[design](design.md) 模块图和时序与实际接线一致；发布依据、托管路径计算及迁移授权事务的实际变化已写回设计。未引入原生文件桥、依赖或旧宿主实现。

## 实际验证

Linux、Node 24.12.0、pnpm 11.10.0；均为隔离配置与合成文件，无真实用户材料或外部供应商调用。

| 命令或入口 | 当前实际结果 |
| --- | --- |
| 首条 Catalog 原字节测试 | 先失败于缺少 importFiles，再实现通过；后续从公共 interface 检查实际字节和身份。 |
| `pnpm typecheck` | 全仓通过，日志 `/tmp/scholoom-attachment-typecheck.log`。 |
| `pnpm test:kernel` | 81 通过、1 项真实模型按开关跳过，日志 `/tmp/scholoom-attachment-kernel.log`。 |
| `pnpm exec playwright test --config playwright.kernel.config.ts tests/kernel/literature-attachments.spec.ts tests/kernel/literature-attachment-integration.spec.ts` | 9 项通过：托管与分段、外链/内容缓存/同内容复用、异步读取撤权、备份副本字节、v1 迁移与旧回执、SIGKILL后100项接续、准备期间项目撤权和重启、完整暂存发布前SIGKILL、失败恢复副本隔离。 |
| 上述两文件加 `literature-catalog.spec.ts`、`literature-integration.spec.ts` | 最终 16 项通过，日志 `/tmp/scholoom-attachment-related.log`。 |
| `... literature-attachments.spec.ts -g 'v1 migration'` | 新增 legacy catalog-database 备份恢复及迁移清 write/send 后补跑通过。 |
| `pnpm lint`、`pnpm typecheck`、`pnpm build` | 最终全仓全部通过，lint 120 个文件无诊断；类型检查和构建日志 `/tmp/scholoom-attachment-typecheck.log`、`/tmp/scholoom-attachment-build.log`。 |
| `xvfb-run -a pnpm exec playwright test --config playwright.config.ts` | 4 项 smoke 通过，含真实 Electron preload、关窗保留内核、重开及隐藏宿主。 |
| `xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/attachments.spec.ts` | 4 项双宿主通过，包含跨分段下载字节核对和外链失效/重定位。Electron 使用真实 session will-download 设置隔离保存位置并等待 completed，浏览器使用实际下载事件；均从 UI 点击开始并核对落盘字节。 |
| `... tests/ui/attachments.spec.ts tests/ui/library.spec.ts` | 最后合并回归 6 项通过，日志 `/tmp/scholoom-attachment-ui.log`。 |
| `... tests/ui/attachments.spec.ts -g '用户摄取本机材料'` | 再补缺失路径的文件批次用例，两种宿主均显示失败文件名并下载成功材料，2 项通过，日志 `/tmp/scholoom-attachment-partial-ui.log`；之后 lint/工具类型检查通过。 |
| `openspec validate --specs` | 10 项正式规格通过；3 份 delta 同步后逐条比对，既有 Purpose 和未涉及条款保留。 |

模型整合仅替换外部 HTTP 响应，实际图、工具、WebSocket、文件及 SQLite 均真实；测试核对模型收到的 base64 是独立合成输入，并检查撤权后 resume 不增加模型请求。崩溃测试使用真实子进程 SIGKILL；发布窗口通过子进程的 OS link 边界受控暂停，不替换库模块或伪造回执。迁移样本使用原 v1 SQL 和原格式记录，核对身份、授权及旧输入回放。

## 审查与问题处理

独立 Agent `01a140b1-5f94-7e92-8057-83a5905c5560` 发现并复核关闭三项 P2：版本号更新早于撤权、失败副本沿原库绝对路径读取、完整 pending 被新输入重定义。主线程对应补真实文件故障验证；独立探针使用内存文件系统及真实 SQLite，其范围不替代实文件结果。其余限定内核范围未发现 P1/P2，UI 由主线程验收。

主线程另收紧 v1 外发范围，清除旧 send 并改授权文案；下载必须核对实际文件字节，不接受只发出 RPC 为通过。托管发布后移除临时硬链接会改变 ctime，已在移除后记录文件依据；完整准备在普通 IO 失败时也保留，只有没有完成依据的部分副本才可重新准备。

UI 首轮测试的嵌套 locator 作用域不当已修正。真实 Electron 下载由测试夹具的 will-download 仅设置保存目的地，产品点击、分段读取和落盘均实际运行。下载 Blob 保留至换下载或卸载，迟到读取不能在切换条目后启动下载；来源切换重建附件面板，原题录和指令草稿保持独立。`test-results/ui/` 对应用例目录中的 `library-attachments.png` 和 `library-relocate.png` 已生成；浏览器附件截图已实际查看。图像证明功能可操作，不代表完整视觉设计或三平台验收。

## 未完成事项与下一步

本变更完成判据均有实际证据，规格已同步并核对；归档提交后按路线图进入 P4b 共用材料阅读。当前没有需要用户补充的阻塞；持续授权来自用户沿路线图逐步实施、归档和提交的目标。

本轮不含网络下载、解析、PDF/EPUB/网页阅读批注、科研分析、删除/合并或跨版本替换。首次本机路径输入未提供原生选文件器；单文件128MiB、每批100份、读取每段最多256KiB。外部编辑器不能被应用锁定，前后核对不承诺消除全部外部竞态；外链未纳入备份是明确依赖。未做真实供应商、科研充分性、长期大库负载或三平台分发验收。
