import { ManualApplication } from '../../../apps/kernel/dist/manual.js';

process.once('message', async ({ profile, projectPath }) => {
  const app = new ManualApplication(profile);
  try {
    await app.initialize();
    const project = await app.call('project.open', { path: projectPath });
    const entry = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'program.mjs' },
    });
    const accepted = await app.call('programs.start', {
      projectId: project.id,
      operationId: crypto.randomUUID(),
      environmentId: 'node',
      entry: { ref: entry.ref, basis: entry.basis },
    });
    const identity = { projectId: project.id, programRunId: accepted.programRunId };
    while ((await app.call('programs.run', identity)).state === 'queued')
      await new Promise((resolve) => setTimeout(resolve, 10));
    process.send?.(identity);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    await app.close();
    process.disconnect();
  }
});
