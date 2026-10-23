// Secret isolation across the managed execution boundary: the model API key travels only through
// the restricted internal adapter, never into a child's argv or inherited environment, and never
// into public snapshots, provider status, run records or project backups. Asserted values are
// unique synthetic strings.
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';

const SYNTHETIC_KEY = `sk-synthetic-secret-scope-${randomUUID()}`;
const HOST_SECRET = `host-secret-synthetic-${randomUUID()}`;

async function filesUnder(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('owned execution process excludes the injected key and unrelated host secrets', async () => {
  const priorKey = process.env.MINIMAX_CN_API_KEY;
  const priorHostSecret = process.env.SCHOLOOM_HOST_SECRET;
  process.env.MINIMAX_CN_API_KEY = SYNTHETIC_KEY;
  process.env.SCHOLOOM_HOST_SECRET = HOST_SECRET;
  let child: ManagedNode | undefined;
  try {
    child = await ManagedNode.start({
      entry: new URL('../fixtures/processes/secret-scope.mjs', import.meta.url),
      instanceId: 'secret-scope',
      stopMs: 20,
    });
    const reply = once(child, 'message');
    await child.send({ action: 'scope' });
    const [report] = (await reply) as [{ argv: string[]; env: Record<string, string> }];
    const observed = `${report.argv.join(' ')} ${Object.entries(report.env)
      .map(([name, value]) => `${name}=${value}`)
      .join(' ')}`;
    expect(observed).not.toContain(SYNTHETIC_KEY);
    expect(observed).not.toContain(HOST_SECRET);
    // The allowlisted environment is still present, so the exclusion is deliberate.
    expect(report.env.PATH).toBeTruthy();
    for (const name of ['PATHEXT', 'COMSPEC']) {
      if (process.env[name] !== undefined) expect(report.env[name]).toBe(process.env[name]);
    }
  } finally {
    restoreEnvironment('MINIMAX_CN_API_KEY', priorKey);
    restoreEnvironment('SCHOLOOM_HOST_SECRET', priorHostSecret);
    await child?.stop();
  }
});

test('a real model turn keeps the key out of snapshots, provider status, run records and backups', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-secret-scope-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: SYNTHETIC_KEY },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT 秘密隔离样本。',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
      )
      .toBe('completed');
    // The turn used the configured credential and the controlled HTTP boundary.
    expect(model.requests.length).toBeGreaterThan(0);
    expect(JSON.stringify(await app.models.status())).not.toContain(SYNTHETIC_KEY);
    expect(
      JSON.stringify(await app.snapshot({ projectId: 'application', sessionId: session.id })),
    ).not.toContain(SYNTHETIC_KEY);
    // A fresh backup of the project, then every persisted artifact: run records, checkpoints and
    // backups all live under the isolated root.
    await app.projects.get('application').backup();
    const leaked: string[] = [];
    for (const file of await filesUnder(root)) {
      if ((await readFile(file)).includes(SYNTHETIC_KEY)) leaked.push(file);
    }
    expect(leaked).toEqual([]);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
