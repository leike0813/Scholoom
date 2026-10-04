// One controller owns two sequential host lifetimes; stateRoot stays the same.
import {mkdtemp, readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {isDeepStrictEqual} from 'node:util';
const root = dirname(fileURLToPath(import.meta.url));
const outputDir = await mkdtemp(join(tmpdir(), 'scholoom-restart-experiment-'));
console.log(`Restart controller: ${outputDir}`);
const report = {startedAt: new Date().toISOString(), phases: [], checks: []};
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const electronArchive = process.argv.find(arg => arg.startsWith('--electron-archive='))?.slice('--electron-archive='.length);
const options = process.argv.slice(2).filter(arg => !arg.startsWith('--electron-archive='));
if (options.some(arg => !['--asset-root=', '--playwright-module=', '--browser-executable='].some(prefix => arg.startsWith(prefix)))) throw Error('Use asset-root/playwright-module/browser-executable options only');
if (electronArchive) {
  const runtime = join(outputDir, 'electron'); await mkdir(runtime);
  execFileSync('unzip', ['-q', electronArchive, '-d', runtime]);
  options.push(`--electron-executable=${join(runtime, 'electron')}`);
  report.electronArchive = electronArchive;
}
async function run(resumeFrom) {
  const args = [join(root, 'run.mjs'), '--round=restart', ...options, ...(resumeFrom ? [`--resume-from=${resumeFrom}`] : [])];
  const child = spawn(process.execPath, args, {stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '';
  child.stdout.on('data', data => {stdout += data; process.stdout.write(data);});
  child.stderr.on('data', data => {stderr += data; process.stderr.write(data);});
  const result = await new Promise((resolve, reject) => {child.once('error', reject); child.once('close', (code, signal) => resolve({code, signal}));});
  const directory = stdout.match(/Run directory: ([^\n]+)/)?.[1];
  report.phases.push({phase: resumeFrom ? 'resumed' : 'initial', directory, controllerChildPID: child.pid, ...result, stdout, stderr});
  if (result.code !== 0 || !directory) throw Error('Host phase failed; evidence retained');
  return directory;
}
function stoppedState(stateRoot, bindings) {
  const db = new DatabaseSync(join(stateRoot, 'data/zotero.sqlite'), {readOnly: true});
  try {
    const source = db.prepare('SELECT itemID, libraryID, key FROM items WHERE libraryID=? AND key=?').get(bindings.source.providerRef.libraryID, bindings.source.providerRef.key);
    const material = db.prepare('SELECT items.itemID, libraryID, key, parentItemID FROM items JOIN itemAttachments USING(itemID) WHERE libraryID=? AND key=?').get(bindings.material.providerRef.libraryID, bindings.material.providerRef.key);
    if (!source || !material || material.parentItemID !== source.itemID) throw Error('Stopped library lacks bound source/material');
    return {itemCount: db.prepare('SELECT COUNT(*) AS count FROM items').get().count, source, material};
  } finally {db.close();}
}
try {
  const initial = await run();
  const expected = await json(join(initial, 'restart-expected.json'));
  const before = stoppedState(initial, expected.bindings);
  const storageBefore = (await readdir(join(initial, 'data/storage'))).sort();
  await writeFile(join(outputDir, 'before-restart.json'), JSON.stringify({expected, sqlite: before}, null, 2));
  const resumed = await run(initial);
  const after = stoppedState(initial, expected.bindings);
  const storageAfter = (await readdir(join(initial, 'data/storage'))).sort();
  const launch = await json(join(resumed, 'launch.json'));
  const initialLaunch = await json(join(initial, 'launch.json'));
  if (!isDeepStrictEqual(before, after)) throw Error('Restart recreated items or changed source/material relationship');
  if (!isDeepStrictEqual(storageBefore, storageAfter)) throw Error('Restart recreated attachment storage');
  const restored = (await json(join(resumed, 'gecko-results.json'))).checks.find(check => check.name === 'restore-existing-source-and-material')?.detail;
  if (restored?.itemID !== before.source.itemID || restored?.attachmentID !== before.material.itemID) throw Error('Restored runtime identities differ from stopped library');
  if (launch.stateRoot !== initial || !isDeepStrictEqual(launch.args, initialLaunch.args)) throw Error('Restart did not reuse same installation/profile/library');
  const beforeReady = await json(join(initial, 'ipc-ready.json'));
  const afterReady = await json(join(resumed, 'ipc-ready.json'));
  if (beforeReady.token === afterReady.token) throw Error('Restart reused stale RPC session');
  report.checks.push({name: 'same-state-root-and-records-after-new-process', status: 'passed', detail: {before, after, storageBefore, storageAfter, restored, stateRoot: initial, newRPCToken: true}});
  report.final = await json(join(resumed, 'restart-expected.json'));
} catch (error) {report.fatal = {message: error.message, stack: error.stack}; process.exitCode = 1;}
finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(join(outputDir, 'restart-results.json'), JSON.stringify(report, null, 2));
  console.log(`Restart evidence: ${outputDir}`);
}
