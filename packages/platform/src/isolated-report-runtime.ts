import { type BigIntStats, constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import {
  reportNodeLimits,
  reportNodeTargets,
  type SystemReportNode,
} from '@scholoom/protocol/isolation';

const unavailable = () => new OperationError('unavailable', '报告 Node 安装对象未获保护。');

function stamp(info: BigIntStats): string {
  if (!info.isFile() || info.uid !== 0n || info.nlink !== 1n || info.mode & 0o022n)
    throw unavailable();
  if (info.size <= 0n || info.size > BigInt(reportNodeLimits.fileBytes))
    throw new OperationError('resourceLimit', '报告 Node 安装文件大小超限。');
  return [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].join(':');
}

/** The installer supplies a protected closure directory; callers cannot select its targets. */
export async function describeReportNodeRuntime(root: string): Promise<SystemReportNode['files']> {
  if (
    typeof root !== 'string' ||
    root.includes('\0') ||
    !isAbsolute(root) ||
    resolve(root) !== root
  )
    throw unavailable();
  try {
    const parents: string[] = [];
    for (let path = root; ; path = dirname(path)) {
      parents.unshift(path);
      if (dirname(path) === path) break;
    }
    const directories = [];
    for (const path of parents) {
      const info = await lstat(path, { bigint: true });
      if (!info.isDirectory() || info.uid !== 0n || info.mode & 0o022n) throw unavailable();
      directories.push({ path, dev: info.dev, ino: info.ino, mode: info.mode });
    }
    const files: SystemReportNode['files'] = [];
    let total = 0n;
    for (const target of reportNodeTargets) {
      const path = join(root, basename(target));
      const before = stamp(await lstat(path, { bigint: true }));
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const held = await file.stat({ bigint: true });
        if (stamp(held) !== before || stamp(await lstat(path, { bigint: true })) !== before)
          throw new OperationError('contentChanged', '报告 Node 安装对象发生变化。');
        total += held.size;
        if (total > BigInt(reportNodeLimits.totalBytes))
          throw new OperationError('resourceLimit', '报告 Node 安装总大小超限。');
        if (
          stamp(await file.stat({ bigint: true })) !== before ||
          stamp(await lstat(path, { bigint: true })) !== before
        )
          throw new OperationError('contentChanged', '报告 Node 安装对象发生变化。');
        files.push({ target, stamp: before });
      } finally {
        await file.close();
      }
    }
    for (const expected of directories) {
      const info = await lstat(expected.path, { bigint: true });
      if (
        !info.isDirectory() ||
        info.uid !== 0n ||
        info.dev !== expected.dev ||
        info.ino !== expected.ino ||
        info.mode !== expected.mode ||
        info.mode & 0o022n
      )
        throw unavailable();
    }
    return files;
  } catch (error) {
    if (error instanceof OperationError) throw error;
    throw unavailable();
  }
}
