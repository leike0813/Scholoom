import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { ReportControlClient } from '../../../apps/kernel/dist/report-control.js';
import { encodeReportHeader } from '../../../packages/editor/dist/report-codec.js';
import { ProcessAdmission } from '../../../packages/platform/dist/admission.js';
import { isReportProgramPacket } from '../../../packages/protocol/dist/report-contracts.js';

// The installed C and M are real; K uses a fixed synthetic byte source, never a model or user material.
assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid() > 0);
const file = resolve(process.argv[2]);
const initialRestore = process.argv[3] === '--initial-restore';
assert.equal(process.argv.length, initialRestore ? 4 : 3);
const config = JSON.parse(readFileSync(file, 'utf8'));
const nodeProfile = config.policy?.profile === 'linux-x64-node-v1';
const interactive = config.programId === 'scholoom-interactive-report';
assert(!initialRestore || interactive);
assert.equal(process.getuid(), config.kernelUid);
const base = join(homedir(), '.cache', 'scholoom-report-system-service');
mkdirSync(base, { recursive: true, mode: 0o700 });
const evidence = mkdtempSync(join(base, 'acceptance-')),
  instanceId = randomUUID();
const admission = new ProcessAdmission(1, 1),
  statuses = [],
  authorization = [];
const client = new ReportControlClient({
  configId: config.configId,
  admission,
  authorize: async (id) => {
    assert.equal(id, instanceId);
    authorization.push({ id, at: Date.now() });
  },
});
let accepted = false;
let response;
const packets = [],
  commands = [];
const binding = { version: 1, viewId: randomUUID(), generation: 1, basis: 'synthetic-v1' };
const dependencies = [
  { path: 'labels.js', bytes: Buffer.from('export const label = "module-ok";') },
  {
    path: 'module.js',
    bytes: Buffer.from(
      'import {label} from "./labels.js"; document.getElementById("external").textContent = label;',
    ),
  },
];
const report =
  encodeReportHeader({
    version: 1,
    resources: dependencies.map(({ path }) => ({
      path,
      ref: { source: 'project', projectId: 'synthetic', fileId: path },
      basis: 'synthetic-v1',
      mediaType: 'text/javascript',
    })),
    sources: [],
    objects: [
      {
        objectId: 'known-object',
        name: 'Synthetic object',
        semantics: 'Mechanical bootstrap fixture',
      },
    ],
  }) +
  `<html><head><script type="module" src="module.js"></script></head><body><p id="classic"></p><p id="external"></p><p id="inline"></p><p id="restored"></p><script>
document.getElementById('classic').textContent = 'classic-ok';
scholoomReport.addEventListener('message', ({data}) => {
  if (data.type === 'queued') {
    scholoomReport.postMessage({type:'select', objectIds:['known-object'], request:'Inspect this object'});
    return;
  }
  if (data.type !== 'restore') return;
  document.getElementById('restored').textContent = data.draft.note;
  scholoomReport.postMessage({type:'state', browse:{}, dirty:true, draft:{
    classic:document.getElementById('classic').textContent,
    external:document.getElementById('external').textContent,
    inline:document.getElementById('inline').textContent,
    restored:document.getElementById('restored').textContent
  }});
  if (!data.browse.initializing)
    scholoomReport.postMessage({type:'select', objectIds:['known-object'], request:'Inspect this object'});
});
</script><script type="module">import {label} from './labels.js'; document.getElementById('inline').textContent = label + '-inline';</script></body></html>`;
try {
  await client.connectService({
    path: join(dirname(config.managerSocket), 'control.sock'),
    ownerUid: 0,
    serverUid: 0,
  });
  const prepared = await client.prepare(
    { instanceId, programId: config.programId, policyId: config.policy.id },
    async () => {
      assert.equal(admission.status.active, 1);
      return {
        entryPath: interactive ? 'reports/entry.html' : 'reports/entry.txt',
        files: interactive
          ? [
              { path: 'reports/entry.html', bytes: Buffer.from(report) },
              ...dependencies.map(({ path, bytes }) => ({ path: `reports/${path}`, bytes })),
            ]
          : [{ path: 'reports/entry.txt', bytes: Buffer.from('approved report bytes\n') }],
      };
    },
  );
  statuses.push(prepared);
  assert.equal(prepared.phase, 'preparing');
  const port = client.port();
  statuses.push(await port['platform.reportIsolation.start']({ instanceId }));
  const deadline = Date.now() + 30_000;
  if (nodeProfile) {
    while (Date.now() < deadline) {
      const status = await port['platform.reportIsolation.get']({ instanceId });
      statuses.push(status);
      if (status.phase === 'running') break;
      assert(!status.stopConfirmed && status.phase !== 'unknown');
      await pause(30);
    }
    assert.equal(statuses.at(-1).phase, 'running');
    let first = true;
    const queue = interactive
      ? [
          {
            ...binding,
            type: 'start',
            ...(initialRestore ? { restorePending: true } : {}),
            viewport: [800, 600],
            cssProperties: [],
            eventProperties: [],
          },
          ...(initialRestore
            ? [
                {
                  ...binding,
                  type: 'restore',
                  browse: { initializing: true },
                  draft: { note: 'approved draft' },
                  dirty: true,
                },
              ]
            : []),
        ]
      : [];
    let selected;
    while (Date.now() < deadline && !response) {
      const command = interactive ? queue.shift() : first ? { action: 'probe' } : undefined;
      if (command) commands.push(command);
      const result = await client.exchange({
        instanceId,
        ...(command ? { frame: JSON.stringify(command) } : {}),
      });
      first = false;
      if (result.frames.length) {
        if (!interactive) {
          assert.equal(result.frames.length, 1);
          response = JSON.parse(result.frames[0]);
        } else
          for (const frame of result.frames) {
            const packet = JSON.parse(frame);
            assert(isReportProgramPacket(packet));
            assert(packets.length < 256);
            packets.push(packet);
            if ('sequence' in packet) queue.push({ type: 'consume', sequences: [packet.sequence] });
            else {
              for (const [key, value] of Object.entries(binding)) assert.equal(packet[key], value);
              assert.notEqual(packet.type, 'error', JSON.stringify(packet));
              if (initialRestore && packet.type === 'ready')
                assert(
                  packets
                    .filter((packet) => 'sequence' in packet)
                    .every((frame) =>
                      commands.some(
                        (command) =>
                          command.type === 'consume' && command.sequences.includes(frame.sequence),
                      ),
                    ),
                );
              if (packet.type === 'ready')
                queue.push(
                  initialRestore
                    ? { ...binding, type: 'queued' }
                    : {
                        ...binding,
                        type: 'restore',
                        browse: {},
                        draft: { note: 'approved draft' },
                        dirty: true,
                      },
                );
              if (packet.type === 'select') selected = packet;
            }
            const state = packets.find((item) => item.type === 'state');
            if (state && selected)
              response = {
                draft: state.draft,
                selected: { objectIds: selected.objectIds, request: selected.request },
              };
          }
      }
      if (!response) await pause(30);
    }
    if (interactive) {
      assert.deepEqual(response, {
        draft: {
          classic: 'classic-ok',
          external: 'module-ok',
          inline: 'module-ok-inline',
          restored: 'approved draft',
        },
        selected: { objectIds: ['known-object'], request: 'Inspect this object' },
      });
      assert(packets.some((packet) => 'sequence' in packet));
      assert(commands.some((command) => command.type === 'consume'));
      if (initialRestore) {
        const readyIndex = packets.findIndex((packet) => packet.type === 'ready');
        assert(readyIndex > packets.findIndex((packet) => packet.type === 'state'));
        assert(readyIndex < packets.findIndex((packet) => packet.type === 'select'));
        const frames = packets.slice(0, readyIndex).filter((packet) => 'sequence' in packet);
        assert(frames.some((frame) => frame.strings.includes('approved draft')));
      }
    } else
      assert.deepEqual(response, {
        approved: 'approved report bytes\n',
        request: { action: 'probe' },
      });
    statuses.push(await port['platform.reportIsolation.stop']({ instanceId }));
  }
  for (;;) {
    const status = await port['platform.reportIsolation.get']({ instanceId });
    statuses.push(status);
    if (status.stopConfirmed) {
      assert.equal(status.phase, 'stopped');
      assert.equal(status.gateReleased, true);
      assert.equal(status.failure, undefined);
      break;
    }
    if (status.phase === 'unknown' || Date.now() >= deadline)
      throw new Error('Unconfirmed original execution; preserve installed objects and C receipts.');
    await pause(50);
  }
  await client.close();
  assert.equal(admission.status.active, 0);
  assert.equal(admission.status.waiting, 0);
  assert(authorization.length >= 2);
  accepted = true;
} finally {
  // A failed acceptance does not become a stop receipt or trigger a new instance.
  if (!accepted) client.disconnect();
  writeFileSync(
    join(evidence, 'result.json'),
    JSON.stringify(
      {
        accepted,
        instanceId,
        configId: config.configId,
        statuses,
        authorization,
        admission: admission.status,
        ...(response ? { response } : {}),
        ...(interactive ? { packets, commands } : {}),
        ...(initialRestore ? { initialRestore: true } : {}),
        boundary: interactive
          ? 'generic HTML/JS bootstrap with real K/C/M; synthetic bytes/authorization, no UI or full I5'
          : nodeProfile
            ? 'fixed Node/data with real K/C/M; not arbitrary HTML/UI or full I5'
            : 'fixed native T1 with real K/C/M; not HTML/JS/UI or full I5',
      },
      null,
      2,
    ),
  );
  console.log(`Evidence: ${evidence}`);
}
