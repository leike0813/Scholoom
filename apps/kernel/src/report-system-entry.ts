import { dirname, join } from 'node:path';
import {
  createSystemReportManagerHost,
  lockSystemReportManager,
  provisionSystemReportRoot,
  type SystemReportInstallation,
} from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import { protectedReportFile } from './report-installation.js';
import { serveReportManager, serveSystemReportControl } from './report-service.js';

type Installed = SystemReportInstallation & { managerSocket: string; programArgs: string[] };
const unavailable = () => new OperationError('unavailable', '受保护的报告系统安装未获确认。');

/** Dedicated socket-activated role; the root-owned installation supplies every path and registration. */
async function main(): Promise<void> {
  const [role, file] = process.argv.slice(2);
  if (
    !file ||
    process.argv.length !== 4 ||
    !['--control', '--manager', '--provision'].includes(role ?? '')
  )
    throw unavailable();
  const bytes = await protectedReportFile(file);
  if (bytes.length > 65536) throw unavailable();
  const config = JSON.parse(bytes.toString('utf8')) as Installed;
  if (
    !Number.isSafeInteger(config.controlUid) ||
    config.controlUid <= 0 ||
    !Number.isSafeInteger(config.kernelUid) ||
    config.kernelUid <= 0 ||
    config.controlUid === config.kernelUid ||
    !Number.isSafeInteger(config.controlGid) ||
    config.controlGid <= 0 ||
    !Number.isSafeInteger(config.kernelGid) ||
    config.kernelGid <= 0 ||
    config.controlGid === config.kernelGid
  )
    throw unavailable();
  if (role === '--manager') {
    if (process.getuid?.() !== 0 || process.geteuid?.() !== 0) throw unavailable();
    const lock = await lockSystemReportManager(dirname(file));
    try {
      await serveReportManager({
        callerUid: config.controlUid,
        configId: config.configId,
        host: createSystemReportManagerHost(config),
      });
    } finally {
      await lock.close();
    }
    return;
  }
  if (
    process.getuid?.() !== config.controlUid ||
    process.geteuid?.() !== config.controlUid ||
    process.getgid?.() !== config.controlGid ||
    process.getegid?.() !== config.controlGid
  )
    throw unavailable();
  if (role === '--provision') {
    process.stdout.write(
      `${JSON.stringify({ configId: await provisionSystemReportRoot(config.privateRoot) })}\n`,
    );
    return;
  }
  const image = await protectedReportFile(join(dirname(file), 'program.bin'));
  await serveSystemReportControl({
    callerUid: config.kernelUid,
    configId: config.configId,
    privateRoot: config.privateRoot,
    programs: [
      {
        id: config.programId,
        version: config.programVersion,
        policyId: config.policy.id,
        image,
        args: config.programArgs,
        ...(config.runtimeRoot ? { runtimeRoot: config.runtimeRoot } : {}),
      },
    ],
    policies: [config.policy],
    manager: { path: config.managerSocket, ownerUid: 0, serverUid: 0 },
  });
}

await main().catch((error: unknown) => {
  const failure =
    error instanceof OperationError
      ? { code: error.code, message: error.message }
      : { code: 'unavailable' };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});
