import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type {
  CallContext,
  DelegationRequest,
  ResourceEvidence,
} from '../../packages/protocol/dist/index.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { reportFixture } from '../fixtures/report.js';
import { createModelServer } from '../model-server.js';

type ReportFixture = Awaited<ReturnType<typeof reportFixture>>;

function reportEvidence(fixture: ReportFixture): ResourceEvidence[] {
  return [fixture.entry, ...fixture.manifest.resources, ...fixture.manifest.sources].map(
    ({ ref, basis }) => ({ ref, basis }),
  );
}

function isChildRequest(body: Record<string, unknown>): boolean {
  return (
    Array.isArray(body.tools) &&
    body.tools.some((tool: { name: string }) => tool.name === 'report_delegation')
  );
}

async function scenario() {
  const root = test.info().outputPath('delegated-report');
  await mkdir(root, { recursive: true });
  let fixture: ReportFixture;
  const work: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.describe', 'resource.read'],
    workPackage: {
      objective: 'CHILD_REPORT Read only the declared report.',
      requirements: 'Check the actual HTML and report findings without creating files.',
      materials: [],
      outputs: [],
    },
  };
  let checkedHtml = false;
  // Only the external model is controlled; all identities, evidence and tool results are real.
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      const body = model.requests.at(-1);
      assert(body);
      if (user.includes('PARENT_REPORT')) {
        if (!calls.includes('delegate_agent'))
          return { tool: { name: 'delegate_agent', input: work } };
        if (delegationOutput(body, 'delegate_agent')?.error)
          return { text: 'Delegation was refused.' };
        const waited = delegationOutput(body, 'wait_delegation');
        if (!waited || ['accepted', 'running', 'cancelling'].includes(waited.delegation?.state))
          return {
            tool: {
              name: 'wait_delegation',
              input: { delegationId: work.delegationId, waitMs: 5000 },
            },
          };
        return { text: 'Parent checked the actual delegation outcome.' };
      }
      assert(user.includes('CHILD_REPORT'));
      if (!calls.includes('read_context_resource'))
        return {
          tool: {
            name: 'read_context_resource',
            input: { ref: fixture.entry.ref, basis: fixture.entry.basis, encoding: 'utf8' },
          },
        };
      const read = delegationOutput(body, 'read_context_resource');
      assert.equal(read?.data, fixture.html);
      checkedHtml = true;
      if (!calls.includes('report_delegation'))
        return {
          tool: {
            name: 'report_delegation',
            input: {
              findings: 'Read the fixed dose comparison HTML.',
              unfinished: '',
              blockers: '',
              artifacts: [],
            },
          },
        };
      return { text: 'Child checked the report.' };
    },
  });
  const profile = join(root, 'profile');
  const settings = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  const app = new KernelApplication(profile, settings);
  try {
    await app.initialize();
    fixture = await reportFixture(app, root);
    work.workPackage.materials = reportEvidence(fixture);
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const session = await app.call('session.create', { projectId: fixture.project.id });
    const scope = { projectId: fixture.project.id, sessionId: session.id };
    return {
      app,
      model,
      fixture,
      work,
      profile,
      settings,
      scope,
      childRequests: () => model.requests.filter(isChildRequest),
      checkedHtml: () => checkedHtml,
      start: () =>
        app.call('session.send', {
          ...scope,
          instructionId: randomUUID(),
          text: 'PARENT_REPORT Delegate the explicitly authorized report.',
          materials: [],
        }),
      result: () => app.call('delegation.get', { ...scope, delegationId: work.delegationId }),
    };
  } catch (error) {
    model.release();
    await app.close();
    await model.close();
    throw error;
  }
}

type Scenario = Awaited<ReturnType<typeof scenario>>;

function observeChildReport(f: Scenario, observed: (context: CallContext) => void) {
  const record = f.app.harness.recordReportUse.bind(f.app.harness);
  let used = false;
  f.app.harness.recordReportUse = (context, evidence) => {
    record(context, evidence);
    if (context.role !== 'execution') return;
    const facts = f.app.harness.executionFacts(context);
    if (
      !used &&
      facts.state === 'verified' &&
      facts.delegation.state === 'verified' &&
      facts.delegation.delegationId === f.work.delegationId &&
      f.childRequests().length === 1
    ) {
      expect(evidence).toEqual(expect.arrayContaining(reportEvidence(f.fixture)));
      expect(evidence).toHaveLength(reportEvidence(f.fixture).length);
      used = true;
      observed(context);
    }
  };
}

test('a real child reads an authorized report without claiming its sources were read in full', async () => {
  const f = await scenario();
  let childContext: CallContext | undefined;
  observeChildReport(f, (context) => {
    childContext = context;
  });
  try {
    await f.start();
    await expectExecutionCompleted(f.app, f.scope, f.model);
    const result = await f.result();
    expect(result).toMatchObject({
      state: 'completed',
      resultState: 'available',
      reads: [{ ref: f.fixture.entry.ref, basis: f.fixture.entry.basis }],
      artifacts: [],
      report: { unfinished: '', blockers: '', artifacts: [] },
    });
    expect(result.reads).toHaveLength(1);
    expect(f.checkedHtml()).toBe(true);
    expect(f.childRequests().length).toBeGreaterThan(1);
    assert(childContext);
    expect(childContext.instanceId).toBe(result.childInstanceId);
    expect(result.childInstanceId).not.toBe(result.parentInstanceId);
    expect(result.childProcessId).toBeGreaterThan(0);
    expect(result.parentProcessId).toBeGreaterThan(0);
    expect(result.childProcessId).not.toBe(result.parentProcessId);
    await test.info().attach('authorized-delegated-report', {
      body: JSON.stringify({ evidence: reportEvidence(f.fixture), result }),
      contentType: 'application/json',
    });
  } finally {
    f.model.release();
    await f.app.close();
    await f.model.close();
  }
});

for (const denied of [
  'missing-library-source',
  'missing-project-dependency',
  'old-basis',
] as const) {
  test(`a report with ${denied} is refused before any child model request`, async () => {
    const f = await scenario();
    let refusalCode: unknown;
    const expandedReads: ResourceEvidence[] = [];
    const read = f.app.resources.read.bind(f.app.resources);
    f.app.resources.read = async (input, context) => {
      if (context.role === 'execution') {
        const facts = f.app.harness.executionFacts(context);
        if (
          facts.state === 'verified' &&
          facts.delegation.state === 'verified' &&
          facts.delegation.delegationId === f.work.delegationId &&
          !isDeepStrictEqual(input.ref, f.fixture.entry.ref)
        )
          expandedReads.push({ ref: input.ref, basis: input.basis });
      }
      return read(input, context);
    };
    const check = f.app.harness.checkReportContext.bind(f.app.harness);
    f.app.harness.checkReportContext = (context, evidence) => {
      try {
        return check(context, evidence);
      } catch (error) {
        refusalCode = (error as { code?: unknown }).code;
        throw error;
      }
    };
    try {
      const dependency = f.fixture.manifest.resources[0];
      assert(dependency);
      if (denied === 'old-basis') {
        const current = await f.app.call('resources.save', {
          ref: dependency.ref,
          basis: dependency.basis,
          content: '[30,40]',
        });
        expect(current.ref).toEqual(dependency.ref);
        expect(current.basis).not.toBe(dependency.basis);
        const manifest = {
          ...f.fixture.manifest,
          resources: [{ ...dependency, basis: current.basis }],
        };
        // Independent wire sample, using only genuine D1/D2 resource receipts.
        const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Fixed dose comparison</body></html>`;
        f.fixture.entry = await f.app.call('resources.save', {
          ref: f.fixture.entry.ref,
          basis: f.fixture.entry.basis,
          content: html,
        });
        f.fixture.html = html;
        f.fixture.manifest = manifest;
        f.work.workPackage.materials = [
          { ref: f.fixture.entry.ref, basis: f.fixture.entry.basis },
          { ref: dependency.ref, basis: dependency.basis },
          ...manifest.sources,
        ];
      } else {
        f.work.workPackage.materials = (
          denied === 'missing-library-source'
            ? [f.fixture.entry, ...f.fixture.manifest.resources]
            : [f.fixture.entry, ...f.fixture.manifest.sources]
        ).map(({ ref, basis }) => ({ ref, basis }));
      }
      // The parent still has genuine domain authority over the complete, current report.
      expect(
        (
          await f.app.call('resources.report', {
            ref: f.fixture.entry.ref,
            basis: f.fixture.entry.basis,
          })
        ).manifest,
      ).toEqual(f.fixture.manifest);
      await f.start();
      await expectExecutionCompleted(f.app, f.scope, f.model);
      const result = await f.result();
      expect(result).toMatchObject({ state: 'failed', reads: [], artifacts: [] });
      expect(result.error).toBeTruthy();
      expect(refusalCode).toBe('permissionDenied');
      expect(f.childRequests()).toHaveLength(0);
      expect(f.checkedHtml()).toBe(false);
      expect(expandedReads).toEqual([]);
      await test.info().attach('refused-delegated-report', {
        body: JSON.stringify({
          declared: reportEvidence(f.fixture),
          work: f.work,
          refusalCode,
          result,
        }),
        contentType: 'application/json',
      });
    } finally {
      f.model.release();
      await f.app.close();
      await f.model.close();
    }
  });
}

for (const boundary of ['queue', 'final'] as const) {
  test(`child report sources survive ${boundary} admission and restart`, async () => {
    const f = await scenario();
    let app = f.app;
    const blocker = await app.models.execution();
    let used = false;
    let queued = false;
    let confirmed = false;
    let confirming = false;
    let finalEvidenceChecked = false;
    let admissionRefusal: unknown;
    let resumeParent!: () => void;
    const parentGate = new Promise<void>((resolve) => {
      resumeParent = resolve;
    });
    let held: Promise<string> | undefined;
    let lease: string | undefined;
    observeChildReport(f, () => {
      used = true;
      if (boundary === 'queue')
        held = blocker.acquire().then((value) => {
          lease = value;
          return value;
        });
    });
    const execution = app.models.execution.bind(app.models);
    const check = app.harness.checkReportContext.bind(app.harness);
    app.harness.checkReportContext = (context, evidence) => {
      const facts = check(context, evidence);
      if (
        confirming &&
        facts.delegation.state === 'verified' &&
        facts.delegation.delegationId === f.work.delegationId
      ) {
        expect(evidence).toEqual(expect.arrayContaining(reportEvidence(f.fixture)));
        expect(evidence).toHaveLength(reportEvidence(f.fixture).length);
        finalEvidenceChecked = true;
      }
      return facts;
    };
    app.models.execution = async (authorize, signal, config, final, budget) => {
      // Only this fixture's child receives the parent's shared model budget explicitly.
      if (budget === undefined) {
        const parent = await execution(authorize, signal, config, final, budget);
        return {
          ...parent,
          acquire: async () => {
            // Pause only the next external parent request, so it cannot cancel the queued child first.
            if (f.model.requests.some((body) => !isChildRequest(body))) await parentGate;
            return parent.acquire();
          },
        };
      }
      const value = await execution(
        async () => {
          try {
            await authorize?.();
          } catch (error) {
            if (used && queued) admissionRefusal = (error as { code?: unknown }).code;
            throw error;
          }
          if (used && boundary === 'queue' && !queued) {
            assert(lease);
            // The occupied lease makes acquireSlot wait after this successful authorization.
            setImmediate(() => {
              queued = true;
            });
          }
        },
        signal,
        config,
        () => {
          if (used && boundary === 'final') {
            confirmed = true;
            app.library.grant({ read: true, write: true, send: false, autoBackup: false });
          }
          confirming = true;
          finalEvidenceChecked = false;
          try {
            final?.();
          } catch (error) {
            if (used && boundary === 'final') admissionRefusal = (error as { code?: unknown }).code;
            throw error;
          } finally {
            confirming = false;
          }
        },
        budget,
      );
      return {
        ...value,
        acquire: async () => {
          if (used && boundary === 'queue') {
            await held;
          }
          return value.acquire();
        },
      };
    };
    try {
      await f.start();
      if (boundary === 'queue') {
        await expect.poll(() => queued, { timeout: 20000 }).toBe(true);
        await app.call('library.grant', {
          read: true,
          write: true,
          send: false,
          autoBackup: false,
        });
        assert(lease);
        blocker.release(lease);
        lease = undefined;
      } else await expect.poll(() => confirmed, { timeout: 20000 }).toBe(true);
      await expect.poll(() => admissionRefusal, { timeout: 20000 }).toBe('permissionDenied');
      await expect.poll(async () => (await f.result()).state, { timeout: 20000 }).toBe('failed');
      resumeParent();
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(used).toBe(true);
      if (boundary === 'final') expect(confirmed).toBe(true);
      expect(finalEvidenceChecked).toBe(true);
      expect(f.childRequests()).toHaveLength(1);
      const before = await f.result();
      expect(before.reads).toEqual([{ ref: f.fixture.entry.ref, basis: f.fixture.entry.basis }]);
      const count = f.model.requests.length;
      await app.close();
      app = new KernelApplication(f.profile, f.settings);
      await app.initialize();
      expect(
        await app.call('delegation.get', { ...f.scope, delegationId: f.work.delegationId }),
      ).toEqual(before);
      expect(f.model.requests).toHaveLength(count);
      await app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: 'Continue after restart with the previously used report.',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(f.model.requests).toHaveLength(count);
      await test.info().attach('delegated-report-admission', {
        body: JSON.stringify({
          boundary,
          used,
          queued,
          confirmed,
          finalEvidenceChecked,
          admissionRefusal,
          before,
          modelRequests: count,
        }),
        contentType: 'application/json',
      });
    } finally {
      resumeParent();
      if (lease) blocker.release(lease);
      f.model.release();
      await app.close();
      await f.model.close();
    }
  });
}

test('a cancelled report delegation cannot reuse its actual execution resource context', async () => {
  const f = await scenario();
  let childContext: CallContext | undefined;
  observeChildReport(f, (context) => {
    childContext = context;
    // Hold the next external response after the real report read, not model admission.
    f.model.hold = true;
  });
  try {
    await f.start();
    await expect.poll(() => f.childRequests().length, { timeout: 20000 }).toBe(2);
    assert(childContext);
    const oldContext = childContext;
    const resources = f.app.executionResources(oldContext);
    await f.app.call('delegation.cancel', { ...f.scope, delegationId: f.work.delegationId });
    f.model.release();
    await expect.poll(async () => (await f.result()).state, { timeout: 20000 }).toBe('cancelled');
    expect(oldContext.signal?.aborted).toBe(true);
    await expect(async () =>
      resources.read({ ref: f.fixture.entry.ref, basis: f.fixture.entry.basis, encoding: 'utf8' }),
    ).rejects.toBe(oldContext.signal?.reason);
    await expect(async () =>
      f.app
        .executionResources(oldContext)
        .read({ ref: f.fixture.entry.ref, basis: f.fixture.entry.basis, encoding: 'utf8' }),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
    await expectExecutionCompleted(f.app, f.scope, f.model);
    expect((await f.result()).reads).toEqual([
      { ref: f.fixture.entry.ref, basis: f.fixture.entry.basis },
    ]);
  } finally {
    f.model.release();
    await f.app.close();
    await f.model.close();
  }
});
