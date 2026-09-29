/**
 * Assignee queries and service
 * Handles assigning users to tasks and milestones
 * Located in turboplan-db to avoid circular dependencies between packages
 *
 * Every lookup and write is scoped to the owning project via
 * `taskInProject` / `milestoneInProject`. The ids arrive from request bodies
 * and stored invitations, so a task or milestone in another project must read
 * as "not found" rather than be modified.
 */
import { and, eq } from "drizzle-orm";

import { db } from "../db-client";
import { milestones, tasks } from "../schemas";
import { milestoneInProject, taskInProject } from "./task-references";

/**
 * Result type for assignee operations
 */
export interface AssigneeResult {
  success: boolean;
  alreadyAssigned?: boolean;
  notFound?: boolean;
}

/**
 * Add a user to a task's assigneeIds array
 * Returns success status and whether user was already assigned
 */
export async function addAssigneeToTask(
  userId: string,
  taskId: string,
  projectId: string,
): Promise<AssigneeResult> {
  const inProject = and(eq(tasks.id, taskId), taskInProject(projectId));
  const [task] = await db
    .select({ assigneeIds: tasks.assigneeIds })
    .from(tasks)
    .where(inProject)
    .limit(1);

  if (!task) {
    console.warn(`Task ${taskId} not found for assignee assignment`);
    return { success: false, notFound: true };
  }

  const currentAssignees = task.assigneeIds || [];

  // Skip if user is already assigned
  if (currentAssignees.includes(userId)) {
    return { success: true, alreadyAssigned: true };
  }

  // Add user to assignees
  const updatedAssignees = [...currentAssignees, userId];

  await db
    .update(tasks)
    .set({
      assigneeIds: updatedAssignees,
      updatedAt: new Date(),
    })
    .where(inProject);

  return { success: true };
}

/**
 * Add a user to a milestone's assigneeIds array
 * Returns success status and whether user was already assigned
 */
export async function addAssigneeToMilestone(
  userId: string,
  milestoneId: string,
  projectId: string,
): Promise<AssigneeResult> {
  const inProject = and(
    eq(milestones.id, milestoneId),
    milestoneInProject(projectId),
  );
  const [milestone] = await db
    .select({ assigneeIds: milestones.assigneeIds })
    .from(milestones)
    .where(inProject)
    .limit(1);

  if (!milestone) {
    console.warn(`Milestone ${milestoneId} not found for assignee assignment`);
    return { success: false, notFound: true };
  }

  const currentAssignees = milestone.assigneeIds || [];

  // Skip if user is already assigned
  if (currentAssignees.includes(userId)) {
    return { success: true, alreadyAssigned: true };
  }

  // Add user to assignees
  const updatedAssignees = [...currentAssignees, userId];

  await db
    .update(milestones)
    .set({
      assigneeIds: updatedAssignees,
      updatedAt: new Date(),
    })
    .where(inProject);

  return { success: true };
}

/**
 * Assign a user to a task and/or milestone of `projectId`
 * Convenience function that handles both in one call
 */
export async function assignUserToTaskAndMilestone(params: {
  projectId: string;
  userId: string;
  taskId?: string;
  milestoneId?: string;
}): Promise<void> {
  const { projectId, userId, taskId, milestoneId } = params;

  if (taskId) {
    await addAssigneeToTask(userId, taskId, projectId);
  }

  if (milestoneId) {
    await addAssigneeToMilestone(userId, milestoneId, projectId);
  }
}
