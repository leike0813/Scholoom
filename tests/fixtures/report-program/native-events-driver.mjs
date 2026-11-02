import assert from 'node:assert/strict';
import { Console } from 'node:console';
import { createReportProgram } from '../../../packages/editor/report/program.mjs';
import {
  isReportProgramCommand,
  isReportProgramPacket,
} from '../../../packages/protocol/src/report-contracts.js';

async function main() {
  // Each invocation owns a fresh process: the real program installs DOM globals.
  const scripts = {
    passive: `target.addEventListener('click', event => {
    event.preventDefault();
    record('passive', event);
  }, {passive:true});`,
    noncancelable: `target.addEventListener('click', event => {
    event.preventDefault();
    record('noncancelable', event);
  });`,
    'caught-cancel': `target.addEventListener('click', event => {
    try { event.preventDefault(); }
    catch (error) { state.trace.push({step:'caught', code:error.code}); }
    record('after-catch', event);
  });`,
    'property-cancel': `target.onclick = event => {
    record('property', event);
    return false;
  };`,
    redispatch: `target.addEventListener('click', event => {
    if (event.isTrusted) state.saved = event;
    else event.preventDefault();
    record(event.isTrusted ? 'native' : 'synthetic', event);
  });
  scholoomReport.addEventListener('message', ({data}) => {
    if (data.type !== 'queued') return;
    const event = state.saved;
    const result = target.dispatchEvent(event);
    record('after-redispatch', event);
    scholoomReport.postMessage({type:'state', browse:{}, dirty:false,
      draft:{result, isTrusted:event.isTrusted, defaultPrevented:event.defaultPrevented,
        currentTargetIsNull:event.currentTarget === null, eventPhase:event.eventPhase}});
  });`,
    reentrant: `target.addEventListener('click', event => {
    try { target.dispatchEvent(event); }
    catch (error) { state.trace.push({step:'reentrant-error', name:error.name}); }
    record('after-reentrant', event);
  });`,
    multiple: `state.multiple = target.multiple;
  state.selection = () => Array.from(target.options, option => ({value:option.value, selected:option.selected}));
  state.initialSelection = state.selection();
  target.addEventListener('change', event => record('multiple-handler', event));`,
  };
  const name = process.argv[2];
  assert(Object.hasOwn(scripts, name), 'one fixed native event case is required');
  const binding = {
    version: 1,
    viewId: 'native-event-fixture',
    generation: 1,
    basis: 'synthetic-v1',
  };
  const script = `(() => {
  const target = document.getElementById('native-event-target');
  const state = globalThis.__scholoomNativeEventFixture = {trace:[], saved:null};
  const record = (step, event) => state.trace.push({step, isTrusted:event.isTrusted,
    cancelable:event.cancelable, defaultPrevented:event.defaultPrevented,
    eventPhase:event.eventPhase, currentTargetIsTarget:event.currentTarget === target});
  ${scripts[name]}
  target.addEventListener('click', event => record('tail', event));
})();`;
  const targetName = name === 'multiple' ? 'select' : 'input';
  const markup =
    name === 'multiple'
      ? '<select id="native-event-target" multiple><option value="A" selected>A</option><option value="B" selected>B</option></select>'
      : '<input id="native-event-target" type="text" value="initial">';
  const html = `${markup}<script>${script}</script>`;
  const packets = [];
  const commands = [];
  const failures = [];
  const strings = [];
  let targetId;
  let lastConsumed = 0;
  let program;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  // The initial command returns before asynchronous startup; always observe this rejection.
  void ready.catch(() => {});
  const write = process.stdout.write.bind(process.stdout);
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
  const watchdog = setTimeout(() => {
    process.stderr.write('native event case exceeded six seconds\n');
    process.exit(1);
  }, 6000);
  const result = {
    name,
    state: 'failed',
    binding,
    approvedFiles: {
      authority: 'explicit synthetic files substitute',
      entryURL: 'scholoom-report://local/native-events.html',
      html,
      script,
    },
    commands,
    packets,
    failures,
    firstFailure: null,
    closed: false,
  };
  async function receive(command) {
    assert(commands.length < 32, 'bounded commands');
    assert(isReportProgramCommand(command), 'public command schema');
    commands.push(structuredClone(command));
    await program.receive(command);
  }
  try {
    const deniedFile = () => {
      throw new Error('fixed fixture has no external approved resources');
    };
    program = createReportProgram(
      {
        entryURL: result.approvedFiles.entryURL,
        html,
        resolve: deniedFile,
        text: deniedFile,
        response: deniedFile,
      },
      {
        async send(packet) {
          assert(packets.length < 32, 'bounded public packets');
          assert(isReportProgramPacket(packet), 'public packet schema');
          packets.push(structuredClone(packet));
          if ('sequence' in packet) {
            assert(packet.sequence <= 16, 'bounded frames');
            assert.equal(packet.sequence, lastConsumed + 1);
            strings.push(...packet.strings);
            for (let offset = 0; offset < packet.nodes.length; offset += 5) {
              const [id, type, localName] = packet.nodes.slice(offset, offset + 5);
              if (type === 1 && strings[localName] === targetName) {
                assert.equal(targetId, undefined, 'exactly one owned target');
                targetId = id;
              }
            }
            await receive({ type: 'consume', sequences: [packet.sequence] });
            lastConsumed = packet.sequence;
          } else {
            for (const [key, value] of Object.entries(binding)) assert.equal(packet[key], value);
            if (packet.type === 'ready') readyResolve();
            if (packet.type === 'inputConfirmed') assert(packet.through <= lastConsumed);
          }
        },
        failed(error, actualBinding) {
          failures.push({ code: error.code, name: error.name, binding: actualBinding });
          readyReject(error);
        },
      },
    );
    await receive({
      ...binding,
      type: 'start',
      viewport: [800, 600],
      cssProperties: [],
      eventProperties: ['onclick'],
    });
    await ready;
    assert(Number.isInteger(targetId), 'input identity comes from the public creation frame');
    const state = globalThis.__scholoomNativeEventFixture;
    const expectedSelection = [
      { value: 'A', selected: true },
      { value: 'B', selected: true },
    ];
    if (name === 'multiple') {
      assert.equal(state.multiple, true);
      assert.deepEqual(state.initialSelection, expectedSelection);
    }
    const input = {
      nodeId: targetId,
      revision: 1,
      eventType: name === 'multiple' ? 'change' : 'click',
      bubbles: true,
      cancelable: name !== 'noncancelable',
      isTrusted: true,
      value: name === 'multiple' ? 'A' : 'approved-value',
      ...(name === 'multiple' ? { selectedIndex: 0 } : {}),
    };
    await receive({ ...binding, type: 'input', input });
    if (name === 'redispatch') await receive({ ...binding, type: 'queued' });
    // This diagnostic object belongs to the fixed script, not the program's internal event state.
    result.trace = structuredClone(state.trace);
    const confirmed = packets.filter((packet) => packet.type === 'inputConfirmed');
    const steps = result.trace.map((entry) => entry.step);
    if (name === 'multiple') {
      result.selection = { before: state.initialSelection, after: state.selection() };
      assert.equal(failures.length, 1, 'unsupported multiple input latches one failure');
      assert.equal(failures[0].code, 'unavailable');
      assert.deepEqual(failures[0].binding, binding);
      assert.equal(confirmed.length, 0, 'unsupported multiple input has no confirmation');
      assert.deepEqual(
        result.selection.after,
        expectedSelection,
        'reject before applying value or selectedIndex',
      );
      assert.deepEqual(result.trace, [], 'unsupported input never dispatches an event');
    } else if (['caught-cancel', 'property-cancel'].includes(name)) {
      assert.equal(failures.length, 1, 'native cancellation latches one failure');
      assert.equal(failures[0].code, 'unavailable');
      assert.deepEqual(failures[0].binding, binding);
      assert.equal(confirmed.length, 0, 'failed native cancellation has no confirmation');
      if (name === 'caught-cancel') {
        assert.deepEqual(result.trace[0], { step: 'caught', code: 'unavailable' });
        assert.deepEqual(steps, ['caught', 'after-catch', 'tail']);
        assert.equal(
          result.trace[1].defaultPrevented,
          false,
          'guard cannot fake successful cancellation',
        );
      } else {
        assert.deepEqual(steps, ['property']);
        assert.equal(result.trace[0].isTrusted, true);
      }
      const before = packets.length;
      await receive({ ...binding, type: 'input', input: { ...input, revision: 2 } });
      assert.equal(packets.length, before, 'latched program accepts no later input result');
      assert.equal(failures.length, 1);
      assert.deepEqual(state.trace, result.trace, 'latched program does not rerun the handler');
    } else {
      assert.deepEqual(failures, []);
      assert.equal(confirmed.length, 1);
      assert.equal(confirmed[0].nodeId, targetId);
      assert.equal(confirmed[0].revision, 1);
      assert.equal(confirmed[0].value, 'approved-value');
      if (name === 'redispatch') {
        assert.deepEqual(steps, ['native', 'tail', 'synthetic', 'tail', 'after-redispatch']);
        assert.equal(result.trace[0].isTrusted, true);
        assert.equal(result.trace[0].defaultPrevented, false);
        assert.equal(result.trace[2].isTrusted, false);
        assert.equal(result.trace[2].defaultPrevented, true);
        const states = packets.filter((packet) => packet.type === 'state');
        assert.equal(states.length, 1);
        assert.deepEqual(states[0].draft, {
          result: false,
          isTrusted: false,
          defaultPrevented: true,
          currentTargetIsNull: true,
          eventPhase: 0,
        });
      } else if (name === 'reentrant') {
        assert.deepEqual(steps, ['reentrant-error', 'after-reentrant', 'tail']);
        assert.equal(result.trace[0].name, 'InvalidStateError');
        for (const event of result.trace.slice(1)) {
          assert.equal(event.isTrusted, true);
          assert.equal(event.currentTargetIsTarget, true);
          assert.equal(event.eventPhase, 2);
          assert.equal(event.defaultPrevented, false);
        }
      } else {
        assert.deepEqual(steps, [name, 'tail']);
        for (const event of result.trace) {
          assert.equal(event.isTrusted, true);
          assert.equal(event.cancelable, name === 'passive');
          assert.equal(event.defaultPrevented, false);
        }
      }
    }
    result.state = 'passed';
  } catch (error) {
    result.firstFailure = {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack,
    };
    result.trace ??= structuredClone(globalThis.__scholoomNativeEventFixture?.trace ?? []);
    process.exitCode = 1;
  } finally {
    try {
      program?.close();
      result.closed = Boolean(program);
    } finally {
      clearTimeout(watchdog);
    }
    result.lastConsumed = lastConsumed;
    write(`${JSON.stringify(result)}\n`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
