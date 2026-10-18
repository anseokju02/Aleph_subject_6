import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable(
  "plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    priority: text("priority").notNull().default("검토 필요"),
    successCriteria: text("success_criteria").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    nextPlan: text("next_plan").notNull().default(""),
    sourceNote: text("source_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("plans_external_id_unique").on(table.externalId)]
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    seedKey: text("seed_key"),
    title: text("title").notNull(),
    dueDate: text("due_date").notNull(),
    scheduledDate: text("scheduled_date").notNull().default(""),
    autoCarry: integer("auto_carry", { mode: "boolean" }).notNull().default(false),
    carriedFromTaskId: integer("carried_from_task_id"),
    priority: text("priority").notNull().default("보통"),
    tag: text("tag").notNull().default("기타"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(30),
    status: text("status").notNull().default("todo"),
    sourceState: text("source_state").notNull().default("사용자 입력"),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("tasks_seed_key_unique").on(table.seedKey),
    uniqueIndex("tasks_carried_from_unique").on(table.carriedFromTaskId),
    index("tasks_plan_id_idx").on(table.planId),
    index("tasks_due_date_idx").on(table.dueDate),
    index("tasks_scheduled_date_idx").on(table.scheduledDate),
    index("tasks_status_idx").on(table.status),
  ]
);

export const executions = sqliteTable(
  "executions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at").notNull(),
    actualMinutes: integer("actual_minutes").notNull().default(0),
    blockedReason: text("blocked_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("executions_task_id_unique").on(table.taskId),
    index("executions_started_at_idx").on(table.startedAt),
  ]
);

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
