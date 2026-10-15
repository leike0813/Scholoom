import type { BootstrapRequest } from '@scholoom/protocol';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('scholoomDesktop', {
  platform: process.platform,
  bootstrap: (mode: BootstrapRequest['mode']) => ipcRenderer.invoke('kernel:bootstrap', mode),
});
