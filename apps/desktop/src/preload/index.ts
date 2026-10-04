import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('scholoomDesktop', { platform: process.platform });
