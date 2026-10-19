process.on('message', (message) => {
  if (message.method === 'execution.initialize')
    process.send({ jsonrpc: '2.0', id: message.id, result: { ok: true } });
  else if (message.method === 'execution.next') process.exit(7);
});
