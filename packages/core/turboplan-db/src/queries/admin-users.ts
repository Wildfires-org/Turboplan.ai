import { eq } from "drizzle-orm";

import { db } from "../db-client";
import { adminUser, profile, user } from "../schemas";

/**
 * Get all admin users with their user and profile info.
 */
export async function getAdminUsers() {
  try {
    return await db
      .select({
        adminUser: adminUser,
        user: user,
        profile: profile,
      })
      .from(adminUser)
      .innerJoin(user, eq(adminUser.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId));
  } catch (error) {
    console.error("Failed to get admin users from database:", error);
    throw error;
  }
}

/**
 * Check if a user exists in the admin_user table.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const [result] = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.userId, userId))
      .limit(1);

    return !!result;
  } catch (error) {
    console.error("Failed to check admin user status:", error);
    throw error;
  }
}

/**
 * Add a user as an admin.
 */
export async function addAdminUser(
  userId: string,
  createdByUserId: string | null,
) {
  try {
    const [result] = await db
      .insert(adminUser)
      .values({
        userId,
        createdBy: createdByUserId,
      })
      .returning();

    return result;
  } catch (error) {
    console.error("Failed to add admin user:", error);
    throw error;
  }
}

/**
 * Remove a user from the admin_user table.
 */
export async function removeAdminUser(userId: string) {
  try {
    const [result] = await db
      .delete(adminUser)
      .where(eq(adminUser.userId, userId))
      .returning();

    return result ?? null;
  } catch (error) {
    console.error("Failed to remove admin user:", error);
    throw error;
  }
}
