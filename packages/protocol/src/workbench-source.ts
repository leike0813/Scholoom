import type { FromSchema } from 'json-schema-to-ts';
import { id, object } from './schema.js';

export const workbenchSourceSchema = object({ connectionId: id }, ['connectionId']);
export type WorkbenchSource = FromSchema<typeof workbenchSourceSchema>;
