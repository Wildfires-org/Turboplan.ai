import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import {
  EntityType,
  type EntityTypeType,
  ROLE_PERMISSIONS,
} from "@wildfires-org/turboplan-rbac";

import { getMcpRBACService } from "../utils/permissions.js";
import type { McpToolResult, McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const ENTITY_TYPE_VALUES = [
  EntityType.ORGANIZATION,
  EntityType.OFFICE,
  EntityType.PROJECT,
] as const;

const formatMembership = (m: {
  entityId: string;
  entityType: EntityTypeType;
  role: string;
}) => ({
  entityId: m.entityId,
  entityType: m.entityType,
  role: m.role,
  allowedActions: ROLE_PERMISSIONS[m.role as keyof typeof ROLE_PERMISSIONS],
});

const handleListPermissions = (user: McpUserContext): Promise<McpToolResult> =>
  runWithWorkerConnection(async () => {
    const rbacService = getMcpRBACService();
    const memberships = await rbacService.getUserMemberships(user.userId);

    const grouped: Record<string, ReturnType<typeof formatMembership>[]> = {};
    for (const type of ENTITY_TYPE_VALUES) {
      const items = memberships
        .filter((m) => m.entityType === type)
        .map(formatMembership);
      if (items.length > 0) {
        grouped[type] = items;
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              userId: user.userId,
              totalMemberships: memberships.length,
              memberships: grouped,
            },
            null,
            2,
          ),
        },
      ],
    };
  });

const VALID_ENTITY_TYPES = new Set(ENTITY_TYPE_VALUES);

const handleCheckEntityPermission = (
  user: McpUserContext,
  entityId: string,
  entityType: string,
): Promise<McpToolResult> =>
  runWithWorkerConnection(async () => {
    const validation = validateToolInput(
      z.object({ entityId: entityIdSchema }),
      { entityId },
    );

    if (!VALID_ENTITY_TYPES.has(entityType as EntityTypeType)) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Invalid entityType: must be one of ${[...VALID_ENTITY_TYPES].join(", ")}`,
          },
        ],
      };
    }
    if (!validation.success) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: validation.error }],
      };
    }

    const rbacService = getMcpRBACService();

    const result = await rbacService.checkPermission(
      user.userId,
      entityId,
      entityType as EntityTypeType,
      "read",
      user.email ? { email: user.email } : undefined,
    );

    if (!result.allowed) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "Access denied." }],
      };
    }

    if (!result.effectiveRole) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                entityId,
                entityType,
                access: "read-only (public)",
                allowedActions: ["read"],
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              entityId,
              entityType,
              role: result.effectiveRole,
              source: result.reason,
              allowedActions: ROLE_PERMISSIONS[result.effectiveRole],
            },
            null,
            2,
          ),
        },
      ],
    };
  });

export const registerCapabilityTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_my_permissions",
    {
      description:
        "List all your permissions across organizations, offices, and projects. Returns your role and allowed actions for each entity. Use this before attempting write operations to avoid access-denied errors.",
    },
    () => handleListPermissions(user),
  );

  const checkPermissionSchema: Record<string, z.ZodTypeAny> = {
    entityId: z.string().uuid().describe("Entity UUID to check"),
    entityType: z
      .enum(["organization", "office", "project"])
      .describe("Entity type"),
  };

  server.registerTool(
    "check_entity_permission",
    {
      description:
        "Check your permissions for a specific entity. Returns your effective role (including roles inherited from parent entities) and allowed actions, or 'read-only (public)' for public government entities.",
      inputSchema: checkPermissionSchema,
    },
    (args) =>
      handleCheckEntityPermission(
        user,
        args.entityId as string,
        args.entityType as string,
      ),
  );
};
