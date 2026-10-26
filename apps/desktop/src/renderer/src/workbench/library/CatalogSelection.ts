export interface CatalogSelectionState {
  selectedIds: readonly string[];
  primaryId: string | null;
  anchorId: string | null;
}

export class CatalogSelection {
  private state: CatalogSelectionState;
  private listeners = new Set<() => void>();

  constructor(initial?: CatalogSelectionState) {
    this.state = initial ?? { selectedIds: [], primaryId: null, anchorId: null };
  }

  getSnapshot = (): CatalogSelectionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(state: CatalogSelectionState): void {
    if (
      state.primaryId === this.state.primaryId &&
      state.anchorId === this.state.anchorId &&
      state.selectedIds.length === this.state.selectedIds.length &&
      state.selectedIds.every((id, index) => id === this.state.selectedIds[index])
    )
      return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  reconcile(visibleIds: readonly string[]): void {
    const selectedIds = this.state.selectedIds.filter((id) => visibleIds.includes(id));
    this.publish({
      selectedIds,
      primaryId: selectedIds.includes(this.state.primaryId ?? '')
        ? this.state.primaryId
        : (visibleIds.find((id) => selectedIds.includes(id)) ?? null),
      anchorId: visibleIds.includes(this.state.anchorId ?? '') ? this.state.anchorId : null,
    });
  }

  select(
    id: string,
    modifiers: { toggle?: boolean; range?: boolean },
    visibleIds: readonly string[],
  ): void {
    const index = visibleIds.indexOf(id);
    if (index < 0) return;
    const anchor = visibleIds.indexOf(this.state.anchorId ?? '');
    if (modifiers.range && anchor >= 0) {
      this.publish({
        selectedIds: visibleIds.slice(Math.min(anchor, index), Math.max(anchor, index) + 1),
        primaryId: id,
        anchorId: this.state.anchorId,
      });
      return;
    }
    const selectedIds = modifiers.toggle
      ? this.state.selectedIds.includes(id)
        ? this.state.selectedIds.filter(
            (selected) => selected !== id && visibleIds.includes(selected),
          )
        : [...this.state.selectedIds.filter((selected) => visibleIds.includes(selected)), id]
      : [id];
    this.publish({
      selectedIds,
      primaryId: selectedIds.includes(id)
        ? id
        : (visibleIds.find((visible) => selectedIds.includes(visible)) ?? null),
      anchorId: id,
    });
  }

  selectAll(visibleIds: readonly string[]): void {
    this.publish({
      selectedIds: [...visibleIds],
      primaryId: visibleIds[0] ?? null,
      anchorId: visibleIds[0] ?? null,
    });
  }
}
