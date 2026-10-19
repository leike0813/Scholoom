/**
 * 选择模型
 * 参考 Zotero TreeSelection：Set<index> + pivot + rangedSelect
 */

export class CatalogSelection {
  private selected = new Set<number>();
  private pivot = 0;
  private onChange: ((selected: Set<number>) => void) | undefined;

  constructor(onChange?: (selected: Set<number>) => void) {
    this.onChange = onChange;
  }

  get selectedIndices(): ReadonlySet<number> {
    return this.selected;
  }

  get pivotIndex(): number {
    return this.pivot;
  }

  isSelected(index: number): boolean {
    return this.selected.has(index);
  }

  toggle(index: number): void {
    if (this.selected.has(index)) {
      this.selected.delete(index);
    } else {
      this.selected.add(index);
      this.pivot = index;
    }
    this.notify();
  }

  rangedSelect(from: number, to: number): void {
    const [start, end] = from < to ? [from, to] : [to, from];
    for (let i = start; i <= end; i++) {
      this.selected.add(i);
    }
    this.notify();
  }

  shiftSelect(index: number): void {
    this.rangedSelect(this.pivot, index);
  }

  selectAll(count: number): void {
    this.selected.clear();
    for (let i = 0; i < count; i++) {
      this.selected.add(i);
    }
    this.notify();
  }

  clear(): void {
    this.selected.clear();
    this.notify();
  }

  adjustForRowInsertion(index: number, count: number): void {
    const adjusted = new Set<number>();
    for (const i of this.selected) {
      adjusted.add(i >= index ? i + count : i);
    }
    this.selected = adjusted;
    if (this.pivot >= index) {
      this.pivot += count;
    }
    this.notify();
  }

  adjustForRowRemoval(index: number, count: number): void {
    const adjusted = new Set<number>();
    const removalEnd = index + count;
    for (const i of this.selected) {
      if (i < index) {
        adjusted.add(i);
      } else if (i >= removalEnd) {
        adjusted.add(i - count);
      }
      // 被删除区间内的索引直接丢弃
    }
    this.selected = adjusted;
    if (this.pivot >= removalEnd) {
      this.pivot -= count;
    } else if (this.pivot >= index) {
      this.pivot = Math.max(0, index - 1);
    }
    this.notify();
  }

  private notify(): void {
    this.onChange?.(this.selected);
  }
}
