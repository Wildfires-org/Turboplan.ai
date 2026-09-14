import type React from "react";

import type { ProjectDocument } from "@wildfires-org/turboplan-documents/types";

import type {
  DateChangedPayload,
  MilestoneWithTasks,
  Task,
  TaskStatus,
  User,
  ViewMode,
} from "./index";

export type { ProjectDocumentUploader } from "@wildfires-org/turboplan-documents/types";

export type ProjectDocumentInfo = ProjectDocument;

/**
 * Props for the GanttView component
 */
export interface GanttViewProps {
  milestones: MilestoneWithTasks[];
  milestonesOpenStatus: { [key: string]: boolean };
  viewMode?: ViewMode;
  isPreview?: boolean;
  onDateChange: (payload: DateChangedPayload) => void;
  onSetViewMode: (viewMode: ViewMode, isAutomatic?: boolean) => void;
  onSetCanOnlyFitInYearView: (v: boolean) => void;
  scrollToDate?: Date | null;
  resetScrollToDate?: () => void;
  addInnerEmptyItem?: boolean; // Defaults to true - adds empty items for "+Add Task" buttons
  importedIds?: string[];
  preStepsCount?: boolean;
  onTaskClick?: (taskId: string) => void;
  userId?: string;
}

/**
 * Props for the TasksView component
 */
export interface TasksViewProps {
  // Data
  milestones: MilestoneWithTasks[];
  filteredMilestones: MilestoneWithTasks[];
  loading: boolean;
  error: string | null;
  availableUsers: User[];

  // UI State
  activeTab: "gantt" | "card";
  searchQuery: string;
  filterMode: "all" | "hideCompleted";
  expandedMilestones: { [key: string]: boolean };
  milestonesOpenStatus: { [key: string]: boolean };
  ganttViewMode: ViewMode;

  // View control
  isCurrentVersion?: boolean;
  isPreview?: boolean;

  // Callbacks
  onTaskClick?: (taskId: string) => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onCreateTask?: (milestoneId?: string) => void;
  onCreateMilestone?: () => void;
  onRenameMilestone?: (milestoneId: string, newTitle: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAvatarClick?: (itemId: string) => void;
  onManageDependencies?: (taskId: string) => void;
  onDateChange?: (payload: DateChangedPayload) => void;
  onToggleMilestone?: (milestoneId: string) => void;
  onRetry?: () => void;
}

/**
 * Props for the TasksHeader component
 */
export interface TasksHeaderProps {
  // UI State
  searchQuery: string;
  activeTab: "gantt" | "card";
  filterMode: "all" | "hideCompleted";
  ganttViewMode: ViewMode;

  // Data
  filteredMilestones: MilestoneWithTasks[];

  // Control
  isCurrentVersion?: boolean;

  // Callbacks
  onActiveTabChange?: (tab: "gantt" | "card") => void;
  onSearchQueryChange?: (query: string) => void;
  onFilterModeChange?: (mode: "all" | "hideCompleted") => void;
  onGanttViewModeChange?: (mode: ViewMode) => void;
  onClearSearch?: () => void;
  onShowAll?: () => void;
}

/**
 * Props for the TasksModals component
 */
export interface TasksModalsProps {
  // Optional documentId for artifact contexts
  documentId?: string;
  onSaveContent?: (updatedContent: string, debounce: boolean) => void;

  // Data
  availableUsers?: User[];
  milestones?: MilestoneWithTasks[];

  // Modal State
  isTaskEditModalOpen?: boolean;
  selectedTask?: Task | null;
  isCreatingNewTask?: boolean;
  newTaskMilestoneId?: string | null;
  isDependenciesModalOpen?: boolean;
  selectedTaskForDependencies?: Task | null;

  // Pre-rendered timeline content for the selected task
  timelineContent?: React.ReactNode;

  // Project context for redesigned modal
  coverImageUrl?: string | null;
  projectPath?: string[];
  projectDocuments?: ProjectDocumentInfo[];
  allLinkedDocumentIds?: string[];
  onUploadDocument?: (file: File) => Promise<ProjectDocumentInfo | undefined>;
  onTaskUpdate?: (updatedTask: Partial<Task>) => void;
  onOpenAssignmentDialog?: (
    context: TaskInviteContext,
    currentAssigneeIds: string[],
    onAssign: (userIds: string[]) => void,
  ) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  readOnly?: boolean;

  // Modal Callbacks
  onTaskModalSave?: (updatedTask: Partial<Task>) => void;
  onDependenciesSave?: (taskId: string, dependencies: string[]) => void;
  onCloseTaskModal?: () => void;
  onCloseDependenciesModal?: () => void;
}

/**
 * Task context for assignment dialog
 */
export interface TaskInviteContext {
  taskId?: string;
  milestoneId?: string;
  taskTitle?: string;
  milestoneTitle?: string;
}
