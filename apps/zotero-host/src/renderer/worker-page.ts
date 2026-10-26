type WorkerEvents = { emit(id: number, kind: string, data: unknown): void };
const events = Reflect.get(globalThis, 'zoteroWorkerEvents') as WorkerEvents;
const workers = new Map<number, Worker>();
function terminate(id: number) {
  const entry = workers.get(id);
  if (!entry) return;
  entry.terminate();
  workers.delete(id);
}
Reflect.set(globalThis, 'workerHost', {
  create(id: number, query: string) {
    const worker = new Worker(`scholoom-zotero://host/worker-bridge.js${query}`);
    workers.set(id, worker);
    worker.onmessage = ({ data }: MessageEvent<unknown>) => events.emit(id, 'message', data);
    worker.onerror = (error) => events.emit(id, 'error', error.message);
  },
  post(id: number, data: unknown) {
    const entry = workers.get(id);
    if (!entry) throw new Error('Worker does not exist');
    entry.postMessage(data);
  },
  terminate,
  close() {
    for (const id of [...workers.keys()]) terminate(id);
  },
});
