CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notificationsEnabled` int NOT NULL DEFAULT 1,
	`quietHoursEnabled` int NOT NULL DEFAULT 0,
	`quietHoursStart` int NOT NULL DEFAULT 22,
	`quietHoursEnd` int NOT NULL DEFAULT 8,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationPreferences_userId_unique` UNIQUE(`userId`)
);
