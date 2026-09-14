import type { InferSelectModel } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./user";

/**
 * User role types for profile classification
 */
export enum UserRole {
  GOVERNMENT_AGENCY = "government_agency",
  ENVIRONMENTAL_PLANNING = "environmental_planning",
  CITIZEN = "citizen",
}

export const userRoleEnum = pgEnum("user_role", [
  UserRole.GOVERNMENT_AGENCY,
  UserRole.ENVIRONMENTAL_PLANNING,
  UserRole.CITIZEN,
]);

export const profile = pgTable("profile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => user.id),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  city: varchar("city", { length: 100 }),
  streetAddress: text("street_address"),
  unitNumber: varchar("unit_number", { length: 20 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 10 }),
  avatarUrl: text("avatar_url"),
  jobTitle: varchar("job_title", { length: 100 }),
  userRole: userRoleEnum("user_role"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type Profile = InferSelectModel<typeof profile>;
