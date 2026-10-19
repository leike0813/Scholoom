import { ManagedNode } from '../../../packages/platform/dist/node.js';

const owned = await ManagedNode.start({
  entry: new URL('./execution.mjs', import.meta.url),
  instanceId: 'host-loss',
  stopMs: 20,
});
owned.on('message', (message) => {
  if (message.blocked) process.send({ pid: owned.identity.pid });
});
await owned.send({ action: 'block' });
