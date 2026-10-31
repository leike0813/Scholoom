# Harness 请求正文大小与上下文预算

核查日期：2026-10-31。方法：先核本地参考版本、已安装包及调用路径，再读取官方上游固定源码和当前官方文档正文。仅静态调查，没有安装依赖、启动服务、运行 Agent／模型、读取凭据或修改生产代码。版本与路径限定如下；“未见”仅指这些核查路径，不表示全库或所有部署永无此限制。

## 问题与分类

| 类别 | 本文判断对象 | 不可替代的区别 |
| --- | --- | --- |
| a：客户端出站正文 | harness 在序列化并发送 LLM HTTP 请求时，是否按整包字节数硬性拒绝 | JSON 编码后大小；若支持压缩，还须区分压缩前正文与线上字节 |
| b：模型上下文预算 | token 窗口、自动摘要／裁减、输出与推理空间预留 | 不等于 HTTP body 字节上限，也不保证整个标称窗口都供输入使用 |
| c：输入与资源边界 | 入站 Web／MCP、文件、单个工具结果及诊断附件限制 | 可限制某类内容，不能据此推断整个 LLM 请求上限 |
| d：上游 HTTP 限制 | 供应商 API、云平台或代理拒绝过大的 HTTP 请求 | 不等于 harness 本地发送前的硬上限；兼容协议不代表同一供应商限制 |

## 核查版本

本仓库基线为 `ca3b27285eef58f753cb6744a7756febb0124da2`。`references/` 中本次四个对象只有 Codex 源码目录；其余通过公开上游获取到工作区外的临时目录，没有更新参考目录。

| 对象 | 固定版本／commit | 范围 |
| --- | --- | --- |
| Codex 本地参考 | `e790ce271749ce431e446a9e2cc66485fe60f931`，2026-10-16 | `references/codex`；核查时子仓库工作区干净 |
| Codex 当前官方源码 | `67f0994b532b8740f14b5b738af7b7b2a915b1d6`，2026-10-31 | Responses HTTP 编码、传输、模型窗口定义及客户端 |
| Gemini CLI | `6814e00d6b148c3a1d57244d5d7040f7c541009d`，2026-10-30 | package.json 版本字段为 `0.67.0-nightly.20261020.gb041de017`；以下以 commit 为准；直接 API 使用锁定的 `@google/genai` 1.30.0 |
| OpenCode | `a66964ee9fa151ab81f5f60405bc4e56c6480549`，2026-10-31 | 根 package.json 版本 `2.2.5`；核查当前 `packages/core`／`packages/ai` 路径 |
| Claude Code 公开仓库 | `80c6959d28c4c30ecd14fc1cdf172f19d9adad81`，2026-10-31 | CHANGELOG 最新标题 `2.1.316`；公开仓库不能提供核心出站实现；没有运行该版本二进制 |
| 本地 LangChain 系列 | `deepagents` 1.15.0、`langchain` 1.5.16、`@langchain/core` 1.2.17、`@langchain/anthropic` 1.5.12；Anthropic SDK 0.122.0 | `pnpm-lock.yaml` 与已安装包；读取发布 JS／source map，未执行包代码 |

## 对比结果

| Harness | a：所查 LLM HTTP 发送路径 | b：已确认的 token 机制 | c：容易误认成整包出站限制的机制 |
| --- | --- | --- | --- |
| Codex | Responses 请求经 JSON 编码、可选 zstd、交给 HTTP transport；这些路径未见统一出站 body 字节硬上限。[C1–C2] | 模型定义默认可用窗口比例 95%；自动压缩阈值为配置值与窗口 90% 的较小值；官方配置分别暴露 token 压缩阈值和 context window。[C3] | `response_body_limit_bytes` 限接收的响应；`project_doc_max_bytes` 限构建指令时读入 AGENTS.md 的字节数。[C2–C3] |
| Gemini CLI | chat → content generator；直接 API → Google SDK，Code Assist → `JSON.stringify(req)` 后 POST；所查路径未见统一出站 body 字节硬上限。[G1–G2] | 常用 Gemini 的窗口表为 1,048,576 tokens；传统 chat compression 默认在窗口 50% 触发、可配置；发送前还有剩余 token 检查。不能声称默认会保留 800k+ tokens。[G3] | `processSingleFileContent` 对单文件检查 20 MiB；这是该读取工具的边界。[G4] |
| OpenCode | 当前共享 HTTP transport 编码完整 JSON，经 `jsonPost` 发送、支持压缩；所查路径未见整包统一出站 body 字节硬上限。[O1] | 自动压缩默认保留有效输入窗口 15%、至少 16k tokens；另按剩余窗口拟合输出 token 数。[O2] | **存在出站内容的局部字节治理**：累计图片载荷超过 25 MiB 时移除旧图至 15 MiB；不是整个序列化 body 的拒绝阈值。websearch 的 MCP 响应另限 256 KiB。[O3–O4] |
| Claude Code | **核心实现未公开，本地是否存在任意整包 cap 不可知。** 所查公开文档没有确立 256 KiB 本地出站 cap；不能据此证伪闭源实现存在其他 cap。[A1–A2] | 官方 model-config 写明原生 1M 模型默认约 967k tokens 自动压缩，可调整压缩窗口，且有模型／平台例外。[A3] | 错误文档中的 `.mcp.json` 2,097,152 bytes 检查是配置文件读取限制；不代表 LLM HTTP body。[A2] |

## 源码与文档证据

### Codex

- **C1：编码与 endpoint。** 当前 commit 的 [`codex-rs/codex-api/src/endpoint/responses.rs:70–95,123–150`](https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/codex-api/src/endpoint/responses.rs#L70)：`stream_request` 调 `EncodedJsonBody::encode`，`stream_encoded` 设置 `/responses` 与请求压缩。当前 [`http-client/src/request.rs:21–28,160–242`](https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/http-client/src/request.rs#L21) 的 `encode`／`prepare_body_for_send`／`prepare_encoded_json` 直接编码并可选压缩，没有整包超限拒绝分支。本地参考同路径、同组方法也未见此检查。
- **C2：发送与响应方向。** [`http-client/src/transport.rs:76–117`](https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/http-client/src/transport.rs#L76) 的 `send` 把准备后的 body 交给客户端；`execute`／`stream` 对 `response_body_limit_bytes` 的使用位于接收响应路径（179 行起）。字段定义也明确为响应上限，不能读成出站上限。
- **C3：token 与读入限制。** [`protocol/src/openai_models.rs:399–400,552–573`](https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/protocol/src/openai_models.rs#L552) 的 `usable_context_window`／`auto_compact_token_limit` 分别计算比例与 token 阈值。[当前官方配置正文](https://learn.chatgpt.com/docs/config-file/config-reference) 1171–1174 行区分 `model_auto_compact_token_limit` 与 `model_context_window`；1265 行将 `project_doc_max_bytes` 定义为 AGENTS.md 读入量。

### Gemini CLI

- **G1：harness 发送。** [`packages/core/src/core/geminiChat.ts:1220`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/core/geminiChat.ts#L1220) 交给 `generateContentStream`；[`core/contentGenerator.ts:385–415`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/core/contentGenerator.ts#L385) 使用 `GoogleGenAI.models`。[`code_assist/server.ts:413–440,471–489`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/code_assist/server.ts#L413) 的 `requestPost`／`requestStreamingPost` 直接将 `JSON.stringify(req)` 作为 body。没有在这些方法中发现按整包字节拒绝的逻辑；没有穷尽所有认证库与代理实现。
- **G2：固定 SDK 的实际 HTTP 边界。** [`googleapis/js-genai` v1.30.0 `src/_api_client.ts:341–377,405–433,592–598`](https://github.com/googleapis/js-genai/blob/v1.30.0/src/_api_client.ts#L405) 的 `request`／`requestStream` 将 body 放入 RequestInit，`apiCall` 调 `fetch`；所查发送方法未见统一字节检查。SDK 证据仅补足直接 API 路径，不证明所有后端无上限。
- **G3：窗口与压缩。** [`core/tokenLimits.ts:20–37`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/core/tokenLimits.ts#L20)；[`context/chatCompressionService.ts:45,503–509`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/context/chatCompressionService.ts#L503)；[`core/client.ts:723–749`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/core/client.ts#L723)。50% 是该 compression service 的默认值，配置和其他 context 管理路径可能不同。
- **G4：单文件。** [`utils/constants.ts:12`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/utils/constants.ts#L12) 定义 20；[`utils/fileUtils.ts:602–638`](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/core/src/utils/fileUtils.ts#L602) 按 `stats.size / (1024 * 1024)` 检查。

### OpenCode

- **O1：完整 HTTP body。** [`packages/ai/src/route/transport/http.ts:35–87`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/ai/src/route/transport/http.ts#L35) 的 `bodyWithOverlay`／`jsonRequestParts`／`httpJson.prepare`；[`protocols/shared.ts:427–445`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/ai/src/protocols/shared.ts#L427) 的 `jsonPost` 将 bodyText 或压缩字节交给 HTTP client。这里没有整包大小拒绝；不能扩展为全部插件、传输及部署均无 cap。
- **O2：token 预留。** [`packages/core/src/session/compaction.ts:130–136,1135–1142`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/core/src/session/compaction.ts#L1135) 的 `calculateCeiling`；[`session/model-request.ts:50–60,90–98`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/core/src/session/model-request.ts#L90) 的 `outputLimit`。这些数字的单位是 tokens。
- **O3：局部出站图片裁减。** [`session/model-request.ts:44–45,195–220,310`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/core/src/session/model-request.ts#L195) 的 `boundImages` 对图片载荷表示的大小计数并替换旧图，未计算完整最终 JSON body。它说明成熟 harness 会做字节治理，但不支持“统一 256 KiB 整包硬限”的推论。
- **O4：MCP 响应。** [`plugin/websearch/mcp.ts:7,55–59`](https://github.com/anomalyco/opencode/blob/a66964ee9fa151ab81f5f60405bc4e56c6480549/packages/core/src/plugin/websearch/mcp.ts#L55) 将 `MAX_RESPONSE_BYTES = 256 * 1024` 交给 `collectBoundedResponseBody`，方向为工具服务返回客户端。

### Claude Code：公开文档与未知实现

- **A1：版本范围。** [固定公开仓库](https://github.com/anthropics/claude-code/tree/80c6959d28c4c30ecd14fc1cdf172f19d9adad81) 与 [CHANGELOG](https://github.com/anthropics/claude-code/blob/80c6959d28c4c30ecd14fc1cdf172f19d9adad81/CHANGELOG.md#L3) 不能代替核心请求构造、序列化和发送源码，故不能确认或排除其中存在发送前 cap。
- **A2：32 MB 文案的证据边界。** [官方 errors 正文 `Request too large`](https://code.claude.com/docs/en/errors#request-too-large) 2308–2317 行仍写 API 的 32 MB，并明确描述 API 拒绝后，Claude Code 测量会话、移除图片／文档后重试或终止的处理。它没有证明本地在发送前按 32 MB 拒绝。该页 `Can't read .mcp.json` 的大小检查则属于配置文件读取。
- **A3：大窗口。** [官方 model-config 的默认压缩阈值](https://code.claude.com/docs/en/model-config#default-auto-compact-thresholds) 正文写原生 1M 模型默认约 967k tokens 压缩；[压缩窗口配置](https://code.claude.com/docs/en/model-config#auto-compact-window) 与模型窗口也有区别。这里是官方行为说明，没有通过闭源实现或真实调用复验。

## d：当前供应商 HTTP 限制，独立记录

| 供应商／路径 | 当前实际打开的官方正文 | 结论边界 |
| --- | --- | --- |
| Anthropic 第一方 Messages／Token Counting | [API overview 的 Request size limits](https://platform.claude.com/docs/en/api/overview#request-size-limits)，213–224 行：**128 MB**；超限为 413 `request_too_large`。同表 Message Batches 256 MB、Files 500 MB、Sessions／Agents／Environments 32 MB | 这是上游接口 cap。不能写成 Claude Code 本地 cap，也不能用同表其他 endpoint 的 32 MB 替代 Messages |
| Anthropic 其他部署 | 同页说明：Bedrock 20 MB、Google 托管 Claude 30 MB；Claude Platform on AWS、Anthropic 托管 Google Cloud、Foundry 的 Messages／Token Counting 为 32 MB | 平台不同，不能把第一方 128 MB 推给所有部署；保留官方 MB 单位，不擅自换算 MiB |
| Gemini API 文件内联指南 | [当前 Files API 正文](https://ai.google.dev/gemini-api/docs/files#upload-a-file) 要求总请求含文件／文字／系统指令超过 **100 MB** 时使用 Files API；PDF 为 50 MB | 属于当前文件输入指南；没有据此确定 Code Assist、Vertex 或全部纯文本生成入口的通用 HTTP body cap，不能沿用旧 20 MB 搜索摘要 |
| OpenAI Responses | 已打开[官方上下文说明](https://developers.openai.com/api/docs/guides/conversation-state#managing-the-context-window)与 Codex 配置页 | 所查页面确立 token 窗口／压缩，没有查实 Responses 通用 HTTP body 字节值；不能以文件上传或图片限制补成通用 cap，也不能断言上游无 cap |
| Scholoom 当前 MiniMax 兼容入口 | [MiniMax 官方 Messages OpenAPI](https://platform.minimax.io/docs/api-reference/text/api/openapi-chat-anthropic.json) 的413定义明确请求体超过 **64 MB**；`CreateMessageReq`列出正式 `MiniMax-M3.1-Flash`，官方[模型调用指南](https://platform.minimax.io/docs/guides/text-generation)写明1,000,000-token窗口 | 父线实际读取公开JSON交叉核对，未调用模型。未明确MB字节口径，不擅自换算MiB；协议兼容不能套用Anthropic第一方128 MB |

**官方文档有漂移。** 当前 Anthropic overview 正文是 128 MB，Claude Code errors 正文仍写 32 MB。本文按各页的对象分别记录，不采纳搜索 snippet 的旧值，也不推断 Claude Code 已更新或仍保留某个本地阈值。没有核实具体上调发布日期，不能仅凭搜索结果写成“10 月 29 日已升级”。

## 已安装 LangChain／deepagents 与本项目的实际边界

| 机制 | 已安装版本的源码事实 | 对当前 Scholoom 的含义 |
| --- | --- | --- |
| deepagents 1.15.0 默认摘要 | `computeSummarizationDefaults`：有数字型 `model.profile.maxInputTokens` 时 trigger 85%、keep 10%；否则 **170,000 tokens** trigger、keep **6 messages** | 85% 是有条件的默认设置，不能因模型宣传 1M 窗口就认定本项目约 850k 才压缩 |
| LangChain 1.5.16 摘要中间件 | trigger／keep 支持 tokens、messages、fraction；fraction 需要模型 token profile | 是 token／消息预算，不是整包 JSON 字节 cap；LangChain 的中间件与 deepagents 扩展需分别看默认值 |
| deepagents 文件中间件 | `toolTokenLimitBeforeEvict` 默认 20,000 tokens，较大工具结果转存 backend，按路径读取 | 是单个工具结果的上下文治理，不能推导出站总正文最多约 80 KB；约数也不是硬性字节换算 |
| ChatAnthropic 适配 | 1.5.12 的 `profile` getter 为 `PROFILES[this.model] ?? {}`；所装 profile 表未见本项目 MiniMax 模型；本项目没有注入 token profile，`maxTokens: 16384` | 当前路径使用摘要 fallback，16,384 为输出上限。**尚不能承诺已按 MiniMax 的真实大窗口配置上下文预算** |

证据：

- [deepagents 1.15.0 `libs/deepagents/src/middleware/summarization.ts:174–223`](https://github.com/langchain-ai/deepagentsjs/blob/deepagents%401.15.0/libs/deepagents/src/middleware/summarization.ts#L174)；与本地发布包 source map 中的对应源码逐字一致。本地 `packages/harness/node_modules/deepagents/dist/langsmith-v_uskil7.js:3495–3552` 为上述默认值，3711–3722 行为触发判断，7951 行安装默认摘要中间件。
- [同版 `middleware/fs.ts`](https://github.com/langchain-ai/deepagentsjs/blob/deepagents%401.15.0/libs/deepagents/src/middleware/fs.ts#L2215) 的默认 `toolTokenLimitBeforeEvict = 20000`；[LangChain 1.5.16 summarization 源码](https://github.com/langchain-ai/langchainjs/blob/langchain%401.5.16/libs/langchain/src/agents/middleware/summarization.ts) 的 trigger／keep 与 profile 校验；本地发布 JS 校验位于 `langchain/dist/agents/middleware/summarization.js:245–247`。
- [ChatAnthropic 1.5.12 `chat_models.ts:1761–1763`](https://github.com/langchain-ai/langchainjs/blob/%40langchain%2Fanthropic%401.5.12/libs/providers/langchain-anthropic/src/chat_models.ts#L1761)；本地 `packages/models/node_modules/@langchain/anthropic/dist/profiles.js` 与 `chat_models.js:1083–1084`。Scholoom [`execution-model.ts:19–43`](../../../packages/models/src/execution-model.ts#L19)、[`catalog.ts:12–24`](../../../packages/models/src/catalog.ts#L12)、[`execution-driver.ts:87,240`](../../../packages/harness/src/execution-driver.ts#L240) 将该模型传入 `createDeepAgent`，所查默认栈没有另设摘要阈值。
- 出站补充核查：ChatAnthropic 的 `createStreamWithRetry` 将 payload 交给 SDK `messages.create`（已安装 `chat_models.js:1011–1023`）；SDK 0.122.0 的 `internal/request-options.mjs:12–18` 使用 `JSON.stringify(body)`；项目自定义 fetch 直接转发 `init`。这些局部方法未见整包字节硬限，不能替代对 Claude Code 闭源核心的判断。

## 本地验收门槛与建议

**建议移除“LLM 出站序列化正文必须 ≤256 KiB”这一通用验收上限。** 本次没有找到支持该值为成熟 harness 通行约束的证据。大 context 应按模型／供应商能力确定 token 预算；固定的小字节门槛会额外限制可送内容，不能证明模型 context 使用正确。字节与 tokens 没有固定换算，JSON 转义、工具 schema、历史和 base64 附件也会改变整包大小。

本仓库检出的相近限制须区别处理：

- [`tests/execution-observer.ts:320`](../../../tests/execution-observer.ts#L320) 和 [`tests/kernel/model-kernel.spec.ts:21`](../../../tests/kernel/model-kernel.spec.ts#L21) 的 256 KiB 是**诊断附件**上限；不是此次应移除的 LLM 正文上限。
- [`tests/model-server.ts:6,59–74`](../../../tests/model-server.ts#L59) 的默认 **2 MiB** 是**替身服务器入站**保护，`maxBodyBytes` 可调整；[`context-instructions.spec.ts:260–265`](../../../tests/kernel/context-instructions.spec.ts#L260) 已为大输入场景设 8 MiB。本次只阅读测试定义，没有实跑；8 MiB 也不是产品上限。没有在所查生产模型发送路径定位到 256 KiB 整包检查，不能把上述诊断断言当作用户质疑的正文门槛本身。

后续最小范围是将通用正文验收门槛与诊断／替身资源保护分开；如需保留替身 cap，应明确其适用场景并容纳目标载荷。供应商实际 HTTP cap、模型 token 窗口、输出／推理预留、工具／文件限制和授权边界仍须各自遵守，超限不可静默丢弃科研材料。

MiniMax token profile 缺失另列为已知限制：若后续要承诺利用 800k+ context，须独立核实模型窗口、profile／摘要策略与输出预留并验证；**本次研究不扩大为 context 机制改造，也不声称移除 256 KiB 即完成大窗口支持。**

父线另核本次已停止的旧验收网关：单请求262,144字节、累计4MiB均为验收脚本预算，非产品限制。后续验收取消这两项通用正文门槛，保持约定的请求次数、时间、输出及停止范围；不改写旧执行或其原始证据。

边界：没有做 LLM／大请求实测、没有穷尽 SDK／插件／代理／闭源代码，也没有验证跨平台行为。上游依据以文中固定commit链接及官方文档为准，接续不依赖临时下载快照或现有/tmp内容。
