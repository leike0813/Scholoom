import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Handlers } from '@scholoom/broker';
import {
  type ContextBridge,
  type ExecutionGraphs,
  Harness,
  type HarnessProject,
  HarnessRecords,
  type HarnessStorage,
} from '@scholoom/harness/node';
import { ModelAccess } from '@scholoom/models/execution';
import { CredentialStore, ModelConfigStore } from '@scholoom/models/node';
import { ProgramRecords } from '@scholoom/programs/node';
import type {
  BusinessInputs,
  BusinessOutputs,
  BusinessParams,
  DelegationRole,
  HarnessModuleInputs,
  HarnessModuleOutputs,
  ResourceCreationInputs,
  ResourceDescriptor,
  ResourceEvidence,
  ResourceRef,
  ResourceSaveResult,
  TaskResearchPort,
  WorkbenchContextInputs,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import type { CallContext } from '@scholoom/protocol/core';
import { OperationError } from '@scholoom/protocol/core';
import type { ProgramToolsPort } from '@scholoom/protocol/programs';
import type {
  ResearchGraph,
  ResearchModuleInputs,
  ResearchModuleOutputs,
  ResearchProgressPort,
  ResearchToolsPort,
} from '@scholoom/protocol/research';
import { ResearchRecords, ResearchRuntime, researchDelegationRoles } from '@scholoom/research/node';
import { executionGraphs } from './execution-graphs.js';
import { type FileExecutionFacts, type FoundationMethod, ManualApplication } from './manual.js';
import type { IsolatedZotero, ZoteroRuntime } from './zotero.js';

type RuntimeMethod = Exclude<
  keyof BusinessInputs,
  FoundationMethod | keyof ResourceCreationInputs | keyof WorkbenchContextInputs
>;
export class KernelApplication extends ManualApplication {
  readonly credentials: CredentialStore;
  readonly models: ModelAccess;
  readonly modelConfigs: ModelConfigStore;
  readonly harness: Harness;
  readonly research: ResearchRuntime;
  private readonly originFacts:
    | ((
        context: CallContext,
      ) => FileExecutionFacts | undefined | Promise<FileExecutionFacts | undefined>)
    | undefined;
  private readonly graphAdmissions = new WeakMap<AbortSignal, () => void>();
  constructor(
    directory: string,
    options: {
      modelEndpoint?: string;
      environment?: NodeJS.ProcessEnv;
      contextResources?: ContextBridge['resources'];
      executionGraphs?: ExecutionGraphs;
      researchGraphs?: readonly ResearchGraph[];
      workerEntry?: URL;
      fileExecutionFacts?: (
        context: CallContext,
      ) => FileExecutionFacts | undefined | Promise<FileExecutionFacts | undefined>;
      taskResearch?: TaskResearchPort;
      delegationRoles?: readonly DelegationRole[];
      isolatedZotero?: IsolatedZotero;
      zoteroRuntime?: ZoteroRuntime;
    } = {},
  ) {
    super(directory, options.taskResearch, options.isolatedZotero, options.zoteroRuntime);
    this.originFacts = options.fileExecutionFacts;
    process.env.LANGSMITH_TRACING = 'false';
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    this.credentials = new CredentialStore(join(directory, 'credentials'), options.environment);
    const configs = new ModelConfigStore(join(directory, 'credentials'));
    this.modelConfigs = configs;
    this.models = new ModelAccess(this.credentials, configs, options.modelEndpoint);
    this.research = new ResearchRuntime(
      (projectId, sessionId) => {
        this.projects.get(projectId).touch();
        this.changed(projectId, sessionId);
      },
      {
        records: (projectId) => new ResearchRecords(this.projects.get(projectId).internal),
        files: (context) => this.researchFiles(context),
        session: (input) =>
          this.modulePort(
            { moduleId: 'research', principal: { kind: 'system', id: 'host' }, role: 'host' },
            'research',
          ).call('session.check', input),
        execute: async (input, context) => {
          await this.modulePort(context, 'research').call('harness.execute', input);
        },
        graphs: {
          start: (input, context) =>
            this.modulePort(
              {
                moduleId: 'research',
                role: 'host',
                principal: { kind: 'system', id: 'research' },
                projectId: input.projectId,
                sessionId: input.sessionId,
                ...(context?.workbenchSource ? { workbenchSource: context.workbenchSource } : {}),
                ...(context?.signal ? { signal: context.signal } : {}),
              },
              'research',
            ).call('harness.startGraph', input),
          executions: (input) =>
            this.modulePort(
              {
                moduleId: 'research',
                role: 'host',
                principal: { kind: 'system', id: 'research' },
                projectId: input.projectId,
                sessionId: input.sessionId,
              },
              'research',
            ).call('harness.executions', input),
          read: (input, context) =>
            context.role === 'execution'
              ? this.executionResources(context).read(input)
              : this.modulePort(context, 'research').call('resources.read', input),
          verifySave: async ({ projectId, sessionId, run, result }, context) => {
            const unknown = { saved: 'unknown' as const, associated: false };
            const { ref, basis } = result.resource;
            if (
              ref.source !== 'project' ||
              ref.projectId !== projectId ||
              run.sessionId !== sessionId
            )
              return unknown;
            this.checkFileHistoryContext(context);
            const port = this.modulePort(
              context,
              context.role === 'execution' ? 'harness' : 'research',
            );
            await port.call('project.check', { projectId, access: 'read' });
            const linked = await port.call('project.artifacts', {
              projectId,
              sessionId,
              item: { runId: run.id, fileId: ref.fileId },
            });
            const associated = linked.some(
              (item) =>
                item.runId === run.id && item.fileId === ref.fileId && item.state === 'linked',
            );
            if (!result.editId) return { ...unknown, associated };
            let edit: BusinessOutputs['files.edit'];
            try {
              edit = await port.call('files.edit', {
                projectId,
                fileId: ref.fileId,
                editId: result.editId,
              });
            } catch (error) {
              if (error instanceof OperationError && error.code === 'notFound')
                return { ...unknown, associated };
              throw error;
            }
            const origin = edit.origin;
            const saved =
              edit.id === result.editId &&
              edit.fileId === ref.fileId &&
              edit.afterEvidence?.basis === basis &&
              isDeepStrictEqual(edit.afterEvidence.ref, ref) &&
              origin?.kind === 'execution' &&
              origin.projectId === projectId &&
              origin.sessionId === sessionId &&
              origin.principal.id === sessionId &&
              origin.runId === run.id &&
              Boolean(origin.instanceId);
            return { saved: saved ? 'confirmed' : 'unknown', associated };
          },
          request: {
            authorize: async (input, context) => {
              const taskCheck = context.signal && this.graphAdmissions.get(context.signal);
              const resources = this.instructionResources({
                moduleId: 'harness',
                role: 'host',
                principal: { kind: 'agent', id: input.sessionId },
                projectId: input.projectId,
                sessionId: input.sessionId,
                ...(context.signal ? { signal: context.signal } : {}),
              });
              resources.check(input.materials);
              for (const material of input.materials) {
                const current = await resources.port.describe(material.ref);
                if (
                  !isDeepStrictEqual(current.ref, material.ref) ||
                  current.basis !== material.basis
                )
                  throw new OperationError('contentChanged', '科研材料身份或版本已变化。');
                if (!current.capabilities.read)
                  throw new OperationError(
                    'unavailable',
                    current.unavailableReason ?? '科研材料当前不可读。',
                  );
              }
              return () => {
                resources.check(input.materials);
                taskCheck?.();
              };
            },
            start: async (input, context, check) => {
              const signal = AbortSignal.any(context.signal ? [context.signal] : []);
              this.graphAdmissions.set(signal, () => {
                signal.throwIfAborted();
                check();
                const session = this.harness.getSession(input.projectId, input.sessionId);
                if (['queued', 'running', 'cancelling', 'waiting'].includes(session.state))
                  throw new OperationError(
                    'invalidRequest',
                    '会话已有未完成推进，不能切换科研图。',
                  );
              });
              try {
                return await this.modulePort(
                  {
                    moduleId: 'research',
                    role: 'host',
                    principal: { kind: 'system', id: 'research' },
                    projectId: input.projectId,
                    sessionId: input.sessionId,
                    ...(context.workbenchSource
                      ? { workbenchSource: context.workbenchSource }
                      : {}),
                    signal,
                  },
                  'research',
                ).call('research.startGraph', input);
              } finally {
                this.graphAdmissions.delete(signal);
              }
            },
          },
        },
      },
      options.researchGraphs,
    );
    this.harness = new Harness(
      this.harnessStorage(),
      {
        execution: (...args) => this.models.execution(...args),
        credentials: { status: () => this.models.credentials.status() },
      },
      configs,
      (context) => this.researchTools(context),
      (context) => this.libraryTools(context),
      (projectId, sessionId, sessionsChanged) =>
        this.changed(projectId, sessionId, sessionsChanged),
      (context) => this.harnessProject(context),
      (context) => this.projectFiles(context),
      (context) => this.researchProgress(context),
      this.processes,
      options.workerEntry ?? new URL('./execution-worker.js', import.meta.url),
      options.executionGraphs ?? executionGraphs,
      (context) => this.projectTargetRead(context),
      {
        read: (source, receiver) => this.workbenchContexts.read(source, receiver),
        resources: options.contextResources ?? ((context) => this.instructionResources(context)),
        catalog: (context) => ({
          read: (input) =>
            this.broker
              .consumer({ ...context, moduleId: 'harness' }, ['library.selection'])
              .call('library.selection', input),
          check: (libraryId) => {
            this.instructionResources(context).check([], true);
            this.library.checkSelection({ libraryId });
          },
        }),
      },
      (context) => this.executionResources(context),
      (context) => this.projectTasks(context),
      {
        roles: options.delegationRoles ?? researchDelegationRoles,
        resolveProfile: (id, context) =>
          this.modulePort(context, 'harness').call('models.resolveProfile', { id }),
      },
      {
        port: (context) => {
          const port = this.modulePort(context, 'harness');
          const methods = {
            'programs.environments': (input) => port.call('programs.environments', input),
            'programs.environmentPlan': (input) => port.call('programs.environmentPlan', input),
            'programs.environmentPlanStatus': (input) =>
              port.call('programs.environmentPlanStatus', input),
            'programs.environmentPrepare': (input) =>
              port.call('programs.environmentPrepare', input),
            'programs.start': (input) => port.call('programs.start', input),
            'programs.run': (input) => port.call('programs.run', input),
            'programs.runs': (input) => port.call('programs.runs', input),
            'programs.logs': (input) => port.call('programs.logs', input),
            'programs.cancel': (input) => port.call('programs.cancel', input),
            'programs.reconcile': (input) => port.call('programs.reconcile', input),
          } satisfies ProgramToolsPort;
          return methods;
        },
        settle: (context) => this.programs.settleExecution(context),
      },
      (context) => this.zoteroTools(context),
    );
    this.broker.register('runtime', this.handlers);
    this.broker.register('runtime-internal', {
      'harness.executionFacts': (_input, context) => this.harness.executionFacts(context),
      'harness.executions': (input, context) => {
        if (
          context.role !== 'host' ||
          context.principal.kind !== 'system' ||
          (context.projectId && context.projectId !== input.projectId) ||
          (context.sessionId && context.sessionId !== input.sessionId)
        )
          throw new OperationError('permissionDenied', '执行历史需要所属宿主查询。');
        return this.harness.executions(input);
      },
      'research.startGraph': (input, context) => this.research.graphCalls.start(input, context),
      'harness.startGraph': (input, context) => {
        if (context.role !== 'host' || context.principal.kind !== 'system')
          throw new OperationError('permissionDenied', '图选择需要所属领域的宿主入口。');
        return this.harness.send(
          {
            projectId: input.projectId,
            sessionId: input.sessionId,
            instructionId: input.instructionId,
            text: input.text,
            materials: [],
          },
          context.workbenchSource,
          input.execution,
          context.signal ? this.graphAdmissions.get(context.signal) : undefined,
        );
      },
      'models.status': () => this.models.status(),
      'models.resolveProfile': ({ id }) => configs.resolveProfile(id),
      'harness.delegate': (input, context) => this.harness.delegate(input, context),
      'harness.waitDelegation': (input, context) => this.harness.waitDelegation(input, context),
      'harness.reportDelegation': (input, context) => this.harness.reportDelegation(input, context),
      'harness.roles': () => this.harness.delegationRoles(),
      'harness.snapshot': (input) =>
        this.harness.snapshot(
          input.projectId,
          input.sessionId,
          input.before,
          input.limit,
          input.includeSessions,
        ),
      'session.check': ({ projectId, sessionId }) => this.harness.getSession(projectId, sessionId),
      'harness.execute': async (input, context) => {
        await this.harness.executeCapability(input, context);
        return { ok: true };
      },
      'research.invoke': (input, context) => {
        const { projectId, sessionId, runId, instanceId, signal } = context;
        if (
          context.role !== 'execution' ||
          !projectId ||
          !sessionId ||
          !runId ||
          !instanceId ||
          !signal
        )
          throw new OperationError('permissionDenied', '科研调用缺少可信执行身份。');
        return this.research.invoke(input, {
          projectId,
          sessionId,
          runId,
          instanceId,
          signal,
          isStopping: () => this.harness.isStopping,
        });
      },
      'research.progress': (input, context) => this.research.progress(input, context),
    });
  }
  protected override checkExecutionContext(context: CallContext): void {
    this.harness.checkExecutionContext(context);
  }
  protected override taskResearchPort(): TaskResearchPort {
    return (
      super.taskResearchPort() ?? {
        graphs: async (input, context) => {
          const result = await this.modulePort(context, 'projects').call('research.graphs', input);
          return {
            graphs: result.descriptions.map(({ definition, name }) => ({ definition, name })),
            ...(result.nextOffset === undefined ? {} : { nextOffset: result.nextOffset }),
          };
        },
        start: async (input, context, catalog = []) => {
          const signal = AbortSignal.any(context.signal ? [context.signal] : []);
          const sources = structuredClone(catalog);
          const check = () => {
            signal.throwIfAborted();
            for (const item of sources) {
              this.library.checkSelection(item);
              const current = this.library.get(item.sourceId);
              if (current.version !== item.version || current.revision !== item.revision)
                throw new OperationError('contentChanged', '任务题录在科研受理期间已变化。');
            }
          };
          check();
          this.graphAdmissions.set(signal, check);
          try {
            return await this.modulePort({ ...context, signal }, 'projects').call(
              'research.requestGraph',
              input,
            );
          } finally {
            this.graphAdmissions.delete(signal);
          }
        },
      }
    );
  }
  startGraph(
    input: HarnessModuleInputs['harness.startGraph'],
  ): Promise<HarnessModuleOutputs['harness.startGraph']> {
    return this.modulePort(
      { moduleId: 'research', role: 'host', principal: { kind: 'system', id: 'source-graph' } },
      'research',
    ).call('harness.startGraph', input);
  }
  startResearchGraph(
    input: ResearchModuleInputs['research.startGraph'],
  ): Promise<ResearchModuleOutputs['research.startGraph']> {
    return this.modulePort(
      { moduleId: 'research', role: 'host', principal: { kind: 'system', id: 'research' } },
      'research',
    ).call('research.startGraph', input);
  }
  protected override checkInstructionContext(context: CallContext): void {
    if (
      context.moduleId !== 'harness' ||
      context.role !== 'host' ||
      context.principal.kind !== 'agent' ||
      context.principal.id !== context.sessionId ||
      !context.projectId ||
      !context.sessionId ||
      context.runId ||
      context.instanceId
    )
      throw new OperationError('permissionDenied', '缺少可信指令接收者。');
    this.harness.getSession(context.projectId, context.sessionId);
  }
  protected override resourceUsed(
    context: CallContext,
    ref: ResourceRef | { source: 'project'; projectId: string },
  ): void {
    this.harness.recordResourceUse(context, ref);
  }
  protected override reportUsed(context: CallContext, evidence: readonly ResourceEvidence[]): void {
    if (context.role === 'host') this.checkInstructionContext(context);
    this.harness.recordReportUse(context, evidence);
  }
  protected override checkReportContext(
    context: CallContext,
    evidence: readonly ResourceEvidence[],
  ): void {
    if (context.role !== 'execution') return;
    this.harness.checkReportContext(context, evidence);
  }
  protected override async executionFileFacts(
    context: CallContext,
  ): Promise<FileExecutionFacts | undefined> {
    if (this.originFacts) return this.originFacts(context);
    const facts = await this.executionFacts(context);
    if (facts.state !== 'verified') return undefined;
    return {
      projectId: facts.projectId,
      sessionId: facts.sessionId,
      runId: facts.runId,
      instanceId: facts.instanceId,
      ...(facts.delegation.state === 'verified'
        ? {
            delegation: {
              delegationId: facts.delegation.delegationId,
              parentInstanceId: facts.delegation.parentInstanceId,
              parentRunId: facts.delegation.parentRunId,
            },
          }
        : {}),
    };
  }
  protected override checkFileHistoryContext(context: CallContext): void {
    if (context.principal.kind === 'agent') this.harness.checkFileHistoryContext(context);
  }
  protected override async savedResource(
    context: CallContext,
    resource: ResourceDescriptor,
  ): Promise<ResourceSaveResult> {
    this.checkExecutionContext(context);
    if (
      resource.ref.source !== 'project' ||
      !resource.path ||
      !context.projectId ||
      !context.sessionId ||
      !context.runId
    )
      throw new OperationError('permissionDenied', '保存结果缺少所属执行。');
    const association = await this.harness.recordSavedResource(
      context.projectId,
      context.sessionId,
      context.runId,
      resource.path,
      resource.ref.fileId,
      { resourceBasis: resource.basis },
    );
    this.checkExecutionContext(context);
    return { ...(await super.savedResource(context, resource)), association };
  }
  protected override async createdResource(
    context: CallContext,
    resource: ResourceDescriptor,
    scope: { sessionId?: string; runId?: string },
    operationId: string,
  ): Promise<ResourceSaveResult> {
    if (!scope.sessionId || !scope.runId || resource.ref.source !== 'project' || !resource.path)
      return { resource };
    if (context.role === 'execution') this.checkExecutionContext(context);
    const association = await this.harness.recordSavedResource(
      resource.ref.projectId,
      scope.sessionId,
      scope.runId,
      resource.path,
      resource.ref.fileId,
      { resourceBasis: resource.basis },
      operationId,
    );
    if (context.role === 'execution') this.checkExecutionContext(context);
    return { resource, association };
  }
  executionFacts(context: CallContext): Promise<HarnessModuleOutputs['harness.executionFacts']> {
    // The broker rejects cancelled calls before dispatch; no execution can be verified then.
    if (context.signal?.aborted) return Promise.resolve({ state: 'unknown' });
    return this.modulePort(context, 'kernel').call('harness.executionFacts', {});
  }

  harnessStorage(): HarnessStorage {
    const resources = new Map<string, HarnessProject>();
    const get = (id: string): HarnessProject => {
      const project = this.projects.get(id);
      let resource = resources.get(id);
      if (!resource || resource.internal !== project.internal) {
        resource = {
          id,
          internal: project.internal,
          records: new HarnessRecords(project.internal),
        };
        resources.set(id, resource);
      }
      return resource;
    };
    return {
      get,
      all: () => this.projects.all().map((project) => get(project.project.id)),
      touch: (id) => this.projects.get(id).touch(),
    };
  }
  researchTools(context: CallContext): ResearchToolsPort {
    const port = this.modulePort(context, 'harness');
    return {
      'research.graphs': (input) => port.call('research.graphs', input),
      'research.graph': (input) => port.call('research.graph', input),
      'research.graphCalls': (input) => port.call('research.graphCalls', input),
      'research.methods': (input) => port.call('research.methods', input),
      'research.method': (input) => port.call('research.method', input),
      'research.attempts': (input) => port.call('research.attempts', input),
      'research.invoke': (input) => port.call('research.invoke', input),
    };
  }
  researchProgress(context: CallContext): ResearchProgressPort {
    const port = this.modulePort(context, 'harness');
    return (input) => port.call('research.progress', input);
  }
  override async initialize(report: (phase: string) => void = () => {}): Promise<void> {
    await super.initialize(report);
    report('initializing-harness');
    await this.harness.initialize();
    report('harness-initialized');
    report('initializing-research');
    for (const project of this.projects.all()) this.research.initialize(project.project.id);
    report('research-initialized');
  }
  protected override async projectOpened(): Promise<void> {
    await super.projectOpened();
    await this.harness.initialize();
    for (const project of this.projects.all()) this.research.initialize(project.project.id);
  }
  protected override async projectReplacing(projectId: string): Promise<void> {
    await super.projectReplacing(projectId);
    await this.harness.releaseProject(projectId);
    this.research.releaseProject(projectId);
  }
  async snapshot(input: BusinessParams<'workbench.snapshot'>): Promise<WorkbenchSnapshot> {
    const { navigationProjectIds: _navigationProjectIds, ...scope } = input;
    const port = this.modulePort(
      { moduleId: 'kernel', role: 'host', principal: { kind: 'system', id: 'projection' } },
      'kernel',
    );
    return {
      revision: this.revision,
      provider: await port.call('models.status', {}),
      projects: await port.call('projects.list', {}),
      ...(input.projectId
        ? { fileRevision: await port.call('project.fileRevision', { projectId: input.projectId }) }
        : {}),
      ...(await port.call('harness.snapshot', scope)),
    };
  }

  readonly handlers: Pick<Handlers<BusinessInputs, BusinessOutputs>, RuntimeMethod> = {
    'research.requestGraph': (input, context) => this.research.graphCalls.request(input, context),
    'research.graphs': (input) => this.research.graphs.discover(input),
    'research.graph': (input) => this.research.graphs.describe(input),
    'research.graphCalls': (input, context) => this.research.graphCalls.list(input, context),
    'research.methods': async () => {
      return this.research.content.discover();
    },
    'research.method': async (input) => {
      const p = input;
      return this.research.content.resolve(p.methodId, p.version);
    },
    'research.attempts': async (input) => {
      const p = input;
      return this.research.list(p);
    },
    'workbench.snapshot': async (input) => {
      return this.snapshot(input);
    },
    'workbench.watch': async (input) => {
      return this.snapshot(input);
    },
    'provider.configure': async (input) => {
      await this.credentials.save(input.apiKey);
      const value = await this.models.status();
      this.changed();
      return value;
    },
    'provider.setDefaults': async (input) => {
      const value = await this.models.setDefaults(input);
      this.changed();
      return value;
    },
    'provider.profiles': (input) => this.modelConfigs.profiles(input),
    'provider.saveProfile': async (input) => {
      const value = await this.modelConfigs.saveProfile(input);
      this.changed();
      return value;
    },
    'provider.removeProfile': async (input) => {
      await this.modelConfigs.removeProfile(input);
      this.changed();
      return { ok: true };
    },
    'delegation.get': (input) => this.harness.getDelegation(input),
    'delegation.list': (input) => this.harness.listDelegations(input),
    'delegation.cancel': (input) => this.harness.cancelDelegation(input),
    'artifacts.reconcile': async (input) => {
      const p = input;
      return this.harness.reconcile(p.projectId, p.sessionId, p.runId, p.paths);
    },
    'project.restore': async (input) => {
      const p = input;
      const target = await this.projects.get(p.projectId).restore(p.backupId, p.destination);
      const internal = join(target, '.scholoom');
      const identity = JSON.parse(await readFile(join(internal, 'identity.json'), 'utf8')) as {
        id: string;
      };
      const harnessRecords = new HarnessRecords(internal);
      const researchRecords = new ResearchRecords(internal);
      const programRecords = new ProgramRecords(internal);
      try {
        harnessRecords.restore(identity.id);
        researchRecords.restore(identity.id);
        programRecords.restore(identity.id);
      } finally {
        harnessRecords.close();
        researchRecords.close();
        programRecords.close();
      }
      const store = await this.projects.open(target);
      await this.harness.initialize();
      this.changed();
      return store.project;
    },
    'session.create': async (input) => {
      const p = input;
      return this.harness.create(p.projectId, p.title);
    },
    'session.list': async (input) => {
      return this.harness.list(input);
    },
    'session.search': async (input) => {
      return this.harness.search(input);
    },
    'session.rename': async (input) => {
      const p = input;
      return this.harness.rename(p.projectId, p.sessionId, p.title);
    },
    'session.archive': async (input) => {
      const p = input;
      return this.harness.archive(p.projectId, p.sessionId, p.archived);
    },
    'session.configure': async (input) => {
      const p = input;
      return this.harness.configure(p.projectId, p.sessionId, p.modelConfig);
    },
    'session.send': async (input, context) => {
      return this.harness.send(input, context.workbenchSource);
    },
    'session.cancel': async (input) => {
      const p = input;
      this.harness.cancel(p.projectId, p.sessionId);
      return { ok: true };
    },
  };
  override async close(): Promise<void> {
    await this.harness.close();
    this.research.close();
    await super.close();
  }
}
