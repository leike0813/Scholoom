import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { runCommand } from '../../packages/platform/dist/node.js';
import type { RenderFormat, RenderJob } from '../../packages/protocol/dist/editor.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-writing-'));
  const path = join(root, 'project');
  await mkdir(path);
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  const project = await app.call('project.open', { path });
  await app.call('project.grant', {
    projectId: project.id,
    trust: 'restricted',
    autoBackup: false,
  });
  return { root, path, app, projectId: project.id };
}
async function completed(app: ManualApplication, projectId: string, job: RenderJob) {
  let current = job;
  await expect
    .poll(
      async () => {
        current = await app.call('editor.job', { projectId, jobId: job.id });
        return ['queued', 'running', 'cancelling'].includes(current.state);
      },
      { timeout: 180000 },
    )
    .toBe(false);
  return current;
}
async function bytes(app: ManualApplication, projectId: string, outputId: string) {
  const chunks: Buffer[] = [];
  let offset = 0;
  for (;;) {
    const chunk = await app.call('editor.output', { projectId, outputId, offset, limit: 512 });
    chunks.push(Buffer.from(chunk.base64, 'base64'));
    if (chunk.nextOffset === undefined) return Buffer.concat(chunks);
    expect(chunk.nextOffset).toBeGreaterThan(offset);
    offset = chunk.nextOffset;
  }
}

test('managed commands collect results and confirm timeout and cancellation without another execution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-command-'));
  const request = { executable: process.execPath, cwd: root, timeoutMs: 5000 };
  expect(
    await runCommand({
      ...request,
      args: ['-e', 'process.stdout.write("result"); process.stderr.write("detail")'],
    }),
  ).toMatchObject({ code: 0, stdout: 'result', stderr: 'detail' });
  await expect(
    runCommand({ ...request, timeoutMs: 50, args: ['-e', 'setInterval(()=>{},1000)'] }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  const controller = new AbortController();
  const pending = runCommand(
    { ...request, args: ['-e', 'setInterval(()=>{},1000)'] },
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 100);
  await expect(pending).rejects.toBeDefined();
  await expect(
    runCommand({ ...request, args: ['-e', 'process.stdout.write("x".repeat(2000000))'] }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  expect(
    (await runCommand({ ...request, args: ['-e', 'process.stdout.write("still available")'] }))
      .stdout,
  ).toBe('still available');
});

test('manual editor performs real academic conversion and preserves bibliography without a harness', async () => {
  const { app, path, projectId } = await fixture();
  try {
    assert(!('harness' in app));
    const bibliography =
      '@article{sample2026,title={{Independent Evidence}},author={Smith, Jane},year={2026}}\n';
    await writeFile(join(path, 'refs.bib'), bibliography);
    const content =
      '---\ntitle: Writing sample\nbibliography: refs.bib\n---\n\n# Findings {#sec-findings}\n\nA finding [@sample2026, p. 7] and $E=mc^2$.\n\n| Method | Value |\n|---|---|\n| A | 42 |\n';
    await writeFile(join(path, 'main.qmd'), content);
    const ast = await app.call('editor.convert', {
      projectId,
      path: 'main.qmd',
      kind: 'markdownToAst',
      content,
      format: 'markdown',
    });
    expect(JSON.parse(ast.text).heading_ids).toContain('#sec-findings');
    const written = await app.call('editor.convert', {
      projectId,
      path: 'main.qmd',
      kind: 'astToMarkdown',
      json: ast.text,
      format: 'markdown',
      options: ['--wrap=none', '--reference-location=document'],
    });
    expect(written.text).toContain('sample2026');
    expect(written.text).toContain('E=mc^2');
    const references = JSON.parse(
      (await app.call('editor.convert', { projectId, path: 'main.qmd', kind: 'bibliography' }))
        .text,
    );
    expect(references.bibliography.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'sample2026', title: 'Independent Evidence' }),
      ]),
    );
    expect(await readFile(join(path, 'refs.bib'), 'utf8')).toBe(bibliography);
    await expect(
      app.call('editor.convert', {
        projectId,
        path: 'main.qmd',
        kind: 'markdownToAst',
        content,
        options: ['--lua-filter', '/tmp/unapproved.lua'],
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
  } finally {
    await app.close();
  }
});

for (const format of ['html', 'pdf', 'docx'] as const satisfies readonly RenderFormat[]) {
  test(`manual writing produces actual ${format} and exports with project conflict protection`, async () => {
    test.setTimeout(240000);
    const { app: initial, path, root, projectId } = await fixture();
    let app = initial;
    try {
      const rawHtml =
        '\n```{=html}\n<img src="file:///proc/self/comm">\n```\n\n`<img src="file:///proc/self/comm">`{=html}\n';
      await writeFile(
        join(path, 'main.qmd'),
        `---\ntitle: Evidence sample\ndocumentclass: article\n---\n\n# Results\n\nIndependent result **forty two** with a formula $E=mc^2$.\n${rawHtml}`,
      );
      await writeFile(join(path, '_quarto.yml'), 'project:\n  pre-render: node forbidden.js\n');
      await writeFile(
        join(path, 'forbidden.js'),
        `require('fs').writeFileSync(${JSON.stringify(join(root, 'forbidden-marker'))},'executed')`,
      );
      const request = { projectId, path: 'main.qmd', format, operationId: randomUUID() };
      const result = await completed(app, projectId, await app.call('editor.render', request));
      expect(
        result.diagnostics.filter((item) => item.code !== 'executionExcluded'),
        result.log,
      ).toEqual([]);
      expect(result.state, result.log).toBe('completed');
      assert(result.output);
      const content = await bytes(app, projectId, result.output.id);
      expect(content.length).toBe(result.output.byteLength);
      if (format === 'html') {
        expect(content.toString()).toContain('forty two');
        expect(content.toString()).not.toContain('data:application/octet-stream;base64');
        expect(content.toString()).not.toContain('file:///proc/self/comm');
      } else
        expect(content.subarray(0, format === 'pdf' ? 5 : 2).toString()).toBe(
          format === 'pdf' ? '%PDF-' : 'PK',
        );
      await expect(access(join(root, 'forbidden-marker'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect((await app.call('editor.render', request)).id).toBe(result.id);
      const exported = await app.call('editor.export', {
        projectId,
        outputId: result.output.id,
        path: `result.${format}`,
        operationId: randomUUID(),
      });
      await expect
        .poll(
          async () =>
            (
              await app.call('files.transferStatus', {
                projectId,
                operationId: exported.transferId,
              })
            ).state,
        )
        .toBe('complete');
      expect(await readFile(join(path, `result.${format}`))).toEqual(content);
      const duplicate = await app.call('editor.export', {
        projectId,
        outputId: result.output.id,
        path: `result.${format}`,
        operationId: randomUUID(),
      });
      await expect
        .poll(
          async () =>
            (
              await app.call('files.transferStatus', {
                projectId,
                operationId: duplicate.transferId,
              })
            ).state,
        )
        .toBe('conflict');
      expect(await readFile(join(path, `result.${format}`))).toEqual(content);
      if (format === 'docx') {
        const text = await runCommand({
          executable: 'quarto',
          args: ['pandoc', join(path, 'result.docx'), '--to', 'plain'],
          cwd: root,
          timeoutMs: 30000,
        });
        expect(text.stdout).toContain('forty two');
      }
      if (format === 'html') {
        await app.close();
        const interruptedId = randomUUID();
        const receipt = { ...result, id: interruptedId, state: 'running', output: undefined };
        await writeFile(
          join(
            root,
            'profile',
            'editor',
            `item-${encodeURIComponent(projectId)}`,
            'jobs',
            `item-${interruptedId}.json`,
          ),
          JSON.stringify(receipt),
        );
        app = new ManualApplication(join(root, 'profile'));
        await app.initialize();
        const recovered = await app.call('editor.job', { projectId, jobId: interruptedId });
        expect(recovered.state).toBe('interrupted');
        expect(recovered.lastSuccess?.id).toBe(result.output.id);
        expect((await app.call('editor.render', request)).output?.id).toBe(result.output.id);
        expect(await bytes(app, projectId, result.output.id)).toEqual(content);
      }
    } finally {
      await app.close();
    }
  });
}

test('native multi-file LaTeX preserves last successful PDF after a failed compilation', async () => {
  test.setTimeout(240000);
  const { app, path, projectId } = await fixture();
  try {
    await mkdir(join(path, 'chapters'));
    await writeFile(
      join(path, 'main.tex'),
      '\\documentclass{article}\n\\begin{document}\\input{chapters/a}\\end{document}\n',
    );
    await writeFile(join(path, 'chapters/a.tex'), '\\input{chapter}\n');
    await writeFile(join(path, 'chapter.tex'), 'The independent result is 42.\n');
    const first = await completed(
      app,
      projectId,
      await app.call('editor.render', {
        projectId,
        path: 'main.tex',
        format: 'pdf',
        operationId: randomUUID(),
      }),
    );
    expect(first.state, first.log).toBe('completed');
    assert(first.output);
    const ref = { source: 'render' as const, projectId, outputId: first.output.id };
    const resource = await app.call('resources.describe', { locator: ref });
    expect(resource).toMatchObject({
      ref,
      basis: first.output.basis,
      format: 'pdf',
      render: {
        jobId: first.id,
        input: { basis: first.basis, ref: { source: 'project', fileId: first.fileId } },
      },
      capabilities: { read: true, write: false, readingRecords: false, render: false },
    });
    const input = { ref, basis: resource.basis };
    const raw = await app.call('resources.read', { ...input, encoding: 'base64' });
    expect(Buffer.from(raw.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    const page = await app.call('resources.document', {
      ...input,
      request: { method: 'readPdfPage', input: { pageIndex: 0 } },
    });
    expect('text' in page && page.text).toContain('42');
    await expect(
      app.call('resources.save', { ...input, content: 'replace PDF' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      app.call('resources.read', { ...input, basis: 'wrong-output-basis', encoding: 'base64' }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(first.dependencies.map((item) => item.path)).toContain('chapter.tex');
    await writeFile(join(path, 'chapter.tex'), '\\UnknownCommand\n');
    await writeFile(
      join(path, 'main.tex'),
      '\\documentclass{article}\n\\begin{document}\\input{chapters/a}\\end{document}\n% changed input\n',
    );
    const failed = await completed(
      app,
      projectId,
      await app.call('editor.render', {
        projectId,
        path: 'main.tex',
        format: 'pdf',
        operationId: randomUUID(),
      }),
    );
    expect(failed.state).toBe('failed');
    expect(failed.output).toBeUndefined();
    expect(failed.lastSuccess?.id).toBe(first.output.id);
    expect(failed.basis).not.toBe(first.basis);
    expect(await app.call('resources.describe', { locator: ref })).toEqual(resource);
    expect((await bytes(app, projectId, first.output.id)).subarray(0, 5).toString()).toBe('%PDF-');
  } finally {
    await app.close();
  }
});
