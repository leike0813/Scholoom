import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import type { ResourceDescriptor } from '../../packages/protocol/dist/resources.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { reportFixture } from '../fixtures/report.js';
import { createModelServer, type ModelServer } from '../model-server.js';

const dependencyPath = 'assets/data-v2.json';
const dependencyBytes = '{"doses":[10,20],"comparison":"fixed"}\n';
const tool = (name: string, input: Record<string, unknown>) => ({ tool: { name, input } });

// Read only the actual provider exchange; do not synthesize tool results or resource identities.
function toolText(model: ModelServer, name: string): string {
  type Block = {
    type: string;
    id?: string;
    name?: string;
    tool_use_id?: string;
    content?: string | { text?: string }[];
  };
  const messages = model.requests.at(-1)?.messages as { content: string | Block[] }[];
  const blocks = messages.flatMap((message) =>
    Array.isArray(message.content) ? message.content : [],
  );
  const call = blocks.findLast((block) => block.type === 'tool_use' && block.name === name);
  assert(call?.id, `Missing provider call: ${name}`);
  const result = blocks.find(
    (block) => block.type === 'tool_result' && block.tool_use_id === call.id,
  );
  assert(result?.content, `Missing provider result: ${name}`);
  return typeof result.content === 'string'
    ? result.content
    : result.content.map((block) => block.text ?? '').join('');
}

async function savedEdit(app: KernelApplication, resource: ResourceDescriptor) {
  assert(resource.ref.source === 'project');
  const scope = { projectId: resource.ref.projectId, fileId: resource.ref.fileId };
  const change = (await app.call('files.changes', scope)).changes[0];
  assert(change);
  return app.call('files.edit', { ...scope, editId: change.editId });
}

for (const conflict of [false, true]) {
  test(`ordinary worker publishes a complete multi-file report (concurrent entry change=${conflict})`, async () => {
    const root = test.info().outputPath('publication');
    await mkdir(root, { recursive: true });
    let fixture: Awaited<ReturnType<typeof reportFixture>>;
    let dependency: ResourceDescriptor | undefined;
    let published: ResourceDescriptor | undefined;
    let candidate = '';
    let readyToPublish = false;
    let releasePublication = () => {};
    const publicationReleased = new Promise<void>((resolve) => {
      releasePublication = resolve;
    });
    const model: ModelServer = await createModelServer({
      respond: async ({ calls }) => {
        switch (calls.length) {
          case 0:
            return tool('read_file', { file_path: '/report.html' });
          case 1:
            assert(toolText(model, 'read_file').includes('Fixed dose comparison'));
            return tool('write_file', {
              file_path: `/${dependencyPath}`,
              content: dependencyBytes,
            });
          case 2:
            return tool('describe_program_material', {
              locator: { source: 'project', projectId: fixture.project.id, path: dependencyPath },
            });
          case 3:
            dependency = JSON.parse(toolText(model, 'describe_program_material'));
            assert(dependency?.ref.source === 'project' && dependency.basis);
            return tool('read_context_resource', {
              ref: dependency.ref,
              basis: dependency.basis,
              encoding: 'utf8',
            });
          case 4:
            assert.equal(
              JSON.parse(toolText(model, 'read_context_resource')).data,
              dependencyBytes,
            );
            return tool('read_context_resource', {
              ref: fixture.source.ref,
              basis: fixture.source.basis,
              encoding: 'utf8',
            });
          case 5: {
            assert(
              JSON.parse(toolText(model, 'read_context_resource')).data.includes('Dose 10 and 20'),
            );
            assert(dependency);
            const manifest = {
              ...fixture.manifest,
              resources: [
                {
                  path: dependencyPath,
                  ref: dependency.ref,
                  basis: dependency.basis,
                  mediaType: 'application/json',
                },
              ],
            };
            // Independent authored input, not a production codec/freeze output oracle.
            candidate = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Published dose comparison</body></html>`;
            readyToPublish = true;
            if (conflict) await publicationReleased;
            return tool('edit_file', {
              file_path: '/report.html',
              old_string: fixture.html,
              new_string: candidate,
            });
          }
          case 6:
            if (conflict) {
              assert(toolText(model, 'edit_file').includes('contentChanged'));
              return {
                text: 'Entry publication refused; the saved dependency remains for inspection.',
              };
            }
            return tool('describe_program_material', { locator: fixture.entry.ref });
          case 7:
            published = JSON.parse(toolText(model, 'describe_program_material'));
            assert(published?.basis);
            return tool('read_context_resource', {
              ref: published.ref,
              basis: published.basis,
              encoding: 'utf8',
            });
          default:
            assert.equal(JSON.parse(toolText(model, 'read_context_resource')).data, candidate);
            return { text: 'The complete report and its dependency have been read back.' };
        }
      },
    });
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    let evidence: Record<string, unknown> = {};
    try {
      await app.initialize();
      fixture = await reportFixture(app, root);
      await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
      const session = await app.call('session.create', { projectId: fixture.project.id });
      const scope = { projectId: fixture.project.id, sessionId: session.id };
      const instructionId = randomUUID();
      await expect(stat(join(fixture.project.path, dependencyPath))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      const receipt = await app.call('session.send', {
        ...scope,
        instructionId,
        text: 'Save a new data dependency, read its actual ref/basis and bytes, then conditionally publish the existing report. Preserve any conflict and never replay writes.',
        materials: [],
      });
      let expectedHtml = candidate;
      if (conflict) {
        await expect.poll(() => readyToPublish, { timeout: 20000 }).toBe(true);
        // A real concurrent human edit while only the external model response is held.
        expectedHtml = fixture.html.replace('Fixed dose comparison', 'Concurrent human comparison');
        await app.call('resources.save', {
          ref: fixture.entry.ref,
          basis: fixture.entry.basis,
          content: expectedHtml,
        });
        releasePublication();
      }
      await expectExecutionCompleted(app, scope, model);
      if (!conflict) expectedHtml = candidate;
      assert(dependency?.ref.source === 'project');
      const snapshot = await app.snapshot(scope);
      const history = await app.harness.executions({ ...scope, instructionId });
      expect(history.runs.map((run) => run.id)).toEqual([receipt.runId]);
      expect(history.instruction?.id).toBe(instructionId);
      const actualDependency = await app.call('resources.describe', { locator: dependency.ref });
      expect(actualDependency).toEqual(dependency);
      expect(await readFile(join(fixture.project.path, dependencyPath), 'utf8')).toBe(
        dependencyBytes,
      );
      const entry = await app.call('resources.describe', { locator: fixture.entry.ref });
      expect(entry.ref).toEqual(fixture.entry.ref);
      expect(entry.basis).not.toBe(fixture.entry.basis);
      expect(await readFile(join(fixture.project.path, 'report.html'), 'utf8')).toBe(expectedHtml);
      const report = await app.call('resources.report', { ref: entry.ref, basis: entry.basis });
      expect(report.manifest.sources).toEqual(fixture.manifest.sources);
      expect(report.manifest.resources).toEqual(
        conflict
          ? fixture.manifest.resources
          : [
              {
                path: dependencyPath,
                ref: dependency.ref,
                basis: dependency.basis,
                mediaType: 'application/json',
              },
            ],
      );
      expect(await readFile(join(fixture.project.path, 'assets/data.json'), 'utf8')).toBe(
        '[10,20]',
      );
      // Saving and artifact association are independent observable facts.
      const paths = conflict ? [dependencyPath] : [dependencyPath, 'report.html'];
      expect(snapshot.artifacts).toHaveLength(paths.length);
      for (const path of paths) {
        const resource = path === dependencyPath ? actualDependency : entry;
        assert(resource.ref.source === 'project');
        expect(snapshot.artifacts).toContainEqual(
          expect.objectContaining({
            path,
            fileId: resource.ref.fileId,
            runId: receipt.runId,
            state: 'linked',
          }),
        );
      }
      const dependencyEdit = await savedEdit(app, actualDependency);
      expect(dependencyEdit.after).toBe(dependencyBytes);
      expect(dependencyEdit.afterEvidence?.basis).toBe(dependency.basis);
      expect(dependencyEdit.origin).toMatchObject({
        kind: 'execution',
        ...scope,
        runId: receipt.runId,
        instanceId: expect.any(String),
        principal: { kind: 'agent', id: session.id },
      });
      const entryEdit = await savedEdit(app, entry);
      if (!conflict) {
        expect(entryEdit.before).toBe(fixture.html);
        expect(entryEdit.after).toBe(candidate);
        expect(entryEdit.afterEvidence?.basis).toBe(entry.basis);
        expect(entryEdit.origin).toMatchObject(dependencyEdit.origin ?? {});
        expect(published).toEqual(entry);
      } else {
        expect(entryEdit.after).toBe(expectedHtml);
        expect(entryEdit.origin?.kind).not.toBe('execution');
        expect(snapshot.messages).toContainEqual(
          expect.objectContaining({
            role: 'tool',
            state: 'error',
            tool: expect.objectContaining({ name: 'edit_file' }),
          }),
        );
      }
      const tools = snapshot.messages.filter((message) => message.tool);
      expect(tools.filter((message) => message.tool?.name === 'write_file')).toHaveLength(1);
      expect(tools.filter((message) => message.tool?.name === 'edit_file')).toHaveLength(1);
      expect(await app.harness.executions({ ...scope, instructionId })).toEqual(history);
      expect((await app.snapshot(scope)).artifacts).toEqual(snapshot.artifacts);
      const instances = () => {
        const rows = app.projects
          .get(scope.projectId)
          .database.prepare('SELECT value FROM run_instances WHERE run_id = ?')
          .all(receipt.runId) as { value: string }[];
        return rows.map(({ value }) => JSON.parse(value) as RunInstance);
      };
      // This durable state is written only after the original managed process confirms stop.
      await expect.poll(() => instances().map((instance) => instance.state)).toEqual(['exited']);
      const stopped = instances();
      assert(dependencyEdit.origin?.kind === 'execution');
      expect(stopped[0]?.instanceId).toBe(dependencyEdit.origin.instanceId);
      evidence = {
        scope,
        instructionId,
        receipt,
        dependency: actualDependency,
        entry,
        manifest: report.manifest,
        candidate,
        expectedHtml,
        dependencyEdit,
        entryEdit,
        artifacts: snapshot.artifacts,
        tools,
        history,
        stopped,
        modelRequests: model.requests.length,
      };
    } finally {
      releasePublication();
      await writeFile(join(root, 'publication-evidence.json'), JSON.stringify(evidence, null, 2));
      await writeFile(join(root, 'model-exchange.json'), JSON.stringify(model.requests, null, 2));
      try {
        await app.close();
      } finally {
        await model.close();
      }
      await writeFile(
        join(root, 'cleanup.json'),
        JSON.stringify({ applicationClosed: true, modelClosed: true }),
      );
    }
  });
}
