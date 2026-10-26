// Model access contract over a loopback Anthropic boundary: retry budget for safe temporary
// failures, no blind retry for provider rejections, and one shared concurrency slot released
// on cancel. All credentials are synthetic and never read from the real environment.
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createExecutionModel,
  createModelBudget,
  ModelAccess,
} from '../../packages/models/dist/execution.js';
import { CredentialStore, ModelConfigStore } from '../../packages/models/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

const SYNTHETIC_KEY = 'synthetic-key-not-a-secret';
const ANSWER = '合成答复。';

interface Boundary {
  url: string;
  requests: string[];
  bodies: Array<Record<string, unknown>>;
  hold: boolean;
  release: () => void;
  close: () => Promise<void>;
}

// Scripted statuses: the last entry repeats, [503, 200] answers 503 once then 200.
async function boundary(statuses: number[]): Promise<Boundary> {
  const requests: string[] = [];
  const bodies: Array<Record<string, unknown>> = [];
  const waiting = new Set<() => void>();
  const pending = [...statuses];
  let hold = false;
  const release = (): void => {
    hold = false;
    for (const wake of [...waiting]) wake();
  };
  const server = createServer(async (req, res) => {
    requests.push(req.url ?? '');
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    try {
      bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
    } catch {
      /* Non-JSON probe requests carry no contract. */
    }
    if (hold)
      await new Promise<void>((resolve) => {
        const wake = () => {
          waiting.delete(wake);
          resolve();
        };
        waiting.add(wake);
        res.once('close', wake);
      });
    if (res.destroyed || res.writableEnded) return;
    const status = pending.length > 1 ? (pending.shift() as number) : (pending[0] ?? 200);
    if (status !== 200) {
      res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '0' });
      res.end(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'synthetic' } }),
      );
      return;
    }
    const body = JSON.stringify({
      id: 'msg_synthetic',
      type: 'message',
      role: 'assistant',
      model: 'minimax-fixture',
      content: [{ type: 'text', text: ANSWER }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/anthropic`,
    requests,
    bodies,
    get hold() {
      return hold;
    },
    set hold(value: boolean) {
      hold = value;
    },
    release,
    async close() {
      release();
      const stopped = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await stopped;
    },
  };
}

async function access(url: string) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-model-access-'));
  const credentials = new CredentialStore(root, { MINIMAX_CN_API_KEY: SYNTHETIC_KEY });
  return {
    access: new ModelAccess(credentials, new ModelConfigStore(root), url),
    credentials,
    root,
    cleanup: () => rm(root, { recursive: true }),
  };
}

test('final synchronous authorization rejects revocation during a queued request and releases its slot', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  try {
    const first = await model.execution();
    const lease = await first.acquire();
    let authorized = true;
    let checked = false;
    const queued = await model.execution(
      () => {
        checked = true;
      },
      undefined,
      undefined,
      () => {
        if (!authorized) throw new OperationError('permissionDenied', 'revoked');
      },
      first.budget,
    );
    const pending = queued.acquire();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect.poll(() => checked).toBe(true);
    authorized = false;
    first.release(lease);
    await rejected;
    for (let index = 0; index < 31; index++) first.release(await first.acquire());
    await expect(first.acquire()).rejects.toMatchObject({ code: 'resourceLimit' });
    const next = await model.execution();
    next.release(await next.acquire());
    expect(server.requests).toEqual([]);
  } finally {
    await server.close();
    await cleanup();
  }
});

test('different model descriptors, compression and safe retries consume the same root budget', async () => {
  const server = await boundary([...Array<number>(29).fill(200), 503, 200]);
  const { access: model, cleanup } = await access(server.url);
  const signal = new AbortController().signal;
  try {
    const budget = createModelBudget();
    const parent = await model.execution(undefined, signal, undefined, undefined, budget);
    const child = await model.execution(
      undefined,
      signal,
      { model: 'MiniMax-M2.7' },
      undefined,
      parent.budget,
    );
    const parentModel = createExecutionModel(parent.descriptor, signal, parent);
    const childModel = createExecutionModel(child.descriptor, signal, child);
    for (let index = 0; index < 29; index++) await parentModel.invoke('合成请求');
    await childModel.invoke('合成子请求');
    await parentModel.invoke('合成压缩请求');
    expect(server.requests).toHaveLength(32);
    expect(server.bodies[29]?.model).toBe('MiniMax-M2.7');
    expect(server.bodies[30]?.model).toBe('MiniMax-M2.7');
    expect(server.bodies[31]?.model).toBe(parent.descriptor.model);
    const sibling = await model.execution(undefined, signal, undefined, undefined, budget);
    for (const execution of [parent, child, sibling])
      await expect(execution.acquire()).rejects.toMatchObject({ code: 'resourceLimit' });
    expect(server.requests).toHaveLength(32);
    const unrelated = await model.execution();
    unrelated.release(await unrelated.acquire());
  } finally {
    await server.close();
    await cleanup();
  }
});

test('cancelling a queued child preserves the parent lease and charges only admitted requests', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  const controller = new AbortController();
  try {
    const parent = await model.execution();
    const lease = await parent.acquire();
    const child = await model.execution(
      undefined,
      controller.signal,
      { model: 'MiniMax-M2.7' },
      undefined,
      parent.budget,
    );
    const pending = child.acquire();
    const cancelled = expect(pending).rejects.toThrow('synthetic cancellation');
    child.release(lease);
    let admitted = false;
    const sibling = await model.execution(
      undefined,
      undefined,
      undefined,
      undefined,
      parent.budget,
    );
    const waiting = sibling.acquire().then((id) => {
      admitted = true;
      return id;
    });
    controller.abort(new Error('synthetic cancellation'));
    await cancelled;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(admitted).toBe(false);
    parent.release(lease);
    sibling.release(await waiting);
    for (let index = 0; index < 30; index++) parent.release(await parent.acquire());
    await expect(parent.acquire()).rejects.toMatchObject({ code: 'resourceLimit' });
    expect(server.requests).toHaveLength(0);
  } finally {
    await server.close();
    await cleanup();
  }
});

for (const status of [500, 502, 503, 529]) {
  test(`temporary failure ${status} stops after three attempts in total`, async () => {
    const server = await boundary([status]);
    const { access: model, cleanup } = await access(server.url);
    try {
      await expect((await model.create()).invoke('合成请求')).rejects.toThrow();
      expect(server.requests).toHaveLength(3);
    } finally {
      await server.close();
      await cleanup();
    }
  });
}

for (const status of [401, 429]) {
  test(`provider rejection ${status} is reported without a retry`, async () => {
    const server = await boundary([status]);
    const { access: model, cleanup } = await access(server.url);
    try {
      const error = (await (
        await model.create()
      )
        .invoke('合成请求')
        .catch((value: unknown) => value)) as { status?: number; cause?: { status?: number } };
      expect(error.status ?? error.cause?.status).toBe(status);
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
      await cleanup();
    }
  });
}

test('a transient failure inside the budget recovers the same call', async () => {
  const server = await boundary([503, 200]);
  const { access: model, cleanup } = await access(server.url);
  try {
    const result = await (await model.create()).invoke('合成请求');
    expect(result.text).toContain(ANSWER);
    expect(server.requests).toHaveLength(2);
  } finally {
    await server.close();
    await cleanup();
  }
});

test('cancelling a held call releases the single shared slot', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  const controller = new AbortController();
  try {
    server.hold = true;
    const parent = await model.execution();
    const child = await model.execution(
      undefined,
      controller.signal,
      { model: 'MiniMax-M2.7' },
      undefined,
      parent.budget,
    );
    const held = createExecutionModel(child.descriptor, controller.signal, child)
      .invoke('合成请求')
      .catch((value: unknown) => value);
    await expect.poll(() => server.requests.length).toBe(1);
    const waiting = createExecutionModel(
      parent.descriptor,
      new AbortController().signal,
      parent,
    ).invoke('合成请求');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(server.requests).toHaveLength(1);
    controller.abort(new Error('cancelled by test'));
    expect(await held).toBeInstanceOf(Error);
    server.release();
    const answered = await waiting;
    expect(answered.text).toContain(ANSWER);
    expect(server.requests).toHaveLength(2);
    for (let index = 0; index < 30; index++) parent.release(await parent.acquire());
    await expect(parent.acquire()).rejects.toMatchObject({ code: 'resourceLimit' });
  } finally {
    server.release();
    await server.close();
    await cleanup();
  }
});

test('status exposes the model catalog, effort levels and factory defaults', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  try {
    const status = await model.status();
    expect(status.model).toBe('MiniMax-M3.1-Flash-Preview');
    expect(status.defaultEffort).toBe('medium');
    expect(status.models).toEqual([
      { id: 'MiniMax-M3.1-Flash-Preview', supportsEffort: true },
      { id: 'MiniMax-M3', supportsEffort: false },
      { id: 'MiniMax-M2.7', supportsEffort: false },
      { id: 'MiniMax-M2.7-highspeed', supportsEffort: false },
    ]);
    expect(status.efforts).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(status.configured).toBe(true);
    expect(status.error).toBeUndefined();
  } finally {
    await server.close();
    await cleanup();
  }
});

test('capable models send the selected effort with adaptive thinking', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  try {
    await (
      await model.create(undefined, undefined, {
        model: 'MiniMax-M3.1-Flash-Preview',
        effort: 'high',
      })
    ).invoke('合成请求');
    const body = server.bodies.at(-1);
    expect(body?.model).toBe('MiniMax-M3.1-Flash-Preview');
    expect((body?.output_config as { effort?: string } | undefined)?.effort).toBe('high');
    expect(body?.thinking).toMatchObject({ type: 'adaptive' });
  } finally {
    await server.close();
    await cleanup();
  }
});

test('models without the effort capability never send an effort field', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup } = await access(server.url);
  try {
    for (const id of ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'])
      await (await model.create(undefined, undefined, { model: id, effort: 'max' })).invoke(
        '合成请求',
      );
    const bodies = server.bodies.slice(-3);
    expect(bodies.map((body) => body.model)).toEqual([
      'MiniMax-M3',
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
    ]);
    for (const body of bodies)
      expect((body?.output_config as { effort?: string } | undefined)?.effort).toBeUndefined();
    expect(bodies[0]?.thinking).toMatchObject({ type: 'adaptive' });
  } finally {
    await server.close();
    await cleanup();
  }
});

test('models outside the catalog are rejected without any HTTP request', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup, root } = await access(server.url);
  try {
    await expect(
      model.create(undefined, undefined, { model: 'MiniMax-M2.5' }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(model.setDefaults({ model: 'MiniMax-M2.5', effort: 'low' })).rejects.toMatchObject(
      { code: 'invalidRequest' },
    );
    expect(server.requests).toHaveLength(0);
    await expect(stat(join(root, 'provider.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await server.close();
    await cleanup();
  }
});

test('saved defaults persist privately and drive later calls after a restart', async () => {
  const server = await boundary([200]);
  const { access: model, credentials, cleanup, root } = await access(server.url);
  try {
    const saved = await model.setDefaults({ model: 'MiniMax-M2.7', effort: 'low' });
    expect(saved.model).toBe('MiniMax-M2.7');
    expect(saved.defaultEffort).toBe('low');
    if (process.platform !== 'win32')
      expect((await stat(join(root, 'provider.json'))).mode & 0o077).toBe(0);
    const restarted = new ModelAccess(credentials, new ModelConfigStore(root), server.url);
    const status = await restarted.status();
    expect(status.model).toBe('MiniMax-M2.7');
    expect(status.defaultEffort).toBe('low');
    await (await restarted.create()).invoke('合成请求');
    const body = server.bodies.at(-1);
    expect(body?.model).toBe('MiniMax-M2.7');
    expect((body?.output_config as { effort?: string } | undefined)?.effort).toBeUndefined();
  } finally {
    await server.close();
    await cleanup();
  }
});

test('a damaged defaults file is diagnosed and left untouched until explicitly saved', async () => {
  const server = await boundary([200]);
  const { access: model, cleanup, root } = await access(server.url);
  try {
    const path = join(root, 'provider.json');
    await writeFile(path, '损坏内容{{{', { mode: 0o600 });
    expect((await model.status()).error).toBeTruthy();
    await expect(model.create()).rejects.toMatchObject({ code: 'unavailable' });
    expect(server.requests).toHaveLength(0);
    expect(await readFile(path, 'utf8')).toBe('损坏内容{{{');
    const repaired = await model.setDefaults({ model: 'MiniMax-M3', effort: 'low' });
    expect(repaired.error).toBeUndefined();
    expect(repaired.model).toBe('MiniMax-M3');
  } finally {
    await server.close();
    await cleanup();
  }
});
