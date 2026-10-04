// Deterministic capability caller, not an LLM/harness. Calls are made through literature-interface.
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient, ensure} from './rpc-client.mjs';
import {openLiterature} from './literature-interface.mjs';
const arg = process.argv.find(arg => arg.startsWith('--output-dir='));
if (!arg) throw new Error('Use --output-dir=<scratch directory>');
const outputDir = resolve(arg.slice('--output-dir='.length));
const lifecycle = createClient(outputDir);
let capability;
let ready;
try {
  ready = await lifecycle.connect(90000);
  // Bindings contain identity only; there is no copied current metadata in this file.
  const bindings = {libraryId: randomUUID(), source: {id: randomUUID(), providerRef: ready.itemRef},
    material: {id: randomUUID(), providerRef: ready.attachmentRef}};
  await writeFile(join(outputDir, 'identity-bindings.json'), JSON.stringify(bindings, null, 2));
  capability = await openLiterature(outputDir, 'agent-client-results.json');
  const {literature, sourceId, materialId} = capability;
  const initial = await lifecycle.check('domain-read-stable-identity', async () => {
    const result = await literature.read(sourceId);
    const fixture = JSON.parse(await readFile(join(outputDir, 'chinese-fixture.json'), 'utf8'));
    ensure(result.id === sourceId && result.title === fixture.translatedItem.fields.title,
      'Initial Chinese metadata differs from the original fixture');
    return result;
  });
  const title = 'Scholoom boundary literature workflow';
  const updated = await lifecycle.check('agent-updates-same-source', async () => {
    const result = await literature.updateMetadata(sourceId, {title});
    ensure(result.id === initial.id && result.title === title && result.citationKey === initial.citationKey,
      'Domain update changed identity/key or omitted title');
    return result;
  });
  const keyed = await lifecycle.check('original-bbt-writes-citation-key', async () => {
    const result = await literature.regenerateCitationKey(sourceId);
    ensure(result.id === sourceId && result.title === updated.title && result.citationKey
      && result.citationKey !== initial.citationKey, 'Original BBT did not update the same source citation key');
    return result;
  });
  for (const format of ['bibtex', 'biblatex']) await lifecycle.check(`agent-exports-${format}`, async () => {
    const result = await literature.exportCitation(sourceId, format);
    ensure(result.sourceId === sourceId && result.text.includes(keyed.citationKey)
      && result.text.toLowerCase().includes(title.toLowerCase()), 'Export omitted current title/key');
    const fixture = JSON.parse(await readFile(join(outputDir, 'chinese-fixture.json'), 'utf8'));
    ensure(result.text.includes(fixture.translatedItem.fields.publicationTitle), 'Chinese export fields corrupted');
    await writeFile(join(outputDir, `agent-${format}.bib`), result.text);
    return {sourceId, format, bytes: Buffer.byteLength(result.text)};
  });
  const navigation = await lifecycle.check('agent-consumes-original-navigation', async () => literature.readNavigation(materialId));
  const consumer = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'workbench-client.mjs'), `--output-dir=${outputDir}`], {stdio: 'inherit'});
  const [code, signal] = await once(consumer, 'close');
  await writeFile(join(outputDir, 'workbench-process.json'), JSON.stringify({code, signal}, null, 2));
  await lifecycle.check('separate-workbench-observes-current-authority', async () => {
    ensure(code === 0, 'Workbench consumer failed');
    const state = JSON.parse(await readFile(join(outputDir, 'workbench-state.json'), 'utf8'));
    ensure(state.consumerPID !== process.pid && state.observed.id === sourceId
      && state.observed.title === keyed.title && state.observed.citationKey === keyed.citationKey,
      'Second consumer did not observe current identity/title/key');
    ensure(state.navigation.sourceId === sourceId && state.navigation.materialId === materialId
      && JSON.stringify(state.navigation) === JSON.stringify(navigation), 'Second consumer reading state differs');
    return {consumerPID: state.consumerPID, source: state.observed, navigation: state.navigation};
  });
  const final = await lifecycle.check('agent-observes-workbench-edit', async () => {
    const state = JSON.parse(await readFile(join(outputDir, 'workbench-state.json'), 'utf8'));
    const result = await literature.read(sourceId);
    ensure(result.id === sourceId && result.title === state.current.title && result.title !== keyed.title
      && result.citationKey === keyed.citationKey, 'Agent did not observe workbench edit on same source');
    for (const value of state.exports) ensure(value.text.includes(result.citationKey)
      && value.text.toLowerCase().includes(result.title.toLowerCase()), 'Workbench export differs from final source');
    return result;
  });
  await lifecycle.check('host-item-sql-match-domain-result', async () => {
    const raw = await lifecycle.rpc('snapshot', {ref: ready.itemRef});
    ensure(raw.title === final.title && raw.sql.title === final.title && raw.citationKey === final.citationKey
      && raw.sql.citationKey === final.citationKey, 'Native Item/SQL differs from domain result');
    return raw;
  });
} catch (error) {
  lifecycle.report.fatal = {message: error.message, stack: error.stack};
  console.error(`Boundary failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (capability) await capability.finish({shutdown: false});
  if (ready && !lifecycle.report.requests.some(request => request.method === 'snapshot' && request.body?.ok)) {
    try {await lifecycle.rpc('snapshot', {ref: ready.itemRef});}
    catch (error) {lifecycle.report.readbackError = error.message;}
  }
  await lifecycle.finish();
}
