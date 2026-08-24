ALTER TABLE `messages` ADD `nonce` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `senderPublicKey` text NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerships` ADD `userPublicKey` text;--> statement-breakpoint
ALTER TABLE `partnerships` ADD `partnerPublicKey` text;