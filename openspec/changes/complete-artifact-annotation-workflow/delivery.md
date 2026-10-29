# 实际交付与交接

## 当前状态与成果

已完成现有格式的材料旁批注、仅批注发送、静态 HTML 产物选择与更新保护；本机 Linux 实际 Browser／Electron 最终 28/28 通过，各宿主 14 项，零失败／跳过／重试／flaky。任务状态以 [tasks](tasks.md) 为准；原理及所有权见 [design](design.md) 的变更总览。尚未推送或归档。

源码、可视编辑／Markdown、PDF、EPUB／HTML 和栅格图片共用 ArtifactAnnotation／CommentEditor：明确固定当次项，原选择变化不改写批注目标；材料旁与共同检查器编辑同一 comment，关闭保留、移除才删除。仅批注发送使用原 session.send，原子捕获实际共同草稿；发送锁覆盖可靠恢复和 RPC 返回之间的间隙，失败恢复正文，迟到确认保护后续输入。

HTML render 沿原 outputId／basis／job／实际输入成为只读资源，重开及实际 worker 读取同一产物。HtmlRenderView 保留静态布局，frame 仅授予 allow-same-origin，页面脚本继续禁用；宿主接管包括 SVG xlink 和 area 的导航，非 about:srcdoc 文档停止贡献。摘录复用原 Markdown 的有界段落／表格／公式规则，使用所属 DOM realm，不伪造源码位置。

HTML 候选完成时按实际展示页和最新草稿重新决定发布；候选在途新增旧页批注也保留原页。PDF 候选仍由父层提供明确切换入口。真实项目保存、FileEdit 来源、版本依据、差异及整次撤销沿原权威；科研理由缺失继续显示未知，库正文和排版产物继续只读。

## 实际验证

证据根：`/home/joshua/.cache/scholoom-finish-active/`；Linux x64、Node v24.12.0、Quarto 1.9.37。所有测试使用隔离合成项目／库、该根下 TMPDIR 及明确端口 5641，依赖来自现有锁文件。静态产品 UI 配置为该根 `main-final-ui.config.mts`，不启动日常开发服务器。模型仅在本机外部 HTTP 边界使用受控响应；broker、真实 worker、Quarto、文件／SQLite、阅读器及双宿主使用实际实现。

| 检查 | 实际结果与证据 |
| --- | --- |
| `editor-runtime.spec.ts` | 22/22：真实 HTML 字节／MaterialReading 解析，PDF 回归，撤权、只读、缺依据、替换和淘汰。`annotation-editor-runtime-results/` |
| `content-selection.spec.ts` | 8/8：提取共用后，原 Markdown／可视选择、段落／表格语义、公式、容量及清理保持。`annotation-content.log` |
| 新 `html-render-view.spec.ts` | 2/2：真实 frame／组件，端口为显式替身；禁脚本与事件、零实际网络交付、SVG／area 导航、非 srcdoc 停用，以及加载新版中新增批注／撤权保护。竞态用程序化 Range，不冒充原生拖拽。`annotation-html-component-final.log` |
| `editor.spec.ts --grep 'manual writing produces'` | 3/3：真实 HTML／PDF／DOCX 生成与导出，覆盖隐藏配置目录的显式 render 输入修复。`annotation-editor-real.log` |
| 最终双宿主产品组 | 28/28，各宿主 14 项，零失败／跳过／重试／flaky，16.2 分钟；`annotation-final-ui.log`、`annotation-final-ui.json` 和 `annotation-final-ui-results/`。包含真实 CDP 鼠标拖选 HTML、旧版本批注保护、实际源稿修改和产物重新生成，以及消息入口重开旧产物 |
| Desktop／测试工具类型 | `pnpm --filter @scholoom/desktop typecheck` 与 `tsc --noEmit -p tsconfig.tools.json` 通过 |
| 构建与静态检查 | editor、desktop 验收构建及最后机械命名整理后构建均通过，见 `annotation-desktop-delivery-build.log`、`annotation-desktop-final-build.log`；架构 14 模块、266 文件、0 findings／exceptions；OpenSpec strict、23 文件 Biome 和 diff 检查通过。无需生成契约映射，因为没有 wire schema 变化 |

最终产品组沿原 `playwright.ui.config.ts` 的 Browser／Electron 两项目，使用静态构建配置与 `--workers=1 --reporter=line,json`，选择 context-bridge 的仅批注／已受理延迟回执／迟到确认，document-reading 的两格式，material-interactions 的材料／对象／区域及 Markdown，pdf-reading 及 render-materials 的三个场景。完整命令范围可由日志及 JSON config 核查，retries=0。

该组使用验收构建；随后仅将 RenderPane 内部兼管两格式的 pdf 状态变量改名为 preview，最后类型与构建通过，没有重复整组 UI。调查生成的 Quarto 最小样本保留在缓存作为复现依据，产品不依赖它。

主要实际命令（均在仓库根目录，测试设置上述 TMPDIR；UI 另外设置 DISPLAY=:99、SCHOOLOOM_UI_PORT=5641 及独立 SCHOOLOOM_UI_DATA_DIR）：

```sh
pnpm --filter @scholoom/editor build
pnpm --filter @scholoom/desktop build
pnpm --filter @scholoom/desktop typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/editor-runtime.spec.ts --output /home/joshua/.cache/scholoom-finish-active/annotation-editor-runtime-results --reporter=line
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/content-selection.spec.ts --output /home/joshua/.cache/scholoom-finish-active/annotation-content-results --reporter=line
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/html-render-view.spec.ts --output /home/joshua/.cache/scholoom-finish-active/annotation-html-component-final-results --reporter=line
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/editor.spec.ts --grep 'manual writing produces' --output /home/joshua/.cache/scholoom-finish-active/annotation-editor-real-results --reporter=line
node node_modules/@playwright/test/cli.js test --config /home/joshua/.cache/scholoom-finish-active/main-final-ui.config.mts tests/ui/context-bridge.spec.ts tests/ui/material-interactions.spec.ts tests/ui/render-materials.spec.ts tests/ui/pdf-reading.spec.ts tests/ui/document-reading.spec.ts --grep 'annotated project text|an accepted annotation|a late send receipt|a real document annotation|sends without composer text|real visual and Markdown|Markdown selections keep semantic|static HTML annotations|embedded PDF selection|legacy PDF metadata|reader shares' --workers=1 --output /home/joshua/.cache/scholoom-finish-active/annotation-final-ui-results --reporter=line,json
pnpm check:architecture
openspec validate complete-artifact-annotation-workflow --strict
git diff --check
```

## 审查与问题处理

独立 gpt-6.1-sol／high 审查提出四项 P2，均已修正并窄复核关闭：特殊链接导航造成产物归因错误；新版读取中新增旧页批注仍被替换；快照先确认后发送锁尚未释放导致下一条正文丢失；有批注时 HTML→PDF 切换缺入口。导航与候选竞争由新模块测试覆盖，RPC 用真实受理后仅延迟回执的测试核对，单次旧请求门仍保留原迟到回执场景。独立审查最后没有确证 P1／P2；实际产品验收由主 Agent 负责。

保留首次失败：

- 初始检查组 4 通过／2 失败：测试已期待后续补充的原目标摘要，静态构建尚未包含该补充；作者停止后统一重建，后续材料场景通过。证据 `annotation-implementation-ui/`。
- 首次整合组 4 通过／4 失败：HTML 两端遇到实际 Quarto 输入发现失败；新夹具在两宿主使用相同项目名导致 Electron 两项匹配冲突。夹具名称加入宿主；Quarto 在隐藏路径默认扫描为空的根因及实际复现见 investigation，受管配置显式声明本次 input 后真实三格式通过。`annotation-integrated-ui.log`。
- HTML 模块首轮误把 CSP 阻断的请求事件当作实际网络交付，改为核对 route 的实际 delivery；并保留原失败日志。原生拖拽的 Playwright mouse.move 在无业务／无事件监听的 scriptless iframe 同样停住，直接 CDP 原生事件及三击正常。产品 E2E 使用 CDP 原生鼠标事件，保持禁脚本，不增加时限或改用程序化选区通过。浏览器完整链单项已通过，证据 `annotation-html-cdp.log`；最终两端结果沿上表。

## 未完成事项与边界

本批没有未完成的产品功能或必要验收项。Office 原生格式、执行 HTML 自身脚本的活动报告、库正文写回、科研理由记录、跨版本精确定位、三平台分发和真实模型科研质量均不在本变更验收范围；活动报告仍沿原 change，CI 收敛按用户要求后置。全部接续依据在仓库和上述持久缓存，不依赖当前 /tmp；5641 测试端口已释放，没有为收尾启动普通开发服务。
