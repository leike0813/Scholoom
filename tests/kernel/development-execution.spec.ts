import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createKernelClient, type KernelClient } from '../../packages/client/dist/index.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import { runKernel } from '../kernel-fixture.js';
import { createModelServer } from '../model-server.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

function isAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

async function startKernel(profile: string, modelEndpoint: string): Promise<ChildProcess> {
  const module = new URL('../../apps/kernel/dist/lifecycle.js', import.meta.url).href;
  const source = `import { serveKernel } from ${JSON.stringify(module)}; try { await serveKernel(process.argv[1], {modelEndpoint:process.argv[2],environment:{MINIMAX_CN_API_KEY:'synthetic'},development:true}); } catch { process.send?.({state:'failed'}); process.exitCode=1; } finally { process.disconnect?.(); }`;
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', source, profile, modelEndpoint],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  );
  try {
    const [message] = (await once(child, 'message')) as [{ state?: string }];
    if (message.state !== 'ready') throw new Error(`Kernel did not start: ${message.state}`);
    return child;
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

async function startOwner(profile: string): Promise<ChildProcess> {
  const module = new URL('../../apps/kernel/dist/bootstrap.js', import.meta.url).href;
  const source = `import {createDevelopmentKernel} from ${JSON.stringify(module)}; const host=createDevelopmentKernel({dataDirectory:process.argv[1]}); process.on('message',async message=>{if(message==='dispose'){await host.dispose();process.disconnect?.();}}); const result=await host.bootstrap('inspect'); process.send?.({state:result.state});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source, profile], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  try {
    const [message] = (await once(child, 'message')) as [{ state?: string }];
    if (message.state !== 'running') throw new Error(`Owner did not attach: ${message.state}`);
    return child;
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

function runInstance(projectPath: string, runId: string): RunInstance | undefined {
  const database = new Database(join(projectPath, '.scholoom', 'project.sqlite'), {
    readonly: true,
    fileMustExist: true,
    timeout: 2_000,
  });
  try {
    const row = database.prepare('SELECT value FROM run_instances WHERE run_id=?').get(runId) as
      | { value: string }
      | undefined;
    return row ? (JSON.parse(row.value) as RunInstance) : undefined;
  } finally {
    database.close();
  }
}

for (const ownerExit of ['dispose', 'SIGKILL'] as const) {
  test(`last development owner ${ownerExit} reclaims a held execution while project and library data persist`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-development-execution-'));
    const profile = join(root, 'profile');
    const projectPath = join(root, 'project');
    const model = await createModelServer();
    let kernel: ChildProcess | undefined;
    let owner: ChildProcess | undefined;
    let client: KernelClient | undefined;
    try {
      kernel = await startKernel(profile, model.url);
      const kernelExit = once(kernel, 'exit');
      owner = await startOwner(profile);
      const kernelStatus = await runKernel(profile, 'status');
      if (!('endpoint' in kernelStatus)) throw new Error('Missing development kernel endpoint');
      const kernelProcessId = kernelStatus.endpoint.processId;
      const kernelInstanceId = kernelStatus.endpoint.instanceId;

      client = createKernelClient(kernelStatus.endpoint);
      await client.connect();
      const activeClient = client;
      const project = await activeClient.call('project.create', {
        path: projectPath,
      });
      await activeClient.call('project.grant', {
        projectId: project.id,
        trust: 'trusted',
        autoBackup: false,
      });
      await activeClient.call('files.save', {
        projectId: project.id,
        path: 'evidence.md',
        content: 'Saved project evidence 73.\n',
      });
      await activeClient.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      const title = `Saved development source ${ownerExit}`;
      const batch = await activeClient.call('library.ingest', {
        batchId: randomUUID(),
        json: JSON.stringify([{ title, DOI: `10.7300/${ownerExit.toLowerCase()}` }]),
        version: 'published',
        origin: 'synthetic',
      });
      await expect
        .poll(
          async () => (await activeClient.call('library.batch', { batchId: batch.id })).batch.state,
        )
        .toBe('completed');

      const session = await activeClient.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      model.hold = true;
      const accepted = await activeClient.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT held while the development owner exits',
        materials: [],
      });
      await expect.poll(() => model.requests.length).toBe(1);
      await expect
        .poll(() => runInstance(projectPath, accepted.runId)?.state, { timeout: 10_000 })
        .toBe('running');
      const instance = runInstance(projectPath, accepted.runId);
      assert(instance?.processId);
      const agentProcessId = instance.processId;
      expect(instance.processId).not.toBe(kernelProcessId);
      expect(isAlive(kernelProcessId)).toBe(true);
      expect(isAlive(instance.processId)).toBe(true);

      const ownerExitEvent = once(owner, 'exit');
      if (ownerExit === 'dispose') owner.send('dispose');
      else owner.kill('SIGKILL');
      await ownerExitEvent;
      await expect.poll(() => isAlive(kernelProcessId), { timeout: 15_000 }).toBe(false);
      await expect.poll(() => isAlive(agentProcessId), { timeout: 15_000 }).toBe(false);
      await kernelExit;
      expect((await runKernel(profile, 'status')).state).toBe('stopped');
      expect(model.requests).toHaveLength(1);
      client.dispose();
      client = undefined;

      kernel = await startKernel(profile, model.url);
      owner = await startOwner(profile);
      const reopened = await runKernel(profile, 'status');
      if (!('endpoint' in reopened)) throw new Error('Missing reopened kernel endpoint');
      expect(reopened.endpoint.instanceId).not.toBe(kernelInstanceId);
      client = createKernelClient(reopened.endpoint);
      await client.connect();
      const reopenedClient = client;
      const snapshot = await reopenedClient.call('workbench.snapshot', scope);
      expect(snapshot.run).toMatchObject({
        id: accepted.runId,
        state: 'interrupted',
        remoteOutcome: 'unknown',
      });
      expect(
        (await reopenedClient.call('files.read', { projectId: project.id, path: 'evidence.md' }))
          .content,
      ).toBe('Saved project evidence 73.\n');
      expect(await readFile(join(projectPath, 'evidence.md'), 'utf8')).toBe(
        'Saved project evidence 73.\n',
      );
      expect(
        (await reopenedClient.call('library.list', { query: title })).sources[0]?.metadata.title,
      ).toBe(title);
      expect(model.requests).toHaveLength(1);
    } finally {
      client?.dispose();
      if (owner && owner.exitCode === null && owner.signalCode === null) {
        const exited = once(owner, 'exit');
        owner.kill('SIGKILL');
        await exited;
      }
      if (kernel && kernel.exitCode === null && kernel.signalCode === null) {
        const stopped = await runKernel(profile, 'stop');
        if (stopped.state !== 'stopped') {
          const exited = once(kernel, 'exit');
          kernel.kill('SIGKILL');
          await exited;
        }
      }
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
