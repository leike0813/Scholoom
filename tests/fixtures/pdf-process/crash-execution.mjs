// Dies on its material the way a crashing parse would, without reporting a result.
process.on('message', (message) => {
  if (message.kind === 'run') process.exit(1);
});
