import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ResearchRecords } from '../../packages/research/dist/node.js';
import { createModelServer } from '../model-server.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);
for (const { legacy, failRestore } of [
  { legacy: false, failRestore: false },
  { legacy: true, failRestore: false },
  { legacy: true, failRestore: true },
]) {
  test(`restoring a mixed project copy preserves source work and module records (v2=${legacy}, module failure=${failRestore})`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-project-recovery-'));
    const model = await createModelServer();
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const restore = ResearchRecords.prototype.restore;
    try {
      await app.initialize();
      const project = await app.projects.create(join(root, 'project'));
      project.grant({ trust: 'trusted', autoBackup: false });
      const input = await project.save('input.md', 'original evidence 42');
      const report = await project.save('report.md', 'saved report 42');
      if (!input.fileId || !report.fileId) throw new Error('Expected persisted file identities');
      const trash = await project.save('discarded.md', 'retained recovery bytes');
      await project.files.mutate('trash', 'old-trash', { path: trash.path });
      const archived = app.harness.create(project.project.id, 'archived');
      app.harness.archive(project.project.id, archived.id, true);
      const session = app.harness.create(project.project.id, 'unfinished');
      const runId = 'legacy-run';
      project.linkArtifact(session.id, {
        path: report.path,
        fileId: report.fileId,
        runId,
        state: 'linked',
      });
      // A fixed persisted sample models a backup taken while the old host was executing.
      project.database
        .prepare('INSERT INTO runs(id,sessionId,value) VALUES(?,?,?)')
        .run(
          runId,
          session.id,
          JSON.stringify({ id: runId, sessionId: session.id, attempt: 1, state: 'running' }),
        );
      project.database
        .prepare("UPDATE sessions SET value=json_set(value,'$.state','running') WHERE id=?")
        .run(session.id);
      project.database
        .prepare('INSERT INTO run_instances(id,run_id,host_instance_id,value) VALUES(?,?,?,?)')
        .run(
          'old-instance',
          runId,
          'old-host',
          JSON.stringify({
            instanceId: 'old-instance',
            hostInstanceId: 'old-host',
            runId,
            state: 'running',
            processId: 999999,
          }),
        );
      const method = (await app.research.content.discover())[0];
      if (!method) throw new Error('Expected the installed research method');
      const attempt = {
        id: 'old-research',
        invocationId: 'old-invocation',
        attempt: 1,
        sessionId: session.id,
        runId,
        method,
        input: {
          goal: 'preserve original evidence',
          materialPaths: ['input.md'],
          outputPath: 'report.md',
        },
        state: 'running',
        sources: [{ path: input.path, fileId: input.fileId }],
        used: [{ path: input.path, fileId: input.fileId }],
        artifacts: [{ path: report.path, fileId: report.fileId }],
        reportFileId: report.fileId,
        delivery: 'pending',
        issues: [],
        researchAssessment: 'notAssessed',
        createdAt: '2026-10-01T00:00:00Z',
      };
      project.database
        .prepare('INSERT INTO research_attempts(id,value) VALUES(?,?)')
        .run(attempt.id, JSON.stringify(attempt));
      const backup = await project.backup();
      if (legacy) {
        const old = new Database(
          join(project.internal, 'backups', backup.id, '.scholoom', 'project.sqlite'),
        );
        try {
          old.exec(
            "INSERT INTO meta SELECT 'research-attempt:' || id,value FROM research_attempts; DROP TABLE research_attempts; DROP TABLE harness_meta; DROP TABLE run_instances; DROP TABLE delegations; PRAGMA user_version=2;",
          );
        } finally {
          old.close();
        }
      }
      await project.save('after-backup.md', 'later source work');
      if (failRestore)
        ResearchRecords.prototype.restore = () => {
          throw new Error('synthetic research restore failure');
        };
      const destination = join(root, 'restored');
      const operation = app.call('project.restore', {
        projectId: project.project.id,
        backupId: backup.id,
        destination,
      });
      if (failRestore) {
        await expect(operation).rejects.toThrow('synthetic research restore failure');
        expect(await readFile(join(destination, 'report.md'), 'utf8')).toBe('saved report 42');
        expect(app.projects.list().some((copy) => copy.path === destination)).toBe(false);
      } else {
        const copy = await operation;
        expect(copy.id).not.toBe(project.project.id);
        expect(copy).toMatchObject({ trust: 'pending' });
        expect(app.harness.getSession(copy.id, archived.id)).toMatchObject({
          projectId: copy.id,
          archived: true,
        });
        expect(app.harness.getSession(copy.id, session.id)).toMatchObject({
          projectId: copy.id,
          state: 'interrupted',
        });
        const snapshot = await app.snapshot({ projectId: copy.id, sessionId: session.id });
        expect(snapshot.run).toMatchObject({
          id: runId,
          state: 'interrupted',
          remoteOutcome: 'unknown',
        });
        expect(snapshot.artifacts).toContainEqual(
          expect.objectContaining({ fileId: report.fileId, runId }),
        );
        const restored = app.projects.get(copy.id);
        if (legacy) {
          expect(restored.database.pragma('user_version', { simple: true })).toBe(5);
          const protectedSource = new Database(
            join(destination, '.scholoom', 'before-migration-v3.sqlite'),
            { readonly: true },
          );
          try {
            expect(protectedSource.pragma('user_version', { simple: true })).toBe(2);
          } finally {
            protectedSource.close();
          }
          expect(restored.database.prepare('SELECT id FROM run_instances').all()).toEqual([]);
        } else {
          expect(
            JSON.parse(
              (
                restored.database
                  .prepare('SELECT value FROM run_instances WHERE id=?')
                  .get('old-instance') as { value: string }
              ).value,
            ).state,
          ).toBe('exited');
        }
        const research = (
          await app.research.list({ projectId: restored.project.id, sessionId: session.id })
        ).attempts[0];
        expect(research).toMatchObject({
          id: attempt.id,
          invocationId: attempt.invocationId,
          state: 'interrupted',
          delivery: 'incomplete',
          reportFileId: report.fileId,
          used: attempt.used,
          artifacts: attempt.artifacts,
        });
        await expect(
          app.call('files.read', { projectId: copy.id, path: 'report.md' }),
        ).resolves.toMatchObject({ content: 'saved report 42' });
        restored.grant({ trust: 'restricted', autoBackup: false });
        await restored.files.mutate('restore', 'restore-trash-in-copy', {
          trashId: 'old-trash',
          destination: 'recovered.md',
        });
        expect(await readFile(join(destination, 'recovered.md'), 'utf8')).toBe(
          'retained recovery bytes',
        );
        await expect(readFile(join(destination, 'after-backup.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      }
      expect(await readFile(join(root, 'project', 'after-backup.md'), 'utf8')).toBe(
        'later source work',
      );
      expect(await readFile(join(root, 'project', 'report.md'), 'utf8')).toBe('saved report 42');
      expect(app.harness.getSession(project.project.id, archived.id).projectId).toBe(
        project.project.id,
      );
      expect(model.requests).toHaveLength(0);
    } finally {
      ResearchRecords.prototype.restore = restore;
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
