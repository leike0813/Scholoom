import { join } from 'node:path';
import type {
  BusinessMethod,
  BusinessParams,
  WorkbenchChange,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { CredentialStore } from './credentials/store.js';
import { Harness } from './harness/runtime.js';
import { ModelAccess } from './models/minimax.js';
import { Projects } from './projects/store.js';

export class KernelApplication {
  readonly projects: Projects;
  readonly credentials: CredentialStore;
  readonly harness: Harness;
  private revision = 0;
  private listeners = new Set<(change: WorkbenchChange) => void>();

  constructor(
    directory: string,
    options: { modelEndpoint?: string; environment?: NodeJS.ProcessEnv } = {},
  ) {
    process.env.LANGSMITH_TRACING = 'false';
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    this.projects = new Projects(directory);
    this.credentials = new CredentialStore(join(directory, 'credentials'), options.environment);
    this.harness = new Harness(
      this.projects,
      new ModelAccess(this.credentials, options.modelEndpoint),
      (projectId, sessionId) => this.changed(projectId, sessionId),
    );
  }

  async initialize(): Promise<void> {
    await this.projects.initialize();
    await this.harness.initialize();
  }
  subscribe(listener: (change: WorkbenchChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private changed(projectId?: string, sessionId?: string): void {
    const change: WorkbenchChange = { revision: ++this.revision, resync: true };
    if (projectId) change.projectId = projectId;
    if (sessionId) change.sessionId = sessionId;
    for (const listener of this.listeners) listener(change);
  }

  async snapshot(input: BusinessParams<'workbench.snapshot'>): Promise<WorkbenchSnapshot> {
    return {
      revision: this.revision,
      provider: await this.credentials.status(),
      projects: this.projects.list(),
      ...(input.projectId
        ? { fileRevision: this.projects.get(input.projectId).files.revision }
        : {}),
      ...this.harness.snapshot(input.projectId, input.sessionId, input.before, input.limit),
    };
  }

  async call(method: BusinessMethod, input: unknown): Promise<unknown> {
    // Dispatch after protocol validation; each branch consumes its schema's inferred type.
    switch (method) {
      case 'workbench.snapshot':
      case 'workbench.watch':
        return this.snapshot(input as BusinessParams<'workbench.snapshot'>);
      case 'provider.configure': {
        const value = await this.credentials.save(
          (input as BusinessParams<'provider.configure'>).apiKey,
        );
        this.changed();
        return value;
      }
      case 'project.open': {
        const store = await this.projects.open((input as BusinessParams<'project.open'>).path);
        await this.harness.initialize();
        this.changed();
        return store.project;
      }
      case 'project.create': {
        const p = input as BusinessParams<'project.create'>;
        const store = await this.projects.create(p.path, p.name);
        await this.harness.initialize();
        this.changed();
        return store.project;
      }
      case 'project.rename': {
        const p = input as BusinessParams<'project.rename'>;
        const result = this.projects.get(p.projectId).renameProject(p.name);
        this.changed();
        return result;
      }
      case 'project.forget': {
        await this.projects.forget((input as BusinessParams<'project.forget'>).projectId);
        this.changed();
        return { ok: true };
      }
      case 'files.mkdir':
      case 'files.rename':
      case 'files.trash':
      case 'files.restore': {
        const p = input as BusinessParams<'files.rename'> & BusinessParams<'files.restore'>;
        const { projectId, operationId, ...values } = p;
        try {
          return await this.projects
            .get(projectId)
            .files.mutate(
              method.slice(6) as 'mkdir' | 'rename' | 'trash' | 'restore',
              operationId,
              values,
            );
        } finally {
          this.changed(projectId);
        }
      }
      case 'files.resolve': {
        const p = input as BusinessParams<'files.resolve'>;
        return this.projects.get(p.projectId).files.resolve(p.fileIds);
      }
      case 'files.trashList': {
        const p = input as BusinessParams<'files.trashList'>;
        return this.projects.get(p.projectId).files.trashList(p.offset, p.limit);
      }
      case 'files.operation': {
        const p = input as BusinessParams<'files.operation'>;
        const value = await this.projects.get(p.projectId).files.operation(p.operationId);
        this.changed(p.projectId);
        return value;
      }
      case 'files.resource': {
        const p = input as BusinessParams<'files.resource'>;
        return this.projects.get(p.projectId).files.resource(p.path);
      }
      case 'project.grant': {
        const p = input as BusinessParams<'project.grant'>;
        const project = this.projects.get(p.projectId);
        const result = project.grant({
          read: p.read,
          write: p.write,
          send: p.send,
          autoBackup: p.autoBackup,
        });
        this.changed(p.projectId);
        return result;
      }
      case 'files.list': {
        const p = input as BusinessParams<'files.list'>;
        return this.projects.get(p.projectId).list(p.path, p.offset, p.limit);
      }
      case 'files.read': {
        const p = input as BusinessParams<'files.read'>;
        return this.projects.get(p.projectId).read(p.path, p.offset);
      }
      case 'files.save': {
        const p = input as BusinessParams<'files.save'>;
        const edit = await this.projects.get(p.projectId).save(p.path, p.content, p.basis);
        this.changed(p.projectId);
        return edit;
      }
      case 'files.history': {
        const p = input as BusinessParams<'files.history'>;
        return this.projects.get(p.projectId).history(p.path);
      }
      case 'artifacts.reconcile': {
        const p = input as BusinessParams<'artifacts.reconcile'>;
        return this.harness.reconcile(p.projectId, p.sessionId, p.runId, p.paths);
      }
      case 'files.undo': {
        const p = input as BusinessParams<'files.undo'>;
        const result = await this.projects.get(p.projectId).undo(p.editId);
        this.changed(p.projectId);
        return result;
      }
      case 'project.backup':
        return this.projects.get((input as BusinessParams<'project.backup'>).projectId).backup();
      case 'project.backups':
        return this.projects.get((input as BusinessParams<'project.backups'>).projectId).backups();
      case 'project.restore': {
        const p = input as BusinessParams<'project.restore'>;
        const target = await this.projects.get(p.projectId).restore(p.backupId, p.destination);
        const store = await this.projects.open(target);
        await this.harness.initialize();
        this.changed();
        return store.project;
      }
      case 'session.create': {
        const p = input as BusinessParams<'session.create'>;
        return this.harness.create(p.projectId, p.title);
      }
      case 'session.send':
        return this.harness.send(input as BusinessParams<'session.send'>);
      case 'session.cancel': {
        const p = input as BusinessParams<'session.cancel'>;
        this.harness.cancel(p.projectId, p.sessionId);
        return { ok: true };
      }
      case 'session.resume': {
        const p = input as BusinessParams<'session.resume'>;
        this.harness.resume(p.projectId, p.sessionId);
        return { ok: true };
      }
    }
  }

  async close(): Promise<void> {
    await this.harness.close();
    await this.projects.close();
  }
}
