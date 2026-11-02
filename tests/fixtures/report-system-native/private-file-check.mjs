import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  isolationLock,
  isolationNative,
} from '../../../packages/platform/dist/isolated-report-controller.js';

const base = join(homedir(), '.cache', 'scholoom-report-system-inputs');
mkdirSync(base, { recursive: true, mode: 0o700 });
const cache = mkdtempSync(join(base, 'private-files-'));
console.log(`Evidence: ${cache}`);
assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid() > 0);
function native(args, fd) {
  const result = spawnSync(isolationNative, args, {
    stdio: ['ignore', 'pipe', 'pipe', fd],
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

test('the real writer retains flock after its acquisition helper exits', async () => {
  const path = join(cache, 'writer.lock'),
    held = openSync(path, 'wx+', 0o600);
  let retained = true;
  try {
    const acquired = native(['--lock'], held);
    assert.equal(acquired.status, 0, acquired.stderr);
    assert.equal(acquired.stdout, 'locked\n');
    await assert.rejects(isolationLock(path), { code: 'unavailable' });
    closeSync(held);
    retained = false;
    const next = await isolationLock(path);
    try {
      assert.equal(next.alive(), true);
    } finally {
      await next.close();
    }
    assert.equal(next.alive(), false);
  } finally {
    if (retained) closeSync(held);
  }
});

test('only complete staged bytes are atomically published, without replacing an existing final object', () => {
  const directory = join(cache, 'publication');
  mkdirSync(directory, { mode: 0o700 });
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  const final = join(directory, 'receipt.json'),
    temp = join(directory, 'pending.tmp');
  try {
    writeFileSync(temp, '{"original":', { mode: 0o600, flag: 'wx' });
    assert.throws(() => readFileSync(final), { code: 'ENOENT' });
    const full = '{"original":true}\n';
    writeFileSync(temp, full);
    const published = native(['--publish', 'pending.tmp', 'receipt.json'], fd);
    assert.equal(published.status, 0, published.stderr);
    assert.equal(readFileSync(final, 'utf8'), full);
    assert.throws(() => readFileSync(temp), { code: 'ENOENT' });
    writeFileSync(temp, '{"replacement":true}', { mode: 0o600, flag: 'wx' });
    const conflict = native(['--publish', 'pending.tmp', 'receipt.json'], fd);
    assert.notEqual(conflict.status, 0);
    assert.equal(readFileSync(final, 'utf8'), full);
    assert.equal(readFileSync(temp, 'utf8'), '{"replacement":true}');
    symlinkSync(temp, join(directory, 'linked.tmp'));
    for (const names of [
      ['linked.tmp', 'unaccepted.json'],
      ['pending.tmp', '../escape.json'],
    ]) {
      assert.notEqual(native(['--publish', ...names], fd).status, 0);
      assert.equal(readFileSync(final, 'utf8'), full);
    }
  } finally {
    closeSync(fd);
  }
});
