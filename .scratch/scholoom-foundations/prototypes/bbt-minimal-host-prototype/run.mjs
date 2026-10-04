// Throwaway minimum-host experiment. No Zotero process, source rewrite or extracted algorithm.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, unlinkSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createLiteratureStore } from './literature-store.mjs';
import { createChromiumWorkers } from './chromium-worker.mjs';
import { createNotifier } from './notifier.mjs';
import { probeMutation } from './mutation-probe.mjs';
import { probeJasminum } from './jasminum-probe.mjs';
import { probeJasminumDOM } from './jasminum-dom-probe.mjs';

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const xpi = path.resolve(option('xpi') ?? '/tmp/scholoom-host-prototype-assets-1bmhDr/zotero-better-bibtex-9.0.68.xpi');
const dateFormats = option('date-formats') ?? fileURLToPath(new URL('./fixtures/dateFormats.json', import.meta.url));
const workerEngine = option('worker-engine') ?? 'node';
const scenario = option('scenario') ?? 'baseline';
if (!['baseline', 'mutation', 'jasminum', 'jasminum-dom', 'jasminum-metadata'].includes(scenario)) throw new Error('Unknown experiment scenario');
if (['jasminum-dom', 'jasminum-metadata'].includes(scenario) && workerEngine !== 'chromium') throw new Error('DOM scenarios require chromium');
if (!['node', 'chromium'].includes(workerEngine)) throw new Error('worker-engine must be node or chromium');
const originalXpi = readFileSync(xpi);
const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholoom-bbt-minimal-'));
const packageDir = path.join(runDir, 'package');
execFileSync('unzip', ['-q', xpi, '-d', packageDir]);
const manifest = JSON.parse(readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
const rootURI = pathToFileURL(`${packageDir}/`).href;
const result = {
  question: {
    baseline: 'Unchanged BBT bootstrap to keys and BibTeX export on independent literature authority, without complete Zotero',
    mutation: 'Committed literature changes through original BBT observer and cache invalidation, with no-notification negative control',
    jasminum: 'Original Jasminum startup and automatic creator-name processing on the same independent literature authority as BBT',
    'jasminum-dom': 'Original Jasminum in native Chromium DOM, notification-driven name processing and BBT export on one SQLite authority',
    'jasminum-metadata': 'Original PubScholar search and attachment metadata task, import or original fallback, shared SQLite and BBT',
  }[scenario],
  package: { xpi, version: manifest.version }, dateFormats, workerEngine, scenario, nodeVersion: process.version, runDir,
  stages: [], services: [], trace: [], blockers: [],
  verified: { startup: false, explicitFill: false, generatedKey: false, preservedKey: false, repeatedFill: false, bibtexExport: false, pluginWriteReadback: false, sqlObjectAgreement: false, persistedReadback: false, originalCodeUnchanged: false },
};
const trace = (entry) => result.trace.push(entry);
const record = (service) => { if (!result.services.includes(service)) result.services.push(service); };
const blocked = (service) => { const error = new Error(`Unimplemented host contract: ${service}`); error.service = service; throw error; };
const blockers = (error, stage) => {
  result.blockers.push({ stage, service: error.service, message: error.message ?? String(error), stack: error.stack });
};
const missing = (service) => new Proxy({}, { get: (_target, name) => blocked(`${service}.${String(name)}`) });
const notifier = createNotifier(trace);
const store = createLiteratureStore(path.join(runDir, 'literature.sqlite'), trace, notifier);
const fixtures = JSON.parse(readFileSync(new URL('../zotero-host-prototype/fixtures/items.json', import.meta.url), 'utf8'));
const ids = fixtures.map((fields, i) => store.add(`source-${i + 1}`, `NODE000${i + 1}`, fields));
result.before = ids.map((_id, i) => store.read(`source-${i + 1}`));
const timers = new Set();
const workers = new Set();
const prefs = new Map();
// Normal BBT preferences: exercise explicit fill, instead of automatic fill at startup.
prefs.set('translators.better-bibtex.fillKeyAfter', 0);
prefs.set('translators.better-bibtex.autoPinMigrated', true);
result.pluginPreferences = Object.fromEntries(prefs);
const defaults = new Map();
defaults.set('app.update.interval', 86400);
const prefKey = (key) => key.replace(/^extensions\.zotero\./, '');
const prefBranch = (prefix = '', isDefault = false) => ({
  getChildList: () => [...prefs.keys()].filter((key) => `extensions.zotero.${key}`.startsWith(prefix)).map((key) => `extensions.zotero.${key}`.slice(prefix.length)),
  setBoolPref: (key, value) => (isDefault ? defaults : prefs).set(prefKey(prefix + key), value),
  setStringPref: (key, value) => (isDefault ? defaults : prefs).set(prefKey(prefix + key), value),
  setIntPref: (key, value) => (isDefault ? defaults : prefs).set(prefKey(prefix + key), value),
});
class File {
  constructor(filename) { this.path = filename; }
  clone() { return new File(this.path); }
  append(name) { this.path = path.join(this.path, name); }
  get leafName() { return path.basename(this.path); }
  exists() { return existsSync(this.path); }
  remove() { unlinkSync(this.path); }
}
const FileUtils = { File, getDir: () => new File(runDir) };
const IOUtils = {
  async exists(file) { try { await fs.access(file); return true; } catch { return false; } },
  makeDirectory: (file) => fs.mkdir(file, { recursive: true }),
  readUTF8: (file) => fs.readFile(file, 'utf8'),
  writeUTF8: (file, text) => fs.writeFile(file, text, 'utf8'),
  readJSON: async (file) => JSON.parse(await fs.readFile(file, 'utf8')),
  writeJSON: (file, value) => fs.writeFile(file, JSON.stringify(value)),
  async stat(file) { const stat = await fs.stat(file); return { type: stat.isDirectory() ? 'directory' : 'regular', size: stat.size, lastModified: stat.mtimeMs }; },
};
record('Node filesystem: FileUtils/PathUtils/IOUtils');
record('Node SQLite: literature authority, read-only Zotero SQL views, Item field writes');
const idleService = { idleTime: 0, addIdleObserver: () => record('idle observer registration only'), removeIdleObserver() {} };
const classes = new Proxy({}, { get(_target, name) {
  if (name === '@mozilla.org/addons/addon-manager-startup;1') return { getService: () => ({ registerChrome: () => { record('chrome registration mapped to extracted original package'); return { destruct() {} }; } }) };
  if (name === '@mozilla.org/widget/useridleservice;1') return { getService: () => idleService };
  if (name === '@mozilla.org/process/environment;1') return { getService: () => ({ get: (key) => key === 'PATH' ? '/usr/bin:/bin' : '' }) };
  if (name === '@mozilla.org/file/directory_service;1') return { getService: () => ({ get: () => new File(runDir) }) };
  return blocked(`Components.classes[${String(name)}]`);
} });
const interfaces = new Proxy({}, { get: (_target, name) => name });
const Cu = {
  Sandbox: function () { record('Node vm Sandbox'); return vm.createContext({ ...globals }); },
  getObjectPrincipal: () => ({}), waiveXrays: (obj) => obj, nukeSandbox() {}, isDeadWrapper: () => false,
  importGlobalProperties(names) { for (const name of names) { if (!(name in globals)) blocked(`global.${name}`); } },
};
class ChromeWorker {
  constructor(url) {
    record('real BBT ChromeWorker bundle executed in Node worker_threads');
    this.listeners = new Set();
    this.worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { workerData: { packageDir, url } });
    workers.add(this.worker);
    this.worker.on('message', (event) => {
      trace({ type: 'worker', ...event });
      if (event.kind === 'message') for (const fn of this.listeners) fn({ data: event.data });
      if (event.kind === 'error') blockers(event, 'worker');
    });
    this.worker.on('error', (error) => blockers(error, 'worker'));
  }
  addEventListener(type, fn) { if (type === 'message') this.listeners.add(fn); }
  removeEventListener(type, fn) { this.listeners.delete(fn); }
  postMessage(data) { trace({ type: 'worker-request', data }); this.worker.postMessage(data); }
  terminate() { return this.worker.terminate(); }
}
class Localization {
  async formatValue(id) { record('localization placeholder only; UI outside scope'); return id; }
  formatMessages() { record('localization attributes unavailable; UI outside scope'); return []; }
}
class DOMParser { parseFromString() { return blocked('DOMParser.parseFromString'); } }
class DataObjects { parseLibraryKey() { return blocked('DataObjects.parseLibraryKey'); } parseLibraryKeyHash() { return blocked('DataObjects.parseLibraryKeyHash'); } }
class Export { translate() { return blocked('foreground Zotero translation engine'); } }
Export.prototype.Sandbox = {};
class Import { }
Import.prototype.Sandbox = {};
const Zotero = {
  clientName: 'Zotero', version: '10.0.5', locale: 'en-US', isLinux: true, isWin: false, isMac: false,
  initializationPromise: Promise.resolve(), unlockPromise: Promise.resolve(),
  debug: (message) => trace({ type: 'debug', message: String(message) }),
  logError: (error) => blockers(error, 'plugin-log'), Debug: { storing: false, enabled: false },
  DataDirectory: { dir: runDir }, DB: store.api, Item: store.Item, DataObjects,
  ItemTypes: { getName: (id) => store.db.prepare('SELECT typeName FROM itemTypes WHERE itemTypeID = ?').get(id)?.typeName ?? '', getID: (name) => store.db.prepare('SELECT itemTypeID FROM itemTypes WHERE typeName = ?').get(name)?.itemTypeID ?? false },
  Attachments: { LINK_MODE_LINKED_URL: 3 },
  Items: {
    get: (ids) => Array.isArray(ids) ? ids.map((id) => store.get(id)) : store.get(ids),
    getAsync: async (ids) => Array.isArray(ids) ? ids.map((id) => store.get(id)) : store.get(ids),
    loadDataTypes: async () => record('Items.loadDataTypes: fields already in authority'),
    merge: () => blocked('Items.merge'),
  },
  Libraries: { userLibraryID: 1, get: (id) => id === 1 ? { libraryID: 1, editable: true, name: 'Prototype' } : false, getAll: () => [{ libraryID: 1, editable: true }] },
  Prefs: {
    get: (key) => prefs.get(prefKey(key)) ?? defaults.get(prefKey(key)),
    set: (key, value) => prefs.set(prefKey(key), value), clear: (key) => prefs.delete(prefKey(key)),
    registerObserver: () => { record('preference observer registration only'); return 1; }, unregisterObserver() {},
  },
  Promise: Object.assign(Promise, { delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }),
  Utilities: { generateObjectKey: () => crypto.randomUUID().slice(0, 8), Internal: {
    itemToExportFormat: (item) => ({ ...item.toJSON(), itemID: item.id, itemKey: item.key, libraryID: item.libraryID, attachments: [], notes: [], tags: [] }),
    extractExtraFields: () => blocked('Utilities.Internal.extractExtraFields'),
  } },
  MenuManager: { registerMenu: () => record('menu descriptor registration only') },
  getMainWindow: () => null, getMainWindows: () => [], getActiveZoteroPane: () => null,
  getTranslatorsDirectory: () => new File(path.join(runDir, 'translators')),
  PreferencePanes: { register: () => record('preference pane registration only') },
  ItemPaneManager: { registerInfoRow: () => record('item pane row registration only') },
  API: { getResultsFromParams: () => blocked('API.getResultsFromParams') },
  Translate: { Export, Import }, Translators: {
    async init() { await fs.mkdir(path.join(runDir, 'translators'), { recursive: true }); record('independent translator directory initialized without UI'); },
    async save(header, code) {
      await fs.writeFile(path.join(runDir, 'translators', `${header.label}.js`), code);
      store.db.prepare('INSERT OR REPLACE INTO translatorCache VALUES (?, ?)').run(`${header.label}.js`, JSON.stringify(header));
    },
    async reinit() { record('translators saved; foreground engine outside scope'); },
  },
  Schema: { schemaUpdatePromise: Promise.resolve() },
  URI: { getItemURI: (item) => `scholoom://source/${item.sourceID}` },
  Notifier: notifier,
  Server: { Endpoints: {} }, File: {
    getResource(url) {
      if (url !== 'resource://zotero/schema/dateFormats.json') return blocked(`Zotero.File.getResource(${url})`);
      record('static dateFormats.json copied from official Zotero 10.0.5; no Zotero runtime');
      return readFileSync(dateFormats, 'utf8');
    },
    getContentsFromURL: (url) => readFileSync(resolveResource(url), 'utf8'),
  },
  Cite: {}, Styles: missing('Zotero.Styles'),
};
const resolveResource = (url) => {
  const parsed = new URL(url);
  if (parsed.protocol === 'file:') return fileURLToPath(parsed);
  if (parsed.protocol === 'chrome:' && parsed.hostname === 'zotero-better-bibtex') return path.join(packageDir, decodeURIComponent(parsed.pathname));
  return blocked(`resource ${url}`);
};
const Services = {
  appinfo: { OS: 'Linux' },
  io: { newURI: (spec) => ({ spec }) },
  prefs: { getBranch: (prefix) => prefBranch(prefix), getDefaultBranch: (prefix) => prefBranch(prefix, true) },
  scriptloader: {
    loadSubScriptWithOptions(url, { target }) {
      trace({ type: 'script', url });
      if (!vm.isContext(target)) vm.createContext(target);
      vm.runInContext(readFileSync(resolveResource(url), 'utf8'), target, { filename: resolveResource(url), timeout: 12000 });
      result.stages.push('original-main-bundle-evaluated');
    },
  },
  prompt: { alert: (_parent, title, text) => { blockers({ message: text }, title); }, confirm: () => blocked('Services.prompt.confirm') },
  wm: { addListener: () => record('window listener registration only'), removeListener() {} },
};
const ChromeUtils = {
  importESModule(url) {
    trace({ type: 'module-import', url });
    if (url === 'resource://gre/modules/FileUtils.sys.mjs') return { FileUtils };
    if (url === 'resource://gre/modules/Sqlite.sys.mjs') return { Sqlite: { openConnection: () => blocked('legacy BBT database migration outside this experiment') } };
    if (url === 'resource://zotero/config.mjs') return { ZOTERO_CONFIG: { CLIENT_NAME: 'Zotero', CLIENT_VERSION: '10.0.5' } };
    if (url === 'chrome://zotero/content/modules/filePicker.mjs') return { FilePicker: class { init() { return blocked('FilePicker UI'); } } };
    return blocked(`ChromeUtils.importESModule(${url})`);
  },
};
const chromiumWorkers = workerEngine === 'chromium'
  ? await createChromiumWorkers({ runDir, packageDir, trace, blockers, record }) : null;
const globals = {
  Zotero, Services, ChromeUtils, Components: { classes, interfaces, utils: Cu }, Cc: classes, Ci: interfaces, Cu,
  ChromeWorker: chromiumWorkers?.ChromeWorker ?? ChromeWorker, Localization, FileUtils, IOUtils,
  PathUtils: { join: path.join, filename: path.basename, parent: path.dirname, normalize: path.normalize, toFileURI: (file) => pathToFileURL(file).href, profileDir: runDir, tempDir: runDir },
  console, crypto, atob, btoa, Blob, TextEncoder, TextDecoder, URL, URLSearchParams, FormData, structuredClone, DOMParser,
  fetch: () => blocked('network disabled in minimum-host experiment'),
  XMLHttpRequest: class { constructor() { blocked('XMLHttpRequest'); } },
  setTimeout(fn, ms, ...args) { const timer = setTimeout(fn, ms, ...args); timers.add(timer); return timer; },
  clearTimeout, setInterval(fn, ms, ...args) { const timer = setInterval(fn, ms, ...args); timers.add(timer); return timer; }, clearInterval,
};
let watchdog;
try {
  const business = async () => {
  const context = vm.createContext(globals);
  vm.runInContext(readFileSync(path.join(packageDir, 'bootstrap.js'), 'utf8'), context, { filename: path.join(packageDir, 'bootstrap.js'), timeout: 12000 });
  result.stages.push('original-bootstrap-evaluated');
  await context.startup({ rootURI, resourceURI: { spec: rootURI } }, 1);
  result.stages.push('original-bootstrap-startup-settled');
  if (result.blockers.length) throw new Error('Original bootstrap caught startup failure; settled does not mean ready');
  if (!Zotero.BetterBibTeX || Zotero.BetterBibTeX.starting) throw new Error('BBT not ready');
  result.verified.startup = true;
  const absentBeforeFill = !store.read('source-1').fields.citationKey;
  await Zotero.BetterBibTeX.KeyManager.fill(ids);
  result.verified.generatedKey = !!store.read('source-1').fields.citationKey;
  result.verified.explicitFill = absentBeforeFill && result.verified.generatedKey;
  result.verified.preservedKey = store.read('source-2').fields.citationKey === fixtures[1].citationKey;
  result.verified.pluginWriteReadback = result.trace.some((entry) => entry.type === 'item-save' && entry.changed.citationKey);
  const keys = ids.map((id) => store.get(id).getField('citationKey'));
  await Zotero.BetterBibTeX.KeyManager.fill(ids);
  result.verified.repeatedFill = ids.every((id, i) => store.get(id).getField('citationKey') === keys[i]);
  const rows = await store.api.queryAsync('SELECT itemData.itemID, itemDataValues.value FROM itemData JOIN fields USING (fieldID) JOIN itemDataValues USING (valueID) WHERE fields.fieldName = ?', ['citationKey']);
  result.sqlReadback = rows;
  result.verified.sqlObjectAgreement = rows.length === ids.length && rows.every((row) => store.get(row.itemID).getField('citationKey') === row.value);
  const output = await Zotero.BetterBibTeX.Translators.exportItems({
    translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID,
    scope: { type: 'items', items: ids.map((id) => store.get(id)) }, displayOptions: { worker: true },
  });
  await fs.writeFile(path.join(runDir, 'export.bib'), output);
  const exportedKeys = [...output.matchAll(/^@\w+\{([^,]+),/gm)].map((match) => match[1]);
  result.export = { translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID, bytes: Buffer.byteLength(output), keys: exportedKeys };
  result.verified.bibtexExport = keys.every((key) => exportedKeys.includes(key)) && output.includes(fixtures[0].DOI) && output.includes(fixtures[1].title);
  if (!result.verified.bibtexExport) throw new Error('Original BBT returned no usable BibTeX export');
  if (scenario === 'mutation') await probeMutation({ Zotero, store, ids, runDir, result });
  if (scenario === 'jasminum') {
    result.jasminumOriginalItems = ids.map((_id, i) => store.read(`source-${i + 1}`));
    result.verified.jasminum = false;
    await probeJasminum({ globals, Zotero, store, ids, runDir, result, trace, blocked, prefs, defaults });
  }
  if (['jasminum-dom', 'jasminum-metadata'].includes(scenario)) {
    result.verified.jasminumDOM = false;
    await probeJasminumDOM({ chromiumWorkers, Zotero, store, ids, runDir, result, trace, scenario });
  }
  };
  await Promise.race([business(), new Promise((_, reject) => {
    watchdog = setTimeout(() => reject(new Error('Experiment operation budget exhausted: 30 seconds')), 30000);
  })]);
} catch (error) { blockers(error, 'controller'); }
finally {
  clearTimeout(watchdog);
  for (const timer of timers) { clearTimeout(timer); clearInterval(timer); }
  await Promise.all([...workers].map((worker) => worker.terminate()));
  await chromiumWorkers?.close();
  result.after = store.db.prepare('SELECT sourceID FROM literature ORDER BY id').all().map(({ sourceID }) => store.read(sourceID));
  result.integrity = store.db.prepare('PRAGMA integrity_check').get();
  result.sqlProjection = store.db.prepare('SELECT name, type, sql FROM sqlite_schema WHERE name IN (\'literature\', \'items\', \'itemData\', \'itemDataValues\')').all();
  store.close();
  const persisted = new DatabaseSync(path.join(runDir, 'literature.sqlite'), { readOnly: true });
  result.persisted = persisted.prepare('SELECT id, sourceID, zoteroKey, fields FROM literature ORDER BY id').all();
  result.verified.persistedReadback = result.verified.pluginWriteReadback && result.persisted.length === result.after.length
    && result.before.every((before) => result.after.some((after) => after.sourceID === before.sourceID && after.id === before.id))
    && result.persisted.every((row, i) => row.sourceID === result.after[i].sourceID && row.id === result.after[i].id && JSON.stringify(JSON.parse(row.fields)) === JSON.stringify(result.after[i].fields));
  persisted.close();
  const members = ['bootstrap.js', 'content/better-bibtex.js', 'content/worker/zotero.js', 'content/resource/Better BibTeX.js'];
  result.originalMembers = members.map((member) => ({ member, equal: readFileSync(path.join(packageDir, member)).equals(execFileSync('unzip', ['-p', xpi, member], { maxBuffer: 20 * 1024 * 1024 })) }));
  result.verified.originalCodeUnchanged = originalXpi.equals(readFileSync(xpi)) && result.originalMembers.every((member) => member.equal);
  await fs.writeFile(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
  const evidence = option('evidence');
  if (evidence) {
    await fs.mkdir(evidence, { recursive: true });
    await fs.copyFile(path.join(runDir, 'result.json'), path.join(evidence, 'result.json'));
    await fs.copyFile(path.join(runDir, 'literature.sqlite'), path.join(evidence, 'literature.sqlite'));
    for (const file of await fs.readdir(runDir)) {
      if (file.endsWith('.bib') || ['jasminum-dom-rendered.html', 'metadata-http.json', 'metadata-generated.ris', 'metadata-fixture.pdf', 'RIS.js'].includes(file)) await fs.copyFile(path.join(runDir, file), path.join(evidence, file));
    }
  }
}
process.stdout.write(`${JSON.stringify({ runDir, stages: result.stages, verified: result.verified, blockers: result.blockers.map(({ stage, message }) => ({ stage, message })) }, null, 2)}\n`);
process.exitCode = !result.blockers.length && Object.values(result.verified).every(Boolean) ? 0 : 2;
