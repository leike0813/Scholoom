import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { executeDocument } from '../../packages/library/dist/document-parser.js';
import { zipFixture } from '../document-fixture.js';

function book(chapters: string[]) {
  return zipFixture([
    {
      name: 'META-INF/container.xml',
      data: '<container><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></container>',
    },
    {
      name: 'book.opf',
      data: `<package version="3.0"><metadata/><manifest>${chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`,
    },
    ...chapters.map((data, i) => ({ name: `c${i}.xhtml`, data })),
  ]);
}
const reference = { attachmentId: 'synthetic', materialVersionId: 'v1' };

test('bounded search reports incomplete coverage before the last chapter and resumes without lost matches', async () => {
  const bytes = book(
    Array.from(
      { length: 18 },
      (_, i) => `<html><body><p>${i === 17 ? 'needle 73' : 'ordinary text'}</p></body></html>`,
    ),
  );
  const request = {
    kind: 'document' as const,
    format: 'epub' as const,
    method: 'library.searchDocument' as const,
    input: { ...reference, query: 'needle' },
  };
  const first = await executeDocument(bytes, request);
  assert('hits' in first && first.nextCursor);
  expect(first).toMatchObject({ hits: [], complete: false, nextCursor: { sectionIndex: 16 } });
  expect(
    await executeDocument(bytes, {
      ...request,
      input: { ...request.input, cursor: first.nextCursor },
    }),
  ).toMatchObject({ hits: [{ sectionId: 'c17.xhtml' }], complete: true });
});

test('dense markup continues within node budgets while text-only reads preserve the same canonical text', async () => {
  const expected = `${'abcd'.repeat(5000)}\n`;
  const bytes = Buffer.from(`<p>${'<span>abcd</span>'.repeat(5000)}</p>`);
  const input = { ...reference, sectionId: 'document', limit: 32768 };
  const request = {
    kind: 'document' as const,
    format: 'html' as const,
    method: 'library.readDocumentSection' as const,
    input,
  };
  let offset = 0;
  let actual = '';
  for (;;) {
    const part = await executeDocument(bytes, { ...request, input: { ...input, offset } });
    assert('nodes' in part);
    expect(part.nodes.length).toBeLessThanOrEqual(4096);
    actual += part.text;
    if (part.nextOffset === undefined) break;
    expect(part.nextOffset).toBeGreaterThan(offset);
    offset = part.nextOffset;
  }
  expect(actual).toBe(expected);
  const textOnly = await executeDocument(bytes, {
    ...request,
    input: { ...input, textOnly: true },
  });
  expect(textOnly).toMatchObject({ text: expected, nodes: [] });
});

test('XML external entities never expose local file content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-document-entity-'));
  const path = join(root, 'secret.txt');
  await writeFile(path, 'synthetic_secret_91');
  const bytes = book([
    `<!DOCTYPE html [<!ENTITY leak SYSTEM "${pathToFileURL(path).href}">]><html><body><p>&leak;</p></body></html>`,
  ]);
  try {
    const value = await executeDocument(bytes, {
      kind: 'document',
      format: 'epub',
      method: 'library.readDocumentSection',
      input: { ...reference, sectionId: 'c0.xhtml' },
    });
    expect(JSON.stringify(value)).not.toContain('synthetic_secret_91');
  } catch (error) {
    expect(error).toMatchObject({ code: 'invalidRequest' });
  }
});

test('encoding declarations are read from markup rather than ordinary research prose', async () => {
  const result = await executeDocument(Buffer.from('<p>charset=not_an_encoding; 中文</p>'), {
    kind: 'document',
    format: 'html',
    method: 'library.readDocumentSection',
    input: { ...reference, sectionId: 'document' },
  });
  expect(result).toMatchObject({ text: 'charset=not_an_encoding; 中文\n' });
});
