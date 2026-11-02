import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, lstat, open, readFile, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { isDeepStrictEqual, promisify } from 'node:util';
import { compileContract, limits, OperationError } from '@scholoom/protocol/core';
import {
  type ReportManagerObservation,
  type ReportManagerStart,
  reportManagerOperations,
} from '@scholoom/protocol/isolation';
import type { IsolationPolicy } from './isolated-report-controller.js';
import { isolationLock, isolationNative } from './isolated-report-controller.js';
import { describeReportNodeRuntime } from './isolated-report-runtime.js';
import type { SystemReportBinding, SystemReportManagerHost } from './system-report-manager.js';
import {
  captureSystemReportParent,
  captureSystemReportScope,
  type SystemReportParent,
  settleSystemReportFixed,
  stopSystemReportScope,
  validSystemReportParent,
} from './system-report-stop.js';
import {
  systemReportNames,
  systemReportUnitTexts,
  systemUnitFields,
  systemUnitProperties,
  vacantSystemUnit,
} from './system-report-unit.js';

export type SystemReportInstallation = {
  configId: string;
  controlUid: number;
  controlGid: number;
  kernelUid: number;
  kernelGid: number;
  privateRoot: string;
  launcher: string;
  programId: string;
  programVersion: string;
  policy: IsolationPolicy;
  runtimeRoot?: string;
};
const execute = promisify(execFile);
const validStart = compileContract(reportManagerOperations['reportManager.start']).params;
const unknown = () => new OperationError('outcomeUnknown', '原系统对象或执行范围尚未确认。');
const unavailable = () => new OperationError('unavailable', '系统安装或固定登记不完整。');
const flags = constants.O_NOFOLLOW | constants.O_NONBLOCK;

/** OS mutation ownership, independent of K's execution admission and C's records writer. */
export async function lockSystemReportManager(
  directory: string,
): Promise<{ close(): Promise<void> }> {
  if (process.getuid?.() !== 0 || process.geteuid?.() !== 0 || directory !== resolve(directory))
    throw unavailable();
  for (let path = directory; path !== '/'; path = dirname(path)) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.uid !== 0 || info.mode & 0o022) throw unavailable();
  }
  return isolationLock(join(directory, 'manager.lock'));
}

/** Only the protected M installation constructs this adapter; requests contain no commands or paths. */
export function createSystemReportManagerHost(
  installation: SystemReportInstallation,
): SystemReportManagerHost {
  const config = structuredClone(installation),
    root = resolve(config.privateRoot);
  const policy = config.policy;
  async function command(args: string[]): Promise<string> {
    const { stdout } = await execute('/usr/bin/systemctl', ['--system', ...args], {
      env: { PATH: '/usr/bin:/bin', LANG: 'C', SYSTEMD_PAGER: 'cat', SYSTEMD_COLORS: '0' },
      timeout: 35_000,
      maxBuffer: 65536,
    });
    return stdout;
  }
  async function directory(path: string, owner: number, privateMode = false): Promise<void> {
    const info = await lstat(path);
    if (!info.isDirectory() || info.uid !== owner || info.mode & (privateMode ? 0o077 : 0o022))
      throw unavailable();
  }
  async function trustedPath(path: string, owner: number, executable = false): Promise<void> {
    let current = dirname(resolve(path));
    while (current !== '/') {
      const info = await lstat(current);
      if (!info.isDirectory() || ![0, owner].includes(info.uid) || info.mode & 0o022)
        throw unavailable();
      current = dirname(current);
    }
    const info = await lstat(path);
    if (
      info.uid !== owner ||
      info.mode & 0o022 ||
      (executable && (!info.isFile() || !(info.mode & 0o111)))
    )
      throw unavailable();
  }
  async function check(input: ReportManagerStart, requireCurrentBoot = true): Promise<string> {
    if (
      process.platform !== 'linux' ||
      process.arch !== 'x64' ||
      process.getuid?.() !== 0 ||
      process.geteuid?.() !== 0
    )
      throw unavailable();
    if (
      !validStart(input) ||
      input.configId !== config.configId ||
      input.programId !== config.programId ||
      input.programVersion !== config.programVersion ||
      input.policyId !== policy.id ||
      input.policyVersion !== policy.version ||
      !['linux-x64-system-v1', 'linux-x64-node-v1'].includes(policy.profile) ||
      !Number.isSafeInteger(config.controlUid) ||
      config.controlUid <= 0 ||
      config.controlUid === config.kernelUid ||
      !Number.isSafeInteger(config.kernelUid) ||
      config.kernelUid <= 0 ||
      !Number.isSafeInteger(config.controlGid) ||
      config.controlGid <= 0 ||
      !Number.isSafeInteger(config.kernelGid) ||
      config.kernelGid <= 0 ||
      config.controlGid === config.kernelGid ||
      [root, config.launcher].some((path) =>
        [...path].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
      ) ||
      ![
        policy.cpuPercent,
        policy.memoryBytes,
        policy.swapBytes,
        policy.tasks,
        policy.outputBytes,
        policy.runtimeMs,
        policy.stopGraceMs,
      ].every(Number.isSafeInteger) ||
      policy.cpuPercent < 1 ||
      policy.cpuPercent > 100 ||
      policy.memoryBytes < 1 ||
      policy.swapBytes < 0 ||
      policy.tasks < 1 ||
      policy.outputBytes < 1 ||
      policy.runtimeMs < 1 ||
      policy.stopGraceMs < 0 ||
      policy.stopGraceMs > limits.lifecycleMs
    )
      throw unavailable();
    const node = policy.profile === 'linux-x64-node-v1';
    if (node !== !!input.inputs.node || node !== !!config.runtimeRoot) throw unavailable();
    if (
      config.runtimeRoot &&
      input.inputs.node &&
      !isDeepStrictEqual(
        await describeReportNodeRuntime(config.runtimeRoot),
        input.inputs.node.files,
      )
    )
      throw unknown();
    if (
      requireCurrentBoot &&
      (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim() !== input.inputs.bootId
    )
      throw unknown();
    await trustedPath(root, config.controlUid);
    await directory(root, config.controlUid, true);
    await trustedPath(config.launcher, 0, true);
    const slot = join(root, input.storageId);
    await directory(slot, config.controlUid, true);
    await directory('/run/systemd/system', 0);
    return slot;
  }
  function marker(input: ReportManagerStart) {
    const { unit } = systemReportNames(input.configId, input.storageId);
    return {
      path: `/run/systemd/system/.${unit}.launch`,
      text: `${input.inputs.bootId}\n${input.inputs.manifest}\n`,
    };
  }
  function parentFile(input: ReportManagerStart) {
    return `${marker(input).path}.parent`;
  }
  function retiredFile(input: ReportManagerStart) {
    return `${marker(input).path}.retired`;
  }
  async function writeRoot(path: string, text: string): Promise<void> {
    const directory = await open(
      dirname(path),
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const temporary = `.report-publish-${randomUUID()}.tmp`;
    try {
      const file = await open(`/proc/self/fd/${directory.fd}/${temporary}`, 'wx', 0o600);
      try {
        await file.writeFile(text);
        await file.sync();
      } finally {
        await file.close();
      }
      await new Promise<void>((resolve, reject) => {
        const child = spawn(isolationNative, ['--publish', temporary, basename(path)], {
          env: { PATH: '/usr/bin:/bin', LANG: 'C' },
          stdio: ['ignore', 'ignore', 'ignore', directory.fd],
        });
        const timer = setTimeout(() => child.kill('SIGKILL'), limits.lifecycleMs);
        child.once('error', reject);
        child.once('close', (code, signal) => {
          clearTimeout(timer);
          if (code === 0 && signal === null) resolve();
          else reject(unknown());
        });
      });
    } finally {
      await directory.close();
    }
  }
  async function rootJson(path: string): Promise<unknown> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await file.stat();
      if (
        !info.isFile() ||
        info.uid !== 0 ||
        info.nlink !== 1 ||
        info.mode & 0o077 ||
        info.size > 4096
      )
        throw unknown();
      return JSON.parse(await file.readFile('utf8'));
    } finally {
      await file.close();
    }
  }
  async function parent(input: ReportManagerStart): Promise<SystemReportParent> {
    const value = await rootJson(parentFile(input));
    if (
      !validSystemReportParent(value) ||
      (value as SystemReportParent).bootId !== input.inputs.bootId
    )
      throw unknown();
    return value as SystemReportParent;
  }
  function checkParent(actual: SystemReportParent, expected: SystemReportParent) {
    if (
      actual.bootId !== expected.bootId ||
      actual.dev !== expected.dev ||
      actual.ino !== expected.ino
    )
      throw unknown();
  }
  async function syncUnits(): Promise<void> {
    const directory = await open('/run/systemd/system', constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  async function original(path: string, text: string) {
    const info = await lstat(path, { bigint: true });
    if (
      !info.isFile() ||
      info.uid !== 0n ||
      info.nlink !== 1n ||
      info.mode & 0o022n ||
      (await readFile(path, 'utf8')) !== text
    )
      throw unknown();
    return { path, text, dev: info.dev, ino: info.ino };
  }
  async function statObject(path: string, expected: { dev: string; ino: string }, fifo = false) {
    const info = await lstat(path, { bigint: true });
    if (
      (fifo ? !info.isFIFO() : !info.isFile()) ||
      info.uid !== BigInt(config.controlUid) ||
      info.nlink !== 1n ||
      (info.mode & 0o777n) !== 0o600n ||
      String(info.dev) !== expected.dev ||
      String(info.ino) !== expected.ino
    )
      throw unknown();
  }
  async function effective(name: string): Promise<void> {
    const fields = systemUnitFields(
      await command(['show', name, `--property=${systemUnitProperties}`]),
    );
    if (
      fields.Id !== name ||
      fields.LoadState !== 'loaded' ||
      fields.FragmentPath !== `/run/systemd/system/${name}` ||
      fields.DropInPaths !== ''
    )
      throw unavailable();
  }
  async function noJobs(input: ReportManagerStart): Promise<void> {
    const names = systemReportNames(input.configId, input.storageId);
    for (const name of [names.slice, names.unit]) {
      const fields = systemUnitFields(await command(['show', name, '--property=Id,Job']));
      if (fields.Id !== name || fields.Job !== '') throw unknown();
    }
  }
  async function installed(input: ReportManagerStart, slot: string) {
    const objects = [];
    for (const [name, text] of systemReportUnitTexts(input, slot, config)) {
      const object = await original(`/run/systemd/system/${name}`, text);
      await effective(name);
      objects.push(object);
    }
    const launch = marker(input);
    objects.push(await original(launch.path, launch.text));
    const savedParent = await parent(input);
    objects.push(await original(parentFile(input), JSON.stringify(savedParent)));
    return objects;
  }
  async function retired(input: ReportManagerStart): Promise<SystemReportParent | undefined> {
    let value: unknown;
    try {
      value = await rootJson(retiredFile(input));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    const receipt = value as { launch?: string; parent?: SystemReportParent };
    if (receipt.launch !== marker(input).text || !validSystemReportParent(receipt.parent))
      throw unknown();
    const saved = receipt.parent as SystemReportParent;
    if (saved.bootId !== input.inputs.bootId) throw unknown();
    const names = systemReportNames(input.configId, input.storageId);
    const fields = systemUnitFields(
      await command(['show', names.unit, `--property=${systemUnitProperties}`]),
    );
    if (
      fields.Id !== names.unit ||
      fields.Job !== '' ||
      fields.ControlGroup !== '' ||
      !['inactive', 'failed'].includes(fields.ActiveState ?? '') ||
      fields.DropInPaths !== ''
    )
      throw unknown();
    try {
      const info = await lstat(`/sys/fs/cgroup${names.cgroup}`, { bigint: true });
      checkParent(
        { bootId: input.inputs.bootId, dev: String(info.dev), ino: String(info.ino) },
        saved,
      );
      await settleSystemReportFixed(input, saved, true);
    } catch (error) {
      // Absence is accepted only after this durable, original-range empty receipt was written.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return saved;
  }
  async function cleanupObjects(
    input: ReportManagerStart,
    slot: string,
    saved: SystemReportParent,
  ) {
    const launch = marker(input),
      objects = [];
    for (const [path, text] of [
      ...[...systemReportUnitTexts(input, slot, config)].map(
        ([name, text]) => [`/run/systemd/system/${name}`, text] as const,
      ),
      [launch.path, launch.text] as const,
      [parentFile(input), JSON.stringify(saved)] as const,
    ]) {
      try {
        objects.push(await original(path, text));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return objects;
  }
  /** No OS start is issued before this root-owned marker is durable. */
  async function unstarted(input: ReportManagerStart, slot: string) {
    try {
      await lstat(marker(input).path);
      return undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const objects = [],
      names = systemReportNames(input.configId, input.storageId);
    for (const [name, text] of systemReportUnitTexts(input, slot, config)) {
      const path = `/run/systemd/system/${name}`;
      try {
        objects.push(await original(path, text));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const fields = systemUnitFields(
        await command(['show', name, `--property=${systemUnitProperties}`]),
      );
      // Templates may have been reloaded, but a launch without the durable marker is never ours.
      if (fields.FragmentPath === path) fields.FragmentPath = '';
      if (fields.LoadState === 'loaded') fields.LoadState = 'not-found';
      if (!vacantSystemUnit(fields, name, names.slice)) throw unknown();
    }
    try {
      await lstat(`/sys/fs/cgroup${names.cgroup}`);
      throw unknown();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return objects;
  }
  function observation(
    input: ReportManagerStart,
    actual: ReportManagerObservation,
    original?: ReportManagerObservation,
  ): void {
    if (
      actual.scope.bootId !== input.inputs.bootId ||
      actual.runtimeUid === 0 ||
      [config.controlUid, config.kernelUid].includes(actual.runtimeUid) ||
      [config.controlGid, config.kernelGid].includes(actual.runtimeGid) ||
      actual.limits.cpuQuota !== String(policy.cpuPercent * 1000) ||
      actual.limits.cpuPeriod !== '100000' ||
      actual.limits.memoryBytes !== String(policy.memoryBytes) ||
      actual.limits.swapBytes !== String(policy.swapBytes) ||
      actual.limits.tasks !== String(policy.tasks) ||
      (original &&
        (actual.scope.bootId !== original.scope.bootId ||
          actual.scope.invocationId !== original.scope.invocationId ||
          actual.scope.dev !== original.scope.dev ||
          actual.scope.ino !== original.scope.ino ||
          actual.scope.controllerPid !== original.scope.controllerPid ||
          actual.scope.controllerBirth !== original.scope.controllerBirth ||
          actual.runtimeUid !== original.runtimeUid ||
          actual.runtimeGid !== original.runtimeGid))
    )
      throw unknown();
  }
  return {
    async start(input, signal) {
      const slot = await check(input),
        names = systemReportNames(input.configId, input.storageId);
      if (signal.aborted) throw unknown();
      for (const path of [marker(input).path, parentFile(input), retiredFile(input)]) {
        try {
          await lstat(path);
          throw unknown();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      for (const name of [names.slice, names.unit]) {
        for (const prefix of [
          '/run/systemd/system',
          '/etc/systemd/system',
          '/usr/lib/systemd/system',
        ]) {
          for (const path of [join(prefix, name), join(prefix, `${name}.d`)]) {
            try {
              await lstat(path);
              throw unknown();
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
          }
        }
        if (
          !vacantSystemUnit(
            systemUnitFields(await command(['show', name, `--property=${systemUnitProperties}`])),
            name,
            names.slice,
          )
        )
          throw unknown();
      }
      for (const name of ['permit', 'events', 'stdout', 'stderr'] as const)
        await statObject(join(slot, name), input.inputs[name], name === 'permit');
      if (input.inputs.node) {
        await statObject(join(slot, 'data-in'), input.inputs.node.input, true);
        await statObject(join(slot, 'data-out'), input.inputs.node.output, true);
      }
      const manifest = await lstat(join(slot, 'manifest.json'), { bigint: true });
      if (
        [manifest.dev, manifest.ino, manifest.size, manifest.mtimeNs, manifest.ctimeNs].join(
          ':',
        ) !== input.inputs.manifest ||
        !manifest.isFile() ||
        manifest.uid !== BigInt(config.controlUid) ||
        (manifest.mode & 0o777n) !== 0o400n ||
        manifest.nlink !== 1n
      )
        throw unknown();
      for (const [name, text] of systemReportUnitTexts(input, slot, config)) {
        await writeRoot(`/run/systemd/system/${name}`, text);
      }
      await command(['daemon-reload']);
      for (const name of [names.slice, names.unit]) await effective(name);
      if (signal.aborted) throw unknown();
      const launch = marker(input);
      await writeRoot(launch.path, launch.text);
      let writer: FileHandle | undefined;
      const close = async () => {
        const held = writer;
        writer = undefined;
        await held?.close();
      };
      signal.addEventListener(
        'abort',
        () => {
          void close().catch(() => {});
        },
        { once: true },
      );
      // Retain the parent even if service creation or its acknowledgement fails.
      await command(['start', names.slice]);
      const savedParent = await captureSystemReportParent(input);
      await writeRoot(parentFile(input), JSON.stringify(savedParent));
      await installed(input, slot);
      if (signal.aborted) throw unknown();
      const starting = command(['start', names.unit]);
      let startError: unknown;
      void starting.catch((error: unknown) => {
        startError = error;
      });
      try {
        const deadline = Date.now() + limits.lifecycleMs;
        while (!writer && Date.now() < deadline && !signal.aborted) {
          if (startError) throw startError;
          try {
            writer = await open(join(slot, 'permit'), constants.O_WRONLY | flags);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENXIO') throw error;
            await pause(20);
          }
        }
        if (!writer || signal.aborted) throw unknown();
        const info = await writer.stat({ bigint: true });
        if (
          !info.isFIFO() ||
          info.uid !== BigInt(config.controlUid) ||
          String(info.dev) !== input.inputs.permit.dev ||
          String(info.ino) !== input.inputs.permit.ino
        )
          throw unknown();
        await starting;
        if (signal.aborted) throw unknown();
        const actual = await captureSystemReportScope({
          configId: input.configId,
          storageId: input.storageId,
        });
        checkParent(actual.scope, savedParent);
        observation(input, actual);
        const binding: SystemReportBinding = {
          observation: actual,
          async send(command) {
            if (signal.aborted || !writer) throw unknown();
            await statObject(join(slot, 'permit'), input.inputs.permit, true);
            if (signal.aborted || !writer || (await writer.write(command)).bytesWritten !== 1)
              throw unknown();
            if (command === 'G') await close();
          },
          close,
        };
        return binding;
      } catch (error) {
        await close();
        await starting.catch(() => {});
        throw error;
      }
    },
    async verify(input, expected) {
      const slot = await check(input);
      await installed(input, slot);
      const actual = await captureSystemReportScope({
        configId: input.configId,
        storageId: input.storageId,
      });
      checkParent(actual.scope, await parent(input));
      observation(input, actual, expected);
    },
    stop: stopSystemReportScope,
    async recover(raw) {
      const { scope, ...input } = raw;
      const slot = await check(input, false);
      const done = await retired(input);
      if (done) {
        if (scope) checkParent(scope, done);
        return;
      }
      if (await unstarted(input, slot)) {
        const boot = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
        if (scope && boot === scope.bootId) throw unknown();
        return;
      }
      await installed(input, slot);
      await noJobs(input);
      const saved = await parent(input);
      if (scope) {
        checkParent(scope, saved);
        await stopSystemReportScope({
          configId: input.configId,
          storageId: input.storageId,
          scope,
        });
      } else await settleSystemReportFixed(input, saved);
      await noJobs(input);
    },
    async release(raw) {
      const { scope, ...input } = raw;
      const slot = await check(input, false),
        names = systemReportNames(input.configId, input.storageId);
      let done = await retired(input);
      const pending = done ? undefined : await unstarted(input, slot);
      if (!pending && !done) {
        await installed(input, slot);
        await noJobs(input);
        done = await parent(input);
        if (scope) {
          checkParent(scope, done);
          await stopSystemReportScope({
            configId: input.configId,
            storageId: input.storageId,
            scope,
          });
        } else await settleSystemReportFixed(input, done, true);
        await noJobs(input);
        await writeRoot(
          retiredFile(input),
          JSON.stringify({ launch: marker(input).text, parent: done }),
        );
      }
      if (done) {
        if (scope) checkParent(scope, done);
        // A collected slice needs no stop job. The durable receipt precedes any removal.
        const state = systemUnitFields(
          await command(['show', names.slice, `--property=${systemUnitProperties}`]),
        );
        if (state.Job) throw unknown();
        if (state.ActiveState === 'active') await command(['stop', names.slice]);
      }
      const originals = pending ?? (await cleanupObjects(input, slot, done as SystemReportParent));
      for (const original of originals) {
        const info = await lstat(original.path, { bigint: true });
        if (
          info.dev !== original.dev ||
          info.ino !== original.ino ||
          (await readFile(original.path, 'utf8')) !== original.text
        )
          throw unknown();
      }
      await command(['reset-failed', names.unit]).catch(() => {});
      for (const original of originals) await unlink(original.path);
      await syncUnits();
      await command(['daemon-reload']);
      // Keep the original empty receipt for same-boot reconnection; /run clears it on reboot.
    },
  };
}
