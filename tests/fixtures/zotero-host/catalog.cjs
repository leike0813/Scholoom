// Synthetic/test-only H1 adapter, based on the bbt-minimal-host prototype.
// Type IDs and empty relationships are fixture data, not a complete Zotero 10 catalog.
const { DatabaseSync } = require('node:sqlite');
const { join } = require('node:path');

const samples = [
  {
    itemType: 'journalArticle',
    title: 'Research agents and reproducible literature workflows',
    creators: [{ firstName: 'Ada', lastName: 'Chen', creatorType: 'author' }],
    date: '2026',
    publicationTitle: 'Prototype Research',
    volume: '1',
    pages: '1-8',
    DOI: '10.0000/scholoom-prototype',
  },
  {
    itemType: 'journalArticle',
    title: '中文科研流程原型样本',
    creators: [{ firstName: '明', lastName: '李', creatorType: 'author' }],
    date: '2026',
    publicationTitle: '原型测试期刊',
    citationKey: 'ScholoomPreserved2026',
  },
];

function createCatalog(directory) {
  const db = new DatabaseSync(join(directory, 'sample.sqlite'));
  try {
    if (
      !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'literature'").get()
    ) {
      db.exec(`
        BEGIN;
        CREATE TABLE literature (
          id INTEGER PRIMARY KEY, sourceID TEXT UNIQUE NOT NULL,
          zoteroKey TEXT UNIQUE NOT NULL, itemType TEXT NOT NULL, fields TEXT NOT NULL
        );
        CREATE TABLE libraries (libraryID INTEGER PRIMARY KEY, editable INTEGER);
        INSERT INTO libraries VALUES (1, 1);
        CREATE TABLE itemTypes (itemTypeID INTEGER PRIMARY KEY, typeName TEXT UNIQUE);
        INSERT INTO itemTypes VALUES
          (1, 'journalArticle'), (2, 'attachment'), (3, 'note'), (4, 'annotation');
        CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT UNIQUE);
        INSERT INTO fields VALUES (1, 'citationKey');
        CREATE VIEW items AS SELECT id AS itemID, zoteroKey AS key, 1 AS libraryID,
          itemTypes.itemTypeID, '2026-10-04 00:00:00' AS dateModified FROM literature
          JOIN itemTypes ON literature.itemType = itemTypes.typeName;
        CREATE VIEW itemData AS SELECT id AS itemID, 1 AS fieldID, id AS valueID
          FROM literature WHERE COALESCE(json_extract(fields, '$.citationKey'), '') != '';
        CREATE VIEW itemDataValues AS SELECT id AS valueID,
          json_extract(fields, '$.citationKey') AS value FROM literature;
        CREATE TABLE deletedItems (itemID INTEGER);
        CREATE TABLE feedItems (itemID INTEGER);
        CREATE TABLE settings (setting TEXT, key TEXT, value TEXT);
        CREATE TABLE translatorCache (fileName TEXT PRIMARY KEY, metadataJSON TEXT);
      `);
      const insert = db.prepare(
        'INSERT INTO literature(sourceID, zoteroKey, itemType, fields) VALUES (?, ?, ?, ?)',
      );
      samples.forEach((fields, index) => {
        insert.run(
          index === 0 ? 'sample-missing' : 'sample-preserved',
          `NODE000${index + 1}`,
          fields.itemType,
          JSON.stringify(fields),
        );
      });
      db.exec('COMMIT');
    }
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
    throw error;
  }

  const items = new Map();
  const observers = new Map();
  let nextObserverID = 1;
  let notifications = null;
  const getRow = (id) => db.prepare('SELECT * FROM literature WHERE id = ?').get(id);
  const getSource = (sourceID) =>
    db.prepare('SELECT * FROM literature WHERE sourceID = ?').get(sourceID);
  const query = (sql, params = []) => {
    const statement = db.prepare(sql);
    const args = params == null ? [] : Array.isArray(params) ? params : [params];
    return statement.columns().length ? statement.all(...args) : statement.run(...args);
  };

  async function deliver(action, type, ids, extraData) {
    const errors = [];
    for (const { observer, types } of [...observers.values()].sort(
      (a, b) => a.priority - b.priority,
    )) {
      if (types && !types.includes(type)) continue;
      try {
        await observer.notify(action, type, ids, extraData);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Synthetic notifier delivery failed');
  }

  const Notifier = {
    registerObserver(observer, types, name, priority = 100) {
      const id = nextObserverID++;
      observers.set(id, { observer, types, name, priority });
      return id;
    },
    unregisterObserver(id) {
      observers.delete(id);
    },
    async trigger(action, type, ids, extraData = {}) {
      if (notifications) {
        notifications.push(structuredClone([action, type, ids, extraData]));
      } else {
        await deliver(action, type, ids, extraData);
      }
    },
  };

  const DB = {
    queryAsync: async (sql, params) => query(sql, params),
    valueQueryAsync: async (sql, params) => Object.values(query(sql, params)[0] ?? {})[0],
    columnQueryAsync: async (sql, params) => query(sql, params).map((row) => Object.values(row)[0]),
    // shortcut: transactions share one serial fixture connection; parallel callers need separate catalogs.
    async executeTransaction(fn) {
      if (notifications) return fn();
      db.exec('BEGIN');
      notifications = [];
      let result;
      try {
        result = await fn();
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } finally {
          notifications = null;
          for (const item of items.values()) item.pending = {};
        }
        throw error;
      }
      const committed = notifications;
      notifications = null;
      const errors = [];
      for (const event of committed) {
        try {
          await deliver(...event);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) {
        // Test diagnostic only: this flag is not a production commit receipt.
        throw Object.assign(
          new AggregateError(errors, 'Committed; synthetic notification failed'),
          { committed: true },
        );
      }
      return result;
    },
  };

  class Item {
    constructor(id) {
      // biome-ignore lint/correctness/noConstructorReturn: Item identity is shared within this fixture.
      if (items.has(id)) return items.get(id);
      if (!getRow(id)) throw new Error(`Unknown synthetic item: ${id}`);
      this.id = this.itemID = id;
      this.pending = {};
      items.set(id, this);
    }
    get libraryID() {
      return 1;
    }
    get key() {
      return getRow(this.id).zoteroKey;
    }
    get sourceID() {
      return getRow(this.id).sourceID;
    }
    get itemType() {
      return getRow(this.id).itemType;
    }
    get itemTypeID() {
      return ItemTypes.getID(this.itemType);
    }
    get parentID() {
      return this.getField('parentID') || undefined;
    }
    set parentID(value) {
      this.setField('parentID', value);
    }
    get attachmentLinkMode() {
      return this.isAttachment() ? 0 : undefined;
    }
    getFilePath() {
      return this.getField('path');
    }
    get deleted() {
      return false;
    }
    get isFeedItem() {
      return false;
    }
    getField(name) {
      const fields = { ...JSON.parse(getRow(this.id).fields), ...this.pending };
      return fields[name] ?? '';
    }
    setField(name, value) {
      this.pending[name] = structuredClone(value);
    }
    getCreators() {
      return structuredClone(this.getField('creators') || []);
    }
    getCreatorsJSON() {
      return this.getCreators();
    }
    setCreators(creators) {
      this.setField('creators', creators);
    }
    getTags() {
      return structuredClone(this.getField('tags') || []);
    }
    setTags(tags) {
      this.setField('tags', tags);
    }
    getCollections() {
      return [];
    }
    getNotes() {
      return [];
    }
    getAttachments() {
      return db
        .prepare(
          "SELECT id FROM literature WHERE itemType = 'attachment' AND json_extract(fields, '$.parentID') = ?",
        )
        .all(this.id)
        .map((row) => row.id);
    }
    isRegularItem() {
      return this.itemType === 'journalArticle';
    }
    isNote() {
      return this.itemType === 'note';
    }
    isAttachment() {
      return this.itemType === 'attachment';
    }
    isAnnotation() {
      return this.itemType === 'annotation';
    }
    async save(options = {}) {
      return DB.executeTransaction(async () => {
        const before = JSON.parse(getRow(this.id).fields);
        const changed = Object.fromEntries(
          Object.entries(this.pending).filter(
            ([name, value]) => JSON.stringify(value) !== JSON.stringify(before[name]),
          ),
        );
        db.prepare('UPDATE literature SET fields = ? WHERE id = ?').run(
          JSON.stringify({ ...before, ...changed }),
          this.id,
        );
        this.pending = {};
        if (Object.keys(changed).length && !options.skipNotifier) {
          await Notifier.trigger('modify', 'item', [this.id], {
            [this.id]: {
              libraryID: this.libraryID,
              changed: Object.fromEntries(
                Object.keys(changed).map((name) => [name, before[name] ?? '']),
              ),
            },
          });
        }
        return this.id;
      });
    }
    async saveTx(options) {
      return this.save(options);
    }
    clone() {
      throw new Error('Outside synthetic H1 fixture: Item.clone');
    }
    toJSON() {
      return {
        itemType: this.itemType,
        tags: this.getTags(),
        collections: [],
        relations: {},
        ...JSON.parse(getRow(this.id).fields),
        ...structuredClone(this.pending),
      };
    }
  }

  const get = (ids) => (Array.isArray(ids) ? ids.map(get) : getRow(ids) ? new Item(ids) : false);
  const ItemTypes = {
    getName: (id) =>
      db.prepare('SELECT typeName FROM itemTypes WHERE itemTypeID = ?').get(id)?.typeName ?? '',
    getID: (name) =>
      db.prepare('SELECT itemTypeID FROM itemTypes WHERE typeName = ?').get(name)?.itemTypeID ??
      false,
  };
  const library = { libraryID: 1, editable: true, name: 'Synthetic H1 sample' };
  return {
    zotero: {
      DB,
      Item,
      ItemTypes,
      Notifier,
      Items: {
        get,
        getAsync: async (ids) => get(ids),
        loadDataTypes: async () => {},
        merge() {
          throw new Error('Outside synthetic H1 fixture: Items.merge');
        },
      },
      Libraries: {
        userLibraryID: 1,
        get: (id) => (id === 1 ? { ...library } : false),
        getAll: () => [{ ...library }],
      },
      Attachments: { LINK_MODE_LINKED_URL: 3 },
    },
    item(sourceID) {
      const row = getSource(sourceID);
      return row ? get(row.id) : false;
    },
    read(sourceID) {
      const row = getSource(sourceID);
      return row ? JSON.parse(row.fields) : null;
    },
    close() {
      db.close();
    },
  };
}

module.exports = { createCatalog };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  (async () => {
    const directory = mkdtempSync(join(tmpdir(), 'scholoom-synthetic-catalog-'));
    let catalog = createCatalog(directory);
    const reader = createCatalog(directory);
    try {
      const { DB, Items, Item, Notifier } = catalog.zotero;
      const missing = catalog.item('sample-missing');
      const preserved = catalog.item('sample-preserved');
      assert.equal(catalog.read('sample-preserved').citationKey, 'ScholoomPreserved2026');
      assert.equal(catalog.read('sample-missing').DOI, '10.0000/scholoom-prototype');
      assert.equal(Items.get(missing.id), missing);
      assert.equal(new Item(missing.id), missing);
      assert.deepEqual(await Items.getAsync([missing.id, preserved.id]), [missing, preserved]);
      assert.equal(Items.get(999), false);
      assert.equal(catalog.read('unknown'), null);
      assert.deepEqual(
        await DB.columnQueryAsync('SELECT itemID FROM items ORDER BY itemID'),
        [1, 2],
      );
      const before = catalog.read('sample-missing');
      const calls = [];
      const later = Notifier.registerObserver(
        {
          notify() {
            calls.push('later');
          },
        },
        ['item'],
        'later',
        20,
      );
      const earlier = Notifier.registerObserver(
        {
          notify() {
            assert.equal(reader.read('sample-missing').title, 'Corrected title');
            calls.push('earlier');
          },
        },
        ['item'],
        'earlier',
        10,
      );
      await assert.rejects(
        DB.executeTransaction(async () => {
          missing.setField('title', 'Rolled back');
          await missing.saveTx();
          preserved.setField('DOI', 'Unstored pending value');
          assert.deepEqual(calls, []);
          throw new Error('rollback probe');
        }),
        /rollback probe/,
      );
      assert.deepEqual(catalog.read('sample-missing'), before);
      assert.deepEqual(missing.toJSON().creators, before.creators);
      assert.equal(missing.getField('title'), before.title);
      assert.equal(preserved.getField('DOI'), '');
      assert.deepEqual(calls, []);
      await DB.executeTransaction(async () => {
        missing.setField('title', 'Corrected title');
        missing.setField('DOI', '10.0000/corrected');
        missing.setCreators([{ firstName: 'Grace', lastName: 'Li', creatorType: 'author' }]);
        assert.equal(missing.getCreators()[0].firstName, 'Grace');
        await missing.save();
        assert.equal(reader.read('sample-missing').title, before.title);
        assert.deepEqual(calls, []);
      });
      assert.deepEqual(calls, ['earlier', 'later']);
      assert.equal(catalog.read('sample-missing').creators[0].firstName, 'Grace');
      missing.setField('citationKey', 'SyntheticCorrected2026');
      await missing.save({ skipNotifier: true });
      assert.deepEqual(calls, ['earlier', 'later']);
      assert.equal(
        await DB.valueQueryAsync(
          `
        SELECT value FROM itemData JOIN itemDataValues USING (valueID)
        WHERE itemID = ?`,
          missing.id,
        ),
        'SyntheticCorrected2026',
      );
      Notifier.unregisterObserver(earlier);
      Notifier.unregisterObserver(later);
      const failed = Notifier.registerObserver(
        {
          notify() {
            throw new Error('listener probe');
          },
        },
        ['item'],
        'failed',
        1,
      );
      Notifier.registerObserver(
        {
          notify() {
            calls.push('after failure');
          },
        },
        ['item'],
        'still delivered',
        2,
      );
      await assert.rejects(
        DB.executeTransaction(async () => {
          missing.setField('DOI', '10.0000/committed');
          await missing.saveTx();
        }),
        (error) => error.committed === true,
      );
      assert.equal(catalog.read('sample-missing').DOI, '10.0000/committed');
      assert.equal(calls.at(-1), 'after failure');
      Notifier.unregisterObserver(failed);
      const saved = catalog.read('sample-missing');
      catalog.close();
      catalog = createCatalog(directory);
      assert.deepEqual(catalog.read('sample-missing'), saved);
      assert.equal(catalog.read('sample-preserved').citationKey, 'ScholoomPreserved2026');
      assert.equal(await catalog.zotero.DB.valueQueryAsync('SELECT COUNT(*) FROM literature'), 2);
      console.log(
        'PASS: read, identity, SQL, rollback, post-commit priority/failure, skipNotifier, reopen',
      );
      console.log(`Synthetic self-check directory: ${directory}`);
    } finally {
      reader.close();
      catalog.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
