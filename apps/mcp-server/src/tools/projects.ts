import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { assertProjectCreationAllowed } from "@wildfires-org/turboplan-billing/server";
import type { ProjectStatus } from "@wildfires-org/turboplan-db";
import { projectField } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import type { FieldChange } from "@wildfires-org/turboplan-timeline-records/types";
import {
  createProject,
  generateUniqueProjectSlug,
  getOfficeById,
  getOrganizationById,
  getProjectById,
  getUserAccessibleProjects,
  resolveProjectCreationFlags,
  updateProject,
} from "@wildfires-org/turboplan-workspace/server";

import {
  getProjectCatalogUrl,
  getProjectDashboardUrl,
} from "../utils/entity-urls.js";
import {
  assertEntityExists,
  assertPermission,
  getMcpRBACService,
} from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import {
  descriptionSchema,
  entityIdSchema,
  nameSchema,
  validateToolInput,
} from "../utils/validation.js";

export const registerProjectTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_projects",
    {
      description:
        "List projects within an office. Requires read access to the office.",
      inputSchema: {
        officeId: z.string().uuid().describe("Office UUID"),
      },
    },
    async ({ officeId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ officeId: entityIdSchema }),
          { officeId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const office = await getOfficeById(officeId);
        const notFound = assertEntityExists(
          office,
          officeId,
          "office",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          officeId,
          EntityType.OFFICE,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const projects = await getUserAccessibleProjects(user.userId, officeId);

        const result = projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          status: p.status,
          isTemplate: p.isTemplate,
          isPublic: p.isPublic,
          taskCount: p.taskCount,
          completedTaskCount: p.completedTaskCount,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "get_project",
    {
      description:
        "Get details of a specific project. Requires read access. Public government projects are accessible without membership.",
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

        const project = await getProjectById(projectId);
        const notFound = assertEntityExists(
          project,
          projectId,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const fields = await db
          .select()
          .from(projectField)
          .where(eq(projectField.projectId, projectId as string))
          .orderBy(projectField.order);

        const office = await getOfficeById(project!.officeId);
        const org = office
          ? await getOrganizationById(office.organizationId)
          : null;
        const catalogUrl =
          office && org
            ? getProjectCatalogUrl(org.slug, office.slug, project!.slug)
            : null;
        const dashboardUrl =
          office && org
            ? getProjectDashboardUrl(org.slug, office.slug, project!.slug)
            : null;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: project!.id,
                  name: project!.name,
                  slug: project!.slug,
                  description: project!.description,
                  status: project!.status,
                  isTemplate: project!.isTemplate,
                  isPublic: project!.isPublic,
                  officeId: project!.officeId,
                  startDate: project!.startDate,
                  endDate: project!.endDate,
                  catalogUrl,
                  dashboardUrl,
                  fields: fields.map((f) => ({
                    id: f.id,
                    name: f.name,
                    type: f.type,
                    isRequired: f.isRequired,
                    tooltip: f.tooltip,
                    order: f.order,
                    values: f.values,
                  })),
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
    "create_project",
    {
      description:
        "Create a new project within an office. Requires editor role or higher on the office. Optional flags: prompt (project AI prompt), isTemplate and isPublic (only honoured with owner role on the office; otherwise ignored).",
      inputSchema: {
        officeId: z.string().uuid().describe("Parent office UUID"),
        name: z.string().min(1).max(255).describe("Project name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Project description"),
        prompt: z
          .string()
          .max(10000)
          .optional()
          .describe("Project AI prompt / system context"),
        isTemplate: z
          .boolean()
          .optional()
          .describe("Whether the project is a template"),
        isPublic: z
          .boolean()
          .optional()
          .describe("Whether the project is publicly visible"),
      },
    },
    async ({ officeId, name, description, prompt, isTemplate, isPublic }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            officeId: entityIdSchema,
            name: nameSchema,
            description: descriptionSchema,
            prompt: z.string().max(10000).optional(),
            isTemplate: z.boolean().optional(),
            isPublic: z.boolean().optional(),
          }),
          { officeId, name, description, prompt, isTemplate, isPublic },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const office = await getOfficeById(officeId);
        const notFound = assertEntityExists(
          office,
          officeId,
          "office",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          officeId,
          EntityType.OFFICE,
          Action.CREATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        // Billing gate: the org's plan caps active projects (Starter allows
        // one). Same enforcement as the app routes — MCP is not a bypass.
        const decision = await assertProjectCreationAllowed({
          organizationId: office!.organizationId,
        });
        if (!decision.allowed) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Project limit reached: this organization's plan allows ${decision.projectLimit} active project(s). An owner must upgrade the plan to create more.`,
              },
            ],
          };
        }

        const validated = validation.data;

        // Same policy as the web create route: isPublic / isTemplate are only
        // honoured with office MANAGE_MEMBERS, citizens start as DRAFT.
        const wantsPublicOrTemplate =
          validated.isPublic === true || validated.isTemplate === true;
        const hasOfficeManageMembers =
          wantsPublicOrTemplate &&
          (
            await getMcpRBACService().checkPermission(
              user.userId,
              officeId,
              EntityType.OFFICE,
              Action.MANAGE_MEMBERS,
              { email: user.email },
            )
          ).allowed;
        const userRole =
          user.userRole ?? (await getProfileByUserId(user.userId))?.userRole;
        const flags = resolveProjectCreationFlags({
          hasOfficeCreate: true,
          hasOfficeManageMembers,
          userRole,
          requestedIsPublic: validated.isPublic,
          requestedIsTemplate: validated.isTemplate,
        });

        const slug = await generateUniqueProjectSlug(
          officeId as string,
          validated.name as string,
        );

        const project = await createProject({
          officeId: officeId as string,
          name: validated.name as string,
          slug,
          description: validated.description as string | undefined,
          createdBy: user.userId,
          ...(validated.prompt !== undefined && { prompt: validated.prompt }),
          ...flags,
        });

        await createTimelineRecord({
          projectId: project.id,
          userId: user.userId,
          entityType: "project",
          entityId: project.id,
          entityName: project.name,
          action: "created",
          metadata: { source: "mcp", actor: user.actor },
        });

        const org = await getOrganizationById(office!.organizationId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  projectId: project.id,
                  name: project.name,
                  slug: project.slug,
                  catalogUrl: org
                    ? getProjectCatalogUrl(org.slug, office!.slug, project.slug)
                    : null,
                  dashboardUrl: org
                    ? getProjectDashboardUrl(
                        org.slug,
                        office!.slug,
                        project.slug,
                      )
                    : null,
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
    "update_project",
    {
      description:
        "Update a project's properties. Requires editor role or higher on the project. Changing isPublic or isTemplate requires owner role on the project; turning either on additionally requires owner role on the project's office.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New description"),
        status: z
          .enum(["active", "archived", "completed"])
          .optional()
          .describe("Project status"),
        isPublic: z
          .boolean()
          .optional()
          .describe("Whether the project is publicly visible"),
        isTemplate: z
          .boolean()
          .optional()
          .describe("Whether the project is a template"),
        startDate: z
          .string()
          .optional()
          .nullable()
          .describe("Project start date as ISO 8601 string (null to clear)"),
        endDate: z
          .string()
          .optional()
          .nullable()
          .describe("Project end date as ISO 8601 string (null to clear)"),
      },
    },
    async ({
      projectId,
      name,
      description,
      status,
      isPublic,
      isTemplate,
      startDate,
      endDate,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            name: nameSchema.optional(),
            description: descriptionSchema,
            status: z.enum(["active", "archived", "completed"]).optional(),
            isPublic: z.boolean().optional(),
            isTemplate: z.boolean().optional(),
            startDate: z.string().datetime().nullable().optional(),
            endDate: z.string().datetime().nullable().optional(),
          }),
          {
            projectId,
            name,
            description,
            status,
            isPublic,
            isTemplate,
            startDate,
            endDate,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const project = await getProjectById(projectId as string);
        const notFound = assertEntityExists(
          project,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Visibility and template changes require owner-level permission
        if (
          validated.isPublic !== undefined ||
          validated.isTemplate !== undefined
        ) {
          const ownerDenied = await assertPermission(
            user.userId,
            projectId as string,
            EntityType.PROJECT,
            Action.MANAGE_MEMBERS,
            user.email,
          );
          if (ownerDenied) {
            return ownerDenied;
          }
        }

        // Turning isPublic / isTemplate ON presents the project under its
        // office's name, so it takes MANAGE_MEMBERS on the office itself — the
        // same bar create_project uses for these flags. Project ownership alone
        // is not enough: the creator of a project is always its owner, so an
        // office editor could otherwise create and then publish in two calls.
        // Turning them OFF only needs project MANAGE_MEMBERS (checked above).
        const enablesPublicOrTemplate =
          (validated.isPublic === true && !project!.isPublic) ||
          (validated.isTemplate === true && !project!.isTemplate);
        if (enablesPublicOrTemplate) {
          const officeDenied = await assertPermission(
            user.userId,
            project!.officeId,
            EntityType.OFFICE,
            Action.MANAGE_MEMBERS,
            user.email,
          );
          if (officeDenied) {
            return officeDenied;
          }
        }

        // Billing gate on template conversion: flipping isTemplate off turns
        // content into a real active project — same limit as creating one.
        if (validated.isTemplate === false && project!.isTemplate) {
          const office = await getOfficeById(project!.officeId);
          const decision = office
            ? await assertProjectCreationAllowed({
                organizationId: office.organizationId,
              })
            : null;
          if (decision && !decision.allowed) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: `Project limit reached: converting this template into a project would exceed the plan's ${decision.projectLimit} active project(s). An owner must upgrade the plan first.`,
                },
              ],
            };
          }
        }

        const changes: FieldChange[] = [];

        const trackChange = (
          field: string,
          oldVal: unknown,
          newVal: unknown,
          valueType: FieldChange["valueType"],
        ) => {
          if (newVal !== undefined && newVal !== oldVal) {
            changes.push({
              field,
              previousValue: oldVal,
              newValue: newVal,
              valueType,
            });
          }
        };

        trackChange("name", project!.name, validated.name, "text");
        trackChange(
          "description",
          project!.description,
          validated.description,
          "text",
        );
        trackChange("status", project!.status, validated.status, "enum");
        trackChange(
          "isPublic",
          project!.isPublic,
          validated.isPublic,
          "boolean",
        );
        trackChange(
          "isTemplate",
          project!.isTemplate,
          validated.isTemplate,
          "boolean",
        );
        if (validated.startDate !== undefined) {
          trackChange(
            "startDate",
            project!.startDate,
            validated.startDate ? new Date(validated.startDate) : null,
            "date",
          );
        }
        if (validated.endDate !== undefined) {
          trackChange(
            "endDate",
            project!.endDate,
            validated.endDate ? new Date(validated.endDate) : null,
            "date",
          );
        }

        await updateProject({
          id: projectId as string,
          lastModifiedBy: user.userId,
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
          ...(validated.status !== undefined && {
            status: validated.status as ProjectStatus,
          }),
          ...(validated.isPublic !== undefined && {
            isPublic: validated.isPublic,
          }),
          ...(validated.isTemplate !== undefined && {
            isTemplate: validated.isTemplate,
          }),
          ...(validated.startDate !== undefined && {
            startDate: validated.startDate
              ? new Date(validated.startDate)
              : null,
          }),
          ...(validated.endDate !== undefined && {
            endDate: validated.endDate ? new Date(validated.endDate) : null,
          }),
        });

        if (changes.length > 0) {
          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "project",
            entityId: projectId as string,
            entityName: (validated.name as string) ?? project!.name,
            action: "updated",
            changes,
            metadata: { source: "mcp", actor: user.actor },
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, projectId: projectId },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
};
