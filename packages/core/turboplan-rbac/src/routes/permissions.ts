import { Hono } from "hono";

import type { ActionType, EntityTypeType } from "../types";
import { EntityType } from "../types";
import { getRBACServiceForRequest } from "../utils/hono-middleware";
import type { RBACContext } from "../utils/hono-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const permissionsRouter = new Hono<RBACContext>();

/**
 * GET /permissions?entityId=xxx&entityType=xxx&action=xxx
 * Check if the current user has permission to perform an action on an entity
 */
permissionsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const entityId = c.req.query("entityId");
    const entityType = c.req.query("entityType") as EntityTypeType;
    const action = c.req.query("action") as ActionType;

    if (!entityId || !entityType || !action) {
      return c.json(
        { error: "entityId, entityType, and action are required" },
        400,
      );
    }

    const rbacService = getRBACServiceForRequest(c);
    const result = await rbacService.checkPermission(
      user.userId,
      entityId,
      entityType,
      action,
    );

    return c.json({
      allowed: result.allowed,
      reason: result.reason,
      effectiveRole: result.effectiveRole,
    });
  } catch (error) {
    console.error("Error checking permission:", error);
    return c.json({ error: "Failed to check permission" }, 500);
  }
});

const isEntityType = (value: string): value is EntityTypeType =>
  (Object.values(EntityType) as string[]).includes(value);

/**
 * GET /permissions/actions?entityId=xxx&entityType=xxx
 * Every action the current user may perform on the entity, plus the effective
 * role. One call replaces the per-action fan-out of `GET /permissions`.
 *
 * Declared before any parameterised route so `/actions` is never swallowed by
 * a `/:param` matcher added later.
 */
permissionsRouter.get("/actions", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const entityId = c.req.query("entityId");
    const entityType = c.req.query("entityType");

    if (!entityId || !entityType) {
      return c.json({ error: "entityId and entityType are required" }, 400);
    }

    if (!isEntityType(entityType)) {
      return c.json({ error: "Invalid entityType" }, 400);
    }

    // Entity ids are uuid columns; a malformed one would surface as a Postgres
    // parse error (500) from the ancestor lookup instead of a client error.
    if (!UUID_RE.test(entityId)) {
      return c.json({ error: "Invalid entityId" }, 400);
    }

    const rbacService = getRBACServiceForRequest(c);
    const result = await rbacService.getAllowedActions(
      user.userId,
      entityId,
      entityType,
      { email: user.email },
    );

    return c.json({
      actions: result.actions,
      effectiveRole: result.effectiveRole,
    });
  } catch (error) {
    console.error("Error resolving allowed actions:", error);
    return c.json({ error: "Failed to resolve allowed actions" }, 500);
  }
});
