import { lstat, open, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  type ContractParams,
  compileContract,
  type ErrorInfo,
  OperationError,
} from '@scholoom/protocol/core';

const id = { type: 'string', minLength: 1, maxLength: 1024 } as const;
const registration = {
  type: 'object',
  additionalProperties: false,
  properties: { id, layout: { const: 'linux-x64-electron-managed-v1' } },
  required: ['id', 'layout'],
} as const;
const binding = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean' },
    scope: { const: 'isolated-library-journals' },
    libraryId: id,
    resourceId: id,
    resources: { type: 'array', minItems: 1, maxItems: 1, items: registration },
  },
  required: ['enabled', 'scope', 'libraryId', 'resourceId', 'resources'],
} as const;
const contract = {
  params: {
    type: 'object',
    additionalProperties: false,
    properties: {
      version: { const: 1 },
      kernelDirectory: { type: 'string', minLength: 1, maxLength: 4096 },
      zotero: {
        anyOf: [
          binding,
          {
            type: 'object',
            additionalProperties: false,
            properties: { enabled: { const: false } },
            required: ['enabled'],
          },
        ],
      },
    },
    required: ['version', 'kernelDirectory', 'zotero'],
  },
  result: true,
  semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
} as const;
type HostSettings = ContractParams<typeof contract>;
type Binding = Extract<HostSettings['zotero'], { libraryId: string }>;
export type ZoteroResource = Binding['resources'][number];
export type HostSettingsRead =
  | { state: 'disabled' }
  | { state: 'invalid'; error: ErrorInfo }
  | { state: 'loaded'; settings: HostSettings & { zotero: Binding } };
const validate = compileContract(contract).params;

/** A host-private leaf: no product write port, credentials or native path overrides. */
export async function loadHostSettings(directory: string): Promise<HostSettingsRead> {
  let found = false;
  try {
    const filename = join(directory, 'host-settings.json');
    const info = await lstat(filename);
    found = true;
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      (process.platform !== 'win32' &&
        ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))
    )
      throw new OperationError('unavailable', '宿主设置不是安全的私有文件。');
    const handle = await open(filename, 'r');
    let raw: unknown;
    try {
      const opened = await handle.stat();
      if (opened.dev !== info.dev || opened.ino !== info.ino || opened.size > 16384)
        throw new OperationError('unavailable', '宿主设置已变化或超出16KiB。');
      const bytes = Buffer.alloc(16385);
      let size = 0;
      while (size < bytes.length) {
        const { bytesRead } = await handle.read(bytes, size, bytes.length - size, size);
        if (!bytesRead) break;
        size += bytesRead;
      }
      if (size > 16384) throw new OperationError('tooLarge', '宿主设置超出16KiB。');
      raw = JSON.parse(bytes.subarray(0, size).toString('utf8'));
    } finally {
      await handle.close();
    }
    if (!validate(raw)) throw new OperationError('unavailable', '宿主设置结构无效。');
    const value = raw as HostSettings;
    if (value.kernelDirectory !== (await realpath(directory)))
      throw new OperationError('unavailable', '宿主设置版本、结构或配置目录无效。');
    if ('resources' in value.zotero && value.zotero.resources[0]?.id !== value.zotero.resourceId)
      throw new OperationError('unavailable', '宿主资源登记与所选资源不符。');
    if (!value.zotero.enabled) return { state: 'disabled' };
    if (!('resources' in value.zotero))
      throw new OperationError('unavailable', '缺少宿主资源登记。');
    Object.freeze(value.zotero.resources[0]);
    Object.freeze(value.zotero.resources);
    Object.freeze(value.zotero);
    return {
      state: 'loaded',
      settings: Object.freeze(value) as HostSettings & { zotero: Binding },
    };
  } catch (error) {
    if (!found && (error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'disabled' };
    return {
      state: 'invalid',
      error: { code: 'unavailable', message: '私有宿主设置不可用；保留原文件并离线核查。' },
    };
  }
}

export async function checkUnchanged(
  snapshot: Extract<HostSettingsRead, { state: 'loaded' }>,
): Promise<void> {
  const current = await loadHostSettings(snapshot.settings.kernelDirectory);
  if (current.state !== 'loaded' || !isDeepStrictEqual(current.settings, snapshot.settings))
    throw new OperationError('unavailable', '宿主设置已变化；请显式停止并重启内核。');
}
