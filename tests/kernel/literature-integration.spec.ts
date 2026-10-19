import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

test('shared clients observe the same persistent library and model tools respect separate send grants', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-rpc-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: root,
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  const other = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    await client.connect();
    await other.connect();
    await other.call('workbench.watch', {});
    let changes = 0;
    other.subscribeChanges((change) => {
      if (change.libraryChanged) changes++;
    });
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const input = {
      batchId: randomUUID(),
      json: JSON.stringify([{ title: 'RPC样本', DOI: '10.1234/rpc' }, { title: '' }]),
      version: 'published',
      origin: 'synthetic',
    };
    const batch = await client.call('library.ingest', input);
    await expect
      .poll(async () => (await other.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    await expect.poll(() => changes).toBeGreaterThan(0);
    expect((await other.call('library.list', {})).sources[0]?.metadata.title).toBe('RPC样本');
    expect((await client.call('library.batch', { batchId: batch.id })).batch.failed).toBe(1);
    const session = await client.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    await client.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_LIBRARY',
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state)
      .toBe('completed');
    expect(
      (await client.call('workbench.snapshot', scope)).messages.find(
        (message) => message.tool?.name === 'library_ingest',
      )?.state,
    ).toBe('error');
    expect((await client.call('library.list', { query: 'Agent合成' })).sources).toEqual([]);
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const next = await client.call('session.create', { projectId: 'application' });
    const nextScope = { projectId: 'application', sessionId: next.id };
    await client.call('session.send', {
      ...nextScope,
      instructionId: randomUUID(),
      text: 'MODEL_LIBRARY',
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', nextScope)).run?.state)
      .toBe('completed');
    await expect
      .poll(async () => (await other.call('library.list', { query: 'Agent合成' })).sources.length)
      .toBe(1);
    expect(
      (await client.call('workbench.snapshot', nextScope)).messages.find(
        (message) => message.tool?.name === 'library_ingest',
      )?.state,
    ).toBe('complete');
    const requests = model.requests.length;
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await client.call('session.send', {
      ...nextScope,
      instructionId: randomUUID(),
      text: '核对文献后接续',
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', nextScope)).run?.state)
      .toBe('failed');
    expect(model.requests).toHaveLength(requests);
  } finally {
    client.dispose();
    other.dispose();
    await server.stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a terminated batch retains committed source identities and only pending items resume', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-crash-'));
  const module = fileURLToPath(new URL('../../packages/library/dist/node.js', import.meta.url));
  const source = `import {LiteratureCatalog} from ${JSON.stringify(module)};
    const catalog=new LiteratureCatalog(process.argv[1],()=>{});await catalog.initialize();
    catalog.grant({read:true,write:true,send:false,autoBackup:false});
    const receipt=catalog.ingest({batchId:'crash-batch',json:JSON.stringify(Array.from({length:1000},(_,i)=>({title:'Crash '+i}))),version:'unspecified',origin:'synthetic'});
    process.send({id:receipt.id});setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source, root], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  try {
    const [receipt] = await once(child, 'message');
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    const catalog = new LiteratureCatalog(root, () => {});
    try {
      await catalog.initialize();
      const before = catalog.batch({ batchId: receipt.id });
      expect(['interrupted', 'completed']).toContain(before.batch.state);
      const confirmed = before.entries.filter((e) => e.sourceId).map((e) => e.sourceId);
      catalog.resume(receipt.id);
      await expect
        .poll(() => catalog.batch({ batchId: receipt.id }).batch.state, { timeout: 15000 })
        .toBe('completed');
      expect(catalog.batch({ batchId: receipt.id }).batch).toMatchObject({
        processed: 1000,
        failed: 0,
      });
      expect(
        catalog
          .batch({ batchId: receipt.id })
          .entries.filter((e) => confirmed.includes(e.sourceId))
          .map((e) => e.sourceId),
      ).toEqual(confirmed);
      let total = 0,
        offset = 0;
      for (;;) {
        const page = catalog.list({ offset, limit: 100 });
        total += page.sources.length;
        if (page.nextOffset === undefined) break;
        offset = page.nextOffset;
      }
      expect(total).toBe(1000);
    } finally {
      await catalog.close();
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    await rm(root, { recursive: true });
  }
});
