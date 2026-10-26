import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { opendir, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  AIMessage,
  type BaseMessage,
  coerceMessageLikeToMessage,
  HumanMessage,
  mapStoredMessageToChatMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { isCommand } from '@langchain/langgraph';
import { minimaxModels } from '@scholoom/models';
import { type ModelAccess, modelFailure, type RunModelConfig } from '@scholoom/models/execution';
import {
  atomicPrivateFile,
  failure,
  ManagedNode,
  ProcessAdmission,
  type ProcessReservation,
  privateDirectory,
  ResourceAccess,
} from '@scholoom/platform/node';
import type { CallContext, ErrorInfo } from '@scholoom/protocol/core';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import type { GraphExecution, GraphProgress, GraphResumeInput } from '@scholoom/protocol/execution';
import type {
  CapabilityExecution,
  HarnessInputs,
  HarnessModuleInputs,
  HarnessModuleOutputs,
  HarnessOutputs,
  HarnessSnapshot,
  InstructionContext,
  Message,
  Run,
  Session,
} from '@scholoom/protocol/harness';
import {
  harnessModuleOperations,
  isContextItems,
  workbenchContextInternalOperations,
} from '@scholoom/protocol/harness';
import {
  isLibraryToolCall,
  type LibraryToolPort,
  libraryOperations,
  libraryToolMethods,
} from '@scholoom/protocol/library';
import type { ModelDefaults, ModelPreference } from '@scholoom/protocol/models';
import {
  type Artifact,
  type HarnessProjectPort,
  type ProjectFilePort,
  type ProjectTargetReadInputs,
  type ProjectTargetReadPort,
  projectTargetReadOperations,
} from '@scholoom/protocol/projects';
import type {
  ResearchProgressPort,
  ResearchRequest,
  ResearchToolsPort,
} from '@scholoom/protocol/research';
import { researchRequestSchema } from '@scholoom/protocol/research';
import type {
  ExecutionResourcePort,
  ResourceEvidence,
  ResourceInputs,
  ResourceRef,
  ResourceSaveResult,
} from '@scholoom/protocol/resources';
import { resourceOperations } from '@scholoom/protocol/resources';
import type Database from 'better-sqlite3';
import { CompositeBackend, FilesystemBackend, registerHarnessProfile } from 'deepagents';
import { and, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import { createMiddleware, tool as defineTool } from 'langchain';
import { z } from 'zod';
import type { Consumption } from './checkpoint.js';
import { InstructionSaver } from './checkpoint.js';
import {
  claimCheckpoints,
  openCheckpoint,
  prepareScratch,
  sessionScratch,
} from './checkpoint-files.js';
import { ExecutionGraphs } from './graph-registry.js';
import {
  authorizeContextItems,
  type ContextBridge,
  contextItemContent,
  readInstructionContext,
} from './instruction-context.js';
import { ProjectBackend } from './project-backend.js';
import type { HarnessRecords } from './records.js';
import { RemoteAgent } from './remote-agent.js';
import * as tables from './schema.js';

registerHarnessProfile('anthropic', {
  generalPurposeSubagent: { enabled: false },
  excludedTools: ['task', 'execute', 'delete'],
  excludedMiddleware: ['AnthropicPromptCachingMiddleware', 'CacheBreakpointMiddleware'],
});

type Active = { controller: AbortController; done: Promise<void> };
type Notify = (projectId?: string, sessionId?: string, sessionsChanged?: boolean) => void;
export type HarnessProject = {
  readonly id: string;
  readonly internal: string;
  readonly records: HarnessRecords;
};
export type HarnessStorage = {
  get: (projectId: string) => HarnessProject;
  all: () => HarnessProject[];
  touch: (projectId: string) => void;
};
const activeKey = (project: HarnessProject, sessionId: string) => `${project.id}:${sessionId}`;
const now = () => new Date().toISOString();
const historyPrefix = '/conversation_history/';
const executionsContract = compileContract(harnessModuleOperations['harness.executions']);
const settleTools = async (pending: Set<Promise<unknown>>) => {
  while (pending.size) await Promise.allSettled([...pending]);
};
const track = <T>(pending: Set<Promise<unknown>>, done: Promise<T>): Promise<T> => {
  pending.add(done);
  void done.then(
    () => pending.delete(done),
    () => pending.delete(done),
  );
  return done;
};
const trackBackend = <T extends object>(backend: T, pending: Set<Promise<unknown>>): T =>
  new Proxy(backend, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) =>
        track(
          pending,
          Promise.resolve().then(() => value.apply(target, args)),
        );
    },
  });
const toolPreview = (text: string) => ({
  text: text.slice(0, 16384),
  truncated: text.length > 16384,
});
const visibleText = (message: BaseMessage): string =>
  typeof message.content === 'string'
    ? message.content
    : message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? String(block.text) : ''))
        .join('');

export class Harness {
  private readonly hostInstanceId = randomUUID();
  private readonly repositories = new Map<string, HarnessRecords>();
  private repository(project: HarnessProject) {
    this.repositories.set(project.internal, project.records);
    return project.records;
  }

  private records(project: HarnessProject) {
    return this.repository(project).db;
  }
  private unconfirmedInstance(project: HarnessProject, sessionId?: string) {
    return this.records(project)
      .select({ value: tables.instances.value })
      .from(tables.instances)
      .leftJoin(tables.runs, eq(tables.instances.runId, tables.runs.id))
      .where(
        and(
          sql`json_extract(${tables.instances.value}, '$.state') != 'exited'`,
          sessionId
            ? or(eq(tables.runs.sessionId, sessionId), sql`${tables.runs.id} IS NULL`)
            : undefined,
        ),
      )
      .get();
  }
  private port(
    project?: HarnessProject,
    sessionId?: string,
    signal?: AbortSignal,
  ): HarnessProjectPort {
    return this.projectPort({
      moduleId: 'harness',
      role: 'host',
      principal: { kind: 'system', id: 'host' },
      ...(project ? { projectId: project.id } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(signal ? { signal } : {}),
    });
  }
  private async currentPath(project: HarnessProject, fileId: string): Promise<string> {
    const location = (
      await this.port(project)['files.resolve']({ projectId: project.id, fileIds: [fileId] })
    )[0];
    if (location?.state !== 'present')
      throw new OperationError('notFound', '原材料当前位置不可用。');
    return location.path;
  }
  private initialized = new WeakSet<HarnessProject>();
  private released = new WeakSet<HarnessProject>();
  private active = new Map<string, Active>();
  private stopped = false;
  get isStopping(): boolean {
    return this.stopped;
  }
  recordResourceUse(
    context: CallContext,
    ref: ResourceRef | { source: 'project'; projectId: string },
  ): void {
    this.checkExecutionContext(context);
    if (!context.projectId) throw new OperationError('instanceMismatch', '缺少工作项目。');
    const project = this.projects.get(context.projectId);
    const key =
      ref.source === 'library'
        ? `library-context:${context.sessionId}`
        : `target-read-context:${context.sessionId}`;
    if (ref.source === 'project' && ref.projectId === context.projectId) return;
    const records = this.records(project);
    const previous: string[] =
      ref.source === 'library'
        ? []
        : JSON.parse(
            records.select().from(tables.meta).where(eq(tables.meta.key, key)).get()?.value ?? '[]',
          );
    const value =
      ref.source === 'library' ? '1' : JSON.stringify([...new Set([...previous, ref.projectId])]);
    records
      .insert(tables.meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: tables.meta.key, set: { value } })
      .run();
  }
  private instructionEvidence(
    project: HarnessProject,
    sessionId: string,
    items: readonly ResourceEvidence[] = [],
  ): ResourceEvidence[] {
    const key = `instruction-resource-context:${sessionId}`;
    const evidence = new Map<string, ResourceEvidence>(
      (
        JSON.parse(
          this.records(project).select().from(tables.meta).where(eq(tables.meta.key, key)).get()
            ?.value ?? '[]',
        ) as ResourceEvidence[]
      ).map((item) => [JSON.stringify(item.ref), item]),
    );
    if (items.length) {
      for (const item of items)
        evidence.set(JSON.stringify(item.ref), { ref: item.ref, basis: item.basis });
      const value = JSON.stringify([...evidence.values()]);
      this.records(project)
        .insert(tables.meta)
        .values({ key, value })
        .onConflictDoUpdate({ target: tables.meta.key, set: { value } })
        .run();
    }
    return [...evidence.values()];
  }
  checkExecutionContext(context: CallContext): void {
    const { projectId, sessionId, runId, instanceId } = context;
    if (
      !projectId ||
      !sessionId ||
      !runId ||
      !instanceId ||
      this.stopped ||
      context.signal?.aborted
    )
      throw new OperationError('instanceMismatch', '缺少有效执行身份。');
    const project = this.projects.get(projectId);
    const active = this.active.get(activeKey(project, sessionId));
    if (
      !active ||
      active.controller.signal.aborted ||
      this.latestRun(project, sessionId)?.id !== runId
    )
      throw new OperationError('instanceMismatch', '执行尝试已失效。');
    this.session(project, sessionId);
    let currentId: string | undefined = instanceId;
    const visited = new Set<string>();
    while (currentId) {
      if (visited.has(currentId))
        throw new OperationError('instanceMismatch', '执行实例归属无效。');
      visited.add(currentId);
      const current: tables.RunInstance | undefined = this.records(project)
        .select()
        .from(tables.instances)
        .where(eq(tables.instances.id, currentId))
        .get()?.value;
      if (
        current?.hostInstanceId !== this.hostInstanceId ||
        current.runId !== runId ||
        current.state !== 'running'
      )
        throw new OperationError('instanceMismatch', '执行实例资格已撤销。');
      currentId = current.parentInstanceId;
    }
  }
  private readonly capabilityReservations = new AsyncLocalStorage<ProcessReservation>();
  private readonly capabilityExecutors = new Map<
    string,
    {
      context: CallContext;
      execute: (input: CapabilityExecution, reservation: ProcessReservation) => Promise<void>;
    }
  >();
  async executeCapability(input: CapabilityExecution, context: CallContext): Promise<void> {
    if (input.execution?.kind === 'registered') this.graphs.resolve(input.execution);
    if (input.execution?.kind === 'registered' || input.resume)
      throw new OperationError('unavailable', '已登记图及等待恢复尚未接线。');
    const executor = context.runId ? this.capabilityExecutors.get(context.runId) : undefined;
    const reservation = this.capabilityReservations.getStore();
    if (
      !executor ||
      !reservation ||
      context.role !== 'execution' ||
      (['projectId', 'sessionId', 'runId', 'instanceId'] as const).some(
        (key) => context[key] !== executor.context[key],
      )
    )
      throw new OperationError('instanceMismatch', '能力执行不属于当前已准入的推进。');
    context.signal?.throwIfAborted();
    await executor.execute(input, reservation);
  }
  private pendingArtifacts = new Map<
    string,
    {
      projectId: string;
      sessionId: string;
      artifact: Artifact;
      receipt: string;
      basis?: string;
      resourceBasis?: string;
    }
  >();
  constructor(
    private readonly projects: HarnessStorage,
    private readonly model: Pick<ModelAccess, 'execution'> & {
      credentials: Pick<ModelAccess['credentials'], 'status'>;
    },
    private readonly configs: { load: () => Promise<ModelDefaults> },
    private readonly researchTools: (context: CallContext) => ResearchToolsPort,
    private readonly libraryTools: (context: CallContext) => LibraryToolPort,
    private readonly notify: Notify,
    private readonly projectPort: (context: CallContext) => HarnessProjectPort,
    private readonly projectFiles: (context: CallContext) => ProjectFilePort,
    private readonly researchProgress: (context: CallContext) => ResearchProgressPort,
    private readonly processes = new ProcessAdmission(),
    private readonly workerEntry?: URL,
    private readonly graphs = new ExecutionGraphs(),
    private readonly targetFiles?: (context: CallContext) => ProjectTargetReadPort & {
      check: (targetIds: Iterable<string>) => void;
    },
    private readonly contextBridge?: ContextBridge,
    private readonly executionResources?: (context: CallContext) => ExecutionResourcePort,
  ) {}

  async initialize(): Promise<void> {
    for (const project of this.projects.all()) {
      if (this.initialized.has(project)) continue;
      this.initialized.add(project);
      const directory = join(project.internal, 'pending-artifacts');
      await privateDirectory(directory);
      for (const entry of (await readdir(directory)).slice(0, 100)) {
        const receipt = join(directory, entry);
        try {
          const pending = await this.readArtifactReceipt(project, receipt);
          this.pendingArtifacts.set(
            `${project.id}:${pending.artifact.runId}:${pending.artifact.path}`,
            pending,
          );
        } catch {
          /* Preserve unreadable receipts for diagnosis. */
        }
      }
      for (const row of this.records(project).select().from(tables.runs).all()) {
        if (['queued', 'running', 'cancelling'].includes(row.value.state)) {
          this.interruptTools(project, row.value);
          this.setRun(project, { ...row.value, state: 'interrupted', remoteOutcome: 'unknown' });
        }
      }
    }
  }

  private async readArtifactReceipt(project: HarnessProject, receipt: string) {
    const item = JSON.parse(await readFile(receipt, 'utf8')) as {
      sessionId: string;
      artifact: Artifact;
      basis?: string;
      resourceBasis?: string;
    };
    return {
      projectId: project.id,
      sessionId: item.sessionId,
      artifact: { ...item.artifact, state: 'unknown' as const },
      receipt,
      ...(item.basis ? { basis: item.basis } : {}),
      ...(item.resourceBasis ? { resourceBasis: item.resourceBasis } : {}),
    };
  }

  create(projectId: string, title?: string): Session {
    const project = this.projects.get(projectId);
    const value: Session = {
      id: randomUUID(),
      projectId,
      title: title?.trim() || '新会话',
      titleSource: title?.trim() ? 'manual' : 'default',
      updatedAt: now(),
      state: 'completed',
    };
    this.records(project).transaction((tx) => {
      tx.insert(tables.sessions).values({ id: value.id, value }).run();
      tx.insert(tables.meta)
        .values({ key: `scratch-isolated:${value.id}`, value: 'true' })
        .run();
    });
    this.projects.touch(project.id);
    this.notify(projectId, undefined, true);
    return value;
  }

  list(input: HarnessInputs['session.list']): HarnessOutputs['session.list'] {
    const project = this.projects.get(input.projectId);
    const updated = sql<string>`json_extract(${tables.sessions.value}, '$.updatedAt')`;
    const cursor = input.cursor;
    const limit = Math.min(input.limit ?? 50, 100);
    const rows = this.records(project)
      .select()
      .from(tables.sessions)
      .where(
        and(
          sql`coalesce(json_extract(${tables.sessions.value}, '$.archived'), 0) = ${input.archived ? 1 : 0}`,
          input.query
            ? sql`instr(lower(json_extract(${tables.sessions.value}, '$.title')), lower(${input.query})) > 0`
            : undefined,
          cursor
            ? or(
                lt(updated, cursor.updatedAt),
                and(eq(updated, cursor.updatedAt), lt(tables.sessions.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(updated), desc(tables.sessions.id))
      .limit(limit + 1)
      .all();
    const more = rows.length > limit;
    const sessions = rows.slice(0, limit).map((row) => row.value);
    const last = sessions.at(-1);
    return {
      sessions,
      ...(more && last ? { nextCursor: { updatedAt: last.updatedAt, id: last.id } } : {}),
    };
  }

  async search(input: HarnessInputs['session.search']): Promise<HarnessOutputs['session.search']> {
    const limit = Math.min(input.limit ?? 50, 100);
    const projects = new Map(
      (await this.port()['projects.list']({})).map((project) => [project.id, project]),
    );
    const results: HarnessOutputs['session.search']['results'] = [];
    const updated = sql<string>`json_extract(${tables.sessions.value}, '$.updatedAt')`;
    for (const store of this.projects.all()) {
      const project = projects.get(store.id);
      if (!project?.recent) continue;
      const rows = this.records(store)
        .select()
        .from(tables.sessions)
        .where(
          input.query
            ? sql`instr(lower(json_extract(${tables.sessions.value}, '$.title')), lower(${input.query})) > 0`
            : undefined,
        )
        .orderBy(desc(updated), desc(tables.sessions.id))
        .limit(limit)
        .all();
      for (const row of rows) results.push({ project, session: row.value });
    }
    results.sort(
      (a, b) =>
        b.session.updatedAt.localeCompare(a.session.updatedAt) ||
        b.session.id.localeCompare(a.session.id),
    );
    return { results: results.slice(0, limit), truncated: results.length > limit };
  }

  rename(projectId: string, sessionId: string, title: string): Session {
    const project = this.projects.get(projectId);
    const normalized = title.trim();
    if (!normalized || Array.from(normalized).length > 200)
      throw new OperationError('invalidRequest', '会话标题应为 1 至 200 字符。');
    const value: Session = {
      ...this.session(project, sessionId),
      title: normalized,
      titleSource: 'manual',
    };
    this.records(project)
      .update(tables.sessions)
      .set({ value })
      .where(eq(tables.sessions.id, sessionId))
      .run();
    this.projects.touch(project.id);
    this.notify(projectId, sessionId, true);
    return value;
  }

  archive(projectId: string, sessionId: string, archived: boolean): Session {
    const project = this.projects.get(projectId);
    const previous = this.session(project, sessionId);
    if (
      archived &&
      (this.active.has(activeKey(project, sessionId)) ||
        ['queued', 'running', 'cancelling'].includes(previous.state))
    )
      throw new OperationError('invalidRequest', '请等待执行停止后再归档会话。');
    if (!!previous.archived === archived) return previous;
    const value = { ...previous, archived };
    this.records(project)
      .update(tables.sessions)
      .set({ value })
      .where(eq(tables.sessions.id, sessionId))
      .run();
    this.projects.touch(project.id);
    this.notify(projectId, sessionId, true);
    return value;
  }

  async configure(
    projectId: string,
    sessionId: string,
    modelConfig: ModelPreference | null,
  ): Promise<Session> {
    const project = this.projects.get(projectId);
    const previous = this.session(project, sessionId);
    const preference = modelConfig ?? {};
    if (preference.model && !minimaxModels.some((item) => item.id === preference.model))
      throw new OperationError('invalidRequest', `模型 ${preference.model} 不在当前模型目录。`);
    if (preference.effort) {
      const model = preference.model ?? (await this.configs.load()).model;
      if (!minimaxModels.find((item) => item.id === model)?.supportsEffort)
        throw new OperationError('invalidRequest', `模型 ${model} 不支持推理强度设置。`);
    }
    const value: Session = { ...previous };
    if (preference.model || preference.effort)
      value.modelConfig = {
        ...(preference.model ? { model: preference.model } : {}),
        ...(preference.effort ? { effort: preference.effort } : {}),
      };
    else delete value.modelConfig;
    this.records(project)
      .update(tables.sessions)
      .set({ value })
      .where(eq(tables.sessions.id, sessionId))
      .run();
    this.projects.touch(project.id);
    this.notify(projectId, sessionId, true);
    return value;
  }

  private async runConfig(session: Session): Promise<RunModelConfig> {
    const defaults = await this.configs.load();
    const model = session.modelConfig?.model ?? defaults.model;
    const option = minimaxModels.find((item) => item.id === model);
    if (!option) throw new OperationError('invalidRequest', `模型 ${model} 不在当前模型目录。`);
    const effort = session.modelConfig?.effort ?? defaults.effort;
    return option.supportsEffort ? { model, effort } : { model };
  }

  private session(project: HarnessProject, id: string): Session {
    const row = this.records(project)
      .select()
      .from(tables.sessions)
      .where(eq(tables.sessions.id, id))
      .get();
    if (!row) throw new OperationError('notFound', '会话不存在。');
    return row.value;
  }

  getSession(projectId: string, sessionId: string): Session {
    return this.session(this.projects.get(projectId), sessionId);
  }

  async executions(
    input: HarnessModuleInputs['harness.executions'],
  ): Promise<HarnessModuleOutputs['harness.executions']> {
    if (!executionsContract.params(input))
      throw new OperationError('invalidRequest', '执行历史选择器或分页参数无效。');
    const project = this.projects.get(input.projectId);
    this.session(project, input.sessionId);
    const records = this.records(project);
    let runId = input.runId;
    let instruction: Message | undefined;
    if (input.instructionId) {
      const accepted = records
        .select({ runId: tables.instructions.runId, instruction: tables.messages.value })
        .from(tables.instructions)
        .leftJoin(
          tables.messages,
          and(
            eq(tables.messages.id, tables.instructions.id),
            eq(tables.messages.sessionId, tables.instructions.sessionId),
          ),
        )
        .where(
          and(
            eq(tables.instructions.id, input.instructionId),
            eq(tables.instructions.sessionId, input.sessionId),
          ),
        )
        .get();
      if (!accepted) return { runs: [] };
      if (!accepted.instruction) throw new OperationError('unavailable', '原指令消息缺失。');
      runId = accepted.runId;
      instruction = accepted.instruction;
    }
    let result: HarnessModuleOutputs['harness.executions'] = {
      runs: [],
      ...(instruction ? { instruction } : {}),
    };
    if (Buffer.byteLength(JSON.stringify(result)) > 512 * 1024)
      throw new OperationError('tooLarge', '执行历史响应超过查询容量。');
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 25;
    const rows = records
      .select({ value: tables.runs.value })
      .from(tables.runs)
      .where(
        and(
          eq(tables.runs.sessionId, input.sessionId),
          runId
            ? eq(tables.runs.id, runId)
            : sql`json_extract(${tables.runs.value}, '$.graph.originInstructionId') = ${input.originInstructionId}`,
        ),
      )
      .orderBy(sql`json_extract(${tables.runs.value}, '$.attempt')`, tables.runs.id)
      .limit(limit + 1)
      .offset(offset)
      .all();
    for (const [index, row] of rows.slice(0, limit).entries()) {
      const candidate = {
        runs: [...result.runs, row.value],
        ...(instruction ? { instruction } : {}),
        ...(index + 1 < rows.length ? { nextOffset: offset + index + 1 } : {}),
      };
      if (Buffer.byteLength(JSON.stringify(candidate)) > 512 * 1024) {
        if (!result.runs.length) throw new OperationError('tooLarge', '执行历史响应超过查询容量。');
        return result;
      }
      result = candidate;
    }
    return result;
  }

  private latestRun(project: HarnessProject, sessionId: string): Run | undefined {
    return this.records(project)
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.sessionId, sessionId))
      .orderBy(desc(sql`json_extract(${tables.runs.value}, '$.attempt')`))
      .limit(1)
      .get()?.value;
  }

  private setRun(project: HarnessProject, value: Run): void {
    this.records(project)
      .insert(tables.runs)
      .values({ id: value.id, sessionId: value.sessionId, value })
      .onConflictDoUpdate({ target: tables.runs.id, set: { value } })
      .run();
    if (this.latestRun(project, value.sessionId)?.id !== value.id) return;
    const session = this.session(project, value.sessionId);
    this.records(project)
      .update(tables.sessions)
      .set({ value: { ...session, state: value.state, updatedAt: now() } })
      .where(eq(tables.sessions.id, session.id))
      .run();
    this.projects.touch(project.id);
    this.notify(project.id, value.sessionId, session.state !== value.state);
  }

  private putMessage(project: HarnessProject, value: Message): void {
    this.records(project)
      .insert(tables.messages)
      .values({ id: value.id, sessionId: value.sessionId, value })
      .onConflictDoUpdate({ target: tables.messages.id, set: { value } })
      .run();
    this.projects.touch(project.id);
    this.notify(project.id, value.sessionId);
  }

  private interruptTools(project: HarnessProject, run: Run): void {
    const rows = this.records(project)
      .select()
      .from(tables.messages)
      .where(
        and(
          eq(tables.messages.sessionId, run.sessionId),
          sql`json_extract(${tables.messages.value}, '$.role') = 'tool'`,
          sql`json_extract(${tables.messages.value}, '$.state') = 'streaming'`,
          sql`json_extract(${tables.messages.value}, '$.tool.runId') = ${run.id}`,
        ),
      )
      .all();
    for (const { value } of rows) this.putMessage(project, { ...value, state: 'unknown' });
  }

  private acceptedInstruction(
    project: HarnessProject,
    input: HarnessInputs['session.send'],
    selection?: Extract<GraphExecution, { kind: 'registered' }>,
  ): HarnessOutputs['session.send'] | undefined {
    const previous = this.records(project)
      .select()
      .from(tables.instructions)
      .where(eq(tables.instructions.id, input.instructionId))
      .get();
    if (previous) {
      const original = this.records(project)
        .select()
        .from(tables.messages)
        .where(eq(tables.messages.id, input.instructionId))
        .get();
      if (
        previous.sessionId !== input.sessionId ||
        original?.value.text !== input.text ||
        JSON.stringify(original.value.materials) !== JSON.stringify(input.materials) ||
        JSON.stringify(original.value.materialFileIds ?? []) !==
          JSON.stringify(input.materialFileIds ?? []) ||
        !isDeepStrictEqual(original.value.contextItems ?? [], input.contextItems ?? [])
      )
        throw new OperationError('invalidRequest', '指令身份已用于其他内容。');
      if (selection) {
        const accepted = this.records(project)
          .select()
          .from(tables.runs)
          .where(eq(tables.runs.id, previous.runId))
          .get()?.value.graph;
        if (
          !accepted ||
          accepted.graphId !== selection.graphId ||
          accepted.version !== selection.version ||
          !isDeepStrictEqual(accepted.config, selection.config) ||
          !isDeepStrictEqual(accepted.materials ?? [], selection.materials)
        )
          throw new OperationError('invalidRequest', '原指令已绑定另一图。');
      }
      return { instructionId: previous.id, runId: previous.runId };
    }
    return undefined;
  }

  async send(
    input: HarnessInputs['session.send'],
    source?: CallContext['workbenchSource'],
    selection?: Extract<GraphExecution, { kind: 'registered' }>,
  ): Promise<{ instructionId: string; runId: string }> {
    if (input.contextItems && !isContextItems(input.contextItems))
      throw new OperationError('invalidRequest', '显式上下文项不符合容量及结构约定。');
    input = structuredClone(input);
    if (selection) selection = structuredClone(selection);
    if (this.stopped) throw new OperationError('shuttingDown', '内核正在停止。');
    const project = this.projects.get(input.projectId);
    const session = this.session(project, input.sessionId);
    const previous = this.acceptedInstruction(project, input, selection);
    if (previous) return previous;
    ManagedNode.requireAvailable();
    let prior = this.latestRun(project, input.sessionId);
    if (prior?.graph && prior.state === 'waiting')
      await this.active.get(activeKey(project, session.id))?.done;
    prior = this.latestRun(project, input.sessionId);
    if (selection && this.active.has(activeKey(project, session.id)))
      throw new OperationError('invalidRequest', '请先等待当前执行停止后选择新图。');
    const selectedGraph = (run: Run | undefined) =>
      selection ??
      (run?.graph
        ? {
            kind: 'registered' as const,
            graphId: run.graph.graphId,
            version: run.graph.version,
            config: run.graph.config,
            materials: run.graph.materials ?? [],
            workDomain:
              project.id === 'application'
                ? {
                    kind: 'application' as const,
                    projectId: 'application' as const,
                    sessionId: session.id,
                  }
                : { kind: 'project' as const, projectId: project.id, sessionId: session.id },
          }
        : undefined);
    let registered = selectedGraph(prior);
    let factory: ReturnType<ExecutionGraphs['resolve']> | undefined;
    if (registered) {
      if (
        registered.workDomain.projectId !== project.id ||
        registered.workDomain.sessionId !== session.id
      )
        throw new OperationError('permissionDenied', '图工作域不属于当前会话。');
      factory = this.graphs.resolve(registered);
    }
    const admissionContext: CallContext = {
      moduleId: 'harness',
      role: 'host',
      principal: { kind: 'agent', id: session.id },
      projectId: project.id,
      sessionId: session.id,
    };
    try {
      await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
      await authorizeContextItems(this.contextBridge, admissionContext, input.contextItems ?? []);
      if (
        (!registered || factory?.definition.requiresModel) &&
        !(await this.model.credentials.status()).configured
      )
        throw new OperationError('credentialUnavailable', '请先配置 MiniMax API Key。');
      if (input.materialFileIds && input.materialFileIds.length !== input.materials.length)
        throw new OperationError('invalidRequest', '材料身份数量不一致。');
      for (const [index, path] of input.materials.entries()) {
        await this.port(project)['project.check']({ projectId: project.id, access: 'read' });
        const identity = input.materialFileIds?.[index];
        if (identity && (await this.currentPath(project, identity)) !== path)
          throw new OperationError('contentChanged', '附加材料位置已变化，请重新选择后发送。');
        await this.port(project)['project.path']({ projectId: project.id, path });
      }
    } catch (error) {
      const accepted = this.acceptedInstruction(project, input, selection);
      if (accepted) return accepted;
      throw error;
    }
    let run = this.latestRun(project, input.sessionId);
    registered = selectedGraph(run);
    factory = registered ? this.graphs.resolve(registered) : undefined;
    const replay = this.acceptedInstruction(project, input, selection);
    if (replay) return replay;
    let busy = this.active.has(activeKey(project, input.sessionId));
    if (selection && busy)
      throw new OperationError('invalidRequest', '请先等待当前执行停止后选择新图。');
    const incompatible = () =>
      !!registered &&
      !!run &&
      (!run.graph ||
        registered.graphId !== run.graph.graphId ||
        registered.version !== run.graph.version ||
        factory?.definition.stateFormatVersion !== run.graph.stateFormatVersion ||
        !isDeepStrictEqual(registered.materials, run.graph.materials ?? []) ||
        !isDeepStrictEqual(registered.config, run.graph.config));
    const canResume = () =>
      !selection &&
      !busy &&
      !!run &&
      run.state !== 'completed' &&
      !incompatible() &&
      !(registered && run.state === 'cancelled');
    let resuming = canResume();
    let originInstructionId = selection ? input.instructionId : run?.graph?.originInstructionId;
    if (!busy && !resuming) {
      const modelConfig =
        registered && !factory?.definition.requiresModel
          ? undefined
          : await this.runConfig(session);
      busy = this.active.has(activeKey(project, input.sessionId));
      run = this.latestRun(project, input.sessionId);
      registered = selectedGraph(run);
      factory = registered ? this.graphs.resolve(registered) : undefined;
      const replay = this.acceptedInstruction(project, input, selection);
      if (replay) return replay;
      if (selection && busy)
        throw new OperationError('invalidRequest', '请先等待当前执行停止后选择新图。');
      resuming = canResume();
      originInstructionId = selection ? input.instructionId : run?.graph?.originInstructionId;
      if (!busy && !resuming)
        run = {
          id: randomUUID(),
          sessionId: session.id,
          attempt: (run?.attempt ?? 0) + 1,
          state: 'queued',
          ...(modelConfig && (!registered || factory?.definition.requiresModel)
            ? { modelConfig }
            : {}),
        };
    }
    if (resuming && run) {
      const { error: _error, ...continuing } = run;
      run = { ...continuing, state: 'queued' };
    }
    if (registered && factory && run && !busy) {
      const checkpointRef = resuming && run.graph ? run.graph.checkpointRef : run.id;
      run = {
        ...run,
        graph: {
          ...(originInstructionId ? { originInstructionId } : {}),
          graphId: registered.graphId,
          version: registered.version,
          config: registered.config,
          materials: registered.materials,
          stateFormatVersion: factory.definition.stateFormatVersion,
          checkpointRef,
          ...(resuming && run.graph?.wait ? { wait: run.graph.wait } : {}),
        },
      };
    }
    const accepted = run as Run;
    if (this.released.has(project) || this.projects.get(project.id) !== project)
      throw new OperationError('instanceMismatch', '项目位置已变化，请重新发送。');
    const reservation = busy ? undefined : this.processes.reserve(true);
    let scheduled = false;
    let persisted = false;
    try {
      let replay: HarnessOutputs['session.send'] | undefined;
      this.records(project).transaction((tx) => {
        replay = this.acceptedInstruction(project, input, selection);
        if (replay) return;
        if (input.contextItems?.length) {
          const resources = this.contextBridge?.resources?.(admissionContext);
          if (!resources) throw new OperationError('unavailable', '执行资源授权适配尚未接线。');
          resources.check(input.contextItems);
        }
        const current = tx
          .select()
          .from(tables.sessions)
          .where(eq(tables.sessions.id, session.id))
          .get()?.value;
        if (!current || current.archived)
          throw new OperationError('invalidRequest', '请先恢复已归档的会话。');
        if (current.titleSource === 'default') {
          const title =
            Array.from(input.text.trim().replace(/\s+/gu, ' ')).slice(0, 40).join('') || '新会话';
          tx.update(tables.sessions)
            .set({ value: { ...current, title, titleSource: 'instruction' } })
            .where(eq(tables.sessions.id, session.id))
            .run();
        }
        tx.insert(tables.instructions)
          .values({
            id: input.instructionId,
            sessionId: session.id,
            runId: accepted.id,
            consumed: false,
          })
          .run();
        tx.insert(tables.messages)
          .values({
            id: input.instructionId,
            sessionId: session.id,
            value: {
              id: input.instructionId,
              sessionId: session.id,
              role: 'user',
              text: input.text,
              materials: input.materials,
              ...(input.materialFileIds ? { materialFileIds: input.materialFileIds } : {}),
              ...(input.contextItems ? { contextItems: input.contextItems } : {}),
              ...(source ? { source: { ...source } } : {}),
              state: 'accepted',
              createdAt: now(),
            },
          })
          .run();
      });
      if (replay) return replay;
      persisted = true;
      this.setRun(project, accepted);
      this.notify(project.id, session.id, true);
      if (!busy) {
        this.schedule(project, accepted, resuming, reservation);
        scheduled = true;
      }
      return { instructionId: input.instructionId, runId: accepted.id };
    } catch (error) {
      if (persisted)
        throw new OperationError(
          'outcomeUnknown',
          '指令已保存，后续受理状态待核查；请沿原身份核对。',
        );
      throw error;
    } finally {
      if (!scheduled) reservation?.release();
    }
  }

  cancel(projectId: string, sessionId: string): void {
    const project = this.projects.get(projectId);
    this.session(project, sessionId);
    const run = this.latestRun(project, sessionId);
    const active = this.active.get(activeKey(project, sessionId));
    if (run && active) {
      this.setRun(project, { ...run, state: 'cancelling', remoteOutcome: 'unknown' });
      active.controller.abort(new Error('User cancelled'));
    } else if (run && ['queued', 'waiting'].includes(run.state))
      this.setRun(project, { ...run, state: 'cancelled' });
  }

  private schedule(
    project: HarnessProject,
    run: Run,
    resume = false,
    reservation = this.processes.reserve(true),
  ): void {
    if (this.released.has(project) || this.projects.get(project.id) !== project) {
      reservation.release();
      throw new OperationError('instanceMismatch', '项目位置已变化，停止旧资源上的调度。');
    }
    const controller = new AbortController();
    let entered = false;
    const cancelReservation = () => {
      if (!entered) reservation.release();
    };
    controller.signal.addEventListener('abort', cancelReservation, { once: true });
    const done = Promise.resolve()
      .then(async () => {
        await reservation.ready;
        controller.signal.throwIfAborted();
        entered = true;
        if (run.graph)
          await this.executeRegistered(project, run, controller.signal, resume, reservation);
        else await this.execute(project, run, controller.signal, resume, reservation);
      })
      .catch((error) => {
        if (!entered)
          this.setRun(project, {
            ...run,
            state: controller.signal.aborted
              ? this.stopped
                ? 'interrupted'
                : 'cancelled'
              : 'failed',
            error: modelFailure(error),
            remoteOutcome: 'unknown',
          });
      })
      .finally(() => {
        controller.signal.removeEventListener('abort', cancelReservation);
        reservation.release();
        this.active.delete(activeKey(project, run.sessionId));
        const actual = this.latestRun(project, run.sessionId);
        const pending = this.records(project)
          .select()
          .from(tables.instructions)
          .where(
            and(
              eq(tables.instructions.sessionId, run.sessionId),
              eq(tables.instructions.consumed, false),
            ),
          )
          .limit(1)
          .get();
        if (!this.stopped && !actual?.graph && actual?.state === 'completed' && pending)
          void this.scheduleNext(project, run.sessionId, actual.attempt + 1);
      });
    this.active.set(activeKey(project, run.sessionId), { controller, done });
    this.setRun(project, { ...run, state: 'queued' });
  }

  private async scheduleNext(
    project: HarnessProject,
    sessionId: string,
    attempt: number,
  ): Promise<void> {
    try {
      const modelConfig = await this.runConfig(this.session(project, sessionId));
      this.schedule(project, {
        id: randomUUID(),
        sessionId,
        attempt,
        state: 'queued',
        modelConfig,
      });
    } catch {
      // 默认配置不可用时无法创建后续执行；未消费指令保留，可显式继续。
    }
  }

  private async executeRegistered(
    project: HarnessProject,
    initial: Run,
    signal: AbortSignal,
    resume: boolean,
    reservation: ProcessReservation,
  ): Promise<void> {
    let run = initial;
    let database: Database.Database | undefined;
    let release: (() => void) | undefined;
    const instanceId = randomUUID();
    const context: CallContext = {
      moduleId: 'harness',
      role: 'execution',
      principal: { kind: 'agent', id: run.sessionId },
      projectId: project.id,
      sessionId: run.sessionId,
      runId: run.id,
      instanceId,
      signal,
      workDomain:
        project.id === 'application'
          ? { kind: 'application', projectId: 'application', sessionId: run.sessionId }
          : { kind: 'project', projectId: project.id, sessionId: run.sessionId },
    };
    const updateInstance = (state: tables.RunInstance['state']) => {
      const row = this.records(project)
        .select()
        .from(tables.instances)
        .where(eq(tables.instances.id, instanceId))
        .get();
      if (row)
        this.records(project)
          .update(tables.instances)
          .set({ value: { ...row.value, state } })
          .where(eq(tables.instances.id, instanceId))
          .run();
    };
    try {
      signal.throwIfAborted();
      await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
      const binding = run.graph;
      if (!binding || !context.workDomain)
        throw new OperationError('invalidRequest', '缺少持久图绑定或工作域。');
      const graph = {
        kind: 'registered' as const,
        graphId: binding.graphId,
        version: binding.version,
        config: binding.config,
        materials: binding.materials ?? [],
        workDomain: context.workDomain,
      };
      const factory = this.graphs.resolve(graph);
      if (factory.definition.stateFormatVersion !== binding.stateFormatVersion)
        throw new OperationError('protocolIncompatible', '图状态格式不兼容，旧记录及成果已保留。');
      if (this.unconfirmedInstance(project, run.sessionId))
        throw new OperationError('outcomeUnknown', '旧图执行停止尚未确认。');
      release = await claimCheckpoints(project.internal, [binding.checkpointRef]);
      const opened = await openCheckpoint(project.internal, binding.checkpointRef);
      database = opened.database;
      if (opened.issue)
        throw new OperationError('protocolIncompatible', '图 checkpoint 不完整，停止原尝试接续。');
      const instruction = (id: string) => {
        const owned = this.records(project)
          .select()
          .from(tables.instructions)
          .where(eq(tables.instructions.id, id))
          .get();
        const message = this.records(project)
          .select()
          .from(tables.messages)
          .where(eq(tables.messages.id, id))
          .get()?.value;
        if (
          owned?.sessionId !== run.sessionId ||
          message?.sessionId !== run.sessionId ||
          message.role !== 'user'
        )
          throw new OperationError('invalidRequest', '图指令不属于当前会话。');
        return {
          instructionId: id,
          text: message.text,
          materials: message.materials,
          ...(message.materialFileIds ? { materialFileIds: message.materialFileIds } : {}),
          ...(message.source ? { source: message.source } : {}),
          ...(message.contextItems ? { contextItems: message.contextItems } : {}),
        };
      };
      const admissionContext: CallContext = {
        moduleId: 'harness',
        role: 'host',
        principal: { kind: 'agent', id: run.sessionId },
        projectId: project.id,
        sessionId: run.sessionId,
        signal,
      };
      const readPending = (after: number) =>
        this.records(project)
          .select()
          .from(tables.instructions)
          .where(
            and(
              eq(tables.instructions.sessionId, run.sessionId),
              eq(tables.instructions.consumed, false),
              gt(tables.instructions.seq, after),
            ),
          )
          .orderBy(tables.instructions.seq)
          .limit(100)
          .all();
      let pending = readPending(0);
      let ids = pending.map((item) => item.id);
      let input: GraphResumeInput | null = null;
      const saver = new InstructionSaver(database, async () => {});
      const latest = await saver.getTuple({ configurable: { thread_id: run.id } });
      if (resume && !latest)
        throw new OperationError('unavailable', '原图 checkpoint 缺失；保留原尝试并停止接续。');
      const previousResume = latest?.checkpoint.channel_values.graphResume as
        | GraphResumeInput
        | undefined;
      if (binding.wait && previousResume?.waitId === binding.wait.waitId) input = previousResume;
      else if (binding.wait) {
        if (!ids.length) throw new OperationError('invalidRequest', '等待接续缺少新指令。');
        const schema = factory.definition.waitSchemas?.[binding.wait.inputSchemaRef];
        while (pending.length) {
          const messages = pending.map((item) => ({ id: item.id, ...instruction(item.id) }));
          for (const message of messages)
            await authorizeContextItems(
              this.contextBridge,
              admissionContext,
              message.contextItems ?? [],
            );
          const mapped = factory.resume?.(binding.wait, messages);
          if (
            mapped?.instructionIds.length &&
            mapped.instructionIds.every((id) => ids.includes(id)) &&
            mapped.value !== undefined &&
            schema &&
            compileContract({ params: schema, result: true }).params(mapped.value)
          ) {
            input = {
              attemptId: run.id,
              waitId: binding.wait.waitId,
              instructionIds: mapped.instructionIds,
              value: mapped.value as GraphResumeInput['value'],
            };
            break;
          }
          const last = pending.at(-1);
          if (!last) break;
          pending = readPending(last.seq);
          ids = pending.map((item) => item.id);
        }
        if (!input) {
          signal.throwIfAborted();
          this.setRun(project, {
            ...run,
            state: 'waiting',
            error: '输入未明确满足当前等待；请核对等待要求后重新发送。',
          });
          return;
        }
      }
      const allowed = new Set(ids);
      const checkpointIds = latest?.checkpoint.channel_values.instructionIds;
      const confirmed = JSON.parse(
        this.records(project)
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, `consumption:${run.id}`))
          .get()?.value ?? '{"instructionIds":[]}',
      ) as Consumption;
      if (Array.isArray(checkpointIds))
        for (const id of checkpointIds) {
          const owned = this.records(project)
            .select()
            .from(tables.instructions)
            .where(eq(tables.instructions.id, id))
            .get();
          if (
            owned?.sessionId !== run.sessionId ||
            (owned.consumed && !confirmed.instructionIds.includes(id))
          )
            throw new OperationError('invalidRequest', '图 checkpoint 指令归属无效。');
          if (owned.consumed) allowed.add(id);
        }
      if (previousResume) for (const id of previousResume.instructionIds) allowed.add(id);
      const storedContexts = latest?.checkpoint.channel_values.instructions as
        | InstructionContext[]
        | undefined;
      const restored = [
        ...new Set([
          ...(Array.isArray(checkpointIds) ? (checkpointIds as string[]) : []),
          ...(storedContexts ?? []).map((item) => item.instructionId),
        ]),
      ].map(instruction);
      const submitted =
        input?.instructionIds ?? (resume ? restored.map((item) => item.instructionId) : ids);
      const instructions = submitted.map(instruction);
      for (const item of instructions)
        await authorizeContextItems(this.contextBridge, admissionContext, item.contextItems ?? []);
      for (const item of storedContexts ?? []) {
        const original = instruction(item.instructionId);
        if (!isDeepStrictEqual(item, original))
          throw new OperationError('invalidRequest', '图 checkpoint 指令与持久消息不符。');
      }
      for (const item of restored) allowed.add(item.instructionId);
      for (const id of submitted) allowed.add(id);
      this.instructionEvidence(
        project,
        run.sessionId,
        [...(restored ?? []), ...instructions].flatMap((item) => item.contextItems ?? []),
      );
      const confirm = async ({ checkpointId, instructionIds }: Consumption) => {
        signal.throwIfAborted();
        this.checkExecutionContext(context);
        const saved = await saver.getTuple({
          configurable: { thread_id: run.id, checkpoint_id: checkpointId },
        });
        const recorded = saved?.checkpoint.channel_values.instructionIds;
        if (
          !Array.isArray(recorded) ||
          instructionIds.some((id) => !allowed.has(id) || !recorded.includes(id))
        )
          throw new OperationError('invalidRequest', '图输入缺少已保存的 checkpoint 依据。');
        const durable = saved?.checkpoint.channel_values.instructions;
        if (
          !Array.isArray(durable) ||
          saved?.checkpoint.channel_values.instructionRunId !== run.id ||
          instructionIds.some(
            (id) =>
              !isDeepStrictEqual(
                durable.find((item) => item?.instructionId === id),
                instruction(id),
              ),
          )
        )
          throw new OperationError('invalidRequest', '完整图指令上下文尚未保存到 checkpoint。');
        await authorizeContextItems(
          this.contextBridge,
          context,
          this.instructionEvidence(project, run.sessionId),
        );
        const resumed = saved?.checkpoint.channel_values.graphResume as
          | GraphResumeInput
          | undefined;
        if (
          input &&
          instructionIds.some((id) => input.instructionIds.includes(id)) &&
          (!resumed || !isDeepStrictEqual(resumed, input))
        )
          throw new OperationError('invalidRequest', '等待输入尚未保存到 checkpoint。');
        let changed: boolean;
        try {
          changed = this.repository(project).confirmConsumption(run.sessionId, run.id, {
            checkpointId,
            instructionIds,
          });
        } catch {
          throw new OperationError('outcomeUnknown', '图 checkpoint 已保存，但消费确认尚待核查。');
        }
        if (changed) {
          this.projects.touch(project.id);
          this.notify(project.id, run.sessionId);
        }
      };
      let progress: GraphProgress | undefined;
      const model = run.modelConfig
        ? await this.model.execution(
            async () => {
              this.checkExecutionContext(context);
              await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
              await authorizeContextItems(
                this.contextBridge,
                context,
                this.instructionEvidence(project, run.sessionId),
              );
              if (!this.executionResources)
                throw new OperationError('unavailable', '图资源提供者不可用。');
              for (const evidence of graph.materials) {
                const descriptor = await this.executionResources(context).describe(evidence.ref);
                if (descriptor.basis !== evidence.basis)
                  throw new OperationError('contentChanged', '图材料已变化。');
              }
              const libraryUsed = this.records(project)
                .select()
                .from(tables.meta)
                .where(eq(tables.meta.key, `library-context:${run.sessionId}`))
                .get();
              if (libraryUsed) {
                const library = this.libraryTools(context);
                await library.call('library.check', { access: 'read' });
                await library.call('library.check', { access: 'send' });
              }
              const targets = JSON.parse(
                this.records(project)
                  .select()
                  .from(tables.meta)
                  .where(eq(tables.meta.key, `target-read-context:${run.sessionId}`))
                  .get()?.value ?? '[]',
              ) as string[];
              this.targetFiles?.(context).check(targets);
            },
            signal,
            run.modelConfig,
            () => {
              this.checkExecutionContext(context);
              const resources = this.contextBridge?.resources?.(context);
              if (!resources)
                throw new OperationError('unavailable', '图资源同步授权提供者不可用。');
              const libraryUsed = !!this.records(project)
                .select()
                .from(tables.meta)
                .where(eq(tables.meta.key, `library-context:${run.sessionId}`))
                .get();
              resources.check(
                [...graph.materials, ...this.instructionEvidence(project, run.sessionId)],
                libraryUsed,
              );
              const targets = JSON.parse(
                this.records(project)
                  .select()
                  .from(tables.meta)
                  .where(eq(tables.meta.key, `target-read-context:${run.sessionId}`))
                  .get()?.value ?? '[]',
              ) as string[];
              if (targets.length) {
                if (!this.targetFiles)
                  throw new OperationError('unavailable', '目标只读端口不可用。');
                this.targetFiles(context).check(targets);
              }
            },
          )
        : undefined;
      const executionResources = this.executionResources;
      const remote = new RemoteAgent({
        ...(model ? { model } : {}),
        backend: new ProjectBackend(
          this.projectFiles(context),
          project.id,
          signal,
          () => {},
          () => {},
        ),
        signal,
        instanceId,
        reservation,
        ...(this.workerEntry ? { workerEntry: this.workerEntry } : {}),
        registered: {
          graph,
          attemptId: run.id,
          ...(binding.originInstructionId
            ? { originInstructionId: binding.originInstructionId }
            : {}),
          stateFormatVersion: binding.stateFormatVersion,
          checkpointRef: binding.checkpointRef,
          checkpointPath: opened.path,
          ...(model ? { model: model.descriptor } : {}),
          input,
          instructionIds: submitted,
          instructions,
          checkpointInstructions: restored,
        },
        ...(executionResources ? { resources: () => executionResources(context) } : {}),
        confirm,
        authorize: () => this.checkExecutionContext(context),
        onStart: async (owned) => {
          if (!owned.identity) throw new OperationError('unavailable', '图进程身份不可用。');
          this.records(project)
            .insert(tables.instances)
            .values({
              id: instanceId,
              runId: run.id,
              hostInstanceId: this.hostInstanceId,
              value: {
                instanceId,
                runId: run.id,
                hostInstanceId: this.hostInstanceId,
                processId: owned.identity.pid,
                checkpointPath: opened.path,
                state: 'running',
              },
            })
            .run();
          this.setRun(project, { ...run, state: 'running' });
          await authorizeContextItems(
            this.contextBridge,
            context,
            this.instructionEvidence(project, run.sessionId),
          );
        },
        onStopping: () => updateInstance('stopping'),
        onStop: () => updateInstance('exited'),
        onGraph: async (result) => {
          this.checkExecutionContext(context);
          if (result.kind === 'graph.waiting') {
            if (
              result.wait.attemptId !== run.id ||
              result.wait.checkpointRef !== binding.checkpointRef ||
              !factory.definition.waitSchemas?.[result.wait.inputSchemaRef]
            )
              throw new OperationError('invalidRequest', '图等待不属于当前持久绑定。');
            const saved = await saver.getTuple({ configurable: { thread_id: run.id } });
            const durableWait = saved?.checkpoint.channel_values.graphWait;
            if (!isDeepStrictEqual(durableWait, result.wait))
              throw new OperationError('outcomeUnknown', '等待尚未保存到 checkpoint。');
            const interrupted = saved?.pendingWrites?.some(
              ([, channel, values]) =>
                channel === '__interrupt__' &&
                (Array.isArray(values) ? values : [values]).some(
                  (value) =>
                    value &&
                    typeof value === 'object' &&
                    'id' in value &&
                    value.id === result.wait.waitId,
                ),
            );
            if (!interrupted)
              throw new OperationError('outcomeUnknown', '等待缺少真实 interrupt 依据。');
          }
          if (
            result.kind !== 'graph.failed' &&
            submitted.some(
              (id) =>
                !this.records(project)
                  .select()
                  .from(tables.instructions)
                  .where(eq(tables.instructions.id, id))
                  .get()?.consumed,
            )
          )
            throw new OperationError('outcomeUnknown', '图返回结果前尚未确认指令消费。');
          progress = result;
        },
      });
      for await (const _event of remote.streamEvents(null, {})) {
        /* Registered graphs project their own result. */
      }
      signal.throwIfAborted();
      if (!progress) throw new OperationError('outcomeUnknown', '图未返回可核查结果。');
      const result: GraphProgress = progress;
      if (result.kind === 'graph.waiting')
        run = { ...run, graph: { ...binding, wait: result.wait } };
      else {
        const { wait: _wait, ...completed } = binding;
        run = { ...run, graph: completed };
      }
      this.setRun(project, {
        ...run,
        graphProgress: result,
        state:
          result.kind === 'graph.waiting'
            ? 'waiting'
            : result.kind === 'graph.completed'
              ? 'completed'
              : 'failed',
        remoteOutcome: 'completed',
        ...(result.kind === 'graph.failed' ? { error: result.error.message } : {}),
      });
    } catch (error) {
      this.setRun(project, {
        ...run,
        state:
          error instanceof OperationError && error.code === 'outcomeUnknown'
            ? 'interrupted'
            : signal.aborted
              ? this.stopped
                ? 'interrupted'
                : 'cancelled'
              : 'failed',
        error: modelFailure(error),
        remoteOutcome: 'unknown',
      });
    } finally {
      database?.close();
      release?.();
    }
  }

  private async execute(
    project: HarnessProject,
    initial: Run,
    signal: AbortSignal,
    resume: boolean,
    reservation: ProcessReservation,
  ): Promise<void> {
    let run = initial;
    const continuingUnfinished = resume;
    let checkpointDb: Database.Database | undefined;
    const checkpointClaims: Array<() => void> = [];
    const instanceId = randomUUID();
    const buffers = new Map<string, string>();
    const persistedAt = new Map<string, number>();
    const inFlightTools = new Set<Promise<unknown>>();
    let rootRequested = false;
    let childOutcomeUnknown = false;
    const rememberUnconfirmed = (id: string, parentInstanceId?: string) =>
      this.records(project)
        .insert(tables.instances)
        .values({
          id,
          runId: run.id,
          hostInstanceId: this.hostInstanceId,
          value: {
            instanceId: id,
            runId: run.id,
            hostInstanceId: this.hostInstanceId,
            ...(parentInstanceId ? { parentInstanceId } : {}),
            state: 'stopping',
          },
        })
        .onConflictDoNothing()
        .run();
    const childrenUnsettled = () =>
      childOutcomeUnknown ||
      this.records(project)
        .select()
        .from(tables.instances)
        .all()
        .some(({ value }) => value.parentInstanceId === instanceId && value.state !== 'exited');
    try {
      signal.throwIfAborted();
      await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
      const libraryContextKey = `library-context:${run.sessionId}`;
      const targetContextKey = `target-read-context:${run.sessionId}`;
      const targetChecks = new Set<string>();
      const contextEvidence = () => this.instructionEvidence(project, run.sessionId);
      const rememberContext = (items: readonly ResourceEvidence[]) => {
        this.instructionEvidence(project, run.sessionId, items);
      };
      const effectiveInstructions = new Map<string, InstructionContext>();
      let executionContext: CallContext;
      const previousTargets: string[] = JSON.parse(
        this.records(project)
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, targetContextKey))
          .get()?.value ?? '[]',
      );
      for (const targetProjectId of previousTargets) targetChecks.add(targetProjectId);
      const library = this.libraryTools({
        moduleId: 'harness',
        role: 'execution',
        principal: { kind: 'agent', id: run.sessionId },
        projectId: project.id,
        sessionId: run.sessionId,
        signal,
      });
      const authorizeModel = async () => {
        await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
        await authorizeContextItems(this.contextBridge, executionContext, contextEvidence());
        if (
          this.records(project)
            .select()
            .from(tables.meta)
            .where(eq(tables.meta.key, libraryContextKey))
            .get()
        ) {
          await library.call('library.check', { access: 'read' });
          await library.call('library.check', { access: 'send' });
        }
      };
      const model = await this.model.execution(authorizeModel, signal, run.modelConfig, () => {
        const currentTargets: string[] = JSON.parse(
          this.records(project)
            .select()
            .from(tables.meta)
            .where(eq(tables.meta.key, targetContextKey))
            .get()?.value ?? '[]',
        );
        for (const targetId of currentTargets) targetChecks.add(targetId);
        const libraryUsed = !!this.records(project)
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, libraryContextKey))
          .get();
        const resources = this.contextBridge?.resources?.(executionContext);
        const evidence = contextEvidence();
        if (resources) resources.check(evidence, libraryUsed);
        else if (evidence.length || libraryUsed)
          throw new OperationError('unavailable', '执行资源授权适配尚未接线。');
        if (targets) targets.check(targetChecks);
        else if (targetChecks.size) throw new OperationError('unavailable', '目标只读端口不可用。');
      });
      const scratch = sessionScratch(project.internal, run.sessionId);
      const used = new Map<string, string>();
      const toolContext = new AsyncLocalStorage<{ error?: ErrorInfo }>();
      const scratchResourcePrefix = `scratch-resource:${run.sessionId}:`;
      const rememberScratch = (path: string) => {
        this.records(project)
          .insert(tables.meta)
          .values({
            key: `${scratchResourcePrefix}${encodeURIComponent(path)}`,
            value: path.replace(/^\/+/, ''),
          })
          .onConflictDoNothing()
          .run();
      };
      let scratchLost = false;
      const scratchBackend = (pending = inFlightTools) =>
        trackBackend(
          new Proxy(
            new FilesystemBackend({
              rootDir: scratch,
              virtualMode: true,
            }),
            {
              get(target, property, receiver) {
                const value = Reflect.get(target, property, receiver);
                if (
                  typeof value !== 'function' ||
                  ![
                    'ls',
                    'read',
                    'readRaw',
                    'write',
                    'edit',
                    'glob',
                    'grep',
                    'delete',
                    'uploadFiles',
                    'downloadFiles',
                  ].includes(String(property))
                )
                  return value;
                return async (...args: unknown[]) => {
                  const result = await value.apply(target, args);
                  if (property === 'write' && !result?.error && typeof args[0] === 'string')
                    rememberScratch(args[0]);
                  if (property === 'uploadFiles' && Array.isArray(result)) {
                    for (const file of result)
                      if (!file.error && typeof file.path === 'string') rememberScratch(file.path);
                  }
                  if (
                    property === 'downloadFiles' &&
                    Array.isArray(result) &&
                    result.some((file) => file.error)
                  )
                    scratchLost = true;
                  if ((property === 'read' || property === 'readRaw') && result?.error) {
                    scratchLost = true;
                    result.error = `context_incomplete: ${result.error}`;
                  }
                  const context = toolContext.getStore();
                  if (context && result?.error)
                    context.error = { code: 'unavailable', message: result.error };
                  return result;
                };
              },
            },
          ),
          pending,
        );
      const pendingDirectory = join(project.internal, 'pending-artifacts');
      await privateDirectory(pendingDirectory);
      for (const entry of (await readdir(pendingDirectory)).slice(0, 100)) {
        const filename = join(pendingDirectory, entry);
        const pending = JSON.parse(await readFile(filename, 'utf8')) as {
          sessionId: string;
          artifact: Artifact;
        };
        if (pending.sessionId !== run.sessionId) continue;
        const result = await this.reconcile(project.id, pending.sessionId, pending.artifact.runId, [
          pending.artifact.path,
        ]);
        if (result[0]?.state === 'linked')
          await unlink(filename).catch((error) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          });
      }
      const saved = async (path: string, fileId?: string, basis?: string) => {
        const identity =
          fileId ??
          (await this.port(project)['project.material']({ projectId: project.id, path })).fileId;
        const result = await this.recordSavedResource(
          project.id,
          run.sessionId,
          run.id,
          path,
          identity,
          { ...(basis ? { basis } : {}) },
        );
        if (result.state !== 'confirmed')
          throw new OperationError('outcomeUnknown', `文件 ${path} 已保存，产物登记待核查。`);
      };
      const predecessor = this.records(project)
        .select()
        .from(tables.runs)
        .where(eq(tables.runs.sessionId, run.sessionId))
        .all()
        .map((row) => row.value)
        .filter((previous) => previous.id !== run.id)
        .sort((a, b) => b.attempt - a.attempt)[0];
      if (this.unconfirmedInstance(project, run.sessionId))
        throw new OperationError('unavailable', '旧执行写者尚未排除，停止相关接续。');
      checkpointClaims.push(
        await claimCheckpoints(project.internal, [
          run.id,
          ...(predecessor ? [predecessor.id] : []),
        ]),
      );
      let opened: Awaited<ReturnType<typeof openCheckpoint>>;
      try {
        opened = await openCheckpoint(
          project.internal,
          run.id,
          resume ? undefined : predecessor?.id,
        );
        checkpointDb = opened.database;
        const compatible = await new InstructionSaver(checkpointDb, async () => {}).getTuple({
          configurable: { thread_id: run.id },
        });
        if (resume && !compatible) throw new Error('原尝试缺少有效checkpoint。');
      } catch (error) {
        checkpointDb?.close();
        checkpointDb = undefined;
        if (error instanceof OperationError && error.code !== 'unavailable') throw error;
        if ((error as { code?: string }).code?.startsWith('SQLITE_BUSY'))
          throw new OperationError('instanceMismatch', '旧Checkpoint写者尚未排除。');
        run = { ...run, id: randomUUID(), attempt: run.attempt + 1, state: 'queued' };
        checkpointClaims.push(await claimCheckpoints(project.internal, [run.id]));
        resume = false;
        opened = await openCheckpoint(project.internal, run.id);
        opened.issue =
          error instanceof Error ? error.message : 'Checkpoint不兼容，从持久事实回退。';
        this.setRun(project, run);
      }
      const fileContext: CallContext = {
        moduleId: 'harness',
        role: 'execution',
        principal: { kind: 'agent', id: run.sessionId },
        projectId: project.id,
        sessionId: run.sessionId,
        runId: run.id,
        instanceId,
        workDomain: Object.freeze(
          project.id === 'application'
            ? { kind: 'application', projectId: 'application', sessionId: run.sessionId }
            : { kind: 'project', projectId: project.id, sessionId: run.sessionId },
        ),
        signal,
      };
      executionContext = fileContext;
      const backend = new CompositeBackend(
        trackBackend(
          new ProjectBackend(
            this.projectFiles(fileContext),
            project.id,
            signal,
            (path, fileId) => {
              used.set(fileId, path);
            },
            saved,
            (error) => {
              const context = toolContext.getStore();
              if (context) context.error = error;
            },
          ),
          inFlightTools,
        ),
        {
          [historyPrefix]: scratchBackend(),
          '/large_tool_results/': scratchBackend(),
        },
      );
      const research = this.researchTools(fileContext);
      const targets = this.targetFiles?.(fileContext);
      const checkpointPath = opened.path;
      checkpointDb = opened.database;
      const scratchScope = this.records(project)
        .select()
        .from(tables.meta)
        .where(eq(tables.meta.key, `scratch-isolated:${run.sessionId}`))
        .get()?.value;
      const legacyScratch = !scratchScope;
      await prepareScratch(scratch, join(project.internal, 'scratch'), legacyScratch);
      if (legacyScratch || scratchScope === 'legacy-unverified')
        opened.issue ??= '旧临时上下文没有完整资源清单；原件保留，需核查持久工作材料。';
      this.records(project)
        .insert(tables.meta)
        .values({
          key: `scratch-isolated:${run.sessionId}`,
          value: legacyScratch ? 'legacy-unverified' : 'true',
        })
        .onConflictDoNothing()
        .run();
      if (opened.issue)
        this.records(project)
          .insert(tables.meta)
          .values({ key: `checkpoint-diagnostic:${run.id}`, value: opened.issue })
          .onConflictDoUpdate({ target: tables.meta.key, set: { value: opened.issue } })
          .run();
      const confirmInstructions = async ({ checkpointId, instructionIds }: Consumption) => {
        signal.throwIfAborted();
        const saved = await saver.getTuple({
          configurable: { thread_id: run.id, checkpoint_id: checkpointId },
        });
        const recorded: unknown = saved?.checkpoint.channel_values.instructionIds;
        if (!Array.isArray(recorded) || instructionIds.some((id) => !recorded.includes(id)))
          throw new OperationError('invalidRequest', '消费确认缺少已保存的checkpoint依据。');
        const changed = this.repository(project).confirmConsumption(run.sessionId, run.id, {
          checkpointId,
          instructionIds,
        });
        if (changed) {
          this.projects.touch(project.id);
          this.notify(project.id, run.sessionId);
        }
      };
      const saver = new InstructionSaver(checkpointDb, confirmInstructions);
      const instructionMiddleware = createMiddleware({
        name: 'ScholoomInstructions',
        stateSchema: z.object({ instructionIds: z.array(z.string()).max(100).default([]) }),
        beforeModel: async (state) => {
          signal.throwIfAborted();
          await this.port(project)['project.check']({ projectId: project.id, access: 'send' });
          const present = new Set(state.messages.map((message) => message.id));
          const pending = this.records(project)
            .select()
            .from(tables.instructions)
            .where(
              and(
                eq(tables.instructions.sessionId, run.sessionId),
                eq(tables.instructions.consumed, false),
              ),
            )
            .orderBy(tables.instructions.seq)
            .limit(100)
            .all();
          const incoming: HumanMessage[] = [];
          if (scratchLost) {
            incoming.push(
              new HumanMessage({
                id: `scratch-diagnostic:${run.id}`,
                content: 'context_incomplete：临时上下文读取失败，请核查持久工作材料后继续。',
              }),
            );
            scratchLost = false;
          }
          for (const previous of state.messages.slice(-100)) {
            if (previous.getType() !== 'human' || !previous.id) continue;
            const stored = this.records(project)
              .select()
              .from(tables.messages)
              .where(eq(tables.messages.id, previous.id))
              .get()?.value;
            if (!stored) continue;
            if (stored.contextItems?.length) {
              await authorizeContextItems(this.contextBridge, fileContext, stored.contextItems);
              rememberContext(stored.contextItems);
            }
            if (!stored.materialFileIds?.length && !stored.contextItems?.length) continue;
            const content = await this.instructionContent(project, stored);
            if (content !== previous.content)
              incoming.push(new HumanMessage({ id: previous.id, content }));
          }
          for (const item of pending) {
            // Leave overflow pending for the next run without changing its acceptance receipt.
            if (!effectiveInstructions.has(item.id) && effectiveInstructions.size >= 100) break;
            const message = this.records(project)
              .select()
              .from(tables.messages)
              .where(eq(tables.messages.id, item.id))
              .get()?.value;
            if (!message) continue;
            await authorizeContextItems(
              this.contextBridge,
              fileContext,
              message.contextItems ?? [],
            );
            rememberContext(message.contextItems ?? []);
            effectiveInstructions.set(item.id, {
              instructionId: item.id,
              ...(message.source ? { source: message.source } : {}),
              ...(message.contextItems ? { contextItems: message.contextItems } : {}),
            });
            if (!present.has(item.id))
              incoming.push(
                new HumanMessage({
                  id: item.id,
                  content: await this.instructionContent(project, message),
                }),
              );
          }
          return {
            ...(incoming.length ? { messages: incoming } : {}),
            instructionIds: pending
              .filter((item) => effectiveInstructions.has(item.id))
              .map((item) => item.id),
            instructionRunId: run.id,
            instructions: [...effectiveInstructions.values()],
          };
        },
        wrapModelCall: async (request, handler) => {
          this.setRun(project, { ...run, state: 'running' });
          const result = await handler(request);
          return result;
        },
      });
      const createToolMiddleware = (namespace: string, pending: Set<Promise<unknown>>) =>
        createMiddleware({
          name: 'ScholoomToolReceipts',
          wrapToolCall: (request, handler) => {
            const done = (async () => {
              signal.throwIfAborted();
              await this.port(project)['project.check']({
                projectId: project.id,
                access: 'send',
              });
              signal.throwIfAborted();
              const callId = request.toolCall.id;
              const key = `tool:${namespace}:${callId}`;
              const input = toolPreview(JSON.stringify(request.toolCall.args));
              const tool = {
                runId: run.id,
                name: request.toolCall.name,
                input: input.text,
                inputTruncated: input.truncated,
              };
              const message: Message = {
                id: key,
                sessionId: run.sessionId,
                role: 'tool',
                text: request.toolCall.name,
                state: 'streaming',
                materials: [],
                createdAt: now(),
                tool,
              };
              const recordResult = (result: ToolMessage, error?: ErrorInfo) => {
                const output = toolPreview(visibleText(result));
                this.putMessage(project, {
                  ...message,
                  state:
                    error?.code === 'outcomeUnknown'
                      ? 'unknown'
                      : result.status === 'error'
                        ? 'error'
                        : 'complete',
                  materials: [...used.values()],
                  materialFileIds: [...used.keys()],
                  tool: { ...tool, output: output.text, outputTruncated: output.truncated },
                });
              };
              const previous = this.records(project)
                .select()
                .from(tables.meta)
                .where(eq(tables.meta.key, key))
                .get();
              if (previous) {
                const record = JSON.parse(previous.value);
                if (!record.result)
                  throw new OperationError(
                    'outcomeUnknown',
                    '中断前工具效果未知，请核查文件后使用新指令继续。',
                  );
                const result = mapStoredMessageToChatMessage(record.result);
                if (!(result instanceof ToolMessage))
                  throw new OperationError('outcomeUnknown', '旧工具结果不可恢复。');
                recordResult(result, record.error);
                return result;
              }
              this.putMessage(project, message);
              this.records(project)
                .insert(tables.meta)
                .values({
                  key,
                  value: JSON.stringify({
                    name: request.toolCall.name,
                    args: request.toolCall.args,
                    state: 'pending',
                  }),
                })
                .run();
              const context: { error?: ErrorInfo } = {};
              let result: Awaited<ReturnType<typeof handler>>;
              try {
                result = await toolContext.run(context, () => handler(request));
              } catch (error) {
                const output = toolPreview(modelFailure(error));
                this.putMessage(project, {
                  ...message,
                  state:
                    signal.aborted ||
                    (error instanceof OperationError && error.code === 'outcomeUnknown')
                      ? 'unknown'
                      : 'error',
                  tool: { ...tool, output: output.text, outputTruncated: output.truncated },
                });
                throw error;
              }
              if (result instanceof ToolMessage) {
                if (context.error) result.status = 'error';
                this.records(project)
                  .update(tables.meta)
                  .set({ value: JSON.stringify({ result: result.toDict(), error: context.error }) })
                  .where(eq(tables.meta.key, key))
                  .run();
                recordResult(result, context.error);
              } else {
                this.records(project).delete(tables.meta).where(eq(tables.meta.key, key)).run();
                const update = isCommand(result) ? result.update : undefined;
                const messages = update && !Array.isArray(update) ? update.messages : undefined;
                const output = Array.isArray(messages)
                  ? messages
                      .map(coerceMessageLikeToMessage)
                      .find((item) => item instanceof ToolMessage && item.tool_call_id === callId)
                  : undefined;
                if (output instanceof ToolMessage) recordResult(output, context.error);
              }
              return result;
            })();
            return track(pending, done);
          },
        });
      const childrenController = new AbortController();
      const childSignal = AbortSignal.any([signal, childrenController.signal]);
      const instanceLifecycle = (id: string, parentInstanceId?: string) => {
        const update = (state: tables.RunInstance['state']) => {
          const row = this.records(project)
            .select()
            .from(tables.instances)
            .where(eq(tables.instances.id, id))
            .get();
          if (row)
            this.records(project)
              .update(tables.instances)
              .set({ value: { ...row.value, state } })
              .where(eq(tables.instances.id, id))
              .run();
        };
        return {
          authorize: () => this.checkExecutionContext({ ...fileContext, instanceId: id }),
          onStart: (owned: import('@scholoom/platform/node').ManagedNode) => {
            if (!owned.identity)
              throw new OperationError('unavailable', '执行未提供实际进程身份。');
            const value: tables.RunInstance = {
              instanceId: id,
              hostInstanceId: this.hostInstanceId,
              runId: run.id,
              state: 'running',
              processId: owned.identity.pid,
              ...(parentInstanceId ? { parentInstanceId } : { checkpointPath }),
            };
            this.records(project)
              .insert(tables.instances)
              .values({ id, runId: run.id, hostInstanceId: this.hostInstanceId, value })
              .run();
          },
          onStopping: () => {
            try {
              update('stopping');
            } finally {
              if (!parentInstanceId)
                childrenController.abort(new Error('Parent execution stopped'));
            }
          },
          onStop: () => update('exited'),
        };
      };
      const { signal: _progressSignal, ...progressContext } = fileContext;
      const progress = this.researchProgress(progressContext);
      this.capabilityExecutors.set(run.id, {
        context: fileContext,
        execute: async (execution, childReservation) => {
          const capabilityTools = new Set<Promise<unknown>>();
          const childInstanceId = randomUUID();
          const capabilityBackend = trackBackend(
            new ProjectBackend(
              this.projectFiles({
                ...fileContext,
                instanceId: childInstanceId,
                signal: childSignal,
              }),
              project.id,
              childSignal,
              async (path, fileId) => {
                used.set(fileId, path);
                await progress({
                  attemptId: execution.attemptId,
                  event: { kind: 'read', file: { path, fileId } },
                });
              },
              async (path, fileId, basis) => {
                const identity =
                  fileId ??
                  (
                    await this.port(project)['project.material']({
                      projectId: project.id,
                      path,
                    })
                  ).fileId;
                await progress({
                  attemptId: execution.attemptId,
                  event: { kind: 'saved', file: { path, fileId: identity } },
                });
                await saved(path, identity, basis);
              },
              async (error) => {
                await progress({
                  attemptId: execution.attemptId,
                  event: { kind: 'failed', issue: `${error.code}: ${error.message}` },
                });
                const context = toolContext.getStore();
                if (context) context.error = error;
              },
              execution.expectedOutput,
            ),
            capabilityTools,
          );
          const capability = new RemoteAgent({
            ...(childReservation ? { reservation: childReservation } : {}),
            ...(this.workerEntry ? { workerEntry: this.workerEntry } : {}),
            model,
            signal: childSignal,
            instanceId: childInstanceId,
            ...instanceLifecycle(childInstanceId, instanceId),
            backend: new CompositeBackend(capabilityBackend, {
              [historyPrefix]: scratchBackend(capabilityTools),
              '/large_tool_results/': scratchBackend(capabilityTools),
            }),
            middleware: [
              createToolMiddleware(`${run.id}:capability:${execution.attemptId}`, capabilityTools),
            ],
            systemPrompt:
              '你在当前 Scholoom 执行内运用科研方法。使用实际文件工具，保存要求的报告，保留来源及限制。只执行给定目标，不委派，不创建任务；工具错误与科研不足如实说明。',
          });
          try {
            await capability.invoke(
              { messages: [new HumanMessage(execution.prompt)] },
              {
                signal: childSignal,
                recursionLimit: 1000,
              },
            );
          } catch (error) {
            if (error instanceof OperationError && error.code === 'outcomeUnknown') {
              childOutcomeUnknown = true;
              rememberUnconfirmed(childInstanceId, instanceId);
            }
            throw error;
          } finally {
            await settleTools(capabilityTools);
          }
        },
      });
      const buildAgent = () =>
        new RemoteAgent({
          ...(this.workerEntry ? { workerEntry: this.workerEntry } : {}),
          model,
          backend,
          checkpointPath,
          confirm: confirmInstructions,
          signal,
          instanceId,
          reservation,
          ...instanceLifecycle(instanceId),
          middleware: [instructionMiddleware, createToolMiddleware(run.id, inFlightTools)],
          systemPrompt:
            '你是 Scholoom 科研助手。使用中文与用户工作。项目正文以实际文件为准，附加材料只是引用，先读取。形成可承接的分析、理由、成果及下一步时保存为普通 Markdown 文件；在没有项目文件权限时只对话。仅使用授权工具。修改已有文件先读取，遇到冲突重读再修改。write_file 仅用于新建，edit_file 修改已有内容。不得声称未保存成果已交付。不要依赖旧 transcript 才能续做，可发现并读取项目已有成果。用户取消后不继续。',
          tools: [
            {
              name: 'read_context_resource',
              description:
                '按明确资源引用及原 basis 重新读取项目或库材料；每片有界。附加摘录和工作台选择不代表已读取。材料已变化时核查当前版本并询问用户，不猜测或替换引用。',
              schema: resourceOperations['resources.read'].params,
              func: async (input: ResourceInputs['resources.read']) => {
                try {
                  this.checkExecutionContext(fileContext);
                  const resources = this.contextBridge?.resources?.(fileContext);
                  if (!resources?.port.read)
                    throw new OperationError('unavailable', '执行资源读取端口不可用。');
                  resources.check([{ ref: input.ref, basis: input.basis }]);
                  const result = await resources.port.read(input);
                  resources.check([{ ref: input.ref, basis: input.basis }]);
                  rememberContext([{ ref: input.ref, basis: input.basis }]);
                  return JSON.stringify(result);
                } catch (error) {
                  const info = failure(error);
                  const current = toolContext.getStore();
                  if (current) current.error = info;
                  return JSON.stringify({ error: info });
                }
              },
            },
            {
              name: 'read_workbench_context',
              description:
                '调用时查询本次推进的工作台当前选择。多来源返回 ambiguous 与当前 instructionIds；需明确选择其中的 instructionId，不能选择最近窗口。选择只是线索，材料需实际读取。',
              schema: workbenchContextInternalOperations['workbench.context.read'].params,
              func: async ({ instructionId }: { instructionId?: string }) => {
                try {
                  this.checkExecutionContext(fileContext);
                  await this.port(project)['project.check']({
                    projectId: project.id,
                    access: 'send',
                  });
                  const result = await readInstructionContext(
                    [...effectiveInstructions.values()],
                    instructionId,
                    fileContext,
                    this.contextBridge,
                  );
                  if (result.state === 'available') rememberContext(result.snapshot.selections);
                  return JSON.stringify(result);
                } catch (error) {
                  const info = failure(error);
                  const current = toolContext.getStore();
                  if (current) current.error = info;
                  return JSON.stringify({ error: info });
                }
              },
            },
            {
              name: 'read_work_domain',
              description:
                '读取宿主绑定的当前工作域。全局会话临时文件使用 /large_tool_results/，仅本会话可见；长期成果由所属项目或文献库保存。',
              schema: z.object({}),
              func: async () => {
                this.checkExecutionContext(fileContext);
                return JSON.stringify(fileContext.workDomain);
              },
            },
            {
              name: 'read_target_project',
              description:
                '只读其他已登记且可信项目。先以 list 分页取得 fileId、basis，再 describe/readText/readBytes；每片必须带原 basis。不能创建身份、修改目标或访问私有资料；临时内容保存到本会话 /large_tool_results/。',
              schema: projectTargetReadOperations['project.readTarget'].params,
              func: async (input: ProjectTargetReadInputs['project.readTarget']) => {
                try {
                  if (!targets) throw new OperationError('unavailable', '目标只读端口不可用。');
                  const result = await targets['project.readTarget'](input);
                  targetChecks.add(input.targetProjectId);
                  this.records(project)
                    .insert(tables.meta)
                    .values({
                      key: targetContextKey,
                      value: JSON.stringify([...targetChecks]),
                    })
                    .onConflictDoUpdate({
                      target: tables.meta.key,
                      set: { value: JSON.stringify([...targetChecks]) },
                    })
                    .run();
                  return JSON.stringify(result);
                } catch (error) {
                  const info = failure(error);
                  const context = toolContext.getStore();
                  if (context) context.error = info;
                  return JSON.stringify({ error: info });
                }
              },
            },
            ...libraryToolMethods.map((method) => ({
              name: method.replace('.', '_'),
              description: `共同文献库 ${method}。importProjectFiles只接受当前授权项目内相对路径，返回批次引用，用batch核查逐项结果。附件登记不等于可读；readAttachment按引用返回有界原字节base64，不表示已解析正文。EPUB/HTML用documentInfo分页章节、readDocumentSection分段正文（textOnly省略渲染节点）、searchDocument按nextCursor继续，complete才表示覆盖结束；文本位置沿normalizationVersion/sectionId/start/end，摘录须与该UTF-16区间一致。阅读记录绑定材料版本；quote是摘录，body是你的解释；更正/移除先读修订号，未知创建按原recordId核查。库读取/写入/外发均需授权；未知批次先按原batchId核查。`,
              schema:
                method === 'library.importProjectFiles'
                  ? {
                      ...libraryOperations[method].params,
                      properties: {
                        ...libraryOperations[method].params.properties,
                        projectId: { const: project.id },
                      },
                      required: libraryOperations[method].params.required.filter(
                        (key) => key !== 'projectId',
                      ),
                    }
                  : libraryOperations[method].params,
              func: async (input: Record<string, unknown>) => {
                try {
                  signal.throwIfAborted();
                  await this.port(project)['project.check']({
                    projectId: project.id,
                    access: 'send',
                  });
                  await library.call('library.check', { access: 'send' });
                  const args: readonly [string, unknown] = [
                    method,
                    method === 'library.importProjectFiles'
                      ? { ...input, projectId: project.id }
                      : input,
                  ];
                  if (!isLibraryToolCall(args))
                    throw new OperationError('invalidRequest', '文献工具参数不符合契约。');
                  const result = await library.call(...args);
                  signal.throwIfAborted();
                  await this.port(project)['project.check']({
                    projectId: project.id,
                    access: 'send',
                  });
                  await library.call('library.check', { access: 'read' });
                  await library.call('library.check', { access: 'send' });
                  this.records(project)
                    .insert(tables.meta)
                    .values({ key: libraryContextKey, value: '1' })
                    .onConflictDoNothing()
                    .run();
                  this.projects.touch(project.id);
                  return JSON.stringify(result);
                } catch (error) {
                  const info = failure(error);
                  const context = toolContext.getStore();
                  if (context) context.error = info;
                  return JSON.stringify({ error: info });
                }
              },
            })),
            {
              name: 'discover_research_methods',
              description: '发现可用科研方法摘要，不启动执行。',
              schema: z.object({}),
              func: async () => JSON.stringify(await research['research.methods']({})),
            },
            {
              name: 'load_research_method',
              description: '按身份及版本读取科研方法正文与能力声明，不建立任务或调用。',
              schema: z.object({ methodId: z.string(), version: z.string() }),
              func: async ({ methodId, version }: { methodId: string; version: string }) =>
                JSON.stringify(await research['research.method']({ methodId, version })),
            },
            {
              name: 'read_research_attempts',
              description:
                '分页核查本会话的科研能力调用、实际成果与缺项。重试前先核查；查询不执行模型。',
              schema: z.object({
                invocationId: z.string().optional(),
                offset: z.number().int().min(0).default(0),
              }),
              func: async (input: { invocationId?: string; offset: number }) =>
                JSON.stringify(
                  await research['research.attempts']({
                    projectId: project.id,
                    sessionId: run.sessionId,
                    ...input,
                  }),
                ),
            },
            {
              name: 'invoke_research_capability',
              description:
                '明确调用已发现的科研能力，输入及交付由运行时核对并自动保存调用/尝试。普通方法可直接加载使用。重试同一次科研使用前查询原记录并提供invocationId；独立目标不复用身份。',
              schema: researchRequestSchema,
              func: async (input: ResearchRequest) => {
                let childReservation: ProcessReservation | undefined;
                try {
                  childReservation = this.processes.reserve();
                  const attempt = await this.capabilityReservations.run(childReservation, () =>
                    research['research.invoke'](input),
                  );
                  if (attempt.delivery !== 'usable') {
                    const context = toolContext.getStore();
                    if (context)
                      context.error = {
                        code: 'unavailable',
                        message: '科研能力未完整交付，请核查尝试记录。',
                      };
                  }
                  return JSON.stringify(attempt);
                } catch (error) {
                  const info = failure(error);
                  const context = toolContext.getStore();
                  if (context) context.error = info;
                  return JSON.stringify({ error: info });
                } finally {
                  childReservation?.release();
                }
              },
            },
            ...(['mkdir', 'rename', 'trash', 'restore'] as const).map((kind) => ({
              name: `${kind}_project_path`,
              description: `对项目普通文件或目录执行${kind}。写授权包含回收／恢复；operationId须为唯一UUID，结果未知时先查询原操作。rename仅更改名称。`,
              schema: z.object({
                operationId: z.string(),
                path: z.string().optional(),
                name: z.string().optional(),
                trashId: z.string().optional(),
                destination: z.string().optional(),
              }),
              func: async (input: {
                operationId: string;
                path?: string;
                name?: string;
                trashId?: string;
                destination?: string;
              }) => {
                try {
                  signal.throwIfAborted();
                  await this.port(project, run.sessionId, signal)['project.check']({
                    projectId: project.id,
                    access: 'send',
                  });
                  const { operationId, ...parameters } = input;
                  const projectId = project.id;
                  let result: import('@scholoom/protocol/projects').FileOperation;
                  if (kind === 'mkdir' || kind === 'trash') {
                    if (!parameters.path)
                      throw new OperationError('invalidRequest', '缺少目标路径。');
                    result = await this.port(project, run.sessionId, signal)[
                      kind === 'mkdir' ? 'files.mkdir' : 'files.trash'
                    ]({ projectId, operationId, path: parameters.path });
                  } else if (kind === 'rename') {
                    if (!parameters.path || !parameters.name)
                      throw new OperationError('invalidRequest', '缺少路径或名称。');
                    result = await this.port(project, run.sessionId, signal)['files.rename']({
                      projectId,
                      operationId,
                      path: parameters.path,
                      name: parameters.name,
                    });
                  } else {
                    if (!parameters.trashId)
                      throw new OperationError('invalidRequest', '缺少回收身份。');
                    result = await this.port(project, run.sessionId, signal)['files.restore']({
                      projectId,
                      operationId,
                      trashId: parameters.trashId,
                      ...(parameters.destination ? { destination: parameters.destination } : {}),
                    });
                  }
                  this.notify(project.id, run.sessionId);
                  return JSON.stringify(result);
                } catch (error) {
                  const result = failure(error);
                  const context = toolContext.getStore();
                  if (context) context.error = result;
                  return JSON.stringify({ error: result });
                }
              },
            })),
            {
              name: 'query_file_operation',
              description: '查询未知的文件结构操作，核查实际位置而不重新执行。',
              schema: z.object({ operationId: z.string() }),
              func: async ({ operationId }: { operationId: string }) => {
                signal.throwIfAborted();
                await this.port(project, run.sessionId, signal)['project.check']({
                  projectId: project.id,
                  access: 'send',
                });
                return JSON.stringify(
                  await this.port(project, run.sessionId, signal)['files.operation']({
                    projectId: project.id,
                    operationId,
                  }),
                );
              },
            },
            {
              name: 'list_project_trash',
              description: '分页查看项目回收项。',
              schema: z.object({ offset: z.number().int().min(0).default(0) }),
              func: async ({ offset }: { offset: number }) => {
                signal.throwIfAborted();
                await this.port(project, run.sessionId, signal)['project.check']({
                  projectId: project.id,
                  access: 'send',
                });
                return JSON.stringify(
                  await this.port(project, run.sessionId, signal)['files.trashList']({
                    projectId: project.id,
                    offset,
                    limit: 25,
                  }),
                );
              },
            },
            {
              name: 'read_instructions',
              description: '分页读取本会话全部持久用户指令与消费状态。续做时按需核对历史要求。',
              schema: z.object({ after: z.number().int().min(0).default(0) }),
              func: async ({ after }: { after: number }) => {
                const rows = this.records(project)
                  .select()
                  .from(tables.instructions)
                  .where(
                    and(
                      eq(tables.instructions.sessionId, run.sessionId),
                      gt(tables.instructions.seq, after),
                    ),
                  )
                  .orderBy(tables.instructions.seq)
                  .limit(25)
                  .all();
                return JSON.stringify(
                  await Promise.all(
                    rows.map(async (row) => {
                      const message = this.records(project)
                        .select()
                        .from(tables.messages)
                        .where(eq(tables.messages.id, row.id))
                        .get()?.value;
                      return {
                        sequence: row.seq,
                        consumed: row.consumed,
                        message,
                        currentContent: message
                          ? await (async () => {
                              await authorizeContextItems(
                                this.contextBridge,
                                fileContext,
                                message.contextItems ?? [],
                              );
                              rememberContext(message.contextItems ?? []);
                              return this.instructionContent(project, message);
                            })()
                          : undefined,
                      };
                    }),
                  ),
                );
              },
            },
          ].map((definition) =>
            defineTool((input) => track(inFlightTools, definition.func(input as never)), {
              name: definition.name,
              description: definition.description,
              schema: definition.schema,
            }),
          ),
        });
      const agent = buildAgent();
      const config = {
        configurable: { thread_id: run.id },
        signal,
        recursionLimit: 1000,
        durability: 'sync' as const,
        callbacks: [],
      };
      let input: { messages: BaseMessage[] } | null = { messages: [] };
      const checkpoint = await saver.getTuple(config);
      if (checkpoint) {
        const saved = checkpoint.checkpoint.channel_values.instructions;
        if (
          checkpoint.checkpoint.channel_values.instructionRunId === run.id &&
          Array.isArray(saved)
        )
          for (const item of saved as InstructionContext[]) {
            const row = this.records(project)
              .select()
              .from(tables.instructions)
              .where(eq(tables.instructions.id, item.instructionId))
              .get();
            if (row?.sessionId === run.sessionId) {
              const message = this.records(project)
                .select()
                .from(tables.messages)
                .where(eq(tables.messages.id, item.instructionId))
                .get()?.value;
              if (message)
                effectiveInstructions.set(item.instructionId, {
                  instructionId: item.instructionId,
                  ...(message.source ? { source: message.source } : {}),
                  ...(message.contextItems ? { contextItems: message.contextItems } : {}),
                });
            }
          }
        await saver.confirmLatest(config);
        input = {
          messages: this.checkpointToolResults(
            project,
            run.id,
            predecessor?.id,
            checkpoint.checkpoint.channel_values.messages,
          ),
        };
      } else {
        if (continuingUnfinished) {
          const delivered = Number(
            this.records(project)
              .select()
              .from(tables.meta)
              .where(eq(tables.meta.key, `delivered:${run.sessionId}`))
              .get()?.value ?? 0,
          );
          this.records(project)
            .update(tables.instructions)
            .set({ consumed: false })
            .where(
              and(
                eq(tables.instructions.sessionId, run.sessionId),
                gt(tables.instructions.seq, delivered),
              ),
            )
            .run();
        }
        input = { messages: await this.continuation(project, run.sessionId) };
        for (const message of input.messages) {
          if (!message.id) continue;
          const stored = this.records(project)
            .select()
            .from(tables.messages)
            .where(eq(tables.messages.id, message.id))
            .get()?.value;
          if (stored?.contextItems?.length) {
            await authorizeContextItems(this.contextBridge, fileContext, stored.contextItems);
            rememberContext(stored.contextItems);
          }
        }
      }
      const summary = checkpoint?.checkpoint.channel_values._summarizationEvent;
      let historyMissing = false;
      const scratchReferences = new Set<string>();
      const savedScratch = this.records(project)
        .select()
        .from(tables.meta)
        .where(
          sql`substr(${tables.meta.key},1,${scratchResourcePrefix.length}) = ${scratchResourcePrefix}`,
        )
        .limit(1001)
        .all();
      if (savedScratch.length > 1000) historyMissing = true;
      for (const resource of savedScratch.slice(0, 1000)) scratchReferences.add(resource.value);
      const storedMessages = checkpoint?.checkpoint.channel_values.messages;
      if (Array.isArray(storedMessages)) {
        for (const message of storedMessages) {
          if (!(message instanceof HumanMessage)) continue;
          const path = message.additional_kwargs.lc_evicted_to;
          if (typeof path === 'string') {
            const prefix = [historyPrefix, '/large_tool_results/'].find((prefix) =>
              path.startsWith(prefix),
            );
            if (prefix) scratchReferences.add(path.slice(prefix.length));
          }
        }
      }
      if (summary && typeof summary === 'object' && 'filePath' in summary) {
        historyMissing ||=
          typeof summary.filePath !== 'string' || !summary.filePath.startsWith(historyPrefix);
        if (typeof summary.filePath === 'string' && summary.filePath.startsWith(historyPrefix)) {
          scratchReferences.add(summary.filePath.slice(historyPrefix.length));
        }
      }
      if (scratchReferences.size) {
        if (scratchReferences.size > 1000) historyMissing = true;
        const resources = new ResourceAccess(this.hostInstanceId);
        try {
          const reference = await resources.bind({
            root: scratch,
            owner: run.sessionId,
            consumers: ['harness'],
            check: () => signal.throwIfAborted(),
          });
          try {
            for (const path of [...scratchReferences].slice(0, 1000)) {
              const history = await resources.read(
                reference,
                path,
                {
                  moduleId: 'harness',
                  role: 'host',
                  principal: { kind: 'system', id: this.hostInstanceId },
                  signal,
                },
                0,
                1,
              );
              if (
                history.byteLength === 0 &&
                summary &&
                typeof summary === 'object' &&
                'filePath' in summary &&
                summary.filePath === `${historyPrefix}${path}`
              )
                historyMissing = true;
            }
          } finally {
            resources.revoke(reference);
          }
        } catch {
          historyMissing = true;
        }
      }
      if (
        opened.issue ||
        historyMissing ||
        (!checkpoint && (continuingUnfinished || predecessor))
      ) {
        this.records(project)
          .insert(tables.meta)
          .values({
            key: `checkpoint-diagnostic:${run.id}`,
            value: historyMissing
              ? '临时上下文资源缺失或不可读。'
              : '上下文未完整恢复，从持久指令和工作材料核查接续。',
          })
          .onConflictDoNothing()
          .run();
        input.messages.push(
          new HumanMessage({
            id: `context-diagnostic:${run.id}`,
            content:
              'context_incomplete：上下文未完整恢复。保留的摘要和领域成果仍可使用；缺失的临时图或原始历史不能视为完整资料，请先核查持久指令、工作材料及实际成果，再按最新要求推进。',
          }),
        );
      }
      rootRequested = true;
      for await (const event of agent.streamEvents(input, { ...config, version: 'v2' })) {
        signal.throwIfAborted();
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data.chunk;
          if (!chunk) continue;
          const id = `${run.id}:model:${event.run_id}`;
          const text = visibleText(chunk);
          if (text) {
            const value = ((buffers.get(id) ?? '') + text).slice(-262144);
            buffers.set(id, value);
            if (Date.now() - (persistedAt.get(id) ?? 0) >= 50) {
              this.putMessage(project, {
                id,
                sessionId: run.sessionId,
                runId: run.id,
                role: 'assistant',
                text: value,
                state: 'streaming',
                materials: [...used.values()],
                materialFileIds: [...used.keys()],
                createdAt: now(),
              });
              persistedAt.set(id, Date.now());
            }
          }
        }
        if (event.event === 'on_chat_model_end') {
          const message = event.data.output as AIMessage;
          const id = `${run.id}:model:${event.run_id}`;
          const text = visibleText(message);
          if (text || buffers.has(id))
            this.putMessage(project, {
              id,
              sessionId: run.sessionId,
              runId: run.id,
              role: 'assistant',
              text: (text || buffers.get(id) || '').slice(-262144),
              state: 'complete',
              materials: [...used.values()],
              materialFileIds: [...used.keys()],
              createdAt: now(),
            });
          const usage = (
            message as unknown as {
              usage_metadata?: { input_tokens: number; output_tokens: number };
            }
          ).usage_metadata;
          if (usage) {
            run = {
              ...run,
              inputTokens: (run.inputTokens ?? 0) + usage.input_tokens,
              outputTokens: (run.outputTokens ?? 0) + usage.output_tokens,
            };
          }
        }
      }
      const delivered = this.records(project)
        .select({ seq: tables.instructions.seq })
        .from(tables.instructions)
        .where(
          and(
            eq(tables.instructions.sessionId, run.sessionId),
            eq(tables.instructions.consumed, true),
          ),
        )
        .orderBy(desc(tables.instructions.seq))
        .limit(1)
        .get();
      if (delivered) {
        const key = `delivered:${run.sessionId}`;
        this.records(project)
          .insert(tables.meta)
          .values({ key, value: String(delivered.seq) })
          .onConflictDoUpdate({ target: tables.meta.key, set: { value: String(delivered.seq) } })
          .run();
      }
      await settleTools(inFlightTools);
      if (childrenUnsettled())
        throw new OperationError('outcomeUnknown', '能力子执行尚未确认停止。');
      this.setRun(project, { ...run, state: 'completed', remoteOutcome: 'completed' });
    } catch (error) {
      await settleTools(inFlightTools);
      if (rootRequested && error instanceof OperationError && error.code === 'outcomeUnknown')
        rememberUnconfirmed(instanceId);
      for (const [id, text] of buffers) {
        const prior = this.records(project)
          .select()
          .from(tables.messages)
          .where(eq(tables.messages.id, id))
          .get()?.value;
        if (prior?.state !== 'complete')
          this.putMessage(project, {
            id,
            sessionId: run.sessionId,
            runId: run.id,
            role: 'assistant',
            text,
            state: 'error',
            materials: prior?.materials ?? [],
            ...(prior?.materialFileIds ? { materialFileIds: prior.materialFileIds } : {}),
            createdAt: prior?.createdAt ?? now(),
          });
      }
      const stopUnknown =
        (error instanceof OperationError && error.code === 'outcomeUnknown') || childrenUnsettled();
      this.setRun(project, {
        ...run,
        state: stopUnknown
          ? 'interrupted'
          : signal.aborted
            ? this.stopped
              ? 'interrupted'
              : 'cancelled'
            : 'failed',
        error:
          signal.aborted &&
          !stopUnknown &&
          !(error instanceof OperationError && error.code === 'unavailable')
            ? '本地执行已停止，已保存效果保留；远端停止状态未知。'
            : modelFailure(error),
        remoteOutcome: 'unknown',
      });
    } finally {
      this.capabilityExecutors.delete(run.id);
      try {
        this.interruptTools(project, run);
      } finally {
        try {
          checkpointDb?.close();
        } finally {
          for (const release of checkpointClaims.reverse()) release();
        }
      }
    }
  }

  private async instructionContent(project: HarnessProject, message: Message): Promise<string> {
    if (message.contextItems?.length)
      message = {
        ...message,
        text: `${message.text}\n明确附加项（不代表已读取完整原文）：\n${message.contextItems.map(contextItemContent).join('\n\n')}`,
      };
    if (!message.materials.length) return message.text;
    if (!message.materialFileIds?.length)
      return `${message.text}\n附加材料引用（先读取再使用）：${message.materials.join(', ')}`;
    const locations = await Promise.all(
      message.materialFileIds.map(async (id, index) => {
        try {
          const location = (
            await this.port(project)['files.resolve']({ projectId: project.id, fileIds: [id] })
          )[0];
          if (!location) throw new OperationError('notFound', '材料身份不可用。');
          return {
            fileId: id,
            historicalPath: message.materials[index],
            state: location.state,
            ...(location.state === 'present' ? { currentPath: location.path } : {}),
          };
        } catch {
          return { fileId: id, historicalPath: message.materials[index], state: 'missing' };
        }
      }),
    );
    return `${message.text}\n附加材料定位（按当前路径读取；历史路径不能指代同名新文件，回收或缺失项请核查）：${JSON.stringify(locations)}`;
  }

  private async continuation(project: HarnessProject, sessionId: string): Promise<BaseMessage[]> {
    const messages = this.records(project)
      .select()
      .from(tables.messages)
      .where(eq(tables.messages.sessionId, sessionId))
      .orderBy(desc(tables.messages.seq))
      .limit(30)
      .all()
      .reverse()
      .map((row) => row.value);
    return Promise.all(
      messages
        .filter(
          (message) =>
            (message.role === 'user' && message.state === 'consumed') ||
            (message.role === 'assistant' && message.state === 'complete'),
        )
        .map(async (message) =>
          message.role === 'user'
            ? new HumanMessage({
                id: message.id,
                content: await this.instructionContent(project, message),
              })
            : new AIMessage({ id: message.id, content: message.text }),
        ),
    );
  }

  private checkpointToolResults(
    project: HarnessProject,
    runId: string,
    predecessorId: string | undefined,
    value: unknown,
  ): ToolMessage[] {
    if (!Array.isArray(value))
      throw new OperationError('unavailable', 'Checkpoint缺少有效图消息。');
    const messages = value.map(coerceMessageLikeToMessage);
    const finished = new Set(
      messages
        .filter((message) => message instanceof ToolMessage)
        .map((message) => message.tool_call_id),
    );
    const results: ToolMessage[] = [];
    for (const message of messages) {
      if (!(message instanceof AIMessage)) continue;
      for (const call of message.tool_calls ?? []) {
        if (!call.id || finished.has(call.id)) continue;
        const keys = [runId, ...(predecessorId ? [predecessorId] : [])].map(
          (id) => `tool:${id}:${call.id}`,
        );
        const receipt = keys
          .map((key) =>
            this.records(project).select().from(tables.meta).where(eq(tables.meta.key, key)).get(),
          )
          .find((row) => row);
        if (receipt) {
          const record = JSON.parse(receipt.value);
          if (record.result) {
            const saved = mapStoredMessageToChatMessage(record.result);
            if (!(saved instanceof ToolMessage) || saved.tool_call_id !== call.id)
              throw new OperationError('outcomeUnknown', '旧工具结果不符合所属调用。');
            results.push(saved);
            finished.add(call.id);
            continue;
          }
        }
        results.push(
          new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            status: 'error',
            content: JSON.stringify({
              error: {
                code: receipt ? 'outcomeUnknown' : 'shuttingDown',
                message: receipt
                  ? '旧工具已受理但效果尚未确认；先核查所属记录或实际内容，只暂停相关动作，不能自动重放。'
                  : '旧工具尚未受理；先依据最新指令重新决定。',
              },
              ...(receipt ? { receipt: receipt.key } : {}),
            }),
          }),
        );
        finished.add(call.id);
      }
    }
    return results;
  }

  async recordSavedResource(
    projectId: string,
    sessionId: string,
    runId: string,
    path: string,
    fileId: string,
    evidence: { basis?: string; resourceBasis?: string } = {},
    operationId: string = randomUUID(),
  ): Promise<NonNullable<ResourceSaveResult['association']>> {
    const project = this.projects.get(projectId);
    this.session(project, sessionId);
    const run = this.records(project)
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.id, runId))
      .get();
    if (!run || run.sessionId !== sessionId) throw new OperationError('notFound', '执行不存在。');
    const artifact: Artifact = { path, fileId, runId, state: 'linked' };
    const linked = await this.port(project, sessionId)['project.artifacts']({
      projectId,
      sessionId,
    });
    if (linked.some((item) => item.runId === runId && item.fileId === fileId))
      return { operationId, state: 'confirmed' };
    const directory = join(project.internal, 'pending-artifacts');
    const key = `${projectId}:${runId}:${path}`;
    try {
      await atomicPrivateFile(
        directory,
        operationId,
        JSON.stringify({ sessionId, artifact, ...evidence }),
      );
      const pending = {
        projectId,
        sessionId,
        artifact: { ...artifact, state: 'unknown' as const },
        receipt: join(directory, operationId),
        ...evidence,
      };
      this.pendingArtifacts.set(key, pending);
      const file = await this.port(project)['files.readBytes']({
        projectId,
        fileId,
        limit: 1,
        ...evidence,
      });
      if (evidence.resourceBasis) {
        // Preserve verified publication evidence across moves without weakening resource reads.
        await atomicPrivateFile(
          directory,
          operationId,
          JSON.stringify({ sessionId, artifact, basis: file.basis }),
        );
        pending.basis = file.basis;
        delete pending.resourceBasis;
      }
      await this.port(project, sessionId)['project.linkArtifact']({
        projectId,
        sessionId,
        artifact: { ...artifact, path: file.path },
      });
      await unlink(join(directory, operationId));
      this.pendingArtifacts.delete(key);
      this.notify(projectId, sessionId);
      return { operationId, state: 'confirmed' };
    } catch {
      this.notify(projectId, sessionId);
      return { operationId, state: 'unknown' };
    }
  }

  async reconcile(
    projectId: string,
    sessionId: string,
    runId: string,
    paths: string[],
  ): Promise<Artifact[]> {
    const project = this.projects.get(projectId);
    this.session(project, sessionId);
    const run = this.records(project)
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.id, runId))
      .get();
    if (!run || run.sessionId !== sessionId) throw new OperationError('notFound', '执行不存在。');
    const results: Artifact[] = [];
    const requested = paths.slice(0, 100);
    if (requested.some((path) => !this.pendingArtifacts.has(`${projectId}:${runId}:${path}`))) {
      for await (const entry of await opendir(join(project.internal, 'pending-artifacts'))) {
        try {
          const pending = await this.readArtifactReceipt(
            project,
            join(project.internal, 'pending-artifacts', entry.name),
          );
          if (
            pending.sessionId === sessionId &&
            pending.artifact.runId === runId &&
            requested.includes(pending.artifact.path)
          )
            this.pendingArtifacts.set(`${projectId}:${runId}:${pending.artifact.path}`, pending);
        } catch {
          /* Preserve unreadable receipts; they cannot authorize a new association. */
        }
      }
    }
    for (const path of requested) {
      try {
        const pending = this.pendingArtifacts.get(`${projectId}:${runId}:${path}`);
        if (!pending) {
          const linked = (
            await this.port(project, sessionId)['project.artifacts']({ projectId, sessionId })
          ).find((item) => item.runId === runId && item.path === path && item.state === 'linked');
          if (linked) {
            results.push(linked);
            continue;
          }
        }
        if (!pending?.artifact.fileId || (!pending.basis && !pending.resourceBasis))
          throw new OperationError('outcomeUnknown', '原关联回执缺少可核查内容依据。');
        const file = await this.port(project)['files.readBytes']({
          projectId,
          fileId: pending.artifact.fileId,
          ...(pending.resourceBasis ? { resourceBasis: pending.resourceBasis } : {}),
          ...(pending.basis ? { basis: pending.basis } : {}),
          limit: 1,
        });
        const artifact: Artifact = {
          path: file.path,
          fileId: file.fileId,
          runId,
          state: 'linked',
        };
        await this.port(project, sessionId)['project.linkArtifact']({
          projectId: project.id,
          sessionId,
          artifact,
        });
        const key = `${projectId}:${runId}:${path}`;
        await unlink(pending.receipt).catch(() => {});
        this.pendingArtifacts.delete(key);
        results.push(artifact);
      } catch {
        results.push({ path, runId, state: 'unknown' });
      }
    }
    this.notify(projectId, sessionId);
    return results;
  }

  async snapshot(
    projectId?: string,
    sessionId?: string,
    before?: string,
    limit = 50,
    includeSessions = true,
  ): Promise<HarnessSnapshot> {
    const result: HarnessSnapshot = { sessions: [], messages: [], artifacts: [] };
    if (!projectId) return result;
    const project = this.projects.get(projectId);
    if (includeSessions) result.sessions = this.list({ projectId, limit: 100 }).sessions;
    if (!sessionId) return result;
    result.session = this.session(project, sessionId);
    const cursor = before
      ? this.records(project)
          .select()
          .from(tables.messages)
          .where(eq(tables.messages.id, before))
          .get()?.seq
      : undefined;
    const rows = this.records(project)
      .select()
      .from(tables.messages)
      .where(
        and(
          eq(tables.messages.sessionId, sessionId),
          cursor ? lt(tables.messages.seq, cursor) : undefined,
        ),
      )
      .orderBy(desc(tables.messages.seq))
      .limit(limit + 1)
      .all();
    if (rows.length > limit) {
      rows.pop();
      const cursor = rows.at(-1)?.id;
      if (cursor) result.nextBefore = cursor;
    }
    let bytes = 0;
    const bounded = [];
    for (const row of rows) {
      const size = Buffer.byteLength(JSON.stringify(row.value));
      if (bytes + size > 1500000 && bounded.length) {
        result.nextBefore = bounded.at(-1)?.id as string;
        break;
      }
      bytes += size;
      bounded.push(row.value);
    }
    result.messages = bounded.reverse();
    const run = this.latestRun(project, sessionId);
    if (run) result.run = run;
    result.artifacts = await this.port(project, sessionId)['project.artifacts']({
      projectId,
      sessionId,
    });
    for (const pending of this.pendingArtifacts.values()) {
      if (
        pending.projectId === projectId &&
        pending.sessionId === sessionId &&
        !result.artifacts.some(
          (item) => item.path === pending.artifact.path && item.runId === pending.artifact.runId,
        )
      )
        result.artifacts.unshift(pending.artifact);
    }
    result.artifacts = result.artifacts.slice(0, 100);
    result.artifacts = await Promise.all(
      result.artifacts.map(async (artifact) => {
        if (!artifact.fileId) return artifact;
        try {
          const location = (
            await this.port(project)['files.resolve']({
              projectId,
              fileIds: [artifact.fileId],
            })
          )[0];
          return location ? { ...artifact, location } : artifact;
        } catch {
          return artifact;
        }
      }),
    );
    return result;
  }

  async close(): Promise<void> {
    this.stopped = true;
    const active = [...this.active.values()];
    for (const item of active) item.controller.abort(new Error('Kernel stopping'));
    await Promise.allSettled(active.map((item) => item.done));
    for (const records of this.repositories.values()) records.close();
    this.repositories.clear();
  }

  async releaseProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    this.released.add(project);
    const active = [...this.active.entries()]
      .filter(([key]) => key.startsWith(`${projectId}:`))
      .map(([, value]) => value);
    for (const item of active) item.controller.abort(new Error('Project relocated'));
    await Promise.all(active.map((item) => item.done));
    if (this.unconfirmedInstance(project))
      throw new OperationError('outcomeUnknown', '项目执行停止尚未确认，不能替换仓储。');
    project.records.close();
    this.repositories.delete(project.internal);
    this.initialized.delete(project);
    for (const [key, value] of this.pendingArtifacts)
      if (value.projectId === projectId) this.pendingArtifacts.delete(key);
  }
}
