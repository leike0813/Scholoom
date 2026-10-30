import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';

const revision = '52b619eb46416c4325306de851e5a9df99697fcb';
const prior = '/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/worker-dom-research';
const output = resolve(process.argv[2]);
assert(output.startsWith('/home/joshua/.cache/'));
const vendor = new URL('./vendor/', import.meta.url);
const treeBytes = await readFile(join(prior, 'ampproject-worker-dom-tree.json'));
const tree = JSON.parse(treeBytes);
assert.equal(tree.truncated, false);
const entries = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
const pending = [
  'src/worker-thread/index.ts',
  'src/main-thread/mutator.ts',
  'src/main-thread/nodes.ts',
  'src/main-thread/strings.ts',
  'src/main-thread/object-context.ts',
  'src/main-thread/main-thread.d.ts',
  'src/worker-thread/worker-thread.d.ts',
  'LICENSE',
  'src/third_party/html-parser/LICENSE',
];
const seen = new Set();
const manifest = [];
await mkdir(output, { recursive: true });
async function createOrVerify(path, bytes) {
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error) {
    assert.equal(error.code, 'EEXIST');
    assert.deepEqual(await readFile(path), Buffer.from(bytes));
  }
}
await createOrVerify(join(output, 'upstream-tree.json'), treeBytes);
while (pending.length) {
  const batch = pending.splice(0, 12).filter((p) => !seen.has(p));
  batch.forEach((p) => {
    seen.add(p);
  });
  const acquired = await Promise.all(
    batch.map(async (path) => {
      const entry = entries.get(path);
      assert(entry, `Missing source in fixed tree: ${path}`);
      let bytes,
        method = 'prior-cache';
      try {
        bytes = await readFile(join(prior, 'sources/ampproject/worker-dom', path));
      } catch (error) {
        assert.equal(error.code, 'ENOENT');
        method = 'fixed-raw-github';
        const response = await fetch(
          `https://raw.githubusercontent.com/ampproject/worker-dom/${revision}/${path}`,
        );
        assert.equal(response.status, 200, path);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      assert.equal(blob, entry.sha, `Fixed revision blob mismatch: ${path}`);
      const target = new URL(path, vendor);
      await mkdir(dirname(target.pathname), { recursive: true });
      await createOrVerify(target, bytes);
      return {
        path,
        bytes,
        receipt: {
          path,
          method,
          bytes: bytes.length,
          gitBlob: blob,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      };
    }),
  );
  for (const { path, bytes, receipt } of acquired) {
    manifest.push(receipt);
    if (!/\.(ts|js)$/.test(path)) continue;
    for (const match of bytes
      .toString('utf8')
      .matchAll(/(?:from\s*|import\s*|require\s*\()\s*['"]([^'"]+)['"]/g)) {
      const dependency = match[1];
      assert(dependency.startsWith('.'), `Bare import: ${path}: ${dependency}`);
      const stem = posix.normalize(posix.join(posix.dirname(path), dependency));
      const found = [
        stem,
        stem.replace(/\.js$/, '.ts'),
        stem.replace(/\.js$/, '.d.ts'),
        `${stem}.ts`,
        `${stem}.d.ts`,
      ].find((p) => entries.has(p));
      assert(found, `Missing relative input: ${path}: ${dependency}`);
      if (!seen.has(found) && !pending.includes(found)) pending.push(found);
    }
  }
  console.log(`fixed source: ${manifest.length} files, ${pending.length} pending`);
}
manifest.sort((a, b) => a.path.localeCompare(b.path));
const record = {
  repository: 'ampproject/worker-dom',
  revision,
  acquiredAt: new Date().toISOString(),
  roots: [...seen].slice(0, 8),
  inputs: manifest,
};
await writeFile(join(output, 'input-manifest.json'), JSON.stringify(record, null, 2));
await writeFile(
  new URL('./upstream-manifest.json', import.meta.url),
  JSON.stringify(record, null, 2),
  { flag: 'wx' },
);
