import type { KernelClient } from '@scholoom/client';
import type { TaskPort } from '@scholoom/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KernelPhase, WorkbenchSession } from '../session';
import { useFileWatch } from '../useFileWatch';

export function useTasks(
  client: KernelClient | null,
  phase: KernelPhase,
  projectId: string,
  fileRevision = 0,
) {
  const [revision, setRevision] = useState(0);
  const [catalogRevision, setCatalogRevision] = useState(0);
  useEffect(
    () =>
      client?.subscribeChanges((change) => {
        if (change.libraryChanged) setCatalogRevision((value) => value + 1);
      }),
    [client],
  );
  const [scope, setScope] = useState({ projectId: '', exists: false });
  const currentProject = useRef(projectId);
  currentProject.current = projectId;
  const port = useMemo<TaskPort | undefined>(() => {
    if (!client || phase !== 'connected' || projectId === 'application') return undefined;
    return {
      list: async (input) => {
        const result = await client.call('tasks.list', input);
        if (input.projectId === currentProject.current)
          setScope((current) =>
            current.projectId === input.projectId && current.exists === !!result.version
              ? current
              : { projectId: input.projectId, exists: !!result.version },
          );
        return result;
      },
      read: (input) => client.call('tasks.read', input),
      create: (input) => client.call('tasks.create', input),
      save: (input) => client.call('tasks.save', input),
    };
  }, [client, phase, projectId]);
  const catalog = useMemo<WorkbenchSession['taskCatalog']>(() => {
    void catalogRevision;
    if (!client || !port) return undefined;
    const check = async (libraryId: string) => {
      const status = await client.call('library.status', {});
      if (!status.read || status.id !== libraryId)
        throw new Error('文献库身份或读取授权已变化，请重读。');
    };
    return {
      list: async (input) => {
        const status = await client.call('library.status', {});
        const page = await client.call('library.list', input);
        await check(status.id);
        return { ...page, libraryId: status.id };
      },
      read: async (input) => {
        await check(input.libraryId);
        const source = await client.call('library.get', { sourceId: input.sourceId });
        await check(input.libraryId);
        if (source.id !== input.sourceId) throw new Error('题录回执不属于原引用。');
        return source;
      },
    };
  }, [client, port, catalogRevision]);
  const error = useFileWatch(
    client,
    projectId,
    port && scope.projectId === projectId && scope.exists ? ['tasks'] : [],
    (paths) => {
      if (paths.some((path) => path === 'tasks' || path.startsWith('tasks/')))
        setRevision((value) => value + 1);
    },
    () => setRevision((value) => value + 1),
  );
  return { port, catalog, revision: revision + fileRevision, error };
}
