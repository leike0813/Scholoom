import { spawn } from 'node:child_process';
import { type BigIntStats, constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContract, limits, OperationError } from '@scholoom/protocol/core';
import {
  isolationRecordLimits,
  type SystemReportManifest,
  systemReportManifestSchema,
} from '@scholoom/protocol/isolation';
import type { IsolationReceipt, IsolationRecords } from './isolated-report-records.js';
import { describeReportNodeRuntime } from './isolated-report-runtime.js';

export const isolationGate = fileURLToPath(new URL('./isolated-report-gate', import.meta.url));
export const isolationNative = fileURLToPath(new URL('./isolated-report-scope', import.meta.url));
const validManifest = compileContract({
  params: systemReportManifestSchema,
  result: systemReportManifestSchema,
}).params;

function isolationFileStamp(s: BigIntStats): string {
  if (!s.isFile() || s.nlink !== 1n || s.uid !== BigInt(process.getuid?.() ?? -1))
    throw new OperationError('outcomeUnknown', '隔离执行完整范围或持久身份尚未确认。');
  return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
}
async function fileStamp(path: string): Promise<string> {
  return isolationFileStamp(await lstat(path, { bigint: true }));
}

/** Fixed private objects only; admission, serialization and durable receipts belong to the caller. */
export class IsolationAssets {
  constructor(private readonly records: IsolationRecords) {}

  /** Before scopeIntent: only C creates the fixed objects later opened by PID1. */
  async systemInputs(
    receipt: IsolationReceipt,
    args: readonly string[],
    runtimeRoot?: string,
  ): Promise<void> {
    if (
      receipt.version !== 2 ||
      receipt.scopeIntent ||
      !receipt.sealed ||
      process.geteuid?.() === 0
    )
      throw new OperationError('unavailable', '系统输入准备不属于当前控制记录。');
    const directory = await this.records.files(receipt);
    const held = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      for (const [name, expected] of [
        ['program.bin', receipt.sealed.program],
        ['gate.bin', receipt.sealed.gate],
        ...receipt.stamps.map((stamp, i) => [`asset-${i}.bin`, stamp]),
      ]) {
        const info = await lstat(join(directory, name as string), { bigint: true });
        if (isolationFileStamp(info) !== expected || (info.mode & 0o777n) !== 0o400n)
          throw new OperationError('contentChanged', '系统输入尚未保持原封存对象。');
      }
      for (const name of ['permit', ...(runtimeRoot ? ['data-in', 'data-out'] : [])])
        await new Promise<void>((resolve, reject) => {
          const child = spawn(isolationNative, ['--fifo', name], {
            env: { PATH: '/usr/bin:/bin', LANG: 'C' },
            stdio: ['ignore', 'ignore', 'ignore', held.fd],
          });
          const timer = setTimeout(() => child.kill('SIGKILL'), limits.lifecycleMs);
          child.once('error', reject);
          child.once('close', (code, signal) => {
            clearTimeout(timer);
            if (code === 0 && signal === null) resolve();
            else reject(new OperationError('outcomeUnknown', '系统许可对象准备未完整确认。'));
          });
        });
      const files = {} as SystemReportManifest['files'];
      for (const name of ['permit', 'events', 'stdout', 'stderr'] as const) {
        if (name !== 'permit') {
          const file = await open(join(directory, name), 'wx', 0o600);
          try {
            await file.sync();
          } finally {
            await file.close();
          }
        }
        const info = await lstat(join(directory, name), { bigint: true });
        if (
          info.uid !== BigInt(process.getuid?.() ?? -1) ||
          info.nlink !== 1n ||
          (info.mode & 0o777n) !== 0o600n ||
          (name === 'permit' ? !info.isFIFO() : !info.isFile())
        )
          throw new OperationError('outcomeUnknown', '系统输入对象归属未确认。');
        files[name] = { dev: String(info.dev), ino: String(info.ino) };
      }
      const manifest: SystemReportManifest = {
        version: 1,
        configId: receipt.configId,
        storageId: receipt.storageId,
        ownerUid: process.getuid?.() ?? -1,
        stage: structuredClone(receipt.stage),
        programVersion: receipt.programVersion,
        policyVersion: receipt.policyVersion,
        args: [...args],
        stamps: [...receipt.stamps],
        sealed: { ...receipt.sealed },
        files,
      };
      if (runtimeRoot) {
        const identities = {} as Pick<
          NonNullable<SystemReportManifest['node']>,
          'input' | 'output'
        >;
        for (const [key, name] of [
          ['input', 'data-in'],
          ['output', 'data-out'],
        ] as const) {
          const info = await lstat(join(directory, name), { bigint: true });
          if (
            !info.isFIFO() ||
            info.uid !== BigInt(process.getuid?.() ?? -1) ||
            info.nlink !== 1n ||
            (info.mode & 0o777n) !== 0o600n
          )
            throw new OperationError('outcomeUnknown', '报告数据管道对象未确认。');
          identities[key] = { dev: String(info.dev), ino: String(info.ino) };
        }
        manifest.node = {
          files: await describeReportNodeRuntime(runtimeRoot),
          ...identities,
        };
      }
      const text = JSON.stringify(manifest);
      if (!validManifest(manifest) || Buffer.byteLength(text) > isolationRecordLimits.manifestBytes)
        throw new OperationError('invalidRequest', '系统输入描述不完整或超过边界。');
      const file = await open(join(directory, 'manifest.json'), 'wx', 0o600);
      try {
        await file.writeFile(text);
        await file.chmod(0o400);
        await file.sync();
        const stamp = isolationFileStamp(await file.stat({ bigint: true }));
        if ((await fileStamp(join(directory, 'manifest.json'))) !== stamp)
          throw new OperationError('contentChanged', '系统输入描述对象已变化。');
        await held.sync();
        const bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(bootId))
          throw new OperationError('outcomeUnknown', '系统启动身份不可核查。');
        receipt.systemInputs = {
          bootId,
          manifest: stamp,
          ...files,
          ...(manifest.node ? { node: manifest.node } : {}),
        };
      } finally {
        await file.close();
      }
    } finally {
      await held.close();
    }
  }

  async prepare(receipt: IsolationReceipt): Promise<void> {
    const directory = await this.records.files(receipt);
    for (const [i] of receipt.stage.assets.entries()) {
      const file = await open(join(directory, `asset-${i}.bin`), 'wx', 0o600);
      try {
        await file.sync();
        receipt.stamps[i] = isolationFileStamp(await file.stat({ bigint: true }));
      } finally {
        await file.close();
      }
    }
  }

  async put(
    receipt: IsolationReceipt,
    index: number,
    offset: number,
    bytes: Uint8Array,
    commit: () => Promise<void>,
  ): Promise<void> {
    const path = join(await this.records.files(receipt), `asset-${index}.bin`);
    const file = await open(path, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await file.stat({ bigint: true });
      if (isolationFileStamp(info) !== receipt.stamps[index] || info.size !== BigInt(offset))
        throw new OperationError('contentChanged', '字节准备对象已变化。');
      const result = await file.write(bytes, 0, bytes.length, offset);
      if (result.bytesWritten !== bytes.length)
        throw new OperationError('outcomeUnknown', '隔离范围尚未完整确认停止，保留原占用。');
      await file.sync();
      const stamp = isolationFileStamp(await file.stat({ bigint: true }));
      if ((await fileStamp(path)) !== stamp)
        throw new OperationError('contentChanged', '字节准备对象已被替换。');
      receipt.stamps[index] = stamp;
      receipt.offsets[index] = offset + bytes.length;
      await commit();
    } finally {
      await file.close();
    }
  }

  async seal(receipt: IsolationReceipt, programImage: Uint8Array): Promise<void> {
    const directory = await this.records.files(receipt);
    for (const [i, asset] of receipt.stage.assets.entries()) {
      const path = join(directory, `asset-${i}.bin`);
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const info = await file.stat({ bigint: true });
        if (
          isolationFileStamp(info) !== receipt.stamps[i] ||
          info.size !== BigInt(asset.byteLength)
        )
          throw new OperationError('contentChanged', '封存输入的物理对象或内容已变化。');
        await file.chmod(0o400);
        await file.sync();
        const stamp = isolationFileStamp(await file.stat({ bigint: true }));
        if ((await fileStamp(path)) !== stamp)
          throw new OperationError('contentChanged', '封存输入已被替换。');
        receipt.stamps[i] = stamp;
      } finally {
        await file.close();
      }
    }
    receipt.sealed ??= { program: '', gate: '' };
    for (const [name, bytes] of [
      ['program', programImage],
      ['gate', await readFile(isolationGate)],
    ] as const) {
      const file = await open(join(directory, `${name}.bin`), 'wx', 0o600);
      try {
        await file.writeFile(bytes);
        await file.chmod(0o400);
        await file.sync();
        receipt.sealed[name] = isolationFileStamp(await file.stat({ bigint: true }));
      } finally {
        await file.close();
      }
    }
    const directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  }
}
