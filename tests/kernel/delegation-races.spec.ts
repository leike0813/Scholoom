import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import {
  configuredDelegationRoles,
  Delegations,
  defaultDelegationRole,
} from '../../packages/harness/dist/delegations.js';
import { HarnessRecords } from '../../packages/harness/dist/node.js';
import { ProcessAdmission } from '../../packages/platform/dist/node.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import {
  type DelegationRequest,
  OperationError,
  type ResourceDescriptor,
  type ResourceEvidence,
} from '../../packages/protocol/dist/index.js';
import type { ExecutionResourcePort } from '../../packages/protocol/dist/resources.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { createModelServer } from '../model-server.js';

const request = (id: string, objective: string, path: string): DelegationRequest => ({
  delegationId: id,
  roleId: 'worker',
  roleVersion: '1',
  tools: ['resource.create', 'resource.creation', 'resource.read', 'scratch'],
  workPackage: {
    objective,
    requirements: 'Save only the specified output.',
    materials: [],
    outputs: [{ kind: 'create', path }],
  },
});

test('same-resource writes cannot overlap and restored records only rebind their own project', async () => {
  expect(() => configuredDelegationRoles([defaultDelegationRole])).toThrow(OperationError);
  expect(() =>
    configuredDelegationRoles(
      Array.from({ length: 5 }, (_, index) => ({
        ...defaultDelegationRole,
        id: `large-${index}`,
        guidance: 'a'.repeat(32768),
      })),
    ),
  ).toThrow(OperationError);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-write-admission-'));
  const app = new KernelApplication(join(root, 'profile'));
  let records: HarnessRecords | undefined;
  let finish!: () => void;
  const running = new Promise<void>((resolve) => {
    finish = resolve;
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'draft.md',
      content: 'Original input',
    });
    const descriptor = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'draft.md' },
    });
    records = new HarnessRecords(app.projects.get(project.id).internal);
    const manager = new Delegations(
      records.db,
      project.id,
      [{ ...defaultDelegationRole, id: 'bounded', tools: ['resource.read', 'resource.save'] }],
      () => {},
    );
    const context: CallContext = {
      moduleId: 'harness',
      principal: { kind: 'agent', id: 'session' },
      role: 'execution',
      projectId: project.id,
      sessionId: 'session',
      runId: 'run',
      instanceId: 'parent',
      signal: new AbortController().signal,
    };
    const admission = new ProcessAdmission();
    manager.bind({
      context,
      modelConfig: { model: 'MiniMax-M2.7' },
      tools: ['resource.save', 'resource.create'],
      check() {},
      authorize: async () => {},
      reserve: () => admission.reserve(),
      resolveProfile: async () => {
        throw new Error('No profile in this fixture');
      },
      launch: async () => running,
    });
    const work = request('write-admission', 'Update explicit output', 'unused.md');
    work.roleId = 'bounded';
    work.tools = ['resource.save', 'resource.create', 'resource.read'];
    work.workPackage.materials = [
      {
        ref: { source: 'project', projectId: 'foreign-project', fileId: 'foreign-file' },
        basis: 'foreign-basis',
      },
    ];
    work.workPackage.outputs = [{ kind: 'save', ref: descriptor.ref, basis: descriptor.basis }];
    await manager.delegate(work, context);
    expect(manager.get('session', work.delegationId).tools).toEqual(['resource.save']);
    const child = {
      ...context,
      instanceId: manager.get('session', work.delegationId).childInstanceId!,
    };
    let publish!: () => void;
    const held = new Promise<void>((resolve) => {
      publish = resolve;
    });
    let saves = 0;
    const unavailable = async (): Promise<never> => {
      throw new Error('Unused port in this fixture');
    };
    const port: ExecutionResourcePort = {
      describe: unavailable,
      read: unavailable,
      document: unavailable,
      create: unavailable,
      creation: unavailable,
      save: async () => {
        saves++;
        await held;
        return { resource: { ...descriptor, basis: 'saved-basis' } };
      },
    };
    const resources = manager.resources(
      child,
      port,
      () => {},
      () => {},
    );
    await expect(
      resources.read({ ref: descriptor.ref, basis: descriptor.basis, encoding: 'utf8' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      resources.create({
        projectId: project.id,
        path: 'unused.md',
        operationId: 'denied-create',
        content: 'Forbidden bytes',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const input = { ref: descriptor.ref, basis: descriptor.basis, content: 'Saved bytes' };
    const first = resources.save(input);
    await expect(resources.save(input)).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(saves).toBe(1);
    publish();
    const saved = await first;
    manager.report(child, {
      findings: 'Confirmed output',
      unfinished: '',
      blockers: '',
      artifacts: [{ ref: saved.resource.ref, basis: saved.resource.basis }],
    });
    finish();
    const result = (await manager.wait(work.delegationId, context, 5000)).delegation;
    expect(result).toMatchObject({ state: 'completed', resultState: 'available' });
    expect(result.writes).toHaveLength(1);
    records.restore('restored-project');
    const restored = manager.get('session', work.delegationId);
    expect(restored.request.workPackage.materials[0]?.ref).toMatchObject({
      projectId: 'foreign-project',
    });
    expect(restored.writes[0]?.ref).toMatchObject({ projectId: 'restored-project' });
    expect(restored.artifacts[0]?.resource.ref).toMatchObject({ projectId: 'restored-project' });
    expect(restored.report?.artifacts[0]?.ref).toMatchObject({ projectId: 'restored-project' });
  } finally {
    finish();
    records?.close();
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('siblings using the same tool operation identity only obtain their own creation receipts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-siblings-'));
  const first = request('first', 'CHILD_FIRST', 'secret.md');
  const second = request('second', 'CHILD_SECOND', 'report.md');
  let projectId = '';
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      const body = model.requests.at(-1)!;
      if (user.includes('PARENT_SIBLINGS')) {
        const count = calls.filter((name) => name === 'delegate_agent').length;
        const waited = delegationOutput(body, 'wait_delegation');
        if (!count) return { tool: { name: 'delegate_agent', input: first } };
        if (
          !waited ||
          waited.delegation.id !== (count === 1 ? first.delegationId : second.delegationId) ||
          ['accepted', 'running'].includes(waited.delegation.state)
        )
          return {
            tool: {
              name: 'wait_delegation',
              input: {
                delegationId: count === 1 ? first.delegationId : second.delegationId,
                waitMs: 5000,
              },
            },
          };
        if (count === 1) return { tool: { name: 'delegate_agent', input: second } };
        return { text: 'Both children checked.' };
      }
      const child = user.includes('CHILD_FIRST') ? first : second;
      if (!calls.includes('create_delegation_resource'))
        return {
          tool: {
            name: 'create_delegation_resource',
            input: {
              projectId,
              path: child === first ? 'secret.md' : 'report.md',
              operationId: 'same-client-operation',
              content: child === first ? 'Sibling private bytes' : 'Own report bytes',
            },
          },
        };
      if (!calls.includes('check_delegation_creation'))
        return {
          tool: {
            name: 'check_delegation_creation',
            input: { projectId, operationId: 'same-client-operation' },
          },
        };
      const saved = delegationOutput(body, 'check_delegation_creation');
      if (!calls.includes('report_delegation'))
        return {
          tool: {
            name: 'report_delegation',
            input: {
              findings: 'Own resource checked.',
              unfinished: '',
              blockers: '',
              artifacts: saved?.resource
                ? [{ ref: saved.resource.ref, basis: saved.resource.basis }]
                : [],
            },
          },
        };
      return { text: 'Child finished.' };
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
    projectId = project.id;
    const session = await app.call('session.create', { projectId });
    const scope = { projectId, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'PARENT_SIBLINGS',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const a = await app.call('delegation.get', { ...scope, delegationId: first.delegationId });
    const b = await app.call('delegation.get', { ...scope, delegationId: second.delegationId });
    expect(a).toMatchObject({ state: 'completed', resultState: 'available' });
    expect(b).toMatchObject({ state: 'completed', resultState: 'available' });
    expect(a.artifacts[0]?.resource.path).toBe('secret.md');
    expect(b.artifacts[0]?.resource.path).toBe('report.md');
    expect(b.artifacts[0]?.resource.ref).not.toEqual(a.artifacts[0]?.resource.ref);
    expect(b.creations[0]?.resourceOperationId).not.toBe(a.creations[0]?.resourceOperationId);
    expect(await readFile(join(root, 'project', 'report.md'), 'utf8')).toBe('Own report bytes');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('readable material cannot widen the first save version granted by an accepted delegation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-write-version-'));
  const work = request('write-version', 'CHILD_WRITE_VERSION', 'unused.md');
  let readable!: ResourceEvidence;
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      const body = model.requests.at(-1)!;
      if (user.includes('PARENT_WRITE_VERSION')) {
        if (!calls.includes('delegate_agent'))
          return { tool: { name: 'delegate_agent', input: work } };
        const waited = delegationOutput(body, 'wait_delegation');
        if (!waited || ['accepted', 'running'].includes(waited.delegation.state))
          return {
            tool: {
              name: 'wait_delegation',
              input: { delegationId: work.delegationId, waitMs: 5000 },
            },
          };
        return { text: 'Parent inspected the actual outcome.' };
      }
      if (!calls.includes('read_context_resource'))
        return {
          tool: { name: 'read_context_resource', input: { ...readable, encoding: 'utf8' } },
        };
      if (!calls.includes('save_delegation_resource'))
        return {
          tool: {
            name: 'save_delegation_resource',
            input: { ...readable, content: 'Unauthorized replacement' },
          },
        };
      const saved = delegationOutput(body, 'save_delegation_resource');
      if (!calls.includes('report_delegation'))
        return {
          tool: {
            name: 'report_delegation',
            input: {
              findings: 'Read current material.',
              unfinished: 'No authorized output saved.',
              blockers: saved?.error?.code ?? '',
              artifacts: [],
            },
          },
        };
      return { text: 'Child inspected the refusal.' };
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
    await app.call('files.save', {
      projectId: project.id,
      path: 'draft.md',
      content: 'Write grant version one',
    });
    const locator = { source: 'project' as const, projectId: project.id, path: 'draft.md' };
    const original = await app.call('resources.describe', { locator });
    await app.call('resources.save', {
      ref: original.ref,
      basis: original.basis,
      content: 'Read-only version two',
    });
    const current = await app.call('resources.describe', { locator });
    expect(current.ref).toEqual(original.ref);
    expect(current.basis).not.toBe(original.basis);
    readable = { ref: current.ref, basis: current.basis };
    work.tools = ['resource.read', 'resource.save'];
    work.workPackage.materials = [readable];
    work.workPackage.outputs = [{ kind: 'save', ref: original.ref, basis: original.basis }];
    const owner = app.projects.get(project.id);
    const save = owner.save.bind(owner);
    let domainWrites = 0;
    owner.save = async (...args) => {
      domainWrites++;
      return save(...args);
    };
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'PARENT_WRITE_VERSION',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const result = await app.call('delegation.get', { ...scope, delegationId: work.delegationId });
    await test.info().attach('write-version-authorization', {
      body: JSON.stringify({ original, current, domainWrites, result }),
      contentType: 'application/json',
    });
    expect(domainWrites).toBe(0);
    expect(await readFile(join(root, 'project', 'draft.md'), 'utf8')).toBe('Read-only version two');
    expect(result).toMatchObject({
      state: 'completed',
      resultState: 'missing',
      writes: [],
      artifacts: [],
      report: { blockers: 'permissionDenied' },
    });
    expect(result.reads).toContainEqual(readable);
    expect(result.childProcessId).toBeGreaterThan(0);
    expect(result.childProcessId).not.toBe(result.parentProcessId);
    await expect(
      app.call('resources.save', {
        ref: original.ref,
        basis: original.basis,
        content: 'Stale write',
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await readFile(join(root, 'project', 'draft.md'), 'utf8')).toBe('Read-only version two');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

for (const unknown of [true, false])
  test(
    unknown
      ? 'an unknown second save cannot publish the previous receipt as a complete delegation'
      : 'a rejected stale save does not prevent a later confirmed result',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-unknown-save-'));
      const work = request('unknown-save', 'CHILD_SAVE', 'unused.md');
      let material: ResourceEvidence;
      const model = await createModelServer({
        respond: ({ user, calls }) => {
          const body = model.requests.at(-1)!;
          if (user.includes('PARENT_SAVE')) {
            if (!calls.includes('delegate_agent'))
              return { tool: { name: 'delegate_agent', input: work } };
            const waited = delegationOutput(body, 'wait_delegation');
            if (!waited || ['accepted', 'running'].includes(waited.delegation.state))
              return {
                tool: {
                  name: 'wait_delegation',
                  input: { delegationId: work.delegationId, waitMs: 5000 },
                },
              };
            return { text: 'Actual outcome inspected.' };
          }
          const saves = calls.filter((name) => name === 'save_delegation_resource').length;
          const saved = delegationOutput(body, 'save_delegation_resource');
          if (!saves)
            return {
              tool: {
                name: 'save_delegation_resource',
                input: { ...material, content: 'Saved version one' },
              },
            };
          if (saves === 1) {
            firstReceipt = saved!.resource;
            return {
              tool: {
                name: 'save_delegation_resource',
                input: {
                  ...(unknown ? { ref: firstReceipt.ref, basis: firstReceipt.basis } : material),
                  content: unknown ? 'Published version two' : 'Rejected stale bytes',
                },
              },
            };
          }
          if (!unknown && saves === 2)
            return {
              tool: {
                name: 'save_delegation_resource',
                input: {
                  ref: firstReceipt.ref,
                  basis: firstReceipt.basis,
                  content: 'Published version two',
                },
              },
            };
          const receipt = unknown ? firstReceipt : saved!.resource;
          if (!calls.includes('report_delegation'))
            return {
              tool: {
                name: 'report_delegation',
                input: {
                  findings: 'Actual receipt inspected',
                  unfinished: '',
                  blockers: '',
                  artifacts: [{ ref: receipt.ref, basis: receipt.basis }],
                },
              },
            };
          return { text: 'Child returned a report.' };
        },
      });
      let firstReceipt!: ResourceDescriptor;
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
        await app.call('files.save', {
          projectId: project.id,
          path: 'draft.md',
          content: 'Original version',
        });
        const descriptor = await app.call('resources.describe', {
          locator: { source: 'project', projectId: project.id, path: 'draft.md' },
        });
        material = { ref: descriptor.ref, basis: descriptor.basis };
        work.tools = ['resource.read', 'resource.save', 'scratch'];
        work.workPackage.materials = [material];
        work.workPackage.outputs = [{ kind: 'save', ref: material.ref, basis: material.basis }];
        const owner = app.projects.get(project.id);
        const save = owner.save.bind(owner);
        owner.save = async (...args) => {
          const result = await save(...args);
          if (unknown && args[0] === 'draft.md' && args[1] === 'Published version two')
            throw new OperationError(
              'outcomeUnknown',
              'Synthetic failure after actual publication',
            );
          return result;
        };
        const session = await app.call('session.create', { projectId: project.id });
        const scope = { projectId: project.id, sessionId: session.id };
        await app.call('session.send', {
          ...scope,
          instructionId: randomUUID(),
          text: 'PARENT_SAVE',
          materials: [],
        });
        await expectExecutionCompleted(app, scope, model);
        const result = await app.call('delegation.get', {
          ...scope,
          delegationId: work.delegationId,
        });
        expect(result).toMatchObject({
          state: 'completed',
          resultState: unknown ? 'unknown' : 'available',
        });
        expect(result.writes.map((item) => item.state)).toEqual([
          'complete',
          unknown ? 'pending' : 'complete',
        ]);
        expect(await readFile(join(root, 'project', 'draft.md'), 'utf8')).toBe(
          'Published version two',
        );
        if (unknown) expect(result.artifacts[0]?.resource.basis).toBe(firstReceipt.basis);
        else {
          expect(result.report?.artifacts[0]?.basis).toBe(result.artifacts[0]?.resource.basis);
          expect(result.artifacts[0]?.resource.basis).not.toBe(firstReceipt.basis);
          expect(JSON.stringify(model.requests)).toContain('contentChanged');
        }
      } finally {
        await app.close();
        await model.close();
        await rm(root, { recursive: true });
      }
    },
  );

test('pending identical identities from different sessions are rejected before acceptance is shared', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-accept-race-'));
  const work = request('shared-identity', 'CHILD_PENDING', 'report.md');
  work.modelProfileId = 'profile';
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      if (!user.includes('PARENT_PENDING')) return { text: 'Child completed without a file.' };
      if (!calls.includes('delegate_agent'))
        return { tool: { name: 'delegate_agent', input: work } };
      return { text: 'Acceptance inspected.' };
    },
  });
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = false;
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('provider.saveProfile', {
      id: 'profile',
      name: 'Profile',
      expectedRevision: 0,
      config: { model: 'MiniMax-M2.7' },
    });
    const resolveProfile = app.modelConfigs.resolveProfile.bind(app.modelConfigs);
    app.modelConfigs.resolveProfile = async (id) => {
      entered = true;
      await gate;
      return resolveProfile(id);
    };
    const a = await app.call('session.create', { projectId: project.id });
    const b = await app.call('session.create', { projectId: project.id });
    const send = (sessionId: string) =>
      app.call('session.send', {
        projectId: project.id,
        sessionId,
        instructionId: randomUUID(),
        text: 'PARENT_PENDING',
        materials: [],
      });
    await send(a.id);
    await expect.poll(() => entered).toBe(true);
    await send(b.id);
    const scopeB = { projectId: project.id, sessionId: b.id };
    await expectExecutionCompleted(app, scopeB, model);
    const messages = (await app.snapshot(scopeB)).messages;
    expect(
      messages.some(
        (item) =>
          item.tool?.name === 'delegate_agent' &&
          item.state === 'error' &&
          item.tool.output?.includes('invalidRequest'),
      ),
    ).toBe(true);
    expect((await app.call('delegation.list', scopeB)).delegations).toEqual([]);
    release();
    await expectExecutionCompleted(app, { projectId: project.id, sessionId: a.id }, model);
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
