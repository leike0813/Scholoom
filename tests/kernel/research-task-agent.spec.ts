import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { ErrorInfo } from '../../packages/protocol/dist/core.js';
import type { LibraryAttachment, LibraryOutputs } from '../../packages/protocol/dist/library.js';
import type {
  ProjectTaskOutputs,
  TaskMetadata,
  TaskRead,
} from '../../packages/protocol/dist/projects.js';
import type {
  ResourceCreationOutputs,
  ResourceDescriptor,
  ResourceOutputs,
} from '../../packages/protocol/dist/resources.js';
import type { WorkDomain } from '../../packages/protocol/dist/work-domains.js';
import { createModelServer, type ModelServer } from '../model-server.js';

const tool = (name: string, input: Record<string, unknown>) => ({ tool: { name, input } });
const entry = (metadata: TaskMetadata, body: string) =>
  `---\n${JSON.stringify(metadata)}\n---\n\n${body}\n`;

// Inspect only the provider's public tool exchange, never worker/checkpoint internals.
function result<T>(model: ModelServer, name: string): T {
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
  const response = blocks.find(
    (block) => block.type === 'tool_result' && block.tool_use_id === call.id,
  );
  assert(response?.content, `Missing provider result: ${name}`);
  const text =
    typeof response.content === 'string'
      ? response.content
      : response.content.map((block) => block.text ?? '').join('');
  return JSON.parse(text) as T;
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
  await expect
    .poll(
      async () => {
        const snapshot = await app.snapshot(scope);
        const run = snapshot.run;
        if (run?.state === 'failed')
          throw new Error(
            JSON.stringify({ run, tools: snapshot.messages.filter((message) => message.tool) }),
          );
        return { id: run?.id, state: run?.state };
      },
      { timeout: 20000 },
    )
    .toEqual({ id: receipt.runId, state: 'completed' });
  return app.snapshot(scope);
}

test('controlled model creates task materials and a fresh session resumes from the entry after kernel restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-agent-'));
  const taskId = randomUUID();
  const operationId = randomUUID();
  const path = `tasks/${taskId}.task.md`;
  const metadata: TaskMetadata = {
    kind: 'research-task',
    formatVersion: 1,
    id: taskId,
    title: '比较合成测量方案',
    status: 'active',
  };
  const body =
    '目标：比较测量方案。\n决定：采用A，因B缺少对照条件。\n限制：仅合成样本，不外推。\n下一步：补充对照复验。';
  const processText = `# 比较过程\n${Array.from({ length: 180 }, (_, index) => `第${index + 1}项：合成观测42；方案A保留条件，方案B缺少对照。\n`).join('')}process_tail_73：原比较理由为B缺少对照。\n`;
  const resultText = '# 结果\n合成观测为42；采用A，B缺少对照。仅合成样本，不外推。\n';
  const manual = '人工补充 manual_condition_91：新增对照须固定温度。';
  let projectId = '';
  let phase: 'create' | 'link' | 'resume' = 'create';
  let resources: ResourceDescriptor[] = [];
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('read_work_domain')) return tool('read_work_domain', {});
      const domain = result<WorkDomain>(model, 'read_work_domain');
      assert(domain.kind === 'project' && domain.projectId === projectId);
      const reads = calls.filter((name) => name === 'read_context_resource').length;
      if (phase === 'create') {
        if (!calls.includes('list_research_tasks'))
          return tool('list_research_tasks', { projectId: domain.projectId });
        if (!calls.includes('create_research_task')) {
          assert.equal(
            result<ProjectTaskOutputs['tasks.list']>(model, 'list_research_tasks').tasks.length,
            0,
          );
          return tool('create_research_task', {
            projectId: domain.projectId,
            operationId,
            path,
            content: entry(metadata, body),
          });
        }
        if (!calls.includes('read_task_creation'))
          return tool('read_task_creation', { projectId: domain.projectId, operationId });
        if (!calls.includes('read_research_task')) {
          const created = result<ResourceCreationOutputs['resources.creation']>(
            model,
            'read_task_creation',
          );
          assert(created.state === 'complete');
          return tool('read_research_task', {
            task: { projectId: domain.projectId, taskId, fileId: created.resource.ref.fileId },
          });
        }
        if (!calls.includes('read_file')) return tool('read_file', { file_path: '/input.md' });
        const writes = calls.filter((name) => name === 'write_file').length;
        if (writes < 2)
          return tool('write_file', {
            file_path: writes === 0 ? '/comparison.md' : '/result.md',
            content: writes === 0 ? processText : resultText,
          });
        return { text: '任务、比较过程与结果已保存；下一步核查文件并关联入口。' };
      }
      if (phase === 'link') {
        if (reads < resources.length) {
          const resource = resources[reads];
          assert(resource);
          return tool('read_context_resource', {
            ref: resource.ref,
            basis: resource.basis,
            encoding: 'utf8',
          });
        }
        if (calls.filter((name) => name === 'read_research_task').length < 2)
          return tool('read_research_task', {
            task: result<TaskRead>(model, 'read_research_task').task,
          });
        if (!calls.includes('save_research_task')) {
          const read = result<TaskRead>(model, 'read_research_task');
          return tool('save_research_task', {
            task: read.task,
            basis: read.entry.basis,
            content: entry(
              {
                ...read.metadata,
                links: resources.map((resource, index) => {
                  assert(resource.ref.source === 'project');
                  return {
                    id: index === 0 ? 'comparison' : 'result',
                    role: index === 0 ? 'process' : 'result',
                    target: { kind: 'project-file', fileId: resource.ref.fileId },
                    basis: resource.basis,
                  };
                }),
              },
              body,
            ),
          });
        }
        return { text: '已按读取依据将过程与结果关联到任务入口，任务仍待复验。' };
      }
      if (!calls.includes('list_research_tasks'))
        return tool('list_research_tasks', { projectId: domain.projectId });
      if (!calls.includes('read_research_task')) {
        const listed = result<ProjectTaskOutputs['tasks.list']>(model, 'list_research_tasks');
        assert.equal(listed.tasks.length, 1);
        return tool('read_research_task', { task: listed.tasks[0]?.task });
      }
      const read = result<TaskRead>(model, 'read_research_task');
      const links = read.metadata.links ?? [];
      assert.equal(links.length, 2);
      if (reads < links.length) {
        const link = links[reads];
        assert(link?.target.kind === 'project-file' && link.basis);
        return tool('read_context_resource', {
          ref: { source: 'project', projectId: domain.projectId, fileId: link.target.fileId },
          basis: link.basis,
          encoding: 'utf8',
        });
      }
      if (!calls.includes('write_file')) {
        const observed = result<ResourceOutputs['resources.read']>(model, 'read_context_resource');
        assert(observed.data.includes('仅合成样本'));
        return tool('write_file', {
          file_path: '/continued.md',
          content: `# 接续\n入口：${read.path}\n${read.content}\n已读取结果：${observed.data}\n下一步：按人工补充固定温度，再补充对照复验。\n`,
        });
      }
      return { text: '已读取任务入口、比较过程及人工补充，接续已保存。' };
    },
  });
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(join(root, 'profile'), options);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    projectId = project.id;
    await app.call('files.save', {
      projectId,
      path: 'input.md',
      content: '合成输入：观测42，A保留条件，B缺少对照。',
    });
    const old = { projectId, sessionId: (await app.call('session.create', { projectId })).id };
    const created = await send(
      app,
      old,
      'TASK_CREATE previous_private_conversation_73 明确创建比较测量任务，读取input.md，保存长过程和结果，再核查并关联入口。',
    );
    expect(
      created.messages.filter((message) => message.tool?.name === 'create_research_task'),
    ).toHaveLength(1);
    for (const [file, content] of [
      ['comparison.md', processText],
      ['result.md', resultText],
    ] as const)
      expect(await readFile(join(project.path, file), 'utf8')).toBe(content);
    resources = await Promise.all(
      ['comparison.md', 'result.md'].map((file) =>
        app.call('resources.describe', { locator: { source: 'project', projectId, path: file } }),
      ),
    );
    phase = 'link';
    const linked = await send(
      app,
      old,
      `TASK_LINK 核查这些已保存材料并关联入口：${JSON.stringify(resources)}`,
    );
    const oldTools = linked.messages.filter((message) => message.role === 'tool');
    expect(oldTools.every((message) => message.state === 'complete')).toBe(true);
    expect(
      oldTools
        .filter((message) => message.tool?.name === 'read_context_resource')
        .map((message) => JSON.parse(message.tool?.output ?? '{}').data),
    ).toEqual([processText, resultText]);
    const listing = await app.call('tasks.list', { projectId });
    expect(listing.issues).toEqual([]);
    expect(listing.tasks).toHaveLength(1);
    const summary = listing.tasks[0];
    assert(summary);
    const task = summary.task;
    const saved = await app.call('tasks.read', { task });
    expect(saved.metadata.status).toBe('active');
    expect(saved.metadata.links?.map((link) => link.target)).toEqual(
      resources.map((resource) => {
        assert(resource.ref.source === 'project');
        return { kind: 'project-file', fileId: resource.ref.fileId };
      }),
    );
    const saving = oldTools.find((message) => message.tool?.name === 'save_research_task');
    const reading = oldTools.findLast((message) => message.tool?.name === 'read_research_task');
    expect(JSON.parse(saving?.tool?.input ?? '{}').basis).toBe(
      JSON.parse(reading?.tool?.output ?? '{}').entry.basis,
    );
    await app.close();
    app = new KernelApplication(join(root, 'profile'), options);
    await app.initialize();
    const persisted = await app.call('tasks.read', { task });
    expect(persisted).toEqual(saved);
    await app.call('tasks.save', {
      task,
      basis: persisted.entry.basis,
      content: `${persisted.content}\n${manual}\n`,
    });
    phase = 'resume';
    const requestStart = model.requests.length;
    const fresh = { projectId, sessionId: (await app.call('session.create', { projectId })).id };
    expect(fresh.sessionId).not.toBe(old.sessionId);
    const resumed = await send(
      app,
      fresh,
      'TASK_RESUME 从当前项目发现已有研究任务，读取入口、过程、结果和人工补充，保存continued.md。',
    );
    const tools = resumed.messages.filter((message) => message.role === 'tool');
    expect(tools.every((message) => message.state === 'complete')).toBe(true);
    expect(tools.some((message) => message.tool?.name === 'list_research_tasks')).toBe(true);
    expect(tools.some((message) => message.tool?.name === 'read_research_task')).toBe(true);
    expect(
      tools
        .filter((message) => message.tool?.name === 'read_context_resource')
        .map((message) => JSON.parse(message.tool?.output ?? '{}').data),
    ).toEqual([processText, resultText]);
    expect(tools.some((message) => message.tool?.name === 'create_research_task')).toBe(false);
    expect(resumed.artifacts.some((artifact) => artifact.path === 'continued.md')).toBe(true);
    const continued = await readFile(join(project.path, 'continued.md'), 'utf8');
    for (const text of [path, 'B缺少对照', '仅合成样本', manual, '固定温度', '补充对照复验'])
      expect(continued).toContain(text);
    const requests = JSON.stringify(
      model.requests.slice(requestStart).map((request) => request.messages),
    );
    expect(requests).toContain('process_tail_73');
    expect(requests).toContain(manual);
    expect(requests).not.toContain('previous_private_conversation_73');
    expect(await readFile(join(project.path, 'comparison.md'), 'utf8')).toBe(processText);
    expect(await readFile(join(project.path, 'result.md'), 'utf8')).toBe(resultText);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

for (const sourceKind of ['project', 'managed', 'linked'] as const) {
  test(`real ${sourceKind} source failure preserves evidence and waits for a choice before fresh-session continuation`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-task-source-failure-'));
    let projectId = '';
    let source: ResourceDescriptor;
    let attachment: LibraryAttachment | undefined;
    let phase: 'check' | 'choice' | 'resume' = 'check';
    const originalProcess = '# 原过程\n保留原比较理由与限制；尚未采用待核来源。\n';
    const originalResult = '# 已有成果\n已完成的独立观察；不包含待核来源的结论。\n';
    const model = await createModelServer({
      respond: ({ calls, user }) => {
        if (!calls.includes('list_research_tasks'))
          return tool('list_research_tasks', { projectId });
        if (
          calls.filter((name) => name === 'read_research_task').length <
          (phase === 'choice' ? 2 : 1)
        ) {
          const listed = result<ProjectTaskOutputs['tasks.list']>(model, 'list_research_tasks');
          assert.equal(listed.tasks.length, 1);
          return tool('read_research_task', { task: listed.tasks[0]?.task });
        }
        const read = result<TaskRead>(model, 'read_research_task');
        if (phase === 'resume') {
          assert(read.content.includes('deletionClassification'));
          assert(read.content.includes('用户明确选择忽略'));
          const reads = calls.filter((name) => name === 'read_context_resource').length;
          if (reads < 2) {
            const material = read.metadata.links?.find(
              (link) => link.role === (reads === 0 ? 'process' : 'result'),
            );
            assert(material?.target.kind === 'project-file' && material.basis);
            return tool('read_context_resource', {
              ref: { source: 'project', projectId, fileId: material.target.fileId },
              basis: material.basis,
              encoding: 'utf8',
            });
          }
          return {
            text: '已从任务文件重读选择与下一步：等待新增可读来源再复验；原过程与成果保留，未读来源未采用，删除分类仍不可用。',
          };
        }
        if (!calls.includes('read_context_resource')) {
          const link = read.metadata.links?.find((item) => item.role === 'source');
          assert(link?.basis);
          const target = link.target;
          return tool('read_context_resource', {
            ref:
              target.kind === 'project-file'
                ? { source: 'project', projectId, fileId: target.fileId }
                : {
                    source: 'library',
                    attachmentId: target.attachmentId,
                    materialVersionId: target.materialVersionId,
                  },
            basis: link.basis,
            encoding: 'utf8',
          });
        }
        const failure = result<{ error: ErrorInfo }>(model, 'read_context_resource');
        assert.equal(failure.error.code, 'notFound');
        let actualAttachment: LibraryAttachment | undefined;
        if (attachment) {
          if (!calls.includes('library_attachments'))
            return tool('library_attachments', { sourceId: attachment.sourceId });
          actualAttachment = result<LibraryOutputs['library.attachments']>(
            model,
            'library_attachments',
          ).attachments[0];
          assert(actualAttachment);
          assert.equal(actualAttachment.id, attachment.id);
          assert.equal(actualAttachment.materialVersionId, attachment.materialVersionId);
          assert.equal(actualAttachment.storage, sourceKind);
          assert.equal(actualAttachment.state, 'missing');
          assert.deepEqual(actualAttachment.error, failure.error);
        }
        if (phase === 'check')
          return {
            text: '来源读取失败（notFound），依赖分析已暂停。删除记录查询不可用（unavailable），不能据此认定已删除或已查无历史。请选择修正来源或明确忽略这一来源后继续。',
          };
        assert(user.includes('TASK_SOURCE_IGNORE'));
        if (!calls.includes('save_research_task'))
          return tool('save_research_task', {
            task: read.task,
            basis: read.entry.basis,
            content: `${read.content}\n来源异常事实：${JSON.stringify({ ref: source.ref, basis: source.basis, error: failure.error, ...(actualAttachment ? { storage: actualAttachment.storage, state: actualAttachment.state } : {}), deletionClassification: 'unavailable' })}\n用户明确选择忽略。跳过范围：缺失来源及依赖它的比较结论；不声称已核实来源，不计作已采用。\n下一步：仅梳理现有条件，等待新增可读来源再复验。\n`,
          });
        return { text: '已保存用户选择、跳过范围及下一步，缺失来源仍未核实。' };
      },
    });
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      projectId = project.id;
      const taskId = randomUUID();
      const sourcePath = join(sourceKind === 'project' ? project.path : root, 'source.txt');
      await writeFile(sourcePath, 'source_original_73');
      if (sourceKind === 'project') {
        source = await app.call('resources.describe', {
          locator: { source: 'project', projectId, path: 'source.txt' },
        });
      } else {
        await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
        const batch = await app.call('library.importFiles', {
          batchId: randomUUID(),
          paths: [sourcePath],
          storage: sourceKind,
          purpose: '正文',
          version: 'unspecified',
          origin: 'task-source-failure-test',
        });
        await expect
          .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
          .toBe('completed');
        const imported = (await app.call('library.batch', { batchId: batch.id })).entries[0];
        assert(imported?.attachmentId);
        attachment = await app.call('library.attachment', { attachmentId: imported.attachmentId });
        expect(attachment.state).toBe('available');
        source = await app.call('resources.describe', {
          locator: {
            source: 'library',
            attachmentId: attachment.id,
            materialVersionId: attachment.materialVersionId,
          },
        });
      }
      expect(
        (
          await app.call('resources.read', {
            ref: source.ref,
            basis: source.basis,
            encoding: 'utf8',
          })
        ).data,
      ).toBe('source_original_73');
      assert(source.ref.source !== 'render');
      const materialLinks: NonNullable<TaskMetadata['links']> = [];
      for (const [role, text] of [
        ['process', originalProcess],
        ['result', originalResult],
      ] as const) {
        await app.call('files.save', { projectId, path: `${role}.md`, content: text });
        const material = await app.call('resources.describe', {
          locator: { source: 'project', projectId, path: `${role}.md` },
        });
        assert(material.ref.source === 'project');
        materialLinks.push({
          id: role,
          role,
          target: { kind: 'project-file', fileId: material.ref.fileId },
          basis: material.basis,
        });
      }
      const content = entry(
        {
          kind: 'research-task',
          formatVersion: 1,
          id: taskId,
          title: '待核查来源',
          status: 'active',
          links: [
            {
              id: 'missing-source',
              role: 'source',
              target:
                source.ref.source === 'project'
                  ? { kind: 'project-file', fileId: source.ref.fileId }
                  : {
                      kind: 'library-material',
                      attachmentId: source.ref.attachmentId,
                      materialVersionId: source.ref.materialVersionId,
                    },
              basis: source.basis,
            },
            ...materialLinks,
          ],
        },
        '目标：读取来源后比较条件。\n下一步：先核实来源，读取失败须等待用户选择。',
      );
      const created = await app.call('tasks.create', {
        projectId,
        path: `tasks/${taskId}.task.md`,
        operationId: randomUUID(),
        content,
      });
      assert(created.state === 'complete');
      const task = { projectId, taskId, fileId: created.resource.ref.fileId };
      // Deliberate file loss in this isolated profile, not a mocked deletion-history provider.
      await unlink(
        sourceKind === 'managed' && source.ref.source === 'library'
          ? join(app.library.directory, 'materials', source.ref.attachmentId)
          : sourcePath,
      );
      const originalLinks = (await app.call('tasks.read', { task })).metadata.links;
      let originalError: ErrorInfo | undefined;
      try {
        await app.call('resources.read', {
          ref: source.ref,
          basis: source.basis,
          encoding: 'utf8',
        });
        assert.fail('The original source must be unavailable');
      } catch (error) {
        assert(error instanceof Error && 'code' in error && error.code === 'notFound');
        originalError = { code: error.code, message: error.message };
      }
      if (attachment) {
        const unavailable = await app.call('library.attachment', { attachmentId: attachment.id });
        expect(unavailable).toMatchObject({
          id: attachment.id,
          materialVersionId: attachment.materialVersionId,
          storage: sourceKind,
          state: 'missing',
          error: originalError,
        });
        const descriptor = await app.call('resources.describe', { locator: source.ref });
        expect(descriptor.ref).toEqual(source.ref);
        expect(descriptor.basis).toBe(source.basis);
        expect(descriptor.capabilities.read).toBe(false);
      }
      const scope = { projectId, sessionId: (await app.call('session.create', { projectId })).id };
      const stopped = await send(
        app,
        scope,
        'TASK_SOURCE_CHECK 读取任务及来源；失败时询问我并等待选择，不继续依赖分析或保存。',
      );
      const before = stopped.messages.filter((message) => message.role === 'tool');
      const failed = before.find((message) => message.tool?.name === 'read_context_resource');
      expect(failed?.state).toBe('error');
      expect(JSON.parse(failed?.tool?.output ?? '{}')).toEqual({ error: originalError });
      expect(JSON.parse(failed?.tool?.input ?? '{}')).toMatchObject({
        ref: source.ref,
        basis: source.basis,
      });
      const answer = stopped.messages
        .filter((message) => message.role === 'assistant')
        .map((message) => message.text)
        .join('\n');
      expect(answer).toContain('读取失败');
      expect(answer).toContain('请选择');
      expect(answer).toContain('unavailable');
      expect(
        before.some((message) =>
          ['write_file', 'edit_file', 'save_research_task', 'create_research_task'].includes(
            message.tool?.name ?? '',
          ),
        ),
      ).toBe(false);
      expect(stopped.artifacts).toEqual([]);
      expect((await app.call('tasks.read', { task })).content).toBe(content);
      expect(await readFile(join(project.path, `tasks/${taskId}.task.md`), 'utf8')).toBe(content);
      phase = 'choice';
      const choiceId = randomUUID();
      const receipt = await app.call('session.send', {
        ...scope,
        instructionId: choiceId,
        text: 'TASK_SOURCE_IGNORE 我明确选择忽略这一缺失来源；保存跳过范围与下一步，不补造来源内容。',
        materials: [],
      });
      await expect
        .poll(
          async () => {
            const run = (await app.snapshot(scope)).run;
            return { id: run?.id, state: run?.state };
          },
          { timeout: 20000 },
        )
        .toEqual({ id: receipt.runId, state: 'completed' });
      const resumed = await app.snapshot(scope);
      expect(resumed.messages.find((message) => message.id === choiceId)?.state).toBe('consumed');
      const tools = resumed.messages.filter((message) => message.role === 'tool');
      expect(
        tools.filter((message) => message.tool?.name === 'read_context_resource'),
      ).toHaveLength(1);
      const savedTools = tools.filter((message) => message.tool?.name === 'save_research_task');
      expect(savedTools).toHaveLength(1);
      expect(savedTools[0]?.state).toBe('complete');
      expect(savedTools[0]?.tool?.runId).toBe(receipt.runId);
      const saved = await app.call('tasks.read', { task });
      for (const text of [
        '用户明确选择忽略',
        '跳过范围',
        '缺失来源及依赖它的比较结论',
        '下一步',
        '等待新增可读来源',
      ])
        expect(saved.content).toContain(text);
      expect(saved.metadata.links).toEqual(originalLinks);
      expect(saved.content).not.toContain('source_original_73');
      const diagnosticLine = saved.content
        .split('\n')
        .find((line) => line.startsWith('来源异常事实：'));
      assert(diagnosticLine);
      expect(JSON.parse(diagnosticLine.slice('来源异常事实：'.length))).toEqual({
        ref: source.ref,
        basis: source.basis,
        error: originalError,
        ...(attachment ? { storage: sourceKind, state: 'missing' } : {}),
        deletionClassification: 'unavailable',
      });
      expect(saved.metadata.status).toBe('active');
      expect(await readFile(join(project.path, saved.path), 'utf8')).toBe(saved.content);
      phase = 'resume';
      const freshScope = {
        projectId,
        sessionId: (await app.call('session.create', { projectId })).id,
      };
      const fresh = await send(
        app,
        freshScope,
        '仅从项目任务文件找到已保存选择和下一步，重读原过程与成果；不要重新读取已明确跳过的来源。',
      );
      const freshTools = fresh.messages.filter((message) => message.tool);
      expect(fresh.messages.some((message) => message.id === choiceId)).toBe(false);
      const freshReads = freshTools.filter(
        (message) => message.tool?.name === 'read_context_resource',
      );
      expect(freshReads.map((message) => JSON.parse(message.tool?.output ?? '{}').data)).toEqual([
        originalProcess,
        originalResult,
      ]);
      expect(
        freshTools.some((message) =>
          ['save_research_task', 'write_file', 'edit_file'].includes(message.tool?.name ?? ''),
        ),
      ).toBe(false);
      expect(
        fresh.messages
          .filter((message) => message.role === 'assistant')
          .map((message) => message.text)
          .join('\n'),
      ).toContain('等待新增可读来源');
      expect((await app.call('tasks.read', { task })).content).toBe(saved.content);
      expect(await readFile(join(project.path, 'process.md'), 'utf8')).toBe(originalProcess);
      expect(await readFile(join(project.path, 'result.md'), 'utf8')).toBe(originalResult);
      await test.info().attach('source-failure-continuation', {
        body: JSON.stringify({
          task,
          source,
          error: originalError,
          ...(attachment ? { storage: sourceKind, state: 'missing' } : {}),
          deletionClassification: 'unavailable',
          check: { sessionId: scope.sessionId, run: stopped.run, tool: failed?.tool, answer },
          choice: {
            instructionId: choiceId,
            runId: receipt.runId,
            savedTool: savedTools[0]?.tool,
            content: saved.content,
          },
          fresh: {
            sessionId: freshScope.sessionId,
            run: fresh.run,
            tools: freshTools.map((message) => message.tool),
          },
        }),
        contentType: 'application/json',
      });
      if (sourceKind === 'linked' && attachment) {
        await writeFile(sourcePath, 'replacement_is_not_recovery_91');
        expect(await app.call('library.attachment', { attachmentId: attachment.id })).toMatchObject(
          { materialVersionId: attachment.materialVersionId, state: 'changed' },
        );
        await expect(
          app.call('resources.read', { ref: source.ref, basis: source.basis, encoding: 'utf8' }),
        ).rejects.toMatchObject({ code: 'contentChanged' });
      }
    } finally {
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
