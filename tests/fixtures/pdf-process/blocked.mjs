process.on('message', (message) => {
  if (message.kind !== 'run') return;
  process.send({ kind: 'blocked', ref: message.ref, token: message.token });
  for (;;) {}
});
