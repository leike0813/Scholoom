# 科研 harness 与 Agent 执行路线：首轮资料核对

调查日期：2026-10-03。本文提供讨论依据，不构成引擎选型。尚未安装依赖、运行候选引擎或验证 Electron 打包。

## 官方资料支持的集成差异

- Pi SDK 可嵌入 Node.js/Bun 进程，定制模型、工具、资源加载和会话管理；提供流式事件、追加指示和终止操作，并保留自身会话上下文。依据：[Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)。原 `badlogic/pi-mono` 文档地址在调查时重定向至该仓库，本次以重定向后的官方文档为依据。
- OpenCode 的 JS/TS SDK 是服务端客户端，`createOpencode` 示例启动客户端与服务端。它属于服务端集成路线，不能仅凭“SDK”名称视作进程内嵌执行循环。依据：[OpenCode SDK](https://opencode.ai/docs/sdk/)。
- ACP v1 定义能力协商、认证、创建会话、提交指令、进度通知、权限请求和取消。会话加载取决于 `loadSession` 能力，文件和终端操作也存在能力协商。依据：[ACP v1 概览](https://agentclientprotocol.com/protocol/v1/overview)。
- ACP 文件方法可访问宿主文本，包括编辑器未保存内容；实际后端是否始终通过宿主文件方法访问材料，需要另外验证。依据：[ACP v1 文件系统](https://agentclientprotocol.com/protocol/v1/file-system)。

## 本地参考快照的启示

- zotero-agents 已区分外部 Agent 循环、SkillRunner 执行、普通 HTTP 生成和手工产物接入，并将取消和诊断列入后端契约。ACP 预设配置不代表功能对等。依据：[Agent 后端与运行时](../../../references/zotero-agents/07-Agent后端与运行时.md)。
- Zotero 中的 WebSocket—stdio Bridge 是宿主适配；Scholoom 是否仍需要这一中继，应按实际进程模型判断。上述快照关于 CLI 订阅可用性的概括不能当成所有后端的保证；具体账户、计费与登录复用由各后端决定。
- zotero-agents 的 Host Bridge 有执行前校验和写入准入流程，其宿主操作串行化范围仍有界。可借鉴程序落实权限与状态的原则，具体机制需结合 Scholoom 已确认的任务级授权设计。依据：[宿主能力与 Bridge](../../../references/zotero-agents/10-宿主能力与Bridge.md)。
- Nimbalyst 快照描述了后端原始输出、规范事件和界面投影的分工；同一组快照指出规范事件实际仅存内存，旧文档关于持久化事件表的描述存在漂移。可借鉴事件转换职责，不能据此假定其已经提供可迁移的持久会话模型。依据：[编辑器与 AI 与扩展](../../../references/nimbalyst/05-编辑器与AI与扩展.md)、[开发约定与已知坑](../../../references/nimbalyst/09-开发约定与已知坑.md)。这些结论来自本地参考文档，本次未重新审计 Nimbalyst 源码。

## 路线取舍

以下是基于接口与生命周期差异的设计推断：

| 路线 | 对 Scholoom 的价值 | 需要承担的工作 |
| --- | --- | --- |
| 自研执行循环 | 模型、工具和上下文行为可直接控制 | 维护模型适配、流式处理、工具循环、压缩、重试和会话恢复 |
| 嵌入成熟执行引擎 | 复用通用执行能力，定制科研工具和资源 | 验证工具替换、资源发现、终止语义、会话管理及升级契约 |
| 接入现有 Agent 进程或服务端 | 复用既有 Agent 环境与能力 | 监督后端生命周期，适配协议、能力差异、文件访问和产物提交 |

Scholoom 已确认的研究对象、持续任务、授权和变更语义由其科研内核掌握。引擎自身会话可保留和恢复，跨引擎续做使用持续研究状态与产物。

## 选型前仍需回答

- 内置主引擎采用哪条路线，首批模型与账户接入要求是什么？
- 候选引擎能否控制默认工具、资源发现和修改路径，落实既有授权与变更要求？
- 追加指示、暂停、取消、断线与进程退出分别有什么实际效果？
- Skills、外部 Agent 协议、引擎扩展及领域能力接口应如何分工？
- 三平台打包运行时，需要分发哪些进程和资源？
