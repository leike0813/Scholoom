import {
  type CommandEvent,
  failure,
  ManagedNode,
  type ProcessAdmission,
  runCommand,
} from '@scholoom/platform/node';
import type { ErrorInfo } from '@scholoom/protocol/core';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type PlatformCommandInput,
  type PlatformCommandResult,
  type PlatformProgramInputs,
  platformCommandOperations,
  platformProgramOperations,
} from '@scholoom/protocol/platform';

export type CommandWorkspace = {
  ownerModuleId: string;
  directory: string;
  projectId?: string;
  executables: ReadonlyMap<string, string>;
  env?: Readonly<Record<string, string>>;
  beforeLaunch?: () => Promise<void>;
  authorizationContext?: () => CallContext;
  launchInput?: (commandInstanceId: string) => Promise<string>;
};
const contract = compileContract(platformCommandOperations['platform.command']);

/** Workspace resolution and authorization remain host-owned, including after capacity waits. */
export class ManagedCommands {
  private readonly active = new Map<
    string,
    { workspaceId: string; context: CallContext; controller: AbortController; done: Promise<void> }
  >();
  constructor(
    private readonly processes: ProcessAdmission,
    private readonly resolve: (workspaceId: string) => CommandWorkspace,
    private readonly authorize: (workspace: CommandWorkspace, context: CallContext) => void,
  ) {}

  private prepare(
    input: Pick<PlatformCommandInput, 'workspaceId' | 'executableId'>,
    context: CallContext,
  ) {
    const check = () => {
      context.signal?.throwIfAborted();
      const workspace = this.resolve(input.workspaceId);
      const authority = workspace.authorizationContext?.() ?? context;
      authority.signal?.throwIfAborted();
      const executable = workspace.executables.get(input.executableId);
      if (workspace.ownerModuleId !== context.moduleId || !executable)
        throw new OperationError('permissionDenied', '命令不属于当前消费模块或程序未登记。');
      const agent =
        authority.principal.kind === 'agent' ||
        authority.role === 'execution' ||
        authority.role === 'compute' ||
        authority.workDomain !== undefined;
      if (
        authority.targetRead ||
        (agent &&
          (authority.principal.kind !== 'agent' ||
            authority.principal.id !== authority.sessionId ||
            authority.workDomain?.kind !== 'project' ||
            authority.workDomain.projectId !== workspace.projectId ||
            authority.projectId !== workspace.projectId ||
            authority.workDomain.sessionId !== authority.sessionId ||
            !authority.runId ||
            !authority.instanceId))
      )
        throw new OperationError('permissionDenied', '当前工作域不允许启动此命令。');
      this.authorize(workspace, authority);
      return {
        directory: workspace.directory,
        projectId: workspace.projectId,
        executable,
        env: workspace.env,
        beforeLaunch: workspace.beforeLaunch,
        launchInput: workspace.launchInput,
      };
    };
    const initial = check();
    ManagedNode.requireAvailable();
    const confirm = () => {
      const current = check();
      if (
        current.directory !== initial.directory ||
        current.projectId !== initial.projectId ||
        current.executable !== initial.executable ||
        current.launchInput !== initial.launchInput
      )
        throw new OperationError('permissionDenied', '命令工作空间已变化。');
      return current;
    };
    return confirm;
  }

  async start(
    input: PlatformProgramInputs['platform.programStart'],
    context: CallContext,
    observe: (
      event: CommandEvent | { kind: 'intent' } | { kind: 'unknown'; error: ErrorInfo },
      commandInstanceId: string,
    ) => Promise<void>,
    onFailure?: (error: unknown, commandInstanceId: string) => void,
  ): Promise<{ commandInstanceId: string }> {
    if (!compileContract(platformProgramOperations['platform.programStart']).params(input))
      throw new OperationError('invalidRequest', '程序输入不符合契约。');
    const controller = new AbortController();
    const signal = context.signal
      ? AbortSignal.any([context.signal, controller.signal])
      : controller.signal;
    const caller = { ...context, signal };
    const confirm = this.prepare(input, caller);
    const commandInstanceId = crypto.randomUUID();
    const reservation = this.processes.reserve(
      context.principal.kind !== 'agent',
      commandInstanceId,
    );
    let attempted = false;
    let observationRejected = false;
    const notify = async (event: Parameters<typeof observe>[0]) => {
      try {
        await observe(event, commandInstanceId);
      } catch (error) {
        // Keep this command's lease before release can pass it to a queued command.
        if (attempted && !observationRejected) reservation.retainUntil(new Promise<void>(() => {}));
        observationRejected = true;
        throw error;
      }
    };
    const done = Promise.resolve().then(async () => {
      const abort = () => {
        if (!attempted) reservation.release();
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try {
        await notify({ kind: 'intent' });
        await reservation.ready;
        const current = confirm();
        attempted = true;
        await runCommand(
          {
            executable: current.executable,
            args: input.args,
            cwd: current.directory,
            timeoutMs: input.timeoutMs,
            program: true,
          },
          {
            signal,
            reservation,
            authorize: async () => {
              const value = confirm();
              await value.beforeLaunch?.();
              confirm();
            },
            instanceId: commandInstanceId,
            ...(current.env ? { env: current.env } : {}),
            observe: notify,
            ...(current.launchInput
              ? { launchInput: current.launchInput.bind(undefined, commandInstanceId) }
              : {}),
          },
        );
      } catch (error) {
        if (!attempted) await notify({ kind: 'stopped' });
        await notify({ kind: 'unknown', error: failure(error) });
      } finally {
        signal.removeEventListener('abort', abort);
        reservation.release();
        this.active.delete(commandInstanceId);
      }
    });
    void done.catch((error) => onFailure?.(error, commandInstanceId));
    this.active.set(commandInstanceId, {
      workspaceId: input.workspaceId,
      context,
      controller,
      done,
    });
    return { commandInstanceId };
  }

  cancel(
    input: PlatformProgramInputs['platform.programCancel'],
    context: CallContext,
  ): { ok: true } {
    const active = this.active.get(input.commandInstanceId);
    if (!active) return { ok: true };
    if (active.workspaceId !== input.workspaceId || active.context.moduleId !== context.moduleId)
      throw new OperationError('permissionDenied', '不能停止其他程序。');
    active.controller.abort(new OperationError('shuttingDown', '程序已请求取消。'));
    return { ok: true };
  }

  async close(): Promise<void> {
    const active = [...this.active.values()];
    for (const item of active)
      item.controller.abort(new OperationError('shuttingDown', '宿主正在停止。'));
    await Promise.all(active.map((item) => item.done));
  }

  async execute(input: PlatformCommandInput, context: CallContext): Promise<PlatformCommandResult> {
    if (!contract.params(input)) throw new OperationError('invalidRequest', '命令输入不符合契约。');
    const confirm = this.prepare(input, context);
    const reservation = this.processes.reserve(true);
    const abort = () => reservation.release();
    context.signal?.addEventListener('abort', abort, { once: true });
    if (context.signal?.aborted) abort();
    try {
      await reservation.ready;
      const current = confirm();
      return await runCommand(
        {
          executable: current.executable,
          args: input.args,
          cwd: current.directory,
          timeoutMs: input.timeoutMs,
          ...(input.input !== undefined ? { input: input.input } : {}),
        },
        { signal: context.signal, reservation, authorize: confirm },
      );
    } finally {
      context.signal?.removeEventListener('abort', abort);
      reservation.release();
    }
  }
}
