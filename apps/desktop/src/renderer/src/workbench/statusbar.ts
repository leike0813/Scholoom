export type StatusBarIcon = 'info' | 'warning' | 'error' | 'activity' | 'lock' | 'notifications';

export interface StatusBarItem {
  id: string;
  text: string;
  alignment?: 'left' | 'right' | undefined;
  priority?: number | undefined;
  icon?: StatusBarIcon | undefined;
  tooltip?: string | undefined;
  ariaLabel?: string | undefined;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | undefined;
  announce?: boolean | undefined;
}

export type StatusBarAction = () => void;

export interface StatusBarEntry extends StatusBarItem {
  owner: string;
  key: string;
  actionable: boolean;
}

export interface StatusBarHandle {
  update(patch: Partial<Omit<StatusBarItem, 'id'>>, activate?: StatusBarAction | null): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface StatusBarService {
  registerItem(owner: string, item: StatusBarItem, activate?: StatusBarAction): StatusBarHandle;
  getSnapshot(): readonly StatusBarEntry[];
  subscribe(listener: () => void): () => void;
  activate(owner: string, id: string): void;
  disposeOwner(owner: string): void;
  dispose(): void;
}

const fields = [
  'id',
  'text',
  'alignment',
  'priority',
  'icon',
  'tooltip',
  'ariaLabel',
  'tone',
  'announce',
] as const satisfies readonly (keyof StatusBarItem)[];

interface RecordState {
  readonly owner: string;
  readonly key: string;
  item: StatusBarItem;
  action: StatusBarAction | undefined;
  visible: boolean;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sameItem(a: StatusBarItem, b: StatusBarItem): boolean {
  return fields.every((field) => a[field] === b[field]);
}

export function createStatusBarService(): StatusBarService {
  const records = new Map<string, RecordState>();
  const listeners = new Set<() => void>();
  let snapshot: readonly StatusBarEntry[] = Object.freeze([]);
  let disposed = false;

  const publish = () => {
    snapshot = Object.freeze(
      [...records.values()]
        .filter((record) => record.visible)
        .sort((a, b) => {
          const alignment = (a.item.alignment ?? 'left').localeCompare(b.item.alignment ?? 'left');
          return (
            alignment ||
            (b.item.priority ?? 0) - (a.item.priority ?? 0) ||
            compareText(a.owner, b.owner) ||
            compareText(a.item.id, b.item.id)
          );
        })
        .map((record) =>
          Object.freeze({
            ...record.item,
            owner: record.owner,
            key: record.key,
            actionable: record.action !== undefined,
          }),
        ),
    );
    for (const listener of [...listeners]) listener();
  };

  const getRecord = (record: RecordState) =>
    !disposed && records.get(record.key) === record ? record : undefined;

  const service: StatusBarService = {
    registerItem(owner, item, activate) {
      if (disposed) throw new Error('Status bar service is disposed');
      const key = JSON.stringify([owner, item.id]);
      if (records.has(key)) throw new Error(`Status bar item already registered: ${key}`);
      const record: RecordState = {
        owner,
        key,
        item: { ...item },
        action: activate,
        visible: true,
      };
      records.set(key, record);
      publish();

      return {
        update(patch, nextAction) {
          const current = getRecord(record);
          if (!current) return;
          const nextItem = { ...current.item, ...patch };
          const itemChanged = !sameItem(current.item, nextItem);
          const actionChanged = nextAction !== undefined && nextAction !== current.action;
          if (!itemChanged && !actionChanged) return;
          const wasActionable = current.action !== undefined;
          current.item = nextItem;
          if (nextAction !== undefined) current.action = nextAction ?? undefined;
          if (current.visible && (itemChanged || wasActionable !== (current.action !== undefined)))
            publish();
        },
        show() {
          const current = getRecord(record);
          if (!current || current.visible) return;
          current.visible = true;
          publish();
        },
        hide() {
          const current = getRecord(record);
          if (!current?.visible) return;
          current.visible = false;
          publish();
        },
        dispose() {
          const current = getRecord(record);
          if (!current) return;
          records.delete(current.key);
          if (current.visible) publish();
        },
      };
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    activate(owner, id) {
      if (disposed) return;
      records.get(JSON.stringify([owner, id]))?.action?.();
    },
    disposeOwner(owner) {
      if (disposed) return;
      let changed = false;
      for (const [key, record] of records) {
        if (record.owner !== owner) continue;
        changed ||= record.visible;
        records.delete(key);
      }
      if (changed) publish();
    },
    dispose() {
      if (disposed) return;
      const changed = [...records.values()].some((record) => record.visible);
      const subscribers = [...listeners];
      disposed = true;
      records.clear();
      listeners.clear();
      snapshot = Object.freeze([]);
      if (changed) for (const listener of subscribers) listener();
    },
  };

  return service;
}
