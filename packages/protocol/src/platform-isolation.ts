import type { FromSchema } from 'json-schema-to-ts';
import { compileContract, errorInfoSchema, limits } from './core.js';
import { reportLimits } from './report-contracts.js';
import { array, count, flag, id, object } from './schema.js';

export const isolationRecordLimits = { instances: 4096, manifestBytes: 65536 } as const;

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

const empty = object({}, []);
const uuid = {
  type: 'string',
  pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
} as const;
const decimal = { type: 'string', minLength: 1, maxLength: 20, pattern: '^[0-9]+$' } as const;
const managerInstance = object({ configId: uuid, storageId: uuid }, ['configId', 'storageId']);
const managerScope = object(
  {
    bootId: uuid,
    invocationId: { type: 'string', pattern: '^(?!0{32}$)[a-f0-9]{32}$' },
    dev: decimal,
    ino: decimal,
  },
  ['bootId', 'invocationId', 'dev', 'ino'],
);
const runtimeAccount = { type: 'integer', minimum: 1, maximum: 0xfffffffe } as const;
const physicalStamp = {
  type: 'string',
  maxLength: 104,
  pattern: '^[0-9]+:[0-9]+:[0-9]+:[0-9]+:[0-9]+$',
} as const;
const fileIdentity = object({ dev: decimal, ino: decimal }, ['dev', 'ino']);
const systemFiles = {
  permit: fileIdentity,
  events: fileIdentity,
  stdout: fileIdentity,
  stderr: fileIdentity,
} as const;
export const reportNodeTargets = [
  '/runtime/node',
  '/lib64/ld-linux-x86-64.so.2',
  '/lib/x86_64-linux-gnu/libdl.so.2',
  '/lib/x86_64-linux-gnu/libstdc++.so.6',
  '/lib/x86_64-linux-gnu/libm.so.6',
  '/lib/x86_64-linux-gnu/libgcc_s.so.1',
  '/lib/x86_64-linux-gnu/libpthread.so.0',
  '/lib/x86_64-linux-gnu/libc.so.6',
] as const;
export const reportNodeLimits = { fileBytes: 268435456, totalBytes: 536870912, frames: 4 } as const;
const systemReportNodeSchema = object(
  {
    files: {
      ...array(
        object({ target: { enum: reportNodeTargets }, stamp: physicalStamp }, ['target', 'stamp']),
      ),
      minItems: reportNodeTargets.length,
      maxItems: reportNodeTargets.length,
    },
    input: fileIdentity,
    output: fileIdentity,
  },
  ['files', 'input', 'output'],
);
export type SystemReportNode = FromSchema<typeof systemReportNodeSchema>;
export const systemReportInputsSchema = object(
  { bootId: uuid, manifest: physicalStamp, ...systemFiles, node: systemReportNodeSchema },
  ['bootId', 'manifest', 'permit', 'events', 'stdout', 'stderr'],
);
/** C creates this sealed descriptor; it is neither a second receipt nor an execution permit. */
export const systemReportManifestSchema = object(
  {
    version: { const: 1 },
    configId: uuid,
    storageId: uuid,
    ownerUid: runtimeAccount,
    stage: stageInput,
    programVersion: id,
    policyVersion: id,
    args: { ...array({ type: 'string', maxLength: 512, pattern: '^[^\\u0000]*$' }), maxItems: 16 },
    stamps: { ...array(physicalStamp), minItems: 1, maxItems: reportLimits.resources + 1 },
    sealed: object({ program: physicalStamp, gate: physicalStamp }, ['program', 'gate']),
    files: object(systemFiles, ['permit', 'events', 'stdout', 'stderr']),
    node: systemReportNodeSchema,
  },
  [
    'version',
    'configId',
    'storageId',
    'ownerUid',
    'stage',
    'programVersion',
    'policyVersion',
    'args',
    'stamps',
    'sealed',
    'files',
  ],
);
export type SystemReportInputs = FromSchema<typeof systemReportInputsSchema>;
export type SystemReportManifest = FromSchema<typeof systemReportManifestSchema>;
const managerStart = object(
  {
    ...managerInstance.properties,
    programId: id,
    programVersion: id,
    policyId: id,
    policyVersion: id,
    assets: { type: 'integer', minimum: 1, maximum: reportLimits.resources + 1 },
    inputs: systemReportInputsSchema,
  },
  [
    'configId',
    'storageId',
    'programId',
    'programVersion',
    'policyId',
    'policyVersion',
    'assets',
    'inputs',
  ],
);
const managerGate = object(
  { ...managerInstance.properties, scope: managerScope, permit: fileIdentity },
  ['configId', 'storageId', 'scope', 'permit'],
);
const managerObservation = object(
  {
    scope: object(
      {
        ...managerScope.properties,
        controllerPid: { type: 'integer', minimum: 2, maximum: 0x7fffffff },
        controllerBirth: decimal,
      },
      [...managerScope.required, 'controllerPid', 'controllerBirth'],
    ),
    runtimeUid: runtimeAccount,
    runtimeGid: runtimeAccount,
    limits: object(
      {
        cpuQuota: decimal,
        cpuPeriod: decimal,
        memoryBytes: decimal,
        swapBytes: decimal,
        tasks: decimal,
      },
      ['cpuQuota', 'cpuPeriod', 'memoryBytes', 'swapBytes', 'tasks'],
    ),
  },
  ['scope', 'runtimeUid', 'runtimeGid', 'limits'],
);
export const reportManagerOperations = {
  'reportManager.ping': {
    params: object({ configId: uuid }, ['configId']),
    result: empty,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'reportManager.capture': {
    params: managerInstance,
    result: managerObservation,
    semantics: { effect: 'read', returns: 'result', waitMs: 45_000 },
  },
  'reportManager.stop': {
    params: object(
      {
        configId: uuid,
        storageId: uuid,
        scope: managerScope,
      },
      ['configId', 'storageId', 'scope'],
    ),
    result: object({ scopeEmpty: { const: true } }, ['scopeEmpty']),
    semantics: { effect: 'write', returns: 'result', waitMs: 45_000 },
  },
  'reportManager.start': {
    params: managerStart,
    result: managerObservation,
    semantics: { effect: 'write', returns: 'reference', waitMs: 45_000 },
  },
  'reportManager.arm': {
    params: managerGate,
    result: object({ armed: { const: true } }, ['armed']),
    semantics: { effect: 'write', returns: 'result', waitMs: 45_000 },
  },
  'reportManager.permit': {
    params: managerGate,
    result: object({ released: { const: true } }, ['released']),
    semantics: { effect: 'write', returns: 'result', waitMs: 45_000 },
  },
  'reportManager.recover': {
    params: object({ ...managerStart.properties, scope: managerScope }, [...managerStart.required]),
    result: object({ scopeEmpty: { const: true } }, ['scopeEmpty']),
    semantics: { effect: 'write', returns: 'result', waitMs: 45_000 },
  },
  'reportManager.release': {
    params: object({ ...managerStart.properties, scope: managerScope }, [...managerStart.required]),
    result: empty,
    semantics: { effect: 'write', returns: 'result', waitMs: 45_000 },
  },
} as const;
type ManagerOperations = typeof reportManagerOperations;
export type ReportManagerStart = FromSchema<ManagerOperations['reportManager.start']['params']>;
export type ReportManagerGate = FromSchema<ManagerOperations['reportManager.arm']['params']>;
export type ReportManagerRelease = FromSchema<ManagerOperations['reportManager.release']['params']>;
export type ReportManagerRecover = FromSchema<ManagerOperations['reportManager.recover']['params']>;
export type ReportManagerStop = FromSchema<
  (typeof reportManagerOperations)['reportManager.stop']['params']
>;
export type ReportManagerCapture = FromSchema<
  (typeof reportManagerOperations)['reportManager.capture']['params']
>;
export type ReportManagerObservation = FromSchema<
  (typeof reportManagerOperations)['reportManager.capture']['result']
>;
export function reportManagerScope(
  scope: ReportManagerObservation['scope'],
): ReportManagerStop['scope'] {
  return { bootId: scope.bootId, invocationId: scope.invocationId, dev: scope.dev, ino: scope.ino };
}
const controlWaitMs = 75_000;
export const isolationControlOperations = {
  ...isolationOperations,
  'reportControl.open': {
    params: object({ configId: id, requestId: id }, ['configId', 'requestId']),
    result: object(
      {
        configId: id,
        requestId: id,
        total: { ...count, maximum: isolationRecordLimits.instances },
      },
      ['configId', 'requestId', 'total'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: controlWaitMs },
  },
  'reportControl.prepare': {
    params: object({ instanceId: id, programId: id, policyId: id }, [
      'instanceId',
      'programId',
      'policyId',
    ]),
    result: isolationStatusSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: controlWaitMs },
  },
  'reportControl.close': {
    params: empty,
    result: empty,
    semantics: { effect: 'write', returns: 'result', waitMs: controlWaitMs },
  },
  'reportControl.exchange': {
    params: object(
      {
        instanceId: id,
        frame: { type: 'string', minLength: 2, maxLength: reportLimits.bridgeBytes },
      },
      ['instanceId'],
    ),
    result: object(
      {
        frames: {
          ...array({ type: 'string', minLength: 2, maxLength: reportLimits.bridgeBytes }),
          maxItems: reportNodeLimits.frames,
        },
      },
      ['frames'],
    ),
    semantics: { effect: 'write', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.authorize': {
    params: instanceInput,
    result: empty,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.reserve': {
    params: instanceInput,
    result: empty,
    semantics: { effect: 'write', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.release': {
    params: instanceInput,
    result: empty,
    semantics: { effect: 'write', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.recover': {
    params: instanceInput,
    result: empty,
    semantics: { effect: 'write', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.ready': {
    params: instanceInput,
    result: empty,
    semantics: {
      effect: 'read',
      returns: 'result',
      waitMs: limits.processWaitMs + limits.requestMs,
    },
  },
  'reportHost.inventory': {
    params: object({ requestId: id, statuses: { ...array(isolationStatusSchema), maxItems: 64 } }, [
      'requestId',
      'statuses',
    ]),
    result: empty,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.freeze': {
    params: instanceInput,
    result: stageInput,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
  'reportHost.read': {
    params: object(
      {
        instanceId: id,
        path,
        offset,
        limit: { type: 'integer', minimum: 1, maximum: reportLimits.entryBytes },
      },
      ['instanceId', 'path', 'offset', 'limit'],
    ),
    result: putInput,
    semantics: { effect: 'read', returns: 'result', waitMs: limits.requestMs },
  },
} as const;

export type IsolationControlMethod = keyof typeof isolationControlOperations;
type ControlOperations = typeof isolationControlOperations;
type Empty = FromSchema<typeof empty>;
// Resolve each schema before generic RPC indexing, avoiding recursive union expansion.
export type IsolationControlInputs = IsolationInputs & {
  'reportControl.open': FromSchema<ControlOperations['reportControl.open']['params']>;
  'reportControl.prepare': FromSchema<ControlOperations['reportControl.prepare']['params']>;
  'reportControl.close': Empty;
  'reportControl.exchange': FromSchema<ControlOperations['reportControl.exchange']['params']>;
  'reportHost.authorize': InstanceInput;
  'reportHost.reserve': InstanceInput;
  'reportHost.release': InstanceInput;
  'reportHost.recover': InstanceInput;
  'reportHost.ready': InstanceInput;
  'reportHost.inventory': FromSchema<ControlOperations['reportHost.inventory']['params']>;
  'reportHost.freeze': InstanceInput;
  'reportHost.read': FromSchema<ControlOperations['reportHost.read']['params']>;
};
export type IsolationControlOutputs = IsolationOutputs & {
  'reportControl.open': FromSchema<ControlOperations['reportControl.open']['result']>;
  'reportControl.prepare': IsolationStatus;
  'reportControl.close': Empty;
  'reportControl.exchange': FromSchema<ControlOperations['reportControl.exchange']['result']>;
  'reportHost.authorize': Empty;
  'reportHost.reserve': Empty;
  'reportHost.release': Empty;
  'reportHost.recover': Empty;
  'reportHost.ready': Empty;
  'reportHost.inventory': Empty;
  'reportHost.freeze': IsolationStageInput;
  'reportHost.read': FromSchema<typeof putInput>;
};

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
