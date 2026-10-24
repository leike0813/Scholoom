import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [mode, marker] = process.argv.slice(2);
if (mode === 'echo') {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (value) => process.stdout.write(value));
} else if (mode === 'overflow') {
  process.stdout.write('x'.repeat(2 * 1024 * 1024));
} else if (mode === 'tree') {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  });
  writeFileSync(marker, JSON.stringify({ parent: process.pid, child: child.pid }));
  setInterval(() => {}, 1000);
} else if (mode === 'heartbeat') {
  let count = 0;
  writeFileSync(marker, String(count));
  const interval = setInterval(() => writeFileSync(marker, String(++count)), 20);
  setTimeout(() => {
    clearInterval(interval);
    process.exit(0);
  }, 10000);
  process.send?.({ ready: true });
} else if (mode === 'detached' || mode === 'detached-exit') {
  const child = spawn(process.execPath, [process.argv[1], 'heartbeat', `${marker}.heartbeat`], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  child.once('message', () => {
    writeFileSync(marker, JSON.stringify({ parent: process.pid, child: child.pid }));
    child.disconnect();
    child.unref();
    if (mode === 'detached') setInterval(() => {}, 1000);
  });
} else {
  process.exitCode = 2;
}
