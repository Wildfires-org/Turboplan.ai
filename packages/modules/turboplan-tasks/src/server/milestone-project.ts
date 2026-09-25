import type { Milestone } from "../types";

/**
 * The project a milestone belongs to: `projectId`, or `documentId` when unset.
 * Legacy milestones hold a chat `Document` id in `documentId`, so `projectId`
 * wins. Mirrors `milestoneProjectId` in the db package, which the RBAC guards
 * resolve with.
 */
export const projectIdOfMilestone = (
  milestone: Pick<Milestone, "projectId" | "documentId">,
): string => milestone.projectId ?? milestone.documentId;

/** True when `milestone` belongs to `projectId` on either column. */
export const milestoneBelongsTo = (
  milestone: Pick<Milestone, "projectId" | "documentId">,
  projectId: string,
): boolean =>
  milestone.documentId === projectId || milestone.projectId === projectId;
