import { useEffect, useRef, useState } from 'react';

export function useLibraryRead<T>(
  key: string,
  load: (() => Promise<T>) | undefined,
  tick = 0,
): { value: T | undefined; error: string } {
  const [received, setReceived] = useState<{ key: string; value?: T; error?: string }>();
  const loader = useRef(load);
  loader.current = load;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick invalidates this bounded read without clearing the current draft.
  useEffect(() => {
    const run = loader.current;
    if (!run) return;
    let active = true;
    void run().then(
      (value) => {
        if (active) setReceived({ key, value });
      },
      (reason) => {
        if (active)
          setReceived({ key, error: reason instanceof Error ? reason.message : '读取失败。' });
      },
    );
    return () => {
      active = false;
    };
  }, [key, tick]);
  return received?.key === key
    ? { value: received.value, error: received.error ?? '' }
    : { value: undefined, error: '' };
}
