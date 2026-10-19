/**
 * 版本筛选下拉组件
 */
import { useCallback } from 'react';

export type VersionFilter = 'all' | 'latest';

interface VersionFilterProps {
  value: VersionFilter;
  onChange: (value: VersionFilter) => void;
}

export function VersionFilterDropdown({ value, onChange }: VersionFilterProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as VersionFilter);
    },
    [onChange],
  );

  return (
    <select
      className="version-filter-select"
      value={value}
      onChange={handleChange}
      aria-label="筛选版本"
    >
      <option value="all">全部版本</option>
      <option value="latest">最新版本</option>
    </select>
  );
}
