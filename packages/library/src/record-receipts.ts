import { isDeepStrictEqual } from 'node:util';
import { OperationError } from '@scholoom/protocol/core';
import type { OrganizationReceipt, RecordReceipt } from '@scholoom/protocol/library';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as tables from './schema.js';

export type LibraryStore = BetterSQLite3Database<typeof tables>;
type Receipts = {
  authority: RecordReceipt;
  organization: OrganizationReceipt;
  'organization-history': OrganizationReceipt;
};
export type RecordKind = keyof Receipts;

/** One request namespace and durable outcome for both record and organization edits. */
export class RecordReceipts {
  constructor(private readonly db: LibraryStore) {}

  get<K extends RecordKind>(
    kind: K,
    requestId: string,
    request?: unknown,
  ): Receipts[K] | undefined {
    const row = this.db
      .select()
      .from(tables.recordOperations)
      .where(eq(tables.recordOperations.requestId, requestId))
      .get();
    if (!row) return undefined;
    if (
      row.kind !== kind ||
      (request !== undefined && !isDeepStrictEqual(JSON.parse(row.request), request))
    )
      throw new OperationError('invalidRequest', '请求身份已用于其他操作或内容。');
    return row.value as Receipts[K];
  }

  organization(requestId: string): OrganizationReceipt | undefined {
    const row = this.db
      .select()
      .from(tables.recordOperations)
      .where(eq(tables.recordOperations.requestId, requestId))
      .get();
    if (!row) return undefined;
    if (row.kind === 'authority')
      throw new OperationError('invalidRequest', '请求身份不属于组织操作。');
    return row.value as OrganizationReceipt;
  }

  save<K extends RecordKind>(kind: K, request: { requestId: string }, value: Receipts[K]): void {
    this.db
      .insert(tables.recordOperations)
      .values({
        requestId: request.requestId,
        kind,
        request: JSON.stringify(request),
        value,
      })
      .run();
  }
}
