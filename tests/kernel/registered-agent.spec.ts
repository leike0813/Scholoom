import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import {
  HarnessRecords,
  InstructionSaver,
  openCheckpoint,
} from '../../packages/harness/dist/node.js';
import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';
import type { ModelServerOptions } from '../model-server.js';
import { createModelServer } from '../model-server.js';

const Database = createRequire(new URL('../../packages/harness/package.json', import.meta.url))(
  'better-sqlite3',
);

async function agentFixture(respond: ModelServerOptions['respond'], boundedTools = false) {
  const root = await mkdtemp(join(tmpdir(), 'registered-agent-protection-'));
  const model = await createModelServer({ ...(respond ? { respond } : {}) });
  // @ts-expect-error Trusted source registration shared with the actual worker.
  const { agentGraphs } = await import('../fixtures/domain-execution-worker/worker-agent.mjs');
  const options = {
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    modelEndpoint: model.url,
    executionGraphs: agentGraphs,
    workerEntry: new URL('../fixtures/domain-execution-worker/worker-agent.mjs', import.meta.url),
  };
  const profile = join(root, 'profile');
  const app = new KernelApplication(profile, options);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const start = (materials: ResourceEvidence[] = []) =>
      app.startGraph({
        ...scope,
        instructionId: randomUUID(),
        text: 'Perform the synthetic Agent work under the original authorization.',
        execution: {
          kind: 'registered',
          graphId: 'registered-agent',
          version: '1',
          config: boundedTools ? { boundedTools: true } : {},
          materials,
          workDomain: { kind: 'project', ...scope },
        },
      });
    return { root, model, app, options, profile, project, scope, start };
  } catch (error) {
    await app.close();
    await model.close();
    throw error;
  }
}

for (const oversized of [false, true]) {
  test(`registered Agent bounds the actual tool reply before SDK offloading (${oversized})`, async () => {
    let evidence: ResourceEvidence;
    const content = oversized ? 'bounded-source-'.repeat(7000) : 'Bounded source content.';
    const f = await agentFixture(
      async ({ calls }) =>
        calls.includes('read_context_resource')
          ? { text: 'Checked the actual tool reply.' }
          : {
              tool: {
                name: 'read_context_resource',
                input: { ...evidence, encoding: 'utf8', limit: 100000 },
              },
            },
      true,
    );
    try {
      const saved = await f.app.call('files.save', {
        projectId: f.project.id,
        path: 'source.txt',
        content,
      });
      assert(saved.fileId);
      const resource = await f.app.call('resources.describe', {
        locator: { source: 'project', projectId: f.project.id, fileId: saved.fileId },
      });
      evidence = { ref: resource.ref, basis: resource.basis };
      await f.start([evidence]);
      await expect
        .poll(async () => (await f.app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      expect(f.model.requests).toHaveLength(2);
      const messages = f.model.requests[1]?.messages as {
        content?: { type?: string; content?: unknown }[];
      }[];
      const reply = messages
        .flatMap((message) => message.content ?? [])
        .find((block) => block.type === 'tool_result');
      assert(reply);
      const received = JSON.stringify(reply.content);
      if (oversized) {
        expect(received).toContain('tooLarge');
        expect(received).not.toContain('bounded-source-');
        expect(received).not.toContain('/large_tool_results/');
      } else {
        expect(received).toContain(content);
        expect(received).toContain(resource.basis);
      }
    } finally {
      await f.app.close();
      await f.model.close();
    }
  });
}

for (const boundary of ['ack', 'pending-writes', 'lost-receipt', 'root-ack'] as const) {
  test(`registered Agent preserves its adopted child across ${boundary}`, async () => {
    const secondId = randomUUID();
    let sendSecond: (() => Promise<unknown>) | undefined;
    const f = await agentFixture(async ({ calls }) => {
      if (!calls.includes('write_file')) {
        await sendSecond?.();
        return {
          tool: { name: 'write_file', input: { file_path: '/once.md', content: 'one effect' } },
        };
      }
      return { text: 'Finished the synthetic work.' };
    });
    const { model, options, profile, project, scope } = f;
    let app = f.app;
    const confirm = HarnessRecords.prototype.confirmConsumption;
    let fail = true;
    let runId = '';
    const projectId = project.id;
    let cutRoot = false;
    let rootSubsetPreserved = false;
    let writeCalls = 0;
    const observeSaves = () => {
      const files = app.projects.get(projectId);
      const save = files.save.bind(files);
      files.save = async (...args) => {
        if (args[0] === 'once.md') writeCalls++;
        return save(...args);
      };
    };
    observeSaves();
    try {
      const selected = await app.call('files.save', {
        projectId,
        path: 'selected.md',
        content: 'Selected original context.',
      });
      assert(selected.fileId);
      const selectedId = selected.fileId;
      const evidence = await app.call('resources.describe', {
        locator: { source: 'project', projectId, fileId: selectedId },
      });
      const contextItems = [
        {
          kind: 'text' as const,
          itemId: randomUUID(),
          ref: evidence.ref,
          basis: evidence.basis,
          quote: 'Selected',
          contentState: 'saved' as const,
          comment: 'Original attachment.',
        },
      ];
      sendSecond = () =>
        app.call('session.send', {
          ...scope,
          instructionId: secondId,
          text: 'Keep complete second instruction.',
          materials: ['selected.md'],
          materialFileIds: [selectedId],
          contextItems,
        });
      HarnessRecords.prototype.confirmConsumption = function (...args) {
        const hasSecond = args[2].instructionIds.includes(secondId);
        const child = !!args[2].checkpointNamespace;
        if (fail && boundary === 'ack' && child && hasSecond)
          throw new Error('Synthetic child consumption transaction rejected');
        if (fail && boundary === 'root-ack' && !child && hasSecond)
          throw new Error('Synthetic root consumption transaction rejected after root save');
        const db = app.projects.get(projectId).database;
        const readCover = () =>
          (
            db
              .prepare('SELECT value FROM harness_meta WHERE key = ?')
              .get(`consumption:${runId || args[1]}`) as { value: string } | undefined
          )?.value;
        const before = readCover();
        const changed = confirm.apply(this, args);
        if (boundary === 'pending-writes' && !child && !hasSecond && before) {
          const cover = JSON.parse(before);
          if (cover.instructionIds.includes(secondId)) rootSubsetPreserved = readCover() === before;
        }
        if (fail && boundary === 'lost-receipt' && child && hasSecond)
          throw new Error('Synthetic lost committed consumption receipt');
        if (boundary === 'pending-writes' && child && hasSecond && !cutRoot) {
          cutRoot = true;
          // Install at the real host ACK boundary, after adoption and before any following root save.
          const instance = db
            .prepare('SELECT value FROM run_instances WHERE run_id = ?')
            .get(args[1]) as { value: string };
          const checkpointDb = new Database(JSON.parse(instance.value).checkpointPath, {
            fileMustExist: true,
          });
          try {
            checkpointDb.exec(
              "CREATE TRIGGER fail_next_root BEFORE INSERT ON checkpoints WHEN NEW.checkpoint_ns = '' BEGIN SELECT RAISE(ABORT, 'synthetic cut before following root'); END",
            );
          } finally {
            checkpointDb.close();
          }
        }
        return changed;
      };
      const first = await f.start();
      runId = first.runId;
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe(boundary === 'pending-writes' ? 'failed' : 'interrupted');
      const beforeRequests = boundary === 'pending-writes' || boundary === 'root-ack' ? 2 : 1;
      expect(model.requests).toHaveLength(beforeRequests);
      expect(JSON.stringify(model.requests[0]?.messages)).toContain(
        'Perform the synthetic Agent work under the original authorization.',
      );
      const advertised = model.requests[0]?.tools as Array<{ name: string }>;
      expect(advertised.some((tool) => tool.name === 'write_file')).toBe(true);
      expect(advertised.every((tool) => tool.name === 'write_file')).toBe(true);
      expect(await readFile(join(project.path, 'once.md'), 'utf8')).toBe('one effect');
      const opened = await openCheckpoint(app.projects.get(project.id).internal, runId);
      let childId: string;
      let childNamespace: string;
      try {
        const row = opened.database
          .prepare(
            'SELECT checkpoint_ns FROM checkpoints WHERE thread_id = ? AND checkpoint_ns != ? ORDER BY checkpoint_id DESC LIMIT 1',
          )
          .get(runId, '') as { checkpoint_ns: string };
        assert(row);
        childNamespace = row.checkpoint_ns;
        const saver = new InstructionSaver(opened.database, async () => {});
        const child = await saver.getTuple({
          configurable: { thread_id: runId, checkpoint_ns: childNamespace },
        });
        assert(child);
        childId = child.checkpoint.id;
        expect(child.checkpoint.channel_values.instructionIds).toContain(secondId);
        expect(child.metadata?.parents?.['']).toBeTruthy();
        const contexts = child.checkpoint.channel_values.instructions as Array<{
          instructionId: string;
          contextItems: unknown;
        }>;
        expect(contexts.find((item) => item.instructionId === secondId)?.contextItems).toEqual(
          contextItems,
        );
        if (boundary === 'pending-writes') {
          const root = await saver.getTuple({ configurable: { thread_id: runId } });
          expect(root?.checkpoint.channel_values.instructionIds).not.toContain(secondId);
          expect(
            root?.pendingWrites?.some(
              ([, channel, value]) =>
                channel === 'instructionIds' && Array.isArray(value) && value.includes(secondId),
            ),
          ).toBe(true);
          const meta = app.projects
            .get(projectId)
            .database.prepare('SELECT value FROM harness_meta WHERE key = ?')
            .get(`consumption:${runId}`) as { value: string };
          expect(JSON.parse(meta.value)).toMatchObject({
            checkpointId: childId,
            checkpointNamespace: childNamespace,
            instructionIds: [first.instructionId, secondId],
          });
        }
        if (boundary === 'root-ack') {
          const root = await saver.getTuple({ configurable: { thread_id: runId } });
          expect(root?.checkpoint.channel_values.instructionIds).toContain(secondId);
          expect(child.metadata?.parents?.['']).not.toBe(root?.checkpoint.id);
          const meta = app.projects
            .get(projectId)
            .database.prepare('SELECT value FROM harness_meta WHERE key = ?')
            .get(`consumption:${runId}`) as { value: string };
          expect(JSON.parse(meta.value)).toMatchObject({
            checkpointNamespace: childNamespace,
            instructionIds: [first.instructionId, secondId],
          });
        }
      } finally {
        opened.database.close();
      }
      await app.close();
      app = new KernelApplication(profile, options);
      await app.initialize();
      observeSaves();
      if (boundary !== 'pending-writes') {
        await app.call('session.send', {
          ...scope,
          instructionId: randomUUID(),
          text: 'Explicitly retry original execution.',
          materials: [],
        });
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('interrupted');
        expect(model.requests).toHaveLength(beforeRequests);
        const reopened = await openCheckpoint(app.projects.get(project.id).internal, runId);
        try {
          const child = await new InstructionSaver(reopened.database, async () => {}).getTuple({
            configurable: { thread_id: runId, checkpoint_ns: childNamespace },
          });
          expect(child?.checkpoint.id).toBe(childId);
        } finally {
          reopened.database.close();
        }
      } else {
        const opened = await openCheckpoint(app.projects.get(projectId).internal, runId);
        try {
          opened.database.exec('DROP TRIGGER fail_next_root');
        } finally {
          opened.database.close();
        }
      }
      fail = false;
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Continue after acknowledgement is available.',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      expect(model.requests).toHaveLength(2);
      expect((await app.snapshot(scope)).messages.find((item) => item.id === secondId)?.state).toBe(
        'consumed',
      );
      expect(app.projects.get(project.id).history('once.md')).toHaveLength(1);
      expect(writeCalls).toBe(1);
      const openedFinal = await openCheckpoint(app.projects.get(projectId).internal, runId);
      try {
        const entries = (await readFile(`${openedFinal.path}.consumer-entries.jsonl`, 'utf8'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        expect(new Set(entries.map((entry) => entry.taskId)).size).toBe(1);
        if (boundary === 'pending-writes' || boundary === 'root-ack') {
          expect(entries).toHaveLength(1);
          if (boundary === 'pending-writes') expect(rootSubsetPreserved).toBe(true);
        }
        const final = await new InstructionSaver(openedFinal.database, async () => {}).getTuple({
          configurable: { thread_id: runId },
        });
        expect(final?.checkpoint.channel_values.instructionIds).toContain(secondId);
        const evidencePath = join(f.root, 'recovery-evidence.json');
        await writeFile(
          evidencePath,
          JSON.stringify({
            boundary,
            runId,
            childId,
            childNamespace,
            consumerEntries: entries,
            modelRequests: model.requests.length,
            writeCalls,
            rootSubsetPreserved,
            instructionIds: final?.checkpoint.channel_values.instructionIds,
          }),
        );
        await test.info().attach('registered-agent-recovery', {
          path: evidencePath,
          contentType: 'application/json',
        });
      } finally {
        openedFinal.database.close();
      }
      expect(await readFile(join(project.path, 'once.md'), 'utf8')).toBe('one effect');
    } finally {
      HarnessRecords.prototype.confirmConsumption = confirm;
      await app.close();
      await model.close();
    }
  });
}

for (const boundary of ['length', 'tool-scope', 'cancel'] as const) {
  test(`registered Agent preserves ${boundary} protection through the shared assembly`, async () => {
    const f = await agentFixture(({ calls }) =>
      calls.includes('write_file')
        ? { text: 'Done.' }
        : {
            ...(boundary === 'length' ? { stopReason: 'max_tokens' as const } : {}),
            tool: {
              name: boundary === 'tool-scope' ? 'edit_file' : 'write_file',
              input:
                boundary === 'tool-scope'
                  ? { file_path: '/once.md', old_string: 'protected', new_string: 'changed' }
                  : { file_path: '/once.md', content: 'one effect' },
            },
          },
    );
    let release = () => {};
    let saves = 0;
    let savedEffect = () => {};
    const effectSaved = new Promise<void>((resolve) => {
      savedEffect = resolve;
    });
    try {
      const project = f.app.projects.get(f.project.id);
      const save = project.save.bind(project);
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      project.save = async (...args) => {
        saves++;
        const saved = await save(...args);
        savedEffect();
        if (boundary === 'cancel') await gate;
        return saved;
      };
      if (boundary === 'tool-scope') await save('once.md', 'protected');
      await f.start();
      if (boundary === 'cancel') {
        await effectSaved;
        f.app.harness.cancel(f.scope.projectId, f.scope.sessionId);
        release();
      }
      await expect
        .poll(async () => (await f.app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe(boundary === 'cancel' ? 'cancelled' : 'failed');
      expect(f.model.requests).toHaveLength(1);
      expect(saves).toBe(boundary === 'cancel' ? 1 : 0);
      if (boundary === 'length')
        await expect(readFile(join(f.project.path, 'once.md'), 'utf8')).rejects.toMatchObject({
          code: 'ENOENT',
        });
      else
        expect(await readFile(join(f.project.path, 'once.md'), 'utf8')).toBe(
          boundary === 'tool-scope' ? 'protected' : 'one effect',
        );
      if (boundary === 'cancel') {
        const receipt = (await f.app.snapshot(f.scope)).messages.find(
          (item) => item.tool?.name === 'write_file',
        );
        expect(receipt?.state).toBe('unknown');
        await f.app.close();
        const recovered = new KernelApplication(f.profile, f.options);
        try {
          await recovered.initialize();
          expect(
            (await recovered.snapshot(f.scope)).messages.find((item) => item.id === receipt?.id)
              ?.state,
          ).toBe('unknown');
          expect(f.model.requests).toHaveLength(1);
        } finally {
          await recovered.close();
        }
      }
    } finally {
      release();
      await f.app.close();
      await f.model.close();
    }
  });
}

test('registered Agent rechecks ModelAccess after queued project revocation', async () => {
  const f = await agentFixture(() => ({ text: 'Authorized.' }));
  const blocker = await f.app.models.execution();
  const lease = await blocker.acquire();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      blocker.release(lease);
    }
  };
  const execution = f.app.models.execution.bind(f.app.models);
  let entered = false;
  let admissionRequested = () => {};
  const admission = new Promise<void>((resolve) => {
    admissionRequested = resolve;
  });
  f.app.models.execution = async (...args) => {
    const model = await execution(...args);
    return {
      ...model,
      acquire: () => {
        entered = true;
        admissionRequested();
        return model.acquire();
      },
    };
  };
  try {
    await f.start();
    await admission;
    expect(entered).toBe(true);
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    release();
    await expect
      .poll(async () => (await f.app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('failed');
    expect(f.model.requests).toHaveLength(0);
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'trusted',
      autoBackup: false,
    });
    await f.app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: 'Explicitly continue with restored authorization.',
      materials: [],
    });
    await expect
      .poll(async () => (await f.app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    expect(f.model.requests).toHaveLength(1);
  } finally {
    release();
    await f.app.close();
    await f.model.close();
  }
});
