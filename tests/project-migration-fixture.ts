import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const Database = createRequire(new URL('../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);
export const grants = JSON.stringify({ trust: 'trusted', autoBackup: false });
export const evidence = {
  ref: { source: 'project' as const, projectId: 'source', fileId: 'result' },
  basis: 'source-basis',
};
export const delegation = {
  id: 'delegation',
  projectId: 'source',
  sessionId: 'session',
  parentRunId: 'parent',
  parentInstanceId: 'parent-instance',
  childInstanceId: 'child',
  request: {
    delegationId: 'delegation',
    roleId: 'role',
    roleVersion: '1',
    tools: ['resource.read'],
    workPackage: {
      objective: 'Read synthetic evidence',
      requirements: 'Preserve references',
      materials: [evidence, { ...evidence, ref: { ...evidence.ref, projectId: 'foreign' } }],
      outputs: [{ kind: 'save', ...evidence }],
    },
  },
  role: {
    id: 'role',
    version: '1',
    guidance: 'Read only synthetic evidence',
    tools: ['resource.read'],
  },
  tools: ['resource.read'],
  modelConfig: { model: 'synthetic-model' },
  state: 'running',
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
  reads: [evidence],
  writes: [{ id: 'write', ...evidence, state: 'complete' }],
  artifacts: [],
  creations: [],
  resultState: 'unknown',
};

export async function fixture(version: 4 | 5) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-composed-migration-'));
  const db = new Database(join(root, 'project.sqlite'));
  for (const name of ['0000_lyrical_network.sql', '0001_project_files.sql'])
    db.exec(
      await readFile(
        new URL(`../apps/kernel/src/storage/migrations/${name}`, import.meta.url),
        'utf8',
      ),
    );
  db.exec(
    'CREATE TABLE harness_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); CREATE TABLE research_attempts (id TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); CREATE TABLE run_instances (id TEXT PRIMARY KEY NOT NULL,run_id TEXT NOT NULL,host_instance_id TEXT NOT NULL,value TEXT NOT NULL); PRAGMA user_version=4;',
  );
  db.prepare('INSERT INTO meta VALUES (?,?)').run('grants', grants);
  if (version === 5) {
    // Published input to the proposed chain is exactly the handed-off delegation v5 shape.
    db.exec(
      'CREATE TABLE delegations (seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,id TEXT NOT NULL UNIQUE,session_id TEXT NOT NULL,parent_run_id TEXT NOT NULL,child_instance_id TEXT NOT NULL UNIQUE,value TEXT NOT NULL); CREATE INDEX delegations_session ON delegations(session_id,seq); CREATE INDEX delegations_parent ON delegations(parent_run_id); PRAGMA user_version=5;',
    );
    db.prepare(
      'INSERT INTO delegations(id,session_id,parent_run_id,child_instance_id,value) VALUES (?,?,?,?,?)',
    ).run('delegation', 'session', 'parent', 'child', JSON.stringify(delegation));
  }
  return {
    root,
    db,
    async close() {
      db.close();
      await rm(root, { recursive: true });
    },
  };
}
