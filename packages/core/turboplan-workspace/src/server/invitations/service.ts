import {
  assertSeatAvailable,
  BillingError,
  syncSubscriptionSeatsSafe,
} from "@wildfires-org/turboplan-billing/server";
import {
  createMagicLinkUser,
  getProfileByUserId,
  getUser,
  getUserByEmail,
  getUserById,
  markEmailAsVerified,
} from "@wildfires-org/turboplan-db/queries";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

import { getOfficeById } from "../offices/queries";
import { getProjectById } from "../projects/queries";
import { sendInvitationEmail } from "./email";
import {
  decideAutoSignup,
  InvitationEmailMismatchError,
  isInvitationEmailMatch,
} from "./policy";
import {
  createInvitation as createInvitationRecord,
  getExistingInvitation,
  getInvitationById,
  getInvitationWithDetails,
  updateInvitationStatus,
  updateInvitationToken,
} from "./queries";
import {
  type AcceptInvitationResult,
  type AcceptWithAutoSignupResult,
  type CreateInvitationParams,
  type InvitationEntityType,
  type InvitationRole,
  type InvitationWithEntity,
  mapToRBACEntityType,
  type TaskAssignment,
} from "./types";
import {
  calculateExpirationDate,
  generateSecureToken,
  hashInvitationToken,
} from "./utils";

/**
 * InvitationService handles all invitation business logic
 */
export class InvitationService {
  /**
   * Create a new invitation and send email
   * If user already exists, returns null (caller should add directly)
   * If invitation already exists for this email+entity, returns existing invitation
   */
  async createInvitation(params: CreateInvitationParams): Promise<{
    invitationId: string;
    isExisting: boolean;
    /**
     * Raw (unhashed) invitation token — the value that goes in the emailed
     * link. Only present when a NEW invitation was created; the DB stores just
     * its hash, so it cannot be recovered afterwards. Never return this to an
     * API client; it is the invitation credential.
     */
    rawToken?: string;
  } | null> {
    const {
      email,
      entityType,
      entityId,
      role,
      invitedBy,
      expiresInDays,
      taskAssignment,
    } = params;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUsers = await getUser(normalizedEmail);
    if (existingUsers.length > 0) {
      // User exists - return null to signal caller should add directly
      return null;
    }

    // Check for existing pending invitation
    const existingInvitation = await getExistingInvitation(
      normalizedEmail,
      entityType,
      entityId,
    );

    if (existingInvitation) {
      // Return existing invitation (caller can choose to resend)
      return { invitationId: existingInvitation.id, isExisting: true };
    }

    // Create new invitation. The raw token goes only in the email; the record
    // stores its hash.
    const token = generateSecureToken();
    const expiresAt = calculateExpirationDate(expiresInDays);

    const invitation = await createInvitationRecord({
      token: hashInvitationToken(token),
      email: normalizedEmail,
      role,
      entityType,
      entityId,
      invitedBy,
      status: "pending",
      expiresAt,
      taskAssignment: taskAssignment || null,
    });

    // Send invitation email (raw token in the link)
    await sendInvitationEmail(invitation.id, token);

    return { invitationId: invitation.id, isExisting: false, rawToken: token };
  }

  /**
   * Get invitation details by token (for acceptance page)
   */
  async getInvitationByToken(
    token: string,
  ): Promise<InvitationWithEntity | null> {
    return getInvitationWithDetails(token);
  }

  /**
   * Validate an invitation (check expiration, status, etc.)
   */
  async validateInvitation(token: string): Promise<{
    valid: boolean;
    error?: string;
    invitation?: InvitationWithEntity;
  }> {
    const invitation = await getInvitationWithDetails(token);

    if (!invitation) {
      return { valid: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return {
        valid: false,
        error: `Invitation has already been ${invitation.status}`,
      };
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await updateInvitationStatus(invitation.id, "expired");
      return { valid: false, error: "Invitation has expired" };
    }

    return { valid: true, invitation };
  }

  /**
   * Accept an invitation
   * Creates membership for the user in the target entity. Throws
   * InvitationEmailMismatchError when the user's email is not the invited one.
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<AcceptInvitationResult> {
    const validation = await this.validateInvitation(token);

    if (!validation.valid || !validation.invitation) {
      throw new Error(validation.error || "Invalid invitation");
    }

    const invitation = validation.invitation;

    // Bind acceptance to the invited address: a forwarded/leaked link must not
    // grant access to whichever account happens to redeem it.
    const acceptingUser = await getUserById(userId);
    if (!isInvitationEmailMatch(acceptingUser?.email, invitation.email)) {
      throw new InvitationEmailMismatchError();
    }

    // Check if user is already a member
    const rbacService = getRBACService();
    const rbacEntityType = mapToRBACEntityType(
      invitation.entityType as InvitationEntityType,
    );

    const existingMembership = await rbacService.getUserMembershipForEntity(
      userId,
      invitation.entityId,
      rbacEntityType,
    );

    if (existingMembership) {
      // User is already a member, just mark invitation as accepted
      await updateInvitationStatus(invitation.id, "accepted");
      return {
        success: true,
        userId,
        entityType: invitation.entityType as InvitationEntityType,
        entityId: invitation.entityId,
        role: existingMembership.role as InvitationRole,
      };
    }

    // Resolve the owning organization (office → org, project → office → org)
    // for the seat gate and the post-add Stripe resync.
    const seatOrganizationId = await this.resolveSeatOrganizationId(
      invitation.entityType as InvitationEntityType,
      invitation.entityId,
    );

    // Starter seat cap re-checked at ACCEPT time: seats may have filled since
    // the invitation was created, and the invite-create gate cannot know the
    // accepting user. Viewer invites never consume a seat.
    if (invitation.role !== "viewer" && seatOrganizationId) {
      const seatDecision = await assertSeatAvailable({
        organizationId: seatOrganizationId,
        userId,
      });
      if (!seatDecision.allowed) {
        throw new BillingError(
          "This organization's plan has no seats left. Ask an owner to upgrade before accepting this invitation.",
          "SEAT_LIMIT_REACHED",
          403,
        );
      }
    }

    // Add user to entity
    await rbacService.addMembership(
      userId,
      invitation.entityId,
      rbacEntityType,
      invitation.role as InvitationRole,
    );

    // Accepting an invite adds a billable member at some level. Viewer invites
    // are a no-op inside syncSubscriptionSeats, so resyncing unconditionally
    // is safe.
    if (seatOrganizationId) {
      await syncSubscriptionSeatsSafe(seatOrganizationId);
    }

    // Handle task assignment if present (for project invitations)
    if (invitation.taskAssignment) {
      await this.assignUserToTask(
        userId,
        invitation.entityId,
        invitation.taskAssignment as TaskAssignment,
      );
    }

    // Mark invitation as accepted
    await updateInvitationStatus(invitation.id, "accepted");

    return {
      success: true,
      userId,
      entityType: invitation.entityType as InvitationEntityType,
      entityId: invitation.entityId,
      role: invitation.role as InvitationRole,
    };
  }

  /**
   * Accept an invitation with auto-signup for unauthenticated users.
   * Only for emails with no account yet: creates the account, accepts the
   * invitation, and returns the userId for the caller to complete sign-in.
   * Returns `login_required` when an account already exists.
   *
   * This method handles all the business logic; the caller (server action)
   * handles the authentication/session creation.
   */
  async acceptInvitationWithAutoSignup(
    token: string,
  ): Promise<AcceptWithAutoSignupResult> {
    // 1. Validate the invitation
    const validation = await this.validateInvitation(token);

    if (!validation.valid || !validation.invitation) {
      if (validation.error?.includes("expired")) {
        return { status: "expired", error: validation.error };
      }
      if (validation.error?.includes("accepted")) {
        return { status: "already_accepted" };
      }
      return {
        status: "invalid_invitation",
        error: validation.error || "Invitation not found",
      };
    }

    const invitation = validation.invitation;

    // 2. Only an account created by THIS flow may be signed in here. An
    // account registered after the invite was sent must sign in normally and
    // accept while authenticated; otherwise a forwarded/leaked invitation
    // link would be a login credential for that account.
    const email = invitation.email.toLowerCase().trim();
    const existingUser = await getUserByEmail(email);

    if (decideAutoSignup(existingUser) === "login_required") {
      return { status: "login_required", email };
    }

    // Seat pre-check BEFORE creating an account: a seat-blocked accept must
    // not leave an orphaned, email-verified user behind. The accept-time gate
    // below remains the authoritative check.
    if (invitation.role !== "viewer") {
      const seatOrganizationId = await this.resolveSeatOrganizationId(
        invitation.entityType as InvitationEntityType,
        invitation.entityId,
      );
      if (seatOrganizationId) {
        const seatDecision = await assertSeatAvailable({
          organizationId: seatOrganizationId,
        });
        if (!seatDecision.allowed) {
          return {
            status: "invalid_invitation",
            error:
              "This organization's plan has no seats left. Ask an owner to upgrade before accepting this invitation.",
          };
        }
      }
    }

    // Create the user with the invited email. Clicking the emailed link
    // proves ownership of the address, so mark it verified.
    const [newUser] = await createMagicLinkUser(email);
    const userId = newUser.id;
    await markEmailAsVerified(userId);

    // 3. Accept the invitation (this adds membership)
    try {
      await this.acceptInvitation(token, userId);
    } catch (error) {
      if (
        error instanceof BillingError &&
        error.code === "SEAT_LIMIT_REACHED"
      ) {
        return { status: "invalid_invitation", error: error.message };
      }
      throw error;
    }

    // 4. Determine redirect URL based on profile completeness
    const userProfile = await getProfileByUserId(userId);

    if (!userProfile) {
      return { status: "success", userId, redirectTo: "/setup/personal" };
    }

    const isProfileComplete =
      userProfile.firstName &&
      userProfile.firstName.trim() !== "" &&
      userProfile.lastName &&
      userProfile.lastName.trim() !== "";

    if (!isProfileComplete) {
      return { status: "success", userId, redirectTo: "/setup/personal" };
    }

    // Profile complete - redirect to home
    return { status: "success", userId, redirectTo: "/" };
  }

  /**
   * Revoke a pending invitation
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await getInvitationById(invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("Can only revoke pending invitations");
    }

    await updateInvitationStatus(invitationId, "revoked");
  }

  /**
   * Resend an invitation email (regenerates token and extends expiration)
   */
  async resendInvitation(invitationId: string): Promise<void> {
    const invitation = await getInvitationById(invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("Can only resend pending invitations");
    }

    // Generate new token and extend expiration. Store the hash; email the raw.
    const newToken = generateSecureToken();
    const newExpiresAt = calculateExpirationDate();

    await updateInvitationToken(
      invitationId,
      hashInvitationToken(newToken),
      newExpiresAt,
    );

    // Send new email (raw token in the link)
    await sendInvitationEmail(invitationId, newToken);
  }

  /**
   * Assign user to task/milestone from invitation
   * Uses assignee queries from turboplan-db to avoid circular dependencies
   */
  private async resolveSeatOrganizationId(
    entityType: InvitationEntityType,
    entityId: string,
  ): Promise<string | null> {
    if (entityType === "organization") {
      return entityId;
    }
    if (entityType === "office") {
      const officeRow = await getOfficeById(entityId);
      return officeRow?.organizationId ?? null;
    }
    const projectRow = await getProjectById(entityId);
    const officeRow = projectRow
      ? await getOfficeById(projectRow.officeId)
      : null;
    return officeRow?.organizationId ?? null;
  }

  /**
   * `projectId` is the invitation's own entity: the stored ids are only ever
   * applied inside the project the invitation grants access to.
   */
  private async assignUserToTask(
    userId: string,
    projectId: string,
    taskAssignment: TaskAssignment,
  ): Promise<void> {
    const { taskId, milestoneId } = taskAssignment;

    if (!taskId && !milestoneId) {
      return; // Nothing to assign
    }

    try {
      const { assignUserToTaskAndMilestone } = await import(
        "@wildfires-org/turboplan-db/queries"
      );
      await assignUserToTaskAndMilestone({
        projectId,
        userId,
        taskId,
        milestoneId,
      });
    } catch (error) {
      // Log error but don't fail the invitation acceptance
      console.error("Failed to assign user to task:", error);
    }
  }
}

// Singleton instance
let invitationServiceInstance: InvitationService | null = null;

/**
 * Get the singleton InvitationService instance
 */
export function getInvitationService(): InvitationService {
  if (!invitationServiceInstance) {
    invitationServiceInstance = new InvitationService();
  }
  return invitationServiceInstance;
}
