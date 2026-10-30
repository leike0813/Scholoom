import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ResourceAccess } from '../../packages/editor/dist/node.js';
import type {
  CallContext,
  ResourceDescriptor,
  ResourceLibraryPort,
  ResourceProjectPort,
} from '../../packages/protocol/dist/index.js';
import { epubFixture, htmlFixture } from '../document-fixture.js';
import { createModelServer } from '../model-server.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

class ExecutionApplication extends KernelApplication {
  context: CallContext | undefined;
  private readonly preparedMoves = new Set<string>();

  async moveTarget(projectId: string, destination: string): Promise<void> {
    await super.projectReplacing(projectId);
    const store = this.projects.get(projectId);
    await store.close();
    await rename(store.project.path, destination);
    this.preparedMoves.add(projectId);
  }

  protected override async projectReplacing(projectId: string): Promise<void> {
    if (!this.preparedMoves.delete(projectId)) await super.projectReplacing(projectId);
  }

  override projectTargetRead(context: CallContext) {
    this.context = context;
    return super.projectTargetRead(context);
  }
}

for (const invalidation of ['cancel', 'revoke'] as const) {
  test(`queued resource creation rechecks ${invalidation} before publishing`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-create-race-'));
    const model = await createModelServer();
    model.hold = true;
    const app = new ExecutionApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let blocker: Promise<unknown> | undefined;
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const session = await app.call('session.create', { projectId: project.id });
      await app.call('session.send', {
        projectId: project.id,
        sessionId: session.id,
        instructionId: randomUUID(),
        text: 'Hold this turn.',
        materials: [],
      });
      await expect.poll(() => model.requests.length).toBe(1);
      const context = app.context;
      assert(context);
      expect(() =>
        app.executionResources({
          ...context,
          role: 'product',
          principal: { kind: 'human', id: 'local' },
        }),
      ).toThrow(expect.objectContaining({ code: 'permissionDenied' }));
      const port = app.executionResources(context);
      const target = join(project.path, 'queued.md');
      blocker = app.projects.get(project.id).files.coordinate([target], async () => {
        entered();
        await held;
      });
      await waiting;
      const creating = port.create({
        projectId: project.id,
        path: 'queued.md',
        content: 'must not publish',
        operationId: 'queued-create',
      });
      const rejected = expect(creating).rejects.toMatchObject({
        code: invalidation === 'cancel' ? 'instanceMismatch' : 'permissionDenied',
      });
      if (invalidation === 'cancel')
        await app.call('session.cancel', { projectId: project.id, sessionId: session.id });
      else app.projects.get(project.id).grant({ trust: 'restricted', autoBackup: false });
      release();
      await rejected;
      await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      release();
      await blocker;
      model.release();
      await app.close();
      await model.close();
    }
  });
}

for (const revocation of ['library-send', 'target-instance'] as const) {
  test(`execution resources retain real ownership and recheck ${revocation} without opening a view`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-execution-resource-'));
    const model = await createModelServer();
    model.hold = true;
    const app = new ExecutionApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    try {
      await app.initialize();
      const project = await app.projects.create(join(root, 'project'));
      project.grant({ trust: 'trusted', autoBackup: false });
      const saved = await project.save('input.md', '中😀文\n');
      const targetProject = await app.call('project.create', {
        path: join(root, 'target'),
        trust: 'trusted',
      });
      const target = app.projects.get(targetProject.id);
      const targetContent = `${'x'.repeat(262144)}目标😀尾段\n`;
      await writeFile(join(target.project.path, 'other.md'), targetContent);
      const other = await target.material('other.md');
      assert(saved.fileId && other.fileId);
      const session = await app.call('session.create', { projectId: project.project.id });
      await app.call('session.send', {
        projectId: project.project.id,
        sessionId: session.id,
        instructionId: randomUUID(),
        text: 'MODEL_FIXTURE 读取 input.md 并保存 result.md',
        materials: [],
      });
      await expect.poll(() => model.requests.length).toBe(1);
      assert(app.context);
      const port = app.executionResources(app.context);
      const resource = await port.describe({
        source: 'project',
        projectId: project.project.id,
        fileId: saved.fileId,
      });
      expect(
        await port.read({
          ref: resource.ref,
          basis: resource.basis,
          encoding: 'utf8',
          offset: 1,
          limit: 2,
        }),
      ).toMatchObject({ data: '😀', unit: 'utf16', nextOffset: 3 });
      const updated = await port.save({
        ref: resource.ref,
        basis: resource.basis,
        content: 'saved evidence',
      });
      expect(updated.resource.ref).toEqual(resource.ref);
      expect(await readFile(join(project.project.path, 'input.md'), 'utf8')).toBe('saved evidence');
      await expect(
        port.save({ ref: resource.ref, basis: resource.basis, content: 'stale' }),
      ).rejects.toMatchObject({ code: 'contentChanged' });
      const foreign = await port.describe({
        source: 'project',
        projectId: target.project.id,
        fileId: other.fileId,
      });
      const openedForeign = await app.call('resources.describe', {
        locator: { source: 'project', projectId: target.project.id, fileId: other.fileId },
      });
      expect(foreign.basis).toBe(openedForeign.basis);
      expect(
        await port.read({
          ref: openedForeign.ref,
          basis: openedForeign.basis,
          encoding: 'utf8',
          offset: 262144,
        }),
      ).toMatchObject({ data: '目标😀尾段\n', size: targetContent.length, truncated: false });
      expect(foreign.capabilities.write).toBe(false);
      await expect(
        port.create({
          projectId: target.project.id,
          path: 'forbidden.md',
          operationId: 'target-copy',
          content: 'bypass',
        }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      await expect(
        port.save({ ref: foreign.ref, basis: foreign.basis, content: 'forbidden' }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      await expect(
        port.describe({ source: 'project', projectId: target.project.id, path: 'unregistered.md' }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      const path = join(root, 'material.md');
      const libraryContent = `${'x'.repeat(262143)}😀中\n独立库尾段`;
      await writeFile(path, libraryContent);
      const batch = await app.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [path],
        storage: 'linked',
        purpose: '正文',
        version: 'unspecified',
        origin: 'execution-resource-test',
      });
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const entry = (await app.call('library.batch', { batchId: batch.id })).entries[0];
      assert(entry?.attachmentId);
      const attachment = await app.call('library.attachment', { attachmentId: entry.attachmentId });
      const ref = {
        source: 'library' as const,
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      };
      await expect(port.describe(ref)).rejects.toMatchObject({ code: 'permissionDenied' });
      await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
      const library = await port.describe(ref);
      expect(
        await port.read({ ref, basis: library.basis, encoding: 'utf8', offset: 262143 }),
      ).toMatchObject({
        data: '😀中\n独立库尾段',
        size: libraryContent.length,
        truncated: false,
      });
      await expect(
        port.describe({ ...ref, materialVersionId: randomUUID() }),
      ).rejects.toMatchObject({
        code: 'contentChanged',
      });
      await expect(
        port.save({ ref, basis: library.basis, content: 'copy bypass' }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      await writeFile(path, 'external revision');
      await expect(
        port.read({ ref, basis: library.basis, encoding: 'utf8' }),
      ).rejects.toMatchObject({
        code: 'contentChanged',
      });
      if (revocation === 'library-send') {
        await app.call('library.grant', {
          read: true,
          write: true,
          send: false,
          autoBackup: false,
        });
        await expect(
          port.read({ ref, basis: library.basis, encoding: 'utf8' }),
        ).rejects.toMatchObject({ code: 'permissionDenied' });
      } else {
        await app.moveTarget(target.project.id, join(root, 'moved'));
        const replacement = await app.projects.open(join(root, 'moved'));
        replacement.grant({ trust: 'trusted', autoBackup: false });
        await expect(
          port.read({ ref: foreign.ref, basis: foreign.basis, encoding: 'utf8' }),
        ).rejects.toMatchObject({ code: 'permissionDenied' });
      }
      model.release();
      await expect
        .poll(() => app.harness.getSession(project.project.id, session.id).state)
        .toBe('failed');
      expect(model.requests).toHaveLength(1);
      expect(
        await readFile(
          join(root, revocation === 'target-instance' ? 'moved' : 'target', 'other.md'),
          'utf8',
        ),
      ).toBe(targetContent);
    } finally {
      model.release();
      await app.close();
      await model.close();
    }
  });
}

for (const replacement of [false, true, 'rename'] as const) {
  test(`saved resources return association failure and restart only reconciles original evidence (replacement=${replacement})`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-association-'));
    const profile = join(root, 'profile');
    const model = await createModelServer();
    model.hold = true;
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    let app = new ExecutionApplication(profile, options);
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const store = app.projects.get(project.id);
      const saved = await store.save('input.md', 'initial evidence');
      assert(saved.fileId);
      const session = await app.call('session.create', { projectId: project.id });
      const { runId } = await app.call('session.send', {
        projectId: project.id,
        sessionId: session.id,
        instructionId: randomUUID(),
        text: 'Hold this turn.',
        materials: [],
      });
      await expect.poll(() => model.requests.length).toBe(1);
      assert(app.context);
      const port = app.executionResources(app.context);
      const resource = await port.describe({
        source: 'project',
        projectId: project.id,
        fileId: saved.fileId,
      });
      store.database.exec(
        "CREATE TRIGGER reject_association BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic association failure'); END",
      );
      const result = await port.save({
        ref: resource.ref,
        basis: resource.basis,
        content: 'saved actual result',
      });
      expect(result).toMatchObject({
        resource: { ref: resource.ref },
        association: { state: 'unknown' },
      });
      assert(result.editId);
      expect(
        await app.call('files.edit', {
          projectId: project.id,
          fileId: saved.fileId,
          editId: result.editId,
        }),
      ).toMatchObject({
        after: 'saved actual result',
        origin: { kind: 'execution', sessionId: session.id, runId },
      });
      const identity = await stat(join(project.path, 'input.md'), { bigint: true });
      expect(await readFile(join(project.path, 'input.md'), 'utf8')).toBe('saved actual result');
      const created = await port.create({
        projectId: project.id,
        path: 'created.md',
        operationId: 'first-created-result',
        content: 'created actual result',
      });
      expect(created).toMatchObject({ state: 'complete', association: { state: 'unknown' } });
      assert(created.state === 'complete');
      assert(created.editId);
      expect(
        await app.call('files.edit', {
          projectId: project.id,
          fileId: created.resource.ref.fileId,
          editId: created.editId,
        }),
      ).toMatchObject({
        after: 'created actual result',
        origin: { kind: 'execution', sessionId: session.id, runId },
      });
      const creationIdentity = await stat(join(project.path, 'created.md'), { bigint: true });
      if (replacement === 'rename') {
        for (const path of ['input.md', 'created.md'])
          await app.call('files.rename', {
            projectId: project.id,
            path,
            name: `moved-${path}`,
            operationId: randomUUID(),
          });
      }
      await app.close();
      app = new ExecutionApplication(profile, options);
      await app.initialize();
      app.projects.get(project.id).database.exec('DROP TRIGGER reject_association');
      if (replacement === true) {
        await rename(join(project.path, 'input.md'), join(root, 'original-input'));
        await writeFile(join(project.path, 'input.md'), 'saved actual result');
      }
      const linked = await app.call('artifacts.reconcile', {
        projectId: project.id,
        sessionId: session.id,
        runId,
        paths: ['input.md', 'created.md'],
      });
      expect(linked[0]?.state).toBe(replacement === true ? 'unknown' : 'linked');
      expect(linked[1]?.state).toBe('linked');
      if (replacement === 'rename') {
        expect(linked[0]).toMatchObject({ path: 'moved-input.md', fileId: saved.fileId });
        expect(linked[1]).toMatchObject({
          path: 'moved-created.md',
          fileId: created.resource.ref.fileId,
        });
      }
      const checked = await app.call('resources.creation', {
        projectId: project.id,
        operationId: 'first-created-result',
      });
      expect(checked).toMatchObject({
        state: 'complete',
        resource: { ref: created.resource.ref },
        association: { state: 'confirmed' },
      });
      const createdPath = replacement === 'rename' ? 'moved-created.md' : 'created.md';
      expect((await stat(join(project.path, createdPath), { bigint: true })).ino).toBe(
        creationIdentity.ino,
      );
      expect(app.projects.get(project.id).history(createdPath)).toHaveLength(1);
      const inputPath = replacement === 'rename' ? 'moved-input.md' : 'input.md';
      if (replacement !== true)
        expect((await stat(join(project.path, inputPath), { bigint: true })).ino).toBe(
          identity.ino,
        );
      expect(app.projects.get(project.id).history(inputPath)).toHaveLength(2);
    } finally {
      model.release();
      await app.close();
      await model.close();
    }
  });
}

test('cancelling an owned view stops only its parsing and preserves delivery checks for other views', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-cancel-'));
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  const pending: { release: () => void }[] = [];
  const context: CallContext = {
    moduleId: 'product',
    role: 'product',
    principal: { kind: 'human', id: 'reader' },
  };
  const access = new ResourceAccess(
    () => ({
      project: {
        'files.resolve': (input) => app.call('files.resolve', input),
        'files.read': (input) => app.call('files.read', input),
        'files.readBytes': (input) => app.call('files.readBytes', input),
        'project.material': (input) => app.projects.get(input.projectId).material(input.path),
        'project.saveFile': (input) =>
          app.projects
            .get(input.projectId)
            .save(input.path, input.content, input.basis, undefined, input.expectedFileId),
      },
      library: {} as ResourceLibraryPort,
    }),
    {
      // Only scheduling is substituted; identity, bytes and delivery checks use the real project.
      run: async (_load, _format, _method, _input, options) => {
        await new Promise<void>((resolve, reject) => {
          const abort = () => reject(new Error('cancelled'));
          options.signal?.addEventListener('abort', abort, { once: true });
          pending.push({
            release: () => {
              options.signal?.removeEventListener('abort', abort);
              resolve();
            },
          });
        });
        await options.verify();
        return { pageCount: 2 };
      },
    },
  );
  try {
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await writeFile(join(project.path, 'paper.pdf'), syntheticPdf());
    const resource = await access.describe(
      { source: 'project', projectId: project.id, path: 'paper.pdf' },
      context,
    );
    const start = (requestId: string) =>
      access
        .document(
          {
            ref: resource.ref,
            basis: resource.basis,
            requestId,
            request: { method: 'pdfInfo', input: {} },
          },
          context,
        )
        .then(
          (result) => ({ result }),
          (error: unknown) => ({ error }),
        );
    const first = start('view-a');
    const second = start('view-b');
    await expect.poll(() => pending.length).toBe(2);
    assert.throws(
      () => access.cancel('view-a', { ...context, principal: { kind: 'human', id: 'other' } }),
      (error: unknown) =>
        !!error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'permissionDenied',
    );
    access.cancel('view-a', context);
    expect(await first).toMatchObject({ error: { code: 'shuttingDown' } });
    pending[1]?.release();
    expect(await second).toMatchObject({ result: { pageCount: 2 } });
    const third = start('view-c');
    await expect.poll(() => pending.length).toBe(3);
    await writeFile(join(project.path, 'paper.pdf'), 'changed during parsing');
    pending[2]?.release();
    expect(await third).toMatchObject({ error: { code: 'contentChanged' } });
  } finally {
    for (const request of pending) request.release();
    await app.close();
  }
});

test('common resources preserve ownership, text offsets, conditional saves and library authority without a harness', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-'));
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  try {
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    assert(!('harness' in app));
    await app.call('files.save', { projectId: project.id, path: 'note.md', content: '中😀文\n' });
    const descriptor = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'note.md' },
    });
    expect(descriptor).toMatchObject({
      format: 'text',
      capabilities: { write: true, readingRecords: false },
    });
    expect(JSON.stringify(descriptor)).not.toContain('nativePath');
    const text = await app.call('resources.read', {
      ref: descriptor.ref,
      basis: descriptor.basis,
      encoding: 'utf8',
      offset: 1,
      limit: 2,
    });
    expect(text).toMatchObject({ data: '😀', unit: 'utf16', nextOffset: 3 });
    const bytes = await app.call('resources.read', {
      ref: descriptor.ref,
      basis: descriptor.basis,
      encoding: 'base64',
      offset: 0,
      limit: 3,
    });
    expect(bytes.unit).toBe('byte');
    expect(Buffer.from(bytes.data, 'base64').toString('utf8')).toBe('中');
    const updated = await app.call('resources.save', {
      ref: descriptor.ref,
      basis: descriptor.basis,
      content: '已保存\n',
    });
    expect(await readFile(join(project.path, 'note.md'), 'utf8')).toBe('已保存\n');
    expect(
      await app.call('resources.read', {
        ref: updated.ref,
        basis: updated.basis,
        encoding: 'utf8',
      }),
    ).toMatchObject({ data: '已保存\n' });
    await expect(
      app.call('resources.save', {
        ref: descriptor.ref,
        basis: descriptor.basis,
        content: '过期草稿',
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    if (updated.ref.source !== 'project') throw new Error('wrong source');
    await app.call('files.rename', {
      projectId: project.id,
      path: 'note.md',
      name: 'moved.md',
      operationId: randomUUID(),
      expectedFileId: updated.ref.fileId,
    });
    const moved = await app.call('resources.describe', { locator: updated.ref });
    expect(moved.ref).toEqual(updated.ref);
    expect(moved.path).toBe('moved.md');
    await expect(
      app.resources.describe(updated.ref, {
        moduleId: 'test',
        principal: { kind: 'agent', id: 'test' },
        role: 'execution',
        projectId: 'different',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });

    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const path = join(root, 'library.md');
    await writeFile(path, '# Library readonly\n');
    const batch = await app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      storage: 'linked',
      purpose: '正文',
      version: 'unspecified',
      origin: 'resource-test',
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await app.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.attachmentId);
    const attachment = await app.call('library.attachment', { attachmentId: receipt.attachmentId });
    const library = await app.call('resources.describe', {
      locator: {
        source: 'library',
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      },
    });
    expect(library.capabilities).toMatchObject({ write: false, readingRecords: true });
    expect(
      (
        await app.call('resources.read', {
          ref: library.ref,
          basis: library.basis,
          encoding: 'utf8',
        })
      ).data,
    ).toContain('Library readonly');
    await expect(
      app.call('resources.save', { ref: library.ref, basis: library.basis, content: 'bad write' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    await expect(
      app.call('resources.read', { ref: library.ref, basis: library.basis, encoding: 'utf8' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await writeFile(path, 'changed linked material');
    await expect(
      app.call('resources.read', { ref: library.ref, basis: library.basis, encoding: 'base64' }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
  } finally {
    await app.close();
  }
});

for (const source of ['project', 'library'] as const) {
  test(`${source} UTF8 ranges reach known long tails and reject invalid or oversized bytes`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-text-'));
    const app = new ManualApplication(join(root, 'profile'));
    await app.initialize();
    try {
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'restricted',
      });
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      const describe = async (name: string, bytes: Buffer) => {
        const path = join(project.path, name);
        await writeFile(path, bytes);
        if (source === 'project')
          return app.call('resources.describe', {
            locator: { source, projectId: project.id, path: name },
          });
        const batch = await app.call('library.importFiles', {
          batchId: randomUUID(),
          paths: [path],
          storage: 'linked',
          purpose: '正文',
          version: 'unspecified',
          origin: 'resource-text-test',
        });
        await expect
          .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
          .toBe('completed');
        const entry = (await app.call('library.batch', { batchId: batch.id })).entries[0];
        assert(entry?.attachmentId);
        const attachment = await app.call('library.attachment', {
          attachmentId: entry.attachmentId,
        });
        return app.call('resources.describe', {
          locator: {
            source,
            attachmentId: attachment.id,
            materialVersionId: attachment.materialVersionId,
          },
        });
      };
      const content = `${'a'.repeat(262143)}😀中\n${'b'.repeat(64)}独立尾段 Ω\n`;
      const resource = await describe('long.md', Buffer.from(content));
      const read = (offset: number, limit?: number) =>
        app.call('resources.read', {
          ref: resource.ref,
          basis: resource.basis,
          encoding: 'utf8',
          offset,
          ...(limit === undefined ? {} : { limit }),
        });
      const prefix = await read(0);
      expect(prefix).toMatchObject({
        size: content.length,
        nextOffset: 262144,
        truncated: false,
        unit: 'utf16',
      });
      expect(prefix.data).toHaveLength(262144);
      expect(await read(262143, 4)).toMatchObject({
        data: '😀中\n',
        nextOffset: 262147,
        size: content.length,
      });
      const tail = await read(262211);
      expect(tail).toMatchObject({
        ref: resource.ref,
        basis: resource.basis,
        data: '独立尾段 Ω\n',
        offset: 262211,
        size: content.length,
        truncated: false,
      });
      expect(tail.nextOffset).toBeUndefined();
      expect(await read(content.length)).toMatchObject({ data: '', size: content.length });
      await expect(read(content.length + 1)).rejects.toMatchObject({ code: 'invalidRequest' });
      await writeFile(join(project.path, 'long.md'), `${content}changed`);
      await expect(read(262211)).rejects.toMatchObject({ code: 'contentChanged' });
      for (const [name, bytes] of [
        ['invalid.md', Buffer.concat([Buffer.alloc(262144, 0x61), Buffer.from([0xff])])],
        ['incomplete.md', Buffer.from([0x61, 0xe2, 0x82])],
        ['nul.md', Buffer.from([0x61, 0, 0x62])],
        ['oversized.md', Buffer.alloc(8 * 1024 * 1024 + 1, 0x61)],
      ] as const) {
        const invalid = await describe(name, bytes);
        await expect(
          app.call('resources.read', {
            ref: invalid.ref,
            basis: invalid.basis,
            encoding: 'utf8',
            limit: 1,
          }),
        ).rejects.toMatchObject({ code: name === 'oversized.md' ? 'tooLarge' : 'invalidRequest' });
        const raw = await app.call('resources.read', {
          ref: invalid.ref,
          basis: invalid.basis,
          encoding: 'base64',
          offset: bytes.length - 1,
          limit: 1,
        });
        expect(Buffer.from(raw.data, 'base64')).toEqual(bytes.subarray(-1));
        expect(raw).toMatchObject({ size: bytes.length, unit: 'byte', truncated: false });
        expect(raw.nextOffset).toBeUndefined();
      }
      if (source === 'project') {
        const maximum = await describe('maximum.md', Buffer.alloc(8 * 1024 * 1024, 0x61));
        const result = await app.call('resources.read', {
          ref: maximum.ref,
          basis: maximum.basis,
          encoding: 'utf8',
          offset: 8 * 1024 * 1024 - 4,
        });
        expect(result).toMatchObject({ data: 'aaaa', size: 8 * 1024 * 1024, truncated: false });
        expect(result.nextOffset).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });
}

for (const invalidation of ['change', 'revoke', 'cancel'] as const) {
  test(`UTF8 snapshot rejects ${invalidation} between real library byte ranges`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-text-race-'));
    const app = new ManualApplication(join(root, 'profile'));
    await app.initialize();
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const controller = new AbortController();
    let reading: Promise<unknown> | undefined;
    try {
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      const path = join(root, 'long.md');
      await writeFile(path, `${'x'.repeat(262144)}独立尾段`);
      const batch = await app.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [path],
        storage: 'linked',
        purpose: '正文',
        version: 'unspecified',
        origin: 'resource-text-race',
      });
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const entry = (await app.call('library.batch', { batchId: batch.id })).entries[0];
      assert(entry?.attachmentId);
      const attachment = await app.call('library.attachment', { attachmentId: entry.attachmentId });
      const resource = await app.call('resources.describe', {
        locator: {
          source: 'library',
          attachmentId: attachment.id,
          materialVersionId: attachment.materialVersionId,
        },
      });
      // Only the byte delivery timing is controlled; library identity, bytes and grants are real.
      const access = new ResourceAccess(
        () => ({
          project: {} as ResourceProjectPort,
          library: {
            'library.readAttachment': async (input) => {
              const value = await app.call('library.readAttachment', input);
              if (input.limit !== 1 && (input.offset ?? 0) === 0) {
                entered();
                await held;
              }
              return value;
            },
          } as ResourceLibraryPort,
        }),
        {
          run: async () => {
            throw new Error('unused parser');
          },
        },
      );
      reading = access.read(
        { ref: resource.ref, basis: resource.basis, encoding: 'utf8', offset: 262144 },
        {
          moduleId: 'test',
          role: 'product',
          principal: { kind: 'human', id: 'reader' },
          signal: controller.signal,
        },
      );
      const rejected = expect(reading).rejects.toMatchObject(
        invalidation === 'cancel'
          ? { name: 'AbortError' }
          : { code: invalidation === 'change' ? 'contentChanged' : 'permissionDenied' },
      );
      await waiting;
      if (invalidation === 'change') await writeFile(path, 'changed');
      else if (invalidation === 'revoke')
        await app.call('library.grant', {
          read: false,
          write: false,
          send: false,
          autoBackup: false,
        });
      else controller.abort();
      release();
      await rejected;
    } finally {
      release();
      await reading?.catch(() => {});
      await app.close();
    }
  });
}

test('project and library PDF, EPUB and HTML share parsing payloads and bounded content', async () => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-docs-'));
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  try {
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const fixtures = [
      ['paper.pdf', syntheticPdf()],
      ['paper.epub', epubFixture(3)],
      ['paper.html', htmlFixture],
    ] as const;
    for (const [name, bytes] of fixtures) {
      await writeFile(join(project.path, name), bytes);
      const resource = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: name },
      });
      const batch = await app.call('library.importProjectFiles', {
        batchId: randomUUID(),
        projectId: project.id,
        projectPaths: [name],
        purpose: '正文',
        version: 'unspecified',
        origin: 'resource-test',
      });
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const receipt = (await app.call('library.batch', { batchId: batch.id })).entries[0];
      assert(receipt?.attachmentId);
      const attachment = await app.call('library.attachment', {
        attachmentId: receipt.attachmentId,
      });
      const library = await app.call('resources.describe', {
        locator: {
          source: 'library',
          attachmentId: attachment.id,
          materialVersionId: attachment.materialVersionId,
        },
      });
      const info = (descriptor: ResourceDescriptor) =>
        app.call('resources.document', {
          ref: descriptor.ref,
          basis: descriptor.basis,
          request: name.endsWith('.pdf')
            ? { method: 'pdfInfo', input: {} }
            : { method: 'documentInfo', input: {} },
        });
      const projectInfo = await info(resource);
      expect(projectInfo).toEqual(await info(library));
      expect(JSON.stringify(projectInfo)).not.toMatch(/attachmentId|nativePath/);
      if (name.endsWith('.pdf')) {
        expect(projectInfo).toMatchObject({ pageCount: 2 });
        const page = await app.call('resources.document', {
          ref: resource.ref,
          basis: resource.basis,
          request: { method: 'readPdfPage', input: { pageIndex: 0 } },
        });
        expect(page).toMatchObject({ hasText: true });
        assert('text' in page);
        expect(page.text).toContain(PAGE_ONE_TEXT);
      } else {
        assert('sections' in projectInfo);
        const sectionId = projectInfo.sections[0]?.id;
        assert(sectionId);
        const section = await app.call('resources.document', {
          ref: resource.ref,
          basis: resource.basis,
          request: { method: 'readDocumentSection', input: { sectionId } },
        });
        expect(section).toMatchObject({ normalizationVersion: 1 });
        assert('text' in section);
        expect(section.text.length).toBeGreaterThan(0);
      }
      await writeFile(join(project.path, name), Buffer.from('changed'));
      await expect(info(resource)).rejects.toMatchObject({ code: 'contentChanged' });
    }
  } finally {
    await app.close();
  }
});
