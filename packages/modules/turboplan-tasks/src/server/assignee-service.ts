/**
 * Assignee Service
 * Re-exports from turboplan-db/queries for backwards compatibility
 *
 * The actual implementation lives in turboplan-db to avoid circular dependencies
 * between turboplan-workspace and turboplan-tasks.
 */
import {
  addAssigneeToMilestone,
  addAssigneeToTask,
  assignUserToTaskAndMilestone,
} from "@wildfires-org/turboplan-db/queries";

/**
 * AssigneeService class for backwards compatibility
 * Wraps the query functions from turboplan-db
 */
export class AssigneeService {
  /**
   * Assign a user to a task and/or milestone
   * Adds the userId to the assigneeIds array if not already present
   */
  async assignUserToTask(
    projectId: string,
    userId: string,
    taskId?: string,
    milestoneId?: string,
  ): Promise<void> {
    await assignUserToTaskAndMilestone({
      projectId,
      userId,
      taskId,
      milestoneId,
    });
  }

  /**
   * Add a user to a task's assigneeIds array
   */
  async addAssigneeToTask(
    userId: string,
    taskId: string,
    projectId: string,
  ): Promise<void> {
    await addAssigneeToTask(userId, taskId, projectId);
  }

  /**
   * Add a user to a milestone's assigneeIds array
   */
  async addAssigneeToMilestone(
    userId: string,
    milestoneId: string,
    projectId: string,
  ): Promise<void> {
    await addAssigneeToMilestone(userId, milestoneId, projectId);
  }
}

// Singleton instance
let assigneeServiceInstance: AssigneeService | null = null;

/**
 * Get the singleton AssigneeService instance
 */
export function getAssigneeService(): AssigneeService {
  if (!assigneeServiceInstance) {
    assigneeServiceInstance = new AssigneeService();
  }
  return assigneeServiceInstance;
}

// Re-export the query functions for direct use
export {
  addAssigneeToMilestone,
  addAssigneeToTask,
  assignUserToTaskAndMilestone,
} from "@wildfires-org/turboplan-db/queries";
