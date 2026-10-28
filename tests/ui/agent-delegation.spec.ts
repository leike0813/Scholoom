import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { DelegationRequest } from '../../packages/protocol/dist/index.js';
import { observationErrorCode } from '../execution-observer.js';
import { delegationModel } from '../fixtures/delegation-model.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

for (const cancel of [false, true]) {
  test(`user observes actual delegation, ${cancel ? 'cancels its child' : 'opens its saved report'} and retains the conversation draft`, async ({
    uiPage,
    uiRpc,
  }) => {
    test.setTimeout(120000);
    const root = test.info().outputPath('projects');
    await mkdir(root, { recursive: true });
    const path = join(root, `delegation-${randomUUID().slice(0, 8)}`);
    const work: DelegationRequest = {
      delegationId: randomUUID(),
      roleId: 'worker',
      roleVersion: '1',
      tools: ['resource.read', 'resource.create', 'resource.creation', 'scratch'],
      workPackage: {
        objective: 'CHILD_DELEGATION Check the original material.',
        requirements: 'Save report.md.',
        materials: [],
        outputs: [{ kind: 'create', path: 'report.md' }],
      },
    };
    const model = await delegationModel(work, { childHold: cancel });
    const directory = process.env.SCHOOLOOM_UI_DATA_DIR!;
    const stop = await startModelKernel(directory, model.url);
    const client = createKernelClient(await runningKernel(directory));
    await client.connect();
    try {
      await client.call('provider.configure', { apiKey: 'synthetic-ui-delegation' });
      const project = await client.call('project.create', { path, trust: 'trusted' });
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
      await addProject(uiPage, path);
      await createSession(uiPage, basename(path));
      const sessionId = await uiPage
        .getByRole('button', { name: /^打开会话 /, pressed: true })
        .evaluate(
          (button) => button.closest('[data-session-id]')?.getAttribute('data-session-id'),
          undefined,
          { timeout: 500 },
        )
        .catch(() => undefined);
      const composer = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
      await composer.fill('PARENT_DELEGATION');
      const modelRequestsAtSend = model.requests.length;
      await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
      await expect(composer).toHaveValue('');
      await composer.fill('Retained user draft');
      await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
      const tool = uiPage.locator('details.tool-call').filter({ hasText: 'Ran delegate_agent' });
      const assertionStartedAt = Date.now();
      let outcome = 'failed';
      try {
        await expect(tool).toHaveCount(1);
        outcome = 'passed';
      } finally {
        // Keep the first verdict/time; a diagnostic read cannot turn it into a pass.
        const assertionEndedAt = Date.now();
        const modelRequestsAtAssertionEnd = model.requests.length;
        const timeout = new AbortController();
        let snapshotStatus = sessionId ? 'pending' : 'missingSession';
        let snapshotErrorCode: string | undefined;
        const snapshot = await Promise.race([
          sessionId
            ? client
                .call('workbench.snapshot', { projectId: project.id, sessionId })
                .then((value) => {
                  if (snapshotStatus !== 'pending') return undefined;
                  const result = {
                    observedAt: Date.now(),
                    projectId: value.session?.projectId,
                    sessionId: value.session?.id,
                    run: value.run ? { id: value.run.id, state: value.run.state } : undefined,
                    instructions: value.messages
                      .filter((m) => m.role === 'user')
                      .slice(-16)
                      .map((m) => ({ id: m.id, state: m.state })),
                    tools: value.messages
                      .filter((m) => m.role === 'tool')
                      .slice(-16)
                      .map((m) => ({ id: m.id, name: m.tool?.name, state: m.state })),
                  };
                  snapshotStatus = 'observed';
                  return result;
                })
                .catch((error) => {
                  if (snapshotStatus === 'pending') {
                    snapshotStatus = 'rejected';
                    snapshotErrorCode = observationErrorCode(error);
                  }
                  return undefined;
                })
            : Promise.resolve(undefined),
          delay(500, undefined, { signal: timeout.signal })
            .then(() => {
              if (snapshotStatus === 'pending') snapshotStatus = 'timedOut';
            })
            .catch(() => undefined),
        ]);
        timeout.abort();
        await test
          .info()
          .attach('delegation-tool-boundary', {
            body: JSON.stringify({
              projectId: project.id,
              sessionId,
              delegationId: work.delegationId,
              assertionStartedAt,
              assertionEndedAt,
              outcome,
              modelRequestsAtSend,
              modelRequestsAtAssertionEnd,
              snapshot,
              snapshotStatus,
              snapshotErrorCode,
              snapshotUnavailable: !snapshot,
            }),
            contentType: 'application/json',
          })
          .catch(() =>
            test.info().annotations.push({
              type: 'execution-diagnostic-unavailable',
              description: 'writeFailed',
            }),
          );
      }
      await tool.locator(':scope > summary').click();
      const details = tool.getByRole('region', { name: '委派详情' });
      if (cancel) {
        await expect.poll(() => model.hold).toBe(true);
        await details.getByRole('button', { name: '取消委派', exact: true }).click();
        model.release();
        await expect(details.getByRole('status')).toContainText('已取消');
      } else {
        await expect(details.getByRole('status')).toContainText('已完成');
        await expect.poll(() => readFile(join(path, 'report.md'), 'utf8')).toContain('Observed 42');
        await details.getByRole('button', { name: '打开委派成果 report.md', exact: true }).click();
        await expect(
          uiPage.getByRole('textbox', { name: '文件内容 report.md', exact: true }),
        ).toContainText('Observed 42');
      }
      await expect(composer).toHaveValue('Retained user draft');
      await uiPage.reload();
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await expect(composer).toHaveValue('Retained user draft');
    } finally {
      try {
        await uiRpc.save(test.info());
      } finally {
        model.release();
        client.dispose();
        await stop();
        await model.close();
      }
    }
  });
}
