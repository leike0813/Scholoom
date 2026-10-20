import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Broker, type Handlers } from '@scholoom/broker';
import { EditorRuntime, ResourceAccess } from '@scholoom/editor/node';
import { LiteratureCatalog, MaterialReading } from '@scholoom/library/node';
import { ProcessAdmission, runCommand } from '@scholoom/platform/node';
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
  type ResourceInputs,
  type ResourceLibraryPort,
  type WorkbenchChange,
} from '@scholoom/protocol';
import {
  type EditorCommandInput,
  type EditorCommandResult,
  type EditorInputs,
  editorPlatformOperations,
} from '@scholoom/protocol/editor';
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
  ...editorPlatformOperations,
  ...businessSchemas,
  ...projectMaterialOperations,
  ...projectExecutionOperations,
  ...harnessModuleOperations,
  ...researchModuleOperations,
  ...libraryModuleOperations,
  ...projectHarnessOperations,
  ...modelsModuleOperations,
} as const;
type ApplicationInputs = BusinessInputs & {
  'platform.editorCommand': EditorCommandInput;
} & ProjectMaterialInputs &
  ProjectExecutionInputs &
  HarnessModuleInputs &
  ResearchModuleInputs &
  LibraryModuleInputs &
  ProjectHarnessInputs &
  ModelsModuleInputs;
type ApplicationOutputs = BusinessOutputs & {
  'platform.editorCommand': EditorCommandResult;
} & ProjectMaterialOutputs &
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
  | keyof ResourceInputs
  | keyof EditorInputs
  | Exclude<keyof ProjectsInputs, 'project.restore' | 'artifacts.reconcile'>
  | keyof LibraryInputs;

export class ManualApplication {
  readonly resources: ResourceAccess;
  readonly editor: EditorRuntime;
  readonly projects: Projects;
  readonly library: LiteratureCatalog;
  readonly transfers: FileTransfers;
  readonly fileWatches: ProjectFileWatches;
  private readonly directories: DirectoryBrowser;
  protected readonly processes = new ProcessAdmission();
  private readonly resourceReading = new MaterialReading(undefined, this.processes);
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
    this.editor = new EditorRuntime(join(directory, 'editor'), (context, signal) => {
      const port = this.modulePort({ ...context, ...(signal ? { signal } : {}) }, 'editor');
      return {
        check: async (projectId, access) => {
          await port.call('project.check', { projectId, access });
        },
        read: (projectId, path) => port.call('files.read', { projectId, path }),
        material: (projectId, path) => port.call('project.material', { projectId, path }),
        locate: async (projectId, fileId) => {
          const [location] = await port.call('files.resolve', { projectId, fileIds: [fileId] });
          if (location?.state !== 'present')
            throw new OperationError('notFound', '原稿已移动或缺失。');
          return location.path;
        },
        command: (input) => port.call('platform.editorCommand', input),
        importBegin: (input) => port.call('files.importBegin', input),
        importChunk: (input) => port.call('files.importChunk', input),
        importFinish: (input) => port.call('files.importFinish', input),
      };
    });
    this.registerProjectHandlers('editor-platform', {
      'platform.editorCommand': async (input, context) => {
        if (context.moduleId !== 'editor')
          throw new OperationError('permissionDenied', '编译命令只允许编辑器能力消费。');
        const workspace = this.editor.commandWorkspace(input.workspaceId);
        if (workspace.projectId) this.projects.get(workspace.projectId).check('read');
        const reservation = this.processes.reserve(true);
        const abort = () => reservation.release();
        context.signal?.addEventListener('abort', abort, { once: true });
        if (context.signal?.aborted) abort();
        try {
          await reservation.ready;
          if (workspace.projectId) this.projects.get(workspace.projectId).check('read');
          return await runCommand(
            {
              executable: input.tool,
              args: input.args,
              cwd: workspace.directory,
              timeoutMs: input.timeoutMs,
              ...(input.input !== undefined ? { input: input.input } : {}),
            },
            { signal: context.signal, reservation },
          );
        } finally {
          context.signal?.removeEventListener('abort', abort);
          reservation.release();
        }
      },
    });
    this.transfers = new FileTransfers(this.projects, (projectId) => this.changed(projectId));
    this.fileWatches = new ProjectFileWatches(
      (id) => this.projects.get(id),
      (projectId, paths) => {
        this.projects.get(projectId).files.changed();
        this.changed(projectId, undefined, false, false, paths);
      },
    );
    this.directories = new DirectoryBrowser(directory);
    this.resources = new ResourceAccess(
      (context) => {
        const port = this.modulePort(context, 'editor');
        return {
          project: {
            'files.resolve': (input) => port.call('files.resolve', input),
            'files.read': (input) => port.call('files.read', input),
            'files.readBytes': (input) => port.call('files.readBytes', input),
            'project.material': (input) => port.call('project.material', input),
            'project.saveFile': (input) => port.call('project.saveFile', input),
          },
          library: Object.fromEntries(
            [
              'attachment',
              'status',
              'readAttachment',
              'pdfInfo',
              'readPdfPage',
              'documentInfo',
              'readDocumentSection',
              'searchDocument',
              'readDocumentResource',
            ].map((method) => [
              `library.${method}`,
              (input: never) => port.call(`library.${method}` as keyof ResourceLibraryPort, input),
            ]),
          ) as ResourceLibraryPort,
        };
      },
      {
        run: (load, format, method, input, options) => {
          type Request = Parameters<MaterialReading['run']>[1];
          const request =
            method === 'pdfInfo'
              ? { kind: 'info' as const }
              : method === 'readPdfPage'
                ? { kind: 'text' as const, ...input }
                : { kind: 'document' as const, format, method: `library.${method}`, input };
          return this.resourceReading.run(load, request as Request, options);
        },
      },
    );
    this.registerProjectHandlers('project-materials', {
      'project.checkRead': ({ projectId, agent }, context) => {
        return this.projectMaterialAccess(projectId, agent, context, () => {
          this.projects.get(projectId).check('read');
          return { ok: true };
        });
      },
      'project.material': ({ projectId, path, agent }, context) => {
        this.checkProjectScope(projectId, context);
        return this.projectMaterialAccess(projectId, agent, context, () =>
          this.projects.get(projectId).material(path),
        );
      },
    });
    this.registerProjectHandlers('project-execution', {
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
    this.registerProjectHandlers('manual', this.foundationHandlers);
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
  private registerProjectHandlers<K extends keyof ApplicationInputs>(
    owner: string,
    handlers: Pick<Handlers<ApplicationInputs, ApplicationOutputs>, K>,
  ): void {
    const guarded = Object.fromEntries(
      Object.entries(handlers).map(([method, handler]) => [
        method,
        (input: unknown, context: CallContext) =>
          this.projects.withAccess(context, () =>
            (handler as (input: unknown, context: CallContext) => unknown)(input, context),
          ),
      ]),
    ) as Pick<Handlers<ApplicationInputs, ApplicationOutputs>, K>;
    this.broker.register(owner, guarded);
  }
  private projectMaterialAccess<T>(
    projectId: string,
    agent: boolean | undefined,
    context: CallContext,
    action: () => T,
  ): T {
    if (agent !== undefined && context.moduleId !== 'library')
      throw new OperationError('permissionDenied', '材料来源只能由文献模块提供。');
    return this.projects.withAccess(
      agent
        ? { role: 'execution', principal: { kind: 'agent', id: 'library-batch' }, projectId }
        : context,
      action,
    );
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
    if (context.role === 'execution') this.projects.get(projectId).check('send');
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
    'resources.cancel': (input, context) => this.resources.cancel(input.requestId, context),
    'resources.describe': (input, context) => this.resources.describe(input.locator, context),
    'resources.read': (input, context) => this.resources.read(input, context),
    'resources.document': (input, context) => this.resources.document(input, context),
    'resources.save': async (input, context) => {
      const result = await this.resources.save(input, context);
      if (input.ref.source === 'project') this.changed(input.ref.projectId);
      return result;
    },
    'library.attachment': (input) => this.library.attachment(input.attachmentId),
    'files.readBytes': (input, context) => {
      this.checkProjectScope(input.projectId, context);
      const { projectId, fileId, ...range } = input;
      return this.projects.get(projectId).files.readBytes(fileId, range);
    },
    'editor.tools': (_input, context) => this.editor.tools(context),
    'editor.convert': (input, context) => this.editor.convert(input, context),
    'editor.render': (input, context) => this.editor.render(input, context),
    'editor.job': (input, context) => this.editor.job(input, context),
    'editor.cancel': (input, context) => this.editor.cancel(input, context),
    'editor.output': (input, context) => this.editor.output(input, context),
    'editor.export': (input, context) => this.editor.export(input, context),
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
      return this.library.importProjectFiles(
        input,
        context.role === 'execution' || context.principal.kind === 'agent',
      );
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
      if (input.trust) store.grant({ trust: input.trust, autoBackup: store.project.autoBackup });
      await this.projectOpened();
      this.changed();
      return store.project;
    },
    'project.create': async (input) => {
      const p = input;
      const store = await this.projects.create(p.path);
      if (p.trust) store.grant({ trust: p.trust, autoBackup: store.project.autoBackup });
      await this.projectOpened();
      this.changed();
      return store.project;
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
        trust: p.trust,
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
    await this.resourceReading.close();
    await this.editor.close();
    this.fileWatches.close();
    await this.transfers.close();
    await this.library.close();
    await this.projects.close();
  }
}
