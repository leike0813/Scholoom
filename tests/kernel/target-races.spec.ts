import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import { createModelServer } from '../model-server.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class ObservedApplication extends KernelApplication {
  context: CallContext | undefined;
  override projectTargetRead(context: CallContext) {
    this.context = context;
    return super.projectTargetRead(context);
  }
}

for (const race of [
  'queued-revocation',
  'in-flight-revocation',
  'changed-content',
  'cancelled-instance',
] as const) {
  test(`target delivery rejects ${race} in a real running application session`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-target-race-'));
    const model = await createModelServer();
    model.hold = true;
    const app = new ObservedApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const entered = deferred(),
      release = deferred();
    let blocker: Promise<unknown> | undefined;
    try {
      await app.initialize();
      const target = await app.projects.create(join(root, 'target'));
      target.grant({ trust: 'trusted', autoBackup: false });
      const saved = await target.save('input.md', 'retained evidence');
      const initial = await target.material('input.md');
      const session = await app.call('session.create', { projectId: 'application' });
      const scope = { projectId: 'application', sessionId: session.id };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Hold this synthetic turn.',
        materials: [],
      });
      await expect.poll(() => model.requests.length).toBe(1);
      const context = app.context;
      if (!context) throw new Error('Expected host-bound running context');
      const port = app.executionResources(context);
      if (!saved.fileId) throw new Error('Expected registered file');
      const resource = await port.describe({
        source: 'project',
        projectId: target.project.id,
        fileId: saved.fileId,
      });
      if (race === 'queued-revocation') {
        blocker = target.files.coordinate([join(target.project.path, 'input.md')], async () => {
          entered.resolve();
          await release.promise;
        });
        await entered.promise;
      } else {
        const path = target.path.bind(target);
        let held = false;
        target.path = async (...args) => {
          const result = await path(...args);
          if (!held) {
            held = true;
            entered.resolve();
            await release.promise;
          }
          return result;
        };
      }
      const reading = port.read({ ref: resource.ref, basis: initial.basis, encoding: 'utf8' });
      const rejected = expect(reading).rejects.toMatchObject({
        code:
          race === 'changed-content'
            ? 'contentChanged'
            : race === 'cancelled-instance'
              ? 'instanceMismatch'
              : 'permissionDenied',
      });
      if (race !== 'queued-revocation') await entered.promise;
      if (race === 'cancelled-instance') await app.call('session.cancel', scope);
      else if (race === 'changed-content')
        await writeFile(join(target.project.path, 'input.md'), 'new independent evidence');
      else target.grant({ trust: 'restricted', autoBackup: false });
      release.resolve();
      await rejected;
      if (race === 'cancelled-instance')
        await expect(
          port.read({ ref: resource.ref, basis: initial.basis, encoding: 'utf8' }),
        ).rejects.toBeDefined();
      expect(await readFile(join(target.project.path, 'input.md'), 'utf8')).toBe(
        race === 'changed-content' ? 'new independent evidence' : 'retained evidence',
      );
      expect(target.files.location(saved.fileId ?? '')).toMatchObject({
        state: 'present',
        path: 'input.md',
      });
      expect(app.harness.getSession('application', session.id).projectId).toBe('application');
    } finally {
      release.resolve();
      await blocker;
      model.release();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
