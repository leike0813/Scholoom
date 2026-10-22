import type { FromSchema } from 'json-schema-to-ts';
import { editorPlatformOperations } from './editor.js';
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

export const platformCommandOperations = {
  'platform.command': {
    params: object(
      {
        workspaceId: id,
        executableId: id,
        args: editorPlatformOperations['platform.editorCommand'].params.properties.args,
        input: editorPlatformOperations['platform.editorCommand'].params.properties.input,
        timeoutMs: editorPlatformOperations['platform.editorCommand'].params.properties.timeoutMs,
      },
      ['workspaceId', 'executableId', 'args', 'timeoutMs'],
    ),
    result: editorPlatformOperations['platform.editorCommand'].result,
    semantics: editorPlatformOperations['platform.editorCommand'].semantics,
  },
} as const;
export type PlatformCommandInput = FromSchema<
  (typeof platformCommandOperations)['platform.command']['params']
>;
export type PlatformCommandResult = FromSchema<
  (typeof platformCommandOperations)['platform.command']['result']
>;
export type PlatformCommandPort = {
  'platform.command': (input: PlatformCommandInput) => Promise<PlatformCommandResult>;
};
