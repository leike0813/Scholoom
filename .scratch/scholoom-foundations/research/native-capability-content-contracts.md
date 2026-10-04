# 原生科研能力的内容与执行契约依据

调查日期：2026-10-03。用于[运行时契约、内容编写与旧内容迁入](../issues/18-native-capability-runtime-and-content.md)的讨论。以下区分官方规范、本地参考快照与设计建议；未安装 SDK、执行原型或迁入实际内容。

## 官方规范与框架能力

- [Agent Skills 规范](https://agentskills.io/specification)以含 YAML frontmatter 的 `SKILL.md` 为基本入口，允许配套脚本、参考资料、模板与其他文件，并支持渐进加载。标准方法包不要求声明科研输入、交付验收或正式流程状态；这些需要 Scholoom 根据已确认核心模型表达。
- 规范中的 `allowed-tools` 属于实验性字段，宿主支持可能不同。内容声明不能单独代替运行时授权执行。
- [Deep Agents Skills](https://docs.langchain.com/oss/javascript/deepagents/skills)支持标准方法包、按需读取、组合来源，以及按后端和上下文限制可见资源。内容可见性、内容写入和脚本执行需要分别配置。具体 SDK 版本及接口待技术栈票选择，文档示例不构成已验证配置。
- [LangGraph Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api)以状态、节点和边组织执行；节点可以是 Agent 逻辑或普通程序，边可以表达固定或条件路径。科研能力不必与单个节点一一对应。图结束的技术含义与科研交付检查的区别，沿用已确认核心模型。

## zotero-agents 内容参考

依据：[工作流引擎与执行](../../../references/zotero-agents/06-工作流引擎与执行.md)，重点为两层 manifest、Hook 加载与执行及执行主链路。

- 包声明和工作流声明分别描述内容身份与具体输入、参数、资源、后端、产物及 hooks；解析后形成统一契约投影，供不同消费点使用。
- `preflight`、`buildRequest`、`applyResult` 连接输入准备、后端请求与 Zotero 写回。相应职责可作为原生输入准备、执行和结果应用的参考；其固定宿主与请求形状不自动成为 Scholoom 契约。
- 参考快照记录了为 Gecko 适配的导出改写、宿主 facade 与全局执行作用域串行化。迁入是否保留或改写须依据原生执行接口确定，不能据此声称已有进程隔离。

## ResearchSpec 内容参考

原生子 Agent 使用用户指定的 `minimax-cn/MiniMax-M3.1-Flash-Preview` 核对了[能力包与 Procedure](../../../references/ResearchSpec/08-能力包与Procedure.md)、[功能地图](../../../references/ResearchSpec/03-功能地图.md)、[架构分层](../../../references/ResearchSpec/04-架构分层.md)及相关段落。以下经协调者结合已确认决策整理。

- 核心能力包使用 manifest 声明研究职能、执行类别、输入输出、校验和知识引用；`SKILL.md` 提供 Agent 可读说明。方法正文、模板与研究约定是内容资产，manifest 字段是否直接保留需要原生契约映射。
- Procedure 是多个来源形成的运行时目录条目，应区分原始内容与发现投影。profile 描述能力编排及依赖、并行、Gate、Decision 等控制要求；Companion 提供 Navigate、提案、决定与检查等编排入口。
- CLI 维护正式状态的规则属于现有实现。Scholoom 已确定由统一科研运行时协调权威状态，CLI 和工作台调用共同内核；跨会话或跨引擎延续本身并不与确定性状态治理冲突。
- 现有维护期校验的范围不能替代 Scholoom 已确认的运行期交付检查。快照中的固定数量、hash 或旧包校验条件不自动进入本项目契约。

## 设计取舍的依据

以下说明设计取舍的依据；已确认结论及后续待决问题以[原生内容与执行契约票](../issues/18-native-capability-runtime-and-content.md)为准：

- 标准 Skill 可以提供原有方法与资源；原生科研能力可增加明确的机器可读交付声明，程序实现按需提供。正文与声明分别负责方法和可检查约定，避免同一字段重复维护。
- 普通方法可以由通用科研 Agent 执行，程序化工作通过函数或 LangGraph 图接入共同生命周期。授权、实际输入与结果应用仍由原生内核协调。
- 原格式直接执行可以减少初次内容编辑，但需长期映射旧宿主、后端和状态假设；导入转换适合有明确等价关系的内容；原生改写需要初次适配工作，能直接采用共同运行时。成本不能只按正文改动量判断。
- 科研内容的吸纳与重建以原生内容票的决定为准；指定版本 Zotero 插件原发布包的兼容承诺已经另行确认。实际源码抽取、Rust 与实现模块复用留给其专门票。

## 委派与程序执行的契约核对

- [Deep Agents Subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)提供角色、工具、模型、Skills、上下文及结构化输出等配置，并支持已编译图作为子 Agent 执行入口。各配置的框架默认继承行为不能自动视为 Scholoom 工作包与任务授权契约；实际适配需按共同内核规则配置并验证。
- [Deep Agents Backends](https://docs.langchain.com/oss/javascript/deepagents/backends)区分文件操作与本机 shell 执行，明确说明文件路径限制不能约束获得本机 shell 的程序访问。由此可知，为代码传入受限资源接口本身不构成操作系统隔离。
- [Deep Agents Sandboxes](https://docs.langchain.com/oss/javascript/deepagents/sandboxes)描述受隔离执行环境及其文件、命令与网络边界。此资料用于辨认权限执行职责，尚未选择沙箱产品、远程服务或具体跨平台隔离方案。
- 原生子 Agent 使用 `minimax-cn/MiniMax-M3.1-Flash-Preview` 核对了批量精读和审稿补充计算两个情境。协调者据已确认模型保留部分产物与普通文件引用、应用时版本核对、实际使用材料与父任务授权约束；研究产物的复用不要求新增方法目录类别，worker 的旧项目限制也不自动成为原生约束。以上是语义核对，未执行真实任务。

## 声明结构与恢复边界的依据

- [JSON Schema 基础](https://json-schema.org/understanding-json-schema/basics)以可机器读取的 Schema 描述数据结构及校验约束。其结构检查能力可用于参数和结构化交付，不能单凭结构有效证明科研判断成立。具体方言与校验库尚未选择。
- [LangGraph Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)要求恢复关联相应 thread，并说明恢复会重新执行中断所在节点；中断之前的程序可能再次运行。Scholoom 的研究调用、正式决定和变更应用需要在执行引用之外保留共同身份与实际结果，具体实现留给存储和架构决策。
- 同一原生子 Agent 核对了三个不同恢复情境：暂停期间能力原地修改、稿件修改已应用但完成回报未保存、工作台关闭时正式决定等待回复且材料随后更新。由此形成的实际修订绑定、应用情况可查询、决定适用性核对建议见原生内容票第三轮。以上只作语义审查，不构成 SDK 恢复行为或崩溃一致性的运行验证。
