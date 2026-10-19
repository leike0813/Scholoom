import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import { FileTransfers, Projects as ProjectModule } from '../../packages/projects/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

class Projects extends ProjectModule {
  constructor(directory: string) {
    super(directory, initializeProjectContainer);
  }
}

const waitFor = async <T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> => {
  const deadline = Date.now() + 5000;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    value = await read();
  }
  expect(
    done(value),
    `transfer did not reach its expected state within 5 seconds: ${JSON.stringify(value)}`,
  ).toBe(true);
  return value;
};

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-transfers-'));
  const projects = new Projects(join(root, 'profile'));
  await projects.initialize();
  const open = async (name: string) => {
    const path = join(root, name);
    await mkdir(path);
    const store = await projects.open(path);
    store.grant({ read: true, write: true, send: false, autoBackup: false });
    return store;
  };
  return {
    root,
    projects,
    open,
    close: async () => {
      await projects.close();
      await rm(root, { recursive: true });
    },
  };
};

const transfer = (projects: Projects) => new FileTransfers(projects);
const request = (
  projectId: string,
  sourceProjectId: string,
  path: string,
  fileId: string,
  mode: 'copy' | 'move',
  destination = '',
) => ({
  projectId,
  operationId: randomUUID(),
  destination,
  mode,
  sources: [{ projectId: sourceProjectId, path, fileId }],
});

test('concurrent requests cannot assign different parameters to the same transfer receipt', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('source');
    const target = await f.open('target');
    await writeFile(join(source.project.path, 'a.md'), 'a');
    await writeFile(join(source.project.path, 'b.md'), 'b');
    const a = await source.files.reference('a.md');
    const b = await source.files.reference('b.md');
    const first = request(target.project.id, source.project.id, a.path, a.fileId, 'copy');
    const second = {
      ...request(target.project.id, source.project.id, b.path, b.fileId, 'copy'),
      operationId: first.operationId,
    };
    const results = await Promise.allSettled([service.start(first), service.start(second)]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'invalidRequest' } });
    await waitFor(
      () => service.status(target.project.id, first.operationId),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(target.project.path, 'a.md'), 'utf8')).toBe('a');
    await expect(readFile(join(target.project.path, 'b.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

test('replacing a directory rechecks descendants after the conflict confirmation', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('source');
    const target = await f.open('target');
    await writeFile(join(source.project.path, 'entry'), 'incoming-file');
    await mkdir(join(target.project.path, 'entry', 'nested'), { recursive: true });
    await writeFile(join(target.project.path, 'entry', 'nested', 'note.md'), 'original');
    const ref = await source.files.reference('entry');
    const input = request(target.project.id, source.project.id, ref.path, ref.fileId, 'copy');
    await service.start(input);
    const conflict = await waitFor(
      () => service.status(target.project.id, input.operationId),
      (value) => value.state === 'conflict',
    );
    const entry = conflict.conflict;
    if (!entry?.basis) throw new Error('Missing conflict basis');
    const read = await target.read('entry/nested/note.md');
    await target.save(read.path, 'newer-user-work', read.basis);
    await service.decide({
      projectId: target.project.id,
      operationId: input.operationId,
      entryId: entry.id,
      basis: entry.basis,
      decision: 'replace',
    });
    const renewed = await waitFor(
      () => service.status(target.project.id, input.operationId),
      (value) => value.state === 'conflict',
    );
    expect(renewed.conflict?.basis).not.toBe(entry.basis);
    expect(await readFile(join(target.project.path, 'entry', 'nested', 'note.md'), 'utf8')).toBe(
      'newer-user-work',
    );
    expect(target.files.trashList().entries).toHaveLength(0);
  } finally {
    await service.close();
    await f.close();
  }
});

test('cross-project cleanup refuses a descendant edited after the copy verification', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('source');
    const target = await f.open('target');
    await mkdir(join(source.project.path, 'folder', 'nested'), { recursive: true });
    await writeFile(join(source.project.path, 'folder', 'nested', 'note.md'), 'copied');
    const ref = await source.files.reference('folder');
    const mutate = source.files.mutate.bind(source.files);
    let inserted = false;
    source.files.mutate = async (kind, id, input) => {
      if (kind === 'trash' && input.path === 'folder' && !inserted) {
        inserted = true;
        const read = await source.read('folder/nested/note.md');
        await source.save(read.path, 'edited-during-cleanup', read.basis);
      }
      return mutate(kind, id, input);
    };
    const input = request(target.project.id, source.project.id, ref.path, ref.fileId, 'move');
    await service.start(input);
    await waitFor(
      () => service.status(target.project.id, input.operationId),
      (value) => value.state === 'partial',
    );
    expect(await readFile(join(source.project.path, 'folder', 'nested', 'note.md'), 'utf8')).toBe(
      'edited-during-cleanup',
    );
    expect(await readFile(join(target.project.path, 'folder', 'nested', 'note.md'), 'utf8')).toBe(
      'copied',
    );
    expect(source.files.location(ref.fileId).state).toBe('present');
  } finally {
    await service.close();
    await f.close();
  }
});

test('finishing an import waits for an already accepted chunk', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const target = await f.open('target');
    const operationId = randomUUID();
    const bytes = Buffer.alloc(262144, 0xb7);
    await service.importBegin({
      projectId: target.project.id,
      operationId,
      destination: '',
      entries: [{ path: 'data.bin', kind: 'file', size: bytes.length }],
    });
    await Promise.all([
      service.importChunk({
        projectId: target.project.id,
        operationId,
        path: 'data.bin',
        offset: 0,
        base64: bytes.toString('base64'),
      }),
      service.importFinish(target.project.id, operationId),
    ]);
    await waitFor(
      () => service.status(target.project.id, operationId),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(target.project.path, 'data.bin'))).toEqual(bytes);
  } finally {
    await service.close();
    await f.close();
  }
});

test('published bytes and source cleanup receipts are reconciled without replay', async () => {
  for (const failAt of ['publish', 'source-receipt'] as const) {
    const f = await fixture();
    const service = transfer(f.projects);
    try {
      const source = await f.open('source');
      const target = await f.open('target');
      await writeFile(join(source.project.path, 'note.md'), 'saved-body');
      const ref = await source.files.reference('note.md');
      const reference = target.files.reference.bind(target.files);
      let injected = false;
      if (failAt === 'publish')
        target.files.reference = async (path, fresh) => {
          if (fresh && !injected) {
            injected = true;
            throw new OperationError('outcomeUnknown', 'Injected metadata failure');
          }
          return reference(path, fresh);
        };
      const mutate = source.files.mutate.bind(source.files);
      if (failAt === 'source-receipt')
        source.files.mutate = async (kind, id, input) => {
          const result = await mutate(kind, id, input);
          if (kind === 'trash' && !injected) {
            injected = true;
            throw new OperationError('outcomeUnknown', 'Injected lost reply');
          }
          return result;
        };
      const input = request(
        target.project.id,
        source.project.id,
        ref.path,
        ref.fileId,
        failAt === 'publish' ? 'copy' : 'move',
      );
      await service.start(input);
      await waitFor(
        () => service.status(target.project.id, input.operationId),
        (value) => value.state === 'complete',
      );
      const id = (await target.files.reference('note.md')).fileId;
      await service.start(input);
      expect((await target.files.reference('note.md')).fileId).toBe(id);
      expect(await readFile(join(target.project.path, 'note.md'), 'utf8')).toBe('saved-body');
      expect(source.files.location(ref.fileId).state).toBe(
        failAt === 'publish' ? 'present' : 'trashed',
      );
      expect(source.files.trashList().entries).toHaveLength(failAt === 'publish' ? 0 : 1);
    } finally {
      await service.close();
      await f.close();
    }
  }
});

test('backup restoration does not retain a task that can mutate the original project receipt', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const target = await f.open('target');
    const operationId = randomUUID();
    await service.importBegin({
      projectId: target.project.id,
      operationId,
      destination: '',
      entries: [{ path: 'unfinished.md', kind: 'file', size: 3 }],
    });
    const backup = await target.backup();
    const restoredPath = await target.restore(backup.id, join(f.root, 'restored'));
    const restored = await f.projects.open(restoredPath);
    restored.grant({ read: true, write: true, send: false, autoBackup: false });
    await expect(service.status(restored.project.id, operationId)).rejects.toMatchObject({
      code: 'notFound',
    });
    expect((await service.status(target.project.id, operationId)).state).toBe('uploading');
    await expect(readFile(join(target.project.path, 'unfinished.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

for (const cancelled of [false, true])
  test(`lost replacement recycle replies expose the prior target on ${cancelled ? 'cancel' : 'status'}`, async () => {
    const f = await fixture();
    const service = transfer(f.projects);
    try {
      const source = await f.open('source');
      const target = await f.open('target');
      await writeFile(join(source.project.path, 'note.md'), 'candidate');
      await writeFile(join(target.project.path, 'note.md'), 'original-target');
      const ref = await source.files.reference('note.md');
      const original = await target.files.reference('note.md');
      const input = request(target.project.id, source.project.id, ref.path, ref.fileId, 'copy');
      const mutate = target.files.mutate.bind(target.files);
      const operation = target.files.operation.bind(target.files);
      let replacementId = '';
      let unavailable = !cancelled;
      target.files.operation = async (id) => {
        if (unavailable && id !== replacementId)
          throw new OperationError('unavailable', 'Temporary receipt lookup failure');
        return operation(id);
      };
      let injected = false;
      target.files.mutate = async (kind, id, params) => {
        const result = await mutate(kind, id, params);
        if (kind === 'trash' && !injected) {
          replacementId = id;
          injected = true;
          throw new OperationError('outcomeUnknown', 'Lost target recycle receipt');
        }
        return result;
      };
      await service.start(input);
      const conflict = await waitFor(
        () => service.status(target.project.id, input.operationId),
        (value) => value.state === 'conflict',
      );
      const entry = conflict.conflict;
      if (!entry?.basis) throw new Error('Expected a replacement conflict');
      await service.decide({
        projectId: target.project.id,
        operationId: input.operationId,
        entryId: entry.id,
        basis: entry.basis,
        decision: 'replace',
      });
      if (cancelled) {
        await waitFor(
          async () => injected,
          (value) => value,
        );
        await service.cancel(target.project.id, input.operationId);
      } else {
        const uncertain = await waitFor(
          () => service.status(target.project.id, input.operationId),
          (value) => value.state === 'unknown' && !!value.entries[0]?.trashId,
        );
        expect(uncertain.completed).toBe(0);
        unavailable = false;
      }
      const result = await waitFor(
        () => service.status(target.project.id, input.operationId),
        (value) => value.state === 'partial',
      );
      const recycled = result.entries[0]?.trashId;
      expect(injected).toBe(true);
      expect(recycled).toBeTruthy();
      expect(target.files.trashList().entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fileId: original.fileId, trashId: recycled }),
        ]),
      );
      await target.files.mutate('restore', randomUUID(), {
        trashId: recycled!,
        destination: 'recovered.md',
      });
      expect(await readFile(join(target.project.path, 'recovered.md'), 'utf8')).toBe(
        'original-target',
      );
      expect(await readFile(join(source.project.path, 'note.md'), 'utf8')).toBe('candidate');
    } finally {
      await service.close();
      await f.close();
    }
  });

test('interrupted source cleanup settles without initiating further writes during status checks', async () => {
  for (const sameProject of [false, true]) {
    const f = await fixture();
    const service = transfer(f.projects);
    try {
      const source = await f.open('source');
      const target = sameProject ? source : await f.open('target');
      await mkdir(join(source.project.path, 'folder', 'nested'), { recursive: true });
      await writeFile(join(source.project.path, 'folder', 'nested', 'note.md'), 'saved-body');
      await mkdir(join(target.project.path, 'destination', 'folder', 'nested'), {
        recursive: true,
      });
      const ref = await source.files.reference('folder');
      const mutate = source.files.mutate.bind(source.files);
      let cleanupCalls = 0;
      source.files.mutate = async (kind, id, input) => {
        if (kind === 'trash') {
          cleanupCalls++;
          if (sameProject) await mutate(kind, id, input);
          throw new OperationError('outcomeUnknown', 'Interrupted cleanup');
        }
        return mutate(kind, id, input);
      };
      const input = request(
        target.project.id,
        source.project.id,
        ref.path,
        ref.fileId,
        'move',
        'destination',
      );
      await service.start(input);
      const result = await waitFor(
        () => service.status(target.project.id, input.operationId),
        (value) => value.state === 'partial',
      );
      expect(result.entries.every((entry) => entry.state === 'complete')).toBe(true);
      expect(
        await readFile(join(target.project.path, 'destination/folder/nested/note.md'), 'utf8'),
      ).toBe('saved-body');
      expect(source.files.location(ref.fileId).state).toBe('present');
      const calls = cleanupCalls;
      await service.status(target.project.id, input.operationId);
      expect(cleanupCalls).toBe(calls);
      if (!sameProject)
        expect(await readFile(join(source.project.path, 'folder/nested/note.md'), 'utf8')).toBe(
          'saved-body',
        );
    } finally {
      await service.close();
      await f.close();
    }
  }
});

test('a directory replaced by a file cannot be transferred using its former identity', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('source');
    const target = await f.open('target');
    const path = join(source.project.path, 'entry');
    await mkdir(path);
    const ref = await source.files.reference('entry');
    await rm(path, { recursive: true });
    await writeFile(path, 'new-user-file');
    const accepted = await service.start(
      request(target.project.id, source.project.id, ref.path, ref.fileId, 'move'),
    );
    const rejected = await waitFor(
      () => service.status(target.project.id, accepted.id),
      (value) => value.state === 'partial',
    );
    expect(rejected.completed).toBe(0);
    expect(source.files.location(ref.fileId).state).toBe('missing');
    expect(await readFile(path, 'utf8')).toBe('new-user-file');
    await expect(readFile(join(target.project.path, 'entry'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

test('merged empty-directory cleanup preserves a file created before the recycle critical section', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'source', 'nested'), { recursive: true });
    await mkdir(join(store.project.path, 'destination', 'source', 'nested'), { recursive: true });
    await writeFile(join(store.project.path, 'source/nested/note.md'), 'copied');
    const ref = await store.files.reference('source');
    const coordinate = store.files.coordinate.bind(store.files);
    let injected = false;
    store.files.coordinate = async (paths, run) =>
      coordinate(paths, async () => {
        if (
          !injected &&
          paths.includes(join(store.project.path, 'source/nested')) &&
          paths.some((path) => path.startsWith(join(store.internal, 'trash')))
        ) {
          injected = true;
          await writeFile(join(store.project.path, 'source/nested/new.md'), 'later-work');
        }
        return run();
      });
    const input = request(
      store.project.id,
      store.project.id,
      ref.path,
      ref.fileId,
      'move',
      'destination',
    );
    await service.start(input);
    await waitFor(
      () => service.status(store.project.id, input.operationId),
      (value) => value.state === 'partial',
    );
    expect(injected).toBe(true);
    expect(await readFile(join(store.project.path, 'source/nested/new.md'), 'utf8')).toBe(
      'later-work',
    );
    expect(
      await readFile(join(store.project.path, 'destination/source/nested/note.md'), 'utf8'),
    ).toBe('copied');
    expect(store.files.trashList().entries).toHaveLength(0);
  } finally {
    await service.close();
    await f.close();
  }
});

test('directory transfers merge unique children and replacement trashes the prior identity for recovery', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'source', 'nested'), { recursive: true });
    await mkdir(join(store.project.path, 'destination', 'source', 'nested'), { recursive: true });
    await writeFile(
      join(store.project.path, 'source', 'nested', 'replace.bin'),
      Buffer.from([0, 255, 8]),
    );
    await writeFile(
      join(store.project.path, 'destination', 'source', 'nested', 'replace.bin'),
      'old-target',
    );
    await writeFile(join(store.project.path, 'destination', 'source', 'unique.md'), 'keep');
    const source = await store.files.reference('source');
    const old = await store.files.reference('destination/source/nested/replace.bin');
    const operation = request(
      store.project.id,
      store.project.id,
      'source',
      source.fileId,
      'copy',
      'destination',
    );
    const started = await service.start(operation);
    expect(started.id).toBe(operation.operationId);
    const conflict = await waitFor(
      () => service.status(store.project.id, operation.operationId),
      (value) => value.state === 'conflict',
    );
    const item = conflict.entries.find(
      (entry) => entry.destination === 'destination/source/nested/replace.bin',
    );
    expect(item?.basis).toBeTruthy();
    const complete = await service.decide({
      projectId: store.project.id,
      operationId: operation.operationId,
      entryId: item!.id,
      basis: item!.basis!,
      decision: 'replace',
    });
    const result = await waitFor(
      () => service.status(store.project.id, operation.operationId),
      (value) => value.state === 'complete',
    );
    expect(complete.id).toBe(result.id);
    expect(
      await readFile(join(store.project.path, 'destination/source/nested/replace.bin')),
    ).toEqual(Buffer.from([0, 255, 8]));
    expect(await readFile(join(store.project.path, 'destination/source/unique.md'), 'utf8')).toBe(
      'keep',
    );
    expect((await store.files.resolve([old.fileId]))[0]?.state).toBe('trashed');
    const recycled = result.entries.find((entry) => entry.trashId);
    expect(recycled).toBeTruthy();
    await store.files.mutate('restore', randomUUID(), {
      trashId: recycled!.trashId!,
      destination: 'recovered.bin',
    });
    expect(await readFile(join(store.project.path, 'recovered.bin'), 'utf8')).toBe('old-target');
    expect((await store.files.resolve([old.fileId]))[0]).toMatchObject({
      state: 'present',
      path: 'recovered.bin',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

test('same-project move retains file identity and rejects a stale conflict decision basis', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'from'));
    await mkdir(join(store.project.path, 'to'));
    await writeFile(join(store.project.path, 'from/item.md'), 'source');
    await writeFile(join(store.project.path, 'to/item.md'), 'target');
    const source = await store.files.reference('from/item.md');
    const operation = request(
      store.project.id,
      store.project.id,
      'from/item.md',
      source.fileId,
      'move',
      'to',
    );
    const started = await service.start(operation);
    const conflict = await waitFor(
      () => service.status(store.project.id, operation.operationId),
      (value) => value.state === 'conflict',
    );
    const entry = conflict.entries.find((item) => item.state === 'conflict')!;
    await writeFile(join(store.project.path, 'to/item.md'), 'changed target');
    const stale = await service.decide({
      projectId: store.project.id,
      operationId: operation.operationId,
      entryId: entry.id,
      basis: entry.basis!,
      decision: 'replace',
    });
    await waitFor(
      () => service.status(store.project.id, operation.operationId),
      (value) =>
        value.state === 'conflict' &&
        value.entries.find((item) => item.id === entry.id)?.basis !== entry.basis,
    );
    await expect(
      service.decide({
        projectId: store.project.id,
        operationId: operation.operationId,
        entryId: entry.id,
        basis: entry.basis!,
        decision: 'skip',
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await service.cancel(store.project.id, started.id);

    await mkdir(join(store.project.path, 'moved'));
    const second = await service.start(
      request(store.project.id, store.project.id, 'from/item.md', source.fileId, 'move', 'moved'),
    );
    const result = await waitFor(
      () => service.status(store.project.id, second.id),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(store.project.path, 'moved/item.md'), 'utf8')).toBe('source');
    expect((await store.files.resolve([source.fileId]))[0]).toMatchObject({
      state: 'present',
      path: 'moved/item.md',
    });
    expect(result.entries.find((item) => item.path === 'from/item.md')?.fileId).toBe(source.fileId);
  } finally {
    await service.close();
    await f.close();
  }
});

test('cross-project copy creates identities and complete move trashes source while retaining history', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('source');
    const target = await f.open('target');
    await mkdir(join(target.project.path, 'archive'));
    const edit = await source.save('record.md', 'before');
    if (!edit.fileId) throw new Error('file save did not register an identity');
    const basis = await source.read('record.md');
    const history = await source.save('record.md', 'saved source content', basis.basis);
    const copied = await service.start(
      request(target.project.id, source.project.id, 'record.md', edit.fileId, 'copy'),
    );
    const copiedResult = await waitFor(
      () => service.status(target.project.id, copied.id),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(target.project.path, 'record.md'), 'utf8')).toBe(
      'saved source content',
    );
    expect(copiedResult.entries[0]?.fileId).not.toBe(edit.fileId);
    expect((await source.files.resolve([edit.fileId]))[0]?.state).toBe('present');

    const moved = await service.start(
      request(target.project.id, source.project.id, 'record.md', edit.fileId, 'move', 'archive'),
    );
    const movedResult = await waitFor(
      () => service.status(target.project.id, moved.id),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(target.project.path, 'archive/record.md'), 'utf8')).toBe(
      'saved source content',
    );
    expect((await target.files.reference('archive/record.md')).fileId).not.toBe(edit.fileId);
    expect((await source.files.resolve([edit.fileId]))[0]?.state).toBe('trashed');
    expect(source.database.prepare('SELECT id FROM edits WHERE id = ?').get(history.id)).toEqual({
      id: history.id,
    });
    expect(movedResult.entries[0]?.fileId).not.toBe(edit.fileId);
  } finally {
    await service.close();
    await f.close();
  }
});

test('skipping a directory conflict preserves its complete source subtree', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'source', 'sub'), { recursive: true });
    await mkdir(join(store.project.path, 'destination', 'source', 'sub'), { recursive: true });
    await writeFile(join(store.project.path, 'source', 'sub/item.md'), 'source');
    await writeFile(join(store.project.path, 'destination/source/sub/item.md'), 'target');
    const source = await store.files.reference('source');
    const result = await service.start(
      request(store.project.id, store.project.id, 'source', source.fileId, 'move', 'destination'),
    );
    const conflict = await waitFor(
      () => service.status(store.project.id, result.id),
      (value) => value.state === 'conflict',
    );
    const item = conflict.entries.find((entry) => entry.state === 'conflict')!;
    await service.decide({
      projectId: store.project.id,
      operationId: result.id,
      entryId: item.id,
      basis: item.basis!,
      decision: 'skip',
    });
    const finished = await waitFor(
      () => service.status(store.project.id, result.id),
      (value) => value.state === 'partial',
    );
    expect(finished.entries.some((entry) => entry.state === 'skipped')).toBe(true);
    expect(await readFile(join(store.project.path, 'source/sub/item.md'), 'utf8')).toBe('source');
    expect(await readFile(join(store.project.path, 'destination/source/sub/item.md'), 'utf8')).toBe(
      'target',
    );
    expect((await store.files.resolve([source.fileId]))[0]?.state).toBe('present');
  } finally {
    await service.close();
    await f.close();
  }
});

test('large binary import accepts matching repeated chunks, rejects changed repeats and cancellation preserves source', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'imports'));
    await mkdir(join(store.project.path, 'cancelled'));
    const bytes = Buffer.alloc(700_123);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const path = join(f.root, 'system.bin');
    await writeFile(path, bytes);
    const operationId = randomUUID();
    await service.importBegin({
      projectId: store.project.id,
      operationId,
      destination: 'imports',
      entries: [{ path: 'large.bin', kind: 'file', size: bytes.length }],
    });
    for (let offset = 0; offset < bytes.length; offset += 262_144) {
      const chunk = bytes
        .subarray(offset, Math.min(offset + 262_144, bytes.length))
        .toString('base64');
      await service.importChunk({
        projectId: store.project.id,
        operationId,
        path: 'large.bin',
        offset,
        base64: chunk,
      });
      if (offset === 0) {
        await service.importChunk({
          projectId: store.project.id,
          operationId,
          path: 'large.bin',
          offset,
          base64: chunk,
        });
        await expect(
          service.importChunk({
            projectId: store.project.id,
            operationId,
            path: 'large.bin',
            offset,
            base64: Buffer.from('different').toString('base64'),
          }),
        ).rejects.toMatchObject({ code: 'contentChanged' });
      }
    }
    await service.importFinish(store.project.id, operationId);
    await waitFor(
      () => service.status(store.project.id, operationId),
      (value) => value.state === 'complete',
    );
    expect(await readFile(join(store.project.path, 'imports/large.bin'))).toEqual(bytes);
    expect(await readFile(path)).toEqual(bytes);

    const cancelledId = randomUUID();
    await service.importBegin({
      projectId: store.project.id,
      operationId: cancelledId,
      destination: 'cancelled',
      entries: [{ path: 'large.bin', kind: 'file', size: bytes.length }],
    });
    await service.importChunk({
      projectId: store.project.id,
      operationId: cancelledId,
      path: 'large.bin',
      offset: 0,
      base64: bytes.subarray(0, 262_144).toString('base64'),
    });
    expect((await service.cancel(store.project.id, cancelledId)).state).toBe('cancelled');
    expect(await readFile(path)).toEqual(bytes);
    await expect(readFile(join(store.project.path, 'cancelled/large.bin'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

test('copy and move enforce separate grants, reject descendant destinations, and directory pages locate entries', async () => {
  const f = await fixture();
  const service = transfer(f.projects);
  try {
    const source = await f.open('project');
    await mkdir(join(source.project.path, 'folder', 'child'), { recursive: true });
    await writeFile(join(source.project.path, 'folder/item.md'), 'content');
    const ref = await source.files.reference('folder');
    await expect(
      service.start(
        request(source.project.id, source.project.id, 'folder', ref.fileId, 'copy', 'folder/child'),
      ),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    source.grant({ read: false, write: true, send: false, autoBackup: false });
    await expect(
      service.start(request(source.project.id, source.project.id, 'folder', ref.fileId, 'copy')),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    source.grant({ read: true, write: false, send: false, autoBackup: false });
    await expect(
      service.start(
        request(source.project.id, source.project.id, 'folder', ref.fileId, 'move', 'elsewhere'),
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    source.grant({ read: true, write: true, send: false, autoBackup: false });
    const destination = await f.open('destination-project');
    source.grant({ read: true, write: false, send: false, autoBackup: false });
    destination.grant({ read: true, write: false, send: false, autoBackup: false });
    await expect(
      service.start(
        request(destination.project.id, source.project.id, 'folder', ref.fileId, 'copy'),
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    destination.grant({ read: true, write: true, send: false, autoBackup: false });
    const copied = await service.start(
      request(destination.project.id, source.project.id, 'folder', ref.fileId, 'copy'),
    );
    expect(
      (
        await waitFor(
          () => service.status(destination.project.id, copied.id),
          (value) => value.state === 'complete',
        )
      ).state,
    ).toBe('complete');
    await expect(
      service.start(
        request(destination.project.id, source.project.id, 'folder', ref.fileId, 'move'),
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    source.grant({ read: true, write: true, send: false, autoBackup: false });
    const names = Array.from(
      { length: 13 },
      (_, index) => `item-${String(index).padStart(2, '0')}.md`,
    );
    await Promise.all(names.map((name) => writeFile(join(source.project.path, name), name)));
    const page = await source.list('', 0, 4);
    const located = await source.list('', 0, 4, undefined, 'item-09.md');
    expect(located.offset).toBeGreaterThan(0);
    expect(located.entries.map((entry) => entry.name)).toContain('item-09.md');
    await expect(source.list('', 0, 4, page.version)).resolves.toMatchObject({
      version: page.version,
    });
    await writeFile(join(source.project.path, 'new-entry.md'), 'change');
    await expect(source.list('', 0, 4, page.version)).rejects.toMatchObject({
      code: 'contentChanged',
    });
  } finally {
    await service.close();
    await f.close();
  }
});

test('completed receipt survives closing and reopening without replaying its destination', async () => {
  const f = await fixture();
  let service: FileTransfers | undefined = transfer(f.projects);
  try {
    const store = await f.open('project');
    await mkdir(join(store.project.path, 'copy'));
    await writeFile(join(store.project.path, 'source.md'), 'once');
    const source = await store.files.reference('source.md');
    const operation = request(
      store.project.id,
      store.project.id,
      'source.md',
      source.fileId,
      'copy',
      'copy',
    );
    const result = await service.start(operation);
    await waitFor(
      () => service!.status(store.project.id, result.id),
      (value) => value.state === 'complete',
    );
    const destinationId = (await store.files.reference('copy/source.md')).fileId;
    await service.close();
    service = undefined;
    await f.projects.close();
    const reopenedProjects = new Projects(join(f.root, 'profile'));
    await reopenedProjects.initialize();
    const reopenedStore = await reopenedProjects.open(store.project.path);
    const reopened = new FileTransfers(reopenedProjects);
    try {
      expect(await reopened.status(store.project.id, result.id)).toMatchObject({
        state: 'complete',
        id: result.id,
      });
      expect((await reopened.start(operation)).state).toBe('complete');
      expect((await reopenedStore.files.reference('copy/source.md')).fileId).toBe(destinationId);
      expect(await readFile(join(store.project.path, 'copy/source.md'), 'utf8')).toBe('once');
    } finally {
      await reopened.close();
      await reopenedProjects.close();
    }
  } finally {
    if (service) await service.close();
    await rm(f.root, { recursive: true });
  }
});
