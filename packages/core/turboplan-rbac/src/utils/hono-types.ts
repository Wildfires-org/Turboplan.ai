import type { PermissionCheckResult } from "../types";

/**
 * User context interface for RBAC middleware
 * This should be set by your auth middleware before using requirePermission
 */
export interface RBACUserContext {
  userId: string;
  email?: string;
  /**
   * Optional user role from the profile, populated from the API token when
   * present. Routes that need it should fall back to a DB lookup if absent.
   */
  userRole?: string;
}

/**
 * How the request was authenticated. `pat` is a long-lived personal access
 * token; `session` is a short-lived JWT minted from an interactive login. PATs
 * are deliberately weaker: no PAT management, no admin routes, and no
 * platform-admin RBAC bypass.
 */
export type AuthMethod = "pat" | "session";

/**
 * Extended Hono context variables that RBAC middleware uses and sets
 */
export interface RBACContextVariables {
  user: RBACUserContext;
  /** Set by the auth middleware; absent means a session token. */
  authMethod?: AuthMethod;
  permissionResult?: PermissionCheckResult;
}

/**
 * Type helper for creating a Hono app with RBAC context
 *
 * @example
 * import { Hono } from 'hono';
 * import type { RBACContext } from '@wildfires-org/turboplan-rbac';
 *
 * const app = new Hono<RBACContext>();
 */
export type RBACContext = {
  Variables: RBACContextVariables;
};
