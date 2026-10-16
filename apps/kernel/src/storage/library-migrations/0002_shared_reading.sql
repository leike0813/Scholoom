CREATE TABLE `reading_history` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recordId` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reading_history_record` ON `reading_history` (`recordId`,`seq`);--> statement-breakpoint
CREATE TABLE `reading_records` (
	`id` text PRIMARY KEY NOT NULL,
	`attachmentId` text NOT NULL,
	`materialVersionId` text NOT NULL,
	`deleted` integer NOT NULL,
	`value` text NOT NULL,
	`creation` text NOT NULL,
	`createdBy` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reading_material` ON `reading_records` (`attachmentId`,`materialVersionId`,`id`);
