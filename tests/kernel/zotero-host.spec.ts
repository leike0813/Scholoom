import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { inspectKernel, serveKernel, stopKernel } from '../../apps/kernel/dist/lifecycle.js';
import type { IsolatedZotero } from '../../apps/kernel/dist/zotero.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { createModelServer } from '../model-server.js';

test.skip(process.platform !== 'linux', 'Bounded Linux managed Electron calibration');
const xpi = process.env.SCHOOLOOM_BBT_XPI;
test.skip(!xpi, 'Supply the unchanged local BBT 9.0.68 release');

async function fixture(
  options: ConstructorParameters<typeof KernelApplication>[1] = {},
  count = 3,
) {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-library-bbt-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: directory });
  const packageDirectory = join(directory, 'package');
  execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
  const configuration: IsolatedZotero = {
    libraryId: '',
    packageDirectory,
    executable: '/usr/bin/xvfb-run',
    args: [
      '-a',
      createRequire(import.meta.url)('electron'),
      '--no-sandbox',
      fileURLToPath(new URL('../../apps/zotero-host/out/main/managed.cjs', import.meta.url)),
    ],
  };
  const root = join(directory, 'configuration');
  const app = new KernelApplication(root, { ...options, isolatedZotero: configuration });
  await app.initialize();
  await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const libraryId = (await app.call('library.status', {})).id;
  configuration.libraryId = libraryId;
  const instance = await app.call('library.createSourceInstance', {
    requestId: randomUUID(),
    libraryId,
    label: 'Synthetic journal source',
  });
  const batch = await app.call('library.ingest', {
    batchId: randomUUID(),
    origin: 'synthetic',
    version: 'published',
    json: JSON.stringify(
      [
        'Research agents and reproducible literature workflows',
        'Independent journal transaction',
        ...Array.from({ length: count - 3 }, (_, i) => `Additional journal ${i}`),
        'Preserved journal',
      ].map((title) => ({ title })),
    ),
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const rows = (await app.call('library.list', { limit: 100 })).sources;
  const sources = [
    'Research agents and reproducible literature workflows',
    'Independent journal transaction',
    ...Array.from({ length: count - 3 }, (_, i) => `Additional journal ${i}`),
    'Preserved journal',
  ].map((title) => {
    const source = rows.find((row) => row.metadata.title === title);
    if (!source) throw new Error('Missing synthetic journal');
    return source;
  });
  const seed = await app.call('library.commitRecords', {
    libraryId,
    requestId: randomUUID(),
    changes: sources.map((source, i) => ({
      sourceId: source.id,
      revision: source.revision,
      original: {
        identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `JRNL000${i}` },
        schemaVersion: '44',
        itemType: 'journalArticle',
        fields: {
          title: source.metadata.title,
          date: '2026',
          publicationTitle: 'Isolated Research',
          extra: 'Unrecognized preserved line',
        },
        creators: [
          { firstName: 'Ada', lastName: i === 1 ? 'Wang' : 'Chen', creatorType: 'author' },
        ],
        relations: {},
      },
      ...(i === count - 1
        ? { key: { value: 'ScholoomPreserved2026', pinned: true, intent: 'explicit' as const } }
        : {}),
    })),
  });
  expect(seed.state).toBe('committed');
  const selection = async () =>
    await Promise.all(
      sources.map((source) => app.call('library.record', { libraryId, sourceId: source.id })),
    );
  return { app, directory, root, configuration, libraryId, sources, selection };
}

test('real library/broker/managed original BBT commits missing keys once and exports both formats after restart', async () => {
  const f = await fixture({}, 100);
  try {
    const before = await f.selection();
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: before.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const result = await f.app.call('zotero.fillKeys', input);
    await writeFile(test.info().outputPath('fill.json'), JSON.stringify(result, null, 2));
    expect(result).toMatchObject({
      state: 'committed',
      notification: 'delivered',
    });
    expect(result.receipt?.results).toHaveLength(99);
    const records = await f.selection();
    expect(records.slice(0, -1).every((record) => !!record.citationKey?.value)).toBe(true);
    expect(records.at(-1)?.citationKey).toEqual({ value: 'ScholoomPreserved2026', pinned: true });
    expect(records.at(-1)).toEqual(before.at(-1));
    expect(records.slice(0, -1).map((record) => record.revision)).toEqual(
      before.slice(0, -1).map((record) => record.revision + 1),
    );
    expect(
      await f.app.call('zotero.result', { libraryId: f.libraryId, requestId: input.operationId }),
    ).toEqual(result.receipt);
    expect(await f.app.call('zotero.fillKeys', input)).toMatchObject({
      state: 'queried',
      receipt: result.receipt,
    });
    expect(await f.selection()).toEqual(records);
    for (const format of ['bibtex', 'biblatex'] as const) {
      const output = await f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: records.map(({ sourceId, revision }) => ({ sourceId, revision })),
        format,
      });
      await writeFile(test.info().outputPath(`${format}.bib`), output.text);
      expect(output.text).toContain('ScholoomPreserved2026');
      expect(output.text.toLowerCase()).toContain(
        'research agents and reproducible literature workflows',
      );
      for (const record of records)
        expect(output.text).toContain(record.citationKey?.value as string);
    }
    const first = records[0];
    if (!first?.originals[0]) throw new Error('Missing raw journal');
    const correction = await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: first.sourceId,
          revision: first.revision,
          original: {
            ...first.originals[0],
            fields: {
              ...first.originals[0].fields,
              title: 'Updated research agents after common commit',
            },
          },
        },
      ],
    });
    expect(correction.state).toBe('committed');
    const corrected = await f.selection();
    expect(corrected.map((record) => record.citationKey)).toEqual(
      records.map((record) => record.citationKey),
    );
    const refreshed = await f.app.call('zotero.export', {
      libraryId: f.libraryId,
      sources: corrected.map(({ sourceId, revision }) => ({ sourceId, revision })),
      format: 'bibtex',
    });
    expect(refreshed.text.toLowerCase()).toContain('updated research agents after common commit');
    expect(refreshed.text).toContain(first.citationKey?.value as string);
    await f.app.close();
    const serving = serveKernel(f.root, { isolatedZotero: f.configuration });
    try {
      await expect.poll(async () => (await inspectKernel(f.root)).state).toBe('running');
      const cli = fileURLToPath(new URL('../../apps/kernel/dist/cli.js', import.meta.url));
      const query = await promisify(execFile)(process.execPath, [
        cli,
        'zotero.result',
        '--data-dir',
        f.root,
        '--input',
        JSON.stringify({ libraryId: f.libraryId, requestId: input.operationId }),
      ]);
      expect(JSON.parse(query.stdout)).toEqual(result.receipt);
      const request = {
        libraryId: f.libraryId,
        sources: corrected.map(({ sourceId, revision }) => ({ sourceId, revision })),
        format: 'biblatex',
      };
      const exported = await promisify(execFile)(process.execPath, [
        cli,
        'zotero.export',
        '--data-dir',
        f.root,
        '--input',
        JSON.stringify(request),
      ]);
      expect(JSON.parse(exported.stdout).text).toContain('ScholoomPreserved2026');
    } finally {
      await stopKernel(f.root);
      await serving;
    }
  } finally {
    await f.app.close();
  }
});

test('unselected case-insensitive key collision rejects the entire real transaction; stale versions, missing mapping and revoked access refuse', async () => {
  const f = await fixture();
  try {
    const records = await f.selection();
    const first = records[0];
    const pinned = records[2];
    if (!first || !pinned) throw new Error('Missing samples');
    // Fixed original BBT default-format oracle, independently established in the H1 smoke.
    const candidate = 'chenResearchAgentsReproducible2026';
    await f.app.call('library.commitRecords', {
      libraryId: f.libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: pinned.sourceId,
          revision: pinned.revision,
          key: { value: candidate.toUpperCase(), pinned: true, intent: 'explicit' },
        },
      ],
    });
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.slice(0, 2).map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const rejected = await f.app.call('zotero.fillKeys', input);
    expect(rejected).toMatchObject({
      state: 'rejected',
      receipt: { error: { code: 'targetAmbiguous' } },
    });
    expect((await f.selection()).slice(0, 2)).toEqual(records.slice(0, 2));
    expect(
      await f.app.call('zotero.result', { libraryId: f.libraryId, requestId: input.operationId }),
    ).toEqual(rejected.receipt);
    expect(
      await f.app.call('zotero.fillKeys', { ...input, sources: input.sources.slice(0, 1) }),
    ).toMatchObject({
      state: 'queried',
      receipt: rejected.receipt,
      notification: 'notRun',
    });
    const batch = await f.app.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: 'CSL only without raw mapping' }]),
    });
    await expect
      .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const rawless = (await f.app.call('library.list', {})).sources.find(
      (source) => source.metadata.title === 'CSL only without raw mapping',
    );
    if (!rawless) throw new Error('Missing rawless sample');
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        sources: [{ sourceId: rawless.id, revision: rawless.revision }],
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        sources: [{ sourceId: first.sourceId, revision: first.revision - 1 }],
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await f.app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
    await expect(
      f.app.call('zotero.fillKeys', { ...input, operationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: [{ sourceId: pinned.sourceId, revision: pinned.revision + 1 }],
        format: 'bibtex',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      f.app.call('zotero.fillKeys', {
        ...input,
        operationId: randomUUID(),
        libraryId: 'another-library',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  } finally {
    await f.app.close();
  }
});

test('lost post-commit observation queries the real stable operation without replay or clearing unknown supervision', async () => {
  const f = await fixture();
  let armed = true;
  const detach = f.app.subscribe((change) => {
    if (armed && change.libraryChanged) {
      armed = false;
      throw new Error('isolated post-commit consumer failure');
    }
  });
  try {
    const records = await f.selection();
    const input = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    await expect(f.app.call('zotero.fillKeys', input)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    const receipt = await f.app.call('zotero.result', {
      libraryId: f.libraryId,
      requestId: input.operationId,
    });
    expect(receipt).toMatchObject({ state: 'committed', results: [{}, {}] });
    const committed = await f.selection();
    expect(await f.app.call('zotero.fillKeys', input)).toMatchObject({
      state: 'queried',
      receipt,
    });
    expect(await f.selection()).toEqual(committed);
    await expect(
      f.app.call('zotero.export', {
        libraryId: f.libraryId,
        sources: committed.map(({ sourceId, revision }) => ({ sourceId, revision })),
        format: 'bibtex',
      }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    await writeFile(
      test.info().outputPath('committed-after-unknown.json'),
      JSON.stringify({ receipt, committed }, null, 2),
    );
  } finally {
    detach();
    await f.app.close();
  }
});

for (const method of ['zotero.fillKeys', 'zotero.export'] as const) {
  test(`${method} rechecks revoked authority after snapshot acceptance`, async () => {
    const f = await fixture();
    try {
      const records = await f.selection();
      const request = {
        libraryId: f.libraryId,
        operationId: randomUUID(),
        sources: (method === 'zotero.fillKeys' ? records.slice(0, 2) : records.slice(2)).map(
          ({ sourceId, revision }) => ({ sourceId, revision }),
        ),
      };
      const pending =
        method === 'zotero.fillKeys'
          ? f.app.call(method, request)
          : f.app.call(method, {
              libraryId: request.libraryId,
              sources: request.sources,
              format: 'bibtex',
            });
      const outcome = pending.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      // The real private operation file is created after the common snapshot, before native startup.
      await expect
        .poll(
          async () => {
            try {
              return (await readdir(join(f.root, 'zotero'))).length;
            } catch {
              return 0;
            }
          },
          { intervals: [10] },
        )
        .toBeGreaterThan(0);
      await f.app.call('library.grant', {
        read: true,
        write: false,
        send: false,
        autoBackup: false,
      });
      const result = await outcome;
      expect(result).toMatchObject({
        error: { code: method === 'zotero.fillKeys' ? 'outcomeUnknown' : 'permissionDenied' },
      });
      expect(await f.selection()).toEqual(records);
      expect(
        await f.app.call('zotero.result', {
          libraryId: f.libraryId,
          requestId: request.operationId,
        }),
      ).toMatchObject({ state: 'notFound' });
    } finally {
      await f.app.close();
    }
  });
}

test('actual harness tools use the common authority and original BBT; only the external model is controlled', async () => {
  let request: {
    libraryId: string;
    operationId: string;
    sources: { sourceId: string; revision: number }[];
  };
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('fill_zotero_keys'))
        return { tool: { name: 'fill_zotero_keys', input: request } };
      const body = model.requests.at(-1);
      const fill = body ? delegationOutput(body, 'fill_zotero_keys') : undefined;
      const sources = request.sources.map((source) => ({
        ...source,
        revision:
          fill?.receipt?.results?.find(
            (result: { sourceId: string }) => result.sourceId === source.sourceId,
          )?.revision ?? source.revision,
      }));
      if (!calls.includes('export_zotero'))
        return {
          tool: {
            name: 'export_zotero',
            input: { libraryId: request.libraryId, sources, format: 'bibtex' },
          },
        };
      if (calls.filter((call) => call === 'export_zotero').length === 1)
        return {
          tool: {
            name: 'export_zotero',
            input: { libraryId: request.libraryId, sources, format: 'biblatex' },
          },
        };
      if (!calls.includes('read_zotero_result'))
        return {
          tool: {
            name: 'read_zotero_result',
            input: { libraryId: request.libraryId, requestId: request.operationId },
          },
        };
      return { text: '已取得共同回执和两个格式的导出文本。' };
    },
  });
  const f = await fixture({
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-bbt' },
  });
  try {
    const records = await f.selection();
    request = {
      libraryId: f.libraryId,
      operationId: randomUUID(),
      sources: records.map(({ sourceId, revision }) => ({ sourceId, revision })),
    };
    const project = await f.app.call('project.create', {
      path: join(f.directory, 'project'),
      trust: 'trusted',
    });
    const session = await f.app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await f.app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '核对隔离期刊补键和两个格式导出。',
      materials: [],
    });
    await expectExecutionCompleted(f.app, scope, model);
    const final = model.requests.at(-1);
    if (!final) throw new Error('No actual model requests');
    expect(delegationOutput(final, 'fill_zotero_keys')).toMatchObject({
      state: 'committed',
      notification: 'delivered',
    });
    expect(delegationOutput(final, 'read_zotero_result')).toMatchObject({ state: 'committed' });
    expect(delegationOutput(final, 'export_zotero')?.text).toContain('ScholoomPreserved2026');
    expect((await f.selection()).every((record) => !!record.citationKey)).toBe(true);
    await writeFile(
      test.info().outputPath('harness.json'),
      JSON.stringify(await f.app.snapshot(scope), null, 2),
    );
  } finally {
    await f.app.close();
    await model.close();
  }
});

test('Zotero-only model context remains subject to library send authorization across turns and restart', async () => {
  let input: { libraryId: string; sources: { sourceId: string; revision: number }[] };
  const model = await createModelServer({
    respond: ({ calls }) =>
      calls.includes('export_zotero')
        ? { text: '已核对隔离期刊导出。' }
        : { tool: { name: 'export_zotero', input: { ...input, format: 'bibtex' } } },
  });
  const options = {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-bbt' },
  };
  const f = await fixture(options);
  let app = f.app;
  try {
    const record = (await f.selection()).at(-1);
    if (!record) throw new Error('Missing fixed-key journal');
    input = {
      libraryId: f.libraryId,
      sources: [{ sourceId: record.sourceId, revision: record.revision }],
    };
    const project = await app.call('project.create', {
      path: join(f.directory, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '仅通过生态工具核对指定期刊。',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const final = model.requests.at(-1);
    if (!final) throw new Error('No actual model requests');
    expect(delegationOutput(final, 'export_zotero')?.text).toContain('ScholoomPreserved2026');
    const requests = model.requests.length;
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    for (const boundary of ['next-turn', 'restart']) {
      if (boundary === 'restart') {
        await app.close();
        app = new KernelApplication(f.root, { ...options, isolatedZotero: f.configuration });
        await app.initialize();
      }
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: `接续核查 ${boundary}`,
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20_000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(requests);
    }
  } finally {
    await app.close();
    await model.close();
  }
});
