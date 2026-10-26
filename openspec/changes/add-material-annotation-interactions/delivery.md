# 实际交付与交接

## 当前状态与成果

2026-10-25，基线`e3d58fc807827a78493dcd16e38de28c8d02766e`。用户授权实施、锁定依赖及隔离UI验证；本轮进一步授权主线U1修复、只读消费正式交接快照、接口交接与公共方案准备。未授权提交、推送、PR、真实用户库或其他树操作。当前完成8/15项：1.1–3.3的局部实施与4.3的M3方案调查；4.1／4.2／4.4–4.6及完整5.1／5.2保持未完成。任务以[tasks](tasks.md)为准，调查／方案闭合不代表新提供者已接通，也不宣称整个change完成。

已接入：

- `ContextItem`保留PDF页／矩形、规范化文档位置、区域坐标基准及草稿对象标识；旧显式项继续可读。模型内容编码、共同检查器及消息历史展示同一载荷，不新建发送通道。
- PDF／EPUB／HTML真实阅读器贡献当次选择；源码、可视编辑和Markdown轻预览贡献文字及实际表格／图片结构，原library阅读记录仍独立保存。
- 项目与库PNG／JPEG／GIF／WebP共用图片视图，分片、身份、权限、字节／像素容量、键盘／指针区域及旋转／缩放均有边界；不提供图像语义推断或正文写回。
- 项目文件历史复用`lineDiff`及原`files.undo`，实际保存与候选分别展示，未知执行者／理由不推断。首条真实阅读批注→共同composer→harness worker→项目保存→差异／撤销已在双宿主跑通。

结构与实际链路沿[design总览](design.md#变更总览)，M1／M2虚线保持未接；嵌入排版产物没有伪造ResourceRef，仍等待M3。另一交互报告change未实施。

## 实际验证

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

主线包及公共交接的精确消费路径和字段依据见[investigation第二阶段](investigation.md#主线正式输入消费第二阶段)及[design公共增量](design.md#主线第二阶段交接与公共增量)。已收到本轮明确转交的输入，不代替仍缺的提供者定案：

- M1：生态Reader／sidecar／PDF字节及保存／SQL／通知／键保护调查已接收，关闭未收到调查。历史Reader写sidecar而非PDF、H1领域Adapter为替身，不能代替文献实际新材料版本、提交／未知结果查询及sidecar转换契约；4.1／4.4仍开放。
- M2：项目快照提供CallContext／任务引用事实，未提供新FileEdit归因DTO；“关联字段草稿”不是执行归因。已交付可信执行者、指令集合、工具记录、局部撤销及变化查询的精确需求，等待项目／Agent确认。仍不显示推断的Agent作者／理由。
- M3：本线已完成A显式导出、B新增只读render产物ref的比较；建议B须经公共契约审查。输出必须绑定自己的生产job和输入basis，不能借失败新job的basis解释旧lastSuccess。4.3只完成调查，4.6及完整I5仍待审查／实现。

继续执行时先读本记录和tasks，按所属提供者输入核对对应规格，再使用`openspec instructions apply --change add-material-annotation-interactions --json`。依赖和隔离UI验证授权继续有效；整合完成后才完成5.1／5.2并考虑归档。

实际科研质量、三平台分发及macOS受管执行未验收。没有提交／推送／归档；当前记录是可续做交接，不是最终完成声明。

## 第二阶段：U1修复与接口交接

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

达到本轮边界即停止。尚需主线审查：上述公共顺序及补丁、M3是否采用B新增只读产物ref或限定A导出范围、M2由项目／Agent提供的实际归因及消费契约。文献提交提供者未到时M1生产分支继续开放；不自动实现报告或下一阶段。
