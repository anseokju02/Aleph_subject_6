CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`actual_minutes` integer DEFAULT 0 NOT NULL,
	`blocked_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `executions_task_id_unique` ON `executions` (`task_id`);--> statement-breakpoint
CREATE INDEX `executions_started_at_idx` ON `executions` (`started_at`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`priority` text DEFAULT '검토 필요' NOT NULL,
	`success_criteria` text NOT NULL,
	`estimated_minutes` integer DEFAULT 0 NOT NULL,
	`next_plan` text DEFAULT '' NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_external_id_unique` ON `plans` (`external_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`seed_key` text,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`priority` text DEFAULT '보통' NOT NULL,
	`tag` text DEFAULT '기타' NOT NULL,
	`estimated_minutes` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`source_state` text DEFAULT '사용자 입력' NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_seed_key_unique` ON `tasks` (`seed_key`);--> statement-breakpoint
CREATE INDEX `tasks_plan_id_idx` ON `tasks` (`plan_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);