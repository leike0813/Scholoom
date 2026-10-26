type Clock = {
  now(): number;
  set(callback: () => void, delay: number): unknown;
  clear(timer: unknown): void;
};

/** Node timers cap at signed int32; elapsed monotonic time owns the full deadline. */
export function commandDeadline(
  timeoutMs: number | null,
  expired: () => void,
  clock: Clock = {
    now: () => performance.now(),
    set: (callback, delay) => setTimeout(callback, delay),
    clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  },
): () => void {
  let timer: unknown;
  let cancelled = false;
  const started = clock.now();
  const advance = () => {
    if (cancelled || timeoutMs === null) return;
    const remaining = timeoutMs - (clock.now() - started);
    if (remaining <= 0) {
      cancelled = true;
      expired();
    } else timer = clock.set(advance, Math.min(remaining, 2147483647));
  };
  advance();
  return () => {
    cancelled = true;
    if (timer !== undefined) clock.clear(timer);
  };
}
