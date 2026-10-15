import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

test('Markdown consumers share one worker, supersede old text and isolate terminated instances', async () => {
  type Request = { id: number; content: string };
  type Result = { tree?: { type: string; value: string }; error?: string };
  const instances: WorkerDouble[] = [];
  class WorkerDouble {
    requests: Request[] = [];
    terminated = false;
    onmessage: ((event: { data: { id: number; tree: Result['tree'] } }) => void) | undefined;
    onerror: ((event: { message: string }) => void) | undefined;
    constructor() {
      instances.push(this);
    }
    postMessage(request: Request) {
      this.requests.push(request);
    }
    terminate() {
      this.terminated = true;
    }
    respond(request: Request) {
      this.onmessage?.({
        data: { id: request.id, tree: { type: 'root', value: request.content } },
      });
    }
  }
  const original = Reflect.get(globalThis, 'Worker');
  Reflect.set(globalThis, 'Worker', WorkerDouble);
  const { acquireMarkdownQueue } = await import(
    pathToFileURL(resolve('apps/desktop/src/renderer/src/workbench/markdown-queue.ts')).href
  );
  const a = acquireMarkdownQueue();
  const b = acquireMarkdownQueue();
  try {
    const seen: Result[] = [];
    a.request('旧正文', (result: Result) => seen.push(result));
    b.request('文档', (result: Result) => seen.push(result));
    a.request('新正文', (result: Result) => seen.push(result));
    const worker = instances[0] as WorkerDouble;
    expect(instances).toHaveLength(1);
    expect(worker.requests).toHaveLength(1);
    worker.respond(worker.requests[0] as Request);
    expect(seen).toEqual([]);
    worker.respond(worker.requests[1] as Request);
    worker.respond(worker.requests[2] as Request);
    expect(seen).toEqual([
      { tree: { type: 'root', value: '文档' } },
      { tree: { type: 'root', value: '新正文' } },
    ]);
    a.request('清理正文', (result: Result) => seen.push(result));
    a.clear();
    worker.respond(worker.requests.at(-1) as Request);
    expect(seen).toHaveLength(2);
    a.release();
    expect(worker.terminated).toBe(false);
    b.release();
    expect(worker.terminated).toBe(true);
    const next = acquireMarkdownQueue();
    try {
      next.request('新会话', (result: Result) => seen.push(result));
      worker.respond(worker.requests[0] as Request);
      worker.onerror?.({ message: '旧实例错误' });
      const current = instances.at(-1) as WorkerDouble;
      current.respond(current.requests[0] as Request);
      expect(seen.at(-1)).toEqual({ tree: { type: 'root', value: '新会话' } });
    } finally {
      next.release();
    }
  } finally {
    a.release();
    b.release();
    if (original === undefined) Reflect.deleteProperty(globalThis, 'Worker');
    else Reflect.set(globalThis, 'Worker', original);
  }
});
