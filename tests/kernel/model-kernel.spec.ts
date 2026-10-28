import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createDevelopmentKernel } from '../../apps/kernel/dist/bootstrap.js';
import { inspectKernel } from '../../apps/kernel/dist/lifecycle.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { limits } from '../../packages/protocol/dist/index.js';
import { developmentKernelConnectionTimeout } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';

async function attachment() {
  const item = test
    .info()
    .attachments.filter((entry) => entry.name === 'model-kernel-execution')
    .at(-1);
  assert(item?.path);
  const body = await readFile(item.path, 'utf8');
  expect(Buffer.byteLength(body)).toBeLessThanOrEqual(256 * 1024);
  return { body, data: JSON.parse(body) };
}

test('legacy model kernel records owned execution stages without model text or connection secrets', async () => {
  test.setTimeout(120_000);
  const directory = test.info().outputPath('profile');
  const previous = createDevelopmentKernel({ dataDirectory: directory });
  const existing = await previous.bootstrap('ensure');
  assert(existing.state === 'running');
  const model = await createModelServer();
  let stop: (() => Promise<void>) | undefined;
  let client: ReturnType<typeof createKernelClient> | undefined;
  try {
    stop = await startModelKernel(directory, model.url);
    expect(typeof stop).toBe('function');
    const status = await inspectKernel(directory);
    assert(status.state === 'running');
    expect(status.endpoint.instanceId).not.toBe(existing.endpoint.instanceId);
    await previous.dispose();
    client = createKernelClient(status.endpoint);
    await client.connect();
    const key = 'private-diagnostic-key-synthetic';
    await client.call('provider.configure', { apiKey: key });
    const sessions: string[] = [];
    for (let index = 0; index < 10; index++) {
      const session = await client.call('session.create', { projectId: 'application' });
      sessions.push(session.id);
      // A real session-scoped change also exercises the observer cap without extra executions.
      await client.call('session.rename', {
        projectId: 'application',
        sessionId: session.id,
        title: `Observed ${index}`,
      });
      if (index > 1) continue;
      const scope = { projectId: 'application', sessionId: session.id };
      await client.call('session.send', {
        ...scope,
        instructionId: `observed-${index}`,
        text: 'MODEL_CHAT PRIVATE_OBSERVATION_TEXT',
        materials: [],
      });
      await expect
        .poll(async () => (await client?.call('workbench.snapshot', scope))?.run?.state, {
          timeout: 20_000,
        })
        .toBe('completed');
    }
    expect(model.requests.length).toBeGreaterThanOrEqual(2);
    await stop();
    await stop();
    stop = undefined;
    const { body, data } = await attachment();
    expect(data.kernelProcessId).toBe(status.endpoint.processId);
    expect(data.kernelInstanceId).toBe(status.endpoint.instanceId);
    expect(data.childClosed).toBe(true);
    expect(data.childExit).toEqual({ code: 0, signal: null });
    expect(data.execution.lifecycle.map((item: { phase: string }) => item.phase)).toContain(
      'kernel.serve.closed',
    );
    expect(data.execution.captures.length).toBeLessThanOrEqual(8);
    expect(data.execution.droppedScopeEvents).toBeGreaterThan(0);
    for (const secret of [key, 'PRIVATE_OBSERVATION_TEXT', model.url, status.endpoint.token])
      expect(body.includes(secret)).toBe(false);
    for (const sessionId of sessions.slice(0, 2)) {
      const captured = data.execution.captures.find(
        (item: { sessionId: string }) => item.sessionId === sessionId,
      );
      assert(captured);
      expect(captured.modelRequestsAtStart).toBe(null);
      const controls = captured.controls as { phase: string; instanceId: string; runId: string }[];
      for (const phase of [
        'execution.initialize.sent',
        'execution.initialize.response',
        'execution.consume.response',
        'model.acquire.response',
        'model.output',
        'controller.exit',
      ])
        expect(controls.some((item) => item.phase === phase)).toBe(true);
      const instances = new Map<string, { runId: string; processId: number }>(
        captured.samples
          .flatMap(
            (sample: { instances?: { instanceId: string; runId: string; processId: number }[] }) =>
              sample.instances ?? [],
          )
          .map((instance: { instanceId: string; runId: string; processId: number }) => [
            instance.instanceId,
            instance,
          ]),
      );
      for (const control of controls)
        expect(instances.get(control.instanceId)?.runId).toBe(control.runId);
      for (const child of captured.children) {
        expect(child.processId).not.toBe(data.kernelProcessId);
        expect(instances.get(child.instanceId)?.processId).toBe(child.processId);
      }
    }
    expect((await inspectKernel(directory)).state).toBe('stopped');
  } finally {
    await stop?.();
    client?.dispose();
    await previous.dispose();
    await model.close();
  }
});

test('an old model kernel stop never shuts down its successor', async () => {
  const directory = test.info().outputPath('profile');
  const model = await createModelServer();
  let current: (() => Promise<void>) | undefined;
  let old: (() => Promise<void>) | undefined;
  try {
    old = await startModelKernel(directory, model.url);
    const first = await inspectKernel(directory);
    assert(first.state === 'running');
    current = await startModelKernel(directory, model.url);
    const successor = await inspectKernel(directory);
    assert(successor.state === 'running');
    expect(successor.endpoint.instanceId).not.toBe(first.endpoint.instanceId);
    await expect(old()).rejects.toThrow();
    old = undefined;
    const client = createKernelClient(successor.endpoint);
    try {
      await client.connect();
      expect((await client.status()).instanceId).toBe(successor.endpoint.instanceId);
    } finally {
      client.dispose();
    }
  } finally {
    await current?.();
    await old?.();
    await model.close();
  }
});

test('model kernel initialization failure preserves a safe artifact and closes only its child', async () => {
  const directory = test.info().outputPath('profile');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'application'), 'controlled startup obstruction');
  const model = await createModelServer();
  try {
    await expect(startModelKernel(directory, model.url)).rejects.toThrow();
    const { body, data } = await attachment();
    expect(data.childClosed).toBe(true);
    expect(data.kernelInstanceId).toBeUndefined();
    expect(data.execution.lifecycle.map((item: { phase: string }) => item.phase)).toContain(
      'kernel.startup.failed',
    );
    expect(body.includes(model.url)).toBe(false);
    expect((await inspectKernel(directory)).state).toBe('stopped');
  } finally {
    await model.close();
  }
});

test('private diagnostic IPC loss preserves an accepted model run until normal owned shutdown', async () => {
  test.setTimeout(120_000);
  const directory = test.info().outputPath('profile');
  await mkdir(directory, { recursive: true });
  const artifact = test.info().outputPath('private-child.json');
  const model = await createModelServer();
  const child = fork(new URL('../fixtures/model-kernel-process.mjs', import.meta.url), [], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  child.on('error', () => {});
  let ended = false;
  let exit: { code: number | null; signal: string | null } | undefined;
  const exits: { phase: string; code?: number | null; signal?: string | null }[] = [];
  child.once('disconnect', () => exits.push({ phase: 'ipc.disconnected' }));
  child.once('exit', (code, signal) => {
    exit = { code, signal };
    exits.push({ phase: 'child.exited', code, signal });
  });
  child.once('close', () => {
    ended = true;
    exits.push({ phase: 'child.closed' });
  });
  let client: ReturnType<typeof createKernelClient> | undefined;
  try {
    child.send({ directory, endpoint: model.url, artifact, observationMs: 60_000 });
    await expect
      .poll(async () => (await inspectKernel(directory)).state, {
        timeout: developmentKernelConnectionTimeout,
      })
      .toBe('running');
    const status = await inspectKernel(directory);
    assert(status.state === 'running');
    expect(status.endpoint.processId).toBe(child.pid);
    client = createKernelClient(status.endpoint);
    await client.connect();
    await client.attachDevelopment();
    await client.call('provider.configure', { apiKey: 'synthetic' });
    const session = await client.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    model.hold = true;
    await client.call('session.send', {
      ...scope,
      instructionId: 'held-owned-run',
      text: 'MODEL_CHAT held owned request',
      materials: [],
    });
    await expect.poll(() => model.requests.length, { timeout: 20_000 }).toBeGreaterThan(0);
    child.disconnect();
    await expect
      .poll(async () => JSON.parse(await readFile(artifact, 'utf8')).parentDisconnected)
      .toBe(true);
    expect((await client.status()).instanceId).toBe(status.endpoint.instanceId);
    expect((await client.call('workbench.snapshot', scope)).run?.state).toBe('running');
    expect(ended).toBe(false);
    model.release();
    await expect
      .poll(async () => (await client?.call('workbench.snapshot', scope))?.run?.state, {
        timeout: 20_000,
      })
      .toBe('completed');
  } finally {
    model.release();
    try {
      if (client) await client.shutdown();
      // Node 24 may omit close after parent-initiated IPC disconnect; exit alone is insufficient.
      await expect
        .poll(() => exit, { timeout: limits.lifecycleMs })
        .toEqual({ code: 0, signal: null });
      const closed = JSON.parse(await readFile(artifact, 'utf8'));
      expect(closed.lifecycle.map((item: { phase: string }) => item.phase)).toContain(
        'kernel.serve.closed',
      );
      expect((await inspectKernel(directory)).state).toBe('stopped');
    } finally {
      client?.dispose();
      child.channel?.unref();
      child.unref();
      await model.close();
      await test.info().attach('owned-child-events', {
        body: JSON.stringify(exits),
        contentType: 'application/json',
      });
    }
  }
});
