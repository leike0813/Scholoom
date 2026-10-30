import type { RunnableConfig } from '@langchain/core/runnables';
import type { Checkpoint, CheckpointMetadata } from '@langchain/langgraph-checkpoint';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import type { ContractParams } from '@scholoom/protocol/core';
import type { GraphResumeInput, GraphWait, InstructionContext } from '@scholoom/protocol/execution';
import type { executionOperations } from '@scholoom/protocol/harness';
import type Database from 'better-sqlite3';

export type Consumption = Pick<
  ContractParams<(typeof executionOperations)['execution.consume']>,
  'checkpointId' | 'checkpointNamespace' | 'instructionIds'
>;

/** Confirmation is part of synchronous durability: a failed acknowledgement stops the graph. */
export class InstructionSaver extends SqliteSaver {
  private readonly known = new Map<string, InstructionContext>();
  constructor(
    db: Database.Database,
    private readonly confirm: (value: Consumption) => Promise<void>,
    private readonly instructions?: {
      instructionRunId: string;
      instructions: InstructionContext[];
    },
  ) {
    super(db);
    this.remember(instructions?.instructions ?? []);
  }
  /** Only complete host updates or a continuation gated by host confirmation enter this registry. */
  remember(instructions: readonly InstructionContext[]): void {
    for (const item of instructions) this.known.set(item.instructionId, item);
  }
  private instructionIds(checkpoint: Checkpoint): string[] {
    const ids: unknown = checkpoint.channel_values.instructionIds;
    if (ids === undefined) return [];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id))
      throw new Error('Invalid checkpoint instruction identities');
    return [...new Set(ids)];
  }
  private async acknowledge(config: RunnableConfig, checkpoint: Checkpoint): Promise<void> {
    const ids = this.instructionIds(checkpoint);
    for (let offset = 0; offset < ids.length; offset += 100)
      await this.confirm({
        checkpointId: checkpoint.id,
        ...(config.configurable?.checkpoint_ns
          ? { checkpointNamespace: config.configurable.checkpoint_ns }
          : {}),
        instructionIds: ids.slice(offset, offset + 100),
      });
  }
  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    this.instructionIds(checkpoint);
    if (this.instructions) {
      const previous = await this.getTuple(config);
      const known = new Map(
        [
          ...((previous?.checkpoint.channel_values.instructions ?? []) as InstructionContext[]),
          ...this.known.values(),
        ].map((item) => [item.instructionId, item]),
      );
      const ids = [
        ...new Set([
          ...((previous?.checkpoint.channel_values.instructionIds ?? []) as string[]),
          ...((checkpoint.channel_values.instructionIds ?? []) as string[]),
        ]),
      ];
      checkpoint = {
        ...checkpoint,
        channel_values: {
          ...checkpoint.channel_values,
          instructionIds: ids,
          instructionRunId: this.instructions.instructionRunId,
          instructions: ids.map((id) => {
            const item = known.get(id);
            if (!item) throw new Error('Graph checkpoint has no complete instruction context');
            return item;
          }),
        },
      };
    }
    const saved = await super.put(config, checkpoint, metadata);
    await this.acknowledge(saved, checkpoint);
    return saved;
  }
  async confirmLatest(config: RunnableConfig): Promise<void> {
    const saved = await this.getTuple(config);
    if (saved && this.instructions && saved.metadata)
      await this.put(saved.config, saved.checkpoint, saved.metadata);
    else if (saved) await this.acknowledge(saved.config, saved.checkpoint);
  }
  /** Keep pending interrupt tasks intact when durably binding host control input. */
  async bindGraph(
    config: RunnableConfig,
    value: { graphResume: GraphResumeInput; instructionIds: string[] } | { graphWait: GraphWait },
  ): Promise<void> {
    const saved = await this.getTuple(config);
    if (!saved?.metadata) throw new Error('Graph checkpoint or metadata missing');
    await this.put(
      saved.config,
      { ...saved.checkpoint, channel_values: { ...saved.checkpoint.channel_values, ...value } },
      saved.metadata,
    );
  }
}
