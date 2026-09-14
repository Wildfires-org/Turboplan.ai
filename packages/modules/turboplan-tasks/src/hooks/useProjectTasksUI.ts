/**
 * UI Layer Hook - Project Tasks UI State Management
 * Orchestrates UI state with business logic
 * Single Responsibility: UI state management and component integration
 */

import { useCallback, useEffect, useMemo } from "react";

import { useTaskStore } from "../stores/task-store";
import type {
  DateChangedPayload,
  Milestone,
  MilestoneWithTasks,
  Task,
  User,
  ViewMode,
} from "../types";
import { TaskStatus } from "../types";
import { useProjectTasks } from "./useProjectTasks";

// ===== HOOK CONFIGURATION =====

interface UseProjectTasksUIConfig {
  projectId: string;
  context?: "document" | "project";
  userId?: string; // Optional: Current user ID (will be passed to business logic layer)
}

// ===== COMPUTED STATE TYPES =====

interface ComputedTaskData {
  displayMilestones: MilestoneWithTasks[];
  filteredMilestones: MilestoneWithTasks[];
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}

// ===== UI ACTION HANDLERS =====

export interface UIActionHandlers {
  // Task Modal Handlers
  handleTaskClick: (task: Task) => void;
  handleCreateTask: (milestoneId?: string) => void;
  handleTaskModalSave: (updatedTask: Partial<Task>) => Promise<void>;
  handleCloseTaskModal: () => void;

  // Task Actions
  handleTaskStatusClick: (
    taskId: string,
    currentStatus: TaskStatus,
  ) => Promise<void>;
  handleTaskStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  handleRenameTask: (taskId: string, newTitle: string) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;

  // Milestone Handlers
  handleCreateMilestone: () => Promise<void>;
  handleRenameMilestone: (
    milestoneId: string,
    newTitle: string,
  ) => Promise<void>;
  handleDeleteMilestone: (milestoneId: string) => Promise<void>;

  // Assignment Handlers
  handleAvatarClick: (item: Task | Milestone) => void;
  handleAssigneeModalSave: (assignees: User[]) => Promise<void>;
  handleCloseAssigneeModal: () => void;
  /** Update assignees directly by target ID — no dependency on selected state */
  handleUpdateAssignees: (
    target: { taskId?: string; milestoneId?: string },
    assigneeIds: string[],
  ) => Promise<void>;

  // Dependencies Handlers
  handleManageDependencies: (task: Task) => void;
  handleDependenciesSave: (
    taskId: string,
    dependencies: string[],
  ) => Promise<void>;
  handleCloseDependenciesModal: () => void;

  // Date Handlers
  handleDateChange: (
    payload: DateChangedPayload,
    isMilestone: boolean,
  ) => Promise<void>;

  // Inline update — saves task without closing modals
  handleTaskInlineUpdate: (updatedTask: Partial<Task>) => Promise<void>;

  // Retry Handler
  handleRetry: () => Promise<void>;
}

// ===== HOOK RETURN TYPE =====

export interface UseProjectTasksUIReturn extends ComputedTaskData {
  // Base data
  loading: boolean;
  error: string | null;
  availableUsers: User[];

  // UI State
  ui: {
    activeTab: "gantt" | "card";
    searchQuery: string;
    filterMode: "all" | "hideCompleted";
    expandedMilestones: { [key: string]: boolean };
    milestonesOpenStatus: { [key: string]: boolean };
    ganttViewMode: ViewMode;

    // Modal states
    isTaskEditModalOpen: boolean;
    selectedTask: Task | null;
    isCreatingNewTask: boolean;
    newTaskMilestoneId: string | null;
    isAssigneeModalOpen: boolean;
    selectedTaskForAssignee: Task | null;
    selectedMilestoneForAssignee: Milestone | null;
    isDependenciesModalOpen: boolean;
    selectedTaskForDependencies: Task | null;
  };

  // UI Controls
  controls: {
    setActiveTab: (tab: "gantt" | "card") => void;
    setSearchQuery: (query: string) => void;
    setFilterMode: (mode: "all" | "hideCompleted") => void;
    setGanttViewMode: (mode: ViewMode) => void;
    toggleMilestone: (milestoneId: string) => void;
    clearSearch: () => void;
    showAll: () => void;
  };

  // Action Handlers
  handlers: UIActionHandlers;
}

// ===== HOOK IMPLEMENTATION =====

export function useProjectTasksUI({
  projectId,
  context = "project",
  userId,
}: UseProjectTasksUIConfig): UseProjectTasksUIReturn {
  // ===== BUSINESS LOGIC LAYER =====

  const businessLogic = useProjectTasks({ projectId, context, userId });
  const {
    milestones,
    loading,
    error,
    availableUsers,
    actions: businessActions,
  } = businessLogic;

  // ===== UI STATE LAYER =====

  const uiStore = useTaskStore();
  const {
    // UI State
    activeTab,
    searchQuery,
    filterMode,
    expandedMilestones,
    milestonesOpenStatus,
    ganttViewMode,

    // Modal State
    isTaskEditModalOpen,
    selectedTask,
    isCreatingNewTask,
    newTaskMilestoneId,
    isAssigneeModalOpen,
    selectedTaskForAssignee,
    selectedMilestoneForAssignee,
    isDependenciesModalOpen,
    selectedTaskForDependencies,

    // UI Actions
    setActiveTab,
    setSearchQuery,
    setFilterMode,
    setGanttViewMode,
    toggleMilestone,

    // Modal Actions
    setTaskEditModalOpen,
    setSelectedTask,
    setIsCreatingNewTask,
    setNewTaskMilestoneId,
    setAssigneeModalOpen,
    setSelectedTaskForAssignee,
    setSelectedMilestoneForAssignee,
    setDependenciesModalOpen,
    setSelectedTaskForDependencies,
    closeAllModals,

    // Complex actions
    updateSearchExpansion,
  } = uiStore;

  // ===== COMPUTED STATE =====

  const computedData = useMemo((): ComputedTaskData => {
    // Create a user lookup map for O(1) access
    const userMap = new Map(availableUsers.map((user) => [user.id, user]));

    // Enrich milestones with assignees populated from availableUsers
    const displayMilestones: MilestoneWithTasks[] = milestones.map(
      (milestone) => ({
        ...milestone,
        assignees: (milestone.assigneeIds || [])
          .map((id) => userMap.get(id))
          .filter((user): user is User => user !== undefined),
        tasks: milestone.tasks.map((task) => ({
          ...task,
          assignees: (task.assigneeIds || [])
            .map((id) => userMap.get(id))
            .filter((user): user is User => user !== undefined),
        })),
      }),
    );

    // Filter milestones based on search and completion
    let filteredMilestones = displayMilestones;

    // Apply completion filter
    if (filterMode === "hideCompleted") {
      filteredMilestones = displayMilestones
        .filter((milestone) => milestone.status !== TaskStatus.COMPLETED)
        .map((milestone) => ({
          ...milestone,
          tasks: milestone.tasks.filter(
            (task) => task.status !== TaskStatus.COMPLETED,
          ),
        }));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredMilestones = filteredMilestones
        .map((milestone) => {
          const milestoneMatches = milestone.title
            .toLowerCase()
            .includes(query);
          const filteredTasks = milestone.tasks.filter((task) =>
            task.title.toLowerCase().includes(query),
          );

          if (milestoneMatches || filteredTasks.length > 0) {
            return {
              ...milestone,
              tasks: filteredTasks,
            };
          }
          return null;
        })
        .filter(Boolean) as MilestoneWithTasks[];
    }

    // Calculate totals
    const totalTasks = displayMilestones.reduce(
      (sum, m) => sum + m.tasks.length,
      0,
    );
    const completedTasks = displayMilestones.reduce(
      (sum, m) =>
        sum + m.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      0,
    );
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      displayMilestones,
      filteredMilestones,
      totalTasks,
      completedTasks,
      completionPercentage,
    };
  }, [milestones, availableUsers, searchQuery, filterMode]);

  // Update search expansion when filtered milestones change
  useEffect(() => {
    updateSearchExpansion(computedData.filteredMilestones);
  }, [computedData.filteredMilestones, updateSearchExpansion]);

  // ===== UI ACTION HANDLERS =====

  // Task Modal Handlers
  const handleTaskClick = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      setIsCreatingNewTask(false);
      setTaskEditModalOpen(true);
    },
    [setSelectedTask, setIsCreatingNewTask, setTaskEditModalOpen],
  );

  const handleCreateTask = useCallback(
    (milestoneId?: string) => {
      setSelectedTask(null);
      setIsCreatingNewTask(true);
      setNewTaskMilestoneId(milestoneId || null);
      setTaskEditModalOpen(true);
    },
    [
      setSelectedTask,
      setIsCreatingNewTask,
      setNewTaskMilestoneId,
      setTaskEditModalOpen,
    ],
  );

  const handleTaskModalSave = useCallback(
    async (updatedTask: Partial<Task>) => {
      try {
        if (selectedTask) {
          // Update existing task
          await businessActions.updateTask(selectedTask.id, updatedTask);
        } else if (isCreatingNewTask) {
          // Create new task
          const targetMilestoneId = newTaskMilestoneId || milestones[0]?.id;
          if (targetMilestoneId) {
            await businessActions.createTask(targetMilestoneId, updatedTask);
          }
        }
        closeAllModals();
      } catch {
        // Error handling is done in business logic layer
        // Errors are displayed via the error state from business logic
      }
    },
    [
      selectedTask,
      isCreatingNewTask,
      newTaskMilestoneId,
      milestones,
      businessActions,
      closeAllModals,
    ],
  );

  // Inline update — saves task without closing modals (used for document linking, etc.)
  const handleTaskInlineUpdate = useCallback(
    async (updatedTask: Partial<Task>) => {
      if (!selectedTask) {
        return;
      }
      try {
        await businessActions.updateTask(selectedTask.id, updatedTask);
      } catch {
        // Error handling is done in business logic layer
      }
    },
    [selectedTask, businessActions],
  );

  const handleCloseTaskModal = useCallback(() => {
    setTaskEditModalOpen(false);
    setSelectedTask(null);
    setIsCreatingNewTask(false);
    setNewTaskMilestoneId(null);
  }, [
    setTaskEditModalOpen,
    setSelectedTask,
    setIsCreatingNewTask,
    setNewTaskMilestoneId,
  ]);

  // Task Action Handlers
  const handleTaskStatusClick = useCallback(
    async (taskId: string, currentStatus: TaskStatus) => {
      // Cycle through statuses: not_started -> in_progress -> completed -> not_started
      switch (currentStatus) {
        case TaskStatus.NOT_STARTED:
          await businessActions.markTaskAsInProgress(taskId);
          break;
        case TaskStatus.IN_PROGRESS:
          await businessActions.markTaskAsCompleted(taskId);
          break;
        case TaskStatus.COMPLETED:
          await businessActions.markTaskAsNotStarted(taskId);
          break;
        default:
          await businessActions.markTaskAsNotStarted(taskId);
      }
    },
    [businessActions],
  );

  // Set a task to a specific status (used by the status dropdown)
  const handleTaskStatusChange = useCallback(
    async (taskId: string, status: TaskStatus) => {
      await businessActions.updateTask(taskId, { status });
    },
    [businessActions],
  );

  const handleRenameTask = useCallback(
    async (taskId: string, newTitle: string) => {
      await businessActions.updateTask(taskId, { title: newTitle });
    },
    [businessActions],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await businessActions.deleteTask(taskId);
    },
    [businessActions],
  );

  // Milestone Handlers
  const handleCreateMilestone = useCallback(async () => {
    await businessActions.createMilestone();
  }, [businessActions]);

  const handleRenameMilestone = useCallback(
    async (milestoneId: string, newTitle: string) => {
      await businessActions.updateMilestone(milestoneId, { title: newTitle });
    },
    [businessActions],
  );

  const handleDeleteMilestone = useCallback(
    async (milestoneId: string) => {
      await businessActions.deleteMilestone(milestoneId);
    },
    [businessActions],
  );

  // Assignment Handlers
  const handleAvatarClick = useCallback(
    (item: Task | Milestone) => {
      // Validate that the item has an id
      if (!item?.id) {
        console.error("Invalid item passed to handleAvatarClick:", item);
        return;
      }

      if ("milestoneId" in item) {
        // It's a Task
        setSelectedTaskForAssignee(item as Task);
        setSelectedMilestoneForAssignee(null);
      } else {
        // It's a Milestone
        setSelectedTaskForAssignee(null);
        setSelectedMilestoneForAssignee(item as Milestone);
      }
      setAssigneeModalOpen(true);
    },
    [
      setSelectedTaskForAssignee,
      setSelectedMilestoneForAssignee,
      setAssigneeModalOpen,
    ],
  );

  const handleAssigneeModalSave = useCallback(
    async (assignees: User[]) => {
      const assigneeIds = assignees.map((u) => u.id);

      try {
        if (selectedTaskForAssignee) {
          if (!selectedTaskForAssignee.id) {
            console.error("Task ID is missing:", selectedTaskForAssignee);
            throw new Error("Invalid task: missing id");
          }
          await businessActions.updateTask(selectedTaskForAssignee.id, {
            assigneeIds,
          });
        } else if (selectedMilestoneForAssignee) {
          if (!selectedMilestoneForAssignee.id) {
            console.error(
              "Milestone ID is missing:",
              selectedMilestoneForAssignee,
            );
            throw new Error("Invalid milestone: missing id");
          }
          await businessActions.updateMilestone(
            selectedMilestoneForAssignee.id,
            { assigneeIds },
          );
        }
        setAssigneeModalOpen(false);
        setSelectedTaskForAssignee(null);
        setSelectedMilestoneForAssignee(null);
      } catch (error) {
        console.error("Error saving assignees:", error);
        // Error handling is done in business logic layer
      }
    },
    [
      selectedTaskForAssignee,
      selectedMilestoneForAssignee,
      businessActions,
      setAssigneeModalOpen,
      setSelectedTaskForAssignee,
      setSelectedMilestoneForAssignee,
    ],
  );

  const handleCloseAssigneeModal = useCallback(() => {
    setAssigneeModalOpen(false);
    setSelectedTaskForAssignee(null);
    setSelectedMilestoneForAssignee(null);
  }, [
    setAssigneeModalOpen,
    setSelectedTaskForAssignee,
    setSelectedMilestoneForAssignee,
  ]);

  const handleUpdateAssignees = useCallback(
    async (
      target: { taskId?: string; milestoneId?: string },
      assigneeIds: string[],
    ) => {
      try {
        if (target.taskId) {
          await businessActions.updateTask(target.taskId, { assigneeIds });
        } else if (target.milestoneId) {
          await businessActions.updateMilestone(target.milestoneId, {
            assigneeIds,
          });
        }
      } catch (error) {
        console.error("Error updating assignees:", error);
      }
    },
    [businessActions],
  );

  // Dependencies Handlers
  const handleManageDependencies = useCallback(
    (task: Task) => {
      setSelectedTaskForDependencies(task);
      setDependenciesModalOpen(true);
    },
    [setSelectedTaskForDependencies, setDependenciesModalOpen],
  );

  const handleDependenciesSave = useCallback(
    async (taskId: string, dependencies: string[]) => {
      try {
        await businessActions.updateTask(taskId, { dependencies });
        setDependenciesModalOpen(false);
        setSelectedTaskForDependencies(null);
      } catch {
        // Error handling is done in business logic layer
      }
    },
    [businessActions, setDependenciesModalOpen, setSelectedTaskForDependencies],
  );

  const handleCloseDependenciesModal = useCallback(() => {
    setDependenciesModalOpen(false);
    setSelectedTaskForDependencies(null);
  }, [setDependenciesModalOpen, setSelectedTaskForDependencies]);

  // Date Handlers
  const handleDateChange = useCallback(
    async (payload: DateChangedPayload, isMilestone: boolean) => {
      await businessActions.updateItemDates(payload, isMilestone);
    },
    [businessActions],
  );

  // Retry Handler
  const handleRetry = useCallback(async () => {
    await businessActions.refreshData();
  }, [businessActions]);

  // ===== UI CONTROLS =====

  const controls = useMemo(
    () => ({
      setActiveTab,
      setSearchQuery,
      setFilterMode,
      setGanttViewMode,
      toggleMilestone,
      clearSearch: () => setSearchQuery(""),
      showAll: () => setFilterMode("all"),
    }),
    [
      setActiveTab,
      setSearchQuery,
      setFilterMode,
      setGanttViewMode,
      toggleMilestone,
    ],
  );

  // ===== ACTION HANDLERS =====

  const handlers = useMemo(
    (): UIActionHandlers => ({
      handleTaskClick,
      handleCreateTask,
      handleTaskModalSave,
      handleCloseTaskModal,
      handleTaskStatusClick,
      handleTaskStatusChange,
      handleRenameTask,
      handleDeleteTask,
      handleCreateMilestone,
      handleRenameMilestone,
      handleDeleteMilestone,
      handleAvatarClick,
      handleAssigneeModalSave,
      handleCloseAssigneeModal,
      handleUpdateAssignees,
      handleManageDependencies,
      handleDependenciesSave,
      handleCloseDependenciesModal,
      handleTaskInlineUpdate,
      handleDateChange,
      handleRetry,
    }),
    [
      handleTaskClick,
      handleCreateTask,
      handleTaskModalSave,
      handleCloseTaskModal,
      handleTaskStatusClick,
      handleTaskStatusChange,
      handleRenameTask,
      handleDeleteTask,
      handleCreateMilestone,
      handleRenameMilestone,
      handleDeleteMilestone,
      handleAvatarClick,
      handleAssigneeModalSave,
      handleCloseAssigneeModal,
      handleUpdateAssignees,
      handleManageDependencies,
      handleDependenciesSave,
      handleCloseDependenciesModal,
      handleTaskInlineUpdate,
      handleDateChange,
      handleRetry,
    ],
  );

  // ===== RETURN INTERFACE =====

  return {
    // Base data
    loading,
    error,
    availableUsers,

    // Computed data
    ...computedData,

    // UI State
    ui: {
      activeTab,
      searchQuery,
      filterMode,
      expandedMilestones,
      milestonesOpenStatus,
      ganttViewMode,
      isTaskEditModalOpen,
      selectedTask,
      isCreatingNewTask,
      newTaskMilestoneId,
      isAssigneeModalOpen,
      selectedTaskForAssignee,
      selectedMilestoneForAssignee,
      isDependenciesModalOpen,
      selectedTaskForDependencies,
    },

    // UI Controls
    controls,

    // Action Handlers
    handlers,
  };
}
