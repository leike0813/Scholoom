import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { OperationError } from '@scholoom/protocol/core';
import type { LibraryInputs, RecordReceipt } from '@scholoom/protocol/library';
import { journalOriginal, type ZoteroSnapshot } from '@scholoom/protocol/zotero';

type Event = [string, string, number[], Record<number, unknown>];
type Observer = { notify(...event: Event): Promise<void> | void };

/** Disposable SQLite projection. All durable writes go to the common library transaction. */
export class JournalCatalog {
  private readonly db = new DatabaseSync(':memory:');
  private readonly items = new Map<number, JournalItem>();
  private readonly observers = new Map<
    number,
    { observer: Observer; types: string[]; priority: number }
  >();
  private nextObserver = 1;
  private staging = false;
  private events: Event[] = [];
  private readonly drafts = new Map<number, Record<string, string>>();
  private readonly saved = new Set<number>();
  private records: ZoteroSnapshot;

  constructor(records: ZoteroSnapshot) {
    this.records = structuredClone(records);
    for (const record of records) journalOriginal(record);
    // Numeric IDs belong only to this projection, never to the source Zotero database.
    this.db.exec(`
      CREATE TABLE literature (id INTEGER PRIMARY KEY, fields TEXT NOT NULL, itemKey TEXT NOT NULL);
      CREATE TABLE libraries (libraryID INTEGER PRIMARY KEY, editable INTEGER);
      INSERT INTO libraries VALUES (1,1);
      CREATE TABLE itemTypes (itemTypeID INTEGER PRIMARY KEY, typeName TEXT UNIQUE);
      INSERT INTO itemTypes VALUES (1,'journalArticle'),(2,'attachment'),(3,'note'),(4,'annotation');
      CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT UNIQUE);
      INSERT INTO fields VALUES (1,'citationKey');
      CREATE VIEW items AS SELECT id AS itemID,itemKey AS key,1 AS libraryID,1 AS itemTypeID FROM literature;
      CREATE VIEW itemData AS SELECT id AS itemID,1 AS fieldID,id AS valueID FROM literature
        WHERE COALESCE(json_extract(fields,'$.citationKey'),'') != '';
      CREATE VIEW itemDataValues AS SELECT id AS valueID,json_extract(fields,'$.citationKey') AS value FROM literature;
      CREATE TABLE deletedItems (itemID INTEGER);
      CREATE TABLE feedItems (itemID INTEGER);
      CREATE TABLE settings (setting TEXT,key TEXT,value TEXT);
      CREATE TABLE translatorCache (fileName TEXT PRIMARY KEY, metadataJSON TEXT);
    `);
    this.refresh(records);
  }
  private refresh(records: ZoteroSnapshot) {
    this.db.exec('BEGIN');
    try {
      records.forEach((record, index) => {
        const original = journalOriginal(record);
        this.db
          .prepare('INSERT OR REPLACE INTO literature VALUES (?,?,?)')
          .run(
            index + 1,
            JSON.stringify({ ...original.fields, citationKey: record.citationKey?.value ?? '' }),
            original.identity.objectKey,
          );
      });
      this.db.exec('COMMIT');
      this.records = structuredClone(records);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  record(id: number) {
    const record = this.records[id - 1];
    if (!record) throw new OperationError('notFound', '条目不在本次投影。');
    return record;
  }
  fields(id: number) {
    const row = this.db.prepare('SELECT fields FROM literature WHERE id=?').get(id);
    if (!row) throw new OperationError('notFound', '条目不在本次投影。');
    return JSON.parse(String(row.fields)) as Record<string, string>;
  }
  field(id: number, name: string) {
    return this.drafts.get(id)?.[name] ?? this.fields(id)[name] ?? '';
  }
  set(id: number, name: string, value: unknown) {
    const record = this.record(id);
    if (
      !this.staging ||
      !['citationKey', 'extra'].includes(name) ||
      typeof value !== 'string' ||
      (record.citationKey && name === 'citationKey' && value !== record.citationKey.value)
    )
      throw new OperationError('unavailable', '本片只允许事务内补缺键及原包别名清理。');
    this.drafts.set(id, { ...this.drafts.get(id), [name]: value });
  }
  async save(id: number, options: { skipNotifier?: boolean } = {}) {
    if (!this.staging) throw new OperationError('unavailable', '保存必须属于共同原子事务。');
    this.saved.add(id);
    const changed = Object.keys(this.drafts.get(id) ?? {}).filter(
      (name) => this.field(id, name) !== this.fields(id)[name],
    );
    if (changed.length && !options.skipNotifier)
      this.events.push([
        'modify',
        'item',
        [id],
        {
          [id]: {
            libraryID: 1,
            changed: Object.fromEntries(changed.map((name) => [name, this.fields(id)[name] ?? ''])),
          },
        },
      ]);
    return id;
  }
  private async deliver(event: Event) {
    const failures = [];
    for (const { observer, types } of [...this.observers.values()].sort(
      (a, b) => a.priority - b.priority,
    )) {
      if (types && !types.includes(event[1])) continue;
      try {
        await observer.notify(...event);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, '派生通知失败');
  }
  async fill(
    operation: () => Promise<unknown>,
    commit: (changes: LibraryInputs['library.commitRecords']['changes']) => Promise<RecordReceipt>,
    read: () => Promise<ZoteroSnapshot>,
  ) {
    if (this.staging) throw new OperationError('resourceLimit', '事务正在执行。');
    this.staging = true;
    try {
      await operation();
      const changes = [...this.saved].flatMap((id) => {
        const record = this.record(id);
        const draft = this.drafts.get(id) ?? {};
        if (!Object.keys(draft).some((key) => draft[key] !== this.fields(id)[key])) return [];
        const original = record.originals[0];
        if (!original || !draft.citationKey || record.citationKey)
          throw new OperationError('unavailable', '插件写入超出补缺键范围。');
        return [
          {
            sourceId: record.sourceId,
            revision: record.revision,
            key: { value: draft.citationKey, pinned: false, intent: 'candidate' as const },
            ...(draft.extra !== undefined && draft.extra !== original.fields.extra
              ? { original: { ...original, fields: { ...original.fields, extra: draft.extra } } }
              : {}),
          },
        ];
      });
      if (!changes.length) return { state: 'unchanged' as const, notification: 'notRun' as const };
      const receipt = await commit(changes);
      if (receipt.state !== 'committed')
        return { state: receipt.state, receipt, notification: 'notRun' as const };
      // A refresh/notification failure cannot erase the committed receipt.
      try {
        const current = await read();
        if (current.some((record, i) => record.sourceId !== this.records[i]?.sourceId))
          throw new OperationError('contentChanged', '投影身份变化。');
        this.refresh(current);
        this.drafts.clear();
        for (const event of this.events) await this.deliver(event);
        for (const record of current) {
          const sqlKey = this.fields(current.indexOf(record) + 1).citationKey;
          if (!isDeepStrictEqual(sqlKey, record.citationKey?.value ?? ''))
            throw new OperationError('contentChanged', '派生键与共同键不一致。');
        }
        return { state: receipt.state, receipt, notification: 'delivered' as const };
      } catch (error) {
        return {
          state: receipt.state,
          receipt,
          notification: 'failed' as const,
          notificationReason: String(error).slice(0, 512),
        };
      }
    } finally {
      this.staging = false;
      this.drafts.clear();
      this.saved.clear();
      this.events = [];
    }
  }
  item(sourceId: string): JournalItem {
    const index = this.records.findIndex((record) => record.sourceId === sourceId);
    if (index < 0) throw new OperationError('notFound', '条目不在本次投影。');
    return this.get(index + 1);
  }
  private get = (id: number): JournalItem => {
    this.record(id);
    let item = this.items.get(id);
    if (!item) {
      item = new JournalItem(this, id);
      this.items.set(id, item);
    }
    return item;
  };
  private query(sql: string, params: SQLInputValue | SQLInputValue[] = []) {
    const statement = this.db.prepare(sql);
    const values = Array.isArray(params) ? params : [params];
    if (statement.columns().length) return statement.all(...values);
    statement.run(...values);
    return [];
  }
  get zotero() {
    const library = { libraryID: 1, editable: true, name: 'Isolated common-library projection' };
    const get = (ids: number | number[]): JournalItem | JournalItem[] =>
      Array.isArray(ids) ? ids.map(this.get) : this.get(ids);
    return {
      DB: {
        queryAsync: async (sql: string, params?: SQLInputValue[]) => this.query(sql, params),
        valueQueryAsync: async (sql: string, params?: SQLInputValue[]) =>
          Object.values(this.query(sql, params)[0] ?? {})[0],
        columnQueryAsync: async (sql: string, params?: SQLInputValue[]) =>
          this.query(sql, params).map((row) => Object.values(row)[0]),
        executeTransaction: async (fn: () => Promise<unknown>) => {
          // Startup has read-only transactions too. Item.save always requires the outer fill transaction.
          if (this.staging) return fn();
          this.db.exec('BEGIN');
          try {
            const result = await fn();
            this.db.exec('COMMIT');
            return result;
          } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
          }
        },
      },
      Item: JournalItem,
      ItemTypes: {
        getName: (id: number) =>
          ['', 'journalArticle', 'attachment', 'note', 'annotation'][id] ?? '',
        getID: (name: string) =>
          ['', 'journalArticle', 'attachment', 'note', 'annotation'].indexOf(name),
      },
      Items: {
        get,
        getAsync: async (ids: number | number[]) => get(ids),
        loadDataTypes: async () => {},
      },
      Libraries: {
        userLibraryID: 1,
        get: (id: number) => (id === 1 ? library : false),
        getAll: () => [library],
      },
      Attachments: { LINK_MODE_LINKED_URL: 3 },
      Notifier: {
        registerObserver: (observer: Observer, types: string[], _name: string, priority = 100) => {
          const id = this.nextObserver++;
          this.observers.set(id, { observer, types, priority });
          return id;
        },
        unregisterObserver: (id: number) => {
          this.observers.delete(id);
        },
        trigger: async (...event: Event) => {
          if (this.staging) this.events.push(event);
          else await this.deliver(event);
        },
      },
    };
  }
  close() {
    this.db.close();
  }
}

class JournalItem {
  readonly libraryID = 1;
  readonly itemType = 'journalArticle';
  readonly itemTypeID = 1;
  readonly deleted = false;
  readonly isFeedItem = false;
  constructor(
    private readonly catalog: JournalCatalog,
    readonly id: number,
  ) {}
  get itemID() {
    return this.id;
  }
  get key() {
    return this.catalog.record(this.id).originals[0]?.identity.objectKey ?? '';
  }
  getField(name: string) {
    return this.catalog.field(this.id, name);
  }
  setField(name: string, value: unknown) {
    this.catalog.set(this.id, name, value);
  }
  getCreators() {
    return structuredClone(this.catalog.record(this.id).originals[0]?.creators ?? []);
  }
  getCreatorsJSON() {
    return this.getCreators();
  }
  getTags() {
    return [];
  }
  getCollections() {
    return [];
  }
  getNotes() {
    return [];
  }
  getAttachments() {
    return [];
  }
  isRegularItem() {
    return true;
  }
  isNote() {
    return false;
  }
  isAttachment() {
    return false;
  }
  isAnnotation() {
    return false;
  }
  save(options?: { skipNotifier?: boolean }) {
    return this.catalog.save(this.id, options);
  }
  saveTx(options?: { skipNotifier?: boolean }) {
    return this.save(options);
  }
  toJSON() {
    return {
      ...this.catalog.fields(this.id),
      citationKey: this.getField('citationKey'),
      itemType: this.itemType,
      creators: this.getCreators(),
      tags: [],
      collections: [],
      relations: {},
    };
  }
}
