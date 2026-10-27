import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { KernelApplication } from '../../apps/kernel/dist/application.js';
import type {
  ProjectTaskOutputs,
  TaskGraphInputSnapshot,
  TaskGraphOutputs,
  TaskRead,
} from '../../packages/protocol/dist/projects.js';
import type { ResourceEvidence, ResourceOutputs } from '../../packages/protocol/dist/resources.js';
import type { WorkDomain } from '../../packages/protocol/dist/work-domains.js';
import { createModelServer, type ModelServer } from '../model-server.js';
import { taskGraphIntegration } from '../task-graph-integration-fixture.js';

type Read = ResourceOutputs['resources.read'];
type Pointer = TaskGraphOutputs['tasks.runGraph']['call'] & { inputSnapshot: ResourceEvidence };
const tool = (name: string, input: Record<string, unknown>) => ({ tool: { name, input } });

// Read the public provider exchange, including each separately read resource.
function result<T>(model: ModelServer, name: string, index = -1): T {
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
  const call = blocks.filter((block) => block.type === 'tool_use' && block.name === name).at(index);
  assert(call?.id);
  const response = blocks.find(
    (block) => block.type === 'tool_result' && block.tool_use_id === call.id,
  );
  assert(response?.content);
  return JSON.parse(
    typeof response.content === 'string'
      ? response.content
      : response.content.map((block) => block.text ?? '').join(''),
  ) as T;
}

async function waitFor(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  runId: string,
  state: 'waiting' | 'completed',
) {
  await expect
    .poll(
      async () => {
        const snapshot = await app.snapshot(scope);
        if (snapshot.run?.state === 'failed')
          throw new Error(JSON.stringify({ run: snapshot.run, messages: snapshot.messages }));
        return { id: snapshot.run?.id, state: snapshot.run?.state };
      },
      { timeout: 20000 },
    )
    .toEqual({ id: runId, state });
}

async function send(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  text: string,
) {
  const receipt = await app.call('session.send', {
    ...scope,
    instructionId: randomUUID(),
    text,
    materials: [],
  });
  await waitFor(app, scope, receipt.runId, 'completed');
  return app.snapshot(scope);
}

test('fresh sessions continue task graphs from saved files', async () => {
  const info = test.info();
  test.setTimeout(120000);
  let phase: 'private' | 'resume' = 'private';
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (phase === 'private') return { text: '本条私聊没有形成任务材料。' };
      if (!calls.includes('read_work_domain')) return tool('read_work_domain', {});
      const domain = result<WorkDomain>(model, 'read_work_domain');
      assert(domain.kind === 'project');
      if (!calls.includes('list_research_tasks'))
        return tool('list_research_tasks', { projectId: domain.projectId });
      if (!calls.includes('read_research_task')) {
        const listed = result<ProjectTaskOutputs['tasks.list']>(model, 'list_research_tasks');
        assert.equal(listed.tasks.length, 1);
        return tool('read_research_task', { task: listed.tasks[0]?.task });
      }
      const task = result<TaskRead>(model, 'read_research_task');
      const reads = calls.filter((name) => name === 'read_context_resource').length;
      const readLink = (role: 'process' | 'result') => {
        const link = task.metadata.links?.find((item) => item.role === role);
        assert(link?.target.kind === 'project-file' && link.basis);
        return tool('read_context_resource', {
          ref: { source: 'project', projectId: domain.projectId, fileId: link.target.fileId },
          basis: link.basis,
          encoding: 'utf8',
        });
      };
      if (reads === 0) return readLink('process');
      const pointerRead = result<Read>(model, 'read_context_resource', 0);
      const pointer = JSON.parse(pointerRead.data) as Pointer;
      if (reads === 1)
        return tool('read_context_resource', {
          ref: pointer.inputSnapshot.ref,
          basis: pointer.inputSnapshot.basis,
          encoding: 'utf8',
        });
      const inputRead = result<Read>(model, 'read_context_resource', 1);
      const input = JSON.parse(inputRead.data) as TaskGraphInputSnapshot;
      assert.equal(input.kind, 'research-task-graph-input');
      assert.deepEqual(input.task, task.task);
      assert.equal(input.invocationId, pointer.invocationId);
      if (reads === 2) return readLink('result');
      if (!calls.includes('write_file')) {
        const report = result<Read>(model, 'read_context_resource', 2);
        return tool('write_file', {
          file_path: '/followup.md',
          content: `# 接续\n\n${task.content}\n\n## 调用依据\n${pointerRead.data}\n\n## 原输入\n${inputRead.data}\n\n## 实际报告\n${report.data}\n`,
        });
      }
      return { text: '已从任务文件、调用指针、输入快照和实际报告保存接续材料。' };
    },
  });
  let f: Awaited<ReturnType<typeof taskGraphIntegration>> | undefined;
  try {
    f = await taskGraphIntegration(info.outputPath('i1'), model.url);
    const { app, project, input } = f;
    const scope = { projectId: project.id, sessionId: input.sessionId };
    const privateMarker = 'previous_private_conversation_i1_73';
    const privateChat = await send(app, scope, `${privateMarker} 私聊猜测，不作为任务依据。`);
    expect(privateChat.messages.some((message) => message.text.includes(privateMarker))).toBe(true);

    const started = await app.call('tasks.runGraph', input);
    assert(started.inputSnapshot && started.process.state === 'complete');
    expect(started.taskAssociation.state).toBe('confirmed');
    await waitFor(app, scope, started.call.runId, 'waiting');
    const confirmation = await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '{"confirm":true}',
      materials: [],
    });
    expect(confirmation.runId).toBe(started.call.runId);
    await waitFor(app, scope, started.call.runId, 'completed');
    const query = { ...scope, invocationId: input.invocationId };
    const completed = await app.call('research.graphCalls', query);
    expect(completed.calls).toHaveLength(1);
    const call = completed.calls[0];
    assert(call);
    expect(call.error).toBeUndefined();
    expect(call.executions).toHaveLength(1);
    expect(call.executions[0]).toMatchObject({
      run: { id: started.call.runId, state: 'completed' },
      check: { delivery: 'usable', issues: [] },
    });
    const creation = call.executions[0]?.run.graphProgress?.evidence.creations?.[0];
    assert(creation?.state === 'complete' && creation.resource.ref.source === 'project');
    const snapshotEvidence = {
      ref: started.inputSnapshot.resource.ref,
      basis: started.inputSnapshot.resource.basis,
      role: 'task-input',
    };
    const process = await app.call('resources.read', {
      ref: started.process.resource.ref,
      basis: started.process.resource.basis,
      encoding: 'utf8',
    });
    expect(JSON.parse(process.data)).toEqual({ ...started.call, inputSnapshot: snapshotEvidence });
    const frozen = await app.call('resources.read', {
      ref: snapshotEvidence.ref,
      basis: snapshotEvidence.basis,
      encoding: 'utf8',
    });
    expect(JSON.parse(frozen.data)).toMatchObject({
      task: input.task,
      entry: f.read.entry,
      content: f.read.content,
      sessionId: input.sessionId,
      invocationId: input.invocationId,
      instructionId: input.instructionId,
    });
    const report = await app.call('resources.read', {
      ref: creation.resource.ref,
      basis: creation.resource.basis,
      encoding: 'utf8',
    });
    for (const text of ['结果42', '结果17', '目标：', '障碍：', '下一步：'])
      expect(report.data).toContain(text);

    const current = await app.call('tasks.read', { task: input.task });
    expect(
      current.metadata.links?.find((link) => link.id === input.processOperationId),
    ).toMatchObject({
      role: 'process',
      target: { kind: 'project-file', fileId: started.process.resource.ref.fileId },
      basis: started.process.resource.basis,
    });
    const metadata = {
      ...current.metadata,
      links: [
        ...(current.metadata.links ?? []),
        {
          id: 'report',
          role: 'result',
          workItemId: input.workItemId,
          target: { kind: 'project-file', fileId: creation.resource.ref.fileId },
          basis: creation.resource.basis,
        },
      ],
    };
    const saved = await app.call('tasks.save', {
      task: current.task,
      basis: current.entry.basis,
      content: current.content.replace(
        /^(---\n)[\s\S]*?(\n---\n)/,
        (_header, opening, closing) => `${opening}${JSON.stringify(metadata)}${closing}`,
      ),
    });
    const fresh = {
      projectId: project.id,
      sessionId: (await app.call('session.create', { projectId: project.id })).id,
    };
    expect(fresh.sessionId).not.toBe(scope.sessionId);
    phase = 'resume';
    const requestStart = model.requests.length;
    const resumed = await send(
      app,
      fresh,
      '从项目已有任务接续：读取入口、调用指针、输入快照和实际报告，按保存的目标、依据、障碍与下一步保存followup.md。',
    );
    const tools = resumed.messages.filter((message) => message.role === 'tool');
    expect(tools.every((message) => message.state === 'complete')).toBe(true);
    for (const name of ['list_research_tasks', 'read_research_task', 'write_file'])
      expect(tools.some((message) => message.tool?.name === name)).toBe(true);
    expect(
      tools.some((message) =>
        ['create_research_task', 'invoke_research_capability'].includes(message.tool?.name ?? ''),
      ),
    ).toBe(false);
    const taskRead = tools.find((message) => message.tool?.name === 'read_research_task');
    expect(JSON.parse(taskRead?.tool?.output ?? '{}')).toEqual(saved);
    const reads = tools.filter((message) => message.tool?.name === 'read_context_resource');
    expect(reads.map((message) => JSON.parse(message.tool?.output ?? '{}'))).toEqual([
      process,
      frozen,
      report,
    ]);
    const followup = await readFile(join(project.path, 'followup.md'), 'utf8');
    for (const content of [saved.content, process.data, frozen.data, report.data])
      expect(followup).toContain(content);
    expect(followup).not.toContain(privateMarker);
    expect(JSON.stringify(model.requests.slice(requestStart))).not.toContain(privateMarker);
    expect(resumed.artifacts.some((artifact) => artifact.path === 'followup.md')).toBe(true);
    expect(await readFile(join(project.path, 'report.md'), 'utf8')).toBe(report.data);
    expect(
      await readFile(
        join(project.path, `tasks/${input.processOperationId}.graph-input.md`),
        'utf8',
      ),
    ).toBe(frozen.data);
    for (const original of [process, frozen, report])
      expect(
        await app.call('resources.read', {
          ref: original.ref,
          basis: original.basis,
          encoding: 'utf8',
        }),
      ).toEqual(original);
    expect(await app.call('research.graphCalls', query)).toEqual(completed);
    expect((await app.call('research.graphCalls', fresh)).calls).toEqual([]);
    expect((await app.call('tasks.list', { projectId: project.id })).tasks).toHaveLength(1);
  } finally {
    try {
      await f?.app.close();
    } finally {
      await model.close();
    }
  }
});
