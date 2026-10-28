import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { JournalCatalog } from '../../apps/zotero-host/src/main/journal-catalog.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import type { RecordReceipt } from '../../packages/protocol/dist/library.js';
import { journalCreatorSamples } from '../fixtures/journal-creators.js';

function gate() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-journal-creators-'));
  const library = new LiteratureCatalog(directory, () => {});
  await library.initialize();
  library.grant({ read: true, write: true, send: false, autoBackup: false });
  const libraryId = library.status().id;
  const batch = library.ingest({
    batchId: randomUUID(),
    origin: 'synthetic',
    version: 'published',
    json: JSON.stringify(journalCreatorSamples.map(({ title }) => ({ title }))),
  });
  await expect.poll(() => library.batch({ batchId: batch.id }).batch.state).toBe('completed');
  const sources = journalCreatorSamples.map(({ title }) => {
    const source = library.list({}).sources.find((row) => row.metadata.title === title);
    if (!source) throw new Error('Missing synthetic journal');
    return source;
  });
  const instance = library.createSourceInstance({
    libraryId,
    requestId: randomUUID(),
    label: 'Synthetic creator transaction',
  });
  expect(
    library.commitRecords({
      libraryId,
      requestId: randomUUID(),
      changes: sources.map((source, i) => ({
        sourceId: source.id,
        revision: source.revision,
        key: { value: `Creator${i}`, pinned: true, intent: 'explicit' },
        original: {
          identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `CREATOR${i}` },
          schemaVersion: '44',
          itemType: 'journalArticle',
          fields: { title: source.metadata.title, extra: 'Preserve this raw line', date: '2026' },
          creators: journalCreatorSamples[i]?.creators ?? [],
          relations: {},
        },
      })),
    }).state,
  ).toBe('committed');
  const read = async () => sources.map(({ id }) => library.record({ libraryId, sourceId: id }));
  const snapshot = await read();
  const catalog = new JournalCatalog(snapshot);
  const items = snapshot.map(({ sourceId }) => catalog.item(sourceId));
  let commits = 0;
  let receipt: RecordReceipt | undefined;
  const commit: Parameters<JournalCatalog['editCreators']>[1] = async (changes) => {
    commits++;
    receipt = library.commitRecords({ libraryId, requestId: randomUUID(), changes });
    return receipt;
  };
  return {
    library,
    libraryId,
    snapshot,
    catalog,
    items,
    read,
    commit,
    get commits() {
      return commits;
    },
    get receipt() {
      return receipt;
    },
    close: async () => {
      catalog.close();
      await library.close();
      await rm(directory, { recursive: true });
    },
  };
}

test('creator saves commit once, preserve unrelated authority and rebuild from common records', async () => {
  const f = await fixture();
  try {
    const corrections = [
      [
        { creatorType: 'author', firstName: '明', lastName: '欧阳', fieldMode: 0 },
        { creatorType: 'translator', firstName: 'Grace', lastName: 'Hopper', fieldMode: 0 },
      ],
      [{ creatorType: 'author', lastName: 'Independent Institute', fieldMode: 1 }],
    ];
    const notifications: number[][] = [];
    f.catalog.zotero.Notifier.registerObserver(
      {
        async notify(_event, _type, ids) {
          expect(f.receipt?.state).toBe('committed');
          const records = await f.read();
          for (const id of ids) {
            expect(f.items[id - 1]?.getCreators()).toEqual(records[id - 1]?.originals[0]?.creators);
          }
          notifications.push(ids);
        },
      },
      ['item'],
      'common-authority',
    );
    const result = await f.catalog.editCreators(
      async () => {
        for (const [i, item] of f.items.entries()) {
          item.setCreators(corrections[i]);
          await item.saveTx();
        }
      },
      f.commit,
      f.read,
    );
    expect(result).toMatchObject({ state: 'committed', notification: 'delivered' });
    expect(f.commits).toBe(1);
    expect(notifications.flat()).toEqual(f.items.map((item) => item.id));
    const current = await f.read();
    for (const [i, record] of current.entries()) {
      const before = f.snapshot[i];
      expect(record).toMatchObject({
        citationKey: before?.citationKey,
        originals: [{ ...before?.originals[0], creators: corrections[i] }],
      });
      expect(f.library.get(record.sourceId).metadata).toEqual(
        journalCreatorSamples[i] && { title: journalCreatorSamples[i]?.title },
      );
    }
    const rebuilt = new JournalCatalog(current);
    try {
      for (const [i, record] of current.entries()) {
        const item = rebuilt.item(record.sourceId);
        expect(item.getCreators()).toEqual(corrections[i]);
        const copy = item.getCreators();
        copy.length = 0;
        expect(item.getCreators()).toEqual(corrections[i]);
      }
    } finally {
      rebuilt.close();
    }
  } finally {
    await f.close();
  }
});

test('stale revisions reject the entire creator group without leaking drafts or notifying', async () => {
  const f = await fixture();
  try {
    const last = f.snapshot[1];
    if (!last) throw new Error('Missing second journal');
    expect(
      f.library.commitRecords({
        libraryId: f.libraryId,
        requestId: randomUUID(),
        changes: [
          { sourceId: last.sourceId, revision: last.revision, metadata: { title: 'New CSL' } },
        ],
      }).state,
    ).toBe('committed');
    const before = await f.read();
    let notices = 0;
    f.catalog.zotero.Notifier.registerObserver(
      {
        notify: () => {
          notices++;
        },
      },
      ['item'],
      'rejection',
    );
    const result = await f.catalog.editCreators(
      async () => {
        for (const item of f.items) {
          item.setCreators([]);
          await item.save();
        }
      },
      f.commit,
      f.read,
    );
    expect(result).toMatchObject({
      state: 'rejected',
      notification: 'notRun',
      receipt: { error: { code: 'contentChanged' } },
    });
    expect(await f.read()).toEqual(before);
    expect(notices).toBe(0);
    for (const [i, item] of f.items.entries())
      expect(item.getCreators()).toEqual(f.snapshot[i]?.originals[0]?.creators);
  } finally {
    await f.close();
  }
});

test('creator intent rejects invalid input and key writes, and discards unsaved changes', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    expect(() => item.setCreators([])).toThrow(expect.objectContaining({ code: 'unavailable' }));
    await expect(
      f.catalog.fill(async () => item.setCreators([]), f.commit, f.read),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      f.catalog.fill(async () => item.setField('citationKey', 'Replacement'), f.commit, f.read),
    ).rejects.toMatchObject({ code: 'unavailable' });
    for (const [value, code] of [
      [null, 'invalidRequest'],
      [[null], 'invalidRequest'],
      [[{ creatorType: 'director', lastName: 'Unsupported role' }], 'unavailable'],
      [[{ creatorType: 'author', lastName: 'A'.repeat(65536) }], 'tooLarge'],
    ] as const) {
      await expect(
        f.catalog.editCreators(async () => item.setCreators(value), f.commit, f.read),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      f.catalog.editCreators(
        async () => item.setField('citationKey', 'Replacement'),
        f.commit,
        f.read,
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(
      await f.catalog.editCreators(async () => item.setCreators([]), f.commit, f.read),
    ).toMatchObject({ state: 'unchanged' });
    expect(f.commits).toBe(0);
    expect(await f.read()).toEqual(f.snapshot);
    expect(item.getCreators()).toEqual(f.snapshot[0]?.originals[0]?.creators);
  } finally {
    await f.close();
  }
});

test('notification retains committed receipts and excludes reentrant or late writes', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    let delivered = false;
    f.catalog.zotero.Notifier.registerObserver(
      {
        async notify() {
          expect(item.getCreators()).toEqual([]);
          expect(() => item.setCreators(journalCreatorSamples[0]?.creators)).toThrow(
            expect.objectContaining({ code: 'unavailable' }),
          );
          await expect(item.saveTx()).rejects.toMatchObject({ code: 'unavailable' });
          await expect(
            f.catalog.editCreators(async () => {}, f.commit, f.read),
          ).rejects.toMatchObject({ code: 'resourceLimit' });
          throw new Error('Synthetic observer failure');
        },
      },
      ['item'],
      'failing-observer',
    );
    f.catalog.zotero.Notifier.registerObserver(
      {
        notify: () => {
          delivered = true;
        },
      },
      ['item'],
      'next-observer',
    );
    const result = await f.catalog.editCreators(
      async () => {
        item.setCreators([]);
        await item.saveTx();
      },
      f.commit,
      f.read,
    );
    expect(result).toMatchObject({
      state: 'committed',
      receipt: f.receipt,
      notification: 'failed',
    });
    expect(delivered).toBe(true);
    expect((await f.read())[0]?.originals[0]?.creators).toEqual([]);
    expect(await f.catalog.editCreators(async () => {}, f.commit, f.read)).toMatchObject({
      state: 'unchanged',
    });
    expect(f.commits).toBe(1);
  } finally {
    await f.close();
  }
});

test('a lost committed readback preserves the receipt without publishing draft creators', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    const result = await f.catalog.editCreators(
      async () => {
        item.setCreators([]);
        await item.saveTx();
      },
      f.commit,
      async () => {
        throw new Error('Synthetic readback failure');
      },
    );
    expect(result).toMatchObject({
      state: 'committed',
      receipt: f.receipt,
      notification: 'failed',
    });
    expect(item.getCreators()).toEqual(f.snapshot[0]?.originals[0]?.creators);
    expect((await f.read())[0]?.originals[0]?.creators).toEqual([]);
    expect(f.commits).toBe(1);
  } finally {
    await f.close();
  }
});

test('a failed operation cannot lend its asynchronous writes to a later transaction', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    const release = gate();
    let late: Promise<void> | undefined;
    await expect(
      f.catalog.fill(
        async () => {
          late = release.promise.then(async () => {
            expect(() => item.setCreators([])).toThrow(
              expect.objectContaining({ code: 'unavailable' }),
            );
            await expect(item.saveTx()).rejects.toMatchObject({ code: 'unavailable' });
          });
          throw new Error('Synthetic failed operation');
        },
        f.commit,
        f.read,
      ),
    ).rejects.toThrow();
    const intended = [{ creatorType: 'author', lastName: 'Intended', fieldMode: 1 }];
    const result = await f.catalog.editCreators(
      async () => {
        item.setCreators(intended);
        await item.saveTx();
        release.resolve();
        await late;
      },
      f.commit,
      f.read,
    );
    expect(result).toMatchObject({ state: 'committed', notification: 'delivered' });
    expect((await f.read())[0]?.originals[0]?.creators).toEqual(intended);
    expect(f.commits).toBe(1);
  } finally {
    await f.close();
  }
});

test('commit and readback wait close the writable stage before late callbacks resume', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    const commitReady = gate();
    const readReady = gate();
    const releaseCommit = gate();
    const releaseRead = gate();
    let late: Promise<void> | undefined;
    const result = await f.catalog.editCreators(
      async () => {
        item.setCreators([]);
        await item.saveTx();
        late = (async () => {
          for (const [ready, release] of [
            [commitReady, releaseCommit],
            [readReady, releaseRead],
          ] as const) {
            await ready.promise;
            expect(() => item.setCreators(journalCreatorSamples[0]?.creators)).toThrow(
              expect.objectContaining({ code: 'unavailable' }),
            );
            await expect(item.saveTx()).rejects.toMatchObject({ code: 'unavailable' });
            release.resolve();
          }
        })();
      },
      async (changes) => {
        const receipt = await f.commit(changes);
        commitReady.resolve();
        await releaseCommit.promise;
        return receipt;
      },
      async () => {
        readReady.resolve();
        await releaseRead.promise;
        return f.read();
      },
    );
    await late;
    expect(result).toMatchObject({ state: 'committed', notification: 'delivered' });
    expect((await f.read())[0]?.originals[0]?.creators).toEqual([]);
  } finally {
    await f.close();
  }
});

test('plugin SQL cannot replace common projections or enqueue notifications during delivery', async () => {
  const f = await fixture();
  try {
    const item = f.items[0];
    if (!item) throw new Error('Missing journal');
    for (const sql of [
      "UPDATE literature SET creators='[]'",
      'DROP VIEW items',
      'ALTER TABLE literature RENAME TO changed',
      'CREATE TEMP TABLE LiTeRaTuRe(id INTEGER, creators TEXT)',
      'PRAGMA WRITABLE_SCHEMA=ON',
    ])
      await expect(f.catalog.zotero.DB.queryAsync(sql)).rejects.toThrow();
    await f.catalog.zotero.DB.queryAsync('CREATE TEMP TABLE shadow(id INTEGER, creators TEXT)');
    await expect(
      f.catalog.zotero.DB.queryAsync('ALTER TABLE temp.shadow RENAME TO LiTeRaTuRe'),
    ).rejects.toThrow();
    await f.catalog.zotero.DB.queryAsync('INSERT INTO settings VALUES (?,?,?)', [
      'cache',
      'test',
      'kept',
    ]);
    expect(
      await f.catalog.zotero.DB.valueQueryAsync('SELECT value FROM settings WHERE key=?', ['test']),
    ).toBe('kept');
    f.catalog.zotero.Notifier.registerObserver(
      {
        notify: async (...event) => {
          await expect(
            f.catalog.zotero.DB.queryAsync("UPDATE literature SET creators='[]'"),
          ).rejects.toThrow();
          await expect(f.catalog.zotero.Notifier.trigger(...event)).rejects.toMatchObject({
            code: 'unavailable',
          });
        },
      },
      ['item'],
      'guarded-notifier',
    );
    const intended = [{ creatorType: 'author', lastName: 'Intended', fieldMode: 1 }];
    const result = await f.catalog.editCreators(
      async () => {
        item.setCreators(intended);
        await item.saveTx();
      },
      f.commit,
      f.read,
    );
    expect(result).toMatchObject({ state: 'committed', notification: 'delivered' });
    expect(item.getCreators()).toEqual(intended);
    expect((await f.read())[0]?.originals[0]?.creators).toEqual(intended);
  } finally {
    await f.close();
  }
});
