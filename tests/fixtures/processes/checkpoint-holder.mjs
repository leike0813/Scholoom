import { claimCheckpoints } from '../../../packages/harness/dist/node.js';

const release = await claimCheckpoints(process.argv[2], ['run']);
process.send({ ready: true });
process.once('message', () => {
  release();
  process.disconnect();
});
process.once('disconnect', release);
