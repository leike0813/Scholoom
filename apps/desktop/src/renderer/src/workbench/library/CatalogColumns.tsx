import { readDraft } from '../drafts';

const defaults = [
  { id: 'title', label: '题名', width: 60, visible: true },
  { id: 'creators', label: '作者', width: 40, visible: true },
  { id: 'date', label: '年份', width: 16, visible: true },
  { id: 'version', label: '版本', width: 16, visible: true },
  { id: 'attachment', label: '附件', width: 24, visible: true },
] as const;
export type CatalogColumn = {
  id: (typeof defaults)[number]['id'];
  label: string;
  width: number;
  visible: boolean;
};

export function readCatalogColumns(key: string): CatalogColumn[] {
  try {
    const saved = JSON.parse(readDraft(key)) as CatalogColumn[];
    if (
      Array.isArray(saved) &&
      saved.length === defaults.length &&
      new Set(saved.map((column) => column.id)).size === defaults.length &&
      saved.every(
        (column) =>
          defaults.some((item) => item.id === column.id) &&
          Number.isInteger(column.width) &&
          column.width >= 12 &&
          column.width <= 120 &&
          typeof column.visible === 'boolean' &&
          (column.id !== 'title' || column.visible),
      )
    )
      return saved.map((column) => ({
        ...column,
        label: defaults.find((item) => item.id === column.id)?.label ?? '',
      }));
  } catch {
    /* Invalid preferences do not change catalog content. */
  }
  return defaults.map((column) => ({ ...column }));
}

export function CatalogColumns({
  columns,
  onChange,
}: {
  columns: CatalogColumn[];
  onChange: (columns: CatalogColumn[]) => void;
}) {
  const move = (index: number, step: number) => {
    const next = [...columns];
    const from = next[index],
      to = next[index + step];
    if (!from || !to) return;
    next[index] = to;
    next[index + step] = from;
    onChange(next);
  };
  return (
    <details className="catalog-column-settings">
      <summary>表格列设置</summary>
      {columns.map((column, index) => (
        <div key={column.id} className="catalog-column-setting">
          <label>
            <input
              type="checkbox"
              checked={column.visible}
              disabled={column.id === 'title'}
              onChange={(event) =>
                onChange(
                  columns.map((item) =>
                    item.id === column.id ? { ...item, visible: event.target.checked } : item,
                  ),
                )
              }
            />
            {column.label}列
          </label>
          <label>
            宽度
            <input
              type="number"
              min={12}
              max={120}
              step={1}
              aria-label={`${column.label}列宽度`}
              value={column.width}
              onChange={(event) => {
                const width = event.target.valueAsNumber;
                if (Number.isInteger(width) && width >= 12 && width <= 120)
                  onChange(
                    columns.map((item) => (item.id === column.id ? { ...item, width } : item)),
                  );
              }}
            />
          </label>
          <button
            className="btn btn-sm"
            type="button"
            aria-label={`前移${column.label}列`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            前移
          </button>
          <button
            className="btn btn-sm"
            type="button"
            aria-label={`后移${column.label}列`}
            disabled={index === columns.length - 1}
            onClick={() => move(index, 1)}
          >
            后移
          </button>
        </div>
      ))}
    </details>
  );
}
