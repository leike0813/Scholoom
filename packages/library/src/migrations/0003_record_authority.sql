CREATE TABLE source_instances (id TEXT PRIMARY KEY NOT NULL, requestId TEXT NOT NULL UNIQUE, request TEXT NOT NULL, label TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE original_records (identity TEXT PRIMARY KEY NOT NULL, sourceId TEXT NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX original_source ON original_records (sourceId, identity);
--> statement-breakpoint
CREATE TABLE citation_keys (sourceId TEXT PRIMARY KEY NOT NULL, normalized TEXT NOT NULL UNIQUE, value TEXT NOT NULL, pinned INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE record_operations (requestId TEXT PRIMARY KEY NOT NULL, request TEXT NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE record_history (seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, sourceId TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, value TEXT);
--> statement-breakpoint
CREATE INDEX record_history_source ON record_history (sourceId, seq);
