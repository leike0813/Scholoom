/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('saved project report opens as an inert common HTML resource', async ({ uiPage }, info) => {
  const result = info.outputPath('project-report');
  await mkdir(result, { recursive: true });
  const root = join(result, 'project');
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  try {
    const project = await client.call('project.create', { path: root, trust: 'restricted' });
    await client.call('files.save', {
      projectId: project.id,
      path: 'source.md',
      content: 'Dose 10 and 20.',
    });
    const source = await client.call('resources.describe', {
      locator: {
        source: 'project',
        projectId: project.id,
        path: 'source.md',
      },
    });
    const manifest = {
      version: 1,
      resources: [],
      sources: [{ ref: source.ref, basis: source.basis }],
      objects: [],
    };
    const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body><p>Comparison dose 10 and 20.</p><script>window.__reportExecuted=true</script></body></html>`;
    await client.call('files.save', { projectId: project.id, path: 'report.html', content: html });
    const entry = await client.call('resources.describe', {
      locator: {
        source: 'project',
        projectId: project.id,
        path: 'report.html',
      },
    });
    expect(
      (await client.call('resources.report', { ref: entry.ref, basis: entry.basis })).manifest,
    ).toEqual(manifest);
    const revised = html.replace('Comparison dose', 'Revised comparison dose');
    const saved = await client.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: revised,
    });
    expect(saved.basis).not.toBe(entry.basis);
    expect(await readFile(join(root, 'report.html'), 'utf8')).toBe(revised);
    await uiPage.goto(rendererUrl);
    await addProject(uiPage, root);
    await createSession(uiPage, { projectId: project.id });
    await uiPage.getByRole('treeitem', { name: '打开文件 report.html', exact: true }).dblclick();
    const article = uiPage
      .getByRole('region', { name: '文档阅读 report.html', exact: true })
      .getByRole('article', { name: '文档正文', exact: true });
    await expect(article).toContainText('Revised comparison dose 10 and 20.');
    expect(await uiPage.evaluate(() => Reflect.get(window, '__reportExecuted'))).toBeUndefined();
    expect(
      (await client.call('resources.report', { ref: saved.ref, basis: saved.basis })).manifest,
    ).toEqual(manifest);
  } finally {
    client.dispose();
  }
});
