import { randomUUID } from 'node:crypto';
import { type BigIntStats, createReadStream, createWriteStream } from 'node:fs';
import { link, lstat, mkdir, open, opendir, rm, unlink } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { failure, fileFingerprint, privateDirectory } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import type {
  FileTransfer,
  ImportEntry,
  ProjectsInputs,
  TransferEntry,
  TransferSource,
} from '@scholoom/protocol/projects';
import { eq, sql } from 'drizzle-orm';
import * as tables from './schema.js';
import { isPrivate, type ProjectStore, type Projects } from './store.js';

type Request = ProjectsInputs['files.transfer'];
type Entry = TransferEntry & {
  source?: TransferSource;
  sourceBasis?: string;
  publishBasis?: string;
  targetBasis?: string;
  targetId?: string;
  targetTree?: { path: string; basis: string }[];
  decision?: 'skip' | 'keepBoth' | 'replace';
  operation: string;
  size?: number;
  replacement?: string;
};
type Record = {
  id: string;
  projectId: string;
  destination: string;
  mode: 'copy' | 'move' | 'import';
  state: FileTransfer['state'];
  params: string;
  stage: string;
  count: number;
  sources: TransferSource[];
  roots: {
    source: TransferSource;
    operation: string;
    cleaned?: boolean;
    unknown?: boolean;
    pendingFileId?: string;
  }[];
  initialized: boolean;
  error?: string;
};
type Active = {
  record: Record;
  entries: Entry[];
  controller: AbortController;
  done: Promise<void>;
};
const prefix = (id: string) => `file-transfer:${encodeURIComponent(id)}:`;
const itemKey = (id: string, index: number) =>
  `${prefix(id)}item:${String(index).padStart(6, '0')}`;
const sameOrChild = (parent: string, child: string) =>
  child === parent || child.startsWith(`${parent}/`);
const identity = (s: BigIntStats) => [s.dev, s.ino, s.birthtimeNs, s.size, s.mtimeNs].join(':');
const stats = async (path: string) =>
  lstat(path, { bigint: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  });

function relativePath(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  if (
    !path ||
    isAbsolute(path) ||
    /^[a-z]:/i.test(path) ||
    parts.some(
      (part) => !part || part === '.' || part === '..' || part.includes('\0') || isPrivate(part),
    )
  )
    throw new OperationError('permissionDenied', '导入位置含有私有或越界路径。');
  return parts.join('/');
}

/** Project-owned, incremental receipts; byte staging never becomes another content authority. */
export class FileTransfers {
  private active = new Map<string, Active>();
  private closing = false;
  private key(projectId: string, id: string): string {
    return `${projectId}:${id}`;
  }
  constructor(
    private readonly projects: Projects,
    private readonly changed: (projectId: string) => void = () => {},
  ) {}

  private put(store: ProjectStore, key: string, value: unknown): void {
    store.db
      .insert(tables.meta)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: tables.meta.key, set: { value: JSON.stringify(value) } })
      .run();
    store.touch();
  }
  private read<T>(store: ProjectStore, key: string): T | undefined {
    const row = store.db.select().from(tables.meta).where(eq(tables.meta.key, key)).get();
    return row ? (JSON.parse(row.value) as T) : undefined;
  }
  private record(projectId: string, id: string): Record {
    const store = this.projects.get(projectId);
    store.check('read');
    const record = this.read<Record>(store, `${prefix(id)}record`);
    if (!record) throw new OperationError('notFound', '传输记录不存在。');
    if (record.projectId !== projectId)
      throw new OperationError('unavailable', '传输归属不属于当前项目副本，请核查原项目。');
    return record;
  }
  private save(record: Record): void {
    this.put(this.projects.get(record.projectId), `${prefix(record.id)}record`, record);
    this.changed(record.projectId);
  }
  private saveEntry(record: Record, entry: Entry, index: number): void {
    this.put(this.projects.get(record.projectId), itemKey(record.id, index), entry);
  }
  private entries(record: Record): Entry[] {
    return this.projects
      .get(record.projectId)
      .db.select()
      .from(tables.meta)
      .where(
        sql`${tables.meta.key} >= ${itemKey(record.id, 0)} AND ${tables.meta.key} <= ${itemKey(record.id, 999999)}`,
      )
      .orderBy(tables.meta.key)
      .limit(10000)
      .all()
      .map((row) => JSON.parse(row.value) as Entry);
  }
  private async createLocked(
    projectId: string,
    id: string,
    destination: string,
    params: string,
    mode: Record['mode'],
    sources: TransferSource[],
  ): Promise<Record | undefined> {
    if (this.closing) throw new OperationError('shuttingDown', '文件传输正在收尾。');
    const target = this.projects.get(projectId);
    target.check('read');
    target.check('write');
    const prior = this.read<Record>(target, `${prefix(id)}record`);
    if (prior) {
      if (prior.params !== params)
        throw new OperationError('invalidRequest', '操作身份已用于其他传输。');
      return undefined;
    }
    if (this.active.size >= 4)
      throw new OperationError('resourceLimit', '同时进行的文件传输过多。');
    const directory = await target.path(destination);
    if (!(await lstat(directory)).isDirectory())
      throw new OperationError('invalidRequest', '请选择目标目录。');
    const record: Record = {
      id,
      projectId,
      destination,
      params,
      mode,
      state: mode === 'import' ? 'uploading' : 'running',
      stage: randomUUID(),
      count: 0,
      sources,
      roots: [],
      initialized: false,
    };
    await privateDirectory(join(target.internal, 'transfers'));
    await privateDirectory(this.stage(record));
    this.save(record);
    return record;
  }
  private stage(record: Record, index?: number): string {
    return join(
      this.projects.get(record.projectId).internal,
      'transfers',
      record.stage,
      index === undefined ? '' : String(index),
    );
  }
  private async mutating<T>(projectId: string, id: string, run: () => Promise<T>): Promise<T> {
    const store = this.projects.get(projectId);
    store.check('write');
    return store.files.coordinate(
      [join(store.internal, 'transfer-receipts', encodeURIComponent(id))],
      run,
    );
  }
  async start(input: Request): Promise<FileTransfer> {
    return this.mutating(input.projectId, input.operationId, () => this.startLocked(input));
  }
  private async startLocked(input: Request): Promise<FileTransfer> {
    const prior = this.read<Record>(
      this.projects.get(input.projectId),
      `${prefix(input.operationId)}record`,
    );
    if (prior) {
      if (prior.params !== JSON.stringify(input))
        throw new OperationError('invalidRequest', '操作身份已用于其他传输。');
      return this.status(input.projectId, input.operationId);
    }
    const selected = new Map<string, Set<string>>();
    for (const source of input.sources) {
      const paths = selected.get(source.projectId) ?? new Set<string>();
      paths.add(source.path);
      selected.set(source.projectId, paths);
    }
    const seen = new Set<string>();
    const sources = input.sources.filter((source) => {
      const key = `${source.projectId}:${source.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const parts = source.path.split('/');
      for (let depth = 1; depth < parts.length; depth++)
        if (selected.get(source.projectId)?.has(parts.slice(0, depth).join('/'))) return false;
      return true;
    });
    for (const source of sources) {
      const store = this.projects.get(source.projectId);
      store.check('read');
      if (input.mode === 'move') store.check('write');
      if (!source.path || source.path === '.')
        throw new OperationError('permissionDenied', '不能传输项目根目录。');
      const location = store.files.location(source.fileId);
      if (location.state !== 'present' || location.path !== source.path)
        throw new OperationError('contentChanged', '源文件位置已变化，请重新选择。');
      if (source.projectId === input.projectId && sameOrChild(source.path, input.destination))
        throw new OperationError('invalidRequest', '不能复制或移动到自身后代。');
    }
    const record = await this.createLocked(
      input.projectId,
      input.operationId,
      input.destination,
      JSON.stringify(input),
      input.mode,
      sources,
    );
    if (record) this.launch(record);
    return this.status(input.projectId, input.operationId);
  }
  private launch(record: Record, entries?: Entry[]): void {
    const key = this.key(record.projectId, record.id);
    if (this.active.has(key)) return;
    const active: Active = {
      record,
      entries: entries ?? [],
      controller: new AbortController(),
      done: Promise.resolve(),
    };
    this.active.set(key, active);
    active.done = this.run(active)
      .catch((error) => {
        record.error = failure(error).message;
        record.count = active.entries.length;
        if (record.state !== 'cancelled' && record.state !== 'unknown')
          record.state =
            (error as { code?: string }).code === 'outcomeUnknown' ? 'unknown' : 'partial';
        this.save(record);
      })
      .finally(() => {
        this.active.delete(key);
      });
  }
  private async initialize(active: Active): Promise<void> {
    const { record, entries, controller } = active;
    const append = async (source: TransferSource, destination: string): Promise<void> => {
      controller.signal.throwIfAborted();
      if (entries.length >= 10000)
        throw new OperationError('resourceLimit', '传输超过10000个条目。');
      const store = this.projects.get(source.projectId);
      store.check('read');
      const raw = await lstat(join(store.project.path, source.path), { bigint: true });
      if (raw.isSymbolicLink() || (!raw.isDirectory() && !raw.isFile()))
        throw new OperationError('permissionDenied', '不能传输链接或特殊文件。');
      await store.path(source.path);
      const location = await store.files.reference(source.path);
      if (location.fileId !== source.fileId)
        throw new OperationError('contentChanged', '源文件身份已变化。');
      const index = entries.length;
      const entry: Entry = {
        id: String(index),
        path: source.path,
        destination,
        kind: location.kind,
        state: 'pending',
        source,
        sourceBasis: fileFingerprint(raw),
        operation: randomUUID(),
      };
      entries.push(entry);
      this.saveEntry(record, entry, index);
      if (raw.isDirectory()) {
        for await (const child of await opendir(join(store.project.path, source.path))) {
          const path = `${source.path}/${child.name}`;
          await store.path(path);
          const ref = await store.files.reference(path);
          await append({ ...source, path, fileId: ref.fileId }, `${destination}/${child.name}`);
        }
      }
    };
    for (const source of record.sources) {
      record.roots.push({ source, operation: randomUUID() });
      await append(
        source,
        record.destination
          ? `${record.destination}/${basename(source.path)}`
          : basename(source.path),
      );
    }
    record.count = entries.length;
    record.initialized = true;
    this.save(record);
  }
  private async run(active: Active): Promise<void> {
    const { record, entries, controller } = active;
    if (!record.initialized) await this.initialize(active);
    for (let index = 0; index < entries.length; index++) {
      if (controller.signal.aborted || record.state === 'cancelled' || this.closing) break;
      const entry = entries[index] as Entry;
      if (entry.state !== 'pending') continue;
      try {
        await this.process(active, entry, index);
        this.saveEntry(record, entry, index);
        if ((entry as TransferEntry).state === 'conflict') {
          record.state = 'conflict';
          this.save(record);
          return;
        }
      } catch (error) {
        entry.state =
          (error as { code?: string }).code === 'outcomeUnknown'
            ? 'unknown'
            : controller.signal.aborted
              ? 'skipped'
              : 'failed';
        entry.error = failure(error).message;
        this.saveEntry(record, entry, index);
        if (entry.kind === 'dir') this.skipChildren(active, entry, entry.error);
      }
    }
    if (record.state !== 'cancelled' && record.state !== 'unknown') {
      if (entries.every((item) => item.state === 'complete')) await this.cleanupSources(active);
      record.state = entries.some((item) => item.state === 'unknown')
        ? 'unknown'
        : entries.every((item) => item.state === 'complete') && !record.error
          ? 'complete'
          : 'partial';
    }
    this.save(record);
    if (record.state === 'complete' || record.state === 'cancelled')
      await rm(this.stage(record), { recursive: true, force: true });
  }
  private skipChildren(active: Active, parent: Entry, reason: string): void {
    for (let i = 0; i < active.entries.length; i++) {
      const entry = active.entries[i] as Entry;
      if (
        entry !== parent &&
        entry.state === 'pending' &&
        sameOrChild(parent.path, entry.path) &&
        entry.source?.projectId === parent.source?.projectId
      ) {
        entry.state = 'skipped';
        entry.error = reason;
        this.saveEntry(active.record, entry, i);
      }
    }
  }
  private async process(active: Active, entry: Entry, index: number): Promise<void> {
    const { record } = active;
    const target = this.projects.get(record.projectId);
    target.check('write');
    const sourceStore = entry.source ? this.projects.get(entry.source.projectId) : undefined;
    if (sourceStore) {
      sourceStore.check('read');
      if (record.mode === 'move') sourceStore.check('write');
      const location = sourceStore.files.location(entry.source!.fileId);
      if (location.state !== 'present' || location.path !== entry.path)
        throw new OperationError('contentChanged', '源位置已变化。');
      const current = await lstat(await sourceStore.path(entry.path), { bigint: true });
      if (entry.sourceBasis !== fileFingerprint(current))
        throw new OperationError('contentChanged', '源文件已变化。');
    }
    if (sourceStore === target && entry.path === entry.destination && record.mode === 'move') {
      entry.state = 'complete';
      this.skipChildren(active, entry, '原位置无需移动。');
      return;
    }
    let destination = await target.path(entry.destination, true);
    let existing = await stats(destination);
    if (sourceStore === target && entry.path === entry.destination && record.mode === 'copy')
      entry.decision = 'keepBoth';
    if (
      existing &&
      entry.kind === 'dir' &&
      existing.isDirectory() &&
      entry.path !== entry.destination
    ) {
      entry.state = 'complete';
      return;
    }
    if (existing) {
      if (entry.decision === 'skip') {
        entry.state = 'skipped';
        this.skipChildren(active, entry, '已跳过父目录。');
        return;
      }
      if (entry.decision === 'keepBoth') {
        const old = entry.destination;
        const extension = entry.kind === 'file' ? extname(old) : '';
        const stem = extension ? old.slice(0, -extension.length) : old;
        let number = 2;
        do {
          entry.destination = `${stem} (${number++})${extension}`;
          destination = await target.path(entry.destination, true);
        } while (await stats(destination));
        if (entry.kind === 'dir') {
          for (let i = index + 1; i < active.entries.length; i++) {
            const child = active.entries[i] as Entry;
            if (child.destination.startsWith(`${old}/`)) {
              child.destination = entry.destination + child.destination.slice(old.length);
              this.saveEntry(record, child, i);
            }
          }
        }
        existing = undefined;
      } else if (
        entry.decision !== 'replace' ||
        entry.targetBasis !== fileFingerprint(existing) ||
        (await target.files.reference(entry.destination)).fileId !== entry.targetId
      ) {
        entry.state = 'conflict';
        entry.basis = randomUUID();
        entry.targetBasis = fileFingerprint(existing);
        entry.targetId = (await target.files.reference(entry.destination)).fileId;
        if (existing.isDirectory())
          entry.targetTree = await target.files.treeSnapshot(entry.destination);
        delete entry.decision;
        delete entry.replacement;
        return;
      }
    }
    entry.state = 'copying';
    this.saveEntry(record, entry, index);
    const staged = this.stage(record, index);
    if (entry.kind === 'file' && !(sourceStore === target && record.mode === 'move')) {
      if (sourceStore && !(await stats(staged))) {
        await pipeline(
          createReadStream(await sourceStore.path(entry.path), { highWaterMark: 262144 }),
          createWriteStream(staged, { flags: 'wx', mode: 0o600 }),
          { signal: active.controller.signal },
        );
      }
      if (
        sourceStore &&
        fileFingerprint(await lstat(await sourceStore.path(entry.path), { bigint: true })) !==
          entry.sourceBasis
      )
        throw new OperationError('contentChanged', '复制期间源文件发生变化。');
      entry.publishBasis = identity(await lstat(staged, { bigint: true }));
      this.saveEntry(record, entry, index);
      active.controller.signal.throwIfAborted();
    }
    if (existing) {
      entry.replacement ??= randomUUID();
      this.saveEntry(record, entry, index);
      const recycled = await target.files
        .mutate('trash', entry.replacement, {
          path: entry.destination,
          expectedFileId: entry.targetId!,
          expectedBasis: entry.targetBasis!,
          ...(entry.targetTree ? { expectedTree: entry.targetTree } : {}),
        })
        .catch(async (error) => {
          if ((error as { code?: string }).code !== 'contentChanged') throw error;
          const now = await stats(destination);
          if (!now) throw error;
          entry.state = 'conflict';
          entry.basis = randomUUID();
          entry.targetBasis = fileFingerprint(now);
          entry.targetId = (await target.files.reference(entry.destination)).fileId;
          if (now.isDirectory())
            entry.targetTree = await target.files.treeSnapshot(entry.destination);
          else delete entry.targetTree;
          delete entry.decision;
          delete entry.replacement;
          return undefined;
        });
      if (!recycled) return;
      if (recycled.state !== 'complete')
        throw new OperationError('outcomeUnknown', '原目标回收结果待核查。');
      entry.trashId = recycled.id;
      this.saveEntry(record, entry, index);
    }
    if (sourceStore === target && record.mode === 'move') {
      const moved = await target.files.mutate('move', entry.operation, {
        path: entry.path,
        destination: entry.destination,
        expectedFileId: entry.source!.fileId,
        expectedBasis: entry.sourceBasis!,
      });
      if (moved.state !== 'complete')
        throw new OperationError('outcomeUnknown', '移动结果待核查。');
      if (moved.fileId) entry.fileId = moved.fileId;
      entry.state = 'complete';
      if (entry.kind === 'dir') {
        for (let i = index + 1; i < active.entries.length; i++) {
          const child = active.entries[i] as Entry;
          if (
            child.source?.projectId === entry.source?.projectId &&
            sameOrChild(entry.path, child.path)
          ) {
            child.state = 'complete';
            this.saveEntry(record, child, i);
          }
        }
      }
      return;
    }
    if (entry.kind === 'dir') {
      const created = await target.files.mutate('mkdir', entry.operation, {
        path: entry.destination,
      });
      if (created.state !== 'complete')
        throw new OperationError('outcomeUnknown', '目录创建结果待核查。');
      if (created.fileId) entry.fileId = created.fileId;
      entry.state = 'complete';
      return;
    }
    active.controller.signal.throwIfAborted();
    await target.files.coordinate([destination], async () => {
      target.check('write');
      if (sourceStore) sourceStore.check('read');
      if (
        (await target.path(entry.destination, true)) !== destination ||
        (await stats(destination))
      )
        throw new OperationError('contentChanged', '目标已变化，不能覆盖。');
      await link(staged, destination);
      await unlink(staged);
      target.files.retirePath(entry.destination);
      entry.fileId = (await target.files.reference(entry.destination, true)).fileId;
      target.invalidateBases([destination]);
      target.files.changed();
    });
    entry.state = 'complete';
  }
  private async cleanupSources(active: Active): Promise<void> {
    const { record, entries } = active;
    if (record.mode !== 'move') return;
    for (const root of record.roots) {
      if (root.cleaned) continue;
      const source = this.projects.get(root.source.projectId);
      if (source.project.id === record.projectId) {
        // Non-merged directories have already moved as a single structure operation.
        const path = source.files.location(root.source.fileId);
        if (path.state !== 'present' || path.path !== root.source.path) {
          root.cleaned = true;
          continue;
        }
        const merged = entries
          .filter(
            (entry) =>
              entry.source?.projectId === root.source.projectId &&
              sameOrChild(root.source.path, entry.path) &&
              entry.kind === 'dir',
          )
          .reverse();
        for (const entry of merged) {
          const location = source.files.location(entry.source!.fileId);
          if (location.state !== 'present' || location.path !== entry.path) continue;
          const iterator = await opendir(await source.path(entry.path));
          const first = await iterator.read();
          await iterator.close();
          if (!first) {
            root.operation = `${entry.operation}-empty`;
            root.unknown = true;
            root.pendingFileId = entry.source!.fileId;
            this.save(record);
            const value = await source.files.mutate('trash', root.operation, {
              path: entry.path,
              expectedFileId: entry.source!.fileId,
              expectedTree: [
                {
                  path: entry.path,
                  basis: fileFingerprint(
                    await lstat(await source.path(entry.path), { bigint: true }),
                  ),
                },
              ],
            });
            if (value.state !== 'complete')
              throw new OperationError('outcomeUnknown', '空源目录回收待核查。');
            delete root.unknown;
          }
        }
      } else {
        const originals = entries.filter(
          (entry) =>
            entry.source?.projectId === root.source.projectId &&
            sameOrChild(root.source.path, entry.path),
        );
        for (const entry of originals) {
          source.check('write');
          source.check('read');
          if (
            source.files.location(entry.source!.fileId).path !== entry.path ||
            fileFingerprint(await lstat(await source.path(entry.path), { bigint: true })) !==
              entry.sourceBasis
          )
            throw new OperationError('contentChanged', '源目录变化，目标保留，源项目尚未回收。');
        }
        const rootEntry = originals.find((entry) => entry.path === root.source.path)!;
        root.unknown = true;
        root.pendingFileId = root.source.fileId;
        this.save(record);
        const recycled = await source.files.mutate('trash', root.operation, {
          path: root.source.path,
          expectedFileId: root.source.fileId,
          expectedBasis: rootEntry.sourceBasis!,
          expectedTree: originals.map((entry) => ({ path: entry.path, basis: entry.sourceBasis! })),
        });
        if (recycled.state !== 'complete')
          throw new OperationError('outcomeUnknown', '源回收结果待核查。');
        delete root.unknown;
      }
      root.cleaned = true;
      this.save(record);
      this.changed(source.project.id);
    }
  }
  async status(projectId: string, id: string, offset = 0, limit = 100): Promise<FileTransfer> {
    const record = this.record(projectId, id);
    const target = this.projects.get(projectId);
    if (
      !this.active.has(this.key(projectId, id)) &&
      (record.state === 'running' || record.state === 'unknown') &&
      record.projectId === projectId
    ) {
      const entries = this.entries(record);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i] as Entry;
        if (entry.state !== 'copying' && entry.state !== 'unknown') continue;
        let missing = false;
        const actual = await target
          .path(entry.destination, true)
          .then(async (path) => {
            const current = await stats(path);
            missing = current === undefined;
            return current;
          })
          .catch(() => undefined);
        let replacementComplete = false;
        if (entry.replacement) {
          const replacement = await target.files
            .operation(entry.replacement)
            .catch(() => undefined);
          if (replacement?.state === 'complete') {
            entry.trashId = replacement.id;
            replacementComplete = true;
          }
        }
        if (actual && entry.publishBasis === identity(actual)) {
          entry.state = 'complete';
          entry.fileId = (await target.files.reference(entry.destination)).fileId;
        } else {
          try {
            const result = await target.files.operation(entry.operation);
            entry.state = result.state === 'complete' ? 'complete' : 'unknown';
          } catch (reason) {
            entry.state =
              replacementComplete && missing && (reason as { code?: string }).code === 'notFound'
                ? 'failed'
                : 'unknown';
            if (entry.state === 'failed')
              entry.error = '原目标已回收，候选未确认发布；可从回收站恢复原目标。';
          }
        }
        this.saveEntry(record, entry, i);
      }
      for (const root of record.roots.filter((item) => item.unknown)) {
        try {
          const source = this.projects.get(root.source.projectId);
          if ((await source.files.operation(root.operation)).state === 'complete') {
            const location = source.files.location(root.pendingFileId ?? root.source.fileId);
            root.cleaned =
              (root.pendingFileId ?? root.source.fileId) === root.source.fileId &&
              (location.state === 'trashed' || location.path !== root.source.path);
            delete root.unknown;
          }
        } catch (reason) {
          // No recorded operation means the write was never accepted; a read must not initiate it.
          if ((reason as { code?: string }).code === 'notFound') delete root.unknown;
        }
      }
      record.state =
        entries.some((entry) => entry.state === 'unknown') ||
        record.roots.some((root) => root.unknown)
          ? 'unknown'
          : entries.every((entry) => entry.state === 'complete') &&
              (record.mode !== 'move' || record.roots.every((root) => root.cleaned))
            ? 'complete'
            : 'partial';
      record.error = '上次传输已中断；已核查发布结果，未确认的源项未继续处理，请核查源项目。';
      this.save(record);
    }
    const rows = target.db
      .select()
      .from(tables.meta)
      .where(
        sql`${tables.meta.key} >= ${itemKey(id, 0)} AND ${tables.meta.key} <= ${itemKey(id, 999999)}`,
      )
      .orderBy(tables.meta.key)
      .limit(limit + 1)
      .offset(offset)
      .all();
    const completed =
      target.db
        .select({ n: sql<number>`count(*)` })
        .from(tables.meta)
        .where(
          sql`${tables.meta.key} >= ${itemKey(id, 0)} AND ${tables.meta.key} <= ${itemKey(id, 999999)} AND json_extract(${tables.meta.value}, '$.state') = 'complete'`,
        )
        .get()?.n ?? 0;
    const conflictRow = target.db
      .select()
      .from(tables.meta)
      .where(
        sql`${tables.meta.key} >= ${itemKey(id, 0)} AND ${tables.meta.key} <= ${itemKey(id, 999999)} AND json_extract(${tables.meta.value}, '$.state') = 'conflict'`,
      )
      .limit(1)
      .get();
    const conflict = conflictRow ? (JSON.parse(conflictRow.value) as Entry) : undefined;
    return {
      id,
      projectId,
      state: record.state,
      total: record.count,
      completed,
      ...(conflict
        ? {
            conflict: {
              id: conflict.id,
              path: conflict.path,
              destination: conflict.destination,
              kind: conflict.kind,
              state: conflict.state,
              ...(conflict.basis ? { basis: conflict.basis } : {}),
            },
          }
        : {}),
      entries: rows.slice(0, limit).map((row) => {
        const e = JSON.parse(row.value) as Entry;
        return {
          id: e.id,
          path: e.path,
          destination: e.destination,
          kind: e.kind,
          state: e.state,
          ...(e.fileId ? { fileId: e.fileId } : {}),
          ...(e.basis ? { basis: e.basis } : {}),
          ...(e.trashId ? { trashId: e.trashId } : {}),
          ...(e.error ? { error: e.error } : {}),
        };
      }),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
      ...(record.error ? { error: record.error } : {}),
    };
  }
  async decide(input: ProjectsInputs['files.transferDecide']): Promise<FileTransfer> {
    return this.mutating(input.projectId, input.operationId, () => this.decideLocked(input));
  }
  private async decideLocked(input: ProjectsInputs['files.transferDecide']): Promise<FileTransfer> {
    const record = this.record(input.projectId, input.operationId);
    this.projects.get(record.projectId).check('write');
    if (record.state !== 'conflict' || this.active.has(this.key(record.projectId, record.id)))
      throw new OperationError('contentChanged', '传输当前不等待决定。');
    const entries = this.entries(record);
    const entry = entries.find((item) => item.id === input.entryId);
    if (!entry || entry.state !== 'conflict' || entry.basis !== input.basis)
      throw new OperationError('contentChanged', '冲突依据已失效。');
    entry.decision = input.decision;
    entry.state = 'pending';
    this.saveEntry(record, entry, entries.indexOf(entry));
    record.state = 'running';
    this.save(record);
    this.launch(record, entries);
    return this.status(record.projectId, record.id);
  }
  async cancel(projectId: string, id: string): Promise<FileTransfer> {
    return this.mutating(projectId, id, () => this.cancelLocked(projectId, id));
  }
  private async cancelLocked(projectId: string, id: string): Promise<FileTransfer> {
    const record = this.active.get(this.key(projectId, id))?.record ?? this.record(projectId, id);
    if (record.projectId !== projectId)
      throw new OperationError('permissionDenied', '传输不属于此项目。');
    this.projects.get(projectId).check('write');
    if (['complete', 'cancelled'].includes(record.state)) return this.status(projectId, id);
    record.state = 'cancelled';
    this.save(record);
    const active = this.active.get(this.key(projectId, id));
    active?.controller.abort();
    if (active) await active.done;
    else await rm(this.stage(record), { recursive: true, force: true });
    if (
      this.entries(record).some(
        (entry) => entry.state === 'unknown' || entry.state === 'copying',
      ) ||
      record.roots.some((root) => root.unknown)
    ) {
      record.state = 'unknown';
      this.save(record);
    }
    return this.status(projectId, id);
  }
  async importBegin(input: ProjectsInputs['files.importBegin']): Promise<FileTransfer> {
    return this.mutating(input.projectId, input.operationId, () => this.importBeginLocked(input));
  }
  private async importBeginLocked(
    input: ProjectsInputs['files.importBegin'],
  ): Promise<FileTransfer> {
    const paths = new Set<string>();
    for (const entry of input.entries) {
      const path = relativePath(entry.path);
      if (paths.has(path)) throw new OperationError('invalidRequest', '重复导入路径。');
      paths.add(path);
      if (entry.kind === 'file' && entry.size === undefined)
        throw new OperationError('invalidRequest', '文件缺少长度。');
    }
    const record = await this.createLocked(
      input.projectId,
      input.operationId,
      input.destination,
      JSON.stringify(input),
      'import',
      [],
    );
    if (record) {
      const entries: ImportEntry[] = [...input.entries].sort(
        (a, b) =>
          a.path.split('/').length - b.path.split('/').length || (a.kind === 'dir' ? -1 : 1),
      );
      this.projects.get(input.projectId).db.transaction(() => {
        entries.forEach((entry, index) => {
          this.saveEntry(
            record,
            {
              id: String(index),
              path: relativePath(entry.path),
              destination: input.destination
                ? `${input.destination}/${relativePath(entry.path)}`
                : relativePath(entry.path),
              kind: entry.kind,
              state: 'pending',
              operation: randomUUID(),
              ...(entry.size === undefined ? {} : { size: entry.size }),
            },
            index,
          );
          this.put(
            this.projects.get(record.projectId),
            `${prefix(record.id)}path:${encodeURIComponent(entry.path)}`,
            index,
          );
        });
        record.count = entries.length;
        record.initialized = true;
        this.save(record);
      });
    }
    return this.status(input.projectId, input.operationId);
  }
  async importChunk(input: ProjectsInputs['files.importChunk']): Promise<{ ok: true }> {
    return this.mutating(input.projectId, input.operationId, () => this.importChunkLocked(input));
  }
  private async importChunkLocked(
    input: ProjectsInputs['files.importChunk'],
  ): Promise<{ ok: true }> {
    const record = this.record(input.projectId, input.operationId);
    const target = this.projects.get(input.projectId);
    target.check('write');
    if (record.state !== 'uploading')
      throw new OperationError('contentChanged', '导入不再接收内容。');
    const index = this.read<number>(
      target,
      `${prefix(record.id)}path:${encodeURIComponent(input.path)}`,
    );
    const entry =
      index === undefined ? undefined : this.read<Entry>(target, itemKey(record.id, index));
    if (!entry) throw new OperationError('notFound', '导入文件未登记。');
    const bytes = Buffer.from(input.base64, 'base64');
    if (
      bytes.length > 262144 ||
      bytes.toString('base64') !== input.base64 ||
      input.offset + bytes.length > (entry.size ?? 0)
    )
      throw new OperationError('invalidRequest', '导入分块或长度无效。');
    const path = this.stage(record, Number(entry.id));
    await target.files.coordinate([path], async () => {
      target.check('write');
      const file = await open(path, (await stats(path)) ? 'r+' : 'wx', 0o600);
      try {
        const current = await file.stat();
        if (input.offset < current.size) {
          const read = Buffer.alloc(bytes.length);
          const value = await file.read(read, 0, read.length, input.offset);
          if (value.bytesRead !== bytes.length || !read.equals(bytes))
            throw new OperationError('contentChanged', '重复分块内容不一致。');
        } else {
          if (input.offset !== current.size)
            throw new OperationError('contentChanged', '导入分块位置不连续。');
          let written = 0;
          while (written < bytes.length) {
            const result = await file.write(
              bytes,
              written,
              bytes.length - written,
              input.offset + written,
            );
            if (!result.bytesWritten)
              throw new OperationError('unavailable', '导入分块无法继续写入。');
            written += result.bytesWritten;
          }
        }
      } finally {
        await file.close();
      }
    });
    return { ok: true };
  }
  async importFinish(projectId: string, id: string): Promise<FileTransfer> {
    return this.mutating(projectId, id, () => this.importFinishLocked(projectId, id));
  }
  private async importFinishLocked(projectId: string, id: string): Promise<FileTransfer> {
    const record = this.record(projectId, id);
    this.projects.get(projectId).check('write');
    if (record.state !== 'uploading') return this.status(projectId, id);
    const entries = this.entries(record);
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index] as Entry;
      if (entry.kind !== 'file') continue;
      const path = this.stage(record, index);
      if (entry.size === 0 && !(await stats(path))) {
        const file = await open(path, 'wx', 0o600);
        await file.close();
      }
      if ((await stats(path))?.size !== BigInt(entry.size ?? 0))
        throw new OperationError('contentChanged', '导入文件尚未完整上传。');
    }
    record.state = 'running';
    this.save(record);
    this.launch(record, entries);
    return this.status(projectId, id);
  }
  async close(): Promise<void> {
    this.closing = true;
    for (const active of this.active.values()) {
      active.record.state = 'unknown';
      active.controller.abort();
    }
    await Promise.all([...this.active.values()].map((active) => active.done));
  }
}
