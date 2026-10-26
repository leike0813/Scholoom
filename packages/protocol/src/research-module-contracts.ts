import { fileReferenceSchema } from './project-file-contracts.js';
import {
  researchAttemptSchema,
  researchGraphReceiptSchema,
  researchGraphStartSchema,
  researchRequestSchema,
} from './research-contracts.js';
import { id, object, ok, text } from './schema.js';
export const researchModuleOperations = {
  'research.startGraph': {
    params: researchGraphStartSchema,
    result: researchGraphReceiptSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
  },
  'research.invoke': {
    params: researchRequestSchema,
    result: researchAttemptSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
  'research.progress': {
    params: object(
      {
        attemptId: id,
        event: {
          anyOf: [
            object({ kind: { enum: ['read', 'saved'] }, file: fileReferenceSchema }, [
              'kind',
              'file',
            ]),
            object({ kind: { const: 'failed' }, issue: text }, ['kind', 'issue']),
          ],
        },
      },
      ['attemptId', 'event'],
    ),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
