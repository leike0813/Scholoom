import { type BigIntStats, lstatSync, unlinkSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { fileFingerprint } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import type { FileEdit, FileEditOrigin } from '@scholoom/protocol/projects';
import { eq } from 'drizzle-orm';
import { byteBasis, type ProjectFileOwner, type ProjectFiles } from './files.js';
import * as tables from './schema.js';

export type CreationOwner = {
  operationId: string;
  owner: string;
  sessionId?: string;
  runId?: string;
  origin?: FileEditOrigin;
};
type Row = typeof tables.fileOperations.$inferSelect;
interface CreationStore extends ProjectFileOwner {
  files: Pick<ProjectFiles, 'retirePath' | 'changed' | 'coordinate'>;
}

/** Creation receipts belong to the project's existing file operation records. */
export class ProjectCreations {
  constructor(private readonly store: CreationStore) {}

  find(operationId: string, owner?: string): Row | undefined {
    const row = this.store.db
      .select()
      .from(tables.fileOperations)
      .where(eq(tables.fileOperations.id, operationId))
      .get();
    if (
      row &&
      (row.value.kind !== 'create' ||
        (owner !== undefined && row.details.creation?.owner !== owner))
    )
      throw new OperationError('permissionDenied', '操作身份不属于此创建请求。');
    return row;
  }

  async repeat(
    input: string,
    content: string,
    owner: CreationOwner,
  ): Promise<FileEdit | undefined> {
    const row = this.find(owner.operationId, owner.owner);
    if (!row) return undefined;
    if (row.details.params !== JSON.stringify({ path: input, content }))
      throw new OperationError('invalidRequest', '同一创建身份不能使用不同输入。');
    const current = await this.inspect(row);
    if (current.value.state !== 'complete' || !current.details.creation)
      throw new OperationError('outcomeUnknown', '原创建结果尚未确认，请核查原操作。');
    return current.details.creation.edit;
  }

  async prepare(
    input: string,
    edit: FileEdit,
    owner: CreationOwner,
    candidate: string,
    target: string,
  ): Promise<void> {
    const stats = await lstat(candidate, { bigint: true });
    this.store.check('write');
    this.store.db
      .insert(tables.fileOperations)
      .values({
        id: owner.operationId,
        value: {
          id: owner.operationId,
          kind: 'create',
          state: 'prepared',
          path: input,
          ...(edit.fileId ? { fileId: edit.fileId } : {}),
        },
        details: {
          params: JSON.stringify({ path: input, content: edit.after }),
          source: candidate,
          destination: target,
          device: String(stats.dev),
          inode: String(stats.ino),
          birthtime: Number(stats.birthtimeMs),
          creation: {
            owner: owner.owner,
            edit,
            basis: byteBasis(stats),
            birthtimeNs: String(stats.birthtimeNs),
            ...(owner.sessionId ? { sessionId: owner.sessionId } : {}),
            ...(owner.runId ? { runId: owner.runId } : {}),
          },
        },
      })
      .run();
  }

  async inspect(row: Row): Promise<Row> {
    const creation = row.details.creation;
    if (!creation || row.value.state === 'complete' || row.value.state === 'failed') return row;
    let stats: BigIntStats;
    try {
      const target = await this.store.path(row.value.path);
      if (target !== row.details.destination)
        return { ...row, value: { ...row.value, state: 'unknown' } };
      stats = await lstat(row.details.destination, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { ...row, value: { ...row.value, state: 'unknown' } };
    }
    if (
      !stats.isFile() ||
      String(stats.birthtimeNs) !== creation.birthtimeNs ||
      byteBasis(stats) !== creation.basis
    )
      return { ...row, value: { ...row.value, state: 'unknown' } };
    this.store.check('write');
    const edit = { ...creation.edit, basis: creation.basis };
    const fileId = edit.fileId;
    if (!fileId) throw new OperationError('outcomeUnknown', '创建收据缺少文件身份。');
    const complete: Row = {
      ...row,
      value: { ...row.value, state: 'complete' },
      details: { ...row.details, creation: { ...creation, edit } },
    };
    this.store.db.transaction(() => {
      this.store.files.retirePath(creation.edit.path);
      this.store.db
        .insert(tables.fileReferences)
        .values({
          id: fileId,
          path: creation.edit.path,
          value: { fileId, path: creation.edit.path, kind: 'file', state: 'present' },
        })
        .run();
      this.store.db
        .insert(tables.edits)
        .values({ id: edit.id, path: edit.path, value: edit })
        .run();
      // Capture the post-unlink version in the same commit as the completed receipt.
      try {
        unlinkSync(row.details.source);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const published = lstatSync(row.details.destination, { bigint: true });
      if (
        !published.isFile() ||
        String(published.birthtimeNs) !== creation.birthtimeNs ||
        byteBasis(published) !== creation.basis
      )
        throw new OperationError('contentChanged', '原发布结果已变化。');
      this.store.check('write');
      edit.afterEvidence = {
        ref: { source: 'project', projectId: this.store.project.id, fileId },
        basis: fileFingerprint(published),
      };
      this.store.db
        .update(tables.edits)
        .set({ value: edit })
        .where(eq(tables.edits.id, edit.id))
        .run();
      complete.details = {
        ...complete.details,
        creation: {
          ...creation,
          edit,
          resourceBasis: fileFingerprint(published),
        },
      };
      this.store.db
        .update(tables.fileOperations)
        .set({ value: complete.value, details: complete.details })
        .where(eq(tables.fileOperations.id, row.id))
        .run();
    });
    this.store.files.changed();
    return complete;
  }

  async query(operationId: string, owner?: string): Promise<Row> {
    this.store.check('read');
    const row = this.find(operationId, owner);
    if (!row) throw new OperationError('notFound', '创建收据不存在。');
    return this.store.files.coordinate([row.details.destination], async () => {
      const current = this.find(operationId, owner);
      if (!current) throw new OperationError('notFound', '创建收据不存在。');
      const inspected = await this.inspect(current);
      const creation = inspected.details.creation;
      if (inspected.value.state !== 'complete' || !creation || creation.resourceBasis)
        return inspected;
      const target = await this.store.path(creation.edit.path);
      const stats = await lstat(target, { bigint: true });
      if (
        !stats.isFile() ||
        String(stats.birthtimeNs) !== creation.birthtimeNs ||
        byteBasis(stats) !== creation.basis
      )
        throw new OperationError('contentChanged', '原发布结果已变化，不能建立资源读取版本。');
      this.store.check('read');
      // Preserve the first resource version so completed receipts survive later edits/deletion.
      const details = {
        ...inspected.details,
        creation: {
          ...creation,
          resourceBasis: fileFingerprint(stats),
        },
      };
      this.store.db
        .update(tables.fileOperations)
        .set({ details })
        .where(eq(tables.fileOperations.id, inspected.id))
        .run();
      return { ...inspected, details };
    });
  }
}
