import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { OperationError } from '../errors.js';

export async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if ((await lstat(path)).isSymbolicLink())
    throw new OperationError('permissionDenied', '私有目录不能使用符号链接。');
  if (process.platform !== 'win32') {
    await chmod(path, 0o700);
    return;
  }
  const script = [
    '$acl = New-Object System.Security.AccessControl.DirectorySecurity',
    '$acl.SetAccessRuleProtection($true, $false)',
    '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$acl.SetOwner($sid)',
    '$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")',
    '$acl.AddAccessRule($rule)',
    'Set-Acl -LiteralPath $env:SCHOOLOOM_PRIVATE_PATH -AclObject $acl -ErrorAction Stop',
  ].join('; ');
  await promisify(execFile)(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      windowsHide: true,
      env: { ...process.env, SCHOOLOOM_PRIVATE_PATH: path },
    },
  );
}

export async function atomicPrivateFile(
  directory: string,
  filename: string,
  data: string | Uint8Array,
): Promise<void> {
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, join(directory, filename));
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
