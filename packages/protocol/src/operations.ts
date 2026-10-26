import { delegationOperations } from './delegation-contracts.js';
import { editorOperations } from './editor.js';
import { harnessOperations, harnessSnapshotSchema } from './harness.js';
import { libraryOperations } from './library.js';
import { modelsOperations, providerSchema } from './models.js';
import { programsOperations } from './programs.js';
import { projectSchema, projectsOperations, projectTaskOperations } from './projects.js';
import { researchOperations } from './research.js';
import { resourceCreationOperations, resourceOperations } from './resources.js';
import { array, count, flag, id, object, page } from './schema.js';
import { taskGraphOperations } from './task-graph-contracts.js';
import { workbenchContextOperations } from './workbench-context.js';

const scope = {
  projectId: id,
  sessionId: id,
  before: id,
  limit: page,
  includeSessions: flag,
  navigationProjectIds: { type: 'array', items: id, maxItems: 101, uniqueItems: true },
} as const;

export const snapshotSchema = object(
  {
    revision: count,
    provider: providerSchema,
    projects: array(projectSchema),
    ...harnessSnapshotSchema.properties,
    fileRevision: count,
  },
  ['revision', 'provider', 'projects', 'sessions', 'messages', 'artifacts'],
);

export const changeSchema = object(
  {
    revision: count,
    projectId: id,
    sessionId: id,
    resync: flag,
    sessionsChanged: flag,
    sessionProjectIds: { type: 'array', items: id, maxItems: 101, uniqueItems: true },
    libraryChanged: flag,
    programsChanged: flag,
    programRunIds: { type: 'array', items: id, maxItems: 100, uniqueItems: true },
    filePaths: { type: 'array', items: { type: 'string' }, maxItems: 100 },
  },
  ['revision', 'resync'],
);

export const businessSchemas = {
  ...delegationOperations,
  ...workbenchContextOperations,
  ...resourceCreationOperations,
  ...resourceOperations,
  ...editorOperations,
  ...programsOperations,
  ...modelsOperations,
  ...projectsOperations,
  ...projectTaskOperations,
  ...taskGraphOperations,
  ...harnessOperations,
  ...libraryOperations,
  ...researchOperations,
  'workbench.snapshot': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(scope, []),
    result: snapshotSchema,
  },
  'workbench.watch': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(scope, []),
    result: snapshotSchema,
  },
} as const;
