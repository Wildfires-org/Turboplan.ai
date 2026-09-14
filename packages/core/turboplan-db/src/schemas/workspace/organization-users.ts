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
import { organization } from "./organization";

// Define enum for organization roles
export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "editor",
  "viewer",
]);

// Organization-Users Join Table
export const organizationUsers = pgTable(
  "organization_users",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Composite primary key
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    // Indexes on foreign key columns for efficient joins/deletes
    userIdIdx: index("organization_users_user_id_idx").on(table.userId),
    organizationIdIdx: index("organization_users_organization_id_idx").on(
      table.organizationId,
    ),
  }),
);

export type OrganizationUser = InferSelectModel<typeof organizationUsers>;
