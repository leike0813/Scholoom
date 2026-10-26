import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import { HarnessRecords } from '../../packages/harness/dist/records.js';
import { ProgramRecords } from '../../packages/programs/dist/node.js';
import { Database, delegation, evidence, fixture, grants } from '../project-migration-fixture.js';

test('the actual Agent restore and programs restore independently rebind a database copy', async () => {
  const f = await fixture(5);
  try {
    await initializeProjectContainer(f.db, f.root);
    const source = new ProgramRecords(f.root);
    try {
      source.put({
        run: {
          programRunId: 'program',
          projectId: 'source',
          operationId: 'operation',
          kind: 'program',
          state: 'running',
          phase: 'executing',
          stop: 'pending',
          createdAt: 'date',
          updatedAt: 'date',
          code: evidence,
          inputs: [evidence],
        },
        entries: [],
        commandInstanceId: 'original-command',
        hostInstanceId: 'original-host',
      });
    } finally {
      source.close();
    }
    const destination = join(f.root, 'copy');
    await mkdir(destination);
    await f.db.backup(join(destination, 'project.sqlite'));
    const agent = new HarnessRecords(destination);
    const programs = new ProgramRecords(destination);
    try {
      agent.restore('copy');
      programs.restore('copy');
      const record = programs.get('program');
      expect(record.run).toMatchObject({
        projectId: 'copy',
        state: 'interrupted',
        code: { ref: { projectId: 'copy' } },
      });
      expect(record.commandInstanceId).toBeUndefined();
      expect(record.historical).toBe(true);
    } finally {
      agent.close();
      programs.close();
    }
    const copy = new Database(join(destination, 'project.sqlite'), { readonly: true });
    try {
      const restored = JSON.parse(
        copy.prepare('SELECT value FROM delegations WHERE id=?').get('delegation').value,
      );
      expect(restored).toMatchObject({
        projectId: 'copy',
        state: 'interrupted',
        resultState: 'unknown',
      });
      expect(
        restored.request.workPackage.materials.map((item: typeof evidence) => item.ref.projectId),
      ).toEqual(['copy', 'foreign']);
      expect(copy.prepare("SELECT value FROM meta WHERE key='grants'").get()).toEqual({
        value: grants,
      });
    } finally {
      copy.close();
    }
    expect(f.db.prepare('SELECT value FROM delegations WHERE id=?').get('delegation')).toEqual({
      value: JSON.stringify(delegation),
    });
    expect(
      JSON.parse(f.db.prepare('SELECT value FROM program_runs WHERE id=?').get('program').value).run
        .state,
    ).toBe('running');
  } finally {
    await f.close();
  }
});
