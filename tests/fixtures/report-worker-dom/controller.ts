import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

export async function startProbe(built: string, output: string) {
  await mkdir(output, { recursive: true });
  const child = fork(join(built, 'source.mjs'), [], {
    cwd: output,
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR },
  });
  let stderr = '';
  child.stderr!.on('data', (part) => {
    stderr = (stderr + part).slice(0, 16384);
  });
  const exit = once(child, 'close').then(([code, signal]) => ({
    pid: child.pid,
    code,
    signal,
    closed: true,
  }));
  let id = 0,
    closed = false;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
  const trace: unknown[] = [];
  let latest: any;
  function record(value: unknown) {
    assert(trace.length < 256, 'controllerTraceBudget');
    trace.push(value);
  }
  child.on('message', (reply: any) => {
    record({ direction: 'source', reply });
    latest = reply;
    const waiting = pending.get(reply.id);
    pending.delete(reply.id);
    if (reply.error) waiting?.reject(new Error(reply.error));
    else waiting?.resolve(reply);
  });
  child.once('close', () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`sourceClosed: ${stderr}`));
    pending.clear();
  });
  function request(body: object) {
    assert(!closed && child.connected);
    const payload = { ...body, id: ++id };
    record({ direction: 'host', request: payload });
    return new Promise<any>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.send(payload, (error) => {
        if (error) {
          pending.delete(payload.id);
          reject(error);
        }
      });
    });
  }
  let gate: { ready(reply: unknown): void; released: Promise<void> } | undefined;
  let releaseGate = () => {};
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') {
        const route = req.url === '/' ? 'index.html' : req.url?.slice(1);
        if (route === 'oracle') {
          res
            .writeHead(200, { 'Content-Type': 'text/html' })
            .end(
              '<!doctype html><html><meta charset="utf-8"><title>Native oracle</title><body><script type="module">import {mountSample} from "/sample.js"; window.nativeSample = mountSample(window);</script></body></html>',
            );
          return;
        }
        if (!route || !['index.html', 'surface.js', 'surface.css', 'sample.js'].includes(route)) {
          res.writeHead(404).end();
          return;
        }
        res
          .writeHead(200, {
            'Content-Type': route.endsWith('.js')
              ? 'text/javascript'
              : route.endsWith('.css')
                ? 'text/css'
                : 'text/html',
          })
          .end(await readFile(join(built, route)));
        return;
      }
      assert(req.method === 'POST' && req.url === '/wire');
      let body = '';
      for await (const part of req) {
        body += part;
        assert(Buffer.byteLength(body) <= 16384);
      }
      const input = JSON.parse(body);
      const reply = await request(input);
      // The gate sees only an actual completed source reply; it never constructs an ACK.
      if (
        gate &&
        input.messages?.some((m: any) => m[39]?.[12] === 'beforeinput' && m[39]?.[38] === 'x')
      ) {
        const held = gate;
        gate = undefined;
        held.ready(reply);
        await held.released;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(reply));
    })().catch((error) => res.writeHead(400).end(JSON.stringify({ error: String(error) })));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    readDiagnostics: () => ({ trace, latest, stderr, pid: child.pid }),
    holdCancellation() {
      assert(!gate);
      let ready!: (reply: unknown) => void;
      const received = new Promise<unknown>((resolve) => {
        ready = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
      gate = { ready, released };
      return { ready: received, release: () => releaseGate() };
    },
    async close() {
      releaseGate();
      let reply: unknown;
      try {
        if (child.connected) reply = await request({ op: 'close' });
      } finally {
        closed = true;
        const source = await exit;
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        await writeFile(
          join(output, 'source-transport.json'),
          JSON.stringify({ trace, stderr }, null, 2),
        );
        await writeFile(
          join(output, 'closed.json'),
          JSON.stringify(
            { source, reply, serverListening: server.listening, pending: pending.size },
            null,
            2,
          ),
        );
      }
    },
  };
}
