import { randomUUID } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { type CallContext, OperationError } from '@scholoom/protocol/core';
import type { ResourceReference } from '@scholoom/protocol/platform';

export const fileFingerprint = (stat: BigIntStats): string =>
  [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');

export type ResourceBinding = {
  readonly root: string;
  readonly owner: string;
  readonly consumers: readonly string[];
  readonly check: () => void;
};

export class ResourceAccess {
  private readonly bindings = new Map<string, ResourceBinding>();
  constructor(private readonly endpoint: string) {}

  async bind(binding: ResourceBinding): Promise<ResourceReference> {
    const root = await realpath(binding.root);
    if (!(await lstat(root)).isDirectory())
      throw new OperationError('invalidRequest', '资源根必须是目录。');
    const id = randomUUID();
    this.bindings.set(id, { ...binding, root, consumers: [...binding.consumers] });
    return { id, owner: binding.owner, endpoint: this.endpoint, kind: 'directory' };
  }

  revoke(reference: ResourceReference): void {
    this.bindings.delete(reference.id);
  }

  private async locate(reference: ResourceReference, path: string, context: CallContext) {
    context.signal?.throwIfAborted();
    const binding = this.bindings.get(reference.id);
    if (
      !binding ||
      reference.endpoint !== this.endpoint ||
      reference.owner !== binding.owner ||
      reference.kind !== 'directory' ||
      !binding.consumers.includes(context.moduleId)
    )
      throw new OperationError('permissionDenied', '资源不可用于当前调用。');
    binding.check();
    const target = await realpath(resolve(binding.root, path));
    const local = relative(binding.root, target);
    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
      throw new OperationError('permissionDenied', '资源路径超出范围。');
    return { binding, target };
  }

  async read(
    reference: ResourceReference,
    path: string,
    context: CallContext,
    offset = 0,
    limit = 262144,
  ) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 262144
    )
      throw new OperationError('invalidRequest', '读取范围无效。');
    const { binding, target } = await this.locate(reference, path, context);
    const located = await lstat(target);
    if (!located.isFile()) throw new OperationError('invalidRequest', '只能读取普通文件。');
    const handle = await open(
      target,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    try {
      const before = await handle.stat();
      if (!before.isFile()) throw new OperationError('invalidRequest', '只能读取普通文件。');
      if (before.dev !== located.dev || before.ino !== located.ino)
        throw new OperationError('contentChanged', '资源目标已变化。');
      const buffer = Buffer.alloc(Math.min(limit, Math.max(0, before.size - offset)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      const after = await handle.stat();
      const currentTarget = await realpath(resolve(binding.root, path));
      const current = await lstat(currentTarget);
      binding.check();
      context.signal?.throwIfAborted();
      if (
        currentTarget !== target ||
        before.dev !== current.dev ||
        before.ino !== current.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs
      )
        throw new OperationError('contentChanged', '读取期间资源已变化。');
      return {
        base64: buffer.subarray(0, bytesRead).toString('base64'),
        byteLength: before.size,
        ...(offset + bytesRead < before.size ? { nextOffset: offset + bytesRead } : {}),
      };
    } finally {
      await handle.close();
    }
  }

  async list(
    reference: ResourceReference,
    path: string,
    context: CallContext,
    offset = 0,
    limit = 100,
  ) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new OperationError('invalidRequest', '枚举范围无效。');
    const { binding, target } = await this.locate(reference, path, context);
    const directory = await opendir(target, { bufferSize: 32 });
    const entries: { name: string; directory: boolean }[] = [];
    let seen = 0;
    let more = false;
    for await (const entry of directory) {
      context.signal?.throwIfAborted();
      if (entry.isSymbolicLink()) continue;
      if (seen++ < offset) continue;
      if (entries.length === limit) {
        more = true;
        break;
      }
      entries.push({ name: entry.name, directory: entry.isDirectory() });
    }
    binding.check();
    context.signal?.throwIfAborted();
    return { entries, ...(more ? { nextOffset: offset + limit } : {}) };
  }
}
