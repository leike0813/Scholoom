# 通过原型选择 Zotero 原插件的兼容宿主

Labels: wayfinder:prototype
Type: prototype
Mode: HITL
Status: resolved
Assignee: 本会话 Codex；与用户共同验证及选择宿主路线（2026-10-04）
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 05

## Question

用户于 2026-10-04 澄清：本票讨论通用 Zotero 插件兼容层的实现可能性，可以仅面向一个大版本（例如 Zotero 10）。BBT 与茉莉花是代表性验证样本；实现目标不收窄为两个插件的专项适配。

在指定版本的 Better BibTeX 和茉莉花原包及代码不修改的前提下，Electron/Node 兼容层与 Gecko 辅助宿主分别能以多大代价承接代表性功能？Scholoom 应选择什么具体宿主路线，才能满足兼容目标、科研内核的独立性和后续维护要求？

以[兼容策略](05-zotero-compatibility-policy.md)为前提，读取已完成的[插件宿主调查](../research/zotero-plugin-host.md)和 [translators 与 Connector 调查](../research/zotero-ingest.md)。先确定原型所使用的明确宿主 API 基线和插件发布版本，保持原包不变，使用临时测试材料。

制作低成本原型验证代表性路径：BBT 的引用键与导出；茉莉花的元数据处理与阅读器大纲或书签集成。区分实际装载的原包行为、仅验证的局部能力和仍未验证的路径。原型不承担完整产品实现或所有插件功能验收。

比较加载与生命周期、数据与文件语义、GUI 依赖、Agent 调用及工作台接入、跨平台分发和维护边界。列出必须提供的接口、实际成功的行为、失败原因和尚缺的证据，链接原型工件，由用户参与选择宿主路线。

数据与文件原型遵循已确认的[存储与变更模型](13-storage-and-change-model.md)：满足原包所见的 SQL／对象契约并保持明确的文献权威，插件专属状态按职责保存；区分托管附件、外部链接、项目引用文件与库题录。验证适配行为，不将全部插件副作用包装成通用跨资源事务或审计流程。

如证据仍不足以选择路线，明确下一项需要调查或验证的问题，不把缺少验证记成兼容成功或不可行。具体原型方案在本票开展时制定，依赖与环境操作遵守用户的授权规则。

## Answer

2026-10-04 用户确认选择 Node＋Chromium，认为它最自然地融入 Electron；从固定 Zotero 10 基线开始，不承诺无缝兼容所有插件，开发时先选一批重要插件推动适配。原型阶段结束，本票解决。以下为正式选择与工程承接范围。

### 能否接入

**采用 Node＋Chromium 建设面向 Zotero 10 的通用插件兼容层。** 相同契约由共享实现供不同插件使用；开发时以重要插件的实际需求推动接口覆盖与验收。首批保留 Better BibTeX 和茉莉花，其他插件在开发时选定。仅使用已实现契约的新插件应能复用兼容能力；新增依赖通过宿主适配补齐，并将可复用行为纳入共享实现。

初始固定基线采用已有原型核对的 Zotero 10.0.5 源码与接口行为。支持其他 10.x 版本时核对差异再扩大覆盖。插件清单是开发优先次序和支持记录，不把通用层限定为两个插件的专项执行器；发布承诺限定到经过验收的插件版本和功能，不承诺全部 Zotero 10 插件无缝运行。

BBT 9.0.68 原包已在独立宿主中生成／保留引用键、实际导出 BibTeX，并响应题录变更更新缓存。茉莉花 1.1.39 原包已完成 Chromium DOM 初始化、作者处理，以及合成网络输入下的原搜索、建项回退和 PDF 关联。两者实际读写同一 SQLite，没有启动完整 Zotero。见[独立宿主报告](../research/zotero-host-minimal-results.md)、[变更报告](../research/zotero-host-mutation-results.md)、[原生 DOM 报告](../research/zotero-host-native-dom-results.md)和[元数据任务报告](../research/zotero-host-metadata-results.md)。

已有实验回答了“部分原包业务能否在我们的数据和运行环境中执行”。它们是通用层的局部可行性证据；完整宿主契约及平台覆盖需要单独判断，不能由两个样本通过推导所有插件可用。真实联网、Reader 和发布环境等缺口交给正式实现验收，原型不继续扩展。

### 接入边界

```text
Scholoom 工作台／Agent
        ↕ 共同领域服务与功能调用
Scholoom 文献权威与文件管理
        ↕ Zotero 对象、SQL、通知及服务适配
Zotero 10 插件原包（首批 BBT／茉莉花）
        ↕
Node 执行环境＋内部 Chromium DOM／Worker／IndexedDB
```

科研内核继续拥有自己的领域模型和接口。插件所见的 Zotero 身份与对象映射到同一文献事实；插件缓存和专属状态按职责保存。界面与 Agent 调用同一功能入口，插件结果由 Scholoom 呈现。

Node 承接兼容层服务与适合的插件脚本，Chromium 提供 DOM、Worker 和 IndexedDB。原型中的 BBT 主包在 Node，茉莉花主包和 BBT Worker 在 Chromium；这提供运行能力划分的参考，不把样本的进程部署直接固定为生产架构。内部页面、辅助进程及工作台之间的部署由 [#09 架构](09-electron-architecture.md)落实，独立宿主的 Electron 封装进入工程验收。

### 需要提供的兼容层

下表是职责划分，无需为了表格建立六个独立框架。

| 职责 | 必须承接的契约 | 已有依据及实现边界 |
| --- | --- | --- |
| 原包装载与运行环境 | XPI 资源解析、bootstrap／主包加载、异步初始化、偏好和插件状态；按需提供 Services／ChromeUtils 等调用 | 原包已实际装载；生产隔离、完整生命周期及已消费服务仍需实现。占位注册不能当作服务兼容 |
| 数据与身份 | Zotero.Item／Items、字段／作者／标签／关系、ID／key 映射、save／saveTx；原包读取的 SQL 表与查询 | 对象保存和只读 SQL 投影已通过。生产映射以共同领域服务为准；SQL 写入若被承诺功能使用，需落实同一权威与事务语义 |
| 变更与缓存 | 已提交数据的 add／modify 等通知、原监听器与插件缓存更新 | 通知缺失确实导致陈旧导出；事件种类、事务边界和批量处理按实际功能实现 |
| DOM 与后台执行 | 原生 DOM、Worker／消息、IndexedDB，以及原包消费的模块／资源接口 | Chromium 已承接 Prompt 和原 BBT Worker；无需从头手写浏览器平台。Gecko 专属接口依实际使用适配 |
| 文件、网络与翻译 | 附件路径／父子关系、托管或链接文件、HTTP、translator 注册与执行、必要工具／样式资源 | 已有 PDF 关联、文件路径导出和窄 RIS 导入；下载、真实 HTTP、其他 translators／CSL 等进入功能实现验收 |
| 功能、界面与阅读器接入 | 把原功能连接到共同调用入口、配置和结果；必要时承接原包依赖的 Reader／事件／DOM 契约 | 自有界面呈现已获允许；独立 Reader 尚未通过。重新呈现界面不会自动消除原包的 Reader 依赖 |

兼容层以 Zotero 10 的接口、对象行为和宿主环境为实现依据，由 Scholoom 维护；[#05 的插件与功能矩阵](05-zotero-compatibility-policy.md)用于验收代表性样本。一个大版本仍应指定可核对的源码基线，并记录所覆盖的小版本；不能只声明 version 为 10 就认为契约一致。

官方[插件开发说明](https://www.zotero.org/support/dev/client_coding/plugin_development)明确插件访问内部 JavaScript API 与 Firefox API；[10.0.5 加载器](https://raw.githubusercontent.com/zotero/zotero/10.0.5/chrome/content/zotero/xpcom/plugins.js)将共享 Zotero 对象、Services、ChromeWorker、IOUtils 等注入插件作用域。因此通用层还需考虑共享对象身份、可修改原型、同步属性和异步方法等可观察语义，不能把全部对象换成 JSON RPC 后就视为兼容。[Zotero 10 开发文档](https://www.zotero.org/support/dev/zotero_10_for_developers)也列出内部接口、存储、Cookie 和本地化变更。

优先评估复用 Zotero 10 的通用逻辑、翻译／工具／数据模块及 Schema，在宿主依赖处适配到我们的领域服务与平台。SQL 应提供一致的 Schema／事务语义，避免按插件硬编码查询；数据库结构复用不等于让 Zotero 拥有科研内核，也不意味着另存一套当前题录。UI 注册接口可统一映射到 Scholoom，但直接修改原窗口 DOM 或 Reader 内部对象的插件需要更接近原环境的实现。

### 取舍与原型停止点

选择 Node＋Chromium 的依据是与 Electron 的运行环境自然衔接，且原型已让两个插件的代表性业务在独立文献权威上运行。Gecko 模块复用曾是候选，原环境语义的复用价值与额外运行时／耦合成本属于比较依据；本次不选择 Gecko 辅助宿主。完整 Zotero 实验保留为参考事实。

通用实现按固定版本的宿主模块建设，优先复用适合 Node／Chromium 的成熟实现。重要插件的适配可以分阶段补充平台、窗口和 Reader 契约；未实现依赖与不支持功能如实记录，不能用占位服务或仅装载成功作兼容承诺。原窗口、XUL、XPCOM 和 Reader 的适配成本是该路线需要承担的工程工作，已有样本通过不表示这些问题全部解决。

保留 [#05](05-zotero-compatibility-policy.md) 的功能目标，区分目标与已验收事实。自动导出、pull export／JSON-RPC、真实中文在线识别、附件匹配／下载、CSL、独立 PDF 大纲／书签，以及 Connector 接入等，均归后续实现与发布验收。它们不继续阻塞本原型的收敛，也不能提前写成兼容成功。原元数据任务的 RIS ID 差异继续如实记录，不以回退成功替代导入分支验收。

原型代码和各轮证据保留为实现参考，无需直接升级为生产架构。正式数据库产品、Schema 和进程部署由相关架构／技术栈票确定。兼容适配仍遵循 [#05](05-zotero-compatibility-policy.md) 的原包不修改约定。当前完成宿主选型，不启动实现、迁移、安装依赖或提交代码。

## Prototype plan

原型实验已于 2026-10-04 按用户要求结束，正式选择见上文 Answer。[验证范围与证据索引](../research/zotero-host-goal-validation-plan.md)保留已执行事实；尚未覆盖的功能交由正式实现验收，不继续扩大本原型。以下为已完成的参考宿主实验方案。

2026-10-04 已领取；用户确认使用最新稳定 Zotero 10.0.5，并回复“同意，开始制作原型吧”。以下方案已实施，实跑结果见文末。

### 固定基线

- Linux x86_64；固定本次核对的最新稳定版 Zotero `10.0.5`。来源为[官方版本历史](https://www.zotero.org/support/changelog)及官方精确版本归档 `https://download.zotero.org/client/release/10.0.5/Zotero-10.0.5_linux-x86_64.tar.xz`；下载到临时目录后从 `application.ini` 与 `platform.ini` 记录实际 BuildID 和 Gecko 版本，解出独立临时安装树。
- Better BibTeX [`v9.0.68`](https://github.com/retorquere/zotero-better-bibtex/releases/tag/v9.0.68)，官方资产 `zotero-better-bibtex-9.0.68.xpi`。
- 茉莉花 [`v1.1.39`](https://github.com/l0o0/jasminum/releases/tag/v1.1.39)，官方资产 `jasminum_1.1.39.xpi`。
- 原 XPI 不修改、不重打包；临时伴随探针独立于插件。下载与解包只服务本票验证，不安装或变更项目依赖。

### 工件与运行方式

新增 `prototypes/zotero-host-prototype/`，包含单命令 Node 入口 `run.mjs`、原包 Node 加载探针 `node-probe.mjs`、独立伴随探针 `gecko-probe/`、固定题录/中文响应/PDF 样本 `fixtures/` 及 `README.md`。运行只使用已有 Node、归档工具、Xvfb 和共享 Python 环境中的 PDF 工具；不创建虚拟环境、不初始化业务应用、不启动开发服务器。

入口新建临时运行目录，包含宿主安装树、profile、data、原包与结果；关闭自动更新与同步，关闭默认 Connector 端口，使用 Xvfb 及 `-no-remote`，不读取日常 profile 或文献库。运行保存结构化结果、实际导出、书签/大纲文件及日志，并记录临时路径供复查；结束时退出本次启动的进程，不批量清理文件。

### 两条路径与验证边界

1. **Node 兼容层探针**：执行原 XPI 中未修改的 bootstrap 与可到达的启动代码，提供明确列出的最小宿主适配，记录实际遇到的 API、成功阶段与首个失败。未进入插件核心时不得宣称引用键、导出或元数据兼容；有限适配失败不能证明完整兼容层不可行。本轮没有 Electron 应用，Electron 扩展机制仅按官方文档说明，不标记为 Electron 实机验证。
2. **Gecko 参考宿主探针**：使用隔离的完整 Zotero 10.0.5，经其插件加载器运行两份原 XPI，再由独立伴随插件调用实际功能。BBT 验证引用键生成、已有键保留、BibTeX/BibLaTeX 导出；茉莉花验证固定中文响应回放下的可到达元数据路径、真实 PDF Reader 的大纲与书签集成。网络回放与真实服务单独标记；无法通过原包可调用入口到达的处理路径记为未验证，不以直接设置题录替代。
3. **数据与文件边界**：观察真实 Item/API 与 SQL 可见性、条目与附件父子关系、托管附件及外部链接路径、插件专属状态。临时库为唯一题录权威；项目引用文件作为独立样本。此结果不代表 Scholoom 原生数据库映射已实现。

当前版本源码显示茉莉花存在 `jasminum-outline.json` 与 `jasminum-bookmarks.json` 存储路径；书签 sidecar 与 PDF 字节修改分别核对，避免沿用既有调查中的宽泛概括。

### 交付与后续决定

新增 `research/zotero-host-prototype-results.md`，比较实际装载、功能结果、加载/退出、GUI 依赖、Agent 入口、数据权威、文件语义及分发维护成本；明确运行证据、源码推断和仍未验证的范围。修改本票链接工件和结果，在 `map.md` 添加原型进展与上下文入口。

完整 Zotero 参考宿主通过不等于 Scholoom 已实现可独立分发的 Gecko 辅助宿主。原型交付后已由用户选择 Node＋Chromium，见正式 Answer；以下各轮结果按当时范围保留，阶段性 claimed 和待选描述属于实验记录。

## Prototype results

- [运行说明与入口](../prototypes/zotero-host-prototype/README.md)、[结果与路线比较](../research/zotero-host-prototype-results.md)、[实际运行证据](../prototypes/zotero-host-prototype/evidence/2026-10-04/)。
- Zotero 10.0.5 实际加载未修改的 BBT 9.0.68 和茉莉花 1.1.39。BBT 引用键及 BibTeX／BibLaTeX 导出、真实 Reader 大纲、书签 sidecar 与重开显示通过；中文元数据为固定 CNKI HTTP／translator 返回回放，不是线上识别成功。
- 托管／链接附件和原生 SQL 可见性已观察；没有实现 Scholoom 数据映射。Node 有限适配分别停在 FileUtils 和 HiddenBrowser 服务，两包业务能力均未验证，也未进行 Electron 实机验证。
- 10 项窄检查通过、宿主退出码 0，但茉莉花 shutdown 有 `Cu.unload` 错误，Reader／数据库退出阶段也有错误。全局对象移除不能等同干净卸载。
- 尚待用户选择路线与文献权威边界。完整 Zotero 基线不证明裁剪／独立分发的辅助宿主可用；下一轮建议验证独立 Node IPC、同一文献权威的修改与导出，以及关闭／重接工作台后的能力运行。本票保持 claimed，未写正式 Answer。

### 第二轮：独立 IPC 与窗口生命周期

用户回复“同意，进行下一轮验证”，已按实验中唯一临时 Zotero 权威执行；不据此确定正式存储方案。见[第二轮报告](../research/zotero-host-ipc-results.md)与[原始证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-ipc/)。

8 项独立 Node 客户端检查通过：真实 IPC 修改／读回同一题录；实际关闭最后一个主窗口后仍可读写和 BBT 两种导出；重开主窗口与真实 Reader 后原书签恢复。使用 Gecko toolkit survival area 保活，不是隐藏窗口或无 GUI 启动。宿主退出后只读查询标题／引用键一致，SQLite 完整性 ok。

茉莉花原包 `hooks` 未导出 bootstrap 所调用的 onMainWindowUnload，真实关窗有错误；Reader／数据库退出阶段也有错误。原 XPI 未修改，不能据功能通过标记完整生命周期兼容。正式文献权威、Scholoom 身份／Schema 映射、独立宿主启动、工作台接入和跨平台分发仍未选择或验证；保持 claimed。

### 第三轮：无主窗口冷启动

用户回复“继续推进下一轮验证”，已完成新库与已初始化库的 headless 冷启动、早期 Xvfb 控制及第二轮回归。见[第三轮报告](../research/zotero-host-cold-start-results.md)与[实际证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-cold/)。

已初始化库在无显示服务器、本次进程从未打开主窗口、uiReady 未完成时，真实原生读写、已有引用键保留与两种 BBT 导出通过。10 项客户端检查通过、Reader 检查失败。新库只有 4 项通过，BBT ready 冷观察 60 秒未完成，开窗后再等 20 秒仍超时；后续导出和 Reader 未执行。新库的 translator 安装存在间接 UI 依赖；茉莉花已初始化库的无主窗启动在 toolkit 访问 DOM 时失败，开窗再启用只恢复全局对象，未恢复 Reader 控件。

冷启动入口在临时 omni.ja 增加两个 helper 成员，7492 个原成员逐字节不变，两份原 XPI 不变；仍是完整 Gecko／Zotero，不是裁剪宿主。第二轮回归 9 项前置和 8 项客户端检查通过，全部运行的落盘字段／SQLite 完整性核对通过。功能失败保留为失败，不据宿主退出 0 或对象恢复宣称兼容。

首次初始化／插件装载顺序、真实 Reader 初始 DOM 与生命周期存在证据缺口。正式文献权威、独立分发、Electron 接入及真实中文识别仍待决定或验证；本票保持 claimed，未写正式 Answer。

### 后续验证范围

用户指出第三轮过度聚焦 Zotero，并明确要求“接下来的验证请专注于我们的目标，别跑偏了”。后续按[目标验证方案](../research/zotero-host-goal-validation-plan.md)，优先观察 Scholoom 能力接口经候选适配调用原插件、双方读写同一文献事实，以及结果在工作台侧消费的链路；比较 Electron／Node 兼容服务与 Gecko 辅助宿主的实际边界和成本，不提前决定正式存储或架构。

科研内核不要求人类工作台先打开；这不自动禁止兼容环境内部所需的窗口或 DOM。内部依赖需要记录和比较。参考宿主的启动和 Reader 错误，只有阻断当前产品实验或影响路线选择时才继续调查，不能成为默认的后续验证目标。已有三轮证据保留，尚未执行的领域适配或工作台接入不记为成功。

### 第四轮：能力接口、同一文献与结果消费

用户回复“进行下一轮实验吧”，已按上述范围执行，见[第四轮报告](../research/zotero-host-boundary-results.md)及[原始证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-boundary/)。能力侧脚本和独立工作台侧客户端共用原型文献接口，以独立稳定身份映射到同一父题录及 PDF。能力侧改标题，BBT 原包实际重新生成并保存键，两端读取／导出；工作台侧再改标题，能力侧读回。原茉莉花的大纲、书签和页码转换为消费 DTO，并生成静态文献视图。

9 项主链路与 5 项第二客户端检查通过，停机字段及 SQLite 完整性核对通过；共享 RPC 修正中文 UTF-8 编码后，第二轮 8 项客户端回归通过。原 app/omni.ja 与两份 XPI 未改动，未追查第三轮启动问题。

本轮验证的是“兼容宿主维护库，Scholoom 经自己的接口使用”的实验候选，没有建立正式领域服务、实现原生数据库兼容视图或 Electron 阅读器。数据投影与静态呈现不等于完整阅读功能；正式文献权威、工作台呈现方式、分发及其他承诺功能仍待决定或验证。下一项围绕自己的工作台／阅读组件与插件能力的接入边界取证，本票保持 claimed，未写正式 Answer。

### 第五轮：自己的 PDF 阅读视图与书签写回

用户回复“继续下一轮实验”，已执行自己的浏览器阅读视图真实渲染／导航、书签改名与两端重读，见[第五轮报告](../research/zotero-host-reader-results.md)和[实际证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-reader/)。共同接口提供同一附件字节和原插件导航状态；点击大纲切到真实第二页，书签回到第一页。界面改名经原茉莉花编辑事件保存，整页刷新、能力侧读回及原 Reader 重开均一致；书签 id／位置及 PDF 字节不变。

5 项浏览器与 3 项主链路检查通过，9 项样本准备及停机核对通过；第四轮 9＋5 项共享接口回归通过。复用已有 PDF.js 与本机浏览器，不安装依赖、不启动开发服务器，原 app/omni.ja 和 XPI 不变。

本轮区分了呈现与写入：自己的页面可消费阅读状态，但这版茉莉花的书签保存仍绑定原 Reader DOM、活动 tab 和编辑事件，不能视为公开能力 API。退出错误保留，没有继续修复第三轮启动问题。正式组件、Electron 接入、独立分发、跨平台和存储候选仍待选择或验证；本票保持 claimed，未写 Answer。

### 第六轮：真实 Electron 接入与正常重启续用

用户回复“继续下一轮实验”，已执行[第六轮闭环](../research/zotero-host-restart-results.md)。能力侧在工作台接入前修改题录并导出，真实 Electron 页面经主进程共同接口渲染／导航 PDF、修改书签；关闭后能力侧续读。兼容宿主正常退出，再以新进程使用同一安装树／profile／库，读取原身份和保存状态，继续修改与导出；恢复不重建样本。

两阶段各 4 项主链路、6 项 Electron 页面检查通过，controller 的停机对象／父子关系／存储目录核对通过，落盘标题／键及 SQLite 完整性通过；普通浏览器回归通过。原包不变，复用本机 Electron 归档，无依赖安装。见[最终证据](../prototypes/zotero-host-prototype/evidence/2026-10-04-restart/final/)。

恢复书签写入需要维护侧栏打开状态，并在恢复 tab 缺少插件控件时正常关闭／重开一次原 Reader。内部原生库、Reader 和完整 Zotero 始终保留；本轮只证明外部接口、Electron 呈现和正常重启，不足以支持独立兼容宿主或原生文献适配已经成立。正式宿主与文献权威待用户选择，本票保持 claimed，未写 Answer。

### 独立最小宿主：原 BBT、自己的题录与实际导出

用户指出完整 Zotero 套壳偏离目标，确认下一步只验证独立宿主能否承接原 BBT 引用键和一次导出，并回复“继续吧”。已执行[最小宿主实验](../research/zotero-host-minimal-results.md)，工件见[运行说明](../prototypes/bbt-minimal-host-prototype/README.md)。

没有启动 Zotero 应用。Node VM 执行 BBT 9.0.68 原 bootstrap／主包；原 Worker 使用 Chromium 原生 IndexedDB。独立 SQLite 的 literature 表是唯一题录权威，原包所见 items／itemData／itemDataValues 为只读视图。显式 fill 生成并保存引用键，原有键及重复调用保留，SQL／对象及重新打开数据库读回一致；原 Worker／translator 实际导出两条含中文的 BibTeX。输入原包及实际执行成员逐字节核对不变。

纯 Node 对照在原 Worker 的 IndexedDB 初始化失败，业务未通过。Chromium 对照复用现有本机运行时；没有新增安装、开发服务器或 Git 操作，只复制一份官方日期格式静态资源。见[成功证据](../prototypes/bbt-minimal-host-prototype/evidence/chromium/result.json)和[失败对照](../prototypes/bbt-minimal-host-prototype/evidence/node/result.json)。

此证据支持独立题录权威能够承接代表性 SQL／对象契约，不能扩大为整个 BBT 或任意插件兼容。Notifier／偏好／idle／窗口事件仅接受注册，未验证事件投递、缓存更新、自动导出、附件、茉莉花或 Electron 嵌入。下一项聚焦数据变更与缓存语义及茉莉花非 Reader 路径；裁剪 Gecko 候选仍未实现。正式选型证据仍不足，本票保持 claimed。

### 独立宿主下一轮：通知更新通过，茉莉花遇到 DOM 缺口

用户回复“很好。继续下一轮验证”，已执行[题录变更与茉莉花装载实验](../research/zotero-host-mutation-results.md)。在自己的 SQLite 权威上修改已导出题录，通过真实保存通知触发原 BBT 的监听器和缓存更新，最终标题／DOI／作者进入实际 BibTeX。屏蔽通知的对照确实导出旧内容；已有键、另一条题录及重复导出保持一致，落盘全部字段读回通过。原包及执行成员不变，没有运行完整 Zotero。

茉莉花 1.1.39 原 bootstrap 实际装载主脚本，在 Addon／工具包构造的 Prompt 初始化中调用 `document.createElementNS`，当前 Node 宿主没有实现，主包求值失败。未进入 onStartup 或元数据业务，作者处理／附件匹配／跨插件写读没有通过；声明的 Gecko 模块命名空间与 UI 注册接口不计作真实服务兼容。

本轮支持普通题录修改后的原 BBT 兼容链，未支持第二个插件或正式宿主选型。下一项限定验证自己的 DOM 环境能否承接该初始化，再进入茉莉花业务；当前缺口不证明必须保留完整 Zotero 或选择 Gecko。批量／并发通知、其他承诺功能、Electron 嵌入和分发仍待取证。本票保持 claimed，未写正式 Answer。

### 独立原生 DOM：茉莉花作者处理与 BBT 共用文献权威

用户回复“同意，执行吧”，已完成[原生 DOM 实验](../research/zotero-host-native-dom-results.md)。原茉莉花 1.1.39 bootstrap／主包在独立 Chromium 页面执行，真实创建原工具包的 Prompt DOM，原 onStartup Promise 结束。新增通知触发原作者拆分，将“欧阳明、李华”保存为“欧阳／明、李／华”；页面 saveTx 写 Node 的同一 SQLite 权威，原 BBT 9.0.68 实际导出处理后的作者。关闭自动拆名的对照保持原样，页面投影与落盘数据一致，其他题录和元数据保持。

11 项本轮核对、BBT 基线和 SQLite 完整性／全部字段读回通过；BBT 缓存变更场景实际回归通过。两份 XPI 及执行成员不变，没有运行完整 Zotero、安装依赖或提交代码。见[成功证据](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom/result.json)。

原生 HTML DOM 实际执行；Gecko actor／Reader／窗口等仍接受占位注册，隐藏浏览器等仅声明模块命名空间，XUL 和工作台主窗未验收。当前支持第二个原插件的限定作者处理链，不能扩大为在线元数据识别、附件匹配或整个插件兼容。下一项进入这些原任务及所需 HTTP／translator／文件／关系保存服务。本票保持 claimed，整体宿主未选定。

### 独立元数据任务：原插件建项与 PDF 关联

用户回复“同意，继续验证”，已完成[元数据任务实验](../research/zotero-host-metadata-results.md)。在合成 PubScholar 协议输入下，原茉莉花从中文 PDF 文件名生成搜索、筛选命中，执行自己的建项回退，再保存原 PDF 的 parentID；原 BBT 从同一 SQLite 权威实际导出该题录及附件路径。无结果对照正确失败、不建项、不改关系。原包及 PDF 字节不变，没有运行完整 Zotero。

原插件请求的 RIS translator ID 与本机官方文件注册 ID 不同，未偷偷映射；原任务的 RIS 分支失败后由原插件回退成功。另用正确注册 ID 执行完整官方 RIS 原 body，导入原包生成的输入并保存，作为单独对照。不能把整体任务成功标成原 RIS 分支通过。

13 项元数据核对、既有作者处理和 BBT 基线通过，全部七条记录落盘读回及 SQLite 完整性通过；作者处理及缓存更新回归通过。见[最终证据](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/result.json)。当前新增证据限定为固定协议输入下的元数据处理和已有 PDF 关联；真实线上识别、下载／文件管理、独立 Reader 写回和产品分发仍待验证。下一项用真实文献与真实服务响应补齐在线路径，整体宿主保持待选，本票仍 claimed。
