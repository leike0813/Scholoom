import type { FromSchema } from 'json-schema-to-ts';
import { compileContract, errorInfoSchema, limits } from './core.js';
import { reportLimits } from './report-contracts.js';
import { array, count, flag, id, object } from './schema.js';

const path = {
  type: 'string',
  minLength: 1,
  maxLength: 512,
  pattern:
    '^(?!\\.{1,2}(?:/|$))[^/\\\\:\\u0000-\\u001f]+(?:/(?!\\.{1,2}(?:/|$))[^/\\\\:\\u0000-\\u001f]+)*$',
} as const;
const offset = { ...count, maximum: reportLimits.dependencyBytes } as const;
export const isolatedAssetSchema = object({ path, byteLength: offset }, ['path', 'byteLength']);
export const isolationStatusSchema = object(
  {
    instanceId: id,
    phase: {
      enum: ['queued', 'preparing', 'starting', 'running', 'stopping', 'stopped', 'unknown'],
    },
    gateReleased: flag,
    stopConfirmed: flag,
    next: object({ path, offset }, ['path', 'offset']),
    failure: errorInfoSchema,
  },
  ['instanceId', 'phase', 'gateReleased', 'stopConfirmed'],
);

const checkInput = object({ programId: id, policyId: id }, ['programId', 'policyId']);
const checkOutput = object({ available: flag, reason: errorInfoSchema }, ['available']);
const instanceInput = object({ instanceId: id }, ['instanceId']);
const stageInput = object(
  {
    instanceId: id,
    programId: id,
    policyId: id,
    entryPath: path,
    assets: {
      ...array(isolatedAssetSchema),
      minItems: 1,
      maxItems: reportLimits.resources + 1,
    },
  },
  ['instanceId', 'programId', 'policyId', 'entryPath', 'assets'],
);
const putInput = object(
  {
    instanceId: id,
    path,
    offset,
    base64: { type: 'string', maxLength: Math.ceil(reportLimits.entryBytes / 3) * 4 },
  },
  ['instanceId', 'path', 'offset', 'base64'],
);

export const isolationOperations = {
  'platform.reportIsolation.check': {
    params: checkInput,
    result: checkOutput,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'platform.reportIsolation.stage': {
    params: stageInput,
    result: isolationStatusSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: limits.requestMs },
  },
  'platform.reportIsolation.put': {
    params: putInput,
    result: isolationStatusSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: limits.requestMs },
  },
  'platform.reportIsolation.start': {
    params: instanceInput,
    result: isolationStatusSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: limits.requestMs },
  },
  'platform.reportIsolation.get': {
    params: instanceInput,
    result: isolationStatusSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'platform.reportIsolation.stop': {
    params: instanceInput,
    result: isolationStatusSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: limits.requestMs },
  },
} as const;

export type IsolationStageInput = FromSchema<typeof stageInput>;
export type IsolationStatus = FromSchema<typeof isolationStatusSchema>;
export type IsolatedAsset = FromSchema<typeof isolatedAssetSchema>;
type InstanceInput = FromSchema<typeof instanceInput>;
export type IsolationInputs = {
  'platform.reportIsolation.check': FromSchema<typeof checkInput>;
  'platform.reportIsolation.stage': IsolationStageInput;
  'platform.reportIsolation.put': FromSchema<typeof putInput>;
  'platform.reportIsolation.start': InstanceInput;
  'platform.reportIsolation.get': InstanceInput;
  'platform.reportIsolation.stop': InstanceInput;
};
export type IsolationOutputs = {
  'platform.reportIsolation.check': FromSchema<typeof checkOutput>;
  'platform.reportIsolation.stage': IsolationStatus;
  'platform.reportIsolation.put': IsolationStatus;
  'platform.reportIsolation.start': IsolationStatus;
  'platform.reportIsolation.get': IsolationStatus;
  'platform.reportIsolation.stop': IsolationStatus;
};
export type IsolationMethod = keyof typeof isolationOperations;
export type IsolationPort = {
  [M in IsolationMethod]: (input: IsolationInputs[M]) => Promise<IsolationOutputs[M]>;
};

const stageValidator = compileContract(
  isolationOperations['platform.reportIsolation.stage'],
).params;
const putValidator = compileContract(isolationOperations['platform.reportIsolation.put']).params;
const encoder = new TextEncoder();
const withinFrame = (value: unknown) =>
  encoder.encode(JSON.stringify(value)).byteLength <= limits.frameBytes;

export function validateIsolationStage(value: unknown): value is IsolationStageInput {
  if (!stageValidator(value)) return false;
  const input = value as IsolationStageInput;
  const paths = new Set<string>();
  let total = 0;
  for (const asset of input.assets) {
    if (paths.has(asset.path)) return false;
    paths.add(asset.path);
    if (asset.path === input.entryPath && asset.byteLength > reportLimits.entryBytes) return false;
    total += asset.byteLength;
    if (total > reportLimits.loadBytes) return false;
  }
  for (const asset of input.assets) {
    const segments = asset.path.split('/');
    segments.pop();
    while (segments.length) {
      if (paths.has(segments.join('/'))) return false;
      segments.pop();
    }
  }
  return paths.has(input.entryPath) && withinFrame(input);
}

export function validateIsolationPut(
  value: unknown,
): value is IsolationInputs['platform.reportIsolation.put'] {
  if (!putValidator(value)) return false;
  const input = value as IsolationInputs['platform.reportIsolation.put'];
  try {
    const decoded = atob(input.base64);
    return (
      decoded.length <= reportLimits.entryBytes &&
      input.offset + decoded.length <= reportLimits.dependencyBytes &&
      btoa(decoded) === input.base64 &&
      withinFrame(input)
    );
  } catch {
    return false;
  }
}
