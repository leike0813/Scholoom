import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import {
  ProjectFileWatches,
  Projects as ProjectModule,
} from '../../packages/projects/dist/node.js';

class Projects extends ProjectModule {
  constructor(directory: string) {
    super(directory, initializeProjectContainer);
  }
}

const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20));
  expect(predicate()).toBe(true);
};

test('manual file watches report scoped changes and remain usable in restricted projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-watch-'));
  const projects = new Projects(join(root, 'profile'));
  let watches: ProjectFileWatches | undefined;
  try {
    const projectPath = join(root, 'project');
    await mkdir(projectPath);
    await writeFile(join(projectPath, 'note.md'), 'before');
    await projects.initialize();
    const store = await projects.open(projectPath);
    store.grant({ trust: 'restricted', autoBackup: false });
    const changes: string[][] = [];
    watches = new ProjectFileWatches(
      () => store,
      (_id, paths) => changes.push(paths),
    );

    const { watchId } = await watches.watch(store.project.id, ['note.md']);
    await writeFile(join(projectPath, 'note.md'), 'changed');
    await waitFor(() => changes.flat().includes('note.md'));

    changes.length = 0;
    const directoryWatch = await watches.watch(store.project.id, ['.']);
    await writeFile(join(projectPath, 'added.md'), 'new');
    await waitFor(() => changes.flat().includes('added.md'));
    watches.unwatch(store.project.id, directoryWatch.watchId);

    changes.length = 0;
    await writeFile(join(projectPath, 'replacement.tmp'), 'atomic');
    const { rename } = await import('node:fs/promises');
    await rename(join(projectPath, 'replacement.tmp'), join(projectPath, 'note.md'));
    await waitFor(() => changes.flat().includes('note.md'));

    watches.unwatch(store.project.id, watchId);
    changes.length = 0;
    await writeFile(join(projectPath, 'note.md'), 'after cancellation');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(changes).toEqual([]);

    const active = await watches.watch(store.project.id, ['note.md']);
    store.grant({ trust: 'restricted', autoBackup: false });
    changes.length = 0;
    await writeFile(join(projectPath, 'note.md'), 'restricted manual update');
    await waitFor(() => changes.flat().includes('note.md'));
    watches.unwatch(store.project.id, active.watchId);
    changes.length = 0;
    await writeFile(join(projectPath, 'note.md'), 'after revocation');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(changes).toEqual([]);
  } finally {
    watches?.close();
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('file watches reject private, escaping and symbolic-link paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-watch-'));
  const projects = new Projects(join(root, 'profile'));
  let watches: ProjectFileWatches | undefined;
  try {
    const projectPath = join(root, 'project');
    await mkdir(projectPath);
    await writeFile(join(projectPath, '.env'), 'private');
    await writeFile(join(root, 'outside.md'), 'outside');
    await symlink(join(root, 'outside.md'), join(projectPath, 'linked.md'));
    await projects.initialize();
    const store = await projects.open(projectPath);
    store.grant({ trust: 'restricted', autoBackup: false });
    watches = new ProjectFileWatches(
      () => store,
      () => {},
    );

    await expect(watches.watch(store.project.id, ['.env'])).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(watches.watch(store.project.id, ['../outside.md'])).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(watches.watch(store.project.id, ['linked.md'])).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    store.grant({ trust: 'restricted', autoBackup: false });
    await expect(watches.watch(store.project.id, ['.env'])).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  } finally {
    watches?.close();
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('directory watches filter private root entries but report public entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-watch-'));
  const projects = new Projects(join(root, 'profile'));
  let watches: ProjectFileWatches | undefined;
  try {
    const projectPath = join(root, 'project');
    await mkdir(projectPath);
    await projects.initialize();
    const store = await projects.open(projectPath);
    store.grant({ trust: 'restricted', autoBackup: false });
    const changes: string[][] = [];
    watches = new ProjectFileWatches(
      () => store,
      (_id, paths) => changes.push(paths),
    );
    await watches.watch(store.project.id, ['.']);

    await writeFile(join(projectPath, '.env'), 'secret');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(changes).toEqual([]);

    await writeFile(join(projectPath, 'public.md'), 'visible');
    await waitFor(() => changes.flat().includes('public.md'));
    expect(changes.flat()).not.toContain('.env');
  } finally {
    watches?.close();
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('filename-less nested directory events notify the subscribed directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-watch-'));
  const projects = new Projects(join(root, 'profile'));
  let watches: ProjectFileWatches | undefined;
  try {
    const projectPath = join(root, 'project');
    const nested = join(projectPath, 'nested');
    await mkdir(nested, { recursive: true });
    await projects.initialize();
    const store = await projects.open(projectPath);
    store.grant({ trust: 'restricted', autoBackup: false });
    const changes: string[][] = [];
    watches = new ProjectFileWatches(
      () => store,
      (_id, paths) => changes.push(paths),
    );
    await watches.watch(store.project.id, ['nested']);

    const internal = watches as unknown as {
      handleChange(directory: string, name?: string): void;
    };
    internal.handleChange(await store.path('nested'), undefined);
    await waitFor(() => changes.flat().includes('nested'));
  } finally {
    watches?.close();
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('overflow collapses more than 100 pending paths to one subscribed directory hint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-watch-'));
  const projects = new Projects(join(root, 'profile'));
  let watches: ProjectFileWatches | undefined;
  try {
    const projectPath = join(root, 'project');
    await mkdir(projectPath);
    const paths = Array.from({ length: 101 }, (_, index) => `file-${index}.txt`);
    await Promise.all(paths.map((path) => writeFile(join(projectPath, path), 'x')));
    await projects.initialize();
    const store = await projects.open(projectPath);
    store.grant({ trust: 'restricted', autoBackup: false });
    const changes: string[][] = [];
    watches = new ProjectFileWatches(
      () => store,
      (_id, changed) => changes.push(changed),
    );
    await watches.watch(store.project.id, paths.slice(0, 100));
    await watches.watch(store.project.id, paths.slice(100));

    const internal = watches as unknown as {
      handleChange(directory: string, name?: string): void;
    };
    internal.handleChange(store.project.path, undefined);
    await waitFor(() => changes.length > 0);
    expect(changes).toEqual([['']]);
  } finally {
    watches?.close();
    await projects.close();
    await rm(root, { recursive: true });
  }
});
