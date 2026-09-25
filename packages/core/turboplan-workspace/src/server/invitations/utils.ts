import { createHash, randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";

import {
  office,
  organization,
  profile,
  project,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getUser } from "@wildfires-org/turboplan-db/queries";

import type { InvitationEntityType } from "./types";

// Default invitation expiration in days. Kept short: the link is a bearer
// credential that creates (and signs in) the invited account.
export const DEFAULT_EXPIRATION_DAYS = 3;

/**
 * Generate a secure random token for invitation URLs (the raw value that goes
 * in the emailed link; only its hash is stored).
 */
export function generateSecureToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

/**
 * Hash an invitation token for storage/lookup. The raw token is only ever in
 * the emailed URL; the DB stores this SHA-256 hex (64 chars, fits the column),
 * so a DB/backup leak no longer yields working invitation links.
 */
export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(
  days: number = DEFAULT_EXPIRATION_DAYS,
): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Get entity name by type and ID
 */
export async function getEntityName(
  entityType: InvitationEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === "organization") {
    const [org] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, entityId))
      .limit(1);
    return org?.name || "Unknown Organization";
  } else if (entityType === "office") {
    const [off] = await db
      .select({ name: office.name })
      .from(office)
      .where(eq(office.id, entityId))
      .limit(1);
    return off?.name || "Unknown Office";
  } else {
    const [proj] = await db
      .select({ name: project.name })
      .from(project)
      .where(and(eq(project.id, entityId), isNull(project.deletedAt)))
      .limit(1);
    return proj?.name || "Unknown Project";
  }
}

/**
 * Get inviter display name
 */
export async function getInviterName(inviterId: string): Promise<string> {
  const [inviter] = await db
    .select({
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    .from(profile)
    .where(eq(profile.userId, inviterId))
    .limit(1);

  if (inviter?.firstName || inviter?.lastName) {
    return [inviter.firstName, inviter.lastName].filter(Boolean).join(" ");
  }

  // Fallback to email
  const users = await getUser(inviterId);
  return users[0]?.email || "Someone";
}
