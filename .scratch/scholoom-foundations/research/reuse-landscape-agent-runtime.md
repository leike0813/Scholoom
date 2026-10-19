# Agent runtime 与 harness 复用调查

当前路线更新（2026-10-18）：以 [#07](../issues/07-agent-runtime-boundaries.md#answer)为准，统一内置 LangGraph harness，不支持 ACP 外部 Agent。本文 ACP、pi、OpenCode 等调查及原推荐保留为历史候选证据；插件 MCP 是受管理扩展点，Scholoom 对外 MCP 已沿[外部接口决议](../../runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)采纳，A2A 后置；当前未完成接线，不据本报告直接接入服务或执行器。

后续补查：[Codex harness 作为 Agent core](codex-harness-core-reuse.md)。本报告原有 18 项清单未充分覆盖 app-server，补充调查保留为参考。用户于 2026-10-11 在讨论图控制能力后确认维持 LangGraph/LangChain/Deep Agents 原方案，本轮不推进 Codex 主干替换、双层组合或对比原型。

调查日期：2026-10-11（会话日期）\
范围：科研运行时、Agent 协议、能力契约、观测评测与持续任务。\
方法：官方文档、上游仓库源码入口、LICENSE 和发布/维护记录静态调查；未安装依赖、未运行候选 SDK 或原型、未调用模型。文档示例证明公开接口被文档描述，不证明 Scholoom 集成或产品行为已经验收。

## 先读结论

- 保留既定组合：LangGraph 管执行编排/checkpoint，LangChain 供模型与工具循环，Deep Agents 提供可裁剪的 harness 基线。调用入口应落到 Scholoom 内核的统一身份、授权和领域服务。
- ACP、pi SDK 与 OpenCode SDK 的调查展示了不同执行器的权限、事件、取消和恢复差异；本项目已选择单一内置执行基础，不采用这些外部执行接入候选。
- AbortSignal、SDK abort 与图 checkpoint 都不撤销已写文件、数据库提交、外部 API 或供应商侧任务。取消后需核查执行效果；撤销是 Scholoom 领域变更，靠差异/局部恢复规则实现。
- JSON Schema 是能力声明、参数和交付结构的既定事实源。Ajv 可运行时校验，json-schema-to-ts 可从 Schema 推导 TypeScript 类型；不另写一套 Zod Schema。框架若只提供 Zod 入口，应验证 JSON Schema 转换边界，不能手工维护双份定义。
- 默认本地观测先用 OpenTelemetry API/本地导出器；Promptfoo 适合离线/CI 样例评测。Langfuse 是可选观测平台，但自托管 OSS 默认仍有遥测，需显式关闭；云端和评测调用会外发数据。
- 首期不需要 BullMQ 或 Temporal 作为桌面默认后台。单个本机 Node 内核的持续工作先用既定 LangGraph checkpoint、SQLite 和进程监督；只有出现跨进程持久排队、独立 worker、崩溃恢复实证缺口时再评估。

## PRD 需求映射

| 已确认需求 | 可复用部分 | Scholoom 必须拥有的部分 |
| --- | --- | --- |
| 无工作台持续运行、关窗后重接 | LangGraph graph/checkpointer；Node 进程与连接重建 | 内核生命周期、客户端认证、任务身份、重接快照/有界订阅、停止内核语义 |
| 人类介入与正式决定 | LangGraph interrupt/HITL 提供暂停点和恢复值 | 跨 GUI/CLI/Agent 的待决定权威、依据版本、授权人、适用性检查、一次应用 |
| 普通工作和显式科研流程共存 | LangGraph 节点/边/子图；Deep Agents subagent | 区分技术图状态、任务、能力调用、正式 Gate/Decision、科研交付 |
| worker 有边界地并行 | Deep Agents subagent 配置；ACP 后端能力协商 | 父任务与工作包授权取交集、独立审阅、输入/输出/材料引用、结果核验 |
| Skills、能力目录、JSON Schema | Agent Skills 文件约定；Ajv 与类型推导 | 发现/作用域/同名选择、运行授权、能力版本、资源、产物、科研校验 |
| MCP 科研工具；ACP 外部 Agent | 官方 TS SDK 实现协议编解码、transport 和能力交换 | 所有协议方法调用统一领域服务；身份映射、scope 限制、文件/工具准入 |
| 限流、重试、取消、恢复 | SDK 提供 abort、并发和部分 checkpoint | 跨模型/委派/压缩的共同限制、未知结果核查、幂等边界、局部继续 |
| 可观察运行和科学评价 | OTel spans/metrics/logs；Promptfoo/Langfuse 评测辅助 | 本地隐私默认、诊断导出授权、研究质量/实际交付验收、首跑与重试分开 |
| 跨会话、跨引擎承接 | checkpoint 可恢复引擎状态 | 研究事实与产物完整可取回，不把 transcript/checkpoint 当科研权威 |

产品事实来源：[科研 Agent harness 决定](../issues/07-agent-runtime-boundaries.md)、[原生能力契约](../issues/18-native-capability-runtime-and-content.md)、[科研 PRD](../../../docs/prd/research.md)、[数据与运行 PRD](../../../docs/prd/data-and-operation.md)、[约束与验证](../../../docs/prd/constraints-and-validation.md)。既有静态调查：[LangGraph harness](langgraph-harness.md)、[Agent 执行路线](agent-execution-routes.md)、[原生能力内容契约](native-capability-content-contracts.md)、[模型调用控制](model-call-runtime-controls.md)。

## 候选与适用边界（18 项）

Pi 与 oh-my-pi 合为一个谱系比较项；JSON Schema 的 Ajv 与 json-schema-to-ts 合为一套契约工具链。下表不是 18 个并列的主引擎建议。
每项均记录可见能力、接入边界、许可/费用、运行环境、源码入口和维护证据；未找到证据的事项标为未核实。

### 主干：LangGraph / LangChain / Deep Agents

1. **LangGraph.js — 推荐，既定执行主干。** `@langchain/langgraph` 的 StateGraph/functional API 支持确定性与模型节点混排；checkpointer 保存 thread 图状态，interrupt 暂停并可用同一 `thread_id` 恢复，stream API 暴露消息、值、更新和中断。\
   Node 内核合适；React renderer 只消费内核投影，不应运行图。SQLite/持久 adapter 的兼容版本和 Electron 打包待原型。MIT；无框架使用费，模型/存储由选用供应商另计。\
   源码：`libs/langgraph`；[持久化文档](https://docs.langchain.com/oss/javascript/langgraph/persistence)、[interrupt 文档](https://docs.langchain.com/oss/javascript/langgraph/interrupts)、[stream 文档](https://docs.langchain.com/oss/javascript/langgraph/streaming)、[LICENSE](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE)、[发布记录](https://github.com/langchain-ai/langgraphjs/releases)。上游 2026-09 仍有提交，发布页持续更新；该证据不代表 API 不变或已通过 Scholoom 验收。

2. **LangChain.js — 推荐，作为模型/工具 adapter 层。** `@langchain/core` Runnable、ChatModel、tool、message 与 middleware 接口；`langchain` 提供 createAgent 和 integrations。\
   服务端 Node 进程接模型调用；浏览器端不应持有密钥或科研写权限。LangGraph 与 LangChain 组件组合是上游预期，模型 adapter 及供应商能力仍有差异。MIT；代码免费，模型/API 单独计费。\
   源码：`libs/langchain-core`、`libs/langchain`、`libs/langchain-openai` 等；[JS Agent 文档](https://docs.langchain.com/oss/javascript/langchain/agents)、[模型和重试文档](https://docs.langchain.com/oss/javascript/langchain/models)、[LICENSE](https://github.com/langchain-ai/langchainjs/blob/main/LICENSE)、[发布记录](https://github.com/langchain-ai/langchainjs/releases)。

3. **Deep Agents JS — 推荐作裁剪后的 harness 基线。** `createDeepAgent` 返回编译后的 LangGraph graph，可使用同一 checkpoint/stream 能力；subagent、规划、文件 backend、Skills 按需启用。\
   可用 Node 内核；默认 backend 的线程文件状态不是项目目录权威。文件虚拟路径约束不能限制获得 shell 的任意代码。MIT；基础库免费，sandbox/托管后端可能收费或需外部服务。\
   源码：`libs/deepagents`（发布仓库）；[概览](https://docs.langchain.com/oss/javascript/deepagents/overview)、[subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)、[backends](https://docs.langchain.com/oss/javascript/deepagents/backends)、[LICENSE](https://github.com/langchain-ai/deepagentsjs/blob/main/LICENSE)、[发布记录](https://github.com/langchain-ai/deepagentsjs/releases)。2026-10-05 有发布条目，表明维护活跃；框架默认子 Agent 不等于科研工作包授权。

**三者组合关系。** LangGraph 是运行时，不是模型目录或科研系统；LangChain 是模型/工具公共接口和较高层 Agent loop；Deep Agents 建在二者上并返回 LangGraph 图。建议 Scholoom 拥有图构造入口和领域中间件，先复用 Deep Agents 必需模块，不把其通用文件系统、规划或 backend 强制当作领域模型。上游 API 源码调查不等于执行接线已跑通。

### 替代和参考：不再并列增加编排主干

4. **Vercel AI SDK — 仅借鉴 UI stream 协议/React hook，非主编排替代。** `ai` 的 `streamText`/`ToolLoopAgent` 处理模型步骤、工具循环、AbortSignal；`@ai-sdk/react` 的 `useChat` 面向聊天传输/UI，工具审批需前端与后端续接。\
   主运行服务应留 Node，React renderer 可消费流；供应商和浏览器能力由 provider package 决定。Apache-2.0；SDK 免费，Vercel AI Gateway/hosting 可付费且请求数据去配置的 provider。\
   源码：repo `packages/ai`、`packages/react`；[tool approval](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)、[useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)、[LICENSE](https://github.com/vercel/ai/blob/main/LICENSE)、[发布记录](https://github.com/vercel/ai/releases)。会与 LangChain 重复模型/Agent loop；只在 UI 消息转换确有缺口时采用。

5. **Pi / oh-my-pi — 仅借鉴完整嵌入和终端 harness 细节。** Pi 现官方 SDK `@earendil-works/pi-coding-agent` 可在 Node/Bun 进程内嵌 AgentSession、模型、工具、资源发现和持久 session；`session.abort()`、事件订阅、SessionManager 都是该引擎自己的语义。\
   oh-my-pi 是独立分支/实现，SDK 导出更多 coding-agent 工具、MCP 与子 Agent 入口。不是 ACP：嵌入后 Scholoom 接管进程内对象、配置、扩展和会话；ACP 则通过协议连接独立 Agent。Pi 文档标示 SDK Node/Bun，终端工具/PTY 有平台差异，browser UI 并非承诺；oh-my-pi 有本机工具与 native 包，三平台适配需看每个包。\
   主 Agent 已核验 [Pi 根 LICENSE](https://raw.githubusercontent.com/earendil-works/pi/main/LICENSE)：MIT，Copyright 2025 Mario Zechner；本报告调查时 GitHub 页面请求超时。此结论仅覆盖根许可证，Pi 子树、vendored 内容和传递依赖仍待逐项核对。oh-my-pi 根 LICENSE 实读为 MIT，但 vendored/native 子目录须逐项查。SDK：[`pi/packages/coding-agent/docs/sdk.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)、[Pi release](https://github.com/earendil-works/pi/releases)、[oh-my-pi SDK](https://github.com/can1357/oh-my-pi/blob/main/docs/sdk.md)、[oh-my-pi LICENSE](https://github.com/can1357/oh-my-pi/blob/main/LICENSE)、[发布记录](https://github.com/can1357/oh-my-pi/releases)。Pi 发布页显示 2026-10-07 新版本；近期活跃。完整引擎嵌入会重复 Scholoom 已选 Agent loop 与权限模型，故不是备选主干。

6. **OpenCode — 仅作外部完整引擎/服务端 SDK 参考。** `@opencode-ai/sdk` 是对 OpenCode 服务 API 的 typed client；`createOpencode()` 同时启动 server/client，session API 含 list/create/prompt/abort/revert、权限答复和消息流。\
   适合独立 coding agent 产品集成，不是图运行时 SDK，也不是中立 ACP client。OpenCode server 默认依赖 Bun runtime；上游根 `package.json` 使用 Bun scripts/package manager，core 也按 Bun/Node 条件选择部分实现。SDK client 可从 Node 或前端调用 HTTP API，不代表 server 可直接由 Node runtime 启动。MIT；本体免费，模型仍按供应商结算，托管选择可能另有费用。\
   源码：`packages/opencode`、`packages/core`、生成 SDK；[SDK 文档](https://docs.opencode.ai/docs/sdk/)、[server API](https://opencode.ai/docs/server/)、[根 package.json](https://github.com/anomalyco/opencode/blob/dev/package.json)、[core package.json](https://github.com/anomalyco/opencode/blob/dev/packages/core/package.json)、[LICENSE](https://github.com/anomalyco/opencode/blob/dev/LICENSE)、[发布记录](https://github.com/anomalyco/opencode/releases)。近期持续发布；session abort/revert 只定义 OpenCode 自身会话和工作区行为，不代表 Scholoom 领域事务。

7. **Mastra — 必要替代比较，但不推荐换主干。** TypeScript Agent/Workflow 有 branch/parallel、suspend/resume、storage-backed 持久运行及 React/Node 集成；对审批流写法可借鉴。默认 memory store 重启会丢；持久 resume 必须配 storage provider，某些配置需其 server/runtime。\
   Node 为主，React 是外围 UI 集成；Windows/macOS/Linux Electron 组合未在此调查实跑。根目录 LICENSE.md 映射：core 大多 Apache-2.0，`ee/` 下代码需 Mastra Enterprise License，生产使用收费；核心免费。\
   源码：`packages/core`、`workflows`、`ee`；[HITL](https://mastra.ai/docs/agents/human-in-the-loop)、[durable agents](https://mastra.ai/docs/harness/durable-agents)、[仓库许可说明](https://github.com/mastra-ai/mastra#licensing)、[LICENSE.md](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md)、[发布记录](https://github.com/mastra-ai/mastra/releases)。仓库近期活跃。换成 Mastra 会另立 workflow/runtime 与存储约定，收益不足以抵消迁移和耦合。

### 协议、内容与 Schema

8. **MCP TypeScript SDK — 推荐用于科研工具服务适配。** SDK 提供 server/client、tools/resources/prompts、stdio/Streamable HTTP 与认证 helper；它暴露工具协议，不定义 Scholoom 对象权限。\
   当前用于评估插件受管 MCP 接入；Node 内核对外提供 MCP 服务已采纳，不提供任意 MCP 服务的独立配置入口，公共范围以[外部接口决议](../../runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)为准。v2 Node/Bun/Deno；renderer 不应直接访问任意服务。根 LICENSE 当前说明迁移中的贡献按 MIT 或 Apache-2.0 分别适用；按实际发布包/文件检查 NOTICE 和传递依赖。无 SDK 使用费，远程服务可能收费。\
   源码：`packages/server`、`packages/client`；[v2 官方文档](https://ts.sdk.modelcontextprotocol.io/v2/)、[工具调用](https://ts.sdk.modelcontextprotocol.io/v2/clients/calling)、[LICENSE](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/LICENSE)、[仓库与 v1/v2 维护说明](https://github.com/modelcontextprotocol/typescript-sdk)。v2 与 2026-07-28 spec 同步发布，v1 至少 6 个月继续维护；版本迁移是实际成本。

9. **ACP TS SDK — 历史候选，当前不采用。** ACP 定义 client/agent JSON-RPC、初始化能力、session/prompt/progress、permission request、cancel 及可选文件/terminal 操作；`@agentclientprotocol/sdk` 帮忙搭建 TS client/agent。\
   由 Scholoom 启动/连接受管外部 Agent，在 adapter 层把 ACP 事件和 permission request 投影到共同内核；不能假设所有 agent 支持 loadSession、文件方法或相同取消语义。SDK Apache-2.0；协议/SDK 无协议费，外部 Agent 模型费用由用户/provider 承担。\
   源码：[`typescript-sdk`](https://github.com/agentclientprotocol/typescript-sdk)、[ACP v1 overview](https://agentclientprotocol.com/protocol/v1/overview)、[文件系统](https://agentclientprotocol.com/protocol/v1/file-system)、[LICENSE](https://github.com/agentclientprotocol/typescript-sdk/blob/main/LICENSE)、[release](https://github.com/agentclientprotocol/typescript-sdk/releases)。调查时 release 页列至 2026-09-28 的 SDK 发布；SDK README 明示接口仍可能不兼容变更。需固定协议版本并做能力矩阵。

**ACP 与 Pi/OpenCode 的历史比较。** ACP 是跨产品的进程/协议边界，接入方承担协议适配与能力落差；Pi SDK 直接把完整 TypeScript Agent session 引入内核进程，获得深定制同时耦合其事件/session/config/tool 执行；OpenCode SDK 控制一个完整服务端进程和它自己的 session/文件操作。这些差异是 2026-10-11 候选比较的依据；本项目当前按 #07 使用单一内置执行基础，不推进上述接入。工具审批通过不自动授权文件写入。

10. **JSON Schema 工具链：Ajv + json-schema-to-ts — 推荐。** Schema JSON 文件作为单一契约；Ajv 在运行边界编译 validator，`json-schema-to-ts` 的 `FromSchema` 推导 TS 类型，不反向生成第二份运行定义。适用于能力声明、参数、结构化提交、MCP/ACP 边界。\
   Ajv 支持多个 JSON Schema 草案，但类型表达不覆盖全部运行时语义，声明 `$ref`、format、union 等要在相同样例集检查。Ajv MIT；json-schema-to-ts MIT；npm 包免费。Node runtime 首选；renderer 可使用受限 validator bundle，但保持领域权威在内核。\
   源码：[Ajv](https://github.com/ajv-validator/ajv) 与 [json-schema-to-ts](https://github.com/ThomasAribart/json-schema-to-ts)；[Ajv TS 文档](https://ajv.js.org/guide/typescript.html)、[Ajv LICENSE](https://github.com/ajv-validator/ajv/blob/master/LICENSE)、[json-schema-to-ts LICENSE](https://github.com/ThomasAribart/json-schema-to-ts/blob/main/LICENSE)。Ajv 有持续发布/维护记录；json-schema-to-ts 维护节奏和 TypeScript 边缘能力仍需以选定 tag 核对。

11. **Agent Skills 规范 — 推荐作为方法包格式，不能替代能力 Schema。** `SKILL.md` frontmatter + Markdown body + scripts/references/assets，支持渐进发现/加载；Skill 说明研究方法，不天然声明科研交付完整契约、授权和正式状态。\
   实现可采用目录扫描/按需读取，不必先引入完整 SDK。Node 文件访问由内核/受管资源层控制；skill 脚本不是沙箱。规范 repo 按许可证文件分发；Skill 内容由各发布者单独许可，frontmatter `license` 只描述其内容许可。标准本身免费。\
   [规范](https://agentskills.io/specification)、[规范仓库](https://github.com/agentskills/agentskills)、[LICENSE](https://github.com/agentskills/agentskills/blob/main/LICENSE)。规范与实现仍演进，字段支持有宿主差别；项目已确认标准 Skill 与独立能力入口并存。

### 观测、评测与数据外发

12. **OpenTelemetry JS — 推荐作本地 instrumentation API，collector/exporter 按用户选择。** Node SDK 能记录内核 trace/metric/log；Browser SDK 适用于 renderer 的有限 UI telemetry，但不得带论文正文、凭据或 prompt 默认上传。默认 console/in-memory exporter 不要求 SaaS；OTLP exporter 会把属性发送到配置 endpoint。\
   Apache-2.0；库免费，后端自托管或商业服务另计。源码：`api`、`sdk-trace`、`sdk-trace-node`、`sdk-trace-web`；[JS 支持范围](https://opentelemetry.io/docs/languages/js/)、[Node 入门](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)、[LICENSE](https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE)、[发布记录](https://github.com/open-telemetry/opentelemetry-js/releases)。\
   上游发布与 JS SIG 活跃；官方明确不维护浏览器完整支持名单。GenAI semantic conventions 与 provider instrumentation 不一致处需用本地领域事件补足。

13. **Promptfoo — 推荐作离线/CI eval 工具，受限用于运行时追踪。** YAML/JSON/JS 测试矩阵、provider、assertion、grader、red-team 和 OTel trace eval；Node CLI/library，可把结果本地保存，也可主动 share/Cloud 上传。执行时会调用配置的模型/provider，不能声称“本地 eval”就代表数据未发给模型。\
   顶层 LICENSE 实读 MIT；商业/Cloud 功能及扩展另按该功能条款复核。免费本地运行；Cloud/self-host UI/高级功能的免费/付费界线须按当期报价确认。\
   源码：`src`、`site/docs`；[Node package](https://www.promptfoo.dev/docs/usage/node-package/)、[tracing](https://www.promptfoo.dev/docs/tracing/)、[sharing](https://www.promptfoo.dev/docs/usage/sharing/)、[data handling](https://www.promptfoo.dev/docs/red-team/troubleshooting/data-handling/)、[LICENSE](https://github.com/promptfoo/promptfoo/blob/main/LICENSE)、[发布记录](https://github.com/promptfoo/promptfoo/releases)。近期有维护活动；官方文档当前要求较新 Node，实际 LTS/package pin 需复核。提示/结果可能写入本地 DB、报告或发到配置服务。

14. **Langfuse — 仅选配研究 trace 浏览和协作 eval，不作为桌面默认依赖。** Langfuse JS SDK 基于 OTel，可记录 trace/observation、评分和 prompt；Cloud 和 self-host 使用相似 SDK。官方称 OSS core MIT、可免费自托管；Enterprise self-host 的部分功能收费，Cloud 有免费层/付费量级。\
   自托管 OSS 默认会向 PostHog 发聚合使用遥测，`TELEMETRY_ENABLED=false` 可退出；Cloud 将 trace 内容送服务商。源码：`web`、`worker`、SDK；[SDK](https://langfuse.com/docs/observability/sdk/overview)、[自托管遥测](https://langfuse.com/self-hosting/security/telemetry)、[自托管许可/价格](https://langfuse.com/pricing-self-host)、[LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE)、[release](https://github.com/langfuse/langfuse/releases)。\
   仓库持续活跃；核心产品自托管不等于完全无外发。另会增加 Docker/Postgres/ClickHouse 运维负担，不符合个人桌面默认。

**外发边界（适用所有服务）。** 数据经过模型 provider 属于模型发送策略；OTel exporter、Langfuse、Promptfoo Cloud、error reporting 是另一条独立出口。只有用户主动启用/选择后，才发送相应诊断；提示/研究正文默认留本机。允许上传前应给出目的地与字段范围，导出可审阅。Langfuse telemetry 需默认关闭，Promptfoo share/hosted generation 和任何 cloud evaluation 单独算远端调用。

### 后台队列/耐久执行（只比较必要性）

15. **p-queue — 推荐候选，仅用于 Node 内存中的并发/优先级闸门。** Promise queue、concurrency/interval cap、暂停与任务状态；重启不持久化，也不是跨执行器业务队列。MIT；无服务费。\
   Node TypeScript/ESM，官方 package 要求现代 Node；浏览器/Electron renderer 不作为调度权威。源码：[repo](https://github.com/sindresorhus/p-queue)、[LICENSE](https://github.com/sindresorhus/p-queue/blob/main/license)、[releases](https://github.com/sindresorhus/p-queue/releases)。维护记录活跃；与既有 LangChain AsyncCaller/应用级统一限流可能重复，先确认是否有真实共用队列缺口。

16. **Bottleneck — 仅借鉴 provider 限速器，不建议现在引入。** `maxConcurrent`、`minTime`、reservoir 和调度；集群共享限流使用 Redis，且 README 明确集群模式不跟踪完整 queue contents。\
   MIT；库免费，Redis 自运维另有成本。Node；三平台本机行为需实际试。源码：[README](https://github.com/SGrondin/bottleneck)、[LICENSE](https://github.com/SGrondin/bottleneck/blob/master/LICENSE)、[releases](https://github.com/SGrondin/bottleneck/releases)。有发布记录但活跃程度低于核心 LangGraph 工具链；仅当 provider quota 与简单并发闸门不能表达时比较。

17. **BullMQ — 不推荐桌面默认。** Redis-backed durable jobs、retry/delay/scheduler/flow、Worker 并发；Node worker可重启后消费，需 Redis 持久运行及锁/队列运维。\
   核心 MIT 免费，BullMQ Pro 扩展收费。源码：[README](https://github.com/taskforcesh/bullmq)、[LICENSE](https://github.com/taskforcesh/bullmq/blob/master/LICENSE)、[releases](https://github.com/taskforcesh/bullmq/releases)。维护活跃；强行放入单用户 Electron 默认会新增 Redis 安装、启动、升级、备份和三平台支持面，重复 LangGraph/SQLite 持久执行职责。以后需要多 worker/跨进程可靠队列再复评。

18. **Temporal — 仅当跨进程耐久执行成为独立需求时复评。** TypeScript SDK 的 Workflow/Activity、服务端 event history、signal/cancel/retry 支持长时耐久 orchestration；应用工作进程与 Temporal server/service 分离。\
   SDK/server 开源免费自托管，Temporal Cloud 按用量付费；官方服务有数据库、运维、部署要求。Node worker；对本地用户增加常驻服务、升级和三平台发行复杂度。\
   TS SDK Apache-2.0：[TypeScript SDK](https://github.com/temporalio/sdk-typescript)、[LICENSE](https://github.com/temporalio/sdk-typescript/blob/main/LICENSE)、[self-host guide](https://docs.temporal.io/self-hosted-guide)、[生产部署](https://docs.temporal.io/production-deployment)。上游仍活跃，服务生命周期和 API 健康需独立评估。Temporal activity retry 仍不回滚外部副作用，必须设计幂等键/核查。

**队列判断。** Scholoom 的“持续任务”是产品任务生命周期，不自动等于需要独立消息队列。LangGraph checkpoint + 当前 SQLite 持久化策略 + Node 进程监督先满足核心路径；p-queue 只负责进程内并发，不能被称作 durable queue。BullMQ/Temporal 只有在目标用户、任务量、恢复 SLO 和本地安装成本被原型证明后才形成真实备选。

## 取消、checkpoint 与回滚边界

- `AbortSignal` 是协作式中止通知。库/工具必须接收并处理它；同步阻塞 CPU、子进程、未传 signal 的 fetch/tool 或远端服务不必然停止。provider 中止请求也不保证服务端停止推理/计费。
- LangGraph interrupt 让 graph 在 checkpointer 记录状态后暂停；恢复时中断节点从头重跑。中断前已发生的副作用可能重复，所以前置写入必须幂等，或将不可逆副作用移到确认之后并记执行结果。
- checkpoint 是执行状态快照，不是业务数据库事务、文件系统快照或外部系统补偿日志。流程恢复不等于自动 undo。
- ACP cancel、Pi `abort()`、OpenCode `session.abort()` 描述各自 Agent run/session 的终止请求。适配层要实测请求返回、子进程退出、tool 是否完成、文件是否变更；能力协商只能说明协议面可用。
- 对用户可见的取消结果应分开保存：后续调度已停止、仍在途/状态未知、已完成的副作用与文件差异、已保存的研究成果。局部 undo 通过 Scholoom 撤销记录保护之后的新编辑，不能抹掉无权回滚的外部效果。
- 这些边界来自官方恢复/取消文档和既定数据政策的交集；未执行 runtime crash/cancel experiment。

## 建议的 4 项原型验证及可观察验收

1. **LangGraph checkpoint + 人类决定 + SQLite。** 运行图到正式决定节点、关闭内核进程、重启后重新读取待决定事项并提交一次答复。验收观察：task/decision identity 稳定；重复答复只应用一次；checkpoint 恢复不重复已提交文件/DB 写入；研究事实不依赖完整 transcript。
2. **取消和副作用现实边界。** node/tool 分别进行延迟模型调用、写文件、受管子进程和可控 HTTP stub；在每个阶段取消，随后重启并查询结果。验收观察：scheduler 停止继续派生工作；signal 到达各边界；已写内容仍明确显示；未知远端结果不盲重试；undo 保留取消后人工编辑。
3. **ACP adapter 与内核授权。** 至少接一个实现 ACP 的可用 Agent，探测 initialize capabilities、session/load、permission、file/terminal、stream 和 cancel。验收观察：能力缺失时明确降级；agent 的文件/tool 请求被 Scholoom task policy 限制；事件/权限来回投影完整；disconnect/restart 后可查询当前任务；取消是否退出进程可观测。
4. **JSON Schema 单源契约适配。** 对一份能力 manifest/输入/交付 Schema，从文件加载、Ajv 校验、ts 类型推导，再将同一 Schema 暴露到 LangGraph interrupt response schema、MCP tool schema 与 ACP 参数边界。验收观察：合法/非法样本三边一致；不维护手写 Zod 镜像；如 SDK 强制 Zod，转换损失/默认值/union差异可在 CI 失败并可报告。

若时间只允许先做两个，优先 1 和 3：它们最能验证既定引擎实际适配与“内置/外部引擎共用领域规则”的设计。原型不能替代真实研究任务质量验证。

## 自研无法省掉的领域职责

- 研究任务、会话、能力调用、Agent、工作流步骤、正式决定和 checkpoint 的身份/关系；各事实的权威表。
- 本地内核无工作台运行、认证、重连、快照与通知边界；Electron main/renderer 不能成为任务权威。
- 内容 discovery 与作用域、同名来源选择、版本锁定、渐进读取；Skill/manifest 声明不授予文件/网络/程序权限。
- worker 工作包和权限取交集；ACP capabilities 与各 SDK tool definitions 均不能替代执行授权。
- 项目文献/数据/稿件/研究事实关系、材料版本引用、逐批交付检查和未完成情况；checkpoint 不能代替可复取科研记录。
- 人的正式判断跨入口持久化、决定适用性、单次应用；图结束、LLM 答复和工具审批均不等于研究结论成立。
- 文件当前内容核对、局部修改、后续编辑保护、差异、撤销与效果核验。数据库事务和文件系统写入分属边界，无通用跨系统回滚。
- 跨模型一致的重试次数、并发/速率限制、用量未知、未知效果核查、受管进程停止和错误归因。
- 研究质量、证据/引用正确、分析和图件有效、失败/部分交付、重试后结果与科研限制的验证。基础设施“成功”不能证明交付成立。
- 本地诊断和远端数据出口的透明度、字段最小化、显式启用和导出检查；eval/trace 平台不能替 Scholoom 决定哪些材料可发给谁。

## 已核实与未核实

- 本报告调查到官方文档、上游 source/README 入口、项目 LICENSE 文件页面和 GitHub releases/commits 页面；具体证据链接附在对应候选处。对可能切换维护的主干内容，优先用了可定位的官方 repo/tag 页面；LangGraph docs 会随版本滚动，正式依赖需在实施时按锁定版本重查。
- Pi 根 LICENSE 已由主 Agent 通过原始文件核为 MIT（Copyright 2025 Mario Zechner）；Pi 子树、vendored 内容和传递依赖仍未核。oh-my-pi 仓库含 vendor/native 代码，单看根 MIT 不足以替代逐路径许可清点。MCP SDK 的 LICENSE 正处贡献许可迁移说明，不能把所有历史文件概括成一个 SPDX 标签。Mastra LICENSE.md 是路径映射而非单一许可。
- 本报告没有核对所有传递依赖 SPDX、所有商业产品合同/价格、所有协议修订和平台支持矩阵；没有运行 Linux、Windows 或 macOS，也没有验证 Electron 打包、原生模块、长时可靠性、网络出口、数据删除或取消时序。
- 没有调用模型、申请凭据、安装包、运行服务器、改动既有文件或提交。候选行为和采购/许可边界需要在具体 package/tag、发行组成与商业使用方式确定后复核。
