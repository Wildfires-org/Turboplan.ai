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
import { office } from "./office";

// Define enum for office roles
export const officeRoleEnum = pgEnum("office_role", [
  "owner",
  "editor",
  "viewer",
]);

// Office-Users Join Table
export const officeUsers = pgTable(
  "office_users",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    officeId: uuid("office_id")
      .notNull()
      .references(() => office.id, { onDelete: "cascade" }),
    role: officeRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Composite primary key
    pk: primaryKey({ columns: [table.userId, table.officeId] }),
    // Indexes on foreign key columns for efficient joins/deletes
    userIdIdx: index("office_users_user_id_idx").on(table.userId),
    officeIdIdx: index("office_users_office_id_idx").on(table.officeId),
  }),
);

export type OfficeUser = InferSelectModel<typeof officeUsers>;
