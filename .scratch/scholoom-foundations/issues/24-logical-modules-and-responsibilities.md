# 确定七个逻辑模块及职责边界

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话 Codex；与用户讨论模块划分（2026-10-08）
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 06, 07, 09, 17, 18

## Question

Scholoom 后续按哪些逻辑模块继续讨论，各模块分别承担哪些职责，研究项目管理与文献管理、科研业务与 harness、执行环境与插件兼容层之间怎样划分？

## Answer

2026-10-08，用户提出六个模块：文献管理、内置 Agent harness、工作台界面、业务层、执行环境与沙箱、Zotero 插件兼容层。主 Agent 建议补充研究项目与研究资产模块，并明确模块之间的职责；用户回复“同意”，本票解决。

### 模块划分

| 模块 | 职责 |
| --- | --- |
| 文献管理 | 题录、集合、附件、批注、导入、检索、去重与文献身份，承担 Zotero 的位置 |
| 内置 Agent harness | Agent、会话、通用执行、上下文、委派、工具调用、工具与委派范围限制、人类介入及恢复；领域最终授权沿[模块依赖决议](../../runtime-architecture/issues/01-module-dependencies-and-authority.md#answer) |
| 工作台界面 | 编辑器、阅读器、Agent interface、资源导航、任务观察与产物审查 |
| 科研业务与内容 | 内置 Skill、科研能力声明、workflow，以及具体科研方法与交付要求 |
| 执行环境与沙箱 | 程序与工具的受管执行、环境供给、资源限制、取消及隔离；公共基础与 Agent 监督的关系沿[模块依赖决议](../../runtime-architecture/issues/01-module-dependencies-and-authority.md#answer) |
| Zotero 插件兼容层 | 插件装载、宿主契约、DOM／Workers、插件状态及向原生文献服务的适配 |
| 研究项目与研究资产 | 项目、研究材料、证据与主张关系、稿件、审稿问题及正式研究决定的管理 |

七项是逻辑职责，不机械对应七个进程或包。包隔离、模块调用与宿主装配以[模块依赖决议](../../runtime-architecture/issues/01-module-dependencies-and-authority.md#answer)为准；进程部署与监督沿[进程决议](../../runtime-architecture/issues/03-session-execution-processes.md#answer)，共同客户端与独立插件宿主保持原有职责。

### 领域归属与共同权威

文献库资产与项目研究事实沿[研究对象与领域边界](06-research-domain-boundaries.md)及[存储与变更模型](13-storage-and-change-model.md)管理。论文的题录与附件归文献库；项目采用哪些证据、形成什么主张及在稿件中的位置，由研究项目与研究资产模块承接。文献自身的证据、主张与可复用分析仍按已有决定归文献库，不能因对象类型统一迁入项目模块。

工作台呈现共同内核中的事实。编辑器、Agent 面板和任务视图可保有局部界面状态，任务、文献与研究事实由对应模块管理；普通稿件文件的正文权威和开放编辑继续沿已有存储约定。

### 科研业务与 harness

科研业务与内容包含 Skill、科研能力和 workflow，定义科研方法、工作输入、交付与检查要求。harness 负责运行这些定义；workflow 的调度、暂停与恢复进入共同运行时。具体方法内容与通用运行机制分别管理，沿[原生科研能力核心模型](17-native-research-capability-model.md)及[原生内容与执行契约](18-native-capability-runtime-and-content.md)继续细化协作接口。

### 执行环境与沙箱

执行能力面向人和 Agent 提供共同接口，接受受管执行请求并返回状态与产物；公共执行基础独立于 harness，平台提供进程机制，harness 承担 Agent 监督。具体进程、归属及收尾沿[进程决议](../../runtime-architecture/issues/03-session-execution-processes.md#answer)。科研任务是否完成仍由科研交付要求判断。

资源约束与安全隔离强度分别表达。首阶段仍沿[架构票](09-electron-architecture.md)的可信代码执行决定，强隔离若要加入，需单独讨论。本票没有新增任意代码安全隔离承诺。

### Zotero 生态适配

插件兼容层通过文献管理模块操作同一份权威数据，插件专属设置和缓存由兼容层管理。Translators 与 Connector 的具体模块归属继续细化：文献管理负责导入结果与业务行为，相应适配负责生态协议和宿主要求。

### 后续讨论

先确定各模块职责与依赖，再逐项深入；优先细化 Agent harness 与科研业务层的协作契约。其余子系统与跨模块未决问题持续进入地图，不以本票完成推进业务实施。

## Comments

- 2026-10-08：本票记录用户已完成的模块划分讨论及“同意”的确认，不代表各子系统设计已完成。本轮只记录决策，没有修改业务代码、安装依赖或运行服务。
