import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('zoteroWorkerEvents', {
  emit(id: number, kind: string, data: unknown) {
    if (Number.isSafeInteger(id) && (kind === 'message' || kind === 'error')) {
      ipcRenderer.send('zotero:worker', id, kind, data);
    }
  },
});
