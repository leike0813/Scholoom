import type { BootstrapRequest } from '@scholoom/protocol';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('scholoomDesktop', {
  platform: process.platform,
  bootstrap: (mode: BootstrapRequest['mode']) => ipcRenderer.invoke('kernel:bootstrap', mode),
  openExternal: (url: string) => ipcRenderer.invoke('navigation:external', url),
  pickDirectory: (options?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke('dialog:open-directory', options),
});
