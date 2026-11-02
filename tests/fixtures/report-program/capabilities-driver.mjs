import assert from 'node:assert/strict';
import { ReportProgramFiles } from '../../../packages/editor/report/files.mjs';
import { createReportProgram } from '../../../packages/editor/report/program.mjs';
import { isReportProgramPacket } from '../../../packages/protocol/src/report-contracts.js';

const mode = process.argv[2];
assert(['caught', 'uncaught'].includes(mode));
const script =
  mode === 'uncaught'
    ? `new WebSocket('ws://127.0.0.1:1');`
    : `const outcomes = [];
async function attempt(api, run) {
  try { await run(); outcomes.push({api, outcome:'allowed'}); }
  catch (error) { outcomes.push({api, outcome:'rejected', code:error.code ?? null}); }
}
await attempt('fetch', () => fetch('https://unapproved.invalid/data.json'));
await attempt('XHR', () => new XMLHttpRequest());
// Port 1 is rejected by undici before any socket is opened, even before the repair.
await attempt('WebSocket', () => new Promise((resolve, reject) => {
  const socket = new WebSocket('ws://127.0.0.1:1');
  socket.onopen = () => { socket.close(); resolve(); };
  socket.onerror = () => { socket.close(); reject(new Error('network rejected')); };
}));
await attempt('EventSource', () => new EventSource('https://unapproved.invalid/events'));
await attempt('BroadcastChannel', () => {
  const channel = new BroadcastChannel('scholoom-capability-fixture');
  channel.close();
});
const response = await fetch('./data.json');
const data = await response.clone().json();
const target = document.getElementById('target');
let localEvent = false;
target.addEventListener('click', event => { localEvent = event instanceof Event; });
target.dispatchEvent(new Event('click', {bubbles:true}));
const controller = new AbortController();
controller.abort();
const message = await new Promise(resolve => {
  const {port1, port2} = new MessageChannel();
  port1.onmessage = event => { port1.close(); port2.close(); resolve(event.data); };
  port2.postMessage('local');
});
scholoomReport.postMessage({type:'state', browse:{outcomes, data, localEvent,
  aborted:controller.signal.aborted, message}, draft:{}, dirty:false});`;

// Synthetic frozen files replace only the constructor's filesystem authority.
const files = Object.assign(Object.create(ReportProgramFiles.prototype), {
  entryURL: 'scholoom-report://local/report.html',
  html: `<button id="target">Example</button><script type="module">${script}</script>`,
  files: new Map([
    [
      'scholoom-report://local/data.json',
      { bytes: new TextEncoder().encode('{"approved":true}'), mediaType: 'application/json' },
    ],
  ]),
});
const packets = [];
const failures = [];
const completion = Promise.withResolvers();
const binding = { version: 1, viewId: 'capabilities', generation: 1, basis: 'synthetic-v1' };
let program;
program = createReportProgram(files, {
  async send(packet) {
    assert(packets.length < 16);
    assert(isReportProgramPacket(packet));
    packets.push(packet);
    if ('sequence' in packet)
      await program.receive({ type: 'consume', sequences: [packet.sequence] });
    if (packet.type === 'ready') completion.resolve();
  },
  failed(error) {
    failures.push(error);
    completion.reject(error);
  },
});
async function main() {
  try {
    const completed =
      mode === 'uncaught'
        ? assert.rejects(completion.promise, { code: 'unavailable' })
        : completion.promise;
    await program.receive({
      ...binding,
      type: 'start',
      viewport: [800, 600],
      cssProperties: [],
      eventProperties: ['onclick'],
    });
    await completed;
    if (mode === 'uncaught') {
      assert.equal(failures.length, 1);
      assert(!packets.some((packet) => packet.type === 'ready'));
    } else {
      assert.deepEqual(failures, []);
      const states = packets.filter((packet) => packet.type === 'state');
      assert.equal(states.length, 1);
      const { outcomes, ...local } = states[0].browse;
      assert.deepEqual(
        outcomes.map(({ api, outcome }) => ({ api, outcome })),
        ['fetch', 'XHR', 'WebSocket', 'EventSource', 'BroadcastChannel'].map((api) => ({
          api,
          outcome: 'rejected',
        })),
      );
      for (const { api, code } of outcomes)
        if (api !== 'XHR') assert.equal(code, 'unavailable', api);
      assert.deepEqual(local, {
        data: { approved: true },
        localEvent: true,
        aborted: true,
        message: 'local',
      });
    }
    console.log(JSON.stringify({ mode, state: 'passed' }));
  } finally {
    program.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
