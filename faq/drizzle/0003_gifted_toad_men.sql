CREATE TABLE `audit_attempts` (
	`actor_id` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deleted_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`deleted_at` text NOT NULL
);
