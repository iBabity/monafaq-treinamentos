ALTER TABLE `articles` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `images` text DEFAULT '[]' NOT NULL;