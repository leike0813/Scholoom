import type { RunnableConfig } from '@langchain/core/runnables';
import type { Checkpoint, CheckpointMetadata } from '@langchain/langgraph-checkpoint';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import type { ContractParams } from '@scholoom/protocol/core';
import type { GraphResumeInput, GraphWait } from '@scholoom/protocol/execution';
import type { executionOperations } from '@scholoom/protocol/harness';
import type Database from 'better-sqlite3';

export type Consumption = Pick<
  ContractParams<(typeof executionOperations)['execution.consume']>,
  'checkpointId' | 'instructionIds'
>;

/** Confirmation is part of synchronous durability: a failed acknowledgement stops the graph. */
export class InstructionSaver extends SqliteSaver {
  constructor(
    db: Database.Database,
    private readonly confirm: (value: Consumption) => Promise<void>,
  ) {
    super(db);
  }
  private async acknowledge(checkpoint: Checkpoint): Promise<void> {
    const ids: unknown = checkpoint.channel_values.instructionIds;
    if (ids === undefined) return;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id))
      throw new Error('Invalid checkpoint instruction identities');
    if (ids.length)
      await this.confirm({ checkpointId: checkpoint.id, instructionIds: [...new Set(ids)] });
  }
  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const saved = await super.put(config, checkpoint, metadata);
    await this.acknowledge(checkpoint);
    return saved;
  }
  async confirmLatest(config: RunnableConfig): Promise<void> {
    const saved = await this.getTuple(config);
    if (saved) await this.acknowledge(saved.checkpoint);
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
