import type { Column } from "drizzle-orm";
import { eq } from "drizzle-orm";

// biome-ignore lint/suspicious/noExplicitAny: Drizzle's .from() doesn't accept a union of table types directly
type AnyPgTable = import("drizzle-orm/pg-core").PgTableWithColumns<any>;

import {
  officeUsers,
  organizationUsers,
  profile,
  projectUsers,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

type MembershipTable =
  | typeof officeUsers
  | typeof organizationUsers
  | typeof projectUsers;

/**
 * Builds a member-list query for any entity membership table.
 *
 * All three membership tables (officeUsers, organizationUsers, projectUsers)
 * share the same shape: userId, role, createdAt plus an entity-specific column.
 * This helper eliminates the duplicated select/join/where pattern.
 *
 * @param table - The membership join table (officeUsers, organizationUsers, or projectUsers)
 * @param filterColumn - The entity column to filter on (e.g. officeUsers.officeId)
 * @param filterValue - The entity ID value to match
 */
export function selectMembersFrom(
  table: MembershipTable,
  filterColumn: Column,
  filterValue: string,
) {
  return db
    .select({
      userId: table.userId,
      role: table.role,
      createdAt: table.createdAt,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
      },
    })
    .from(table as AnyPgTable)
    .innerJoin(user, eq(table.userId, user.id))
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(eq(filterColumn, filterValue));
}
