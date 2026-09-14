import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { OfficeStatus } from "@wildfires-org/turboplan-db";
import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  createOffice,
  getOfficeById,
  getOrganizationById,
  getUserAccessibleOffices,
  updateOffice,
} from "@wildfires-org/turboplan-workspace/server";

import {
  getOfficeCatalogUrl,
  getOfficeDashboardUrl,
} from "../utils/entity-urls.js";
import { generateOfficeCoverImage } from "../utils/generate-cover-image.js";
import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import type { McpUserContext } from "../utils/types.js";
import {
  descriptionSchema,
  entityIdSchema,
  nameSchema,
  validateToolInput,
} from "../utils/validation.js";

export const registerOfficeTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_offices",
    {
      description:
        "List offices within an organization. Requires read access to the organization.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Organization UUID"),
      },
    },
    async ({ organizationId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ organizationId: entityIdSchema }),
          { organizationId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId);
        const notFound = assertEntityExists(
          org,
          organizationId,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId,
          EntityType.ORGANIZATION,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const offices = await getUserAccessibleOffices(
          user.userId,
          organizationId,
          org!.type,
        );

        const result = offices.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          description: o.description,
          status: o.status,
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
    "get_office",
    {
      description: "Get details of a specific office. Requires read access.",
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

        const org = await getOrganizationById(office!.organizationId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: office!.id,
                  name: office!.name,
                  slug: office!.slug,
                  description: office!.description,
                  status: office!.status,
                  organizationId: office!.organizationId,
                  coverImageId: office!.coverImageId,
                  catalogUrl: org
                    ? getOfficeCatalogUrl(org.slug, office!.slug)
                    : null,
                  dashboardUrl: org
                    ? getOfficeDashboardUrl(org.slug, office!.slug)
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
    "create_office",
    {
      description:
        "Create a new office within an organization. Requires editor role or higher on the organization.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Parent organization UUID"),
        name: z.string().min(1).max(255).describe("Office name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Office description"),
      },
    },
    async ({ organizationId, name, description }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            organizationId: entityIdSchema,
            name: nameSchema,
            description: descriptionSchema,
          }),
          { organizationId, name, description },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId);
        const notFound = assertEntityExists(
          org,
          organizationId,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId,
          EntityType.ORGANIZATION,
          Action.CREATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const office = await createOffice({
          organizationId,
          name: name as string,
          description: description as string | undefined,
          createdBy: user.userId,
        });

        // Best-effort cover image — never throws, and a failure here must not
        // fail the office creation. org is guaranteed non-null above.
        const coverImage = await generateOfficeCoverImage(
          office.id,
          office.name,
          org!.name,
          user.userId,
          office.description,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  officeId: office.id,
                  name: office.name,
                  slug: office.slug,
                  catalogUrl: getOfficeCatalogUrl(org!.slug, office.slug),
                  dashboardUrl: getOfficeDashboardUrl(org!.slug, office.slug),
                  coverImage,
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
    "update_office",
    {
      description:
        "Update an office's properties. Requires editor role or higher on the office.",
      inputSchema: {
        officeId: z.string().uuid().describe("Office UUID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New description"),
        status: z
          .enum(["active", "archived"])
          .optional()
          .describe("Office status"),
      },
    },
    async ({ officeId, name, description, status }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            officeId: entityIdSchema,
            name: nameSchema.optional(),
            description: descriptionSchema,
            status: z.enum(["active", "archived"]).optional(),
          }),
          { officeId, name, description, status },
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

        await updateOffice({
          id: officeId as string,
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
          ...(validated.status !== undefined && {
            status: validated.status as OfficeStatus,
          }),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, officeId: officeId },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
};
