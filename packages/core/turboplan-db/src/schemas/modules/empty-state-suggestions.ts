import type { InferSelectModel } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { project } from "../workspace/project";

export const emptyStateSectionEnum = pgEnum("empty_state_section", [
  "tasks",
  "documents",
]);

export const emptyStateSuggestion = pgTable("empty_state_suggestion", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  section: emptyStateSectionEnum("section").notNull(),
  label: text("label").notNull(),
  content: text("content").notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmptyStateSuggestion = InferSelectModel<
  typeof emptyStateSuggestion
>;
export type NewEmptyStateSuggestion = typeof emptyStateSuggestion.$inferInsert;
