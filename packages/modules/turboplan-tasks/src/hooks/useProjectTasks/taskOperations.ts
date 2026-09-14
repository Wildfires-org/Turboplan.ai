/**
 * Task Operations Module
 * Contains all task-related CRUD operations with optimistic updates
 * Single Responsibility: Task management logic
 */

import type { MilestoneWithTasks, Task } from "../../types";
import { TaskStatus } from "../../types";
import type { ITaskDataService } from "../../types/service";

export interface TaskStoreActions {
  addTask: (milestoneId: string, task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  setError: (error: string) => void;
}

export interface TaskOperationsConfig {
  projectId: string;
  userId?: string;
  milestones: MilestoneWithTasks[];
  storeActions: TaskStoreActions;
  executeOptimistic: <T>(
    optimisticUpdate: () => void,
    apiOperation: () => Promise<T>,
    revertUpdate: () => void,
    operationName: string,
  ) => Promise<T>;
  taskService: ITaskDataService;
}

/**
 * Creates task operation handlers with optimistic updates
 */
export function createTaskOperations(config: TaskOperationsConfig) {
  const {
    projectId,
    milestones,
    storeActions,
    executeOptimistic,
    taskService,
  } = config;

  const { addTask, updateTask, removeTask, setError } = storeActions;

  // ===== TASK CRUD OPERATIONS =====

  const createTask = async (milestoneId: string, taskData: Partial<Task>) => {
    // Validate required fields
    if (!taskData.title?.trim()) {
      setError("Task title is required");
      throw new Error("Task title is required");
    }

    const optimisticTask: Task = {
      id: `temp-${crypto.randomUUID()}`,
      title: taskData.title || "New Task",
      description: taskData.description || "",
      status: taskData.status || TaskStatus.NOT_STARTED,
      assigneeIds: taskData.assigneeIds || [],
      dependencies: taskData.dependencies || [],
      projectDocumentIds: taskData.projectDocumentIds || [],
      startDate: taskData.startDate || new Date(),
      dueDate: taskData.dueDate || new Date(),
      order: taskData.order || 0,
      milestoneId,
      userId: config.userId || "", // Backend should validate/populate from session
      documentId: projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await executeOptimistic(
      // Optimistic update
      () => addTask(milestoneId, optimisticTask),

      // API operation
      async () => {
        const taskCreateData = {
          ...taskData,
          milestoneId,
          documentId: projectId,
        };
        return await taskService.createTask(taskCreateData);
      },

      // Revert
      () => removeTask(optimisticTask.id),

      "createTask",
    );
  };

  const updateTaskById = async (taskId: string, updates: Partial<Task>) => {
    // Store original task for revert
    let originalTask: Task | null = null;

    for (const milestone of milestones) {
      const task = milestone.tasks.find((t) => t.id === taskId);
      if (task) {
        originalTask = { ...task };
        break;
      }
    }

    if (!originalTask) {
      setError("Task not found");
      return;
    }

    await executeOptimistic(
      // Optimistic update
      () => updateTask(taskId, updates),

      // API operation
      () => taskService.updateTask(taskId, updates),

      // Revert
      () => updateTask(taskId, originalTask!),

      "updateTask",
    );
  };

  const deleteTask = async (taskId: string) => {
    // Store original task and milestone for revert
    let originalTask: Task | null = null;
    let originalMilestoneId: string | null = null;

    for (const milestone of milestones) {
      const task = milestone.tasks.find((t) => t.id === taskId);
      if (task) {
        originalTask = { ...task };
        originalMilestoneId = milestone.id;
        break;
      }
    }

    if (!originalTask || !originalMilestoneId) {
      setError("Task not found");
      return;
    }

    await executeOptimistic(
      // Optimistic update
      () => removeTask(taskId),

      // API operation
      () => taskService.deleteTask(taskId),

      // Revert
      () => addTask(originalMilestoneId!, originalTask!),

      "deleteTask",
    );
  };

  // ===== TASK STATUS OPERATIONS =====

  const markTaskAsNotStarted = async (taskId: string) => {
    await updateTaskById(taskId, { status: TaskStatus.NOT_STARTED });
  };

  const markTaskAsCompleted = async (taskId: string) => {
    await updateTaskById(taskId, { status: TaskStatus.COMPLETED });
  };

  const markTaskAsInProgress = async (taskId: string) => {
    await updateTaskById(taskId, { status: TaskStatus.IN_PROGRESS });
  };

  const markTaskAsDelayed = async (taskId: string) => {
    await updateTaskById(taskId, { status: TaskStatus.DELAYED });
  };

  // ===== ADVANCED OPERATIONS =====

  const moveTaskToMilestone = async (taskId: string, milestoneId: string) => {
    await updateTaskById(taskId, { milestoneId });
  };

  return {
    createTask,
    updateTask: updateTaskById,
    deleteTask,
    markTaskAsNotStarted,
    markTaskAsCompleted,
    markTaskAsInProgress,
    markTaskAsDelayed,
    moveTaskToMilestone,
  };
}
