import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const isolation = process.argv[3] === '--isolation';
assert.equal(
  process.argv.length,
  isolation ? 4 : 3,
  'Supply one protected installed.json [--isolation]',
);
assert(process.platform === 'linux' && process.arch === 'x64', 'Requires Linux x64');
assert(
  process.getuid() > 0 && process.geteuid() > 0,
  'Run as the installation K account, never root',
);
const file = resolve(process.argv[2]);
assert.equal(basename(file), 'installed.json');
const { protectedReportFile } = await import('../../../apps/kernel/dist/report-installation.js');
const read = async (path) =>
  JSON.parse(
    (await bounded(protectedReportFile(path), 'protected installation file')).toString('utf8'),
  );
const config = await read(file);
assert.equal(process.getuid(), config.kernelUid, 'Wrong installation K UID');
assert.equal(process.getgid(), config.kernelGid, 'Wrong installation K GID');
assert.equal(config.programId, 'scholoom-interactive-report');
assert.equal(config.programVersion, '1');
assert.deepEqual(config.programArgs, []);
assert.equal(config.policy?.profile, 'linux-x64-node-v1');
assert.equal(config.runtimeRoot, dirname(file));
assert.match(config.configId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const installation = basename(dirname(file));
assert.match(installation, /^scholoom-report-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
assert.equal(config.managerSocket, `/run/${installation}/manager.sock`);
const installed = await read(join(dirname(file), 'installation-receipt.json'));
assert.equal(installed.configId, config.configId);
assert.equal(installed.programs, dirname(file));
for (const key of ['kernelUid', 'controlUid', 'controlGid'])
  assert.equal(installed[key], config[key]);
const bootstrap = await read(join(dirname(file), 'bootstrap-passed.json'));
assert.equal(bootstrap.accepted, true);
assert.equal(bootstrap.configId, config.configId);
assert.equal(bootstrap.profile, config.policy.profile);

const { ReportControlClient } = await import('../../../apps/kernel/dist/report-control.js');
const { encodeReportHeader } = await import('../../../packages/editor/dist/report-codec.js');
const { ProcessAdmission } = await import('../../../packages/platform/dist/admission.js');
const { openReportChannel } = await import('../../../packages/platform/dist/report-channel.js');
const { systemUnitFields } = await import('../../../packages/platform/dist/system-report-unit.js');
const { OperationError } = await import('../../../packages/protocol/dist/core.js');
const { isReportProgramPacket } = await import(
  '../../../packages/protocol/dist/report-contracts.js'
);
const { isolationControlOperations } = await import(
  '../../../packages/protocol/dist/platform-isolation.js'
);
const base = join(homedir(), '.cache', 'scholoom-report-system-service');
mkdirSync(base, { recursive: true, mode: 0o700 });
const evidence = mkdtempSync(join(base, 'generic-recovery-'));
console.log(`Evidence: ${evidence}`);
const roles = [`${installation}-control@*.service`, `${installation}-manager@*.service`];
const admission = new ProcessAdmission(1, 1);
const html =
  encodeReportHeader({ version: 1, resources: [], sources: [], objects: [] }) +
  '<html><body><p>Static recovery fixture</p></body></html>';

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
function systemctl(args) {
  return execFileSync('/usr/bin/systemctl', ['--system', ...args], {
    env: { PATH: '/usr/bin:/bin', LANG: 'C', SYSTEMD_COLORS: '0', SYSTEMD_PAGER: 'cat' },
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 65536,
  }).trim();
}
async function bounded(work, label, ms = 30_000) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function until(check, label) {
  const deadline = Date.now() + 30_000;
  do {
    const value = await bounded(Promise.resolve().then(check), label, deadline - Date.now());
    if (value) return value;
    await pause(40);
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}
function stopped(status, instanceId) {
  assert.equal(status.instanceId, instanceId);
  assert.equal(status.phase, 'stopped');
  assert.equal(status.stopConfirmed, true);
  assert.equal(status.gateReleased, true);
}

const modes = isolation
  ? ['network-rejection', 'busy-stop']
  : ['stop', 'revoke', 'disconnect', 'lost-stop-confirmation'];
for (const mode of modes) {
  const instanceId = randomUUID(),
    target = { instanceId };
  const result = {
    mode,
    instanceId,
    configId: config.configId,
    installationFile: file,
    accepted: false,
    boundary: isolation
      ? 'Real installed P capability rejection/busy-stop; synthetic source-free HTML and K authorization; no native seccomp matrix, UI or I5'
      : 'Real installed K/C/M/bootstrap; synthetic source-free HTML and K authorization; no UI or I5',
    lossInjection: mode === 'lost-stop-confirmation' ? ['stop-result', 'reportHost.release'] : [],
    statuses: [],
    requests: [],
    connections: [],
    packets: [],
    commands: [],
    authorization: [],
    droppedStopResults: [],
    droppedReleases: [],
    closeFailures: [],
  };
  const channels = [];
  let networkServer;
  let revoked = false,
    dropConfirmation = false,
    stopId,
    finished = false;
  const client = new ReportControlClient({
    configId: config.configId,
    admission,
    async authorize(id) {
      assert.equal(id, instanceId);
      result.authorization.push({ at: Date.now(), revoked });
      if (revoked) throw new OperationError('permissionDenied', 'Synthetic authorization revoked');
    },
  });
  const port = client.port();
  const count = (method) => result.requests.filter((item) => item.method === method).length;
  async function connect() {
    const connection = { pages: [], responses: [], peer: undefined };
    result.connections.push(connection);
    let binding;
    const channel = await bounded(
      openReportChannel({
        path: join(dirname(config.managerSocket), 'control.sock'),
        ownerUid: 0,
        serverUid: 0,
        onFrame(frame) {
          const value = JSON.parse(frame);
          if (
            dropConfirmation &&
            value.method === 'reportHost.release' &&
            value.params.instanceId === instanceId
          ) {
            // This case loses both confirmations; a delivered release may legitimately settle K.
            result.droppedReleases.push(value);
            return;
          }
          if (dropConfirmation && stopId !== undefined && value.id === stopId && value.result) {
            result.droppedStopResults.push(value);
            return;
          }
          if (value.method === 'reportHost.inventory') connection.pages.push(value.params);
          if (value.result && 'total' in value.result) connection.responses.push(value.result);
          binding?.receive(frame);
        },
        onClose(error) {
          connection.closed = { code: error?.code, message: error?.message };
          binding?.disconnect();
        },
      }).then(async (channel) => {
        channels.push(channel);
        if (finished) {
          await bounded(channel.close(), 'late channel close');
          throw new Error('Connection completed after case ended');
        }
        return channel;
      }),
      'authenticated connection',
    );
    connection.peer = channel.peer;
    binding = client.connect({
      ...channel,
      send(frame) {
        const value = JSON.parse(frame);
        if (value.method) {
          result.requests.push({ connection: result.connections.length, ...value });
          if (value.method === 'platform.reportIsolation.stop') stopId = value.id;
        }
        return channel.send(frame);
      },
    });
    connection.beforeInventory = admission.status;
    await bounded(
      client.initialize(),
      'complete inventory',
      isolationControlOperations['reportControl.open'].semantics.waitMs,
    );
    connection.afterInventory = admission.status;
    assert.equal(connection.responses.length, 1);
    const response = connection.responses[0];
    const inventory = connection.pages.flatMap((page) => {
      assert.equal(page.requestId, response.requestId);
      return page.statuses;
    });
    assert.equal(response.configId, config.configId);
    assert.equal(response.total, inventory.length);
    assert.equal(new Set(inventory.map((item) => item.instanceId)).size, inventory.length);
    if (result.connections.length === 2) {
      const original = inventory.filter((item) => item.instanceId === instanceId);
      assert.equal(original.length, 1, 'Complete inventory must retain the original instance');
      stopped(original[0], instanceId);
      result.recovered = original[0];
    }
    assert.equal(admission.status.active, 0, 'Inventory contains unresolved capacity');
    return channel;
  }
  async function status() {
    const value = await bounded(port['platform.reportIsolation.get'](target), 'original status');
    assert.equal(value.instanceId, instanceId);
    result.statuses.push(value);
    return value;
  }
  function captureScope() {
    const active = units([`scholoom-report-${config.configId}-v1@*.service`]);
    assert.equal(active.length, 1);
    const scope = systemUnitFields(
      systemctl(['show', active[0], '--property=Id,MainPID,InvocationID,ControlGroup,ActiveState']),
    );
    assert(Number(scope.MainPID) > 1 && /^[a-f0-9]{32}$/.test(scope.InvocationID));
    assert.equal(scope.ActiveState, 'active');
    assert(scope.ControlGroup);
    return scope;
  }
  function busySample() {
    assert.deepEqual(
      captureScope(),
      result.scope,
      'Busy evidence must identify the original scope',
    );
    assert(result.scope.ControlGroup.startsWith('/system.slice/'));
    const group = join('/sys/fs/cgroup', result.scope.ControlGroup);
    const info = statSync(group, { bigint: true });
    const pid = result.scope.MainPID;
    assert.equal(readFileSync(`/proc/${pid}/cgroup`, 'utf8'), `0::${result.scope.ControlGroup}\n`);
    const proc = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const birth = proc.slice(proc.lastIndexOf(')') + 2).split(' ')[19];
    const cpu = readFileSync(join(group, 'cpu.stat'), 'utf8');
    const usage = /^usage_usec (\d+)$/m.exec(cpu);
    assert(usage, 'Original cgroup CPU accounting is required');
    return {
      at: Date.now(),
      dev: String(info.dev),
      ino: String(info.ino),
      birth,
      usageUsec: Number(usage[1]),
      cpu,
    };
  }
  try {
    assert.deepEqual(units(roles), [], 'Previous C/M active; preserve and stop this run');
    assert.deepEqual(units([`scholoom-report-${config.configId}-v1@*.service`]), []);
    const channel = await connect();
    let entry = html;
    if (mode === 'network-rejection') {
      result.network = { host: '127.0.0.1', connections: 0 };
      networkServer = createServer();
      // Count and close at TCP accept, without inspecting headers, bodies or secrets.
      networkServer.on('connection', (socket) => {
        result.network.connections++;
        socket.destroy();
      });
      await bounded(
        new Promise((resolve, reject) => {
          networkServer.once('error', reject);
          networkServer.listen(0, '127.0.0.1', resolve);
        }),
        'owned network trap listen',
      );
      result.network.port = networkServer.address().port;
      const url = `http://127.0.0.1:${result.network.port}/probe`;
      const script = `<script type="module">
const results = [];
async function attempt(api, run) {
  try { await run(); results.push({api, outcome: 'allowed'}); }
  catch (error) { results.push({api, outcome: 'rejected', name: error.name, code: error.code ?? null}); }
}
await attempt('fetch', () => fetch(${JSON.stringify(url)}));
await attempt('XHR', () => new Promise((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.onload = resolve;
  request.onerror = () => reject(new Error('XHR rejected'));
  request.open('GET', ${JSON.stringify(url)});
  request.send();
}));
await attempt('WebSocket', () => new Promise((resolve, reject) => {
  const socket = new WebSocket(${JSON.stringify(url.replace('http:', 'ws:'))});
  socket.onopen = () => { socket.close(); resolve(); };
  socket.onerror = () => { socket.close(); reject(new Error('WebSocket rejected')); };
}));
scholoomReport.postMessage({type: 'state', browse: {network: results}, draft: {}, dirty: false});
</script>`;
      entry = html.replace('</body>', `${script}</body>`);
    } else if (mode === 'busy-stop') {
      const script = `<script>
scholoomReport.postMessage({type: 'state', browse: {busy: 'entered'}, draft: {}, dirty: false});
while (true) {}
</script>`;
      entry = html.replace('</body>', `${script}</body>`);
    }
    result.statuses.push(
      await bounded(
        client.prepare(
          {
            instanceId,
            programId: config.programId,
            policyId: config.policy.id,
          },
          async () => {
            assert.equal(admission.status.active, 1);
            return {
              entryPath: 'reports/entry.html',
              files: [{ path: 'reports/entry.html', bytes: Buffer.from(entry) }],
            };
          },
        ),
        'prepare',
      ),
    );
    result.statuses.push(await bounded(port['platform.reportIsolation.start'](target), 'start'));
    await until(async () => {
      const value = await status();
      assert(!value.stopConfirmed && value.phase !== 'unknown', JSON.stringify(value));
      return value.phase === 'running' && value.gateReleased;
    }, 'running and gateReleased');
    if (mode === 'busy-stop') result.scope = captureScope();

    const view = {
      version: 1,
      viewId: randomUUID(),
      generation: 1,
      basis: 'synthetic-recovery-v1',
    };
    const queue = [
      { ...view, type: 'start', viewport: [800, 600], cssProperties: [], eventProperties: [] },
    ];
    let ready = false;
    let busyBaseline;
    const observation =
      mode === 'busy-stop'
        ? 'original busy scope without ready'
        : 'program ready with every frame consumed';
    await until(async () => {
      const command = queue.shift();
      if (command) result.commands.push(command);
      const response = await client.exchange({
        ...target,
        ...(command ? { frame: JSON.stringify(command) } : {}),
      });
      for (const frame of response.frames) {
        const packet = JSON.parse(frame);
        assert(isReportProgramPacket(packet));
        assert(result.packets.length < 256);
        result.packets.push(packet);
        if ('sequence' in packet) queue.push({ type: 'consume', sequences: [packet.sequence] });
        else {
          for (const [key, value] of Object.entries(view)) assert.equal(packet[key], value);
          assert.notEqual(packet.type, 'error', JSON.stringify(packet));
          if (packet.type === 'ready') ready = true;
        }
      }
      if (mode === 'busy-stop') {
        assert.equal(ready, false, 'Busy classic script must prevent ready');
        if (queue.length || !result.packets.some((packet) => 'sequence' in packet)) return false;
        // The bridge write is queued behind a microtask which this loop may never yield to.
        result.entered = result.packets.some(
          (packet) => packet.type === 'state' && packet.browse.busy === 'entered',
        );
        const sample = busySample();
        result.busySamples ??= [];
        if (!busyBaseline) {
          busyBaseline = sample;
          result.busySamples.push(sample);
        }
        for (const key of ['dev', 'ino', 'birth']) assert.equal(sample[key], busyBaseline[key]);
        if (sample.usageUsec - busyBaseline.usageUsec < 100_000) return false;
        result.busySamples.push(sample);
        busyBaseline = sample;
        return result.busySamples.length === 3;
      }
      return ready && queue.length === 0;
    }, observation);
    assert(result.packets.some((packet) => 'sequence' in packet));
    assert.equal(
      result.commands.filter((command) => command.type === 'consume').length,
      result.packets.filter((packet) => 'sequence' in packet).length,
    );
    const running = await status();
    assert.equal(running.phase, 'running');
    assert.equal(running.gateReleased, true);
    assert.equal(running.stopConfirmed, false);
    assert.equal(admission.status.active, 1);
    result.before = admission.status;
    if (result.scope) assert.deepEqual(captureScope(), result.scope);
    else result.scope = captureScope();
    result.roles = units(roles);
    assert.equal(result.roles.length, 2);
    if (mode === 'network-rejection') {
      const states = result.packets.filter((packet) => packet.type === 'state');
      assert.equal(states.length, 1, 'Real P must report all three network outcomes');
      result.network.outcomes = states[0].browse.network;
      assert.deepEqual(
        result.network.outcomes.map((item) => item.api),
        ['fetch', 'XHR', 'WebSocket'],
      );
      for (const item of result.network.outcomes) {
        assert.equal(item.outcome, 'rejected');
        assert.equal(typeof item.name, 'string');
        assert(item.name.length > 0);
      }
      assert.equal(result.network.connections, 0, 'No traffic may reach the host trap');
      assert.equal(ready, true, 'Caught capability rejections must leave the real P ready');
    }
    if (mode === 'busy-stop') result.busyStatus = running;

    if (mode === 'revoke') {
      revoked = true;
      const exchanges = count('reportControl.exchange');
      await assert.rejects(bounded(client.exchange(target), 'revoked exchange'), (error) => {
        result.exchangeRejection = { code: error.code, message: error.message };
        return error.code === 'permissionDenied';
      });
      assert.equal(count('reportControl.exchange'), exchanges, 'K must reject locally');
      assert.equal(admission.status.active, 1);
      // Match runtime's explicit cleanup after local authorization rejection; exchange does not stop P.
      result.cleanupRequestedBy = 'fixture simulating runtime after exchange rejection';
    }
    if (isolation || mode === 'stop' || mode === 'revoke') {
      const receipt = await bounded(
        port['platform.reportIsolation.stop'](target),
        'explicit original stop',
      );
      result.statuses.push(receipt);
      stopped(receipt, instanceId);
    } else {
      let pendingStop;
      if (mode === 'lost-stop-confirmation') {
        dropConfirmation = true;
        pendingStop = port['platform.reportIsolation.stop'](target).then(
          (value) => ({ value }),
          (error) => ({ code: error.code, message: error.message }),
        );
        await until(
          () => result.droppedStopResults.length && result.droppedReleases.length,
          'real stop result and release notification to discard',
        );
        assert.equal(result.droppedStopResults.length, 1);
        stopped(result.droppedStopResults[0].result, instanceId);
        assert.equal(admission.status.active, 1, 'Neither stop confirmation reached K');
      }
      client.disconnect();
      assert.equal(admission.status.active, 1, 'Disconnect cannot release capacity');
      result.disconnected = admission.status;
      await bounded(channel.close(), 'original channel close');
      if (pendingStop) {
        result.stopOutcome = await bounded(pendingStop, 'lost stop confirmation outcome');
        assert.equal(result.stopOutcome.code, 'outcomeUnknown');
      }
      await until(() => units(roles).length === 0, 'original C/M exit');
      assert.equal(admission.status.active, 1, 'C/M exit is not a stop receipt');
      result.beforeReconnect = admission.status;
      dropConfirmation = false;
      await connect();
    }
    const receipt = await until(async () => {
      const value = await status();
      return value.stopConfirmed ? value : undefined;
    }, 'original persistent stop');
    stopped(receipt, instanceId);
    assert.equal(count('reportControl.prepare'), 1);
    assert.equal(count('platform.reportIsolation.start'), 1);
    assert.equal(count('platform.reportIsolation.stop'), mode === 'disconnect' ? 0 : 1);
    assert.equal(admission.status.active, 0);
    assert.equal(admission.status.waiting, 0);
    result.after = admission.status;
    await bounded(
      client.close(),
      'C close ACK',
      isolationControlOperations['reportControl.close'].semantics.waitMs,
    );
    for (const owned of channels) await bounded(owned.close(), 'owned channel close');
    await until(() => units(roles).length === 0, 'installation C/M exit after close');
    if (networkServer) assert.equal(result.network.connections, 0);
    result.accepted = true;
  } catch (error) {
    result.failure = { code: error.code, message: error.message, stack: error.stack };
    throw error;
  } finally {
    finished = true;
    client.disconnect();
    for (const channel of channels) {
      try {
        await bounded(channel.close(), 'final channel close');
      } catch (error) {
        result.accepted = false;
        result.closeFailures.push({ code: error.code, message: error.message });
      }
    }
    if (networkServer) {
      try {
        networkServer.closeAllConnections();
        await bounded(
          new Promise((resolve, reject) => {
            networkServer.close((error) => {
              if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
              else resolve();
            });
          }),
          'owned network trap close',
        );
        assert.equal(result.network.connections, 0, 'No late traffic may reach the host trap');
        result.network.closed = true;
      } catch (error) {
        result.accepted = false;
        result.closeFailures.push({ code: error.code, message: error.message });
      }
    }
    result.finalAdmission = admission.status;
    writeFileSync(join(evidence, `${mode}.json`), JSON.stringify(result, null, 2), {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(`${mode}: ${result.accepted ? 'passed' : 'unconfirmed'}; evidence: ${evidence}`);
  }
  assert(result.accepted, 'First failure: preserve original scope/receipts; do not retry');
}
console.log(
  isolation
    ? 'Passed installed P network-capability rejection and busy-stop only; no native seccomp matrix, UI or final I5 acceptance.'
    : 'Passed installed generic post-G recovery only; synthetic authorization/HTML, no UI or final I5 acceptance.',
);
