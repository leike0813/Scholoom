import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import {
  type BusinessMethod,
  type BusinessResult,
  validateBusiness,
} from '../../packages/protocol/dist/index.js';
import { cliPath, runKernel } from '../kernel-fixture.js';
import { createModelServer } from '../model-server.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

const execute = promisify(execFile);

test('the actual CLI reads and saves through the broker and owned execution without a workbench', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-cli-runtime-'));
  const profile = join(root, 'profile');
  const projectPath = join(root, 'project');
  const model = await createModelServer();
  const packaged = process.env.SCHOOLOOM_PACKAGED_KERNEL;
  const child = fork(
    new URL('../fixtures/processes/kernel-host.mjs', import.meta.url),
    [profile, model.url, ...(packaged ? [join(packaged, 'dist/lifecycle.js')] : [])],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  const exited = once(child, 'exit');
  const command = async <M extends BusinessMethod>(
    method: M,
    ...args: string[]
  ): Promise<BusinessResult<M>> => {
    const { stdout } = await execute(
      process.execPath,
      [packaged ? join(packaged, 'dist/cli.js') : cliPath, ...args, '--data-dir', profile],
      {
        timeout: 20000,
      },
    );
    const value: unknown = JSON.parse(stdout);
    assert(validateBusiness(method, 'result', value));
    return value as BusinessResult<M>;
  };
  try {
    await expect
      .poll(async () => (await runKernel(profile, 'status')).state, { timeout: 15000 })
      .toBe('running');
    await mkdir(projectPath);
    await writeFile(join(projectPath, 'input.md'), '# CLI evidence\n\ncontrolled result 42\n');
    const project = await command('project.open', 'project-open', '--path', projectPath);
    await command('project.grant', 'project-grant', '--project', project.id, '--trust');
    const session = await command('session.create', 'session-create', '--project', project.id);
    const instructionId = randomUUID();
    const args = [
      'send',
      '--project',
      project.id,
      '--session',
      session.id,
      '--instruction-id',
      instructionId,
      '--text',
      'MODEL_FIXTURE 读取 input.md 并保存 result.md',
    ];
    const accepted = await command('session.send', ...args);
    expect(await command('session.send', ...args)).toEqual(accepted);
    await expect
      .poll(
        async () =>
          (
            await command(
              'workbench.snapshot',
              'session',
              '--project',
              project.id,
              '--session',
              session.id,
            )
          ).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    const snapshot = await command(
      'workbench.snapshot',
      'session',
      '--project',
      project.id,
      '--session',
      session.id,
    );
    expect(
      snapshot.messages.some(
        (message) => message.tool?.name === 'read_file' && message.state === 'complete',
      ),
    ).toBe(true);
    expect(snapshot.artifacts).toContainEqual(
      expect.objectContaining({ path: 'result.md', runId: accepted.runId, state: 'linked' }),
    );
    expect(await readFile(join(projectPath, 'result.md'), 'utf8')).toContain('合成样本');
    const requests = model.requests.length;
    await command(
      'workbench.snapshot',
      'session',
      '--project',
      project.id,
      '--session',
      session.id,
    );
    expect(model.requests).toHaveLength(requests);
    const running = await runKernel(profile, 'status');
    assert(running.state === 'running');
    const client = createKernelClient(running.endpoint);
    try {
      await client.connect();
      await client.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      await writeFile(join(projectPath, 'evidence.pdf'), syntheticPdf());
      const batch = await client.call('library.importProjectFiles', {
        projectId: project.id,
        batchId: randomUUID(),
        projectPaths: ['evidence.pdf'],
        purpose: 'evidence',
        version: 'unspecified',
        origin: 'cli-runtime',
      });
      await expect
        .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const entry = (await client.call('library.batch', { batchId: batch.id })).entries[0];
      assert(entry?.sourceId && entry.attachmentId);
      const attachment = (await client.call('library.attachments', { sourceId: entry.sourceId }))
        .attachments[0];
      assert(attachment);
      const material = {
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      };
      expect((await client.call('library.pdfInfo', material)).pageCount).toBe(2);
      expect(
        (await client.call('library.readPdfPage', { ...material, pageIndex: 0 })).text,
      ).toContain(PAGE_ONE_TEXT);
    } finally {
      client.dispose();
    }
  } finally {
    const stopped = await runKernel(profile, 'stop');
    if (stopped.state !== 'stopped') child.kill('SIGTERM');
    await exited;
    await model.close();
    await rm(root, { recursive: true });
  }
});
