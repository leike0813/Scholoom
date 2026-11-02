import { type BigIntStats, constants } from 'node:fs';
import { type FileHandle, lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { limits, OperationError } from '@scholoom/protocol/core';
import { reportNodeLimits, type SystemReportNode } from '@scholoom/protocol/isolation';
import { reportLimits } from '@scholoom/protocol/reports';

const unavailable = () => new OperationError('unavailable', '报告数据通道已关闭或对象不可核查。');
const flags = constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW;
type Pipe = { file: FileHandle; path: string; dev: string; ino: string };

function identity(info: BigIntStats, expected: SystemReportNode['input']): void {
  if (
    !info.isFIFO() ||
    info.uid !== BigInt(process.getuid?.() ?? -1) ||
    info.nlink !== 1n ||
    (info.mode & 0o7777n) !== 0o600n ||
    String(info.dev) !== expected.dev ||
    String(info.ino) !== expected.ino
  )
    throw unavailable();
}

function frame(text: string, code: 'invalidRequest' | 'protocolIncompatible'): void {
  if (typeof text !== 'string' || text.includes('\n'))
    throw new OperationError(code, '报告数据帧必须是单行 JSON 对象或数组。');
  if (Buffer.byteLength(text) > reportLimits.bridgeBytes)
    throw new OperationError(
      code === 'protocolIncompatible' ? code : 'resourceLimit',
      '报告数据帧超过字节预算。',
    );
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object') throw new Error();
  } catch {
    throw new OperationError(code, '报告数据帧必须是 JSON 对象或数组。');
  }
}

/** C owns only these descriptors; admission and OS lifecycle stay with the provider. */
export class IsolatedReportData {
  private readonly buffer = Buffer.allocUnsafe(reportLimits.bridgeBytes + 1);
  private size = 0;
  private closed = false;
  private busy = false;
  private closing?: Promise<void>;

  private constructor(
    private readonly pipes: readonly [Pipe, Pipe],
    private readonly authorize: () => Promise<void>,
  ) {}

  static async open(
    directory: string,
    node: SystemReportNode,
    authorize: () => Promise<void>,
  ): Promise<IsolatedReportData> {
    const pipes: Pipe[] = [];
    try {
      for (const [name, expected] of [
        ['data-in', node.input],
        ['data-out', node.output],
      ] as const) {
        const path = join(directory, name);
        const original = { dev: expected.dev, ino: expected.ino };
        identity(await lstat(path, { bigint: true }), original);
        const file = await open(path, flags);
        pipes.push({ file, path, ...original });
      }
      const data = new IsolatedReportData(pipes as [Pipe, Pipe], authorize);
      await data.checkObjects();
      return data;
    } catch (error) {
      await Promise.allSettled(pipes.map(({ file }) => file.close()));
      if (error instanceof OperationError) throw error;
      throw unavailable();
    }
  }

  private active(): void {
    if (this.closed) throw unavailable();
  }

  private async checkObjects(): Promise<void> {
    this.active();
    for (const pipe of this.pipes) {
      const info = await pipe.file.stat({ bigint: true });
      this.active();
      identity(info, pipe);
      const path = await lstat(pipe.path, { bigint: true });
      this.active();
      identity(path, pipe);
    }
  }

  private async check(): Promise<void> {
    this.active();
    await this.authorize();
    this.active();
    await this.checkObjects();
    this.active();
    await this.authorize();
    this.active();
  }

  async exchange(input?: string): Promise<{ frames: string[] }> {
    this.active();
    if (this.busy) throw new OperationError('resourceLimit', '报告数据交换已有在途请求。');
    if (input !== undefined) frame(input, 'invalidRequest');
    this.busy = true;
    let written = 0;
    let writing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const transfer = async () => {
      await this.check();
      if (input !== undefined) {
        const bytes = Buffer.from(`${input}\n`, 'utf8');
        while (written < bytes.length) {
          await this.check();
          let count = 0;
          this.active();
          writing = true;
          try {
            count = (await this.pipes[0].file.write(bytes, written, bytes.length - written))
              .bytesWritten;
            written += count;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error;
          } finally {
            writing = false;
          }
          await this.check();
          if (!count) {
            await delay(5);
            await this.check();
          }
        }
      }
      const frames: string[] = [];
      while (frames.length < reportNodeLimits.frames) {
        const newline = this.buffer.subarray(0, this.size).indexOf(10);
        if (newline >= 0) {
          let text: string;
          try {
            text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
              this.buffer.subarray(0, newline),
            );
          } catch {
            throw new OperationError('protocolIncompatible', '报告数据帧的 UTF-8 编码无效。');
          }
          frame(text, 'protocolIncompatible');
          frames.push(text);
          this.buffer.copyWithin(0, newline + 1, this.size);
          this.size -= newline + 1;
          continue;
        }
        if (this.size === this.buffer.length)
          throw new OperationError('protocolIncompatible', '报告数据半帧超过字节预算。');
        await this.check();
        let count: number;
        this.active();
        try {
          count = (
            await this.pipes[1].file.read(this.buffer, this.size, this.buffer.length - this.size)
          ).bytesRead;
          this.size += count;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error;
          await this.check();
          break;
        }
        await this.check();
        if (!count) break;
      }
      await this.check();
      this.active();
      return { frames };
    };
    try {
      return await Promise.race([
        transfer(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            void this.close().catch(() => {});
            reject(unavailable());
          }, limits.requestMs);
        }),
      ]);
    } catch (error) {
      await this.close().catch(() => {});
      if (written || writing)
        throw new OperationError('outcomeUnknown', '报告数据已部分或全部发送，效果待核查。');
      if (error instanceof OperationError) throw error;
      throw unavailable();
    } finally {
      clearTimeout(timer);
      this.busy = false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.closing ??= Promise.all(this.pipes.map(({ file }) => file.close())).then(() => {});
    return this.closing;
  }
}
