import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { ContextItem, ResourceDescriptor } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

async function materials(app: KernelApplication, root: string) {
  const project = await app.call('project.create', {
    path: join(root, 'target'),
    trust: 'trusted',
  });
  await app.call('files.save', {
    projectId: project.id,
    path: 'input.txt',
    content: 'project_original_73',
  });
  const file = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'input.txt' },
  });
  await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const path = join(root, 'library.txt');
  await writeFile(path, 'library_original_91');
  const batch = await app.call('library.importFiles', {
    batchId: randomUUID(),
    paths: [path],
    storage: 'managed',
    purpose: '正文',
    version: 'unspecified',
    origin: 'context-resource-test',
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const entry = (await app.call('library.batch', { batchId: batch.id })).entries[0];
  assert(entry?.attachmentId);
  const attachment = await app.call('library.attachment', { attachmentId: entry.attachmentId });
  const library = await app.call('resources.describe', {
    locator: {
      source: 'library',
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    },
  });
  return { project, file, library };
}

const excerpt = (resource: ResourceDescriptor, quote: string): ContextItem => ({
  kind: 'text',
  itemId: randomUUID(),
  ref: resource.ref,
  basis: resource.basis,
  quote,
  contentState: 'saved',
  comment: 'Explicit excerpt is not a full resource read.',
});

test('production context queries and explicit items use real project/library resources and preserve old basis on reread', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-real-context-'));
  let phase = 'first';
  let resources: Awaited<ReturnType<typeof materials>>;
  let updateSelection = () => {};
  const model = await createModelServer({
    respond: ({ calls }) => {
      const reads = calls.filter((name) => name === 'read_context_resource').length;
      const context = calls.filter((name) => name === 'read_workbench_context').length;
      if (phase === 'first') {
        if (!context) {
          updateSelection();
          return { tool: { name: 'read_workbench_context', input: {} } };
        }
        if (reads < 2) {
          const resource = reads === 0 ? resources.file : resources.library;
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: resource.ref, basis: resource.basis, encoding: 'utf8', limit: 128 },
            },
          };
        }
      } else if (reads < 3)
        return {
          tool: {
            name: 'read_context_resource',
            input: { ref: resources.file.ref, basis: resources.file.basis, encoding: 'utf8' },
          },
        };
      return { text: 'Checked explicit excerpts and current resource evidence.' };
    },
  });
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(join(root, 'profile'), options);
  await app.initialize();
  const product = app.connectProduct();
  const scope = { projectId: 'application', sessionId: app.harness.create('application').id };
  try {
    resources = await materials(app, root);
    const fileItem = excerpt(resources.file, 'attached_project_excerpt_73');
    const libraryItem = excerpt(resources.library, 'attached_library_excerpt_91');
    await product.call('workbench.context.publish', {
      snapshot: {
        revision: 1,
        receiver: scope,
        viewId: 'at-send',
        selectedItems: [],
        selections: [fileItem],
      },
    });
    updateSelection = () => {
      const source = app.workbenchContexts;
      const stored = app.projects
        .get('application')
        .database.prepare('SELECT value FROM messages WHERE id=?')
        .get(firstId) as { value: string };
      source.publish(JSON.parse(stored.value).source, {
        revision: 2,
        receiver: scope,
        viewId: 'at-tool',
        selectedItems: [libraryItem.itemId],
        selections: [libraryItem],
      });
    };
    const firstId = randomUUID();
    const sent = {
      ...scope,
      instructionId: firstId,
      text: 'MODEL_CHAT inspect current selection and explicitly attached materials',
      materials: [],
      contextItems: [fileItem, libraryItem],
    };
    const receipt = await product.call('session.send', sent);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const snapshot = await app.snapshot(scope);
    expect(snapshot.messages.find((message) => message.id === firstId)?.contextItems).toEqual(
      sent.contextItems,
    );
    const tools = snapshot.messages.filter((message) => message.role === 'tool');
    expect(
      JSON.parse(
        tools.find((message) => message.tool?.name === 'read_workbench_context')?.tool?.output ??
          '{}',
      ),
    ).toMatchObject({
      state: 'available',
      instructionId: firstId,
      snapshot: { viewId: 'at-tool', selections: [libraryItem] },
    });
    const reads = tools.filter((message) => message.tool?.name === 'read_context_resource');
    expect(JSON.parse(reads[0]?.tool?.output ?? '{}')).toMatchObject({
      data: 'project_original_73',
    });
    expect(JSON.parse(reads[1]?.tool?.output ?? '{}')).toMatchObject({
      data: 'library_original_91',
    });
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
      'attached_project_excerpt_73',
    );
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('project_original_73');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('library_original_91');
    const originalSource = snapshot.messages.find((message) => message.id === firstId)?.source;
    product.close();
    await app.close();
    app = new KernelApplication(join(root, 'profile'), options);
    await app.initialize();
    expect(await app.call('session.send', sent)).toEqual(receipt);
    expect(app.workbenchContexts.read(originalSource, scope)).toEqual({
      state: 'unavailable',
      reason: 'disconnected',
    });
    const currentFile = await app.call('files.read', {
      projectId: resources.project.id,
      path: 'input.txt',
    });
    await app.call('files.save', {
      projectId: resources.project.id,
      path: 'input.txt',
      content: 'project_revised_74',
      basis: currentFile.basis,
    });
    phase = 'changed';
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT recheck historical version',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const last = (await app.snapshot(scope)).messages
      .filter((message) => message.tool?.name === 'read_context_resource')
      .at(-1);
    expect(JSON.parse(last?.tool?.output ?? '{}')).toMatchObject({
      error: { code: 'contentChanged' },
    });
    expect(JSON.stringify(model.requests.at(-1)?.messages)).not.toContain('project_revised_74');
    expect(
      (await app.snapshot(scope)).messages.find((message) => message.id === firstId)?.contextItems,
    ).toEqual(sent.contextItems);
  } finally {
    product.close();
    await app.close();
    await model.close();
  }
});

test('final synchronous admission rechecks a library grant revoked just after asynchronous authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-final-check-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
  const source = await materials(app, root);
  const scope = { projectId: 'application', sessionId: app.harness.create('application').id };
  const execution = app.models.execution.bind(app.models);
  let checks = 0;
  app.models.execution = (authorize, signal, config, confirm) =>
    execution(
      async () => {
        await authorize?.();
        // The second completed async check is the check after waiting for a model slot.
        if (++checks === 2)
          app.library.grant({ read: true, write: true, send: false, autoBackup: false });
      },
      signal,
      config,
      confirm,
    );
  try {
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT final boundary',
      materials: [],
      contextItems: [excerpt(source.library, 'never_send_after_final_revocation')],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('failed');
    expect(checks).toBe(2);
    expect(model.requests).toHaveLength(0);
  } finally {
    await app.close();
    await model.close();
  }
});

for (const target of ['project', 'library'] as const) {
  test(`real ${target} authorization is rechecked after model admission waits and on checkpoint recovery`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-real-context-revoke-'));
    let selected: ResourceDescriptor;
    const model = await createModelServer({
      respond: ({ calls }) =>
        calls.includes('read_context_resource')
          ? { text: 'Reauthorized material was read again.' }
          : {
              tool: {
                name: 'read_context_resource',
                input: {
                  ref: selected.ref,
                  basis: selected.basis,
                  encoding: 'utf8',
                },
              },
            },
    });
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    let app = new KernelApplication(join(root, 'profile'), options);
    await app.initialize();
    const resource = await materials(app, root);
    selected = target === 'project' ? resource.file : resource.library;
    const scope = { projectId: 'application', sessionId: app.harness.create('application').id };
    const blocker = await app.models.execution();
    const lease = await blocker.acquire();
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        blocker.release(lease);
      }
    };
    const execution = app.models.execution.bind(app.models);
    let entered = false;
    app.models.execution = async (...args) => {
      const value = await execution(...args);
      return {
        ...value,
        acquire: async () => {
          entered = true;
          return value.acquire();
        },
      };
    };
    const grant = async (allowed: boolean) => {
      if (target === 'project')
        await app.call('project.grant', {
          projectId: resource.project.id,
          trust: allowed ? 'trusted' : 'restricted',
          autoBackup: false,
        });
      else
        await app.call('library.grant', {
          read: true,
          write: true,
          send: allowed,
          autoBackup: false,
        });
    };
    try {
      const item = excerpt(selected, `private_${target}_excerpt`);
      const input = {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT explicit material',
        materials: [],
        contextItems: [item],
      };
      await app.call('session.send', input);
      await expect.poll(() => entered).toBe(true);
      await expect
        .poll(
          async () =>
            (await app.snapshot(scope)).messages.find(
              (message) => message.id === input.instructionId,
            )?.state,
        )
        .toBe('consumed');
      await grant(false);
      release();
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(0);
      await app.close();
      app = new KernelApplication(join(root, 'profile'), options);
      await app.initialize();
      // A plain new instruction cannot bypass authorization for an excerpt retained in checkpoint.
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT continue without new attachments',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(0);
      await grant(true);
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT authorized continuation',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
        `private_${target}_excerpt`,
      );
      const read = (await app.snapshot(scope)).messages.find(
        (message) => message.tool?.name === 'read_context_resource',
      );
      expect(JSON.parse(read?.tool?.output ?? '{}')).toMatchObject({
        data: target === 'project' ? 'project_original_73' : 'library_original_91',
      });
      expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
        target === 'project' ? 'project_original_73' : 'library_original_91',
      );
    } finally {
      release();
      await app.close();
      await model.close();
    }
  });
}
