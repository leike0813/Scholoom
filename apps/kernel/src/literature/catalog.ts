import { randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setImmediate as yieldTask } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  type BusinessParams,
  type BusinessResult,
  type CslMetadata,
  isCslMetadata,
  type LibraryBackup,
  type LibraryBatch,
  type LibraryCollection,
  type LibraryEntry,
  type LibrarySource,
  type LibraryStatus,
} from '@scholoom/protocol';
import Database from 'better-sqlite3';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { failure, OperationError } from '../errors.js';
import * as tables from '../storage/library-schema.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';

const timestamp = () => new Date().toISOString();
const within = (root: string, path: string) => {
  const part = relative(root, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
};
const listPage = <T>(rows: T[], offset: number, limit: number) => {
  const selected: T[] = [];
  let bytes = 0;
  for (const row of rows.slice(0, limit)) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (selected.length && bytes + size > 524288) break;
    selected.push(row);
    bytes += size;
  }
  return {
    rows: selected,
    ...(rows.length > selected.length ? { nextOffset: offset + selected.length } : {}),
  };
};
const doiOf = (metadata: CslMetadata): string | null => {
  const doi = metadata.DOI?.trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
  if (!doi) return null;
  if (!/^10\.\d{4,9}\/\S+$/u.test(doi))
    throw new OperationError('invalidRequest', 'DOI 格式无效。');
  return doi;
};

export class LiteratureCatalog {
  private database: Database.Database | undefined;
  private store: ReturnType<typeof drizzle<typeof tables>> | undefined;
  private active = new Map<string, Promise<void>>();
  private stopping = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private dirty = false;
  private backingUp: Promise<LibraryBackup> | undefined;
  readonly directory: string;
  constructor(
    private readonly profile: string,
    private readonly notify: () => void,
  ) {
    this.directory = join(profile, 'library');
  }
  private get db() {
    if (!this.store) throw new OperationError('unavailable', '文献库尚未打开。');
    return this.store;
  }
  private meta(key: string): string | undefined {
    return this.db.select().from(tables.libraryMeta).where(eq(tables.libraryMeta.key, key)).get()
      ?.value;
  }
  private putMeta(key: string, value: string): void {
    this.db
      .insert(tables.libraryMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: tables.libraryMeta.key, set: { value } })
      .run();
  }
  async initialize(): Promise<void> {
    await privateDirectory(this.directory);
    const path = join(this.directory, 'library.sqlite');
    const stats = await lstat(path).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (stats && (!stats.isFile() || stats.isSymbolicLink()))
      throw new OperationError('permissionDenied', '文献数据库路径不安全。');
    const database = new Database(path);
    try {
      database.pragma('journal_mode = WAL');
      database.pragma('busy_timeout = 1000');
      if (database.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('corrupt');
      const version = Number(database.pragma('user_version', { simple: true }));
      if (version > 1) throw new Error('newer schema');
      if (version < 1) {
        if (stats) await database.backup(join(this.directory, 'before-migration.sqlite'));
        migrate(drizzle(database), {
          migrationsFolder: fileURLToPath(
            new URL('../storage/library-migrations/', import.meta.url),
          ),
        });
        database.pragma('user_version = 1');
      }
      this.database = database;
      this.store = drizzle(database, { schema: tables });
      if (!this.meta('identity')) this.putMeta('identity', randomUUID());
      if (!this.meta('grants'))
        this.putMeta(
          'grants',
          JSON.stringify({ read: true, write: false, send: false, autoBackup: true }),
        );
      for (const { id, value } of this.db
        .select()
        .from(tables.batches)
        .where(sql`json_extract(${tables.batches.value}, '$.state') IN ('queued','running')`)
        .all())
        this.db
          .update(tables.batches)
          .set({
            value: {
              ...value,
              state: 'interrupted',
              error: {
                code: 'outcomeUnknown',
                message: '上次执行未确认结束，请显式继续未执行项。',
              },
            },
          })
          .where(eq(tables.batches.id, id))
          .run();
      this.dirty = Number(this.meta('lastBackupRevision') ?? -1) < this.status().revision;
      this.timer = setInterval(() => {
        void this.autoBackup().catch(() => {});
      }, 300000);
      this.timer.unref();
    } catch {
      database.close();
      this.database = undefined;
      this.store = undefined;
      throw new OperationError('unavailable', '文献库损坏或版本不兼容；已停止写入并保留现场。');
    }
  }
  status(): LibraryStatus {
    return {
      id: this.meta('identity') ?? '',
      ...JSON.parse(this.meta('grants') ?? '{}'),
      revision: Number(this.meta('revision') ?? 0),
    };
  }
  grant(input: BusinessParams<'library.grant'>): LibraryStatus {
    this.putMeta('grants', JSON.stringify(input));
    this.changed();
    return this.status();
  }
  check(kind: 'read' | 'write' | 'send'): void {
    if (this.stopping) throw new OperationError('shuttingDown', '文献库正在停止。');
    if (!this.status()[kind])
      throw new OperationError('permissionDenied', `文献库${kind}尚未授权。`);
  }
  private changed(): void {
    this.putMeta('revision', String(Number(this.meta('revision') ?? 0) + 1));
    this.dirty = true;
    this.notify();
  }
  private source(id: string): LibrarySource {
    const row = this.db.select().from(tables.sources).where(eq(tables.sources.id, id)).get();
    if (!row) throw new OperationError('notFound', '文献条目不存在。');
    return row.value;
  }
  get(id: string): LibrarySource {
    this.check('read');
    return this.source(id);
  }
  list(input: BusinessParams<'library.list'>): BusinessResult<'library.list'> {
    this.check('read');
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.sources)
      .where(
        and(
          input.query
            ? sql`instr(lower(json_extract(${tables.sources.value}, '$.metadata.title') || ' ' || coalesce(${tables.sources.doi},'')),lower(${input.query})) > 0`
            : undefined,
          input.collectionId
            ? sql`EXISTS (SELECT 1 FROM json_each(json_extract(${tables.sources.value}, '$.collectionIds')) WHERE value=${input.collectionId})`
            : undefined,
          input.tag
            ? sql`EXISTS (SELECT 1 FROM json_each(json_extract(${tables.sources.value}, '$.tags')) WHERE value=${input.tag})`
            : undefined,
        ),
      )
      .orderBy(
        desc(sql`json_extract(${tables.sources.value}, '$.updatedAt')`),
        desc(tables.sources.id),
      )
      .limit(limit + 1)
      .offset(offset)
      .all();
    const page = listPage(
      rows.map((r) => r.value),
      offset,
      limit,
    );
    return {
      sources: page.rows,
      ...(page.nextOffset !== undefined ? { nextOffset: page.nextOffset } : {}),
    };
  }
  private validateMetadata(value: unknown): CslMetadata {
    if (
      !isCslMetadata(value) ||
      !value.title.trim() ||
      Buffer.byteLength(JSON.stringify(value)) > 16384
    )
      throw new OperationError('invalidRequest', '题录需非空 title，单条不超过16KiB。');
    doiOf(value);
    return value;
  }
  private validateCollections(ids: string[]): void {
    for (const id of ids)
      if (!this.db.select().from(tables.collections).where(eq(tables.collections.id, id)).get())
        throw new OperationError('notFound', '目标集合不存在。');
  }
  private writeSource(source: LibrarySource): void {
    this.validateMetadata(source.metadata);
    if (
      [source.tags, source.collectionIds, source.relatedIds, source.origins].some(
        (values) => values.length > 100,
      )
    )
      throw new OperationError('resourceLimit', '条目关系或来源超过当前上限，请核查已有记录。');
    this.db
      .insert(tables.sources)
      .values({
        id: source.id,
        doi: doiOf(source.metadata),
        version: source.version,
        value: source,
      })
      .onConflictDoUpdate({
        target: tables.sources.id,
        set: { doi: doiOf(source.metadata), version: source.version, value: source },
      })
      .run();
  }
  private remember(source: LibrarySource): void {
    this.db.insert(tables.history).values({ sourceId: source.id, value: source }).run();
  }
  update(input: BusinessParams<'library.update'>): LibrarySource {
    this.check('read');
    this.check('write');
    this.validateMetadata(input.metadata);
    this.validateCollections(input.collectionIds);
    if (input.tags.some((tag) => !tag.trim() || tag.length > 100))
      throw new OperationError('invalidRequest', '标签需非空且不超过100字符。');
    return this.db.transaction(() => {
      const before = this.source(input.sourceId);
      if (before.revision !== input.revision)
        throw new OperationError('contentChanged', '题录已变化，请重新读取。');
      if (input.relatedIds.includes(before.id))
        throw new OperationError('invalidRequest', '版本不能关联自身。');
      for (const id of input.relatedIds) this.source(id);
      const duplicate =
        doiOf(input.metadata) && before.version !== 'unspecified'
          ? this.db
              .select()
              .from(tables.sources)
              .where(
                and(
                  eq(tables.sources.doi, doiOf(input.metadata) ?? ''),
                  eq(tables.sources.version, before.version),
                ),
              )
              .get()
          : undefined;
      if (duplicate && duplicate.id !== before.id)
        throw new OperationError('targetAmbiguous', '该DOI及版本已有条目，请核查而非覆盖。');
      const after: LibrarySource = {
        ...before,
        metadata: input.metadata,
        tags: input.tags,
        collectionIds: input.collectionIds,
        relatedIds: input.relatedIds,
        revision: before.revision + 1,
        updatedAt: timestamp(),
      };
      for (const id of new Set([...before.relatedIds, ...after.relatedIds])) {
        const related = this.source(id),
          include = after.relatedIds.includes(id);
        const ids = related.relatedIds.filter((item) => item !== before.id);
        if (include) ids.push(before.id);
        if (!isDeepStrictEqual(ids, related.relatedIds)) {
          this.remember(related);
          this.writeSource({
            ...related,
            relatedIds: ids,
            revision: related.revision + 1,
            updatedAt: timestamp(),
          });
        }
      }
      this.remember(before);
      this.writeSource(after);
      this.changed();
      return after;
    });
  }
  collections(input: BusinessParams<'library.collections'>): BusinessResult<'library.collections'> {
    this.check('read');
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.collections)
      .orderBy(tables.collections.id)
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      collections: rows.slice(0, limit).map((r) => r.value),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }
  saveCollection(input: BusinessParams<'library.saveCollection'>): LibraryCollection {
    this.check('write');
    if (!input.name.trim() || input.name.length > 200)
      throw new OperationError('invalidRequest', '集合名称需非空且不超过200字符。');
    const id = input.id ?? randomUUID();
    if (input.id) this.validateCollections([id]);
    const visited = new Set([id]);
    let parent = input.parentId;
    while (parent) {
      if (visited.has(parent)) throw new OperationError('invalidRequest', '集合不能形成循环。');
      visited.add(parent);
      const row = this.db
        .select()
        .from(tables.collections)
        .where(eq(tables.collections.id, parent))
        .get();
      if (!row) throw new OperationError('notFound', '父集合不存在。');
      parent = row.value.parentId;
    }
    const value = {
      id,
      name: input.name.trim(),
      ...(input.parentId ? { parentId: input.parentId } : {}),
    };
    this.db
      .insert(tables.collections)
      .values({ id, value })
      .onConflictDoUpdate({ target: tables.collections.id, set: { value } })
      .run();
    this.changed();
    return value;
  }
  history(input: BusinessParams<'library.history'>): BusinessResult<'library.history'> {
    this.check('read');
    this.source(input.sourceId);
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.history)
      .where(eq(tables.history.sourceId, input.sourceId))
      .orderBy(desc(tables.history.seq))
      .limit(limit + 1)
      .offset(offset)
      .all();
    const page = listPage(
      rows.map((r) => r.value),
      offset,
      limit,
    );
    return {
      sources: page.rows,
      ...(page.nextOffset !== undefined ? { nextOffset: page.nextOffset } : {}),
    };
  }
  ingest(input: BusinessParams<'library.ingest'>): LibraryBatch {
    this.check('write');
    const old = this.db
      .select()
      .from(tables.batches)
      .where(eq(tables.batches.id, input.batchId))
      .get();
    if (old) {
      if (!isDeepStrictEqual(old.request, input))
        throw new OperationError('invalidRequest', '批次身份已用于不同输入。');
      return old.value;
    }
    if (
      Buffer.byteLength(input.json) > 262144 ||
      !input.version.trim() ||
      input.version.length > 200 ||
      input.origin.length > 200
    )
      throw new OperationError('tooLarge', '题录批次/版本/来源超过限制。');
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.json);
    } catch {
      throw new OperationError('invalidRequest', 'CSL JSON 文本无法解析。');
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (!items.length || items.length > 1000)
      throw new OperationError('invalidRequest', '批次应包含1至1000条题录。');
    this.validateCollections(input.collectionIds ?? []);
    const label = input.version.trim();
    const value: LibraryBatch = {
      id: input.batchId,
      state: 'queued',
      total: items.length,
      processed: 0,
      failed: 0,
      origin: input.origin,
      version: label.toLowerCase() === 'unspecified' ? 'unspecified' : label,
      createdAt: timestamp(),
    };
    this.db.transaction(() => {
      this.db.insert(tables.batches).values({ id: value.id, value, request: input }).run();
      for (const [index, item] of items.entries())
        this.db
          .insert(tables.entries)
          .values({
            batchId: value.id,
            position: index,
            input: item,
            value: { index, state: 'pending', conflicts: [] },
          })
          .run();
      this.changed();
    });
    this.schedule(value.id);
    return value;
  }
  private batchValue(id: string): LibraryBatch {
    const row = this.db.select().from(tables.batches).where(eq(tables.batches.id, id)).get();
    if (!row) throw new OperationError('notFound', '摄取批次不存在。');
    return row.value;
  }
  batch(input: BusinessParams<'library.batch'>): BusinessResult<'library.batch'> {
    this.check('read');
    const batch = this.batchValue(input.batchId),
      offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.entries)
      .where(eq(tables.entries.batchId, batch.id))
      .orderBy(asc(tables.entries.position))
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      batch,
      entries: rows.slice(0, limit).map((row) => ({
        ...row.value,
        ...(row.input && typeof row.input === 'object' && !Array.isArray(row.input)
          ? { candidate: row.input as Record<string, unknown> }
          : {}),
      })),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }
  batches(input: BusinessParams<'library.batches'>): BusinessResult<'library.batches'> {
    this.check('read');
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.batches)
      .orderBy(
        desc(sql`json_extract(${tables.batches.value}, '$.createdAt')`),
        desc(tables.batches.id),
      )
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      batches: rows.slice(0, limit).map((r) => r.value),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }
  resume(id: string): LibraryBatch {
    this.check('write');
    const value = this.batchValue(id);
    if (value.state !== 'completed') this.schedule(id);
    return this.batchValue(id);
  }
  private schedule(id: string): void {
    if (this.active.has(id) || this.stopping) return;
    const done = Promise.resolve()
      .then(() => this.process(id))
      .catch((error) => {
        this.setBatch({ ...this.batchValue(id), state: 'interrupted', error: failure(error) });
      })
      .finally(() => this.active.delete(id));
    this.active.set(id, done);
  }
  private setBatch(value: LibraryBatch): void {
    this.db.update(tables.batches).set({ value }).where(eq(tables.batches.id, value.id)).run();
    this.changed();
  }
  private async process(id: string): Promise<void> {
    const request = this.db
      .select()
      .from(tables.batches)
      .where(eq(tables.batches.id, id))
      .get()?.request;
    if (!request) return;
    const { error: _error, ...starting } = this.batchValue(id);
    this.setBatch({ ...starting, state: 'running' });
    for (;;) {
      this.check('write');
      const row = this.db
        .select()
        .from(tables.entries)
        .where(
          and(
            eq(tables.entries.batchId, id),
            sql`json_extract(${tables.entries.value}, '$.state')='pending'`,
          ),
        )
        .orderBy(tables.entries.position)
        .limit(1)
        .get();
      if (!row) break;
      this.db.transaction(() => {
        let result: LibraryEntry;
        try {
          result = this.db.transaction(() =>
            this.ingestOne(row.input, this.batchValue(id), request.collectionIds ?? []),
          );
        } catch (error) {
          result = { index: row.position, state: 'failed', conflicts: [], error: failure(error) };
        }
        result = { ...result, index: row.position };
        this.db
          .update(tables.entries)
          .set({ value: result })
          .where(eq(tables.entries.seq, row.seq))
          .run();
        const batch = this.batchValue(id);
        this.setBatch({
          ...batch,
          processed: batch.processed + 1,
          failed: batch.failed + (result.state === 'failed' ? 1 : 0),
        });
      });
      await yieldTask();
    }
    this.setBatch({ ...this.batchValue(id), state: 'completed' });
  }
  private ingestOne(input: unknown, batch: LibraryBatch, collectionIds: string[]): LibraryEntry {
    const metadata = this.validateMetadata(input);
    this.validateCollections(collectionIds);
    const doi = doiOf(metadata);
    const existing =
      doi && batch.version !== 'unspecified'
        ? this.db
            .select()
            .from(tables.sources)
            .where(and(eq(tables.sources.doi, doi), eq(tables.sources.version, batch.version)))
            .get()?.value
        : undefined;
    const conflicts: string[] = [];
    if (existing) {
      let merged = { ...existing.metadata };
      for (const [key, value] of Object.entries(metadata)) {
        const before = existing.metadata[key];
        if (
          before === undefined ||
          before === null ||
          before === '' ||
          (Array.isArray(before) && !before.length)
        )
          merged = { ...merged, [key]: value };
        else if (!isDeepStrictEqual(before, value)) conflicts.push(key);
      }
      const origins = [...new Set([...existing.origins, batch.origin])];
      if (origins.length > 100)
        throw new OperationError('resourceLimit', '来源过多，请在现有记录核查。');
      const value: LibrarySource = {
        ...existing,
        metadata: merged,
        collectionIds: [...new Set([...existing.collectionIds, ...collectionIds])],
        origins,
        revision: existing.revision + 1,
        updatedAt: timestamp(),
      };
      this.remember(existing);
      this.writeSource(value);
      return { index: 0, state: 'reused', sourceId: value.id, conflicts };
    }
    const source: LibrarySource = {
      id: randomUUID(),
      metadata: { ...metadata },
      version: batch.version,
      revision: 1,
      tags: [],
      collectionIds,
      relatedIds: [],
      origins: [batch.origin],
      createdAt: timestamp(),
      updatedAt: timestamp(),
      attachmentState: 'unavailable',
      analysisState: 'notGenerated',
    };
    this.writeSource(source);
    return { index: 0, state: 'created', sourceId: source.id, conflicts };
  }
  backups(): Promise<LibraryBackup[]> {
    this.check('read');
    return (async () => {
      const directory = join(this.directory, 'backups');
      await privateDirectory(directory);
      const names = (await readdir(directory))
        .filter((name) => /^\d+-[\da-f-]+$/.test(name))
        .sort()
        .reverse()
        .slice(0, 10);
      return Promise.all(
        names.map(
          async (name) =>
            JSON.parse(
              await readFile(join(directory, name, 'manifest.json'), 'utf8'),
            ) as LibraryBackup,
        ),
      );
    })();
  }
  backup(): Promise<LibraryBackup> {
    this.check('read');
    return this.makeBackup();
  }
  async autoBackup(): Promise<void> {
    if (!this.stopping && this.status().autoBackup && this.dirty) await this.makeBackup();
  }
  private makeBackup(): Promise<LibraryBackup> {
    if (this.backingUp) return this.backingUp;
    const revision = this.status().revision;
    const run = (async () => {
      const value: LibraryBackup = {
        id: `${Date.now()}-${randomUUID()}`,
        createdAt: timestamp(),
        scope: 'catalog-database',
      };
      const root = join(this.directory, 'backups');
      await privateDirectory(root);
      const temporary = join(root, `.${value.id}`);
      await privateDirectory(temporary);
      await this.database?.backup(join(temporary, 'library.sqlite'));
      await atomicPrivateFile(temporary, 'manifest.json', JSON.stringify(value));
      await rename(temporary, join(root, value.id));
      this.putMeta('lastBackupRevision', String(revision));
      if (this.status().revision === revision) this.dirty = false;
      const old = (await readdir(root))
        .filter((name) => /^\d+-[\da-f-]+$/.test(name))
        .sort()
        .reverse()
        .slice(10);
      for (const name of old) await rm(join(root, name), { recursive: true });
      return value;
    })();
    this.backingUp = run;
    void run
      .finally(() => {
        this.backingUp = undefined;
      })
      .catch(() => {});
    return run;
  }
  async restore(id: string, destination: string): Promise<{ directory: string }> {
    this.check('read');
    if (!(await this.backups()).some((b) => b.id === id))
      throw new OperationError('notFound', '库备份不存在。');
    const resolved = resolve(destination);
    const target = join(await realpath(dirname(resolved)), basename(resolved));
    const profile = await realpath(this.profile);
    if (within(profile, target) || within(target, profile))
      throw new OperationError('permissionDenied', '恢复需新的独立配置目录。');
    await mkdir(target, { mode: 0o700 });
    await privateDirectory(join(target, 'library'));
    await copyFile(
      join(this.directory, 'backups', id, 'library.sqlite'),
      join(target, 'library', 'library.sqlite'),
    );
    const copy = new LiteratureCatalog(target, () => {});
    try {
      await copy.initialize();
      copy.putMeta('identity', randomUUID());
      copy.grant({ read: true, write: false, send: false, autoBackup: true });
    } finally {
      await copy.close();
    }
    return { directory: target };
  }
  async close(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.active.values()]);
    await this.backingUp?.catch(() => {});
    this.database?.close();
    this.database = undefined;
    this.store = undefined;
  }
}
