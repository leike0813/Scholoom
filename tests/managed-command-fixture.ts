import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CommandWorkspace, ManagedCommands } from '../apps/kernel/dist/commands.js';
import { ProcessAdmission } from '../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../packages/protocol/dist/core.js';

export const program = fileURLToPath(
  new URL('./fixtures/domain-execution-worker/command.mjs', import.meta.url),
);
export const context: CallContext = {
  moduleId: 'editor',
  role: 'product',
  principal: { kind: 'human', id: 'local' },
};
export const request = {
  workspaceId: 'workspace',
  executableId: 'node',
  args: [program, 'echo'],
  input: 'evidence 42',
  timeoutMs: 5000,
};

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-managed-command-'));
  const processes = new ProcessAdmission(1, 2);
  let allowed = true;
  const workspace: CommandWorkspace = {
    ownerModuleId: 'editor',
    directory: root,
    projectId: 'project',
    executables: new Map([['node', process.execPath]]),
  };
  const commands = new ManagedCommands(
    processes,
    (id) => {
      if (id !== 'workspace') throw new OperationError('permissionDenied', 'unknown workspace');
      return workspace;
    },
    () => {
      if (!allowed) throw new OperationError('permissionDenied', 'revoked');
    },
  );
  return {
    root,
    workspace,
    commands,
    processes,
    revoke: () => {
      allowed = false;
    },
  };
}
