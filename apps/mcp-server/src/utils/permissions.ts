import {
  type ActionType,
  type EntityTypeType,
} from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

import type { McpToolResult } from "./types.js";

const mkAccessDenied = (): McpToolResult => ({
  isError: true,
  content: [{ type: "text", text: "Access denied." }],
});

export const accessDenied = mkAccessDenied;

export const assertPermission = async (
  userId: string,
  entityId: string,
  entityType: EntityTypeType,
  action: ActionType,
  email?: string,
): Promise<McpToolResult | null> => {
  const rbacService = getRBACService();
  const result = await rbacService.checkPermission(
    userId,
    entityId,
    entityType,
    action,
    email ? { email } : undefined,
  );

  if (!result.allowed) {
    console.log(
      JSON.stringify({
        event: "permission_denied",
        userId,
        entityId,
        entityType,
        action,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      }),
    );
    return mkAccessDenied();
  }

  return null;
};

export const assertEntityExists = <T>(
  entity: T | null | undefined,
  entityId: string,
  entityType: string,
  userId: string,
): McpToolResult | null => {
  if (!entity) {
    console.log(
      JSON.stringify({
        event: "entity_not_found",
        userId,
        entityId,
        entityType,
        timestamp: new Date().toISOString(),
      }),
    );
    return mkAccessDenied();
  }
  return null;
};
