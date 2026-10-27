// Adapted from Scholoom's 2026-10-04 BBT prototype; plugin code stays in the original release.
import {
  existsSync,
  promises as fs,
  lstatSync,
  readFileSync,
  realpathSync,
  unlinkSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import versions from '../../resources/versions.json';

export type PluginItem = {
  id: number;
  libraryID: number;
  key: string;
  getField(name: string): unknown;
  toJSON(): object;
};
export type HostCatalog = {
  zotero: Record<string, unknown>;
  item(sourceId: string): PluginItem;
};
export type Plugin = {
  starting: boolean;
  KeyManager: { fill(ids: number[]): Promise<void> };
  Translators: {
    bySlug: Record<string, { translatorID: string }>;
    exportItems(options: object): Promise<string>;
  };
};
export type Bootstrap = vm.Context & {
  startup(data: object, reason: number): Promise<void>;
  shutdown(data: object, reason: number): Promise<void>;
};
export type PluginTask = { phase: 'startup' | 'shutdown'; task: string };

export function within(root: string, filename: string): string {
  const target = resolve(filename);
  let existing = target;
  while (!lstatSync(existing, { throwIfNoEntry: false }) && dirname(existing) !== existing)
    existing = dirname(existing);
  for (const candidate of [target, realpathSync(existing)]) {
    const delta = relative(root, candidate);
    if (
      delta === '..' ||
      delta.startsWith('../') ||
      delta.startsWith('..\\') ||
      isAbsolute(delta)
    ) {
      throw new Error('Resource is outside the assigned directory');
    }
  }
  return target;
}

export function createEnvironment(options: {
  packageDirectory: string;
  profileDirectory: string;
  dateFormats: string;
  catalog: HostCatalog;
  ChromeWorker: unknown;
  diagnostic(message: string, task?: PluginTask): void;
}) {
  const packageDirectory = realpathSync(options.packageDirectory);
  const profile = realpathSync(options.profileDirectory);
  for (const [root, target] of [
    [packageDirectory, profile],
    [profile, packageDirectory],
  ] as const) {
    const delta = relative(root, target);
    if (
      !isAbsolute(delta) &&
      delta !== '..' &&
      !delta.startsWith('../') &&
      !delta.startsWith('..\\')
    ) {
      throw new Error('Package and writable profile directories must be disjoint');
    }
  }
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const failures: string[] = [];
  const prefs = new Map<string, unknown>([
    ['translators.better-bibtex.fillKeyAfter', 0],
    ['translators.better-bibtex.resetKeyOnChange', false],
    // This new host profile has no legacy preferences to migrate into startup autofill.
    ['translators.better-bibtex.autoPinMigrated', true],
  ]);
  const defaults = new Map<string, unknown>([['app.update.interval', 86400]]);
  const observers = new Map<number, { key: string; callback: () => void }>();
  const descriptors = new Map<unknown, unknown>();
  const unsupported = (name: string): never => {
    throw new Error(`Unsupported host capability: ${name}`);
  };
  const missing = (name: string) =>
    new Proxy({}, { get: (_, key) => unsupported(`${name}.${String(key)}`) });
  const prefKey = (key: string) => key.replace(/^extensions\.zotero\./, '');
  const setPref = (key: string, value: unknown) => {
    prefs.set(prefKey(key), value);
    for (const entry of observers.values()) if (entry.key === prefKey(key)) entry.callback();
  };
  const branch = (prefix = '', isDefault = false) => ({
    getChildList: () =>
      [...prefs.keys()]
        .filter((key) => `extensions.zotero.${key}`.startsWith(prefix))
        .map((key) => `extensions.zotero.${key}`.slice(prefix.length)),
    setBoolPref: (key: string, value: boolean) =>
      isDefault ? defaults.set(prefKey(prefix + key), value) : setPref(prefix + key, value),
    setStringPref: (key: string, value: string) =>
      isDefault ? defaults.set(prefKey(prefix + key), value) : setPref(prefix + key, value),
    setIntPref: (key: string, value: number) =>
      isDefault ? defaults.set(prefKey(prefix + key), value) : setPref(prefix + key, value),
  });
  const readPath = (file: string) => {
    try {
      return within(packageDirectory, file);
    } catch {
      return within(profile, file);
    }
  };
  class File {
    constructor(public path: string) {
      readPath(path);
    }
    clone() {
      return new File(this.path);
    }
    append(name: string) {
      this.path = readPath(join(this.path, name));
    }
    get leafName() {
      return basename(this.path);
    }
    exists() {
      return existsSync(readPath(this.path));
    }
    remove() {
      unlinkSync(within(profile, this.path));
    }
  }
  const FileUtils = { File, getDir: () => new File(profile) };
  const writeProfile = async (file: string, content: string) => {
    try {
      await fs.writeFile(within(profile, file), content, 'utf8');
    } catch (error) {
      failures.push(String(error).slice(0, 512));
      throw error;
    }
  };
  const IOUtils = {
    exists: async (file: string) => existsSync(readPath(file)),
    makeDirectory: (file: string) => fs.mkdir(within(profile, file), { recursive: true }),
    readUTF8: (file: string) => fs.readFile(readPath(file), 'utf8'),
    writeUTF8: writeProfile,
    readJSON: async (file: string) =>
      JSON.parse(await fs.readFile(readPath(file), 'utf8')) as unknown,
    writeJSON: (file: string, value: unknown) => writeProfile(file, JSON.stringify(value)),
    async stat(file: string) {
      const stat = await fs.stat(readPath(file));
      return {
        type: stat.isDirectory() ? 'directory' : 'regular',
        size: stat.size,
        lastModified: stat.mtimeMs,
      };
    },
  };
  const resource = (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return within(packageDirectory, fileURLToPath(parsed));
    if (parsed.protocol === 'chrome:' && parsed.hostname === 'zotero-better-bibtex') {
      return within(packageDirectory, join(packageDirectory, decodeURIComponent(parsed.pathname)));
    }
    return unsupported(`resource ${parsed.protocol}//${parsed.hostname}`);
  };
  // BBT prefetches raw Fluent patterns and substitutes arguments itself; no plugin UI is exposed.
  const patterns = new Map<string, { value: string; attributes: Record<string, string> }>();
  let current: { value: string; attributes: Record<string, string> } | undefined;
  for (const line of readFileSync(
    join(packageDirectory, 'locale/en-US/better-bibtex.ftl'),
    'utf8',
  ).split('\n')) {
    const message = /^(\S+)\s*=\s*(.*)$/.exec(line);
    const attribute = /^\s+\.(\S+)\s*=\s*(.*)$/.exec(line);
    if (message?.[1]) {
      current = { value: message[2] ?? '', attributes: {} };
      patterns.set(message[1], current);
    } else if (attribute?.[1] && current) current.attributes[attribute[1]] = attribute[2] ?? '';
  }
  class Localization {
    async formatValue(id: string) {
      return patterns.get(id)?.value ?? unsupported(`localization ${id}`);
    }
    formatMessages(ids: { id: string }[]) {
      return ids.map(({ id }) => ({ attributes: [patterns.get(id)?.attributes ?? {}] }));
    }
  }
  class DataObjects {
    parseLibraryKey() {
      return unsupported('DataObjects.parseLibraryKey');
    }
    parseLibraryKeyHash() {
      return unsupported('DataObjects.parseLibraryKeyHash');
    }
  }
  class Export {
    translate() {
      return unsupported('foreground translator');
    }
  }
  class Import {}
  Object.assign(Export.prototype, { Sandbox: {} });
  Object.assign(Import.prototype, { Sandbox: {} });
  const register = (descriptor: unknown) => {
    descriptors.set(descriptor, descriptor);
    return descriptor;
  };
  // The compatibility host is headless: retain and report progress rather than opening Zotero chrome.
  const progressWindows = new Set<ProgressWindow>();
  class ProgressWindow {
    private headline = '';
    private readonly entries = new Map<object, { text: string; percent: number }>();
    readonly ItemProgress;
    constructor() {
      const entries = this.entries;
      this.ItemProgress = class {
        constructor(_icon: string, text: string) {
          this.update({ text, percent: 0 });
        }
        private update(value: { text: string; percent: number }) {
          entries.set(this, value);
        }
        setProgress(percent: number) {
          if (!Number.isFinite(percent) || percent < 0 || percent > 100)
            throw new Error('Invalid plugin progress');
          this.update({ text: entries.get(this)?.text ?? '', percent });
        }
        setText(text: string) {
          this.update({ text, percent: entries.get(this)?.percent ?? 0 });
        }
      };
    }
    changeHeadline(text: string) {
      this.headline = text;
    }
    show() {
      progressWindows.add(this);
      options.diagnostic(`progress: ${this.headline}`);
    }
    close() {
      progressWindows.delete(this);
      options.diagnostic(
        `progress closed: ${this.headline} ${JSON.stringify([...this.entries.values()])}`,
      );
      this.entries.clear();
    }
  }
  const zotero: Record<string, unknown> & { BetterBibTeX?: Plugin } = {
    ProgressWindow,
    ...options.catalog.zotero,
    clientName: 'Zotero',
    version: versions.zotero.version,
    locale: 'en-US',
    isLinux: process.platform === 'linux',
    isWin: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    initializationPromise: Promise.resolve(),
    unlockPromise: Promise.resolve(),
    debug: (message: string) => {
      if (!message.startsWith('{error:')) return;
      // The fixed release's logger envelope carries phase/task independently of error prose.
      const scope =
        /^\{error:\s*(startup|shutdown):\s*\[([^\]+]+)(?:\+\d+)?\]better-bibtex:\}/.exec(message);
      const phase = scope?.[1];
      const task = scope?.[2];
      options.diagnostic(
        message,
        task && (phase === 'startup' || phase === 'shutdown') ? { phase, task } : undefined,
      );
    },
    logError: (error: unknown) => options.diagnostic(String(error)),
    Debug: { storing: false, enabled: false },
    DataDirectory: { dir: profile },
    DataObjects,
    Prefs: {
      get: (key: string) => prefs.get(prefKey(key)) ?? defaults.get(prefKey(key)),
      set: setPref,
      clear: (key: string) => prefs.delete(prefKey(key)),
      registerObserver: (key: string, callback: () => void) => {
        const id = observers.size + 1;
        observers.set(id, { key: prefKey(key), callback });
        return id;
      },
      unregisterObserver: (id: number) => observers.delete(id),
    },
    Promise: Object.assign(Promise, {
      delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
    Utilities: {
      generateObjectKey: () => crypto.randomUUID().slice(0, 8),
      Internal: {
        itemToExportFormat: (item: PluginItem) => ({
          ...item.toJSON(),
          itemID: item.id,
          itemKey: item.key,
          libraryID: item.libraryID,
          attachments: [],
          notes: [],
        }),
        extractExtraFields: () => unsupported('extractExtraFields'),
      },
    },
    MenuManager: { registerMenu: register },
    PreferencePanes: { register },
    ItemPaneManager: { registerInfoRow: register },
    getMainWindow: () => null,
    getMainWindows: () => [],
    getActiveZoteroPane: () => null,
    getTranslatorsDirectory: () => new File(join(profile, 'translators')),
    API: { getResultsFromParams: () => unsupported('external API') },
    Translate: { Export, Import },
    Translators: {
      init: () => fs.mkdir(join(profile, 'translators'), { recursive: true }),
      async save(header: { label: string }, code: string) {
        await writeProfile(join(profile, 'translators', `${header.label}.js`), code);
      },
      reinit: async () => {},
    },
    Schema: { schemaUpdatePromise: Promise.resolve() },
    URI: { getItemURI: (item: PluginItem) => `scholoom://sample/${item.id}` },
    Server: { Endpoints: {} },
    File: {
      getResource: (url: string) =>
        url === 'resource://zotero/schema/dateFormats.json'
          ? readFileSync(options.dateFormats, 'utf8')
          : unsupported('static resource'),
      getContentsFromURL: (url: string) => readFileSync(resource(url), 'utf8'),
    },
    Cite: {},
    Styles: missing('Styles'),
  };
  let globals: Record<string, unknown>;
  function Sandbox() {
    return vm.createContext({ ...globals });
  }
  const Cu = {
    Sandbox,
    getObjectPrincipal: () => ({}),
    waiveXrays: (value: unknown) => value,
    nukeSandbox: () => {},
    isDeadWrapper: () => false,
    importGlobalProperties: (names: string[]) => {
      for (const name of names) if (!(name in globals)) unsupported(`global ${name}`);
    },
  };
  const classes = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name === '@mozilla.org/addons/addon-manager-startup;1')
          return { getService: () => ({ registerChrome: () => ({ destruct() {} }) }) };
        if (name === '@mozilla.org/widget/useridleservice;1')
          return {
            getService: () => ({
              idleTime: 0,
              addIdleObserver: register,
              removeIdleObserver: (entry: unknown) => descriptors.delete(entry),
            }),
          };
        if (name === '@mozilla.org/process/environment;1')
          return {
            getService: () => ({ get: (key: string) => (key === 'PATH' ? '/usr/bin:/bin' : '') }),
          };
        if (name === '@mozilla.org/file/directory_service;1')
          return { getService: () => ({ get: () => new File(profile) }) };
        return unsupported(`Components.classes ${String(name)}`);
      },
    },
  );
  const interfaces = new Proxy({}, { get: (_, name) => name });
  const Services = {
    appinfo: { OS: process.platform === 'win32' ? 'WINNT' : 'Linux' },
    // Electron has no Gecko profiler session; profiling operations remain unsupported.
    profiler: { IsActive: () => false },
    io: { newURI: (spec: string) => ({ spec }) },
    prefs: {
      getBranch: (prefix: string) => branch(prefix),
      getDefaultBranch: (prefix: string) => branch(prefix, true),
    },
    scriptloader: {
      loadSubScriptWithOptions(url: string, { target }: { target: object }) {
        if (!vm.isContext(target)) vm.createContext(target);
        vm.runInContext(readFileSync(resource(url), 'utf8'), target, {
          filename: resource(url),
          timeout: 12_000,
        });
      },
    },
    prompt: {
      alert: (_parent: unknown, title: string, text: string) => {
        failures.push(`${title}: ${text}`);
      },
      confirm: () => unsupported('interactive prompt'),
    },
    wm: { addListener: register, removeListener: (entry: unknown) => descriptors.delete(entry) },
  };
  const ChromeUtils = {
    importESModule(url: string) {
      if (url === 'resource://gre/modules/FileUtils.sys.mjs') return { FileUtils };
      if (url === 'resource://gre/modules/Sqlite.sys.mjs')
        return { Sqlite: { openConnection: () => unsupported('legacy BBT migration') } };
      if (url === 'resource://zotero/config.mjs')
        return {
          ZOTERO_CONFIG: { CLIENT_NAME: 'Zotero', CLIENT_VERSION: versions.zotero.version },
        };
      if (url === 'chrome://zotero/content/modules/filePicker.mjs')
        return {
          FilePicker: class {
            init() {
              return unsupported('file picker');
            }
          },
        };
      return unsupported(`ChromeUtils.importESModule ${url}`);
    },
  };
  globals = {
    Zotero: zotero,
    Services,
    ChromeUtils,
    Components: { classes, interfaces, utils: Cu },
    Cc: classes,
    Ci: interfaces,
    Cu,
    ChromeWorker: options.ChromeWorker,
    Localization,
    FileUtils,
    IOUtils,
    PathUtils: {
      join,
      filename: basename,
      parent: dirname,
      normalize: resolve,
      toFileURI: (file: string) => pathToFileURL(readPath(file)).href,
      profileDir: profile,
      tempDir: profile,
    },
    console,
    crypto,
    atob,
    btoa,
    Blob,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    FormData,
    structuredClone,
    DOMParser: class {
      parseFromString() {
        return unsupported('DOMParser');
      }
    },
    fetch: () => unsupported('network'),
    XMLHttpRequest: class {
      constructor() {
        unsupported('XMLHttpRequest');
      }
    },
    setTimeout(callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback(...args);
      }, ms);
      timers.add(timer);
      return timer;
    },
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => {
      clearTimeout(timer);
      timers.delete(timer);
    },
    setInterval(callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]) {
      const timer = setInterval(callback, ms, ...args);
      timers.add(timer);
      return timer;
    },
    clearInterval: (timer: ReturnType<typeof setTimeout>) => {
      clearInterval(timer);
      timers.delete(timer);
    },
  };
  return {
    zotero,
    failures,
    context: vm.createContext(globals) as Bootstrap,
    dispose() {
      for (const progress of progressWindows) progress.close();
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      timers.clear();
      observers.clear();
      descriptors.clear();
    },
  };
}
