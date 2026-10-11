// Throwaway watcher experiment; modifies only the generated temporary fixtures.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { root, qmd, chapter, latexArgs } from './live-preview-benchmark.mjs';

const recoveryOnly = process.argv.includes('--quarto-recovery-only');
const measurements = recoveryOnly ? JSON.parse(await readFile(join(root, 'quarto-watch-results.json'), 'utf8')).measurements : [];
const children = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, detached: true });
  children.add(child);
  let log = '';
  child.stdout.on('data', b => { log += b; });
  child.stderr.on('data', b => { log += b; });
  child.on('error', e => { log += String(e); });
  child.on('close', () => children.delete(child));
  return { child, log: () => log };
}
async function stop(p) {
  if (!children.has(p.child)) return;
  try { process.kill(-p.child.pid, 'SIGTERM'); } catch {}
  await Promise.race([new Promise(resolve => p.child.once('close', resolve)), delay(3000)]);
  if (children.has(p.child)) { try { process.kill(-p.child.pid, 'SIGKILL'); } catch {} }
}
async function until(check, timeout = 30000) {
  const startTime = performance.now();
  while (performance.now() - startTime < timeout) {
    if (await check()) return Math.round(performance.now() - startTime);
    await delay(50);
  }
  throw new Error(`Timed out after ${timeout} ms`);
}
async function record(label, action, check, detail = {}) {
  const startTime = performance.now();
  await action();
  try {
    await until(check);
    const result = { label, ms: Math.round(performance.now() - startTime), ...detail };
    measurements.push(result); console.log(JSON.stringify(result));
    return result;
  } finally {
    await writeFile(join(root, 'watch-results.json'), JSON.stringify({ root, measurements }, null, 2));
  }
}
async function clone(name, template) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  for (const file of template.startsWith('qmd') ? ['main.qmd', 'chart.png', 'refs.bib'] : ['main.tex', 'chapter.tex', 'chart.png', 'refs.bib']) await copyFile(join(root, template, file), join(dir, file));
  return dir;
}

async function quartoWatch() {
  const dir = await clone('live-qmd', 'qmd-small');
  await writeFile(join(dir, 'main.qmd'), qmd(6, recoveryOnly ? 'BURST-9' : 'WATCH-BASE'));
  const url = 'http://127.0.0.1:8765/main.html';
  async function html() { try { return await (await fetch(url)).text(); } catch { return ''; } }
  const startTime = performance.now();
  const p = start('quarto', ['preview', 'main.qmd', '--to', 'html', '--no-execute', '--no-browser', '--port', '8765'], dir);
  try {
    await until(async () => (await html()).includes(recoveryOnly ? 'BURST-9' : 'WATCH-BASE'));
    if (!recoveryOnly) {
    measurements.push({ label: 'quarto-preview-start', ms: Math.round(performance.now() - startTime) });
    for (const [name, source] of [
      ['body', qmd(6, 'WATCH-BODY')],
      ['formula', qmd(6, 'WATCH-FORMULA').replace('\\beta x', '\\beta x^2')],
      ['citation', qmd(6, 'WATCH-CITATION').replace('Evidence [@demo2024]', 'Evidence [@other2025]')],
    ]) await record(`quarto-watch-${name}`, () => writeFile(join(dir, 'main.qmd'), source), async () => (await html()).includes(`WATCH-${name.toUpperCase()}`));
    const beforeBib = p.log().length;
    const bib = await readFile(join(dir, 'refs.bib'), 'utf8');
    const bibStart = performance.now();
    await writeFile(join(dir, 'refs.bib'), bib.replace('A Second Synthetic Source', 'Updated Bibliography Source'));
    await delay(5000);
    measurements.push({ label: 'quarto-watch-bib-only', elapsedMs: Math.round(performance.now() - bibStart), refreshed: (await html()).includes('Updated Bibliography Source'), newLog: p.log().slice(beforeBib) });
    await record('quarto-watch-bib-with-source', () => writeFile(join(dir, 'main.qmd'), qmd(6, 'WATCH-BIB').replace('Evidence [@demo2024]', 'Evidence [@other2025]')), async () => (await html()).includes('WATCH-BIB') && (await html()).includes('Updated Bibliography Source'));
    const renderCount = () => (p.log().match(/Output created:/g) || []).length;
    const beforeBurst = renderCount();
    const burstStart = performance.now();
    let lastWrite = burstStart;
    for (let i = 0; i < 10; i++) {
      await writeFile(join(dir, 'main.qmd'), qmd(6, `BURST-${i}`));
      lastWrite = performance.now();
      await delay(100);
    }
    await until(async () => (await html()).includes('BURST-9'));
    await delay(1000);
    measurements.push({ label: 'quarto-watch-burst', edits: 10, intervalMs: 100, fromFirstMs: Math.round(performance.now() - burstStart - 1000), fromLastMs: Math.round(performance.now() - lastWrite - 1000), renderCompletions: renderCount() - beforeBurst });
    }
    const oldHtml = await html();
    const errorLogStart = p.log().length;
    await writeFile(join(dir, 'main.qmd'), '---\ntitle: [\n---\nBroken YAML\n');
    await until(() => /ERROR|Yaml|YAML/.test(p.log().slice(errorLogStart)), 5000).catch(() => {});
    await delay(500);
    const failedHtml = await html();
    measurements.push({ label: 'quarto-watch-invalid-yaml', watcherAlive: p.child.exitCode === null, oldPreviewPresent: failedHtml.includes('BURST-9'), contentUnchanged: failedHtml === oldHtml, diagnosticObserved: /ERROR|Yaml|YAML/.test(p.log().slice(errorLogStart)), newLog: p.log().slice(errorLogStart) });
    await record('quarto-watch-recovery', () => writeFile(join(dir, 'main.qmd'), qmd(6, 'WATCH-RECOVERED')), async () => (await html()).includes('WATCH-RECOVERED'));
    // Keep a bounded window open for independent browser verification, then stop.
    console.log(`BROWSER_READY=${url}`);
    await writeFile(join(root, 'browser-ready'), url);
    await until(async () => { try { return (await readFile(join(root, 'browser-done'), 'utf8')).includes('done'); } catch { return false; } }, 60000).catch(() => {});
  } finally {
    await writeFile(join(root, 'quarto-watch.log'), p.log());
    await stop(p);
  }
}

async function latexWatch(tuned) {
  const dir = await clone(tuned ? 'live-tex-tuned' : 'live-tex-default', 'tex-small');
  await writeFile(join(dir, 'chapter.tex'), chapter(6, 'WATCH-BASE'));
  const text = () => { try { return execFileSync('pdftotext', ['main.pdf', '-'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };
  const suffix = tuned ? 'tuned' : 'default';
  const p = start('latexmk', [...latexArgs.slice(0, -1), '-pvc', '-view=none', ...(tuned ? ['-e', '$sleep_time=0.2;'] : []), 'main.tex'], dir);
  try {
    await until(() => p.log().includes('Watching for updated files'), 45000);
    for (const token of ['BODY', 'FORMULA']) {
      const source = chapter(6, `WATCH-${token}`).replace('\\beta x', token === 'FORMULA' ? '\\beta x^2' : '\\beta x');
      await record(`latex-watch-${suffix}-${token.toLowerCase()}`, () => writeFile(join(dir, 'chapter.tex'), source), () => text().includes(`WATCH-${token}`));
      await until(() => /Watching for updated files[^\n]*\s*$/.test(p.log()));
    }
    if (!tuned) return;
    const beforeBurst = (p.log().match(/Run number .* of rule 'pdflatex'/g) || []).length;
    const burstStart = performance.now();
    let lastWrite = burstStart;
    for (let i = 0; i < 10; i++) { await writeFile(join(dir, 'chapter.tex'), chapter(6, `BURST-${i}`)); lastWrite = performance.now(); await delay(100); }
    await until(() => text().includes('BURST-9'));
    await until(() => /Watching for updated files[^\n]*\s*$/.test(p.log()));
    measurements.push({ label: 'latex-watch-tuned-burst', edits: 10, intervalMs: 100, fromFirstMs: Math.round(performance.now() - burstStart), fromLastMs: Math.round(performance.now() - lastWrite), pdflatexRuns: (p.log().match(/Run number .* of rule 'pdflatex'/g) || []).length - beforeBurst });
    const previousPdf = await readFile(join(dir, 'main.pdf'));
    const logStart = p.log().length;
    await writeFile(join(dir, 'chapter.tex'), chapter(6, 'BROKEN') + '\\clearpage\n\\UndefinedPreviewCommand\n');
    await until(() => /Errors, so I did not complete|Failure|Error/.test(p.log().slice(logStart)) && p.log().slice(logStart).includes('Watching for updated files'));
    const afterPdf = await readFile(join(dir, 'main.pdf')).catch(() => null);
    measurements.push({ label: 'latex-watch-late-error', watcherAlive: p.child.exitCode === null, pdfExists: !!afterPdf, previousPdfUnchanged: !!afterPdf?.equals(previousPdf), pdfContainsBrokenRevision: text().includes('BROKEN'), error: p.log().slice(logStart) });
    await record('latex-watch-recovery', () => writeFile(join(dir, 'chapter.tex'), chapter(6, 'WATCH-RECOVERED')), () => text().includes('WATCH-RECOVERED'));
  } finally { await writeFile(join(root, `latex-watch-${suffix}.log`), p.log()); await stop(p); }
}

try {
  if (process.argv.includes('--latex-only')) { await latexWatch(false); await latexWatch(true); }
  else await quartoWatch();
} finally {
  for (const child of [...children]) await stop({ child });
  await writeFile(join(root, process.argv.includes('--latex-only') ? 'latex-watch-results.json' : 'quarto-watch-results.json'), JSON.stringify({ root, measurements }, null, 2));
  assert(measurements.length > 0);
}
