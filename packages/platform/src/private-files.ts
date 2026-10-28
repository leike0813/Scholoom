import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { OperationError } from '@scholoom/protocol/core';

export async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if ((await lstat(path)).isSymbolicLink())
    throw new OperationError('permissionDenied', '私有目录不能使用符号链接。');
  if (process.platform !== 'win32') {
    await chmod(path, 0o700);
    return;
  }
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$acl = [System.Security.AccessControl.DirectorySecurity]::new()',
    '$acl.SetAccessRuleProtection($true, $false)',
    '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$current = [System.IO.Directory]::GetAccessControl($env:SCHOOLOOM_PRIVATE_PATH)',
    '$owner = $current.GetOwner([System.Security.Principal.SecurityIdentifier])',
    '$raw = [System.Security.AccessControl.RawSecurityDescriptor]::new($current.GetSecurityDescriptorBinaryForm(), 0)',
    '$inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit',
    // Reapplying inheritable ACLs changes child ctime even when file contents are unchanged.
    'if ($current.AreAccessRulesProtected -and $owner.Value -eq $sid.Value -and $null -ne $raw.DiscretionaryAcl -and $raw.DiscretionaryAcl.Count -eq 1) { $existing = $raw.DiscretionaryAcl[0]; if ($existing.AceType -eq [System.Security.AccessControl.AceType]::AccessAllowed -and $existing.SecurityIdentifier.Value -eq $sid.Value -and $existing.AccessMask -eq [int][System.Security.AccessControl.FileSystemRights]::FullControl -and $existing.AceFlags -eq ([System.Security.AccessControl.AceFlags]::ContainerInherit -bor [System.Security.AccessControl.AceFlags]::ObjectInherit)) { exit 0 } }',
    'if ($owner.Value -ne $sid.Value) { $acl.SetOwner($sid) }',
    '$rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $inheritance, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)',
    '$acl.AddAccessRule($rule)',
    '[System.IO.Directory]::SetAccessControl($env:SCHOOLOOM_PRIVATE_PATH, $acl)',
  ].join('; ');
  try {
    await promisify(execFile)(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NonInteractive', '-Command', script],
      {
        windowsHide: true,
        env: { ...process.env, SCHOOLOOM_PRIVATE_PATH: path },
      },
    );
  } catch (error) {
    throw new OperationError(
      'permissionDenied',
      `无法设置 Windows 目录权限: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
  // 确保文件权限正确设置（open 的 mode 在某些平台可能不生效）
  if (process.platform !== 'win32') {
    await chmod(temporary, 0o600);
  }
  try {
    await rename(temporary, join(directory, filename));
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
