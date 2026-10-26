import type { KernelClient } from '@scholoom/client';
import type { ResourceDescriptor } from '@scholoom/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentReader } from './DocumentReader';
import { ImageResourceView } from './ImageResourceView';
import { PdfReader } from './PdfReader';
import { FileEditor } from './project-ui';
import { readerKindForName } from './reader-material';
import {
  createReadingRecordAdapter,
  createResourcePort,
  type ReadingRecordAdapter,
  type ResourceTarget,
} from './resource-controller';
import type { FileTarget } from './session';
import type { FileViewMode } from './tab-state';

/** One format dispatch for every workbench resource entrance. */
export function ResourceView({
  client,
  directory,
  target,
  enabled,
  revision,
  mode,
  onDirty,
  viewId,
  onOpenFile,
  onChanged,
}: {
  client: KernelClient;
  directory: string;
  target: ResourceTarget;
  enabled: boolean;
  revision: number;
  mode: FileViewMode;
  onDirty?: (() => void) | undefined;
  viewId?: string | undefined;
  onOpenFile: (target: FileTarget) => void;
  onChanged: (target: FileTarget) => void;
}) {
  const port = useMemo(() => createResourcePort(client), [client]);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  useEffect(() => () => port.cancelPending(), [port]);
  const readerKind = readerKindForName(target.name);
  const [loaded, setLoaded] = useState<{
    resource: ResourceDescriptor;
    records?: ReadingRecordAdapter;
  }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loaded || !enabled || (!readerKind && target.locator.source !== 'library')) return;
    return port.subscribe(() => setAttempt((value) => value + 1));
  }, [loaded, enabled, readerKind, target.locator.source, port]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 权限通知重试尚未成功打开的资源。
  useEffect(() => {
    if (!enabled || (!readerKind && target.locator.source !== 'library')) return;
    let active = true;
    setLoaded(undefined);
    setError('');
    void (async () => {
      const resource = await port.describe(target.locator);
      const ref = resource.ref;
      const records =
        ref.source === 'library'
          ? createReadingRecordAdapter(
              client,
              await client.call('library.attachment', { attachmentId: ref.attachmentId }),
            )
          : undefined;
      if (active) {
        setLoaded({ resource, ...(records ? { records } : {}) });
        if (
          ref.source === 'project' &&
          target.locator.source === 'project' &&
          !target.locator.fileId
        )
          changed.current({
            projectId: ref.projectId,
            fileId: ref.fileId,
            path: target.locator.path ?? resource.path ?? target.name,
          });
      }
    })().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '资源打开失败。');
    });
    return () => {
      active = false;
    };
  }, [client, port, target, enabled, readerKind, attempt]);
  if (!readerKind)
    return (
      <FileEditor
        client={client}
        directory={directory}
        resourceTarget={target}
        port={port}
        enabled={enabled}
        records={loaded?.records}
        revision={revision}
        mode={mode}
        editorViewId={viewId}
        onDirty={onDirty}
        onOpenFile={onOpenFile}
        onChanged={onChanged}
      />
    );
  if (error) return <p role="alert">{error}</p>;
  if (!loaded) return <p role="status">{enabled ? '正在打开资源…' : '需连接内核。'}</p>;
  return readerKind === 'image' ? (
    <ImageResourceView resource={loaded.resource} port={port} enabled={enabled} viewId={viewId} />
  ) : readerKind === 'pdf' ? (
    <PdfReader
      resource={loaded.resource}
      port={port}
      records={loaded.records}
      enabled={enabled}
      viewId={viewId}
    />
  ) : (
    <DocumentReader
      resource={loaded.resource}
      port={port}
      records={loaded.records}
      enabled={enabled}
      viewId={viewId}
    />
  );
}
