# 实际交付与交接

## 第27轮：正式规格同步及证据边界

本change的两条workbench-agent-context及四条workbench-resources要求已逐字同步正式规格，保留既有Purpose及正文，继续区分实时选区、显式项、实际保存、FileEdit及关联结果。四份目标规格strict通过，原同步一致性及本次三change共21条的检查为本轮根`core-spec-sync-check.json`和`core-formal-<capability>.log`。这是契约同步，没有新增Office、库正文写入、精确定位或科研质量能力，未执行归档。

原图片组件、批量附加及association失败的精确后期结果已由`next/research-graph-runtime/RESULT.md`找回并注明版本；仍缺直接组合结果的部分继续保留。阅读准备重组后的主线新跨格式、静态HTML及独立库PDF双宿主组另为8/8、5.7分钟，组件另4/4、10.8秒，日志`render-main-ui.log`／`render-main-components.log`，不与历史28项或其他组相加。该组支持原格式回归，独立审查在排版自动采用发现的P2由complete-artifact-annotation-workflow续做，本片不借该8项关闭其保护要求或完整报告I5。

## 2026-10-29 主线接收补充

本批材料消费者已进入主线共同源码，并由主线完成本机 Linux 联合验证。以下补充主线接收事实；原实施轮次、首次失败及未验边界保留，任务范围仍以 [tasks](tasks.md) 为准，最终验收与提交由父 Agent 负责。本次整理已重新取得本 change 的 delivery instructions，仅核对已有证据，未重新运行构建或测试。

本节证据根为 `/home/joshua/.cache/scholoom-finish-active/`：

| 主线实际验证 | 结果与证据 |
| --- | --- |
| `playwright.kernel.config.ts` 联合内核组 | `main-final-kernel.json`／`.log`：118/118 通过，0 skipped／unexpected／flaky，retries=0。包含 `file-edit-origins.spec.ts` 的 10 项来源、条件保存、历史与整次撤销回归；118 是跨域联合总数，不全归本 change |
| `main-final-ui.config.mts` 静态产品双宿主组 | `main-final-ui.json`／`.log`：10/10 通过，Browser、Electron 各 5 项，0 skipped／unexpected／flaky，retries=0。其中 HTML 阅读、真实批注进入共同 composer 后保存并查历史、真实父子委派修改及人工重叠／整次 undo 三个场景各在两宿主通过；其余为文献组织和任务来源场景，不重复计为材料用例 |
| 共同构建与静态检查 | `main-all-desktop-build.log` 记录 desktop 构建完成；`main-final-lint.log` 无 error，保留既有 114 warnings／39 infos；`main-final-architecture.log` 为 14 模块、263 文件、0 findings、0 granted exceptions |

`main-joint-stats.json` 与两份原始 JSON 统计一致。内部阅读器、composer、broker、worker、FileEdit、文件及双宿主为真实接线，模型响应仅在外部 HTTP 边界受控；本轮选定场景补充主线接收，不替代下文 EPUB、图片、PDF 及其他保护路径的既有分轮证据。

`material-independent-review.md` 对本批材料／来源增量的 P0–P3 确证发现均为 0，并独立核对既有双宿主 SQLite／磁盘结果：子创建、父读改、人工修改、撤销人工修改及新 run 工具读回相互一致。审查覆盖其所列版本和范围，不称重新执行过本次主线联合组。

本批仍为 M1 库正文只读、材料 I5 与粗粒度 M2 消费。库正文写回、sidecar 转换、精确工具 token、差异块撤销、报告浏览器／UI 隔离、科研质量及三平台分发均不随本次接收扩大。历史 TeX unknown 与 Electron 首 run 准入失败保留原诊断责任，联合通过不补造其根因或关闭旧 CI 失败。

## 本次现有任务验收（cb5f7ed）

当前HEAD为cb5f7ed30f69b45301c83f296268578051b84e0b，开始clean。本次按主线明确选择的M1库正文只读分支完成4.1／4.4，真实粗粒度M2与材料I5的消费者、原接口及必要检查已实跑；结果和首次失败分轮见末节。只读范围不包含附件正文写回或sidecar转正文，阅读记录不冒充正文修订。生产变化只有DocumentReader点选图片的串行优先，未改库／项目权威、来源、harness准入或生产Graph。

所有当前输入、诊断、配置、项目及可重建入口均在 `/home/joshua/.cache/scholoom-finish-active/research-graph-runtime/`；下文旧/tmp路径仅为历史证据。CLI任务完成不表示科研质量、完整平台或报告隔离完成，未提交／推送／归档。

## 第九轮：选区夹具观察修正

从共同源码0b78815继续，仅修改`tests/kernel/content-selection.spec.ts`：选区动作等待实际revision提交，并核对图片对象身份、原图注及位置，避免选择图片后仍读取前一个表格对象。生产选择逻辑未改，pending draft和显式表格保护保留。作者8项通过；主线共同构建结束后在35项HostConnection／选区／平台组合中复验本文件8/8通过。原始结果为`/tmp/scholoom-round9-acceptance-IER31D/main-kernel.log`及main-kernel-results；主线只作格式整理，未增加重试、固定sleep或平台跳过。

Linux本地通过不关闭caf9025的旧CI失败，也不证明Windows目标通过。另一报告change的隔离夹具因502中断，实际状态沿其delivery，不据选区通过关闭2.1或完整I5。本change既有M1／完整交付开放项保持不变。

## 当前状态与成果

以下为4b13183阶段历史：第六轮已补真实父子委派证据及Windows夹具修正，当时11/15项，M1及5.x尚开放。第六轮同步证据在`/tmp/scholoom-round6-acceptance-dXuzCA/`。本次状态以上节和末节为准，未重放历史补丁；任务以[tasks](tasks.md)为准。

已接入：

- `ContextItem`保留PDF页／矩形、规范化文档位置、区域坐标基准及草稿对象标识；旧显式项继续可读。模型内容编码、共同检查器及消息历史展示同一载荷，不新建发送通道。
- PDF／EPUB／HTML真实阅读器贡献当次选择；源码、可视编辑和Markdown轻预览贡献文字及实际表格／图片结构，原library阅读记录仍独立保存。
- 项目与库PNG／JPEG／GIF／WebP共用图片视图，分片、身份、权限、字节／像素容量、键盘／指针区域及旋转／缩放均有边界；不提供图像语义推断或正文写回。
- 项目文件历史复用`lineDiff`及原`files.undo`，实际保存与候选分别展示，未知执行者／理由不推断。首条真实阅读批注→共同composer→harness worker→项目保存→差异／撤销已在双宿主跑通。
- M3新增只读render资源，以projectId/outputId和产物自身basis读取，保留生产job及实际输入；嵌入PDF直接选取、共同composer、实际worker字节／页解析、历史打开和刷新在两宿主通过。旧缺证据记录仍可预览／导出，不能附加。公共提供者及通用调用方与阅读器消费者分开交补丁，详见第三阶段。
- M2在当前共同基线消费files.changes／edit／undo：稳定fileId每页10条摘要、选定editId才读全文；实际human／system／execution来源、前后Evidence和revertsEditId按记录呈现，科研理由及未核实因果不推断。两宿主已真实验证人工和普通执行修改、差异／依据、人工重叠拒绝旧撤销、正确整次撤销及负责Agent查询撤销；实际范围见第五轮。

结构沿[design总览](design.md#变更总览)，M1仍未接；M2真实来源消费者及M3产物路径已接入。另一报告change本轮资源／授权生产子范围有独立tasks和delivery，不与本change合并，页面隔离仍未展开。

## 第六轮：真实委派联合与内容选择夹具

MaterialChangeView原生产分支已消费真实委派字段，无需重复改业务组件；本轮只扩原`tests/kernel/execution-facts.spec.ts`，并新增`tests/ui/material-delegation-history.spec.ts`。真实子worker创建report.md后，父worker先通过read_file读取再edit_file修改同一fileId；核对父beforeEvidence等于子afterEvidence，UI显示各自真实instance及子origin的delegationId／parentRunId／parentInstanceId。父修改没有委派字段仍显示未知，不用文本或工具预览推断作者、单次指令或理由。随后人工编辑同文件，旧撤销拒绝覆盖并保留原选定修改，明确撤销人工修改后核对实际字节、Evidence及revertsEditId；撤销不产生模型请求或新运行，composer后续草稿保留。只有外部模型响应受控，broker、worker、FileEdit仓储、文件及双宿主均真实，未注入父子字段。

Windows CI指定错误来自生成JS的ProseMirror绝对import：普通引号字符串吞掉反斜线。`tests/kernel/content-selection.spec.ts`两处改用JSON.stringify编码真实路径，邻近夹具未发现同类确证缺陷；不改选区业务、跳过平台、扩大时限或增加重试。输入证据为`/tmp/scholoom-round6-acceptance-dXuzCA/ci-baseline-failures.log:3104–3105`。Linux现有8项content-selection在`/tmp/scholoom-research-round6/kernel-first.log`通过；没有Windows目标实跑，不能记Windows关闭。

本轮验证及失败保留在`/tmp/scholoom-research-round6/`：

- 先shared／desktop构建，再测试。实际execution-facts在kernel首轮和最终组均通过；最终`kernel-final.log`15/15还包含报告／生态授权整合和保存身份回归，不能全归作本change测试。
- 双宿主夹具首次project.create失败来自预建了目标目录；改为只建结果父目录。后续真实父edit_file因未建立read_file依据被拒绝，按原保护补实际读取。会话选择改按projectId，正文断言改语义并单独读文件核字节，保留失败trace，没有放宽提供者或测试时限。`ui-second/third/fourth.log`逐轮保留。
- 最终`ui-final.log`材料Browser37.0秒／Electron40.6秒，两宿主通过真实同文件父子来源／人工重叠／undo。该组合另有报告Electron第二次重载30秒失败（3通过／1失败），不能记一次全绿；报告后续有界烟测结果由另一delivery记录。
- protocol／editor／kernel和tools类型、architecture零发现、最终schema派生映射、Biome退出0。strict和diff见收尾。静态辅助审查未替代实跑，没有为了验收修改FileEdit、TaskPort或委派权威。

收尾本change及报告change的OpenSpec strict、git diff --check均通过。材料增量为`/tmp/scholoom-research-round6/material-evidence.patch`（6文件），与同目录report-resources.patch独立基于4b13183；manifest.json列准确文件。两patch已做只读逆向核对，未实际应用、提交或同步。所有实际测试及构建任务结束，仅由本轮夹具收尾自己的进程；注册项目结果仍保留。

最新CI基线为6b22d60／40315429083：Linux689通过／9失败／16跳过、Windows628通过／49失败／30跳过、macOS入口3通过／1失败；定向Linux结果不消除这些失败。原nativeTeX首次unknown仍交计算线诊断，本轮未重跑。M1正文提交provider及完整科研质量、Windows／macOS分发和整个I5保持开放。

## 第一阶段实际验证（历史）

Linux，Node24.12.0，pnpm11.10.0；Quarto、latexmk为机器已有工具，外部模型仅现有loopback受控HTTP，未使用真实模型凭据。依赖按原锁文件安装，package.json和pnpm-lock.yaml无改动；Electron44.5.1运行时按已授权UI准备取得。配置、项目、库和结果均为隔离合成样本。

| 实际检查 | 当前结果及证据 |
| --- | --- |
| 协议位置自检，修改前／后 | 原schema拒绝带PDF位置的摘录，修改后接受；反向文档区间拒绝。正式用例扩展public-contract-baseline |
| `build:shared`、desktop build、desktop／tools TypeScript | shared及最终desktop构建通过；最终构建日志`/tmp/scholoom-material-desktop-build-final.log`。末次源码的desktop／tools类型检查通过，日志`/tmp/scholoom-material-{desktop,tools}-typecheck-final.log` |
| public-contract-baseline及context-instructions定向 | 2/2，包含真实worker全部显式项持久化；`/tmp/scholoom-material-contracts.log` |
| 指令身份及位置回归 | 3/3，覆盖全部显式项的持久化／重启、同指令变更位置拒绝及真实worker编码；`/tmp/scholoom-material-instruction-regression.log` |
| resource-access／resource-identity／context-contributions | 16/16，真实项目／库、条件保存、撤权、unknown及原格式解析；`/tmp/scholoom-material-kernel.log` |
| 既有条件保存与撤销保护 | 1/1，`project-files.spec.ts`的`shared file saving protects`核对并发保存、后续编辑及撤销拒绝；`/tmp/scholoom-material-save-guard.log` |
| 图片组件 | 19/19；真实栅格字节及指针／键盘区域，领域端口为替身。超像素用例替换尺寸元数据，不证明真实超大图片解码压力；`test-results/material-image-component` |
| 可视／Markdown组件最终版 | 7/7；真实Markdown解析／HAST和ProseMirror事务，Quarto转换与UI shell为明确替身；新增公式去重、部分公式拒绝及原生选择清理，`/tmp/scholoom-content-selection-partial-formula-results/.last-run.json` |
| 首条真实material-interactions双宿主 | 2/2，真实HTML选择、共同发送、worker修改、文件读回、差异及撤销，外部模型受控；`/tmp/scholoom-material-ui-first.log` |
| readers／material／PDF预览双宿主首轮 | 9通过／3失败，`/tmp/scholoom-material-readers-ui.log`，`test-results/material-readers-ui`。失败及修复见下，不隐去首次结果 |
| readers／material／PDF预览双宿主复验 | 14/14，包含真实可视编辑／Markdown选择、草稿刷新及原PDF旋转断言；`/tmp/scholoom-material-readers-final.log`，`test-results/material-readers-final`。后续公式拒绝及保护路径见下一轮 |
| 公式与保护路径双宿主 | 10通过／4失败；公式拒绝／完整重选、可视转换失败恢复、迟到发送回执和关闭在途资源在两宿主通过。新增文档composer检查因测试顺序清空原生选区而失败，见下；`/tmp/scholoom-material-protection-ui.log`，`test-results/material-protection-ui` |
| 文档／PDF诊断最终定向复验 | 6/6，真实EPUB／HTML共同附加与独立阅读记录、撤权及原版本缺失；QMD和多文件TeX实际预览／导出，两宿主均通过。`/tmp/scholoom-material-document-final.log`，`test-results/material-document-final` |
| 契约生成／自检及架构 | 生成器自检通过，六份生成映射经Biome格式核对与源码一致；架构13模块／198文件、0 findings／exceptions。日志`/tmp/scholoom-material-{architecture,contract-generator}-final.log` |
| Biome、OpenSpec及diff | 本次26个TS／TSX文件通过；`openspec validate add-material-annotation-interactions --strict`通过，`git diff --check`及15份新增工件空白检查通过。报告change规划文件核对未变，manifest／lock无改动 |

UI使用既有fixture与5641端口，内部broker、资源、库、文件、worker和SQLite为真实实现。普通关闭与隔离测试内核收尾沿原fixture，结束后确认5641无监听，未控制其他树。上表重叠用例不相加为独立用例总数。

本轮实际使用的主要命令（日志及单独用例范围见上表）：

```sh
pnpm install --frozen-lockfile
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --filter @scholoom/desktop typecheck
pnpm --filter @scholoom/desktop build
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
pnpm check:architecture
node packages/protocol/scripts/contract-types.mjs --self-test
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/content-selection.spec.ts --output /tmp/scholoom-content-selection-partial-formula-results
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/project-files.spec.ts --grep 'shared file saving protects' --workers=1 --output test-results/material-save-guard
SCHOOLOOM_UI_PORT=5641 xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/material-interactions.spec.ts tests/ui/pdf-reading.spec.ts tests/ui/document-reading.spec.ts tests/ui/writing-editor-pdf.spec.ts --workers=1 --output test-results/material-readers-final
SCHOOLOOM_UI_PORT=5641 xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/material-interactions.spec.ts tests/ui/document-reading.spec.ts tests/ui/writing-editor-recovery.spec.ts tests/ui/context-bridge.spec.ts tests/ui/resource-lifecycle.spec.ts tests/ui/writing-editor-pdf.spec.ts --grep 'real visual|reader shares real selections|visual editor protects|late send receipt|closing a resource|manual PDF' --workers=1 --output test-results/material-protection-ui
SCHOOLOOM_UI_PORT=5641 xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/document-reading.spec.ts tests/ui/writing-editor-pdf.spec.ts --workers=1 --output test-results/material-document-final
openspec validate add-material-annotation-interactions --strict
git diff --check
```

可视组件用例的转换／UI替身不作为真实Quarto验收：真实选择、模式切换、转换失败及刷新恢复由上述双宿主路径补足。测试产物留在忽略的`test-results/`及`/tmp/scholoom-*`供核查，不成为产品依赖。

## 审查与问题处理

原生子Agent保持gpt-6.1-sol／high，辅助图片模块与可视选择模块；主Agent负责协议、阅读器、共同发送、实际整合和验收。独立只读审查发现两个P2：KaTeX隐藏层重复进入Markdown摘录，以及正文外清空选择后旧实时贡献残留。修复后窄复核又发现部分公式被静默省略，已改为整次拒绝并提示完整重选。最终窄复核确认以上问题关闭，无新增finding；7项组件回归及双宿主实际UI拒绝／重选均通过。

首轮双宿主的3个失败：

- PDF阅读两宿主：新增独立工具行压缩阅读区域，固定旋转样本的坐标选择起点落到可见区外或漏掉末字。保留原摘录／坐标断言和超时，将附加与原记录操作合并为同一工具行后双宿主通过。
- Electron图片场景：固定`chart.png`与同profile前一浏览器场景留下的库题录重名。按样本身份生成唯一名称后双宿主通过，没有使用`.first()`掩盖歧义。

既有CI`40100596838`的写作PDF挂载失败本机各轮双宿主均未复现，QMD和多文件TeX路径通过；不据此宣称远端根因已解决。最终`pdf-preview-diagnostics.json`位于`test-results/material-document-final/writing-editor-pdf-*/`，两宿主均取得Quarto／Pandoc／latexmk可用结果、各路径basis、完成job及output，待处理请求为0。用例保留各阶段摘要和最近100条事件，移除正文data及产物base64；失败时优先核对这些阶段，不修改生产时限或断言等待期限。

保护轮文档4项失败发生在新增检查器步骤之后：进入批注输入框清空原生选区，按契约清理后“保留选区”已禁用。将测试调整为先明确附加及形成原阅读记录草稿，再检查composer并清空实时选择；核对禁用状态及两份快照仍独立保留。保持正文选择、持久记录、撤权和原版本缺失的断言，最终4项文档定向复验通过。

## 未完成事项与下一步

历史交接路径和字段见[investigation第二阶段](investigation.md#主线正式输入消费第二阶段)及[design公共增量](design.md#主线第二阶段交接与公共增量)；当前不再等待已合入的公共提供者：

- M1按本批只读验收，未来正文修订／sidecar转换需正式提交与版本保留／unknown契约；本次不提供或假称写回。
- M2真实执行／委派提供者及阅读消费已接入，原会话真实工具已核查整次undo；精确指令／工具token、差异块撤销和科研意见状态机后续，不显示推断理由。
- M3既有只读PDF产物及原job／input依据保留，不重做提供者。旧TeX单次unknown的公共进程根因仍沿所属计算任务，不因本批验证关闭。

主线仍负责接入及最终验收；后续实施须有明确新任务，不在本树自行归档或扩生产Graph／角色。实际命令及真实／替身边界见末节。

实际科研质量、三平台分发及macOS受管执行未验收。没有提交／推送／归档；当前记录是可续做交接，不是最终完成声明。

## 第二阶段：U1修复与接口交接（历史）

主线正式输入为`/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`及`coordination-plan.md`，manifest列七树来源／e3d58fc基线。本轮只读该包与本树；未操作其他树、发送跨树消息或新建Agent终端。继续使用已有原生子Agent，保持gpt-6.1-sol/high，分别只读核对生态输入及U1窄复核。

U1在`MarkdownPreview.tsx::selectedPreviewText`修复：仅遍历当前range相交节点，按实际段落／BR／行与列贡献分隔；表格逐个选中单元格输出列分隔，首／中／尾空单元格不使值错列。分隔符计入原capacity，超限仍整次拒绝；公式单份TeX、partialFormula拒绝及选择失效清理保持。没有在最终quote上猜测段落，没有全视图文本投影。

业务改动只涉及该函数；扩展原`tests/kernel/content-selection.spec.ts`及`tests/ui/material-interactions.spec.ts`，新增风险边界为跨段数字、BR、表格数字与空列、部分range、含分隔符的容量上限。其余本轮文件修改为两change的原设计／任务、材料调查／delta规格与本记录，不改正式规格、公共resources／harness／Workbench业务或报告实现。

| 本轮检查 | 实际结果及证据 |
| --- | --- |
| 构建前置 | `pnpm --config.optimisticRepeatInstall=false build:shared`通过，`/tmp/scholoom-u1-build.log`；UI运行期间没有重建共享产物 |
| 原实现红回归 | 定向组件测试1失败：表格quote为`DoseAmount1020`；`/tmp/scholoom-u1-red.log`、`test-results/material-u1-red`。实际Markdown渲染的两段有部分空白节点，主线函数探针的段落反例不替换成本树实跑结果 |
| 首修与独立窄审 | 首修组件8/8、双宿主4/4通过；窄审发现空单元格的P2，未据首轮通过直接接受。增加首／中／尾空列反例，红回归1失败，`/tmp/scholoom-u1-empty-red.log` |
| 空列修复组件 | 8/8通过，`/tmp/scholoom-u1-component-final.log`、`test-results/material-u1-component-final`；独立窄复核确认空列P2关闭，无新增finding，审查本身只读未重跑测试 |
| 最终构建／类型／架构／双宿主 | desktop最终构建通过（`/tmp/scholoom-u1-desktop-build-final.log`）；desktop及tools类型通过（`/tmp/scholoom-u1-types-final.log`），架构13模块／198文件、0 findings／exceptions（`/tmp/scholoom-u1-architecture.log`）。双宿主4/4通过（`/tmp/scholoom-u1-ui-final.log`、`test-results/material-u1-ui-final`），已包含空列位置和原公式／草稿回归；5641收尾无监听 |
| 收尾检查 | 本轮3个业务／测试TSX／TS文件Biome通过；两个change的OpenSpec strict及diff检查通过。未运行全仓CI或新M3／报告生产接线测试；未安装新依赖 |

实际命令：组件均用`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/content-selection.spec.ts --workers=1`，红回归加`--grep 'paragraph, line-break'`；最终桌面构建用`pnpm --filter @scholoom/desktop build`，双宿主用`SCHOOLOOM_UI_PORT=5641 xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/material-interactions.spec.ts --grep 'semantic boundaries|real visual' --workers=1 --output test-results/material-u1-ui-final`。组件使用既有明确替身，UI使用实际renderer、Markdown解析、Quarto可视编辑及共同composer；未使用模型生成科研内容，不据此验收科研质量。

两份design及同源text位置／region目标／对象草稿字段已正式交接六线，具体消费者、授权及兼容语义在材料design交接表。报告下一批可独立做清单schema／codec、注入端口的ReportResources和隔离夹具；HTML条件保存、原子附加、来源复查及父CSP／公共装配分别先审查，不在本轮夹带实施，没有创建报告delivery。

公共补丁文件：

- `/tmp/scholoom-reading-public-CUURdN/image-after-resource-leaf.patch`：先等项目线不依赖任务业务的resource-contracts叶抽取接入，再加image枚举及原格式判断，共2文件。
- `/tmp/scholoom-reading-public-CUURdN/material-context-evidence.patch`：同源位置／region／对象草稿、派生校验、模型编码及契约回归，共5文件；可与叶抽取独立排序，继续消费原入口重导出。

两份补丁仅在临时源码夹具通过`git apply --check`，前者基于已转交项目两文件，后者基于e3d58fc对应文件。没有导入他域完整私有实现，没有声明dev构建／消费者整合通过；主线审查接入后再由用户同步。生成映射应从最终schema重生。

第二阶段当时止于上述边界；其待审M3及同步门现由第三阶段正式输入替代。M2由项目／Agent提供实际归因及消费契约，文献提交提供者未到时M1生产分支继续开放；不自动实现报告或下一阶段。

## 第三阶段：已同步本树的M3提供者与真实消费者

### 实际输入与范围

本轮任务来源为`/tmp/scholoom-round3-handoff-qefwKi/prompts/research-interaction.md`的“本线具体任务”，同时消费该包`acceptance.md`及`manifest.json`。用户明确恢复后，只读核对当前HEAD及0519904祖先关系，沿本树正式源码推进。主线同步／已有切片验证证据为`/tmp/scholoom-sync-recovery-wyn13R/recovery.md`、`synchronized.json`及逐树日志；原成果保全位置为同目录`research-interaction/files/`。主线报告的47＋6内核等结果属于同步验收，不冒称本轮新增测试；本轮结果另列如下。

已消费资源叶schema／旧入口和ContextItem位置／区域／草稿编码，保留共享历史、v5→v6迁移及projectId／双窗口夹具。未复制他域私有实现，未建立临时运行组合，未退回旧资源声明。生态Reader／sidecar调查已收到，但实际文献材料提交提供者仍未具备；M1仅关闭调查缺失。M2等待项目可信粗粒度来源及整次FileEdit撤销，不显示推断作者、理由或单条指令归因。本轮没有实施交互报告。

### 实现与公共符号

| 提供者／消费位置 | 本轮实际行为 |
| --- | --- |
| `protocol/resource-contracts.ts::{resourceRefSchema,resourceLocatorSchema,renderInputSchema,resourceDescriptorSchema}`、`editor.ts::RenderOutput` | render定位为projectId/outputId；自身basis与生产输入ref/basis/依赖快照分别保存；Descriptor带jobId/input。旧输出可选字段保持历史可读；原resources入口重导出 |
| `editor/runtime.ts::{resource,readResource,execute,savedRender}`、`resources.ts::readOutput` | 在发布后记录输出文件指纹和真实快照输入；核对生产记录、project绑定、读取前后指纹及目录范围；输出淘汰／替换／缺证据明确失败。lastSuccess沿原成功job；不新增写入权威 |
| `protocol/resources.ts::ResourcePorts.render`、`editor/resource-access.ts::{renderPort,describe,read,document}`、`kernel/manual.ts`装配 | 注入editor窄端口，沿共同分片及parser读取实际PDF；同项目只读，targetRead和跨项目render拒绝；撤权后不能使用解析缓存绕过检查 |
| `harness/runtime.ts`上下文授权及`read_context_resource/read_context_document`、`instruction-context.ts`端口 | 同项目render不误作外项目；共同工具读取真实字节和页解析，读取前后复查授权并保留原失败记录，不另建材料发送通道 |
| `resource-controller.ts::{sameResourceRef,resourceKey,resourceSourceLabels}`、`tab-state.ts`、`project-ui.tsx` | 第三类source的身份、键、tab匹配、读取核对及标签；公共补丁只含通用适配，私有材料UI留消费者补丁 |
| `RenderPane/PdfReader/ResourceView`、`MessageContent`→`session/business-session/Workbench/AgentOverlay` | 嵌入与共同打开共用真实PdfReader和ContextItem，历史重开不切接收会话；完整证据产物失败不降级取源码。旧缺证据输出用原RenderedPdf预览／导出，无附加入口 |
| `ImageResourceView`及资源格式枚举／判断 | 保留实际项目／库图片路径及第三source穷尽适配；图片枚举随真实视图／harness字节验证交付，公共提供者补丁单独保留unsupported |

设计图已加入editor产物→ResourceAccess与RenderPane→共同选择两条真实路径；规格补只读产物与旧记录场景，正式specs未改。schema派生映射无手工修改，最终六份生成输出格式化后与源码一致。

### 实际验证与首轮失败

环境仍为Linux／Node24.12.0／pnpm11.10.0，使用机器已有Quarto、latexmk及锁定依赖。先完成共享与桌面构建再测试，UI运行期间未重建共享产物。库、项目、输出均为fixture合成目录，外部模型仅受控loopback HTTP。

| 检查 | 实际结果／证据 |
| --- | --- |
| 最终构建与类型 | shared通过：`/tmp/scholoom-m3-shared-final.log`；desktop build通过：`/tmp/scholoom-m3-build-final.log`；desktop／tools类型通过：`/tmp/scholoom-m3-types-final-2.log`、`/tmp/scholoom-m3-final-tools.log` |
| editor提供者及真实harness授权 | 15/15：`/tmp/scholoom-m3-provider-final.log`、`test-results/m3-provider-final`。替换、错误basis、缺证据、淘汰、缓存／目录保护、只读、cross-project／targetRead及撤信任；真实内核、SQLite、编译器和parser，editor-runtime窄端口另有明确替身 |
| 原生多文件LaTeX | 1/1：`/tmp/scholoom-m3-native.log`、`test-results/m3-native`。实际PDF字节和页文字、生产输入，改稿及依赖编译失败后旧资源及其basis/input保持不变 |
| 既有资源／上下文回归 | 23/23：`/tmp/scholoom-m3-resource-regression.log`。context-instructions仅选身份验证／全部显式项持久化／同指令不变性3项，另覆盖public-contract-baseline、resource-access、resource-identity；不声称整个context-instructions文件全跑 |
| 双宿主最终轮 | 8/8：`/tmp/scholoom-m3-ui-final.log`、`test-results/m3-ui-final`。两宿主各覆盖真实图片、旧依据投影、嵌入Quarto PDF→SDK真实拖选→composer／批注→实际worker字节及页读取→历史重开／刷新、原写作PDF预览导出 |
| 架构及生成 | 13模块／201文件、0 findings／exceptions：`/tmp/scholoom-m3-architecture-final.log`；生成器自检及六份格式化映射一致性通过，无生成文件差异 |
| 收尾 | 修改的TS／TSX Biome、两change OpenSpec strict、diff及新增文件空白检查通过；补丁按顺序在临时Git index应用并逐blob核对真实本树。临时index不是运行组合，未改真实staging；5641无监听，本轮子Agent已关闭 |

主要复验命令如下；日志保留首次失败，重叠用例不相加为独立总数：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --filter @scholoom/desktop typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
pnpm --filter @scholoom/desktop build
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/editor-runtime.spec.ts tests/kernel/render-authorization.spec.ts --workers=1 --output test-results/m3-provider-final
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/editor.spec.ts --grep 'native multi-file LaTeX' --workers=1 --output test-results/m3-native
SCHOOLOOM_UI_PORT=5641 xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/render-materials.spec.ts tests/ui/material-interactions.spec.ts tests/ui/writing-editor-pdf.spec.ts --grep 'embedded PDF|legacy PDF|project and library images|manual PDF' --workers=1 --output test-results/m3-ui-final
pnpm check:architecture
node packages/protocol/scripts/contract-types.mjs --self-test
openspec validate add-material-annotation-interactions --strict
openspec validate add-interactive-research-reports --strict
git diff --check
```

首次tools检查在shared重建前读到旧dist，提示缺新方法；按构建顺序复验通过。首轮desktop类型发现openResource回调漏解构，已修复。首轮UI为2通过／2失败，`/tmp/scholoom-m3-ui-first.log`：新路径已走到实际选择／worker字节与解析，失败在tab可访问名包含关闭按钮而断言精确名称；按真实可访问名调整选择器后通过，没有增加时限。独立只读审查发现旧RenderOutput缺依据时预览被禁的P2，补原预览分支及代表性双宿主回归；编译检查另发现RenderedPdf导出缺失，恢复原组件后最终类型／构建／UI通过。最终窄审确认P2关闭、无新增已确认授权绕过；审查本身未运行测试。

旧记录UI仅在WebSocket投影删除可选basis/input，PDF生成、字节读取和SDK仍真实；不等于旧版本完整磁盘迁移验收。新字节／parser测试及受控模型只验证机械链路，不评价科研内容。既有远端CI失败在本轮实际写作路径未复现，不据此宣称其根因已解决。生成器无help参数的一次诊断管道产生EPIPE，后续按真实自检入口通过，未修改生产逻辑。

### 可审查补丁与接入顺序

目录`/tmp/scholoom-m3-review-8gdlsT/`，`manifest.json`列文件及基线：

1. `01-render-provider.patch`：以0519904为基线，17文件，含schema／editor／ResourceAccess／harness／装配、通用前端source调用方及必要内核测试。独立保留图片unsupported，不夹带阅读器UI；已有业务修改按符号接入，不能整文件覆盖。
2. `02-material-readers-and-images.patch`：接在01之后，包含本线既有真实选择、U1、图片和本轮嵌入PDF／历史打开消费者及必要测试。该补丁含检查点已有成果；在完整本阅读树上不要重新应用。图片枚举及格式判断只在此补丁启用。
3. `03-material-docs.patch`：本材料change原工件及UI／开发文档，保留开放任务，不携入报告实现或文献域工件。

01／02在临时index从0519904顺序应用并逐blob与实际验证树核对，未创建临时runtime。构建／运行证据来自当前已同步树的真实组合；公共补丁单独进入dev后仍须主线独立构建、类型及定向测试，不把补丁可应用当作已接dev。资源叶与同源上下文前置已在0519904具备，不再重复交旧公共方案。schema生成入口／重导出保留，主线最终组合仍核对生成映射。临时source载荷仅用于补丁审查，不是产品运行依赖。

### 停止点与剩余前置

本轮4.6闭合，累计9/15；M1的4.1／4.4、M2的4.2／4.5及完整5.1／5.2仍开放。下一步先由主线接入上述公共切片并验证，再按用户调度同步消费者；本树不自动操作其他树。M2收到项目可信粗粒度来源／整次FileEdit撤销后再核对精确消费契约；M1待实际文献提交与版本／unknown结果提供者，不能以生态调查代替。报告manifest／codec、注入端口ReportResources及隔离夹具可独立续做，本轮未展开，也不将材料测试当作报告I5。

达到用户授权的本轮有界任务后停止。未运行全仓CI、Windows／macOS分发或真实科研质量验收；没有推送、PR、归档、新依赖或真实库写入。

## 第四轮：主线验收反馈与一次进程观察

主线固定比较e71663b到本树工作区（含untracked），正式接受M3只读render及真实PDF选择／harness／权限／历史重开／图片消费者局部成果；没有新公共源码同步，也没有改本树HEAD。证据为`/tmp/scholoom-round4-acceptance-JCUBNw/acceptance.md`及本树子目录：主线构建／类型／架构／生成／strict通过，双宿主UI8通过；**内核首轮34通过1失败，失败项单独原时限复验1通过**。第三阶段表中的15/15等是本线先前实跑，不能替换本次主线首次结果，也不能合并宣称一次全绿。

失败job在首个真实nativeTeX结束为unknown，尚未进入授权断言。首轮没有实际controller code/signal、stopped／scope状态或归属证据；只知controller exit时停止未确认。原240s测试／180s poll不变，主线复验19.1s通过；不能据此归因负载或超时。详细调用点与缺失证据见investigation第四轮。

本轮在shared构建后只运行一次原测试，被动临时观察controller事件，未改平台源码或业务测试：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
NODE_OPTIONS='--import=/tmp/scholoom-render-exit-observation-Xusye8/observe.mjs' node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/render-authorization.spec.ts --workers=1 --retries=0 --trace on --output /tmp/scholoom-render-exit-observation-Xusye8/results
```

结果1通过（20.1s）；观察脚本、`run.log`、`controller-events.jsonl`及trace保留在上述目录，不是产品依赖。5个本轮controller都记录ready身份、stopped消息及随后code0／signal null退出；首两个对应顺序上的两次nativeTeX render。没有直接记录scope状态管道，本轮通过不补齐历史缺失，原unknown根因仍开放。观察完成后不再运行同一用例，不加重试／超时，不以PID消失认定停止，不将unknown改完成或提前释放容量。

下一步仅向主线交独立最小公共诊断方案：既有controller exit／native stop catch保留code/signal、instance身份、stopped是否收到、native最后状态和退出原因，复用现有IPC failure detail／诊断文本和过程测试，不扩业务ErrorInfo或另起框架；本树未实现平台行为变更。材料9/15保持，M1／M2及完整I5开放；报告模块实施归其独立change记录。本轮不读／打断活动项目树、不安装依赖或碰真实库。

## 第五轮：真实FileEdit的M2消费者

### 共同输入与当前边界

用户明确以1026796共同源码直接实施4.2／4.5及5.x的M2子范围，取代旧tmp公共补丁和未同步门。读取主线计划“共同领域实现接入后的真实整合”、职责／存储决议、原design/tasks和当前apply／delivery instructions，并按本树正式协议与调用点核对。没有操作其他真实树，未读取活动项目树；七域实现均来自当前共同源码。

真实提供者为`protocol/project-file-contracts.ts`、`projects/store.ts::changes/undo`及既有Manual／Kernel装配。files.changes的cursor固定查询窗口，返回摘要与coverage；files.edit按稳定fileId/editId只读全文；undo生成真实新FileEdit及revertsEditId。beforeEvidence／afterEvidence与撤销用FileEdit.basis语义不同，缺失不互补。执行资源回执可带editId及独立association，公共人工resources.save仍仅回ResourceDescriptor；UI只用摘要／实际撤销回执的编号，不猜对应修改。

普通执行的session/run/instance真实，当前未注入的指令／工具／委派保持unknown。后续Agent线真实委派来源不作为本轮前置，不复制其未同步实现、不冒称已验证委派细分或科研理由。M1库正文提交仍缺provider，报告生产操作／HTML写／iframe／隔离未展开。TeX首次unknown仍未定位，退出诊断交计算线，本轮未重跑原用例。

### 实际变更及调用方

| 文件／符号 | 结果 |
| --- | --- |
| `MaterialChangeView.tsx::MaterialHistory` | 当前fileId每页10条摘要、原样cursor，更早页替换当前页；只保留一个选中全文。不调用files.history，不预取全项目历史。coverage三维分别显示，空窗口不等于无变化；状态明确摘要、全文、撤销及刷新环节 |
| `MaterialChangeView`／Evidence展示 | actual principal/module与execution的session/run/instance、实际指令集合／委派字段，缺失或单次因果／工具／科研理由未知。前后Evidence按实际ref/basis显示，撤销关系单列。系统身份不当科研理由，不从时间／工具文本补作者 |
| `project-ui.tsx`历史入口及刷新 | 沿绑定的projectId/fileId保留历史实例；只读项目也可查历史，撤销仍核对原写能力与草稿。历史开关、临时断线／撤权只隐藏并清页／正文，保留在途及未知撤销保护；恢复先重查。撤销后非强制reload保留继续编辑的草稿 |
| `MaterialHistory`撤销状态 | 同步防重入、在途禁止面板关闭，unknown编号列表不因面板开关／临时断线丢失，不自动重放。成功显示实际新记录，失败保留现状／草稿及原差异。公开接口无候选DTO，不伪造“候选已保存”。区域限高50%并独立滚动，编辑区仍可操作 |
| `tests/kernel/file-edit-origins.spec.ts` | 扩原真实worker用例：实际人工改动后整次undo、读回字节及Evidence／新记录，证明不启动新run；用户显式下一指令后，同负责session用get_file_changes/read_file_edit查询实际撤销 |
| 新`tests/kernel/material-history.spec.ts` | 六个组合消费回归：有界页／coverage、旧及各类来源、迟到正文与文件key、撤销禁用／unknown、关闭重开、隐藏中unknown／重连。KernelClient为明确替身，只证明组件消费 |
| `tests/ui/material-interactions.spec.ts`首条真实路径 | 沿实际静态工作台、阅读器／composer、broker、worker、SQLite及文件，新增人工保存→普通执行保存→差异／依据→人工重叠→拒绝旧undo／正确undo→负责Agent查询。注册项目放宿主独立结果目录且不删除 |
| 原design/tasks/spec delta及UI设计 | 清除当前同步等待，明确粗粒度、整次undo、coverage及未知边界；其余历史阶段保留原失败与证据。未改正式规格／公共schema |

没有修改project store权威、kernel TaskResearchPort／事实装配、harness工具／委派／构造参数、programs、统一v6或restore；task/programs标签、实时题录选择、材料附加、M3和图片源码均保留。写集只有上述UI消费者、测试和所属工件。没有必要增加session回调或第二套DTO。

### 验证、首次失败与修复

Linux／Node24.12.0／pnpm11.10.0，复用已有依赖；所有pnpm命令带`--config.optimisticRepeatInstall=false`。先shared构建，再desktop构建及检查；测试运行期间没有重建共享或桌面产物。UI由`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`承载已构建产品，没有启动开发服务。端口5667，每轮profile及结果目录独立，模型只在既有loopback HTTP边界受控，内部提供者未替换。

| 检查 | 实际结果与证据 |
| --- | --- |
| 构建 | shared通过：`/tmp/scholoom-m2-build-shared.log`；最终desktop通过：`/tmp/scholoom-m2-desktop-build-verified.log`。后续只加解释性lint注释，运行代码未变 |
| 类型／静态 | 首次desktop类型发现canUndo含undefined（`/tmp/scholoom-m2-types-first.log`），归一boolean后通过，最终`/tmp/scholoom-m2-types-verified.log`；tools通过`/tmp/scholoom-m2-tools-verified.log`。Biome首次要求解释查询范围cleanup依赖，补必要注释后5文件通过：`/tmp/scholoom-m2-biome-final.log` |
| 真实提供者＋首轮组件 | 12/12：`/tmp/scholoom-m2-kernel-first.log`、`test-results/m2-kernel-first`。其中8项真实提供者／Kernel，含普通worker与人工undo后查询；4项组件依赖替身，不能合称12项生产链路 |
| 面板开关及断线修复组件 | 5/5中间复验：`/tmp/scholoom-m2-history-recheck.log`；最终6/6：`/tmp/scholoom-m2-history-verified.log`、`test-results/m2-history-verified`。最后新增隐藏期间收到unknown及恢复后禁用的回归 |
| 双宿主首轮 | 0通过／2失败：`/tmp/scholoom-m2-ui-first.log`、`test-results/m2-ui-first`。已走到真实执行历史／Evidence，人工重叠编辑时历史内容挤压并截获编辑区鼠标；trace明确pointer interception。未force click／增时限；原测试120s、原动作时限保持 |
| 布局／开关修复后双宿主 | 2/2：`/tmp/scholoom-m2-ui-recheck.log`、`test-results/m2-ui-recheck`，浏览器39.9s／Electron50.9s；随后临时断线保护修正后最终2/2：`/tmp/scholoom-m2-ui-verified.log`、`test-results/m2-ui-verified`，浏览器40.3s／Electron51.3s。各轮重叠用例不累加为不同测试 |
| 架构及生成 | 14模块／247文件、0 findings／exceptions：`/tmp/scholoom-m2-architecture.log`。生成器self-test通过，最终8份声明映射中7份仅格式差异核对一致、另1份无需变化，`/tmp/scholoom-m2-generated.patch`仅作比较未应用，无生成文件改动 |
| 收尾 | 两change OpenSpec strict、git diff及新增组件文件空白检查通过；当前HEAD仍1026796，真实staging未改，无本轮提交。端口5667无监听，辅助Agent均已结束 |

主要实际命令（各轮输出目录如上，UI配置／profile清单保留在交接目录）：

```sh
pnpm --config.optimisticRepeatInstall=false build:shared
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop typecheck
pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/file-edit-origins.spec.ts tests/kernel/material-history.spec.ts --workers=1 --output test-results/m2-kernel-first
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/material-history.spec.ts --workers=1 --output test-results/m2-history-verified
SCHOOLOOM_UI_PORT=5667 SCHOOLOOM_UI_DATA_DIR=/home/joshua/orca/workspaces/Scholoom/research-interaction/test-results/m2-ui-verified-profile-JhZjL0 SCHOOLOOM_TEST_ROOT=/home/joshua/orca/workspaces/Scholoom/research-interaction xvfb-run -a node node_modules/@playwright/test/cli.js test --config /tmp/scholoom-m2-delivery-QT6Tkf/ui-verified.config.mts tests/ui/material-interactions.spec.ts --grep 'a real document annotation' --workers=1
pnpm --config.optimisticRepeatInstall=false check:architecture
node packages/protocol/scripts/contract-types.mjs --self-test
openspec validate add-material-annotation-interactions --strict
openspec validate add-interactive-research-reports --strict
git diff --check
```

UI项目均保留于各自Playwright结果目录，与三个隔离profile一起保留至配置退役，没有删除登记目录造成启动容量unknown。外部模型只按固定场景读／改文本及查历史，不能评价科研质量。system、observed指令集合、已提供委派字段和临时断线时序的展示主要由组件替身覆盖；真实提供者／双宿主证明人工及普通执行，不宣称真实委派链已接入。M3／图片及报告70项的主线既有通过仅作为共同基线，不在本轮重复计通过。

### 审查与问题处理

Pascal辅助扩展kernel测试，Epicurus辅助独立组件样本，均保持gpt-6.1-sol/high；父Agent负责UI实现和最终实跑。原Faraday只读审查因429重试上限失败，未取得有效结论；改由未参与UI实现的Pascal只读复核UI，不将其自写kernel测试列作独立审查。审查确认关闭重开会丢unknown保护的P2，修复后再发现临时断线同类残余；均修正、补回归，最终只读复核确认源码闭合、无新增确定缺陷。审查本身未运行验证，实跑如上。

格式化传递中曾把截断标记写入project-ui并误删一段内容；在测试前发现，用当前HEAD仅恢复该段未改动逻辑，再核对窄diff及类型／构建。没有reset、整文件覆盖他域实现或回滚用户成果；最终独立源码复核及真实路径验证保留选择、草稿、M3、图片和当前资源能力。此工具失败不隐藏，也不作为额外业务修复范围。

### 交接与停止点

可审查本地补丁及manifest位于`/tmp/scholoom-m2-delivery-QT6Tkf/`，比较点1026796到当前工作区，包含新增组件测试。没有新公共协议／提供者补丁，不用旧累计包，也未自行接其他分支。补丁检查只证明可应用；本轮运行证据来自当前真实树。

该阶段4.2／4.5闭合，当时累计11/15；上述结果及旧未知状态保留为历史。本次M1只读／真实委派／材料I5按下节实际范围验收，不把旧阶段状态作为新的等待门。

## 本次实际结果、修正与交接

### 实现及真实消费者

主线已在本dispatch明确采纳4.4本批只读分支。核正式workbench-resources、literature-reading／attachments及真实ResourceAccess／ReadingRecordPort后，proposal／design／delta／tasks明确排除附件正文修订和sidecar转正文。原EPUB／HTML场景在库write=true时真实调用resources.save并取得permissionDenied；原ref／basis与原字节保持，真实restricted项目文件及项目列表没有自动替代物，原阅读记录继续保存、重开、撤权与失效定位。此为人工资源请求验收，不冒称模型自由规划的正文修订能力。

tests/ui/material-delegation-history.spec.ts扩原真实链：子worker首次创建、父worker实际读改同一fileId、MaterialChangeView显示真实父子origin／Evidence，人工重叠拒绝旧undo后安全撤销人工整次修改；不自动产生模型请求／新run，原composer草稿保留。用户再发送新指令，同一会话新run通过get_file_changes/read_file_edit/read_file取得实际undo身份、前后文及当前正文，核对磁盘和最新edit不变。未修改共享model-kernel、rpc-gate、file-workbench、project-ui保存函数、FileEdit或委派权威，精确指令／工具和理由仍unknown。

唯一生产修正是DocumentReader内部图片队列：用户点选目标优先于尚未开始的同页图片，仍单在途、每页最多8图、单图1MiB，保留原可见性／授权／版本与Blob清理。普通任务FIFO、失败继续，章节切换清目标；不抢断在途，不改deadline或容量。原HTML末图断言保留，未新增私有顺序断言。开发说明与UI设计仅同步实际只读和修改历史行为。

### 命令、环境与分轮结果

R为 `/home/joshua/.cache/scholoom-finish-active/research-graph-runtime/`，所有命令先export TMPDIR=$R。使用Node24.12.0及已有锁定工具；UI端口6021，每轮独立SCHOOLOOM_UI_DATA_DIR及output，DISPLAY=:99每轮先xdpyinfo。静态配置由本树cwd运行 `node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs "$R/ui.config.mts"` 生成；承载为已保全static-ui，无开发服务器。项目保留到所属配置退役，原三处提前删除已移除。

| 实际命令／范围 | 结果及R下证据 |
| --- | --- |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/execution-facts.spec.ts tests/kernel/material-history.spec.ts --output "$R/kernel-baseline"` | 7/7，31.5秒；kernel-baseline.log。1项真实worker，6项为可替换端口的组件测试 |
| 同kernel入口 resource-access／literature-reading，grep `common resources preserve\|shared reading notes\|missing material retains` | 3/3，15.3秒；readonly-kernel.log，真实ManualApplication／库与记录 |
| 同kernel入口 resource-creation／resource-identity | 9/9，10.2秒；identity-partial-kernel.log，真实保存／未知回执／部分关联及实体保护 |
| 静态UI，material-delegation-history／material-interactions，grep `real parent and delegated\|real document annotation` | 原基线4/4，3.1分钟；ui-baseline.log |
| 静态UI，document-reading／material-delegation-history／material-interactions／pdf-reading | 首轮11通过／5失败，6.9分钟；ui-final.log及ui-final/，不称全绿 |
| 修正受限项目与登记目录后，document-reading／material-delegation-history／material-interactions的12项 | 11通过／1失败，5.5分钟；ui-corrected.log。真实M2新链两宿主通过；剩Browser HTML末图 |
| 单独HTML两宿主，显式滚动实验 | 1通过／1失败，1.4分钟；ui-html-final-selected.log，否定纯视口解释。此前grep误用起始锚点未选到测试，保留ui-html-final.log，不计业务运行 |
| image-probe被动观察 | v2真实Browser反例及有界JSON见investigation。初次缓存脚本CJS解析失败未运行；改缓存ESM后v1通过但无持久JSON，不作为根因证据；v2保留实际请求／相交元数据和原失败 |
| 在apps/desktop执行 `node ../../node_modules/electron-vite/bin/electron-vite.js build` | 通过，最后renderer 1分35秒；desktop-build.log。生产修改后先构建，之后不再重建 |
| 构建后静态UI，document-reading／material-interactions，grep `reader shares real\|a real document annotation` | **6/6，3.6分钟**；ui-reader-production.log及结果，涵盖EPUB、HTML及真实批注保存的两宿主，原期限不变 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json` 及 `-p tsconfig.tools.json` | 均通过；reader-types.log、tools-final.log |
| `node scripts/check-architecture.ts`、`node packages/protocol/scripts/contract-types.mjs --self-test`、改动4个TS／TSX的Biome check | 均通过；architecture-final.log为14模块／257文件／0 findings，contract-self-test.log、biome-complete.log。协议schema／映射未改 |

所有UI命令使用 `node node_modules/@playwright/test/cli.js test --config "$R/ui.config.mts"`，相应文件／grep如表，独立profile及output路径见同名日志。后续Electron验证显式设置ELECTRON_OVERRIDE_DIST_PATH为本树已存在node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist，ELECTRON_SKIP_BINARY_DOWNLOAD=1。首次基线直接进入Electron包index.js时打印Downloading Electron binary并自动调用其install.js；这是启动前漏查的隐式行为，已上报主线并保留原日志，不能据日志判断实际走远端下载还是缓存，未将其隐藏为“从未进入安装”。后续绑定路径排除该分支，没有显式安装、升级或改锁文件。

### 首败、审查与限制

四个新增M1断言首败来自application文件入口无权限，已修为真实restricted项目；不放宽生产。首轮Electron的另一失败发生在首run admission等待，未进入委派／材料修改。同次project/session/run及诊断路径见investigation，modelRequests=null不是0；已交主线，后续成功不证明该次queued根因。三个旧用例删除仍登记目录的修正按主线决定独立处理，未将两者强绑因果。

Browser HTML反例经被动真实请求与原生IntersectionObserver确认：目标已可见，但串行页图逐项约0.8秒，目标排在最后，显式滚动不能解决。只做本域优先调度，未增加并发、时限、sleep或测试重试。原反例、截图和每轮失败全部保留；未合并不同源码／轮次为一次全绿。

独立原生辅助Agent使用gpt-6.1-sol/high、无历史fork，只读核M1契约并审查来源／undo／新测试，发现上述application夹具P2；修正后复核。新DocumentReader局部静态审查无确证P1/P2，确认单在途、清理、失败继续及不放宽容量；未将静态审查当运行证明。父Agent完成构建及真实双宿主，辅助Agent已关闭。material-history组件的可见性开关不证明真实断网／完整卸载／跨窗口恢复；实际权威由真实UI／kernel链证明，模型仅外部HTTP受控，无内部成功替身。

本次完成本批只读M1、材料I5及真实粗粒度M2消费；不包含库正文写回、sidecar转换、精确工具token、差异块撤销、报告隔离、真实科研质量、完整平台稳定性或分发。原TeX单次unknown与首run公共准入失败继续交所属提供者。两个change的strict、scholoom-dev schema及diff检查通过；本批15/15和来源7/7的勾选只表示各自当前约定范围完成，不代替主线验收或归档授权。独立增量为R下`material-consumers.patch`，交接入口为`RESULT.md`、`manifest.json`及最终apply／validation日志；不提交、同步他树、推送、PR或归档。
