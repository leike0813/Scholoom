import { type ReactNode, useLayoutEffect, useSyncExternalStore } from 'react';

/** A derived view only; the publishing library retains all record and draft state. */
export class LibraryDetailsContribution {
  private view: ReactNode = null;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  publish(view: ReactNode) {
    this.view = view;
    for (const listener of this.listeners) listener();
    return () => {
      if (this.view !== view) return;
      this.view = null;
      for (const listener of this.listeners) listener();
    };
  }
}

export function PublishLibraryDetails({
  contribution,
  children,
}: {
  contribution: LibraryDetailsContribution;
  children: ReactNode;
}) {
  useLayoutEffect(() => contribution.publish(children), [contribution, children]);
  return null;
}

export function LibraryDetails({ contribution }: { contribution: LibraryDetailsContribution }) {
  const view = useSyncExternalStore(contribution.subscribe, contribution.getSnapshot);
  return view ?? <p className="empty-hint">打开文献库并选择条目以查看详情。</p>;
}
