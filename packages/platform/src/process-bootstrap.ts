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
    const launch = message as { type?: string; entry?: string; env?: Record<string, string> };
    if (launch.type !== 'load' || !launch.entry?.startsWith('file:'))
      throw new Error('Invalid execution startup.');
    const environment = Object.entries(launch.env ?? {});
    if (environment.some(([, value]) => typeof value !== 'string'))
      throw new Error('Invalid execution environment.');
    // Caller environment reaches executable code only after native ownership is established.
    for (const name of Object.keys(process.env)) delete process.env[name];
    for (const [name, value] of environment) process.env[name] = value;
    await import(launch.entry);
    process.send?.({ type: 'loaded' });
  } catch {
    process.exit(1);
  }
};
process.once('message', receive);
process.send?.({ type: 'gate', pid: process.pid });
