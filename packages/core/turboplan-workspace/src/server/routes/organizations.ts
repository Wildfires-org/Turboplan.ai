import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import {
  assertSeatAvailable,
  syncSubscriptionSeatsSafe,
} from "@wildfires-org/turboplan-billing/server";
import {
  OwnershipStatus,
  organizationUsers,
  profile,
  project,
  projectSubmission,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getUser } from "@wildfires-org/turboplan-db/queries";
import {
  Action,
  EntityType,
  VALID_MEMBER_ROLES,
} from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  isSessionAdmin,
  type RBACContext,
  requireMemberPermission,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { RBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  deleteReplacedStorageFiles,
  isAllowedStorageUrlUpdate,
  type StorageOwner,
} from "@wildfires-org/turboplan-upload/server";
import {
  generateUniqueSlug,
  normalizeEmailDomains,
} from "@wildfires-org/turboplan-utils/server";

import type { PendingInvitation } from "../../types";
import { sendMemberAddedNotification } from "../invitations/email";
import { getEntityInvitationsWithInviter } from "../invitations/queries";
import { getInvitationService } from "../invitations/service";
import {
  getGovernmentOrganizations,
  getOrganizationById,
  getOrganizationsWithOffices,
  getUserAccessibleOrganizations,
  updateOrganization,
} from "../organizations/queries";
import {
  editOrganizationEmailDomainsSchema,
  editOrganizationSchema,
} from "../organizations/validation";
import { seatLimitResponse } from "./seat-gate";

export const organizationsRouter = new Hono<RBACContext>();

// GET / - List user's accessible organizations (no RBAC required)
organizationsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [accessibleOrgs, governmentOrgs] = await Promise.all([
      getUserAccessibleOrganizations(user.userId),
      getGovernmentOrganizations(),
    ]);

    // Merge and deduplicate by id
    const orgMap = new Map<string, (typeof accessibleOrgs)[number]>();
    for (const org of accessibleOrgs) {
      orgMap.set(org.id, org);
    }
    for (const org of governmentOrgs) {
      if (!orgMap.has(org.id)) {
        orgMap.set(org.id, org);
      }
    }

    return c.json(Array.from(orgMap.values()));
  } catch (error) {
    console.error("Failed to get organizations:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// GET /with-offices - List all government organizations with nested offices and access indicators
organizationsRouter.get("/with-offices", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const result = await getOrganizationsWithOffices(user.userId);
    return c.json(result);
  } catch (error) {
    console.error("Failed to get organizations with offices:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// GET /:id - Get single organization (RBAC: READ permission)
organizationsRouter.get(
  "/:id",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.READ,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const organization = await getOrganizationById(id);

      if (!organization) {
        return c.json({ error: "Organization not found" }, 404);
      }

      return c.json(organization);
    } catch (error) {
      console.error("Failed to get organization:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id - Update organization (RBAC: UPDATE permission)
organizationsRouter.put(
  "/:id",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if organization exists
      const organization = await getOrganizationById(id);
      if (!organization) {
        return c.json({ error: "Organization not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body with Zod schema
      const validationResult = editOrganizationSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const {
        name,
        shortName,
        description,
        country,
        type,
        status,
        logoUrl,
        documentLogoUrl,
        documentFooterText,
        documentFooterNote,
        documentFooterLogoUrl,
      } = validationResult.data;

      // Org `type` and `status` control public cataloging and email-domain
      // affiliation, so changing either requires platform-admin privileges — an
      // org-level UPDATE role is not enough. Unchanged values pass through so a
      // non-admin editor can still save the rest of the form (the edit dialog
      // always sends type/status). Mirrors the MCP update_organization gate.
      if (type !== organization.type || status !== organization.status) {
        if (!(await isSessionAdmin(c))) {
          return c.json(
            {
              error:
                "Only platform administrators can change organization type or status.",
            },
            403,
          );
        }
      }

      // Logo fields may only point into our bucket at objects this caller (or
      // this org) owns — otherwise the replaced-logo cleanup below could be
      // aimed at another tenant's object. External links are unaffected.
      const storageOwner: StorageOwner = {
        userId: c.get("user").userId,
        organizationId: id,
      };
      const logoFields = [
        [logoUrl, organization.logoUrl],
        [documentLogoUrl, organization.documentLogoUrl],
        [documentFooterLogoUrl, organization.documentFooterLogoUrl],
      ] as const;
      if (
        logoFields.some(
          ([next, current]) =>
            !isAllowedStorageUrlUpdate(next, current, storageOwner),
        )
      ) {
        return c.json(
          { error: "Logo URLs must reference your own uploads" },
          400,
        );
      }

      // Generate new slug if name is changing
      let newSlug: string | undefined;
      if (name && name !== organization.name) {
        newSlug = generateUniqueSlug(name);
      }

      await updateOrganization({
        id,
        name,
        shortName: shortName || undefined,
        slug: newSlug,
        description,
        country: country || undefined,
        type,
        status,
        logoUrl,
        documentLogoUrl,
        documentFooterText,
        documentFooterNote,
        documentFooterLogoUrl,
      });

      // Clean up old logos from storage once the row no longer points at them.
      await deleteReplacedStorageFiles(logoFields, storageOwner);

      // Return updated organization
      const updatedOrganization = await getOrganizationById(id);
      return c.json(updatedOrganization);
    } catch (error) {
      console.error("Failed to update organization:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id/email-domains - Replace the org's auto-affiliation email domains.
// Owner-only (RBAC: MANAGE_MEMBERS): these domains auto-join users to the org,
// so this stays a dedicated route separate from the editor-level PUT /:id.
organizationsRouter.put(
  "/:id/email-domains",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if organization exists
      const organization = await getOrganizationById(id);
      if (!organization) {
        return c.json({ error: "Organization not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body with Zod schema
      const validationResult =
        editOrganizationEmailDomainsSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      // Normalize (lowercase + trim) and reject public providers before writing.
      const normalized = normalizeEmailDomains(
        validationResult.data.emailDomains,
      );
      if (!normalized.ok) {
        return c.json({ error: normalized.error }, 400);
      }

      // Dedupe the normalized domains so repeats collapse to one entry.
      const emailDomains = Array.from(new Set(normalized.domains));

      await updateOrganization({ id, emailDomains });

      return c.json({ emailDomains });
    } catch (error) {
      console.error("Failed to update organization email domains:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// GET /:id/members - List members (RBAC: READ from a role on the org itself —
// upward READ from a child project/office membership does not expose staff)
organizationsRouter.get(
  "/:id/members",
  requireMemberPermission(
    EntityType.ORGANIZATION,
    Action.READ,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id")!;

      // Get all members with user details and profile
      const members = await db
        .select({
          userId: organizationUsers.userId,
          role: organizationUsers.role,
          createdAt: organizationUsers.createdAt,
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
        .from(organizationUsers)
        .innerJoin(user, eq(organizationUsers.userId, user.id))
        .leftJoin(profile, eq(user.id, profile.userId))
        .where(eq(organizationUsers.organizationId, orgId));

      // Get pending invitations for this organization
      const invitationsData = await getEntityInvitationsWithInviter(
        "organization",
        orgId,
      );

      const pendingInvitations: PendingInvitation[] = invitationsData.map(
        (inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          invitedBy: {
            id: inv.invitedBy,
            email: inv.inviterEmail,
            firstName: inv.inviterFirstName,
            lastName: inv.inviterLastName,
          },
        }),
      );

      return c.json({ members, pendingInvitations });
    } catch (error) {
      console.error("Error fetching organization members:", error);
      return c.json({ error: "Failed to fetch members" }, 500);
    }
  },
);

// GET /:id/submissions - List pending project submissions targeting this
// organization so its owners can review incoming ownership-transfer requests.
// Gated to org owners via MANAGE_MEMBERS (same bar as reviewing a submission).
organizationsRouter.get(
  "/:id/submissions",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id")!;

      const submissions = await db
        .select({
          id: projectSubmission.id,
          projectId: projectSubmission.projectId,
          projectName: project.name,
          projectSlug: project.slug,
          targetOfficeId: projectSubmission.targetOfficeId,
          submitterEmail: user.email,
          submittedAt: projectSubmission.createdAt,
        })
        .from(projectSubmission)
        .innerJoin(project, eq(projectSubmission.projectId, project.id))
        .innerJoin(user, eq(projectSubmission.submittedBy, user.id))
        .where(
          and(
            eq(projectSubmission.targetOrganizationId, orgId),
            eq(project.ownershipStatus, OwnershipStatus.SUBMITTED),
          ),
        );

      return c.json(submissions);
    } catch (error) {
      console.error("Error fetching organization submissions:", error);
      return c.json({ error: "Failed to fetch submissions" }, 500);
    }
  },
);

// POST /:id/members - Add member or send invitation (RBAC: MANAGE_MEMBERS)
organizationsRouter.post(
  "/:id/members",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id")!;
      const authUser = c.get("user");
      const body = await c.req.json();
      const { email, role } = body;

      if (!email || !role) {
        return c.json({ error: "email and role are required" }, 400);
      }

      // Validate role
      if (!VALID_MEMBER_ROLES.includes(role)) {
        return c.json({ error: "Invalid role" }, 400);
      }

      // Look up user by email
      const users = await getUser(email);

      // Starter seat cap: adding a non-viewer beyond the included seats is
      // blocked on plans without purchasable seats. Runs before BOTH branches
      // (direct add and invitation) — an invite is a seat-in-waiting.
      if (role !== "viewer") {
        const seatDecision = await assertSeatAvailable({
          organizationId: orgId,
          userId: users[0]?.id,
        });
        if (!seatDecision.allowed) {
          return seatLimitResponse(c, seatDecision);
        }
      }

      if (users[0]) {
        // User exists - add directly to membership
        const userId = users[0].id;

        // Check if user already has a membership
        const rbacService = getRBACServiceForRequest(c);
        const existingMembership = await rbacService.getUserMembershipForEntity(
          userId,
          orgId,
          EntityType.ORGANIZATION,
        );

        if (existingMembership) {
          return c.json(
            { error: "User already has a membership in this organization" },
            400,
          );
        }

        // Add the membership
        await rbacService.addMembership(
          userId,
          orgId,
          EntityType.ORGANIZATION,
          role,
        );

        // Keep Stripe seat quantity in sync (non-viewer roles are billable).
        await syncSubscriptionSeatsSafe(orgId);

        // Notify the existing user that they were added (best-effort).
        try {
          await sendMemberAddedNotification({
            entityType: "organization",
            entityId: orgId,
            memberUserId: userId,
            addedByUserId: authUser.userId,
          });
        } catch (error) {
          console.error("Failed to send member-added notification:", error);
        }

        return c.json({
          success: true,
          type: "member",
          membership: {
            userId,
            organizationId: orgId,
            role,
          },
        });
      } else {
        // User doesn't exist - create invitation
        const invitationService = getInvitationService();
        const result = await invitationService.createInvitation({
          email,
          entityType: "organization",
          entityId: orgId,
          role,
          invitedBy: authUser.userId,
        });

        if (!result) {
          // This shouldn't happen since we already checked user doesn't exist
          return c.json({ error: "Failed to create invitation" }, 500);
        }

        return c.json({
          success: true,
          type: "invitation",
          invitationId: result.invitationId,
          isExisting: result.isExisting,
        });
      }
    } catch (error) {
      console.error("Error adding organization member:", error);
      return c.json({ error: "Failed to add member" }, 500);
    }
  },
);

// PATCH /:id/members - Update member role (RBAC: MANAGE_MEMBERS)
organizationsRouter.patch(
  "/:id/members",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id")!;
      const body = await c.req.json();
      const { userId, role } = body;

      if (!userId || !role) {
        return c.json({ error: "userId and role are required" }, 400);
      }

      // Validate role
      if (!VALID_MEMBER_ROLES.includes(role)) {
        return c.json({ error: "Invalid role" }, 400);
      }

      // Starter seat cap: promoting into the billable set counts as adding a
      // seat; already-billable users pass via the userId short-circuit.
      if (role !== "viewer") {
        const seatDecision = await assertSeatAvailable({
          organizationId: orgId,
          userId,
        });
        if (!seatDecision.allowed) {
          return seatLimitResponse(c, seatDecision);
        }
      }

      const authUser = c.get("user");

      // Use transaction to prevent race condition on last owner check
      // Note: There's a theoretical race condition between permission check and transaction start,
      // but the risk is negligible in practice (requires simultaneous removal of last 2 owners)
      // and the transaction provides strong consistency for the critical check+update operation.
      await db.transaction(async (transaction) => {
        const rbacService = new RBACService(transaction);

        // Don't allow owners to demote themselves out of ownership if
        // they're the last owner — mirrors the DELETE last-owner guard, but
        // for role changes rather than removal.
        if (userId === authUser.userId && role !== "owner") {
          await rbacService.ensureNotLastOwner(
            userId,
            orgId,
            EntityType.ORGANIZATION,
          );
        }

        await rbacService.updateMembershipRole(
          userId,
          orgId,
          EntityType.ORGANIZATION,
          role,
        );
      });

      // Role change can move a member in/out of the billable (non-viewer) set.
      await syncSubscriptionSeatsSafe(orgId);

      return c.json({
        success: true,
        membership: {
          userId,
          organizationId: orgId,
          role,
        },
      });
    } catch (error) {
      console.error("Error updating organization member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);

// DELETE /:id/members - Remove member with last-owner check (RBAC: MANAGE_MEMBERS)
organizationsRouter.delete(
  "/:id/members",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id")!;
      const userId = c.req.query("userId");
      const authUser = c.get("user");

      if (!userId) {
        return c.json({ error: "userId is required" }, 400);
      }

      // Use transaction to prevent race condition on last owner check
      // Note: There's a theoretical race condition between permission check and transaction start,
      // but the risk is negligible in practice (requires simultaneous removal of last 2 owners)
      // and the transaction provides strong consistency for the critical check+delete operation.
      await db.transaction(async (transaction) => {
        const rbacService = new RBACService(transaction);

        // Don't allow users to remove themselves if they're the last owner
        if (userId === authUser.userId) {
          await rbacService.ensureNotLastOwner(
            userId,
            orgId,
            EntityType.ORGANIZATION,
          );
        }

        // Remove the membership (within same transaction)
        await rbacService.removeMembership(
          userId,
          orgId,
          EntityType.ORGANIZATION,
        );
      });

      // Removing a non-viewer frees a seat — push the new count to Stripe.
      await syncSubscriptionSeatsSafe(orgId);

      return c.json({ success: true });
    } catch (error) {
      console.error("Error removing organization member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);
