ALTER TABLE `tasks` ADD `auto_carry` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `carried_from_task_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_carried_from_unique` ON `tasks` (`carried_from_task_id`);