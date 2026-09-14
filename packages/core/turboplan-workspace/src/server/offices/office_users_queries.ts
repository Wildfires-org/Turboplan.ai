import { and, eq } from "drizzle-orm";

import { officeUsers } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { type MemberRoleType } from "@wildfires-org/turboplan-rbac";

export interface CreateOfficeUserParams {
  userId: string;
  officeId: string;
  role?: MemberRoleType;
}

/**
 * Add a user to an office with a specific role
 * Default role is 'viewer'
 */
export async function createOfficeUser(
  params: CreateOfficeUserParams,
): Promise<unknown> {
  const { userId, officeId, role = "viewer" } = params;

  return db.insert(officeUsers).values({
    userId,
    officeId,
    role,
  });
}

/**
 * Automatically assign owner role to user when they create an office
 */
export async function assignOfficeOwner(
  userId: string,
  officeId: string,
): Promise<unknown> {
  return createOfficeUser({
    userId,
    officeId,
    role: "owner",
  });
}

/**
 * Get all users in an office with their roles
 */
export async function getOfficeUsers(officeId: string) {
  return db
    .select()
    .from(officeUsers)
    .where(eq(officeUsers.officeId, officeId));
}

/**
 * Get all offices for a user with their roles
 */
export async function getUserOffices(userId: string) {
  return db.select().from(officeUsers).where(eq(officeUsers.userId, userId));
}

/**
 * Update user role in office
 */
export async function updateOfficeUserRole(
  userId: string,
  officeId: string,
  role: MemberRoleType,
): Promise<unknown> {
  return db
    .update(officeUsers)
    .set({ role, updatedAt: new Date() })
    .where(
      and(eq(officeUsers.userId, userId), eq(officeUsers.officeId, officeId)),
    );
}

/**
 * Remove user from office
 */
export async function removeOfficeUser(
  userId: string,
  officeId: string,
): Promise<unknown> {
  return db
    .delete(officeUsers)
    .where(
      and(eq(officeUsers.userId, userId), eq(officeUsers.officeId, officeId)),
    );
}
