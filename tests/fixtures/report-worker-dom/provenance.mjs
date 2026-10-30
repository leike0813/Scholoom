import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(process.argv[2]);
assert(output.startsWith('/home/joshua/.cache/'));
const vendor = fileURLToPath(new URL('./vendor/', import.meta.url));
const manifest = JSON.parse(
  await readFile(new URL('./upstream-manifest.json', import.meta.url), 'utf8'),
);
const changed = [];
await mkdir(output, { recursive: true });
for (const entry of manifest.inputs) {
  const current = await readFile(join(vendor, entry.path));
  if (createHash('sha256').update(current).digest('hex') !== entry.sha256)
    changed.push({ ...entry, current });
}
const patches = await Promise.all(
  changed.map(async (entry) => {
    let original;
    try {
      original = await readFile(
        join(
          '/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/worker-dom-research/sources/ampproject/worker-dom',
          entry.path,
        ),
      );
    } catch (error) {
      assert.equal(error.code, 'ENOENT');
      const reply = await fetch(
        `https://raw.githubusercontent.com/ampproject/worker-dom/${manifest.revision}/${entry.path}`,
      );
      assert.equal(reply.status, 200);
      original = Buffer.from(await reply.arrayBuffer());
    }
    assert.equal(createHash('sha256').update(original).digest('hex'), entry.sha256);
    const target = join(output, 'upstream', entry.path);
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, original, { flag: 'wx' });
    } catch (error) {
      assert.equal(error.code, 'EEXIST');
      assert.deepEqual(await readFile(target), original);
    }
    const diff = spawnSync(
      'git',
      ['diff', '--no-index', '--no-ext-diff', '--', target, join(vendor, entry.path)],
      { encoding: 'utf8' },
    );
    assert.equal(diff.status, 1);
    return diff.stdout
      .split(`a${target}`)
      .join(`a/${entry.path}`)
      .split(`b${join(vendor, entry.path)}`)
      .join(`b/${entry.path}`);
  }),
);
await writeFile(join(output, 'local.patch'), patches.join('\n'));
await writeFile(
  join(output, 'fork-inputs.json'),
  JSON.stringify(
    {
      revision: manifest.revision,
      inputs: await Promise.all(
        manifest.inputs.map(async (entry) => ({
          path: entry.path,
          originalSha256: entry.sha256,
          sha256: createHash('sha256')
            .update(await readFile(join(vendor, entry.path)))
            .digest('hex'),
        })),
      ),
    },
    null,
    2,
  ),
);
console.log(`Verified ${manifest.inputs.length} fixed inputs; ${patches.length} local patches`);
