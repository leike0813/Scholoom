import assert from 'node:assert/strict';
import { checkPreReplacementFailure } from './repair-resume.mjs';

const installation = {
  programs: '/opt/scholoom-report-example',
  kernelUid: 1000,
  controlSocket: 'scholoom-report-example-control.socket',
  managerSocket: 'scholoom-report-example-manager.socket',
};
const trace = [
  {
    file: '/usr/bin/getent',
    args: ['passwd', '1000'],
    status: 0,
    signal: null,
    stdout: 'tester:x:1000:1000::/home/tester:/bin/sh\n',
  },
  {
    file: '/usr/bin/systemctl',
    args: ['--system', 'start', installation.managerSocket, installation.controlSocket],
    status: 0,
    signal: null,
  },
  {
    file: '/usr/sbin/runuser',
    args: [
      '-u',
      'tester',
      '--',
      `${installation.programs}/node`,
      `${installation.programs}/network-adapters-verify.mjs`,
      `${installation.programs}/installed.json`,
    ],
    status: null,
    signal: 'SIGTERM',
    error: { code: 'ETIMEDOUT' },
  },
];
checkPreReplacementFailure(trace, installation);
for (const mutate of [
  (entries) => {
    entries.push({ file: '/usr/bin/systemctl', args: ['stop'] });
  },
  (entries) => {
    entries[2].args[4] = '/opt/other/verify.mjs';
  },
  (entries) => {
    entries[2].error.code = 'EACCES';
  },
  (entries) => {
    delete entries[2].error;
    entries[2].status = 0;
  },
  (entries) => {
    entries[0].stdout = 'tester:x:2000:2000::/home/tester:/bin/sh';
  },
  (entries) => {
    entries[1].status = 1;
  },
]) {
  const changed = structuredClone(trace);
  mutate(changed);
  assert.throws(() => checkPreReplacementFailure(changed, installation));
}
console.log('Passed pre-replacement continuation acceptance and six refusal scenarios.');
