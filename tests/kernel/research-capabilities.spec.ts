import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { ProjectBackend } from '../../packages/harness/dist/node.js';
import { protocolVersion, type ResearchRequest } from '../../packages/protocol/dist/index.js';
import type {
  ProjectFilePort,
  ResearchProjectPort,
} from '../../packages/protocol/dist/projects.js';
import {
  type CapabilityExecution,
  ResearchRecords,
  ResearchRuntime,
} from '../../packages/research/dist/node.js';
import { createModelServer } from '../model-server.js';

const request: ResearchRequest = {
  methodId: 'scholoom.material-analysis',
  version: '1.0.0',
  input: { materialPaths: ['input.md'], outputPath: 'analysis.md', goal: '分析结果42的依据与限制' },
};

type TestExecution = CapabilityExecution & {
  read: (path: string, fileId: string) => Promise<void>;
  saved: (path: string, fileId: string) => Promise<void>;
  failed: (issue: string) => Promise<void>;
};

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-research-'));
  const app = new KernelApplication(join(root, 'profile'), { environment: {} });
  await app.initialize();
  await mkdir(join(root, 'project'));
  await writeFile(
    join(root, 'project', 'input.md'),
    '# 合成材料\n\n观察结果为42，只有一个样本。\n',
  );
  const project = await app.projects.open(join(root, 'project'));
  project.grant({ trust: 'trusted', autoBackup: false });
  const session = app.harness.create(project.project.id);
  const controller = new AbortController();
  // 独立模块夹具替换执行调用端口；文件、权限、身份和版本仍由真实项目仓储核对。
  const files: ProjectFilePort & ResearchProjectPort = {
    'project.check': async ({ projectId, access }) => {
      app.projects.get(projectId).check(access);
      return { ok: true };
    },
    'project.path': async ({ projectId, path, allowMissing }) =>
      app.projects.get(projectId).path(path, allowMissing),
    'project.material': async ({ projectId, path }) => app.projects.get(projectId).material(path),
    'files.read': async ({ projectId, path, offset }) =>
      app.projects.get(projectId).read(path, offset),
    'files.list': async ({ projectId, path, offset, limit, version, anchor }) =>
      app.projects.get(projectId).list(path, offset, limit, version, anchor),
    'files.resolve': async ({ projectId, fileIds }) =>
      app.projects.get(projectId).files.resolve(fileIds),
    'project.saveFile': async ({
      projectId,
      path,
      content,
      basis,
      expectedFileId,
      resourceBasis,
    }) =>
      app.projects
        .get(projectId)
        .save(path, content, basis, undefined, expectedFileId, undefined, resourceBasis),
  };
  const context = {
    projectId: project.project.id,
    sessionId: session.id,
    runId: randomUUID(),
    instanceId: randomUUID(),
    signal: controller.signal,
    isStopping: () => false,
    execute: async (execution: TestExecution) => {
      const backend = new ProjectBackend(
        files,
        project.project.id,
        controller.signal,
        (path, fileId) => execution.read(path, fileId),
        async (path, fileId) =>
          execution.saved(path, fileId ?? (await project.files.reference(path)).fileId),
        (error) => execution.failed(error.code),
        execution.expectedOutput,
      );
      await backend.read('/input.md');
      await backend.write('/analysis.md', '# 分析\n\n来源 input.md；结果42；只有一个样本。\n');
    },
  };
  const runtimes = new Set<ResearchRuntime>();
  const research = (perform = context.execute) => {
    let runtime!: ResearchRuntime;
    runtime = new ResearchRuntime(() => {}, {
      records: (projectId) => new ResearchRecords(app.projects.get(projectId).internal),
      files: () => files,
      session: async ({ projectId, sessionId }) => app.harness.getSession(projectId, sessionId),
      execute: async (execution, callContext) => {
        await perform({
          ...execution,
          read: async (path, fileId) => {
            await runtime.progress(
              { attemptId: execution.attemptId, event: { kind: 'read', file: { path, fileId } } },
              callContext,
            );
          },
          saved: async (path, fileId) => {
            await runtime.progress(
              { attemptId: execution.attemptId, event: { kind: 'saved', file: { path, fileId } } },
              callContext,
            );
          },
          failed: async (issue) => {
            await runtime.progress(
              { attemptId: execution.attemptId, event: { kind: 'failed', issue } },
              callContext,
            );
          },
        });
      },
    });
    runtimes.add(runtime);
    return runtime;
  };
  return {
    root,
    app,
    project,
    session,
    context,
    controller,
    files,
    research,
    close: async () => {
      for (const runtime of runtimes) runtime.close();
      await app.close();
      await rm(root, { recursive: true });
    },
  };
}

test('method discovery and loading are read-only; capability delivery checks actual files', async () => {
  const f = await setup();
  try {
    const methods = await f.app.research.content.discover();
    expect(methods).toContainEqual(
      expect.objectContaining({ id: request.methodId, scope: 'builtin', version: request.version }),
    );
    expect(
      (await f.app.research.content.resolve(request.methodId, request.version)).content,
    ).toContain('来源');
    expect(
      (await f.app.research.list({ projectId: f.project.project.id, sessionId: f.session.id }))
        .attempts,
    ).toEqual([]);
    const attempt = await f.research().invoke(request, f.context);
    expect(attempt).toMatchObject({
      state: 'completed',
      delivery: 'usable',
      researchAssessment: 'notAssessed',
      attempt: 1,
    });
    expect(attempt.used[0]?.fileId).toBe(attempt.sources[0]?.fileId);
    expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toContain('42');
    const backup = await f.project.backup();
    const restored = await f.app.call('project.restore', {
      projectId: f.project.project.id,
      backupId: backup.id,
      destination: join(f.root, 'restored'),
    });
    const copy = f.app.projects.get(restored.id);
    expect(
      (await f.app.research.list({ projectId: copy.project.id, sessionId: f.session.id }))
        .attempts[0],
    ).toEqual(attempt);
  } finally {
    await f.close();
  }
});

test('input and permissions are checked before executing; old output does not prove delivery', async () => {
  const f = await setup();
  try {
    let executed = 0;
    const research = f.research(async () => {
      executed++;
    });
    f.project.grant({ trust: 'restricted', autoBackup: false });
    await expect(research.invoke(request, f.context)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    f.project.grant({ trust: 'trusted', autoBackup: false });
    await expect(
      research.invoke({ ...request, version: 'missing' }, f.context),
    ).rejects.toMatchObject({ code: 'notFound' });
    await expect(
      research.invoke(
        { ...request, input: { ...request.input, materialPaths: ['../outside.md'] } },
        f.context,
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      research.invoke(
        { ...request, input: { ...request.input, outputPath: 'input.md' } },
        f.context,
      ),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(executed).toBe(0);
    await writeFile(join(f.root, 'project', 'analysis.md'), '已有报告不能冒充本次产物');
    const result = await research.invoke(request, f.context);
    expect(result).toMatchObject({ state: 'completed', delivery: 'incomplete', artifacts: [] });
    expect(result.issues.some((item) => item.startsWith('reportMissing:'))).toBe(true);
    expect(result.issues.some((item) => item.startsWith('inputNotRead:'))).toBe(true);
    expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toContain('已有报告');
  } finally {
    await f.close();
  }
});

test('retry keeps invocation identity, rejects changed targets and concurrent execution, and pages attempts', async () => {
  const f = await setup();
  try {
    let execute: (execution: TestExecution) => Promise<void> = async () => {};
    const research = f.research((execution) => execute(execution));
    const first = await research.invoke(request, f.context);
    const retry = { ...request, invocationId: first.invocationId };
    execute = f.context.execute;
    const second = await research.invoke(retry, f.context);
    expect(second.invocationId).toBe(first.invocationId);
    expect(second.attempt).toBe(2);
    expect(second.id).not.toBe(first.id);
    expect(second.delivery).toBe('usable');
    await expect(
      research.invoke({ ...retry, input: { ...retry.input, goal: '另一个目标' } }, f.context),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    execute = () => gate;
    const pending = research.invoke(retry, f.context);
    await expect
      .poll(async () =>
        (
          await f.app.research.list({
            projectId: f.project.project.id,
            sessionId: f.session.id,
          })
        ).attempts.some((item) => item.state === 'running'),
      )
      .toBe(true);
    await expect(research.invoke(retry, f.context)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    release();
    await pending;
    const page = await f.app.research.list({
      projectId: f.project.project.id,
      sessionId: f.session.id,
      limit: 1,
    });
    expect(page.attempts).toHaveLength(1);
    expect(page.nextOffset).toBe(1);
    expect(
      (
        await f.app.research.list({
          projectId: f.project.project.id,
          sessionId: f.session.id,
          limit: 1,
          offset: 1,
        })
      ).attempts[0]?.id,
    ).not.toBe(page.attempts[0]?.id);
  } finally {
    await f.close();
  }
});

test('delivery and retry follow the saved report identity after its original path is reused', async () => {
  const f = await setup();
  try {
    const research = f.research(async (execution) => {
      await f.context.execute(execution);
      await f.project.files.mutate('rename', randomUUID(), {
        path: 'analysis.md',
        name: 'moved.md',
      });
      await f.project.save('analysis.md', '后来创建的独立文件');
    });
    const first = await research.invoke(request, f.context);
    expect(first.delivery).toBe('usable');
    const retryResearch = f.research(async (execution) => {
      const file = await f.project.read('input.md');
      await execution.read(
        file.path,
        file.fileId ?? (await f.project.files.reference(file.path)).fileId,
      );
      const report = await f.project.read('moved.md');
      const edit = await f.project.save('moved.md', `${report.content}\n补充限制。`, report.basis);
      await execution.saved(
        edit.path,
        edit.fileId ?? (await f.project.files.reference(edit.path)).fileId,
      );
    });
    const retry = await retryResearch.invoke(
      { ...request, invocationId: first.invocationId },
      f.context,
    );
    expect(retry.delivery).toBe('usable');
    expect(retry.reportFileId).toBe(first.reportFileId);
    expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toBe(
      '后来创建的独立文件',
    );
    expect(await readFile(join(f.root, 'project', 'moved.md'), 'utf8')).toContain('补充限制');
  } finally {
    await f.close();
  }
});

test('a concurrent path replacement cannot redirect a retry into another report', async () => {
  const f = await setup();
  try {
    const first = await f.research().invoke(request, f.context);
    const second = await f
      .research(async (execution) => {
        await f.project.files.mutate('rename', randomUUID(), {
          path: 'analysis.md',
          name: 'kept.md',
        });
        await f.project.save('analysis.md', '另一份报告');
        const backend = new ProjectBackend(
          f.files,
          f.project.project.id,
          f.controller.signal,
          execution.read,
          async (path, fileId) =>
            execution.saved(path, fileId ?? (await f.project.files.reference(path)).fileId),
          (error) => execution.failed(error.code),
          execution.expectedOutput,
        );
        await backend.read('/input.md');
        await backend.read('/analysis.md');
        expect((await backend.edit('/analysis.md', '另一份报告', '错误修改')).error).toContain(
          'contentChanged',
        );
      })
      .invoke({ ...request, invocationId: first.invocationId }, f.context);
    expect(second.delivery).toBe('incomplete');
    expect(second.reportFileId).toBe(first.reportFileId);
    expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toBe('另一份报告');
    expect(await readFile(join(f.root, 'project', 'kept.md'), 'utf8')).toContain('42');
  } finally {
    await f.close();
  }
});

test('an empty out-of-range page does not count as reading the input', async () => {
  const f = await setup();
  try {
    const attempt = await f
      .research(async (execution) => {
        const backend = new ProjectBackend(
          f.files,
          f.project.project.id,
          f.controller.signal,
          execution.read,
          async (path, fileId) =>
            execution.saved(path, fileId ?? (await f.project.files.reference(path)).fileId),
        );
        expect((await backend.read('/input.md', 10000)).error).toBeTruthy();
        await backend.write('/analysis.md', '未取得输入正文的报告');
      })
      .invoke(request, f.context);
    expect(attempt.used).toEqual([]);
    expect(attempt.delivery).toBe('incomplete');
    expect(attempt.issues.some((item) => item.startsWith('inputNotRead:'))).toBe(true);
  } finally {
    await f.close();
  }
});

test('identity is rechecked when another writer reuses a path during delivery or retry', async () => {
  const f = await setup();
  try {
    const research = f.research();
    const original = f.project.read.bind(f.project);
    const attempt = await f
      .research(async (execution) => {
        await f.context.execute(execution);
        f.project.read = async (...args) => {
          f.project.read = original;
          await f.project.files.mutate('rename', randomUUID(), {
            path: 'analysis.md',
            name: 'actual.md',
          });
          await f.project.save('analysis.md', '替代文件不能作为原产物');
          return original(...args);
        };
      })
      .invoke(request, f.context);
    expect(attempt.delivery).toBe('incomplete');
    expect(attempt.issues.some((item) => item.includes('contentChanged'))).toBe(true);
    f.project.read = async (...args) => {
      f.project.read = original;
      await f.project.files.mutate('rename', randomUUID(), {
        path: 'input.md',
        name: 'original.md',
      });
      await f.project.save('input.md', '替代材料');
      return original(...args);
    };
    await expect(
      research.invoke({ ...request, invocationId: attempt.invocationId }, f.context),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await readFile(join(f.root, 'project', 'actual.md'), 'utf8')).toContain('42');
    expect(await readFile(join(f.root, 'project', 'original.md'), 'utf8')).toContain('42');
  } finally {
    await f.close();
  }
});

test('cancellation waits for a capability file save before publishing terminal states', async () => {
  const f = await setup();
  const model = await createModelServer();
  await f.app.close();
  const app = new KernelApplication(join(f.root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let release = () => {};
  try {
    await app.initialize();
    const project = app.projects.get(f.project.project.id);
    const original = project.save.bind(project);
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    project.save = async (...args) => {
      await held;
      return original(...args);
    };
    const scope = { projectId: project.project.id, sessionId: f.session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot(scope)).messages.some(
            (item) => item.tool?.name === 'write_file' && item.state === 'streaming',
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    app.harness.cancel(scope.projectId, scope.sessionId);
    await delay(100);
    expect((await app.snapshot(scope)).run?.state).toBe('cancelling');
    expect(
      (await app.research.list({ projectId: project.project.id, sessionId: scope.sessionId }))
        .attempts[0]?.state,
    ).toBe('running');
    release();
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    const attempt = (
      await app.research.list({ projectId: project.project.id, sessionId: scope.sessionId })
    ).attempts[0];
    expect(attempt?.state).toBe('cancelled');
    expect(attempt?.artifacts).toHaveLength(1);
    expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toContain('42');
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(f.root, { recursive: true });
  }
});

test('cancellation and restart retain partial artifacts without automatic work', async () => {
  const f = await setup();
  const research = f.research(async (execution) => {
    await f.context.execute(execution);
    f.controller.abort();
    f.controller.signal.throwIfAborted();
  });
  try {
    const attempt = await research.invoke(request, f.context);
    expect(attempt).toMatchObject({ state: 'cancelled', delivery: 'incomplete' });
    expect(attempt.artifacts).toHaveLength(1);
    research.close();
    await f.app.close();
    const next = new KernelApplication(join(f.root, 'profile'), { environment: {} });
    try {
      await next.initialize();
      expect(
        (
          await next.research.list({
            projectId: f.project.project.id,
            sessionId: f.session.id,
          })
        ).attempts[0],
      ).toEqual(attempt);
      expect(await readFile(join(f.root, 'project', 'analysis.md'), 'utf8')).toContain('42');
    } finally {
      await next.close();
    }
  } finally {
    research.close();
    await rm(f.root, { recursive: true });
  }
});

test('process interruption leaves queryable attempts and files without restarting execution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-research-crash-'));
  await mkdir(join(root, 'project'));
  await writeFile(join(root, 'project', 'input.md'), '结果42，样本数1。');
  const applicationModule = new URL('../../apps/kernel/dist/application.js', import.meta.url).href;
  const researchModule = new URL('../../packages/research/dist/node.js', import.meta.url).href;
  const source = `import {KernelApplication} from ${JSON.stringify(applicationModule)};
    import {ResearchRecords, ResearchRuntime} from ${JSON.stringify(researchModule)};
    const app = new KernelApplication(process.argv[1], {environment:{}});
    await app.initialize();
    const project = await app.projects.open(process.argv[2]);
    project.grant({trust: 'trusted',autoBackup:false});
    const session = app.harness.create(project.project.id);
    const runtime = new ResearchRuntime(()=>{}, {
      records:projectId=>new ResearchRecords(app.projects.get(projectId).internal),
      files:context=>app.researchFiles(context),
      session:input=>app.harness.getSession(input.projectId,input.sessionId),
      execute:async (execution,context)=>{
        const file=await project.read('input.md');
        await runtime.progress({attemptId:execution.attemptId,event:{kind:'read',file:{path:file.path,fileId:file.fileId??(await project.files.reference(file.path)).fileId}}},context);
        const edit=await project.save('analysis.md','保存于中断前，结果42。');
        await runtime.progress({attemptId:execution.attemptId,event:{kind:'saved',file:{path:edit.path,fileId:edit.fileId??(await project.files.reference(edit.path)).fileId}}},context);
        process.send({projectId:project.project.id,sessionId:session.id});
        await new Promise(()=>setInterval(()=>{},1000));
      }
    });
    await runtime.invoke(JSON.parse(process.argv[3]), {
      projectId:project.project.id,sessionId:session.id,runId:'crash-test',instanceId:'crash-test',signal:new AbortController().signal,isStopping:()=>false
    });`;
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      source,
      join(root, 'profile'),
      join(root, 'project'),
      JSON.stringify(request),
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  try {
    const [scope] = await once(child, 'message');
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    const app = new KernelApplication(join(root, 'profile'), { environment: {} });
    try {
      await app.initialize();
      const attempts = (
        await app.research.list({ projectId: scope.projectId, sessionId: scope.sessionId })
      ).attempts;
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ state: 'interrupted', delivery: 'incomplete' });
      expect(attempts[0]?.artifacts).toHaveLength(1);
      expect(await readFile(join(root, 'project', 'analysis.md'), 'utf8')).toContain('42');
    } finally {
      await app.close();
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    await rm(root, { recursive: true });
  }
});

test('real model graph invokes the common capability and shared client observes persisted delivery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-research-graph-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: join(root, 'profile'),
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), '合成实验：结果42，样本数1。');
    await client.connect();
    expect(await client.call('research.methods', {})).toHaveLength(1);
    expect(
      (
        await client.call('research.method', {
          methodId: request.methodId,
          version: request.version,
        })
      ).content,
    ).toContain('材料分析');
    expect(model.requests).toHaveLength(0);
    const project = await client.call('project.open', { path: join(root, 'project') });
    await client.call('project.grant', {
      projectId: project.id,
      trust: 'trusted',

      autoBackup: false,
    });
    const session = await client.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await client.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH 按材料分析方法处理 input.md 并保存报告',
      materials: ['input.md'],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state, {
        timeout: 30000,
      })
      .toBe('completed');
    const attempts = await client.call('research.attempts', scope);
    expect(attempts.attempts).toHaveLength(1);
    expect(attempts.attempts[0]).toMatchObject({
      state: 'completed',
      delivery: 'usable',
      researchAssessment: 'notAssessed',
    });
    expect(await readFile(join(root, 'project', 'analysis.md'), 'utf8')).toContain('42');
    const snapshot = await client.call('workbench.snapshot', scope);
    expect(snapshot.artifacts).toContainEqual(
      expect.objectContaining({ path: 'analysis.md', state: 'linked' }),
    );
    expect(
      snapshot.messages.find((item) => item.tool?.name === 'invoke_research_capability')?.state,
    ).toBe('complete');
    expect(snapshot.messages.find((item) => item.tool?.name === 'read_file')?.state).toBe(
      'complete',
    );
    expect(model.requests.length).toBeGreaterThanOrEqual(7);
    const capabilityTool = snapshot.messages.find(
      (item) => item.tool?.name === 'invoke_research_capability',
    );
    const readTool = snapshot.messages.find((item) => item.tool?.name === 'read_file');
    expect(capabilityTool?.id).not.toBe(readTool?.id);
  } finally {
    client.dispose();
    await server.stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});
