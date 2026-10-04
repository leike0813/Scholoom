// Throwaway normal-restart experiment. Browser opens only after capability checks.
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createClient, ensure} from './rpc-client.mjs';
import {openLiterature} from './literature-interface.mjs';
import {runReaderExperiment} from './reader-browser.mjs';
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const outputDir = resolve(option('output-dir'));
const resumed = option('phase') === 'resumed';
const lifecycle = createClient(outputDir);
const save = (file, value) => writeFile(join(outputDir, file), JSON.stringify(value, null, 2));
let ready, capability;
try {
  ready = await lifecycle.connect(90000);
  if (!resumed) await save('identity-bindings.json', {libraryId: randomUUID(),
    source: {id: randomUUID(), providerRef: ready.itemRef}, material: {id: randomUUID(), providerRef: ready.attachmentRef}});
  const bindings = JSON.parse(await readFile(join(outputDir, 'identity-bindings.json'), 'utf8'));
  ensure(isDeepStrictEqual(ready.itemRef, bindings.source.providerRef)
    && isDeepStrictEqual(ready.attachmentRef, bindings.material.providerRef), 'Host did not restore bound source/material');
  capability = await openLiterature(outputDir, 'restart-agent-results.json');
  const {literature, sourceId, materialId} = capability;
  const persisted = resumed ? JSON.parse(await readFile(join(outputDir, 'restart-expected.json'), 'utf8')) : null;
  const before = await lifecycle.check('capability-before-workbench-attach', async () => {
    const source = await literature.read(sourceId);
    const navigation = await literature.readNavigation(materialId);
    const material = await literature.readMaterial(materialId);
    if (persisted) {
      ensure(isDeepStrictEqual(bindings, persisted.bindings), 'Internal identity changed across restart');
      ensure(isDeepStrictEqual(source, persisted.source), 'Restart lost source metadata/citekey');
      ensure(isDeepStrictEqual(navigation, persisted.navigation), 'Restart lost bookmark/navigation');
      ensure(isDeepStrictEqual(material.bytes, persisted.materialBytes), 'Restart changed PDF bytes');
    }
    return {source, navigation, materialBytes: material.bytes, workbenchAttached: false};
  });
  await lifecycle.check('capability-updates-and-exports-before-workbench', async () => {
    const source = await literature.updateMetadata(sourceId, {title: resumed ? 'Research source updated after restart' : 'Research source saved before restart'});
    ensure(source.id === before.source.id && source.citationKey === before.source.citationKey, 'Title edit changed identity or saved citekey');
    for (const format of ['bibtex', 'biblatex']) {
      const exported = await literature.exportCitation(sourceId, format);
      ensure(exported.sourceId === sourceId && exported.text.includes(source.citationKey), 'Export lost saved citation key');
      await writeFile(join(outputDir, `restart-${format}.bib`), exported.text);
    }
    return {source, workbenchAttached: false};
  });
  const playwrightModule = option('playwright-module') || join(dirname(process.execPath), '../lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs');
  const {chromium, _electron} = await import(pathToFileURL(playwrightModule).href);
  const executablePath = option('browser-executable');
  const electronExecutable = option('electron-executable');
  const browser = electronExecutable
    ? await _electron.launch({executablePath: electronExecutable, args: ['-r', join(dirname(playwrightModule), '../playwright-core/lib/server/electron/loader.js'), join(dirname(fileURLToPath(import.meta.url)), 'restart-electron.cjs'), `--output-dir=${outputDir}`, '--no-sandbox'], timeout: 30000})
    : await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  let interaction;
  try {
    const page = electronExecutable ? await browser.firstWindow() : await browser.newPage({viewport: {width: 1100, height: 850}});
    await save('browser-baseline.json', {playwrightModule, ...(electronExecutable ? await browser.evaluate(() => ({versions: process.versions, mainPID: process.pid})) : {browserVersion: browser.version()}), executable: electronExecutable || executablePath || chromium.executablePath(), mode: electronExecutable ? 'Electron main IPC with isolated renderer' : 'Chromium driver route'});
    interaction = await runReaderExperiment(page, outputDir,
      {expectedNavigation: before.navigation, renamedTitle: resumed ? '重启后保存的书签' : '重启前保存的书签'});
    if (electronExecutable) {
      const isolation = await page.evaluate(() => ({bridge: !!window.literatureClient, nodeAvailable: typeof window.require === 'function'}));
      ensure(isolation.bridge && !isolation.nodeAvailable, 'Electron did not use isolated domain bridge');
      await save('electron-renderer-observation.json', isolation);
      await browser.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(win => win.close()));
    }
  } finally {await browser.close();}
  await lifecycle.check('workbench-attaches-edits-and-detaches', async () => {
    ensure(!interaction.fatal && interaction.checks.every(check => check.status === 'passed'), 'Reader interaction failed');
    return {checks: interaction.checks, browserClosed: true};
  });
  const final = await lifecycle.check('capability-continues-after-workbench-close', async () => {
    const source = await literature.read(sourceId);
    const navigation = await literature.readNavigation(materialId);
    const bookmark = navigation.bookmarks.find(bookmark => bookmark.id === before.navigation.bookmarks[0].id);
    ensure(bookmark?.title === interaction.renamedTitle && isDeepStrictEqual(bookmark.location, before.navigation.bookmarks[0].location), 'Bookmark identity/position lost');
    const material = await literature.readMaterial(materialId);
    ensure(isDeepStrictEqual(material.bytes, before.materialBytes), 'Bookmark edit changed material');
    const original = await lifecycle.rpc('verifyRenamedBookmark', {ref: ready.attachmentRef, bookmarkId: bookmark.id, title: bookmark.title});
    ensure(original.uiTitlePresent && original.sidecarTitle === bookmark.title, 'Original Reader does not see saved state');
    const exported = await literature.exportCitation(sourceId, 'bibtex');
    ensure(exported.text.includes(source.citationKey), 'Export after workbench close failed');
    return {source, navigation, materialBytes: material.bytes, original, workbenchAttached: false};
  });
  await save('restart-expected.json', {bindings, source: final.source, navigation: final.navigation, materialBytes: final.materialBytes});
} catch (error) {
  lifecycle.report.fatal = {message: error.message, stack: error.stack}; process.exitCode = 1;
  console.error(`Restart client failed: ${error.message}`);
} finally {
  if (capability) await capability.finish({shutdown: false});
  if (ready) {
    try {await lifecycle.rpc('snapshot', {ref: ready.itemRef});} catch (error) {lifecycle.report.readbackError = error.message; process.exitCode = 1;}
  }
  await lifecycle.finish();
}
