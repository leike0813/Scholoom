import type { BootstrapResult } from '@scholoom/protocol';

declare global {
  interface Window {
    /** Electron preload 提供的窄桥；浏览器开发入口没有该桥。 */
    scholoomDesktop?:
      | {
          platform: string;
          openExternal: (url: string) => Promise<void>;
          bootstrap: (mode: 'ensure' | 'inspect') => Promise<BootstrapResult>;
        }
      | undefined;
  }
}
