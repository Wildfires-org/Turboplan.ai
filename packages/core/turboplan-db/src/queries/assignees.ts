/**
 * Assignee queries and service
 * Handles assigning users to tasks and milestones
 * Located in turboplan-db to avoid circular dependencies between packages
 */
import { eq } from "drizzle-orm";

import { db } from "../db-client";
import { milestones, tasks } from "../schemas";

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
): Promise<AssigneeResult> {
  const [task] = await db
    .select({ assigneeIds: tasks.assigneeIds })
    .from(tasks)
    .where(eq(tasks.id, taskId))
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
    .where(eq(tasks.id, taskId));

  return { success: true };
}

/**
 * Add a user to a milestone's assigneeIds array
 * Returns success status and whether user was already assigned
 */
export async function addAssigneeToMilestone(
  userId: string,
  milestoneId: string,
): Promise<AssigneeResult> {
  const [milestone] = await db
    .select({ assigneeIds: milestones.assigneeIds })
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
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
    .where(eq(milestones.id, milestoneId));

  return { success: true };
}

/**
 * Assign a user to a task and/or milestone
 * Convenience function that handles both in one call
 */
export async function assignUserToTaskAndMilestone(
  userId: string,
  taskId?: string,
  milestoneId?: string,
): Promise<void> {
  if (taskId) {
    await addAssigneeToTask(userId, taskId);
  }

  if (milestoneId) {
    await addAssigneeToMilestone(userId, milestoneId);
  }
}
