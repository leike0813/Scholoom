import type { FromSchema } from 'json-schema-to-ts';
import { array, count, flag, id, object, ok, text } from './schema.js';

export const resourceReferenceSchema = object(
  { id, owner: id, endpoint: id, kind: { enum: ['file', 'directory', 'checkpoint'] } },
  ['id', 'owner', 'endpoint', 'kind'],
);
export type ResourceReference = FromSchema<typeof resourceReferenceSchema>;

export const platformOperations = {
  'platform.read': {
    params: object({ resource: resourceReferenceSchema, path: text, offset: count, limit: count }, [
      'resource',
      'path',
    ]),
    result: object({ base64: text, byteLength: count, nextOffset: count }, [
      'base64',
      'byteLength',
    ]),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'platform.list': {
    params: object({ resource: resourceReferenceSchema, path: text, offset: count, limit: count }, [
      'resource',
      'path',
    ]),
    result: object(
      {
        entries: array(object({ name: id, directory: flag }, ['name', 'directory'])),
        nextOffset: count,
      },
      ['entries'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'platform.process.stop': {
    params: object({ instanceId: id }, ['instanceId']),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 10000 },
  },
} as const;
