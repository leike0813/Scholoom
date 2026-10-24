process.on('message', (message) => {
  if (message.kind !== 'run') return;
  process.send({
    kind: 'result',
    ref: message.ref,
    token: message.token,
    result: { processId: process.pid },
  });
  for (;;) {}
});
