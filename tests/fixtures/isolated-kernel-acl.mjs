import { execFile } from 'node:child_process';
import { channel } from 'node:diagnostics_channel';
import { lstat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { atomicPrivateFile, privateDirectory } from '../../packages/platform/dist/private-files.js';

// Only this trusted test parent supplies a directory; no paths, argv or environment values leave it.
const execute = promisify(execFile);
const commands = [];
const active = new Set();
let purpose = 'unattributed';
let cancelled = false;
const facts = {
  version: 1,
  processId: process.pid,
  platform: process.platform,
  environment: Object.fromEntries(
    [
      'PATH',
      'SYSTEMROOT',
      'WINDIR',
      'TEMP',
      'TMP',
      'TMPDIR',
      'APPDATA',
      'LOCALAPPDATA',
      'PSModulePath',
      'NODE_OPTIONS',
      'SCHOOLOOM_ACL_SECRET',
    ].map((key) => [key, process.env[key] !== undefined]),
  ),
  operations: [],
  commands,
};
const report = () => {
  if (process.connected) process.send(facts, () => {});
};
const cancel = () => {
  cancelled = true;
  for (const child of active) child.kill();
};
process.once('disconnect', cancel);
process.on('message', (message) => {
  if (message?.cancel === true) cancel();
});
channel('child_process').subscribe(({ process: child }) => {
  const started = performance.now();
  // Compare real argument shape without retaining command bodies or unrecognized values.
  const expectedFlags =
    purpose === 'verify-acl'
      ? ['-NoProfile', '-NonInteractive', '-Command']
      : ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NonInteractive', '-Command'];
  const record = {
    purpose,
    flags: [],
    argumentShapeMatches: false,
    executable: 'unobserved',
    processId: null,
    closed: false,
    code: null,
    signal: null,
    elapsedMs: null,
  };
  commands.push(record);
  active.add(child);
  child.once('spawn', () => {
    record.executable = basename(child.spawnfile.replaceAll('\\', '/')).toLowerCase();
    record.processId = child.pid;
    record.flags = child.spawnargs.slice(1, -1).filter((value) => expectedFlags.includes(value));
    record.argumentShapeMatches =
      child.spawnargs.length === expectedFlags.length + 2 &&
      expectedFlags.every((flag, index) => child.spawnargs[index + 1] === flag);
    report();
    if (cancelled) child.kill();
  });
  child.once('close', (code, signal) => {
    active.delete(child);
    Object.assign(record, { closed: true, code, signal, elapsedMs: performance.now() - started });
    report();
  });
});

const measure = async (name, operation) => {
  if (cancelled) throw new Error();
  purpose = name;
  const record = { purpose: name, startedAt: Date.now(), completed: false, elapsedMs: null };
  facts.operations.push(record);
  report();
  const started = performance.now();
  await operation();
  Object.assign(record, { completed: true, elapsedMs: performance.now() - started });
  report();
};

process.once('message', async ({ directory }) => {
  report();
  try {
    await measure('set-acl-new', () => privateDirectory(directory));
    await measure('set-acl-existing', () => privateDirectory(directory));
    await atomicPrivateFile(directory, 'probe.txt', 'private');
    await measure('verify-acl', async () => {
      if (process.platform !== 'win32') {
        facts.permissions = {
          directoryMode: (await lstat(directory)).mode & 0o777,
          fileMode: (await lstat(join(directory, 'probe.txt'))).mode & 0o777,
        };
        return;
      }
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
          env: { ...process.env, SCHOOLOOM_ACL_TEST_PATH: directory },
          windowsHide: true,
          maxBuffer: 16 * 1024,
        },
      );
      facts.permissions = JSON.parse(stdout);
    });
    facts.outcome = cancelled ? 'cancelled' : 'completed';
  } catch {
    // Raw OS failures can include private paths or command bodies.
    facts.outcome = cancelled ? 'cancelled' : 'failed';
  } finally {
    report();
    if (process.connected) process.disconnect();
  }
});
