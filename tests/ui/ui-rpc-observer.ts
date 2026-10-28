import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo, WebSocket } from '@playwright/test';
import { errorInfoSchema } from '../../packages/protocol/dist/core.js';
import { messageSchema, runStateSchema } from '../../packages/protocol/dist/harness.js';

export const uiRpcLimits = { events: 128, pending: 32, connections: 32, messages: 8 } as const;
const methods = new Set(['session.send', 'workbench.watch', 'workbench.snapshot']);
const states = new Set<string>(runStateSchema.enum);
const messageStates = new Set<string>(messageSchema.properties.state.enum);
const errorCodes = new Set<string>(errorInfoSchema.properties.code.enum);
type Fields = Record<string, string | number>;
type Request = { method: string; scope: Fields };
type Observation = {
  sequence: number;
  observedAt: number;
  elapsedMs: number;
  connection: number;
  phase: 'request' | 'response';
  rpcId: string | number;
  method: string;
  scope: Fields;
  result?: { identity: Fields; session: Fields; run: Fields; instructions: Fields[] };
  errorCode?: string | number;
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Observe this Page only, without wrapping sends or inferring business state. */
export function observeUiRpc(page: Page) {
  const startedAt = Date.now();
  const started = performance.now();
  const events: Observation[] = [];
  const counters = {
    connections: 0,
    droppedConnections: 0,
    droppedEvents: 0,
    droppedPending: 0,
    droppedInstructions: 0,
    invalidFields: 0,
    invalidFrames: 0,
    oversizedFrames: 0,
    listenerErrors: 0,
    pendingAtEnd: 0,
  };
  const cleanup: (() => void)[] = [];
  let sequence = 0;
  let stopped = false;
  const pick = (value: unknown, keys: string[], allowedStates = states): Fields => {
    const input = object(value);
    const result: Fields = {};
    for (const key of keys) {
      const item = input[key];
      if (item === undefined) continue;
      if (
        (key === 'revision' && Number.isSafeInteger(item) && (item as number) >= 0) ||
        (key === 'state' && typeof item === 'string' && allowedStates.has(item)) ||
        (key !== 'revision' &&
          key !== 'state' &&
          typeof item === 'string' &&
          item.length > 0 &&
          item.length <= messageSchema.properties.id.maxLength)
      )
        result[key] = item as string | number;
      else counters.invalidFields++;
    }
    return result;
  };
  const append = (event: Omit<Observation, 'sequence' | 'observedAt' | 'elapsedMs'>) => {
    if (events.length === uiRpcLimits.events) {
      events.shift();
      counters.droppedEvents++;
    }
    events.push({
      sequence: ++sequence,
      observedAt: Date.now(),
      elapsedMs: performance.now() - started,
      ...event,
    });
  };
  const connected = (socket: WebSocket) => {
    if (stopped) return;
    if (counters.connections === uiRpcLimits.connections) {
      counters.droppedConnections++;
      return;
    }
    const connection = ++counters.connections;
    const pending = new Map<string | number, Request>();
    let ambiguous = false;
    const frame = (phase: 'request' | 'response', payload: string | Buffer) => {
      if (stopped || ambiguous) return;
      if (Buffer.byteLength(payload) > 2 * 1024 * 1024) {
        counters.oversizedFrames++;
        return;
      }
      let data: Record<string, unknown>;
      try {
        data = object(JSON.parse(payload.toString()));
      } catch {
        counters.invalidFrames++;
        return;
      }
      const rpcId = data.id;
      if (
        !(
          (typeof rpcId === 'number' && Number.isSafeInteger(rpcId)) ||
          (typeof rpcId === 'string' && rpcId.length > 0 && rpcId.length <= 1024)
        )
      ) {
        if (typeof data.method === 'string' && methods.has(data.method)) counters.invalidFields++;
        return;
      }
      if (phase === 'request') {
        if (typeof data.method !== 'string' || !methods.has(data.method)) return;
        if (pending.has(rpcId)) {
          ambiguous = true;
          counters.droppedPending += pending.size + 1;
          pending.clear();
          return;
        }
        if (pending.size === uiRpcLimits.pending) {
          counters.droppedPending++;
          return;
        }
        const request = {
          method: data.method,
          scope: pick(data.params, ['projectId', 'sessionId', 'instructionId']),
        };
        pending.set(rpcId, request);
        append({ connection, phase, rpcId, ...request });
        return;
      }
      const request = pending.get(rpcId);
      if (!request) return;
      pending.delete(rpcId);
      const error = object(data.error);
      const code = object(error.data).code ?? error.code;
      const value = object(data.result);
      const users = Array.isArray(value.messages)
        ? value.messages.filter((item) => object(item).role === 'user')
        : [];
      counters.droppedInstructions += Math.max(0, users.length - uiRpcLimits.messages);
      append({
        connection,
        phase,
        rpcId,
        ...request,
        ...(data.result === undefined
          ? {}
          : {
              result: {
                identity: pick(value, ['instructionId', 'runId', 'revision']),
                session: pick(value.session, ['id', 'projectId', 'state']),
                run: pick(value.run, ['id', 'sessionId', 'state']),
                instructions: users
                  .slice(-uiRpcLimits.messages)
                  .map((item) => pick(item, ['id', 'runId', 'state'], messageStates)),
              },
            }),
        ...((typeof code === 'string' && errorCodes.has(code)) ||
        (typeof code === 'number' && Number.isSafeInteger(code))
          ? { errorCode: code }
          : {}),
      });
    };
    const sent = ({ payload }: { payload: string | Buffer }) => frame('request', payload);
    const received = ({ payload }: { payload: string | Buffer }) => frame('response', payload);
    const failed = () => {
      counters.listenerErrors++;
    };
    cleanup.push(() => {
      counters.pendingAtEnd += pending.size;
      socket.off('framesent', sent);
      socket.off('framereceived', received);
      socket.off('socketerror', failed);
      pending.clear();
    });
    try {
      socket.on('framesent', sent);
      socket.on('framereceived', received);
      socket.on('socketerror', failed);
    } catch {
      failed();
    }
  };
  try {
    page.on('websocket', connected);
  } catch {
    counters.listenerErrors++;
  }
  let saved: Promise<Error | undefined> | undefined;
  return {
    save(info: Pick<TestInfo, 'outputPath' | 'attach'>): Promise<Error | undefined> {
      if (saved) return saved;
      saved = (async () => {
        stopped = true;
        page.off('websocket', connected);
        for (const release of cleanup) release();
        const path = info.outputPath('ui-window-rpc.json');
        await writeFile(
          path,
          `${JSON.stringify(
            {
              kind: 'ui-window-rpc-observation',
              version: 1,
              startedAt,
              endedAt: Date.now(),
              coverage: counters.listenerErrors
                ? 'listenerFailure'
                : !counters.connections
                  ? 'noConnectionObserved'
                  : !events.length
                    ? 'noRelevantTraffic'
                    : 'observed',
              counters,
              events,
            },
            null,
            2,
          )}\n`,
        );
        await info.attach('ui-window-rpc', { path, contentType: 'application/json' });
        return undefined;
      })().catch((error: unknown) =>
        error instanceof Error ? error : new Error('UI RPC observation could not be saved.'),
      );
      return saved;
    },
  };
}

export type UiRpcObserver = ReturnType<typeof observeUiRpc>;
