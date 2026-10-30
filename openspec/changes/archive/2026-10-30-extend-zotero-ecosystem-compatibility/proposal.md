# 变更提议

## 阶段处置：暂缓，未实施

2026-10-30，用户确认按Linux阶段收口现有实施change，并授权执行收口计划。本提案只登记后续目标，本阶段暂缓并作为提案留档；没有实施、验收通过或正式规格同步。茉莉花、复杂原值映射及Reader写回仍未交付，恢复时从[生态职责决定](../../../../.scratch/domain-development/issues/08-zotero-ecosystem-constraints.md)核当前代码、原包及所需授权后重新规划。本次归档不代表这些能力已可用。

## Why

现有 BBT change 的首个闭环是隔离普通期刊的补键、显式原值导出和共同保存；原值权威任务却同时要求茉莉花实跑，部分生态任务又混入复杂映射和 Reader 写回。用户已明确按既定首批范围完成，将后置功能另立变更。本提议承接这些尚未实现的目标，保留原包、共同权威和数据保护要求，使首批验收与后续兼容工作各有准确范围。

## What Changes

- 接入指定版本茉莉花原发布包，依固定 Zotero 10 基线适配实际装载、功能入口、异步保存、通知与完整关闭；原包不改，不复制算法代替原入口。
- 承接首批普通期刊以外的类型、字段、关系及多原值映射，逐项确定无损范围与显式选择；复用共同原值、来源实例、正式键与原子提交权威。
- 承接 Zotero Reader／PDF 写回与已有共同阅读记录、sidecar／新材料版本和报告的联合验收；不从已有端口推断适配完成。
- 自动导出、外部 JSON-RPC／pull export、Connector、单向迁入及真实用户库生产启用沿各自后续边界，不因本提议登记而启用。

## 完成判据

调查先核对固定原包和实际功能调用，确定每片接口、原子范围、授权及平台前置，再形成规格、设计与任务。每片须通过真实原包入口、真实共同提供者及实际产物核对；BBT、独立 creator 模块和旧 Gecko 原型均不能代替茉莉花验收。SQL 投影、CAS／撤权拒绝、未知回执、提交后通知、缓存及停止分别核查。未完成规划前不进入实施。

本提议仅登记用户本次决定的后续工作，不属于本轮原有 change 的首批完成清单，也不宣称已经交付。现有普通期刊限制及真实用户库禁用继续有效。

## Capabilities

### New Capabilities

- `zotero-ecosystem-extensions`：指定版本茉莉花、扩展原值映射及 Reader 写回的实际兼容范围；具体契约由调查后细化，消费现有 `literature-catalog`、`literature-reading` 和首批 `zotero-host-bbt`。

## 决策与授权依据

- 2026-10-29 用户对范围冲突明确选择“按既定首批范围完成，后置功能另立变更”。承接原值权威任务 2.3 中的茉莉花，以及 BBT 任务 2.1 中超出首批的映射／E5；这些目标保持未交付。
- [原包兼容决定 #05](../../../../.scratch/scholoom-foundations/issues/05-zotero-compatibility-policy.md)、[宿主选择 #16](../../../../.scratch/scholoom-foundations/issues/16-zotero-host-prototype.md)和[茉莉花一手来源调查](../../../../.scratch/scholoom-foundations/research/jasminum-common-authority.md)。既定 Node＋Chromium、原包不改、用户无需安装 Zotero 的方向不变。
- 当前仅获后续变更登记授权；安装、系统策略、真实库写入及新增付费模型验收不由本提议授予。原值权威及首批 BBT 的实际结果仍在其各自 delivery。
