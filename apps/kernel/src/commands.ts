import { type ProcessAdmission, runCommand } from '@scholoom/platform/node';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type PlatformCommandInput,
  type PlatformCommandResult,
  platformCommandOperations,
} from '@scholoom/protocol/platform';

export type CommandWorkspace = {
  ownerModuleId: string;
  directory: string;
  projectId?: string;
  executables: ReadonlyMap<string, string>;
};
const contract = compileContract(platformCommandOperations['platform.command']);

/** Workspace resolution and authorization remain host-owned, including after capacity waits. */
export class ManagedCommands {
  constructor(
    private readonly processes: ProcessAdmission,
    private readonly resolve: (workspaceId: string) => CommandWorkspace,
    private readonly authorize: (workspace: CommandWorkspace, context: CallContext) => void,
  ) {}

  async execute(input: PlatformCommandInput, context: CallContext): Promise<PlatformCommandResult> {
    if (!contract.params(input)) throw new OperationError('invalidRequest', '命令输入不符合契约。');
    const check = () => {
      context.signal?.throwIfAborted();
      const workspace = this.resolve(input.workspaceId);
      const executable = workspace.executables.get(input.executableId);
      if (workspace.ownerModuleId !== context.moduleId || !executable)
        throw new OperationError('permissionDenied', '命令不属于当前消费模块或程序未登记。');
      const agent =
        context.principal.kind === 'agent' ||
        context.role === 'execution' ||
        context.role === 'compute' ||
        context.workDomain !== undefined;
      if (
        context.targetRead ||
        (agent &&
          (context.principal.kind !== 'agent' ||
            context.principal.id !== context.sessionId ||
            context.workDomain?.kind !== 'project' ||
            context.workDomain.projectId !== workspace.projectId ||
            context.projectId !== workspace.projectId ||
            context.workDomain.sessionId !== context.sessionId ||
            !context.runId ||
            !context.instanceId))
      )
        throw new OperationError('permissionDenied', '当前工作域不允许启动此命令。');
      this.authorize(workspace, context);
      return { directory: workspace.directory, projectId: workspace.projectId, executable };
    };
    const initial = check();
    const reservation = this.processes.reserve(true);
    const abort = () => reservation.release();
    context.signal?.addEventListener('abort', abort, { once: true });
    if (context.signal?.aborted) abort();
    try {
      await reservation.ready;
      const current = check();
      if (
        current.directory !== initial.directory ||
        current.projectId !== initial.projectId ||
        current.executable !== initial.executable
      )
        throw new OperationError('permissionDenied', '等待期间命令工作空间已变化。');
      return await runCommand(
        {
          executable: current.executable,
          args: input.args,
          cwd: current.directory,
          timeoutMs: input.timeoutMs,
          ...(input.input !== undefined ? { input: input.input } : {}),
        },
        { signal: context.signal, reservation },
      );
    } finally {
      context.signal?.removeEventListener('abort', abort);
      reservation.release();
    }
  }
}
