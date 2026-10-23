import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { callExecutionControl } from '../../packages/harness/dist/node.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import type { GraphExecution } from '../../packages/protocol/dist/execution.js';

const selection: Extract<GraphExecution, { kind: 'registered' }> = {
  kind: 'registered',
  graphId: 'fixed-counter',
  version: '1',
  config: { seed: 41 },
  materials: [],
  workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
};

test('source registration validates in host and actual worker before constructing a deterministic StateGraph', async () => {
  // @ts-expect-error Source-only worker fixture deliberately has no generated declaration.
  const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
  const effects: unknown[] = [];
  const child = await ManagedNode.start({
    entry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
    instanceId: randomUUID(),
  });
  const peer = new RpcPeer(
    { send: (frame) => child.send(JSON.parse(frame)) },
    {
      request: async (method, value) => {
        expect(method).toBe('execution.custom');
        effects.push(value);
        return 'recorded';
      },
    },
  );
  child.on('message', (message) => peer.receive(JSON.stringify(message)));
  try {
    for (const [graph, code] of [
      [{ ...selection, graphId: 'absent' }, 'unavailable'],
      [{ ...selection, version: '2' }, 'protocolIncompatible'],
      [{ ...selection, config: { seed: '41' } }, 'invalidRequest'],
      [{ ...selection, config: { seed: 41, modulePath: '/tmp/client-code' } }, 'invalidRequest'],
    ] as const) {
      expect(() => graphs.resolve(graph)).toThrow(expect.objectContaining({ code }));
      await expect(
        callExecutionControl(peer, 'execution.initialize', {
          graph,
          attemptId: 'attempt',
          input: null,
        }),
      ).rejects.toMatchObject({ code });
      expect(effects).toHaveLength(0);
    }
    expect(graphs.resolve(selection).definition.stateFormatVersion).toBe('1');
    await expect(
      callExecutionControl(peer, 'execution.initialize', {
        graph: selection,
        attemptId: 'attempt',
        input: null,
        instructions: [{ instructionId: 'must-not-be-discarded' }],
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(effects).toHaveLength(0);
    await expect(
      peer.request(
        'execution.initialize',
        {
          graph: selection,
          attemptId: 'attempt',
          input: null,
          workerEntry: 'file:///tmp/client-code.mjs',
        },
        { waitMs: 1000 },
      ),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      callExecutionControl(peer, 'execution.initialize', {
        graph: selection,
        attemptId: 'attempt',
        input: { attemptId: 'other', waitId: 'wait', instructionIds: ['instruction'], value: null },
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(effects).toHaveLength(0);
    await callExecutionControl(peer, 'execution.initialize', {
      graph: selection,
      attemptId: 'attempt',
      input: null,
    });
    expect(await callExecutionControl(peer, 'execution.next', {})).toMatchObject({
      done: true,
      graph: {
        kind: 'graph.completed',
        attemptId: 'attempt',
        evidence: { inputs: [], reads: [], results: [] },
      },
    });
    expect(effects).toEqual([{ name: 'fixed-node', args: { value: 42 } }]);
    await expect(
      callExecutionControl(peer, 'execution.initialize', {
        graph: selection,
        attemptId: 'attempt',
        input: null,
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await callExecutionControl(peer, 'execution.stop', {});
    await expect(callExecutionControl(peer, 'execution.next', {})).rejects.toMatchObject({
      code: 'shuttingDown',
    });
  } finally {
    await child.stop();
    peer.close();
  }
});
