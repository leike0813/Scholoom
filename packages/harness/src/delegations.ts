import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { ProcessReservation } from '@scholoom/platform/node';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type DelegationInputs,
  type DelegationOutputs,
  type DelegationRecord,
  type DelegationReport,
  type DelegationRequest,
  type DelegationRole,
  type DelegationTool,
  delegationInternalOperations,
  delegationRecordSchema,
} from '@scholoom/protocol/harness';
import type { ModelProfile, RunModelConfig } from '@scholoom/protocol/models';
import type {
  ExecutionResourcePort,
  ResourceEvidence,
  ResourceRef,
  ResourceSaveResult,
} from '@scholoom/protocol/resources';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { HarnessRecords } from './records.js';
import { delegations } from './schema.js';

export const defaultDelegationRole: DelegationRole = {
  id: 'worker',
  version: '1',
  guidance:
    '只完成明确工作包。先读取材料，再保存要求的实际成果；报告发现、未完成项和障碍，不把临时文件当成果。',
  tools: [
    'resource.read',
    'resource.describe',
    'resource.document',
    'resource.create',
    'resource.save',
    'resource.creation',
    'scratch',
  ],
};
const requestValidator = compileContract(delegationInternalOperations['harness.delegate']).params;
const reportValidator = compileContract(
  delegationInternalOperations['harness.reportDelegation'],
).params;
const recordValidator = compileContract({ params: delegationRecordSchema, result: true }).params;
const rolesValidator = compileContract(delegationInternalOperations['harness.roles']).result;
export function configuredDelegationRoles(roles: readonly DelegationRole[]): DelegationRole[] {
  const result = structuredClone([defaultDelegationRole, ...roles]);
  if (
    !rolesValidator({ roles: result }) ||
    Buffer.byteLength(JSON.stringify(result), 'utf8') > 131072 ||
    new Set(result.map((role) => role.id)).size !== result.length
  )
    throw new OperationError('invalidRequest', '角色注册不符合契约、身份重复或容量超限。');
  return result;
}
const live = (state: DelegationRecord['state']) =>
  ['accepted', 'running', 'cancelling'].includes(state);
const sameRef = (a: ResourceEvidence['ref'], b: ResourceEvidence['ref']) => isDeepStrictEqual(a, b);
export type DelegationParent = {
  context: CallContext;
  modelConfig: RunModelConfig;
  tools: readonly DelegationTool[];
  check(): void;
  authorize(request: DelegationRequest): Promise<void>;
  reserve(): ProcessReservation;
  resolveProfile(id: string): Promise<ModelProfile>;
  launch(
    record: DelegationRecord,
    reservation: ProcessReservation,
    signal: AbortSignal,
  ): Promise<void>;
};

/** Owns reliable delegation facts and local responsibility; domains own the resources. */
export class Delegations {
  private readonly parents = new Map<string, DelegationParent>();
  private readonly active = new Map<string, { controller: AbortController; done: Promise<void> }>();
  private readonly preparing = new Map<
    string,
    {
      request: DelegationRequest;
      sessionId: string;
      parentInstanceId: string;
      done: Promise<{ delegationId: string }>;
    }
  >();
  private readonly waiting = new Set<string>();
  readonly roles: readonly DelegationRole[];
  constructor(
    private readonly records: HarnessRecords['db'],
    private readonly projectId: string,
    roles: readonly DelegationRole[],
    private readonly notify: (sessionId: string) => void,
  ) {
    this.roles = configuredDelegationRoles(roles);
  }
  initialize(): void {
    for (const { value } of this.records.select().from(delegations).all()) {
      if (live(value.state))
        this.put({
          ...value,
          state: 'interrupted',
          resultState: 'unknown',
          error: { code: 'outcomeUnknown', message: '宿主已重启，请核查原执行与实际成果。' },
        });
    }
  }
  bind(parent: DelegationParent): void {
    if (!parent.context.instanceId) throw new OperationError('instanceMismatch', '缺少父实例。');
    this.parents.set(parent.context.instanceId, parent);
  }
  private parent(context: CallContext): DelegationParent {
    const parent = context.instanceId ? this.parents.get(context.instanceId) : undefined;
    if (
      !parent ||
      parent.context.runId !== context.runId ||
      parent.context.sessionId !== context.sessionId
    )
      throw new OperationError('instanceMismatch', '委派不属于当前父执行。');
    parent.check();
    return parent;
  }
  get(sessionId: string, id: string): DelegationRecord {
    const record = this.records
      .select()
      .from(delegations)
      .where(and(eq(delegations.id, id), eq(delegations.sessionId, sessionId)))
      .get()?.value;
    if (!record) throw new OperationError('notFound', '委派记录不存在。');
    return record;
  }
  list(input: DelegationInputs['delegation.list']): DelegationOutputs['delegation.list'] {
    const limit = Math.min(input.limit ?? 25, 100);
    const rows = this.records
      .select()
      .from(delegations)
      .where(
        and(
          eq(delegations.sessionId, input.sessionId),
          input.cursor === undefined ? undefined : lt(delegations.seq, input.cursor),
        ),
      )
      .orderBy(desc(delegations.seq))
      .limit(limit + 1)
      .all();
    return {
      delegations: rows.slice(0, limit).map(({ value }) => ({
        id: value.id,
        parentRunId: value.parentRunId,
        state: value.state,
        roleId: value.role.id,
        modelConfig: value.modelConfig,
        resultState: value.resultState,
        updatedAt: value.updatedAt,
      })),
      ...(rows.length > limit ? { nextCursor: rows[limit - 1]!.seq } : {}),
    };
  }
  private put(record: DelegationRecord): void {
    record.updatedAt = new Date().toISOString();
    if (!recordValidator(record) || Buffer.byteLength(JSON.stringify(record), 'utf8') > 524288)
      throw new OperationError('resourceLimit', '委派记录不符合契约或容量上限。');
    this.records
      .insert(delegations)
      .values({
        id: record.id,
        sessionId: record.sessionId,
        parentRunId: record.parentRunId,
        childInstanceId: record.childInstanceId!,
        value: record,
      })
      .onConflictDoUpdate({ target: delegations.id, set: { value: record } })
      .run();
    this.notify(record.sessionId);
  }
  delegate(request: DelegationRequest, context: CallContext): Promise<{ delegationId: string }> {
    const parent = this.parent(context);
    if (!requestValidator(request) || Buffer.byteLength(JSON.stringify(request), 'utf8') > 131072)
      throw new OperationError('invalidRequest', '委派输入不合法或超过容量。');
    const previous = this.records
      .select()
      .from(delegations)
      .where(eq(delegations.id, request.delegationId))
      .get()?.value;
    if (previous) {
      if (previous.sessionId !== context.sessionId || !isDeepStrictEqual(previous.request, request))
        throw new OperationError('invalidRequest', '委派身份已用于其他输入。');
      return Promise.resolve({ delegationId: previous.id });
    }
    const preparing = this.preparing.get(request.delegationId);
    if (preparing) {
      if (
        preparing.sessionId !== context.sessionId ||
        preparing.parentInstanceId !== context.instanceId ||
        !isDeepStrictEqual(preparing.request, request)
      )
        throw new OperationError('invalidRequest', '委派身份已用于其他输入。');
      return preparing.done;
    }
    const reservation = parent.reserve();
    const done = this.accept(structuredClone(request), parent, reservation);
    this.preparing.set(request.delegationId, {
      request: structuredClone(request),
      sessionId: context.sessionId!,
      parentInstanceId: context.instanceId!,
      done,
    });
    void done.finally(() => this.preparing.delete(request.delegationId)).catch(() => {});
    return done;
  }
  private async accept(
    request: DelegationRequest,
    parent: DelegationParent,
    reservation: ProcessReservation,
  ) {
    try {
      const role = this.roles.find(
        (role) => role.id === request.roleId && role.version === request.roleVersion,
      );
      if (!role) throw new OperationError('unavailable', '所选角色版本不可用。');
      const profileId = request.modelProfileId ?? role.modelProfileId;
      const profile = profileId ? await parent.resolveProfile(profileId) : undefined;
      await parent.authorize(request);
      parent.check();
      const createdAt = new Date().toISOString();
      const record: DelegationRecord = {
        id: request.delegationId,
        projectId: this.projectId,
        sessionId: parent.context.sessionId!,
        parentRunId: parent.context.runId!,
        parentInstanceId: parent.context.instanceId!,
        childInstanceId: randomUUID(),
        request,
        role,
        tools: request.tools.filter(
          (tool) => role.tools.includes(tool) && parent.tools.includes(tool),
        ),
        modelConfig: profile?.config ?? parent.modelConfig,
        ...(profile ? { modelProfile: profile } : {}),
        state: 'accepted',
        resultState: 'missing',
        createdAt,
        updatedAt: createdAt,
        reads: [],
        artifacts: [],
        creations: [],
        writes: [],
      };
      this.put(record);
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, parent.context.signal!]);
      const done = Promise.resolve()
        .then(() => parent.launch(record, reservation, signal))
        .then(
          () => this.finish(record.sessionId, record.id, signal),
          (error) => this.finish(record.sessionId, record.id, signal, error),
        )
        .finally(() => {
          reservation.release();
          this.active.delete(record.id);
        });
      this.active.set(record.id, { controller, done });
      void done.catch(() => {});
      return { delegationId: record.id };
    } catch (error) {
      reservation.release();
      throw error;
    }
  }
  started(sessionId: string, id: string, childProcessId?: number, parentProcessId?: number): void {
    const record = this.get(sessionId, id);
    if (record.state === 'accepted')
      this.put({
        ...record,
        state: 'running',
        ...(childProcessId ? { childProcessId } : {}),
        ...(parentProcessId ? { parentProcessId } : {}),
      });
  }
  private finish(sessionId: string, id: string, signal: AbortSignal, error?: unknown): void {
    const record = this.get(sessionId, id);
    const unknown = error instanceof OperationError && error.code === 'outcomeUnknown';
    const state = unknown
      ? 'interrupted'
      : signal.aborted
        ? 'cancelled'
        : error
          ? 'failed'
          : 'completed';
    const outputsSaved = record.request.workPackage.outputs.every((output) =>
      record.artifacts.some(({ resource }) =>
        output.kind === 'create'
          ? resource.path === output.path
          : sameRef(resource.ref, output.ref),
      ),
    );
    const complete =
      state === 'completed' &&
      record.report &&
      !record.report.unfinished &&
      !record.report.blockers &&
      outputsSaved &&
      record.artifacts.every((item) => !item.association || item.association.state === 'confirmed');
    const pendingCreation = record.creations.some(
      (item) =>
        item.state === 'pending' ||
        item.state === 'unknown' ||
        (item.state === 'complete' &&
          !record.artifacts.some((saved) => saved.resource.path === item.path)),
    );
    const pendingSave = record.writes.some((item) => item.state !== 'complete');
    this.put({
      ...record,
      state,
      resultState:
        unknown || pendingCreation || pendingSave
          ? 'unknown'
          : complete
            ? 'available'
            : record.artifacts.length
              ? 'partial'
              : 'missing',
      ...(error
        ? {
            error: {
              code: error instanceof OperationError ? error.code : 'unavailable',
              message: error instanceof Error ? error.message : '子执行失败。',
            },
          }
        : {}),
    });
  }
  private child(context: CallContext): DelegationRecord {
    const record = this.records
      .select()
      .from(delegations)
      .where(eq(delegations.childInstanceId, context.instanceId ?? ''))
      .get()?.value;
    if (!record || record.sessionId !== context.sessionId || record.parentRunId !== context.runId)
      throw new OperationError('instanceMismatch', '报告不属于当前子执行。');
    return record;
  }
  report(context: CallContext, report: DelegationReport): void {
    if (!reportValidator(report) || Buffer.byteLength(JSON.stringify(report), 'utf8') > 131072)
      throw new OperationError('invalidRequest', '委派报告不合法或超过容量。');
    const record = this.child(context);
    if (
      report.artifacts.some(
        (item) =>
          !record.artifacts.some(
            (saved) => sameRef(saved.resource.ref, item.ref) && saved.resource.basis === item.basis,
          ),
      )
    )
      throw new OperationError('invalidRequest', '报告包含未确认保存的成果。');
    this.put({ ...record, report: structuredClone(report) });
  }
  read(context: CallContext, evidence: ResourceEvidence): void {
    const record = this.child(context);
    if (record.reads.some((item) => isDeepStrictEqual(item, evidence))) return;
    if (record.reads.length >= 64)
      throw new OperationError('resourceLimit', '实际读取依据数量达到上限。');
    this.put({ ...record, reads: [...record.reads, evidence] });
  }
  saved(context: CallContext, saved: ResourceSaveResult): void {
    const record = this.child(context);
    const artifacts = record.artifacts.filter(
      (item) => !sameRef(item.resource.ref, saved.resource.ref),
    );
    this.put({ ...record, artifacts: [...artifacts, saved], resultState: 'partial' });
  }
  resources(
    context: CallContext,
    port: ExecutionResourcePort,
    check: () => void,
    used: (evidence: ResourceEvidence) => void,
  ): ExecutionResourcePort {
    const allowed = (tool: DelegationTool) => {
      check();
      const record = this.child(context);
      if (!record.tools.includes(tool))
        throw new OperationError('permissionDenied', '工具不在委派范围。');
      return record;
    };
    const readable = (ref: ResourceRef, basis?: string) => {
      const record = this.child(context);
      const evidence: ResourceEvidence[] = [
        ...record.request.workPackage.materials,
        ...record.artifacts.map((item) => ({ ref: item.resource.ref, basis: item.resource.basis })),
        ...record.request.workPackage.outputs.filter((output) => output.kind === 'save'),
      ];
      if (
        !evidence.some(
          (item) => sameRef(item.ref, ref) && (basis === undefined || item.basis === basis),
        )
      )
        throw new OperationError('permissionDenied', '材料或版本不在委派范围。');
    };
    const read = (evidence: ResourceEvidence) => {
      this.read(context, evidence);
      used(evidence);
    };
    return {
      describe: async (locator) => {
        allowed('resource.describe');
        if (locator.source === 'project' && !('fileId' in locator))
          throw new OperationError('permissionDenied', '委派读取需要稳定文件身份。');
        readable(locator as ResourceRef);
        const resource = await port.describe(locator);
        check();
        readable(resource.ref, resource.basis);
        return resource;
      },
      read: async (input) => {
        allowed('resource.read');
        readable(input.ref, input.basis);
        const result = await port.read(input);
        check();
        read({ ref: input.ref, basis: input.basis });
        return result;
      },
      document: async (resource, method, input) => {
        allowed('resource.document');
        readable(resource.ref, resource.basis);
        const result = await port.document(resource, method, input);
        check();
        read(resource);
        return result;
      },
      save: async (input) => {
        const record = allowed('resource.save');
        if (
          input.ref.source !== 'project' ||
          input.ref.projectId !== this.projectId ||
          !record.request.workPackage.outputs.some(
            (output) => output.kind === 'save' && sameRef(output.ref, input.ref),
          )
        )
          throw new OperationError('permissionDenied', '输出不在委派修改范围。');
        if (record.writes.some((item) => sameRef(item.ref, input.ref) && item.state !== 'complete'))
          throw new OperationError('outcomeUnknown', '此资源已有未核清保存，请先核查原效果。');
        const latest = record.artifacts.find((item) => sameRef(item.resource.ref, input.ref));
        if (
          !latest &&
          !record.request.workPackage.outputs.some(
            (output) =>
              output.kind === 'save' &&
              sameRef(output.ref, input.ref) &&
              output.basis === input.basis,
          )
        )
          throw new OperationError('permissionDenied', '首次修改依据不在委派输出范围。');
        if (latest && latest.resource.basis !== input.basis)
          throw new OperationError('contentChanged', '请基于本委派最近保存的版本继续修改。');
        if (record.writes.length >= 64)
          throw new OperationError('resourceLimit', '委派修改数量达到上限。');
        const write = {
          id: randomUUID(),
          ref: input.ref,
          basis: input.basis,
          state: 'pending' as const,
        };
        this.put({ ...record, writes: [...record.writes, write], resultState: 'unknown' });
        const saved = await port.save(input);
        this.saved(context, saved);
        const current = this.child(context);
        this.put({
          ...current,
          writes: current.writes.map((item) =>
            item.id === write.id ? { ...item, state: 'complete' } : item,
          ),
        });
        return saved;
      },
      create: async (input) => {
        const record = allowed('resource.create');
        if (
          input.projectId !== this.projectId ||
          !record.request.workPackage.outputs.some(
            (output) => output.kind === 'create' && output.path === input.path,
          )
        )
          throw new OperationError('permissionDenied', '输出不在委派新建范围。');
        let previous = record.creations.find((item) => item.operationId === input.operationId);
        if (previous && previous.path !== input.path)
          throw new OperationError('invalidRequest', '创建身份已用于其他路径。');
        if (!previous) {
          if (record.creations.length >= 16)
            throw new OperationError('resourceLimit', '委派创建数量达到上限。');
          previous = {
            operationId: input.operationId,
            resourceOperationId: randomUUID(),
            path: input.path,
            state: 'pending',
          };
          this.put({
            ...record,
            creations: [...record.creations, previous],
            resultState: 'unknown',
          });
        }
        const result = await port.create({ ...input, operationId: previous.resourceOperationId });
        this.checkCreationResult(result, previous.path);
        this.creationState(
          context,
          input.operationId,
          result.state === 'prepared' ? 'pending' : result.state,
        );
        if (result.state === 'complete')
          this.saved(context, {
            resource: result.resource,
            ...(result.association ? { association: result.association } : {}),
          });
        return { ...result, operationId: input.operationId };
      },
      creation: async (input) => {
        const record = allowed('resource.creation');
        if (
          input.projectId !== this.projectId ||
          !record.creations.some((item) => item.operationId === input.operationId)
        )
          throw new OperationError('permissionDenied', '只能核查本委派创建操作。');
        const creation = record.creations.find((item) => item.operationId === input.operationId)!;
        const result = await port.creation({ ...input, operationId: creation.resourceOperationId });
        this.checkCreationResult(result, creation.path);
        this.creationState(
          context,
          input.operationId,
          result.state === 'prepared' ? 'pending' : result.state,
        );
        if (result.state === 'complete')
          this.saved(context, {
            resource: result.resource,
            ...(result.association ? { association: result.association } : {}),
          });
        return { ...result, operationId: input.operationId };
      },
    };
  }
  private checkCreationResult(
    result: Awaited<ReturnType<ExecutionResourcePort['creation']>>,
    path: string,
  ): void {
    if (
      result.state === 'complete' &&
      (result.resource.ref.source !== 'project' ||
        result.resource.ref.projectId !== this.projectId ||
        result.resource.path !== path)
    )
      throw new OperationError('outcomeUnknown', '创建结果与委派输出归属不匹配。');
  }
  private creationState(
    context: CallContext,
    operationId: string,
    state: DelegationRecord['creations'][number]['state'],
  ): void {
    const record = this.child(context);
    this.put({
      ...record,
      creations: record.creations.map((item) =>
        item.operationId === operationId ? { ...item, state } : item,
      ),
    });
  }
  cancel(sessionId: string, id: string, context?: CallContext): DelegationRecord {
    const record = this.get(sessionId, id);
    if (context) {
      this.parent(context);
      if (record.parentInstanceId !== context.instanceId)
        throw new OperationError('permissionDenied', '只能停止自己的委派。');
    }
    const active = this.active.get(id);
    if (active && live(record.state)) {
      this.put({ ...record, state: 'cancelling' });
      active.controller.abort(new Error('委派已取消。'));
    }
    return this.get(sessionId, id);
  }
  async wait(id: string, context: CallContext, waitMs = 1000) {
    this.parent(context);
    const record = this.get(context.sessionId!, id);
    if (record.parentInstanceId !== context.instanceId)
      throw new OperationError('permissionDenied', '只能等待自己的委派。');
    const key = context.instanceId!;
    if (this.waiting.has(key))
      throw new OperationError('resourceLimit', '当前父执行已有委派等待。');
    this.waiting.add(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try {
      const active = this.active.get(id);
      if (active)
        await Promise.race([
          active.done,
          new Promise<void>((resolve, reject) => {
            timer = setTimeout(resolve, waitMs);
            abort = () => reject(context.signal?.reason ?? new Error('等待取消。'));
            context.signal?.addEventListener('abort', abort, { once: true });
          }),
        ]);
      const delegation = this.get(context.sessionId!, id);
      return { delegation, timedOut: live(delegation.state) };
    } finally {
      clearTimeout(timer);
      if (abort) context.signal?.removeEventListener('abort', abort);
      this.waiting.delete(key);
    }
  }
  async stopParent(instanceId: string): Promise<void> {
    for (const { value } of this.records
      .select()
      .from(delegations)
      .where(eq(delegations.parentRunId, this.parents.get(instanceId)?.context.runId ?? ''))
      .all()) {
      if (value.parentInstanceId === instanceId) this.cancel(value.sessionId, value.id);
    }
    await Promise.all(
      [...this.active.entries()]
        .filter(
          ([id]) =>
            this.records.select().from(delegations).where(eq(delegations.id, id)).get()?.value
              .parentInstanceId === instanceId,
        )
        .map(([, active]) => active.done),
    );
    this.parents.delete(instanceId);
  }
}
