import { failure } from '@scholoom/platform/node';
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import {
  type LibrarySource,
  type OrganizationChange,
  type OrganizationInputs,
  type OrganizationOutputs,
  type OrganizationReceipt,
  organizationLimits,
  validateOrganization,
} from '@scholoom/protocol/library';
import { eq } from 'drizzle-orm';
import { type LibraryStore, type RecordKind, RecordReceipts } from './record-receipts.js';
import type {
  OrganizationFields as Fields,
  OrganizationEdit,
  OrganizationParticipant as Participant,
} from './schema.js';
import * as tables from './schema.js';

type Store = {
  database(): LibraryStore;
  access(libraryId: string, write?: boolean): void;
  source(id: string): LibrarySource;
  validate(source: LibrarySource): void;
  collections(ids: string[]): void;
  tags(tags: string[]): void;
  write(before: LibrarySource, after: LibrarySource): void;
  advance(): void;
  notify(): void;
};
type RejectedResults = Extract<OrganizationReceipt, { state: 'rejected' }>['results'];
type Blocked = { sourceId: string; error: ErrorInfo };
const fields = ['tags', 'collectionIds'] as const;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const sameMembers = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v) => b.includes(v));
const nextRevision = (revision: number) => {
  if (!Number.isSafeInteger(revision + 1))
    throw new OperationError('resourceLimit', '修订已达到安全整数上限。');
  return revision + 1;
};

/** Atomic organization, durable outcomes and revision-protected inverses share the catalog store. */
export class OrganizationEditor {
  constructor(private readonly store: Store) {}
  private get db() {
    return this.store.database();
  }
  private get receipts() {
    return new RecordReceipts(this.db);
  }

  private input(
    method: keyof OrganizationInputs,
    input: { libraryId: string },
    write = false,
  ): void {
    this.store.access(input.libraryId, write);
    if (!validateOrganization(method, 'params', input))
      throw new OperationError('invalidRequest', '组织请求不符合契约。');
    if (bytes(input) > organizationLimits.requestBytes)
      throw new OperationError('resourceLimit', '组织请求超过字节上限。');
  }

  result(
    input: OrganizationInputs['library.organizationResult'],
  ): OrganizationOutputs['library.organizationResult'] {
    this.input('library.organizationResult', input);
    return {
      libraryId: input.libraryId,
      outcome: this.receipts.organization(input.requestId) ?? {
        requestId: input.requestId,
        state: 'notFound',
      },
    };
  }

  organize(input: OrganizationInputs['library.organize']): OrganizationReceipt {
    this.input('library.organize', input, true);
    const previous = this.receipts.get('organization', input.requestId, input);
    if (previous) return previous;
    const value = this.db.transaction<OrganizationReceipt>(() => {
      this.store.access(input.libraryId, true);
      const plans: { before: LibrarySource; after: LibrarySource; participant?: Participant }[] =
        [];
      const blocked: Blocked[] = [];
      for (const change of input.changes) {
        try {
          plans.push(this.plan(change));
        } catch (error) {
          if (!(error instanceof OperationError)) throw error;
          blocked.push({ sourceId: change.sourceId, error: failure(error) });
        }
      }
      if (blocked.length)
        return this.reject(
          'organization',
          input,
          input.changes.map((c) => c.sourceId),
          blocked,
        );
      const participants = plans.flatMap((p) => (p.participant ? [p.participant] : []));
      if (bytes(participants) > organizationLimits.historyBytes)
        return this.reject(
          'organization',
          input,
          input.changes.map((c) => c.sourceId),
          [],
          {
            code: 'resourceLimit',
            message: '组织变更依据超过字节上限，请明确缩小范围。',
          },
        );
      for (const plan of plans) if (plan.participant) this.store.write(plan.before, plan.after);
      const edit: OrganizationEdit = {
        originLibraryId: input.libraryId,
        createdAt: new Date().toISOString(),
        participants,
        editRevision: participants.length ? 1 : 0,
        position: participants.length ? 'applied' : 'unchanged',
        lastActionRequestId: input.requestId,
      };
      const receipt: OrganizationReceipt = {
        libraryId: input.libraryId,
        requestId: input.requestId,
        state: 'committed',
        results: plans.map((p) => ({
          sourceId: p.before.id,
          status: p.participant ? 'applied' : 'unchanged',
          revision: p.after.revision,
        })),
      };
      this.receipts.save('organization', input, receipt);
      this.db
        .insert(tables.organizationEdits)
        .values({ requestId: input.requestId, value: edit })
        .run();
      this.store.advance();
      return receipt;
    });
    this.store.notify();
    return value;
  }

  private plan(change: OrganizationChange) {
    const before = this.store.source(change.sourceId);
    if (before.revision !== change.revision)
      throw new OperationError('contentChanged', '题录已变化，请重新读取。');
    if (change.tags !== undefined) this.store.tags(change.tags);
    if (change.collectionIds !== undefined) this.store.collections(change.collectionIds);
    const old: Fields = {},
      next: Fields = {};
    for (const field of fields) {
      const requested = change[field];
      if (requested !== undefined && !sameMembers(before[field], requested)) {
        old[field] = before[field];
        next[field] = requested;
      }
    }
    if (!Object.keys(next).length) return { before, after: before };
    const after = {
      ...before,
      ...next,
      revision: nextRevision(before.revision),
      updatedAt: new Date().toISOString(),
    };
    this.store.validate(after);
    return {
      before,
      after,
      participant: {
        sourceId: before.id,
        beforeRevision: before.revision,
        expectedRevision: after.revision,
        before: old,
        after: next,
      },
    };
  }

  private reject(
    kind: Exclude<RecordKind, 'authority'>,
    input: { libraryId: string; requestId: string },
    sourceIds: string[],
    blocked: Blocked[],
    error?: ErrorInfo,
  ): OrganizationReceipt {
    const reasons = new Map(blocked.map((item) => [item.sourceId, item.error]));
    const results: RejectedResults = sourceIds.map((sourceId) => {
      const reason = reasons.get(sourceId);
      return reason
        ? { sourceId, status: 'blocked', error: reason }
        : { sourceId, status: 'notApplied' };
    });
    const receipt: OrganizationReceipt = {
      libraryId: input.libraryId,
      requestId: input.requestId,
      state: 'rejected',
      results,
      ...(error ? { error } : {}),
    };
    this.receipts.save(kind, input, receipt);
    this.store.advance();
    return receipt;
  }

  private readEdit(requestId: string): OrganizationEdit {
    const row = this.db
      .select()
      .from(tables.organizationEdits)
      .where(eq(tables.organizationEdits.requestId, requestId))
      .get();
    if (row) return row.value;
    if (this.receipts.organization(requestId))
      throw new OperationError('invalidRequest', '此请求没有可逆组织记录。');
    throw new OperationError('notFound', '组织记录不存在。');
  }

  private eligibility(edit: OrganizationEdit, libraryId: string) {
    const blocked: Blocked[] = [];
    let error: ErrorInfo | undefined;
    if (edit.originLibraryId !== libraryId)
      error = { code: 'instanceMismatch', message: '组织记录属于原库，不能在恢复副本重绑定。' };
    else if (edit.position === 'unchanged')
      error = { code: 'invalidRequest', message: '没有实际组织变化可撤销。' };
    else if (!Number.isSafeInteger(edit.editRevision + 1))
      error = { code: 'resourceLimit', message: '组织记录代次已达到安全整数上限。' };
    else
      for (const participant of edit.participants) {
        try {
          const source = this.store.source(participant.sourceId);
          if (source.revision !== participant.expectedRevision)
            throw new OperationError('contentChanged', '题录有后续修订，不能覆盖。');
          nextRevision(source.revision);
          const target = edit.position === 'applied' ? participant.before : participant.after;
          if (target.collectionIds) this.store.collections(target.collectionIds);
        } catch (reason) {
          if (!(reason instanceof OperationError)) throw reason;
          blocked.push({ sourceId: participant.sourceId, error: failure(reason) });
        }
      }
    return { eligible: !error && !blocked.length, blocked, ...(error ? { error } : {}) };
  }

  edit(
    input: OrganizationInputs['library.organizationEdit'],
  ): OrganizationOutputs['library.organizationEdit'] {
    this.input('library.organizationEdit', input);
    const edit = this.readEdit(input.editRequestId);
    if (
      input.expectedEditRevision !== undefined &&
      input.expectedEditRevision !== edit.editRevision
    )
      throw new OperationError('contentChanged', '组织记录代次已变化。');
    const all: OrganizationOutputs['library.organizationEdit']['changes'] = [];
    for (const p of edit.participants)
      for (const field of fields) {
        const before = p.before[field],
          after = p.after[field];
        if (!before || !after) continue;
        for (const value of new Set([...before, ...after])) {
          const was = before.includes(value),
            now = after.includes(value);
          if (was !== now)
            all.push({ sourceId: p.sourceId, field, value, before: was, after: now });
        }
      }
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const result: OrganizationOutputs['library.organizationEdit'] = {
      libraryId: input.libraryId,
      originLibraryId: edit.originLibraryId,
      editRequestId: input.editRequestId,
      editRevision: edit.editRevision,
      position: edit.position,
      lastActionRequestId: edit.lastActionRequestId,
      eligibility: this.eligibility(edit, input.libraryId),
      changes: [],
    };
    for (const change of all.slice(offset, offset + limit)) {
      result.changes.push(change);
      result.nextOffset = offset + result.changes.length;
      if (bytes(result) > organizationLimits.responseBytes) {
        result.changes.pop();
        break;
      }
    }
    const nextOffset = offset + result.changes.length;
    if (nextOffset < all.length) result.nextOffset = nextOffset;
    else delete result.nextOffset;
    return result;
  }

  revert(input: OrganizationInputs['library.revertOrganization']): OrganizationReceipt {
    this.input('library.revertOrganization', input, true);
    const previous = this.receipts.get('organization-history', input.requestId, input);
    if (previous) return previous;
    const receipt = this.db.transaction<OrganizationReceipt>(() => {
      this.store.access(input.libraryId, true);
      const edit = this.readEdit(input.editRequestId);
      const ids = edit.participants.map((p) => p.sourceId);
      const eligibility = this.eligibility(edit, input.libraryId);
      if (!eligibility.eligible)
        return this.reject(
          'organization-history',
          input,
          ids,
          eligibility.blocked,
          eligibility.error,
        );
      if (
        edit.editRevision !== input.expectedEditRevision ||
        edit.position !== (input.direction === 'undo' ? 'applied' : 'undone')
      )
        return this.reject('organization-history', input, ids, [], {
          code: 'contentChanged',
          message: '组织记录代次或方向已变化。',
        });
      const plans = edit.participants.map((p) => {
        const before = this.store.source(p.sourceId);
        const after = {
          ...before,
          ...(input.direction === 'undo' ? p.before : p.after),
          revision: nextRevision(before.revision),
          updatedAt: new Date().toISOString(),
        };
        this.store.validate(after);
        return { before, after, participant: p };
      });
      for (const plan of plans) this.store.write(plan.before, plan.after);
      const result: OrganizationReceipt = {
        libraryId: input.libraryId,
        requestId: input.requestId,
        state: 'committed',
        results: plans.map((p) => ({
          sourceId: p.before.id,
          status: 'applied',
          revision: p.after.revision,
        })),
      };
      this.receipts.save('organization-history', input, result);
      this.db
        .update(tables.organizationEdits)
        .set({
          value: {
            ...edit,
            editRevision: nextRevision(edit.editRevision),
            position: input.direction === 'undo' ? 'undone' : 'applied',
            lastActionRequestId: input.requestId,
            participants: plans.map(({ participant, after }) => ({
              ...participant,
              expectedRevision: after.revision,
            })),
          },
        })
        .where(eq(tables.organizationEdits.requestId, input.editRequestId))
        .run();
      this.store.advance();
      return result;
    });
    this.store.notify();
    return receipt;
  }
}
