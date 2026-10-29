# 实际交付与交接

## 第27轮主线接收与旧证据补核

原`5a34267158dcefdabaf101f38d4c77c655236f3d`以`8a2d364`合入并保留祖先。主线核两任务实际附件引用、原关联候选／真实CAS失败及已发送项的断言后，固定产物复验：双任务仅重绑A的内核代表**1/1、9.9秒**；明确附加并发送后任务保存失败的Browser／真实Electron代表**2/2、1.4分钟**。证据在本轮根`tasks-shared-main.log`、`tasks-ui-main.log`及各自main-results目录；UI独立端口6233／profile、外部HTTP模型受控，内部worker／发送／仓储真实，未使用真实模型。W1/W2按该范围接收，未扩为全部场景或科研质量通过。

图线只读补得基础任务8项、I1内核19项、TaskPort四场景及双宿主任务／Graph原逐项结果；准确旧版本、原runner／日志行和差异在同根`next/research-graph-runtime/RESULT.md`及其索引，W3不再笼统记为全部缺失。旧Linux CI整体仍为failure；其局部通过及相同测试文件不能代替当前全部依赖版本重新验收。来源撤权／新版后的完整询问链及后置提供者边界保持，未重跑已绿旧矩阵、未归档。

## 第27轮：W1／W2原Scenario证据补充

从指定`bb8b236e0fd37e59cffd30607372e444be633324`及clean开始，消费主线`/home/joshua/.cache/scholoom-round26-acceptance-8hG3DX/task-contract-review.md`的W1／W2，按当前apply及实际spec核查。原单任务关联冲突、附加未发送和共同上下文分段结果不替代这两项完整组合，本轮各补一个代表用例；只改`tests/kernel/research-tasks.spec.ts`、`tests/ui/research-tasks.spec.ts`和本记录。原tasks仍33/33，没有新增重定向API、任务正文副本、库删除／恢复分类或生产代码，也未将全部Scenario／历史缺证记为已验。

| 原场景 | 本轮实际结果 |
| --- | --- |
| spec“相同来源不同采用与重定向”（W1） | 真实ManualApplication／broker／项目文件／库先建A、B两个任务，共用同一managed附件及原materialVersionId。A说明排除、B说明采用；仅将A的method链接目标／basis／理由改为另一份预先存在的真实附件。重读B的完整TaskRead（含原ref／note／入口basis）及磁盘正文完全相同；两份附件记录和各来源附件列表保持不变。原／新指针实际分别读取各自原文，不以新来源冒充旧读取，也不伪造删除历史。首次实跑1/1通过 |
| spec“明确附加及保存失败”（W2） | 两宿主都从真实任务详情明确附加入口，经共同session.send进入实际worker及本机受控HTTP模型。核已持久消费用户消息的结构化contextItems为原入口ref／basis。再从任务关联表单产生实际tasks.save候选，经既有RPC闸门暂留请求；人工通过真实resources.save保存新正文后，只释放原请求一次，真实CAS返回ErrorInfo.contentChanged。候选路径／说明仍在表单，完整候选和原ErrorInfo落证；原已发送contextItems与当前接收session不变，磁盘只保留人工新正文、未落候选链接。Browser／真实Electron首次业务实跑2/2通过 |

本轮根`/home/joshua/.cache/scholoom-round27-acceptance-O1IWSr/next/research-task-workspace/`（下记`R`），所有TMPDIR／项目／profile／库／输出位于该cache，不依赖/tmp。已有静态runner配置由本树cwd运行`node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs "$R/ui.config.mts"`生成，端口6117运行前确认空闲，图形运行前`DISPLAY=:99 xdpyinfo`通过；没有启动日常dev server或操作共享显示。

生产源码未变，复用主线已同步验证的platform／kernel／desktop产物，未冒称本轮重建。仅模型外部边界由既有createModelServer控制回答／挂起，测试凭据为隔离配置的synthetic值；任务、共同草稿／发送、broker、库／文件、worker与CAS均真实，RPC闸门只控制原请求时点、不注入成功／失败结果。W1无harness／模型，W2不证明模型科研质量或任意模型策略。

实际命令均先`export TMPDIR="$R/tmp"`，使用已安装直接工具入口：

- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`：首次退出1，`types-first.log`保留新测试对可选links未收窄的类型错误；加实际存在断言后第二次退出0，`types-second.log`。未变更生产契约或放宽类型。
- `node node_modules/@biomejs/biome/bin/biome check tests/kernel/research-tasks.spec.ts tests/ui/research-tasks.spec.ts`：首次与最终退出0，`biome-{first,final}.log`。最终格式与测试源码固定后运行，没有并发重建受测产物。
- `PLAYWRIGHT_JSON_OUTPUT_FILE="$R/kernel-first.json" node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/research-tasks.spec.ts --grep 'redirecting one task library link' --output "$R/kernel-first" --reporter list,json`：退出0，**1/1，10.8秒**（用例2.2秒）。完整原记录`kernel-first.log/json`，实际任务／附件前后依据在结果目录的`task-local-redirection.json`。
- 每轮图形动作前预检DISPLAY后，`DISPLAY=:99 SCHOOLOOM_UI_PORT=6117 SCHOOLOOM_UI_DATA_DIR="$R/ui-profile-first" PLAYWRIGHT_JSON_OUTPUT_FILE="$R/ui-first.json" node node_modules/@playwright/test/cli.js test --config "$R/ui.config.mts" tests/ui/research-tasks.spec.ts --grep 'sent task context retains' --output "$R/ui-first" --reporter list,json`：退出0，**2/2，1.4分钟**，Browser24.1秒／Electron37.1秒，无业务失败、skip或retry；保持既有任务UI90秒预算及原状态观察期限。原请求候选、ErrorInfo、scope／instruction／run及原contextItems见两目录的`sent-task-save-conflict.json`。

当前apply与执行后delivery instructions已保存；`evidence-index.json`列出三份逐例证据路径，`collect-evidence.mjs`从真实输出重核A/B不联动、发送项不变和CAS错误。测试结束沿既有finally／fixture teardown收尾：两个model-kernel原始附件均childClosed=true／exit0，自有执行无残留，6117无监听，见`collect-evidence.log`及`cleanup.json`；项目未提前删除，配置按原teardown退役。原始首次编译失败保留，未重跑已绿矩阵或用超时／重试刷绿。

到W1／W2证据补齐交回停止，独立审查／最终接收／归档归主线。W3历史原始证据、撤权或新版后的完整询问／用户决定链、正式报告页面ready、平台整项及科研质量没有由本片新增结论；不以33/33或本机三次场景通过概括全部行为。独立补丁、版本／退出码清单与本地提交见同根RESULT和commit.txt；本轮不改docs/development.md，相关单句纠偏由图线负责。

## 主线接收：首批任务已完成

2026-10-29主线接收本轮五文件增量。独立审查逐项核对真实来源故障、原错误与版本、明确选择后的持久化、新会话接续及双宿主结果，未发现确证缺陷；报告为`/home/joshua/.cache/scholoom-finish-active/project-independent-review.md`。三来源3/3与双宿主2/2的原始JSON及附件由审查者独立核对，相关9/9回归与类型检查已通过；主线当前tools类型和strict验证也通过。没有生产代码变动，不为接收机械重复长UI。

本change按proposal首批范围为33/33；完整库删除恢复分类及主题知识仍由后续提供者交付，不在本次已实现能力中。下文“待主线审查／不归档”为工作线交接时状态。

## 4.1首批来源异常消费：当前交付

本轮从clean的`cb5f7ed30f69b45301c83f296268578051b84e0b`继续。主线明确批准按proposal的首批项目文件／库附件及未修改的“来源异常保留事实并等待决定”Requirement验4.1，不要求本change实现整套D／E或主题知识。旧轮32/33及等待描述保留为历史，当前范围以本节、design第12节和tasks 4.1为准；完整删除／恢复与主题／分析知识依然没有本片可消费的真实提供者，不宣称完整行为矩阵已实现，不归档。

本轮未发现需要新增生产代码／DTO的本域缺陷。`ProjectTasks`保留任务原引用，`ResourceAccess.read`沿原ref／basis实际核查，`MaterialFiles.status/read`报告真实storage／state／ErrorInfo，任务工具已有暂停询问指导。仅扩展`tests/kernel/research-task-agent.spec.ts`原来源故障用例和`tests/ui/research-tasks.spec.ts`一个双宿主代表用例，并统一原design／tasks的首批验收边界；来源异常Requirement原文未删改。没有改library schema／迁移／删除provider、harness执行资格、FileEditor、TaskPort或任何共享生产装配。

| 4.1首批要求 | 实跑证据与边界 |
| --- | --- |
| 真实来源失败及原错误 | 三个参数分别先创建并读到真实项目文件、managed附件、linked附件，取得真实ref／basis，再移除隔离文件。读取返回的完整ErrorInfo与真实worker工具结果逐字段相同；TaskLink和原材料版本不变。库附件仍有登记，storage分别为managed／linked，state为missing，资源describe报告不可读；文件丢失不等于库对象被删除 |
| 分类不可用、暂停询问 | 受控外部模型经真实工具取得读取错误及`library_attachments`状态，明确说明删除记录查询unavailable，提出选择并结束本轮依赖工作。真实消息／ToolRecord证明没有任务保存、文件编辑或成果生成，原任务及既存过程／成果不变。unavailable是消费者对未提供分类能力的明确表达，不是伪造的删除查询结果，未声称已查无历史／删除者／恢复 |
| 明确选择后持久化 | 实际下一条`session.send`携带新的instructionId，经真实worker单次`save_research_task`，把原ErrorInfo／ref／basis、库storage／state、分类不可用、用户选择、跳过范围和下一步保存到任务文件；保留全部链接和既存材料，未读来源不计为已采用。不忽略用户选择前的错误，也不重跑生成或自动重试来源 |
| 新会话接续 | 新session只经发现任务→重读入口→读取原process／result接续；它没有旧选择指令消息，仍能取得已保存选择及下一步，实际工具返回两份原文，磁盘原材料不变。linked同路径出现不同字节后原版本读仍拒绝contentChanged，不称恢复 |
| 双宿主代表 | Browser与真实Electron任务详情点击实际库来源后显示不可读，原任务内容和引用不变；刷新及新会话仍能从任务打开原过程和成果。此UI例没有模型，不单独证明Agent暂停；它消费真实broker／库／任务／资源／文件，未用成功端口替身 |

本轮cache根`/home/joshua/.cache/scholoom-finish-active/research-task-workspace`（下称`<root>`），TMPDIR为`<root>/tmp`。Linux／Node24.12.0／Playwright1.63.0，沿共同基线已验构建，只有测试／文档改动，不重建同源生产产物。独立UI端口6023；`ui.config.mts`由保全的round13生成入口从本树cwd生成，底层静态产品及脚本位于cache，未启动开发服务器。每轮双宿主前都用`DISPLAY=:99 xdpyinfo`预检，未启动或停止共享显示。

### 首次失败、修正与最终验证

- `kernel-first.log`保留首次3项失败：新增断言把ToolRecord.input的JSON字符串误当对象；同次已取得真实notFound及暂停回答。仅改断言为JSON.parse，未修改生产错误、期限或策略。`kernel-first/`保留原trace／error context。
- `kernel-second.log`：修正后真实三来源**3/3**通过（59.1秒）。随后补充“未采用原来源”和新会话无旧指令断言，整份Agent接续及任务工具相关回归**9/9**通过（1.3分钟），见`kernel-final.log`。
- `ui-first.log`保留缓存外置`.ts`配置缺ESM语境导致的模块加载失败，业务尚未运行；改用同一生成器输出`.mts`后，代表双宿主**2/2**通过（1.1分钟），见`ui-second.log`。没有修改产品或测试期限。
- `tools-verified.log`对应`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json`，通过；`biome-final.log`对应已有Biome直接入口检查两个测试文件，通过。

最终可重建命令及带附件JSON结果见本节收尾。本轮只控外部HTTP模型回答，不评价真实模型的科研质量或其所有自主选择；内部Kernel／broker／仓储／worker／授权／文件均真实。managed文件丢失是隔离profile内的定点磁盘故障，linked／项目文件丢失也是隔离文件动作，不替代删除历史provider。分类未知的暂停语义没有新增强制harness等待状态机；一般对话以提出问题结束该轮，后续须实际用户消息。

本片自查了原错误／引用版本、写入前明确选择、无库正文副本和既存成果保护；没有新增数据迁移或共享生产接口。主线负责最终独立审查、整合及规格同步。Windows／macOS目标、完整删除恢复、主题知识、真实科研质量及全仓CI本片未验；未来提供者到达时须单独实跑其真实分类／恢复，不能以本轮首批通过代替。

### 本片收尾与重建入口

最终记录以JSON reporter保存成功附件供主线独立核对：`kernel-evidence.json`／`kernel-evidence.log`为三来源**3/3，1.0分钟**；`ui-final.json`／`ui-final.log`为双宿主**2/2，1.1分钟**。`extract-evidence.mjs`解出`kernel-evidence-{1,2,3}.json`和`ui-final-{1,2}.json`，`evidence-index.json`绑定每例TaskRef、来源ref及检查／选择／新会话的实际run；解包自查同一检查run与失败工具、选择run与保存工具相符。首次失败及中间结果全部保留，未用新成功覆盖原失败。

```sh
export TMPDIR=/home/joshua/.cache/scholoom-finish-active/research-task-workspace/tmp
# 在本树cwd；已有直接工具入口，不触发pnpm隐式安装
PLAYWRIGHT_JSON_OUTPUT_FILE=/home/joshua/.cache/scholoom-finish-active/research-task-workspace/kernel-evidence.json \
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/research-task-agent.spec.ts \
  --grep 'real .* source failure' --output /home/joshua/.cache/scholoom-finish-active/research-task-workspace/kernel-evidence --reporter list,json
# 双宿主运行前再次预检；配置／profile每次独立生成，登记项目保留到配置退役
DISPLAY=:99 xdpyinfo
node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs /home/joshua/.cache/scholoom-finish-active/research-task-workspace/ui.config.mts
DISPLAY=:99 SCHOOLOOM_UI_PORT=6023 \
SCHOOLOOM_UI_DATA_DIR=/home/joshua/.cache/scholoom-finish-active/research-task-workspace/ui-profile-final \
PLAYWRIGHT_JSON_OUTPUT_FILE=/home/joshua/.cache/scholoom-finish-active/research-task-workspace/ui-final.json \
node node_modules/@playwright/test/cli.js test --config /home/joshua/.cache/scholoom-finish-active/research-task-workspace/ui.config.mts tests/ui/research-tasks.spec.ts \
  --grep 'unavailable task library source' --output /home/joshua/.cache/scholoom-finish-active/research-task-workspace/ui-final --reporter list,json
node /home/joshua/.cache/scholoom-finish-active/research-task-workspace/extract-evidence.mjs
```

相关9项回归命令为`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/research-task-agent.spec.ts tests/kernel/task-tools.spec.ts --output <root>/kernel-final --reporter list`。实际执行后已取得`delivery-instructions-final.json`，按当前apply定位完成4.1；`apply-final.json`为**33/33、all_done**，只代表已批准的首批任务状态，不替代主线最终审查或扩大Requirement实现范围。严格OpenSpec／schema及diff检查通过；生产源码和构建未改，未安装依赖或跑全仓CI。

独立增量为`<root>/001-task-source-failure-consumption.patch`，精确五文件：两份测试及本change原design／tasks／delivery，基于cb5f7ed，无生产共享符号。`report.md`为本片交接摘要，`patch-verification.log`记录当前树反向check；所有必需输入与结果在Git或上述cache，历史/tmp路径仅是旧回执。本轮测试已完成finally／globalTeardown：内核／模型及Electron／静态承载均收尾，6023无监听，自有cache根无残留执行，登记项目未提前删除，隔离配置按既有teardown退役。到首批4.1及补丁交回停止，不自行归档、提交或继续其他模块。

以下各轮保留原回执及当时限制，不作为本轮当前状态。

## 第十六轮主线接收

主线接收FileEditor保存前强读取原身份／基础正文、重新定位并单次CAS的修复；旧submitted不能使用后来reload的正文依据覆盖新内容。冻结Standards／Spec独立审查均0确证发现。合入后先完整构建，再跑`file-workbench.spec.ts`两个代表场景：Browser与Electron合计4/4通过，含上一轮Electron回收恢复后保存和本轮pending-save／reload竞争。资源身份／条件保护6/6同时通过，位于18/18边界组合。

主线整组UI为7通过／1失败；唯一失败是Electron委派完成状态，不能因此抹去其失败，也不能将文件4/4记作整体科研工作台完成。原第十五轮没有保存RPC现场，仍不能追溯断言与新复现为同一细因。证据在`/home/joshua/.cache/scholoom-round16-integration/{main-ui.json,main-boundaries.json,ui-results/}`，无旧`/tmp`运行前置。

本change维持32/33，4.1仍等真实库删除／恢复和主题知识提供者，不归档，不再派发。文件修复本轮已并入共同源码，后续从Git继续而非重放独立patch。

## 第十五轮主线回归与下一片

本树按等待指令无增量。主线组合新启动诊断后运行首文件双宿主：Browser通过，Electron在`file-workbench.spec.ts:210`失败。该次已经取得模型请求并取消，改名、回收、恢复后的编辑器仍可见最新草稿；点击保存后磁盘保持旧正文，原5秒持久化断言失败。不能称草稿已丢失，也不能由指令／run专用uiRpc没有保存事件推断未发送；保存请求、basis及结果链仍需核查。

原始证据为`/home/joshua/.cache/scholoom-round15-acceptance/{main-ui.log,main-ui.json,ui-results/file-workbench-project-fil-79a6c-y-rename-trash-and-recovery-ui-electron/}`。项目fixture在该根tmp内，属于稳定cache路径；测试自有执行已按finally关闭，登记项目及现场保留。生产renderer相对58eda14无修改，这一事实不解释失败因果。整合组5/6未计全绿，下一片R16.1优先定位并修复此保存回归，保留原持久化断言及身份／冲突留稿保证；4.1真实库提供者继续等待，旧queued／onStart缺证不据此关闭。

## 第十四轮主线验收

本轮两工件已保全合入，规范及规格审查无确证问题；两宿主首文件现场的真实发送／受理身份及缺失执行阶段接收。原断言后清理的unavailable不用于补前5秒时间线，未把未执行的改名／回收写成文件损失。本域无源码修复依据，不重跑旧trace或已绿多项目场景。

下一片将该具体执行侧缺口交Agent统一处理，本线停止重复取证；4.1所需库删除／恢复及主题知识仍未交付，按原C／D／E批次等真实提供者，不造分类或从notFound猜删除。主线及后续所有权见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)，必需输入仍在Git／cache。完整平台与科研质量继续开放。

## 第十三轮主线验收

本轮仅四工件已保全合入；独立两轴审查无本线确证发现。原resident多项目场景Browser／Electron2/2及四组同次project／session／instruction／run／instance、原文件与停机后采样边界已审接收。所属代码未改，不重复该绿色场景。主线新Linux完整Checks40613967267的首文件场景两宿主仍在首模型请求数0处失败，不能用本机另一场景或旧次通过关闭CI。

下一片只消费这次首场景已有窗口／执行附件并按真实身份收敛；第二场景与4.1提供者等待不混同。新原始日志、启动脚本及后续工件在`/home/joshua/.cache/scholoom-round13-acceptance/`，不依赖现有/tmp；精确范围见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)。内部机械组合已接收，完整平台、库删除／恢复和科研质量仍开放。
## 第十二轮主线接收与共同消费

七文件观察增量已保全合入，两路独立审查无确证缺陷。主线第一file-workbench场景Browser通过；Electron首次显示服务启动失败，复用预检通过的已有DISPLAY后通过。其后共享RPC闸门修正的Electron文件场景再次通过，成功／拒绝分支保留。窗口发送回执与自有model-kernel附件按同次project／session／instruction／run匹配，两宿主均已观察实际推进，不再以旧Electron模型0作为当前第一场景的结论。

原始结果及cross-observer-results在`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`，有界采样不是完整事件历史。第二resident项目会话场景尚未进入本次共同UI组合，下一片由本线独立核查；不重复第一场景或在研提供者等待。4.1的真实库删除／恢复及主题知识仍未提供，完整change不关闭。

## 第十一轮主线接收与下一片

本轮两文档的只读取证已冻结合入，独立规范／规格审查无确证夸大；不将文档接收当作旧CI修复。最新完整CI及逐例矩阵在`/tmp/scholoom-round11-acceptance-Jx5Oez/`。下一片由本线提供真实Browser／Electron窗口的发送／受理／快照安全观察，Agent线独立提供model-kernel执行观察，字段和所有权按[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十一轮验收后的安排)。两片先独立交付再由主线关联；本线不并改harness或model-kernel，原4.1提供者仍等待。

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

## 2026-10-28：第十一轮窗口侧公共UI取证

### 成果与边界

开始git clean，HEAD `29cd7283388dfd752911eacb9c3bf8416031db15`，按本轮主线授权与parallel-development-plan“第十一轮验收后的安排”执行。使用原`establish-file-backed-research-tasks`／scholoom-dev，先读取apply并在design第10节及tasks第10节闭合本片，再实施测试诊断。没有改生产、项目文件或harness业务，不重放旧patch或同步别树。主线已验构建产物直接复用，本轮测试修改无需重建；测试期间产物冻结。

写集为`tests/ui/ui-rpc-observer.ts`的`observeUiRpc/save`、`tests/ui/fixture.ts`的按需`uiRpc`生命周期、file-workbench两个指定场景的依赖及清理前保存，以及本change的design／tasks／investigation／delivery。原helper签名、openWorkbenchWindow／多窗口登记、projectId会话创建、草稿和目录业务断言全部保留；未改model-kernel、execution-diagnostics、生产preload／client／协议或任何执行来源、恢复、工具和标签。无schema／生成映射或architecture消费变化。

helper只监听传入真实uiPage的WebSocket事件，同连接RPC ID关联session.send和workbench.watch／snapshot，重新白名单构造安全字段。上限128观察、32连接、每连接32待回执、快照8条最近用户指令、2MiB输入帧，字段上限1024；同连接重复待回执ID停止该连接关联，超量和异常计数。只保留请求／项目／会话／指令／run身份、revision、结构化状态／错误码及本地时点，无文字、材料正文、凭据、URL、token或原始帧。首次save冻结、移除本观察器监听并写文件／TestInfo附件，幂等返回同一结果；存储／附件错误延至fixture teardown报告，保护原业务断言，缺连接或监听失败明确缺证。

### 实际验证与首次失败

本轮证据根`/home/joshua/.cache/scholoom-ui-rpc-7C1T29/`，TMPDIR为其`tmp/`，避开本机/tmp配额。Linux／Node24.12.0／Playwright1.63.0，复用已有依赖，无安装或下载。临时`playwright.ui.config.mts`导入本树原配置，仅将webServer换为`node /tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，并绑定本树绝对testDir／teardown；普通静态产品，无DEV样例依赖。隔离端口5721、配置、项目和模型服务；内核／broker／仓储／UI真实，外部HTTP模型为既有受控替身。观察器模块自检仅模拟Page／WebSocket事件，不算内部提供者或业务通过。

| 命令／范围 | 真实结果／证据 |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` | 通过，`type-final.log`；先前两次也通过 |
| `node node_modules/@biomejs/biome/bin/biome check tests/ui/ui-rpc-observer.ts tests/ui/fixture.ts tests/ui/file-workbench.spec.ts` | 最终3文件通过，`lint-last.log`；首次assignment／格式及后续finally throw诊断保留于`lint-first.log`／`lint-final.log`，已改写，无放宽规则 |
| `node <root>/self-check-complete.mjs` | 7组安全／故障自检通过，`self-check-complete.log`和`module-checks/`：白名单隐私、同连接归属、错误／revision、各上限、无连接／监听失败、保存错误保护原断言、重复ID隔离、save幂等及仅清理自身监听。初版6组通过后扩充，未覆盖首次日志 |
| 下方唯一一次双宿主命令 | **Browser通过37.6秒，Electron失败44.4秒，合计1通过1失败／1.8分钟**。`ui-first.log`及两宿主trace／安全附件；未重跑 |
| `node <root>/check-artifacts.mjs` | 两份实际附件严格字段／数量／时点和同连接请求回执关联通过，TestInfo副本逐字节相同，`artifact-validation-final.log`及`artifact-validation.json`。首次检查误将可选message.runId当必需而失败，按现行harness-record-contracts核对后，只要求同snapshot的run及instruction身份分别匹配；未改被验附件或业务 |

唯一UI命令（`<root>`为上述证据根）：

```sh
TMPDIR=<root>/tmp SCHOOLOOM_TEST_ROOT="$PWD" SCHOOLOOM_UI_PORT=5721 SCHOOLOOM_UI_DATA_DIR=<root>/ui-profile \
node node_modules/@playwright/test/cli.js test --config <root>/playwright.ui.config.mts \
tests/ui/file-workbench.spec.ts --grep 'resident project sessions switch files and preserve each project draft' --output <root>/ui-first
```

Electron保留原5000ms的`model.requests.length`期望1实际0，测试行406；没有采集错误覆盖原失败，也没有加sleep／timeout／重试或改model-server／初始化。此次是当前静态产品新样本，不能冒称旧CI同次重现。仅此resident场景作最小双宿主验证，另一个指定文件场景已挂载并通过类型／lint，未实跑，不声称双场景业务绿色。

双宿主运行后仅作窄收尾：fixture将保存错误改为test body结束后报告以满足lint；无效RPC ID计数、重复ID隔离经模块自检核对；两场景去掉原finally的项目目录删除，以保留登记目录至配置退役。实际那次UI运行仍执行旧删除，所属配置随后由原globalTeardown退役，项目根已不存在；本轮不能提供它们的后续DB／文件查询证据。最终保留目录写法未重跑UI，不能将该收尾算入本次实际双宿主验证。

### 可交回的身份与缺证

附件路径均为`<root>/ui-first/file-workbench-resident-pr-7ae0b-preserve-each-project-draft-ui-<host>/ui-window-rpc.json`，TestInfo附件副本在同目录attachments。Browser 60条／33393字节，Electron36条／18306字节，各1连接；两端所有丢弃、无效、监听错误及冻结时待回执计数均0。`coverage=observed`只表示相关流量被观察，不表示业务成功。

Browser两个真实发送分别以RPC137／159取得成功instruction／run回执，后续对应watch从queued／accepted至completed。Electron原先缺失的实际窗口身份链现为：

| 字段 | 同次实际值 |
| --- | --- |
| projectId | `60c0bac1-e200-4445-877a-3dd05276f45e` |
| sessionId | `87885264-8ce3-4cca-b101-93aacca20add` |
| instructionId | `d3898d7c-1752-4bca-8b53-1f9d9e390ce3` |
| runId | `13d33d9d-6eda-4a92-b2ab-fd08f2ec498a` |
| 发送／受理 | connection1，RPC135，观察1793140025669／1793140025706毫秒 |
| 随后watch | 1793140025721及1793140025761，revision12，同session／run为queued、同instruction为accepted |

本地时点是窗口事件到达测试端的时间，不是内核或worker阶段。未收集instance／PID，不能从queued判断执行准入、worker initialize或首模型前根因；下一轮主线／Agent按上述真实绑定关联执行侧。本片不消费Agent未合入探针，也不跨树发送消息。失败不能改称项目保存或草稿丢失；该场景前段草稿切换断言已通过，Beta发送尚未执行。

CI仅按授权查一次：`windows-diagnosis-once.json`为40591705558、head29cd728、completed／failure；`checks-once.json`为40591705520、同head、in_progress。没有随后轮询、触发CI或将执行诊断整体失败推成UI根因；目标新CI最终回执、Windows／macOS及分发包未验。原40540362614／938c33f计数仅沿主线作为历史基线，未用本次Browser绿色关闭其失败。

### 审查、交付与停止点

同模型原生只读辅助Agent核对helper／fixture／两个finally及design，确认白名单、有界关联和实际uiPage，无发送包装／重放或状态注入；保存错误保护和按连接归属修正后未报告新确证问题，未代跑测试。其后重复ID／无效ID及保留目录收尾由父端核对，模块实跑和附件检查均由父端取得；Agent已关闭。本片无需跨模块架构或新产品定案，不修改业务规格。

tasks10.1／10.2仅关闭本片实施、自检、一次双宿主运行及真实失败交回，不关闭Electron业务失败。I1／4.4c已接收不变，4.1继续等待真实库删除／恢复及主题知识提供者，完整change、I3／I5／I6和科研质量不关闭。达到窗口公共诊断片后停止，不接管Agent执行诊断或文献，不重复测试。最终OpenSpec／diff和独立补丁的结果见本节收尾。

收尾：`openspec validate establish-file-backed-research-tasks --type change --strict --no-interactive`及`openspec schema validate scholoom-dev`均通过，日志`openspec-{strict,schema}.log`。最终apply为**29/30、ready**，只剩4.1；`git diff --check`及新helper的no-index空白检查无诊断。可审查增量为`/home/joshua/.cache/scholoom-ui-rpc-7C1T29/001-window-rpc-observation.patch`，直接依赖29cd728，共7文件；`patch-manifest.json`记录逐文件前后SHA256，`patch-verification.log`记录独立临时index／object目录正向check及工作树反向check，真实index和HEAD保持未变。首次附件检查器的错误另保留于`artifact-validation-first-error.txt`，修正只在临时检查器。端口5721已释放，按本轮根及静态脚本核对无遗留服务；所属测试已结束、辅助Agent已关闭，未提交／推送／PR／归档。结果工件保留供主线复核，下一步只交绑定身份的执行侧缺证，不后台等待新CI。

## 2026-10-28：已同步两端观察后的多项目场景

### 本片成果与消费

开始HEAD为`ba29ee61ac6f8700cfe6a9fbaa529a8a7a75aad1`、git clean。按parallel-development-plan“第十二轮验收后的安排”及本轮用户授权，只核第二个resident project sessions场景。共同源码和主线构建／同步证据来自`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/`；HEAD与已构建e3c815b3af6bd4b9718820f641b10bab57a69b24仅两份Markdown差异，`source-equivalence.log`保留实际核对。复用已验同源共享／内核／桌面产物，没有旧patch重放或自行同步。

原场景首次双宿主**2/2通过，1.6分钟**：Browser31.3秒、真实Electron41.2秒。没有原断言失败、修正重跑、期限修改或统一等待。原第一文件场景主线已验，本轮不重复；窗口观察器七组自检、旧trace下载、全套UI／内核也未重复。当前场景及ui-rpc-observer／fixture／model-kernel／执行核心均未改，新增写集仅本change的design第11节、tasks11.1、investigation和本delivery。新公共协议／生成映射／业务规格不适用。

实际消费现成窗口／执行JSON，而非只看2次累计模型计数。临时`correlate.mjs`逐份附件从session.send的同连接请求／回执取得project／session／instruction／run，再在同project／session capture中核目标指令consumed及该run／instance的model.output、仓储completed、窗口同run completed与controller正常退出；kernelInstanceId／kernel PID、执行instance／worker PID分列，不假定它们相等。4条链均通过，两个宿主的安全TestInfo附件副本与原JSON逐字节相同。

| 宿主／项目 | instructionId → runId → 执行instanceId | worker PID |
| --- | --- | --- |
| Browser Alpha | `3d233ee9-a8a7-400b-8051-38ed280f0f77` → `81235576-936f-4045-ad04-0266b9d0b3f8` → `78921a8a-6d43-45ca-b666-ae64b6cc5774` | 1331629 |
| Browser Beta | `98c7f46f-91f6-4fbe-ba1e-6a2e2f78a43f` → `680102e4-f918-4232-8fa1-3e2f9f7d4588` → `ccbee20b-7e58-4e6c-b5d2-5536d73cf5af` | 1332399 |
| Electron Alpha | `880f0ef9-8189-4800-81d3-2562d4787ba6` → `161f91d2-d202-4caa-b7fe-dc66e2ca788c` → `65901e73-5212-40a1-80c5-a3024a921a81` | 1337489 |
| Electron Beta | `1f364f23-7825-4d20-8d96-46a452b68e62` → `de8d819a-7d4c-4b52-8542-0bef471571c2` → `447cd91f-8e0c-4a5b-9a27-a953eb2694d8` | 1337890 |

完整projectId／sessionId／kernel身份、原附件路径、请求／受理／消费／输出／完成本地时点和revision均在`same-run-correlation.json`，来自同次`ui-first/`两个目录，没有借用主线其他场景或旧run完成。两端各1连接，窗口的全部丢弃／无效／监听错误／冻结待回执为0；执行scope／生命周期及四capture的丢弃计数均0，snapshot未超时。每capture停机末次采样各有一条unavailable，原记录保留；此前该run已完成、窗口已收到revision20／25，不将收尾采样失败倒写为首因。有限采样即使无丢弃也不等于完整时间线。

原场景从Alpha／Beta草稿切换后再切回Alpha实际发送，核两项目运行标识、消息隔离和两会话各自完成；发送前的文件树／标签／草稿切换、同名项目及迟到会话创建断言均通过。四个登记项目根保留于本轮TMPDIR直到配置退役，实际仍可读；按identity.json匹配发送回执projectId，alpha.md／beta.md均保持原已保存内容，未保存草稿未写盘。没有测发送完成后的UI草稿再次打开，不扩大这一结论。

### 实际命令、环境与证据边界

证据根`/home/joshua/.cache/scholoom-project-r13/`（下记`<root>`）。Linux、Node24.12.0、已有Playwright；DISPLAY=:99经`xdpyinfo`预检通过，`display-first.log`保留。未启动／停止共享X服务，也无本轮Xvfb失败。TMPDIR、UI配置、项目、模型和端口5721隔离，全部使用本机cache以避开/tmp用户配额；原产物测试期间冻结。模型仅在既有HTTP外部边界受控，真实Browser／Electron窗口、broker、仓储、worker和文件均未替换，临时关联脚本只读实际附件／项目身份／合成文件，不代造执行事实。

| 命令／操作 | 实际结果及日志 |
| --- | --- |
| `git status --short`、`git rev-parse HEAD`、`git diff e3c815b3af6bd4b9718820f641b10bab57a69b24 HEAD --stat` | clean、ba29ee61及两Markdown差异；无源代码漂移。`source-and-products.json`记录所用测试／观察／产物入口SHA256 |
| `DISPLAY=:99 xdpyinfo`、`ss -ltn 'sport = :5721'` | 实跑前显示可用、端口空闲；未接管别人的显示或服务 |
| 下列唯一Playwright命令 | 原场景双宿主2/2，`ui-first.log`和两目录的附件／截图；无首次失败可修，无重跑 |
| `TMPDIR=<root>/tmp node <root>/correlate.mjs` | 四链路、附件副本和4个真实合成项目文件全部通过，`correlation-first.log`、`same-run-correlation.json`；不使用别run或模型累计计数填证 |
| `openspec instructions delivery --change establish-file-backed-research-tasks --json` | 实际验证后取得`delivery-instructions.json`，更新本记录，未另建长期账本 |

```sh
TMPDIR=<root>/tmp DISPLAY=:99 SCHOOLOOM_TEST_ROOT="$PWD" SCHOOLOOM_UI_PORT=5721 SCHOOLOOM_UI_DATA_DIR=<root>/ui-profile-first \
node node_modules/@playwright/test/cli.js test --config <root>/playwright.ui.config.mts \
tests/ui/file-workbench.spec.ts --grep 'resident project sessions switch files and preserve each project draft' --output <root>/ui-first
```

临时配置只替换原webServer为`node /tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`及本树绝对testDir／teardown，复用普通静态构建产品，无DEV样例依赖，不启动开发服务器。UI清理保持原模型release、client.dispose及可信stop；实际拥有的内核均stopped、子进程close code0，配置按原globalTeardown退役，项目不提前删除。

只读同模型原生辅助Agent核对既有观察字段和公开查询边界，明确message.runId可选、consume.response不含具体instructionIds、model.acquire不证明HTTP请求、kernel实例与执行实例不可混同。父端据实际窗口回执及目标指令状态／model.output核对四链，而非机械新增查询或重复TaskPort。辅助Agent未改文件／运行测试，已关闭；实际结果由父端取得。此为诊断消费与已有行为核查，未发现需要生产或测试修补的本域根因。

本片无安装／下载、CI触发、真实用户库或其他工作树操作，也未查询／后台等待40613967285／40613967267新CI。主线给出的29cd728／40591705520历史计数继续作为其源码平台证据；本次Linux本机2/2不关闭旧CI／Windows／macOS稳定性、完整change或科研质量。4.1继续等待真实库删除／恢复及主题知识提供者，I1／4.4c接收不变。到此机械消费边界停止，无新产品／架构选择需猜定。

收尾：OpenSpec strict及scholoom-dev schema通过（`openspec-{strict,schema}.log`），apply为**30/31、ready**，仅4.1开放。仅四份本change Markdown改动，无生产／测试／fixture符号变更；原记录的测试／观察器／产物入口SHA256复核未变，无需重新构建、类型或lint。端口5721已释放，本轮根和静态脚本无遗留进程，`final-scope.log`保留核对。可审查文档增量为`/home/joshua/.cache/scholoom-project-r13/001-resident-project-observation-receipt.patch`，直接依赖ba29ee61；`patch-manifest.json`记录逐文件前后hash，`patch-verification.log`记录临时index正向和工作树反向check及真实HEAD／index未变。没有本地提交、push、PR、archive或后续任务展开，证据与登记项目保留供主线接收。

## 2026-10-28：新Linux完整CI首文件场景的两份原现场

### 当前结论与原始身份

起点HEAD `f4ab1e5f1ed17ae9af656c1f9945005a2786d911`、git clean，沿第十三轮安排仅收敛Checks40613967267／源码`e3c815b3af6bd4b9718820f641b10bab57a69b24`的首个file-workbench场景。两宿主原112行仍是5秒预算内模型请求数期望1、实际0；本片没有修复通过或新UI绿色结论。已实际绑定两份窗口与执行附件，**两次发送均成功受理，但没有保留可绑定的执行instance／worker PID、onStart、initialize、consume、model.acquire或model.output事实**。不能从空数组或queued判定worker未创建，更不能指认两个样本同一启动根因。

| 宿主 | 同次实际身份 |
| --- | --- |
| Browser | project `484987af-366b-4c70-8c58-cd90c838f44a`；session `f0484ec8-d6ef-426f-8b9f-9da7c9457a10`；instruction `2a419394-b73a-4246-8ebe-6173c6548745`；run `61029427-2508-4f50-9e2d-394b3937f010` |
| Electron | project `6bd25125-4eb0-49f0-aeaf-a9102b794bf4`；session `d037c129-bd08-45f9-aa06-e42e547ca872`；instruction `640a5a73-b122-4933-ac64-d433043060d9`；run `fffde8ee-d32a-47ea-9f68-1cc25bfd2a2b` |

Browser属于kernel instance `7ad33c2f-3859-487c-841f-70113e229c4d`／PID23377，窗口connection2、RPC122于1793152325700观察到发送，1793152325705取得成功回执。随后1793152325715／1793152325762两份watch为revision15、同run queued和同instruction accepted。执行capture在1793152325705取得对应初始仓储状态、instances为空；此后没有有效执行阶段样本。原断言约1793152330571返回失败，Browser原WebSocket的kernel.stopping在1793152330578.787、同kernel instance；两条samplingError=unavailable在1793152330590／2330594，均在原失败后的收尾区间。

Electron属于kernel instance `9fc13956-23b6-4209-9f9a-784d227b0d55`／PID35800，窗口connection2、RPC117于1793153514959观察发送、1793153514962成功回执；1793153514980／1793153515022的watch为revision14、同run queued／同instruction accepted。执行初始样本1793153514956同样仅有queued／accepted、无实例；原断言约1793153519839失败，unavailable样本在1793153519870／3519871，kernel.serve.closed在1793153519869。不同观察方的本地时点不强行作为严格因果全序；初始仓储采样可早于窗口回执事件到达测试端。

两份窗口观察各2连接，全部丢弃／无效字段／监听错误／冻结待回执计数0，成功受理发生在替换后的实际窗口连接，不是默认空页。执行scope／生命周期和capture丢弃均0，未采样超时，children／controls为空；内核最终均正常close code0。有限事件采样和空控制列表不能证明执行全程没有活动，停机后的unavailable也不解释之前的请求计数0。

### trace、文件动作与尚缺执行事实

父包的`artifact-download-status.json`与另列的`artifact-trace-download-status.json`均已完成，实际含这两份trace；本片直接消费，没有新下载或远端错误。Browser trace保留208条Page资源记录、Vite client和89条/src/请求，属于CI开发承载；两份Electron Page network为空、无窗口DOM snapshot，不能据此抹去已取得的真实窗口uiRpc证据。Browser在发送后也仅有一个早期压缩DOM snapshot，不能用它补足原5秒窗口的最终DOM状态；本片没有重构该压缩DOM或将其当完整投影。两例`test.trace`均记录实际发送点击和原112行失败。

Browser的`resources/baeb595d70247eab97deb9252f188622.jsonl`一基251／252行与窗口RPC122的scope／instruction／run逐项匹配；253–259为对应watch／刷新，260为随后kernel.stopping。此前provider.configure成功且configured=true，files.mkdir、files.save及resources.save均有成功回执。两份`test.trace`中原76行磁盘正文轮询最终成功，99–103行未保存段落／预览／远端图片保护断言均通过；内部轮询的中间失败不当作最终测试失败。113行起的大文本、目录改名、回收／恢复没有执行，故本次失败不能称文件保存或草稿丢失。Electron无原始网络帧可再核保存RPC，但同次磁盘／UI断言与成功发送回执仍可核。

首模型计数0来自该场景独有外部模型夹具的已解析请求数组；执行附件的modelRequests=null不是同一计数。`tests/model-server.ts:543`先requests.push、后等待hold，hold本身不能解释已接收并解析的合法请求数0；但0仍不能区分未发送HTTP、未到达或解析前失败。Page trace不覆盖Node worker的出站HTTP，附件没有对应worker／模型阶段，不能据此声称HTTP已发或模型权限已拒绝。本片能证明的最早边界是成功受理后、首个可核执行阶段之前；初始化、消费、模型准入和HTTP的精确停止点仍未知。

### CI到当前源码的准确差异

独立只读辅助Agent与父端Git对象核对一致：file-workbench全文、ui-rpc-observer、ui fixture、rpc-gate、model-kernel、execution-observer、可信model-kernel-process、model-server、两份Playwright配置和Checks workflow在CI／HEAD完全相同；apps/kernel、harness、platform、models、client、protocol目录tree对象也相同。完整对象hash在`source-comparison.json`，辅助核对在`source-review.md`。这是源码一致性，不证明CI与当前本机环境／实际构建产物一致。

邻接变化是kernel-fixture新增有界生命周期解析和isolated-kernel安全stderr／退出分类；首场景使用独立startModelKernel，不经过startIsolatedKernel，runningKernel／runKernel及原连接期限内容未变，不能将这些新诊断当成该CI模型入口已有的事实。产品侧CatalogItemList的滚动恢复由useEffect改useLayoutEffect，未改发送／执行链，也没有证据解释此处0请求。精确相关diff保留在`source-diff.txt`。首场景截留resources.read后已经释放，再进行发送；后面的project.forget闸门尚未执行，成功session.send回执也不支持先改RPC闸门。

### 实际操作与独立输入

本轮独立根`/home/joshua/.cache/scholoom-file-r14/`，所有payload前先在bash中`export TMPDIR=<root>/tmp`。只维护本change原tasks／delivery，无生产／测试／观察符号修改，也没有新规格／生成映射。以下`<root>`均为该绝对根：

| 命令／操作 | 实际结果 |
| --- | --- |
| `git status --short`、`git rev-parse HEAD`、`openspec instructions apply --change establish-file-backed-research-tasks --json` | 起点clean／f4ab1e5f；沿原scholoom-dev续做，不因CLI状态关闭change |
| 消费父正式包两个状态文件，逐文件copy／SHA256比较 | 只保全首场景两宿主各trace.zip、ui-window-rpc.json、model-kernel-execution.json及error-context.md，共8文件；`input-manifest.json`列原路径、新路径和hash，均在cache |
| `unzip -t <root>/inputs/{browser,electron}/trace.zip`（分别调用） | 两份ZIP完整性通过，`browser-zip-check.log`／`electron-zip-check.log`；未解压整仓／全套trace |
| `node <root>/analyze-ci.mjs` | 最终实际身份、原断言、原始Browser帧与窗口一致、源码对象及失败／收尾时点断言均通过，`analysis-final.log`；安全投影`ci-two-cases.json`不保留正文、凭据、token或原始通用帧 |
| 首次临时检查器 | 我误写不存在的`.github/workflows/ci.yml`，在源码比较阶段失败；`analysis-first.log`保留。按实际文件改为checks.yml后通过（`analysis-second.log`），随后补Browser原帧／kernel身份交叉检查再通过；未改被验输入或重跑业务 |
| `openspec instructions delivery --change establish-file-backed-research-tasks --json` | 实际分析后取得`delivery-instructions.json`并更新本记录 |

两条原始CI错误的原日志一基行号／段落另在`ci-error-lines.json`，源为父包linux-ci.log的5298和5732附近；同次trace动作及结果行号在`ci-two-cases.json`。`analyze-ci.mjs`、`inputs/`、两份状态JSON和`source-review.md`构成独立接续输入，均不依赖当前/tmp；archive中的旧CI路径只是历史数据。没有运行UI／构建／类型／lint或原预算本机复现：证据缺口落在非本域执行里程碑，未找到本域修复，当前源码同源本机再绿不能补回旧次事实。独立端口5992未使用，未启动图形／静态服务或共享显示，因此不需要DISPLAY前置，也没有显示服务可收尾；第二resident场景和全套CI未重跑。无安装／下载、真实用户库或跨树在研输入。

### 交回的最小执行问题与停止点

请主线把以上两条原run分别交Agent／共享执行归属核查：沿现有实际准入和RemoteAgent／ManagedNode启动路径，先确认该run是否到达准入、受管控制器ready／模块loaded及onStart实例登记，再看execution.initialize；它们不是同一里程碑。现有onStart.response在登记返回后发布，当前附件没有这些事实，不能任选PID／instance，也不能把“等待启动”写成定论。最小后续修复或补证应保留原run与受理身份，核实际阶段／原错误；没有依据修改首场景、model-kernel核心、RPC闸门、容量、停止策略或任何5秒期限。本片不向其他树发消息、不另造执行观察器。

同模型gpt-6.1-sol／high只读辅助Agent仅核源码及边界，未改文件／运行测试，已关闭；父端完成两份原现场提取、身份与时点核对。两例原CI失败保持未修复，HTTP／执行instance／阶段和最终DOM均按上述具体缺证开放，不判共同根因。4.1库删除／恢复与主题知识提供者、完整change及平台整项保持开放；I1／4.4c既有接收不变。达到本轮两现场有界交回后停止，不因缺执行端事实自行扩写集。

收尾：OpenSpec strict、scholoom-dev schema及git diff空白检查通过，`openspec-{strict,schema}.log`保留；最终apply为**31/32、ready**，仅4.1未勾，不表示两例CI失败已修。可审查增量`/home/joshua/.cache/scholoom-file-r14/001-ci-first-file-evidence.patch`直接依赖f4ab1e5f，只含本change的tasks／delivery；`patch-manifest.json`记录前后hash，`patch-verification.log`记录临时index正向check、当前树反向check及真实HEAD／index未变。`final-scope.log`复核8份输入hash、2个原trace、分析入口及本轮无残留执行；所有必要工件均在Git或上述cache，现有/tmp可迁移而不影响本片接续。未提交／推送／PR／归档，停止于交回两条原run的执行侧具体缺证。

## 2026-10-28：R16.1 恢复后的草稿条件保存

### 已实现结果及边界

开始HEAD `7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`、git clean。沿“第十五轮验收后的安排”处理新的恢复后保存失败，与此前queued／onStart缺证分开。最终原首文件场景和新增的一项关键交错回归，Browser／真实Electron **4/4通过、2.1分钟**；服务端条件保存／稳定身份 **6/6通过**。没有重跑第二resident场景或全仓CI，不把局部绿色称为完整change或平台通过。

唯一生产改动是`project-ui.tsx`中FileEditor.save的既有文件分支：仍在flush后固定提交草稿和原source，预检复用原`readResource`的describe→read→describe强读取，取得实际同ref／basis、可读的基础正文。只有该已验证基础正文与原source的fileId、正文相同且未截断、仍可写，才以验证后的ref／basis单次调用port.save。基础正文与提交草稿分别比较，允许同身份／同基础正文在恢复后更新依据，拒绝真实基础正文变化或身份替换；之后再发生的变化仍由服务端CAS拒绝。不依赖后台reload更新document.source的完成时序，不按路径覆盖、不写入重试或自动放宽权限。新建分支、保存后的重读及“仅确实保存当前草稿才清除草稿”逻辑保持。

复用已有深层资源读取实现，不新增协议、DTO、保存模块、来源hook或状态权威，也不修改文件／库提供者、harness、model-kernel或共享RPC闸门。新增预检读取沿现有262144字节上限，截断拒绝；界面结构、视觉与状态文案未变，无需UI设计或正式规格变化。

测试写集只在原`file-workbench.spec.ts`：首场景的读取闸门移到实际写入之后，另增`a pending file save preserves content accepted by a later reload`。新回归使用既有闸门挂起保存describe，人工改盘并经真实“重新读取”接纳新正文，释放后等保存结束，核磁盘和编辑器保留新正文。它保护旧submitted不能配新正文basis回写的真实边界，不镜像实现私有结构；没有删除或放宽原持久化、5秒断言、90秒场景预算和输入／取消性能门槛。

### 原失败、同类复现与独立复核

主线R15的5/6首轮结果、Electron原trace／错误／窗口及模型附件保全到`original/`，逐文件来源／SHA256见`original-inputs.json`。原场景确实走过模型请求／取消、改名／回收／恢复，恢复后的精确textbox包含草稿，点击保存完成后原210行磁盘仍是初始正文。原窗口观察只记录指令／run，Electron Page network和保存时DOM均缺失，**不能证明原次未发resources.save，也不能倒写原次与本片新复现的RPC细因相同**。

先在cache保存原首场景的隔离诊断副本，保留原断言／期限、真实内部模块及固定模型边界，只加当前真实uiPage的窄观察：六种文件／资源方法、128条事件、每连接16待回执、2MiB帧上限，记录ref／basis、回执／错误码、RPC正文长度及合成草稿标记，不存正文、凭据、token或原始帧。FileEditor状态仅取最多4个视图及各4条有界错误提示；仅供本片调查，未并入公共观察器或产品。`file-save-diagnostic.spec.ts`、`observe-save.ts`及配置／ESM声明均在本轮cache。

首次加载因cache目录未声明ESM，按CommonJS解析而报broker/rpc未导出、未发现测试；`diagnostic-red.log`保留，未进入业务。补临时`package.json`的type=module后，**Electron同类红例1/1失败（37.1秒）**，仍为原恢复后磁盘持久化断言，`diagnostic-first.log`／trace未覆盖。

新红例中project `ab613897-5db9-4b6a-baef-5db5ee5b35b7`、fileId `8c22ab60-6513-4255-bfe6-a28ce00fe0e5`的restore回执complete，目标`recovered/draft.md`，草稿始终保留。后台四个最终describe响应178–181与保存describe182使用同一ref／新basis且可写；保存点击后前端显示依据变化拒绝，恢复后没有resources.save。观察丢弃／解析异常均0，`diagnostic-conclusion.json`与原`file-save-observation.json`保留逐项时点。原实现把source对象固定在await describe之前，后台reload更新共享source后，局部对象仍是旧依据；界面路径／草稿可先于已验证source就绪。本次复现和源码共同闭合这个共享竞态，不以专用uiRpc白名单的缺项推“未发送”。诊断snapshot中旧字段bytes实际为DOM text.length，**不能当UTF-8提交字节数**；这里只用其草稿／提示状态，RPC bytes来自Buffer.byteLength。

独立只读复核指出，仅后移source读取可能让旧submitted配上真正新正文的basis。新增确定性交错用例对这一候选固定红：**Browser1/1失败**，新正文已被重读接纳，保存结束却被旧正文覆盖，见`guard-red.log`／trace。保留初始source并核最新source的候选消除了该覆盖，但双宿主组仍**3/4部分通过**，原Electron210行仍失败（`ui-green.log`），证明依赖后台刷新时序仍不稳。最终方案因此复用完整强读取独立验证，不继续叠加时间等待或分支补丁。

完整预检首次运行又有**2通过／2失败**（`ui-verified.log`）：新保护用例两端通过，原首场景两端在更早的76行落盘断言失败。原因已由调用顺序闭合：旧测试在保存前挂住下一次resources.read，原来用于延迟写入后的重读，现在先拦住新增预检，尚未写入就等待磁盘。只迁移场景控制点为先挂resources.save并确认实际held，再挂后续resources.read并释放写入；原落盘断言之后仍确认读回held、继续输入、再释放，保留“写入后继续编辑不被迟到重读覆盖”的边界。共享闸门本体未改、原持久化断言及期限未减，最终同组4/4通过；这次失败属于测试控制点迁移，未当作新文件数据缺陷。

同模型原生辅助Agent只读调查原现场并审查并发方案，发现上述候选覆盖风险后，父端以真实回归固定红。最终完整读取方案复核通过，见`review-verified-read.md`；辅助Agent未代跑测试／改文件，已关闭。最终闸门迁移由父端核对实际held顺序和原断言，并双宿主实跑，不将早期候选审查当作最终UI验收。

### 实际命令与验证

本轮根`/home/joshua/.cache/scholoom-file-r16/`（下记`<root>`）。Linux／Node24.12.0／Playwright1.63.0，沿已有依赖；每次payload前在bash中export TMPDIR=`<root>/tmp`，每组图形实跑前xdpyinfo预检当前DISPLAY=:99并保留`display-*.log`。静态配置由本树cwd运行`node /home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs <root>/base-ui.config.mts`生成；底层static-ui位于已保全cache。独立端口5992、各轮profile、项目和结果，不启动开发服务器、不接真实用户库、不停共享显示。

| 命令／范围 | 实际结果及证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build` | 各生产候选改变后构建，首次与中间日志`build-desktop.log`／`build-final.log`；最终完整预检构建通过，`build-verified-read.log`（1分33秒）。各次测试均在对应构建完成后进行，测试期间无重建；仅迁移测试闸门复用最终产物 |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json`及`-p tsconfig.tools.json` | 最终通过，`type-verified-desktop.log`／`type-final-tools.log`；未改调用方接口 |
| `node node_modules/@biomejs/biome/bin/biome check apps/desktop/src/renderer/src/workbench/project-ui.tsx tests/ui/file-workbench.spec.ts` | 最终2文件通过，`lint-final.log` |
| 隔离诊断配置，`--project ui-electron` | 首次模块前置失败及同类业务红分开保留，如上；原始断言未变，观察器不是业务替身 |
| 原UI配置、仅新增交错例、`--project ui-browser` | 候选覆盖反例1失败，`guard-red.log`；未用绿色静默覆盖该反例 |
| 下列最终首场景＋必要新边界双宿主命令 | **4/4，2.1分钟**，`ui-final.log`。Browser首场景29.3秒／新边界16.9秒，Electron首场景32.6秒／新边界22.0秒；此前3/4及2/4均保留 |
| Playwright kernel入口选resource-access／resource-identity及下述grep | **6/6，15.8秒**，`kernel-guards.log`：无harness共同资源／过期basis、同内容替换在queued和publishing两阶段、复用路径不投递旧身份、排队读取的身份变化、超大HTML只读。未放松服务端条件保存或权限 |
| `openspec instructions delivery --change establish-file-backed-research-tasks --json` | 实施后取得`delivery-instructions-final.json`，更新同一记录，未新建长期账本 |

最终UI命令：

```sh
export TMPDIR=<root>/tmp
xdpyinfo > <root>/display-final.log 2>&1
SCHOOLOOM_UI_PORT=5992 SCHOOLOOM_UI_DATA_DIR=<root>/profile-final \
node node_modules/@playwright/test/cli.js test --config <root>/base-ui.config.mts tests/ui/file-workbench.spec.ts \
--grep 'project files share draft preview and survive directory rename, trash and recovery|a pending file save preserves content accepted by a later reload' --output <root>/ui-final
```

内核命令为`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/resource-access.spec.ts tests/kernel/resource-identity.spec.ts --grep 'common resources preserve ownership|same-content replacement|text from a reused path|queued byte reads|oversized project HTML' --output <root>/kernel-guards`。`<root>/diagnostic.config.mts`、`file-save-diagnostic.spec.ts`、`observe-save.ts`和type=module的package.json保留初始诊断入口；它是7aff原首场景加窄观察的冻结测试副本，不是另一套业务实现。其早期读取闸门对应旧保存路径，不能在最终预检构建上直接当作相同验收；最终可重建入口是上方仓库原测试＋base-ui配置。旧候选构建已经被最终构建替代，原红／部分结果以日志和trace为证，不宣称在最终产物上重现旧结果。

外部模型仅用既有受控HTTP夹具；UI、broker、项目仓储、资源、文件恢复／保存、worker及取消均走实际内部接线。新增回归以既有闸门明确控制RPC时序，内部提供者真实；人工外部改盘只作用于该用例隔离项目。六份主线输入、诊断与回归代码／结果、静态入口均在Git／cache，无当前/tmp前置；登记项目保留至配置退役，不清理旧轮数据。本轮未改FileEdit来源、TaskPort、程序生命周期、授权或库权威。

到R16.1局部保存修复及独立增量交回停止。旧CI queued／onStart缺证、macOS入口、Windows及平台稳定性、真实科研质量本轮均未验；不以本机绿色替代其原回执。4.1仍待真实库删除／恢复与主题知识提供者，项目文件回收恢复通过不能代替库删除分类，完整change保持开放。最终OpenSpec／diff、补丁与自有执行收尾见本节末记录。

收尾：原顶部R16.1已按当前apply位置完成，临时重复任务已移除，最终**32/33、ready**，仅4.1开放。OpenSpec strict／scholoom-dev schema、架构及diff检查通过，分别见`openspec-{strict,schema}.log`、`architecture.log`和补丁核对；架构0 findings／0 exceptions，无契约或生成映射变化。`final-source-products.json`记录最终被测源码及构建入口hash，收尾复核未变。端口5992释放、无自有根残留进程，七份实际model-kernel记录均stopped／childClosed／code0（`owned-kernel-close.json`）；登记项目保留，配置由原globalTeardown退役，辅助Agent已关闭。

独立增量`/home/joshua/.cache/scholoom-file-r16/001-restored-file-save.patch`直接依赖7aff2c7，只含FileEditor.save、原场景控制点／一项必要回归、原tasks／delivery四文件；`patch-manifest.json`记录前后SHA256，`patch-verification.log`记录临时index正向check、工作树反向check及真实HEAD／index未变。必要原输入、调查代码和静态承载均在Git／cache；没有安装／下载依赖、真实用户库、共享显示操作、提交／推送／PR／归档或额外同步，到本片交回即停止。
