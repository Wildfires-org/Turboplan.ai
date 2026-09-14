import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "./project";

// Define enum for project roles
export const projectRoleEnum = pgEnum("project_role", [
  "owner",
  "editor",
  "viewer",
]);

// Project-Users Join Table
export const projectUsers = pgTable(
  "project_users",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull().default("editor"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Composite primary key
    pk: primaryKey({ columns: [table.userId, table.projectId] }),
    // Indexes on foreign key columns for efficient joins/deletes
    userIdIdx: index("project_users_user_id_idx").on(table.userId),
    projectIdIdx: index("project_users_project_id_idx").on(table.projectId),
  }),
);

export type ProjectUser = InferSelectModel<typeof projectUsers>;
