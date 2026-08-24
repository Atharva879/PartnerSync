ALTER TABLE `messages` MODIFY COLUMN `senderPublicKey` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `senderEncryptedContent` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `senderNonce` varchar(64);