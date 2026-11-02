import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { ReportControlClient } from '../../../apps/kernel/dist/report-control.js';
import { ProcessAdmission } from '../../../packages/platform/dist/admission.js';
import { openReportChannel } from '../../../packages/platform/dist/report-channel.js';
import { systemUnitFields } from '../../../packages/platform/dist/system-report-unit.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';

assert.equal(process.argv.length, 3);
assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid() > 0);
const file = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(file, 'utf8'));
assert.equal(process.getuid(), config.kernelUid);
assert.equal(config.programId, 'fixed-native-t1');
assert.deepEqual(config.programArgs, ['normal']);
assert.equal(config.policy.runtimeMs, 20000);
assert.equal(JSON.parse(readFileSync(join(dirname(file), 't1-passed.json'))).accepted, true);
const installation = basename(dirname(file));
const base = join(homedir(), '.cache', 'scholoom-report-system-service');
mkdirSync(base, { recursive: true, mode: 0o700 });
const evidence = mkdtempSync(join(base, 'recovery-'));

function systemctl(args) {
  return execFileSync('/usr/bin/systemctl', ['--system', ...args], {
    env: { PATH: '/usr/bin:/bin', LANG: 'C', SYSTEMD_COLORS: '0', SYSTEMD_PAGER: 'cat' },
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 65536,
  }).trim();
}
function units(patterns) {
  const text = systemctl([
    'list-units',
    '--plain',
    '--no-legend',
    '--no-pager',
    '--state=active,activating,deactivating',
    ...patterns,
  ]);
  return text ? text.split('\n').map((line) => line.trim().split(/\s+/)[0]) : [];
}
async function until(check, message) {
  const deadline = Date.now() + 12000;
  do {
    const value = await check();
    if (value) return value;
    await pause(40);
  } while (Date.now() < deadline);
  throw new Error(message);
}
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

for (const mode of ['cancel', 'revoke', 'disconnect', 'lost-start-ack']) {
  const roles = [`${installation}-control@*.service`, `${installation}-manager@*.service`];
  assert.deepEqual(units(roles), [], 'A previous role is active; do not start another attempt.');
  const instanceId = randomUUID();
  const admission = new ProcessAdmission(1, 1);
  const held = deferred(),
    release = deferred(),
    lost = deferred();
  const result = {
    mode,
    instanceId,
    configId: config.configId,
    accepted: false,
    statuses: [],
    scopes: [],
    authorization: 0,
    startRequests: 0,
  };
  let inspectScope = false,
    revoked = false,
    startId;
  let client;
  client = new ReportControlClient({
    configId: config.configId,
    admission,
    async authorize(id) {
      assert.equal(id, instanceId);
      result.authorization++;
      if (inspectScope) {
        const active = units([`scholoom-report-${config.configId}-v1@*.service`]);
        assert(active.length <= 1);
        if (active.length) {
          const scope = systemUnitFields(
            systemctl([
              'show',
              active[0],
              '--property=Id,MainPID,InvocationID,ControlGroup,ActiveState',
            ]),
          );
          assert(Number(scope.MainPID) > 1 && /^[a-f0-9]{32}$/.test(scope.InvocationID));
          result.scopes.push(scope);
          held.resolve();
          await release.promise;
        }
      }
      if (revoked) throw new OperationError('permissionDenied', 'Synthetic authorization revoked');
    },
  });
  let binding;
  const channel = await openReportChannel({
    path: join(dirname(config.managerSocket), 'control.sock'),
    ownerUid: 0,
    serverUid: 0,
    onFrame(frame) {
      const value = JSON.parse(frame);
      if (
        mode === 'lost-start-ack' &&
        startId !== undefined &&
        value.id === startId &&
        value.result
      ) {
        result.lostResponse = value.result;
        lost.resolve();
        return;
      }
      binding?.receive(frame);
    },
    onClose: () => binding?.disconnect(),
  });
  binding = client.connect({
    ...channel,
    send(frame) {
      const value = JSON.parse(frame);
      if (value.method === 'platform.reportIsolation.start') {
        startId = value.id;
        result.startRequests++;
      }
      return channel.send(frame);
    },
  });
  try {
    await client.initialize();
    result.statuses.push(
      await client.prepare(
        { instanceId, programId: config.programId, policyId: config.policy.id },
        async () => ({
          entryPath: 'reports/entry.txt',
          files: [{ path: 'reports/entry.txt', bytes: Buffer.from('approved report bytes\n') }],
        }),
      ),
    );
    inspectScope = true;
    const start = client.port()['platform.reportIsolation.start']({ instanceId });
    const startResult = start.then(
      (status) => ({ status }),
      (error) => ({ code: error.code }),
    );
    if (mode === 'lost-start-ack') {
      await Promise.race([
        lost.promise,
        pause(12000).then(() => {
          throw Error('No start ACK');
        }),
      ]);
      result.roles = units(roles);
      assert.equal(result.roles.length, 2);
    } else {
      const started = await startResult;
      assert(started.status);
      result.statuses.push(started.status);
    }
    await Promise.race([
      held.promise,
      pause(12000).then(() => {
        throw Error('No live pre-G scope');
      }),
    ]);
    assert.equal(admission.status.active, 1);
    result.before = admission.status;
    if (mode === 'cancel') {
      result.statuses.push(await client.port()['platform.reportIsolation.stop']({ instanceId }));
      release.resolve();
    } else if (mode === 'revoke') {
      revoked = true;
      release.resolve();
    } else {
      result.roles ??= units(roles);
      assert.equal(result.roles.length, 2);
      client.disconnect();
      assert.equal(admission.status.active, 1);
      result.disconnected = admission.status;
      release.resolve();
      await channel.close();
      await until(() => units(result.roles).length === 0, 'Original C/M have not exited');
      await client.connectService({
        path: join(dirname(config.managerSocket), 'control.sock'),
        ownerUid: 0,
        serverUid: 0,
      });
    }
    result.startResult = await startResult;
    if (mode === 'lost-start-ack') assert.equal(result.startResult.code, 'outcomeUnknown');
    const stopped = await until(async () => {
      const status = await client.port()['platform.reportIsolation.get']({ instanceId });
      result.statuses.push(status);
      return status.stopConfirmed ? status : undefined;
    }, 'Original persistent stop was not confirmed');
    assert.equal(stopped.phase, 'stopped');
    assert.equal(stopped.gateReleased, false);
    if (mode === 'revoke') assert.equal(stopped.failure?.code, 'permissionDenied');
    assert.equal(result.startRequests, 1);
    assert.equal(admission.status.active, 0);
    result.after = admission.status;
    await client.close();
    await channel.close();
    await until(() => units(roles).length === 0, 'C/M have not exited after close');
    result.accepted = true;
  } catch (error) {
    result.failure = { code: error.code, message: error.message };
    throw error;
  } finally {
    release.resolve();
    if (!result.accepted) client.disconnect();
    result.finalAdmission = admission.status;
    writeFileSync(join(evidence, `${mode}.json`), JSON.stringify(result, null, 2));
    console.log(`${mode}: ${result.accepted ? 'passed' : 'unconfirmed'}; evidence: ${evidence}`);
  }
}
console.log(
  'Passed installed pre-G cancellation/revocation and K connection-loss recovery; not full T1 or JS/UI.',
);
