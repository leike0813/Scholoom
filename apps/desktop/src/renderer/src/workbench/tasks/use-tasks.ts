import type { KernelClient } from '@scholoom/client';
import type { TaskPort } from '@scholoom/protocol';
import { useMemo, useRef, useState } from 'react';
import type { KernelPhase } from '../session';
import { useFileWatch } from '../useFileWatch';

export function useTasks(
  client: KernelClient | null,
  phase: KernelPhase,
  projectId: string,
  fileRevision = 0,
) {
  const [revision, setRevision] = useState(0);
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
  return { port, revision: revision + fileRevision, error };
}
