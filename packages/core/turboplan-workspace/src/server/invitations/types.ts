import type { Invitation, TaskAssignment } from "@wildfires-org/turboplan-db";
import { EntityType, type EntityTypeType } from "@wildfires-org/turboplan-rbac";

// Re-export TaskAssignment for convenience
export type { TaskAssignment } from "@wildfires-org/turboplan-db";

// Entity types that can have invitations
export type InvitationEntityType = "organization" | "office" | "project";

// Invitation roles
export type InvitationRole = "owner" | "editor" | "viewer";

// Invitation status
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

// Parameters for creating an invitation
export interface CreateInvitationParams {
  email: string;
  entityType: InvitationEntityType;
  entityId: string;
  role: InvitationRole;
  invitedBy: string;
  expiresInDays?: number; // defaults to DEFAULT_EXPIRATION_DAYS
  taskAssignment?: TaskAssignment; // optional task/milestone to assign upon acceptance
}

// Invitation with entity details for display
export interface InvitationWithEntity extends Invitation {
  entityName: string;
  inviterName: string;
  inviterEmail: string;
}

// Result of accepting an invitation
export interface AcceptInvitationResult {
  success: boolean;
  userId: string;
  entityType: InvitationEntityType;
  entityId: string;
  role: InvitationRole;
}

// Result of accepting invitation with auto-signup (for unauthenticated users)
export interface AcceptWithAutoSignupResult {
  status:
    | "success"
    | "failed"
    | "invalid_invitation"
    | "expired"
    | "already_accepted"
    // An account already exists for the invited email: it must sign in and
    // accept while authenticated (the invite link never signs it in).
    | "login_required";
  userId?: string;
  /** Invited email, set with `login_required` to prefill the login form. */
  email?: string;
  redirectTo?: string;
  error?: string;
}

/**
 * Map invitation entity type to RBAC entity type.
 * Centralized mapping function to avoid duplication across files.
 */
export function mapToRBACEntityType(
  entityType: InvitationEntityType,
): EntityTypeType {
  switch (entityType) {
    case "organization":
      return EntityType.ORGANIZATION;
    case "office":
      return EntityType.OFFICE;
    case "project":
      return EntityType.PROJECT;
  }
}
