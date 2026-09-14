import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

export const projectContext = pgTable(
  "project_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 200 }).notNull(),
    content: text("content").notNull(),
    url: text("url"),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("project_context_project_id_idx").on(table.projectId)],
);

export type ProjectContext = InferSelectModel<typeof projectContext>;
