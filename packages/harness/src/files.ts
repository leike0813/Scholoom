import type { RpcPeer } from '@scholoom/broker/rpc';
import { OperationError } from '@scholoom/protocol/core';
import type { ExecutionControlOutputs, ExecutionFileProviders } from '@scholoom/protocol/execution';
import type { BackendProtocolV2, FileData } from 'deepagents';
import { callExecutionControl } from './control.js';

type WireData = NonNullable<ExecutionControlOutputs['execution.files.readRaw']['data']>;
function encodeData(data: FileData): WireData {
  if (Array.isArray(data.content))
    return { content: data.content, created_at: data.created_at, modified_at: data.modified_at };
  if (!('mimeType' in data)) throw new OperationError('unavailable', '文件数据缺少媒体类型。');
  return {
    ...data,
    content:
      typeof data.content === 'string'
        ? data.content
        : { base64: Buffer.from(data.content).toString('base64') },
  };
}
function decodeData(data: WireData): FileData {
  if (Array.isArray(data.content))
    return { content: data.content, created_at: data.created_at, modified_at: data.modified_at };
  if (!('mimeType' in data)) throw new OperationError('unavailable', '文件数据缺少媒体类型。');
  return {
    ...data,
    content:
      typeof data.content === 'string' ? data.content : Buffer.from(data.content.base64, 'base64'),
  };
}
const encodeUpdates = (updates: Record<string, FileData> | null | undefined) => {
  try {
    return updates === undefined
      ? {}
      : {
          filesUpdate:
            updates === null
              ? null
              : Object.fromEntries(
                  Object.entries(updates).map(([path, data]) => [path, encodeData(data)]),
                ),
        };
  } catch {
    throw new OperationError('outcomeUnknown', '文件已执行，但结果转换失败，请核查实际内容。');
  }
};
const decodeUpdates = (updates: Record<string, WireData> | null | undefined) =>
  updates === undefined
    ? {}
    : {
        filesUpdate:
          updates === null
            ? null
            : Object.fromEntries(
                Object.entries(updates).map(([path, data]) => [path, decodeData(data)]),
              ),
      };

export function fileProviders(backend: BackendProtocolV2): ExecutionFileProviders {
  return {
    'execution.files.ls': ({ path }) => backend.ls(path),
    'execution.files.read': async ({ path, offset, limit }) => {
      const { content, ...result } = await backend.read(path, offset, limit);
      return {
        ...result,
        ...(content === undefined
          ? {}
          : {
              content:
                typeof content === 'string'
                  ? content
                  : { base64: Buffer.from(content).toString('base64') },
            }),
      };
    },
    'execution.files.readRaw': async ({ path }) => {
      const { data, ...result } = await backend.readRaw(path);
      return { ...result, ...(data ? { data: encodeData(data) } : {}) };
    },
    'execution.files.write': async ({ path, content }) => {
      const { filesUpdate, ...result } = await backend.write(path, content);
      return { ...result, ...encodeUpdates(filesUpdate) };
    },
    'execution.files.edit': async ({ path, oldString, newString, replaceAll }) => {
      const { filesUpdate, ...result } = await backend.edit(path, oldString, newString, replaceAll);
      return { ...result, ...encodeUpdates(filesUpdate) };
    },
    'execution.files.glob': ({ pattern, path }) => backend.glob(pattern, path),
    'execution.files.grep': ({ pattern, path, glob, maxCount }) =>
      backend.grep(pattern, path, glob, maxCount),
    'execution.files.delete': ({ path }) => {
      if (!backend.delete) throw new OperationError('unavailable', '文件删除能力不可用。');
      return backend.delete(path);
    },
  };
}

export function executionFiles(
  peer: RpcPeer,
  currentToken: () => string | undefined,
): BackendProtocolV2 {
  const token = () => {
    const value = currentToken();
    return value ? { token: value } : {};
  };
  return {
    ls: (path) => callExecutionControl(peer, 'execution.files.ls', { path, ...token() }),
    read: async (path, offset = 0, limit = 500) => {
      const { content, ...result } = await callExecutionControl(peer, 'execution.files.read', {
        path,
        offset,
        limit,
        ...token(),
      });
      return {
        ...result,
        ...(content === undefined
          ? {}
          : {
              content:
                typeof content === 'string' ? content : Buffer.from(content.base64, 'base64'),
            }),
      };
    },
    readRaw: async (path) => {
      const { data, ...result } = await callExecutionControl(peer, 'execution.files.readRaw', {
        path,
        ...token(),
      });
      return { ...result, ...(data ? { data: decodeData(data) } : {}) };
    },
    write: async (path, content) => {
      const { filesUpdate, ...result } = await callExecutionControl(peer, 'execution.files.write', {
        path,
        content,
        ...token(),
      });
      return { ...result, ...decodeUpdates(filesUpdate) };
    },
    edit: async (path, oldString, newString, replaceAll = false) => {
      const { filesUpdate, ...result } = await callExecutionControl(peer, 'execution.files.edit', {
        path,
        oldString,
        newString,
        replaceAll,
        ...token(),
      });
      return { ...result, ...decodeUpdates(filesUpdate) };
    },
    glob: (pattern, path = '/') =>
      callExecutionControl(peer, 'execution.files.glob', { pattern, path, ...token() }),
    grep: (pattern, path = null, glob = null, maxCount = null) =>
      callExecutionControl(peer, 'execution.files.grep', {
        pattern,
        path,
        glob,
        maxCount,
        ...token(),
      }),
    delete: (path) => callExecutionControl(peer, 'execution.files.delete', { path, ...token() }),
    uploadFiles: async (files) =>
      (
        await callExecutionControl(peer, 'execution.files.upload', {
          files: files.map(([path, content]) => ({
            path,
            content: Buffer.from(content).toString('base64'),
          })),
          ...token(),
        })
      ).files,
    downloadFiles: async (paths) =>
      (
        await callExecutionControl(peer, 'execution.files.download', { paths, ...token() })
      ).files.map(({ path, content, error }) => ({
        path,
        content: content === null ? null : Buffer.from(content, 'base64'),
        error,
      })),
  };
}
