# 变更提议

## Why

变更起点的兼容宿主只有隐藏 Chromium 窗口，尚未装载插件或连接共同文献权威。历史原型证明指定 BBT 原包可在 Node＋Chromium 中完成有限的引用键及导出链路，但样本存储、事务通知和身份映射不能直接用于产品。七线并行需要先获得固定 Zotero 10 的身份、字段、关系及插件保存证据，再独立建设宿主与 BBT 首个闭环，避免文献域固化有损映射，或因插件缓存形成第二份正式引用键。当前独立成果与仍缺提供者以delivery为准。

## What Changes

- 先交付可转交的 Zotero 10.0.5／BBT 9.0.68／茉莉花 1.1.39 调查：来源身份、完整上游类型字段目录与 CSL 转换限制、保存／SQL／通知／缓存、固定键及 Reader 写回边界。
- 规划独立 Node＋Chromium 兼容宿主：固定原包装载、生命周期及诊断，通过共同 broker／回环 WebSocket 连接所属领域。
- 首个实施闭环限隔离样本中的 BBT 默认补键、已有键保留、元数据更正后缓存刷新、BibTeX／BibLaTeX 返回结果与重启读回。文献正式键、来源映射、授权及修订提交由文献提供者掌握；缺失端口明确阻塞真实接线。
- 首批不启用明确重生成、只读库 shadow key 作为正式键、自动导出或导出文件写入。自动导出、真实外部 JSON-RPC／pull export 按后续有界验收继续承接既定目标，不从内部 RPC 推断通过。茉莉花、Connector、单向迁入分别另立 change。
- 实施按独立宿主、领域前置及真实整合分层推进；前置缺失时记录实际独立成果和阻塞，不把隔离样本当作生产共同写入。

## 完成判据

2026-10-30用户确认采用Linux阶段收口并授权按计划修订工件：本阶段验收Linux Browser＋真实Electron的首批完整路径，Windows普通布局、原包／生命周期目标及正式分发未交付，责任沿本change的[tasks后续责任](tasks.md#后续责任不计本阶段复选框)保留。macOS沿既定人工能力／受管执行不可用。此范围不减少共同身份、正式键、授权、事务、unknown及完整停止保证；现有实跑和独审仍须与最终源码逐项核对，不能因平台后置勾完Linux任务。

规划：proposal、investigation、delta spec、design、tasks 及映射依据可审查，适用 CLI 校验通过；待输入与可独立实施任务分别列明，不能因文件齐备宣布生产方案闭合。

实施：真实兼容宿主执行未修改 BBT 原包，经真实共同领域提供者读写同一隔离库，两个导出格式与重启后的正式键、修订和持久结果一致；冲突、撤权、未知提交与停止失败可诊断，不能自动重放。仅宿主／替身层通过时按层记录，不称 I6 完成；生产用户库保持禁用，直到所属保护实际就绪并获得相应授权。

## Capabilities

### New Capabilities

- `zotero-host-bbt`：限定版本原包宿主、隔离样本共同读写与已有键保护、导出结果和失败核查。

现有 `module-runtime`、`literature-catalog`、`literature-attachments`、`literature-reading`、`platform-access` 与 `domain-execution-handoffs` 作为消费约束，不由本线改写。共同字段／来源／键的增量由文献线制定，本 change 不提前添加其 delta。

## 决策与授权依据

- 用户指定起点 `e3d58fc807827a78493dcd16e38de28c8d02766e`、Codex／`gpt-6.1-sol`／high，首次仅授权调查规划；随后明确“实现该change”，授权按本方案实施。用户另行允许按锁文件安装依赖并准备Electron；没有升级依赖版本。
- [并行计划](../../../.scratch/domain-development/parallel-development-plan.md)的生态小节、公共文件归属及 I6；[生态职责 #08](../../../.scratch/domain-development/issues/08-zotero-ecosystem-constraints.md#answer)、[原包兼容 #05](../../../.scratch/scholoom-foundations/issues/05-zotero-compatibility-policy.md#answer)、[宿主选择 #16](../../../.scratch/scholoom-foundations/issues/16-zotero-host-prototype.md#answer)。Node＋Chromium 路线及原包不修改已定，不重新选 Gecko。
- 沿 [scholoom-dev 阶段约定](../../schemas/scholoom-dev/README.md)执行apply，实际成果与未完成前置进入同一delivery。2026-10-26用户明确恢复已同步本树，并授权本轮独立认证监督、私有启动供应及原包shutdown修复，允许本地可审查补丁；不扩大到真实用户库、推送／PR、归档、依赖安装、开发服务器或他树操作。
- 阅读线两份design已由主线正式交接并分别核对，不替对方创建工件；来源副本、正式键冲突及有界多对象原子提交政策已定，实际文献提供者仍是前置。
