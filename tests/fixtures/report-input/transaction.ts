// Throwaway fixed-template input transaction. Not a product bridge or DOM mirror.
export interface Snapshot {
  generation: number;
  html: string;
  state: { filter: string; [key: string]: unknown };
}
export interface Owner {
  view: string;
  basis: string;
  receiver: string;
}
type Intent = { id: number; action?: string; value?: string; ready: boolean };
export function createInputTransaction(options: {
  owner: Owner;
  send(input: { generation: number; action?: string; value?: string }): Promise<Snapshot>;
  value(): string | undefined;
  apply(snapshot: Snapshot): void;
  changed(): void;
}) {
  const owner = Object.freeze({ ...options.owner });
  let closed = false;
  let documentToken: object | undefined;
  let composing = false;
  let invalid = false;
  let error = '';
  let serial = 0;
  let confirmed = 0;
  let displayed = 0;
  let inFlight: Intent | undefined;
  let pending: Intent | undefined;
  let candidate: Snapshot | undefined;
  let ignored = 0;
  const events: unknown[] = [];
  let droppedEvents = 0;
  function record(event: string) {
    if (events.length < 40)
      events.push({
        event,
        confirmed,
        displayed,
        composing,
        inFlight: inFlight?.id,
        pending: pending?.id,
        candidate: candidate?.generation,
      });
    else droppedEvents++;
    if (!closed) options.changed();
  }
  function valid(token: object) {
    if (closed || token !== documentToken) {
      ignored++;
      return false;
    }
    return true;
  }
  function adopt() {
    if (closed || error || invalid || composing || inFlight || pending || !candidate) return;
    const value = options.value();
    if (documentToken && value !== candidate.state.filter) return;
    const snapshot = candidate;
    options.apply(snapshot);
    candidate = undefined;
    displayed = snapshot.generation;
    record('adopted');
  }
  function pump() {
    if (closed || error || invalid || composing || inFlight) return;
    if (!pending?.ready) {
      adopt();
      return;
    }
    const intent = pending;
    pending = undefined;
    inFlight = intent;
    const base = confirmed;
    record('requested');
    void options
      .send({
        generation: base,
        ...(intent.action ? { action: intent.action } : {}),
        ...(intent.value !== undefined ? { value: intent.value } : {}),
      })
      .then((reply) => {
        if (closed) {
          ignored++;
          return;
        }
        if (
          reply.generation !== base + 1 ||
          reply.html.length > 65536 ||
          new TextEncoder().encode(reply.html).length > 65536
        )
          throw new Error('invalid reply');
        confirmed = reply.generation;
        candidate = reply;
        record('confirmed');
      })
      .catch((failure) => {
        if (!closed) {
          error = String(failure);
          record('failed');
        }
      })
      .finally(() => {
        inFlight = undefined;
        if (!closed) pump();
      });
  }
  function input(token: object, ready: boolean, force = false) {
    if (!valid(token)) return false;
    const value = options.value();
    if (typeof value !== 'string' || value.length > 128) {
      invalid = true;
      pending = undefined;
      record('inputLimit');
      return false;
    }
    invalid = false;
    if (!force && ready && !pending && inFlight?.action === 'filter' && inFlight.value === value)
      return true;
    if (
      !force &&
      pending?.action === 'filter' &&
      pending.value === value &&
      pending.ready === ready
    )
      return true;
    if (serial >= 128) {
      error = 'intentLimit';
      record('failed');
      return false;
    }
    pending = { id: ++serial, action: 'filter', value, ready };
    record(ready ? 'committedIntent' : 'preedit');
    pump();
    return true;
  }
  return {
    start() {
      if (!closed && confirmed === 0 && !inFlight) {
        pending = { id: ++serial, ready: true };
        pump();
      }
    },
    bind(token: object) {
      if (!closed && !documentToken) documentToken = token;
    },
    input(token: object) {
      return input(token, !composing);
    },
    begin(token: object) {
      if (valid(token)) {
        composing = true;
        record('compositionStart');
      }
    },
    end(token: object) {
      // Native terminal input events settle in the same DOM turn; no timed wait/retry.
      queueMicrotask(() => {
        if (valid(token)) {
          composing = false;
          input(token, true, true);
        }
      });
    },
    control(token: object, action: 'order' | 'toggle', value: string) {
      if (!valid(token)) return false;
      if (composing || pending || inFlight || invalid || error) {
        record('controlConflict');
        return false;
      }
      if (value.length > 128 || serial >= 128) return false;
      pending = { id: ++serial, action, value, ready: true };
      pump();
      return true;
    },
    dispose() {
      closed = true;
      documentToken = undefined;
      pending = undefined;
      candidate = undefined;
      record('disposed');
    },
    inspect: () => ({
      owner,
      closed,
      composing,
      invalid,
      error,
      confirmed,
      displayed,
      inFlight: !!inFlight,
      pending: pending ? { ...pending } : null,
      candidate: candidate
        ? { generation: candidate.generation, filter: candidate.state.filter }
        : null,
      ignored,
      droppedEvents,
      events: [...events],
    }),
  };
}
