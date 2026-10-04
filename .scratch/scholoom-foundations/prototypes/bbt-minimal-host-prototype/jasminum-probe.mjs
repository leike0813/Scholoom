// Original bootstrap and automatic name splitting, sharing BBT's literature authority.
import { execFileSync } from 'node:child_process';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import vm from 'node:vm';

export async function probeJasminum({ globals, Zotero, store, ids, runDir, result, trace, blocked, prefs, defaults }) {
  const xpi = process.env.SCHOLOOM_JASMINUM_XPI ?? '/tmp/scholoom-host-prototype-assets-1bmhDr/jasminum_1.1.39.xpi';
  const originalXpi = readFileSync(xpi);
  const dir = path.join(runDir, 'jasminum');
  execFileSync('unzip', ['-q', xpi, '-d', dir]);
  const rootURI = pathToFileURL(`${dir}/`).href;
  const evidence = result.jasminum = { xpi, version: JSON.parse(readFileSync(path.join(dir, 'manifest.json'))).version, services: [], verified: {
    originalBootstrapEvaluated: false, originalMainEvaluated: false, bootstrapReturned: false,
    originalStartupSettled: false, originalNameSplitSaved: false, notificationDrivenSave: false,
    bbtReadsSameAuthority: false, originalItemsUnchanged: false, originalCodeUnchanged: false,
  } };
  const service = (name) => { if (!evidence.services.includes(name)) evidence.services.push(name); trace({ type: 'jasminum-service', name }); };
  vm.runInNewContext(readFileSync(path.join(dir, 'prefs.js'), 'utf8'), { pref: (key, value) => defaults.set(key, value) });
  for (const [key, value] of Object.entries({ firstRun: false, autoUpdateTranslators: false, autoUpdateMetadata: false, autoSplitName: true, pdfMatchFolder: runDir, translatorSource: 'https://example.invalid/translators' })) prefs.set(`extensions.jasminum.${key}`, value);
  evidence.preferences = Object.fromEntries([...prefs].filter(([key]) => key.startsWith('extensions.jasminum.')));
  let startupPromise;
  // Observe the Promise omitted by original bootstrap; delegate the original function intact.
  const observedZotero = new Proxy(Zotero, { get(target, name) {
    const value = Reflect.get(target, name);
    if (name !== 'Jasminum' || !value) return value;
    return new Proxy(value, { get(addon, property) {
      if (property !== 'hooks') return Reflect.get(addon, property);
      return new Proxy(addon.hooks, { get(hooks, hook) {
        if (hook !== 'onStartup') return Reflect.get(hooks, hook);
        return new Proxy(hooks.onStartup, { apply(fn, receiver, args) {
          startupPromise = Reflect.apply(fn, receiver, args);
          startupPromise.catch(() => {});
          return startupPromise;
        } });
      } });
    } });
  } });
  const moduleImports = new Map([
    ['chrome://zotero/content/HiddenBrowser.mjs', { HiddenBrowser: class { constructor() { blocked('Jasminum HiddenBrowser execution'); } } }],
    ['chrome://zotero/content/actors/ActorManager.mjs', {}],
    ['chrome://zotero/content/BlockingObserver.mjs', { BlockingObserver: class { constructor() { blocked('Jasminum BlockingObserver execution'); } } }],
    ['resource://gre/modules/E10SUtils.sys.mjs', { E10SUtils: new Proxy({}, { get: () => blocked('Jasminum E10SUtils execution') }) }],
    ['resource://gre/modules/AddonManager.sys.mjs', { AddonManager: new Proxy({}, { get: () => blocked('Jasminum AddonManager execution') }) }],
  ]);
  const protocol = { wrappedJSObject: { _extensions: {} } };
  Object.assign(Zotero, {
    uiReadyPromise: Promise.resolve(),
    Plugins: { addObserver: () => service('plugin observer registration only') },
    Reader: { _readers: [], registerEventListener: () => service('Reader event registration only') },
    ItemTreeManager: { registerColumn: () => { service('item column registration only'); return 'CNKIcitation'; } },
  });
  Zotero.Utilities.randomString = (length = 8) => Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[crypto.getRandomValues(new Uint32Array(1))[0] % 62]).join('');
  class Localization extends globals.Localization {
    formatMessagesSync(messages) { service('localization fallback identifiers'); return messages.map(({ id }) => ({ value: id })); }
  }
  const Services = { ...globals.Services,
    io: { ...globals.Services.io, getProtocolHandler: (name) => { if (name !== 'zotero') blocked(`protocol ${name}`); service('debug protocol descriptor registration only'); return protocol; } },
    wm: { ...globals.Services.wm, getEnumerator: () => ({ hasMoreElements: () => false, getNext: () => blocked('no main window') }) },
    ww: { registerNotification: () => service('window observer registration only'), unregisterNotification() {} },
    scriptloader: { loadSubScript(url, target) {
      const filename = fileURLToPath(url);
      vm.createContext(target);
      // The native scriptloader supplies privileged globals to its target scope.
      Object.assign(target, sandboxGlobals);
      vm.runInContext(readFileSync(filename, 'utf8'), target, { filename, timeout: 12000 });
      evidence.verified.originalMainEvaluated = true;
    } },
  };
  const ChromeUtils = { ...globals.ChromeUtils,
    importESModule(url) {
      service(`module import ${url}`);
      if (moduleImports.has(url)) return moduleImports.get(url);
      return globals.ChromeUtils.importESModule(url);
    },
    registerWindowActor: () => service('actor descriptor registration only'),
    unregisterWindowActor: () => service('actor unregister descriptor only'),
  };
  const sandboxGlobals = { ...globals, Zotero: observedZotero, Services, ChromeUtils, Localization,
    document: new Proxy({ querySelector: () => { service('empty document query; no UI nodes'); return null; } }, {
      get: (target, name) => name in target ? target[name] : blocked(`Jasminum document.${String(name)}`),
    }),
    console: Object.fromEntries(['log', 'debug', 'info', 'warn', 'error', 'trace', 'group', 'groupCollapsed', 'groupEnd'].map((name) => [name, (...args) => trace({ type: 'jasminum-log', method: name, message: args.map(String).join(' ') })])),
  };
  const context = vm.createContext(sandboxGlobals);
  try {
    vm.runInContext(readFileSync(path.join(dir, 'bootstrap.js'), 'utf8'), context, { filename: path.join(dir, 'bootstrap.js'), timeout: 12000 });
    evidence.verified.originalBootstrapEvaluated = true;
    await context.startup({ rootURI, resourceURI: { spec: rootURI } }, 1);
    evidence.verified.bootstrapReturned = true;
    if (!startupPromise) throw new Error('Original startup hook was not observed');
    await startupPromise;
    evidence.verified.originalStartupSettled = true;
    const creators = [
      { firstName: '', lastName: '欧阳明', creatorType: 'author', fieldMode: 1 },
      { firstName: '', lastName: '李华', creatorType: 'author', fieldMode: 1 },
    ];
    const id = store.add('source-jasminum', 'JASM0001', { itemType: 'journalArticle', title: '中文作者姓名拆分样本', date: '2026', creators, citationKey: 'JasminumNames2026' });
    evidence.before = store.read('source-jasminum');
    const start = result.trace.length;
    await Zotero.Notifier.trigger('add', 'item', [id], { [id]: { libraryID: 1 } });
    // Jasminum's original observer intentionally does not return the async handler.
    const deadline = Date.now() + 2000;
    while (store.read('source-jasminum').fields.creators[0].fieldMode !== 0 && Date.now() < deadline) await Zotero.Promise.delay(10);
    evidence.after = store.read('source-jasminum');
    const after = evidence.after.fields.creators;
    evidence.verified.originalNameSplitSaved = after[0].lastName === '欧阳' && after[0].firstName === '明' && after[1].lastName === '李' && after[1].firstName === '华' && after.every((creator) => creator.fieldMode === 0);
    evidence.verified.notificationDrivenSave = result.trace.slice(start).some((entry) => entry.type === 'item-save' && entry.itemID === id && entry.changed.creators);
    const exportItems = () => Zotero.BetterBibTeX.Translators.exportItems({ translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID, scope: { type: 'items', items: [...ids, id].map((itemID) => store.get(itemID)) }, displayOptions: { worker: true } });
    const output = await exportItems();
    await fs.writeFile(path.join(runDir, 'jasminum-names.bib'), output);
    evidence.verified.bbtReadsSameAuthority = output.includes('欧阳, 明') && output.includes('李, 华') && output.includes('JasminumNames2026');
    evidence.verified.originalItemsUnchanged = ids.every((itemID, i) => JSON.stringify(store.read(`source-${i + 1}`)) === JSON.stringify(result.jasminumOriginalItems[i]));
  } finally {
    evidence.originalMembers = ['bootstrap.js', 'chrome/content/scripts/jasminum.js'].map((member) => ({ member, equal: readFileSync(path.join(dir, member)).equals(execFileSync('unzip', ['-p', xpi, member], { maxBuffer: 20 * 1024 * 1024 })) }));
    evidence.verified.originalCodeUnchanged = originalXpi.equals(readFileSync(xpi)) && evidence.originalMembers.every((entry) => entry.equal);
    result.verified.jasminum = Object.values(evidence.verified).every(Boolean);
  }
  if (!result.verified.jasminum) throw new Error('Jasminum probe did not verify all behavior');
}
