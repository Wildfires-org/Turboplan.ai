/**
 * Project Tasks Hook
 *
 * This is the main entry point that composes smaller, focused modules:
 * - Error handling
 * - Optimistic updates
 * - Task operations
 * - Milestone operations
 * - Data fetching
 */

import { useCallback, useEffect, useMemo } from "react";

import { taskDataService } from "../../services/task-service";
import { useTaskStore } from "../../stores/task-store";
import type { DateChangedPayload } from "../../types";
import { resolveAssigneeProjectId } from "../../utils/assignee-project";
import { createErrorHandler } from "./errorHandler";
import {
  createMilestoneOperations,
  type MilestoneStoreActions,
} from "./milestoneOperations";
import { createOptimisticExecutor } from "./optimisticUpdates";
import { createTaskOperations, type TaskStoreActions } from "./taskOperations";
import type {
  ProjectTasksActions,
  UseProjectTasksConfig,
  UseProjectTasksReturn,
} from "./types";

/**
 * Main hook for project task management
 * Provides a clean interface to task and milestone operations with optimistic updates
 */
export function useProjectTasks({
  projectId,
  context = "project",
  userId,
  taskService = taskDataService,
}: UseProjectTasksConfig): UseProjectTasksReturn {
  // ===== STORE CONNECTION =====

  const store = useTaskStore();
  const {
    milestones,
    loading,
    error,
    availableUsers,

    // Store actions
    setLoading,
    setError,
    setAvailableUsers,

    // Optimistic actions
    addMilestone,
    updateMilestone: updateMilestoneInStore,
    removeMilestone,
    addTask,
    updateTask: updateTaskInStore,
    removeTask,

    initializeMilestones,
  } = store;

  // ===== ERROR HANDLING =====

  const handleServiceError = useMemo(
    () => createErrorHandler(setError),
    [setError],
  );

  // ===== OPTIMISTIC UPDATE PATTERN =====

  const executeOptimistic = useMemo(
    () => createOptimisticExecutor(handleServiceError),
    [handleServiceError],
  );

  // ===== DATA OPERATIONS =====

  const refreshData = useCallback(async () => {
    if (!projectId || projectId === "init") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data =
        context === "project"
          ? await taskService.fetchProjectMilestones(projectId)
          : await taskService.fetchMilestonesWithTasks(projectId);

      initializeMilestones(data);
    } catch (error) {
      handleServiceError(error, "refreshData");
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    context,
    setLoading,
    setError,
    initializeMilestones,
    handleServiceError,
  ]);

  // Assignee candidates are scoped to the project. A chat artifact only learns
  // its project once milestones load, hence the derived id.
  const assigneeProjectId = resolveAssigneeProjectId(
    context,
    projectId,
    milestones,
  );

  const refreshUsers = useCallback(async () => {
    if (!assigneeProjectId || assigneeProjectId === "init") {
      setAvailableUsers([]);
      return;
    }

    try {
      const users = await taskService.fetchUsers(assigneeProjectId);
      setAvailableUsers(users);
    } catch (error) {
      // Readers without a project role (public-government viewers) are denied
      // the list; that must not turn the whole task view into an error.
      console.error("Failed to fetch assignable users:", error);
      setAvailableUsers([]);
    }
  }, [assigneeProjectId, setAvailableUsers]);

  // ===== TASK OPERATIONS =====

  const taskStoreActions: TaskStoreActions = useMemo(
    () => ({
      addTask,
      updateTask: updateTaskInStore,
      removeTask,
      setError,
    }),
    [addTask, updateTaskInStore, removeTask, setError],
  );

  const taskOperations = useMemo(
    () =>
      createTaskOperations({
        projectId,
        userId,
        milestones,
        storeActions: taskStoreActions,
        executeOptimistic,
        taskService,
      }),
    [
      projectId,
      userId,
      milestones,
      taskStoreActions,
      executeOptimistic,
      taskService,
    ],
  );

  // ===== MILESTONE OPERATIONS =====

  const milestoneStoreActions: MilestoneStoreActions = useMemo(
    () => ({
      addMilestone,
      updateMilestone: updateMilestoneInStore,
      removeMilestone,
      setError,
    }),
    [addMilestone, updateMilestoneInStore, removeMilestone, setError],
  );

  const milestoneOperations = useMemo(
    () =>
      createMilestoneOperations({
        projectId,
        userId,
        milestones,
        storeActions: milestoneStoreActions,
        executeOptimistic,
        taskService,
      }),
    [
      projectId,
      userId,
      milestones,
      milestoneStoreActions,
      executeOptimistic,
      taskService,
    ],
  );

  // ===== ADVANCED OPERATIONS =====

  const updateItemDates = useCallback(
    async (payload: DateChangedPayload, isMilestone: boolean) => {
      if (isMilestone) {
        await milestoneOperations.updateMilestone(payload.id, {
          startDate: payload.start,
          dueDate: payload.end,
        });
      } else {
        await taskOperations.updateTask(payload.id, {
          startDate: payload.start,
          dueDate: payload.end,
        });
      }
    },
    [milestoneOperations, taskOperations],
  );

  // ===== INITIALIZATION =====

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // ===== RETURN INTERFACE =====

  const actions: ProjectTasksActions = useMemo(
    () => ({
      // Data operations
      refreshData,
      refreshUsers,

      // Task operations
      ...taskOperations,

      // Milestone operations
      ...milestoneOperations,

      // Advanced operations
      updateItemDates,
    }),
    [
      refreshData,
      refreshUsers,
      taskOperations,
      milestoneOperations,
      updateItemDates,
    ],
  );

  return {
    // State
    milestones,
    loading,
    error,
    availableUsers,

    // Actions
    actions,
  };
}

// Re-export types for convenience
export type {
  ProjectTasksActions,
  UseProjectTasksConfig,
  UseProjectTasksReturn,
} from "./types";
