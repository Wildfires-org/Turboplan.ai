import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";

import {
  assertSeatAvailable,
  syncSubscriptionSeatsSafe,
} from "@wildfires-org/turboplan-billing/server";
import {
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  PUBLICLY_LISTED_ORG_TYPES,
  project,
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
  type RBACContext,
  requireMemberPermission,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { RBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  deleteReplacedStorageFiles,
  isAllowedStorageUrlUpdate,
} from "@wildfires-org/turboplan-upload/server";
import { generateUniqueSlug } from "@wildfires-org/turboplan-utils/server";

import type { MemberWithInheritance, PendingInvitation } from "../../types";
import { ROLE_LEVEL } from "../constants";
import { sendMemberAddedNotification } from "../invitations/email";
import { getEntityInvitationsWithInviter } from "../invitations/queries";
import { getInvitationService } from "../invitations/service";
import {
  createOffice,
  deleteOffice,
  getOfficeById,
  getOfficeWithRelations,
  getUserAccessibleOffices,
  updateOffice,
} from "../offices/queries";
import {
  createOfficeSchema,
  officeFiltersSchema,
  updateOfficeSchema,
} from "../offices/validation";
import { getOrganizationBySlug } from "../organizations/queries";
import { selectMembersFrom } from "../queries";
import { seatLimitResponse } from "./seat-gate";

export const officesRouter = new Hono<RBACContext>();

/**
 * Resolve the office's organization and push the current billable-seat count to
 * Stripe. Office-level owner/editor members count toward org seats. Best-effort
 * (never throws — Stripe issues must not fail the membership mutation).
 */
const syncSeatsForOffice = async (officeId: string): Promise<void> => {
  const officeRow = await getOfficeById(officeId);
  if (officeRow) {
    await syncSubscriptionSeatsSafe(officeRow.organizationId);
  }
};

// GET / - List offices (RBAC: READ on parent org via ?organizationSlug)
// Accepts organizationSlug query param
officesRouter.get("/", async (c) => {
  // NOTE: We manually check RBAC here because we need to resolve the slug first
  // to get the organization ID for permission check
  try {
    const user = c.get("user");
    const organizationSlug = c.req.query("organizationSlug");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!organizationSlug) {
      return c.json({ error: "organizationSlug is required" }, 400);
    }

    // Resolve slug to get organization
    const { entity: org } = await getOrganizationBySlug(organizationSlug);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    // Publicly-listed organizations (government + environmental planning) are
    // publicly visible — skip RBAC for read access.
    const isPubliclyListedOrg = PUBLICLY_LISTED_ORG_TYPES.includes(
      org.type as OrganizationType,
    );

    if (!isPubliclyListedOrg) {
      // Check RBAC permission on the resolved organization
      const rbacService = getRBACServiceForRequest(c);
      const permissionResult = await rbacService.checkPermission(
        user.userId,
        org.id,
        EntityType.ORGANIZATION,
        Action.READ,
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
    }

    // Parse and validate query parameters
    const rawFilters = {
      status: c.req.query("status") || undefined,
      offset: c.req.query("offset")
        ? Number.parseInt(c.req.query("offset")!)
        : undefined,
      limit: c.req.query("limit")
        ? Number.parseInt(c.req.query("limit")!)
        : undefined,
      sortBy: c.req.query("sortBy") || undefined,
      sortOrder: c.req.query("sortOrder") || undefined,
      search: c.req.query("search") || undefined,
    };

    const validationResult = officeFiltersSchema.safeParse(rawFilters);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    // Get offices user has access to via RBAC (includes upward access from projects)
    const offices = await getUserAccessibleOffices(
      user.userId,
      org.id,
      org.type,
    );

    // Apply client-side filters
    let filteredOffices = offices;
    const filters = validationResult.data;

    if (filters.status) {
      filteredOffices = filteredOffices.filter(
        (o) => o.status === filters.status,
      );
    }

    // Fetch project counts (total and active) per office
    const officeIds = filteredOffices.map((o) => o.id);
    const projectCounts: Record<string, { total: number; active: number }> = {};

    if (officeIds.length > 0) {
      const counts = await db
        .select({
          officeId: project.officeId,
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${project.status} = 'active')::int`,
        })
        .from(project)
        .where(
          and(
            inArray(project.officeId, officeIds),
            isNull(project.deletedAt),
            eq(project.isTemplate, false),
          ),
        )
        .groupBy(project.officeId);

      for (const row of counts) {
        if (row.officeId) {
          projectCounts[row.officeId] = {
            total: row.total,
            active: row.active,
          };
        }
      }
    }

    // Merge project counts into the response
    const result = filteredOffices.map((o) => ({
      ...o,
      projectCount: projectCounts[o.id]?.total ?? 0,
      activeProjectCount: projectCounts[o.id]?.active ?? 0,
    }));

    return c.json(result);
  } catch (error) {
    console.error("Failed to get offices:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// POST / - Create office (RBAC: CREATE on parent org)
officesRouter.post("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body with Zod schema
    const validationResult = createOfficeSchema.safeParse({
      ...body,
      createdBy: user.userId,
    });

    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const officeData = validationResult.data;

    // A new office has no current logos, so any bucket URL must be the
    // caller's own upload (see the PUT route for why).
    if (
      [officeData.documentLogoUrl, officeData.documentFooterLogoUrl].some(
        (url) => !isAllowedStorageUrlUpdate(url, null, { userId: user.userId }),
      )
    ) {
      return c.json(
        { error: "Logo URLs must reference your own uploads" },
        400,
      );
    }

    // Verify user has CREATE permission for the organization (requires owner/editor role)
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      officeData.organizationId,
      EntityType.ORGANIZATION,
      Action.CREATE,
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

    const newOffice = await createOffice(officeData);

    return c.json(newOffice, 201);
  } catch (error) {
    console.error("Failed to create office:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// GET /:id - Get single office (RBAC: READ)
officesRouter.get(
  "/:id",
  requirePermission(EntityType.OFFICE, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const officeWithRelations = await getOfficeWithRelations(id);

      if (!officeWithRelations) {
        return c.json({ error: "Office not found" }, 404);
      }

      return c.json(officeWithRelations);
    } catch (error) {
      console.error("Failed to get office:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id - Update office (RBAC: UPDATE)
officesRouter.put(
  "/:id",
  requirePermission(
    EntityType.OFFICE,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if office exists
      const office = await getOfficeById(id);
      if (!office) {
        return c.json({ error: "Office not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body with Zod schema
      const validationResult = updateOfficeSchema.safeParse({
        ...body,
        id,
      });

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const updateData = validationResult.data;

      // Logo fields may only point into our bucket at the caller's own
      // uploads — otherwise the replaced-logo cleanup below could be aimed at
      // another tenant's object. External links are unaffected.
      const storageOwner = { userId: c.get("user").userId };
      const logoFields = [
        [updateData.documentLogoUrl, office.documentLogoUrl],
        [updateData.documentFooterLogoUrl, office.documentFooterLogoUrl],
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
      if (updateData.name && updateData.name !== office.name) {
        newSlug = generateUniqueSlug(updateData.name);
      }

      await updateOffice({ ...updateData, slug: newSlug });

      // Clean up old document/footer logos once the row no longer points at
      // them. Omitted fields (undefined) are left alone.
      await deleteReplacedStorageFiles(logoFields, storageOwner);

      // Return updated office
      const updatedOffice = await getOfficeWithRelations(id);
      return c.json(updatedOffice);
    } catch (error) {
      console.error("Failed to update office:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id - Delete office (RBAC: DELETE)
officesRouter.delete(
  "/:id",
  requirePermission(
    EntityType.OFFICE,
    Action.DELETE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if office exists
      const officeRecord = await getOfficeById(id);
      if (!officeRecord) {
        return c.json({ error: "Office not found" }, 404);
      }

      await deleteOffice(id);
      return c.json({ message: "Office deleted successfully" });
    } catch (error) {
      console.error("Failed to delete office:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// GET /:id/members - List members with org inheritance (RBAC: READ from a role
// on the office or its org — upward READ from a child project does not expose staff)
officesRouter.get(
  "/:id/members",
  requireMemberPermission(
    EntityType.OFFICE,
    Action.READ,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const officeId = c.req.param("id")!;

      // Get office with its organization
      const officeHierarchy = await db
        .select({
          office: office,
          organization: organization,
        })
        .from(office)
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(eq(office.id, officeId))
        .limit(1);

      if (officeHierarchy.length === 0) {
        return c.json({ error: "Office not found" }, 404);
      }

      const { organization: officeOrg } = officeHierarchy[0];

      // Get direct office members and org members in parallel
      const [directMembers, orgMembers] = await Promise.all([
        // Direct office members
        selectMembersFrom(officeUsers, officeUsers.officeId, officeId),
        // Organization members (inherited)
        selectMembersFrom(
          organizationUsers,
          organizationUsers.organizationId,
          officeOrg.id,
        ),
      ]);

      // Combine members with inheritance info
      const memberMap = new Map<string, MemberWithInheritance>();

      // Add direct members
      for (const member of directMembers) {
        memberMap.set(member.userId, {
          ...member,
          inheritance: {
            isDirect: true,
          },
        });
      }

      // Add org members — merge with direct if exists, keeping higher role
      for (const member of orgMembers) {
        const existing = memberMap.get(member.userId);
        if (!existing) {
          memberMap.set(member.userId, {
            ...member,
            inheritance: {
              isDirect: false,
              inheritedFrom: {
                entityId: officeOrg.id,
                entityType: EntityType.ORGANIZATION,
                entityName: officeOrg.name,
              },
            },
          });
        } else if (
          (ROLE_LEVEL[member.role] ?? 0) > (ROLE_LEVEL[existing.role] ?? 0)
        ) {
          // Inherited role is higher — use it but keep isDirect true
          existing.role = member.role;
        }
      }

      const members = Array.from(memberMap.values());

      // Get pending invitations for this office
      const invitationsData = await getEntityInvitationsWithInviter(
        "office",
        officeId,
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
      console.error("Error fetching office members:", error);
      return c.json({ error: "Failed to fetch members" }, 500);
    }
  },
);

// POST /:id/members - Add member or send invitation (RBAC: MANAGE_MEMBERS)
officesRouter.post(
  "/:id/members",
  requirePermission(
    EntityType.OFFICE,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const officeId = c.req.param("id")!;
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

      // Starter seat cap: office owners/editors are org-billable seats. Gate
      // before BOTH branches (direct add and invitation).
      if (role !== "viewer") {
        const officeRow = await getOfficeById(officeId);
        if (!officeRow) {
          return c.json({ error: "Office not found" }, 404);
        }
        const seatDecision = await assertSeatAvailable({
          organizationId: officeRow.organizationId,
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
          officeId,
          EntityType.OFFICE,
        );

        if (existingMembership) {
          return c.json(
            { error: "User already has a membership in this office" },
            400,
          );
        }

        // Add the membership
        await rbacService.addMembership(
          userId,
          officeId,
          EntityType.OFFICE,
          role,
        );

        // Office owner/editor members are billable seats — keep Stripe in sync.
        await syncSeatsForOffice(officeId);

        // Notify the existing user that they were added (best-effort).
        try {
          await sendMemberAddedNotification({
            entityType: "office",
            entityId: officeId,
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
            officeId,
            role,
          },
        });
      } else {
        // User doesn't exist - create invitation
        const invitationService = getInvitationService();
        const result = await invitationService.createInvitation({
          email,
          entityType: "office",
          entityId: officeId,
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
      console.error("Error adding office member:", error);
      return c.json({ error: "Failed to add member" }, 500);
    }
  },
);

// PATCH /:id/members - Update member role (RBAC: MANAGE_MEMBERS)
officesRouter.patch(
  "/:id/members",
  requirePermission(
    EntityType.OFFICE,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const officeId = c.req.param("id")!;
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
        const officeRow = await getOfficeById(officeId);
        if (!officeRow) {
          return c.json({ error: "Office not found" }, 404);
        }
        const seatDecision = await assertSeatAvailable({
          organizationId: officeRow.organizationId,
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
            officeId,
            EntityType.OFFICE,
          );
        }

        await rbacService.updateMembershipRole(
          userId,
          officeId,
          EntityType.OFFICE,
          role,
        );
      });

      // Role change can move a member in/out of the billable (non-viewer) set.
      await syncSeatsForOffice(officeId);

      return c.json({
        success: true,
        membership: {
          userId,
          officeId,
          role,
        },
      });
    } catch (error) {
      console.error("Error updating office member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);

// DELETE /:id/members - Remove member with last-owner check (RBAC: MANAGE_MEMBERS)
officesRouter.delete(
  "/:id/members",
  requirePermission(
    EntityType.OFFICE,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const officeId = c.req.param("id")!;
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
            officeId,
            EntityType.OFFICE,
          );
        }

        // Remove the membership (within same transaction)
        await rbacService.removeMembership(userId, officeId, EntityType.OFFICE);
      });

      // Removing a non-viewer office member may free a seat — resync.
      await syncSeatsForOffice(officeId);

      return c.json({ success: true });
    } catch (error) {
      console.error("Error removing office member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);
