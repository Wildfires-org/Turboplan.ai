import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context, Next } from "hono";

import { db } from "@wildfires-org/turboplan-db/db-client";

import {
  isMembershipGrant,
  NO_PERMISSION_REASON,
} from "../permission-resolver";
import { getRBACService } from "../services/rbac.service";
import type { ActionType, EntityTypeType } from "../types";
import { Action, EntityType } from "../types";
import { isAdmin } from "./admin-server";
import type { RBACContext } from "./hono-types";
import {
  isPublicGovProjectReadAllowed,
  type PublicGovReadAccessOptions,
} from "./public-project-access";

export { NO_PERMISSION_REASON };

type Middleware = (
  c: Context<RBACContext>,
  next: Next,
) => Promise<Response | void>;

/** Resolves the entity id a guard should check, or `null` when unresolvable. */
type EntityIdResolver = (
  c: Context<RBACContext>,
) => string | null | Promise<string | null>;

/** Response emitted when the resolver yields no entity id. */
type MissingEntityIdResponder = (c: Context<RBACContext>) => Response;

const respondBadRequest: MissingEntityIdResponder = (c) =>
  c.json({ error: "Entity ID not found" }, 400);

/**
 * Denies with the exact body a permission denial produces, so a caller cannot
 * tell "this row does not exist" from "this row exists but is not yours".
 */
const respondUniformForbidden: MissingEntityIdResponder = (c) =>
  c.json({ error: "Forbidden", reason: NO_PERMISSION_REASON }, 403);

const respondForbidden = (c: Context<RBACContext>, reason?: string) =>
  c.json({ error: "Forbidden", reason }, 403);

const respondServerError = (c: Context<RBACContext>, error: unknown) => {
  console.error("RBAC middleware error:", error);
  return c.json({ error: "Internal Server Error" }, 500);
};

/**
 * RBAC service for this request. Personal access tokens never get the
 * platform-admin bypass — a leaked admin PAT must not unlock every entity.
 * Prefer this over a bare `getRBACService()` in request handlers.
 */
export const getRBACServiceForRequest = (c: Context<RBACContext>) =>
  getRBACService(undefined, {
    platformAdminBypass: c.get("authMethod") !== "pat",
  });

/**
 * Whether the caller is a platform admin on a session. Personal access tokens
 * never carry admin powers, so a PAT request is never an admin here.
 */
export const isSessionAdmin = async (c: Context<RBACContext>) => {
  if (c.get("authMethod") === "pat") {
    return false;
  }

  const user = c.get("user");
  return isAdmin(user.userId, user.email);
};

/**
 * Shared body of every permission guard: authenticate, resolve the entity id,
 * check the permission, and normalise the failure responses.
 */
const createPermissionGuard = (
  entityType: EntityTypeType,
  action: ActionType,
  resolveEntityId: EntityIdResolver,
  onMissingEntityId: MissingEntityIdResponder,
  requireMembership = false,
): Middleware => {
  return async (c: Context<RBACContext>, next: Next) => {
    try {
      // Get user from context (set by auth middleware)
      const user = c.get("user");

      if (!user?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const entityId = await resolveEntityId(c);
      if (!entityId) {
        return onMissingEntityId(c);
      }

      const permissionResult = await getRBACServiceForRequest(
        c,
      ).checkPermission(user.userId, entityId, entityType, action, {
        email: user.email,
      });

      if (!permissionResult.allowed) {
        return respondForbidden(c, permissionResult.reason);
      }

      if (requireMembership && !isMembershipGrant(permissionResult)) {
        return respondUniformForbidden(c);
      }

      // Store permission check result in context for downstream use
      c.set("permissionResult", permissionResult);

      await next();
    } catch (error) {
      return respondServerError(c, error);
    }
  };
};

/**
 * Shared body of the READ-or-public-government guards.
 */
const createReadOrPublicGovGuard = (
  resolveProjectId: EntityIdResolver,
  options: PublicGovReadAccessOptions,
  onMissingProjectId: MissingEntityIdResponder,
): Middleware => {
  return async (c: Context<RBACContext>, next: Next) => {
    try {
      const user = c.get("user");
      if (!user?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const projectId = await resolveProjectId(c);
      if (!projectId) {
        return onMissingProjectId(c);
      }

      const permissionResult = await getRBACServiceForRequest(
        c,
      ).checkPermission(
        user.userId,
        projectId,
        EntityType.PROJECT,
        Action.READ,
        { email: user.email },
      );

      if (permissionResult.allowed) {
        c.set("permissionResult", permissionResult);
        await next();
        return;
      }

      const allowedAsPublic = await isPublicGovProjectReadAllowed(
        projectId,
        options,
      );

      if (!allowedAsPublic) {
        return respondForbidden(c, permissionResult.reason);
      }

      // Public-government readers get no permissionResult — they hold no role.
      await next();
    } catch (error) {
      return respondServerError(c, error);
    }
  };
};

/**
 * Hono middleware to check entity-based permissions
 * @param entityType - Type of entity (organization, office, project)
 * @param action - Action to perform (create, read, update, delete, manage_members)
 * @param getEntityId - Function to extract entity ID from context (e.g., from URL params)
 * @returns Hono middleware function
 *
 * Use {@link requireEntityPermission} when the entity id has to be looked up
 * asynchronously (e.g. resolving the owning project of a task row).
 *
 * @example
 * import { Hono } from 'hono';
 * import { requirePermission, EntityType, Action, type RBACContext } from '@wildfires-org/turboplan-rbac';
 *
 * const app = new Hono<RBACContext>();
 *
 * app.get('/organizations/:orgId', requirePermission('organization', 'read', (c) => c.req.param('orgId')), async (c) => {
 *   // User has read permission for this organization
 *   const user = c.get('user'); // Typed!
 *   const permissionResult = c.get('permissionResult'); // Typed!
 * });
 */
export function requirePermission(
  entityType: EntityTypeType,
  action: ActionType,
  getEntityId: (c: Context<RBACContext>) => string | null,
): Middleware {
  return createPermissionGuard(
    entityType,
    action,
    getEntityId,
    respondBadRequest,
  );
}

/**
 * Like {@link requirePermission}, but the grant must come from a role on the
 * entity itself (direct, inherited from a parent, or platform admin). READ that
 * is only derived upward from a child membership — e.g. a project member
 * reading its parent office — is rejected with the uniform 403.
 *
 * Use on endpoints that expose the entity's staff (member lists, pending
 * invitations), which a member of a single child project must not see.
 */
export function requireMemberPermission(
  entityType: EntityTypeType,
  action: ActionType,
  getEntityId: (c: Context<RBACContext>) => string | null,
): Middleware {
  return createPermissionGuard(
    entityType,
    action,
    getEntityId,
    respondBadRequest,
    true,
  );
}

/**
 * Async counterpart of {@link requirePermission} for routes whose entity id is
 * not in the request — it has to be looked up first (typically the owning
 * project of a row keyed by its own id).
 *
 * Failure modes:
 * - no authenticated user → 401 `{ error: "Unauthorized" }`
 * - `resolveEntityId` returns `null` → 403
 *   `{ error: "Forbidden", reason: "No permission found" }`
 * - permission denied → 403 with the resolver's reason
 * - thrown error → 500 `{ error: "Internal Server Error" }`
 *
 * The unresolvable-id branch deliberately answers with the SAME body as a
 * permission denial rather than a 400/404. Distinguishing the two turns the
 * route into an existence oracle: an outsider could enumerate valid ids by
 * watching for 403 vs 404. Routes guarded this way therefore never emit 404 —
 * a caller who legitimately holds access to a deleted row also sees the 403.
 *
 * @example
 * app.patch(
 *   '/tasks/:id',
 *   requireEntityPermission(
 *     EntityType.PROJECT,
 *     Action.UPDATE,
 *     resolveProjectIdFromRow(tasks, tasks.id, tasks.documentId, 'id'),
 *   ),
 *   handler,
 * );
 */
export function requireEntityPermission(
  entityType: EntityTypeType,
  action: ActionType,
  resolveEntityId: (c: Context<RBACContext>) => Promise<string | null>,
): Middleware {
  return createPermissionGuard(
    entityType,
    action,
    resolveEntityId,
    respondUniformForbidden,
  );
}

/**
 * Hono middleware for READ access to a project that additionally allows
 * any authenticated user to read a project when:
 *   - project.isPublic === true
 *   - the project belongs to a GOVERNMENT organization
 *   - (if `moduleName` is provided) the module is not in hiddenModules or privateModules
 *
 * Use this on project-scoped READ endpoints that should be viewable by citizens
 * browsing public government projects, while keeping the same RBAC guarantees
 * for private/non-government projects.
 */
export function requireProjectReadOrPublicGov(
  getProjectId: (c: Context<RBACContext>) => string | null,
  options: PublicGovReadAccessOptions = {},
): Middleware {
  return createReadOrPublicGovGuard(getProjectId, options, respondBadRequest);
}

/**
 * Async counterpart of {@link requireProjectReadOrPublicGov} for routes whose
 * project id has to be looked up first.
 *
 * Same public-government fallback, and the same uniform 403 as
 * {@link requireEntityPermission} when the project id cannot be resolved — see
 * that docblock for why an unresolvable id must not be distinguishable from a
 * denial. A reader allowed only by the public-government fallback holds no
 * role, so `permissionResult` is left unset for them.
 */
export function requireEntityReadOrPublicGov(
  resolveProjectId: (c: Context<RBACContext>) => Promise<string | null>,
  options: PublicGovReadAccessOptions = {},
): Middleware {
  return createReadOrPublicGovGuard(
    resolveProjectId,
    options,
    respondUniformForbidden,
  );
}

/**
 * Build an entity-id resolver for the common "the row names its owning project"
 * case: read the id out of a URL param, then look up the owning project id on
 * that row.
 *
 * Returns `null` when the param is absent or no row matches, which the async
 * guards translate into the uniform 403 described on
 * {@link requireEntityPermission}.
 *
 * @param table - Table holding the row (e.g. `tasks`)
 * @param idColumn - Column the URL param matches (e.g. `tasks.id`)
 * @param projectColumn - Column holding the owning project id (e.g. `tasks.documentId`)
 * @param paramName - Name of the URL param carrying the row id
 */
export const resolveProjectIdFromRow = (
  table: PgTable,
  idColumn: PgColumn,
  projectColumn: PgColumn,
  paramName: string,
): ((c: Context<RBACContext>) => Promise<string | null>) => {
  return async (c: Context<RBACContext>) => {
    const entityId = c.req.param(paramName);
    if (!entityId) {
      return null;
    }

    const rows = await db
      .select({ projectId: projectColumn })
      .from(table)
      .where(eq(idColumn, entityId))
      .limit(1);

    const projectId = rows[0]?.projectId;
    return typeof projectId === "string" ? projectId : null;
  };
};
