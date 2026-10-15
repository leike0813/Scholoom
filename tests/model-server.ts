// Deterministic synthetic Anthropic-compatible boundary double for model tests.
// All content is synthetic: no real credentials, no outbound network, no kernel code is read.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MODEL = 'minimax-fixture';
const THINKING = '正在分析材料。';
const SIGNATURE = 'synthetic-signature';
const CHAT_TEXT = '收到。';
const SAVED_TEXT = '分析已保存到 result.md。';

type Block = Record<string, unknown>;
type Message = { role?: unknown; content?: unknown };

export interface ModelServer {
  url: string;
  requests: Array<Record<string, unknown>>;
  hold: boolean;
  release: () => void;
  close: () => Promise<void>;
}

interface Turn {
  stopReason: 'tool_use' | 'end_turn';
  blocks: Block[];
}

const usage = { input_tokens: 10, output_tokens: 8, cache_read_input_tokens: 0 };

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { type: 'error', error: { type: 'invalid_request_error', message } });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Array<Buffer> = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('request body exceeds 2 MiB'), { status: 413 });
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

// Thread progress is derived from the request itself: which tool_use blocks the caller
// already sent back, so no session bookkeeping is needed.
function inspect(body: Record<string, unknown>): { user: string; tools: Set<string> } {
  const messages = Array.isArray(body.messages) ? (body.messages as Array<Message>) : [];
  const user: Array<string> = [];
  const tools = new Set<string>();
  for (const message of messages) {
    const content = message.content;
    if (typeof content === 'string') user.push(content);
    const blocks = Array.isArray(content) ? (content as Array<Block>) : [];
    for (const block of blocks) {
      if (message.role === 'user' && block.type === 'text') user.push(String(block.text ?? ''));
      if (message.role !== 'user' && block.type === 'tool_use') tools.add(String(block.name ?? ''));
    }
  }
  return { user: user.join('\n'), tools };
}

function planTurn(user: string, tools: Set<string>, toolId: string): Turn {
  const thinking: Block = { type: 'thinking', thinking: THINKING, signature: SIGNATURE };
  const text = (value: string): Turn => ({
    stopReason: 'end_turn',
    blocks: [thinking, { type: 'text', text: value }],
  });
  const tool = (name: string, input: Record<string, unknown>): Turn => ({
    stopReason: 'tool_use',
    blocks: [thinking, { type: 'tool_use', id: toolId, name, input }],
  });
  if (user.includes('MODEL_STREAM')) return text('合成流式输出。'.repeat(10000));
  if (user.includes('MODEL_SCRATCH_ERROR'))
    return tools.has('edit_file')
      ? text('收到暂存工具错误。')
      : tool('edit_file', {
          file_path: '/large_tool_results/missing.md',
          old_string: 'old',
          new_string: 'new',
        });
  if (!user.includes('MODEL_FIXTURE')) return text(CHAT_TEXT);
  if (user.includes('MODEL_PARALLEL') && !tools.has('read_file')) {
    return {
      stopReason: 'tool_use',
      blocks: [
        thinking,
        {
          type: 'tool_use',
          id: `${toolId}_read`,
          name: 'read_file',
          input: { file_path: '/input.md' },
        },
        {
          type: 'tool_use',
          id: `${toolId}_write`,
          name: 'write_file',
          input: { file_path: '/result.md', content: 'synthetic' },
        },
      ],
    };
  }
  if (!tools.has('read_file')) return tool('read_file', { file_path: '/input.md' });
  if (!tools.has('write_file')) {
    return tool('write_file', {
      file_path: '/result.md',
      content: user.includes('MODEL_LARGE_TOOL')
        ? '合成预览'.repeat(5000)
        : '# 结果\n\n合成样本的分析已保存。\n',
    });
  }
  return text(SAVED_TEXT);
}

function streamBody(messageId: string, turn: Turn): string {
  const events: Array<{ event: string; data: unknown }> = [
    {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          model: MODEL,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { ...usage, output_tokens: 0 },
        },
      },
    },
  ];
  turn.blocks.forEach((block, index) => {
    if (block.type === 'thinking') {
      events.push(
        {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index,
            content_block: { type: 'thinking', thinking: '' },
          },
        },
        {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index,
            delta: { type: 'thinking_delta', thinking: block.thinking },
          },
        },
        {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index,
            delta: { type: 'signature_delta', signature: SIGNATURE },
          },
        },
        { event: 'content_block_stop', data: { type: 'content_block_stop', index } },
      );
      return;
    }
    if (block.type === 'tool_use') {
      events.push(
        {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index,
            content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
          },
        },
        {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index,
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
          },
        },
        { event: 'content_block_stop', data: { type: 'content_block_stop', index } },
      );
      return;
    }
    events.push(
      {
        event: 'content_block_start',
        data: { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      },
      ...(String(block.text)
        .match(/.{1,128}/gs)
        ?.map((text) => ({
          event: 'content_block_delta',
          data: { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
        })) ?? []),
      { event: 'content_block_stop', data: { type: 'content_block_stop', index } },
    );
  });
  events.push(
    {
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: { stop_reason: turn.stopReason, stop_sequence: null },
        usage: { output_tokens: usage.output_tokens },
      },
    },
    { event: 'message_stop', data: { type: 'message_stop' } },
  );
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
}

export async function createModelServer(): Promise<ModelServer> {
  const requests: Array<Record<string, unknown>> = [];
  const waiters = new Set<{ settle: () => void }>();
  let hold = false;
  let sequence = 0;

  const release = (): void => {
    hold = false;
    for (const waiter of [...waiters]) waiter.settle();
  };

  // Held requests stay pending until release(); an aborted client resolves them too so
  // close() never waits on a socket nobody is reading.
  const gate = (res: ServerResponse): Promise<void> => {
    if (!hold) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const waiter = {
        settle: () => {
          waiters.delete(waiter);
          resolve();
        },
      };
      waiters.add(waiter);
      res.once('close', waiter.settle);
    });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST' || req.url !== '/anthropic/v1/messages') {
      sendError(res, 404, 'fixture serves POST /anthropic/v1/messages only');
      return;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      const status = (error as { status?: number }).status ?? 400;
      sendError(res, status, (error as Error).message);
      return;
    }
    requests.push(body);
    await gate(res);
    if (res.destroyed || res.writableEnded) return;
    sequence += 1;
    const suffix = String(sequence).padStart(4, '0');
    const { user, tools } = inspect(body);
    const turn = planTurn(user, tools, `toolu_fixture_${suffix}`);
    if (body.stream === true) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const body = streamBody(`msg_fixture_${suffix}`, turn);
      if (user.includes('MODEL_STREAM')) {
        for (const frame of body.split('\n\n')) {
          if (res.destroyed) return;
          res.write(`${frame}\n\n`);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        res.end();
      } else res.end(body);
      return;
    }
    sendJson(res, 200, {
      id: `msg_fixture_${suffix}`,
      type: 'message',
      role: 'assistant',
      model: MODEL,
      content: turn.blocks,
      stop_reason: turn.stopReason,
      stop_sequence: null,
      usage,
    });
  };

  const server = createServer((req, res) => {
    handle(req, res).catch(() => sendError(res, 500, 'fixture failure'));
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
