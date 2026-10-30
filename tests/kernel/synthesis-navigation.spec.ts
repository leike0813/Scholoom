import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { linkTaskResearchArtifacts } from '../../apps/kernel/dist/research-graphs/task-navigation.js';
import type { RpcPeer } from '../../packages/broker/dist/rpc.js';
import type {
  TaskGraphInputSnapshot,
  TaskGraphInputs,
  TaskMetadata,
  TaskRead,
} from '../../packages/protocol/dist/projects.js';
import type { ResourceSaveResult } from '../../packages/protocol/dist/resources.js';
// @ts-expect-error Source-only registry shared by the actual host and worker.
import { description, graphs } from '../fixtures/synthesis-navigation/graphs.mjs';
import { createModelServer } from '../model-server.js';

type Artifact = { role: 'report' | 'process'; result: ResourceSaveResult };
type Fault = 'conflict' | 'unknown-before' | 'unknown-after' | 'permission';

async function fixture(root: string) {
  await mkdir(root, { recursive: true });
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    modelEndpoint: model.url,
    researchGraphs: [description],
    executionGraphs: graphs,
    workerEntry: new URL('../fixtures/synthesis-navigation/worker.mjs', import.meta.url),
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: 'navigation',
      title: 'Navigation boundary',
      status: 'waiting',
      workItems: [
        { id: 'comparison', title: 'Compare evidence' },
        { id: 'other', title: 'Other work' },
      ],
    };
    const body = '\r\n# Research purpose\r\nPreserve decisions, uncertainty and next steps.\r\n';
    const created = await app.call('tasks.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'tasks/navigation.task.md',
      content: `\uFEFF---\r\n${JSON.stringify(metadata)}\r\n---\r\n${body}`,
    });
    assert(created.state === 'complete');
    const task = {
      projectId: project.id,
      taskId: metadata.id,
      fileId: created.resource.ref.fileId,
    };
    let index = 0;
    const read = () => app.call('tasks.read', { task });
    const save = (current: TaskRead, content: string) =>
      app.call('tasks.save', { task, basis: current.entry.basis, content });
    const run = async (
      options: {
        fault?: Fault;
        artifacts?: Artifact[];
        targets?: {
          role: Artifact['role'];
          resource: { ref: ResourceSaveResult['resource']['ref']; basis: string };
        }[];
      } = {},
    ) => {
      const control = join(root, `run-${index++}`);
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      const current = await read();
      const input: TaskGraphInputs['tasks.runGraph'] = {
        task,
        basis: current.entry.basis,
        sessionId: session.id,
        invocationId: randomUUID(),
        instructionId: randomUUID(),
        processOperationId: randomUUID(),
        workItemId: 'comparison',
        graphId: description.definition.graphId,
        version: '1',
        config: { control, ...options },
        sourceLinkIds: [],
      };
      const started = await app.call('tasks.runGraph', input);
      assert(started.process.state === 'complete' && started.inputSnapshot);
      expect(started.taskAssociation.state).toBe('confirmed');
      const waitFile = (name: string) =>
        expect
          .poll(
            async () => {
              try {
                return await readFile(`${control}.${name}`, 'utf8');
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                return '';
              }
            },
            { timeout: 20000 },
          )
          .not.toBe('');
      await waitFile('saved');
      await writeFile(`${control}.saved-release`, 'continue');
      if (options.fault === 'conflict') {
        await waitFile('read');
        const human = await read();
        await save(human, `${human.content}\r\nHuman concurrent decision.\r\n`);
        await writeFile(`${control}.read-release`, 'continue');
      }
      await expect
        .poll(
          async () => {
            const snapshot = await app.snapshot(scope);
            return snapshot.run?.id === started.call.runId ? snapshot.run.state : '';
          },
          { timeout: 20000 },
        )
        .toBe(options.fault ? 'failed' : 'completed');
      const artifacts: Artifact[] = JSON.parse(await readFile(`${control}.artifacts.json`, 'utf8'));
      const observed = JSON.parse(await readFile(`${control}.observed.json`, 'utf8')) as {
        taskSaves: number;
        resourceSaves: number;
        navigation: { state: string; error?: { code: string } };
      };
      return { started, input, scope, artifacts, observed };
    };
    return {
      app,
      project,
      task,
      read,
      save,
      run,
      body,
      close: async () => {
        try {
          await app.close();
        } finally {
          await model.close();
        }
        expect(model.requests).toHaveLength(0);
      },
    };
  } catch (error) {
    try {
      await app.close();
    } finally {
      await model.close();
    }
    throw error;
  }
}

function relation(read: TaskRead, artifact: Artifact, workItemId = 'comparison') {
  const ref = artifact.result.resource.ref;
  assert(ref.source === 'project');
  return (
    read.metadata.links?.filter(
      (link) =>
        link.role === (artifact.role === 'report' ? 'result' : 'process') &&
        link.workItemId === workItemId &&
        link.target.kind === 'project-file' &&
        link.target.fileId === ref.fileId,
    ) ?? []
  );
}

test('navigation rejects foreign identities and missing work items, and propagates cancellation', async () => {
  const f = await fixture(test.info().outputPath('boundaries'));
  try {
    const current = await f.read();
    const snapshot: TaskGraphInputSnapshot = {
      kind: 'research-task-graph-input',
      formatVersion: 1,
      task: f.task,
      entry: current.entry,
      content: current.content,
      sessionId: 'boundary',
      invocationId: 'boundary',
      instructionId: 'boundary',
      workItemId: 'comparison',
      sources: [],
    };
    const created = await f.app.call('resources.create', {
      projectId: f.project.id,
      operationId: randomUUID(),
      path: 'boundary.md',
      content: 'Saved research',
    });
    assert(created.state === 'complete');
    const artifact: Artifact = { role: 'report', result: { resource: created.resource } };
    const cases: {
      input: TaskGraphInputSnapshot;
      artifacts: Artifact[];
      read: TaskRead;
      code: string;
    }[] = [
      {
        input: {
          ...snapshot,
          entry: {
            ...snapshot.entry,
            ref: { source: 'project', projectId: 'foreign', fileId: f.task.fileId },
          },
        },
        artifacts: [artifact],
        read: current,
        code: 'instanceMismatch',
      },
      {
        input: snapshot,
        artifacts: [
          {
            ...artifact,
            result: {
              resource: {
                ...created.resource,
                ref: { ...created.resource.ref, projectId: 'foreign' },
              },
            },
          },
        ],
        read: current,
        code: 'instanceMismatch',
      },
      {
        input: snapshot,
        artifacts: [
          {
            ...artifact,
            result: {
              resource: {
                ...created.resource,
                ref: { ...created.resource.ref, fileId: f.task.fileId },
              },
            },
          },
        ],
        read: current,
        code: 'instanceMismatch',
      },
      {
        input: snapshot,
        artifacts: [artifact],
        read: { ...current, task: { ...current.task, taskId: 'replacement' } },
        code: 'instanceMismatch',
      },
      {
        input: snapshot,
        artifacts: [artifact],
        read: { ...current, metadata: { ...current.metadata, workItems: [] } },
        code: 'notFound',
      },
    ];
    for (const item of cases) {
      const peer = {
        request: async (_method: string, args: { name: string }) => {
          assert.equal(args.name, 'read_research_task');
          return JSON.stringify(item.read);
        },
      } as unknown as RpcPeer;
      expect(await linkTaskResearchArtifacts(peer, item.input, item.artifacts)).toMatchObject({
        state: 'failed',
        error: { code: item.code },
      });
    }
    const cancelled = new DOMException('Cancelled navigation', 'AbortError');
    const peer = {
      request: async () => {
        throw cancelled;
      },
    } as unknown as RpcPeer;
    await assert.rejects(
      linkTaskResearchArtifacts(peer, snapshot, [artifact]),
      (error) => error === cancelled,
    );
    expect(await f.read()).toEqual(current);
  } finally {
    await f.close();
  }
});

test('real worker links saved report and process, updates exact file basis and preserves old calls', async () => {
  const f = await fixture(test.info().outputPath('navigation'));
  try {
    const first = await f.run();
    const current = await f.read();
    expect(first.observed).toMatchObject({
      resourceSaves: 2,
      taskSaves: 1,
      navigation: { state: 'confirmed' },
    });
    for (const artifact of first.artifacts) {
      expect(relation(current, artifact)).toHaveLength(1);
      expect(relation(current, artifact)[0]?.basis).toBe(artifact.result.resource.basis);
      const file = await f.app.call('resources.read', {
        ref: artifact.result.resource.ref,
        basis: artifact.result.resource.basis,
        encoding: 'utf8',
      });
      expect(file.data).toContain('next steps');
    }
    expect(current.content.startsWith('\uFEFF---\r\n')).toBe(true);
    expect(current.content.endsWith(f.body)).toBe(true);
    expect(current.metadata.status).toBe('waiting');
    const pointer = current.metadata.links?.find(
      (link) => link.id === first.input.processOperationId,
    );
    assert(pointer?.target.kind === 'project-file' && pointer.basis);
    const pointerFileId = pointer.target.fileId;
    const pointerContent = await f.app.call('resources.read', {
      ref: { source: 'project', projectId: f.project.id, fileId: pointer.target.fileId },
      basis: pointer.basis,
      encoding: 'utf8',
    });
    expect(JSON.parse(pointerContent.data).invocationId).toBe(first.input.invocationId);
    expect(
      first.artifacts.every(
        (artifact) =>
          artifact.result.resource.ref.source === 'project' &&
          artifact.result.resource.ref.fileId !== pointerFileId,
      ),
    ).toBe(true);
    const report = first.artifacts.find((artifact) => artifact.role === 'report');
    assert(report);
    const originalLink = relation(current, report)[0];
    assert(originalLink);
    const metadata = {
      ...current.metadata,
      links: [
        ...(current.metadata.links ?? []),
        {
          ...originalLink,
          id: 'other-result',
          workItemId: 'other',
          note: 'Keep this historical basis',
        },
      ],
    };
    await f.save(
      current,
      current.content.replace(
        /^(\uFEFF?---\r?\n)[\s\S]*?(\r?\n---(?:\r?\n|$))/,
        (_header, opening, closing) => `${opening}${JSON.stringify(metadata)}${closing}`,
      ),
    );
    const second = await f.run({
      targets: first.artifacts.map(({ role, result }) => ({
        role,
        resource: { ref: result.resource.ref, basis: result.resource.basis },
      })),
    });
    const updated = await f.read();
    for (const artifact of second.artifacts) {
      const old = first.artifacts.find((item) => item.role === artifact.role);
      assert(old);
      expect(artifact.result.resource.ref).toEqual(old.result.resource.ref);
      expect(artifact.result.resource.basis).not.toBe(old.result.resource.basis);
      expect(relation(updated, artifact)).toHaveLength(1);
      expect(relation(updated, artifact)[0]?.id).toBe(relation(current, old)[0]?.id);
      expect(relation(updated, artifact)[0]?.basis).toBe(artifact.result.resource.basis);
    }
    expect(relation(updated, report, 'other')[0]).toEqual(metadata.links.at(-1));
    expect(updated.metadata.links).toContainEqual(pointer);
    expect(
      updated.metadata.links?.some((link) => link.id === second.input.processOperationId),
    ).toBe(true);
    expect(updated.metadata.status).toBe('waiting');
    expect(updated.content.endsWith(f.body)).toBe(true);
    await f.app.call('research.graphCalls', {
      ...first.scope,
      invocationId: first.input.invocationId,
    });
    expect(await f.read()).toEqual(updated);
  } finally {
    await f.close();
  }
});

for (const fault of ['conflict', 'unknown-before', 'unknown-after', 'permission'] as const) {
  test(`saved files survive ${fault}; explicit linking reuses files and never completes task`, async () => {
    const f = await fixture(test.info().outputPath(fault));
    try {
      const first = await f.run({ fault });
      expect(first.observed.navigation).toMatchObject({
        state: fault.startsWith('unknown') ? 'unknown' : 'failed',
        error: {
          code:
            fault === 'conflict'
              ? 'contentChanged'
              : fault === 'permission'
                ? 'permissionDenied'
                : 'outcomeUnknown',
        },
      });
      expect(first.observed.taskSaves).toBe(1);
      const saved = await Promise.all(
        first.artifacts.map(({ result }) =>
          f.app.call('resources.read', {
            ref: result.resource.ref,
            basis: result.resource.basis,
            encoding: 'utf8',
          }),
        ),
      );
      const incomplete = await f.read();
      expect(incomplete.metadata.status).toBe('waiting');
      for (const artifact of first.artifacts)
        expect(relation(incomplete, artifact)).toHaveLength(fault === 'unknown-after' ? 1 : 0);
      const second = await f.run({ artifacts: first.artifacts });
      expect(second.observed).toMatchObject({
        resourceSaves: 0,
        taskSaves: fault === 'unknown-after' ? 0 : 1,
        navigation: { state: 'confirmed' },
      });
      expect(second.artifacts).toEqual(first.artifacts);
      const repaired = await f.read();
      for (const artifact of first.artifacts) expect(relation(repaired, artifact)).toHaveLength(1);
      expect(repaired.metadata.status).toBe('waiting');
      if (fault === 'conflict') expect(repaired.content).toContain('Human concurrent decision.');
      expect(
        await Promise.all(
          first.artifacts.map(({ result }) =>
            f.app.call('resources.read', {
              ref: result.resource.ref,
              basis: result.resource.basis,
              encoding: 'utf8',
            }),
          ),
        ),
      ).toEqual(saved);
      expect(
        repaired.metadata.links?.some((link) => link.id === first.input.processOperationId),
      ).toBe(true);
      expect(
        repaired.metadata.links?.some((link) => link.id === second.input.processOperationId),
      ).toBe(true);
    } finally {
      await f.close();
    }
  });
}
