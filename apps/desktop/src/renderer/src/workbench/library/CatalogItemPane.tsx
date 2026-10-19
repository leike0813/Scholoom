/**
 * 条目详情面板容器
 * Sidenav + 滚动内容区 + 懒渲染
 */
import type { KernelClient } from '@scholoom/client';
import type { LibraryAttachment, LibraryBatch, LibrarySource } from '@scholoom/protocol';
import { useRef, useState } from 'react';
import { AttachmentsSection } from './AttachmentsSection';
import { CatalogItemSidenav, type SidenavSection } from './CatalogItemSidenav';
import { MetadataSection } from './MetadataSection';
import { ReadingSection } from './ReadingSection';
import { RelatedSection } from './RelatedSection';
import { TagsSection } from './TagsSection';

interface CatalogItemPaneProps {
  entry: LibrarySource | null;
  client: KernelClient;
  enabled: boolean;
  readable: boolean;
  writable: boolean;
  tick: number;
  onBatch: (batch: LibraryBatch) => void;
  onOpenReader?: ((material: LibraryAttachment) => void) | undefined;
}

export function CatalogItemPane({
  entry,
  client,
  enabled,
  readable,
  writable,
  tick,
  onBatch,
  onOpenReader,
}: CatalogItemPaneProps) {
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
    <section className="catalog-item-pane" aria-label="题录详情">
      <CatalogItemSidenav activeSection={activeSection} onSectionChange={handleSectionChange} />
      <div className="catalog-item-pane-content" ref={contentRef} role="tabpanel">
        <MetadataSection entry={entry} />
        <AttachmentsSection
          client={client}
          enabled={enabled}
          readable={readable}
          writable={writable}
          sourceId={entry.id}
          tick={tick}
          onBatch={onBatch}
          onOpenReader={onOpenReader}
        />
        <ReadingSection />
        <TagsSection sourceId={entry.id} />
        <RelatedSection sourceId={entry.id} />
      </div>
    </section>
  );
}
