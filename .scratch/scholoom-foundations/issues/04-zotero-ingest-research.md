# 查明 translators 与 browser connector 的独立复用边界

Labels: wayfinder:research
Type: research
Mode: AFK
Status: resolved
Assignee: 本会话协调者；Confucius 调查
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by:

## Question

官方 translators、translate 框架、translation-server 和现有 browser connector 能为独立 Electron 文献库提供什么？Scholoom 仍须实现哪些宿主服务、持久化和附件保存职责？

调查官方源码与文档，说明 Node 复用入口及局限、外部浏览器 connector 的桌面接收协议、与 Zotero 同时运行时的目标选择和端口问题，以及稳定身份与保存会话的接入边界。区分 translator、桌面插件与浏览器扩展；不要把 Node 翻译服务视为完整文献管理底座。结果只记录事实与待验证项。

## Answer

2026-10-03 完成静态源码与官方文档调查。详细职责映射与验证缺口见 [Zotero translators 与 Connector 摄取调查](../research/zotero-ingest.md)。

translate 框架要求宿主提供 translators、HTTP、ItemSaver 等接口；官方 Node translation-server 提供翻译执行和格式转换，但不承担文献库或附件持久化。

外部浏览器 Connector 通过本机 HTTP 调用桌面保存端点，并通过会话关联条目与附件。其目标读取 connector.url 偏好，默认地址为 127.0.0.1:23119；默认同端口共存存在冲突，目标配置和共存行为尚需验证。会话键不能当作持久文献身份。

本票提供独立应用的接入职责和静态依据，不构成兼容路线选择，也未证明 Electron 端到端保存已经可用。
