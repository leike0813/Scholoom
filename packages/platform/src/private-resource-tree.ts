import { execFile } from 'node:child_process';
import { isAbsolute, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OperationError } from '@scholoom/protocol/core';
import { nodeEnvironment } from './processes.js';

export type PrivateTreeSnapshot = {
  readFile(relativePath: string, maxBytes: number): Promise<Uint8Array>;
  verifyUnchanged(): Promise<void>;
  close(): Promise<void>;
};

const maximumRead = 256 * 1024;
const maximumWitness = 8 * 1024 * 1024;
const unavailable = () => new OperationError('unavailable', '私有资源的原生核验不可用。');

function relative(value: string): void {
  if (
    !value ||
    value.length > 32700 ||
    value.includes('\0') ||
    win32.isAbsolute(value) ||
    value
      .split(/[\\/]/)
      .some((part) => !part || part === '.' || part === '..' || /[:*?]/.test(part))
  )
    throw new OperationError('invalidRequest', '私有资源必须使用范围内的相对路径。');
}

function limit(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximumRead)
    throw new OperationError('invalidRequest', '私有资源读取字节上限无效。');
}

function configuration(value: string): void {
  if (!isAbsolute(value) || value.includes('\0') || value.length > 32700)
    throw new OperationError('invalidRequest', '私有资源配置目录无效。');
  if (process.platform !== 'win32' || process.arch !== 'x64') throw unavailable();
}

/** Host-private adapter; never accepts an executable or permission-repair fallback. */
async function inspect(input: {
  configurationDirectory: string;
  resourceRelativePath: string;
  maxEntries: number;
  file?: { relativePath: string; maxBytes: number };
  singleFile?: boolean;
}): Promise<{ witness: Buffer; data: Buffer; status: number }> {
  const arguments_ = [
    input.configurationDirectory,
    input.resourceRelativePath,
    String(input.maxEntries),
    input.singleFile ? 'file' : 'tree',
    ...(input.file ? [input.file.relativePath, String(input.file.maxBytes)] : []),
  ];
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      fileURLToPath(new URL('./private-resource-tree.exe', import.meta.url)),
      arguments_,
      {
        encoding: 'buffer',
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        env: nodeEnvironment(),
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout);
        // Native diagnostics contain only a fixed stage and integer error, never file bytes.
        const detail = stderr.toString('utf8');
        if (error.code === 12) reject(new OperationError('tooLarge', '私有资源超过核验范围。'));
        else if (error.code === 13)
          reject(new OperationError('contentChanged', '私有资源在核验中变化。'));
        else if (/^resource-tree:[a-z-]+ Win32=\d+\r?\n?$/.test(detail))
          reject(new OperationError('unavailable', detail.trim()));
        else reject(unavailable());
      },
    );
  });
  if (bytes.length < 16 || bytes.toString('ascii', 0, 4) !== 'PRT1') throw unavailable();
  const witnessLength = bytes.readUInt32LE(4);
  const dataLength = bytes.readUInt32LE(8);
  const status = bytes.readUInt32LE(12);
  if (
    witnessLength < 1 ||
    witnessLength > maximumWitness ||
    dataLength > (input.file?.maxBytes ?? 0) ||
    ![0, 11, 12, 13].includes(status) ||
    (status !== 0 && dataLength !== 0) ||
    bytes.length !== 16 + witnessLength + dataLength
  )
    throw unavailable();
  return {
    witness: bytes.subarray(16, 16 + witnessLength),
    data: bytes.subarray(16 + witnessLength),
    status,
  };
}

function readStatus(status: number): void {
  if (status === 12) throw new OperationError('tooLarge', '私有资源超过读取范围。');
  if (status === 13) throw new OperationError('contentChanged', '私有资源在读取中变化。');
  if (status) throw unavailable();
}

export async function inspectPrivateResourceTree(input: {
  configurationDirectory: string;
  resourceRelativePath: string;
  maxEntries: number;
}): Promise<PrivateTreeSnapshot> {
  relative(input.resourceRelativePath);
  if (!Number.isSafeInteger(input.maxEntries) || input.maxEntries < 1 || input.maxEntries > 4096)
    throw new OperationError('invalidRequest', '私有资源成员上限无效。');
  configuration(input.configurationDirectory);
  // Copy the binding: a caller mutating its input must not silently redirect this snapshot.
  const binding = { ...input };
  let witness: Buffer | undefined = (await inspect(binding)).witness;
  let closed = false;
  let pending = 0;
  let tail: Promise<void> = Promise.resolve();
  let closing: Promise<void> | undefined;
  const check = (file?: { relativePath: string; maxBytes: number }): Promise<Uint8Array> => {
    if (closed) return Promise.reject(unavailable());
    if (pending >= 8)
      return Promise.reject(new OperationError('resourceLimit', '私有资源核验等待已满。'));
    pending++;
    const task = tail.then(async () => {
      if (closed || !witness) throw unavailable();
      const result = await inspect({ ...binding, ...(file ? { file } : {}) });
      if (closed) throw unavailable();
      if (!witness.equals(result.witness))
        throw new OperationError('contentChanged', '私有资源与原见证不符。');
      readStatus(result.status);
      return new Uint8Array(result.data);
    });
    tail = task.then(
      () => {
        pending--;
      },
      () => {
        pending--;
      },
    );
    return task;
  };
  return Object.freeze({
    async readFile(relativePath: string, maxBytes: number) {
      relative(relativePath);
      limit(maxBytes);
      return check({ relativePath, maxBytes });
    },
    async verifyUnchanged() {
      await check();
    },
    close() {
      closed = true;
      closing ??= tail.then(() => {
        witness = undefined;
      });
      return closing;
    },
  });
}

/** Same native object/ACL checks for the settings leaf, without scanning mutable library data. */
export async function readPrivateResourceFile(input: {
  configurationDirectory: string;
  relativePath: string;
  maxBytes: number;
}): Promise<Uint8Array> {
  relative(input.relativePath);
  limit(input.maxBytes);
  configuration(input.configurationDirectory);
  const result = await inspect({
    configurationDirectory: input.configurationDirectory,
    resourceRelativePath: input.relativePath,
    maxEntries: 1,
    singleFile: true,
    file: { relativePath: '.', maxBytes: input.maxBytes },
  });
  readStatus(result.status);
  return new Uint8Array(result.data);
}
