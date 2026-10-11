// Throwaway experiment: real tool invocations, synthetic manuscripts, no project server.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

export const root = process.env.PREVIEW_EXPERIMENT_DIR || await mkdtemp(join(tmpdir(), 'scholoom-preview-'));
export const results = process.argv.includes('--resume') ? JSON.parse(await readFile(join(root, 'results.json'), 'utf8')).results : [];
export async function run(label, command, args, cwd, timeout = 90000) {
  const previous = process.argv.includes('--resume') && results.find(r => r.label === label && r.code === 0);
  if (previous) return { ...previous, output: await readFile(join(root, `${label}.log`), 'utf8') };
  const start = performance.now();
  const child = spawn(command, args, { cwd, detached: true });
  let output = '';
  child.stdout.on('data', b => { output += b; });
  child.stderr.on('data', b => { output += b; });
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }, timeout);
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  const result = { label, command, args, cwd, ms: Math.round(performance.now() - start), ...status };
  results.push(result);
  await writeFile(join(root, `${label}.log`), output);
  await writeFile(join(root, 'results.json'), JSON.stringify({ root, results }, null, 2));
  console.log(JSON.stringify(result));
  if (status.code !== 0) console.log(output.slice(-3000));
  return { ...result, output };
}
export const latexArgs = ['-norc', '-pdf', '-synctex=1', '-interaction=nonstopmode', '-halt-on-error', '-pdflatex=pdflatex -disable-installer -disable-write18 %O %S', 'main.tex'];
const paragraph = 'Scientific writing combines claims with evidence. A small change should update the visible manuscript without repeating the computation. The measurement here uses synthetic prose and existing results, so it isolates document rendering from data analysis. We compare the same source structure across repeated edits and record successful output separately from failed compilation.';
const bib = '@article{demo2024, author={Example, Alice}, title={Synthetic Evidence for Preview Experiments}, journal={Example Journal}, year={2024}}\n@article{other2025, author={Sample, Bob}, title={A Second Synthetic Source}, journal={Test Review}, year={2025}}\n';
export function qmd(sections = 6, revision = 'BASELINE') {
  return `---\ntitle: Preview experiment\nbibliography: refs.bib\nexecute:\n  enabled: false\nformat:\n  html:\n    toc: true\n    html-math-method: mathjax\n  pdf:\n    pdf-engine: pdflatex\n    pdf-engine-opts: ["-disable-installer", "-disable-write18"]\n    latex-auto-install: false\n    keep-tex: true\n---\n\nRevision ${revision}. Evidence [@demo2024]. See @fig-result, @tbl-results and @eq-model.\n\n$$\ny = \\alpha + \\beta x + \\epsilon\n$$ {#eq-model}\n\n![Existing result: a static line chart.](chart.png){#fig-result width=60%}\n\n| Group | Value |\n|---|---:|\n| A | 12 |\n| B | 24 |\n\n: Existing results {#tbl-results}\n\n` + Array.from({ length: sections }, (_, i) => `## Section ${i + 1}\n\n${Array(5).fill(paragraph).join('\n\n')}\n\n`).join('') + '\n## References\n\n::: {#refs}\n:::\n';
}
export function chapter(sections = 6, revision = 'BASELINE') {
  return `Revision ${revision}. Evidence \\cite{demo2024}. See Figure~\\ref{fig:result}, Table~\\ref{tab:results}, and Equation~\\ref{eq:model}.\n\\begin{equation}y = \\alpha + \\beta x + \\epsilon\\label{eq:model}\\end{equation}\n\\begin{figure}[ht]\\centering\\includegraphics[width=.6\\linewidth]{chart.png}\\caption{Existing result: a static line chart.}\\label{fig:result}\\end{figure}\n\\begin{table}[ht]\\centering\\begin{tabular}{lr}Group & Value\\\\ A & 12\\\\ B & 24\\\\\\end{tabular}\\caption{Existing results}\\label{tab:results}\\end{table}\n` + Array.from({ length: sections }, (_, i) => `\\section{Section ${i + 1}}\n${Array(5).fill(paragraph).join('\n\n')}\n\n`).join('');
}

async function main() {
  console.log(`EXPERIMENT_DIR=${root}`);
  // Reuse ImageMagick only to prepare a static fixture, never in the preview loop.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260"><rect width="640" height="260" fill="white"/><path d="M50 20V220H610" fill="none" stroke="black" stroke-width="3"/><path d="M60 200L160 180L260 130L360 140L460 80L590 40" fill="none" stroke="#3366aa" stroke-width="5"/></svg>';
  await writeFile(join(root, 'chart.svg'), svg);
  assert.equal((await run('fixture-chart', 'convert', ['chart.svg', 'chart.png'], root)).code, 0);
  for (const type of ['qmd-small', 'qmd-large', 'tex-small', 'tex-large']) {
    const dir = join(root, type);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'chart.png'), await readFile(join(root, 'chart.png')));
    await writeFile(join(dir, 'refs.bib'), bib);
    const sections = type.endsWith('large') ? 120 : 6;
    if (type.startsWith('qmd')) await writeFile(join(dir, 'main.qmd'), qmd(sections));
    else {
      await writeFile(join(dir, 'main.tex'), '\\documentclass{article}\n\\usepackage{amsmath,graphicx,hyperref}\n\\begin{document}\n\\title{Preview experiment}\\author{Synthetic fixture}\\maketitle\n\\input{chapter}\n\\bibliographystyle{plain}\n\\bibliography{refs}\n\\end{document}\n');
      await writeFile(join(dir, 'chapter.tex'), chapter(sections));
    }
  }
  for (const size of ['small', 'large']) {
    const sections = size === 'small' ? 6 : 120;
    const dir = join(root, `qmd-${size}`);
    for (const format of ['html', 'pdf']) {
      for (const revision of ['FIRST', 'BODY', 'FORMULA']) {
        if (results.some(r => r.label === `qmd-${size}-${format}-${revision}` && r.code === 0)) continue;
        let source = qmd(sections, `${format}-${revision}`);
        if (revision === 'FORMULA') source = source.replace('\\beta x', '\\beta x^2');
        await writeFile(join(dir, 'main.qmd'), source);
        const result = await run(`qmd-${size}-${format}-${revision}`, 'quarto', ['render', 'main.qmd', '--to', format, '--no-execute'], dir);
        if (result.code !== 0) break;
        if (format === 'html') {
          const html = await readFile(join(dir, 'main.html'), 'utf8');
          assert(html.includes(`${format}-${revision}`));
          assert(html.includes('Synthetic Evidence'));
          assert(html.includes('fig-result') && html.includes('tbl-results') && html.includes('eq-model'));
        } else {
          const check = await run(`qmd-${size}-${format}-${revision}-text`, 'pdftotext', ['main.pdf', '-'], dir);
          assert(check.output.includes(`${format}-${revision}`));
          assert(/synthetic\s+evidence/i.test(check.output));
        }
      }
    }
    const texDir = join(root, `tex-${size}`);
    for (const revision of ['FIRST', 'BODY', 'FORMULA']) {
      if (results.some(r => r.label === `tex-${size}-${revision}` && r.code === 0)) continue;
      let source = chapter(sections, revision);
      if (revision === 'FORMULA') source = source.replace('\\beta x', '\\beta x^2');
      await writeFile(join(texDir, 'chapter.tex'), source);
      const result = await run(`tex-${size}-${revision}`, 'latexmk', latexArgs, texDir);
      if (result.code !== 0) break;
      const check = await run(`tex-${size}-${revision}-text`, 'pdftotext', ['main.pdf', '-'], texDir);
      assert(check.output.includes(`Revision ${revision}`));
      assert(/synthetic\s+evidence/i.test(check.output));
    }
    await run(`tex-${size}-pdfinfo`, 'pdfinfo', ['main.pdf'], texDir);
  }
  const texDir = join(root, 'tex-small');
  const forward = await run('synctex-forward', 'synctex', ['view', '-i', `1:1:${join(texDir, 'chapter.tex')}`, '-o', join(texDir, 'main.pdf')], texDir);
  const page = forward.output.match(/Page:(\d+)/)?.[1];
  const x = forward.output.match(/x:([\d.]+)/)?.[1];
  const y = forward.output.match(/y:([\d.]+)/)?.[1];
  if (page && x && y) {
    const backward = await run('synctex-backward', 'synctex', ['edit', '-o', `${page}:${x}:${y}:${join(texDir, 'main.pdf')}`], texDir);
    assert(backward.output.includes('chapter.tex'));
  }
  await writeFile(join(root, 'results.json'), JSON.stringify({ root, results }, null, 2));
  console.log(`RESULTS=${join(root, 'results.json')}`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
