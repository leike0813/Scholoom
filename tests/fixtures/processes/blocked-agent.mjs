process.on('message', (message) => {
  if (message.method === 'execution.initialize')
    process.send({ jsonrpc: '2.0', id: message.id, result: { ok: true } });
  else if (message.method === 'execution.next') {
    process.send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        done: false,
        event: {
          event: 'on_chat_model_stream',
          run_id: 'blocked',
          data: { chunk: { type: 'ai', data: { content: 'held' } } },
        },
      },
    });
    for (;;) {}
  }
});
