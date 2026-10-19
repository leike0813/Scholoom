import type { KernelClient } from '@scholoom/client';
import { useEffect, useRef, useState } from 'react';

/** Owns subscriptions across scope changes, reconnects, and component disposal. */
export function useFileWatch(
  client: KernelClient,
  projectId: string,
  paths: readonly string[],
  onChange: (paths: string[]) => void,
  onResync: () => void,
): string {
  const handlers = useRef({ onChange, onResync });
  handlers.current = { onChange, onResync };
  const [error, setError] = useState('');
  const scope = JSON.stringify([...new Set(paths)].sort());
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const ids = new Set<string>();
    const unwatch = (watchId: string) =>
      client.call('files.unwatch', { projectId, watchId }).catch(() => {});
    const register = async () => {
      const version = ++generation;
      for (const id of ids) void unwatch(id);
      ids.clear();
      try {
        const values = JSON.parse(scope) as string[];
        for (let offset = 0; offset < values.length; offset += 100) {
          const { watchId } = await client.call('files.watch', {
            projectId,
            paths: values.slice(offset, offset + 100),
          });
          if (disposed || version !== generation) {
            await unwatch(watchId);
            return;
          }
          ids.add(watchId);
        }
        if (!disposed && version === generation) setError('');
      } catch (reason) {
        if (!disposed && version === generation)
          setError(reason instanceof Error ? reason.message : '自动更新暂不可用，请手动刷新。');
      }
    };
    let phase = client.getSnapshot().phase;
    if (phase === 'connected') void register();
    const unconnect = client.subscribe(() => {
      const next = client.getSnapshot().phase;
      if (next === 'connected' && phase !== next) {
        void register();
        handlers.current.onResync();
      }
      phase = next;
    });
    const unsubscribe = client.subscribeChanges((change) => {
      if (change.projectId === projectId && change.filePaths)
        handlers.current.onChange(change.filePaths);
    });
    const focus = () => handlers.current.onResync();
    window.addEventListener('focus', focus);
    return () => {
      disposed = true;
      generation++;
      unconnect();
      unsubscribe();
      window.removeEventListener('focus', focus);
      for (const id of ids) void unwatch(id);
    };
  }, [client, projectId, scope]);
  return error;
}
