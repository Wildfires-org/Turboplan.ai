import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { projectContext, projectField } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { getProjectDocumentsByProjectId } from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  DrizzleMilestoneRepository,
  DrizzleUserRepository,
  MilestoneService,
} from "@wildfires-org/turboplan-tasks/server";
import { getTimeline } from "@wildfires-org/turboplan-timeline-records/server";
import {
  getOfficeById,
  getOrganizationById,
  getProjectById,
} from "@wildfires-org/turboplan-workspace/server";

import {
  getProjectCatalogUrl,
  getProjectDashboardUrl,
} from "../utils/entity-urls.js";
import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

export const registerSummaryTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  const userRepository = new DrizzleUserRepository();
  const milestoneRepository = new DrizzleMilestoneRepository(userRepository);
  const milestoneService = new MilestoneService(milestoneRepository);

  server.registerTool(
    "get_project_summary",
    {
      description:
        "Get a comprehensive project summary in a single call. Returns project details, custom fields, context entries, milestones with tasks, document list, and recent timeline activity. This is the recommended starting point for AI agents to understand a project before making changes.",
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

        const proj = await getProjectById(projectId as string);
        const notFound = assertEntityExists(
          proj,
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
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const [fields, context, milestonesWithTasks, documents, timeline] =
          await Promise.all([
            db
              .select({
                id: projectField.id,
                name: projectField.name,
                type: projectField.type,
                isRequired: projectField.isRequired,
                tooltip: projectField.tooltip,
                order: projectField.order,
                values: projectField.values,
              })
              .from(projectField)
              .where(eq(projectField.projectId, projectId as string))
              .orderBy(projectField.order),
            db
              .select({
                id: projectContext.id,
                label: projectContext.label,
                content: projectContext.content,
                url: projectContext.url,
              })
              .from(projectContext)
              .where(eq(projectContext.projectId, projectId as string))
              .orderBy(projectContext.createdAt),
            milestoneService.getMilestonesByProjectId(projectId as string),
            getProjectDocumentsByProjectId(projectId as string),
            getTimeline(projectId as string, { page: 1, limit: 10 }),
          ]);

        const office = await getOfficeById(proj!.officeId);
        const org = office
          ? await getOrganizationById(office.organizationId)
          : null;
        const catalogUrl =
          office && org
            ? getProjectCatalogUrl(org.slug, office.slug, proj!.slug)
            : null;
        const dashboardUrl =
          office && org
            ? getProjectDashboardUrl(org.slug, office.slug, proj!.slug)
            : null;

        const summary = {
          project: {
            id: proj!.id,
            name: proj!.name,
            slug: proj!.slug,
            description: proj!.description,
            status: proj!.status,
            isTemplate: proj!.isTemplate,
            isPublic: proj!.isPublic,
            officeId: proj!.officeId,
            startDate: proj!.startDate,
            endDate: proj!.endDate,
            catalogUrl,
            dashboardUrl,
          },
          fields,
          context,
          milestones: milestonesWithTasks.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            startDate: m.startDate,
            dueDate: m.dueDate,
            assigneeIds: m.assigneeIds,
            order: m.order,
            tasks: m.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              startDate: t.startDate,
              dueDate: t.dueDate,
              assigneeIds: t.assigneeIds,
              description: t.description,
              order: t.order,
            })),
          })),
          documents: documents.map((d) => ({
            id: d.id,
            originalFilename: d.originalFilename,
            mimeType: d.mimeType,
            size: d.size,
            url: d.url,
            relevance: d.relevance,
            context: d.context,
            folder: d.folder,
            folderDescription: d.folderDescription,
          })),
          recentActivity: timeline.records.map((r) => ({
            entityType: r.entityType,
            entityName: r.entityName,
            action: r.action,
            createdAt: r.createdAt,
            authorEmail: r.authorEmail,
          })),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }),
  );
};
