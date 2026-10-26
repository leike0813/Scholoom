import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { type EditorPorts, EditorRuntime } from '../../packages/editor/dist/node.js';
import { EditorRecords, readOutput } from '../../packages/editor/dist/resources.js';
import { fileFingerprint } from '../../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../../packages/protocol/dist/core.js';
import type { EditorCommandInput } from '../../packages/protocol/dist/editor.js';

const context: CallContext = {
  moduleId: 'workbench',
  role: 'product',
  principal: { kind: 'human', id: 'test' },
};

test('editor records preserve ordered receipts and refuse a replaced private directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-records-'));
  const directory = join(root, 'records');
  const path = join(directory, 'job.json');
  const records = new EditorRecords();
  try {
    await writeFile(directory, 'blocked directory');
    await expect(records.write(path, { state: 'blocked' })).rejects.toThrow();
    await rm(directory);
    await records.write(path, { state: 'queued' });
    const running = records.write(path, { state: 'running' });
    const observed = records.read(path);
    const completed = records.write(path, { state: 'completed' });
    await Promise.all([running, completed]);
    expect(await observed).toEqual({ state: 'running' });
    expect(await records.read(path)).toEqual({ state: 'completed' });
    await rename(directory, join(root, 'original'));
    await mkdir(directory);
    await expect(records.write(path, { state: 'replaced' })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    expect(JSON.parse(await readFile(join(root, 'original', 'job.json'), 'utf8'))).toEqual({
      state: 'completed',
    });
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true });
  }
});

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
  check: EditorPorts['check'] = async () => {},
) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-editor-runtime-'));
  const path = join(root, 'main.md');
  await writeFile(path, '# Results\n');
  let reads = 0;
  const ports = (_context: CallContext, signal?: AbortSignal): EditorPorts => ({
    check,
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
  });
  const runtime = new EditorRuntime(join(root, 'editor'), ports);
  const render = (operationId: string, format: 'html' | 'pdf' = 'html') =>
    runtime.render(
      { projectId: 'project', path: 'main.md', format, automatic: true, operationId },
      context,
    );
  const job = (jobId: string) => runtime.job({ projectId: 'project', jobId }, context);
  return {
    runtime,
    render,
    job,
    root,
    path,
    reopen: () => new EditorRuntime(join(root, 'editor'), ports),
  };
}

const pdf = Buffer.from('%PDF-1.7\nrender fixture\n');
async function outputFixture() {
  const grants = { read: true, checksRemaining: Number.POSITIVE_INFINITY };
  const compiler = { fail: false };
  let runtime: EditorRuntime;
  const setup = await fixture(
    async (input) => {
      if (compiler.fail) return { code: 1, stdout: '', stderr: 'fixture compilation failed' };
      const directory = runtime.commandWorkspace(input.workspaceId).directory;
      expect(await readFile(join(directory, 'main.md'), 'utf8')).toContain('# Results');
      const output = join(directory, 'output');
      await mkdir(output);
      const format = input.args[input.args.indexOf('--to') + 1];
      await writeFile(join(output, `main.${format}`), format === 'pdf' ? pdf : '<p>result</p>');
      return { code: 0, stdout: '', stderr: '' };
    },
    undefined,
    undefined,
    async (_project, access) => {
      if (access !== 'read' || !grants.read || grants.checksRemaining-- <= 0)
        throw new OperationError('permissionDenied', 'fixture access denied');
    },
  );
  runtime = setup.runtime;
  const complete = async (id: string, format: 'html' | 'pdf' = 'pdf') => {
    await setup.render(id, format);
    await expect
      .poll(async () => (await setup.job(id)).state, { intervals: [1, 2, 5] })
      .toBe('completed');
    const output = (await setup.job(id)).output;
    if (!output?.basis || !output.input) throw new Error('Missing published render evidence');
    return output;
  };
  const location = (id: string) =>
    ({ source: 'render', projectId: 'project', outputId: id }) as const;
  const record = (id: string) =>
    join(setup.root, 'editor', 'item-project', 'outputs', `item-${id}.json`);
  const bytesPath = (id: string) =>
    join(setup.root, 'editor', 'item-project', 'data', id, 'main.pdf');
  return { ...setup, grants, compiler, complete, location, record, bytesPath };
}

test('published PDF resources keep their own bytes and producing input when the next job fails', async () => {
  const setup = await outputFixture();
  const { runtime, location } = setup;
  try {
    const inputBasis = fileFingerprint(await stat(setup.path, { bigint: true }));
    const output = await setup.complete('success');
    expect(output.basis).toBe(
      fileFingerprint(await stat(setup.bytesPath(output.id), { bigint: true })),
    );
    expect(output.basis).not.toBe(inputBasis);
    expect(output.input).toEqual({
      ref: { source: 'project', projectId: 'project', fileId: 'file' },
      basis: inputBasis,
      dependencies: [{ path: 'main.md', basis: inputBasis }],
    });
    const descriptor = await runtime.resource(location(output.id), context);
    expect(descriptor).toMatchObject({
      ref: location(output.id),
      basis: output.basis,
      format: 'pdf',
      render: { jobId: 'success', input: output.input },
      capabilities: { read: true, write: false, readingRecords: false, render: false },
    });
    const chunks: Buffer[] = [];
    let offset = 0;
    do {
      const chunk = await runtime.readResource(
        { ref: descriptor.ref, basis: descriptor.basis, encoding: 'base64', offset, limit: 7 },
        context,
      );
      expect(chunk).toMatchObject({
        ref: descriptor.ref,
        basis: output.basis,
        offset,
        size: pdf.length,
        unit: 'byte',
        truncated: false,
      });
      chunks.push(Buffer.from(chunk.data, 'base64'));
      offset = chunk.nextOffset ?? pdf.length;
    } while (offset < pdf.length);
    expect(Buffer.concat(chunks)).toEqual(pdf);
    await writeFile(setup.path, '# Results changed\n');
    setup.compiler.fail = true;
    await setup.render('failed', 'pdf');
    await expect.poll(async () => (await setup.job('failed')).state).toBe('failed');
    const failed = await setup.job('failed');
    expect(failed.basis).not.toBe(inputBasis);
    expect(failed.lastSuccess).toEqual(output);
    expect(failed.output).toBeUndefined();
    const restarted = setup.reopen();
    try {
      expect(await restarted.resource(location(output.id), context)).toEqual(descriptor);
    } finally {
      await restarted.close();
    }
  } finally {
    await runtime.close();
    await rm(setup.root, { recursive: true });
  }
});

test('render resource reads reject other formats, stale basis and revoked read authority', async () => {
  const setup = await outputFixture();
  const { runtime, location, grants } = setup;
  try {
    const output = await setup.complete('read-only');
    const ref = location(output.id);
    const input = { ref, basis: output.basis ?? '', encoding: 'base64' as const };
    await expect(runtime.readResource({ ...input, basis: 'stale' }, context)).rejects.toMatchObject(
      { code: 'contentChanged' },
    );
    await expect(
      runtime.readResource({ ...input, encoding: 'utf8' }, context),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      runtime.readResource(
        { ...input, ref: { source: 'project', projectId: 'project', fileId: 'file' } },
        context,
      ),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(runtime.readResource({ ...input, limit: 262145 }, context)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    await expect(
      runtime.export(
        { projectId: 'project', outputId: output.id, operationId: 'export', path: 'export.pdf' },
        context,
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const html = await setup.complete('html', 'html');
    await expect(runtime.resource(location(html.id), context)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    for (const read of [
      () => runtime.resource(ref, context),
      () => runtime.readResource(input, context),
    ]) {
      grants.checksRemaining = 1;
      await expect(read()).rejects.toMatchObject({ code: 'permissionDenied' });
    }
    grants.checksRemaining = Number.POSITIVE_INFINITY;
    grants.read = false;
    await expect(runtime.resource(ref, context)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(runtime.readResource(input, context)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  } finally {
    await runtime.close();
    await rm(setup.root, { recursive: true });
  }
});

for (const missing of ['basis', 'input'] as const) {
  test(`legacy output without ${missing} still previews but cannot become a render resource`, async () => {
    const setup = await outputFixture();
    try {
      const output = await setup.complete('legacy');
      const path = setup.record(output.id);
      const record = JSON.parse(await readFile(path, 'utf8'));
      delete record[missing];
      await writeFile(path, JSON.stringify(record));
      await expect(
        setup.runtime.resource(setup.location(output.id), context),
      ).rejects.toMatchObject({ code: 'unavailable' });
      await expect(
        setup.runtime.readResource(
          { ref: setup.location(output.id), basis: output.basis ?? '', encoding: 'base64' },
          context,
        ),
      ).rejects.toMatchObject({ code: 'unavailable' });
      const preview = await setup.runtime.output(
        { projectId: 'project', outputId: output.id, offset: 0 },
        context,
      );
      expect(Buffer.from(preview.base64, 'base64')).toEqual(pdf);
    } finally {
      await setup.runtime.close();
      await rm(setup.root, { recursive: true });
    }
  });
}

for (const change of ['modified', 'replaced', 'missing'] as const) {
  test(`render descriptors and bytes reject ${change} published output`, async () => {
    const setup = await outputFixture();
    try {
      const output = await setup.complete('changed');
      const path = setup.bytesPath(output.id);
      if (change === 'modified') await writeFile(path, '%PDF-1.7\nchanged bytes\n');
      else if (change === 'missing') await rm(path);
      else {
        await writeFile(`${path}.replacement`, pdf);
        await rename(`${path}.replacement`, path);
      }
      const code = change === 'missing' ? 'notFound' : 'contentChanged';
      await expect(
        setup.runtime.resource(setup.location(output.id), context),
      ).rejects.toMatchObject({ code });
      await expect(
        setup.runtime.readResource(
          { ref: setup.location(output.id), basis: output.basis ?? '', encoding: 'base64' },
          context,
        ),
      ).rejects.toMatchObject({ code });
    } finally {
      await setup.runtime.close();
      await rm(setup.root, { recursive: true });
    }
  });
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
    await writeFile(join(output, 'main.pdf'), pdf);
    return { code: 0, stdout: '', stderr: '' };
  });
  runtime = setup.runtime;
  const outputs: string[] = [];
  try {
    for (let index = 0; index < 66; index++) {
      const receipt = await setup.render(`cache-${index}`, 'pdf');
      await expect
        .poll(
          async () => {
            const job = await setup.job(receipt.id);
            if (job.state === 'failed' || job.state === 'interrupted')
              throw new Error(JSON.stringify({ index, job }));
            return job.state;
          },
          { intervals: [1, 2, 5] },
        )
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
    await expect(read(outputs[1] ?? '')).resolves.toMatchObject({ byteLength: pdf.length });
    await expect(read(outputs.at(-1) ?? '')).resolves.toMatchObject({ byteLength: pdf.length });
    const resource = (outputId: string) =>
      runtime.resource({ source: 'render', projectId: 'project', outputId }, context);
    await expect(resource(outputs[0] ?? '')).rejects.toMatchObject({ code: 'notFound' });
    await expect(resource(outputs[1] ?? '')).resolves.toMatchObject({
      capabilities: { read: true, write: false },
    });
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
        .poll(
          async () => {
            const job = await setup.job(receipt.id);
            if (job.state === 'failed' || job.state === 'interrupted')
              throw new Error(JSON.stringify({ index, job }));
            return job.state;
          },
          { intervals: [1, 2, 5] },
        )
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
