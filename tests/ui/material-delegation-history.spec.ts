import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { DelegationRequest } from '../../packages/protocol/dist/index.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('real parent and delegated edits reach material history and whole undo protects overlapping human work', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  const result = info.outputPath(`material-delegation-${info.project.name}`);
  await mkdir(result, { recursive: true });
  const root = join(result, 'project');
  const work: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.read', 'resource.create'],
    workPackage: {
      objective: 'CHILD_DELEGATION Check the original material.',
      requirements: 'Save report.md and report its actual resource.',
      materials: [],
      outputs: [{ kind: 'create', path: 'report.md' }],
    },
  };
  const childText = '# Report\n\nObserved 42 from the original material.\n';
  const parentText = '# Report\n\nParent checked observation 42 from the delegated report.\n';
  // Only model responses are scripted; both workers, saves, origins and the history UI are real.
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      const body = model.requests.at(-1);
      assert(body);
      if (user.includes('PARENT_DELEGATION')) {
        if (!calls.includes('delegate_agent'))
          return { tool: { name: 'delegate_agent', input: work } };
        const waited = delegationOutput(body, 'wait_delegation')?.delegation;
        if (!waited || ['accepted', 'running', 'cancelling'].includes(waited.state))
          return {
            tool: {
              name: 'wait_delegation',
              input: { delegationId: work.delegationId, waitMs: 5000 },
            },
          };
        const resource = waited.artifacts?.[0]?.resource;
        assert(resource);
        if (!calls.includes('read_context_resource'))
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: resource.ref, basis: resource.basis, encoding: 'utf8' },
            },
          };
        if (!calls.includes('read_file'))
          return { tool: { name: 'read_file', input: { file_path: '/report.md' } } };
        if (!calls.includes('edit_file')) {
          expect(delegationOutput(body, 'read_context_resource')?.data).toBe(childText);
          return {
            tool: {
              name: 'edit_file',
              input: { file_path: '/report.md', old_string: childText, new_string: parentText },
            },
          };
        }
        return { text: 'Parent read and revised the delegated report.' };
      }
      const material = work.workPackage.materials[0];
      assert(material?.ref.source === 'project');
      if (!calls.includes('read_context_resource'))
        return {
          tool: {
            name: 'read_context_resource',
            input: { ref: material.ref, basis: material.basis, encoding: 'utf8' },
          },
        };
      if (!calls.includes('create_delegation_resource'))
        return {
          tool: {
            name: 'create_delegation_resource',
            input: {
              projectId: material.ref.projectId,
              path: 'report.md',
              operationId: 'delegation-history-report',
              content: childText,
            },
          },
        };
      if (!calls.includes('report_delegation')) {
        const saved = delegationOutput(body, 'create_delegation_resource')?.resource;
        assert(saved);
        return {
          tool: {
            name: 'report_delegation',
            input: {
              findings: 'Observed 42.',
              unfinished: '',
              blockers: '',
              artifacts: [{ ref: saved.ref, basis: saved.basis }],
            },
          },
        };
      }
      return { text: 'Child saved its report.' };
    },
  });
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory);
  const stop = await startModelKernel(directory, model.url);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  try {
    await client.call('provider.configure', { apiKey: 'synthetic-material-delegation' });
    const project = await client.call('project.create', { path: root, trust: 'trusted' });
    await client.call('files.save', {
      projectId: project.id,
      path: 'input.md',
      content: 'Original observation: 42.',
    });
    const material = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.md' },
    });
    work.workPackage.materials = [{ ref: material.ref, basis: material.basis }];
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, root);
    await createSession(uiPage, { projectId: project.id });
    const session = (await client.call('session.list', { projectId: project.id })).sessions[0];
    assert(session);
    const scope = { projectId: project.id, sessionId: session.id };
    const composer = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
    await composer.fill('PARENT_DELEGATION');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(composer).toHaveValue('');
    const draft = 'Retained follow-up draft after delegated work.';
    await composer.fill(draft);
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state, {
        timeout: 25000,
      })
      .toBe('completed');
    const delegation = await client.call('delegation.get', {
      ...scope,
      delegationId: work.delegationId,
    });
    expect(delegation).toMatchObject({ state: 'completed', resultState: 'available' });
    assert(delegation.childInstanceId);
    expect(delegation.childInstanceId).not.toBe(delegation.parentInstanceId);
    const history = uiPage.getByRole('region', { name: '文件修改历史', exact: true });
    const selected = history.getByRole('region', { name: '选定修改', exact: true });
    const field = (label: string) =>
      selected
        .getByRole('term')
        .filter({ hasText: label })
        .locator('xpath=following-sibling::dd[1]');
    const file = await client.call('files.read', { projectId: project.id, path: 'report.md' });
    assert(file.fileId);
    const historyInput = { projectId: project.id, fileId: file.fileId };
    const changes = await client.call('files.changes', historyInput);
    const parentChange = changes.changes.find(
      (change) =>
        change.origin?.kind === 'execution' &&
        change.origin.instanceId === delegation.parentInstanceId,
    );
    const childChange = changes.changes.find(
      (change) =>
        change.origin?.kind === 'execution' &&
        change.origin.instanceId === delegation.childInstanceId,
    );
    assert(
      parentChange?.beforeEvidence && parentChange.afterEvidence && childChange?.afterEvidence,
    );
    expect(parentChange.beforeEvidence).toEqual(childChange.afterEvidence);
    expect(parentChange.beforeEvidence.ref).toEqual({
      source: 'project',
      projectId: project.id,
      fileId: file.fileId,
    });
    expect(changes).toMatchObject({
      changes: [
        { editId: parentChange.editId, fileId: file.fileId },
        { editId: childChange.editId, fileId: file.fileId },
      ],
      coverage: { current: 'matchesLatest' },
    });
    const originalBytes = await readFile(join(root, 'report.md'));
    expect(originalBytes.toString('utf8')).toBe(parentText);
    const editor = uiPage.getByRole('textbox', { name: '文件内容 report.md', exact: true });
    await uiPage.getByRole('treeitem', { name: '打开文件 report.md', exact: true }).dblclick();
    await expect(editor).toContainText('Parent checked observation 42 from the delegated report.');
    await uiPage.getByRole('button', { name: '修改历史', exact: true }).click();
    for (const [change, instanceId] of [
      [parentChange, delegation.parentInstanceId],
      [childChange, delegation.childInstanceId],
    ] as const) {
      const edit = await client.call('files.edit', {
        ...historyInput,
        editId: change.editId,
      });
      expect(edit.origin).toMatchObject({
        kind: 'execution',
        ...scope,
        runId: delegation.parentRunId,
        instanceId,
        principal: { kind: 'agent', id: session.id },
        instructionContext: { state: 'unknown' },
        tool: { state: 'unknown' },
      });
      assert(edit.afterEvidence);
      await history.getByRole('button', { name: `查看修改 ${edit.id}`, exact: true }).click();
      await expect(field('执行者')).toContainText('Agent执行修改');
      await expect(field('会话／运行／执行实例')).toContainText(instanceId);
      await expect(field('会话／运行／执行实例')).toContainText(delegation.parentRunId);
      await expect(field('修改后依据')).toContainText(edit.afterEvidence.basis);
      await expect(field('单次修改对应指令')).toContainText('未知');
      await expect(field('工具关联')).toContainText('未知');
      await expect(field('修改理由')).toContainText('未知');
      if (instanceId === delegation.childInstanceId) {
        expect(edit.origin).toMatchObject({
          delegation: {
            delegationId: delegation.id,
            parentRunId: delegation.parentRunId,
            parentInstanceId: delegation.parentInstanceId,
          },
        });
        for (const id of [delegation.id, delegation.parentRunId, delegation.parentInstanceId])
          await expect(field('委派关联')).toContainText(id);
      } else {
        assert(edit.origin?.kind === 'execution');
        expect(edit.origin.delegation).toBeUndefined();
        await expect(field('委派关联')).toContainText('未知');
        await expect(field('修改前依据')).toContainText(childChange.afterEvidence.basis);
      }
    }
    await history
      .getByRole('button', { name: `查看修改 ${parentChange.editId}`, exact: true })
      .click();
    await expect(selected).toContainText(parentChange.editId);
    const overlap = '# Report\n\nHuman overlapping correction.\n';
    await editor.click();
    await editor.press('ControlOrMeta+A');
    await uiPage.keyboard.insertText(overlap);
    await expect(selected.getByRole('button', { name: '撤销此修改', exact: true })).toBeDisabled();
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await expect.poll(() => readFile(join(root, 'report.md'), 'utf8')).toBe(overlap);
    const human = (await client.call('files.changes', historyInput)).changes[0];
    assert(human?.afterEvidence && human.beforeEvidence);
    expect(human.origin?.kind).toBe('human');
    expect(human.beforeEvidence).toEqual(parentChange.afterEvidence);
    const requestsBeforeUndo = model.requests.length;
    const runBeforeUndo = (await client.call('workbench.snapshot', scope)).run?.id;
    await expect(selected.getByRole('button', { name: '撤销此修改', exact: true })).toBeEnabled();
    await selected.getByRole('button', { name: '撤销此修改', exact: true }).click();
    await expect(history.getByRole('alert')).toContainText('contentChanged');
    expect(await readFile(join(root, 'report.md'), 'utf8')).toBe(overlap);
    await expect(selected).toContainText(parentChange.editId);
    await history.getByRole('button', { name: '重读修改历史', exact: true }).click();
    await history.getByRole('button', { name: `查看修改 ${human.editId}`, exact: true }).click();
    await expect(field('执行者')).toContainText('人工修改');
    await expect(field('修改前依据')).toContainText(human.beforeEvidence.basis);
    await expect(field('修改后依据')).toContainText(human.afterEvidence.basis);
    await selected.getByRole('button', { name: '撤销此修改', exact: true }).click();
    await expect(history.getByRole('status').filter({ hasText: '撤销已保存' })).toBeVisible();
    expect(await readFile(join(root, 'report.md'))).toEqual(originalBytes);
    await expect(field('撤销了修改')).toContainText(human.editId);
    const undo = (
      await client.call('files.changes', { ...historyInput, afterEditId: human.editId })
    ).changes[0];
    assert(undo?.beforeEvidence && undo.afterEvidence);
    expect(undo).toMatchObject({
      fileId: file.fileId,
      origin: { kind: 'human' },
      revertsEditId: human.editId,
    });
    const detail = await client.call('files.edit', { ...historyInput, editId: undo.editId });
    expect(detail).toMatchObject({
      before: overlap,
      after: parentText,
      revertsEditId: human.editId,
    });
    expect(detail.beforeEvidence).toEqual(human.afterEvidence);
    await expect(field('修改前依据')).toContainText(undo.beforeEvidence.basis);
    await expect(field('修改后依据')).toContainText(undo.afterEvidence.basis);
    expect(model.requests).toHaveLength(requestsBeforeUndo);
    expect((await client.call('workbench.snapshot', scope)).run?.id).toBe(runBeforeUndo);
    await expect(composer).toHaveValue(draft);
    await info.attach('material-delegation-history', {
      body: JSON.stringify({
        scope,
        delegation,
        fileId: file.fileId,
        parentChange,
        childChange,
        human,
        undo,
        detail,
      }),
      contentType: 'application/json',
    });
  } finally {
    model.release();
    client.dispose();
    await stop();
    await model.close();
  }
});
