import type { KernelClient } from '@scholoom/client';
import type {
  FileEntry,
  FileLocation,
  FileOperation,
  Project,
  ProjectBackup,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { FileTarget } from './session';

type Call = KernelClient['call'];
type Listing<T> = { entries: T[]; next?: number };

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';
const codeOf = (error: unknown) =>
  error instanceof Error && 'code' in error ? error.code : undefined;
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
const childOf = (directory: string, name: string) => (directory ? `${directory}/${name}` : name);
const operationKind: Record<FileOperation['kind'], string> = {
  mkdir: '新建目录',
  rename: '重命名',
  trash: '回收',
  restore: '恢复',
};
const operationState: Record<FileOperation['state'], string> = {
  prepared: '待确认',
  complete: '已完成',
  unknown: '结果未知',
  failed: '未执行',
};

/** 左区项目入口（mode="project"）与中间区设置页（mode="settings"）共用同一份状态与调用。 */
export function ProjectControls({
  snapshot,
  selectedProject,
  onSelect,
  call,
  onOpen,
  enabled,
  mode = 'project',
}: {
  snapshot: WorkbenchSnapshot | undefined;
  selectedProject: string;
  onSelect: (id: string) => void;
  call: Call;
  onOpen: (project: Project) => void;
  enabled: boolean;
  mode?: 'project' | 'settings';
}) {
  const [key, setKey] = useState('');
  const [path, setPath] = useState('');
  const [createPath, setCreatePath] = useState('');
  const [createName, setCreateName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [grants, setGrants] = useState({
    read: false,
    write: false,
    send: false,
    autoBackup: true,
  });
  const [backups, setBackups] = useState<ProjectBackup[]>([]);
  const [destination, setDestination] = useState('');
  const project = snapshot?.projects.find((item) => item.id === selectedProject);
  const {
    id,
    name = '',
    read = false,
    write = false,
    send = false,
    autoBackup = true,
  } = project ?? {};
  useEffect(() => {
    if (!id) return;
    setGrants({ read, write, send, autoBackup });
    setBackups([]);
    setDisplayName(name);
  }, [id, name, read, write, send, autoBackup]);
  const run = (action: () => Promise<unknown>) => {
    setError('');
    void action().catch((reason) => setError(messageOf(reason)));
  };
  const model = (
    <details>
      <summary>模型设置</summary>
      <p>MiniMax M Plan 中国区 · {snapshot?.provider.model ?? 'MiniMax-M3.1-Flash-Preview'}</p>
      <p role="status">
        {snapshot?.provider.configured
          ? `已配置 · ${snapshot.provider.source === 'saved' ? '本机凭据' : '环境变量'}`
          : '请填写订阅 API Key'}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await call('provider.configure', { apiKey: key });
            setKey('');
          });
        }}
      >
        <label>
          API Key
          <input
            type="password"
            aria-label="MiniMax API Key"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!key.trim()}>
          保存凭据
        </button>
      </form>
    </details>
  );
  const permission =
    project && project.id !== 'application' ? (
      <details>
        <summary>项目权限与备份</summary>
        <p>授权对象：{project.path}；外部接收方：MiniMax M Plan 中国区。</p>
        {(['read', 'write', 'send', 'autoBackup'] as const).map((grant) => (
          <label key={grant}>
            <input
              type="checkbox"
              checked={grants[grant]}
              onChange={(event) =>
                setGrants((value) => ({ ...value, [grant]: event.target.checked }))
              }
            />
            {
              {
                read: '读取项目材料',
                write: '新建、修改、重命名和回收／恢复项目文件及目录',
                send: '将项目材料发送到 MiniMax',
                autoBackup: '自动备份',
              }[grant]
            }
          </label>
        ))}
        <button
          type="button"
          onClick={() =>
            run(async () => {
              await call('project.grant', { projectId: project.id, ...grants });
            })
          }
        >
          保存项目授权
        </button>
        <button
          type="button"
          onClick={() =>
            run(async () => {
              await call('project.backup', { projectId: project.id });
              setBackups(await call('project.backups', { projectId: project.id }));
            })
          }
        >
          立即备份
        </button>
        <button
          type="button"
          onClick={() =>
            run(async () => {
              setBackups(await call('project.backups', { projectId: project.id }));
            })
          }
        >
          查看备份
        </button>
        <label>
          独立恢复目录
          <input
            aria-label="独立恢复目录"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </label>
        {backups.map((backup) => (
          <div key={backup.id}>
            <span>{backup.createdAt}</span>
            <button
              type="button"
              disabled={!destination.trim()}
              onClick={() =>
                run(async () => {
                  onOpen(
                    await call('project.restore', {
                      projectId: project.id,
                      backupId: backup.id,
                      destination,
                    }),
                  );
                })
              }
            >
              恢复此副本
            </button>
            <details>
              <summary>备份范围</summary>
              {backup.omitted.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </details>
          </div>
        ))}
      </details>
    ) : null;
  return (
    <fieldset className="project-controls" disabled={!enabled}>
      {mode === 'project' ? (
        <>
          <label>
            项目{' '}
            <select
              aria-label="当前项目"
              value={selectedProject}
              onChange={(event) => onSelect(event.target.value)}
            >
              {(snapshot?.projects ?? [])
                .filter((item) => item.recent !== false || item.id === selectedProject)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <details>
            <summary>新建项目</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  const directory = createPath.trim();
                  const label = createName.trim();
                  const created = await call(
                    'project.create',
                    label ? { path: directory, name: label } : { path: directory },
                  );
                  setCreatePath('');
                  setCreateName('');
                  onOpen(created);
                });
              }}
            >
              <label>
                项目目录
                <input
                  aria-label="新建项目目录"
                  value={createPath}
                  onChange={(event) => setCreatePath(event.target.value)}
                />
              </label>
              <label>
                显示名
                <input
                  aria-label="新建项目显示名"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                />
              </label>
              <button type="submit" disabled={!createPath.trim()}>
                创建项目
              </button>
            </form>
          </details>
          <details>
            <summary>打开项目</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  onOpen(await call('project.open', { path }));
                });
              }}
            >
              <label>
                项目目录
                <input
                  aria-label="项目目录"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                />
              </label>
              <button type="submit">打开目录</button>
            </form>
          </details>
          {project && project.id !== 'application' ? (
            <details>
              <summary>当前项目设置</summary>
              <p>移出最近列表只改变列表记录，不删除目录内容，也不停止执行。</p>
              <label>
                显示名
                <input
                  aria-label="项目显示名"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!displayName.trim()}
                onClick={() =>
                  run(async () => {
                    const renamed = await call('project.rename', {
                      projectId: project.id,
                      name: displayName.trim(),
                    });
                    setDisplayName(renamed.name);
                  })
                }
              >
                保存显示名
              </button>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await call('project.forget', { projectId: project.id });
                    onSelect('application');
                  })
                }
              >
                移出最近列表
              </button>
            </details>
          ) : null}
        </>
      ) : (
        <>
          {model}
          {permission}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  );
}

function TrashRow({
  entry,
  disabled,
  restore,
}: {
  entry: FileLocation;
  disabled: boolean;
  restore: (destination: string) => void;
}) {
  const [where, setWhere] = useState('');
  return (
    <li>
      <span>{entry.path}</span>
      <input
        aria-label={`恢复位置 ${entry.path}`}
        placeholder="留空恢复原位"
        value={where}
        onChange={(event) => setWhere(event.target.value)}
      />
      <button type="button" disabled={disabled} onClick={() => restore(where.trim())}>
        恢复
      </button>
    </li>
  );
}

/** 右区文件树：按需展开、每页 100 项，结构操作带身份核查且不重放副作用。 */
export function ProjectNavigator({
  client,
  project,
  revision,
  open,
  attach,
  selected,
}: {
  client: KernelClient;
  project: Project;
  revision: number;
  open: (file: FileTarget) => void;
  attach: (path: string, fileId?: string) => void;
  selected: string[];
}) {
  const [dirs, setDirs] = useState<Record<string, Listing<FileEntry>>>({});
  const [row, setRow] = useState<FileEntry>();
  const [actions, setActions] = useState<FileOperation[]>([]);
  const [error, setError] = useState('');
  const [trash, setTrash] = useState<Listing<FileLocation>>();
  const [createName, setCreateName] = useState('');
  const [directoryName, setDirectoryName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const epoch = useRef(0);
  const requests = useRef<Record<string, number>>({});
  const trashRequests = useRef(0);
  const dirsRef = useRef(dirs);
  dirsRef.current = dirs;
  const trashRef = useRef(trash);
  trashRef.current = trash;
  const folder = row ? (row.kind === 'dir' ? row.path : parentOf(row.path)) : '';

  const load = useCallback(
    async (path: string, offset = 0) => {
      const token = (requests.current[path] ?? 0) + 1;
      requests.current[path] = token;
      const generation = epoch.current;
      try {
        const page = await client.call('files.list', {
          projectId: project.id,
          path,
          offset,
          limit: 100,
        });
        // 迟到的跨项目、跨世代或已折叠目录回应不写入当前树。
        if (generation !== epoch.current || requests.current[path] !== token) return;
        setDirs((current) => ({
          ...current,
          [path]: {
            entries: offset ? [...(current[path]?.entries ?? []), ...page.entries] : page.entries,
            ...(page.nextOffset === undefined ? {} : { next: page.nextOffset }),
          },
        }));
        setError('');
      } catch (reason) {
        if (generation !== epoch.current || requests.current[path] !== token) return;
        setError(messageOf(reason));
      }
    },
    [client, project.id],
  );

  const loadTrash = useCallback(
    async (offset = 0) => {
      const token = trashRequests.current + 1;
      trashRequests.current = token;
      const generation = epoch.current;
      try {
        const page = await client.call('files.trashList', {
          projectId: project.id,
          offset,
          limit: 100,
        });
        if (generation !== epoch.current || trashRequests.current !== token) return;
        setTrash({
          entries: offset ? [...(trashRef.current?.entries ?? []), ...page.entries] : page.entries,
          ...(page.nextOffset === undefined ? {} : { next: page.nextOffset }),
        });
        setError('');
      } catch (reason) {
        if (generation !== epoch.current || trashRequests.current !== token) return;
        setError(messageOf(reason));
      }
    },
    [client, project.id],
  );

  const refresh = useCallback(() => {
    // 刷新只重读已展开目录的首屏，不逐页重放历史分页。
    for (const path of ['', ...Object.keys(dirsRef.current).filter((item) => item)])
      void load(path);
  }, [load]);

  const refreshAfter = (value: FileOperation) => {
    for (const path of new Set([parentOf(value.path), parentOf(value.destination ?? value.path)]))
      if (path === '' || dirsRef.current[path]) void load(path);
  };

  const record = (value: FileOperation) =>
    setActions((current) => {
      const rest = current.filter((item) => item.id !== value.id);
      return value.state === 'complete' ? rest : [value, ...rest];
    });

  const run = async (
    action: () => Promise<FileOperation>,
    pending: Omit<FileOperation, 'state'>,
    after: () => void,
  ) => {
    setError('');
    try {
      const value = await action();
      record(value);
      if (value.state !== 'complete') return;
      after();
      refreshAfter(value);
    } catch (reason) {
      setError(messageOf(reason));
      // 结果未知时保留操作身份，按原 operationId 核查，不重放移动。
      if (codeOf(reason) === 'outcomeUnknown')
        record({ ...pending, state: 'unknown', error: messageOf(reason) });
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 项目切换丢弃旧世代与旧选择，迟到回应不写入新项目。
  useEffect(() => {
    epoch.current++;
    requests.current = {};
    setDirs({});
    setRow(undefined);
    setActions([]);
    setTrash(undefined);
    setConfirming(false);
  }, [project.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 文件修订是独立刷新信号，流式输出不触发重读。
  useEffect(() => {
    if (!project.read) return;
    refresh();
  }, [project.read, refresh, revision]);

  const forget = (path: string) => {
    requests.current[path] = (requests.current[path] ?? 0) + 1;
    setDirs((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== path && !key.startsWith(`${path}/`)),
      ),
    );
  };

  const createFile = () => {
    const name = createName.trim();
    if (!name) return;
    open({ projectId: project.id, path: childOf(folder, name), create: true });
  };

  const mkdir = () => {
    const name = directoryName.trim();
    if (!name) return;
    const operationId = crypto.randomUUID();
    const path = childOf(folder, name);
    void run(
      () => client.call('files.mkdir', { projectId: project.id, path, operationId }),
      { id: operationId, kind: 'mkdir', path },
      () => setDirectoryName(''),
    );
  };

  const rename = () => {
    const entry = row;
    const name = renameName.trim();
    if (!entry || !name) return;
    const operationId = crypto.randomUUID();
    void run(
      () =>
        client.call('files.rename', { projectId: project.id, path: entry.path, name, operationId }),
      { id: operationId, kind: 'rename', path: entry.path },
      () => {
        setRenameName('');
        setRow(undefined);
        forget(entry.path);
      },
    );
  };

  const trashRow = () => {
    const entry = row;
    if (!entry) return;
    const operationId = crypto.randomUUID();
    void run(
      () => client.call('files.trash', { projectId: project.id, path: entry.path, operationId }),
      { id: operationId, kind: 'trash', path: entry.path },
      () => {
        setRenameName('');
        setConfirming(false);
        setRow(undefined);
        forget(entry.path);
        if (trashRef.current) void loadTrash(0);
      },
    );
  };

  const restore = (entry: FileLocation, destination: string) => {
    const operationId = crypto.randomUUID();
    void run(
      () =>
        client.call('files.restore', {
          projectId: project.id,
          trashId: entry.trashId ?? '',
          operationId,
          ...(destination ? { destination } : {}),
        }),
      { id: operationId, kind: 'restore', path: entry.path },
      () => {
        if (trashRef.current) void loadTrash(0);
      },
    );
  };

  const check = (operation: FileOperation) => {
    void (async () => {
      try {
        const value = await client.call('files.operation', {
          projectId: project.id,
          operationId: operation.id,
        });
        record(value);
        if (value.state === 'complete') refreshAfter(value);
      } catch (reason) {
        record({ ...operation, error: messageOf(reason) });
        setError(messageOf(reason));
      }
    })();
  };

  if (!project.read) return <p>请先授权读取项目材料。</p>;

  const toggle = (path: string) => {
    if (dirs[path]) forget(path);
    else void load(path);
  };

  const rows: ReactNode[] = [];
  const renderDirectory = (path: string, depth: number) => {
    const page = dirs[path];
    for (const entry of page?.entries ?? []) {
      rows.push(
        <li
          key={entry.fileId ?? entry.path}
          className={row?.path === entry.path ? 'tree__open' : undefined}
          style={{ paddingLeft: `calc(var(--space-unit) * ${2 + depth * 3})` }}
        >
          <button
            type="button"
            aria-label={`${entry.kind === 'dir' ? '进入目录' : '打开文件'} ${entry.path}`}
            onClick={() => {
              setRow(entry);
              setRenameName('');
              setConfirming(false);
              if (entry.kind === 'dir') toggle(entry.path);
              else
                open({
                  projectId: project.id,
                  path: entry.path,
                  ...(entry.fileId ? { fileId: entry.fileId } : {}),
                });
            }}
          >
            {entry.kind === 'dir' ? `${dirs[entry.path] ? '▾' : '▸'} ` : ''}
            {entry.name}
          </button>
          {entry.kind === 'file' ? (
            <label>
              <input
                type="checkbox"
                aria-label={`附加 ${entry.path}`}
                checked={selected.includes(entry.path)}
                onChange={() => attach(entry.path, entry.fileId)}
              />
              附加
            </label>
          ) : null}
        </li>,
      );
      if (entry.kind === 'dir' && dirs[entry.path]) renderDirectory(entry.path, depth + 1);
    }
    const next = page?.next;
    if (next !== undefined)
      rows.push(
        <li
          key={`${path}:more`}
          style={{ paddingLeft: `calc(var(--space-unit) * ${2 + (depth + 1) * 3})` }}
        >
          <button
            type="button"
            aria-label={`更多文件 ${path || '项目根目录'}`}
            onClick={() => void load(path, next)}
          >
            更多文件
          </button>
        </li>,
      );
  };
  renderDirectory('', 0);
  const trashNext = trash?.next;

  return (
    <div className="project-files">
      <p>{row ? `选中：${row.path}` : project.name}</p>
      <button type="button" onClick={refresh}>
        刷新文件
      </button>
      <ul className="tree">{rows}</ul>
      {row ? (
        <div>
          <label>
            新名称
            <input
              aria-label="新名称"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
            />
          </label>
          <button type="button" disabled={!project.write || !renameName.trim()} onClick={rename}>
            重命名
          </button>
          <button type="button" disabled={!project.write} onClick={() => setConfirming(true)}>
            回收
          </button>
          {confirming ? (
            <p role="status">
              确认回收 {row.path}
              {row.kind === 'dir' ? '（含目录内容）' : ''}？可在回收站恢复。
              <button type="button" disabled={!project.write} onClick={trashRow}>
                确认回收
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                取消
              </button>
            </p>
          ) : null}
        </div>
      ) : null}
      <p>新建位置：{folder || '项目根目录'}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          createFile();
        }}
      >
        <label>
          新文件
          <input
            aria-label="新文件名"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!project.write || !createName.trim()}>
          新建文件
        </button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mkdir();
        }}
      >
        <label>
          新目录
          <input
            aria-label="新建目录名"
            value={directoryName}
            onChange={(event) => setDirectoryName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!project.write || !directoryName.trim()}>
          新建目录
        </button>
      </form>
      {actions.length ? (
        <details>
          <summary>结构操作</summary>
          {actions.map((operation) => (
            <div key={operation.id}>
              <span>
                {operationKind[operation.kind]} · {operation.path} ·{' '}
                {operationState[operation.state]}
              </span>
              <button
                type="button"
                aria-label={`核查 ${operation.path}`}
                onClick={() => check(operation)}
              >
                核查
              </button>
              {operation.error ? <span role="status">{operation.error}</span> : null}
            </div>
          ))}
        </details>
      ) : null}
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && !trashRef.current) void loadTrash(0);
        }}
      >
        <summary>回收站</summary>
        {trash === undefined ? (
          <p>展开后按页读取。</p>
        ) : trash.entries.length === 0 ? (
          <p>暂无回收内容。</p>
        ) : (
          <ul>
            {trash.entries.map((entry) => (
              <TrashRow
                key={entry.trashId ?? entry.fileId}
                entry={entry}
                disabled={!project.write}
                restore={(destination) => restore(entry, destination)}
              />
            ))}
          </ul>
        )}
        {trashNext === undefined ? null : (
          <button type="button" onClick={() => void loadTrash(trashNext)}>
            更多回收项
          </button>
        )}
      </details>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
