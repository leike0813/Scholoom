import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Broker, type Handlers } from '@scholoom/broker';
import { EditorRuntime, ResourceAccess } from '@scholoom/editor/node';
import { LiteratureCatalog, MaterialReading } from '@scholoom/library/node';
import { ManagedNode, ProcessAdmission } from '@scholoom/platform/node';
import { ProgramEnvironments, ProgramRecords, ProgramRuns } from '@scholoom/programs/node';
import {
  DirectoryBrowser,
  FileTransfers,
  ProjectFileWatches,
  Projects,
  ProjectTargetReader,
} from '@scholoom/projects/node';
import {
  type BusinessInputs,
  type BusinessMethod,
  type BusinessOutputs,
  businessSchemas,
  type CallArguments,
  type CallContext,
  type ExecutionResourcePort,
  OperationError,
  type ResourceCreationInputs,
  type ResourceCreationOutputs,
  type ResourceDescriptor,
  type ResourceEvidence,
  type ResourceInputs,
  type ResourceLibraryPort,
  type ResourceLocator,
  type ResourceRef,
  type ResourceSaveResult,
  resourceFormatForName,
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
  type PlatformCommandInput,
  type PlatformCommandResult,
  type PlatformProgramInputs,
  type PlatformProgramOutputs,
  platformCommandOperations,
  platformProgramOperations,
} from '@scholoom/protocol/platform';
import {
  type ProgramsInputs,
  type ProgramsInternalInputs,
  type ProgramsInternalOutputs,
  programsInternalOperations,
} from '@scholoom/protocol/programs';
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
  type ProjectTargetReadInputs,
  type ProjectTargetReadOutputs,
  type ProjectTargetReadPort,
  projectExecutionOperations,
  projectHarnessOperations,
  projectMaterialOperations,
  projectTargetReadOperations,
  type ResearchProjectPort,
} from '@scholoom/protocol/projects';
import {
  type ResearchModuleInputs,
  type ResearchModuleOutputs,
  researchModuleOperations,
} from '@scholoom/protocol/research';
import { type CommandWorkspace, ManagedCommands } from './commands.js';
import { executionResources } from './execution-resources.js';
import { initializeProjectContainer } from './storage/project-container.js';
import { WorkbenchContextStore } from './workbench-context.js';

const applicationSchemas: typeof editorPlatformOperations &
  typeof platformProgramOperations &
  typeof programsInternalOperations &
  typeof platformCommandOperations &
  typeof businessSchemas &
  typeof projectMaterialOperations &
  typeof projectExecutionOperations &
  typeof harnessModuleOperations &
  typeof researchModuleOperations &
  typeof libraryModuleOperations &
  typeof projectHarnessOperations &
  typeof modelsModuleOperations &
  typeof projectTargetReadOperations = {
  ...editorPlatformOperations,
  ...platformProgramOperations,
  ...programsInternalOperations,
  ...platformCommandOperations,
  ...businessSchemas,
  ...projectMaterialOperations,
  ...projectExecutionOperations,
  ...harnessModuleOperations,
  ...researchModuleOperations,
  ...libraryModuleOperations,
  ...projectHarnessOperations,
  ...modelsModuleOperations,
  ...projectTargetReadOperations,
} as const;
type ApplicationInputs = BusinessInputs & {
  'platform.editorCommand': EditorCommandInput;
  'platform.command': PlatformCommandInput;
} & PlatformProgramInputs &
  ProgramsInternalInputs &
  ProjectMaterialInputs &
  ProjectExecutionInputs &
  HarnessModuleInputs &
  ResearchModuleInputs &
  LibraryModuleInputs &
  ProjectHarnessInputs &
  ModelsModuleInputs &
  ProjectTargetReadInputs;
type ApplicationOutputs = BusinessOutputs & {
  'platform.editorCommand': EditorCommandResult;
  'platform.command': PlatformCommandResult;
} & PlatformProgramOutputs &
  ProgramsInternalOutputs &
  ProjectMaterialOutputs &
  ProjectExecutionOutputs &
  HarnessModuleOutputs &
  ResearchModuleOutputs &
  LibraryModuleOutputs &
  ProjectHarnessOutputs &
  ModelsModuleOutputs &
  ProjectTargetReadOutputs;
const architecture: { modules: { name: string; consumes?: string[] }[] } = JSON.parse(
  readFileSync(new URL('./architecture.json', import.meta.url), 'utf8'),
);
const libraryConsumes =
  architecture.modules.find((module) => module.name === 'library')?.consumes ?? [];
const materialMethods = Object.keys(projectMaterialOperations).filter(
  (method): method is keyof ProjectMaterialInputs => libraryConsumes.includes(method),
);
export type FoundationMethod =
  | keyof ProgramsInputs
  | keyof ResourceInputs
  | keyof ResourceCreationInputs
  | keyof EditorInputs
  | Exclude<keyof ProjectsInputs, 'project.restore' | 'artifacts.reconcile'>
  | keyof LibraryInputs;

export class ManualApplication {
  readonly workbenchContexts = new WorkbenchContextStore();
  readonly resources: ResourceAccess;
  readonly editor: EditorRuntime;
  readonly programs: ProgramRuns;
  readonly programEnvironments: ProgramEnvironments;
  private readonly commandRunner: ManagedCommands;
  private readonly programWorkspaces = new Map<string, CommandWorkspace>();
  private readonly programControls = new Map<
    string,
    { controller: AbortController; context: CallContext; detach: () => void }
  >();
  private readonly unknownPrograms = new Set<string>();
  private programStartupProblem: OperationError | undefined;
  private readonly hostInstanceId = crypto.randomUUID();
  readonly projects: Projects;
  readonly library: LiteratureCatalog;
  readonly transfers: FileTransfers;
  readonly fileWatches: ProjectFileWatches;
  private readonly directories: DirectoryBrowser;
  protected readonly processes = new ProcessAdmission();
  private readonly resourceReading = new MaterialReading(undefined, this.processes);
  protected revision = 0;
  private listeners = new Set<(change: WorkbenchChange) => void>();
  protected readonly broker: Broker<
    typeof applicationSchemas,
    ApplicationInputs,
    ApplicationOutputs
  > = new Broker<typeof applicationSchemas, ApplicationInputs, ApplicationOutputs>(
    applicationSchemas,
  );
  private readonly product = this.broker.consumer(
    { moduleId: 'product', principal: { kind: 'human', id: 'local' }, role: 'product' },
    Object.keys(businessSchemas) as BusinessMethod[],
  );
  constructor(private readonly directory: string) {
    this.broker.register('workbench-context', {
      'workbench.context.publish': ({ snapshot }, context) => {
        this.workbenchContexts.publish(context.workbenchSource, snapshot);
        return { ok: true };
      },
    });
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
        command: ({ tool, ...input }) =>
          port.call('platform.command', { ...input, executableId: tool }),
        importBegin: (input) => port.call('files.importBegin', input),
        importChunk: (input) => port.call('files.importChunk', input),
        importFinish: (input) => port.call('files.importFinish', input),
      };
    });
    const commands = new ManagedCommands(
      this.processes,
      (workspaceId) => this.commandWorkspace(workspaceId),
      (workspace, context) => {
        if (
          context.principal.kind === 'agent' ||
          context.workDomain ||
          context.role === 'execution' ||
          context.role === 'compute'
        )
          this.checkExecutionContext(context);
        if (workspace.projectId) this.projects.get(workspace.projectId).check('read');
      },
    );
    this.commandRunner = commands;
    this.registerProjectHandlers('command-platform', {
      'platform.command': (input, context) => commands.execute(input, context),
      'platform.programStart': (input, context) => {
        let seq = 0;
        return commands.start(
          input,
          context,
          async (event, commandInstanceId) => {
            const port = this.modulePort(
              {
                moduleId: 'kernel',
                role: 'host',
                principal: { kind: 'system', id: this.hostInstanceId },
              },
              'kernel',
            );
            await port.call('programs.commandEvent', {
              programRunId: input.workspaceId,
              hostInstanceId: this.hostInstanceId,
              commandInstanceId,
              seq: seq++,
              event,
            });
            if (event.kind === 'stopped') {
              this.programControls.get(input.workspaceId)?.detach();
              this.programControls.delete(input.workspaceId);
              this.programWorkspaces.delete(input.workspaceId);
            }
          },
          (error) => this.programs.observationFailed(input.workspaceId, error),
        );
      },
      'platform.programCancel': (input, context) => commands.cancel(input, context),
      'platform.editorCommand': ({ tool, ...input }, context) =>
        commands.execute({ ...input, executableId: tool }, context),
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
          ...(context.targetRead ? { target: this.projectTargetRead(context) } : {}),
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
      'project.saveFile': (
        { projectId, path, content, basis, expectedFileId, resourceBasis },
        context,
      ) => {
        this.checkProjectScope(projectId, context);
        return this.projects
          .get(projectId)
          .save(path, content, basis, undefined, expectedFileId, undefined, resourceBasis);
      },
    });
    this.registerProjectHandlers('project-target-read', {
      'project.readTarget': async ({ targetProjectId, request }, context) => {
        const source = context.projectId && this.projects.get(context.projectId);
        const target = this.projects.get(targetProjectId);
        const authorize = () => {
          this.checkResourceContext(context);
          if (
            context.moduleId !== 'harness' ||
            (context.role !== 'execution' && !this.isInstructionAdmission(context)) ||
            context.principal.kind !== 'agent' ||
            !source ||
            !context.sessionId ||
            context.principal.id !== context.sessionId ||
            context.workDomain?.projectId !== source.project.id ||
            context.workDomain.sessionId !== context.sessionId ||
            context.workDomain.kind !==
              (source.project.id === 'application' ? 'application' : 'project') ||
            context.targetRead?.targetProjectId !== targetProjectId ||
            context.targetRead.access !== 'read' ||
            source.project.trust !== 'trusted' ||
            target.project.trust !== 'trusted' ||
            this.projects.get(source.project.id) !== source ||
            this.projects.get(targetProjectId) !== target
          )
            throw new OperationError('permissionDenied', '目标读取不属于获授权的执行范围。');
        };
        return this.projects.withTargetRead(context, targetProjectId, authorize, async () => {
          const result = await new ProjectTargetReader(target).read(request);
          authorize();
          return result;
        });
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
    this.programs = new ProgramRuns({
      records: (id) => new ProgramRecords(this.projects.get(id).internal),
      check: (id, context, write) => this.programAccess(id, context, write),
      available: () => {
        if (this.programStartupProblem) throw this.programStartupProblem;
        ManagedNode.requireAvailable();
      },
      describe: async (evidence, context) => {
        const descriptor = await this.modulePort(context, 'programs').call('resources.describe', {
          locator: evidence.ref,
        });
        if (descriptor.basis !== evidence.basis)
          throw new OperationError('contentChanged', '程序材料依据已变化。');
        return descriptor;
      },
      output: (projectId, path, context) =>
        this.modulePort(context, 'programs').call('resources.describe', {
          locator: { source: 'project', projectId, path },
        }),
      mkdir: async (projectId, path, context) => {
        let current = '';
        for (const part of path.split('/')) {
          current = current ? `${current}/${part}` : part;
          try {
            await this.modulePort(context, 'programs').call('files.mkdir', {
              projectId,
              operationId: crypto.randomUUID(),
              path: current,
            });
          } catch (error) {
            if (!(error instanceof OperationError) || error.code !== 'contentChanged') throw error;
          }
        }
      },
      environment: (id, environmentId) => this.programEnvironments.resolve(id, environmentId),
      launch: async (run, executable, args, cwd, timeoutMs, env, context) => {
        const controller = new AbortController();
        const stop = () =>
          controller.abort(
            context.signal?.reason ?? new OperationError('shuttingDown', '父执行已停止。'),
          );
        const parent = context.principal.kind === 'agent' ? context.signal : undefined;
        parent?.addEventListener('abort', stop, { once: true });
        if (parent?.aborted) stop();
        const control = {
          controller,
          context: { ...context, signal: controller.signal },
          detach: () => parent?.removeEventListener('abort', stop),
        };
        this.programControls.set(run.programRunId, control);
        const port = this.modulePort(control.context, 'programs');
        const location = await port.call('project.path', { projectId: run.projectId, path: cwd });
        const directory = location;
        const identity = statSync(directory, { bigint: true });
        const source = this.projects.get(run.projectId);
        this.programWorkspaces.set(run.programRunId, {
          ownerModuleId: 'programs',
          projectId: run.projectId,
          directory,
          executables: new Map([[run.command?.executableId ?? 'program', executable]]),
          ...(env ? { env } : {}),
          authorizationContext: () => control.context,
          beforeLaunch: async () => {
            await this.programAccess(run.projectId, control.context, true);
            if (run.kind === 'program' && run.environmentId)
              await this.programEnvironments.validate(
                run.projectId,
                run.environmentId,
                control.context,
              );
            if (this.projects.get(run.projectId) !== source)
              throw new OperationError('instanceMismatch', '项目实例已变化。');
            const now = statSync(directory, { bigint: true });
            if (now.dev !== identity.dev || now.ino !== identity.ino)
              throw new OperationError('contentChanged', '程序工作目录已变化。');
            for (const item of [run.code, ...(run.inputs ?? [])]) {
              if (!item) continue;
              const descriptor = await this.modulePort(control.context, 'programs').call(
                'resources.describe',
                { locator: item.ref },
              );
              if (descriptor.basis !== item.basis)
                throw new OperationError('contentChanged', '程序材料在等待期间已变化。');
              if (
                item === run.code &&
                descriptor.path !== posix.normalize(posix.join(cwd, args[0] ?? ''))
              )
                throw new OperationError(
                  'contentChanged',
                  '程序入口位置已变化，请重新读取后运行。',
                );
            }
          },
        });
        try {
          const accepted = await port.call('platform.programStart', {
            workspaceId: run.programRunId,
            executableId: run.command?.executableId ?? 'program',
            args,
            timeoutMs,
          });
          return accepted.commandInstanceId;
        } catch (error) {
          control.detach();
          this.programControls.delete(run.programRunId);
          this.programWorkspaces.delete(run.programRunId);
          throw error;
        }
      },
      cancel: async (_projectId, runId, commandInstanceId, context) => {
        await this.modulePort(context, 'programs').call('platform.programCancel', {
          workspaceId: runId,
          commandInstanceId,
        });
      },
      changed: (projectId, runId) => this.programChanged(projectId, runId),
      retainUnknown: (id) => {
        if (this.unknownPrograms.has(id)) return;
        this.unknownPrograms.add(id);
        if (this.processes.status.active < this.processes.status.limit) {
          const lease = this.processes.reserve();
          lease.retainUntil(new Promise<void>(() => {}));
          lease.release();
        }
      },
      prepareHandoff: (id, context) => {
        const control = this.programControls.get(id);
        if (!control) throw new OperationError('instanceMismatch', '没有可移交的活动程序。');
        const check = () => {
          if (this.programControls.get(id) !== control)
            throw new OperationError('instanceMismatch', '程序控制已变化。');
          control.controller.signal.throwIfAborted();
        };
        check();
        const next = { ...context, signal: control.controller.signal };
        return () => {
          check();
          control.detach();
          control.context = next;
        };
      },
    });
    this.programEnvironments = new ProgramEnvironments(join(directory, 'programs'), {
      check: (id, context) => this.programAccess(id, context),
      describe: async (evidence, context) => {
        const descriptor = await this.modulePort(context, 'programs').call('resources.describe', {
          locator: evidence.ref,
        });
        if (
          descriptor.basis !== evidence.basis ||
          !descriptor.path ||
          descriptor.ref.source !== 'project'
        )
          throw new OperationError('contentChanged', '环境声明依据已变化。');
        const path = await this.modulePort(context, 'programs').call('project.path', {
          projectId: descriptor.ref.projectId,
          path: descriptor.path,
        });
        return { path, relativePath: descriptor.path, basis: descriptor.basis };
      },
      launch: (input, context) => this.programs.launch(input, context),
      wait: (id, runId, context) => this.programs.wait(id, runId, context),
      logs: async (id, runId, context) => {
        let next = 0;
        let content = '';
        for (;;) {
          const page = await this.programs.logs(
            { projectId: id, programRunId: runId, after: next },
            context,
          );
          if (page.truncatedBefore > 0 || page.error)
            throw new OperationError('tooLarge', '环境检查输出不完整。');
          content += page.entries
            .filter((entry) => entry.stream === 'stdout')
            .map((entry) => entry.text)
            .join('');
          if (!page.entries.length) break;
          next = page.next;
        }
        return content;
      },
    });
    this.registerProjectHandlers('programs', {
      'programs.start': (input, context) => this.programs.start(input, context),
      'programs.run': (input, context) => this.programs.run(input, context),
      'programs.runs': (input, context) => this.programs.list(input, context),
      'programs.logs': (input, context) => this.programs.logs(input, context),
      'programs.cancel': (input, context) => this.programs.cancel(input, context),
      'programs.handoff': (input, context) => this.programs.handoff(input, context),
      'programs.reconcile': (input, context) => this.programs.reconcile(input, context),
      'programs.environments': (input, context) => this.programEnvironments.list(input, context),
      'programs.registerEnvironment': (input, context) =>
        this.programEnvironments.register(input, context),
      'programs.environmentPlan': (input, context) => this.programEnvironments.plan(input, context),
      'programs.environmentPlanStatus': (input, context) =>
        this.programEnvironments.planStatus(input, context),
      'programs.authorizeEnvironment': (input, context) =>
        this.programEnvironments.authorize(input, context),
      'programs.environmentPrepare': (input, context) =>
        this.programEnvironments.prepare(input, context),
    });
    this.broker.register('program-observer', {
      'programs.commandEvent': (input, context) => {
        if (
          context.moduleId !== 'kernel' ||
          context.role !== 'host' ||
          context.principal.kind !== 'system' ||
          context.principal.id !== this.hostInstanceId
        )
          throw new OperationError('permissionDenied', '无效程序观察来源。');
        return this.programs.event(input);
      },
    });
  }
  async initialize(): Promise<void> {
    await this.library.initialize();
    await this.projects.initialize();
    try {
      const registered: unknown = JSON.parse(
        readFileSync(join(this.directory, 'projects.json'), 'utf8'),
      );
      if (
        !Array.isArray(registered) ||
        registered.some(
          (path) =>
            typeof path !== 'string' ||
            !this.projects.all().some((store) => store.project.path === path),
        )
      )
        throw new OperationError('outcomeUnknown', '已登记项目无法全部核查，程序归属仍需确认。');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.programStartupProblem = new OperationError(
          'outcomeUnknown',
          '已登记项目无法完整核查；执行容量保留，需恢复可读后重启核查。',
        );
        while (this.processes.status.active < this.processes.status.limit) {
          const retained = this.processes.reserve();
          retained.retainUntil(new Promise<void>(() => {}));
          retained.release();
        }
      }
    }
    this.programs.initialize(this.projects.all().map((store) => store.project.id));
    await this.programEnvironments.initialize();
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
  protected async projectOpened(): Promise<void> {
    this.programs.initialize(this.projects.all().map((store) => store.project.id));
  }
  protected async projectReplacing(projectId: string): Promise<void> {
    await this.programs.releaseProject(projectId);
  }
  protected checkExecutionContext(_context: CallContext): void {
    throw new OperationError('unavailable', '当前组合没有执行实例提供者。');
  }
  protected commandWorkspace(workspaceId: string): CommandWorkspace {
    const program = this.programWorkspaces.get(workspaceId);
    if (program) return program;
    return {
      ...this.editor.commandWorkspace(workspaceId),
      ownerModuleId: 'editor',
      executables: new Map([
        ['quarto', 'quarto'],
        ['latexmk', 'latexmk'],
      ]),
    };
  }
  protected checkInstructionContext(_context: CallContext): void {
    throw new OperationError('unavailable', '当前组合没有指令接收者提供者。');
  }
  // Broker copies contexts but preserves signal identity; admission marks stay host-private.
  private readonly instructionAdmissions = new WeakSet<AbortSignal>();
  private readonly instructionResourcePorts = new WeakMap<
    CallContext,
    {
      port: Pick<ExecutionResourcePort, 'describe'> & Partial<Pick<ExecutionResourcePort, 'read'>>;
      check: (items: readonly ResourceEvidence[], libraryUsed?: boolean) => void;
    }
  >();
  private isInstructionAdmission(context: CallContext): boolean {
    return !!context.signal && this.instructionAdmissions.has(context.signal);
  }
  private checkResourceContext(context: CallContext): void {
    if (this.isInstructionAdmission(context)) {
      context.signal?.throwIfAborted();
      this.checkInstructionContext(context);
    } else this.checkExecutionContext(context);
  }
  protected instructionResources(context: CallContext) {
    const previous = this.instructionResourcePorts.get(context);
    if (previous) return previous;
    const admission = context.role === 'host';
    const signal = admission
      ? AbortSignal.any(context.signal ? [context.signal] : [])
      : context.signal;
    if (admission && signal) this.instructionAdmissions.add(signal);
    const source = Object.freeze({
      ...context,
      ...(signal ? { signal } : {}),
      ...(admission
        ? {
            workDomain: Object.freeze(
              context.projectId === 'application'
                ? {
                    kind: 'application' as const,
                    projectId: 'application' as const,
                    sessionId: context.sessionId as string,
                  }
                : {
                    kind: 'project' as const,
                    projectId: context.projectId as string,
                    sessionId: context.sessionId as string,
                  },
            ),
          }
        : {}),
    });
    const targets = this.projectTargetRead(source);
    const origin = source.projectId ? this.projects.get(source.projectId) : undefined;
    const scope = (locator: ResourceLocator): CallContext => {
      if (
        source.targetRead &&
        (locator.source !== 'project' || source.targetRead.targetProjectId !== locator.projectId)
      )
        throw new OperationError('permissionDenied', '不能扩大目标读取范围。');
      return locator.source === 'project' && locator.projectId !== source.projectId
        ? { ...source, targetRead: { targetProjectId: locator.projectId, access: 'read' } }
        : source;
    };
    const check = (items: readonly ResourceEvidence[], libraryUsed = false) => {
      if (!origin || this.projects.get(origin.project.id) !== origin)
        throw new OperationError('instanceMismatch', '来源项目实例已变化。');
      this.checkResourceContext(source);
      origin.check('send');
      if (libraryUsed) {
        this.library.check('read');
        this.library.check('send');
      }
      for (const item of items) {
        const ref = item.ref;
        this.resourceAuthorization(scope(ref), ref, false)();
        if (ref.source === 'project' && ref.projectId !== source.projectId)
          targets.check([ref.projectId]);
      }
    };
    const resources = {
      port: admission
        ? {
            describe: async (locator: ResourceLocator) => {
              const scoped = scope(locator);
              return this.resourceOperation(scoped, locator, false, () =>
                this.resources.describe(locator, scoped),
              );
            },
          }
        : this.executionResources(source),
      check,
    };
    this.instructionResourcePorts.set(context, resources);
    return resources;
  }
  executionResources(context: CallContext): ExecutionResourcePort {
    if (context.role !== 'execution' || context.principal.kind !== 'agent')
      throw new OperationError('permissionDenied', '资源执行端口需要活动执行身份。');
    this.checkExecutionContext(context);
    return executionResources(
      context,
      (source) => {
        const port = this.modulePort(source, 'harness');
        return {
          'resources.describe': (input) => port.call('resources.describe', input),
          'resources.read': (input) => port.call('resources.read', input),
          'resources.document': (input) => port.call('resources.document', input),
          'resources.save': (input) => port.call('resources.save', input),
          'resources.create': (input) => port.call('resources.create', input),
          'resources.creation': (input) => port.call('resources.creation', input),
        };
      },
      (source, resource) => this.savedResource(source, resource),
    );
  }
  protected async savedResource(
    _context: CallContext,
    resource: ResourceDescriptor,
  ): Promise<ResourceSaveResult> {
    return { resource };
  }
  protected async createdResource(
    _context: CallContext,
    resource: ResourceDescriptor,
    _scope: { sessionId?: string; runId?: string },
    _operationId: string,
  ): Promise<ResourceSaveResult> {
    return { resource };
  }
  private async resourceCreation(
    input: ResourceCreationInputs['resources.creation'],
    context: CallContext,
  ): Promise<ResourceCreationOutputs['resources.creation']> {
    const row = await this.projects
      .get(input.projectId)
      .creations.query(
        input.operationId,
        context.principal.kind === 'human' ? undefined : this.creationOwner(context),
      );
    const creation = row.details.creation;
    if (row.value.state !== 'complete' || !creation?.edit.fileId)
      return { operationId: input.operationId, state: 'unknown' };
    const { edit, resourceBasis } = creation;
    if (!resourceBasis) throw new OperationError('outcomeUnknown', '创建结果缺少资源读取版本。');
    const format = resourceFormatForName(edit.path);
    const resource: ResourceDescriptor = {
      ref: { source: 'project', projectId: input.projectId, fileId: creation.edit.fileId },
      name: edit.path.split('/').at(-1) ?? edit.path,
      path: edit.path,
      basis: resourceBasis,
      format,
      capabilities: {
        read: true,
        write: format === 'text',
        readingRecords: false,
        render: /\.(md|markdown|qmd|tex)$/i.test(edit.path),
      },
    };
    const result = await this.createdResource(
      context,
      resource,
      creation,
      `create-${input.operationId}`,
    );
    return {
      ...result,
      resource: {
        ...resource,
        ref: { source: 'project', projectId: input.projectId, fileId: creation.edit.fileId },
      },
      operationId: input.operationId,
      state: 'complete',
    };
  }
  private creationOwner(context: CallContext): string {
    return `${context.principal.kind}:${context.principal.id}:${context.sessionId ?? ''}`;
  }
  private async resourceOperation<T>(
    context: CallContext,
    ref: ResourceRef | { source: 'project'; projectId: string },
    write: boolean,
    action: () => Promise<T>,
  ): Promise<T> {
    if (context.role !== 'execution' && context.principal.kind !== 'agent') return action();
    const check = this.resourceAuthorization(context, ref, write);
    check();
    const result = await this.projects.withAccess(context, action, check);
    check();
    if (!this.isInstructionAdmission(context)) this.resourceUsed(context, ref);
    return result;
  }
  private resourceAuthorization(
    context: CallContext,
    ref: ResourceRef | { source: 'project'; projectId: string },
    write: boolean,
  ): () => void {
    const targets = this.projectTargetRead(context);
    const origin = context.projectId ? this.projects.get(context.projectId) : undefined;
    const check = () => {
      this.checkResourceContext(context);
      if (write && this.isInstructionAdmission(context))
        throw new OperationError('permissionDenied', '指令受理检查不提供资源写入。');
      if (
        (context.role !== 'execution' && !this.isInstructionAdmission(context)) ||
        !['harness', 'programs'].includes(context.moduleId) ||
        context.principal.kind !== 'agent' ||
        context.principal.id !== context.sessionId ||
        !context.projectId ||
        context.workDomain?.projectId !== context.projectId ||
        context.workDomain.sessionId !== context.sessionId ||
        context.workDomain.kind !==
          (context.projectId === 'application' ? 'application' : 'project')
      )
        throw new OperationError('permissionDenied', '资源调用缺少可信工作域。');
      if (!origin || this.projects.get(context.projectId) !== origin)
        throw new OperationError('instanceMismatch', '来源项目实例已变化。');
      if (origin.project.trust !== 'trusted')
        throw new OperationError('permissionDenied', '来源项目外发未授权。');
      if (ref.source === 'library') {
        if (context.targetRead)
          throw new OperationError('permissionDenied', '不能扩大目标读取范围。');
        this.library.check('read');
        this.library.check('send');
      } else if (context.targetRead) {
        if (write || context.targetRead.targetProjectId !== ref.projectId)
          throw new OperationError('permissionDenied', '目标资源只允许原范围读取。');
        targets.check([ref.projectId]);
      } else if (ref.projectId !== context.projectId || context.projectId === 'application') {
        throw new OperationError('permissionDenied', '资源不属于当前可读写项目。');
      }
    };
    return check;
  }
  protected resourceUsed(
    _context: CallContext,
    _ref: ResourceRef | { source: 'project'; projectId: string },
  ): void {}
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
  private readonly targetInstances = new WeakMap<
    AbortSignal,
    Map<string, ReturnType<Projects['get']>>
  >();
  projectTargetRead(
    context: CallContext,
  ): ProjectTargetReadPort & { check: (targetIds: Iterable<string>) => void } {
    const source = Object.freeze({
      ...context,
      principal: Object.freeze({ ...context.principal }),
      ...(context.workDomain ? { workDomain: Object.freeze({ ...context.workDomain }) } : {}),
      ...(context.targetRead ? { targetRead: Object.freeze({ ...context.targetRead }) } : {}),
    });
    const origin = source.projectId ? this.projects.get(source.projectId) : undefined;
    const targets =
      (source.signal ? this.targetInstances.get(source.signal) : undefined) ??
      new Map<string, ReturnType<Projects['get']>>();
    if (source.signal) this.targetInstances.set(source.signal, targets);
    return {
      check: (targetIds) => {
        this.checkResourceContext(source);
        if (origin?.project.trust !== 'trusted' || this.projects.get(origin.project.id) !== origin)
          throw new OperationError('permissionDenied', '来源项目信任或身份已变化。');
        for (const id of targetIds) {
          const target = this.projects.get(id);
          if (
            id === 'application' ||
            target.project.trust !== 'trusted' ||
            (targets.has(id) && targets.get(id) !== target)
          )
            throw new OperationError('permissionDenied', '目标项目信任或身份已变化。');
          targets.set(id, target);
        }
      },
      'project.readTarget': async (input) => {
        this.checkResourceContext(source);
        if (source.targetRead && source.targetRead.targetProjectId !== input.targetProjectId)
          throw new OperationError('permissionDenied', '不能扩大目标只读访问范围。');
        const target = this.projects.get(input.targetProjectId);
        if (targets.has(input.targetProjectId) && targets.get(input.targetProjectId) !== target)
          throw new OperationError('instanceMismatch', '目标项目实例已变化。');
        const scoped: CallContext = {
          ...source,
          targetRead: { targetProjectId: input.targetProjectId, access: 'read' },
        };
        const result = await this.modulePort(scoped, 'harness').call('project.readTarget', input);
        if (targets.has(input.targetProjectId) && targets.get(input.targetProjectId) !== target)
          throw new OperationError('instanceMismatch', '目标项目实例已变化。');
        targets.set(input.targetProjectId, target);
        return result;
      },
    };
  }
  harnessProject(context: CallContext): HarnessProjectPort {
    const port = this.modulePort(context, 'harness');
    return {
      'project.check': (input) => port.call('project.check', input),
      'project.path': (input) => port.call('project.path', input),
      'project.material': (input) => port.call('project.material', input),
      'files.read': (input) => port.call('files.read', input),
      'files.resolve': (input) => port.call('files.resolve', input),
      'files.readBytes': (input) => port.call('files.readBytes', input),
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

  private programChanged(projectId: string, runId: string) {
    const change: WorkbenchChange = {
      revision: ++this.revision,
      projectId,
      resync: false,
      programsChanged: true,
      programRunIds: [runId],
    };
    for (const listener of this.listeners) listener(change);
  }
  private async programAccess(projectId: string, context: CallContext, write = false) {
    if (projectId === 'application' || context.targetRead)
      throw new OperationError('permissionDenied', '当前范围不允许程序访问。');
    context.signal?.throwIfAborted();
    if (context.principal.kind === 'agent') {
      if (
        context.workDomain?.kind !== 'project' ||
        context.projectId !== projectId ||
        context.workDomain.projectId !== projectId ||
        context.principal.id !== context.sessionId
      )
        throw new OperationError('permissionDenied', '程序不属于当前项目工作域。');
      this.checkExecutionContext(context);
    }
    await this.projects.withAccess(context, () =>
      this.projects.get(projectId).check(write ? 'write' : 'read'),
    );
  }

  private readonly foundationHandlers: Pick<
    Handlers<BusinessInputs, BusinessOutputs>,
    Exclude<FoundationMethod, keyof ProgramsInputs>
  > = {
    'resources.create': (input, context) =>
      this.resourceOperation(
        context,
        { source: 'project', projectId: input.projectId },
        true,
        async () => {
          const store = this.projects.get(input.projectId);
          try {
            await store.save(input.path, input.content, undefined, undefined, undefined, {
              operationId: input.operationId,
              owner: this.creationOwner(context),
              ...(context.sessionId ? { sessionId: context.sessionId } : {}),
              ...(context.runId ? { runId: context.runId } : {}),
            });
          } catch (error) {
            if (!(error instanceof OperationError) || error.code !== 'outcomeUnknown') throw error;
            return { operationId: input.operationId, state: 'unknown' as const };
          }
          this.changed(input.projectId);
          return this.resourceCreation(input, context);
        },
      ),
    'resources.creation': (input, context) =>
      this.resourceOperation(
        context,
        { source: 'project', projectId: input.projectId },
        false,
        () => this.resourceCreation(input, context),
      ),
    'resources.cancel': (input, context) => this.resources.cancel(input.requestId, context),
    'resources.describe': (input, context) =>
      this.resourceOperation<BusinessOutputs['resources.describe']>(
        context,
        input.locator,
        false,
        () => this.resources.describe(input.locator, context),
      ),
    'resources.read': (input, context) =>
      this.resourceOperation(context, input.ref, false, () => this.resources.read(input, context)),
    'resources.document': (input, context) =>
      this.resourceOperation(context, input.ref, false, () =>
        this.resources.document(input, context),
      ),
    'resources.save': async (input, context) => {
      const result = await this.resourceOperation<BusinessOutputs['resources.save']>(
        context,
        input.ref,
        true,
        () => this.resources.save(input, context),
      );
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
      this.programs.assertIdle(input.projectId);
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
  connectProduct() {
    const source = this.workbenchContexts.connect();
    let connected = true;
    const port = this.broker.consumer(
      {
        moduleId: 'product',
        principal: { kind: 'human', id: 'local' },
        role: 'product',
        workbenchSource: source,
      },
      Object.keys(businessSchemas) as BusinessMethod[],
    );
    return {
      call: async <A extends CallArguments<BusinessInputs>>(
        ...args: A
      ): Promise<BusinessOutputs[A[0]]> => {
        if (!connected) throw new OperationError('unavailable', '工作台连接已关闭。');
        return port.call<A>(...args);
      },
      close: () => {
        connected = false;
        this.workbenchContexts.disconnect(source);
      },
    };
  }
  available(): BusinessMethod[] {
    return this.broker.available(Object.keys(businessSchemas) as BusinessMethod[]);
  }
  async close(): Promise<void> {
    await this.commandRunner.close();
    await this.programs.close();
    await this.resourceReading.close();
    await this.editor.close();
    this.fileWatches.close();
    await this.transfers.close();
    await this.library.close();
    await this.projects.close();
  }
}
