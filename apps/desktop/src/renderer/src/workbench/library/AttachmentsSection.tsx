import type { KernelClient } from '@scholoom/client';
import type { LibraryAttachment, LibraryBatch } from '@scholoom/protocol';
import { AttachmentsPanel } from '../AttachmentsPanel';

export function AttachmentsSection({
  client,
  enabled,
  readable,
  writable,
  sourceId,
  tick,
  onBatch,
  onOpenResource,
}: {
  client: KernelClient;
  enabled: boolean;
  readable: boolean;
  writable: boolean;
  sourceId: string;
  tick: number;
  onBatch: (batch: LibraryBatch) => void;
  onOpenResource?: ((material: LibraryAttachment) => void) | undefined;
}) {
  return (
    <div className="catalog-section" data-section="attachments" id="section-attachments">
      <div className="catalog-section-header">附件</div>
      <AttachmentsPanel
        client={client}
        enabled={enabled}
        readable={readable}
        writable={writable}
        sourceId={sourceId}
        tick={tick}
        onBatch={onBatch}
        onOpenResource={onOpenResource}
      />
    </div>
  );
}
