import assert from 'node:assert/strict';
import * as childProcess from 'node:child_process';
import * as filesystem from 'node:fs/promises';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { promisify } from 'node:util';
import {
  systemReportNames,
  systemReportUnitTexts,
} from '../../../packages/platform/dist/system-report-unit.js';

test('OS verification projects a full start descriptor into the real capture contract', async () => {
  // Only OS effects and UID observations are substitutes; no real root operation is performed.
  const input = {
    configId: '11111111-2222-4333-8444-555555555555',
    storageId: '66666666-7777-4888-9999-aaaaaaaaaaaa',
    programId: 'fixed',
    programVersion: '1',
    policyId: 'fixed',
    policyVersion: '1',
    assets: 1,
    inputs: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      manifest: '31:712:500:100:100',
      permit: { dev: '32', ino: '32001' },
      events: { dev: '32', ino: '32002' },
      stdout: { dev: '32', ino: '32003' },
      stderr: { dev: '32', ino: '32004' },
    },
  };
  const config = {
    configId: input.configId,
    controlUid: 60000,
    controlGid: 60000,
    kernelUid: 1000,
    kernelGid: 1000,
    privateRoot: '/var/lib/scholoom-synthetic/records',
    launcher: '/opt/scholoom-synthetic/launcher',
    programId: input.programId,
    programVersion: input.programVersion,
    policy: {
      id: input.policyId,
      version: input.policyVersion,
      profile: 'linux-x64-system-v1',
      cpuPercent: 20,
      memoryBytes: 67108864,
      swapBytes: 0,
      tasks: 16,
      outputBytes: 65536,
      runtimeMs: 20000,
      stopGraceMs: 100,
    },
  };
  const names = systemReportNames(input.configId, input.storageId);
  const slot = join(config.privateRoot, input.storageId);
  const parent = { bootId: input.inputs.bootId, dev: '31', ino: '31001' };
  const expected = {
    scope: {
      ...parent,
      invocationId: '0123456789abcdef0123456789abcdef',
      controllerPid: 4242,
      controllerBirth: '99001',
    },
    runtimeUid: 40001,
    runtimeGid: 40002,
    limits: {
      cpuQuota: '20000',
      cpuPeriod: '100000',
      memoryBytes: '67108864',
      swapBytes: '0',
      tasks: '16',
    },
  };
  const launch = `/run/systemd/system/.${names.unit}.launch`;
  const files = new Map([
    ...[...systemReportUnitTexts(input, slot, config)].map(([name, text]) => [
      `/run/systemd/system/${name}`,
      text,
    ]),
    [launch, `${input.inputs.bootId}\n${input.inputs.manifest}\n`],
    [`${launch}.parent`, JSON.stringify(parent)],
    ['/proc/sys/kernel/random/boot_id', input.inputs.bootId],
  ]);
  const native = [];
  const execFile = () => {
    throw new Error('Unexpected callback-style OS operation');
  };
  execFile[promisify.custom] = async (file, args) => {
    if (file.endsWith('/report-system')) {
      native.push(args);
      return { stdout: JSON.stringify(expected) };
    }
    assert.equal(file, '/usr/bin/systemctl');
    assert.equal(args[1], 'show');
    return {
      stdout: `Id=${args[2]}\nLoadState=loaded\nFragmentPath=/run/systemd/system/${args[2]}\nDropInPaths=\n`,
    };
  };
  const { default: _fsDefault, ...fsExports } = filesystem;
  const { default: _cpDefault, ...cpExports } = childProcess;
  mock.module('node:child_process', {
    namedExports: {
      ...cpExports,
      execFile,
      spawn: () => {
        throw new Error('Unexpected process launch');
      },
    },
  });
  mock.module('node:fs/promises', {
    namedExports: {
      ...fsExports,
      async readFile(path) {
        assert(files.has(path), `Unexpected read: ${path}`);
        return files.get(path);
      },
      async lstat(path, options) {
        if (options?.bigint) {
          assert(files.has(path));
          return { isFile: () => true, uid: 0n, nlink: 1n, mode: 0o600n, dev: 31n, ino: 7n };
        }
        return {
          isDirectory: () => true,
          isFile: () => true,
          uid: path.startsWith(config.privateRoot) ? config.controlUid : 0,
          mode: 0o700,
        };
      },
      async open(path) {
        assert.equal(path, `${launch}.parent`);
        return {
          async stat() {
            return { isFile: () => true, uid: 0, nlink: 1, mode: 0o600, size: 100 };
          },
          async readFile() {
            return files.get(path);
          },
          async close() {},
        };
      },
    },
  });
  const uid = process.getuid;
  const euid = process.geteuid;
  process.getuid = process.geteuid = () => 0;
  try {
    const { createSystemReportManagerHost } = await import(
      '../../../packages/platform/dist/system-report-os.js'
    );
    await createSystemReportManagerHost(config).verify(input, expected);
    assert.deepEqual(native, [['--capture', input.configId, input.storageId]]);
  } finally {
    process.getuid = uid;
    process.geteuid = euid;
    mock.restoreAll();
  }
});
