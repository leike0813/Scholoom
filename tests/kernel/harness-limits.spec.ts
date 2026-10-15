import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

test('long history stays scoped, bounded and fully pageable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-history-'));
  const app = new KernelApplication(root, { environment: {} });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const other = app.harness.create('application');
    const store = app.projects.get('application');
    const insert = store.database.prepare(
      'INSERT INTO messages (id, sessionId, value) VALUES (?, ?, ?)',
    );
    store.database.transaction(() => {
      for (let index = 0; index < 1200; index++) {
        const id = `history-${index}`;
        insert.run(
          id,
          session.id,
          JSON.stringify({
            id,
            sessionId: session.id,
            role: 'assistant',
            text: '样本'.repeat(500),
            state: 'complete',
            materials: [],
            createdAt: new Date().toISOString(),
          }),
        );
        insert.run(
          `other-${index}`,
          other.id,
          JSON.stringify({
            id: `other-${index}`,
            sessionId: other.id,
            role: 'assistant',
            text: 'other',
            state: 'complete',
            materials: [],
            createdAt: new Date().toISOString(),
          }),
        );
      }
    })();
    const ids: string[] = [];
    let before: string | undefined;
    const start = performance.now();
    do {
      const page = await app.snapshot({
        projectId: 'application',
        sessionId: session.id,
        ...(before ? { before } : {}),
        limit: 50,
      });
      expect(page.messages.length).toBeLessThanOrEqual(50);
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(2 * 1024 * 1024);
      expect(page.messages.every((message) => message.sessionId === session.id)).toBe(true);
      ids.push(...page.messages.map((message) => message.id));
      before = page.nextBefore;
    } while (before);
    expect(ids).toHaveLength(1200);
    expect(new Set(ids).size).toBe(1200);
    test.info().annotations.push({
      type: 'measurement',
      description: `2400 stored messages; 1200 paged in ${Math.round(performance.now() - start)} ms`,
    });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('sustained streaming remains observable and can be cancelled without losing its prefix', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-stream-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    modelEndpoint: model.url,
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_STREAM',
      materials: [],
    });
    const snapshot = () => app.snapshot({ projectId: 'application', sessionId: session.id });
    await expect
      .poll(
        async () =>
          (await snapshot()).messages.find((message) => message.role === 'assistant')?.text
            .length ?? 0,
      )
      .toBeGreaterThan(500);
    const during = await snapshot();
    expect(during.run?.state).toBe('running');
    const prefix = during.messages.find((message) => message.role === 'assistant')?.text ?? '';
    const start = performance.now();
    expect(app.harness.create('application').id).toBeTruthy();
    app.harness.cancel('application', session.id);
    await expect.poll(async () => (await snapshot()).run?.state).toBe('cancelled');
    const after = await snapshot();
    expect(after.messages.find((message) => message.role === 'assistant')?.text).toContain(prefix);
    test.info().annotations.push({
      type: 'measurement',
      description: `stream cancel settled in ${Math.round(performance.now() - start)} ms`,
    });
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
