import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { checkUnchanged, loadHostSettings } from '../../apps/kernel/dist/host-settings.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import {
  type BusinessMethod,
  type BusinessResult,
  validateBusiness,
} from '../../packages/protocol/dist/index.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { cliPath, runKernel } from '../kernel-fixture.js';
import { createModelServer } from '../model-server.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

const execute = promisify(execFile);

function hostSettings(kernelDirectory: string, libraryId: string) {
  return {
    version: 1,
    kernelDirectory,
    zotero: {
      enabled: true,
      scope: 'isolated-library-journals',
      libraryId,
      resourceId: 'journals-local-v1',
      resources: [{ id: 'journals-local-v1', layout: 'linux-x64-electron-managed-v1' }],
    },
  };
}

test('private Zotero settings reject unsafe or stale input without defaulting to an active binding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-host-settings-'));
  const filename = join(root, 'host-settings.json');
  expect((await loadHostSettings(root)).state).toBe('disabled');
  const valid = hostSettings(await realpath(root), randomUUID());
  await writeFile(filename, JSON.stringify(valid), { mode: 0o600 });
  const snapshot = await loadHostSettings(root);
  assert(snapshot.state === 'loaded');
  await checkUnchanged(snapshot);
  for (const value of [
    { ...valid, version: 2 },
    { ...valid, kernelDirectory: join(root, 'other') },
    { ...valid, executable: process.execPath },
    { ...valid, zotero: { ...valid.zotero, resourceId: 'missing' } },
    {
      ...valid,
      zotero: { ...valid.zotero, resources: [{ ...valid.zotero.resources[0], root: root }] },
    },
  ]) {
    await writeFile(filename, JSON.stringify(value));
    expect((await loadHostSettings(root)).state).toBe('invalid');
    await expect(checkUnchanged(snapshot)).rejects.toMatchObject({ code: 'unavailable' });
  }
  for (const bytes of ['{bad-json', ' '.repeat(16385)]) {
    await writeFile(filename, bytes);
    expect((await loadHostSettings(root)).state).toBe('invalid');
    expect(await readFile(filename, 'utf8')).toBe(bytes);
  }
  await writeFile(filename, JSON.stringify({ ...valid, zotero: { enabled: false } }));
  expect((await loadHostSettings(root)).state).toBe('disabled');
  if (process.platform !== 'win32') {
    await writeFile(filename, JSON.stringify(valid));
    await chmod(filename, 0o644);
    expect((await loadHostSettings(root)).state).toBe('invalid');
    const linked = join(root, 'linked');
    await mkdir(linked);
    await symlink(filename, join(linked, 'host-settings.json'));
    expect((await loadHostSettings(linked)).state).toBe('invalid');
  }
});

test('ordinary cold start binds Zotero originals from private settings and reloads only after stop/start', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-zotero-cold-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: root });
  const app = new KernelApplication(root);
  let prepared = true;
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const libraryId = (await app.call('library.status', {})).id;
    const batch = await app.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: 'Saved CSL' }]),
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const source = (await app.call('library.list', {})).sources[0];
    assert(source);
    const instance = await app.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: 'Synthetic cold-start source',
    });
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: 'COLD0001' },
      schemaVersion: '44',
      itemType: 'journalArticle',
      fields: { title: 'Original before cold start', date: '2026', extra: 'Retained' },
      creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Chen' }],
      relations: {},
    };
    await app.call('library.commitRecords', {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: source.id,
          revision: source.revision,
          original,
          key: { value: 'Cold2026', pinned: true, intent: 'explicit' },
        },
      ],
    });
    let before = await app.call('library.record', { libraryId, sourceId: source.id });
    await app.close();
    prepared = false;
    const settings = hostSettings(await realpath(root), libraryId);
    await writeFile(join(root, 'host-settings.json'), JSON.stringify(settings), { mode: 0o600 });
    const accepted = new KernelApplication(root, {
      zoteroRuntime: { kernelInstanceId: randomUUID(), settings: await loadHostSettings(root) },
    });
    await accepted.initialize();
    let changed = false;
    const detach = accepted.subscribe((change) => {
      if (!changed && change.libraryChanged) {
        changed = true;
        writeFileSync(
          join(root, 'host-settings.json'),
          JSON.stringify({ ...settings, zotero: { enabled: false } }),
        );
      }
    });
    const ordinaryOriginal = {
      ...original,
      fields: { ...original.fields, title: 'Accepted original title' },
    };
    try {
      const result = await accepted.call('zotero.replaceTitle', {
        libraryId,
        requestId: randomUUID(),
        sourceId: source.id,
        revision: before.revision,
        identity: original.identity,
        title: ordinaryOriginal.fields.title,
      });
      expect(result.state).toBe('committed');
      expect(changed).toBe(true);
      before = await accepted.call('library.record', { libraryId, sourceId: source.id });
      expect(before.originals).toEqual([ordinaryOriginal]);
      await expect(
        accepted.call('zotero.inspect', {
          libraryId,
          sources: [{ sourceId: source.id, revision: before.revision }],
        }),
      ).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      detach();
      await accepted.close();
    }
    // Only an offline replacement and new kernel may pick up the enabled binding again.
    await writeFile(join(root, 'host-settings.json'), JSON.stringify(settings));
    const requestId = randomUUID();
    for (const boundary of ['enabled', 'disabled']) {
      const running = await runKernel(root, 'start');
      assert(running.state === 'running', JSON.stringify(running));
      const client = createKernelClient(running.endpoint);
      try {
        await client.connect();
        const input = { libraryId, sources: [{ sourceId: source.id, revision: before.revision }] };
        if (boundary === 'enabled') {
          const { stdout } = await execute(
            process.execPath,
            [cliPath, 'zotero.inspect', '--data-dir', root, '--input', JSON.stringify(input)],
            { timeout: 20000 },
          );
          expect(JSON.parse(stdout).sources[0].original).toEqual(ordinaryOriginal);
          const receipt = await client.call('zotero.replaceTitle', {
            libraryId,
            requestId,
            sourceId: source.id,
            revision: before.revision,
            identity: original.identity,
            title: 'Explicit cold-start title',
          });
          expect(receipt.state).toBe('committed');
          const after = await client.call('library.record', { libraryId, sourceId: source.id });
          expect(after).toMatchObject({
            revision: before.revision + 1,
            citationKey: before.citationKey,
          });
          expect(after.originals).toEqual([
            { ...original, fields: { ...original.fields, title: 'Explicit cold-start title' } },
          ]);
          expect((await client.call('library.get', { sourceId: source.id })).metadata.title).toBe(
            'Saved CSL',
          );
          await writeFile(
            join(root, 'host-settings.json'),
            JSON.stringify({ ...settings, zotero: { enabled: false } }),
          );
        }
        await expect(client.call('zotero.inspect', input)).rejects.toMatchObject({
          code: 'unavailable',
        });
        expect(await client.call('zotero.result', { libraryId, requestId })).toMatchObject({
          state: 'committed',
          requestId,
        });
      } finally {
        client.dispose();
        expect((await runKernel(root, 'stop')).state).toBe('stopped');
      }
    }
  } finally {
    if (prepared) await app.close();
    expect((await runKernel(root, 'stop')).state).toBe('stopped');
  }
});

test('a private native binding for another library refuses native actions while N1 still reads the current library', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-zotero-wrong-library-'));
  await writeFile(
    join(root, 'host-settings.json'),
    JSON.stringify(hostSettings(await realpath(root), randomUUID())),
    { mode: 0o600 },
  );
  const app = new KernelApplication(root, {
    zoteroRuntime: { kernelInstanceId: randomUUID(), settings: await loadHostSettings(root) },
  });
  try {
    await app.initialize();
    const libraryId = (await app.call('library.status', {})).id;
    await expect(
      app.call('zotero.inspect', {
        libraryId,
        sources: [{ sourceId: 'not-selected', revision: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
    expect(await app.call('zotero.result', { libraryId, requestId: 'original-operation' })).toEqual(
      { requestId: 'original-operation', state: 'notFound' },
    );
  } finally {
    await app.close();
  }
});

test('ordinary CLI queries Zotero receipts without native configuration across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-cli-zotero-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: root });
  const profile = join(root, 'profile');
  const preparation = new KernelApplication(profile);
  await preparation.initialize();
  let prepared = true;
  try {
    await preparation.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    const libraryId = (await preparation.call('library.status', {})).id;
    const batch = await preparation.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: 'CLI receipt evidence' }]),
    });
    await expect
      .poll(
        async () => (await preparation.call('library.batch', { batchId: batch.id })).batch.state,
      )
      .toBe('completed');
    const source = (await preparation.call('library.list', {})).sources[0];
    assert(source);
    const instance = await preparation.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: 'Synthetic CLI source',
    });
    const request = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: source.id,
          revision: source.revision,
          original: {
            identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: 'CLI00001' },
            schemaVersion: '44',
            itemType: 'journalArticle',
            fields: { title: 'Original CLI title', date: '2026', extra: 'Preserved' },
            creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Chen' }],
            relations: {},
          },
          key: { value: 'Cli2026', pinned: true, intent: 'explicit' as const },
        },
      ],
    };
    const committed = await preparation.call('library.commitRecords', request);
    const change = request.changes[0];
    assert(change);
    expect(committed.state).toBe('committed');
    const rejected = await preparation.call('library.commitRecords', {
      ...request,
      requestId: randomUUID(),
    });
    expect(rejected).toMatchObject({ state: 'rejected', error: { code: 'contentChanged' } });
    const unknownId = randomUUID();
    let observedFailure = false;
    const detach = preparation.subscribe((change) => {
      if (!observedFailure && change.libraryChanged) {
        observedFailure = true;
        throw new Error('Synthetic lost post-commit observation');
      }
    });
    try {
      await expect(
        preparation.call('library.commitRecords', {
          libraryId,
          requestId: unknownId,
          changes: [
            {
              sourceId: source.id,
              revision: source.revision + 1,
              original: { ...change.original, fields: { title: 'Committed once' } },
            },
          ],
        }),
      ).rejects.toThrow('Synthetic lost post-commit observation');
      expect(observedFailure).toBe(true);
    } finally {
      detach();
    }
    const unknownReceipt = await preparation.call('library.commitResult', {
      libraryId,
      requestId: unknownId,
    });
    expect(unknownReceipt.state).toBe('committed');
    const record = await preparation.call('library.record', { libraryId, sourceId: source.id });
    expect(record.revision).toBe(source.revision + 2);
    const status = await preparation.call('library.status', {});
    await preparation.close();
    prepared = false;

    const query = async (requestId: string) => {
      const { stdout } = await execute(
        process.execPath,
        [
          cliPath,
          'zotero.result',
          '--data-dir',
          profile,
          '--input',
          JSON.stringify({ libraryId, requestId }),
        ],
        { timeout: 20_000 },
      );
      const result: unknown = JSON.parse(stdout);
      assert(validateBusiness('zotero.result', 'result', result));
      return result;
    };
    const missingId = randomUUID();
    const instances = new Set<string>();
    for (const boundary of ['start', 'restart']) {
      const running = await runKernel(profile, 'start');
      assert(running.state === 'running', JSON.stringify(running));
      instances.add(running.endpoint.instanceId);
      const client = createKernelClient(running.endpoint);
      try {
        await client.connect();
        for (const receipt of [committed, rejected, unknownReceipt])
          expect(await query(receipt.requestId)).toEqual(receipt);
        expect(await query(missingId)).toEqual({ requestId: missingId, state: 'notFound' });
        expect(await client.call('library.record', { libraryId, sourceId: source.id })).toEqual(
          record,
        );
        expect((await client.call('library.status', {})).revision).toBe(status.revision);
        await expect(
          client.call('zotero.result', {
            libraryId: randomUUID(),
            requestId: unknownId,
          }),
        ).rejects.toMatchObject({ code: 'instanceMismatch' });
        const selection = {
          libraryId,
          sources: [{ sourceId: source.id, revision: record.revision }],
        };
        await expect(client.call('zotero.inspect', selection)).rejects.toMatchObject({
          code: 'unavailable',
        });
        await expect(
          client.call('zotero.export', { ...selection, format: 'bibtex' }),
        ).rejects.toMatchObject({ code: 'unavailable' });
        await expect(
          client.call('zotero.fillKeys', { ...selection, operationId: randomUUID() }),
        ).rejects.toMatchObject({ code: 'unavailable' });
        await expect(
          client.call('zotero.replaceTitle', {
            libraryId,
            sourceId: source.id,
            revision: record.revision,
            requestId: randomUUID(),
            identity: change.original.identity,
            title: 'Refused',
          }),
        ).rejects.toMatchObject({ code: 'unavailable' });
        if (boundary === 'restart') {
          await client.call('library.grant', {
            read: false,
            write: false,
            send: false,
            autoBackup: false,
          });
          await expect(
            client.call('zotero.result', { libraryId, requestId: unknownId }),
          ).rejects.toMatchObject({ code: 'permissionDenied' });
        }
      } finally {
        client.dispose();
        expect((await runKernel(profile, 'stop')).state).toBe('stopped');
      }
    }
    expect(instances.size).toBe(2);
  } finally {
    if (prepared) await preparation.close();
    expect((await runKernel(profile, 'stop')).state).toBe('stopped');
  }
});

test('Zotero result rechecks read permission before delivering a real receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-zotero-result-recheck-'));
  const app = new KernelApplication(root);
  await app.initialize();
  try {
    await app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
    const libraryId = (await app.call('library.status', {})).id;
    const commitResult = app.library.commitResult.bind(app.library);
    // Inject only the interleaving, after the actual provider has read its stable result.
    app.library.commitResult = (input) => {
      const receipt = commitResult(input);
      app.library.grant({ read: false, write: false, send: false, autoBackup: false });
      return receipt;
    };
    await expect(
      app.call('zotero.result', { libraryId, requestId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    await app.close();
  }
});

test('Zotero result alone preserves Agent send authorization across turns and restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-zotero-result-agent-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: root });
  let input: { libraryId: string; requestId: string };
  const model = await createModelServer({
    respond: ({ calls }) =>
      calls.includes('read_zotero_result')
        ? { text: '已核查共同回执，未找到不代表可重放。' }
        : { tool: { name: 'read_zotero_result', input } },
  });
  const options = {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-result' },
  };
  let app = new KernelApplication(join(root, 'profile'), options);
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: false, send: true, autoBackup: false });
    input = { libraryId: (await app.call('library.status', {})).id, requestId: randomUUID() };
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '只查询原操作回执，不重放。',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const final = model.requests.at(-1);
    assert(final);
    expect(delegationOutput(final, 'read_zotero_result')).toEqual({
      requestId: input.requestId,
      state: 'notFound',
    });
    const requests = model.requests.length;
    await app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
    for (const boundary of ['next-turn', 'restart']) {
      if (boundary === 'restart') {
        await app.close();
        app = new KernelApplication(join(root, 'profile'), options);
        await app.initialize();
      }
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: `接续核查 ${boundary}`,
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20_000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(requests);
    }
  } finally {
    await app.close();
    await model.close();
  }
});

test('the actual CLI reads and saves through the broker and owned execution without a workbench', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-cli-runtime-'));
  const profile = join(root, 'profile');
  const projectPath = join(root, 'project');
  const model = await createModelServer();
  const packaged = process.env.SCHOOLOOM_PACKAGED_KERNEL;
  const child = fork(
    new URL('../fixtures/processes/kernel-host.mjs', import.meta.url),
    [profile, model.url, ...(packaged ? [join(packaged, 'dist/lifecycle.js')] : [])],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  const exited = once(child, 'exit');
  const command = async <M extends BusinessMethod>(
    method: M,
    ...args: string[]
  ): Promise<BusinessResult<M>> => {
    const { stdout } = await execute(
      process.execPath,
      [packaged ? join(packaged, 'dist/cli.js') : cliPath, ...args, '--data-dir', profile],
      {
        timeout: 20000,
      },
    );
    const value: unknown = JSON.parse(stdout);
    assert(validateBusiness(method, 'result', value));
    return value as BusinessResult<M>;
  };
  try {
    await expect
      .poll(async () => (await runKernel(profile, 'status')).state, { timeout: 15000 })
      .toBe('running');
    await mkdir(projectPath);
    await writeFile(join(projectPath, 'input.md'), '# CLI evidence\n\ncontrolled result 42\n');
    const project = await command('project.open', 'project-open', '--path', projectPath);
    await command('project.grant', 'project-grant', '--project', project.id, '--trust');
    const session = await command('session.create', 'session-create', '--project', project.id);
    const instructionId = randomUUID();
    const args = [
      'send',
      '--project',
      project.id,
      '--session',
      session.id,
      '--instruction-id',
      instructionId,
      '--text',
      'MODEL_FIXTURE 读取 input.md 并保存 result.md',
    ];
    const accepted = await command('session.send', ...args);
    expect(await command('session.send', ...args)).toEqual(accepted);
    await expect
      .poll(
        async () =>
          (
            await command(
              'workbench.snapshot',
              'session',
              '--project',
              project.id,
              '--session',
              session.id,
            )
          ).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    const snapshot = await command(
      'workbench.snapshot',
      'session',
      '--project',
      project.id,
      '--session',
      session.id,
    );
    expect(
      snapshot.messages.some(
        (message) => message.tool?.name === 'read_file' && message.state === 'complete',
      ),
    ).toBe(true);
    expect(snapshot.artifacts).toContainEqual(
      expect.objectContaining({ path: 'result.md', runId: accepted.runId, state: 'linked' }),
    );
    expect(await readFile(join(projectPath, 'result.md'), 'utf8')).toContain('合成样本');
    const requests = model.requests.length;
    await command(
      'workbench.snapshot',
      'session',
      '--project',
      project.id,
      '--session',
      session.id,
    );
    expect(model.requests).toHaveLength(requests);
    const running = await runKernel(profile, 'status');
    assert(running.state === 'running');
    const client = createKernelClient(running.endpoint);
    try {
      await client.connect();
      await client.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      await writeFile(join(projectPath, 'evidence.pdf'), syntheticPdf());
      const batch = await client.call('library.importProjectFiles', {
        projectId: project.id,
        batchId: randomUUID(),
        projectPaths: ['evidence.pdf'],
        purpose: 'evidence',
        version: 'unspecified',
        origin: 'cli-runtime',
      });
      await expect
        .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const entry = (await client.call('library.batch', { batchId: batch.id })).entries[0];
      assert(entry?.sourceId && entry.attachmentId);
      const attachment = (await client.call('library.attachments', { sourceId: entry.sourceId }))
        .attachments[0];
      assert(attachment);
      const material = {
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      };
      expect((await client.call('library.pdfInfo', material)).pageCount).toBe(2);
      expect(
        (await client.call('library.readPdfPage', { ...material, pageIndex: 0 })).text,
      ).toContain(PAGE_ONE_TEXT);
    } finally {
      client.dispose();
    }
  } finally {
    const stopped = await runKernel(profile, 'stop');
    if (stopped.state !== 'stopped') child.kill('SIGTERM');
    await exited;
    await model.close();
    await rm(root, { recursive: true });
  }
});
