import fs from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { resolveZoteroResource } from '../../apps/kernel/dist/zotero-resources.js';

test.skip(process.platform !== 'linux' || process.arch !== 'x64', 'Fixed Linux x64 layout');

const registration = { id: 'journals-local-v1', layout: 'linux-x64-electron-managed-v1' } as const;
const originalDisplay = process.env.DISPLAY;
const originalAuthority = process.env.XAUTHORITY;
test.beforeEach(() => {
  process.env.DISPLAY = ':synthetic-resource-check';
  process.env.XAUTHORITY = '/synthetic/xauthority';
});
test.afterEach(() => {
  if (originalDisplay === undefined) delete process.env.DISPLAY;
  else process.env.DISPLAY = originalDisplay;
  if (originalAuthority === undefined) delete process.env.XAUTHORITY;
  else process.env.XAUTHORITY = originalAuthority;
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-zotero-resources-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: directory });
  const root = join(directory, 'native-resources', 'zotero-journals-v1');
  const versionsText = await readFile(
    new URL('../../apps/zotero-host/resources/versions.json', import.meta.url),
    'utf8',
  );
  const versions = JSON.parse(versionsText);
  const packageManifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const manifest = {
    version: versions.bbt.version,
    applications: { zotero: { id: versions.bbt.id } },
  };
  const files: Record<string, string> = {
    'electron/electron': 'synthetic executable, never launched',
    'electron/version': packageManifest.devDependencies.electron,
    'host/out/main/managed.cjs': '',
    'host/out/preload/index.cjs': '',
    'host/out/renderer/index.html': '',
    'host/out/renderer/worker.html': '',
    'host/resources/versions.json': versionsText,
    'host/resources/dateFormats.json': '{}',
    'bbt/manifest.json': JSON.stringify(manifest),
    'bbt/bootstrap.js': 'synthetic bootstrap, never executed',
    'bbt/content/module.js': 'synthetic dependency, never executed',
  };
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, content, { mode: relative === 'electron/electron' ? 0o700 : 0o600 });
  }
  return { directory, root, manifest };
}

test('returns fixed paths and only a snapshot of the trusted display environment', async () => {
  const f = await fixture();
  // The logical registration ID never contributes a filesystem path or argument.
  const launch = await resolveZoteroResource({ ...registration, id: '../elsewhere' }, f.directory);
  expect(launch.executable).toBe(join(f.root, 'electron/electron'));
  expect(launch.args).toEqual([join(f.root, 'host/out/main/managed.cjs')]);
  expect(launch.packageDirectory).toBe(join(f.root, 'bbt'));
  expect(launch.displayEnvironment).toEqual({
    DISPLAY: ':synthetic-resource-check',
    XAUTHORITY: '/synthetic/xauthority',
  });
  process.env.DISPLAY = ':changed-after-resolution';
  expect(launch.displayEnvironment.DISPLAY).toBe(':synthetic-resource-check');
  const beforeLaunch = launch.beforeLaunch;
  await writeFile(join(f.directory, 'unrelated-kernel-state.json'), '{}', { mode: 0o600 });
  await beforeLaunch();
  expect(launch.beforeLaunch).toBe(beforeLaunch);
  delete process.env.XAUTHORITY;
  expect((await resolveZoteroResource(registration, f.directory)).displayEnvironment).toEqual({
    DISPLAY: ':changed-after-resolution',
  });
});

for (const relative of [
  '',
  'host/out',
  'electron/electron',
  'bbt/manifest.json',
  'bbt/bootstrap.js',
]) {
  test(`rejects a symlink at ${relative || 'the resource root'}, including same-config targets`, async () => {
    const f = await fixture();
    const target = join(f.root, relative);
    await rename(target, `${target}-original`);
    await symlink(`${target}-original`, target);
    await expect(resolveZoteroResource(registration, f.directory)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
}

for (const [relative, mode] of [
  ['electron/electron', 0o720],
  ['bbt/manifest.json', 0o602],
  ['host/out', 0o770],
  ['electron/electron', 0o600],
] as const) {
  test(`rejects unsafe permissions ${mode.toString(8)} on ${relative}`, async () => {
    const f = await fixture();
    await chmod(join(f.root, relative), mode);
    await expect(resolveZoteroResource(registration, f.directory)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
}

for (const change of [
  'manifest-id',
  'manifest-version',
  'electron-version',
  'missing-entry',
  'missing-bootstrap',
]) {
  test(`beforeLaunch revalidates ${change} after successful resolution`, async () => {
    const f = await fixture();
    const launch = await resolveZoteroResource(registration, f.directory);
    if (change === 'missing-entry' || change === 'missing-bootstrap') {
      const entry = join(
        f.root,
        change === 'missing-entry' ? 'host/out/preload/index.cjs' : 'bbt/bootstrap.js',
      );
      await rename(entry, `${entry}-original`);
    } else if (change === 'electron-version') {
      await writeFile(join(f.root, 'electron/version'), '0.0.0');
    } else {
      if (change === 'manifest-id') f.manifest.applications.zotero.id = 'unexpected-plugin';
      else f.manifest.version = '0.0.0';
      await writeFile(join(f.root, 'bbt/manifest.json'), JSON.stringify(f.manifest));
    }
    await expect(launch.beforeLaunch()).rejects.toMatchObject({ code: 'unavailable' });
  });
}

for (const change of ['entry-replaced', 'entry-rewritten', 'dependency-rewritten'] as const) {
  test(`beforeLaunch rejects ${change} while version markers remain valid`, async () => {
    const f = await fixture();
    const launch = await resolveZoteroResource(registration, f.directory);
    const entry = join(
      f.root,
      change === 'dependency-rewritten' ? 'bbt/content/module.js' : 'host/out/main/managed.cjs',
    );
    if (change === 'entry-replaced') await rename(entry, join(f.directory, 'original-entry.cjs'));
    await writeFile(entry, 'changed code, never executed', { mode: 0o600 });
    await expect(launch.beforeLaunch()).rejects.toMatchObject({ code: 'unavailable' });
  });
}

for (const fault of ['external-link', 'ancestor-permissions'] as const) {
  test(`resource ${fault} during enumeration refuses the original launch`, async () => {
    const f = await fixture();
    const empty = join(f.root, 'bbt/empty');
    const outside = join(f.directory, 'outside');
    await mkdir(empty, { mode: 0o700 });
    await mkdir(outside, { mode: 0o700 });
    const launch = await resolveZoteroResource(registration, f.directory);
    const original = fs.promises.opendir;
    let replaced = false;
    fs.promises.opendir = async (path, options) => {
      if (!replaced && (await realpath(path)) === (fault === 'external-link' ? empty : f.root)) {
        replaced = true;
        if (fault === 'external-link') {
          await rename(empty, join(f.directory, 'preserved-empty'));
          await symlink(outside, empty);
        } else await chmod(f.directory, 0o777);
      }
      return original(path, options);
    };
    syncBuiltinESMExports();
    try {
      await expect(launch.beforeLaunch()).rejects.toMatchObject({ code: 'unavailable' });
      expect(replaced).toBe(true);
      if (fault === 'external-link') expect(await realpath(empty)).toBe(outside);
    } finally {
      fs.promises.opendir = original;
      syncBuiltinESMExports();
      await chmod(f.directory, 0o700);
    }
  });
}

test('missing DISPLAY fails only when resolving resources', async () => {
  delete process.env.DISPLAY;
  await expect(resolveZoteroResource(registration, '/unused-config')).rejects.toMatchObject({
    code: 'unavailable',
  });
});

test('the fixed system sandbox link is witnessed and replacement refuses the original launch', async () => {
  const helper = '/opt/google/chrome/chrome-sandbox';
  const installed = await fs.promises.lstat(helper).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  test.skip(!installed, 'Requires the already installed root-owned system sandbox helper');
  const f = await fixture();
  const link = join(f.root, 'electron', 'chrome-sandbox');
  await symlink(helper, link);
  const launch = await resolveZoteroResource(registration, f.directory);
  await launch.beforeLaunch();
  await rename(link, `${link}-original`);
  await symlink(join(f.root, 'bbt', 'bootstrap.js'), link);
  await expect(launch.beforeLaunch()).rejects.toMatchObject({ code: 'unavailable' });
});

for (const fault of ['wrong-target', 'wrong-slot'] as const) {
  test(`system sandbox rejects ${fault} without expanding other resource links`, async () => {
    const f = await fixture();
    const link = join(
      f.root,
      fault === 'wrong-slot' ? 'host/resources/chrome-sandbox' : 'electron/chrome-sandbox',
    );
    await symlink(
      fault === 'wrong-target'
        ? join(f.root, 'bbt', 'bootstrap.js')
        : '/opt/google/chrome/chrome-sandbox',
      link,
    );
    await expect(resolveZoteroResource(registration, f.directory)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
}

test('beforeLaunch rejects a safe permission change to a system sandbox ancestor', async () => {
  const helper = '/opt/google/chrome/chrome-sandbox';
  const installed = await fs.promises.lstat(helper).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  test.skip(!installed, 'Requires the already installed root-owned system sandbox helper');
  const f = await fixture();
  await symlink(helper, join(f.root, 'electron', 'chrome-sandbox'));
  const launch = await resolveZoteroResource(registration, f.directory);
  const original = fs.promises.lstat;
  let observed = false;
  fs.promises.lstat = (async (path, options) => {
    const stat = await original(path, options);
    if (path === '/opt/google/chrome' && typeof stat.mode === 'bigint') {
      observed = true;
      return Object.assign(stat, { mode: stat.mode & ~0o200n });
    }
    return stat;
  }) as typeof original;
  syncBuiltinESMExports();
  try {
    await expect(launch.beforeLaunch()).rejects.toMatchObject({ code: 'unavailable' });
    expect(observed).toBe(true);
  } finally {
    fs.promises.lstat = original;
    syncBuiltinESMExports();
  }
});
