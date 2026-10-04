#!/usr/bin/env node
import { type KernelRuntimeInfo, protocolVersion } from '@scholoom/protocol';

const args = process.argv.slice(2);

if (args.length === 1 && args[0] === '--info') {
  const info: KernelRuntimeInfo = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
  };
  console.log(JSON.stringify(info));
} else if (args.length === 0 || (args.length === 1 && args[0] === '--help')) {
  console.log('Usage: scholoom-kernel [--help | --info]');
} else {
  console.error('Unsupported arguments. Use --help to list available commands.');
  process.exitCode = 2;
}
