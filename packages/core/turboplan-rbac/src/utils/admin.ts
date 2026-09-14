/**
 * Admin role utilities for TurboPlan
 *
 * Provides functions to check if a user has super admin privileges
 * based on the ADMIN_EMAILS environment variable.
 */

import { getAdminEmails } from "@wildfires-org/turboplan-env";

/**
 * Checks if a user email is in the super admin allowlist.
 *
 * Reads the ADMIN_EMAILS environment variable internally via turboplan-env.
 *
 * @param email - The user's email address
 * @returns true if the email is in the admin allowlist
 */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }

  const adminEmails = getAdminEmails()
    .split("|")
    .map((e: string) => e.trim().toLowerCase());

  return adminEmails.includes(email.toLowerCase());
}
