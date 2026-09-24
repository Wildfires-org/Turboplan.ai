"use client";

import { useMemo, useState } from "react";

import { TasksContainer } from "@wildfires-org/turboplan-tasks/components";
import { TasksProvider } from "@wildfires-org/turboplan-tasks/providers";
import type {
  MilestoneWithTasks,
  ViewMode,
} from "@wildfires-org/turboplan-tasks/types";

interface PublicTasksSectionProps {
  milestones: MilestoneWithTasks[];
}

export function PublicTasksSection({ milestones }: PublicTasksSectionProps) {
  // UI State - using useState so controls actually work
  const [activeTab, setActiveTab] = useState<"gantt" | "card">("gantt");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "hideCompleted">("all");
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("Month");
  const [expandedMilestones, setExpandedMilestones] = useState<
    Record<string, boolean>
  >(() => milestones.reduce((acc, m) => ({ ...acc, [m.id]: true }), {}));
  const [milestonesOpenStatus, setMilestonesOpenStatus] = useState<
    Record<string, boolean>
  >(() => milestones.reduce((acc, m) => ({ ...acc, [m.id]: true }), {}));

  // Computed data with filtering
  const computedData = useMemo(() => {
    const totalTasks = milestones.reduce(
      (sum, m) => sum + (m.tasks?.length || 0),
      0,
    );
    const completedTasks = milestones.reduce(
      (sum, m) =>
        sum + (m.tasks?.filter((t) => t.status === "completed").length || 0),
      0,
    );
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Apply filters
    let filtered = milestones;

    // Apply completion filter
    if (filterMode === "hideCompleted") {
      filtered = milestones
        .filter((m) => m.status !== "completed")
        .map((m) => ({
          ...m,
          tasks: m.tasks?.filter((t) => t.status !== "completed") || [],
        }));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered
        .map((m) => {
          const milestoneMatches = m.title.toLowerCase().includes(query);
          const filteredTasks =
            m.tasks?.filter((t) => t.title.toLowerCase().includes(query)) || [];

          if (milestoneMatches || filteredTasks.length > 0) {
            return { ...m, tasks: filteredTasks };
          }
          return null;
        })
        .filter(Boolean) as MilestoneWithTasks[];
    }

    return {
      displayMilestones: milestones,
      filteredMilestones: filtered,
      totalTasks,
      completedTasks,
      completionPercentage,
    };
  }, [milestones, searchQuery, filterMode]);

  // Toggle milestone expansion
  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
    setMilestonesOpenStatus((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
  };

  // Create tasks context with working controls
  const tasksContext = {
    // Base data
    loading: false,
    error: null,
    availableUsers: [],

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
      isTaskEditModalOpen: false,
      selectedTask: null,
      isCreatingNewTask: false,
      newTaskMilestoneId: null,
      isAssigneeModalOpen: false,
      selectedTaskForAssignee: null,
      selectedMilestoneForAssignee: null,
      isDependenciesModalOpen: false,
      selectedTaskForDependencies: null,
    },

    // UI Controls - these now actually work!
    controls: {
      setActiveTab,
      setSearchQuery,
      setFilterMode,
      setGanttViewMode,
      toggleMilestone,
      clearSearch: () => setSearchQuery(""),
      showAll: () => setFilterMode("all"),
    },

    // Handlers - all no-ops for read-only mode (edit actions disabled)
    handlers: {
      handleTaskClick: () => {},
      handleCreateTask: () => {},
      handleTaskModalSave: async () => {},
      handleCloseTaskModal: () => {},
      handleTaskStatusClick: async () => {},
      handleTaskStatusChange: async () => {},
      handleRenameTask: async () => {},
      handleDeleteTask: async () => {},
      handleCreateMilestone: async () => {},
      handleRenameMilestone: async () => {},
      handleDeleteMilestone: async () => {},
      handleAvatarClick: () => {},
      handleAssigneeModalSave: async () => {},
      handleCloseAssigneeModal: () => {},
      handleUpdateAssignees: async () => {},
      handleManageDependencies: () => {},
      handleDependenciesSave: async () => {},
      handleCloseDependenciesModal: () => {},
      handleTaskInlineUpdate: async () => {},
      handleDateChange: async () => {},
      handleRetry: async () => {},
    },
  };

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-brandAlt-100 px-4 py-8 text-center">
        <h3 className="mb-1 font-heading text-[18px] font-normal leading-[26px] text-egray-900">
          No tasks yet
        </h3>
        <p className="max-w-md font-inter text-[14px] leading-[20px] text-egray-700">
          This project doesn&apos;t have any tasks or milestones yet.
        </p>
      </div>
    );
  }

  return (
    <TasksProvider tasks={tasksContext}>
      {/* The shared tasks toolbar doesn't wrap on phones; scroll it inside
          the card instead of widening the page. */}
      <div className="min-w-0 overflow-x-auto">
        <TasksContainer
          className="w-full"
          isCurrentVersion={false}
          isPreview={true}
        />
      </div>
    </TasksProvider>
  );
}
