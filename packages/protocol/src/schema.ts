import type { JSONSchema } from 'json-schema-to-ts';
export const text = { type: 'string' } as const;

export const id = { type: 'string', minLength: 1, maxLength: 1024 } as const;

export const flag = { type: 'boolean' } as const;

export const count = { type: 'integer', minimum: 0 } as const;

export const page = { type: 'integer', minimum: 1, maximum: 100 } as const;

export const content = { type: 'string', maxLength: 262144 } as const;

export const array = <const T extends JSONSchema>(items: T) => ({ type: 'array', items }) as const;

export const object = <
  const P extends Record<string, JSONSchema>,
  const R extends readonly (keyof P & string)[],
>(
  properties: P,
  required: R,
) => ({ type: 'object', properties, required, additionalProperties: false }) as const;

export const ok = object({ ok: { const: true } }, ['ok']);

export const project = { projectId: id } as const;

export const session = { projectId: id, sessionId: id } as const;
