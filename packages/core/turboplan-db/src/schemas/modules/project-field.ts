import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { project } from "../workspace/project";

export const projectFieldTypeEnum = pgEnum("project_field_type", [
  "text",
  "list",
]);

export const projectField = pgTable(
  "project_field",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: projectFieldTypeEnum("type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    tooltip: varchar("tooltip", { length: 500 }),
    order: integer("order").notNull().default(0),
    values: json("values").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_field_project_id_idx").on(table.projectId),
    index("project_field_project_id_order_idx").on(
      table.projectId,
      table.order,
    ),
  ],
);

export type ProjectField = InferSelectModel<typeof projectField>;
