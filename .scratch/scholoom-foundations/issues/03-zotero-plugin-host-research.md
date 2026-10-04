# 查明 Zotero 原插件在 Electron 中运行所需的宿主能力

Labels: wayfinder:research
Type: research
Mode: AFK
Status: resolved
Assignee: 本会话协调者；Hilbert 调查
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by:

## Question

在保留现有 Zotero 插件包和代码的前提下，Electron 宿主需要提供哪些加载、数据、UI 与平台能力？哪些能力可映射到原生服务，哪些依赖 Gecko 或 Zotero 私有实现，哪些只能通过指定插件的运行验证确认？

调查官方插件文档和加载器源码，并检查用户指定的 Better BibTeX 与茉莉花官方仓库，区分 XPI 包格式、bootstrap 生命周期、Zotero API、Gecko 特权能力及窗口或阅读器集成。给出兼容层、宿主适配与保留 Gecko 辅助运行时的边界和未知项，不替用户选择路线，不声称已完成运行验证。结果供兼容策略票使用。

## Answer

2026-10-03 完成静态源码与官方文档调查。详细依据及未知项见 [Zotero 原插件宿主能力调查](../research/zotero-plugin-host.md)。

Electron 自带扩展机制不能直接加载 Zotero 的 XPI/bootstrap 特权插件。Better BibTeX 的代表性依赖包括 citationKey、Zotero.DB 查询语义、翻译框架与沙箱、偏好和导出服务；茉莉花还依赖 Gecko 浏览器 actor、cookie 上下文及 Zotero 阅读器内部对象。

研究识别了纯逻辑、领域服务和平台或私有接口三类承接边界，可供兼容路线讨论使用。兼容层、应用侧适配或 Gecko 辅助宿主的实际可行性仍需原型和运行验证。本票不选择路线，也不代表两个插件已经兼容 Electron。
