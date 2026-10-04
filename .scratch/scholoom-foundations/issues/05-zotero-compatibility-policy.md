# 选择 Zotero 生态兼容路线与首批兼容承诺

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话协调者；与用户共同讨论
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 03, 04

## Question

在用户希望现有插件无需修改的前提下，Scholoom 应采用什么兼容路线，首阶段对哪些实际插件及其功能作出什么承诺？如何处理原包直接运行、应用侧适配、插件移植与 Gecko 辅助宿主之间的成本和产品取舍？

用户已指定 Better BibTeX 与茉莉花。结合这两个插件的实际功能和宿主调查，明确验收范围、数据和 UI 的一致性、版本支持及维护责任。分别处理文献数据互操作、translators、connector 和插件运行的兼容程度。不能用“可安装”替代主要功能可用，也不能把用户的理想自动改写为允许修改插件。

## Comments

用户对指定版本原包兼容、允许评估 Gecko 辅助宿主、界面重新呈现、首批必测功能、translators 与 Connector 复用，以及兼容矩阵和维护责任六项建议回复“全部采纳”。

## Answer

2026-10-03 经用户采纳，本票的兼容策略与首批验收目标确定。2026-10-04 用户在 [#16](16-zotero-host-prototype.md) 选择 Node＋Chromium 通用兼容层，固定 Zotero 10 基线，并以重要插件推动开发适配与验收。

### 原包兼容与宿主适配

首批支持指定版本的 Better BibTeX 和茉莉花，原插件发布包及代码无需修改，由 Scholoom 提供配套宿主适配。发布承诺限定到明确的插件版本和已验证功能，再逐步扩大支持范围。

科研 Agent 内核与 Electron 工作台保持独立。兼容宿主采用 Node＋Chromium，产品使用不要求用户另外安装、启动 Zotero。实现以 Zotero 10 的共享宿主契约为依据，开发时先适配一批重要插件，逐步扩大接口覆盖；不承诺全部插件无缝兼容。Gecko 辅助宿主已在原型选型中作为候选比较，本次未采用。

原型决策的范围是选择具体兼容宿主，不能把本票的目标确认当作原插件已经可在 Electron 中运行的证据。静态依据见 [插件宿主调查](../research/zotero-plugin-host.md)和 [translators 与 Connector 调查](../research/zotero-ingest.md)。

### 功能与界面验收

允许 Scholoom 用自己的界面重新呈现插件功能，保留必要功能、配置和结果。原包运行和界面适配分别验收。已兼容的科研功能应能通过 Agent 接口调用。

| 插件 | 首批重点验收功能 |
| --- | --- |
| Better BibTeX | 引用键生成与保留、BibTeX/BibLaTeX 导出、自动导出、pull export 与 JSON-RPC |
| 茉莉花 | 中文元数据识别与补全、中文 translators 与 CSL 样式、本地附件匹配、PDF 大纲与书签 |

以实际使用情境补充功能清单；插件装载、主要功能、界面呈现和 Agent 调用需要分别检查。

### translators 与浏览器 Connector

首阶段复用现有 translators，并使现有浏览器 Zotero Connector 能将条目和附件保存到 Scholoom。与 Zotero 共存时明确当前保存目标，验收条目、附件、集合选择和保存进度。目标选择机制及具体协议实现由后续架构和接入工作确定。

### 兼容版本与维护责任

围绕 [#16](16-zotero-host-prototype.md) 确定的固定 Zotero 10 基线和插件版本建立兼容矩阵。首批 Better BibTeX／茉莉花保持，其他重要插件在开发时选定；清单用于开发优先次序及支持记录，兼容层实现按共享宿主模块组织。插件或基线更新后，验证通过再扩大支持承诺。宿主适配由 Scholoom 承担维护责任。

宿主路线与初始接口基线已确定；具体功能、界面、Agent 接入和发布环境按实际验收记录支持程度，原型通过的部分不等于整个插件已兼容。
