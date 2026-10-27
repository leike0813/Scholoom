import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectHost } from '@scholoom/client/host';
import { OperationError } from '@scholoom/protocol/core';
import type { LibraryInputs, LibraryOutputs } from '@scholoom/protocol/library';
import type { ZoteroInputs, ZoteroSnapshot } from '@scholoom/protocol/zotero';
import { app } from 'electron';
import { ZoteroHost } from './host';
import { JournalCatalog } from './journal-catalog';

type Configuration = {
  profile: string;
  packageDirectory: string;
  snapshot: ZoteroSnapshot;
};
app.on('window-all-closed', () => {});
async function main() {
  const config = JSON.parse(await readFile(process.argv.at(-1) as string, 'utf8')) as Configuration;
  app.setPath('userData', config.profile);
  let input = '';
  for await (const bytes of process.stdin) {
    input += bytes;
    if (Buffer.byteLength(input) > 8192) throw new Error('Bootstrap exceeds capacity');
  }
  await app.whenReady();
  const catalog = new JournalCatalog(config.snapshot);
  const host = new ZoteroHost({
    scope: 'isolated-library-journals',
    catalog,
    packageDirectory: config.packageDirectory,
    profileDirectory: config.profile,
    dateFormats: join(__dirname, '../../resources/dateFormats.json'),
    rendererDirectory: join(__dirname, '../renderer'),
    preload: join(__dirname, '../preload/index.cjs'),
  });
  const session = await connectHost(JSON.parse(input), {
    scope: 'isolated-library-journals',
    async initialize() {
      const status = await host.start();
      if (status.state !== 'ready') throw new Error(JSON.stringify(status));
    },
    async invoke(method, input, callback) {
      if (method === 'zotero.fillKeys') {
        const request = input as ZoteroInputs['zotero.fillKeys'];
        const result = await catalog.fill(
          () => host.fillKeys(request.sources.map((source) => source.sourceId)),
          async (changes: LibraryInputs['library.commitRecords']['changes']) => {
            const params = {
              requestId: request.operationId,
              libraryId: request.libraryId,
              changes,
            };
            try {
              return (await callback(
                'library.commitRecords',
                params,
              )) as LibraryOutputs['library.commitRecords'];
            } catch {
              const receipt = (await callback('library.commitResult', {
                libraryId: request.libraryId,
                requestId: request.operationId,
              })) as LibraryOutputs['library.commitResult'];
              if (receipt.state === 'notFound')
                throw new OperationError('outcomeUnknown', '未取得共同提交回执；只查询原操作。');
              return receipt;
            }
          },
          async () => (await callback('zotero.readCommitted', {})) as ZoteroSnapshot,
        );
        return { ...result, operationId: request.operationId };
      }
      if (method === 'zotero.export') {
        const request = input as ZoteroInputs['zotero.export'];
        return {
          format: request.format,
          sources: config.snapshot.map(({ sourceId, revision, citationKey }) => ({
            sourceId,
            revision,
            citationKey,
          })),
          text: await host.export(
            request.sources.map((source) => source.sourceId),
            request.format,
          ),
        };
      }
      throw new OperationError('permissionDenied', '宿主操作不在期刊切片内。');
    },
    async shutdown() {
      const status = await host.close();
      if (status.state === 'closed') catalog.close();
      return status.state === 'closed' ? 'closed' : 'unknown';
    },
  });
  await session.closed;
  app.quit();
}
void main().catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
