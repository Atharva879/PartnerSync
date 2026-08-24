ALTER TABLE `messages` ADD `clientMessageId` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_clientMessageId_unique` UNIQUE(`clientMessageId`);