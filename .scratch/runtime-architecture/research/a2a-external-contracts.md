# A2A 一手参考：Agent 发现、任务与外部委托

核对日期：2026-10-18。发布契约以 **v1.0.1** 为基线，GitHub Release 发布于 2026-05-28；开发分支与发布版有差异，不能把开发文档直接当成发布契约。[发布记录](https://github.com/a2aproject/A2A/releases/tag/v1.0.1)、[固定版本规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)

本调查服务于[外部接口决策](../issues/07-external-interfaces-and-extensions.md)，不作产品采纳决定。未安装依赖、运行 SDK 或做互操作实测。

## AgentCard 与发现

AgentCard 描述身份、服务地址、能力、认证方案及 skills。规范定义的发现位置是 `https://{domain}/.well-known/agent-card.json`；注册表和直接配置也是官方文档认可的方式，但规范不规定注册表 API。卡片签名为可选能力，卡片中的声明不代替实际调用时的授权。[Agent Discovery](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/agent-discovery.md)、[规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)

## Message、Task、contextId 与 Artifact

Message 承载指令、澄清等通信；Task 是有唯一 ID 和生命周期的工作单元；Artifact 表达任务交付物。协议允许直接消息响应，也允许形成长期运行的 Task，不能把所有消息往返都等同于新任务。[Key Concepts](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/key-concepts.md)

taskId 由服务端生成；客户端引用已有任务时须遵守其所属上下文，提供不匹配的 contextId 必须被拒绝。contextId 是不透明分组标识，不代表内部 Agent session、项目或凭据控制权。Artifact 的跨任务版本关联不由协议完整规定，不能替代 Scholoom 的成果与版本契约。[规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)、[Life of a Task](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/life-of-a-task.md)

## 补充输入与终态

任务需要输入时进入 input-required，客户端沿相同 taskId 与 contextId 补充输入；auth-required 表示需要额外认证或授权，凭据通过带外方式取得，此状态本身不授予 Scholoom 业务权限。[规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)

进入 COMPLETED、CANCELED、REJECTED、FAILED 终态的 Task 不能再接受消息，服务端返回 UnsupportedOperationError。后续工作形成新 Task；相关工作可沿同一上下文，并按规范建议用 referenceTaskIds 关联旧任务。该关联是建议，不能改写成每次必用的要求。[规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)

## 流式、推送、取消与重试

Streaming 与 pushNotifications 是可选能力。流生命周期与任务生命周期独立；断线后可查询任务，支持流式时可重新订阅，不据此承诺补齐全部遗漏事件。[Streaming & Async](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/streaming-and-async.md)

推送要求至少尝试投递一次，允许重试和在失败后停止，因而不保证至少一次成功送达；客户端应处理重复通知。实现还需核对 webhook 目标、SSRF 风险及回调认证。取消尽力而为，不保证成功；Send Message 的幂等实现是可选能力，不能把 messageId 当成协议保证的业务去重键。[规范](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md)

认证使用 HTTP 机制，领域授权仍由服务端实现；协议不替 Scholoom 规定项目、文献、材料外发及凭据的权限模型。[Enterprise 文档](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/enterprise-ready.md)

## 对 Scholoom 的含义

外部 Agent 可通过 A2A 委托 Scholoom 分析文献、补充输入并取得报告，内部仍走统一 LangGraph harness；内部委派无需经过 A2A。AgentSkill 是对外能力描述，不等于本地 SKILL.md。

A2A Task 可长期运行，但终态不再接收消息；Scholoom 的持续研究任务可在多次外部委托和内部尝试中推进。生命周期不同，需要显式映射，并无架构冲突。Task/context 不等于持续研究任务、Agent session 或执行尝试；工作保存与接续继续沿领域材料和记录，不依赖旧对话。

## 未核实范围

未核实官方 SDK 对所选版本的支持程度、Node/Electron 适配成本及真实客户端互操作。长期工作的实际保存与保留期限、授权撤销效果及 Artifact 版本关联须由服务端明确，不从协议名称推导运行保证。
