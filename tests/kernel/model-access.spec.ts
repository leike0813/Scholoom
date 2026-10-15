// Model access contract over a loopback Anthropic boundary: retry budget for safe temporary
// failures, no blind retry for provider rejections, and one shared concurrency slot released
// on cancel. All credentials are synthetic and never read from the real environment.
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CredentialStore } from '../../apps/kernel/dist/credentials/store.js';
import { ModelAccess } from '../../apps/kernel/dist/models/minimax.js';

const SYNTHETIC_KEY = 'synthetic-key-not-a-secret';
const ANSWER = '合成答复。';

interface Boundary {
  url: string;
  requests: string[];
  hold: boolean;
  release: () => void;
  close: () => Promise<void>;
}

// Scripted statuses: the last entry repeats, [503, 200] answers 503 once then 200.
async function boundary(statuses: number[]): Promise<Boundary> {
  const requests: string[] = [];
  const waiting = new Set<() => void>();
  const pending = [...statuses];
  let hold = false;
  const release = (): void => {
    hold = false;
    for (const wake of [...waiting]) wake();
  };
  const server = createServer(async (req, res) => {
    requests.push(req.url ?? '');
    for await (const chunk of req) void chunk;
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
    access: new ModelAccess(credentials, url),
    cleanup: () => rm(root, { recursive: true }),
  };
}

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
    const held = (await model.create(undefined, controller.signal))
      .invoke('合成请求')
      .catch((value: unknown) => value);
    await expect.poll(() => server.requests.length).toBe(1);
    const waiting = (await model.create()).invoke('合成请求');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(server.requests).toHaveLength(1);
    controller.abort(new Error('cancelled by test'));
    expect(await held).toBeInstanceOf(Error);
    server.release();
    const answered = await waiting;
    expect(answered.text).toContain(ANSWER);
    expect(server.requests).toHaveLength(2);
  } finally {
    server.release();
    await server.close();
    await cleanup();
  }
});
