import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { failure } from '@scholoom/platform/node';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import type {
  HarnessModuleInputs,
  HarnessModuleOutputs,
  ResearchSessionPort,
} from '@scholoom/protocol/harness';
import {
  type ResearchGraphCall,
  type ResearchGraphStart,
  type ResearchInputs,
  type ResearchOutputs,
  researchModuleOperations,
  researchOperations,
} from '@scholoom/protocol/research';
import type { ResourceInputs, ResourceOutputs } from '@scholoom/protocol/resources';
import { and, desc, eq, sql } from 'drizzle-orm';
import { assessGraphDelivery, type GraphDeliveryChecks } from './graph-delivery.js';
import type { ResearchGraphs } from './graphs.js';
import type { ResearchRecords } from './records.js';
import { attempts } from './schema.js';

export type ResearchGraphPorts = {
  start(
    input: HarnessModuleInputs['harness.startGraph'],
  ): Promise<HarnessModuleOutputs['harness.startGraph']>;
  executions(
    input: HarnessModuleInputs['harness.executions'],
  ): Promise<HarnessModuleOutputs['harness.executions']>;
  read(
    input: ResourceInputs['resources.read'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.read']>;
};
const startContract = compileContract(researchModuleOperations['research.startGraph']);
const queryContract = compileContract(researchOperations['research.graphCalls']);
// Creation identities must also fit the project's filesystem-safe operation namespace.
export const graphArtifactOperation = (originInstructionId: string, role: string) =>
  `graph_${createHash('sha256')
    .update(JSON.stringify([originInstructionId, role]))
    .digest('hex')}`;

export class ResearchGraphRuntime {
  constructor(
    private readonly catalog: ResearchGraphs,
    private readonly records: (projectId: string) => ResearchRecords['db'],
    private readonly session: ResearchSessionPort,
    private readonly ports: ResearchGraphPorts | undefined,
    private readonly notify: (projectId: string, sessionId: string) => void,
  ) {}

  async start(
    input: ResearchGraphStart,
    context: CallContext,
  ): Promise<{ invocationId: string; instructionId: string; runId: string }> {
    if (context.role !== 'host' || context.principal.kind !== 'system')
      throw new OperationError('permissionDenied', '科研图需要可信宿主启动。');
    if (!startContract.params(input))
      throw new OperationError('invalidRequest', '科研图启动输入无效。');
    if (
      (context.projectId && context.projectId !== input.projectId) ||
      (context.sessionId && context.sessionId !== input.sessionId)
    )
      throw new OperationError('permissionDenied', '科研图不属于当前范围。');
    if (!this.ports) throw new OperationError('unavailable', '科研图执行端口未装配。');
    input = structuredClone(input);
    const graph = this.catalog.select(input.graphId, input.version, input.config);
    const session = await this.session({ projectId: input.projectId, sessionId: input.sessionId });
    if (session.archived) throw new OperationError('invalidRequest', '会话已归档。');
    const db = this.records(input.projectId);
    const id = graphArtifactOperation(input.invocationId, 'call');
    db.transaction((tx) => {
      const other = tx
        .select()
        .from(attempts)
        .where(
          and(
            sql`json_extract(${attempts.value}, '$.kind') = 'graph'`,
            sql`json_extract(${attempts.value}, '$.instructionId') = ${input.instructionId}`,
            sql`${attempts.id} <> ${id}`,
          ),
        )
        .limit(1)
        .get();
      if (other) throw new OperationError('invalidRequest', '启动指令已属于另一科研调用。');
      tx.insert(attempts)
        .values({
          id,
          value: { ...input, kind: 'graph', id, graph, createdAt: new Date().toISOString() },
        })
        .onConflictDoNothing()
        .run();
    });
    const call = db.select().from(attempts).where(eq(attempts.id, id)).get()?.value;
    if (!call || !('kind' in call)) throw new OperationError('unavailable', '科研图调用记录无效。');
    const {
      kind: _kind,
      id: _id,
      graph: _graph,
      createdAt: _createdAt,
      runId: _runId,
      error: _error,
      restoredFromProjectId,
      ...original
    } = call;
    if (restoredFromProjectId)
      throw new OperationError('unavailable', '恢复副本需要核查材料与成果后发起新调用。');
    if (!isDeepStrictEqual(original, input))
      throw new OperationError('invalidRequest', '科研调用身份已用于不同输入。');
    const history = await this.ports.executions({
      projectId: input.projectId,
      sessionId: input.sessionId,
      instructionId: input.instructionId,
      limit: 1,
    });
    const accepted = history.runs[0];
    if (
      accepted &&
      (accepted.graph?.originInstructionId !== input.instructionId ||
        accepted.graph.graphId !== input.graphId ||
        accepted.graph.version !== input.version ||
        !isDeepStrictEqual(accepted.graph.config, input.config) ||
        !isDeepStrictEqual(accepted.graph.materials, input.materials))
    )
      throw new OperationError('invalidRequest', '原指令已绑定不同执行。');
    if (call.runId && !accepted)
      throw new OperationError('outcomeUnknown', '原执行记录当前无法核查。');
    let receipt: { instructionId: string; runId: string };
    try {
      receipt = await this.ports.start({
        projectId: input.projectId,
        sessionId: input.sessionId,
        instructionId: input.instructionId,
        text: input.text,
        execution: {
          kind: 'registered',
          graphId: input.graphId,
          version: input.version,
          config: input.config,
          materials: input.materials,
          workDomain:
            input.projectId === 'application'
              ? { kind: 'application', projectId: 'application', sessionId: input.sessionId }
              : { kind: 'project', projectId: input.projectId, sessionId: input.sessionId },
        },
      });
    } catch (error) {
      try {
        db.update(attempts)
          .set({ value: { ...call, error: failure(error) } })
          .where(eq(attempts.id, id))
          .run();
      } catch {
        throw new OperationError('outcomeUnknown', '执行受理和诊断保存无法确认；请按原身份核查。');
      }
      this.notify(input.projectId, input.sessionId);
      throw error;
    }
    try {
      db.update(attempts)
        .set({
          value: {
            ...original,
            kind: 'graph',
            id: call.id,
            graph: call.graph,
            createdAt: call.createdAt,
            runId: receipt.runId,
          },
        })
        .where(eq(attempts.id, id))
        .run();
    } catch {
      throw new OperationError('outcomeUnknown', '执行已受理，科研关联保存失败；请按原身份查询。');
    }
    this.notify(input.projectId, input.sessionId);
    return { invocationId: input.invocationId, ...receipt };
  }

  async list(
    input: ResearchInputs['research.graphCalls'],
    context: CallContext,
  ): Promise<ResearchOutputs['research.graphCalls']> {
    if (
      !queryContract.params(input) ||
      (input.executionOffset !== undefined && !input.invocationId)
    )
      throw new OperationError('invalidRequest', '科研图查询范围无效。');
    if (
      (context.projectId && context.projectId !== input.projectId) ||
      (context.sessionId && context.sessionId !== input.sessionId)
    )
      throw new OperationError('permissionDenied', '科研图查询不属于当前范围。');
    await this.session({ projectId: input.projectId, sessionId: input.sessionId });
    const limit = input.limit ?? 25;
    const offset = input.offset ?? 0;
    const rows = this.records(input.projectId)
      .select()
      .from(attempts)
      .where(
        and(
          sql`json_extract(${attempts.value}, '$.kind') = 'graph'`,
          sql`json_extract(${attempts.value}, '$.sessionId') = ${input.sessionId}`,
          input.invocationId
            ? sql`json_extract(${attempts.value}, '$.invocationId') = ${input.invocationId}`
            : undefined,
        ),
      )
      .orderBy(desc(sql`json_extract(${attempts.value}, '$.createdAt')`), desc(attempts.id))
      .limit(limit + 1)
      .offset(offset)
      .all();
    const calls: ResearchOutputs['research.graphCalls']['calls'] = [];
    for (const row of rows.slice(0, limit)) {
      if (!('kind' in row.value)) continue;
      const call: ResearchGraphCall = row.value;
      const view: ResearchOutputs['research.graphCalls']['calls'][number] = {
        call,
        executions: [],
      };
      try {
        if (!this.ports) throw new OperationError('unavailable', '科研图执行查询未装配。');
        if (!call.runId) {
          const original = await this.ports.executions({
            projectId: input.projectId,
            sessionId: input.sessionId,
            instructionId: call.instructionId,
            limit: 1,
          });
          const binding = original.runs[0]?.graph;
          if (!original.instruction || !binding)
            throw new OperationError('outcomeUnknown', '尚未核查到原启动指令与执行。');
          if (
            original.instruction.text !== call.text ||
            original.instruction.materials.length ||
            original.instruction.contextItems?.length ||
            binding.originInstructionId !== call.instructionId ||
            binding.graphId !== call.graphId ||
            binding.version !== call.version ||
            !isDeepStrictEqual(binding.config, call.config) ||
            !isDeepStrictEqual(binding.materials, call.materials)
          )
            throw new OperationError('invalidRequest', '原指令与科研调用输入不一致。');
        }
        const history = await this.ports.executions({
          projectId: input.projectId,
          sessionId: input.sessionId,
          originInstructionId: call.instructionId,
          offset: input.executionOffset ?? 0,
          limit: 25,
        });
        if (history.nextOffset !== undefined) view.nextExecutionOffset = history.nextOffset;
        if (!history.runs.length)
          view.error = call.error ?? {
            code: 'outcomeUnknown',
            message: '尚未核查到已受理的图执行。',
          };
        for (const run of history.runs) {
          const checks: GraphDeliveryChecks = { reads: [], artifacts: [] };
          const read = async (resource: {
            ref: ResourceInputs['resources.read']['ref'];
            basis: string;
          }) => {
            if (call.restoredFromProjectId) {
              view.error ??= {
                code: 'unavailable',
                message: '恢复副本的材料与成果引用尚未重新核对。',
              };
              return undefined;
            }
            try {
              return await this.ports?.read(
                { ref: resource.ref, basis: resource.basis, encoding: 'utf8' },
                context,
              );
            } catch (error) {
              view.error ??= failure(error);
              return undefined;
            }
          };
          for (const material of call.materials) {
            const result = await read(material);
            if (result) checks.reads.push(result);
          }
          for (const role of call.graph.delivery.roles) {
            const creation = run.graphProgress?.evidence.creations?.find(
              (item) => item.operationId === graphArtifactOperation(call.instructionId, role),
            );
            if (creation?.state === 'complete') {
              const actual = await read(creation.resource);
              checks.artifacts.push({
                role,
                result: {
                  resource: creation.resource,
                  ...(creation.association ? { association: creation.association } : {}),
                },
                ...(actual ? { read: actual } : {}),
              });
            }
          }
          const check = assessGraphDelivery(call.graph, call.materials, run.graphProgress, checks);
          if (run.state !== 'completed') {
            check.delivery =
              run.state === 'queued' || run.state === 'running' ? 'pending' : 'incomplete';
            if (!check.issues.some((issue) => issue.code === 'executionIncomplete'))
              check.issues.push({ code: 'executionIncomplete' });
          }
          view.executions.push({ run, check });
        }
      } catch (error) {
        view.error = failure(error);
      }
      if (
        Buffer.byteLength(
          JSON.stringify({ calls: [...calls, view], nextOffset: offset + calls.length + 1 }),
        ) >
        512 * 1024
      ) {
        if (!calls.length) throw new OperationError('tooLarge', '科研图查询结果过大。');
        return { calls, nextOffset: offset + calls.length };
      }
      calls.push(view);
    }
    return { calls, ...(rows.length > limit ? { nextOffset: offset + limit } : {}) };
  }
}
