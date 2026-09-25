import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import {
  assertSeatAvailable,
  syncSubscriptionSeatsSafe,
} from "@wildfires-org/turboplan-billing/server";
import {
  office,
  officeUsers,
  organization,
  organizationUsers,
  project,
  projectUsers,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  getProjectAssignableUsers,
  getUser,
} from "@wildfires-org/turboplan-db/queries";
import {
  Action,
  EntityType,
  type EntityTypeType,
  VALID_MEMBER_ROLES,
} from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { RBACService } from "@wildfires-org/turboplan-rbac/server";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import type { MemberWithInheritance, PendingInvitation } from "../../types";
import { ROLE_LEVEL } from "../constants";
import { sendMemberAddedNotification } from "../invitations/email";
import { getEntityInvitationsWithInviter } from "../invitations/queries";
import { getInvitationService } from "../invitations/service";
import { validateTaskAssignment } from "../invitations/task-assignment";
import { taskAssignmentSchema } from "../invitations/validation";
import { selectMembersFrom } from "../queries";
import { seatLimitResponse } from "./seat-gate";

const ROLE_VALUES = ["owner", "editor", "viewer"] as const;

/**
 * Resolve the project's organization (project → office → org) and push the
 * current billable-seat count to Stripe. Project-level owner/editor members
 * count toward org seats. Best-effort (never throws).
 */
const syncSeatsForProject = async (projectId: string): Promise<void> => {
  const [row] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, projectId))
    .limit(1);
  if (row) {
    await syncSubscriptionSeatsSafe(row.organizationId);
  }
};

/** project → office → org, for the seat gate. */
const resolveProjectOrgRow = async (
  projectId: string,
): Promise<{ organizationId: string } | undefined> => {
  const [row] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, projectId))
    .limit(1);
  return row;
};

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLE_VALUES),
  taskAssignment: taskAssignmentSchema,
});

const updateMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLE_VALUES),
});

export const projectMembersRouter = new Hono<RBACContext>();

// GET /:id/members - List members with office/org inheritance (RBAC: READ)
projectMembersRouter.get(
  "/:id/members",
  requirePermission(EntityType.PROJECT, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;

      // Get project with its hierarchy (office and organization)
      const projectHierarchy = await db
        .select({
          project: project,
          office: office,
          organization: organization,
        })
        .from(project)
        .innerJoin(office, eq(project.officeId, office.id))
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
        .limit(1);

      if (projectHierarchy.length === 0) {
        return c.json({ error: "Project not found" }, 404);
      }

      const { office: projectOffice, organization: projectOrg } =
        projectHierarchy[0];

      // Get direct, office, and org members in parallel
      const [directMembers, officeMembers, orgMembers] = await Promise.all([
        // Direct project members
        selectMembersFrom(projectUsers, projectUsers.projectId, projectId),
        // Office members (inherited)
        selectMembersFrom(officeUsers, officeUsers.officeId, projectOffice.id),
        // Organization members (inherited)
        selectMembersFrom(
          organizationUsers,
          organizationUsers.organizationId,
          projectOrg.id,
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

      // Add office/org members — merge keeping higher role
      const mergeInherited = (
        member: (typeof officeMembers)[number],
        entityId: string,
        entityType: EntityTypeType,
        entityName: string,
      ) => {
        const existing = memberMap.get(member.userId);
        if (!existing) {
          memberMap.set(member.userId, {
            ...member,
            inheritance: {
              isDirect: false,
              inheritedFrom: {
                entityId,
                entityType,
                entityName,
              },
            },
          });
        } else if (
          (ROLE_LEVEL[member.role] ?? 0) > (ROLE_LEVEL[existing.role] ?? 0)
        ) {
          // Upgrade to the higher role but preserve the original isDirect flag
          existing.role = member.role;
        }
      };

      for (const member of officeMembers) {
        mergeInherited(
          member,
          projectOffice.id,
          EntityType.OFFICE,
          projectOffice.name,
        );
      }

      for (const member of orgMembers) {
        mergeInherited(
          member,
          projectOrg.id,
          EntityType.ORGANIZATION,
          projectOrg.name,
        );
      }

      const members = Array.from(memberMap.values());

      // Get pending invitations for this project
      const invitationsData = await getEntityInvitationsWithInviter(
        "project",
        projectId,
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
          taskAssignment: inv.taskAssignment,
        }),
      );

      return c.json({ members, pendingInvitations });
    } catch (error) {
      console.error("Error fetching project members:", error);
      return c.json({ error: "Failed to fetch members" }, 500);
    }
  },
);

// GET /:id/assignable-users - Users this project's tasks and milestones can be
// assigned to: hierarchy members plus current assignees (RBAC: READ). Feeds the
// task assignee picker and resolves assigneeIds to people; it replaces the old
// global `GET /api/users` list, which exposed every account's email.
projectMembersRouter.get(
  "/:id/assignable-users",
  requirePermission(EntityType.PROJECT, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const users = await getProjectAssignableUsers(c.req.param("id")!);
      return c.json({
        users: users.map((assignable) => ({
          ...assignable,
          emailVerified: null,
        })),
      });
    } catch (error) {
      console.error("Error fetching assignable users:", error);
      return c.json({ error: "Failed to fetch assignable users" }, 500);
    }
  },
);

// POST /:id/members - Add member or send invitation (RBAC: MANAGE_MEMBERS)
// Supports optional taskAssignment to assign user to a task/milestone
projectMembersRouter.post(
  "/:id/members",
  requirePermission(
    EntityType.PROJECT,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const authUser = c.get("user");
      const body = await c.req.json();

      const validationResult = addMemberSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { email, role, taskAssignment } = validationResult.data;

      // The assignment is applied now (existing user) or at accept time
      // (invitation), and its titles are emailed to the invitee — so both ids
      // must name rows inside this project before anything else happens.
      const taskAssignmentError = await validateTaskAssignment(
        projectId,
        taskAssignment,
      );
      if (taskAssignmentError) {
        return c.json({ error: taskAssignmentError }, 400);
      }

      // Look up user by email
      const users = await getUser(email);

      // Starter seat cap: project owners/editors are org-billable seats. Gate
      // before BOTH branches (direct add and invitation).
      if (role !== "viewer") {
        const orgRow = await resolveProjectOrgRow(projectId);
        if (!orgRow) {
          return c.json({ error: "Project not found" }, 404);
        }
        const seatDecision = await assertSeatAvailable({
          organizationId: orgRow.organizationId,
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
          projectId,
          EntityType.PROJECT,
        );

        if (existingMembership) {
          return c.json(
            { error: "User already has a membership in this project" },
            400,
          );
        }

        // Add the membership
        await rbacService.addMembership(
          userId,
          projectId,
          EntityType.PROJECT,
          role,
        );

        // Project owner/editor members are billable seats — keep Stripe in sync.
        await syncSeatsForProject(projectId);

        // Assign to task/milestone if provided
        if (
          taskAssignment &&
          (taskAssignment.taskId || taskAssignment.milestoneId)
        ) {
          try {
            const { assignUserToTaskAndMilestone } = await import(
              "@wildfires-org/turboplan-db/queries"
            );
            await assignUserToTaskAndMilestone({
              projectId,
              userId,
              taskId: taskAssignment.taskId,
              milestoneId: taskAssignment.milestoneId,
            });
          } catch (error) {
            // Log but don't fail the member addition
            console.error("Failed to assign user to task:", error);
          }
        }

        await createTimelineRecord({
          projectId,
          userId: authUser.userId,
          entityType: "member",
          entityId: userId,
          entityName: email,
          action: "added",
          changes: [
            {
              field: "role",
              previousValue: null,
              newValue: role,
              valueType: "role",
            },
          ],
        });

        // Notify the existing user that they were added (best-effort).
        try {
          await sendMemberAddedNotification({
            entityType: "project",
            entityId: projectId,
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
            projectId,
            role,
          },
        });
      } else {
        // User doesn't exist - create invitation
        const invitationService = getInvitationService();
        const result = await invitationService.createInvitation({
          email,
          entityType: "project",
          entityId: projectId,
          role,
          invitedBy: authUser.userId,
          taskAssignment: taskAssignment || undefined,
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
      console.error("Error adding project member:", error);
      return c.json({ error: "Failed to add member" }, 500);
    }
  },
);

// PATCH /:id/members - Update member role (RBAC: MANAGE_MEMBERS)
projectMembersRouter.patch(
  "/:id/members",
  requirePermission(
    EntityType.PROJECT,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const body = await c.req.json();

      const validationResult = updateMemberSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { userId, role } = validationResult.data;

      // Fetch old role for timeline recording
      const rbacService = getRBACServiceForRequest(c);
      const oldMembership = await rbacService.getUserMembershipForEntity(
        userId,
        projectId,
        EntityType.PROJECT,
      );
      const oldRole = oldMembership?.role ?? null;

      // Starter seat cap: promoting into the billable set counts as adding a
      // seat; already-billable users pass via the userId short-circuit.
      if (role !== "viewer") {
        const orgRow = await resolveProjectOrgRow(projectId);
        if (!orgRow) {
          return c.json({ error: "Project not found" }, 404);
        }
        const seatDecision = await assertSeatAvailable({
          organizationId: orgRow.organizationId,
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
        const txRbacService = new RBACService(transaction);

        // Don't allow owners to demote themselves out of ownership if
        // they're the last owner — mirrors the DELETE last-owner guard, but
        // for role changes rather than removal.
        if (userId === authUser.userId && role !== "owner") {
          await txRbacService.ensureNotLastOwner(
            userId,
            projectId,
            EntityType.PROJECT,
          );
        }

        await txRbacService.updateMembershipRole(
          userId,
          projectId,
          EntityType.PROJECT,
          role,
        );
      });

      // Role change can move a member in/out of the billable (non-viewer) set.
      await syncSeatsForProject(projectId);

      await createTimelineRecord({
        projectId,
        userId: authUser.userId,
        entityType: "member",
        entityId: userId,
        action: "role_changed",
        changes: [
          {
            field: "role",
            previousValue: oldRole,
            newValue: role,
            valueType: "role",
          },
        ],
      });

      return c.json({
        success: true,
        membership: {
          userId,
          projectId,
          role,
        },
      });
    } catch (error) {
      console.error("Error updating project member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);

// DELETE /:id/members - Remove member with last-owner check (RBAC: MANAGE_MEMBERS)
projectMembersRouter.delete(
  "/:id/members",
  requirePermission(
    EntityType.PROJECT,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
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
            projectId,
            EntityType.PROJECT,
          );
        }

        // Remove the membership (within same transaction)
        await rbacService.removeMembership(
          userId,
          projectId,
          EntityType.PROJECT,
        );
      });

      // Removing a non-viewer project member may free a seat — resync.
      await syncSeatsForProject(projectId);

      await createTimelineRecord({
        projectId,
        userId: authUser.userId,
        entityType: "member",
        entityId: userId,
        action: "removed",
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Error removing project member:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove member";
      const statusCode =
        errorMessage === "Cannot remove the last owner" ? 400 : 500;
      return c.json({ error: errorMessage }, statusCode);
    }
  },
);
