import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build, stop } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';

const root = resolve(
  '/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom',
  `html-ingestion-${Date.now()}`,
);
await mkdir(join(root, 'tmp'), { recursive: true });
console.log(`evidence: ${root}`);
const env = { PATH: process.env.PATH, TMPDIR: join(root, 'tmp') };
const commands = [];
async function run(name, args) {
  const result = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  commands.push({
    name,
    args,
    pid: result.pid,
    exit: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  await writeFile(join(root, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  return result;
}
try {
  assert.equal(
    (await run('provenance', ['tests/fixtures/report-worker-dom/provenance.mjs', root])).status,
    0,
  );
  for (const [path, name] of [
    ['LICENSE', 'worker-dom-LICENSE.txt'],
    ['src/third_party/html-parser/LICENSE', 'html-parser-LICENSE.txt'],
    ['MODIFICATIONS.md', 'worker-dom-MODIFICATIONS.md'],
  ])
    await writeFile(
      join(root, name),
      await readFile(new URL(`../report-worker-dom/vendor/${path}`, import.meta.url)),
    );
  const html = await readFile(new URL('./html-ingestion.html', import.meta.url));
  await writeFile(join(root, 'input.html'), html);
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./html-ingestion.mts', import.meta.url))],
    outfile: join(root, 'source.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    metafile: true,
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
    define: { 'process.env.SERVER': 'false', IS_AMP: 'false', WORKER_DOM_DEBUG: 'false' },
    logLevel: 'info',
  });
  stop();
  await writeFile(join(root, 'source.meta.json'), JSON.stringify(result.metafile, null, 2));
  assert.equal(
    (
      await run('types', [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '-p',
        'tests/fixtures/report-async-dom/tsconfig.json',
      ])
    ).status,
    0,
  );
  const source = await run('source', [join(root, 'source.mjs'), join(root, 'input.html'), root]);
  await writeFile(
    join(root, 'source-closed.json'),
    JSON.stringify(
      {
        pid: source.pid,
        code: source.status,
        signal: source.signal,
        closed: source.status !== null || source.signal !== null,
      },
      null,
      2,
    ),
  );
  let oracleStarted = false;
  if (source.status === 0) {
    const browser = await chromium.launch({ headless: true });
    oracleStarted = true;
    try {
      const page = await browser.newPage();
      const evidence = JSON.parse(await readFile(join(root, 'source-evidence.json'), 'utf8'));
      const native = await page.evaluate(
        (fixtures) =>
          fixtures.map((fixture) => {
            const container = document.createElementNS(fixture.namespace, fixture.tag);
            if (fixture.encoding) container.setAttribute('encoding', fixture.encoding);
            container.innerHTML = fixture.html;
            return {
              name: fixture.name,
              nodes: [...container.querySelectorAll('*')].map((node) => ({
                name: node.localName,
                namespace: node.namespaceURI,
                text: node.textContent,
                value: node instanceof HTMLInputElement ? node.value : null,
              })),
            };
          }),
        evidence.fragments,
      );
      await writeFile(join(root, 'native-oracle.json'), JSON.stringify(native, null, 2));
      assert.deepEqual(
        evidence.fragments.map(({ name, nodes }) => ({ name, nodes })),
        native,
      );
      console.log(`native fragment comparisons: ${native.length} passed`);
    } finally {
      await browser.close();
      await writeFile(
        join(root, 'native-closed.json'),
        JSON.stringify({ connected: browser.isConnected() }),
      );
    }
  }
  await writeFile(
    join(root, 'closed.json'),
    JSON.stringify(
      {
        source: {
          pid: source.pid,
          code: source.status,
          signal: source.signal,
          closed: source.status !== null || source.signal !== null,
        },
        uiStarted: false,
        browserOracleStarted: oracleStarted,
        kernelStarted: false,
        listeningPorts: [],
      },
      null,
      2,
    ),
  );
  process.exitCode = source.status ?? 1;
  console.log(`source: exit ${source.status}`);
} finally {
  stop();
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
}
