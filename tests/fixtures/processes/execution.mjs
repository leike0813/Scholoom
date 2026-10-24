import { fork } from 'node:child_process';

process.on('message', (message) => {
  if (message.method === 'execution.stop') process.exit(0);
  if (message.action === 'block') {
    process.send({ blocked: true });
    for (;;) {}
  } else if (message.action === 'spawn') {
    const child = fork(new URL('./execution.mjs', import.meta.url), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: [],
    });
    child.send({ action: 'block' });
    process.send({ descendant: child.pid });
  } else if (message.action === 'environment') {
    process.send({
      secret: process.env.SCHOLOOM_TEST_SECRET ?? null,
      explicit: process.env.SCHOLOOM_TEST_EXPLICIT ?? null,
    });
  } else process.send(message);
});
