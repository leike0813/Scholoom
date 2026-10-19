import { harnessOperations, harnessSnapshotSchema } from './harness.js';
import { libraryOperations } from './library.js';
import { modelsOperations, providerSchema } from './models.js';
import { projectSchema, projectsOperations } from './projects.js';
import { researchOperations } from './research.js';
import { array, count, flag, id, object, page } from './schema.js';

const scope = {
  projectId: id,
  sessionId: id,
  before: id,
  limit: page,
  includeSessions: flag,
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
    libraryChanged: flag,
    filePaths: { type: 'array', items: { type: 'string' }, maxItems: 100 },
  },
  ['revision', 'resync'],
);

export const businessSchemas = {
  ...modelsOperations,
  ...projectsOperations,
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
