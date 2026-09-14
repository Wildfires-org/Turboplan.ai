// Shared types and constants for table components

import {
  type MilestoneWithTasks,
  type Task,
  type TaskStatus,
} from "../../types";
import { COLUMNS } from "./constants";

// Extract column keys from configuration
export type ColumnKey = (typeof COLUMNS)[number]["key"];

// Column visibility state
export interface ColumnVisibility {
  assignee: boolean;
  startDate: boolean;
  dueDate: boolean;
  status: boolean;
}

// Main table props
export interface TasksTableProps {
  loading: boolean;
  error: string | null;
  milestones: MilestoneWithTasks[];
  expandedMilestones: { [key: string]: boolean };
  /** When true, hides action menus and edit controls */
  isReadOnly?: boolean;
  onToggleMilestone: (milestoneId: string) => void;
  onCreateTask: (milestoneId?: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onAvatarClick?: (taskId: string) => void;
  onManageDependencies?: (taskId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onCreateMilestone?: () => void;
  onRenameMilestone?: (milestoneId: string, newTitle: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

// Individual component props
export interface MilestoneRowProps {
  milestone: MilestoneWithTasks;
  isExpanded: boolean;
  isDragging: boolean;
  columnVisibility: ColumnVisibility;
  taskColumnWidth: number;
  /** When true, hides action menus and edit controls */
  isReadOnly?: boolean;
  onToggleMilestone: (milestoneId: string) => void;
  onCreateTask: (milestoneId?: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onAvatarClick?: (taskId: string) => void;
  onManageDependencies?: (taskId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onRenameMilestone?: (milestoneId: string, newTitle: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export interface TaskRowProps {
  task: Task;
  milestoneId: string;
  isDragging: boolean;
  columnVisibility: ColumnVisibility;
  taskColumnWidth: number;
  /** When true, hides action menus and edit controls */
  isReadOnly?: boolean;
  onTaskClick?: (taskId: string) => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onAvatarClick?: (taskId: string) => void;
  onManageDependencies?: (taskId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export interface TableHeaderProps {
  columnVisibility: ColumnVisibility;
  taskColumnWidth: number;
  /** When true, hides the actions column */
  isReadOnly?: boolean;
  onToggleColumnVisibility: (column: ColumnKey) => void;
}

export interface ColumnSettingsDropdownProps {
  columnVisibility: ColumnVisibility;
  onToggleColumnVisibility: (column: ColumnKey) => void;
  isVisible: boolean;
}
export interface ResizeHandleProps {
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
}

export interface StatusButtonProps {
  status: string;
  onStatusChange?: (status: TaskStatus) => void;
  /** When true, renders as plain text without button styling */
  isReadOnly?: boolean;
}
