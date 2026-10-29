import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, lstat, mkdir, open, opendir, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type IsolationStageInput,
  type IsolationStatus,
  isolationOperations,
  validateIsolationStage,
} from '@scholoom/protocol/isolation';

export type IsolationScope = {
  bootId: string;
  invocationId: string;
  cgroup: string;
  dev: string;
  ino: string;
  controllerPid: number;
  controllerBirth: string;
};
export type IsolationReceipt = {
  version: 1;
  configId: string;
  storageId: string;
  stage: IsolationStageInput;
  status: IsolationStatus;
  offsets: number[];
  stamps: string[];
  sealed?: { program: string; gate: string };
  unit: string;
  programVersion: string;
  policyVersion: string;
  launchIntent: boolean;
  scopeIntent: boolean;
  scope?: IsolationScope;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const recordBytes = 1024 * 1024;
function encoded(value: unknown): string {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, 'utf8') > recordBytes)
    throw new OperationError('resourceLimit', '隔离执行记录字节预算已满，保留原可恢复记录。');
  return text;
}
const validStatus = compileContract(isolationOperations['platform.reportIsolation.get']).result;
const unavailable = () =>
  new OperationError('unavailable', '隔离执行记录身份或持久化状态不可核查。');
// Node opens descriptors with close-on-exec; the native adapter independently closes its allowlist.
const flags = constants.O_RDONLY | constants.O_NOFOLLOW;

/** Directory handles pin all private writes; on-disk identities are never rebound on recovery. */
export class IsolationRecords {
  static readonly maxInstances = 4096;
  private root!: FileHandle;
  private rootIdentity = '';
  private configId = '';
  private index: { instanceId: string; storageId: string }[] = [];
  private readonly directories = new Map<string, FileHandle>();
  private writes: Promise<void> = Promise.resolve();
  readonly path: string;
  constructor(path: string) {
    this.path = resolve(path);
  }

  async initialize(): Promise<void> {
    await mkdir(this.path, { recursive: true, mode: 0o700 });
    await this.initializeExisting();
  }
  async initializeExisting(): Promise<void> {
    const root = await open(this.path, flags | constants.O_DIRECTORY);
    try {
      const info = await root.stat({ bigint: true });
      if (info.uid !== BigInt(process.getuid?.() ?? -1) || info.mode & 0o077n) throw unavailable();
      this.rootIdentity = `${info.dev}:${info.ino}`;
      this.root = root;
    } catch (error) {
      await root.close();
      throw error;
    }
  }
  /** Called only while the native flock holder is alive. */
  async load(): Promise<IsolationReceipt[]> {
    return this.serialize(async () => {
      try {
        this.configId = await this.readConfig();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await this.provision();
      }
      return this.readInventory();
    });
  }
  /** Caller must hold the original native writer lock until close. Never provisions on failure. */
  async loadExisting(expectedConfigId: string): Promise<{
    configId: string;
    receipts: IsolationReceipt[];
  }> {
    return this.serialize(async () => {
      await this.check();
      const configId = await this.readConfig();
      if (configId !== expectedConfigId) throw unavailable();
      this.configId = configId;
      const receipts = await this.readInventory();
      await this.check();
      return { configId, receipts };
    });
  }
  /** Caller must hold the original native writer lock until close. Only accepts an empty root. */
  async provisionEmpty(): Promise<{ configId: string; receipts: IsolationReceipt[] }> {
    return this.serialize(async () => {
      await this.check();
      await this.provision();
      const receipts = await this.readInventory();
      await this.check();
      return { configId: this.configId, receipts };
    });
  }
  private async readConfig(): Promise<string> {
    const value = (await this.read(this.base, 'config.json')) as {
      version: number;
      configId: string;
      identity: string;
    };
    if (value.version !== 1 || !uuid.test(value.configId) || value.identity !== this.rootIdentity)
      throw unavailable();
    return value.configId;
  }
  private async provision(): Promise<void> {
    // An identity loss is not a new config. Never erase its recovery inventory.
    for await (const entry of await opendir(this.base))
      if (entry.name !== 'writer.lock') throw unavailable();
    const lock = await lstat(join(this.base, 'writer.lock'));
    if (!lock.isFile() || lock.nlink !== 1 || lock.uid !== process.getuid?.()) throw unavailable();
    this.configId = randomUUID();
    await this.atomic(this.root, 'config.json', {
      version: 1,
      configId: this.configId,
      identity: this.rootIdentity,
    });
    await this.atomic(this.root, 'index.json', []);
  }
  private async readInventory(): Promise<IsolationReceipt[]> {
    const index = await this.read(this.base, 'index.json');
    if (!Array.isArray(index) || index.length > IsolationRecords.maxInstances) throw unavailable();
    const seen = new Set<string>();
    for (const entry of index) {
      if (
        !entry ||
        typeof entry.instanceId !== 'string' ||
        !entry.instanceId ||
        !uuid.test(entry.storageId) ||
        seen.has(entry.instanceId) ||
        seen.has(entry.storageId)
      )
        throw unavailable();
      seen.add(entry.instanceId);
      seen.add(entry.storageId);
    }
    const remaining = new Map<string, 'file' | 'directory'>([
      ['config.json', 'file'],
      ['index.json', 'file'],
      ['writer.lock', 'file'],
      ...index.map(({ storageId }): [string, 'directory'] => [storageId, 'directory']),
    ]);
    try {
      let count = 0;
      for await (const entry of await opendir(this.base)) {
        const kind = remaining.get(entry.name);
        if (
          ++count > IsolationRecords.maxInstances + 3 ||
          !kind ||
          (kind === 'directory' ? !entry.isDirectory() : !entry.isFile())
        )
          throw unavailable();
        remaining.delete(entry.name);
      }
      if (remaining.size) throw unavailable();
    } catch {
      throw unavailable();
    }
    this.index = index;
    const records: IsolationReceipt[] = [];
    for (const entry of this.index) {
      const directory = await this.directory(entry.storageId);
      const value = (await this.read(
        this.directoryPath(directory),
        'receipt.json',
      )) as IsolationReceipt;
      if (
        value.version !== 1 ||
        value.configId !== this.configId ||
        value.storageId !== entry.storageId ||
        !validateIsolationStage(value.stage) ||
        value.stage.instanceId !== entry.instanceId ||
        !validStatus(value.status) ||
        value.status.instanceId !== entry.instanceId ||
        !Array.isArray(value.offsets) ||
        value.offsets.length !== value.stage.assets.length ||
        !value.offsets.every(
          (n, i) =>
            Number.isSafeInteger(n) && n >= 0 && n <= (value.stage.assets[i]?.byteLength ?? -1),
        ) ||
        !Array.isArray(value.stamps) ||
        value.stamps.length !== value.stage.assets.length ||
        !value.stamps.every(
          (s) => typeof s === 'string' && (s === '' || /^\d+:\d+:\d+:\d+:\d+$/.test(s)),
        ) ||
        (value.scopeIntent &&
          (!value.sealed ||
            !/^\d+:\d+:\d+:\d+:\d+$/.test(value.sealed.program) ||
            !/^\d+:\d+:\d+:\d+:\d+$/.test(value.sealed.gate) ||
            value.stamps.some((s) => !s))) ||
        typeof value.scopeIntent !== 'boolean' ||
        typeof value.launchIntent !== 'boolean' ||
        !/^scholoom-report-[a-f0-9-]{36}\.scope$/.test(value.unit) ||
        typeof value.policyVersion !== 'string' ||
        typeof value.programVersion !== 'string'
      )
        throw unavailable();
      if (value.scope) {
        const s = value.scope;
        if (
          !uuid.test(s.bootId) ||
          !/^[a-f0-9]{32}$/.test(s.invocationId) ||
          !s.cgroup.startsWith('/user.slice/') ||
          s.cgroup.includes('..') ||
          !s.cgroup.endsWith(`/${value.unit}`) ||
          !/^\d+$/.test(s.dev) ||
          !/^\d+$/.test(s.ino) ||
          !Number.isSafeInteger(s.controllerPid) ||
          s.controllerPid <= 1 ||
          !/^\d+$/.test(s.controllerBirth)
        )
          throw unavailable();
      }
      records.push(value);
    }
    return records;
  }
  get lockPath(): string {
    return join(this.path, 'writer.lock');
  }
  private get base(): string {
    return `/proc/self/fd/${this.root.fd}`;
  }
  private directoryPath(handle: FileHandle): string {
    return `/proc/self/fd/${handle.fd}`;
  }
  async check(): Promise<void> {
    const info = await lstat(this.path, { bigint: true });
    if (
      !info.isDirectory() ||
      `${info.dev}:${info.ino}` !== this.rootIdentity ||
      info.uid !== BigInt(process.getuid?.() ?? -1) ||
      info.mode & 0o077n
    )
      throw unavailable();
    for (const [id, handle] of this.directories) {
      const current = await lstat(join(this.base, id), { bigint: true });
      const held = await handle.stat({ bigint: true });
      if (!current.isDirectory() || current.dev !== held.dev || current.ino !== held.ino)
        throw unavailable();
    }
  }
  private async read(directory: string, name: string): Promise<unknown> {
    const handle = await open(join(directory, name), flags);
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.nlink !== 1 ||
        info.size > recordBytes ||
        info.uid !== process.getuid?.() ||
        info.mode & 0o077
      )
        throw unavailable();
      return JSON.parse(await handle.readFile('utf8'));
    } finally {
      await handle.close();
    }
  }
  private async directory(id: string): Promise<FileHandle> {
    const found = this.directories.get(id);
    if (found) return found;
    if (!uuid.test(id)) throw unavailable();
    const handle = await open(join(this.base, id), flags | constants.O_DIRECTORY);
    const info = await handle.stat();
    if (info.uid !== process.getuid?.() || info.mode & 0o077) {
      await handle.close();
      throw unavailable();
    }
    this.directories.set(id, handle);
    return handle;
  }
  private async atomic(directory: FileHandle, name: string, value: unknown): Promise<void> {
    const payload = encoded(value);
    await this.check();
    const base = this.directoryPath(directory),
      temp = `.${randomUUID()}.tmp`;
    const file = await open(
      join(base, temp),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(payload);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(join(base, temp), join(base, name));
    await directory.sync();
    await this.check();
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.writes.then(work);
    this.writes = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  create(
    stage: IsolationStageInput,
    programVersion: string,
    policyVersion: string,
  ): Promise<IsolationReceipt> {
    return this.serialize(async () => {
      if (this.index.some((e) => e.instanceId === stage.instanceId))
        throw new OperationError('invalidRequest', '隔离执行身份已存在。');
      if (this.index.length >= IsolationRecords.maxInstances)
        throw new OperationError('resourceLimit', '私有执行记录索引达到上限。');
      const storageId = randomUUID();
      const next = [...this.index, { instanceId: stage.instanceId, storageId }];
      encoded(next);
      await mkdir(join(this.base, storageId), { mode: 0o700 });
      await this.root.sync();
      const receipt: IsolationReceipt = {
        version: 1,
        configId: this.configId,
        storageId,
        stage: structuredClone(stage),
        status: {
          instanceId: stage.instanceId,
          phase: 'queued',
          gateReleased: false,
          stopConfirmed: false,
        },
        offsets: stage.assets.map(() => 0),
        stamps: stage.assets.map(() => ''),
        unit: `scholoom-report-${randomUUID()}.scope`,
        programVersion,
        policyVersion,
        scopeIntent: false,
        launchIntent: false,
      };
      await this.atomic(await this.directory(storageId), 'receipt.json', receipt);
      await this.atomic(this.root, 'index.json', next);
      this.index = next;
      return receipt;
    });
  }
  save(receipt: IsolationReceipt): Promise<void> {
    const snapshot = structuredClone(receipt);
    return this.serialize(async () =>
      this.atomic(await this.directory(snapshot.storageId), 'receipt.json', snapshot),
    );
  }
  async files(receipt: IsolationReceipt): Promise<string> {
    await this.check();
    return this.directoryPath(await this.directory(receipt.storageId));
  }
  nativePath(receipt: IsolationReceipt): string {
    return join(this.path, receipt.storageId);
  }
  async close(): Promise<void> {
    await this.writes;
    await Promise.all([...this.directories.values()].map((h) => h.close()));
    this.directories.clear();
    await this.root?.close();
  }
}
