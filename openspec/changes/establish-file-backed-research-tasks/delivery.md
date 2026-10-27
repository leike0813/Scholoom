# 实际交付与交接

## 当前状态与成果

2026-10-28最新状态：共同HEAD为 `938c33f2c9fcafb2cce11b0c165b2fb1e9a818c3`，I1／4.4c已接收，4.1仍待完整库删除／恢复及主题知识提供者。本轮只读核对旧Checks40479176954的file-workbench双宿主两个场景：Browser均已有成功session.send回执及accepted／queued快照，Electron实际窗口RPC未留存；不能定为保存／草稿丢失或共同初始化根因。详见investigation末节及本记录末节。只改这两份工件，不改生产／测试、不复跑UI，不关闭整个change。下方旧阶段结果及补丁保留历史，不再应用旧累计补丁或等待同一同步。

2026-10-25，文件任务核心已实施并独立验收；第一阶段为9/13项，第二阶段增量和最新15/19进度见末节。当前仍是局部交付，I1未验收，不能归档。用户先要求“实现该change”，随后允许锁定依赖及隔离双宿主验收，本轮又明确授权主线快照消费、公共补丁及M2／I1规划。未提交、推送或创建PR，未读写真实用户库，未操作其他真实工作树。HEAD仍为`e3d58fc807827a78493dcd16e38de28c8d02766e`。

- `packages/protocol/src/task-contracts.ts`是TaskRef、入口元信息及四个任务操作的同源声明；`projects.ts`派生类型、validator和TaskPort。原资源schema抽到`resource-contracts.ts`再由原入口重导出，解决实际循环引用，没有改变资源字段或新增依赖。
- `packages/projects/src/tasks.ts`中的ProjectTasks实现`tasks/`直接子文件的有界发现、强读取、首次创建及条件保存，复用原文件身份、创建收据、保存临界区及备份恢复。入口用JSON元信息加Markdown，支持BOM／LF／CRLF，字节上限仍为256 KiB；长过程及成果独立成文。无任务正文表、反向库引用表或新数据库迁移。
- `apps/kernel/src/manual.ts`注册实际提供者，人工组合不要求harness／模型；完整宿主注入TaskPort。`packages/harness/src/task-tools.ts`提供四个任务工具及原操作查询工具，沿既有执行授权、broker、worker和ToolRecord。任务不绑定会话，不自动创建或完成。
- `workbench/tasks/`接入右侧列表及中间详情，复用共同编辑器、资源打开、context贡献、composer、草稿存储和useFileWatch。关联表单只存引用字段，入口已有未保存正文时拒绝覆盖。新建字段及原创建操作可恢复；迟到结果不会切走当前选择。
- `tests/ui/fixture.ts`按稳定projectId定位同名项目，`file-workbench.spec.ts`纠正门控操作的点击／等待／释放顺序。开发说明、UI设计及AGENTS中的任务约束已同步；正式规格尚未同步或归档。

与proposal完成判据的对应：

| 判据 | 实际依据与边界 |
| --- | --- |
| 1 人工文件任务闭环 | 真实ManualApplication、临时项目与SQLite验证创建／查询／重启、长材料、关联及独立恢复副本；无需模型 |
| 2 人工编辑与身份保护 | 实际文件变化、应用内改名、重复／损坏入口、同内容实体替换及旧taskId写入均有核查；重复检查仅限已扫描范围 |
| 3 部分保存与来源失败 | 成果保留、入口冲突后重读补关联、原创建查询、目录准备失败已验证；完整库删除分类／恢复没有提供者，未宣称通过 |
| 4 新会话接续 | 受控HTTP模型通过真实harness／worker／broker创建及更新，新内核／新会话读取入口、过程和成果继续；仅证明机械接线，不证明真实模型科研质量 |
| 5 双宿主任务UI | 最终任务双宿主4/4通过，覆盖草稿恢复、分页、键盘、创建／读取及关联资源打开的迟到导航保护；共享文件8/8、资源与context8/8分别通过 |
| 6 I1固定科研图整合 | 未完成：等待W1实际库取材及W3固定科研Graph；不以受控普通Agent测试替代 |

已核对[design变更总览及部分保存时序](design.md)、[规格状态图](specs/research-tasks/spec.md)、[tasks依赖图](tasks.md)。实际接线沿projects及现有资源权威；虚线前置仍未到达。设计已同步资源schema叶模块抽取、目录操作错误、BOM、关联字段草稿及监听复用。

## 实际验证

环境：本机Linux，Node `24.12.0`、pnpm `11.10.0`、项目锁定Electron `44.5.1`及Playwright `1.63.0`。按用户明确许可执行`pnpm install --frozen-lockfile`和`pnpm setup:electron`，使用已有锁文件；package.json及pnpm-lock.yaml无改动。UI使用端口5721、test-results下独立配置及临时项目，外部模型响应仅用本地受控HTTP服务；未使用真实凭据或用户材料。

| 命令／范围 | 实际结果 | 证据 |
| --- | --- | --- |
| `pnpm typecheck` | 全仓包、桌面与tools通过 | `/tmp/scholoom-tasks-final-typecheck.log` |
| `pnpm build` | 全仓构建通过；UI竞态修复后另跑desktop build | `/tmp/scholoom-tasks-final-build.log`、`/tmp/scholoom-tasks-final-desktop-build.log` |
| `pnpm lint`；改动文件的`biome check` | 无错误；全仓既有warnings／infos保留，任务UI定向检查无诊断 | `/tmp/scholoom-tasks-final-lint.log` |
| `node scripts/check-architecture.ts` | 13模块、202文件，0 findings、0例外 | 实际CLI输出；不新增架构豁免 |
| `node packages/protocol/scripts/contract-types.mjs --self-test`及`--patch`核对 | 自检通过；生成结果按仓库Biome格式化后与实际映射完全一致。原脚本6份raw格式差异是长行换行，无契约漂移 | 本轮只读断言；未把无关生成格式改动写入仓库 |
| Playwright kernel：`research-tasks`、`project-files`、`resource-identity`、`resource-creation`、`manual-application`、`tab-state` | 首批34/34通过 | `test-results/tasks-foundation/` |
| 同kernel配置单跑`research-tasks.spec.ts` | 审查修复后8/8通过，新增BOM实际保存、SQLite目录注册失败回归 | `test-results/tasks-review-fixes/` |
| 同kernel配置单跑`task-tools.spec.ts` | 5/5通过，含授权变化和原操作查询不重建 | 本轮CLI结果 |
| 同kernel配置单跑`research-task-agent.spec.ts` | 2/2通过，33.8秒；实际内部worker与broker，外部响应受控 | `test-results/tasks-agent-fixed/` |
| UI配置`file-workbench.spec.ts` | Browser／Electron相关8/8通过 | `test-results/tasks-ui-third/`；同批任务测试失败已另修复重跑 |
| `SCHOOLOOM_UI_PORT=5721 node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/research-tasks.spec.ts --output test-results/tasks-ui-fourth` | 第一轮任务双宿主2/2通过 | `test-results/tasks-ui-fourth/`；已实际查看Electron截图 |
| UI：`research-tasks.spec.ts resource-opening.spec.ts context-bridge.spec.ts --output test-results/tasks-ui-final`，其余命令前缀同上 | 9/12通过；共享资源及context两宿主8/8通过。三个任务用例失败分别为刷新后的面板定位遗漏及查询尚未登记收据，已诊断并修正测试 | `/tmp/scholoom-tasks-final-ui.log`、`test-results/tasks-ui-final/` |
| UI单跑任务：`--output test-results/tasks-ui-draft-final` | 3/4通过：新建／关联字段及正文恢复双宿主通过，Electron迟到回执通过；Browser在并发创建中读取目录被contentChanged拒绝，测试改为先核查原创建收据，再断言稳定目录 | `/tmp/scholoom-tasks-final-ui-draft.log`、`test-results/tasks-ui-draft-final/`；已实际查看Browser截图 |
| UI单跑任务：`--output test-results/tasks-ui-accepted` | 4/4通过，1.4分钟；正文、引用说明、创建及关联字段恢复、BOM外部编辑、原操作查询、分页／键盘和两段迟到导航均经两宿主验证 | `/tmp/scholoom-tasks-accepted-ui.log`、`test-results/tasks-ui-accepted/` |
| 最终UI单跑任务：`--output test-results/tasks-ui-resource-final` | 4/4通过；在前轮基础上增加关联资源describe晚到时不抢回视图，包含创建／读取／资源打开三个门控路径 | `/tmp/scholoom-tasks-resource-final-ui.log`、`test-results/tasks-ui-resource-final/` |
| `openspec validate establish-file-backed-research-tasks --strict`、`openspec schema validate scholoom-dev` | change及schema通过；apply进度9/13，仍为ready，非all_done | 本轮CLI输出、`/tmp/scholoom-tasks-final-apply.json` |
| `git diff --check`及逐一对20份未跟踪文件的`git diff --no-index --check` | 均通过；package.json、pnpm-lock.yaml及正式specs无diff；端口5721已释放 | 本轮只读检查；HEAD仍为共同起点 |

所有kernel测试使用`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts`前缀及表中路径。UI先构建再启动，运行期间没有重建；每次通过配置teardown和本轮拥有的Desktop／kernel句柄收尾。

未运行完整`pnpm check`、全量kernel／smoke／UI、三平台分发包验收或真实模型科研评估，不声称全仓CI绿色。没有完整删除记录提供者，库恢复、主题／分析知识及固定图科研整合未验证。大目录只核对分页与有界解析行为，未新增性能benchmark或声称超出现有目录枚举保证。

## 审查与问题处理

独立审查由同树原生reviewer完成，保留`gpt-6.1-sol / high`配置；直接核对职责决议、delta、实现及已有结果，没有跨树通信。审查本身是静态证据，行为结论来自实际测试。

1. 目录准备的未知结果不能冒充可查询的任务创建收据：现返回实际目录操作身份与错误，无原任务收据时明确failed；SQLite注册失败回归8例之一通过。
2. UTF-8 BOM读取后丢失会造成无意改写：现解码与解析保留BOM，实际条件保存核对完整字节对应正文。
3. 新建回执及后续读取可能抢回用户新选择：TaskList保留导航代次，Workbench在用户导航时使请求失效，并在读取完成及flush之后核对。独立复核确认闭合，最终双宿主回归包含创建／读取两段门控。
4. 关联提交期间重复点击会使busy永久不复位：提交期间拒绝重开，独立复核确认闭合，最终用例包含此顺序。

收尾将同一导航代次保护应用于任务关联资源的异步describe及flush，避免用户换选后旧材料迟到打开；复用RPC门控回归，最终双宿主通过，普通资源打开仍走原路径。

其他实跑失败均已诊断：首次目录创建后未注册监听，改为公开list确认目录存在后复用useFileWatch；真实Agent工具在执行实例建立前过早取得资源端口，改为调用时延迟取得。UI还有冷导航、编辑器完整路径、tab关闭按钮合成可访问名、空状态及刷新后默认文件面板的定位问题，按实际语义修正测试。迟到创建的测试沿原收据受理／完成顺序等待，notFound仅表示尚未登记，不吞其他错误，也不把并发目录变化当产品失败。截图复核后详情正文提取也支持BOM，避免将元信息展示为研究正文。未通过放宽原expect／生产超时掩盖失败；长UI场景的总预算与既有file-workbench多步骤场景一致。

## 历史：首轮未完成事项与下一步

以[tasks](tasks.md)复选框为进度事实源。当前未完成为4.1、4.3、4.4b和6.5；W2两设计复核及4.4a静态交接已完成。W1–W4快照消费及仍缺提供者见[investigation](investigation.md#等待输入与明确阻塞范围)与design第7–8节。快照是主线正式输入，不能当dev已接入。

下一批先由主线审查并在dev接入公共候选、用户同步消费者，确认M2的D1–D3与I1的D-I1入口。题录／附件删除恢复、主题知识及实际任务消费仍待所属提供者；不将任务绑定会话。新行为先审查受影响范围，整项保持活动，不同步正式规格或归档。

本轮服务和依赖授权已经给出；提交、推送、PR、真实用户数据及后续跨线业务扩展仍不在本次操作范围。构建产物、测试profile／截图和临时日志保留为本地验证证据，未将其作为业务依赖或新权威。

## 主线第二阶段：正式交接与公共候选

### 本轮结果与边界

主线`/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`对本线局部范围未发现确证缺陷，并独立实跑任务kernel／工具15/15及双宿主4/4。此为外部验收证据，不替代本轮下面的实际验证，也不表示I1完成。本轮没有需要伪称已修复的业务缺陷；实际修正的是资料缺失状态与M2候选分页范围问题。

按`manifest.json`只读消费指定快照，本线task-contracts.ts及projects.ts与正式交接版本逐字节一致。精确消费路径及字段兼容结论已进入design第7节；不存在跨树发消息或访问manifest中真实source工作树。生态固定10.0.5调查与阅读两design的“未收到文件”阻塞解除。W1题录／附件删除恢复、主题分析及正式来源身份仍缺，材料位置与报告运行／批量附加分别是已实现增量与未实施设计，不能互换。

4.4拆为已完成的契约／消费侧静态核对与仍未完成的实际接线：科研、委派、计算现有DTO均未承载完整TaskRef；ResourceEvidence可以作为入口材料，但不能代替taskId／workItemId核对。执行成果association与任务links分别核查。程序首批无需绑定任务。

公共工件目录：[README](/tmp/scholoom-research-task-phase2-iF4ywR/README.md)，基线e3d58fc：

| 候选补丁 | 内容／次序 |
| --- | --- |
| [001-resource-schema-leaf.patch](/tmp/scholoom-research-task-phase2-iF4ywR/001-resource-schema-leaf.patch) | 仅原资源schema抽取及重导出，不含任务／image／运行装配；先入dev验证，再由阅读线把image枚举接到同一叶模块，禁止第二套ResourceRef |
| [002-ui-fixture-combined.patch](/tmp/scholoom-research-task-phase2-iF4ywR/002-ui-fixture-combined.patch) | 保留本线projectId定位与文献openWorkbenchWindow；加入必要join导入，不删除原目录选择、下载及desktop映射。与001独立；由主线按符号组合，不整文件覆盖 |

两补丁均通过对共同基线的git apply --check，尚未应用到dev或其他真实树。本树已有业务源码未被替换；组合fixture只在临时候选运行。精确候选、验证适配和命令位于上述工件目录，其他域私有业务实现没有复制进当前树。

### 本轮实际验证

沿既有锁定依赖和隔离服务许可，无新依赖安装。仍为本机Linux／Node24.12.0／pnpm11.10.0，先构建再运行，测试期间未重建共享产物。

| 实际命令／对象 | 结果及证据 |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p <工件目录>/baseline/packages/protocol/tsconfig.json`及resource-leaf同路径 | 两份独立protocol构建通过；只有baseline源码及叶抽取，没有task源码。日志resource-baseline-build.log／resource-leaf-build.log |
| `node <工件目录>/check-resource-leaf.mjs` | 3种入口导入顺序通过；原schema／操作／format深比较、Ajv接受／拒绝、原入口重导出对象身份保持。resource-leaf-verification.log |
| `pnpm build` | 本树完整构建通过，current-tree-build.log。未混入快照其他领域源码 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/resource-access.spec.ts tests/kernel/resource-creation.spec.ts --output <工件目录>/resource-runtime-results` | 14/14通过，resource-runtime.log；真实所属资源／文件／创建回执，运行在本线完整组合；不把它称为七域整合 |
| `node node_modules/typescript/bin/tsc -p <工件目录>/tsconfig.json` | 临时组合fixture及用例类型检查通过，fixture-typecheck.log |
| `SCHOOLOOM_UI_PORT=5721 node node_modules/@playwright/test/cli.js test --config <工件目录>/playwright.config.ts` | Browser／Electron 2/2，41.2秒；两窗口目录选择、同名项目、按projectId创建会话、会话／未发送指令不串扰。fixture-ui-first.log及ui-results；测试结束端口已释放 |

独立辅助审查直接读取001／002及双方源文件，确认抽取无任务依赖、原声明仅空白变化，002与combined-fixture.ts一致且无能力删除。对M2规划的独立静态审查发现：第一页afterEditId=A，续页改为B时，原cursor不能识别锚点更换。现改为完整窗口范围，续页禁止再次传顶层锚点，改锚点须重新开窗；这是候选协议修正及静态复核，没有上线字段或新协议实跑。

最终检查：两个change的OpenSpec strict及scholoom-dev schema均通过；tracked与27份untracked文件的diff空白检查通过。正式任务快照中的31份源码／配置与本树逐字节一致，证明本轮只更新规划／交接工件；package.json、pnpm-lock.yaml、正式specs及HEAD未变。独立复核确认M2分页范围问题在规划层闭合，不扩张为已实施声明。

首次实验搭建失败和最终结果分别保留：TypeScript编译器API探针无ScriptTarget、临时脚本从错误包范围解析Ajv，两项均未修改业务源码或安装依赖；改用明确快照函数范围和protocol依赖解析后验证通过。M2首次strict因delta首节前说明文警告失败，已移除该说明，授权／待审状态仍在proposal及design。诊断片段见first-failures.log；没有增加生产／expect超时，也没有吞掉资源保护错误。

### M2／I1交回与停止点

M2新增独立[待审change](../establish-trusted-file-edit-origins/proposal.md)，scholoom-dev所需proposal、investigation、两份delta、design、tasks齐备。文件来源仍只提出方案：可信宿主事实、实际保存临界区同事务、旧历史未知、多指令集合／unknown、子实例与委派链、整次FileEdit undo、有界查询及可选editId。没有新的CallContext／FileEdit运行字段、没有迁移或M2 delivery。

待主线决定：D1先交粗粒度可证明来源，还是先增精确工具作用域；D2采用原单次FileEdit撤销还是另立差异块范围；D3采纳有界查询及项目资源editId范围。候选分页修正不等于上述选择已批准。

I1实际目录／调用／查询及固定worker事实已消费，产品入口选项和真实组合测试见design第8节。D-I1建议复用任务详情动作或会话目录动作，科研线拥有可信产品启动适配；产品目录仍空，calibration仅验收宿主夹具。必须等公共增量入dev并同步、入口确认后再从用户动作贯通真实科研／库／任务／worker，保存成果后门控任务关联冲突并新会话接续。当前不执行I1，不发明后置科研综合流程。

当前tasks为15/19；M2为0/6实施任务，CLI ready仅表示工件存在。到公共候选与消费侧核对交回即停止，不提交／推送／PR／归档，不启用新范围或操作真实数据。完整CI、目标平台分发与真实科研质量没有新增验收结论。

## 历史：77cd078公共同步后的有界实施（2026-10-26）

### 当前成果与消费证据

用户明确恢复原有界实施，取代旧的等待手动同步条件。只读git确认HEAD为`77cd078a12d7d10e5007ccc32ffc89110d954f39`，0519904及b838402为祖先。恢复clean及主线既有构建、16+4内核和双宿主等证据来自`/tmp/scholoom-sync-recovery-wyn13R/{recovery.md,synchronized.json,research-task-workspace/build-check.log,research-task-workspace/ui-check.log}`。本轮在正式源码继续，未重建旧/tmp源组合、未同步他树、未改共享迁移／历史／图片叶模块事实。

本轮沿design第8节已确认动作实施`task-graph-contracts.ts`、`TaskGraphs`、Manual／Kernel构造注入及handler、生成映射／architecture、TaskGraphAction及原详情薄挂载。任务端以TaskRef／basis／workItemId和所选sourceLinkIds重读任务及来源，经真实所属资源派生Evidence；不接收客户端材料版本／host身份。科研`TaskResearchPort`继续只有分页目录和可信人工启动seam；无提供者时实际目录空且明确不可用。

调用回执先保存为process文件，再按原入口basis关联；原任务正文、BOM和换行保留，原run状态不复制成任务权威。call、过程创建、taskAssociation分别表达实际结果，冲突或unknown保留已受理调用／文件及原身份。UI按任务身份保存全请求和未知／部分结果，入口未保存时拒绝启动；完整确认后才允许用户主动新建独立调用，不自动重放。已保存调用指针可经共同资源打开，仍由原四操作发现／续接。程序及会话不要求绑定任务。

正式只读输入的精确消费：

| 路径（均在`/tmp/scholoom-round3-handoff-qefwKi/`内） | 本轮采用事实／仍缺项 |
| --- | --- |
| `research-graph-runtime/apps/kernel/src/application.ts`的startResearchGraph／research.startGraph；`openspec/changes/connect-research-graph-runtime/design.md`第7节 | 现有目录／调用／查询及可信host启动是科研权威，产品连接不能直接提权启动；已选方案A，任务指针保存在process，不改科研schema。尚缺实际human→host适配与当前树组合 |
| 同design及`tests/fixtures/research-graph-worker/{graphs.mjs,worker.mjs}` | 固定校准图只是静态测试注册，生产目录仍空。其材料目前最多10份且完整小文本；任务侧100是链接选择上限，实际适配必须按图schema核验（含入口），不能扩张科研接收能力 |
| `agent-delegation/packages/harness/src/delegations.ts`的parentInstanceId／childInstanceId登记 | 可靠委派链由Agent提供者核对后注入；本树未复制私有委派实现，M2默认unknown／无补造委派。新增绑定夹具不算真实提供者 |
| `research-interaction/openspec/changes/add-material-annotation-interactions/design.md`第M2节 | 阅读消费者要求editId及实际历史、整次undo；M2本轮新提供者待dev接入／消费者同步，不宣称MaterialChangeView或I5已运行 |

旧phase2生态调查、阅读两design、TaskRef三元组、workItemId及四操作的正式交接仍有效，路径见design第7节。公共同步门已用实际证据关闭；题录／附件删除恢复、主题分析及真实跨域任务DTO／适配仍缺提供者，4.1／4.3／4.4b保持未完成，不能把已看过源码改写成实际接入。

### 本轮实际验证与首次失败

环境Linux／Node24.12.0／pnpm11.10.0，仅已有依赖及隔离profile／项目／库。构建后运行；双宿主使用`/tmp/scholoom-round3-ui.config.mts`复用主线`static-ui.mjs`及本树**已构建**renderer／native产物，未开常驻开发服务器。注入启动用例的临时HTTP只代理同一产物并提供真实测试内核端点，Browser及Electron走原bootstrap；只有科研端口是假实现，没有科研图／worker执行成功结论。

| 实际命令／范围 | 结果／日志 |
| --- | --- |
| `pnpm build`、`pnpm -r typecheck` | 通过，`/tmp/scholoom-round3-build-final.log`、`/tmp/scholoom-round3-packages-type.log`。审查修复后projects及kernel再构建通过，`/tmp/scholoom-round3-i1-review-build.log`、`/tmp/scholoom-round3-i1-kernel-build.log` |
| Playwright kernel：file-change-contracts、file-edit-origins、task-graph-orchestration、resource-creation、resource-identity、project-files、execution-history、harness-module | 53/53，38.6秒，`/tmp/scholoom-round3-kernel2.log`；最初46/48中的两例旧迁移夹具未移除v6新表，诊断后仅修夹具形状，未改迁移实现或时限，首次日志保留kernel1 |
| `tests/kernel/resource-access.spec.ts` | 10/10，50.2秒，`/tmp/scholoom-round3-resource.log`。扩展已有三种association失败样本，实际ExecutionResourcePort保存／创建仍返回可核查editId及真实执行来源，重启只补原关联 |
| `tests/kernel/task-graph-orchestration.spec.ts` | 审查修复后13/13，7.1秒，`/tmp/scholoom-round3-i1-final.log`；含真实broker装配、项目／库取材、归属／basis／来源拒绝、过程／关联部分失败及错误回执project/session。此组与53例有重叠，不作为76个唯一样本 |
| 双宿主`research-tasks.spec.ts`、`task-graphs.spec.ts` | 两宿主8项通过，`/tmp/scholoom-round3-ui-first.log`；真实默认空目录、正文草稿及未知原请求跨会话／刷新保留，原任务创建／关联回归通过 |
| 双宿主`task-graph-launch.spec.ts` | 两宿主4/4，41.9秒，`/tmp/scholoom-round3-ui-third.log`。真实任务／资源／broker／native bootstrap，注入科研端口；用户选择工作项／来源／图配置，核对实际过程指针和关联冲突保留人工正文。不是实际科研适配／固定worker的I1 |
| 类型／schema／架构／lint／生成映射 | tools及projects最终noEmit通过；architecture0 findings；全部8份格式化生成映射与schema一致。日志`/tmp/scholoom-round3-{tools-final,projects-final,architecture-final,contract-consistency,final-lint}.log`；OpenSpec和diff见收尾结果 |

双宿主首次总计8通过／4失败，失败为注入测试误将新会话状态断言为idle（实际completed）；第二次4例已走通调用／关联，但测试把CodeMirror当原生input读取。改为当前会话状态及内容编辑器正文后，同一产物、原时限下4/4通过；三轮日志／trace分别保留ui-first／second／third。未延长超时、改变产品状态或用成功替身绕过任务保存。

### 独立审查、补丁及停止点

M2来源、保存临界区、整次undo及完整窗口独立审查修复三项P2，详见[独立M2交付](../establish-trusted-file-edit-origins/delivery.md)。任务侧独立审查另发现：科研返回对象的额外projectId/sessionId可通过展开覆盖原归属。现于任何process创建前拒绝冲突，并显式投影声明的invocation/instruction/run字段；新增两例证明outcomeUnknown、一次启动、任务和过程文件不被错误登记。独立静态复核闭合，实际13/13由主Agent核对。没有将注入port当真实科研或委派提供者。

可审查工件在`/tmp/scholoom-research-task-round3/`：先`001-trusted-file-edit-origins.patch`（M2公共来源／查询／保存传播、循环依赖叶修正、必要调用方与测试），再`002-task-graph-action.patch`（任务契约／编排／UI、薄挂载、必要映射与验收）。混合公共文件按符号拆分，不整文件覆盖其他域能力；manifest列精确归属。两补丁在临时index及临时object目录按序验证可应用，重建的每份改动与当前树逐字节一致；没有修改本树index／HEAD或声称公共M2已独立接入dev。日志`/tmp/scholoom-round3-patch-verification.log`。详细依赖顺序见该目录README。

本轮到有界任务及补丁交回停止。主线下一步审查／接入M2公共增量并验证，再同步阅读／Agent消费者；科研线交实际human→host适配及固定worker／库／任务组合后安排真实I1。精确工具token另列后续，库删除恢复／主题分析仍等实际提供者。本树不推送／PR／归档、不同步其他树、不安装依赖、不写真实用户库；无未收尾的本轮UI服务或辅助Agent。完整CI、Windows／macOS和真实科研质量未新增验收。

## 共同实现后的真实I1机械组合（2026-10-26至27）

### 成果及真实消费

用户已授权本轮直接实施并选择“独立调用输入快照”。只读核对当前HEAD为1026796，0519904已为祖先；主线同步证据为`/tmp/scholoom-round5-acceptance-WBreMJ/{acceptance.md,synchronized.json}`。本轮唯一源码工作点是本树，没有复制其他域私有实现、再次同步或应用旧累计补丁。

默认装配已接通：`ManualApplication.taskResearchPort/taskGraphs`保留无harness组合及显式端口；`KernelApplication.taskResearchPort`经broker调用现有`research.graphs/requestGraph`，保留原context，由科研所属人工窄适配完成human→host。architecture仅新增projects对这两操作的实际消费。共享构造器、根工具、v6／restore、programs／委派、图片消费者、FileEdit来源hook与保存调用点均无本轮改动。

正式消费源码为当前树`packages/research/src`的目录／请求／查询提供者、`apps/kernel/src/application.ts`既有`research.requestGraph`注册及`research.graphCalls.request`适配、`packages/harness`的registered执行、`packages/library`及原资源提供者。实际试验复用`tests/fixtures/research-graph-worker/{graphs.mjs,worker.mjs}`静态注册；共享准备在`tests/task-graph-integration-fixture.ts`，导入真实托管库材料并创建实际项目／任务／来源。没有TaskResearchPort成功替身或synthetic runId进入I1正例。

首次真实worker复现`contentChanged`：任务保存process链接先改变入口basis，冷worker按旧入口读取即失败，reads为空。按用户选择，TaskGraphs先以`<processOperationId>_input`保存独立输入，确认后重读原入口，再将快照和所选来源的真实Evidence交科研。快照记录原TaskRef／basis、目标session、工作项、invocation／instruction、入口正文和来源指针；库正文不复制，任务入口自身不能另选为live来源。process保留原调用五元组及快照Evidence，任务最后按原basis条件关联；不镜像run状态。

同源增量集中于`protocol/task-graph-contracts.ts`，新增快照schema／派生操作helper及可选inputSnapshot结果；原结果仍合法。TaskGraphAction核对回执归属，历史输入沿business-session的有界resources.read保持原ref/basis并只读显示，外部改写明确拒绝。调用未知保留原请求，过程／任务部分成功分别呈现，不重跑补关联。

完成判据6在**固定图机械范围**已具备实际依据：用户从任务详情选择工作项、两个来源、图及开放配置，真实worker读取项目和库，首次保存report.md并等待；共同composer的精确confirm接续同一run，交付检查usable／科研notAssessed。调用指针、输入及成果实际持久化。任务关联冲突时保留人工新正文和原成果，只补关联；丢失一次RPC回执后刷新保留原身份，不再次启动。另一条真实普通会话通过工具发现任务、读取入口／指针／快照／报告并保存followup.md，不导入旧私聊transcript，不重建或重跑原科研调用。上述范围更新tasks的4.3、4.4b和第8组，不关闭4.1或其他域的可选消费。

### 验证及模拟边界

环境仍为Linux／Node24.12.0／pnpm11.10.0／Playwright1.63.0／Electron44.5.1。仅已有依赖、隔离端口5721及每轮独立profile／项目／库／输出；项目均保留在结果目录至所属配置退役。所有日志及工件根为`/tmp/scholoom-i1-round6/`。先构建后测试，测试期间没有重建产物。pnpm均带`--config.optimisticRepeatInstall=false`。

| 实际入口／命令 | 结果与证据（下列相对日志均在工件根） |
| --- | --- |
| `pnpm ... build:shared`；`pnpm ... --filter @scholoom/desktop build` | 共享及桌面构建通过，`shared-build-final.log`、`desktop-build-final.log`；后续仅测试断言／格式和文档收尾，无生产行为改动 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts`，选择task-graph-orchestration、task-graph-integration、task-graph-continuation、research-graphs、research-tasks、task-tools | **44/44，2.4分钟**，`kernel-final.log`及`kernel-final/`；含真实取材、错误主体、项目信任、库read/send撤权、错误会话、忙／等待拒绝、容量、快照unknown不启动及过程／关联部分失败 |
| 同kernel入口，断言／lint整理后重跑三份task-graph测试 | **19/19，57.8秒**，`kernel-lint-recheck.log`；测试准备改用test.info，显式断言替代非空断言，不改产品时限 |
| `SCHOOLOOM_TEST_ROOT=$PWD SCHOOLOOM_UI_PORT=5721 SCHOOLOOM_UI_DATA_DIR=<独立目录> node node_modules/@playwright/test/cli.js test --config /tmp/scholoom-i1-round6/playwright.ui.config.ts` | 配置只承载已构建UI，复用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`。原task-graphs两场景双宿主**4/4**通过，`ui-second.log`；真实task-graph-launch三场景双宿主最终**6/6，2.5分钟**，`ui-third.log`及`ui-third/`。各宿主完整、冲突、丢回执均经用户动作，不启动开发服务器 |
| `tsc --noEmit -p tsconfig.tools.json`；桌面typecheck | 通过，`tools-last.log`、`desktop-type-final.log`；相关共享包随build完成编译检查 |
| `node scripts/check-architecture.ts` | 14模块／247文件，**0 findings**，`architecture-final.log` |
| `node packages/protocol/scripts/contract-types.mjs --self-test`及`--patch`核对 | 通过；8份映射按最终schema核对，7份raw差异仅Biome格式，1份原样一致；生成映射无需源码改动，`contracts.patch`、`generated-maps.log` |
| 改动源码／测试／architecture的`biome check` | 14文件通过、无诊断，`lint-final.log`；首次lint的空解构、非空断言及格式错误保留在`lint-first.log`并已修正 |
| `openspec validate establish-file-backed-research-tasks --strict`、`openspec schema validate scholoom-dev` | 通过，`openspec-final.log`；最终状态及diff／补丁核对见本节收尾记录 |

I1校准Graph及其节点是真实源码图，由构造参数注入；外部模型只在普通会话接续测试受控，固定图UI用例确认模型请求为0。传输丢回执、SQLite登记失败和保存锁是明确故障注入；它们没有代替内部broker／worker／仓储或领域授权。九来源加快照实际读取10份，十来源加快照拒绝，两个请求使用独立三种身份；任务选择上限100不代表Graph容量。已实际查看Electron关联冲突截图，六个UI场景均保存`task-graph-i1.png`。

### 首次失败、审查与停止边界

保留`first-real-worker.log`的真实入口basis竞争红例。首轮快照kernel16/18的两个断言错误是reads不返回role、以及SQLite拒绝触发器仍在时过早查询原收据，修正后17/18；其余一例等待模型首请求遇冷启动，改为核对真实已准入run再检查busy，单例通过，最终批次全部通过。原失败profile中的interrupted／remoteOutcome unknown仍保留，**没有宣称修复未知停止的系统根因**，没有降低未知停止保护或延长生产超时。

UI首次`ui-first.log`因/tmp配置未声明ESM而未启动测试，补临时package.json后运行。`ui-second.log`为5/10：Browser完整例在外部篡改输入后与文件刷新交错，冲突夹具等待worker冷启动导致正常5秒RPC unknown；Electron三例在初始loadURL完成前reload而ERR_ABORTED。调整为篡改后刷新恢复原尝试、科研实际受理后立即改任务／释放process锁、等待初始URL后reload，原产物／原时限下`ui-third.log`六例全部通过；旧unknown场景仍独立保留通过，没有把unknown当已拒绝重放。

独立只读审查发现并复核三项风险：历史输入不能重新describe当前版本；入口不能作为live来源重复选择；容量测试必须使用独立请求身份以免重放保护造成假阳性。已分别修正在任务历史读取、领域校验及夹具，最终真实内核和双宿主回归覆盖。新会话辅助用例由同树Agent编写，父端审阅并实际运行；两位辅助Agent均已关闭，没有跨树消息或常驻协调。

本轮到I1机械组合及可审查补丁交回即停。4.1完整删除分类／恢复、主题知识及4.4c可选Agent任务消费仍缺相应实际提供者或验收；生产Graph目录继续空，不发明科研角色、综合流程或后置业务节点。全仓CI、Windows／macOS、发布及真实模型科研质量均未本轮验收。M2来源实现不在本轮写集，不从任务I1结果推出其新提供者已接通。无新产品决策待猜定案；剩余项交主线另行调度。

收尾：OpenSpec strict首次因新增Requirement过长发出警告，已按启动、快照及历史读取拆分，语义不变；首轮见`openspec-first.log`，最终strict及schema均通过。apply为**25/27、ready**，仅4.1／4.4c未勾选，不归档。tracked及3份untracked的diff空白检查通过，HEAD与真实index未变；端口5721已释放，所属Kernel／Electron／HTTP句柄已关闭，两位辅助Agent已关闭。

本轮可审查补丁为`/tmp/scholoom-i1-round6/001-real-task-graph-i1.patch`，基线1026796；精确文件及sha256见同目录`manifest.json`，操作／消费说明见`README.md`。仅17份tracked及3份新测试／夹具，共20文件；已在临时index／object目录核对基线可应用，并反向check匹配本树，未修改真实index或HEAD，证据`patch-verification.log`。本轮只有这一增量，直接依赖现已接入的1026796科研／库／公共代码，**不依赖旧round3补丁**。公共文件按符号审查：Kernel／Manual的TaskResearchPort hook与默认装配、WorkbenchSession.taskGraphs.readInput及useBusinessSession的同一端口、architecture的两个projects消费；其余根工具／构造参数／来源hook／迁移和他域生命周期保留。没有本地提交、推送、PR、归档或额外同步。

## 共同整合后的消费核对与后端夹具（2026-10-27）

### 本轮结果及依据

开始时git clean，HEAD为`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`。主线`/tmp/scholoom-round6-acceptance-dXuzCA/{acceptance.md,synchronized.json,sync-build-results.json,sync-kernel-results.json}`已提供接收、同步及本树构建／定向复验依据；本轮从正式源码继续，没有应用旧补丁、复制私有实现、再等同步或修改Git历史。原I1机械成果继续有效，本轮不重做其装配。

4.4c项目侧可选消费已满足：Kernel注入`projectTasks(context)`，经broker及`createTaskTools`调用真实ProjectTasks；父read取得TaskRef对应入口Evidence，通用子worker只沿原材料及输出授权读取／保存，父读实际成果、重读任务后save关联result/workItemId。`tests/kernel/delegation-task-port.spec.ts`四场景实际覆盖完整、材料变化、关联冲突、取消；`tests/fixtures/delegation-model.ts`仅控制外部模型的选择，内部broker、仓储、worker、任务及文件真实。主线`main-kernel.log`的172/172包含这四例，Agent源树15/15另作接收证据；本树本轮又实跑四例通过，三者不累加为不同样本。没有新增业务代码、第二套TaskRef或委派任务DTO，计算首批仍不绑定任务；科研角色／标准／质量和完整I3仍由所属方开放。

4.1事实校正：`packages/protocol/src/library-records.ts`已有createSourceInstance、record／commitRecords／recordHistory；`packages/library/src/schema.ts`的sourceInstances／originalRecords及`catalog.ts`实际持久化并核对原值对象三元身份`{instanceId,libraryLocator,objectKey}`，Manual注册实际操作。主线172例包含`library-records.spec.ts`两例，不能继续称该身份提供者缺失。它与任务的附件／材料版本指针分别有权威，不扩TaskLink或伪造ResourceRef；recordHistory、阅读记录软删除、整库备份均不能代替库材料删除／恢复分类。完整删除记录／恢复、主题／分析知识及其项目消费仍开放，notFound不表示删除或已查询无历史。当前状态校正在原tasks、investigation及design第9节，历史证据保留。

### 两项CI红例及修正边界

采用最新真实CI `6b22d60 / Checks 40315429083`，原始平台证据为主线`ci-baseline-failures.log`和`ci-baseline-summary.json`：Linux内核689通过／9失败／16跳过；Windows628通过／49失败／30跳过；macOS入口3通过／1失败。本轮承接其中两平台共有的project-backend撤权及无关目录改名失败，不使用旧374项基线，也没有触发全仓CI。

先构建共同源码，再对未修改的原两例固定红：`backend-red.log`记录**2/2失败**，分别为permissionDenied期望收到unavailable，以及occurrences期望1收到undefined，与CI一致。原Manual没有执行实例提供者，夹具又缺session/run/instance，`project.saveFile`在`fileOrigin→checkExecutionContext`提前拒绝，未进入原场景；这不证明生产撤权或目录逻辑有缺陷。

唯一代码改动是`tests/kernel/project-backend.spec.ts`内自含`BackendApplication`，只替换测试的执行资格seam：绑定完整project/session/run/instance及Agent主体，并严格匹配收到的上下文。继承fileOrigin和全部实际broker／ProjectStore路径，未覆盖来源字段、项目锁、依据／内容校验或发布前权限检查。生产Manual仍无harness且缺资格时unavailable；未更改Kernel TaskResearchPort、FileEdit来源默认装配、runtime、生态或任何业务代码。

两例改用该模块夹具，项目／profile保留在用例结果目录。撤权发生在实际保存等待期间，原保存被permissionDenied拒绝、原文保留，随后经人工files.read/save能编辑受限项目；无关report目录改名后，notes编辑返回occurrences=1，报告原文仍在新目录。修正后两例**2/2通过**，没有加超时、改变期望错误或删除检查。该资格seam是明确替身，不等于真实harness身份；真实worker和异步来源边界由本轮原有file-edit-origins及delegation-task-port回归分别核对。

### 实际验证与交接

日志及输出根：`/tmp/scholoom-project-round7/`；Linux／Node24.12.0／pnpm11.10.0，沿已有依赖，无安装／下载、真实用户库或开发服务器。先build后test，运行期间未重建产物；测试夹具／故障门控以外的内部路径真实。外部模型只在既有委派／来源用例受控。

| 命令／范围 | 实际结果及证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared` | 共享及kernel构建通过，`build-baseline.log`；后续仅测试和文档修改，无生产重建需要 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/project-backend.spec.ts --grep 'revoking trust while an Agent save waits\|a moved expected report directory' --output <root>/backend-red` | 原两例2失败，`backend-red.log`及trace；修正后相同选择2通过（12.2秒），`backend-green.log`，首次红未覆盖 |
| 同Playwright kernel入口，选择project-backend、research-tasks、task-tools、delegation-task-port、file-edit-origins五文件，`--output <root>/kernel-regression` | **35/35，1.3分钟**，`kernel-regression.log`。后端8、任务8、工具5、真实委派4、来源10；含真实worker、异步来源等待中cancel／revoke拒绝，及所有后端其余回归 |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 通过，`tools.log`；当前全部测试调用者及夹具类型检查 |
| `node node_modules/@biomejs/biome/bin/biome check tests/kernel/project-backend.spec.ts` | 1文件通过，无诊断，`lint.log` |
| `node scripts/check-architecture.ts` | 通过，`architecture.log`；没有增加模块消费或例外 |
| OpenSpec strict及scholoom-dev schema、git diff空白检查 | 通过，`openspec.log`及收尾核对；无协议／schema变化，生成映射无需变更 |

同树只读辅助Agent独立核对4.4c实际调用链、sourceInstances原值提供者及测试seam，确认生产Manual默认拒绝、真实保存锁／CAS与最终权限检查未放宽；未代跑测试，实际结果由父端取得。辅助Agent已关闭。没有本轮UI或生产界面改动，不重复双宿主验收；Windows两项待目标复跑，Linux绿色不关闭Windows平台任务，macOS和全仓其他CI失败仍保持原证据。

本轮没有需主线猜定的新产品选择或需跨域资格补丁的生产反例。到4.4c消费核对及后端夹具增量交回停止，4.1保留开放；不展开科研角色／Graph、库删除恢复、远端或发布，不提交／推送／PR／归档。补丁及最终任务进度见本节收尾记录。

收尾：apply为**27/28、ready**，仅4.1未完成。可审查补丁为`/tmp/scholoom-project-round7/001-project-backend-fixture-and-consumption.patch`，直接依赖4b13183，无旧累计patch依赖；文件前后sha256见同目录`manifest.json`。写集仅project-backend测试及本change的tasks／delivery／design／investigation共5文件，没有新文件、公共生产符号或协议变化。临时index／object目录验证基线可应用，反向check与当前树一致，真实index与HEAD未变，`patch-verification.log`保留结果。未创建提交，辅助Agent已关闭，所有本轮测试执行均已结束，无UI／后台服务留待收尾；测试结果及登记项目保留供主线复核。

## 2026-10-28：file-workbench首模型前的只读交接

本片按“第十轮验收后的收敛安排”只调查指定两场景四次失败。开始git clean、HEAD938c33f；失败源为Checks40479176954／8c2fd24534001a9724f9c008482d404c336a5a07，Linux内核746通过／26跳过、UI126通过／32失败／4跳过。没有将别轮Windows计数、尚未完成的新run或本机历史结果当作本次通过。

详细逐例边界、身份表、已执行文件动作及所属提供者统一在[investigation](investigation.md#2026-10-28file-workbench双宿主首模型计数的只读取证)末节。实际证据根`/tmp/scholoom-file-workbench-r10-jFEF4T/`：`bounded-evidence.json`汇总四例，Browser各自`trace-content/kernel-websocket.jsonl`保留原帧一基行号，`focused-rpc.json`提供去认证载荷的相关回执。`run-source.json`、`artifact-source.json`核run/head及artifact12728680109来源，`artifact-inventory.json`与`selected-manifest.json`记录目录和20项SHA256。

| 指定例 | 已证最早边界／未证及交回 |
| --- | --- |
| 文件预览／改名回收场景，Browser，原111行 | 一次session.send RPC130成功受理，run `97a4c35d-dd58-4838-aec6-dfc229cc214e`；后续accepted／queued，首个可计数模型HTTP仍0。之前文件保存有成功回执及磁盘断言，未保存段落保留在编辑器／预览；后续大文本、目录改名、回收恢复未执行。交Agent核受理后阶段，项目无确证保存缺陷 |
| 同场景，Electron，原111行 | 实际UI点击及0计数断言有test.trace；实际窗口network为0字节，发送、受理、session/run／worker身份无法绑定。公共UI夹具先补真实窗口RPC和清理前状态，不套Browser结论 |
| 多项目草稿切换，Browser，原400行 | 一次Alpha消息session.send RPC195成功受理，run `cae289fd-3050-4899-b3fc-11059247d6b7`；后续accepted／queued且模型计数0。之前两项目初始文件已写入，切换保留草稿断言已通过；UI无新草稿保存请求，Beta后台发送及后续完成断言未执行。交Agent独立核该run |
| 同场景，Electron，原400行 | 实际UI操作及0计数断言可核，窗口RPC／snapshot同样缺失，不能确证与其他三例同因。归公共夹具补身份链及Agent消费侧核对 |

Browser两例的最后watch仅分别在09:52:21.526Z和49.246Z；queued不能区分进程准入、worker initialize、指令消费或model.acquire。内核bootstrap PID23524／23710不是worker PID，未保留worker实例／PID／准入或模型前阶段，目标项目／配置又被原finally清理，不能事后查询其DB。Browser的kernel.stopping分别晚于原计数断言约1.1秒；清理后的“Not connected…草稿已保留”不作为首因。没有以相似queued或请求0猜同一初始化缺陷，没有增加等待／改期限／改model-server，也没有在项目树并改harness。

### 实际取证操作与证据边界

| 操作 | 结果 |
| --- | --- |
| `git status --short`、`git rev-parse HEAD`、`git show/diff 8c2fd24 HEAD -- <相关路径>` | 起点clean、938c33f。测试／模型夹具／UI配置／workflow及harness核心逐字节相同；当前lifecycle和kernel-fixture新增诊断不能倒写成旧CI证据。精确hash见source-comparison.json |
| `openspec instructions apply --change establish-file-backed-research-tasks --json` | scholoom-dev，27/28、ready，只有原4.1未完；本片不改tasks或规格 |
| `gh api repos/leike0813/Scholoom/actions/runs/40479176954`及其artifacts元数据 | 真实完成run/head匹配，目标Linux artifact未过期。只读本仓库，未触发CI或查询外项目线程 |
| artifact12728680109的只读选取、`unzip -t <四份trace.zip>`、Node解析trace／network的WebSocket JSONL | 四份trace校验通过；选取20文件，内嵌测试源码全与CI／当前树一致。Browser请求／回执／watch已绑定；Electron network为空，目标UI profile／项目DB／worker stderr不在artifact |
| `openspec instructions delivery --change establish-file-backed-research-tasks --json` | 实际取证后获取并更新本记录；无业务实施结果或修复通过结论 |

首次完整archive下载较慢，已停止自己拥有的下载；suffix Range返回200、单个大Range超时均保留原记录。改用明确首尾偏移及256KiB分块取得**同一artifact的目标成员**，不是重跑测试或重试业务。`diagnostics-ubuntu-latest.zip`及`artifact-complete.zip`均为停止后的不完整下载，不能作完整有效archive；有效证据是selected目录的四份校验通过trace及对应成员，清单可复查。未安装依赖、未启动服务或触碰真实用户库。

同模型只读辅助Agent独立核源码版本、承载、模型替身及断言前后动作；父端实际提取artifact并核WebSocket回执。辅助Agent已关闭，没有跨树消息或常驻协调。外部HTTP模型是既有受控边界；真实UI、broker、harness及文件操作未替换。model.hold发生在requests.push之后，不能解释已登记请求计数0；但计数0也不足以排除路径／JSON或更早执行阶段。

本片到“Browser已受理后缺执行细分、Electron先缺窗口身份链”的精确缺证交回停止。Agent及公共夹具按investigation中的绑定身份／字段补证；项目侧本轮无确证业务缺口可修。没有运行构建／本机UI／全量测试：仅文档修改无需重建，且不得用静态普通产品复跑替代旧CI的开发承载。无新增生产符号／协议／映射、无提交／推送／归档；I1／4.4c接收不变，4.1及完整change、科研质量继续开放。
