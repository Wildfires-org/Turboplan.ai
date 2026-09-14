import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { project } from "../workspace/project";
import { user } from "./user";

export const chat = pgTable(
  "chat",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at"),
    title: text("title").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    projectId: uuid("project_id").references(() => project.id),
    isInitial: boolean("is_initial").notNull().default(false),
    visibility: varchar("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
  },
  (table) => ({
    projectIdIdx: index("chat_project_id_idx").on(table.projectId),
    projectUpdatedAtIdx: index("chat_project_id_updated_at_idx").on(
      table.projectId,
      table.updatedAt,
    ),
    oneInitialPerProjectIdx: uniqueIndex("chat_one_initial_per_project_idx")
      .on(table.projectId)
      .where(sql`is_initial = true`),
  }),
);

export type Chat = InferSelectModel<typeof chat>;
