# 实际交付与交接

## 当前状态与成果

本变更实施与定向验收完成，[tasks](tasks.md) 六项完成。用户已确认方案并明确授权“Implement the plan.”；未提交代码、切换分支、归档或发布。

已接入共同 protocol → broker/Manual → projects 的文件传输、分块导入、目录版本分页和范围监听。工作台复用 Headless Tree 1.8.0、共享菜单和窗口化，删除旧树的常驻表单；提供多选、行内创建改名、键盘、剪贴板、拖拽、系统导入、冲突处理与回收恢复。tab 的临时打开、编辑固定、稳定身份、活动组及项目布局恢复已经接线。

实际调用边界与状态路径沿 [design 的组件图和时序图](design.md)、[传输规格状态图](specs/project-files/spec.md)；传输日志使用既有 meta，无物理 schema 迁移。工作台及内核共用生产组件和真实文件能力；仅测试外部模型、目录选择原生对话框和指定故障边界使用受控替身。

## 实际验证

环境：本机 Linux x64，Node v24.12.0；具体依赖以锁文件为准。测试使用隔离配置和合成项目、二进制及模型响应，未使用真实科研资料或真实模型凭据。

- `pnpm test:kernel tests/kernel/file-transfers.spec.ts tests/kernel/file-watch.spec.ts tests/kernel/tab-state.spec.ts tests/kernel/project-files.spec.ts tests/kernel/manual-application.spec.ts tests/kernel/rpc.spec.ts --output test-results/file-explorer-kernel-final`：六个套件共 42 项通过（11.3 s），覆盖目录后代变化、空目录临界区、并发受理/导入、原操作回执丢失、关闭重开、恢复副本隔离及旧文件保护；包含替换回收丢回执后的查询、临时查询失败及取消恢复。
- 文件相关的六个场景已在 Browser/Electron 分次完成，共 12 项通过：临时 tab/编辑固定/名称定位/F2/多选复制，二进制及目录导入/拖拽，外部原子替换的自动刷新，跨项目键盘剪切/确认替换/原目标恢复，万行窗口化与负载响应，以及长稿/分栏/目录改名/回收恢复/项目切回。最后的 Browser 万行命令为 `pnpm test:ui tests/ui/file-explorer.spec.ts --project ui-browser --grep 'ten thousand' --output test-results/file-explorer-browser-focus-final`（1 通过）；名称定位在 `--grep 'file tabs' --output test-results/file-explorer-keyboard-final` 通过。最后的 Electron 命令为 `pnpm test:ui tests/ui/file-explorer.spec.ts tests/ui/file-workbench.spec.ts --project ui-electron --grep 'file tabs|keyboard cut|ten thousand|project files' --output test-results/file-explorer-electron-final`（4 通过）。其余场景结果在 `test-results/file-explorer-verified`，Browser 跨项目修正轮询后在 `test-results/file-explorer-browser-final` 通过。
- 先前扩展双宿主回归执行 66 项：60 通过、1 个仅浏览器场景按配置跳过、2 项现有文献库入口失败，另 3 项 Electron 文件场景的失败随后修复并经上述定向验收通过。扩展覆盖会话、harness、工作台布局/重连以及共享虚拟列表的调用方；文献库旧入口失败前未进入列表，不能声称其交互已验收。
- `pnpm -r typecheck && pnpm exec tsc --noEmit -p tsconfig.tools.json` 通过；`pnpm check:architecture` 无发现；`pnpm build` 通过。最后的视窗聚焦优化后全构建通过，回收查询判断收紧后 projects 构建及全项目类型检查通过。
- `openspec validate add-workspace-file-explorer --strict`、`git diff --check` 通过。
- `pnpm lint`：文献库 21 项现有错误（可访问性、导入顺序及格式），涉及 CatalogItemRow、CatalogItemSidenav、CollectionFilter、LibraryToolbar、MetadataSection 和 library.css。这六个文件逐字与 HEAD 一致；本次 34 个改动代码/样式/配置文件的 Biome 检查通过，0 错误、57 警告，未压制规则。
- 扩展 `tests/ui/library.spec.ts` 在寻找已不存在的“文献库授权与备份”入口时超时，未进入列表行为。LibraryTab 与该测试均与 HEAD 一致，属于现有入口漂移。

构建与 UI 必须顺序运行：曾因同步构建触发 Vite 热刷新导致验收组件重置；此轮结果作废，已分开重跑。早期新增断言曾误把异步受理当作同步拒绝，已按“最终 partial、源保留、目标不存在”的行为修正并通过。

万行性能样本：同机 Intel Xeon E5-2697A v4 @ 2.60 GHz，物理内存 135040929792 B；10000 个已加载文件行，32 MiB 二进制上传，模型边界提供连续合成流。每个宿主采样 60 次方向键到实际 DOM 焦点移动的延迟，P95 门槛为 100 ms；不代表初次目录加载、模型总耗时或三平台分发性能。

| 宿主 | P95 | 上传期间样本 | 同时 Agent 执行中样本 | 初始/采样后 DOM 行数 |
| --- | ---: | ---: | ---: | ---: |
| Browser | 82.4 ms | 60/60 | 60/60 | 26/31 |
| Electron | 99.4 ms | 60/60 | 39/60 | 30/34 |

原始分布与硬件字段分别保留在 `test-results/file-explorer-browser-focus-final/file-explorer-ten-thousand-68f53-ile-binary-import-is-active-ui-browser/file-tree-performance.json` 和 `test-results/file-explorer-electron-final/file-explorer-ten-thousand-68f53-ile-binary-import-is-active-ui-electron/file-tree-performance.json`。

中间失败均保留 trace：替换后的短暂缺失改为轮询等待文件出现；原生文件选择通过 filechooser 事件接管，32 MiB 载荷通过真实文件路径输入；已展开的权限分组按可见性展开。一次页面启动遇到 Chromium `ERR_NETWORK_CHANGED`，重跑通过。焦点与性能失败的产品修正见下节。已知前置步骤有误的一轮运行由本轮拥有的 Playwright 进程接收 SIGINT 后收尾，不计为验收通过。

## 审查与问题处理

已进行三轮辅助 Agent 独立只读数据保护审查及一次范围限定的树诊断，主 Agent 负责修复及整合验收：

- 恢复副本不得承接原传输日志；恢复时清除传输 meta，备份说明排除在途暂存。
- 替换确认及跨项目源回收的目录后代变化，均在结构临界区用快照重新核对。
- 同一操作身份不同参数的并发受理、导入 chunk 与 finish 并发使用共同任务锁。
- 发布结果或源回收回执丢失时核查原身份、位置和回执，不重放副作用。未受理的源清理以 partial 收束；仍无法确认的结果保留 unknown。
- 替换回收的回执丢失时查询已保存的原回收操作，补齐可恢复的 trashId。候选缺失且发布操作 notFound 才收束部分失败，查询暂时不可用仍为 unknown；取消也先保留未知核查依据。第三轮审查指出“任意查询错误不能当作 notFound”，已修正并通过两个故障用例和复核。
- 同项目合并后的空目录回收使用仅根目录的期望快照，阻止检查后新增文件被带走；第二轮审查无阻塞发现，对应回归已通过。
- 原项目恢复分栏时先同步当前组引用，再消费打开文件事件，防止旧组覆盖恢复布局；长稿项目切换回归已通过。
- Electron 中新建文件后，原树行异步聚焦会打断正在输入的多行内容；创建文件不再调回树焦点，永久打开由编辑器接收焦点。原长稿回归修复后通过。
- 树容器聚焦时原本再发起一次异步聚焦，与紧接的 End 聚焦互相覆盖。200 项探针确认所有行已在缓存，问题在晚到焦点；改为同步聚焦已挂载的可见行，并防止已处理快捷键再触发默认浏览器动作。200 项复现通过，正式万行场景承担回归；临时探针/诊断测试已移除。
- 原实现每次方向键把目标行推到视窗顶部，并等待通用 DOM 聚焦轮询；上传与流式输出并行时测得 Browser/Electron P95 114.4/130.3 ms。已改为越出视窗才滚动，聚焦只查询当前树视窗内的有限行；未挂载行的等待有时限，新聚焦和卸载取消旧请求，名称定位也复用该路径。树挂载回调保持稳定，避免随渲染重复解绑键盘监听。
- 优化后的双宿主原万行场景均通过；指标、并行样本数量及实际测量范围见上表。

## 未完成事项与下一步

本变更没有剩余实施任务。归档与提交由后续明确指令触发；现有文献库 lint 和旧 UI 测试入口需在对应变更中处理，本次未扩大修改范围。

范围边界：仅本机 Linux 双宿主验证；未验证 Windows/macOS 分发包、远端 SSH 或真实科研模型质量。文件系统监听只提供线索，仍不承诺外部进程互斥或跨文件事务。现有文献库 lint 与旧测试入口问题需独立处理。
