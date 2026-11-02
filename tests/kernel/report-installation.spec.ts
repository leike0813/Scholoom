import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { loadHostSettings } from '../../apps/kernel/dist/host-settings.js';
import {
  loadReportInstallation,
  protectedReportFile,
} from '../../apps/kernel/dist/report-installation.js';

test('report selection is private configuration; absent configuration enables no runtime and untrusted installation files are refused', async () => {
  const root = test.info().outputPath('profile');
  await mkdir(root, { recursive: true, mode: 0o700 });
  expect(await loadReportInstallation(root)).toBeUndefined();
  const candidate = join(root, 'installed.json');
  await writeFile(
    candidate,
    JSON.stringify({ programId: 'scholoom-interactive-report', programVersion: '1' }),
  );
  const settings = {
    version: 1,
    kernelDirectory: await realpath(root),
    zotero: { enabled: false },
    reports: { installationFile: candidate },
  };
  const file = join(root, 'host-settings.json');
  await writeFile(file, JSON.stringify(settings), { mode: 0o600 });
  expect((await loadHostSettings(root)).state).toBe('disabled');
  await expect(loadReportInstallation(root)).rejects.toMatchObject({ code: 'unavailable' });
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(settings);
  await writeFile(
    file,
    JSON.stringify({ ...settings, reports: { ...settings.reports, programId: 'another-program' } }),
  );
  expect((await loadHostSettings(root)).state).toBe('invalid');
  await expect(loadReportInstallation(root)).rejects.toMatchObject({ code: 'unavailable' });
});

test('the installed-role file reader accepts an existing protected system file and refuses relative paths', async () => {
  test.skip(process.platform !== 'linux', 'The current installation targets Linux.');
  const systemFile = await realpath('/etc/os-release');
  expect(await protectedReportFile(systemFile)).toEqual(await readFile(systemFile));
  await expect(protectedReportFile('relative/installed.json')).rejects.toMatchObject({
    code: 'unavailable',
  });
});
