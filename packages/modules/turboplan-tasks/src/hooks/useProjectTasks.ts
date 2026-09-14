/**
 * Business Logic Layer - Project Tasks
 *
 * This file re-exports from the modular implementation in useProjectTasks/:
 * - types.ts: Type definitions
 * - errorHandler.ts: Error handling logic
 * - optimisticUpdates.ts: Optimistic update pattern
 * - taskOperations.ts: Task CRUD operations
 * - milestoneOperations.ts: Milestone CRUD operations
 * - index.ts: Main orchestration hook
 */

export type {
  ProjectTasksActions,
  UseProjectTasksConfig,
  UseProjectTasksReturn,
} from "./useProjectTasks/index";
export { useProjectTasks } from "./useProjectTasks/index";
