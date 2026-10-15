import { once } from 'node:events';
import type { ElectronApplication } from '@playwright/test';

export async function closeDesktop(application: ElectronApplication): Promise<void> {
  const child = application.process();
  const exited = child.exitCode !== null ? Promise.resolve() : once(child, 'exit');
  // Verify native window close and application quit through the owned process exit.
  await application
    .evaluate(({ app, BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) window.close();
      app.quit();
    })
    .catch(() => {});
  await exited;
}
