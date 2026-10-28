// Real host-process loss fixture. Only approved test bytes and authorization are synthetic.
import { readFile } from 'node:fs/promises';
import { IsolatedReportProvider, ProcessAdmission } from '../../../packages/platform/dist/node.js';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
const provider = new IsolatedReportProvider({
  admission: new ProcessAdmission(1, 1),
  privateRoot: config.root,
  programs: [
    {
      id: 'probe',
      version: '1',
      policyId: config.policy.id,
      image: await readFile(config.probe),
      args: ['detached'],
    },
  ],
  policies: [config.policy],
  authorize: async () => {},
});
await provider.initialize();
const port = provider.port();
process.on('message', async (message) => {
  try {
    const result = await port[message.method](message.input);
    process.send?.({ sequence: message.sequence, result });
  } catch (error) {
    process.send?.({
      sequence: message.sequence,
      error: { code: error.code, message: error.message },
    });
  }
});
process.send?.({ ready: true });
