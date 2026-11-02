import { rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { startExecutionWorker } from '../../../packages/harness/dist/node.js';
import { graphs, pausePublication } from './graphs.mjs';

const barrier = new URL(import.meta.url).searchParams.get('publicationBarrier');
if (barrier) {
  pausePublication(async (input, signal) => {
    await writeFile(
      join(barrier, 'entered.pending'),
      JSON.stringify({
        attemptId: input.attemptId,
        originInstructionId: input.originInstructionId,
        processId: process.pid,
      }),
      { flag: 'wx', mode: 0o600 },
    );
    await rename(join(barrier, 'entered.pending'), join(barrier, 'entered.json'));
    // No resource RPC remains pending; execution.next retains its production one-hour deadline.
    const deadline = Date.now() + 60_000;
    for (;;) {
      signal.throwIfAborted();
      try {
        await stat(join(barrier, 'release'));
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (Date.now() >= deadline) throw new Error('Trusted publication barrier was not released');
      await pause(25, undefined, { signal });
    }
  });
}

startExecutionWorker(graphs);
