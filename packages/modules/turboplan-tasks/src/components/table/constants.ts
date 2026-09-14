// Column width constants
export const COLUMN_WIDTHS = {
  ASSIGNEE: 120,
  START_DATE: 140,
  DUE_DATE: 140,
  STATUS: 140,
  ACTIONS: 50,
} as const;

// Column configuration
export const COLUMNS = [
  { key: "assignee" as const, label: "Assignee" },
  { key: "startDate" as const, label: "Start Date" },
  { key: "dueDate" as const, label: "Due Date" },
  { key: "status" as const, label: "Status" },
] as const;

// Default column visibility
export const DEFAULT_COLUMN_VISIBILITY = {
  assignee: true,
  startDate: false,
  dueDate: false,
  status: true,
} as const;

// Table configuration
export const TABLE_CONFIG = {
  ROW_HEIGHT: 49,
  HEADER_HEIGHT: 54,
  MIN_PADDING: 20,
} as const;

// Temporary task ID prefix
export const TMP_TASK_PREPEND = "tmp-task_";
