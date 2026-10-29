import { type ContextItem, isContextItems } from '@scholoom/protocol';
import {
  isReportBridgeMessage,
  isReportManifest,
  type ReportBridgeMessage,
  type ReportSnapshot,
} from '@scholoom/protocol/reports';
import type { ContextContribution } from './context-contributions';
import { sameResourceRef } from './resource-controller';

type Reply = Extract<ReportBridgeMessage, { type: 'queued' | 'error' }>;

/** One verified page and receiver incarnation; dispose before replacing either or revoking access.
 * Capture the original contribution callback, never a wrapper forwarding to a later receiver.
 * This consumes already verified snapshots, not page transport or resource authorization.
 */
export function createReportContext({
  snapshot,
  viewId,
  generation,
  basis,
  appendContextItems,
}: Pick<ReportBridgeMessage, 'viewId' | 'generation' | 'basis'> & {
  snapshot: ReportSnapshot;
  appendContextItems: ContextContribution['appendContextItems'];
}) {
  // Keep this page's manifest even if the controller later replaces its snapshot object.
  let page: ReportSnapshot | undefined = structuredClone(snapshot);
  const valid = page.resource.basis === basis && isReportManifest(page.manifest);
  const envelope = { version: 1, viewId, generation, basis } as const;
  let pending = false;
  const reject = (code: Extract<Reply, { type: 'error' }>['error']['code']): Reply => ({
    ...envelope,
    type: 'error',
    error: { code, message: '报告选择未附加，请核查当前页面、接收者或容量。' },
  });

  return {
    dispose() {
      page = undefined;
    },
    receive(message: unknown): Reply {
      if (!page) return reject('unavailable');
      if (pending) return reject('resourceLimit');
      if (!isReportBridgeMessage(message) || message.type !== 'select')
        return reject('invalidRequest');
      if (
        !valid ||
        message.viewId !== viewId ||
        message.generation !== generation ||
        message.basis !== basis
      )
        return reject('contentChanged');
      const items: ContextItem[] = [];
      const sources: ReportSnapshot['manifest']['sources'] = [];
      for (const id of message.objectIds) {
        const object = page.manifest.objects.find((item) => item.objectId === id);
        if (!object) return reject('invalidRequest');
        items.push({
          kind: 'object',
          itemId: crypto.randomUUID(),
          ref: page.resource.ref,
          basis,
          providerId: 'report',
          objectId: object.objectId,
          name: object.name,
          semantics: object.semantics,
          comment: message.request,
        });
        for (const index of object.sourceIndexes ?? []) {
          const source = page.manifest.sources[index];
          if (!source) return reject('invalidRequest');
          if (
            !sources.some(
              (previous) =>
                previous.basis === source.basis && sameResourceRef(previous.ref, source.ref),
            )
          )
            sources.push(source);
        }
      }
      for (const source of sources)
        items.push({ kind: 'resource', itemId: crypto.randomUUID(), ...source });
      if (!isContextItems(items)) return reject('tooLarge');

      pending = true;
      try {
        return appendContextItems(items) === true
          ? { ...envelope, type: 'queued' }
          : reject('unavailable');
      } finally {
        pending = false;
      }
    },
  };
}
