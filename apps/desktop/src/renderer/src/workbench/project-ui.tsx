import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { KernelClient } from '@scholoom/client';
import type {
  FileContent,
  FileEdit,
  FileEntry,
  Project,
  ProjectBackup,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { draftKey, readDraft, writeDraft } from './drafts';
import { lineDiff } from './line-diff';
import type { FileTarget } from './session';

type Call = KernelClient['call'];
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';

export function ProjectControls({
  snapshot,
  selectedProject,
  onSelect,
  call,
  onOpen,
  enabled,
}: {
  snapshot: WorkbenchSnapshot | undefined;
  selectedProject: string;
  onSelect: (id: string) => void;
  call: Call;
  onOpen: (project: Project) => void;
  enabled: boolean;
}) {
  const [key, setKey] = useState('');
  const [path, setPath] = useState('');
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
  const { id, read = false, write = false, send = false, autoBackup = true } = project ?? {};
  useEffect(() => {
    if (id) {
      setGrants({ read, write, send, autoBackup });
      setBackups([]);
    }
  }, [id, read, write, send, autoBackup]);
  const run = (action: () => Promise<unknown>) => {
    setError('');
    void action().catch((error) => setError(messageOf(error)));
  };
  return (
    <fieldset className="project-controls" disabled={!enabled}>
      <label>
        项目{' '}
        <select
          aria-label="当前项目"
          value={selectedProject}
          onChange={(event) => onSelect(event.target.value)}
        >
          {(snapshot?.projects ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
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
      {project && project.id !== 'application' ? (
        <details>
          <summary>项目权限与备份</summary>
          <p>授权对象：{project.path}；外部接收方：MiniMax M Plan 中国区。</p>
          {(['read', 'write', 'send', 'autoBackup'] as const).map((name) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={grants[name]}
                onChange={(event) =>
                  setGrants((value) => ({ ...value, [name]: event.target.checked }))
                }
              />
              {
                {
                  read: '读取项目材料',
                  write: '保存普通文件修改',
                  send: '将项目材料发送到 MiniMax',
                  autoBackup: '自动备份',
                }[name]
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
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  );
}

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
  attach: (path: string) => void;
  selected: string[];
}) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [next, setNext] = useState<number>();
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const load = useCallback(
    async (offset = 0) => {
      try {
        const page = await client.call('files.list', { projectId: project.id, path, offset });
        setEntries((current) => (offset ? [...current, ...page.entries] : page.entries));
        setNext(page.nextOffset);
        setError('');
      } catch (error) {
        setError(messageOf(error));
      }
    },
    [client, project.id, path],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 成果修订变化时刷新当前目录。
  useEffect(() => {
    if (project.read) void load();
  }, [project.read, load, revision]);
  if (!project.read) return <p>请先授权读取项目材料。</p>;
  return (
    <div className="project-files">
      <p>{path || project.name}</p>
      {path ? (
        <button type="button" onClick={() => setPath(path.split('/').slice(0, -1).join('/'))}>
          上一级
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void load();
        }}
      >
        刷新文件
      </button>
      <ul>
        {entries.map((entry) => (
          <li key={entry.path}>
            <button
              type="button"
              aria-label={`${entry.kind === 'dir' ? '进入目录' : '打开文件'} ${entry.path}`}
              onClick={() =>
                entry.kind === 'dir'
                  ? setPath(entry.path)
                  : open({ projectId: project.id, path: entry.path })
              }
            >
              {entry.kind === 'dir' ? '▸ ' : ''}
              {entry.name}
            </button>
            {entry.kind === 'file' ? (
              <label>
                <input
                  type="checkbox"
                  aria-label={`附加 ${entry.path}`}
                  checked={selected.includes(entry.path)}
                  onChange={() => attach(entry.path)}
                />
                附加
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      {next !== undefined ? (
        <button
          type="button"
          onClick={() => {
            void load(next);
          }}
        >
          更多文件
        </button>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (newName.trim())
            open({
              projectId: project.id,
              path: `${path ? `${path}/` : ''}${newName.trim()}`,
              create: true,
            });
        }}
      >
        <label>
          新文件
          <input
            aria-label="新文件名"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!project.write || !newName.trim()}>
          新建文件
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function FileEditor({
  client,
  directory,
  target,
  onChanged,
}: {
  client: KernelClient;
  directory: string;
  target: FileTarget;
  onChanged: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const loading = useRef(false);
  const [source, setSource] = useState<FileContent>();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const [error, setError] = useState('');
  const [historyItems, setHistory] = useState<FileEdit[]>([]);
  const key = draftKey(directory, target.projectId, target.path, 'file');
  const stored = useCallback(
    (value: string) => {
      draftRef.current = value;
      setDraft(value);
      if (!loading.current) writeDraft(key, JSON.stringify({ content: value }));
    },
    [key],
  );
  const savedDraft = useCallback((): string | undefined => {
    try {
      const value = JSON.parse(readDraft(key));
      return typeof value.content === 'string' ? value.content : undefined;
    } catch {
      return undefined;
    }
  }, [key]);
  const reload = useCallback(
    async (preserve = true) => {
      const view = editor.current;
      try {
        const value = await client.call('files.read', {
          projectId: target.projectId,
          path: target.path,
        });
        if (editor.current !== view) return;
        setSource(value);
        setError('');
        const local = preserve ? savedDraft() : undefined;
        const content = local ?? value.content;
        draftRef.current = content;
        setDraft(content);
        loading.current = true;
        editor.current?.dispatch({
          changes: { from: 0, to: editor.current.state.doc.length, insert: content },
        });
        loading.current = false;
      } catch (error) {
        setError(messageOf(error));
      }
    },
    [client, target.projectId, target.path, savedDraft],
  );
  useEffect(() => {
    if (!mount.current) return;
    const view = new EditorView({
      parent: mount.current,
      state: EditorState.create({
        doc: savedDraft() ?? '',
        extensions: [
          markdown(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': `文件内容 ${target.path}` }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) stored(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.current = view;
    if (!target.create) void reload();
    else {
      draftRef.current = savedDraft() ?? '';
      setDraft(draftRef.current);
    }
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, [target.path, target.create, savedDraft, reload, stored]);
  const save = async () => {
    const submitted = draftRef.current;
    const view = editor.current;
    try {
      await client.call('files.save', {
        projectId: target.projectId,
        path: target.path,
        content: submitted,
        ...(source?.basis ? { basis: source.basis } : {}),
      });
      const value = await client.call('files.read', {
        projectId: target.projectId,
        path: target.path,
      });
      if (editor.current !== view) return;
      setSource(value);
      if (draftRef.current === submitted && value.content === submitted) writeDraft(key, '');
      setError('');
      onChanged();
    } catch (error) {
      setError(messageOf(error));
    }
  };
  const differences = lineDiff(source?.content ?? '', draft);
  return (
    <section className="file-editor" aria-label={`编辑 ${target.path}`}>
      <div className="file-toolbar">
        <span>
          {target.path}
          {draft !== source?.content ? ' · 未保存' : ''}
        </span>
        <button
          type="button"
          disabled={source?.truncated}
          onClick={() => {
            void save();
          }}
        >
          保存文件
        </button>
        <button
          type="button"
          onClick={() => {
            void reload();
          }}
        >
          重新读取
        </button>
        <button
          type="button"
          onClick={() => {
            void client
              .call('files.history', { projectId: target.projectId, path: target.path })
              .then(setHistory, (error) => setError(messageOf(error)));
          }}
        >
          修改历史
        </button>
      </div>
      {source?.truncated ? <p>文件超过本期编辑范围，仅显示当前读取部分。</p> : null}
      {error ? <p role="alert">{error} 草稿已保留。</p> : null}
      <div className="codemirror-host" ref={mount} />
      <details>
        <summary>查看差异</summary>
        {differences ? (
          <pre>
            {differences.map((row, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 差异行无交互状态，按当前位置渲染。
              <div key={`${index}-${row.kind}`} className={`diff-${row.kind}`}>
                {row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  '}
                {row.text}
              </div>
            ))}
          </pre>
        ) : (
          <>
            <pre>{source?.content}</pre>
            <pre>{draft}</pre>
          </>
        )}
      </details>
      {historyItems.map((edit) => (
        <details key={edit.id}>
          <summary>{edit.createdAt}</summary>
          <pre>{edit.before}</pre>
          <pre>{edit.after}</pre>
          <button
            type="button"
            onClick={() => {
              void client.call('files.undo', { projectId: target.projectId, editId: edit.id }).then(
                () => reload(),
                (error) => setError(messageOf(error)),
              );
            }}
          >
            撤销此修改
          </button>
        </details>
      ))}
    </section>
  );
}
