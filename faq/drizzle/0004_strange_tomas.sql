CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`system` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
