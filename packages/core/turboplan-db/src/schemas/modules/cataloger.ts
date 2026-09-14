import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { office } from "../workspace/office";
import { organization } from "../workspace/organization";
import { project } from "../workspace/project";

export const catalogerRun = pgTable(
  "cataloger_run",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    message: text("message").notNull(),
    externalRunId: varchar("external_run_id", { length: 255 }),
    webhookSecret: varchar("webhook_secret", { length: 128 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("initializing"),
    currentStep: text("current_step"),
    entriesCount: integer("entries_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cataloger_run_user_id_idx").on(table.userId),
    index("cataloger_run_external_run_id_idx").on(table.externalRunId),
    index("cataloger_run_webhook_secret_idx").on(table.webhookSecret),
  ],
);

export type CatalogerRun = InferSelectModel<typeof catalogerRun>;

export const catalogerEntry = pgTable(
  "cataloger_entry",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    catalogerRunId: uuid("cataloger_run_id")
      .notNull()
      .references(() => catalogerRun.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    officeId: uuid("office_id").references(() => office.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("cataloger_entry_run_id_idx").on(table.catalogerRunId)],
);

export type CatalogerEntry = InferSelectModel<typeof catalogerEntry>;
