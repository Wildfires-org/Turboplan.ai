import {
  ResearchAgentChatStatus,
  type ResearchAgentChatStatusType,
} from "@wildfires-org/turboplan-db/schemas";

// Re-export DB types
export type {
  ResearchAgentChat,
  ResearchAgentChatStatusType,
} from "@wildfires-org/turboplan-db/schemas";
export { ResearchAgentChatStatus } from "@wildfires-org/turboplan-db/schemas";

/**
 * Statuses a run never leaves on its own. A terminal run's webhook secret stops
 * authenticating and webhook-driven updates cannot move it back to active; only
 * an explicit retry (which rotates the secret) re-opens it.
 */
export const TERMINAL_RESEARCH_AGENT_CHAT_STATUSES: ResearchAgentChatStatusType[] =
  [
    ResearchAgentChatStatus.COMPLETED,
    ResearchAgentChatStatus.FAILED,
    ResearchAgentChatStatus.CANCELLED,
  ];

// Research agent message types
export const ResearchAgentMessageType = {
  PROGRESS: "progress",
  DOCUMENTS: "documents",
  MILESTONES: "milestones",
  FIELDS: "fields",
  CONTEXT: "context",
  TIMELINE: "timeline",
  SUGGESTIONS: "suggestions",
} as const;

export type ResearchAgentMessageTypeValue =
  (typeof ResearchAgentMessageType)[keyof typeof ResearchAgentMessageType];

// Message data payloads
export type ProgressMessageData = {
  step: string;
};

export type DocumentItem = {
  title: string;
  url: string;
  blobUrl?: string;
  relevance: number;
  context: string;
  folder?: string;
  folderDescription?: string;
  saved: boolean;
  /**
   * Set by the server when it probed an extensionless URL. Absent on URLs with
   * a document extension and on documents stored before probing existed.
   */
  isDownloadable?: boolean;
  /** Allowlisted document MIME type detected by the probe, if downloadable. */
  contentType?: string;
};

export type DocumentsMessageData = {
  documents: DocumentItem[];
};

export type TaskItem = {
  artifactId?: string;
  title: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  dependencies?: string[];
  saved?: boolean;
  projectTaskId?: string;
};

export type MilestoneItem = {
  artifactId?: string;
  title: string;
  startDate?: string;
  dueDate?: string;
  tasks: TaskItem[];
  saved: boolean;
  projectMilestoneId?: string;
};

export type MilestoneTaskSelection = {
  milestoneIndex: number;
  taskIndices: number[];
};

export type MilestoneSaveTask = Omit<TaskItem, "saved"> & {
  artifactId: string;
  sourceIndex: number;
};

export type MilestoneSaveItem = Omit<MilestoneItem, "saved" | "tasks"> & {
  artifactId: string;
  sourceIndex: number;
  tasks: MilestoneSaveTask[];
};

export type MilestoneTaskSaveLink = {
  artifactId: string;
  projectTaskId: string;
};

export type MilestoneSaveLink = {
  artifactId: string;
  projectMilestoneId: string;
  taskLinks: MilestoneTaskSaveLink[];
};

export type MilestonesMessageData = {
  milestones: MilestoneItem[];
};

export type FieldItem = {
  label: string;
  value: string;
  saved: boolean;
};

export type FieldsMessageData = {
  fields: FieldItem[];
};

export type ContextItem = {
  label: string;
  content: string;
  url?: string;
  saved: boolean;
};

export type ContextMessageData = {
  context: ContextItem[];
};

export type TimelineItem = {
  title: string;
  description?: string;
  startedAt?: string;
  endedAt?: string;
  resourceUrls?: { url: string; filename: string; type?: string }[];
  metadata?: Record<string, unknown>;
  saved: boolean;
};

export type TimelineMessageData = {
  timeline: TimelineItem[];
};

import type { Suggestion } from "@wildfires-org/turboplan-utils";

export type SuggestionItem = Suggestion;

/**
 * Framework-neutral fallback chips, shown until project-specific next-step
 * suggestions have been generated. `{projectName}` is substituted at render.
 */
export const DEFAULT_SUGGESTION_TEMPLATES = [
  {
    label: "Summarize Next Steps",
    contentTemplate:
      "Summarize the next steps for {projectName} based on its review framework and current stage",
    emoji: "🧭",
  },
  {
    label: "Draft Outreach Letter",
    contentTemplate: "Draft a stakeholder outreach letter for {projectName}",
    emoji: "✉️",
  },
  {
    label: "Create Project Schedule",
    contentTemplate: "Create a project schedule and timeline for {projectName}",
    emoji: "📅",
  },
  {
    label: "Permit Checklist",
    contentTemplate:
      "Create a checklist of the permits, approvals and consultations {projectName} needs",
    emoji: "✅",
  },
  {
    label: "Project Summary",
    contentTemplate: "Write a one-page project summary for {projectName}",
    emoji: "📄",
  },
] as const;

export type SuggestionsMessageData = {
  suggestions: SuggestionItem[];
};

export type ResearchAgentMessageData =
  | ProgressMessageData
  | DocumentsMessageData
  | MilestonesMessageData
  | FieldsMessageData
  | ContextMessageData
  | TimelineMessageData
  | SuggestionsMessageData;

// Research agent message (matches research_agent_message table)
export type ResearchAgentMessage = {
  id: string;
  chatId: string;
  researchAgentChatId: string;
  type: ResearchAgentMessageTypeValue;
  data: ResearchAgentMessageData;
  createdAt: string;
};

// Research agent status response (from GET /status/:chatId)
export type ResearchAgentStatus = {
  hasActiveRun: boolean;
  runId?: string;
  status?: string;
  currentStep?: string;
  stepsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};
