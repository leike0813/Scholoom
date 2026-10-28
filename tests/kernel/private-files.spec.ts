import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execute = promisify(execFile);

test('Windows private directories retain exclusive inheritable access without setter cmdlets', async () => {
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
  const utility = join(modules, 'Microsoft.PowerShell.Utility');
  await mkdir(utility, { recursive: true });
  await writeFile(
    join(utility, 'Microsoft.PowerShell.Utility.psd1'),
    "@{ RootModule = 'Microsoft.PowerShell.Utility.psm1'; ModuleVersion = '99.0.0'; FunctionsToExport = @('New-Object') }",
  );
  await writeFile(
    join(utility, 'Microsoft.PowerShell.Utility.psm1'),
    "throw 'Utility module cannot load in this environment'",
  );
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === 'psmodulepath') delete environment[key];
  }
  environment.PSModulePath = modules;
  const directory = testInfo.outputPath('私有 profile');
  const helper = new URL('../../packages/platform/dist/node.js', import.meta.url).href;
  const source = [
    `import { privateDirectory, atomicPrivateFile } from ${JSON.stringify(helper)};`,
    'import { lstat, open } from "node:fs/promises";',
    'import { join } from "node:path";',
    'const fingerprint = (s) => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String);',
    'await privateDirectory(process.argv[1]);',
    'await atomicPrivateFile(process.argv[1], "probe.txt", "private");',
    'const path = join(process.argv[1], "probe.txt");',
    'const before = fingerprint(await lstat(path, { bigint: true }));',
    'await privateDirectory(process.argv[1]);',
    'const after = fingerprint(await lstat(path, { bigint: true }));',
    'const file = await open(path, "r");',
    'try { console.log(JSON.stringify({ before, after, opened: fingerprint(await file.stat({ bigint: true })), contentUnchanged: (await file.readFile("utf8")) === "private" })); } finally { await file.close(); }',
  ].join('\n');
  const probe = await execute(process.execPath, ['--input-type=module', '-e', source, directory], {
    env: environment,
    windowsHide: true,
  });
  const metadata = JSON.parse(probe.stdout);
  await writeFile(
    testInfo.outputPath('repeated-private-directory-metadata.json'),
    JSON.stringify(metadata),
  );
  await testInfo.attach('repeated-private-directory-metadata', {
    body: JSON.stringify(metadata),
    contentType: 'application/json',
  });
  expect(metadata.contentUnchanged).toBe(true);
  expect(metadata.opened).toEqual(metadata.after);
  expect(metadata.after).toEqual(metadata.before);
  await expectPrivateAccess(directory);
});

async function expectPrivateAccess(directory: string) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$directory = [System.IO.Directory]::GetAccessControl($env:SCHOOLOOM_ACL_TEST_PATH)',
    '$file = [System.IO.File]::GetAccessControl([System.IO.Path]::Combine($env:SCHOOLOOM_ACL_TEST_PATH, "probe.txt"))',
    '$result = @{ protected = $directory.AreAccessRulesProtected; ownerMatches = ($directory.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -eq $sid.Value) }',
    '$raw = [System.Security.AccessControl.RawSecurityDescriptor]::new($directory.GetSecurityDescriptorBinaryForm(), 0)',
    '$result.ordinary = ($raw.DiscretionaryAcl.Count -eq 1 -and $raw.DiscretionaryAcl[0].AceType -eq [System.Security.AccessControl.AceType]::AccessAllowed)',
    '$directoryRules = $directory.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])',
    '$result.inheritable = ($directoryRules.Count -eq 1 -and $directoryRules[0].InheritanceFlags -eq ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit) -and $directoryRules[0].PropagationFlags -eq [System.Security.AccessControl.PropagationFlags]::None)',
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
      env: { ...process.env, SCHOOLOOM_ACL_TEST_PATH: directory },
      windowsHide: true,
    },
  );
  expect(JSON.parse(stdout)).toEqual({
    protected: true,
    ownerMatches: true,
    ordinary: true,
    inheritable: true,
    directory: [{ currentUser: true, fullControl: true, inherited: false, allowed: true }],
    file: [{ currentUser: true, fullControl: true, inherited: true, allowed: true }],
  });
}

for (const fault of ['extra-rule', 'missing-inheritance', 'conditional-rule'] as const) {
  test(`Windows private directories repair ${fault} instead of reusing a prior check`, async () => {
    test.skip(process.platform !== 'win32', 'Windows directory ACLs');
    const directory = test.info().outputPath('private-profile');
    const helper = new URL('../../packages/platform/dist/node.js', import.meta.url).href;
    const corrupt = [
      '$ErrorActionPreference = "Stop"',
      '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
      '$acl = [System.Security.AccessControl.DirectorySecurity]::new()',
      '$acl.SetAccessRuleProtection($true, $false)',
      '$acl.SetOwner($sid)',
      `$inheritance = ${fault === 'missing-inheritance' ? '[System.Security.AccessControl.InheritanceFlags]::None' : '[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit'}`,
      '$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $inheritance, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))',
      ...(fault === 'extra-rule'
        ? [
            '$everyone = [System.Security.Principal.SecurityIdentifier]::new("S-1-1-0")',
            '$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($everyone, [System.Security.AccessControl.FileSystemRights]::Read, $inheritance, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))',
          ]
        : []),
      ...(fault === 'conditional-rule'
        ? [
            '$acl.SetSecurityDescriptorSddlForm("D:P(XA;OICI;FA;;;" + $sid.Value + ";(Member_of {SID(S-1-1-0)}))", [System.Security.AccessControl.AccessControlSections]::Access)',
          ]
        : []),
      '[System.IO.Directory]::SetAccessControl($env:SCHOOLOOM_ACL_TEST_PATH, $acl)',
    ].join('; ');
    const repair = [
      `import { privateDirectory, atomicPrivateFile } from ${JSON.stringify(helper)};`,
      'import { execFile } from "node:child_process";',
      'import { promisify } from "node:util";',
      'await privateDirectory(process.argv[1]);',
      'await atomicPrivateFile(process.argv[1], "probe.txt", "private");',
      'await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", process.argv[2]], { env: { ...process.env, SCHOOLOOM_ACL_TEST_PATH: process.argv[1] }, windowsHide: true });',
      'await privateDirectory(process.argv[1]);',
    ].join('\n');
    await execute(process.execPath, ['--input-type=module', '-e', repair, directory, corrupt]);
    await expectPrivateAccess(directory);
  });
}
