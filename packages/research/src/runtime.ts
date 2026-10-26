import { randomUUID } from 'node:crypto';
import { relative } from 'node:path';
import { failure } from '@scholoom/platform/node';
import { type CallContext, OperationError } from '@scholoom/protocol/core';
import type {
  CapabilityExecution,
  ResearchSessionPort,
  RuntimeIdentity,
} from '@scholoom/protocol/harness';
import type { ResearchProjectPort } from '@scholoom/protocol/projects';
import {
  isResearchRequest,
  type ResearchAttempt,
  type ResearchGraph,
  type ResearchInputs,
  type ResearchModuleInputs,
  type ResearchOutputs,
  type ResearchRequest,
} from '@scholoom/protocol/research';
import { and, desc, sql } from 'drizzle-orm';
import { ResearchContent } from './content.js';
import { type ResearchGraphPorts, ResearchGraphRuntime } from './graph-runtime.js';
import { ResearchGraphs } from './graphs.js';
import type { ResearchRecords } from './records.js';
import { attempts, isMaterialAttempt } from './schema.js';

type FileReference = ResearchAttempt['sources'][number];

export type { CapabilityExecution } from '@scholoom/protocol/harness';
export type ResearchContext = Pick<
  RuntimeIdentity,
  'projectId' | 'sessionId' | 'runId' | 'instanceId'
> & {
  signal: AbortSignal;
  isStopping: () => boolean;
};
export type ResearchPorts = {
  records: (projectId: string) => ResearchRecords;
  files: (context: CallContext) => ResearchProjectPort;
  session: ResearchSessionPort;
  execute: (execution: CapabilityExecution, context: CallContext) => Promise<void>;
  graphs?: ResearchGraphPorts;
};
const now = () => new Date().toISOString();

export class ResearchRuntime {
  readonly content = new ResearchContent();
  readonly graphs: ResearchGraphs;
  readonly graphCalls: ResearchGraphRuntime;
  private active = new Set<string>();
  private initialized = new Set<string>();
  private executing = new Map<
    string,
    {
      projectId: string;
      instanceId: string;
      outputPath: string;
      attempt: ResearchAttempt;
      files: ResearchProjectPort;
    }
  >();

  private readonly repositories = new Map<string, ResearchRecords>();
  constructor(
    private readonly notify: (projectId: string, sessionId: string) => void,
    private readonly ports: ResearchPorts,
    graphs: readonly ResearchGraph[] = [],
  ) {
    this.graphs = new ResearchGraphs(graphs);
    this.graphCalls = new ResearchGraphRuntime(
      this.graphs,
      (projectId) => this.records(projectId),
      ports.session,
      ports.graphs,
      notify,
    );
  }

  private records(projectId: string) {
    let records = this.repositories.get(projectId);
    if (!records) {
      records = this.ports.records(projectId);
      this.repositories.set(projectId, records);
    }
    return records.db;
  }

  close(): void {
    for (const records of this.repositories.values()) records.close();
    this.repositories.clear();
  }

  releaseProject(projectId: string): void {
    this.repositories.get(projectId)?.close();
    this.repositories.delete(projectId);
    this.initialized.delete(projectId);
  }

  private put(projectId: string, attempt: ResearchAttempt): void {
    this.records(projectId)
      .insert(attempts)
      .values({ id: attempt.id, value: attempt })
      .onConflictDoUpdate({ target: attempts.id, set: { value: attempt } })
      .run();
    this.notify(projectId, attempt.sessionId);
  }

  initialize(projectId: string): void {
    if (this.initialized.has(projectId)) return;
    this.initialized.add(projectId);
    const rows = this.records(projectId)
      .select()
      .from(attempts)
      .where(sql`json_extract(${attempts.value}, '$.state') = 'running'`)
      .all();
    for (const row of rows) {
      const attempt = row.value;
      if (!isMaterialAttempt(attempt)) continue;
      this.put(projectId, {
        ...attempt,
        state: 'interrupted',
        delivery: 'incomplete',
        finishedAt: now(),
        issues: [...attempt.issues, 'interrupted: 请核查已保存成果与工具回执后显式继续。'],
      });
    }
  }

  async list(
    input: ResearchInputs['research.attempts'],
  ): Promise<ResearchOutputs['research.attempts']> {
    await this.ports.session({ projectId: input.projectId, sessionId: input.sessionId });
    const offset = input.offset ?? 0;
    const limit = Math.min(input.limit ?? 25, 100);
    const rows = this.records(input.projectId)
      .select()
      .from(attempts)
      .where(
        and(
          sql`json_extract(${attempts.value}, '$.sessionId') = ${input.sessionId}`,
          sql`json_extract(${attempts.value}, '$.kind') IS NULL`,
          input.invocationId
            ? sql`json_extract(${attempts.value}, '$.invocationId') = ${input.invocationId}`
            : undefined,
        ),
      )
      .orderBy(
        desc(sql`json_extract(${attempts.value}, '$.createdAt')`),
        desc(sql`json_extract(${attempts.value}, '$.attempt')`),
        desc(attempts.id),
      )
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      attempts: rows
        .slice(0, limit)
        .map((row) => row.value)
        .filter(isMaterialAttempt),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }

  async invoke(request: ResearchRequest, context: ResearchContext): Promise<ResearchAttempt> {
    if (!isResearchRequest(request))
      throw new OperationError('invalidRequest', '科研能力输入不符合声明。');
    const { projectId, sessionId, signal } = context;
    this.initialize(projectId);
    const scope: CallContext = {
      moduleId: 'research',
      role: 'execution',
      principal: { kind: 'agent', id: sessionId },
      projectId,
      sessionId,
      runId: context.runId,
      instanceId: context.instanceId,
    };
    const files = this.ports.files({ ...scope, signal });
    const invocationId = request.invocationId ?? randomUUID();
    const key = `${projectId}:${invocationId}`;
    if (this.active.has(key)) throw new OperationError('invalidRequest', '同一能力调用正在执行。');
    this.active.add(key);
    try {
      signal.throwIfAborted();
      const { method, content } = await this.content.resolve(request.methodId, request.version);
      for (const access of method.resources) await files['project.check']({ projectId, access });
      const previous = (await this.list({ projectId, sessionId, invocationId, limit: 1 }))
        .attempts[0];
      if (request.invocationId && !previous)
        throw new OperationError('notFound', '原能力调用不属于当前会话。');
      if (
        previous &&
        (previous.method.id !== method.id ||
          previous.method.version !== method.version ||
          previous.input.goal !== request.input.goal ||
          previous.input.outputPath !== request.input.outputPath ||
          JSON.stringify(previous.input.materialPaths) !==
            JSON.stringify(request.input.materialPaths))
      )
        throw new OperationError('invalidRequest', '原能力调用已用于不同目标或输入。');
      const sources: FileReference[] = [];
      for (const [index, path] of request.input.materialPaths.entries()) {
        const priorSource = previous?.sources[index];
        if (previous && !priorSource)
          throw new OperationError('unavailable', '原调用材料记录不完整，请保留记录并核查。');
        const current = priorSource
          ? await this.currentPath(files, projectId, priorSource.fileId)
          : path;
        const file = await files['files.read']({ projectId, path: current });
        if (priorSource && file.fileId !== priorSource.fileId)
          throw new OperationError('contentChanged', '输入材料身份已变化，请重新定位原材料。');
        sources.push({
          path: current,
          fileId:
            file.fileId ?? (await files['project.material']({ projectId, path: current })).fileId,
        });
      }
      const output = await files['project.path']({
        projectId,
        path: previous?.reportFileId
          ? await this.currentPath(files, projectId, previous.reportFileId)
          : request.input.outputPath,
        allowMissing: true,
      });
      const root = await files['project.path']({ projectId, path: '' });
      const outputPath = relative(root, output).replaceAll('\\', '/');
      for (const source of sources)
        if ((await files['project.path']({ projectId, path: source.path })) === output)
          throw new OperationError('invalidRequest', '分析报告必须与输入材料分别保存。');
      signal.throwIfAborted();
      const session = await this.ports.session({ projectId, sessionId });
      if (!session || session.archived)
        throw new OperationError('invalidRequest', '会话不可执行。');
      for (const access of method.resources) await files['project.check']({ projectId, access });
      let attempt: ResearchAttempt = {
        id: randomUUID(),
        invocationId,
        attempt: (previous?.attempt ?? 0) + 1,
        sessionId,
        runId: context.runId,
        method,
        input: request.input,
        state: 'running',
        sources,
        used: [],
        artifacts: [],
        delivery: 'pending',
        issues: [],
        researchAssessment: 'notAssessed',
        createdAt: now(),
        ...(previous?.reportFileId ? { reportFileId: previous.reportFileId } : {}),
      };
      this.put(projectId, attempt);
      const active = {
        projectId,
        instanceId: context.instanceId,
        outputPath,
        attempt,
        files: this.ports.files(scope),
      };
      this.executing.set(attempt.id, active);
      try {
        await this.ports.execute(
          {
            attemptId: attempt.id,
            ...(previous?.reportFileId
              ? { expectedOutput: { path: outputPath, fileId: previous.reportFileId } }
              : {}),
            prompt: `${content}\n\n研究目标：${request.input.goal}\n材料（必须通过工具实际读取）：${JSON.stringify(sources)}\n报告路径：${outputPath}\n调用身份：${invocationId}。已有成果先读取核查再修改；只使用当前授权。`,
          },
          { ...scope, signal },
        );
        signal.throwIfAborted();
        attempt = { ...active.attempt, state: 'completed' };
      } catch (error) {
        const info = failure(error);
        attempt = {
          ...active.attempt,
          state:
            info.code === 'outcomeUnknown'
              ? 'interrupted'
              : signal.aborted
                ? context.isStopping()
                  ? 'interrupted'
                  : 'cancelled'
                : 'failed',
          issues: [...active.attempt.issues, `${info.code}: ${info.message}`],
        };
      }
      const issues = [...attempt.issues];
      for (const source of sources)
        if (!attempt.used.some((item) => item.fileId === source.fileId))
          issues.push(`inputNotRead: ${source.path}`);
      let report = false;
      for (const artifact of attempt.artifacts) {
        try {
          const path = await this.currentPath(active.files, projectId, artifact.fileId);
          const file = await active.files['files.read']({ projectId, path });
          if (file.fileId !== artifact.fileId)
            throw new OperationError('contentChanged', '成果身份已变化，请重新定位原成果。');
          if (artifact.fileId === attempt.reportFileId && file.content.trim() && !file.truncated)
            report = true;
        } catch (error) {
          issues.push(`artifactUnavailable: ${artifact.path} (${failure(error).code})`);
        }
      }
      if (!report) issues.push(`reportMissing: ${request.input.outputPath}`);
      attempt = {
        ...attempt,
        issues,
        delivery: attempt.state === 'completed' && !issues.length ? 'usable' : 'incomplete',
        finishedAt: now(),
      };
      this.put(projectId, attempt);
      this.executing.delete(attempt.id);
      return attempt;
    } finally {
      this.active.delete(key);
      for (const [id, value] of this.executing)
        if (value.projectId === projectId && value.attempt.invocationId === invocationId)
          this.executing.delete(id);
    }
  }
  private async currentPath(
    files: ResearchProjectPort,
    projectId: string,
    fileId: string,
  ): Promise<string> {
    const location = (await files['files.resolve']({ projectId, fileIds: [fileId] }))[0];
    if (location?.state !== 'present')
      throw new OperationError('notFound', '原材料当前位置不可用。');
    return location.path;
  }
  async progress(
    input: ResearchModuleInputs['research.progress'],
    context: CallContext,
  ): Promise<{ ok: true }> {
    const active = this.executing.get(input.attemptId);
    if (
      !active ||
      active.projectId !== context.projectId ||
      active.instanceId !== context.instanceId ||
      active.attempt.sessionId !== context.sessionId ||
      active.attempt.runId !== context.runId
    )
      throw new OperationError('instanceMismatch', '科研进展不属于当前受理尝试。');
    const { event } = input;
    if (event.kind === 'failed')
      active.attempt = { ...active.attempt, issues: [...active.attempt.issues, event.issue] };
    else {
      const field = event.kind === 'read' ? 'used' : 'artifacts';
      const report =
        field === 'artifacts' &&
        !active.attempt.reportFileId &&
        (await this.currentPath(active.files, active.projectId, event.file.fileId)) ===
          active.outputPath;
      active.attempt = {
        ...active.attempt,
        [field]: [
          ...active.attempt[field].filter((file) => file.fileId !== event.file.fileId),
          event.file,
        ],
        ...(report ? { reportFileId: event.file.fileId } : {}),
      };
    }
    this.put(active.projectId, active.attempt);
    return { ok: true };
  }
}
