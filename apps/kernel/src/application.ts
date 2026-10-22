import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Handlers } from '@scholoom/broker';
import {
  Harness,
  type HarnessProject,
  HarnessRecords,
  type HarnessStorage,
} from '@scholoom/harness/node';
import { ModelAccess } from '@scholoom/models/execution';
import { CredentialStore, ModelConfigStore } from '@scholoom/models/node';
import type {
  BusinessInputs,
  BusinessOutputs,
  BusinessParams,
  ResourceCreationInputs,
  WorkbenchContextInputs,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import type { CallContext } from '@scholoom/protocol/core';
import { OperationError } from '@scholoom/protocol/core';
import type { ResearchProgressPort, ResearchToolsPort } from '@scholoom/protocol/research';
import { ResearchRecords, ResearchRuntime } from '@scholoom/research/node';
import { type FoundationMethod, ManualApplication } from './manual.js';

type RuntimeMethod = Exclude<
  keyof BusinessInputs,
  FoundationMethod | keyof ResourceCreationInputs | keyof WorkbenchContextInputs
>;
export class KernelApplication extends ManualApplication {
  readonly credentials: CredentialStore;
  readonly models: ModelAccess;
  readonly harness: Harness;
  readonly research: ResearchRuntime;
  constructor(
    directory: string,
    options: { modelEndpoint?: string; environment?: NodeJS.ProcessEnv } = {},
  ) {
    super(directory);
    process.env.LANGSMITH_TRACING = 'false';
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    this.credentials = new CredentialStore(join(directory, 'credentials'), options.environment);
    const configs = new ModelConfigStore(join(directory, 'credentials'));
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
      },
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
      (context) => this.projectTargetRead(context),
    );
    this.broker.register('runtime', this.handlers);
    this.broker.register('runtime-internal', {
      'models.status': () => this.models.status(),
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
  override async initialize(): Promise<void> {
    await super.initialize();
    await this.harness.initialize();
    for (const project of this.projects.all()) this.research.initialize(project.project.id);
  }
  protected override async projectOpened(): Promise<void> {
    await this.harness.initialize();
    for (const project of this.projects.all()) this.research.initialize(project.project.id);
  }
  protected override async projectReplacing(projectId: string): Promise<void> {
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
      try {
        harnessRecords.restore(identity.id);
        researchRecords.restore();
      } finally {
        harnessRecords.close();
        researchRecords.close();
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
    'session.send': async (input) => {
      return this.harness.send(input);
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
