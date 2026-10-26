import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const xpi = process.env.SCHOOLOOM_BBT_XPI;
test.skip(!xpi, 'Set SCHOOLOOM_BBT_XPI to the unmodified BBT 9.0.68 release asset.');
test.skip(process.platform === 'darwin', 'Managed plugin execution remains unavailable on macOS.');

async function sample(directory: string, manual = false) {
  const packageDirectory = join(directory, 'package');
  execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
  const app = await electron.launch({
    args: [join(root, 'tests/fixtures/zotero-host/main.cjs')],
    env: {
      ...process.env,
      SCHOOLOOM_BBT_PACKAGE: packageDirectory,
      SCHOOLOOM_BBT_PROFILE: join(directory, 'profile'),
      SCHOOLOOM_BBT_MANUAL_START: manual ? '1' : '0',
    },
  });
  try {
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture')?.host.status().state), {
        timeout: 30_000,
      })
      .toBe(manual ? 'idle' : 'ready');
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}

test('original BBT starts and closes with an empty injected catalog', async () => {
  const app = await sample(await mkdtemp(join(tmpdir(), 'scholoom-bbt-empty-')), true);
  try {
    const started = await app.evaluate(async () => {
      const fixture = Reflect.get(globalThis, 'fixture');
      await fixture.catalog.zotero.DB.queryAsync('DELETE FROM literature');
      return fixture.host.start();
    });
    expect(started.state).toBe('ready');
    expect(started.production.available).toBe(false);
    expect((await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close())).state).toBe(
      'closed',
    );
  } finally {
    await app.close();
  }
});

test('original BBT on Electron preserves keys and exports committed sample changes', async () => {
  test.setTimeout(45_000);
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-bbt-electron-'));
  const packageDirectory = join(directory, 'package');
  execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
  const original = await readFile(xpi as string);
  const launchOptions = {
    args: [join(root, 'tests/fixtures/zotero-host/main.cjs')],
    env: {
      ...process.env,
      SCHOOLOOM_BBT_PACKAGE: packageDirectory,
      SCHOOLOOM_BBT_PROFILE: join(directory, 'profile'),
    },
  };
  const app = await electron.launch(launchOptions);
  try {
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture')?.host.status().state), {
        timeout: 30_000,
      })
      .toBe('ready');
    const before = await app.evaluate(() =>
      Reflect.get(globalThis, 'fixture').catalog.read('sample-preserved'),
    );
    expect(
      await app.evaluate(
        () => Reflect.get(globalThis, 'fixture').catalog.read('sample-missing').citationKey,
      ),
    ).toBeFalsy();
    await app.evaluate(() =>
      Reflect.get(globalThis, 'fixture').host.fillKeys(['sample-missing', 'sample-preserved']),
    );
    const page = await app.firstWindow();
    expect(await page.evaluate(() => typeof Reflect.get(globalThis, 'require'))).toBe('undefined');
    for (const format of ['bibtex', 'biblatex']) {
      const output = await app.evaluate(
        (_electron, format) =>
          Reflect.get(globalThis, 'fixture').host.export(
            ['sample-missing', 'sample-preserved'],
            format,
          ),
        format,
      );
      expect(output).toContain('chenResearchAgentsReproducible2026');
      expect(output).toContain('ScholoomPreserved2026');
      expect(output).toContain('10.0000/scholoom-prototype');
      await writeFile(test.info().outputPath(`${format}.bib`), output);
    }
    await app.evaluate(async () => {
      const item = Reflect.get(globalThis, 'fixture').catalog.item('sample-missing');
      item.setField('title', 'Mutation control without notification');
      await item.saveTx({ skipNotifier: true });
    });
    const stale = await app.evaluate(() =>
      Reflect.get(globalThis, 'fixture').host.export(['sample-missing'], 'bibtex'),
    );
    expect(stale.toLowerCase()).not.toContain('mutation control without notification');
    expect(stale).toContain('10.0000/scholoom-prototype');
    await app.evaluate(async () => {
      const fixture = Reflect.get(globalThis, 'fixture');
      const item = fixture.catalog.item('sample-missing');
      item.setField('title', 'Updated research agents after committed notification');
      item.setField('DOI', '10.0000/updated-with-notification');
      await item.saveTx();
    });
    const updated = await app.evaluate(() =>
      Reflect.get(globalThis, 'fixture').host.export(['sample-missing'], 'bibtex'),
    );
    expect(updated).toContain('10.0000/updated-with-notification');
    expect(updated.toLowerCase()).toContain('updated research agents');
    expect(updated).toContain('chenResearchAgentsReproducible2026');
    await writeFile(test.info().outputPath('updated.bib'), updated);
    expect(
      await app.evaluate(() => Reflect.get(globalThis, 'fixture').catalog.read('sample-preserved')),
    ).toEqual(before);
    const stopped = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
    expect(stopped.state).toBe('closed');
    expect(stopped.production.available).toBe(false);
    expect(stopped.production.missing).toContain('citationKey');
  } catch (error) {
    const status = await app
      .evaluate(() => Reflect.get(globalThis, 'fixture')?.host.status())
      .catch(() => null);
    await test
      .info()
      .attach('host-status', { body: JSON.stringify(status), contentType: 'application/json' });
    console.error(status);
    throw error;
  } finally {
    await app.close();
  }
  const restarted = await electron.launch(launchOptions);
  try {
    await expect
      .poll(
        () => restarted.evaluate(() => Reflect.get(globalThis, 'fixture')?.host.status().state),
        { timeout: 30_000 },
      )
      .toBe('ready');
    const output = await restarted.evaluate(() =>
      Reflect.get(globalThis, 'fixture').host.export(
        ['sample-missing', 'sample-preserved'],
        'biblatex',
      ),
    );
    expect(output).toContain('chenResearchAgentsReproducible2026');
    expect(output).toContain('ScholoomPreserved2026');
    expect(output).toContain('10.0000/updated-with-notification');
    await writeFile(test.info().outputPath('restarted.bib'), output);
    expect(
      (await restarted.evaluate(() => Reflect.get(globalThis, 'fixture').host.close())).state,
    ).toBe('closed');
  } finally {
    await restarted.close();
  }
  expect((await readFile(xpi as string)).equals(original)).toBe(true);
  for (const member of [
    'bootstrap.js',
    'content/better-bibtex.js',
    'content/worker/zotero.js',
    'content/resource/Better BibTeX.js',
    'content/resource/Better BibLaTeX.js',
  ]) {
    expect(
      (await readFile(join(packageDirectory, member))).equals(
        execFileSync('unzip', ['-p', xpi as string, member], { maxBuffer: 20 * 1024 * 1024 }),
      ),
    ).toBe(true);
  }
});

test('closing during startup cannot make a closed host ready again', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-bbt-cancel-'));
  const packageDirectory = join(directory, 'package');
  execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
  const app = await electron.launch({
    args: [join(root, 'tests/fixtures/zotero-host/main.cjs')],
    env: {
      ...process.env,
      SCHOOLOOM_BBT_PACKAGE: packageDirectory,
      SCHOOLOOM_BBT_PROFILE: join(directory, 'profile'),
      SCHOOLOOM_BBT_MANUAL_START: '1',
    },
  });
  try {
    await expect.poll(() => app.evaluate(() => !!Reflect.get(globalThis, 'fixture'))).toBe(true);
    const status = await app.evaluate(async () => {
      const { host } = Reflect.get(globalThis, 'fixture');
      const starting = host.start();
      await host.close();
      await starting;
      return host.status();
    });
    expect(status.state).toBe('closed');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  } finally {
    await app.close();
  }
});

test('a mismatched plugin version fails before creating a Worker window', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-bbt-wrong-version-'));
  const packageDirectory = join(directory, 'package');
  await mkdir(packageDirectory);
  await writeFile(join(packageDirectory, 'manifest.json'), JSON.stringify({ version: '0.0.0' }));
  const app = await electron.launch({
    args: [join(root, 'tests/fixtures/zotero-host/main.cjs')],
    env: {
      ...process.env,
      SCHOOLOOM_BBT_PACKAGE: packageDirectory,
      SCHOOLOOM_BBT_PROFILE: join(directory, 'profile'),
    },
  });
  try {
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture')?.host.status().state))
      .toBe('failed');
    const status = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.status());
    expect(status.stage).toBe('package');
    expect(status.diagnostics.length).toBeGreaterThan(0);
    expect(status.production.available).toBe(false);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  } finally {
    await app.close();
  }
});

test('a save that finishes after a close timeout can be reconciled and closed', async () => {
  const app = await sample(await mkdtemp(join(tmpdir(), 'scholoom-bbt-late-save-')));
  try {
    await app.evaluate(() => {
      const fixture = Reflect.get(globalThis, 'fixture');
      const item = fixture.catalog.item('sample-missing');
      const save = item.saveTx.bind(item);
      item.saveTx = async (...args: unknown[]) => {
        fixture.saveStarted = true;
        await new Promise((resolve) => {
          fixture.releaseSave = resolve;
        });
        return save(...args);
      };
      fixture.filling = fixture.host.fillKeys(['sample-missing']);
      void fixture.filling.catch((error: unknown) => {
        fixture.fillError = String(error);
      });
    });
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture').saveStarted))
      .toBe(true);
    expect((await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close())).state).toBe(
      'unknown',
    );
    const stopped = await app.evaluate(async () => {
      const fixture = Reflect.get(globalThis, 'fixture');
      fixture.releaseSave();
      await fixture.filling;
      return fixture.host.close();
    });
    expect(stopped.state).toBe('closed');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  } finally {
    await app.close();
  }
});

test('a blocked renderer makes the host unavailable and cannot block local cleanup', async () => {
  const app = await sample(await mkdtemp(join(tmpdir(), 'scholoom-bbt-busy-renderer-')));
  try {
    const page = await app.firstWindow();
    const busy = page
      .evaluate(() => {
        Reflect.get(globalThis, 'zoteroWorkerEvents').emit(1, 'error', 'fixture renderer blocked');
        while (true) {
          /* controlled failure at the renderer boundary */
        }
      })
      .catch(() => {});
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture').host.status().state))
      .toBe('degraded');
    await expect(
      app.evaluate(() =>
        Reflect.get(globalThis, 'fixture').host.export(['sample-preserved'], 'bibtex'),
      ),
    ).rejects.toThrow();
    const stopped = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
    expect(['closed', 'unknown']).toContain(stopped.state);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
    await busy;
  } finally {
    await app.close();
  }
});

test('a dangling profile link cannot write outside the profile', async () => {
  test.skip(
    process.platform === 'win32',
    'Creating Windows symbolic links requires separate privileges.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-bbt-dangling-link-'));
  const translatorDirectory = join(directory, 'profile/translators');
  await mkdir(translatorDirectory, { recursive: true });
  const target = join(directory, 'outside-translator.js');
  await symlink(target, join(translatorDirectory, 'Better BibTeX.js'));
  const app = await sample(directory, true);
  try {
    await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.start());
    expect(
      await readFile(target).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.status().state),
    ).not.toBe('ready');
    await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
  } finally {
    await app.close();
  }
});

test('an in-flight export cannot retain a crashed renderer indefinitely', async () => {
  const app = await sample(await mkdtemp(join(tmpdir(), 'scholoom-bbt-lost-export-')));
  try {
    await app.evaluate(async ({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]?.webContents;
      if (!contents) throw new Error('Worker window is unavailable');
      contents.debugger.attach();
      await contents.debugger.sendCommand('Debugger.enable');
      await contents.debugger.sendCommand('Debugger.pause');
      const fixture = Reflect.get(globalThis, 'fixture');
      fixture.exporting = fixture.host.export(['sample-preserved'], 'bibtex');
      void fixture.exporting.catch(() => {});
    });
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixture').host.status().stage))
      .toBe('export');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer(),
    );
    await expect(
      app.evaluate(() => Reflect.get(globalThis, 'fixture').exporting),
    ).rejects.toThrow();
    const result = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
    expect(['closed', 'unknown']).toContain(result.state);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  } finally {
    await app.close();
  }
});

test('retrying close cannot erase an unconfirmed plugin flush', async () => {
  test.skip(
    process.platform === 'win32',
    'Creating Windows symbolic links requires separate privileges.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-bbt-flush-failure-'));
  const app = await sample(directory);
  try {
    await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.fillKeys(['sample-missing']));
    const target = join(directory, 'outside-cache.json');
    await symlink(target, join(directory, 'profile/better-bibtex/read-only.json'));
    const first = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
    expect(first.state).toBe('unknown');
    const retried = await app.evaluate(() => Reflect.get(globalThis, 'fixture').host.close());
    expect(retried.state).toBe('unknown');
    expect(
      await readFile(target).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  } finally {
    await app.close();
  }
});
