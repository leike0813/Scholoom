import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ResourceAccess } from '../../packages/editor/dist/node.js';
import type {
  CallContext,
  ResourceDescriptor,
  ResourceLibraryPort,
} from '../../packages/protocol/dist/index.js';
import { epubFixture, htmlFixture } from '../document-fixture.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

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
