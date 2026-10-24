import { closeSync } from 'node:fs';
import { frameSize } from './processes.js';

// Only the supervisor keeps its control and status pipe ends.
for (const fd of [4, 5]) {
  try {
    closeSync(fd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EBADF') throw error;
  }
}
const receive = async (message: unknown) => {
  try {
    frameSize(message);
    const launch = message as { type?: string; entry?: string };
    if (launch.type !== 'load' || !launch.entry?.startsWith('file:'))
      throw new Error('Invalid execution startup.');
    await import(launch.entry);
    process.send?.({ type: 'loaded' });
  } catch {
    process.exit(1);
  }
};
process.once('message', receive);
process.send?.({ type: 'gate', pid: process.pid });
