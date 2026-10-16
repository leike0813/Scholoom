import type { KernelClient } from '@scholoom/client';
import type { BusinessResult, Project } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from './shell/dialog';

const pickerDirectoryKey = 'scholoom.project-picker.directory';
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '目录操作未完成，请核对内核状态。';
const basename = (path: string) =>
  path
    .split(/[\\/]+/)
    .filter(Boolean)
    .at(-1) ?? path;
const joinPath = (parent: string, name: string) => `${parent.replace(/[\\/]+$/, '')}/${name}`;
const readRememberedDirectory = () => {
  try {
    return localStorage.getItem(pickerDirectoryKey) ?? undefined;
  } catch {
    return undefined;
  }
};
const rememberDirectory = (path: string) => {
  try {
    localStorage.setItem(pickerDirectoryKey, path);
  } catch {
    // 记忆位置只是便利，不因存储不可用阻断选择。
  }
};

function DirectoryPicker({
  client,
  onSelect,
  onCancel,
}: {
  client: KernelClient;
  onSelect: (path: string) => void;
  onCancel: () => void;
}) {
  const [page, setPage] = useState<BusinessResult<'project.browseDirectories'>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);

  const load = useCallback(
    async (path?: string) => {
      const generation = ++request.current;
      setLoading(true);
      setError('');
      try {
        const value = await client.call('project.browseDirectories', {
          ...(path ? { path } : {}),
          limit: 100,
        });
        if (generation !== request.current) return;
        setPage(value);
      } catch (reason) {
        if (generation === request.current) setError(messageOf(reason));
      } finally {
        if (generation === request.current) setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load(readRememberedDirectory());
  }, [load]);

  return (
    <section className="directory-picker" aria-label="选择目录">
      <div className="directory-picker__location">
        <span>当前位置</span>
        <code>{page?.path ?? '正在读取…'}</code>
      </div>
      <div className="directory-picker__list" aria-busy={loading || undefined}>
        {page?.parent ? (
          <button
            type="button"
            className="directory-picker__row"
            onClick={() => void load(page.parent)}
          >
            .. 上级目录
          </button>
        ) : null}
        {page?.directories.map((entry) => (
          <button
            type="button"
            key={entry.path}
            className="directory-picker__row"
            aria-label={`进入目录 ${entry.name}`}
            onClick={() => void load(entry.path)}
          >
            {entry.name}
          </button>
        ))}
        {!loading && page?.directories.length === 0 ? (
          <p className="empty-hint">此位置没有可选择的子目录</p>
        ) : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {page?.truncated ? <p className="empty-hint">仅显示前 100 个目录</p> : null}
      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          disabled={!page || loading}
          onClick={() => page && onSelect(page.path)}
        >
          选择此目录
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          返回
        </button>
      </div>
    </section>
  );
}

/** 添加项目弹窗：Electron 走系统目录选择器，浏览器开发宿主走内核目录浏览。 */
export function ProjectOnboardingDialog({
  client,
  enabled,
  onClose,
  openProject,
}: {
  client: KernelClient;
  enabled: boolean;
  onClose: () => void;
  openProject: (project: Project) => void;
}) {
  const [mode, setMode] = useState<'open' | 'create'>('open');
  const [openPath, setOpenPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [picking, setPicking] = useState<'open' | 'parent' | null>(null);
  const [pickingNative, setPickingNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const createPath = parentPath && folderName.trim() ? joinPath(parentPath, folderName.trim()) : '';
  const targetPath = mode === 'open' ? openPath : createPath;
  const targetName = targetPath ? basename(targetPath) : '';

  const pickDirectory = async (target: 'open' | 'parent') => {
    setError('');
    const desktop = window.scholoomDesktop;
    if (!desktop) {
      setPicking(target);
      return;
    }
    setPickingNative(true);
    try {
      const remembered = readRememberedDirectory();
      const selected = await desktop.pickDirectory({
        title: target === 'open' ? '选择项目目录' : '选择新项目的父目录',
        ...(remembered ? { defaultPath: remembered } : {}),
      });
      if (!selected) return;
      rememberDirectory(selected);
      if (target === 'open') setOpenPath(selected);
      else setParentPath(selected);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setPickingNative(false);
    }
  };

  const submit = async () => {
    if (!targetPath) return;
    setBusy(true);
    setError('');
    try {
      const project =
        mode === 'open'
          ? await client.call('project.open', { path: targetPath })
          : await client.call('project.create', { path: targetPath });
      openProject(project);
      onClose();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const invalidFolderName =
    mode === 'create' &&
    folderName.trim() &&
    (/[\\/<>:"|?*\0]/.test(folderName) || ['.', '..'].includes(folderName.trim()));

  return (
    <Dialog title="添加项目" onClose={onClose} className="project-onboarding-dialog">
      {picking ? (
        <DirectoryPicker
          client={client}
          onCancel={() => setPicking(null)}
          onSelect={(path) => {
            rememberDirectory(path);
            if (picking === 'open') setOpenPath(path);
            else setParentPath(path);
            setPicking(null);
          }}
        />
      ) : (
        <form
          className="project-onboarding"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="project-onboarding__modes" role="tablist" aria-label="添加方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'open'}
              onClick={() => setMode('open')}
            >
              打开项目
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              onClick={() => setMode('create')}
            >
              新建项目
            </button>
          </div>
          {mode === 'open' ? (
            <div className="project-onboarding__field">
              <span>项目目录</span>
              <output aria-label="项目目录">{openPath || '未选择'}</output>
              <button
                type="button"
                className="btn"
                disabled={!enabled || busy || pickingNative}
                onClick={() => void pickDirectory('open')}
              >
                选择目录
              </button>
            </div>
          ) : (
            <>
              <div className="project-onboarding__field">
                <span>新建位置</span>
                <output aria-label="新建位置">{parentPath || '未选择'}</output>
                <button
                  type="button"
                  className="btn"
                  disabled={!enabled || busy || pickingNative}
                  onClick={() => void pickDirectory('parent')}
                >
                  选择父目录
                </button>
              </div>
              <label className="project-onboarding__name">
                新文件夹名称
                <input
                  aria-label="新文件夹名称"
                  value={folderName}
                  maxLength={200}
                  disabled={!enabled || busy}
                  onChange={(event) => setFolderName(event.target.value)}
                />
              </label>
            </>
          )}
          {targetName ? <p className="menu__hint">项目名将使用目录名：{targetName}</p> : null}
          {invalidFolderName ? <p role="alert">文件夹名称不能包含路径分隔符或保留字符。</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <button
              type="submit"
              className="btn"
              disabled={!enabled || busy || !targetPath || !!invalidFolderName}
              aria-busy={busy || undefined}
            >
              {mode === 'open' ? '打开项目' : '创建项目'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
