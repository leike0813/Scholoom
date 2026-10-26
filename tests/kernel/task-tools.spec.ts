import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { createTaskTools } from '../../packages/harness/src/task-tools.js';
import {
  compileContract,
  type ErrorInfo,
  OperationError,
} from '../../packages/protocol/dist/core.js';
import {
  type ProjectTaskOutputs,
  type TaskPort,
  taskOperations,
} from '../../packages/protocol/dist/projects.js';
import {
  type ExecutionResourcePort,
  resourceCreationOperations,
} from '../../packages/protocol/dist/resources.js';

const projectId = 'project-1';
const task = { projectId, taskId: 'task-1', fileId: 'file-1' };
const entry: ProjectTaskOutputs['tasks.read'] = {
  task,
  entry: { ref: { source: 'project', projectId, fileId: task.fileId }, basis: 'basis-1' },
  path: 'tasks/task-1.task.md',
  metadata: {
    kind: 'research-task',
    formatVersion: 1,
    id: task.taskId,
    title: 'Fixture task',
    status: 'active',
  },
  content: '# Research goal',
};

function fixture(scope = projectId) {
  const calls: { method: keyof TaskPort | 'creation'; input: unknown }[] = [];
  const errors: ErrorInfo[] = [];
  const port = {
    list: async (input) => {
      calls.push({ method: 'list', input });
      return { tasks: [], issues: [], offset: input.offset ?? 0 };
    },
    read: async (input) => {
      calls.push({ method: 'read', input });
      return entry;
    },
    create: async (input) => {
      calls.push({ method: 'create', input });
      return { operationId: input.operationId, state: 'unknown' };
    },
    save: async (input) => {
      calls.push({ method: 'save', input });
      return { ...entry, content: input.content };
    },
  } satisfies TaskPort;
  const resources: Pick<ExecutionResourcePort, 'creation'> = {
    creation: async (input) => {
      calls.push({ method: 'creation', input });
      return { operationId: input.operationId, state: 'prepared' };
    },
  };
  const access = { allowed: true };
  const tools = createTaskTools({
    port,
    resources,
    projectId: scope,
    check: () => {
      if (!access.allowed) throw new OperationError('permissionDenied', 'revoked');
    },
    onError: (error) => errors.push(error),
  });
  return { tools, port, resources, calls, errors, access };
}

type Tool = ReturnType<typeof createTaskTools>[number];

function findTool<Name extends Tool['name']>(tools: Tool[], name: Name) {
  const found = tools.find((tool): tool is Extract<Tool, { name: Name }> => tool.name === name);
  assert(found);
  return found;
}

test('task tools accept published schemas with optional list parameters omitted', async () => {
  const { tools, calls } = fixture();
  const list = findTool(tools, 'list_research_tasks');
  const read = findTool(tools, 'read_research_task');
  const create = findTool(tools, 'create_research_task');
  const save = findTool(tools, 'save_research_task');
  const creation = findTool(tools, 'read_task_creation');
  const cases = [
    [list, taskOperations['tasks.list'], { projectId }],
    [read, taskOperations['tasks.read'], { task }],
    [
      create,
      taskOperations['tasks.create'],
      { projectId, operationId: 'op-1', path: entry.path, content: entry.content },
    ],
    [save, taskOperations['tasks.save'], { task, basis: 'basis-1', content: 'Updated goal' }],
    [
      creation,
      resourceCreationOperations['resources.creation'],
      { projectId, operationId: 'op-1' },
    ],
  ] as const;
  for (const [tool, contract, input] of cases) {
    expect(compileContract({ params: tool.schema, result: true }).params(input)).toBe(true);
    expect(tool.schema).toEqual(contract.params);
  }
  expect(JSON.parse(await list.func({ projectId }))).toEqual({ tasks: [], issues: [], offset: 0 });
  expect(JSON.parse(await read.func({ task }))).toEqual(entry);
  expect(
    JSON.parse(
      await create.func({
        projectId,
        operationId: 'op-1',
        path: entry.path,
        content: entry.content,
      }),
    ),
  ).toEqual({ operationId: 'op-1', state: 'unknown' });
  expect(JSON.parse(await save.func({ task, basis: 'basis-1', content: 'Updated goal' }))).toEqual({
    ...entry,
    content: 'Updated goal',
  });
  expect(JSON.parse(await creation.func({ projectId, operationId: 'op-1' }))).toEqual({
    operationId: 'op-1',
    state: 'prepared',
  });
  expect(calls).toEqual([
    { method: 'list', input: { projectId } },
    { method: 'read', input: { task } },
    {
      method: 'create',
      input: { projectId, operationId: 'op-1', path: entry.path, content: entry.content },
    },
    { method: 'save', input: { task, basis: 'basis-1', content: 'Updated goal' } },
    { method: 'creation', input: { projectId, operationId: 'op-1' } },
  ]);
});

for (const scope of [projectId, 'application']) {
  test(`task tools reject unauthorized project scope from ${scope}`, async () => {
    const { tools, calls, errors } = fixture(scope);
    const foreign = scope === 'application' ? scope : 'other-project';
    const results = await Promise.all([
      findTool(tools, 'list_research_tasks').func({ projectId: foreign }),
      findTool(tools, 'read_research_task').func({ task: { ...task, projectId: foreign } }),
      findTool(tools, 'create_research_task').func({
        projectId: foreign,
        operationId: 'op-1',
        path: entry.path,
        content: entry.content,
      }),
      findTool(tools, 'save_research_task').func({
        task: { ...task, projectId: foreign },
        basis: 'basis-1',
        content: 'Forbidden',
      }),
      findTool(tools, 'read_task_creation').func({ projectId: foreign, operationId: 'op-1' }),
    ]);
    for (const result of results)
      expect(JSON.parse(result)).toMatchObject({ error: { code: 'permissionDenied' } });
    expect(calls).toEqual([]);
    expect(errors.map((error) => error.code)).toEqual(results.map(() => 'permissionDenied'));
  });
}

test('task tools recheck authorization before delivering an asynchronous result', async () => {
  const { tools, port, access, errors, calls } = fixture();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  port.read = async (input) => {
    calls.push({ method: 'read', input });
    await pending;
    return entry;
  };
  const read = findTool(tools, 'read_research_task');
  const result = read.func({ task });
  access.allowed = false;
  release();
  expect(JSON.parse(await result)).toMatchObject({ error: { code: 'permissionDenied' } });
  expect(errors).toMatchObject([{ code: 'permissionDenied' }]);
  expect(JSON.parse(await read.func({ task }))).toMatchObject({
    error: { code: 'permissionDenied' },
  });
  expect(calls).toEqual([{ method: 'read', input: { task } }]);
});

test('task creation lookup uses the original operation without creating again', async () => {
  const { tools, calls, resources, errors } = fixture();
  const original = 'original-operation';
  expect(
    JSON.parse(
      await findTool(tools, 'create_research_task').func({
        projectId,
        operationId: original,
        path: entry.path,
        content: entry.content,
      }),
    ),
  ).toMatchObject({ operationId: original, state: 'unknown' });
  const info: ErrorInfo = { code: 'unavailable', message: 'receipt unavailable' };
  resources.creation = async (input) => {
    calls.push({ method: 'creation', input });
    throw new OperationError(info.code, info.message);
  };
  expect(
    JSON.parse(
      await findTool(tools, 'read_task_creation').func({ projectId, operationId: original }),
    ),
  ).toEqual({ error: info });
  expect(calls).toEqual([
    {
      method: 'create',
      input: { projectId, operationId: original, path: entry.path, content: entry.content },
    },
    { method: 'creation', input: { projectId, operationId: original } },
  ]);
  expect(errors).toEqual([info]);
});
