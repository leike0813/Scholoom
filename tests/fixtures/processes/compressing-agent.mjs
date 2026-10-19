import { ChatAnthropic } from '../../../apps/kernel/node_modules/@langchain/anthropic/dist/chat_models.js';

// A small model window exercises the real default middleware without a production test flag.
Object.defineProperty(ChatAnthropic.prototype, 'profile', {
  configurable: true,
  get: () => ({ maxInputTokens: 4000 }),
});
await import('../../../packages/harness/dist/execution.js');
