import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { HostConnection } from '../../apps/kernel/dist/host-connection.js';
import { ProcessAdmission } from '../../packages/platform/dist/node.js';
import { fixture } from '../managed-command-fixture.js';

const valueSchema = {
  type: 'object',
  properties: { value: { type: 'integer' } },
  required: ['value'],
  additionalProperties: false,
} as const;
const echo = {
  params: valueSchema,
  result: valueSchema,
  semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
} as const;
async function hostFixture(
  mode = 'normal',
  callback?: () => Promise<void>,
  slots = 1,
  requestWaitMs: number = echo.semantics.waitMs,
) {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-host-supervision-'));
  const admission = new ProcessAdmission(slots, 1);
  let host: HostConnection;
  let caller: string | undefined;
  const commands = new ManagedCommands(
    admission,
    (id) => {
      if (id !== host.instanceId) throw new Error('unknown host workspace');
      return host.workspace();
    },
    () => {},
  );
  const create = (selected = mode) =>
    (host = new HostConnection({
      directory,
      kernelInstanceId: 'fixed-kernel',
      executable: process.execPath,
      args: [
        fileURLToPath(new URL('../fixtures/zotero-host/fixed-host.mjs', import.meta.url)),
        selected,
      ],
      scope: 'fixed-host',
      commands,
      admission,
      waitMs: 2000,
      operations: {
        echo: { ...echo, semantics: { ...echo.semantics, waitMs: requestWaitMs } },
        'read-with-callback': echo,
        drop: echo,
        'read-writes': echo,
        'late-result': echo,
        'late-callback': { ...echo, semantics: { ...echo.semantics, effect: 'write' } },
        'outside-scope': echo,
        'write-with-callback': {
          ...echo,
          semantics: { ...echo.semantics, effect: 'write', waitMs: requestWaitMs },
        },
        wait: { ...echo, semantics: { ...echo.semantics, effect: 'write' } },
      },
      callbacks: {
        contracts: {
          'sample.read': echo,
          'sample.write': { ...echo, semantics: { ...echo.semantics, effect: 'write' } },
        },
        authorize(operation, incoming) {
          if (
            (operation.input as { value: number }).value !==
            (incoming.input as { value: number }).value
          )
            throw new Error('callback outside selected scope');
        },
        async call(_method, input, context) {
          caller = context.principal.id;
          await callback?.();
          return input;
        },
      },
    }));
  return { directory, admission, commands, create, host: create(), caller: () => caller };
}

test('authenticated fixed host is ready independently of command started, preserves callback identity and shuts down its scope', async () => {
  const f = await hostFixture();
  try {
    expect((await f.host.start()).state).toBe('ready');
    expect(
      await f.host.call(
        'echo',
        { value: 42 },
        {
          moduleId: 'fixture',
          role: 'product',
          principal: { kind: 'human', id: 'original-caller' },
        },
      ),
    ).toEqual({ value: 42 });
    expect(f.caller()).toBe('original-caller');
    expect(await f.host.close()).toMatchObject({
      state: 'closed',
      pluginClosed: true,
      scopeStopped: true,
    });
    const record = await readFile(join(f.directory, 'host-supervision.json'), 'utf8');
    expect(record).not.toContain('token');
    expect(f.admission.status.active).toBe(0);
    const reopened = f.create();
    expect((await reopened.start()).state).toBe('ready');
    expect((await reopened.close()).state).toBe('closed');
  } finally {
    await f.host.close();
    await f.commands.close();
  }
});

for (const mode of ['wrong-instance', 'no-ready', 'startup-error']) {
  test(`fixed host ${mode} cannot become ready and is reclaimed`, async () => {
    const f = await hostFixture(mode);
    try {
      await expect(f.host.start()).rejects.toThrow();
      expect(await f.host.close()).toMatchObject({
        state: 'unknown',
        pluginClosed: false,
        scopeStopped: true,
      });
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.host.close();
      await f.commands.close();
    }
  });
}

for (const mode of ['shutdown-unknown', 'shutdown-timeout']) {
  test(`fixed host ${mode} keeps uncertainty after native stop and blocks restart`, async () => {
    const f = await hostFixture(mode);
    try {
      await f.host.start();
      expect(await f.host.close()).toMatchObject({
        state: 'unknown',
        pluginClosed: false,
        scopeStopped: true,
      });
      expect(f.admission.status.active).toBe(0);
      await expect(f.create().start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.commands.close();
    }
  });
}

test('transport loss cannot confirm an in-flight mutation or replay it on restart', async () => {
  const f = await hostFixture();
  const context = {
    moduleId: 'fixture',
    role: 'product',
    principal: { kind: 'human', id: 'caller' },
  } as const;
  try {
    await f.host.start();
    const mutation = f.host.call('wait', { value: 1 }, context, 'stable-domain-operation');
    const rejected = expect(mutation).rejects.toMatchObject({ code: 'outcomeUnknown' });
    await expect.poll(() => f.host.status().unresolved).toContain('stable-domain-operation');
    await f.host.call('drop', { value: 1 }, context).catch(() => {});
    await rejected;
    expect(await f.host.close()).toMatchObject({
      state: 'unknown',
      scopeStopped: true,
      unresolved: ['stable-domain-operation'],
    });
    await expect(f.create().start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  } finally {
    await f.commands.close();
  }
});

test('cancellation during initialization never resurrects ready', async () => {
  const f = await hostFixture('no-ready');
  try {
    const starting = f.host.start();
    const rejected = expect(starting).rejects.toThrow();
    await expect.poll(() => f.host.status().commandInstanceId).not.toBe('not-started');
    f.host.cancel();
    await rejected;
    expect((await f.host.close()).state).toBe('unknown');
    expect(f.host.status().scopeStopped).toBe(true);
  } finally {
    await f.commands.close();
  }
});

test('an unreadable supervision record blocks launch without replacing the evidence', async () => {
  const f = await hostFixture();
  await mkdir(join(f.directory, 'host-supervision.json'));
  await expect(f.host.start()).rejects.toThrow();
  expect(f.host.status()).toMatchObject({ state: 'unknown', commandInstanceId: 'not-started' });
  expect(f.admission.status.active).toBe(1);
});

test('invalid recovery evidence survives cleanup unchanged', async () => {
  const f = await hostFixture();
  const evidence = '{"oldInstance":"do-not-replace", "unresolved":["old-operation"]}';
  await writeFile(join(f.directory, 'host-supervision.json'), evidence);
  await expect(f.host.start()).rejects.toThrow();
  await f.host.close();
  expect(await readFile(join(f.directory, 'host-supervision.json'), 'utf8')).toBe(evidence);
});

test('a concurrent duplicate mutation identity is rejected before either request can complete', async () => {
  const f = await hostFixture();
  try {
    await f.host.start();
    const caller = {
      moduleId: 'fixture',
      role: 'product',
      principal: { kind: 'human', id: 'caller' },
    } as const;
    const first = f.host.call('wait', { value: 1 }, caller, 'same-operation');
    const rejected = expect(first).rejects.toThrow();
    await expect(f.host.call('wait', { value: 1 }, caller, 'same-operation')).rejects.toMatchObject(
      { code: 'invalidRequest' },
    );
    expect(f.host.status().unresolved).toEqual(['same-operation']);
    f.host.cancel();
    await rejected;
  } finally {
    await f.host.close();
    await f.commands.close();
  }
});

test('read handles cannot write and callbacks cannot widen the selected object scope', async () => {
  let effects = 0;
  const f = await hostFixture('normal', async () => {
    effects++;
  });
  const caller = {
    moduleId: 'fixture',
    role: 'product',
    principal: { kind: 'human', id: 'caller' },
  } as const;
  try {
    await f.host.start();
    await expect(f.host.call('read-writes', { value: 1 }, caller)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(f.host.call('outside-scope', { value: 1 }, caller)).rejects.toThrow();
    expect(effects).toBe(0);
  } finally {
    await f.host.close();
    await f.commands.close();
  }
});

test('close waits for accepted write callbacks even when the host returns early', async () => {
  let release!: () => void;
  let entered = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await hostFixture('normal', async () => {
    entered = true;
    await pending;
  });
  try {
    await f.host.start();
    const writing = f.host.call(
      'write-with-callback',
      { value: 1 },
      { moduleId: 'fixture', role: 'product', principal: { kind: 'human', id: 'caller' } },
      'callback-operation',
    );
    await expect.poll(() => entered).toBe(true);
    let closed = false;
    const closing = f.host.close().then((result) => {
      closed = true;
      return result;
    });
    expect(closed).toBe(false);
    expect(f.host.status().unresolved).toEqual(['callback-operation']);
    release();
    await writing;
    expect((await closing).state).toBe('closed');
  } finally {
    release();
    await f.host.close();
    await f.commands.close();
  }
});

for (const method of ['echo', 'write-with-callback']) {
  test(`timed-out ${method} retains its accepted callback until it actually finishes`, async () => {
    let release!: () => void;
    let entered = false;
    let finished = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await hostFixture(
      'normal',
      async () => {
        entered = true;
        await gate;
        finished = true;
      },
      1,
      300,
    );
    try {
      await f.host.start();
      const caller = {
        moduleId: 'fixture',
        role: 'product',
        principal: { kind: 'human', id: 'caller' },
      } as const;
      const request = f.host.call(
        method,
        { value: 1 },
        caller,
        method === 'echo' ? undefined : 'timeout-operation',
      );
      const rejected = expect(request).rejects.toMatchObject({
        code: method === 'echo' ? 'unavailable' : 'outcomeUnknown',
      });
      await expect.poll(() => entered).toBe(true);
      await rejected;
      const stopped = await f.host.close();
      expect(finished).toBe(false);
      expect(stopped).toMatchObject({
        state: 'unknown',
        scopeStopped: true,
        pluginClosed: false,
        pendingCallbacks: 1,
      });
      expect(stopped.unresolved).toEqual(method === 'echo' ? [] : ['timeout-operation']);
      release();
      await expect.poll(() => finished).toBe(true);
      await expect.poll(() => f.host.status().pendingCallbacks).toBe(0);
    } finally {
      release();
      await f.host.close();
      await f.commands.close();
    }
  });
}

test('timed-out read callbacks keep operation capacity until completion and can then close normally', async () => {
  let release!: () => void;
  let entered = 0;
  let finished = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await hostFixture('normal', async () => {
    entered++;
    await gate;
    finished++;
  });
  const caller = {
    moduleId: 'fixture',
    role: 'product',
    principal: { kind: 'human', id: 'caller' },
  } as const;
  try {
    await f.host.start();
    const requests = Array.from({ length: 64 }, (_, value) =>
      f.host.call('read-with-callback', { value }, caller),
    );
    const outcomes = Promise.all(requests.map((request) => request.catch((error) => error.code)));
    await expect.poll(() => entered).toBe(64);
    expect(await outcomes).toEqual(Array(64).fill('outcomeUnknown'));
    expect(f.host.status().pendingCallbacks).toBe(64);
    await expect(f.host.call('late-result', { value: 65 }, caller)).rejects.toMatchObject({
      code: 'resourceLimit',
    });
    expect(finished).toBe(0);
    release();
    await expect.poll(() => finished).toBe(64);
    await expect
      .poll(() =>
        f.host.call('echo', { value: 42 }, caller).catch((error) => ({ code: error.code })),
      )
      .toEqual({ value: 42 });
    expect((await f.host.close()).state).toBe('closed');
  } finally {
    release();
    await f.host.close();
    await f.commands.close();
  }
});

test('callbacks arriving after the host result cannot add another write', async () => {
  let effects = 0;
  const f = await hostFixture('normal', async () => {
    effects++;
  });
  const caller = {
    moduleId: 'fixture',
    role: 'product',
    principal: { kind: 'human', id: 'caller' },
  } as const;
  try {
    await f.host.start();
    await f.host.call('late-callback', { value: 1 }, caller, 'late-operation');
    await expect.poll(() => f.host.call('late-result', { value: 1 }, caller)).toEqual({ value: 1 });
    expect(effects).toBe(0);
    expect((await f.host.close()).state).toBe('closed');
  } finally {
    await f.host.close();
    await f.commands.close();
  }
});

test('cancelled calls do not leak operation capacity and close interrupts startup before file IO completes', async () => {
  const f = await hostFixture();
  try {
    await f.host.start();
    for (let i = 0; i < 65; i++) {
      const controller = new AbortController();
      const call = f.host.call(
        'echo',
        { value: 1 },
        {
          moduleId: 'fixture',
          role: 'product',
          principal: { kind: 'human', id: 'caller' },
          signal: controller.signal,
        },
      );
      controller.abort();
      await expect(call).rejects.toThrow();
    }
    expect(
      await f.host.call(
        'echo',
        { value: 42 },
        { moduleId: 'fixture', role: 'product', principal: { kind: 'human', id: 'caller' } },
      ),
    ).toEqual({ value: 42 });
    await f.host.close();
    const next = f.create();
    const starting = next.start();
    const rejected = expect(starting).rejects.toThrow();
    const result = await next.close();
    await rejected;
    expect(result.state).not.toBe('ready');
    expect(next.status().state).not.toBe('ready');
  } finally {
    await f.host.close();
    await f.commands.close();
  }
});

test('recovery retains capacity for an unconfirmed native scope without consulting a PID', async () => {
  const f = await hostFixture();
  await writeFile(
    join(f.directory, 'host-supervision.json'),
    JSON.stringify({
      version: 1,
      kernelInstanceId: 'previous-kernel',
      hostInstanceId: 'previous-host',
      commandInstanceId: 'previous-command',
      scopeStopped: false,
      pluginClosed: false,
      unresolved: [],
    }),
  );
  await expect(f.host.start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(f.admission.status.active).toBe(1);
});

test('unknown scope recovery cannot lose its hold when the active capacity is already full', async () => {
  const f = await hostFixture();
  const active = f.admission.reserve();
  await active.ready;
  await writeFile(
    join(f.directory, 'host-supervision.json'),
    JSON.stringify({
      version: 1,
      kernelInstanceId: 'old',
      hostInstanceId: 'old-host',
      commandInstanceId: 'old-command',
      scopeStopped: false,
      pluginClosed: false,
      unresolved: [],
    }),
  );
  await expect(f.host.start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  active.release();
  expect(f.admission.status.active).toBe(1);
  expect(() => f.admission.reserve()).toThrow();
  await expect(f.create().start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(f.admission.status.active).toBe(1);
});

test('recovery does not count a still-retained command reservation twice in the same kernel', async () => {
  const f = await hostFixture('normal', undefined, 2);
  const original = f.admission.reserve(false, 'old-command');
  await original.ready;
  original.retainUntil(Promise.reject(new Error('native stop remains unknown')));
  original.release();
  await writeFile(
    join(f.directory, 'host-supervision.json'),
    JSON.stringify({
      version: 1,
      kernelInstanceId: 'old',
      hostInstanceId: 'old-host',
      commandInstanceId: 'old-command',
      scopeStopped: false,
      pluginClosed: false,
      unresolved: [],
    }),
  );
  await expect(f.host.start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(f.admission.status.active).toBe(1);
  const independent = f.admission.reserve();
  await independent.ready;
  independent.release();
  expect(f.admission.status.active).toBe(1);
});

test('host bootstrap is supplied once after admission and authorization through private stdin', async () => {
  const f = await fixture();
  const output: string[] = [];
  let supplied = 0;
  let prepared = false;
  let stopped = false;
  Object.assign(f.workspace, {
    beforeLaunch: async () => {
      prepared = true;
    },
    launchInput: async () => {
      expect(prepared).toBe(true);
      supplied++;
      return 'fixed-bootstrap-42';
    },
  });
  try {
    await f.commands.start(
      {
        workspaceId: 'workspace',
        executableId: 'node',
        timeoutMs: null,
        args: [
          '-e',
          'let text=""; process.stdin.on("data",p=>text+=p); process.stdin.on("end",()=>process.stdout.write(text));',
        ],
      },
      { moduleId: 'editor', role: 'host', principal: { kind: 'system', id: 'fixed-owner' } },
      async (event) => {
        if (event.kind === 'output') output.push(event.text);
        if (event.kind === 'stopped') stopped = true;
      },
    );
    await expect.poll(() => stopped).toBe(true);
    expect(output.join('')).toBe('fixed-bootstrap-42');
    expect(supplied).toBe(1);
  } finally {
    await f.commands.close();
  }
});

test('failed durable stop observation retains capacity and the old supervision evidence', async () => {
  let damage!: () => Promise<void>;
  const f = await hostFixture('normal', async () => damage());
  const record = join(f.directory, 'host-supervision.json');
  damage = async () => {
    await rename(record, join(f.directory, 'retained-record.json'));
    await mkdir(record);
  };
  try {
    await f.host.start();
    await f.host.call(
      'echo',
      { value: 1 },
      { moduleId: 'fixture', role: 'product', principal: { kind: 'human', id: 'caller' } },
    );
    expect((await f.host.close()).state).toBe('unknown');
    expect(f.admission.status.active).toBe(1);
    expect(
      JSON.parse(await readFile(join(f.directory, 'retained-record.json'), 'utf8')).hostInstanceId,
    ).toBe(f.host.instanceId);
  } finally {
    await f.commands.close();
  }
});

test('revocation during private bootstrap supply prevents the executable from receiving it', async () => {
  const f = await fixture();
  let stopped = false;
  const output: string[] = [];
  Object.assign(f.workspace, {
    launchInput: async () => {
      f.revoke();
      return 'must-not-be-delivered';
    },
  });
  try {
    await f.commands.start(
      {
        workspaceId: 'workspace',
        executableId: 'node',
        timeoutMs: null,
        args: ['-e', 'process.stdin.pipe(process.stdout)'],
      },
      { moduleId: 'editor', role: 'host', principal: { kind: 'system', id: 'host' } },
      async (event) => {
        if (event.kind === 'stopped') stopped = true;
        if (event.kind === 'output') output.push(event.text);
      },
    );
    await expect.poll(() => stopped).toBe(true);
    expect(output).toEqual([]);
  } finally {
    await f.commands.close();
  }
});
