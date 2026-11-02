import assert from 'node:assert/strict';
import { join } from 'node:path';

/** Only an authenticated, failed inventory check can precede this continuation. */
export function checkPreReplacementFailure(entries, installation) {
  const { programs, kernelUid, managerSocket, controlSocket } = installation;
  assert.equal(
    entries.length,
    3,
    'The original attempt must have stopped at its first inventory verifier',
  );
  const [accountEntry, socketsEntry, failure] = entries;
  assert.equal(accountEntry.file, '/usr/bin/getent');
  assert.deepEqual(accountEntry.args, ['passwd', String(kernelUid)]);
  assert.equal(accountEntry.status, 0);
  assert.equal(accountEntry.signal, null);
  assert(accountEntry.error == null);
  const account = accountEntry.stdout.trim().split(':');
  assert.equal(Number(account[2]), kernelUid);
  assert.equal(socketsEntry.file, '/usr/bin/systemctl');
  assert.deepEqual(socketsEntry.args, ['--system', 'start', managerSocket, controlSocket]);
  assert.equal(socketsEntry.status, 0);
  assert.equal(socketsEntry.signal, null);
  assert(socketsEntry.error == null);
  assert.equal(failure.file, '/usr/sbin/runuser');
  assert.deepEqual(failure.args, [
    '-u',
    account[0],
    '--',
    join(programs, 'node'),
    join(programs, 'network-adapters-verify.mjs'),
    join(programs, 'installed.json'),
  ]);
  assert.equal(failure.error?.code, 'ETIMEDOUT');
}
