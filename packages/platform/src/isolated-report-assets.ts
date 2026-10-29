import { type BigIntStats, constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OperationError } from '@scholoom/protocol/core';
import type { IsolationReceipt, IsolationRecords } from './isolated-report-records.js';

export const isolationGate = fileURLToPath(new URL('./isolated-report-gate', import.meta.url));

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
    const sealed: Record<string, string> = {};
    for (const [name, bytes] of [
      ['program.bin', programImage],
      ['gate.bin', await readFile(isolationGate)],
    ] as const) {
      const file = await open(join(directory, name), 'wx', 0o600);
      try {
        await file.writeFile(bytes);
        await file.chmod(0o400);
        await file.sync();
        sealed[name] = isolationFileStamp(await file.stat({ bigint: true }));
      } finally {
        await file.close();
      }
    }
    receipt.sealed = {
      program: sealed['program.bin'] as string,
      gate: sealed['gate.bin'] as string,
    };
    const directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  }
}
