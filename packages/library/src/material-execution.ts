import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import type { DocumentRequest } from './document-parser.js';
import type { PdfRequest } from './material-reading.js';

const CHUNK_BYTES = 256 * 1024;
const send = (value: object) => {
  if (process.connected) process.send?.(value);
};
export function serveMaterial(
  parse: (request: PdfRequest | DocumentRequest, bytes: ArrayBuffer) => Promise<unknown>,
) {
  type RunFrame = {
    kind: 'run';
    ref: string;
    token: string;
    size: number;
    request: PdfRequest | DocumentRequest;
  };
  let waiting:
    | { offset: number; resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }
    | undefined;
  let busy = false;
  let stopping = false;

  function requestChunk(
    ref: string,
    token: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      waiting = { offset, resolve, reject };
      send({ kind: 'chunk', ref, token, offset, length });
    });
  }

  async function fetchMaterial(input: RunFrame): Promise<ArrayBuffer> {
    const bytes = new Uint8Array(input.size);
    for (let offset = 0; offset < input.size; offset += CHUNK_BYTES) {
      if (stopping) process.exit(0);
      bytes.set(
        await requestChunk(
          input.ref,
          input.token,
          offset,
          Math.min(CHUNK_BYTES, input.size - offset),
        ),
        offset,
      );
    }
    return bytes.buffer;
  }

  async function run(input: RunFrame): Promise<void> {
    busy = true;
    try {
      const bytes = await fetchMaterial(input);
      if (stopping) process.exit(0);
      send({
        kind: 'result',
        ref: input.ref,
        token: input.token,
        result: await parse(input.request, bytes),
      });
    } catch (error) {
      if (stopping) process.exit(0);
      const reason = (error as { reason?: { code?: number } })?.reason;
      send({
        kind: 'failure',
        ref: input.ref,
        token: input.token,
        error:
          error instanceof OperationError
            ? { code: error.code, message: error.message }
            : ({
                code: 'invalidRequest',
                message:
                  reason?.code === 4
                    ? '材料需要密码，暂不支持加密材料。'
                    : '材料无法解析，请核对格式或加密状态。',
              } satisfies ErrorInfo),
      });
    } finally {
      busy = false;
    }
  }

  // 监听在模块求值时同步注册，spawn后立即发送的运行帧不会丢失。
  // 停止只在分块与解析步骤之间协作退出；同步WASM调用期间的硬终止由控制进程升级完成。
  process.on('message', (value: unknown) => {
    const message = value as {
      method?: string;
      kind?: string;
      ref?: string;
      token?: string;
      offset?: number;
      data?: string;
      error?: ErrorInfo;
    };
    if (message?.method === 'execution.stop') {
      stopping = true;
      if (!busy) process.exit(0);
    } else if (message?.kind === 'chunk') {
      const pending = waiting;
      if (!pending || pending.offset !== message.offset) return;
      waiting = undefined;
      if (message.error)
        pending.reject(new OperationError(message.error.code, message.error.message));
      else pending.resolve(new Uint8Array(Buffer.from(message.data ?? '', 'base64')));
    } else if (message?.kind === 'run' && !busy && !stopping) {
      void run(message as RunFrame);
    }
  });
  process.on('disconnect', () => process.exit(0));
}
