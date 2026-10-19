# 实际交付与交接

## 当前状态与成果

本 change 已完成实现及约定验收，任务以 [tasks](tasks.md) 为准；保留为活动变更，尚未同步正式规格、归档或提交代码。

已实现共同四项文档操作、PDF／文本位置联合、受管材料调度、EPUB 2／3 重排版与单文件 HTML 解析、资源和搜索、库记录校验及真实 Agent 工具。没有新增 SQL 表，PDF 既有位置保留。主 Agent 完成 DocumentReader、共享接口及整合，辅助 implementer 接通实际题录附件入口。删除不可达的旧 LibraryPanel，工作台直接装配 LibraryTab，并修正题录选择闭包。

实际接线与 [design 总览及调用时序](design.md) 一致：正文和安全节点共用规范化文字，密集结构可分段，textOnly 用于省略渲染节点及完整摘录核对。初设、路线图、开发、架构、UI 设计及第三方说明已同步。完成判据对应如下：

| proposal 判据 | 实际结果与证据 |
| --- | --- |
| 双宿主阅读与持久定位 | EPUB／HTML 从实际题录附件入口打开；章节、搜索、跨节点选区、图片、高亮、书签、关闭重开及会话草稿通过双宿主 UI，笔记与冲突沿共同记录回归 |
| 无窗口 Agent 共享正文和记录 | document-integration 经真实 client、WS、broker、harness 与受管进程读取第二章及用户记录，保存带可信 Agent 作者的说明 |
| 范围、权限、版本与恢复 | 文档／PDF 测试覆盖配额、恶意资源、取消、崩溃、撤权、UTF-16 区间、原字节保留、独立备份恢复；UI 核对迟到搜索回执及材料缺失后禁用定位 |
| 回归、静态检查与独立审查 | 以下实际验证及审查完成；全仓既存 lint 错误和未运行范围单列，不计作通过 |

## 实际验证

Linux、Node 24.12.0、pnpm 11.10.0、Electron 44.5.1，材料均为合成 EPUB／HTML／PDF。外部模型只替换 HTTP 供应商边界，不替换内部图、broker、文件和库。UI 使用隔离配置和 5174 服务，构建及依赖操作与 UI 运行分开。

| 命令／范围 | 结果 | 本机会话证据 |
| --- | --- | --- |
| `SCHOOLOOM_LIVE_MODEL_TEST=0 pnpm test:kernel --grep-invert 'Vite internal restart'` | 内核基线 215 通过、2 跳过；早于最后编码识别及错误分类修正，后续用聚焦用例复验 | `/tmp/scholoom-document-kernel-full.log` |
| `pnpm test:kernel tests/kernel/document-reading.spec.ts tests/kernel/pdf-reading.spec.ts --workers=1 --output /tmp/scholoom-document-final-kernel-results` | 审查修复后 18 通过，包含取消、容量、超时、分块和崩溃 | `/tmp/scholoom-document-kernel-after-review.log` |
| `pnpm test:kernel tests/kernel/document-parser.spec.ts tests/kernel/document-reading.spec.ts tests/kernel/literature-attachments.spec.ts --output /tmp/scholoom-document-parsers-final` | 编码声明、16章节搜索预算、密集结构分段、外部实体及材料边界等 17 通过；1 项旧附件断言失败，调整为共同 notFound 后该项单独通过 | `/tmp/scholoom-document-parsers-final.log`、`/tmp/scholoom-document-attachment-final.log` |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | 恢复无关依赖引用后通过；实际 @langchain/core 解析到原基线 langsmith 0.10.13、zod 4.6.5 | `/tmp/scholoom-document-frozen-install.log` |
| `SCHOOLOOM_LIVE_MODEL_TEST=0 pnpm test:kernel tests/kernel/document-integration.spec.ts tests/kernel/cli-runtime.spec.ts tests/kernel/research-capabilities.spec.ts` | 最终依赖图下 14 通过，含真实 CLI／Agent 接线及科研产物保存 | `/tmp/scholoom-document-restored-deps.log` |
| `xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/document-reading.spec.ts tests/ui/pdf-reading.spec.ts tests/ui/reading-records.spec.ts --workers=1 --output test-results/ui-document-complete` | 最终图片调度修复后双宿主 8 通过；已查看工具栏修正后 EPUB／HTML 截图 | `/tmp/scholoom-document-ui-complete.log`、`test-results/ui-document-complete/` |
| `pnpm typecheck`、`pnpm build` | 最终依赖图及 renderer 下全部通过 | `/tmp/scholoom-document-typecheck-complete.log`、`/tmp/scholoom-document-build-complete.log` |
| `xvfb-run -a pnpm exec playwright test tests/smoke/entrypoints.spec.ts` | 4 通过，含独立 CLI、真实 Electron preload、关窗重连及兼容宿主 | `/tmp/scholoom-document-entrypoints-complete.log` |
| `pnpm exec biome check <本次变更的源码、配置、测试和样式文件>` | 39 个文件全部通过；未执行自动改写 | 最终命令输出 |
| `pnpm exec biome check --reporter=json .` | 未通过：21 errors，均在未修改文件；另有15 warnings、31 infos | `/tmp/scholoom-document-lint-delivery.json` |
| `pnpm check:architecture`、`openspec validate extend-shared-epub-html-reading --strict`、`git diff --check` | 12模块、147文件、0 findings、0 exceptions；规格及 diff 检查通过 | 最终命令输出 |

全仓 lint 的错误文件为题录界面的 CatalogItemRow、CatalogItemSidenav、CollectionFilter、LibraryToolbar、MetadataSection 及 library.css，均未出现在本次修改清单。没有通过无关格式改写扩大范围。

曾误用不带文件筛选的 smoke 命令，进入开发生命周期专项并启动额外测试服务；发现后以 SIGINT 中止，保留为中断而非通过，专项 finally 完成回收，核对本轮进程及5315／9315相关命令均已退出。随后运行上表4项入口 smoke。中断日志为 `/tmp/scholoom-document-smoke-complete.log`。

## 审查与问题处理

独立后端审查发现并修复：emoji前零长度书签的单单元预算、可选图片坏路径阻断正文、大写DATA资源分支错误。独立前端审查又核出任意字符减法产生非法上一段、撤权后搜索回执、材料失效状态及多图容量；已改为实际片段历史、通知失效搜索代次、失效正文／附件状态及每批8张图片（其余显式选择、失败可重试）。

真实撤权回归暴露权限状态通知合并的窗口：仅等正文消失可能早于首次正文就绪，不能证明前端已观察撤权。测试改为等待明确未授权状态；库变化同时失效在途搜索，不让重新授权后的旧回执回写。材料缺失的原生 ENOENT 原先被解析调度归为 unavailable，现于共同材料读取端映射 notFound，旧恢复测试也改为核对共同语义码。

最后一轮 Electron HTML 恢复连续失败3次。临时 RPC 采集证实原因是关闭前已发出的7项图片仍占串行后端，恢复后的章节与正文等待超过5秒，并非授权状态未恢复。改为阅读器内串行发送图片，cleanup 跳过尚未发送任务；没有放宽测试超时。最终双宿主8项通过，额外独立只读复核确认卸载、撤权、重试、Blob URL 和迟到回执处理无遗留发现。已发送单项 RPC 仍沿共同截止时间收尾；每个 reader 最多保留一项在途图片，多个 reader 共用后端原有容量。

编码嗅探只从 XML declaration 或 parse5 解析的 meta 读取，不再将普通科研正文中的 charset 字样当成编码声明。依赖安装曾顺带改写 @langchain/core 的两项传递引用，已恢复原锁值，frozen 安装后确认实际解析版本，并完成14项相关接线回归。较早测试中错误使用 cleanup API、编辑中途文件尚未落盘导致的检查失败均已修复，不作为通过依据。

临时 RPC 采集代码已移除，诊断 trace 保留在忽略的 `test-results/ui-document-rpc/`；最终截图和测试产物同样只作验收工件，没有进入产品运行依赖。

## 未完成事项与下一步

约定实现范围无剩余任务。批准依赖及5174测试服务的授权沿 [proposal](proposal.md)，没有提交、切分支或发布。后续若要同步正式规格和归档，继续使用本 change 的官方工作流。

全仓既存 lint 错误尚未处理。Vite internal restart 专项未完成运行；内核基线的2个跳过分别是真实供应商模型和 Windows ACL 用例。未进行真实模型科研质量验收、macOS／Windows 或三平台实际分发包验收。本次结果只覆盖 Linux 本地接线、合成材料及受控外部模型边界。在线抓取、网页配套目录、固定版式、DRM、原书样式及跨版本自动定位继续按既定范围排除。
