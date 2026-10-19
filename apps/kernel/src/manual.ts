import { readFileSync } from 'node:fs';
import { Broker, type Handlers } from '@scholoom/broker';
import { LiteratureCatalog, MaterialReading } from '@scholoom/library/node';
import { ProcessAdmission } from '@scholoom/platform/node';
import {
  DirectoryBrowser,
  FileTransfers,
  ProjectFileWatches,
  Projects,
} from '@scholoom/projects/node';
import {
  type BusinessInputs,
  type BusinessMethod,
  type BusinessOutputs,
  businessSchemas,
  type CallArguments,
  type CallContext,
  OperationError,
  type WorkbenchChange,
} from '@scholoom/protocol';
import {
  type HarnessModuleInputs,
  type HarnessModuleOutputs,
  harnessModuleOperations,
} from '@scholoom/protocol/harness';
import {
  type LibraryInputs,
  type LibraryModuleInputs,
  type LibraryModuleOutputs,
  type LibraryToolPort,
  libraryModuleOperations,
} from '@scholoom/protocol/library';
import {
  type ModelsModuleInputs,
  type ModelsModuleOutputs,
  modelsModuleOperations,
} from '@scholoom/protocol/models';
import {
  type HarnessProjectPort,
  type ProjectExecutionInputs,
  type ProjectExecutionOutputs,
  type ProjectFilePort,
  type ProjectHarnessInputs,
  type ProjectHarnessOutputs,
  type ProjectMaterialInputs,
  type ProjectMaterialOutputs,
  type ProjectsInputs,
  projectExecutionOperations,
  projectHarnessOperations,
  projectMaterialOperations,
  type ResearchProjectPort,
} from '@scholoom/protocol/projects';
import {
  type ResearchModuleInputs,
  type ResearchModuleOutputs,
  researchModuleOperations,
} from '@scholoom/protocol/research';
import { initializeProjectContainer } from './storage/project-container.js';

const applicationSchemas = {
  ...businessSchemas,
  ...projectMaterialOperations,
  ...projectExecutionOperations,
  ...harnessModuleOperations,
  ...researchModuleOperations,
  ...libraryModuleOperations,
  ...projectHarnessOperations,
  ...modelsModuleOperations,
} as const;
type ApplicationInputs = BusinessInputs &
  ProjectMaterialInputs &
  ProjectExecutionInputs &
  HarnessModuleInputs &
  ResearchModuleInputs &
  LibraryModuleInputs &
  ProjectHarnessInputs &
  ModelsModuleInputs;
type ApplicationOutputs = BusinessOutputs &
  ProjectMaterialOutputs &
  ProjectExecutionOutputs &
  HarnessModuleOutputs &
  ResearchModuleOutputs &
  LibraryModuleOutputs &
  ProjectHarnessOutputs &
  ModelsModuleOutputs;
const architecture: { modules: { name: string; consumes?: string[] }[] } = JSON.parse(
  readFileSync(new URL('./architecture.json', import.meta.url), 'utf8'),
);
const libraryConsumes =
  architecture.modules.find((module) => module.name === 'library')?.consumes ?? [];
const materialMethods = Object.keys(projectMaterialOperations).filter(
  (method): method is keyof ProjectMaterialInputs => libraryConsumes.includes(method),
);
export type FoundationMethod =
  | Exclude<keyof ProjectsInputs, 'project.restore' | 'artifacts.reconcile'>
  | keyof LibraryInputs;

export class ManualApplication {
  readonly projects: Projects;
  readonly library: LiteratureCatalog;
  readonly transfers: FileTransfers;
  readonly fileWatches: ProjectFileWatches;
  private readonly directories: DirectoryBrowser;
  protected readonly processes = new ProcessAdmission();
  protected revision = 0;
  private listeners = new Set<(change: WorkbenchChange) => void>();
  protected readonly broker = new Broker<
    typeof applicationSchemas,
    ApplicationInputs,
    ApplicationOutputs
  >(applicationSchemas);
  private readonly product = this.broker.consumer(
    { moduleId: 'product', principal: { kind: 'human', id: 'local' }, role: 'product' },
    Object.keys(businessSchemas) as BusinessMethod[],
  );
  constructor(directory: string) {
    this.projects = new Projects(directory, initializeProjectContainer, (id) =>
      this.projectReplacing(id),
    );
    this.transfers = new FileTransfers(this.projects, (projectId) => this.changed(projectId));
    this.fileWatches = new ProjectFileWatches(
      (id) => this.projects.get(id),
      (projectId, paths) => {
        this.projects.get(projectId).files.changed();
        this.changed(projectId, undefined, false, false, paths);
      },
    );
    this.directories = new DirectoryBrowser(directory);
    this.broker.register('project-materials', {
      'project.checkRead': ({ projectId }) => {
        this.projects.get(projectId).check('read');
        return { ok: true };
      },
      'project.material': ({ projectId, path }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projects.get(projectId).material(path);
      },
    });
    this.broker.register('project-execution', {
      'project.fileRevision': ({ projectId }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projects.get(projectId).files.revision;
      },
      'projects.list': () => this.projects.list(),
      'project.artifacts': ({ projectId, sessionId }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projects.get(projectId).artifacts(sessionId);
      },
      'project.linkArtifact': ({ projectId, sessionId, artifact }, context) => {
        this.checkProjectScope(projectId, context);
        this.projects.get(projectId).linkArtifact(sessionId, artifact);
        return { ok: true };
      },
      'project.check': ({ projectId, access }, context) => {
        this.checkProjectScope(projectId, context);
        this.projects.get(projectId).check(access);
        return { ok: true };
      },
      'project.path': ({ projectId, path, allowMissing }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projects.get(projectId).path(path, allowMissing);
      },
      'project.saveFile': ({ projectId, path, content, basis, expectedFileId }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projects.get(projectId).save(path, content, basis, undefined, expectedFileId);
      },
    });
    const libraryMaterials = this.broker.consumer(
      { moduleId: 'library', principal: { kind: 'system', id: 'host' }, role: 'host' },
      materialMethods,
    );
    this.library = new LiteratureCatalog(
      directory,
      () => this.changed(undefined, undefined, false, true),
      {
        'project.checkRead': (input) => libraryMaterials.call('project.checkRead', input),
        'project.material': (input) => libraryMaterials.call('project.material', input),
      },
      new MaterialReading(undefined, this.processes),
    );
    this.broker.register('manual', this.foundationHandlers);
    this.broker.register('library-internal', {
      'library.check': ({ access }) => {
        this.library.check(access);
        return { ok: true };
      },
    });
  }
  async initialize(): Promise<void> {
    await this.library.initialize();
    await this.projects.initialize();
  }
  protected async projectOpened(): Promise<void> {}
  protected async projectReplacing(_projectId: string): Promise<void> {}
  protected modulePort(
    context: CallContext,
    moduleId: string,
  ): {
    call: <A extends CallArguments<ApplicationInputs>>(
      ...args: A
    ) => Promise<ApplicationOutputs[A[0]]>;
  } {
    const consumes =
      architecture.modules.find((module) => module.name === moduleId)?.consumes ?? [];
    const methods = (Object.keys(applicationSchemas) as (keyof typeof applicationSchemas)[]).filter(
      (method) => consumes.includes(method),
    );
    return this.broker.consumer({ ...context, moduleId }, methods);
  }
  libraryTools(context: CallContext): LibraryToolPort {
    const port = this.modulePort(context, 'harness');
    return { call: port.call };
  }
  harnessProject(context: CallContext): HarnessProjectPort {
    const port = this.modulePort(context, 'harness');
    return {
      'project.check': (input) => port.call('project.check', input),
      'project.path': (input) => port.call('project.path', input),
      'project.material': (input) => port.call('project.material', input),
      'files.read': (input) => port.call('files.read', input),
      'files.resolve': (input) => port.call('files.resolve', input),
      'files.operation': (input) => port.call('files.operation', input),
      'files.mkdir': (input) => port.call('files.mkdir', input),
      'files.rename': (input) => port.call('files.rename', input),
      'files.trash': (input) => port.call('files.trash', input),
      'files.restore': (input) => port.call('files.restore', input),
      'files.trashList': (input) => port.call('files.trashList', input),
      'projects.list': (input) => port.call('projects.list', input),
      'project.artifacts': (input) => port.call('project.artifacts', input),
      'project.linkArtifact': (input) => port.call('project.linkArtifact', input),
    };
  }

  researchFiles(context: CallContext): ResearchProjectPort {
    const port = this.modulePort(context, 'research');
    return {
      'project.check': (input) => port.call('project.check', input),
      'project.path': (input) => port.call('project.path', input),
      'project.material': (input) => port.call('project.material', input),
      'files.read': (input) => port.call('files.read', input),
      'files.resolve': (input) => port.call('files.resolve', input),
    };
  }
  private checkProjectScope(projectId: string, context: CallContext): void {
    if (context.role === 'execution' && context.projectId !== projectId)
      throw new OperationError('permissionDenied', '项目不属于当前执行范围。');
  }
  projectFiles(context: CallContext): ProjectFilePort {
    const methods = [
      'files.list',
      'files.read',
      'project.material',
      'project.check',
      'project.path',
      'project.saveFile',
    ] as const;
    const consumes =
      architecture.modules.find((module) => module.name === 'harness')?.consumes ?? [];
    const port = this.broker.consumer(
      {
        ...context,
        moduleId: 'harness',
        role: 'execution',
        principal: { kind: 'agent', id: context.sessionId ?? context.principal.id },
      },
      methods.filter((method) => consumes.includes(method)),
    );
    return {
      'files.list': (input) => port.call('files.list', input),
      'files.read': (input) => port.call('files.read', input),
      'project.material': (input) => port.call('project.material', input),
      'project.check': (input) => port.call('project.check', input),
      'project.path': (input) => port.call('project.path', input),
      'project.saveFile': (input) => port.call('project.saveFile', input),
    };
  }
  subscribe(listener: (change: WorkbenchChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  protected changed(
    projectId?: string,
    sessionId?: string,
    sessionsChanged = false,
    libraryChanged = false,
    filePaths?: string[],
  ): void {
    const change: WorkbenchChange = { revision: ++this.revision, resync: true };
    if (projectId) change.projectId = projectId;
    if (sessionId) change.sessionId = sessionId;
    if (sessionsChanged) change.sessionsChanged = true;
    if (libraryChanged) change.libraryChanged = true;
    if (filePaths) change.filePaths = filePaths.slice(0, 100);
    for (const listener of this.listeners) listener(change);
  }

  private readonly foundationHandlers: Pick<
    Handlers<BusinessInputs, BusinessOutputs>,
    FoundationMethod
  > = {
    'files.transfer': (input) => this.transfers.start(input),
    'files.transferStatus': (input) =>
      this.transfers.status(input.projectId, input.operationId, input.offset, input.limit),
    'files.transferDecide': (input) => this.transfers.decide(input),
    'files.transferCancel': (input) => this.transfers.cancel(input.projectId, input.operationId),
    'files.importBegin': (input) => this.transfers.importBegin(input),
    'files.importChunk': (input) => this.transfers.importChunk(input),
    'files.importFinish': (input) =>
      this.transfers.importFinish(input.projectId, input.operationId),
    'files.watch': (input) => this.fileWatches.watch(input.projectId, input.paths),
    'files.unwatch': async (input) => this.fileWatches.unwatch(input.projectId, input.watchId),
    'library.documentInfo': (input, context) =>
      this.library.document(
        'library.documentInfo',
        input,
        context.signal,
        context.role !== 'execution',
      ),
    'library.readDocumentSection': (input, context) =>
      this.library.document(
        'library.readDocumentSection',
        input,
        context.signal,
        context.role !== 'execution',
      ),
    'library.searchDocument': (input, context) =>
      this.library.document(
        'library.searchDocument',
        input,
        context.signal,
        context.role !== 'execution',
      ),
    'library.readDocumentResource': (input, context) =>
      this.library.document(
        'library.readDocumentResource',
        input,
        context.signal,
        context.role !== 'execution',
      ),
    'library.pdfInfo': async (input, context) => {
      return this.library.pdfInfo(input, context.signal, context.role !== 'execution');
    },
    'library.readPdfPage': async (input, context) => {
      return this.library.readPdfPage(input, context.signal, context.role !== 'execution');
    },
    'library.readingRecords': async (input) => {
      return this.library.readingRecords(input);
    },
    'library.readingRecord': async (input) => {
      return this.library.readingRecord(input.recordId);
    },
    'library.readingHistory': async (input) => {
      return this.library.readingHistory(input);
    },
    'library.saveReadingRecord': async (input, context) => {
      return this.library.saveReadingRecord(
        input,
        context.role === 'execution' && context.sessionId
          ? { kind: 'agent', sessionId: context.sessionId }
          : { kind: 'user' },
        context.signal,
      );
    },
    'library.removeReadingRecord': async (input, context) => {
      return this.library.removeReadingRecord(
        input,
        context.role === 'execution' && context.sessionId
          ? { kind: 'agent', sessionId: context.sessionId }
          : { kind: 'user' },
      );
    },
    'library.importFiles': async (input) => {
      return this.library.importFiles(input);
    },
    'library.importProjectFiles': async (input, context) => {
      this.checkProjectScope(input.projectId, context);
      return this.library.importProjectFiles(input);
    },
    'library.attachments': async (input) => {
      return this.library.attachments(input);
    },
    'library.readAttachment': async (input) => {
      return this.library.readAttachment(input);
    },
    'library.relocateAttachment': async (input) => {
      return this.library.relocateAttachment(input);
    },
    'library.status': async () => {
      return this.library.status();
    },
    'library.grant': async (input) => {
      return this.library.grant(input);
    },
    'library.list': async (input) => {
      return this.library.list(input);
    },
    'library.get': async (input) => {
      return this.library.get(input.sourceId);
    },
    'library.ingest': async (input) => {
      return this.library.ingest(input);
    },
    'library.batch': async (input) => {
      return this.library.batch(input);
    },
    'library.batches': async (input) => {
      return this.library.batches(input);
    },
    'library.resume': async (input) => {
      return this.library.resume(input.batchId);
    },
    'library.update': async (input) => {
      return this.library.update(input);
    },
    'library.collections': async (input) => {
      return this.library.collections(input);
    },
    'library.saveCollection': async (input) => {
      return this.library.saveCollection(input);
    },
    'library.history': async (input) => {
      return this.library.history(input);
    },
    'library.backup': async () => {
      return this.library.backup();
    },
    'library.backups': async () => {
      return this.library.backups();
    },
    'library.restore': async (input) => {
      const p = input;
      return this.library.restore(p.backupId, p.destination);
    },
    'project.open': async (input) => {
      const store = await this.projects.open(input.path);
      await this.projectOpened();
      this.changed();
      return store.project;
    },
    'project.create': async (input) => {
      const p = input;
      const store = await this.projects.create(p.path, p.name);
      await this.projectOpened();
      this.changed();
      return store.project;
    },
    'project.rename': async (input) => {
      const p = input;
      const result = this.projects.get(p.projectId).renameProject(p.name);
      this.changed();
      return result;
    },
    'project.forget': async (input) => {
      await this.projects.forget(input.projectId);
      this.changed();
      return { ok: true };
    },
    'project.browseDirectories': async (input) => {
      return this.directories.browse(input);
    },
    'files.mkdir': async (input) => {
      const p = input;
      const { projectId, operationId, ...values } = p;
      try {
        return await this.projects.get(projectId).files.mutate('mkdir', operationId, values);
      } finally {
        this.changed(projectId);
      }
    },
    'files.rename': async (input) => {
      const p = input;
      const { projectId, operationId, ...values } = p;
      try {
        return await this.projects.get(projectId).files.mutate('rename', operationId, values);
      } finally {
        this.changed(projectId);
      }
    },
    'files.trash': async (input) => {
      const p = input;
      const { projectId, operationId, ...values } = p;
      try {
        return await this.projects.get(projectId).files.mutate('trash', operationId, values);
      } finally {
        this.changed(projectId);
      }
    },
    'files.restore': async (input) => {
      const p = input;
      const { projectId, operationId, ...values } = p;
      try {
        return await this.projects.get(projectId).files.mutate('restore', operationId, values);
      } finally {
        this.changed(projectId);
      }
    },
    'files.resolve': async (input, context) => {
      const p = input;
      this.checkProjectScope(p.projectId, context);
      return this.projects.get(p.projectId).files.resolve(p.fileIds);
    },
    'files.trashList': async (input) => {
      const p = input;
      return this.projects.get(p.projectId).files.trashList(p.offset, p.limit);
    },
    'files.operation': async (input) => {
      const p = input;
      const value = await this.projects.get(p.projectId).files.operation(p.operationId);
      this.changed(p.projectId);
      return value;
    },
    'files.resource': async (input) => {
      const p = input;
      return this.projects.get(p.projectId).files.resource(p.path);
    },
    'project.grant': async (input) => {
      const p = input;
      const project = this.projects.get(p.projectId);
      const result = project.grant({
        read: p.read,
        write: p.write,
        send: p.send,
        autoBackup: p.autoBackup,
      });
      this.changed(p.projectId);
      return result;
    },
    'files.list': async (input, context) => {
      const p = input;
      this.checkProjectScope(p.projectId, context);
      return this.projects.get(p.projectId).list(p.path, p.offset, p.limit, p.version, p.anchor);
    },
    'files.read': async (input, context) => {
      const p = input;
      this.checkProjectScope(p.projectId, context);
      return this.projects.get(p.projectId).read(p.path, p.offset);
    },
    'files.save': async (input) => {
      const p = input;
      const edit = await this.projects.get(p.projectId).save(p.path, p.content, p.basis);
      this.changed(p.projectId);
      return edit;
    },
    'files.history': async (input) => {
      const p = input;
      return this.projects.get(p.projectId).history(p.path);
    },
    'files.undo': async (input) => {
      const p = input;
      const result = await this.projects.get(p.projectId).undo(p.editId);
      this.changed(p.projectId);
      return result;
    },
    'project.backup': async (input) => {
      return this.projects.get(input.projectId).backup();
    },
    'project.backups': async (input) => {
      return this.projects.get(input.projectId).backups();
    },
  };
  async call<A extends CallArguments<BusinessInputs>>(...args: A): Promise<BusinessOutputs[A[0]]> {
    return this.product.call<A>(...args);
  }
  available(): BusinessMethod[] {
    return this.broker.available(Object.keys(businessSchemas) as BusinessMethod[]);
  }
  async close(): Promise<void> {
    this.fileWatches.close();
    await this.transfers.close();
    await this.library.close();
    await this.projects.close();
  }
}
