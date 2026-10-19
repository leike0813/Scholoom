// Asks the host for material ranges at the edges of the chunk contract and reports each reply.

const ranges = [
  (size) => ({ offset: 0, length: size }),
  (size) => ({ offset: 0, length: size + 1 }),
  () => ({ offset: 0, length: 256 * 1024 + 1 }),
  () => ({ offset: -1, length: 1 }),
  () => ({ offset: 0, length: 0 }),
  () => ({ offset: 0, length: 1.5 }),
  () => ({ offset: 2 ** 53, length: 1 }),
  (size) => ({ offset: size, length: 1 }),
];

let pending;

function ask() {
  const { ref, token, probes, replies } = pending;
  if (replies.length === probes.length) {
    process.send({ kind: 'result', ref, token, result: { probes: replies } });
    return;
  }
  process.send({ kind: 'chunk', ref, token, ...probes[replies.length] });
}

process.on('message', (message) => {
  if (message.method === 'execution.stop') process.exit(0);
  else if (message.kind === 'run') {
    pending = {
      ref: message.ref,
      token: message.token,
      probes: ranges.map((range) => range(message.size)),
      replies: [],
    };
    ask();
  } else if (message.kind === 'chunk' && pending) {
    pending.replies.push(message);
    ask();
  }
});
