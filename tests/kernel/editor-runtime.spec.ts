import { access, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { type EditorPorts, EditorRuntime } from '../../packages/editor/dist/node.js';
import { readOutput } from '../../packages/editor/dist/resources.js';
import { fileFingerprint } from '../../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../../packages/protocol/dist/core.js';
import type { EditorCommandInput } from '../../packages/protocol/dist/editor.js';

const context: CallContext = {
  moduleId: 'workbench',
  role: 'product',
  principal: { kind: 'human', id: 'test' },
};

test('output roots accept directory aliases while rejecting links outside the owned output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-output-alias-'));
  const actual = join(root, 'actual');
  const alias = join(root, 'alias');
  const outside = join(root, 'outside');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    await mkdir(actual);
    await mkdir(outside);
    await writeFile(join(actual, 'output.txt'), 'owned output');
    await writeFile(join(outside, 'outside.txt'), 'private outside');
    await symlink(actual, alias, linkType);
    await symlink(outside, join(actual, 'escape'), linkType);
    const result = await readOutput(alias, 'output.txt', 0, 100);
    expect(Buffer.from(result.base64, 'base64').toString()).toBe('owned output');
    await expect(readOutput(alias, 'escape/outside.txt', 0, 100)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  } finally {
    await rm(root, { recursive: true });
  }
});
function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function fixture(
  command: (input: EditorCommandInput, signal?: AbortSignal) => ReturnType<EditorPorts['command']>,
  verify?: () => Promise<void>,
  identity: () => string = () => 'file',
) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-editor-runtime-'));
  const path = join(root, 'main.md');
  await writeFile(path, '# Results\n');
  let reads = 0;
  const runtime = new EditorRuntime(join(root, 'editor'), (_context, signal) => ({
    check: async () => {},
    locate: async () => 'main.md',
    material: async (_projectId, name) => {
      if (name !== 'main.md') throw new OperationError('notFound', 'missing fixture material');
      if (++reads > 2) await verify?.();
      return {
        projectId: 'project',
        fileId: identity(),
        nativePath: path,
        basis: fileFingerprint(await stat(path, { bigint: true })),
      };
    },
    command: (input) => command(input, signal),
    read: async () => {
      throw new Error('unused');
    },
    importBegin: async () => {
      throw new Error('unused');
    },
    importChunk: async () => {
      throw new Error('unused');
    },
    importFinish: async () => {
      throw new Error('unused');
    },
  }));
  const render = (operationId: string) =>
    runtime.render(
      { projectId: 'project', path: 'main.md', format: 'html', automatic: true, operationId },
      context,
    );
  const job = (jobId: string) => runtime.job({ projectId: 'project', jobId }, context);
  return { runtime, render, job };
}

test('concurrent automatic requests keep one waiting item and close settles every receipt', async () => {
  const started = gate();
  const fixtureValue = await fixture(async (_input, signal) => {
    started.release();
    await new Promise<void>((resolve) => {
      if (signal?.aborted) resolve();
      else signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    throw new OperationError('shuttingDown', 'cancel fixture command');
  });
  const { runtime, render, job } = fixtureValue;
  try {
    const duplicates = await Promise.all([render('running'), render('running')]);
    expect(duplicates.map((value) => value.id)).toEqual(['running', 'running']);
    await started.promise;
    await render('waiting');
    await Promise.all([render('replacement-a'), render('replacement-b')]);
    const waiting = await Promise.all(['waiting', 'replacement-a', 'replacement-b'].map(job));
    expect(waiting.filter((value) => value.state === 'queued')).toHaveLength(1);
    expect(waiting.filter((value) => value.state === 'cancelled')).toHaveLength(2);
  } finally {
    await runtime.close();
  }
  for (const id of ['running', 'waiting', 'replacement-a', 'replacement-b'])
    expect((await job(id)).state).toBe('cancelled');
});

test('cancellation during final input validation cannot publish a successful output', async () => {
  const validating = gate();
  const proceed = gate();
  let runtime: EditorRuntime;
  const setup = await fixture(
    async (input) => {
      const output = join(runtime.commandWorkspace(input.workspaceId).directory, 'output');
      await mkdir(output);
      await writeFile(join(output, 'main.html'), '<p>result</p>');
      return { code: 0, stdout: '', stderr: '' };
    },
    async () => {
      validating.release();
      await proceed.promise;
    },
  );
  runtime = setup.runtime;
  try {
    await setup.render('cancel-before-publication');
    await validating.promise;
    expect(
      (await runtime.cancel({ projectId: 'project', jobId: 'cancel-before-publication' }, context))
        .state,
    ).toBe('cancelling');
    proceed.release();
    await expect
      .poll(async () => (await setup.job('cancel-before-publication')).state)
      .toBe('cancelled');
    expect((await setup.job('cancel-before-publication')).output).toBeUndefined();
  } finally {
    proceed.release();
    await runtime.close();
  }
});

test('capability probe waits for every command and retains unknown ownership', async () => {
  const started = gate();
  const proceed = gate();
  let directory = '';
  let runtime: EditorRuntime;
  const setup = await fixture(async (input) => {
    directory = runtime.commandWorkspace(input.workspaceId).directory;
    if (input.args.includes('--citeproc'))
      throw new OperationError('outcomeUnknown', 'unknown citation stop');
    if (input.args.includes('--version'))
      throw new OperationError('unavailable', 'ordinary failure');
    if (input.args.includes('--list-output-formats')) {
      started.release();
      await proceed.promise;
      throw new OperationError('outcomeUnknown', 'unknown stop');
    }
    return { code: 0, stdout: '{}', stderr: '' };
  });
  runtime = setup.runtime;
  try {
    const result = runtime.convert(
      { projectId: 'project', path: 'main.md', kind: 'capabilities' },
      context,
    );
    const rejected = expect(result).rejects.toMatchObject({ code: 'outcomeUnknown' });
    await started.promise;
    await access(directory);
    proceed.release();
    await rejected;
    expect(JSON.parse(await readFile(join(directory, 'owner.json'), 'utf8')).state).toBe('unknown');
    await expect(
      runtime.convert(
        {
          projectId: 'project',
          path: 'main.md',
          kind: 'citationHtml',
          json: '{"id":"sample","title":"Evidence"}',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  } finally {
    proceed.release();
    await runtime.close();
  }
});

test('history cache evicts old outputs while preserving current and recently read outputs', async () => {
  let runtime: EditorRuntime;
  const setup = await fixture(async (input) => {
    const output = join(runtime.commandWorkspace(input.workspaceId).directory, 'output');
    await mkdir(output);
    await writeFile(join(output, 'main.html'), '<p>cache evidence</p>');
    return { code: 0, stdout: '', stderr: '' };
  });
  runtime = setup.runtime;
  const outputs: string[] = [];
  try {
    for (let index = 0; index < 66; index++) {
      const receipt = await setup.render(`cache-${index}`);
      await expect
        .poll(async () => (await setup.job(receipt.id)).state, { intervals: [1, 2, 5] })
        .toBe('completed');
      const id = (await setup.job(receipt.id)).output?.id;
      expect(id).toBeDefined();
      if (id) outputs.push(id);
      if (index === 1 && id)
        await runtime.output({ projectId: 'project', outputId: id, offset: 0 }, context);
    }
    const read = (outputId: string) =>
      runtime.output({ projectId: 'project', outputId, offset: 0 }, context);
    await expect(read(outputs[0] ?? '')).rejects.toMatchObject({ code: 'notFound' });
    await expect(read(outputs[1] ?? '')).resolves.toMatchObject({ byteLength: 21 });
    await expect(read(outputs.at(-1) ?? '')).resolves.toMatchObject({ byteLength: 21 });
    expect((await setup.job('cache-0')).state).toBe('completed');
  } finally {
    await runtime.close();
  }
});

test('a full cache of latest versions still permits replacing an existing manuscript', async () => {
  let runtime: EditorRuntime;
  let file = 'file-0';
  const setup = await fixture(
    async (input) => {
      const output = join(runtime.commandWorkspace(input.workspaceId).directory, 'output');
      await mkdir(output);
      await writeFile(join(output, 'main.html'), '<p>latest</p>');
      return { code: 0, stdout: '', stderr: '' };
    },
    undefined,
    () => file,
  );
  runtime = setup.runtime;
  try {
    for (let index = 0; index < 65; index++) {
      file = `file-${index % 64}`;
      const receipt = await setup.render(`latest-${index}`);
      await expect
        .poll(async () => (await setup.job(receipt.id)).state, { intervals: [1, 2, 5] })
        .toBe('completed');
    }
    const original = (await setup.job('latest-0')).output;
    const current = (await setup.job('latest-64')).output;
    expect(current?.id).not.toBe(original?.id);
    await expect(
      runtime.output({ projectId: 'project', outputId: original?.id ?? '', offset: 0 }, context),
    ).rejects.toMatchObject({ code: 'notFound' });
    await expect(
      runtime.output({ projectId: 'project', outputId: current?.id ?? '', offset: 0 }, context),
    ).resolves.toBeDefined();
  } finally {
    await runtime.close();
  }
});
