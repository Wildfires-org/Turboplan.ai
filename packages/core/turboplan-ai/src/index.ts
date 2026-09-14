/**
 * Chat prompts as plain string constants for TurboPlan
 *
 * This package provides reusable prompt templates as simple string constants
 * that can be imported and used directly across the TurboPlan system.
 *
 */

// Re-export core logic
export { generateProjectTasksContext } from "./core";
// Re-export systemPrompt separately to avoid circular dependency (system-prompt -> services -> core)
export { systemPrompt } from "./core/system-prompt";
// Re-export variables
export {
  extractVariables,
  getVariablesForPrompt,
  isValidVariable,
  isVariableApplicable,
  PROMPT_VARIABLES,
  type PromptVariable,
  parsePromptVariables,
  type VariableContext,
} from "./core/variables";
// Re-export prompts
export {
  baseIdentityPrompt,
  codePrompt,
  fullModePrompt,
  researchAgentForwardMessagesTemplate,
  researchAgentNoResultsContextTemplate,
  researchAgentStartPromptTemplate,
  researchModePrompt,
  sheetPrompt,
  textDocumentPrompt,
  updateDocumentPrompt,
} from "./prompts";
// Re-export generate-titles prompts
export {
  generateTitlesSystemPrompt,
  generateTitlesUserPrompt,
} from "./prompts/generate-titles";
// Re-export prompt service
export { getPrompt, type PromptName } from "./services/prompt-service";
export type { ArtifactKind, Prompt } from "./types";
// Re-export types
export { ChatMode } from "./types";
