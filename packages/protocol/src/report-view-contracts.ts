import {
  isolatedAssetSchema,
  isolationStatusSchema,
  reportNodeLimits,
} from './platform-isolation.js';
import {
  reportLimits,
  reportProgramCommandSchema,
  reportProgramPacketSchema,
  reportSnapshotSchema,
} from './report-contracts.js';
import { resourceEvidenceSchema } from './resource-contracts.js';
import { array, count, id, object } from './schema.js';

const view = { viewId: id, generation: count } as const;
const binding = object(view, ['viewId', 'generation']);
const read = { effect: 'read', returns: 'result', waitMs: 35000 } as const;
const write = { effect: 'write', returns: 'result', waitMs: 35000 } as const;

/** Product views select resource evidence, never an executable, policy or native path. */
export const reportViewOperations = {
  'resources.reportOpen': {
    params: object({ ...view, entry: resourceEvidenceSchema }, ['viewId', 'generation', 'entry']),
    result: object(
      {
        snapshot: reportSnapshotSchema,
        files: { ...array(isolatedAssetSchema), maxItems: reportLimits.resources + 1 },
        status: isolationStatusSchema,
      },
      ['snapshot', 'files', 'status'],
    ),
    semantics: write,
  },
  'resources.reportGet': {
    params: binding,
    result: isolationStatusSchema,
    semantics: read,
  },
  'resources.reportExchange': {
    params: object({ ...view, command: reportProgramCommandSchema }, ['viewId', 'generation']),
    result: object(
      { packets: { ...array(reportProgramPacketSchema), maxItems: reportNodeLimits.frames } },
      ['packets'],
    ),
    semantics: write,
  },
  'resources.reportRead': {
    params: object(
      {
        ...view,
        path: id,
        offset: count,
        limit: { type: 'integer', minimum: 1, maximum: 262144 },
      },
      ['viewId', 'generation', 'path', 'offset', 'limit'],
    ),
    result: object(
      {
        base64: { type: 'string', maxLength: 349528 },
        offset: count,
        size: count,
        nextOffset: count,
      },
      ['base64', 'offset', 'size'],
    ),
    semantics: read,
  },
  'resources.reportStop': {
    params: binding,
    result: isolationStatusSchema,
    semantics: write,
  },
} as const;
