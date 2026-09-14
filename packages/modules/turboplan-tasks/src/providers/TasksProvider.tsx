/**
 * Tasks Context Provider
 * Single Responsibility: Provide tasks state and handlers via context
 * Dependency Inversion: Components depend on context abstraction, not concrete props
 */

import React, { createContext, useContext } from "react";

import type { UseProjectTasksUIReturn } from "../hooks";

// Context creation
const TasksContext = createContext<UseProjectTasksUIReturn | null>(null);

// Provider component
interface TasksProviderProps {
  children: React.ReactNode;
  tasks: UseProjectTasksUIReturn;
}

export function TasksProvider({ children, tasks }: TasksProviderProps) {
  return (
    <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>
  );
}

// Custom hook for consuming context
export function useTasks(): UseProjectTasksUIReturn {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return context;
}

// Convenience hooks for specific concerns (Interface Segregation)
export function useTasksData() {
  const {
    displayMilestones,
    filteredMilestones,
    loading,
    error,
    availableUsers,
  } = useTasks();
  return {
    displayMilestones,
    filteredMilestones,
    loading,
    error,
    availableUsers,
  };
}

export function useTasksHandlers() {
  const { handlers } = useTasks();
  return handlers;
}

export function useTasksControls() {
  const { controls } = useTasks();
  return controls;
}

export function useTasksUI() {
  const { ui } = useTasks();
  return {
    activeTab: ui.activeTab,
    searchQuery: ui.searchQuery,
    filterMode: ui.filterMode,
    ganttViewMode: ui.ganttViewMode,
    milestonesOpenStatus: ui.milestonesOpenStatus,
    expandedMilestones: ui.expandedMilestones,
    isTaskEditModalOpen: ui.isTaskEditModalOpen,
    selectedTask: ui.selectedTask,
    isCreatingNewTask: ui.isCreatingNewTask,
    newTaskMilestoneId: ui.newTaskMilestoneId,
    isAssigneeModalOpen: ui.isAssigneeModalOpen,
    selectedTaskForAssignee: ui.selectedTaskForAssignee,
    selectedMilestoneForAssignee: ui.selectedMilestoneForAssignee,
    isDependenciesModalOpen: ui.isDependenciesModalOpen,
    selectedTaskForDependencies: ui.selectedTaskForDependencies,
  };
}
