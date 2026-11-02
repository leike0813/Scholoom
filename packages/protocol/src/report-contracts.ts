import type { FromSchema } from 'json-schema-to-ts';
import { compileContract, errorInfoSchema } from './core.js';
import {
  isReportRenderFrame,
  reportRenderFrameSchema,
  reportRenderLimits,
} from './report-rendering.js';
import {
  resourceDescriptorSchema,
  resourceEvidenceSchema,
  resourceRefSchema,
} from './resource-contracts.js';
import { array, count, flag, id, object } from './schema.js';

export {
  isReportRenderFrame,
  type ReportRenderFrame,
  reportRenderFrameSchema,
  reportRenderLimits,
} from './report-rendering.js';

export const reportLimits = {
  resources: 32,
  sources: 100,
  objects: 100,
  manifestBytes: 131072,
  entryBytes: 262144,
  dependencyBytes: 8388608,
  loadBytes: 33554432,
  parallelReads: 4,
  semanticsUnits: 8192,
  requestUnits: 4096,
  bridgeBytes: 65536,
} as const;

const mediaType = {
  enum: [
    'text/javascript',
    'application/javascript',
    'text/css',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'font/woff',
    'font/woff2',
    'font/ttf',
    'font/otf',
  ],
} as const;
export const reportManifestSchema = object(
  {
    version: { const: 1 },
    resources: {
      ...array(
        object({ path: id, ref: resourceRefSchema.anyOf[0], basis: id, mediaType }, [
          'path',
          'ref',
          'basis',
          'mediaType',
        ]),
      ),
      maxItems: reportLimits.resources,
    },
    sources: {
      ...array(
        object({ ref: resourceRefSchema, basis: resourceEvidenceSchema.properties.basis }, [
          'ref',
          'basis',
        ]),
      ),
      maxItems: reportLimits.sources,
    },
    objects: {
      ...array(
        object(
          {
            objectId: id,
            name: id,
            semantics: { type: 'string', maxLength: reportLimits.semanticsUnits },
            sourceIndexes: { ...array(count), maxItems: reportLimits.sources, uniqueItems: true },
          },
          ['objectId', 'name', 'semantics'],
        ),
      ),
      maxItems: reportLimits.objects,
    },
  },
  ['version', 'resources', 'sources', 'objects'],
);

export const reportSnapshotSchema = object(
  {
    resource: resourceDescriptorSchema,
    manifest: reportManifestSchema,
  },
  ['resource', 'manifest'],
);

export const reportVersionSchema = {
  anyOf: [
    object({ state: { const: 'available' }, snapshot: reportSnapshotSchema }, [
      'state',
      'snapshot',
    ]),
    object(
      {
        state: { const: 'unavailable' },
        reason: { enum: ['contentChanged', 'notFound', 'unavailable'] },
      },
      ['state', 'reason'],
    ),
  ],
} as const;

const envelope = { version: { const: 1 }, viewId: id, generation: count, basis: id } as const;
const required = ['version', 'viewId', 'generation', 'basis', 'type'] as const;
const state = { browse: {}, draft: {}, dirty: flag } as const;
export const reportBridgeMessageSchema = {
  anyOf: [
    object({ ...envelope, type: { const: 'ready' } }, required),
    object(
      {
        ...envelope,
        type: { const: 'select' },
        objectIds: { ...array(id), minItems: 1, maxItems: reportLimits.objects, uniqueItems: true },
        request: { type: 'string', maxLength: reportLimits.requestUnits },
      },
      [...required, 'objectIds', 'request'],
    ),
    object({ ...envelope, type: { enum: ['state', 'restore'] }, ...state }, [
      ...required,
      'browse',
      'draft',
      'dirty',
    ]),
    object({ ...envelope, type: { const: 'queued' } }, required),
    object({ ...envelope, type: { const: 'error' }, error: errorInfoSchema }, [
      ...required,
      'error',
    ]),
  ],
} as const;

export type ReportManifest = FromSchema<typeof reportManifestSchema>;
export type ReportSnapshot = FromSchema<typeof reportSnapshotSchema>;
export type ReportBridgeMessage = FromSchema<typeof reportBridgeMessageSchema>;

const nativeValue = {
  value: { type: 'string', maxLength: 16384 },
  checked: flag,
  selectedIndex: { type: 'integer', minimum: -1, maximum: reportRenderLimits.nodes },
} as const;
export const reportNativeInputSchema = object(
  {
    nodeId: { type: 'integer', minimum: 1, maximum: 65535 },
    revision: count,
    eventType: { type: 'string', minLength: 1, maxLength: 64 },
    bubbles: flag,
    cancelable: flag,
    isTrusted: flag,
    ...nativeValue,
    data: { anyOf: [{ type: 'string', maxLength: 16384 }, { type: 'null' }] },
    inputType: { type: 'string', maxLength: 64 },
    isComposing: flag,
    key: { type: 'string', maxLength: 64 },
    button: { type: 'integer', minimum: -1, maximum: 5 },
    buttons: { type: 'integer', minimum: 0, maximum: 31 },
    clientX: { type: 'number', minimum: -1000000, maximum: 1000000 },
    clientY: { type: 'number', minimum: -1000000, maximum: 1000000 },
    altKey: flag,
    ctrlKey: flag,
    shiftKey: flag,
    metaKey: flag,
  },
  ['nodeId', 'revision', 'eventType', 'bubbles', 'cancelable', 'isTrusted'],
);
export const reportProgramCommandSchema = {
  anyOf: [
    object(
      {
        ...envelope,
        type: { const: 'start' },
        restorePending: { const: true },
        viewport: {
          ...array({ type: 'integer', minimum: 1, maximum: 16384 }),
          minItems: 2,
          maxItems: 2,
        },
        cssProperties: {
          ...array({ type: 'string', maxLength: 64, pattern: '^-?[-a-z][a-z0-9-]*$' }),
          maxItems: 1024,
          uniqueItems: true,
        },
        eventProperties: {
          ...array({ type: 'string', maxLength: 64, pattern: '^on[a-z]+$' }),
          maxItems: 256,
          uniqueItems: true,
        },
      },
      [...required, 'viewport', 'cssProperties', 'eventProperties'],
    ),
    object(
      {
        type: { const: 'consume' },
        sequences: { ...array(count), maxItems: reportRenderLimits.inFlight, uniqueItems: true },
      },
      ['type', 'sequences'],
    ),
    object({ ...envelope, type: { const: 'input' }, input: reportNativeInputSchema }, [
      ...required,
      'input',
    ]),
    reportBridgeMessageSchema,
  ],
} as const;
export const reportProgramPacketSchema = {
  anyOf: [
    reportRenderFrameSchema,
    reportBridgeMessageSchema,
    object(
      {
        ...envelope,
        type: { const: 'inputConfirmed' },
        nodeId: reportNativeInputSchema.properties.nodeId,
        revision: count,
        through: count,
        ...nativeValue,
      },
      [...required, 'nodeId', 'revision', 'through'],
    ),
  ],
} as const;
export type ReportNativeInput = FromSchema<typeof reportNativeInputSchema>;
export type ReportProgramCommand = FromSchema<typeof reportProgramCommandSchema>;
export type ReportProgramPacket = FromSchema<typeof reportProgramPacketSchema>;
const programCommandValidator = compileContract({
  params: reportProgramCommandSchema,
  result: true,
}).params;
const programPacketValidator = compileContract({
  params: reportProgramPacketSchema,
  result: true,
}).params;
export function isReportProgramCommand(value: unknown): value is ReportProgramCommand {
  try {
    if (!programCommandValidator(value)) return false;
    const type = (value as ReportProgramCommand).type;
    return ['start', 'consume', 'input'].includes(type)
      ? bytes(value) <= reportLimits.bridgeBytes
      : isReportBridgeMessage(value);
  } catch {
    return false;
  }
}
export function isReportProgramPacket(value: unknown): value is ReportProgramPacket {
  try {
    if (!programPacketValidator(value)) return false;
    if ('sequence' in (value as object)) return isReportRenderFrame(value);
    return (value as { type: string }).type === 'inputConfirmed'
      ? bytes(value) <= reportLimits.bridgeBytes
      : isReportBridgeMessage(value);
  } catch {
    return false;
  }
}
const manifestValidator = compileContract({ params: reportManifestSchema, result: true }).params;
const bridgeValidator = compileContract({ params: reportBridgeMessageSchema, result: true }).params;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export function isReportManifest(value: unknown): value is ReportManifest {
  if (!manifestValidator(value)) return false;
  const manifest = value as ReportManifest;
  return (
    bytes(manifest) <= reportLimits.manifestBytes &&
    new Set(manifest.objects.map((item) => item.objectId)).size === manifest.objects.length &&
    manifest.objects.every(
      (item) =>
        item.semantics.length <= reportLimits.semanticsUnits &&
        (item.sourceIndexes ?? []).every((index) => index < manifest.sources.length),
    )
  );
}

export function isReportBridgeMessage(value: unknown): value is ReportBridgeMessage {
  if (!bridgeValidator(value)) return false;
  try {
    // Structured-clone messages may carry non-JSON values that stringify as an empty object.
    const pending: unknown[] = [value];
    const visited = new Set<object>();
    while (pending.length) {
      const item = pending.pop();
      if (item === null || typeof item === 'string' || typeof item === 'boolean') continue;
      if (typeof item === 'number' && Number.isFinite(item)) continue;
      if (typeof item !== 'object') return false;
      if (
        !Array.isArray(item) &&
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null
      )
        return false;
      if (visited.has(item)) continue;
      visited.add(item);
      for (const child of Object.values(item)) pending.push(child);
    }
    let remaining: number = reportLimits.bridgeBytes;
    const json = JSON.stringify(value, function (key, item) {
      // Count every expanded occurrence before stringify can duplicate a shared subtree.
      remaining -=
        (Array.isArray(this) ? 0 : key.length) +
        Math.max(1, typeof item === 'string' ? item.length : 1);
      if (remaining < 0) throw new RangeError('Report bridge capacity exceeded');
      return item;
    });
    return (
      new TextEncoder().encode(json).byteLength <= reportLimits.bridgeBytes &&
      ((value as ReportBridgeMessage).type !== 'select' ||
        (value as Extract<ReportBridgeMessage, { type: 'select' }>).request.length <=
          reportLimits.requestUnits)
    );
  } catch {
    return false;
  }
}
