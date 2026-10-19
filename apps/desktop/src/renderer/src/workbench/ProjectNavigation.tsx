import type { KernelClient } from '@scholoom/client';
import type { Effort, Project, ProjectBackup, WorkbenchSnapshot } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmAction } from './shell/menu';

type Call = KernelClient['call'];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';

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
