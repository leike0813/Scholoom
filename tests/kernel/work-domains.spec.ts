import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

type Store = ReturnType<KernelApplication['projects']['get']>;

function logicalDatabase(store: Store): Record<string, string[]> {
  const tables = store.database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>;
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      (store.database.prepare(`SELECT * FROM "${name}"`).all() as Array<Record<string, unknown>>)
        .map((row) => JSON.stringify(row))
        .sort(),
    ]),
  );
}

async function files(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.scholoom') continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile())
        result[relative(root, absolute)] = (await readFile(absolute)).toString('base64');
    }
  };
  await walk(root);
  return result;
}

async function snapshot(store: Store) {
  return { database: logicalDatabase(store), files: await files(store.project.path) };
}

function output(message: { tool?: { output?: string } } | undefined): unknown {
  assert(message?.tool?.output);
  return JSON.parse(message.tool.output);
}

test('a global session reads trusted registered targets while target and application writes stay denied', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-work-domain-read-'));
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      if (!user.includes('MODEL_WORK_DOMAIN_READ')) return undefined;
      if (!calls.includes('read_work_domain'))
        return { tool: { name: 'read_work_domain', input: {} } };
      const reads = calls.filter((name) => name === 'read_target_project').length;
      if (reads === 0)
        return {
          tool: {
            name: 'read_target_project',
            input: { targetProjectId: trusted.project.id, request: { kind: 'list', limit: 100 } },
          },
        };
      if (reads === 1)
        return {
          tool: {
            name: 'read_target_project',
            input: {
              targetProjectId: trusted.project.id,
              request: {
                kind: 'readText',
                fileId: registered.fileId,
                basis: registered.basis,
                limit: 4096,
              },
            },
          },
        };
      if (reads === 2)
        return {
          tool: {
            name: 'read_target_project',
            input: {
              targetProjectId: restricted.project.id,
              request: { kind: 'list', limit: 100 },
            },
          },
        };
      if (reads === 3)
        return {
          tool: {
            name: 'read_target_project',
            input: {
              targetProjectId: restricted.project.id,
              request: {
                kind: 'readText',
                fileId: restrictedFile.fileId,
                basis: restrictedFile.basis,
                limit: 4096,
              },
            },
          },
        };
      if (reads === 4)
        return {
          tool: {
            name: 'read_target_project',
            input: {
              targetProjectId: trusted.project.id,
              request: { kind: 'describe', fileId: 'not-registered', basis: 'none' },
            },
          },
        };
      if (!calls.includes('write_file'))
        return {
          tool: { name: 'write_file', input: { file_path: '/target-notes.md', content: 'write' } },
        };
      return { text: '目标读取与拒写已核查。' };
    },
  });
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let trusted!: Store;
  let restricted!: Store;
  let registered!: { fileId: string; basis: string };
  let restrictedFile!: { fileId: string; basis: string };
  try {
    await app.initialize();
    trusted = await app.projects.create(join(root, 'trusted'));
    trusted.grant({ trust: 'trusted', autoBackup: false });
    await trusted.save('notes.md', 'trusted evidence 42');
    await writeFile(join(root, 'trusted', 'unlisted.md'), 'unregistered evidence');
    restricted = await app.projects.create(join(root, 'restricted'));
    restricted.grant({ trust: 'restricted', autoBackup: false });
    await restricted.save('secret.md', 'restricted secret');
    registered = await trusted.material('notes.md');
    restrictedFile = await restricted.material('secret.md');
    const before = await snapshot(trusted);
    const restrictedBefore = await snapshot(restricted);
    const session = await app.call('session.create', { projectId: 'application' });
    await app.call('session.send', {
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_WORK_DOMAIN_READ controlled target scope',
      materials: [],
    });
    const scope = { projectId: 'application', sessionId: session.id };
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const messages = (await app.snapshot(scope)).messages;
    expect(output(messages.find((message) => message.tool?.name === 'read_work_domain'))).toEqual({
      kind: 'application',
      projectId: 'application',
      sessionId: session.id,
    });
    const targetTools = messages.filter((message) => message.tool?.name === 'read_target_project');
    expect(targetTools).toHaveLength(5);
    expect(output(targetTools[0])).toMatchObject({ kind: 'list', entries: [{ path: 'notes.md' }] });
    expect(output(targetTools[1])).toMatchObject({ content: 'trusted evidence 42' });
    for (const denied of targetTools.slice(2, 4)) {
      expect(denied.state).toBe('error');
      expect(output(denied)).toMatchObject({ error: { code: 'permissionDenied' } });
    }
    expect(targetTools[4]?.state).toBe('error');
    expect(output(targetTools[4])).toMatchObject({ error: { code: 'unavailable' } });
    const write = messages.find((message) => message.tool?.name === 'write_file');
    expect(write?.state).toBe('error');
    expect(write?.tool?.output).toContain('permissionDenied');
    expect(await snapshot(trusted)).toEqual(before);
    expect(await snapshot(restricted)).toEqual(restrictedBefore);
    await expect(
      readFile(join(app.projects.get('application').project.path, 'target-notes.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    trusted.grant({ trust: 'restricted', autoBackup: false });
    const requests = model.requests.length;
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '继续核查已读依据',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
    expect(model.requests).toHaveLength(requests);
    expect(await readFile(join(trusted.project.path, 'notes.md'), 'utf8')).toBe(
      'trusted evidence 42',
    );
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('two global sessions keep the same scratch filename private and cannot read another scratch path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-work-domain-scratch-'));
  let otherPath = '';
  let otherScratch = '';
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      if (user.includes('MODEL_SCRATCH_ALPHA')) {
        if (!calls.includes('write_file'))
          return {
            tool: {
              name: 'write_file',
              input: { file_path: '/large_tool_results/context.md', content: 'alpha-private-73' },
            },
          };
        return { text: 'alpha 已保存。' };
      }
      if (!user.includes('MODEL_SCRATCH_BETA')) return undefined;
      if (!calls.includes('write_file'))
        return {
          tool: {
            name: 'write_file',
            input: { file_path: '/large_tool_results/context.md', content: 'beta-private-73' },
          },
        };
      const reads = calls.filter((name) => name === 'read_file').length;
      if (reads === 0)
        return {
          tool: { name: 'read_file', input: { file_path: '/large_tool_results/context.md' } },
        };
      if (reads === 1) return { tool: { name: 'read_file', input: { file_path: otherPath } } };
      return { text: 'beta 已核查。' };
    },
  });
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const application = app.projects.get('application');
    const alpha = await app.call('session.create', { projectId: 'application' });
    const beta = await app.call('session.create', { projectId: 'application' });
    otherScratch = join(application.internal, 'harness', 'sessions', alpha.id, 'scratch');
    otherPath = join(otherScratch, 'context.md');
    const send = (sessionId: string, text: string) =>
      app.call('session.send', {
        projectId: 'application',
        sessionId,
        instructionId: randomUUID(),
        text,
        materials: [],
      });
    const alphaScope = { projectId: 'application', sessionId: alpha.id };
    const betaScope = { projectId: 'application', sessionId: beta.id };
    await send(alpha.id, 'MODEL_SCRATCH_ALPHA');
    await expect.poll(async () => (await app.snapshot(alphaScope)).run?.state).toBe('completed');
    await send(beta.id, 'MODEL_SCRATCH_BETA');
    await expect.poll(async () => (await app.snapshot(betaScope)).run?.state).toBe('completed');
    const betaScratch = join(application.internal, 'harness', 'sessions', beta.id, 'scratch');
    expect(await readFile(join(otherScratch, 'context.md'), 'utf8')).toBe('alpha-private-73');
    expect(await readFile(join(betaScratch, 'context.md'), 'utf8')).toBe('beta-private-73');
    const reads = (await app.snapshot(betaScope)).messages.filter(
      (message) => message.tool?.name === 'read_file',
    );
    expect(reads).toHaveLength(2);
    expect(reads[0]?.tool?.output).toContain('beta-private-73');
    expect(reads[1]?.state).toBe('error');
    expect(reads[1]?.tool?.output).toContain('permissionDenied');
    expect(reads[1]?.tool?.output).not.toContain('alpha-private-73');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
