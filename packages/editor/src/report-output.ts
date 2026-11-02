import { OperationError } from '@scholoom/protocol/core';
import {
  isReportRenderFrame,
  reportRenderLimits as limits,
  type ReportRenderFrame,
} from '@scholoom/protocol/reports';

export type ReportMutationBatch = {
  phase: number;
  nodes: Uint16Array;
  strings: readonly string[];
  mutations: Uint16Array;
  roots?: NonNullable<ReportRenderFrame['roots']>;
};

function check(valid: unknown): asserts valid {
  if (!valid) throw new OperationError('resourceLimit', '报告输出超过呈现容量。');
}

/** Splits one source mutation at tuple boundaries; all referenced strings precede its nodes. */
function* split(batch: ReportMutationBatch): Generator<Omit<ReportRenderFrame, 'sequence'>> {
  let frame = {
    phase: batch.phase as 1 | 2,
    nodes: [] as number[],
    strings: [] as string[],
    mutations: [] as number[],
    ...(batch.roots ? { roots: batch.roots } : {}),
  };
  let capacity = limits.frameBytes - 256;
  let operations = 0;
  const full = () =>
    Boolean(frame.roots) || frame.nodes.length + frame.strings.length + frame.mutations.length > 0;
  function* room(cost: number, operation = false) {
    check(cost <= limits.frameBytes - 256);
    if (cost > capacity || (operation && operations === limits.operations)) {
      check(full());
      yield frame;
      frame = { phase: batch.phase as 1 | 2, nodes: [], strings: [], mutations: [] };
      capacity = limits.frameBytes - 256;
      operations = 0;
    }
    capacity -= cost;
    if (operation) operations++;
  }
  const cost = (words: readonly number[] | Uint16Array) => {
    let result = 0;
    for (const value of words) result += String(value).length + 1;
    return result;
  };
  for (const text of batch.strings) {
    yield* room(new TextEncoder().encode(JSON.stringify(text)).byteLength + 1);
    frame.strings.push(text);
  }
  for (let i = 0; i < batch.nodes.length; i += 5) {
    const tuple = batch.nodes.subarray(i, i + 5);
    yield* room(cost(tuple));
    frame.nodes.push(...tuple);
  }
  for (let i = 0; i < batch.mutations.length; ) {
    const m = batch.mutations;
    const type = m[i];
    const length =
      type === 0 || type === 3
        ? 5
        : type === 1
          ? 3
          : type === 2
            ? 6 + m[i + 4]! + m[i + 5]!
            : type === 4
              ? 4 + m[i + 2]! * 2 + m[i + 3]! * 6
              : 0;
    check(length > 0 && i + length <= m.length);
    const tuple = m.subarray(i, i + length);
    // One large child-list can exceed the wire capacity even though its U16 buffer fits.
    if (type === 2) {
      const added = tuple.subarray(6, 6 + tuple[4]!);
      const removed = tuple.subarray(6 + tuple[4]!);
      const perPart = 4096;
      for (const [values, adding] of [
        [removed, false],
        [added, true],
      ] as const) {
        for (let offset = 0; offset < values.length; offset += perPart) {
          const ids = values.subarray(offset, offset + perPart);
          const part = [
            2,
            tuple[1]!,
            tuple[2]!,
            0,
            adding ? ids.length : 0,
            adding ? 0 : ids.length,
            ...ids,
          ];
          yield* room(cost(part), true);
          frame.mutations.push(...part);
        }
      }
    } else if (type === 4) {
      let position = 4;
      const adds = 4 + tuple[2]! * 2;
      while (position < tuple.length) {
        const adding = position >= adds;
        const part = [
          4,
          tuple[1]!,
          adding ? 0 : 1,
          adding ? 1 : 0,
          ...tuple.subarray(position, position + (adding ? 6 : 2)),
        ];
        yield* room(cost(part), true);
        frame.mutations.push(...part);
        position += adding ? 6 : 2;
      }
    } else {
      yield* room(cost(tuple), true);
      frame.mutations.push(...tuple);
    }
    i += length;
  }
  if (full()) yield frame;
}

/** One report process's finite output window; only actual consumption restores credit. */
export class ReportRenderOutput {
  private readonly queue: Array<{ frames: ReportRenderFrame[]; next: number }> = [];
  private readonly outstanding = new Set<number>();
  private readonly waiters = new Set<{ resolve(): void; reject(error: unknown): void }>();
  private sequence = 0;
  private pumping = false;
  private closed = false;
  private nodes = 1;
  private strings = 0;
  private stringBytes = 0;

  constructor(
    private readonly port: {
      send(frame: ReportRenderFrame): Promise<void>;
      failed(error: unknown): void;
    },
  ) {}

  write(batch: ReportMutationBatch) {
    check(!this.closed && this.queue.length < limits.inFlight);
    check((batch.phase === 1 || batch.phase === 2) && batch.nodes.length % 5 === 0);
    check(batch.nodes.length <= limits.nodes * 5 && batch.mutations.length <= 32768);
    check(!batch.roots || this.sequence === 0);
    const rootNodes = batch.roots ? 2 : 0;
    check(this.nodes + rootNodes + batch.nodes.length / 5 <= limits.nodes);
    check(this.strings + batch.strings.length <= limits.strings);
    let bytes = 0;
    for (const value of batch.strings) {
      check(typeof value === 'string' && value.length <= limits.frameBytes);
      bytes += new TextEncoder().encode(value).byteLength;
      check(this.stringBytes + bytes <= limits.stringBytes);
    }
    const frames = [...split(batch)].map((frame, index) => ({
      sequence: this.sequence + index + 1,
      ...frame,
    }));
    for (const frame of frames) check(isReportRenderFrame(frame));
    this.nodes += rootNodes + batch.nodes.length / 5;
    this.strings += batch.strings.length;
    this.stringBytes += bytes;
    this.sequence += frames.length;
    if (frames.length) this.queue.push({ frames, next: 0 });
    void this.pump();
  }

  checkpoint(): number {
    return this.sequence;
  }

  consume(sequences: readonly number[]) {
    check(!this.closed && sequences.length <= limits.inFlight);
    const outstanding = [...this.outstanding];
    check(sequences.every((sequence, index) => sequence === outstanding[index]));
    for (const sequence of sequences) this.outstanding.delete(sequence);
    void this.pump();
  }

  drained(): Promise<void> {
    if (this.closed) return Promise.reject(new OperationError('unavailable', '报告输出已关闭。'));
    if (!this.pumping && !this.queue.length && !this.outstanding.size) return Promise.resolve();
    return new Promise((resolve, reject) => this.waiters.add({ resolve, reject }));
  }

  close(error: unknown = new OperationError('unavailable', '报告输出已关闭。')) {
    if (this.closed) return;
    this.closed = true;
    this.queue.length = 0;
    this.outstanding.clear();
    for (const waiter of this.waiters) waiter.reject(error);
    this.waiters.clear();
  }

  private async pump() {
    if (this.pumping || this.closed) return;
    this.pumping = true;
    try {
      while (!this.closed && this.queue.length && this.outstanding.size < limits.inFlight) {
        const batch = this.queue[0]!;
        if (batch.next === batch.frames.length) {
          this.queue.shift();
          continue;
        }
        const frame = batch.frames[batch.next++]!;
        this.outstanding.add(frame.sequence);
        await this.port.send(frame);
      }
    } catch (error) {
      this.close(error);
      this.port.failed(error);
    } finally {
      this.pumping = false;
      if (!this.closed && !this.queue.length && !this.outstanding.size) {
        for (const waiter of this.waiters) waiter.resolve();
        this.waiters.clear();
      }
    }
  }
}
