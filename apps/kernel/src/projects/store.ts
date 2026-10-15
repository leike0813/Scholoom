import { randomUUID } from 'node:crypto';
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
import { fileURLToPath } from 'node:url';
import {
  businessLimits,
  type FileContent,
  type FileEdit,
  type FileEntry,
  type Project,
  type ProjectBackup,
} from '@scholoom/protocol';
import Database from 'better-sqlite3';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { OperationError } from '../errors.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';
import * as tables from '../storage/schema.js';

const hidden = new Set(['.scholoom', '.git', 'node_modules', 'dist', 'build', 'target', '.venv']);
const isPrivate = (name: string) =>
  hidden.has(name) ||
  name === '.env' ||
  name.startsWith('.env.') ||
  /\.(?:pem|key|crt)$/i.test(name);
const within = (root: string, path: string) => {
  const part = relative(root, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
};
const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
const migrationsFolder = fileURLToPath(new URL('../storage/migrations/', import.meta.url));

export class ProjectStore {
  readonly database: Database.Database;
  readonly db;
  readonly internal: string;
  private bases = new Map<string, { path: string; content: string }>();
  private queues = new Map<string, Promise<unknown>>();
  private dirty = false;
  private changeVersion = 0;
  private fileStamp = '';
  private backingUp: Promise<ProjectBackup> | undefined;

  private constructor(
    readonly project: Project,
    database: Database.Database,
    private readonly applicationDirectory: string,
  ) {
    this.database = database;
    this.db = drizzle(database, { schema: tables });
    this.internal = join(project.path, '.scholoom');
  }

  static async open(
    path: string,
    applicationDirectory: string,
    application = false,
  ): Promise<ProjectStore> {
    const root = await realpath(path);
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
      if ((database.pragma('user_version', { simple: true }) as number) > 1)
        throw new Error('Newer database');
      if (database.pragma('user_version', { simple: true }) === 0) {
        if (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length)
          await database.backup(join(internal, 'before-migration.sqlite'));
        migrate(drizzle(database), { migrationsFolder });
        database.pragma('user_version = 1');
      }
      const project: Project = {
        id: identity.id,
        path: root,
        name: application ? '普通会话' : basename(root),
        read: application,
        write: false,
        send: application,
        autoBackup: !application,
      };
      const store = new ProjectStore(project, database, applicationDirectory);
      const grants = store.db.select().from(tables.meta).where(eq(tables.meta.key, 'grants')).get();
      if (grants) Object.assign(project, JSON.parse(grants.value));
      return store;
    } catch {
      database.close();
      throw new OperationError('unavailable', '项目数据库损坏或版本不兼容；停止写入并保留现场。');
    }
  }

  grant(values: Pick<Project, 'read' | 'write' | 'send' | 'autoBackup'>): Project {
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
    if (!this.project[operation])
      throw new OperationError('permissionDenied', `项目尚未授权 ${operation}。`);
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
  ): Promise<{ entries: FileEntry[]; nextOffset?: number }> {
    this.check('read');
    const directory = await this.path(input);
    const entries: FileEntry[] = [];
    let skipped = 0;
    const handle = await import('node:fs/promises').then((fs) => fs.opendir(directory));
    for await (const entry of handle) {
      if (
        isPrivate(entry.name) ||
        entry.isSymbolicLink() ||
        (!entry.isFile() && !entry.isDirectory())
      )
        continue;
      if (skipped++ < offset) continue;
      if (entries.length === limit) return { entries, nextOffset: offset + limit };
      entries.push({
        name: entry.name,
        kind: entry.isDirectory() ? 'dir' : 'file',
        path: relative(this.project.path, join(directory, entry.name)).split(sep).join('/'),
      });
    }
    return { entries };
  }

  async read(input: string, offset = 0): Promise<FileContent> {
    this.check('read');
    const path = await this.path(input);
    const handle = await open(path, 'r');
    let value: string;
    let truncated: boolean;
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new OperationError('targetAmbiguous', '目标不是普通文件。');
      const buffer = Buffer.alloc(
        Math.min(businessLimits.fileBytes + 1, Math.max(0, info.size - offset)),
      );
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      truncated = info.size > offset + businessLimits.fileBytes || offset > 0;
      try {
        value = new TextDecoder('utf-8', { fatal: true }).decode(
          buffer.subarray(0, Math.min(bytesRead, businessLimits.fileBytes)),
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
    return { path: input, content: value, basis, truncated };
  }

  private serial<T>(path: string, run: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(path) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(run);
    this.queues.set(path, current);
    void current
      .finally(() => {
        if (this.queues.get(path) === current) this.queues.delete(path);
      })
      .catch(() => {});
    return current;
  }

  async save(input: string, content: string, basis?: string, expected?: string): Promise<FileEdit> {
    this.check('write');
    if (Buffer.byteLength(content) > businessLimits.fileBytes)
      throw new OperationError('tooLarge', '文件超过本期编辑上限。');
    const target = await this.path(input, true);
    return this.serial(target, async () => {
      this.check('write');
      if ((await this.path(input, true)) !== target)
        throw new OperationError('contentChanged', '目标路径已变化。');
      const create = basis === undefined && expected === undefined;
      let before = '';
      let mode = 0o600;
      if (!create) {
        const source = basis ? this.bases.get(basis) : undefined;
        if (expected === undefined && (!source || source.path !== target))
          throw new OperationError('contentChanged', '读取依据失效，请重新读取。');
        const handle = await open(target, 'r');
        try {
          const info = await handle.stat();
          mode = info.mode & 0o777;
          if (info.size > businessLimits.fileBytes)
            throw new OperationError('contentChanged', '文件已变化，请重新读取。');
          before = await handle.readFile('utf8');
        } finally {
          await handle.close();
        }
        if (before !== (expected ?? source?.content))
          throw new OperationError('contentChanged', '整份文件内容已变化，请重新读取后修改。');
      } else if (await exists(target))
        throw new OperationError('contentChanged', '新建目标已存在，不能覆盖。');
      const edit: FileEdit = {
        id: randomUUID(),
        path: input,
        before,
        after: content,
        createdAt: new Date().toISOString(),
        created: create,
      };
      const candidateDir = join(this.internal, 'candidates');
      await privateDirectory(candidateDir);
      const candidate = join(candidateDir, edit.id);
      await writeFile(candidate, content, { mode: 0o600, flag: 'wx' });
      const temporary = join(dirname(target), `.scholoom-${edit.id}.tmp`);
      try {
        const handle = await open(temporary, 'wx', mode);
        try {
          await handle.chmod(mode);
          await handle.writeFile(content);
          await handle.sync();
        } finally {
          await handle.close();
        }
        if (create) {
          await link(temporary, target);
          await unlink(temporary);
        } else await rename(temporary, target);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        if ((await exists(target)) && (await readFile(target, 'utf8')) === content)
          throw new OperationError(
            'outcomeUnknown',
            '文件可能已保存；请核查实际内容，候选已保留。',
          );
        throw error;
      }
      try {
        this.db.transaction((tx) => {
          tx.insert(tables.edits).values({ id: edit.id, path: input, value: edit }).run();
          const old = tx
            .select({ seq: tables.edits.seq })
            .from(tables.edits)
            .where(eq(tables.edits.path, input))
            .orderBy(desc(tables.edits.seq))
            .limit(100)
            .offset(businessLimits.history)
            .all();
          for (const row of old) tx.delete(tables.edits).where(eq(tables.edits.seq, row.seq)).run();
        });
      } catch {
        throw new OperationError('outcomeUnknown', '文件已保存，但历史登记结果未知；请核查。');
      }
      this.dirty = true;
      await unlink(candidate).catch(() => {});
      return edit;
    });
  }

  history(path: string): FileEdit[] {
    this.check('read');
    return this.db
      .select()
      .from(tables.edits)
      .where(eq(tables.edits.path, path))
      .orderBy(desc(tables.edits.seq))
      .limit(businessLimits.history)
      .all()
      .map((row) => row.value);
  }

  async undo(editId: string): Promise<FileEdit> {
    const row = this.db.select().from(tables.edits).where(eq(tables.edits.id, editId)).get();
    if (!row) throw new OperationError('notFound', '修改历史不存在。');
    if (!row.value.created)
      return this.save(row.path, row.value.before, undefined, row.value.after);
    this.check('write');
    const target = await this.path(row.path);
    return this.serial(target, async () => {
      this.check('write');
      if ((await readFile(target, 'utf8')) !== row.value.after)
        throw new OperationError('contentChanged', '后续修改不能被撤销覆盖。');
      const retired = join(this.internal, 'reverted');
      await privateDirectory(retired);
      await rename(target, join(retired, row.value.id));
      const edit: FileEdit = {
        id: randomUUID(),
        path: row.path,
        before: row.value.after,
        after: '',
        createdAt: new Date().toISOString(),
      };
      this.db.insert(tables.edits).values({ id: edit.id, path: edit.path, value: edit }).run();
      this.touch();
      return edit;
    });
  }

  touch(): void {
    this.dirty = true;
    this.changeVersion += 1;
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
      '.scholoom/checkpoints.sqlite（从持久材料安全接续）',
      '私有目录、外部链接、二进制及超过 256 KiB 的文件',
    );
    let seen = 0;
    const walk = async (directory: string): Promise<void> => {
      const handle = await import('node:fs/promises').then((fs) => fs.opendir(directory));
      for await (const entry of handle) {
        if (++seen > 10000) {
          backup.omitted.push('超过 10000 项的剩余材料');
          break;
        }
        if (isPrivate(entry.name)) continue;
        const source = join(directory, entry.name);
        if (within(this.applicationDirectory, source)) {
          backup.omitted.push(relative(this.project.path, source));
          continue;
        }
        const local = relative(this.project.path, source);
        if (entry.isSymbolicLink()) {
          backup.omitted.push(local);
          continue;
        }
        if (entry.isDirectory()) {
          await mkdir(join(temporary, local), { recursive: true });
          await walk(source);
        } else if (entry.isFile()) {
          try {
            if ((await stat(source)).size > businessLimits.fileBytes) {
              backup.omitted.push(local);
              continue;
            }
            const data = await readFile(source);
            if (data.includes(0) || data.toString('utf8').includes('\uFFFD')) {
              backup.omitted.push(local);
              continue;
            }
            await writeFile(join(temporary, local), data, { mode: 0o600 });
          } catch {
            backup.omitted.push(local);
          }
        }
      }
    };
    await walk(this.project.path);
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
    const { cp } = await import('node:fs/promises');
    await cp(source, target, {
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
    const copy = await ProjectStore.open(target, this.applicationDirectory);
    try {
      copy.grant({ read: false, write: false, send: false, autoBackup: true });
      for (const row of copy.db.select().from(tables.sessions).all()) {
        copy.db
          .update(tables.sessions)
          .set({
            value: {
              ...row.value,
              projectId: restoredId,
              state: ['running', 'queued', 'cancelling'].includes(row.value.state)
                ? 'interrupted'
                : row.value.state,
            },
          })
          .where(eq(tables.sessions.id, row.id))
          .run();
      }
      for (const row of copy.db.select().from(tables.runs).all()) {
        if (['running', 'queued', 'cancelling'].includes(row.value.state))
          copy.db
            .update(tables.runs)
            .set({ value: { ...row.value, state: 'interrupted', remoteOutcome: 'unknown' } })
            .where(eq(tables.runs.id, row.id))
            .run();
      }
    } finally {
      await copy.close();
    }
    return target;
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.queues.values()]);
    if (this.backingUp) await this.backingUp.catch(() => {});
    this.database.close();
  }
}

export class Projects {
  private stores = new Map<string, ProjectStore>();
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(readonly directory: string) {}

  async initialize(): Promise<void> {
    await privateDirectory(this.directory);
    const application = join(this.directory, 'application');
    await privateDirectory(application);
    const store = await ProjectStore.open(application, this.directory, true);
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
    if (existing) return existing;
    const store = await ProjectStore.open(canonical, this.directory);
    const prior = this.stores.get(store.project.id);
    if (prior && (await exists(prior.project.path))) {
      await store.close();
      throw new OperationError(
        'targetAmbiguous',
        '另一个可达目录具有同一项目身份；请使用独立恢复副本。',
      );
    }
    if (prior) await prior.close();
    this.stores.set(store.project.id, store);
    if (persist)
      await atomicPrivateFile(
        this.directory,
        'projects.json',
        JSON.stringify(
          this.list()
            .filter((p) => p.id !== 'application')
            .map((p) => p.path),
        ),
      );
    return store;
  }

  list(): Project[] {
    return [...this.stores.values()].map((store) => store.project);
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
