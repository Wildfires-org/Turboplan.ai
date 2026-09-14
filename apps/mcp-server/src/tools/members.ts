import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { assertSeatAvailable } from "@wildfires-org/turboplan-billing/server";
import {
  office,
  officeUsers,
  organization,
  organizationUsers,
  profile,
  project,
  projectUsers,
  user as userTable,
} from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { getUser } from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACService,
  RBACService,
} from "@wildfires-org/turboplan-rbac/server";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import { getInvitationService } from "@wildfires-org/turboplan-workspace/server";

import { assertPermission } from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

/** Resolves the owning organization for a project (project → office → org). */
const resolveProjectOrganizationId = async (
  projectId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, projectId))
    .limit(1);
  return row?.organizationId ?? null;
};

const seatLimitResult = () => ({
  isError: true as const,
  content: [
    {
      type: "text" as const,
      text: "Seat limit reached: this organization's plan has no purchasable seats left. An owner must upgrade the plan before more owners or editors can be added.",
    },
  ],
});

type MembershipTable =
  | typeof officeUsers
  | typeof organizationUsers
  | typeof projectUsers;

const selectMembersFrom = (
  table: MembershipTable,
  filterColumn: Parameters<typeof eq>[0],
  filterValue: string,
) => {
  return (
    db
      .select({
        userId: table.userId,
        role: table.role,
        email: userTable.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      })
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle union table typing
      .from(table as any)
      .innerJoin(userTable, eq(table.userId, userTable.id))
      .leftJoin(profile, eq(userTable.id, profile.userId))
      .where(eq(filterColumn, filterValue))
  );
};

const ROLE_LEVEL: Record<string, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

const roleSchema = z.enum(["owner", "editor", "viewer"]);

export const registerMemberTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_project_members",
    {
      description:
        "List all members of a project, including inherited members from office/organization. Requires read access to the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ projectId: entityIdSchema }),
          { projectId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const projectHierarchy = await db
          .select({
            project: project,
            office: office,
            organization: organization,
          })
          .from(project)
          .innerJoin(office, eq(project.officeId, office.id))
          .innerJoin(organization, eq(office.organizationId, organization.id))
          .where(
            and(eq(project.id, projectId as string), isNull(project.deletedAt)),
          )
          .limit(1);

        if (projectHierarchy.length === 0) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        const { office: projectOffice, organization: projectOrg } =
          projectHierarchy[0];

        const [directMembers, officeMembers, orgMembers] = await Promise.all([
          selectMembersFrom(
            projectUsers,
            projectUsers.projectId,
            projectId as string,
          ),
          selectMembersFrom(
            officeUsers,
            officeUsers.officeId,
            projectOffice.id,
          ),
          selectMembersFrom(
            organizationUsers,
            organizationUsers.organizationId,
            projectOrg.id,
          ),
        ]);

        const memberMap = new Map<
          string,
          {
            userId: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
            role: string;
            isDirect: boolean;
            inheritedFrom: string | null;
          }
        >();

        for (const member of directMembers) {
          memberMap.set(member.userId, {
            userId: member.userId,
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            role: member.role,
            isDirect: true,
            inheritedFrom: null,
          });
        }

        const mergeInherited = (
          member: (typeof officeMembers)[number],
          source: string,
        ) => {
          const existing = memberMap.get(member.userId);
          if (!existing) {
            memberMap.set(member.userId, {
              userId: member.userId,
              email: member.email,
              firstName: member.firstName,
              lastName: member.lastName,
              role: member.role,
              isDirect: false,
              inheritedFrom: source,
            });
          } else if (
            (ROLE_LEVEL[member.role] ?? 0) > (ROLE_LEVEL[existing.role] ?? 0)
          ) {
            existing.role = member.role;
            if (!existing.isDirect) {
              existing.inheritedFrom = source;
            }
          }
        };

        for (const member of officeMembers) {
          mergeInherited(member, "office");
        }
        for (const member of orgMembers) {
          mergeInherited(member, "organization");
        }

        const members = Array.from(memberMap.values());

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(members, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "add_project_member",
    {
      description:
        "Add a member to a project by email. If user exists, adds directly. If not, creates an invitation. Requires owner role on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        email: z.string().email().describe("User email address"),
        role: z.enum(["owner", "editor", "viewer"]).describe("Role to assign"),
      },
    },
    async ({ projectId, email, role }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            email: z.string().email(),
            role: roleSchema,
          }),
          { projectId, email, role },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;
        const users = await getUser(validated.email);

        if (users[0]) {
          const targetUserId = users[0].id;

          const rbacService = getRBACService();
          const existingMembership =
            await rbacService.getUserMembershipForEntity(
              targetUserId,
              projectId as string,
              EntityType.PROJECT,
            );

          if (existingMembership) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "User already has a membership in this project.",
                },
              ],
            };
          }

          if (validated.role !== "viewer") {
            const organizationId = await resolveProjectOrganizationId(
              projectId as string,
            );
            const seatDecision = organizationId
              ? await assertSeatAvailable({
                  organizationId,
                  userId: targetUserId,
                })
              : null;
            if (seatDecision && !seatDecision.allowed) {
              return seatLimitResult();
            }
          }

          await rbacService.addMembership(
            targetUserId,
            projectId as string,
            EntityType.PROJECT,
            validated.role,
          );

          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "member",
            entityId: targetUserId,
            entityName: validated.email,
            action: "added",
            changes: [
              {
                field: "role",
                previousValue: null,
                newValue: validated.role,
                valueType: "role",
              },
            ],
            metadata: { source: "mcp", actor: user.actor },
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    type: "member",
                    userId: targetUserId,
                    role: validated.role,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Seat gate before the invitation too — an invite is a seat-in-
        // waiting, same contract as the app routes. The accept-time gate in
        // InvitationService remains the backstop.
        if (validated.role !== "viewer") {
          const organizationId = await resolveProjectOrganizationId(
            projectId as string,
          );
          const seatDecision = organizationId
            ? await assertSeatAvailable({ organizationId })
            : null;
          if (seatDecision && !seatDecision.allowed) {
            return seatLimitResult();
          }
        }

        const invitationService = getInvitationService();
        const result = await invitationService.createInvitation({
          email: validated.email,
          entityType: "project",
          entityId: projectId as string,
          role: validated.role,
          invitedBy: user.userId,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  type: "invitation",
                  invitationId: result?.invitationId,
                  message: `User not found. Invitation sent to ${validated.email}.`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "update_member_role",
    {
      description:
        "Change a project member's role. Requires owner role on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().uuid().describe("Target user UUID"),
        role: z
          .enum(["owner", "editor", "viewer"])
          .describe("New role to assign"),
      },
    },
    async ({ projectId, userId: targetUserId, role }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            userId: entityIdSchema,
            role: roleSchema,
          }),
          { projectId, userId: targetUserId, role },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        const rbacService = getRBACService();
        const oldMembership = await rbacService.getUserMembershipForEntity(
          validated.userId,
          projectId as string,
          EntityType.PROJECT,
        );

        if (!oldMembership) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "User is not a direct member of this project.",
              },
            ],
          };
        }

        if (validated.role !== "viewer") {
          const organizationId = await resolveProjectOrganizationId(
            projectId as string,
          );
          const seatDecision = organizationId
            ? await assertSeatAvailable({
                organizationId,
                userId: validated.userId,
              })
            : null;
          if (seatDecision && !seatDecision.allowed) {
            return seatLimitResult();
          }
        }

        if (oldMembership.role === "owner" && validated.role !== "owner") {
          try {
            await db.transaction(async (transaction) => {
              const txRbac = new RBACService(transaction);
              await txRbac.ensureNotLastOwner(
                validated.userId,
                projectId as string,
                EntityType.PROJECT,
              );
              await txRbac.updateMembershipRole(
                validated.userId,
                projectId as string,
                EntityType.PROJECT,
                validated.role,
              );
            });
          } catch (error) {
            const msg =
              error instanceof Error ? error.message : "Failed to update role";
            if (msg === "Cannot remove the last owner") {
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "Cannot demote the last owner of this project.",
                  },
                ],
              };
            }
            throw error;
          }
        } else {
          await rbacService.updateMembershipRole(
            validated.userId,
            projectId as string,
            EntityType.PROJECT,
            validated.role,
          );
        }

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "member",
          entityId: validated.userId,
          action: "role_changed",
          changes: [
            {
              field: "role",
              previousValue: oldMembership.role,
              newValue: validated.role,
              valueType: "role",
            },
          ],
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  userId: validated.userId,
                  previousRole: oldMembership.role,
                  newRole: validated.role,
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "remove_project_member",
    {
      description:
        "Remove a member from a project. Cannot remove the last owner. Requires owner role on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().uuid().describe("User UUID to remove"),
      },
    },
    async ({ projectId, userId: targetUserId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            userId: entityIdSchema,
          }),
          { projectId, userId: targetUserId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        try {
          await db.transaction(async (transaction) => {
            const rbacService = new RBACService(transaction);

            await rbacService.ensureNotLastOwner(
              validated.userId,
              projectId as string,
              EntityType.PROJECT,
            );

            await rbacService.removeMembership(
              validated.userId,
              projectId as string,
              EntityType.PROJECT,
            );
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to remove member";
          if (errorMessage === "Cannot remove the last owner") {
            return {
              isError: true,
              content: [{ type: "text" as const, text: errorMessage }],
            };
          }
          throw error;
        }

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "member",
          entityId: validated.userId,
          action: "removed",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }),
  );
};
