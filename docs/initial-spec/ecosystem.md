# Zotero 生态与迁入 Specification

初设参考；适用方式见 [总入口](README.md)。

## Purpose

定义 Scholoom 自有采集入口、指定 Zotero 插件及既有库迁入的目标行为，保留用户材料、引用键和后续编辑，区分原包兼容、界面适配与真实业务可用性，使生态接入可按版本和功能独立验证。

依据：[文献 PRD](../prd/literature.md)、[兼容政策 #05](../../.scratch/scholoom-foundations/issues/05-zotero-compatibility-policy.md)、[宿主 #16](../../.scratch/scholoom-foundations/issues/16-zotero-host-prototype.md#answer)、[生态接入 #41](../../.scratch/scholoom-foundations/issues/41-zotero-ecosystem-integration.md#answer)。

## Requirements

### Requirement: Z-01 指定原包兼容与共同能力

系统 SHALL 基于固定 Zotero 10 基线和自有独立宿主支持已验证版本的 Better BibTeX 与茉莉花，保持插件原发布包及代码不修改；使用 Scholoom 不要求安装或启动 Zotero。适用能力 SHALL 可由 Agent 经共同入口调用，原包行为和自有 UI 适配分别验证，不将加载成功等同功能兼容。

#### Scenario: 未安装 Zotero 的产品环境
- **WHEN** 用户启动 Scholoom 并使用声明支持的插件功能
- **THEN** 功能由随产品提供的宿主与共同领域服务承接，不借助外部 Zotero 进程完成兼容验收

### Requirement: Z-02 Connector 独立保存与共存

Scholoom SHALL 提供独立命名、发布及维护的 Connector，支持选择库与集合并呈现题录、附件和快照的实际保存结果。自有扩展默认存入 Scholoom，官方扩展继续存入 Zotero；目标不可用 SHALL 显示原因及重试机会，不静默改投其他应用或云端。

#### Scenario: 两个扩展同时安装
- **WHEN** 用户分别从 Scholoom Connector 和官方 Zotero Connector 保存页面
- **THEN** 各自进入对应应用；Scholoom 不可用时自有扩展报告失败，不自动转存 Zotero

### Requirement: Z-03 引用键与导出保护

系统 SHALL 支持 BBT 引用键生成、BibTeX／BibLaTeX 导出、自动导出、pull export 和对外 JSON-RPC。迁入、用户指定和已生成的键默认稳定；题录更正不自动改键，明确重生成时处理冲突及已知项目引用。项目与库键差异通过映射关联，手工维护的引用文件 SHALL 受到文件编辑保护。

引用键与插件状态的职责归属采用[生态职责决定](../../.scratch/domain-development/issues/08-zotero-ecosystem-constraints.md#q1引用键与插件状态归属)，正式键只有一处事实源；项目影响核对遵守该决定引用的范围约束。

#### Scenario: 更正已引用文献的标题
- **WHEN** 元数据标题被更正且用户未要求重生成引用键
- **THEN** 已有键保持稳定，已知稿件引用不因题录变化失效

#### Scenario: 外部应用调用 BBT 接口
- **WHEN** 验收声明支持的对外 JSON-RPC 功能
- **THEN** 由真实外部入口执行并核对结果，内部桥接 RPC 的成功不能代替该验收

### Requirement: Z-04 元数据与阅读辅助

茉莉花接入 SHALL 支持中文元数据识别补全、中文 translators 和 CSL、本地附件匹配及 PDF 大纲书签。授权内补全可填空并记录来源，已有字段冲突保留候选，失败不清空原字段。大纲书签 SHALL 可读写、导航并在重启后保留，Agent 无需打开阅读器即可读取同一结果；PDF 写回保护原材料及其批注与证据。

#### Scenario: 补全结果与已有 DOI 冲突
- **WHEN** 识别结果与已存字段不同
- **THEN** 保留候选和来源，交由人或获授权 Agent 核对，不用失败或不确定结果清空现有数据

### Requirement: Z-05 版本及资源更新

插件 SHALL 仅升级到 Scholoom 已验证版本。Translators 和 CSL 从明确来源独立更新，记录版本并保护用户定制；更新失败保留可用资源且支持回退。发布 SHALL 记录实际宿主、插件及资源组合和已验收功能，不宣称兼容任意插件或任意上游版本。

#### Scenario: 样式资源更新失败
- **WHEN** 下载或验证新 CSL 资源失败
- **THEN** 继续使用上一可用资源，保留用户自定义内容并说明失败

### Requirement: Z-06 单向迁入与关系保留

迁入 SHALL 处理用户选定个人库及本机可读取的群组库内容，不修改源库或源附件；保留来源库区分、稳定映射、集合标签、题录键、笔记批注及附件关系。托管附件复制，外链保留或按选择转为托管；缺失及转换限制逐项报告并保留必要原材料。账号、群组权限与在线同步关系不随内容迁入。

#### Scenario: 迁入包含缺失附件和外链
- **WHEN** 所选库有未下载、不可读取及外部链接附件
- **THEN** 可迁入部分保留正确关系，缺项逐项显示，外链按用户选择处理，源文件保持原状

#### Scenario: 迁入已有插件配置
- **WHEN** 迁入引用键、规则和导出任务等首批插件必要状态
- **THEN** 按语义保留可映射内容并列明差异；导出路径和任务先作为配置候选，核对后才启用写文件行为

### Requirement: Z-07 中断续做与安全撤回

迁入 SHALL 预检范围与差异，逐项提供完成结果，核对关系并实际打开样本附件、笔记及批注，验证引用键导出与重启读回。中断保留已确认完成部分，重试核对身份映射且保护迁入后编辑；撤回只处理仍可安全撤销的部分，保护后续修改与项目使用关系。

安全判断采用[生态职责决定的保留原则](../../.scratch/domain-development/issues/08-zotero-ecosystem-constraints.md#q3迁入撤回采用保留原则)；无法证明安全的已入库对象 SHALL 保留并报告，未查到引用不能作为安全删除的依据。

#### Scenario: 中断后用户编辑已迁入条目
- **WHEN** 迁入重试遇到已完成且又被用户修改的条目
- **THEN** 不重复创建或覆盖后续编辑，补齐未完成项并说明冲突

#### Scenario: 撤回时材料已被项目采用
- **WHEN** 用户要求撤回迁入而部分材料已有项目使用关系
- **THEN** 保护这些关系和必要内容，明确安全撤回部分及不能撤回部分，不只凭本次迁入标记删除材料
