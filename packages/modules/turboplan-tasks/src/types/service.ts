/**
 * Service Interfaces (Dependency Inversion Principle)
 * Depend on abstractions, not concretions
 */

import type {
  DateChangedPayload,
  Milestone,
  MilestoneWithTasks,
  Task,
  User,
} from "../types";

// ===== SERVICE INTERFACES =====

export interface ITaskDataService {
  // Queries
  fetchMilestonesWithTasks(documentId: string): Promise<MilestoneWithTasks[]>;
  fetchProjectMilestones(projectId: string): Promise<MilestoneWithTasks[]>;
  /** Users the project's tasks/milestones can be assigned to */
  fetchUsers(projectId: string): Promise<User[]>;

  // Task Commands
  createTask(taskData: Partial<Task>): Promise<Task>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;

  // Task Status Commands
  markTaskAsNotStarted(taskId: string): Promise<Task>;
  markTaskAsCompleted(taskId: string): Promise<Task>;
  markTaskAsInProgress(taskId: string): Promise<Task>;
  markTaskAsDelayed(taskId: string): Promise<Task>;

  // Milestone Commands
  createMilestone(milestoneData: Partial<Milestone>): Promise<Milestone>;
  updateMilestone(
    milestoneId: string,
    updates: Partial<Milestone>,
  ): Promise<Milestone>;
  deleteMilestone(milestoneId: string): Promise<void>;

  // Milestone Status Commands
  markMilestoneAsCompleted(milestoneId: string): Promise<Milestone>;
  markMilestoneAsInProgress(milestoneId: string): Promise<Milestone>;
  markMilestoneAsDelayed(milestoneId: string): Promise<Milestone>;

  // Specialized Commands
  updateItemDates(
    payload: DateChangedPayload,
    isMilestone: boolean,
  ): Promise<void>;
  moveTaskToMilestone(taskId: string, milestoneId: string): Promise<Task>;
}

export interface ITaskSyncService {
  // Authentication
  isAuthenticated(): Promise<boolean>;
  clearAuthentication(): void;
}

// ===== SERVICE RESULT TYPES =====

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface OptimisticOperation<T> {
  execute(): Promise<T>;
  revert?(): void;
}

// ===== ERROR TYPES =====

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export class NetworkError extends TaskServiceError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR");
  }
}

export class ValidationError extends TaskServiceError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class AuthenticationError extends TaskServiceError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
  }
}
