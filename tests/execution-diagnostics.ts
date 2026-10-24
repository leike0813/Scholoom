import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { KernelApplication } from '../apps/kernel/dist/application.js';
import type { RunInstance } from '../packages/harness/dist/node.js';
import type { ModelServer } from './model-server.js';

const Database = createRequire(new URL('../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

/** Keep failure evidence before the owning test closes its isolated application. */
export async function expectExecutionCompleted(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  model: ModelServer,
): Promise<void> {
  const started = performance.now();
  const samples: unknown[] = [];
  let failed = false;
  try {
    await expect
      .poll(async () => {
        const snapshot = await app.snapshot(scope);
        samples.push({
          elapsedMs: Math.round(performance.now() - started),
          run: snapshot.run,
          modelRequests: model.requests.length,
          tools: snapshot.messages
            .filter((message) => message.role === 'tool')
            .map((message) => ({ id: message.id, name: message.tool?.name, state: message.state })),
        });
        return snapshot.run?.state;
      })
      .toBe('completed');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (failed || process.env.SCHOOLOOM_EXECUTION_DIAGNOSTICS === '1') {
      const database = new Database(
        join(app.projects.get(scope.projectId).internal, 'project.sqlite'),
        { readonly: true, fileMustExist: true, timeout: 2_000 },
      );
      try {
        const rows = database
          .prepare(
            'SELECT i.value FROM run_instances i JOIN runs r ON r.id=i.run_id WHERE r.sessionId=? LIMIT 100',
          )
          .all(scope.sessionId) as { value: string }[];
        const instances = rows.map(({ value }) => {
          const { instanceId, runId, processId, state } = JSON.parse(value) as RunInstance;
          return { instanceId, runId, processId, state };
        });
        await test.info().attach('execution-stages', {
          body: JSON.stringify({ platform: process.platform, ...scope, samples, instances }),
          contentType: 'application/json',
        });
      } finally {
        database.close();
      }
    }
  }
}
