ALTER TABLE record_operations ADD COLUMN kind TEXT NOT NULL DEFAULT 'authority';
--> statement-breakpoint
CREATE TABLE organization_edits (requestId TEXT PRIMARY KEY NOT NULL REFERENCES record_operations(requestId), value TEXT NOT NULL);
