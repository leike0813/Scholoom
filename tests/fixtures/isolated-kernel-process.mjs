import { realpath } from 'node:fs/promises';
import { serveKernel } from '../../apps/kernel/dist/lifecycle.js';

// This entry accepts configuration only from its trusted test parent's private IPC channel.
const parentGone = () => process.kill(process.pid, 'SIGTERM');
process.once('disconnect', parentGone);
process.on('error', () => process.exit(1));
process.once('message', async ({ directory, configuration }) => {
  try {
    await serveKernel(await realpath(directory), {
      environment: {},
      development: true,
      isolatedZotero: configuration,
    });
    process.off('disconnect', parentGone);
    if (process.connected) process.disconnect();
  } catch {
    // Initialization may have opened resources; never print configuration or raw errors.
    process.exit(1);
  }
});
