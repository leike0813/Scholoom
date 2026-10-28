import { once } from 'node:events';

process.once('disconnect', () => process.exit(1));
process.on('error', () => process.exit(1));
process.once('message', async ({ configuration }) => {
  const mode = configuration?.args?.[0];
  if (mode !== 'exit' && mode !== 'wait') process.exit(2);
  const write = async (text) => {
    if (!process.stderr.write(text)) await once(process.stderr, 'drain');
  };
  await write('isolated-kernel-private-oversized'.repeat(16384));
  await write('\n{invalid-json:isolated-kernel-private-invalid}\n');
  await write(
    `${JSON.stringify({
      phase: 'loading-application',
      at: Date.now(),
      instanceId: 'diagnostic-isolated-kernel-instance',
      processId: process.pid,
      token: 'isolated-kernel-private-token',
      argv: ['isolated-kernel-private-argv'],
      path: '/isolated-kernel-private-path',
      body: { value: 'isolated-kernel-private-body' },
    })}\n`,
  );
  await write(
    `${JSON.stringify({
      phase: 'initializing-library',
      at: Date.now(),
      instanceId: 'diagnostic-isolated-kernel-instance',
      processId: process.pid,
    })}\n`,
  );
  if (mode === 'exit') {
    process.stderr.end(() => process.exit(1));
  } else {
    // The parent owns the readiness deadline and must terminate this actual process.
    setInterval(() => {}, 1000);
  }
});
