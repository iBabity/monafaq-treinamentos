CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`system` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`system` text NOT NULL,
	`name` text NOT NULL
);
