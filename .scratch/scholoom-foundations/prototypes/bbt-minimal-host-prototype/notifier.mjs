// Throwaway, awaited delivery for committed changes; no batching or transaction queue.
export function createNotifier(trace) {
  const observers = new Map();
  let nextID = 1;
  return {
    registerObserver(observer, types, name, priority = 100) {
      const id = nextID++;
      observers.set(id, { observer, types, name, priority });
      trace({ type: 'notifier-register', id, types, name, priority });
      return id;
    },
    unregisterObserver(id) { observers.delete(id); },
    async trigger(action, type, ids, extraData = {}) {
      trace({ type: 'notifier-trigger', action, objectType: type, ids, extraData });
      for (const [id, entry] of [...observers].sort((a, b) => a[1].priority - b[1].priority)) {
        if (entry.types && !entry.types.includes(type)) continue;
        await entry.observer.notify(action, type, ids, extraData);
        trace({ type: 'notifier-delivered', id, name: entry.name, action, objectType: type, ids });
      }
    },
  };
}
