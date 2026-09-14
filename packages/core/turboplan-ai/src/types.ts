/**
 * Type definitions for the turboplan-ai package
 */

// Type alias for clarity (optional)
export type Prompt = string;

// Type for artifact kinds to avoid external dependencies
export type ArtifactKind = "text" | "code" | "sheet";

// Chat mode enum — values double as prompt names in the prompt service
export const ChatMode = {
  Research: "research-mode",
  Full: "full-mode",
} as const;

export type ChatMode = (typeof ChatMode)[keyof typeof ChatMode];

// Research agent context split into saved and unsaved sections
export type ResearchAgentContext = {
  savedContext?: string;
  unsavedContext?: string;
  isActive: boolean;
};

// Type for system prompt props
export interface SystemPromptProps {
  /** Defaults to ChatMode.Full when omitted. Only set to ChatMode.Research during active research phase. */
  mode?: ChatMode;
  enabledFeatures?: {
    tasks?: boolean;
    map?: boolean;
  };
  /** Project name — injected into base-identity via {{projectName}} */
  projectName: string;
  // Context sections
  researchAgentStatus?: string;
  projectContextData?: string;
  projectFieldsContext?: string;
  savedResearchContext?: string;
  unsavedResearchContext?: string;
  projectDocumentsContext?: string;
  projectTasksContext?: string;
}

// Type for project task item
export interface ProjectTaskItem {
  title: string;
  description?: string | null;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  assignees?: Array<{ email: string }>;
}

// Type for project task
export interface ProjectTask {
  documentId: string;
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  tasks?: Array<ProjectTaskItem>;
}
