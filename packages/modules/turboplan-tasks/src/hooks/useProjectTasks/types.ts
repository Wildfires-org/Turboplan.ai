/**
 * Type Definitions for Project Tasks Hook
 * Contains all interfaces and types used by useProjectTasks
 */

import type {
  DateChangedPayload,
  Milestone,
  MilestoneWithTasks,
  Task,
  User,
} from "../../types";
import type { ITaskDataService } from "../../types/service";

// ===== HOOK CONFIGURATION =====

export interface UseProjectTasksConfig {
  projectId: string;
  context?: "document" | "project";
  userId?: string; // Optional: Current user ID (if not provided, backend should infer from session)
  taskService?: ITaskDataService; // Dependency injection for testing
}

// ===== ACTION INTERFACES =====

export interface ProjectTasksActions {
  // Data operations
  refreshData: () => Promise<void>;
  refreshUsers: () => Promise<void>;

  // Task operations (with optimistic updates)
  createTask: (milestoneId: string, taskData: Partial<Task>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Task status operations
  markTaskAsNotStarted: (taskId: string) => Promise<void>;
  markTaskAsCompleted: (taskId: string) => Promise<void>;
  markTaskAsInProgress: (taskId: string) => Promise<void>;
  markTaskAsDelayed: (taskId: string) => Promise<void>;

  // Milestone operations (with optimistic updates)
  createMilestone: (milestoneData?: Partial<Milestone>) => Promise<void>;
  updateMilestone: (
    milestoneId: string,
    updates: Partial<Milestone>,
  ) => Promise<void>;
  deleteMilestone: (milestoneId: string) => Promise<void>;

  // Milestone status operations
  markMilestoneAsCompleted: (milestoneId: string) => Promise<void>;
  markMilestoneAsInProgress: (milestoneId: string) => Promise<void>;
  markMilestoneAsDelayed: (milestoneId: string) => Promise<void>;

  // Advanced operations
  updateItemDates: (
    payload: DateChangedPayload,
    isMilestone: boolean,
  ) => Promise<void>;
  moveTaskToMilestone: (taskId: string, milestoneId: string) => Promise<void>;
}

// ===== HOOK RETURN TYPE =====

export interface UseProjectTasksReturn {
  // State (derived from store)
  milestones: MilestoneWithTasks[];
  loading: boolean;
  error: string | null;
  availableUsers: User[];

  // Actions
  actions: ProjectTasksActions;
}
