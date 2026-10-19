import { limits, OperationError } from '@scholoom/protocol/core';

export type ProcessReservation = {
  readonly ready: Promise<void>;
  retainUntil(stopped: Promise<void>): void;
  release(): void;
};
type Waiting = { start(): void; cancel(): void };

/** Host-owned process slots include reservations; child work never waits behind its parent. */
export class ProcessAdmission {
  private active = 0;
  private readonly waiting: Waiting[] = [];
  constructor(
    private readonly limit: number = limits.processActive,
    private readonly queueLimit: number = limits.processWaiting,
    private readonly waitMs: number = limits.processWaitMs,
  ) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(queueLimit) ||
      queueLimit < 0 ||
      !Number.isSafeInteger(waitMs) ||
      waitMs < 1
    )
      throw new OperationError('invalidRequest', '执行容量无效。');
  }
  get status() {
    return {
      active: this.active,
      waiting: this.waiting.length,
      limit: this.limit,
      queueLimit: this.queueLimit,
    };
  }

  reserve(wait = false): ProcessReservation {
    if (this.active >= this.limit && (!wait || this.waiting.length >= this.queueLimit))
      throw new OperationError('resourceLimit', '执行进程容量不足；新工作尚未受理。');
    let acquired = false;
    let released = false;
    let releaseRequested = false;
    let retained = 0;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ready = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    void ready.catch(() => {});
    const entry: Waiting = {
      start: () => {
        clearTimeout(timer);
        acquired = true;
        this.active++;
        resolve();
      },
      cancel: () => {
        clearTimeout(timer);
        reject(new OperationError('shuttingDown', '执行等待已取消。'));
      },
    };
    if (this.active < this.limit) entry.start();
    else {
      this.waiting.push(entry);
      timer = setTimeout(() => {
        const index = this.waiting.indexOf(entry);
        if (index < 0) return;
        this.waiting.splice(index, 1);
        released = true;
        reject(
          new OperationError('resourceLimit', '执行容量等待超时；指令保留，可发送新消息接续。'),
        );
      }, this.waitMs);
    }
    const release = () => {
      if (released || retained > 0 || !releaseRequested) return;
      released = true;
      if (acquired) {
        this.active--;
        this.waiting.shift()?.start();
      } else {
        const index = this.waiting.indexOf(entry);
        if (index >= 0) this.waiting.splice(index, 1);
        entry.cancel();
      }
    };
    return {
      ready,
      retainUntil: (stopped) => {
        if (released) throw new OperationError('invalidRequest', '执行名额已释放。');
        retained++;
        void stopped.then(
          () => {
            retained--;
            release();
          },
          () => {
            /* Unconfirmed execution keeps its slot. */
          },
        );
      },
      release: () => {
        releaseRequested = true;
        release();
      },
    };
  }
}
