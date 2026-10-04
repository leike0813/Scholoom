import { execFileSync } from 'node:child_process';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STARTUP_REASON = 5;
const DEFAULT_TIMEOUT_MS = 12_000;

class MissingServiceError extends Error {
  constructor(service) {
    super(`Missing host service: ${service}`);
    this.name = 'MissingServiceError';
    this.service = service;
  }
}

function cleanError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message ?? error),
    stack: error?.stack,
  };
}

function packageDirectoryName(pkg) {
  return `${pkg.name}-${pkg.version}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function recordFirstFailure(result, error) {
  result.error ??= cleanError(error);
  if (error instanceof MissingServiceError) {
    result.missingService ??= error.service;
  }
}

function trackedMissingObject(label) {
  return new Proxy(Object.create(null), {
    get(_target, property) {
      if (property === Symbol.toStringTag) return label;
      throw new MissingServiceError(`${label}.${String(property)}`);
    },
    set(_target, property) {
      throw new MissingServiceError(`${label}.${String(property)}`);
    },
  });
}

function createRuntime(result, rootURI, timeoutMs) {
  const timers = new Set();
  const addTimer = (callback, delay, repeat, args) => {
    const handle = repeat
      ? setInterval(callback, delay, ...args)
      : setTimeout(() => {
          timers.delete(handle);
          callback(...args);
        }, delay);
    timers.add(handle);
    return handle;
  };
  const clearTimer = (handle) => {
    clearTimeout(handle);
    clearInterval(handle);
    timers.delete(handle);
  };
  const record = (service) => {
    if (!result.providedServices.includes(service)) result.providedServices.push(service);
  };
  const trace = (event) => result.trace.push({ at: new Date().toISOString(), ...event });

  const zotero = {
    initializationPromise: Promise.resolve(),
    debug(message) {
      trace({ type: 'log', level: 'debug', message: String(message) });
    },
    logError(error) {
      trace({ type: 'log', level: 'error', message: String(error?.stack ?? error) });
      recordFirstFailure(result, error);
    },
    Prefs: {
      get(key) {
        trace({ type: 'zotero-pref-read', key });
        return key === 'debug.store' ? false : undefined;
      },
    },
    Debug: {
      storing: false,
      enabled: false,
      getConsoleViewerOutput() { return []; },
    },
    MenuManager: {
      registerMenu(descriptor) {
        trace({ type: 'menu-registration', menuID: descriptor.menuID });
        return { unregister() {} };
      },
    },
  };
  record('Zotero.initializationPromise');
  record('Zotero.debug/logError');

  const addonManagerStartup = {
    registerChrome(manifestURI, registrations) {
      record('AddonManagerStartup.registerChrome');
      trace({
        type: 'registerChrome',
        manifestURI: manifestURI.spec,
        registrations,
      });
      result.stages.push('chrome-registered');
      return { destruct() {} };
    },
  };
  const classes = new Proxy(Object.create(null), {
    get(_target, name) {
      if (name === '@mozilla.org/addons/addon-manager-startup;1') {
        return {
          getService(interfaceName) {
            if (interfaceName !== 'amIAddonManagerStartup') {
              throw new MissingServiceError(`Components.interfaces.${String(interfaceName)}`);
            }
            record('Components.classes[addon-manager-startup].getService');
            return addonManagerStartup;
          },
        };
      }
      throw new MissingServiceError(`Components.classes[${String(name)}]`);
    },
  });
  const interfaces = new Proxy(Object.create(null), {
    get(_target, name) {
      if (name === 'amIAddonManagerStartup') return name;
      throw new MissingServiceError(`Components.interfaces.${String(name)}`);
    },
  });

  let sandboxSequence = 0;
  let bootstrapContext;
  const components = {
    classes,
    interfaces,
    utils: {
      Sandbox: function Sandbox(_principal, options = {}) {
        sandboxSequence += 1;
        record('Components.utils.Sandbox');
        trace({ type: 'sandbox', options });
        const globals = {};
        for (const key of options.wantGlobalProperties ?? []) {
          if (key in globalThis) {
            globals[key] = globalThis[key];
            record(`Node.global.${key}`);
          }
        }
        Object.assign(globals, {
          Components: components,
          Cc: classes,
          Ci: interfaces,
          Cu: components.utils,
          Services: services,
          ChromeUtils: chromeUtils,
        });
        for (const name of ['Components', 'Services', 'ChromeUtils']) {
          record(`Gecko.global.${name}`);
        }
        return vm.createContext(globals, { name: `addon-sandbox-${sandboxSequence}` });
      },
      getObjectPrincipal() {
        record('Components.utils.getObjectPrincipal');
        return { kind: 'Node VM principal' };
      },
      waiveXrays(value) {
        record('Components.utils.waiveXrays');
        return value;
      },
      nukeSandbox() {
        record('Components.utils.nukeSandbox');
      },
      importGlobalProperties(names) {
        for (const name of names) {
          if (!(name in globalThis)) throw new MissingServiceError(`Node.global.${name}`);
          bootstrapContext[name] = globalThis[name];
          record(`Components.utils.importGlobalProperties(${name})`);
        }
      },
    },
  };

  const chromeUtils = {
    importESModule(specifier) {
      trace({ type: 'importESModule', specifier });
      if (specifier === 'resource://gre/modules/Console.sys.mjs') {
        record('ChromeUtils.importESModule(Console.sys.mjs)');
        return { Console: console };
      }
      throw new MissingServiceError(`ChromeUtils.importESModule(${specifier})`);
    },
  };

  const io = {
    newURI(spec) {
      record('Services.io.newURI');
      return { spec: String(spec) };
    },
  };
  const scriptloader = {
    loadSubScript(spec, target) {
      return executeScript(spec, target, 'loadSubScript');
    },
    loadSubScriptWithOptions(spec, options) {
      return executeScript(spec, options.target, 'loadSubScriptWithOptions');
    },
  };
  const services = {
    io,
    scriptloader,
    prompt: {
      alert(_parent, title, message) {
        const error = new Error(`${title}: ${message}`);
        trace({ type: 'plugin-alert', title: String(title), message: String(message) });
        recordFirstFailure(result, error);
        const missing = String(message).match(/Missing host service: ([^\n]+)/);
        if (missing) result.missingService ??= missing[1];
      },
      confirm() {
        record('Services.prompt.confirm');
        return false;
      },
    },
  };

  function executeScript(spec, target, serviceName) {
    record(`Services.scriptloader.${serviceName}`);
    const url = new URL(spec);
    if (url.protocol !== 'file:') {
      throw new MissingServiceError(`Services.scriptloader URL protocol ${url.protocol}`);
    }
    const filename = fileURLToPath(url);
    if (!vm.isContext(target)) {
      Object.assign(target, {
        Components: components,
        Cc: classes,
        Ci: interfaces,
        Cu: components.utils,
        Services: services,
        ChromeUtils: chromeUtils,
        Zotero: zotero,
        ...nativeGlobals,
      });
      for (const name of ['Components', 'Services', 'ChromeUtils', 'Zotero']) {
        record(`Gecko.global.${name}`);
      }
      vm.createContext(target, { name: `addon-script:${path.basename(filename)}` });
    }
    trace({ type: 'loadSubScript', spec, filename });
    result.stages.push(`bundle-loading:${path.relative(path.dirname(fileURLToPath(rootURI)), filename)}`);
    try {
      const source = readFileSync(filename);
      vm.runInContext(source.toString('utf8'), target, {
        filename,
        timeout: timeoutMs,
        displayErrors: true,
      });
      result.stages.push(`bundle-evaluated:${path.relative(path.dirname(fileURLToPath(rootURI)), filename)}`);
      trace({ type: 'bundleEvaluated', filename, bytes: source.byteLength });
    } catch (error) {
      recordFirstFailure(result, error);
      throw error;
    }
  }

  const nodeGlobals = [
    'atob', 'btoa', 'Blob', 'BroadcastChannel', 'crypto', 'DOMException',
    'Event', 'EventTarget', 'fetch', 'FormData', 'Headers', 'MessageChannel',
    'MessagePort', 'Request', 'Response', 'structuredClone', 'TextDecoder',
    'TextEncoder', 'URL', 'URLSearchParams', 'WebSocket', 'XMLHttpRequest',
  ];
  const nativeGlobals = Object.fromEntries(
    nodeGlobals.filter((key) => key in globalThis).map((key) => [key, globalThis[key]]),
  );
  const context = vm.createContext({
    ...nativeGlobals,
    Zotero: zotero,
    Components: components,
    Cc: classes,
    Ci: interfaces,
    Cu: components.utils,
    Services: services,
    ChromeUtils: chromeUtils,
    ChromeWorker: trackedMissingObject('ChromeWorker'),
    Localization: trackedMissingObject('Localization'),
    FileUtils: trackedMissingObject('FileUtils'),
    PathUtils: trackedMissingObject('PathUtils'),
    IOUtils: trackedMissingObject('IOUtils'),
    setTimeout: (callback, delay, ...args) => addTimer(callback, delay, false, args),
    clearTimeout: clearTimer,
    setInterval: (callback, delay, ...args) => addTimer(callback, delay, true, args),
    clearInterval: clearTimer,
    dump(message) {
      trace({ type: 'log', level: 'dump', message: String(message) });
    },
    APP_SHUTDOWN: 2,
  }, { name: 'addon-bootstrap' });
  bootstrapContext = context;

  return {
    context,
    timers,
    clearTimer,
    trace,
    services,
    dispose() {
      for (const timer of timers) clearTimer(timer);
    },
  };
}

async function probePackage(pkg, outputDir, timeoutMs) {
  const result = {
    name: pkg.name,
    version: pkg.version,
    stages: [],
    providedServices: [],
    missingService: null,
    error: null,
    trace: [],
    functionalityVerified: false,
  };
  const unpackedParent = path.join(outputDir, 'node-unpacked');
  await fs.mkdir(unpackedParent, { recursive: true });

  try {
    const unpackedDir = await fs.mkdtemp(path.join(unpackedParent, `${packageDirectoryName(pkg)}-`));
    execFileSync('unzip', ['-q', pkg.path, '-d', unpackedDir], { stdio: 'pipe' });
    result.stages.push('xpi-unpacked');
    const bootstrapPath = path.join(unpackedDir, 'bootstrap.js');
    const bootstrap = await fs.readFile(bootstrapPath);
    const rootURI = pathToFileURL(`${unpackedDir}${path.sep}`).href;
    const runtime = createRuntime(result, rootURI, timeoutMs);
    try {
      vm.runInContext(bootstrap.toString('utf8'), runtime.context, {
        filename: bootstrapPath,
        timeout: timeoutMs,
        displayErrors: true,
      });
      result.stages.push('bootstrap-evaluated');
      const startup = runtime.context.startup;
      if (typeof startup !== 'function') throw new Error('Real bootstrap.js did not expose startup()');
      result.stages.push('startup-called');
      runtime.trace({ type: 'startup', reason: STARTUP_REASON, rootURI });
      const data = {
        id: pkg.id,
        version: pkg.version,
        rootURI,
        resourceURI: { spec: rootURI },
      };
      let watchdog;
      const timedOut = new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error(`Startup timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      try {
        await Promise.race([startup(data, STARTUP_REASON), timedOut]);
        result.stages.push('startup-settled');
      } finally {
        clearTimeout(watchdog);
      }
    } catch (error) {
      recordFirstFailure(result, error);
    } finally {
      runtime.dispose();
    }
  } catch (error) {
    recordFirstFailure(result, error);
  }
  return result;
}

export async function probeNode({ packages, outputDir, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new TypeError('packages must be a non-empty array');
  }
  if (!outputDir) throw new TypeError('outputDir is required');
  const absoluteOutputDir = path.resolve(outputDir);
  await fs.mkdir(path.join(absoluteOutputDir, 'node-unpacked'), { recursive: true });
  const results = [];
  for (const pkg of packages) {
    if (!pkg?.name || !pkg?.path || !pkg?.version || !pkg?.id) {
      throw new TypeError('Each package requires name, path, version, and id');
    }
    results.push(await probePackage(pkg, absoluteOutputDir, timeoutMs));
  }
  return results;
}

function readOption(name, args) {
  const prefix = `--${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option?.slice(prefix.length);
}

async function runCLI() {
  const assetRoot = readOption('asset-root', process.argv.slice(2));
  if (!assetRoot) throw new Error('Usage: node node-probe.mjs --asset-root=<directory>');
  const root = path.resolve(assetRoot);
  const packages = [
    {
      name: 'Better BibTeX',
      path: path.join(root, 'zotero-better-bibtex-9.0.68.xpi'),
      version: '9.0.68',
      id: 'better-bibtex@iris-advies.com',
    },
    {
      name: 'Jasminum',
      path: path.join(root, 'jasminum_1.1.39.xpi'),
      version: '1.1.39',
      id: 'jasminum@linxzh.com',
    },
  ];
  const results = await probeNode({ packages, outputDir: root });
  const summary = results.map(({ name, version, stages, missingService, error }) => ({
    name,
    version,
    lastStage: stages.at(-1) ?? null,
    missingService,
    error: error ? `${error.name}: ${error.message}` : null,
  }));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCLI().catch((error) => {
    process.stderr.write(`${cleanError(error).message}\n`);
    process.exitCode = 1;
  });
}
