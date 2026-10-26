import type { KernelClient } from '@scholoom/client';
import type {
  Effort,
  ModelProfilesPage,
  Project,
  ProjectBackup,
  ProviderStatus,
  SaveModelProfile,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';

type Call = KernelClient['call'];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';

export function NamedModelProfiles({
  call,
  enabled,
  provider,
}: {
  call: Call;
  enabled: boolean;
  provider: ProviderStatus | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<ModelProfilesPage>();
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [draft, setDraft] = useState<SaveModelProfile>();
  const current = useRef({ draft, call, mounted: true });
  current.current.draft = draft;
  current.current.call = call;
  const saving = useRef(false);
  useEffect(() => {
    current.current.mounted = true;
    return () => {
      current.current.mounted = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 显式刷新和保存成功后重新读取本页。
  useEffect(() => {
    if (!open || !enabled) return;
    let active = true;
    setLoading(true);
    setListError('');
    setPage(undefined);
    void call('provider.profiles', { offset, limit: 25 })
      .then(
        (result) => {
          if (active) setPage(result);
        },
        (reason) => {
          if (active) setListError(messageOf(reason));
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [call, enabled, open, offset, reload]);
  const model = provider?.models.find((option) => option.id === draft?.config.model);
  const validEffort =
    !draft?.config.effort ||
    (model?.supportsEffort && provider?.efforts.includes(draft.config.effort));
  const edit = (change: Partial<SaveModelProfile>) => {
    setDraft((value) => (value ? { ...value, ...change } : value));
  };
  const mutate = async (remove: boolean) => {
    if (!draft || !enabled || saving.current) return;
    const submitted = draft;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (remove) {
        await call('provider.removeProfile', {
          id: submitted.id,
          expectedRevision: submitted.expectedRevision,
        });
        if (
          current.current.mounted &&
          current.current.call === call &&
          current.current.draft === submitted
        )
          setDraft(undefined);
      } else {
        const saved = await call('provider.saveProfile', submitted);
        if (
          current.current.mounted &&
          current.current.call === call &&
          current.current.draft === submitted
        )
          setDraft({
            id: saved.id,
            name: saved.name,
            expectedRevision: saved.revision,
            config: saved.config,
          });
      }
      if (current.current.mounted) setReload((value) => value + 1);
    } catch (reason) {
      if (
        current.current.mounted &&
        current.current.call === call &&
        current.current.draft === submitted
      )
        setError(messageOf(reason));
    } finally {
      saving.current = false;
      if (current.current.mounted) setBusy(false);
    }
  };
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>命名模型配置</summary>
      <fieldset className="project-controls" disabled={!enabled || busy}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDraft({
              id: crypto.randomUUID(),
              name: '',
              expectedRevision: 0,
              config: { model: '' },
            });
            setError('');
          }}
        >
          新建命名配置
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
        >
          刷新配置列表
        </button>
        {loading ? <p role="status">正在读取配置…</p> : null}
        {listError ? <p role="alert">{listError}</p> : null}
        {page?.profiles.length === 0 ? <p>暂无命名配置。</p> : null}
        {page?.profiles.map((profile) => (
          <button
            type="button"
            className="btn"
            key={profile.id}
            aria-label={`编辑命名配置 ${profile.name}`}
            onClick={() => {
              setDraft({
                id: profile.id,
                name: profile.name,
                expectedRevision: profile.revision,
                config: { ...profile.config },
              });
              setError('');
            }}
          >
            {profile.name}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          disabled={loading || offset === 0}
          onClick={() => setOffset((value) => Math.max(0, value - 25))}
        >
          上一页配置
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || page?.nextOffset === undefined}
          onClick={() => {
            if (page?.nextOffset !== undefined) setOffset(page.nextOffset);
          }}
        >
          下一页配置
        </button>
        {draft ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (model && validEffort && draft.name.trim()) void mutate(false);
            }}
          >
            <p>
              配置身份：{draft.id} · 修订 {draft.expectedRevision}
            </p>
            <label>
              配置名称
              <input
                aria-label="配置名称"
                maxLength={200}
                value={draft.name}
                onChange={(event) => edit({ name: event.target.value })}
              />
            </label>
            <label>
              配置模型
              <select
                aria-label="配置模型"
                value={draft.config.model}
                onChange={(event) =>
                  edit({ config: { ...draft.config, model: event.target.value } })
                }
              >
                <option value="">请选择模型</option>
                {draft.config.model && !model ? (
                  <option value={draft.config.model}>{draft.config.model}（目录未知）</option>
                ) : null}
                {(provider?.models ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              配置推理强度
              <select
                aria-label="配置推理强度"
                value={draft.config.effort ?? ''}
                onChange={(event) =>
                  edit({
                    config: {
                      model: draft.config.model,
                      ...(event.target.value ? { effort: event.target.value as Effort } : {}),
                    },
                  })
                }
              >
                <option value="">不指定</option>
                {draft.config.effort && !provider?.efforts.includes(draft.config.effort) ? (
                  <option value={draft.config.effort}>{draft.config.effort}（目录未知）</option>
                ) : null}
                {(provider?.efforts ?? []).map((effort) => (
                  <option key={effort} value={effort} disabled={!model?.supportsEffort}>
                    {effort}
                  </option>
                ))}
              </select>
            </label>
            {!model || !validEffort ? (
              <p role="alert">请核对当前模型目录与推理强度；草稿已保留。</p>
            ) : null}
            <button
              type="submit"
              className="btn"
              disabled={!model || !validEffort || !draft.name.trim()}
            >
              保存命名配置
            </button>
            <button
              type="button"
              className="btn"
              disabled={draft.expectedRevision === 0}
              onClick={() => void mutate(true)}
            >
              删除命名配置
            </button>
          </form>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </fieldset>
    </details>
  );
}

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
    trust: 'restricted' as 'trusted' | 'restricted',
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
  const { id, trust = 'pending', autoBackup = true } = project ?? {};
  useEffect(() => {
    if (!id) return;
    setGrants({ trust: trust === 'trusted' ? 'trusted' : 'restricted', autoBackup });
    setBackups([]);
    setArchivedSessions([]);
    setArchivedCursor(undefined);
    setArchivedError('');
  }, [id, trust, autoBackup]);
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
      <NamedModelProfiles call={call} enabled={enabled} provider={provider} />
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
        <label>
          <input
            type="checkbox"
            checked={grants.trust === 'trusted'}
            onChange={(event) =>
              setGrants((value) => ({
                ...value,
                trust: event.target.checked ? 'trusted' : 'restricted',
              }))
            }
          />
          信任项目（允许 Agent 读取、修改及外发项目材料）
        </label>
        <label>
          <input
            type="checkbox"
            checked={grants.autoBackup}
            onChange={(event) =>
              setGrants((value) => ({ ...value, autoBackup: event.target.checked }))
            }
          />
          自动备份
        </label>
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
