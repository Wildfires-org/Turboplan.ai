import type { InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

// Status enum for both milestones and tasks
// Defined here as it's a database constraint
export enum TaskStatus {
  DRAFT = "draft",
  NOT_STARTED = "not_started",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  DELAYED = "delayed",
}

// Milestones table
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    assigneeIds: text("assignee_ids").array().default([]),
    startDate: timestamp("start_date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: text("status", {
      enum: [
        TaskStatus.DRAFT,
        TaskStatus.NOT_STARTED,
        TaskStatus.IN_PROGRESS,
        TaskStatus.COMPLETED,
        TaskStatus.DELAYED,
      ],
    })
      .notNull()
      .default(TaskStatus.DRAFT),
    order: integer("order").default(0).notNull(),
    // TODO: Add FK constraint to document table once it has a UNIQUE(id) index
    // (currently has composite PK (id, createdAt) which prevents simple FK references)
    documentId: uuid("document_id").notNull(),
    projectId: uuid("project_id").references(() => project.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("milestones_project_id_idx").on(table.projectId),
    documentIdIdx: index("milestones_document_id_idx").on(table.documentId),
  }),
);

// Tasks table
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    assigneeIds: text("assignee_ids").array().default([]),
    dependencies: text("dependencies").array().default([]),
    startDate: timestamp("start_date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: text("status", {
      enum: [
        TaskStatus.DRAFT,
        TaskStatus.NOT_STARTED,
        TaskStatus.IN_PROGRESS,
        TaskStatus.COMPLETED,
        TaskStatus.DELAYED,
      ],
    })
      .notNull()
      .default(TaskStatus.DRAFT),
    order: integer("order").default(0).notNull(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    // TODO: Add FK constraint to document table once it has a UNIQUE(id) index
    // (currently has composite PK (id, createdAt) which prevents simple FK references)
    documentId: uuid("document_id").notNull(),
    projectDocumentIds: text("project_document_ids").array().default([]),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    milestoneIdIdx: index("tasks_milestone_id_idx").on(table.milestoneId),
  }),
);

// Relations
export const milestonesRelations = relations(milestones, ({ many, one }) => ({
  tasks: many(tasks),
  user: one(user, {
    fields: [milestones.userId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [milestones.projectId],
    references: [project.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  milestone: one(milestones, {
    fields: [tasks.milestoneId],
    references: [milestones.id],
  }),
  user: one(user, {
    fields: [tasks.userId],
    references: [user.id],
  }),
}));

// Types
export type Milestone = InferSelectModel<typeof milestones>;
export type NewMilestone = typeof milestones.$inferInsert;
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = typeof tasks.$inferInsert;
