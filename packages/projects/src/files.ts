import { randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { link, lstat, mkdir, open, opendir, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { failure, fileFingerprint, privateDirectory } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import {
  type FileLocation,
  type FileOperation,
  type Project,
  projectLimits,
} from '@scholoom/protocol/projects';
import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as tables from './schema.js';

type ProjectDatabase = BetterSQLite3Database<typeof tables>;

/** Minimal owner surface ProjectFiles depends on; ProjectStore supplies the implementation. */
export interface ProjectFileOwner {
  readonly db: ProjectDatabase;
  readonly project: Project;
  readonly internal: string;
  path(input: string, create?: boolean): Promise<string>;
  check(operation: 'read' | 'write' | 'send'): void;
  invalidateBases(paths: string[]): void;
  touch(): void;
}

const contains = (parent: string, child: string) =>
  parent === child || child.startsWith(`${parent}/`);
const info = (path: string) =>
  lstat(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  });
const byteBasis = (stat: BigIntStats) => [stat.dev, stat.ino, stat.size, stat.mtimeNs].join(':');

export class ProjectFiles {
  private locks: { paths: string[]; done: Promise<void> }[] = [];
  constructor(private readonly store: ProjectFileOwner) {}

  async settle(): Promise<void> {
    await Promise.all(this.locks.map((lock) => lock.done));
  }

  get revision(): number {
    return Number(
      this.store.db.select().from(tables.meta).where(eq(tables.meta.key, 'file-revision')).get()
        ?.value ?? 0,
    );
  }
  changed(): void {
    this.store.db
      .insert(tables.meta)
      .values({ key: 'file-revision', value: String(this.revision + 1) })
      .onConflictDoUpdate({ target: tables.meta.key, set: { value: String(this.revision + 1) } })
      .run();
    this.store.touch();
  }

  async coordinate<T>(paths: string[], run: () => Promise<T>): Promise<T> {
    const normalized = paths.map((path) => path.split(sep).join('/'));
    const previous = this.locks.filter((lock) =>
      lock.paths.some((a) => normalized.some((b) => contains(a, b) || contains(b, a))),
    );
    let release = () => {};
    const lock = {
      paths: normalized,
      done: new Promise<void>((resolve) => {
        release = resolve;
      }),
    };
    this.locks.push(lock);
    try {
      await Promise.all(previous.map((item) => item.done));
      return await run();
    } finally {
      release();
      this.locks = this.locks.filter((item) => item !== lock);
    }
  }

  private put(location: FileLocation): FileLocation {
    this.store.db
      .insert(tables.fileReferences)
      .values({ id: location.fileId, path: location.path, value: location })
      .onConflictDoUpdate({
        target: tables.fileReferences.id,
        set: { path: location.path, value: location },
      })
      .run();
    return location;
  }

  async reference(input: string, fresh = false): Promise<FileLocation> {
    const absolute = await this.store.path(input);
    const path = relative(this.store.project.path, absolute).split(sep).join('/');
    const stats = await lstat(absolute);
    const pending = this.store.db
      .select()
      .from(tables.fileOperations)
      .where(
        sql`json_extract(${tables.fileOperations.value}, '$.state') IN ('prepared', 'unknown') AND json_extract(${tables.fileOperations.value}, '$.kind') != 'mkdir' AND (${absolute} = json_extract(${tables.fileOperations.details}, '$.destination') OR substr(${absolute}, 1, length(json_extract(${tables.fileOperations.details}, '$.destination')) + 1) = json_extract(${tables.fileOperations.details}, '$.destination') || ${sep})`,
      )
      .limit(101)
      .all();
    if (pending.length > 100)
      throw new OperationError('resourceLimit', '待核查操作过多，请先核查操作回执。');
    if (pending.length)
      throw new OperationError('outcomeUnknown', '该位置有待核查操作，请先核查原回执。');
    const record = this.store.db
      .select()
      .from(tables.fileReferences)
      .where(eq(tables.fileReferences.path, path))
      .all()
      .find((item) => item.value.state === 'present');
    if (record && !fresh && record.value.kind === (stats.isDirectory() ? 'dir' : 'file'))
      return record.value;
    if (record) this.put({ ...record.value, state: 'missing' });
    if (stats.isSymbolicLink() || (!stats.isFile() && !stats.isDirectory()))
      throw new OperationError('permissionDenied', '不支持链接或特殊文件。');
    return this.put({
      fileId: randomUUID(),
      path,
      kind: stats.isDirectory() ? 'dir' : 'file',
      state: 'present',
    });
  }

  retirePath(path: string): void {
    const records = this.store.db
      .select()
      .from(tables.fileReferences)
      .where(eq(tables.fileReferences.path, path))
      .all();
    for (const row of records)
      if (row.value.state === 'present') this.put({ ...row.value, state: 'missing' });
  }

  private async trashRoot(): Promise<string> {
    const root = join(this.store.internal, 'trash');
    await privateDirectory(root);
    if ((await realpath(root)) !== root)
      throw new OperationError('permissionDenied', '回收目录不安全。');
    return root;
  }

  location(id: string): FileLocation {
    const record = this.store.db
      .select()
      .from(tables.fileReferences)
      .where(eq(tables.fileReferences.id, id))
      .get();
    if (!record) throw new OperationError('notFound', '文件引用不存在。');
    return record.value;
  }
  async resolve(ids: string[]): Promise<FileLocation[]> {
    this.store.check('read');
    return Promise.all(
      ids.slice(0, 100).map(async (id) => {
        const value = this.location(id);
        if (value.state !== 'present') return value;
        try {
          await this.store.path(value.path);
          return value;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return { ...value, state: 'missing' as const };
          throw error;
        }
      }),
    );
  }

  async readBytes(
    fileId: string,
    options: { basis?: string; offset?: number; limit?: number } = {},
  ): Promise<{
    fileId: string;
    path: string;
    basis: string;
    size: number;
    offset: number;
    data: string;
    nextOffset?: number;
  }> {
    this.store.check('read');
    const offset = options.offset ?? 0;
    const limit = options.limit ?? projectLimits.binaryChunkBytes;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > projectLimits.binaryChunkBytes
    )
      throw new OperationError('invalidRequest', '读取范围无效。');
    const location = this.location(fileId);
    if (location.state !== 'present' || location.kind !== 'file')
      throw new OperationError('notFound', '文件身份不存在或已失效。');
    const path = location.path;
    const target = await this.store.path(path);
    return this.coordinate([target], async () => {
      this.store.check('read');
      if (
        this.location(fileId).state !== 'present' ||
        this.location(fileId).path !== path ||
        (await this.store.path(path)) !== target
      )
        throw new OperationError('contentChanged', '文件位置或身份已变化。');
      const located = await lstat(target, { bigint: true });
      if (located.isSymbolicLink() || !located.isFile())
        throw new OperationError('targetAmbiguous', '目标不是普通文件。');
      const handle = await open(
        target,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
      );
      try {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || before.dev !== located.dev || before.ino !== located.ino)
          throw new OperationError('contentChanged', '文件身份已变化。');
        const basis = byteBasis(before);
        if (options.basis !== undefined && options.basis !== basis)
          throw new OperationError('contentChanged', '文件内容已变化，请重新读取。');
        const size = Number(before.size);
        if (size > projectLimits.binaryFileBytes)
          throw new OperationError('resourceLimit', '文件超过二进制读取上限。');
        if (offset > size) throw new OperationError('invalidRequest', '读取位置超出文件范围。');
        const buffer = Buffer.alloc(Math.min(limit, size - offset));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        const after = await handle.stat({ bigint: true });
        let current: BigIntStats;
        try {
          current = await lstat(target, { bigint: true });
        } catch {
          throw new OperationError('contentChanged', '读取期间文件已移除或替换。');
        }
        this.store.check('read');
        if (
          this.location(fileId).state !== 'present' ||
          this.location(fileId).path !== path ||
          (await this.store.path(path)) !== target ||
          byteBasis(after) !== basis ||
          byteBasis(current) !== basis
        )
          throw new OperationError('contentChanged', '读取期间文件或身份已变化。');
        return {
          fileId,
          path,
          basis,
          size,
          offset,
          data: buffer.subarray(0, bytesRead).toString('base64'),
          ...(offset + bytesRead < size ? { nextOffset: offset + bytesRead } : {}),
        };
      } finally {
        await handle.close();
      }
    });
  }
  currentPath(id: string): string {
    const value = this.location(id);
    if (value.state !== 'present')
      throw new OperationError('notFound', '原文件已回收或缺失，请核查文件位置。');
    return value.path;
  }

  trashList(offset = 0, limit = 100): { entries: FileLocation[]; nextOffset?: number } {
    this.store.check('read');
    const rows = this.store.db
      .select({ value: tables.fileReferences.value })
      .from(tables.fileOperations)
      .innerJoin(
        tables.fileReferences,
        sql`${tables.fileReferences.id} = json_extract(${tables.fileOperations.value}, '$.fileId')`,
      )
      .where(
        sql`json_extract(${tables.fileOperations.value}, '$.kind') = 'trash' AND json_extract(${tables.fileOperations.value}, '$.state') = 'complete' AND json_extract(${tables.fileReferences.value}, '$.state') = 'trashed'`,
      )
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      entries: rows.slice(0, limit).map((row) => row.value),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }

  async treeSnapshot(input: string): Promise<{ path: string; basis: string }[]> {
    this.store.check('read');
    return this.safeTree(await this.store.path(input));
  }

  private async safeTree(root: string): Promise<{ path: string; basis: string }[]> {
    const queue = [root];
    const snapshot: { path: string; basis: string }[] = [];
    let seen = 0;
    while (queue.length) {
      const path = queue.shift() as string;
      if (++seen > 10000) throw new OperationError('resourceLimit', '目录超过本次结构操作范围。');
      const stats = await lstat(path, { bigint: true });
      if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile()))
        throw new OperationError('permissionDenied', '目录包含链接或特殊文件，请先处理。');
      await this.store.path(relative(this.store.project.path, path));
      snapshot.push({
        path: relative(this.store.project.path, path).split(sep).join('/'),
        basis: fileFingerprint(stats),
      });
      if (stats.isDirectory()) {
        for await (const entry of await opendir(path)) {
          if (seen + queue.length >= 10000)
            throw new OperationError('resourceLimit', '目录超过本次结构操作范围。');
          queue.push(join(path, entry.name));
        }
      }
    }
    return snapshot.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async bindHistory(path: string): Promise<void> {
    const edits = this.store.db
      .select()
      .from(tables.edits)
      .where(
        sql`${tables.edits.path} = ${path} OR substr(${tables.edits.path}, 1, ${path.length + 1}) = ${`${path}/`}`,
      )
      .limit(10001)
      .all();
    const artifacts = this.store.db
      .select()
      .from(tables.artifacts)
      .where(
        sql`json_extract(${tables.artifacts.value}, '$.path') = ${path} OR substr(json_extract(${tables.artifacts.value}, '$.path'), 1, ${path.length + 1}) = ${`${path}/`}`,
      )
      .limit(10001)
      .all();
    if (edits.length > 10000 || artifacts.length > 10000)
      throw new OperationError('resourceLimit', '关联记录超过本次操作范围。');
    for (const edit of edits)
      if (!edit.value.fileId) {
        const entry = await this.reference(edit.path).catch(() => undefined);
        if (entry)
          this.store.db
            .update(tables.edits)
            .set({ value: { ...edit.value, fileId: entry.fileId } })
            .where(eq(tables.edits.id, edit.id))
            .run();
      }
    for (const artifact of artifacts)
      if (!artifact.value.fileId && contains(path, artifact.value.path)) {
        const entry = await this.reference(artifact.value.path).catch(() => undefined);
        if (entry)
          this.store.db
            .update(tables.artifacts)
            .set({ value: { ...artifact.value, fileId: entry.fileId } })
            .where(eq(tables.artifacts.key, artifact.key))
            .run();
      }
  }

  async mutate(
    kind: FileOperation['kind'],
    operationId: string,
    input: {
      path?: string;
      name?: string;
      trashId?: string;
      destination?: string;
      expectedFileId?: string;
      expectedBasis?: string;
      expectedTree?: { path: string; basis: string }[];
    },
  ): Promise<FileOperation> {
    this.store.check('write');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId))
      throw new OperationError('invalidRequest', '操作身份格式无效。');
    const params = JSON.stringify({ kind, ...input });
    const prior = this.store.db
      .select()
      .from(tables.fileOperations)
      .where(eq(tables.fileOperations.id, operationId))
      .get();
    if (prior) {
      if (prior.details.params !== params)
        throw new OperationError('invalidRequest', '操作身份已经用于其他参数。');
      return this.operation(operationId);
    }
    let path = input.path ?? '';
    let location: FileLocation | undefined;
    if (kind === 'restore') {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.trashId ?? ''))
        throw new OperationError('invalidRequest', '回收身份无效。');
      await this.trashRoot();
      await privateDirectory(join(this.store.internal, 'trash', input.trashId as string));
      if (
        this.store.db
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, `incomplete-trash:${input.trashId}`))
          .get()
      )
        throw new OperationError('unavailable', '该备份的回收载荷不完整，请核查备份缺项。');
      const record = this.store.db
        .select()
        .from(tables.fileOperations)
        .where(eq(tables.fileOperations.id, input.trashId ?? ''))
        .get();
      if (record?.value.kind !== 'trash' || !record.value.fileId)
        throw new OperationError('notFound', '回收记录不存在。');
      location = this.location(record.value.fileId);
      if (location.state !== 'trashed' || location.trashId !== input.trashId)
        throw new OperationError('contentChanged', '该回收项已恢复。');
      path = location.path;
    }
    let candidate = path.replaceAll('\\', '/').replace(/\/$/, '');
    if (!candidate || candidate === '.')
      throw new OperationError('permissionDenied', '不能操作项目根目录。');
    const source =
      kind === 'restore'
        ? join(this.store.internal, 'trash', input.trashId as string, 'payload')
        : await this.store.path(candidate, kind === 'mkdir');
    if (kind !== 'restore')
      candidate = relative(this.store.project.path, source).split(sep).join('/');
    if (
      kind === 'rename' &&
      (!input.name || input.name === '.' || input.name === '..' || /[/\\]/.test(input.name))
    )
      throw new OperationError('invalidRequest', '重命名只接受一个文件或目录名称。');
    const destination =
      kind === 'trash'
        ? join(this.store.internal, 'trash', operationId, 'payload')
        : kind === 'mkdir'
          ? source
          : await this.store.path(
              kind === 'rename'
                ? join(dirname(candidate), input.name as string)
                : (input.destination ?? path),
              true,
            );
    if (source === destination && kind !== 'mkdir')
      throw new OperationError('invalidRequest', '新旧位置相同。');
    if (kind === 'move' && destination.startsWith(`${source}${sep}`))
      throw new OperationError('invalidRequest', '不能移入自身目录。');
    if (kind === 'trash') {
      await this.trashRoot();
      await privateDirectory(join(this.store.internal, 'trash', operationId));
    }
    return this.coordinate([source, destination], async () => {
      this.store.check('write');
      const duplicate = this.store.db
        .select()
        .from(tables.fileOperations)
        .where(eq(tables.fileOperations.id, operationId))
        .get();
      if (duplicate) {
        if (duplicate.details.params !== params)
          throw new OperationError('invalidRequest', '操作参数冲突。');
        return this.inspect(duplicate);
      }
      if (kind !== 'mkdir' && kind !== 'restore') {
        const snapshot = await this.safeTree(source);
        if (
          input.expectedTree &&
          JSON.stringify(snapshot) !==
            JSON.stringify([...input.expectedTree].sort((a, b) => a.path.localeCompare(b.path)))
        )
          throw new OperationError('contentChanged', '目录成员或内容已变化，请重新核查。');
        await this.bindHistory(candidate);
        location = await this.reference(candidate);
        if (
          (input.expectedFileId && location.fileId !== input.expectedFileId) ||
          (input.expectedBasis &&
            fileFingerprint(await lstat(source, { bigint: true })) !== input.expectedBasis)
        )
          throw new OperationError('contentChanged', '文件身份或内容已变化，请重新核查。');
      }
      if (await info(destination))
        throw new OperationError('contentChanged', '目标已存在，不能覆盖。');
      const refs = this.store.db
        .select()
        .from(tables.fileReferences)
        .where(
          kind === 'restore'
            ? sql`json_extract(${tables.fileReferences.value}, '$.trashId') = ${input.trashId}`
            : sql`${tables.fileReferences.path} = ${candidate} OR substr(${tables.fileReferences.path}, 1, ${candidate.length + 1}) = ${`${candidate}/`}`,
        )
        .limit(10001)
        .all()
        .filter((row) => kind === 'restore' || row.value.state === 'present')
        .map((row) => ({ fileId: row.id, path: row.path }));
      if (refs.length > 10000) throw new OperationError('resourceLimit', '文件引用超过本次范围。');
      const sourceInfo = kind === 'mkdir' ? undefined : await lstat(source);
      const value: FileOperation = {
        id: operationId,
        kind,
        state: 'prepared',
        path: candidate,
        ...(location ? { fileId: location.fileId } : {}),
        ...(kind === 'restore' ? { trashId: input.trashId } : {}),
        destination: relative(this.store.project.path, destination).split(sep).join('/'),
      };
      const details = {
        params,
        source,
        destination,
        device: String(sourceInfo?.dev ?? ''),
        inode: String(sourceInfo?.ino ?? ''),
        birthtime: sourceInfo?.birthtimeMs ?? 0,
        references: refs,
      };
      this.store.db.insert(tables.fileOperations).values({ id: operationId, value, details }).run();
      try {
        if (kind === 'mkdir') {
          this.retirePath(candidate);
          await mkdir(destination);
        } else if (sourceInfo?.isFile()) {
          await link(source, destination);
          await unlink(source);
        } else await rename(source, destination);
        return await this.finish(value, details);
      } catch (error) {
        const state = (await info(destination))
          ? 'unknown'
          : (await info(source))
            ? 'failed'
            : 'unknown';
        const result: FileOperation = { ...value, state, error: failure(error).message };
        try {
          this.store.db
            .update(tables.fileOperations)
            .set({ value: result })
            .where(eq(tables.fileOperations.id, operationId))
            .run();
        } catch {}
        if (state === 'unknown')
          throw new OperationError('outcomeUnknown', '文件位置可能已变化，请按原操作身份核查。');
        throw error;
      }
    });
  }

  private async finish(
    value: FileOperation,
    details: (typeof tables.fileOperations.$inferSelect)['details'],
  ): Promise<FileOperation> {
    const destination = relative(this.store.project.path, details.destination).split(sep).join('/');
    let root = value.fileId ? this.location(value.fileId) : undefined;
    if (value.kind === 'mkdir') root = await this.reference(destination);
    this.store.db.transaction(() => {
      if (value.kind !== 'mkdir') {
        for (const reference of details.references ?? []) {
          const entry = this.location(reference.fileId);
          const next: FileLocation =
            value.kind === 'trash'
              ? { ...entry, path: reference.path, state: 'trashed', trashId: value.id }
              : {
                  ...entry,
                  path: destination + reference.path.slice(value.path.length),
                  state: 'present',
                };
          if (value.kind !== 'trash') delete next.trashId;
          this.put(next);
        }
      }
      this.store.invalidateBases([details.source, details.destination]);
      const complete: FileOperation = {
        ...value,
        state: 'complete',
        ...(root ? { fileId: root.fileId } : {}),
      };
      this.store.db
        .update(tables.fileOperations)
        .set({ value: complete })
        .where(eq(tables.fileOperations.id, value.id))
        .run();
      this.changed();
    });
    return { ...value, state: 'complete', ...(root ? { fileId: root.fileId } : {}) };
  }

  async operation(id: string): Promise<FileOperation> {
    this.store.check('read');
    const row = this.store.db
      .select()
      .from(tables.fileOperations)
      .where(eq(tables.fileOperations.id, id))
      .get();
    if (!row) throw new OperationError('notFound', '操作记录不存在。');
    return this.coordinate([row.details.source, row.details.destination], async () => {
      const current = this.store.db
        .select()
        .from(tables.fileOperations)
        .where(eq(tables.fileOperations.id, id))
        .get();
      if (!current) throw new OperationError('notFound', '操作记录不存在。');
      return this.inspect(current);
    });
  }
  private async inspect(row: typeof tables.fileOperations.$inferSelect): Promise<FileOperation> {
    if (!['prepared', 'unknown'].includes(row.value.state)) return row.value;
    const target = await info(row.details.destination);
    const source = await info(row.details.source);
    const original = (stats: Awaited<ReturnType<typeof info>>) =>
      !!stats &&
      String(stats.dev) === row.details.device &&
      String(stats.ino) === row.details.inode &&
      stats.birthtimeMs === row.details.birthtime;
    if (row.value.kind !== 'mkdir' && !original(source) && original(target))
      return this.finish(row.value, row.details);
    return { ...row.value, state: 'unknown' };
  }

  async resource(
    path: string,
  ): Promise<{ mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string }> {
    this.store.check('read');
    const target = await this.store.path(path);
    const handle = await open(target, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) throw new OperationError('invalidRequest', '图片必须为普通文件。');
      if (stats.size > 1048576) throw new OperationError('tooLarge', '图片超过1MiB。');
      const buffer = Buffer.alloc(1048577);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 1048576) throw new OperationError('tooLarge', '图片超过1MiB。');
      const data = buffer.subarray(0, bytesRead);
      const mimeType = imageMime(data);
      if (!mimeType) throw new OperationError('invalidRequest', '只支持PNG、JPEG、GIF和WebP图片。');
      return { mimeType, data: data.toString('base64') };
    } finally {
      await handle.close();
    }
  }
}

export function imageMime(
  data: Buffer,
): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | undefined {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255)
    return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  return undefined;
}
