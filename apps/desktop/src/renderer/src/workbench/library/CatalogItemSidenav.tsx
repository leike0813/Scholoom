/**
 * 条目详情面板 Sidenav
 * 参考 Zotero itemPaneSidenav：竖排 tab，role="tablist"
 */
import { useCallback } from 'react';

export type SidenavSection = 'metadata' | 'attachments' | 'reading' | 'tags' | 'related';

interface SidenavItem {
  id: SidenavSection;
  label: string;
  icon: string;
}

const SIDENAV_ITEMS: SidenavItem[] = [
  { id: 'metadata', label: '题录', icon: '📝' },
  { id: 'attachments', label: '附件', icon: '📎' },
  { id: 'reading', label: '阅读', icon: '📄' },
  { id: 'tags', label: '标签', icon: '🏷' },
  { id: 'related', label: '关联', icon: '🔗' },
];

interface CatalogItemSidenavProps {
  activeSection: SidenavSection;
  onSectionChange: (section: SidenavSection) => void;
}

export function CatalogItemSidenav({ activeSection, onSectionChange }: CatalogItemSidenavProps) {
  const handleClick = useCallback(
    (sectionId: SidenavSection) => {
      onSectionChange(sectionId);
    },
    [onSectionChange],
  );

  return (
    <nav className="catalog-item-sidenav" role="tablist" aria-orientation="vertical">
      {SIDENAV_ITEMS.map((item) => {
        const isActive = item.id === activeSection;
        return (
          <button
            key={item.id}
            className={`sidenav-button ${isActive ? 'active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`section-${item.id}`}
            aria-label={item.label}
            title={item.label}
            onClick={() => handleClick(item.id)}
          >
            <span className="sidenav-icon">{item.icon}</span>
          </button>
        );
      })}
    </nav>
  );
}
