/**
 * RBAC guards for the tasks/milestones routers.
 *
 * Tasks and milestones are scoped to a project. New rows store the project id
 * in `documentId`, but legacy rows point `documentId` at the chat `Document`
 * they were generated from and hold the project only in
 * `milestones.projectId`. So the project of a milestone is
 * `coalesce(projectId, documentId)`, and a task inherits its milestone's — see
 * `getMilestoneProjectId` / `getTaskProjectId` in the db package.
 *
 * Routes keyed on a project/document id extract it synchronously; routes keyed
 * on a task or milestone id resolve the owning project from that row first. A
 * row id matching nothing gets the same 403 as a denial, so those routes never
 * emit 404 — see `requireEntityPermission` in the rbac package for why.
 *
 * READ routes additionally allow the public-government fallback: any
 * authenticated user may read tasks of a public project owned by a publicly
 * listed organization, as long as the `tasks` module is not hidden/private.
 */

import type { Context } from "hono";

import {
  getMilestoneProjectId,
  getTaskProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { type ActionType, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  isMembershipGrant,
  type RBACContext,
  requireEntityPermission,
  requireEntityReadOrPublicGov,
  requirePermission,
  requireProjectReadOrPublicGov,
} from "@wildfires-org/turboplan-rbac/hono";

import { type AssigneeCarrier, withoutAssignees } from "./assignee-redaction";

/** Module identifier used for hiddenModules/privateModules checks. */
const PUBLIC_GOV_READ = { moduleName: "tasks" } as const;

/**
 * Resolver for a guard keyed on a row id: the owning project, or `null` (→ the
 * guard's uniform 403) when the path carries no id or the row does not exist.
 */
const projectFromParam =
  (lookup: (id: string) => Promise<string | null>, paramName: string) =>
  async (c: Context<RBACContext>): Promise<string | null> => {
    const id = c.req.param(paramName);
    if (!id) {
      return null;
    }
    return lookup(id);
  };

const taskProject = (paramName: string) =>
  projectFromParam(getTaskProjectId, paramName);

const milestoneProject = (paramName: string) =>
  projectFromParam(getMilestoneProjectId, paramName);

/** Guard a route whose path carries the project id directly. */
export const requireProjectPermission = (
  action: ActionType,
  paramName: "documentId" | "projectId" = "documentId",
) =>
  requirePermission(
    EntityType.PROJECT,
    action,
    (c) => c.req.param(paramName) ?? null,
  );

/** READ guard for a route whose path carries the project id directly. */
export const requireProjectReadAccess = (
  paramName: "documentId" | "projectId" = "documentId",
) =>
  requireProjectReadOrPublicGov(
    (c) => c.req.param(paramName) ?? null,
    PUBLIC_GOV_READ,
  );

/** Guard a route keyed on a task id. */
export const requireProjectPermissionFromTask = (
  action: ActionType,
  paramName = "id",
) =>
  requireEntityPermission(EntityType.PROJECT, action, taskProject(paramName));

/** READ guard keyed on a task id, with public-government fallback. */
export const requireProjectReadAccessFromTask = (paramName = "id") =>
  requireEntityReadOrPublicGov(taskProject(paramName), PUBLIC_GOV_READ);

/** Guard a route keyed on a milestone id. */
export const requireProjectPermissionFromMilestone = (
  action: ActionType,
  paramName = "id",
) =>
  requireEntityPermission(
    EntityType.PROJECT,
    action,
    milestoneProject(paramName),
  );

/** READ guard keyed on a milestone id, with public-government fallback. */
export const requireProjectReadAccessFromMilestone = (paramName = "id") =>
  requireEntityReadOrPublicGov(milestoneProject(paramName), PUBLIC_GOV_READ);

/**
 * True when a READ guard let the caller in through the public-government
 * fallback only (no role on the project). The guards leave `permissionResult`
 * unset in that case.
 */
const isPublicViewer = (c: Context<RBACContext>): boolean => {
  const permissionResult = c.get("permissionResult");
  return !permissionResult || !isMembershipGrant(permissionResult);
};

/**
 * Tasks/milestones as the caller may see them: unchanged for project members,
 * with assignee identities (emails) removed for public-government readers.
 */
export const assigneesVisibleTo = <T extends AssigneeCarrier>(
  c: Context<RBACContext>,
  items: T[],
): T[] => (isPublicViewer(c) ? items.map(withoutAssignees) : items);
