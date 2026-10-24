/**
 * 条目详情面板容器
 * Sidenav + 滚动内容区 + 懒渲染
 */
import type { KernelClient } from '@scholoom/client';
import type { LibraryAttachment, LibraryBatch, LibrarySource } from '@scholoom/protocol';
import { type ReactNode, useRef, useState } from 'react';
import { AttachmentsSection } from './AttachmentsSection';
import { CatalogItemSidenav, type SidenavSection } from './CatalogItemSidenav';
import { ReadingSection } from './ReadingSection';

interface CatalogItemPaneProps {
  entry: LibrarySource | null;
  client: KernelClient;
  enabled: boolean;
  readable: boolean;
  writable: boolean;
  tick: number;
  metadata: ReactNode;
  onBatch: (batch: LibraryBatch) => void;
  onOpenResource?: ((material: LibraryAttachment) => void) | undefined;
}

export function CatalogItemPane({
  entry,
  client,
  enabled,
  readable,
  writable,
  tick,
  metadata,
  onBatch,
  onOpenResource,
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
      <div className="catalog-item-pane-content" ref={contentRef}>
        {metadata}
        <p role="status" aria-label="附件登记状态">
          {entry.attachmentState === 'recorded' ? '已有附件登记' : '附件未取得'}
          {entry.metadataOrigin === 'filename' ? ' · 待核对（文件名）' : ''}
        </p>
        <AttachmentsSection
          client={client}
          enabled={enabled}
          readable={readable}
          writable={writable}
          sourceId={entry.id}
          tick={tick}
          onBatch={onBatch}
          onOpenResource={onOpenResource}
        />
        <ReadingSection />
      </div>
    </section>
  );
}
