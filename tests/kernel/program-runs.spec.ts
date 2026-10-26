import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ProgramRecords } from '../../packages/programs/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import { createModelServer } from '../model-server.js';
import { executable, localWheelProject } from '../program-environment-fixture.js';

async function fixture(source: string) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-program-case-'));
  const app = new KernelApplication(join(root, 'profile'));
  await app.initialize();
  const project = await app.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  await writeFile(join(project.path, 'program.mjs'), source);
  const descriptor = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'program.mjs' },
  });
  const input = {
    projectId: project.id,
    operationId: randomUUID(),
    environmentId: 'node',
    entry: { ref: descriptor.ref, basis: descriptor.basis },
  };
  return {
    root,
    app,
    project,
    input,
    async close() {
      await app.close();
      await rm(root, { recursive: true });
    },
  };
}

test('manual program runs persist one operation and expose actual CSV without a session or model', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-program-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await writeFile(join(project.path, 'input.json'), '[2,4,6]');
    await writeFile(
      join(project.path, 'compute.mjs'),
      `import {readFile,writeFile} from 'node:fs/promises'; const values=JSON.parse(await readFile('input.json','utf8')); const sum=values.reduce((a,b)=>a+b,0); console.log('calculating'); await writeFile('result.csv','count,sum,mean\\n'+values.length+','+sum+','+sum/values.length+'\\n');`,
    );
    const entry = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'compute.mjs' },
    });
    const input = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.json' },
    });
    const request = {
      projectId: project.id,
      operationId: randomUUID(),
      environmentId: 'node',
      entry: { ref: entry.ref, basis: entry.basis },
      inputs: [{ ref: input.ref, basis: input.basis }],
      outputs: ['result.csv'],
    };
    const accepted = await app.call('programs.start', request);
    expect((await app.call('programs.start', request)).programRunId).toBe(accepted.programRunId);
    await expect
      .poll(
        async () =>
          (
            await app.call('programs.run', {
              projectId: project.id,
              programRunId: accepted.programRunId,
            })
          ).state,
        { timeout: 20_000 },
      )
      .toBe('completed');
    const run = await app.call('programs.run', {
      projectId: project.id,
      operationId: request.operationId,
    });
    expect(run.stop).toBe('confirmed');
    expect(run.outputs?.[0]).toMatchObject({ presence: 'present', completeness: 'unassessed' });
    expect(await readFile(join(project.path, 'result.csv'), 'utf8')).toBe(
      'count,sum,mean\n3,12,4\n',
    );
    expect(
      (
        await app.call('programs.logs', { projectId: project.id, programRunId: run.programRunId })
      ).entries
        .map((line) => line.text)
        .join(''),
    ).toContain('calculating');
    await expect(
      app.call('programs.start', { ...request, args: ['changed'] }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

for (const kind of ['partial', 'overflow', 'timeout'] as const) {
  test(`program ${kind} keeps actual exit, bounded logs and output facts`, async () => {
    const source = {
      partial: `import {writeFileSync} from 'node:fs'; writeFileSync('partial.csv','value\\n2\\n'); process.exitCode=2;`,
      overflow: `process.stdout.write('中'.repeat(900000)); process.stderr.write('tail');`,
      timeout: `setInterval(()=>{},1000);`,
    }[kind];
    const f = await fixture(source);
    try {
      const accepted = await f.app.call('programs.start', {
        ...f.input,
        outputs: kind === 'partial' ? ['partial.csv', 'missing.csv'] : [],
        timeoutMs: kind === 'timeout' ? 100 : null,
      });
      const identity = { projectId: f.project.id, programRunId: accepted.programRunId };
      await expect
        .poll(async () => (await f.app.call('programs.run', identity)).state, { timeout: 20_000 })
        .toBe(kind === 'overflow' ? 'completed' : 'failed');
      const run = await f.app.call('programs.run', identity);
      expect(run.stop).toBe('confirmed');
      if (kind === 'partial') {
        expect(run.exit?.code).toBe(2);
        expect(run.outputs?.map((output) => [output.presence, output.completeness])).toEqual([
          ['present', 'incomplete'],
          ['missing', 'unassessed'],
        ]);
      } else if (kind === 'timeout') expect(run.exit?.reason).toBe('timeout');
      else {
        const logs = await f.app.call('programs.logs', identity);
        expect(logs.truncatedBefore).toBeGreaterThan(0);
        expect(
          Buffer.byteLength(logs.entries.map((entry) => entry.text).join('')),
        ).toBeLessThanOrEqual(65536);
        expect(logs.entries.every((entry) => !entry.text.includes('\uFFFD'))).toBe(true);
      }
    } finally {
      await f.close();
    }
  });
}

test('an unavailable environment remains a queryable failed run without running the program', async () => {
  const f = await fixture('throw new Error("must not run");');
  try {
    await expect(
      f.app.call('programs.start', { ...f.input, environmentId: 'missing' }),
    ).rejects.toMatchObject({ code: 'notFound' });
    const run = await f.app.call('programs.run', {
      projectId: f.project.id,
      operationId: f.input.operationId,
    });
    expect(run).toMatchObject({ state: 'failed', stop: 'confirmed', error: { code: 'notFound' } });
    expect(run.command).toBeUndefined();
  } finally {
    await f.close();
  }
});

test('a silent program remains queryable and cancellation stops detached descendants', async () => {
  const source = `import {spawn} from 'node:child_process'; spawn(process.execPath,['-e',"setInterval(()=>require('node:fs').appendFileSync('heartbeat','x'),25)"],{detached:true,stdio:'ignore'}).unref(); setInterval(()=>{},1000);`;
  const f = await fixture(source);
  try {
    const accepted = await f.app.call('programs.start', f.input);
    const identity = { projectId: f.project.id, programRunId: accepted.programRunId };
    await expect
      .poll(
        async () =>
          (await readFile(join(f.project.path, 'heartbeat'), 'utf8').catch(() => '')).length,
        { timeout: 20_000 },
      )
      .toBeGreaterThan(2);
    expect((await f.app.call('programs.run', identity)).state).toBe('running');
    expect((await f.app.call('programs.logs', identity)).entries).toEqual([]);
    await expect(f.app.call('project.forget', { projectId: f.project.id })).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    await f.app.call('programs.cancel', identity);
    await expect
      .poll(async () => (await f.app.call('programs.run', identity)).state, { timeout: 20_000 })
      .toBe('cancelled');
    const stopped = await readFile(join(f.project.path, 'heartbeat'), 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await readFile(join(f.project.path, 'heartbeat'), 'utf8')).toBe(stopped);
  } finally {
    await f.close();
  }
});

test('repeated output inspection preserves the original basis after external replacement', async () => {
  const f = await fixture(
    `import {writeFileSync} from 'node:fs'; writeFileSync('result.csv','value\\n12\\n');`,
  );
  try {
    const accepted = await f.app.call('programs.start', { ...f.input, outputs: ['result.csv'] });
    const identity = { projectId: f.project.id, programRunId: accepted.programRunId };
    await expect
      .poll(async () => (await f.app.call('programs.run', identity)).state, { timeout: 20_000 })
      .toBe('completed');
    const original = (await f.app.call('programs.run', identity)).outputs?.[0]?.resource;
    expect(original).toBeTruthy();
    await writeFile(join(f.project.path, 'result.csv'), 'unrelated replacement\n');
    for (let count = 0; count < 2; count++) {
      await f.app.call('programs.reconcile', identity);
      const inspected = await f.app.call('programs.run', identity);
      expect(inspected.outputs?.[0]).toMatchObject({ resource: original, presence: 'changed' });
      expect(inspected.outputAssessment).toBe('partial');
    }
  } finally {
    await f.close();
  }
});

test('moving a queued entry cannot make it execute the replacement at its original path', async () => {
  class Application extends KernelApplication {
    occupy() {
      const leases: { release(): void }[] = [];
      while (this.processes.status.active < this.processes.status.limit)
        leases.push(this.processes.reserve());
      return () => {
        for (const lease of leases) lease.release();
      };
    }
  }
  const root = await mkdtemp(join(tmpdir(), 'scholoom-program-entry-'));
  const app = new Application(join(root, 'profile'));
  let release = () => {};
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.mkdir', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'code',
    });
    await writeFile(join(project.path, 'code/program.mjs'), 'console.log("original");');
    const entry = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'code/program.mjs' },
    });
    release = app.occupy();
    const accepted = await app.call('programs.start', {
      projectId: project.id,
      operationId: randomUUID(),
      environmentId: 'node',
      entry: { ref: entry.ref, basis: entry.basis },
    });
    await app.call('files.rename', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'code',
      name: 'moved',
    });
    await app.call('files.mkdir', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'code',
    });
    await writeFile(
      join(project.path, 'code/program.mjs'),
      `import {writeFileSync} from 'node:fs';writeFileSync('wrong-program-ran','yes');`,
    );
    release();
    const identity = { projectId: project.id, programRunId: accepted.programRunId };
    await expect
      .poll(async () => (await app.call('programs.run', identity)).state, { timeout: 20_000 })
      .toBe('failed');
    expect((await app.call('programs.run', identity)).error?.code).toBe('contentChanged');
    expect(
      await access(join(project.path, 'wrong-program-ran')).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    release();
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('host loss retains unknown ownership and independent backup restore never controls the original run', async () => {
  const f = await fixture(`setInterval(()=>{},1000);`);
  const profile = join(f.root, 'profile');
  await f.app.close();
  const child = fork(
    new URL('../fixtures/domain-execution-worker/program-host.mjs', import.meta.url),
    [],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], execArgv: [] },
  );
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const accepted = once(child, 'message');
  child.send({ profile, projectPath: f.project.path });
  const [message] = await accepted;
  const identity = message as { projectId: string; programRunId: string };
  expect(identity.programRunId, stderr).toBeTruthy();
  const exit = once(child, 'exit');
  child.kill('SIGKILL');
  await exit;
  const app = new KernelApplication(profile);
  try {
    await app.initialize();
    expect(await app.call('programs.run', identity)).toMatchObject({
      state: 'unknown',
      stop: 'unknown',
    });
    await expect(
      app.call('programs.start', { ...f.input, operationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    const backup = await app.call('project.backup', { projectId: identity.projectId });
    const restored = await app.call('project.restore', {
      projectId: identity.projectId,
      backupId: backup.id,
      destination: join(f.root, 'restored'),
    });
    expect(
      await app.call('programs.run', {
        projectId: restored.id,
        programRunId: identity.programRunId,
      }),
    ).toMatchObject({ state: 'interrupted', stop: 'unknown' });
    expect((await app.call('programs.run', identity)).state).toBe('unknown');
  } finally {
    await app.close();
    await rm(f.root, { recursive: true });
  }
});

test('Agent tools and the manual API query the same real program run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-program-agent-'));
  let request: Parameters<KernelApplication['programs']['start']>[0] | undefined;
  let readyToFinish = false;
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!request) return { text: '等待程序配置。' };
      if (!calls.includes('start_project_program'))
        return { tool: { name: 'start_project_program', input: request } };
      if (!readyToFinish)
        return {
          tool: {
            name: 'read_program_run',
            input: { projectId: request.projectId, operationId: request.operationId },
          },
        };
      return { text: '程序已完成并保留实际结果。' };
    },
  });
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await writeFile(
      join(project.path, 'program.mjs'),
      `import {writeFileSync} from 'node:fs'; writeFileSync('agent.csv','value\\n12\\n');`,
    );
    const entry = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'program.mjs' },
    });
    request = {
      projectId: project.id,
      operationId: randomUUID(),
      environmentId: 'node',
      entry: { ref: entry.ref, basis: entry.basis },
      outputs: ['agent.csv'],
    };
    const session = await app.call('session.create', { projectId: project.id });
    await app.call('session.send', {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: '运行程序并保存结果。',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.call('programs.runs', { projectId: project.id })).runs.some(
            (run) => run.operationId === request?.operationId,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    const run = (await app.call('programs.runs', { projectId: project.id })).runs.find(
      (item) => item.operationId === request?.operationId,
    );
    assert(run);
    expect(run?.origin?.sessionId).toBe(session.id);
    await expect
      .poll(
        async () =>
          (
            await app.call('programs.run', {
              projectId: project.id,
              programRunId: run.programRunId,
            })
          ).state,
        { timeout: 20_000 },
      )
      .toBe('completed');
    readyToFinish = true;
    expect(await readFile(join(project.path, 'agent.csv'), 'utf8')).toBe('value\n12\n');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a restored program history keeps its small output and lists an omitted large output', async () => {
  const f = await fixture(
    `import {writeFileSync} from 'node:fs';writeFileSync('result.csv','value\\n42\\n');writeFileSync('large.csv','x'.repeat(300000));`,
  );
  try {
    const accepted = await f.app.call('programs.start', {
      ...f.input,
      outputs: ['result.csv', 'large.csv'],
    });
    const identity = { projectId: f.project.id, programRunId: accepted.programRunId };
    await expect
      .poll(async () => (await f.app.call('programs.run', identity)).state)
      .toBe('completed');
    const backup = await f.app.call('project.backup', { projectId: f.project.id });
    expect(backup.omitted).toContain('large.csv');
    const copy = await f.app.call('project.restore', {
      projectId: f.project.id,
      backupId: backup.id,
      destination: join(f.root, 'restored'),
    });
    expect(await readFile(join(copy.path, 'result.csv'), 'utf8')).toBe('value\n42\n');
    await expect(access(join(copy.path, 'large.csv'))).rejects.toMatchObject({ code: 'ENOENT' });
    const restored = { projectId: copy.id, programRunId: accepted.programRunId };
    await f.app.call('programs.reconcile', restored);
    expect(
      (await f.app.call('programs.run', restored)).outputs?.find(
        (output) => output.declaredPath === 'large.csv',
      )?.presence,
    ).toBe('missing');
    expect(
      (await f.app.call('programs.run', identity)).outputs?.find(
        (output) => output.declaredPath === 'large.csv',
      )?.presence,
    ).toBe('present');
    expect((await readFile(join(f.project.path, 'large.csv'))).length).toBe(300000);
  } finally {
    await f.close();
  }
});

for (const mode of ['owned', 'handoff', 'storage-failure', 'race'] as const) {
  test(`Agent parent cancellation and handoff (${mode}) retain authorized ownership`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-program-parent-'));
    let request: Parameters<KernelApplication['programs']['start']>[0] | undefined;
    const model = await createModelServer({
      respond: () => {
        assert(request);
        model.hold = true;
        return { tool: { name: 'start_project_program', input: request } };
      },
    });
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const put = ProgramRecords.prototype.put;
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      await writeFile(
        join(project.path, 'program.mjs'),
        `import {appendFileSync} from 'node:fs';setInterval(()=>appendFileSync('heartbeat','x'),50);`,
      );
      const entry = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: 'program.mjs' },
      });
      request = {
        projectId: project.id,
        operationId: randomUUID(),
        environmentId: 'node',
        entry: { ref: entry.ref, basis: entry.basis },
      };
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: '启动程序后等待。',
        materials: [],
      });
      await expect
        .poll(
          async () =>
            (await app.call('programs.runs', { projectId: project.id })).runs.find(
              (item) => item.operationId === request?.operationId,
            )?.state,
          { timeout: 20_000 },
        )
        .toBe('running');
      const run = (await app.call('programs.runs', { projectId: project.id })).runs.find(
        (item) => item.operationId === request?.operationId,
      );
      assert(run);
      const identity = { projectId: project.id, programRunId: run.programRunId };
      await expect
        .poll(() => readFile(join(project.path, 'heartbeat'), 'utf8').catch(() => ''))
        .not.toBe('');
      if (mode === 'storage-failure') {
        ProgramRecords.prototype.put = function (value) {
          if (
            value.run.programRunId === run.programRunId &&
            value.run.backgroundOwner?.state === 'authorized'
          )
            throw new OperationError('unavailable', 'synthetic authorization write failure');
          return put.call(this, value);
        };
        await expect(app.call('programs.handoff', identity)).rejects.toMatchObject({
          code: 'unavailable',
        });
        expect((await app.call('programs.run', identity)).backgroundOwner).toBeUndefined();
      }
      if (mode === 'handoff') {
        await app.call('programs.handoff', identity);
        expect((await app.call('programs.run', identity)).backgroundOwner).toMatchObject({
          kind: 'human',
          state: 'active',
        });
      }
      if (mode === 'race') {
        const [transfer, cancellation] = await Promise.allSettled([
          app.call('programs.handoff', identity),
          app.call('session.cancel', scope),
        ]);
        expect(cancellation.status).toBe('fulfilled');
        await expect
          .poll(async () => {
            const value = await app.call('programs.run', identity);
            return value.backgroundOwner?.state === 'active' || value.state === 'cancelled';
          })
          .toBe(true);
        const current = await app.call('programs.run', identity);
        if (transfer.status === 'fulfilled') expect(current.backgroundOwner?.state).toBe('active');
        if (current.state === 'running') expect(current.backgroundOwner?.state).toBe('active');
      } else await app.call('session.cancel', scope);
      if ((await app.call('programs.run', identity)).backgroundOwner?.state === 'active') {
        const records = new ProgramRecords(app.projects.get(project.id).internal);
        try {
          expect(records.get(run.programRunId).run.backgroundOwner?.state).toBe('active');
        } finally {
          records.close();
        }
        expect((await app.call('programs.run', identity)).state).toBe('running');
        const before = await readFile(join(project.path, 'heartbeat'), 'utf8');
        await expect.poll(() => readFile(join(project.path, 'heartbeat'), 'utf8')).not.toBe(before);
        await app.call('programs.cancel', identity);
      }
      await expect
        .poll(async () => (await app.call('programs.run', identity)).state)
        .toBe('cancelled');
      expect((await app.call('programs.run', identity)).stop).toBe('confirmed');
    } finally {
      ProgramRecords.prototype.put = put;
      model.release();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}

test('manual host prepares an authorized locked wheel environment and runs Python through the same durable path', async () => {
  const uv = await executable('uv');
  const python = await executable(process.platform === 'win32' ? 'python' : 'python3');
  test.skip(!uv || !python, 'requires preinstalled tools');
  assert(uv && python);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-environment-host-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const source = await localWheelProject({ tools: { python }, project: project.path });
    const registered = await app.call('programs.registerEnvironment', {
      projectId: project.id,
      operationId: randomUUID(),
      kind: 'uv',
      interpreterPath: python,
      uvPath: uv,
    });
    const environment = async () =>
      (await app.call('programs.environments', { projectId: project.id })).environments.find(
        (item) => item.environmentId === registered.environmentId,
      );
    await expect.poll(async () => (await environment())?.availability).toBe('needsAuthorization');
    const declarations = await Promise.all(
      ['pyproject.toml', 'uv.lock'].map(async (path) => {
        const descriptor = await app.call('resources.describe', {
          locator: { source: 'project', projectId: project.id, path },
        });
        return { ref: descriptor.ref, basis: descriptor.basis };
      }),
    );
    const plan = await app.call('programs.environmentPlan', {
      projectId: project.id,
      operationId: randomUUID(),
      environmentId: registered.environmentId,
      declarations,
    });
    await expect
      .poll(
        async () =>
          (
            await app.call('programs.environmentPlanStatus', {
              projectId: project.id,
              planId: plan.planId,
            })
          ).state,
      )
      .toBe('ready');
    const preparation = { projectId: project.id, planId: plan.planId, operationId: randomUUID() };
    await expect(app.call('programs.environmentPrepare', preparation)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await app.call('programs.authorizeEnvironment', { projectId: project.id, planId: plan.planId });
    await app.call('programs.environmentPrepare', preparation);
    await expect
      .poll(async () => (await environment())?.availability, { timeout: 20_000 })
      .toBe('ready');
    await writeFile(
      join(project.path, 'program.py'),
      'import scholoom_env_fixture\nprint(scholoom_env_fixture.VALUE)\n',
    );
    const entry = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'program.py' },
    });
    const run = await app.call('programs.start', {
      projectId: project.id,
      operationId: randomUUID(),
      environmentId: registered.environmentId,
      entry: { ref: entry.ref, basis: entry.basis },
    });
    const identity = { projectId: project.id, programRunId: run.programRunId };
    await expect
      .poll(async () => (await app.call('programs.run', identity)).state)
      .toBe('completed');
    expect(
      (await app.call('programs.logs', identity)).entries
        .map((item) => item.text)
        .join('')
        .trim(),
    ).toBe('42');
    expect(await readFile(join(project.path, 'pyproject.toml'), 'utf8')).toBe(source.pyproject);
    expect(await readFile(join(project.path, 'uv.lock'), 'utf8')).toBe(source.lock);
    await expect(access(join(project.path, '.venv'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});
