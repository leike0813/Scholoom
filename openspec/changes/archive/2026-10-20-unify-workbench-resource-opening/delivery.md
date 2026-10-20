# 实际交付与交接

## 当前状态与成果

A 批共同资源打开已完成，任务状态见 [tasks](tasks.md)。项目文件与库附件共用资源接口、格式视图和工作台打开入口；本批为完整个人桌面文献工具提供基础，后续主界面、题录编辑、选择工具等仍沿[完整计划](../../../../.scratch/domain-development/library-foundation-plan.md)分批交付。

主要实现入口：

- `packages/protocol/src/resources.ts`：定位、稳定引用、描述及有界 read／document／save／cancel 契约，复用已有格式 schema，业务映射同源生成。
- `packages/editor/src/resource-access.ts`、`packages/projects/src/files.ts`：窄端口访问及稳定 fileId 字节读取；`packages/library/src/document-parser.ts`、`document-execution.ts`、`catalog.ts` 复用原材料解析与记录权威。
- `apps/kernel/src/manual.ts`、`architecture.json`：实际领域装配及依赖守卫，无 harness 的人工操作也可读取，公共响应不返回 nativePath。
- 工作台 `resource-controller.ts`、`ResourceView.tsx`、`project-ui.tsx` 中的 FileEditor、PDF／文档阅读器及记录面板：共同打开、格式选择、内容端口和可选库记录适配。session／tab／Workbench／附件入口删除分立的文件和 reader 接线。
- 规格、设计文档、开发入口及领域计划已对齐；原规划中的 FileWorkbench 名称修正为实际 FileEditor。

项目读取、保存和路径变化按稳定身份及内容依据核对。首次打开立即绑定取得的身份，新建按创建回执中的 fileId 接续，原路径上的替换文件不能接走旧草稿。项目正文保留源码／可视编辑、共享撤销、恢复与排版；库文本只读，并可在共同视图中查看、保存和更正文献阅读记录。PDF、EPUB／HTML 按相同格式实现读取两类来源，项目没有记录提供者时不显示虚假保存能力。

库文本每次挂载都先核对读取能力，缓存错误不能放行旧正文；撤权、读取失败及断线时隐藏受保护内容，保留原缓存供核对。尚未成功打开的资源可随授权通知重试；正常库通知不重建已成功的 PDF viewer。视图关闭只取消本视图 requestId，库 tab 跨项目保留，资源导航不切换 harness 项目、会话或未发送指令。

[design](design.md) 的共同结构与打开时序图、[规格](specs/workbench-resources/spec.md)的生命周期图与当前实现一致；设计已纳入取消、不可读原因、文本记录适配和首次加载状态。

| proposal 完成判据 | 实际结论 |
| --- | --- |
| 1 共同入口与端口 | 文件树、附件及已有文件链接均进入 ResourceTarget／ResourceView；原分立渲染入口已移除。 |
| 2 相同格式与真实保存 | 内核及双宿主实跑两来源 PDF／EPUB／HTML、库文本只读／笔记；项目源码、可视编辑、Quarto／TeX 排版及导出通过。 |
| 3 身份、草稿与项目隔离 | 文件移动及旧路径复用、分屏、项目切换、草稿与原指令保留均有对应内核／UI 证据。 |
| 4 权限、失败和关闭 | 撤权隐藏／恢复、缓存重挂载、保存冲突／旧回执、解析故障及按视图取消分别经内核、独立探针和产品接线核对。 |
| 5 必要验证 | 类型、架构、构建、内核及浏览器／真实 Electron 定向用例已通过，详见下节。 |

## 实际验证

环境：Linux、Node v24.12.0，使用项目锁定工具链。材料为隔离的 UTF-8、PDF、EPUB 2／3、HTML 及写作夹具，配置、库、项目和输出均为测试专用。没有使用真实模型或用户材料、安装依赖或提交代码。文件工作台中的 Agent 回归使用本机受控模型服务器，内部接线为真实实现。

| 命令／范围 | 结果与边界 |
| --- | --- |
| `pnpm generate:contracts`；生成器 `--self-test` | 通过；核对生成方法声明键与工作区一致。 |
| `pnpm typecheck` | 通过；最终 UI 修复后另行通过 desktop 类型检查和 `pnpm exec tsc --noEmit -p tsconfig.tools.json`。 |
| `pnpm build` | 通过；最终源码另行通过 `pnpm --filter @scholoom/desktop build`。 |
| `pnpm check:architecture` | 通过，13 模块、179 源文件、0 findings、0 exceptions。editor 不依赖 library 实现或领域数据库。 |
| 变更文件 `pnpm exec biome check`；`git diff --check` | 通过；初次定向检查 39 文件，最终 UI 调整另行检查 8 文件。 |
| `pnpm test:kernel tests/kernel/resource-access.spec.ts tests/kernel/tab-state.spec.ts tests/kernel/manual-application.spec.ts tests/kernel/project-files.spec.ts tests/kernel/document-reading.spec.ts tests/kernel/document-parser.spec.ts tests/kernel/pdf-reading.spec.ts tests/kernel/editor-source.spec.ts` | 45／45 通过。涵盖人工组合、两来源解析、位置单位、只读、撤权、材料变化、共享源码历史及解析故障／取消。 |
| `pnpm test:kernel tests/kernel/resource-access.spec.ts tests/kernel/resource-identity.spec.ts tests/kernel/manual-application.spec.ts` | 最终提供者修复后 7／7 通过，其中 3 项新增身份回归；累计不同内核用例 48 项。 |
| 双宿主 `resource-opening.spec.ts`、`resource-lifecycle.spec.ts` | 最终 4／4 通过。库文本笔记通过 UI 保存后由原库接口查询，撤权后重新挂载不展示缓存，重授权恢复；关闭分屏请求与另一视图隔离。证据在 `test-results/resource-lifecycle-final/`。 |
| 双宿主 `pdf-reading.spec.ts` | 2／2 通过，高亮／书签／笔记、项目切换、关闭 worker 及重开原记录；证据在 `test-results/resource-final/`，该目录中的生命周期失败属于后续已修复的测试导航问题。 |
| 双宿主 `document-reading.spec.ts` | 4／4 通过，EPUB／HTML 选区、资源、搜索、撤权、旧回执及材料缺失；证据在 `test-results/ui/`。 |
| 双宿主 `file-workbench.spec.ts` | 8 个不同用例分轮通过，覆盖目录及稳定身份变化、共享草稿、迟到读取、回收恢复、多项目和信任；证据在 `test-results/ui/`。 |
| 双宿主 `writing-editor.spec.ts`、`writing-editor-recovery.spec.ts`、`writing-editor-pdf.spec.ts` | 6 个不同用例通过：浏览器在扩展批次通过，最终 Electron 3／3 通过；后者证据在 `test-results/resource-writing-final/`。 |
| `openspec validate unify-workbench-resource-opening --strict` | 通过。最终任务勾选与交付结果另行核对。 |

累计 24 个不同的浏览器／Electron 用例分批通过，不表示扩展批次曾一次全部通过。各轮实际操作与失败如下：

1. 首轮执行四个资源／阅读／文件测试文件，共 16 项，8 通过、8 失败。原因是撤权测试匹配旧提示语、文件首次读取未就绪时即输入，以及 PDF 用例沿用旧项目菜单入口。分别改为语义断言、明确首次加载／等待可写和当前导航树入口。
2. 扩展为上述七个测试文件，共计划 22 项；已完成的 16 项中 15 通过，PDF 用例被待确认项目信任弹窗阻挡。夹具改为显式受限项目。随后测试进程收到 SIGTERM，无最终报告，未执行项不记为通过；中断原因未确证。手动停止确认归属的服务器进程组，并以 CLI 核对隔离内核 `ui-profile-3sfvNU` 已停止。
3. 定向批次取得 PDF 双宿主通过及库文本浏览器通过；生命周期新用例遗漏返回文献库的导航，出现超时后主动中断剩余同类执行。补导航后，又修正了重开时在面板挂载前判断折叠状态的竞态，才取得最终 4／4。
4. 最后单独执行 Electron 写作三文件，3／3 通过。最终两个短批次的 `.last-run.json` 均为 passed，无失败项。

最终复验入口：

```sh
pnpm exec playwright test --config playwright.ui.config.ts tests/ui/resource-opening.spec.ts tests/ui/resource-lifecycle.spec.ts --output test-results/resource-lifecycle-final --max-failures 1
pnpm exec playwright test --config playwright.ui.config.ts tests/ui/writing-editor.spec.ts tests/ui/writing-editor-recovery.spec.ts tests/ui/writing-editor-pdf.spec.ts --project ui-electron --output test-results/resource-writing-final --max-failures 1
```

浏览器与 Electron 的 `shared-resources.png` 已实际查看，三区骨架及指令草稿保持原状；记录、权限和保存结果依据实际断言及持久查询。261,267 字节编辑／预览样本的本轮浏览器、Electron 输入帧分别约 2.4／2.5 ms，取消反馈约 701／837 ms，仅代表该次确定性夹具。对应 JSON 在各宿主文件工作台证据目录。

用户明确“批准”了本轮临时隔离服务器与真实 Electron 验收。正常轮次由 fixture／Playwright 收尾，最后检查 5174 无监听，已记录的本轮服务器 PID 和中断内核 PID 均不存在。测试截图、追踪、样本及中断批次的隔离目录作为诊断工件保留，不作为生产依赖。

## 审查与问题处理

独立审查直接核对规格、源码及实际探针，发现并修复：读取时移动／原路径复用导致串身份、排队后未复查当前位置、纯路径首载及创建回执后的身份续接、撤权缓存仍展示，以及保存未强制执行描述中的可写能力。`resource-identity.spec.ts` 的 3 项回归通过，审查方负对照移除相应保护后均捕获原问题。另 4 项首载／创建身份探针使用真实人工应用和项目，React hooks／子组件为内存替身，不作为 UI 验收替代。

后续独立复核指出库文本记录适配遗漏及可视编辑、排版、在途关闭的证据缺口，已补实际适配和用例。再次发现“撤权后切走再回，缓存错误绕过首次权限门”的问题；正文现在依赖本次有效描述，失败清除描述，断线隐藏库正文，恢复授权可重试。独立源码复核未见该修复的剩余阻塞，最终双宿主回归通过。

生命周期用例只在 WebSocket 边界暂缓真实内核响应交付，验证 UI 关闭触发对应 requestId 的取消及另一视图可继续操作。内核已执行该搜索，不能据此声称实际解析器被中止；后端在途取消与调用方归属由内核用例验证。没有引入第二份业务实现。

## 未完成事项与下一步

A 批无剩余实施或验收阻塞，完成状态以 [tasks](tasks.md) 为准。本变更已随规格同步归档为 `archive/2026-10-20-unify-workbench-resource-opening`；后续按计划进入 B 批题录主界面、字段表单、集合导航及可信工作台选择工具，先闭合其字段和连接身份契约。

本机开发宿主与构建通过不代表 Windows／macOS 或三平台分发包验收。完整 Zotero-like 工具、真实科研成果评价及后续批次功能继续沿各自范围推进。
