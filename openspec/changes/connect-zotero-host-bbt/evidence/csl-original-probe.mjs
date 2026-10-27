// Investigation only: rebuild accepted ordinary-journal inputs in a new isolated library.
// Run after kernel/host builds: node <this file> [output parent directory]. Never opens a user library.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { KernelApplication } from '../../../../apps/kernel/dist/application.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const directory = await mkdtemp(join(process.argv[2] ?? tmpdir(), 'scholoom-csl-original-'));
console.log(`Isolated evidence: ${directory}`);
const save = (name, value) => writeFile(join(directory, name),
  typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const xpi = process.env.SCHOOLOOM_BBT_XPI ?? '/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi';
const release = JSON.parse(execFileSync('unzip', ['-p', xpi, 'manifest.json'], { encoding: 'utf8' }));
assert.equal(release.version, '9.0.68');
assert.equal(release.applications.zotero.id, 'better-bibtex@iris-advies.com');
const packageDirectory = join(directory, 'package');
execFileSync('unzip', ['-q', xpi, '-d', packageDirectory]);
const configuration = {
  libraryId: '', packageDirectory, executable: '/usr/bin/xvfb-run',
  args: ['-a', createRequire(import.meta.url)('electron'), '--no-sandbox',
    join(root, 'apps/zotero-host/out/main/managed.cjs')],
};
const samples = [
  {
    title: 'Research agents and reproducible literature workflows',
    key: 'ScholoomTitle2026', objectKey: 'CSL00001',
    metadata: { type: 'article-journal', issued: { 'date-parts': [[2026]] },
      author: [{ given: 'Ada', family: 'Chen' }], 'container-title': 'Prototype Research' },
    fields: { date: '2026', publicationTitle: 'Prototype Research' },
    creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Chen' }],
  },
  {
    title: 'Chronology and ordered creators in journal sources',
    key: 'ScholoomChronology2024', objectKey: 'CSL00002',
    metadata: { type: 'article-journal', issued: { 'date-parts': [[2024, 3, 14]] },
      author: [{ given: 'Ada', family: 'Chen' }, { given: 'Grace', family: 'Wang' }],
      translator: [{ given: 'Ming', family: 'Li' }], editor: [{ given: 'Alex', family: 'Kim' }],
      'container-title': 'Prototype Research' },
    fields: { date: '2024-03-14', publicationTitle: 'Prototype Research' },
    creators: [
      { creatorType: 'author', firstName: 'Ada', lastName: 'Chen' },
      { creatorType: 'translator', firstName: 'Ming', lastName: 'Li' },
      { creatorType: 'author', firstName: 'Grace', lastName: 'Wang' },
      { creatorType: 'editor', firstName: 'Alex', lastName: 'Kim' },
    ],
  },
];
const app = new KernelApplication(join(directory, 'configuration'), {
  isolatedZotero: configuration, environment: {},
});
const stages = [];
const receipts = [];
const operations = [];
let sources;
const ids = () => sources.map((source) => source.id);
const load = async () => Promise.all(ids().map(async (sourceId) => ({
  source: await app.call('library.get', { sourceId }),
  record: await app.call('library.record', { libraryId: configuration.libraryId, sourceId }),
  sourceHistory: await app.call('library.history', { sourceId }),
  recordHistory: await app.call('library.recordHistory', { libraryId: configuration.libraryId, sourceId }),
})));
async function capture(name) {
  const readback = await load();
  const exports = {};
  for (const format of ['bibtex', 'biblatex']) {
    const input = { libraryId: configuration.libraryId,
      sources: readback.map(({ record }) => ({ sourceId: record.sourceId, revision: record.revision,
        expression: { kind: 'zotero-original', identity: record.originals[0].identity } })), format };
    const result = await app.call('zotero.export', input);
    assert.equal(result.state, 'exported');
    exports[format] = result;
    await save(`${name}.${format}.bib`, result.text);
  }
  const stage = { name, readback, exports };
  stages.push(stage);
  await save(`${name}.json`, stage);
  console.log(`Captured ${name}: revisions ${readback.map(({ record }) => record.revision).join(',')}`);
  return stage;
}
async function update(index, metadata) {
  const current = await app.call('library.get', { sourceId: sources[index].id });
  const input = { sourceId: current.id, revision: current.revision, metadata,
    tags: current.tags, collectionIds: current.collectionIds, relatedIds: current.relatedIds };
  operations.push({ method: 'library.update', input });
  return app.call('library.update', input);
}
try {
  await app.initialize();
  await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  configuration.libraryId = (await app.call('library.status', {})).id;
  const instance = await app.call('library.createSourceInstance', {
    requestId: crypto.randomUUID(), libraryId: configuration.libraryId, label: 'CSL/original synthetic investigation',
  });
  const batch = await app.call('library.ingest', { batchId: crypto.randomUUID(),
    origin: 'synthetic accepted journal fixture', version: 'published',
    json: JSON.stringify(samples.map(({ title, metadata }) => ({ ...metadata, title }))),
  });
  const expires = Date.now() + 5000;
  while ((await app.call('library.batch', { batchId: batch.id })).batch.state !== 'completed') {
    assert(Date.now() < expires, 'Synthetic ingest did not complete within the existing bounded fixture wait');
    await setTimeout(10);
  }
  const rows = (await app.call('library.list', { limit: 100 })).sources;
  sources = samples.map((sample) => {
    const source = rows.find((row) => row.metadata.title === sample.title);
    assert(source, 'Synthetic journal missing');
    return source;
  });
  const seed = { libraryId: configuration.libraryId, requestId: crypto.randomUUID(),
    changes: sources.map((source, i) => ({ sourceId: source.id, revision: source.revision,
      original: { identity: { instanceId: instance.id, libraryLocator: 'isolated-journals', objectKey: samples[i].objectKey },
        schemaVersion: '44', itemType: 'journalArticle',
        fields: { title: samples[i].title, ...samples[i].fields,
          extra: 'Private provenance: keep exactly\nCNKICite: RAW-CNKICITE\nStatus: raw-only' },
        creators: samples[i].creators, relations: {} },
      key: { value: samples[i].key, pinned: true, intent: 'explicit' } })) };
  receipts.push(await app.call('library.commitRecords', seed));
  assert.equal(receipts[0].state, 'committed');
  operations.push({ method: 'library.commitRecords', input: seed });
  await save('input.json', { samples, operations, sourceInstance: instance });
  const baseline = await capture('baseline');
  const correctedTitle = 'Corrected title in the common catalog only';
  await update(0, { ...baseline.readback[0].source.metadata, title: correctedTitle });
  const titleOnly = await capture('title-only');
  assert.equal(titleOnly.readback[0].source.metadata.title, correctedTitle);
  assert.deepEqual(titleOnly.readback[0].record.originals, baseline.readback[0].record.originals);
  const ambiguity = { issued: { 'date-parts': [[2025, 9], [2026, 2]], circa: true },
    author: [{ literal: 'Interdisciplinary Research Consortium' },
      { given: 'Grace', family: 'Wang', 'dropping-particle': 'van', suffix: 'Jr.' }],
    translator: [{ literal: '翻译研究工作组' }] };
  await update(1, { ...titleOnly.readback[1].source.metadata, ...ambiguity });
  const cslOnly = await capture('date-authors-only');
  assert.deepEqual(cslOnly.readback[1].record.originals, baseline.readback[1].record.originals);
  for (const stage of [titleOnly, cslOnly]) for (const format of ['bibtex', 'biblatex']) {
    assert(!stage.exports[format].text.toLowerCase().includes(correctedTitle.toLowerCase()));
    assert(!stage.exports[format].text.includes('Interdisciplinary Research Consortium'));
  }
  const current = cslOnly.readback[0].record;
  const explicit = { libraryId: configuration.libraryId, requestId: crypto.randomUUID(),
    changes: [{ sourceId: current.sourceId, revision: current.revision,
      original: { ...current.originals[0], fields: { ...current.originals[0].fields, title: correctedTitle } } }] };
  operations.push({ method: 'library.commitRecords', input: explicit });
  const committed = await app.call('library.commitRecords', explicit);
  receipts.push(committed);
  assert.equal(committed.state, 'committed');
  assert.deepEqual(await app.call('library.commitResult', { libraryId: configuration.libraryId, requestId: explicit.requestId }), committed);
  const originalOnly = await capture('explicit-original-title');
  for (const format of ['bibtex', 'biblatex']) assert(originalOnly.exports[format].text.toLowerCase().includes(correctedTitle.toLowerCase()));
  const baselineKeys = baseline.readback.map(({ record }) => record.citationKey);
  for (const stage of stages) assert.deepEqual(stage.readback.map(({ record }) => record.citationKey), baselineKeys);
  assert.equal(originalOnly.readback[0].record.originals[0].fields.extra, current.originals[0].fields.extra);
  const comparison = stages.map((stage) => ({ stage: stage.name,
    revisions: stage.readback.map(({ source, record }) => ({ source: source.revision, record: record.revision })),
    originalEqualsBaseline: stage.readback.map(({ record }, i) => isDeepStrictEqual(record.originals, baseline.readback[i].record.originals)),
    recordHistoryEntries: stage.readback.map(({ recordHistory }) => recordHistory.records.length),
    keysEqualBaseline: isDeepStrictEqual(stage.readback.map(({ record }) => record.citationKey), baselineKeys),
    exportTextEqualsBaseline: Object.fromEntries(['bibtex', 'biblatex'].map((format) => [format, stage.exports[format].text === baseline.exports[format].text])),
  }));
  await save('result.json', { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    node: process.versions.node, platform: process.platform, directory,
    xpi: { path: xpi, version: release.version, source: 'apps/zotero-host/resources/versions.json' },
    recipe: 'tests/kernel/zotero-host.spec.ts ordinary journal inputs, reconstructed in a fresh isolated library',
    simulated: ['synthetic bibliographic content and source instance'],
    real: ['KernelApplication', 'library', 'broker', 'SQLite', 'authenticated WS', 'ManagedCommands', 'Electron', 'BBT original Worker translators'],
    comparison, operations, receipts });
  console.log(JSON.stringify(comparison, null, 2));
} catch (error) {
  await save('failure.json', { message: String(error), stack: error?.stack, completedStages: stages.map(({ name }) => name) });
  throw error;
} finally {
  await app.close();
  try { console.log(`Final supervision: ${await readFile(join(directory, 'configuration/zotero/host-supervision.json'), 'utf8')}`); }
  catch (error) { console.log(`Supervision unavailable: ${String(error)}`); }
}
