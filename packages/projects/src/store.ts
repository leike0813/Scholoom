import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { atomicPrivateFile, fileFingerprint, privateDirectory } from '@scholoom/platform/node';
import { type CallContext, OperationError } from '@scholoom/protocol/core';
import {
  type Artifact,
  type FileContent,
  type FileEdit,
  type FileEditOrigin,
  type FileEntry,
  isFileEditOrigin,
  type Project,
  type ProjectBackup,
  type ProjectsInputs,
  type ProjectsOutputs,
  projectLimits,
} from '@scholoom/protocol/projects';
import Database from 'better-sqlite3';
import { desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { type CreationOwner, ProjectCreations } from './creations.js';
import { byteBasis, imageMime, ProjectFiles } from './files.js';
import * as tables from './schema.js';

/** Physical container upgrade injected by the host; projects never opens another module's tables. */
export type ContainerInitializer = (database: Database.Database, internal: string) => Promise<void>;
export type FileEditSource = { origin: FileEditOrigin; revertsEditId?: string };

const hidden = new Set(['.scholoom', '.git', 'node_modules', 'dist', 'build', 'target', '.venv']);
const accessScope = new AsyncLocalStorage<{
  agent: boolean;
  projectId?: string | undefined;
  targetProjectId?: string | undefined;
  authorize?: (() => void) | undefined;
}>();
export const isPrivate = (name: string) =>
  hidden.has(name) ||
  name === '.env' ||
  name.startsWith('.env.') ||
  /\.(?:pem|key|crt)$/i.test(name);
export const within = (root: string, path: string) => {
  const part = relative(root, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
};
const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export class ProjectStore {
  async material(path: string): Promise<import('@scholoom/protocol/projects').ProjectMaterial> {
    this.check('read');
    const nativePath = await this.path(path);
    const reference = await this.files.reference(path);
    const stat = await lstat(nativePath, { bigint: true });
    if (!stat.isFile()) throw new OperationError('invalidRequest', '材料必须是普通文件。');
    this.check('read');
    return {
      projectId: this.project.id,
      fileId: reference.fileId,
      nativePath,
      basis: fileFingerprint(stat),
    };
  }
  readonly files: ProjectFiles;
  readonly creations: ProjectCreations;
  readonly database: Database.Database;
  readonly db;
  readonly internal: string;
  private bases = new Map<string, { path: string; content: string }>();
  private dirty = false;
  private changeVersion = 0;
  private fileStamp = '';
  private backingUp: Promise<ProjectBackup> | undefined;

  private constructor(
    readonly project: Project,
    database: Database.Database,
    private readonly applicationDirectory: string,
    private readonly initializeContainer: ContainerInitializer,
  ) {
    this.database = database;
    this.db = drizzle(database, { schema: tables });
    this.internal = join(project.path, '.scholoom');
    this.files = new ProjectFiles(this);
    this.creations = new ProjectCreations(this);
  }

  static async open(
    path: string,
    applicationDirectory: string,
    initializeContainer: ContainerInitializer,
    application = false,
  ): Promise<ProjectStore> {
    const root = await realpath(path);
    applicationDirectory = await realpath(applicationDirectory);
    if (!(await stat(root)).isDirectory())
      throw new OperationError('invalidRequest', '请选择项目目录。');
    const internal = join(root, '.scholoom');
    if (!application && within(applicationDirectory, root))
      throw new OperationError('permissionDenied', '不能将应用私有配置作为研究项目。');
    await privateDirectory(internal);
    const identityPath = join(internal, 'identity.json');
    let identity: { id: string };
    try {
      identity = JSON.parse(await readFile(identityPath, 'utf8'));
      if (typeof identity.id !== 'string' || !identity.id)
        throw new Error('Invalid project identity');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new OperationError('unavailable', '项目身份文件损坏；已保留现场。');
      identity = { id: application ? 'application' : randomUUID() };
      try {
        await writeFile(identityPath, JSON.stringify(identity), { flag: 'wx', mode: 0o600 });
      } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure;
        identity = JSON.parse(await readFile(identityPath, 'utf8'));
      }
    }
    const dbPath = join(internal, 'project.sqlite');
    if (await exists(dbPath)) {
      const info = await lstat(dbPath);
      if (!info.isFile() || info.isSymbolicLink())
        throw new OperationError('permissionDenied', '数据库文件不安全。');
    }
    const database = new Database(dbPath);
    try {
      database.pragma('journal_mode = WAL');
      database.pragma('busy_timeout = 1000');
      if (database.pragma('quick_check', { simple: true }) !== 'ok')
        throw new Error('Corrupt database');
      await initializeContainer(database, internal);
      const project: Project = {
        id: identity.id,
        path: root,
        name: application ? '普通会话' : basename(root),
        trust: application ? 'trusted' : 'pending',
        autoBackup: !application,
      };
      const store = new ProjectStore(project, database, applicationDirectory, initializeContainer);
      const grants = store.db.select().from(tables.meta).where(eq(tables.meta.key, 'grants')).get();
      if (grants) {
        const saved = JSON.parse(grants.value) as Pick<Project, 'trust' | 'autoBackup'>;
        if (!['pending', 'trusted', 'restricted'].includes(saved.trust))
          throw new Error('Invalid project trust');
        project.trust = application ? 'trusted' : saved.trust;
        project.autoBackup = application ? false : saved.autoBackup;
      }
      return store;
    } catch {
      database.close();
      throw new OperationError('unavailable', '项目数据库损坏或版本不兼容；停止写入并保留现场。');
    }
  }

  grant(values: Pick<Project, 'trust' | 'autoBackup'>): Project {
    if (accessScope.getStore()?.agent)
      throw new OperationError('permissionDenied', 'Agent 不能修改项目信任。');
    this.db
      .insert(tables.meta)
      .values({ key: 'grants', value: JSON.stringify(values) })
      .onConflictDoUpdate({ target: tables.meta.key, set: { value: JSON.stringify(values) } })
      .run();
    Object.assign(this.project, values);
    this.dirty = true;
    return this.project;
  }

  check(operation: 'read' | 'write' | 'send'): void {
    if (this.project.id === 'application' && operation !== 'send')
      throw new OperationError('permissionDenied', '普通会话没有项目文件权限。');
    const caller = accessScope.getStore();
    caller?.authorize?.();
    if (
      caller?.targetProjectId &&
      (operation !== 'read' || caller.targetProjectId !== this.project.id)
    )
      throw new OperationError('permissionDenied', '目标访问范围只允许读取指定项目。');
    if (
      caller?.agent &&
      caller.projectId !== this.project.id &&
      caller.targetProjectId !== this.project.id
    )
      throw new OperationError('permissionDenied', '项目不属于当前执行范围。');
    if ((operation === 'send' || caller?.agent) && this.project.trust !== 'trusted')
      throw new OperationError('permissionDenied', '项目尚未信任，Agent 无法访问项目材料。');
  }

  invalidateBases(paths: string[]): void {
    for (const [key, basis] of this.bases)
      if (paths.some((path) => basis.path === path || basis.path.startsWith(`${path}${sep}`)))
        this.bases.delete(key);
  }

  async path(input: string, create = false): Promise<string> {
    const portable = input.replaceAll('\\', '/');
    if (
      portable.split('/').some(isPrivate) ||
      portable.includes('\0') ||
      portable.split('/').includes('..')
    )
      throw new OperationError('permissionDenied', '不能访问私有或越界路径。');
    const candidate = resolve(this.project.path, portable);
    if (!within(this.project.path, candidate))
      throw new OperationError('permissionDenied', '路径超出项目范围。');
    let target: string;
    try {
      target = await realpath(candidate);
    } catch (error) {
      if (!create || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      target = join(await realpath(dirname(candidate)), basename(candidate));
    }
    if (
      !within(this.project.path, target) ||
      within(this.applicationDirectory, target) ||
      relative(this.project.path, target).split(sep).some(isPrivate)
    )
      throw new OperationError('permissionDenied', '目标超出授权范围。');
    return target;
  }

  async list(
    input = '',
    offset = 0,
    limit = 100,
    version?: string,
    anchor?: string,
  ): Promise<{ entries: FileEntry[]; nextOffset?: number; version: string; offset: number }> {
    this.check('read');
    const directory = await this.path(input);
    const before = fileFingerprint(await lstat(directory, { bigint: true }));
    if (version && before !== version)
      throw new OperationError('contentChanged', '目录已变化，请重新读取。');
    const names: { name: string; kind: 'file' | 'dir' }[] = [];
    const handle = await import('node:fs/promises').then((fs) => fs.opendir(directory));
    for await (const entry of handle) {
      if (
        isPrivate(entry.name) ||
        entry.isSymbolicLink() ||
        (!entry.isFile() && !entry.isDirectory())
      )
        continue;
      names.push({ name: entry.name, kind: entry.isDirectory() ? 'dir' : 'file' });
    }
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    names.sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === 'dir' ? -1 : 1) ||
        collator.compare(a.name, b.name) ||
        a.name.localeCompare(b.name, 'en'),
    );
    if (anchor !== undefined) {
      const index = names.findIndex((entry) => entry.name === anchor);
      if (index < 0) throw new OperationError('notFound', '目录中没有此条目。');
      offset = Math.floor(index / limit) * limit;
    }
    const entries: FileEntry[] = [];
    for (const entry of names.slice(offset, offset + limit)) {
      entries.push({
        fileId: (
          await this.files.reference(relative(this.project.path, join(directory, entry.name)))
        ).fileId,
        name: entry.name,
        kind: entry.kind,
        path: relative(this.project.path, join(directory, entry.name)).split(sep).join('/'),
      });
    }
    if (before !== fileFingerprint(await lstat(directory, { bigint: true })))
      throw new OperationError('contentChanged', '目录已变化，请重新读取。');
    return {
      entries,
      version: before,
      offset,
      ...(names.length > offset + limit ? { nextOffset: offset + limit } : {}),
    };
  }

  async read(input: string, offset = 0): Promise<FileContent> {
    this.check('read');
    const path = await this.path(input);
    return this.files.coordinate([path], async () => {
      this.check('read');
      if ((await this.path(input)) !== path)
        throw new OperationError('contentChanged', '文件位置已变化，请重新读取。');
      const handle = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
      let value: string;
      let truncated: boolean;
      try {
        const info = await handle.stat();
        if (!info.isFile()) throw new OperationError('targetAmbiguous', '目标不是普通文件。');
        const buffer = Buffer.alloc(
          Math.min(projectLimits.fileBytes + 1, Math.max(0, info.size - offset)),
        );
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        truncated = info.size > offset + projectLimits.fileBytes || offset > 0;
        try {
          value = new TextDecoder('utf-8', { fatal: true }).decode(
            buffer.subarray(0, Math.min(bytesRead, projectLimits.fileBytes)),
            { stream: truncated },
          );
        } catch {
          throw new OperationError('invalidRequest', '本期仅支持 UTF-8 文本材料。');
        }
        if (value.includes('\0'))
          throw new OperationError('invalidRequest', '本期仅支持 UTF-8 文本材料。');
      } finally {
        await handle.close();
      }
      const basis = randomUUID();
      if (!truncated) {
        if (this.bases.size >= 100) this.bases.delete(this.bases.keys().next().value as string);
        this.bases.set(basis, { path, content: value });
      }
      return {
        path: input,
        fileId: (await this.files.reference(input)).fileId,
        content: value,
        basis,
        truncated,
      };
    });
  }

  private serial<T>(path: string, run: () => Promise<T>): Promise<T> {
    return this.files.coordinate([path], run);
  }

  async save(
    input: string,
    content: string,
    basis?: string,
    expected?: string,
    expectedFileId?: string,
    operation?: CreationOwner,
    resourceBasis?: string,
    source?: FileEditSource,
    expectedByteBasis?: string,
    checkReceipt?: (edit: FileEdit) => void,
  ): Promise<FileEdit> {
    this.check('write');
    const editSource: FileEditSource = structuredClone(
      source ?? { origin: operation?.origin ?? { kind: 'unknown', reason: 'unattributed' } },
    );
    if (!isFileEditOrigin(editSource.origin))
      throw new OperationError('invalidRequest', '修改来源不符合领域契约。');
    if (Buffer.byteLength(content) > projectLimits.fileBytes)
      throw new OperationError('tooLarge', '文件超过本期编辑上限。');
    const target = await this.path(input, true);
    if (operation && !/^[A-Za-z0-9_-]{1,128}$/.test(operation.operationId))
      throw new OperationError('invalidRequest', '创建操作身份无效。');
    const paths = [target];
    if (operation) paths.push(join(this.internal, 'candidates', operation.operationId));
    return this.files.coordinate(paths, async () => {
      this.check('write');
      if ((await this.path(input, true)) !== target)
        throw new OperationError('contentChanged', '目标路径已变化。');
      const create = basis === undefined && expected === undefined;
      if (resourceBasis && create)
        throw new OperationError('invalidRequest', '资源版本保存要求原文件读取依据。');
      if (operation) {
        if (!create) throw new OperationError('invalidRequest', '创建操作身份无效。');
        input = relative(this.project.path, target).split(sep).join('/');
        const previous = await this.creations.repeat(input, content, operation);
        if (previous) return previous;
      }
      const priorReference = create ? undefined : await this.files.reference(input);
      if (expectedFileId && priorReference?.fileId !== expectedFileId)
        throw new OperationError('contentChanged', '文件身份或位置已变化，请重新读取。');
      let before = '';
      let beforeBasis: string | undefined;
      let mode = 0o600;
      if (!create) {
        const source = basis ? this.bases.get(basis) : undefined;
        if (expected === undefined && (!source || source.path !== target))
          throw new OperationError('contentChanged', '读取依据失效，请重新读取。');
        const handle = await open(target, 'r');
        try {
          const original = await handle.stat({ bigint: true });
          beforeBasis = fileFingerprint(original);
          if (expectedByteBasis && byteBasis(original) !== expectedByteBasis)
            throw new OperationError('contentChanged', '原编辑的文件实体或内容版本已变化。');
          if (
            resourceBasis &&
            fileFingerprint(await handle.stat({ bigint: true })) !== resourceBasis
          )
            throw new OperationError('contentChanged', '资源版本已变化，请重新读取。');
          const info = await handle.stat();
          mode = info.mode & 0o777;
          if (info.size > projectLimits.fileBytes)
            throw new OperationError('contentChanged', '文件已变化，请重新读取。');
          before = await handle.readFile('utf8');
        } finally {
          await handle.close();
        }
        if (before !== (expected ?? source?.content))
          throw new OperationError('contentChanged', '整份文件内容已变化，请重新读取后修改。');
      } else if (await exists(target))
        throw new OperationError('contentChanged', '新建目标已存在，不能覆盖。');
      if (create) this.files.retirePath(relative(this.project.path, target).split(sep).join('/'));
      const edit: FileEdit = {
        id: randomUUID(),
        path: input,
        before,
        after: content,
        createdAt: new Date().toISOString(),
        created: create,
        origin: editSource.origin,
        ...(editSource.revertsEditId ? { revertsEditId: editSource.revertsEditId } : {}),
        ...(priorReference && beforeBasis
          ? {
              beforeEvidence: {
                ref: {
                  source: 'project',
                  projectId: this.project.id,
                  fileId: priorReference.fileId,
                },
                basis: beforeBasis,
              },
            }
          : {}),
        ...(operation ? { fileId: randomUUID() } : {}),
      };
      checkReceipt?.(edit);
      const candidateDir = join(this.internal, 'candidates');
      await privateDirectory(candidateDir);
      const candidate = join(candidateDir, edit.id);
      await writeFile(candidate, content, { mode: 0o600, flag: 'wx' });
      const temporary = operation ? candidate : join(dirname(target), `.scholoom-${edit.id}.tmp`);
      try {
        const handle = await open(temporary, operation ? 'r+' : 'wx', mode);
        try {
          if (!operation) {
            await handle.chmod(mode);
            await handle.writeFile(content);
          }
          await handle.sync();
          edit.basis = byteBasis(await handle.stat({ bigint: true }));
        } finally {
          await handle.close();
        }
        if (operation) await this.creations.prepare(input, edit, operation, candidate, target);
        this.check('write');
        if ((await this.path(input, true)) !== target)
          throw new OperationError('contentChanged', '发布目标路径已变化。');
        const conditionBasis = resourceBasis ?? (expectedByteBasis ? beforeBasis : undefined);
        if (
          conditionBasis &&
          fileFingerprint(await lstat(target, { bigint: true })) !== conditionBasis
        )
          throw new OperationError('contentChanged', '发布前资源版本已变化，请重新读取。');
        if (create) {
          await link(temporary, target);
          if (!operation) await unlink(temporary);
        } else await rename(temporary, target);
      } catch (error) {
        if (!operation) await unlink(temporary).catch(() => {});
        if (operation && this.creations.find(operation.operationId, operation.owner))
          throw new OperationError(
            'outcomeUnknown',
            '创建发布或登记结果待核查，候选与收据已保留。',
          );
        if ((await exists(target)) && (await readFile(target, 'utf8')) === content)
          throw new OperationError(
            'outcomeUnknown',
            '文件可能已保存；请核查实际内容，候选已保留。',
          );
        throw error;
      }
      if (operation) {
        const row = this.creations.find(operation.operationId, operation.owner);
        if (!row) throw new OperationError('outcomeUnknown', '创建收据不可用。');
        try {
          const current = await this.creations.inspect(row);
          if (current.value.state !== 'complete') throw new Error('publication changed');
          return current.details.creation?.edit ?? edit;
        } catch {
          throw new OperationError('outcomeUnknown', '文件已发布，但登记结果待核查。');
        }
      }
      try {
        edit.fileId = (priorReference ?? (await this.files.reference(input))).fileId;
        const published = await lstat(target, { bigint: true });
        if (byteBasis(published) !== edit.basis)
          throw new OperationError('outcomeUnknown', '保存后的文件已被替换或修改。');
        edit.afterEvidence = {
          ref: { source: 'project', projectId: this.project.id, fileId: edit.fileId },
          basis: fileFingerprint(published),
        };
        this.db.transaction((tx) => {
          tx.insert(tables.edits).values({ id: edit.id, path: input, value: edit }).run();
          const old = tx
            .select({ seq: tables.edits.seq })
            .from(tables.edits)
            .where(
              sql`json_extract(${tables.edits.value}, '$.fileId') = ${edit.fileId} OR (${tables.edits.path} = ${input} AND json_extract(${tables.edits.value}, '$.fileId') IS NULL)`,
            )
            .orderBy(desc(tables.edits.seq))
            .limit(100)
            .offset(projectLimits.history)
            .all();
          for (const row of old) tx.delete(tables.edits).where(eq(tables.edits.seq, row.seq)).run();
          if (old.length)
            tx.insert(tables.meta)
              .values({ key: `file-history-pruned:${edit.fileId}`, value: 'true' })
              .onConflictDoNothing()
              .run();
        });
      } catch {
        throw new OperationError('outcomeUnknown', '文件已保存，但历史登记结果未知；请核查。');
      }
      this.files.changed();
      await unlink(candidate).catch(() => {});
      return edit;
    });
  }

  history(path: string): FileEdit[] {
    this.check('read');
    const ids = this.db
      .select()
      .from(tables.fileReferences)
      .where(eq(tables.fileReferences.path, path))
      .all()
      .filter((row) => row.value.state === 'present')
      .map((row) => row.id);
    return this.db
      .select()
      .from(tables.edits)
      .where(
        ids.length
          ? sql`json_extract(${tables.edits.value}, '$.fileId') IN (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`,`,
            )}) OR (${tables.edits.path} = ${path} AND json_extract(${tables.edits.value}, '$.fileId') IS NULL)`
          : eq(tables.edits.path, path),
      )
      .orderBy(desc(tables.edits.seq))
      .limit(projectLimits.history)
      .all()
      .map((row) => row.value)
      .filter((edit) =>
        edit.fileId
          ? this.files.location(edit.fileId).path === path &&
            this.files.location(edit.fileId).state === 'present'
          : edit.path === path,
      )
      .slice(0, projectLimits.history);
  }

  edit(fileId: string, editId: string): FileEdit {
    this.check('read');
    this.files.location(fileId);
    const row = this.db.select().from(tables.edits).where(eq(tables.edits.id, editId)).get();
    if (!row || row.value.fileId !== fileId)
      throw new OperationError('notFound', '修改记录不属于此文件或已不在保留范围。');
    return row.value;
  }

  editForEvidence(fileId: string, basis: string): string | undefined {
    this.check('read');
    return this.db
      .select()
      .from(tables.edits)
      .where(
        sql`json_extract(${tables.edits.value}, '$.fileId') = ${fileId} AND json_extract(${tables.edits.value}, '$.afterEvidence.basis') = ${basis}`,
      )
      .limit(1)
      .get()?.id;
  }

  async changes(input: ProjectsInputs['files.changes']): Promise<ProjectsOutputs['files.changes']> {
    this.check('read');
    if (input.projectId !== this.project.id)
      throw new OperationError('permissionDenied', '修改查询不属于当前项目。');
    const location = this.files.location(input.fileId);
    const cursor = 'cursor' in input ? input.cursor : undefined;
    if (cursor && (cursor.projectId !== this.project.id || cursor.fileId !== input.fileId))
      throw new OperationError('invalidRequest', '修改游标不属于当前文件窗口。');
    const fileRows = sql`json_extract(${tables.edits.value}, '$.fileId') = ${input.fileId}`;
    const latest = this.db
      .select()
      .from(tables.edits)
      .where(fileRows)
      .orderBy(desc(tables.edits.seq))
      .limit(1)
      .get();
    const rowFor = (id: string) =>
      this.db
        .select()
        .from(tables.edits)
        .where(sql`${tables.edits.id} = ${id} AND ${fileRows}`)
        .get();
    const anchorId =
      cursor?.afterEditId ?? ('afterEditId' in input ? input.afterEditId : undefined);
    const anchor = anchorId ? rowFor(anchorId) : undefined;
    const through = cursor ? rowFor(cursor.throughEditId) : latest;
    const before = cursor ? rowFor(cursor.beforeEditId) : undefined;
    const anchorState =
      cursor?.anchor ?? (!anchorId ? 'notRequested' : anchor ? 'matched' : 'missing');
    const from = cursor
      ? rowFor(cursor.fromEditId)
      : through
        ? this.db
            .select()
            .from(tables.edits)
            .where(
              sql`${fileRows} AND ${tables.edits.seq} > ${anchor?.seq ?? 0} AND ${tables.edits.seq} <= ${through.seq}`,
            )
            .orderBy(tables.edits.seq)
            .limit(1)
            .get()
        : undefined;
    if (
      cursor &&
      ((!anchorId && anchorState !== 'notRequested') ||
        (anchorId && anchorState === 'notRequested'))
    )
      throw new OperationError('invalidRequest', '修改游标的锚点状态不符。');
    if (
      cursor &&
      (!through ||
        !before ||
        !from ||
        (anchorState === 'matched' && !anchor) ||
        (anchorState === 'missing' && anchor) ||
        before.seq > through.seq ||
        from.seq > before.seq ||
        (anchor && from.seq <= anchor.seq))
    )
      throw new OperationError('contentChanged', '修改查询窗口已失效，请重新读取。');
    const limit = input.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new OperationError('invalidRequest', '修改查询分页范围无效。');
    const rows =
      through && from
        ? this.db
            .select()
            .from(tables.edits)
            .where(
              sql`${fileRows} AND ${tables.edits.seq} <= ${through.seq} AND ${tables.edits.seq} >= ${from?.seq ?? 0} AND ${tables.edits.seq} < ${before?.seq ?? through.seq + 1}`,
            )
            .orderBy(desc(tables.edits.seq))
            .limit(limit + 1)
            .all()
        : [];
    const pageRows = rows.slice(0, limit);
    let current: ProjectsOutputs['files.changes']['coverage']['current'] = 'unavailable';
    if (location.state === 'present') {
      try {
        const actual = await this.files.readBytes(input.fileId, { limit: 1 });
        current =
          latest?.value.afterEvidence?.basis === actual.resourceBasis
            ? 'matchesLatest'
            : 'changedOrUnrecorded';
      } catch (error) {
        this.check('read');
        if ((error as { code?: string }).code === 'permissionDenied') throw error;
      }
    }
    this.check('read');
    const last = pageRows.at(-1);
    return {
      changes: pageRows.map(({ value }) => ({
        editId: value.id,
        fileId: input.fileId,
        createdAt: value.createdAt,
        ...(value.origin ? { origin: value.origin } : {}),
        ...(value.beforeEvidence ? { beforeEvidence: value.beforeEvidence } : {}),
        ...(value.afterEvidence ? { afterEvidence: value.afterEvidence } : {}),
        ...(value.revertsEditId ? { revertsEditId: value.revertsEditId } : {}),
      })),
      ...(rows.length > limit && through && from && last
        ? {
            nextCursor: {
              projectId: this.project.id,
              fileId: input.fileId,
              anchor: anchorState,
              fromEditId: from.id,
              throughEditId: through.id,
              beforeEditId: last.id,
              ...(anchorId ? { afterEditId: anchorId } : {}),
            },
          }
        : {}),
      coverage: {
        anchor: anchorState,
        retention: this.db
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, `file-history-pruned:${input.fileId}`))
          .get()
          ? 'pruned'
          : 'unknown',
        current,
      },
    };
  }

  evidenceContent(fileId: string, basis: string): { path: string; content: string } | undefined {
    this.check('read');
    this.files.location(fileId);
    const row = this.db
      .select()
      .from(tables.edits)
      .where(sql`
      json_extract(${tables.edits.value}, '$.fileId') = ${fileId} AND (
        json_extract(${tables.edits.value}, '$.beforeEvidence.basis') = ${basis} OR
        json_extract(${tables.edits.value}, '$.afterEvidence.basis') = ${basis})
    `)
      .limit(1)
      .get();
    if (!row) return undefined;
    return {
      path: row.value.path,
      content: row.value.afterEvidence?.basis === basis ? row.value.after : row.value.before,
    };
  }

  async undo(
    editId: string,
    origin?: FileEditOrigin,
    checkReceipt?: (edit: FileEdit) => void,
  ): Promise<FileEdit> {
    const undoOrigin = structuredClone(origin ?? { kind: 'unknown', reason: 'unattributed' });
    if (!isFileEditOrigin(undoOrigin)) throw new OperationError('invalidRequest', '撤销来源无效。');
    const row = this.db.select().from(tables.edits).where(eq(tables.edits.id, editId)).get();
    if (!row) throw new OperationError('notFound', '修改历史不存在。');
    checkReceipt?.(row.value);
    const currentPath = row.value.fileId ? this.files.currentPath(row.value.fileId) : row.path;
    if (!row.value.created)
      return this.save(
        currentPath,
        row.value.before,
        undefined,
        row.value.after,
        row.value.fileId,
        undefined,
        undefined,
        { origin: undoOrigin, revertsEditId: editId },
        row.value.basis,
        checkReceipt,
      );
    this.check('write');
    const target = await this.path(currentPath);
    return this.serial(target, async () => {
      this.check('write');
      if (
        row.value.fileId &&
        (this.files.currentPath(row.value.fileId) !== currentPath ||
          (await this.files.reference(currentPath)).fileId !== row.value.fileId)
      )
        throw new OperationError('contentChanged', '原文件位置已变化，请重新读取。');
      if ((await readFile(target, 'utf8')) !== row.value.after)
        throw new OperationError('contentChanged', '后续修改不能被撤销覆盖。');
      const actual = await lstat(target, { bigint: true });
      const beforeBasis = fileFingerprint(actual);
      if (row.value.basis && byteBasis(actual) !== row.value.basis)
        throw new OperationError('contentChanged', '原创建实体或版本已变化。');
      const retired = join(this.internal, 'reverted');
      checkReceipt?.({ ...row.value, path: currentPath, before: row.value.after, after: '' });
      await privateDirectory(retired);
      await rename(target, join(retired, row.value.id));
      const edit: FileEdit = {
        id: randomUUID(),
        path: currentPath,
        ...(row.value.fileId ? { fileId: row.value.fileId } : {}),
        before: row.value.after,
        after: '',
        createdAt: new Date().toISOString(),
        origin: undoOrigin,
        revertsEditId: editId,
        ...(row.value.fileId
          ? {
              beforeEvidence: {
                ref: { source: 'project', projectId: this.project.id, fileId: row.value.fileId },
                basis: beforeBasis,
              },
            }
          : {}),
      };
      try {
        this.db.transaction((tx) => {
          tx.insert(tables.edits).values({ id: edit.id, path: edit.path, value: edit }).run();
          if (row.value.fileId)
            tx.update(tables.fileReferences)
              .set({ value: { ...this.files.location(row.value.fileId), state: 'missing' } })
              .where(eq(tables.fileReferences.id, row.value.fileId))
              .run();
        });
      } catch {
        throw new OperationError('outcomeUnknown', '文件已移至撤销保留区，但历史登记结果未知。');
      }
      this.files.changed();
      return edit;
    });
  }

  touch(): void {
    this.dirty = true;
    this.changeVersion += 1;
  }

  linkArtifact(sessionId: string, artifact: Artifact): void {
    this.db
      .insert(tables.artifacts)
      .values({
        key: `${artifact.runId}:${artifact.fileId ?? artifact.path}`,
        sessionId,
        value: artifact,
      })
      .onConflictDoNothing()
      .run();
    this.touch();
  }

  artifacts(sessionId: string): Artifact[] {
    return this.db
      .select()
      .from(tables.artifacts)
      .where(eq(tables.artifacts.sessionId, sessionId))
      .limit(100)
      .all()
      .map((row) => row.value);
  }

  async backups(): Promise<ProjectBackup[]> {
    const directory = join(this.internal, 'backups');
    if (!(await exists(directory))) return [];
    const names = (await readdir(directory))
      .filter((name) => !name.startsWith('.'))
      .sort()
      .reverse()
      .slice(0, 10);
    return Promise.all(
      names.map(
        async (name) =>
          JSON.parse(
            await readFile(join(directory, name, '.scholoom', 'backup-manifest.json'), 'utf8'),
          ) as ProjectBackup,
      ),
    );
  }

  backup(): Promise<ProjectBackup> {
    if (this.backingUp) return this.backingUp;
    const run = this.makeBackup();
    this.backingUp = run;
    void run
      .finally(() => {
        this.backingUp = undefined;
      })
      .catch(() => {});
    return run;
  }

  private async makeBackup(): Promise<ProjectBackup> {
    const changeVersion = this.changeVersion;
    const fileStamp = await this.diskStamp();
    const backup: ProjectBackup = {
      id: `${Date.now()}-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      omitted: [],
    };
    const base = join(this.internal, 'backups');
    await privateDirectory(base);
    const temporary = join(base, `.${backup.id}`);
    await privateDirectory(temporary);
    await mkdir(join(temporary, '.scholoom'), { mode: 0o700 });
    await this.database.backup(join(temporary, '.scholoom', 'project.sqlite'));
    await copyFile(
      join(this.internal, 'identity.json'),
      join(temporary, '.scholoom', 'identity.json'),
    );
    // checkpoint is an execution aid; restored copies resume from durable project facts.
    backup.omitted.push(
      '.scholoom/transfers（在途文件传输暂存；恢复副本不接续原传输）',
      '.scholoom/candidates（未确认创建候选；恢复副本仅核查收据，不重放创建）',
      '.scholoom/checkpoints.sqlite（从持久材料安全接续）',
      '外部链接、非图片二进制、超过256KiB文本及超过1MiB图片；非声明私有内容',
    );
    let seen = 0;
    const walk = async (directory: string, output = temporary, retired = false): Promise<void> => {
      const omission = (path: string) =>
        backup.omitted.push(relative(this.project.path, path).split(sep).join('/'));
      try {
        const handle = await import('node:fs/promises').then((fs) => fs.opendir(directory));
        for await (const entry of handle) {
          if (++seen > 10000) {
            backup.omitted.push('超过 10000 项的剩余材料');
            if (retired) backup.omitted.push('.scholoom/trash/');
            break;
          }
          if (isPrivate(entry.name)) {
            if (retired) omission(join(directory, entry.name));
            continue;
          }
          const source = join(directory, entry.name);
          if (within(this.applicationDirectory, source)) {
            omission(source);
            continue;
          }
          const local = relative(
            retired ? join(this.internal, 'trash') : this.project.path,
            source,
          );
          if (entry.isSymbolicLink()) {
            omission(source);
            continue;
          }
          if (entry.isDirectory()) {
            await mkdir(join(output, local), { recursive: true });
            await walk(source, output, retired);
          } else if (entry.isFile()) {
            try {
              if ((await stat(source)).size > 1048576) {
                omission(source);
                continue;
              }
              const data = await readFile(source);
              if (
                !imageMime(data) &&
                (data.length > projectLimits.fileBytes ||
                  data.includes(0) ||
                  data.toString('utf8').includes('\uFFFD'))
              ) {
                omission(source);
                continue;
              }
              await writeFile(join(output, local), data, { mode: 0o600 });
            } catch {
              omission(source);
            }
          } else omission(source);
        }
      } catch {
        omission(directory);
      }
    };
    await walk(this.project.path);
    const trash = join(this.internal, 'trash');
    if (await exists(trash)) {
      await privateDirectory(trash);
      const output = join(temporary, '.scholoom', 'trash');
      await privateDirectory(output);
      await walk(trash, output, true);
    }
    await atomicPrivateFile(
      join(temporary, '.scholoom'),
      'backup-manifest.json',
      JSON.stringify(backup),
    );
    await rename(temporary, join(base, backup.id));
    if (this.changeVersion === changeVersion) this.dirty = false;
    this.fileStamp = fileStamp;
    const old = (await readdir(base))
      .filter((name) => !name.startsWith('.'))
      .sort()
      .reverse()
      .slice(10);
    for (const name of old) await rm(join(base, name), { recursive: true });
    return backup;
  }

  async autoBackup(): Promise<void> {
    if (!this.project.autoBackup || this.project.id === 'application') return;
    const stamp = await this.diskStamp();
    if (this.dirty || stamp !== this.fileStamp) await this.backup();
  }

  private async diskStamp(): Promise<string> {
    const stamps: string[] = [];
    const queue = [this.project.path];
    let scanned = 0;
    while (queue.length && scanned < 10000) {
      const directory = queue.shift() as string;
      const handle = await import('node:fs/promises').then((fs) => fs.opendir(directory));
      for await (const entry of handle) {
        if (++scanned > 10000) break;
        const path = join(directory, entry.name);
        if (
          isPrivate(entry.name) ||
          entry.isSymbolicLink() ||
          within(this.applicationDirectory, path)
        )
          continue;
        if (entry.isDirectory()) queue.push(path);
        else if (entry.isFile()) {
          const info = await stat(path);
          stamps.push(
            `${relative(this.project.path, path)}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`,
          );
        }
      }
    }
    return stamps.sort().join('\n');
  }

  async restore(id: string, destination: string): Promise<string> {
    if (!(await this.backups()).some((item) => item.id === id))
      throw new OperationError('notFound', '备份不存在。');
    const target = resolve(destination);
    if (within(this.project.path, target) || within(target, this.project.path))
      throw new OperationError('permissionDenied', '恢复目录必须独立于当前项目。');
    await mkdir(target, { mode: 0o700 });
    const source = join(this.internal, 'backups', id);
    const manifest = JSON.parse(
      await readFile(join(source, '.scholoom', 'backup-manifest.json'), 'utf8'),
    ) as ProjectBackup;
    const { cp } = await import('node:fs/promises');
    // The destination root is exclusively reserved above; copy only its missing children.
    for (const name of await readdir(source))
      await cp(join(source, name), join(target, name), {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: (path) => path !== join(source, '.scholoom', 'backup-manifest.json'),
      });
    // A restored copy has independent identity so its facts cannot shadow the original.
    const restoredId = randomUUID();
    await atomicPrivateFile(
      join(target, '.scholoom'),
      'identity.json',
      JSON.stringify({ id: restoredId }),
    );
    const copy = await ProjectStore.open(
      target,
      this.applicationDirectory,
      this.initializeContainer,
    );
    try {
      copy.db.delete(tables.meta).where(sql`${tables.meta.key} LIKE 'file-transfer:%'`).run();
      for (const omitted of manifest.omitted) {
        const normalized = omitted.replaceAll('\\', '/');
        if (normalized === '.scholoom/trash/' || normalized === '.scholoom/trash') {
          for (const operation of copy.db.select().from(tables.fileOperations).all()) {
            if (operation.value.kind === 'trash')
              copy.db
                .insert(tables.meta)
                .values({ key: `incomplete-trash:${operation.id}`, value: omitted })
                .onConflictDoNothing()
                .run();
          }
        }
        const match = /^\.scholoom\/trash\/([^/]+)(?:\/|$)/.exec(normalized);
        if (match)
          copy.db
            .insert(tables.meta)
            .values({ key: `incomplete-trash:${match[1]}`, value: omitted })
            .onConflictDoNothing()
            .run();
      }
      for (const operation of copy.db.select().from(tables.fileOperations).all()) {
        const rebase = (path: string) =>
          within(this.project.path, path) ? join(target, relative(this.project.path, path)) : path;
        copy.db
          .update(tables.fileOperations)
          .set({
            details: {
              ...operation.details,
              source: rebase(operation.details.source),
              destination: rebase(operation.details.destination),
            },
          })
          .where(eq(tables.fileOperations.id, operation.id))
          .run();
      }
      copy.grant({ trust: 'pending', autoBackup: true });
    } finally {
      await copy.close();
    }
    return target;
  }

  async close(): Promise<void> {
    await this.files.settle();
    if (this.backingUp) await this.backingUp.catch(() => {});
    this.database.close();
  }
}

export class Projects {
  /** Host-bound identity follows asynchronous file operations and their final checks. */
  withAccess<T>(
    context: Pick<CallContext, 'role' | 'principal' | 'projectId'>,
    action: () => T,
    authorize?: () => void,
  ): T {
    const parent = accessScope.getStore();
    const agent = context.role === 'execution' || context.principal.kind === 'agent';
    return accessScope.run(
      {
        agent: agent || parent?.agent === true,
        projectId: parent?.agent ? parent.projectId : agent ? context.projectId : undefined,
        ...(parent?.targetProjectId ? { targetProjectId: parent.targetProjectId } : {}),
        ...(parent?.authorize || authorize
          ? {
              authorize: () => {
                parent?.authorize?.();
                authorize?.();
              },
            }
          : {}),
      },
      action,
    );
  }

  /** Host supplies live execution checks; a nested scope can only keep its original target. */
  withTargetRead<T>(
    context: Pick<CallContext, 'role' | 'principal' | 'projectId'>,
    targetProjectId: string,
    authorize: () => void,
    action: () => T,
  ): T {
    return this.withAccess(context, () => {
      const parent = accessScope.getStore();
      if (
        !parent?.projectId ||
        parent.projectId !== context.projectId ||
        targetProjectId === 'application' ||
        (parent.targetProjectId && parent.targetProjectId !== targetProjectId)
      )
        throw new OperationError('permissionDenied', '不能扩大目标只读访问范围。');
      parent.authorize?.();
      authorize();
      return accessScope.run(
        {
          ...parent,
          targetProjectId,
          authorize: () => {
            parent.authorize?.();
            authorize();
          },
        },
        action,
      );
    });
  }
  private stores = new Map<string, ProjectStore>();
  private recent = new Set<string>();
  private registryWrite: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(
    readonly directory: string,
    private readonly initializeContainer: ContainerInitializer,
    private readonly replacing: (projectId: string) => Promise<void> = async () => {},
  ) {}

  async initialize(): Promise<void> {
    await privateDirectory(this.directory);
    const application = join(this.directory, 'application');
    await privateDirectory(application);
    const store = await ProjectStore.open(
      application,
      this.directory,
      this.initializeContainer,
      true,
    );
    this.stores.set(store.project.id, store);
    let registry: string[] = [];
    try {
      registry = JSON.parse(await readFile(join(this.directory, 'projects.json'), 'utf8'));
    } catch {}
    for (const path of registry.slice(0, 100)) {
      try {
        await this.open(path, false);
      } catch {
        /* Unavailable projects remain on disk for explicit reopening. */
      }
    }
    this.timer = setInterval(() => {
      for (const item of this.stores.values())
        void item.autoBackup().catch(() => {
          console.error(
            JSON.stringify({
              event: 'project.backup.failed',
              projectId: item.project.id,
              code: 'unavailable',
            }),
          );
        });
    }, 300000);
    this.timer.unref();
  }

  async open(path: string, persist = true): Promise<ProjectStore> {
    const canonical = await realpath(path);
    const existing = [...this.stores.values()].find((store) => store.project.path === canonical);
    if (existing) {
      if (persist) {
        this.recent.add(existing.project.id);
        await this.persist();
      }
      return existing;
    }
    const store = await ProjectStore.open(canonical, this.directory, this.initializeContainer);
    const prior = this.stores.get(store.project.id);
    if (prior && (await exists(prior.project.path))) {
      await store.close();
      throw new OperationError(
        'targetAmbiguous',
        '另一个可达目录具有同一项目身份；请使用独立恢复副本。',
      );
    }
    if (prior) {
      try {
        await this.replacing(store.project.id);
        await prior.close();
      } catch (error) {
        await store.close();
        throw error;
      }
    }
    this.stores.set(store.project.id, store);
    this.recent.add(store.project.id);
    if (persist) await this.persist();
    return store;
  }

  private persist(): Promise<unknown> {
    const run = this.registryWrite
      .catch(() => {})
      .then(() =>
        atomicPrivateFile(
          this.directory,
          'projects.json',
          JSON.stringify(
            this.list()
              .filter((p) => p.id !== 'application' && this.recent.has(p.id))
              .map((p) => p.path),
          ),
        ),
      );
    this.registryWrite = run;
    return run;
  }

  async create(path: string): Promise<ProjectStore> {
    const target = resolve(path);
    const parent = await realpath(dirname(target));
    const applicationDirectory = await realpath(this.directory);
    if (within(applicationDirectory, join(parent, basename(target))))
      throw new OperationError('permissionDenied', '不能在应用配置目录创建项目。');
    await mkdir(join(parent, basename(target)));
    return this.open(target);
  }
  async forget(id: string): Promise<void> {
    if (id === 'application') throw new OperationError('invalidRequest', '普通会话不能移出。');
    this.get(id);
    this.recent.delete(id);
    await this.persist();
  }

  list(): Project[] {
    return [...this.stores.values()].map((store) => ({
      ...store.project,
      recent: store.project.id === 'application' || this.recent.has(store.project.id),
    }));
  }
  get(id: string): ProjectStore {
    const store = this.stores.get(id);
    if (!store) throw new OperationError('notFound', '项目未打开。');
    return store;
  }
  all(): ProjectStore[] {
    return [...this.stores.values()];
  }
  async close(): Promise<void> {
    clearInterval(this.timer);
    await Promise.all([...this.stores.values()].map((store) => store.close()));
  }
}
