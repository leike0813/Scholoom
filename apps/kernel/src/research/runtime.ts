import { randomUUID } from 'node:crypto';
import { relative } from 'node:path';
import {
  type BusinessParams,
  type BusinessResult,
  isResearchRequest,
  type ResearchAttempt,
  type ResearchRequest,
} from '@scholoom/protocol';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { failure, OperationError } from '../errors.js';
import type { ProjectStore } from '../projects/store.js';
import * as tables from '../storage/schema.js';
import { ResearchContent } from './content.js';

type FileReference = ResearchAttempt['sources'][number];
export type CapabilityExecution = {
  attemptId: string;
  expectedOutput?: { path: string; fileId: string };
  prompt: string;
  read: (path: string, fileId: string) => void;
  saved: (path: string, fileId: string) => void;
  failed: (issue: string) => void;
};
type Context = {
  project: ProjectStore;
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  isStopping: () => boolean;
  execute: (execution: CapabilityExecution) => Promise<void>;
};
const prefix = 'research-attempt:';
const now = () => new Date().toISOString();

export class ResearchRuntime {
  readonly content = new ResearchContent();
  private active = new Set<string>();

  constructor(private readonly notify: (projectId: string, sessionId: string) => void) {}

  private put(project: ProjectStore, attempt: ResearchAttempt): void {
    project.db
      .insert(tables.meta)
      .values({ key: `${prefix}${attempt.id}`, value: JSON.stringify(attempt) })
      .onConflictDoUpdate({ target: tables.meta.key, set: { value: JSON.stringify(attempt) } })
      .run();
    project.touch();
    this.notify(project.project.id, attempt.sessionId);
  }

  initialize(project: ProjectStore): void {
    const rows = project.db
      .select()
      .from(tables.meta)
      .where(
        and(
          like(tables.meta.key, `${prefix}%`),
          sql`json_extract(${tables.meta.value}, '$.state') = 'running'`,
        ),
      )
      .all();
    for (const row of rows) {
      const attempt = JSON.parse(row.value) as ResearchAttempt;
      this.put(project, {
        ...attempt,
        state: 'interrupted',
        delivery: 'incomplete',
        finishedAt: now(),
        issues: [...attempt.issues, 'interrupted: 请核查已保存成果与工具回执后显式继续。'],
      });
    }
  }

  list(
    project: ProjectStore,
    input: Omit<BusinessParams<'research.attempts'>, 'projectId'>,
  ): BusinessResult<'research.attempts'> {
    if (
      !project.db
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.id, input.sessionId))
        .get()
    )
      throw new OperationError('notFound', '会话不存在。');
    const offset = input.offset ?? 0;
    const limit = Math.min(input.limit ?? 25, 100);
    const rows = project.db
      .select()
      .from(tables.meta)
      .where(
        and(
          like(tables.meta.key, `${prefix}%`),
          sql`json_extract(${tables.meta.value}, '$.sessionId') = ${input.sessionId}`,
          input.invocationId
            ? sql`json_extract(${tables.meta.value}, '$.invocationId') = ${input.invocationId}`
            : undefined,
        ),
      )
      .orderBy(
        desc(sql`json_extract(${tables.meta.value}, '$.createdAt')`),
        desc(sql`json_extract(${tables.meta.value}, '$.attempt')`),
        desc(tables.meta.key),
      )
      .limit(limit + 1)
      .offset(offset)
      .all();
    return {
      attempts: rows.slice(0, limit).map((row) => JSON.parse(row.value) as ResearchAttempt),
      ...(rows.length > limit ? { nextOffset: offset + limit } : {}),
    };
  }

  async invoke(request: ResearchRequest, context: Context): Promise<ResearchAttempt> {
    if (!isResearchRequest(request))
      throw new OperationError('invalidRequest', '科研能力输入不符合声明。');
    const { project, sessionId, signal } = context;
    const invocationId = request.invocationId ?? randomUUID();
    const key = `${project.project.id}:${invocationId}`;
    if (this.active.has(key)) throw new OperationError('invalidRequest', '同一能力调用正在执行。');
    this.active.add(key);
    try {
      signal.throwIfAborted();
      const { method, content } = await this.content.resolve(request.methodId, request.version);
      for (const resource of method.resources) project.check(resource);
      const previous = this.list(project, { sessionId, invocationId, limit: 1 }).attempts[0];
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
        const current = priorSource ? project.files.currentPath(priorSource.fileId) : path;
        const file = await project.read(current);
        if (priorSource && file.fileId !== priorSource.fileId)
          throw new OperationError('contentChanged', '输入材料身份已变化，请重新定位原材料。');
        sources.push({
          path: current,
          fileId: file.fileId ?? (await project.files.reference(current)).fileId,
        });
      }
      const output = await project.path(
        previous?.reportFileId
          ? project.files.currentPath(previous.reportFileId)
          : request.input.outputPath,
        true,
      );
      const outputPath = relative(project.project.path, output).replaceAll('\\', '/');
      for (const source of sources)
        if ((await project.path(source.path)) === output)
          throw new OperationError('invalidRequest', '分析报告必须与输入材料分别保存。');
      signal.throwIfAborted();
      const session = project.db
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.id, sessionId))
        .get()?.value;
      if (!session || session.archived)
        throw new OperationError('invalidRequest', '会话不可执行。');
      for (const resource of method.resources) project.check(resource);
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
      this.put(project, attempt);
      const remember = (field: 'used' | 'artifacts', path: string, fileId: string) => {
        const items = attempt[field].filter((item) => item.fileId !== fileId);
        attempt = { ...attempt, [field]: [...items, { path, fileId }] };
        if (
          !attempt.reportFileId &&
          field === 'artifacts' &&
          project.files.currentPath(fileId) === outputPath
        )
          attempt = { ...attempt, reportFileId: fileId };
        this.put(project, attempt);
      };
      try {
        await context.execute({
          attemptId: attempt.id,
          ...(previous?.reportFileId
            ? { expectedOutput: { path: outputPath, fileId: previous.reportFileId } }
            : {}),
          prompt: `${content}\n\n研究目标：${request.input.goal}\n材料（必须通过工具实际读取）：${JSON.stringify(sources)}\n报告路径：${outputPath}\n调用身份：${invocationId}。已有成果先读取核查再修改；只使用当前授权。`,
          read: (path, fileId) => remember('used', path, fileId),
          saved: (path, fileId) => remember('artifacts', path, fileId),
          failed: (issue) => {
            attempt = { ...attempt, issues: [...attempt.issues, issue] };
            this.put(project, attempt);
          },
        });
        signal.throwIfAborted();
        attempt = { ...attempt, state: 'completed' };
      } catch (error) {
        const info = failure(error);
        attempt = {
          ...attempt,
          state: signal.aborted ? (context.isStopping() ? 'interrupted' : 'cancelled') : 'failed',
          issues: [...attempt.issues, `${info.code}: ${info.message}`],
        };
      }
      const issues = [...attempt.issues];
      for (const source of sources)
        if (!attempt.used.some((item) => item.fileId === source.fileId))
          issues.push(`inputNotRead: ${source.path}`);
      let report = false;
      for (const artifact of attempt.artifacts) {
        try {
          const path = project.files.currentPath(artifact.fileId);
          const file = await project.read(path);
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
      this.put(project, attempt);
      return attempt;
    } finally {
      this.active.delete(key);
    }
  }
}
