import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import versions from '../../resources/versions.json';
import { createEnvironment, type HostCatalog } from './environment';
import { createWorkers } from './workers';

type State =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'failed'
  | 'closing'
  | 'closed'
  | 'unknown';
type Options = {
  packageDirectory: string;
  profileDirectory: string;
  dateFormats: string;
  rendererDirectory: string;
  preload: string;
  catalog: HostCatalog;
};
const missing = [
  'sourceIdentity',
  'citationKey',
  'mutationOutcome',
  'managedHost',
  'deleteRestore',
];

function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Host operation deadline exceeded')), ms);
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
      .catch(() => {});
  });
}

/** Local plugin Module. Its injected catalog is not a production library connection. */
export class ZoteroHost {
  private state: State = 'idle';
  private stage = 'notStarted';
  private readonly diagnostics: string[] = [];
  private environment: ReturnType<typeof createEnvironment> | undefined;
  private workers: Awaited<ReturnType<typeof createWorkers>> | undefined;
  private readonly active = new Set<Promise<unknown>>();
  private pending: Promise<unknown> = Promise.resolve();
  private starting: Promise<ReturnType<ZoteroHost['status']>> | undefined;
  private closing: Promise<ReturnType<ZoteroHost['status']>> | undefined;
  private shutdownUnconfirmed = false;

  constructor(private readonly options: Options) {}

  status() {
    return {
      state: this.state,
      stage: this.stage,
      scope: 'injected-adapter' as const,
      versions: { zotero: versions.zotero.version, bbt: versions.bbt.version },
      runtime: {
        node: process.versions.node,
        electron: process.versions.electron,
        chromium: process.versions.chrome,
      },
      diagnostics: [...this.diagnostics],
      production: { available: false as const, missing: [...missing] },
    };
  }

  private diagnostic = (message: string) => {
    for (const key of [
      'packageDirectory',
      'profileDirectory',
      'dateFormats',
      'rendererDirectory',
      'preload',
    ] as const) {
      message = message.replaceAll(this.options[key], `<${key}>`);
    }
    this.diagnostics.push(message.slice(0, 512));
    if (this.diagnostics.length > 32) this.diagnostics.shift();
  };

  private track<T>(promise: Promise<T>): Promise<T> {
    this.active.add(promise);
    void promise.finally(() => this.active.delete(promise)).catch(() => {});
    return promise;
  }

  start() {
    if (this.state !== 'idle') throw new Error('Create a new host instance before starting again');
    this.state = 'starting';
    this.starting = this.initialize();
    return this.starting;
  }

  private ensureStarting() {
    if (this.state !== 'starting') throw new Error('Startup cancelled');
  }

  private async initialize() {
    try {
      if (process.platform === 'darwin')
        throw new Error('Managed host execution is unavailable on macOS');
      this.stage = 'package';
      const manifest = JSON.parse(
        await readFile(join(this.options.packageDirectory, 'manifest.json'), 'utf8'),
      ) as { version?: string; applications?: { zotero?: { id?: string } } };
      this.ensureStarting();
      if (
        manifest.version !== versions.bbt.version ||
        manifest.applications?.zotero?.id !== versions.bbt.id
      ) {
        throw new Error('Expected the Better BibTeX 9.0.68 release package');
      }
      this.stage = 'chromium';
      this.workers = await createWorkers({ ...this.options, diagnostic: this.diagnostic });
      void this.workers.failure.catch(() => {
        if (this.state === 'ready') {
          this.state = 'degraded';
          this.stage = 'workerFailed';
        }
      });
      this.ensureStarting();
      this.environment = createEnvironment({
        ...this.options,
        ChromeWorker: this.workers.ChromeWorker,
        diagnostic: this.diagnostic,
      });
      const environment = this.environment;
      this.stage = 'bootstrap';
      const filename = join(this.options.packageDirectory, 'bootstrap.js');
      const bootstrap = await readFile(filename, 'utf8');
      this.ensureStarting();
      vm.runInContext(bootstrap, environment.context, {
        filename,
        timeout: 12_000,
      });
      this.ensureStarting();
      this.stage = 'startup';
      const rootURI = pathToFileURL(`${this.options.packageDirectory}/`).href;
      await deadline(
        Promise.race([
          this.track(environment.context.startup({ rootURI, resourceURI: { spec: rootURI } }, 1)),
          this.workers.failure,
        ]),
        30_000,
      );
      this.ensureStarting();
      if (
        environment.failures.length ||
        !environment.zotero.BetterBibTeX ||
        environment.zotero.BetterBibTeX.starting
      ) {
        throw new Error(
          environment.failures.join('\n') || 'Original bootstrap did not make the plugin ready',
        );
      }
      this.state = 'ready';
      this.stage = 'ready';
    } catch (error) {
      if (this.state === 'closing' || this.state === 'closed') return this.status();
      this.diagnostic(String(error));
      this.state = this.active.size ? 'unknown' : 'failed';
      if (!this.active.size) {
        const stage = this.stage;
        try {
          await this.dispose();
        } catch (cleanupError) {
          this.diagnostic(String(cleanupError));
          this.state = 'unknown';
        }
        this.stage = stage;
      }
    }
    return this.status();
  }

  private items(sourceIds: string[]) {
    if (
      !sourceIds.length ||
      sourceIds.length > 100 ||
      new Set(sourceIds).size !== sourceIds.length
    ) {
      throw new Error('Select 1–100 distinct sample sources');
    }
    return sourceIds.map((sourceId) => this.options.catalog.item(sourceId));
  }

  private run<T>(stage: string, mayWrite: boolean, operation: () => Promise<T>): Promise<T> {
    const workers = this.workers;
    if (this.state !== 'ready' || !workers) return Promise.reject(new Error('Plugin is not ready'));
    const result = this.pending.then(async () => {
      if (this.state !== 'ready') throw new Error('Plugin is not ready');
      this.stage = stage;
      try {
        const work = operation();
        // Lost read waits can be abandoned; unconfirmed mutations must retain their owner.
        const value = await deadline(
          Promise.race([mayWrite ? this.track(work) : work, workers.failure]),
          30_000,
        );
        if (this.state === 'ready') this.stage = 'ready';
        return value;
      } catch (error) {
        if (this.state === 'ready') this.state = 'degraded';
        this.diagnostic(String(error));
        throw error;
      }
    });
    this.pending = result.catch(() => {});
    return result;
  }

  fillKeys(sourceIds: string[]) {
    const items = this.items(sourceIds);
    return this.run('fillKeys', true, async () => {
      await this.environment?.zotero.BetterBibTeX?.KeyManager.fill(items.map((item) => item.id));
      return items.map((item) => ({ itemId: item.id, citationKey: item.getField('citationKey') }));
    });
  }

  export(sourceIds: string[], format: 'bibtex' | 'biblatex') {
    const items = this.items(sourceIds);
    if (format !== 'bibtex' && format !== 'biblatex') throw new Error('Unsupported export format');
    if (items.some((item) => !item.getField('citationKey')))
      throw new Error('Fill missing keys explicitly before exporting');
    return this.run('export', false, async () => {
      const translators = this.environment?.zotero.BetterBibTeX?.Translators;
      const translator =
        translators?.bySlug[format === 'bibtex' ? 'BetterBibTeX' : 'BetterBibLaTeX'];
      if (!translators || !translator) throw new Error('Original translator is unavailable');
      const output = await translators.exportItems({
        translatorID: translator.translatorID,
        scope: { type: 'items', items },
        displayOptions: { worker: true },
      });
      if (Buffer.byteLength(output) > 256 * 1024) throw new Error('Export exceeds 256 KiB');
      return output;
    });
  }

  private async dispose() {
    const environment = this.environment;
    try {
      if (typeof environment?.context.shutdown === 'function') {
        const before = environment.failures.length;
        await deadline(this.track(environment.context.shutdown({}, 4)), 5_000);
        if (environment.failures.length !== before)
          throw new Error(environment.failures.slice(before).join('\n'));
      }
    } catch (error) {
      this.shutdownUnconfirmed = true;
      throw error;
    } finally {
      environment?.dispose();
      await this.workers?.close();
      this.environment = undefined;
      this.workers = undefined;
    }
  }

  close() {
    if (this.closing) return this.closing;
    if (this.shutdownUnconfirmed) return Promise.resolve(this.status());
    if (this.state === 'closed') return Promise.resolve(this.status());
    this.state = 'closing';
    this.closing = (async () => {
      try {
        await deadline(
          Promise.allSettled([
            ...this.active,
            this.pending,
            ...(this.starting ? [this.starting] : []),
          ]),
          5_000,
        );
        await this.dispose();
        this.state = 'closed';
        this.stage = 'localResourcesClosed';
      } catch (error) {
        this.state = 'unknown';
        this.diagnostic(String(error));
      }
      return this.status();
    })().finally(() => {
      this.closing = undefined;
    });
    return this.closing;
  }
}
