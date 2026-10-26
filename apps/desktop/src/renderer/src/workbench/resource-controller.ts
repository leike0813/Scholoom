import type { KernelClient } from '@scholoom/client';
import type {
  LibraryAttachment,
  ReadingRecordPort,
  ResourceDocumentOutputs,
  ResourceInputs,
  ResourceLocator,
  ResourcePort,
  ResourceRef,
} from '@scholoom/protocol';
export interface FileTarget {
  projectId: string;
  path: string;
  fileId?: string;
  create?: boolean;
  openMode?: 'preview' | 'permanent';
}

export interface ResourceTarget {
  locator: ResourceLocator;
  name: string;
  openMode?: 'preview' | 'permanent';
  create?: boolean;
}
export type WorkbenchResourcePort = ResourcePort & {
  subscribe(listener: () => void): () => void;
  cancelPending(): void;
};
export interface ReadingRecordAdapter {
  attachment: LibraryAttachment;
  port: ReadingRecordPort;
  directory: string;
  status(): Promise<{ read: boolean; write: boolean }>;
  subscribe(listener: () => void): () => void;
}
export const resourceSourceLabels: Record<ResourceRef['source'], string> = {
  project: '项目材料',
  library: '库材料',
  render: '排版产物',
};

export function sameResourceRef(left: ResourceRef, right: ResourceRef): boolean {
  if (left.source === 'project')
    return (
      right.source === 'project' &&
      left.projectId === right.projectId &&
      left.fileId === right.fileId
    );
  if (left.source === 'library')
    return (
      right.source === 'library' &&
      left.attachmentId === right.attachmentId &&
      left.materialVersionId === right.materialVersionId
    );
  return (
    right.source === 'render' &&
    left.projectId === right.projectId &&
    left.outputId === right.outputId
  );
}

export function resourceKey(target: ResourceTarget): string {
  const ref = target.locator;
  return ref.source === 'project'
    ? `${ref.projectId}:${ref.fileId ?? ref.path}`
    : ref.source === 'render'
      ? `render:${ref.projectId}:${ref.outputId}`
      : `reader:${ref.attachmentId}:${ref.materialVersionId}`;
}
export function projectTarget(target: ResourceTarget): FileTarget | undefined {
  const ref = target.locator;
  if (ref.source !== 'project') return undefined;
  return {
    projectId: ref.projectId,
    path: ref.path ?? target.name,
    ...(ref.fileId ? { fileId: ref.fileId } : {}),
    ...(target.create ? { create: true } : {}),
    ...(target.openMode ? { openMode: target.openMode } : {}),
  };
}
export function fileResource(target: FileTarget): ResourceTarget {
  const { projectId, fileId, path, create, openMode } = target;
  return {
    locator: { source: 'project', projectId, path, ...(fileId ? { fileId } : {}) },
    name: path.split('/').at(-1) ?? path,
    ...(create ? { create } : {}),
    ...(openMode ? { openMode } : {}),
  };
}
export function attachmentResource(attachment: LibraryAttachment): ResourceTarget {
  return {
    locator: {
      source: 'library',
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    },
    name: attachment.name,
  };
}
export function createResourcePort(client: KernelClient): WorkbenchResourcePort {
  const requests = new Set<string>();
  return {
    cancelPending: () => {
      for (const requestId of requests)
        void client.call('resources.cancel', { requestId }).catch(() => undefined);
    },
    describe: (locator) => client.call('resources.describe', { locator }),
    read: (input) => client.call('resources.read', input),
    save: (input) => client.call('resources.save', input),
    document: async ({ ref, basis }, method, input) => {
      const requestId = crypto.randomUUID();
      requests.add(requestId);
      try {
        return (await client.call('resources.document', {
          ref,
          basis,
          requestId,
          request: { method, input },
        } as ResourceInputs['resources.document'])) as ResourceDocumentOutputs[typeof method];
      } finally {
        requests.delete(requestId);
      }
    },
    subscribe: (listener) =>
      client.subscribeChanges((change) => {
        if (change.libraryChanged || change.filePaths || change.projectId || change.resync)
          listener();
      }),
  };
}
export function createReadingRecordAdapter(
  client: KernelClient,
  attachment: LibraryAttachment,
): ReadingRecordAdapter {
  return {
    attachment,
    directory: client.getSnapshot().status?.dataDirectory ?? '',
    port: {
      'library.readingRecords': (input) => client.call('library.readingRecords', input),
      'library.readingRecord': (input) => client.call('library.readingRecord', input),
      'library.readingHistory': (input) => client.call('library.readingHistory', input),
      'library.saveReadingRecord': (input) => client.call('library.saveReadingRecord', input),
      'library.removeReadingRecord': (input) => client.call('library.removeReadingRecord', input),
    },
    status: () => client.call('library.status', {}),
    subscribe: (listener) =>
      client.subscribeChanges((change) => {
        if (change.libraryChanged) listener();
      }),
  };
}
