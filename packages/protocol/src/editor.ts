import type { FromSchema } from 'json-schema-to-ts';
import { array, content, count, flag, id, object, text } from './schema.js';

export const renderFormatSchema = { enum: ['html', 'pdf', 'docx'] } as const;
const location = { projectId: id, path: id, fileId: id } as const;
const diagnostic = object({ code: id, message: text, path: text, line: count }, [
  'code',
  'message',
]);
export const renderOutputSchema = object(
  { id, jobId: id, name: id, format: renderFormatSchema, byteLength: count, createdAt: text },
  ['id', 'jobId', 'name', 'format', 'byteLength', 'createdAt'],
);
export const renderJobSchema = object(
  {
    id,
    ...location,
    format: renderFormatSchema,
    state: {
      enum: [
        'queued',
        'running',
        'completed',
        'failed',
        'cancelling',
        'cancelled',
        'interrupted',
        'unknown',
      ],
    },
    basis: text,
    createdAt: text,
    updatedAt: text,
    dependencies: array(object({ path: id, basis: text }, ['path', 'basis'])),
    diagnostics: array(diagnostic),
    log: { type: 'string', maxLength: 65536 },
    output: renderOutputSchema,
    lastSuccess: renderOutputSchema,
  },
  [
    'id',
    'projectId',
    'path',
    'format',
    'state',
    'basis',
    'createdAt',
    'updatedAt',
    'dependencies',
    'diagnostics',
    'log',
  ],
);
const tool = object({ available: flag, version: text, error: text }, ['available']);
const jsonText = { type: 'string', maxLength: 1048576 } as const;
export const editorOperations = {
  'editor.tools': {
    params: object({}, []),
    result: object({ quarto: tool, pandoc: tool, latexmk: tool }, ['quarto', 'pandoc', 'latexmk']),
    semantics: { effect: 'read', returns: 'result', waitMs: 10000 },
  },
  'editor.convert': {
    params: object(
      {
        projectId: id,
        path: id,
        kind: {
          enum: [
            'capabilities',
            'markdownToAst',
            'astToMarkdown',
            'extensions',
            'bibliography',
            'citationHtml',
          ],
        },
        content,
        json: jsonText,
        format: text,
        options: { type: 'array', items: { type: 'string', maxLength: 1024 }, maxItems: 32 },
        paths: { type: 'array', items: id, maxItems: 100 },
      },
      ['projectId', 'path', 'kind'],
    ),
    result: object({ text: jsonText }, ['text']),
    semantics: { effect: 'read', returns: 'result', waitMs: 30000 },
  },
  'editor.render': {
    params: object({ ...location, operationId: id, automatic: flag, format: renderFormatSchema }, [
      'projectId',
      'path',
      'operationId',
      'format',
    ]),
    result: renderJobSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: 10000 },
  },
  'editor.job': {
    params: object({ projectId: id, jobId: id }, ['projectId', 'jobId']),
    result: renderJobSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'editor.cancel': {
    params: object({ projectId: id, jobId: id }, ['projectId', 'jobId']),
    result: renderJobSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: 10000 },
  },
  'editor.output': {
    params: object(
      {
        projectId: id,
        outputId: id,
        resource: text,
        offset: count,
        limit: { type: 'integer', minimum: 1, maximum: 262144 },
      },
      ['projectId', 'outputId', 'offset'],
    ),
    result: object(
      {
        base64: { type: 'string', maxLength: 349528 },
        byteLength: count,
        nextOffset: count,
        name: id,
      },
      ['base64', 'byteLength', 'name'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 10000 },
  },
  'editor.export': {
    params: object({ projectId: id, outputId: id, operationId: id, path: id }, [
      'projectId',
      'outputId',
      'operationId',
      'path',
    ]),
    result: object({ transferId: id }, ['transferId']),
    semantics: { effect: 'write', returns: 'reference', waitMs: 10000 },
  },
} as const;
export type RenderFormat = FromSchema<typeof renderFormatSchema>;
export type RenderOutput = FromSchema<typeof renderOutputSchema>;
export type RenderJob = FromSchema<typeof renderJobSchema>;
export type EditorInputs = {
  [M in keyof typeof editorOperations]: FromSchema<(typeof editorOperations)[M]['params']>;
};
export type EditorOutputs = {
  [M in keyof typeof editorOperations]: FromSchema<(typeof editorOperations)[M]['result']>;
};
export type EditorPort = {
  [M in keyof EditorInputs]: (input: EditorInputs[M]) => Promise<EditorOutputs[M]>;
};

export const editorPlatformOperations = {
  'platform.editorCommand': {
    params: object(
      {
        workspaceId: id,
        tool: { enum: ['quarto', 'latexmk'] },
        args: { type: 'array', items: { type: 'string', maxLength: 4096 }, maxItems: 128 },
        input: jsonText,
        timeoutMs: { type: 'integer', minimum: 1, maximum: 180000 },
      },
      ['workspaceId', 'tool', 'args', 'timeoutMs'],
    ),
    result: object(
      { code: count, stdout: jsonText, stderr: { type: 'string', maxLength: 65536 } },
      ['code', 'stdout', 'stderr'],
    ),
    semantics: { effect: 'write', returns: 'result', waitMs: 190000 },
  },
} as const;
export type EditorCommandInput = FromSchema<
  (typeof editorPlatformOperations)['platform.editorCommand']['params']
>;
export type EditorCommandResult = FromSchema<
  (typeof editorPlatformOperations)['platform.editorCommand']['result']
>;
