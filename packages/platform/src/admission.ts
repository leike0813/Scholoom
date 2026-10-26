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
  private readonly recovered = new Set<string>();
  private readonly owners = new Set<string>();
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
      active: this.active + this.recovered.size,
      waiting: this.waiting.length,
      limit: this.limit,
      queueLimit: this.queueLimit,
    };
  }

  /** Recovery runs before admission; unknown scopes cannot expire in the ordinary wait queue. */
  retainUnknown(instanceId: string): void {
    if (!instanceId) throw new OperationError('invalidRequest', '恢复归属身份不能为空。');
    if (this.owners.has(instanceId)) return;
    this.recovered.add(instanceId);
  }

  reserve(wait = false, instanceId?: string): ProcessReservation {
    if (instanceId && (this.owners.has(instanceId) || this.recovered.has(instanceId)))
      throw new OperationError('invalidRequest', '执行归属已计入准入。');
    if (this.status.active >= this.limit && (!wait || this.waiting.length >= this.queueLimit))
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
        if (instanceId) this.owners.add(instanceId);
        resolve();
      },
      cancel: () => {
        clearTimeout(timer);
        reject(new OperationError('shuttingDown', '执行等待已取消。'));
      },
    };
    if (this.status.active < this.limit) entry.start();
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
        if (instanceId) this.owners.delete(instanceId);
        if (this.status.active < this.limit) this.waiting.shift()?.start();
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
