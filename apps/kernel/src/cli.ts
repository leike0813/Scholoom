#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { type BootstrapResult, protocolVersion } from '@scholoom/protocol';
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
      'Usage: scholoom-kernel [start | status | stop] [--data-dir PATH] [--json]\n       scholoom-kernel [--help | --info]',
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

main().catch(() => {
  console.error(
    JSON.stringify({
      code: 'invalidRequest',
      message: 'Kernel command failed. Use --help; startup diagnostics are in runtime/kernel.log.',
    }),
  );
  process.exitCode = 2;
});
