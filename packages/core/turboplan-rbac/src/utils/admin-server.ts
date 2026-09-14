/**
 * Server-side admin utilities that require database access.
 *
 * These must NOT be exported from the main index to avoid
 * bundling server-only code in client bundles.
 */

import { isAdminUser } from "@wildfires-org/turboplan-db/queries";

import { isSuperAdmin } from "./admin";

/**
 * Checks if a user is an admin (either super admin via env or regular admin via DB).
 *
 * @param userId - The user's ID
 * @param email - The user's email (optional, avoids a DB lookup if provided)
 * @returns true if the user is a super admin or exists in the admin_user table
 */
export async function isAdmin(
  userId: string,
  email?: string | null,
): Promise<boolean> {
  // Check super admin first (fast, no DB)
  if (email && isSuperAdmin(email)) {
    return true;
  }

  // Check DB admin_user table
  return isAdminUser(userId);
}
