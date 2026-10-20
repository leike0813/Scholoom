# 实际交付与交接

## 当前状态与成果

多项目与信任、项目行操作收口均已实施并完成相关验收。任务以 [tasks.md](tasks.md) 为准，保留为未归档 change。当前代码与 [design.md](design.md) 的模块图、选择及通知时序一致。

- 左栏同时呈现最近项目和普通会话。各项目独立展开、分页及管理会话，项目行只折叠展开；菜单右侧加号创建所属会话，菜单仅提供打开及确认移除。顶部、折叠轨和中间空态的新建入口已移除。后台项目仅推送会话元数据失效，不混入当前正文。
- 项目名称统一取实际目录末级名，停止读取旧 meta.name，移除项目重命名及创建别名参数。原字段不作清理，不改变项目身份；目录在文件系统中改名后重新添加，按新名称保留会话和成果。
- 选择会话同时切换项目、右栏和项目文件标签组；每项目未保存草稿独立恢复。文献库、设置及共同材料阅读器跨项目保留，迟到创建或保存结果不抢占新选择。
- 项目仅保存 `pending | trusted | restricted` 信任状态。新建或显式添加前询问，可选择信任、受限添加或取消；旧项目进入时重新决定，明确受限后重开不重复询问。人工文件浏览和编辑可用；Agent 读取、修改和模型外发要求 trusted，撤销仅阻止后续操作。
- 项目容器 v4 在迁移前保护旧数据库备份，所有旧授权组合转为 pending，保留自动备份设置；独立恢复副本同样重新确认。协议升至 3，CLI 改用 `project-grant --trust`，信任调整保留当前备份设置。
- 项目模块复用既有操作检查，通过宿主绑定的异步调用身份区分人工与 Agent；文献库批次保存材料来源，延迟处理及重启后仍复查 Agent 信任，文献库自身授权独立。
- UI 设计、开发说明、授权决议、PRD、初设及项目约束同步到对应事实源。主要实现入口为 SessionList、business-session、Workbench、ProjectTrustDialog、project-contracts、projects/store、kernel/manual 和项目容器迁移。

## 首轮信任与多项目验证

环境：Linux、Node 24.12.0、pnpm 11.10.0，现有 Playwright 1.63.0 与 Electron 44.5.1。配置、项目、文献库、模型 fixture 和输出目录隔离。内部 broker、文件、数据库及执行进程使用真实接线；外部模型使用受控 HTTP 响应。

| 检查 | 实际结果 |
| --- | --- |
| `openspec validate add-multi-project-workbench-and-trust --strict` | 通过 |
| `pnpm build`、最终 `pnpm build:shared` 与 `pnpm --filter @scholoom/desktop build` | 通过 |
| `pnpm typecheck`；最终 desktop typecheck 与 `tsc --noEmit -p tsconfig.tools.json` | 通过 |
| 六组派生契约映射与 schema 比较（经既有格式化归一） | 一致，无额外派生文件修改 |
| 变更的 56 个 TS/TSX/JSON 文件定向 Biome check | 通过，无 error |
| `pnpm check:architecture` | 13 模块、171 文件，0 findings、0 granted exceptions |
| `git diff --check` | 通过 |
| `pnpm exec playwright test --config playwright.kernel.config.ts` | 261 通过，2 跳过：Windows ACL 与需显式启用的真实 MiniMax |
| 最后调整后定向运行 cli-runtime 与 sessions 内核测试 | 9 通过 |
| 受影响核心 UI 分批验收 | 浏览器 34 通过；Electron 33 通过，1 跳过（同源静态服务边界仅浏览器验证） |
| file-explorer 的剪切、万行树/二进制传输和取消信任添加 | 双宿主共 6 项通过，与上述核心 UI 范围不重叠 |
| `pnpm exec playwright test tests/smoke/entrypoints.spec.ts` | 4 通过，包含真实桌面 preload、关窗重连及兼容宿主 |

核心 UI 范围为 `tests/ui/` 下 conversation、file-workbench、harness、workbench、writing-editor、writing-editor-recovery、writing-editor-pdf 的 spec。最终结果按用例去重为 67 通过、1 跳过；加上 file-explorer 的 6 项，共 73 项相关 UI 通过。分批运行并非全量 UI 套件验收：

- 首轮选择上述七个文件，浏览器已完成 29 项通过；两项科研交互因旧测试精确匹配新复选框短名称超时。修正定位器后，已启动进程仍使用旧测试，因此中止后续写作等待。
- 浏览器重新运行上述文件中的 pending project、user invokes、user configures、manual PDF、visual editor protects、scientific writing：6 项全部通过，其中 pending project 与已通过集合重叠。
- Electron 使用 `--project ui-electron --output test-results/ui-final-electron` 运行上述七个文件，32 通过、1 样例重置超时、1 跳过。随后增强多项目用例，并以 `--output test-results/ui-final-switching` 在双宿主定向运行 resident project 与 reset restores：4 项通过，补齐 Electron 的最终通过集合。浏览器补验输出在 `test-results/ui-final-browser`，先前通过场景及文件树验证在 `test-results/ui`。
- 核心断言覆盖项目/会话切换、项目草稿与全局标签保留、两个项目的待处理执行在切换后分别完成且消息隔离、分页、取消添加、旧项目确认、受限人工编辑与禁止发送、流式隔离、归档恢复、迟到回执、重连、写作及真实 Quarto/TeX PDF 导出。
- 实际查看了浏览器和 Electron 的多项目及信任弹窗截图，包括浅色/深色。截图为上述输出目录内的 `multi-project.png`、`project-trust-light.png` 和 `project-trust-dark.png`；主题截图禁用过渡动画以捕捉最终状态。

全仓 `pnpm lint` 未通过：原有文献库组件存在可访问性、导入及格式问题，已核对 HEAD 中相同问题；例如未修改的 CatalogItemRow、VersionFilter、CollectionFilter、LibraryToolbar。该结果保留为现存限制，不计为本次新引入的错误。

## 审查与问题处理

独立只读审查分别核对授权/迁移/材料来源，以及导航/异步切换/通知范围，未报告可确认的绕过或缺陷；静态审查不代替实跑结果。相关内核回归另覆盖八种旧授权组合、迁移备份、嵌套 Agent 范围不能降级或换项目、排队保存撤权、库摄取延迟及重启来源保留。

UI 实跑发现的已登记项目激活未展开、全局设置页覆盖目标项目活动文件页已修复。分页定位器收窄到会话树，避免与人工文件树混淆；批量准备 60 个会话的场景扩大总时限，分页行为断言不变。信任复选框按角色和语义前缀定位，避免完整说明文案成为契约。修复后对应双宿主场景通过。

Electron 的样例重置在长批次中有一次进入材料页超时；trace 中目标关闭发生在超时收尾阶段，不构成窗口自行关闭的证据。未修改产品代码，随后双宿主定向复跑均通过；该次偶发超时保留在原输出中，尚无稳定重现。

## 项目行后续实施与验证

用户在收口方案后回复“继续”，沿同一 change 实施 tasks 4。共享及桌面构建、desktop/tools 类型检查和 69 个变更文件的 Biome 检查通过，架构仍为 0 findings、0 exceptions。项目名称、重定位、文件、会话和人工组合的相关内核用例分批最终通过 31 项；入口冒烟 4 项通过。初次运行发现两个旧测试仍传创建别名，移除旧参数后复跑通过。

本轮结果与首轮分开记录；最终相关 UI 按用例去重为 63 项通过，另 1 项按宿主跳过，不是全量 UI 验收。

| 命令或范围 | 结果与证据 |
| --- | --- |
| `pnpm build:shared`、`pnpm --filter @scholoom/desktop build` | 通过，菜单尺寸修正后重新构建桌面通过 |
| `pnpm --filter @scholoom/desktop typecheck`、`pnpm exec tsc --noEmit -p tsconfig.tools.json` | 通过，辅助实施另通过 projects typecheck |
| schema 派生类型校对、Biome、架构和 diff 检查 | 六组映射一致，69 个变更文件检查通过，架构 13 模块/171 文件无 findings 或例外，`git diff --check` 通过 |
| kernel 的 project-files、project-runtime-relocation、project-backend、sessions、manual-application、development-execution | 最终去重 31 项通过；覆盖旧别名忽略、目录改名后的身份/会话/产物及实际执行、人工 RPC 和调试宿主退出恢复 |
| `pnpm exec playwright test --config playwright.ui.config.ts --output test-results/ui-project-actions-core tests/ui/file-workbench.spec.ts tests/ui/conversation.spec.ts tests/ui/harness.spec.ts tests/ui/workbench.spec.ts` | 61 通过、1 跳过，浏览器 31、Electron 30；跳过的是仅需浏览器验证的静态服务边界 |
| `pnpm exec playwright test --config playwright.ui.config.ts --output test-results/ui-project-menu-bounds tests/ui/file-workbench.spec.ts tests/ui/conversation.spec.ts tests/ui/file-explorer.spec.ts --grep 'resident project\|project files share\|conversation titles\|keyboard cut'` | 8 通过；确认层尺寸修正后复验，6 项与上述核心集合重叠，增加双宿主剪切/替换回归 2 项 |
| `pnpm exec playwright test tests/smoke/entrypoints.spec.ts`；最终构建再定向 `--grep 'desktop loads React'` | 4 项通过；最终桌面加载额外复跑 1 项通过，与原集合重叠 |

实际查看双宿主项目菜单截图及小窗口确认层：`test-results/ui-project-actions-core/` 与 `test-results/ui-project-menu-bounds/` 下 resident project 输出目录中的 `project-menu-light.png`、`project-menu-dark.png` 和 `project-menu-confirm-small-window.png`。加号、新建归属、迟到回执不抢选择、菜单按钮切换/方向键/Esc/焦点归还、移除失败保留并重试均经用户入口核对；小窗口断言确认按钮完整处于视口。

独立只读审查核对项目名称、创建归属、迟到回执、菜单焦点及失败重试，未报告确认缺陷。截图复核另识别菜单靠近底部时确认内容增高的边界，修正为只观察已打开菜单自身尺寸及窗口 resize，重算位置并有界滚动，关闭即释放观察；边界补验通过。

扩大回归曾在 attachments 测试的“文献库授权与备份”控件等待处中止；当前 LibraryTab 与 HEAD 都没有该控件，属于现有测试与界面不匹配，不作为本轮新增入口的失败或全量 UI 通过证据。文献库及阅读相关调用已迁到新建 helper 并通过类型检查，但其旧 UI 套件未完整重跑通过。

## 未完成事项与下一步

本 change 无剩余实施任务。已知验证边界为全仓既有 lint 问题、现有文献库 UI 测试漂移、未运行真实外部模型及 macOS/Windows 分发包验收；不据此声称科研质量或三平台发布通过。旧内核需重启以加载当前协议与项目名称逻辑。

测试临时服务由本轮夹具启动和回收；未安装依赖、提交、切换分支或操作真实用户配置。未同步主规格、归档或创建提交；如需最终归档，沿项目既有 OpenSpec 流程办理。
