import { Console } from 'node:console';
import { OperationError } from '@scholoom/protocol/core';
import { isReportProgramPacket, reportLimits } from '@scholoom/protocol/reports';
import { ReportProgramFiles } from './files.mjs';
import { createReportProgram } from './program.mjs';

// This fixed entry runs after G in P; no credentials or host runtime configuration are accepted.
const write = process.stdout.write.bind(process.stdout);
globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
let tail = Promise.resolve();
let pending = 0;
let failed = false;
function send(packet, final = false) {
  if ((!final && failed) || pending >= (final ? 5 : 4) || !isReportProgramPacket(packet))
    return Promise.reject(new OperationError('resourceLimit', '报告传输超过容量。'));
  const bytes = `${JSON.stringify(packet)}\n`;
  pending++;
  const sent = tail.then(
    () =>
      new Promise((resolve, reject) =>
        write(bytes, (error) => (error ? reject(error) : resolve())),
      ),
  );
  tail = sent.catch(() => {});
  return sent.finally(() => {
    pending--;
  });
}
let program;
function fail(error, binding) {
  if (failed) return;
  failed = true;
  const known = error instanceof OperationError;
  const detail = {
    code: known ? error.code : 'unavailable',
    message: String(error?.message ?? error).slice(0, 512),
  };
  if (binding)
    void send({ ...binding, type: 'error', error: detail }, true).then(
      () => process.exit(1),
      () => process.exit(1),
    );
  else {
    console.error(detail);
    process.exit(1);
  }
}
try {
  if (process.argv.length !== 3) throw new OperationError('invalidRequest', '报告入口参数无效。');
  const files = new ReportProgramFiles(process.argv[2]);
  program = createReportProgram(files, { send, failed: fail });
  const input = Buffer.alloc(reportLimits.bridgeBytes);
  let size = 0;
  let commands = 0;
  let serial = Promise.resolve();
  process.stdin.on('data', (chunk) => {
    if (failed) return;
    try {
      for (let offset = 0; offset < chunk.length; ) {
        const newline = chunk.indexOf(10, offset);
        const end = newline < 0 ? chunk.length : newline;
        if (size + end - offset > input.length)
          throw new OperationError('resourceLimit', '报告输入超过容量。');
        chunk.copy(input, size, offset, end);
        size += end - offset;
        offset = end + 1;
        if (newline >= 0) {
          if (++commands > 32) throw new OperationError('resourceLimit', '报告输入积压超过容量。');
          const command = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(0, size)),
          );
          size = 0;
          serial = serial
            .then(() => program.receive(command))
            .catch((error) => program.fail(error))
            .finally(() => {
              commands--;
            });
        }
      }
    } catch (error) {
      program.fail(error);
    }
  });
  process.stdin.on('end', () => {
    program.close();
    process.exit(0);
  });
  process.stdin.on('error', (error) => program.fail(error));
  process.on('unhandledRejection', (error) => program.fail(error));
  process.on('uncaughtException', (error) => program.fail(error));
} catch (error) {
  fail(error);
}
