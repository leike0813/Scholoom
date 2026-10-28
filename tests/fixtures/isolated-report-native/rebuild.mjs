import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('The isolated report probe requires Linux x86_64.');
}

const cache =
  process.env.SCHOOLOOM_ISOLATION_TEST_CACHE ??
  join(homedir(), '.cache', 'scholoom-isolation-tests');
const output = join(cache, 'isolated-report-native', 'probe');
const script = fileURLToPath(import.meta.url);
const source = join(dirname(script), 'probe.c');
mkdirSync(dirname(output), { recursive: true });
if (
  !existsSync(output) ||
  statSync(output).mtimeMs < Math.max(statSync(source).mtimeMs, statSync(script).mtimeMs)
) {
  execFileSync(
    process.env.CC ?? 'cc',
    [
      '-std=c11',
      '-O2',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-nostdlib',
      '-static',
      '-fno-stack-protector',
      '-fno-builtin',
      '-fno-pie',
      '-no-pie',
      '-Wl,-e,_start',
      source,
      '-o',
      output,
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        TMPDIR: cache,
        XDG_CACHE_HOME: cache,
        CCACHE_DIR: join(cache, 'ccache'),
      },
    },
  );
}
console.log(output);
