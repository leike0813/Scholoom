import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { callExecutionControl } from '../../packages/harness/dist/node.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import type { GraphExecution } from '../../packages/protocol/dist/execution.js';
import { createModelServer } from '../model-server.js';

const selection: Extract<GraphExecution, { kind: 'registered' }> = {
  kind: 'registered',
  graphId: 'fixed-counter',
  version: '1',
  config: { seed: 41 },
  materials: [],
  workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
};

class ResourceApplication extends KernelApplication {
  context: CallContext | undefined;
  override projectTargetRead(context: CallContext) {
    this.context = context;
    return super.projectTargetRead(context);
  }
}

test('a source StateGraph reads a real resource and creates a missing output through its owned worker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-graph-resource-'));
  const model = await createModelServer();
  model.hold = true;
  const app = new ResourceApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let child: Awaited<ReturnType<typeof ManagedNode.start>> | undefined;
  let peer: RpcPeer | undefined;
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const saved = await app.projects
      .get(project.id)
      .save('input.md', 'independent source evidence');
    assert(saved.fileId);
    const session = await app.call('session.create', { projectId: project.id });
    await app.call('session.send', {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'Hold this turn.',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    assert(app.context);
    const resources = app.executionResources(app.context);
    const input = await resources.describe({
      source: 'project',
      projectId: project.id,
      fileId: saved.fileId,
    });
    await expect(stat(join(project.path, 'graph-result.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    child = await ManagedNode.start({
      entry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
      instanceId: randomUUID(),
    });
    peer = new RpcPeer(
      { send: (frame) => child?.send(JSON.parse(frame)) },
      {
        request: async (method, value) => {
          if (method === 'resources.read')
            return resources.read(value as Parameters<typeof resources.read>[0]);
          if (method === 'resources.create')
            return resources.create(value as Parameters<typeof resources.create>[0]);
          throw new Error(`Unexpected graph request: ${method}`);
        },
      },
    );
    child.on('message', (message) => peer?.receive(JSON.stringify(message)));
    await callExecutionControl(peer, 'execution.initialize', {
      attemptId: 'resource-attempt',
      input: null,
      graph: {
        kind: 'registered',
        graphId: 'fixed-resource',
        version: '1',
        config: { outputPath: 'graph-result.md', operationId: 'graph-create' },
        materials: [{ ref: input.ref, basis: input.basis }],
        workDomain: { kind: 'project', projectId: project.id, sessionId: session.id },
      },
    });
    const result = await callExecutionControl(peer, 'execution.next', {});
    expect(result).toMatchObject({
      done: true,
      graph: {
        kind: 'graph.completed',
        evidence: {
          reads: [{ ref: input.ref, basis: input.basis }],
          creations: [
            { operationId: 'graph-create', state: 'complete', association: { state: 'confirmed' } },
          ],
        },
      },
    });
    expect(await readFile(join(project.path, 'graph-result.md'), 'utf8')).toBe(
      '# Graph result\n\nindependent source evidence',
    );
    expect(app.projects.get(project.id).history('graph-result.md')).toHaveLength(1);
    expect(await callExecutionControl(peer, 'execution.next', {})).toEqual(result);
    expect(app.projects.get(project.id).history('graph-result.md')).toHaveLength(1);
  } finally {
    await child?.stop();
    peer?.close();
    model.release();
    await app.close();
    await model.close();
  }
});

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
