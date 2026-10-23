import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { InstructionSaver, openCheckpoint } from '../../packages/harness/dist/node.js';
import {
  type ContextItem,
  protocolVersion,
  type ResourceDescriptor,
} from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

for (const associationFailure of [false, true]) {
  test(`global context, live socket selection and explicit graph delivery share real resource authority (associationFailure=${associationFailure})`, async () => {
    test.setTimeout(120000);
    const root = await mkdtemp(join(tmpdir(), 'scholoom-final-context-'));
    let resources: ResourceDescriptor[] = [];
    const model = await createModelServer({
      respond: ({ calls, user }) => {
        if (!user.includes('FINAL_GLOBAL')) return { text: 'Graph materials received.' };
        const contexts = calls.filter((name) => name === 'read_workbench_context').length;
        const reads = calls.filter((name) => name === 'read_context_resource').length;
        if (!contexts) return { tool: { name: 'read_workbench_context', input: {} } };
        if (reads < resources.length) {
          const resource = resources[reads];
          assert(resource);
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: resource.ref, basis: resource.basis, encoding: 'utf8' },
            },
          };
        }
        if (!calls.includes('write_file')) {
          model.hold = true;
          return {
            tool: {
              name: 'write_file',
              input: { file_path: '/forbidden.md', content: 'must not write' },
            },
          };
        }
        if (contexts === 1) return { tool: { name: 'read_workbench_context', input: {} } };
        return { text: 'Read evidence, denied write and disconnected source inspected.' };
      },
    });
    model.hold = true;
    // @ts-expect-error Source-only host/worker registration, excluded from production.
    const { modelGraphs } = await import('../fixtures/domain-execution-worker/worker-model.mjs');
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
      executionGraphs: modelGraphs,
      workerEntry: new URL('../fixtures/domain-execution-worker/worker-model.mjs', import.meta.url),
    });
    await app.initialize();
    const status = {
      protocolVersion,
      nodeVersion: process.versions.node,
      processId: process.pid,
      instanceId: randomUUID(),
      dataDirectory: join(root, 'profile'),
      startedAt: new Date().toISOString(),
      state: 'running' as const,
    };
    const server = await startKernelServer(status, () => app.close(), app);
    const endpoint = { ...status, url: server.url, token: server.token };
    const source = createKernelClient(endpoint);
    const observer = createKernelClient(endpoint);
    try {
      await source.connect();
      await observer.connect();
      const project = await observer.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      await observer.call('files.save', {
        projectId: project.id,
        path: 'input.txt',
        content: 'final_project_evidence_73',
      });
      const file = await observer.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: 'input.txt' },
      });
      await observer.call('library.grant', {
        read: true,
        write: true,
        send: true,
        autoBackup: false,
      });
      const libraryPath = join(root, 'library.txt');
      await writeFile(libraryPath, 'final_library_evidence_91');
      const batch = await observer.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [libraryPath],
        storage: 'managed',
        purpose: '正文',
        version: 'unspecified',
        origin: 'final-combination',
      });
      await expect
        .poll(async () => (await observer.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const entry = (await observer.call('library.batch', { batchId: batch.id })).entries[0];
      assert(entry?.attachmentId);
      const attachment = await observer.call('library.attachment', {
        attachmentId: entry.attachmentId,
      });
      const library = await observer.call('resources.describe', {
        locator: {
          source: 'library',
          attachmentId: attachment.id,
          materialVersionId: attachment.materialVersionId,
        },
      });
      resources = [file, library];
      const contextItems: ContextItem[] = resources.map((resource, index) => ({
        kind: 'text',
        itemId: randomUUID(),
        ref: resource.ref,
        basis: resource.basis,
        quote: `final_explicit_excerpt_${index}`,
        contentState: 'saved',
      }));
      const [fileItem, libraryItem] = contextItems;
      assert(fileItem && libraryItem);
      const session = await observer.call('session.create', { projectId: 'application' });
      const scope = { projectId: 'application', sessionId: session.id };
      await source.call('workbench.context.publish', {
        snapshot: {
          revision: 1,
          receiver: scope,
          viewId: 'send-project',
          selectedItems: [fileItem.itemId],
          selections: [fileItem],
        },
      });
      const input = {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT FINAL_GLOBAL inspect project and library',
        materials: [],
        contextItems,
      };
      const receipt = await source.call('session.send', input);
      await expect.poll(() => model.requests.length).toBe(1);
      await source.call('workbench.context.publish', {
        snapshot: {
          revision: 2,
          receiver: scope,
          viewId: 'tool-library',
          selectedItems: [libraryItem.itemId],
          selections: [libraryItem],
        },
      });
      model.release();
      await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(5);
      source.dispose();
      const original = (await app.snapshot(scope)).messages.find(
        (message) => message.id === input.instructionId,
      );
      assert(original?.source);
      await expect
        .poll(() => app.workbenchContexts.read(original.source, scope))
        .toMatchObject({ state: 'unavailable', reason: 'disconnected' });
      model.release();
      await expect
        .poll(async () => (await observer.call('workbench.snapshot', scope)).run?.state, {
          timeout: 20000,
        })
        .toBe('completed');
      const snapshot = await observer.call('workbench.snapshot', scope);
      const tools = snapshot.messages.filter((message) => message.role === 'tool');
      const contexts = tools.filter((message) => message.tool?.name === 'read_workbench_context');
      expect(JSON.parse(contexts[0]?.tool?.output ?? '{}')).toMatchObject({
        state: 'available',
        snapshot: { viewId: 'tool-library', selections: [contextItems[1]] },
      });
      expect(JSON.parse(contexts[1]?.tool?.output ?? '{}')).toMatchObject({
        state: 'unavailable',
        reason: 'disconnected',
      });
      expect(
        tools
          .filter((message) => message.tool?.name === 'read_context_resource')
          .map((message) => JSON.parse(message.tool?.output ?? '{}').data),
      ).toEqual(['final_project_evidence_73', 'final_library_evidence_91']);
      expect(tools.find((message) => message.tool?.name === 'write_file')?.tool?.output).toContain(
        'permissionDenied',
      );
      for (const path of [project.path, app.projects.get('application').project.path])
        await expect(stat(join(path, 'forbidden.md'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await observer.call('session.send', input)).toEqual(receipt);
      await expect(
        observer.call('session.send', { ...input, contextItems: [] }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      expect(
        snapshot.messages.find((message) => message.id === input.instructionId)?.contextItems,
      ).toEqual(contextItems);

      const graphSession = await observer.call('session.create', { projectId: project.id });
      const graphScope = { projectId: project.id, sessionId: graphSession.id };
      if (associationFailure)
        app.projects
          .get(project.id)
          .database.exec(
            "CREATE TRIGGER reject_final_association BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic association failure'); END",
          );
      await app.startGraph({
        ...graphScope,
        instructionId: randomUUID(),
        text: 'Save source evidence and wait.',
        execution: {
          kind: 'registered',
          graphId: 'durable-resource',
          version: '1',
          config: { outputPath: 'result.md', operationId: 'final-result' },
          materials: [{ ref: file.ref, basis: file.basis }],
          workDomain: { kind: 'project', ...graphScope },
        },
      });
      await expect
        .poll(async () => (await app.snapshot(graphScope)).run?.state, { timeout: 20000 })
        .toBe('waiting');
      const graphInput = {
        ...graphScope,
        instructionId: randomUUID(),
        text: '{"approve":true}',
        materials: [],
        contextItems,
      };
      const graphReceipt = await observer.call('session.send', graphInput);
      await expect
        .poll(async () => (await app.snapshot(graphScope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      const final = await observer.call('workbench.snapshot', graphScope);
      const graphMessage = final.messages.find(
        (message) => message.id === graphInput.instructionId,
      );
      assert(graphMessage?.source);
      expect(graphMessage.state).toBe('consumed');
      const { projectId: _project, sessionId: _session, ...payload } = graphInput;
      const expected = { ...payload, source: graphMessage.source };
      const result = JSON.parse(await readFile(join(project.path, 'result.md.context.md'), 'utf8'));
      expect(result.instructions).toEqual([expected]);
      expect(result.reads.map((item: { data: string }) => item.data)).toEqual([
        'final_project_evidence_73',
        'final_library_evidence_91',
      ]);
      const opened = await openCheckpoint(
        app.projects.get(project.id).internal,
        graphReceipt.runId,
      );
      try {
        const saved = await new InstructionSaver(opened.database, async () => {}).getTuple({
          configurable: { thread_id: graphReceipt.runId },
        });
        expect(saved?.checkpoint.channel_values.instructions).toEqual([expected]);
      } finally {
        opened.database.close();
      }
      const creation = await observer.call('resources.creation', {
        projectId: project.id,
        operationId: 'final-result-context',
      });
      expect(creation).toMatchObject({
        state: 'complete',
        association: { state: associationFailure ? 'unknown' : 'confirmed' },
      });
      assert(creation.state === 'complete');
      expect(
        await observer.call('resources.read', {
          ref: creation.resource.ref,
          basis: creation.resource.basis,
          encoding: 'utf8',
        }),
      ).toMatchObject({ data: JSON.stringify(result) });
      expect(final.run?.graphProgress?.kind).toBe('graph.completed');
      if (associationFailure) {
        assert(final.run?.graphProgress?.kind === 'graph.completed');
        expect(final.run.graphProgress.evidence.creations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              state: 'complete',
              association: expect.objectContaining({ state: 'unknown' }),
            }),
          ]),
        );
        const identity = await stat(join(project.path, 'result.md.context.md'), { bigint: true });
        app.projects.get(project.id).database.exec('DROP TRIGGER reject_final_association');
        const reconciled = await observer.call('resources.creation', {
          projectId: project.id,
          operationId: 'final-result-context',
        });
        expect(reconciled).toMatchObject({
          state: 'complete',
          resource: creation.resource,
          association: { state: 'confirmed' },
        });
        expect((await stat(join(project.path, 'result.md.context.md'), { bigint: true })).ino).toBe(
          identity.ino,
        );
      }
      expect(await observer.call('session.send', graphInput)).toEqual(graphReceipt);
      expect(app.projects.get(project.id).history('result.md.context.md')).toHaveLength(1);
      expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
        'final_library_evidence_91',
      );
      await test.info().attach('combination-evidence', {
        body: JSON.stringify(
          { root, globalRun: receipt.runId, graphRun: graphReceipt.runId, result: creation },
          null,
          2,
        ),
        contentType: 'application/json',
      });
    } finally {
      source.dispose();
      observer.dispose();
      model.release();
      await server.stop();
      await model.close();
    }
  });
}
