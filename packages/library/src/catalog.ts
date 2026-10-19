import { randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setImmediate as yieldTask } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { atomicPrivateFile, failure, privateDirectory } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import {
  type CslMetadata,
  type DocumentInputs,
  type DocumentOutputs,
  isCslMetadata,
  type LibraryBackup,
  type LibraryBatch,
  type LibraryCollection,
  type LibraryEntry,
  type LibraryInputs,
  type LibraryOutputs,
  type LibrarySource,
  type LibraryStatus,
  type ReadingAuthor,
  type ReadingRecord,
  validateLibrary,
} from '@scholoom/protocol/library';
import type { ProjectMaterial, ProjectMaterialPort } from '@scholoom/protocol/projects';
import Database from 'better-sqlite3';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DocumentMethod, DocumentRequest } from './document-parser.js';
import { MaterialFiles, type StoredMaterial } from './material-files.js';
import { MaterialReading, type PdfRequest } from './material-reading.js';
import * as tables from './schema.js';

type FileItem = { path: string; id: string; materialVersionId: string; sourceId: string };

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
  private readonly materials: MaterialFiles;
  constructor(
    private readonly profile: string,
    private readonly notify: () => void,
    private readonly projectFiles?: ProjectMaterialPort,
    private readonly reading = new MaterialReading(),
  ) {
    this.directory = join(profile, 'library');
    this.materials = new MaterialFiles(this.directory);
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
    await this.materials.initialize();
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
      if (version > 3) throw new Error('newer schema');
      if (version < 3) {
        if (stats)
          await database.backup(
            join(
              this.directory,
              version < 2 ? 'before-migration.sqlite' : 'before-migration-v2.sqlite',
            ),
          );
        migrate(drizzle(database), {
          migrationsFolder: fileURLToPath(new URL('./migrations/', import.meta.url)),
        });
        database.pragma('user_version = 3');
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
  grant(input: LibraryInputs['library.grant']): LibraryStatus {
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
    return this.withAttachments(this.source(id));
  }
  private withAttachments(source: LibrarySource): LibrarySource {
    const exists = this.db
      .select({ id: tables.attachments.id })
      .from(tables.attachments)
      .where(eq(tables.attachments.sourceId, source.id))
      .limit(1)
      .get();
    return { ...source, attachmentState: exists ? 'recorded' : 'unavailable' };
  }
  list(input: LibraryInputs['library.list']): LibraryOutputs['library.list'] {
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
      rows.map((r) => this.withAttachments(r.value)),
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
  update(input: LibraryInputs['library.update']): LibrarySource {
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
        metadataOrigin: 'provided',
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
      return this.withAttachments(after);
    });
  }
  collections(input: LibraryInputs['library.collections']): LibraryOutputs['library.collections'] {
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
  saveCollection(input: LibraryInputs['library.saveCollection']): LibraryCollection {
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
  history(input: LibraryInputs['library.history']): LibraryOutputs['library.history'] {
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
  ingest(input: LibraryInputs['library.ingest']): LibraryBatch {
    this.check('write');
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
    return this.accept({ kind: 'metadata', input }, items);
  }
  importFiles(input: LibraryInputs['library.importFiles']): LibraryBatch {
    if (!validateLibrary('library.importFiles', 'params', input))
      throw new OperationError('invalidRequest', '本地文件批次输入无效。');
    return this.acceptFiles(input, input.paths);
  }
  async importProjectFiles(
    input: LibraryInputs['library.importProjectFiles'],
  ): Promise<LibraryBatch> {
    if (!validateLibrary('library.importProjectFiles', 'params', input))
      throw new OperationError('invalidRequest', '项目文件批次输入无效。');
    await this.checkProject(input.projectId);
    return this.acceptFiles(input, input.projectPaths);
  }
  private acceptFiles(
    input: LibraryInputs['library.importFiles'] | LibraryInputs['library.importProjectFiles'],
    paths: string[],
  ): LibraryBatch {
    this.check('write');
    if (!input.purpose.trim()) throw new OperationError('invalidRequest', '附件用途不能为空。');
    if (input.sourceId) this.source(input.sourceId);
    return this.accept(
      { kind: 'files', input },
      paths.map(
        (path): FileItem => ({
          path,
          id: randomUUID(),
          materialVersionId: randomUUID(),
          sourceId: input.sourceId ?? randomUUID(),
        }),
      ),
    );
  }
  private accept(request: tables.LibraryBatchRequest, items: unknown[]): LibraryBatch {
    this.check('write');
    const input = request.input;
    const old = this.db
      .select()
      .from(tables.batches)
      .where(eq(tables.batches.id, input.batchId))
      .get();
    if (old) {
      if (!isDeepStrictEqual(old.request, request))
        throw new OperationError('invalidRequest', '批次身份已用于不同输入。');
      return old.value;
    }
    if (!input.version.trim() || input.version.length > 200 || input.origin.length > 200)
      throw new OperationError('invalidRequest', '版本或来源无效。');
    this.validateCollections(input.collectionIds ?? []);
    const label = input.version.trim();
    const value: LibraryBatch = {
      id: input.batchId,
      kind: request.kind,
      state: 'queued',
      total: items.length,
      processed: 0,
      failed: 0,
      origin: input.origin,
      version: label.toLowerCase() === 'unspecified' ? 'unspecified' : label,
      createdAt: timestamp(),
    };
    this.db.transaction(() => {
      this.db.insert(tables.batches).values({ id: value.id, value, request }).run();
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
  private material(id: string): StoredMaterial {
    const row = this.db
      .select()
      .from(tables.attachments)
      .where(eq(tables.attachments.id, id))
      .get();
    if (!row) throw new OperationError('notFound', '附件不存在。');
    return this.localMaterial(row.value);
  }
  private localMaterial(record: StoredMaterial): StoredMaterial {
    return record.value.storage === 'managed'
      ? { ...record, path: join(this.materials.directory, record.value.id) }
      : record;
  }
  async attachments(
    input: LibraryInputs['library.attachments'],
  ): Promise<LibraryOutputs['library.attachments']> {
    this.check('read');
    this.source(input.sourceId);
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new OperationError('invalidRequest', '附件分页范围无效。');
    const rows = this.db
      .select()
      .from(tables.attachments)
      .where(eq(tables.attachments.sourceId, input.sourceId))
      .orderBy(asc(tables.attachments.id))
      .limit(limit + 1)
      .offset(offset)
      .all();
    const attachments = await Promise.all(
      rows.slice(0, limit).map((row) => this.materials.status(this.localMaterial(row.value))),
    );
    this.check('read');
    return { attachments, ...(rows.length > limit ? { nextOffset: offset + limit } : {}) };
  }
  async readAttachment(
    input: LibraryInputs['library.readAttachment'],
  ): Promise<LibraryOutputs['library.readAttachment']> {
    this.check('read');
    const material = this.material(input.attachmentId),
      offset = input.offset ?? 0;
    const bytes = await this.materials.read(material, offset, input.limit ?? 65536);
    this.check('read');
    return {
      attachmentId: material.value.id,
      materialVersionId: material.value.materialVersionId,
      byteLength: material.byteLength,
      offset,
      base64: bytes.toString('base64'),
      ...(offset + bytes.length < material.byteLength ? { nextOffset: offset + bytes.length } : {}),
    };
  }
  private async readMaterial<T>(
    attachmentId: string,
    materialVersionId: string,
    request: PdfRequest | DocumentRequest,
    signal?: AbortSignal,
    waitForCapacity = true,
  ): Promise<T> {
    this.check('read');
    const material = this.material(attachmentId);
    if (material.value.materialVersionId !== materialVersionId)
      throw new OperationError('contentChanged', '材料版本不同。');
    return this.reading.run<T>(
      async (signal) => {
        this.check('read');
        return this.materials.snapshot(material, signal);
      },
      request,
      {
        signal,
        waitForCapacity,
        verify: async (_value, signal) => {
          await this.materials.read(this.material(attachmentId), 0, 1, signal);
          signal.throwIfAborted();
          this.check('read');
        },
      },
    );
  }
  async pdfInfo(
    input: LibraryInputs['library.pdfInfo'],
    signal?: AbortSignal,
    waitForCapacity = true,
  ): Promise<LibraryOutputs['library.pdfInfo']> {
    if (!validateLibrary('library.pdfInfo', 'params', input))
      throw new OperationError('invalidRequest', 'PDF引用无效。');
    return {
      ...input,
      ...(await this.readMaterial<{ pageCount: number }>(
        input.attachmentId,
        input.materialVersionId,
        {
          kind: 'info',
        },
        signal,
        waitForCapacity,
      )),
    };
  }
  async readPdfPage(
    input: LibraryInputs['library.readPdfPage'],
    signal?: AbortSignal,
    waitForCapacity = true,
  ): Promise<LibraryOutputs['library.readPdfPage']> {
    if (!validateLibrary('library.readPdfPage', 'params', input))
      throw new OperationError('invalidRequest', 'PDF读取范围无效。');
    return {
      attachmentId: input.attachmentId,
      materialVersionId: input.materialVersionId,
      ...(await this.readMaterial<
        Omit<LibraryOutputs['library.readPdfPage'], 'attachmentId' | 'materialVersionId'>
      >(
        input.attachmentId,
        input.materialVersionId,
        {
          kind: 'text',
          pageIndex: input.pageIndex,
          ...(input.offset === undefined ? {} : { offset: input.offset }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
        },
        signal,
        waitForCapacity,
      )),
    };
  }
  async document<M extends DocumentMethod>(
    method: M,
    input: DocumentInputs[M],
    signal?: AbortSignal,
    waitForCapacity = true,
  ): Promise<DocumentOutputs[M]> {
    if (!validateLibrary(method, 'params', input))
      throw new OperationError('invalidRequest', '文档引用或读取范围无效。');
    this.check('read');
    const name = this.material(input.attachmentId).value.name;
    const format = /\.epub$/i.test(name) ? 'epub' : /\.html?$/i.test(name) ? 'html' : undefined;
    if (!format) throw new OperationError('invalidRequest', '材料不是支持的EPUB或HTML。');
    const request = { kind: 'document', format, method, input } as DocumentRequest;
    const result = await this.readMaterial<DocumentOutputs[M]>(
      input.attachmentId,
      input.materialVersionId,
      request,
      signal,
      waitForCapacity,
    );
    if (
      !validateLibrary(method, 'result', result) ||
      result.attachmentId !== input.attachmentId ||
      result.materialVersionId !== input.materialVersionId
    )
      throw new OperationError('unavailable', '文档解析结果不符合共同契约。');
    return result;
  }
  async relocateAttachment(
    input: LibraryInputs['library.relocateAttachment'],
  ): Promise<LibraryOutputs['library.relocateAttachment']> {
    this.check('read');
    this.check('write');
    const record = this.material(input.attachmentId);
    const updated = await this.materials.relocate(record, input.path);
    this.check('read');
    this.check('write');
    // 保持期间已经生效的位置选择，旧请求不能覆盖后续更正。
    if (!isDeepStrictEqual(this.material(input.attachmentId), record))
      throw new OperationError('contentChanged', '附件位置已变化，请重读。');
    this.db
      .update(tables.attachments)
      .set({ value: updated })
      .where(eq(tables.attachments.id, record.value.id))
      .run();
    this.changed();
    return this.materials.status(updated);
  }
  readingRecord(id: string): ReadingRecord {
    this.check('read');
    const row = this.db
      .select()
      .from(tables.readingRecords)
      .where(eq(tables.readingRecords.id, id))
      .get();
    if (!row) throw new OperationError('notFound', '阅读记录不存在。');
    return row.value;
  }
  readingRecords(
    input: LibraryInputs['library.readingRecords'],
  ): LibraryOutputs['library.readingRecords'] {
    this.check('read');
    if (!validateLibrary('library.readingRecords', 'params', input))
      throw new OperationError('invalidRequest', '阅读记录查询范围无效。');
    const material = this.material(input.attachmentId);
    if (material.value.materialVersionId !== input.materialVersionId)
      throw new OperationError('contentChanged', '材料版本不同。');
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.readingRecords)
      .where(
        and(
          eq(tables.readingRecords.attachmentId, input.attachmentId),
          eq(tables.readingRecords.materialVersionId, input.materialVersionId),
          eq(tables.readingRecords.deleted, false),
        ),
      )
      .orderBy(asc(tables.readingRecords.id))
      .limit(limit + 1)
      .offset(offset)
      .all();
    const selected = listPage(
      rows.map((row) => row.value),
      offset,
      limit,
    );
    return {
      records: selected.rows,
      ...(selected.nextOffset !== undefined ? { nextOffset: selected.nextOffset } : {}),
    };
  }
  readingHistory(
    input: LibraryInputs['library.readingHistory'],
  ): LibraryOutputs['library.readingHistory'] {
    this.readingRecord(input.recordId);
    if (!validateLibrary('library.readingHistory', 'params', input))
      throw new OperationError('invalidRequest', '阅读历史查询范围无效。');
    const offset = input.offset ?? 0,
      limit = input.limit ?? 25;
    const rows = this.db
      .select()
      .from(tables.readingHistory)
      .where(eq(tables.readingHistory.recordId, input.recordId))
      .orderBy(desc(tables.readingHistory.seq))
      .limit(limit + 1)
      .offset(offset)
      .all();
    const selected = listPage(
      rows.map((row) => row.value),
      offset,
      limit,
    );
    return {
      records: selected.rows,
      ...(selected.nextOffset !== undefined ? { nextOffset: selected.nextOffset } : {}),
    };
  }
  async saveReadingRecord(
    input: LibraryInputs['library.saveReadingRecord'],
    author: ReadingAuthor = { kind: 'user' },
    signal?: AbortSignal,
  ): Promise<ReadingRecord> {
    this.check('read');
    this.check('write');
    if (
      !validateLibrary('library.saveReadingRecord', 'params', input) ||
      Buffer.byteLength(JSON.stringify(input)) > 65536 ||
      (author.kind === 'agent' && !author.sessionId)
    )
      throw new OperationError('invalidRequest', '阅读记录输入无效或超限。');
    const material = this.material(input.attachmentId);
    if (material.value.materialVersionId !== input.materialVersionId)
      throw new OperationError('contentChanged', '材料版本不同。');
    const existing = this.db
      .select()
      .from(tables.readingRecords)
      .where(eq(tables.readingRecords.id, input.recordId))
      .get();
    if (input.expectedRevision === undefined && existing) {
      if (
        !isDeepStrictEqual(existing.creation, input) ||
        !isDeepStrictEqual(existing.createdBy, author)
      )
        throw new OperationError('contentChanged', '该阅读记录身份已有不同创建输入。');
      return existing.value;
    }
    if (
      (input.kind === 'highlight' &&
        (!input.quote.trim() ||
          !input.location ||
          ('pageIndex' in input.location
            ? !input.location.rects?.length
            : input.location.end <= input.location.start ||
              input.location.end - input.location.start !== input.quote.length))) ||
      (input.kind === 'bookmark' && !input.location) ||
      (input.kind === 'note' && !input.body.trim())
    )
      throw new OperationError('invalidRequest', '阅读记录缺少摘录、位置或说明。');
    const evidenceUnchanged =
      existing &&
      isDeepStrictEqual(existing.value.location, input.location) &&
      existing.value.quote === input.quote;
    if (!evidenceUnchanged) {
      if (input.location && 'kind' in input.location) {
        const location = input.location;
        if (location.end < location.start)
          throw new OperationError('invalidRequest', '文字区间无效。');
        const section = await this.document(
          'library.readDocumentSection',
          {
            attachmentId: input.attachmentId,
            materialVersionId: input.materialVersionId,
            sectionId: location.sectionId,
            offset: location.start,
            limit: Math.max(2, Math.min(32768, location.end - location.start)),
            textOnly: true,
          },
          signal,
          author.kind !== 'agent',
        );
        if (
          location.end > section.length ||
          (input.quote &&
            (input.quote.length !== location.end - location.start ||
              section.text.slice(0, input.quote.length) !== input.quote))
        )
          throw new OperationError('invalidRequest', '摘录或区间与材料正文不同。');
      } else if (input.location) {
        const size = await this.readMaterial<{ width: number; height: number }>(
          input.attachmentId,
          input.materialVersionId,
          { kind: 'geometry', pageIndex: input.location.pageIndex },
          signal,
          author.kind !== 'agent',
        );
        if (
          input.location.rects?.some(
            (rect) =>
              rect.x + rect.width > size.width + 0.01 || rect.y + rect.height > size.height + 0.01,
          )
        )
          throw new OperationError('invalidRequest', '批注区域超出PDF页面。');
      } else await this.materials.read(material, 0, 1, signal);
    }
    signal?.throwIfAborted();
    this.check('read');
    this.check('write');
    return this.db.transaction(() => {
      const current = this.db
        .select()
        .from(tables.readingRecords)
        .where(eq(tables.readingRecords.id, input.recordId))
        .get();
      if (current) {
        if (input.expectedRevision === undefined) {
          if (
            isDeepStrictEqual(current.creation, input) &&
            isDeepStrictEqual(current.createdBy, author)
          )
            return current.value;
          throw new OperationError('contentChanged', '该阅读记录身份已使用。');
        }
        if (
          current.value.deleted ||
          current.value.revision !== input.expectedRevision ||
          current.value.attachmentId !== input.attachmentId ||
          current.value.materialVersionId !== input.materialVersionId ||
          current.value.kind !== input.kind
        )
          throw new OperationError('contentChanged', '阅读记录已变化，请重读。');
      } else if (input.expectedRevision !== undefined) {
        throw new OperationError('notFound', '阅读记录不存在。');
      }
      const now = timestamp();
      const record: ReadingRecord = {
        id: input.recordId,
        sourceId: material.value.sourceId,
        attachmentId: input.attachmentId,
        materialVersionId: input.materialVersionId,
        kind: input.kind,
        ...(input.location ? { location: input.location } : {}),
        quote: input.quote,
        body: input.body,
        createdBy: current?.value.createdBy ?? author,
        updatedBy: author,
        createdAt: current?.value.createdAt ?? now,
        updatedAt: now,
        revision: (current?.value.revision ?? 0) + 1,
        deleted: false,
      };
      if (current) {
        this.db
          .insert(tables.readingHistory)
          .values({ recordId: record.id, value: current.value })
          .run();
        this.db
          .update(tables.readingRecords)
          .set({ value: record })
          .where(eq(tables.readingRecords.id, record.id))
          .run();
      } else {
        this.db
          .insert(tables.readingRecords)
          .values({
            id: record.id,
            attachmentId: record.attachmentId,
            materialVersionId: record.materialVersionId,
            deleted: false,
            value: record,
            creation: input,
            createdBy: author,
          })
          .run();
      }
      this.changed();
      return record;
    });
  }
  removeReadingRecord(
    input: LibraryInputs['library.removeReadingRecord'],
    author: ReadingAuthor = { kind: 'user' },
  ): ReadingRecord {
    this.check('read');
    this.check('write');
    if (!validateLibrary('library.removeReadingRecord', 'params', input))
      throw new OperationError('invalidRequest', '阅读记录移除输入无效。');
    return this.db.transaction(() => {
      const before = this.readingRecord(input.recordId);
      if (before.deleted || before.revision !== input.expectedRevision)
        throw new OperationError('contentChanged', '阅读记录已变化，请重读。');
      const record = {
        ...before,
        deleted: true,
        revision: before.revision + 1,
        updatedBy: author,
        updatedAt: timestamp(),
      };
      this.db.insert(tables.readingHistory).values({ recordId: before.id, value: before }).run();
      this.db
        .update(tables.readingRecords)
        .set({ deleted: true, value: record })
        .where(eq(tables.readingRecords.id, before.id))
        .run();
      this.changed();
      return record;
    });
  }
  private batchValue(id: string): LibraryBatch {
    const row = this.db.select().from(tables.batches).where(eq(tables.batches.id, id)).get();
    if (!row) throw new OperationError('notFound', '摄取批次不存在。');
    return row.value;
  }
  batch(input: LibraryInputs['library.batch']): LibraryOutputs['library.batch'] {
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
        ...(batch.kind === 'files'
          ? { candidate: { filename: basename((row.input as FileItem).path) } }
          : {}),
        ...(batch.kind === 'metadata' &&
        row.input &&
        typeof row.input === 'object' &&
        !Array.isArray(row.input)
          ? { candidate: row.input as Record<string, unknown> }
          : {}),
      })),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }
  batches(input: LibraryInputs['library.batches']): LibraryOutputs['library.batches'] {
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
      let prepared: StoredMaterial | undefined;
      let preparationError: unknown;
      if (request.kind === 'files') {
        if ('projectId' in request.input) await this.checkProject(request.input.projectId);
        try {
          prepared = await this.prepareMaterial(row.input as FileItem, request.input);
          if ('projectId' in request.input) {
            const current = await this.resolveProjectMaterial(
              request.input.projectId,
              (row.input as FileItem).path,
            );
            if (
              prepared.source &&
              (current.fileId !== prepared.source.fileId || current.basis !== prepared.source.basis)
            )
              throw new OperationError('contentChanged', '项目材料在准备后已变化。');
          }
        } catch (error) {
          preparationError = error;
        }
        this.check('write');
        if ('projectId' in request.input) await this.checkProject(request.input.projectId);
      }
      this.db.transaction(() => {
        let result: LibraryEntry;
        try {
          result = this.db.transaction(() => {
            if (preparationError) throw preparationError;
            return request.kind === 'metadata'
              ? this.ingestOne(row.input, this.batchValue(id), request.input.collectionIds ?? [])
              : this.commitMaterial(
                  row.input as FileItem,
                  prepared as StoredMaterial,
                  request.input,
                  this.batchValue(id),
                );
          });
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
      if (
        prepared?.value.storage === 'managed' &&
        !this.db
          .select({ id: tables.attachments.id })
          .from(tables.attachments)
          .where(eq(tables.attachments.id, prepared.value.id))
          .get()
      ) {
        await this.materials.discard(prepared.value.id);
      }
      await yieldTask();
    }
    this.setBatch({ ...this.batchValue(id), state: 'completed' });
  }
  private async resolveProjectMaterial(projectId: string, path: string): Promise<ProjectMaterial> {
    const files = await this.checkProject(projectId);
    const result = await files['project.material']({ projectId, path });
    await this.checkProject(projectId);
    return result;
  }
  private async checkProject(projectId: string) {
    if (!this.projectFiles) throw new OperationError('permissionDenied', '项目文件访问未配置。');
    await this.projectFiles['project.checkRead']({ projectId });
    return this.projectFiles;
  }
  private async prepareMaterial(
    item: FileItem,
    input: LibraryInputs['library.importFiles'] | LibraryInputs['library.importProjectFiles'],
  ): Promise<StoredMaterial> {
    const source =
      'projectId' in input
        ? await this.resolveProjectMaterial(input.projectId, item.path)
        : undefined;
    const path = source?.nativePath ?? item.path;
    const storage = input.storage ?? 'managed';
    const content = await this.materials.capture(item.id, path, storage, source?.basis);
    return {
      ...content,
      ...(source ? { source } : {}),
      value: {
        id: item.id,
        sourceId: item.sourceId,
        materialVersionId: item.materialVersionId,
        name: basename(path),
        purpose: input.purpose.trim(),
        storage,
        byteLength: content.byteLength,
        createdAt: timestamp(),
      },
    };
  }
  private commitMaterial(
    item: FileItem,
    record: StoredMaterial,
    input: LibraryInputs['library.importFiles'] | LibraryInputs['library.importProjectFiles'],
    batch: LibraryBatch,
  ): LibraryEntry {
    if (input.sourceId) this.source(input.sourceId);
    else if (
      !this.db.select().from(tables.sources).where(eq(tables.sources.id, item.sourceId)).get()
    ) {
      this.ingestOne({ title: record.value.name }, batch, input.collectionIds ?? [], item.sourceId);
    }
    const existing = this.db
      .select()
      .from(tables.attachments)
      .where(
        and(
          eq(tables.attachments.sourceId, item.sourceId),
          eq(tables.attachments.purpose, record.value.purpose),
          eq(tables.attachments.storage, record.value.storage),
          eq(tables.attachments.hash, record.hash),
        ),
      )
      .get();
    if (existing)
      return {
        index: 0,
        state: 'reused',
        sourceId: item.sourceId,
        attachmentId: existing.id,
        conflicts: [],
      };
    this.db
      .insert(tables.attachments)
      .values({
        id: record.value.id,
        sourceId: item.sourceId,
        purpose: record.value.purpose,
        storage: record.value.storage,
        hash: record.hash,
        value: record,
      })
      .run();
    return {
      index: 0,
      state: 'created',
      sourceId: item.sourceId,
      attachmentId: item.id,
      conflicts: [],
    };
  }
  private ingestOne(
    input: unknown,
    batch: LibraryBatch,
    collectionIds: string[],
    sourceId?: string,
  ): LibraryEntry {
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
      id: sourceId ?? randomUUID(),
      metadata: { ...metadata },
      metadataOrigin: batch.kind === 'files' ? 'filename' : 'provided',
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
      const exclusions: NonNullable<LibraryBackup['exclusions']> = [];
      const value: LibraryBackup = {
        id: `${Date.now()}-${randomUUID()}`,
        createdAt: timestamp(),
        scope: 'catalog-and-managed-files',
        exclusions,
      };
      const root = join(this.directory, 'backups');
      await privateDirectory(root);
      const temporary = join(root, `.${value.id}`);
      await privateDirectory(temporary);
      await this.database?.backup(join(temporary, 'library.sqlite'));
      const snapshot = new Database(join(temporary, 'library.sqlite'), { readonly: true });
      const files = new MaterialFiles(temporary);
      try {
        await files.initialize();
        let after = '';
        for (;;) {
          const rows = snapshot
            .prepare('SELECT id,value FROM attachments WHERE id > ? ORDER BY id LIMIT 100')
            .all(after) as { id: string; value: string }[];
          if (!rows.length) break;
          for (const row of rows) {
            after = row.id;
            const record = this.localMaterial(JSON.parse(row.value) as StoredMaterial);
            if (record.value.storage === 'linked') {
              exclusions.push({ attachmentId: row.id, reason: 'externalDependency' });
              continue;
            }
            try {
              const content = await files.capture(row.id, record.path, 'managed');
              if (content.hash !== record.hash) {
                await files.discard(row.id);
                throw new OperationError('contentChanged', '托管材料版本已变化。');
              }
            } catch (error) {
              exclusions.push({ attachmentId: row.id, reason: failure(error).code });
            }
          }
          await yieldTask();
        }
      } finally {
        snapshot.close();
      }
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
    const backup = (await this.backups()).find((b) => b.id === id);
    if (!backup) throw new OperationError('notFound', '库备份不存在。');
    const resolved = resolve(destination);
    const target = join(await realpath(dirname(resolved)), basename(resolved));
    const profile = await realpath(this.profile);
    if (within(profile, target) || within(target, profile))
      throw new OperationError('permissionDenied', '恢复需新的独立配置目录。');
    this.check('read');
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
      copy.putMeta('restored-backup', JSON.stringify(backup));
      const files = new MaterialFiles(join(this.directory, 'backups', id));
      let after = '';
      for (;;) {
        const rows = copy.db
          .select()
          .from(tables.attachments)
          .where(sql`${tables.attachments.id} > ${after}`)
          .orderBy(tables.attachments.id)
          .limit(100)
          .all();
        if (!rows.length) break;
        for (const row of rows) {
          after = row.id;
          this.check('read');
          if (row.value.value.storage !== 'managed') continue;
          let content = { ...row.value, path: join(copy.materials.directory, row.id) };
          if (
            backup.scope === 'catalog-and-managed-files' &&
            !backup.exclusions?.some((entry) => entry.attachmentId === row.id)
          ) {
            const restored = await copy.materials.capture(
              row.id,
              join(files.directory, row.id),
              'managed',
            );
            if (restored.hash !== row.value.hash)
              throw new OperationError('contentChanged', '备份材料版本不匹配，副本保留供核查。');
            content = { ...row.value, ...restored };
          }
          copy.db
            .update(tables.attachments)
            .set({ value: content })
            .where(eq(tables.attachments.id, row.id))
            .run();
        }
      }
    } finally {
      await copy.close();
    }
    return { directory: target };
  }
  async close(): Promise<void> {
    this.stopping = true;
    await this.reading.close();
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.active.values()]);
    await this.backingUp?.catch(() => {});
    this.database?.close();
    this.database = undefined;
    this.store = undefined;
  }
}
