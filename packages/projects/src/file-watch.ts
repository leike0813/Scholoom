import { randomUUID } from 'node:crypto';
import { type FSWatcher, watch as watchDirectory } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import { isPrivate, type ProjectStore } from './store.js';

type Subscription = { directory: string; names: Map<string, string> };
type ProjectWatch = { store: ProjectStore; subscriptions: Map<string, Subscription> };
type DirectoryWatch = {
  watcher: FSWatcher;
  owners: Map<string, Set<string>>;
  pending: Set<string>;
  overflow: boolean;
  timer: NodeJS.Timeout | undefined;
};

const MAX_WATCHES = 128;
const MAX_PATHS = 100;
const DEBOUNCE_MS = 50;

export class ProjectFileWatches {
  private readonly ids = new Map<string, ProjectWatch>();
  private readonly directories = new Map<string, DirectoryWatch>();
  private readonly permissionTimer: NodeJS.Timeout;

  constructor(
    private readonly getProject: (id: string) => ProjectStore,
    private readonly onChange: (projectId: string, paths: string[]) => void,
  ) {
    this.permissionTimer = setInterval(() => this.checkPermissions(), 100);
    this.permissionTimer.unref();
  }

  async watch(projectId: string, paths: string[]): Promise<{ watchId: string }> {
    const store = this.getProject(projectId);
    store.check('read');
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS)
      throw new OperationError('resourceLimit', '监听路径数量必须在 1 到 100 之间。');
    if (this.ids.size >= MAX_WATCHES)
      throw new OperationError('resourceLimit', '文件监听数量已达上限。');

    const prepared: { directory: string; name: string; path: string }[] = [];
    for (const input of new Set(paths)) {
      const absolute = await store.path(input);
      const requested = resolve(store.project.path, input.replaceAll('\\', '/'));
      if (requested !== absolute)
        throw new OperationError('permissionDenied', '监听路径包含符号链接或非规范路径。');
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory()))
        throw new OperationError('permissionDenied', '仅支持普通文件或目录监听。');
      const path = relative(store.project.path, absolute).split(sep).join('/');
      prepared.push(
        metadata.isDirectory()
          ? { directory: absolute, name: '*', path }
          : { directory: dirname(absolute), name: basename(absolute), path },
      );
    }

    const watchId = randomUUID();
    const entry: ProjectWatch = { store, subscriptions: new Map() };
    this.ids.set(watchId, entry);
    try {
      for (const item of prepared) {
        const subscription = entry.subscriptions.get(item.directory) ?? {
          directory: item.directory,
          names: new Map(),
        };
        subscription.names.set(item.name, item.path);
        entry.subscriptions.set(item.directory, subscription);
        this.acquire(item.directory, projectId, watchId);
      }
      store.check('read');
      return { watchId };
    } catch (error) {
      this.unwatch(projectId, watchId);
      throw error;
    }
  }

  unwatch(projectId: string, watchId: string): { ok: true } {
    const entry = this.ids.get(watchId);
    if (entry?.store.project.id === projectId) {
      this.ids.delete(watchId);
      for (const directory of entry.subscriptions.keys())
        this.release(directory, projectId, watchId);
    }
    return { ok: true };
  }

  close(): void {
    clearInterval(this.permissionTimer);
    for (const [watchId, entry] of this.ids) this.unwatch(entry.store.project.id, watchId);
  }

  private acquire(directory: string, projectId: string, watchId: string): void {
    let entry = this.directories.get(directory);
    if (!entry) {
      const watcher = watchDirectory(directory, (event, filename) => {
        if (event !== 'change' && event !== 'rename') return;
        this.handleChange(directory, filename?.toString());
      });
      entry = { watcher, owners: new Map(), pending: new Set(), overflow: false, timer: undefined };
      this.directories.set(directory, entry);
      watcher.on('error', (error) => {
        process.emitWarning(`Project file watch failed for ${directory}: ${error.message}`);
        const affected = [...(this.directories.get(directory)?.owners ?? [])].flatMap(
          ([ownerProject, ids]) => [...ids].map((id) => [ownerProject, id] as const),
        );
        this.dropDirectory(directory);
        for (const [ownerProject, id] of affected) this.unwatch(ownerProject, id);
      });
    }
    let owners = entry.owners.get(projectId);
    if (!owners) {
      owners = new Set();
      entry.owners.set(projectId, owners);
    }
    owners.add(watchId);
  }

  private handleChange(directory: string, name: string | undefined): void {
    const entry = this.directories.get(directory);
    if (!entry) return;
    if (name && isPrivate(name)) return;
    for (const watchIds of entry.owners.values()) {
      for (const id of watchIds) {
        const paths = this.ids.get(id)?.subscriptions.get(directory)?.names;
        if (!paths) continue;
        if (!name) for (const path of paths.values()) this.enqueue(entry, path);
        else {
          const subscribed = paths.get(name);
          const directoryPath = paths.get('*');
          if (subscribed) this.enqueue(entry, subscribed);
          else if (directoryPath !== undefined)
            this.enqueue(entry, directoryPath ? `${directoryPath}/${name}` : name);
        }
      }
    }
    if ((entry.pending.size || entry.overflow) && !entry.timer)
      entry.timer = setTimeout(() => this.flush(directory), DEBOUNCE_MS);
  }

  private enqueue(entry: DirectoryWatch, path: string): void {
    if (entry.overflow || entry.pending.has(path)) return;
    if (entry.pending.size === MAX_PATHS) {
      entry.pending.clear();
      entry.overflow = true;
      return;
    }
    entry.pending.add(path);
  }

  private flush(directory: string): void {
    const entry = this.directories.get(directory);
    if (!entry) return;
    entry.timer = undefined;
    const changed = [...entry.pending];
    entry.pending.clear();
    const overflow = entry.overflow;
    entry.overflow = false;
    for (const [projectId, watchIds] of entry.owners) {
      const active = [...watchIds]
        .map((id) => this.ids.get(id))
        .filter((item): item is ProjectWatch => !!item);
      if (!active.length) continue;
      try {
        active[0]?.store.check('read');
        if (overflow) {
          const first = active[0];
          if (!first) continue;
          const directoryPath = relative(first.store.project.path, directory).split(sep).join('/');
          this.onChange(projectId, [directoryPath]);
          continue;
        }
        const permitted = active.flatMap((item) => [
          ...(item.subscriptions.get(directory)?.names ?? []),
        ]);
        const paths = changed.filter((path) =>
          permitted.some(([name, subscribed]) =>
            name === '*'
              ? path === subscribed ||
                (subscribed ? path.startsWith(`${subscribed}/`) : !path.startsWith('/'))
              : path === subscribed,
          ),
        );
        if (paths.length) this.onChange(projectId, paths);
      } catch {
        for (const id of watchIds) this.unwatch(projectId, id);
      }
    }
  }

  private checkPermissions(): void {
    for (const [watchId, entry] of this.ids) {
      try {
        entry.store.check('read');
      } catch {
        this.unwatch(entry.store.project.id, watchId);
      }
    }
  }

  private release(directory: string, projectId: string, watchId: string): void {
    const entry = this.directories.get(directory);
    const owners = entry?.owners.get(projectId);
    owners?.delete(watchId);
    if (owners?.size === 0) entry?.owners.delete(projectId);
    if (entry && entry.owners.size === 0) this.dropDirectory(directory);
  }

  private dropDirectory(directory: string): void {
    const entry = this.directories.get(directory);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.watcher.close();
    this.directories.delete(directory);
  }
}
