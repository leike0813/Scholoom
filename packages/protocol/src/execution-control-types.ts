// Generated from executionControlOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { executionControlOperations } from './execution-contracts.js';

export type Inputs = {
  'execution.beforeModel': FromSchema<
    (typeof executionControlOperations)['execution.beforeModel']['params']
  >;
  'execution.consume': FromSchema<
    (typeof executionControlOperations)['execution.consume']['params']
  >;
  'execution.custom': FromSchema<(typeof executionControlOperations)['execution.custom']['params']>;
  'execution.files.delete': FromSchema<
    (typeof executionControlOperations)['execution.files.delete']['params']
  >;
  'execution.files.download': FromSchema<
    (typeof executionControlOperations)['execution.files.download']['params']
  >;
  'execution.files.edit': FromSchema<
    (typeof executionControlOperations)['execution.files.edit']['params']
  >;
  'execution.files.glob': FromSchema<
    (typeof executionControlOperations)['execution.files.glob']['params']
  >;
  'execution.files.grep': FromSchema<
    (typeof executionControlOperations)['execution.files.grep']['params']
  >;
  'execution.files.ls': FromSchema<
    (typeof executionControlOperations)['execution.files.ls']['params']
  >;
  'execution.files.read': FromSchema<
    (typeof executionControlOperations)['execution.files.read']['params']
  >;
  'execution.files.readRaw': FromSchema<
    (typeof executionControlOperations)['execution.files.readRaw']['params']
  >;
  'execution.files.upload': FromSchema<
    (typeof executionControlOperations)['execution.files.upload']['params']
  >;
  'execution.files.write': FromSchema<
    (typeof executionControlOperations)['execution.files.write']['params']
  >;
  'execution.health': FromSchema<(typeof executionControlOperations)['execution.health']['params']>;
  'execution.initialize': FromSchema<
    (typeof executionControlOperations)['execution.initialize']['params']
  >;
  'execution.instructions': FromSchema<
    (typeof executionControlOperations)['execution.instructions']['params']
  >;
  'execution.modelUpdate': FromSchema<
    (typeof executionControlOperations)['execution.modelUpdate']['params']
  >;
  'execution.next': FromSchema<(typeof executionControlOperations)['execution.next']['params']>;
  'execution.stop': FromSchema<(typeof executionControlOperations)['execution.stop']['params']>;
  'execution.tool': FromSchema<(typeof executionControlOperations)['execution.tool']['params']>;
  'execution.wrapModel': FromSchema<
    (typeof executionControlOperations)['execution.wrapModel']['params']
  >;
  'execution.wrapTool': FromSchema<
    (typeof executionControlOperations)['execution.wrapTool']['params']
  >;
  'model.acquire': FromSchema<(typeof executionControlOperations)['model.acquire']['params']>;
  'model.release': FromSchema<(typeof executionControlOperations)['model.release']['params']>;
  'resources.create': FromSchema<(typeof executionControlOperations)['resources.create']['params']>;
  'resources.creation': FromSchema<
    (typeof executionControlOperations)['resources.creation']['params']
  >;
  'resources.describe': FromSchema<
    (typeof executionControlOperations)['resources.describe']['params']
  >;
  'resources.document': FromSchema<
    (typeof executionControlOperations)['resources.document']['params']
  >;
  'resources.read': FromSchema<(typeof executionControlOperations)['resources.read']['params']>;
  'resources.save': FromSchema<(typeof executionControlOperations)['resources.save']['params']>;
};
export type Outputs = {
  'execution.beforeModel': FromSchema<
    (typeof executionControlOperations)['execution.beforeModel']['result']
  >;
  'execution.consume': FromSchema<
    (typeof executionControlOperations)['execution.consume']['result']
  >;
  'execution.custom': FromSchema<(typeof executionControlOperations)['execution.custom']['result']>;
  'execution.files.delete': FromSchema<
    (typeof executionControlOperations)['execution.files.delete']['result']
  >;
  'execution.files.download': FromSchema<
    (typeof executionControlOperations)['execution.files.download']['result']
  >;
  'execution.files.edit': FromSchema<
    (typeof executionControlOperations)['execution.files.edit']['result']
  >;
  'execution.files.glob': FromSchema<
    (typeof executionControlOperations)['execution.files.glob']['result']
  >;
  'execution.files.grep': FromSchema<
    (typeof executionControlOperations)['execution.files.grep']['result']
  >;
  'execution.files.ls': FromSchema<
    (typeof executionControlOperations)['execution.files.ls']['result']
  >;
  'execution.files.read': FromSchema<
    (typeof executionControlOperations)['execution.files.read']['result']
  >;
  'execution.files.readRaw': FromSchema<
    (typeof executionControlOperations)['execution.files.readRaw']['result']
  >;
  'execution.files.upload': FromSchema<
    (typeof executionControlOperations)['execution.files.upload']['result']
  >;
  'execution.files.write': FromSchema<
    (typeof executionControlOperations)['execution.files.write']['result']
  >;
  'execution.health': FromSchema<(typeof executionControlOperations)['execution.health']['result']>;
  'execution.initialize': FromSchema<
    (typeof executionControlOperations)['execution.initialize']['result']
  >;
  'execution.instructions': FromSchema<
    (typeof executionControlOperations)['execution.instructions']['result']
  >;
  'execution.modelUpdate': FromSchema<
    (typeof executionControlOperations)['execution.modelUpdate']['result']
  >;
  'execution.next': FromSchema<(typeof executionControlOperations)['execution.next']['result']>;
  'execution.stop': FromSchema<(typeof executionControlOperations)['execution.stop']['result']>;
  'execution.tool': FromSchema<(typeof executionControlOperations)['execution.tool']['result']>;
  'execution.wrapModel': FromSchema<
    (typeof executionControlOperations)['execution.wrapModel']['result']
  >;
  'execution.wrapTool': FromSchema<
    (typeof executionControlOperations)['execution.wrapTool']['result']
  >;
  'model.acquire': FromSchema<(typeof executionControlOperations)['model.acquire']['result']>;
  'model.release': FromSchema<(typeof executionControlOperations)['model.release']['result']>;
  'resources.create': FromSchema<(typeof executionControlOperations)['resources.create']['result']>;
  'resources.creation': FromSchema<
    (typeof executionControlOperations)['resources.creation']['result']
  >;
  'resources.describe': FromSchema<
    (typeof executionControlOperations)['resources.describe']['result']
  >;
  'resources.document': FromSchema<
    (typeof executionControlOperations)['resources.document']['result']
  >;
  'resources.read': FromSchema<(typeof executionControlOperations)['resources.read']['result']>;
  'resources.save': FromSchema<(typeof executionControlOperations)['resources.save']['result']>;
};
