import { useCallback } from "react";

import { apiService } from "../services/api-service";
import { useTaskStore } from "../stores/task-store";
import {
  DateChangedPayload,
  Milestone,
  MilestoneWithTasks,
  Task,
  TaskStatus,
  User,
} from "../types";
import { resolveAssigneeProjectId } from "../utils/assignee-project";

export const useTaskActions = (
  documentId: string,
  onSaveContent?: (content: string, debounce: boolean) => void,
) => {
  const {
    milestones,
    selectedTask,
    selectedTaskForAssignee,
    selectedMilestoneForAssignee,
    setError,
    setIsUpdatingTask,
    setSelectedTask,
    setTaskEditModalOpen,
    setAssigneeModalOpen,
    setSelectedTaskForAssignee,
    setSelectedMilestoneForAssignee,
    setAvailableUsers,
    initializeMilestones,
    setDependenciesModalOpen,
    setSelectedTaskForDependencies,
    setIsCreatingNewTask,
    setNewTaskMilestoneId,
  } = useTaskStore();

  // Refresh data utility
  const refreshData = useCallback(async () => {
    try {
      const data = await apiService.fetchMilestonesWithTasks(documentId);
      initializeMilestones(data);
      return data;
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to refresh data",
      );
      return [];
    }
  }, [documentId, initializeMilestones, setError]);

  // Function to save current state to document
  const saveCurrentStateToDocument = useCallback(
    async (updatedMilestones?: MilestoneWithTasks[]) => {
      if (!onSaveContent) return;

      try {
        // Use provided milestones or current state
        const milestonesToSave = updatedMilestones || milestones;

        // Clean data for content JSON - remove assignees field (keep only assigneeIds)
        const cleanedMilestones = milestonesToSave.map((milestone) => {
          const { assignees: _assignees, ...milestoneWithoutAssignees } =
            milestone;
          return {
            ...milestoneWithoutAssignees,
            tasks: milestone.tasks.map((task) => {
              const { assignees: _taskAssignees, ...taskWithoutAssignees } =
                task;
              return taskWithoutAssignees;
            }),
          };
        });

        const content = JSON.stringify({
          milestones: cleanedMilestones,
        });

        // Save as new document version (no debounce for manual changes)
        onSaveContent(content, false);
      } catch (error) {
        console.error("Failed to save current state to document:", error);
      }
    },
    [onSaveContent, milestones],
  );

  // Fetch the project's assignable users (this hook is keyed by a chat
  // document, so the project comes from the loaded milestones)
  const fetchUsers = useCallback(async () => {
    const projectId = resolveAssigneeProjectId(
      "document",
      documentId,
      milestones,
    );
    if (!projectId) {
      setAvailableUsers([]);
      return [];
    }

    try {
      const users = await apiService.fetchUsers(projectId);
      setAvailableUsers(users);
      return users;
    } catch (error) {
      console.error("Failed to fetch users:", error);
      // Don't set error state for users fetch failure, just log it
      return [];
    }
  }, [documentId, milestones, setAvailableUsers]);

  // Task handlers
  const handleTaskUpdate = useCallback(
    async (taskId: string, updatedTask: Partial<Task>) => {
      try {
        setIsUpdatingTask(true);

        await apiService.updateTask(taskId, updatedTask);

        // Refresh data and update selected task if modal is open
        const refreshedMilestones = await refreshData();

        if (selectedTask && selectedTask.id === taskId) {
          const updatedTask = refreshedMilestones
            .flatMap((milestone) => milestone.tasks)
            .find((task) => task.id === taskId);
          if (updatedTask) {
            setSelectedTask(updatedTask);
          }
        }

        // Save current state to document after successful update
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error updating task:", error);
        setError(
          error instanceof Error ? error.message : "Failed to update task",
        );
      } finally {
        setIsUpdatingTask(false);
      }
    },
    [
      selectedTask,
      refreshData,
      setIsUpdatingTask,
      setSelectedTask,
      setError,
      saveCurrentStateToDocument,
    ],
  );

  const handleTaskModalSave = useCallback(
    (updatedTask: Partial<Task>) => {
      if (selectedTask) {
        handleTaskUpdate(selectedTask.id, updatedTask);
      }
    },
    [selectedTask, handleTaskUpdate],
  );

  const markTaskAsNotStarted = useCallback(
    async (taskId: string) => {
      try {
        setIsUpdatingTask(true);
        await apiService.markTaskAsNotStarted(taskId);

        // Refresh data and update selected task if modal is open
        const refreshedMilestones = await refreshData();

        if (selectedTask && selectedTask.id === taskId) {
          const updatedTask = refreshedMilestones
            .flatMap((milestone) => milestone.tasks)
            .find((task) => task.id === taskId);
          if (updatedTask) {
            setSelectedTask(updatedTask);
          }
        }

        // Save current state to document after successful status change
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error marking task as not started:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update task status",
        );
      } finally {
        setIsUpdatingTask(false);
      }
    },
    [
      selectedTask,
      refreshData,
      setIsUpdatingTask,
      setSelectedTask,
      setError,
      saveCurrentStateToDocument,
    ],
  );

  const handleTaskStatusClick = useCallback(
    (taskId: string) => {
      // Find the task to check its status
      const task = milestones
        .flatMap((milestone) => milestone.tasks)
        .find((task) => task.id === taskId);

      if (!task) {
        console.warn("Task not found:", taskId);
        return;
      }

      // Only allow status change if task is in DRAFT status
      if (task.status === TaskStatus.DRAFT) {
        markTaskAsNotStarted(taskId);
      }
    },
    [milestones, markTaskAsNotStarted],
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      // Find the task to open in modal
      const task = milestones
        .flatMap((milestone) => milestone.tasks)
        .find((task) => task.id === taskId);

      if (!task) {
        console.warn("Task not found:", taskId);
        return;
      }

      // Reset creation state and set editing state
      setIsCreatingNewTask(false);
      setNewTaskMilestoneId(null);
      setSelectedTask(task);
      setTaskEditModalOpen(true);
    },
    [
      milestones,
      setSelectedTask,
      setTaskEditModalOpen,
      setIsCreatingNewTask,
      setNewTaskMilestoneId,
    ],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await apiService.deleteTask(taskId);
        const refreshedMilestones = await refreshData();

        // Save current state to document after successful deletion
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error deleting task:", error);
        setError(
          error instanceof Error ? error.message : "Failed to delete task",
        );
      }
    },
    [refreshData, setError, saveCurrentStateToDocument],
  );

  const handleCreateTask = useCallback(
    async (taskData: Partial<Task>) => {
      try {
        setIsUpdatingTask(true);

        // Add required fields for task creation
        const taskCreateData = {
          ...taskData,
          documentId,
          userId: "current-user", // This should be replaced with actual user ID from auth
        };

        await apiService.createTask(taskCreateData);
        const refreshedMilestones = await refreshData();

        // Close the modal
        setTaskEditModalOpen(false);
        setIsCreatingNewTask(false);
        setNewTaskMilestoneId(null);
        setSelectedTask(null);

        // Save current state to document after successful creation
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error creating task:", error);
        setError(
          error instanceof Error ? error.message : "Failed to create task",
        );
      } finally {
        setIsUpdatingTask(false);
      }
    },
    [
      documentId,
      refreshData,
      setTaskEditModalOpen,
      setIsCreatingNewTask,
      setNewTaskMilestoneId,
      setSelectedTask,
      setIsUpdatingTask,
      setError,
      saveCurrentStateToDocument,
    ],
  );

  const handleOpenCreateTaskModal = useCallback(
    (milestoneId?: string) => {
      // Reset editing state and set creation state
      setSelectedTask(null);
      setIsCreatingNewTask(true);
      setNewTaskMilestoneId(milestoneId || null);
      setTaskEditModalOpen(true);
    },
    [
      setIsCreatingNewTask,
      setNewTaskMilestoneId,
      setSelectedTask,
      setTaskEditModalOpen,
    ],
  );

  // Milestone handlers
  const handleMilestoneUpdate = useCallback(
    async (milestoneId: string, updatedMilestone: Partial<Milestone>) => {
      try {
        await apiService.updateMilestone(milestoneId, updatedMilestone);
        const refreshedMilestones = await refreshData();

        // Save current state to document after successful update
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error updating milestone:", error);
        setError(
          error instanceof Error ? error.message : "Failed to update milestone",
        );
      }
    },
    [refreshData, setError, saveCurrentStateToDocument],
  );

  const handleRenameMilestone = useCallback(
    async (milestoneId: string, newTitle: string) => {
      try {
        await apiService.updateMilestone(milestoneId, { title: newTitle });
        const refreshedMilestones = await refreshData();

        // Save current state to document after successful rename
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error renaming milestone:", error);
        setError(
          error instanceof Error ? error.message : "Failed to rename milestone",
        );
      }
    },
    [refreshData, setError, saveCurrentStateToDocument],
  );

  const handleRenameTask = useCallback(
    async (taskId: string, newTitle: string) => {
      try {
        await apiService.updateTask(taskId, { title: newTitle });
        const refreshedMilestones = await refreshData();

        // Save current state to document after successful rename
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error renaming task:", error);
        setError(
          error instanceof Error ? error.message : "Failed to rename task",
        );
      }
    },
    [refreshData, setError, saveCurrentStateToDocument],
  );

  const handleDeleteMilestone = useCallback(
    async (milestoneId: string) => {
      try {
        await apiService.deleteMilestone(milestoneId);
        const refreshedMilestones = await refreshData();
        initializeMilestones(refreshedMilestones);

        // Save current state to document after successful deletion
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error deleting milestone:", error);
        setError(
          error instanceof Error ? error.message : "Failed to delete milestone",
        );
      }
    },
    [refreshData, initializeMilestones, setError, saveCurrentStateToDocument],
  );

  const handleCreateMilestone = useCallback(async () => {
    try {
      setIsUpdatingTask(true);

      // Set default dates (same logic as tasks)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(0, 0, 0, 0);

      // Create milestone with default data
      const milestoneData = {
        title: "New Milestone",
        status: TaskStatus.NOT_STARTED,
        startDate: tomorrow,
        dueDate: dayAfterTomorrow,
        documentId,
        userId: "current-user", // This should be replaced with actual user ID from auth
        // Order is now calculated server-side
      };

      await apiService.createMilestone(milestoneData);
      const refreshedMilestones = await refreshData();

      // Save current state to document after successful creation
      await saveCurrentStateToDocument(refreshedMilestones);
    } catch (error) {
      console.error("Error creating milestone:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create milestone",
      );
    } finally {
      setIsUpdatingTask(false);
    }
  }, [
    documentId,
    refreshData,
    setError,
    setIsUpdatingTask,
    saveCurrentStateToDocument,
  ]);

  // Assignee handlers
  const handleAvatarClick = useCallback(
    async (itemId: string) => {
      // Find the task or milestone for assignee modal
      const task = milestones
        .flatMap((milestone) => milestone.tasks)
        .find((task) => task.id === itemId);

      const milestone = milestones.find((milestone) => milestone.id === itemId);

      if (!task && !milestone) {
        console.warn("Task or milestone not found:", itemId);
        return;
      }

      // Fetch fresh users before opening the modal
      await fetchUsers();

      if (task) {
        setSelectedTaskForAssignee(task);
        setSelectedMilestoneForAssignee(null);
      } else if (milestone) {
        setSelectedMilestoneForAssignee(milestone);
        setSelectedTaskForAssignee(null);
      }

      setAssigneeModalOpen(true);
    },
    [
      milestones,
      fetchUsers,
      setSelectedTaskForAssignee,
      setSelectedMilestoneForAssignee,
      setAssigneeModalOpen,
    ],
  );

  const handleAssigneeModalSave = useCallback(
    async (assignees: User[]) => {
      if (selectedTaskForAssignee) {
        // Update task with new assignees
        const updatedTask: Partial<Task> = {
          assigneeIds: assignees.map((user) => user.id),
        };

        await handleTaskUpdate(selectedTaskForAssignee.id, updatedTask);
      } else if (selectedMilestoneForAssignee) {
        // Update milestone with new assignees
        const updatedMilestone = {
          assigneeIds: assignees.map((user) => user.id),
        };

        await handleMilestoneUpdate(
          selectedMilestoneForAssignee.id,
          updatedMilestone,
        );
      }

      // Close modal
      setAssigneeModalOpen(false);
      setSelectedTaskForAssignee(null);
      setSelectedMilestoneForAssignee(null);
    },
    [
      selectedTaskForAssignee,
      selectedMilestoneForAssignee,
      handleTaskUpdate,
      handleMilestoneUpdate,
      setAssigneeModalOpen,
      setSelectedTaskForAssignee,
      setSelectedMilestoneForAssignee,
    ],
  );

  // Dependencies handlers
  const handleManageDependencies = useCallback(
    async (taskId: string) => {
      // Find the task for dependencies modal
      const task = milestones
        .flatMap((milestone) => milestone.tasks)
        .find((task) => task.id === taskId);

      if (!task) {
        console.warn("Task not found:", taskId);
        return;
      }

      setSelectedTaskForDependencies(task);
      setDependenciesModalOpen(true);
    },
    [milestones, setSelectedTaskForDependencies, setDependenciesModalOpen],
  );

  const handleDependenciesSave = useCallback(
    async (taskId: string, dependencies: string[]) => {
      try {
        const updatedTask: Partial<Task> = {
          dependencies,
        };

        await handleTaskUpdate(taskId, updatedTask);

        // Close modal
        setDependenciesModalOpen(false);
        setSelectedTaskForDependencies(null);
      } catch (error) {
        console.error("Error updating dependencies:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update dependencies",
        );
      }
    },
    [
      handleTaskUpdate,
      setDependenciesModalOpen,
      setSelectedTaskForDependencies,
      setError,
    ],
  );

  // Date change handler
  const handleDateChange = useCallback(
    async (payload: DateChangedPayload) => {
      try {
        // Find the item to determine if it's a task or milestone
        const allItems = milestones.flatMap((m) => [
          { ...m, isMilestone: true },
          ...(m.tasks || []).map((t) => ({ ...t, isMilestone: false })),
        ]);

        const item = allItems.find((i) => i.id === payload.id);
        if (!item) {
          console.error("Item not found:", payload.id);
          return;
        }

        await apiService.updateItemDates(payload, item.isMilestone);
        const refreshedMilestones = await refreshData();

        // Save current state to document after successful date update
        await saveCurrentStateToDocument(refreshedMilestones);
      } catch (error) {
        console.error("Error updating dates:", error);
        setError(
          error instanceof Error ? error.message : "Failed to update dates",
        );
      }
    },
    [milestones, refreshData, setError, saveCurrentStateToDocument],
  );

  return {
    // Data utilities
    refreshData,
    fetchUsers,
    // Task handlers
    handleTaskUpdate,
    handleTaskModalSave,
    handleTaskStatusClick,
    handleTaskClick,
    handleDeleteTask,
    handleCreateTask,
    handleOpenCreateTaskModal,
    // Milestone handlers
    handleMilestoneUpdate,
    handleRenameMilestone,
    handleRenameTask,
    handleDeleteMilestone,
    handleCreateMilestone,
    // Assignee handlers
    handleAvatarClick,
    handleAssigneeModalSave,
    // Dependencies handlers
    handleManageDependencies,
    handleDependenciesSave,
    // Date handlers
    handleDateChange,
  };
};
