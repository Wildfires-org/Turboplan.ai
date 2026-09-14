import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  type Milestone,
  type MilestoneWithTasks,
  type Task,
  type User,
  type ViewMode,
} from "../types";

// ===== INTERFACES (Interface Segregation Principle) =====

interface TaskData {
  milestones: MilestoneWithTasks[];
  loading: boolean;
  error: string | null;
  availableUsers: User[];
}

interface TaskUIState {
  searchQuery: string;
  activeTab: "gantt" | "card";
  filterMode: "all" | "hideCompleted";
  expandedMilestones: { [key: string]: boolean };
  ganttViewMode: ViewMode;
  canOnlyFitInYearView: boolean;
  scrollToDate: Date | null;
  milestonesOpenStatus: { [key: string]: boolean };
}

interface TaskModalState {
  isTaskEditModalOpen: boolean;
  selectedTask: Task | null;
  isCreatingNewTask: boolean;
  newTaskMilestoneId: string | null;
  isUpdatingTask: boolean;
  isAssigneeModalOpen: boolean;
  selectedTaskForAssignee: Task | null;
  selectedMilestoneForAssignee: Milestone | null;
  isDependenciesModalOpen: boolean;
  selectedTaskForDependencies: Task | null;
}

// ===== DOMAIN ACTIONS (Single Responsibility) =====

interface TaskDataActions {
  // Data mutations with optimistic updates
  addMilestone: (milestone: MilestoneWithTasks) => void;
  updateMilestone: (milestoneId: string, updates: Partial<Milestone>) => void;
  removeMilestone: (milestoneId: string) => void;

  addTask: (milestoneId: string, task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  setMilestones: (milestones: MilestoneWithTasks[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAvailableUsers: (users: User[]) => void;
}

interface TaskUIActions {
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: "gantt" | "card") => void;
  setFilterMode: (mode: "all" | "hideCompleted") => void;
  setExpandedMilestones: (milestones: { [key: string]: boolean }) => void;
  toggleMilestone: (milestoneId: string) => void;
  setGanttViewMode: (mode: ViewMode) => void;
  setCanOnlyFitInYearView: (canFit: boolean) => void;
  setScrollToDate: (date: Date | null) => void;
  setMilestonesOpenStatus: (status: { [key: string]: boolean }) => void;
  updateMilestoneOpenStatus: (milestoneId: string, isOpen: boolean) => void;
}

interface TaskModalActions {
  setTaskEditModalOpen: (isOpen: boolean) => void;
  setSelectedTask: (task: Task | null) => void;
  setIsCreatingNewTask: (isCreating: boolean) => void;
  setNewTaskMilestoneId: (milestoneId: string | null) => void;
  setIsUpdatingTask: (isUpdating: boolean) => void;
  setAssigneeModalOpen: (isOpen: boolean) => void;
  setSelectedTaskForAssignee: (task: Task | null) => void;
  setSelectedMilestoneForAssignee: (milestone: Milestone | null) => void;
  setDependenciesModalOpen: (isOpen: boolean) => void;
  setSelectedTaskForDependencies: (task: Task | null) => void;
  closeAllModals: () => void;
}

// ===== COMBINED STORE INTERFACE =====

interface TaskStore
  extends TaskData,
    TaskUIState,
    TaskModalState,
    TaskDataActions,
    TaskUIActions,
    TaskModalActions {
  // Complex derived actions
  initializeMilestones: (milestones: MilestoneWithTasks[]) => void;
  updateSearchExpansion: (filteredMilestones: MilestoneWithTasks[]) => void;
  resetSearchState: () => void;
}

// ===== STORE IMPLEMENTATION =====

export const useTaskStore: () => TaskStore = create<TaskStore>()(
  subscribeWithSelector(
    immer<TaskStore>((set, get) => ({
      // Initial state
      milestones: [],
      loading: true,
      error: null,
      availableUsers: [],
      searchQuery: "",
      activeTab: "gantt",
      filterMode: "all",
      expandedMilestones: {},
      ganttViewMode: "Year",
      canOnlyFitInYearView: false,
      scrollToDate: null,
      milestonesOpenStatus: {},
      isTaskEditModalOpen: false,
      selectedTask: null,
      isCreatingNewTask: false,
      newTaskMilestoneId: null,
      isUpdatingTask: false,
      isAssigneeModalOpen: false,
      selectedTaskForAssignee: null,
      selectedMilestoneForAssignee: null,
      isDependenciesModalOpen: false,
      selectedTaskForDependencies: null,

      // ===== DATA ACTIONS (Optimistic Updates) =====

      addMilestone: (milestone) =>
        set((state) => {
          state.milestones.push(milestone);
          // Initialize UI state for new milestone
          state.expandedMilestones[milestone.id] = true;
          state.milestonesOpenStatus[milestone.id] = true;
        }),

      updateMilestone: (milestoneId, updates) =>
        set((state) => {
          const milestone = state.milestones.find((m) => m.id === milestoneId);
          if (milestone) {
            Object.assign(milestone, updates);
          }
        }),

      removeMilestone: (milestoneId) =>
        set((state) => {
          state.milestones = state.milestones.filter(
            (m) => m.id !== milestoneId,
          );
          delete state.expandedMilestones[milestoneId];
          delete state.milestonesOpenStatus[milestoneId];
        }),

      addTask: (milestoneId, task) =>
        set((state) => {
          const milestone = state.milestones.find((m) => m.id === milestoneId);
          if (milestone) {
            milestone.tasks.push(task);
          }
        }),

      updateTask: (taskId, updates) =>
        set((state) => {
          for (const milestone of state.milestones) {
            const task = milestone.tasks.find((t) => t.id === taskId);
            if (task) {
              Object.assign(task, updates);
              break;
            }
          }
          // Update selected task if it's currently selected
          if (state.selectedTask?.id === taskId) {
            Object.assign(state.selectedTask, updates);
          }
        }),

      removeTask: (taskId) =>
        set((state) => {
          for (const milestone of state.milestones) {
            milestone.tasks = milestone.tasks.filter((t) => t.id !== taskId);
          }
        }),

      setMilestones: (milestones) =>
        set((state) => {
          state.milestones = milestones;
        }),

      setLoading: (loading) =>
        set((state) => {
          state.loading = loading;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
        }),

      setAvailableUsers: (users) =>
        set((state) => {
          state.availableUsers = users;
        }),

      // ===== UI ACTIONS =====

      setSearchQuery: (query) =>
        set((state) => {
          state.searchQuery = query;
        }),

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab;
        }),

      setFilterMode: (mode) =>
        set((state) => {
          state.filterMode = mode;
        }),

      setExpandedMilestones: (milestones) =>
        set((state) => {
          state.expandedMilestones = milestones;
        }),

      toggleMilestone: (milestoneId) =>
        set((state) => {
          const isExpanded = state.expandedMilestones[milestoneId];
          state.expandedMilestones[milestoneId] = !isExpanded;
          state.milestonesOpenStatus[milestoneId] = !isExpanded;
        }),

      setGanttViewMode: (mode) =>
        set((state) => {
          state.ganttViewMode = mode;
        }),

      setCanOnlyFitInYearView: (canFit) =>
        set((state) => {
          state.canOnlyFitInYearView = canFit;
        }),

      setScrollToDate: (date) =>
        set((state) => {
          state.scrollToDate = date;
        }),

      setMilestonesOpenStatus: (status) =>
        set((state) => {
          state.milestonesOpenStatus = status;
        }),

      updateMilestoneOpenStatus: (milestoneId, isOpen) =>
        set((state) => {
          state.milestonesOpenStatus[milestoneId] = isOpen;
        }),

      // ===== MODAL ACTIONS =====

      setTaskEditModalOpen: (isOpen) =>
        set((state) => {
          state.isTaskEditModalOpen = isOpen;
        }),

      setSelectedTask: (task) =>
        set((state) => {
          state.selectedTask = task;
        }),

      setIsCreatingNewTask: (isCreating) =>
        set((state) => {
          state.isCreatingNewTask = isCreating;
        }),

      setNewTaskMilestoneId: (milestoneId) =>
        set((state) => {
          state.newTaskMilestoneId = milestoneId;
        }),

      setIsUpdatingTask: (isUpdating) =>
        set((state) => {
          state.isUpdatingTask = isUpdating;
        }),

      setAssigneeModalOpen: (isOpen) =>
        set((state) => {
          state.isAssigneeModalOpen = isOpen;
        }),

      setSelectedTaskForAssignee: (task) =>
        set((state) => {
          state.selectedTaskForAssignee = task;
        }),

      setSelectedMilestoneForAssignee: (milestone) =>
        set((state) => {
          state.selectedMilestoneForAssignee = milestone;
        }),

      setDependenciesModalOpen: (isOpen) =>
        set((state) => {
          state.isDependenciesModalOpen = isOpen;
        }),

      setSelectedTaskForDependencies: (task) =>
        set((state) => {
          state.selectedTaskForDependencies = task;
        }),

      closeAllModals: () =>
        set((state) => {
          state.isTaskEditModalOpen = false;
          state.isAssigneeModalOpen = false;
          state.isDependenciesModalOpen = false;
          state.selectedTask = null;
          state.selectedTaskForAssignee = null;
          state.selectedMilestoneForAssignee = null;
          state.selectedTaskForDependencies = null;
          state.isCreatingNewTask = false;
          state.newTaskMilestoneId = null;
        }),

      // ===== COMPLEX ACTIONS =====

      initializeMilestones: (milestones) =>
        set((state) => {
          state.milestones = milestones;

          // Initialize UI state
          const expandedMilestones = milestones.reduce(
            (acc, milestone) => {
              acc[milestone.id] = true;
              return acc;
            },
            {} as { [key: string]: boolean },
          );
          state.expandedMilestones = expandedMilestones;

          const openStatus = milestones.reduce(
            (acc, milestone) => {
              acc[milestone.id] = true;
              return acc;
            },
            {} as { [key: string]: boolean },
          );
          state.milestonesOpenStatus = openStatus;
        }),

      updateSearchExpansion: (filteredMilestones) =>
        set((state) => {
          const searchQuery = state.searchQuery;
          if (!searchQuery.trim()) {
            return; // No search active
          }

          // Auto-expand milestones with filtered content
          const newExpandedState = { ...state.expandedMilestones };
          filteredMilestones.forEach((milestone) => {
            newExpandedState[milestone.id] = true;
          });
          state.expandedMilestones = newExpandedState;
        }),

      resetSearchState: () =>
        set((state) => {
          state.searchQuery = "";

          // Reset to all milestones expanded
          const expandedMilestones = state.milestones.reduce(
            (acc, milestone) => {
              acc[milestone.id] = true;
              return acc;
            },
            {} as { [key: string]: boolean },
          );
          state.expandedMilestones = expandedMilestones;
        }),
    })),
  ),
);
