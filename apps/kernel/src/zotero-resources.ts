import { type BigIntStats, constants } from 'node:fs';
import { type FileHandle, lstat, open, opendir, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileFingerprint } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import type { ZoteroResource } from './host-settings.js';

export type TrustedZoteroLaunch = Readonly<{
  executable: string;
  args: readonly string[];
  packageDirectory: string;
  displayEnvironment: Readonly<Partial<Record<'DISPLAY' | 'XAUTHORITY', string>>>;
  beforeLaunch: () => Promise<void>;
}>;

export async function resolveZoteroResource(
  registration: ZoteroResource,
  kernelDirectory: string,
): Promise<TrustedZoteroLaunch> {
  if (
    registration.layout !== 'linux-x64-electron-managed-v1' ||
    process.platform !== 'linux' ||
    process.arch !== 'x64' ||
    !process.getuid
  )
    throw new OperationError('unavailable', 'Zotero 固定资源仅支持 Linux x64 受管布局。');

  const display = process.env.DISPLAY;
  if (!display?.trim())
    throw new OperationError('unavailable', 'Zotero 原包需要可信宿主环境提供 DISPLAY。');
  const authority = process.env.XAUTHORITY;
  const displayEnvironment = Object.freeze({
    DISPLAY: display,
    ...(authority === undefined ? {} : { XAUTHORITY: authority }),
  });
  const directory = resolve(kernelDirectory);
  const root = join(directory, 'native-resources', 'zotero-journals-v1');
  const executable = join(root, 'electron', 'electron');
  const managedEntry = join(root, 'host', 'out', 'main', 'managed.cjs');
  const packageDirectory = join(root, 'bbt');
  const uid = process.getuid();

  try {
    // Both source and compiled kernel entries retain these source-of-truth locations.
    const [packageText, versionsText] = await Promise.all([
      readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../../zotero-host/resources/versions.json', import.meta.url), 'utf8'),
    ]);
    const packageManifest = JSON.parse(packageText) as {
      devDependencies?: { electron?: string };
    };
    const versions = JSON.parse(versionsText) as {
      zotero: { version: string };
      bbt: { id: string; version: string };
    };
    const electronVersion = packageManifest.devDependencies?.electron;
    if (!electronVersion || !versions.zotero.version || !versions.bbt.id || !versions.bbt.version)
      throw new OperationError('unavailable', 'Zotero 固定资源的构建版本依据不完整。');

    const versionFiles = [
      join(root, 'electron', 'version'),
      join(root, 'host', 'resources', 'versions.json'),
      join(packageDirectory, 'manifest.json'),
    ];
    const versionBytes = 65536;
    const directoryIdentity = (stat: BigIntStats) => `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
    const privateAccess = (path: string, stat: BigIntStats) =>
      stat.uid === BigInt(uid) && (stat.mode & (path === directory ? 0o077n : 0o022n)) === 0n;
    const scan = async (): Promise<Map<string, string>> => {
      const directories = new Map<string, FileHandle>();
      try {
        const witnesses = new Map<string, string>();
        const stability = new Map<string, string>();
        const files = new Set<string>();
        const member = async (path: string, requireDirectory = false, anchored = path) => {
          if (witnesses.size >= 4096)
            throw new OperationError('unavailable', 'Zotero 固定资源成员超过核查范围。');
          const stat = await lstat(anchored, { bigint: true });
          if (
            stat.isSymbolicLink() ||
            (requireDirectory ? !stat.isDirectory() : !stat.isFile() && !stat.isDirectory()) ||
            !privateAccess(path, stat) ||
            (await realpath(path)) !== path
          )
            throw new OperationError('unavailable', `Zotero 固定资源路径或权限不安全：${path}`);
          if (path === executable && (stat.mode & 0o111n) === 0n)
            throw new OperationError('unavailable', 'Zotero 固定 Electron 文件不可执行。');
          if (versionFiles.includes(path) && stat.size > BigInt(versionBytes))
            throw new OperationError('unavailable', 'Zotero 固定资源版本记录过大。');
          if (stat.isFile()) files.add(path);
          witnesses.set(path, stat.isDirectory() ? directoryIdentity(stat) : fileFingerprint(stat));
          stability.set(path, requireDirectory ? directoryIdentity(stat) : fileFingerprint(stat));
          if (stat.isDirectory()) {
            const handle = await open(
              anchored,
              constants.O_RDONLY |
                constants.O_DIRECTORY |
                constants.O_NOFOLLOW |
                constants.O_NONBLOCK,
            );
            directories.set(path, handle);
            if (fileFingerprint(await handle.stat({ bigint: true })) !== fileFingerprint(stat))
              throw new OperationError('unavailable', 'Zotero 资源目录在核查中变化。');
          }
          return stat;
        };
        await member(directory, true);
        await member(join(directory, 'native-resources'), true);
        const visit = async (path: string, anchored = path): Promise<void> => {
          const stat = await member(path, false, anchored);
          if (stat.isDirectory()) {
            const handle = directories.get(path);
            if (!handle) throw new OperationError('unavailable', '资源目录没有已核句柄。');
            // Enumerate the verified directory object, even if its pathname is replaced.
            for await (const child of await opendir(`/proc/self/fd/${handle.fd}`))
              await visit(join(path, child.name), `/proc/self/fd/${handle.fd}/${child.name}`);
          }
        };
        await visit(root);
        for (const parts of [
          ['electron', 'electron'],
          ['electron', 'version'],
          ['host', 'out', 'main', 'managed.cjs'],
          ['host', 'out', 'preload', 'index.cjs'],
          ['host', 'out', 'renderer', 'index.html'],
          ['host', 'out', 'renderer', 'worker.html'],
          ['host', 'resources', 'versions.json'],
          ['host', 'resources', 'dateFormats.json'],
          ['bbt', 'manifest.json'],
          ['bbt', 'bootstrap.js'],
        ]) {
          if (!files.has(join(root, ...parts)))
            throw new OperationError('unavailable', 'Zotero 固定资源缺少必要文件。');
        }
        for (const [path, basis] of [...stability].reverse()) {
          const stat = await lstat(path, { bigint: true });
          const ancestor = path === directory || path === join(directory, 'native-resources');
          const witness = ancestor ? directoryIdentity : fileFingerprint;
          const actual = witness(stat);
          if (
            stat.isSymbolicLink() ||
            !privateAccess(path, stat) ||
            actual !== basis ||
            (await realpath(path)) !== path
          )
            throw new OperationError('unavailable', 'Zotero 固定资源在核查中变化。');
          const held = directories.get(path);
          if (held) {
            const current = await held.stat({ bigint: true });
            if (!privateAccess(path, current) || witness(current) !== actual)
              throw new OperationError('unavailable', 'Zotero 资源目录绑定已变化。');
          }
        }
        return witnesses;
      } catch (error) {
        if (error instanceof OperationError) throw error;
        throw new OperationError(
          'unavailable',
          `无法校验 Zotero 固定资源：${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await Promise.all([...directories.values()].map((handle) => handle.close()));
      }
    };
    const original = await scan();
    const unchanged = async () => {
      const current = await scan();
      if (
        current.size !== original.size ||
        [...original].some(([path, basis]) => current.get(path) !== basis)
      )
        throw new OperationError('unavailable', 'Zotero 固定资源已变化，请重新核查并启动。');
    };
    const readVersion = async (path: string) => {
      const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const before = await handle.stat({ bigint: true });
        if (
          !before.isFile() ||
          before.size > BigInt(versionBytes) ||
          fileFingerprint(before) !== original.get(path)
        )
          throw new OperationError('unavailable', 'Zotero 版本记录已变化。');
        const bytes = Buffer.alloc(versionBytes + 1);
        let offset = 0;
        while (offset < bytes.length) {
          const result = await handle.read(bytes, offset, bytes.length - offset, offset);
          if (!result.bytesRead) break;
          offset += result.bytesRead;
        }
        if (
          offset !== Number(before.size) ||
          fileFingerprint(await handle.stat({ bigint: true })) !== original.get(path)
        )
          throw new OperationError('unavailable', 'Zotero 版本记录已变化。');
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset));
      } finally {
        await handle.close();
      }
    };
    const [electronText, hostVersionsText, manifestText] = await Promise.all(
      versionFiles.map(readVersion),
    );
    if (electronText === undefined || hostVersionsText === undefined || manifestText === undefined)
      throw new OperationError('unavailable', 'Zotero 固定资源版本依据缺失。');
    const hostVersions = JSON.parse(hostVersionsText) as typeof versions;
    const manifest = JSON.parse(manifestText) as {
      version?: string;
      applications?: { zotero?: { id?: string } };
    };
    if (
      electronText.trim() !== electronVersion ||
      hostVersions.zotero.version !== versions.zotero.version ||
      hostVersions.bbt.id !== versions.bbt.id ||
      hostVersions.bbt.version !== versions.bbt.version ||
      manifest.version !== versions.bbt.version ||
      manifest.applications?.zotero?.id !== versions.bbt.id
    )
      throw new OperationError('unavailable', 'Zotero 固定资源或 BBT 原包版本不匹配。');
    await unchanged();
    return Object.freeze({
      executable,
      args: Object.freeze([managedEntry]),
      packageDirectory,
      displayEnvironment,
      beforeLaunch: unchanged,
    });
  } catch (error) {
    if (error instanceof OperationError) throw error;
    throw new OperationError(
      'unavailable',
      `无法读取 Zotero 构建版本依据：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
