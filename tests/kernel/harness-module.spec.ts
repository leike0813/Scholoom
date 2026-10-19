import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  Harness,
  type HarnessProject,
  HarnessRecords,
  type HarnessStorage,
} from '../../packages/harness/dist/node.js';
import type { ModelAccess } from '../../packages/models/dist/execution.js';
import { factoryDefaults } from '../../packages/models/dist/index.js';
import type { HarnessProjectPort } from '../../packages/protocol/dist/projects.js';

const Database = createRequire(new URL('../../packages/harness/package.json', import.meta.url))(
  'better-sqlite3',
);

test('harness owns its sessions through native storage and narrow replaceable ports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-harness-module-'));
  const internal = join(root, 'harness');
  const projectId = 'owned-project';
  await mkdir(internal);
  const database = new Database(join(internal, 'project.sqlite'));
  database.exec(`
    CREATE TABLE harness_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      id TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      value TEXT NOT NULL
    );
    CREATE UNIQUE INDEX messages_id_unique ON messages (id);
    CREATE TABLE instructions (
      seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      id TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      runId TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX instructions_id_unique ON instructions (id);
    CREATE TABLE runs (id TEXT PRIMARY KEY NOT NULL, sessionId TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE run_instances (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      host_instance_id TEXT NOT NULL,
      value TEXT NOT NULL
    );
  `);
  database.close();

  const storage = (): HarnessStorage => {
    const project: HarnessProject = {
      id: projectId,
      internal,
      records: new HarnessRecords(internal),
    };
    return {
      get: (id) => {
        if (id !== projectId) throw new Error(`unexpected project: ${id}`);
        return project;
      },
      all: () => [project],
      touch: () => {},
    };
  };
  const project = {
    id: projectId,
    path: join(root, 'project'),
    name: 'Owned project',
    read: true,
    write: true,
    send: true,
    autoBackup: false,
    recent: true,
  };
  const artifact = {
    path: 'report.md',
    fileId: 'report-file',
    runId: 'report-run',
    state: 'linked' as const,
  };
  const unusedProject = async (): Promise<never> => {
    throw new Error('project action not expected');
  };
  const projectPort: HarnessProjectPort = {
    'projects.list': async () => [project],
    'project.artifacts': async () => [artifact],
    'files.resolve': async () => [
      { fileId: 'report-file', path: 'report.md', kind: 'file', state: 'present' },
    ],
    'project.check': unusedProject,
    'project.path': unusedProject,
    'project.material': unusedProject,
    'project.linkArtifact': unusedProject,
    'files.read': unusedProject,
    'files.operation': unusedProject,
    'files.mkdir': unusedProject,
    'files.rename': unusedProject,
    'files.trash': unusedProject,
    'files.restore': unusedProject,
    'files.trashList': unusedProject,
  };
  const unexpectedCalls: string[] = [];
  const unexpected = (name: string) => () => {
    unexpectedCalls.push(name);
    throw new Error(`${name} port not expected`);
  };
  let modelCalls = 0;
  const unusedModel = async (): Promise<never> => {
    modelCalls++;
    throw new Error('model port not expected');
  };
  const model = {
    execution: unusedModel,
    credentials: { get: unusedModel, status: unusedModel },
  } satisfies Pick<ModelAccess, 'execution' | 'credentials'>;
  let notifications = 0;
  const createHarness = (native: HarnessStorage) =>
    new Harness(
      native,
      model,
      { load: async () => ({ ...factoryDefaults }) },
      unexpected('research'),
      unexpected('library'),
      () => notifications++,
      () => projectPort,
      unexpected('project files'),
      unexpected('research progress'),
    );
  let harness = createHarness(storage());
  try {
    await harness.initialize();
    const first = harness.create(projectId, 'Draft session');
    const second = harness.create(projectId, 'Archive session');
    expect(first).toMatchObject({ title: 'Draft session', titleSource: 'manual' });
    expect(harness.rename(projectId, first.id, 'Alpha notes')).toMatchObject({
      id: first.id,
      title: 'Alpha notes',
      titleSource: 'manual',
    });
    expect(harness.archive(projectId, second.id, true)).toMatchObject({
      id: second.id,
      archived: true,
    });
    expect(harness.list({ projectId }).sessions.map((session) => session.id)).toEqual([first.id]);
    expect(
      harness.list({ projectId, query: 'Alpha' }).sessions.map((session) => session.id),
    ).toEqual([first.id]);
    expect(
      harness.list({ projectId, archived: true }).sessions.map((session) => session.id),
    ).toEqual([second.id]);
    expect((await harness.search({ query: 'Alpha' })).results).toEqual([
      {
        project: expect.objectContaining({ id: projectId, recent: true }),
        session: expect.objectContaining({ id: first.id, title: 'Alpha notes' }),
      },
    ]);
    expect(await harness.snapshot(projectId, first.id)).toEqual(
      expect.objectContaining({
        session: expect.objectContaining({ id: first.id, title: 'Alpha notes' }),
        sessions: [expect.objectContaining({ id: first.id })],
        artifacts: [
          expect.objectContaining({
            ...artifact,
            location: expect.objectContaining({
              fileId: 'report-file',
              state: 'present',
            }),
          }),
        ],
      }),
    );

    await harness.close();
    harness = createHarness(storage());
    await harness.initialize();
    expect(harness.getSession(projectId, first.id)).toMatchObject({
      title: 'Alpha notes',
    });
    expect(harness.getSession(projectId, second.id).archived).toBe(true);
    expect(harness.list({ projectId }).sessions.map((session) => session.id)).toEqual([first.id]);
    expect(
      harness.list({ projectId, archived: true }).sessions.map((session) => session.id),
    ).toEqual([second.id]);
    expect((await harness.search({ query: 'Alpha' })).results).toHaveLength(1);
    expect((await harness.snapshot(projectId, first.id)).session?.title).toBe('Alpha notes');
    expect(notifications).toBeGreaterThan(0);
    expect(modelCalls).toBe(0);
    expect(unexpectedCalls).toEqual([]);
  } finally {
    await harness.close();
    await rm(root, { recursive: true });
  }
});
