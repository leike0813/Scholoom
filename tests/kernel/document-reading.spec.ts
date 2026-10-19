import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { executeDocument } from '../../packages/library/dist/document-parser.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { epubFixture, htmlFixture, zipFixture } from '../document-fixture.js';

async function imported(
  catalog: LiteratureCatalog,
  root: string,
  name: string,
  bytes: Buffer | string,
  storage: 'managed' | 'linked' = 'managed',
) {
  const path = join(root, name);
  await writeFile(path, bytes);
  const batch = catalog.importFiles({
    batchId: randomUUID(),
    paths: [path],
    storage,
    purpose: '正文',
    version: 'unspecified',
    origin: 'synthetic-document',
  });
  await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
  const receipt = catalog.batch({ batchId: batch.id }).entries[0];
  assert(receipt?.sourceId);
  const material = (await catalog.attachments({ sourceId: receipt.sourceId })).attachments[0];
  assert(material);
  return {
    ref: { attachmentId: material.id, materialVersionId: material.materialVersionId },
    material,
    path,
  };
}

for (const version of [2, 3] as const) {
  test(`EPUB ${version} shares canonical sections, text anchors, images and durable records without a reader`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-epub-'));
    let catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    try {
      const bytes = epubFixture(version);
      const { ref, path } = await imported(catalog, root, 'paper.epub', bytes);
      const info = await catalog.document('library.documentInfo', { ...ref, limit: 1 });
      expect(info).toMatchObject({ format: 'epub', sectionCount: 2, nextOffset: 1 });
      expect(info.sections[0]).toMatchObject({ id: 'OPS/ch1.xhtml', title: '第一章' });
      const firstSection = info.sections[0];
      assert(firstSection);
      const sectionId = firstSection.id;
      const first = await catalog.document('library.readDocumentSection', {
        ...ref,
        sectionId,
        limit: 12,
      });
      assert(first.nextOffset !== undefined);
      const rest = await catalog.document('library.readDocumentSection', {
        ...ref,
        sectionId,
        offset: first.nextOffset,
      });
      const text = first.text + rest.text;
      expect(text).toContain('Scholoom 文献 evidence 42.');
      const whole = await catalog.document('library.readDocumentSection', { ...ref, sectionId });
      expect(
        whole.nodes
          .filter((n) => n.tag === 'text')
          .map((n) => n.text)
          .join(''),
      ).toBe(whole.text);
      expect(whole.nodes.some((n) => n.tag === 'strong' && n.parent >= 0)).toBe(true);
      const quote = '文献 evidence 42';
      const start = text.indexOf(quote);
      assert(start >= 0);
      const creation = {
        ...ref,
        recordId: randomUUID(),
        kind: 'highlight' as const,
        quote,
        body: '用户说明',
        location: {
          kind: 'text' as const,
          normalizationVersion: 1 as const,
          sectionId,
          start,
          end: start + quote.length,
        },
      };
      const record = await catalog.saveReadingRecord(creation);
      expect(record).toMatchObject({ createdBy: { kind: 'user' }, location: creation.location });
      await expect(
        catalog.saveReadingRecord({
          ...creation,
          recordId: randomUUID(),
          quote: quote.replace('42', '43'),
        }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      const edited = await catalog.saveReadingRecord({
        ...creation,
        expectedRevision: record.revision,
        body: '保留后续更正',
      });
      expect(await catalog.saveReadingRecord(creation)).toEqual(edited);
      await expect(
        catalog.saveReadingRecord({
          ...creation,
          expectedRevision: record.revision,
          body: '旧修订',
        }),
      ).rejects.toMatchObject({ code: 'contentChanged' });
      const hit = await catalog.document('library.searchDocument', {
        ...ref,
        query: 'result 73',
        limit: 1,
      });
      expect(hit.hits[0]).toMatchObject({ sectionId: 'OPS/ch2.xhtml' });
      assert(hit.nextCursor);
      expect(
        await catalog.document('library.searchDocument', {
          ...ref,
          query: 'result 73',
          cursor: hit.nextCursor,
        }),
      ).toMatchObject({ hits: [], complete: true });
      const second = await catalog.document('library.readDocumentSection', {
        ...ref,
        sectionId: 'OPS/ch2.xhtml',
        anchor: 'result',
      });
      expect(second.text).toContain('Second chapter result 73 😀.');
      const image = second.nodes.find((n) => n.resourceId);
      assert(image?.resourceId);
      expect(
        await catalog.document('library.readDocumentResource', {
          ...ref,
          sectionId: 'OPS/ch2.xhtml',
          resourceId: image.resourceId,
        }),
      ).toMatchObject({ mimeType: 'image/png' });
      const backup = await catalog.backup();
      await catalog.close();
      catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
      await catalog.initialize();
      expect(catalog.readingRecord(record.id)).toEqual(edited);
      const destination = join(root, 'restored');
      await catalog.restore(backup.id, destination);
      const restored = new LiteratureCatalog(destination, () => {});
      try {
        await restored.initialize();
        restored.grant({ read: true, write: false, send: false, autoBackup: false });
        expect(restored.readingRecord(record.id)).toEqual(edited);
      } finally {
        await restored.close();
      }
      expect(await readFile(path)).toEqual(bytes);
    } finally {
      await catalog.close();
    }
  });
}

test('HTML snapshots return inert structured content and only embedded raster resources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-html-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const { ref, path } = await imported(
      catalog,
      root,
      'snapshot.html',
      htmlFixture.replace('data:image/', 'DATA:image/'),
      'linked',
    );
    const document = await catalog.document('library.readDocumentSection', {
      ...ref,
      sectionId: 'document',
    });
    expect(document.text).toContain('Local HTML evidence 91.');
    expect(document.text).not.toContain('__unsafeDocument');
    expect(document.nodes.some((n) => n.tag === 'em')).toBe(true);
    expect(document.nodes.filter((n) => n.resourceId)).toHaveLength(1);
    const image = document.nodes.find((n) => n.resourceId);
    assert(image?.resourceId);
    expect(
      await catalog.document('library.readDocumentResource', {
        ...ref,
        sectionId: 'document',
        resourceId: image.resourceId,
      }),
    ).toMatchObject({ mimeType: 'image/png' });
    expect(document.nodes.filter((n) => n.tag === 'img' && !n.resourceId).length).toBeGreaterThan(
      0,
    );
    await expect(
      catalog.document('library.readDocumentResource', {
        ...ref,
        sectionId: 'document',
        resourceId: '../secret',
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    const saved = await catalog.saveReadingRecord({
      ...ref,
      recordId: randomUUID(),
      kind: 'bookmark',
      quote: '',
      body: '',
      location: { kind: 'text', normalizationVersion: 1, sectionId: 'document', start: 0, end: 0 },
    });
    const reading = catalog.document('library.readDocumentSection', {
      ...ref,
      sectionId: 'document',
    });
    catalog.grant({ read: false, write: false, send: false, autoBackup: false });
    await expect(reading).rejects.toMatchObject({ code: 'permissionDenied' });
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    await writeFile(path, '<p>new version</p>');
    await expect(catalog.document('library.documentInfo', ref)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    await rename(path, `${path}.moved`);
    await expect(catalog.document('library.documentInfo', ref)).rejects.toMatchObject({
      code: 'notFound',
    });
    expect(catalog.readingRecord(saved.id).location).toEqual(saved.location);
  } finally {
    await catalog.close();
  }
});

test('zero-length bookmarks before emoji remain valid while surrogate-splitting offsets fail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-text-boundary-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const { ref } = await imported(catalog, root, 'emoji.html', '<p>😀abc</p>');
    const create = {
      ...ref,
      recordId: randomUUID(),
      kind: 'bookmark' as const,
      quote: '',
      body: '',
      location: {
        kind: 'text' as const,
        normalizationVersion: 1 as const,
        sectionId: 'document',
        start: 0,
        end: 0,
      },
    };
    expect(await catalog.saveReadingRecord(create)).toMatchObject({ location: create.location });
    await expect(
      catalog.saveReadingRecord({
        ...create,
        recordId: randomUUID(),
        location: { ...create.location, start: 1, end: 1 },
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
  } finally {
    await catalog.close();
  }
});

test('malformed, oversized and escaping archives fail locally and the next document still reads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-document-invalid-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    for (const bytes of [
      Buffer.from('broken'),
      zipFixture([{ name: '../escape', data: 'bad' }]),
      zipFixture([
        { name: 'same', data: 'a' },
        { name: 'same', data: 'b' },
      ]),
    ]) {
      const { ref } = await imported(catalog, root, `${randomUUID()}.epub`, bytes);
      await expect(catalog.document('library.documentInfo', ref)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    }
    const oversized = await imported(
      catalog,
      root,
      'large.html',
      Buffer.alloc(8 * 1024 * 1024 + 1, 32),
    );
    await expect(catalog.document('library.documentInfo', oversized.ref)).rejects.toMatchObject({
      code: 'tooLarge',
    });
    const safe = await imported(catalog, root, 'safe.html', '<p>safe 42</p>');
    expect(
      await catalog.document('library.readDocumentSection', { ...safe.ref, sectionId: 'document' }),
    ).toMatchObject({ text: 'safe 42\n' });
  } finally {
    await catalog.close();
  }
});

test('missing optional resources preserve EPUB text and encrypted or fixed content is explicit', async () => {
  const base = [
    {
      name: 'META-INF/container.xml',
      data: '<container><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    },
    {
      name: 'book.opf',
      data: '<package version="3.0"><metadata/><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
    },
    {
      name: 'chapter.xhtml',
      data: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>safe evidence 42</p><img src="/missing.png"/><img src="bad%xx.png"/><a href="/outside">safe link label</a></body></html>',
    },
  ];
  const input = { attachmentId: 'synthetic', materialVersionId: 'v1', sectionId: 'chapter.xhtml' };
  const request = {
    kind: 'document' as const,
    format: 'epub' as const,
    method: 'library.readDocumentSection' as const,
    input,
  };
  const result = await executeDocument(zipFixture(base), request);
  expect(result).toMatchObject({ text: 'safe evidence 42\nsafe link label' });
  const encrypted = zipFixture([
    ...base,
    {
      name: 'META-INF/encryption.xml',
      data: '<encryption><EncryptedData><CipherData><CipherReference URI="chapter.xhtml"/></CipherData></EncryptedData></encryption>',
    },
  ]);
  await expect(executeDocument(encrypted, request)).rejects.toMatchObject({
    code: 'invalidRequest',
  });
  const fixed = base.map((entry) =>
    entry.name === 'book.opf'
      ? {
          ...entry,
          data: entry.data.replace(
            '<metadata/>',
            '<metadata><meta property="rendition:layout">pre-paginated</meta></metadata>',
          ),
        }
      : entry,
  );
  await expect(executeDocument(zipFixture(fixed), request)).rejects.toMatchObject({
    code: 'invalidRequest',
  });
});
