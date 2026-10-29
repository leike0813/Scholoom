import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import { type ProjectStore, Projects } from '../../packages/projects/dist/node.js';

const test = base.extend<{ project: { store: ProjectStore; projects: Projects } }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring fixture dependencies.
  project: async ({}, use, info) => {
    const root = info.outputPath('state');
    await mkdir(root, { recursive: true });
    const projects = new Projects(join(root, 'profile'), initializeProjectContainer);
    try {
      await projects.initialize();
      const store = await projects.create(join(root, 'project'));
      store.grant({ trust: 'restricted', autoBackup: false });
      await use({ store, projects });
    } finally {
      await projects.close();
    }
  },
});

test('exact after wins over a later before and keeps the recorded path after rename', async ({
  project: { store },
}) => {
  const first = await store.save('note.md', 'Retained first version.');
  assert(first.fileId && first.afterEvidence);
  const original = first.afterEvidence;
  const read = await store.read('note.md');
  const next = await store.save('note.md', 'Current second version.', read.basis);
  expect(next.beforeEvidence).toEqual(original);
  expect(
    await store.files.mutate('rename', randomUUID(), { path: 'note.md', name: 'renamed.md' }),
  ).toMatchObject({ state: 'complete' });
  const later = await store.read('renamed.md');
  await store.save('renamed.md', 'Later content at the new path.', later.basis);

  expect(store.editForEvidence(first.fileId, original.basis)).toBe(first.id);
  expect(store.versionForEvidence(first.fileId, original.basis)).toEqual({
    editId: first.id,
    side: 'after',
    path: 'note.md',
    content: 'Retained first version.',
    evidence: original,
  });
  expect(await readFile(join(store.project.path, 'renamed.md'), 'utf8')).toBe(
    'Later content at the new path.',
  );
});

test('a file predating its first managed save retains its exact before version only', async ({
  project: { store },
}) => {
  await writeFile(join(store.project.path, 'existing.md'), 'Original external bytes.');
  const original = await store.material('existing.md');
  const read = await store.read('existing.md');
  const saved = await store.save('existing.md', 'First managed replacement.', read.basis);
  const evidence = {
    ref: { source: 'project', projectId: store.project.id, fileId: original.fileId },
    basis: original.basis,
  };
  expect(saved.beforeEvidence).toEqual(evidence);
  expect(store.editForEvidence(original.fileId, original.basis)).toBeUndefined();
  expect(store.versionForEvidence(original.fileId, original.basis)).toEqual({
    editId: saved.id,
    side: 'before',
    path: 'existing.md',
    content: 'Original external bytes.',
    evidence,
  });
});

test('file identity and exact basis cannot select another retained version', async ({
  project: { store },
}) => {
  const first = await store.save('one.md', 'One.');
  const second = await store.save('two.md', 'Two.');
  assert(first.fileId && first.afterEvidence && second.fileId && second.afterEvidence);
  for (const [fileId, basis] of [
    [second.fileId, first.afterEvidence.basis],
    [first.fileId, second.afterEvidence.basis],
    [first.fileId, `${first.afterEvidence.basis}-different`],
    ['unregistered-file', first.afterEvidence.basis],
  ] as const) {
    expect(store.versionForEvidence(fileId, basis)).toBeUndefined();
  }
});

test('version reads retain the project read boundary for an untrusted execution', async ({
  project: { store, projects },
}) => {
  const saved = await store.save('private.md', 'Manual content remains private.');
  assert(saved.fileId && saved.afterEvidence);
  const { fileId, afterEvidence } = saved;
  projects.withAccess(
    { role: 'execution', principal: { kind: 'agent', id: 'reader' }, projectId: store.project.id },
    () => {
      expect(() => store.versionForEvidence(fileId, afterEvidence.basis)).toThrow(
        expect.objectContaining({ code: 'permissionDenied' }),
      );
      expect(() => store.editForEvidence(fileId, afterEvidence.basis)).toThrow(
        expect.objectContaining({ code: 'permissionDenied' }),
      );
    },
  );
});

for (const side of ['after', 'before'] as const) {
  test(`contradictory ${side} evidence refuses a version without falling through`, async ({
    project: { store },
  }) => {
    const original =
      side === 'after' ? await store.save('record.md', 'Recorded bytes.') : undefined;
    if (!original) await writeFile(join(store.project.path, 'record.md'), 'Recorded bytes.');
    const material = await store.material('record.md');
    const read = await store.read('record.md');
    const next = await store.save('record.md', 'Newer bytes.', read.basis);
    const selected = original ?? next;
    const evidence = side === 'after' ? selected.afterEvidence : selected.beforeEvidence;
    assert(evidence?.ref.source === 'project');
    const damaged = structuredClone(selected);
    damaged[side === 'after' ? 'afterEvidence' : 'beforeEvidence'] = {
      ...evidence,
      ref: { ...evidence.ref, projectId: 'another-project' },
    };
    store.database
      .prepare('UPDATE edits SET value=? WHERE id=?')
      .run(JSON.stringify(damaged), selected.id);
    expect(() => store.versionForEvidence(material.fileId, material.basis)).toThrow(
      expect.objectContaining({ code: 'unavailable' }),
    );
    expect(store.editForEvidence(material.fileId, material.basis)).toBe(
      side === 'after' ? selected.id : undefined,
    );
    expect(await readFile(join(store.project.path, 'record.md'), 'utf8')).toBe('Newer bytes.');
    expect(store.edit(material.fileId, selected.id)).toEqual(damaged);
  });
}
