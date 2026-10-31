import { effortSchema, type ModelDefaults, type ModelOption } from '@scholoom/protocol/models';

export type {
  Effort,
  ModelDefaults,
  ModelOption,
  ModelPreference,
  ProviderStatus,
  RunModelConfig,
} from '@scholoom/protocol/models';

export const minimaxEndpoint = 'https://api.minimax.cn/anthropic';
export const minimaxEfforts = effortSchema.enum;
// MiniMax's published limits are not yet in LangChain's bundled model profiles.
export const minimaxTokenLimits: Readonly<
  Partial<Record<string, { maxInputTokens: number; maxOutputTokens: number }>>
> = {
  'MiniMax-M3.1-Flash': { maxInputTokens: 1_000_000, maxOutputTokens: 524_288 },
  'MiniMax-M3': { maxInputTokens: 1_000_000, maxOutputTokens: 524_288 },
};
export const minimaxModels: readonly ModelOption[] = [
  { id: 'MiniMax-M3.1-Flash', supportsEffort: true },
  { id: 'MiniMax-M3.1-Flash-Preview', supportsEffort: true },
  { id: 'MiniMax-M3', supportsEffort: false },
  { id: 'MiniMax-M2.7', supportsEffort: false },
  { id: 'MiniMax-M2.7-highspeed', supportsEffort: false },
];
export const factoryDefaults: ModelDefaults = {
  model: 'MiniMax-M3.1-Flash',
  effort: 'medium',
};
export const adaptiveThinking = new Set([
  'MiniMax-M3.1-Flash',
  'MiniMax-M3.1-Flash-Preview',
  'MiniMax-M3',
]);
