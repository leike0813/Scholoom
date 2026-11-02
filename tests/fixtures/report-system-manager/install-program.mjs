import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fchmodSync,
  fchownSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export function installProgram(bytes, destination, digest) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  // Never copy ownership/mode or expose a caller-writable inode in the protected directory.
  const fd = openSync(
    destination,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o500,
  );
  try {
    writeFileSync(fd, bytes);
    fchownSync(fd, process.geteuid(), process.getegid());
    fchmodSync(fd, 0o555);
    fsyncSync(fd);
    const info = fstatSync(fd);
    assert.ok(info.isFile() && info.nlink === 1);
    assert.equal(info.uid, process.geteuid());
    assert.equal(info.gid, process.getegid());
    assert.equal(info.mode & 0o7777, 0o555);
  } finally {
    closeSync(fd);
  }
}

/** Only the failed preparation layout, before any unit was installed, can be recovered. */
export function recoverStaging(runtime, programs, changes, hashes) {
  for (const path of [runtime, programs]) {
    const info = lstatSync(path);
    assert.ok(info.isDirectory() && info.uid === process.geteuid() && !(info.mode & 0o022));
  }
  assert.deepEqual(readdirSync(runtime).sort(), ['plan.json']);
  assert.deepEqual(readdirSync(programs).sort(), ['manager', 'probe']);
  const plan = join(runtime, 'plan.json');
  const info = lstatSync(plan);
  assert.ok(
    info.isFile() && info.nlink === 1 && info.uid === process.geteuid() && !(info.mode & 0o022),
  );
  assert.deepEqual(JSON.parse(readFileSync(plan, 'utf8')), changes);
  const originals = ['manager', 'probe'].map((name) => {
    const path = join(programs, name);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = fstatSync(fd);
      assert.ok(info.isFile() && info.nlink === 1);
      const bytes = readFileSync(fd);
      const digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, hashes[name]);
      return {
        name,
        path,
        bytes,
        digest,
        uid: info.uid,
        gid: info.gid,
        mode: info.mode & 0o7777,
        dev: info.dev,
        ino: info.ino,
      };
    } finally {
      closeSync(fd);
    }
  });
  writeFileSync(
    join(runtime, 'failed-staging.json'),
    JSON.stringify(
      originals.map(({ bytes: _bytes, ...metadata }) => metadata),
      null,
      2,
    ),
    { flag: 'wx', mode: 0o444 },
  );
  for (const original of originals)
    writeFileSync(join(runtime, `failed-${original.name}.bin`), original.bytes, {
      flag: 'wx',
      mode: 0o400,
    });
  const archive = join(programs, 'failed-staging');
  mkdirSync(archive, { mode: 0o700 });
  for (const original of originals) {
    const archived = join(archive, original.name);
    linkSync(original.path, archived);
    const held = lstatSync(archived);
    const current = lstatSync(original.path);
    assert.ok(
      current.isFile() &&
        current.nlink === 2 &&
        current.dev === original.dev &&
        current.ino === original.ino &&
        held.dev === original.dev &&
        held.ino === original.ino,
    );
    unlinkSync(original.path);
  }
}
