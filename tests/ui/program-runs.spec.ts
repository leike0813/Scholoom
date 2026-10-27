import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addProject, expect, openWorkbenchWindow, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('manual program and task tabs preserve real resources, runs and project drafts', async ({
  uiPage,
}) => {
  test.setTimeout(90_000);
  const projectName = `program-case-${test.info().project.name}`;
  const project = test.info().outputPath(projectName);
  const taskTitle = '程序与任务联合核查';
  const taskPath = 'tasks/joint.task.md';
  const taskContent = `---\n${JSON.stringify({ kind: 'research-task', formatVersion: 1, id: 'joint-task', title: taskTitle, status: 'active' })}\n---\n\n核对输入与计算结果。\n`;
  const savedTaskNote = '人工核对：保留三项输入及计算依据。';
  await mkdir(join(project, 'tasks'), { recursive: true });
  await writeFile(join(project, taskPath), taskContent);
  await writeFile(join(project, 'process.md'), '# 核对过程\n输入为2、4、6，总和为12。\n');
  await writeFile(join(project, 'input.json'), '[2,4,6]');
  await writeFile(join(project, 'wait.mjs'), 'console.log("waiting");setInterval(()=>{},1000)');
  await writeFile(
    join(project, 'compute.mjs'),
    `import {readFile,writeFile} from 'node:fs/promises'; const data=JSON.parse(await readFile('input.json','utf8')); const sum=data.reduce((a,b)=>a+b,0); console.log('calculation finished'); await writeFile('result.csv','count,sum,mean\\n'+data.length+','+sum+','+sum/data.length+'\\n');`,
  );
  await uiPage.goto(rendererUrl, { waitUntil: 'domcontentloaded' });
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(uiPage, project, { trust: 'restricted' });
  await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
  await uiPage.getByRole('option', { name: new RegExp(`^${taskTitle} `) }).click();
  const taskTab = uiPage.getByRole('tab', { name: new RegExp(`^${taskTitle} 关闭`) });
  const taskDetail = uiPage.getByRole('region', { name: '研究任务详情', exact: true });
  await expect(taskDetail.getByRole('region', { name: '任务正文', exact: true })).toContainText(
    '核对输入与计算结果',
  );
  await taskDetail.getByRole('button', { name: '编辑入口', exact: true }).click();
  const taskEditor = uiPage.getByRole('textbox', { name: `文件内容 ${taskPath}`, exact: true });
  await expect(taskEditor).toContainText('核对输入与计算结果');
  await taskEditor.fill(`${taskContent}\n${savedTaskNote}\n`);
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(taskTab).toBeVisible();
  const panel = uiPage.getByRole('region', { name: '项目程序运行', exact: true });
  await panel.getByLabel('项目代码路径', { exact: true }).fill('compute.mjs');
  await panel.getByRole('combobox', { name: '运行环境', exact: true }).selectOption('node');
  await panel
    .getByRole('textbox', { name: '声明输出（每行一条项目路径；留空表示无声明输出）', exact: true })
    .fill('result.csv');
  await panel.getByRole('button', { name: '运行项目代码', exact: true }).click();
  const detail = panel.getByRole('region', { name: '所选运行详情', exact: true });
  await expect(detail.getByText('执行完成', { exact: true })).toBeVisible({ timeout: 20_000 });
  const completedRun = await detail.getByRole('heading', { level: 3 }).innerText();
  expect(await readFile(join(project, 'result.csv'), 'utf8')).toBe('count,sum,mean\n3,12,4\n');
  await expect(panel).toContainText('calculation finished');
  await panel.getByRole('button', { name: '打开输出 result.csv', exact: true }).click();
  await expect(
    uiPage.getByRole('textbox', { name: '文件内容 result.csv', exact: true }),
  ).toContainText('3,12,4');
  await taskTab.click();
  await expect(uiPage.getByRole('tab', { name: /^项目程序运行 关闭/ })).toBeVisible();
  await taskDetail.getByRole('button', { name: '编辑入口', exact: true }).click();
  await expect(taskEditor).toContainText(savedTaskNote);
  expect(await readFile(join(project, taskPath), 'utf8')).not.toContain(savedTaskNote);
  await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
  await expect.poll(() => readFile(join(project, taskPath), 'utf8')).toContain(savedTaskNote);
  await taskTab.click();
  await expect(taskDetail.getByRole('region', { name: '任务正文', exact: true })).toContainText(
    savedTaskNote,
  );
  await taskDetail.getByRole('button', { name: '关联现有材料', exact: true }).click();
  const association = uiPage.getByRole('form', { name: '关联任务材料', exact: true });
  await association
    .getByRole('textbox', { name: '项目内材料路径', exact: true })
    .fill('process.md');
  await association
    .getByRole('combobox', { name: '材料用途', exact: true })
    .selectOption('process');
  await association.getByRole('button', { name: '保存关联', exact: true }).click();
  await expect(association).toHaveCount(0);
  await taskDetail.getByRole('button', { name: '打开过程材料', exact: true }).click();
  await expect(
    uiPage.getByRole('textbox', { name: '文件内容 process.md', exact: true }),
  ).toContainText('输入为2、4、6，总和为12');
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(detail.getByRole('heading', { level: 3 })).toHaveText(completedRun);
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('compute.mjs');
  await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
  const taskDraftTitle = uiPage.getByRole('textbox', { name: '任务名称', exact: true });
  const taskDraftBody = uiPage.getByRole('textbox', { name: '任务正文', exact: true });
  await taskDraftTitle.fill('本项目待创建任务');
  await taskDraftBody.fill('本项目未保存的任务草稿');
  const otherName = `program-other-${test.info().project.name}`;
  const other = test.info().outputPath(otherName);
  await mkdir(other, { recursive: true });
  await addProject(uiPage, other, { trust: 'restricted' });
  await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
  await expect(uiPage.getByRole('option', { name: new RegExp(`^${taskTitle} `) })).toHaveCount(0);
  await expect(taskTab).toHaveCount(0);
  await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
  await expect(taskDraftTitle).toHaveValue('');
  await expect(taskDraftBody).toHaveValue('');
  await taskDraftTitle.fill('另一项目待创建任务');
  await taskDraftBody.fill('另一项目未保存的任务草稿');
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('');
  await panel.getByLabel('项目代码路径', { exact: true }).fill('other.mjs');
  await uiPage.getByRole('button', { name: `管理项目 ${projectName}`, exact: true }).click();
  await uiPage
    .getByRole('menu', { name: `管理项目 ${projectName}`, exact: true })
    .getByRole('button', { name: '打开项目', exact: true })
    .click();
  await expect(taskDraftTitle).toHaveValue('本项目待创建任务');
  await expect(taskDraftBody).toHaveValue('本项目未保存的任务草稿');
  await taskTab.click();
  await expect(taskDetail.getByRole('region', { name: '任务正文', exact: true })).toContainText(
    savedTaskNote,
  );
  await expect(taskDetail.getByRole('button', { name: '打开过程材料', exact: true })).toBeVisible();
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
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
    await observer.getByRole('tab', { name: '任务', exact: true }).click();
    await observer.getByRole('option', { name: new RegExp(`^${taskTitle} `) }).click();
    await expect(
      observer
        .getByRole('region', { name: '研究任务详情', exact: true })
        .getByRole('region', { name: '任务正文', exact: true }),
    ).toContainText(savedTaskNote);
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
  await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
  await expect(taskDraftTitle).toHaveValue('本项目待创建任务');
  await expect(taskDraftBody).toHaveValue('本项目未保存的任务草稿');
  await uiPage.getByRole('option', { name: new RegExp(`^${taskTitle} `) }).click();
  await expect(taskDetail.getByRole('region', { name: '任务正文', exact: true })).toContainText(
    savedTaskNote,
  );
  await uiPage.getByRole('button', { name: `管理项目 ${otherName}`, exact: true }).click();
  await uiPage
    .getByRole('menu', { name: `管理项目 ${otherName}`, exact: true })
    .getByRole('button', { name: '打开项目', exact: true })
    .click();
  await expect(taskDraftTitle).toHaveValue('另一项目待创建任务');
  await expect(taskDraftBody).toHaveValue('另一项目未保存的任务草稿');
  await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).click();
  await expect(panel.getByLabel('项目代码路径', { exact: true })).toHaveValue('other.mjs');
  // Retain registered project artifacts until the shared profile is retired.
});
