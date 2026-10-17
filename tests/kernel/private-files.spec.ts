import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execute = promisify(execFile);

test('Windows private directories retain exclusive inheritable access without security modules', async () => {
  test.skip(process.platform !== 'win32', 'Windows directory ACLs');
  const testInfo = test.info();
  const modules = testInfo.outputPath('modules');
  const module = join(modules, 'Microsoft.PowerShell.Security');
  await mkdir(module, { recursive: true });
  await writeFile(
    join(module, 'Microsoft.PowerShell.Security.psd1'),
    "@{ RootModule = 'Microsoft.PowerShell.Security.psm1'; ModuleVersion = '99.0.0'; FunctionsToExport = @('Set-Acl') }",
  );
  await writeFile(
    join(module, 'Microsoft.PowerShell.Security.psm1'),
    "throw 'Security module cannot load in this environment'",
  );
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === 'psmodulepath') delete environment[key];
  }
  environment.PSModulePath = modules;
  const directory = testInfo.outputPath('私有 profile');
  const helper = new URL('../../apps/kernel/dist/storage/private-files.js', import.meta.url).href;
  const source = [
    `import { privateDirectory, atomicPrivateFile } from ${JSON.stringify(helper)};`,
    'await privateDirectory(process.argv[1]);',
    'await privateDirectory(process.argv[1]);',
    'await atomicPrivateFile(process.argv[1], "probe.txt", "private");',
  ].join('\n');
  await execute(process.execPath, ['--input-type=module', '-e', source, directory], {
    env: environment,
    windowsHide: true,
  });

  const script = [
    '$ErrorActionPreference = "Stop"',
    '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$directory = [System.IO.Directory]::GetAccessControl($env:SCHOOLOOM_ACL_TEST_PATH)',
    '$file = [System.IO.File]::GetAccessControl([System.IO.Path]::Combine($env:SCHOOLOOM_ACL_TEST_PATH, "probe.txt"))',
    '$result = @{ protected = $directory.AreAccessRulesProtected; ownerMatches = ($directory.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -eq $sid.Value) }',
    'foreach ($entry in @{ directory = $directory; file = $file }.GetEnumerator()) {',
    '$rules = $entry.Value.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])',
    '$result[$entry.Key] = @($rules | ForEach-Object { @{ currentUser = ($_.IdentityReference.Value -eq $sid.Value); fullControl = ($_.FileSystemRights -eq [System.Security.AccessControl.FileSystemRights]::FullControl); inherited = $_.IsInherited; allowed = ($_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow) } })',
    '}',
    '$result | ConvertTo-Json -Compress -Depth 4',
  ].join('\n');
  const { stdout } = await execute(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      env: { ...environment, SCHOOLOOM_ACL_TEST_PATH: directory },
      windowsHide: true,
    },
  );
  expect(JSON.parse(stdout)).toEqual({
    protected: true,
    ownerMatches: true,
    directory: [{ currentUser: true, fullControl: true, inherited: false, allowed: true }],
    file: [{ currentUser: true, fullControl: true, inherited: true, allowed: true }],
  });
});
