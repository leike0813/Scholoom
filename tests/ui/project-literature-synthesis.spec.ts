import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { TaskGraphInputs, TaskMetadata } from '../../packages/protocol/dist/projects.js';
import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';
import { synthesisModelResponse } from '../fixtures/project-literature-synthesis-model.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer, type ModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('task synthesis waits in the shared conversation and continues with new evidence in a new session', async ({
  uiPage: ui,
  uiRpc,
}, info) => {
  test.setTimeout(120000);
  const path = info.outputPath('project');
  await mkdir(info.outputDir, { recursive: true });
  const materials: ResourceEvidence[] = [];
  const resumeMaterials: ResourceEvidence[] = [];
  let priorReport: ResourceEvidence | undefined;
  let respond = synthesisModelResponse(() => materials);
  let asked = false;
  let supplement = false;
  const prompt = '请明确是否只比较当前合成样本。发送“继续核查：只比较当前合成样本”。';
  const impact =
    '新增来源C=100来自不同条件的单样本，不能并入A与B的差值；保留42与17相差25的判断，条件覆盖仍不足，下一步独立复验。';
  const model: ModelServer = await createModelServer({
    respond: async (input) => {
      if (supplement && !resumeMaterials.length) {
        assert(priorReport);
        // The model uses the actual saved process Evidence supplied in its node guidance.
        const system = model.requests.at(-1)!.system as { text: string }[];
        const roles = /已保存角色：([^\n]+)/u.exec(system.map((block) => block.text).join('\n'));
        assert(roles);
        const saved = JSON.parse(roles[1]!).find(
          (item: { role: string }) => item.role === 'process',
        ).result.resource as ResourceEvidence;
        resumeMaterials.push(priorReport, { ref: saved.ref, basis: saved.basis });
      }
      // Only the external HTTP response chooses a real business-node question.
      if (
        !asked &&
        input.calls.filter((name) => name === 'read_context_resource').length === materials.length
      ) {
        asked = true;
        return {
          text: JSON.stringify({ process: '已有合成样本，比较范围须明确。', next: 'wait', prompt }),
        };
      }
      const plan = await respond(input);
      if (!supplement || !plan || !('text' in plan)) return plan;
      const answer = JSON.parse(plan.text);
      return {
        text: JSON.stringify({
          ...answer,
          process: `${answer.process}\n${impact}`,
          ...(answer.report ? { report: `${answer.report}\n\n${impact}` } : {}),
        }),
      };
    },
  });
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR!;
  const stop = await startModelKernel(directory, model.url);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  try {
    await client.call('provider.configure', { apiKey: 'synthetic-ui-synthesis' });
    const project = await client.call('project.create', { path, trust: 'trusted' });
    const sourceText = '合成来源：样本A=42；样本B=17。两组各n=1。';
    await client.call('files.save', {
      projectId: project.id,
      path: 'source.txt',
      content: sourceText,
    });
    const source = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'source.txt' },
    });
    materials.push({ ref: source.ref, basis: source.basis });
    assert(source.ref.source === 'project');
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: 'synthesis',
      title: '综合比较任务',
      status: 'active',
      workItems: [{ id: 'comparison', title: '比较工作项' }],
      links: [
        {
          id: 'original-source',
          role: 'source',
          workItemId: 'comparison',
          note: '原合成来源',
          target: { kind: 'project-file', fileId: source.ref.fileId },
          basis: source.basis,
        },
      ],
    };
    const created = await client.call('tasks.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'tasks/synthesis.task.md',
      content: `---\n${JSON.stringify(metadata)}\n---\n\n比较合成样本，保留采用条件、局限和下一步。\n`,
    });
    assert(created.state === 'complete');
    const task = {
      projectId: project.id,
      taskId: metadata.id,
      fileId: created.resource.ref.fileId,
    };
    const requests: TaskGraphInputs['tasks.runGraph'][] = [];
    ui.on('websocket', (socket) =>
      socket.on('framesent', ({ payload }) => {
        const frame = JSON.parse(payload.toString());
        if (frame.method === 'tasks.runGraph') requests.push(frame.params);
      }),
    );
    await ui.goto(rendererUrl);
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(ui, path);
    await createSession(ui, { projectId: project.id });
    const sessionId = async () => {
      const id = await ui
        .getByRole('button', { name: /^打开会话 /, pressed: true })
        .evaluate((button) => button.closest('li')?.getAttribute('data-session-id'));
      assert(id);
      return id;
    };
    const firstScope = { projectId: project.id, sessionId: await sessionId() };
    const composer = ui.getByRole('textbox', { name: '研究指令', exact: true });
    const draft = '保留未提交的比较要求';
    await composer.fill(draft);
    await ui.getByRole('tab', { name: '任务', exact: true }).click();
    await ui.getByRole('option', { name: /^综合比较任务 / }).click();
    const detail = ui.getByRole('region', { name: '研究任务详情', exact: true });
    const openTask = async () => {
      await ui.getByRole('tab', { name: '任务', exact: true }).click();
      await ui.getByRole('option', { name: /^综合比较任务 / }).click();
    };
    await detail.getByRole('button', { name: '比较工作项', exact: true }).click();
    await detail.getByRole('button', { name: '运行科研图', exact: true }).click();
    const form = detail.getByRole('form', { name: '运行科研图', exact: true });
    const config = {
      question: '比较合成样本42与17及限制。',
      reportTarget: { kind: 'create', path: 'report.md' },
      processTarget: { kind: 'create', path: 'process.md' },
      requireIndependentReview: false,
    };
    await form
      .getByRole('combobox', { name: '科研图及版本' })
      .selectOption(JSON.stringify(['scholoom.project-literature-synthesis', '1']));
    await form.getByRole('checkbox', { name: /原合成来源/ }).check();
    await form.getByRole('textbox', { name: 'JSON 配置' }).fill(JSON.stringify(config));
    await form.getByRole('button', { name: '提交科研图调用', exact: true }).click();
    await expect.poll(() => requests.length).toBe(1);
    const firstRequest = requests[0]!;
    const snapshot = () => client.call('workbench.snapshot', firstScope);
    await expect
      .poll(async () => (await snapshot()).run?.state, { timeout: 30000 })
      .toBe('waiting');
    const waiting = (await snapshot()).run!;
    expect(waiting.graph).toMatchObject({ graphId: firstRequest.graphId, version: '1' });
    assert(waiting.graphProgress?.kind === 'graph.waiting');
    expect(waiting.graphProgress.wait.prompt).toBe(prompt);
    const dock = ui.getByRole('button', { name: '展开 Agent 会话', exact: true });
    await expect(dock).toContainText(prompt);
    await dock.click();
    const graph = ui.getByRole('region', { name: '科研图状态', exact: true });
    await expect(graph).toHaveCount(1);
    await expect(graph).toContainText(prompt);
    await expect(composer).toHaveValue(draft);
    await ui.getByRole('button', { name: '收起会话', exact: true }).click();
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await expect(composer).toHaveValue(draft);
    await expect(dock).toContainText(prompt);
    await composer.fill('继续核查：只比较当前合成样本');
    await ui.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(composer).toHaveValue('');
    await composer.fill(draft);
    await expect
      .poll(async () => (await snapshot()).run?.state, { timeout: 30000 })
      .toBe('completed');
    const firstRun = (await snapshot()).run!;
    expect(firstRun.id).toBe(waiting.id);
    const firstCall = (
      await client.call('research.graphCalls', {
        ...firstScope,
        invocationId: firstRequest.invocationId,
      })
    ).calls[0]!;
    expect(firstCall.executions).toHaveLength(1);
    expect(firstCall.executions[0]?.check).toMatchObject({
      delivery: 'usable',
      researchAssessment: 'notAssessed',
    });
    const firstRoles = firstRun.graphProgress?.evidence.roleResults;
    assert(firstRoles?.length === 2);
    const report = firstRoles.find((item) => item.role === 'report')!.result.resource;
    const process = firstRoles.find((item) => item.role === 'process')!.result.resource;
    const oldReport = await readFile(join(path, 'report.md'), 'utf8');
    const oldProcess = await readFile(join(path, 'process.md'), 'utf8');
    expect(oldReport).toContain('相差25');
    expect(oldProcess).toContain('只比较当前合成样本');
    expect(oldProcess).toContain('形成比较维度');
    expect(firstRun.graphProgress?.evidence.contentReads).toContainEqual({
      resource: materials[0],
      content: {
        kind: 'text',
        offset: 0,
        length: sourceText.length,
        size: sourceText.length,
        truncated: false,
      },
    });
    await dock.click();
    await graph.getByRole('button', { name: '打开当前成果 report.md', exact: true }).click();
    await expect(
      ui.getByRole('textbox', { name: '文件内容 report.md', exact: true }),
    ).toContainText('相差25');
    await expect(composer).toHaveValue(draft);
    await openTask();
    await detail.getByRole('button', { name: '重读入口', exact: true }).click();
    await detail.getByRole('button', { name: '打开成果材料', exact: true }).click();
    await expect(
      ui.getByRole('textbox', { name: '文件内容 report.md', exact: true }),
    ).toContainText('相差25');
    await openTask();
    // graph-call pointers are also process links; choose the real research process by its saved role.
    const firstTask = await client.call('tasks.read', { task });
    const processLink = firstTask.metadata.links?.find(
      (link) =>
        link.role === 'process' &&
        link.target.kind === 'project-file' &&
        process.ref.source === 'project' &&
        link.target.fileId === process.ref.fileId,
    );
    assert(processLink);
    const links = firstTask.metadata.links ?? [];
    const rows = detail
      .getByRole('region', { name: '任务关联材料', exact: true })
      .getByRole('listitem');
    await expect(rows).toHaveCount(links.length);
    const processRow = rows.nth(links.indexOf(processLink));
    await processRow.getByRole('button', { name: '打开过程材料', exact: true }).click();
    await expect(
      ui.getByRole('textbox', { name: '文件内容 process.md', exact: true }),
    ).toContainText('研究问题');
    await expect(composer).toHaveValue(draft);

    const firstInput = firstRun.graph?.materials?.find((item) => item.role === 'task-input');
    assert(firstInput);
    const oldSnapshot = await client.call('resources.read', {
      ref: firstInput.ref,
      basis: firstInput.basis,
      encoding: 'utf8',
      limit: 16384,
    });
    const oldTaskInput = JSON.parse(oldSnapshot.data);
    expect(oldTaskInput).toMatchObject({
      task,
      invocationId: firstRequest.invocationId,
      instructionId: firstRequest.instructionId,
      sources: [{ linkId: 'original-source', evidence: materials[0] }],
    });

    await client.call('files.save', {
      projectId: project.id,
      path: 'supplement.txt',
      content: '新增合成来源C=100，来自不同条件，n=1，不能直接合并。',
    });
    const extra = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'supplement.txt' },
    });
    materials.push({ ref: extra.ref, basis: extra.basis });
    supplement = true;
    priorReport = { ref: report.ref, basis: report.basis };
    respond = synthesisModelResponse(() => [...materials, ...resumeMaterials]);
    await createSession(ui, { projectId: project.id });
    const nextScope = { projectId: project.id, sessionId: await sessionId() };
    expect(nextScope.sessionId).not.toBe(firstScope.sessionId);
    await composer.fill('补充后的未提交草稿');
    await openTask();
    await detail.getByRole('button', { name: '重读入口', exact: true }).click();
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    const association = ui.getByRole('form', { name: '关联任务材料' });
    await association.getByRole('textbox', { name: '项目内材料路径' }).fill('supplement.txt');
    await association.getByRole('combobox', { name: '材料用途' }).selectOption('source');
    await association.getByRole('textbox', { name: '采用说明' }).fill('补充不同条件来源');
    await association.getByRole('button', { name: '保存关联', exact: true }).click();
    await expect(association).toHaveCount(0);
    await detail.getByRole('button', { name: '比较工作项', exact: true }).click();
    const reopen = detail.getByRole('button', { name: '运行科研图', exact: true });
    if ((await reopen.getAttribute('aria-expanded')) !== 'true') await reopen.click();
    const newCall = form.getByRole('button', { name: '新建科研图调用', exact: true });
    if (await newCall.count()) await newCall.click();
    await form
      .getByRole('combobox', { name: '科研图及版本' })
      .selectOption(JSON.stringify(['scholoom.project-literature-synthesis', '1']));
    await form.getByRole('checkbox', { name: /原合成来源/ }).check();
    await form.getByRole('checkbox', { name: /补充不同条件来源/ }).check();
    const prior = [report, process].map(({ ref, basis }) => ({ ref, basis }));
    const continuedConfig = {
      ...config,
      question: '加入不同条件来源C，重读旧过程和报告，解释保留或修订判断的理由。',
      prior,
      reportTarget: { kind: 'update', resource: prior[0] },
      processTarget: { kind: 'update', resource: prior[1] },
    };
    await form.getByRole('textbox', { name: 'JSON 配置' }).fill(JSON.stringify(continuedConfig));
    const modelBefore = model.requests.length;
    await form.getByRole('button', { name: '提交科研图调用', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    const secondRequest = requests[1]!;
    expect(secondRequest.sessionId).toBe(nextScope.sessionId);
    expect(secondRequest.invocationId).not.toBe(firstRequest.invocationId);
    expect(secondRequest.config).toEqual(continuedConfig);
    await expect
      .poll(async () => (await client.call('workbench.snapshot', nextScope)).run?.state, {
        timeout: 30000,
      })
      .toBe('completed');
    const secondRun = (await client.call('workbench.snapshot', nextScope)).run!;
    expect(secondRun.id).not.toBe(firstRun.id);
    expect(secondRun.graph).toMatchObject({ graphId: firstRequest.graphId, version: '1' });
    const secondCall = (
      await client.call('research.graphCalls', {
        ...nextScope,
        invocationId: secondRequest.invocationId,
      })
    ).calls[0]!;
    expect(secondCall.executions[0]?.check).toMatchObject({
      delivery: 'usable',
      researchAssessment: 'notAssessed',
    });
    const evidence = secondRun.graphProgress!.evidence;
    for (const material of materials)
      expect(evidence.contentReads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resource: material,
            content: expect.objectContaining({ kind: 'text', length: expect.any(Number) }),
          }),
        ]),
      );
    const modelContext = JSON.stringify(model.requests.slice(modelBefore));
    for (const content of [sourceText, '新增合成来源C=100', '形成比较维度', '相差25'])
      expect(modelContext).toContain(content);
    const received = model.requests
      .slice(modelBefore)
      .flatMap((request) =>
        (request.messages as { content: { type: string; content?: string }[] }[]).flatMap(
          (message) =>
            Array.isArray(message.content)
              ? message.content
                  .filter((block) => block.type === 'tool_result' && block.content)
                  .map((block) => JSON.parse(block.content!))
              : [],
        ),
      );
    expect(received).toContainEqual(expect.objectContaining({ ...prior[0], data: oldReport }));
    expect(received).toContainEqual(
      expect.objectContaining({ ...resumeMaterials[1], data: expect.stringContaining(oldProcess) }),
    );
    const currentTask = await client.call('tasks.read', { task });
    for (const [index, role] of ['report', 'process'].entries()) {
      const result = evidence.roleResults!.find((item) => item.role === role)!.result;
      expect(result.resource.ref).toEqual(prior[index]!.ref);
      expect(result.resource.basis).not.toBe(prior[index]!.basis);
      assert(result.editId);
      const name = `${role}.md`;
      const history = await client.call('files.history', { projectId: project.id, path: name });
      const edit = history.find((item) => item.id === result.editId);
      expect(edit).toMatchObject({
        afterEvidence: { ref: result.resource.ref, basis: result.resource.basis },
        origin: {
          kind: 'execution',
          projectId: project.id,
          sessionId: nextScope.sessionId,
          runId: secondRun.id,
        },
      });
      expect(history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            beforeEvidence: prior[index],
            before: index === 0 ? oldReport : oldProcess,
            origin: expect.objectContaining({
              kind: 'execution',
              sessionId: nextScope.sessionId,
              runId: secondRun.id,
            }),
          }),
        ]),
      );
      expect(history.some((item) => item.afterEvidence?.basis === prior[index]!.basis)).toBe(true);
      expect(
        currentTask.metadata.links?.filter(
          (link) =>
            link.target.kind === 'project-file' &&
            result.resource.ref.source === 'project' &&
            link.target.fileId === result.resource.ref.fileId,
        ),
      ).toEqual([
        expect.objectContaining({
          role: role === 'report' ? 'result' : 'process',
          basis: result.resource.basis,
          workItemId: 'comparison',
        }),
      ]);
      expect(await readFile(join(path, name), 'utf8')).toContain(impact);
    }
    expect(
      (
        await client.call('resources.read', {
          ref: firstInput.ref,
          basis: firstInput.basis,
          encoding: 'utf8',
          limit: 16384,
        })
      ).data,
    ).toBe(oldSnapshot.data);
    const historical = (
      await client.call('research.graphCalls', {
        ...firstScope,
        invocationId: firstRequest.invocationId,
      })
    ).calls[0]!;
    expect(historical.call).toEqual(firstCall.call);
    expect(historical.executions[0]?.run.graphProgress).toEqual(firstRun.graphProgress);
    const secondInput = secondRun.graph!.materials!.find((item) => item.role === 'task-input')!;
    expect(secondInput.ref).not.toEqual(firstInput.ref);
    const newSnapshot = JSON.parse(
      (
        await client.call('resources.read', {
          ref: secondInput.ref,
          basis: secondInput.basis,
          encoding: 'utf8',
          limit: 16384,
        })
      ).data,
    );
    expect(newSnapshot.sources).toHaveLength(2);
    expect(secondCall.call.config).toEqual(continuedConfig);
    await expect(composer).toHaveValue('补充后的未提交草稿');
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await expect(composer).toHaveValue('补充后的未提交草稿');
    await writeFile(
      info.outputPath('synthesis-evidence.json'),
      JSON.stringify(
        {
          task,
          firstRequest,
          secondRequest,
          firstCall,
          secondCall,
          oldTaskInput,
          newSnapshot,
          oldReport,
          oldProcess,
          currentTask,
        },
        null,
        2,
      ),
    );
    await ui.screenshot({ path: info.outputPath('synthesis-completed.png') });
  } finally {
    await writeFile(info.outputPath('model-requests.json'), JSON.stringify(model.requests));
    try {
      await uiRpc.save(info);
    } finally {
      client.dispose();
      await stop();
      await model.close();
    }
  }
});
