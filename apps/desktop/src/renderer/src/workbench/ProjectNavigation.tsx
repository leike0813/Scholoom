import type { KernelClient } from '@scholoom/client';
import type {
  Effort,
  FileEntry,
  FileLocation,
  FileOperation,
  Project,
  ProjectBackup,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { FileTarget } from './session';
import { IconChevronRight } from './shell/icons';
import { ConfirmAction } from './shell/menu';

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

/** 中间区设置页：模型设置（应用默认与凭据）与当前项目权限、备份。 */
export function ProjectControls({
  snapshot,
  selectedProject,
  call,
  onOpen,
  enabled,
}: {
  snapshot: WorkbenchSnapshot | undefined;
  selectedProject: string;
  call: Call;
  onOpen: (project: Project) => void;
  enabled: boolean;
}) {
  const [key, setKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultEffort, setDefaultEffort] = useState<Effort | ''>('');
  const [error, setError] = useState('');
  const [grants, setGrants] = useState({
    read: false,
    write: false,
    send: false,
    autoBackup: true,
  });
  const [backups, setBackups] = useState<ProjectBackup[]>([]);
  const [destination, setDestination] = useState('');
  const [archivedSessions, setArchivedSessions] = useState<
    Array<{ id: string; title: string; updatedAt: string }>
  >([]);
  const [archivedCursor, setArchivedCursor] = useState<
    { updatedAt: string; id: string } | undefined
  >(undefined);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState('');
  const provider = snapshot?.provider;
  const project = snapshot?.projects.find((item) => item.id === selectedProject);
  const { id, read = false, write = false, send = false, autoBackup = true } = project ?? {};
  useEffect(() => {
    if (!id) return;
    setGrants({ read, write, send, autoBackup });
    setBackups([]);
    setArchivedSessions([]);
    setArchivedCursor(undefined);
    setArchivedError('');
  }, [id, read, write, send, autoBackup]);
  const providerModel = provider?.model;
  const providerDefaultEffort = provider?.defaultEffort;
  useEffect(() => {
    if (providerModel === undefined || providerDefaultEffort === undefined) return;
    setDefaultModel(providerModel);
    setDefaultEffort(providerDefaultEffort);
  }, [providerModel, providerDefaultEffort]);
  const run = (action: () => Promise<unknown>) => {
    setError('');
    void action().catch((reason) => setError(messageOf(reason)));
  };
  const loadArchivedSessions = useCallback(
    (append = false) => {
      if (!id || archivedLoading) return;
      setArchivedLoading(true);
      setArchivedError('');
      void (async () => {
        try {
          const result = await call('session.list', {
            projectId: id,
            archived: true,
            ...(append && archivedCursor ? { cursor: archivedCursor } : {}),
          });
          setArchivedSessions((prev) =>
            append
              ? // 去重：已有 id 则保留原有项
                [...prev, ...result.sessions.filter((s) => !prev.find((p) => p.id === s.id))]
              : result.sessions,
          );
          setArchivedCursor(result.nextCursor);
        } catch (reason) {
          setArchivedError(messageOf(reason));
        } finally {
          setArchivedLoading(false);
        }
      })();
    },
    [id, call, archivedLoading, archivedCursor],
  );
  const restoreSession = (sessionId: string) => {
    if (!id) return;
    setArchivedError('');
    void (async () => {
      try {
        await call('session.archive', { projectId: id, sessionId, archived: false });
        // 恢复成功后，从归档列表移除
        setArchivedSessions((prev) => prev.filter((s) => s.id !== sessionId));
        // 重新加载左侧列表中的活动会话
        // 这里通过刷新 snapshot 来完成，依赖父组件处理
      } catch (reason) {
        setArchivedError(messageOf(reason));
      }
    })();
  };
  const model = (
    <details>
      <summary>模型设置</summary>
      <p>MiniMax M Plan 中国区 · {provider?.model ?? 'MiniMax-M3.1-Flash-Preview'}</p>
      <p role="status">
        {provider?.configured
          ? `已配置 · ${provider.source === 'saved' ? '本机凭据' : '环境变量'}`
          : '请填写订阅 API Key'}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!defaultModel || !defaultEffort) return;
          run(async () => {
            await call('provider.setDefaults', { model: defaultModel, effort: defaultEffort });
          });
        }}
      >
        <label>
          应用默认模型
          <select
            aria-label="应用默认模型"
            value={defaultModel}
            disabled={!enabled || !provider}
            onChange={(event) => setDefaultModel(event.target.value)}
          >
            {(provider?.models ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          默认推理强度
          <select
            aria-label="默认推理强度"
            value={defaultEffort}
            disabled={!enabled || !provider}
            onChange={(event) => setDefaultEffort(event.target.value as Effort)}
          >
            {(provider?.efforts ?? []).map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="btn"
          disabled={!enabled || !provider || !defaultModel || !defaultEffort}
        >
          保存默认设置
        </button>
      </form>
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
        <button type="submit" className="btn" disabled={!key.trim()}>
          保存凭据
        </button>
      </form>
    </details>
  );
  const archivedSection = project ? (
    <details>
      <summary>归档会话</summary>
      <button
        type="button"
        className="btn"
        disabled={!enabled}
        onClick={() => loadArchivedSessions(false)}
      >
        加载归档会话
      </button>
      {archivedSessions.length > 0 ? (
        <ul className="archived-sessions-list">
          {archivedSessions.map((session) => (
            <li key={session.id} className="archived-session-row">
              <span className="archived-session-info">
                <strong>{session.title}</strong>
                <span>{session.updatedAt}</span>
              </span>
              <button
                type="button"
                className="btn"
                disabled={!enabled}
                onClick={() => restoreSession(session.id)}
              >
                恢复
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {archivedCursor !== undefined ? (
        <button
          type="button"
          className="btn"
          disabled={!enabled || archivedLoading}
          aria-busy={archivedLoading || undefined}
          onClick={() => loadArchivedSessions(true)}
        >
          加载更多
        </button>
      ) : null}
      {archivedError ? <p role="alert">{archivedError}</p> : null}
    </details>
  ) : null;
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
          className="btn"
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
          className="btn"
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
          className="btn"
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
              className="btn"
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
    <>
      {model}
      <fieldset className="project-controls" disabled={!enabled}>
        {permission}
        {archivedSection}
        {error ? <p role="alert">{error}</p> : null}
      </fieldset>
    </>
  );
}

function TrashRow({
  entry,
  disabled,
  busy,
  restore,
}: {
  entry: FileLocation;
  disabled: boolean;
  busy: boolean;
  restore: (destination: string) => void;
}) {
  const [where, setWhere] = useState('');
  return (
    <li className="trash-row">
      <span>{entry.path}</span>
      <input
        aria-label={`恢复位置 ${entry.path}`}
        placeholder="留空恢复原位"
        value={where}
        onChange={(event) => setWhere(event.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={() => restore(where.trim())}
      >
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
  const [busy, setBusy] = useState<Record<string, boolean>>({});
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
    key: string,
    action: () => Promise<FileOperation>,
    pending: Omit<FileOperation, 'state'>,
    after: () => void,
  ) => {
    setError('');
    setBusy((current) => ({ ...current, [key]: true }));
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
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
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
      'mkdir',
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
      'rename',
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
      'trash',
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
      `restore:${entry.trashId ?? entry.fileId}`,
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
      const current = row?.path === entry.path;
      rows.push(
        <li
          key={entry.fileId ?? entry.path}
          className={`file-tree__row${current ? ' file-tree__row--selected' : ''}`}
          style={{ '--depth': depth } as CSSProperties}
        >
          <button
            type="button"
            className="file-tree__entry"
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
            {entry.kind === 'dir' ? (
              <span
                className={`file-tree__chevron${dirs[entry.path] ? ' file-tree__chevron--open' : ''}`}
              >
                <IconChevronRight />
              </span>
            ) : null}
            <span>{entry.name}</span>
          </button>
          {entry.kind === 'file' ? (
            <label className="file-tree__attach">
              <input
                type="checkbox"
                aria-label={`附加 ${entry.path}`}
                checked={selected.includes(entry.path)}
                onChange={() => attach(entry.path, entry.fileId)}
              />
              附加
            </label>
          ) : null}
          {current ? (
            <div className="file-tree__actions">
              <label className="file-tree__rename">
                新名称
                <input
                  aria-label="新名称"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={!project.write || !renameName.trim() || !!busy.rename}
                aria-busy={!!busy.rename || undefined}
                onClick={rename}
              >
                重命名
              </button>
              <button
                type="button"
                className="btn"
                disabled={!project.write}
                onClick={() => setConfirming(true)}
              >
                回收
              </button>
              {confirming ? (
                <ConfirmAction
                  className="file-tree__confirm"
                  description={`确认回收 ${entry.path}${entry.kind === 'dir' ? '（含目录内容）' : ''}？可在回收站恢复。`}
                  confirmLabel="确认回收"
                  busy={!!busy.trash}
                  onConfirm={trashRow}
                  onCancel={() => setConfirming(false)}
                />
              ) : null}
            </div>
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
          className="file-tree__row"
          style={{ '--depth': depth + 1 } as CSSProperties}
        >
          <button
            type="button"
            className="file-tree__entry file-tree__more"
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
      <div className="file-tree-toolbar">
        <span className="file-tree-toolbar__label">{row ? `选中：${row.path}` : project.name}</span>
        <button type="button" className="btn" onClick={refresh}>
          刷新文件
        </button>
      </div>
      <div className="file-tree-create">
        <p className="file-tree-create__hint">新建位置：{folder || '项目根目录'}</p>
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
          <button type="submit" className="btn" disabled={!project.write || !createName.trim()}>
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
          <button
            type="submit"
            className="btn"
            disabled={!project.write || !directoryName.trim() || !!busy.mkdir}
            aria-busy={!!busy.mkdir || undefined}
          >
            新建目录
          </button>
        </form>
      </div>
      <ul className="tree file-tree">{rows}</ul>
      {actions.length ? (
        <details className="file-tree-details">
          <summary>结构操作</summary>
          {actions.map((operation) => (
            <div className="file-tree-op" key={operation.id}>
              <span>
                {operationKind[operation.kind]} · {operation.path} ·{' '}
                {operationState[operation.state]}
              </span>
              <button
                type="button"
                className="btn"
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
        className="file-tree-details"
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
          <ul className="trash-list">
            {trash.entries.map((entry) => (
              <TrashRow
                key={entry.trashId ?? entry.fileId}
                entry={entry}
                disabled={!project.write}
                busy={!!busy[`restore:${entry.trashId ?? entry.fileId}`]}
                restore={(destination) => restore(entry, destination)}
              />
            ))}
          </ul>
        )}
        {trashNext === undefined ? null : (
          <button type="button" className="btn" onClick={() => void loadTrash(trashNext)}>
            更多回收项
          </button>
        )}
      </details>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
