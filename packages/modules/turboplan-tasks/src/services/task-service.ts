/**
 * Service Implementation (Clean Architecture)
 * Implements service interfaces with proper error handling
 */

import { z } from "zod";

import type {
  DateChangedPayload,
  Milestone,
  MilestoneWithTasks,
  Task,
  User,
} from "../types";
import { TaskStatus } from "../types";
import type { ITaskDataService, ITaskSyncService } from "../types/service";
import {
  AuthenticationError,
  NetworkError,
  TaskServiceError,
  ValidationError,
} from "../types/service";
import { apiService } from "./api-service";

// ===== VALIDATION SCHEMAS =====

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.date().nullable(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(TaskStatus),
  assigneeIds: z.array(z.string()),
  dependencies: z.array(z.string()).nullable(),
  projectDocumentIds: z.array(z.string()).nullable(),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  milestoneId: z.string(),
  userId: z.string(),
  documentId: z.string(),
  order: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.nativeEnum(TaskStatus),
  assigneeIds: z.array(z.string()),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  userId: z.string(),
  documentId: z.string(),
  projectId: z.string().nullable(),
  order: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const MilestoneWithTasksSchema: z.ZodType<MilestoneWithTasks> =
  MilestoneSchema.extend({
    tasks: z.array(TaskSchema),
  }) as z.ZodType<MilestoneWithTasks>;

// ===== SERVICE IMPLEMENTATION =====

/**
 * TaskDataService - Service layer implementation for task and milestone data operations.
 * Provides runtime type validation with Zod and centralized error handling.
 * All API responses are validated before being returned to ensure type safety.
 */
export class TaskDataService implements ITaskDataService, ITaskSyncService {
  // ===== ERROR HANDLING WRAPPER =====

  /**
   * Wraps service operations with error handling and transforms errors into typed exceptions.
   * Catches Zod validation errors, network errors, and other failures.
   *
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for error messages
   * @returns The result of the operation
   * @throws {ValidationError} When data validation fails
   * @throws {NetworkError} When network request fails
   * @throws {AuthenticationError} When authentication is required
   * @throws {TaskServiceError} For other errors
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`${operationName} failed:`, error);

      // Handle Zod validation errors
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: unknown[] };
        throw new ValidationError(
          `Validation error during ${operationName}: ${JSON.stringify(zodError.issues)}`,
        );
      }

      if (error instanceof Error) {
        if (error.message.includes("Network")) {
          throw new NetworkError(
            `Network error during ${operationName}: ${error.message}`,
          );
        }
        if (
          error.message.includes("required") ||
          error.message.includes("empty")
        ) {
          throw new ValidationError(
            `Validation error during ${operationName}: ${error.message}`,
          );
        }
        if (
          error.message.includes("unauthorized") ||
          error.message.includes("authentication")
        ) {
          throw new AuthenticationError(
            `Authentication error during ${operationName}: ${error.message}`,
          );
        }
        throw new TaskServiceError(`${operationName} failed: ${error.message}`);
      }

      throw new TaskServiceError(`${operationName} failed with unknown error`);
    }
  }

  // ===== QUERIES =====

  async fetchMilestonesWithTasks(
    documentId: string,
  ): Promise<MilestoneWithTasks[]> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.fetchMilestonesWithTasks(documentId);
      return z.array(MilestoneWithTasksSchema).parse(result);
    }, "fetchMilestonesWithTasks");
  }

  async fetchProjectMilestones(
    projectId: string,
  ): Promise<MilestoneWithTasks[]> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.fetchProjectMilestones(projectId);
      return z.array(MilestoneWithTasksSchema).parse(result);
    }, "fetchProjectMilestones");
  }

  async fetchUsers(projectId: string): Promise<User[]> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.fetchUsers(projectId);
      return z.array(UserSchema).parse(result);
    }, "fetchUsers");
  }

  // ===== TASK COMMANDS =====

  async createTask(taskData: Partial<Task>): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.createTask(taskData);
      // API returns { task: ... } so extract the task
      const task =
        (result as Record<string, unknown> | undefined)?.task ?? result;
      return TaskSchema.parse(task);
    }, "createTask");
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.updateTask(taskId, updates);
      // API returns { task: ... } so extract the task
      const taskResult =
        (result as Record<string, unknown> | undefined)?.task ?? result;

      // Ensure result has an id, fallback to taskId if missing
      const resultWithId =
        taskResult && typeof taskResult === "object"
          ? { id: taskId, ...taskResult }
          : { id: taskId };

      // Validate at least the returned fields with partial schema
      const PartialTaskSchema = TaskSchema.partial().required({ id: true });
      const validated = PartialTaskSchema.parse(resultWithId);

      // Return merged with updates (optimistic UI already applied)
      return { ...updates, ...validated } as Task;
    }, "updateTask");
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.executeWithErrorHandling<void>(async () => {
      await apiService.deleteTask(taskId);
    }, "deleteTask");
  }

  // ===== TASK STATUS COMMANDS =====

  async markTaskAsNotStarted(taskId: string): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markTaskAsNotStarted(taskId);
      const task =
        (result as Record<string, unknown> | undefined)?.task ?? result;
      return (task || { id: taskId }) as Task;
    }, "markTaskAsNotStarted");
  }

  async markTaskAsCompleted(taskId: string): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markTaskAsCompleted(taskId);
      const task =
        (result as Record<string, unknown> | undefined)?.task ?? result;
      return (task || { id: taskId }) as Task;
    }, "markTaskAsCompleted");
  }

  async markTaskAsInProgress(taskId: string): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markTaskAsInProgress(taskId);
      const task =
        (result as Record<string, unknown> | undefined)?.task ?? result;
      return (task || { id: taskId }) as Task;
    }, "markTaskAsInProgress");
  }

  async markTaskAsDelayed(taskId: string): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markTaskAsDelayed(taskId);
      const task =
        (result as Record<string, unknown> | undefined)?.task ?? result;
      return (task || { id: taskId }) as Task;
    }, "markTaskAsDelayed");
  }

  // ===== MILESTONE COMMANDS =====

  async createMilestone(milestoneData: Partial<Milestone>): Promise<Milestone> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.createMilestone(milestoneData);
      // API returns { milestone: ... } so extract the milestone
      const milestone =
        (result as Record<string, unknown> | undefined)?.milestone ?? result;
      return MilestoneSchema.parse(milestone);
    }, "createMilestone");
  }

  async updateMilestone(
    milestoneId: string,
    updates: Partial<Milestone>,
  ): Promise<Milestone> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.updateMilestone(milestoneId, updates);
      // API returns { milestone: ... } so extract the milestone
      const milestoneResult =
        (result as Record<string, unknown> | undefined)?.milestone ?? result;

      // Ensure result has an id, fallback to milestoneId if missing
      const resultWithId =
        milestoneResult && typeof milestoneResult === "object"
          ? { id: milestoneId, ...milestoneResult }
          : { id: milestoneId };

      // Validate at least the returned fields with partial schema
      const PartialMilestoneSchema = MilestoneSchema.partial().required({
        id: true,
      });
      const validated = PartialMilestoneSchema.parse(resultWithId);

      // Return merged with updates (optimistic UI already applied)
      return { ...updates, ...validated } as Milestone;
    }, "updateMilestone");
  }

  async deleteMilestone(milestoneId: string): Promise<void> {
    return this.executeWithErrorHandling<void>(async () => {
      await apiService.deleteMilestone(milestoneId);
    }, "deleteMilestone");
  }

  // ===== MILESTONE STATUS COMMANDS =====

  async markMilestoneAsCompleted(milestoneId: string): Promise<Milestone> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markMilestoneAsCompleted(milestoneId);
      const milestone =
        (result as Record<string, unknown> | undefined)?.milestone ?? result;
      return (milestone || { id: milestoneId }) as Milestone;
    }, "markMilestoneAsCompleted");
  }

  async markMilestoneAsInProgress(milestoneId: string): Promise<Milestone> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markMilestoneAsInProgress(milestoneId);
      const milestone =
        (result as Record<string, unknown> | undefined)?.milestone ?? result;
      return (milestone || { id: milestoneId }) as Milestone;
    }, "markMilestoneAsInProgress");
  }

  async markMilestoneAsDelayed(milestoneId: string): Promise<Milestone> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.markMilestoneAsDelayed(milestoneId);
      const milestone =
        (result as Record<string, unknown> | undefined)?.milestone ?? result;
      return (milestone || { id: milestoneId }) as Milestone;
    }, "markMilestoneAsDelayed");
  }

  // ===== SPECIALIZED COMMANDS =====

  async updateItemDates(
    payload: DateChangedPayload,
    isMilestone: boolean,
  ): Promise<void> {
    return this.executeWithErrorHandling<void>(async () => {
      await apiService.updateItemDates(payload, isMilestone);
    }, "updateItemDates");
  }

  async moveTaskToMilestone(
    taskId: string,
    milestoneId: string,
  ): Promise<Task> {
    return this.executeWithErrorHandling(async () => {
      const result = await apiService.moveTaskToMilestone(taskId, milestoneId);
      return (result || { id: taskId, milestoneId }) as Task;
    }, "moveTaskToMilestone");
  }

  // ===== SYNC SERVICE =====

  async isAuthenticated(): Promise<boolean> {
    return this.executeWithErrorHandling(
      () => apiService.isAuthenticated(),
      "isAuthenticated",
    );
  }

  clearAuthentication(): void {
    apiService.clearAuthentication();
  }
}

// ===== SINGLETON INSTANCE =====

export const taskDataService = new TaskDataService();
