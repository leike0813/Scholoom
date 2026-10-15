CREATE TABLE `file_references` (
  `id` text PRIMARY KEY NOT NULL,
  `path` text NOT NULL,
  `value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_references_path` ON `file_references` (`path`);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_references_present_path` ON `file_references` (`path`) WHERE json_extract(`value`, '$.state') = 'present';
--> statement-breakpoint
CREATE TABLE `file_operations` (
  `id` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `details` text NOT NULL
);
