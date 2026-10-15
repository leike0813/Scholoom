import { randomUUID } from 'node:crypto';
import { readdir, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AIMessage,
  type BaseMessage,
  coerceMessageLikeToMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import type {
  Artifact,
  BusinessParams,
  Message,
  Run,
  Session,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import Database from 'better-sqlite3';
import {
  CompositeBackend,
  createDeepAgent,
  FilesystemBackend,
  registerHarnessProfile,
} from 'deepagents';
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { createMiddleware } from 'langchain';
import { z } from 'zod';
import { OperationError } from '../errors.js';
import { type ModelAccess, modelFailure } from '../models/minimax.js';
import type { ProjectStore, Projects } from '../projects/store.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';
import * as tables from '../storage/schema.js';
import { ProjectBackend } from './files.js';

registerHarnessProfile('anthropic', {
  generalPurposeSubagent: { enabled: false },
  excludedTools: ['task', 'execute', 'delete'],
  excludedMiddleware: ['AnthropicPromptCachingMiddleware', 'CacheBreakpointMiddleware'],
});

type Active = { controller: AbortController; done: Promise<void> };
type Notify = (projectId?: string, sessionId?: string) => void;
const activeKey = (project: ProjectStore, sessionId: string) =>
  `${project.project.id}:${sessionId}`;
const now = () => new Date().toISOString();
const visibleText = (message: BaseMessage): string =>
  typeof message.content === 'string'
    ? message.content
    : message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? String(block.text) : ''))
        .join('');

export class Harness {
  private active = new Map<string, Active>();
  private stopped = false;
  private pendingArtifacts = new Map<
    string,
    { projectId: string; sessionId: string; artifact: Artifact; receipt: string }
  >();
  constructor(
    private readonly projects: Projects,
    private readonly model: ModelAccess,
    private readonly notify: Notify,
  ) {}

  async initialize(): Promise<void> {
    for (const project of this.projects.all()) {
      const directory = join(project.internal, 'pending-artifacts');
      await privateDirectory(directory);
      for (const entry of (await readdir(directory)).slice(0, 100)) {
        const receipt = join(directory, entry);
        try {
          const item = JSON.parse(await readFile(receipt, 'utf8')) as {
            sessionId: string;
            artifact: Artifact;
          };
          await project.path(item.artifact.path);
          this.pendingArtifacts.set(
            `${project.project.id}:${item.artifact.runId}:${item.artifact.path}`,
            {
              projectId: project.project.id,
              sessionId: item.sessionId,
              artifact: { ...item.artifact, state: 'unknown' },
              receipt,
            },
          );
        } catch {
          /* Preserve unreadable receipts for diagnosis. */
        }
      }
      for (const row of project.db.select().from(tables.runs).all()) {
        if (['queued', 'running', 'cancelling'].includes(row.value.state))
          this.setRun(project, { ...row.value, state: 'interrupted', remoteOutcome: 'unknown' });
      }
    }
  }

  create(projectId: string, title = '新会话'): Session {
    const project = this.projects.get(projectId);
    const value: Session = {
      id: randomUUID(),
      projectId,
      title: title || '新会话',
      updatedAt: now(),
      state: 'completed',
    };
    project.db.insert(tables.sessions).values({ id: value.id, value }).run();
    project.touch();
    this.notify(projectId);
    return value;
  }

  private session(project: ProjectStore, id: string): Session {
    const row = project.db.select().from(tables.sessions).where(eq(tables.sessions.id, id)).get();
    if (!row) throw new OperationError('notFound', '会话不存在。');
    return row.value;
  }

  private latestRun(project: ProjectStore, sessionId: string): Run | undefined {
    return project.db
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.sessionId, sessionId))
      .orderBy(desc(sql`json_extract(${tables.runs.value}, '$.attempt')`))
      .limit(1)
      .get()?.value;
  }

  private setRun(project: ProjectStore, value: Run): void {
    project.db
      .insert(tables.runs)
      .values({ id: value.id, sessionId: value.sessionId, value })
      .onConflictDoUpdate({ target: tables.runs.id, set: { value } })
      .run();
    const session = this.session(project, value.sessionId);
    project.db
      .update(tables.sessions)
      .set({ value: { ...session, state: value.state, updatedAt: now() } })
      .where(eq(tables.sessions.id, session.id))
      .run();
    project.touch();
    this.notify(project.project.id, value.sessionId);
  }

  private putMessage(project: ProjectStore, value: Message): void {
    project.db
      .insert(tables.messages)
      .values({ id: value.id, sessionId: value.sessionId, value })
      .onConflictDoUpdate({ target: tables.messages.id, set: { value } })
      .run();
    project.touch();
    this.notify(project.project.id, value.sessionId);
  }

  async send(
    input: BusinessParams<'session.send'>,
  ): Promise<{ instructionId: string; runId: string }> {
    if (this.stopped) throw new OperationError('shuttingDown', '内核正在停止。');
    const project = this.projects.get(input.projectId);
    const session = this.session(project, input.sessionId);
    const previous = project.db
      .select()
      .from(tables.instructions)
      .where(eq(tables.instructions.id, input.instructionId))
      .get();
    if (previous) {
      const original = project.db
        .select()
        .from(tables.messages)
        .where(eq(tables.messages.id, input.instructionId))
        .get();
      if (
        previous.sessionId !== input.sessionId ||
        original?.value.text !== input.text ||
        JSON.stringify(original.value.materials) !== JSON.stringify(input.materials)
      )
        throw new OperationError('invalidRequest', '指令身份已用于其他内容。');
      return { instructionId: previous.id, runId: previous.runId };
    }
    project.check('send');
    if (!(await this.model.credentials.status()).configured)
      throw new OperationError('credentialUnavailable', '请先配置 MiniMax API Key。');
    for (const path of input.materials) {
      project.check('read');
      await project.path(path);
    }
    let run = this.latestRun(project, input.sessionId);
    const busy = this.active.has(activeKey(project, input.sessionId));
    if (!busy)
      run = {
        id: randomUUID(),
        sessionId: session.id,
        attempt: (run?.attempt ?? 0) + 1,
        state: 'queued',
      };
    const accepted = run as Run;
    project.db.transaction((tx) => {
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
            state: 'accepted',
            createdAt: now(),
          },
        })
        .run();
    });
    this.setRun(project, accepted);
    if (!busy) this.schedule(project, accepted);
    return { instructionId: input.instructionId, runId: accepted.id };
  }

  cancel(projectId: string, sessionId: string): void {
    const project = this.projects.get(projectId);
    this.session(project, sessionId);
    const run = this.latestRun(project, sessionId);
    const active = this.active.get(activeKey(project, sessionId));
    if (run && active) {
      this.setRun(project, { ...run, state: 'cancelling', remoteOutcome: 'unknown' });
      active.controller.abort(new Error('User cancelled'));
    } else if (run && run.state === 'queued') this.setRun(project, { ...run, state: 'cancelled' });
  }

  resume(projectId: string, sessionId: string): void {
    const project = this.projects.get(projectId);
    project.check('send');
    if (this.stopped) throw new OperationError('shuttingDown', '内核正在停止。');
    if (this.active.has(activeKey(project, sessionId))) return;
    const prior = this.latestRun(project, sessionId);
    if (!prior) throw new OperationError('notFound', '尚无可接续执行。');
    const { error: _error, ...continuing } = prior;
    this.schedule(project, { ...continuing, state: 'queued' }, true);
  }

  private schedule(project: ProjectStore, run: Run, resume = false): void {
    const controller = new AbortController();
    const done = Promise.resolve()
      .then(() => this.execute(project, run, controller.signal, resume))
      .catch(() => {})
      .finally(() => {
        this.active.delete(activeKey(project, run.sessionId));
        const actual = this.latestRun(project, run.sessionId);
        const pending = project.db
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
        if (!this.stopped && actual?.state === 'completed' && pending)
          this.schedule(project, {
            id: randomUUID(),
            sessionId: run.sessionId,
            attempt: actual.attempt + 1,
            state: 'queued',
          });
      });
    this.active.set(activeKey(project, run.sessionId), { controller, done });
    this.setRun(project, { ...run, state: 'queued' });
  }

  private async execute(
    project: ProjectStore,
    initial: Run,
    signal: AbortSignal,
    resume: boolean,
  ): Promise<void> {
    let run = initial;
    let checkpointDb: Database.Database | undefined;
    const buffers = new Map<string, string>();
    const persistedAt = new Map<string, number>();
    try {
      signal.throwIfAborted();
      project.check('send');
      if (resume) {
        const key = `delivered:${run.sessionId}`;
        const delivered = Number(
          project.db.select().from(tables.meta).where(eq(tables.meta.key, key)).get()?.value ?? 0,
        );
        project.db
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
      const model = await this.model.create(() => project.check('send'), signal);
      await privateDirectory(join(project.internal, 'scratch'));
      const used = new Set<string>();
      const pendingDirectory = join(project.internal, 'pending-artifacts');
      await privateDirectory(pendingDirectory);
      for (const entry of (await readdir(pendingDirectory)).slice(0, 100)) {
        const filename = join(pendingDirectory, entry);
        const pending = JSON.parse(await readFile(filename, 'utf8')) as {
          sessionId: string;
          artifact: Artifact;
        };
        if (pending.sessionId !== run.sessionId) continue;
        const result = await this.reconcile(
          project.project.id,
          pending.sessionId,
          pending.artifact.runId,
          [pending.artifact.path],
        );
        if (result[0]?.state === 'linked')
          await unlink(filename).catch((error) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          });
      }
      const saved = async (path: string) => {
        const artifact: Artifact = { path, runId: run.id, state: 'linked' };
        const pendingId = randomUUID();
        await atomicPrivateFile(
          pendingDirectory,
          pendingId,
          JSON.stringify({ sessionId: run.sessionId, artifact }),
        );
        const pendingKey = `${project.project.id}:${run.id}:${path}`;
        this.pendingArtifacts.set(pendingKey, {
          projectId: project.project.id,
          sessionId: run.sessionId,
          artifact: { ...artifact, state: 'unknown' },
          receipt: join(pendingDirectory, pendingId),
        });
        try {
          project.db
            .insert(tables.artifacts)
            .values({ key: `${run.id}:${path}`, sessionId: run.sessionId, value: artifact })
            .onConflictDoNothing()
            .run();
        } catch {
          throw new OperationError('outcomeUnknown', `文件 ${path} 已保存，产物登记待核查。`);
        }
        await unlink(join(pendingDirectory, pendingId));
        this.pendingArtifacts.delete(pendingKey);
        this.notify(project.project.id, run.sessionId);
      };
      const backend = new CompositeBackend(
        new ProjectBackend(project, signal, (path) => used.add(path), saved),
        {
          '/conversation_history/': new FilesystemBackend({
            rootDir: join(project.internal, 'scratch'),
            virtualMode: true,
          }),
          '/large_tool_results/': new FilesystemBackend({
            rootDir: join(project.internal, 'scratch'),
            virtualMode: true,
          }),
        },
      );
      const isolated =
        project.db
          .select()
          .from(tables.meta)
          .where(eq(tables.meta.key, `checkpoint-isolated:${run.id}`))
          .get()?.value === '1';
      const checkpointPath = join(
        project.internal,
        isolated ? `checkpoints-${encodeURIComponent(run.id)}.sqlite` : 'checkpoints.sqlite',
      );
      checkpointDb = new Database(checkpointPath);
      try {
        if (checkpointDb.pragma('quick_check', { simple: true }) !== 'ok')
          throw Object.assign(new Error('Corrupt checkpoint'), { code: 'SQLITE_CORRUPT' });
      } catch (error) {
        checkpointDb.close();
        checkpointDb = undefined;
        if (!['SQLITE_NOTADB', 'SQLITE_CORRUPT'].includes((error as { code: string }).code))
          throw error;
        const archived = `${checkpointPath}.unusable-${randomUUID()}`;
        await rename(checkpointPath, archived);
        for (const suffix of ['-wal', '-shm'])
          await rename(`${checkpointPath}${suffix}`, `${archived}${suffix}`).catch((error) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          });
        checkpointDb = new Database(checkpointPath);
      }
      let saver = new SqliteSaver(checkpointDb);
      const instructionMiddleware = createMiddleware({
        name: 'ScholoomInstructions',
        beforeModel: (state) => {
          signal.throwIfAborted();
          project.check('send');
          const present = new Set(state.messages.map((message) => message.id));
          const pending = project.db
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
          for (const item of pending) {
            const message = project.db
              .select()
              .from(tables.messages)
              .where(eq(tables.messages.id, item.id))
              .get()?.value;
            if (!message) continue;
            if (!present.has(item.id))
              incoming.push(
                new HumanMessage({
                  id: item.id,
                  content: `${message.text}${message.materials.length ? `\n附加材料引用（先读取再使用）：${message.materials.join(', ')}` : ''}`,
                }),
              );
            project.db
              .update(tables.instructions)
              .set({ consumed: true })
              .where(eq(tables.instructions.id, item.id))
              .run();
            this.putMessage(project, { ...message, state: 'consumed' });
          }
          return incoming.length ? { messages: incoming } : undefined;
        },
        wrapModelCall: async (request, handler) => {
          this.setRun(project, { ...run, state: 'running' });
          const result = await handler(request);
          return result;
        },
        wrapToolCall: async (request, handler) => {
          signal.throwIfAborted();
          project.check('send');
          const callId = request.toolCall.id;
          const key = `tool:${run.id}:${callId}`;
          const previous = project.db
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
            const result = coerceMessageLikeToMessage(record.result);
            if (!(result instanceof ToolMessage))
              throw new OperationError('outcomeUnknown', '旧工具结果不可恢复。');
            return result;
          }
          project.db
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
          const result = await handler(request);
          if (result instanceof ToolMessage) {
            project.db
              .update(tables.meta)
              .set({ value: JSON.stringify({ result: result.toDict() }) })
              .where(eq(tables.meta.key, key))
              .run();
          } else project.db.delete(tables.meta).where(eq(tables.meta.key, key)).run();
          return result;
        },
      });
      const buildAgent = () =>
        createDeepAgent({
          model,
          backend,
          checkpointer: saver,
          middleware: [instructionMiddleware],
          systemPrompt:
            '你是 Scholoom 科研助手。使用中文与用户工作。项目正文以实际文件为准，附加材料只是引用，先读取。形成可承接的分析、理由、成果及下一步时保存为普通 Markdown 文件；在没有项目文件权限时只对话。仅使用授权工具。修改已有文件先读取，遇到冲突重读再修改。write_file 仅用于新建，edit_file 修改已有内容。不得声称未保存成果已交付。不要依赖旧 transcript 才能续做，可发现并读取项目已有成果。用户取消后不继续。',
          tools: [
            {
              name: 'read_instructions',
              description: '分页读取本会话全部持久用户指令与消费状态。续做时按需核对历史要求。',
              schema: z.object({ after: z.number().int().min(0).default(0) }),
              func: async ({ after }: { after: number }) => {
                const rows = project.db
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
                  rows.map((row) => ({
                    sequence: row.seq,
                    consumed: row.consumed,
                    message: project.db
                      .select()
                      .from(tables.messages)
                      .where(eq(tables.messages.id, row.id))
                      .get()?.value,
                  })),
                );
              },
            },
          ],
        });
      let agent = buildAgent();
      let config = {
        configurable: { thread_id: run.id },
        signal,
        recursionLimit: 1000,
        callbacks: [],
      };
      let input: { messages: BaseMessage[] } | null = { messages: [] };
      if (resume) {
        try {
          const checkpoint = await saver.getTuple(config);
          if (checkpoint) {
            const state = (await agent.getState(config)) as { next: readonly string[] };
            input = state.next.length
              ? null
              : {
                  messages: [
                    new HumanMessage(
                      '用户要求接续。先核对当前材料及已保存结果，再推进未完成工作。',
                    ),
                  ],
                };
          } else throw new Error('Missing checkpoint');
        } catch {
          run = {
            id: randomUUID(),
            sessionId: run.sessionId,
            attempt: run.attempt + 1,
            state: 'queued',
          };
          checkpointDb.close();
          checkpointDb = new Database(join(project.internal, `checkpoints-${run.id}.sqlite`));
          saver = new SqliteSaver(checkpointDb);
          project.db
            .insert(tables.meta)
            .values({ key: `checkpoint-isolated:${run.id}`, value: '1' })
            .run();
          agent = buildAgent();
          config = { ...config, configurable: { thread_id: run.id } };
          this.setRun(project, run);
          input = { messages: this.continuation(project, run.sessionId) };
        }
      } else {
        input = { messages: this.continuation(project, run.sessionId) };
      }
      for await (const event of agent.streamEvents(input, { ...config, version: 'v2' })) {
        signal.throwIfAborted();
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data.chunk;
          const id = `${run.id}:model:${event.run_id}`;
          const text = visibleText(chunk);
          if (text) {
            const value = ((buffers.get(id) ?? '') + text).slice(-262144);
            buffers.set(id, value);
            if (Date.now() - (persistedAt.get(id) ?? 0) >= 50) {
              this.putMessage(project, {
                id,
                sessionId: run.sessionId,
                role: 'assistant',
                text: value,
                state: 'streaming',
                materials: [...used],
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
              role: 'assistant',
              text: (text || buffers.get(id) || '').slice(-262144),
              state: 'complete',
              materials: [...used],
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
        if (event.event === 'on_tool_start' || event.event === 'on_tool_end') {
          const id = `${run.id}:tool:${event.run_id}`;
          this.putMessage(project, {
            id,
            sessionId: run.sessionId,
            role: 'tool',
            text: `${event.name}：${event.event === 'on_tool_start' ? '执行中' : '已返回'}`,
            state: event.event === 'on_tool_start' ? 'streaming' : 'complete',
            materials: [...used],
            createdAt: now(),
          });
        }
      }
      const delivered = project.db
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
        project.db
          .insert(tables.meta)
          .values({ key, value: String(delivered.seq) })
          .onConflictDoUpdate({ target: tables.meta.key, set: { value: String(delivered.seq) } })
          .run();
      }
      this.setRun(project, { ...run, state: 'completed', remoteOutcome: 'completed' });
    } catch (error) {
      for (const [id, text] of buffers) {
        const prior = project.db
          .select()
          .from(tables.messages)
          .where(eq(tables.messages.id, id))
          .get()?.value;
        if (prior?.state !== 'complete')
          this.putMessage(project, {
            id,
            sessionId: run.sessionId,
            role: 'assistant',
            text,
            state: 'error',
            materials: prior?.materials ?? [],
            createdAt: prior?.createdAt ?? now(),
          });
      }
      this.setRun(project, {
        ...run,
        state: signal.aborted ? (this.stopped ? 'interrupted' : 'cancelled') : 'failed',
        error: signal.aborted
          ? '本地执行已停止，已保存效果保留；远端停止状态未知。'
          : modelFailure(error),
        remoteOutcome: 'unknown',
      });
    } finally {
      checkpointDb?.close();
    }
  }

  private continuation(project: ProjectStore, sessionId: string): BaseMessage[] {
    const messages = project.db
      .select()
      .from(tables.messages)
      .where(eq(tables.messages.sessionId, sessionId))
      .orderBy(desc(tables.messages.seq))
      .limit(30)
      .all()
      .reverse()
      .map((row) => row.value);
    return messages
      .filter(
        (message) =>
          (message.role === 'user' && message.state === 'consumed') ||
          (message.role === 'assistant' && message.state === 'complete'),
      )
      .map((message) =>
        message.role === 'user'
          ? new HumanMessage({
              id: message.id,
              content: `${message.text}${message.materials.length ? `\n附加材料引用（先读取再使用）：${message.materials.join(', ')}` : ''}`,
            })
          : new AIMessage({ id: message.id, content: message.text }),
      );
  }

  async reconcile(
    projectId: string,
    sessionId: string,
    runId: string,
    paths: string[],
  ): Promise<Artifact[]> {
    const project = this.projects.get(projectId);
    this.session(project, sessionId);
    const run = project.db.select().from(tables.runs).where(eq(tables.runs.id, runId)).get();
    if (!run || run.sessionId !== sessionId) throw new OperationError('notFound', '执行不存在。');
    const results: Artifact[] = [];
    for (const path of paths.slice(0, 100)) {
      try {
        await project.read(path);
        const artifact: Artifact = { path, runId, state: 'linked' };
        project.db
          .insert(tables.artifacts)
          .values({ key: `${runId}:${path}`, sessionId, value: artifact })
          .onConflictDoNothing()
          .run();
        const key = `${projectId}:${runId}:${path}`;
        const pending = this.pendingArtifacts.get(key);
        if (pending) await unlink(pending.receipt).catch(() => {});
        this.pendingArtifacts.delete(key);
        results.push(artifact);
      } catch {
        results.push({ path, runId, state: 'unknown' });
      }
    }
    this.notify(projectId, sessionId);
    return results;
  }

  snapshot(
    projectId?: string,
    sessionId?: string,
    before?: string,
    limit = 50,
  ): Pick<WorkbenchSnapshot, 'sessions' | 'messages' | 'artifacts' | 'run' | 'nextBefore'> {
    const result: Pick<
      WorkbenchSnapshot,
      'sessions' | 'messages' | 'artifacts' | 'run' | 'nextBefore'
    > = { sessions: [], messages: [], artifacts: [] };
    if (!projectId) return result;
    const project = this.projects.get(projectId);
    result.sessions = project.db
      .select()
      .from(tables.sessions)
      .limit(100)
      .all()
      .map((row) => row.value)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!sessionId) return result;
    this.session(project, sessionId);
    const cursor = before
      ? project.db.select().from(tables.messages).where(eq(tables.messages.id, before)).get()?.seq
      : undefined;
    const rows = project.db
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
    result.artifacts = project.db
      .select()
      .from(tables.artifacts)
      .where(eq(tables.artifacts.sessionId, sessionId))
      .limit(100)
      .all()
      .map((row) => row.value);
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
    return result;
  }

  async close(): Promise<void> {
    this.stopped = true;
    const active = [...this.active.values()];
    for (const item of active) item.controller.abort(new Error('Kernel stopping'));
    await Promise.allSettled(active.map((item) => item.done));
  }
}
