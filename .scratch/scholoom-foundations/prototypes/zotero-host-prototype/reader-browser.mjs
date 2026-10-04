// Invoked by the existing Playwright runtime. Route fulfillment needs no dev server.
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {openLiterature} from './literature-interface.mjs';
const root = dirname(fileURLToPath(import.meta.url));
export async function runReaderExperiment(page, outputDir, {renamedTitle = '方法核对书签', expectedNavigation} = {}) {
  const {literature, sourceId, materialId, finish} = await openLiterature(outputDir, 'reader-browser-rpc-results.json');
  const report = {checks: [], renamedTitle, startedAt: new Date().toISOString()};
  const origin = 'http://scholoom-reader.invalid';
  const requests = [];
  const route = async route => {
    const request = route.request(); const url = new URL(request.url()); requests.push({path: url.pathname, method: request.method()});
    try {
      if (url.pathname === '/api') {
        const {method, params = {}} = request.postDataJSON();
        const operations = {read: () => literature.read(sourceId), readNavigation: () => literature.readNavigation(materialId),
          readMaterial: () => literature.readMaterial(materialId), renameBookmark: () => literature.renameBookmark(materialId, params.bookmarkId, params.title)};
        if (request.method() !== 'POST' || !operations[method]) throw Error('Unknown view operation');
        return await route.fulfill({contentType: 'application/json; charset=utf-8', body: JSON.stringify(await operations[method]())});
      }
      const files = {'/': [join(root, 'reader-view.html'), 'text/html'], '/reader-view.mjs': [join(root, 'reader-view.mjs'), 'text/javascript'],
        '/pdf.mjs': [join(outputDir, 'pdfjs/pdf.mjs'), 'text/javascript'], '/pdf.worker.mjs': [join(outputDir, 'pdfjs/pdf.worker.mjs'), 'text/javascript']};
      if (!files[url.pathname]) return await route.fulfill({status: 404, body: ''});
      const [file, contentType] = files[url.pathname];
      await route.fulfill({contentType, body: await readFile(file)});
    } catch (error) {await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({error: error.message})});}
  };
  async function check(name, action) {
    try {const detail = await action(); report.checks.push({name, status: 'passed', detail}); return detail;}
    catch (error) {report.checks.push({name, status: 'failed', error: error.message}); throw error;}
  }
  try {
    await page.route(`${origin}/**`, route);
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => window.readingState?.ready || window.readingState?.error, null, {timeout: 20000});
    await check('real-pdf-two-page-render', async () => {
      const state = await page.evaluate(() => window.readingState);
      if (state.error || state.pageCount !== 2 || !state.renderedText.includes('Introduction')) throw Error(state.error || 'Initial PDF render differs');
      return {pageCount: state.pageCount, page: state.page, text: state.renderedText};
    });
    report.pdfjsVersion = await page.evaluate(async () => (await import('/pdf.mjs')).version);
    if (expectedNavigation) await check('view-connects-to-persisted-navigation', async () => {
      const current = await page.evaluate(() => window.readingState.navigation);
      if (!isDeepStrictEqual(current, expectedNavigation)) throw Error('Browser did not read expected persisted navigation');
      return current;
    });
    await check('outline-navigates-real-methods-page', async () => {
      await page.getByRole('button', {name: 'Methods', exact: true}).click();
      await page.waitForFunction(() => window.readingState.page === 2);
      const state = await page.evaluate(() => window.readingState);
      if (!state.renderedText.includes('Methods')) throw Error('PDF content did not switch with outline');
      for (const [index, key] of ['x', 'y'].entries()) if (Math.abs(state.target.roundtrip[index] - state.target.pdf[key]) > 0.001) throw Error('PDF coordinate roundtrip differs');
      await page.screenshot({path: join(outputDir, 'reader-methods-page.png')});
      return {page: state.page, text: state.renderedText, target: state.target};
    });
    const initial = await literature.readNavigation(materialId);
    await check('bookmark-navigates-original-pdf-position', async () => {
      await page.getByRole('button', {name: initial.bookmarks[0].title, exact: true}).click();
      await page.waitForFunction(() => window.readingState.page === 1);
      const state = await page.evaluate(() => window.readingState);
      if (!state.renderedText.includes('Introduction')) throw Error('Bookmark did not navigate PDF');
      return {page: state.page, target: state.target};
    });
    await check('browser-renames-bookmark-through-interface', async () => {
      await page.getByLabel('书签名称').fill(report.renamedTitle);
      await page.getByRole('button', {name: '保存书签名称', exact: true}).click();
      await page.waitForFunction(() => window.readingState.savedBookmarkId || window.readingState.error);
      const state = await page.evaluate(() => window.readingState);
      if (state.error || state.navigation.bookmarks[0].title !== report.renamedTitle) throw Error(state.error || 'Bookmark save differs');
      return state.navigation;
    });
    await check('view-reload-reads-persisted-bookmark', async () => {
      await page.reload();
      await page.waitForFunction(() => window.readingState?.ready || window.readingState?.error);
      const state = await page.evaluate(() => window.readingState);
      if (state.error || state.navigation.bookmarks[0].title !== report.renamedTitle) throw Error(state.error || 'Reload lost bookmark');
      return {navigation: state.navigation, page: state.page};
    });
    await page.screenshot({path: join(outputDir, 'reader-view.png')});
    report.resourceRequests = requests;
  } catch (error) {report.fatal = {message: error.message, stack: error.stack};}
  finally {
    await page.unroute(`${origin}/**`, route);
    await finish({shutdown: false}); report.finishedAt = new Date().toISOString();
    await writeFile(join(outputDir, 'reader-browser-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
}
