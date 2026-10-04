// Separate process consuming the same interface. No host refs, SQL or window operations here.
import {writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {openLiterature} from './literature-interface.mjs';
import {ensure} from './rpc-client.mjs';
const arg = process.argv.find(arg => arg.startsWith('--output-dir='));
if (!arg) throw new Error('Use --output-dir=<scratch directory>');
const outputDir = resolve(arg.slice('--output-dir='.length));
const {literature, sourceId, materialId, check, finish, report} = await openLiterature(outputDir, 'workbench-client-results.json');
try {
  const observed = await check('workbench-reads-current-source', async () => literature.read(sourceId));
  const navigation = await check('workbench-reads-original-plugin-navigation', async () => {
    const result = await literature.readNavigation(materialId);
    ensure(result.sourceId === sourceId && result.available && result.outline.length && result.bookmarks.length,
      'Navigation/material unavailable');
    ensure(result.outline.every(node => node.location.page > 0)
      && result.bookmarks.every(node => node.location.page > 0), 'Missing PDF page locations');
    return result;
  });
  const current = await check('workbench-edits-through-common-interface', async () => {
    const result = await literature.updateMetadata(sourceId, {title: 'Research workflow revised in workbench'});
    ensure(result.id === observed.id && result.title !== observed.title && result.citationKey === observed.citationKey,
      'Workbench update changed identity or key');
    return result;
  });
  const exports = [];
  for (const format of ['bibtex', 'biblatex']) {
    const result = await check(`workbench-exports-${format}`, async () => {
      const value = await literature.exportCitation(sourceId, format);
      ensure(value.sourceId === sourceId && value.text.includes(current.citationKey)
        && value.text.toLowerCase().includes(current.title.toLowerCase()), 'Wrong citation export source/title');
      return value;
    });
    await writeFile(join(outputDir, `workbench-${format}.bib`), result.text);
    exports.push(result);
  }
  await writeFile(join(outputDir, 'workbench-state.json'), JSON.stringify({consumerPID: process.pid, observed, current, navigation, exports}, null, 2));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const entries = values => values.map(value => `<li>${escape(value.title)} · 第 ${escape(value.location.page)} 页</li>`).join('');
  await writeFile(join(outputDir, 'workbench-view.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文献</title><main><h1>${escape(current.title)}</h1><p>引用键：${escape(current.citationKey)}</p><p>${escape(navigation.fileName)}</p><h2>大纲</h2><ul>${entries(navigation.outline)}</ul><h2>书签</h2><ul>${entries(navigation.bookmarks)}</ul></main></html>`);
} catch (error) {
  report.fatal = {message: error.message, stack: error.stack};
  process.exitCode = 1;
} finally {await finish({shutdown: false});}
