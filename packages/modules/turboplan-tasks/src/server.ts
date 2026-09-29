/**
 * Server-side exports
 * This file is the main entry point for server-side code
 */
// Export tool implementations (when you create them)

export { AssigneeService, getAssigneeService } from "./server/assignee-service";
export { default as milestonesRouter } from "./server/milestones-router";
export { getTaskNotificationService } from "./server/notification-service";
export {
  type ReferenceValidationError,
  validateAssigneeIds,
  validateTaskReferences,
} from "./server/reference-validation";
// Export repositories for direct access
export {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
} from "./server/repository";
// Export services
export { MilestoneService, TaskService } from "./server/service";
export { default as tasksRouter } from "./server/tasks-router";
