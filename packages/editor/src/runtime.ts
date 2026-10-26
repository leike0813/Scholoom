import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFingerprint } from '@scholoom/platform/node';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import type {
  EditorCommandInput,
  EditorCommandResult,
  EditorInputs,
  EditorOutputs,
  RenderJob,
  RenderOutput,
} from '@scholoom/protocol/editor';
import type {
  FileContent,
  ProjectMaterial,
  ProjectsInputs,
  ProjectsOutputs,
} from '@scholoom/protocol/projects';
import {
  type ResourceDescriptor,
  type ResourceInputs,
  type ResourceLocator,
  type ResourceOutputs,
  renderInputSchema,
} from '@scholoom/protocol/resources';
import { convertDocument } from './conversion.js';
import { EditorRecords, outputSize, outputStorageSize, readOutput, snapshot } from './resources.js';

export type EditorPorts = {
  check(projectId: string, access: 'read' | 'write'): Promise<void>;
  read(projectId: string, path: string): Promise<FileContent>;
  material(projectId: string, path: string): Promise<ProjectMaterial>;
  locate(projectId: string, fileId: string): Promise<string>;
  command(input: EditorCommandInput): Promise<EditorCommandResult>;
  importBegin(
    input: ProjectsInputs['files.importBegin'],
  ): Promise<ProjectsOutputs['files.importBegin']>;
  importChunk(
    input: ProjectsInputs['files.importChunk'],
  ): Promise<ProjectsOutputs['files.importChunk']>;
  importFinish(
    input: ProjectsInputs['files.importFinish'],
  ): Promise<ProjectsOutputs['files.importFinish']>;
};
type Active = {
  controller: AbortController;
  done: Promise<void>;
  finish: () => void;
  job: RenderJob;
  context: CallContext;
  queueKey?: string;
  publishing?: boolean;
};
type SavedOutput = RenderOutput & {
  projectId: string;
  directory: string;
  path: string;
  storageBytes: number;
};
const stamp = () => new Date().toISOString();
const part = (value: string) => `item-${encodeURIComponent(value)}`;
const validRenderInput = compileContract({ params: renderInputSchema, result: true }).params;

/** Manuscript operations own their receipts and outputs; project text stays project-owned. */
export class EditorRuntime {
  private readonly records = new EditorRecords();
  private readonly active = new Map<string, Active>();
  private readonly queues = new Map<string, { running?: Active; waiting?: Active }>();
  private readonly requests = new Map<string, Promise<RenderJob>>();
  private readonly workspaces = new Map<
    string,
    { directory: string; projectId?: string; uncertain?: boolean }
  >();
  private closing = false;
  private readonly shutdown = new AbortController();
  private readonly transients = new Set<Promise<unknown>>();
  private readonly publishing = new Map<string, Promise<void>>();
  private readonly leases = new Map<string, { readers: number; until: number }>();
  private readonly evicting = new Set<string>();
  constructor(
    private readonly directory: string,
    private readonly ports: (context: CallContext, signal?: AbortSignal) => EditorPorts,
  ) {}
  private root(projectId: string) {
    return join(this.directory, part(projectId));
  }
  private recordPath(projectId: string, id: string) {
    return join(this.root(projectId), 'jobs', `${part(id)}.json`);
  }
  private outputPath(projectId: string, id: string) {
    return join(this.root(projectId), 'outputs', `${part(id)}.json`);
  }
  private latestPath(projectId: string, fileId: string, format: string) {
    return join(this.root(projectId), 'latest', `${part(fileId)}-${format}.json`);
  }
  private async publish<T>(projectId: string, action: () => Promise<T>): Promise<T> {
    const prior = this.publishing.get(projectId) ?? Promise.resolve();
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.publishing.set(projectId, pending);
    await prior;
    try {
      return await action();
    } finally {
      release();
      if (this.publishing.get(projectId) === pending) this.publishing.delete(projectId);
    }
  }
  private lease(id: string) {
    if (this.evicting.has(id))
      throw new OperationError('notFound', '历史排版产物已清理，请重新编译。');
    const lease = this.leases.get(id) ?? { readers: 0, until: 0 };
    lease.readers++;
    this.leases.set(id, lease);
    return () => {
      lease.readers--;
      lease.until = Date.now() + 300000;
    };
  }
  private async prune(projectId: string, incoming: number, replacing?: string, strict = true) {
    const records = async <T>(folder: string): Promise<T[]> => {
      const directory = join(this.root(projectId), folder);
      let names: string[];
      try {
        names = await readdir(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
      return (
        await Promise.all(
          names
            .filter((name) => name.endsWith('.json'))
            .map((name) => this.records.read<T>(join(directory, name))),
        )
      ).filter((value) => value !== undefined) as T[];
    };
    for (const [id, lease] of this.leases)
      if (!lease.readers && lease.until < Date.now()) this.leases.delete(id);
    const latest = new Set((await records<RenderOutput>('latest')).map((output) => output.id));
    const outputs = (await records<SavedOutput>('outputs')).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    // A receipt is written before moving its directory, so interrupted moves remain accounted for.
    const known = new Set(outputs.map((output) => output.id));
    const data = join(this.root(projectId), 'data');
    for (const entry of await readdir(data, { withFileTypes: true })) {
      if (entry.isDirectory() && !known.has(entry.name) && !latest.has(entry.name))
        await rm(join(data, entry.name), { recursive: true, force: true });
    }
    const replaced = outputs.find((output) => output.id === replacing);
    const addedBytes = incoming - (replaced?.storageBytes ?? replaced?.byteLength ?? 0);
    const addedCount = incoming ? (replaced ? 0 : 1) : 0;
    let bytes = outputs.reduce(
      (sum, output) => sum + (output.storageBytes ?? output.byteLength),
      0,
    );
    let count = outputs.length;
    for (const output of outputs) {
      if (
        bytes + addedBytes <= 268435456 &&
        count + addedCount <= 64 &&
        bytes + incoming <= 402653184 &&
        count + (incoming ? 1 : 0) <= 65
      )
        return;
      if (latest.has(output.id) || this.leases.has(output.id)) continue;
      this.evicting.add(output.id);
      try {
        await rm(join(this.root(projectId), 'data', output.id), { recursive: true, force: true });
        await rm(this.outputPath(projectId, output.id), { force: true });
      } finally {
        this.evicting.delete(output.id);
      }
      bytes -= output.storageBytes ?? output.byteLength;
      count--;
    }
    if (
      strict &&
      (bytes + addedBytes > 268435456 ||
        count + addedCount > 64 ||
        bytes + incoming > 402653184 ||
        count + (incoming ? 1 : 0) > 65)
    )
      throw new OperationError(
        'resourceLimit',
        '排版缓存已达到256MiB或64份；正在查看及最后成功产物已保留。',
      );
  }
  private async workspace(projectId?: string) {
    const id = randomUUID();
    const directory = join(this.directory, 'work', id);
    await this.records.prepare(directory);
    await this.records.write(join(directory, 'owner.json'), {
      id,
      projectId,
      state: 'allocated',
      createdAt: stamp(),
    });
    this.workspaces.set(id, { directory, ...(projectId ? { projectId } : {}) });
    return { id, directory };
  }
  commandWorkspace(id: string) {
    const value = this.workspaces.get(id);
    if (!value) throw new OperationError('permissionDenied', '编译资源未绑定或已经释放。');
    return value;
  }
  private async run(
    port: EditorPorts,
    workspaceId: string,
    tool: 'quarto' | 'latexmk',
    args: string[],
    input?: string,
    timeoutMs = 30000,
  ) {
    try {
      const result = await port.command({
        workspaceId,
        tool,
        args,
        timeoutMs,
        ...(input !== undefined ? { input } : {}),
      });
      if (result.code !== 0)
        throw new OperationError('unavailable', result.stderr.trim() || `工具退出：${result.code}`);
      return result;
    } catch (error) {
      if (error instanceof OperationError && error.code === 'outcomeUnknown') {
        const workspace = this.workspaces.get(workspaceId);
        if (workspace) workspace.uncertain = true;
      }
      throw error;
    }
  }
  private async release(workspace: { id: string; directory: string }) {
    const owner = this.workspaces.get(workspace.id);
    const uncertain = owner?.uncertain;
    if (uncertain)
      await this.records.write(join(workspace.directory, 'owner.json'), {
        id: workspace.id,
        projectId: owner.projectId,
        state: 'unknown',
        updatedAt: stamp(),
      });
    this.workspaces.delete(workspace.id);
    if (!uncertain) await rm(workspace.directory, { recursive: true, force: true });
    this.records.forget(workspace.directory);
  }
  private async transient<T>(
    context: CallContext,
    action: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.closing) throw new OperationError('shuttingDown', '编辑器正在关闭。');
    const signal = AbortSignal.any([
      this.shutdown.signal,
      ...(context.signal ? [context.signal] : []),
    ]);
    const pending = action(signal);
    this.transients.add(pending);
    try {
      return await pending;
    } finally {
      this.transients.delete(pending);
    }
  }
  tools(context: CallContext): Promise<EditorOutputs['editor.tools']> {
    return this.transient(context, async (signal) => {
      const workspace = await this.workspace();
      const port = this.ports(context, signal);
      const query = async (tool: 'quarto' | 'latexmk', args: string[]) => {
        try {
          return {
            available: true,
            version: (await this.run(port, workspace.id, tool, args)).stdout.trim(),
          };
        } catch (error) {
          if (error instanceof OperationError && error.code === 'outcomeUnknown') throw error;
          return {
            available: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      };
      try {
        const quarto = await query('quarto', ['--version']);
        const pandoc = await query('quarto', ['pandoc', '--version']);
        const latexmk = await query('latexmk', ['-v']);
        return { quarto, pandoc, latexmk };
      } finally {
        await this.release(workspace);
      }
    });
  }
  async convert(
    input: EditorInputs['editor.convert'],
    context: CallContext,
  ): Promise<EditorOutputs['editor.convert']> {
    return this.transient(context, async (signal) => {
      const port = this.ports(context, signal);
      await port.check(input.projectId, 'read');
      const workspace = await this.workspace(input.projectId);
      try {
        const result = await convertDocument(input, {
          resources: fileURLToPath(new URL('./resources/', import.meta.url)),
          run: async (args, content) =>
            (await this.run(port, workspace.id, 'quarto', ['pandoc', ...args], content)).stdout,
          read: async (path) => {
            const value = await port.read(input.projectId, path);
            if (value.truncated) throw new OperationError('tooLarge', '转换资源超过文本范围。');
            return value.content;
          },
        });
        await port.check(input.projectId, 'read');
        return result;
      } finally {
        await this.release(workspace);
      }
    });
  }
  async render(input: EditorInputs['editor.render'], context: CallContext): Promise<RenderJob> {
    const key = `${input.projectId}:${input.operationId}`;
    const current = this.requests.get(key);
    if (current) {
      const job = await current;
      if (
        job.format !== input.format ||
        (input.fileId ? job.fileId !== input.fileId : job.path !== input.path)
      )
        throw new OperationError('invalidRequest', '相同操作身份对应不同排版请求。');
      return structuredClone(job);
    }
    const pending = this.acceptRender(input, context);
    this.requests.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.requests.get(key) === pending) this.requests.delete(key);
    }
  }
  private async acceptRender(
    input: EditorInputs['editor.render'],
    context: CallContext,
  ): Promise<RenderJob> {
    if (this.closing) throw new OperationError('shuttingDown', '排版正在关闭。');
    const port = this.ports(context);
    await port.check(input.projectId, 'read');
    const previous = await this.records.read<RenderJob>(
      this.recordPath(input.projectId, input.operationId),
    );
    if (previous) {
      if (
        previous.format !== input.format ||
        (input.fileId ? previous.fileId !== input.fileId : previous.path !== input.path)
      )
        throw new OperationError('invalidRequest', '相同操作身份对应不同排版请求。');
      return this.job({ projectId: input.projectId, jobId: input.operationId }, context);
    }
    if (this.active.size >= 32) throw new OperationError('resourceLimit', '排版任务积压已满。');
    const path = input.fileId ? await port.locate(input.projectId, input.fileId) : input.path;
    if (!/\.(md|markdown|qmd|tex)$/i.test(path) || (/\.tex$/i.test(path) && input.format !== 'pdf'))
      throw new OperationError('invalidRequest', '此稿件不支持所选排版格式。');
    const material = await port.material(input.projectId, path);
    const job: RenderJob = {
      id: input.operationId,
      projectId: input.projectId,
      path,
      fileId: material.fileId,
      format: input.format,
      state: 'queued',
      basis: material.basis,
      createdAt: stamp(),
      updatedAt: stamp(),
      dependencies: [],
      diagnostics: [],
      log: '',
    };
    const latest = await this.records.read<RenderOutput>(
      this.latestPath(input.projectId, material.fileId, input.format),
    );
    if (latest) job.lastSuccess = latest;
    await this.records.write(this.recordPath(job.projectId, job.id), job);
    const controller = new AbortController();
    let finish = () => {};
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const active: Active = { controller, done, finish, job, context };
    this.active.set(`${job.projectId}:${job.id}`, active);
    if (input.automatic) {
      const key = `${job.projectId}:${job.fileId}:${job.format}`;
      active.queueKey = key;
      const queue = this.queues.get(key) ?? {};
      this.queues.set(key, queue);
      const cancelled = queue.waiting ? this.cancelWaiting(queue.waiting) : undefined;
      if (queue.running) queue.waiting = active;
      else {
        queue.running = active;
        this.launch(active);
      }
      await cancelled;
    } else this.launch(active);
    return structuredClone(job);
  }
  private launch(active: Active) {
    void this.execute(active.job, active.context, active.controller)
      .catch((error: unknown) => {
        console.error(
          'editor receipt unavailable',
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        this.active.delete(`${active.job.projectId}:${active.job.id}`);
        active.finish();
        if (active.queueKey) {
          const queue = this.queues.get(active.queueKey);
          if (queue?.running === active) {
            delete queue.running;
            const next = queue.waiting;
            delete queue.waiting;
            if (next) {
              queue.running = next;
              this.launch(next);
            } else this.queues.delete(active.queueKey);
          }
        }
      });
  }
  private async cancelWaiting(active: Active) {
    active.controller.abort();
    active.job.state = 'cancelled';
    active.job.updatedAt = stamp();
    const queue = active.queueKey ? this.queues.get(active.queueKey) : undefined;
    if (queue?.waiting === active) delete queue.waiting;
    this.active.delete(`${active.job.projectId}:${active.job.id}`);
    try {
      await this.records.write(this.recordPath(active.job.projectId, active.job.id), active.job);
    } finally {
      active.finish();
    }
  }
  private async execute(job: RenderJob, context: CallContext, controller: AbortController) {
    let workspace: Awaited<ReturnType<EditorRuntime['workspace']>> | undefined;
    const port = this.ports(context, controller.signal);
    const persist = async () => {
      job.updatedAt = stamp();
      await this.records.write(this.recordPath(job.projectId, job.id), job);
    };
    try {
      workspace = await this.workspace(job.projectId);
      await this.records.write(join(workspace.directory, 'owner.json'), {
        id: workspace.id,
        projectId: job.projectId,
        jobId: job.id,
        state: 'running',
        createdAt: stamp(),
      });
      if (job.fileId) job.path = await port.locate(job.projectId, job.fileId);
      const latest = await this.records.read<RenderOutput>(
        this.latestPath(job.projectId, job.fileId ?? job.path, job.format),
      );
      if (latest) job.lastSuccess = latest;
      const inputs = join(workspace.directory, 'input');
      await mkdir(inputs, { recursive: true });
      const result = await snapshot(
        job.path,
        inputs,
        (path) => port.material(job.projectId, path),
        job.format,
      );
      if (result.fileId !== job.fileId)
        throw new OperationError('contentChanged', '稿件身份已经变化。');
      job.basis = result.basis;
      job.dependencies = result.dependencies;
      job.diagnostics = result.diagnostics;
      this.workspaces.set(workspace.id, { directory: inputs, projectId: job.projectId });
      controller.signal.throwIfAborted();
      job.state = 'running';
      await persist();
      const latex = /\.tex$/i.test(job.path);
      const args = latex
        ? [
            '-norc',
            '-pdf',
            '-interaction=nonstopmode',
            '-halt-on-error',
            '-outdir=output',
            '-pdflatex=pdflatex -no-shell-escape -disable-installer %O %S',
            job.path,
          ]
        : ['render', job.path, '--to', job.format, '--no-execute', '--output-dir', 'output'];
      const command = await this.run(
        port,
        workspace.id,
        latex ? 'latexmk' : 'quarto',
        args,
        undefined,
        180000,
      );
      job.log = `${command.stdout}\n${command.stderr}`.slice(-65536);
      controller.signal.throwIfAborted();
      await port.check(job.projectId, 'read');
      for (const dependency of job.dependencies) {
        if ((await port.material(job.projectId, dependency.path)).basis !== dependency.basis)
          throw new OperationError('contentChanged', '排版期间输入已变化，请更新预览。');
      }
      const outputRoot = join(inputs, 'output');
      const name = `${basename(job.path).replace(/\.[^.]+$/, '')}.${job.format}`;
      // Quarto keeps the document-relative directory under output-dir.
      const relative = latex ? name : posix.join(posix.dirname(job.path), name);
      const full = join(outputRoot, relative);
      const byteLength = await outputSize(full);
      if (!byteLength || byteLength > 67108864)
        throw new OperationError('tooLarge', '排版产物为空或超过64MiB。');
      const outputId = randomUUID();
      const storageBytes = await outputStorageSize(outputRoot);
      const published = join(this.root(job.projectId), 'data', outputId);
      await this.records.prepare(dirname(published));
      await this.publish(job.projectId, async () => {
        const previous = await this.records.read<RenderOutput>(
          this.latestPath(job.projectId, job.fileId ?? job.path, job.format),
        );
        await this.prune(job.projectId, storageBytes, previous?.id);
        await port.check(job.projectId, 'read');
        controller.signal.throwIfAborted();
        const active = this.active.get(`${job.projectId}:${job.id}`);
        if (active) active.publishing = true;
        const output: SavedOutput = {
          id: outputId,
          jobId: job.id,
          projectId: job.projectId,
          name,
          format: job.format,
          byteLength,
          createdAt: stamp(),
          directory: published,
          path: relative,
          storageBytes,
        };
        await this.records.write(this.outputPath(job.projectId, output.id), output);
        await rename(outputRoot, published);
        const publishedOutput: SavedOutput = {
          ...output,
          basis: fileFingerprint(await stat(join(published, relative), { bigint: true })),
          input: {
            ref: { source: 'project', projectId: job.projectId, fileId: result.fileId },
            basis: result.basis,
            dependencies: result.dependencies.map((dependency) => ({ ...dependency })),
          },
        };
        await this.records.write(this.outputPath(job.projectId, output.id), publishedOutput);
        const {
          projectId: _project,
          directory: _directory,
          path: _path,
          storageBytes: _bytes,
          ...publicOutput
        } = publishedOutput;
        await this.records.write(
          this.latestPath(job.projectId, job.fileId ?? job.path, job.format),
          publicOutput,
        );
        job.output = publicOutput;
        job.lastSuccess = publicOutput;
        job.state = 'completed';
        try {
          await this.prune(job.projectId, 0, undefined, false);
        } catch (error) {
          job.diagnostics.push({
            code: 'cacheCleanup',
            message: error instanceof Error ? error.message : '历史产物清理未完成。',
          });
        }
      });
    } catch (error) {
      job.state =
        error instanceof OperationError && error.code === 'outcomeUnknown'
          ? 'unknown'
          : controller.signal.aborted
            ? 'cancelled'
            : 'failed';
      const message = error instanceof Error ? error.message : String(error);
      job.log = `${job.log}\n${message}`.slice(-65536);
      job.diagnostics.push({
        code: error instanceof OperationError ? error.code : 'unavailable',
        message,
      });
    } finally {
      if (workspace) {
        if (job.state === 'unknown')
          await this.records.write(join(workspace.directory, 'owner.json'), {
            id: workspace.id,
            projectId: job.projectId,
            jobId: job.id,
            state: 'unknown',
            updatedAt: stamp(),
          });
        this.workspaces.delete(workspace.id);
        if (job.state !== 'unknown')
          await rm(workspace.directory, { recursive: true, force: true });
        this.records.forget(workspace.directory);
      }
      await persist();
    }
  }
  async job(input: EditorInputs['editor.job'], context: CallContext): Promise<RenderJob> {
    await this.ports(context).check(input.projectId, 'read');
    let job = await this.records.read<RenderJob>(this.recordPath(input.projectId, input.jobId));
    if (!job || job.projectId !== input.projectId)
      throw new OperationError('notFound', '排版任务不存在。');
    if (
      ['queued', 'running', 'cancelling'].includes(job.state) &&
      !this.active.has(`${job.projectId}:${job.id}`)
    ) {
      // Completion can publish while the first read is in flight, then release its active entry.
      job =
        (await this.records.read<RenderJob>(this.recordPath(input.projectId, input.jobId))) ?? job;
      if (['queued', 'running', 'cancelling'].includes(job.state)) {
        job.state = 'interrupted';
        job.updatedAt = stamp();
        await this.records.write(this.recordPath(job.projectId, job.id), job);
      }
    }
    if (
      this.active.get(`${job.projectId}:${job.id}`)?.controller.signal.aborted &&
      !['completed', 'failed', 'cancelled', 'unknown'].includes(job.state)
    )
      job.state = 'cancelling';
    return job;
  }
  async cancel(input: EditorInputs['editor.cancel'], context: CallContext): Promise<RenderJob> {
    const job = await this.job(input, context);
    const active = this.active.get(`${input.projectId}:${input.jobId}`);
    if (active) {
      if (active.publishing) {
        await active.done;
        return this.job(input, context);
      }
      if (active.queueKey && this.queues.get(active.queueKey)?.waiting === active) {
        await this.cancelWaiting(active);
        return active.job;
      }
      active.controller.abort(new OperationError('shuttingDown', '用户取消排版。'));
      job.state = 'cancelling';
    }
    return job;
  }
  private async saved(projectId: string, id: string, context: CallContext) {
    await this.ports(context).check(projectId, 'read');
    const output = await this.records.read<SavedOutput>(this.outputPath(projectId, id));
    if (!output || output.projectId !== projectId || output.id !== id)
      throw new OperationError('notFound', '排版产物不存在。');
    return output;
  }
  private async savedRender(projectId: string, outputId: string, context: CallContext) {
    const output = await this.saved(projectId, outputId, context);
    if (output.format !== 'pdf')
      throw new OperationError('invalidRequest', '只支持 PDF 排版产物资源。');
    if (
      !output.basis ||
      !output.input ||
      !validRenderInput(output.input) ||
      output.input.ref.projectId !== projectId
    )
      throw new OperationError('unavailable', '排版产物缺少可核对的输入或字节依据。');
    return { ...output, basis: output.basis, input: output.input };
  }
  async resource(
    locator: Extract<ResourceLocator, { source: 'render' }>,
    context: CallContext,
  ): Promise<ResourceDescriptor> {
    const release = this.lease(locator.outputId);
    try {
      const output = await this.savedRender(locator.projectId, locator.outputId, context);
      await readOutput(output.directory, output.path, 0, 1, output.basis);
      await this.ports(context).check(locator.projectId, 'read');
      return {
        ref: locator,
        basis: output.basis,
        name: output.name,
        format: 'pdf',
        render: { jobId: output.jobId, input: output.input },
        capabilities: { read: true, write: false, readingRecords: false, render: false },
      };
    } finally {
      release();
    }
  }
  async readResource(
    input: ResourceInputs['resources.read'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.read']> {
    const { ref, basis, encoding, offset = 0, limit = 262144 } = input;
    if (ref.source !== 'render' || encoding !== 'base64')
      throw new OperationError('invalidRequest', '排版产物仅支持 render 资源的字节读取。');
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 262144
    )
      throw new OperationError('invalidRequest', '排版产物分片范围无效。');
    const release = this.lease(ref.outputId);
    try {
      const output = await this.savedRender(ref.projectId, ref.outputId, context);
      if (basis !== output.basis)
        throw new OperationError('contentChanged', '排版产物读取依据不匹配。');
      const value = await readOutput(output.directory, output.path, offset, limit, basis);
      await this.ports(context).check(ref.projectId, 'read');
      return {
        ref,
        basis,
        data: value.base64,
        offset,
        size: value.byteLength,
        unit: 'byte',
        truncated: false,
        ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
      };
    } finally {
      release();
    }
  }
  async output(
    input: EditorInputs['editor.output'],
    context: CallContext,
  ): Promise<EditorOutputs['editor.output']> {
    const release = this.lease(input.outputId);
    try {
      const output = await this.saved(input.projectId, input.outputId, context);
      const path = input.resource
        ? posix.join(posix.dirname(output.path), input.resource)
        : output.path;
      const value = await readOutput(
        output.directory,
        path,
        input.offset,
        input.limit ?? 262144,
        input.resource ? undefined : output.basis,
      );
      await this.ports(context).check(input.projectId, 'read');
      return { ...value, name: input.resource ? posix.basename(path) : output.name };
    } finally {
      release();
    }
  }
  async export(
    input: EditorInputs['editor.export'],
    context: CallContext,
  ): Promise<EditorOutputs['editor.export']> {
    const release = this.lease(input.outputId);
    try {
      const output = await this.saved(input.projectId, input.outputId, context);
      const port = this.ports(context);
      await port.check(input.projectId, 'write');
      const name = posix.basename(input.path);
      const transfer = await port.importBegin({
        projectId: input.projectId,
        operationId: input.operationId,
        destination: posix.dirname(input.path) === '.' ? '' : posix.dirname(input.path),
        entries: [{ path: name, kind: 'file', size: output.byteLength }],
      });
      if (transfer.state !== 'uploading') return { transferId: transfer.id };
      for (let offset = 0; offset < output.byteLength; ) {
        const chunk = await readOutput(output.directory, output.path, offset, 262144, output.basis);
        await port.importChunk({
          projectId: input.projectId,
          operationId: transfer.id,
          path: name,
          offset,
          base64: chunk.base64,
        });
        offset = chunk.nextOffset ?? output.byteLength;
      }
      await port.importFinish({ projectId: input.projectId, operationId: transfer.id });
      return { transferId: transfer.id };
    } finally {
      release();
    }
  }
  async close() {
    this.closing = true;
    this.shutdown.abort(new OperationError('shuttingDown', '内核正在关闭。'));
    await Promise.allSettled([...this.requests.values()]);
    for (const queue of this.queues.values())
      if (queue.waiting) await this.cancelWaiting(queue.waiting);
    for (const active of this.active.values())
      if (!active.publishing)
        active.controller.abort(new OperationError('shuttingDown', '内核正在关闭。'));
    await Promise.allSettled(
      [...this.active.values()]
        .map((active) => active.done)
        .concat([...this.transients].map((pending) => pending.then(() => {}))),
    );
  }
}
