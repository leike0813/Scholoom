# 实际交付与交接

## 第二阶段当前交接

本轮依用户“主线验收及下一阶段协调”指令继续同树、同change，配置保持Codex／gpt-6.1-sol／high。正式消费主线 `/tmp/scholoom-phase2-handoff-VZS5mS/acceptance.md`、`coordination-plan.md`、manifest及源工件快照；没有操作他树或跨树发送消息。第一阶段局部范围主线接收，无确认本线缺陷。当前任务 **11/20**（含独立子任务），完整4.1／4.2和5.x／6.x仍开放。以下为本轮新增，后面的第一阶段记录保留为实际历史，不能以其当时的“未转交”覆盖本节。

### 已消费输入与实际成果

- **E1已收到**：精确消费 `zotero-ecosystem/openspec/changes/connect-zotero-host-bbt/{investigation.md,evidence/zotero-10.0.5-mapping.json,design.md,delivery.md}`，均相对上述快照根。固定版本与逐字段边界在investigation首节：40→32多对一类型、121字段、37角色／姓名及跨角色顺序、日期、Extra／note均存在不可逆信息。可以解除原1.1调查等待，不能把JSON升级为产品schema，也不以HostCatalog夹具声称真实library provider接入。
- **R1已收到**：分别读取 `research-interaction/openspec/changes/add-material-annotation-interactions/design.md`、`add-interactive-research-reports/design.md`，以及该树 `packages/protocol/src/workbench-context-contracts.ts`、`packages/harness/src/instruction-context.ts`。材料位置增量保持、报告仍仅规划，M1／M2／M3未代为闭合。
- **右栏准确设计**：读取 `research-task-workspace/apps/desktop/src/renderer/src/workbench/{shell/AuxiliaryPane.tsx,session.ts,Workbench.tsx}` 及 `tests/ui/fixture.ts`。真实新增符号是taskNavigator，无已发布library槽位；设计未来libraryInspector单槽位及同一库状态拥有者，保留task活动条件、项目定位与本线第二窗口夹具。仅设计，未跨入公共源码接线。
- **CSL局部编辑**：新增 `protocol/library-metadata.ts` 编辑声明及 `CatalogItemForm`／`catalog-metadata`，共用于手动ingest与详情update完整草稿。支持32个CSL类型、直接文本、四角色姓名与literal日期；移动完整姓名对象，保留类型专属、复杂日期、note／citation-key及未知嵌套值。UI和JSON共享同一metadataText，沿原16KiB、修订、冲突和迟到回执保护，没有迁移或新依赖。UI设计和开发说明已同步。完整4.1／4.2仍保持开放。
- **X1公共审查稿**：原design给出独立catalogSelection、当前查询范围、主选、100项容量、16项材料／64KiB预算、观察与当前修订分离、真实library核对及三类模型准入／恢复复查、提供者与文件清单。未注册生产接口、未修改harness／kernel／Workbench公共接线，不把候选当已发布。
- **单独公共规划**：`openspec/changes/define-library-zotero-record-authority/` 已有proposal、investigation、specs、design、tasks，schema为scholoom-dev。原值、来源关联、正式键／固定状态及原子提交从表单拆开；来源副本、键冲突比较、首批原子范围三个政策保持受阻。该change无实际实施、迁移或delivery。

本线向生态实际提供：CSL编辑能力声明、未知值保留规则、原值与键领域权威的候选设计。**尚未提供**：原始Zotero记录存取／身份绑定、正式键／固定状态、SQL／saveTx、多对象提交、回执和提交后通知的真实生产端口。生态完整宿主不是CSL局部编辑前置，但生产适配仍需这些提供者。

### 独立公共补丁与依赖

临时交接目录 `/tmp/scholoom-literature-public-XAoMaz/`，精确文件及边界见其README：

1. `0001-library-collection-parent-scope.patch`：独立protocol／library／catalog测试增量，不依赖本线私有UI，以e3d58fc为基线。
2. `0002-native-csl-editing-declaration.patch`：同文件合并顺序在0001之后，仅CSL编辑声明及导出，不收紧开放metadata。局部表单消费它，公共补丁本身不依赖UI。
3. `0003-X1a-unregistered-review-candidate.patch`：独立未注册叶声明候选，无0001／0002语义依赖，**不能单独启用**题录上下文。隔离编译和结构断言不代表授权／模型管线通过。

三份均已对临时基线文件`git apply --check`并实际应用验证；未提交或接入dev。X1顺序为a审查同源声明／快照delta → b文献与宿主真实provider → c harness权限追踪与模型前复查 → dev接入验证／用户同步 → d本线UI；右栏先接项目共同增量再由单一库状态接槽位。候选源、编译依赖复制和self-check只在临时目录，不拷入其他领域私有实现。实际产品接线尚未具备，5.x保留开放。

### 本轮实际验证与失败保留

Linux、既有锁定依赖及隔离合成库。共享构建完成后才跑库内核测试；桌面最终构建完成后启动UI，所有UI期间未修改renderer源码或重建共享产物。UI夹具启动其拥有的测试宿主，不启动日常开发实例。

| 入口 | 实际结果／证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared`、`build`，修复禁用目标后`--filter @scholoom/desktop build` | 均通过，`/tmp/scholoom-library-phase2-{shared,build,desktop-build}.log`。没有依赖声明／锁文件变化。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{catalog-selection,catalog-metadata,literature-catalog}.spec.ts --output=test-results/library-phase2-kernel` | **11/11，4.6秒**，真实SQLite／授权、既有修订与备份、完整CSL及历史重启读回；`/tmp/scholoom-library-phase2-kernel.log`。helper初次RED为文件尚不存在，随后独立2/2通过，保留red／metadata日志。 |
| `tsc --noEmit -p packages/protocol/tsconfig.json`、`apps/desktop/tsconfig.json`、`tsconfig.tools.json` | 最终全部通过；首次desktop消费旧protocol dist报缺导出，shared重建后通过，不修改业务类型以迎合旧产物。 |
| `node scripts/check-architecture.ts` | 13模块、201文件、0 findings／exceptions，`/tmp/scholoom-library-phase2-architecture.log`。 |
| 改动相关24文件Biome | 通过，保留CatalogItemRow两处既有any警告；`/tmp/scholoom-library-phase2-lint-final.log`。 |
| contracts生成器self-test及`pnpm generate:contracts` dry run | 通过；6份生成映射按既有Biome格式化后与现文件相同。dry-run `/tmp/scholoom-library-phase2-contracts.patch`未应用，无新增操作键。 |
| 首轮library＋attachments双宿主（5721） | **10通过／2失败**；新增typed测试的嵌套has定位器无匹配，失败未进入创建者保存。`/tmp/scholoom-library-phase2-ui-first.log`、`test-results/ui-5721`；附件4项已通过。 |
| typed定向复跑（5723→5725） | 首次2失败：Playwright对原生option的toBeDisabled报告enabled，但trace中option已有disabled；改为核对原生disabled属性后**2/2，39.7秒**，两宿主真实保存及刷新读回完整未知值。日志`/tmp/scholoom-library-phase2-ui-focused{,-final}.log`，产物ui-5723／5725。 |
| library整组复跑（5727→5729） | 首次**7通过／1失败**：Electron旧用例从默认25集合中找新集合，浏览器先前场景已累计超过25项；UI实际读limit100。测试与真实UI有界范围对齐为100，不改业务或超时。最终**8/8，2.2分钟**；完整命令`SCHOOLOOM_UI_PORT=5729 SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-library-phase2-ui-final xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/library.spec.ts --workers=1`。日志`/tmp/scholoom-library-phase2-ui-{verified,final}.log`，工件ui-5727／5729；本轮附件4项通过的证据仍在首轮5721，不混称一次12/12。 |
| X1a候选隔离编译／结构self-check | 最终通过；0／1／17／100、101拒绝、重复ID、主选、安全整数、页容量；超64KiB样本明确仍需未来完整快照边界拒绝，叶声明不承担该预算。临时首次编译缺依赖的失败保留candidate-compile-first.log；补齐本树只读编译依赖后通过，不是新依赖安装。没有X1真实授权、模型或恢复验收。 |
| 两change OpenSpec strict、scholoom-dev schema及diff检查 | 规格长正文首次strict警告后拆为独立容量／模型准入Requirements，最终两change及schema校验通过；收尾再核对任务／交付diff。 |

收尾已确认：相关类型检查、24文件lint、两change strict及diff通过；23个新增文件另做空白检查。5721／5723／5725／5727／5729无监听，五个本轮隔离UI配置的kernel status均为stopped。`test-results/ui-5721`至ui-5729的实际轮次、日志、隔离配置及公共补丁目录保留用于审查／诊断；临时格式化payload和候选编译依赖仅是临时工件，不成为生产依赖。未提交、推送、创建PR或归档。

### 审查、待决与停止点

复用同一原生只读Agent，gpt-6.1-sol／high，未开新Agent终端。新增表单审查发现：合法开放metadata若目标角色为非数组，切换会触发helper拒绝而未捕获。按代码给出触发条件后禁用不受支持目标，双宿主实际验证禁用、合法角色移动及原值保存；窄复核确认关闭，未发现新的规划越权或虚构提供者。审查只静态阅读，实际验证由本线主Agent完成。

三项需主线决定：来源副本身份A/B、键冲突大小写比较A/B、首批单条或有界多对象原子范围A/B；选项及依据在新公共规划investigation。X1与右栏还需真实提供者及dev共同基线；排序只保留本批列配置／F查询排序，不实施新增排序。Windows既有CI失败仍无目标环境阶段诊断，不加超时；未验收完整CI、跨平台分发、真实模型科研质量或生态生产写入。完整B批和本change未完成，不归档，停止于本轮局部任务与公共方案交回，不展开C—I。

## 第一阶段实际成果（保留当时记录）

2026-10-25，用户在本树要求实施，并明确“暂无跨线结果，先完成独立任务”；另授权按锁文件安装依赖。当前完成 **4/16**：2.1、2.2、3.1、3.2，其余保持未勾选。业务与工件均未提交；未操作其他工作树、真实用户库或创建PR，没有归档。本记录是独立增量交接，不能称B批或整个change完成。

- `CatalogSelection`以稳定身份和独立主选／锚点替换行号集合；React订阅同一快照，范围选择只取当前页，重排按身份保持、翻页重新核对。移除未使用的索引调整及重复单选回调。
- `LibraryTab`先取得实际库身份，再按配置／工作台实例／库装配导航与草稿；选择及滚动按查询范围恢复，列偏好独立保存。复用既有draft存储与窗口身份，没有全库投影或公共工作台provider。领域有界读取hook供列表及集合树复用。
- 题录更正仍提交完整metadata和原revision。保存状态在tab卸载后继续保留；回执只核对当前持久草稿，保留后续输入并推进对应修订。失败按原对象保存和订阅，旧组件不会覆盖新画面；显式丢弃重读需要确认。旧题录／JSON导入草稿可明确恢复到空目标，原键保留。
- `library.collections`增加可选父范围：null为根、身份为直接子项，未指定仍为扁平分页；SQL筛选发生在原分页前，只访问集合表。集合导航按需展开各父级当前页，收起不继续读取隐藏分支；保留既有集合创建和归属编辑。
- 当前五列提供显示、顺序、宽度设置，题名保持可见；沿原虚拟列表及语义token。右栏、类型化编辑、题录上下文公共契约均未进入实现。UI设计和开发说明已同步独立增量现状。
- 双宿主夹具增加同一内核的第二工作台窗口：浏览器沿同context新页，Electron用实际BrowserWindow和产品一致的preload／sandbox／隔离设置；不绕过真实UI、保存或权限路径。

实现对应[design](design.md#变更总览)中已选本线部分：文献权威、client／broker及共同资源不变；字段目录和上下文桥的待输入连线仍未接入。实际文件以本树diff和上述入口为准，未新增数据库迁移或依赖声明。

## 实际验证

Linux，Node24.12.0、pnpm11.10.0；依赖通过 `pnpm --config.optimisticRepeatInstall=false install --frozen-lockfile` 准备，Electron通过既有锁定安装器准备。`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`未修改。内部客户端、broker、SQLite、库文件及工作台真实，外部模型使用现有loopback受控HTTP及合成材料；没有真实模型科研验收。

| 命令／范围 | 实际结果及证据 |
| --- | --- |
| 选择模型红→绿 | 旧模型执行身份选择探针报`select is not a function`；实现后Node隔离断言及正式选择测试通过。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-selection.spec.ts tests/kernel/literature-catalog.spec.ts --output=test-results/library-independent-verified` | **8/8，4.0秒**；身份／范围及订阅、56集合多级跨页、权限、修订冲突、批次、恢复和备份。日志 `/tmp/scholoom-library-kernel-verified.log`。 |
| `pnpm --config.optimisticRepeatInstall=false build` | 最终全仓通过，日志 `/tmp/scholoom-library-build-final.log`；最终构建后才启动下面的UI验证，期间没有改动源码或重建共享产物。 |
| `pnpm --config.optimisticRepeatInstall=false typecheck` | 最终全仓通过，含shared构建、各包及tools；在UI退出后运行，日志 `/tmp/scholoom-library-typecheck-final.log`。desktop及tools的独立检查也已通过。 |
| `node scripts/check-architecture.ts` | 13模块、198文件、零findings／exceptions。 |
| 改动相关19文件的Biome检查 | 无错误，保留`CatalogItemRow`的两处既有`any`警告，日志 `/tmp/scholoom-library-lint-final.log`。 |
| `pnpm generate:contracts` dry run、生成器`--self-test`、business映射经Biome格式化后与schema生成值比对 | 通过；映射引用原schema，无新增操作键，不需修改生成映射。临时dry-run输出 `/tmp/scholoom-library-contracts.patch` 作为核查依据保留，未应用格式性差异。 |
| `SCHOOLOOM_UI_PORT=5729 SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-library-final-DV4VzC xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/library.spec.ts tests/ui/attachments.spec.ts tests/ui/resource-opening.spec.ts tests/ui/resource-lifecycle.spec.ts --workers=1` | **14/14，4.0分钟**，Chromium和真实Electron；稳定多选／Ctrl-Enter、分页／重排／滚动、三级集合及分页、列偏好刷新、双窗口、跨tab卸载迟到保存、失败归属、旧草稿恢复、冲突、附件与资源打开／取消。日志 `/tmp/scholoom-library-ui-verified.log`，工件 `test-results/ui-5729`。 |
| `openspec validate complete-library-catalog-workbench --strict`、`git diff --check` | 最终记录及任务更新后通过；新增文件另检查空白。 |

UI最终配置为 `/tmp/scholoom-library-final-DV4VzC`，项目及材料由各测试创建隔离样本，端口5729；早期轮次用5721／5723／5725／5727的独立配置。测试宿主均由原夹具回收，最终端口无监听，`node apps/kernel/dist/cli.js status --data-dir /tmp/scholoom-library-final-DV4VzC`返回stopped。日志、trace、截图、配置和测试产物作为诊断依据保留；临时格式化payload已移除。查看过浅色库截图，未据此声明全部主题／窄宽视觉验收。

## 审查与问题处理

独立原生Agent保持`gpt-6.1-sol/high`，只读检查实际契约、diff、调用方和测试，主Agent承担实际运行及最终接受。首次发现四项：

1. 跨tab卸载后旧成功回调可能清新草稿。取消旧ref清持久数据，按当前草稿核对并订阅修订，保存状态跨卸载；双宿主新增实际卸载竞态通过。
2. 翻页加载空态可能触发滚动事件覆盖目标记忆。只在当前范围已恢复后保存滚动，双宿主往返滚动通过。
3. 旧JSON导入草稿缺恢复入口。补显式空目标恢复并保留原值，双宿主验证通过。
4. Enter的激活回调再次单选。移除无实际用途的回调，Ctrl／Cmd-Enter多选通过。

同Agent窄复核确认四项关闭，没有发现修复直接引入的新风险；该复核仅静态阅读，不替代主Agent的14项真实UI结果。收尾补充错误存储订阅，确保重开tab也收到迟到失败，再经最终整组验证。

前期失败均保留边界：首次根typecheck因辅助测试从根未声明包入口导入失败，改为现有dist相对入口后desktop／tools通过；首次UI新场景发现搜索防抖期间旧行可点击，现搜索切换期间不展示旧结果。其余新测试定位错误将select选项算作列表选择，已限定到listbox。Electron不支持Context.newPage，改原生窗口夹具；第二窗口默认尺寸造成指针被dock遮挡，改为产品初始尺寸后专项通过。没有通过加超时、强制点击或修改产品权限来掩盖这些问题。首次领域测试与构建重叠的结果未作为最终依据，最终8项在稳定构建上重新运行。

## 未完成事项与下一步

当前仅独立任务完成，进度以[tasks](tasks.md)为准；6.1及6.2保留未完成，不以本次记录存在代替整change交付。

- E1：生态固定10.0.5类型、字段、创建者、来源身份和插件写入调查尚未转交；4.1／4.2不实施，不把期刊样本外推完整映射。
- X1／R1：题录上下文公共方案及两份阅读交互design仍缺，5.1—5.3不实施；没有虚构题录ResourceRef、扩大16项证据容量或复制窗口关联。
- P1：排序承接仍未确认；本批只交已明确的列偏好，保留原服务端默认顺序。
- 1.4：本轮没有Windows环境及该基线失败的重现实跑；原调查断点及待提供者诊断保留，不改生产超时。完整CI、Windows／macOS分发、真实模型和科研质量均未验收。

接续先取最新apply instructions、读本记录及等待输入表。只在用户转交实际证据或确认公共方案后更新相应契约和分支；保持本轮锁定依赖及实施授权，不提交、推送、归档或操作其他工作树。
