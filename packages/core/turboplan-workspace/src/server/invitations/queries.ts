import { and, eq, isNull } from "drizzle-orm";

import {
  type Invitation,
  invitations,
  type NewInvitation,
  office,
  organization,
  profile,
  project,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import type {
  InvitationEntityType,
  InvitationStatus,
  InvitationWithEntity,
} from "./types";
import { hashInvitationToken } from "./utils";

/**
 * Create a new invitation record
 */
export async function createInvitation(
  data: NewInvitation,
): Promise<Invitation> {
  const [result] = await db.insert(invitations).values(data).returning();
  return result;
}

/**
 * Get invitation by token (for acceptance flow). Accepts the RAW token from the
 * URL and matches against the stored hash.
 */
export async function getInvitationByToken(
  token: string,
): Promise<Invitation | null> {
  const [result] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, hashInvitationToken(token)))
    .limit(1);
  return result || null;
}

/**
 * Get invitation by ID
 */
export async function getInvitationById(
  id: string,
): Promise<Invitation | null> {
  const [result] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, id))
    .limit(1);
  return result || null;
}

/**
 * Get invitation with entity and inviter details (for display)
 */
export async function getInvitationWithDetails(
  token: string,
): Promise<InvitationWithEntity | null> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return null;

  // Get inviter details
  const [inviterData] = await db
    .select({
      email: user.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    .from(user)
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(eq(user.id, invitation.invitedBy))
    .limit(1);

  // Get entity name based on type
  let entityName = "Unknown";
  if (invitation.entityType === "organization") {
    const [org] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, invitation.entityId))
      .limit(1);
    entityName = org?.name || "Unknown Organization";
  } else if (invitation.entityType === "office") {
    const [off] = await db
      .select({ name: office.name })
      .from(office)
      .where(eq(office.id, invitation.entityId))
      .limit(1);
    entityName = off?.name || "Unknown Office";
  } else if (invitation.entityType === "project") {
    const [proj] = await db
      .select({ name: project.name })
      .from(project)
      .where(
        and(eq(project.id, invitation.entityId), isNull(project.deletedAt)),
      )
      .limit(1);
    entityName = proj?.name || "Unknown Project";
  }

  const inviterName = inviterData
    ? [inviterData.firstName, inviterData.lastName].filter(Boolean).join(" ") ||
      inviterData.email
    : "Unknown User";

  return {
    ...invitation,
    entityName,
    inviterName,
    inviterEmail: inviterData?.email || "",
  };
}

/**
 * Get all pending invitations for an entity
 */
export async function getEntityInvitations(
  entityType: InvitationEntityType,
  entityId: string,
): Promise<Invitation[]> {
  return db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.entityType, entityType),
        eq(invitations.entityId, entityId),
        eq(invitations.status, "pending"),
      ),
    );
}

/**
 * Get existing pending invitation for email + entity combination
 */
export async function getExistingInvitation(
  email: string,
  entityType: InvitationEntityType,
  entityId: string,
): Promise<Invitation | null> {
  const [result] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email.toLowerCase()),
        eq(invitations.entityType, entityType),
        eq(invitations.entityId, entityId),
        eq(invitations.status, "pending"),
      ),
    )
    .limit(1);
  return result || null;
}

/**
 * Update invitation status
 */
export async function updateInvitationStatus(
  id: string,
  status: InvitationStatus,
): Promise<void> {
  await db
    .update(invitations)
    .set({ status, updatedAt: new Date() })
    .where(eq(invitations.id, id));
}

/**
 * Update invitation token (for resend)
 */
export async function updateInvitationToken(
  id: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .update(invitations)
    .set({ token, expiresAt, updatedAt: new Date() })
    .where(eq(invitations.id, id));
}

/**
 * Delete invitation (hard delete)
 */
export async function deleteInvitation(id: string): Promise<void> {
  await db.delete(invitations).where(eq(invitations.id, id));
}

/**
 * Get pending invitations with inviter details for an entity.
 *
 * Deliberately omits `token`: this feeds member-list endpoints whose callers
 * only need READ on the entity. The column holds the SHA-256 hash of the invite
 * token rather than the raw one, so leaking it does not directly hand over an
 * acceptance credential — but nothing in these responses needs it, and shipping
 * a token hash to every reader only invites offline guessing.
 */
export async function getEntityInvitationsWithInviter(
  entityType: InvitationEntityType,
  entityId: string,
): Promise<
  Array<
    Omit<Invitation, "token"> & {
      inviterEmail: string;
      inviterFirstName: string | null;
      inviterLastName: string | null;
    }
  >
> {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      entityType: invitations.entityType,
      entityId: invitations.entityId,
      invitedBy: invitations.invitedBy,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      taskAssignment: invitations.taskAssignment,
      createdAt: invitations.createdAt,
      updatedAt: invitations.updatedAt,
      inviterEmail: user.email,
      inviterFirstName: profile.firstName,
      inviterLastName: profile.lastName,
    })
    .from(invitations)
    .innerJoin(user, eq(invitations.invitedBy, user.id))
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(
      and(
        eq(invitations.entityType, entityType),
        eq(invitations.entityId, entityId),
        eq(invitations.status, "pending"),
      ),
    );
}
