/**
 * 条目详情面板容器
 * Sidenav + 滚动内容区 + 懒渲染
 */
import type { LibrarySource } from '@scholoom/protocol';
import { useRef, useState } from 'react';
import { AttachmentsSection } from './AttachmentsSection';
import { CatalogItemSidenav, type SidenavSection } from './CatalogItemSidenav';
import { MetadataSection } from './MetadataSection';
import { ReadingSection } from './ReadingSection';
import { RelatedSection } from './RelatedSection';
import { TagsSection } from './TagsSection';

interface CatalogItemPaneProps {
  entry: LibrarySource | null;
}

export function CatalogItemPane({ entry }: CatalogItemPaneProps) {
  const [activeSection, setActiveSection] = useState<SidenavSection>('metadata');
  const contentRef = useRef<HTMLDivElement>(null);

  if (!entry) {
    return (
      <div className="catalog-item-pane-empty">
        <p>选择条目查看详情</p>
      </div>
    );
  }

  // 滚动到对应分区
  const handleSectionChange = (section: SidenavSection) => {
    setActiveSection(section);
    const container = contentRef.current;
    if (container) {
      const sectionEl = container.querySelector(`#section-${section}`);
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div className="catalog-item-pane">
      <CatalogItemSidenav activeSection={activeSection} onSectionChange={handleSectionChange} />
      <div className="catalog-item-pane-content" ref={contentRef} role="tabpanel">
        <MetadataSection entry={entry} />
        <AttachmentsSection sourceId={entry.id} />
        <ReadingSection />
        <TagsSection sourceId={entry.id} />
        <RelatedSection sourceId={entry.id} />
      </div>
    </div>
  );
}
