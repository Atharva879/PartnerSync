CREATE TABLE `devicePushTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`platform` varchar(24) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devicePushTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `devicePushTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `notificationDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryKey` varchar(160) NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(40) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationDeliveries_deliveryKey_unique` UNIQUE(`deliveryKey`)
);
