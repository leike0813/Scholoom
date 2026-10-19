process.once('message', (message) => {
  if (message.kind !== 'run') return;
  process.send({
    kind: 'result',
    ref: message.ref,
    token: message.token,
    result: { processId: process.pid },
  });
  // The host's delivery verification observes this process before triggering its deadline.
  for (;;) {}
});
