// Independent Node client for the throwaway Gecko IPC experiment.
import {writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient, ensure} from './rpc-client.mjs';

const arg = process.argv.find(arg => arg.startsWith('--output-dir='));
if (!arg) throw new Error('Use --output-dir=<scratch run directory>');
const outputDir = resolve(arg.slice('--output-dir='.length));
const {report, connect, rpc, check, finish} = createClient(outputDir);
try {
  const ready = await connect(90000);
  const params = {ref: ready.itemRef};
  const initial = await check('independent-client-read', async () => {
    const result = await rpc('snapshot', params);
    ensure(result.mainWindowCount > 0 && result.title === result.sql.title && result.citationKey === result.sql.citationKey, 'Initial Item/SQL view differs');
    return result;
  });
  const title = 'IPC updated literature title';
  await check('client-update-same-authority', async () => {
    await rpc('updateTitle', {...params, title});
    const result = await rpc('snapshot', params);
    ensure(result.title === title && result.sql.title === title && result.ref.key === initial.ref.key, 'Updated title/identity differs');
    ensure(result.citationKey === initial.citationKey, 'Existing citation key changed');
    return result;
  });
  await check('close-real-main-windows', async () => {
    const result = await rpc('closeWindows');
    ensure(result.closedWindowCount > 0 && result.mainWindowCount === 0 && result.observedClosed, 'Main windows were not closed');
    await delay(500);
    const alive = await rpc('snapshot', params);
    ensure(alive.mainWindowCount === 0 && alive.bbtReady && alive.jasminumReady, 'Host/plugins unavailable after last window close');
    return {closed: result, alive};
  });
  const closedTitle = 'IPC updated while main window closed';
  await check('write-and-read-without-main-window', async () => {
    await rpc('updateTitle', {...params, title: closedTitle});
    const result = await rpc('snapshot', params);
    ensure(result.mainWindowCount === 0 && result.title === closedTitle && result.sql.title === closedTitle, 'Closed-window mutation not visible');
    ensure(result.citationKey === initial.citationKey, 'Closed-window mutation changed citation key');
    return result;
  });
  for (const format of ['BetterBibTeX', 'BetterBibLaTeX']) {
    await check(`closed-window-export-${format}`, async () => {
      const result = await rpc('export', {...params, format});
      // BBT applies BibTeX grouping and title casing; compare title semantics.
      const exportedTitle = result.text.match(/^\s*title\s*=\s*(.*)$/mi)?.[1]?.replace(/[{}]/g, '').toLowerCase();
      ensure(result.mainWindowCount === 0 && result.text.includes(initial.citationKey)
        && exportedTitle?.includes(closedTitle.toLowerCase()), 'Export did not reflect the current authority without main window');
      await writeFile(join(outputDir, `ipc-${format}.bib`), result.text);
      return {ref: result.ref, mainWindowCount: result.mainWindowCount, bytes: Buffer.byteLength(result.text)};
    });
  }
  await check('main-window-reconnect', async () => {
    await rpc('openWindow');
    const result = await rpc('snapshot', params);
    ensure(result.mainWindowCount > 0 && result.title === closedTitle && result.sql.title === closedTitle, 'Reopened window authority differs');
    return result;
  });
  await check('original-reader-bookmark-reconnect', async () => {
    const result = await rpc('openReader', {ref: ready.attachmentRef});
    ensure(result.bookmarkCount > 0 && result.bookmarkCount === result.sidecarBookmarkCount && result.originalAddButtonPresent, 'Original Jasminum UI did not restore bookmarks');
    return result;
  });
} catch (error) {
  report.fatal = {message: error.message, stack: error.stack};
  console.error(`IPC failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await finish();
}
