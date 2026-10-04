// Throwaway host experiment for ticket 16. No dependencies or real user library.
import {mkdtemp, mkdir, copyFile, readFile, writeFile, access, cp} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {tmpdir, homedir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn, execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

const root = dirname(fileURLToPath(import.meta.url));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const assetRoot = option('asset-root');
const round = option('round') || 'baseline';
const seedFrom = option('seed-from');
const resumeFrom = option('resume-from');
const display = option('display') || (round === 'cold' ? 'headless' : 'xvfb');
if (!['headless', 'xvfb'].includes(display) || (round !== 'cold' && display !== 'xvfb')) throw new Error('Cold display must be headless or xvfb');
if (seedFrom && round !== 'cold') throw new Error('--seed-from is only for cold comparison');
if (resumeFrom && round !== 'restart') throw new Error('--resume-from belongs to the restart experiment');
if (!['baseline', 'ipc', 'cold', 'boundary', 'reader', 'restart'].includes(round)) throw new Error('Unknown experiment round');
const outputDir = await mkdtemp(join(tmpdir(), 'scholoom-host-prototype-'));
console.log(`Run directory: ${outputDir}`);
const packages = [
  {name: 'Better BibTeX', version: '9.0.68', id: 'better-bibtex@iris-advies.com',
    file: 'zotero-better-bibtex-9.0.68.xpi',
    url: 'https://github.com/retorquere/zotero-better-bibtex/releases/download/v9.0.68/zotero-better-bibtex-9.0.68.xpi'},
  {name: 'Jasminum', version: '1.1.39', id: 'jasminum@linxzh.com',
    file: 'jasminum_1.1.39.xpi',
    url: 'https://github.com/l0o0/jasminum/releases/download/v1.1.39/jasminum_1.1.39.xpi'},
];
const hostFile = 'Zotero-10.0.5_linux-x86_64.tar.xz';
const hostURL = `https://download.zotero.org/client/release/10.0.5/${hostFile}`;
async function acquire(file, url) {
  const dest = join(outputDir, file);
  if (assetRoot) await copyFile(join(resolve(assetRoot), file), dest);
  else execFileSync('curl', ['-fL', '--retry', '2', '--max-time', '240', '-o', dest, url], {stdio: 'inherit'});
  return dest;
}
const archive = await acquire(hostFile, hostURL);
for (const pkg of packages) {
  pkg.path = await acquire(pkg.file, pkg.url);
  const manifest = JSON.parse(execFileSync('unzip', ['-p', pkg.path, 'manifest.json'], {encoding: 'utf8'}));
  if (manifest.version !== pkg.version || manifest.applications.zotero.id !== pkg.id) throw new Error(`Wrong XPI: ${pkg.file}`);
  pkg.manifest = manifest;
}
if (!resumeFrom) execFileSync('tar', ['-xf', archive, '-C', outputDir]);
const stateRoot = resumeFrom ? resolve(resumeFrom) : outputDir;
const hostRoot = join(stateRoot, 'Zotero_linux-x86_64');
if (resumeFrom) {
  const previous = JSON.parse(await readFile(join(stateRoot, 'process-result.json'), 'utf8'));
  if (previous.code !== 0 || previous.interrupted) throw new Error('Resume requires a normally stopped scratch host');
  await copyFile(join(stateRoot, 'identity-bindings.json'), join(outputDir, 'identity-bindings.json'));
  await copyFile(join(stateRoot, 'restart-expected.json'), join(outputDir, 'restart-expected.json'));
}
if (['reader', 'restart'].includes(round)) {
  await mkdir(join(outputDir, 'pdfjs'));
  for (const member of ['pdf.mjs', 'pdf.worker.mjs']) {
    const bytes = execFileSync('unzip', ['-p', join(hostRoot, 'app/omni.ja'), `resource/reader/pdf/build/${member}`], {maxBuffer: 8 * 1024 * 1024});
    await writeFile(join(outputDir, 'pdfjs', member), bytes);
  }
}
const appINI = await readFile(join(hostRoot, 'app/application.ini'), 'utf8');
const platformINI = await readFile(join(hostRoot, 'platform.ini'), 'utf8');
if (!appINI.includes('Version=10.0.5')) throw new Error('Wrong host archive');
await writeFile(join(outputDir, 'baseline.json'), JSON.stringify({hostURL, appINI, platformINI, packages}, null, 2));
// Shared uv project is only used to generate a synthetic fixture; cwd stays here.
execFileSync('uv', ['run', `--project=${join(homedir(), '.ar')}`, '--locked', '--', 'python',
  join(root, 'fixtures/make_pdf.py'), join(outputDir, 'fixture.pdf')], {stdio: 'inherit'});
await copyFile(join(root, 'fixtures/items.json'), join(outputDir, 'items.json'));
try {
  await access(join(root, 'fixtures/chinese-fixture.json'));
  await copyFile(join(root, 'fixtures/chinese-fixture.json'), join(outputDir, 'chinese-fixture.json'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const profile = join(stateRoot, 'profile');
const data = join(stateRoot, 'data');
if (!resumeFrom) {
  await mkdir(join(profile, 'extensions'), {recursive: true});
  await mkdir(data);
}
if (seedFrom) {
  const source = resolve(seedFrom);
  const previousProcess = JSON.parse(await readFile(join(source, 'process-result.json'), 'utf8'));
  if (previousProcess.code !== 0 || previousProcess.interrupted) throw new Error('Seed must be a normally stopped scratch host');
  const previous = JSON.parse(await readFile(join(source, 'gecko-results.json'), 'utf8'));
  if (!previous.finishedAt || !previous.ipc?.itemRef || !previous.ipc?.attachmentRef) throw new Error('Seed lacks fixture identities');
  await cp(join(source, 'data'), data, {recursive: true});
  await writeFile(join(outputDir, 'seed-items.json'), JSON.stringify({sourceRun: source, itemRef: previous.ipc.itemRef, attachmentRef: previous.ipc.attachmentRef}, null, 2));
}
for (const pkg of packages) await copyFile(pkg.path, join(profile, 'extensions', `${pkg.id}.xpi`));
// Companion plugin remains separate; the two release XPIs retain original bytes.
const companion = join(profile, 'extensions/scholoom-host-probe@local.invalid.xpi');
execFileSync('zip', ['-qr', companion, '.'], {cwd: join(root, 'gecko-probe')});
if (round === 'cold') {
  // Extend only this newly generated runtime artifact with a privileged startup page.
  // Original archive and existing Zotero members remain unchanged.
  const additions = join(outputDir, 'startup-additions');
  const member = 'chrome/content/zotero/scholoom-cold-launch.xhtml';
  await mkdir(dirname(join(additions, member)), {recursive: true});
  await copyFile(join(root, 'cold-launch.xhtml'), join(additions, member));
  const scriptMember = 'chrome/content/zotero/scholoom-cold-launch.js';
  await copyFile(join(root, 'cold-launch.js'), join(additions, scriptMember));
  execFileSync('zip', ['-q', join(hostRoot, 'app/omni.ja'), member, scriptMember], {cwd: additions});
}
const prefs = {
  'app.update.enabled': false,
  'app.update.auto': false,
  'extensions.update.enabled': false,
  'extensions.autoDisableScopes': 0,
  'extensions.enabledScopes': 5,
  'extensions.logging.enabled': true,
  'browser.dom.window.dump.enabled': true,
  'xpinstall.signatures.required': false,
  'datareporting.policy.dataSubmissionEnabled': false,
  'extensions.zotero.dataDir': data,
  'extensions.zotero.useDataDir': true,
  'extensions.zotero.firstRunGuidance': false,
  'extensions.zotero.firstRun.skipFirefoxProfileAccessCheck': true,
  'extensions.zotero.httpServer.enabled': false,
  'extensions.zotero.sync.autoSync': false,
  'extensions.zotero.automaticScraperUpdates': false,
  'extensions.jasminum.autoUpdateTranslators': false,
  'extensions.jasminum.firstRun': false,
  'extensions.jasminum.autoUpdateMetadata': false,
  'extensions.scholoomProbe.outputDir': outputDir,
  'extensions.scholoomProbe.round': round,
  'extensions.scholoomProbe.companionURI': pathToFileURL(companion).href,
};
await writeFile(join(profile, 'user.js'), Object.entries(prefs).map(([key, value]) =>
  `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join('\n') + '\n');

const log = createWriteStream(join(outputDir, 'gecko.log'));
const hostArgs = ['-no-remote', '-profile', profile, '--dataDir', data, '-ZoteroDebugText'];
if (round === 'cold') hostArgs.push('-chrome', 'chrome://zotero/content/scholoom-cold-launch.xhtml');
if (display === 'headless') hostArgs.push('-headless');
const command = display === 'headless' ? join(hostRoot, 'zotero') : 'xvfb-run';
const args = display === 'headless' ? hostArgs : ['-a', join(hostRoot, 'zotero'), ...hostArgs];
const hostEnv = {...process.env, MOZ_ENABLE_WAYLAND: '0', MOZ_NO_REMOTE: '1', MOZ_CRASHREPORTER_DISABLE: '1'};
if (display === 'headless') {delete hostEnv.DISPLAY; delete hostEnv.WAYLAND_DISPLAY; hostEnv.MOZ_HEADLESS = '1';}
else delete hostEnv.MOZ_HEADLESS;
await writeFile(join(outputDir, 'launch.json'), JSON.stringify({command, args, stateRoot, resumed: !!resumeFrom, displayServer: display === 'headless' ? 'none; Gecko headless' : 'Xvfb'}, null, 2));
const child = spawn(command, args, {
  detached: true,
  env: hostEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log, {end: false});
child.stderr.pipe(log, {end: false});
// A separate Node process issues real requests; the host does not script its inputs.
const clientFile = round === 'restart' ? 'restart-client.mjs' : round === 'cold' ? 'cold-client.mjs' : round === 'boundary' ? 'boundary-client.mjs' : round === 'reader' ? 'reader-client.mjs' : 'ipc-client.mjs';
const clientArgs = [join(root, clientFile), `--output-dir=${outputDir}`];
if (['reader', 'restart'].includes(round) && option('playwright-module')) clientArgs.push(`--playwright-module=${option('playwright-module')}`);
if (['reader', 'restart'].includes(round) && option('browser-executable')) clientArgs.push(`--browser-executable=${option('browser-executable')}`);
if (round === 'restart') clientArgs.push(`--phase=${resumeFrom ? 'resumed' : 'initial'}`);
if (round === 'restart' && option('electron-executable')) clientArgs.push(`--electron-executable=${option('electron-executable')}`);
const client = round !== 'baseline' ? spawn(process.execPath, clientArgs,
  {stdio: 'inherit'}) : null;
const clientExited = client ? once(client, 'close') : null;
let interrupted = false;
const stop = () => { interrupted = true; try {process.kill(-child.pid, 'SIGTERM');} catch (error) {if (error.code !== 'ESRCH') throw error;} };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
const exited = once(child, 'close');
const outcome = await Promise.race([exited.then(([code, signal]) => ({code, signal})),
  delay(240000, null, {ref: false}).then(() => ({timeout: true}))]);
if (outcome.timeout) {
  client?.kill('SIGTERM');
  stop();
  await Promise.race([exited, delay(5000)]);
  try {process.kill(-child.pid, 'SIGKILL');} catch (error) {if (error.code !== 'ESRCH') throw error;}
}
log.end();
process.removeListener('SIGINT', stop);
process.removeListener('SIGTERM', stop);
await writeFile(join(outputDir, 'process-result.json'), JSON.stringify({...outcome, interrupted}, null, 2));
let clientOutcome;
if (clientExited) {
  clientOutcome = await Promise.race([clientExited.then(([code, signal]) => ({code, signal})),
    delay(2000).then(() => ({timeout: true}))]);
  if (clientOutcome.timeout) client.kill('SIGTERM');
  await writeFile(join(outputDir, 'ipc-client-process.json'), JSON.stringify(clientOutcome, null, 2));
  if (outcome.code === 0) {
    // The host is stopped: read its actual persisted DB without a writable second authority.
    const {DatabaseSync} = await import('node:sqlite');
    const ready = JSON.parse(await readFile(join(outputDir, 'ipc-ready.json'), 'utf8'));
    const db = new DatabaseSync(join(data, 'zotero.sqlite'), {readOnly: true});
    try {
      const rows = db.prepare('SELECT items.itemID, items.libraryID, items.key, fields.fieldName, itemDataValues.value FROM items JOIN itemData USING(itemID) JOIN fields USING(fieldID) JOIN itemDataValues USING(valueID) WHERE items.libraryID=? AND items.key=? AND fields.fieldName IN (?, ?)')
        .all(ready.itemRef.libraryID, ready.itemRef.key, 'title', 'citationKey');
      const integrity = db.prepare('PRAGMA integrity_check').all();
      await writeFile(join(outputDir, 'ipc-persisted-state.json'), JSON.stringify({authority: 'read-only stopped host SQLite', rows, integrity}, null, 2));
      const clientReport = JSON.parse(await readFile(join(outputDir, 'ipc-client-results.json'), 'utf8'));
      const current = clientReport.checks.find(check => ['main-window-reconnect', 'final-authority-readback'].includes(check.name))?.detail
        || clientReport.requests.findLast(request => request.method === 'snapshot' && request.body?.ok)?.body.result;
      if (!current || rows.find(row => row.fieldName === 'title')?.value !== current.title
        || (rows.find(row => row.fieldName === 'citationKey')?.value ?? '') !== current.citationKey
        || integrity.some(row => row.integrity_check !== 'ok')) throw new Error('Stopped host persistence differs from client readback');
    console.log('IPC persisted title/key and SQLite integrity verified.');
    } finally {db.close();}
  }
}
let report;
try { report = JSON.parse(await readFile(join(outputDir, 'gecko-results.json'), 'utf8')); }
catch (error) { report = {fatal: {error: `No Gecko result: ${error.message}`}}; }
console.log('Gecko checks:');
for (const check of report.checks ?? []) console.log(`  ${check.status}: ${check.name}${check.error ? ` — ${check.error}` : ''}`);
if (report.fatal) console.log(`  fatal: ${report.fatal.error}`);
try {
  if (['boundary', 'reader', 'restart'].includes(round)) {
    console.log('Node compatibility probe not repeated; this round observes the Scholoom interface candidate.');
  } else {
    const {probeNode} = await import('./node-probe.mjs');
    const nodeResult = await probeNode({packages, outputDir});
    await writeFile(join(outputDir, 'node-results.json'), JSON.stringify(nodeResult, null, 2));
    console.log('Node results saved.');
  }
} catch (error) {
  await writeFile(join(outputDir, 'node-results.json'), JSON.stringify({fatal: error.message}, null, 2));
  console.log(`Node probe unavailable: ${error.message}`);
}
console.log(`Evidence: ${outputDir}`);
if (report.fatal || !report.finishedAt || report.checks?.some(check => check.status !== 'passed')
  || outcome.timeout || outcome.code !== 0 || (clientOutcome && clientOutcome.code !== 0)) process.exitCode = 1;
