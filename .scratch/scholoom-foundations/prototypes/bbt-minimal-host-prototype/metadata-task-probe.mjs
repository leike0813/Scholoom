// Original taskRunner search/translate with protocol-level inputs; never construct searchResult.
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function probeMetadataTask({ page, store, Zotero, ids, runDir, evidence, trace }) {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/pubscholar-protocol.json', import.meta.url), 'utf8'));
  const article = fixture.response.content[0];
  const pdf = path.join(runDir, `${article.title}.pdf`);
  const originalPDF = readFileSync('/tmp/scholoom-host-prototype-assets-1bmhDr/fixture-check.pdf');
  await fs.writeFile(pdf, originalPDF);
  const fields = { itemType: 'attachment', title: article.title, path: pdf, filename: path.basename(pdf), contentType: 'application/pdf', tags: [] };
  const id = store.add('source-metadata-pdf', 'METAPDF1', fields);
  const dto = itemID => { const item = store.get(itemID); return { ...store.read(item.sourceID), key: item.key, libraryID: 1 }; };
  const data = evidence.metadata = { inputKind: fixture.inputKind, attachmentBefore: store.read('source-metadata-pdf'), http: [], ris: [], verified: {} };
  const risPath = process.env.SCHOLOOM_RIS_TRANSLATOR ?? '/tmp/scholoom-host-prototype-8T6DGE/data/translators/RIS.js';
  const originalRIS = readFileSync(risPath);
  const source = originalRIS.toString('utf8');
  const headerEnd = source.indexOf('\n}\n') + 2;
  const header = JSON.parse(source.slice(0, headerEnd));
  data.translator = { path: risPath, translatorID: header.translatorID, lastUpdated: header.lastUpdated };
  await fs.writeFile(path.join(runDir, 'RIS.js'), originalRIS);
  let responseCase = 'empty';
  await page.exposeFunction('metadataHTTP', async ({ method, url, options }) => {
    const response = responseCase === 'empty' ? { content: [] } : fixture.response;
    const request = { case: responseCase, method, url, body: JSON.parse(options.body), response };
    data.http.push(request);
    trace({ type: 'metadata-http', method, url, body: request.body, inputKind: fixture.inputKind });
    if (method !== 'POST' || url !== 'https://pubscholar.cn/hky/open/resources/api/v1/articles') throw new Error('Unexpected metadata HTTP endpoint');
    return { status: 200, responseText: JSON.stringify(response), responseURL: url };
  });
  await page.exposeFunction('metadataRISTrace', entry => { data.ris.push(entry); trace({ type: 'metadata-ris-import', ...entry }); });
  await page.evaluate(({ header, body }) => {
    const fields = new Set(['title','date','publicationTitle','volume','issue','pages','DOI','abstractNote','url','accessDate','journalAbbreviation','extra','language','ISSN']);
    const registry = new Map([[header.translatorID, { header, body }]]);
    Zotero.ItemFields = { getFieldIDFromTypeAndBase: (_typeID, field) => fields.has(field) ? field : false };
    Zotero.Translate = { Import: class {
      setTranslator(id) { this.translatorID = id; }
      setString(text) { this.text = text; }
      async translate(options) {
        const resource = registry.get(this.translatorID);
        if (!resource) {
          await window.metadataRISTrace({ translatorID: this.translatorID, text: this.text, options, outcome: 'translator-not-found' });
          const error = new Error('Requested translator is not registered'); error.code = 'TRANSLATOR_NOT_FOUND'; throw error;
        }
        const rows = this.text.split(/\r?\n/);
        let cursor = 0;
        const completed = [];
        const utilities = {
          fieldIsValidForType: (field, type) => type === 'journalArticle' && fields.has(field),
          deepCopy: structuredClone,
          unescapeHTML: text => new DOMParser().parseFromString(text, 'text/html').documentElement.textContent,
          cleanDOI: value => value.match(/10\.[^\s/]+\/\S+/)?.[0] ?? false,
          strToDate: text => { const match = text.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/); if (!match) throw new Error('Date outside import probe contract'); return { year: match[1], month: match[2] ? Number(match[2]) - 1 : undefined, day: match[3] }; },
        };
        class TranslatorItem {
          constructor(itemType) { this.itemType = itemType; this.creators = []; this.tags = []; this.notes = []; this.attachments = []; }
          async complete() { completed.push(JSON.parse(JSON.stringify(this))); }
        }
        const translatorZotero = { read: () => cursor < rows.length ? rows[cursor++] : false, Item: TranslatorItem, Utilities: utilities, debug: message => window.hostTrace({ kind: 'ris-debug', message: String(message) }), getHiddenPref: () => undefined };
        // Parse the structured translator header separately; execute its entire unmodified body.
        const translator = new Function('Zotero', 'ZU', `${resource.body}\nreturn exports;`)(translatorZotero, utilities);
        await translator.doImport();
        const saved = [];
        for (const parsed of completed) {
          const item = new Zotero.Item(parsed.itemType);
          item.libraryID = options.libraryID;
          for (const [name, value] of Object.entries(parsed)) {
            if (['itemType','creators','tags','notes','attachments'].includes(name)) continue;
            item.setField(name, value);
          }
          item.setCreators(parsed.creators);
          item.setTags(parsed.tags.map(tag => typeof tag === 'string' ? { tag, type: 0 } : tag));
          await item.saveTx();
          saved.push(item);
        }
        await window.metadataRISTrace({ translatorID: this.translatorID, text: this.text, options, outcome: 'original-doImport-completed', completed, savedIDs: saved.map(item => item.id) });
        return saved;
      }
    } };
  }, { header, body: source.slice(headerEnd) });
  const initial = ids.map(itemID => store.read(store.get(itemID).sourceID));
  const runOriginalTask = () => page.evaluate(async ({ record, taskDigest }) => {
    for (const [key, value] of Object.entries({ autoSplitName: false, autoUpdateMetadata: false, metadataSource: 'PubScholar', namePattern: '{%t}', isMainlandChina: true })) domHost.preferences.set(`extensions.jasminum.${key}`, value);
    Zotero.HTTP = { request: (method, url, options) => window.metadataHTTP({ method, url, options }) };
    Zotero.Utilities.Internal = { md5: text => { if (text !== String(record.id)) throw new Error('MD5 input outside this task'); return taskDigest; } };
    await domHost.notify({ action: 'modify', type: 'item', records: [record], extraData: {} });
    const task = Zotero.Jasminum.taskRunner.createTask(Zotero.Items.get(record.id), 'attachment', true);
    await Zotero.Jasminum.taskRunner.runTask(task);
    await domHost.drain();
    return { status: task.status, message: task.message, results: task.searchResults, parentID: task.item.parentID, id: task.id };
  }, { record: dto(id), taskDigest: createHash('md5').update(String(id)).digest('hex') });
  const rowsBeforeControl = store.db.prepare('SELECT COUNT(*) AS count FROM literature').get().count;
  data.emptyControl = await runOriginalTask();
  data.verified.noResultsControl = data.emptyControl.status === 'fail' && data.emptyControl.results.length === 0
    && data.http.length > 0 && data.http.every(request => request.case === 'empty' && request.response.content.length === 0) && data.ris.length === 0
    && store.db.prepare('SELECT COUNT(*) AS count FROM literature').get().count === rowsBeforeControl
    && JSON.stringify(store.read('source-metadata-pdf')) === JSON.stringify(data.attachmentBefore);
  responseCase = 'matched';
  data.task = await runOriginalTask();
  data.attachmentAfter = store.read('source-metadata-pdf');
  const parentID = data.attachmentAfter.fields.parentID;
  data.parent = parentID ? store.read(store.get(parentID).sourceID) : null;
  data.verified.originalTaskSucceeded = data.task.status === 'success';
  data.verified.originalSearchRequested = data.http.length > 0 && data.http.every(request => request.body.query.includes(article.title));
  data.verified.originalSearchSelected = data.task.results.length === 1 && data.task.results[0].articleID === article.id && data.task.results[0].source === 'PubScholar';
  data.verified.originalRISGenerated = data.ris.length === 1 && data.ris[0].text.includes(`T1  - ${article.title}`) && data.ris[0].text.includes(`DO  - ${article.doi}`);
  data.verified.originalRegistryMissObserved = data.ris[0]?.outcome === 'translator-not-found' && data.ris[0].translatorID !== header.translatorID;
  data.verified.originalFallbackStored = data.parent?.fields.title === article.title && data.parent?.fields.DOI === article.doi && data.parent?.fields.pages === '10-18' && data.parent?.fields.creators.length === 2;
  data.verified.attachmentRelationSaved = !!parentID && store.get(parentID).getAttachments().includes(id);
  data.verified.pdfUnchanged = readFileSync(pdf).equals(originalPDF) && data.attachmentBefore.id === data.attachmentAfter.id && data.attachmentBefore.fields.path === data.attachmentAfter.fields.path;
  if (parentID) {
    await Zotero.BetterBibTeX.KeyManager.fill([parentID]);
    data.parent = store.read(store.get(parentID).sourceID);
    const output = await Zotero.BetterBibTeX.Translators.exportItems({ translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID, scope: { type: 'items', items: [store.get(parentID)] }, displayOptions: { worker: true } });
    await fs.writeFile(path.join(runDir, 'metadata-parent.bib'), output);
    data.verified.bbtExportsAuthority = output.includes(article.title) && output.includes(article.doi) && output.includes(data.parent.fields.citationKey) && output.includes(pdf);
  } else data.verified.bbtExportsAuthority = false;
  data.verified.originalItemsUnchanged = ids.every((itemID, i) => JSON.stringify(store.read(store.get(itemID).sourceID)) === JSON.stringify(initial[i]));
  const controlIDs = await page.evaluate(async ({ translatorID, text }) => {
    const translation = new Zotero.Translate.Import();
    translation.setTranslator(translatorID);
    translation.setString(text);
    const imported = await translation.translate({ libraryID: 1, saveAttachments: false });
    await domHost.drain();
    return imported.map(item => item.id);
  }, { translatorID: header.translatorID, text: data.ris[0].text });
  data.risControl = controlIDs.map(itemID => store.read(store.get(itemID).sourceID));
  data.verified.officialRISControlImported = data.ris.at(-1).outcome === 'original-doImport-completed' && data.risControl.length === 1 && data.risControl[0].fields.title === article.title && data.risControl[0].fields.DOI === article.doi && data.risControl[0].fields.pages === '10-18';
  data.verified.originalTranslatorUnchanged = readFileSync(risPath).equals(originalRIS) && readFileSync(path.join(runDir, 'RIS.js')).equals(originalRIS);
  await fs.writeFile(path.join(runDir, 'metadata-http.json'), JSON.stringify(data.http, null, 2));
  if (data.ris[0]) await fs.writeFile(path.join(runDir, 'metadata-generated.ris'), data.ris[0].text);
  await fs.copyFile(pdf, path.join(runDir, 'metadata-fixture.pdf'));
  evidence.verified.metadataTask = Object.values(data.verified).every(Boolean);
  if (!evidence.verified.metadataTask) throw new Error('Original metadata task did not verify all business behavior');
}
