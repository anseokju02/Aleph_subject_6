ALTER TABLE `tasks` ADD `scheduled_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `tasks_scheduled_date_idx` ON `tasks` (`scheduled_date`);