# 实际交付与交接

## 共同基线1026796后：5.3文献详情消费者

当前HEAD为`1026796d854b8f568c3e819f13268a9638980bc1`，开工前clean；本轮只交付5.3及本机子验收6.1a，当前**18/23**。主线`/tmp/scholoom-round5-acceptance-WBreMJ/{acceptance.md,synchronized.json}`已证明七域源码及本线X1／原值权威／编辑子范围进入dev与当前树；下方早期阶段的“未入dev／等同步／缺项目源码”是历史，不再作为阻塞。本轮未应用旧累计补丁、切分支或同步其他树，未提交／推送／PR／归档、安装依赖或写真实用户库。

### 实际成果与文件／符号

- `library/library-details.tsx`的LibraryDetailsContribution／PublishLibraryDetails／LibraryDetails只贡献和订阅由LibraryContents生成的React视图；不保存第二份metadata、选择、草稿或提交状态。生命周期释放按当前视图身份核对，过期释放不会清掉新视图。`LibraryTab.tsx`保留全部原选择、草稿及saveDetail逻辑，将原CatalogItemPane从中间区移到该视图贡献，增加当前页已选数量／主选摘要；原CatalogItemForm、JSON、标签、集合、关联、历史及附件入口复用。
- `business-session.tsx`每个实例持有一个贡献，新增session.libraryDetails并将同一贡献传入LibraryTab；`session.ts`新增可选ReactNode。`Workbench.tsx`只转交该视图、持有辅助页签选择并对library打开跨组复用已有tab；原flush与overlay收起保留。`shell/AuxiliaryPane.tsx`增加文献详情分支与受控页签，文件／材料／taskNavigator不改。programs、TaskPanel、TaskResearchPort、FileEdit来源、根工具、runtime构造器及各域restore均未修改。
- `library.css`仅调整详情单栏及溢出、辅助页签换行，沿既有语义token；题录详情只挂载一次，折叠／切辅助页签不卸载LibraryContents。库tab卸载清除自己的视图，重开继续原库／窗口草稿及选择。视图贡献没有仓储／DOM读取；原主选get、集合／列表／附件分页及惰性历史继续原路径，不展开全库。
- 复用`library.spec.ts`、`context-bridge.spec.ts`及`resource-opening.spec.ts`，调整详情定位，扩展已有选择／资源场景，覆盖两组库去重、完整草稿、折叠／展开、文件／任务页签、programs入口、Alpha／Beta会话及共同附件；未新建平行产品夹具。其余6份`attachments`、`reading-records`、`pdf-reading`、`document-reading`、`resource-lifecycle`、`material-interactions`仅在实际详情入口增加页签选择；其中attachments已实跑，其余阅读器用例本轮仅类型／lint核对，不声称重新验收阅读专项。
- 更新原design／tasks／literature-catalog delta及开发／文献UI分节，5.3实际前置改为已完成4.1a／b、4.2a／b等子范围，不等待完整复杂映射。图中详情连线与当前设计一致。没有protocol schema、领域存储、迁移或正式规格修改。

### 真实验证及首次问题

证据根`/tmp/scholoom-library-details-round5/`。Linux、Node24／既有锁定依赖；真实Browser及Electron、client／broker／领域仓储、worker与文件。上下文模型在既有loopback HTTP边界受控；save/send RPC gate只用于既有迟到场景，不替代真实提交／权限／仓储。所有库、profile、项目与输入均为隔离合成样本；已登记项目保留在结果目录，不删除仍登记项目或放宽未知停止／容量／生产超时。

| 命令／范围 | 实际结果与证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared`及`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | 通过。共享一次，桌面分别在初片、视觉修正及去重修复后构建；`build-shared.log`、`build-desktop{,-final,-verified}.log`。最终桌面构建1分37秒；每轮测试均在对应构建退出后才开始，测试期间未重建或修改源码。 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json`及`-p tsconfig.tools.json` | 通过，`types-desktop-verified.log`／`types-tools-verified.log`；共享类型随共享构建通过。 |
| 静态双宿主首轮：`SCHOOLOOM_UI_PORT=5725 SCHOOLOOM_UI_DATA_DIR=<证据根>/profile-first xvfb-run -a node node_modules/@playwright/test/cli.js test --config <证据根>/ui.config.mts tests/ui/library.spec.ts tests/ui/context-bridge.spec.ts tests/ui/resource-opening.spec.ts tests/ui/attachments.spec.ts --workers=1` | **24/24，11.0分钟**，`ui-first.log`／`ui-first/`。覆盖类型／原值、未知值、选择／列／分页、多窗口／关闭重开、冲突与迟到保存、X1实际工具、共同资源及附件有界读取；这轮尚未包含后来发现的跨组重复实例回归，不将24项冒充最终一次组合。 |
| 跨组重复库RED：同静态夹具，5727／profile-red，`tests/ui/library.spec.ts --grep 'selection, collection navigation' --project ui-browser --workers=1` | **1失败，16.7秒**，`duplicate-red.log`及`ui-final/`trace。文献库→设置向右拆分→激活设置→再点文献库，真实区域数Expected1／Received2。修复仅在openTab的library分支优先已有库所在组，其他类型仍原规则。 |
| 最终双宿主定向：5727／profile-verified，`--config <证据根>/ui-final.config.mts tests/ui/library.spec.ts tests/ui/resource-opening.spec.ts tests/ui/attachments.spec.ts --grep 'selection, collection navigation|project documents|用户摄取本机材料' --output <证据根>/ui-verified --workers=1` | **6/6，2.4分钟**，`ui-verified.log`／`ui-verified/`。重复库RED转绿，两组返回保留同一多选及未知草稿；真实文件／任务／programs切换、右栏收展、项目会话／资源及附件分页通过。没有重新执行整套24项，原未受去重／CSS影响的场景沿首轮证据。 |
| 首次及最终视觉核对 | 首轮Browser附件截图发现300px右栏将页签文字压成纵排；已有flex-wrap不足以阻止标签收缩。限定新页签行的按钮不收缩／不拆字后重建，最终Browser和Electron附件截图保留；实际查看Browser最终截图，标签横排正常。未据此声称全部主题／宽度验收。 |
| 16份相关源码／测试Biome、architecture、生成器self-test及只读映射核对 | 通过，`lint-verified.log`；`architecture-final.log`为14模块248文件0 findings／exceptions；7份生成输出经既有formatter与现源码一致，`generated-check.log`。未应用生成器纯格式diff。首次lint的callback return／导入格式均在测试前用apply_patch修正。 |
| 本change strict、scholoom-dev schema及diff／补丁核查 | 最终日志见`openspec-*.log`、`diff-check.log`及`patches/patch-check.log`，不以CLI complete称整个change完成。 |

静态服务器明确使用既有`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`与本树已构建renderer；未启动开发服务器。首轮／RED／最终三个profile内核status均stopped，5725／5727无监听，宿主由夹具回收；项目和诊断工件保留，不清理他树执行。

同一原生辅助Agent保持gpt-6.1-sol/high，先只读梳理测试，后仅拥有3份测试的局部编辑并进行独立源码窄审查。其发现跨组重复LibraryContents风险，主Agent实跑确认并修复；最终绿灯由真实双宿主提供。二次静态复核因`Selected model is at capacity`中断，没有伪造该轮审查通过；主Agent源码核对确认library限定分支保留原flush／overlay与其他标签规则，独立审查之外未发现新增确证风险。辅助Agent已关闭。

### 接入、剩余边界与停止点

`<证据根>/patches/`提供相对共同基线1026796的本轮增量：**0001辅助槽位／视图贡献 → 0002文献拥有者接线 → 0003回归与文档**；公共文件只改上述符号，依赖与精确文件清单见README／manifest。逐片应用核查使用仅触及文件的临时载荷，不是另一个工作树或组合构建；实际验证始终在当前正式源码。本轮没有重用旧/tmp累计补丁。

本机子片完成不代表完整B批／I6。1.4目标Windows阶段诊断、4.1／4.2复杂／非一一映射、完整6.1／6.2仍开放；未知值保留JSON核查，不新增映射或来源重绑定UI。没有生态完整事务、C—I、跨平台分发、全仓CI或真实科研质量新结论。现无需要新产品决定才能完成5.3的剩余问题，达到本轮有界目标后停止。

## 2026-10-26 round4：明确映射的B批编辑子范围

主线已在`/tmp/scholoom-round4-acceptance-JCUBNw/acceptance.md`独立接收下文X1及原值／来源／键／事务首片。本轮完成新增子任务**4.1b／4.2b，当前16/22**；原4.1／4.2父任务、5.3、1.4及6.x仍开放，不称整个change或B批完成。HEAD仍为70be8bf，0519904祖先；全部原未提交成果保留。本轮没有同步、提交／推送／PR／归档、安装依赖或真实库写入。

### 当前成果与文件

- `packages/protocol/src/library-metadata.ts`沿唯一编辑目录补20个直接文本字段、17个唯一角色及适用CSL类型，总计32类型／35文本字段／21角色／4日期键。原四角色及开放metadata不收窄；既有非字符串值与不适用字段保留，不从CSL反猜原Zotero类型。来源、精确证据及未支持别名在investigation首节。
- `CatalogItemForm.tsx`及`catalog-metadata.ts`沿同一完整JSON草稿提供新增角色、字段及简单单端点date-parts的年／年月／年月日编辑；已有日期不自动转换，清中间精度不会删除后续值。复杂日期只读核查并保留JSON入口，literal附属属性保留；创建者角色移动保留完整姓名对象。继续原ingest／update、revision及草稿保护，没有另一套原值权威、接口或迁移。
- 扩展既有`tests/kernel/{catalog-metadata,literature-catalog}.spec.ts`及`tests/ui/library.spec.ts`；仅新增一个日期行为测试和一个双宿主场景，领域重启样本复用原用例。手动book录入原出版者／总页数／丛书编辑／数字日期→更正、完整姓名移到editor、切journal并录PMID→真实保存；合成原值／来源／固定键、未知嵌套和复杂日期不变，外部更正冲突保留草稿。内核真正关闭／重开领域库后再核对历史及权威，不以刷新页面代替领域重启。
- 同步原design／investigation／delta spec／tasks及开发说明、文献UI分节，清理当前设计中的旧基线等待、未收到E1／R1及候选X1说明。下方分阶段历史记录保留其当时结果，当前状态以本节及tasks为准。变更总览已将X1连线改为真实已接入，右栏仍为待共同槽位。

### 实际验证

证据根`/tmp/scholoom-library-round4-LRNQ1I/`。Linux、Node24／现有锁定依赖；内部library、broker、JSON-RPC、Browser与真实Electron均真实，配置／项目／库均为隔离合成样本。此次路径无模型需求，既有会话夹具模型仍为受控响应，不新增科研质量结论。先完成共享和桌面构建，再冻结产物运行最终内核及UI，期间只更新规划／文档。

| 命令／范围 | 实际结果／证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared`及`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | 通过，`build-shared.log`／`build-desktop.log`；包括当前正式源码的protocol、library、harness及kernel。未安装依赖。 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json`及`-p tsconfig.tools.json` | 最终通过，`types-{desktop,tools}-final.log`（空日志／exit0）；共享类型随前述构建通过。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts tests/kernel/literature-catalog.spec.ts tests/kernel/library-records.spec.ts --output=test-results/library-round4-kernel-final` | **12/12，8.2秒**，`kernel-final.log`。简单日期／未知值／姓名顺序、真实领域修订／重启／历史、原值／来源／固定键及原子事务回归；没有重跑已接收的X1整套53项。 |
| `SCHOOLOOM_UI_PORT=5725 SCHOOLOOM_UI_DATA_DIR=<证据根>/profile-first xvfb-run -a node node_modules/@playwright/test/cli.js test --config <证据根>/ui.config.mts tests/ui/library.spec.ts --grep 'manual typed fields' --workers=1` | **2/2，42.0秒**，`ui-first.log`／`ui-first/`。新场景首跑两宿主均通过。 |
| 同上静态承载，改端口5727／profile-final／ui-final.config.mts，去掉grep运行完整`tests/ui/library.spec.ts --workers=1` | **10/10，2.5分钟**，`ui-final.log`／`ui-final/`。包含原有未知值、稳定选择／集合分页／列、会话草稿、多窗口及迟到保存／冲突。复用既有static-ui.mjs服务构建后的renderer，不启动开发服务器。 |
| 6个变动源码／测试文件Biome、`node scripts/check-architecture.ts` | 通过，`lint-final.log`；13模块205文件0 findings／exceptions，`architecture.log`。 |
| 生成器`--self-test`及`--patch`只读核对 | 通过，`generator-self-test.log`、`generated-dry-run.patch`、`generated-check.log`。6个输出映射经既有Biome格式化后与现源码一致，其余未输出变更；本轮未增加操作或修改生成映射。 |
| 两change `openspec validate <name> --strict`、`openspec schema validate scholoom-dev`及diff | 校验与收尾结果见同目录`openspec-*.log`、`diff-check.log`及补丁检查。仅修改本change delta，不同步正式规格。 |

最初helper探针`red.log`实际3项已通过，**没有发生本轮业务红灯，不声称红→绿**。构建完成前的中间内核12通过保留在`kernel.log`，最终依据为构建后`kernel-final.log`。首次Biome发现测试import排序，两处用apply_patch调整后6文件通过；未改测试超时、授权断言或分页逻辑。首次及最终日志全部保留为诊断工件。

同一原生辅助Agent保持gpt-6.1-sol/high，仅拥有声明文件的确定性编辑及窄只读审查；主Agent决定范围、实现表单和验收。窄审查确认复杂日期不会进入数字编辑、局部日期模式不改已有值、姓名完整移动及新旧角色边界，无新增确证风险；审查未运行测试，以上实跑由主Agent完成。辅助Agent已关闭，两轮静态宿主退出，profile-first／profile-final内核status均stopped，5725／5727无监听；不操作他树进程。

### 补丁、依赖及停止点

本轮13文件的逐文件前像保存在`<证据根>/before/`，文件清单为`files.json`。`<证据根>/patches/`提供**仅相对本轮前像的增量**，不是包含round3所有既有成果的HEAD diff：0001公共编辑声明→0002表单／日期→0003回归及文档交接。完整依赖及应用检查见目录README和manifest；0003的record／commitRecords回归依赖已验收round3 authority首片。当前真实树已包含这些前置，未把临时载荷检查当作另一基线的构建验收。进入dev仍由主线按符号接入原round3公共提供者及UI后叠加本轮增量。

剩余精确边界：别名／多对一字段、缺少显式映射的原主要角色、复杂日期及Extra逆转换，需精确utilities样本或必要领域决定；暂时保留原值，不猜填。现无阻塞本轮已闭合子范围的新产品决定。5.3待真实项目共同槽位，Windows既有CI阶段诊断及整体I6未关闭；生态HostCatalog、完整BBT事务、来源重绑定UI、创建／删除事务均不在本轮。没有Windows／macOS、全仓CI、真实科研质量新增通过结论。达到授权边界停止。

## 2026-10-26 同步后恢复

用户明确恢复；只读核对HEAD为`70be8bfcda5ab1453c20428f9eb3b367d90ed0b7`、0519904祖先、工作区clean。原成果及暂停前四份OpenSpec更新均保留。主线同步证据`/tmp/scholoom-sync-recovery-wyn13R/{recovery.md,synchronized.json}`报告本树构建、相关类型／架构／映射、内核11/11和UI4/4；这些是同步及已有切片验证，不是本轮X1／事务提供者完成。旧的等待用户手动同步和临时组合条件被恢复指令替代，后续只以当前正式源码为工作点。

## 本轮X1实际交付

本轮完成1.2、5.1、5.2，当前**14/20**；原4.1／4.2完整类型映射、5.3右栏、1.4 Windows及6.x整体交付仍开放，不称完整B批。未提交／推送／PR／归档，未安装依赖、写真实用户库或操作其他真实工作树。

- `protocol/catalog-selection.ts`为同源DTO与结构／语义校验，workbench快照增加可选catalogSelection，工具结果增加可选catalog确认。100题录独立于16显式材料，完整快照仍64KiB；主选／范围／唯一身份／安全整数明确，无附件也可贡献，不造ResourceRef。
- `LiteratureCatalog.selection`按请求身份仅读sourceId／revision，最多100次精确索引读取，不展开metadata／附件、不全库扫描；库身份及read/send在读取前后核对。观察修订保留，当前修订单列，变化为changed；任何缺项／撤权整体失败。
- `ManualApplication`注册library.selection／checkSelection；`KernelApplication`将可信上下文绑定到窄broker读取及同步核查。保留现有资源权限、连接source及receiver。harness在返回工具结果前持久记录实际库身份及已用库标记，原会话不能悄悄切到新库；普通、registered Graph及共用模型的capability在排队前后、最终同步和恢复／重新准入沿同一授权复查。没有只在工具入口检查一次。
- `ContextContributionProvider`独立发布catalog，LibraryTab从同一UUID选择及当前已加载范围贡献；切页／加载／清空及卸载沿原生命周期。Workbench仅新增活动library视图条件，库浏览不改变会话接收者。共享来源／历史、project公共v5→v6迁移、projectId与双窗口fixture、阅读位置／区域／草稿对象及资源叶schema均保留。
- 原值／正式键／事务首片由独立change真实实施，见[其delivery](../define-library-zotero-record-authority/delivery.md)；不混成B批表单任务或声称生态真实接入。

### 本轮实际验证

先构建共享、protocol、library、harness、kernel及desktop；UI期间冻结源码与共享产物。Linux／现有锁定依赖／独立profile与合成库，真实库、broker、worker、JSON-RPC和双宿主，模型为既有loopback受控HTTP，未做真实科研质量验收。

| 入口 | 结果与证据 |
| --- | --- |
| 共享／桌面构建；protocol／kernel／desktop／tools类型检查 | 最终通过。首次遗漏新增操作生成映射；随后模块映射泛型／宽调用联合触发TS实例化过深，采用逐操作FromSchema和窄broker端口修复，没有any兜底或放宽schema。构建／类型日志位于`/tmp/scholoom-library-round3-*.log`，精确命令见对应日志及authority delivery。 |
| `catalog-context-contracts`、`library-context`及records／migration／原catalog／context-query／context-resources／registered-context组合 | **53/53，348.3秒，0 skipped／flaky**。`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{catalog-context-contracts,library-context,library-records,library-record-migration,literature-catalog,catalog-metadata,catalog-selection,context-query,context-resources,registered-context}.spec.ts --output=test-results/library-round3-final --reporter=json`；结果`/tmp/scholoom-library-round3-kernel-final.json`与stderr。 |
| 新X1权限回归 | 真实100题录及17项、陈旧revision、跨库／notFound／撤权；实际工具取回后在模型队列等待期间撤权，及异步授权后最终同步准入撤权，后续HTTP均不发送；重启的新指令仍拒绝。定向**3/3**，`/tmp/scholoom-library-round3-admission.log`，也包含在最终53项中。 |
| 新题录上下文双宿主 | **2/2，1.2分钟**，17条实际多选、分页后在工具调用时取得最新主选／范围、无附件、receiver不变；`/tmp/scholoom-library-round3-ui-first.log`，`test-results/ui-5721`。 |
| 库与共同上下文双宿主回归 | **16/16，6.7分钟**：`SCHOOLOOM_UI_PORT=5723 SCHOOLOOM_UI_DATA_DIR=/tmp/scholoom-library-round3-ui-regression xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/library.spec.ts tests/ui/context-bridge.spec.ts --workers=1`。日志`/tmp/scholoom-library-round3-ui-regression.log`，工件ui-5723；保留显式材料、文本位置、模型读取、重载、迟到回执、稳定选择、列／导航、双窗口草稿及原类型化CSL。 |
| 架构／生成器／lint／OpenSpec | architecture为13模块205文件0 findings／exceptions；生成器self-test及6份格式化映射一致性通过。相关24文件Biome最终通过，单条测试格式再次调整后专项通过；两change strict与diff通过，收尾再查新增文件。 |

新测试首次红灯为旧构建缺少selection／catalog字段，证据`/tmp/scholoom-library-round3-red.log`。没有为基线CI失败加超时；本轮未出现新UI失败。临时测试／格式化payload和所有首次失败日志保留为诊断工件，不成为生产依赖。

### 审查与公共补丁

同一原生Agent保持gpt-6.1-sol/high，辅助仅拥有DTO／迁移夹具明确文件；权限架构、事务与最终验收由主Agent负责。最终独立只读复核未发现X1授权／恢复新确证风险，确认Graph与capability共用模型准入路径。其发现的candidate固定状态问题在另一个change修复并实际回归；静态审查不代替运行结果。

`/tmp/scholoom-literature-round3-patches-EBWcGa/`：**0001-public-catalog-selection.patch → 0002-public-record-authority.patch**，独立公共提供者不依赖私有文献UI。0003-workbench-catalog-consumer.patch依赖0001与本线70be8bf既有UI。公共两片已对0519904受影响文件逐项应用检查；这只是补丁载荷检查，未建立另一源码组合或以其冒充当前树验证。实际构建／测试均在当前已同步树。完整依赖、拥有符号及限制见目录README。

新公共X1与权威提供者尚待主线接入dev及真实消费者同步；不再重复等待本轮已完成的0519904基线同步。右栏、完整映射、来源重绑定UI、完整BBT／SQL／生态生产及Windows／macOS、分发、全仓CI、真实模型科研效果保持开放。达到本轮有界任务后停止，不自动展开下一阶段。

## 第二阶段交接（2026-10-25历史记录）

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
