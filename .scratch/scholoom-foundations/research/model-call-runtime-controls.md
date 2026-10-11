# 模型调用运行控制：LangChain/LangGraph JS 现成机制与承诺边界

核对日期 2026-10-08。方法为静态核查：官方文档页面 + 上游源码阅读，未安装依赖、未运行 SDK、未调用任何模型，因此没有运行验证结果。npm `latest` 为 `@langchain/core` 1.2.17、`langchain` 1.5.15；源码取自 `langchain-ai/langchainjs` 的 `main` 分支（`async_caller.ts` 最近一次提交 `3b0e4c48a318`，2026-08-14），未固定到发布 tag，故源码行为对应未发布的主干状态。

## 现成机制

重试分两层。模型客户端默认 `maxRetries` 为 6，指数退避加抖动，自动重试网络错误、429 与 5xx，401/404 等客户端错误不重试；调用方可在 `initChatModel` 传 `maxRetries` 与 `timeout` 调整。模型构造参数的超时单位需按所选适配器的固定版本核对，不能仅从文档示例数值推断。文档同时说明，在支持该中间件的供应商上，`modelRetryMiddleware` 会接管模型重试。源码 `AsyncCaller` 使用 `maxRetries ?? 6`、`maxConcurrency ?? Infinity`，并用 PQueue 做并发闸门；不可重试状态码包括 400/401/402/403/404/405/406/407/409/413，未识别错误的处理仍需结合具体适配器。中间件层默认只重试 2 次（合计 3 次调用），`backoffFactor` 2.0、`initialDelayMs` 1000、`maxDelayMs` 60000、`jitter` 开启，耗尽后默认 `onFailure: 'continue'`，即返回带错误信息的 AIMessage 而非抛出。

超时与取消通过 `RunnableConfig` 表达：`signal?: AbortSignal` 与 `timeout`（毫秒）。源码在合并配置时用 `AbortSignal.any` 拼接多个信号，并把超时转换成内部 timeoutSignal 后并入调用信号；`AsyncCaller` 监听 abort 并以 `getAbortSignalError` 拒绝。并发方面，`AsyncCaller` 内部队列默认不限流，`model.batch()` 可通过 `maxConcurrency` 限制并行度。

用量挂在 `AIMessage.usage_metadata`（`input_tokens`/`output_tokens`/`total_tokens` 及缓存、推理细分），`stream.messages` 投影的 `message.usage` 可取终值。文档措辞是「一部分供应商会在响应中返回用量，可用时才有」。

恢复语义：LangGraph 恢复时节点从头重跑，`interrupt` 之前发生的副作用会重复，官方规则明确要求前置副作用必须幂等。

## 不能承诺的部分

SDK 提供取消信号与本地中止机制，具体信号能否传到供应商请求需按适配器核对。上述资料没有承诺供应商会停止推理或停止计费，不能将本地取消宣称为供应商停算停费。

未知请求不能盲重试。默认两层策略都会重试未被识别为不可重试的错误（`getRetryable(error) ?? true`），所以一次超时或连接中断后的自动重试可能在供应商已接受原请求的情况下产生重复调用、重复副作用与重复计费。是否存在幂等键、去重窗口，取决于各供应商接口，官方文档未覆盖。

用量不等于预算。`usage_metadata` 依赖供应商上报，缺失时应记为未知；上述机制没有提供金额预算保证，`maxTokens` 只限制单次输出长度。应用可以限制请求次数、并发、输出长度和后续调度，并依据已知用量与价格统计或估算成本；未知价格、缺失用量与在途请求使这些控制不能直接构成可靠金额封顶。

## 来源

- [Models（参数、连接韧性、Batch、Token usage）](https://docs.langchain.com/oss/javascript/langchain/models)
- [Built-in middleware（modelRetryMiddleware 配置项）](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- [Messages（usage_metadata）](https://docs.langchain.com/oss/javascript/langchain/messages)
- [AsyncCaller 源码](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-core/src/utils/async_caller.ts)
- [RunnableConfig 类型与配置合并源码](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-core/src/runnables/config.ts)
- [Interrupts（副作用幂等规则）](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
