import React from "react";

import { useTaskActions } from "../hooks";
import { useTaskStore } from "../stores/task-store";
import { MilestoneWithTasks } from "../types";
import { CardView, GanttView, TasksEmpty, TasksTable } from "./index";

interface TasksContentProps {
  displayMilestones: MilestoneWithTasks[];
  filteredMilestones: MilestoneWithTasks[];
  documentId: string;
  isCurrentVersion: boolean;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}

export const TasksContent: React.FC<TasksContentProps> = ({
  displayMilestones,
  filteredMilestones,
  documentId,
  isCurrentVersion,
  onSaveContent,
}) => {
  const {
    loading,
    error,
    activeTab,
    searchQuery,
    filterMode,
    expandedMilestones,
    ganttViewMode,
    milestonesOpenStatus,
    toggleMilestone,
  } = useTaskStore();

  const {
    handleTaskClick,
    handleTaskStatusClick,
    handleOpenCreateTaskModal,
    handleRenameMilestone,
    handleDeleteMilestone,
    handleCreateMilestone,
    handleAvatarClick,
    handleManageDependencies,
    handleDeleteTask,
    handleRenameTask,
    handleDateChange,
  } = useTaskActions(documentId, onSaveContent);

  return (
    <div className="flex-1 p-4 flex flex-col">
      {/* Check for completely empty state (no milestones at all) */}
      {displayMilestones.length === 0 &&
      !searchQuery &&
      filterMode === "all" ? (
        <TasksEmpty isPreview={!isCurrentVersion} />
      ) : activeTab === "gantt" ? (
        <>
          {(searchQuery || filterMode === "hideCompleted") &&
          filteredMilestones.length === 0 ? (
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
          ) : (
            <div className="flex flex-1 overflow-hidden">
              <TasksTable
                loading={loading}
                error={error}
                milestones={filteredMilestones}
                expandedMilestones={expandedMilestones}
                isReadOnly={!isCurrentVersion}
                onToggleMilestone={toggleMilestone}
                onCreateTask={
                  isCurrentVersion ? handleOpenCreateTaskModal : () => {}
                }
                onTaskClick={isCurrentVersion ? handleTaskClick : () => {}}
                onTaskStatusClick={
                  isCurrentVersion
                    ? (taskId: string) => handleTaskStatusClick(taskId)
                    : () => {}
                }
                onAvatarClick={isCurrentVersion ? handleAvatarClick : () => {}}
                onManageDependencies={
                  isCurrentVersion ? handleManageDependencies : () => {}
                }
                onOpenTask={isCurrentVersion ? handleTaskClick : () => {}}
                onDeleteTask={isCurrentVersion ? handleDeleteTask : () => {}}
                onCreateMilestone={
                  isCurrentVersion ? handleCreateMilestone : () => {}
                }
                onRenameMilestone={
                  isCurrentVersion ? handleRenameMilestone : () => {}
                }
                onRenameTask={isCurrentVersion ? handleRenameTask : () => {}}
                onDeleteMilestone={
                  isCurrentVersion ? handleDeleteMilestone : () => {}
                }
              />
              <div className="flex-1 min-w-0">
                <GanttView
                  milestones={filteredMilestones}
                  milestonesOpenStatus={milestonesOpenStatus}
                  viewMode={ganttViewMode}
                  isPreview={!isCurrentVersion}
                  onDateChange={isCurrentVersion ? handleDateChange : () => {}}
                  onSetViewMode={() => {}} // This is handled in header now
                  onSetCanOnlyFitInYearView={() => {}} // Not needed here
                  scrollToDate={null}
                  resetScrollToDate={() => {}}
                  onTaskClick={isCurrentVersion ? handleTaskClick : () => {}}
                  userId="current-user"
                  addInnerEmptyItem={isCurrentVersion}
                  importedIds={[]}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {(searchQuery || filterMode === "hideCompleted") &&
          filteredMilestones.length === 0 ? (
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
          ) : (
            <CardView
              milestones={filteredMilestones}
              loading={loading}
              error={error}
              onAddTask={
                isCurrentVersion ? handleOpenCreateTaskModal : () => {}
              }
              onAddMilestone={
                isCurrentVersion ? handleCreateMilestone : () => {}
              }
              onTaskStatusClick={
                isCurrentVersion
                  ? (taskId) => handleTaskStatusClick(taskId)
                  : () => {}
              }
              onTaskClick={
                isCurrentVersion
                  ? (taskId) => handleTaskClick(taskId)
                  : () => {}
              }
            />
          )}
        </>
      )}
    </div>
  );
};
