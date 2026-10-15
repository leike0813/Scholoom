import { createHash } from 'node:crypto';
import { type BigIntStats, constants } from 'node:fs';
import { link, lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { LibraryAttachment } from '@scholoom/protocol';
import { failure, OperationError } from '../errors.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';

export const MATERIAL_LIMIT = 128 * 1024 * 1024;
export const MATERIAL_CHUNK = 256 * 1024;
export type MaterialContent = {
  path: string;
  hash: string;
  fingerprint: string;
  byteLength: number;
};
export type StoredMaterial = MaterialContent & {
  value: Omit<LibraryAttachment, 'state' | 'error'>;
};
const fingerprint = (s: BigIntStats) => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');

/** 文件归属与版本核对；调用方只在发布后提交库记录。 */
export class MaterialFiles {
  readonly directory: string;
  private verified = new Map<string, string>();
  constructor(libraryDirectory: string) {
    this.directory = join(libraryDirectory, 'materials');
  }
  async initialize(): Promise<void> {
    await privateDirectory(this.directory);
  }

  private async file(path: string) {
    if (!isAbsolute(path)) throw new OperationError('invalidRequest', '材料需明确本机绝对路径。');
    const handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    try {
      const stats = await handle.stat({ bigint: true });
      if (!stats.isFile() || (await lstat(path)).isSymbolicLink())
        throw new OperationError(
          'permissionDenied',
          '材料需普通文件，不能使用符号链接或特殊文件。',
        );
      if (stats.size > BigInt(MATERIAL_LIMIT))
        throw new OperationError('tooLarge', '单份材料超过128MiB。');
      return { handle, stats };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  private async digest(path: string): Promise<MaterialContent> {
    const { handle, stats } = await this.file(path);
    try {
      const hash = createHash('sha256');
      let size = 0;
      for await (const chunk of handle.createReadStream({
        autoClose: false,
        highWaterMark: MATERIAL_CHUNK,
      })) {
        size += chunk.length;
        if (size > MATERIAL_LIMIT) throw new OperationError('tooLarge', '单份材料超过128MiB。');
        hash.update(chunk);
      }
      const after = await handle.stat({ bigint: true });
      if (fingerprint(stats) !== fingerprint(after) || size !== Number(stats.size))
        throw new OperationError('contentChanged', '读取期间材料变化，请重新核查。');
      return {
        path: await realpath(path),
        hash: hash.digest('hex'),
        fingerprint: fingerprint(after),
        byteLength: size,
      };
    } finally {
      await handle.close();
    }
  }

  async capture(id: string, path: string, storage: 'managed' | 'linked'): Promise<MaterialContent> {
    if (storage === 'linked') return this.digest(path);
    const target = join(this.directory, id);
    try {
      const content = await this.digest(target);
      let expected: { hash: string; byteLength: number };
      try {
        expected = JSON.parse(await readFile(join(this.directory, `${id}.json`), 'utf8'));
      } catch {
        throw new OperationError(
          'outcomeUnknown',
          '本项已有材料缺少完整发布依据，保留现场供核查。',
        );
      }
      if (expected.hash !== content.hash || expected.byteLength !== content.byteLength)
        throw new OperationError(
          'contentChanged',
          '本项已发布材料与原准备内容不同，保留现场供核查。',
        );
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const temporary = join(this.directory, `.${id}.pending`);
    let expected: { hash: string; byteLength: number } | undefined;
    try {
      expected = JSON.parse(await readFile(join(this.directory, `${id}.json`), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (expected) {
      let content: MaterialContent;
      try {
        content = await this.digest(temporary);
      } catch {
        throw new OperationError('outcomeUnknown', '完整材料暂存缺失，保留发布依据供核查。');
      }
      if (content.hash !== expected.hash || content.byteLength !== expected.byteLength)
        throw new OperationError('contentChanged', '暂存材料与原准备版本不同，保留现场。');
      await link(temporary, target);
      await unlink(temporary);
      return {
        ...content,
        path: target,
        fingerprint: fingerprint(await lstat(target, { bigint: true })),
      };
    }
    const { handle, stats } = await this.file(path);
    let output: Awaited<ReturnType<typeof open>> | undefined;
    let complete = false;
    try {
      // 没有完成依据的部分复制属于本项，可以从原输入重新准备。
      await unlink(temporary).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      output = await open(temporary, 'wx', 0o600);
      const hash = createHash('sha256');
      let size = 0;
      for await (const chunk of handle.createReadStream({
        autoClose: false,
        highWaterMark: MATERIAL_CHUNK,
      })) {
        size += chunk.length;
        if (size > MATERIAL_LIMIT) throw new OperationError('tooLarge', '单份材料超过128MiB。');
        hash.update(chunk);
        await output.writeFile(chunk);
      }
      if (
        fingerprint(stats) !== fingerprint(await handle.stat({ bigint: true })) ||
        size !== Number(stats.size)
      )
        throw new OperationError('contentChanged', '复制期间材料变化，请重新核查。');
      await output.sync();
      await output.close();
      output = undefined;
      const digest = hash.digest('hex');
      await atomicPrivateFile(
        this.directory,
        `${id}.json`,
        JSON.stringify({ hash: digest, byteLength: size }),
      );
      complete = true;
      try {
        await link(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if ((await this.digest(target)).hash !== digest)
          throw new OperationError(
            'contentChanged',
            '本项已有材料与当前输入不同，保留现场供核查。',
          );
      }
      await unlink(temporary);
      return {
        path: target,
        hash: digest,
        byteLength: size,
        fingerprint: fingerprint(await lstat(target, { bigint: true })),
      };
    } finally {
      await output?.close();
      await handle.close();
      if (!complete) await unlink(temporary).catch(() => {});
    }
  }

  private remember(record: StoredMaterial, fp: string): void {
    this.verified.delete(record.value.id);
    this.verified.set(record.value.id, `${record.hash}:${fp}`);
    if (this.verified.size > 128) this.verified.delete(this.verified.keys().next().value as string);
  }
  async status(record: StoredMaterial): Promise<LibraryAttachment> {
    try {
      const { handle, stats } = await this.file(record.path);
      await handle.close();
      const fp = fingerprint(stats);
      if (
        fp !== record.fingerprint &&
        this.verified.get(record.value.id) !== `${record.hash}:${fp}`
      )
        return {
          ...record.value,
          state: 'changed',
          error: { code: 'contentChanged', message: '文件状态已变化，请按原材料版本核查。' },
        };
      return { ...record.value, state: 'available' };
    } catch (error) {
      return {
        ...record.value,
        state: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unavailable',
        error: failure(error),
      };
    }
  }
  async read(record: StoredMaterial, offset: number, limit: number): Promise<Buffer> {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MATERIAL_CHUNK
    )
      throw new OperationError('invalidRequest', '材料读取范围无效。');
    const { handle, stats } = await this.file(record.path);
    try {
      const fp = fingerprint(stats);
      if (this.verified.get(record.value.id) !== `${record.hash}:${fp}`) {
        const hash = createHash('sha256');
        let size = 0;
        for await (const chunk of handle.createReadStream({
          autoClose: false,
          highWaterMark: MATERIAL_CHUNK,
        })) {
          size += chunk.length;
          if (size > MATERIAL_LIMIT) throw new OperationError('tooLarge', '材料超限。');
          hash.update(chunk);
        }
        if (
          hash.digest('hex') !== record.hash ||
          size !== record.byteLength ||
          fingerprint(await handle.stat({ bigint: true })) !== fp
        )
          throw new OperationError(
            'contentChanged',
            '材料内容与记录的版本不同，请保留原记录并另行添加新材料。',
          );
        this.remember(record, fp);
      }
      if (offset > record.byteLength)
        throw new OperationError('invalidRequest', '读取位置超出材料。');
      const buffer = Buffer.alloc(Math.min(limit, record.byteLength - offset));
      let position = 0;
      while (position < buffer.length) {
        const result = await handle.read(
          buffer,
          position,
          buffer.length - position,
          offset + position,
        );
        if (!result.bytesRead) throw new OperationError('contentChanged', '材料在读取期间缩短。');
        position += result.bytesRead;
      }
      if (fingerprint(await handle.stat({ bigint: true })) !== fp)
        throw new OperationError('contentChanged', '材料在读取期间发生变化。');
      return buffer;
    } finally {
      await handle.close();
    }
  }
  async relocate(record: StoredMaterial, path: string): Promise<StoredMaterial> {
    if (record.value.storage !== 'linked')
      throw new OperationError('invalidRequest', '仅外链附件可以重新指定路径。');
    const content = await this.digest(path);
    if (content.hash !== record.hash)
      throw new OperationError('contentChanged', '新位置的内容不是原材料版本。');
    return { ...record, ...content };
  }
  async discard(id: string): Promise<void> {
    this.verified.delete(id);
    await unlink(join(this.directory, id)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await unlink(join(this.directory, `${id}.json`)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
