// Drive an independent PDF view through the domain interface while the isolated host runs.
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient, ensure} from './rpc-client.mjs';
import {openLiterature} from './literature-interface.mjs';
import {runReaderExperiment} from './reader-browser.mjs';
const arg = process.argv.find(arg => arg.startsWith('--output-dir='));
if (!arg) throw Error('Use --output-dir=<scratch directory>');
const outputDir = resolve(arg.slice('--output-dir='.length));
const lifecycle = createClient(outputDir);
let capability, ready;
try {
  ready = await lifecycle.connect(90000);
  await writeFile(join(outputDir, 'identity-bindings.json'), JSON.stringify({libraryId: randomUUID(),
    source: {id: randomUUID(), providerRef: ready.itemRef}, material: {id: randomUUID(), providerRef: ready.attachmentRef}}, null, 2));
  capability = await openLiterature(outputDir, 'reader-agent-results.json');
  const initial = await capability.literature.readNavigation(capability.materialId);
  await writeFile(join(outputDir, 'reader-initial-navigation.json'), JSON.stringify(initial, null, 2));
  await writeFile(join(outputDir, 'reader-ready.json'), JSON.stringify({outputDir, browserDriver: 'reader-browser.mjs', initialBookmarkId: initial.bookmarks[0].id}, null, 2));
  console.log(`Reader browser ready: ${outputDir}`);
  // Reuse the installed browser tool's library and cached Chromium; never install here.
  const playwrightModule = process.argv.find(arg => arg.startsWith('--playwright-module='))?.slice('--playwright-module='.length)
    || join(dirname(process.execPath), '../lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs');
  const {chromium} = await import(pathToFileURL(playwrightModule).href);
  const packageInfo = JSON.parse(await readFile(join(dirname(playwrightModule), 'package.json'), 'utf8'));
  const executablePath = process.argv.find(arg => arg.startsWith('--browser-executable='))?.slice('--browser-executable='.length);
  const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  let completion;
  try {
    await writeFile(join(outputDir, 'browser-baseline.json'), JSON.stringify({playwrightVersion: packageInfo.version,
      playwrightModule, browserVersion: browser.version(), executable: executablePath || chromium.executablePath()}, null, 2));
    completion = await runReaderExperiment(await browser.newPage({viewport: {width: 1100, height: 850}}), outputDir);
  } finally {
    await browser.close();
  }
  await lifecycle.check('independent-pdf-view-interaction', async () => {
    ensure(completion && !completion.fatal && completion.checks.every(check => check.status === 'passed'), 'Browser interaction failed or timed out');
    return {checks: completion.checks, pdfjsVersion: completion.pdfjsVersion};
  });
  await lifecycle.check('agent-observes-browser-bookmark-edit', async () => {
    const current = await capability.literature.readNavigation(capability.materialId);
    const changed = current.bookmarks.find(bookmark => bookmark.id === initial.bookmarks[0].id);
    ensure(changed?.title === completion.renamedTitle && changed.title !== initial.bookmarks[0].title
      && current.sourceId === initial.sourceId && current.materialId === initial.materialId
      && JSON.stringify(changed.location) === JSON.stringify(initial.bookmarks[0].location), 'Bookmark edit lost identity or location');
    return current;
  });
  await lifecycle.check('original-reader-reopens-saved-bookmark', async () => {
    const result = await lifecycle.rpc('verifyRenamedBookmark', {ref: ready.attachmentRef,
      bookmarkId: initial.bookmarks[0].id, title: completion.renamedTitle});
    ensure(result.uiTitlePresent && result.sidecarTitle === completion.renamedTitle, 'Original Reader differs from saved bookmark');
    return result;
  });
} catch (error) {lifecycle.report.fatal = {message: error.message, stack: error.stack}; process.exitCode = 1; console.error(`Reader failed: ${error.message}`);}
finally {
  if (capability) await capability.finish({shutdown: false});
  if (ready) {
    try {await lifecycle.rpc('snapshot', {ref: ready.itemRef});} catch (error) {lifecycle.report.readbackError = error.message;}
  }
  await lifecycle.finish();
}
