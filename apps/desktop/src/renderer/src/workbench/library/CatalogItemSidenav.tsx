/**
 * 条目详情面板 Sidenav
 * 导航到条目详情的对应分区。
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
    <nav className="catalog-item-sidenav" aria-label="题录详情分区">
      {SIDENAV_ITEMS.map((item) => {
        const isActive = item.id === activeSection;
        return (
          <button
            type="button"
            key={item.id}
            className={`sidenav-button ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'location' : undefined}
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
