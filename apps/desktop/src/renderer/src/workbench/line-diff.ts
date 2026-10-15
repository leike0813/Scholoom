export interface DiffRow {
  kind: 'same' | 'remove' | 'add';
  text: string;
}

const maxLines = 400;

const split = (text: string): string[] => (text.length === 0 ? [] : text.split('\n'));

/**
 * 行级差异，供历史条目与保存冲突对照使用。
 * shortcut: 单侧超过 400 行时返回 undefined，由调用方显示整段内容作对照；
 * 需要大文件差异时改用 Myers 或分块比较。
 */
export function lineDiff(before: string, after: string): DiffRow[] | undefined {
  const left = split(before);
  const right = split(after);
  if (left.length > maxLines || right.length > maxLines) return undefined;
  const table: number[][] = left.map(() => Array.from({ length: right.length + 1 }, () => 0));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const same = left[i] === right[j] ? (table[i + 1]?.[j + 1] ?? 0) + 1 : 0;
      const lower = Math.max(table[i + 1]?.[j] ?? 0, table[i]?.[j + 1] ?? 0);
      const row = table[i];
      if (row) row[j] = Math.max(same, lower);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ kind: 'same', text: left[i] ?? '' });
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      rows.push({ kind: 'remove', text: left[i] ?? '' });
      i += 1;
    } else {
      rows.push({ kind: 'add', text: right[j] ?? '' });
      j += 1;
    }
  }
  while (i < left.length) {
    rows.push({ kind: 'remove', text: left[i] ?? '' });
    i += 1;
  }
  while (j < right.length) {
    rows.push({ kind: 'add', text: right[j] ?? '' });
    j += 1;
  }
  return rows;
}
