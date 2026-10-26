import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { commandDeadline } from '../../packages/platform/dist/command-deadline.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import { context, fixture, request } from '../managed-command-fixture.js';

test('program commands stream bounded Unicode output before exit and stop their owned scope', async () => {
  const f = await fixture();
  const events: Parameters<Parameters<ManagedCommands['start']>[2]>[0][] = [];
  try {
    const started = await f.commands.start(
      {
        workspaceId: request.workspaceId,
        executableId: request.executableId,
        args: [
          '-e',
          'process.stdout.write("中文".repeat(600000)); setTimeout(()=>process.stderr.write("done"),100)',
        ],
        timeoutMs: null,
      },
      context,
      async (event) => {
        if (event.kind === 'exited') await new Promise((resolve) => setTimeout(resolve, 100));
        events.push(event);
      },
    );
    expect(started.commandInstanceId).toBeTruthy();
    await expect
      .poll(() => events.some((event) => event.kind === 'stopped'), { timeout: 20_000 })
      .toBe(true);
    const output = events.filter((event) => event.kind === 'output');
    expect(output.every((event) => Buffer.byteLength(event.text) <= 16384)).toBe(true);
    expect(
      output
        .filter((event) => event.stream === 'stdout')
        .map((event) => event.text)
        .join(''),
    ).toBe('中文'.repeat(600000));
    expect(output.some((event) => event.stream === 'stderr' && event.text === 'done')).toBe(true);
    expect(events.some((event) => event.kind === 'exited' && event.code === 0)).toBe(true);
    expect(f.processes.status.active).toBe(0);
  } finally {
    await rm(f.root, { recursive: true });
  }
});

test('a small progress line is observable while the program is still silent and running', async () => {
  const f = await fixture();
  const output: string[] = [];
  try {
    const accepted = await f.commands.start(
      {
        workspaceId: request.workspaceId,
        executableId: request.executableId,
        args: ['-e', 'console.log("progress");setInterval(()=>{},1000)'],
        timeoutMs: null,
      },
      context,
      async (event) => {
        if (event.kind === 'output') output.push(event.text);
      },
    );
    await expect.poll(() => output.join(''), { timeout: 5000 }).toContain('progress');
    expect(f.processes.status.active).toBe(1);
    f.commands.cancel(
      { workspaceId: request.workspaceId, commandInstanceId: accepted.commandInstanceId },
      context,
    );
    await expect.poll(() => f.processes.status.active).toBe(0);
  } finally {
    await f.commands.close();
    await rm(f.root, { recursive: true });
  }
});

for (const cancelled of [false, true]) {
  test(`persistent observer failure retains the original command slot ahead of queued work (cancelled=${cancelled})`, async () => {
    const f = await fixture();
    let release = () => {};
    let reached = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const exited = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let failure: unknown;
    let secondStarted = false;
    try {
      const first = await f.commands.start(
        {
          workspaceId: 'workspace',
          executableId: 'node',
          args: ['-e', 'process.exit(0)'],
          timeoutMs: null,
        },
        context,
        async (event) => {
          if (event.kind === 'exited') {
            reached();
            await gate;
          }
          if (['exited', 'stopped', 'unknown'].includes(event.kind))
            throw new OperationError('unavailable', 'receipt storage unavailable');
        },
        (error) => {
          failure = error;
        },
      );
      await exited;
      const second = await f.commands.start(
        {
          workspaceId: 'workspace',
          executableId: 'node',
          args: ['-e', 'process.exit(0)'],
          timeoutMs: null,
        },
        context,
        async (event) => {
          if (event.kind === 'started') secondStarted = true;
        },
      );
      expect(f.processes.status.waiting).toBe(1);
      if (cancelled)
        f.commands.cancel(
          { workspaceId: 'workspace', commandInstanceId: first.commandInstanceId },
          context,
        );
      release();
      await expect.poll(() => failure !== undefined).toBe(true);
      expect(f.processes.status).toMatchObject({ active: 1, waiting: 1 });
      expect(secondStarted).toBe(false);
      f.commands.cancel(
        { workspaceId: 'workspace', commandInstanceId: second.commandInstanceId },
        context,
      );
      await expect.poll(() => f.processes.status.waiting).toBe(0);
      expect(f.processes.status.active).toBe(1);
    } finally {
      release();
      await f.commands.close();
      await rm(f.root, { recursive: true });
    }
  });
}

test('a rejected intent receipt never dispatches the registered program', async () => {
  const f = await fixture();
  let failure: unknown;
  try {
    await f.commands.start(
      {
        workspaceId: 'workspace',
        executableId: 'node',
        args: ['-e', 'require("node:fs").writeFileSync("unexpected","started")'],
        timeoutMs: null,
      },
      context,
      async () => {
        throw new OperationError('unavailable', 'receipt storage unavailable');
      },
      (error) => {
        failure = error;
      },
    );
    await expect.poll(() => failure !== undefined).toBe(true);
    expect(f.processes.status.active).toBe(0);
    await expect(readFile(join(f.root, 'unexpected'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await f.commands.close();
    await rm(f.root, { recursive: true });
  }
});

test('a thirty day deadline never overflows a native timer and cancellation still confirms stop', async () => {
  const f = await fixture();
  const original = globalThis.setTimeout;
  const deadlines: number[] = [];
  let scheduled = () => {};
  const waiting = new Promise<void>((resolve) => {
    scheduled = resolve;
  });
  let stopped = false;
  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay: number,
    ...args: unknown[]
  ) => {
    if (delay >= 2147483647) {
      deadlines.push(delay);
      scheduled();
    }
    return original(callback, delay, ...args);
  }) as typeof setTimeout;
  try {
    const accepted = await f.commands.start(
      {
        workspaceId: 'workspace',
        executableId: 'node',
        args: ['-e', 'setInterval(()=>{},1000)'],
        timeoutMs: 2592000000,
      },
      context,
      async (event) => {
        if (event.kind === 'stopped') stopped = true;
      },
    );
    await waiting;
    expect(deadlines.every((delay) => delay <= 2147483647)).toBe(true);
    f.commands.cancel(
      { workspaceId: 'workspace', commandInstanceId: accepted.commandInstanceId },
      context,
    );
    await expect.poll(() => stopped).toBe(true);
    expect(f.processes.status.active).toBe(0);
  } finally {
    globalThis.setTimeout = original;
    await f.commands.close();
    await rm(f.root, { recursive: true });
  }
});

test('deadline chunks expire only after total monotonic elapsed time and cancellation clears the next chunk', () => {
  for (const duration of [2147483646, 2147483647, 2147483648, 2592000000, null]) {
    let now = 0;
    let pending: { at: number; callback: () => void } | undefined;
    const delays: number[] = [];
    const clock = {
      now: () => now,
      set(callback: () => void, delay: number) {
        delays.push(delay);
        pending = { at: now + delay, callback };
        return pending;
      },
      clear(timer: unknown) {
        if (pending === timer) pending = undefined;
      },
    };
    const advance = (target: number) => {
      while (pending && pending.at <= target) {
        now = pending.at;
        const callback = pending.callback;
        pending = undefined;
        callback();
      }
      now = target;
    };
    let expired = 0;
    const cancel = commandDeadline(
      duration,
      () => {
        expired++;
      },
      clock,
    );
    if (duration === null) {
      expect(pending).toBeUndefined();
      advance(2592000000);
      expect(expired).toBe(0);
    } else {
      advance(duration - 1);
      expect(expired).toBe(0);
      advance(duration);
      expect(expired).toBe(1);
    }
    expect(delays.every((delay) => delay >= 1 && delay <= 2147483647)).toBe(true);
    cancel();
    const cancellation = commandDeadline(
      2592000000,
      () => {
        expired++;
      },
      clock,
    );
    advance(now + 2147483647);
    cancellation();
    expect(pending).toBeUndefined();
    const before = expired;
    advance(now + 2592000000);
    expect(expired).toBe(before);
  }
});
