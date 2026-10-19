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
export const minimaxModels: readonly ModelOption[] = [
  { id: 'MiniMax-M3.1-Flash-Preview', supportsEffort: true },
  { id: 'MiniMax-M3', supportsEffort: false },
  { id: 'MiniMax-M2.7', supportsEffort: false },
  { id: 'MiniMax-M2.7-highspeed', supportsEffort: false },
];
export const factoryDefaults: ModelDefaults = {
  model: 'MiniMax-M3.1-Flash-Preview',
  effort: 'medium',
};
export const adaptiveThinking = new Set(['MiniMax-M3.1-Flash-Preview', 'MiniMax-M3']);
