// Exercise the public original export entry; never call or replace BBT cache methods.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function probeMutation({ Zotero, store, ids, runDir, result }) {
  const item = store.get(ids[0]);
  const keys = ids.map((id) => store.get(id).getField('citationKey'));
  const original = store.read('source-1').fields;
  const snapshots = [];
  const exportStep = async (name) => {
    const start = result.trace.length;
    const output = await Zotero.BetterBibTeX.Translators.exportItems({
      translatorID: Zotero.BetterBibTeX.Translators.bySlug.BetterBibTeX.translatorID,
      scope: { type: 'items', items: ids.map((id) => store.get(id)) }, displayOptions: { worker: true },
    });
    await fs.writeFile(path.join(runDir, `${name}.bib`), output);
    const cacheRates = result.trace.slice(start).filter((entry) => entry.type === 'worker' && entry.kind === 'message' && entry.data?.method === 'start' && typeof entry.data.result?.cacheRate === 'number').map((entry) => entry.data.result.cacheRate);
    snapshots.push({ name, authority: store.read('source-1'), cacheRates, bytes: Buffer.byteLength(output) });
    return output;
  };
  const warm = await exportStep('warm');
  const controlTitle = 'Mutation control without notification';
  item.setField('title', controlTitle);
  item.setField('DOI', '10.0000/control-no-notification');
  await item.saveTx({ skipNotifier: true });
  const stale = await exportStep('without-notification');
  const notificationStart = result.trace.length;
  const finalTitle = 'Updated research agents after committed notification';
  const finalDOI = '10.0000/updated-with-notification';
  item.setField('title', finalTitle);
  item.setField('DOI', finalDOI);
  item.setField('creators', [{ firstName: 'Grace', lastName: 'Wang', creatorType: 'author' }]);
  await item.saveTx();
  const delivered = result.trace.slice(notificationStart).filter((entry) => entry.type === 'notifier-delivered' && entry.objectType === 'item');
  const updated = await exportStep('with-notification');
  const repeated = await exportStep('updated-repeated');
  const unchangedKey = keys[1];
  const entry = (output, key) => output.split(/^@/m).find((part) => part.startsWith(`article{${key},`));
  result.mutation = {
    snapshots, delivered,
    authorityBefore: original, authorityAfter: store.read('source-1'),
    verified: {
      warmCacheUsed: snapshots[0].cacheRates.includes(1),
      negativeControlStale: snapshots[1].authority.fields.title === controlTitle && stale === warm && !stale.toLowerCase().includes(controlTitle.toLowerCase()),
      originalObserverDelivered: delivered.some((entry) => entry.name === 'Better BibTeX'),
      currentMetadataExported: updated.toLowerCase().includes(finalTitle.toLowerCase()) && updated.includes(finalDOI) && updated.includes('Wang, Grace') && !updated.toLowerCase().includes(original.title.toLowerCase()) && !updated.includes(original.DOI),
      authorityMatchesExport: store.read('source-1').fields.DOI === finalDOI && store.get(ids[0]).getField('title') === finalTitle,
      citationKeysPreserved: ids.every((id, i) => store.get(id).getField('citationKey') === keys[i]),
      otherRecordUnchanged: !!entry(warm, unchangedKey) && entry(warm, unchangedKey) === entry(updated, unchangedKey),
      repeatedExportCurrent: repeated === updated && snapshots.at(-1).cacheRates.includes(1),
    },
  };
  result.verified.mutation = Object.values(result.mutation.verified).every(Boolean);
  if (!result.verified.mutation) throw new Error('Mutation probe did not verify all observable behavior');
}
