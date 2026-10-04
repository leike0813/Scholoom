// Throwaway experiment: one authority, with read-only Zotero SQL projections.
import { DatabaseSync } from 'node:sqlite';

export function createLiteratureStore(filename, trace, notifier) {
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE literature (
      id INTEGER PRIMARY KEY, sourceID TEXT UNIQUE NOT NULL,
      zoteroKey TEXT UNIQUE NOT NULL, itemType TEXT NOT NULL, fields TEXT NOT NULL
    );
    CREATE TABLE libraries (libraryID INTEGER PRIMARY KEY, editable INTEGER);
    INSERT INTO libraries VALUES (1, 1);
    CREATE TABLE itemTypes (itemTypeID INTEGER PRIMARY KEY, typeName TEXT);
    INSERT INTO itemTypes VALUES (1, 'journalArticle'), (2, 'attachment'), (3, 'note'), (4, 'annotation');
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
  const getRow = (id) => db.prepare('SELECT * FROM literature WHERE id = ?').get(id);
  class Item {
    constructor(id) { this.id = this.itemID = id; this.pending = {}; }
    get libraryID() { return 1; }
    get key() { return getRow(this.id).zoteroKey; }
    get sourceID() { return getRow(this.id).sourceID; }
    get itemType() { return getRow(this.id).itemType; }
    get itemTypeID() { return db.prepare('SELECT itemTypeID FROM itemTypes WHERE typeName = ?').get(this.itemType).itemTypeID; }
    get parentID() { return this.pending.parentID ?? JSON.parse(getRow(this.id).fields).parentID; }
    set parentID(value) { this.setField('parentID', value); }
    get attachmentLinkMode() { return this.isAttachment() ? 0 : undefined; }
    getFilePath() { return this.getField('path'); }
    get deleted() { return false; }
    get isFeedItem() { return false; }
    getField(name) { return this.pending[name] ?? JSON.parse(getRow(this.id).fields)[name] ?? ''; }
    setField(name, value) {
      this.pending[name] = value;
      trace({ type: 'field-stage', itemID: this.id, field: name, value });
    }
    getCreators() { return JSON.parse(getRow(this.id).fields).creators ?? []; }
    getCreatorsJSON() { return this.getCreators(); }
    setCreators(creators) { this.setField('creators', structuredClone(creators)); }
    getTags() { return JSON.parse(getRow(this.id).fields).tags ?? []; }
    setTags(tags) { this.setField('tags', tags); }
    getCollections() { return []; }
    getNotes() { return []; }
    getAttachments() { return db.prepare("SELECT id FROM literature WHERE itemType = 'attachment' AND json_extract(fields, '$.parentID') = ?").all(this.id).map(row => row.id); }
    isRegularItem() { return this.itemType === 'journalArticle'; }
    isNote() { return false; }
    isAttachment() { return this.itemType === 'attachment'; }
    isAnnotation() { return false; }
    async save(options = {}) {
      const before = JSON.parse(getRow(this.id).fields);
      const changed = Object.fromEntries(Object.entries(this.pending)
        .filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(before[name])));
      const fields = { ...before, ...changed };
      db.prepare('UPDATE literature SET fields = ? WHERE id = ?').run(JSON.stringify(fields), this.id);
      trace({ type: 'item-save', itemID: this.id, changed, skipNotifier: !!options.skipNotifier });
      this.pending = {};
      if (Object.keys(changed).length && !options.skipNotifier) {
        await notifier?.trigger('modify', 'item', [this.id], {
          [this.id]: { libraryID: this.libraryID, changed: Object.fromEntries(Object.keys(changed).map((name) => [name, before[name] ?? ''])) },
        });
      }
      return this.id;
    }
    async saveTx(options) { return this.save(options); }
    clone() { throw new Error('Outside experiment: Item.clone'); }
    toJSON() { return { itemType: getRow(this.id).itemType, tags: this.getTags(), collections: this.getCollections(), relations: {}, ...JSON.parse(getRow(this.id).fields) }; }
  }
  const sql = (query, params = []) => {
    trace({ type: 'sql', query, params });
    const statement = db.prepare(query);
    return statement.columns().length ? statement.all(...params) : statement.run(...params);
  };
  const api = {
    queryAsync: async (query, params) => sql(query, params),
    valueQueryAsync: async (query, params) => Object.values(sql(query, params)[0] ?? {})[0],
    columnQueryAsync: async (query, params) => sql(query, params).map((row) => Object.values(row)[0]),
    async executeTransaction(fn) {
      db.exec('BEGIN');
      try { const result = await fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const items = new Map();
  return {
    db, Item, api,
    add(sourceID, zoteroKey, fields) {
      return Number(db.prepare('INSERT INTO literature(sourceID, zoteroKey, itemType, fields) VALUES (?, ?, ?, ?)')
        .run(sourceID, zoteroKey, fields.itemType, JSON.stringify(fields)).lastInsertRowid);
    },
    get(id) { if (!getRow(id)) return false; if (!items.has(id)) items.set(id, new Item(id)); return items.get(id); },
    read(sourceID) {
      const row = db.prepare('SELECT * FROM literature WHERE sourceID = ?').get(sourceID);
      return row ? { sourceID: row.sourceID, id: row.id, fields: JSON.parse(row.fields) } : null;
    },
    close() { db.close(); },
  };
}
