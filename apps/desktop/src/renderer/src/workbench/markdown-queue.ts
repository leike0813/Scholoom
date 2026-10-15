import type { PreviewNode, PreviewRequest, PreviewResponse } from './markdown-render';

/** 渲染结果：成功给展示树，失败给可读原因。 */
export type MarkdownResult = { tree: PreviewNode } | { error: string };

interface Entry {
  id: number;
  content: string;
  onResult: (result: MarkdownResult) => void;
}

/** 一个消费方（一处文件预览或一条消息）：只保留最新待处理版本。 */
interface Consumer {
  pending: Entry | null;
  active: Entry | null;
  enqueued: boolean;
  released: boolean;
}

export interface MarkdownQueueHandle {
  /** 提交最新待渲染正文；同一 handle 的旧请求结果不再回调。 */
  request(content: string, onResult: (result: MarkdownResult) => void): void;
  /** 丢弃未完成请求且不再回调，用于离开可见区或切换正文。 */
  clear(): void;
  /** 递减引用；最后一个引用释放时终止共享 Worker。 */
  release(): void;
}

let worker: Worker | null = null;
let references = 0;
let sequence = 0;
/** 等待唯一在途名额的消费方，先到先投递。 */
const waiting: Consumer[] = [];
let running: { consumer: Consumer; entry: Entry } | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL('./markdown-worker.ts', import.meta.url), { type: 'module' });
  instance.onmessage = (event: MessageEvent<PreviewResponse>) => {
    // 换过实例后旧 Worker 的迟到事件一律丢弃，不动新实例的在途状态。
    if (worker !== instance) return;
    const current = running;
    // 只认当前在途请求的响应：错配、重复或迟到的消息不推进队列。
    if (!current || current.entry.id !== event.data.id) return;
    running = null;
    // 已被新请求或 clear 取代的在途请求不再回调旧结果。
    if (current.consumer.active === current.entry) {
      const { consumer, entry } = current;
      consumer.active = null;
      if (!consumer.released) {
        entry.onResult(
          'tree' in event.data ? { tree: event.data.tree } : { error: event.data.error },
        );
      }
    }
    pump();
  };
  instance.onerror = (event) => {
    if (worker !== instance) return;
    // Worker 出错即不可用：本次请求失败回调，排队请求一起作废，下次请求重建实例。
    const message = event.message || '预览进程不可用';
    const current = running;
    running = null;
    instance.terminate();
    worker = null;
    if (current && current.consumer.active === current.entry) {
      const { consumer, entry } = current;
      consumer.active = null;
      if (!consumer.released) entry.onResult({ error: message });
    }
    while (waiting.length) {
      const consumer = waiting.shift();
      if (!consumer) break;
      consumer.enqueued = false;
      const entry = consumer.pending;
      consumer.pending = null;
      if (entry && !consumer.released) entry.onResult({ error: message });
    }
  };
  worker = instance;
  return instance;
}

/** 全局只有一个在途请求；每个消费方最多一个待处理版本，连续更新只留最后一版。 */
function pump(): void {
  if (running) return;
  const instance = worker;
  if (!instance) return;
  while (waiting.length) {
    const consumer = waiting.shift();
    if (!consumer) return;
    consumer.enqueued = false;
    const entry = consumer.pending;
    consumer.pending = null;
    if (!entry) continue;
    consumer.active = entry;
    running = { consumer, entry };
    const request: PreviewRequest = { id: entry.id, content: entry.content };
    instance.postMessage(request);
    return;
  }
}

export function acquireMarkdownQueue(): MarkdownQueueHandle {
  references += 1;
  ensureWorker();
  const consumer: Consumer = { pending: null, active: null, enqueued: false, released: false };
  return {
    request(content, onResult) {
      if (consumer.released) return;
      ensureWorker();
      // 后到的正文取代先到的：在途结果作废，排队位置保持先来顺序。
      consumer.active = null;
      sequence += 1;
      consumer.pending = { id: sequence, content, onResult };
      if (!consumer.enqueued) {
        consumer.enqueued = true;
        waiting.push(consumer);
      }
      pump();
    },
    clear() {
      consumer.active = null;
      consumer.pending = null;
    },
    release() {
      if (consumer.released) return;
      consumer.released = true;
      consumer.active = null;
      consumer.pending = null;
      const index = waiting.indexOf(consumer);
      if (index >= 0) waiting.splice(index, 1);
      references -= 1;
      if (references > 0) return;
      const instance = worker;
      worker = null;
      running = null;
      waiting.length = 0;
      instance?.terminate();
    },
  };
}
