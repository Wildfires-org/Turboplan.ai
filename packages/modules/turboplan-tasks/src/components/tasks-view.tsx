/**
 * Pure Tasks View Component
 * Only handles rendering - receives data and callbacks as props
 */

import React from "react";

import type { TasksViewProps } from "../types";
import { CardView } from "./card-view";
import { GanttView } from "./gantt-view";
import { TasksEmpty } from "./tasks-empty";
import { TasksError } from "./tasks-error";
import { TasksListSkeleton } from "./tasks-list-skeleton";
import { TasksTable } from "./tasks-table";

export const TasksView: React.FC<TasksViewProps> = ({
  milestones,
  filteredMilestones,
  loading,
  error,
  activeTab,
  searchQuery,
  filterMode,
  expandedMilestones,
  milestonesOpenStatus,
  ganttViewMode,
  isCurrentVersion = true,
  isPreview = false,
  onTaskClick = () => {},
  onTaskStatusClick = () => {},
  onCreateTask = () => {},
  onCreateMilestone = () => {},
  onRenameMilestone = () => {},
  onRenameTask = () => {},
  onDeleteMilestone = () => {},
  onDeleteTask = () => {},
  onAvatarClick = () => {},
  onManageDependencies = () => {},
  onDateChange = () => {},
  onToggleMilestone = () => {},
  onRetry = () => {},
}) => {
  if (loading) {
    return <TasksListSkeleton withHeader={false} />;
  }

  if (error) {
    return <TasksError error={error} onRetry={onRetry} />;
  }

  // Check for completely empty state (no milestones at all)
  if (milestones.length === 0 && !searchQuery && filterMode === "all") {
    return <TasksEmpty isPreview={isPreview} />;
  }

  // Check for empty filtered results
  if (
    (searchQuery || filterMode === "hideCompleted") &&
    filteredMilestones.length === 0
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">
            No milestones or tasks match your current filters
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Try adjusting your search or filter settings
          </p>
        </div>
      </div>
    );
  }

  if (activeTab === "gantt") {
    return (
      <div className="flex flex-1 overflow-hidden">
        <TasksTable
          loading={false}
          error={null}
          milestones={filteredMilestones}
          expandedMilestones={expandedMilestones}
          isReadOnly={!isCurrentVersion}
          onToggleMilestone={onToggleMilestone}
          onCreateTask={onCreateTask}
          onTaskClick={onTaskClick}
          onTaskStatusClick={onTaskStatusClick}
          onAvatarClick={onAvatarClick}
          onManageDependencies={onManageDependencies}
          onOpenTask={onTaskClick}
          onDeleteTask={onDeleteTask}
          onCreateMilestone={onCreateMilestone}
          onRenameMilestone={onRenameMilestone}
          onRenameTask={onRenameTask}
          onDeleteMilestone={onDeleteMilestone}
        />
        <div className="flex-1 min-w-0">
          <GanttView
            milestones={filteredMilestones}
            milestonesOpenStatus={milestonesOpenStatus}
            viewMode={ganttViewMode}
            isPreview={!isCurrentVersion}
            onDateChange={onDateChange}
            onSetViewMode={() => {}} // This is handled in header now
            onSetCanOnlyFitInYearView={() => {}} // Not needed here
            scrollToDate={null}
            resetScrollToDate={() => {}}
            onTaskClick={onTaskClick}
            userId="current-user"
            addInnerEmptyItem={isCurrentVersion}
            importedIds={[]}
          />
        </div>
      </div>
    );
  }

  return (
    <CardView
      milestones={filteredMilestones}
      loading={false}
      error={null}
      onAddTask={onCreateTask}
      onAddMilestone={onCreateMilestone}
      onTaskStatusClick={onTaskStatusClick}
      onTaskClick={onTaskClick}
    />
  );
};
