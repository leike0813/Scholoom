CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`sourceId` text NOT NULL,
	`purpose` text NOT NULL,
	`storage` text NOT NULL,
	`hash` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachment_source` ON `attachments` (`sourceId`);--> statement-breakpoint
CREATE UNIQUE INDEX `attachment_content` ON `attachments` (`sourceId`,`purpose`,`storage`,`hash`);
--> statement-breakpoint
UPDATE sources SET value=json_set(value, '$.metadataOrigin', 'provided');
--> statement-breakpoint
UPDATE history SET value=json_set(value, '$.metadataOrigin', 'provided');
--> statement-breakpoint
UPDATE batches SET value=json_set(value, '$.kind', 'metadata'), request=json_object('kind','metadata','input',json(request));
--> statement-breakpoint
UPDATE meta SET value=json_set(value,'$.write',json('false'),'$.send',json('false')) WHERE key='grants';
