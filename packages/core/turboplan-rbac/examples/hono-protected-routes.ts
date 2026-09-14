import type { Context } from "hono";
import { Hono } from "hono";

import { tasks } from "@wildfires-org/turboplan-db";

import {
  type RBACContext,
  requireEntityPermission,
  requireEntityReadOrPublicGov,
  requirePermission,
  requireProjectReadOrPublicGov,
  resolveProjectIdFromRow,
} from "../src/hono";
import { Action, EntityType } from "../src/index";

// Create Hono app with RBAC context types
const app = new Hono<RBACContext>();

/**
 * Mock auth middleware that sets user in context
 * In production, this would validate JWT tokens, sessions, etc.
 */
const authMiddlewareMock = async (
  c: Context<RBACContext>,
  next: () => Promise<void>,
) => {
  c.set("user", {
    userId: "123e4567-e89b-12d3-a456-426614174000",
    email: "user@example.com",
  });
  await next();
};

/**
 * Example protected routes using entity-based RBAC
 *
 * Prerequisites:
 * 1. RBAC service must be initialized with database connection
 * 2. Auth middleware must set user context with { userId, email? }
 */

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

app.get("/public/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================================================
// ORGANIZATION ROUTES
// ============================================================================

// Read organization (viewer, editor, owner can access)
app.get(
  "/api/organizations/:orgId",
  authMiddlewareMock,
  requirePermission(EntityType.ORGANIZATION, Action.READ, (c) =>
    c.req.param("orgId"),
  ),
  async (c) => {
    const orgId = c.req.param("orgId");
    const permissionResult = c.get("permissionResult");

    return c.json({
      message: "Organization data",
      orgId,
      effectiveRole: permissionResult?.effectiveRole,
    });
  },
);

// Update organization (editor or owner can access)
app.put(
  "/api/organizations/:orgId",
  authMiddlewareMock,
  requirePermission(EntityType.ORGANIZATION, Action.UPDATE, (c) =>
    c.req.param("orgId"),
  ),
  async (c) => {
    const body = await c.req.json();
    return c.json({
      message: "Organization updated",
      data: body,
    });
  },
);

// Delete organization (owner only)
app.delete(
  "/api/organizations/:orgId",
  authMiddlewareMock,
  requirePermission(EntityType.ORGANIZATION, Action.DELETE, (c) =>
    c.req.param("orgId"),
  ),
  async (c) => {
    const orgId = c.req.param("orgId");
    return c.json({
      message: `Organization ${orgId} deleted`,
    });
  },
);

// Manage members (owner only)
app.post(
  "/api/organizations/:orgId/members",
  authMiddlewareMock,
  requirePermission(EntityType.ORGANIZATION, Action.MANAGE_MEMBERS, (c) =>
    c.req.param("orgId"),
  ),
  async (c) => {
    const body = await c.req.json();
    return c.json({
      message: "Member added to organization",
      data: body,
    });
  },
);

// ============================================================================
// OFFICE ROUTES
// ============================================================================

// Read office (with permission inheritance from organization)
app.get(
  "/api/offices/:officeId",
  authMiddlewareMock,
  requirePermission(EntityType.OFFICE, Action.READ, (c) =>
    c.req.param("officeId"),
  ),
  async (c) => {
    const officeId = c.req.param("officeId");
    return c.json({
      message: "Office data",
      officeId,
    });
  },
);

// Update office
app.put(
  "/api/offices/:officeId",
  authMiddlewareMock,
  requirePermission(EntityType.OFFICE, Action.UPDATE, (c) =>
    c.req.param("officeId"),
  ),
  async (c) => {
    const body = await c.req.json();
    return c.json({
      message: "Office updated",
      data: body,
    });
  },
);

// ============================================================================
// PROJECT ROUTES
// ============================================================================

// Read project (with permission inheritance from office/organization)
app.get(
  "/api/projects/:projectId",
  authMiddlewareMock,
  requirePermission(EntityType.PROJECT, Action.READ, (c) =>
    c.req.param("projectId"),
  ),
  async (c) => {
    const projectId = c.req.param("projectId");
    const permissionResult = c.get("permissionResult");

    return c.json({
      message: "Project data",
      projectId,
      effectiveRole: permissionResult?.effectiveRole,
    });
  },
);

// Update project
app.put(
  "/api/projects/:projectId",
  authMiddlewareMock,
  requirePermission(EntityType.PROJECT, Action.UPDATE, (c) =>
    c.req.param("projectId"),
  ),
  async (c) => {
    const body = await c.req.json();
    return c.json({
      message: "Project updated",
      data: body,
    });
  },
);

// Delete project (owner only)
app.delete(
  "/api/projects/:projectId",
  authMiddlewareMock,
  requirePermission(EntityType.PROJECT, Action.DELETE, (c) =>
    c.req.param("projectId"),
  ),
  async (c) => {
    const projectId = c.req.param("projectId");
    return c.json({
      message: `Project ${projectId} deleted`,
    });
  },
);

// ============================================================================
// ADVANCED EXAMPLES
// ============================================================================

// Example: Extract entity ID from query parameter
app.get(
  "/api/reports",
  authMiddlewareMock,
  requirePermission(
    EntityType.ORGANIZATION,
    Action.READ,
    (c) => c.req.query("orgId") || null,
  ),
  async (c) => {
    return c.json({
      message: "Reports data",
    });
  },
);

// Example: Extract entity ID from request body
// Note: For sync extraction, you'd typically use a different approach
// This is a simplified example - in practice, extract from URL params or query
app.post(
  "/api/actions",
  authMiddlewareMock,
  requirePermission(EntityType.PROJECT, Action.UPDATE, (c) => {
    // In practice, entity ID should come from URL params or query string
    // Body extraction should be done in the handler, not in getEntityId
    return c.req.query("projectId") || null;
  }),
  async (c) => {
    const body = await c.req.json();
    return c.json({
      message: "Action performed",
      data: body,
    });
  },
);

// ============================================================================
// PROJECT READ WITH PUBLIC-GOVERNMENT FALLBACK
// ============================================================================

// Members read as usual; everyone else may still read the project when it is
// public, owned by a publicly listed government org, and the named module is
// neither hidden nor private. Public readers get NO `permissionResult`.
app.get(
  "/api/projects/:projectId/tasks",
  authMiddlewareMock,
  requireProjectReadOrPublicGov((c) => c.req.param("projectId") ?? null, {
    moduleName: "tasks",
  }),
  async (c) => {
    return c.json({ message: "Tasks for project" });
  },
);

// ============================================================================
// ROW-RESOLVED ENTITY IDS (ASYNC GUARDS)
// ============================================================================

// The route is keyed on a task id, not a project id — the owning project has to
// be looked up before the permission check. `resolveProjectIdFromRow` builds
// that lookup; `requireEntityPermission` runs it.
//
// A task id matching no row resolves to `null`, which answers with the SAME 403
// body as a permission denial. That is deliberate: a 404 here would let an
// outsider enumerate valid task ids by watching 403 vs 404. Handlers behind
// these guards therefore never reach their own "not found" branch.
app.patch(
  "/api/tasks/:id",
  authMiddlewareMock,
  requireEntityPermission(
    EntityType.PROJECT,
    Action.UPDATE,
    resolveProjectIdFromRow(tasks, tasks.id, tasks.documentId, "id"),
  ),
  async (c) => {
    const body = await c.req.json();
    return c.json({ message: "Task updated", data: body });
  },
);

// Async READ guard: same row lookup, plus the public-government fallback.
app.get(
  "/api/tasks/:id",
  authMiddlewareMock,
  requireEntityReadOrPublicGov(
    resolveProjectIdFromRow(tasks, tasks.id, tasks.documentId, "id"),
    { moduleName: "tasks" },
  ),
  async (c) => {
    return c.json({ message: "Task data" });
  },
);

export default app;
