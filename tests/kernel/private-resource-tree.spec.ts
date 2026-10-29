import { execFile } from 'node:child_process';
import { link, lstat, mkdir, rename, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test as base, expect } from '@playwright/test';
import { privateDirectory } from '../../packages/platform/dist/private-files.js';
import {
  inspectPrivateResourceTree,
  readPrivateResourceFile,
} from '../../packages/platform/dist/private-resource-tree.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

const execute = promisify(execFile);
const supported = process.platform === 'win32' && process.arch === 'x64';
const resourceRelativePath = 'native-resources/runtime';
const member = 'host/插件/版本.txt';
const contents = Buffer.from('科研资源 🙂\n', 'utf8');
type Tree = {
  ownedDirectory: string;
  configurationDirectory: string;
  resourceDirectory: string;
};
type Snapshot = Awaited<ReturnType<typeof inspectPrivateResourceTree>>;
type Acl = { descriptor: string; owner: string; nullDacl: boolean; aceTypes: number[] };

async function powershell(path: string, script: string): Promise<string> {
  const temporaryDirectory = test.info().outputPath('powershell-tmp');
  await mkdir(temporaryDirectory, { recursive: true });
  const { stdout } = await execute(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference = 'Stop'\n${script}`],
    {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 64 * 1024,
      env: {
        ...process.env,
        TEMP: temporaryDirectory,
        TMP: temporaryDirectory,
        TMPDIR: temporaryDirectory,
        SCHOOLOOM_RESOURCE_TREE_TEST_PATH: path,
      },
    },
  );
  return stdout.trim();
}

const getAcl = [
  '$path = $env:SCHOOLOOM_RESOURCE_TREE_TEST_PATH',
  '$directory = [System.IO.Directory]::Exists($path)',
  '$acl = if ($directory) { [System.IO.Directory]::GetAccessControl($path) } else { [System.IO.File]::GetAccessControl($path) }',
].join('\n');
const setAcl =
  'if ($directory) { [System.IO.Directory]::SetAccessControl($path, $acl) } else { [System.IO.File]::SetAccessControl($path, $acl) }';
const everyone = '$everyone = [System.Security.Principal.SecurityIdentifier]::new("S-1-1-0")';

function allowEveryone(right: string): string {
  return [
    everyone,
    `$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($everyone, [System.Security.AccessControl.FileSystemRights]::${right}, [System.Security.AccessControl.AccessControlType]::Allow))`,
  ].join('\n');
}

async function aclState(path: string): Promise<Acl> {
  return JSON.parse(
    await powershell(
      path,
      [
        getAcl,
        '$raw = [System.Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)',
        '@{ descriptor = [Convert]::ToBase64String($acl.GetSecurityDescriptorBinaryForm()); owner = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; nullDacl = ($null -eq $raw.DiscretionaryAcl); aceTypes = @($raw.DiscretionaryAcl | ForEach-Object { [int]$_.AceType }) } | ConvertTo-Json -Compress',
      ].join('\n'),
    ),
  );
}

async function changeAcl(path: string, script: string): Promise<void> {
  await powershell(path, [getAcl, script, setAcl].join('\n'));
}

async function aclEntries(path: string): Promise<{ type: number; sid: string; mask: number }[]> {
  return JSON.parse(
    await powershell(
      path,
      [
        getAcl,
        '$raw = [System.Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)',
        'ConvertTo-Json -InputObject @($raw.DiscretionaryAcl | ForEach-Object { @{ type = [int]$_.AceType; sid = $_.SecurityIdentifier.Value; mask = $_.AccessMask } }) -Compress',
      ].join('\n'),
    ),
  );
}

async function withAcl(
  path: string,
  change: string,
  check: (before: Acl) => Promise<void>,
  preparationRequirement?: string,
): Promise<void> {
  const before = await aclState(path);
  try {
    try {
      await changeAcl(path, change);
    } catch (error) {
      if (!preparationRequirement) throw error;
      test.skip(true, preparationRequirement);
      throw error;
    }
    await check(before);
  } finally {
    await changeAcl(
      path,
      `$acl.SetSecurityDescriptorBinaryForm([Convert]::FromBase64String('${before.descriptor}'), [System.Security.AccessControl.AccessControlSections]::Access -bor [System.Security.AccessControl.AccessControlSections]::Owner)`,
    );
    expect((await aclState(path)).descriptor).toBe(before.descriptor);
  }
}

async function expectCode(result: Promise<unknown>, code: OperationError['code']): Promise<void> {
  await expect(result).rejects.toBeInstanceOf(OperationError);
  await expect(result).rejects.toMatchObject({ code });
}

function inspect(tree: Tree, maxEntries = 64): Promise<Snapshot> {
  return inspectPrivateResourceTree({
    configurationDirectory: tree.configurationDirectory,
    resourceRelativePath,
    maxEntries,
  });
}

const test = base.extend<{ tree: Tree }>({
  tree: async ({ baseURL: _baseURL }, use, testInfo) => {
    test.skip(!supported, 'Requires real Windows win32/x64 ACL and native resource-tree support');
    const ownedDirectory = testInfo.outputPath('owned-resource-tree');
    await mkdir(ownedDirectory, { recursive: true });
    let localNtfs: string;
    try {
      localNtfs = await powershell(
        ownedDirectory,
        [
          '$drive = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($env:SCHOOLOOM_RESOURCE_TREE_TEST_PATH))',
          '($drive.DriveFormat -eq "NTFS" -and $drive.DriveType -eq [System.IO.DriveType]::Fixed) | ConvertTo-Json -Compress',
        ].join('\n'),
      );
    } catch (error) {
      test.skip(
        (error as NodeJS.ErrnoException).code === 'ENOENT',
        'Windows PowerShell is required to prepare and independently inspect owned ACL fixtures',
      );
      throw error;
    }
    test.skip(localNtfs !== 'true', 'Test output must be on an actual local fixed NTFS volume');
    // Only these newly created test objects are prepared; never repair ancestors of outputPath.
    await privateDirectory(ownedDirectory);
    const configurationDirectory = join(ownedDirectory, '私有 configuration');
    await privateDirectory(configurationDirectory);
    const resourceDirectory = join(configurationDirectory, resourceRelativePath);
    await mkdir(join(resourceDirectory, 'host/插件'), { recursive: true });
    await writeFile(join(resourceDirectory, member), contents);
    await writeFile(join(resourceDirectory, 'empty.txt'), '');
    await use({ ownedDirectory, configurationDirectory, resourceDirectory });
  },
});

base('private resource APIs report unavailable on unsupported native targets', async () => {
  base.skip(supported, 'Unsupported-target contract only');
  const configurationDirectory = base.info().outputPath('not-created');
  await expectCode(
    inspectPrivateResourceTree({ configurationDirectory, resourceRelativePath, maxEntries: 64 }),
    'unavailable',
  );
  await expectCode(
    readPrivateResourceFile({
      configurationDirectory,
      relativePath: 'host-settings.json',
      maxBytes: 16,
    }),
    'unavailable',
  );
  await expect(lstat(configurationDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('Windows private resource tree reads Unicode and empty members with exact byte bounds', async ({
  tree,
}) => {
  const snapshot = await inspect(tree);
  try {
    expect(Buffer.from(await snapshot.readFile(member, contents.length))).toEqual(contents);
    expect(await snapshot.readFile('empty.txt', 1)).toHaveLength(0);
    await expectCode(snapshot.readFile(member, contents.length - 1), 'tooLarge');
    expect(Buffer.from(await snapshot.readFile(member, contents.length))).toEqual(contents);
    await snapshot.verifyUnchanged();
    await snapshot.verifyUnchanged();
  } finally {
    await snapshot.close();
    await snapshot.close();
  }
  await expectCode(snapshot.readFile(member, contents.length), 'unavailable');
  await expectCode(snapshot.verifyUnchanged(), 'unavailable');
});

test('Windows private resource tree scans 20 levels and detects resource root time changes', async ({
  tree,
}) => {
  const directories = Array.from({ length: 20 }, () => 'd');
  const deepMember = `${directories.join('/')}/leaf.txt`;
  await mkdir(join(tree.resourceDirectory, ...directories), { recursive: true });
  await writeFile(join(tree.resourceDirectory, deepMember), contents);
  const snapshot = await inspect(tree);
  try {
    expect(Buffer.from(await snapshot.readFile(deepMember, contents.length))).toEqual(contents);
    await snapshot.verifyUnchanged();
    const before = await lstat(tree.resourceDirectory);
    await utimes(tree.resourceDirectory, before.atime, new Date(before.mtimeMs + 60_000));
    expect((await lstat(tree.resourceDirectory)).mtimeMs).not.toBe(before.mtimeMs);
    await expectCode(snapshot.verifyUnchanged(), 'contentChanged');
  } finally {
    await snapshot.close();
    await snapshot.close();
  }
});

test('Windows private resource tree rejects malformed paths and limits', async ({ tree }) => {
  for (const path of ['../escape', join(tree.configurationDirectory, 'absolute'), 'file\0name']) {
    await expectCode(
      inspectPrivateResourceTree({
        configurationDirectory: tree.configurationDirectory,
        resourceRelativePath: path,
        maxEntries: 64,
      }),
      'invalidRequest',
    );
    await expectCode(
      readPrivateResourceFile({
        configurationDirectory: tree.configurationDirectory,
        relativePath: path,
        maxBytes: 16,
      }),
      'invalidRequest',
    );
  }
  for (const maxEntries of [-1, 1.5, Number.NaN]) {
    await expectCode(inspect(tree, maxEntries), 'invalidRequest');
  }
  const snapshot = await inspect(tree);
  try {
    await expectCode(snapshot.readFile('../outside', 16), 'invalidRequest');
    for (const maxBytes of [-1, Number.NaN]) {
      await expectCode(snapshot.readFile(member, maxBytes), 'invalidRequest');
      await expectCode(
        readPrivateResourceFile({
          configurationDirectory: tree.configurationDirectory,
          relativePath: 'host-settings.json',
          maxBytes,
        }),
        'invalidRequest',
      );
    }
    await snapshot.verifyUnchanged();
  } finally {
    await snapshot.close();
  }
});

test('Windows private resource close drains its bounded queue without accepting more work', async ({
  tree,
}) => {
  const snapshot = await inspect(tree);
  const pending = Array.from({ length: 8 }, () =>
    snapshot.verifyUnchanged().catch((error: unknown) => error),
  );
  const overflow = snapshot.verifyUnchanged();
  const closing = snapshot.close();
  await expectCode(overflow, 'resourceLimit');
  await Promise.all(pending);
  await closing;
  await snapshot.close();
  await expectCode(snapshot.verifyUnchanged(), 'unavailable');
});

test('Windows private resource tree enforces the entry bound', async ({ tree }) => {
  await expectCode(inspect(tree, 1), 'tooLarge');
  const snapshot = await inspect(tree);
  try {
    await snapshot.verifyUnchanged();
  } finally {
    await snapshot.close();
  }
});

test('Windows private resource tree refuses an Everyone-writable descendant without repairing it', async ({
  tree,
}) => {
  const rootBefore = await aclState(tree.resourceDirectory);
  const file = join(tree.resourceDirectory, member);
  await withAcl(file, allowEveryone('WriteData'), async (before) => {
    const unsafe = await aclState(file);
    expect(unsafe.owner).toBe(before.owner);
    expect(unsafe.descriptor).not.toBe(before.descriptor);
    await expectCode(inspect(tree), 'unavailable');
    expect(await aclState(file)).toEqual(unsafe);
    expect(await aclState(tree.resourceDirectory)).toEqual(rootBefore);
  });
});

test('Windows private readers interpret OWNER RIGHTS as the current trusted owner', async ({
  tree,
}) => {
  const file = join(tree.resourceDirectory, member);
  await withAcl(
    file,
    [
      '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
      '$acl.SetSecurityDescriptorSddlForm("D:P(A;;FA;;;S-1-3-4)(A;;FRFX;;;" + $sid.Value + ")", [System.Security.AccessControl.AccessControlSections]::Access)',
    ].join('\n'),
    async (before) => {
      const changed = await aclState(file);
      expect(changed.owner).toBe(before.owner);
      expect(await aclEntries(file)).toEqual(
        expect.arrayContaining([{ type: 0, sid: 'S-1-3-4', mask: 0x1f01ff }]),
      );
      const snapshot = await inspect(tree);
      try {
        expect(Buffer.from(await snapshot.readFile(member, contents.length))).toEqual(contents);
        expect(
          Buffer.from(
            await readPrivateResourceFile({
              configurationDirectory: tree.configurationDirectory,
              relativePath: `${resourceRelativePath}/${member}`,
              maxBytes: contents.length,
            }),
          ),
        ).toEqual(contents);
        await snapshot.verifyUnchanged();
        expect(await aclState(file)).toEqual(changed);
      } finally {
        await snapshot.close();
      }
    },
  );
});

test('Windows private readers accept a later Everyone DELETE allow masked by an earlier deny', async ({
  tree,
}) => {
  const file = join(tree.resourceDirectory, member);
  await withAcl(
    file,
    [
      '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
      // Deny only DELETE: the current token retains read/execute and WRITE_DAC for restoration.
      '$acl.SetSecurityDescriptorSddlForm("D:P(D;;0x00010000;;;S-1-1-0)(A;;0x00010000;;;S-1-1-0)(A;;FA;;;" + $sid.Value + ")", [System.Security.AccessControl.AccessControlSections]::Access)',
    ].join('\n'),
    async () => {
      const changed = await aclState(file);
      expect((await aclEntries(file)).slice(0, 2)).toEqual([
        { type: 1, sid: 'S-1-1-0', mask: 0x10000 },
        { type: 0, sid: 'S-1-1-0', mask: 0x10000 },
      ]);
      const snapshot = await inspect(tree);
      try {
        expect(Buffer.from(await snapshot.readFile(member, contents.length))).toEqual(contents);
        expect(
          Buffer.from(
            await readPrivateResourceFile({
              configurationDirectory: tree.configurationDirectory,
              relativePath: `${resourceRelativePath}/${member}`,
              maxBytes: contents.length,
            }),
          ),
        ).toEqual(contents);
        await snapshot.verifyUnchanged();
        expect(await aclState(file)).toEqual(changed);
      } finally {
        await snapshot.close();
      }
    },
  );
});

for (const right of ['DeleteSubdirectoriesAndFiles', 'CreateDirectories'] as const) {
  test(`Windows resource ancestors distinguish ${right} from replacement rights`, async ({
    tree,
  }) => {
    const configurationBefore = await aclState(tree.configurationDirectory);
    await withAcl(tree.ownedDirectory, allowEveryone(right), async () => {
      const changed = await aclState(tree.ownedDirectory);
      if (right === 'DeleteSubdirectoriesAndFiles') {
        await expectCode(inspect(tree), 'unavailable');
      } else {
        const snapshot = await inspect(tree);
        try {
          expect(Buffer.from(await snapshot.readFile(member, contents.length))).toEqual(contents);
          await snapshot.verifyUnchanged();
        } finally {
          await snapshot.close();
        }
      }
      expect(await aclState(tree.ownedDirectory)).toEqual(changed);
      expect(await aclState(tree.configurationDirectory)).toEqual(configurationBefore);
    });
  });
}

test('Windows private resource tree refuses junctions even to another private directory', async ({
  tree,
}) => {
  const target = join(tree.configurationDirectory, 'other-private-directory');
  await mkdir(target);
  await writeFile(join(target, 'member.txt'), 'owned');
  const junction = join(tree.resourceDirectory, 'junction');
  await symlink(target, junction, 'junction');
  expect((await lstat(junction)).isSymbolicLink()).toBe(true);
  await expectCode(inspect(tree), 'unavailable');
  expect((await lstat(junction)).isSymbolicLink()).toBe(true);
});

test('Windows private resource readers refuse multiply linked files', async ({ tree }) => {
  const file = join(tree.resourceDirectory, member);
  const settings = join(tree.configurationDirectory, 'host-settings.json');
  await link(file, settings);
  expect((await lstat(file)).nlink).toBe(2);
  await expectCode(inspect(tree), 'unavailable');
  await expectCode(
    readPrivateResourceFile({
      configurationDirectory: tree.configurationDirectory,
      relativePath: 'host-settings.json',
      maxBytes: contents.length,
    }),
    'unavailable',
  );
  expect((await lstat(file)).nlink).toBe(2);
});

for (const change of ['add', 'remove', 'replace', 'rewrite'] as const) {
  test(`Windows private resource tree retains its original witness after member ${change}`, async ({
    tree,
  }) => {
    const snapshot = await inspect(tree);
    try {
      await snapshot.verifyUnchanged();
      const file = join(tree.resourceDirectory, member);
      if (change === 'add') {
        await writeFile(join(tree.resourceDirectory, 'new-member.txt'), 'new');
      } else if (change === 'remove') {
        await unlink(file);
      } else if (change === 'replace') {
        await rename(file, join(tree.ownedDirectory, 'original-member.txt'));
        await writeFile(file, contents);
      } else {
        await writeFile(file, 'changed resource contents');
      }
      await expectCode(snapshot.verifyUnchanged(), 'contentChanged');
      await expectCode(snapshot.verifyUnchanged(), 'contentChanged');
      if (change !== 'add') {
        await expectCode(snapshot.readFile(member, 128), 'contentChanged');
      }
    } finally {
      // Failed reads and verification must not leave a native command or close waiting forever.
      await snapshot.close();
      await snapshot.close();
    }
    await expectCode(snapshot.readFile(member, 128), 'unavailable');
  });
}

// Restore FILE_BASIC_INFO on our own fixture so an ACL change cannot be detected via timestamps.
const fileTimes = `
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class ResourceTreeFileTimes {
  [StructLayout(LayoutKind.Sequential)]
  public struct BasicInfo {
    public long CreationTime, LastAccessTime, LastWriteTime, ChangeTime;
    public uint FileAttributes;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
    IntPtr security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool GetFileInformationByHandleEx(SafeFileHandle handle, int kind,
    out BasicInfo value, uint size);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetFileInformationByHandle(SafeFileHandle handle, int kind,
    ref BasicInfo value, uint size);
  public static BasicInfo Read(string path) {
    using (var handle = CreateFileW(path, 0x80, 7, IntPtr.Zero, 3, 0x02000000, IntPtr.Zero)) {
      BasicInfo value;
      if (handle.IsInvalid || !GetFileInformationByHandleEx(handle, 0, out value,
          (uint)Marshal.SizeOf(typeof(BasicInfo)))) throw new Win32Exception(Marshal.GetLastWin32Error());
      return value;
    }
  }
  public static void Restore(string path, BasicInfo value) {
    using (var handle = CreateFileW(path, 0x100, 7, IntPtr.Zero, 3, 0x02000000, IntPtr.Zero)) {
      if (handle.IsInvalid || !SetFileInformationByHandle(handle, 0, ref value,
          (uint)Marshal.SizeOf(typeof(BasicInfo)))) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}
'@
$basicInfo = [ResourceTreeFileTimes]::Read($path)
`;

async function metadata(path: string): Promise<string[]> {
  const stat = await lstat(path, { bigint: true });
  return [stat.dev, stat.ino, stat.size, stat.birthtimeNs, stat.mtimeNs, stat.ctimeNs].map(String);
}

test('Windows private resource tree detects ACL changes with the same owner and filesystem metadata', async ({
  tree,
}) => {
  const file = join(tree.resourceDirectory, member);
  const beforeAcl = await aclState(file);
  const snapshot = await inspect(tree);
  try {
    await snapshot.verifyUnchanged();
    const beforeMetadata = await metadata(file);
    try {
      await powershell(
        file,
        [
          getAcl,
          fileTimes,
          allowEveryone('ReadAndExecute'),
          setAcl,
          '[ResourceTreeFileTimes]::Restore($path, $basicInfo)',
        ].join('\n'),
      );
      expect(await metadata(file)).toEqual(beforeMetadata);
      const changed = await aclState(file);
      expect(changed.owner).toBe(beforeAcl.owner);
      expect(changed.descriptor).not.toBe(beforeAcl.descriptor);
      await expectCode(snapshot.readFile(member, contents.length), 'contentChanged');
      await expectCode(snapshot.verifyUnchanged(), 'contentChanged');
      await expectCode(snapshot.verifyUnchanged(), 'contentChanged');
      expect(await aclState(file)).toEqual(changed);
    } finally {
      await changeAcl(
        file,
        `$acl.SetSecurityDescriptorBinaryForm([Convert]::FromBase64String('${beforeAcl.descriptor}'), [System.Security.AccessControl.AccessControlSections]::Access)`,
      );
      expect((await aclState(file)).descriptor).toBe(beforeAcl.descriptor);
    }
  } finally {
    await snapshot.close();
    await snapshot.close();
  }
});

test('Windows private settings reads are byte-bounded and do not create missing paths', async ({
  tree,
}) => {
  const input = {
    configurationDirectory: tree.configurationDirectory,
    relativePath: 'host-settings.json',
    maxBytes: contents.length,
  };
  await writeFile(join(tree.configurationDirectory, input.relativePath), contents);
  expect(Buffer.from(await readPrivateResourceFile(input))).toEqual(contents);
  await expectCode(
    readPrivateResourceFile({ ...input, maxBytes: contents.length - 1 }),
    'tooLarge',
  );
  expect(Buffer.from(await readPrivateResourceFile(input))).toEqual(contents);
  await expectCode(
    readPrivateResourceFile({ ...input, relativePath: 'not-created/settings.json' }),
    'unavailable',
  );
  await expect(lstat(join(tree.configurationDirectory, 'not-created'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  const missing = join(tree.ownedDirectory, 'missing-configuration');
  await expectCode(
    readPrivateResourceFile({ ...input, configurationDirectory: missing }),
    'unavailable',
  );
  await expect(lstat(missing)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('Windows private settings reject write access by Everyone without repairing the ACL', async ({
  tree,
}) => {
  const file = join(tree.configurationDirectory, 'host-settings.json');
  await writeFile(file, contents);
  await withAcl(file, allowEveryone('WriteData'), async () => {
    const unsafe = await aclState(file);
    await expectCode(
      readPrivateResourceFile({
        configurationDirectory: tree.configurationDirectory,
        relativePath: 'host-settings.json',
        maxBytes: contents.length,
      }),
      'unavailable',
    );
    expect(await aclState(file)).toEqual(unsafe);
  });
});

for (const access of ['unreadable', 'different-owner'] as const) {
  test(`Windows private resource and settings readers separately reject ${access}`, async ({
    tree,
  }) => {
    const file = join(tree.resourceDirectory, member);
    const mutation =
      access === 'unreadable'
        ? [
            '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
            '$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::ReadData, [System.Security.AccessControl.AccessControlType]::Deny))',
          ].join('\n')
        : '$acl.SetOwner([System.Security.Principal.SecurityIdentifier]::new("S-1-5-32-544"))';
    await withAcl(
      file,
      mutation,
      async (before) => {
        const changed = await aclState(file);
        if (access === 'unreadable') expect(changed.owner).toBe(before.owner);
        else expect(changed.owner).not.toBe(before.owner);
        await expectCode(inspect(tree), 'unavailable');
        await expectCode(
          readPrivateResourceFile({
            configurationDirectory: tree.configurationDirectory,
            relativePath: `${resourceRelativePath}/${member}`,
            maxBytes: contents.length,
          }),
          'unavailable',
        );
        expect(await aclState(file)).toEqual(changed);
      },
      access === 'different-owner'
        ? 'Preparing a different owner on an owned fixture requires an enabled owner-assignment privilege'
        : undefined,
    );
  });
}

for (const kind of ['null-dacl', 'conditional-ace'] as const) {
  test(`Windows private resource and settings readers reject ${kind} when it can be prepared`, async ({
    tree,
  }) => {
    const file = join(tree.resourceDirectory, member);
    const mutation =
      kind === 'null-dacl'
        ? '$acl.SetSecurityDescriptorSddlForm("D:NO_ACCESS_CONTROL", [System.Security.AccessControl.AccessControlSections]::Access)'
        : [
            '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
            '$acl.SetSecurityDescriptorSddlForm("D:P(A;;FA;;;" + $sid.Value + ")(XA;;FR;;;WD;(Member_of {SID(S-1-1-0)}))", [System.Security.AccessControl.AccessControlSections]::Access)',
          ].join('\n');
    await withAcl(
      file,
      mutation,
      async () => {
        const changed = await aclState(file);
        if (kind === 'null-dacl') expect(changed.nullDacl).toBe(true);
        else expect(changed.aceTypes).toContain(9); // ACCESS_ALLOWED_CALLBACK_ACE_TYPE
        await expectCode(inspect(tree), 'unavailable');
        await expectCode(
          readPrivateResourceFile({
            configurationDirectory: tree.configurationDirectory,
            relativePath: `${resourceRelativePath}/${member}`,
            maxBytes: contents.length,
          }),
          'unavailable',
        );
        expect(await aclState(file)).toEqual(changed);
      },
      `Requires Windows to accept a real ${kind} security descriptor on the owned fixture`,
    );
  });
}

// No scan-stage barrier is exposed: concurrent replacement during enumeration and the later
// check-to-loader window require separate integration evidence, not timing loops in this suite.
