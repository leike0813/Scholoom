// Throwaway native DOM host: original package executes in Chromium, Node owns all records.
import { execFileSync } from 'node:child_process';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { probeMetadataTask } from './metadata-task-probe.mjs';

export async function probeJasminumDOM({ chromiumWorkers, Zotero, store, ids, runDir, result, trace, scenario }) {
  const xpi = process.env.SCHOLOOM_JASMINUM_XPI ?? '/tmp/scholoom-host-prototype-assets-1bmhDr/jasminum_1.1.39.xpi';
  const originalXpi = readFileSync(xpi);
  const dir = path.join(runDir, 'jasminum-dom-package');
  execFileSync('unzip', ['-q', xpi, '-d', dir]);
  const sources = Object.fromEntries(['bootstrap.js', 'prefs.js', 'chrome/content/scripts/jasminum.js'].map((member) => [member, readFileSync(path.join(dir, member), 'utf8')]));
  const evidence = result.jasminumDOM = { version: JSON.parse(readFileSync(path.join(dir, 'manifest.json'))).version, xpi, stages: [], services: [], errors: [], verified: {} };
  const initial = ids.map((id) => store.read(store.get(id).sourceID));
  const page = await chromiumWorkers.newPage();
  page.on('pageerror', (error) => evidence.errors.push({ message: error.message, stack: error.stack }));
  let observerID;
  const dto = (id) => {
    const item = store.get(id);
    return { ...store.read(item.sourceID), key: item.key, libraryID: item.libraryID };
  };
  await page.exposeFunction('hostTrace', (entry) => {
    trace({ type: 'jasminum-dom', ...entry });
    if (entry.kind === 'service' && !evidence.services.includes(entry.name)) evidence.services.push(entry.name);
    if (entry.kind === 'error') evidence.errors.push(entry);
  });
  await page.exposeFunction('hostSave', async ({ id, changed, options }) => {
    trace({ type: 'jasminum-save-request', itemID: id, changed, options });
    let item = id == null ? null : store.get(id);
    const isNew = !item;
    if (!item) {
      const sourceID = `source-plugin-${crypto.randomUUID()}`;
      const newID = store.add(sourceID, crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(), { itemType: changed.itemType });
      item = store.get(newID);
      trace({ type: 'plugin-item-create', sourceID, itemID: newID, itemType: changed.itemType });
    }
    for (const [name, value] of Object.entries(changed)) item.setField(name, value);
    await item.saveTx(isNew ? { ...options, skipNotifier: true } : options);
    if (isNew && !options.skipNotifier) await Zotero.Notifier.trigger('add', 'item', [item.id], { [item.id]: { libraryID: item.libraryID } });
    return dto(item.id);
  });
  await fs.writeFile(path.join(runDir, 'jasminum-dom.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Throwaway plugin DOM host</title></head><body></body></html>');
  await page.goto(pathToFileURL(path.join(runDir, 'jasminum-dom.html')).href);
  // No live HTTP inputs in this experiment; an attempted network branch is evidence of a gap.
  await page.route('**/*', async (route) => {
    if (/^https?:/.test(route.request().url())) {
      evidence.errors.push({ kind: 'network', url: route.request().url() });
      await route.abort();
    } else await route.continue();
  });
  try {
    await page.evaluate(({ sources, rootURI, runDir }) => {
      const service = (name) => window.hostTrace({ kind: 'service', name });
      const blocked = (name) => { window.hostTrace({ kind: 'unsupported', name }); throw new Error(`Unimplemented DOM host contract: ${name}`); };
      const unavailable = (name) => new Proxy({}, { get: (_, key) => blocked(`${name}.${String(key)}`) });
      const preferences = new Map();
      new Function('pref', sources['prefs.js'])((key, value) => preferences.set(key, value));
      const prefKey = (key) => key.startsWith('extensions.') ? key : `extensions.zotero.${key}`;
      for (const [key, value] of Object.entries({ firstRun: false, autoUpdateTranslators: false, autoUpdateMetadata: false, autoSplitName: false, pdfMatchFolder: runDir, translatorSource: 'https://example.invalid/translators' })) preferences.set(`extensions.jasminum.${key}`, value);
      const items = new Map();
      const observers = new Map();
      const pending = new Set();
      class Item {
        constructor(record) { this.record = typeof record === 'string' ? { fields: { itemType: record }, libraryID: 1 } : record; this.pending = {}; this.id = this.itemID = this.record.id; }
        get libraryID() { return this.record.libraryID; }
        set libraryID(value) { this.record.libraryID = value; }
        get key() { return this.record.key; }
        get itemType() { return this.record.fields.itemType; }
        get itemTypeID() { return this.itemType === 'attachment' ? 2 : 1; }
        get parentID() { return this.pending.parentID ?? this.record.fields.parentID; }
        set parentID(id) { this.pending.parentID = id; }
        get attachmentFilename() { return this.record.fields.filename; }
        getTags() { return structuredClone(this.pending.tags ?? this.record.fields.tags ?? []); }
        setTags(tags) { this.pending.tags = tags; }
        removeAllTags() { this.pending.tags = []; }
        getCollections() { return []; }
        getNotes() { return []; }
        getField(name) { return this.pending[name] ?? this.record.fields[name] ?? ''; }
        setField(name, value) { this.pending[name] = value; }
        getCreators() { return structuredClone(this.pending.creators ?? this.record.fields.creators ?? []); }
        setCreators(creators) { this.pending.creators = structuredClone(creators); }
        async saveTx(options = {}) {
          const changed = this.id ? this.pending : { itemType: this.itemType, ...this.pending };
          this.pending = {};
          const saving = window.hostSave({ id: this.id, changed, options }).then((record) => { this.record = record; this.id = this.itemID = record.id; items.set(record.id, this); return record.id; });
          pending.add(saving);
          try { return await saving; } finally { pending.delete(saving); }
        }
        save(options) { return this.saveTx(options); }
        isRegularItem() { return this.itemType === 'journalArticle'; }
        isAttachment() { return this.itemType === 'attachment'; }
        isSnapshotAttachment() { return false; }
        isTopLevelItem() { return !this.parentID; }
      }
      const protocol = { wrappedJSObject: { _extensions: {} } };
      const noWindows = { hasMoreElements: () => false, getNext: () => blocked('window enumerator') };
      const modules = new Map([
        ['chrome://zotero/content/HiddenBrowser.mjs', { HiddenBrowser: class { constructor() { blocked('HiddenBrowser'); } } }],
        ['chrome://zotero/content/actors/ActorManager.mjs', {}],
        ['chrome://zotero/content/BlockingObserver.mjs', { BlockingObserver: class { constructor() { blocked('BlockingObserver'); } } }],
        ['resource://gre/modules/E10SUtils.sys.mjs', { E10SUtils: unavailable('E10SUtils') }],
        ['resource://gre/modules/AddonManager.sys.mjs', { AddonManager: unavailable('AddonManager') }],
        ['resource://gre/modules/Console.sys.mjs', { ConsoleAPI: class { log() {} } }],
      ]);
      let startupPromise;
      const addonGlobal = {};
      const compat = {
        version: '10.0.5', locale: 'zh-CN', isLinux: true, isWin: false, isMac: false,
        initializationPromise: Promise.resolve(), unlockPromise: Promise.resolve(), uiReadyPromise: Promise.resolve(),
        Item, Items: { get: (id) => Array.isArray(id) ? id.map((value) => items.get(value)) : items.get(id) },
        Prefs: { get: (key) => preferences.get(prefKey(key)), set: (key, value) => preferences.set(prefKey(key), value), clear: (key) => preferences.delete(prefKey(key)) },
        Promise: Object.assign(Promise, { delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }),
        Utilities: { randomString: (length = 8) => Array.from(crypto.getRandomValues(new Uint8Array(length)), (value) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[value % 62]).join('') },
        debug: (message) => window.hostTrace({ kind: 'debug', message: String(message) }),
        logError: (error) => window.hostTrace({ kind: 'error', message: error.message ?? String(error), stack: error.stack }),
        getMainWindow: () => window, getMainWindows: () => [],
        Plugins: { addObserver: () => service('plugin observer registration only'), removeObserver: () => service('plugin observer removal only') },
        Reader: { _readers: [], registerEventListener: () => service('Reader event registration only') },
        PreferencePanes: { register: () => service('preference pane registration only') },
        ItemTreeManager: { registerColumn: () => { service('item column registration only'); return 'CNKIcitation'; } },
        Notifier: {
          registerObserver(observer, types) { const id = observers.size + 1; observers.set(id, { observer, types }); service('original item observer registered'); return id; },
          unregisterObserver: (id) => observers.delete(id),
        },
      };
      window.Zotero = new Proxy(compat, { get(target, key) {
        if (key !== 'Jasminum' || !target[key]) return target[key];
        return new Proxy(target[key], { get(addon, property) {
          if (property !== 'hooks') return addon[property];
          return new Proxy(addon.hooks, { get(hooks, hook) {
            if (hook !== 'onStartup') return hooks[hook];
            return new Proxy(hooks[hook], { apply(fn, receiver, args) {
              startupPromise = Reflect.apply(fn, receiver, args);
              startupPromise.catch(() => {});
              return startupPromise;
            } });
          } });
        } });
      } });
      window.ChromeUtils = {
        importESModule(url) { service(`module namespace ${url}`); if (!modules.has(url)) return blocked(`module ${url}`); return modules.get(url); },
        registerWindowActor: () => service('actor descriptor registration only'), unregisterWindowActor: () => service('actor unregister descriptor only'),
      };
      window.Components = {
        classes: new Proxy({}, { get: (_, key) => {
          if (key === '@mozilla.org/addons/addon-manager-startup;1') return { getService: () => ({ registerChrome: () => { service('chrome resource descriptor registration only'); return { destruct() {} }; } }) };
          return blocked(`Components.classes ${String(key)}`);
        } }),
        interfaces: new Proxy({}, { get: (_, key) => key }), utils: { isDeadWrapper: () => false },
      };
      window.Cc = Components.classes; window.Ci = Components.interfaces;
      window.Localization = class { formatMessagesSync(messages) { return messages.map(({ id }) => ({ value: id })); } };
      window.Services = {
        io: { newURI: (spec) => ({ spec }), getProtocolHandler: () => { service('protocol descriptor registration only'); return protocol; } },
        wm: { addListener: () => service('main window listener registration only'), removeListener() {}, getEnumerator: () => noWindows },
        ww: { registerNotification: () => service('window notification registration only'), unregisterNotification() {} },
        scriptloader: { loadSubScript(url, target) {
          if (new URL(url).pathname !== new URL(`${rootURI}/chrome/content/scripts/jasminum.js`).pathname) return blocked(`script ${url}`);
          Object.assign(addonGlobal, target);
          addonGlobal._globalThis = addonGlobal;
          const scope = new Proxy(addonGlobal, {
            has: (object, key) => key !== 'source' && key !== 'scope' && (key in object || key in window),
            get: (object, key) => key === Symbol.unscopables ? undefined : key === 'globalThis' ? scope : key in object ? object[key] : window[key],
          });
          // Execute exact package bytes in the scope provided by the privileged scriptloader.
          new Function('scope', 'source', 'with (scope) { eval(source); }')(scope, sources['chrome/content/scripts/jasminum.js']);
          window.domHost.stages.push('original-main-evaluated');
        } },
      };
      window.addEventListener('unhandledrejection', (event) => window.hostTrace({ kind: 'error', message: event.reason?.message ?? String(event.reason), stack: event.reason?.stack }));
      window.domHost = {
        stages: [], preferences,
        read: (id) => structuredClone(items.get(id)?.record),
        projectedIDs: () => [...items.keys()],
        async notify({ action, type, records, extraData }) {
          for (const record of records) {
            if (items.has(record.id)) items.get(record.id).record = record;
            else items.set(record.id, new Item(record));
          }
          for (const [id, { observer, types }] of observers) {
            if (!types.includes(type)) continue;
            await observer.notify(action, type, records.map((record) => record.id), extraData);
            await window.hostTrace({ kind: 'notification', observerID: id, action, itemIDs: records.map((record) => record.id) });
          }
        },
        async drain() { while (pending.size) await Promise.all([...pending]); },
        async startup() {
          (0, eval)(sources['bootstrap.js']);
          this.stages.push('original-bootstrap-evaluated');
          await window.startup({ rootURI, resourceURI: { spec: rootURI } }, 1);
          this.stages.push('original-bootstrap-returned');
          if (!startupPromise) throw new Error('Original startup Promise unobserved');
          await startupPromise;
          this.stages.push('original-startup-settled');
        },
      };
    }, { sources, rootURI: pathToFileURL(`${dir}/`).href, runDir });
    await page.evaluate(() => window.domHost.startup());
    evidence.stages = await page.evaluate(() => window.domHost.stages);
    evidence.dom = await page.evaluate(() => ({
      prompt: !!document.querySelector('#zotero-plugin-toolkit-prompt'),
      style: !!document.querySelector('#prompt-style'),
      inputIsNative: document.querySelector('.prompt-input') instanceof HTMLInputElement,
      connected: document.querySelector('#zotero-plugin-toolkit-prompt')?.isConnected,
      nodes: document.querySelectorAll('*').length,
    }));
    evidence.verified.originalStartup = evidence.stages.includes('original-startup-settled');
    evidence.verified.nativeDOMInitialized = evidence.dom.prompt && evidence.dom.style && evidence.dom.inputIsNative && evidence.dom.connected;
    observerID = Zotero.Notifier.registerObserver({
      notify: async (action, type, itemIDs, extraData) => page.evaluate((event) => window.domHost.notify(event), { action, type, records: itemIDs.map(dto), extraData }),
    }, ['item'], 'Jasminum DOM bridge');
    const creators = [{ firstName: '', lastName: '欧阳明', creatorType: 'author', fieldMode: 1 }, { firstName: '', lastName: '李华', creatorType: 'author', fieldMode: 1 }];
    const controlID = store.add('source-jasminum-control', 'JASMC001', { itemType: 'journalArticle', title: '关闭姓名拆分的对照', date: '2026', creators, citationKey: 'JasminumControl2026' });
    const start = result.trace.length;
    await Zotero.Notifier.trigger('add', 'item', [controlID], { [controlID]: { libraryID: 1 } });
    await page.evaluate(() => window.domHost.drain());
    evidence.control = store.read('source-jasminum-control');
    evidence.verified.disabledPreferenceControl = JSON.stringify(evidence.control.fields.creators) === JSON.stringify(creators) && !result.trace.slice(start).some((entry) => entry.type === 'jasminum-save-request');
    await page.evaluate(() => window.domHost.preferences.set('extensions.jasminum.autoSplitName', true));
    const id = store.add('source-jasminum', 'JASM0001', { itemType: 'journalArticle', title: '中文作者姓名拆分样本', date: '2026', creators, citationKey: 'JasminumNames2026' });
    evidence.before = store.read('source-jasminum');
    const saveStart = result.trace.length;
    await Zotero.Notifier.trigger('add', 'item', [id], { [id]: { libraryID: 1 } });
    await page.evaluate(() => window.domHost.drain());
    evidence.after = store.read('source-jasminum');
    evidence.projection = await page.evaluate((id) => ({ record: window.domHost.read(id), ids: window.domHost.projectedIDs() }), id);
    const after = evidence.after.fields.creators;
    evidence.verified.originalNameSplitSaved = after[0].lastName === '欧阳' && after[0].firstName === '明' && after[1].lastName === '李' && after[1].firstName === '华' && after.every((creator) => creator.fieldMode === 0);
    evidence.verified.notificationDrivenSave = result.trace.slice(saveStart).some((entry) => entry.type === 'jasminum-save-request' && entry.itemID === id && entry.changed.creators) && result.trace.slice(saveStart).some((entry) => entry.type === 'item-save' && entry.itemID === id && entry.changed.creators);
    evidence.verified.projectionMatchesAuthority = evidence.projection.record.id === id && evidence.projection.record.sourceID === evidence.after.sourceID && JSON.stringify(evidence.projection.record.fields) === JSON.stringify(evidence.after.fields);
    const metadata = (record) => Object.fromEntries(Object.entries(record.fields).filter(([name]) => name !== 'creators'));
    evidence.verified.otherMetadataUnchanged = JSON.stringify(metadata(evidence.before)) === JSON.stringify(metadata(evidence.after));
    const output = await Zotero.BetterBibTeX.Translators.exportItems({ translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID, scope: { type: 'items', items: [...ids, controlID, id].map((itemID) => store.get(itemID)) }, displayOptions: { worker: true } });
    await fs.writeFile(path.join(runDir, 'jasminum-dom-names.bib'), output);
    evidence.verified.bbtReadsSameAuthority = output.includes('欧阳, 明') && output.includes('李, 华') && output.includes('JasminumNames2026');
    evidence.verified.originalItemsUnchanged = ids.every((itemID, i) => JSON.stringify(store.read(store.get(itemID).sourceID)) === JSON.stringify(initial[i]));
    if (scenario === 'jasminum-metadata') {
      evidence.verified.metadataTask = false;
      await probeMetadataTask({ page, store, Zotero, ids, runDir, evidence, trace });
    }
    evidence.verified.noBackgroundErrors = evidence.errors.length === 0;
    await fs.writeFile(path.join(runDir, 'jasminum-dom-rendered.html'), await page.content());
  } finally {
    if (observerID) Zotero.Notifier.unregisterObserver(observerID);
    evidence.stages = await page.evaluate(() => window.domHost?.stages ?? []).catch(() => evidence.stages);
    evidence.originalMembers = Object.keys(sources).map((member) => ({ member, equal: readFileSync(path.join(dir, member)).equals(execFileSync('unzip', ['-p', xpi, member], { maxBuffer: 20 * 1024 * 1024 })) }));
    evidence.verified.originalCodeUnchanged = originalXpi.equals(readFileSync(xpi)) && evidence.originalMembers.every((entry) => entry.equal);
    result.verified.jasminumDOM = evidence.verified.originalNameSplitSaved === true && evidence.verified.bbtReadsSameAuthority === true && Object.values(evidence.verified).every(Boolean);
    await page.close();
  }
  if (!result.verified.jasminumDOM) throw new Error('Native DOM experiment did not verify all behavior');
}
