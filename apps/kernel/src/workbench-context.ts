import { randomUUID } from 'node:crypto';
import {
  isWorkbenchContextSnapshot,
  type WorkbenchContextOutputs,
  type WorkbenchContextSnapshot,
  type WorkbenchSource,
} from '@scholoom/protocol';
import { OperationError } from '@scholoom/protocol/core';

/** Ephemeral connection state; callers must authorize resources before returning it to an Agent. */
export class WorkbenchContextStore {
  private readonly connections = new Map<
    string,
    { revision: number; snapshot: WorkbenchContextSnapshot | null }
  >();

  connect(): Readonly<WorkbenchSource> {
    const source = Object.freeze({ connectionId: randomUUID() });
    this.connections.set(source.connectionId, { revision: -1, snapshot: null });
    return source;
  }

  publish(source: Readonly<WorkbenchSource> | undefined, snapshot: unknown): void {
    const connection = source && this.connections.get(source.connectionId);
    if (!connection)
      throw new OperationError('permissionDenied', '上下文发布需要有效的工作台连接。');
    if (snapshot === null) {
      connection.snapshot = null;
      return;
    }
    if (!isWorkbenchContextSnapshot(snapshot))
      throw new OperationError('invalidRequest', '工作台上下文超出容量或不符合契约。');
    if (snapshot.revision <= connection.revision) return;
    connection.snapshot = structuredClone(snapshot);
    connection.revision = snapshot.revision;
  }

  read(
    source: Readonly<WorkbenchSource> | undefined,
    receiver: { projectId: string; sessionId: string },
  ):
    | Omit<
        Extract<WorkbenchContextOutputs['workbench.context.read'], { state: 'available' }>,
        'instructionId'
      >
    | Extract<WorkbenchContextOutputs['workbench.context.read'], { state: 'unavailable' }> {
    if (!source) return { state: 'unavailable', reason: 'noSource' };
    const connection = this.connections.get(source.connectionId);
    if (!connection) return { state: 'unavailable', reason: 'disconnected' };
    const snapshot = connection.snapshot;
    if (!snapshot) return { state: 'unavailable', reason: 'noSnapshot' };
    if (
      snapshot.receiver?.projectId !== receiver.projectId ||
      snapshot.receiver.sessionId !== receiver.sessionId
    )
      return { state: 'unavailable', reason: 'receiverMismatch' };
    return { state: 'available', snapshot: structuredClone(snapshot) };
  }

  disconnect(source: Readonly<WorkbenchSource>): void {
    this.connections.delete(source.connectionId);
  }
}
