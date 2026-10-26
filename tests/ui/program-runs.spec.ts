import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addProject, expect, openWorkbenchWindow, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('manual program tab runs a real calculation and opens its actual project output', async ({
  uiPage,
}) => {
  test.setTimeout(90_000);
  const projectName = `program-case-${test.info().project.name}`;
  const project = test.info().outputPath(projectName);
  await mkdir(project, { recursive: true });
  await writeFile(join(project, 'input.json'), '[2,4,6]');
  await writeFile(join(project, 'wait.mjs'), 'console.log("waiting");setInterval(()=>{},1000)');
  await writeFile(
    join(project, 'compute.mjs'),
    `import {readFile,writeFile} from 'node:fs/promises'; const data=JSON.parse(await readFile('input.json','utf8')); const sum=data.reduce((a,b)=>a+b,0); console.log('calculation finished'); await writeFile('result.csv','count,sum,mean\\n'+data.length+','+sum+','+sum/data.length+'\\n');`,
  );
  await uiPage.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(uiPage, project, { trust: 'restricted' });
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  const panel = uiPage.getByRole('region', { name: '项目程序运行', exact: true });
  await panel.getByLabel('项目代码路径', { exact: true }).fill('compute.mjs');
  await panel.getByRole('combobox', { name: '运行环境', exact: true }).selectOption('node');
  await panel
    .getByRole('textbox', { name: '声明输出（每行一条项目路径；留空表示无声明输出）', exact: true })
    .fill('result.csv');
  await panel.getByRole('button', { name: '运行项目代码', exact: true }).click();
  const detail = panel.getByRole('region', { name: '所选运行详情', exact: true });
  await expect(detail.getByText('执行完成', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(await readFile(join(project, 'result.csv'), 'utf8')).toBe('count,sum,mean\n3,12,4\n');
  await expect(panel).toContainText('calculation finished');
  await panel.getByRole('button', { name: '打开输出 result.csv', exact: true }).click();
  await expect(
    uiPage.getByRole('textbox', { name: '文件内容 result.csv', exact: true }),
  ).toContainText('3,12,4');
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('compute.mjs');
  const other = test.info().outputPath(`program-other-${test.info().project.name}`);
  await mkdir(other, { recursive: true });
  await addProject(uiPage, other, { trust: 'restricted' });
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('');
  await panel.getByLabel('项目代码路径', { exact: true }).fill('other.mjs');
  await uiPage.getByRole('button', { name: `管理项目 ${projectName}`, exact: true }).click();
  await uiPage
    .getByRole('menu', { name: `管理项目 ${projectName}`, exact: true })
    .getByRole('button', { name: '打开项目', exact: true })
    .click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('compute.mjs');
  await panel.getByLabel('项目代码路径', { exact: true }).fill('wait.mjs');
  await panel
    .getByRole('textbox', { name: '声明输出（每行一条项目路径；留空表示无声明输出）', exact: true })
    .fill('');
  await panel.getByRole('button', { name: '运行项目代码', exact: true }).click();
  await expect(detail.getByText('运行中', { exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: '运行日志', exact: true })).toContainText(
    'waiting',
  );
  await uiPage.getByRole('button', { name: '关闭 项目程序运行', exact: true }).click();
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(detail.getByText('运行中', { exact: true })).toBeVisible();
  const observer = await openWorkbenchWindow(uiPage);
  try {
    await observer.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
    await expect(observer.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await observer.getByRole('button', { name: `管理项目 ${projectName}`, exact: true }).click();
    await observer
      .getByRole('menu', { name: `管理项目 ${projectName}`, exact: true })
      .getByRole('button', { name: '打开项目', exact: true })
      .click();
    await observer.getByRole('button', { name: '项目程序运行', exact: true }).click();
    const observed = observer.getByRole('region', { name: '所选运行详情', exact: true });
    await expect(observed.getByText('运行中', { exact: true })).toBeVisible();
    await expect(observed.getByRole('heading', { level: 3 })).toHaveText(
      await detail.getByRole('heading', { level: 3 }).innerText(),
    );
    await observed.getByRole('button', { name: '取消运行', exact: true }).click();
    await expect(observed.getByText('已取消', { exact: true })).toBeVisible();
    await expect(detail.getByText('已取消', { exact: true })).toBeVisible();
  } finally {
    await observer.close();
  }
  const screenshot = test.info().outputPath('program-runs.png');
  await panel.screenshot({ path: screenshot });
  await test.info().attach('program-runs', { path: screenshot, contentType: 'image/png' });
  await uiPage.reload();
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('wait.mjs');
  // Retain registered files as artifacts until the fixture-owned kernel closes.
});
