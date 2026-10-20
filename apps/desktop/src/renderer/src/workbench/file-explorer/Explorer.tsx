import {
  buildProxiedInstance,
  dragAndDropFeature,
  type FeatureImplementation,
  hotkeysCoreFeature,
  type ItemInstance,
  selectionFeature,
  syncDataLoaderFeature,
  type TreeInstance,
  type Updater,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import type { KernelClient } from '@scholoom/client';
import type {
  FileEntry,
  FileLocation,
  FileOperation,
  FileTransfer,
  Project,
  TransferSource,
} from '@scholoom/protocol';
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FileTarget } from '../session';
import {
  IconChevronRight,
  IconEdit,
  IconFolder,
  IconFolderOpen,
  IconMore,
  IconPaperclip,
  IconPlus,
} from '../shell/icons';
import { ConfirmAction, ContextMenu, MenuItem } from '../shell/menu';
import { useFileWatch } from '../useFileWatch';
import { useVirtualizedList } from '../useVirtualizedList';
import { encodeChunk, type ImportSelection, selectDrop, selectFiles } from './imports';

type Page = {
  entries: FileEntry[];
  next?: number;
  version?: string;
  offset: number;
  loading?: boolean;
  error?: string;
};
type View = {
  pages: Record<string, Page>;
  expanded: string[];
  selection: string[];
  focused: string | null;
  scroll: number;
};
type Node = FileEntry & { special?: 'more' | 'previous' | 'create'; parent?: string };
const viewportFocus: FeatureImplementation<Node> = {
  key: 'viewport-focus',
  overwrites: ['tree'],
  treeInstance: {
    updateDomFocus: ({ tree }) => {
      const pending = tree.getDataRef().current as { viewportFocusFrame?: number };
      cancelAnimationFrame(pending.viewportFocusFrame ?? 0);
      const item = tree.getFocusedItem();
      const root = tree.getElement();
      if (!item || !root) return;
      const id = item.getId();
      const deadline = performance.now() + 500;
      tree.getConfig().scrollToItem?.(item);
      const focus = () => {
        delete pending.viewportFocusFrame;
        if (
          tree.getElement() !== root ||
          tree.getFocusedItem()?.getId() !== id ||
          !root.isConnected
        )
          return;
        if (document.activeElement !== document.body && !root.contains(document.activeElement))
          return;
        const element = root.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`);
        if (element) element.focus({ preventScroll: true });
        else if (performance.now() < deadline)
          pending.viewportFocusFrame = requestAnimationFrame(focus);
      };
      focus();
    },
  },
  onTreeUnmount: (tree) => {
    const pending = tree.getDataRef().current as { viewportFocusFrame?: number };
    cancelAnimationFrame(pending.viewportFocusFrame ?? 0);
    delete pending.viewportFocusFrame;
  },
};
type Editing = {
  kind: 'file' | 'dir' | 'rename';
  parent: string;
  path?: string;
  fileId?: string;
  value: string;
  busy?: boolean;
  error?: string;
};
type Clipboard = { scope: string; mode: 'copy' | 'move'; sources: TransferSource[] };
const views = new Map<string, View>();
let clipboard: Clipboard | undefined;
const ROOT = '$root';
const NEW = '$create';
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
const childOf = (path: string, name: string) => (path ? `${path}/${name}` : name);
const keyOf = (entry: FileEntry) => entry.fileId ?? entry.path;
const message = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请重试或核查。';
const apply = <T,>(update: Updater<T>, current: T): T =>
  typeof update === 'function' ? (update as (value: T) => T)(current) : update;
const stateLabels: Record<FileTransfer['state'], string> = {
  uploading: '上传中',
  running: '传输中',
  conflict: '等待处理冲突',
  complete: '已完成',
  partial: '部分完成',
  cancelled: '已取消',
  unknown: '需要核查',
};

type ExplorerProps = {
  client: KernelClient;
  project: Project;
  revision: number;
  open: (target: FileTarget) => void;
  attach: (path: string, fileId?: string) => void;
  selected: string[];
  activeFile?: FileTarget | undefined;
  scope: string;
};
export function FileExplorer(props: ExplorerProps) {
  if (props.project.id === 'application') return <p>普通会话没有项目文件。</p>;
  return <ReadableExplorer {...props} />;
}
function ReadableExplorer({
  client,
  project,
  revision,
  open,
  attach,
  selected,
  activeFile,
  scope,
}: ExplorerProps) {
  const hasFiles = project.id !== 'application';
  const viewKey = `${scope}:${project.id}`;
  const [view, setView] = useState<View>(
    () =>
      views.get(viewKey) ?? { pages: {}, expanded: [], selection: [], focused: null, scroll: 0 },
  );
  const viewRef = useRef(view);
  viewRef.current = view;
  const [editing, setEditing] = useState<Editing>();
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const closeMenu = useCallback(() => setMenu(undefined), []);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState<{
    operationId: string;
    entryId: string;
    basis: string;
    path: string;
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [operations, setOperations] = useState<FileOperation[]>([]);
  const [trash, setTrash] = useState<{ entries: FileLocation[]; next?: number }>();
  const [trashOpen, setTrashOpen] = useState(false);
  const [task, setTask] = useState<FileTransfer>();
  const taskId = useRef<string | undefined>(undefined);
  const [taskPage, setTaskPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const directoryPicker = useRef<HTMLInputElement>(null);
  const treeRef = useRef<TreeInstance<Node> | null>(null);
  const copyDrag = useRef(false);
  const scrollTo = useRef<(index: number) => void>(() => {});
  const requests = useRef(new Map<string, number>());
  const alive = useRef(true);
  const epoch = useRef(0);
  const typeahead = useRef({ text: '', at: 0 });
  const [rowHeight, setRowHeight] = useState(28);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const height = Number.parseFloat(
      getComputedStyle(node).getPropertyValue('--file-tree-row-height'),
    );
    if (height) setRowHeight(height);
    node.scrollTop = viewRef.current.scroll;
  }, []);
  useEffect(() => {
    views.set(viewKey, view);
  }, [view, viewKey]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current++;
      requests.current.clear();
    };
  }, []);

  const load = useCallback(
    async (path: string, offset = 0, anchor?: string, prepend = false) => {
      const generation = epoch.current;
      const token = (requests.current.get(path) ?? 0) + 1;
      requests.current.set(path, token);
      const old = viewRef.current.pages[path];
      setView((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [path]: {
            entries: old?.entries ?? [],
            offset: old?.offset ?? 0,
            ...old,
            loading: true,
            error: '',
          },
        },
      }));
      try {
        const page = await client.call('files.list', {
          projectId: project.id,
          path,
          offset,
          limit: 100,
          ...((offset || prepend) && old?.version ? { version: old.version } : {}),
          ...(anchor === undefined ? {} : { anchor }),
        });
        if (!alive.current || generation !== epoch.current || requests.current.get(path) !== token)
          return;
        setView((current) => {
          const pages = { ...current.pages };
          // Carry cached descendants with their stable directory identities after a rename.
          for (const entry of page.entries) {
            const previous = current.pages[path]?.entries.find(
              (item) => item.fileId && item.fileId === entry.fileId,
            );
            if (!previous || previous.path === entry.path || entry.kind !== 'dir') continue;
            for (const [key, value] of Object.entries(pages))
              if (key === previous.path || key.startsWith(`${previous.path}/`)) {
                delete pages[key];
                pages[entry.path + key.slice(previous.path.length)] = {
                  ...value,
                  entries: value.entries.map((item) => ({
                    ...item,
                    path: entry.path + item.path.slice(previous.path.length),
                  })),
                };
              }
          }
          const cached = current.pages[path];
          const unchanged =
            !offset && !anchor && !prepend && !!cached?.version && cached.version === page.version;
          const next = unchanged || prepend ? cached?.next : page.nextOffset;
          pages[path] = {
            entries: unchanged
              ? cached.entries
              : prepend
                ? [...page.entries, ...(current.pages[path]?.entries ?? [])]
                : offset && !anchor
                  ? [...(current.pages[path]?.entries ?? []), ...page.entries]
                  : page.entries,
            offset: unchanged
              ? cached.offset
              : offset && !anchor && !prepend
                ? (current.pages[path]?.offset ?? 0)
                : (page.offset ?? offset),
            ...(page.version ? { version: page.version } : {}),
            ...(next === undefined ? {} : { next }),
          };
          return { ...current, pages };
        });
        return page.entries;
      } catch (reason) {
        if (!alive.current || generation !== epoch.current || requests.current.get(path) !== token)
          return;
        if (offset && (reason as { code?: string }).code === 'contentChanged') {
          void load(path);
          return;
        }
        setView((current) => ({
          ...current,
          pages: {
            ...current.pages,
            [path]: {
              ...(current.pages[path] ?? { entries: [], offset: 0 }),
              loading: false,
              error: message(reason),
            },
          },
        }));
      }
    },
    [client, project.id],
  );
  const createKind = editing?.kind === 'rename' ? undefined : editing?.kind;
  const createParent = editing?.parent;
  const nodes = useMemo(() => {
    const map = new Map<string, Node>([[ROOT, { name: project.name, kind: 'dir', path: '' }]]);
    for (const [path, page] of Object.entries(view.pages)) {
      for (const entry of page.entries) map.set(keyOf(entry), entry);
      if (page.offset > 0)
        map.set(`$previous:${path}`, {
          name: '前面的文件',
          kind: 'file',
          path: `$previous:${path}`,
          special: 'previous',
          parent: path,
        });
      if (page.next !== undefined)
        map.set(`$more:${path}`, {
          name: '更多文件',
          kind: 'file',
          path: `$more:${path}`,
          special: 'more',
          parent: path,
        });
    }
    if (createKind)
      map.set(NEW, {
        name: '新建条目',
        kind: createKind,
        path: NEW,
        special: 'create',
        parent: createParent!,
      });
    return map;
  }, [view.pages, project.name, createKind, createParent]);
  const chosen = view.selection
    .map((id) => nodes.get(id))
    .filter((item): item is Node => !!item && !item.special);
  const focused = nodes.get(view.focused ?? '');
  const destination =
    focused && !focused.special
      ? focused.kind === 'dir'
        ? focused.path
        : parentOf(focused.path)
      : '';
  const updateExpanded = (update: Updater<string[]>) =>
    setView((current) => ({ ...current, expanded: apply(update, current.expanded) }));
  const updateSelected = (update: Updater<string[]>) =>
    setView((current) => ({
      ...current,
      selection: apply(update, current.selection).filter((id) => !nodes.get(id)?.special),
    }));
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      return true;
    } catch (reason) {
      setError(message(reason));
      return false;
    }
  }, []);
  const refresh = useCallback(() => {
    for (const path of Object.keys(viewRef.current.pages)) void load(path);
    if (!viewRef.current.pages['']) void load('');
  }, [load]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: broad project revisions invalidate the loaded directory cache.
  useEffect(() => {
    if (hasFiles) refresh();
  }, [hasFiles, revision, refresh]);
  const selectClipboard = (mode: Clipboard['mode']) => {
    const entries = chosen.length ? chosen : focused && !focused.special ? [focused] : [];
    clipboard = {
      scope,
      mode,
      sources: entries.flatMap((item) =>
        item.fileId ? [{ projectId: project.id, path: item.path, fileId: item.fileId }] : [],
      ),
    };
    setView((current) => ({ ...current }));
  };
  const setCurrentTask = (value: FileTransfer) => {
    taskId.current = value.id;
    setTask(value);
    try {
      localStorage.setItem(`scholoom.transfer:${viewKey}`, value.id);
    } catch {}
  };
  const transfer = async (sources: TransferSource[], mode: 'copy' | 'move', path: string) => {
    if (!sources.length) return;
    const operationId = crypto.randomUUID();
    taskId.current = operationId;
    // Keep the request identity before sending, so an unknown outcome can be checked.
    try {
      localStorage.setItem(`scholoom.transfer:${viewKey}`, operationId);
    } catch {}
    try {
      const value = await client.call('files.transfer', {
        projectId: project.id,
        operationId,
        destination: path,
        mode,
        sources,
      });
      setTaskPage(0);
      setCurrentTask(value);
    } catch (reason) {
      if ((reason as { code?: string }).code === 'outcomeUnknown')
        setCurrentTask({
          id: operationId,
          projectId: project.id,
          state: 'unknown',
          total: sources.length,
          completed: 0,
          entries: [],
        });
      throw reason;
    }
    if (mode === 'move') clipboard = undefined;
  };
  const paste = () =>
    run(async () => {
      if (clipboard?.scope === scope)
        await transfer(clipboard.sources, clipboard.mode, destination);
    });
  const beginEdit = (kind: Editing['kind']) => {
    if (!hasFiles || (kind === 'rename' && !focused)) return;
    setEditing({
      kind,
      parent: kind === 'rename' ? parentOf(focused!.path) : destination,
      ...(kind === 'rename'
        ? { path: focused!.path, ...(focused!.fileId ? { fileId: focused!.fileId } : {}) }
        : {}),
      value: kind === 'rename' ? focused!.name : '',
    });
    if (kind !== 'rename' && destination) {
      const folder = [...nodes.values()].find((entry) => entry.path === destination);
      if (folder) updateExpanded((current) => [...new Set([...current, keyOf(folder)])]);
    }
    setMenu(undefined);
  };
  const commitEdit = async () => {
    const edit = editing;
    if (!edit || edit.busy) return;
    const name = edit.value;
    if (!name.trim() || name === '.' || name === '..' || /[/\\]/.test(name)) {
      setEditing({ ...edit, error: '请输入一个有效的文件或目录名称。' });
      return;
    }
    setEditing({ ...edit, busy: true, error: '' });
    try {
      const path = childOf(edit.parent, name);
      if (edit.kind === 'file') {
        await client.call('files.save', { projectId: project.id, path, content: '' });
        const page = await client.call('files.list', {
          projectId: project.id,
          path: edit.parent,
          anchor: name,
          limit: 100,
        });
        const entry = page.entries.find((item) => item.path === path);
        open({
          projectId: project.id,
          path,
          ...(entry?.fileId ? { fileId: entry.fileId } : {}),
          openMode: 'permanent',
        });
      } else {
        const operationId = crypto.randomUUID();
        try {
          const operation =
            edit.kind === 'dir'
              ? await client.call('files.mkdir', { projectId: project.id, path, operationId })
              : await client.call('files.rename', {
                  projectId: project.id,
                  path: edit.path!,
                  name,
                  operationId,
                  ...(edit.fileId ? { expectedFileId: edit.fileId } : {}),
                });
          if (operation.state !== 'complete') {
            setOperations((current) => [...current, operation]);
            throw new Error('操作尚未确认，请核查原回执。');
          }
        } catch (reason) {
          if ((reason as { code?: string }).code === 'outcomeUnknown')
            setOperations((current) => [
              ...current,
              {
                id: operationId,
                path: edit.path ?? path,
                kind: edit.kind === 'dir' ? 'mkdir' : 'rename',
                state: 'unknown',
              },
            ]);
          throw reason;
        }
      }
      setEditing(undefined);
      const entries = await load(edit.parent, 0, name);
      const created = entries?.find((entry) => entry.name === name);
      setView((current) => ({
        ...current,
        focused: created ? keyOf(created) : null,
        selection: created ? [keyOf(created)] : current.selection,
      }));
      if (edit.kind !== 'file') requestAnimationFrame(() => treeRef.current?.updateDomFocus());
    } catch (reason) {
      if (alive.current) setEditing({ ...edit, error: message(reason) });
    }
  };
  const doTrash = async () => {
    const entries = chosen.length ? chosen : focused && !focused.special ? [focused] : [];
    setBusy(true);
    const success = await run(async () => {
      for (const entry of entries.filter(
        (entry) =>
          !entries.some((parent) => parent !== entry && entry.path.startsWith(`${parent.path}/`)),
      )) {
        const operationId = crypto.randomUUID();
        try {
          const value = await client.call('files.trash', {
            projectId: project.id,
            path: entry.path,
            operationId,
            ...(entry.fileId ? { expectedFileId: entry.fileId } : {}),
          });
          if (value.state !== 'complete') setOperations((current) => [...current, value]);
        } catch (reason) {
          if ((reason as { code?: string }).code === 'outcomeUnknown')
            setOperations((current) => [
              ...current,
              { id: operationId, path: entry.path, kind: 'trash', state: 'unknown' },
            ]);
          throw reason;
        }
      }
      refresh();
      setTrash(undefined);
    });
    setBusy(false);
    if (success) {
      setConfirming(false);
      setMenu(undefined);
    }
    return success;
  };
  const importSelection = async (selection: ImportSelection, path: string) => {
    if (!selection.entries.length) return;
    setUploading(true);
    const operationId = crypto.randomUUID();
    taskId.current = operationId;
    try {
      localStorage.setItem(`scholoom.transfer:${viewKey}`, operationId);
    } catch {}
    try {
      const value = await client.call('files.importBegin', {
        projectId: project.id,
        operationId,
        destination: path,
        entries: selection.entries,
      });
      setCurrentTask(value);
      for (const [name, file] of selection.files) {
        for (let offset = 0; offset < file.size; offset += 262144) {
          await client.call('files.importChunk', {
            projectId: project.id,
            operationId,
            path: name,
            offset,
            base64: encodeChunk(
              new Uint8Array(await file.slice(offset, offset + 262144).arrayBuffer()),
            ),
          });
        }
      }
      setCurrentTask(
        await client.call('files.importFinish', { projectId: project.id, operationId }),
      );
    } finally {
      if (alive.current) setUploading(false);
    }
  };
  const tree = useTree<Node>({
    rootItemId: ROOT,
    onTreeHotkey: (_name, event) => event.preventDefault(),
    instanceBuilder: buildProxiedInstance,
    state: {
      expandedItems: view.expanded,
      selectedItems: view.selection,
      focusedItem: view.focused,
    },
    setExpandedItems: updateExpanded,
    setSelectedItems: updateSelected,
    setFocusedItem: (update) =>
      setView((current) => ({ ...current, focused: apply(update, current.focused) })),
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === 'dir',
    dataLoader: {
      getItem: (id) => nodes.get(id) ?? { name: '', path: id, kind: 'file' },
      getChildren: (id) => {
        const path = nodes.get(id)?.path ?? '';
        const page = view.pages[path];
        return [
          ...(editing && editing.kind !== 'rename' && editing.parent === path ? [NEW] : []),
          ...(page && page.offset > 0 ? [`$previous:${path}`] : []),
          ...(page?.entries.map(keyOf) ?? []),
          ...(page?.next === undefined ? [] : [`$more:${path}`]),
        ];
      },
    },
    scrollToItem: (item) => {
      const index =
        treeRef.current?.getItems().findIndex((value) => value.getId() === item.getId()) ?? -1;
      if (index >= 0) scrollTo.current(index);
    },
    canReorder: false,
    canDrag: (items) => hasFiles && items.every((item) => !!item.getItemData().fileId),
    canDrop: (items, target) =>
      hasFiles &&
      target.item.isFolder() &&
      !items.some(
        (item) =>
          target.item.getItemData().path === item.getItemData().path ||
          target.item.getItemData().path.startsWith(`${item.getItemData().path}/`),
      ),
    onDrop: (items, target) =>
      run(() =>
        transfer(
          items.flatMap((item) => {
            const entry = item.getItemData();
            return entry.fileId
              ? [{ projectId: project.id, path: entry.path, fileId: entry.fileId }]
              : [];
          }),
          copyDrag.current ? 'copy' : 'move',
          target.item.getItemData().path,
        ),
      ).then(() => {}),
    canDragForeignDragObjectOver: (data, target) =>
      hasFiles && target.item.isFolder() && data.types.includes('Files'),
    canDropForeignDragObject: (data, target) =>
      hasFiles && target.item.isFolder() && data.types.includes('Files'),
    onDropForeignDragObject: (data, target) => {
      const selection = selectDrop(data);
      return run(async () => importSelection(await selection, target.item.getItemData().path)).then(
        () => {},
      );
    },
    openOnDropDelay: 600,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
      viewportFocus,
    ],
  });
  treeRef.current = tree;
  const registerViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewport.current = node;
      tree.registerElement(node);
    },
    [tree],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Headless Tree must rebuild its imperative cache when the loader data changes.
  useLayoutEffect(() => {
    tree.rebuildTree();
  }, [tree, nodes, view.pages, editing?.kind, editing?.parent]);
  const items = tree.getItems();
  const virtual = useVirtualizedList(items.length, {
    rowHeight,
    containerRef: viewport,
    overscanCount: 5,
  });
  scrollTo.current = virtual.scrollToIndex;
  const [start, end] = virtual.visibleRange;
  useEffect(() => {
    for (const id of view.expanded) {
      const entry = nodes.get(id);
      if (entry?.kind === 'dir' && !view.pages[entry.path]) void load(entry.path);
    }
  }, [view.expanded, nodes, view.pages, load]);
  const watchPaths = [
    '',
    ...view.expanded.flatMap((id) => {
      const item = nodes.get(id);
      return item?.kind === 'dir' ? [item.path] : [];
    }),
  ];
  const watchError = useFileWatch(
    client,
    project.id,
    watchPaths,
    (paths) => {
      for (const path of Object.keys(viewRef.current.pages))
        if (
          paths.some(
            (item) => item === path || parentOf(item) === path || path.startsWith(item + '/'),
          )
        )
          void load(path);
    },
    refresh,
  );
  const activeProjectId = activeFile?.projectId;
  const activePath = activeFile?.path;
  const activeFileId = activeFile?.fileId;
  useEffect(() => {
    if (!activePath || activeProjectId !== project.id) return;
    let stopped = false;
    void run(async () => {
      let path = activePath;
      if (activeFileId) {
        const location = (
          await client.call('files.resolve', {
            projectId: project.id,
            fileIds: [activeFileId],
          })
        )[0];
        if (location?.state !== 'present') return;
        path = location.path;
      }
      const parts = path.split('/');
      let parent = '';
      for (let index = 0; index < parts.length; index++) {
        const name = parts[index]!;
        const existing = viewRef.current.pages[parent]?.entries.find(
          (entry) => entry.name === name,
        );
        const page = existing
          ? undefined
          : await client.call('files.list', {
              projectId: project.id,
              path: parent,
              anchor: name,
              limit: 100,
            });
        if (stopped) return;
        const entry = existing ?? page?.entries.find((item) => item.name === name);
        if (!entry) return;
        const id = keyOf(entry);
        const currentParent = parent;
        setView((current) => ({
          ...current,
          ...(page
            ? {
                pages: {
                  ...current.pages,
                  [currentParent]: {
                    entries: page.entries,
                    offset: page.offset ?? 0,
                    ...(page.nextOffset === undefined ? {} : { next: page.nextOffset }),
                    ...(page.version ? { version: page.version } : {}),
                  },
                },
              }
            : {}),
          expanded:
            index < parts.length - 1 ? [...new Set([...current.expanded, id])] : current.expanded,
        }));
        if (index === parts.length - 1) {
          requestAnimationFrame(() => {
            const target =
              treeRef.current?.getItems().findIndex((item) => item.getId() === id) ?? -1;
            if (target >= 0) scrollTo.current(target);
          });
        }
        parent = childOf(parent, name);
      }
    });
    return () => {
      stopped = true;
    };
  }, [activeFileId, activePath, activeProjectId, project.id, client, run]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let id = task?.id;
    if (!id) {
      try {
        id = localStorage.getItem(`scholoom.transfer:${viewKey}`) ?? undefined;
      } catch {}
    }
    if (!id) return;
    const operationId = id;
    taskId.current = operationId;
    const poll = async () => {
      try {
        const result = await client.call('files.transferStatus', {
          projectId: project.id,
          operationId,
          offset: taskPage,
          limit: 100,
        });
        if (stopped || taskId.current !== operationId) return;
        setTask(result);
        if (['running', 'uploading'].includes(result.state))
          timer = setTimeout(() => void poll(), 400);
        else refresh();
      } catch (reason) {
        if (!stopped) setError(message(reason));
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [client, project.id, task?.id, taskPage, viewKey, refresh]);

  const loadTrash = async (offset = 0) => {
    const value = await client.call('files.trashList', {
      projectId: project.id,
      offset,
      limit: 100,
    });
    setTrash((previous) => ({
      entries: offset ? [...(previous?.entries ?? []), ...value.entries] : value.entries,
      ...(value.nextOffset === undefined ? {} : { next: value.nextOffset }),
    }));
  };
  const openMenu = (position: { x: number; y: number }, item?: ItemInstance<Node>) => {
    if (item) {
      item.setFocused();
      if (!item.isSelected()) tree.setSelectedItems([item.getId()]);
    }
    setConfirming(false);
    setError('');
    setMenu(position);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input,textarea')) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape' && editing) {
      event.preventDefault();
      event.stopPropagation();
      setEditing(undefined);
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      openMenu({ x: rect.left, y: rect.bottom });
      return;
    }
    if (modifier && ['c', 'x', 'v', 'a'].includes(key)) {
      if (key === 'v' && clipboard?.scope !== scope) return;
      event.preventDefault();
      event.stopPropagation();
      if (key === 'a')
        tree.setSelectedItems(
          tree
            .getItems()
            .filter((item) => !item.getItemData().special)
            .map((item) => item.getId()),
        );
      else if (key === 'v') void paste();
      else selectClipboard(key === 'c' ? 'copy' : 'move');
      return;
    }
    if (event.key === 'F2' && hasFiles) {
      event.preventDefault();
      beginEdit('rename');
      return;
    }
    if ((event.key === 'Delete' || (event.metaKey && event.key === 'Backspace')) && hasFiles) {
      event.preventDefault();
      setConfirming(true);
      return;
    }
    if (event.key === 'Enter' && focused) {
      event.preventDefault();
      if (focused.special === 'more') void load(focused.parent!, view.pages[focused.parent!]?.next);
      else if (focused.special === 'previous')
        void load(
          focused.parent!,
          Math.max(0, (view.pages[focused.parent!]?.offset ?? 0) - 100),
          undefined,
          true,
        );
      else if (focused.kind === 'file')
        open({
          projectId: project.id,
          path: focused.path,
          ...(focused.fileId ? { fileId: focused.fileId } : {}),
          openMode: 'permanent',
        });
      else tree.getItemInstance(keyOf(focused)).expand();
      return;
    }
    if (!modifier && !event.altKey && event.key.length === 1 && event.key !== ' ') {
      const now = Date.now();
      typeahead.current = {
        text: now - typeahead.current.at < 700 ? typeahead.current.text + key : key,
        at: now,
      };
      const item = items.find((value) =>
        value.getItemName().toLowerCase().startsWith(typeahead.current.text),
      );
      if (item) {
        item.setFocused();
        tree.updateDomFocus();
      }
    }
  };
  const renderRow = (item: ItemInstance<Node>, index: number) => {
    const entry = item.getItemData();
    const props = item.getProps();
    const edit =
      editing && (entry.special === 'create' || editing.path === entry.path) ? editing : undefined;
    const active =
      activeFile?.projectId === project.id &&
      (entry.fileId ? entry.fileId === activeFile.fileId : entry.path === activeFile.path);
    return (
      <div
        {...props}
        role="treeitem"
        tabIndex={item.isFocused() ? 0 : -1}
        key={item.getId()}
        data-file-path={entry.path}
        data-tree-id={item.getId()}
        onKeyDown={props.onKeyDown}
        onFocus={() => {
          if (viewRef.current.focused !== item.getId()) item.setFocused();
        }}
        aria-busy={(entry.kind === 'dir' && view.pages[entry.path]?.loading) || undefined}
        aria-label={
          entry.special
            ? entry.special === 'more'
              ? `更多文件 ${entry.parent || '项目根目录'}`
              : entry.special === 'previous'
                ? `前面的文件 ${entry.parent || '项目根目录'}`
                : '新建条目'
            : `${entry.kind === 'dir' ? '进入目录' : '打开文件'} ${entry.path}`
        }
        className={`explorer-row${item.isSelected() ? ' explorer-row--selected' : ''}${item.isFocused() ? ' explorer-row--focused' : ''}${active ? ' explorer-row--active' : ''}${item.isDragTarget() ? ' explorer-row--drop' : ''}${clipboard?.scope === scope && clipboard.mode === 'move' && clipboard.sources.some((source) => source.projectId === project.id && source.fileId === entry.fileId) ? ' explorer-row--cut' : ''}`}
        style={
          { top: virtual.offsetTop(index), '--depth': item.getItemMeta().level } as CSSProperties
        }
        onClick={(event) => {
          if (edit) return;
          props.onClick?.(event);
          if (entry.special === 'more') void load(entry.parent!, view.pages[entry.parent!]?.next);
          else if (entry.special === 'previous')
            void load(
              entry.parent!,
              Math.max(0, (view.pages[entry.parent!]?.offset ?? 0) - 100),
              undefined,
              true,
            );
          else if (entry.kind === 'file' && !event.ctrlKey && !event.metaKey && !event.shiftKey)
            open({
              projectId: project.id,
              path: entry.path,
              ...(entry.fileId ? { fileId: entry.fileId } : {}),
              openMode: 'preview',
            });
        }}
        onDoubleClick={() => {
          if (!entry.special && entry.kind === 'file')
            open({
              projectId: project.id,
              path: entry.path,
              ...(entry.fileId ? { fileId: entry.fileId } : {}),
              openMode: 'permanent',
            });
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
          if (!entry.special) openMenu({ x: event.clientX, y: event.clientY }, item);
        }}
      >
        <span className={`explorer-chevron${item.isExpanded() ? ' explorer-chevron--open' : ''}`}>
          {entry.kind === 'dir' ? <IconChevronRight /> : null}
        </span>
        <span className="explorer-icon">
          {entry.kind === 'dir' ? (
            item.isExpanded() ? (
              <IconFolderOpen />
            ) : (
              <IconFolder />
            )
          ) : (
            <IconEdit />
          )}
        </span>
        {edit ? (
          <form
            className="explorer-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void commitEdit();
            }}
          >
            <input
              ref={(node) => {
                if (node && document.activeElement !== node && !edit.busy) {
                  node.focus();
                  if (edit.kind === 'rename')
                    node.setSelectionRange(
                      0,
                      Math.max(0, edit.value.lastIndexOf('.')) || edit.value.length,
                    );
                }
              }}
              aria-label={
                edit.kind === 'rename' ? '新名称' : edit.kind === 'dir' ? '新建目录名' : '新文件名'
              }
              value={edit.value}
              disabled={edit.busy}
              onChange={(event) => setEditing({ ...edit, value: event.target.value, error: '' })}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setEditing(undefined);
                  tree.updateDomFocus();
                }
              }}
            />
          </form>
        ) : (
          <span className="explorer-name" title={entry.path}>
            {entry.name}
          </span>
        )}
        {selected.includes(entry.path) ? (
          <span className="explorer-attached" role="img" aria-label={`已附加 ${entry.path}`}>
            <IconPaperclip />
          </span>
        ) : null}
      </div>
    );
  };
  const menuEntries = chosen.length ? chosen : focused && !focused.special ? [focused] : [];
  return (
    <div className="file-explorer">
      <header className="explorer-toolbar">
        <button
          type="button"
          className="explorer-root"
          onClick={() => {
            tree.setSelectedItems([]);
            setView((current) => ({ ...current, focused: null }));
          }}
          onDragOver={(event) => {
            if (hasFiles) {
              event.preventDefault();
              copyDrag.current = event.ctrlKey || event.altKey;
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!hasFiles) return;
            if (event.dataTransfer.types.includes('Files')) {
              const input = selectDrop(event.dataTransfer);
              void run(async () => importSelection(await input, ''));
            } else {
              const dragged = tree.getState().dnd?.draggedItems ?? [];
              void run(() =>
                transfer(
                  dragged.flatMap((item) => {
                    const entry = item.getItemData();
                    return entry.fileId
                      ? [{ projectId: project.id, path: entry.path, fileId: entry.fileId }]
                      : [];
                  }),
                  copyDrag.current ? 'copy' : 'move',
                  '',
                ),
              );
            }
          }}
          title={project.path}
        >
          {project.name}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label="新建文件"
          title="新建文件"
          disabled={!hasFiles}
          onClick={() => beginEdit('file')}
        >
          <IconPlus />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label="新建目录"
          title="新建目录"
          disabled={!hasFiles}
          onClick={() => beginEdit('dir')}
        >
          <IconFolder />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label="刷新文件"
          title="刷新文件"
          onClick={refresh}
        >
          ↻
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label="全部折叠"
          title="全部折叠"
          onClick={() => updateExpanded([])}
        >
          ⌃
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label="文件操作"
          title="文件操作"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            openMenu({ x: rect.left, y: rect.bottom });
          }}
        >
          <IconMore />
        </button>
      </header>
      <div
        {...tree.getContainerProps('项目文件树')}
        role="tree"
        tabIndex={
          items.slice(start, end + 1).some((item) => item.getId() === view.focused) ? -1 : 0
        }
        ref={registerViewport}
        className="explorer-viewport"
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          const previous = items.find((item) => item.getId() === viewRef.current.focused);
          const current = previous?.getElement() ? previous : items[start];
          if (current) {
            current.setFocused();
            current.getElement()?.focus();
          }
        }}
        onKeyDownCapture={onKey}
        onPaste={(event) => {
          if (hasFiles && event.clipboardData.files.length) {
            event.preventDefault();
            const files = Array.from(event.clipboardData.files);
            void run(() => importSelection(selectFiles(files), destination));
          }
        }}
        onScroll={(event) => {
          viewRef.current.scroll = event.currentTarget.scrollTop;
          views.set(viewKey, viewRef.current);
        }}
        onDragOverCapture={(event) => {
          copyDrag.current = /Mac/.test(navigator.platform) ? event.altKey : event.ctrlKey;
          const node = viewport.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          if (event.clientY < rect.top + rowHeight) node.scrollTop -= rowHeight;
          else if (event.clientY > rect.bottom - rowHeight) node.scrollTop += rowHeight;
        }}
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            openMenu({ x: event.clientX, y: event.clientY });
          }
        }}
      >
        <div className="explorer-window" style={{ height: virtual.totalHeight }}>
          {items.slice(start, end + 1).map((item, index) => renderRow(item, start + index))}
        </div>
        {!items.length ? (
          <p className="empty-hint">{view.pages['']?.loading ? '正在读取文件…' : '暂无文件'}</p>
        ) : null}
      </div>
      {watchError ? (
        <p role="status" className="explorer-feedback">
          自动更新暂不可用：{watchError}
        </p>
      ) : null}
      {editing?.error ? (
        <p role="alert" className="explorer-feedback">
          {editing.error}
        </p>
      ) : null}
      {Object.entries(view.pages)
        .filter(([, page]) => !!page.error)
        .map(([path, page]) => (
          <p role="alert" key={path} className="explorer-feedback">
            {path || '项目目录'}：{page.error}{' '}
            <button type="button" onClick={() => void load(path)}>
              重试
            </button>
          </p>
        ))}
      {menu ? (
        <ContextMenu label="文件操作菜单" position={menu} onClose={closeMenu}>
          <MenuItem
            disabled={menuEntries.length !== 1}
            onSelect={() => {
              const entry = menuEntries[0]!;
              if (entry.kind === 'file')
                open({
                  projectId: project.id,
                  path: entry.path,
                  ...(entry.fileId ? { fileId: entry.fileId } : {}),
                  openMode: 'permanent',
                });
              else tree.getItemInstance(keyOf(entry)).expand();
            }}
          >
            打开
          </MenuItem>
          <MenuItem disabled={!hasFiles} onSelect={() => beginEdit('file')}>
            新建文件
          </MenuItem>
          <MenuItem disabled={!hasFiles} onSelect={() => beginEdit('dir')}>
            新建目录
          </MenuItem>
          <MenuItem
            disabled={!hasFiles || menuEntries.length !== 1}
            onSelect={() => beginEdit('rename')}
          >
            重命名　F2
          </MenuItem>
          <MenuItem disabled={!menuEntries.length} onSelect={() => selectClipboard('copy')}>
            复制
          </MenuItem>
          <MenuItem
            disabled={!hasFiles || !menuEntries.length}
            onSelect={() => selectClipboard('move')}
          >
            剪切
          </MenuItem>
          <MenuItem disabled={!hasFiles || clipboard?.scope !== scope} onSelect={paste}>
            粘贴
          </MenuItem>
          <MenuItem
            disabled={!menuEntries.length}
            onSelect={() =>
              run(async () =>
                navigator.clipboard.writeText(menuEntries.map((entry) => entry.path).join('\n')),
              )
            }
          >
            复制相对路径
          </MenuItem>
          <MenuItem
            disabled={!menuEntries.some((entry) => entry.kind === 'file')}
            onSelect={() => {
              for (const entry of menuEntries)
                if (entry.kind === 'file') attach(entry.path, entry.fileId);
            }}
          >
            附加／移除会话材料
          </MenuItem>
          <MenuItem disabled={!hasFiles || uploading} onSelect={() => picker.current?.click()}>
            导入文件…
          </MenuItem>
          <MenuItem
            disabled={!hasFiles || uploading}
            onSelect={() => directoryPicker.current?.click()}
          >
            导入目录…
          </MenuItem>
          <MenuItem
            disabled={!hasFiles || !menuEntries.length}
            onSelect={() => {
              setConfirming(true);
              return false;
            }}
          >
            回收
          </MenuItem>
          {error ? <p role="alert">{error}</p> : null}
        </ContextMenu>
      ) : null}
      {confirming ? (
        <ConfirmAction
          description={`确认回收 ${menuEntries.map((entry) => entry.path).join('、')}（目录包含全部内容）？可在回收站恢复，草稿保留。`}
          confirmLabel="确认回收"
          busy={busy}
          onConfirm={doTrash}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {replacing ? (
        <ConfirmAction
          description={`确认回收原目标 ${replacing.path} 并替换？原内容可从回收站恢复。`}
          confirmLabel="确认替换"
          busy={busy}
          onCancel={() => setReplacing(undefined)}
          onConfirm={async () => {
            setBusy(true);
            const success = await run(async () =>
              setCurrentTask(
                await client.call('files.transferDecide', {
                  projectId: project.id,
                  operationId: replacing.operationId,
                  entryId: replacing.entryId,
                  basis: replacing.basis,
                  decision: 'replace',
                }),
              ),
            );
            setBusy(false);
            if (success) setReplacing(undefined);
            return success;
          }}
        />
      ) : null}
      <input
        hidden
        type="file"
        multiple
        ref={picker}
        aria-label="导入文件"
        onChange={(event) => {
          const files = event.target.files;
          if (files) {
            const selectedFiles = Array.from(files);
            void run(() => importSelection(selectFiles(selectedFiles), destination));
          }
          event.target.value = '';
        }}
      />
      <input
        hidden
        type="file"
        multiple
        ref={(node) => {
          directoryPicker.current = node;
          node?.setAttribute('webkitdirectory', '');
        }}
        aria-label="导入目录"
        onChange={(event) => {
          const files = event.target.files;
          if (files) {
            const selectedFiles = Array.from(files);
            void run(() => importSelection(selectFiles(selectedFiles), destination));
          }
          event.target.value = '';
        }}
      />
      {task ? (
        <section className="explorer-transfer" aria-label="文件传输">
          <div role="status">
            {stateLabels[task.state]} · {task.completed}/{task.total}
          </div>
          {[
            ...(task.conflict ? [task.conflict] : []),
            ...task.entries.filter(
              (entry) =>
                entry.id !== task.conflict?.id &&
                (entry.state === 'conflict' ||
                  entry.state === 'failed' ||
                  entry.state === 'unknown' ||
                  entry.state === 'skipped'),
            ),
          ].map((entry) => (
            <div key={entry.id} className="explorer-transfer-entry">
              <span>
                {entry.destination} ·{' '}
                {entry.state === 'conflict' ? '目标已存在' : (entry.error ?? entry.state)}
              </span>
              {entry.state === 'conflict' && entry.basis ? (
                <div className="explorer-decisions">
                  {(['skip', 'keepBoth', 'replace'] as const).map((decision) => (
                    <button
                      type="button"
                      className="btn"
                      key={decision}
                      disabled={!hasFiles}
                      onClick={() => {
                        if (decision === 'replace') {
                          setReplacing({
                            operationId: task.id,
                            entryId: entry.id,
                            basis: entry.basis!,
                            path: entry.destination,
                          });
                          return;
                        }
                        void run(async () =>
                          setCurrentTask(
                            await client.call('files.transferDecide', {
                              projectId: project.id,
                              operationId: task.id,
                              entryId: entry.id,
                              basis: entry.basis!,
                              decision,
                            }),
                          ),
                        );
                      }}
                    >
                      {decision === 'skip'
                        ? '跳过'
                        : decision === 'keepBoth'
                          ? '保留两份'
                          : '回收原目标并替换'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {task.error ? <p role="alert">{task.error}</p> : null}
          {task.nextOffset !== undefined ? (
            <button type="button" className="btn" onClick={() => setTaskPage(task.nextOffset!)}>
              更多传输项
            </button>
          ) : taskPage > 0 ? (
            <button type="button" className="btn" onClick={() => setTaskPage(0)}>
              返回首批
            </button>
          ) : null}
          {['running', 'uploading', 'conflict', 'unknown', 'partial'].includes(task.state) ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                void run(async () =>
                  setCurrentTask(
                    await client.call('files.transferCancel', {
                      projectId: project.id,
                      operationId: task.id,
                    }),
                  ),
                )
              }
            >
              {task.state === 'partial' ? '清理暂存' : '取消传输'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() =>
              void run(async () =>
                setCurrentTask(
                  await client.call('files.transferStatus', {
                    projectId: project.id,
                    operationId: task.id,
                  }),
                ),
              )
            }
          >
            核查传输
          </button>
        </section>
      ) : null}
      {operations.map((operation) => (
        <div key={operation.id} className="explorer-feedback" role="status">
          {operation.path} · 待核查{' '}
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const value = await client.call('files.operation', {
                  projectId: project.id,
                  operationId: operation.id,
                });
                setOperations((current) =>
                  value.state === 'complete'
                    ? current.filter((item) => item.id !== value.id)
                    : current.map((item) => (item.id === value.id ? value : item)),
                );
                refresh();
              })
            }
          >
            核查 {operation.path}
          </button>
        </div>
      ))}
      <details
        className="explorer-trash"
        open={trashOpen}
        onToggle={(event) => {
          const opened = event.currentTarget.open;
          setTrashOpen(opened);
          if (opened && !trash) void run(() => loadTrash());
        }}
      >
        <summary>回收站</summary>
        {trash?.entries.length === 0 ? <p>暂无回收内容。</p> : null}
        {trash?.entries.map((entry) => (
          <RestoreRow
            key={entry.trashId ?? entry.fileId}
            entry={entry}
            disabled={!hasFiles}
            restore={(destination) =>
              run(async () => {
                const operationId = crypto.randomUUID();
                try {
                  const value = await client.call('files.restore', {
                    projectId: project.id,
                    operationId,
                    trashId: entry.trashId!,
                    ...(destination ? { destination } : {}),
                  });
                  if (value.state !== 'complete') setOperations((current) => [...current, value]);
                } catch (reason) {
                  if ((reason as { code?: string }).code === 'outcomeUnknown')
                    setOperations((current) => [
                      ...current,
                      { id: operationId, path: entry.path, kind: 'restore', state: 'unknown' },
                    ]);
                  throw reason;
                }
                await loadTrash();
                refresh();
              })
            }
          />
        ))}
        {trash?.next !== undefined ? (
          <button
            type="button"
            className="btn"
            onClick={() => void run(() => loadTrash(trash.next))}
          >
            更多回收项
          </button>
        ) : null}
      </details>
      {error && !menu ? (
        <p role="alert" className="explorer-feedback">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RestoreRow({
  entry,
  disabled,
  restore,
}: {
  entry: FileLocation;
  disabled: boolean;
  restore: (destination: string) => Promise<boolean>;
}) {
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="explorer-trash-row">
      <span>{entry.path}</span>
      <input
        aria-label={`恢复位置 ${entry.path}`}
        placeholder="原位置或其他相对路径"
        value={destination}
        onChange={(event) => setDestination(event.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={disabled || busy}
        onClick={() => {
          setBusy(true);
          void restore(destination).finally(() => setBusy(false));
        }}
      >
        恢复 {entry.path}
      </button>
    </div>
  );
}
