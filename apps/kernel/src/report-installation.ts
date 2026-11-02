import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type ContractParams, compileContract, OperationError } from '@scholoom/protocol/core';
import { reportInstallationFile } from './host-settings.js';
import type { ReportViewInstallation } from './report-views.js';

const unavailable = () => new OperationError('unavailable', '受保护的报告系统安装未获确认。');

/** Shared by the installed C/M entry and the product K; no business request supplies these paths. */
export async function protectedReportFile(path: string): Promise<Buffer> {
  if (path !== resolve(path)) throw unavailable();
  for (let current = dirname(path); current !== '/'; current = dirname(current)) {
    const info = await lstat(current);
    if (!info.isDirectory() || info.uid !== 0 || info.mode & 0o022) throw unavailable();
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (
      !info.isFile() ||
      info.uid !== 0 ||
      info.nlink !== 1 ||
      info.mode & 0o022 ||
      info.size > 16 * 1024 * 1024
    )
      throw unavailable();
    return await file.readFile();
  } finally {
    await file.close();
  }
}

const id = { type: 'string', minLength: 1, maxLength: 1024 } as const;
const installation = {
  params: {
    type: 'object',
    properties: {
      configId: {
        type: 'string',
        pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
      },
      kernelUid: { type: 'integer', minimum: 1 },
      kernelGid: { type: 'integer', minimum: 1 },
      programId: { const: 'scholoom-interactive-report' },
      programVersion: { const: '1' },
      managerSocket: { type: 'string', minLength: 1, maxLength: 4096 },
      runtimeRoot: { type: 'string', minLength: 1, maxLength: 4096 },
      policy: {
        type: 'object',
        properties: { id, profile: { const: 'linux-x64-node-v1' } },
        required: ['id', 'profile'],
      },
    },
    required: [
      'configId',
      'kernelUid',
      'kernelGid',
      'programId',
      'programVersion',
      'managerSocket',
      'runtimeRoot',
      'policy',
    ],
  },
  result: true,
  semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
} as const;
const validate = compileContract(installation).params;

export async function loadReportInstallation(
  directory: string,
): Promise<ReportViewInstallation | undefined> {
  const path = await reportInstallationFile(directory);
  if (!path) return undefined;
  if (process.platform !== 'linux' || process.arch !== 'x64') throw unavailable();
  const bytes = await protectedReportFile(path);
  if (bytes.length > 65536) throw unavailable();
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  if (!validate(raw)) throw unavailable();
  const value = raw as ContractParams<typeof installation>;
  if (
    value.kernelUid !== process.getuid?.() ||
    value.kernelGid !== process.getgid?.() ||
    value.managerSocket !== resolve(value.managerSocket) ||
    value.runtimeRoot !== dirname(path)
  )
    throw unavailable();
  return {
    configId: value.configId,
    programId: value.programId,
    policyId: value.policy.id,
    connect: (client) =>
      client.connectService({
        path: join(dirname(value.managerSocket), 'control.sock'),
        ownerUid: 0,
        serverUid: 0,
      }),
  };
}
