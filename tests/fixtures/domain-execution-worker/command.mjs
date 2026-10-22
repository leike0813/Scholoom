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
} else {
  process.exitCode = 2;
}
