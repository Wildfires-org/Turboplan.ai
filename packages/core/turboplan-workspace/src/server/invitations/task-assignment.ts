import {
  getMilestoneIdsInProject,
  getTaskIdsInProject,
} from "@wildfires-org/turboplan-db/queries";

import type { TaskAssignment } from "./types";

/**
 * One message for "does not exist" and "belongs to another project", so the
 * members endpoint cannot be used to probe other tenants' task/milestone ids.
 */
export const TASK_ASSIGNMENT_ERROR =
  "taskAssignment does not belong to this project";

type TaskAssignmentLookups = {
  getTaskIdsInProject: (projectId: string, ids: string[]) => Promise<string[]>;
  getMilestoneIdsInProject: (
    projectId: string,
    ids: string[],
  ) => Promise<string[]>;
};

const defaultLookups: TaskAssignmentLookups = {
  getTaskIdsInProject,
  getMilestoneIdsInProject,
};

/**
 * Check that the task and/or milestone a new member is to be assigned to live
 * inside `projectId`. Returns a caller-facing 400 message, or `null` when the
 * assignment is empty or every id resolves inside the project.
 */
export const validateTaskAssignment = async (
  projectId: string,
  taskAssignment: TaskAssignment | null | undefined,
  lookups: TaskAssignmentLookups = defaultLookups,
): Promise<string | null> => {
  const taskId = taskAssignment?.taskId;
  const milestoneId = taskAssignment?.milestoneId;

  if (taskId) {
    const found = await lookups.getTaskIdsInProject(projectId, [taskId]);
    if (!found.includes(taskId)) {
      return TASK_ASSIGNMENT_ERROR;
    }
  }

  if (milestoneId) {
    const found = await lookups.getMilestoneIdsInProject(projectId, [
      milestoneId,
    ]);
    if (!found.includes(milestoneId)) {
      return TASK_ASSIGNMENT_ERROR;
    }
  }

  return null;
};
