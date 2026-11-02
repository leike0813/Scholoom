import { Ajv } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';
import type { Inputs, Outputs } from './business-types.js';
import type { CallArguments } from './core.js';
import { businessSchemas, changeSchema, type snapshotSchema } from './operations.js';
import { projectLimits } from './projects.js';

export { businessSchemas, changeSchema, snapshotSchema } from './operations.js';

const ajv = new Ajv();
export type WorkbenchSnapshot = FromSchema<typeof snapshotSchema>;
export type WorkbenchChange = FromSchema<typeof changeSchema>;
export type BusinessMethod = keyof typeof businessSchemas;
// Materialized keys keep json-schema-to-ts within the compiler's instantiation limit.
type Complete<T extends Record<BusinessMethod, unknown>> = T;
export type BusinessParams<M extends BusinessMethod> = Complete<Inputs>[M];
export type BusinessResult<M extends BusinessMethod> = Complete<Outputs>[M];
export type BusinessInputs = Complete<Inputs>;
export type BusinessOutputs = Complete<Outputs>;
export const isBusinessMethod = (method: string): method is BusinessMethod =>
  Object.hasOwn(businessSchemas, method);
export const validateBusiness = (
  method: BusinessMethod,
  kind: 'params' | 'result',
  value: unknown,
): boolean =>
  // Ajv caches by schema identity; compile only contracts actually used by this process.
  isBusinessMethod(method) && ajv.compile(businessSchemas[method][kind])(value) === true;
export const isBusinessCall = (
  args: readonly [string, unknown],
): args is CallArguments<BusinessInputs> =>
  isBusinessMethod(args[0]) && validateBusiness(args[0], 'params', args[1]);
export const isWorkbenchChange = ajv.compile<WorkbenchChange>(changeSchema);
export const businessLimits = {
  ...projectLimits,
  messages: 50,
} as const;
