import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react";

// Database types are re-exported below to avoid conflicts

// Component prop types
export type {
  GanttViewProps,
  ProjectDocumentInfo,
  ProjectDocumentUploader,
  TaskInviteContext,
  TasksHeaderProps,
  TasksModalsProps,
  TasksViewProps,
} from "./components";
// Service interfaces and types
export type {
  ITaskDataService,
  ITaskSyncService,
  OptimisticOperation,
  ServiceResult,
} from "./service";
export {
  AuthenticationError,
  NetworkError,
  TaskServiceError,
  ValidationError,
} from "./service";

// ViewMode type for Gantt chart
export type ViewMode = "Day" | "Week" | "Month" | "Year";

// Import database types with alias to avoid conflicts
import type {
  Milestone as DbMilestone,
  Task as DbTask,
  User,
} from "@wildfires-org/turboplan-db";
import { TaskStatus } from "@wildfires-org/turboplan-db";

// Re-export TaskStatus for backward compatibility
export { TaskStatus };

// User type re-exported from database schema
export type { User };

// Enhanced Milestone type - always has optional assignees field
export interface Milestone extends DbMilestone {
  assignees?: User[]; // Array of assigned users (populated when needed, empty [] when not)
}

export interface MilestoneWithTasks extends Milestone {
  tasks: Task[]; // Tasks array when milestone is fetched with tasks
}

// Create/Update input types based on database schema
export interface MilestoneCreateInput {
  title: string;
  assigneeIds?: string[]; // Array of user IDs to assign
  startDate: Date;
  dueDate: Date;
  status?: TaskStatus;
  order?: number;
  documentId: string;
  projectId?: string; // Optional project ID for project association
  userId: string;
}

export interface MilestoneUpdateInput {
  title?: string;
  assigneeIds?: string[]; // Array of user IDs to assign
  startDate?: Date; // Optional for updates
  dueDate?: Date; // Optional for updates
  status?: TaskStatus;
  order?: number;
}

// Enhanced Task type - always has optional assignees field
export interface Task extends DbTask {
  assignees?: User[]; // Array of assigned users (populated when needed, empty [] when not)
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  assigneeIds?: string[]; // Array of user IDs to assign
  dependencies?: string[]; // Array of task IDs that this task depends on
  projectDocumentIds?: string[]; // Array of project document IDs linked to this task
  startDate: Date;
  dueDate: Date;
  status?: TaskStatus;
  order?: number;
  milestoneId: string;
  documentId: string;
  userId: string;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  assigneeIds?: string[]; // Array of user IDs to assign
  dependencies?: string[]; // Array of task IDs that this task depends on
  projectDocumentIds?: string[]; // Array of project document IDs linked to this task
  startDate?: Date; // Optional for updates
  dueDate?: Date; // Optional for updates
  status?: TaskStatus;
  order?: number;
  milestoneId?: string;
}

// (MilestoneWithTasks already defined above)

// Tool definitions
export const TaskManagementTools = {
  // Milestone tools
  createMilestone: "createMilestone",
  updateMilestone: "updateMilestone",
  deleteMilestone: "deleteMilestone",
  listMilestones: "listMilestones",
  getMilestone: "getMilestone",
  getMilestoneWithTasks: "getMilestoneWithTasks",

  // Task tools
  createTask: "createTask",
  updateTask: "updateTask",
  deleteTask: "deleteTask",
  listTasks: "listTasks",
  getTask: "getTask",
  listTasksByMilestone: "listTasksByMilestone",
  listTasksByStatus: "listTasksByStatus",
} as const;

// Repository interfaces
export interface MilestoneRepository {
  findAll(documentId: string): Promise<Milestone[]>;
  findAllWithTasks(documentId: string): Promise<MilestoneWithTasks[]>;
  findByProjectId(projectId: string): Promise<MilestoneWithTasks[]>;
  findByStatus(documentId: string, status: TaskStatus): Promise<Milestone[]>;
  findById(id: string): Promise<Milestone | null>;
  create(data: MilestoneCreateInput): Promise<Milestone>;
  createForRestore(
    data: MilestoneCreateInput & { id: string },
  ): Promise<Milestone>;
  update(id: string, data: MilestoneUpdateInput): Promise<Milestone | null>;
  delete(id: string): Promise<boolean>;
}

export interface TaskRepository {
  findAll(documentId: string): Promise<Task[]>;
  findAllByMilestone(milestoneId: string): Promise<Task[]>;
  findByStatus(documentId: string, status: TaskStatus): Promise<Task[]>;
  findByMilestoneAndStatus(
    milestoneId: string,
    status: TaskStatus,
  ): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(data: TaskCreateInput): Promise<Task>;
  createForRestore(data: TaskCreateInput & { id: string }): Promise<Task>;
  update(id: string, data: TaskUpdateInput): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
  deleteByMilestone(milestoneId: string): Promise<number>; // Returns count of deleted tasks
}

// Artifact-related types for fullscreen views
export interface ArtifactViewProps {
  type: "milestone" | "task";
  data: Milestone | Task | MilestoneWithTasks;
  onUpdate?: (data: Milestone | Task) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
}

export interface ArtifactViewConfig {
  title: string;
  allowEdit: boolean;
  allowDelete: boolean;
  showRelatedItems: boolean;
}

// Gantt integration types
export type TaskType = "task" | "milestone" | "project";
export type EmptyType = "empty";
export type Diamond = "diamond";
export type NoDatesType = "noDates";
export type TaskTypeExternal = TaskType | Diamond | NoDatesType | EmptyType;

export type TaskStyles = {
  backgroundColor?: string;
  backgroundSelectedColor?: string;
  progressColor?: string;
  progressSelectedColor?: string;
  diagonalHatchColor?: string;
  text?: {
    colorOutsideBar?: string;
    colorInsideBar?: string;
  };
  border?: {
    color: string;
    width: number;
  };
  dragHandleColor?: string;
};

export interface GanttTask {
  id: string;
  type: TaskTypeExternal;
  name: string;
  start: Date;
  end: Date;
  /**
   * From 0 to 100
   */
  progress: number;
  styles?: TaskStyles;
  isDisabled?: boolean;
  project?: string;
  dependencies?: string[];
  hideChildren?: boolean;
  displayOrder?: number;
  isTrackHighlighted?: boolean;
}

export type NormalizedGanttTask = {
  progress: number;
  dependencies: string[];
  isMilestone: boolean;
  path: string;
  completedAcres?: number;
  totalAcres?: number;
  totalTasks?: number;
  completedTasks?: number;
  isTrackHighlighted?: boolean;
} & Pick<Task, "status"> &
  GanttTask;

export interface DateChangedPayload {
  id: string;
  start: Date;
  end: Date;
}

export type EntityDates = {
  start: Date;
  end: Date;
  isValid: boolean;
  displayType: Diamond | NoDatesType | Extract<TaskType, "task" | "milestone">;
};

export interface GanttStyleConfig {
  initiated: TaskStyles;
  notInitiated: TaskStyles;
}

export interface TaskStatusColors {
  [TaskStatus.DRAFT]: string;
  [TaskStatus.NOT_STARTED]: string;
  [TaskStatus.IN_PROGRESS]: string;
  [TaskStatus.COMPLETED]: string;
  [TaskStatus.DELAYED]: string;
}

export const taskStatusBackgroundColor: TaskStatusColors = {
  [TaskStatus.DRAFT]: "#72767D",
  [TaskStatus.NOT_STARTED]: "#000000",
  [TaskStatus.IN_PROGRESS]: "#2768F7",
  [TaskStatus.COMPLETED]: "#00B64C",
  [TaskStatus.DELAYED]: "#ffa726",
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  [TaskStatus.DRAFT]: "Draft",
  [TaskStatus.NOT_STARTED]: "Not started",
  [TaskStatus.IN_PROGRESS]: "In progress",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.DELAYED]: "Delayed",
};

export interface TasksArtifactMetadata {
  tasks: Task[];
  milestones: Milestone[];
  refreshed?: number; // Timestamp to trigger refresh
  selectedVersion?: string; // Currently selected document version timestamp
}

export type ArtifactActionContext<M = unknown> = {
  content: string;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
};

export type ArtifactAction<M = unknown> = {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

export type ArtifactToolbarContext = {
  appendMessage: unknown; // UseChatHelpers['append'];
};

export type ArtifactToolbarItem = {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactToolbarContext) => void;
};

export interface ArtifactContent<M = unknown> {
  documentId: string;
  title: string;
  content: string;
  mode: "edit" | "diff";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: "streaming" | "idle";
  suggestions: Array<unknown>; // Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

export interface InitializeParameters<M = unknown> {
  documentId: string;
  setMetadata: Dispatch<SetStateAction<M>>;
}

export interface RestoreParameters<M = unknown> {
  documentId: string;
  content: string;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

export type ArtifactConfig<T extends string, M = unknown> = {
  kind: T;
  description: string;
  content: ComponentType<ArtifactContent<M>>;
  actions: Array<ArtifactAction<M>>;
  toolbar: ArtifactToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onRestore?: (parameters: RestoreParameters<M>) => Promise<void> | void;
  onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: unknown;
  }) => void;
};

export class Artifact<T extends string, M = unknown> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ArtifactContent<M>>;
  readonly actions: Array<ArtifactAction<M>>;
  readonly toolbar: ArtifactToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters<M>) => void;
  readonly onRestore?: (
    parameters: RestoreParameters<M>,
  ) => Promise<void> | void;
  readonly onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: unknown;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions || [];
    this.toolbar = config.toolbar || [];
    this.initialize = config.initialize || (async () => ({}));
    this.onRestore = config.onRestore;
    this.onStreamPart = config.onStreamPart;
  }
}

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: string;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

// Types for restore operations that match server schema.
// Neither carries a `userId`: the restore endpoints record the authenticated
// caller as the author and ignore any author the client names.
export interface TaskRestoreData {
  id: string;
  title: string;
  description?: string;
  status?: string;
  startDate: string; // ISO datetime string
  dueDate: string; // ISO datetime string
  order?: number;
  assigneeIds?: string[];
  dependencies?: string[];
  milestoneId: string;
  documentId: string;
}

export interface MilestoneRestoreData {
  id: string;
  title: string;
  status?: string;
  startDate: string; // ISO datetime string
  dueDate: string; // ISO datetime string
  order?: number;
  assigneeIds?: string[];
  documentId: string;
  projectId?: string; // Optional project ID for project association
}

// ============================================================================
// Raw Document Types (for JSON parsing from document content)
// These represent the shape of data before it's transformed to domain types
// ============================================================================

/**
 * Item that may have assignees in different formats (IDs or objects)
 */
export interface AssignableItem {
  assigneeIds?: string[] | null;
  assignees?: Array<{ id: string }>;
}

/**
 * Raw task from parsed JSON document
 */
export interface RawDocumentTask extends AssignableItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  startDate: string;
  dueDate: string;
  order: number;
  dependencies?: string[];
  userId?: string;
  [key: string]: unknown;
}

/**
 * Raw milestone from parsed JSON document
 */
export interface RawDocumentMilestone extends AssignableItem {
  id: string;
  title: string;
  status: string;
  startDate: string;
  dueDate: string;
  order: number;
  tasks?: RawDocumentTask[];
  userId?: string;
  [key: string]: unknown;
}
