import type { BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { RpcPeer } from '@scholoom/broker/rpc';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type ExecutionControlInputs,
  type ExecutionControlProviders,
  type GraphDefinition,
  type GraphExecution,
  type GraphWait,
  graphDefinitionSchema,
  type InstructionContext,
  registeredGraphSchema,
} from '@scholoom/protocol/execution';
import type { InstructionSaver } from './checkpoint.js';

const definitionContract = compileContract({ params: graphDefinitionSchema, result: true });
const selectionContract = compileContract({ params: registeredGraphSchema, result: true });

export type RegisteredGraphInput = Extract<
  ExecutionControlInputs['execution.initialize'],
  { graph: unknown }
>;
export type GraphDriver = Pick<ExecutionControlProviders, 'execution.next'> & { close?(): void };
export type AgentState = {
  messages: BaseMessage[];
  instructionIds: string[];
  instructionRunId: string;
  instructions: InstructionContext[];
};
/** Selected by trusted factory source; graph configuration never grants tools. */
export type AgentNodeOptions = {
  tools: readonly string[];
  systemPrompt: string;
  /** Runs before SDK result offloading; source factories may reject an oversized reply. */
  prepareToolResult?(name: string, args: Record<string, unknown>, result: string): string;
};
export type AgentConsumer = {
  /** Invoke once per SDK node/task with its original config; return these channels to the outer graph. */
  invoke(state: AgentState, config: RunnableConfig, options: AgentNodeOptions): Promise<AgentState>;
};
export type GraphFactory = {
  definition: GraphDefinition;
  resume?(
    wait: GraphWait,
    messages: readonly (InstructionContext & { id: string; text: string })[],
  ): { value: unknown; instructionIds: string[] } | undefined;
  create(
    input: RegisteredGraphInput,
    context: {
      peer: RpcPeer;
      signal: AbortSignal;
      checkpointer?: InstructionSaver;
      agent: AgentConsumer;
    },
  ): GraphDriver | Promise<GraphDriver>;
};

/** Host discovery and worker construction share the same source registrations. */
export class ExecutionGraphs {
  private readonly graphs = new Map<
    string,
    Map<string, { factory: GraphFactory; valid: ReturnType<typeof compileContract>['params'] }>
  >();

  constructor(factories: readonly GraphFactory[] = []) {
    for (const factory of factories) {
      if (!definitionContract.params(factory.definition))
        throw new OperationError('invalidRequest', '图登记描述不符合契约。');
      const { graphId, version, configSchema } = factory.definition;
      const versions = this.graphs.get(graphId) ?? new Map();
      if (versions.has(version))
        throw new OperationError('invalidRequest', '图身份及版本重复登记。');
      versions.set(version, {
        factory,
        valid: compileContract({ params: configSchema, result: true }).params,
      });
      this.graphs.set(graphId, versions);
    }
  }

  resolve(selection: Extract<GraphExecution, { kind: 'registered' }>): GraphFactory {
    if (!selectionContract.params(selection))
      throw new OperationError('invalidRequest', '图选择不符合契约。');
    const versions = this.graphs.get(selection.graphId);
    if (!versions) throw new OperationError('unavailable', '所选图未装配。');
    const registration = versions.get(selection.version);
    if (!registration)
      throw new OperationError('protocolIncompatible', '所选图版本与当前装配不符。');
    if (!registration.valid(selection.config))
      throw new OperationError('invalidRequest', '图配置不符合登记的 schema。');
    return registration.factory;
  }
}
