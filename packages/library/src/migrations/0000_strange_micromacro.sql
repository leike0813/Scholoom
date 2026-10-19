CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`request` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batchId` text NOT NULL,
	`position` integer NOT NULL,
	`input` text,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batch_position` ON `entries` (`batchId`,`position`);--> statement-breakpoint
CREATE TABLE `history` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sourceId` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_history` ON `history` (`sourceId`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`doi` text,
	`version` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_doi_version` ON `sources` (`doi`,`version`) WHERE "sources"."doi" is not null AND "sources"."version" != 'unspecified';