import React, { useMemo } from "react";

import { noop } from "lodash";

import {
  useTasksControls,
  useTasksData,
  useTasksHandlers,
  useTasksUI,
} from "../providers";
import type {
  DateChangedPayload,
  Milestone,
  ProjectDocumentInfo,
  Task,
  TaskInviteContext,
  TaskStatus,
  User,
} from "../types";
import { TasksHeader } from "./tasks-header";
import { TasksListSkeleton } from "./tasks-list-skeleton";
import { TasksModals } from "./tasks-modals";
import { TasksView } from "./tasks-view";

interface TasksContainerProps {
  className?: string;
  isCurrentVersion?: boolean;
  isPreview?: boolean;
  /** Pre-rendered timeline content for the selected task */
  timelineContent?: React.ReactNode;
  /** Project cover image URL for the task edit modal header */
  coverImageUrl?: string | null;
  /** Breadcrumb path segments for the task edit modal header */
  projectPath?: string[];
  /** Project documents for the task edit modal documents section */
  projectDocuments?: ProjectDocumentInfo[];
  /** Callback for uploading a document and getting it back */
  onUploadDocument?: (file: File) => Promise<ProjectDocumentInfo | undefined>;
  /** Callback to open the assignment dialog */
  onOpenAssignmentDialog?: (
    context: TaskInviteContext,
    currentAssigneeIds: string[],
    onAssign: (userIds: string[]) => void,
  ) => void;
}

export const TasksContainer: React.FC<TasksContainerProps> = ({
  className = "",
  isCurrentVersion = true,
  isPreview = false,
  timelineContent,
  coverImageUrl,
  projectPath,
  projectDocuments,
  onUploadDocument,
  onOpenAssignmentDialog,
}) => {
  const {
    displayMilestones,
    filteredMilestones,
    loading,
    error,
    availableUsers,
  } = useTasksData();
  const handlers = useTasksHandlers();
  const controls = useTasksControls();
  const {
    activeTab,
    searchQuery,
    filterMode,
    ganttViewMode,
    milestonesOpenStatus,
    expandedMilestones,
    isTaskEditModalOpen,
    selectedTask,
    isCreatingNewTask,
    newTaskMilestoneId,
    isDependenciesModalOpen,
    selectedTaskForDependencies,
  } = useTasksUI();

  // Collect all document IDs linked to any task (excluding the selected one)
  const allLinkedDocumentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const milestone of displayMilestones) {
      for (const task of milestone.tasks) {
        if (task.id === selectedTask?.id) {
          continue;
        }
        for (const docId of task.projectDocumentIds ?? []) {
          ids.add(docId);
        }
      }
    }
    return Array.from(ids);
  }, [displayMilestones, selectedTask?.id]);

  if (loading && displayMilestones.length === 0) {
    return <TasksListSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading tasks</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && displayMilestones.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className="text-gray-600 mb-2">No tasks found</p>
          <p className="text-gray-500 text-sm">
            Create your first milestone to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <TasksHeader
        activeTab={activeTab}
        searchQuery={searchQuery}
        filterMode={filterMode}
        ganttViewMode={ganttViewMode}
        filteredMilestones={filteredMilestones}
        isCurrentVersion={isCurrentVersion}
        onActiveTabChange={controls.setActiveTab}
        onSearchQueryChange={controls.setSearchQuery}
        onFilterModeChange={controls.setFilterMode}
        onGanttViewModeChange={controls.setGanttViewMode}
        onClearSearch={controls.clearSearch}
        onShowAll={controls.showAll}
      />

      {/* Main Content */}
      <TasksView
        activeTab={activeTab}
        milestones={displayMilestones}
        filteredMilestones={filteredMilestones}
        loading={loading}
        error={error}
        availableUsers={availableUsers}
        searchQuery={searchQuery}
        filterMode={filterMode}
        expandedMilestones={expandedMilestones}
        milestonesOpenStatus={milestonesOpenStatus}
        ganttViewMode={ganttViewMode}
        isCurrentVersion={isCurrentVersion}
        isPreview={isPreview}
        onTaskClick={
          isCurrentVersion
            ? (taskId: string) => {
                const task = displayMilestones
                  .flatMap((m) => m.tasks)
                  .find((t) => t.id === taskId);
                if (task) handlers.handleTaskClick(task);
              }
            : noop
        }
        onTaskStatusClick={
          isCurrentVersion
            ? (taskId: string, status?: TaskStatus) => {
                const task = displayMilestones
                  .flatMap((m) => m.tasks)
                  .find((t) => t.id === taskId);
                if (!task) {
                  return;
                }
                // A specific status from the dropdown sets it directly;
                // a bare click (no status) falls back to cycling.
                if (status) {
                  handlers.handleTaskStatusChange(taskId, status);
                } else {
                  handlers.handleTaskStatusClick(taskId, task.status);
                }
              }
            : noop
        }
        onCreateTask={isCurrentVersion ? handlers.handleCreateTask : noop}
        onCreateMilestone={
          isCurrentVersion ? handlers.handleCreateMilestone : noop
        }
        onRenameMilestone={
          isCurrentVersion ? handlers.handleRenameMilestone : noop
        }
        onRenameTask={isCurrentVersion ? handlers.handleRenameTask : noop}
        onDeleteMilestone={
          isCurrentVersion ? handlers.handleDeleteMilestone : noop
        }
        onDeleteTask={isCurrentVersion ? handlers.handleDeleteTask : noop}
        onToggleMilestone={controls.toggleMilestone}
        onAvatarClick={
          isCurrentVersion
            ? (itemId: string) => {
                const task = displayMilestones
                  .flatMap((m) => m.tasks)
                  .find((t) => t.id === itemId);
                const milestone = displayMilestones.find(
                  (m) => m.id === itemId,
                );
                const item = task || milestone;

                if (!item?.id) {
                  console.error("Invalid item for avatar click - missing id:", {
                    itemId,
                    item,
                    task,
                    milestone,
                  });
                  return;
                }

                // When external dialog is available, open it directly
                // without going through internal modal state
                if (onOpenAssignmentDialog) {
                  const isTask = "milestoneId" in item;
                  const context: TaskInviteContext = isTask
                    ? { taskId: item.id, taskTitle: (item as Task).title }
                    : {
                        milestoneId: item.id,
                        milestoneTitle: (item as Milestone).title,
                      };
                  const currentAssigneeIds = Array.isArray(item.assignees)
                    ? item.assignees.map((u: User) => u.id)
                    : [];
                  const target = isTask
                    ? { taskId: item.id }
                    : { milestoneId: item.id };

                  onOpenAssignmentDialog(
                    context,
                    currentAssigneeIds,
                    (userIds: string[]) => {
                      handlers.handleUpdateAssignees(target, userIds);
                    },
                  );
                } else {
                  handlers.handleAvatarClick(item);
                }
              }
            : noop
        }
        onManageDependencies={
          isCurrentVersion
            ? (taskId: string) => {
                const task = displayMilestones
                  .flatMap((m) => m.tasks)
                  .find((t) => t.id === taskId);
                if (task) handlers.handleManageDependencies(task);
              }
            : noop
        }
        onDateChange={
          isCurrentVersion
            ? (payload: DateChangedPayload) => {
                // Determine if it's a milestone based on the payload structure
                const isMilestone = !displayMilestones
                  .flatMap((m) => m.tasks)
                  .find((t) => t.id === payload.id);
                handlers.handleDateChange(payload, isMilestone);
              }
            : noop
        }
      />

      {/* Modals */}
      <TasksModals
        // Task Edit Modal
        isTaskEditModalOpen={isTaskEditModalOpen}
        selectedTask={selectedTask}
        isCreatingNewTask={isCreatingNewTask}
        newTaskMilestoneId={newTaskMilestoneId}
        onCloseTaskModal={handlers.handleCloseTaskModal}
        onTaskModalSave={handlers.handleTaskModalSave}
        timelineContent={timelineContent}
        coverImageUrl={coverImageUrl}
        projectPath={projectPath}
        projectDocuments={projectDocuments}
        allLinkedDocumentIds={allLinkedDocumentIds}
        onUploadDocument={onUploadDocument}
        onTaskUpdate={handlers.handleTaskInlineUpdate}
        onOpenAssignmentDialog={onOpenAssignmentDialog}
        onDeleteTask={handlers.handleDeleteTask}
        readOnly={!isCurrentVersion}
        // Dependencies Modal
        isDependenciesModalOpen={isDependenciesModalOpen}
        selectedTaskForDependencies={selectedTaskForDependencies}
        onCloseDependenciesModal={handlers.handleCloseDependenciesModal}
        onDependenciesSave={handlers.handleDependenciesSave}
        // Shared data
        milestones={displayMilestones}
        availableUsers={availableUsers}
      />
    </div>
  );
};
