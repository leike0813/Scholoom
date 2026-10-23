import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ResourceAccess } from '../../packages/editor/dist/node.js';
import type {
  CallContext,
  Project,
  ResourceLibraryPort,
  ResourceProjectPort,
} from '../../packages/protocol/dist/index.js';

const test = base.extend<{ resources: { app: ManualApplication; project: Project } }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  resources: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-identity-'));
    const app = new ManualApplication(join(root, 'profile'));
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'restricted',
      });
      await use({ app, project });
    } finally {
      await app.close();
    }
  },
});

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const boundary of ['queued', 'publishing'] as const) {
  test(`resource save rejects a same-content replacement while ${boundary}`, async ({
    resources: { app, project },
  }) => {
    const path = join(project.path, 'note.md');
    await app.call('files.save', { projectId: project.id, path: 'note.md', content: 'original' });
    const resource = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'note.md' },
    });
    const store = app.projects.get(project.id);
    const save = store.save.bind(store);
    const resolve = store.path.bind(store);
    const coordinate = store.files.coordinate.bind(store.files);
    const entered = barrier();
    const release = barrier();
    let armed = false;
    let checks = 0;
    store.save = (...args) => {
      armed = true;
      return save(...args);
    };
    if (boundary === 'queued') {
      store.files.coordinate = async (paths, action) => {
        if (armed) {
          armed = false;
          entered.resolve();
          await release.promise;
        }
        return coordinate(paths, action);
      };
    } else {
      store.path = async (...args) => {
        const resolved = await resolve(...args);
        if (armed && ++checks === 3) {
          entered.resolve();
          await release.promise;
        }
        return resolved;
      };
    }
    try {
      const pending = app.call('resources.save', {
        ref: resource.ref,
        basis: resource.basis,
        content: 'stale overwrite',
      });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'contentChanged' });
      await entered.promise;
      await rename(path, join(project.path, 'original.md'));
      await writeFile(path, 'original');
      const replacement = await stat(path, { bigint: true });
      release.resolve();
      await rejected;
      expect(await readFile(path, 'utf8')).toBe('original');
      expect((await stat(path, { bigint: true })).ino).toBe(replacement.ino);
      expect(await readFile(join(project.path, 'original.md'), 'utf8')).toBe('original');
      expect(store.history('note.md')).toHaveLength(1);
    } finally {
      release.resolve();
      store.save = save;
      store.path = resolve;
      store.files.coordinate = coordinate;
    }
  });
}

test('text from a reused path cannot be delivered under the moved file identity', async ({
  resources: { app, project },
}) => {
  await app.call('files.save', { projectId: project.id, path: 'note.md', content: 'original' });
  const resource = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'note.md' },
  });
  assert(resource.ref.source === 'project');
  const originalId = resource.ref.fileId;
  let replacementId: string | undefined;
  const projectPort: ResourceProjectPort = {
    'files.resolve': (input) => app.call('files.resolve', input),
    'files.readBytes': (input) => app.call('files.readBytes', input),
    'project.material': (input) => app.projects.get(input.projectId).material(input.path),
    'project.saveFile': (input) =>
      app.projects
        .get(input.projectId)
        .save(input.path, input.content, input.basis, undefined, input.expectedFileId),
    // Move through the real domain after location resolution, before the path read completes.
    'files.read': async (input) => {
      await app.call('files.rename', {
        projectId: project.id,
        path: 'note.md',
        name: 'moved.md',
        operationId: randomUUID(),
        expectedFileId: originalId,
      });
      await app.call('files.save', {
        projectId: project.id,
        path: 'note.md',
        content: 'replacement',
      });
      const source = await app.call('files.read', input);
      replacementId = source.fileId;
      return source;
    },
  };
  const access = new ResourceAccess(
    () => ({ project: projectPort, library: {} as ResourceLibraryPort }),
    {
      run: async () => {
        throw new Error('Text reading must not require a parser');
      },
    },
  );
  const context: CallContext = {
    moduleId: 'product',
    role: 'product',
    principal: { kind: 'human', id: 'reader' },
  };
  await expect(
    access.read({ ref: resource.ref, basis: resource.basis, encoding: 'utf8' }, context),
  ).rejects.toMatchObject({ code: 'contentChanged' });
  expect(replacementId).toBeDefined();
  expect(replacementId).not.toBe(originalId);
  expect(await app.call('files.read', { projectId: project.id, path: 'moved.md' })).toMatchObject({
    fileId: originalId,
    content: 'original',
  });
});

test('queued byte reads reject a moved identity when the old path is reused', async ({
  resources: { app, project },
}) => {
  await app.call('files.save', { projectId: project.id, path: 'note.md', content: 'original' });
  const original = await app.call('files.read', { projectId: project.id, path: 'note.md' });
  assert(original.fileId);
  const files = app.projects.get(project.id).files;
  const coordinate = files.coordinate.bind(files);
  const entered = barrier();
  const queued = barrier();
  const release = barrier();
  let moving = true;
  // Keep the real coordinator; pause the move while the read queues behind its lock.
  files.coordinate = (paths, run) => {
    if (!moving) {
      const result = coordinate(paths, run);
      queued.resolve();
      return result;
    }
    moving = false;
    return coordinate(paths, async () => {
      entered.resolve();
      await release.promise;
      const result = await run();
      await writeFile(join(project.path, 'note.md'), 'replacement');
      return result;
    });
  };
  const move = app.call('files.rename', {
    projectId: project.id,
    path: 'note.md',
    name: 'moved.md',
    operationId: randomUUID(),
    expectedFileId: original.fileId,
  });
  try {
    await entered.promise;
    const reading = app
      .call('files.readBytes', {
        projectId: project.id,
        fileId: original.fileId,
        limit: 256,
      })
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    await queued.promise;
    release.resolve();
    expect(await move).toMatchObject({ state: 'complete' });
    expect(await reading).toMatchObject({ error: { code: 'contentChanged' } });
    files.coordinate = coordinate;
    const fresh = await app.call('files.readBytes', {
      projectId: project.id,
      fileId: original.fileId,
      limit: 256,
    });
    expect(fresh.path).toBe('moved.md');
    expect(Buffer.from(fresh.data, 'base64').toString('utf8')).toBe('original');
    expect(await readFile(join(project.path, 'note.md'), 'utf8')).toBe('replacement');
  } finally {
    release.resolve();
    files.coordinate = coordinate;
    await move;
  }
});

test('a project HTML resource declared read-only rejects saving and preserves its bytes', async ({
  resources: { app, project },
}) => {
  const content = '<!doctype html><title>Original</title><p>Preserve this material</p>';
  const path = join(project.path, 'paper.html');
  await writeFile(path, content);
  const resource = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'paper.html' },
  });
  expect(resource).toMatchObject({ format: 'html', capabilities: { read: true, write: false } });
  await expect(
    app.call('resources.save', { ref: resource.ref, basis: resource.basis, content: 'overwrite' }),
  ).rejects.toMatchObject({ code: 'permissionDenied' });
  expect(await readFile(path, 'utf8')).toBe(content);
});
