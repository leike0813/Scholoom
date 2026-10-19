// Reports the owned child's argv and inherited environment so a test can assert the host's
// credentials never cross into a managed execution process.
process.on('message', (message) => {
  if (message && message.method === 'execution.stop') process.exit(0);
  else process.send({ argv: process.argv, env: process.env });
});
