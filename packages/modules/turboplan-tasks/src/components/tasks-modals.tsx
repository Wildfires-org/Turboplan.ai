import React from "react";

import type { TasksModalsProps } from "../types";
import { TaskDependenciesModal, TaskEditModal } from "./index";

export const TasksModals: React.FC<TasksModalsProps> = ({
  milestones = [],
  isTaskEditModalOpen = false,
  selectedTask = null,
  isCreatingNewTask = false,
  newTaskMilestoneId = null,
  isDependenciesModalOpen = false,
  selectedTaskForDependencies = null,
  timelineContent,
  coverImageUrl,
  projectPath,
  projectDocuments,
  allLinkedDocumentIds,
  onUploadDocument,
  onTaskUpdate,
  onOpenAssignmentDialog,
  onDeleteTask,
  readOnly = false,
  onTaskModalSave = () => {},
  onDependenciesSave = () => {},
  onCloseTaskModal = () => {},
  onCloseDependenciesModal = () => {},
}) => {
  return (
    <>
      {/* Task Edit Modal - only render when needed */}
      {(selectedTask || isCreatingNewTask) && (
        <TaskEditModal
          task={selectedTask}
          isOpen={isTaskEditModalOpen}
          isCreatingNew={isCreatingNewTask}
          milestoneId={newTaskMilestoneId || undefined}
          onSave={onTaskModalSave}
          onClose={onCloseTaskModal}
          timelineContent={!isCreatingNewTask ? timelineContent : undefined}
          coverImageUrl={coverImageUrl}
          projectPath={projectPath}
          projectDocuments={projectDocuments}
          allLinkedDocumentIds={allLinkedDocumentIds}
          onUploadDocument={onUploadDocument}
          onTaskUpdate={onTaskUpdate}
          onOpenAssignmentDialog={onOpenAssignmentDialog}
          onDeleteTask={onDeleteTask}
          readOnly={readOnly}
        />
      )}

      {/* Dependencies Modal - only render when task is selected */}
      {selectedTaskForDependencies && (
        <TaskDependenciesModal
          isOpen={isDependenciesModalOpen}
          task={selectedTaskForDependencies}
          milestones={Array.isArray(milestones) ? milestones : []}
          onSave={onDependenciesSave}
          onClose={onCloseDependenciesModal}
        />
      )}
    </>
  );
};
