import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import {
  type EnvironmentPorts,
  ProgramEnvironments,
} from '../../packages/programs/src/environments.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import type { ProgramRun, ProgramState } from '../../packages/protocol/dist/programs.js';
import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';
import { executable, localWheelProject, writeWheel } from '../program-environment-fixture.js';

const human: CallContext = {
  moduleId: 'product',
  role: 'product',
  principal: { kind: 'human', id: 'local' },
};
const agent: CallContext = {
  moduleId: 'harness',
  role: 'execution',
  principal: { kind: 'agent', id: 'agent' },
};
const projectId = 'project';
const declarations: ResourceEvidence[] = ['pyproject.toml', 'uv.lock'].map((fileId) => ({
  ref: { source: 'project', projectId, fileId },
  basis: `basis:${fileId}`,
}));
type Launch = Parameters<EnvironmentPorts['launch']>[0];
const lockInspector = fileURLToPath(
  new URL('../../packages/programs/src/inspect-lock.py', import.meta.url),
);

async function fixture(real?: { uv: string; python: string }) {
  const directory = test.info().outputPath('private');
  const project = test.info().outputPath('project');
  await mkdir(project, { recursive: true });
  const launches: Launch[] = [];
  const runs = new Map<string, ProgramRun>();
  const outputLogs = new Map<string, string>();
  let basisChanged = false;
  let nextState: ProgramState = 'completed';
  let pythonVersion = '3.13.1';
  let evidence: unknown = { pythonVersion, dependencies: [], network: [] };
  const ports: EnvironmentPorts = {
    async check() {},
    async describe(evidence) {
      if (evidence.ref.source !== 'project') throw new Error('unexpected library reference');
      return {
        path: join(project, evidence.ref.fileId),
        relativePath: evidence.ref.fileId,
        basis: basisChanged ? 'changed' : evidence.basis,
      };
    },
    async launch(input) {
      launches.push(input);
      const programRunId = `run-${launches.length}`;
      let state = nextState;
      nextState = 'completed';
      if (real) {
        try {
          const output = await promisify(execFile)(input.executable, input.args, {
            ...(input.cwd ? { cwd: input.cwd } : {}),
            env: input.env ?? {},
            timeout: input.timeoutMs,
            maxBuffer: 1024 * 1024,
          });
          outputLogs.set(programRunId, output.stdout + output.stderr);
        } catch (error) {
          state = 'failed';
          outputLogs.set(programRunId, String(error));
        }
      }
      const now = new Date().toISOString();
      runs.set(programRunId, {
        programRunId,
        projectId,
        operationId: input.operationId,
        kind: input.kind,
        state,
        phase: 'inspecting',
        stop: state === 'unknown' ? 'unknown' : 'confirmed',
        exit: { code: state === 'completed' ? 0 : 1 },
        createdAt: now,
        updatedAt: now,
      });
      if (!real && input.args[2] === lockInspector && input.args[3] !== '--sync') {
        const path = input.args.at(-1);
        assert(path);
        await writeFile(path, JSON.stringify(evidence));
      }
      if (!real && input.kind === 'environmentPreparation' && state === 'completed') {
        const target = input.env?.UV_PROJECT_ENVIRONMENT;
        assert(target);
        const python = join(
          target,
          process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
        );
        await mkdir(dirname(python), { recursive: true });
        await writeFile(python, 'synthetic interpreter');
        await writeFile(join(target, 'pyvenv.cfg'), 'synthetic environment');
      }
      return { programRunId, state: 'queued' };
    },
    async wait(_project, runId) {
      const run = runs.get(runId);
      assert(run);
      return run;
    },
    async logs(_project, runId) {
      if (real) return outputLogs.get(runId) ?? '';
      const command = launches[Number(runId.slice(4)) - 1];
      assert(command);
      return command.args[0] === '--version' ? 'uv 0.9.17' : `Python ${pythonVersion}`;
    },
  };
  const environments = new ProgramEnvironments(directory, ports);
  await environments.initialize();
  async function register(
    kind: 'python' | 'conda' | 'uv' = 'uv',
    expected = kind === 'uv' ? 'needsAuthorization' : 'ready',
    interpreterPath = real?.python ?? process.execPath,
  ) {
    const result = await environments.register(
      {
        projectId,
        operationId: `register-${launches.length}`,
        interpreterPath,
        ...(kind === 'uv' ? { kind: 'uv', uvPath: real?.uv ?? process.execPath } : { kind }),
      },
      human,
    );
    await expect
      .poll(
        async () =>
          (await environments.list({ projectId, limit: 25 }, human)).environments.find(
            (entry) => entry.environmentId === result.environmentId,
          )?.availability,
      )
      .toBe(expected);
    return result.environmentId;
  }
  async function plan(environmentId: string) {
    const reference = await environments.plan(
      { projectId, operationId: `plan-${launches.length}`, environmentId, declarations },
      agent,
    );
    await expect
      .poll(
        async () =>
          (await environments.planStatus({ projectId, planId: reference.planId }, human)).state,
      )
      .not.toBe('pending');
    return environments.planStatus({ projectId, planId: reference.planId }, human);
  }
  return {
    directory,
    project,
    ports,
    environments,
    launches,
    runs,
    outputLogs,
    register,
    plan,
    changeBasis() {
      basisChanged = true;
    },
    failNext(state: ProgramState) {
      nextState = state;
    },
    evidence(value: unknown) {
      evidence = value;
    },
    pythonVersion(version: string) {
      pythonVersion = version;
    },
  };
}

async function realFixture() {
  const uv = await executable('uv');
  const python = await executable(process.platform === 'win32' ? 'python' : 'python3');
  test.skip(!uv || !python, 'requires existing uv and Python; this test never installs tools');
  assert(uv && python);
  return { ...(await fixture({ uv, python })), tools: { uv, python } };
}

test('host node is ready, registration requires a real human product caller, and probes are shared runs', async () => {
  const f = await fixture();
  expect(f.environments.resolve(projectId, 'node').executable).toBe(process.execPath);
  for (const context of [
    agent,
    { ...human, role: 'execution' as const },
    { ...human, targetRead: { access: 'read' as const, targetProjectId: projectId } },
  ]) {
    await expect(
      f.environments.register(
        { projectId, operationId: 'denied', kind: 'python', interpreterPath: process.execPath },
        context,
      ),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
  }
  const environmentId = await f.register('python');
  expect(f.environments.resolve(projectId, environmentId).executable).toBe(process.execPath);
  expect(f.launches).toHaveLength(1);
  expect(f.launches[0]).toMatchObject({ kind: 'environmentCheck', timeoutMs: 10_000 });
});

test('empty locked plan requires human consent, prepares in a private target and persists readiness', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  expect(() => f.environments.resolve(projectId, environmentId)).toThrow();
  const plan = await f.plan(environmentId);
  expect(plan).toMatchObject({ state: 'ready', dependencies: [], network: [], build: false });
  expect(JSON.stringify(plan)).not.toContain(f.project);
  expect(JSON.stringify(plan)).not.toContain(process.execPath);
  const input = { projectId, planId: plan.planId, operationId: 'prepare' };
  await expect(f.environments.prepare(input, agent)).rejects.toMatchObject({
    code: 'permissionDenied',
  });
  await expect(
    f.environments.authorize({ projectId, planId: plan.planId }, agent),
  ).rejects.toMatchObject({ code: 'permissionDenied' });
  const authorization = await f.environments.authorize({ projectId, planId: plan.planId }, human);
  expect(await f.environments.authorize({ projectId, planId: plan.planId }, human)).toEqual(
    authorization,
  );
  const run = await f.environments.prepare(input, agent);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (e) => e.environmentId === environmentId,
        )?.availability,
    )
    .toBe('ready');
  const resolved = f.environments.resolve(projectId, environmentId);
  expect(resolved.executable.startsWith(f.directory)).toBe(true);
  expect(resolved.env?.UV_PROJECT_ENVIRONMENT).toBeTruthy();
  const count = f.launches.length;
  expect(await f.environments.prepare(input, agent)).toEqual({ ...run, state: 'completed' });
  expect(f.launches).toHaveLength(count);
  const restored = new ProgramEnvironments(f.directory, f.ports);
  await restored.initialize();
  expect(restored.resolve(projectId, environmentId)).toEqual(resolved);
  expect(f.launches).toHaveLength(count);
  const inspect = f.launches.find((command) => command.args[2] === lockInspector);
  assert(inspect);
  expect(inspect.declarations).toEqual(declarations);
  expect(inspect.args.slice(0, 3)).toEqual(['-I', '-B', lockInspector]);
  expect(inspect.args.every((arg) => Buffer.byteLength(arg, 'utf8') <= 4096)).toBe(true);
  for (const launch of f.launches) expect(launch.cwd ?? '.').toBe('.');
  const sync = f.launches.find((command) => command.kind === 'environmentPreparation');
  assert(sync);
  expect(sync.declarations).toEqual(declarations);
  const verify = f.launches.find((command) => command.executable === resolved.executable);
  assert(verify);
  expect(verify.declarations).toEqual(declarations);
  expect(sync.args).toEqual(
    expect.arrayContaining([
      '--locked',
      '--no-dev',
      '--no-install-project',
      '--no-install-workspace',
      '--no-python-downloads',
      '--no-build',
      '--offline',
    ]),
  );
  expect(sync.env).not.toHaveProperty('PATH');
});

test('stale declarations invalidate consent and never start synchronization', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  const count = f.launches.length;
  f.changeBasis();
  await expect(
    f.environments.prepare({ projectId, planId: plan.planId, operationId: 'stale' }, agent),
  ).rejects.toMatchObject({ code: 'contentChanged' });
  expect(f.launches).toHaveLength(count);
});

test('registry plans expose locked wheel sources and human consent permits network without enabling builds', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const registry = 'https://pypi.org/simple';
  const wheel = 'https://files.pythonhosted.org/packages/idna-3.10-py3-none-any.whl';
  f.evidence({
    pythonVersion: '3.13.1',
    dependencies: [
      {
        name: 'idna',
        version: '3.10',
        source: registry,
        wheels: [{ source: wheel, hash: `sha256:${'a'.repeat(64)}` }],
      },
    ],
    network: [wheel, registry],
  });
  const plan = await f.plan(environmentId);
  expect(plan).toMatchObject({
    state: 'ready',
    dependencies: [{ name: 'idna', version: '3.10', source: registry }],
    network: [wheel, registry],
    build: false,
  });
  await expect(
    f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent),
  ).rejects.toMatchObject({ code: 'permissionDenied' });
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  await f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (entry) => entry.environmentId === environmentId,
        )?.availability,
    )
    .toBe('ready');
  const sync = f.launches.find((command) => command.kind === 'environmentPreparation');
  assert(sync);
  expect(sync.args).toContain('--locked');
  expect(sync.args).toContain('--no-build');
  expect(sync.args).not.toContain('--offline');
});

for (const state of ['failed', 'cancelled', 'interrupted', 'unknown'] as const) {
  test(`preparation ${state} never becomes ready and leaves independent Python usable`, async () => {
    const f = await fixture();
    const python = await f.register('python');
    const environmentId = await f.register();
    const plan = await f.plan(environmentId);
    await f.environments.authorize({ projectId, planId: plan.planId }, human);
    f.failNext(state);
    await f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent);
    await expect
      .poll(
        async () =>
          (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
            (e) => e.environmentId === environmentId,
          )?.availability,
      )
      .toBe(state);
    expect(() => f.environments.resolve(projectId, environmentId)).toThrow();
    expect(f.environments.resolve(projectId, python).executable).toBe(process.execPath);
  });
}

test('restarting during preparation never replays it and keeps independently ready environments', async () => {
  const f = await fixture();
  const python = await f.register('python');
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  const wait = f.ports.wait;
  f.ports.wait = async (id, runId, context) => {
    if (f.runs.get(runId)?.kind === 'environmentPreparation')
      return new Promise<ProgramRun>(() => {});
    return wait(id, runId, context);
  };
  const input = { projectId, planId: plan.planId, operationId: 'prepare-restart' };
  const reference = await f.environments.prepare(input, agent);
  const count = f.launches.length;
  const restored = new ProgramEnvironments(f.directory, f.ports);
  await restored.initialize();
  expect(await restored.prepare(input, agent)).toEqual({ ...reference, state: 'unknown' });
  await expect(restored.prepare({ ...input, operationId: 'retry' }, agent)).rejects.toMatchObject({
    code: 'outcomeUnknown',
  });
  expect(() => restored.resolve(projectId, environmentId)).toThrow();
  expect(restored.resolve(projectId, python).executable).toBe(process.execPath);
  expect(f.launches).toHaveLength(count);
});

test('changed interpreter bytes invalidate a ready managed receipt', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  await f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (e) => e.environmentId === environmentId,
        )?.availability,
    )
    .toBe('ready');
  const resolved = f.environments.resolve(projectId, environmentId);
  await writeFile(resolved.executable, 'changed managed interpreter bytes');
  expect(() => f.environments.resolve(projectId, environmentId)).toThrow();
  expect(
    (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
      (e) => e.environmentId === environmentId,
    ),
  ).toMatchObject({ availability: 'unavailable', diagnostic: { code: 'contentChanged' } });
});

for (const kind of ['python', 'conda'] as const) {
  test(`replacing registered ${kind} invalidates the persisted interpreter receipt and cached version`, async () => {
    const f = await fixture();
    const path = join(f.project, 'registered-python');
    await writeFile(path, 'synthetic original interpreter');
    const environmentId = await f.register(kind, 'ready', path);
    const restored = new ProgramEnvironments(f.directory, f.ports);
    await restored.initialize();
    expect(restored.resolve(projectId, environmentId)).toMatchObject({
      executable: path,
      version: '3.13.1',
    });
    const replacement = 'synthetic replacement interpreter with different bytes';
    await writeFile(path, replacement);
    if (kind === 'python') {
      expect(() => restored.resolve(projectId, environmentId)).toThrow();
    } else {
      await expect(restored.validate(projectId, environmentId, human)).rejects.toMatchObject({
        code: 'unavailable',
      });
    }
    const environment = (await restored.list({ projectId, limit: 25 }, human)).environments.find(
      (entry) => entry.environmentId === environmentId,
    );
    expect(environment).toMatchObject({
      availability: 'unavailable',
      diagnostic: { code: 'contentChanged' },
    });
    expect(environment).not.toHaveProperty('version');
    expect(await readFile(path, 'utf8')).toBe(replacement);
    expect(f.launches).toHaveLength(1);
  });
}

test('registration is idempotent per caller and rejects changed requests and foreign project access', async () => {
  const f = await fixture();
  const input = {
    projectId,
    operationId: 'register',
    kind: 'python' as const,
    interpreterPath: process.execPath,
  };
  const reference = await f.environments.register(input, human);
  expect(await f.environments.register(input, human)).toEqual(reference);
  await expect(f.environments.register({ ...input, kind: 'conda' }, human)).rejects.toMatchObject({
    code: 'invalidRequest',
  });
  expect(() => f.environments.resolve('another-project', reference.environmentId)).toThrow();
  expect(f.launches).toHaveLength(1);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (e) => e.environmentId === reference.environmentId,
        )?.availability,
    )
    .toBe('ready');
});

test('uv commands and persisted configuration never inherit a host secret', async () => {
  const key = 'SCHOLOOM_ENVIRONMENT_TEST_SECRET';
  const previous = process.env[key];
  const secret = 'synthetic-environment-secret-42';
  process.env[key] = secret;
  try {
    const f = await fixture();
    const environmentId = await f.register();
    const plan = await f.plan(environmentId);
    await f.environments.authorize({ projectId, planId: plan.planId }, human);
    await f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent);
    await expect
      .poll(
        async () =>
          (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
            (e) => e.environmentId === environmentId,
          )?.availability,
      )
      .toBe('ready');
    for (const command of f.launches) expect(JSON.stringify(command)).not.toContain(secret);
    expect(await readFile(join(f.directory, 'environments.json'), 'utf8')).not.toContain(secret);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test('Python below 3.11 remains directly runnable but cannot prepare uv environments', async () => {
  const f = await fixture();
  f.pythonVersion('3.10.14');
  const python = await f.register('python');
  expect(f.environments.resolve(projectId, python).executable).toBe(process.execPath);
  const uv = await f.register('uv', 'unavailable');
  await expect(
    f.environments.plan(
      { projectId, environmentId: uv, operationId: 'old-python-plan', declarations },
      human,
    ),
  ).rejects.toMatchObject({ code: 'unavailable' });
  expect(
    (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
      (entry) => entry.environmentId === uv,
    ),
  ).toMatchObject({ availability: 'unavailable', diagnostic: { code: 'unavailable' } });
});

test('validate rechecks original declarations immediately before host launch', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  await f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, agent);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (entry) => entry.environmentId === environmentId,
        )?.availability,
    )
    .toBe('ready');
  await f.environments.validate(projectId, environmentId, human);
  f.changeBasis();
  await expect(f.environments.validate(projectId, environmentId, human)).rejects.toMatchObject({
    code: 'contentChanged',
  });
  expect(() => f.environments.resolve(projectId, environmentId)).toThrow();
});

test('real Python tomllib inspects declarations without changes and uv prepares an isolated empty environment', async () => {
  const f = await realFixture();
  const pyproject =
    '[project]\nname = "env-fixture"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = []\n';
  const lock =
    'version = 1\nrevision = 3\nrequires-python = ">=3.11"\n[[package]]\nname = "env-fixture"\nversion = "0.1.0"\nsource = { virtual = "." }\n';
  await writeFile(join(f.project, 'pyproject.toml'), pyproject);
  await writeFile(join(f.project, 'uv.lock'), lock);
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  expect(plan, JSON.stringify([...f.outputLogs])).toMatchObject({
    state: 'ready',
    dependencies: [],
  });
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  await f.environments.prepare(
    { projectId, planId: plan.planId, operationId: 'prepare-real' },
    agent,
  );
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (e) => e.environmentId === environmentId,
        )?.availability,
      { message: JSON.stringify([...f.outputLogs]) },
    )
    .toBe('ready');
  const resolved = f.environments.resolve(projectId, environmentId);
  const { stdout } = await promisify(execFile)(
    resolved.executable,
    ['-I', '-c', 'import sys; print(sys.prefix)'],
    { env: resolved.env ?? {} },
  );
  expect(stdout.trim()).toBe(resolved.env?.UV_PROJECT_ENVIRONMENT);
  expect(await readFile(join(f.project, 'pyproject.toml'), 'utf8')).toBe(pyproject);
  expect(await readFile(join(f.project, 'uv.lock'), 'utf8')).toBe(lock);
  await expect(access(join(f.project, '.venv'))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('real locked local wheel installs, imports and reuses a private environment without changing the project or original Python', async () => {
  const f = await realFixture();
  const source = await localWheelProject(f);
  await mkdir(join(f.project, '.venv'));
  const existingEnvironment = join(f.project, '.venv', 'keep.txt');
  await writeFile(existingEnvironment, 'existing project environment');
  const interpreterBefore = await stat(f.tools.python);
  const originalProbe = [
    '-I',
    '-c',
    'import importlib.util; print(importlib.util.find_spec("scholoom_env_fixture") is None)',
  ];
  expect(
    (await promisify(execFile)(f.tools.python, originalProbe, { env: {} })).stdout.trim(),
  ).toBe('True');
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  expect(plan, JSON.stringify([...f.outputLogs])).toMatchObject({
    state: 'ready',
    dependencies: [{ name: 'scholoom-env-fixture', version: '1.0.0', source: source.wheel }],
    network: [],
    build: false,
  });
  const stored = JSON.parse(await readFile(join(f.directory, 'environments.json'), 'utf8'));
  expect(stored.plans[0].evidence.dependencies[0].wheels).toEqual([
    { source: source.wheel, hash: source.hash },
  ]);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  const input = { projectId, planId: plan.planId, operationId: 'prepare-local-wheel' };
  await f.environments.prepare(input, agent);
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (entry) => entry.environmentId === environmentId,
        )?.availability,
      { message: JSON.stringify([...f.outputLogs]) },
    )
    .toBe('ready');
  await f.environments.validate(projectId, environmentId, human);
  const resolved = f.environments.resolve(projectId, environmentId);
  const output = await promisify(execFile)(
    resolved.executable,
    [
      '-I',
      '-c',
      'import scholoom_env_fixture,sys; print(scholoom_env_fixture.VALUE); print(sys.prefix)',
    ],
    { env: resolved.env ?? {} },
  );
  expect(output.stdout.trim().split(/\r?\n/)).toEqual(['42', resolved.env?.UV_PROJECT_ENVIRONMENT]);
  const launches = f.launches.length;
  expect((await f.environments.prepare({ ...input, operationId: 'reuse' }, agent)).state).toBe(
    'completed',
  );
  expect(f.launches).toHaveLength(launches);
  const restored = new ProgramEnvironments(f.directory, f.ports);
  await restored.initialize();
  await restored.validate(projectId, environmentId, human);
  expect(restored.resolve(projectId, environmentId)).toEqual(resolved);
  expect(await readFile(join(f.project, 'pyproject.toml'), 'utf8')).toBe(source.pyproject);
  expect(await readFile(join(f.project, 'uv.lock'), 'utf8')).toBe(source.lock);
  expect(
    `sha256:${createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex')}`,
  ).toBe(source.hash);
  expect(await readFile(existingEnvironment, 'utf8')).toBe('existing project environment');
  const interpreterAfter = await stat(f.tools.python);
  expect([interpreterAfter.ino, interpreterAfter.size, interpreterAfter.mtimeMs]).toEqual([
    interpreterBefore.ino,
    interpreterBefore.size,
    interpreterBefore.mtimeMs,
  ]);
  expect(
    (await promisify(execFile)(f.tools.python, originalProbe, { env: {} })).stdout.trim(),
  ).toBe('True');
  for (const launch of f.launches) expect(launch.cwd ?? '.').toBe('.');
});

test('a local wheel replaced after consent fails locked hash validation and never becomes ready', async () => {
  const f = await realFixture();
  const source = await localWheelProject(f);
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  expect(plan.state).toBe('ready');
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  await writeWheel(f.tools.python, source.path, 99);
  const reference = await f.environments.prepare(
    { projectId, planId: plan.planId, operationId: 'changed-wheel' },
    agent,
  );
  await expect
    .poll(
      async () =>
        (await f.environments.list({ projectId, limit: 25 }, human)).environments.find(
          (entry) => entry.environmentId === environmentId,
        )?.availability,
    )
    .toBe('failed');
  expect(f.outputLogs.get(reference.programRunId)).toContain('Hash mismatch');
  expect(() => f.environments.resolve(projectId, environmentId)).toThrow();
});

test('nested declarations cannot authorize preparation for a different uv project root', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const count = f.launches.length;
  const nested = ['pyproject.toml', 'uv.lock'].map((fileId) => ({
    ref: { source: 'project' as const, projectId, fileId: `child/${fileId}` },
    basis: 'basis',
  }));
  await expect(
    f.environments.plan(
      { projectId, operationId: 'nested', environmentId, declarations: nested },
      human,
    ),
  ).rejects.toMatchObject({ code: 'invalidRequest' });
  expect(f.launches).toHaveLength(count);
});

test('aggregate plan capacity remains restartable and does not poison smaller operations', async () => {
  const f = await fixture();
  const pythonId = await f.register('python');
  const environmentId = await f.register();
  f.evidence({
    pythonVersion: '3.13.1',
    dependencies: Array.from({ length: 700 }, (_, index) => ({
      name: `${index}-${'n'.repeat(300)}`,
      version: '1.0.0',
      source: `https://registry.test/${'s'.repeat(300)}`,
      wheels: [{ source: `https://registry.test/${index}.whl`, hash: `sha256:${'a'.repeat(64)}` }],
    })),
    network: [],
  });
  let rejected = false;
  const ready = [];
  for (let index = 0; index < 6; index++) {
    const plan = await f.plan(environmentId);
    if (plan.state === 'ready') ready.push(plan.planId);
    else {
      expect(plan.error?.code).toBe('tooLarge');
      rejected = true;
      break;
    }
  }
  const path = join(f.directory, 'environments.json');
  expect((await readFile(path)).length).toBeLessThanOrEqual(4 * 1024 * 1024);
  expect(rejected).toBe(true);
  for (const planId of ready)
    expect((await f.environments.planStatus({ projectId, planId }, human)).state).toBe('ready');
  expect(
    (await f.environments.list({ projectId }, human)).environments.find(
      (item) => item.environmentId === pythonId,
    )?.availability,
  ).toBe('ready');
  await f.register('python');
  const restarted = new ProgramEnvironments(f.directory, f.ports);
  await restarted.initialize();
  expect(
    (await restarted.list({ projectId }, human)).environments.find(
      (item) => item.environmentId === pythonId,
    )?.availability,
  ).toBe('ready');
});

test('preparation intent survives a lost launch receipt and prevents another dispatch', async () => {
  const f = await fixture();
  const environmentId = await f.register();
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  const launch = f.ports.launch;
  let dispatches = 0;
  f.ports.launch = async (input, context) => {
    if (input.kind !== 'environmentPreparation') return launch(input, context);
    const saved = JSON.parse(await readFile(join(f.directory, 'environments.json'), 'utf8'));
    expect(
      saved.plans.find((item: { value: { planId: string } }) => item.value.planId === plan.planId)
        .preparation.input.operationId,
    ).toBe('prepare');
    dispatches++;
    await launch(input, context);
    throw new Error('synthetic lost response after acceptance');
  };
  await expect(
    f.environments.prepare({ projectId, planId: plan.planId, operationId: 'prepare' }, human),
  ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  await expect(
    f.environments.prepare({ projectId, planId: plan.planId, operationId: 'retry' }, human),
  ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  const restarted = new ProgramEnvironments(f.directory, f.ports);
  await restarted.initialize();
  await expect(
    restarted.prepare(
      { projectId, planId: plan.planId, operationId: 'retry-after-restart' },
      human,
    ),
  ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(dispatches).toBe(1);
});

test('a near-limit pre-reservation configuration recovers readably without replacing its history', async () => {
  const f = await fixture();
  const pythonId = await f.register('python');
  const environmentId = await f.register();
  f.evidence({
    pythonVersion: '3.13.1',
    dependencies: Array.from({ length: 700 }, (_, index) => ({
      name: `${index}-${'n'.repeat(300)}`,
      version: '1',
      source: `https://registry.test/${'s'.repeat(300)}`,
      wheels: [{ source: `https://registry.test/${index}.whl`, hash: `sha256:${'a'.repeat(64)}` }],
    })),
    network: [],
  });
  const plan = await f.plan(environmentId);
  await f.environments.authorize({ projectId, planId: plan.planId }, human);
  const path = join(f.directory, 'environments.json');
  const store = JSON.parse(await readFile(path, 'utf8'));
  const template = store.plans[0];
  for (let index = 1; index < 4; index++) {
    const next = structuredClone(template);
    next.value.planId = `historical-${index}`;
    next.input.operationId = `historical-${index}`;
    store.plans.push(next);
  }
  template.working = true;
  template.preparation = {
    input: { projectId, planId: plan.planId, operationId: 'accepted-before-reservations' },
    principal: human.principal,
    reference: { programRunId: 'prepared', state: 'running' },
  };
  const entry = store.registrations.find(
    (item: { environment: { environmentId: string } }) =>
      item.environment.environmentId === environmentId,
  );
  entry.environment.availability = 'preparing';
  const limit = 4 * 1024 * 1024;
  let available = limit - 1 - Buffer.byteLength(JSON.stringify(store));
  expect(available).toBeGreaterThan(0);
  for (const item of store.plans)
    for (let index = 0; index < item.evidence.dependencies.length; index++) {
      const dependency = item.evidence.dependencies[index];
      const added = Math.min(1024 - dependency.name.length, Math.floor(available / 2));
      dependency.name += 'x'.repeat(added);
      item.value.dependencies[index].name = dependency.name;
      available -= added * 2;
    }
  expect(available).toBeLessThan(2);
  const original = JSON.stringify(store);
  await writeFile(path, original);
  const restarted = new ProgramEnvironments(f.directory, f.ports);
  await restarted.initialize();
  await restarted.initialize();
  const state = async () => (await restarted.list({ projectId }, human)).environments;
  expect((await state()).find((item) => item.environmentId === environmentId)?.availability).toBe(
    'unknown',
  );
  expect((await state()).find((item) => item.environmentId === pythonId)?.availability).toBe(
    'ready',
  );
  const launches = f.launches.length;
  await expect(
    restarted.register(
      { projectId, operationId: 'cannot-fit', kind: 'python', interpreterPath: process.execPath },
      human,
    ),
  ).rejects.toMatchObject({ code: 'tooLarge' });
  expect(f.launches).toHaveLength(launches);
  expect((await state()).find((item) => item.environmentId === environmentId)?.availability).toBe(
    'unknown',
  );
  expect(await readFile(path, 'utf8')).toBe(original);
});

for (const phase of ['plan', 'sync'] as const) {
  test(`an ancestor workspace introduced before ${phase} cannot replace the authorized lock`, async () => {
    const f = await realFixture();
    await localWheelProject(f);
    const environmentId = await f.register();
    const workspace = () =>
      writeFile(
        join(dirname(f.project), 'pyproject.toml'),
        '[project]\nname="outer"\nversion="0.1.0"\n[tool.uv.workspace]\nmembers=["project"]\n',
      );
    if (phase === 'plan') await workspace();
    const plan = await f.plan(environmentId);
    if (phase === 'plan') {
      expect(plan.state).toBe('failed');
      expect(plan.error?.code).toBe('unavailable');
    } else {
      expect(plan.state).toBe('ready');
      await f.environments.authorize({ projectId, planId: plan.planId }, human);
      await workspace();
      await f.environments.prepare(
        { projectId, planId: plan.planId, operationId: 'prepare' },
        human,
      );
      await expect
        .poll(
          async () =>
            (await f.environments.list({ projectId }, human)).environments.find(
              (item) => item.environmentId === environmentId,
            )?.availability,
        )
        .toBe('failed');
    }
    await expect(access(join(dirname(f.project), 'uv.lock'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(f.project, '.venv'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
}

const registry = 'https://pypi.org/simple';
const registryWheel =
  'https://files.pythonhosted.org/packages/locked_package-1.0.0-py3-none-any.whl';
const wheelHash = `sha256:${'b'.repeat(64)}`;
const validRegistryPackage = `source = { registry = "${registry}" }\nwheels = [{ url = "${registryWheel}", hash = "${wheelHash}" }]`;

for (const scenario of [
  { name: 'registry wheels', body: validRegistryPackage, ready: true },
  { name: 'git', body: 'source = { git = "https://example.org/package.git" }', ready: false },
  { name: 'editable', body: 'source = { editable = "package" }', ready: false },
  {
    name: 'sdist-only',
    body: `source = { registry = "${registry}" }\nsdist = { url = "https://files.pythonhosted.org/package.tar.gz", hash = "${wheelHash}" }`,
    ready: false,
  },
  {
    name: 'missing wheel hash',
    body: `source = { registry = "${registry}" }\nwheels = [{ url = "${registryWheel}" }]`,
    ready: false,
  },
  {
    name: 'credential-bearing source',
    body: validRegistryPackage.replace(registry, 'https://user:synthetic-token@example.org/simple'),
    ready: false,
  },
] as const) {
  test(`real tomllib evidence handles ${scenario.name} without fetching packages`, async () => {
    const f = await realFixture();
    await writeFile(
      join(f.project, 'pyproject.toml'),
      '[project]\nname="env-project"\nversion="0.1.0"\nrequires-python=">=3.11"\ndependencies=["locked-package==1.0.0"]\n',
    );
    await writeFile(
      join(f.project, 'uv.lock'),
      `version = 1
revision = 3
requires-python = ">=3.11"
[[package]]
name = "env-project"
version = "0.1.0"
source = { virtual = "." }
dependencies = [{ name = "locked-package" }]
[[package]]
name = "locked-package"
version = "1.0.0"
${scenario.body}
`,
    );
    const environmentId = await f.register();
    const plan = await f.plan(environmentId);
    if (scenario.ready) {
      expect(plan).toMatchObject({
        state: 'ready',
        dependencies: [{ name: 'locked-package', version: '1.0.0', source: registry }],
        network: expect.arrayContaining([registry, registryWheel]),
        build: false,
      });
      const stored = JSON.parse(await readFile(join(f.directory, 'environments.json'), 'utf8'));
      expect(stored.plans[0].evidence.dependencies[0].wheels).toEqual([
        { source: registryWheel, hash: wheelHash },
      ]);
      await expect(
        f.environments.authorize({ projectId, planId: plan.planId }, agent),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
    } else {
      expect(plan).toMatchObject({ state: 'failed', error: { code: 'unavailable' } });
      await expect(
        f.environments.authorize({ projectId, planId: plan.planId }, human),
      ).rejects.toMatchObject({ code: 'unavailable' });
      expect(JSON.stringify(plan)).not.toContain('synthetic-token');
      expect(await readFile(join(f.directory, 'environments.json'), 'utf8')).not.toContain(
        'synthetic-token',
      );
    }
    expect(f.launches.every((command) => command.kind === 'environmentCheck')).toBe(true);
    expect(f.launches.every((command) => command.args[0] !== 'sync')).toBe(true);
  });
}
