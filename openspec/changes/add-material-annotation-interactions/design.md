# 实现设计

## 变更总览

本轮共同基线cb5f7ed已包含M3／图片、真实FileEdit来源及委派提供者，旧公共同步门已失效。主线本次明确采纳4.4只读分支：M1库正文继续只读，附件正文写回和sidecar转正文排除本批；阅读记录仍由原库保存。M2复用Evidence、有界稳定fileId查询及整次undo，验证真实父子联合和撤销后的实际工具读回。未核实的单次指令／工具及科研修改理由继续未知。

```mermaid
flowchart LR
  subgraph RI[阅读交互所有权]
    V[ResourceView 格式选择] --> S[视图选择与批注]
    S --> C[共同 ContextContribution]
    H[修改核查视图] --> DF[既有 lineDiff]
  end
  C --> CO[共同 composer]
  CO --> A[session.send 和 harness]
  A --> R[ResourceAccess]
  R --> P[projects 条件保存与历史]
  R --> L[library 读取与阅读记录]
  E[editor 只读render产物及生产依据] --> R
  E --> RV[RenderPane 真实PdfReader]
  RV --> S
  P --> H
  L --> H
  M1[本批库正文只读 阅读记录独立] --> L
  M2[projects files.changes/edit/undo 真实来源与依据] --> H
```

## 方案与接口

### 本批M1范围与当前验收

主线在当前dispatch的“M1边界决定及真实验收要求”明确选择本批只读。正式workbench-resources规定无正文保存能力时只读，ResourceAccess对library描述固定write=false、readingRecords=true，save拒绝非project来源；library.commitRecords是题录字段提交，不是正文修订。保留原ref/materialVersionId/basis、库记录修订与read/write/send授权，不创建第二正文或自动复制项目替代。未来正文修订仍需文献／生态提供实际提交、旧版本保留、冲突／撤权及unknown查询契约，不能用私有摄取函数或阅读记录代替。

复用既有resource-access及真实PDF／EPUB／HTML阅读场景，核对库write授权不扩大正文能力、修订请求明确被拒、原材料和当前工作域文件不变、记录保存及关闭重开／失效／撤权。真实material-delegation-history在既有父子worker、父读改、人工重叠拒绝与整次undo之后补原会话get_file_changes/read_file_edit/read_file读回，不改FileEdit权威或精确token范围。仅补关键缺失断言，不新增生产接口或重复测试框架。

HTML图片分页的真实反例表明，用户点选的末图会排在同组其他图片之后等待串行读取。DocumentReader保留单个在途读取、每页最多8图和单资源1MiB上限，只在内部队列将明确点选的图片放到尚未开始的读取之前；不打断在途请求，不取消其他视图，不绕过原可见性／授权／版本核对。视图内目标随章节／版本切换清除，不新增跨端字段。原HTML双宿主场景保护这一用户可观察行为，不断言私有排队顺序或增加期限。

### 复用与模块深度

不新增 package、进程、上下文仓储或第二个 composer。真实变化有两个 adapter：PDF／规范化文档的 SDK 选择，以及源码／可视编辑的编辑器选择；共同 seam 仍是 `ContextContribution`。把格式坐标转换、清理和容量检查留在视图内，调用方只接收 schema 派生 ContextItem。持久批注仍由原 ReadingRecordPort 保存。

Markdown公式从同一TeX annotation生成一次摘录，表格语义沿同一规则。无法表达部分公式时拒绝整次选择并提示重新选择完整公式，不发送省略公式后的正文前缀；原生文字选择失效时清除实时贡献，显式对象选择独立保留。

图片读取通过已有 ResourcePort 分片，新增格式 image 和共同 ImageResourceView，首批仅 PNG/JPEG/GIF/WebP，拒绝 SVG／HTML 可执行内容；保留既有字节限额，不新增解码依赖。使用浏览器图片解码，限制文件最多8MiB、解码面积不超过1600万像素，超限明确失败。框选在图像内容坐标内归一化，旋转先反算坐标；键盘提供区域位置／尺寸编辑，不能只有拖拽。

### 提供与消费字段

| 接口／字段 | 语义与唯一事实源 | 所有者 |
| --- | --- | --- |
| `ContextItem` 既有公共及 kind 字段 | 原 `workbench-context-contracts.ts`，保留16项／64KiB等限制 | 本线维护增量，harness消费 |
| 拟增 `text.location?` | PDF 复用 pdfLocationSchema；规范化文档复用 textLocationSchema；源码只需 quote，不另设持续段落ID | 本线贡献；引用 library 位置声明，不复制schema |
| 拟增 `region.target` | 判别整图、PDF页、已加载结构图片对象；页提供pageIndex及未旋转页面尺寸，对象提供providerId/objectId；矩形仍归一化到该目标内容框 | 本线；通用原 region 样本必须显式声明目标，不能默认解释为某页 |
| `object.contentState?` | saved／draft，实际可视转换未完成或父文稿尚未保存时标记draft；对象身份只指当次结构 | 本线，沿原ContextItem持久化和模型编码 |
| `contributeSelection(viewId,{selections})` | 仅实时线索；卸载调用同方法移除。资源打开和选择不切接收者 | 既有工作台 |
| `appendContextItem(item)`／`comment` | 明确附加，批注在共同检查器中修改；不自行调用session.send | 既有工作台 |
| `ResourceRef/basis` | 项目fileId／库材料版本和实际读取依据；产物不能使用当前源码basis冒充 | projects／library／editor提供，本线消费 |
| `ResourcePort`／`ReadingRecordPort` | 原读取、条件保存、记录修订、可信作者和未知结果核查 | 所属领域 |
| `FileEdit`／`files.history/undo` | 实际before/after、editId及现有冲突保护，不另存历史副本 | projects |
| 修改来源及依据 | 当前FileEdit／changes的origin、beforeEvidence/afterEvidence及revertsEditId；指令集合不等于单次因果，缺失字段不补 | projects提供，阅读消费；细分委派后续联合 |

region 目标字段影响既有固定 provider、检查器、SDK编码及持久指令；变更时必须同步所有当前 region 构造者与消费者。历史无目标 region 保持可读且明确基准未知，不猜页号；不把其作为新格式选择输出。与另一报告 change 的对象项保持独立，其 object 不需要本次位置增量。

完整排版选择使用独立render ResourceRef，不能直接附源码ref加产物quote。嵌入RenderPane与共同打开均复用真实PdfReader；显式导出仍保留。缺少生产依据的旧产物保持原RenderedPdf预览／导出，明确禁用直接附加；不以当前稿件补证据。公共产物依据与只读范围见末节M3。

### 交互和保存

```mermaid
sequenceDiagram
  participant U as 用户
  participant V as 真实资源视图
  participant C as 共同输入框
  participant H as harness
  participant P as 资源所属提供者
  U->>V: 选择并附加批注
  V->>C: 原ref/basis及选择载荷
  U->>C: 检查文字与批注后发送
  C->>H: 原instructionId与完整contextItems
  H->>P: 重新核对权限和当前材料
  alt 可写且依据有效
    H->>P: 原条件保存
    P-->>H: 实际保存与关联结果
    P-->>V: 当前范围变化
    V-->>U: 原草稿保留并提供实际修改核查
  else 库只读或依据变化
    P-->>H: 明确拒绝与核查线索
    H-->>C: 原操作失败或待输入
  end
```

已附加选区是快照；旧版本还可读时打开原版，可核对页码才导航。原版缺失显示原摘录／说明及缺失原因，新版不能借旧位置导航。撤权隐藏受保护缓存，读取和模型外发仍由原领域核查。

差异优先复用lineDiff与实际FileEdit；大于400行使用两份有依据全文对照。整次撤销复用files.undo，失败不覆盖后续编辑；当前M2展示已记录的可信粗粒度身份，不声称科研理由、细分工具因果或“意见已解决”。没有公开候选DTO时只保留原差异与拒绝原因，不伪称候选已保存。

### UI 设计落点

沿 `docs/ui-design/README.md` 的“当前选择与显式附加”“PDF阅读与共同记录”“科研写作编辑器”更新对应分节：选区旁只有附加／批注入口，仍由共同composer检查发送；差异在资源tab内展开，状态贴近对象。PDF附加与原记录操作共用工具行，避免挤压阅读空间。保留三区、dock／overlay和既有可访问名。样式只引用现有语义token。

## 文件变化

以下为本change写入所有权清单，实际已实现／受阻范围由tasks及delivery核对。无计划删除业务文件。

| 文件／符号 | 变化／所有权 |
| --- | --- |
| protocol/workbench-context-contracts.ts、workbench-context.ts | text位置与region目标的同源声明及几何容量校验；不改可靠发送语义 |
| protocol/resources.ts、editor/resource-access.ts | image分类与有界读取能力；正文写入仍只沿已声明能力，不实现库修订 |
| workbench/ResourceView.tsx | 传viewId给reader，接ImageResourceView；报告change只占独立report分派符号 |
| workbench/PdfReader.tsx、DocumentReader.tsx | 原SDK／规范化选区贡献、清理及明确附加；不改库记录身份 |
| workbench/editor/VisualEditor.tsx、project-ui.tsx及MarkdownPreview所在文件 | 基于已有编辑结构／当前预览贡献；不跨DOM读取；源码行为复用 |
| 新workbench/ImageResourceView.tsx | 真实图片展示、受控区域选择和Blob释放 |
| 新workbench/MaterialChangeView.tsx、既有line-diff.ts调用方 | 差异呈现与所属历史／撤销适配，不增加历史权威 |
| editor/RenderPane.tsx、PdfReader.RenderedPdf | 产物证据和选区适配待明确；先承接CI诊断，保持最后成功预览 |
| kernel/manual.ts、harness/instruction-context.ts及SDK编码 | 前阶段位置增量；本轮提供者已在共同基线，不修改这些符号 |
| tests/kernel/context-contributions.spec.ts、context-instructions.spec.ts、resource-access.spec.ts | 扩展真实格式适配、保存依据及位置序列化的稳定边界 |
| tests/ui/pdf-reading.spec.ts、document-reading.spec.ts、context-bridge.spec.ts、resource-lifecycle.spec.ts、writing-editor-pdf.spec.ts | 真实选择／共同发送／撤权／重开及必要失败诊断；仅缺乏图片链路时新增该场景 |
| docs/ui-design/README.md、docs/development.md | 上述设计分节和实际运行／诊断入口；修正UI文档中“共同资源接口仍待实施”的旧描述，不改无关文献方案 |

完整路径分别以 `packages/`、`apps/desktop/src/renderer/src/`、`apps/kernel/src/`为根。共享文件只改表中符号；文献表格、任务详情、library版本创建与projects保存实现不属于本线可单方修改范围。

## 验证与风险

- 首批独立选择模块：真实PDF SDK、DocumentReader、CodeMirror／可视结构、图片，资源端口可用明确替身；核对本线纯选择输出、目标基准和关闭释放，不能据此声称生产保存通过。
- 最小内核组合复用 context-contributions、context-instructions、resource-access、resource-identity；M2闭合后加真实编辑历史／撤销及相应变化线索，不重测所有公共生命周期。
- I5由本线主Agent负责，真实工作台→composer→harness worker→项目条件保存→重读差异；库使用真实只读材料和已有阅读记录，正文写回等待M1。模型用`tests/model-server.ts`受控HTTP，不能替代内部保存权威。
- 双宿主复用既有UI config，覆盖草稿、迟到更新／回执、撤权、版本失效和关闭一个分屏。现有 PDF 失败先按 investigation 分段诊断，保持最后成功产物。
- 已获锁定依赖及隔离UI验证授权。直接使用已安装CLI：`node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts <上述相关spec>`；UI同CLI用`playwright.ui.config.ts`，使用`SCHOOLOOM_UI_PORT=5641`，配置／库／项目／输出由既有fixture隔离。启动前检查占用，结束按fixture收尾；实际命令与证据见delivery。
- 协议改动后运行已有契约生成／自检、受影响类型及架构守卫，并核对desktop构建、OpenSpec和diff。依赖始终沿原锁文件，不运行日常开发服务。

## 待办边界

第九轮内容选择反例来自Checks40447074031的Linux日志：ProseMirror image事务已触发，但visualAction只等待page.evaluate返回，随后可能读取React上次提交的表格输出。VisualEditor在事务订阅内同步选择实际image并调用onSelection，不需要为夹具强制flush产品。测试夹具为每次真实onSelection绑定递增revision及同次value，visualAction等待该revision被DOM提交；不猜文案或sleep。除对象名称语义外核对与表格不同identity、实际src／caption／id和ProseMirror选中位置。写集仅content-selection.spec.ts，保留原生产组件；实跑结果与平台边界记delivery。

M1仍缺文献材料提交，不在本线选择覆盖旧字节。M2真实来源及委派提供者已在共同基线，本轮消费；逐工具／单次指令因果未证明部分继续未知。M3既有验收保留，报告独立change沿自身tasks推进。跨版本持续精确定位、图像语义推断、完整科研意见状态机、Mac受管执行和三平台发布不在本change范围。

## 主线第二阶段交接与公共增量

2026-10-26实施更新：主线已采纳下述M3方案B，并完成e71663b同步（0519904为祖先）。本轮新增`source:render/projectId/outputId`只读资源。产物在发布后记录自己的文件basis及生产输入`{ref,basis,dependencies}`；旧记录缺证据不猜。`RenderOutput`可选basis/input保留旧预览可读，新的render资源必须具备证据。`ResourceDescriptor.render`提供jobId和input，最后成功产物沿自己的outputId/jobId读取。内部`ResourcePorts.render`由同属editor的runtime提供，宿主只装配，不新增存储权威或公开写入口；harness增加共同文档读取工具，字节和解析均沿ResourceAccess及原授权。首批只同项目PDF，不扩大跨项目产物权限。同步／历史提供者实际证据与本轮新增验证分别记录。

本节消费用户正式转交的`/tmp/scholoom-phase2-handoff-VZS5mS/`，清单以该目录`manifest.json`为准，各树来源基线均为`e3d58fc807827a78493dcd16e38de28c8d02766e`。只读快照不等于代码进入本树或dev。主线验收`acceptance.md`的U1是本轮修复输入，`coordination-plan.md`“独立实施之后的公共对接阶段”规定先独立补充、dev接入验证、再由用户同步消费者。

### 提供给六线的接口交接

材料设计为本文件，报告设计独立保存在`../add-interactive-research-reports/design.md`；对应正式交接快照分别位于包内`research-interaction/openspec/changes/<change>/design.md`。本次授权已完成设计交接，不再等待用户逐线转述；接收方实现和dev整合仍分别验收。

| 提供文件／符号 | 消费与字段语义 |
| --- | --- |
| `packages/protocol/src/workbench-context-contracts.ts::contextItemSchema` | `text.location?`沿既有PDF页矩形或文档规范化UTF-16位置，绑定同一`ref/basis`；不表示跨版本定位。文献／项目／生态贡献实际对象，科研／Agent消费完整显式项 |
| 同文件`region.target?` | `image`指整幅图内容框；`pdf`声明页及原页面宽高；`object`声明providerId/objectId。region始终为对应目标的归一化矩形；旧无target记录基准未知。计算输出图片沿实际项目资源打开，不新增另一种ref |
| 同文件`object.contentState?`及既有`text.contentState` | 草稿对象／摘录不代表保存；旧object缺字段仍可读。任务详情与文献表格由所属域维护，只消费共同贡献端口，不跨DOM取数据 |
| `workbench-context.ts::isContextItems`、`harness/instruction-context.ts::contextItemContent` | 派生校验、容量、位置编码为同一事实源；SDK和持久消息保留载荷。所有实际读取／外发仍走所属授权，页面不能赋予权限 |
| 报告设计中的manifest／`ReportResources`／页面桥 | schema／codec及注入模块已进入共同基线并经主线修复；生产API／HTML写／页面隔离未接通，另阶段推进 |

### 资源叶模块与图片补丁顺序

已消费项目快照`research-task-workspace/packages/protocol/src/resource-contracts.ts`、`resources.ts`及`openspec/changes/establish-file-backed-research-tasks/{design,delivery}.md`。其叶模块只导入core／schema，集中原ResourceRef／Evidence／Locator／Descriptor／保存创建schema，原`resources.ts`重导出；图片尚在unsupported。该快照还含任务业务聚合，不能整文件覆盖本树。

1. 项目线先交不依赖`task-contracts.ts`或任务业务的叶模块抽取；由主线核对原字段／行为不变及原入口重导出，独立接入dev。
2. 阅读线的`/tmp/scholoom-reading-public-CUURdN/image-after-resource-leaf.patch`仅改叶模块的image枚举和原`resources.ts::resourceFormatForName`判断，不定义第二套ResourceRef，不覆盖项目／任务schema。此补丁已在只含项目快照两文件的临时目录通过`git apply --check`，未宣称在dev构建。
3. `/tmp/scholoom-reading-public-CUURdN/material-context-evidence.patch`为位置／region目标／对象草稿同源声明、派生校验、模型编码及原契约测试的5文件增量；对e3d58fc临时基线通过apply检查。它与叶抽取可独立排序，若先抽取则继续从原resources重导出消费，不改身份。最终映射从合并后的schema重生，不能拼接生成文件。
4. 主线接入上述增量并验证后，用户同步消费者；各域只调整自己拥有的构造者和消费点。真实图片视图、阅读器、composer检查器仍随材料change交付，不能据协议补丁可应用就称I5已接通。

### M2：实际可用范围（共同基线）

第六轮4b13183已提供实际委派origin。MaterialChangeView原有字段分支可直接显示delegationId、parentRunId和parentInstanceId，无需改写提供者或UI。写集限于`tests/kernel/execution-facts.spec.ts`和`tests/ui/material-delegation-history.spec.ts`：外部模型受控，真实子worker创建报告后父worker先读取再编辑同一fileId，核对父beforeEvidence与子afterEvidence，以及UI真实来源、人工重叠拒绝及整次撤销。既有普通执行／负责Agent查询变化场景保留。Windows夹具另只改`content-selection.spec.ts`生成JS的import字面量，使用JSON编码保留反斜线；Linux通过不表示Windows目标通过。首轮失败与复验逐项记delivery，不扩M1或整个I5。

本节替代第二阶段“缺FileEdit提供者”的等待状态；历史需求另见下段。输入为本树`protocol/project-file-contracts.ts`与`projects/store.ts`、`harness/file-change-tools.ts`及主线`/tmp/scholoom-round5-acceptance-WBreMJ/{acceptance.md,synchronized.json}`。所有七域源码已在当前树，不应用旧累计补丁、不取他树私有实现。

`files.changes({projectId,fileId,limit:10,cursor?})`只读摘要；续页原样传回cursor，替换当前页，不扫描所有页。coverage.anchor／retention／current分别表达锚点、历史是否裁剪及当前字节是否匹配最新记录，unknown不当作完整、缺口不当作零变化。仅明确选定editId时调用`files.edit({projectId,fileId,editId})`读取全文；不从时间或路径选择“对应修改”。beforeEvidence／afterEvidence为实际资源依据，`FileEdit.basis`为撤销校验依据，缺失不能互相补齐。

origin由宿主绑定：human／system仅显示真实principal与module，execution额外显示sessionId/runId/instanceId、实际记录的instructionContext和delegation。observed指令集合不表示逐修改因果，tool当前只有unknown；没有字段不猜科研理由／作者或伪造委派来源。执行资源回执可选editId与association独立，公共人工resources.save仍只回ResourceDescriptor；UI不从该回执猜editId，而沿摘要中的真实editId选择。

写集限`MaterialChangeView.tsx`（新增其中MaterialHistory及来源／依据展示）、`project-ui.tsx`的历史入口／草稿与撤销后刷新、对应UI设计和必要测试。component key按projectId/fileId隔离；请求有迟到响应守卫，每次仅保留当前10条摘要和一个选中正文，权限失效隐藏保护内容。历史查询不要求正文可写，undo仅在原可写能力、无未保存草稿及无在途动作时由用户明确触发。

历史区域不超过文件视图一半高度并独立滚动，避免挤压覆盖编辑区。面板关闭或临时断线／失去读取资格只隐藏并清除读取的页／正文，不卸载同一绑定fileId的实例，文件视图内的未知撤销身份保留；重开重新读取权限。撤销中暂不能关闭历史，防同步重入；断线期间保留在途undo身份，回执unknown仍进入保护列表，重连不重放。结果未知不自动重试。撤销后的reload沿非强制路径，保护等待期间继续输入的草稿。

撤销沿原`files.undo`，成功显示实际新FileEdit与revertsEditId并重读当前文件；冲突不重试、不清草稿，不将原差异冒充已保存候选。当前公开接口没有候选DTO或候选查询，保留可核查的原before/after与错误，磁盘以真实提供者为准。outcomeUnknown单列核查，不据失败推断无效果。撤销不调用session.send；负责Agent只在用户明确新指令后用现有get_file_changes／read_file_edit核查新记录。

验证先shared／desktop build，再真实Manual／Kernel既有file-edit-origins相关场景及双宿主从人工保存、阅读批注／普通执行修改、历史选择、人工重叠、旧撤销拒绝、正确整次撤销到负责session查询的固定路径。只替换外部模型，broker／SQLite／worker／文件真实；注册项目位于结果目录且保留到隔离配置退役。静态承载使用`/tmp/scholoom-sync-recovery-wyn13R/static-ui.mjs`，不启开发服务。覆盖分页／迟到响应／旧记录的组件夹具只证明消费边界，不冒充生产权限。

M1正文写回与报告生产／隔离保持后续边界；真实委派粗粒度联合按本轮验收，精确指令／工具因果不扩展。TeX退出诊断交计算线，不重跑无目标实验。

#### 第二阶段历史需求（不再作为同步门）

项目快照design“来源取用与跨线Interface”提供CallContext和任务入口材料，不含FileEdit归因DTO；其delivery所称“关联字段草稿”指任务关联表单，不等于修改归因候选已发布。包内`research-task-workspace/packages/protocol/src/projects.ts`仍从原`project-file-contracts.ts`派生FileEdit。本树`protocol/core.ts::CallContext`只有可信principal、projectId、sessionId、runId、instanceId等，没有instructionId／toolCallId；`harness/runtime.ts`一次推进可消费多个instructionIds，不能任选一个归因。

本线向项目／Agent交接以下**待提供者确认的需求**，不在本轮发布新字段：

- FileEdit以editId＋fileId＋实际before/after及basis为根；可信执行者从宿主CallContext随保存进入项目实际记录，不能接受renderer或模型自报作者。候选与真正发布分别返回。
- 若保存确有Agent执行，保留实际sessionId／runId／instanceId；对应指令若非唯一则给出有依据的instructionIds集合或明确关联不可得。toolCallId只有harness真实绑定并贯穿保存时才能展示，缺失不猜。
- 理由／依据应为可查询的原指令或工具记录引用，不自动将相邻消息当作原因。对历史无来源记录保持未知。
- 撤销结果需提供原editId、实际新修改或冲突候选、当前basis和可分页查询的变化线索；Agent读取／确认消费的权威由Agent线确定。撤销不自动运行Agent，界面通知不等于消费。

最小联合验证为人工与Agent各一项保存、同路径并发两run、一次推进多指令、候选未发布、撤销和后续重叠编辑、重启查询；必须核对实际记录，不能只测试UI显示。现阶段MaterialChangeView继续显示执行者／理由未知，4.2／4.5保持开放。

### M3：已采纳并实施的只读产物资源

原调查时RenderOutput只有id/jobId/name/format/byteLength，RenderJob保留fileId、basis、dependencies及output／lastSuccess。现实现新增可选basis/input，`editor/runtime.ts::execute`在输出发布后记录文件指纹与实际快照输入，原`saved/output/export`继续按outputId读取缓存。`RenderPane`以`job.output ?? job.lastSuccess`的outputId打开产物。**失败新job的basis不能解释旧lastSuccess**，旧产物沿自己的jobId及保存输入核查。缓存会淘汰，outputId不是永久存档承诺。

| 选项 | 依据、成本与限制 |
| --- | --- |
| A 显式导出项目文件再打开 | 复用editor.export／原文件传输与project ResourceRef，不需新ref；导出文件的字节版本即选择依据。当前已有真实双宿主预览／导出证据。需要项目写权限和用户动作，不能完成嵌入预览直接附加，也不能凭导出名称宣称输入溯源 |
| B 只读产物资源（主线已采纳） | 新增判别`source:render`、projectId、outputId的ResourceRef／Locator；产物basis为编辑器保存的输出文件指纹，绝不使用源码basis。editor提供生产job的输入依据及依赖快照；共同资源与harness分派、实际字节／解析及嵌入页附加已随本线验证，公共增量独立交补丁 |
| C 仅给ContextItem加outputId，仍附源码ref | 拒绝：资源重新读取、位置和版本会落到稿件，绕过共同资源身份事实源 |

B的实施范围为排版PDF、同项目只读，不新增产物写入／持久历史／跨项目取材能力。editor runtime通过`resource/readResource`提供描述与字节，`ResourcePorts.render`注入共同ResourceAccess；PDF解析继续由既有parser执行，生产由宿主装配，不调用harness私有仓储。`RenderOutput.input`由`renderInputSchema`定义输入project ref＋basis及`dependencies[{path,basis}]`，`ResourceDescriptor.render`返回jobId与input；依赖路径不冒充稳定资源身份，不承诺自动追溯手工粘贴的库来源。outputId的生产记录、产物文件和输入依据须匹配；旧记录缺证据时保持原预览／导出，直接附加明确不可用，不取当前稿件补证据。

人工读取沿项目read；Agent实际取用和模型前仍要求相符工作域／项目信任及有效执行，不能凭浏览器已加载或旧缓存绕过撤权。产物分片沿原256KiB和现有容量；读取前后核对产物身份／依据，淘汰或生产记录缺失返回明确notFound／不可核查，不借最新同名输出回退。旧页显式项保留原outputId及原摘录。产物只读，阅读记录和库修订不随此方案获得权限。

公共改动拥有者及审查集：本线`protocol/resource-contracts.ts`（在项目抽取接入之后扩展ref）、`resources.ts`的派生端口、`protocol/editor.ts`产物依据schema、`editor/runtime.ts`不可变依据保存及适配、`editor/resource-access.ts`分派；宿主仅装配该窄端口。随后分别适配context／harness的资源分派和RenderPane／RenderedPdf选择。须先列全所有project/library穷尽分支并由项目／Agent核对，不能只给协议加枚举而遗漏授权消费。

验收复用`editor-runtime`的替换／淘汰／缓存／权限测试，真实原生LaTeX验证成功V1及改稿失败V2仍沿V1生产依据；真实KernelApplication验证harness读字节、页解析、只读、跨项目／targetRead拒绝和撤权。两宿主以真实Quarto PDF、SDK选择、共同composer、worker字节／页读取和历史打开／刷新验证生产接线；旧记录用例仅在协议投影删除可选依据，未伪造PDF或提供者。实际命令、首次失败和补丁拆分见delivery第三阶段。4.6完成，不据此关闭M1／M2或完整I5。
