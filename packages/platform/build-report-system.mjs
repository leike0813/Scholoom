import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert(process.platform === 'linux' && process.arch === 'x64');
const sdk = resolve(process.argv[2] ?? '/usr');
accessSync(join(sdk, 'include/systemd/sd-bus.h'), constants.R_OK);
const source = fileURLToPath(new URL('./native/report-system.c', import.meta.url));
const output = resolve(
  process.argv[3] ?? fileURLToPath(new URL('./dist/report-system', import.meta.url)),
);
execFileSync(
  process.env.CC ?? 'cc',
  [
    '-std=c11',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-I',
    join(sdk, 'include'),
    source,
    '-Wl,-l:libsystemd.so.0',
    '-o',
    output,
  ],
  { stdio: 'inherit' },
);
if (process.argv[4]) {
  execFileSync(
    process.env.CC ?? 'cc',
    [
      '-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-I', join(sdk, 'include'),
      fileURLToPath(new URL('./native/isolated-report-system.c', import.meta.url)),
      '-Wl,-l:libsystemd.so.0', '-o', resolve(process.argv[4]),
    ],
    { stdio: 'inherit' },
  );
}
