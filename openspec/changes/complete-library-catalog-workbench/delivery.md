# 实际交付与交接

## 58eda140：C首片规划接续

按第十四轮授权在[complete-library-organization](../complete-library-organization/proposal.md)规划既有题录集合成员／标签的有界原子整理及可逆记录；调查、适用规格、设计和任务另归该change，不在B复制。没有新增B业务实现或重跑已绿字段／滚动／5.4a／6.1b，本记录只补接续入口并修正tasks末尾被主线新Mac目标证据取代的等待表述。B的4.1／4.2仍关闭，1.4、完整6.1／6.2仍开放；不据C规划归档或宣称全平台／科研质量完成。

## 第十四轮主线验收

本轮两工件已保全合入，独立规范／规格审查均接受4.1／4.2限定父项关闭依据：固定oracle与现有子项覆盖足够，没有把未知CSL表达或更宽编辑能力冒充原Zotero映射。原8项内核／4项表单双宿主证据已核，不重复绿色整合。余项仍为1.4、完整6.1／6.2。

新f4ab1e5／Checks40622631905的Mac job成功，人工双宿主14项包含新滚动源码，降级4、入口4及目录打包亦通过；目标子项接收，不等于全功能Mac或发布。Linux758通过／1显示预检失败／26跳过，后续UI未运行；Windows按后续真实回执。下一片按原批次规划C组织与附件，不等待所有平台整项，也不跳过C／D去实施E删除恢复。事实及后续边界见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)，本机原始证据在`/home/joshua/.cache/scholoom-round14-acceptance/`。

## f4ab1e5f：4.1／4.2既定字段与表单父项验收收尾

本轮开工核HEAD`f4ab1e5f1ed17ae9af656c1f9945005a2786d911`且clean。只更新本change原tasks／delivery，**4.1、4.2父项关闭，29/32**；其余为1.4及完整6.1／6.2。没有生产、测试、规格、设计或公共夹具／workflow改动，也没有新产品范围选择。此前父项“留作覆盖／验收收尾”是已交付a–d子项的重复待办；本轮逐项核证后移除该重复等待，不把字段验收等同全平台、完整change或科研质量。

### 覆盖表及实际差距

| 既定契约 | 独立依据与当前消费路径 | 覆盖与边界 |
| --- | --- | --- |
| 32 CSL类型 | 固定Zotero10.0.5 schema44的csl.types；protocol/library-metadata.ts→CatalogItemForm类型目录 | 键集合完全一致，无重复或遗漏。40个原Zotero类型的多对一投影不能据此逆推原类型。 |
| 44文本字段与适用类型 | schema44的47文本目标减citation-key／note／历史shortTitle；utilities_item.js的baseField及类型特例，固定film／computerProgram／patent／case输入 | 全键及适用范围无漏项；title-short不覆盖shortTitle，genre不改条目type，references不改关联身份。software.language及词典／百科ISSN三个适用项比固定投影更宽，属已有CSL编辑能力，不表示Zotero原值映射。 |
| 22创建者角色 | schema44姓名映射的唯一目标及主角色author回退；同源角色目录→同一表单／moveCatalogCreator | 无键或适用范围遗漏。family／given／literal显式更正、机构／单名、角色移动及组内排序均保留完整对象；四个通用角色已有更宽类型范围，不重建Zotero跨角色orderIndex。 |
| 四日期键与数字范围／circa | issued／accessed／submitted／original-date；固定CSL1.0.2 schema、官方两端／uncertain样本及citeproc-js1.4.61条件 | 四键齐全；literal、1–2个正整数端点与各端连续精度、布尔／数值0／1 circa均有明确编辑。现有日期目录不按条目类型限制，不能据此声称原Zotero每类均有对应字段。 |
| 完整草稿、保存与权威保护 | LibraryTab的同一个CatalogItemForm／完整JSON草稿→真实library.ingest／update；LiteratureCatalog的开放schema、DOI／16KiB、授权／CAS／历史 | 类型切换仅改明确键，未知嵌套及未编辑属性保留；非法数字／原生badInput不破坏草稿。原值、来源、正式键／固定状态属于library独立记录，CSL更正不双写；代表测试验证冲突、reload及真实领域关闭重开读回。 |

**没有发现本范围内尚未满足的已定合同。** 以下是明确保留边界，不另列实现缺口：九个可含数字的文本目标volume／issue／page／edition／chapter-number／collection-number／number／number-of-pages／number-of-volumes既有数字值继续JSON核查；额外CSL类型／角色、available-date／event-date、复杂姓名属性、日期数字字符串／开放末端／BCE／季节／非公历／raw或literal混合不自动转换。未知circa如字符串"0"不猜作false；支持的数字端点可局部更正而保留该标记。任意开放metadata可保留并不证明符合CSL标准。Zotero逆映射、Extra解析、别名合并、原值同步、CLI持久配置及C—I仍不在本片范围。

### 独立输入与核查可复现性

必需oracle现为`/home/joshua/.cache/scholoom-round13-acceptance/preserved-oracles/`，`manifest.json`列11文件及旧／新路径；本轮核11个cache目标均存在。元数据组为`scholoom-library-metadata-round6/{schema44.json,utilities_item.js,upstream-oracle.json,upstream-probe.mjs}`，schema commit70c3aa98627413d6a30dca955886eafbde085ce9、utilities commit1dd38e27edf81e9d9c4161c957b7efb7f5681ac3；日期组为`scholoom-library-date-round7/`中的CSL schema、四份官方样本、citeproc属性源码及standard-probe.mjs。只用这些保全输入，未读取旧/tmp内容。

本轮结果根`/home/joshua/.cache/scholoom-literature-round13-ke1Xiw/`：`catalog-scope-audit.mjs`为可重跑的只读目录调查，`catalog-scope-audit.json`列全部32／44／22／4键、字段／角色／日期的独立上游投影与实际适用类型、原始missing／extra。预期来自schema／转换器而非产品声明，所有missing为0；已存在的更宽CSL能力完整列出，不把这些extra伪称Zotero可逆。父Agent核查了别名处理、适用范围特例及原数据来源，最终关闭判断由父承担。

辅助使用原生gpt-6.1-sol／high、fork_context:false，只读对照目录；为保全必要调查代码，另明确授权它仅新建上述cache脚本与JSON，没有仓库写入。辅助已完成并关闭。输入及脚本不在当前/tmp，主线可直接从cache复核，不依赖本会话或旧暂存目录。

### 实际验证与接线边界

以下R为`/home/joshua/.cache/scholoom-round13-acceptance`。所有命令先`export TMPDIR=/home/joshua/.cache/scholoom-literature-round13-ke1Xiw/tmp`，使用已有Node／依赖。同步构建与类型／架构证据复用R的`literature-workbench/sync-build.log`（SYNC BUILD TYPECHECK AND ARCHITECTURE PASSED）；本片无生产／测试改动，不重复构建，测试期间产物冻结。

| 命令／依据 | 实际结果 |
| --- | --- |
| `node <R>/preserved-oracles/scholoom-library-metadata-round6/upstream-probe.mjs`；`node <R>/preserved-oracles/scholoom-library-date-round7/standard-probe.mjs` | 首次均通过，`upstream-probe.log`／`standard-probe.log`。4份固定转换样本及官方日期／circa输入独立核对，不把产品输出当预期。 |
| `node <本轮根>/catalog-scope-audit.mjs` | 退出0、passed=true，完整目录无漏项；字段／角色／日期更宽适用性分别3／66／60对，原始差异保留并解释，无新增产品白名单或schema约束。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts tests/kernel/literature-catalog.spec.ts --grep 'typed field edits\|remaining native CSL\|numeric CSL date\|circa is explicitly\|simple CSL date\|creator role changes\|native CSL alias\|typed CSL changes retain' --output <本轮根>/kernel --reporter=list` | **首次8/8，8.5秒**，`kernel.log`。真实LiteratureCatalog／SQLite／文件，覆盖明确字段、姓名对象与顺序、数字范围／circa、非法及复杂值保留、原值／固定键、CAS及关闭重开历史读回。 |
| `node <R>/create-ui-config.mjs <本轮根>/ui-generated.config.mts`；`xdpyinfo`；`SCHOOLOOM_UI_PORT=5996 SCHOOLOOM_UI_DATA_DIR=<本轮根>/profile node node_modules/@playwright/test/cli.js test --config <本轮根>/ui.config.mts tests/ui/library.spec.ts --grep 'native CSL fields and ordered host names\|manual typed fields, creators and calendar parts'` | 显示预检通过；**首次双宿主4/4，1.7分钟**，`display-preflight.log`／`ui.log`／`ui.json`。两场景分别覆盖原生字段／host及手动字段／日期／badInput／冲突草稿，没有重复滚动或业务整合组。 |
| OpenSpec strict／scholoom-dev schema、apply进度及diff／patch检查 | 通过，`openspec-strict.log`／`openspec-schema.log`／`apply-final.json`／`diff-check.log`／`patch-check.log`。只关闭4.1／4.2，不因CLI ready关闭剩余项。 |

UI配置由主线cache生成器在本cwd生成，薄包装仅指定cache输出／JSON报告及保留配置的停止收尾；静态入口是`<R>/preserved-tmp/static-ui.mjs`。内部客户端、broker、领域、持久库及双宿主组件真实；样本为合成隔离数据，原值／键准备也走真实commitRecords。模型未参与、无工具结果或UI状态替身。上游probe的ItemFields／CreatorTypes是schema查询facade，citeproc条件为VM内独立片段；它们不是Zotero宿主、生产引用渲染或原日期／Extra解析验证。

本轮没有首次失败或修复代码，所有选定检查首跑通过；未制造RED。当前UI为真实保存／CAS／页面reload，内核代表测试为领域仓储关闭重开，不能写成本轮新CLI进程配置恢复。既有6.1b、5.4a、滚动及主线诊断修正2/2证据保持原范围，未机械重跑，library.spec中的catch、空观察及save参数有界副本完全未改。

### 交回与未验

未查询或轮询新CI；正式平台输入沿R及共同计划第十三轮，Windows专项成功不替完整组692通过／46失败／42跳过，Mac新滚动源码未验。字段父项无新增决策要问；1.4、完整6.1／6.2的平台／独审判据、CLI持久配置、三平台分发与科研质量继续开放，不自动推进C—I。

交回`<本轮根>/field-coverage-closeout.patch`，只含本change tasks／delivery，基线依赖f4ab1e5f，无新公共补丁顺序。结束时5996无监听、profile内核stopped，自有UI／静态服务及窗口已收尾；隔离配置／库留cache，不删除登记目录，不停止共享显示。未安装／升级／下载依赖、操作真实用户库／其他树、同步／提交／推送／PR／归档。已核必需输入、调查脚本、配置、日志和补丁均在Git或cache；旧/tmp路径仅留作历史证据。

## 第十三轮主线验收

本轮六文件已保全合入。Standards两项P2及Spec一项P2对应两个实际缺陷：诊断finally异常覆盖原失败，以及每事件枚举全部localStorage。主线删除全存储读取，save只记录原参数的有界副本；缺失观察按空数组处理，诊断错误独立annotation，client仍finally释放。独立内存故障注入核EDQUOT、页面关闭、未安装观察及1000无关存储项，原错误均保留、无全存储读取；只读复核关闭两项。原滚动200断言及期限未变。

完整构建／类型／架构／生成映射通过，主线三场景双宿主6/6；诊断修正后题录原场景另2/2。本机产品窗口修复接收，Mac内部原次时序及新源码目标未验。固定映射、日期oracle共11文件已保全到`/home/joshua/.cache/scholoom-round13-acceptance/preserved-oracles/`，两组probe在新位置通过；下一片覆盖收尾使用该独立预期，不读原/tmp。主线证据、review-fix-verification及下一片见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)；完整6.1／6.2和平台不因定向绿关闭。

## ba29ee61：分页滚动本机竞态修复，Mac目标待验

开工HEAD`ba29ee61ac6f8700cfe6a9fbaa529a8a7a75aad1`且clean。本轮完成3.2b本机子项，当前**27/32**；没有用CLI状态关闭完整change、Mac或科研质量。只改CatalogItemList、原library.spec单场景及本change的design／investigation／tasks／delivery，共六文件。原字段不支持表达清单、6.1b／5.4a接收范围保持；没有重复这些已绿整合或BBT、改公共fixture／rpc-gate／model-kernel或增加生产配置。

### 已核事实及唯一修复

已消费Checks40591705520／29cd728的目标Mac Browser trace（artifact12774334158），原断言是返回第一页scrollTop200→0，不是列宽；Electron同run通过。当前相关测试／列表源码与该run相同。trace证明离页前原生200、虚拟首行变化及分页空载入／占位变化，没有草稿写入、恢复门或真实clientHeight；**不能据此断言Mac实际内部根因已经确定**。细节与时间点沿[investigation](investigation.md#ba29ee61新mac滚动回执与本机因果实验)维护。

本机原场景自然双宿主2/2，随后在同一场景用可释放帧门延后浏览器RAF回调，确定性RED1失败：clientHeight136／scrollHeight700足够滚动，真实scroll200与虚拟首行已提交，但旧restoredRange仍关闭、没有save200，翻页返回实际0。该实验直接证明“列表可交互而保存门等待下一frame”的产品窗口。窗口闭合后使用同一延后frame场景GREEN双宿主2/2；实际save200及返回200由有界诊断记录。

生产修改只在`CatalogItemList`：useLayoutEffect在DOM占位提交后恢复位置，随即同步开启**同一个**restoredRange保存门；空列表和清理仍关闭。移除RAF延后开门，不新增状态、恢复权威、查询、DOM耦合或尺寸等待。虚拟化、页容量、身份选择、CSL／原值权威与所有生产时限未变。该修复没有结构／样式／token变化，现有UI设计及导航契约适用，无新规格行为。

原library.spec场景保留上述代表时序回归，原200精确断言、90秒预算与默认5秒poll不变。测试帧门仅延后回调，不注入UI选择、库响应、保存结果或工具结果；真实客户端、内核／领域、SQLite、静态产品、Browser与Electron均沿既有接线，模型未参与。有界诊断最多256事件／文档，记录同一列表的scroll／实际保存、几何及对应滚动偏好；跨reload保留前段观察。详细临时scrollTop setter探针已删除，RED完整证据仍保留。

### 实际命令、首次失败及最终结果

证据根`/home/joshua/.cache/scholoom-literature-round12-adT7WM/`。UI／诊断使用独立profile／输出／TMPDIR，DISPLAY=:99先经xdpyinfo预检；不启新Xvfb或开发服务器，不关闭共享显示服务。一次zsh heredoc出现/tmp配额失败后改bash及cache TMPDIR，未把它计为产品回归或清理旧工件。

共同UI命令为：`TMPDIR=<根>/tmp DISPLAY=:99 SCHOOLOOM_UI_PORT=5841 SCHOOLOOM_UI_DATA_DIR=<独立profile> SCHOOLOOM_ROUND_OUTPUT=<对应输出> node node_modules/@playwright/test/cli.js test --config <根>/ui.config.mts tests/ui/library.spec.ts --grep 'library selection, collection navigation'`。config只替换为既有`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`静态承载，原fixture与同源业务路径不变；没有依赖DEV样例。

| 执行 | 实际结果与证据 |
| --- | --- |
| 原产物、profile-first／ui-first，原单场景加观察 | **2/2通过，1.1分钟**，`ui-first.log`／`ui-first.json`。未自然复现，不称Mac问题在本机稳定出现。 |
| 同源未改生产产物、profile-red／ui-red，增加可释放帧门，附`--project ui-browser` | **1失败**，原200→0及真实几何／无save在`ui-red.log`、`ui-red.json`、目标catalog-scroll-observation.json和trace。RED发生在帧释放前已有漏存，后续测试闸门取消映射修正不改变该证据。 |
| `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | **通过**，`build-desktop.log`。只构建受影响桌面；共享／内核沿主线已验同源产物，产物冻结后才运行GREEN，没有测试期间重建。 |
| 构建后同UI命令、profile-green／ui-green，保留延后frame | **2/2通过，1.0分钟**，Browser18.6秒／Electron21.8秒，`ui-green.log`／`ui-green.json`及两宿主catalog-scroll-observation.json；提取`green-scroll-facts.json`显示Browser136／700、Electron161／700下真实save200及恢复200。只跑这个代表场景，不重复14UI／6.1b／原包。 |
| `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop typecheck`；`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | **通过**，`desktop-types.log`／`tools-types-final.log`。 |
| `node node_modules/@biomejs/biome/bin/biome check apps/desktop/src/renderer/src/workbench/library/CatalogItemList.tsx tests/ui/library.spec.ts`；`node scripts/check-architecture.ts` | **通过**，`biome.log`／`architecture.log`，架构0 findings。无协议／生成映射改动，不新增生成任务。 |
| 当前apply及delivery instructions；OpenSpec strict／scholoom-dev schema；diff／增量patch核查 | **通过**，`apply-final.json`／`delivery-instructions.json`／`openspec-strict.log`／`openspec-schema.log`／`diff-check.log`／`patch-check.log`。仅3.2b本机子项勾选。 |

使用原生gpt-6.1-sol／high、fork_context:false辅助只读核调用链及独立审查。产品layout effect修改未发现阻塞问题：旧scroll事件读取派发时当前DOM位置，空载入仍拒绝保存，不能把旧事件晚到直接等同跨范围覆盖；仅删除RAF但继续普通effect仍缺提交前保证。辅助指出测试释放RAF后应保留原ID→重排原生ID映射，父Agent已修取消与同状态早返，辅助再核确认闭合；最终GREEN由父执行。没有新增共享接口或产品选择需要本轮定案。

### 交回与未验

新Checks40613967267只读核一次，head e3c815b与输入一致；截点整体／Linux／Windows仍in_progress、Mac job completed/failure，`ci-current.json`保留状态。未消费该job指定场景或查其失败原因，未继续查询／轮询／触发CI；不能当修复源码的Mac实跑。Windows diagnosis40613967285没有本轮新增结论。旧29cd728完整CI的正式平台输入见主线第十二轮记录，计数不推同因。

结束时5841无监听、profile-green CLI status为stopped，原UI／静态进程及自有窗口已收尾，隔离库／配置留在cache根，未清理登记目录；共享DISPLAY保持。辅助只读Agent已关闭。无安装／下载依赖、真实用户库、其他树、提交／推送／PR／归档或自主同步。

交付`<证据根>/catalog-scroll.patch`，仅六文件，依赖共同ba29ee61；没有额外公共补丁顺序或旧累计内容。Mac目标需将该增量接入后，在实际Mac运行同一场景并保留几何／保存阶段；本机因果实验及GREEN不能替代它。完整Windows、父4.1／4.2收尾、完整6.1／6.2、标准CLI持久配置、分发与科研质量继续开放；达到本片边界停止。

## 第十二轮主线验收

6.1b五文件增量已保全合入，独立两轴审查无确证缺陷。主线完整构建后用已合入的新model-kernel运行原整合：Browser通过，Electron首次显示服务启动失败，复用预检通过的已有DISPLAY后通过。真实产品入口收录／更正、集合／列／多选、原会话工具读取及手动／模型内核重启读回均执行，外部模型受控，未代写工具结果。首次与补验分别在`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/main-ui*`及electron-recheck，不称一次2/2。

本片32类型／44文本／22角色／四日期键的具体已交付与不支持表达清单接收，不能把它当Zotero逆映射或CLI持久配置已提供。新29cd728／Checks40591705520的Mac人工UI13通过／1失败，实际Browser分页返回时scrollTop预期200／实际0（原746行），是新的目标负例；旧431通过不能关闭它。下一片聚焦该场景保存／投影／几何／恢复边界，不重复已绿6.1b或混成列宽。父4.1／4.2、Windows、完整6.x／分发与科研质量仍保持原不足。

## 29cd728：6.1b Linux真实业务整合

开工核HEAD`29cd7283388dfd752911eacb9c3bf8416031db15`且clean；本轮只完成6.1b，当前**26/31**。未改生产源码或共享fixture／model-kernel／execution-diagnostics，也未重跑5.4a／14UI。写集为`tests/ui/context-bridge.spec.ts`及本change的design／investigation／tasks／delivery五文件。原spec已有题录更正、当前选择及持久化契约，本片只补整合证明，没有新协议或正式规格变化。

### 实际路径与覆盖

扩展原catalog选择场景而非新增另一套工作台／server／launcher：真实UI上传30条CSL文件，其中一条含明确合成的未知嵌套及姓名扩展；在同一CatalogItemForm／JSON草稿更正出版者、数字区间结束日和circa。日期端点／circa的独立来源与目录覆盖核查见investigation首节，不用映射实现生成预期。

经产品入口创建集合、勾选归属并保存，进入集合验证一条结果，再回全部范围；列显隐／宽度沿现有设置。先绑定当前client.shutdown、CLI status确认stopped，再用既有createDevelopmentKernel bootstrap真实重启并reload原窗口，核sourceId、revision、完整metadata、未知嵌套、集合、查询、列和表单读回。人工验收发生在模型启动前，失败trace中的`manual-restart`附件及`lifecycle-checkpoint.json`保留独立结果；不会因后续harness未完成抹去人工事实。

随后复用原startModelKernel及真实worker，通过原会话产品发送入口启动。17项题录范围选择仍与空显式材料选择分开；模型第一请求等待期间翻到第二页，真实read_workbench_context核offset25及新主选。返回第一页以已有Home键选择更正对象并核准确sourceId，模型再调真实read_workbench_context与library_get；后者身份只取前一真实工具输出，模型收到完整更正metadata。模型HTTP及其显式等待门是唯一受控依赖，没有注入工具结果、UI状态、仓储或broker替身。

模型完成后，既有stop等待自有child退出，再经development入口重启同库并reload；题录／集合／列／表单仍正确，原会话三条完整工具记录深比较一致，覆盖id、sessionId、tool.runId、输入、输出及complete状态。既有未知操作、原值／键、16KiB及容量／生产期限均未改变；本轮没有原包或真实模型科研结论。仅列显隐／宽度纳入本片，不声称新增列排序验收。

4.1／4.2核查结论：固定32类型／44文本／22角色／4日期键及数字区间／circa已交付，无本授权目录遗漏。父项继续用于覆盖／验收收尾；具体数字型字段、复杂日期、额外CSL类型／角色、姓名扩展等JSON保留边界已列investigation，不能将其笼统算成“复杂映射待实现”或借此新增Zotero逆映射／季节／别名政策。

### 验证、首次失败及修正

本轮证据根为`/home/joshua/.cache/scholoom-literature-round11-N9NcJZ/`。Linux／Node24.12.0、已安装Chromium／Electron；profile／输出／TMPDIR均在自有cache根，端口5835，未触发/tmp解包或依赖安装。静态产品承载复用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，不启开发服务器。没有需要DEV样例的场景、生产源码修改或运行中重建。

| 命令／阶段 | 实际结果 |
| --- | --- |
| 主线已验本树构建：`/tmp/scholoom-round11-acceptance-Jx5Oez/sync-build-results.json`的literature-workbench，及正式转交的该树sync-build.log | code=0。本轮按用户指令复用既有产物，未重复记为新构建。 |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`；`node node_modules/@biomejs/biome/bin/biome check tests/ui/context-bridge.spec.ts` | 最初新测试有model可能undefined及格式问题，实施中修正；最终均通过，`tools-typecheck-final.log`／`biome-final.log`。未改schema或生产文件，不重复全仓检查／生成。 |
| `TMPDIR=<根>/tmp SCHOOLOOM_UI_PORT=5835 SCHOOLOOM_UI_DATA_DIR=<独立profile> SCHOOLOOM_ROUND_OUTPUT=<对应输出> xvfb-run -a node node_modules/@playwright/test/cli.js test --config <根>/ui.config.mts tests/ui/context-bridge.spec.ts --grep 'catalog product ingestion'`，profile-first／ui-first | Browser首次失败：30条导入后样本在后页，夹具直接点第一页；Electron处于相同阶段时主动中断自有runner，保留1失败／1中断及trace。修为先按准确题名查找、更正保存后恢复prefix范围；不改分页实现或时限。 |
| 同命令，profile-corrected／ui-corrected | 2失败：Browser已完成保存，但重启误用普通CLI独立实例，UI按契约拒绝接管；随后Electron fixture亦被该独立实例拒绝。修为消费现有createDevelopmentKernel真实生命周期；不改归属保护或共享helper。 |
| 同命令，profile-lifecycle／ui-lifecycle | Browser人工重启检查完成、真实第二页工具回执已产生；返回样本的鼠标自动滚动使虚拟行卸载，原90秒失败。Electron主动中断，保留1失败／1中断。改用现有列表Home键及准确主选断言，不加sleep／retry／超时。人工及阶段附件提取为`lifecycle-checkpoint.json`，原trace仍保留。 |
| 同命令，profile-final／ui-final | **2/2通过，2.8分钟**，Browser／Electron各约1.2分钟，`ui-final.log`。保持原90秒场景及原模型首请求／完成预算。未重复其他14UI或5.4a；本片没有需改生产代码的确证缺陷。 |
| `openspec validate complete-library-catalog-workbench --strict`；`openspec schema validate scholoom-dev`；当前apply／delivery instructions；`git diff --check`与补丁核查 | 通过，`openspec-strict.log`／`openspec-schema.log`／`apply-final.json`／`delivery-instructions.json`及diff／patch日志。只勾6.1b，父项及整体交付不由CLI ready关闭。 |

原生只读辅助Agent使用gpt-6.1-sol／high、fork_context:false，先核固定来源与声明覆盖，再审代表测试。审查促成：补第二页真实工具验证、重启后三条完整回执比较、停止回调调用前清空及嵌套finally清理；同时指出工具runId属于tool对象，父Agent核runtime创建代码后修正。无验收的列前移动作删除。最终双宿主结果由父Agent执行核验；辅助已关闭，没有后台写树任务。

### 交回与未完项

一次只读查询Checks40591705520，head29cd728一致，截点整体／Linux／Windows仍in_progress，macOS job已completed/failure，`ci-observed.json`保存原状态。未查询失败原因，不从job状态推本域因果，也未再次查询／轮询或将启动计通过；Windows diagnosis40591705558无新增消费结论。沿用户提供的938c33f历史CI与本轮本机结果分别表达。

结束时5835无监听，profile-final CLI status为stopped；模型helper等待自有child退出，UI／static runner由既有生命周期收尾。最终配置及库保留在cache根，临时teardown仅停止本轮配置不删除目录；最早profile-first沿当次旧teardown在该配置退役后收尾，没有登记外部项目。未接用户真实库、操作其他树、安装／下载依赖、提交／推送／PR／归档。

可审查增量为`<证据根>/linux-integration.patch`，唯一基线依赖29cd728已含前片；仅五文件，不含累计补丁、公共配置或其他线符号。应用顺序无新公共依赖。Windows1.4、父4.1／4.2覆盖收尾、完整6.1／6.2、I6／E6、分发／跨平台原包与真实科研质量保持开放；A测试侧可信注入不等于B标准CLI持久配置。达到本轮边界即停止，不开始后续业务批。

## 第十一轮主线验收

5.4a六文件增量已冻结、建立本地检查点并合入dev。Standards／Spec两路gpt-6.1-sol／high独立只读审查未发现确证缺陷，核对了原发送及错误语义、真实committed／notFound、冻结请求及草稿、查询后旧revision真实CAS拒绝。主线完整构建后冻结产物，tools、格式、架构、生成映射和13个change strict／schema通过；可信进程夹具1/1及相关内核组合11/11通过。

静态产品双宿主首组为1通过／1失败：Browser真实原包及四次内核进程路径通过；Electron在33行解压原包时写入EDQUOT，未进入业务。完整首次日志／JSON及截断trace保存在`/tmp/scholoom-round11-acceptance-Jx5Oez/main-ui*`，不删除或将损坏ZIP当有效证据。不改源码或期限，将输出、profile和TMPDIR迁到本机磁盘独立目录`/home/joshua/.cache/scholoom-round11-ui-euNa9W/`，只补跑`--project=ui-electron`，1/1通过（1.6分钟）。每个宿主各有真实通过依据，不称一次2/2，也不将环境准备失败写成业务缺陷已修复。

实际入口仍为现有XPI、静态构建产品、xvfb／Electron及私有IPC／serveKernel；传输门只控制送达及丢失成功回执，没有代写库结果。A测试侧注入、标准CLI持久配置B、目标平台分别表达，25/30及完整4.1／4.2／I6／E6继续按原不足保留。下一片沿[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)做现有字段范围内的Linux真实业务整合，不重复5.4a或并写本轮公共诊断夹具。

## 2026-10-28：938c33f的5.4a真实进程重启验收

本轮HEAD`938c33f2c9fcafb2cce11b0c165b2fb1e9a818c3`，开工前clean，未改变。主线已选择并同步A及独立审查后的共享helper，本线完成**5.4a，25/30**，不再等待配置方案；完整4.1／4.2、1.4、6.1／6.2及I6／E6不关闭。未修改生产源码、共享helper、CLI配置或其他线符号，未安装依赖、启动开发服务器、操作真实库／其他树或提交／推送／PR／归档。

### 接线及成果

只改`tests/ui/zotero-original.spec.ts`及原change的design／investigation／tasks／delivery／literature-catalog delta。准备app建立真实隔离共同库／期刊／键并核默认缺配置拒绝后关闭；随后使用已同步startIsolatedKernel，全部记录、历史、更正及授权检查都走当前RPC client。移除直接startKernelServer及合成runtime身份路径，不新造server／provider／launcher。原bootstrap代理只返回当前实际endpoint，保持相同origin及窗口；新WS URL安装原传输门后reload。

每宿主四个真实内核进程：首次正确配置、已提交回执丢失后的正确配置重启、未送达后的正确配置重启、错误库绑定重启。helper.stop绑定原instanceId，等自有child close再CLI status；本线未调用重新发现的CLI stop或修改共享停止规则。实际原包命令仍为xvfb／Electron及未改BBT9.0.68，模型无需参与。

committed／notFound各自跨真实停止、退出及同库显式注入重启；冻结libraryId／sourceId／来源identity／原revision／requestId／title和完整dirty CSL保持。查询committed后实际保存CSL仍以旧revision被contentChanged拒绝，未静默rebase。notFound后pending及禁提交状态保留，无重放。每宿主五次明确title请求、四次转发（含一次CAS拒绝）、三次提交，其他原值／正式键／固定状态及历史不污染。

缺配置在准备app核unavailable；当前RPC的错误库请求、撤read分别拒绝；真实错误绑定重启后GUI对原pending查询显示unavailable，匹配错误配置ID的请求返回instanceMismatch。均不作notFound，也不改冻结请求适配配置。该区分是实际验收边界，不冒称已执行无配置普通CLI重启。

### 实际验证及首轮结果

证据根`/tmp/scholoom-library-process-round10/`。Linux／Node24及已有依赖；broker、SQLite／文件、运行锁／发现／内核子进程和受管原包真实。传输门只控制送达及真实成功回执丢失，不代写库回执。静态UI沿已构建产品与`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，未使用开发样例或开发服务器。

| 命令／依据 | 实际结果 |
| --- | --- |
| 主线本树同步构建：`/tmp/scholoom-round10-acceptance-j1MosP/sync-build-results.json`中literature-workbench | code=0，正式转交的literature-workbench/sync-build.log；当前kernel／desktop／host产物均存在。本片只改测试，依用户指令复用，未将其写成本轮新构建结果。运行中未重建产物。 |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`、`node node_modules/@biomejs/biome/bin/biome check tests/ui/zotero-original.spec.ts` | 首次及补强后均通过，`types-tools-first.log`／`lint-first.log`、`types-tools-final.log`／`lint-final.log`。无生产／schema变化，不重复desktop构建或生成映射。 |
| `SCHOOLOOM_BBT_XPI=<已有9.0.68 XPI> SCHOOLOOM_UI_PORT=5815 SCHOOLOOM_UI_DATA_DIR=<证据根>/profile-first xvfb-run -a node node_modules/@playwright/test/cli.js test --config <证据根>/ui.config.mts tests/ui/zotero-original.spec.ts --workers=1` | **首轮2/2，2.9分钟**，`ui-first.log`／`ui-first/`。每宿主约1.2分钟，原90秒场景预算与生产期限未变；本轮无首次业务失败，不制造RED或覆盖首轮结果。 |
| 同一场景，5817／profile-final，附`--output <证据根>/ui-final` | **最终2/2，2.9分钟**，`ui-final.log`／`ui-final/`。独立审查后补查询完成时的CSL旧依据和真实CAS拒绝才复验，并非无变化重跑。每宿主original-actions.json保留四个实际PID／runtime instanceId、请求／错误及冻结草稿。没有重跑14UI、旧macOS列表或已绿helper窄测试。 |
| OpenSpec strict、scholoom-dev schema、当前apply instructions、diff及增量patch核查 | 通过，`openspec-*.log`／`apply-final.json`／`diff-check.log`／`patch-check.log`。CLI进度25/30不代表整个change或平台完成。 |

原生辅助Agent遵用户gpt-6.1-sol／high、fork_context:false，仅只读核helper／UI接点及最终测试。其确证遗漏是committed查询后的CSL依据尚未独立核对，原断言可能漏静默推进；父Agent补实际旧revision保存拒绝，以及notFound后与同一原始CSL比较。辅助确认静态遗漏闭合，最终实跑由父核验；辅助已关闭。没有共享IPC／配置新缺口需要本轮另行定案。

### 交回与边界

CI输入沿8c2fd24／40479176954及4312262文档差异run分别表达，不从数量差异推同因果。只读新Checks40540362614确认head938c33f，截点整体与Linux／Windows内核仍in_progress、macOS job成功，`ci-observed.json`保留实际结果；未触发CI、等待其他线或据本机GUI关闭目标平台。

本轮结果目录内原包／隔离库／登记项目保留；helper stop／child close、proxy／Electron均由夹具收尾，普通静态profile由既有teardown确认stopped后退役。5815／5817无监听，无本轮后台写树任务。相对938c33f的本线增量为`<证据根>/restart-gui.patch`，只含原测试及原change工件，不含公共helper或旧累计补丁。

A证明可信测试父每次显式注入的serveKernel进程路径，**不代表B标准CLI配置持久恢复**；默认生产不可用／Mac受管执行不可用保持。没有新增Windows／macOS原包、分发包、真实模型／科研质量或后续业务批次结论，达到本片边界后停止。

## 第十轮主线：解除测试侧进程提供者前置

主线接受下节的配置缺口调查，选择仅测试侧A，交付`tests/isolated-kernel.ts`、`tests/fixtures/isolated-kernel-process.mjs`与`tests/kernel/isolated-kernel.spec.ts`。真实serveKernel／锁／发现及development owner沿原实现，每次启动仅由可信父经私有IPC传入现有IsolatedZotero；没有生产CLI配置加载或第二server。

首次窄测试1/1通过后，独立审查发现停止预检与CLI重新发现间可能误停接替实例的P2。主线改用既有绑定原实例的owner.shutdown，等待child close后只CLI status，扩原场景核旧句柄拒绝且接替实例仍可用；最终1/1通过，43.0秒。没有扩大生产期限、清锁、重试或移除库身份／授权。新夹具初次格式失败已整理，包构建和tools类型通过，完整证据在`/tmp/scholoom-round10-acceptance-j1MosP/`的main-build、main-tools、main-helper及main-helper-final日志。独立复核确认P2代码关闭，未代跑测试。

该窄测试使用不执行的占位宿主路径，仅证明配置门、身份及独立进程替换；未执行BBT原包、committed操作或双宿主GUI恢复。5.4a保持未勾，下一片由文献线把已验证夹具接入原GUI场景，传真实已存在原包／宿主命令，核冻结请求、草稿及真实结果。A的实际停止方式沿design首节，不声称普通CLI stop预期实例或B持久配置已验收。

## 2026-10-27：4312262配置／进程重启调查交回

当前HEAD`4312262c1a1f432ccd706dd1eb6ff6468765fd4e`，开工前clean，未改变。主线`/tmp/scholoom-round9-acceptance-IER31D/{acceptance.md,main-ui-result.json}`已接收原单条GUI／unknown工作台重载；本轮按条件分支只完成**配置缺口调查及方案**，5.4a跨进程验收仍未完成，整体**24/30**。未应用旧patch、改业务／测试源码、创建另一server／launcher、安装依赖、启动服务或操作真实库／其他树；无提交／同步／推送／PR／归档。

### 实际结论与修改

现有`tests/ui/zotero-original.spec.ts`是测试内存配置→KernelApplication→startKernelServer→本机bootstrap代理路径，不经过独立CLI进程／serveKernel运行锁。serveKernel本身已接受isolatedZotero，但CLI parseArgs／start／serve、ensureKernel派生参数及桌面bootstrap均无隔离配置加载或传递。普通CLI重启后，zotero.result也因配置守卫返回unavailable，不能由仍在SQLite的回执推定GUI已可核查，更不能据此重放或改走绕过隔离检查的接口。

只修改原四工件：investigation补逐符号／参数证据及现有测试边界；design给出提供者／配置归属、启动／授权／收尾及最小验收；tasks新增未勾5.4a及当前前置，更新失效CI等待；本delivery记录此次只读执行。现有规格／UI设计和业务行为未变，无需新delta或重建产物。

建议主线选择**A：测试侧可信serveKernel子进程提供者**，复用现有IsolatedZotero、运行锁、endpoint、CLI status／stop和开发owner；配置由可信测试父进程显式持有并在每次新进程注入，不开放普通产品。**B：标准CLI start持久受控配置**是另一公共增量，需要主线先定加载／权限／绑定／撤销机制。A不等于B；没有把候选入口写成已提供或已获跨模块实施授权。精确候选文件／拥有者及committed／notFound、冻结identity／revision／requestId与CSL草稿的双宿主重启验收步骤见design首节。当前没有提供者，按用户“CLI根本不提供则止于方案”的要求停止，不擅自创建测试启动入口。

### 平台追加事实

已读取用户明确转交的`/tmp/scholoom-round9-acceptance-IER31D/macos-job-current.json`：同源码4312262的Checks40476577071，macOS job122096177783 **completed/success**，fallback／入口／人工双宿主步骤均成功。当前workflow人工步骤包含library.spec.ts；原列表同例已有新目标通过证据，3.2a不再写成“目标尚未实跑”，也不重复追查。完整组caf9025的Linux743／1／26、Windows687／41／42及原生定向分别作为历史基线输入，不能沿用旧4失败清单或据macOS成功关闭Windows／整项I6。本人早先只读查询截点job仍in_progress而人工步骤已success，保留于`/tmp/scholoom-library-restart-round9/ci-observed.json`，以主线追加的完整job证据为准。

### 验证与停止点

本轮只读命令为git status／rev-parse、rg／源码读取及`gh run view 40476577071 --json status,conclusion,headSha,jobs`；没有新的业务失败复现或内核／UI实跑，首次／最终业务结果沿上一节原delivery及主线验收，未改写为本轮通过。经验检索无相关条目。现有kernel定义中的“同进程显式serveKernel注入后CLI查询”、同app题名unknown与重建Application重新注入均只作源码证据，不补算跨进程通过。

适用验证为`openspec validate complete-library-catalog-workbench --strict`、`openspec schema validate scholoom-dev`、当前apply instructions及`git diff --check`，实际日志在`/tmp/scholoom-library-restart-round9/`。本轮无需build／类型／UI回归，因为只更新四份OpenSpec Markdown，无生产／测试／schema变化；没有为凑进度重跑已绿14UI。候选方案尚未实施，因此没有真实配置进程重启、原包恢复或未知结果跨内核重启保证。

可审查本轮文档patch位于`/tmp/scholoom-library-restart-round9/planning.patch`，仅相对4312262的这四工件，不是旧累计业务补丁。没有启动本轮进程、后台写树任务或辅助Agent。等待主线确认入口与提供者并在共同基线具备实际能力后再解除5.4a；完整4.1／4.2、1.4、I6／E6及科研质量仍开放。

## 2026-10-27：0b78815后的滚动观察与单条原值GUI

本轮基线`0b788151b5e17665a26d9286dfd1d12f6e2e0c30`，开工前clean，HEAD未改变。前片已由主线接收、入dev并同步；本轮完成**3.2a／5.4，24/29**，只交下述两步，不勾完整4.1／4.2、1.4、6.1／6.2或生态E6。未应用旧patch、安装下载依赖、启动开发服务器、操作别树／真实用户库或执行Git提交／同步／推送／PR／归档。

### 第一步：核对macOS实际滚动提交

原始Checks40447074031的Browser失败旧:683实际断言`scrollTop`返回200而非0，**不是列宽**；Electron同例已通过。没有读隐藏／卸载节点或必须改产品布局的证据。原测试只设置并立即读取DOM属性，不能证明原生scroll已让虚拟列表与范围偏好完成更新；现只增加可观察虚拟首行身份变化的等待，再按原精确值检查分页返回。未改生产列表、数值、时限或加sleep。

共享／桌面构建后，隔离静态双宿主定向**2/2，1.1分钟**（Browser18.4秒／Electron22.9秒），`ui-scroll.log`；最终全library再次覆盖。未在本机声称稳定复现旧macOS200→0；新0b78815 CI的macOS人工步骤成功发生于未含本测试改动的基线，也不算修正后目标实跑。完整平台事实见investigation首节。

### 第二步：真实单条原值题名／导出消费者

- 新增`workbench/library/CatalogOriginalActions.tsx`，只从唯一LibraryContents接受scope、libraryId、单选主项／revision及授权状态；`LibraryTab.tsx`只在原题录分节挂载该消费者。原选择、CSL Form／JSON、保存及右栏都复用，不新增协议、provider、库来源表或生态监督。UI设计先于结构落稿，沿既有语义token与控件，无新视觉常量。
- 明确核对调用`zotero.inspect`，展示已保存CSL、完整原值、准确identity三字段／revision及题名比较／其他不可比较。独立题名先预览再提交`replaceTitle`，保留准确字符串（包括首尾空格），其他原值、Extra／姓名、正式键／固定状态及未保存CSL保持。原值成功不推进dirty CSL旧保存依据；真实随后保存仍contentChanged，草稿不丢，未静默rebase或双写。
- 仅勾选“采用所示原值导出”后提交准确zotero-original expression；选择不足按钮禁用／无文本，只有真实exported.text显示成功。格式、选择、修订、连接变化清除确认及输出，selectionRequired没有文本；未配置普通产品入口真实unavailable，不加真实库／原生路径启用开关。
- 原值题名意图和冻结pending请求使用已有drafts，跨卸载占用复用librarySaves；不存另一份CSL。失联／unknown保留requestId及原输入，只提供`zotero.result`核查，notFound不解锁重试。迟到写结果只结算原对象同requestId；异步核对／导出还按当前选择依据代次拒绝旧响应。
- 扩展既有`tests/ui/library.spec.ts`（滚动提交及默认unavailable），新增`tests/ui/zotero-original.spec.ts`的单个双宿主整合场景。只使用测试端KernelApplication的已有可信isolatedZotero构造与既有task-graph-launch的真实server／本机bootstrap代理模式；其余资产转发给既有静态承载。未把普通middleware后补配置或假provider当真实提供者。更新原proposal／investigation／design／delta／tasks及文献开发／UI分节。

### 实跑、首次失败与独立审查

证据根：`/tmp/scholoom-library-gui-round8/`。Linux／Node24、已有锁定依赖及本地未修改BBT9.0.68 XPI。内部broker、领域SQLite／文件、身份与授权、受管Electron／原BBT均真实；人工路径不调用模型或Agent worker，不以合成执行身份绕过授权。期刊oracle来自既有固定Preserved journal样本；传输门仅控制并发、实际请求未送达和真实成功回执丢失，库结果／历史不替换。

| 实际命令／范围 | 结果与依据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared`，随后desktop build；GUI实现及审查修复后desktop build，zotero-host build | 均通过，`build-shared.log`／`build-desktop-scroll.log`／`build-desktop-gui.log`／`build-desktop-final.log`／`build-zotero-host.log`；最终desktop约1分34秒。所有最终测试在构建结束后运行，期间冻结产物；中间构建均在前轮测试退出后执行。 |
| `SCHOOLOOM_BBT_XPI=<已有XPI> node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/zotero-host.spec.ts --grep 'explicit original selection\|original title unknown\|original inspection rejects' --output <证据根>/kernel-original` | **3/3，25.7秒**，`kernel-original.log`。实际原BBT两格式导出、独立title保存／原值及键保护、unknown真实结果查询、拒绝多来源／陈旧身份；生态权威源码未改，后续只改GUI无需重跑该库路径。 |
| 首次新增GUI，5777／profile-original-first，`tests/ui/zotero-original.spec.ts --output <证据根>/ui-original-first --workers=1` | **2失败**，Browser17.4秒／Electron19.3秒，`ui-original-first.log`和双方trace。真实写已提交、回执被传输门丢弃；断线重建后详情折叠，测试直接找核查按钮失败。改为通过用户入口显式重开详情／页面重载后核查，未放宽时间或伪造成功。 |
| 修复后同静态配置，5779／profile-original-final，`tests/ui/zotero-original.spec.ts --output <证据根>/ui-original-final --workers=1` | **2/2，1.5分钟**，Browser31.6秒／Electron30.0秒，`ui-original-final.log`。真实保存／冲突、单选与明确expression、其他值／键／未保存CSL保持、跨重载unknown只查询均通过。每宿主5次明确title请求，4次实际转发（含1次CAS拒绝）、3次提交；丢失成功回执查询committed，未送达请求查询notFound，历史无重复污染。 |
| 最终5781／profile-library-final，`tests/ui/library.spec.ts --output <证据根>/ui-library-final --workers=1` | **12/12，4.3分钟**，`ui-library-final.log`；默认无配置unavailable、原类型／日期、唯一右栏／跨组、列／集合分页、滚动提交、迟到／多窗口草稿及原冲突回归全部通过。 |
| desktop／tools `tsc --noEmit`，4份相关源码／测试Biome、architecture、生成器self-test及最终schema只读映射比较 | 通过，`types-*-final.log`／`lint-final.log`／`architecture.log`／`generator-self-test.log`／`generated-check.log`；14模块254文件0 findings，7份格式化生成输出与本树相同，未应用格式噪声。首次类型检查的exactOptionalPropertyTypes错误保留于types-desktop-first.log并已修正；新测试首轮格式问题用apply_patch整理。 |
| OpenSpec strict／scholoom-dev schema及diff／分片应用核对 | 最终通过，`openspec-strict.log`／`openspec-schema.log`／`diff-check.log`及patches/patch-check.log。首次strict因Requirement正文落在Scenario后而失败，保留openspec-first.log；已将正文移回正确位置，不缩减契约。 |

独立辅助Agent为用户指定gpt-6.1-sol／high、fork_context:false，仅写拥有的新增UI测试，随后释放文件并只读审查生产消费者。发现两项确证风险：选择多选→同主选后迟到导出仍能显示旧文本、损坏JSON null被保护分支后继续解引用。主Agent分别修正选择依据代次和损坏对象处理，扩展该真实双宿主场景：旧export响应收到后仍无输出／未勾选；损坏另一对象草稿后显示错误且工作台仍可用。两项均在最终2/2实跑保护，辅助Agent已关闭。Browser预览截图已实际查看；两宿主截图及original-actions.json保留，不据此声称全主题／尺寸视觉验收。

### 接入、收尾与剩余边界

静态UI始终使用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`和已构建产品；没有开发专用样例或开发服务器。UI构造的真实库／配置／原包目录在结果目录保留，登记项目随配置保留；普通静态profile由既有teardown确认stopped后退役。所属真实server／proxy／Electron已由夹具关闭，5775／5777／5779／5781无监听，无辅助Agent或本轮后台写树任务。

相对0b78815的可审查增量见`<证据根>/patches/README.md`／manifest：**0001滚动观察测试独立增量 → 0002单条原值消费者及回归 → 0003原OpenSpec／文档**，没有新公共schema／权威／装配补丁。分片在仅触及文件的临时载荷顺序check／apply并比对最终源码，不是另一个完整仓库或工作树。

没有需要本片新增产品决策的阻塞；原始多来源、其他字段／日期、自动原值同步、批量GUI及来源重绑定均未开放。直接server夹具不覆盖serveKernel运行锁／CLI进程重启的可信配置恢复；原包测试仅Linux，不声称macOS／Windows导出或完整Zotero宿主验收。新Checks查询时整体仍in_progress，Linux内核步骤success／macOS job success不代表完整CI，Windows内核仍在跑；Windows diagnosis success仅限其实际场景。完整4.1／4.2、I6／E6及科研质量均保持开放，达到本轮边界停止。

## 2026-10-27：8a2f0ce后的数字区间及circa子片

本轮共同基线`8a2f0ce522dfbab4110e63e84e542f6660e6115e`，开工前clean，HEAD未改变。主线已接收前片并实际同步；本轮只完成**4.1d／4.2d，22/27**，父4.1／4.2、Windows1.4及完整6.1／6.2仍开放。本节取代下方历史阶段的当前范围和等待说明，不应用旧累计patch，也没有提交、同步其他树或启动后续阶段。

### 成果、文件与调用方

- `packages/protocol/src/library-metadata.ts`增加唯一`catalogEditorNumericDate`声明：两端、年月日边界及已知只读复杂属性、circa布尔和0／1；`library.ts`仅补导出。开放metadata、44字段／22角色／32类型、同源操作schema与生成类型无变化。
- `workbench/library/catalog-metadata.ts`的`catalogDateParts`返回所有端点；`editCatalogDatePart`追加可选endpoint参数并按连续精度局部编辑，新增`catalogDateCirca`／`editCatalogDateCirca`／`removeCatalogDateEnd`。所有调用方已核对；不推断日期、不补齐或交换端点，不改未指定属性。既有数值circa更正仍为0／1，未知字符串不强转；最后数字清除仍保留附属属性，只有明确清除整个日期才删除对象。
- `CatalogItemForm.tsx`复用同一JSON草稿和保存路径，支持结束日期按需展开、独立精度、circa及明确移除结束端；非法范围／原生badInput显示错误且不触发草稿改写。错误仅保存字段与JSON依据，不保存日期副本。`LibraryTab.tsx`仅为详情表单增加sourceId key，隔离对象间临时错误／展开状态；单一选择、右栏、保存台账及迟到保护仍沿原实现。无新样式或硬编码视觉值。
- 扩展既有`tests/kernel/{catalog-metadata,literature-catalog}.spec.ts`及`tests/ui/library.spec.ts`，没有另建UI／领域夹具。独立上游样本及未支持表达的精确边界见[investigation](investigation.md)首节；更新本change的design／delta／tasks与开发、UI文献分节。原design变更总览中的表单→client→库→SQLite路径仍为实际路径，无新增模块／权威。

### 实际验证、首次失败与证据边界

证据根`/tmp/scholoom-library-date-round7/`。Linux／Node24、既有依赖；共享构建结束后才构建桌面，二者退出后冻结产物运行最终测试。内部client、broker、真实领域SQLite／文件、Browser和Electron接线真实；手动表单路径不需模型或Agent worker，没有替身执行身份。合成原值及来源只在隔离测试库创建，不接真实用户数据；标准probe仅在VM执行独立参考条件，不是产品排版或Zotero宿主。

| 命令／范围 | 实际结果及保留依据 |
| --- | --- |
| `node <证据根>/standard-probe.mjs` | 通过，`standard-probe.log`；固定CSL v1.0.2 schema、官方范围／circa样本及citeproc-js 1.4.61真值条件。字符串`"0"`不作为false；固定版本与blob见调查。 |
| 基线RED：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts --grep 'numeric CSL date ranges' --output <证据根>/kernel-red` | **1失败**，原helper对官方范围返回undefined，预期为两端点；`date-red.log`和trace保留。不是运行环境或加时限修复。 |
| `pnpm --config.optimisticRepeatInstall=false build:shared`，随后`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | 通过，`build-shared.log`／`build-desktop.log`，桌面约1分38秒。测试期间没有重建产物；未安装下载依赖或启动开发服务器。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts tests/kernel/literature-catalog.spec.ts tests/kernel/library-records.spec.ts --output <证据根>/kernel-final` | **16/16，13.8秒**，`kernel.log`；端点／精度及circa、未知属性、非法输入、真实保存／CAS冲突／库关闭重启读回、原值／来源／固定键及原子事务均通过。 |
| `SCHOOLOOM_UI_PORT=5755 SCHOOLOOM_UI_DATA_DIR=<证据根>/profile-first xvfb-run -a node node_modules/@playwright/test/cli.js test --config <证据根>/ui.config.mts tests/ui/library.spec.ts --workers=1` | **12/12，4.3分钟**，`ui-first.log`／`ui-first/`。人工区间／circa录入→更正、完整未知JSON、原值／固定键、冲突草稿、唯一右栏／跨组、集合／选择／分页及双窗口迟到回归通过。 |
| 同一静态config，端口5757、profile-verified，`tests/ui/library.spec.ts --grep 'manual typed fields' --output <证据根>/ui-verified --workers=1` | **2/2，1.0分钟**，`ui-verified.log`。独立窄审查指出原`.press('e')`只核JSON、未证明触发badInput；随后仅补测试观察器，真实捕获原生input事件中的badInput=true，再核JSON不变。Browser17.9秒／Electron21.8秒；未伪造事件状态或扩大时限，未重跑全部12项。 |
| desktop和tools `tsc --noEmit`（`apps/desktop/tsconfig.json`／`tsconfig.tools.json`） | 通过，`types-desktop.log`／`types-tools-final.log`。补强测试后再次核tools；生产产物不变。 |
| 8份相关源码／测试Biome、`node scripts/check-architecture.ts`、生成器`--self-test`和只读`--patch`映射比较 | 通过，`lint-final.log`／`architecture.log`／`generator-self-test.log`／`generated-check.log`；14模块253文件0 findings，7份格式化生成输出与当前源码一致，未应用格式噪声。 |
| `openspec validate complete-library-catalog-workbench --strict`、`openspec schema validate scholoom-dev`及`git diff --check` | 通过，`openspec-strict.log`／`openspec-schema.log`／`diff-check.log`；CLI状态不是全change或目标平台验收。补丁应用检查另见下述工件。 |

静态UI使用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`承载已构建renderer。既有globalTeardown经cleanupKernel确认stopped后退役并删除本轮两个隔离profile；登记随配置退役，未留下仍登记却删除的项目。5755／5757已无监听，本轮测试会话及辅助Agent均已退出；保留RED、截图／结果和所有日志，不清理别域进程。现有截图不是新增日期控件全主题视觉验收，不声称该范围。

辅助Agent仅写拥有的literature-catalog测试，并对共享声明／helper／表单／调用方作独立静态窄审查，未发现确证源码问题。其badInput证据缺口已用上述真实双宿主补齐；主Agent核对最终调用方及差异。经验检索未找到相关条目，不作为新增通过结论。

### 接入与剩余问题

本轮补丁位于`<证据根>/patches/`，仅相对8a2f0ce：**0001共享编辑声明 → 0002日期helper／表单及既有回归 → 0003原OpenSpec与文档**。精确文件及逐片核对见该目录README／manifest；临时应用核查仅含触及文件，不是另一个工作树或组合构建。公共部分为编辑能力声明，没有新增操作、迁移或未注册provider。

生态已定D1—D3不重提待决：当前库事务能存独立原值题名并以共享revision原子核对，正式键省略则保持；本树尚无新显式导出选择API或任意原题名提交装配，不接假UI。精确现有能力／缺消费接口及授权边界见调查。季节、非公历、数字字符串、开放端点、混合literal／raw及未知circa仍JSON核查；若后续要求结构化转换，须先定义明确语义及可能丢弃确认。本片没有阻塞的产品选择，已到授权停止点。

Windows最新文献三项状态观察仍待现场时间线，document-integration已通过；不以本机绿灯关闭1.4，也不关闭完整4.1／4.2、6.1／6.2。不扩C—I、原值同步、完整生态事务、真实科研质量或跨平台发布；没有push／PR／archive。

## 2026-10-27：4b13183后的原生CSL编辑子片

本轮基线`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`，开工前clean，HEAD未改变。主线已接收5.3、原值／正式键及生态持续外发P1；本轮只完成**4.1c／4.2c，当前20/25**，完整4.1／4.2及其余五项仍开放。未应用旧累计patch、提交／推送／PR／归档、合并／重置、安装依赖、写真实用户库或跨树操作。

### 成果、调用方与字段语义

- `protocol/library-metadata.ts`新增call-number、collection-title、dimensions、event-title、genre、medium、references、section、title-short，以及host角色；补10个现有字段的类型适用范围。总计32种CSL类型／44个文本字段／22个角色。原可编辑范围、日期键和开放schema逐项比较保持；没有新DTO、操作键、校验收紧或数据迁移。
- `CatalogItemForm.tsx`继续通用消费同一目录，仅将既有机构按钮的可见名明确为“添加机构／单名”，原可访问名不变。原helper、完整JSON草稿、LibraryContents、保存台账和右栏贡献均复用，不新增第二份状态。只改明确的CSL键，genre不改type、title-short不改历史shortTitle、references不改relatedIds，不触碰来源原值或正式键。
- `tests/kernel/catalog-metadata.spec.ts`增加独立上游类型／字段可编辑性回归；`literature-catalog.spec.ts`增加真实保存、旧revision拒绝及库重启后原值／来源／固定键保持样本；`tests/ui/library.spec.ts`增加一个完整表单场景，沿真实手动摄取从影像→演讲→听证→专利→软件更正9字段、host机构／单名及角色内排序，核对复杂日期、未知嵌套、旧别名和原值保持。其余原用例保护原字段、右栏单实例／跨组、稳定选择、冲突／迟到及双窗口草稿。
- 当前spec／design／investigation／tasks及文献开发／UI分节同步到实际范围。新声明不是Zotero逆向转换schema；未改生态schema或自动同步生产路径，不依赖生态本轮尚未同步的新方案。调查中的具体差异、复杂日期／跨角色原序及后续选项见investigation首节。

### 实际验证及首次失败

证据根`/tmp/scholoom-library-metadata-round6/`。Linux、Node24和已安装锁定依赖；人工表单／真实kernel客户端、broker、SQLite及文件均真实，Browser与Electron使用同一静态构建。此次表单无需模型或Agent worker，未以假执行身份替代生产授权；不据此声称worker／真实科研效果验收。域库测试为隔离合成库，实际关闭并重开，UI配置／项目／库／端口独立，测试期间未重建产物。

| 命令／范围 | 结果与证据 |
| --- | --- |
| 固定schema44／utilities源码及`node <证据根>/upstream-probe.mjs` | **4组样本通过**，upstream-probe.log／upstream-oracle.json。未修改的上游converter在VM中执行，ItemTypes／ItemFields／CreatorTypes只为schema查询facade，不含宿主、Date解析或Extra；预期为独立人工核对静态样本，不来自新目录。 |
| 基线声明RED：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts --grep 'remaining native CSL' --output <证据根>/kernel-red` | **1失败**，旧已构建基线缺motion_picture.genre声明，metadata-red.log及trace保留；没有将此预期RED覆盖为通过。 |
| `pnpm --config.optimisticRepeatInstall=false build:shared`及`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | 通过，build-shared.log／build-desktop.log；两者均退出后才开始最终内核及UI，期间冻结构建产物。未安装或下载依赖；只读取得的上游源码保留在临时证据目录，不作为运行依赖。 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/catalog-metadata.spec.ts tests/kernel/literature-catalog.spec.ts tests/kernel/library-records.spec.ts --output <证据根>/kernel-final` | **14/14，13.0秒**，kernel.log／kernel-final。覆盖声明RED转绿、未知值、复杂日期、姓名完整对象／顺序、实际冲突及重启、原值／固定键及既有原子提交。 |
| `SCHOOLOOM_UI_PORT=5745 SCHOOLOOM_UI_DATA_DIR=<证据根>/profile-first xvfb-run -a node node_modules/@playwright/test/cli.js test --config <证据根>/ui.config.mts tests/ui/library.spec.ts --workers=1` | **12/12，4.2分钟**，ui-first.log／ui-first。新场景Browser16.6秒／Electron21.5秒；原字段、未知值、分页／列／导航、右栏跨组唯一实例、双窗口／冲突／迟到均通过。新多类型场景沿原人工建项90秒场景预算，轮询及生产超时均未改变。 |
| desktop及tools `tsc --noEmit`、5份相关源码／测试Biome | 通过，types-desktop.log／types-tools.log／lint.log。测试首次仅导入／格式经apply_patch整理，无业务测试失败被忽略。 |
| architecture、生成器`--self-test`及`--patch`只读比对 | 通过，architecture.log／generator-self-test.log／generated-check.log；7份dry-run输出经现有formatter与当前映射相同，未输出者不变，本轮未改生成类型。declarations-check.log另证明44唯一字段、22角色及原范围／schema不回退。 |
| OpenSpec strict、scholoom-dev schema及diff／补丁载荷 | 最终结果见openspec-*.log、diff-check.log、patches/patch-check.log；正式规格未同步，CLI状态不代表整个change完成。 |

同一原生辅助Agent保持gpt-6.1-sol/high，先只读核对CI，后仅拥有library-metadata声明文件，主Agent承担方案、表单／测试及最终验收。其独立窄审查发现设计把混合literal／family姓名误称为仅JSON可查；实际既有分支局部改literal并保留family／given。已仅修正设计表述，保留既有能力；未发现新增逆映射、原值自动覆盖或声明范围确证错误。审查未代跑测试，实际结果由主Agent执行。

最新CI以6b22d60／Checks40315429083为准：Linux689通过／9失败／16跳过，Windows628／49／30，macOS入口3／1；精确文献四项失败阶段与原始日志行已写investigation。它们停在queued／running观察或撤权收尾，尚无本域提交失败证据，未改时限／停止／容量或harness。未下载诊断artifact，不称已检查其trace；没有Windows目标实跑，不关闭1.4，也不以本机14／12绿色替代全仓CI。

### 补丁、剩余项与停止点

`<证据根>/patches/`提供相对本轮4b13183的增量：**0001公共编辑声明 → 0002表单／真实回归 → 0003原OpenSpec及文献文档**；精确文件及依赖见manifest／README。临时载荷仅验证触及文件的顺序应用，实际构建／测试始终在当前树，不建立另一工作树组合。未触及共享runtime、rememberCatalog／外发P1、根工具、构造参数、各域restore、task／programs／右栏或M3／图片消费者。

来源／CSL不一致仍显式保留；机构与个人单字段literal不可反推、跨角色原orderIndex不可从CSL分组恢复、复杂日期解析与历法未新增。后续若要结构化CSL范围日期、合并短题名别名或原值同步，须按investigation的具体选项闭合，不为父任务勾选扩大本片。当前安全子片无待决阻塞；完整4.1／4.2、1.4和6.1／6.2仍开放，不扩C—I、来源重绑定UI、生态完整事务、生产Graph／角色或发布范围。达到本轮边界后停止。

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
