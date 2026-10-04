// Throwaway adapter: identity bindings persist; metadata lives only in the host library.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createClient, ensure} from './rpc-client.mjs';

export async function openLiterature(outputDir, reportFile) {
  const bindings = JSON.parse(await readFile(join(outputDir, 'identity-bindings.json'), 'utf8'));
  const client = createClient(outputDir, reportFile);
  await client.connect(90000);
  const source = sourceId => {
    ensure(sourceId === bindings.source.id, 'Unknown prototype source');
    return bindings.source;
  };
  const sameRef = (a, b) => a.libraryID === b.libraryID && a.key === b.key;
  const metadata = (raw, sourceId) => {
    ensure(sameRef(raw.ref, source(sourceId).providerRef), 'Host returned another source');
    return {id: sourceId, libraryId: bindings.libraryId, title: raw.title,
      citationKey: raw.citationKey, materials: [{id: bindings.material.id, sourceId}]};
  };
  const formats = {bibtex: 'BetterBibTeX', biblatex: 'BetterBibLaTeX'};
  const literature = {
    async read(sourceId) {
      return metadata(await client.rpc('snapshot', {ref: source(sourceId).providerRef}), sourceId);
    },
    async updateMetadata(sourceId, patch) {
      ensure(Object.keys(patch).length === 1 && typeof patch.title === 'string', 'Prototype supports title updates only');
      return metadata(await client.rpc('updateTitle', {ref: source(sourceId).providerRef, title: patch.title}), sourceId);
    },
    async regenerateCitationKey(sourceId) {
      const result = await client.rpc('regenerateCitationKey', {ref: source(sourceId).providerRef});
      return metadata(result.after, sourceId);
    },
    async exportCitation(sourceId, format) {
      ensure(formats[format], 'Unsupported citation format');
      const result = await client.rpc('export', {ref: source(sourceId).providerRef, format: formats[format]});
      ensure(sameRef(result.ref, source(sourceId).providerRef), 'Export returned another source');
      return {sourceId, format, text: result.text};
    },
    async readNavigation(materialId) {
      ensure(materialId === bindings.material.id, 'Unknown prototype material');
      const result = await client.rpc('readingState', {ref: bindings.material.providerRef});
      ensure(sameRef(result.ref, bindings.material.providerRef)
        && sameRef(result.sourceRef, bindings.source.providerRef), 'Material/source relationship differs');
      const location = value => ({page: value.page, x: value.x, y: value.y});
      const outline = nodes => nodes.map(node => ({title: node.title, location: location(node), children: outline(node.children || [])}));
      return {materialId, sourceId: bindings.source.id, contentType: result.contentType,
        fileName: result.fileName, available: result.fileExists, storageMode: result.storageMode,
        outline: outline(result.outline), bookmarks: result.bookmarks.map(bookmark => ({
          id: bookmark.id, title: bookmark.title, location: location(bookmark), color: bookmark.color}))};
    },
    async readMaterial(materialId) {
      ensure(materialId === bindings.material.id, 'Unknown prototype material');
      const result = await client.rpc('readMaterial', {ref: bindings.material.providerRef});
      ensure(sameRef(result.ref, bindings.material.providerRef)
        && sameRef(result.sourceRef, bindings.source.providerRef), 'Material relationship differs');
      return {materialId, sourceId: bindings.source.id, contentType: result.contentType, bytes: result.bytes};
    },
    async renameBookmark(materialId, bookmarkId, title) {
      ensure(materialId === bindings.material.id, 'Unknown prototype material');
      await client.rpc('renameBookmark', {ref: bindings.material.providerRef, bookmarkId, title});
      return literature.readNavigation(materialId);
    },
  };
  return {literature, sourceId: bindings.source.id, materialId: bindings.material.id,
    check: client.check, finish: client.finish, report: client.report};
}
