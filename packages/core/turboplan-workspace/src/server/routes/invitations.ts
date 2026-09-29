import { Hono } from "hono";

import { BillingError } from "@wildfires-org/turboplan-billing/server";
import { Action } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  isMembershipGrant,
  NO_PERMISSION_REASON,
  type RBACContext,
} from "@wildfires-org/turboplan-rbac/hono";

import { InvitationEmailMismatchError } from "../invitations/policy";
import {
  getEntityInvitationsWithInviter,
  getInvitationById,
} from "../invitations/queries";
import { getInvitationService } from "../invitations/service";
import {
  type InvitationEntityType,
  mapToRBACEntityType,
} from "../invitations/types";
import {
  acceptInvitationSchema,
  invitationEntityTypeSchema,
} from "../invitations/validation";

// ============================================================================
// Public Invitations Router (no authentication required)
// ============================================================================

export const publicInvitationsRouter = new Hono();

// GET /:token - Get invitation details for acceptance page (public)
publicInvitationsRouter.get("/:token", async (c) => {
  try {
    const token = c.req.param("token");

    const invitationService = getInvitationService();
    const invitation = await invitationService.getInvitationByToken(token);

    if (!invitation) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    // Return safe invitation details (no sensitive data like id or token)
    return c.json({
      email: invitation.email,
      role: invitation.role,
      entityType: invitation.entityType,
      entityName: invitation.entityName,
      inviterName: invitation.inviterName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return c.json({ error: "Failed to fetch invitation" }, 500);
  }
});

// ============================================================================
// Private Invitations Router (authentication required)
// ============================================================================

export const invitationsRouter = new Hono<RBACContext>();

// POST /accept - Accept an invitation (authenticated user)
invitationsRouter.post("/accept", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const validationResult = acceptInvitationSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { token } = validationResult.data;

    const invitationService = getInvitationService();

    // Validate invitation first
    const validation = await invitationService.validateInvitation(token);

    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Accept the invitation
    const result = await invitationService.acceptInvitation(token, user.userId);

    return c.json({
      success: true,
      entityType: result.entityType,
      entityId: result.entityId,
      role: result.role,
    });
  } catch (error) {
    if (error instanceof InvitationEmailMismatchError) {
      return c.json(
        { error: error.message, code: "INVITATION_EMAIL_MISMATCH" },
        403,
      );
    }
    // Seat-cap rejections are client-actionable, not server faults.
    if (error instanceof BillingError && error.code === "SEAT_LIMIT_REACHED") {
      return c.json({ error: error.message, code: error.code }, 403);
    }
    console.error("Error accepting invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to accept invitation";
    return c.json({ error: message }, 500);
  }
});

// DELETE /:id - Revoke an invitation (requires MANAGE_MEMBERS on entity)
invitationsRouter.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const invitationId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get invitation to check entity
    const invitation = await getInvitationById(invitationId);

    if (!invitation) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    // Map entity type to RBAC entity type
    const rbacEntityType = mapToRBACEntityType(
      invitation.entityType as InvitationEntityType,
    );

    // Check MANAGE_MEMBERS permission on the entity
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      invitation.entityId,
      rbacEntityType,
      Action.MANAGE_MEMBERS,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Revoke the invitation
    const invitationService = getInvitationService();
    await invitationService.revokeInvitation(invitationId);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to revoke invitation";
    const statusCode = message.includes("pending") ? 400 : 500;
    return c.json({ error: message }, statusCode);
  }
});

// POST /:id/resend - Resend invitation email (requires MANAGE_MEMBERS on entity)
invitationsRouter.post("/:id/resend", async (c) => {
  try {
    const user = c.get("user");
    const invitationId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get invitation to check entity
    const invitation = await getInvitationById(invitationId);

    if (!invitation) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    // Map entity type to RBAC entity type
    const rbacEntityType = mapToRBACEntityType(
      invitation.entityType as InvitationEntityType,
    );

    // Check MANAGE_MEMBERS permission on the entity
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      invitation.entityId,
      rbacEntityType,
      Action.MANAGE_MEMBERS,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Resend the invitation
    const invitationService = getInvitationService();
    await invitationService.resendInvitation(invitationId);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error resending invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to resend invitation";
    const statusCode = message.includes("pending") ? 400 : 500;
    return c.json({ error: message }, statusCode);
  }
});

// GET /entity/:entityType/:entityId - List pending invitations for an entity
// Used by ManageMembersDialog to show pending invitations
invitationsRouter.get("/entity/:entityType/:entityId", async (c) => {
  try {
    const user = c.get("user");
    const entityType = c.req.param("entityType");
    const entityId = c.req.param("entityId");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Validate entity type
    const entityTypeResult = invitationEntityTypeSchema.safeParse(entityType);
    if (!entityTypeResult.success) {
      return c.json({ error: "Invalid entity type" }, 400);
    }

    // Map entity type to RBAC entity type
    const rbacEntityType = mapToRBACEntityType(entityTypeResult.data);

    // Pending invitations expose invitee emails, roles and inviters, so READ
    // must come from a role on the entity itself (or a parent). READ derived
    // upward from a single child project membership does not qualify.
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      entityId,
      rbacEntityType,
      Action.READ,
    );

    if (!isMembershipGrant(permissionResult)) {
      return c.json({ error: "Forbidden", reason: NO_PERMISSION_REASON }, 403);
    }

    // Get pending invitations
    const invitations = await getEntityInvitationsWithInviter(
      entityTypeResult.data,
      entityId,
    );

    return c.json({ invitations });
  } catch (error) {
    console.error("Error fetching entity invitations:", error);
    return c.json({ error: "Failed to fetch invitations" }, 500);
  }
});
