# Codex harness 能否作为 Scholoom Agent core

调查日期：2026-10-11。用户提出直接移植 Codex harness 的候选；本轮只读官方文档与开源源码，没有安装、启动 Codex、调用模型或修改既有选型。

## 当前决定

用户于 2026-10-11 在讨论 LangGraph 图控制能力后确认维持原方案：Agent Core 基于 LangGraph 实现，沿用 LangChain 与 Deep Agents 的既定组合，依据仍为 [#07](../issues/07-agent-runtime-boundaries.md) 与 [#25](../issues/25-harness-business-integration.md)。Codex harness 不作为本轮内置主干，也不推进 Codex 与 LangGraph 的双层组合或对比原型。以下调查保留为备选路线的参考，不代表当前实施建议。

## 备选路线的调研判断

可以复用，而且应作为内置执行引擎的认真候选。对个人项目，优先比较由 Node 内核监督现成 Codex app-server 的方案；不建议先把 Rust core 改写为 TypeScript，也不建议未经接口验证就维护整个 fork。

使用上游预编译 Rust 二进制不要求 Scholoom 自己转写 Rust。TypeScript/React/Electron 与独立 Node 内核仍可保留，变化发生在模型与工具循环的执行后端。

这重新打开的是 LangGraph/LangChain/Deep Agents 的执行基础选择。既有决定见 [#07](../issues/07-agent-runtime-boundaries.md)、[#25](../issues/25-harness-business-integration.md)；讨论候选本身不改变这些决定。先前复用总览未充分覆盖 Codex app-server，是本轮应补的缺口。

## 核实来源

官方产品资料按 OpenAI Docs 检索并打开；源码以 `git ls-remote` 返回的 main HEAD `cc7ba33601286a751477832b01de7b6f8de0dd9c` 固定。该点不等于当前已发布稳定版，原型应另固定实际发行物及其 schema。

| 来源 | 核实内容 |
| --- | --- |
| [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform) | 官方明确开放 harness 可用于自有产品；应用拥有业务上下文、规则与工具，Codex 提供 Agent loop。不能由示例推断科研效果或全部 PRD 已覆盖。 |
| [App-server 文档](https://learn.chatgpt.com/docs/app-server) | 本地 Codex 进程、双向协议、会话/轮次、流式事件、审批、中断、MCP/Skills 与动态工具；字段和传输成熟度分别标记。 |
| [TypeScript SDK 源码说明](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/sdk/typescript/README.md)、[exec.ts](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/sdk/typescript/src/exec.ts) | TS SDK 是 CLI wrapper，实际 spawn `codex exec --experimental-json`，经 stdin/stdout 取事件；并非在 Node 内运行纯 TS harness。 |
| [codex-core Cargo.toml](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/codex-rs/core/Cargo.toml)、[lib.rs](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/codex-rs/core/src/lib.rs) | 核心是 Rust library，关联模型/provider、配置、工具、进程与沙箱、会话历史、Skills、MCP、状态等 workspace crates。不是可简单拷贝的一份独立 TS 循环。 |
| [thread 协议源码](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/codex-rs/app-server-protocol/src/protocol/v2/thread.rs)、[turn 协议源码](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/codex-rs/app-server-protocol/src/protocol/v2/turn.rs) | thread 创建可配置 provider/model、base/developer instructions、cwd、审批和动态工具；turn 可选模型，steer 追加输入。准确能力按固定版本生成 schema。 |
| [provider 源码](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/codex-rs/model-provider-info/src/lib.rs)、[官方兼容要求](https://learn.chatgpt.com/docs/enterprise/gateway-compatibility) | 自定义 provider 可配 endpoint、凭据和重试；该源码的通用 WireApi 只有 Responses，`chat` 明确拒绝。Chat Completions 或 Anthropic Messages 可用不证明 Responses 兼容。 |
| [根 LICENSE](https://github.com/openai/codex/blob/cc7ba33601286a751477832b01de7b6f8de0dd9c/LICENSE) | Apache-2.0。允许在遵守条件下复用/修改；第三方代码、NOTICE、随包二进制单独清点。源码授权不授予模型、托管服务、账户或品牌权利。 |

## 三种复用路线

| 路线 | 省去的工作 | 新增维护责任 | 本轮建议 |
| --- | --- | --- | --- |
| Node 监督上游 app-server，经协议接入 | 模型/工具循环、上下文管理、会话历史、流式事件、基础审批与执行机制 | 版本与平台二进制、配置隔离、协议适配、领域工具和状态映射 | 优先验证；可成为主执行引擎，不能只按外部编程工具评估 |
| Rust fork 或直接嵌入 codex-core | 复用已有 Rust 实现，并能深改内部行为 | workspace crate/build 同步、源码补丁、平台沙箱与协议变化 | 只有公开接缝存在具体且不可绕开的缺口时才考虑 |
| 将核心改写为 TypeScript | 借用已解决问题的设计、部分算法思路 | 重新实现与验证上下文、流、工具执行、恢复、安全和供应商行为 | 不建议作为省精力的首选；无法自动继承原 harness 的质量 |

Codex app-server 的产品接入面比 TS SDK 更贴合长会话、实时审批和追加指令；SDK 适合较窄的程序化执行。两者都调用现成 Codex 执行器，不能因为 SDK 是 TS 就把它当纯 TS runtime。

## Scholoom 中的分工建议

```text
工作台 / CLI
    ↓
Scholoom Node 内核：科研任务、授权、材料、交付、正式决定
    ↔ Codex adapter ↔ 受监督的 Codex app-server
                         ↓ MCP 或已核版本的动态工具
                   Scholoom 领域能力与受管科研执行
```

Codex 的 thread/turn 是执行会话与轮次；它们与科研任务、能力调用及稿件版本有关联，但不能直接同义化。科研事实仍保存在共同领域服务与开放工件中。跨引擎续做沿当前材料、目标、结果与下一步，不要求翻译完整 Codex 内部历史。

标准研究方法可由 Skills 与 instructions 提供；文献检索、读取、引用、产物保存和正式事项接领域工具。固定源码支持自定义基础及开发者指令，故不能简单以默认定位是 coding agent 判定不适合科研；实际研究质量仍需任务对照。

如果采用 Codex 主干，不同时让 Deep Agents 再拥有同一会话的模型循环。显式科研流程仍要由共同内核承接；是否保留 LangGraph 仅管理确有需要的流程，应在代表性任务验证后判断，不能先默认再叠一层引擎。

## 影响选型的限制

1. **多模型兼容是首要未知。** 不限于 OpenAI 品牌，但通用自定义 provider 要兼容当前 Responses 行为：流式事件、工具调用、推理项和续接。需要网关转换的模型会增加成本；验证不能止于返回一句文本。针对 provider 的模型目录和特殊接入也要单独核实。
2. **应用级模型控制不能只套在 LangChain 外。** Codex 自行请求模型，包括压缩、重试与子执行。PRD 规定的共同并发、发送授权、额外重试上限与显式模型切换必须覆盖这些请求。源码有 request/stream retry 配置，但未证明各路径已满足共同上限，也未证明应用能通过公开接口拦截每次请求。必要时比较已有兼容网关的控制能力，不能预先声称需要自造网关。
3. **批准工具操作不确认科研结论。** command/file/MCP 审批和待正式决定事项分别映射。批准 shell 不自动允许读取全部文献并外发；只接领域 MCP 工具也不能限制已经授予的 shell/file 能力。工具权限、文件和网络边界需共同验证。
4. **会话恢复不等于完整任务恢复。** `thread/resume` 续接历史，不能据此承诺服务崩溃后安全重放所有副作用，或恢复仍存活的科研子进程。成果、未知效果及局部续做按现有 PRD 处理。
5. **协议成熟度分项核查。** 官方文档将 WebSocket transport 标为 experimental/unsupported；动态工具也要求 experimental API。首个本地原型优先 stdio，领域工具先比较 MCP，不把已有 Scholoom WebSocket transport 与 Codex 私有 wire 格式直接等同。
6. **advisor 时机仍需验证。** `turn/steer` 可追加当前轮输入，不能直接证明具备生成文本边界的同步回调或保证结束前处理 advisor 建议。文风监督的有限等待、自动继续和避免重复触发由实际接线确认。
7. **进程生命周期由 Node 内核拥有。** GUI 关窗后 Node 与 app-server 继续运行可以作为设计方向；尚未验证 stdio 关闭、app-server 退出、审批等待和内核重启时的具体行为。不能拿 CLI 会话持久化证明这些场景已覆盖。
8. **账户接入与源码许可分开。** 官方 [Auth endpoints](https://learn.chatgpt.com/docs/app-server#auth-endpoints) 对既有本地/开源应用说明可继续使用 app-server authentication，并建议迁往 Sign in with ChatGPT；该认证路径不许可用于商业或托管服务。这是账户/服务边界，不能解读为 Apache-2.0 源码禁止商业使用。官方另有 [Sign in with ChatGPT 的 app-server 接线](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)。Scholoom 的个人、本地、AGPL 范围与未来收费或托管形态应分别核对，不能默认源码复用会自动附带任意订阅登录或计费权利。

## 最小对比原型

同一研究任务比较 Codex app-server 与既定 LangGraph/Deep Agents 基线，而非两个完整产品：

- 从已有材料读取与检索，按 Skill 生成带来源的分析或稿件修改；领域工具实际落盘并读回。
- 代表性的非 OpenAI 模型完成多轮工具调用；切换角色/模型、压缩与失败重试仍符合共同政策。
- 人工追加指示、待决定事项、GUI 断线、取消和进程重启；已有成果保留，未知写入不盲重放。
- 开启一次文风 advisor，确认建议进入写作执行、结束前有限等待与停止规则。

比较为实现这些行为需要的应用代码、必须改的上游源码、协议实验功能、安装资源与运行效果。公开接口足够且模型兼容可接受时，Codex 主干可能更省个人维护；若为了科研契约持续改 Rust 内部或维护大范围 provider 转换，LangGraph 系列的可控性可能更有价值。

## 本轮边界

仅静态调查。未运行现成 Codex、未做真实模型/网关兼容测试、未评科研质量、未验三平台分发，未审核完整依赖树。产品文档是移动来源，与固定 main 源码不等于同一发行版；实际采用前核发布版本、schema 和声明。尚未改变 PRD、依赖或已确认决定。
