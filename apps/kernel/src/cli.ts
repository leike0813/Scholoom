#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createKernelClient } from '@scholoom/client';
import { type BootstrapResult, protocolVersion } from '@scholoom/protocol';
import { failure, OperationError } from './errors.js';
import {
  defaultDataDirectory,
  ensureKernel,
  inspectKernel,
  serveKernel,
  stopKernel,
} from './lifecycle.js';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      info: { type: 'boolean' },
      json: { type: 'boolean' },
      'data-dir': { type: 'string' },
      'connection-info': { type: 'boolean' },
      project: { type: 'string' },
      session: { type: 'string' },
      path: { type: 'string' },
      text: { type: 'string' },
      'instruction-id': { type: 'string' },
      read: { type: 'boolean' },
      write: { type: 'boolean' },
      send: { type: 'boolean' },
      'backup-id': { type: 'string' },
    },
  });
  if (values.info) {
    console.log(
      JSON.stringify({
        protocolVersion,
        nodeVersion: process.versions.node,
        processId: process.pid,
      }),
    );
    return;
  }
  if (values.help || positionals.length === 0) {
    console.log(
      'Usage: scholoom-kernel [start | status | stop] [--data-dir PATH] [--json]\n       project-open --path PATH\n       project-grant --project ID [--read] [--write] [--send]\n       session-create --project ID\n       send --project ID --session ID --text TEXT [--instruction-id ID]\n       session | cancel | continue --project ID --session ID\n       backup --project ID\n       restore --project ID --backup-id ID --path NEW_PATH\n       scholoom-kernel [--help | --info]',
    );
    return;
  }
  if (positionals.length !== 1) throw new Error('Invalid command');
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    console.log(
      JSON.stringify({
        state: 'unknown',
        error: { code: 'startupFailed', message: 'This kernel requires independent Node 24.' },
      }),
    );
    process.exitCode = 1;
    return;
  }
  const directory = values['data-dir'] ?? process.env.SCHOOLOOM_DATA_DIR ?? defaultDataDirectory;
  const command = positionals[0];
  if (
    [
      'project-open',
      'project-grant',
      'session-create',
      'send',
      'session',
      'cancel',
      'continue',
      'backup',
      'restore',
    ].includes(command ?? '')
  ) {
    const endpoint = await inspectKernel(directory);
    if (endpoint.state !== 'running') throw new OperationError('unavailable', '请先启动内核。');
    const client = createKernelClient(endpoint.endpoint);
    const projectId = values.project ?? 'application';
    const sessionId = values.session ?? '';
    try {
      await client.connect();
      let result: unknown;
      switch (command) {
        case 'project-open':
          result = await client.call('project.open', { path: values.path ?? '' });
          break;
        case 'project-grant':
          result = await client.call('project.grant', {
            projectId,
            read: values.read ?? false,
            write: values.write ?? false,
            send: values.send ?? false,
            autoBackup: true,
          });
          break;
        case 'session-create':
          result = await client.call('session.create', { projectId });
          break;
        case 'send':
          result = await client.call('session.send', {
            projectId,
            sessionId,
            instructionId: values['instruction-id'] ?? randomUUID(),
            text: values.text ?? '',
            materials: [],
          });
          break;
        case 'session':
          result = await client.call('workbench.snapshot', { projectId, sessionId });
          break;
        case 'cancel':
          result = await client.call('session.cancel', { projectId, sessionId });
          break;
        case 'continue':
          result = await client.call('session.resume', { projectId, sessionId });
          break;
        case 'backup':
          result = await client.call('project.backup', { projectId });
          break;
        case 'restore':
          result = await client.call('project.restore', {
            projectId,
            backupId: values['backup-id'] ?? '',
            destination: values.path ?? '',
          });
          break;
      }
      console.log(JSON.stringify(result));
    } finally {
      client.dispose();
    }
    return;
  }
  if (positionals[0] === 'serve') {
    try {
      await serveKernel(directory);
    } catch (error) {
      process.send?.({ state: 'failed' });
      console.error(
        JSON.stringify({
          code: 'startupFailed',
          message: error instanceof Error ? error.message.slice(0, 512) : 'Kernel startup failed.',
        }),
      );
      process.exitCode = 1;
    }
    return;
  }
  let result: BootstrapResult;
  switch (positionals[0]) {
    case 'start':
      result = await ensureKernel(directory);
      break;
    case 'status':
      result = await inspectKernel(directory);
      break;
    case 'stop':
      result = await stopKernel(directory);
      break;
    default:
      throw new Error('Unknown command');
  }
  if (!values['connection-info'] && result.state === 'running') {
    const { token: _token, url: _url, ...status } = result.endpoint;
    console.log(JSON.stringify({ state: result.state, status }));
  } else {
    console.log(JSON.stringify(result));
  }
  if (result.state === 'unknown' || result.state === 'unreachable') process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ...failure(error),
    }),
  );
  process.exitCode = 2;
});
