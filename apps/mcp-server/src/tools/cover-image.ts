import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import {
  getOfficeById,
  getOrganizationById,
  getProjectById,
} from "@wildfires-org/turboplan-workspace/server";

import {
  generateOfficeCoverImage,
  generateOrganizationCoverImage,
  generateProjectCoverImage,
} from "../utils/generate-cover-image.js";
import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

export const registerCoverImageTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "create_project_cover_image",
    {
      description:
        "Generate and set an AI cover image for a project. Regular projects get the realistic landscape style used by in-app project creation; template projects get the 3D diorama style used by the cataloger. Requires editor role or higher on the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        prompt: z
          .string()
          .max(2000)
          .optional()
          .describe(
            "Optional description to steer the image (defaults to the project description)",
          ),
      },
    },
    async ({ projectId, prompt }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            prompt: z.string().max(2000).optional(),
          }),
          { projectId, prompt },
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

        // Never throws — returns { success, imageUrl?, error? }.
        const result = await generateProjectCoverImage(
          projectId as string,
          project!.name,
          user.userId,
          project!.isTemplate,
          validated.prompt ?? project!.description,
        );

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Cover image generation failed: ${result.error ?? "unknown error"}`,
              },
            ],
          };
        }

        // Non-throwing audit record for the mutation.
        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "project",
          entityId: projectId as string,
          entityName: project!.name,
          action: "updated",
          title: "Cover image generated",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, imageUrl: result.imageUrl },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "create_office_cover_image",
    {
      description:
        "Generate and set an AI cover image for an office using the realistic landscape style, with the office located inside its parent organization for context. Requires editor role or higher on the office.",
      inputSchema: {
        officeId: z.string().uuid().describe("Office UUID"),
        prompt: z
          .string()
          .max(2000)
          .optional()
          .describe(
            "Optional description to steer the image (defaults to the office description)",
          ),
      },
    },
    async ({ officeId, prompt }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            officeId: entityIdSchema,
            prompt: z.string().max(2000).optional(),
          }),
          { officeId, prompt },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const office = await getOfficeById(officeId as string);
        const notFound = assertEntityExists(
          office,
          officeId as string,
          "office",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          officeId as string,
          EntityType.OFFICE,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Fetch the parent organization name for prompt context.
        const org = await getOrganizationById(office!.organizationId);

        // Never throws — returns { success, imageUrl?, error? }.
        const result = await generateOfficeCoverImage(
          officeId as string,
          office!.name,
          org?.name ?? office!.name,
          user.userId,
          validated.prompt ?? office!.description,
        );

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Cover image generation failed: ${result.error ?? "unknown error"}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, imageUrl: result.imageUrl },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "create_organization_cover_image",
    {
      description:
        "Generate and set an AI cover image for an organization using the realistic landscape style. Requires editor role or higher on the organization.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Organization UUID"),
        prompt: z
          .string()
          .max(2000)
          .optional()
          .describe(
            "Optional description to steer the image (defaults to the organization description)",
          ),
      },
    },
    async ({ organizationId, prompt }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            organizationId: entityIdSchema,
            prompt: z.string().max(2000).optional(),
          }),
          { organizationId, prompt },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId as string);
        const notFound = assertEntityExists(
          org,
          organizationId as string,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId as string,
          EntityType.ORGANIZATION,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Never throws — returns { success, imageUrl?, error? }.
        const result = await generateOrganizationCoverImage(
          organizationId as string,
          org!.name,
          user.userId,
          validated.prompt ?? org!.description,
        );

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Cover image generation failed: ${result.error ?? "unknown error"}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, imageUrl: result.imageUrl },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
};
