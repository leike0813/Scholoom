import { array, count, flag, id, object, text } from './schema.js';

export const encodedBytesSchema = {
  type: 'string',
  pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
} as const;
const bytes = object({ base64: encodedBytesSchema }, ['base64']);
const data = {
  anyOf: [
    object({ content: array(text), created_at: text, modified_at: text }, [
      'content',
      'created_at',
      'modified_at',
    ]),
    object(
      { content: { anyOf: [text, bytes] }, mimeType: text, created_at: text, modified_at: text },
      ['content', 'mimeType', 'created_at', 'modified_at'],
    ),
  ],
} as const;
const info = object({ path: text, is_dir: flag, size: count, modified_at: text }, ['path']);
const metadata = { type: 'object', additionalProperties: true } as const;
const updates = {
  anyOf: [{ const: null }, { type: 'object', additionalProperties: data }],
} as const;
const writeResult = { error: text, path: text, filesUpdate: updates, metadata } as const;
const token = { token: id } as const;
const read = { effect: 'read', returns: 'result', waitMs: 35000 } as const;
const write = { ...read, effect: 'write' } as const;

export const executionFileOperations = {
  'execution.files.ls': {
    params: object({ path: text, ...token }, ['path']),
    result: object({ error: text, files: array(info) }, []),
    semantics: read,
  },
  'execution.files.read': {
    params: object({ path: text, offset: count, limit: count, ...token }, ['path']),
    result: object(
      {
        error: text,
        content: { anyOf: [text, bytes] },
        mimeType: text,
        totalLines: count,
        startLine: count,
        endLine: count,
        nextOffset: count,
      },
      [],
    ),
    semantics: read,
  },
  'execution.files.readRaw': {
    params: object({ path: text, ...token }, ['path']),
    result: object({ error: text, data }, []),
    semantics: read,
  },
  'execution.files.write': {
    params: object({ path: text, content: text, ...token }, ['path', 'content']),
    result: object(writeResult, []),
    semantics: write,
  },
  'execution.files.edit': {
    params: object({ path: text, oldString: text, newString: text, replaceAll: flag, ...token }, [
      'path',
      'oldString',
      'newString',
    ]),
    result: object({ ...writeResult, occurrences: count }, []),
    semantics: write,
  },
  'execution.files.glob': {
    params: object({ pattern: text, path: text, ...token }, ['pattern']),
    result: object({ error: text, files: array(info), truncated: flag }, []),
    semantics: read,
  },
  'execution.files.grep': {
    params: object(
      {
        pattern: text,
        path: { anyOf: [text, { const: null }] },
        glob: { anyOf: [text, { const: null }] },
        maxCount: { anyOf: [count, { const: null }] },
        ...token,
      },
      ['pattern'],
    ),
    result: object(
      {
        error: text,
        matches: array(object({ path: text, line: count, text }, ['path', 'line', 'text'])),
        truncated: flag,
      },
      [],
    ),
    semantics: read,
  },
  'execution.files.delete': {
    params: object({ path: text, ...token }, ['path']),
    result: object(
      {
        error: text,
        path: text,
        filesUpdate: {
          anyOf: [{ const: null }, { type: 'object', additionalProperties: { const: null } }],
        },
        metadata,
      },
      [],
    ),
    semantics: write,
  },
} as const;
