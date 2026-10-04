// Independent client: observe unmodified plugin readiness before opening actual UI.
import {writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createClient, ensure} from './rpc-client.mjs';
const arg = process.argv.find(arg => arg.startsWith('--output-dir='));
if (!arg) throw new Error('Use --output-dir=<scratch directory>');
const outputDir = resolve(arg.slice('--output-dir='.length));
const {report, connect, rpc, check, finish} = createClient(outputDir);
try {
  const ready = await connect(120000);
  const params = {ref: ready.itemRef};
  await check('cold-start-no-main-workbench', async () => {
    const initial = await rpc('snapshot', params);
    ensure(initial.mainWindowCount === 0 && ready.coldStart.mainWindowCount === 0 && !ready.coldStart.uiReadyResolved, 'Main workbench was initialized before cold observation');
    return {snapshot: initial, coldStart: ready.coldStart};
  });
  const title = 'Literature updated after cold start';
  await check('cold-native-library-write', async () => {
    await rpc('updateTitle', {...params, title});
    const result = await rpc('snapshot', params);
    ensure(result.mainWindowCount === 0 && result.title === title && result.sql.title === title, 'Cold library write not visible');
    return result;
  });
  report.preUIPluginReadiness = ready.coldStart;
  report.unverifiedBeforeUI = [];
  if (!ready.coldStart.jasminumGlobalPresent) report.unverifiedBeforeUI.push('Jasminum absent before main window; not successful cold initialization');
  if (ready.coldStart.bbtReadyResolved) {
    await check('cold-bbt-citekey', async () => {
      await rpc('pluginReady');
      const result = await rpc('snapshot', params);
      ensure(result.mainWindowCount === 0 && result.citationKey && result.citationKey === result.sql.citationKey, 'Cold citekey not visible');
      return result;
    });
    for (const format of ['BetterBibTeX', 'BetterBibLaTeX']) await check(`cold-export-${format}`, async () => {
      const result = await rpc('export', {...params, format});
      const current = await rpc('snapshot', params);
      ensure(result.mainWindowCount === 0 && result.text.includes(current.citationKey)
        && result.text.toLowerCase().includes('literature updated after cold start'), 'Cold export omitted current title/key');
      await writeFile(join(outputDir, `cold-${format}.bib`), result.text);
      return {bytes: Buffer.byteLength(result.text), ref: result.ref, mainWindowCount: result.mainWindowCount};
    });
  } else {
    report.unverifiedBeforeUI.push('BBT key generation and export: original ready unresolved within 60s observation');
  }
  await check('actual-main-window-first-open', async () => rpc('openWindow'));
  await check('jasminum-after-real-main-window', async () => rpc('retryJasminum'));
  await check('bbt-ready-after-main-window', async () => {
    const result = await rpc('pluginReady');
    ensure(result.bbtReady && result.citationKey && result.title === title, 'Original BBT not ready after actual UI');
    return result;
  });
  for (const format of ['BetterBibTeX', 'BetterBibLaTeX']) await check(`after-ui-export-${format}`, async () => {
    const result = await rpc('export', {...params, format});
    const current = await rpc('snapshot', params);
    ensure(result.text.includes(current.citationKey) && result.text.toLowerCase().includes('literature updated after cold start'), 'Export omitted current title/key');
    await writeFile(join(outputDir, `ipc-${format}.bib`), result.text);
    return {bytes: Buffer.byteLength(result.text), ref: result.ref};
  });
  await check('reader-after-first-window', async () => {
    await rpc('createBookmark');
    const result = await rpc('openReader', {ref: ready.attachmentRef});
    ensure(result.bookmarkCount > 0 && result.originalAddButtonPresent, 'Reader/bookmark unavailable after first UI');
    return result;
  });
  await check('final-authority-readback', async () => {
    const result = await rpc('snapshot', params);
    ensure(result.mainWindowCount > 0 && result.title === title && result.sql.title === title
      && result.citationKey && result.citationKey === result.sql.citationKey, 'Final authority differs after first Reader use');
    return result;
  });
} catch (error) {report.fatal = {message: error.message, stack: error.stack}; console.error(`Cold failed: ${error.message}`); process.exitCode = 1;}
finally {await finish();}
