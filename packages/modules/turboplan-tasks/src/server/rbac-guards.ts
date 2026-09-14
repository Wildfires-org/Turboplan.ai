/**
 * RBAC guards for the tasks/milestones routers.
 *
 * Tasks and milestones are scoped to a project. By convention the `documentId`
 * column on both tables holds the owning project's id (the client passes
 * `documentId: projectId` for every task/milestone operation), so project
 * membership is resolved from `documentId`.
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

import { milestones, tasks } from "@wildfires-org/turboplan-db";
import { type ActionType, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  requireEntityPermission,
  requireEntityReadOrPublicGov,
  requirePermission,
  requireProjectReadOrPublicGov,
  resolveProjectIdFromRow,
} from "@wildfires-org/turboplan-rbac/hono";

/** Module identifier used for hiddenModules/privateModules checks. */
const PUBLIC_GOV_READ = { moduleName: "tasks" } as const;

const taskProject = (paramName: string) =>
  resolveProjectIdFromRow(tasks, tasks.id, tasks.documentId, paramName);

const milestoneProject = (paramName: string) =>
  resolveProjectIdFromRow(
    milestones,
    milestones.id,
    milestones.documentId,
    paramName,
  );

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
