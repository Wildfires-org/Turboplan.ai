import type { Milestone } from "../types";

/**
 * The project whose people the assignee picker offers.
 *
 * On a project page the id in hand is the project. A chat artifact is keyed by
 * its document id instead, so the project comes from the milestones it holds;
 * legacy artifacts that never belonged to a project resolve to `null` and get
 * no assignee list.
 */
export const resolveAssigneeProjectId = (
  context: "document" | "project",
  id: string,
  milestones: Pick<Milestone, "projectId">[],
): string | null => {
  if (context === "project") {
    return id;
  }

  return milestones.find((milestone) => milestone.projectId)?.projectId ?? null;
};
