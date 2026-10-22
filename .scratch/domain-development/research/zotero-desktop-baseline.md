# Zotero 个人桌面功能基线（差距审查）

用途：按可观察行为核对 Scholoom 的个人桌面文献工具范围。清单只记录 Zotero 官方资料描述的功能，不据此推导 Scholoom 的模块或数据架构。

版本依据：项目决议已固定 Zotero 10 基线（[兼容策略决议 #05](../../scholoom-foundations/issues/05-zotero-compatibility-policy.md)）。Zotero 官方[版本历史](https://www.zotero.org/support/changelog)记录 10.0 于 2026-08-17 发布，并给出 10.0 搜索与阅读器变化；[官方 10.0 公告](https://www.zotero.org/blog/zotero-10/)也说明 PDF Reading Mode。下列通用支持文档大多不标注适用版本，且部分页面较早更新，故仅作官方功能证据，不能据此断言每项细节都已逐条核验适用于 Zotero 10。明确的 10.0 新行为以版本历史和 10.0 公告为准。核对日期：2026-10-20。

范围边界：目标是个人桌面功能与 UI，保留 Scholoom 工作台骨架；项目文件和文献库附件共用编辑／阅读接口，harness 不随 tab 改变项目。云同步与群组协作后置；Word、LibreOffice、Google Docs 插件为独立后续；快捷键留到最后统一规划。以下不把这些后置事项计入首轮桌面差距。

| # | 功能面 | 官方资料所述行为（差距核对项） | 官方依据 |
|---|---|---|---|
| 1 | 条目类型与元数据 | 可建立多种文献类型；类型决定可用字段。条目可有多个不同角色的创建者，作者等按引用顺序记录；支持手工补录。 | [Item Types and Fields](https://www.zotero.org/support/kb/item_types_and_fields) |
| 2 | 元数据查看与编辑 | 在条目详情中查看、修改题名、作者、出版信息等字段；常见字段直接编辑并自动保存，创建者角色可调整，也可增删创建者。 | [Adding Items — Editing Items](https://www.zotero.org/support/adding_items_to_zotero) |
| 3 | 网页文献采集 | 官方浏览器 Connector 可识别网页条目类型和元数据，一键保存；搜索结果页可选择多条；可选保存关联 PDF 或网页快照，并指定目标集合、添加标签。Connector 是独立浏览器组件，行为依官方资料列入采集基线。 | [Adding Items to Zotero](https://www.zotero.org/support/adding_items_to_zotero)；[官方 10.0 公告](https://www.zotero.org/blog/zotero-10/) |
| 4 | 标识符录入与元数据检索 | 输入 ISBN、DOI、PMID、arXiv ID 或 ADS Bibcode 可检索并创建条目；也可对 PDF 检索元数据，成功时创建父条目并关联文件，失败时保留独立附件供补录。 | [Adding Items — Add Item by Identifier](https://www.zotero.org/support/adding_items_to_zotero)；[Retrieve PDF Metadata](https://www.zotero.org/support/retrieve_pdf_metadata) |
| 5 | 附件管理 | 可添加库内托管副本或外部链接文件，作为条目子附件或独立附件；支持网页链接／快照、打开或定位文件，并可将链接文件转换为托管文件。 | [Adding Files to your Zotero Library](https://www.zotero.org/support/attaching_files)；[Library Item Overview](https://www.zotero.org/support/kb/library_items) |
| 6 | 集合与层级 | 集合可嵌套；同一条目可同时属于多个集合而不产生副本；保存搜索作为动态集合，按条件持续显示匹配条目。 | [Collections and Tags](https://www.zotero.org/support/collections_and_tags)；[Searching](https://www.zotero.org/support/searching) |
| 7 | 标签 | 条目可有多个用户标签；可在条目详情或标签选择器增删标签，并用标签筛选库内容。 | [Collections and Tags](https://www.zotero.org/support/collections_and_tags) |
| 8 | 列表浏览与排序 | 条目列表可按列排序并切换升降序；可选择显示字段、调整列顺序，并设置次级排序字段。 | [Sorting](https://www.zotero.org/support/sorting) |
| 9 | 快速搜索 | 可按题名／年份／创建者、全部字段与标签，或 Everything 搜索；Everything 包括笔记及已索引附件全文。 | [Searching](https://www.zotero.org/support/searching) |
| 10 | 高级搜索与保存搜索 | 10.0 高级搜索可筛选当前任意视图，支持嵌套条件组、结果层级（条目／附件／批注／笔记）及跨层级条件映射；通用搜索文档另记载按字段、类型、集合等设条件、AND/OR 匹配和保存为持续更新的搜索。具体旧页面细节的 10.0 适用性未逐项核实。 | [Zotero 10 Version History](https://www.zotero.org/support/changelog)；[Searching](https://www.zotero.org/support/searching) |
| 11 | 笔记 | 支持条目子笔记与独立笔记；输入时保存；笔记可加标签、关联条目，并通过库搜索查找笔记文本。 | [Notes](https://www.zotero.org/support/notes) |
| 12 | PDF 阅读与批注 | 内置 PDF 阅读器支持高亮、下划线、文本／图像批注及批注侧栏；可将批注汇总或选取到笔记，并从笔记跳回 PDF 页。10.0 增加可调排版的 PDF Reading Mode，支持高亮、下划线、笔记，并与标准 PDF 视图共用批注和阅读位置。 | [PDF Reader and Note Editor](https://www.zotero.org/support/pdf_reader)；[Zotero 10 公告](https://www.zotero.org/blog/zotero-10/) |
| 13 | 相关条目 | 可在条目间建立关联并从详情查看相关条目，作为文献关系的人工整理入口。 | [Library Item Overview](https://www.zotero.org/support/kb/library_items) |
| 14 | 重复检测与合并 | 每个库提供重复条目视图；按题名、DOI、ISBN 等线索识别候选。合并时可选主条目及字段取值，并保留合并条目的集合和标签。 | [Duplicate Detection](https://www.zotero.org/support/duplicate_detection) |
| 15 | 回收与恢复 | 删除条目移入 Trash；可恢复到库或永久删除。官方集合文档说明默认保留 30 天，且可在设置中调整。 | [Collections and Tags — Trash](https://www.zotero.org/support/collections_and_tags) |
| 16 | CSL 引用与文献表导出 | 使用 CSL 样式生成引用和文献表；可安装／管理样式。桌面可复制格式化引文或文献表，也可生成并复制、打印或保存为 RTF／HTML；Quick Copy 还支持 BibTeX、RIS 等格式。 | [Citation Styles](https://www.zotero.org/support/dev/citation_styles)；[Creating Bibliographies](https://www.zotero.org/support/creating_bibliographies) |
| 17 | RSS 订阅 | 可按 RSS URL 或 OPML 添加订阅，查看并刷新新条目、标记已读／未读，再将选中条目保存进个人库。官方页面最后更新于 2017-12-07，Zotero 10 当前界面和逐项行为未另行核验。 | [Feeds](https://www.zotero.org/support/feeds) |
| 18 | 操作撤销与批量编辑 | 10.0 提供多条目字段编辑，以及多种操作的撤销／重做；可组合高级搜索和集合多选定位需要更正的条目。具体可撤销操作集合须逐项核对，不能推定所有外部副作用都可撤回。 | [Zotero 10 Version History](https://www.zotero.org/support/changelog) |
| 19 | 朗读 | 10.0 官方说明改进正文朗读，包括跨栏／跨页段落连续读取、句子高亮及跳过部分引用和版面内容；平台语音及实际支持需按目标环境核对。 | [Zotero 10 Version History](https://www.zotero.org/support/changelog)；[Zotero 10 公告](https://www.zotero.org/blog/zotero-10/) |

## 核验说明

- 官方[下载页](https://www.zotero.org/download/)现列 Zotero 10；版本历史和 10.0 公告确认其发布及部分新增功能。项目固定基线与官方当前版本相符。
- 本清单没有把 Zotero 9 或更早通用支持页自动视为 Zotero 10 契约。提交差距审查时，应对未标明版本的旧页条目结合 Zotero 10 官方源码或实际 10.0 行为再确认，尤其是 RSS、搜索通用细则和附件管理细节。
- Word、LibreOffice、Google Docs 文档插件、云同步和群组功能以及快捷键不列为本轮验收项；官网相应入口可见[官方文档目录](https://www.zotero.org/support/)，此处不展开其行为。
