import type { FromSchema } from 'json-schema-to-ts';
import { compileContract } from './core.js';
import { resourceEvidenceSchema } from './resource-contracts.js';
import { array, count, flag, id, object, ok, page, text } from './schema.js';

export const effortSchema = { enum: ['low', 'medium', 'high', 'xhigh', 'max'] } as const;

export const modelOptionSchema = object({ id, supportsEffort: flag }, ['id', 'supportsEffort']);

export const modelPreferenceSchema = object({ model: id, effort: effortSchema }, []);
export const runModelConfigSchema = object({ model: id, effort: effortSchema }, ['model']);
export const modelProfileSchema = object(
  {
    id,
    name: { type: 'string', minLength: 1, maxLength: 200 },
    revision: count,
    provider: { const: 'minimax-cn-m-plan' },
    config: runModelConfigSchema,
  },
  ['id', 'name', 'revision', 'provider', 'config'],
);
export const saveModelProfileSchema = object(
  {
    id,
    name: modelProfileSchema.properties.name,
    expectedRevision: count,
    config: runModelConfigSchema,
  },
  ['id', 'name', 'expectedRevision', 'config'],
);
export const modelProfilesPageSchema = object(
  { profiles: { ...array(modelProfileSchema), maxItems: 100 }, nextOffset: count },
  ['profiles'],
);
export type ModelProfile = FromSchema<typeof modelProfileSchema>;
export type SaveModelProfile = FromSchema<typeof saveModelProfileSchema>;
export type ModelProfilesPage = FromSchema<typeof modelProfilesPageSchema>;

export const providerSchema = object(
  {
    id: { const: 'minimax-cn-m-plan' },
    model: id,
    defaultEffort: effortSchema,
    models: array(modelOptionSchema),
    efforts: array(effortSchema),
    configured: flag,
    source: { enum: ['saved', 'environment', 'missing'] },
    error: text,
  },
  ['id', 'model', 'defaultEffort', 'models', 'efforts', 'configured', 'source'],
);

export const modelsOperations = {
  'provider.profiles': {
    params: object({ offset: count, limit: page }, []),
    result: modelProfilesPageSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'provider.saveProfile': {
    params: saveModelProfileSchema,
    result: modelProfileSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'provider.removeProfile': {
    params: object({ id, expectedRevision: count }, ['id', 'expectedRevision']),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'provider.configure': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ apiKey: { type: 'string', minLength: 1, maxLength: 4096 } }, ['apiKey']),
    result: providerSchema,
  },
  'provider.setDefaults': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ model: id, effort: effortSchema }, ['model', 'effort']),
    result: providerSchema,
  },
} as const;

export type Effort = FromSchema<typeof effortSchema>;
export const modelsModuleOperations = {
  'models.resolveProfile': {
    params: object({ id }, ['id']),
    result: modelProfileSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'models.status': {
    params: object({}, []),
    result: providerSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export type ModelsModuleInputs = {
  'models.resolveProfile': FromSchema<
    (typeof modelsModuleOperations)['models.resolveProfile']['params']
  >;
  'models.status': FromSchema<(typeof modelsModuleOperations)['models.status']['params']>;
};
export type ModelsModuleOutputs = {
  'models.resolveProfile': FromSchema<
    (typeof modelsModuleOperations)['models.resolveProfile']['result']
  >;
  'models.status': FromSchema<(typeof modelsModuleOperations)['models.status']['result']>;
};
export type ModelOption = FromSchema<typeof modelOptionSchema>;
export type ModelPreference = FromSchema<typeof modelPreferenceSchema>;
export type RunModelConfig = FromSchema<typeof runModelConfigSchema>;
export type ModelDefaults = FromSchema<(typeof modelsOperations)['provider.setDefaults']['params']>;
export type ProviderStatus = FromSchema<typeof providerSchema>;
export type ModelsInputs = {
  [M in keyof typeof modelsOperations]: FromSchema<(typeof modelsOperations)[M]['params']>;
};
export type ModelsOutputs = {
  [M in keyof typeof modelsOperations]: FromSchema<(typeof modelsOperations)[M]['result']>;
};

// Only the owned execution channel carries this descriptor, including its selected secret.
export const modelDescriptorSchema = object(
  {
    model: id,
    effort: effortSchema,
    apiKey: { type: 'string', minLength: 1, maxLength: 4096 },
    endpoint: id,
  },
  ['model', 'apiKey', 'endpoint'],
);
export type ModelDescriptor = FromSchema<typeof modelDescriptorSchema>;
const descriptorValidator = compileContract({ params: modelDescriptorSchema, result: true }).params;
export const isModelDescriptor = (value: unknown): value is ModelDescriptor =>
  descriptorValidator(value) === true;

export const modelAdmissionOperations = {
  'model.acquire': {
    params: object(
      { materials: { type: 'array', items: resourceEvidenceSchema, maxItems: 1000 } },
      [],
    ),
    result: object({ leaseId: id }, ['leaseId']),
    semantics: { effect: 'write', returns: 'reference', waitMs: 180000 },
  },
  'model.release': {
    params: object({ leaseId: id }, ['leaseId']),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
